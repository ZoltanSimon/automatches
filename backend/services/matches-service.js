import { buildMatchRegistry } from "./registry-service.js";
import { saveMatchesToServer, buildTeamList, matchFileExists } from "../json-reader.js";
import { allDBLeagues } from "../catalog.js";
import { getAllMatchesFromDb } from "../data-access.js";
import { wait } from "../backend-helper.js";

const FINISHED_MATCH_STATUSES = new Set(["FT", "AET", "PEN"]);
const UPDATE_MATCHES_DELAY_MS = 3000;

export async function findMissingFinishedMatches(logPrefix) {
  const data = await getAllMatchesFromDb();
  const missingMatches = [];

  for (const element of data) {
    const dbStatus = String(element.fixtureStatus || "").trim().toUpperCase();

    if (!FINISHED_MATCH_STATUSES.has(dbStatus)) {
      continue;
    }

    if (!(await matchFileExists(element.fixtureId))) {
      missingMatches.push(element);
    }
  }

  console.log(`${logPrefix} Total missing matches: ${missingMatches.length}`);
  return missingMatches;
}

export async function hydrateMissingMatches(missingMatches, logPrefix) {
  const matchesToDownload = missingMatches.length;
  const batchSize = 20;
  const saved = [];
  const failed = [];

  for (let i = 0; i < matchesToDownload; i += batchSize) {
    const batch = missingMatches.slice(i, i + batchSize);
    const batchIds = [...new Set(batch.map((match) => String(match.fixtureId)))];
    const remaining = matchesToDownload - (i + batch.length);

    if (batchIds.length === 0) {
      continue;
    }

    try {
      const result = await saveMatchesToServer(batchIds);
      saved.push(...result.saved);
      failed.push(...result.failed);

      console.log(
        `${logPrefix} Saved ${result.savedCount}/${batchIds.length} matches in batch [${batchIds.join(",")}] (${remaining} left)`,
      );

      if (result.failed.length > 0) {
        console.warn(`${logPrefix} Failed matches in batch:`, result.failed);
      }
    } catch (err) {
      console.error(`${logPrefix} Error saving match batch [${batchIds.join(",")}]`, err);
      failed.push(...batchIds.map((fixtureID) => ({ fixtureID, error: err.message })));
    }

    if (remaining > 0) {
      await wait(UPDATE_MATCHES_DELAY_MS);
    }
  }

  console.log(`${logPrefix} Finished downloading ${matchesToDownload} matches.`);

  return {
    requested: matchesToDownload,
    savedCount: saved.length,
    failedCount: failed.length,
    saved,
    failed,
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

  return {
    teamList,
    matchStatistics,
    leagueName,
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