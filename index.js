import { readFile } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./backend/config.js";
import { getResultsDate, getResultFromApi } from "./webapi-handler.js";
import { getPlayerGoalList, getMatch } from "./backend/json-reader.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
const app = express();

app.use(express.json());

app.engine("handlebars", engine());
app.set("views", __dirname + "/views");
app.set("view engine", "handlebars");
app.use(express.static("./"));

app.get("/", (req, res) => {
  res.render("home", { title: "Home Page" });
});

app.get("/about", (req, res) => {
  res.render("about", { title: "About Page" });
});

app.get("/players", (req, res) => {
  res.render("players", { title: "Players" });
});

app.get("/teams", (req, res) => {
  res.render("teams", { title: "Teams" });
});

app.get("/admin", (req, res) => {
  res.render("admin", { title: "Automatches" });
});

app.get("/starting11", (req, res) => {
  res.render("palya", { title: "Palya" });
});

app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

const require = createRequire(import.meta.url);
const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions)); // Use this after the variable declaration

app.get("/status", (request, response) => {
  const status = {
    Status: "Running",
  };

  response.send(status);
});

//updates the given league's json file
app.get("/update-leagues", async (request, response) => {
  let leagueIDs = request.query.leagueID.split(",");
  let seasons = request.query.seasons.split(",");
  let responseToSend = "";

  for (let i = 0; i < leagueIDs.length; i++) {
    let leagueID = leagueIDs[i];
    let season = seasons[i];

    let dataToWrite = await getResultsDate(leagueID, season);

    fs.writeFile(
      `./data/leagues/${leagueID}.json`,
      JSON.stringify(dataToWrite.response),
      function (err) {
        if (err) {
          return console.log(err);
        }
        responseToSend += `${leagueID} was saved!<br/>`;
      }
    );
  }
  response.send(responseToSend);
});

//saves match
app.get("/save-match", async (request, response) => {
  let matchID = request.query.matchID;
  let dataToWrite = await getResultFromApi(matchID);
  //console.log(matchID);

  fs.writeFile(
    `./data/matches/${matchID}.json`,
    JSON.stringify(dataToWrite.response),
    { flag: "wx" },
    function (err) {
      if (err) {
        console.log(err);
        console.log("Already exists");
        //throw err;
      }
      response.json(dataToWrite.response);
    }
  );
});

//returns missing matches from given league
app.get("/missing-matches", async (request, response) => {
  let leagueIDs = request.query.leagueID.split(",");
  let matchArr = [];

  if (leagueIDs.length == 0 || !(leagueIDs[0] > 0)) {
    return response.json([]);
  } else {
    for (const leagueID of leagueIDs) {
      let data = JSON.parse(
        await readFile(`./data/leagues/${leagueID}.json`, "utf8")
      );
      console.log(data[0]);

      for (const element of data) {
        if (["FT", "AET"].includes(element.fixture.status.short))
          if (!fs.existsSync(`./data/matches/${element.fixture.id}.json`)) {
            matchArr.push(element);
          }
      }
    }
    response.json(matchArr);
  }
});

app.get("/get-league-matches", async (request, response) => {
  let allMatches = [];
  //let leagues = [39, 140, 135, 78, 61, 88, 94, 144, 203, 283];
  let leagues = request.query.leagueID.split(",");
  let matchID;

  if (leagues.length == 0 || !(leagues[0] > 0)) {
    return response.json([]);
  } else {
    for (let i = 0; i < leagues.length; i++) {
      let leagueID = leagues[i];
      let data = JSON.parse(
        await readFile(`./data/leagues/${leagueID}.json`, "utf8")
      );
      for (const element of data) {
        if (["FT", "AET"].includes(element.fixture.status.short)) {
          matchID = element.fixture.id;
          let data2 = await getMatch(matchID);
          allMatches.push(data2);
        }
      }
    }
    response.json(allMatches);
  }
});

app.get("/get-all-matches", async (request, response) => {
  let bigArr = [];
  const dirname = "./data/matches";
  await readFile(dirname);
  response.json(bigArr);
});

/*app.get("/get-player-stats", async (request, response) => {
  let player = request.query.player;
  let leagues = request.query.leagues.split(",");
  let playerStats = await getLocalPlayerStats(player, leagues);
  return response.json(playerStats);
});*/

app.get("/get-player-list", async (request, response) => {
  let leagues = request.query.leagues.split(",");
  let playerList = await getPlayerGoalList(leagues);
  return response.json(playerList);
});

app.get("/match-exists", async (request, response) => {
  let matchID = request.query.matchID;
  if (fs.existsSync(`./data/matches/${matchID}.json`)) {
    return response.json(true);
  }
  return response.json(false);
});
