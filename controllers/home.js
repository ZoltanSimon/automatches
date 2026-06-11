import { playerGoalList } from "../../components/player-list.js";
import { addLeagues, addShowMoreButtons } from "../common-functions.js";
import { createTeamsTable } from "../components/team-list.js";

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