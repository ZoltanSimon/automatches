import { matchList } from "./components/match-list.js";
import { teamList } from "./components/team-list.js";
import { selectedLeagues } from "./local-handler.js";

export let download = function (canvasName = "my-canvas") {
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

  /*for (let match of matches) {
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
  }*/

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
  const response = await fetch(`/get-teams?leagueID=${leagues.join(",")}`);
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

export function sortTable(n, td, table, startingRow = 1, secondaryColumn = null, thirdColumn = null) {
  // 1. Fixed Direction Logic
  // It checks the header for 'data-default-order'. If missing, it uses 'desc'.
  const dir = td.getAttribute("data-default-order") || "desc";

  // 2. Visual Polish
  table.querySelectorAll("th").forEach((th) => th.classList.remove("asc", "desc"));
  td.classList.add(dir);

  // 3. Sort Logic
  const rowsArray = Array.from(table.rows).slice(startingRow);
  rowsArray.sort((rowA, rowB) => {
    const x = parseFloat(rowA.cells[n].innerText) || 0;
    const y = parseFloat(rowB.cells[n].innerText) || 0;

    // If points are different, sort by points
    if (x !== y) return dir === "asc" ? x - y : y - x;

    // If points are equal, tie-break with Goal Difference (secondary - third)
    if (secondaryColumn !== null && thirdColumn !== null) {
      const gdA = (parseFloat(rowA.cells[secondaryColumn].innerText) || 0) - 
                  (parseFloat(rowA.cells[thirdColumn].innerText) || 0);
      const gdB = (parseFloat(rowB.cells[secondaryColumn].innerText) || 0) - 
                  (parseFloat(rowB.cells[thirdColumn].innerText) || 0);
      return dir === "asc" ? gdA - gdB : gdB - gdA;
    }
    return 0;
  });

  // 4. Update the DOM
  const tbody = table.querySelector('tbody') || table;
  rowsArray.forEach(row => tbody.appendChild(row));

  // 5. Apply colors to the new positions
  recolorRows(table, startingRow);
}

function recolorRows(table, startingRow) {
  for (let i = startingRow; i < table.rows.length; i++) {
    const rank = i - startingRow + 1;
    if (rank <= 8) {
      table.rows[i].style.backgroundColor = '#A8DADC'; // Top Zone
    } else if (rank <= 24) {
      table.rows[i].style.backgroundColor = '#F1FAEE'; // Mid Zone
    } else {
      table.rows[i].style.backgroundColor = '';
    }
  }
}

export function removeColumn(theTable, columnIndex) {
  // Remove header cell
  theTable.querySelectorAll("thead tr").forEach((row) => {
    if (row.cells.length > columnIndex) row.deleteCell(columnIndex);
  });

  // Remove each cell in body rows
  theTable.querySelectorAll("tbody tr").forEach((row) => {
    if (row.cells.length > columnIndex) row.deleteCell(columnIndex);
  });
}

export function hideColumn(stat) {
  document
    .querySelectorAll(
      `#player-list-table th[data-stat="${stat}"], 
                             #player-list-table td[data-stat="${stat}"]`
    )
    .forEach((cell) => {
      cell.style.display = "none";
    });
}

export function showColumn(stat) {
  document
    .querySelectorAll(
      `#player-list-table th[data-stat="${stat}"], 
                             #player-list-table td[data-stat="${stat}"]`
    )
    .forEach((cell) => {
      cell.style.display = "";
    });
}

export function getDate(date) {
  let d = new Date(date);
  let month = d.getMonth() + 1;
  let day = d.getDate();
  let year = d.getFullYear();

  return `${day < 10 ? "0" + day : day}.${
    month < 10 ? "0" + month : month
  }.${year}`;
}

export function adjustColspan(headerRow, newSpan) {
  const screenWidth = window.visualViewport.width;
  const threshold = 645; // Example: 768px for small screens

  if (screenWidth < threshold) {
    headerRow.colSpan = newSpan; // Reduce colspan when screen is narrow
  } else {
    headerRow.colSpan = newSpan + 1; // Restore colspan when screen is wide
  }
}

export function showToast(message, type = "info", duration = 3000) {
  // Remove existing toast if any
  const existingToast = document.querySelector(".toast");
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Show toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Hide toast after duration
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

export function addLeagues(leagues, admin = false) {
  // Get league from query param or use default
  const urlParams = new URLSearchParams(window.location.search);
  const leagueParam = urlParams.get("league");
  const leagueIDs = decodeURIComponent(leagueParam)
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean);
  const defaultLeagues = [39, 140, 135, 78, 61, 88, 94];

  // Initialize selectedLeagues based on query param or default
  if (leagueParam) {
    selectedLeagues.push(...leagueIDs);
  } else if (!admin && typeof defaultLeagues !== "undefined") {
    selectedLeagues.push(
      ...(Array.isArray(defaultLeagues) ? defaultLeagues : [defaultLeagues])
    );
  }
  
  for (const element of leagues) {
    if (element.Visible == 1) {
      const isSelected = selectedLeagues.includes(element.id);
      document.getElementById(
        `league-list-${element.type}`
      ).innerHTML += `<img width=30px id="img-${
        element.id
      }" class="league-to-select ${
        isSelected ? "selected-league" : ""
      }" src="images/competitions/${element.id}.png" alt="${
        element.name
      }" title="${element.name}"/>`;
      document
        .querySelectorAll(".league-to-select")
        .forEach((e) => e.addEventListener("click", selectLeague));
    }
  }

  function selectLeague(evt) {
    evt.currentTarget.classList.toggle("selected-league");
    let dasID = parseInt(evt.currentTarget.id.replace("img-", ""));
    if (!selectedLeagues.includes(dasID)) {
      selectedLeagues.push(dasID);
    } else {
      selectedLeagues.splice(selectedLeagues.indexOf(dasID), 1);
    }

    // Update URL and fetch new data (skip if admin mode)
    if (!admin) {
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.set("league", selectedLeagues.join(","));
      window.location.href = `${
        window.location.pathname
      }?${urlParams.toString()}`;
    }
  }
}
