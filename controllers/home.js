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

document.getElementById("match-list").style.visibility = "visible";

createTeamsTable(null, null, true);
addLeagues("pleague");
addLeagues("tleague");
addLeagues("sleague");
addShowMoreButtons();
setupLeagueListToggleButtons();