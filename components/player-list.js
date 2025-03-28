import {
  buildTableForTableType,
  imgs,
  ctx,
} from "../instapics.js";
import { removeNewlines, hideColumn, showColumn, adjustColspan } from "../common-functions.js";

const tableName = "player-list-table";
const table = document.getElementById(tableName);
const checkboxes = document.querySelectorAll("input[name='statSelector']");

export function playerGoalList(big) {
  const tableBody = table.getElementsByTagName("tbody")[0];

  window.addEventListener("resize", () => adjustColspan(table.rows[0].cells[0], 2));
  adjustColspan(table.rows[0].cells[0], 2);

  if (!tableBody) {
    console.error("Table body not found! Ensure the table has a <tbody> element.");
    return;
  } else {
    table.style.visibility = 'visible';
  }

  if (big) {
    document.getElementById("statSelectorContainer").style.visibility = 'visible';
  } else {
    document.getElementById("statSelectorContainer").style.display = 'none';
  }

  document.querySelectorAll(`#${tableName} th`).forEach(header => {
    header.addEventListener("click", function () {
        const stat = this.getAttribute("data-stat"); // Get the column's stat name
        const currentOrder = this.getAttribute("data-order") || "desc"; // Default order
        
        const newOrder = currentOrder === "asc" ? "desc" : "asc"; // Toggle order
        this.setAttribute("data-order", newOrder);
        
        displayedPlayers.sort((a, b) => (a[stat] < b[stat] ? 1 : b[stat] < a[stat] ? -1 : 0));

        updateTable(displayedPlayers.slice(0, 300));
        updateTableVisibility();
    });
  });

  checkboxes.forEach(checkbox => checkbox.addEventListener("change", updateTableVisibility));

  updateTableVisibility();

  let rows = document.querySelectorAll(`#${tableName} tbody tr`); // Select all rows inside your table
  let rowsPerPage = 100;
  let currentVisible = rowsPerPage;

  rows.forEach((row, index) => {
    if (index >= rowsPerPage) {
      row.style.display = "none";
    }
  });

  if (big) {
    let loadMoreBtn = document.createElement("button");
    loadMoreBtn.innerText = "Load More";
    loadMoreBtn.style.display = "block";
    loadMoreBtn.style.margin = "20px auto";
    loadMoreBtn.style.padding = "10px";
    loadMoreBtn.style.cursor = "pointer";
    loadMoreBtn.style.background = "#007bff";
    loadMoreBtn.style.color = "#fff";
    loadMoreBtn.style.border = "none";
    loadMoreBtn.style.borderRadius = "5px";
    loadMoreBtn.style.fontSize = "16px";
    loadMoreBtn.style.visibility = "visible";

    loadMoreBtn.addEventListener("click", function () {
      let newVisible = currentVisible + rowsPerPage;

      rows.forEach((row, index) => {
        if (index < newVisible) {
          row.style.display = "";
        }
      });

      currentVisible = newVisible;

      if (currentVisible >= rows.length) {
        loadMoreBtn.style.display = "none";
      }
    });

    document.querySelector("#" + tableName).parentNode.appendChild(loadMoreBtn);
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

document.addEventListener("DOMContentLoaded", function () { 

});

function updateTableVisibility() {   
  document.querySelectorAll(`#${tableName} th`).forEach((el, index) => {   
    if (el.dataset.stat) {
      if(!document.getElementById(el.dataset.stat).checked) {
        hideColumn(el.dataset.stat);
      } else {
        showColumn(el.dataset.stat);
      }
    }
  });    
}

function updateTable(sortedPlayers) {
  const tbody = document.querySelector(`#${tableName} tbody`);
  tbody.innerHTML = "";

  sortedPlayers.forEach((player, index) => {
      const row = document.createElement("tr");
      row.style.display = index < 100 ? "table-row" : "none"; 

      row.innerHTML = `
          <td style="text-align:center;padding:0; border-right: none;">
              <img class="player-picture" src="images/player-pictures/${player.id}.png" onerror="this.onerror=null; this.src='images/player-pictures/default-player.png';" />
          </td>
          <td class="player-country">
              <img height="30" src="images/logos/${player.nation}.png" />
          </td>
          <td class="sec-stats">${player.name}</td>
          <td>
              <img class="logo-picture" src="images/logos/${player.club}.png" />
          </td>
          <td data-stat="apps">${player.apps}</td>
          <td data-stat="goals">${player.goals}</td>
          <td data-stat="npg">${player.npg}</td>
          <td data-stat="assists">${player.assists}</td>
          <td data-stat="ga">${player.goals}</td>
          <td data-stat="gap90">${player.gap90}</td>
          <td data-stat="avRating">${player.avRating}</td>
          <td data-stat="minutes">${player.minutes}</td>
          <td data-stat="pens">${player.penalties}</td>
          <td data-stat="penaltiesMissed">${player.penaltiesMissed}</td>
          <td data-stat="shotsTotal">${player.shotsTotal}</td>
          <td data-stat="shotsOn">${player.shotsOn}</td>
          <td data-stat="dribblesAttempts">${player.dribblesAttempts}</td>
          <td data-stat="dribblesSucc">${player.dribblesSucc}</td>
          <td data-stat="dribblesPast">${player.dribblesPast}</td>
          <td data-stat="duelsTotal">${player.duelsTotal}</td>
          <td data-stat="duelsWon">${player.duelsWon}</td>
          <td data-stat="keyPasses">${player.keyPasses}</td>
          <td data-stat="foulsAgainst">${player.foulsAgainst}</td>
          <td data-stat="foulsCommited">${player.foulsCommited}</td>
          <td data-stat="blocks">${player.blocks}</td>
          <td data-stat="interceptions">${player.interceptions}</td>
          <td data-stat="tackles">${player.tackles}</td>
          <td data-stat="yellowCards">${player.yellowCards}</td>
          <td data-stat="redCards">${player.redCards}</td>
      `;
      tbody.appendChild(row);
  });
}