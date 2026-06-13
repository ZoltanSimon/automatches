import { readFile } from "fs/promises";
import * as fs from "fs";
import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./config.js";
import { getResultsDate, getLeaguesByType } from "./webapi-handler.js";
import { createApiRouter } from "./api.js";
import {
  getMatchFromServer,
  matchesDir,
  writeLeagueToServer,
  buildTeamList,
  getLeagueFromServer,
  saveMatchToServer,
} from "./json-reader.js";
import {
  getLeagueFromDb,
  insertTeamsToDb,
  getLeagueStandingsFromDb,
  getLeagueSeason,
  loadLeagues,
  loadPlayers,
  loadTeams,
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
import { parseDate, parseLeagueIds, handleError, mergeWorldCupGroupStandings, resolveLeagueStandingsForPage } from "./backend-helper.js";
import { extractTeams, getTopTeams } from "./services/teams-service.js";
import { buildMatchRegistry, refreshRegistry, getRegistry } from "./services/registry-service.js";
import { getPredictionForMatch } from "./services/prediction-service.js";
import { LineupParser } from "../classes/lineupparser.js";
import { comparePositionsByDisplayOrder } from "./backend-helper.js";

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
app.use((req, res, next) => {
  res.locals.headerLeagues = allDBLeagues || [];
  next();
});
app.use(
  createApiRouter({
    setAllDbState: ({ players, teams, leagues }) => {
      allDBPlayers = players;
      allDBTeams = teams;
      allDBLeagues = leagues;
    },
  })
);

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
    const selectedPositions = req.query.pposition
      ? [...new Set(
        String(req.query.pposition)
          .split(",")
          .map((position) => position.trim().toLowerCase())
          .filter(Boolean)
      )]
      : [];
    const positionOptions = [...new Set(LineupParser.formations.flatMap((formation) => formation.positions))]
      .sort(comparePositionsByDisplayOrder)
      .map((position) => ({
        value: position.toLowerCase(),
        label: position,
      }));
    const registry = await getRegistry();
    const players = getPlayerList(registry, 500, req.query.team, selectedLeague, selectedPositions);

    res.render("players", {
      title: "Players",
      description: "Discover detailed football player stats, performance metrics and league comparisons on Generation Football's Players page.",
      players,
      leagues: allDBLeagues.filter(league => league.type === 'league'),
      selectedPLeagues: selectedLeague,
      selectedPPositions: selectedPositions,
      positionOptions,
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
  const selectedTeamID = Number(thisTeam.ID);
  let teamStats = fullTeamList.filter(team => Number(team.id) === selectedTeamID);
  let matchesToShow = (await allTeamMatches(registry, thisTeam.ID, null, false))
    .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));

  if (!teamStats.length && matchesToShow.length) {
    const fallbackTeamList = buildTeamList(matchesToShow);
    teamStats = fallbackTeamList.filter(team => Number(team.id) === selectedTeamID);
    console.log(`team stats fallback used for team ${selectedTeamID}, matches: ${matchesToShow.length}`);
  }

  if (!teamStats.length) {
    return res.redirect("/");
  }

  teamStats[0].leagues = [...teamStats[0].leagues.values()].map((league) => {
    const leagueFromDb = allDBLeagues.find((dbLeague) => Number(dbLeague.id) === Number(league.id));

    return {
      ...league,
      name: league.name || leagueFromDb?.name || `Competition ${league.id}`,
    };
  });

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
    const parsed = parseFloat(req.query.id);
    const selectedLeague = isNaN(parsed) ? 39 : parsed;
    const selectedSeason = getLeagueSeason(selectedLeague, req.query.season);
    const defaultSeason = getLeagueSeason(selectedLeague);
    const leagueInfo = allDBLeagues.find((league) => league.id === selectedLeague);
    const registry = await buildMatchRegistry([
      { leagueID: selectedLeague, season: selectedSeason },
    ]);

    const players = getPlayerList(registry, 10, null, [selectedLeague]);
    const { matches, rounds, currentRound } = await lastMatchesFromLeague(registry, selectedLeague);
    const standingsFromRegistry = getLeagueStandings(registry, selectedLeague);
    const savedStandings = selectedSeason === defaultSeason
      ? await getLeagueStandingsFromDb(selectedLeague)
      : [];
    const standings = resolveLeagueStandingsForPage(standingsFromRegistry, savedStandings);
    const worldCupGroups = selectedLeague === 1
      ? mergeWorldCupGroupStandings(await getLeagueStandingsFromDb(1), registry)
      : [];
    const leagueNation = leagueInfo
      ? allDBTeams.find((nation) => nation.ID == leagueInfo.nation)
      : null;

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
    });
  } catch (error) {
    handleError(res, error, "Error loading league page");
  }
});

app.get("/match", async (request, response) => {
  const { matchID } = request.query;
  const matchKey = Number.isNaN(Number(matchID)) ? matchID : Number(matchID);

  const registry = await getRegistry();
  const savedMatch = await getMatchFromServer(matchID);
  const currentMatch =
    registry.matchByID.get(matchKey) ??
    savedMatch?.[0] ??
    savedMatch ??
    registry.fixtures.find(f => f.fixture.id == matchID);

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
  res.render("palya", { title: "Starting 11 Builder", description: "Build and explore the best starting 11 lineups for your favorite football teams on Generation Football's Starting 11 page." });
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
  }
console.log(`Total missing matches across leagues ${leagueIDs.join(", ")}: ${matchArr.length}`);
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
  const insertedPlayers = await insertAllPlayers();
  allDBPlayers = await loadPlayers();

  response.json({
    success: true,
    inserted: Array.isArray(insertedPlayers) ? insertedPlayers.length : 0,
    loadedPlayers: allDBPlayers.length,
  });
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
