import { buildTeamList } from "./../json-reader.js";
import { allDBLeagues, allDBTeams } from "../catalog.js";
import { allTeamMatches } from "./matches-service.js";
import { Team } from "../../classes/team.js";

const defaultTeamSortDirection = "desc";
const validTeamSortStats = new Set([
  "played",
  "winPercentage",
  "possession",
  "goals",
  "xG",
  "corners",
  "shotsOnGoal",
  "fouls",
  "yellowCards",
  "redCards",
  "offsides",
]);
const validTeamStatFilterOperators = new Set(["gte", "lte", "between", "eq", "neq"]);
const simpleTeamStatReaders = {
  played: (team) => team.played,
  winPercentage: (team) => team.total?.winPercentage,
  possession: (team) => team.perGame?.possession,
};
const pairedTeamStatReaders = {
  goals: { for: (team) => team.total?.goals, against: (team) => team.total?.goalsAgainst },
  xG: { for: (team) => team.total?.xG, against: (team) => team.total?.xGA },
  corners: { for: (team) => team.total?.corners, against: (team) => team.total?.cornersAgainst },
  shotsOnGoal: { for: (team) => team.total?.shotsOnGoal, against: (team) => team.total?.shotsOnGoalAgainst },
  fouls: { for: (team) => team.total?.fouls, against: (team) => team.total?.foulsAgainst },
  yellowCards: { for: (team) => team.total?.yellowCards, against: (team) => team.total?.yellowCardsAgainst },
  redCards: { for: (team) => team.total?.redCards, against: (team) => team.total?.redCardsAgainst },
  offsides: { for: (team) => team.total?.offsides, against: (team) => team.total?.offsidesAgainst },
};
const teamColumnStatMap = new Map([
  [6, { stat: "goals", isAgainst: false }],
  [7, { stat: "goals", isAgainst: true }],
  [8, { stat: "xG", isAgainst: false }],
  [9, { stat: "xG", isAgainst: true }],
  [10, { stat: "corners", isAgainst: false }],
  [11, { stat: "corners", isAgainst: true }],
  [12, { stat: "shotsOnGoal", isAgainst: false }],
  [13, { stat: "shotsOnGoal", isAgainst: true }],
  [14, { stat: "fouls", isAgainst: false }],
  [15, { stat: "fouls", isAgainst: true }],
  [16, { stat: "yellowCards", isAgainst: false }],
  [17, { stat: "yellowCards", isAgainst: true }],
  [18, { stat: "redCards", isAgainst: false }],
  [19, { stat: "redCards", isAgainst: true }],
  [20, { stat: "offsides", isAgainst: false }],
  [21, { stat: "offsides", isAgainst: true }],
]);

function normalizeTextValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length ? normalized : null;
}

function normalizeTeamSortDirection(direction) {
  return String(direction || defaultTeamSortDirection).toLowerCase() === "asc" ? "asc" : "desc";
}

function normalizeTeamSortStat(stat) {
  const normalized = normalizeTextValue(stat);
  if (!normalized) {
    return null;
  }

  return validTeamSortStats.has(normalized) ? normalized : null;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return Number.NaN;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseColumnIndex(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTeamStatFilter(inputFilter = {}) {
  const stat = normalizeTeamSortStat(inputFilter.stat);
  const operator = normalizeTextValue(inputFilter.operator);
  const min = normalizeTextValue(inputFilter.min) || "";
  const max = normalizeTextValue(inputFilter.max) || "";
  const columnIndex = parseColumnIndex(inputFilter.columnIndex);

  if (!stat || !operator || !validTeamStatFilterOperators.has(operator)) {
    return null;
  }

  return {
    stat,
    operator,
    min,
    max,
    value: normalizeTextValue(inputFilter.value) || (operator === "lte" ? (max || min) : min),
    columnIndex,
  };
}

function parseCompactTopTeamsStatFilters(serializedFilters) {
  if (!serializedFilters) {
    return [];
  }

  return serializedFilters
    .split("|")
    .map((segment) => {
      const [stat = "", operator = "", min = "", max = "", columnIndex = ""] = segment.split("~");
      return normalizeTeamStatFilter({ stat, operator, min, max, columnIndex });
    })
    .filter(Boolean);
}

function parseTopTeamsStatFilter(query = {}) {
  return normalizeTeamStatFilter({
    stat: query.tfilterStat,
    operator: query.tfilterOperator,
    min: query.tfilterMin,
    max: query.tfilterMax,
    columnIndex: query.tfilterColumn,
  });
}

function parseTopTeamsStatFilters(query = {}) {
  const serializedFilters = normalizeTextValue(query.tfilters);

  if (serializedFilters) {
    const compactFilters = parseCompactTopTeamsStatFilters(serializedFilters);
    if (compactFilters.length) {
      return compactFilters;
    }

    try {
      const parsed = JSON.parse(serializedFilters);
      const normalized = (Array.isArray(parsed) ? parsed : [parsed])
        .map((filter) => normalizeTeamStatFilter(filter))
        .filter(Boolean);

      if (normalized.length) {
        return normalized;
      }
    } catch (error) {
      // fall back to legacy single-filter query fields
    }
  }

  const legacyFilter = parseTopTeamsStatFilter(query);
  return legacyFilter ? [legacyFilter] : [];
}

function normalizeSelectedTeamFilters(statFilters, statFilter) {
  return Array.isArray(statFilters) && statFilters.length
    ? statFilters
    : statFilter?.stat
      ? [statFilter]
      : [];
}

function resolveAgainstFlag(stat, columnIndex) {
  const index = parseColumnIndex(columnIndex);
  if (index === null) {
    return false;
  }

  const mapped = teamColumnStatMap.get(index);
  if (!mapped || mapped.stat !== stat) {
    return false;
  }

  return mapped.isAgainst;
}

function getTeamSortValue(team, sortStat, sortColumnIndex = null) {
  const stat = normalizeTeamSortStat(sortStat);
  if (!stat || !team) {
    return Number.NaN;
  }

  const simpleReader = simpleTeamStatReaders[stat];
  if (typeof simpleReader === "function") {
    return toFiniteNumber(simpleReader(team));
  }

  const pairedReader = pairedTeamStatReaders[stat];
  if (!pairedReader) {
    return Number.NaN;
  }

  const isAgainst = resolveAgainstFlag(stat, sortColumnIndex);
  const rawValue = isAgainst ? pairedReader.against(team) : pairedReader.for(team);
  return toFiniteNumber(rawValue);
}

function matchesTeamStatFilter(team, filter) {
  if (!filter?.stat || !filter.operator) {
    return true;
  }

  const value = getTeamSortValue(team, filter.stat, filter.columnIndex);
  if (!Number.isFinite(value)) {
    return false;
  }

  const min = Number.parseFloat(filter.min);
  const max = Number.parseFloat(filter.max);
  const target = Number.parseFloat(filter.value ?? filter.min ?? filter.max);

  switch (filter.operator) {
    case "gte":
      return Number.isFinite(min) && value >= min;
    case "lte":
      return Number.isFinite(max) ? value <= max : Number.isFinite(min) && value <= min;
    case "between": {
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return false;
      }

      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      return value >= lower && value <= upper;
    }
    case "eq":
      return Number.isFinite(target) && value === target;
    case "neq":
      return Number.isFinite(target) && value !== target;
    default:
      return true;
  }
}

function sortTeamsByStat(teams, sortStat, sortDirection = defaultTeamSortDirection, sortColumnIndex = null) {
  const stat = normalizeTeamSortStat(sortStat);
  if (!stat) {
    return teams;
  }

  const direction = normalizeTeamSortDirection(sortDirection);

  return [...teams].sort((a, b) => {
    const valueA = getTeamSortValue(a, stat, sortColumnIndex);
    const valueB = getTeamSortValue(b, stat, sortColumnIndex);

    if (!Number.isFinite(valueA) && !Number.isFinite(valueB)) {
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    }

    if (!Number.isFinite(valueA)) {
      return 1;
    }

    if (!Number.isFinite(valueB)) {
      return -1;
    }

    if (valueA === valueB) {
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    }

    return direction === "asc" ? valueA - valueB : valueB - valueA;
  });
}

export function findOrCreateTeam(teams, teamData) {
  let team = teams.find((t) => t.id === teamData.id);
  if (!team) {
    team = new Team(teamData);
    teams.push(team);
  }
  return team;
}

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
  includeAllRounds = false,
  seasonByLeague = null,
) {
  const filterDate = date ? new Date(date) : new Date(2000, 0, 1);

  const completedMatches = registry.matches
    .filter(({ fixture }) => ["FT", "AET", "PEN"].includes(fixture.status.short))
    .map(toStatsMatch);

  const matches = completedMatches.filter((m) => {
    const inLeague = leagueIDs.length === 0 || leagueIDs.includes(m.league.id);
    const selectedSeason = seasonByLeague instanceof Map
      ? seasonByLeague.get(Number(m.league.id))
      : null;
    const inSeason = selectedSeason === null || selectedSeason === undefined
      ? true
      : Number(m.league?.season) === Number(selectedSeason);
    const afterDate = new Date(m.fixture.date) > filterDate;
    const roundName = (m.league?.round || "").toLowerCase();
    const isIncludedRound =
      teamID !== null
        ? true
        : includeAllRounds
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

    return inLeague && inSeason && afterDate && isIncludedRound && hasTeam;
  });

  return buildTeamList(matches);
}

export function getTopTeams(registry, leagues, options = {}) {
  const {
    sortStat = null,
    sortDirection = defaultTeamSortDirection,
    sortColumnIndex = null,
    statFilter = null,
    statFilters = [],
  } = options;
  const leagueIds = Array.isArray(leagues)
    ? leagues.map((id) => Number(id)).filter(Number.isFinite)
    : [];

  const seasonByLeague = new Map(
    (Array.isArray(allDBLeagues) ? allDBLeagues : [])
      .map((league) => [Number(league.id), Number(league.season)]),
  );

  let thisToPTeams = extractTeams(registry, null, leagueIds, null, false, true, seasonByLeague);

  // Fallback when matches have missing/legacy season metadata.
  if (!thisToPTeams.length) {
    thisToPTeams = extractTeams(registry, null, leagueIds, null, false, true);
  }

  thisToPTeams.sort((a, b) =>
    a.last5PerGame.points < b.last5PerGame.points
      ? 1
      : b.last5PerGame.points < a.last5PerGame.points
        ? -1
        : 0,
  );

  const selectedStatFilters = normalizeSelectedTeamFilters(statFilters, statFilter);

  const filteredTeams = selectedStatFilters.length
    ? thisToPTeams.filter((team) => selectedStatFilters.every((filter) => matchesTeamStatFilter(team, filter)))
    : thisToPTeams;

  return sortTeamsByStat(filteredTeams, sortStat, sortDirection, sortColumnIndex);
}

export function getTopTeamsPageData(registry, selectedLeague = [], query = {}) {
  const selectedSortStat = normalizeTeamSortStat(query.tsort);
  const selectedSortDirection = normalizeTeamSortDirection(query.tdir);
  const selectedSortColumnIndex = parseColumnIndex(query.tcol);
  const selectedStatFilters = parseTopTeamsStatFilters(query);

  const teams = getTopTeams(registry, selectedLeague, {
    sortStat: selectedSortStat,
    sortDirection: selectedSortDirection,
    sortColumnIndex: selectedSortColumnIndex,
    statFilters: selectedStatFilters,
  });

  return {
    teams,
    selectedSortStat,
    selectedSortDirection,
    selectedSortColumnIndex,
    selectedStatFilter: selectedStatFilters[0] || null,
    selectedStatFilters,
  };
}

export function getTeamById(teamID) {
  return allDBTeams.find((team) => Number(team.ID) === Number(teamID)) || null;
}

export async function getTeamPageData(registry, teamID) {
  const selectedTeamID = Number(teamID);
  const fullTeamList = extractTeams(registry, null, [], selectedTeamID);
  let teamStats = fullTeamList.filter((team) => Number(team.id) === selectedTeamID);
  const matches = (await allTeamMatches(registry, selectedTeamID, null, false))
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

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
  const { squad: savedSquad, squadUpdatedAt, transferUpdatedAt } = await getSquadFromDb(teamID);
  const showAllPlayerStats = parseShowAllPlayerStats(allStatsQuery);

  const latestMatch = matches.length ? matches[matches.length - 1] : null;
  const latestLeagueID = Number(latestMatch?.league?.id);
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
    squadUpdatedAt,
    transferUpdatedAt,
  };
}