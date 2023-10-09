import {
  getResultsDate,
  getTopScorer,
  getTopAssists,
  getResultFromApi,
  getStandingsFromApi,
  getResults,
  getCurrentRound,
  getPlayerStats,
  getSquad,
  downloadResultFromApi,
} from "/webapi-handler.js";
import { addText } from "./autotext.js";
import { addMatchStats } from "./components/match-statistics.js";
import { addPlayerStats } from "./components/player-stats.js";
import { addSquad } from "./components/team-squad.js";
import { leagueStandings } from "./components/league-standings.js";

let addToPage;
let standingsFromApi,
  resultsFromApi,
  matchFromApi,
  playerFromApi,
  squadFromApi,
  playerFromApi2;

document.getElementById("submit-league-info").onclick = async function () {
  await submitRequest_leagueInfo();
};

document.getElementById("submit-match-list").onclick = async function () {
  await submitRequest_matchList();
};

document.getElementById("getRound").onclick = function () {
  setRound();
};

document.getElementById("getMatch").onclick = async function () {
  let fixtureID = document.getElementById("fixtureID").value;
  matchFromApi = await getResultFromApi(fixtureID);
  oneFixture(matchFromApi);
};

document.getElementById("downloadMatch").onclick = async function () {
  let fixtureID = document.getElementById("fixtureID").value;
  matchFromApi = await downloadResultFromApi(fixtureID);
  //oneFixture(matchFromApi);
};

document.getElementById("getPlayerStats").onclick = async function () {
  let playerID = document.getElementById("playerID").value;
  let playerID2 = document.getElementById("playerID2").value;
  playerFromApi = await getPlayerStats(playerID);
  playerFromApi2 = await getPlayerStats(playerID2);
  addPlayerStats(playerFromApi.response, playerFromApi2.response);
};

document.getElementById("getSquad").onclick = async function () {
  let teamID = document.getElementById("teamID").value;
  squadFromApi = await getSquad(teamID);
  addSquad(squadFromApi.response);
};

async function submitRequest_matchList() {
  let leagueID = document.getElementById("leagues").value;
  let startDate = document.getElementById("dateStart").value;
  let endDate = document.getElementById("dateEnd").value;
  getResultsDate(leagueID, startDate, endDate).then((response) =>
    fixturesInfo(response)
  );
}

async function submitRequest_leagueInfo() {
  let leagueID = document.getElementById("leagues").value;
  let roundNumber = document.getElementById("roundnr").value;

  if (document.querySelector("#get-top-scorers").checked)
    getTopScorer(leagueID).then((response) => topScorers(response)); //Not updated regularly from API

  if (document.querySelector("#get-top-assists").checked)
    getTopAssists(leagueID).then((response) => topAssists(response)); //Not updated regularly from API

  if (document.querySelector("#get-standings").checked) {
    standingsFromApi = await getStandingsFromApi(leagueID);
    leagueStandings(standingsFromApi);
  }

  if (document.querySelector("#get-results").checked) {
    resultsFromApi = await getResults(
      leagueID,
      `Regular Season - ${roundNumber}`
    );

    fixtureData(resultsFromApi);
  }

  addText(resultsFromApi, standingsFromApi);
}

function setRound() {
  let leagueID = document.getElementById("leagues").value;
  getCurrentRound(leagueID).then(
    (response) =>
      (document.getElementById("roundnr").value = response.response[0].replace(
        "Regular Season - ",
        ""
      ))
  );
}

function fixtureData(response) {
  let fixtures = response.response;
  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });
  addToPage = "<table>";
  fixtures.forEach((a) => {
    addToPage += `
    <tr>
        <td>${new Date(a.fixture.date).getDate()}.${
      new Date(a.fixture.date).getMonth() + 1
    }.${new Date(a.fixture.date).getFullYear()}</td>
        <td><img src=${imagePath(a.teams.home.name)} width="30px"></td>
        <td>${a.teams.home.name}</td>
        <td>${a.goals.home}</td>
        <td><img src=${imagePath(a.teams.away.name)} width="30px"></td>
        <td>${a.teams.away.name}</td>
        <td>${a.goals.away}</td>
    </tr>`;
  });
  addToPage += `</table>`;
  document.getElementById("results").innerHTML += addToPage;
}

function topScorers(response) {
  let topScorerAr = response.response;
  let it = 1;

  addToPage = `<table>
  <thead>    
  <tr>
  <th>#</th>
  <th></th>
  <th>Name</th>
  <th>Team</th>
  <th>Goals</th>
  <th>G/90</th>
  </tr>
  </thead>`;

  topScorerAr.forEach((a) => {
    addToPage += `
    <tr>
        <td>${it}</td>
        <td><img src="${a.player.photo}" width="50px"</td>
        <td>${a.player.name}</td>
        <td><img src=${imagePath(a.statistics[0].team.name)} width="30px"/></td>
        <td>${a.statistics[0].goals.total}</td>
        <td>${(
          (a.statistics[0].goals.total * 90) /
          a.statistics[0].games.minutes
        ).toFixed(2)}</td>
    </tr>`;
    it++;
  });
  addToPage += `</table>`;
  document.getElementById("top-scorers").innerHTML += addToPage;
}

function topAssists(response) {
  let topScorerAr = response.response;
  let it = 1;

  addToPage = `<table>
  <thead>    
  <tr>
  <th>#</th>
  <th></th>
  <th>Name</th>
  <th>Team</th>
  <th>Assists</th>
  </tr>
  </thead>`;

  topScorerAr.forEach((a) => {
    addToPage += `
    <tr>
        <td>${it}</td>
        <td><img src="${a.player.photo}" width="50px"</td>
        <td>${a.player.name}</td>
        <td><img src=${imagePath(a.statistics[0].team.name)} width="30px"/></td>
        <td>${a.statistics[0].goals.assists}</td>
    </tr>`;
    it++;
  });
  addToPage += `</table>`;
  document.getElementById("top-scorers").innerHTML += addToPage;
}

function teamLink(name) {
  return `https://generationfootball.net/world-cup-2022-qatar/world-cup-2022-teams/${name}`;
}

function fixturesInfo(response) {
  let fixtures = response.response;
  fixtures.sort(function (a, b) {
    return new Date(a.fixture.date) - new Date(b.fixture.date);
  });
  addToPage = `<table>`;
  fixtures.forEach((element) => {
    addToPage += `<tr>
    <td>${new Date(element.fixture.date).toDateString()}</td>
    <td><img src=${imagePath(element.teams.home.name)} width="30px"></td>
    <td><a href="${teamLink(element.teams.home.name)}/">${
      element.teams.home.name
    }</a></td>
    <td width="30px">${
      !isNaN(parseInt(element.goals.home)) ? element.goals.home : ""
    }</td>
    <td><img src=${imagePath(element.teams.away.name)} width="30px"</td>
    <td><a href="${teamLink(element.teams.away.name)}/">${
      element.teams.away.name
    }</a></td>
    <td width="30px">${
      !isNaN(parseInt(element.goals.away)) ? element.goals.away : ""
    }</td><td>${element.fixture.id}</td>
    </tr>`;
  });
  addToPage += `</table>`;
  document.getElementById("fixtures-info").innerHTML += addToPage;
}

function addGoals(goals) {
  let retString = ``;
  goals.forEach((a) => {
    retString += `${a.player.name} ${a.time.elapsed}'<br/>`;
  });
  return retString;
}

const subs = (subs) => {
  let retString = ``;
  subs.forEach((a) => {
    retString += `${a.assist.name} ${a.time.elapsed}', `;
  });
  return retString;
};

function oneFixture(response) {
  let fixture = response.response[0];
  let players = [];
  let homeTeam = fixture.teams.home;
  let awayTeam = fixture.teams.away;

  homeTeam.goals = [];
  awayTeam.goals = [];
  homeTeam.players = [];
  awayTeam.players = [];
  homeTeam.subs = [];
  awayTeam.subs = [];

  fixture.events.forEach((element) => {
    if (element.type == "Goal") {
      if (element.team.name == homeTeam.name) {
        homeTeam.goals.push(element);
      } else {
        awayTeam.goals.push(element);
      }
    }
    if (element.type == "subst") {
      if (element.team.name == homeTeam.name) {
        homeTeam.subs.push(element);
      } else {
        awayTeam.subs.push(element);
      }
    }
  });

  fixture.lineups.forEach((team, index) => {
    players = [];
    for (let i = 0; i < team.startXI.length; i++) {
      players.push(team.startXI[i].player.name);
    }
    if (index == 0) {
      homeTeam.players = players.slice();
    } else {
      awayTeam.players = players.slice();
    }
  });

  document.getElementById("standings").innerHTML = ``;

  addToPage = `
  <table>
    <tr>
      <td><img src=${imagePath(fixture.teams.home.name)} width="30px"></td>
      <td><a href="${teamLink(homeTeam.name)}/">${homeTeam.name}</a></td>
      <td width="30px">${fixture.goals.home || 0}</td>
      <td><img src=${imagePath(awayTeam.name)} width="30px"</td>
      <td><a href="${teamLink(awayTeam.name)}/">${awayTeam.name}</a></td>
      <td width="30px">${fixture.goals.away || 0}</td>
    </tr>
  </table>
  <table>
    <tr>
      <td width=50%>${addGoals(homeTeam.goals)}</td>
      <td>${addGoals(awayTeam.goals)}</td>
    </tr>
  </table>
  Location: ${fixture.fixture.venue.name}, 
  ${fixture.fixture.venue.city}<br/>
  Referee: ${fixture.fixture.referee}<br/>
  <br/>
  <b>${homeTeam.name}</b></br>
  Manager: ${fixture.lineups[0].coach.name}<br/>
  Starting 11: ${homeTeam.players.join(", ")}<br/>
  Subs: ${subs(homeTeam.subs)}<br/><br/>
  <b>${awayTeam.name}</b><br/>
  Manager: ${fixture.lineups[1].coach.name}<br/>
  Starting 11: ${awayTeam.players.join(", ")}<br/>
  Subs: ${subs(awayTeam.subs)}`;

  document.getElementById("one-fixture").innerHTML += addToPage;
  addMatchStats(fixture);
}

function oneMatch(matchId) {
  fetch(`Matches/${matchId}.json`)
    .then((response) => response.json())
    .then((data) => oneFixture(data))
    .catch((error) => {
      console.log("Calling from API");
      getResultFromApi(matchId);
    });
}
