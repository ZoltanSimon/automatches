import {
  getResultsDate,
  getTopScorer,
  getTopAssists,
  getResultFromApi,
  getStandingsFromApi,
  getResults,
  getCurrentRound,
  getSquad,
} from "./webapi-handler.js";
import { getLocalPlayerStats, getResultFromLocal } from "./local-handler.js";
import { addText } from "./autotext.js";
import { addMatchStats } from "./components/match-statistics.js";
import { addPlayerStats } from "./components/player-stats.js";
import { addSquad } from "./components/team-squad.js";
import { leagueStandings } from "./components/league-standings.js";
import { matchList } from "./components/match-list.js";

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

document.getElementById("a").onclick = async function () {
  let teamsNew = [];
  let homeTeam, awayTeam;
  for (let i = 0; i < allLeagues.length; i++) {
    console.log(allLeagues[i]);
    let response = await fetch(`leagues/${allLeagues[i]}.json`);
    let league = await response.json();
    //console.log(league);
    for (let j = 0; j < 45; j++) {
      console.log(league[j].teams);

      homeTeam = {
        id: league[j].teams.home.id,
        name: league[j].teams.home.name,
      };
      awayTeam = {
        id: league[j].teams.away.id,
        name: league[j].teams.away.name,
      };

      if (!teamsNew.find((e) => e.id == homeTeam.id)) {
        teamsNew.push(homeTeam);
      }

      if (!teamsNew.find((e) => e.id == awayTeam.id)) {
        teamsNew.push(awayTeam);
      }
    }
  }
  console.log(teamsNew);
};

document.getElementById("getMatch").onclick = async function () {
  let fixtureID = document.getElementById("fixtureID").value;
  matchFromApi = await getResultFromLocal(fixtureID);
  oneFixture(matchFromApi);
};

document.getElementById("getPlayerStats").onclick = async function () {
  let player1 = players.find(
    (x) => x.id == document.getElementById("playerID").value
  );
  let player2 = players.find(
    (x) => x.id == document.getElementById("playerID2").value
  );
  playerFromApi = await getLocalPlayerStats(player1);
  playerFromApi2 = await getLocalPlayerStats(player2);
  addPlayerStats(playerFromApi, playerFromApi2);
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
    matchList(response, true)
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

    matchList(resultsFromApi);
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
        <td><img src=${imagePath(a.statistics[0].team.id)} width="30px"/></td>
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
        <td><img src=${imagePath(a.statistics[0].team.id)} width="30px"/></td>
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
  let fixture = response[0];
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
      <td><img src=${imagePath(homeTeam.id)} width="30px"></td>
      <td><a href="${teamLink(homeTeam.name)}/">${homeTeam.name}</a></td>
      <td width="30px">${fixture.goals.home || 0}</td>
      <td><img src=${imagePath(awayTeam.id)} width="30px"</td>
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
