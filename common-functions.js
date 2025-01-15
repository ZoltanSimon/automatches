import { allLeagues } from "./data/leagues.js";
import { matchList } from "./components/match-list.js";
import { buildTeamList } from "./local-handler.js";
import { loadPlayerFace } from "./instapics.js";
import { playerGoalList } from "./components/player-list.js";
import { teamList } from "./components/team-list.js";
import { downloadMatch, matchExists } from "./local-handler.js";

export let download = function (canvasName = "myCanvas") {
  var link = document.createElement("a");
  link.download = "genfoot.png";
  link.href = document.getElementById(canvasName).toDataURL();
  link.click();
};

export function imagePath(teamID) {
  return `images/logos/${teamID}.png`;
}

export function removeNewlines(str) {
  str = str.replace(/\s{2,}/g, "");
  str = str.replace(/\t/g, "");
  str = str
    .toString()
    .trim()
    .replace(/(\r\n|\n|\r)/g, "");
  return str;
}

export function htmlDecode(input) {
  var txt = document.createElement("textarea");
  txt.innerHTML = input;
  return txt.value;
}

export function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "&hellip;" : str;
}

export function copyText(field) {
  var copyText = document.getElementById(field);

  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices

  navigator.clipboard.writeText(copyText.value);
}

export function copyToClipboard(element) {
  var doc = document,
    text = doc.getElementById(element),
    range,
    selection;

  if (doc.body.createTextRange) {
    range = doc.body.createTextRange();
    range.moveToElementText(text);
    range.select();
  } else if (window.getSelection) {
    selection = window.getSelection();
    range = doc.createRange();
    range.selectNodeContents(text);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  document.execCommand("copy");
  window.getSelection().removeAllRanges();
  document.getElementById("btn").value = "Copied";
}

export async function showMatchesOnDate(date, showID) {
  let matches = [];
  let downloads = 0;

  for (let league of allLeagues) {
    let leagueMatches = await fetch(`get-league?leagueID=${league.id}`);
    let leagueData = await leagueMatches.json();

    for (let match of leagueData) {
      let fixtureDate = new Date(match.fixture.date);

      if (fixtureDate.toDateString() !== date.toDateString()) continue;

      const matchEnd = new Date(fixtureDate.getTime() + 150 * 60000);
      if (matchEnd >= new Date()) {
        matches.push(match);
        continue;
      }

      let cachedMatch = await matchExists(match.fixture.id);
      if (cachedMatch) {
        updateOrAddMatch(matches, cachedMatch[0]);
      } else if (downloads < 10) {
        let downloadedMatch = await downloadMatch(match.fixture.id);
        updateOrAddMatch(matches, downloadedMatch[0]);
        downloads++;
      }
    }
  }

  if (matches.length > 0) matchList(matches, showID);
}

function updateOrAddMatch(matchArray, matchData) {
  const index = matchArray.findIndex(
    (m) => m.fixture.id === matchData.fixture.id
  );
  if (index !== -1) {
    matchArray[index] = matchData;
  } else {
    matchArray.push(matchData);
  }
}

export async function getTopPlayers(leagues, amount, big) {
  let topPlayers = [];
  const response = await fetch(`get-player-list?leagues=${leagues.join(",")}`, {
    method: "GET",
  });

  const playerList = await response.json();
  topPlayers = playerList.slice(0, amount);
  topPlayers.map(function (e) {
    loadPlayerFace(e.id);
  });
  playerGoalList(topPlayers, big);
}

export async function getTopTeams(leagues, amount, big) {
  let dasTeams = await buildTeamList(leagues);

  dasTeams.sort((a, b) =>
    a.last5PerGame.points < b.last5PerGame.points
      ? 1
      : b.last5PerGame.points < a.last5PerGame.points
      ? -1
      : 0
  );

  teamList(dasTeams.slice(0, amount), true, false, big);
}

export function sortTable(n, td, table, startingRow = 1) {
  let rows,
    switching = true,
    dir = "asc",
    switchcount = 0;

  while (switching) {
    switching = false;
    rows = table.rows;

    for (let i = startingRow; i < rows.length - 1; i++) {
      let x = rows[i].getElementsByTagName("TD")[n];
      let y = rows[i + 1].getElementsByTagName("TD")[n];
      let shouldSwitch = (dir === "asc" && parseFloat(x.innerHTML) > parseFloat(y.innerHTML)) || (dir === "desc" && parseFloat(x.innerHTML) < parseFloat(y.innerHTML));
      
      if (shouldSwitch) {
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        switchcount++;
        break;
      }
    }
    if (!switching && dir === "asc" && switchcount === 0) {
      dir = "desc";
      switching = true;
    }
  }
  td.classList.add(dir);
}

export function getDate(date) {
  let d = new Date(date);
  let month = d.getMonth() + 1;
  let day = d.getDate();
  let year = d.getFullYear();

  return `${day < 10 ? "0" + day : day}.${month < 10 ? "0" + month : month}.${year}`;
}