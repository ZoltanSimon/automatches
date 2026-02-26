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
  allDBLeagues,
  getLeagueFromDb,
  allDBTeams,
  insertTeamsToDb,
  getMatchById,
  getAllMatchesFromDbUntilDate,
  insertMatchesToQueue
} from "./data-access.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import {
  getPlayerList,
  insertAllPlayers,
  getPlayerByID,
  getTeamPlayerList,
} from "./services/players-service.js";
import { matchesOnDay, matchesInRound, lastMatchesFromLeague, allTeamMatches } from "./services/matches-service.js";
import * as helpers from "./services/handlebars-helpers.js";
import { groupByLeague, defaultLeagues } from "./services/leagues-service.js";
import { parseDate, parseLeagueIds, handleError } from "./backend-helper.js";
import { extractTeams } from "./services/teams-service.js";

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


app.get("/", async (req, res) => {
  try {
    const selectedDate = parseDate(req.query.date);
    const selectedPlayerLeague = parseLeagueIds(req.query.pleague);
    const selectedTeamLeague = parseLeagueIds(req.query.tleague);
    const parsed = parseFloat(req.query.sleague);
    const selectedStandingsLeague = isNaN(parsed) ? 39 : parsed;
    
    const [players, matches, teams] = await Promise.all([
      getPlayerList(selectedPlayerLeague, 10),
      matchesOnDay(selectedDate),
      extractTeams(selectedTeamLeague)
    ]);
    
    teams.sort((a, b) => a.last5PerGame.points < b.last5PerGame.points ? 1 : b.last5PerGame.points < a.last5PerGame.points ? -1 : 0);
    
    res.render("home", {
      title: "generationFootball",
      players,
      groupedMatches: groupByLeague(matches),
      selectedDate: selectedDate.toISOString().split("T")[0],
      leagues: allDBLeagues.filter(league => league.type === 'league'),
      selectedPLeagues: selectedPlayerLeague.length > 0 ? selectedPlayerLeague : defaultLeagues,
      selectedTLeagues: selectedTeamLeague.length > 0 ? selectedTeamLeague : defaultLeagues,
      selectedSLeague: selectedStandingsLeague,
      teams: teams.slice(0, 10),
      standingsLink: `/league?league=${selectedStandingsLeague}` 
    });
  } catch (error) {
    handleError(res, error, "Error loading home page");
  }
});

app.get("/players", async (req, res) => {
  try {
    const selectedLeague = parseLeagueIds(req.query.pleague);
    const players = await getPlayerList(selectedLeague, 300, req.query.team);

    res.render("players", {
      title: "Players",
      players,
      leagues: allDBLeagues.filter(league => league.type === 'league'),
      selectedPLeagues: selectedLeague.length > 0 ? selectedLeague : defaultLeagues,
    });
  } catch (error) {
    handleError(res, error, "Error fetching players");
  }
});

app.get("/about", (req, res) => {
  res.render("about", { title: "About Page" });
});

app.get("/compare-players", (req, res) => {
  res.render("compare-players", { title: "Compare Players" });
});

app.get("/top-teams", async (req, res) => {
  let selectedTeamLeague = parseLeagueIds(req.query.tleague);
  let teams = await extractTeams(selectedTeamLeague);
  teams.sort((a, b) => a.last5PerGame.points < b.last5PerGame.points ? 1 : b.last5PerGame.points < a.last5PerGame.points ? -1 : 0);
  res.render("top-teams", { 
    title: "Teams",
    teams: teams.slice(0,150),
    leagues: allDBLeagues.filter(league => league.type === 'league'),
     selectedTLeagues: selectedTeamLeague.length > 0 ? selectedTeamLeague : defaultLeagues,
  });
});

app.get("/team", async (req, res) => {

  let thisTeam = allDBTeams.find(t => t.ID == req.query.teamID);
  let allMatches = await allTeamMatches(thisTeam.ID, null, false);
  let fullTeamList = buildTeamList(allMatches); 
  let teamStats = fullTeamList.filter(team => 
    team.id === thisTeam.ID
  );

  let matchesToShow = allMatches;
  matchesToShow.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
  matchesToShow = matchesToShow.slice(0, 15);
  teamStats[0].leagues = [...teamStats[0].leagues.values()];

  res.render("team", { 
    title: thisTeam ? thisTeam.name : "Team",
    thisTeam: thisTeam,
    players: await getTeamPlayerList(allMatches, thisTeam.ID),
    matches: (matchesToShow), 
    teamStats: teamStats,  
  });
});

app.get("/admin", async (req, res) => {
  try {
    res.render("admin", {
      title: "Automatches",
      players: await getPlayerList(defaultLeagues, 300, req.query.team),
      leagues: allDBLeagues,
    });
  } catch (error) {
    console.error("Error fetching players:", error);
    res.status(500).send("Error fetching players");
  }
});

app.get("/starting11", (req, res) => {
  res.render("palya", { title: "Starting 11 Builder" });
});

app.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy", { title: "Privacy Policy" });
});


app.get("/ucl-last-round", async (req, res) => {
  let matches = await matchesInRound(8, 2);
  console.log(matches);
  res.render("ucl-last-round", { 
    title: "UCL Last Round simulation",
    matches, 
  });
});

app.get("/league", async (req, res) => {
  try {
    const selectedLeague = parseLeagueIds(req.query.league || "2");
    const [players, matches] = await Promise.all([
      getPlayerList(selectedLeague, 10),
      lastMatchesFromLeague(selectedLeague, 10)
    ]);

    res.render("league", {
      title: "League",
      players,
      groupedMatches: groupByLeague(matches),
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

app.get("/player", async (request, response) => {

});

app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
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
  const leagues = request.query.leagueID.split(",");
  const date = request.query.date;

  try {
    const result = await extractTeams(leagues, date);
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
  let leagues = request.query.leagues
    ? request.query.leagues.split(",")
    : defaultLeagues;
  let playerList = await getPlayerList(leagues, 300);
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
  let todaysMatches = await matchesOnDay(new Date(request.query.matchDate));
  response.json(todaysMatches);
});

app.get("/find-player-by-id", async (request, response) => {
  let playerID = request.query.playerID;
  response.json(await getPlayerByID(playerID));
});

app.get("/get-matches-by-round", async (request, response) => {
  let leagueID = request.query.leagueID;
  let round = request.query.roundNo;
console.log(`Fetching matches for leagueID: ${leagueID}, round: ${round}`);
  let matches = await matchesInRound(round, leagueID);
  console.log(`Found ${matches.length} matches for leagueID: ${leagueID}, round: ${round}`);
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
