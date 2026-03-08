import { getLeagueFromDb } from "./../data-access.js";
import {
  matchesDir,
  getMatchFromServer,
} from "./../json-reader.js";

export async function matchesOnDay(registry, dateToCheck) {
  const checkDate = new Date(dateToCheck) || new Date();
  const daysMatches = registry.fixtures.filter(({ fixture }) => (fixture.date.toDateString()) === checkDate.toDateString());

  // Enrich finished matches from registry cache, fallback to server
  const enriched = await Promise.all(
    daysMatches.map(async (element) => {
      const { id, date } = element.fixture;
      const matchEnd = new Date(new Date(date).getTime() + 150 * 60000);

      if (new Date() > matchEnd) {
        // Use registry first
        if (registry.matchByID.has(id)) {
          return registry.matchByID.get(id);
        }
        // Fallback to server if not in registry
        try {
          const matchData = await getMatchFromServer(id);
          return matchData?.[0] ?? element;
        } catch (err) {
          console.warn(`No data found for matchID: ${id}`);
          return element;
        }
      }

      return element;
    })
  );

  return enriched;
}

export async function matchesInRound(roundNr, leagueID) {
  const roundName = (leagueID == 2) ? `League Stage - ${roundNr}` : `Group Stage - ${roundNr}`;
  let data = await getLeagueFromDb(leagueID);
  let matches = data.filter((element) => element.league.round == roundName);

  for (let i = 0; i < matches.length; i++) {
    let matchID = matches[i].fixture.id;
    let matchData = await getMatchFromServer(matchID);
    if (matchData && matchData[0]) {
      matches[i] = matchData[0];
    }
  }
  return matches;
}

export function lastMatchesFromLeague(registry, leagueID) {

  const leagueFixtures = registry.fixtures
    .filter(({ fixture, league }) => 
      league.id === leagueID
    )
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  const matches = leagueFixtures
    .map((item) => registry.matchByID.get(item.fixture.id) ?? item)
    .filter(Boolean);

  const rounds = [...new Set(leagueFixtures.map(({ league }) => league.round))].sort();

  const now = new Date();
  let currentRound = null;
  let minDiff = Infinity;
  for (const round of rounds) {
    const roundFixtures = leagueFixtures.filter(item => item.league.round === round);
    for (const item of roundFixtures) {
      const diff = Math.abs(new Date(item.fixture.date) - now);
      if (diff < minDiff) {
        minDiff = diff;
        currentRound = round;
      }
    }
  }

  return { matches, rounds, currentRound };
}

export function allTeamMatches(registry, homeTeamID, awayTeamID = null, checkStatus = true) {
  const fixturesForTeam = registry.fixtures.filter(({ fixture, teams }) => {
    const { home, away } = teams;
    const teamMatch = awayTeamID
      ? home.id === homeTeamID || away.id === homeTeamID || home.id === awayTeamID || away.id === awayTeamID
      : home.id === homeTeamID || away.id === homeTeamID;

    if (!teamMatch) return false;
    if (checkStatus) return ["FT", "AET"].includes(fixture.status.short);
    return true;
  });


  const enriched = fixturesForTeam
    .map(({ fixture }) => {
      const match = registry.matchByID.get(fixture.id);
      if (!match) console.warn(`Match not found in registry for fixtureID: ${fixture.id}`);
      return match ?? null;
    })
    .filter(Boolean);

  return enriched;
}