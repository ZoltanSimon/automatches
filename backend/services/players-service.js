import {
    getAllPlayers,
    readPlayersFromFiles,
    writePlayerToServer,
  } from "./json-reader.js";
import {
  getPlayersMissingExtraData,
  getTransferPlayersForInsert,
  insertPlayersToDb,
  loadPlayerById,
  markTeamTransfersUpdated,
  saveSquadToDb,
  saveTransfersToDb,
  updatePlayerProfilesInDb,
} from "../data-access.js";
import { Player } from "./../../classes/player.js";
import { allDBLeagues, allDBPlayers, upsertCatalogPlayer } from "../lib/catalog.js";
import { getPlayersFromApi, getSquad as getSquadFromApi, getTransfersByPlayer, getTransfersByTeam, hasApiErrors } from "../api/webapi-handler.js";
import { LineupParser } from "../../classes/lineupparser.js";
import { abbreviatePlayerPosition, comparePositionsByDisplayOrder, formatPlayerPosition, parseLowercaseStringList, wait } from "../lib/backend-helper.js";
import { getTeamById, isAgeGroupNationalSide } from "./teams-service.js";
import { parseLeagueIds } from "./leagues-service.js";
import { memoizeRegistryStat } from "./registry-stats.js";
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
    try {
      fs.mkdirSync(playersDir);
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
    }
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

const defaultPlayerSortStat = "goals";
const validStatFilterOperators = new Set(["gte", "lte", "between", "eq", "neq", "in"]);

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
  const nationName = getTeamName(player.nation);
  if (isAgeGroupNationalSide(nationName)) {
    player.nation = 0;
    player.nationName = "";
  } else {
    player.nationName = nationName;
  }
  return player;
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

const textPositionStats = new Set(["position", "secondaryPosition"]);
const starterRoleCache = new WeakMap();

function starterRolesForMatch(match) {
  if (!match || typeof match !== "object") {
    return new Map();
  }

  if (starterRoleCache.has(match)) {
    return starterRoleCache.get(match);
  }

  const roles = LineupParser.starterRolesByPlayerId(match.lineups);
  starterRoleCache.set(match, roles);
  return roles;
}

function splitPositionNames(positionValue) {
  return formatPlayerPosition(positionValue)
    .split(",")
    .map((position) => position.trim())
    .filter(Boolean);
}

function finalizePlayerPositions(player) {
  const storedParts = splitPositionNames(player.position);
  let primary = storedParts[0] || "";
  let secondary = storedParts[1] || "";

  if (!primary) {
    const fallback = (player.exactPositions || [])
      .map((position) => formatPlayerPosition(position))
      .filter(Boolean);
    primary = fallback[0] || "";
    if (!secondary) {
      secondary = fallback[1] || "";
    }
  }

  if (!secondary) {
    const primaryKey = primary.toLowerCase();
    const rankedRoles = Object.entries(player.lineupRoleCounts || {})
      .filter(([role, count]) => role && role !== "Unknown" && count > 0)
      .sort((roleA, roleB) => roleB[1] - roleA[1] || comparePositionsByDisplayOrder(roleA[0], roleB[0]));
    const nextRole = rankedRoles.find(([role]) => formatPlayerPosition(role).toLowerCase() !== primaryKey)?.[0] || "";
    secondary = formatPlayerPosition(nextRole);
  }

  if (secondary.toLowerCase() === primary.toLowerCase()) {
    secondary = "";
  }

  player.position = primary;
  player.secondaryPosition = secondary;
  player.positionName = primary;
  player.secondaryPositionName = secondary;
  player.displayPosition = abbreviatePlayerPosition(primary);
  player.displaySecondaryPosition = abbreviatePlayerPosition(secondary);
}

function recordLineupRole(player, role) {
  if (!player || !role || role === "Unknown") {
    return;
  }

  player.lineupRoleCounts[role] = (player.lineupRoleCounts[role] || 0) + 1;
}

function copyPlayer(player, overrides = {}) {
  return Object.assign(Object.create(Object.getPrototypeOf(player)), player, {
    exactPositions: [...player.exactPositions],
    lineupRoleCounts: { ...player.lineupRoleCounts },
    competitionList: [...player.competitionList],
    ...overrides,
  });
}

function createPlayerCell(basePlayer, playerID, leagueID, teamID, matchIndex) {
  return {
    playerID,
    leagueID,
    teamID,
    firstMatchIndex: matchIndex,
    // Registry match indexes, so merged cells keep the order a single match walk would produce.
    positionMatchIndexes: [],
    competitionMatchIndex: -1,
    shirtNumberMatchIndex: -1,
    // Float sums depend on order; merged ratings are re-added in match order to round like a single walk.
    ratings: [],
    player: copyPlayer(basePlayer),
  };
}

function addAppearanceToCell(cell, playerEntry, match, matchIndex, starterRoles) {
  const { player } = cell;
  const positionCount = player.exactPositions.length;
  const competitionCount = player.competitionList.length;
  const ratedAppsCount = player.ratedApps;

  player.getPlayerStats(playerEntry, match.league);

  if (player.ratedApps > ratedAppsCount) {
    cell.ratings.push({ matchIndex, rating: Number.parseFloat(playerEntry.statistics[0].games.rating) });
  }
  if (player.exactPositions.length > positionCount) {
    cell.positionMatchIndexes.push(matchIndex);
  }
  if (player.competitionList.length > competitionCount) {
    cell.competitionMatchIndex = matchIndex;
  }
  if (playerEntry.statistics?.[0]?.games?.number) {
    cell.shirtNumberMatchIndex = matchIndex;
  }

  recordLineupRole(player, starterRoles.get(Number(cell.playerID)));
}

/**
 * One pass over the registry: per-(player, league, team) stat cells for player lists,
 * and per-player appearance rows for player pages.
 */
function buildPlayerIndex(registry) {
  const catalogPlayers = new Map(allDBPlayers.map((player) => [Number(player.id), player]));
  const basePlayers = new Map();
  const cells = [];
  const cellsByKey = new Map();
  const cellsByLeague = new Map();
  const cellsByTeam = new Map();
  const appearancesByPlayer = new Map();

  const getBasePlayer = (playerID) => {
    const key = Number(playerID);
    if (!basePlayers.has(key)) {
      const inputPlayer = catalogPlayers.get(key);
      basePlayers.set(key, inputPlayer ? createPlayerWithResolvedTeamNames(inputPlayer) : null);
    }
    return basePlayers.get(key);
  };

  const getCell = (basePlayer, playerID, leagueID, teamID, matchIndex) => {
    const key = `${playerID}|${leagueID}|${teamID}`;
    let cell = cellsByKey.get(key);
    if (!cell) {
      cell = createPlayerCell(basePlayer, playerID, leagueID, teamID, matchIndex);
      cellsByKey.set(key, cell);
      cells.push(cell);
      if (!cellsByLeague.has(leagueID)) cellsByLeague.set(leagueID, []);
      cellsByLeague.get(leagueID).push(cell);
      if (!cellsByTeam.has(teamID)) cellsByTeam.set(teamID, []);
      cellsByTeam.get(teamID).push(cell);
    }
    return cell;
  };

  registry.matches.forEach((match, matchIndex) => {
    const matchPlayers = Array.isArray(match.players) ? match.players : [];
    if (!matchPlayers.length) {
      return;
    }

    const hasBothTeams = matchPlayers.length >= 2;
    const starterRoles = starterRolesForMatch(match);

    for (const team of matchPlayers) {
      const teamID = Number(team?.team?.id);

      for (const playerEntry of team.players || []) {
        const playerID = playerEntry.player.id;

        if (Number(playerEntry.statistics?.[0]?.games?.minutes || 0) > 0) {
          const appearanceKey = Number(playerID);
          if (!appearancesByPlayer.has(appearanceKey)) appearancesByPlayer.set(appearanceKey, []);
          appearancesByPlayer.get(appearanceKey).push({
            playerEntry,
            match: {
              fixture: match.fixture,
              league: match.league,
              teams: match.teams,
              goals: match.goals,
              statistics: playerEntry.statistics[0],
              matchPosition: starterRoles.get(Number(playerID)) || "",
            },
          });
        }

        if (!hasBothTeams) {
          continue;
        }

        const basePlayer = getBasePlayer(playerID);
        if (!basePlayer) {
          continue;
        }

        const cell = getCell(basePlayer, playerID, match.league.id, teamID, matchIndex);
        addAppearanceToCell(cell, playerEntry, match, matchIndex, starterRoles);
      }
    }
  });

  return { basePlayers, cells, cellsByLeague, cellsByTeam, appearancesByPlayer };
}

function getPlayerIndex(registry) {
  return memoizeRegistryStat(registry, "players:index", () => buildPlayerIndex(registry), { pin: true });
}

function mergePlayerCells(basePlayer, playerCells) {
  const merged = copyPlayer(basePlayer);
  const positions = [];
  const competitions = [];
  const ratings = [];
  let shirtNumberMatchIndex = -1;

  for (const cell of playerCells) {
    merged.addCounters(cell.player);
    ratings.push(...cell.ratings);
    cell.player.exactPositions.forEach((position, index) => {
      positions.push({ position, matchIndex: cell.positionMatchIndexes[index] });
    });
    if (cell.competitionMatchIndex >= 0) {
      competitions.push({ competition: cell.player.competitionList[0], matchIndex: cell.competitionMatchIndex });
    }
    if (cell.shirtNumberMatchIndex > shirtNumberMatchIndex) {
      shirtNumberMatchIndex = cell.shirtNumberMatchIndex;
      merged.shirtNumber = cell.player.shirtNumber;
    }
  }

  const byMatchOrder = (a, b) => a.matchIndex - b.matchIndex;
  if (playerCells.length > 1) {
    merged.rating = ratings.sort(byMatchOrder).reduce((sum, { rating }) => sum + rating, 0);
  }
  for (const { position } of positions.sort(byMatchOrder)) {
    if (!merged.exactPositions.includes(position)) {
      merged.exactPositions.push(position);
    }
  }
  for (const { competition } of competitions.sort(byMatchOrder)) {
    if (!merged.competitionList.some((comp) => Number(comp.id) === Number(competition.id))) {
      merged.competitionList.push(competition);
    }
  }

  const hasStoredPosition = merged.position && !(Array.isArray(merged.position) && merged.position.length === 0);
  if (!hasStoredPosition && merged.exactPositions.length) {
    merged.position = merged.exactPositions[0];
    merged.displayPosition = formatPlayerPosition(merged.position);
  }

  merged.getGAper90();
  return merged;
}

/**
 * Season totals for every player matching the league/team filter, finalized and pre-sorted.
 * Shared across requests: callers must copy before mutating.
 */
function mergedPlayersKey(leagueFilter, appearedForTeamID) {
  return `players:list:${JSON.stringify([...new Set(leagueFilter)].sort())}:${appearedForTeamID ?? ""}`;
}

function getMergedPlayers(registry, leagueFilter, appearedForTeamID) {
  const leagueIDs = [...new Set(leagueFilter)];

  return memoizeRegistryStat(registry, mergedPlayersKey(leagueIDs, appearedForTeamID), () => {
    const index = getPlayerIndex(registry);
    const source = appearedForTeamID !== null
      ? index.cellsByTeam.get(appearedForTeamID) ?? []
      : leagueIDs.length
        ? leagueIDs.flatMap((leagueID) => index.cellsByLeague.get(leagueID) ?? [])
        : index.cells;
    const selectedCells = appearedForTeamID !== null && leagueIDs.length
      ? source.filter((cell) => leagueIDs.includes(cell.leagueID))
      : source;

    const cellsByPlayer = new Map();
    for (const cell of selectedCells) {
      if (!cellsByPlayer.has(cell.playerID)) cellsByPlayer.set(cell.playerID, []);
      cellsByPlayer.get(cell.playerID).push(cell);
    }

    const players = [...cellsByPlayer.values()]
      .map((playerCells) => ({
        firstMatchIndex: Math.min(...playerCells.map((cell) => cell.firstMatchIndex)),
        player: mergePlayerCells(index.basePlayers.get(Number(playerCells[0].playerID)), playerCells),
      }))
      .filter(({ player }) => player.apps >= 1)
      .sort((a, b) => a.firstMatchIndex - b.firstMatchIndex)
      .map(({ player }) => player)
      .sort((a, b) => b.rating - a.rating)
      .sort((a, b) => b.goals - a.goals);

    players.forEach(finalizePlayerPositions);
    return players;
  });
}

function parsePositionFilterValues(filter) {
  return String(filter?.value || filter?.min || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function matchesPlayerStatFilter(player, filter) {
  if (!filter?.stat || !filter.operator) {
    return true;
  }

  if (textPositionStats.has(filter.stat)) {
    const playerValue = String(player[filter.stat] || "").trim().toLowerCase();
    const selected = parsePositionFilterValues(filter);
    if (!selected.length) {
      return true;
    }

    const isMatch = selected.includes(playerValue);
    if (filter.operator === "neq") {
      return !isMatch;
    }

    return isMatch;
  }

  if (filter.stat === "nation") {
    const selected = String(filter.value || filter.min || "").trim();
    if (!selected) {
      return true;
    }

    const isMatch = String(player.nation) === selected;
    return filter.operator === "neq" ? !isMatch : isMatch;
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
    let primaryDiff = 0;

    if (textPositionStats.has(String(sortStat || ""))) {
      const positionA = String(playerA[sortStat] || "").trim();
      const positionB = String(playerB[sortStat] || "").trim();
      const positionDiff = !positionA && !positionB
        ? 0
        : !positionA
          ? 1
          : !positionB
            ? -1
            : comparePositionsByDisplayOrder(positionA, positionB);
      primaryDiff = !positionA || !positionB ? positionDiff : positionDiff * direction;
    } else if (String(sortStat || "") === "nation") {
      const nameA = String(playerA.nationName || "").trim();
      const nameB = String(playerB.nationName || "").trim();
      const nameDiff = !nameA && !nameB
        ? 0
        : !nameA
          ? 1
          : !nameB
            ? -1
            : nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      primaryDiff = !nameA || !nameB ? nameDiff : nameDiff * direction;
    } else {
      const sortValueA = getPlayerSortValue(playerA, sortStat);
      const sortValueB = getPlayerSortValue(playerB, sortStat);
      primaryDiff = comparePlayerStatValues(sortValueA, sortValueB) * direction;
    }

    if (primaryDiff !== 0) {
      return primaryDiff;
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
  const normalizedAppearedForTeamID = Number(appearedForTeamID);
  const hasAppearedForTeamFilter = appearedForTeamID != null && appearedForTeamID !== "" && Number.isFinite(normalizedAppearedForTeamID);
  const leagueIDs = leagueFilter || [];
  const mergedTeamID = hasAppearedForTeamFilter ? normalizedAppearedForTeamID : null;
  const selectedSortStat = normalizeSortStat(sortStat);
  const selectedSortDirection = normalizeSortDirection(sortDirection);
  const selectedStatFilters = Array.isArray(statFilters) && statFilters.length
    ? statFilters
    : statFilter?.stat
      ? [statFilter]
      : [];
  const hasRequestFilters = (teamFilter && !hasAppearedForTeamFilter) || positionFilter.length || selectedStatFilters.length;

  if (!hasRequestFilters) {
    const sortedKey = `${mergedPlayersKey(leagueIDs, mergedTeamID)}:sorted:${selectedSortStat}:${selectedSortDirection}`;
    return memoizeRegistryStat(registry, sortedKey, () => sortPlayersByStat(
      getMergedPlayers(registry, leagueIDs, mergedTeamID),
      selectedSortStat,
      selectedSortDirection,
    )).slice(0, nr).map(copyPlayer);
  }

  let players = getMergedPlayers(registry, leagueIDs, mergedTeamID);

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
      const playerPositions = [player.position, player.secondaryPosition]
        .map((position) => String(position || "").trim().toLowerCase())
        .filter(Boolean);
      return playerPositions.some((position) => selectedPositions.includes(position));
    });
  }

  const filteredPlayers = selectedStatFilters.length
    ? players.filter((player) => selectedStatFilters.every((filter) => matchesPlayerStatFilter(player, filter)))
    : players;

  return sortPlayersByStat(filteredPlayers, selectedSortStat, selectedSortDirection).slice(0, nr).map(copyPlayer);
}

export function getTopPlayersPageData(registry, query = {}) {
  const selectedLeague = parseLeagueIds(query.pleague);
  const selectedSortStat = normalizeSortStat(query.psort);
  const selectedSortDirection = normalizeSortDirection(query.pdir);
  const selectedStatFilters = parseTopPlayersStatFilters(query);
  const teamQuery = query.team;

  const players = getPlayerList(
    registry,
    500,
    teamQuery,
    selectedLeague,
    [],
    {
      sortStat: selectedSortStat,
      sortDirection: selectedSortDirection,
      statFilters: selectedStatFilters,
    },
  );

  return {
    players,
    selectedLeague,
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

function calendarDay(value) {
  if (value == null || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

// A transfer replaces the club only when its date is after the last appearance.
// Same-day matches stay with the team he actually played for.
function isTransferNewerThanAppearance(transferDate, appearanceDate) {
  const transferDay = calendarDay(transferDate);
  if (transferDay == null) {
    return false;
  }

  const appearanceDay = calendarDay(appearanceDate);
  if (appearanceDay == null) {
    return true;
  }

  return transferDay > appearanceDay;
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
  let clubsFromNewerTransfer = 0;
  let clubsKeptFromAppearance = 0;
  for (const transferPlayer of transferPlayers) {
    const playerID = Number(transferPlayer?.id);
    if (!Number.isFinite(playerID)) {
      continue;
    }

    if (!playersById.has(playerID)) {
      playersById.set(playerID, transferPlayer);
      addedFromTransfers += 1;
    } else if (transferPlayer.club && isTransferNewerThanAppearance(transferPlayer.transferDate, playersById.get(playerID).clubAsOf)) {
      playersById.get(playerID).club = transferPlayer.club;
      clubsFromNewerTransfer += 1;
    } else if (transferPlayer.club && playersById.get(playerID).club) {
      clubsKeptFromAppearance += 1;
    }
  }

  const playersToInsert = [...playersById.values()];

  await insertPlayersToDb(playersToInsert);
  const playersMissingExtraData = await getPlayersMissingExtraData();

  console.log(
    `[insertAllPlayers] Added ${addedFromTransfers} player(s) from transfers. Club from a newer transfer: ${clubsFromNewerTransfer}. Kept a newer appearance: ${clubsKeptFromAppearance}. Players with no extra data: ${playersMissingExtraData.length}.`,
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
const LAST_FIVE_GAMES = 5;

function statsForAppearances(inputPlayer, appearances) {
  const summary = createPlayerWithResolvedTeamNames(inputPlayer);
  for (const { playerEntry, match } of appearances) {
    summary.getPlayerStats(playerEntry, match.league);
  }
  if (!appearances.length) {
    summary.getGAper90();
  }
  return summary;
}

function lastFiveAppearances(appearances) {
  return [...appearances]
    .sort((left, right) => new Date(right.match.fixture.date) - new Date(left.match.fixture.date))
    .slice(0, LAST_FIVE_GAMES);
}

export function getPlayerDetails(registry, playerID, leagueFilter = []) {
  const inputPlayer = getPlayerByID(playerID);
  if (!inputPlayer) return null;

  const playerObj = createPlayerWithResolvedTeamNames(inputPlayer);

  const appearances = (getPlayerIndex(registry).appearancesByPlayer.get(Number(playerID)) ?? [])
    .filter(({ match }) => leagueFilter.length === 0 || leagueFilter.includes(match.league.id));

  for (const { playerEntry, match } of appearances) {
    playerObj.getPlayerStats(playerEntry, match.league);
  }

  playerObj.last5 = statsForAppearances(inputPlayer, lastFiveAppearances(appearances));

  const matches = appearances
    .map(({ match }) => match)
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  return { player: playerObj, matches };
}

export function getPlayerPageData(registry, playerID, leagueQuery) {
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

function normalizePlayerId(playerID) {
  const id = Number(playerID);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function emptyPlayerFetchResult() {
  return {
    success: false,
    requested: 0,
    saved: [],
    savedCount: 0,
    failed: [],
    calls: [],
  };
}

function playerRowFromPayload(playerPayload) {
  const firstStatistic = Array.isArray(playerPayload.statistics)
    ? playerPayload.statistics.find((stat) => stat?.team?.id)
    : null;

  return {
    id: playerPayload.player.id,
    name: playerPayload.player.name,
    club: firstStatistic?.team?.id ?? 0,
    nation: 0,
    position: [firstStatistic?.games?.position ?? ""],
  };
}

export async function persistPlayerProfile(playerID, apiData) {
  const playerPayload = apiData?.response?.[0] ?? null;
  if (!playerPayload?.player) {
    return { saved: false, playerPayload: null };
  }

  await writePlayerToServer(playerID, apiData);
  await insertPlayersToDb([playerRowFromPayload(playerPayload)], { overwritePosition: false });
  const profileUpdate = await updatePlayerProfilesInDb([playerPayload]);
  const updatedPlayer = await loadPlayerById(playerID);
  if (updatedPlayer) {
    upsertCatalogPlayer(updatedPlayer);
  }

  return {
    saved: true,
    playerPayload,
    playerInsert: { processed: 1 },
    profileUpdate,
    player: {
      id: playerPayload.player.id,
      name: playerPayload.player.name,
    },
  };
}

export async function fetchAndSavePlayerProfile(playerID) {
  const id = normalizePlayerId(playerID);
  if (!id) {
    return emptyPlayerFetchResult();
  }

  const { data, call, limits } = await getPlayersFromApi({ playerID: id });
  const calls = call ? [call] : [];
  const persisted = await persistPlayerProfile(id, data);

  if (!persisted.saved) {
    return {
      success: false,
      requested: 1,
      saved: [],
      savedCount: 0,
      failed: [{ id, error: `No player profile found for playerID=${id}` }],
      calls,
      limits,
      message: `No player profile found for playerID=${id}`,
    };
  }

  return {
    success: true,
    requested: 1,
    saved: [id],
    savedCount: 1,
    failed: [],
    calls,
    limits,
    player: persisted.player,
    playerInsert: persisted.playerInsert,
    profileUpdate: persisted.profileUpdate,
  };
}

const TEAM_REFETCH_GAP_MS = 5000;

function countSquadPlayers(squads) {
  if (!Array.isArray(squads)) {
    return 0;
  }

  return squads.reduce(
    (total, entry) => total + (Array.isArray(entry?.players) ? entry.players.length : 0),
    0,
  );
}

export async function refetchTeamSquadAndTransfers(teamID) {
  const id = Number(teamID);
  if (!Number.isFinite(id) || id <= 0) {
    return emptyPlayerFetchResult();
  }

  const calls = [];
  let squadSaved = false;
  let squadError = null;

  const squadFetch = await getSquadFromApi(id);
  if (squadFetch.call) {
    calls.push(squadFetch.call);
  }

  if (hasApiErrors(squadFetch.data)) {
    squadError = "API returned errors; existing squad left unchanged";
  } else {
    const squads = Array.isArray(squadFetch.data?.response) ? squadFetch.data.response : [];
    if (countSquadPlayers(squads) === 0) {
      squadError = "Empty squad response; existing squad left unchanged";
    } else {
      await saveSquadToDb(id, squads);
      squadSaved = true;
    }
  }

  await wait(TEAM_REFETCH_GAP_MS);

  let transfersSaved = 0;
  let transferError = null;
  const transferFetch = await getTransfersByTeam(id);
  if (transferFetch.call) {
    calls.push(transferFetch.call);
  }

  if (hasApiErrors(transferFetch.data)) {
    transferError = "API returned errors; existing transfers left unchanged";
  } else {
    const saved = await saveTransfersToDb(transferFetch.data?.response ?? []);
    transfersSaved = saved.saved;
    await markTeamTransfersUpdated(id);
  }

  const failed = [];
  if (squadError) {
    console.warn(`[refetch-team] team ${id}: ${squadError}`);
    failed.push({ id, error: squadError });
  }
  if (transferError) {
    console.warn(`[refetch-team] team ${id}: ${transferError}`);
    failed.push({ id, error: transferError });
  }

  const transfersOk = !transferError;
  return {
    success: squadSaved || transfersOk,
    requested: 1,
    saved: squadSaved ? [id] : [],
    savedCount: (squadSaved ? 1 : 0) + (transfersOk ? 1 : 0),
    failed,
    calls,
    squadSaved,
    transfersSaved,
    message: squadSaved || transfersOk ? undefined : (transferError || squadError),
  };
}

export async function fetchAndSavePlayerTransfers(playerID) {
  const id = normalizePlayerId(playerID);
  if (!id) {
    return emptyPlayerFetchResult();
  }

  const { data, call, limits } = await getTransfersByPlayer(id);
  const { saved } = await saveTransfersToDb(data?.response ?? [], { replacePlayerHistory: true });

  return {
    success: true,
    requested: 1,
    saved,
    savedCount: saved,
    failed: [],
    calls: call ? [call] : [],
    limits,
  };
}

export async function refetchPlayer({ playerID, includeTransfers = true } = {}) {
  const profile = await fetchAndSavePlayerProfile(playerID);
  if (!profile.success || !includeTransfers) {
    return profile;
  }

  const transfers = await fetchAndSavePlayerTransfers(playerID);
  return {
    ...profile,
    calls: [...profile.calls, ...transfers.calls],
    transfersSaved: transfers.savedCount,
  };
}