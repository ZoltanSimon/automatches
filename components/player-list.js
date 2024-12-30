import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
} from "../instapics.js";
import { removeNewlines } from "../common-functions.js";
import { ths, tds } from "../common-styles.js";

export function playerGoalList(response, big) {
  let addToPage;
  let thisPlayer;

  addToPage = `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="player-list-table">
  <thead>
    <tr class="main-table-header">
      <th colspan=3 style="border-right:1px solid #F1FAEE">Player</th>
      <th width=50 style="text-align: center; border-right:1px solid #F1FAEE">Team</th>
      ${ths}Apps</th>
      ${ths}Goals</th>
      ${ths}NPG</th>
      ${ths}Assists</th>
      ${ths}GA/90</th>`;
  if (big)
    addToPage += `${ths}Minutes</th>${ths}Penalties</th>${ths}Shots</th>${ths}Dribbles</th>${ths}Duels</th>${ths}Key Passes</th>${ths}Fouls Against</th>`;
  addToPage += `</tr></thead><tbody>`;
  for (let i = 0; i < response.length; i++) {
    thisPlayer = response[i];
    loadClubLogo(thisPlayer.club);
    loadClubLogo(thisPlayer.nation);
    addToPage += `<tr><td id="${
      thisPlayer.id
    }" style="text-align:center;padding:0; border-right: none;"><img height="60" src="images/player-pictures/${
      thisPlayer.id
    }.png"</td>
    <td id="${
      thisPlayer.nation
    }" class="player-country"><img height="30" src="images/logos/${
      thisPlayer.nation
    }.png" /></td">
    <td>${thisPlayer.name}</td>
    <td id="${thisPlayer.club}"><img height="44" src="images/logos/${
      thisPlayer.club
    }.png" /></td>${tds}${
      thisPlayer.apps
    }</td><td style="text-align: center; font-weight: bold">${
      thisPlayer.goals
    }</td>${tds}${thisPlayer.goals - thisPlayer.penalties}</td>${tds}${
      thisPlayer.assists
    }</td>
    ${tds}${thisPlayer.gap90}</td>`;
    if (big)
      addToPage += `${tds}${thisPlayer.minutes}</td>${tds}${thisPlayer.penalties}</td>${tds}${thisPlayer.shots}</td>${tds}${thisPlayer.dribbles}</td>${tds}${thisPlayer.duels}</td>${tds}${thisPlayer.key_passes}</td>${tds}${thisPlayer.fouls_drawn}</td>`;
    addToPage += `</tr>`;
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

  playerListTable.rows[0].style.backgroundColor = "#1D3557";
  playerListTable.rows[0].style.color = "#F1FAEE";
  playerListTable.rows[0].style.fontWeight = "bold";

  console.log(imgs);

  for (let i = 1; i < playerListTable.rows.length; i++) {
    thisTr = playerListTable.rows[i];
    playerFace = imgs.players[thisTr.children[0].id];

    imgToAdd.push({
      img: playerFace,
      imgHeight: 80,
      startX: 134,
      startY: 84 + i * 80,
    });

    let clubLogo = thisTr.children[1].id;

    console.log(imgs.clubs[clubLogo]);
    imgToAdd.push({
      img: imgs.clubs[clubLogo],
      imgHeight: 56,
      startX: 200,
      startY: 99 + i * 80,
    });
    clubLogo = thisTr.children[3].id;

    console.log(imgs.clubs[clubLogo]);
    imgToAdd.push({
      img: imgs.clubs[clubLogo],
      imgHeight: 72,
      startX: 510,
      startY: 90 + i * 80,
    });

    thisTr.style.height = "80px";
    thisTr.children[0].innerHTML = "";
    thisTr.children[0].style.width = "120px";
    thisTr.children[1].style.width = "60px";
    thisTr.children[2].style.width = "260px";
    thisTr.children[1].innerHTML = "";
    thisTr.children[3].innerHTML = "";
    thisTr.children[3].style.width = "60px";
    thisTr.children[4].style.width = normalWidth;
    thisTr.children[5].style.width = normalWidth;
    thisTr.children[6].style.width = normalWidth;
    thisTr.children[7].style.width = normalWidth;
  }

  console.log(imgToAdd);
  buildTableForTableType(
    removeNewlines(playerListTable.outerHTML),
    imgToAdd,
    110
  );
  ctx.fillStyle = "#e63946";
  //ctx.fillText(leagueName, 540, 960);
}
