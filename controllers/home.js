import { playerGoalList } from "../../components/player-list.js";
import {
  addLeagues,
  addTablePagination,
  applyKnockoutBracketLayout,
  setupLeagueListToggleButtons,
} from "../common-functions.js";
import { createTeamsTable } from "../components/team-list.js";

function arrangeHomeColumns() {
  const layoutContainer = document.querySelector(".home-page-layout");
  if (!layoutContainer) {
    return;
  }

  const existingColumns = Array.from(layoutContainer.querySelectorAll(".home-page-column"));
  const currentItems = existingColumns.flatMap((column) =>
    Array.from(column.children).filter(
      (child) => child.classList.contains("rectangle") || child.classList.contains("ads-container")
    )
  );

  const items = currentItems.length > 0
    ? currentItems
    : Array.from(layoutContainer.children).filter(
        (child) => child.classList.contains("rectangle") || child.classList.contains("ads-container")
      );

  if (items.length === 0) {
    return;
  }

  existingColumns.forEach((column) => column.remove());

  const columnCount = window.innerWidth <= 900 ? 1 : 2;
  const columns = Array.from({ length: columnCount }, () => {
    const column = document.createElement("div");
    column.className = "home-page-column";
    layoutContainer.appendChild(column);
    return column;
  });

  const columnHeights = Array(columnCount).fill(0);
  items.forEach((item) => {
    const targetIndex = columnCount === 1 ? 0 : columnHeights[0] <= columnHeights[1] ? 0 : 1;
    columns[targetIndex].appendChild(item);
    const itemHeight = item.offsetHeight || item.getBoundingClientRect().height || 0;
    columnHeights[targetIndex] += itemHeight + 20;
  });

  layoutContainer.classList.add("home-page-layout-grid");
}

function showHomeColumns() {
  const layoutContainer = document.querySelector(".home-page-layout");
  if (!layoutContainer) {
    return;
  }

  requestAnimationFrame(() => {
    layoutContainer.classList.remove("home-page-layout-pending");
  });
}

applyKnockoutBracketLayout();

await playerGoalList({ big: false, enableStatFilters: false });

document.getElementById("match-list").style.visibility = "visible";
document.getElementById("player-transfers").style.visibility = "visible";

createTeamsTable(null, null, false);
addLeagues("pleague");
addLeagues("tleague");
addLeagues("sleague");
addLeagues("league");
addTablePagination(".table-container:not(#player-transfers):not(#fixtures-info):not(#top-team-list)");
setupLeagueListToggleButtons();

arrangeHomeColumns();
showHomeColumns();
window.addEventListener("resize", arrangeHomeColumns);