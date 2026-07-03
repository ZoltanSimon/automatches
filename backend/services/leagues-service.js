import { allDBLeagues } from "../index.js";
import { extractTeams } from "./teams-service.js";
import { getLeagueStandingsFromDb } from "../data-access.js";
import { mergeWorldCupGroupStandings, resolveLeagueStandingsForPage } from "../backend-helper.js";
import { getPlayerList } from "./players-service.js";
import { lastMatchesFromLeague } from "./matches-service.js";
import { getTeamById } from "./teams-service.js";
import { readFile } from "fs/promises";
import path from "path";

// Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League
export const defaultLeagues = [39, 140, 135, 78, 61, 88, 94];

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

const ROUND_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Final",
  "Third place",
];

const WORLD_CUP_LEAGUE_ID = 1;
const DEFAULT_PLAYER_LIST_LIMIT = 10;

let worldCupBracketTemplatePromise = null;

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** Coerce a value to a finite number, or null if it isn't one. */
function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Extract a finite fixture id from a match object, or null. */
function fixtureIdOf(match) {
  return toFiniteNumber(match?.fixture?.id);
}

function normalizeRound(roundName) {
  return String(roundName || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// API-football represents knockout rounds as fraction-style names
// (e.g. "1/16-finals" for Round of 32, "1/8-finals" for Round of 16,
// "1/4-finals" for Quarter-finals, "1/2-finals" for Semi-finals) once
// non-alphanumeric characters are stripped by normalizeRound(). We match
// on both the fraction form ("1 16", "1 8", ...) and the plain English form.
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

async function loadWorldCupBracketTemplate() {
  if (!worldCupBracketTemplatePromise) {
    worldCupBracketTemplatePromise = readFile(path.join(process.cwd(), "backend", "wc_brackets.json"), "utf8")
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

function buildActualMatchByFixtureID(matches) {
  const map = new Map();

  for (const match of Array.isArray(matches) ? matches : []) {
    const fixtureId = fixtureIdOf(match);
    if (fixtureId !== null) {
      map.set(fixtureId, match);
    }
  }

  return map;
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

  if (typeof reference === "object" && reference !== null) {
    if (reference.id || reference.name) {
      return {
        id: toFiniteNumber(reference.id),
        name: reference.name || "TBD",
        goals: null,
        winner: false,
        url: reference.id ? `/team?ID=${encodeURIComponent(reference.id)}` : "",
      };
    }
  }

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
      id: toFiniteNumber(team.team.id),
      name: team.team.name || ref,
      goals: null,
      winner: false,
      url: `/team?ID=${encodeURIComponent(team.team.id)}`,
    };
  }

  return createPlaceholderTeam(ref);
}

function buildBracketTeam(team, actualTeam, goals, isWinner) {
  const resolvedId = toFiniteNumber(actualTeam?.id ?? team?.id ?? null);
  const name = actualTeam?.name || team?.name || "TBD";

  return {
    id: resolvedId,
    name,
    goals: toFiniteNumber(goals),
    winner: Boolean(isWinner),
    url: actualTeam?.url || team?.url || "",
  };
}

function normalizeStageTeamReferences(templateNode) {
  const homeRef =
    templateNode.home_team ||
    templateNode.home_slot ||
    templateNode.home ||
    (templateNode.home_team_from_match ? `Winner M${templateNode.home_team_from_match}` : null) ||
    (templateNode.loser_team_from_match ? `Loser M${templateNode.loser_team_from_match}` : null);

  const awayRef =
    templateNode.away_team ||
    templateNode.away_slot ||
    templateNode.away ||
    (templateNode.away_team_from_match ? `Winner M${templateNode.away_team_from_match}` : null) ||
    (templateNode.loser_team_from_match_2 ? `Loser M${templateNode.loser_team_from_match_2}` : null);

  return { homeRef, awayRef };
}

function mapTemplateByMatchId(stageMatches) {
  const byId = new Map();

  for (const item of Array.isArray(stageMatches) ? stageMatches : []) {
    const id = toFiniteNumber(item?.match_id);
    if (id !== null) {
      byId.set(id, item);
    }
  }

  return byId;
}

function uniqueOrdered(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const n = toFiniteNumber(value);
    if (n === null || seen.has(n)) continue;
    seen.add(n);
    result.push(n);
  }

  return result;
}

function parentMatchIdsFromTemplate(matchTemplate) {
  const ids = [];

  if (matchTemplate?.home_team_from_match) ids.push(matchTemplate.home_team_from_match);
  if (matchTemplate?.away_team_from_match) ids.push(matchTemplate.away_team_from_match);
  if (matchTemplate?.loser_team_from_match) ids.push(matchTemplate.loser_team_from_match);
  if (matchTemplate?.loser_team_from_match_2) ids.push(matchTemplate.loser_team_from_match_2);

  return uniqueOrdered(ids);
}

function containsTeam(match, teamId) {
  const id = toFiniteNumber(teamId);
  if (id === null) return false;

  const homeId = toFiniteNumber(match?.teams?.home?.id);
  const awayId = toFiniteNumber(match?.teams?.away?.id);
  return homeId === id || awayId === id;
}

function teamPairKey(teamA, teamB) {
  const a = toFiniteNumber(teamA);
  const b = toFiniteNumber(teamB);
  if (a === null || b === null) {
    return null;
  }
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function buildTeamPairToRo16TemplateMap(ro16Template) {
  const map = new Map();

  for (const node of Array.isArray(ro16Template) ? ro16Template : []) {
    const id = toFiniteNumber(node?.match_id);
    const homeParent = toFiniteNumber(node?.home_team_from_match);
    const awayParent = toFiniteNumber(node?.away_team_from_match);
    if (id === null || homeParent === null || awayParent === null) {
      continue;
    }

    const key = teamPairKey(homeParent, awayParent);
    if (!key || map.has(key)) {
      continue;
    }

    map.set(key, id);
  }

  return map;
}

function deriveRoundOf16OrderFromActual(quarterOrder, quarterByIdTemplate, ro16Template) {
  const pairToRo16 = buildTeamPairToRo16TemplateMap(ro16Template);
  const ordered = [];

  for (const qfId of Array.isArray(quarterOrder) ? quarterOrder : []) {
    const quarterNode = quarterByIdTemplate.get(Number(qfId));
    const homeFrom = toFiniteNumber(quarterNode?.home_team_from_match);
    const awayFrom = toFiniteNumber(quarterNode?.away_team_from_match);
    const key = teamPairKey(homeFrom, awayFrom);
    const ro16Id = key ? pairToRo16.get(key) : null;

    if (toFiniteNumber(ro16Id) !== null) {
      ordered.push(toFiniteNumber(ro16Id));
      continue;
    }

    if (homeFrom !== null) ordered.push(homeFrom);
    if (awayFrom !== null) ordered.push(awayFrom);
  }

  if (ordered.length > 0) {
    return uniqueOrdered(ordered);
  }

  return uniqueOrdered((Array.isArray(ro16Template) ? ro16Template : []).map((m) => m?.match_id));
}

function deriveRoundOf32OrderFromActual(ro16Order, ro16ById, ro16TemplateById, ro32ActualMatches) {
  const ordered = [];
  const usedFixtureIDs = new Set();

  const pickByTeam = (teamId) => {
    for (const match of ro32ActualMatches) {
      const fixtureId = fixtureIdOf(match);
      if (fixtureId === null || usedFixtureIDs.has(fixtureId)) continue;
      if (containsTeam(match, teamId)) {
        usedFixtureIDs.add(fixtureId);
        return fixtureId;
      }
    }
    return null;
  };

  for (const ro16Id of ro16Order) {
    const ro16Actual = ro16ById.get(Number(ro16Id));
    const ro16Template = ro16TemplateById.get(Number(ro16Id));

    const picks = [];
    if (ro16Actual) {
      picks.push(pickByTeam(ro16Actual?.teams?.home?.id));
      picks.push(pickByTeam(ro16Actual?.teams?.away?.id));
    }

    for (const pick of picks) {
      if (toFiniteNumber(pick) !== null) {
        ordered.push(toFiniteNumber(pick));
      }
    }

    if ((!picks[0] || !picks[1]) && ro16Template) {
      const fallbackParents = parentMatchIdsFromTemplate(ro16Template);
      for (const fallbackId of fallbackParents) {
        if (!ordered.includes(fallbackId)) {
          ordered.push(fallbackId);
        }
      }
    }
  }

  for (const match of ro32ActualMatches) {
    const fixtureId = fixtureIdOf(match);
    if (fixtureId === null) continue;
    if (!ordered.includes(fixtureId)) {
      ordered.push(fixtureId);
    }
  }

  return uniqueOrdered(ordered);
}

function pickActualMatchForTemplateNode(actualMatches, usedFixtureIDs, resolvedHome, resolvedAway) {
  const available = actualMatches.filter((match) => {
    const fixtureId = fixtureIdOf(match);
    return fixtureId === null || !usedFixtureIDs.has(fixtureId);
  });
  if (available.length === 0) {
    return null;
  }

  const homeID = toFiniteNumber(resolvedHome?.id);
  const awayID = toFiniteNumber(resolvedAway?.id);

  let selected = null;

  if (homeID !== null && awayID !== null) {
    selected = available.find((match) => {
      const h = toFiniteNumber(match?.teams?.home?.id);
      const a = toFiniteNumber(match?.teams?.away?.id);
      return (h === homeID && a === awayID) || (h === awayID && a === homeID);
    }) || null;
  }

  // Only do single-team fallback if it uniquely identifies one fixture.
  if (!selected && homeID !== null) {
    const byHome = available.filter((match) => {
      const h = toFiniteNumber(match?.teams?.home?.id);
      const a = toFiniteNumber(match?.teams?.away?.id);
      return h === homeID || a === homeID;
    });
    if (byHome.length === 1) {
      selected = byHome[0];
    }
  }

  if (!selected && awayID !== null) {
    const byAway = available.filter((match) => {
      const h = toFiniteNumber(match?.teams?.home?.id);
      const a = toFiniteNumber(match?.teams?.away?.id);
      return h === awayID || a === awayID;
    });
    if (byAway.length === 1) {
      selected = byAway[0];
    }
  }

  // Do not guess by position; unresolved nodes must stay template-driven.
  if (!selected) {
    return null;
  }

  const selectedFixtureId = fixtureIdOf(selected);
  if (selectedFixtureId !== null) {
    usedFixtureIDs.add(selectedFixtureId);
  }

  return selected || null;
}

function buildWorldCupBracketNode(templateNode, actualMatch, nodeMap, groupMap, resolvedRefs = null) {
  const { homeRef, awayRef } = resolvedRefs || normalizeStageTeamReferences(templateNode);
  const resolvedHome = resolveBracketReference(homeRef, nodeMap, groupMap);
  const resolvedAway = resolveBracketReference(awayRef, nodeMap, groupMap);

  const actualHome = actualMatch?.teams?.home || null;
  const actualAway = actualMatch?.teams?.away || null;
  const homeGoals = scoreForTeam(actualMatch, "home");
  const awayGoals = scoreForTeam(actualMatch, "away");
  const status = actualMatch?.fixture?.status?.short || "NS";
  const penaltyHome = scoreForPenalty(actualMatch, "home");
  const penaltyAway = scoreForPenalty(actualMatch, "away");

  let homeWinner = false;
  let awayWinner = false;

  if (homeGoals !== null && awayGoals !== null && homeGoals !== awayGoals) {
    homeWinner = Number(homeGoals) > Number(awayGoals);
    awayWinner = Number(awayGoals) > Number(homeGoals);
  } else if (status === "PEN" && penaltyHome !== null && penaltyAway !== null && penaltyHome !== penaltyAway) {
    homeWinner = Number(penaltyHome) > Number(penaltyAway);
    awayWinner = Number(penaltyAway) > Number(penaltyHome);
  }

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

// ---------------------------------------------------------------------------
// World Cup bracket assembly
// ---------------------------------------------------------------------------

/**
 * Derive the display order of match ids for every knockout round, working
 * backwards from the Final so that sibling matches stay adjacent for
 * bracket rendering.
 */
function computeBracketOrders(knockout) {
  const ro32Template = Array.isArray(knockout.round_of_32) ? knockout.round_of_32 : [];
  const ro16Template = Array.isArray(knockout.round_of_16) ? knockout.round_of_16 : [];
  const quarterTemplate = Array.isArray(knockout.quarter_finals) ? knockout.quarter_finals : [];
  const semiTemplate = Array.isArray(knockout.semi_finals) ? knockout.semi_finals : [];
  const finalTemplate = Array.isArray(knockout.final) ? knockout.final : [];
  const thirdPlaceTemplate = Array.isArray(knockout.third_place_playoff)
    ? knockout.third_place_playoff
    : Array.isArray(knockout.third_place)
      ? knockout.third_place
      : [];

  const templatesById = {
    final: mapTemplateByMatchId(finalTemplate),
    semi: mapTemplateByMatchId(semiTemplate),
    quarter: mapTemplateByMatchId(quarterTemplate),
    ro16: mapTemplateByMatchId(ro16Template),
    ro32: mapTemplateByMatchId(ro32Template),
    thirdPlace: mapTemplateByMatchId(thirdPlaceTemplate),
  };

  const finalOrder = uniqueOrdered(finalTemplate.map((m) => m.match_id));
  const semiOrder = uniqueOrdered(
    finalOrder.flatMap((id) => parentMatchIdsFromTemplate(templatesById.final.get(id))),
  );
  const quarterOrder = uniqueOrdered(
    semiOrder.flatMap((id) => parentMatchIdsFromTemplate(templatesById.semi.get(id))),
  );
  const ro16Order = deriveRoundOf16OrderFromActual(quarterOrder, templatesById.quarter, ro16Template);
  const thirdOrder = uniqueOrdered(thirdPlaceTemplate.map((m) => m.match_id));

  return {
    templates: { ro32Template, ro16Template, quarterTemplate, semiTemplate, finalTemplate, thirdPlaceTemplate },
    templatesById,
    finalOrder,
    semiOrder,
    quarterOrder,
    ro16Order,
    thirdOrder,
  };
}

async function buildWorldCupBracket(worldCupGroups, matches, selectedSeason) {
  const template = await loadWorldCupBracketTemplate();
  if (!template) {
    return [];
  }

  if (template.season && Number(template.season) !== Number(selectedSeason)) {
    return [];
  }

  const knockout = template.stages || template.knockout || {};
  const groupMap = buildWorldCupGroupMap(worldCupGroups);
  const actualMatchesByRound = buildActualMatchMap(matches);
  const actualMatchByFixtureID = buildActualMatchByFixtureID(matches);
  const nodeMap = new Map();

  const orders = computeBracketOrders(knockout);
  const { ro32Template, ro16Template, quarterTemplate, semiTemplate, finalTemplate } = orders.templates;

  if (
    ro32Template.length === 0 &&
    ro16Template.length === 0 &&
    quarterTemplate.length === 0 &&
    semiTemplate.length === 0 &&
    finalTemplate.length === 0
  ) {
    return [];
  }

  const ro16ActualById = new Map(
    (actualMatchesByRound.get("Round of 16") || [])
      .map((m) => [fixtureIdOf(m), m])
      .filter(([id]) => id !== null),
  );
  const ro32ActualMatches = actualMatchesByRound.get("Round of 32") || [];
  const ro32Order = deriveRoundOf32OrderFromActual(
    orders.ro16Order,
    ro16ActualById,
    orders.templatesById.ro16,
    ro32ActualMatches,
  );

  const roundPlan = [
    { name: "Round of 32", ids: ro32Order, byId: orders.templatesById.ro32 },
    { name: "Round of 16", ids: orders.ro16Order, byId: orders.templatesById.ro16 },
    { name: "Quarter-finals", ids: orders.quarterOrder, byId: orders.templatesById.quarter },
    { name: "Semi-finals", ids: orders.semiOrder, byId: orders.templatesById.semi },
    { name: "Final", ids: orders.finalOrder, byId: orders.templatesById.final },
    { name: "Third place", ids: orders.thirdOrder, byId: orders.templatesById.thirdPlace },
  ].filter((entry) => entry.ids.length > 0);

  const rounds = [];
  const debugEnabled = process.env.BRACKET_DEBUG === "1";

  for (let roundIndex = 0; roundIndex < roundPlan.length; roundIndex += 1) {
    const { name, ids, byId } = roundPlan[roundIndex];
    const matchesForRound = [];
    const roundActualMatches = actualMatchesByRound.get(name) || [];
    const usedFixtureIDs = new Set();
    const isDebugRound = debugEnabled && name === "Round of 16";

    for (const id of ids) {
      const templateNode = byId.get(Number(id));
      if (!templateNode) continue;

      const resolvedRefs = normalizeStageTeamReferences(templateNode);
      const resolvedHome = resolveBracketReference(resolvedRefs.homeRef, nodeMap, groupMap);
      const resolvedAway = resolveBracketReference(resolvedRefs.awayRef, nodeMap, groupMap);

      let actualMatch = pickActualMatchForTemplateNode(
        roundActualMatches,
        usedFixtureIDs,
        resolvedHome,
        resolvedAway,
      );

      if (!actualMatch) {
        actualMatch = actualMatchByFixtureID.get(Number(id)) || null;
        const fallbackFixtureId = fixtureIdOf(actualMatch);
        if (fallbackFixtureId !== null) {
          usedFixtureIDs.add(fallbackFixtureId);
        }
      }

      const bracketNode = buildWorldCupBracketNode(templateNode, actualMatch, nodeMap, groupMap, resolvedRefs);

      nodeMap.set(`M${Number(id)}`, bracketNode);
      nodeMap.set(String(Number(id)), bracketNode);
      matchesForRound.push(bracketNode);
    }

    if (matchesForRound.length === 0) continue;

    rounds.push({
      name,
      roundIndex,
      matches: matchesForRound,
    });
  }

  return rounds;
}

// ---------------------------------------------------------------------------
// Regular (non-World-Cup) knockout bracket assembly
// ---------------------------------------------------------------------------

function scoreForTeam(match, side) {
  const direct = toFiniteNumber(match?.goals?.[side]);
  if (direct !== null) {
    return direct;
  }

  return toFiniteNumber(match?.score?.fulltime?.[side]);
}

function scoreForPenalty(match, side) {
  return toFiniteNumber(match?.score?.penalty?.[side]);
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
  return [toFiniteNumber(match?.home?.id), toFiniteNumber(match?.away?.id)].filter((id) => id !== null);
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
    const homeCandidates = teamToPrevIndices.get(toFiniteNumber(nextMatch?.home?.id)) || [];
    const awayCandidates = teamToPrevIndices.get(toFiniteNumber(nextMatch?.away?.id)) || [];

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
    return {
      name: round.name,
      roundIndex,
      matches: round.matches,
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
  const players = getPlayerList(registry, DEFAULT_PLAYER_LIST_LIMIT, null, [selectedLeague]);
  const { matches, rounds, currentRound } = await lastMatchesFromLeague(registry, selectedLeague);
  const standingsFromRegistry = getLeagueStandings(registry, selectedLeague);
  const isWorldCup = selectedLeague === WORLD_CUP_LEAGUE_ID;

  const savedStandings = selectedSeason === defaultSeason
    ? await getLeagueStandingsFromDb(selectedLeague, selectedSeason)
    : [];
  const standings = resolveLeagueStandingsForPage(standingsFromRegistry, savedStandings);

  const worldCupGroups = isWorldCup
    ? mergeWorldCupGroupStandings(
      await getLeagueStandingsFromDb(WORLD_CUP_LEAGUE_ID, selectedSeason),
      registry,
    )
    : [];

  const knockoutRounds = isWorldCup ? await buildWorldCupBracket(worldCupGroups, matches, selectedSeason) : [];
  //const knockoutRounds = isWorldCup ? await buildWorldCupBracket(worldCupGroups, matches, selectedSeason) : buildKnockoutRounds(matches);

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