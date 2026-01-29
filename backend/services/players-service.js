import {
    getPlayerGoalList,
    getAllPlayers,
  } from "./../json-reader.js";
import { allDBLeagues, insertPlayersToDb, allDBPlayers } from "./../data-access.js"; 
import { Player } from "./../../classes/player.js";

export async function getPlayerList(leagues = [39, 140, 135, 78, 61, 88, 94], nr = 10, teamFilter = "") {
  console.log("Fetching player list for leagues:", leagues, "with team filter:", teamFilter);
  let players = await getPlayerGoalList(leagues);

  if (teamFilter) {
    players = players.filter(player => player.club == teamFilter);
  }

  return players.slice(0, nr);
}

export async function getTeamPlayerList(allMatches, teamID, nr = 100) {
  const allPlayers = [];
  
  // Process all matches once
  for (let match of allMatches) {
    const { players, teams } = match;
    
    if (!Array.isArray(players) || players.length < 2) continue;

    // Find which team index matches our teamID (0 for home, 1 for away)
    let teamIndex = -1;
    if (teams.home.id === teamID) {
      teamIndex = 0;
    } else if (teams.away.id === teamID) {
      teamIndex = 1;
    } else {
      continue; // Skip this match if our team isn't in it
    }

    const teamPlayers = players[teamIndex].players;

    for (let player of teamPlayers) {
      const playerID = player.player.id;
      let playerFound = allPlayers.find((x) => x.id === playerID);

      if (playerFound) {
        playerFound.getPlayerStats(player);
      } else {
        const inputPlayer = getPlayerByID(playerID);

        if (!inputPlayer) {
          console.error(`Player with ID ${playerID} not found.`);
          continue;
        }

        const thisPlayer = new Player(inputPlayer);
        thisPlayer.getPlayerStats(player);
        allPlayers.push(thisPlayer);
      }
    }
  }
  
  allPlayers.sort((a, b) =>
    a.goals < b.goals ? 1 : b.goals < a.goals ? -1 : 0
  );

  return allPlayers.filter((player) => player.apps >= 1).slice(0, nr);
}

export async function insertAllPlayers() {
  let allPlayers = await getAllPlayers(
    allDBLeagues.filter((el) => el.type == "league").concat(allDBLeagues.filter((el) => el.type == "cup")),
    allDBLeagues.filter((el) => el.type == "nt")
  );

  await insertPlayersToDb(allPlayers);
  return allPlayers;
}

export function getPlayerByID(playerID) {
  return allDBPlayers.find((element) => element.id == playerID);
}