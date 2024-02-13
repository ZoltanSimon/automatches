const rapidApiHost = "v3.football.api-sports.io";
const rapidApiKey = "aba57b743572275dac2835162c201c56";
const season = 2023;

export async function getResultFromApi(matchID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/fixtures?id=${matchID}`,
    {
      method: "GET",
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
    }
  );
  const data = await response.json();
  console.log(data);
  return data;
}

export async function getStandingsFromApi(leagueID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/standings?league=${leagueID}&season=${season}`,
    {
      method: "GET",
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
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
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
    }
  );
  const data = await response.json();
  return data;
}

export async function getResultsDate(leagueID, from, to) {
  let url = `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}&from=${from}&to=${to}`;

  if (isNaN(parseInt(from))) {
    url = `https://v3.football.api-sports.io/fixtures?league=${leagueID}&season=${season}`;
  }

  console.log(url);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": rapidApiHost,
      "x-rapidapi-key": rapidApiKey,
    },
  });
  const data = await response.json();
  //console.log(data);
  return data;
}

export async function getTopScorer(leagueID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/players/topscorers?league=${leagueID}&season=${season}`,
    {
      method: "GET",
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
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
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
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
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
    }
  );
  const data = await response.json();
  console.log(data);
  return data;
}

export async function getPlayerStats(playerID) {
  const response = await fetch(
    `https://v3.football.api-sports.io/players?id=${playerID}&season=${season}`,
    {
      method: "GET",
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
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
      headers: {
        "x-rapidapi-host": rapidApiHost,
        "x-rapidapi-key": rapidApiKey,
      },
    }
  );
  const data = await response.json();
  console.log(data);
  return data;
}
