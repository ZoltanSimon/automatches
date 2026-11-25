import { playerGoalList } from "../../components/player-list.js";
import { addTablePagination, applyKnockoutBracketLayout, paginateMatchList } from "../common-functions.js";

applyKnockoutBracketLayout();

document.getElementById("match-list").style.visibility = "visible";

const seasonSelect = document.getElementById("league-season-select");

if (seasonSelect) {
	seasonSelect.addEventListener("change", () => {
		// Each option carries its canonical URL, rendered server-side.
		const url = seasonSelect.selectedOptions[0]?.dataset.url;
		if (url) window.location.assign(url);
	});
}

await playerGoalList({ big: false, enableStatFilters: false });

paginateMatchList();
addTablePagination();

