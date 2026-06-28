import {
    getAllPlayers,
  } from "./../json-reader.js";
import { insertPlayersToDb } from "./../data-access.js"; 
import { Player } from "./../../classes/player.js";
import { allDBLeagues, allDBPlayers } from "../index.js";
import { LineupParser } from "../../classes/lineupparser.js";
import { comparePositionsByDisplayOrder } from "../backend-helper.js";
import { getTeamById } from "./teams-service.js";

function getTeamName(id) {
  return getTeamById(id)?.name || "";
}

function toPositionList(positionValue = "") {
  if (Array.isArray(positionValue)) {
    return positionValue
      .map((position) => String(position).trim().toLowerCase())
      .filter(Boolean);
  }

  return String(positionValue)
    .split(",")
    .map((position) => position.trim().toLowerCase())
    .filter(Boolean);
}

export function parseSelectedPositions(positionQuery) {
  if (!positionQuery) {
    return [];
  }

  return [...new Set(
    String(positionQuery)
      .split(",")
      .map((position) => position.trim().toLowerCase())
      .filter(Boolean)
  )];
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
) {
  const playerMap = new Map();

  const matches = leagueFilter.length > 0
    ? registry.matches.filter(m => leagueFilter.includes(m.league.id))
    : registry.matches;

  for (const match of matches) {
    const { players: matchPlayers } = match;
    if (!Array.isArray(matchPlayers) || matchPlayers.length < 2) continue;

    for (const team of matchPlayers) {
      for (const player of team.players) {
        const playerID = player.player.id;

        if (playerMap.has(playerID)) {
          playerMap.get(playerID).getPlayerStats(player, match.league);
        } else {
          const inputPlayer = getPlayerByID(playerID);
          if (!inputPlayer) {
            //console.error(`Player with ID ${playerID} not found.`);
            continue;
          }
          const thisPlayer = new Player(inputPlayer);
          thisPlayer.clubName = getTeamName(thisPlayer.club);
          thisPlayer.nationName = getTeamName(thisPlayer.nation);
          thisPlayer.getPlayerStats(player, match.league);
          playerMap.set(playerID, thisPlayer);
        }
      }
    }
  }

  let players = [...playerMap.values()]
    .filter(p => p.apps >= 1)
    .sort((a, b) => b.goals - a.goals);

  if (teamFilter) {
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
    const selectedPositions = positionFilter.map((position) => String(position).trim().toLowerCase());
    players = players.filter((player) => {
      const playerPositions = toPositionList(player.position);
      return playerPositions.some((position) => selectedPositions.includes(position));
    });
  }

  return players.slice(0, nr);
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

  const player = new Player(inputPlayer);
  if (!player.position && fallbackPosition) {
    player.position = fallbackPosition;
  }
  player.club = Number(teamID);
  player.clubName = getTeamName(player.club);
  player.nationName = getTeamName(player.nation);

  return player;
}

export function getTeamPlayerList(registry, teamID, squad = null, nr = 100, leagueFilter = []) {
  const normalizedTeamID = Number(teamID);
  const playersWithStats = getPlayerList(registry, 1000, normalizedTeamID, leagueFilter);

  if (!Array.isArray(squad?.players) || squad.players.length === 0) {
    return playersWithStats.slice(0, nr);
  }

  const statsByPlayerID = new Map(
    playersWithStats.map((player) => [Number(player.id), player]),
  );
  const mergedPlayers = [];
  const seenPlayerIDs = new Set();

  for (const squadEntry of squad.players) {
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
  let allPlayers = await getAllPlayers(
    allDBLeagues.filter((el) => el.type == "league").concat(allDBLeagues.filter((el) => el.type == "cup")),
    allDBLeagues.filter((el) => el.type == "nt")
  );

  await insertPlayersToDb(allPlayers);
  return allPlayers;
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

  const playerObj = new Player(inputPlayer);
  playerObj.clubName = getTeamName(playerObj.club);
  playerObj.nationName = getTeamName(playerObj.nation);

  const filteredMatches = leagueFilter.length
    ? registry.matches.filter((m) => leagueFilter.includes(m.league.id))
    : registry.matches;

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
    const selectedLeague = Array.isArray(leagueQuery)
      ? leagueQuery
      : String(leagueQuery || "")
        .split(",")
        .map((id) => Number(id.trim()))
        .filter(Boolean);

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
    ? [...new Set(
      String(leagueQuery)
        .split(",")
        .map((id) => Number(id.trim()))
        .filter(Boolean)
    )]
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