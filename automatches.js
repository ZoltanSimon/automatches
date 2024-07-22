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
import { addText, buildResults, buildStandings } from "./autotext.js";
import { addMatchStats } from "./components/match-statistics.js";
import { addPlayerStats } from "./components/player-stats.js";
import { addSquad } from "./components/team-squad.js";
import { leagueStandings } from "./components/league-standings.js";
import { matchList } from "./components/match-list.js";
import { playerGoalList } from "./components/player-list.js";
import { teamList } from "./components/team-list.js";
import { players } from "./data/players.js";
import { clubs } from "./data/clubs.js";
import { allLeagues } from "./data/leagues.js";
import { loadPlayerFace, loadCompLogo } from "./instapics.js";
import {
  copyText,
  copyToClipboard,
  showMatchesOnDate,
} from "./common-functions.js";

let standingsFromApi,
  resultsFromApi,
  playerFromApi,
  squadFromApi,
  playerFromApi2;

export let selectedLeagues = [];

/*const picker = datepicker(document.querySelector("#calendar"), {
  position: "bl",
  alwaysShow: true,
  onSelect: (instance, date) => {
    document.getElementById("fixtures-info").innerHTML = "";
    showMatchesOnDate(date);
  },
});*/

showMatchesOnDate(new Date());

document.getElementById("select-all-leagues").onclick = function () {
  const allTheLeagues = document
    .getElementById("league-list")
    .querySelectorAll("img");
  for (let i = 0; i < 10; i++) {
    let league = allTheLeagues[i];
    league.classList.add("selected-league");
    selectedLeagues.push(league.id.split("img-")[1]);
  }
};

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

document.getElementById("get-all-clubs").onclick = async function () {
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

  teamsNew = teamsNew.filter(function (obj) {
    return !clubs.some((el) => el.id === obj.id);
  });
  console.log(teamsNew);
};

document.getElementById("get-all-players").onclick = async function () {
  getAllPlayers();
};

document.getElementById("get-all-matches").onclick = async function () {
  teamList(await getAllMatches(selectedLeagues));
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
  getResultsDate(leagueID, startDate, endDate).then((response) => {
    matchList(response.response, true);
    addText(response.response);
  });
}

async function submitRequest_leagueInfo() {
  const found = allLeagues.find((element) => element.id == selectedLeagues[0]);
  document.getElementById("league-name").innerHTML = found.name;
  document.getElementById("league-id").innerHTML = found.id;
  standingsFromApi = await getAllMatches(selectedLeagues);
  standingsFromApi.sort((a, b) => b.points - a.points); // b - a for reverse sort
  loadCompLogo(found.id);
  leagueStandings(standingsFromApi);
  buildStandings(standingsFromApi);
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
