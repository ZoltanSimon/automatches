import {
  getResultsDate,
  getStandingsFromApi,
  getSquad,
} from "./webapi-handler.js";
import {
  getLocalPlayerStats,
  getPlayerGoalList,
  getAllPlayers,
  getResultsByRoundLocal,
  getMatch,
  getAllMatches,
} from "./local-handler.js";
import { addText, buildResults } from "./autotext.js";
import { addMatchStats } from "./components/match-statistics.js";
import { addPlayerStats } from "./components/player-stats.js";
import { addSquad } from "./components/team-squad.js";
import { leagueStandings } from "./components/league-standings.js";
import { matchList } from "./components/match-list.js";
import { playerGoalList } from "./components/player-list.js";
import { teamList } from "./components/team-list.js";
import { players } from "./data/players.js";
import { allLeagues } from "./data/leagues.js";
import { loadPlayerFace } from "./instapics.js";
import { copyText, copyToClipboard, imagePath } from "./common-functions.js";

let addToPage;
let standingsFromApi,
  resultsFromApi,
  playerFromApi,
  squadFromApi,
  playerFromApi2;

export let selectedLeagues = [];

document.getElementById("submit-league-info").onclick = async function () {
  await submitRequest_leagueInfo();
};

document.getElementById("get-matches-by-round").onclick = async function () {
  await matchesByRound();
};

document.getElementById("submit-match-list").onclick = async function () {
  await submitRequest_matchList();
};

document.getElementById("update-leagues").onclick = async function () {
  let leagueID = selectedLeagues.join(",");
  console.log(leagueID);
  const response = await fetch(
    `http://localhost:3000/update-leagues?leagueID=${leagueID}`,
    {
      method: "GET",
    }
  );
  const data = await response.text();
  console.log(data);
};

document.getElementById("get-match-auto").onclick = async function () {
  let fixtureID = document.getElementById("fixtureID").value;
  let match = await getMatch(fixtureID);
  oneFixture(match);
};

document.getElementById("missing-matches").onclick = async function () {
  let leagueID = selectedLeagues.join(",");
  const response = await fetch(
    `http://localhost:3000/missing-matches?leagueID=${leagueID}`,
    {
      method: "GET",
    }
  );
  const data = await response.json();
  if (data.length > 0) matchList(data, true);
  console.log(data);
};

document.getElementById("get-player-goal-list").onclick = async function () {
  let thisPlayer;
  let top10 = [];
  let playerList = await getPlayerGoalList();

  for (let i = 0; i < 10; i++) {
    loadPlayerFace(playerList[i].id);

    let player = players.find((x) => x.id == playerList[i].id);

    thisPlayer = await getLocalPlayerStats(player);
    top10.push(thisPlayer);
  }
  playerGoalList(top10);
};

document.getElementById("a").onclick = async function () {
  let teamsNew = [];
  let homeTeam, awayTeam;

  for (let i = 0; i < allLeagues.length; i++) {
    let response = await fetch(`data/leagues/${allLeagues[i].id}.json`);
    let league = await response.json();
    for (let j = 0; j < league.length; j++) {
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

document.getElementById("get-all-players").onclick = async function () {
  getAllPlayers();
};

document.getElementById("get-all-matches").onclick = async function () {
  teamList(await getAllMatches());
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

document.getElementById("clear-results").onclick = async function () {
  document.getElementById("fixtures-info").innerHTML = "";
};

document.getElementById("copy-for-blog").onclick = function () {
  copyToClipboard("league-stuff");
};

document.getElementById("generate-text").onclick = async function () {};

document.getElementById("copy-text").onclick = async function () {
  copyText("generated-text");
};

async function submitRequest_matchList() {
  let leagueID = selectedLeagues[0];
  let startDate = document.getElementById("dateStart").value;
  let endDate = document.getElementById("dateEnd").value;
  getResultsDate(leagueID, startDate, endDate).then((response) =>
    matchList(response.response, true)
  );
}

async function submitRequest_leagueInfo() {
  let leagueID = selectedLeagues[0];

  standingsFromApi = await getStandingsFromApi(leagueID);
  leagueStandings(standingsFromApi);
}

async function matchesByRound() {
  let leagueID = selectedLeagues[0];
  let roundNumber = document.getElementById("roundnr").value;
  resultsFromApi = await getResultsByRoundLocal(
    leagueID,
    `Regular Season - ${roundNumber}`
  );
  matchList(resultsFromApi);
  addText(resultsFromApi);
  buildResults(resultsFromApi);
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
      <td><a href="${homeTeam.name}/">${homeTeam.name}</a></td>
      <td width="30px">${fixture.goals.home || 0}</td>
      <td><img src=${imagePath(awayTeam.id)} width="30px"</td>
      <td><a href="${awayTeam.name}/">${awayTeam.name}</a></td>
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

for (const element of allLeagues) {
  let dasID;
  document.getElementById(
    "league-list"
  ).innerHTML += `<img width=30px id="img-${element.id}" class="league-to-select" src="images/competitions/${element.id}.png" alt="${element.name}" title="${element.name}"/>`;
  document.querySelectorAll(".league-to-select").forEach((e) =>
    e.addEventListener("click", function () {
      this.classList.toggle("selected-league");
      dasID = this.id.replace("img-", "");
      if (!selectedLeagues.includes(dasID)) {
        selectedLeagues.push(dasID);
      } else {
        selectedLeagues.splice(selectedLeagues.indexOf(dasID), 1);
      }
    })
  );
}
