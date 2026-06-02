import { createTeamsTable } from "../components/team-list.js";
import { addLeagues } from "../common-functions.js";

createTeamsTable(null, null, true);
addLeagues("tleague");

document.querySelector(".more-button").addEventListener("click", function () {
  const container = document.getElementById("team-stats-filter-side");
  const teamsLayout = document.querySelector(".teams-page-layout");
  const button = this;
  container.style.display = "block";

  if (container.classList.contains("open")) {
    container.classList.remove("open");
    teamsLayout?.classList.remove("filters-open");
    button.classList.remove("active");
  } else {
    container.classList.add("open");
    teamsLayout?.classList.add("filters-open");
    button.classList.add("active");
  }
});

document.querySelectorAll('.rect-expand-league-list a').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.target.closest('.rect-header').querySelector('.rect-league-list').classList.toggle('visible');
    e.target.closest('.rect-expand-league-list').classList.toggle('active');
  });
});