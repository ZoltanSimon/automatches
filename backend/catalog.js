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
