import { readFile } from "fs/promises";
import * as fs from "fs";
import { Player } from "./../classes/player.js";

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
        if (match[0]) {
          for (let { players } of match) {
            teams = {
              home: players[0].team.id,
              away: players[1].team.id,
            };

            teamNames = {
              home: players[0].team.name,
              away: players[1].team.name,
            };

            getBothTeams(players, 0, teams.home, teamNames.home);
            getBothTeams(players, 1, teams.away, teamNames.away);
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

/*export async function getLocalPlayerStats(inputPlayer, leagues) {
  let playerFound;
  let foundIndex = -1;
  let thisComp = "";

  let player = new Player(inputPlayer);
  for (let i = 0; i < leagues.length; i++) {
    let response = await fetch(`data/leagues/${leagues[i]}.json`);
    let league = await response.json();

    for (let i = 0; i < league.length; i++) {
      if (
        league[i].fixture.status.short == "FT" &&
        (league[i].teams.home.id == inputPlayer.club ||
          league[i].teams.away.id == inputPlayer.club)
      ) {
        thisComp = league[i].league.name;
        foundIndex = -1;

        let match = await getResultFromLocal(league[i].fixture.id);
        for (let { players } of match) {
          playerFound = players[0].players.find(
            (x) => x.player.id == inputPlayer.id
          );
          if (!playerFound) {
            playerFound = players[1].players.find(
              (x) => x.player.id == inputPlayer.id
            );
          } else {
            foundIndex = 0;
          }
          if (playerFound) {
            if (foundIndex == -1) foundIndex = 1;
            player.getPlayerStats(playerFound);
            if (!player.team) player.team = players[foundIndex].team.name;
            if (player.competitions.indexOf(thisComp) == -1)
              player.competitionList.push(thisComp);
          }
        }
        player.getGAper90();
      }
    }
  }

  return player;
}*/

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

function getBothTeams(players, home, teamID, teamName) {
  for (let player of players[home].players) {
    let playerID = player.player.id;
    let playerFound = allPlayers.find((x) => x.id == playerID);
    if (playerFound) {
      playerFound.getPlayerStats(player);
    } else {
      let inputPlayer = { id: playerID, club: teamID, teamName: teamName };
      let thisPlayer = new Player(inputPlayer);
      thisPlayer.getPlayerStats(player);
      allPlayers.push(thisPlayer);
    }
  }
}
