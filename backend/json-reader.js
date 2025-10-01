import { readFile } from "fs/promises";
import { Player } from "./../classes/player.js";
import * as fs from "fs";
import { networkPath } from "./config.js";
import { findOrCreateTeam, extractStats } from "./backend-helper.js";
import { LineupParser } from "./../classes/lineupparser.js";
import { getPlayerByID } from "./services/players-service.js";
import { importLeague, getLeagueFromDb } from "./data-access.js";

const cache = new Map();

export const matchesDir = `${networkPath}matches`;
export const leaguesDir = `${networkPath}leagues`;
export const dataDir = `${networkPath}`;

export async function getPlayerGoalList(leagues) {
  const allPlayers = [];

  for (let leagueIndex = 0; leagueIndex < leagues.length; leagueIndex++) {
    const league = await getLeagueFromDb(leagues[leagueIndex]);

    for (let matchIndex = 0; matchIndex < league.length; matchIndex++) {
      const leagueMatch = league[matchIndex];

      if (leagueMatch.fixture.status.short !== "FT") continue;

      const match = await getMatchFromServer(leagueMatch.fixture.id);

      if (!match || !match[0]) continue;

      for (let { players } of match) {
        if (!Array.isArray(players) || players.length < 2) continue;

        for (let teamIndex = 0; teamIndex <= 1; teamIndex++) {
          const teamPlayers = players[teamIndex].players;

          for (let player of teamPlayers) {
            const playerID = player.player.id;
            let playerFound = allPlayers.find((x) => x.id === playerID);

            if (playerFound) {
              playerFound.getPlayerStats(player);
            } else {
              const inputPlayer = getPlayerByID(playerID);

              if (!inputPlayer) {
                console.error(`Player with ID ${playerID} not found.`);
                continue;
              }

              const thisPlayer = new Player(inputPlayer);
              thisPlayer.getPlayerStats(player);
              allPlayers.push(thisPlayer);
            }
          }
        }
      }
    }
  }
  allPlayers.sort((a, b) =>
    a.goals < b.goals ? 1 : b.goals < a.goals ? -1 : 0
  );

  return allPlayers.filter((player) => player.apps >= 1);
}

export async function getMatchFromServer(fixtureID) {
  let file = `${matchesDir}/${fixtureID}.json`;
  try {
    if (cache.has(file)) {
      return cache.get(file);
    } else {
      let response = JSON.parse(await readFile(file));
      cache.set(file, response);
      return response;
    }
  } catch (e) {
    //console.error(e);
    return null;
  }
}

export async function getLeagueFromServer(leagueID) {
  let file = `${leaguesDir}/${leagueID}.json`;
  try {
    if (cache.has(file)) {
      return cache.get(file);
    } else {
      let response = JSON.parse(await readFile(file));
      cache.set(file, response);
      return response;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function writeLeagueToServer(leagueID, dataToWrite) {
  let file = `${leaguesDir}/${leagueID}.json`;
  let responseToSend = "";

  fs.writeFile(file, JSON.stringify(dataToWrite), function (err) {
    if (err) {
      return console.log(err);
    }
    importLeague(leagueID);
  });
  responseToSend += `${leagueID} was saved!<br/>`;

  cache.set(file, dataToWrite);
  return responseToSend;
}

export async function getAllPlayers(compList, nationList) {
  const playerMap = new Map();

  const addOrUpdatePlayer = ({
    id,
    name,
    club = 0,
    nation = 0,
    position = [],
  }) => {
    if (!playerMap.has(id)) {
      playerMap.set(id, {
        id,
        name,
        club,
        nation,
        position: Array.isArray(position) ? position : [position],
      });
    } else {
      const existing = playerMap.get(id);
      if (club) existing.club = club;
      if (nation) existing.nation = nation;
      if (position && position.length) {
        existing.position = Array.from(
          new Set([...existing.position, ...position])
        );
      }
    }
  };

  for (const comp of compList) {
    try {
      const league = JSON.parse(
        await readFile(`${leaguesDir}/${comp.id}.json`)
      );

      for (const match of league) {
        if (match.fixture.status.short !== "FT") continue;

        const matchData = await getMatchFromServer(match.fixture.id);
        if (!matchData?.[0]) continue;

        const { lineups = [], players: matchPlayers = [] } = matchData[0];

        // Pre-parse lineup positions only once
        const parsedLineupsByTeam = new Map();
        for (const lineup of lineups) {
          parsedLineupsByTeam.set(
            lineup.team.id,
            LineupParser.parseLineups([lineup], lineup.team.id)
          );
        }

        for (const teamData of matchPlayers) {
          const clubId = teamData.team.id;

          for (const playerData of teamData.players || []) {
            const playerId = playerData.player.id;
            const playerName = playerData.player.name;
            let positions = [];

            const lineup = lineups.find((l) => l.team.id === clubId);
            if (lineup) {
              const starter = lineup.startXI?.find(
                (s) => s.player.id === playerId
              );
              if (starter) {
                const parsed = parsedLineupsByTeam.get(clubId);
                if (parsed && parsed[playerId]?.role) {
                  // Changed from playerName to playerId
                  positions.push(parsed[playerId].role); // Changed from playerName to playerId
                }
              }
            }

            addOrUpdatePlayer({
              id: playerId,
              name: playerName,
              club: clubId,
              position: positions,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error processing competition ${comp.id}:`, error);
    }
  }

  for (const nation of nationList) {
    try {
      const nt = JSON.parse(await readFile(`${leaguesDir}/${nation.id}.json`));

      for (const match of nt) {
        if (match.fixture.status.short !== "FT") continue;

        const matchData = await getMatchFromServer(match.fixture.id);
        if (!matchData?.[0]) continue;

        const matchDetail = matchData[0];

        if (matchDetail.players?.length > 0) {
          for (const teamData of matchDetail.players) {
            const nationId = teamData.team.id;

            for (const playerData of teamData.players || []) {
              addOrUpdatePlayer({
                id: playerData.player.id,
                name: playerData.player.name,
                nation: nationId,
              });
            }
          }
        } else if (matchDetail.lineups?.length > 0) {
          for (const lineup of matchDetail.lineups) {
            const nationId = lineup.team.id;

            const allLineupPlayers = [
              ...(lineup.startXI || []),
              ...(lineup.substitutes || []),
            ];

            for (const entry of allLineupPlayers) {
              addOrUpdatePlayer({
                id: entry.player.id,
                name: entry.player.name,
                nation: nationId,
                position: entry.position ? [entry.position] : [],
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing national team ${nation.id}:`, error);
    }
  }

  return Array.from(playerMap.values());
}

export function buildTeamList(data) {
  let teams = [];
  try {
    data.forEach((match) => {
      if (match != null) {
        const team1Data = match.teams.home;
        const team2Data = match.teams.away;

        const team1 = findOrCreateTeam(teams, team1Data);
        const team2 = findOrCreateTeam(teams, team2Data);

        if (match.statistics[0]) {
          const stats1 = extractStats(match, 0, 1);
          const stats2 = extractStats(match, 1, 0);

          team1.stats.push(stats1);
          team2.stats.push(stats2);
        }
      }
    });

    teams.forEach((team) => team.calculateStats());
    return teams;
  } catch (error) {
    console.error("Failed to fetch and build team list:", error);
    return [];
  }
}
