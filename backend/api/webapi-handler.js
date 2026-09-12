import { RAPID_API_HOST, RAPID_API_KEY } from "../config.js";
import { parseStringList } from "../lib/backend-helper.js";

let season = 2024;

function getApiHeaders() {
  return {
    "x-rapidapi-host": RAPID_API_HOST,
    "x-rapidapi-key": RAPID_API_KEY,
  };
}

function normalizeApiErrors(errors) {
  if (!errors) {
    return null;
  }

  if (Array.isArray(errors)) {
    return errors.length > 0 ? errors : null;
  }

  if (typeof errors === "object") {
    return Object.keys(errors).length > 0 ? errors : null;
  }

  return errors;
}

function summarizeApiCall(url, response, data, limits) {
  const results = Number(data?.results ?? (Array.isArray(data?.response) ? data.response.length : 0));
  const errors = normalizeApiErrors(data?.errors);
  const call = {
    method: "GET",
    url,
    httpStatus: response.status,
    results,
    errors,
    limits,
  };
  const errorPart = errors ? ` errors=${JSON.stringify(errors)}` : "";
  const limitPart = limits
    ? ` dailyRemaining=${limits.dailyRemaining} perMinuteRemaining=${limits.perMinuteRemaining}`
    : "";
  console.log(`[api] GET ${url} → ${response.status} results=${results}${errorPart}${limitPart}`);
  return call;
}

export function hasApiErrors(data) {
  return Boolean(normalizeApiErrors(data?.errors));
}

async function fetchFootballApi(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: getApiHeaders(),
  });
  const data = await response.json();
  const limits = {
    perMinuteLimit: response.headers.get("x-ratelimit-limit"),
    perMinuteRemaining: response.headers.get("x-ratelimit-remaining"),
    dailyLimit: response.headers.get("x-ratelimit-requests-limit"),
    dailyRemaining: response.headers.get("x-ratelimit-requests-remaining"),
  };

  return {
    data,
    limits,
    call: summarizeApiCall(url, response, data, limits),
  };
}

export async function getResultFromApi(matchID) {
  return fetchFootballApi(`https://v3.football.api-sports.io/fixtures?id=${matchID}`);
}

export async function getResultsFromApiByIds(matchIDs) {
  const ids = parseStringList(matchIDs);

  if (ids.length === 0) {
    return {
      data: { response: [] },
      limits: {
        perMinuteLimit: null,
        perMinuteRemaining: null,
        dailyLimit: null,
        dailyRemaining: null,
      },
      call: null,
    };
  }

  if (ids.length > 20) {
    throw new Error("A maximum of 20 fixture IDs can be requested at once.");
  }

  return fetchFootballApi(`https://v3.football.api-sports.io/fixtures?ids=${ids.join("-")}`);
}

export async function getStandingsFromApi(leagueID, season = 2026) {
  const { data } = await fetchFootballApi(
    `https://v3.football.api-sports.io/standings?league=${leagueID}&season=${season}`,
  );
  return data;
}

export async function getResults(leagueID, round, seasonYear = season) {
  const roundName = encodeURIComponent(String(round ?? "").trim());
  return fetchFootballApi(
    `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${seasonYear}&round=${roundName}`,
  );
}

export async function getFixturesByDate(date) {
  const day = String(date ?? "").trim();
  return fetchFootballApi(
    `https://v3.football.api-sports.io/fixtures?date=${encodeURIComponent(day)}`,
  );
}

export async function getResultsDate(leagueID, season, from, to) {
  let url = `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}&from=${from}&to=${to}`;

  if (isNaN(parseInt(from))) {
    url = `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}`;
  }

  const { data } = await fetchFootballApi(url);
  return data;
}

export async function getTopScorer(leagueID) {
  const { data } = await fetchFootballApi(
    `https://v3.football.api-sports.io/players/topscorers?league=${leagueID}&season=${season}`,
  );
  return data;
}

export async function getTopAssists(leagueID) {
  const { data } = await fetchFootballApi(
    `https://v3.football.api-sports.io/players/topassists?league=${leagueID}&season=${season}`,
  );
  return data;
}

export async function getCurrentRound(leagueID) {
  const { data } = await fetchFootballApi(
    `https://v3.football.api-sports.io/fixtures/rounds?league=${leagueID}&season=${season}&current=true`,
  );
  return data;
}

export async function getPlayerStatsFromApi(playerID) {
  const { data } = await fetchFootballApi(
    `https://v3.football.api-sports.io/players?id=${playerID}&season=${season}`,
  );
  return data;
}

export async function getSquad(teamID) {
  return fetchFootballApi(`https://v3.football.api-sports.io/players/squads?team=${teamID}`);
}

export async function getPlayersFromApi(params = {}) {
  let url = "https://v3.football.api-sports.io/players/profiles";

  const queryParams = new URLSearchParams();
  if (params.playerID) {
    queryParams.append("player", params.playerID);
  }
  for (const [key, value] of Object.entries(params)) {
    if (key !== "playerID" && value) {
      queryParams.append(key, value);
    }
  }

  const queryString = queryParams.toString();
  if (queryString) {
    url = `${url}?${queryString}`;
  }

  return fetchFootballApi(url);
}

export async function getPlayers(params = {}) {
  const { data } = await getPlayersFromApi(params);
  return data;
}

export async function getTeamsByPlayer(playerID) {
  return fetchFootballApi(`https://v3.football.api-sports.io/players/teams?player=${playerID}`);
}

export async function getTransfersByTeam(teamID) {
  return fetchFootballApi(`https://v3.football.api-sports.io/transfers?team=${teamID}`);
}

export async function getTransfersByPlayer(playerID) {
  return fetchFootballApi(`https://v3.football.api-sports.io/transfers?player=${playerID}`);
}

export async function getLeaguesByType(type = "league") {
  return fetchFootballApi(
    `https://v3.football.api-sports.io/leagues?type=${encodeURIComponent(type)}`,
  );
}

