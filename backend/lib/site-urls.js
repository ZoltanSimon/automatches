// Catalog-aware URL builders. Names always come from the DB catalog when the
// entity is known there, so every link and every canonical check produces the
// same slug, whatever spelling the source object (e.g. API-Football) uses.
import { allDBLeagues, allDBPlayers, allDBTeams, getCatalogVersion } from "./catalog.js";
import { getLeagueSeason } from "./league-season.js";
import { leaguePath, matchPath, playerPath, teamPath } from "../../shared/urls.js";

let indexVersion = -1;
let teamsById = new Map();
let playersById = new Map();
let leaguesById = new Map();

function refreshIndexes() {
  const version = getCatalogVersion();
  if (version === indexVersion) return;
  teamsById = new Map((allDBTeams || []).map((team) => [Number(team.ID), team]));
  playersById = new Map((allDBPlayers || []).map((player) => [Number(player.id), player]));
  leaguesById = new Map((allDBLeagues || []).map((league) => [Number(league.id), league]));
  indexVersion = version;
}

// upsertCatalogPlayer mutates in place and bumps the version, so a stale
// index is rebuilt on the next lookup.
export function catalogTeam(id) {
  refreshIndexes();
  return teamsById.get(Number(id)) ?? null;
}

export function catalogPlayer(id) {
  refreshIndexes();
  return playersById.get(Number(id)) ?? null;
}

export function catalogLeague(id) {
  refreshIndexes();
  return leaguesById.get(Number(id)) ?? null;
}

export function teamName(id, fallbackName) {
  return catalogTeam(id)?.name || fallbackName || "";
}

// "B. Saka" reads badly in a URL; expand a leading initial from the first
// name when we have it ("Bukayo Saka"). Otherwise use the display name.
export function playerSlugName(player, fallbackName) {
  const name = String(player?.name || fallbackName || "").trim();
  const firstName = String(player?.first_name || player?.firstname || "").trim().split(/\s+/)[0];
  const initial = /^(\p{L})\.\s*(.+)$/u.exec(name);
  if (initial && firstName && firstName[0].toLowerCase() === initial[1].toLowerCase()) {
    return `${firstName} ${initial[2]}`;
  }
  return name;
}

export function teamUrl(id, fallbackName, query) {
  return teamPath(id, teamName(id, fallbackName), query);
}

export function playerUrl(id, fallbackName, query) {
  return playerPath(id, playerSlugName(catalogPlayer(id), fallbackName), query);
}

export function isDefaultLeagueSeason(id, season) {
  return season == null || season === "" || Number(season) === Number(getLeagueSeason(id));
}

export function leagueUrl(id, season, query, fallbackName) {
  const name = catalogLeague(id)?.name || fallbackName || "league";
  return leaguePath(id, name, isDefaultLeagueSeason(id, season) ? null : Number(season), query);
}

// Accepts an API-Football fixture ({ fixture, teams }) or a flat card shape
// ({ id, homeTeam, awayTeam, date }).
export function matchUrl(match) {
  if (!match) return "/";
  const id = match.fixture?.id ?? match.id ?? match.fixtureId;
  const home = match.teams?.home ?? match.homeTeam ?? match.home ?? {};
  const away = match.teams?.away ?? match.awayTeam ?? match.away ?? {};
  const date = match.fixture?.date ?? match.date ?? match.fixture?.timestamp;
  return matchPath(id, teamName(home.id, home.name), teamName(away.id, away.name), date);
}
