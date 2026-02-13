import {
  getTopTeams
} from "../../common-functions.js";
import { playerGoalList } from "../../components/player-list.js";
import { addLeagues } from "../common-functions.js";
import { leagueStandings } from "../components/league-standings.js";

await playerGoalList(false);

await getTopTeams([39, 140, 135, 78, 61, 88, 94], 10, false);

document.getElementById("match-list").style.visibility = "visible";

const response = await fetch(`/get-all-leagues`);
let allLeagues = await response.json();
allLeagues = allLeagues.filter(league => league.type === 'league');
addLeagues(allLeagues);

await leagueStandings(39);

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