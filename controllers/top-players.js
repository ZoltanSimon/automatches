import { playerGoalList, renderActiveViewChips } from "../components/player-list.js";
import {
  addLeagues,
  setupLeagueListToggleButtons,
} from "../common-functions.js";

await playerGoalList({ big: true, enableStatFilters: true });
addLeagues("pleague");
renderActiveViewChips();

document.querySelector(".more-button").addEventListener("click", function () {
  const container = document.getElementById("stats-filter-side");
  const playersLayout = document.querySelector(".players-page-layout");
  const button = this;
  container.style.display = "block";

  if (container.classList.contains("open")) {
    container.classList.remove("open");
    playersLayout?.classList.remove("filters-open");
    button.classList.remove("active");
  } else {
    container.classList.add("open");
    playersLayout?.classList.add("filters-open");
    button.classList.add("active");
  }
});

setupLeagueListToggleButtons();