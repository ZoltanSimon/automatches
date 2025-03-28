import { matchList } from "./components/match-list.js";
import { loadPlayerFace } from "./instapics.js";
import { teamList } from "./components/team-list.js";
import { downloadMatch } from "./local-handler.js";

export let download = function (canvasName = "myCanvas") {
  var link = document.createElement("a");
  link.download = "genfoot.png";
  link.href = document.getElementById(canvasName).toDataURL();
  link.click();
};

export function imagePath(teamID) {
  return `images/logos/${teamID}.png`;
}

export function removeNewlines(str) {
  str = str.replace(/\s{2,}/g, "");
  str = str.replace(/\t/g, "");
  str = str
    .toString()
    .trim()
    .replace(/(\r\n|\n|\r)/g, "");
  return str;
}

export function htmlDecode(input) {
  var txt = document.createElement("textarea");
  txt.innerHTML = input;
  return txt.value;
}

export function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "&hellip;" : str;
}

export function copyText(field) {
  var copyText = document.getElementById(field);

  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices

  navigator.clipboard.writeText(copyText.value);
}

export function copyToClipboard(element) {
  var doc = document,
    text = doc.getElementById(element),
    range,
    selection;

  if (doc.body.createTextRange) {
    range = doc.body.createTextRange();
    range.moveToElementText(text);
    range.select();
  } else if (window.getSelection) {
    selection = window.getSelection();
    range = doc.createRange();
    range.selectNodeContents(text);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  document.execCommand("copy");
  window.getSelection().removeAllRanges();
  document.getElementById("btn").value = "Copied";
}

export async function showMatchesOnDate(date, showID) {
  let downloads = 0;
  let allLeaguematches = await fetch(`get-matches-on-day?matchDate=${date}`);
  let matches = await allLeaguematches.json();
  
  for (let match of matches) {
    let fixtureDate = new Date(match.fixture.date);
    const matchEnd = new Date(fixtureDate.getTime() + 150 * 60000);

    if (matchEnd <= new Date() && !match.statistics) {
      let cachedMatch = await (await fetch(`/match-exists?matchID=${match.fixture.id}`)).json();
      if (!cachedMatch && downloads < 10) {
        let downloadedMatch = await downloadMatch(match.fixture.id);
        updateOrAddMatch(matches, downloadedMatch[0]);
        downloads++;
      }
    }
  }

  if (matches.length > 0) matchList(matches, showID);
}

function updateOrAddMatch(matchArray, matchData) {
  const index = matchArray.findIndex(
    (m) => m.fixture.id === matchData.fixture.id
  );
  if (index !== -1) {
    matchArray[index] = matchData;
  } else {
    matchArray.push(matchData);
  }
}

export async function getTopTeams(leagues, amount, big) {
  const response = await fetch(
    `/get-teams?leagueID=${leagues.join(",")}`
  );
  const dasTeams = await response.json();

  dasTeams.sort((a, b) =>
    a.last5PerGame.points < b.last5PerGame.points
      ? 1
      : b.last5PerGame.points < a.last5PerGame.points
      ? -1
      : 0
  );

  teamList(dasTeams.slice(0, amount), true, false, big);
}

export function sortTable(n, td, table, startingRow = 1, toSwitch = true, secondaryColumn = null, thirdColumn = null) {
  let rows,
    switching = true,
    dir = "desc",
    switchcount = 0;

  while (switching) {
    switching = false;
    rows = table.rows;

    for (let i = startingRow; i < rows.length - 1; i++) {
      const x = parseFloat(rows[i].getElementsByTagName("TD")[n].innerHTML);
      const y = parseFloat(rows[i + 1].getElementsByTagName("TD")[n].innerHTML);
      let shouldSwitch = false;

      let secondaryX = null,
        secondaryY = null,
        thirdX = null,
        thirdY = null;

      if (secondaryColumn !== null && thirdColumn !== null) {
        secondaryX = parseFloat(rows[i].getElementsByTagName("TD")[secondaryColumn].innerHTML);
        secondaryY = parseFloat(rows[i + 1].getElementsByTagName("TD")[secondaryColumn].innerHTML);
        thirdX = parseFloat(rows[i].getElementsByTagName("TD")[thirdColumn].innerHTML);
        thirdY = parseFloat(rows[i + 1].getElementsByTagName("TD")[thirdColumn].innerHTML);
      }

      if (dir === "asc") {
        if (x > y) {
          shouldSwitch = true;
        } else if (x === y && secondaryColumn !== null && thirdColumn !== null) {
          shouldSwitch = (secondaryX - thirdX) > (secondaryY - thirdY);
        }
      } else if (dir === "desc") {
        if (x < y) {
          shouldSwitch = true;
        } else if (x === y && secondaryColumn !== null && thirdColumn !== null) {
          shouldSwitch = (secondaryX - thirdX) < (secondaryY - thirdY);
        }
      }

      if (shouldSwitch) {
        rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
        switching = true;
        switchcount++;
        break;
      }
    }

    if (toSwitch) {
      if (!switching && dir === "desc" && switchcount === 0) {
        dir = "asc";
        switching = true;
      }
    }
  }

  td.classList.add(dir);
}

export function removeColumn(theTable, columnIndex) {  
  // Remove header cell
  theTable.querySelectorAll("thead tr").forEach(row => {
      if (row.cells.length > columnIndex) row.deleteCell(columnIndex);
  });

  // Remove each cell in body rows
  theTable.querySelectorAll("tbody tr").forEach(row => {
      if (row.cells.length > columnIndex) row.deleteCell(columnIndex);
  });
}

export function hideColumn(stat) {
  document.querySelectorAll(`#player-list-table th[data-stat="${stat}"], 
                             #player-list-table td[data-stat="${stat}"]`)
      .forEach(cell => {
          cell.style.display = "none";
      });
}

export function showColumn(stat) {
  document.querySelectorAll(`#player-list-table th[data-stat="${stat}"], 
                             #player-list-table td[data-stat="${stat}"]`)
      .forEach(cell => {
          cell.style.display = "";
      });
}

export function getDate(date) {
  let d = new Date(date);
  let month = d.getMonth() + 1;
  let day = d.getDate();
  let year = d.getFullYear();

  return `${day < 10 ? "0" + day : day}.${month < 10 ? "0" + month : month}.${year}`;
}

export function adjustColspan(headerRow, newSpan) {
  const screenWidth = window.visualViewport.width;
  const threshold = 645; // Example: 768px for small screens

  if (screenWidth < threshold) {
    headerRow.colSpan = newSpan; // Reduce colspan when screen is narrow
  } else {
    headerRow.colSpan = newSpan +1; // Restore colspan when screen is wide
  }
}