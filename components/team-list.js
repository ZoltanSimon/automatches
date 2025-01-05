import { tds } from "../common-styles.js";

let addToPage;
let ths = `<th title="Click to sort" class="team-list-header sortable">`;
let thisTr;

export function teamList(
  response,
  onlyTotal = true,
  addMatches = false,
  big = false
) {
  let team1, team2;
  addMatches = true;
  createTeamsTable(response, onlyTotal, big);

  let matchesTable = document.getElementById("match-list");
  let allPlayingTeams = [];

  if (matchesTable && addMatches) {
    for (let i = 0; i < matchesTable.rows.length; i++) {
      if (i % 2 == 0) {
        thisTr = matchesTable.rows[i];
        team1 = findTeamById(response, thisTr.children[1].id);
        team2 = findTeamById(response, thisTr.children[7].id);
        allPlayingTeams.push(team1, team2);
        //predictions(team1, team2);
      }
    }
    //createTeamsTable(allPlayingTeams, onlyTotal);
  }
}

function createTeamsTable(response, onlyTotal, big) {
  let toFixed = 1;
  if (big) {
    toFixed = 2
    ths = `<th title="Click to sort" style="text-align: center; padding:2px; width:7%; border-right:1px solid #F1FAEE" class="sortable"><span class="header-title">`;
  }

  addToPage = ""; // Initialize the string to build the table rows
  const tableBody = document.querySelector("#team-list-table tbody"); // Target the table body
  
  if (!tableBody) {
    console.error("Table body not found! Ensure the table has a <tbody> element.");
    return;
  }
  
  for (let i = 0; i < response.length; i++) {
    const thisTeam = response[i];
    if (thisTeam) {
      addToPage += `<tr>
        <td style="padding:4px; border-right:none"><img height=50 src="images/logos/${thisTeam.id}.png" /></td>
        <td class="team-name">${thisTeam.name}</td>
        <td style="padding:0">`;

      for (const result of thisTeam.form) {
        addToPage += `<span class="form-indicator ${result}"></span>`;
      }

      addToPage += `</td>${tds}${thisTeam.matches}</td>`;

      if (big) {
        addToPage += `${tds}${((100 * thisTeam.wins) / thisTeam.matches).toFixed(1)}</td>`;
      }

      addToPage += `
        ${tds}${thisTeam.total.goals}</td>
        ${tds}${thisTeam.total.goalsAgainst}</td>
        ${tds}${thisTeam.total.xG.toFixed(toFixed)}</td>
        ${tds}${thisTeam.total.xGA.toFixed(toFixed)}</td>
        ${tds}${thisTeam.total.corners}</td>
        ${tds}${thisTeam.total.cornersAgainst}</td>
        ${tds}${thisTeam.total.shotsOnGoal}</td>
        ${tds}${thisTeam.total.shotsOnGoalAgainst}</td>`;

      if (!onlyTotal) {
        addToPage += `
          ${tds}${thisTeam.perGame.goals.toFixed(2)}</td>
          ${tds}${thisTeam.perGame.goalsAgainst.toFixed(2)}</td>
          ${tds}${thisTeam.perGame.xG.toFixed(2)}</td>
          ${tds}${thisTeam.perGame.xGA.toFixed(2)}</td>
          ${tds}${thisTeam.perGame.corners.toFixed(2)}</td>
          ${tds}${thisTeam.perGame.cornersAgainst.toFixed(2)}</td>
          ${tds}${thisTeam.perGame.shotsOnGoal.toFixed(2)}</td>
          ${tds}${thisTeam.perGame.shotsOnGoalAgainst.toFixed(2)}</td>
          ${tds}${thisTeam.last5.goals}</td>
          ${tds}${thisTeam.last5.goalsAgainst}</td>
          ${tds}${thisTeam.last5.xG.toFixed(2)}</td>
          ${tds}${thisTeam.last5.xGA.toFixed(2)}</td>
          ${tds}${thisTeam.last5.corners}</td>
          ${tds}${thisTeam.last5.cornersAgainst}</td>
          ${tds}${thisTeam.last5.shotsOnGoal}</td>
          ${tds}${thisTeam.last5.shotsOnGoalAgainst}</td>
          ${tds}${thisTeam.last5PerGame.goals.toFixed(2)}</td>
          ${tds}${thisTeam.last5PerGame.goalsAgainst.toFixed(2)}</td>
          ${tds}${thisTeam.last5PerGame.xG.toFixed(2)}</td>
          ${tds}${thisTeam.last5PerGame.xGA.toFixed(2)}</td>
          ${tds}${thisTeam.last5PerGame.corners.toFixed(2)}</td>
          ${tds}${thisTeam.last5PerGame.cornersAgainst.toFixed(2)}</td>
          ${tds}${thisTeam.last5PerGame.shotsOnGoal.toFixed(2)}</td>
          ${tds}${thisTeam.last5PerGame.shotsOnGoalAgainst.toFixed(2)}</td>`;
      }

      addToPage += "</tr>";
    }
  }
  
    tableBody.innerHTML = addToPage;


  let table = document.getElementById("team-list-table");
  let subHeaderLength = table.rows[1].cells.length;
  let lastRowLength = table.rows[table.rows.length - 1].cells.length;

  for (let i = subHeaderLength -1; i >= 0; i--) {
    let subheaderCell = table.rows[1].cells[i];

    subheaderCell.addEventListener("click", function () {
      let index = lastRowLength - subHeaderLength + i;
      sortTable(index, subheaderCell); 
    });
  }
}

function sortTable(n, td) {
  var table,
    rows,
    switching,
    i,
    x,
    y,
    shouldSwitch,
    dir,
    switchcount = 0;
  table = document.getElementById("team-list-table");
  switching = true;
  // Set the sorting direction to ascending:
  dir = "asc";
  /* Make a loop that will continue until
  no switching has been done: */
  while (switching) {
    // Start by saying: no switching is done:
    switching = false;
    rows = table.rows;
    /* Loop through all table rows (except the
    first, which contains table headers): */
    for (i = 2; i < rows.length - 1; i++) {
      // Start by saying there should be no switching:
      shouldSwitch = false;
      /* Get the two elements you want to compare,
      one from current row and one from the next: */
      x = rows[i].getElementsByTagName("TD")[n];
      y = rows[i + 1].getElementsByTagName("TD")[n];
      /* Check if the two rows should switch place,
      based on the direction, asc or desc: */
      if (dir == "asc") {
        if (parseFloat(x.innerHTML) > parseFloat(y.innerHTML)) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      } else if (dir == "desc") {
        if (parseFloat(x.innerHTML) < parseFloat(y.innerHTML)) {
          // If so, mark as a switch and break the loop:
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      /* If a switch has been marked, make the switch
      and mark that a switch has been done: */
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      // Each time a switch is done, increase this count by 1:
      switchcount++;
    } else {
      /* If no switching has been done AND the direction is "asc",
      set the direction to "desc" and run the while loop again. */
      if (switchcount == 0 && dir == "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }

  td.classList.add(dir);
}

function predictions(homeTeam, awayTeam) {
  console.log(homeTeam.name);
  console.log(homeTeam.last5PerGame);
  console.log(awayTeam.name);
  console.log(awayTeam.last5PerGame);
  console.log(getGoal(homeTeam.last5PerGame, awayTeam.last5PerGame));
  console.log(getGoal(awayTeam.last5PerGame, homeTeam.last5PerGame));
}

function getGoal(stat1, stat2) {
  let plus = 0;
  let minus = 0;
  if (stat1.xG > stat1.goals + 0.25) plus += 0.4;
  if (stat1.xG < 1) minus += 0.25;
  if (stat1.xG < 0.75) minus += 0.1;

  if (stat1.shotsOnGoal > 2.5) plus += 0.25;
  if (stat1.shotsOnGoal < stat1.goals * 3) minus += 0.25;
  if (stat2.shotsOnGoalAgainst > 2.5) plus += 0.25;

  if (stat1.corners > 6) plus += 0.25;
  if (stat2.cornersAgainst > 6) plus += 0.25;

  return (
    ((stat1.goals * 2 + stat1.xG) / 3 +
      (stat2.goalsAgainst * 2 + stat2.xGA) / 3) /
      2 +
    plus -
    minus
  ).toFixed(1);
}

function findTeamById(response, thisId) {
  return response.find((element) => element.id == thisId);
}
