import { allDBLeagues } from "../data-access.js";

export const defaultLeagues = [39, 140, 135, 78, 61, 88, 94];

export function groupByLeague(matches) {
  const grouped = {};
  for (const match of matches) {
    const leagueId = match.league.id;
    if (!grouped[leagueId]) {
      grouped[leagueId] = {
        league: match.league, // { id, name, logo }
        matches: []
      };
      grouped[leagueId].league.name = allDBLeagues.find(lg => lg.id == leagueId).name;
    }
    grouped[leagueId].matches.push(match);
  }

  return Object.values(grouped).sort((a, b) => {
    const leagueA = allDBLeagues.find(lg => lg.id == a.league.id);
    const leagueB = allDBLeagues.find(lg => lg.id == b.league.id);
    return (leagueA?.sort_order ?? Infinity) - (leagueB?.sort_order ?? Infinity);
  });
}