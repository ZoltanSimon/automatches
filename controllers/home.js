import { playerGoalList } from "../../components/player-list.js";
import { addLeagues } from "../common-functions.js";
import { leagueStandings } from "../components/league-standings.js";
import { createTeamsTable } from "../components/team-list.js";

await playerGoalList(false);

document.getElementById("match-list").style.visibility = "visible";

createTeamsTable(null, null, true);
addLeagues("pleague");
addLeagues("tleague");
addLeagues("sleague");

const params = new URLSearchParams(window.location.search);
const sleague = params.get("sleague") ?? 39;

await leagueStandings(sleague);

document.querySelectorAll('.table-container').forEach(container => {
  // Check if content actually overflows
  const needsExpansion = container.scrollHeight > container.clientHeight;
  
  if (needsExpansion) {
    // Add class to show fade
    container.classList.add('has-overflow');
    
    // Create and add button INSIDE container
    const btn = document.createElement('button');
    btn.className = 'show-more-btn';
    btn.textContent = 'Show More';
    container.appendChild(btn);
    
    // Add click handler
    btn.addEventListener('click', () => {
      container.classList.toggle('expanded');
      btn.textContent = container.classList.contains('expanded') ? 'Show Less' : 'Show More';
    });
  }
});

document.querySelectorAll('.rect-expand-league-list a').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.target.closest('.rect-header').querySelector('.rect-league-list').classList.toggle('visible');
    e.target.closest('.rect-expand-league-list').classList.toggle('active');
  });
});