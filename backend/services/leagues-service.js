export const defaultLeagues = [39, 140, 135, 78, 61, 88, 94];
import { allDBLeagues } from "../index.js";
import { extractTeams } from "./teams-service.js";
import { getLeagueStandingsFromDb } from "../data-access.js";
import { mergeWorldCupGroupStandings, resolveLeagueStandingsForPage } from "../backend-helper.js";
import { getPlayerList } from "./players-service.js";
import { lastMatchesFromLeague } from "./matches-service.js";
import { getTeamById } from "./teams-service.js";
import { readFile } from "fs/promises";
import path from "path";

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

const ROUND_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Final",
  "Third place",
];

const BRACKET_UNIT_PX = 132;
const BRACKET_MATCH_CARD_HEIGHT_PX = 106;
const WORLD_CUP_TEMPLATE_SEASON = 2026;

let worldCupBracketTemplatePromise = null;

function normalizeRound(roundName) {
  return String(roundName || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapRoundLabel(roundName) {
  const normalized = normalizeRound(roundName);

  if (!normalized) return null;
  if (normalized.includes("third") && normalized.includes("place")) return "Third place";
  if ((normalized.includes("round") && normalized.includes("32")) || normalized.includes("1 16")) {
    return "Round of 32";
  }
  if ((normalized.includes("round") && normalized.includes("16")) || normalized.includes("1 8")) {
    return "Round of 16";
  }
  if (normalized.includes("quarter") || normalized.includes("1 4")) return "Quarter-finals";
  if (normalized.includes("semi") || normalized.includes("1 2")) return "Semi-finals";
  if (
    normalized === "final" ||
    (normalized.includes("final") && !normalized.includes("semi") && !normalized.includes("quarter"))
  ) {
    return "Final";
  }

  return null;
}

function getWorldCupRoundLabel(templateKey) {
  const labels = {
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarter_finals: "Quarter-finals",
    semi_finals: "Semi-finals",
    third_place: "Third place",
    final: "Final",
  };

  return labels[templateKey] || null;
}

async function loadWorldCupBracketTemplate() {
  if (!worldCupBracketTemplatePromise) {
    worldCupBracketTemplatePromise = readFile(path.join(process.cwd(), "data", "wc_brackets.json"), "utf8")
      .then((contents) => JSON.parse(contents))
      .catch((error) => {
        console.warn("Failed to load wc_brackets.json:", error.message);
        return null;
      });
  }

  return worldCupBracketTemplatePromise;
}

function buildWorldCupGroupMap(worldCupGroups) {
  const groupMap = new Map();

  for (const group of Array.isArray(worldCupGroups) ? worldCupGroups : []) {
    if (!Array.isArray(group) || group.length === 0) continue;
    const groupName = String(group[0]?.group || "").trim().toUpperCase();
    if (!groupName) continue;
    groupMap.set(groupName, group);
  }

  return groupMap;
}

function buildActualMatchMap(matches) {
  const grouped = new Map();

  for (const match of Array.isArray(matches) ? matches : []) {
    const label = mapRoundLabel(match?.league?.round);
    if (!label) continue;
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(match);
  }

  for (const [label, roundMatches] of grouped.entries()) {
    roundMatches.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    grouped.set(label, roundMatches);
  }

  return grouped;
}

function createPlaceholderTeam(name) {
  return {
    id: null,
    name,
    goals: null,
    winner: false,
    url: "",
  };
}

function resolveBracketReference(reference, nodeMap, groupMap) {
  if (!reference) return createPlaceholderTeam("TBD");

  const ref = String(reference).trim();
  const winnerMatch = ref.match(/^(Winner|Loser)\s+M(\d+)$/i);
  if (winnerMatch) {
    const isWinner = winnerMatch[1].toLowerCase() === "winner";
    const targetNode = nodeMap.get(`M${winnerMatch[2]}`);
    if (!targetNode) {
      return createPlaceholderTeam(ref);
    }

    const source = isWinner ? targetNode.winnerTeam : targetNode.loserTeam;
    return source || createPlaceholderTeam(ref);
  }

  const slotMatch = ref.match(/^([A-H])([1-4])$/i);
  if (slotMatch) {
    const groupName = slotMatch[1].toUpperCase();
    const position = Number(slotMatch[2]) - 1;
    const group = groupMap.get(groupName);
    const team = group?.[position];

    if (!team?.team) {
      return createPlaceholderTeam(ref);
    }

    return {
      id: Number(team.team.id) || null,
      name: team.team.name || ref,
      goals: null,
      winner: false,
      url: `/team?ID=${encodeURIComponent(team.team.id)}`,
    };
  }

  return createPlaceholderTeam(ref);
}

function buildBracketTeam(team, actualTeam, goals, isWinner) {
  const resolvedId = Number(actualTeam?.id ?? team?.id ?? null);
  const name = actualTeam?.name || team?.name || "TBD";

  return {
    id: Number.isFinite(resolvedId) ? resolvedId : null,
    name,
    goals: Number.isFinite(Number(goals)) ? Number(goals) : null,
    winner: Boolean(isWinner),
    url: actualTeam?.url || team?.url || "",
  };
}

function buildWorldCupBracketNode(templateNode, actualMatch, nodeMap, groupMap) {
  const homeRef = templateNode.home_slot || templateNode.home;
  const awayRef = templateNode.away_slot || templateNode.away;
  const resolvedHome = resolveBracketReference(homeRef, nodeMap, groupMap);
  const resolvedAway = resolveBracketReference(awayRef, nodeMap, groupMap);

  const actualHome = actualMatch?.teams?.home || null;
  const actualAway = actualMatch?.teams?.away || null;
  const homeGoals = actualMatch?.goals?.home ?? null;
  const awayGoals = actualMatch?.goals?.away ?? null;
  const status = actualMatch?.fixture?.status?.short || "NS";
  const homeWinner = homeGoals !== null && awayGoals !== null && Number(homeGoals) > Number(awayGoals);
  const awayWinner = homeGoals !== null && awayGoals !== null && Number(awayGoals) > Number(homeGoals);

  return {
    fixtureId: actualMatch?.fixture?.id ?? templateNode.match_id,
    matchUrl: actualMatch?.fixture?.id ? `/match?matchID=${encodeURIComponent(actualMatch.fixture.id)}` : "",
    status,
    date: actualMatch?.fixture?.date || null,
    home: buildBracketTeam(resolvedHome, actualHome, homeGoals, homeWinner),
    away: buildBracketTeam(resolvedAway, actualAway, awayGoals, awayWinner),
    winnerTeam: homeWinner
      ? buildBracketTeam(resolvedHome, actualHome, homeGoals, true)
      : awayWinner
        ? buildBracketTeam(resolvedAway, actualAway, awayGoals, true)
        : null,
    loserTeam: homeWinner
      ? buildBracketTeam(resolvedAway, actualAway, awayGoals, false)
      : awayWinner
        ? buildBracketTeam(resolvedHome, actualHome, homeGoals, false)
        : null,
  };
}

async function buildWorldCupBracket(worldCupGroups, matches, selectedSeason) {
  const template = await loadWorldCupBracketTemplate();
  if (!template || Number(template.season) !== Number(selectedSeason)) {
    return [];
  }

  const knockout = template.knockout || {};
  const groupMap = buildWorldCupGroupMap(worldCupGroups);
  const actualMatchesByRound = buildActualMatchMap(matches);
  const nodeMap = new Map();
  const roundDefinitions = [
    ["round_of_32", "round_of_32"],
    ["round_of_16", "round_of_16"],
    ["quarter_finals", "quarter_finals"],
    ["semi_finals", "semi_finals"],
    ["final", "final"],
    ["third_place", "third_place"],
  ];

  const rounds = [];

  for (let roundIndex = 0; roundIndex < roundDefinitions.length; roundIndex += 1) {
    const [templateKey, actualRoundLabelKey] = roundDefinitions[roundIndex];
    const roundTemplate = knockout[templateKey];
    if (!roundTemplate || (Array.isArray(roundTemplate) && roundTemplate.length === 0)) {
      continue;
    }

    const roundName = getWorldCupRoundLabel(templateKey);
    const templateMatches = Array.isArray(roundTemplate) ? roundTemplate : [roundTemplate];
    const actualMatches = actualMatchesByRound.get(getWorldCupRoundLabel(actualRoundLabelKey)) || [];

    const matchesForRound = templateMatches.map((templateNode, index) => {
      const actualMatch = actualMatches[index] || null;
      const bracketNode = buildWorldCupBracketNode(templateNode, actualMatch, nodeMap, groupMap);
      nodeMap.set(templateNode.match_id, bracketNode);
      return bracketNode;
    });

    const step = Math.pow(2, roundIndex);
    const columnTopOffset = roundIndex === 0
      ? 0
      : Math.round(((step - 1) * BRACKET_UNIT_PX) / 2);
    const matchGap = roundIndex === 0
      ? 16
      : Math.max(16, step * BRACKET_UNIT_PX - BRACKET_MATCH_CARD_HEIGHT_PX);

    rounds.push({
      name: roundName,
      roundIndex,
      columnTopOffset,
      matchGap,
      matches: matchesForRound,
    });
  }

  return rounds;
}

function scoreForTeam(match, side) {
  const value = match?.goals?.[side];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function winnerSide(match) {
  const status = match?.fixture?.status?.short;
  if (!FINISHED_STATUSES.has(status)) {
    return null;
  }

  const home = scoreForTeam(match, "home");
  const away = scoreForTeam(match, "away");
  if (home === null || away === null || home === away) {
    return null;
  }

  return home > away ? "home" : "away";
}

function sortRounds(a, b) {
  const ai = ROUND_ORDER.indexOf(a);
  const bi = ROUND_ORDER.indexOf(b);
  return ai - bi;
}

function toBracketMatch(match) {
  const winner = winnerSide(match);
  const homeGoals = scoreForTeam(match, "home");
  const awayGoals = scoreForTeam(match, "away");

  return {
    fixtureId: match?.fixture?.id,
    status: match?.fixture?.status?.short || "NS",
    date: match?.fixture?.date || null,
    home: {
      id: match?.teams?.home?.id ?? null,
      name: match?.teams?.home?.name || "TBD",
      goals: homeGoals,
      winner: winner === "home",
    },
    away: {
      id: match?.teams?.away?.id ?? null,
      name: match?.teams?.away?.name || "TBD",
      goals: awayGoals,
      winner: winner === "away",
    },
  };
}

function teamIdsOfMatch(match) {
  return [Number(match?.home?.id), Number(match?.away?.id)].filter((id) => Number.isFinite(id));
}

function reorderRoundByNextRound(prevRoundMatches, nextRoundMatches) {
  if (!Array.isArray(prevRoundMatches) || !Array.isArray(nextRoundMatches)) {
    return prevRoundMatches;
  }

  const prevByIndex = prevRoundMatches.map((match, index) => ({ match, index }));
  const teamToPrevIndices = new Map();

  for (const { match, index } of prevByIndex) {
    for (const teamId of teamIdsOfMatch(match)) {
      if (!teamToPrevIndices.has(teamId)) {
        teamToPrevIndices.set(teamId, []);
      }
      teamToPrevIndices.get(teamId).push(index);
    }
  }

  const used = new Set();
  const reordered = [];

  for (const nextMatch of nextRoundMatches) {
    const homeCandidates = teamToPrevIndices.get(Number(nextMatch?.home?.id)) || [];
    const awayCandidates = teamToPrevIndices.get(Number(nextMatch?.away?.id)) || [];

    const firstIdx = homeCandidates.find((idx) => !used.has(idx));
    const secondIdx = awayCandidates.find((idx) => !used.has(idx) && idx !== firstIdx);

    if (firstIdx !== undefined) {
      used.add(firstIdx);
      reordered.push(prevRoundMatches[firstIdx]);
    }

    if (secondIdx !== undefined) {
      used.add(secondIdx);
      reordered.push(prevRoundMatches[secondIdx]);
    }
  }

  for (let i = 0; i < prevRoundMatches.length; i += 1) {
    if (!used.has(i)) {
      reordered.push(prevRoundMatches[i]);
    }
  }

  return reordered;
}

function buildKnockoutRounds(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  const grouped = new Map();

  for (const match of matches) {
    const roundName = mapRoundLabel(match?.league?.round);
    if (!roundName) continue;

    if (!grouped.has(roundName)) {
      grouped.set(roundName, []);
    }
    grouped.get(roundName).push(toBracketMatch(match));
  }

  if (grouped.size === 0) {
    return [];
  }

  const rounds = [...grouped.keys()].sort(sortRounds);
  const roundsWithMatches = rounds.map((name) => {
    const roundMatches = grouped.get(name);
    roundMatches.sort((a, b) => {
      const at = a.date ? new Date(a.date).getTime() : 0;
      const bt = b.date ? new Date(b.date).getTime() : 0;
      return at - bt;
    });

    return {
      name,
      matches: roundMatches,
    };
  });

  // Align each round to the next one so qualifying paths stay adjacent.
  for (let i = roundsWithMatches.length - 2; i >= 0; i -= 1) {
    const current = roundsWithMatches[i];
    const next = roundsWithMatches[i + 1];
    if (!current || !next || next.name === "Third place") {
      continue;
    }

    current.matches = reorderRoundByNextRound(current.matches, next.matches);
  }

  return roundsWithMatches.map((round, roundIndex) => {
    const name = round.name;
    const roundMatches = round.matches;

    const step = Math.pow(2, roundIndex);
    const columnTopOffset = roundIndex === 0
      ? 0
      : Math.round(((step - 1) * BRACKET_UNIT_PX) / 2);
    const matchGap = roundIndex === 0
      ? 16
      : Math.max(16, step * BRACKET_UNIT_PX - BRACKET_MATCH_CARD_HEIGHT_PX);

    return {
      name,
      roundIndex,
      columnTopOffset,
      matchGap,
      matches: roundMatches,
    };
  });
}

export function getLeagueById(leagueID) {
  return allDBLeagues.find((league) => Number(league.id) === Number(leagueID)) || null;
}

export function groupByLeague(matches) {
  const grouped = {};
  for (const match of matches) {
    const leagueId = match.league.id;
    if (!grouped[leagueId]) {
      grouped[leagueId] = {
        league: match.league, // { id, name, logo }
        matches: [],
      };
      grouped[leagueId].league.name = allDBLeagues.find(
        (lg) => lg.id == leagueId,
      ).name;
    }
    grouped[leagueId].matches.push(match);
  }

  return Object.values(grouped).sort((a, b) => {
    const leagueA = allDBLeagues.find((lg) => lg.id == a.league.id);
    const leagueB = allDBLeagues.find((lg) => lg.id == b.league.id);
    return (
      (leagueA?.sort_order ?? Infinity) - (leagueB?.sort_order ?? Infinity)
    );
  });
}

export function getLeagueStandings(registry, league) {
  const leagueType = allDBLeagues.find((lg) => lg.id == league)?.type;
  const includeGroupStageOnly = leagueType === "cup" || leagueType === "nt";
  let thisStandings = extractTeams(
    registry,
    null,
    [league],
    null,
    includeGroupStageOnly,
  );

  thisStandings.sort((a, b) =>
    a.total.points < b.total.points
      ? 1
      : b.total.points < a.total.points
        ? -1
        : 0,
  );

  thisStandings.forEach((team) => {
    team.total.xG = Math.round(team.total.xG);
    team.total.xGA = Math.round(team.total.xGA);
  });

  return thisStandings;
}

export async function getLeaguePageData(registry, selectedLeague, selectedSeason, defaultSeason) {
  const leagueInfo = getLeagueById(selectedLeague);
  const players = getPlayerList(registry, 10, null, [selectedLeague]);
  const { matches, rounds, currentRound } = await lastMatchesFromLeague(registry, selectedLeague);
  const standingsFromRegistry = getLeagueStandings(registry, selectedLeague);
  const savedStandings = selectedSeason === defaultSeason
    ? await getLeagueStandingsFromDb(selectedLeague, selectedSeason)
    : [];
  const standings = resolveLeagueStandingsForPage(standingsFromRegistry, savedStandings);
  const worldCupGroups = selectedLeague === 1
    ? mergeWorldCupGroupStandings(
      await getLeagueStandingsFromDb(1, selectedSeason),
      registry,
    )
    : [];
  const knockoutRounds = selectedLeague === 1
    ? await buildWorldCupBracket(worldCupGroups, matches, selectedSeason)
    : buildKnockoutRounds(matches);
  const leagueNation = leagueInfo
    ? getTeamById(leagueInfo.nation)
    : null;

  return {
    leagueInfo,
    leagueNation,
    players,
    matches,
    standings,
    worldCupGroups,
    knockoutRounds,
    rounds,
    currentRound,
  };
}