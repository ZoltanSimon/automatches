import { playerGoalList } from "../../components/player-list.js";
import { addShowMoreButtons } from "../common-functions.js";

await playerGoalList({ big: false, enableStatFilters: false });
document.getElementById("match-list").style.visibility = "visible";

addShowMoreButtons();