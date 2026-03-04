import { buildTeamList } from "./../json-reader.js";

export function extractTeams(registry, date, leagueIDs = [], teamID = null) {
  const filterDate = date ? new Date(date) : new Date(2000, 0, 1);

  const matches = registry.matches.filter((m) => {
    const inLeague = leagueIDs.length === 0 || leagueIDs.includes(m.league.id);
    const afterDate = new Date(m.fixture.date) > filterDate;
    // only include matches involving the specified team, if provided
    const hasTeam =
      teamID === null ||
      m.teams.home.id === teamID ||
      m.teams.away.id === teamID;

    return inLeague && afterDate && hasTeam;
  });

  return buildTeamList(matches);
}

export function getTopTeams(registry, leagues) {
  let thisToPTeams = extractTeams(registry, null, leagues);

  thisToPTeams.sort((a, b) =>
    a.last5PerGame.points < b.last5PerGame.points
      ? 1
      : b.last5PerGame.points < a.last5PerGame.points
        ? -1
        : 0,
  );

  return thisToPTeams;
}