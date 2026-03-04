import { readFile } from "fs/promises";
import { networkPath } from "./config.js";
import { findOrCreateTeam } from "./backend-helper.js";
import { LineupParser } from "./../classes/lineupparser.js";
import { importLeague } from "./data-access.js";
import { getResultFromApi } from "../webapi-handler.js";
import * as fsSync from 'fs';  // For synchronous/callback operations
import fs from 'fs/promises';   // For async/await operations

const cache = new Map();

export const matchesDir = `${networkPath}matches`;
export const leaguesDir = `${networkPath}leagues`;
export const dataDir = `${networkPath}`;

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

  fsSync.writeFile(file, JSON.stringify(dataToWrite), function (err) {
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
          team1.extractStats(match, 0, 1);
          team2.extractStats(match, 1, 0);
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

export async function saveMatchToServer(fixtureID) {   
  console.log(`Saving match with fixture ID: ${fixtureID}`);
  
  try {
    let { data, limits } = await getResultFromApi(fixtureID);

    await fs.writeFile(
      `${matchesDir}/${fixtureID}.json`,
      JSON.stringify(data.response),
      { flag: "wx" }
    );

    const resp = {
      match: data.response,
      limits: limits,
    };
    
    console.log(resp);
    return resp;
    
  } catch (err) {
    console.error("Error saving match:", err);
    throw err;
  }
}
