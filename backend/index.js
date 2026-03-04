import { readFile } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./config.js";
import { getResultsDate } from "../webapi-handler.js";
import {
  getMatchFromServer,
  matchesDir,
  writeLeagueToServer,
  buildTeamList,
  getLeagueFromServer,
  saveMatchToServer
} from "./json-reader.js";
import {
  getLeagueFromDb,
  insertTeamsToDb,
  getMatchById,
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
} from "./services/players-service.js";
import { matchesOnDay, matchesInRound, lastMatchesFromLeague, allTeamMatches } from "./services/matches-service.js";
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
      title: "generationFootball",
      players,
      groupedMatches: groupByLeague(matches),
      selectedDate: selectedDate.toISOString().split("T")[0],
      leagues: allDBLeagues.filter((league) => league.type === "league"),
      selectedPLeagues: selectedPlayerLeague,
      selectedTLeagues: selectedTeamLeague,
      selectedSLeague: selectedStandingsLeague,
      teams: teams.slice(0, 10),
      standingsLink: `/league?league=${selectedStandingsLeague}`,
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
    const players = getPlayerList(registry, 300, req.query.team);

    res.render("players", {
      title: "Players",
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
    teams: teams.slice(0,150),
    leagues: allDBLeagues.filter(league => league.type === 'league'),
     selectedTLeagues: selectedTeamLeague,
  });
});

app.get("/team", async (req, res) => {
  let thisTeam = allDBTeams.find(t => t.ID == req.query.teamID);
  const registry = await getRegistry();
  let fullTeamList = extractTeams(registry, null, [], thisTeam.ID);
  let teamStats = fullTeamList.filter(team => 
    team.id === thisTeam.ID
  );

  teamStats[0].leagues = [...teamStats[0].leagues.values()];
  let matchesToShow = allTeamMatches(registry, thisTeam.ID).sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
  res.render("team", { 
    title: thisTeam ? thisTeam.name : "Team",
    thisTeam: thisTeam,
    players: getPlayerList(registry, 100, thisTeam.ID),
    matches: matchesToShow, 
    teamStats: teamStats,  
  });
});

app.get("/admin", async (req, res) => {
  const registry = await getRegistry();
  try {
    res.render("admin", {
      title: "Automatches",
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
    matches, 
  });
});

app.get("/league", async (req, res) => {
  try {
    const parsed = parseFloat(req.query.league);
    const selectedLeague = isNaN(parsed) ? 39 : parsed;

    const registry = await getRegistry();

    const players = getPlayerList(registry, 10, null, [selectedLeague]);
    const matches = await lastMatchesFromLeague(selectedLeague, 10);
    const standings = getLeagueStandings(registry, selectedLeague);

    res.render("league", {
      title: "League",
      players,
      groupedMatches: groupByLeague(matches),
      standings: standings
    });
  } catch (error) {
    handleError(res, error, "Error loading home page");
  }
});

app.get("/match", async (request, response) => {
  let matchID = request.query.matchID;
  let teamList = [];
  let matchInfo = {};

  // Get the match details to extract the league ID and match info
  let currentMatch = await getMatchById(matchID);
  
  if (currentMatch) { 
    // Extract match information
    matchInfo = {
      homeTeamId: currentMatch.homeTeamId,
      homeTeamName: currentMatch.homeTeamName,
      awayTeamId: currentMatch.awayTeamId,
      awayTeamName: currentMatch.awayTeamName,
      date: currentMatch.fixtureDate,
      status: currentMatch.fixtureStatus,
      homeGoals: currentMatch.homeGoals,
      awayGoals: currentMatch.awayGoals
    };
    let allMatches = await allTeamMatches(matchInfo.homeTeamId, matchInfo.awayTeamId);

    let fullTeamList = buildTeamList(allMatches);

    teamList = fullTeamList.filter(team => 
      team.id === matchInfo.homeTeamId || team.id === matchInfo.awayTeamId
    );

    //make sure homeTeam is first in teamList
    teamList.sort((a, b) => {
      if (a.id === matchInfo.homeTeamId) return -1;
      if (b.id === matchInfo.homeTeamId) return 1;
      return 0;
    });

    for (let team of teamList) {
      team.matches.sort((a, b) => new Date(b.date) - new Date(a.date));
      team.matches = team.matches.slice(0, 5);
    }
  }

  response.render("match", { 
    title: "Match Details", 
    matchID, 
    teamList,
    matchInfo 
  });
});

app.get("/starting11", (req, res) => {
  res.render("palya", { title: "Starting 11 Builder" });
});

app.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy", { title: "Privacy Policy" });
});

app.get("/about", (req, res) => {
  res.render("about", { title: "About Page" });
});

app.get("/compare-players", (req, res) => {
  res.render("compare-players", { title: "Compare Players" });
});

app.get("/player", async (request, response) => {
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
  getAllMatchesFromDbUntilDate(today);
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

  //download the last 50 matches from matchArr and save them to the server, wait 7 seconds after one download to avoid hitting the API rate limit
  const matchesToDownload = Math.min(50, matchArr.length);
  for (let i = 0; i < matchesToDownload; i++) {
    const match = matchArr[i];
    const remaining = matchArr.length - (i + 1);
    try {
      await saveMatchToServer(match.fixtureId);
      console.log(`Saved match with ID: ${match.fixtureId} (${remaining} left)`);
    } catch (err) {
      console.error(`Error saving match with ID: ${match.fixtureId}`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, 7000));
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
