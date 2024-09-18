import { allLeagues } from "./data/leagues.js";
import { matchList } from "./components/match-list.js";
import { getLocalPlayerStats } from "./local-handler.js";
import { loadPlayerFace } from "./instapics.js";
import { players } from "./data/players.js";
import { playerGoalList } from "./components/player-list.js";

export let download = function () {
  var link = document.createElement("a");
  link.download = "mysquad.png";
  link.href = document.getElementById("myCanvas").toDataURL();
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

export function downloadResult(matchID, response) {
  let dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(response));
  let downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", matchID + ".json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function copyText(field) {
  // Get the text field
  var copyText = document.getElementById(field);

  // Select the text field
  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices

  // Copy the text inside the text field
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

export async function showMatchesOnDate(date) {
  let matches = [];
  for (let i = 0; i < allLeagues.length; i++) {
    let response = await fetch(`data/leagues/${allLeagues[i].id}.json`);
    let league = await response.json();
    for (let j = 0; j < league.length; j++) {
      let fixtureDate = new Date(league[j].fixture.date);
      if (fixtureDate.toDateString() == date.toDateString()) {
        matches.push(league[j]);
      }
    }
  }
  if (matches.length > 0) matchList(matches, true);
  /*const teams = [
    40, 541, 530, 529, 496, 499, 157, 165, 168, 541, 530, 529, 40, 541, 530,
    529, 40, 541, 530, 529, 40, 541, 530, 529, 40, 541, 530, 529, 40, 541, 530,
    529, 40, 541, 530, 529,
  ];
  // Number of items
  for (let i = 0; i < 9; i++) loadClubLogo(teams[i]);*/
}

export async function getTop10Players(leagues) {
  let thisPlayer;
  let top10 = [];
  const response = await fetch(`get-player-list?leagues=${leagues.join(",")}`, {
    method: "GET",
  });

  const playerList = await response.json();

  for (let i = 0; i < 10; i++) {
    //console.log(playerList[i]);
    loadPlayerFace(playerList[i].id);

    let player = players.find((x) => x.id == playerList[i].id);

    thisPlayer = await getLocalPlayerStats(player, leagues);
    top10.push(thisPlayer);
  }
  playerGoalList(top10);
}
