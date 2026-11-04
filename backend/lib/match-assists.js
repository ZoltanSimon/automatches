import { teamSide } from "./match-rating.js";

function sumAssists(values) {
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
}

// Assists by the team's players in a match, from API-Football first and FotMob as fallback.
// Returns null when neither source has player data for the team.
export function getTeamMatchAssists(match, teamId) {
  const teams = Array.isArray(match?.players) ? match.players : [];
  const official = teams.find((item) => Number(item?.team?.id) === Number(teamId))?.players;
  if (Array.isArray(official) && official.length > 0) {
    return sumAssists(official.map((player) => player?.statistics?.[0]?.goals?.assists));
  }

  const side = teamSide(match, teamId);
  const fotmob = (Array.isArray(match?.fotmob?.players) ? match.fotmob.players : [])
    .filter((player) => side && player?.side === side);
  return fotmob.length > 0 ? sumAssists(fotmob.map((player) => player.assists)) : null;
}
