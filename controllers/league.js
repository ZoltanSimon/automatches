import { playerGoalList } from "../../components/player-list.js";
import { addShowMoreButtons, applyKnockoutBracketLayout } from "../common-functions.js";

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

await playerGoalList(false);

addShowMoreButtons();

