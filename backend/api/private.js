import { Router } from "express";
import { getPlayers, getResultsDate, getSquad as getSquadFromApi, getStandingsFromApi } from "../webapi-handler.js";
import { getAllMatchesFromDbUntilDate, loadLeagues, loadPlayers, loadTeams, saveLeagueStandingsToDb, insertTeamsToDb, getLeagueFromDb } from "../data-access.js";
import { dataDir, getMatchFromServer, matchesDir, saveMatchesToServer, getLeagueFromServer, writeLeagueToServer, saveMatchToServer } from "../json-reader.js";
import { forceRefreshRegistry, getRegistry } from "../services/registry-service.js";
import { insertAllPlayers } from "../services/players-service.js";
import { updateLeagueSeasonData } from "../backend-helper.js";
import { matchesOnDay, matchesInRound } from "../services/matches-service.js";
import * as fs from "fs";

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const MAX_GET_PLAYERS_RUNS = 50;
let playersFetchJob = {
  running: false,
  nextPage: 46,
};
let missingMatchesHydrationJobRunning = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function readSavedStatus(savedMatchData) {
  const savedMatch = Array.isArray(savedMatchData)
    ? savedMatchData[0]
    : savedMatchData;

  return String(savedMatch?.fixture?.status?.short || "").trim().toUpperCase();
}

export function createApiRouter({ setAllDbState, allDBLeagues = [] }) {
  const router = Router();
  router.use(localhostOnly);
  let leaguesCache = allDBLeagues;
  
  // Wrap setAllDbState to also update our local cache
  const originalSetAllDbState = setAllDbState;
  const wrappedSetAllDbState = (state) => {
    leaguesCache = state.leagues || [];
    originalSetAllDbState(state);
  };

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
    const today = new Date().toISOString().split("T")[0];
    const data = await getAllMatchesFromDbUntilDate(today);

    const existingFileNames = new Set(await fs.promises.readdir(matchesDir));
    const existingMatches = [];
    const matchArr = [];

    for (const element of data) {
      if (existingFileNames.has(`${element.fixtureId}.json`)) {
        existingMatches.push(element);
      } else {
        matchArr.push(element);
      }
    }

    const statusBatchSize = 150;
    for (let i = 0; i < existingMatches.length; i += statusBatchSize) {
      const batch = existingMatches.slice(i, i + statusBatchSize);
      const statusChecks = await Promise.allSettled(
        batch.map((element) => getMatchFromServer(element.fixtureId)),
      );

      statusChecks.forEach((result, index) => {
        if (result.status !== "fulfilled") {
          return;
        }

        const element = batch[index];
        const savedStatus = readSavedStatus(result.value);
        const dbStatus = String(element.fixtureStatus || "").trim().toUpperCase();

        if (savedStatus && dbStatus && savedStatus !== dbStatus) {
          console.log(
            `[all-missing-matches] Status mismatch for fixture ${element.fixtureId}: json=${savedStatus}, db=${dbStatus}`,
          );
        }
      });
    }

    console.log(`Total missing matches: ${matchArr.length}`);

    if (missingMatchesHydrationJobRunning) {
      return response.status(409).json({
        success: false,
        message: "all-missing-matches hydration is already running",
      });
    }

    const matchesToDownload = matchArr.length;
    const batchSize = 20;

    missingMatchesHydrationJobRunning = true;
    try {
      for (let i = 0; i < matchesToDownload; i += batchSize) {
        const batch = matchArr.slice(i, i + batchSize);
        const batchIds = [...new Set(batch.map((match) => String(match.fixtureId)))];
        const remaining = matchesToDownload - (i + batch.length);

        if (batchIds.length === 0) {
          continue;
        }

        try {
          const result = await saveMatchesToServer(batchIds);
          console.log(
            `Saved ${result.savedCount}/${batchIds.length} matches in batch [${batchIds.join(",")}] (${remaining} left)`
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
    } finally {
      missingMatchesHydrationJobRunning = false;
    }

    console.log(
      `Finished downloading ${matchesToDownload} matches. ${matchArr.length - matchesToDownload} matches still missing.`
    );

    response.json(matchArr);
  });

  router.get("/reload-runtime-cache", async (request, response) => {
    try {
      const players = await loadPlayers();
      const teams = await loadTeams();
      const leagues = await loadLeagues();
      wrappedSetAllDbState({ players, teams, leagues });

      await forceRefreshRegistry();

      const registry = await getRegistry();

      response.json({
        success: true,
        players: players.length,
        teams: teams.length,
        leagues: leagues.length,
        matches: registry.matches.length,
        refreshedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to reload runtime cache:", error);
      response.status(500).json({ success: false, message: "Failed to reload runtime cache" });
    }
  });

  router.get("/get-matches-on-day", async (request, response) => {
    const registry = await getRegistry();
    const todaysMatches = await matchesOnDay(registry, new Date(request.query.matchDate));
    response.json(todaysMatches);
  });

  router.get("/get-matches-by-round", async (request, response) => {
    const leagueID = request.query.leagueID;
    const round = request.query.roundNo;
    const matches = await matchesInRound(round, leagueID);
    response.json(matches);
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

  router.get("/insert-all-clubs-to-db", async (request, response) => {
    try {
      const allDBLeagues = await loadLeagues();
      const allDBTeams = await loadTeams();
      let teamsNew = [];

      for (let league of allDBLeagues) {
        let matches = await getLeagueFromServer(league.id);
        for (const match of matches) {
          let homeTeam = {
            ID: match.teams.home.id,
            name: match.teams.home.name,
          };
          let awayTeam = {
            ID: match.teams.away.id,
            name: match.teams.away.name,
          };

          if (!teamsNew.find((e) => e.ID == homeTeam.ID)) {
            teamsNew.push(homeTeam);
          }

          if (!teamsNew.find((e) => e.ID == awayTeam.ID)) {
            teamsNew.push(awayTeam);
          }
        }
      }

      teamsNew = teamsNew.filter(function (obj) {
        return !allDBTeams.some((el) => el.ID === obj.ID);
      });

      await insertTeamsToDb(teamsNew);
      console.log(teamsNew);
      response.json({
        success: true,
        message: `Inserted ${teamsNew.length} new teams into database`,
        teams: teamsNew,
      });
    } catch (error) {
      console.error("Error inserting clubs to db:", error);
      response.status(500).json({
        success: false,
        message: "Failed to insert clubs to database",
      });
    }
  });

  router.get("/update-leagues", async (request, response) => {
    let leagueIDs = request.query.leagueID.split(",");
    let seasons = request.query.seasons.split(",");
    let responseToSend = "";

    for (let i = 0; i < leagueIDs.length; i++) {
      let leagueID = leagueIDs[i];
      let season = seasons[i];

      responseToSend += await updateLeagueSeasonData(leagueID, season, {
        getResultsDateFn: getResultsDate,
        writeLeagueToServerFn: writeLeagueToServer,
      });
    }
    console.log(responseToSend);
    response.json(responseToSend);
  });

  router.get("/update-league-all-seasons", async (request, response) => {
    const leagueID = Number(request.query.leagueID);

    if (!Number.isFinite(leagueID)) {
      return response.status(400).json({
        success: false,
        message: "leagueID query parameter is required.",
      });
    }

    if (!Array.isArray(leaguesCache) || leaguesCache.length === 0) {
      leaguesCache = await loadLeagues();
    }

    const league = leaguesCache.find((lg) => Number(lg.id) === leagueID);
    if (!league) {
      return response.status(404).json({
        success: false,
        message: `League not found: ${leagueID}`,
      });
    }

    const seasons = [...new Set(
      (Array.isArray(league.seasons) && league.seasons.length > 0
        ? league.seasons
        : [league.season])
        .map((season) => Number(season))
        .filter((season) => Number.isFinite(season))
    )].sort((a, b) => b - a);

    if (seasons.length === 0) {
      return response.status(400).json({
        success: false,
        message: `No valid seasons found for league ${leagueID}.`,
      });
    }

    const delayMs = 2000;
    const updates = [];

    for (let i = 0; i < seasons.length; i += 1) {
      const season = seasons[i];
      const result = await updateLeagueSeasonData(leagueID, season, {
        getResultsDateFn: getResultsDate,
        writeLeagueToServerFn: writeLeagueToServer,
      });
      updates.push({ season, result });

      if (i < seasons.length - 1) {
        await wait(delayMs);
      }
    }

    response.json({
      success: true,
      leagueID,
      leagueName: league.name,
      totalSeasons: seasons.length,
      updatedSeasons: updates.length,
      delayMs,
      updates,
    });
  });

  // saves match
  router.get("/save-match", async (request, response) => {
    let matchID = request.query.matchID;
    let savedMatch = await saveMatchToServer(matchID);
    console.log(`Saved match with ID: ${matchID}`);
    response.json(savedMatch);
  });

  router.get("/insert-all-players", async (request, response) => {
    const insertedPlayers = await insertAllPlayers();

    const players = await loadPlayers();
    const teams = await loadTeams();
    const leagues = await loadLeagues();
    wrappedSetAllDbState({ players, teams, leagues });

    response.json({
      success: true,
      inserted: Array.isArray(insertedPlayers) ? insertedPlayers.length : 0,
      loadedPlayers: players.length,
    });
  });

  router.get("/get-squads", async (request, response) => {
    try {
      const leagueID = Number(request.query.leagueID);
      const delayMsFromQuery = Number(request.query.delayMs);
      const delayMs = Number.isFinite(delayMsFromQuery) && delayMsFromQuery >= 0
        ? delayMsFromQuery
        : 3000;
      if (!Number.isFinite(leagueID)) {
        return response.status(400).json({ success: false, message: "leagueID query parameter is required." });
      }

      const registry = await getRegistry();
      const leagueMatches = registry.matches.filter((match) => Number(match?.league?.id) === leagueID);
      const teamIDs = [...new Set(
        leagueMatches.flatMap((match) => [
          Number(match?.teams?.home?.id),
          Number(match?.teams?.away?.id),
        ]).filter((teamID) => Number.isFinite(teamID))
      )];

      const squads = [];
      const failedTeams = [];
      let savedCount = 0;

      for (let i = 0; i < teamIDs.length; i += 1) {
        const teamID = teamIDs[i];

        try {
          const responsePayload = await getSquadFromApi(teamID);
          const squadList = Array.isArray(responsePayload?.response) ? responsePayload.response : [];
          for (const squad of squadList) {
            squads.push(squad);
            await saveSquadToDb(teamID, squad);
            savedCount += 1;
          }
        } catch (error) {
          failedTeams.push(teamID);
        }

        if (i < teamIDs.length - 1 && delayMs > 0) {
          await wait(delayMs);
        }
      }

      response.json({
        success: true,
        leagueID,
        teamCount: teamIDs.length,
        delayMs,
        savedCount,
        squads,
        failedTeams,
      });
    } catch (error) {
      console.error("Error fetching squads", error);
      response.status(500).json({ success: false, message: "Error fetching squads" });
    }
  });

  router.get("/missing-matches", async (request, response) => {
    //if the request parameter is empty, get all leagues from the database
    let leagueIDs = request.query.leagueID
      ? request.query.leagueID.split(",")
      : leaguesCache.map(l => l.id);

    let matchArr = [];
    if (leagueIDs.length == 0 || !(leagueIDs[0] > 0)) {
      return response.json([]);
    }

    for (const leagueID of leagueIDs) {
      let data = await getLeagueFromDb(leagueID);

      console.log(`Checking league ${leagueID} with ${data.length} matches for missing match files...`);
      for (const element of data) {
        if (["FT", "AET"].includes(element.fixture.status.short)) {
          try {
            fs.accessSync(
              `${matchesDir}/${element.fixture.id}.json`,
              fs.constants.R_OK
            );
          } catch (err) {
            matchArr.push(element);
          }
        }
      }
    }
    console.log(`Total missing matches across leagues ${leagueIDs.join(", ")}: ${matchArr.length}`);
    response.json(matchArr);
  });

  return router;
}