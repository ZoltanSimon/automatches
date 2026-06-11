import { playerGoalList } from "../../components/player-list.js";
import { addShowMoreButtons } from "../common-functions.js";

document.getElementById("match-list").style.visibility = "visible";

await playerGoalList(false);

addShowMoreButtons();

