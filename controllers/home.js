import {
  showMatchesOnDate,
  getTopTeams
} from "../../common-functions.js";
import { playerGoalList } from "../../components/player-list.js";

//showMatchesOnDate(new Date(), false);

await playerGoalList(false);

await getTopTeams([39, 140, 135, 78, 61, 88, 94], 10, false);