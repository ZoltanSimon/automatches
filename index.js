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
  buildTeamList,
} from "./backend/json-reader.js";
import { allLeagues} from "./backend/data-access.js"; 
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

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

app.get("/compare-players", (req, res) => {
  res.render("compare-players", { title: "Compare Players" });
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

app.get("/ucl-last-round", (req, res) => {
  res.render("ucl-last-round", { title: "UCL Last Round simulation" });
});

app.listen(PORT, () => {
  console.log("Server Listening on PORT:", PORT);
});

const require = createRequire(import.meta.url);
const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

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
  let dataToWrite = await getResultFromApi(matchID);

  fs.writeFile(
    `${matchesDir}/${matchID}.json`,
    JSON.stringify(dataToWrite.response),
    { flag: "wx" },
    function (err) {
      if (err) {
        console.log(err);
        console.log("Already exists");
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
      return response.status(400).json({ success: false, message: "Invalid date format. Use 'DD-MM-YYYY'." });
    }
  } else {
    filterDate = new Date(2000, 0, 1); // January 1, 2000
  }

  for (let i = 0; i < leagues.length; i++) {
    let leagueID = leagues[i];
    let data = await getLeagueFromServer(leagueID);
    for (const element of data) {
      let thisFixture = element.fixture;
      let fixtureDate = new Date(thisFixture.date);
      if (["FT", "AET"].includes(thisFixture.status.short) && fixtureDate > filterDate) {
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

app.get("/get-all-players", async (request, response) => {
  let allPlayers = await getAllPlayers(
    "club",
    allLeagues.filter((el) => el.type == "league"),
    allLeagues.filter((el) => el.type == "nt")
  );

  try {
    // Create a database connection
    const connection = await mysql.createConnection(dbConfig);

    // Insert players into the database
    for (const player of allPlayers) {
      const { id, name, club, nation } = player;
      await connection.execute(
        'INSERT IGNORE INTO Player (id, name, club, nation) VALUES (?, ?, ?, ?)',
        [id, name, club, nation]
      );
    }

    await connection.end(); // Close the connection
    response.status(200).json({ message: 'Players loaded successfully!' }); // Send a success response
  } catch (error) {
    response.status(500).json({ error: 'Error loading players.', details: error.message });
  }
  
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

app.get("/get-matches-on-day", async (request, response) => {
  let todaysMatches = [];
  let checkDate = new Date(request.query.matchDate) || new Date();

  for (let i=0; i<allLeagues.length; i++) {
    let leagueID = allLeagues[i].id;
    let data = await getLeagueFromServer(leagueID);

    for (const element of data) {
      let fixtureDate = new Date(element.fixture.date);
      if (fixtureDate.toDateString() === checkDate.toDateString()) {
        todaysMatches.push(element);
      }
    }
  }
  response.json(todaysMatches);
});

app.get("/find-player-by-id", async (request, response) => {
  let playerID = request.query.playerID;
  response.json(await getPlayerByID(playerID));
});

app.get("/get-matches-by-round", async (request, response) => {
  let leagueID = request.query.leagueID;
  let round = request.query.roundNo;
  let data = await getLeagueFromServer(leagueID);
  let matches = data.filter((element) => element.league.round == round);

  for (let i = 0; i < matches.length; i++) {
    let matchID = matches[i].fixture.id;
    let matchData = await getMatchFromServer(matchID);
    if (matchData && matchData[0]) {
      matches[i] = matchData[0];
    }
  }
  
  response.json(matches);
});

app.get("/get-all-leagues", (req, res) => {
  res.json(allLeagues);
});