import { playerGoalList } from "../../components/player-list.js";
import { addTablePagination, applyKnockoutBracketLayout, paginateMatchList } from "../common-functions.js";

applyKnockoutBracketLayout();

document.getElementById("match-list").style.visibility = "visible";

const seasonSelect = document.getElementById("league-season-select");

if (seasonSelect) {
	seasonSelect.addEventListener("change", () => {
		const leagueID = seasonSelect.dataset.leagueId;
		const season = seasonSelect.value;
		window.location.assign(`/league?id=${encodeURIComponent(leagueID)}&season=${encodeURIComponent(season)}`);
	});
}

await playerGoalList({ big: false, enableStatFilters: false });

paginateMatchList();
addTablePagination();

