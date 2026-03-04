export const defaultLeagues = [39, 140, 135, 78, 61, 88, 94];
import { allDBLeagues } from "../index.js";
import { extractTeams } from "./teams-service.js";

export function groupByLeague(matches) {
  const grouped = {};
  for (const match of matches) {
    const leagueId = match.league.id;
    if (!grouped[leagueId]) {
      grouped[leagueId] = {
        league: match.league, // { id, name, logo }
        matches: [],
      };
      grouped[leagueId].league.name = allDBLeagues.find(
        (lg) => lg.id == leagueId,
      ).name;
    }
    grouped[leagueId].matches.push(match);
  }

  return Object.values(grouped).sort((a, b) => {
    const leagueA = allDBLeagues.find((lg) => lg.id == a.league.id);
    const leagueB = allDBLeagues.find((lg) => lg.id == b.league.id);
    return (
      (leagueA?.sort_order ?? Infinity) - (leagueB?.sort_order ?? Infinity)
    );
  });
}

export function getLeagueStandings(registry, league) {
  let thisStandings = extractTeams(registry, null, [league]);

  thisStandings.sort((a, b) =>
    a.total.points < b.total.points
      ? 1
      : b.total.points < a.total.points
        ? -1
        : 0,
  );

  thisStandings.forEach((team) => {
    team.total.xG = Math.round(team.total.xG);
    team.total.xGA = Math.round(team.total.xGA);
  });

  return thisStandings;
}