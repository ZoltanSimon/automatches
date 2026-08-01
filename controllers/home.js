import { playerGoalList } from "../../components/player-list.js";
import {
  addLeagues,
  addShowMoreButtons,
  applyKnockoutBracketLayout,
  setupLeagueListToggleButtons,
} from "../common-functions.js";
import { createTeamsTable } from "../components/team-list.js";

applyKnockoutBracketLayout();

await playerGoalList({ big: false, enableStatFilters: false });

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