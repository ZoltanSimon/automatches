import { readFile } from "fs/promises";
import { Player } from "./../classes/player.js";
import * as fs from "fs";
import { networkPath } from "./config.js";

const cache = new Map();
let allPlayers = [];
export const matchesDir = `${networkPath}matches`;
export const leaguesDir = `${networkPath}leagues`;
export const dataDir = `${networkPath}`;

export const players = JSON.parse(
  await readFile(`${dataDir}players.json`, "utf-8")
);

export function getPlayerByID(playerID) {
  return players.find((element) => element.id == playerID);
}

export async function getPlayerGoalList(leagues) {
  allPlayers = [];
  let teams,
    teamNames = {};
  for (let i = 0; i < leagues.length; i++) {
    let league = await getLeagueFromServer(leagues[i]);
    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let match = await getMatchFromServer(league[i].fixture.id);
        if (match != null && match[0]) {
          for (let { players } of match) {
            if (Array.isArray(players) && players.length >= 2) {
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
  }
  allPlayers.sort((a, b) =>
    a.goals < b.goals ? 1 : b.goals < a.goals ? -1 : 0
  );

  return allPlayers;
}

export async function getMatchFromServer(fixtureID) {
  let file = `${matchesDir}/${fixtureID}.json`;
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

export async function getLeagueFromServer(leagueID) {
  let file = `${leaguesDir}/${leagueID}.json`;
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

export async function writeLeagueToServer(leagueID, dataToWrite) {
  let file = `${leaguesDir}/${leagueID}.json`;
  let responseToSend = "";

  fs.writeFile(file, JSON.stringify(dataToWrite), function (err) {
    if (err) {
      return console.log(err);
    }
    responseToSend += `${leagueID} was saved!<br/>`;
  });

  cache.set(file, dataToWrite);
  return responseToSend;
}

function getBothTeams(players, home, teamName) {
  for (let player of players[home].players) {
    let playerID = player.player.id;
    let playerFound = allPlayers.find((x) => x.id == playerID);
    if (playerFound) {
      playerFound.getPlayerStats(player);
    } else {
      let inputPlayer = getPlayerByID(playerID);

      if (!inputPlayer) {
        console.error(`Player with ID ${playerID} not found.`);
        return;
      }
      let thisPlayer = new Player(inputPlayer);
      thisPlayer.getPlayerStats(player);
      allPlayers.push(thisPlayer);
    }
  }
}

export async function getAllPlayers(compType, compList, nationList) {
  let player, thisClub;
  for (let i = 0; i < compList.length; i++) {
    let league = JSON.parse(
      await readFile(`${leaguesDir}/${compList[i].id}.json`)
    );

    for (let i = 0; i < league.length; i++) {
      if (league[i].fixture.status.short == "FT") {
        let match = await getMatchFromServer(league[i].fixture.id);
        console.log(league[i].fixture.id);
        if (match) {
          for (let j = 0; j < match[0].players.length; j++) {
            thisClub = match[0].players[j].team.id;

            for (let k = 0; k < match[0].players[j].players.length; k++) {
              player = {
                id: match[0].players[j].players[k].player.id,
                name: match[0].players[j].players[k].player.name,
                nation: 0,
              };
              player[compType] = thisClub;
              if (!allPlayers.find((e) => e.id == player.id)) {
                allPlayers.push(player);
              } else {
                allPlayers.find((e) => e.id == player.id)[compType] = thisClub;
              }
            }
          }
        }
      }
    }
  }

  for (let i = 0; i < nationList.length; i++) {
    let nt = JSON.parse(
      await readFile(`${leaguesDir}/${nationList[i].id}.json`)
    );

    for (let i = 0; i < nt.length; i++) {
      let match = await getMatchFromServer(nt[i].fixture.id);
      if (match) {
        for (let j = 0; j < match[0].players.length; j++) {
          let thisNation = match[0].players[j].team.id;
          for (let k = 0; k < match[0].players[j].players.length; k++) {
            let id = match[0].players[j].players[k].player.id;

            let playerFound = allPlayers.find((e) => e.id == id);
            if (!playerFound) {
            } else {
              allPlayers.find((e) => e.id == id).nation = thisNation;
            }
          }
        }
      }
    }
  }
  return allPlayers;
}
