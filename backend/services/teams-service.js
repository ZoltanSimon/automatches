import { buildTeamList } from "./json-reader.js";
import { allDBLeagues, allDBTeams } from "../lib/catalog.js";
import { allTeamMatches, getTeamEloMonthSummary, summarizeTeamElo } from "./matches-service.js";
import { Team } from "../../classes/team.js";
import { memoizeRegistryStat } from "./registry-stats.js";
import { isNeutralVenue } from "../lib/elo.js";

const defaultTeamSortDirection = "desc";
const validTeamSortStats = new Set([
  "played",
  "elo",
  "avgRating",
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
  elo: (team) => team.elo,
  avgRating: (team) => team.total?.avgRating,
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
  [8, { stat: "goals", isAgainst: false }],
  [9, { stat: "goals", isAgainst: true }],
  [10, { stat: "xG", isAgainst: false }],
  [11, { stat: "xG", isAgainst: true }],
  [12, { stat: "corners", isAgainst: false }],
  [13, { stat: "corners", isAgainst: true }],
  [14, { stat: "shotsOnGoal", isAgainst: false }],
  [15, { stat: "shotsOnGoal", isAgainst: true }],
  [16, { stat: "fouls", isAgainst: false }],
  [17, { stat: "fouls", isAgainst: true }],
  [18, { stat: "yellowCards", isAgainst: false }],
  [19, { stat: "yellowCards", isAgainst: true }],
  [20, { stat: "redCards", isAgainst: false }],
  [21, { stat: "redCards", isAgainst: true }],
  [22, { stat: "offsides", isAgainst: false }],
  [23, { stat: "offsides", isAgainst: true }],
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

function copyStats(stats) {
  return stats ? Object.assign(Object.create(Object.getPrototypeOf(stats)), stats) : stats;
}

export function copyTeam(team) {
  return Object.assign(Object.create(Object.getPrototypeOf(team)), team, {
    total: copyStats(team.total),
    perGame: copyStats(team.perGame),
    last5: copyStats(team.last5),
    last5PerGame: copyStats(team.last5PerGame),
    leagues: new Map(team.leagues),
    leagueBreakdown: [...(team.leagueBreakdown || [])],
    matches: [...team.matches],
    formArray: [...(team.formArray || [])],
  });
}

function getSharedTeams(
  registry,
  date,
  leagueIDs = [],
  teamID = null,
  includeGroupStageOnly = false,
  includeAllRounds = false,
  seasonByLeague = null,
) {
  const key = `teams:${JSON.stringify([
    date ?? null,
    [...leagueIDs].sort(),
    teamID,
    Boolean(includeGroupStageOnly),
    Boolean(includeAllRounds),
    seasonByLeague instanceof Map ? [...seasonByLeague] : null,
  ])}`;

  return memoizeRegistryStat(registry, key, () => buildTeamsFromRegistry(
    registry,
    date,
    leagueIDs,
    teamID,
    includeGroupStageOnly,
    includeAllRounds,
    seasonByLeague,
  ));
}

export function extractTeams(...args) {
  return getSharedTeams(...args).map(copyTeam);
}

// Shared across requests: read through getAllCompetitionTeam, which returns a copy.
export function getAllCompetitionTeamsByID(registry) {
  return memoizeRegistryStat(registry, "teams:all-competitions", () => new Map(
    getSharedTeams(registry, null, [], null, false, true).map((team) => [Number(team.id), team]),
  ));
}

export function getAllCompetitionTeam(registry, teamID) {
  const normalizedTeamID = Number(teamID);
  if (!Number.isFinite(normalizedTeamID)) {
    return null;
  }

  const team = getAllCompetitionTeamsByID(registry).get(normalizedTeamID);
  return team ? copyTeam(team) : null;
}

function buildTeamsFromRegistry(
  registry,
  date,
  leagueIDs,
  teamID,
  includeGroupStageOnly,
  includeAllRounds,
  seasonByLeague,
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

function attachClubElo(teams, eloByTeamId) {
  if (!Array.isArray(teams)) {
    return teams;
  }

  for (const team of teams) {
    const ratings = eloByTeamId instanceof Map
      ? eloByTeamId.get(Number(team.id))
      : null;
    const elo = Number(ratings?.club);
    team.elo = Number.isFinite(elo) ? Math.round(elo) : null;
  }

  return teams;
}

function compareTopTeams(a, b) {
  const pointsA = Number(a.last5?.points) || 0;
  const pointsB = Number(b.last5?.points) || 0;
  if (pointsA !== pointsB) {
    return pointsB - pointsA;
  }

  const eloA = Number(a.elo);
  const eloB = Number(b.elo);
  const aHasElo = Number.isFinite(eloA);
  const bHasElo = Number.isFinite(eloB);

  if (aHasElo && bHasElo && eloA !== eloB) {
    return eloB - eloA;
  }
  if (aHasElo !== bHasElo) {
    return aHasElo ? -1 : 1;
  }

  return String(a?.name || "").localeCompare(String(b?.name || ""));
}

export function getTopTeams(registry, leagues, options = {}) {
  const {
    sortStat = null,
    sortDirection = defaultTeamSortDirection,
    sortColumnIndex = null,
    statFilter = null,
    statFilters = [],
    eloByTeamId = null,
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

  attachClubElo(thisToPTeams, eloByTeamId);
  thisToPTeams.sort(compareTopTeams);

  const selectedStatFilters = normalizeSelectedTeamFilters(statFilters, statFilter);

  const filteredTeams = selectedStatFilters.length
    ? thisToPTeams.filter((team) => selectedStatFilters.every((filter) => matchesTeamStatFilter(team, filter)))
    : thisToPTeams;

  return sortTeamsByStat(filteredTeams, sortStat, sortDirection, sortColumnIndex);
}

export function getTopTeamsPageData(registry, selectedLeague = [], query = {}, eloByTeamId = null) {
  const selectedSortStat = normalizeTeamSortStat(query.tsort);
  const selectedSortDirection = normalizeTeamSortDirection(query.tdir);
  const selectedSortColumnIndex = parseColumnIndex(query.tcol);
  const selectedStatFilters = parseTopTeamsStatFilters(query);

  const teams = getTopTeams(registry, selectedLeague, {
    sortStat: selectedSortStat,
    sortDirection: selectedSortDirection,
    sortColumnIndex: selectedSortColumnIndex,
    statFilters: selectedStatFilters,
    eloByTeamId,
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

const ageGroupNationalSidePattern = /(?:^|\s)U\d{2}(?:\s|$)/i;

export function isAgeGroupNationalSide(name) {
  return ageGroupNationalSidePattern.test(String(name || "").trim());
}

export function getTeamById(teamID) {
  return allDBTeams.find((team) => Number(team.ID) === Number(teamID)) || null;
}

const HOME_STADIUM_SAMPLE_SIZE = 10;

function newestMatchesFirst(matches) {
  return [...matches].sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
}

// Most used venue of the latest home matches, so one-off grounds don't win and a stadium move is picked up.
export function getTeamHomeStadium(matches, teamID) {
  const venueCounts = new Map();
  const recentHomeMatches = newestMatchesFirst(matches)
    .filter((match) => (
      Number(match.teams?.home?.id) === Number(teamID)
      && match.fixture?.venue?.name
      && !isNeutralVenue(match, match.league, match.league?.round)
    ))
    .slice(0, HOME_STADIUM_SAMPLE_SIZE);

  for (const match of recentHomeMatches) {
    const venue = match.fixture.venue.name;
    venueCounts.set(venue, (venueCounts.get(venue) || 0) + 1);
  }

  let stadium = null;
  let stadiumCount = 0;
  for (const [venue, count] of venueCounts) {
    if (count > stadiumCount) {
      stadium = venue;
      stadiumCount = count;
    }
  }

  return stadium;
}

export function getTeamManager(matches, teamID) {
  for (const match of newestMatchesFirst(matches)) {
    const lineups = Array.isArray(match.lineups) ? match.lineups : [];
    const lineup = lineups.find((entry) => Number(entry?.team?.id) === Number(teamID));
    if (lineup?.coach?.name) {
      return lineup.coach.name;
    }
  }

  return null;
}

// Teams have no country of their own, so use their domestic competitions, leagues before cups.
export function getTeamNation(matches) {
  const domesticCompetitions = newestMatchesFirst(matches)
    .map((match) => allDBLeagues.find((league) => Number(league.id) === Number(match.league?.id)))
    .filter((league) => Number(league?.nation));
  const competition = domesticCompetitions.find((league) => league.type === "league") ?? domesticCompetitions[0];

  return competition ? getTeamById(competition.nation) : null;
}

export async function getTeamPageData(registry, teamID) {
  const selectedTeamID = Number(teamID);
  const allCompetitionTeam = getAllCompetitionTeam(registry, selectedTeamID);
  let teamStats = allCompetitionTeam ? [allCompetitionTeam] : [];
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

  nameTeamCompetitions(teamStats[0]);

  return { matches, teamStats };
}

function withLeagueName(league) {
  const leagueFromDb = allDBLeagues.find((dbLeague) => Number(dbLeague.id) === Number(league.id));

  return {
    ...league,
    name: league.name || leagueFromDb?.name || `Competition ${league.id}`,
  };
}

// Turns a team's leagues into a named list and sorts its per-competition breakdown, most played first.
export function nameTeamCompetitions(team) {
  team.leagues = [...team.leagues.values()].map(withLeagueName);
  team.leagueBreakdown = (team.leagueBreakdown || [])
    .map(withLeagueName)
    .sort((a, b) => b.played - a.played);
  return team;
}

function parseShowAllPlayerStats(allStatsQuery) {
  const value = String(allStatsQuery || "").trim().toLowerCase();
  return value === "1" || value === "true";
}

export async function getTeamRouteData(registry, teamID, allStatsQuery) {
  const { getMatchEloRowsByIds, getSquadFromDb } = await import("../data-access.js");
  const { getTeamPlayerList } = await import("./players-service.js");
  const { eloScopeFromTeam } = await import("../lib/elo.js");

  const { matches, teamStats } = await getTeamPageData(registry, teamID);
  if (teamStats.length) {
    const newestFirst = [...teamStats[0].matches].sort((a, b) => new Date(b.date) - new Date(a.date));
    const eloByMatchId = await getMatchEloRowsByIds(newestFirst.map((match) => match.id));
    const now = new Date();
    const nextMatch = matches.find(({ fixture }) =>
      ["NS", "TBD"].includes(fixture.status?.short) && new Date(fixture.date) >= now);
    Object.assign(
      teamStats[0],
      summarizeTeamElo(newestFirst, teamStats[0].id, eloByMatchId),
      {
        lastPlayedDate: newestFirst[0]?.date ?? null,
        nextMatchDate: nextMatch?.fixture.date ?? null,
      },
    );
  }
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

  // Everyone level on most goals for this team across all competitions, from the current squad when it is saved.
  const squadPlayers = getTeamPlayerList(registry, teamID, savedSquad, 1000, []);
  const topGoals = Math.max(0, ...squadPlayers.map((player) => Number(player.goals) || 0));
  const teamTopScorers = topGoals > 0
    ? squadPlayers.filter((player) => Number(player.goals) === topGoals)
    : [];

  const team = getTeamById(teamID);
  const eloScope = eloScopeFromTeam(team);
  const eloMonthChange = await getTeamEloMonthSummary(teamID, eloScope);

  return {
    matches,
    teamStats,
    teamPlayers,
    showAllPlayerStats,
    selectedPlayerStatsLeague,
    selectedPlayerStatsLeagueName,
    squadUpdatedAt,
    transferUpdatedAt,
    eloMonthChange,
    teamStadium: getTeamHomeStadium(matches, teamID),
    teamManager: getTeamManager(matches, teamID),
    teamNation: eloScope === "nt" ? null : getTeamNation(matches),
    teamTopScorers,
    topGoals,
    isNationalTeam: eloScope === "nt",
  };
}