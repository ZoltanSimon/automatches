import {
    getPlayerGoalList,
    getMatchFromServer,
    matchesDir,
    getAllPlayers,
    getLeagueFromServer,
    writeLeagueToServer,
    buildTeamList,
  } from "./../json-reader.js";

export async function getPlayerList(leagues = [39, 140, 135, 78, 61, 88, 94], nr = 10, teamFilter = "") {
  let players = await getPlayerGoalList(leagues);

  if (teamFilter) {
    players = players.filter(player => player.club == teamFilter);
  }

  return players.slice(0, nr);
}