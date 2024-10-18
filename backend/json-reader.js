import { readFile } from "fs/promises";
import { Player } from "./../classes/player.js";

const cache = new Map();
let allPlayers = [];

export async function getPlayerGoalList(leagues) {
  allPlayers = [];
  let teams,
    teamNames = {};
  for (let i = 0; i < leagues.length; i++) {
    let league = JSON.parse(
      await readFile(`./data/leagues/${leagues[i]}.json`)
    );

    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let match = await getMatch(league[i].fixture.id);
        if (match != null && match[0]) {
          for (let { players } of match) {
            teams = {
              home: players[0].team.id,
              away: players[1].team.id,
            };

            teamNames = {
              home: players[0].team.name,
              away: players[1].team.name,
            };

            getBothTeams(players, 0, teamNames.home);
            getBothTeams(players, 1, teamNames.away);
          }
        }
      }
    }
  }
  allPlayers.sort((a, b) =>
    a.goals < b.goals ? 1 : b.goals < a.goals ? -1 : 0
  );

  return allPlayers;
}

export async function getMatch(fixtureID) {
  let file = `\\\\DESKTOP-1MDUJM7\\data\\matches\\${fixtureID}.json`;
  try {
    if (cache.has(file)) {
      return cache.get(file);
    } else {
      let response = JSON.parse(await readFile(file));
      cache.set(file, response);
      return response;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

function getBothTeams(players, home, teamName) {
  for (let player of players[home].players) {
    let playerID = player.player.id;
    let playerFound = allPlayers.find((x) => x.id == playerID);
    if (playerFound) {
      playerFound.getPlayerStats(player);
    } else {
      let inputPlayer = { id: playerID, teamName: teamName };
      let thisPlayer = new Player(inputPlayer);
      thisPlayer.getPlayerStats(player);
      allPlayers.push(thisPlayer);
    }
  }
}
