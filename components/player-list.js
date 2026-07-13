import { buildTableForTableType, imgs, ctx } from "../instapics.js";
import {
  removeNewlines,
  adjustColspan,
  sortTable,
} from "../common-functions.js";

const tableName = "player-list-table";
const table = document.getElementById(tableName);
const statFilterButtons = document.querySelectorAll(".stat-filter-btn");
const playerStatFiltersStorageKey = "players.activeStatFilters";

function saveActiveStats(hasPlayerStatFilters) {
  if (!hasPlayerStatFilters) {
    return;
  }

  try {
    const activeStats = Array.from(statFilterButtons)
      .filter((button) => button.classList.contains("active"))
      .map((button) => button.dataset.stat)
      .filter(Boolean);

    window.localStorage.setItem(
      playerStatFiltersStorageKey,
      JSON.stringify(activeStats),
    );
  } catch (error) {
    console.error("Unable to save player stat filters", error);
  }
}

function restoreActiveStats(hasPlayerStatFilters) {
  if (!hasPlayerStatFilters) {
    return;
  }

  try {
    const savedValue = window.localStorage.getItem(playerStatFiltersStorageKey);
    const savedStats = savedValue ? JSON.parse(savedValue) : null;

    if (!Array.isArray(savedStats) || !savedStats.length) {
      saveActiveStats(hasPlayerStatFilters);
      return;
    }

    const activeStats = new Set(savedStats);
    statFilterButtons.forEach((button) => {
      button.classList.toggle("active", activeStats.has(button.dataset.stat));
    });
  } catch (error) {
    console.error("Unable to restore player stat filters", error);
  }
}

export function playerGoalList({ big = false, enableStatFilters = false } = {}) {
  const hasPlayerStatFilters = enableStatFilters && statFilterButtons.length > 0;
  const tableBody = table.getElementsByTagName("tbody")[0];

  window.addEventListener("resize", () =>
    adjustColspan(table.rows[0].cells[0], 2),
  );
  adjustColspan(table.rows[0].cells[0], 2);

  if (!tableBody) {
    console.error(
      "Table body not found! Ensure the table has a <tbody> element.",
    );
    return;
  } else {
    table.style.visibility = "visible";
  }

  const statsFilterSide = document.getElementById("stats-filter-side");
  if (hasPlayerStatFilters && statsFilterSide) {
    statsFilterSide.style.display = "none";
    restoreActiveStats(hasPlayerStatFilters);
  }

  displayedPlayers.forEach((player) => {
    //loadPlayerFace(player.id);
    //loadClubLogo(player.club);
    //loadClubLogo(player.nation);
  });

  document.querySelectorAll(`#${tableName} th.sortable`).forEach((header) => {
    header.addEventListener("click", function () {
      const currentOrder = this.getAttribute("data-default-order") || "desc";
      const newOrder = currentOrder === "asc" ? "desc" : "asc";

      this.setAttribute("data-default-order", newOrder);
      document
        .querySelectorAll(`#${tableName} th.sortable`)
        .forEach((h) => h.classList.remove("asc", "desc"));
      this.classList.add(newOrder);

      // Convert header index to actual table cell index accounting for colspan
      const headerCells = Array.from(this.parentElement.children);
      const headerIndex = headerCells.indexOf(this);
      const columnIndex = headerCells
        .slice(0, headerIndex)
        .reduce((sum, th) => sum + (Number(th.colSpan) || 1), 0);

      sortTable(columnIndex, this, table, 1);

      updateTableVisibility(hasPlayerStatFilters);
    });
  });

  if (hasPlayerStatFilters) {
    statFilterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("active");
        saveActiveStats(hasPlayerStatFilters);
        updateTableVisibility(hasPlayerStatFilters);
      });
    });
  }

  updateTableVisibility(hasPlayerStatFilters);

  let rows = document.querySelectorAll(`#${tableName} tbody tr`); // Select all rows inside your table
  let rowsPerPage = 100;
  let currentVisible = rowsPerPage;

  rows.forEach((row, index) => {
    if (index >= rowsPerPage) {
      row.style.display = "none";
    }
  });

  if (big && displayedPlayers.length > 99) {
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

  playerListTable.rows[0].deleteCell(6);
  playerListTable.rows[0].deleteCell(6);

  playerListTable.rows[0].cells[2].innerHTML = "Apps";
  playerListTable.rows[0].cells[3].innerHTML = "Goal";
  playerListTable.rows[0].cells[5].innerHTML = "As.";
  playerListTable.rows[0].cells[6].innerHTML = "Rate";

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

    thisTr.deleteCell(8);
    thisTr.deleteCell(8);
    thisTr.deleteCell(-1);

    thisTr.children[5].style.fontWeight = "bold";

    //center cells from 3 to the last
    for (let j = 3; j < thisTr.children.length; j++) {
      thisTr.children[j].style.textAlign = "center";
    }
  }

  buildTableForTableType(
    removeNewlines(playerListTable.outerHTML),
    imgToAdd,
    110,
  );
  ctx.fillStyle = "#e63946";
}

document.addEventListener("DOMContentLoaded", function () {});

function updateTableVisibility(hasPlayerStatFilters) {
  if (hasPlayerStatFilters) {
    const activeStats = new Set(
      Array.from(document.querySelectorAll(".stat-filter-btn.active")).map(
        (button) => button.dataset.stat,
      ),
    );

    document.querySelectorAll(`#${tableName} th[data-stat]`).forEach((el) => {
      const isVisible = activeStats.has(el.dataset.stat);
      document
        .querySelectorAll(
          `#${tableName} th[data-stat="${el.dataset.stat}"], #${tableName} td[data-stat="${el.dataset.stat}"]`,
        )
        .forEach((cell) => {
          cell.style.display = isVisible ? "" : "none";
        });
    });
  }

  document.querySelectorAll(`#${tableName} tbody tr`).forEach((row, index) => {
    row.style.display = index < 200 ? "" : "none";
  });
}
