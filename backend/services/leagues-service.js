import { allLeagues } from "../data-access.js";

export function groupByLeague(matches) {
  const grouped = {};
  for (const match of matches) {
    const leagueId = match.league.id;
    if (!grouped[leagueId]) {
      grouped[leagueId] = {
        league: match.league, // { id, name, logo }
        matches: []
      };
      grouped[leagueId].league.name = allLeagues.find(lg => lg.id == leagueId).name;
    }
    grouped[leagueId].matches.push(match);
  }
  return Object.values(grouped);
}