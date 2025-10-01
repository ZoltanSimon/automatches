import {
  showMatchesOnDate,
  download,
  showToast
} from "../common-functions.js";
import {
  selectedLeagues,
  downloadMatch,
} from "../local-handler.js";
import { matchesToCanvas, matchList } from "../components/match-list.js";
import { make_base, fontY } from "../instapics.js";
import {
  standingsFromTeamList,
  standingsToCanvas,
  leagueStandings
} from "../components/league-standings.js";
import { addText, buildResults } from "../autotext.js";
import { playerGoalList, playerListToCanvas } from "../components/player-list.js";
import { oneFixture } from "../components/match-details.js";
import { addMatchStats, matchStatsToCanvas } from "../components/match-statistics.js";
import { getPlayerStatsFromApi } from "../webapi-handler.js";

const response = await fetch(`/get-all-leagues`);
const allLeagues = await response.json();

document.getElementById('datepicker-input').addEventListener('change', function () {
  document.getElementById("fixtures-info").innerHTML = "";
  const selectedDate = this.value;
  showMatchesOnDate(selectedDate, true);
});

showMatchesOnDate(new Date(), true);

for (const element of allLeagues) {
  if (element.Visible == 1) {
    document.getElementById(
      `league-list-${element.type}`
    ).innerHTML += `<img width=30px id="img-${element.id}" class="league-to-select" src="images/competitions/${element.id}.png" alt="${element.name}" title="${element.name}"/>`;
    document
      .querySelectorAll(".league-to-select")
      .forEach((e) => e.addEventListener("click", selectLeague));
  }
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
  leagueStandings(await standingsFromTeamList(selectedLeagues[0]));
};

document.getElementById("get-matches-by-round").onclick = async function () {
  let leagueID = selectedLeagues[0];
  let roundNumber = document.getElementById("roundnr").value;
  const response = await fetch(`/get-matches-by-round?leagueID=${leagueID}&roundNo=${`Regular Season - ${roundNumber}`}`);
  const matches = await response.json();
  matchList(matches, true);
  addText(matches);
  buildResults(matches);
};

document.getElementById("submit-match-list").onclick = async function () {
  await submitRequest_matchList();
};

document.getElementById("update-leagues").onclick = async function () {
  let leagueID = selectedLeagues.join(",");
  let seasonsArr = [];
  for (let id of selectedLeagues) {
    seasonsArr.push(allLeagues.find((element) => element.id == id).season);
  }

  let seasons = seasonsArr.join(",");
  const response = await fetch(
    `/update-leagues?leagueID=${leagueID}&seasons=${seasons}`,
    {
      method: "GET",
    }
  );
  const data = await response.json();
  showToast(JSON.stringify(data), 'success');
  console.log(data);
};

document.getElementById("get-match-auto").onclick = async function () {
  let fixtureID = document.getElementById("fixtureID").value;
  let match = await downloadMatch(fixtureID);
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
  playerGoalList(false, 10);
};

/*document.getElementById("get-all-clubs").onclick = async function () {
  let teamsNew = [];
  let homeTeam, awayTeam;
  for (let i = 0; i < allLeagues.length; i++) {
    let response = await fetch(`get-league?leagueID=${allLeagues[i].id}`);
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
};*/

document.getElementById("insert-all-players").onclick = async function () {
  try {
    const response = await fetch(`/insert-all-players`);
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Failed to fetch and build player list:", error);
    return [];
  }
};

document.getElementById("getPlayerStats").onclick = async function () {
  let player1 = document.getElementById("playerID").value;
  //let player2 = findPlayerByID(document.getElementById("playerID2").value);
  console.log(await getPlayerStatsFromApi(player1));
  //playerFromApi = await getLocalPlayerStats(player1);
  //playerFromApi2 = await getLocalPlayerStats(player2);
  //addPlayerStats(playerFromApi, playerFromApi2);
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
  let inputTextValue = document.getElementById("textOnPic").value;
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

document.getElementById("download-image").onclick = function () {
  download();
};
