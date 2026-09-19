import {
  sortTable,
  adjustColspan,
  showColumn,
  hideColumn,
  parseColumnIndex,
  normalizeSortDirection,
  getNextSortDirection,
  getPageQueryParams,
  navigateWithUpdatedQuery,
  encodeCompactStatFilters,
  decodeCompactStatFilters,
  revealPageRectangle,
} from "../common-functions.js";
import {
  applyTableStatFilter,
  registerStatFilterPopover,
} from "./stat-filter.js";

const tableName = "team-list-table";
const teamStatFilterButtons = document.querySelectorAll(".team-stat-filter-btn");
const teamStatFiltersStorageKey = "teams.activeStatFilters";
const teamQueryKeys = {
  sortStat: "tsort",
  sortDirection: "tdir",
  sortColumn: "tcol",
  filters: "tfilters",
  filterStat: "tfilterStat",
  filterOperator: "tfilterOperator",
  filterMin: "tfilterMin",
  filterMax: "tfilterMax",
  filterColumn: "tfilterColumn",
};
const defaultTeamsSortStat = "goals";
const defaultTeamsSortDirection = "desc";
const hasTeamStatFilters = teamStatFilterButtons.length > 0;
const defaultVisibleTeamStats = [
  "form",
  "played",
  "elo",
  "winPercentage",
  "goals",
  "xG",
  "corners",
  "shotsOnGoal",
  "fouls",
  "possession",
];

function encodeTeamsFilters(filters) {
  return encodeCompactStatFilters(filters, true);
}

function normalizeTeamsFilter(filter) {
  if (!filter || !filter.stat || !filter.operator) {
    return null;
  }

  const min = String(filter.min || "");
  const max = String(filter.max || "");
  const columnIndex = parseColumnIndex(filter.columnIndex);

  return {
    stat: String(filter.stat),
    operator: String(filter.operator),
    min,
    max,
    value: filter.operator === "lte"
      ? (max || min)
      : String(filter.value || min),
    columnIndex: Number.isFinite(columnIndex) ? columnIndex : null,
  };
}

function decodeTeamsFilters(serializedFilters) {
  return decodeCompactStatFilters(serializedFilters, normalizeTeamsFilter, true);
}

function parseTeamsFiltersFromUrl(urlParams) {
  const serializedFilters = urlParams.get(teamQueryKeys.filters);
  if (serializedFilters) {
    const decoded = decodeTeamsFilters(serializedFilters);
    if (decoded.length) {
      return decoded;
    }

    try {
      const parsed = JSON.parse(serializedFilters);
      const normalized = (Array.isArray(parsed) ? parsed : [parsed])
        .map((filter) => normalizeTeamsFilter(filter))
        .filter(Boolean);

      if (normalized.length) {
        return normalized;
      }
    } catch (error) {
      // fall through to legacy query fields
    }
  }

  const legacyFilter = normalizeTeamsFilter({
    stat: urlParams.get(teamQueryKeys.filterStat),
    operator: urlParams.get(teamQueryKeys.filterOperator),
    min: urlParams.get(teamQueryKeys.filterMin),
    max: urlParams.get(teamQueryKeys.filterMax),
    columnIndex: urlParams.get(teamQueryKeys.filterColumn),
  });

  return legacyFilter ? [legacyFilter] : [];
}

function getTeamsServerStateFromUrl() {
  const urlParams = getPageQueryParams();
  const sortStat = urlParams.get(teamQueryKeys.sortStat);
  const sortDirection = normalizeSortDirection(urlParams.get(teamQueryKeys.sortDirection));
  const sortColumnIndex = parseColumnIndex(urlParams.get(teamQueryKeys.sortColumn));

  return {
    sortStat: sortStat || null,
    sortDirection,
    sortColumnIndex,
    statFilters: parseTeamsFiltersFromUrl(urlParams),
  };
}

function setTeamsSortParams(urlParams, sortStat, sortDirection, sortColumnIndex) {
  if (!sortStat) {
    urlParams.delete(teamQueryKeys.sortStat);
    urlParams.delete(teamQueryKeys.sortDirection);
    urlParams.delete(teamQueryKeys.sortColumn);
    return;
  }

  urlParams.set(teamQueryKeys.sortStat, String(sortStat));

  if (sortDirection === "asc") {
    urlParams.set(teamQueryKeys.sortDirection, "asc");
  } else {
    urlParams.delete(teamQueryKeys.sortDirection);
  }

  if (Number.isFinite(sortColumnIndex)) {
    urlParams.set(teamQueryKeys.sortColumn, String(sortColumnIndex));
  } else {
    urlParams.delete(teamQueryKeys.sortColumn);
  }
}

function setTeamsFilterParams(urlParams, filters) {
  const normalizedFilters = (Array.isArray(filters) ? filters : [])
    .map((filter) => normalizeTeamsFilter(filter))
    .filter(Boolean);

  if (normalizedFilters.length) {
    urlParams.set(teamQueryKeys.filters, encodeTeamsFilters(normalizedFilters));
  } else {
    urlParams.delete(teamQueryKeys.filters);
  }

  urlParams.delete(teamQueryKeys.filterStat);
  urlParams.delete(teamQueryKeys.filterOperator);
  urlParams.delete(teamQueryKeys.filterMin);
  urlParams.delete(teamQueryKeys.filterMax);
  urlParams.delete(teamQueryKeys.filterColumn);
}

function setTeamsSortState(sortStat, sortDirection, sortColumnIndex) {
  document.querySelectorAll(`#${tableName} th.sortable`).forEach((header) => {
    header.classList.remove("asc", "desc");
    const headerColumnIndex = parseColumnIndex(header.dataset.columnIndex);
    const isActive =
      header.dataset.stat === sortStat &&
      headerColumnIndex !== null &&
      headerColumnIndex === sortColumnIndex;

    if (isActive) {
      header.classList.add(sortDirection);
      header.setAttribute("data-default-order", sortDirection);
    }
  });
}

function getTableElements() {
  const table = document.getElementById(tableName);
  const tableBody = table?.querySelector("tbody") || null;

  return { table, tableBody };
}

function getSubHeaderColumnOffset(table) {
  const firstHeaderRow = table?.querySelector("thead tr:first-child");
  if (!firstHeaderRow) {
    return 0;
  }

  return Array.from(firstHeaderRow.cells).reduce((sum, cell) => {
    const rowSpan = Number(cell.rowSpan) || 1;
    if (rowSpan < 2) {
      return sum;
    }

    return sum + (Number(cell.colSpan) || 1);
  }, 0);
}

function getHeaderColumnIndex(header, table) {
  const firstHeaderRow = table?.querySelector("thead tr:first-child");
  const headerRow = header?.parentElement;

  if (headerRow && headerRow === firstHeaderRow) {
    let columnIndex = 0;
    for (const cell of headerRow.cells) {
      if (cell === header) {
        return columnIndex;
      }
      columnIndex += Number(cell.colSpan) || 1;
    }
    return columnIndex;
  }

  const headerCells = Array.from(headerRow?.children || []);
  return getSubHeaderColumnOffset(table) + headerCells.indexOf(header);
}

function toggleColumnByStat(stat, isVisible) {
  if (!stat) {
    return;
  }

  if (isVisible) {
    showColumn(stat, tableName);
  } else {
    hideColumn(stat, tableName);
  }
}

function saveActiveTeamStats() {
  if (!hasTeamStatFilters) {
    return;
  }

  try {
    const activeStats = Array.from(teamStatFilterButtons)
      .filter((button) => button.classList.contains("active"))
      .map((button) => button.dataset.stat)
      .filter(Boolean);

    window.localStorage.setItem(
      teamStatFiltersStorageKey,
      JSON.stringify(activeStats),
    );
  } catch (error) {
    console.error("Unable to save team stat filters", error);
  }
}

function restoreActiveTeamStats() {
  if (!hasTeamStatFilters) {
    return;
  }

  try {
    const savedValue = window.localStorage.getItem(teamStatFiltersStorageKey);
    const savedStats = savedValue ? JSON.parse(savedValue) : null;
    const activeStats =
      Array.isArray(savedStats) && savedStats.length
        ? new Set(savedStats)
        : new Set(defaultVisibleTeamStats);

    teamStatFilterButtons.forEach((button) => {
      button.classList.toggle("active", activeStats.has(button.dataset.stat));
    });

    saveActiveTeamStats();
  } catch (error) {
    console.error("Unable to restore team stat filters", error);
  }
}

export function teamList(
  response,
  onlyTotal = true,
  addMatches = false,
  big = false,
) {
  void addMatches;
  createTeamsTable(response, onlyTotal, big);
}

export function createTeamsTable(response, onlyTotal, big) {
  void response;
  void onlyTotal;

  const { table, tableBody } = getTableElements();
  const enableTeamStatFilters = big && hasTeamStatFilters;
  const serverSideTeamsTable = big;
  const serverState = serverSideTeamsTable ? getTeamsServerStateFromUrl() : null;

  if (!table || !tableBody) {
    console.error(
      "Table or table body not found! Ensure #team-list-table has a <tbody> element.",
    );
    return;
  }

  const firstHeaderCell = table.rows?.[0]?.cells?.[0] || null;
  adjustColspan(firstHeaderCell, 1);

  if (enableTeamStatFilters) {
    const statsFilterSide = document.getElementById("team-stats-filter-side");
    if (statsFilterSide) {
      statsFilterSide.style.display = "none";
    }

    restoreActiveTeamStats();

    teamStatFilterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        button.classList.toggle("active");
        saveActiveTeamStats();
        updateTableVisibility(enableTeamStatFilters);
      });
    });
  }

  if (enableTeamStatFilters) {
    registerStatFilterPopover({
      tableId: tableName,
      headerSelector: "thead th.sortable[data-stat]",
      rowSelector: "tbody tr",
      storageKey: "teams.stat-filter",
      serverSide: serverSideTeamsTable,
      initialFilters: serverState?.statFilters || [],
      getLabel: (header, tableElement) => {
        const parentHeader = tableElement.querySelector(
          `thead tr:first-child th[data-stat="${header.dataset.stat}"]`,
        );
        const parentLabel = parentHeader ? parentHeader.innerText.trim() : header.dataset.stat;
        const subLabel = header.innerText.trim();

        return parentLabel && subLabel && parentLabel !== subLabel
          ? `${parentLabel} - ${subLabel}`
          : parentLabel || subLabel || header.dataset.stat;
      },
      onFilterChange: (filters) => {
        if (serverSideTeamsTable) {
          navigateWithUpdatedQuery((urlParams) => {
            setTeamsFilterParams(urlParams, filters);
          });
          return;
        }

        updateTableVisibility(enableTeamStatFilters);
      },
      getColumnIndex: (header, tableElement) => getHeaderColumnIndex(header, tableElement),
    });
  }

  // Fallback for legacy checkbox markup if present
  const checkboxes = document.querySelectorAll("input[name='statSelector']");
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => updateTableVisibility(enableTeamStatFilters));
  });

  // Initial visibility update
  updateTableVisibility(enableTeamStatFilters);

  // Add sorting functionality to subheader cells on the full Teams page only
  if (big) {
    let subHeaderLength = table.rows[1].cells.length;
    const subHeaderOffset = getSubHeaderColumnOffset(table);

    const bindServerSort = (header, columnIndex) => {
      header.dataset.columnIndex = String(columnIndex);
      header.addEventListener("click", function () {
        if (serverSideTeamsTable) {
          const currentSortStat = serverState?.sortStat || null;
          const currentDirection = normalizeSortDirection(serverState?.sortDirection);
          const currentColumnIndex = serverState?.sortColumnIndex;
          const sameSortTarget =
            currentSortStat === this.dataset.stat &&
            Number(currentColumnIndex) === columnIndex;
          const nextDirection = getNextSortDirection(sameSortTarget, currentDirection);

          navigateWithUpdatedQuery((urlParams) => {
            setTeamsSortParams(urlParams, String(this.dataset.stat || defaultTeamsSortStat), nextDirection, columnIndex);
          });
          return;
        }

        const currentOrder = this.getAttribute("data-default-order") || "desc";
        const newOrder = currentOrder === "asc" ? "desc" : "asc";

        this.setAttribute("data-default-order", newOrder);
        document
          .querySelectorAll(`#${tableName} th.sortable`)
          .forEach((item) => item.classList.remove("asc", "desc"));
        this.classList.add(newOrder);

        sortTable(columnIndex, header, table, 2);
        table._tablePagination?.refresh({ resetPage: true });
      });
    };

    let firstRowColumnIndex = 0;
    Array.from(table.rows[0].cells).forEach((cell) => {
      const span = Number(cell.colSpan) || 1;
      if (cell.classList.contains("sortable") && cell.dataset.stat) {
        bindServerSort(cell, firstRowColumnIndex);
      }
      firstRowColumnIndex += span;
    });

    for (let i = subHeaderLength - 1; i >= 0; i--) {
      let subheaderCell = table.rows[1].cells[i];
      const columnIndex = subHeaderOffset + i;
      bindServerSort(subheaderCell, columnIndex);
    }

    if (serverSideTeamsTable && serverState?.sortStat && Number.isFinite(serverState?.sortColumnIndex)) {
      setTeamsSortState(serverState.sortStat, serverState.sortDirection, serverState.sortColumnIndex);
    }
  }

  table.style.visibility = "visible";
  if (table.parentElement) {
    table.parentElement.style.visibility = "visible";
  }
  revealPageRectangle();
}

function updateTableVisibility(applySavedStatFilters = false) {
  document.querySelectorAll(`#${tableName} th`).forEach((el) => {
    if (el.dataset.stat) {
      const button = document.querySelector(
        `.team-stat-filter-btn[data-stat="${el.dataset.stat}"]`,
      );
      if (button) {
        toggleColumnByStat(el.dataset.stat, button.classList.contains("active"));
        return;
      }

      const checkbox = document.getElementById(el.dataset.stat);
      if (checkbox && !checkbox.checked) {
        toggleColumnByStat(el.dataset.stat, false);
      } else if (checkbox && checkbox.checked) {
        toggleColumnByStat(el.dataset.stat, true);
      }
    }
  });

  if (applySavedStatFilters) {
    applyTableStatFilter(tableName);
  }

  getTableElements().table?._tablePagination?.refresh({ resetPage: true });
}
