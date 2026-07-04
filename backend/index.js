import express from "express";
import { engine } from "express-handlebars";
import { PORT } from "./config.js";
import { createApiRouter } from "./api/private.js";
import { createPublicRouter } from "./api/public.js";
import {
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
  getPlayerPageData,
  parseSelectedPositions,
  buildPositionOptions,
} from "./services/players-service.js";
import { matchesOnDay, matchesInRound, getMatchById, getMatchPageData } from "./services/matches-service.js";
import * as helpers from "./services/handlebars-helpers.js";
import { groupByLeague, getLeagueStandings, getLeagueById, getLeaguePageData } from "./services/leagues-service.js";
import { parseDate, parseLeagueIds, handleError, mergeWorldCupGroupStandings } from "./backend-helper.js";
import { getTeamById, getTopTeams, getTeamRouteData } from "./services/teams-service.js";
import { buildMatchRegistry, refreshRegistry, getRegistry, ensureMatchInRegistry } from "./services/registry-service.js";

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
  "/api",
  createApiRouter({
    setAllDbState: ({ players, teams, leagues }) => {
      allDBPlayers = players;
      allDBTeams = teams;
      allDBLeagues = leagues;
    },
  })
);
app.use("/", createPublicRouter());

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
  setInterval(() => {
    refreshRegistry().catch((error) => {
      console.error("Scheduled registry refresh failed:", error);
    });
  }, 30 * 60 * 1000);
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
    
    const defaultSeason = new Date().getFullYear();
    const { knockoutRounds } = await getLeaguePageData(registry, 1, defaultSeason, defaultSeason);

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
      worldCupGroups,
      knockoutRounds,
    });
  } catch (error) {
    handleError(res, error, "Error loading home page");
  }
});

app.get("/top-players", async (req, res) => {
  try {
    const selectedLeague = parseLeagueIds(req.query.pleague);
    const selectedPositions = parseSelectedPositions(req.query.pposition);
    const teamQuery = req.query.team;
    const registry = await getRegistry();
    const players = getPlayerList(registry, 500, teamQuery, selectedLeague, selectedPositions);

    res.render("top-players", {
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
  const {
    matches,
    teamStats,
    teamPlayers,
    showAllPlayerStats,
    selectedPlayerStatsLeague,
    selectedPlayerStatsLeagueName,
  } = await getTeamRouteData(registry, thisTeam.ID, req.query.allStats);

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
    showAllPlayerStats,
    selectedPlayerStatsLeague,
    selectedPlayerStatsLeagueName,
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
      knockoutRounds,
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
      knockoutRounds,
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
  let currentMatch = getMatchById(registry, matchID);

  if (!currentMatch && matchID) {
    currentMatch = await ensureMatchInRegistry(registry, matchID);
  }

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
  const headerLeagueName = typeof currentMatch?.league?.name === "string" && currentMatch.league.name.trim()
    ? currentMatch.league.name.trim()
    : leagueName;
  
  response.render("match", {
    title: teamList.map(team => team.name).join(" vs ") + " - " + leagueName  + " - Football Match Details",
    description: "Explore detailed stats, player performances and match events for this football match on Generation Football's Match page.",
    matchID,
    teamList,
    matchInfo: currentMatch,
    headerLeagueName,
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



