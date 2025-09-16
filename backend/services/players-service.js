import {
    getPlayerGoalList,
    getAllPlayers,
  } from "./../json-reader.js";
import { allLeagues, insertPlayersToDb, players } from "./../data-access.js"; 

export async function getPlayerList(leagues = [39, 140, 135, 78, 61, 88, 94], nr = 10, teamFilter = "") {
  let players = await getPlayerGoalList(leagues);

  if (teamFilter) {
    players = players.filter(player => player.club == teamFilter);
  }

  return players.slice(0, nr);
}

export async function insertAllPlayers() {
  let allPlayers = await getAllPlayers(
    allLeagues.filter((el) => el.type == "league"),
    allLeagues.filter((el) => el.type == "nt")
  );

  await insertPlayersToDb(allPlayers);
  return allPlayers;
}

export function getPlayerByID(playerID) {
  return players.find((element) => element.id == playerID);
}