import {
  getTopTeams
} from "../../common-functions.js";
import { playerGoalList } from "../../components/player-list.js";
import { addLeagues } from "../common-functions.js";

await playerGoalList(false);

await getTopTeams([39, 140, 135, 78, 61, 88, 94], 10, false);

document.getElementById("match-list").style.visibility = "visible";

const response = await fetch(`/get-all-leagues`);
let allLeagues = await response.json();
allLeagues = allLeagues.filter(league => league.type === 'league');
addLeagues(allLeagues);