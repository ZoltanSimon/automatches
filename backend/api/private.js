import { Router } from "express";
import { getPlayers, getResultsDate, getSquad as getSquadFromApi, getStandingsFromApi, getTransfersByTeam, getPlayerStatsFromApi, getTeamsByPlayer, hasApiErrors } from "./webapi-handler.js";
import { getAllMatchesFromDbUntilDate, loadLeagues, loadPlayers, loadTeams, saveLeagueStandingsToDb, insertTeamsToDb, getLeagueFromDb, saveTransfersToDb, getTeamsDueForTransferUpdate, markTeamTransfersUpdated, saveSquadToDb, getTeamsDueForSquadUpdate, getMatchDetailsById, getMatchIdsMissingDetails, getFinishedMatchesMissingXg, getTeamEloForTeam, getEloRankings } from "../data-access.js";
import { dataDir, writeLeagueToServer, saveMatchToServer } from "../services/json-reader.js";
import { forceRefreshRegistry, getRegistry, upsertRegistryMatchIfLoaded } from "../services/registry-service.js";
import { fetchAndSavePlayerTransfers, insertAllPlayers, refetchPlayer, startPlayerFetchJob, updatePlayerProfilesFromFiles } from "../services/players-service.js";
import { localhostOnly, wait } from "../lib/backend-helper.js";
import { CURRENT_SEASON, parseLeagueIds, updateCurrentSeasonLeagues, updateLeagueSeasonData } from "../services/leagues-service.js";
import { findMissingFinishedMatches, grabMatchesByIds, hydrateMissingMatches, matchesOnDay, matchesInRound, refetchLeagueRound, refetchMatchesOnDay } from "../services/matches-service.js";
import { extractExpectedGoals, teamNameFromMatchDetails } from "../lib/match-details-mapper.js";
import { replayElo } from "../services/elo-service.js";

const MAX_GET_PLAYERS_RUNS = 50;
let playersFetchJob = {
  running: false,
  nextPage: 46,
};
let missingMatchesHydrationJobRunning = false;
let transfersJobRunning = false;
let squadsJobRunning = false;
let eloBackfillJobRunning = false;

function apiPayloadHasErrors(data) {
  return hasApiErrors(data);
}

function respondRefetch(response, result, emptyMessage) {
  if (result.requested === 0) {
    return response.status(400).json({
      success: false,
      message: emptyMessage,
      ...result,
    });
  }

  return response.json(result);
}

async function handleRefetchRoute(response, { run, emptyMessage, failLog, failMessage }) {
  try {
    return respondRefetch(response, await run(), emptyMessage);
  } catch (error) {
    console.error(failLog, error);
    return response.status(500).json({
      success: false,
      message: error.message || failMessage,
    });
  }
}

function countSquadPlayers(squads) {
  if (!Array.isArray(squads)) {
    return 0;
  }

  return squads.reduce(
    (total, entry) => total + (Array.isArray(entry?.players) ? entry.players.length : 0),
    0,
  );
}

export function createApiRouter({ setAllDbState, allDBLeagues = [] }) {
  const router = Router();
  router.use(localhostOnly);
  let leaguesCache = allDBLeagues;
  
  router.get("/test-standings", async (request, response) => {
    const leagueID = Number(request.query.leagueID ?? 1);
    const season = Number(request.query.season ?? CURRENT_SEASON);

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

        const savedMatch = await getMatchDetailsById(match.fixtureId);
        const savedHomeTeamName = teamNameFromMatchDetails(savedMatch, homeTeamID);
        const savedAwayTeamName = teamNameFromMatchDetails(savedMatch, awayTeamID);

        if (needsHomeTeam && savedHomeTeamName) {
          resolvedTeamNamesByID.set(homeTeamID, savedHomeTeamName);
          pendingTeamIDs.delete(homeTeamID);
        }

        if (needsAwayTeam && savedAwayTeamName) {
          resolvedTeamNamesByID.set(awayTeamID, String(savedAwayTeamName).trim());
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
    upsertRegistryMatchIfLoaded(savedMatch?.match);
    console.log(`Saved match with ID: ${matchID}`);
    response.json(savedMatch);
  });

  router.get("/refetch-day", async (request, response) => {
    return handleRefetchRoute(response, {
      run: () => refetchMatchesOnDay({ date: request.query.date }),
      emptyMessage: "No fixtures returned for this date",
      failLog: "Error refetching matches on day:",
      failMessage: "Failed to refetch day",
    });
  });

  router.get("/refetch-round", async (request, response) => {
    return handleRefetchRoute(response, {
      run: () => refetchLeagueRound({
        leagueID: request.query.leagueID,
        season: request.query.season,
        round: request.query.round,
      }),
      emptyMessage: "No fixtures returned for this round",
      failLog: "Error refetching league round:",
      failMessage: "Failed to refetch round",
    });
  });

  router.get("/refetch-player", async (request, response) => {
    return handleRefetchRoute(response, {
      run: () => refetchPlayer({ playerID: request.query.playerID }),
      emptyMessage: "playerID is required",
      failLog: "Error refetching player:",
      failMessage: "Failed to refetch player",
    });
  });

  router.get("/grab-match-info", async (request, response) => {
    const rawIds = request.query.matchIDs ?? request.query.matchID;
    const includeMatches = String(request.query.includeMatches ?? "") === "1";
    const omitMatches = String(request.query.omitMatches ?? "") === "1" || !includeMatches;

    try {
      const savedMatch = await grabMatchesByIds(rawIds, { overwrite: true });

      if (savedMatch.requested === 0) {
        return response.status(400).json({
          success: false,
          message: "matchID or matchIDs is required",
        });
      }

      console.log(`Grabbed matches: ${savedMatch.saved.join(",") || "(none)"}`);

      const xg = (savedMatch.matches || []).map((match) => ({
        matchId: Number(match?.fixture?.id),
        ...extractExpectedGoals(match),
      }));

      if (omitMatches) {
        const { matches, match, ...summary } = savedMatch;
        return response.json({ ...summary, xg });
      }

      response.json({ ...savedMatch, xg });
    } catch (error) {
      console.error("Error grabbing match info:", error);
      response.status(500).json({
        success: false,
        message: "Failed to grab match info",
      });
    }
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
    const teamID = Number(request.query.teamID);
    if (!Number.isFinite(teamID) || teamID <= 0) {
      return response.status(400).json({ success: false, message: "teamID query parameter is required." });
    }

    try {
      const { data, limits } = await getSquadFromApi(teamID);
      console.log(`[get-squads] teamID=${teamID}, API limits:`, limits);

      if (apiPayloadHasErrors(data)) {
        console.error(`[get-squads] API returned errors for teamID=${teamID}:`, data.errors);
        return response.status(502).json({
          success: false,
          teamID,
          saved: false,
          message: "API returned errors; existing squad left unchanged",
          errors: data.errors,
          limits,
        });
      }

      const squads = Array.isArray(data?.response) ? data.response : [];
      const playerCount = countSquadPlayers(squads);
      if (playerCount === 0) {
        console.error(`[get-squads] Empty squad response for teamID=${teamID}; existing squad left unchanged`);
        return response.status(502).json({
          success: false,
          teamID,
          saved: false,
          message: "Empty squad response; existing squad left unchanged",
          limits,
        });
      }

      await saveSquadToDb(teamID, squads);

      response.json({
        success: true,
        teamID,
        saved: true,
        savedCount: squads.length,
        players: playerCount,
        squads,
      });
    } catch (error) {
      console.error(`[get-squads] Error for teamID=${teamID}:`, error);
      response.status(500).json({ success: false, message: "Error fetching squad" });
    }
  });

  router.get("/update-squads", async (request, response) => {
    if (squadsJobRunning) {
      return response.status(409).json({
        success: false,
        message: "update-squads job is already running.",
      });
    }

    const delayMs = 10000;
    squadsJobRunning = true;
    const startedAt = Date.now();
    const logProgress = (message, details) => {
      if (details !== undefined) {
        console.log(`[update-squads] ${message}`, details);
        return;
      }
      console.log(`[update-squads] ${message}`);
    };

    try {
      const teams = await getTeamsDueForSquadUpdate(150);
      logProgress(`Found ${teams.length} team(s) to update, ordered by oldest squad_updated first with never-updated teams first.`);

      const results = [];
      let totalSaved = 0;

      for (let i = 0; i < teams.length; i += 1) {
        const team = teams[i];
        const teamID = Number(team.ID);
        logProgress(`(${i + 1}/${teams.length}) Fetching squad for team ${teamID} (${team.name})...`);

        try {
          const { data, limits } = await getSquadFromApi(teamID);

          if (apiPayloadHasErrors(data)) {
            logProgress(`API returned errors for team ${teamID}.`, data.errors);
            results.push({ teamID, name: team.name, success: false, message: "API returned errors" });
          } else {
            const squads = Array.isArray(data?.response) ? data.response : [];
            const playerCount = countSquadPlayers(squads);
            if (playerCount === 0) {
              logProgress(`Empty squad response for team ${teamID}; existing squad left unchanged.`);
              results.push({ teamID, name: team.name, success: false, message: "Empty squad response" });
            } else {
              await saveSquadToDb(teamID, squads);
              totalSaved += 1;

              logProgress(
                `Saved squad for team ${teamID} (${squads.length} squad(s), ${playerCount} player(s)). API limits:`,
                limits,
              );
              results.push({ teamID, name: team.name, success: true, squads: squads.length, players: playerCount });
            }
          }
        } catch (error) {
          console.error(`[update-squads] Failed to process team ${teamID}:`, error);
          results.push({ teamID, name: team.name, success: false, message: "Request failed" });
        }

        if (i < teams.length - 1) {
          await wait(delayMs);
        }
      }

      const elapsedMs = Date.now() - startedAt;
      logProgress(`Done. Processed ${teams.length} team(s), saved ${totalSaved} squad(s) in ${elapsedMs}ms.`);

      response.json({
        success: true,
        teamsProcessed: teams.length,
        totalSaved,
        elapsedMs,
        results,
      });
    } catch (error) {
      console.error("[update-squads] Job failed:", error);
      response.status(500).json({
        success: false,
        message: "Failed to fetch squads",
      });
    } finally {
      squadsJobRunning = false;
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

  router.get("/get-transfers-by-team", async (request, response) => {
    const teamID = Number(request.query.teamID);
    if (!Number.isFinite(teamID) || teamID <= 0) {
      return response.status(400).json({ success: false, message: "Invalid teamID." });
    }

    try {
      const { data, limits } = await getTransfersByTeam(teamID);
      console.log(`[get-transfers-by-team] teamID=${teamID}, API limits:`, limits);
      console.log(`[get-transfers-by-team] response:`, JSON.stringify(data, null, 2));
      response.json({ success: true, data, limits });
    } catch (error) {
      console.error(`[get-transfers-by-team] Error for teamID=${teamID}:`, error);
      response.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/get-teams-by-player", async (request, response) => {
    const playerID = Number(request.query.playerID);
    if (!Number.isFinite(playerID) || playerID <= 0) {
      return response.status(400).json({ success: false, message: "Invalid playerID." });
    }

    try {
      const { data, limits } = await getTeamsByPlayer(playerID);
      console.log(`[get-teams-by-player] playerID=${playerID}, API limits:`, limits);
      response.json({ success: true, data, limits });
    } catch (error) {
      console.error(`[get-teams-by-player] Error for playerID=${playerID}:`, error);
      response.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/get-player-profile", async (request, response) => {
    return handleRefetchRoute(response, {
      run: () => refetchPlayer({
        playerID: request.query.playerID,
        includeTransfers: false,
      }),
      emptyMessage: "playerID is required",
      failLog: `[get-player-profile] Error for playerID=${request.query.playerID}:`,
      failMessage: "Failed to fetch player profile",
    });
  });

  router.get("/get-player-stats", async (request, response) => {
    const playerID = Number(request.query.playerID);
    if (!Number.isFinite(playerID) || playerID <= 0) {
      return response.status(400).json({ success: false, message: "Invalid playerID." });
    }

    try {
      const data = await getPlayerStatsFromApi(playerID);
      response.json({ success: true, data });
    } catch (error) {
      console.error(`[get-player-stats] Error for playerID=${playerID}:`, error);
      response.status(500).json({ success: false, message: error.message });
    }
  });

  router.get("/get-transfers-by-player", async (request, response) => {
    return handleRefetchRoute(response, {
      run: () => fetchAndSavePlayerTransfers(request.query.playerID),
      emptyMessage: "playerID is required",
      failLog: `[get-transfers-by-player] Error for playerID=${request.query.playerID}:`,
      failMessage: "Failed to fetch player transfers",
    });
  });

  router.get("/matches-missing-xg", async (request, response) => {
    const season = Number(request.query.season ?? CURRENT_SEASON);
    if (!Number.isFinite(season) || season <= 0) {
      return response.status(400).json({
        success: false,
        message: "Invalid season",
      });
    }

    try {
      const matches = await getFinishedMatchesMissingXg(season);
      response.json({
        success: true,
        season,
        count: matches.length,
        matches,
      });
    } catch (error) {
      console.error("Error loading matches missing xG:", error);
      response.status(500).json({
        success: false,
        message: error.message || "Failed to load matches missing xG",
      });
    }
  });

  router.get("/missing-matches", async (request, response) => {
    //if the request parameter is empty, get all leagues from the database
    let leagueIDs = parseLeagueIds(request.query.leagueID, {
      fallback: leaguesCache.map((league) => league.id),
      unique: true,
    });

    let matchArr = [];
    if (leagueIDs.length == 0 || !(leagueIDs[0] > 0)) {
      return response.json([]);
    }

    for (const leagueID of leagueIDs) {
      let data = await getLeagueFromDb(leagueID);

      console.log(`Checking league ${leagueID} with ${data.length} matches for missing match details...`);
      const finishedIds = data
        .filter((element) => ["FT", "AET", "PEN"].includes(element.fixture.status.short))
        .map((element) => element.fixture.id);
      const missingIds = new Set(
        (await getMatchIdsMissingDetails(finishedIds)).map((id) => Number(id)),
      );

      for (const element of data) {
        if (missingIds.has(Number(element.fixture.id))) {
          matchArr.push(element);
        }
      }
    }
    console.log(`Total missing matches across leagues ${leagueIDs.join(", ")}: ${matchArr.length}`);
    response.json(matchArr);
  });

  router.post("/backfill-elo", async (request, response) => {
    if (eloBackfillJobRunning) {
      return response.status(409).json({
        success: false,
        message: "elo backfill is already running",
      });
    }

    const payload = request.body && typeof request.body === "object" ? request.body : {};
    const dryRunRaw = payload.dryRun ?? request.query.dryRun ?? "";
    const dryRun = String(dryRunRaw) === "1" || String(dryRunRaw).toLowerCase() === "true";
    const scopeArg = String(payload.scope ?? request.query.scope ?? "").toLowerCase();
    const scope = scopeArg === "nt" || scopeArg === "club" ? scopeArg : null;

    eloBackfillJobRunning = true;
    try {
      const result = await replayElo({ scope, dryRun });
      response.json({ success: true, ...result });
    } catch (error) {
      console.error("Elo backfill failed:", error);
      response.status(500).json({
        success: false,
        message: error.message || "Failed to backfill Elo",
      });
    } finally {
      eloBackfillJobRunning = false;
    }
  });

  router.get("/team-elo", async (request, response) => {
    const teamID = Number(request.query.teamID);
    if (!Number.isFinite(teamID) || teamID <= 0) {
      return response.status(400).json({ success: false, message: "Invalid teamID" });
    }

    try {
      const elo = await getTeamEloForTeam(teamID);
      response.json({ success: true, teamID, elo });
    } catch (error) {
      console.error("Failed to load team Elo:", error);
      response.status(500).json({ success: false, message: "Failed to load team Elo" });
    }
  });

  router.get("/elo-rankings", async (request, response) => {
    const scope = String(request.query.scope ?? "club").toLowerCase() === "nt" ? "nt" : "club";
    const limit = Number(request.query.limit ?? 50);

    try {
      const rankings = await getEloRankings(scope, limit);
      response.json({ success: true, scope, rankings });
    } catch (error) {
      console.error("Failed to load Elo rankings:", error);
      response.status(500).json({ success: false, message: "Failed to load Elo rankings" });
    }
  });

  return router;
}