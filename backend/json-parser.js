import { readFile } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { PORT } from "./config.js";
import { getResultsDate, getResultFromApi } from "./../webapi-handler.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
const app = express();
app.use(express.json());

app.get("/about", (req, res) => {
  res.send("Welcome to about us page");
});

console.log(__dirname);
app.get("/starting11", (req, res) => {
  res.sendFile(path.resolve(__dirname + "/../pitch/palya.html"));
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
  let responseToSend = "";

  for (const leagueID of leagueIDs) {
    console.log("Delayed for 1 second.");

    let dataToWrite = await getResultsDate(leagueID);

    fs.writeFile(
      `../data/leagues/${leagueID}.json`,
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
  console.log(matchID);

  fs.writeFile(
    `../data/matches/${matchID}.json`,
    JSON.stringify(dataToWrite.response),
    { flag: "wx" },
    function (err) {
      if (err) {
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

  for (const leagueID of leagueIDs) {
    let data = JSON.parse(
      await readFile(`../data/leagues/${leagueID}.json`, "utf8")
    );
    console.log(data[0]);

    for (const element of data) {
      if (["FT", "AET"].includes(element.fixture.status.short))
        if (!fs.existsSync(`../data/matches/${element.fixture.id}.json`)) {
          matchArr.push(element);
        }
    }
  }
  response.json(matchArr);
});

app.get("/get-league-matches", async (request, response) => {
  let allMatches = [];
  //let leagues = [39, 140, 135, 78, 61, 88, 94, 144, 203, 283];
  let leagues = request.query.leagueID.split(",");
  let matchID;
  console.log(leagues);
  for (let i = 0; i < leagues.length; i++) {
    let leagueID = leagues[i];
    let data = JSON.parse(
      await readFile(`../data/leagues/${leagueID}.json`, "utf8")
    );
    for (const element of data) {
      if (["FT", "AET"].includes(element.fixture.status.short)) {
        matchID = element.fixture.id;
        let data2 = JSON.parse(
          await readFile(`../data/matches/${matchID}.json`)
        );
        allMatches.push(data2);
      }
    }
  }
  return response.json(allMatches);
});

app.get("/get-all-matches", async (request, response) => {
  let bigArr = [];
  const dirname = "../data/matches";
  await readFiles(dirname);
  response.json(bigArr);
});
