import { buildMatchRegistry, getLoadedRegistry, upsertRegistryMatchIfLoaded } from "./registry-service.js";
import { saveMatchesToServer, buildTeamList, getMatchFromServer } from "./json-reader.js";
import { getAllCompetitionTeam, getTeamById } from "./teams-service.js";
import { memoizeRegistryStat } from "./registry-stats.js";
import { applyEloForFinishedMatches } from "./elo-service.js";
import { allDBLeagues } from "../lib/catalog.js";
import { getAllMatchesFromDb, getMatchDetailsById, getMatchIdsMissingDetails, getMatchEloByMatchId, getMatchEloRowsByIds, getTeamEloForTeam, setMatchExpectedGoals } from "../data-access.js";
import { eloScopeFromTeam, formatEloDelta, formatSignedElo } from "../lib/elo.js";
import { wait } from "../lib/backend-helper.js";
import { getResults, getFixturesByDate, hasApiErrors } from "../api/webapi-handler.js";
import { applyExpectedGoalsToMatch, parseExpectedGoalsValue, unwrapMatchPayload } from "../lib/match-details-mapper.js";
import { calculateXPts } from "./poisson-model.js";

const FINISHED_MATCH_STATUSES = new Set(["FT", "AET", "PEN"]);
const UPDATE_MATCHES_DELAY_MS = 3000;

export function parseMatchIds(rawIds) {
  const source = rawIds === undefined || rawIds === null
    ? []
    : Array.isArray(rawIds)
      ? rawIds
      : String(rawIds).split(/[\s,;]+/);

  return [...new Set(
    source
      .map((id) => String(id).trim())
      .filter(Boolean),
  )];
}

export async function setManualMatchXg(rawMatchId, rawHomeXg, rawAwayXg) {
  const matchId = Number(rawMatchId);
  const homeXg = parseExpectedGoalsValue(rawHomeXg);
  const awayXg = parseExpectedGoalsValue(rawAwayXg);

  if (!Number.isFinite(matchId) || matchId <= 0) {
    throw new Error("matchID is required");
  }

  if (!Number.isFinite(homeXg) || !Number.isFinite(awayXg)) {
    throw new Error("homeXg and awayXg must be numbers between 0 and 20");
  }

  const saved = await setMatchExpectedGoals(matchId, homeXg, awayXg);
  const registry = getLoadedRegistry();
  const existingMatch = registry?.matchByID?.get(matchId)
    ?? registry?.matchByID?.get(String(matchId))
    ?? null;
  const filePayload = await getMatchFromServer(matchId);
  const fileMatch = unwrapMatchPayload(filePayload);
  const detailsMatch = await getMatchDetailsById(matchId);
  const sourceMatch = existingMatch || fileMatch || detailsMatch;

  if (sourceMatch) {
    const patched = applyExpectedGoalsToMatch(sourceMatch, homeXg, awayXg);
    upsertRegistryMatchIfLoaded(patched);
  }

  return saved;
}

export async function grabMatchesByIds(rawIds, { overwrite = true } = {}) {
  const ids = parseMatchIds(rawIds);
  const result = await saveFixtureIds(ids, {
    overwrite,
    includeMatches: true,
  });

  return {
    ...result,
    match: result.matches,
    db: {
      summary: { importedMatches: 0, skippedFinishedMatches: 0 },
      details: [],
    },
  };
}

export async function refetchLeagueRound({ leagueID, season, round } = {}) {
  const roundName = String(round ?? "").trim();
  const numericLeagueID = Number(leagueID);
  const numericSeason = Number(season);

  if (!roundName || !Number.isFinite(numericLeagueID) || numericLeagueID <= 0) {
    throw new Error("leagueID and round are required");
  }

  if (!Number.isFinite(numericSeason) || numericSeason <= 0) {
    throw new Error("season is required");
  }

  const { data, call } = await getResults(numericLeagueID, roundName, numericSeason);
  if (hasApiErrors(data)) {
    throw new Error(`API error fetching round: ${JSON.stringify(data.errors)}`);
  }

  const fixtureIds = (Array.isArray(data?.response) ? data.response : [])
    .map((match) => match?.fixture?.id)
    .filter((id) => id != null);

  return saveFixtureIds(fixtureIds, {
    leagueID: numericLeagueID,
    season: numericSeason,
    round: roundName,
    calls: call ? [call] : [],
  });
}

export async function refetchMatchesOnDay({ date } = {}) {
  const day = String(date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("date is required (YYYY-MM-DD)");
  }

  const { data, call } = await getFixturesByDate(day);
  if (hasApiErrors(data)) {
    throw new Error(`API error fetching date: ${JSON.stringify(data.errors)}`);
  }

  const trackedLeagueIds = new Set(
    (allDBLeagues || [])
      .map((league) => Number(league.id))
      .filter((leagueID) => Number.isFinite(leagueID)),
  );

  const fixtureIds = (Array.isArray(data?.response) ? data.response : [])
    .filter((match) => trackedLeagueIds.has(Number(match?.league?.id)))
    .map((match) => match?.fixture?.id)
    .filter((id) => id != null);

  return saveFixtureIds(fixtureIds, { date: day, calls: call ? [call] : [] });
}

async function saveFixtureIds(fixtureIds, extra = {}) {
  const {
    calls: existingCalls = [],
    overwrite = true,
    includeMatches = false,
    logPrefix,
    ...rest
  } = extra;
  const calls = [...existingCalls];
  const ids = (Array.isArray(fixtureIds) ? fixtureIds : [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return {
      success: false,
      requested: 0,
      savedCount: 0,
      saved: [],
      failed: [],
      matches: [],
      calls,
      ...rest,
    };
  }

  const saved = [];
  const failed = [];
  const matches = [];
  let limits = null;

  for (let i = 0; i < ids.length; i += 20) {
    const batchIds = ids.slice(i, i + 20);
    const remaining = ids.length - (i + batchIds.length);

    try {
      const result = await saveMatchesToServer(batchIds, { overwrite, applyElo: false });
      saved.push(...(result.saved || []));
      failed.push(...(result.failed || []));
      limits = result.limits ?? limits;
      if (result.call) {
        calls.push(result.call);
      }

      const savedIds = new Set((result.saved || []).map(String));
      for (const match of result.matches || []) {
        const matchId = String(match?.fixture?.id ?? "");
        if (!savedIds.has(matchId)) {
          continue;
        }

        upsertRegistryMatchIfLoaded(match);
        if (includeMatches) {
          matches.push(match);
        }
      }

      const prefix = logPrefix || "[saveFixtureIds]";
      console.log(
        `${prefix} Saved ${result.savedCount}/${batchIds.length} matches in batch [${batchIds.join(",")}] (${remaining} left)`,
      );
      if (result.failed.length > 0) {
        console.warn(`${prefix} Failed matches in batch:`, result.failed);
      }
    } catch (err) {
      console.error(`${logPrefix || "[saveFixtureIds]"} Error saving match batch [${batchIds.join(",")}]`, err);
      failed.push(...batchIds.map((fixtureID) => ({ fixtureID, error: err.message })));
    }

    if (remaining > 0) {
      await wait(UPDATE_MATCHES_DELAY_MS);
    }
  }

  if (saved.length > 0) {
    try {
      await applyEloForFinishedMatches(saved);
    } catch (error) {
      console.error(`${logPrefix || "[saveFixtureIds]"} Failed to apply Elo after save:`, error);
    }
  }

  if (logPrefix) {
    console.log(`${logPrefix} Finished downloading ${ids.length} matches.`);
  }

  return {
    success: failed.length === 0,
    requested: ids.length,
    savedCount: saved.length,
    saved,
    failed,
    matches,
    calls,
    limits,
    ...rest,
  };
}

export async function findMissingFinishedMatches(logPrefix) {
  const [data, missingIds] = await Promise.all([
    getAllMatchesFromDb(),
    getMatchIdsMissingDetails(),
  ]);
  const missingIdSet = new Set(missingIds.map((id) => Number(id)));
  const missingMatches = data.filter((element) => {
    const dbStatus = String(element.fixtureStatus || "").trim().toUpperCase();
    return FINISHED_MATCH_STATUSES.has(dbStatus) && missingIdSet.has(Number(element.fixtureId));
  });

  console.log(`${logPrefix} Total missing matches: ${missingMatches.length}`);
  return missingMatches;
}

export async function hydrateMissingMatches(missingMatches, logPrefix) {
  const batchIds = [...new Set(
    (Array.isArray(missingMatches) ? missingMatches : [])
      .map((match) => String(match.fixtureId ?? "").trim())
      .filter(Boolean),
  )];

  const result = await saveFixtureIds(batchIds, {
    overwrite: false,
    logPrefix,
  });

  return {
    requested: missingMatches.length,
    savedCount: result.savedCount,
    failedCount: result.failed.length,
    saved: result.saved,
    failed: result.failed,
  };
}

export async function matchesOnDay(registry, dateToCheck) {
  const checkDate = new Date(dateToCheck) || new Date();
  const matchesByDay = memoizeRegistryStat(registry, "matches:by-day", () => {
    const byDay = new Map();
    for (const match of registry.matches) {
      const day = new Date(match.fixture.date).toDateString();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(match);
    }
    return byDay;
  });
  return [...(matchesByDay.get(checkDate.toDateString()) ?? [])];
}

export async function matchesInRound(roundNr, leagueID) {
  const roundName = (leagueID == 2) ? `League Stage - ${roundNr}` : `Group Stage - ${roundNr}`;
  const registry = await buildMatchRegistry([Number(leagueID)]);
  return registry.matches.filter((match) => match.league.id == leagueID && match.league.round == roundName);
}

export async function lastMatchesFromLeague(registry, leagueID) {

  const leagueMatches = registry.matches
    .filter(({ fixture, league }) => 
      league.id === leagueID
    )
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  const rounds = [...new Set(leagueMatches.map(({ league }) => league.round))].reverse();

  const now = new Date();
  let currentRound = null;
  let minDiff = Infinity;
  for (const round of rounds) {
    const roundMatches = leagueMatches.filter((item) => item.league.round === round);
    for (const item of roundMatches) {
      const diff = Math.abs(new Date(item.fixture.date) - now);
      if (diff < minDiff) {
        minDiff = diff;
        currentRound = round;
      }
    }
  }

  return { matches: leagueMatches, rounds, currentRound };
}

export async function allTeamMatches(registry, homeTeamID, awayTeamID = null, checkStatus = true) {
  const matchesForTeam = registry.matches.filter(({ fixture, teams }) => {
    const { home, away } = teams;
    const teamMatch = awayTeamID
      ? home.id === homeTeamID || away.id === homeTeamID || home.id === awayTeamID || away.id === awayTeamID
      : home.id === homeTeamID || away.id === homeTeamID;

    if (!teamMatch) return false;
    if (checkStatus) return ["FT", "AET", "PEN"].includes(fixture.status.short);
    return true;
  });

  return matchesForTeam;
}

export function getMatchById(registry, matchID) {
  const matchKey = Number.isNaN(Number(matchID)) ? matchID : Number(matchID);
  return registry.matchByID.get(matchKey) ?? null;
}

function teamMatchEloDelta(row, teamId, match) {
  if (!row) {
    return null;
  }

  const isHome = Number(match?.homeTeam?.id) === Number(teamId);
  const isAway = Number(match?.awayTeam?.id) === Number(teamId);
  if (!isHome && !isAway) {
    return null;
  }

  const before = Number(isHome ? row.home_elo_before : row.away_elo_before);
  const after = Number(isHome ? row.home_elo_after : row.away_elo_after);
  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    return null;
  }

  return after - before;
}

function opponentEloBefore(row, teamId, match) {
  if (!row) {
    return null;
  }

  const isHome = Number(match?.homeTeam?.id) === Number(teamId);
  const isAway = Number(match?.awayTeam?.id) === Number(teamId);
  if (!isHome && !isAway) {
    return null;
  }

  const elo = Number(isHome ? row.away_elo_before : row.home_elo_before);
  return Number.isFinite(elo) ? elo : null;
}

function summarizeOpponentElo(matches, teamId, eloByMatchId) {
  const ratings = matches
    .map((match) => opponentEloBefore(eloByMatchId.get(Number(match.id)), teamId, match))
    .filter((elo) => Number.isFinite(elo));
  if (!ratings.length) {
    return { total: null, perGame: null };
  }

  const total = ratings.reduce((sum, elo) => sum + elo, 0);
  return {
    total: Math.round(total),
    perGame: Number((total / ratings.length).toFixed(1)),
  };
}

function summarizeEloChange(matches, teamId, eloByMatchId) {
  const deltas = matches
    .map((match) => teamMatchEloDelta(eloByMatchId.get(Number(match.id)), teamId, match))
    .filter((delta) => Number.isFinite(delta));
  if (!deltas.length) {
    return { total: null, perGame: null };
  }

  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  return {
    total: formatSignedElo(total),
    perGame: formatSignedElo(total / deltas.length, 2),
  };
}

export async function getMatchPageData(registry, currentMatch) {
  const { home, away } = currentMatch.teams;
  const registryTeams = [home.id, away.id]
    .map((teamID) => getAllCompetitionTeam(registry, teamID))
    .filter(Boolean);
  const teams = registryTeams.length > 0
    ? registryTeams
    : buildTeamList([currentMatch]).filter((team) => team.id === home.id || team.id === away.id);
  const matchesByTeam = new Map(teams.map((team) => [
    team.id,
    [...team.matches].sort((a, b) => new Date(b.date) - new Date(a.date)),
  ]));
  const eloByMatchId = await getMatchEloRowsByIds(
    [...matchesByTeam.values()].flatMap((matches) => matches.map((match) => match.id)),
  );
  const teamList = teams
    .sort((a, b) => (a.id === home.id ? -1 : b.id === home.id ? 1 : 0))
    .map((team) => {
      const sortedMatches = matchesByTeam.get(team.id) || [];
      const seasonElo = summarizeEloChange(sortedMatches, team.id, eloByMatchId);
      const recentMatches = sortedMatches.slice(0, 5);
      const recentElo = summarizeEloChange(recentMatches, team.id, eloByMatchId);
      const seasonOpponentElo = summarizeOpponentElo(sortedMatches, team.id, eloByMatchId);
      const recentOpponentElo = summarizeOpponentElo(recentMatches, team.id, eloByMatchId);
      return {
        ...team,
        matches: sortedMatches.slice(0, 5).map((match) => {
          const delta = teamMatchEloDelta(eloByMatchId.get(Number(match.id)), team.id, match);
          return {
            ...match,
            eloChange: Number.isFinite(delta) ? formatSignedElo(delta) : null,
          };
        }),
        eloChange: {
          total: seasonElo.total,
          perGame: seasonElo.perGame,
          last5: recentElo.total,
          last5PerGame: recentElo.perGame,
        },
        opponentElo: {
          total: seasonOpponentElo.total,
          perGame: seasonOpponentElo.perGame,
          last5: recentOpponentElo.total,
          last5PerGame: recentOpponentElo.perGame,
        },
      };
    });

  const matchStatistics = buildMatchStatistics(currentMatch);
  const matchLeagueName = typeof currentMatch?.league?.name === "string"
    ? currentMatch.league.name.trim()
    : "";
  const dbLeagueName = currentMatch?.league?.id
    ? allDBLeagues.find((league) => league.id == currentMatch.league.id)?.name || ""
    : "";
  const leagueName = matchLeagueName || dbLeagueName || "Unknown League";
  const matchEloRow = await getMatchEloByMatchId(currentMatch?.fixture?.id ?? currentMatch?.id);
  const eloScope = matchEloRow?.scope === "nt" || matchEloRow?.scope === "club"
    ? matchEloRow.scope
    : eloScopeFromTeam(getTeamById(currentMatch?.teams?.home?.id));
  const [homeRatings, awayRatings] = await Promise.all([
    getTeamEloForTeam(currentMatch?.teams?.home?.id),
    getTeamEloForTeam(currentMatch?.teams?.away?.id),
  ]);
  const currentElo = (ratings) => {
    const elo = Number(ratings?.[eloScope]?.elo);
    return Number.isFinite(elo) ? Math.round(elo) : null;
  };
  const matchElo = {
    home: currentElo(homeRatings),
    away: currentElo(awayRatings),
    change: matchEloRow
      ? {
          home: formatEloDelta(matchEloRow.home_elo_after, matchEloRow.home_elo_before),
          away: formatEloDelta(matchEloRow.away_elo_after, matchEloRow.away_elo_before),
        }
      : null,
  };

  return {
    teamList,
    matchStatistics,
    leagueName,
    matchElo,
  };
}

export function buildMatchStatistics(currentMatch) {
  const { home, away } = currentMatch.teams;
  const stats = Array.isArray(currentMatch.statistics) ? currentMatch.statistics : [];
  const [rawA, rawB] = stats;
  const homeID = Number(home?.id);
  const awayID = Number(away?.id);

  const homeStats = stats.find((entry) => Number(entry?.team?.id) === homeID)
    ?? (Number(rawA?.team?.id) === homeID ? rawA : rawB);
  const awayStats = stats.find((entry) => Number(entry?.team?.id) === awayID)
    ?? (Number(rawB?.team?.id) === awayID ? rawB : rawA);

  const homeByType = new Map((homeStats?.statistics ?? []).map(s => [s.type, s.value]));
  const awayByType = new Map((awayStats?.statistics ?? []).map(s => [s.type, s.value]));

  const statDisplayNames = { expected_goals: "Expected Goals", goals_prevented: "Goals Prevented" };
  const formatStat = v => (v === null || v === undefined || v === "" ? "-" : v);

  const rows = [...new Set([...homeByType.keys(), ...awayByType.keys()])].map(type => ({
    type: statDisplayNames[type] ?? type,
    homeValue: formatStat(homeByType.get(type)),
    awayValue: formatStat(awayByType.get(type)),
  }));

  const fotmob = currentMatch?.fotmob;
  if (fotmob && (fotmob.homeXg != null || fotmob.awayXg != null)) {
    const formatXg = (value) => (value == null || value === "" ? "-" : value);
    const expectedGoals = rows.find((row) => row.type === "Expected Goals");
    if (!expectedGoals) {
      rows.unshift({
        type: "Expected Goals",
        homeValue: formatXg(fotmob.homeXg),
        awayValue: formatXg(fotmob.awayXg),
      });
    } else {
      if (expectedGoals.homeValue === "-") {
        expectedGoals.homeValue = formatXg(fotmob.homeXg);
      }
      if (expectedGoals.awayValue === "-") {
        expectedGoals.awayValue = formatXg(fotmob.awayXg);
      }
    }
  }

  const expectedGoals = rows.find((row) => row.type === "Expected Goals");
  const homeXg = Number(expectedGoals?.homeValue);
  const awayXg = Number(expectedGoals?.awayValue);
  if (Number.isFinite(homeXg) && Number.isFinite(awayXg)) {
    const xgIndex = rows.indexOf(expectedGoals);
    rows.splice(xgIndex + 1, 0, {
      type: "xPoints",
      homeValue: calculateXPts(homeXg, awayXg).xPts.toFixed(2),
      awayValue: calculateXPts(awayXg, homeXg).xPts.toFixed(2),
    });
  }

  return rows;
}