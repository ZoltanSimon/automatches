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

export async function lastMatchesFromLeague(leagueID, count = 10) {
  let data = await getLeagueFromDb(leagueID);
  
  // Filter to only include finished matches (past matches)
  let finishedMatches = data.filter((element) => {
    let fixtureDate = new Date(element.fixture.date);
    return fixtureDate < new Date();
  });
  
  // Sort by date descending (most recent first)
  finishedMatches.sort((a, b) => {
    let dateA = new Date(a.fixture.date);
    let dateB = new Date(b.fixture.date);
    return dateB - dateA; // descending order
  });
  
  // Take only the requested number of matches
  let lastMatches = finishedMatches.slice(0, count);
  
  // Update each match with fresh data from server
  for (let i = 0; i < lastMatches.length; i++) {
    let matchID = lastMatches[i].fixture.id;
    let matchData = await getMatchFromServer(matchID);
    if (matchData && matchData[0]) {
      lastMatches[i] = matchData[0];
    }
  }
  
  return lastMatches;
}

export function allTeamMatches(registry, homeTeamID, awayTeamID = null, checkStatus = true) {
  const fixturesForTeam = registry.fixtures.filter(({ fixture, teams }) => {
    const { home, away } = teams;
    const teamMatch = awayTeamID
      ? (home.id === homeTeamID && away.id === awayTeamID) ||
        (home.id === awayTeamID && away.id === homeTeamID)
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