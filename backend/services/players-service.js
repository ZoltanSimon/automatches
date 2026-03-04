import {
    getAllPlayers,
  } from "./../json-reader.js";
import { insertPlayersToDb } from "./../data-access.js"; 
import { Player } from "./../../classes/player.js";
import { allDBLeagues, allDBPlayers } from "../index.js";

export function getPlayerList(registry, nr = 10, teamFilter = "", leagueFilter = []) {
  const playerMap = new Map();

  const matches = leagueFilter.length > 0
    ? registry.matches.filter(m => leagueFilter.includes(m.league.id))
    : registry.matches;

  for (const match of matches) {
    const { players: matchPlayers } = match;
    if (!Array.isArray(matchPlayers) || matchPlayers.length < 2) continue;

    for (const team of matchPlayers) {
      for (const player of team.players) {
        const playerID = player.player.id;

        if (playerMap.has(playerID)) {
          playerMap.get(playerID).getPlayerStats(player);
        } else {
          const inputPlayer = getPlayerByID(playerID);
          if (!inputPlayer) {
            //console.error(`Player with ID ${playerID} not found.`);
            continue;
          }
          const thisPlayer = new Player(inputPlayer);
          thisPlayer.getPlayerStats(player);
          playerMap.set(playerID, thisPlayer);
        }
      }
    }
  }

  let players = [...playerMap.values()]
    .filter(p => p.apps >= 1)
    .sort((a, b) => b.goals - a.goals);

  if (teamFilter) {
    players = players.filter(p => p.club === teamFilter);
  }

  return players.slice(0, nr);
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