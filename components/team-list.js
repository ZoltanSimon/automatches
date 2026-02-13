import { tds } from "../common-styles.js";

let addToPage;
let ths = `<th title="Click to sort" class="list-header sortable">`;
import { sortTable, adjustColspan, showColumn, hideColumn } from "../common-functions.js";

const tableName = "team-list-table";


export function teamList(
  response,
  onlyTotal = true,
  addMatches = false,
  big = false
) {
  addMatches = true;
  createTeamsTable(response, onlyTotal, big);

  /*let matchesTable = document.getElementById("match-list");
  let allPlayingTeams = [];

  if (matchesTable && addMatches) {
    for (let i = 0; i < matchesTable.rows.length; i++) {
      if (i % 2 == 0) {
        thisTr = matchesTable.rows[i];
        team1 = findTeamById(response, thisTr.children[1].id);
        team2 = findTeamById(response, thisTr.children[7].id);
        allPlayingTeams.push(team1, team2);
        predictions(team1, team2);
      }
    }
    createTeamsTable(allPlayingTeams, onlyTotal);
  }*/
}

function createTeamsTable(response, onlyTotal, big) {
  let toFixed = 1;
  if (big) {
    toFixed = 2
    ths = `<th title="Click to sort" style="text-align: center; padding:2px; width:7%; border-right:1px solid #F1FAEE" class="sortable"><span class="header-title">`;
  }

  addToPage = ""; // Initialize the string to build the table rows
  let table = document.getElementById("team-list-table");
  const tableBody = document.querySelector("#team-list-table tbody"); // Target the table body
  
  window.addEventListener("resize", () => adjustColspan(table.rows[0], 1));

  adjustColspan(table.rows[0].cells[0], 1);

  if (!tableBody) {
    console.error("Table body not found! Ensure the table has a <tbody> element.");
    return;
  } else {
    table.style.visibility = 'visible';
  }

  for (let i = 0; i < response.length; i++) {
    const thisTeam = response[i];
    if (thisTeam) {
      addToPage += `<tr>
        <td style="padding:4px; border-right:none; cursor:pointer" onclick="window.location.href='/team?teamID=${thisTeam.id}'"><img src="images/logos/${thisTeam.id}.png" class="logo-picture"/></td>
        <td class="team-name" style="cursor:pointer" onclick="window.location.href='/team?teamID=${thisTeam.id}'">${thisTeam.name}</td>
        <td style="padding: 0px" data-stat="form">`;

      for (const result of thisTeam.form) {
        addToPage += `<span class="form-indicator ${result}"></span>`;
      }

      addToPage += `</td><td style="text-align: center;" data-stat="played">${thisTeam.played}</td>`;

      if (big) {
        addToPage += `<td style="text-align: center;" data-stat="winPercentage">${((100 * thisTeam.wins) / thisTeam.played).toFixed(1)}</td>
                      <td style="text-align: center;" data-stat="possession">${thisTeam.perGame.possession.toFixed(1)}</td>`;
      }

      addToPage += `
        
        <td style="text-align: center;" data-stat="goals">${thisTeam.total.goals}</td>
        <td style="text-align: center;" data-stat="goals">${thisTeam.total.goalsAgainst}</td>
        <td style="text-align: center;" data-stat="xG">${thisTeam.total.xG.toFixed(toFixed)}</td>
        <td style="text-align: center;" data-stat="xG">${thisTeam.total.xGA.toFixed(toFixed)}</td>
        <td style="text-align: center;" data-stat="corners">${thisTeam.total.corners}</td>
        <td style="text-align: center;" data-stat="corners">${thisTeam.total.cornersAgainst}</td>
        <td style="text-align: center;" data-stat="shotsOnGoal">${thisTeam.total.shotsOnGoal}</td>
        <td style="text-align: center;" data-stat="shotsOnGoal">${thisTeam.total.shotsOnGoalAgainst}</td>`;
        
        if (big) {
          addToPage += `
            <td style="text-align: center;" data-stat="fouls">${thisTeam.total.fouls}</td>
            <td style="text-align: center;" data-stat="fouls">${thisTeam.total.foulsAgainst}</td>
            <td style="text-align: center;" data-stat="yellowCards">${thisTeam.total.yellowCards}</td>
            <td style="text-align: center;" data-stat="yellowCards">${thisTeam.total.yellowCardsAgainst}</td>
            <td style="text-align: center;" data-stat="redCards">${thisTeam.total.redCards}</td>
            <td style="text-align: center;" data-stat="redCards">${thisTeam.total.redCardsAgainst}</td>
            <td style="text-align: center;" data-stat="offsides">${thisTeam.total.offsides}</td>
            <td style="text-align: center;" data-stat="offsides">${thisTeam.total.offsidesAgainst}</td>`;
        }

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
          ${tds}${thisTeam.last5PerGame.shotsOnGoalAgainst.toFixed(2)}</td>`   ;
      }

      addToPage += "</tr>";
    }
  }
  
  tableBody.innerHTML = addToPage;

  // Add checkbox event listeners for show/hide columns
const checkboxes = document.querySelectorAll("input[name='statSelector']");
  checkboxes.forEach((checkbox) =>
    checkbox.addEventListener("change", updateTableVisibility)
  );

  // Initial visibility update
  updateTableVisibility();

  // Add sorting functionality to subheader cells
  let subHeaderLength = table.rows[1].cells.length;
  let lastRowLength = table.rows[table.rows.length - 1].cells.length;

  for (let i = subHeaderLength - 1; i >= 0; i--) {
    let subheaderCell = table.rows[1].cells[i];

    subheaderCell.addEventListener("click", function () {
      let index = lastRowLength - subHeaderLength + i;
      sortTable(index, subheaderCell, table, 2); 
    });
  }
}

function updateTableVisibility() {
  console.log("Updating table visibility...");
  document.querySelectorAll(`#${tableName} th`).forEach((el, index) => {
    if (el.dataset.stat) {
      const checkbox = document.getElementById(el.dataset.stat);
      if (checkbox && !checkbox.checked) {
        console.log(`Hiding column: ${el.dataset.stat}`);
        hideColumn(el.dataset.stat, tableName);
      } else if (checkbox && checkbox.checked) {
        showColumn(el.dataset.stat, tableName);
      }
    }
  });
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