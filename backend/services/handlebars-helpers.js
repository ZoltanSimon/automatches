import { formatPlayerPosition as formatPlayerPositionLabel } from "../lib/backend-helper.js";
import { buildPositionFilterOptions } from "../../classes/player-positions.js";
import { allDBLeagues, allDBPlayers } from "../lib/catalog.js";
import { formatTeamXg } from "../lib/match-xg.js";
import { getTeamById, isAgeGroupNationalSide } from "./teams-service.js";

export const gt = (a, b) => a > b;
export const lt = (a, b) => a < b;
export const eq = (a, b) => a === b;
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

export const transferFee = (type) => {
  if (!type || type === "N/A") return "-";
  return type;
}

export const formatPlayerPosition = (position) => formatPlayerPositionLabel(position);
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

export const isFinishedStatus = (statusShort) => {
  return ["FT", "AET", "PEN", "CANC", "PST"].includes(statusShort);
}

export const isGoalEvent = (eventType, eventDetail = "") => {
  const type = String(eventType ?? "").trim().toLowerCase();
  const detail = String(eventDetail ?? "").trim().toLowerCase();
  return type === "goal" || detail.includes("goal");
}

export const expectedGoalsForTeam = (match, teamID) => formatTeamXg(match, teamID);