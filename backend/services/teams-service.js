import { buildTeamList } from "./../json-reader.js";
import { allDBLeagues, allDBTeams } from "../index.js";
import { allTeamMatches } from "./matches-service.js";

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

export function getTeamById(teamID) {
  return allDBTeams.find((team) => Number(team.ID) === Number(teamID)) || null;
}

export async function getTeamPageData(registry, teamID) {
  const selectedTeamID = Number(teamID);
  const fullTeamList = extractTeams(registry, null, [], selectedTeamID);
  let teamStats = fullTeamList.filter((team) => Number(team.id) === selectedTeamID);
  const matches = (await allTeamMatches(registry, selectedTeamID, null, false))
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  if (!teamStats.length && matches.length) {
    const fallbackTeamList = buildTeamList(matches);
    teamStats = fallbackTeamList.filter((team) => Number(team.id) === selectedTeamID);
    console.log(`team stats fallback used for team ${selectedTeamID}, matches: ${matches.length}`);
  }

  if (!teamStats.length) {
    return { matches, teamStats: [] };
  }

  teamStats[0].leagues = [...teamStats[0].leagues.values()].map((league) => {
    const leagueFromDb = allDBLeagues.find((dbLeague) => Number(dbLeague.id) === Number(league.id));

    return {
      ...league,
      name: league.name || leagueFromDb?.name || `Competition ${league.id}`,
    };
  });

  return { matches, teamStats };
}

function parseShowAllPlayerStats(allStatsQuery) {
  const value = String(allStatsQuery || "").trim().toLowerCase();
  return value === "1" || value === "true";
}

export async function getTeamRouteData(registry, teamID, allStatsQuery) {
  const { getSquadFromDb } = await import("../data-access.js");
  const { getTeamPlayerList } = await import("./players-service.js");

  const { matches, teamStats } = await getTeamPageData(registry, teamID);
  const savedSquad = await getSquadFromDb(teamID);
  const showAllPlayerStats = parseShowAllPlayerStats(allStatsQuery);

  const latestLeagueID = Number(matches?.[0]?.league?.id);
  const selectedPlayerStatsLeague = Number.isFinite(latestLeagueID)
    ? latestLeagueID
    : null;
  const selectedPlayerStatsLeagueName = selectedPlayerStatsLeague !== null
    ? (allDBLeagues.find((league) => Number(league.id) === selectedPlayerStatsLeague)?.name || `Competition ${selectedPlayerStatsLeague}`)
    : "All competitions";

  const playerLeagueFilter = !showAllPlayerStats && selectedPlayerStatsLeague !== null
    ? [selectedPlayerStatsLeague]
    : [];

  const teamPlayers = getTeamPlayerList(
    registry,
    teamID,
    savedSquad,
    100,
    playerLeagueFilter,
  );

  return {
    matches,
    teamStats,
    teamPlayers,
    showAllPlayerStats,
    selectedPlayerStatsLeague,
    selectedPlayerStatsLeagueName,
  };
}