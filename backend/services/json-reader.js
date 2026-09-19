import { readFile } from "fs/promises";
import path from "path";
import { networkPath } from "../config.js";
import { CURRENT_SEASON } from "../../shared/defaults.js";
import { findOrCreateTeam } from "./teams-service.js";
import { LineupParser } from "../../classes/lineupparser.js";
import { ensureMatchesTable, getMatchDetailsByIds, upsertMatchDetails, upsertMatchSummaries } from "../data-access.js";
import { unwrapMatchPayload } from "../lib/match-details-mapper.js";
import { getResultFromApi, getResultsFromApiByIds } from "../api/webapi-handler.js";
import fs from 'fs/promises';   // For async/await operations

export const matchesDir = path.join(networkPath, "matches");
export const leaguesDir = path.join(networkPath, "leagues");
export const playersDir = path.join(networkPath, "players");
export const dataDir = networkPath;

const MATCH_SHARD_BUCKET_COUNT = 1000;

async function applyEloForMatchPayloads(matches) {
  const { applyEloForMatchPayloads: applyElo } = await import("./elo-service.js");
  return applyElo(matches);
}

function normalizeFixtureID(fixtureID) {
  return String(fixtureID ?? "").trim();
}

export function getLegacyMatchFilePath(fixtureID) {
  return path.join(matchesDir, `${normalizeFixtureID(fixtureID)}.json`);
}

export function getMatchShardDirectoryName(fixtureID) {
  const normalizedID = normalizeFixtureID(fixtureID);
  const numericID = Number(normalizedID);

  if (!normalizedID) {
    throw new Error("fixtureID is required");
  }

  if (Number.isFinite(numericID)) {
    return String(Math.abs(numericID) % MATCH_SHARD_BUCKET_COUNT).padStart(3, "0");
  }

  let hash = 0;
  for (const character of normalizedID) {
    hash = (hash * 31 + character.charCodeAt(0)) % MATCH_SHARD_BUCKET_COUNT;
  }

  return String(hash).padStart(3, "0");
}

export function getMatchFilePath(fixtureID) {
  return path.join(
    matchesDir,
    getMatchShardDirectoryName(fixtureID),
    `${normalizeFixtureID(fixtureID)}.json`,
  );
}

export async function ensureMatchFileDirectory(fixtureID) {
  await fs.mkdir(path.dirname(getMatchFilePath(fixtureID)), { recursive: true });
}

export async function matchFileExists(fixtureID) {
  const candidatePaths = [getMatchFilePath(fixtureID), getLegacyMatchFilePath(fixtureID)];

  for (const filePath of candidatePaths) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return false;
}

export async function getMatchFromServer(fixtureID) {
  const candidatePaths = [getMatchFilePath(fixtureID), getLegacyMatchFilePath(fixtureID)];

  for (const filePath of candidatePaths) {
    try {
      return JSON.parse(await readFile(filePath));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        return null;
      }
    }
  }

  return null;
}

export async function getLeagueFromServer(leagueID) {
  let file = path.join(leaguesDir, `${leagueID}.json`);
  try {
    let response = JSON.parse(await readFile(file));
    return response;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function writeLeagueToServer(leagueID, dataToWrite, season) {
  let filename = `${leagueID}.json`;
  if (season != CURRENT_SEASON) {
    filename = `${leagueID}_${season}.json`;
  }
  let file = path.join(leaguesDir, filename);
  let responseToSend = "";

  await fs.writeFile(file, JSON.stringify(dataToWrite));
  await importLeagueFromFile(filename);

  responseToSend += `${leagueID} was saved!<br/>`;
  return responseToSend;
}

export async function importLeagueFromFile(fileName) {
  const filePath = path.join(leaguesDir, fileName);
  const raw = await fs.readFile(filePath);
  const json = JSON.parse(raw);
  const matches = Array.isArray(json.response) ? json.response : json;

  if (!Array.isArray(matches) || matches.length === 0) {
    console.log("❌ No matches found in file");
    return;
  }

  const leagueID = matches[0].league.id;
  const season = matches[0].league.season;

  await ensureMatchesTable();
  console.log(`✅ Table 'matches' ensured for league ${leagueID} season ${season}`);

  const { importedMatches, skippedFinishedMatches } = await upsertMatchSummaries(matches, {
    skipExistingFinished: true,
  });

  console.log(
    `✅ Imported ${importedMatches} matches for league ${leagueID} season ${season}. Skipped ${skippedFinishedMatches} finished matches.`,
  );

  await applyEloForMatchPayloads(matches);
}

function matchHasTeamStatistics(match) {
  return (Array.isArray(match?.statistics) ? match.statistics : []).some(
    (entry) => Array.isArray(entry?.statistics) && entry.statistics.length > 0,
  );
}

export async function persistDownloadedMatches(
  matchPayloads,
  { overwriteDetails = false, applyElo = true } = {},
) {
  const matches = (Array.isArray(matchPayloads) ? matchPayloads : [matchPayloads])
    .map((payload) => unwrapMatchPayload(payload))
    .filter(Boolean);

  let summary = { importedMatches: 0, skippedFinishedMatches: 0 };
  try {
    summary = await upsertMatchSummaries(matches);
  } catch (error) {
    console.error("Failed to upsert matches rows:", error);
    summary = {
      importedMatches: 0,
      skippedFinishedMatches: 0,
      error: error.message,
    };
  }

  if (applyElo) {
    await applyEloForMatchPayloads(matches);
  }

  const details = [];

  for (const match of matches) {
    const matchId = Number(match?.fixture?.id);
    const overwrite = overwriteDetails && matchHasTeamStatistics(match);
    try {
      details.push(await upsertMatchDetails(matchId, match, { overwrite }));
    } catch (error) {
      console.error(`Failed to upsert match_details for ${matchId}:`, error);
      details.push({
        matchId,
        saved: false,
        skipped: false,
        error: error.message,
      });
    }
  }

  return { summary, details };
}

export async function writePlayerToServer(playerID, dataToWrite) {
  const id = String(playerID ?? "").trim();
  if (!id) {
    throw new Error("playerID is required");
  }

  await fs.mkdir(playersDir, { recursive: true });
  await fs.writeFile(path.join(playersDir, `${id}.json`), JSON.stringify(dataToWrite));
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
      const leagueMatches = Array.isArray(league?.response) ? league.response : Array.isArray(league) ? league : [];

      const finishedMatches = leagueMatches.filter((match) => match.fixture.status.short === "FT");
      const detailedMatches = await getMatchDetailsByIds(
        finishedMatches.map((match) => match.fixture.id),
      );

      for (const matchDetail of detailedMatches) {
        const { lineups = [], players: matchPlayers = [] } = matchDetail;

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
      const nationMatches = Array.isArray(nt?.response) ? nt.response : Array.isArray(nt) ? nt : [];

      const finishedNationMatches = nationMatches.filter((match) => match.fixture.status.short === "FT");
      const detailedNationMatches = await getMatchDetailsByIds(
        finishedNationMatches.map((match) => match.fixture.id),
      );

      for (const matchDetail of detailedNationMatches) {

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

export async function readPlayersFromFiles() {
  try {
    const directoryEntries = await fs.readdir(playersDir, { withFileTypes: true });
    const playerFiles = directoryEntries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    console.log(
      `[readPlayersFromFiles] Found ${playerFiles.length} player file(s) in ${playersDir}`,
    );

    const players = [];

    for (const fileName of playerFiles) {
      const filePath = path.join(playersDir, fileName);

      try {
        const fileContents = await readFile(filePath);
        const json = JSON.parse(fileContents);

        if (Array.isArray(json?.response)) {
          players.push(...json.response);
          console.log(
            `[readPlayersFromFiles] Loaded ${json.response.length} player record(s) from ${fileName}. Running total: ${players.length}`,
          );
          continue;
        }

        if (Array.isArray(json)) {
          players.push(...json);
          console.log(
            `[readPlayersFromFiles] Loaded ${json.length} player record(s) from ${fileName}. Running total: ${players.length}`,
          );
          continue;
        }

        console.warn(
          `[readPlayersFromFiles] Skipped ${fileName} because it did not contain an array payload.`,
        );
      } catch (error) {
        console.error(`[readPlayersFromFiles] Failed to parse ${fileName}:`, error);
      }
    }

    console.log(`[readPlayersFromFiles] Finished loading ${players.length} player record(s).`);

    return players;
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.warn(`[readPlayersFromFiles] Players directory not found: ${playersDir}`);
      return [];
    }

    console.error("[readPlayersFromFiles] Failed to read players directory:", error);
    return [];
  }
}

export function buildTeamList(data) {
  let teams = [];
  try {
    data.forEach((rawMatch) => {
      if (rawMatch != null) {
        if (!rawMatch.teams?.home || !rawMatch.teams?.away) {
          return;
        }

        const team1Data = rawMatch.teams.home;
        const team2Data = rawMatch.teams.away;

        const team1 = findOrCreateTeam(teams, team1Data);
        const team2 = findOrCreateTeam(teams, team2Data);

        const hasStatistics =
          Array.isArray(rawMatch.statistics) && rawMatch.statistics.length >= 2;

        const normalizedMatch = hasStatistics
          ? rawMatch
          : {
              ...rawMatch,
              score: {
                fulltime: {
                  home: rawMatch?.score?.fulltime?.home ?? rawMatch?.goals?.home ?? 0,
                  away: rawMatch?.score?.fulltime?.away ?? rawMatch?.goals?.away ?? 0,
                },
              },
              statistics: [{ statistics: [] }, { statistics: [] }],
            };

        if (normalizedMatch.statistics[0]) {
          team1.extractStats(normalizedMatch, 0, 1);
          team2.extractStats(normalizedMatch, 1, 0);
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

async function writeMatchJson(fixtureID, matchPayload, { overwrite = false } = {}) {
  await ensureMatchFileDirectory(fixtureID);
  const payload = Array.isArray(matchPayload) ? matchPayload : [matchPayload];
  try {
    await fs.writeFile(
      getMatchFilePath(fixtureID),
      JSON.stringify(payload),
      { flag: overwrite ? "w" : "wx" },
    );
    return { wrote: true };
  } catch (error) {
    if (!overwrite && error?.code === "EEXIST") {
      return { wrote: false, existed: true };
    }
    throw error;
  }
}

async function writeMatchJsonWithRetry(fixtureID, matchPayload, { overwrite = false } = {}) {
  try {
    return await writeMatchJson(fixtureID, matchPayload, { overwrite });
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return writeMatchJson(fixtureID, matchPayload, { overwrite });
  }
}

export async function saveMatchToServer(fixtureID, options = {}) {   
  const overwrite = Boolean(options?.overwrite);
  
  try {
    let { data, limits, call } = await getResultFromApi(fixtureID);
    const matchPayload = data?.response;
    await writeMatchJson(fixtureID, matchPayload, { overwrite });
    const db = await persistDownloadedMatches(matchPayload, {
      overwriteDetails: overwrite,
      applyElo: true,
    });

    return {
      match: matchPayload,
      limits,
      db,
      call,
    };
    
  } catch (err) {
    console.error("Error saving match:", err);
    throw err;
  }
}

export async function saveMatchesToServer(fixtureIDs, options = {}) {
  const overwrite = Boolean(options?.overwrite);
  const applyElo = options.applyElo !== false;
  const ids = Array.isArray(fixtureIDs)
    ? fixtureIDs.map((id) => String(id).trim()).filter(Boolean)
    : String(fixtureIDs || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

  if (ids.length === 0) {
    return {
      savedCount: 0,
      saved: [],
      failed: [],
      limits: null,
      matches: [],
      call: null,
    };
  }

  if (ids.length > 20) {
    throw new Error("A maximum of 20 fixture IDs can be saved in one batch.");
  }

  const { data, limits, call } = await getResultsFromApiByIds(ids);
  const matches = Array.isArray(data?.response) ? data.response : [];
  const byId = new Map(matches.map((match) => [String(match?.fixture?.id), match]));

  const saved = [];
  const failed = [];
  const matchesToPersist = [];

  for (const id of ids) {
    const match = byId.get(String(id));
    if (!match) {
      failed.push({ fixtureID: id, error: "No match returned by API" });
      continue;
    }

    matchesToPersist.push(match);

    try {
      await writeMatchJsonWithRetry(id, [match], { overwrite });
    } catch (error) {
      console.warn(`[saveMatchesToServer] JSON write failed for ${id}:`, error.message);
    }
  }

  if (matchesToPersist.length > 0) {
    try {
      await persistDownloadedMatches(matchesToPersist, {
        overwriteDetails: overwrite,
        applyElo,
      });
      saved.push(...matchesToPersist.map((match) => String(match?.fixture?.id ?? "")).filter(Boolean));
    } catch (error) {
      failed.push(...matchesToPersist.map((match) => ({
        fixtureID: String(match?.fixture?.id ?? ""),
        error: error.message,
      })));
    }
  }

  return {
    savedCount: saved.length,
    saved,
    failed,
    limits,
    matches,
    call,
  };
}
