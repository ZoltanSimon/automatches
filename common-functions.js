import { matchList } from "./components/match-list.js";
import { selectedLeagues } from "./local-handler.js";
import { defaultLeagues } from "./shared/defaults.js";

export const BRACKET_UNIT_PX = 71;
export const BRACKET_MATCH_CARD_HEIGHT_PX = 63;
export const BRACKET_ROUND_OFFSET_UNIT_PX = 72;

export function getBracketRoundLayout(roundIndex) {
  const step = Math.pow(2, roundIndex);
  const columnTopOffset = roundIndex === 0
    ? 0
    : Math.round(((step - 1) * BRACKET_ROUND_OFFSET_UNIT_PX) / 2);

  return { columnTopOffset };
}

export function applyKnockoutBracketLayout(root = document) {
  for (const section of root.querySelectorAll(".knockout-round")) {
    const roundIndex = Number(section.dataset.roundIndex);
    let step = Math.pow(2, roundIndex);

    if (roundIndex === 4) {
      step = 7;
    }

    const { columnTopOffset } = getBracketRoundLayout(roundIndex);
    const matchGap = roundIndex === 0
      ? 8
      : Math.max(8, step * BRACKET_UNIT_PX - BRACKET_MATCH_CARD_HEIGHT_PX);
    const matchesDiv = section.querySelector(".knockout-round-matches");

    if (matchesDiv) {
      matchesDiv.style.setProperty("--round-gap", `${matchGap}px`);
      matchesDiv.style.setProperty("--round-offset", `${columnTopOffset}px`);
    }
  }
}

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

export function parseColumnIndex(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSortDirection(value, fallback = "desc") {
  return String(value || fallback).toLowerCase() === "asc" ? "asc" : "desc";
}

export function getNextSortDirection(isSameTarget, currentDirection = "desc") {
  return isSameTarget && currentDirection === "desc" ? "asc" : "desc";
}

export function getPageQueryParams() {
  return new URLSearchParams(window.location.search);
}

export function navigateWithUpdatedQuery(updateParams) {
  const urlParams = getPageQueryParams();
  updateParams(urlParams);
  urlParams.delete("ppage");

  const nextQuery = urlParams.toString();
  window.location.href = nextQuery
    ? `${window.location.pathname}?${nextQuery}`
    : window.location.pathname;
}

export function encodeCompactStatFilters(filters, includeColumnIndex = false) {
  return (Array.isArray(filters) ? filters : [])
    .map((filter) => {
      const parts = [
        String(filter?.stat || ""),
        String(filter?.operator || ""),
        String(filter?.min || ""),
        String(filter?.max || ""),
      ];

      if (includeColumnIndex) {
        const columnIndex = parseColumnIndex(filter?.columnIndex);
        parts.push(columnIndex !== null ? String(columnIndex) : "");
      }

      return parts.join("~");
    })
    .join("|");
}

export function decodeCompactStatFilters(serializedFilters, normalizeFilter, includeColumnIndex = false) {
  if (!serializedFilters || typeof normalizeFilter !== "function") {
    return [];
  }

  return serializedFilters
    .split("|")
    .map((segment) => {
      const [stat = "", operator = "", min = "", max = "", columnIndex = ""] = segment.split("~");
      return normalizeFilter(
        includeColumnIndex
          ? { stat, operator, min, max, columnIndex }
          : { stat, operator, min, max },
      );
    })
    .filter(Boolean);
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

export const DEFAULT_TABLE_PAGE_SIZE = 10;
export const TOP_PLAYERS_PAGE_SIZE = 100;

function shouldSkipTablePagination(container) {
  return Boolean(
    container.id === "standings"
    || container.classList.contains("world-cup-panel")
    || container.querySelector("#league-standings, .knockout-round, .world-cup-group-table"),
  );
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis");
  }

  items.push(totalPages);
  return items;
}

function createPaginationButton(label, { current = false, disabled = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  if (current) {
    button.setAttribute("aria-current", "page");
  }
  return button;
}

export function paginateTable(root, options = {}) {
  if (!root) {
    return null;
  }

  const pageSize = Number(options.pageSize) > 0 ? Number(options.pageSize) : DEFAULT_TABLE_PAGE_SIZE;
  const rowSelector = options.rowSelector || "tbody tr";
  const isRowEligible = typeof options.isRowEligible === "function"
    ? options.isRowEligible
    : () => true;
  const pagerHost = options.pagerHost
    || root.closest(".table-container")
    || root.parentElement
    || root;
  let currentPage = Math.max(1, Number.parseInt(options.initialPage, 10) || 1);

  const existingPager = root.nextElementSibling?.classList.contains("table-pagination")
    ? root.nextElementSibling
    : pagerHost.querySelector(":scope > .table-pagination");
  let nav = existingPager;
  if (!nav) {
    nav = document.createElement("div");
    nav.className = "table-pagination";
    nav.setAttribute("role", "navigation");
    nav.setAttribute("aria-label", "Table pagination");
  }

  nav.style.visibility = "visible";
  root.style.visibility = "visible";
  if (pagerHost !== root) {
    pagerHost.style.visibility = "visible";
  }

  if (root.parentNode && root.nextElementSibling !== nav) {
    root.insertAdjacentElement("afterend", nav);
  } else if (!nav.parentNode) {
    pagerHost.appendChild(nav);
  }

  function getRows() {
    return Array.from(root.querySelectorAll(rowSelector));
  }

  function getEligibleRows() {
    return getRows().filter((row) => isRowEligible(row));
  }

  function renderPager(totalPages) {
    nav.replaceChildren();

    if (totalPages <= 1) {
      nav.hidden = true;
      return;
    }

    nav.hidden = false;

    const prevButton = createPaginationButton("Prev", { disabled: currentPage <= 1 });
    prevButton.addEventListener("click", () => {
      if (currentPage > 1) {
        setPage(currentPage - 1, true);
      }
    });
    nav.appendChild(prevButton);

    getPaginationItems(currentPage, totalPages).forEach((item) => {
      if (item === "ellipsis") {
        const ellipsis = document.createElement("span");
        ellipsis.className = "table-pagination-ellipsis";
        ellipsis.textContent = "…";
        nav.appendChild(ellipsis);
        return;
      }

      const pageButton = createPaginationButton(String(item), { current: item === currentPage });
      pageButton.addEventListener("click", () => setPage(item, true));
      nav.appendChild(pageButton);
    });

    const nextButton = createPaginationButton("Next", { disabled: currentPage >= totalPages });
    nextButton.addEventListener("click", () => {
      if (currentPage < totalPages) {
        setPage(currentPage + 1, true);
      }
    });
    nav.appendChild(nextButton);
  }

  function render() {
    const rows = getRows();
    const eligibleRows = getEligibleRows();
    const totalPages = Math.max(1, Math.ceil(eligibleRows.length / pageSize) || 1);

    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    rows.forEach((row) => {
      row.style.display = "none";
    });

    eligibleRows.forEach((row, index) => {
      const pageIndex = Math.floor(index / pageSize) + 1;
      row.style.display = pageIndex === currentPage ? "" : "none";
    });

    renderPager(eligibleRows.length ? totalPages : 1);
  }

  function setPage(page, fromUser = false) {
    currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    render();
    if (fromUser && typeof options.onPageChange === "function") {
      options.onPageChange(currentPage);
    }
  }

  const controller = {
    refresh({ resetPage = false } = {}) {
      if (resetPage) {
        currentPage = 1;
      }
      render();
    },
    setPage,
    getPage: () => currentPage,
  };

  root._tablePagination = controller;
  render();
  return controller;
}

export function addTablePagination(containerSelector = ".table-container", options = {}) {
  document.querySelectorAll(containerSelector).forEach((container) => {
    if (shouldSkipTablePagination(container)) {
      return;
    }

    const table = container.querySelector("table");
    if (!table || table._tablePagination || !table.querySelector("tbody tr")) {
      return;
    }

    paginateTable(table, {
      ...options,
      pagerHost: options.pagerHost || container,
    });
  });
}

export function paginateMatchList(options = {}) {
  const table = document.getElementById("match-list");
  if (!table || table._tablePagination) {
    return table?._tablePagination || null;
  }

  const pageSize = options.pageSize || DEFAULT_TABLE_PAGE_SIZE;
  const isRowEligible = (row) => {
    const round = table.dataset.roundFilter || "";
    return !round || row.dataset.round === round;
  };
  const eligibleRows = Array.from(table.querySelectorAll("tbody tr")).filter(isRowEligible);
  const initialPage = options.startOnCurrentMatch
    ? getPageForCurrentMatch(eligibleRows, pageSize)
    : (options.initialPage || 1);

  return paginateTable(table, {
    pageSize,
    initialPage,
    pagerHost: table.closest(".table-container") || table.parentElement,
    isRowEligible,
  });
}

const LIVE_MATCH_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const FINISHED_MATCH_STATUSES = new Set(["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD"]);

function getPageForCurrentMatch(rows, pageSize) {
  if (!rows.length || pageSize < 1) {
    return 1;
  }

  const currentIndex = findCurrentMatchRowIndex(rows);
  return Math.floor(currentIndex / pageSize) + 1;
}

function findCurrentMatchRowIndex(rows) {
  const now = Date.now();
  const liveIndex = rows.findIndex((row) => LIVE_MATCH_STATUSES.has(row.dataset.status));
  if (liveIndex >= 0) {
    return liveIndex;
  }

  let nextUpcomingIndex = -1;
  let nextUpcomingTime = Infinity;
  let lastFinishedIndex = -1;
  let lastFinishedTime = Number.NEGATIVE_INFINITY;

  rows.forEach((row, index) => {
    const time = Date.parse(row.dataset.date);
    const status = row.dataset.status || "";
    if (!Number.isFinite(time)) {
      return;
    }

    const isFinished = FINISHED_MATCH_STATUSES.has(status) || time < now;
    if (!isFinished && time >= now) {
      if (time < nextUpcomingTime) {
        nextUpcomingTime = time;
        nextUpcomingIndex = index;
      }
      return;
    }

    if (time >= lastFinishedTime) {
      lastFinishedTime = time;
      lastFinishedIndex = index;
    }
  });

  if (nextUpcomingIndex >= 0) {
    return nextUpcomingIndex;
  }

  if (lastFinishedIndex >= 0) {
    return lastFinishedIndex;
  }

  return rows.length - 1;
}

export function revealPageRectangle() {
  const rectangle = document.querySelector(
    ".players-page-layout .rectangle, .teams-page-layout .rectangle",
  );
  if (!rectangle) {
    return;
  }

  requestAnimationFrame(() => {
    rectangle.classList.add("is-ready");
  });
}

export function setupLeagueListToggleButtons() {
  document.querySelectorAll('.rect-expand-league-list a').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      const header = e.currentTarget.closest('.rect-header');
      const leagueList = header?.querySelector('.rect-league-list');
      if (!leagueList) return;

      const isVisible = leagueList.classList.contains('visible');

      if (isVisible) {
        leagueList.classList.remove('visible');
        leagueList.style.display = 'none';
      } else {
        leagueList.style.display = 'grid';
        leagueList.classList.add('visible');
      }

      e.currentTarget.closest('.rect-expand-league-list')?.classList.toggle('active');
    });
  });
}

export async function showMatchesOnDate(date, showID) {
  let downloads = 0;
  let allLeaguematches = await fetch(`/api/get-matches-on-day?matchDate=${date}`);
  let matches = await allLeaguematches.json();

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

  document.dispatchEvent(
    new CustomEvent("gf:table-sorted", {
      detail: { tableId: table.id, header: td },
    }),
  );

  // 5. Apply colors to the new positions
  //recolorRows(table, startingRow);
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

export function hideColumn(stat, tableID = "player-list-table") {
  document
    .querySelectorAll(
      `#${tableID} th[data-stat="${stat}"], 
        #${tableID} td[data-stat="${stat}"]`
    )
    .forEach((cell) => {
      cell.style.display = "none";
    });
}

export function showColumn(stat, tableID = "player-list-table") {
  document
    .querySelectorAll(
      `#${tableID} th[data-stat="${stat}"], 
        #${tableID} td[data-stat="${stat}"]`
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
  if (!headerRow) {
    return;
  }

  headerRow.colSpan = newSpan + 1;
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

export function addLeagues(lp, admin = false) {
  // Get league from query param or use default
  const urlParams = getPageQueryParams();
  const leagueParam = urlParams.get(lp || "pleague");
  const parseUniqueLeagueIds = (value) => {
    if (!value) return [];
    return [...new Set(
      decodeURIComponent(value)
        .split(",")
        .map((id) => Number(id.trim()))
        .filter(Boolean)
    )];
  };

  const leagueIDs = parseUniqueLeagueIds(leagueParam);
  const preselectedLeagueIds = Array.from(
    document.querySelectorAll(`.${lp}-league-to-select.selected-league`)
  )
    .map((element) => Number(element.id.replace("img-", "")))
    .filter(Boolean);
  let pickedLeagues = [];

  // Initialize pickedLeagues based on query param or default
  if (leagueParam) {
    pickedLeagues.push(...leagueIDs);
  } else if (preselectedLeagueIds.length > 0) {
    pickedLeagues.push(...new Set(preselectedLeagueIds));
  } else if (!admin && typeof defaultLeagues !== "undefined") {
    pickedLeagues.push(
      ...new Set(Array.isArray(defaultLeagues) ? defaultLeagues : [defaultLeagues])
    );
  }

  document.querySelectorAll(`.${lp}-league-to-select`).forEach((element) => {
    const leagueID = Number(element.id.replace("img-", ""));
    element.classList.toggle("selected-league", pickedLeagues.includes(leagueID));
  });

  if (lp === "sleague") {
    document.querySelectorAll(`.${lp}-league-to-select`).forEach((e) =>
      e.addEventListener("click", (evt) => selectOneLeague(evt, lp))
    );
  } else {
    document.querySelectorAll(`.${lp}-league-to-select`).forEach((e) =>
      e.addEventListener("click", (evt) => selectLeague(evt, lp))
    );
  }
  
  function selectOneLeague(evt, param = "pleague") {
    // Remove selected class from all siblings
    document.querySelectorAll(`.${lp}-league-to-select`).forEach((el) =>
      el.classList.remove("selected-league")
    );

    // Set only the clicked league as selected
    evt.currentTarget.classList.add("selected-league");
    let dasID = parseInt(evt.currentTarget.id.replace("img-", ""));
    pickedLeagues.length = 0;
    if (!isNaN(dasID)) pickedLeagues.push(dasID);

    // Update URL and fetch new data (skip if admin mode)
    if (!admin) {
      navigateWithUpdatedQuery((nextUrlParams) => {
        nextUrlParams.set(param, pickedLeagues.join(","));
      });
    }
  }

  function selectLeague(evt, param = "pleague") {
    evt.currentTarget.classList.toggle("selected-league");
    let dasID = parseInt(evt.currentTarget.id.replace("img-", ""));
    if (!pickedLeagues.includes(dasID)) {
      pickedLeagues.push(dasID);
    } else {
      pickedLeagues.splice(pickedLeagues.indexOf(dasID), 1);
    }
    pickedLeagues = [...new Set(pickedLeagues)];

    if (admin) {
      if (!selectedLeagues.includes(dasID)) {
        selectedLeagues.push(dasID);
      } else {
        selectedLeagues.splice(selectedLeagues.indexOf(dasID), 1);
      }
    }

    // Update URL and fetch new data (skip if admin mode)
    if (!admin) {
      navigateWithUpdatedQuery((nextUrlParams) => {
        nextUrlParams.set(param, pickedLeagues.join(","));
      });
    }
  }
}
