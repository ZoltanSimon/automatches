import {
  showMatchesOnDate,
  getTopPlayers,
  getTopTeams,
} from "../../common-functions.js";

showMatchesOnDate(new Date(), false);

await getTopPlayers([39, 140, 135, 78, 61, 88, 94], 10, false);

await getTopTeams([39, 140, 135, 78, 61, 88, 94], 10, false);

function adjustColspan() {
  let table = document.getElementById("team-list-table");
  let headerRow = table.rows[0]; // First row of the table (main header)

  const screenWidth = window.innerWidth;
  const threshold = 645; // Example: 768px for small screens

  let colspannedHeader = headerRow.cells[0]; // Adjust to the specific cell index
  if (screenWidth < threshold) {
    colspannedHeader.colSpan = 1; // Reduce colspan when screen is narrow
  } else {
    colspannedHeader.colSpan = 2; // Restore colspan when screen is wide
  }
}

window.addEventListener("resize", adjustColspan);

adjustColspan();