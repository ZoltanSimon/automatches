import { abbreviatePlayerPosition as abbreviatePlayerPositionLabel, formatPlayerPosition as formatPlayerPositionLabel } from "../lib/backend-helper.js";
import { buildPositionFilterOptions } from "../../classes/player-positions.js";
import { allDBLeagues, allDBPlayers } from "../lib/catalog.js";
import { formatTeamXg } from "../lib/match-xg.js";
import { buildMatchPitch } from "../lib/match-pitch.js";
import { buildPlayerPitch } from "../lib/player-pitch.js";
import { getTeamById, isAgeGroupNationalSide } from "./teams-service.js";
import { leagueUrl as buildLeagueUrl, matchUrl as buildMatchUrl, playerUrl as buildPlayerUrl, teamUrl as buildTeamUrl } from "../lib/site-urls.js";
import { absoluteUrl as absoluteSiteUrl, wikiPath } from "../../shared/urls.js";

export const gt = (a, b) => a > b;
export const lt = (a, b) => a < b;
export const eq = (a, b) => a === b;
// "1 goal", "2 goals"; pass the plural form when it isn't the word plus "s".
export const plural = (count, singular, pluralForm) => {
  const many = typeof pluralForm === "string" ? pluralForm : `${singular}s`;
  return `${count} ${Number(count) === 1 ? singular : many}`;
};
export const json = (context) => JSON.stringify(context);
export const concat = (...parts) => {
  // Handlebars passes an options object as the last argument to helpers.
  const values = parts.slice(0, -1);
  return values.join("");
};

export const formatTime = (datestamp) => {
  if (!datestamp) return "";
  const date = datestamp instanceof Date ? datestamp : new Date(datestamp);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin" // CET/CEST
  });
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDateOnly = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '.');
}

function calendarDay(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value("year"), value("month") - 1, value("day"));
}

export const daysAgo = (date) => {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.round((calendarDay(new Date()) - calendarDay(then)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export const daysUntil = (date) => {
  const then = new Date(date);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.round((calendarDay(then) - calendarDay(new Date())) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

export const transferFee = (type) => {
  if (!type || type === "N/A") return "-";
  return type;
}

export const formatPlayerPosition = (position) => formatPlayerPositionLabel(position);
export const abbreviatePlayerPosition = (position) => abbreviatePlayerPositionLabel(position);
export const positionFilterOptions = () => buildPositionFilterOptions();

export const nationFilterOptions = () => {
  const ids = new Set();

  for (const player of allDBPlayers || []) {
    const id = Number(player.nation);
    if (Number.isFinite(id) && id > 0) {
      ids.add(id);
    }
  }

  for (const league of allDBLeagues || []) {
    if (league.type !== "nt") {
      continue;
    }

    const id = Number(league.nation);
    if (Number.isFinite(id) && id > 0) {
      ids.add(id);
    }
  }

  return [...ids]
    .map((id) => ({
      id: String(id),
      name: getTeamById(id)?.name || "",
    }))
    .filter((nation) => nation.name && !isAgeGroupNationalSide(nation.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
};

export const percentage = (wins, played) => {
  return ((wins / played) * 100).toFixed(1);
}

export const includesID = (array, id) => {
  const arrayToCheck = Array.isArray(array) ? array : [array];
  return arrayToCheck && arrayToCheck.includes(id);
}

export const increment = (nr) => {
  return parseInt(nr) + 1;
}

export const perGame = (total, games) => {
  const g = Number(games);
  if (!g || g === 0) return 0;
  const t = Number(total);
  if (Number.isNaN(t)) return 0;
  return (t / g).toFixed(2);
}

export const rateTrend = (recent, season, direction) => {
  const recentValue = Number.parseFloat(recent);
  const seasonValue = Number.parseFloat(season);
  if (!Number.isFinite(recentValue) || !Number.isFinite(seasonValue) || recentValue === seasonValue) {
    return "";
  }

  const lowerIsBetter = direction === "lower";
  const improved = lowerIsBetter ? recentValue < seasonValue : recentValue > seasonValue;
  return improved ? "is-better" : "is-worse";
}

export const zeroDefault = (value) => {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export const ratingClass = (rating) => {
  const r = positiveRating(rating);
  if (r == null) return '';
  if (r >= 8) return 'rating-dark-green';
  if (r >= 7) return 'rating-green';
  if (r >= 6) return 'rating-yellow';
  if (r >= 5) return 'rating-orange';
  return 'rating-red';
}

function positiveRating(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export const displayRating = (value) => {
  const parsed = positiveRating(value);
  return parsed == null ? "" : parsed.toFixed(1);
}

export const anyTeamHasRating = (teams) =>
  Array.isArray(teams) && teams.some((team) => positiveRating(team?.total?.avgRating) != null);

function fotmobNameTokens(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function fotmobNamesMatch(left, right) {
  const a = fotmobNameTokens(left);
  const b = fotmobNameTokens(right);
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  if (a.join(" ") === b.join(" ")) {
    return true;
  }
  const aLast = a[a.length - 1];
  const bLast = b[b.length - 1];
  if (aLast.length < 3 || aLast !== bLast) {
    return false;
  }
  return a[0][0] === b[0][0];
}

function findFotmobPlayer(fotmob, side, name, shirt) {
  const players = (Array.isArray(fotmob?.players) ? fotmob.players : [])
    .filter((player) => player?.side === side);
  const shirtNumber = Number(shirt);
  if (Number.isFinite(shirtNumber)) {
    const byShirt = players.filter((player) => Number(player.shirt) === shirtNumber);
    if (byShirt.length === 1) {
      return byShirt[0];
    }
  }

  return players.find((player) => fotmobNamesMatch(player.name, name)) ?? null;
}

function formatFotmobDecimal(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return numeric.toFixed(2);
}

function lineupPlayerRating(matchPlayers, teamID, playerID) {
  if (!Array.isArray(matchPlayers)) return "";

  const targetTeamID = Number(teamID);
  const targetPlayerID = Number(playerID);

  const teamData = matchPlayers.find(
    (entry) => Number(entry?.team?.id) === targetTeamID
  );
  if (!teamData?.players) return "";

  const playerData = teamData.players.find(
    (entry) => Number(entry?.player?.id) === targetPlayerID
  );
  return displayRating(playerData?.statistics?.[0]?.games?.rating);
}

function fotmobSide(teamId, homeTeamId) {
  return Number(teamId) === Number(homeTeamId) ? "home" : "away";
}

export const matchLineupRating = (matchPlayers, teamID, playerID, playerName, shirt, fotmob, homeTeamId) => {
  const apiRating = lineupPlayerRating(matchPlayers, teamID, playerID);
  if (apiRating) {
    return apiRating;
  }

  const fotmobPlayer = findFotmobPlayer(fotmob, fotmobSide(teamID, homeTeamId), playerName, shirt);
  return displayRating(fotmobPlayer?.rating);
}

// Both starting XIs laid out on one horizontal pitch (see backend/lib/match-pitch.js).
export const matchPitch = (matchInfo) => buildMatchPitch(matchInfo, {
  ratingFor: (team, player) => {
    const rating = matchLineupRating(matchInfo?.players, team?.id, player?.id, player?.name, player?.number, matchInfo?.fotmob, matchInfo?.teams?.home?.id);
    return rating ? { value: rating, className: ratingClass(rating) } : null;
  },
});

// The player's regular positions as dots on a small pitch (see backend/lib/player-pitch.js).
export const playerPitch = (player) => buildPlayerPitch(player?.pitchPositions);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2025-08-16" -> { month: "Aug", year: "2025" }
function monthYear(day) {
  const match = /^(\d{4})-(\d{2})/.exec(String(day || ""));
  return match ? { month: MONTHS[Number(match[2]) - 1], year: match[1] } : null;
}

// When the starts were actually played: "Aug 2025 – May 2026", "Aug – Nov 2025", "Aug 2025".
export function startDateRange(firstStart, lastStart) {
  const first = monthYear(firstStart);
  const last = monthYear(lastStart) || first;
  if (!first || !last) return "";
  if (first.year !== last.year) return `${first.month} ${first.year} – ${last.month} ${last.year}`;
  if (first.month !== last.month) return `${first.month} – ${last.month} ${last.year}`;
  return `${last.month} ${last.year}`;
}

const startsText = (starts) => `${starts} ${starts === 1 ? "start" : "starts"}`;

// History rows for the player page: "2025-2026  RB 28 · CB 3". The season comes from the
// match dates (July-June); hovering shows the date span and national-team starts.
export const playerPositionHistory = (history) => (Array.isArray(history) ? history : []).map(({ label, firstStart, lastStart, total, ntStarts, roles }) => ({
  label,
  title: [startDateRange(firstStart, lastStart), ntStarts > 0 ? `${ntStarts} for the national team` : ""].filter(Boolean).join(" · "),
  total,
  roles: roles.map(({ code, name, starts, ntStarts: roleNtStarts }) => ({
    code,
    name,
    starts,
    title: roleNtStarts > 0
      ? `${name}: ${startsText(starts)} (${roleNtStarts} for the national team)`
      : `${name}: ${startsText(starts)}`,
  })),
}));

export const matchLineupStat = (fotmob, homeTeamId, teamID, playerName, shirt, field) => {
  const fotmobPlayer = findFotmobPlayer(fotmob, fotmobSide(teamID, homeTeamId), playerName, shirt);
  return formatFotmobDecimal(fotmobPlayer?.[field]);
}

export const fotmobTeamStatSum = (fotmob, teamId, homeTeamId, field) => {
  const side = fotmobSide(teamId, homeTeamId);
  const values = (Array.isArray(fotmob?.players) ? fotmob.players : [])
    .filter((player) => player?.side === side)
    .map((player) => Number(player?.[field]))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    return "";
  }

  return formatFotmobDecimal(values.reduce((total, value) => total + value, 0));
}

export const fotmobTeamXgFor = (fotmob, teamId, homeTeamId) => {
  const value = fotmobSide(teamId, homeTeamId) === "away" ? fotmob?.awayXg : fotmob?.homeXg;
  return formatFotmobDecimal(value);
}

function hasNumericStat(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  return Number.isFinite(Number(value));
}

function fotmobPlayersHaveStat(fotmob, field) {
  return (Array.isArray(fotmob?.players) ? fotmob.players : [])
    .some((player) => hasNumericStat(player?.[field]));
}

export function fotmobHasLineupStat(fotmob, field) {
  const key = String(field ?? "").toLowerCase();
  if (key === "xg") {
    return hasNumericStat(fotmob?.homeXg) || hasNumericStat(fotmob?.awayXg) || fotmobPlayersHaveStat(fotmob, "xg");
  }
  if (key === "xgot" || key === "xa") {
    return fotmobPlayersHaveStat(fotmob, key);
  }
  return false;
}

export function lineupColspan(fotmob) {
  const statColumns = ["xg", "xgot", "xa"].filter((field) => fotmobHasLineupStat(fotmob, field)).length;
  return 3 + statColumns;
}

export const matchTeamAverageRating = (lineup, matchPlayers, fotmob, homeTeamId) => {
  const side = fotmobSide(lineup?.team?.id, homeTeamId);
  const people = [...(lineup?.startXI || []), ...(lineup?.substitutes || [])];
  const ratings = people
    .map((entry) => positiveRating(matchLineupRating(
      matchPlayers,
      lineup?.team?.id,
      entry?.player?.id,
      entry?.player?.name,
      entry?.player?.number,
      fotmob,
      homeTeamId,
    )))
    .filter((value) => value != null);

  if (ratings.length === 0) {
    const teamRating = side === "away" ? fotmob?.awayRating : fotmob?.homeRating;
    return displayRating(teamRating);
  }

  const sum = ratings.reduce((acc, value) => acc + value, 0);
  return (sum / ratings.length).toFixed(1);
}

export const isGoalEvent = (eventType, eventDetail = "") => {
  const type = String(eventType ?? "").trim().toLowerCase();
  const detail = String(eventDetail ?? "").trim().toLowerCase();
  return type === "goal" || detail.includes("goal");
}

export const expectedGoalsForTeam = (match, teamID) => formatTeamXg(match, teamID);
// ---------------------------------------------------------------------------
// URL helpers. Handlebars appends an options object to every call; hash
// arguments (e.g. {{teamUrl id allStats=1}}) become the query string.
// ---------------------------------------------------------------------------
function splitHelperArgs(args) {
  const options = args[args.length - 1];
  const isOptions = options && typeof options === "object" && "hash" in options;
  return { values: isOptions ? args.slice(0, -1) : args, hash: isOptions ? options.hash : {} };
}

export const teamUrl = (...args) => {
  const { values: [id, name], hash } = splitHelperArgs(args);
  return buildTeamUrl(id, name, hash);
};

export const playerUrl = (...args) => {
  const { values: [id, name], hash } = splitHelperArgs(args);
  return buildPlayerUrl(id, name, hash);
};

export const leagueUrl = (...args) => {
  const { values: [id, season], hash } = splitHelperArgs(args);
  return buildLeagueUrl(id, season, hash);
};

export const matchUrl = (...args) => {
  const { values: [match] } = splitHelperArgs(args);
  return buildMatchUrl(match);
};

export const wikiUrl = (...args) => {
  const { values: [slug] } = splitHelperArgs(args);
  return wikiPath(typeof slug === "string" ? slug : "");
};

export const startsWith = (value, prefix) => typeof value === "string" && typeof prefix === "string" && value.startsWith(prefix);

// Absolute URL on the public site for a root-relative path ("/team/1/x").
export const absUrl = (value) => (typeof value === "string" && value ? absoluteSiteUrl(value) : "");
