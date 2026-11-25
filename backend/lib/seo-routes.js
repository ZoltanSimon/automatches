// robots.txt and XML sitemaps. Sitemaps only list entities that actually have
// data in the loaded registry, so search engines are never sent to a 404.
import express from "express";
import { SITE_URL, absoluteUrl, isoDay, wikiPath } from "../../shared/urls.js";
import { allDBLeagues } from "./catalog.js";
import { catalogPlayer, catalogTeam, leagueUrl, matchUrl, playerUrl, teamUrl } from "./site-urls.js";
import { getLeagueSeasons } from "./league-season.js";
import { getRegistry } from "../services/registry-service.js";
import { getWikiArticles } from "../services/wiki-service.js";

const CACHE_MS = 30 * 60 * 1000;
const URLS_PER_SITEMAP = 45000;
const FINISHED = new Set(["FT", "AET", "PEN"]);

const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/top-players", changefreq: "daily", priority: "0.8" },
  { path: "/top-teams", changefreq: "daily", priority: "0.8" },
  { path: "/transfers", changefreq: "daily", priority: "0.7" },
  { path: "/starting-11", changefreq: "monthly", priority: "0.6" },
  { path: "/compare-players", changefreq: "monthly", priority: "0.5" },
  { path: "/about", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.2" },
];

const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);

function urlEntry({ path, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(absoluteUrl(path))}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : "",
    priority ? `    <priority>${priority}</priority>` : "",
    "  </url>",
  ].filter(Boolean).join("\n");
}

function urlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(urlEntry).join("\n")}\n</urlset>\n`;
}

function chunk(list, size) {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) chunks.push(list.slice(index, index + size));
  return chunks.length ? chunks : [[]];
}

async function buildSitemaps() {
  const registry = await getRegistry();
  const matches = registry?.matches || [];
  const teamLastPlayed = new Map();
  const playerLastPlayed = new Map();

  const matchEntries = [];
  for (const match of matches) {
    const day = isoDay(match.fixture?.date);
    const finished = FINISHED.has(match.fixture?.status?.short);
    matchEntries.push({ path: matchUrl(match), lastmod: finished ? day : undefined, changefreq: finished ? "monthly" : "daily" });
    if (!finished) continue;

    for (const side of [match.teams?.home, match.teams?.away]) {
      if (side?.id && day > (teamLastPlayed.get(side.id) || "")) teamLastPlayed.set(side.id, day);
    }
    for (const team of Array.isArray(match.players) ? match.players : []) {
      for (const entry of team.players || []) {
        const id = Number(entry?.player?.id);
        if (!id || Number(entry.statistics?.[0]?.games?.minutes || 0) <= 0) continue;
        if (day > (playerLastPlayed.get(id) || "")) playerLastPlayed.set(id, day);
      }
    }
  }

  const teamEntries = [...teamLastPlayed]
    .filter(([id]) => catalogTeam(id))
    .map(([id, lastmod]) => ({ path: teamUrl(id), lastmod, changefreq: "weekly", priority: "0.7" }));

  const playerEntries = [...playerLastPlayed]
    .filter(([id]) => catalogPlayer(id))
    .map(([id, lastmod]) => ({ path: playerUrl(id), lastmod, changefreq: "weekly", priority: "0.6" }));

  const leagueEntries = (allDBLeagues || []).flatMap((league) => {
    const seasons = getLeagueSeasons(league.id);
    const [current, ...past] = seasons.length ? seasons : [null];
    return [
      { path: leagueUrl(league.id, current), changefreq: "daily", priority: "0.8" },
      ...past.map((season) => ({ path: leagueUrl(league.id, season), changefreq: "monthly", priority: "0.4" })),
    ];
  });

  const wikiArticles = await getWikiArticles();
  const latestWikiUpdate = wikiArticles.map((article) => article.updated).sort().pop();
  const pageEntries = [
    ...STATIC_PAGES,
    { path: wikiPath(), lastmod: latestWikiUpdate, changefreq: "monthly", priority: "0.7" },
    ...wikiArticles.map((article) => ({ path: article.path, lastmod: article.updated, changefreq: "monthly", priority: "0.7" })),
  ];

  const files = new Map();
  files.set("pages.xml", urlset(pageEntries));
  files.set("leagues.xml", urlset(leagueEntries));
  chunk(teamEntries, URLS_PER_SITEMAP).forEach((part, index) => files.set(`teams-${index + 1}.xml`, urlset(part)));
  chunk(playerEntries, URLS_PER_SITEMAP).forEach((part, index) => files.set(`players-${index + 1}.xml`, urlset(part)));
  chunk(matchEntries, URLS_PER_SITEMAP).forEach((part, index) => files.set(`matches-${index + 1}.xml`, urlset(part)));

  const today = new Date().toISOString().slice(0, 10);
  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...files.keys()]
    .map((name) => `  <sitemap>\n    <loc>${SITE_URL}/sitemaps/${name}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`)
    .join("\n")}\n</sitemapindex>\n`;

  return { index, files };
}

export function createSeoRouter() {
  const router = express.Router();
  let cached = null;
  let cachedAt = 0;
  let building = null;

  async function getSitemaps() {
    if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
    building ??= buildSitemaps()
      .then((result) => {
        cached = result;
        cachedAt = Date.now();
        return result;
      })
      .finally(() => {
        building = null;
      });
    return building;
  }

  router.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(
      ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /admin", "", `Sitemap: ${SITE_URL}/sitemap.xml`, ""].join("\n"),
    );
  });

  router.get("/sitemap.xml", async (req, res, next) => {
    try {
      res.type("application/xml").send((await getSitemaps()).index);
    } catch (error) {
      next(error);
    }
  });

  router.get("/sitemaps/:name", async (req, res, next) => {
    try {
      const file = (await getSitemaps()).files.get(req.params.name);
      if (!file) return res.status(404).type("text/plain").send("Not found");
      res.type("application/xml").send(file);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
