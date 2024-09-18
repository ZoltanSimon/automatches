let addToPage;
let tds = `<td style="text-align: center; width: 68px; padding:2px;">`;
let thisTeam, thisTr, thisId;

export function teamList(response) {
  console.log(response);
  createTeamsTable(response);

  let matchesTable = document.getElementById("match-list");
  let allPlayingTeams = [];

  if (matchesTable) {
    for (let i = 0; i < matchesTable.rows.length; i++) {
      if (i % 2 == 0) {
        thisTr = matchesTable.rows[i];
        console.log(thisTr.children[1].id);
        console.log(thisTr.children[7].id);
        allPlayingTeams.push(findTeamById(response, thisTr.children[1].id));
        allPlayingTeams.push(findTeamById(response, thisTr.children[7].id));
      }
    }
    console.log(allPlayingTeams);
    createTeamsTable(allPlayingTeams);
  }
}

function findTeamById(response, thisId) {
  return response.find((element) => element.id == thisId);
}

function createTeamsTable(response) {
  addToPage = `<table style='border-collapse: collapse; border: 3px solid #1D3557;' border='1' id="team-list-table">
    <thead>
    <tr>
    <th rowspan=2>Team</th>
    <th style="text-align: center; padding:2px;" colspan=10>Total</th>
    <th style="text-align: center; padding:2px;" colspan=8>Per Game</th>
    <th style="text-align: center; padding:2px;" colspan=8>Last 5</th>
    <th style="text-align: center; padding:2px;" colspan=8>Last 5 Per Game</th>
    </tr>
    <tr>
    ${tds}Form</td>
    ${tds}Matches</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    ${tds}Goals</td>
    ${tds}GoalsA</td>
    ${tds}xG</td>
    ${tds}xGA</td>
    ${tds}Corners</td>
    ${tds}CornersA</td>
    ${tds}ShotsG</td>
    ${tds}ShotsGA</td>
    </tr>
    </thead>
    <tbody>`;

  for (let i = 0; i < response.length; i++) {
    thisTeam = response[i];
    if (thisTeam) {
      addToPage += `<tr>
      <td>${thisTeam.name}</td>
      <td>${thisTeam.form}</td>
      ${tds}${thisTeam.matches}</td>
      ${tds}${thisTeam.total.goals}</td>
      ${tds}${thisTeam.total.goalsAgainst}</td>
      ${tds}${thisTeam.total.xG.toFixed(2)}</td>
      ${tds}${thisTeam.total.xGA.toFixed(2)}</td>
      ${tds}${thisTeam.total.corners}</td>
      ${tds}${thisTeam.total.cornersAgainst}</td>
      ${tds}${thisTeam.total.shotsOnGoal}</td>
      ${tds}${thisTeam.total.shotsOnGoalAgainst}</td>
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
      ${tds}${thisTeam.last5PerGame.shotsOnGoalAgainst.toFixed(2)}</td>
      </tr>`;
    }
  }
  addToPage += `</tbody></table>`;

  document.getElementById("team-list-betting").innerHTML += addToPage;

  let table = document.getElementById("team-list-table");

  console.log(table.rows[1]);

  for (let i = 0; i < table.rows[1].cells.length; i++) {
    let thisTd = table.rows[1].cells[i];
    thisTd.addEventListener("click", function (e) {
      sortTable(i + 1);
    });
  }
}

function sortTable(n) {
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
}

/*      ${tds}${thisTeam.total.goals}</td>
${tds}${thisTeam.total.goalsAgainst}</td>
${tds}${thisTeam.total.xG.toFixed(2)}</td>
${tds}${thisTeam.total.xGA.toFixed(2)}</td>
${tds}${thisTeam.total.corners}</td>
${tds}${thisTeam.total.cornersAgainst}</td>
${tds}${thisTeam.total.shotsOnGoal}</td>
${tds}${thisTeam.total.shotsOnGoalAgainst}</td>
${tds}${thisTeam.perGame.goals.toFixed(2)}</td>
${tds}${thisTeam.perGame.goalsAgainst.toFixed(2)}</td>
${tds}${thisTeam.perGame.xG.toFixed(2)}</td>
${tds}${thisTeam.perGame.xGA.toFixed(2)}</td>
${tds}${thisTeam.perGame.corners.toFixed(2)}</td>
${tds}${thisTeam.perGame.cornersAgainst.toFixed(2)}</td>
${tds}${thisTeam.perGame.shotsOnGoal.toFixed(2)}</td>
${tds}${thisTeam.perGame.shotsOnGoalAgainst.toFixed(2)}</td>

<table id="myTable2">
<tr>
<!--When a header is clicked, run the sortTable function, with a parameter,
0 for sorting by names, 1 for sorting by country: -->
<th onclick="sortTable(0)">Name</th>
<th onclick="sortTable(1)">Country</th>
</tr>*/
