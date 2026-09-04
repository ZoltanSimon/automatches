import { playerGoalList } from "../../components/player-list.js";
import { addTablePagination, paginateMatchList } from "../common-functions.js";

await playerGoalList({ big: false, enableStatFilters: false, pageSize: 20 });
document.getElementById("match-list").style.visibility = "visible";

paginateMatchList({ startOnCurrentMatch: true });
addTablePagination();
