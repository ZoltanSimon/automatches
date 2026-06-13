import { Router } from "express";
import { getPlayers } from "./webapi-handler.js";
import { getStandingsFromApi } from "./webapi-handler.js";
import { getAllMatchesFromDbUntilDate, loadLeagues, loadPlayers, loadTeams, saveLeagueStandingsToDb } from "./data-access.js";
import { clearReaderCache, dataDir, getMatchFromServer, matchesDir, saveMatchesToServer } from "./json-reader.js";
import { forceRefreshRegistry, getRegistry } from "./services/registry-service.js";
import * as fs from "fs";

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const MAX_GET_PLAYERS_RUNS = 50;
let playersFetchJob = {
  running: false,
  nextPage: 46,
};

function isLocalRequest(request) {
  const ip = String(request.ip || request.socket?.remoteAddress || "").toLowerCase();
  const hostname = String(request.hostname || "").toLowerCase();

  return LOCAL_IPS.has(ip) || hostname === "localhost";
}

function localhostOnly(request, response, next) {
  if (!isLocalRequest(request)) {
    return response.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  next();
}

export function createApiRouter({ setAllDbState }) {
  const router = Router();
  router.use(localhostOnly);

  router.get("/test-standings", async (request, response) => {
    const leagueID = Number(request.query.leagueID ?? 1);
    const season = Number(request.query.season ?? 2026);

    if (Number.isNaN(leagueID) || leagueID <= 0) {
      return response.status(400).json({
        success: false,
        message: "Invalid leagueID",
      });
    }

    try {
      const standingsData = await getStandingsFromApi(leagueID, season);
      console.log(`Fetched standings for league ${leagueID}, season ${season}:`, standingsData);
      const standings = standingsData?.response?.[0]?.league?.standings ?? [];

      await saveLeagueStandingsToDb(leagueID, standings, season);

      response.json({
        success: true,
        leagueID,
        standings,
      });
    } catch (error) {
      console.error(`Error saving standings for league ${leagueID}:`, error);
      response.status(500).json({
        success: false,
        message: "Failed to fetch and save standings",
      });
    }
  });

  router.get("/all-missing-matches", async (request, response) => {
    let matchArr = [];
    const today = new Date().toISOString().split("T")[0];
    let data = await getAllMatchesFromDbUntilDate(today);
    for (const element of data) {
      try {
        fs.accessSync(
          `${matchesDir}/${element.fixtureId}.json`,
          fs.constants.R_OK,
        );

        const savedMatchData = await getMatchFromServer(element.fixtureId);
        const savedMatch = Array.isArray(savedMatchData)
          ? savedMatchData[0]
          : savedMatchData;
        const savedStatus = String(savedMatch?.fixture?.status?.short || "").trim().toUpperCase();
        const dbStatus = String(element.fixtureStatus || "").trim().toUpperCase();

        if (savedStatus && dbStatus && savedStatus !== dbStatus) {
          console.log(
            `[all-missing-matches] Status mismatch for fixture ${element.fixtureId}: json=${savedStatus}, db=${dbStatus}`,
          );
        }
      } catch (err) {
        matchArr.push(element);
      }
    }
    console.log(`Total missing matches: ${matchArr.length}`);

    // Download the last 100 missing matches in batches of 20 fixture IDs per API request.
    const matchesToDownload = Math.min(100, matchArr.length);
    const batchSize = 20;
    for (let i = 0; i < matchesToDownload; i += batchSize) {
      const batch = matchArr.slice(i, i + batchSize);
      const batchIds = batch.map((match) => String(match.fixtureId));
      const remaining = matchesToDownload - (i + batch.length);

      try {
        const result = await saveMatchesToServer(batchIds);
        console.log(
          `Saved ${result.savedCount}/${batch.length} matches in batch [${batchIds.join(",")}] (${remaining} left)`
        );

        if (result.failed.length > 0) {
          console.warn("Failed matches in batch:", result.failed);
        }
      } catch (err) {
        console.error(`Error saving match batch [${batchIds.join(",")}]`, err);
      }

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, 7000));
      }
    }

    console.log(`Finished downloading ${matchesToDownload} matches. ${matchArr.length - matchesToDownload} matches still missing.`);

    response.json(matchArr);
  });

  router.get("/reload-runtime-cache", async (request, response) => {
    try {
      const players = await loadPlayers();
      const teams = await loadTeams();
      const leagues = await loadLeagues();
      setAllDbState({ players, teams, leagues });

      clearReaderCache();
      await forceRefreshRegistry({
        hydrateMissingFromApi: true,
        rehydrateIncomplete: true,
      });

      const registry = await getRegistry();

      response.json({
        success: true,
        players: players.length,
        teams: teams.length,
        leagues: leagues.length,
        fixtures: registry.fixtures.length,
        matches: registry.matches.length,
        refreshedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to reload runtime cache:", error);
      response.status(500).json({ success: false, message: "Failed to reload runtime cache" });
    }
  });

  router.get("/get-players", async (request, response) => {
    if (request.query.stop === "true") {
      playersFetchJob.running = false;
      console.log("[get-players] Stop requested. Background fetch loop will halt after current iteration.");
      return response.json({
        success: true,
        message: "Stop requested for get-players background loop.",
        nextPage: playersFetchJob.nextPage,
      });
    }

    if (playersFetchJob.running) {
      return response.json({
        success: true,
        message: "get-players background loop is already running.",
        nextPage: playersFetchJob.nextPage,
      });
    }

    try {
      playersFetchJob.running = true;
      if (request.query.startPage) {
        const parsedStart = Number(request.query.startPage);
        if (!Number.isNaN(parsedStart) && parsedStart > 0) {
          playersFetchJob.nextPage = parsedStart;
        }
      }

      const playersDir = `${dataDir}players`;
      if (!fs.existsSync(playersDir)) {
        fs.mkdirSync(playersDir, { recursive: true });
      }

      const baseQuery = { ...request.query };
      delete baseQuery.page;
      delete baseQuery.stop;
      delete baseQuery.startPage;

      console.log(
        `[get-players] Starting background fetch loop at page ${playersFetchJob.nextPage}. Interval: 10s. Max runs: ${MAX_GET_PLAYERS_RUNS}.`
      );

      (async function runLoop() {
        let completedRuns = 0;

        while (playersFetchJob.running && completedRuns < MAX_GET_PLAYERS_RUNS) {
          const page = playersFetchJob.nextPage;
          const startedAt = new Date().toISOString();

          try {
            console.log(`[get-players] Fetching page ${page} at ${startedAt}`);
            const players = await getPlayers({ ...baseQuery, page });
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

          if (playersFetchJob.running && completedRuns < MAX_GET_PLAYERS_RUNS) {
            await new Promise((resolve) => setTimeout(resolve, 10000));
          }
        }

        if (completedRuns >= MAX_GET_PLAYERS_RUNS && playersFetchJob.running) {
          playersFetchJob.running = false;
          console.log(
            `[get-players] Reached max runs (${MAX_GET_PLAYERS_RUNS}) for this start request. Next page is ${playersFetchJob.nextPage}.`
          );
        }

        console.log(
          `[get-players] Background loop stopped. Next page is ${playersFetchJob.nextPage}.`
        );
      })();

      response.json({
        success: true,
        message: `Started get-players background loop (max ${MAX_GET_PLAYERS_RUNS} runs).`,
        intervalSeconds: 10,
        maxRuns: MAX_GET_PLAYERS_RUNS,
        startPage: playersFetchJob.nextPage,
      });
    } catch (error) {
      playersFetchJob.running = false;
      console.error("Error fetching players profiles:", error);
      response.status(500).json({ success: false, message: "Failed to fetch players profiles" });
    }
  });

  return router;
}