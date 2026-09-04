import {
    getAllPlayers,
    readPlayersFromFiles,
  } from "./../json-reader.js";
import {
  getPlayersMissingExtraData,
  getTransferPlayersForInsert,
  insertPlayersToDb,
  updatePlayerProfilesInDb,
} from "./../data-access.js";
import { Player } from "./../../classes/player.js";
import { allDBLeagues, allDBPlayers } from "../catalog.js";
import { LineupParser } from "../../classes/lineupparser.js";
import { comparePositionsByDisplayOrder, parseLowercaseStringList, wait } from "../backend-helper.js";
import { getTeamById } from "./teams-service.js";
import { parseLeagueIds } from "./leagues-service.js";
import * as fs from "fs";

export function startPlayerFetchJob(playersFetchJob, {
  baseQuery,
  dataDir,
  getPlayersFn,
  maxRuns,
  intervalMs = 10000,
}) {
  const playersDir = `${dataDir}players`;
  if (!fs.existsSync(playersDir)) {
    fs.mkdirSync(playersDir, { recursive: true });
  }

  console.log(
    `[get-players] Starting background fetch loop at page ${playersFetchJob.nextPage}. Interval: ${intervalMs / 1000}s. Max runs: ${maxRuns}.`
  );

  void (async () => {
    let completedRuns = 0;

    while (playersFetchJob.running && completedRuns < maxRuns) {
      const page = playersFetchJob.nextPage;
      const startedAt = new Date().toISOString();

      try {
        console.log(`[get-players] Fetching page ${page} at ${startedAt}`);
        const players = await getPlayersFn({ ...baseQuery, page });
        const filename = `${playersDir}/players${page}.json`;
        fs.writeFileSync(filename, JSON.stringify(players, null, 2));

        const resultCount = typeof players?.results === "number"
          ? players.results
          : Array.isArray(players?.response)
            ? players.response.length
            : "unknown";

        console.log(
          `[get-players] Saved page ${page} -> ${filename} (results: ${resultCount})`
        );

        playersFetchJob.nextPage += 1;
        completedRuns += 1;
      } catch (error) {
        console.error(`[get-players] Error on page ${page}:`, error);
        playersFetchJob.running = false;
        break;
      }

      if (playersFetchJob.running && completedRuns < maxRuns) {
        await wait(intervalMs);
      }
    }

    if (completedRuns >= maxRuns && playersFetchJob.running) {
      playersFetchJob.running = false;
      console.log(
        `[get-players] Reached max runs (${maxRuns}) for this start request. Next page is ${playersFetchJob.nextPage}.`
      );
    }

    console.log(
      `[get-players] Background loop stopped. Next page is ${playersFetchJob.nextPage}.`
    );
  })();
}

function getTeamName(id) {
  return getTeamById(id)?.name || "";
}

function getMatchesByLeagueFilter(registry, leagueFilter = []) {
  return leagueFilter.length > 0
    ? registry.matches.filter((match) => leagueFilter.includes(match.league.id))
    : registry.matches;
}

const defaultPlayerSortStat = "goals";
const validStatFilterOperators = new Set(["gte", "lte", "between", "eq", "neq"]);

function normalizeTextValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSortDirection(direction) {
  return String(direction || "desc").toLowerCase() === "asc" ? "asc" : "desc";
}

function normalizeSortStat(stat) {
  return normalizeTextValue(stat) || defaultPlayerSortStat;
}

function normalizePlayerStatFilter(inputFilter = {}) {
  const stat = normalizeTextValue(inputFilter.stat);
  const operator = normalizeTextValue(inputFilter.operator);
  const min = normalizeTextValue(inputFilter.min);
  const max = normalizeTextValue(inputFilter.max);

  if (!stat || !validStatFilterOperators.has(operator)) {
    return null;
  }

  return {
    stat,
    operator,
    min,
    max,
    value: normalizeTextValue(inputFilter.value) || (operator === "lte" ? (max || min) : min),
  };
}

function parseCompactTopPlayersStatFilters(serializedFilters) {
  if (!serializedFilters) {
    return [];
  }

  return serializedFilters
    .split("|")
    .map((segment) => {
      const [stat = "", operator = "", min = "", max = ""] = segment.split("~");
      return normalizePlayerStatFilter({ stat, operator, min, max });
    })
    .filter(Boolean);
}

function parseTopPlayersStatFilter(query = {}) {
  return normalizePlayerStatFilter({
    stat: query.pfilterStat,
    operator: query.pfilterOperator,
    min: query.pfilterMin,
    max: query.pfilterMax,
  });
}

function parseTopPlayersStatFilters(query = {}) {
  const serializedFilters = normalizeTextValue(query.pfilters);

  if (serializedFilters) {
    const compactFilters = parseCompactTopPlayersStatFilters(serializedFilters);
    if (compactFilters.length) {
      return compactFilters;
    }

    try {
      const parsed = JSON.parse(serializedFilters);
      const normalized = (Array.isArray(parsed) ? parsed : [parsed])
        .map((filter) => normalizePlayerStatFilter(filter))
        .filter(Boolean);

      if (normalized.length) {
        return normalized;
      }
    } catch (error) {
      // fall back to legacy single filter fields
    }
  }

  const legacyFilter = parseTopPlayersStatFilter(query);
  return legacyFilter ? [legacyFilter] : [];
}

function createPlayerWithResolvedTeamNames(inputPlayer) {
  const player = new Player(inputPlayer);
  player.clubName = getTeamName(player.club);
  player.nationName = getTeamName(player.nation);
  return player;
}

function toPositionList(positionValue = "") {
  return parseLowercaseStringList(positionValue);
}

function parsePlayerStatValue(value) {
  if (value === null || value === undefined || value === "") {
    return Number.NaN;
  }

  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value).replace(/%/g, "").replace(/,/g, "").trim();
  const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (numericMatch) {
    return Number.parseFloat(numericMatch[0]);
  }

  return normalized.toLowerCase();
}

function comparePlayerStatValues(a, b) {
  const aIsNumber = Number.isFinite(a);
  const bIsNumber = Number.isFinite(b);

  if (aIsNumber && bIsNumber) {
    return a - b;
  }

  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

function getPlayerSortValue(player, statName) {
  if (!statName) {
    return parsePlayerStatValue(player.goals);
  }

  const normalizedStat = String(statName).trim();
  if (normalizedStat === "name") {
    return String(player.name || "").toLowerCase();
  }

  return parsePlayerStatValue(player[normalizedStat]);
}

function matchesPlayerStatFilter(player, filter) {
  if (!filter?.stat || !filter.operator) {
    return true;
  }

  const value = getPlayerSortValue(player, filter.stat);
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
      return Number.isFinite(target) && Math.abs(value - target) < 0.0001;
    case "neq":
      return Number.isFinite(target) && Math.abs(value - target) >= 0.0001;
    default:
      return true;
  }
}

function sortPlayersByStat(players, sortStat = "goals", sortDirection = "desc") {
  const direction = normalizeSortDirection(sortDirection) === "asc" ? 1 : -1;
  const tieBreakers = sortStat === "goals"
    ? ["rating", "apps", "name"]
    : ["goals", "rating", "apps", "name"];

  return [...players].sort((playerA, playerB) => {
    const sortValueA = getPlayerSortValue(playerA, sortStat);
    const sortValueB = getPlayerSortValue(playerB, sortStat);
    const primaryDiff = comparePlayerStatValues(sortValueA, sortValueB);

    if (primaryDiff !== 0) {
      return primaryDiff * direction;
    }

    for (const tieBreaker of tieBreakers) {
      const tieValueA = getPlayerSortValue(playerA, tieBreaker);
      const tieValueB = getPlayerSortValue(playerB, tieBreaker);
      const tieDiff = comparePlayerStatValues(tieValueA, tieValueB);

      if (tieDiff !== 0) {
        return tieDiff * -1;
      }
    }

    return String(playerA.name || "").localeCompare(String(playerB.name || ""), undefined, { sensitivity: "base" });
  });
}

export function parseSelectedPositions(positionQuery) {
  if (!positionQuery) {
    return [];
  }

  return parseLowercaseStringList(positionQuery, true);
}

export function buildPositionOptions() {
  const allPositions = LineupParser.formations.flatMap((formation) => formation.positions);
  const uniquePositions = [...new Set(allPositions)].sort(comparePositionsByDisplayOrder);

  return uniquePositions.map((position) => ({
    value: position.toLowerCase(),
    label: position,
  }));
}

export function getPlayerList(
  registry,
  nr = 10,
  teamFilter = "",
  leagueFilter = [],
  positionFilter = [],
  options = {},
) {
  const {
    sortStat = defaultPlayerSortStat,
    sortDirection = "desc",
    statFilter = null,
    statFilters = [],
    appearedForTeamID = null,
  } = options;
  const playerMap = new Map();
  const normalizedAppearedForTeamID = Number(appearedForTeamID);
  const hasAppearedForTeamFilter = appearedForTeamID != null && appearedForTeamID !== "" && Number.isFinite(normalizedAppearedForTeamID);

  const matches = getMatchesByLeagueFilter(registry, leagueFilter);

  for (const match of matches) {
    const { players: matchPlayers } = match;
    if (!Array.isArray(matchPlayers) || matchPlayers.length < 2) continue;

    for (const team of matchPlayers) {
      if (hasAppearedForTeamFilter && Number(team?.team?.id) !== normalizedAppearedForTeamID) {
        continue;
      }

      for (const player of team.players || []) {
        const playerID = player.player.id;

        if (playerMap.has(playerID)) {
          playerMap.get(playerID).getPlayerStats(player, match.league);
        } else {
          const inputPlayer = getPlayerByID(playerID);
          if (!inputPlayer) {
            //console.error(`Player with ID ${playerID} not found.`);
            continue;
          }
          const thisPlayer = createPlayerWithResolvedTeamNames(inputPlayer);
          thisPlayer.getPlayerStats(player, match.league);
          playerMap.set(playerID, thisPlayer);
        }
      }
    }
  }

  let players = [...playerMap.values()]
    .filter(p => p.apps >= 1)
    .sort((a, b) => b.rating - a.rating)
    .sort((a, b) => b.goals - a.goals);

  if (teamFilter && !hasAppearedForTeamFilter) {
    const normalizedTeamFilter = Number(teamFilter);
    players = players.filter((player) => {
      const clubID = Number(player.club);
      const nationID = Number(player.nation);

      if (Number.isFinite(normalizedTeamFilter)) {
        return clubID === normalizedTeamFilter || nationID === normalizedTeamFilter;
      }

      return String(player.club) === String(teamFilter) || String(player.nation) === String(teamFilter);
    });
  }

  if (positionFilter.length) {
    const selectedPositions = parseLowercaseStringList(positionFilter);
    players = players.filter((player) => {
      const playerPositions = toPositionList(player.position);
      return playerPositions.some((position) => selectedPositions.includes(position));
    });
  }

  const selectedStatFilters = Array.isArray(statFilters) && statFilters.length
    ? statFilters
    : statFilter?.stat
      ? [statFilter]
      : [];

  const filteredPlayers = selectedStatFilters.length
    ? players.filter((player) => selectedStatFilters.every((filter) => matchesPlayerStatFilter(player, filter)))
    : players;

  return sortPlayersByStat(
    filteredPlayers,
    normalizeSortStat(sortStat),
    normalizeSortDirection(sortDirection),
  ).slice(0, nr);
}

export function getTopPlayersPageData(registry, query = {}) {
  const selectedLeague = parseLeagueIds(query.pleague);
  const selectedPositions = parseSelectedPositions(query.pposition);
  const selectedSortStat = normalizeSortStat(query.psort);
  const selectedSortDirection = normalizeSortDirection(query.pdir);
  const selectedStatFilters = parseTopPlayersStatFilters(query);
  const teamQuery = query.team;

  const players = getPlayerList(
    registry,
    500,
    teamQuery,
    selectedLeague,
    selectedPositions,
    {
      sortStat: selectedSortStat,
      sortDirection: selectedSortDirection,
      statFilters: selectedStatFilters,
    },
  );

  return {
    players,
    selectedLeague,
    selectedPositions,
    selectedSortStat,
    selectedSortDirection,
    selectedStatFilter: selectedStatFilters[0] || null,
    selectedStatFilters,
  };
}

function createFallbackPlayerFromSquadEntry(squadEntry, teamID) {
  const squadPlayerID = Number(squadEntry?.id ?? squadEntry?.player?.id);
  if (!Number.isFinite(squadPlayerID)) {
    return null;
  }

  const dbPlayer = getPlayerByID(squadPlayerID);
  const fallbackPosition = squadEntry?.position || "";
  const inputPlayer = dbPlayer || {
    id: squadPlayerID,
    name: squadEntry?.name || squadEntry?.player?.name || `Player ${squadPlayerID}`,
    club: Number(teamID),
    nation: 0,
    position: fallbackPosition,
  };

  const player = createPlayerWithResolvedTeamNames(inputPlayer);
  if (!player.position && fallbackPosition) {
    player.position = fallbackPosition;
  }
  player.club = Number(teamID);
  player.clubName = getTeamName(player.club);

  return player;
}

export function getTeamPlayerList(registry, teamID, squad = null, nr = 100, leagueFilter = []) {
  const normalizedTeamID = Number(teamID);
  const playersWithStats = getPlayerList(registry, 1000, "", leagueFilter, [], {
    appearedForTeamID: normalizedTeamID,
  });
  const squadPlayers = Array.isArray(squad?.players) && squad.players.length > 0
    ? squad.players
    : null;

  if (!squadPlayers) {
    return playersWithStats.slice(0, nr);
  }

  const statsByPlayerID = new Map(
    playersWithStats.map((player) => [Number(player.id), player]),
  );
  const mergedPlayers = [];
  const seenPlayerIDs = new Set();

  for (const squadEntry of squadPlayers) {
    const squadPlayerID = Number(squadEntry?.id ?? squadEntry?.player?.id);
    if (!Number.isFinite(squadPlayerID) || seenPlayerIDs.has(squadPlayerID)) {
      continue;
    }

    const playerWithStats = statsByPlayerID.get(squadPlayerID);
    if (playerWithStats) {
      mergedPlayers.push(playerWithStats);
      seenPlayerIDs.add(squadPlayerID);
      continue;
    }

    const fallbackPlayer = createFallbackPlayerFromSquadEntry(squadEntry, normalizedTeamID);
    if (fallbackPlayer) {
      mergedPlayers.push(fallbackPlayer);
      seenPlayerIDs.add(squadPlayerID);
    }
  }

  mergedPlayers.sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.apps !== a.apps) return b.apps - a.apps;
    return String(a.name).localeCompare(String(b.name));
  });

  return mergedPlayers.slice(0, nr);
}

export async function insertAllPlayers() {
  const allPlayers = await getAllPlayers(
    allDBLeagues.filter((el) => el.type == "league").concat(allDBLeagues.filter((el) => el.type == "cup")),
    allDBLeagues.filter((el) => el.type == "nt")
  );

  const transferPlayers = await getTransferPlayersForInsert();
  const playersById = new Map();

  for (const player of allPlayers) {
    const playerID = Number(player?.id);
    if (!Number.isFinite(playerID)) {
      continue;
    }

    playersById.set(playerID, player);
  }

  let addedFromTransfers = 0;
  for (const transferPlayer of transferPlayers) {
    const playerID = Number(transferPlayer?.id);
    if (!Number.isFinite(playerID)) {
      continue;
    }

    if (!playersById.has(playerID)) {
      playersById.set(playerID, transferPlayer);
      addedFromTransfers += 1;
    } else if (transferPlayer.club) {
      // Transfer data reflects the most recent club; override match-derived club
      playersById.get(playerID).club = transferPlayer.club;
    }
  }

  const playersToInsert = [...playersById.values()];

  await insertPlayersToDb(playersToInsert);
  const playersMissingExtraData = await getPlayersMissingExtraData();

  console.log(
    `[insertAllPlayers] Added ${addedFromTransfers} player(s) from transfers. Players with no extra data: ${playersMissingExtraData.length}.`,
  );

  return {
    insertedCandidates: playersToInsert.length,
    transferCandidates: transferPlayers.length,
    addedFromTransfers,
    playersMissingExtraData,
    playersMissingExtraDataCount: playersMissingExtraData.length,
  };
}

export async function updatePlayerProfilesFromFiles() {
  console.log("[updatePlayerProfilesFromFiles] Reading player files and updating Player table.");
  const playersFromFiles = await readPlayersFromFiles();
  const result = await updatePlayerProfilesInDb(playersFromFiles);
  console.log("[updatePlayerProfilesFromFiles] Update finished:", result);
  return result;
}

export function getPlayerByID(playerID) {
  return allDBPlayers.find((element) => element.id == playerID);
}

/**
 * Return aggregated stats for a single player plus list of matches where he appeared.
 * leagueFilter may be an array of league IDs to restrict the registry.
 */
export function getPlayerDetails(registry, playerID, leagueFilter = []) {
  const inputPlayer = getPlayerByID(playerID);
  if (!inputPlayer) return null;

  const playerObj = createPlayerWithResolvedTeamNames(inputPlayer);

  const filteredMatches = getMatchesByLeagueFilter(registry, leagueFilter);

  const matches = [];

  for (const match of filteredMatches) {
    const matchPlayers = Array.isArray(match.players) ? match.players : [];
    if (!matchPlayers.length) {
      continue;
    }

    // each match has two teams in match.players when player statistics are available
    for (const team of matchPlayers) {
      for (const p of team.players) {
        if (p.player.id == playerID) {
          const minutesPlayed = Number(p.statistics?.[0]?.games?.minutes || 0);
          if (minutesPlayed <= 0) {
            break;
          }

          playerObj.getPlayerStats(p, match.league);
          // Only keep fixture, league, teams, goals, and statistics of the given player
          matches.push({
            fixture: match.fixture,
            league: match.league,
            teams: match.teams,
            goals: match.goals,
            statistics: p.statistics[0]
          });
          // break out once we found the player in this match
          break;
        }
      }
    }
  }

  matches.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  return { player: playerObj, matches };
}

export function getPlayerPageData(registry, playerID, leagueQuery) {
  const hasPlayerID = playerID !== undefined && playerID !== null && String(playerID).trim() !== "";

  if (!hasPlayerID) {
    const selectedLeague = parseLeagueIds(leagueQuery, { fallback: [], unique: false });

    return {
      players: getPlayerList(registry, 10, "", selectedLeague),
      selectedLeague,
    };
  }

  const allDetails = getPlayerDetails(registry, playerID, []);
  if (!allDetails) {
    return null;
  }

  const availableLeagueIds = allDetails.player.competitionList.map((competition) => competition.id);
  const hasLeagueQuery = leagueQuery !== undefined;
  const requestedLeagueIds = hasLeagueQuery
    ? parseLeagueIds(leagueQuery, { fallback: [], unique: true })
    : availableLeagueIds;
  const filteredLeagueIds = requestedLeagueIds.filter((leagueId) => availableLeagueIds.includes(leagueId));
  const selectedLeague = filteredLeagueIds.length > 0 ? filteredLeagueIds : availableLeagueIds;
  const details = getPlayerDetails(registry, playerID, selectedLeague);

  return {
    details,
    leagues: allDetails.player.competitionList || [],
    selectedLeague,
  };
}