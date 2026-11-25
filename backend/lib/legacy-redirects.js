// 301s from the old query-string URLs to the slug URLs, so existing links,
// bookmarks and search-engine entries keep working and pass on their ranking.
import express from "express";
import { getLeagueSeason } from "./league-season.js";
import { catalogLeague, catalogPlayer, catalogTeam, leagueUrl, matchUrl, playerUrl, teamUrl } from "./site-urls.js";
import { getMatchById } from "../services/matches-service.js";
import { ensureMatchInRegistry, getRegistry } from "../services/registry-service.js";

// Remaining query parameters (filters, sort state, allStats...) carry over.
function restOfQuery(query, consumed) {
  const rest = {};
  for (const [key, value] of Object.entries(query)) {
    if (!consumed.includes(key) && typeof value === "string") rest[key] = value;
  }
  return rest;
}

export function createLegacyRedirectRouter({ renderNotFound }) {
  const router = express.Router();

  router.get("/team", (req, res) => {
    const team = catalogTeam(req.query.ID ?? req.query.id);
    if (!team) return renderNotFound(req, res);
    res.redirect(301, teamUrl(team.ID, team.name, restOfQuery(req.query, ["ID", "id"])));
  });

  router.get("/player", (req, res) => {
    const player = catalogPlayer(req.query.id);
    if (!player) return renderNotFound(req, res);
    res.redirect(301, playerUrl(player.id, player.name, restOfQuery(req.query, ["id"])));
  });

  router.get("/league", (req, res) => {
    // The old route showed the Premier League when no id was given.
    const leagueID = req.query.id === undefined ? 39 : Number(req.query.id);
    if (!catalogLeague(leagueID)) return renderNotFound(req, res);
    const season = getLeagueSeason(leagueID, req.query.season);
    res.redirect(301, leagueUrl(leagueID, season, restOfQuery(req.query, ["id", "season"])));
  });

  router.get("/match", async (req, res, next) => {
    try {
      const { matchID } = req.query;
      if (!matchID) return renderNotFound(req, res);
      const registry = await getRegistry();
      const match = getMatchById(registry, matchID) || (await ensureMatchInRegistry(registry, matchID));
      if (!match) return renderNotFound(req, res);
      res.redirect(301, matchUrl(match));
    } catch (error) {
      next(error);
    }
  });

  // The #fragment survives the redirect; /wiki forwards old anchors to articles.
  router.get(["/gf-wiki", "/gf-wiki/"], (req, res) => res.redirect(301, "/wiki"));
  router.get(["/starting11", "/starting11-new"], (req, res) => res.redirect(301, "/starting-11"));

  return router;
}
