import { readFile, open } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./config.js";
import { getResultsDate, getLeaguesByType, getSquad as getSquadFromApi } from "./webapi-handler.js";
import { createApiRouter } from "./api.js";
import {
  getMatchFromServer,
  matchesDir,
  writeLeagueToServer,
  saveMatchToServer,
} from "./json-reader.js";
import {
  getLeagueFromDb,
  getLeagueStandingsFromDb,
  getLeagueSeason,
  getSquadFromDb,
  saveSquadToDb,
  loadLeagues,
  loadPlayers,
  loadTeams,
} from "./data-access.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import {
  getPlayerList,
  getTeamPlayerList,
  insertAllPlayers,
  getPlayerByID,
  getPlayerPageData,
  parseSelectedPositions,
  buildPositionOptions,
} from "./services/players-service.js";
import { matchesOnDay, matchesInRound, getMatchById, getMatchPageData } from "./services/matches-service.js";
import * as helpers from "./services/handlebars-helpers.js";
import { groupByLeague, defaultLeagues, getLeagueStandings, getLeagueById, getLeaguePageData } from "./services/leagues-service.js";
import { parseDate, parseLeagueIds, handleError, mergeWorldCupGroupStandings } from "./backend-helper.js";
import { getTeamById, getTeamPageData, getTopTeams } from "./services/teams-service.js";
import { buildMatchRegistry, refreshRegistry, getRegistry } from "./services/registry-service.js";
import { getPredictionForMatch } from "./services/prediction-service.js";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
const app = express();
const require = createRequire(import.meta.url);
const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
const partialsPath = path.join(__dirname, "../views/partials");
export let allDBPlayers, allDBTeams, allDBLeagues;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.engine(
  "handlebars",
  engine({
    partialsDir: [partialsPath],
    helpers,
  })
);

app.use(express.json());
app.set("views", __dirname + "./../views");
app.set("view engine", "handlebars");
app.use(express.static("./"));
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.locals.headerLeagues = allDBLeagues || [];
  next();
});
app.use(
  "/api",
  createApiRouter({
    setAllDbState: ({ players, teams, leagues }) => {
      allDBPlayers = players;
      allDBTeams = teams;
      allDBLeagues = leagues;
    },
  })
);

async function dumpRegistryOnStartup(registry) {
  const dumpPath = path.join(__dirname, "../data/registry-startup.json");
  const fileHandle = await open(dumpPath, "w");

  const writeChunk = async (chunk) => {
    await fileHandle.write(chunk);
  };

  try {
    await writeChunk("{\n");
    await writeChunk(`  \"generatedAt\": ${JSON.stringify(new Date().toISOString())},\n`);

    await writeChunk("  \"matches\": [\n");
    for (let i = 0; i < registry.matches.length; i += 1) {
      const suffix = i < registry.matches.length - 1 ? ",\n" : "\n";
      await writeChunk(`    ${JSON.stringify(registry.matches[i])}${suffix}`);
    }
    await writeChunk("  ],\n");

    const matchEntries = [...registry.matchByID.entries()];
    await writeChunk("  \"matchByID\": {\n");
    for (let i = 0; i < matchEntries.length; i += 1) {
      const [matchID, match] = matchEntries[i];
      const suffix = i < matchEntries.length - 1 ? ",\n" : "\n";
      await writeChunk(`    ${JSON.stringify(String(matchID))}: ${JSON.stringify(match)}${suffix}`);
    }
    await writeChunk("  }\n");
    await writeChunk("}\n");
  } finally {
    await fileHandle.close();
  }

  console.log(`Registry startup dump written to ${dumpPath}`);
}

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}, loading registry...`);
  allDBPlayers = await loadPlayers();
  allDBTeams = await loadTeams();
  allDBLeagues = await loadLeagues();
  
  await refreshRegistry(); // build it immediately on startup
  /*const registry = await getRegistry();
  try {
    await dumpRegistryOnStartup(registry);
  } catch (error) {
    console.error("Failed to write registry startup dump:", error);
  }*/
  setInterval(refreshRegistry, 30 * 60 * 1000);
});

app.get("/", async (req, res) => {
  try {
    const selectedDate = parseDate(req.query.date);
    const selectedPlayerLeague = req.query.pleague ? parseLeagueIds(req.query.pleague) : [1];
    const selectedTeamLeague = parseLeagueIds(req.query.tleague);
    const parsed = parseFloat(req.query.sleague);
    const selectedStandingsLeague = isNaN(parsed) ? 39 : parsed;

    const registry = await getRegistry();

    const playerPageData = getPlayerPageData(registry, null, selectedPlayerLeague);
    const players = playerPageData?.players || [];
    const matches = await matchesOnDay(registry, selectedDate);
    const teams = getTopTeams(registry, selectedTeamLeague);
    const standings = getLeagueStandings(registry, selectedStandingsLeague);
    const worldCupGroupsBase = await getLeagueStandingsFromDb(1);
    const worldCupGroups = mergeWorldCupGroupStandings(worldCupGroupsBase, registry);

    res.render("home", {
      title: "Generation Football - Football Stats, Players & Teams",
      description: "Explore live football standings, detailed team stats and league tables across Europe on Generation Football.",
      players,
      groupedMatches: groupByLeague(matches),
      selectedDate: selectedDate.toISOString().split("T")[0],
      leagues: allDBLeagues.filter((league) => league.type === "league"),
      selectedPLeagues: selectedPlayerLeague,
      selectedTLeagues: selectedTeamLeague,
      selectedSLeague: selectedStandingsLeague,
      teams: teams.slice(0, 10),
      standingsLink: `/league?id=${selectedStandingsLeague}`,
      standings: standings,
      worldCupGroups,});
  } catch (error) {
    handleError(res, error, "Error loading home page");
  }
});

app.get("/players", async (req, res) => {
  try {
    const selectedLeague = parseLeagueIds(req.query.pleague);
    const selectedPositions = parseSelectedPositions(req.query.pposition);
    const teamQuery = req.query.team;

    const registry = await getRegistry();
    const players = getPlayerList(registry, 500, teamQuery, selectedLeague, selectedPositions);

    res.render("players", {
      title: "Top Players - Football Player Stats & Performance",
      description: "Discover detailed football player stats, performance metrics and league comparisons on Generation Football's Players page.",
      players,
      leagues: allDBLeagues.filter((league) => league.type === "league"),
      selectedPLeagues: selectedLeague,
      selectedPPositions: selectedPositions,
      positionOptions: buildPositionOptions(),
    });
  } catch (error) {
    handleError(res, error, "Error fetching players");
  }
});

app.get("/top-teams", async (req, res) => {
  let selectedTeamLeague = parseLeagueIds(req.query.tleague);
  const registry = await getRegistry();
  
  const teams = getTopTeams(registry, selectedTeamLeague);

  res.render("top-teams", { 
    title: "Top Teams - Football Team Stats & Matches",
    description: "Explore detailed football team stats, performance metrics and league comparisons on Generation Football's Teams page.",
    teams: teams.slice(0,150),
    leagues: allDBLeagues.filter(league => league.type === 'league'),
     selectedTLeagues: selectedTeamLeague,
  });
});

app.get("/team", async (req, res) => {
  if (!req.query.ID) {
    return res.redirect("/");
  }

  const thisTeam = getTeamById(req.query.ID);
  if (!thisTeam) {
    return res.redirect("/");
  }

  const registry = await getRegistry();
  const { matches, teamStats } = await getTeamPageData(registry, thisTeam.ID);
  const savedSquad = await getSquadFromDb(thisTeam.ID);
  const teamPlayers = getTeamPlayerList(registry, thisTeam.ID, savedSquad, 100);

  if (!teamStats.length) {
    return res.redirect("/");
  }

  res.render("team", { 
    title: thisTeam.name + " - Football Team Stats & Matches",
    description: `Explore detailed stats, recent matches and league performance for ${thisTeam.name} on Generation Football's Team page.`,
    thisTeam,
    players: teamPlayers,
    matches, 
    teamStats,  
  });
});

app.get("/admin", async (req, res) => {
  const registry = await getRegistry();
  try {
    res.render("admin", {
      title: "Automatches",
      description: "Manage automated match simulations and player data on Generation Football's Admin page.",

      players: getPlayerList(registry, 300, req.query.team),
      leagues: allDBLeagues,
    });
  } catch (error) {
    console.error("Error fetching players:", error);
    res.status(500).send("Error fetching players");
  }
});

app.get("/ucl-last-round", async (req, res) => {
  let matches = await matchesInRound(8, 2);
  res.render("ucl-last-round", { 
    title: "UCL Last Round simulation",
    description: "Simulate the last round of the UEFA Champions League and explore match outcomes on Generation Football's UCL Last Round page.",
    matches, 
  });
});

app.get("/league", async (req, res) => {
  try {
    const parsed = parseFloat(req.query.id);
    const selectedLeague = isNaN(parsed) ? 39 : parsed;
    const selectedSeason = getLeagueSeason(selectedLeague, req.query.season);
    const defaultSeason = getLeagueSeason(selectedLeague);
    const leagueInfo = getLeagueById(selectedLeague);
    const registry = await buildMatchRegistry([
      { leagueID: selectedLeague, season: selectedSeason },
    ]);
    const {
      leagueNation,
      players,
      matches,
      standings,
      worldCupGroups,
      rounds,
      currentRound,
    } = await getLeaguePageData(registry, selectedLeague, selectedSeason, defaultSeason);

    res.render("league", {
      title: "League",
      description: `Explore detailed stats, recent matches and league performance for ${leagueInfo ? leagueInfo.name : "this league"} in the ${selectedSeason} season on Generation Football's League page.`,

      players,
      matches: (matches),
      standings: standings,
      worldCupGroups,
      rounds: rounds,
      currentRound: currentRound,
      leagueID: selectedLeague,
      leagueName: leagueInfo ? leagueInfo.name : "Unknown League",
      leagueSeasons: leagueInfo?.seasons ?? [selectedSeason],
      selectedSeason,
      leagueNation: {
        ID: leagueInfo ? leagueInfo.nation : 0,
        name: leagueNation?.name || "International",
      },
      title: leagueInfo ? leagueInfo.name + ' - ' + selectedSeason : "League - " + selectedSeason + " - Football League",
    });
  } catch (error) {
    handleError(res, error, "Error loading league page");
  }
});

app.get("/match", async (request, response) => {
  const { matchID } = request.query;

  const registry = await getRegistry();
  const currentMatch = getMatchById(registry, matchID);

  if (!currentMatch) {
    return response.status(404).render("match", {
      title: "Match Not Found",
      description: "Match details are not available.",
      matchID,
      teamList: [],
      matchInfo: null,
      matchStatistics: [],
    });
  }

  const { teamList, matchStatistics, leagueName } = await getMatchPageData(registry, currentMatch);
  
  response.render("match", {
    title: teamList.map(team => team.name).join(" vs ") + " - " + leagueName  + " - Football Match Details",
    description: "Explore detailed stats, player performances and match events for this football match on Generation Football's Match page.",
    matchID,
    teamList,
    matchInfo: currentMatch,
    matchStatistics,
  });
});

app.get("/predict-match", async (request, response) => {
  try {
    const { matchID } = request.query;

    if (!matchID) {
      return response.status(400).json({
        success: false,
        message: "matchID query parameter required",
      });
    }

    const prediction = await getPredictionForMatch(matchID);
    response.json({ success: true, prediction });
  } catch (error) {
    handleError(response, error, "Error generating match prediction");
  }
});

app.get("/player", async (request, response) => {
  try {
    const playerID = request.query.id;
    if (!playerID) {
      return response.status(400).render("player", {
        title: "Player",
        error: "id query parameter required",
      });
    }

    const registry = await getRegistry();
    const playerPageData = getPlayerPageData(registry, playerID, request.query.pleague);

    if (!playerPageData) {
      return response.status(404).render("player", {
        title: "Player Not Found",
        error: "Player not found",
      });
    }

    const { details, leagues, selectedLeague } = playerPageData;

    response.render("player", {
      title: details.player.name + " - Football Player Stats & Performance    ",
      description: `Explore detailed stats, recent matches and league performance for ${details.player.name} on Generation Football's Player page.`,
      player: details.player,
      matches: details.matches,
      leagues,
      selectedPLeagues: selectedLeague,
    });
  } catch (error) {
    handleError(response, error, "Error loading player page");
  }
});

app.get("/starting11", (req, res) => {
  res.render("palya", { title: "Starting 11 Builder - Football", description: "Build and explore the best starting 11 lineups for your favorite football teams on Generation Football's Starting 11 page." });
});

app.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy", { title: "Privacy Policy - Generation Football", description: "Read Generation Football's Privacy Policy to understand how we handle your data and protect your privacy." });
});

app.get("/about", (req, res) => {
  res.render("about", { title: "About Page - Generation Football", description: "Learn more about Generation Football, our mission, and the team behind the platform." });
});

app.get("/compare-players", (req, res) => {
  res.render("compare-players", { title: "Compare Players - Generation Football", description: "Compare detailed stats, performance metrics, and league performance for multiple football players on Generation Football's Compare Players page." });
});

app.get("/status", (request, response) => {
  const status = {
    Status: "Running",
  };

  response.send(status);
});

app.get("/update-leagues", async (request, response) => {
  let leagueIDs = request.query.leagueID.split(",");
  let seasons = request.query.seasons.split(",");
  let responseToSend = "";

  for (let i = 0; i < leagueIDs.length; i++) {
    let leagueID = leagueIDs[i];
    let season = seasons[i];

    let dataToWrite = await getResultsDate(leagueID, season);

    responseToSend += await writeLeagueToServer(leagueID, dataToWrite.response, season);
  }
  console.log(responseToSend);
  response.json(responseToSend);
});

//saves match
app.get("/save-match", async (request, response) => {
  let matchID = request.query.matchID;
  let savedMatch = await saveMatchToServer(matchID);
  console.log(`Saved match with ID: ${matchID}`);
  response.json(savedMatch);
});

app.get("/get-teams", async (request, response) => {
  const selectedTeamLeague = parseLeagueIds(request.query.leagueID);
  const date = request.query.date;
  const registry = await getRegistry();

  try {
    const result = extractTeams(registry, date, selectedTeamLeague);
    response.json(result);
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
});

app.get("/insert-all-players", async (request, response) => {
  const insertedPlayers = await insertAllPlayers();
  allDBPlayers = await loadPlayers();

  response.json({
    success: true,
    inserted: Array.isArray(insertedPlayers) ? insertedPlayers.length : 0,
    loadedPlayers: allDBPlayers.length,
  });
});

app.get("/get-matches-on-day", async (request, response) => {
  const registry = await getRegistry();
  let todaysMatches = await matchesOnDay(registry, new Date(request.query.matchDate));
  response.json(todaysMatches);
});

app.get("/get-matches-by-round", async (request, response) => {
  let leagueID = request.query.leagueID;
  let round = request.query.roundNo;
  let matches = await matchesInRound(round, leagueID);
  response.json(matches);
});

app.get("/get-squads", async (request, response) => {
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
    handleError(response, error, "Error fetching squads");
  }
});


