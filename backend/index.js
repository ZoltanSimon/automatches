import { readFile } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./config.js";
import { getResultsDate, getResultFromApi } from "../webapi-handler.js";
import {
  getMatchFromServer,
  matchesDir,
  writeLeagueToServer,
  buildTeamList,
  getLeagueFromServer,
} from "./json-reader.js";
import {
  allDBLeagues,
  insertMatchesToQueue,
  getLeagueFromDb,
  allDBTeams,
  insertTeamsToDb,
  getMatchById,
} from "./data-access.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import {
  getPlayerList,
  insertAllPlayers,
  getPlayerByID,
} from "./services/players-service.js";
import { matchesOnDay, matchesInRound, lastMatchesFromLeague } from "./services/matches-service.js";
import * as helpers from "./services/handlebars-helpers.js";
import { groupByLeague, defaultLeagues } from "./services/leagues-service.js";
import { parseDate, parseLeagueIds, handleError } from "./backend-helper.js";

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
    const selectedLeague = parseLeagueIds(req.query.league);

    const [players, matches] = await Promise.all([
      getPlayerList(selectedLeague, 10),
      matchesOnDay(selectedDate)
    ]);

    res.render("home", {
      title: "generationFootball",
      players,
      groupedMatches: groupByLeague(matches),
      selectedDate: selectedDate.toISOString().split("T")[0],
    });
  } catch (error) {
    handleError(res, error, "Error loading home page");
  }
});

app.get("/players", async (req, res) => {
  try {
    const selectedLeague = parseLeagueIds(req.query.league);
    const players = await getPlayerList(selectedLeague, 300, req.query.team);

    res.render("players", {
      title: "Players",
      players,
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

app.get("/teams", (req, res) => {
  res.render("teams", { title: "Teams" });
});

app.get("/admin", async (req, res) => {
  try {
    res.render("admin", {
      title: "Automatches",
      players: await getPlayerList(defaultLeagues, 300, req.query.team),
    });
  } catch (error) {
    console.error("Error fetching players:", error);
    res.status(500).send("Error fetching players");
  }
});

app.get("/starting11", (req, res) => {
  res.render("palya", { title: "Starting 11 Builder" });
});

app.get("/ucl-last-round", (req, res) => {
  res.render("ucl-last-round", { title: "UCL Last Round simulation" });
});

app.get("/league", async (req, res) => {
  try {
    //const selectedLeague = parseLeagueIds("2");
    const selectedLeague = parseLeagueIds(req.query.league || "2");
    console.log(selectedLeague);
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
  let allMatches = [];
  let teamList = [];
  let matchInfo = {};

  // Get the match details to extract the league ID and match info
  let currentMatch = await getMatchById(matchID);
  let leagueID;
  
  if (currentMatch) {
    leagueID = currentMatch.leagueId;
    
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
    console.log(currentMatch);
    // Now get all matches from that league
    let data = await getLeagueFromDb(leagueID);
    for (const element of data) {
      let thisFixture = element.fixture;
      if (["FT", "AET"].includes(thisFixture.status.short)) {
        let fixtureMatchID = thisFixture.id;
        try {
          let matchData = await getMatchFromServer(fixtureMatchID);
          if (matchData) {
            allMatches.push(matchData[0]);
          } else {
            console.warn(`No data found for matchID: ${fixtureMatchID}`);
          }
        } catch (error) {
          console.error(`Error fetching match with ID ${fixtureMatchID}:`, error);
        }
      }
    }
    
    let fullTeamList = buildTeamList(allMatches);
    
    // Filter to only show the two teams playing in this match
    teamList = fullTeamList.filter(team => 
      team.id === matchInfo.homeTeamId || team.id === matchInfo.awayTeamId
    );

    //make sure homeTeam is first in teamList
    teamList.sort((a, b) => {
      if (a.id === matchInfo.homeTeamId) return -1;
      if (b.id === matchInfo.homeTeamId) return 1;
      return 0;
    });
  }

  response.render("match", { 
    title: "Match Details", 
    matchID, 
    teamList,
    matchInfo 
  });
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
  try {
    let matchID = request.query.matchID;
    let { data, limits } = await getResultFromApi(matchID);

    fs.writeFile(
      `${matchesDir}/${matchID}.json`,
      JSON.stringify(data.response),
      { flag: "wx" },
      function (err) {
        if (err) {
          console.log(err);
        }

        response.json({
          match: data.response,
          limits: limits,
        });
      }
    );
  } catch (err) {
    console.error("Error saving match:", err);
    response.status(500).json({ error: "Something went wrong" });
  }
});

//returns missing matches from given league
app.get("/missing-matches", async (request, response) => {
  let leagueIDs = request.query.leagueID.split(",");
  let matchArr = [];

  if (leagueIDs.length == 0 || !(leagueIDs[0] > 0)) {
    return response.json([]);
  }

  for (const leagueID of leagueIDs) {
    let data = await getLeagueFromDb(leagueID);

    for (const element of data) {
      if (["FT", "AET"].includes(element.fixture.status.short)) {
        try {
          // Check if file exists
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

  response.json(matchArr);
});

app.get("/get-teams", async (request, response) => {
  let leagues = request.query.leagueID.split(",");
  let date = request.query.date;
  let allMatches = [];
  let matchID;
  let filterDate;

  if (date) {
    const [day, month, year] = date.split("-").map(Number);
    filterDate = new Date(year, month - 1, day);
    if (isNaN(filterDate.getTime())) {
      return response
        .status(400)
        .json({
          success: false,
          message: "Invalid date format. Use 'DD-MM-YYYY'.",
        });
    }
  } else {
    filterDate = new Date(2000, 0, 1); // January 1, 2000
  }

  for (let i = 0; i < leagues.length; i++) {
    let leagueID = leagues[i];
    let data = await getLeagueFromDb(leagueID);
    for (const element of data) {
      let thisFixture = element.fixture;
      let fixtureDate = new Date(thisFixture.date);
      if (
        ["FT", "AET"].includes(thisFixture.status.short) &&
        fixtureDate > filterDate
      ) {
        matchID = thisFixture.id;
        try {
          let data2 = await getMatchFromServer(matchID);
          if (data2 && data2[0]) {
            allMatches.push(data2[0]);
          } else {
            console.warn(`No data found for matchID: ${matchID}`);
          }
        } catch (error) {
          console.error(`Error fetching match with ID ${matchID}:`, error);
        }
      }
    }
  }
  response.json(buildTeamList(allMatches));
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
