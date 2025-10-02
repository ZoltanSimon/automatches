import * as fs from "fs";
import { allDBLeagues, getLeagueFromDb } from "./../data-access.js";
import {
  matchesDir,
  getMatchFromServer,
} from "./../json-reader.js";

export async function matchesOnDay(dateToCheck) {
  let daysMatches = [];
  let checkDate = new Date(dateToCheck) || new Date();
  console.log("Checking for matches on date:", checkDate.toDateString());

  for (let i = 0; i < allDBLeagues.length; i++) {
    let leagueID = allDBLeagues[i].id;
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
