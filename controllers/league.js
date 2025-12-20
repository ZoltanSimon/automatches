import { leagueStandings } from "../components/league-standings.js";
import { playerGoalList } from "../../components/player-list.js";

const urlParams = new URLSearchParams(window.location.search);
const leagueID = urlParams.get('league');
await leagueStandings(leagueID || 2);
document.getElementById("match-list").style.visibility = "visible";

await playerGoalList(false);

