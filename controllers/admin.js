import {
  showMatchesOnDate,
  download,
  getTop10Players,
} from "../common-functions.js";
import {
  selectedLeagues,
  getLocalPlayerStats,
  getAllPlayers,
  getResultsByRoundLocal,
  getMatch,
  getAllMatches,
} from "../local-handler.js";
import { allLeagues } from "../data/leagues.js";
import { clubs } from "../data/clubs.js";
import { matchesToCanvas, matchList } from "../components/match-list.js";
import { loadCompLogo } from "../instapics.js";
import { leagueStandings } from "../components/league-standings.js";
import { addText, buildResults, buildStandings } from "../autotext.js";
import { players } from "../data/players.js";
import { teamList } from "../components/team-list.js";

const picker = datepicker(document.querySelector("#calendar"), {
  position: "bl",
  alwaysShow: true,
  onSelect: (instance, date) => {
    document.getElementById("fixtures-info").innerHTML = "";
    showMatchesOnDate(date);
  },
});
picker.calendarContainer.style.setProperty("left", "374px");

showMatchesOnDate(new Date());

for (const element of allLeagues) {
  document.getElementById(
    `league-list-${element.type}`
  ).innerHTML += `<img width=30px id="img-${element.id}" class="league-to-select" src="images/competitions/${element.id}.png" alt="${element.name}" title="${element.name}"/>`;
  document
    .querySelectorAll(".league-to-select")
    .forEach((e) => e.addEventListener("click", selectLeague));
}

function selectLeague(evt) {
  evt.currentTarget.classList.toggle("selected-league");
  let dasID = evt.currentTarget.id.replace("img-", "");
  if (!selectedLeagues.includes(dasID)) {
    selectedLeagues.push(dasID);
  } else {
    selectedLeagues.splice(selectedLeagues.indexOf(dasID), 1);
  }
}

async function submitRequest_matchList() {
  let leagueID = selectedLeagues[0];
  let startDate = document.getElementById("dateStart").value;
  let endDate = document.getElementById("dateEnd").value;
  getResultsDate(leagueID, 2024, startDate, endDate).then((response) => {
    matchList(response.response, true);
    addText(response.response);
  });
}

async function submitRequest_leagueInfo() {
  const found = allLeagues.find((element) => element.id == selectedLeagues[0]);
  document.getElementById("league-name").innerHTML = found.name;
  document.getElementById("league-id").innerHTML = found.id;
  let standingsFromApi = await getAllMatches(selectedLeagues);
  standingsFromApi.sort((a, b) => b.points - a.points); // b - a for reverse sort
  loadCompLogo(found.id);
  leagueStandings(standingsFromApi);
  buildStandings(standingsFromApi);
}

export async function matchesByRound() {
  let leagueID = selectedLeagues[0];
  let roundNumber = document.getElementById("roundnr").value;
  let resultsFromApi = await getResultsByRoundLocal(
    leagueID,
    `Regular Season - ${roundNumber}`
  );
  matchList(resultsFromApi);
  addText(resultsFromApi);
  buildResults(resultsFromApi);
}

document.getElementById("select-all-leagues").onclick = function () {
  console.log("ide");
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
  let seasonsArr = [];
  console.log(selectedLeagues);
  for (let id of selectedLeagues) {
    seasonsArr.push(allLeagues.find((element) => element.id == id).season);
  }

  let seasons = seasonsArr.join(",");
  console.log(seasons);

  const response = await fetch(
    `/update-leagues?leagueID=${leagueID}&seasons=${seasons}`,
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
  addMatchStats(match[0]);
};

document.getElementById("missing-matches").onclick = async function () {
  let leagueID = selectedLeagues.join(",");
  const response = await fetch(`/missing-matches?leagueID=${leagueID}`, {
    method: "GET",
  });
  const data = await response.json();
  if (data.length > 0) matchList(data, true);
  console.log(data);
};

document.getElementById("get-player-goal-list").onclick = async function () {
  getTop10Players(selectedLeagues);
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

document.getElementById("textOnPic").onkeyup = function () {
  inputTextValue = document.getElementById("textOnPic").value;
  let breakingText = document.getElementById("breaking-official").value;
  make_base(inputTextValue, breakingText);
};

document.getElementById("add-breaking").onclick = function () {
  document.getElementById("breaking-official").value =
    document.getElementById("add-breaking").innerHTML;
};

document.getElementById("happy-bday").onclick = function () {
  document.getElementById("breaking-official").value = "🎉HAPPY BIRTHDAY🎂";
};

document.getElementById("pasteArea").onpaste = function (event) {
  let breakingText = document.getElementById("breaking-official").value;
  // use event.originalEvent.clipboard for newer chrome versions
  var items = (event.clipboardData || event.originalEvent.clipboardData).items;
  // find pasted image among pasted items
  var blob = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") === 0) {
      blob = items[i].getAsFile();
    }
  }
  // load image if there is a pasted image
  if (blob !== null) {
    var reader = new FileReader();
    reader.onload = function (event) {
      imgHeight = fontY - 34 - lineheight;
      if (breakingText) imgHeight -= 66;

      base_image = new Image();
      base_image.src = event.target.result;
      base_image.onload = function () {
        drawResizedImage(base_image, imgHeight, 1080, 30);
        ctx.drawImage(border_image, 0, 0);
      };
    };
    reader.readAsDataURL(blob);
  }
};

document.getElementById("copy-match-stats").onclick = function () {
  matchStatsToCanvas();
};

document.getElementById("copy-standings").onclick = function (event) {
  standingsToCanvas();
};

document.getElementById("copy-player-stats").onclick = function () {
  playerStatsToCanvas();
};

document.getElementById("copy-matches").onclick = function () {
  matchesToCanvas("match-list");
};

document.getElementById("copy-selected").onclick = function () {
  matchesToCanvas("selected-matches");
};

document.getElementById("copy-player-list").onclick = function () {
  playerListToCanvas();
};

document.getElementById("ucl-matches").onclick = function () {
  drawUCLMatches();
};

document.getElementById("download-image").onclick = function () {
  download();
};
