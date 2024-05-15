import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
} from "./../instapics.js";
import { removeNewlines } from "../common-functions.js";

export function playerGoalList(response) {
  console.log(response);
  let addToPage;
  let tds = `<td style="text-align: center;">`;
  let thisPlayer;

  addToPage = `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="player-list-table">
  <thead><tr style="border-bottom:3px solid #1D3557"><td colspan=2>Player</td>${tds}Team</td>${tds}Apps</td>${tds}Goals</td>${tds}NPG</td>${tds}Assists</td>${tds}GA/90</td></tr></thead>
  <tbody>`;

  for (let i = 0; i < response.length; i++) {
    thisPlayer = response[i];
    loadClubLogo(thisPlayer.club);
    addToPage += `<tr><td>${thisPlayer.id}</td><td>${
      thisPlayer.name
    }</td><td id="${thisPlayer.club}">${thisPlayer.team}</td>${tds}${
      thisPlayer.apps
    }</td><td style="text-align: center; font-weight: bold">${
      thisPlayer.goals
    }</td>${tds}${thisPlayer.goals - thisPlayer.penalties}</td>${tds}${
      thisPlayer.assists
    }</td>
    ${tds}${thisPlayer.gap90}</td></tr>`;
  }
  addToPage += `</tbody></table>`;

  document.getElementById("player-list").innerHTML += addToPage;
}

export function playerListToCanvas() {
  let imgToAdd = [];
  let playerFace, thisTr;
  let playerListTable = document.getElementById("player-list-table");
  let normalWidth = `73px`;

  playerListTable.cellPadding = 10;

  playerListTable.rows[0].style.backgroundColor = "#457B9D";
  playerListTable.rows[0].style.fontWeight = "bold";

  console.log(imgs);

  for (let i = 1; i < playerListTable.rows.length; i++) {
    thisTr = playerListTable.rows[i];
    playerFace = imgs.players[thisTr.children[0].innerHTML];

    imgToAdd.push({
      img: playerFace,
      imgHeight: 80,
      startX: 134,
      startY: 84 + i * 80,
    });
    let clubLogo = thisTr.children[2].id;

    console.log(imgs.clubs[clubLogo]);
    imgToAdd.push({
      img: imgs.clubs[clubLogo],
      imgHeight: 76,
      startX: 470,
      startY: 88 + i * 80,
    });

    thisTr.style.height = "80px";
    thisTr.children[0].innerHTML = "";
    thisTr.children[0].style.width = "62px";
    thisTr.children[1].style.width = "226px";
    thisTr.children[2].style.width = normalWidth;
    thisTr.children[2].innerHTML = "";
    thisTr.children[3].style.width = normalWidth;
    thisTr.children[4].style.width = normalWidth;
    thisTr.children[5].style.width = normalWidth;
    thisTr.children[6].style.width = normalWidth;
    thisTr.children[7].style.width = normalWidth;
  }

  buildTableForTableType(
    removeNewlines(playerListTable.outerHTML),
    imgToAdd,
    110
  );
  ctx.fillStyle = "#e63946";
  //ctx.fillText(leagueName, 540, 960);
}
