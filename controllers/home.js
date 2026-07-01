import { playerGoalList } from "../../components/player-list.js";
import { addLeagues, addShowMoreButtons } from "../common-functions.js";
import { createTeamsTable } from "../components/team-list.js";

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

await playerGoalList(false);

document.getElementById("match-list").style.visibility = "visible";

createTeamsTable(null, null, true);
addLeagues("pleague");
addLeagues("tleague");
addLeagues("sleague");
addShowMoreButtons();

document.querySelectorAll('.rect-expand-league-list a').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.target.closest('.rect-header').querySelector('.rect-league-list').classList.toggle('visible');
    e.target.closest('.rect-expand-league-list').classList.toggle('active');
  });
});