import { buildTeamList } from "./../json-reader.js";

function toStatsMatch(matchOrFixture) {
  if (matchOrFixture?.statistics?.length >= 2) {
    return matchOrFixture;
  }

  return {
    ...matchOrFixture,
    score: {
      fulltime: {
        home: matchOrFixture?.goals?.home ?? 0,
        away: matchOrFixture?.goals?.away ?? 0,
      },
    },
    statistics: [{ statistics: [] }, { statistics: [] }],
  };
}

export function extractTeams(
  registry,
  date,
  leagueIDs = [],
  teamID = null,
  includeGroupStageOnly = false,
) {
  const filterDate = date ? new Date(date) : new Date(2000, 0, 1);

  const completedMatches = registry.matches
    .filter(({ fixture }) => ["FT", "AET", "PEN"].includes(fixture.status.short))
    .map(toStatsMatch);

  const matches = completedMatches.filter((m) => {
    const inLeague = leagueIDs.length === 0 || leagueIDs.includes(m.league.id);
    const afterDate = new Date(m.fixture.date) > filterDate;
    const roundName = (m.league?.round || "").toLowerCase();
    const isIncludedRound =
      teamID !== null
        ? true
        : includeGroupStageOnly
          ? roundName.includes("league stage") || roundName.includes("group stage")
          : roundName.includes("regular season");
    // only include matches involving the specified team, if provided
    const normalizedTeamID = teamID === null ? null : Number(teamID);
    const homeID = Number(m.teams.home.id);
    const awayID = Number(m.teams.away.id);
    const hasTeam =
      normalizedTeamID === null ||
      homeID === normalizedTeamID ||
      awayID === normalizedTeamID;

    return inLeague && afterDate && isIncludedRound && hasTeam;
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