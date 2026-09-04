import { buildTableForTableType, imgs, ctx } from "../instapics.js";
import {
  removeNewlines,
  adjustColspan,
  sortTable,
  normalizeSortDirection,
  getNextSortDirection,
  getPageQueryParams,
  navigateWithUpdatedQuery,
  encodeCompactStatFilters,
  decodeCompactStatFilters,
  paginateTable,
  DEFAULT_TABLE_PAGE_SIZE,
  TOP_PLAYERS_PAGE_SIZE,
  revealPageRectangle,
} from "../common-functions.js";
import {
  applyTableStatFilter,
  registerStatFilterPopover,
} from "./stat-filter.js";

const tableName = "player-list-table";
const table = document.getElementById(tableName);
const statFilterButtons = document.querySelectorAll(".stat-filter-btn");
const playerStatFiltersStorageKey = "players.activeStatFilters";
const playersQueryKeys = {
  sortStat: "psort",
  sortDirection: "pdir",
  filters: "pfilters",
  filterStat: "pfilterStat",
  filterOperator: "pfilterOperator",
  filterMin: "pfilterMin",
  filterMax: "pfilterMax",
  page: "ppage",
};
const defaultPlayersSortStat = "goals";
const defaultPlayersSortDirection = "desc";

function encodePlayersFilters(filters) {
  return encodeCompactStatFilters(filters, false);
}

function decodePlayersFilters(serializedFilters) {
  return decodeCompactStatFilters(serializedFilters, normalizePlayersFilter, false);
}

function normalizePlayersFilter(filter) {
  if (!filter || !filter.stat || !filter.operator) {
    return null;
  }

  const min = String(filter.min || "");
  const max = String(filter.max || "");

  return {
    stat: String(filter.stat),
    operator: String(filter.operator),
    min,
    max,
    value: filter.operator === "lte"
      ? (max || min)
      : (String(filter.value || min)),
  };
}

function parsePlayersFiltersFromUrl(urlParams) {
  const serializedFilters = urlParams.get(playersQueryKeys.filters);
  if (serializedFilters) {
    const decoded = decodePlayersFilters(serializedFilters);
    if (decoded.length) {
      return decoded;
    }

    try {
      const parsed = JSON.parse(serializedFilters);
      const normalized = (Array.isArray(parsed) ? parsed : [parsed])
        .map((filter) => normalizePlayersFilter(filter))
        .filter(Boolean);

      if (normalized.length) {
        return normalized;
      }
    } catch (error) {
      // fall through to legacy query fields
    }
  }

  const legacyFilter = normalizePlayersFilter({
    stat: urlParams.get(playersQueryKeys.filterStat),
    operator: urlParams.get(playersQueryKeys.filterOperator),
    min: urlParams.get(playersQueryKeys.filterMin) || "",
    max: urlParams.get(playersQueryKeys.filterMax) || "",
  });

  return legacyFilter ? [legacyFilter] : [];
}

function getPlayersServerStateFromUrl() {
  const urlParams = getPageQueryParams();
  const statFilters = parsePlayersFiltersFromUrl(urlParams);
  const sortStat = urlParams.get(playersQueryKeys.sortStat) || defaultPlayersSortStat;
  const sortDirection = normalizeSortDirection(
    urlParams.get(playersQueryKeys.sortDirection),
    defaultPlayersSortDirection,
  );

  const parsedPage = Number.parseInt(urlParams.get(playersQueryKeys.page), 10);

  return {
    sortStat,
    sortDirection,
    statFilters,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function persistPlayersPage(page) {
  const urlParams = getPageQueryParams();
  if (page <= 1) {
    urlParams.delete(playersQueryKeys.page);
  } else {
    urlParams.set(playersQueryKeys.page, String(page));
  }

  const nextQuery = urlParams.toString();
  const nextUrl = nextQuery
    ? `${window.location.pathname}?${nextQuery}`
    : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

function setPlayersSortState(sortStat, sortDirection) {
  document.querySelectorAll(`#${tableName} th.sortable`).forEach((header) => {
    header.classList.remove("asc", "desc");
    if (header.dataset.stat === sortStat) {
      header.classList.add(sortDirection);
      header.setAttribute("data-default-order", sortDirection);
    }
  });
}

function setPlayersSortParams(urlParams, sortStat, sortDirection) {
  const normalizedSortStat = sortStat || defaultPlayersSortStat;
  const normalizedDirection = normalizeSortDirection(
    sortDirection,
    defaultPlayersSortDirection,
  );

  if (normalizedSortStat === defaultPlayersSortStat) {
    urlParams.delete(playersQueryKeys.sortStat);
  } else {
    urlParams.set(playersQueryKeys.sortStat, normalizedSortStat);
  }

  if (normalizedDirection === defaultPlayersSortDirection) {
    urlParams.delete(playersQueryKeys.sortDirection);
  } else {
    urlParams.set(playersQueryKeys.sortDirection, normalizedDirection);
  }
}

function setPlayersFilterParams(urlParams, filters) {
  const normalizedFilters = (Array.isArray(filters) ? filters : [])
    .map((filter) => normalizePlayersFilter(filter))
    .filter(Boolean);

  if (normalizedFilters.length) {
    urlParams.set(playersQueryKeys.filters, encodePlayersFilters(normalizedFilters));
  } else {
    urlParams.delete(playersQueryKeys.filters);
  }

  urlParams.delete(playersQueryKeys.filterStat);
  urlParams.delete(playersQueryKeys.filterOperator);
  urlParams.delete(playersQueryKeys.filterMin);
  urlParams.delete(playersQueryKeys.filterMax);
}

function saveActiveStats(hasPlayerStatFilters) {
  if (!hasPlayerStatFilters) {
    return;
  }

  try {
    const activeStats = Array.from(statFilterButtons)
      .filter((button) => button.classList.contains("active"))
      .map((button) => button.dataset.stat)
      .filter(Boolean);

    window.localStorage.setItem(
      playerStatFiltersStorageKey,
      JSON.stringify(activeStats),
    );
  } catch (error) {
    console.error("Unable to save player stat filters", error);
  }
}

function restoreActiveStats(hasPlayerStatFilters) {
  if (!hasPlayerStatFilters) {
    return;
  }

  try {
    const savedValue = window.localStorage.getItem(playerStatFiltersStorageKey);
    const savedStats = savedValue ? JSON.parse(savedValue) : null;

    if (!Array.isArray(savedStats) || !savedStats.length) {
      saveActiveStats(hasPlayerStatFilters);
      return;
    }

    const activeStats = new Set(savedStats);
    statFilterButtons.forEach((button) => {
      button.classList.toggle("active", activeStats.has(button.dataset.stat));
    });
  } catch (error) {
    console.error("Unable to restore player stat filters", error);
  }
}

export function playerGoalList({ big = false, enableStatFilters = false, pageSize } = {}) {
  const hasPlayerStatFilters = enableStatFilters && statFilterButtons.length > 0;
  const tableBody = table.getElementsByTagName("tbody")[0];
  const serverSidePlayersTable = big;
  const serverState = serverSidePlayersTable ? getPlayersServerStateFromUrl() : null;

  adjustColspan(table.rows[0].cells[0], 2);

  if (!tableBody) {
    console.error(
      "Table body not found! Ensure the table has a <tbody> element.",
    );
    return;
  }

  const statsFilterSide = document.getElementById("stats-filter-side");
  if (hasPlayerStatFilters && statsFilterSide) {
    statsFilterSide.style.display = "none";
    restoreActiveStats(hasPlayerStatFilters);
  }

  if (big) {
    registerStatFilterPopover({
      tableId: tableName,
      headerSelector: "thead th.sortable[data-stat]",
      rowSelector: "tbody tr",
      storageKey: "players.stat-filter",
      serverSide: true,
      initialFilters: serverState?.statFilters || [],
      onFilterChange: (filters) => {
        navigateWithUpdatedQuery((urlParams) => {
          setPlayersFilterParams(urlParams, filters);
        });
      },
      getColumnIndex: (header, tableElement) => {
        const headerCells = Array.from(header.parentElement.children);
        const headerIndex = headerCells.indexOf(header);
        return headerCells
          .slice(0, headerIndex)
          .reduce((sum, th) => sum + (Number(th.colSpan) || 1), 0);
      },
    });
  }

  const listedPlayers = Array.isArray(window.displayedPlayers)
    ? window.displayedPlayers
    : [];
  listedPlayers.forEach((player) => {
    //loadPlayerFace(player.id);
    //loadClubLogo(player.club);
    //loadClubLogo(player.nation);
  });

  document.querySelectorAll(`#${tableName} th.sortable`).forEach((header) => {
    header.addEventListener("click", function () {
      if (serverSidePlayersTable) {
        const currentSortStat = serverState?.sortStat || "goals";
        const currentDirection = normalizeSortDirection(serverState?.sortDirection, defaultPlayersSortDirection);
        const nextDirection = getNextSortDirection(
          currentSortStat === this.dataset.stat,
          currentDirection,
        );

        navigateWithUpdatedQuery((urlParams) => {
          setPlayersSortParams(urlParams, String(this.dataset.stat || "goals"), nextDirection);
        });
        return;
      }

      const currentOrder = this.getAttribute("data-default-order") || "desc";
      const newOrder = currentOrder === "asc" ? "desc" : "asc";

      this.setAttribute("data-default-order", newOrder);
      document
        .querySelectorAll(`#${tableName} th.sortable`)
        .forEach((h) => h.classList.remove("asc", "desc"));
      this.classList.add(newOrder);

      // Convert header index to actual table cell index accounting for colspan
      const headerCells = Array.from(this.parentElement.children);
      const headerIndex = headerCells.indexOf(this);
      const columnIndex = headerCells
        .slice(0, headerIndex)
        .reduce((sum, th) => sum + (Number(th.colSpan) || 1), 0);

      sortTable(columnIndex, this, table, 1);

      updateTableVisibility(hasPlayerStatFilters, false);
    });
  });

  if (hasPlayerStatFilters) {
    statFilterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("active");
        saveActiveStats(hasPlayerStatFilters);
        updateTableVisibility(hasPlayerStatFilters);
      });
    });
  }

  const resolvedPageSize = Number(pageSize) > 0
    ? Number(pageSize)
    : (serverSidePlayersTable ? TOP_PLAYERS_PAGE_SIZE : DEFAULT_TABLE_PAGE_SIZE);

  paginateTable(table, {
    pageSize: resolvedPageSize,
    initialPage: serverSidePlayersTable ? serverState.page : 1,
    pagerHost: table.parentNode,
    isRowEligible: (row) => row.dataset.statFilterHidden !== "true",
    onPageChange: serverSidePlayersTable ? persistPlayersPage : null,
  });

  updateTableVisibility(hasPlayerStatFilters, serverSidePlayersTable);
  if (serverSidePlayersTable) {
    setPlayersSortState(serverState?.sortStat || "goals", serverState?.sortDirection || "desc");
  }

  table.style.visibility = "visible";
  if (table.parentElement) {
    table.parentElement.style.visibility = "visible";
  }
  revealPageRectangle();
}

export function playerListToCanvas() {
  let imgToAdd = [];
  let playerFace, thisTr;
  let playerListTable = document.getElementById("player-list-table");
  let normalWidth = `70px`;

  playerListTable.cellPadding = 10;

  playerListTable.rows[0].style.backgroundColor = "#1D3557";
  playerListTable.rows[0].style.color = "#F1FAEE";
  playerListTable.rows[0].style.fontWeight = "bold";

  playerListTable.rows[0].deleteCell(6);
  playerListTable.rows[0].deleteCell(6);

  playerListTable.rows[0].cells[2].innerHTML = "Apps";
  playerListTable.rows[0].cells[3].innerHTML = "Goal";
  playerListTable.rows[0].cells[5].innerHTML = "As.";
  playerListTable.rows[0].cells[6].innerHTML = "Rate";

  for (let i = 0; i < playerListTable.rows[0].cells.length; i++) {
    playerListTable.rows[0].cells[i].style.borderRightColor = "#F1FAEE";
  }

  for (let i = 1; i < playerListTable.rows.length; i++) {
    thisTr = playerListTable.rows[i];
    playerFace = imgs.players[thisTr.children[0].id];

    imgToAdd.push({
      img: playerFace,
      imgHeight: 80,
      startX: 133,
      startY: 82 + i * 80,
    });

    let clubLogo = thisTr.children[1].id;

    imgToAdd.push({
      img: imgs.clubs[clubLogo],
      imgHeight: 46,
      startX: 183,
      startY: 97 + i * 80,
    });
    clubLogo = thisTr.children[3].id;

    imgToAdd.push({
      img: imgs.clubs[clubLogo],
      imgHeight: 72,
      startX: 514,
      startY: 88 + i * 80,
    });

    thisTr.style.height = "80px";
    thisTr.children[0].innerHTML = "";
    thisTr.children[0].style.width = "60px";
    thisTr.children[0].style.borderRightStyle = "hidden";
    thisTr.children[1].style.width = "46px";
    thisTr.children[2].style.width = "260px";
    thisTr.children[1].innerHTML = "";
    thisTr.children[3].innerHTML = "";
    thisTr.children[3].style.width = "50px";
    thisTr.children[4].style.width = normalWidth;
    thisTr.children[5].style.width = normalWidth;
    thisTr.children[6].style.width = normalWidth;
    thisTr.children[7].style.width = normalWidth;

    thisTr.deleteCell(8);
    thisTr.deleteCell(8);
    thisTr.deleteCell(-1);

    thisTr.children[5].style.fontWeight = "bold";

    //center cells from 3 to the last
    for (let j = 3; j < thisTr.children.length; j++) {
      thisTr.children[j].style.textAlign = "center";
    }
  }

  buildTableForTableType(
    removeNewlines(playerListTable.outerHTML),
    imgToAdd,
    110,
  );
  ctx.fillStyle = "#e63946";
}

document.addEventListener("DOMContentLoaded", function () {});

function updateTableVisibility(hasPlayerStatFilters, serverSidePlayersTable = false) {
  if (hasPlayerStatFilters) {
    const activeStats = new Set(
      Array.from(document.querySelectorAll(".stat-filter-btn.active")).map(
        (button) => button.dataset.stat,
      ),
    );

    document.querySelectorAll(`#${tableName} th[data-stat]`).forEach((el) => {
      const isVisible = activeStats.has(el.dataset.stat);
      document
        .querySelectorAll(
          `#${tableName} th[data-stat="${el.dataset.stat}"], #${tableName} td[data-stat="${el.dataset.stat}"]`,
        )
        .forEach((cell) => {
          cell.style.display = isVisible ? "" : "none";
        });
    });
  }

  if (!serverSidePlayersTable) {
    applyTableStatFilter(tableName);
  }

  table?._tablePagination?.refresh({ resetPage: !serverSidePlayersTable });
}
