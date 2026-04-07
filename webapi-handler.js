const rapidApiHost = "v3.football.api-sports.io";
const rapidApiKey = "aba57b743572275dac2835162c201c56";
const season = 2024;

function getApiHeaders() {
  return {
    "x-rapidapi-host": rapidApiHost,
    "x-rapidapi-key": rapidApiKey,
  };
}

export async function getResultFromApi(matchID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures?id=${matchID}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );

  const data = await response.json();
  const limits = {
    perMinuteLimit: response.headers.get("x-ratelimit-limit"),
    perMinuteRemaining: response.headers.get("x-ratelimit-remaining"),
    dailyLimit: response.headers.get("x-ratelimit-requests-limit"),
    dailyRemaining: response.headers.get("x-ratelimit-requests-remaining"),
  };

  return { data, limits };
}

export async function getResultsFromApiByIds(matchIDs) {
  const ids = Array.isArray(matchIDs)
    ? matchIDs
      .map((id) => String(id).trim())
      .filter(Boolean)
    : String(matchIDs || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

  if (ids.length === 0) {
    return {
      data: { response: [] },
      limits: {
        perMinuteLimit: null,
        perMinuteRemaining: null,
        dailyLimit: null,
        dailyRemaining: null,
      },
    };
  }

  if (ids.length > 20) {
    throw new Error("A maximum of 20 fixture IDs can be requested at once.");
  }

  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures?ids=${ids.join("-")}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );

  const data = await response.json();
  const limits = {
    perMinuteLimit: response.headers.get("x-ratelimit-limit"),
    perMinuteRemaining: response.headers.get("x-ratelimit-remaining"),
    dailyLimit: response.headers.get("x-ratelimit-requests-limit"),
    dailyRemaining: response.headers.get("x-ratelimit-requests-remaining"),
  };

  return { data, limits };
}

export async function getStandingsFromApi(leagueID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/standings?league=${leagueID}&season=${season}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );
  const data = await response.json();
  return data;
}

export async function getResults(leagueID, round) {
  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}&round=${round}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );
  const data = await response.json();
  return data;
}

export async function getResultsDate(leagueID, season, from, to) {
  let url = `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}&from=${from}&to=${to}`;

  if (isNaN(parseInt(from))) {
    url = `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}`;
  }

  console.log(url);
  const response = await fetch(url, {
    method: "GET",
    headers: getApiHeaders(),
  });
  const data = await response.json();
  return data;
}

export async function getTopScorer(leagueID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/players/topscorers?league=${leagueID}&season=${season}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );
  const data = await response.json();
  return data;
}

export async function getTopAssists(leagueID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/players/topassists?league=${leagueID}&season=${season}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );
  const data = await response.json();
  return data;
}

export async function getCurrentRound(leagueID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures/rounds?league=${leagueID}&season=${season}&current=true`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );
  const data = await response.json();
  console.log(data);
  return data;
}

export async function getPlayerStatsFromApi(playerID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/players?id=${playerID}&season=${season}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );
  const data = await response.json();
  console.log(data);
  return data;
}

export async function getSquad(teamID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/players/squads?team=${teamID}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );
  const data = await response.json();
  console.log(data);
  return data;
}

export async function getPlayers(params = {}) {
  let url = "https://v3.football.api-sports.io/players/profiles";

  // Build query string from params object
  const queryParams = new URLSearchParams();
  if (params.playerID) {
    queryParams.append('player', params.playerID);
  }
  // Add any other params (like page, season, etc.)
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'playerID' && value) {
      queryParams.append(key, value);
    }
  }

  const queryString = queryParams.toString();
  if (queryString) {
    url = `${url}?${queryString}`;
  } 

  const response = await fetch(url, {
    method: "GET",
    headers: getApiHeaders(),
  });
  const data = await response.json();
  return data;
}

export async function getLeaguesByType(type = "league") {
  const response = await fetch(
    `https://v3.football.api-sports.io/leagues?type=${encodeURIComponent(type)}`,
    {
      method: "GET",
      headers: getApiHeaders(),
    }
  );

  const data = await response.json();
  const limits = {
    perMinuteLimit: response.headers.get("x-ratelimit-limit"),
    perMinuteRemaining: response.headers.get("x-ratelimit-remaining"),
    dailyLimit: response.headers.get("x-ratelimit-requests-limit"),
    dailyRemaining: response.headers.get("x-ratelimit-requests-remaining"),
  };

  return { data, limits };
}

