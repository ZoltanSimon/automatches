import { playerGoalList } from "../../components/player-list.js";
import { addShowMoreButtons } from "../common-functions.js";

await playerGoalList(false);
document.getElementById("match-list").style.visibility = "visible";

addShowMoreButtons();