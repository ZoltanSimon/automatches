import { playerGoalList } from "../../components/player-list.js";
import {
  addLeagues,
  addShowMoreButtons,
  applyKnockoutBracketLayout,
  setupLeagueListToggleButtons,
} from "../common-functions.js";
import { createTeamsTable } from "../components/team-list.js";

function arrangeHomeColumns() {
  const layoutContainer = document.querySelector(".home-page-layout");
  if (!layoutContainer) {
    return;
  }

  const existingColumns = layoutContainer.querySelectorAll(".home-page-column");
  existingColumns.forEach((column) => column.remove());

  const items = Array.from(layoutContainer.children).filter((child) =>
    child.classList.contains("rectangle") || child.classList.contains("ads-container")
  );

  if (items.length === 0) {
    return;
  }

  const columns = [document.createElement("div"), document.createElement("div")];
  columns.forEach((column) => {
    column.className = "home-page-column";
    layoutContainer.appendChild(column);
  });

  const columnHeights = [0, 0];
  items.forEach((item) => {
    const targetIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1;
    columns[targetIndex].appendChild(item);
    const itemHeight = item.offsetHeight || item.getBoundingClientRect().height || 0;
    columnHeights[targetIndex] += itemHeight + 20;
  });

  layoutContainer.classList.add("home-page-layout-grid");
}

applyKnockoutBracketLayout();

await playerGoalList({ big: false, enableStatFilters: false });

requestAnimationFrame(arrangeHomeColumns);
window.addEventListener("resize", arrangeHomeColumns);

const fixturesInfo = document.getElementById("fixtures-info");
if (fixturesInfo) {
  fixturesInfo.classList.add("expanded");
}

document.getElementById("match-list").style.visibility = "visible";
document.getElementById("player-transfers").style.visibility = "visible";

createTeamsTable(null, null, true);
addLeagues("pleague");
addLeagues("tleague");
addLeagues("sleague");
addLeagues("league");
addShowMoreButtons(".table-container:not(#player-transfers):not(#fixtures-info)");
setupLeagueListToggleButtons();