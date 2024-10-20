import {
  showMatchesOnDate,
  getTopPlayers,
  getTopTeams,
} from "../../common-functions.js";

showMatchesOnDate(new Date(), false);

await getTopPlayers([39, 140, 135, 78, 61, 88, 94], 10, false);

await getTopTeams([39, 140, 135, 78, 61, 88, 94], 10, false);
