import express from "express";
import { create as createHandlebars } from "express-handlebars";
import { PORT } from "./config.js";
import { createApiRouter } from "./api/private.js";
import { createPublicRouter } from "./api/public.js";
import {
  getLatestTransfers,
  getTransfersByPlayer,
  getTransfersByTeam,
  loadLeagues,
  loadPlayers,
  loadTeams,
  getTeamEloMap,
  ensureEloTables,
} from "./data-access.js";
import { getLeagueSeason } from "./lib/league-season.js";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import {
  getPlayerList,
  getPlayerPageData,
  getTopPlayersPageData,
} from "./services/players-service.js";
import { matchesOnDay, matchesInRound, getMatchById, getMatchPageData } from "./services/matches-service.js";
import * as helpers from "./services/handlebars-helpers.js";
import { groupByLeague, getLeagueStandings, getLeagueById, getLeaguePageData, parseLeagueIds, defaultLeagues } from "./services/leagues-service.js";
import { parseDate, handleError, isLocalRequest } from "./lib/backend-helper.js";
import { getTeamById, getTopTeams, getTeamRouteData, getTopTeamsPageData } from "./services/teams-service.js";
import { getLeagueSeasonRegistry, refreshRegistry, getRegistry, ensureMatchInRegistry } from "./services/registry-service.js";
import { allDBLeagues, setCatalog } from "./lib/catalog.js";
import { initPlayerPositions, processDirtyPlayerPositions } from "./services/player-position-service.js";
import { catalogPlayer, leagueUrl, matchUrl, playerUrl, teamUrl } from "./lib/site-urls.js";
import { createLegacyRedirectRouter } from "./lib/legacy-redirects.js";
import { createSeoRouter } from "./lib/seo-routes.js";
import { breadcrumbList, jsonLd, matchSchema, playerSchema, redirectToCanonical, teamSchema, websiteSchema, articleSchema, DEFAULT_OG_IMAGE, SITE_NAME } from "./lib/seo.js";
import { absoluteUrl, isoDay, parseSeasonLabel, seasonLabel, wikiPath } from "../shared/urls.js";
import { getLegacyAnchorMap, getWikiArticle, getWikiArticles, initWiki } from "./services/wiki-service.js";

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

const handlebarsEngine = createHandlebars({
  partialsDir: [partialsPath],
  helpers,
});
app.engine("handlebars", handlebarsEngine.engine);
initWiki({ handlebarsEngine });

app.use(express.json());
app.set("views", __dirname + "./../views");
app.set("view engine", "handlebars");
// Only expose the folders and files the browser actually needs. Serving the
// whole repo root would leak backend/config.js and let files shadow routes.
const repoRoot = path.join(__dirname, "..");
for (const dir of ["css", "images", "controllers", "components", "classes", "shared"]) {
  app.use(`/${dir}`, express.static(path.join(repoRoot, dir), { fallthrough: false }));
}
for (const file of [
  "favicon.ico",
  "ads.txt",
  "common-functions.js",
  "common-styles.js",
  "instapics.js",
  "autotext.js",
  "backend/lib/match-xg.js",
]) {
  app.get(`/${file}`, (req, res) => res.sendFile(path.join(repoRoot, file)));
}
app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.locals.headerLeagues = allDBLeagues || [];
  res.locals.isLocal = isLocalRequest(req);
  res.locals.currentPath = req.path;
  // Canonical URL defaults to the path without its query string; routes can
  // override it by passing canonicalPath to res.render.
  res.locals.siteName = SITE_NAME;
  res.locals.canonicalUrl = absoluteUrl(req.path);
  res.locals.ogImageUrl = absoluteUrl(DEFAULT_OG_IMAGE);
  next();
});

// Renders the shared 404 page. Never indexed.
function renderNotFound(req, res, message = "The page you were looking for doesn't exist or has moved.") {
  res.status(404).render("404", {
    title: "Page not found | Generation Football",
    description: message,
    message,
    robots: "noindex, follow",
  });
}
app.use(
  "/api",
  createApiRouter({
    setAllDbState: setCatalog,
  })
);
app.use("/", createPublicRouter());
app.use(createLegacyRedirectRouter({ renderNotFound }));
app.use(createSeoRouter());

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}, loading registry...`);
  setCatalog({
    players: await loadPlayers(),
    teams: await loadTeams(),
    leagues: await loadLeagues(),
  });
  await ensureEloTables();
  try {
    await initPlayerPositions();
  } catch (error) {
    console.error("Loading player positions failed:", error);
  }

  await refreshRegistry(); // build it immediately on startup
  setInterval(() => {
    refreshRegistry()
      .catch((error) => {
        console.error("Scheduled registry refresh failed:", error);
      })
      .then(() => processDirtyPlayerPositions())
      .catch((error) => {
        console.error("Scheduled player position rebuild failed:", error);
      });
  }, 30 * 60 * 1000);
});

app.get("/", async (req, res) => {
  try {
    const selectedDate = parseDate(req.query.date);
    const selectedPlayerLeague = req.query.pleague ? parseLeagueIds(req.query.pleague) : defaultLeagues;
    const selectedTeamLeague = req.query.tleague ? parseLeagueIds(req.query.tleague) : defaultLeagues;
    const parsed = parseFloat(req.query.sleague);
    const selectedStandingsLeague = isNaN(parsed) ? 39 : parsed;
    const selectedTransferLeagues = req.query.league ? parseLeagueIds(req.query.league) : [];
    const registry = await getRegistry();
    const eloByTeamId = await getTeamEloMap();
    const players = getPlayerList(registry, 10, "", selectedPlayerLeague);
    const matches = await matchesOnDay(registry, selectedDate);
    const teams = getTopTeams(registry, selectedTeamLeague, { eloByTeamId });
    const standings = getLeagueStandings(registry, selectedStandingsLeague);
    const latestTransfers = await getLatestTransfers(10, selectedTransferLeagues);

    res.render("home", {
      title: "Generation Football – Football Stats, xG, Elo & Expected Points",
      description: "Today's football matches, league tables, top players and teams, with expected goals, expected points (xPts), Elo ratings and player ratings.",
      players,
      groupedMatches: groupByLeague(matches),
      selectedDate: selectedDate.toISOString().split("T")[0],
      leagues: allDBLeagues.filter((league) => league.type === "league"),
      selectedPLeagues: selectedPlayerLeague,
      selectedTLeagues: selectedTeamLeague,
      selectedSLeague: selectedStandingsLeague,
      selectedLeagues: selectedTransferLeagues,
      teams: teams.slice(0, 10),
      standingsLink: leagueUrl(selectedStandingsLeague),
      jsonLd: jsonLd(websiteSchema()),
      standings: standings,
      standingsTitle: getLeagueById(selectedStandingsLeague)?.name || "Unknown League",
      latestTransfers,
    });
  } catch (error) {
    handleError(res, error, "Error loading home page");
  }
});

app.get("/top-players", async (req, res) => {
  try {
    const registry = await getRegistry();
    const {
      players,
      selectedLeague,
      selectedSortStat,
      selectedSortDirection,
      selectedStatFilter,
      selectedStatFilters,
    } = getTopPlayersPageData(registry, req.query);

    res.render("top-players", {
      title: "Top Football Players – Goals, Assists & Ratings | Generation Football",
      description: "Rank football players across Europe's top leagues by goals, assists, minutes, match ratings and more, with filters by league, position and nationality.",
      players,
      leagues: allDBLeagues.filter((league) => league.type === "league"),
      selectedPLeagues: selectedLeague,
      selectedPSort: selectedSortStat,
      selectedPOrder: selectedSortDirection,
      selectedPFilter: selectedStatFilter,
      selectedPFilters: selectedStatFilters,
    });
  } catch (error) {
    handleError(res, error, "Error fetching players");
  }
});

app.get("/top-teams", async (req, res) => {
  const explicitlyRequestedLeagueIds = parseLeagueIds(req.query.tleague, {
    fallback: [],
    unique: true,
  });
  const explicitlyRequestsWorldCup = explicitlyRequestedLeagueIds.includes(1);

  let selectedTeamLeague = parseLeagueIds(req.query.tleague);
  if (!explicitlyRequestsWorldCup) {
    selectedTeamLeague = selectedTeamLeague.filter((leagueID) => Number(leagueID) !== 1);
  }

  const registry = await getRegistry();
  const eloByTeamId = await getTeamEloMap();
  
  const {
    teams,
    selectedSortStat,
    selectedSortDirection,
    selectedSortColumnIndex,
    selectedStatFilter,
    selectedStatFilters,
  } = getTopTeamsPageData(registry, selectedTeamLeague, req.query, eloByTeamId);

  res.render("top-teams", { 
    title: "Top Football Teams – Form, Elo, xG & xPts | Generation Football",
    description: "Compare football teams across leagues by recent form, Elo rating, expected goals, expected points (xPts) and average team rating.",
    teams: teams.slice(0,150),
    leagues: allDBLeagues.filter(league => league.type === 'league'),
     selectedTLeagues: selectedTeamLeague,
     selectedTSort: selectedSortStat,
     selectedTOrder: selectedSortDirection,
     selectedTColumn: selectedSortColumnIndex,
     selectedTFilter: selectedStatFilter,
     selectedTFilters: selectedStatFilters,
  });
});

app.get("/transfers", async (req, res) => {
  try {
    const selectedLeagues = parseLeagueIds(req.query.league);
    const latestTransfers = await getLatestTransfers(100, selectedLeagues);

    res.render("transfers", {
      title: "Latest Football Transfers | Generation Football",
      description: "Browse the latest confirmed football player transfers, including the clubs involved, transfer dates and reported fees.",
      latestTransfers,
      leagues: allDBLeagues.filter((league) => league.type === "league"),
      selectedLeagues,
    });
  } catch (error) {
    handleError(res, error, "Error loading transfers page");
  }
});

app.get("/team/:id/:slug?", async (req, res) => {
  const thisTeam = getTeamById(req.params.id);
  if (!thisTeam) {
    return renderNotFound(req, res, "We couldn't find that team.");
  }
  const canonicalPath = teamUrl(thisTeam.ID, thisTeam.name);
  if (redirectToCanonical(req, res, canonicalPath)) return;

  const registry = await getRegistry();
  const {
    matches,
    teamStats,
    teamPlayers,
    showAllPlayerStats,
    selectedPlayerStatsLeague,
    selectedPlayerStatsLeagueName,
    squadUpdatedAt,
    transferUpdatedAt,
    eloMonthChange,
    teamStadium,
    teamManager,
    teamNation,
    teamTopScorers,
    topGoals,
    isNationalTeam,
  } = await getTeamRouteData(registry, thisTeam.ID, req.query.allStats);
  const teamTransfers = await getTransfersByTeam(thisTeam.ID, 25);

  if (!teamStats.length) {
    return renderNotFound(req, res, `We don't have any match data for ${thisTeam.name} yet.`);
  }

  const teamKind = isNationalTeam ? "national team" : "club";
  res.render("team", {
    title: `${thisTeam.name} – Elo, xPts, Squad & Fixtures | Generation Football`,
    description: `${thisTeam.name} ${teamKind} stats: Elo rating, expected points, average team rating, squad, results, fixtures and transfers.`,
    canonicalPath,
    ogType: "profile",
    ogImage: `/images/logos/${thisTeam.ID}.png`,
    jsonLd: jsonLd(
      teamSchema({
        name: thisTeam.name,
        path: canonicalPath,
        logoPath: `/images/logos/${thisTeam.ID}.png`,
        stadium: teamStadium || undefined,
        manager: teamManager || undefined,
        nationName: teamNation?.name,
        isNationalTeam,
      }),
      breadcrumbList([["Home", "/"], ["Teams", "/top-teams"], [thisTeam.name, canonicalPath]]),
    ),
    thisTeam,
    players: teamPlayers,
    matches, 
    teamStats,
    teamTransfers,
    showAllPlayerStats,
    selectedPlayerStatsLeague,
    selectedPlayerStatsLeagueName,
    squadUpdatedAt,
    transferUpdatedAt,
    eloMonthChange,
    teamStadium,
    teamManager,
    teamNation,
    teamTopScorers,
    topGoals,
    isNationalTeam,
  });
});

app.get("/admin", async (req, res) => {
  const registry = await getRegistry();
  try {
    res.render("admin", {
      title: "Automatches",
      robots: "noindex, nofollow",
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

app.get("/league/:id/:slug?/:season?", async (req, res) => {
  try {
    const leagueInfo = getLeagueById(req.params.id);
    if (!leagueInfo) {
      return renderNotFound(req, res, "We couldn't find that competition.");
    }
    const selectedLeague = Number(leagueInfo.id);
    const selectedSeason = getLeagueSeason(selectedLeague, parseSeasonLabel(req.params.season));
    const defaultSeason = getLeagueSeason(selectedLeague);
    const canonicalPath = leagueUrl(selectedLeague, selectedSeason);
    if (redirectToCanonical(req, res, canonicalPath)) return;

    const registry = await getLeagueSeasonRegistry(selectedLeague, selectedSeason);
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

    const season = seasonLabel(selectedSeason);
    const isCurrent = selectedSeason === defaultSeason;
    res.render("league", {
      title: `${leagueInfo.name} ${season} – Table, Fixtures & Player Stats | Generation Football`,
      description: `${leagueInfo.name} ${season}${isCurrent ? "" : " season"}: standings with xG and xPts, results, fixtures, top scorers and player ratings.`,
      canonicalPath,
      jsonLd: jsonLd(breadcrumbList([["Home", "/"], [leagueInfo.name, leagueUrl(selectedLeague)], ...(isCurrent ? [] : [[season, canonicalPath]])])),
      players,
      matches: (matches),
      standings: standings,
      worldCupGroups,
      knockoutRounds,
      rounds: rounds,
      currentRound: rounds.includes(req.query.round) ? req.query.round : currentRound,
      leagueID: selectedLeague,
      leagueName: leagueInfo.name,
      leagueSeasons: leagueInfo.seasons ?? [selectedSeason],
      selectedSeason,
      leagueNation: {
        ID: leagueInfo.nation || 0,
        name: leagueNation?.name || "International",
      },
    });
  } catch (error) {
    handleError(res, error, "Error loading league page");
  }
});

app.get("/match/:id/:slug?", async (request, response) => {
  const matchID = request.params.id;

  const registry = await getRegistry();
  let currentMatch = getMatchById(registry, matchID);

  if (!currentMatch && /^\d+$/.test(matchID)) {
    currentMatch = await ensureMatchInRegistry(registry, matchID);
  }

  if (!currentMatch) {
    return renderNotFound(request, response, "We couldn't find that match.");
  }
  const canonicalPath = matchUrl(currentMatch);
  if (redirectToCanonical(request, response, canonicalPath)) return;

  const { teamList, matchStatistics, leagueName, matchElo, headToHead, matchVenue } = await getMatchPageData(registry, currentMatch);
  const headerLeagueName = typeof currentMatch?.league?.name === "string" && currentMatch.league.name.trim()
    ? currentMatch.league.name.trim()
    : leagueName;

  const home = currentMatch.teams?.home ?? {};
  const away = currentMatch.teams?.away ?? {};
  const kickoff = currentMatch.fixture?.date;
  const dateText = kickoff
    ? new Date(kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" })
    : "";
  const finished = ["FT", "AET", "PEN"].includes(currentMatch.fixture?.status?.short);
  const score = finished ? ` ${currentMatch.goals?.home}–${currentMatch.goals?.away} ` : " vs ";
  const matchContext = [headerLeagueName, dateText].filter(Boolean).join(", ");

  response.render("match", {
    title: `${home.name}${score}${away.name}${dateText ? `, ${dateText}` : ""} – xG, Lineups & Stats | Generation Football`,
    description: `${home.name} vs ${away.name}${matchContext ? ` (${matchContext})` : ""}: ${finished ? "result, " : ""}expected goals, lineups, player ratings, Elo change and head-to-head.`,
    canonicalPath,
    jsonLd: jsonLd(
      matchSchema({
        path: canonicalPath,
        home: { name: home.name, path: home.id ? teamUrl(home.id, home.name) : null },
        away: { name: away.name, path: away.id ? teamUrl(away.id, away.name) : null },
        startDate: kickoff,
        venue: currentMatch.fixture?.venue?.name,
        leagueName: headerLeagueName,
        finished,
        homeGoals: currentMatch.goals?.home,
        awayGoals: currentMatch.goals?.away,
      }),
    ),
    matchID,
    teamList,
    matchInfo: currentMatch,
    headerLeagueName,
    matchStatistics,
    matchElo,
    headToHead,
    matchVenue,
  });
});

app.get("/player/:id/:slug?", async (request, response) => {
  try {
    const playerID = request.params.id;
    const catalogEntry = catalogPlayer(playerID);
    if (!catalogEntry) {
      return renderNotFound(request, response, "We couldn't find that player.");
    }
    const canonicalPath = playerUrl(catalogEntry.id, catalogEntry.name);
    if (redirectToCanonical(request, response, canonicalPath)) return;

    const registry = await getRegistry();
    const playerPageData = getPlayerPageData(registry, playerID, request.query.pleague);

    if (!playerPageData) {
      return renderNotFound(request, response, "We couldn't find that player.");
    }

    const { details, leagues, selectedLeague } = playerPageData;
    const playerTransfers = await getTransfersByPlayer(playerID);
    const player = details.player;
    const displayName = player.fullName || player.name;
    const clubPath = player.club ? teamUrl(player.club, player.clubName) : null;

    response.render("player", {
      title: `${displayName} – Stats, Ratings, Positions & Transfers | Generation Football`,
      description: `${displayName}${player.clubName ? ` (${player.clubName})` : ""}: goals, assists, match ratings, positions played, recent matches and transfer history.`,
      canonicalPath,
      ogType: "profile",
      ogImage: `/images/player-pictures/${player.id}.png`,
      jsonLd: jsonLd(
        playerSchema({
          name: displayName,
          path: canonicalPath,
          imagePath: `/images/player-pictures/${player.id}.png`,
          clubName: player.clubName,
          clubPath,
          nationName: player.nationName,
          birthDate: isoDay(player.birthdate) || undefined,
        }),
        breadcrumbList([["Home", "/"], ["Players", "/top-players"], [displayName, canonicalPath]]),
      ),
      player,
      matches: details.matches,
      playerTransfers,
      leagues,
      selectedPLeagues: selectedLeague,
    });
  } catch (error) {
    handleError(response, error, "Error loading player page");
  }
});

app.get("/starting-11", (req, res) => {
  res.render("starting11-new", {
    title: "Starting 11 Builder – Create Your Football Lineup | Generation Football",
    description: "Pick a formation, drop in players and build your best starting eleven, then download it as an image to share.",
  });
});

app.get("/privacy-policy", (req, res) => {
  res.render("privacy-policy", { title: "Privacy Policy | Generation Football", description: "Read Generation Football's Privacy Policy to understand how we handle your data and protect your privacy." });
});

app.get("/about", (req, res) => {
  res.render("about", { title: "About | Generation Football", description: "What Generation Football is, where its football data comes from and the stats it adds on top: xG, expected points, Elo and player ratings." });
});

app.get("/wiki", async (req, res, next) => {
  try {
    const articles = await getWikiArticles();
    res.render("wiki-index", {
      title: "GF Wiki – How Our Football Stats Work | Generation Football",
      description: "Plain-English guides to the numbers on Generation Football: expected points (xPts), Elo ratings, team ratings, player positions and table abbreviations.",
      articles,
      legacyAnchors: JSON.stringify(await getLegacyAnchorMap()),
      jsonLd: jsonLd(
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "GF Wiki",
          url: absoluteUrl(wikiPath()),
          hasPart: articles.map((article) => ({ "@type": "Article", headline: article.title, url: absoluteUrl(article.path) })),
        },
        breadcrumbList([["Home", "/"], ["Wiki", wikiPath()]]),
      ),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/wiki/:slug", async (req, res, next) => {
  try {
    const article = await getWikiArticle(req.params.slug);
    if (!article) {
      return renderNotFound(req, res, "That wiki article doesn't exist. Browse the wiki for the full list.");
    }
    if (redirectToCanonical(req, res, article.path)) return;
    res.render("wiki-article", {
      title: `${article.title} | GF Wiki`,
      description: article.description,
      canonicalPath: article.path,
      ogType: "article",
      article,
      jsonLd: jsonLd(
        articleSchema({
          title: article.title,
          description: article.description,
          path: article.path,
          updated: article.updated,
          published: article.published,
        }),
        breadcrumbList([["Home", "/"], ["Wiki", wikiPath()], [article.navTitle, article.path]]),
      ),
    });
  } catch (error) {
    next(error);
  }
});


app.get("/compare-players", (req, res) => {
  res.render("compare-players", { title: "Compare Football Players Side by Side | Generation Football", description: "Compare football players side by side: goals, assists, minutes, match ratings and other per-match stats." });
});

// Must stay last: anything unmatched gets the 404 page.
app.use((req, res) => renderNotFound(req, res));

app.use((error, req, res, next) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
  if (res.headersSent) return next(error);
  res.status(500).send("Something went wrong. Please try again later.");
});
