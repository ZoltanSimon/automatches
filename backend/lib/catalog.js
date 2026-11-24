export let allDBPlayers = [];
export let allDBTeams = [];
export let allDBLeagues = [];
// player id -> position profile (backend/lib/player-position-profile.js).
let playerPositionProfiles = new Map();

let catalogVersion = 0;

export function getCatalogVersion() {
  return catalogVersion;
}

export function setCatalog({ players, teams, leagues, positionProfiles } = {}) {
  if (players !== undefined) {
    allDBPlayers = players;
  }
  if (teams !== undefined) {
    allDBTeams = teams;
  }
  if (leagues !== undefined) {
    allDBLeagues = leagues;
  }
  if (positionProfiles !== undefined) {
    playerPositionProfiles = positionProfiles;
  }
  catalogVersion += 1;
}

export function getPlayerPositionProfile(playerId) {
  return playerPositionProfiles.get(Number(playerId)) ?? null;
}

export function getCatalogLeague(leagueId) {
  return (allDBLeagues || []).find((league) => Number(league.id) === Number(leagueId)) ?? null;
}

export function upsertCatalogPlayer(player) {
  if (!player || player.id == null) {
    return;
  }

  catalogVersion += 1;
  const playerID = Number(player.id);
  const index = allDBPlayers.findIndex((row) => Number(row.id) === playerID);
  if (index >= 0) {
    allDBPlayers[index] = player;
    return;
  }

  allDBPlayers.push(player);
}
