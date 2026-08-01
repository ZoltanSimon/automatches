import { Router } from "express";
import { getPlayers, getResultsDate, getSquad as getSquadFromApi, getStandingsFromApi, getTransfersByTeam } from "../webapi-handler.js";
import { getAllMatchesFromDbUntilDate, loadLeagues, loadPlayers, loadTeams, saveLeagueStandingsToDb, insertTeamsToDb, getLeagueFromDb, saveTransfersToDb, getTeamsDueForTransferUpdate, markTeamTransfersUpdated } from "../data-access.js";
import { dataDir, getMatchFromServer, matchFileExists, writeLeagueToServer, saveMatchToServer } from "../json-reader.js";
import { forceRefreshRegistry, getRegistry } from "../services/registry-service.js";
import { insertAllPlayers, startPlayerFetchJob, updatePlayerProfilesFromFiles } from "../services/players-service.js";
import { localhostOnly, wait } from "../backend-helper.js";
import { updateCurrentSeasonLeagues, updateLeagueSeasonData } from "../services/leagues-service.js";
import { findMissingFinishedMatches, hydrateMissingMatches, matchesOnDay, matchesInRound } from "../services/matches-service.js";

const MAX_GET_PLAYERS_RUNS = 50;
let playersFetchJob = {
  running: false,
  nextPage: 46,
};
let missingMatchesHydrationJobRunning = false;
let transfersJobRunning = false;

export function createApiRouter({ setAllDbState, allDBLeagues = [] }) {
  const router = Router();
  router.use(localhostOnly);
  let leaguesCache = allDBLeagues;
  
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
    if (missingMatchesHydrationJobRunning) {
      return response.status(409).json({
        success: false,
        message: "all-missing-matches hydration is already running",
      });
    }

    missingMatchesHydrationJobRunning = true;
    try {
      const matchArr = await findMissingFinishedMatches("[all-missing-matches]");
      await hydrateMissingMatches(matchArr, "[all-missing-matches]");

      response.json(matchArr);
    } finally {
      missingMatchesHydrationJobRunning = false;
    }
  });

  router.get("/import-and-update-matches", async (request, response) => {
    if (missingMatchesHydrationJobRunning) {
      return response.status(409).json({
        success: false,
        message: "match import/update job is already running",
      });
    }

    missingMatchesHydrationJobRunning = true;
    const startedAt = Date.now();
    const logProgress = (message, details) => {
      if (details !== undefined) {
        console.log(`[import-and-update-matches] ${message}`, details);
        return;
      }

      console.log(`[import-and-update-matches] ${message}`);
    };

    try {
      logProgress("Job started.");
      logProgress("Updating current season leagues from API...");
      const { leagues, ...leagueUpdate } = await updateCurrentSeasonLeagues(leaguesCache, {
        getResultsDateFn: getResultsDate,
        writeLeagueToServerFn: writeLeagueToServer,
      });
      leaguesCache = leagues;
      logProgress("League update finished.", leagueUpdate);
      logProgress("Finding missing finished match files...");
      const missingMatches = await findMissingFinishedMatches("[import-and-update-matches]");
      logProgress(`Found ${missingMatches.length} missing finished match files.`);
      logProgress("Hydrating missing finished match files...");
      const hydration = await hydrateMissingMatches(missingMatches, "[import-and-update-matches]");
      logProgress("Hydration finished.", hydration);

      const elapsedMs = Date.now() - startedAt;
      logProgress(`Job completed in ${elapsedMs}ms.`, {
        missingMatches: missingMatches.length,
        elapsedMs,
      });

      response.json({
        success: true,
        leagueUpdate,
        missingMatches: missingMatches.length,
        hydration,
        elapsedMs,
      });
    } catch (error) {
      console.error("[import-and-update-matches] Job failed:", error);
      response.status(500).json({
        success: false,
        message: "Failed to import leagues and update matches",
      });
    } finally {
      logProgress("Job finished, releasing lock.");
      missingMatchesHydrationJobRunning = false;
    }
  });

  router.get("/reload-runtime-cache", async (request, response) => {
    try {
      const players = await loadPlayers();
      const teams = await loadTeams();
      const leagues = await loadLeagues();
      leaguesCache = leagues;
      setAllDbState({ players, teams, leagues });

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

      const baseQuery = { ...request.query };
      delete baseQuery.page;
      delete baseQuery.stop;
      delete baseQuery.startPage;

      startPlayerFetchJob(playersFetchJob, {
        baseQuery,
        dataDir,
        getPlayersFn: getPlayers,
        maxRuns: MAX_GET_PLAYERS_RUNS,
      });

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

  router.get("/update-player-profiles-from-files", async (request, response) => {
    try {
      console.log("[update-player-profiles-from-files] Request received.");
      const result = await updatePlayerProfilesFromFiles();
      console.log("[update-player-profiles-from-files] Request completed:", result);

      response.json({
        success: true,
        message: "Player profile fields updated from player files.",
        ...result,
      });
    } catch (error) {
      console.error("[update-player-profiles-from-files] Error updating player profiles from files:", error);
      response.status(500).json({
        success: false,
        message: "Failed to update player profiles from files",
      });
    }
  });

  router.get("/insert-all-clubs-to-db", async (request, response) => {
    try {
      const [allDBTeams, allMatches] = await Promise.all([
        loadTeams(),
        getAllMatchesFromDbUntilDate("2999-12-31"),
      ]);

      const existingTeamIDs = new Set(allDBTeams.map((team) => Number(team.ID)));
      const knownTeamNames = new Map(
        allDBTeams.map((team) => [Number(team.ID), team.name])
      );

      const teamIDsFromMatches = new Set();
      for (const match of allMatches) {
        const homeTeamID = Number(match.homeTeamId);
        const awayTeamID = Number(match.awayTeamId);

        if (Number.isFinite(homeTeamID)) {
          teamIDsFromMatches.add(homeTeamID);
        }

        if (Number.isFinite(awayTeamID)) {
          teamIDsFromMatches.add(awayTeamID);
        }
      }

      const missingTeamIDs = [...teamIDsFromMatches].filter((teamID) => !existingTeamIDs.has(teamID));
      const pendingTeamIDs = new Set(missingTeamIDs);
      const resolvedTeamNamesByID = new Map();

      for (const match of allMatches) {
        if (pendingTeamIDs.size === 0) {
          break;
        }

        const homeTeamID = Number(match.homeTeamId);
        const awayTeamID = Number(match.awayTeamId);
        const needsHomeTeam = pendingTeamIDs.has(homeTeamID);
        const needsAwayTeam = pendingTeamIDs.has(awayTeamID);

        if (!needsHomeTeam && !needsAwayTeam) {
          continue;
        }

        const savedMatchData = await getMatchFromServer(match.fixtureId);
        const savedMatch = Array.isArray(savedMatchData)
          ? savedMatchData[0]
          : savedMatchData;

        const savedHomeTeam = savedMatch?.teams?.home;
        const savedAwayTeam = savedMatch?.teams?.away;

        if (needsHomeTeam && savedHomeTeam?.name) {
          resolvedTeamNamesByID.set(homeTeamID, String(savedHomeTeam.name).trim());
          pendingTeamIDs.delete(homeTeamID);
        }

        if (needsAwayTeam && savedAwayTeam?.name) {
          resolvedTeamNamesByID.set(awayTeamID, String(savedAwayTeam.name).trim());
          pendingTeamIDs.delete(awayTeamID);
        }
      }

      const unresolvedTeamIDs = [];
      const teamsNew = [];

      for (const teamID of missingTeamIDs) {
        const teamName = knownTeamNames.get(teamID) || resolvedTeamNamesByID.get(teamID);

        if (!teamName) {
          unresolvedTeamIDs.push(teamID);
          continue;
        }

        teamsNew.push({
          ID: teamID,
          name: teamName,
        });
      }

      if (teamsNew.length > 0) {
        await insertTeamsToDb(teamsNew);
      }

      console.log(teamsNew);
      response.json({
        success: true,
        message: `Inserted ${teamsNew.length} new teams into database from matches table`,
        matchesScanned: allMatches.length,
        distinctTeamsFromMatches: teamIDsFromMatches.size,
        unresolvedTeamIDs,
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
    const { leagues, ...leagueUpdate } = await updateCurrentSeasonLeagues(leaguesCache, {
      getResultsDateFn: getResultsDate,
      writeLeagueToServerFn: writeLeagueToServer,
    });
    leaguesCache = leagues;

    response.json({
      success: true,
      ...leagueUpdate,
    });
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
    const insertResult = await insertAllPlayers();

    const players = await loadPlayers();
    const teams = await loadTeams();
    const leagues = await loadLeagues();
    leaguesCache = leagues;
    setAllDbState({ players, teams, leagues });

    response.json({
      success: true,
      inserted: Number(insertResult?.insertedCandidates || 0),
      transferCandidates: Number(insertResult?.transferCandidates || 0),
      addedFromTransfers: Number(insertResult?.addedFromTransfers || 0),
      playersMissingExtraDataCount: Number(insertResult?.playersMissingExtraDataCount || 0),
      playersMissingExtraData: Array.isArray(insertResult?.playersMissingExtraData)
        ? insertResult.playersMissingExtraData
        : [],
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

  router.get("/get-transfers", async (request, response) => {
    if (transfersJobRunning) {
      return response.status(409).json({
        success: false,
        message: "get-transfers job is already running.",
      });
    }

    const delayMs = 10000;
    transfersJobRunning = true;
    const startedAt = Date.now();
    const logProgress = (message, details) => {
      if (details !== undefined) {
        console.log(`[get-transfers] ${message}`, details);
        return;
      }
      console.log(`[get-transfers] ${message}`);
    };

    try {
      const teams = await getTeamsDueForTransferUpdate(150);
      logProgress(`Found ${teams.length} club(s) to update (is_club=1), ordered by oldest transfer_updated first with never-updated clubs first.`);

      const results = [];
      let totalSaved = 0;

      for (let i = 0; i < teams.length; i += 1) {
        const team = teams[i];
        const teamID = Number(team.ID);
        logProgress(`(${i + 1}/${teams.length}) Fetching transfers for team ${teamID} (${team.name})...`);

        try {
          const { data, limits } = await getTransfersByTeam(teamID);

          if (data?.errors && Object.keys(data.errors).length > 0) {
            logProgress(`API returned errors for team ${teamID}.`, data.errors);
            results.push({ teamID, name: team.name, success: false, message: "API returned errors" });
          } else {
            const transfers = data?.response ?? [];
            const transferCount = transfers.reduce(
              (total, entry) => total + (Array.isArray(entry.transfers) ? entry.transfers.length : 0),
              0,
            );
            const { saved } = await saveTransfersToDb(transfers);
            await markTeamTransfersUpdated(teamID);
            totalSaved += saved;

            logProgress(
              `Saved ${saved} transfer row(s) for team ${teamID} (${transfers.length} player(s), ${transferCount} record(s)). API limits:`,
              limits,
            );
            results.push({ teamID, name: team.name, success: true, players: transfers.length, saved });
          }
        } catch (error) {
          console.error(`[get-transfers] Failed to process team ${teamID}:`, error);
          results.push({ teamID, name: team.name, success: false, message: "Request failed" });
        }

        if (i < teams.length - 1) {
          await wait(delayMs);
        }
      }

      const elapsedMs = Date.now() - startedAt;
      logProgress(`Done. Processed ${teams.length} club(s), saved ${totalSaved} transfer row(s) in ${elapsedMs}ms.`);

      response.json({
        success: true,
        teamsProcessed: teams.length,
        totalSaved,
        elapsedMs,
        results,
      });
    } catch (error) {
      console.error("[get-transfers] Job failed:", error);
      response.status(500).json({
        success: false,
        message: "Failed to fetch transfers",
      });
    } finally {
      transfersJobRunning = false;
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
        if (["FT", "AET", "PEN"].includes(element.fixture.status.short)) {
          if (!(await matchFileExists(element.fixture.id))) {
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