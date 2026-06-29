import { buildMatchRegistry } from "./registry-service.js";
import { buildTeamList } from "../json-reader.js";
import { allDBLeagues } from "../index.js";

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
    if (checkStatus) return ["FT", "AET"].includes(fixture.status.short);
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
  const leagueName = currentMatch.league.id
    ? allDBLeagues.find((league) => league.id == currentMatch.league.id)?.name || "Unknown League"
    : "Unknown League";

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