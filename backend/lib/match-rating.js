// Players need this many minutes for their rating to count towards the team's match rating.
export const MIN_RATED_MINUTES = 22;

function parseRating(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function teamSide(match, teamId) {
  const numericTeamId = Number(teamId);
  if (numericTeamId === Number(match?.teams?.home?.id)) return "home";
  if (numericTeamId === Number(match?.teams?.away?.id)) return "away";
  return null;
}

function averageQualifyingRatings(entries) {
  const ratings = entries
    .filter((entry) => Number(entry.minutes) >= MIN_RATED_MINUTES)
    .map((entry) => parseRating(entry.rating))
    .filter((rating) => rating !== null);

  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function getOfficialTeamRating(match, teamId) {
  const teams = Array.isArray(match?.players) ? match.players : [];
  const entry = teams.find((item) => Number(item?.team?.id) === Number(teamId));
  const players = Array.isArray(entry?.players) ? entry.players : [];

  return averageQualifyingRatings(players.map((player) => {
    const games = player?.statistics?.[0]?.games;
    return { minutes: games?.minutes, rating: games?.rating };
  }));
}

export function getFotmobTeamRating(match, teamId, side = teamSide(match, teamId)) {
  if (!side) return null;
  const players = Array.isArray(match?.fotmob?.players) ? match.fotmob.players : [];
  return averageQualifyingRatings(players.filter((player) => player?.side === side));
}

// Mean rating of the team's players with at least MIN_RATED_MINUTES, from API-Football
// first and FotMob as fallback. Returns an unrounded number or null.
export function getTeamMatchRating(match, teamId) {
  return getOfficialTeamRating(match, teamId) ?? getFotmobTeamRating(match, teamId);
}
