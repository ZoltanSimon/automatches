export let allDBPlayers = [];
export let allDBTeams = [];
export let allDBLeagues = [];

export function setCatalog({ players, teams, leagues } = {}) {
  if (players !== undefined) {
    allDBPlayers = players;
  }
  if (teams !== undefined) {
    allDBTeams = teams;
  }
  if (leagues !== undefined) {
    allDBLeagues = leagues;
  }
}

export function getCatalogLeague(leagueId) {
  return (allDBLeagues || []).find((league) => Number(league.id) === Number(leagueId)) ?? null;
}

export function upsertCatalogPlayer(player) {
  if (!player || player.id == null) {
    return;
  }

  const playerID = Number(player.id);
  const index = allDBPlayers.findIndex((row) => Number(row.id) === playerID);
  if (index >= 0) {
    allDBPlayers[index] = player;
    return;
  }

  allDBPlayers.push(player);
}
