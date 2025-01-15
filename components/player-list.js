import {
  buildTableForTableType,
  imgs,
  ctx,
  loadClubLogo,
} from "../instapics.js";
import { removeNewlines } from "../common-functions.js";
import { tds } from "../common-styles.js";
import { sortTable } from "../common-functions.js";

export function playerGoalList(response, big) {
  let addToPage;
  let thisPlayer;

  addToPage = "";
  const table = document.getElementById("player-list-table");
  const tableBody = table.getElementsByTagName("tbody")[0];
  
  if (!tableBody) {
    console.error("Table body not found! Ensure the table has a <tbody> element.");
    return;
  }
  for (let i = 0; i < response.length; i++) {
    thisPlayer = response[i];
    loadClubLogo(thisPlayer.club);
    loadClubLogo(thisPlayer.nation);

    addToPage += `<tr
    ><td id="${thisPlayer.id}" style="text-align:center;padding:0; border-right: none;"><img height="60" src="images/player-pictures/${thisPlayer.id}.png"</td>
    <td id="${thisPlayer.nation}" class="player-country"><img height="30" src="images/logos/${thisPlayer.nation}.png" /></td">
    <td>${thisPlayer.name}</td>
    <td id="${thisPlayer.club}"><img height="44" src="images/logos/${thisPlayer.club}.png" /></td>
    ${tds}${thisPlayer.apps}</td>
    <td style="text-align: center; font-weight: bold">${thisPlayer.goals}</td>
    ${tds}${thisPlayer.goals - thisPlayer.penalties}</td>
    ${tds}${thisPlayer.assists}</td>
    <td style="text-align: center; font-weight: bold">${thisPlayer.goals + thisPlayer.assists}</td>
    ${tds}${thisPlayer.gap90}</td>`;

    if (big)
      addToPage += `${tds}${thisPlayer.minutes}</td>${tds}${thisPlayer.penalties}</td>${tds}${thisPlayer.shots}</td>${tds}${thisPlayer.dribbles}</td>${tds}${thisPlayer.duels}</td>${tds}${thisPlayer.key_passes}</td>${tds}${thisPlayer.fouls_drawn}</td>`;
    addToPage += `</tr>`;
  }
  addToPage += `</tbody></table>`;

  tableBody.innerHTML = addToPage;

  let headerLength = table.rows[0].cells.length;
  let lastRowLength = table.rows[table.rows.length - 1].cells.length;

  for (let i = 0; i < table.rows[0].cells.length; i++) {
    let headerCell = table.rows[0].cells[i];
    if (headerCell.classList.contains("sortable")) {
      headerCell.addEventListener("click", function () {
        let index = lastRowLength - headerLength + i;
        sortTable(index, headerCell, table);
      });
    }
  }
  
}

export function playerListToCanvas() {
  let imgToAdd = [];
  let playerFace, thisTr;
  let playerListTable = document.getElementById("player-list-table");
  let normalWidth = `70px`;

  playerListTable.cellPadding = 10;

  playerListTable.rows[0].style.backgroundColor = "#1D3557";
  playerListTable.rows[0].style.color = "#F1FAEE";
  playerListTable.rows[0].style.fontWeight = "bold";

  playerListTable.rows[0].deleteCell(-1);
  playerListTable.rows[0].cells[5].innerHTML = "As.";

  for (let i = 0; i < playerListTable.rows[0].cells.length; i++) {
    playerListTable.rows[0].cells[i].style.borderRightColor = "#F1FAEE";
  }

  for (let i = 1; i < playerListTable.rows.length; i++) {
    thisTr = playerListTable.rows[i];
    playerFace = imgs.players[thisTr.children[0].id];

    imgToAdd.push({
      img: playerFace,
      imgHeight: 80,
      startX: 133,
      startY: 82 + i * 80,
    });

    let clubLogo = thisTr.children[1].id;

    imgToAdd.push({
      img: imgs.clubs[clubLogo],
      imgHeight: 46,
      startX: 183,
      startY: 97 + i * 80,
    });
    clubLogo = thisTr.children[3].id;

    imgToAdd.push({
      img: imgs.clubs[clubLogo],
      imgHeight: 72,
      startX: 514,
      startY: 88 + i * 80,
    });

    thisTr.style.height = "80px";
    thisTr.children[0].innerHTML = "";
    thisTr.children[0].style.width = "60px";
    thisTr.children[0].style.borderRightStyle = "hidden";
    thisTr.children[1].style.width = "46px";
    thisTr.children[2].style.width = "260px";
    thisTr.children[1].innerHTML = "";
    thisTr.children[3].innerHTML = "";
    thisTr.children[3].style.width = "50px";
    thisTr.children[4].style.width = normalWidth;
    thisTr.children[5].style.width = normalWidth;
    thisTr.children[6].style.width = normalWidth;
    thisTr.children[7].style.width = normalWidth;

    thisTr.deleteCell(-1);
  }

  buildTableForTableType(
    removeNewlines(playerListTable.outerHTML),
    imgToAdd,
    110
  );
  ctx.fillStyle = "#e63946";
}
