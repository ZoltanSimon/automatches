import { readFile } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./config.js";
import { getResultsDate, getPlayers, getLeaguesByType } from "../webapi-handler.js";
import {
  getMatchFromServer,
  matchesDir,
  writeLeagueToServer,
  buildTeamList,
  getLeagueFromServer,
  saveMatchToServer,
  saveMatchesToServer,
  dataDir
} from "./json-reader.js";
import {
  getLeagueFromDb,
  insertTeamsToDb,
  getAllMatchesFromDbUntilDate,
  insertMatchesToQueue,
  loadLeagues,
  loadPlayers,
  loadTeams
} from "./data-access.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import {
  getPlayerList,
  insertAllPlayers,
  getPlayerByID,
  getPlayerDetails,
} from "./services/players-service.js";
import { matchesOnDay, matchesInRound, lastMatchesFromLeague, allTeamMatches, buildMatchStatistics } from "./services/matches-service.js";
import * as helpers from "./services/handlebars-helpers.js";
import { groupByLeague, defaultLeagues, getLeagueStandings } from "./services/leagues-service.js";
import { parseDate, parseLeagueIds, handleError } from "./backend-helper.js";
import { extractTeams, getTopTeams } from "./services/teams-service.js";
import { buildMatchRegistry, refreshRegistry, getRegistry } from "./services/registry-service.js";

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
let playersFetchJob = {
  running: false,
  nextPage: 46,
};

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

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}, loading registry...`);
  allDBPlayers = await loadPlayers();
  allDBTeams = await loadTeams();
  allDBLeagues = await loadLeagues();
  
  await refreshRegistry(); // build it immediately on startup
  setInterval(refreshRegistry, 30 * 60 * 1000);
});

app.get("/", async (req, res) => {
  try {
    const selectedDate = parseDate(req.query.date);
    const selectedPlayerLeague = parseLeagueIds(req.query.pleague);
    const selectedTeamLeague = parseLeagueIds(req.query.tleague);
    const parsed = parseFloat(req.query.sleague);
    const selectedStandingsLeague = isNaN(parsed) ? 39 : parsed;

    const registry = await getRegistry();

    const players = getPlayerList(registry, 10, "", selectedPlayerLeague);
    const matches = await matchesOnDay(registry, selectedDate);
    const teams = getTopTeams(registry, selectedTeamLeague);
    const standings = getLeagueStandings(registry, selectedStandingsLeague);

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
      standings: standings 
    });
  } catch (error) {
    handleError(res, error, "Error loading home page");
  }
});

app.get("/players", async (req, res) => {
  try {
    const selectedLeague = parseLeagueIds(req.query.pleague);
    const registry = await buildMatchRegistry(selectedLeague);
    const players = getPlayerList(registry, 500, req.query.team);

    res.render("players", {
      title: "Players",
      description: "Discover detailed football player stats, performance metrics and league comparisons on Generation Football's Players page.",
      players,
      leagues: allDBLeagues.filter(league => league.type === 'league'),
      selectedPLeagues: selectedLeague,
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
    title: "Teams",
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

  let thisTeam = allDBTeams.find(t => t.ID == req.query.ID);
  if (!thisTeam) {
    return res.redirect("/");
  }

  const registry = await getRegistry();
  let fullTeamList = extractTeams(registry, null, [], thisTeam.ID);
  let teamStats = fullTeamList.filter(team => team.id === thisTeam.ID);

  if (!teamStats.length) {
    return res.redirect("/");
  }

  teamStats[0].leagues = [...teamStats[0].leagues.values()];
  let matchesToShow = allTeamMatches(registry, thisTeam.ID, null, false)
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  res.render("team", { 
    title: thisTeam.name,
    description: `Explore detailed stats, recent matches and league performance for ${thisTeam.name} on Generation Football's Team page.`,
    thisTeam,
    players: getPlayerList(registry, 100, thisTeam.ID),
    matches: matchesToShow, 
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
    const parsed = parseFloat(req.query.ID);
    const selectedLeague = isNaN(parsed) ? 39 : parsed;

    const registry = await getRegistry();

    const players = getPlayerList(registry, 10, null, [selectedLeague]);
    const { matches, rounds, currentRound } = lastMatchesFromLeague(registry, selectedLeague);
    const standings = getLeagueStandings(registry, selectedLeague);
    const leagueInfo = allDBLeagues.find(league => league.id === selectedLeague);

    res.render("league", {
      title: "League",
      description: `Explore detailed stats, recent matches and league performance for ${leagueInfo ? leagueInfo.name : "this league"} on Generation Football's League page.`,

      players,
      matches: (matches),
      standings: standings,
      rounds: rounds,
      currentRound: currentRound,
      leagueID: selectedLeague,
      leagueName: leagueInfo ? leagueInfo.name : "Unknown League",
      leagueNation: {
        ID: leagueInfo ? leagueInfo.nation : 0,
        name: allDBTeams.find(nation => nation.ID == leagueInfo.nation).name 
      },
    });
  } catch (error) {
    handleError(res, error, "Error loading league page");
  }
});

app.get("/match", async (request, response) => {
  const { matchID } = request.query;
  const matchKey = Number.isNaN(Number(matchID)) ? matchID : Number(matchID);

  const registry = await getRegistry();
  const currentMatch = registry.matchByID.get(matchKey) ?? registry.fixtures.find(f => f.fixture.id == matchID);

  let teamList = [];
  let matchStatistics = [];

  if (currentMatch) {
    const { home, away } = currentMatch.teams;

    const allMatches = await allTeamMatches(registry, home.id, away.id);
    teamList = buildTeamList(allMatches)
      .filter(team => team.id === home.id || team.id === away.id)
      .sort((a, b) => (a.id === home.id ? -1 : b.id === home.id ? 1 : 0))
      .map(team => ({
        ...team,
        matches: team.matches
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5),
      }));

    matchStatistics = buildMatchStatistics(currentMatch);
  }

  response.render("match", {
    title: "Match Details",
    description: "Explore detailed stats, player performances and match events for this football match on Generation Football's Match page.",
    matchID,
    teamList,
    matchInfo: currentMatch,
    matchStatistics,
  });
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

    const registry = await getRegistry(); // reuse cached registry
    const allDetails = getPlayerDetails(registry, playerID, []);

    if (!allDetails) {
      return response.status(404).render("player", {
        title: "Player Not Found",
        error: "Player not found",
      });
    }

    const availableLeagueIds = allDetails.player.competitionList.map((competition) => competition.id);
    const hasLeagueQuery = Object.prototype.hasOwnProperty.call(request.query, "pleague");
    const requestedLeagueIds = hasLeagueQuery
      ? [...new Set(
        String(request.query.pleague)
        .split(",")
        .map((id) => Number(id.trim()))
        .filter(Boolean)
      )]
      : availableLeagueIds;
    const filteredLeagueIds = requestedLeagueIds.filter((leagueId) => availableLeagueIds.includes(leagueId));
    const selectedLeague = filteredLeagueIds.length > 0 ? filteredLeagueIds : availableLeagueIds;

    const details = getPlayerDetails(registry, playerID, selectedLeague);

    response.render("player", {
      title: details.player.name,
      description: `Explore detailed stats, recent matches and league performance for ${details.player.name} on Generation Football's Player page.`,
      player: details.player,
      matches: details.matches,
      leagues: allDetails.player.competitionList || [],
      selectedPLeagues: selectedLeague,
    });
  } catch (error) {
    handleError(response, error, "Error loading player page");
  }
});

app.get("/starting11", (req, res) => {
  res.render("starting11", { title: "Starting 11 Builder", description: "Build and explore the best starting 11 lineups for your favorite football teams on Generation Football's Starting 11 page." });
});

app.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy", { title: "Privacy Policy", description: "Read Generation Football's Privacy Policy to understand how we handle your data and protect your privacy." });
});

app.get("/about", (req, res) => {
  res.render("about", { title: "About Page", description: "Learn more about Generation Football, our mission, and the team behind the platform." });
});

app.get("/compare-players", (req, res) => {
  res.render("compare-players", { title: "Compare Players", description: "Compare detailed stats, performance metrics, and league performance for multiple football players on Generation Football's Compare Players page." });
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

    responseToSend += await writeLeagueToServer(leagueID, dataToWrite.response);
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

//returns missing matches from given league
app.get("/missing-matches", async (request, response) => {
  //if the request parameter is empty, get all leagues from the database
  let leagueIDs = request.query.leagueID
    ? request.query.leagueID.split(",")
    : allDBLeagues.map(l => l.id);

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
    await insertMatchesToQueue(matchArr);
  }
console.log(`Total missing matches across leagues ${leagueIDs.join(", ")}: ${matchArr.length}`);
  response.json(matchArr);
});

app.get("/all-missing-matches", async (request, response) => {
  let matchArr = [];
  const today = new Date().toISOString().split('T')[0];
  let data = await getAllMatchesFromDbUntilDate(today);
  for (const element of data) {
    try {
      fs.accessSync(
        `${matchesDir}/${element.fixtureId}.json`,
        fs.constants.R_OK,
      );
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

  console.log(`✅ Finished downloading ${matchesToDownload} matches. ${matchArr.length - matchesToDownload} matches still missing.`);

  response.json(matchArr);
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

app.get("/get-all-matches", async (request, response) => {
  let bigArr = [];
  await readFile(matchesDir);
  response.json(bigArr);
});

app.get("/insert-all-players", async (request, response) => {
  response.json(await insertAllPlayers());
});

app.get("/get-player-list", async (request, response) => {
  const leagues = request.query.leagues
    ? request.query.leagues.split(",").map(Number)
    : defaultLeagues;
  const registry = await buildMatchRegistry(leagues);
  const playerList = getPlayerList(registry, 300);
  response.json(playerList);
});

app.get("/get-players", async (request, response) => {
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
      `[get-players] Starting background fetch loop at page ${playersFetchJob.nextPage}. Interval: 10s.`
    );

    (async function runLoop() {
      while (playersFetchJob.running) {
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
        } catch (error) {
          console.error(`[get-players] Error on page ${page}:`, error);
          playersFetchJob.running = false;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 10000));
      }

      console.log(
        `[get-players] Background loop stopped. Next page is ${playersFetchJob.nextPage}.`
      );
    })();

    response.json({
      success: true,
      message: "Started get-players background loop.",
      intervalSeconds: 10,
      startPage: playersFetchJob.nextPage,
    });
  } catch (error) {
    playersFetchJob.running = false;
    console.error("Error fetching players profiles:", error);
    response.status(500).json({ success: false, message: "Failed to fetch players profiles" });
  }
});

app.get("/match-exists", async (request, response) => {
  let matchID = request.query.matchID;

  try {
    fs.accessSync(`${matchesDir}/${matchID}.json`, fs.constants.R_OK);
    return response.json(await getMatchFromServer(matchID));
  } catch (err) {}
  response.json(null);
});

app.get("/get-matches-on-day", async (request, response) => {
  const registry = await getRegistry();
  let todaysMatches = await matchesOnDay(registry, new Date(request.query.matchDate));
  response.json(todaysMatches);
});

app.get("/find-player-by-id", async (request, response) => {
  let playerID = request.query.playerID;
  response.json(await getPlayerByID(playerID));
});

app.get("/get-matches-by-round", async (request, response) => {
  let leagueID = request.query.leagueID;
  let round = request.query.roundNo;
  let matches = await matchesInRound(round, leagueID);
  response.json(matches);
});

app.get("/get-all-leagues", (req, res) => {
  res.json(allDBLeagues);
});

app.get("/get-leagues-from-api", async (req, res) => {
  try {
    const type = req.query.type || "league";
    const result = await getLeaguesByType(type);
    res.json(result);
  } catch (error) {
    console.error("Error fetching leagues from external API:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leagues from API",
    });
  }
});

app.get("/insert-all-clubs-to-db", async (req, res) => {
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
  insertTeamsToDb(teamsNew);
  console.log(teamsNew);
});
