import { playerGoalList } from "../../components/player-list.js";
import { addShowMoreButtons } from "../common-functions.js";

const BRACKET_UNIT_PX = 89;
const BRACKET_MATCH_CARD_HEIGHT_PX = 80;

for (const section of document.querySelectorAll('.knockout-round')) {
  const roundIndex = Number(section.dataset.roundIndex);
  let step = Math.pow(2, roundIndex);
  if (roundIndex == 4) {
	step = 7;
  }
  const matchGap = roundIndex === 0 ? 8 : Math.max(8, step * BRACKET_UNIT_PX - BRACKET_MATCH_CARD_HEIGHT_PX);
  const matchesDiv = section.querySelector('.knockout-round-matches');
  if (matchesDiv) {
    matchesDiv.style.setProperty('--round-gap', `${matchGap}px`);
  }
}

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

