import { buildMatchRegistry, upsertRegistryMatchIfLoaded } from "./registry-service.js";
import { saveMatchesToServer, buildTeamList } from "./json-reader.js";
import { applyEloForFinishedMatches } from "./elo-service.js";
import { allDBLeagues } from "../lib/catalog.js";
import { getAllMatchesFromDb, getMatchIdsMissingDetails, getMatchEloByMatchId } from "../data-access.js";
import { formatEloDelta } from "../lib/elo.js";
import { wait } from "../lib/backend-helper.js";
import { getResults, getFixturesByDate, hasApiErrors } from "../api/webapi-handler.js";

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
  return registry.matches.filter(({ fixture }) => {
    const matchDate = new Date(fixture.date);
    return matchDate.toDateString() === checkDate.toDateString();
  });
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

export async function getMatchPageData(registry, currentMatch) {
  const { home, away } = currentMatch.teams;
  const allMatches = await allTeamMatches(registry, home.id, away.id);
  const matchesForTeamList = allMatches.length > 0 ? allMatches : [currentMatch];
  const teamList = buildTeamList(matchesForTeamList)
    .filter((team) => team.id === home.id || team.id === away.id)
    .sort((a, b) => (a.id === home.id ? -1 : b.id === home.id ? 1 : 0))
    .map((team) => ({
      ...team,
      matches: team.matches
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5),
    }));

  const matchStatistics = buildMatchStatistics(currentMatch);
  const matchLeagueName = typeof currentMatch?.league?.name === "string"
    ? currentMatch.league.name.trim()
    : "";
  const dbLeagueName = currentMatch?.league?.id
    ? allDBLeagues.find((league) => league.id == currentMatch.league.id)?.name || ""
    : "";
  const leagueName = matchLeagueName || dbLeagueName || "Unknown League";
  const matchEloRow = await getMatchEloByMatchId(currentMatch?.fixture?.id ?? currentMatch?.id);
  const matchElo = matchEloRow
    ? {
        home: formatEloDelta(matchEloRow.home_elo_after, matchEloRow.home_elo_before),
        away: formatEloDelta(matchEloRow.away_elo_after, matchEloRow.away_elo_before),
      }
    : null;

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

  return [...new Set([...homeByType.keys(), ...awayByType.keys()])].map(type => ({
    type: statDisplayNames[type] ?? type,
    homeValue: formatStat(homeByType.get(type)),
    awayValue: formatStat(awayByType.get(type)),
  }));
}