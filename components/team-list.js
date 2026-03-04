import { tds } from "../common-styles.js";

let addToPage;
let ths = `<th title="Click to sort" class="list-header sortable">`;
import {
  sortTable,
  adjustColspan,
  showColumn,
  hideColumn,
} from "../common-functions.js";

const tableName = "team-list-table";

export function teamList(
  response,
  onlyTotal = true,
  addMatches = false,
  big = false,
) {
  addMatches = true;
  createTeamsTable(response, onlyTotal, big);
}

export function createTeamsTable(response, onlyTotal, big) {
  let toFixed = 1;
  if (big) {
    toFixed = 2;
    ths = `<th title="Click to sort" style="text-align: center; padding:2px; width:7%; border-right:1px solid #F1FAEE" class="sortable"><span class="header-title">`;
  }
  addToPage = ""; // Initialize the string to build the table rows
  let table = document.getElementById("team-list-table");
  const tableBody = document.querySelector("#team-list-table tbody"); // Target the table body

  window.addEventListener("resize", () => adjustColspan(table.rows[0], 1));
  adjustColspan(table.rows[0].cells[0], 1);

  if (!tableBody) {
    console.error(
      "Table body not found! Ensure the table has a <tbody> element.",
    );
    return;
  } else {
    table.style.visibility = "visible";
  }

  // Add checkbox event listeners for show/hide columns
  const checkboxes = document.querySelectorAll("input[name='statSelector']");
  checkboxes.forEach((checkbox) =>
    checkbox.addEventListener("change", updateTableVisibility),
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
  document.querySelectorAll(`#${tableName} th`).forEach((el, index) => {
    if (el.dataset.stat) {
      const checkbox = document.getElementById(el.dataset.stat);
      if (checkbox && !checkbox.checked) {
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