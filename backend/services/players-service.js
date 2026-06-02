import {
    getAllPlayers,
  } from "./../json-reader.js";
import { insertPlayersToDb } from "./../data-access.js"; 
import { Player } from "./../../classes/player.js";
import { allDBLeagues, allDBPlayers, allDBTeams } from "../index.js";

function getTeamName(id) {
  return allDBTeams?.find((team) => team.ID == id)?.name || "";
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
    players = players.filter(p => p.club === teamFilter);
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
    // each match has two teams in match.players
    for (const team of match.players) {
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