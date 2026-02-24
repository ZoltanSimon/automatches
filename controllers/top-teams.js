import { createTeamsTable } from "../components/team-list.js";
import { addLeagues } from "../common-functions.js";

createTeamsTable(null, null, true);
addLeagues("tleague");

document.querySelector(".more-button").addEventListener("click", function () {
  const container = document.getElementById("statSelectorContainer");
  const button = this;

  if (container.style.maxHeight) {
    container.style.maxHeight = null;
    container.classList.remove("open");
    button.classList.remove("active");
  } else {
    container.style.maxHeight = container.scrollHeight + "px";
    container.classList.add("open");
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