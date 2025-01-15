import { readFile } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./backend/config.js";
import { getResultsDate, getResultFromApi } from "./webapi-handler.js";
import {
  getPlayerGoalList,
  getMatchFromServer,
  matchesDir,
  getAllPlayers,
  getLeagueFromServer,
  writeLeagueToServer,
  players,
} from "./backend/json-reader.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import { allLeagues } from "./data/leagues.js";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
const app = express();

app.use(express.json());

const partialsPath = path.join(__dirname, "/views/partials"); 
console.log("Partials Directory:", partialsPath);
console.log("Files in Partials Directory:", fs.readdirSync(partialsPath)); 

app.engine(
  "handlebars",
  engine({
    partialsDir: [partialsPath] // Use the variable directly
  })
);

app.set("views", __dirname + "/views");
app.set("view engine", "handlebars");
app.use(express.static("./"));

app.get("/", (req, res) => {
  res.render("home", { title: "generationFOOTBALL - Home" });
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
  res.render("palya", { title: "Starting 11 Builder" });
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

app.use(cors(corsOptions));

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

    responseToSend += await writeLeagueToServer(leagueID, dataToWrite.response);
  }
  response.send(responseToSend);
});

//saves match
app.get("/save-match", async (request, response) => {
  let matchID = request.query.matchID;
  let dataToWrite = await getResultFromApi(matchID);

  fs.writeFile(
    `${matchesDir}/${matchID}.json`,
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
      let data = await getLeagueFromServer(leagueID);

      for (const element of data) {
        if (["FT", "AET"].includes(element.fixture.status.short))
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

  response.json(matchArr);
});

app.get("/get-league-matches", async (request, response) => {
  let allMatches = [];
  let leagues = request.query.leagueID.split(",");
  let matchID;

  if (leagues.length == 0 || !(leagues[0] > 0)) {
    return response.json([]);
  } else {
    for (let i = 0; i < leagues.length; i++) {
      let leagueID = leagues[i];
      let data = await getLeagueFromServer(leagueID);
      for (const element of data) {
        if (["FT", "AET"].includes(element.fixture.status.short)) {
          matchID = element.fixture.id;
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
    response.json(allMatches);
  }
});

app.get("/get-all-matches", async (request, response) => {
  let bigArr = [];
  await readFile(matchesDir);
  response.json(bigArr);
});

app.get("/get-all-players", async (request, response) => {
  let allPlayers = await getAllPlayers(
    "club",
    allLeagues.filter((el) => el.type == "league"),
    allLeagues.filter((el) => el.type == "nt")
  );
  // Create a 3rd array with elements in allPlayers but not in players
  const difference = allPlayers.filter(
    (player) => !players.some((p) => p.id === player.id)
  );
  response.json(difference);
});

app.get("/get-player-list", async (request, response) => {
  let leagues = request.query.leagues.split(",");
  let playerList = await getPlayerGoalList(leagues);
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

app.get("/get-league", async (request, response) => {
  let leagueID = request.query.leagueID;
  response.json(await getLeagueFromServer(leagueID));
});

app.get("/find-player-by-id", async (request, response) => {
  let playerID = request.query.playerID;
  response.json(await getPlayerByID(playerID));
});
