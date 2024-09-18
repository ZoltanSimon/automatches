import { readFile } from "fs/promises";
import * as fs from "fs";

export async function getPlayerGoalList(leagues) {
  let scorerList = [];
  let scorer;
  for (let i = 0; i < leagues.length; i++) {
    let league = JSON.parse(
      await readFile(`./data/leagues/${leagues[i]}.json`)
    );
    console.log(league);

    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let match = await getMatch(league[i].fixture.id);
        if (match[0]) {
          for (let j = 0; j < match[0].events.length; j++) {
            if (match[0].events[j].type == "Goal") {
              scorer = match[0].events[j].player;
              if (!scorerList.find((e) => e.id == scorer.id)) {
                scorer.goals = 1;
                scorerList.push(scorer);
              } else {
                scorerList.find((e) => e.id == scorer.id).goals++;
              }
            }
          }
        }
      }
    }
  }
  scorerList.sort((a, b) =>
    a.goals < b.goals ? 1 : b.goals < a.goals ? -1 : 0
  );

  return scorerList;
}

async function getMatch(fixtureID) {
  try {
    let response = JSON.parse(
      await readFile(`./data/matches/${fixtureID}.json`)
    );
    return response;
  } catch (e) {
    console.error(e);
    return null;
  }
}
