import * as fs from "fs";
import { allDBLeagues, getLeagueFromDb } from "./../data-access.js";
import {
  matchesDir,
  getMatchFromServer,
} from "./../json-reader.js";

export async function matchesOnDay(dateToCheck, selectedLeagues = allDBLeagues) {
  let daysMatches = [];
  let checkDate = new Date(dateToCheck) || new Date();
  console.log("Checking for matches on date:", checkDate.toDateString());

  for (let i = 0; i < selectedLeagues.length; i++) {
    let leagueID = selectedLeagues[i].id;
    let data = await getLeagueFromDb(leagueID);

    for (const element of data) {
      let fixtureDate = new Date(element.fixture.date);
      if (fixtureDate.toDateString() === checkDate.toDateString()) {
        daysMatches.push(element);
      }
    }
  }

  for (let i = 0; i < daysMatches.length; i++) {
    let matchID = daysMatches[i].fixture.id;
    let fixtureDate = new Date(daysMatches[i].fixture.date);
    const matchEnd = new Date(fixtureDate.getTime() + 150 * 60000); // 150 min after KO

    // only check local file if the match should be finished
    if (new Date() > matchEnd) {
      try {
        fs.accessSync(`${matchesDir}/${matchID}.json`, fs.constants.R_OK);

        let matchData = await getMatchFromServer(matchID);
        if (matchData && matchData[0]) {
          daysMatches[i] = matchData[0];
        }
      } catch (err) {
        // file not found or error
        console.warn(`No data found for matchID: ${matchID}`);
      }
    }
  }

  return daysMatches;
}

export async function matchesInRound(roundNr, leagueID) {
  let data = await getLeagueFromDb(leagueID);
  let matches = data.filter((element) => element.league.round == `League Stage - ${roundNr}`);

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