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
import { comparePositionsByDisplayOrder } from "../classes/player-positions.js";

const tableName = "player-list-table";
const table = document.getElementById(tableName);
const statFilterButtons = document.querySelectorAll(".stat-filter-btn");
const playerStorageKeys = {
  activeStats: "players.activeStatFilters",
  knownStats: "players.knownStatFilters",
  statFilter: "players.stat-filter",
};
const playersQueryKeys = {
  sortStat: "psort",
  sortDirection: "pdir",
  filters: "pfilters",
  filterStat: "pfilterStat",
  filterOperator: "pfilterOperator",
  filterMin: "pfilterMin",
  filterMax: "pfilterMax",
  page: "ppage",
  league: "pleague",
};
const defaultPlayersSortStat = "goals";
const defaultPlayersSortDirection = "desc";
const textSortStats = new Set(["nation"]);
const positionSortStats = new Set(["position", "secondaryPosition"]);
const preferredFilterStats = ["nation", "position", "secondaryPosition"];
const activeViewBarId = "active-view-bar";

export function playerGoalList({ big = false, enableStatFilters = false, pageSize } = {}) {
  const hasPlayerStatFilters = enableStatFilters && statFilterButtons.length > 0;
  const tableBody = table.getElementsByTagName("tbody")[0];
  const serverSidePlayersTable = big;
  const serverState = serverSidePlayersTable ? getPlayersServerStateFromUrl() : null;

  adjustColspan(table.rows[0].cells[0], 1);
  if (!tableBody) {
    console.error("Table body not found! Ensure the table has a <tbody> element.");
    return;
  }

  prepareStatFilters(hasPlayerStatFilters, serverSidePlayersTable, serverState);
  bindSortableHeaders({ serverSidePlayersTable, serverState, hasPlayerStatFilters });
  bindStatFilterButtons(hasPlayerStatFilters);
  paginatePlayerTable({ serverSidePlayersTable, serverState, pageSize });
  updateTableVisibility(hasPlayerStatFilters, serverSidePlayersTable);

  if (serverSidePlayersTable) {
    setPlayersSortState(
      serverState?.sortStat || defaultPlayersSortStat,
      serverState?.sortDirection || defaultPlayersSortDirection,
    );
    renderActiveViewChips();
  }

  showPlayerTable();
}

function prepareStatFilters(hasPlayerStatFilters, serverSidePlayersTable, serverState) {
  if (hasPlayerStatFilters) {
    const statsFilterSide = document.getElementById("stats-filter-side");
    if (statsFilterSide) {
      statsFilterSide.style.display = "none";
    }
    restoreActiveStats();
  }

  if (serverSidePlayersTable) {
    registerPlayerStatFilterPopover(serverState);
  }
}

function registerPlayerStatFilterPopover(serverState) {
  registerStatFilterPopover({
    tableId: tableName,
    headerSelector: "thead th.sortable[data-stat]",
    rowSelector: "tbody tr",
    storageKey: playerStorageKeys.statFilter,
    serverSide: true,
    initialFilters: serverState?.statFilters || [],
    onFilterChange: (filters) => {
      navigateWithUpdatedQuery((urlParams) => {
        setPlayersFilterParams(urlParams, filters);
      });
    },
    getColumnIndex: (header) => headerCellIndex(header),
  });
}

function bindSortableHeaders({ serverSidePlayersTable, serverState, hasPlayerStatFilters }) {
  document.querySelectorAll(`#${tableName} th.sortable`).forEach((header) => {
    header.addEventListener("click", () => {
      if (serverSidePlayersTable) {
        const nextSort = nextServerSort(header, serverState);
        navigateWithUpdatedQuery((urlParams) => {
          setPlayersSortParams(urlParams, nextSort.stat, nextSort.direction);
        });
        return;
      }

      sortHeaderOnClient(header, hasPlayerStatFilters);
    });
  });
}

function nextServerSort(header, serverState) {
  const currentSortStat = serverState?.sortStat || defaultPlayersSortStat;
  const currentDirection = normalizeSortDirection(
    serverState?.sortDirection,
    defaultPlayersSortDirection,
  );

  return {
    stat: String(header.dataset.stat || defaultPlayersSortStat),
    direction: getNextSortDirection(currentSortStat === header.dataset.stat, currentDirection),
  };
}

function sortHeaderOnClient(header, hasPlayerStatFilters) {
  const currentOrder = header.getAttribute("data-default-order") || "desc";
  const newOrder = currentOrder === "asc" ? "desc" : "asc";

  header.setAttribute("data-default-order", newOrder);
  document.querySelectorAll(`#${tableName} th.sortable`).forEach((sortableHeader) => {
    sortableHeader.classList.remove("asc", "desc");
  });
  header.classList.add(newOrder);

  const columnIndex = headerCellIndex(header);
  if (sortSpecialPlayerColumn(header.dataset.stat, columnIndex, newOrder)) {
    document.dispatchEvent(new CustomEvent("gf:table-sorted", {
      detail: { tableId: table.id, header },
    }));
  } else {
    sortTable(columnIndex, header, table, 1);
  }

  updateTableVisibility(hasPlayerStatFilters, false);
}

function bindStatFilterButtons(hasPlayerStatFilters) {
  if (!hasPlayerStatFilters) {
    return;
  }

  statFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("active");
      saveActiveStats();
      updateTableVisibility(hasPlayerStatFilters);
    });
  });
}

function paginatePlayerTable({ serverSidePlayersTable, serverState, pageSize }) {
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
}

function showPlayerTable() {
  table.style.visibility = "visible";
  if (table.parentElement) {
    table.parentElement.style.visibility = "visible";
  }
  revealPageRectangle();
}

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
      : String(filter.value || min),
  };
}

function parsePlayersFiltersFromUrl(urlParams) {
  const serializedFilters = urlParams.get(playersQueryKeys.filters);
  if (serializedFilters) {
    const decoded = decodePlayersFilters(serializedFilters);
    if (decoded.length) {
      return decoded;
    }

    const parsedJson = parseJsonFilters(serializedFilters);
    if (parsedJson.length) {
      return parsedJson;
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

function parseJsonFilters(serializedFilters) {
  try {
    const parsed = JSON.parse(serializedFilters);
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((filter) => normalizePlayersFilter(filter))
      .filter(Boolean);
  } catch (error) {
    // fall through to legacy query fields
    return [];
  }
}

function getPlayersServerStateFromUrl() {
  const urlParams = getPageQueryParams();
  const parsedPage = Number.parseInt(urlParams.get(playersQueryKeys.page), 10);

  return {
    sortStat: urlParams.get(playersQueryKeys.sortStat) || defaultPlayersSortStat,
    sortDirection: normalizeSortDirection(
      urlParams.get(playersQueryKeys.sortDirection),
      defaultPlayersSortDirection,
    ),
    statFilters: parsePlayersFiltersFromUrl(urlParams),
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function isDefaultPlayersSort(sortStat, sortDirection) {
  return sortStat === defaultPlayersSortStat && sortDirection === defaultPlayersSortDirection;
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
  const normalizedDirection = normalizeSortDirection(sortDirection, defaultPlayersSortDirection);

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

function buttonStats(onlyActive) {
  return Array.from(statFilterButtons)
    .filter((button) => !onlyActive || button.classList.contains("active"))
    .map((button) => button.dataset.stat)
    .filter(Boolean);
}

function saveActiveStats() {
  try {
    window.localStorage.setItem(playerStorageKeys.activeStats, JSON.stringify(buttonStats(true)));
    window.localStorage.setItem(playerStorageKeys.knownStats, JSON.stringify(buttonStats(false)));
  } catch (error) {
    console.error("Unable to save player stat filters", error);
  }
}

function readStoredStatList(storageKey) {
  const savedValue = window.localStorage.getItem(storageKey);
  if (!savedValue) {
    return null;
  }

  const parsed = JSON.parse(savedValue);
  return Array.isArray(parsed) ? parsed : null;
}

function restoreActiveStats() {
  try {
    const savedStats = readStoredStatList(playerStorageKeys.activeStats);
    if (!savedStats?.length) {
      saveActiveStats();
      return;
    }

    const knownStats = readStoredStatList(playerStorageKeys.knownStats) || savedStats;
    const knownStatSet = new Set(knownStats);
    const activeStats = new Set(savedStats);
    statFilterButtons.forEach((button) => {
      const keepHtmlDefault = !knownStatSet.has(button.dataset.stat);
      button.classList.toggle(
        "active",
        keepHtmlDefault ? button.classList.contains("active") : activeStats.has(button.dataset.stat),
      );
    });
    saveActiveStats();
  } catch (error) {
    console.error("Unable to restore player stat filters", error);
  }
}

function headerCellIndex(header) {
  const headerCells = Array.from(header.parentElement.children);
  const headerIndex = headerCells.indexOf(header);
  return headerCells
    .slice(0, headerIndex)
    .reduce((sum, cell) => sum + (Number(cell.colSpan) || 1), 0);
}

function sortSpecialPlayerColumn(stat, columnIndex, direction) {
  if (positionSortStats.has(stat)) {
    sortPlayerRows(columnIndex, direction, comparePositionsByDisplayOrder);
    return true;
  }

  if (textSortStats.has(stat)) {
    sortPlayerRows(columnIndex, direction, (left, right) => {
      return left.localeCompare(right, undefined, { sensitivity: "base" });
    });
    return true;
  }

  return false;
}

function sortPlayerRows(columnIndex, direction, compareValues) {
  const body = table.tBodies[0];
  if (!body) {
    return;
  }

  const rows = Array.from(body.rows);
  rows.sort((rowA, rowB) => {
    const textA = rowA.cells[columnIndex]?.getAttribute("title") || "";
    const textB = rowB.cells[columnIndex]?.getAttribute("title") || "";
    if (!textA && !textB) {
      return 0;
    }
    if (!textA) {
      return 1;
    }
    if (!textB) {
      return -1;
    }

    const diff = compareValues(textA, textB);
    return direction === "asc" ? diff : -diff;
  });
  rows.forEach((row) => body.appendChild(row));
}

export function renderActiveViewChips({ leaguesOnly = false } = {}) {
  const bar = document.getElementById(activeViewBarId);
  if (!bar) {
    return;
  }

  bindActiveViewChips(bar);
  const chips = buildActiveViewChips(getPlayersServerStateFromUrl(), { leaguesOnly });
  bar.replaceChildren();
  if (!chips.length) {
    bar.hidden = true;
    return;
  }

  chips.forEach((chip) => bar.appendChild(createActiveViewChip(chip)));
  appendClearAll(bar, chips);
  bar.hidden = false;
}

function bindActiveViewChips(bar) {
  if (bar.dataset.bound === "true") {
    return;
  }

  bar.dataset.bound = "true";
  bar.addEventListener("click", (event) => {
    const clearAll = event.target.closest("[data-action='clear-active-view']");
    if (clearAll) {
      navigateWithUpdatedQuery(clearActiveView);
      return;
    }

    const removeButton = event.target.closest("[data-remove]");
    if (!removeButton || !bar.contains(removeButton)) {
      return;
    }

    const chip = removeButton.closest(".active-view-chip");
    navigateWithUpdatedQuery((urlParams) => {
      removeActiveViewConstraint(urlParams, chip);
    });
  });
}

function clearActiveView(urlParams) {
  setPlayersSortParams(urlParams, defaultPlayersSortStat, defaultPlayersSortDirection);
  setPlayersFilterParams(urlParams, []);
  urlParams.delete(playersQueryKeys.league);
}

function removeActiveViewConstraint(urlParams, chip) {
  if (chip?.dataset.kind === "sort") {
    setPlayersSortParams(urlParams, defaultPlayersSortStat, defaultPlayersSortDirection);
    return;
  }

  if (chip?.dataset.kind === "leagues") {
    urlParams.delete(playersQueryKeys.league);
    return;
  }

  if (chip?.dataset.kind === "filter") {
    const remaining = parsePlayersFiltersFromUrl(urlParams)
      .filter((filter) => filter.stat !== chip.dataset.stat);
    setPlayersFilterParams(urlParams, remaining);
  }
}

function buildActiveViewChips(state, { leaguesOnly = false } = {}) {
  const filters = orderedStatFilters(state.statFilters);
  const sortIsDefault = isDefaultPlayersSort(state.sortStat, state.sortDirection);
  const leaguesExplicit = getPageQueryParams().has(playersQueryKeys.league);
  const chips = leagueChips(selectedLeagues(), leaguesExplicit);
  if (leaguesOnly || (sortIsDefault && !filters.length && !leaguesExplicit)) {
    return chips;
  }

  chips.push({
    kind: "sort",
    text: sortChipText(state.sortStat, state.sortDirection),
    removable: !sortIsDefault,
  });

  filters.forEach((filter) => {
    chips.push({
      kind: "filter",
      stat: filter.stat,
      text: filterChipText(filter),
      removable: true,
    });
  });

  return chips;
}

function leagueChips(leagues, removable) {
  if (!leagues.length) {
    return [];
  }

  const names = leagues.map((league) => league.name).filter(Boolean);
  const text = names.length === 1
    ? `League: ${names[0]}`
    : `Leagues: ${joinNames(names, "and")}`;

  return [{
    kind: "leagues",
    text,
    logos: leagues,
    removable,
  }];
}

function appendClearAll(bar, chips) {
  if (chips.filter((chip) => chip.removable).length <= 1) {
    return;
  }

  const clearAll = document.createElement("button");
  clearAll.type = "button";
  clearAll.className = "active-view-clear";
  clearAll.dataset.action = "clear-active-view";
  clearAll.textContent = "Clear all";
  bar.appendChild(clearAll);
}

function createActiveViewChip({ kind, stat = "", text, removable, logos = [] }) {
  const chip = document.createElement("div");
  chip.className = "active-view-chip";
  chip.dataset.kind = kind;
  if (stat) {
    chip.dataset.stat = stat;
  }

  if (logos.length) {
    chip.classList.add("active-view-chip--logos");
    chip.appendChild(createLeagueLogoRow(logos));
  } else {
    const label = document.createElement("span");
    label.className = "active-view-chip__text";
    label.textContent = text;
    chip.appendChild(label);
  }

  if (removable) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "active-view-chip__remove";
    removeButton.dataset.remove = kind;
    removeButton.setAttribute("aria-label", `Remove ${text}`);
    removeButton.textContent = "×";
    chip.appendChild(removeButton);
  }

  return chip;
}

function selectedLeagues() {
  return [...document.querySelectorAll(".pleague-league-to-select.selected-league")]
    .map((element) => {
      const id = element.id.replace(/^img-/, "");
      const name = (element.getAttribute("title") || element.querySelector("span")?.textContent || "").trim();
      const image = element.querySelector("img");
      return {
        id,
        name,
        src: image?.getAttribute("src") || `/images/competitions/${id}.png`,
      };
    })
    .filter((league) => league.src);
}

function createLeagueLogoRow(leagues) {
  const row = document.createElement("span");
  row.className = "active-view-chip__logos";
  leagues.forEach((league) => {
    const image = document.createElement("img");
    image.src = league.src;
    image.alt = league.name || "League";
    if (league.name) {
      image.title = league.name;
    }
    row.appendChild(image);
  });
  return row;
}

function orderedStatFilters(filters) {
  return [...filters].sort((left, right) => {
    return preferredFilterRank(left.stat) - preferredFilterRank(right.stat);
  });
}

function preferredFilterRank(stat) {
  const index = preferredFilterStats.indexOf(stat);
  return index === -1 ? preferredFilterStats.length : index;
}

function sortChipText(stat, direction) {
  const label = statDisplayName(stat).toLowerCase();
  const order = direction === "asc" ? "ASC" : "DESC";
  return `Sorted by ${label}, ${order}`;
}

function filterChipText(filter) {
  if (filter.stat === "nation") {
    return nationFilterText(filter);
  }

  if (positionSortStats.has(filter.stat)) {
    return positionFilterText(filter);
  }

  return numericFilterText(filter);
}

function nationFilterText(filter) {
  const name = nationDisplayName(filter.value || filter.min);
  return filter.operator === "neq" ? `Nation is not ${name}` : `Nation is ${name}`;
}

function positionFilterText(filter) {
  const label = statDisplayName(filter.stat);
  const list = joinNames(positionDisplayNames(filter), "or");
  return filter.operator === "neq" ? `${label} is not ${list}` : `${label} is ${list}`;
}

function numericFilterText(filter) {
  const label = statDisplayName(filter.stat);
  const min = String(filter.min ?? "").trim();
  const max = String(filter.max ?? "").trim();
  const value = String(filter.value ?? min ?? max ?? "").trim();
  const detail = label.toLowerCase();
  const phrases = {
    gte: `At least ${min || value} ${detail}`,
    lte: `At most ${max || min || value} ${detail}`,
    between: `Between ${min} and ${max} ${detail}`,
    eq: `Exactly ${value} ${detail}`,
    neq: `Not ${value} ${detail}`,
  };

  return phrases[filter.operator] || `${label}: ${value}`;
}

function statDisplayName(stat) {
  const header = document.querySelector(`#${tableName} th[data-stat="${stat}"]`);
  return header?.getAttribute("title") || String(stat || "Statistic");
}

function readJsonScript(elementId) {
  try {
    const parsed = JSON.parse(document.getElementById(elementId)?.textContent || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function nationDisplayName(nationId) {
  const match = readJsonScript("player-nation-options").find((nation) => String(nation.id) === String(nationId));
  return match?.name || "this nation";
}

function positionDisplayNames(filter) {
  const options = readJsonScript("player-position-options");
  return String(filter?.value || filter?.min || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => options.find((option) => option.value === value)?.label || value);
}

function joinNames(names, conjunction) {
  if (names.length <= 1) {
    return names[0] || "";
  }

  if (names.length === 2) {
    return `${names[0]} ${conjunction} ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")}, ${conjunction} ${names.at(-1)}`;
}

function updateTableVisibility(hasPlayerStatFilters, serverSidePlayersTable = false) {
  if (hasPlayerStatFilters) {
    const activeStats = new Set(
      Array.from(document.querySelectorAll(".stat-filter-btn.active")).map((button) => button.dataset.stat),
    );

    document.querySelectorAll(`#${tableName} th[data-stat]`).forEach((header) => {
      const isVisible = activeStats.has(header.dataset.stat);
      document
        .querySelectorAll(`#${tableName} th[data-stat="${header.dataset.stat}"], #${tableName} td[data-stat="${header.dataset.stat}"]`)
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

export function playerListToCanvas() {
  const images = [];
  const playerListTable = document.getElementById("player-list-table");
  const normalWidth = "70px";

  playerListTable.cellPadding = 10;
  styleCanvasHeaderRow(playerListTable.rows[0]);
  removePlayerListColumn(playerListTable, "position");
  removePlayerListColumn(playerListTable, "secondaryPosition");
  placeNationBesidePhoto(playerListTable);
  trimCanvasStatHeaders(playerListTable.rows[0]);

  for (let rowIndex = 1; rowIndex < playerListTable.rows.length; rowIndex += 1) {
    styleCanvasPlayerRow(playerListTable.rows[rowIndex], rowIndex, images, normalWidth);
  }

  buildTableForTableType(removeNewlines(playerListTable.outerHTML), images, 110);
  ctx.fillStyle = "#e63946";
}

function styleCanvasHeaderRow(headerRow) {
  headerRow.style.backgroundColor = "#1D3557";
  headerRow.style.color = "#F1FAEE";
  headerRow.style.fontWeight = "bold";
}

function trimCanvasStatHeaders(headerRow) {
  headerRow.deleteCell(6);
  headerRow.deleteCell(6);
  headerRow.cells[2].innerHTML = "Apps";
  headerRow.cells[3].innerHTML = "Goal";
  headerRow.cells[5].innerHTML = "As.";
  headerRow.cells[6].innerHTML = "Rate";

  for (let cellIndex = 0; cellIndex < headerRow.cells.length; cellIndex += 1) {
    headerRow.cells[cellIndex].style.borderRightColor = "#F1FAEE";
  }
}

function styleCanvasPlayerRow(row, rowIndex, images, normalWidth) {
  images.push({
    img: imgs.players[row.children[0].id],
    imgHeight: 80,
    startX: 133,
    startY: 82 + rowIndex * 80,
  });
  images.push({
    img: imgs.clubs[row.children[1].id],
    imgHeight: 46,
    startX: 183,
    startY: 97 + rowIndex * 80,
  });
  images.push({
    img: imgs.clubs[row.children[3].id],
    imgHeight: 72,
    startX: 514,
    startY: 88 + rowIndex * 80,
  });

  row.style.height = "80px";
  row.children[0].innerHTML = "";
  row.children[0].style.width = "60px";
  row.children[0].style.borderRightStyle = "hidden";
  row.children[1].style.width = "46px";
  row.children[1].innerHTML = "";
  row.children[2].style.width = "260px";
  row.children[3].innerHTML = "";
  row.children[3].style.width = "50px";
  row.children[4].style.width = normalWidth;
  row.children[5].style.width = normalWidth;
  row.children[6].style.width = normalWidth;
  row.children[7].style.width = normalWidth;
  row.deleteCell(8);
  row.deleteCell(8);
  row.deleteCell(-1);
  row.children[5].style.fontWeight = "bold";

  for (let cellIndex = 3; cellIndex < row.children.length; cellIndex += 1) {
    row.children[cellIndex].style.textAlign = "center";
  }
}

function placeNationBesidePhoto(playerListTable) {
  const header = playerListTable.rows[0];
  const nationHeader = header?.querySelector('th[data-stat="nation"]');
  if (nationHeader) {
    nationHeader.remove();
  }

  if (header?.cells[0]) {
    header.cells[0].colSpan = 3;
  }

  for (let rowIndex = 1; rowIndex < playerListTable.rows.length; rowIndex += 1) {
    const row = playerListTable.rows[rowIndex];
    const nationCell = row.querySelector('td[data-stat="nation"]');
    if (nationCell && row.cells[1] !== nationCell) {
      row.insertBefore(nationCell, row.cells[1]);
    }
  }
}

function removePlayerListColumn(playerListTable, stat) {
  const headerRow = playerListTable.rows[0];
  const headerIndex = Array.from(headerRow.cells).findIndex((cell) => cell.dataset.stat === stat);
  if (headerIndex >= 0) {
    headerRow.deleteCell(headerIndex);
  }

  for (let rowIndex = 1; rowIndex < playerListTable.rows.length; rowIndex += 1) {
    const row = playerListTable.rows[rowIndex];
    const cellIndex = Array.from(row.cells).findIndex((cell) => cell.dataset.stat === stat);
    if (cellIndex >= 0) {
      row.deleteCell(cellIndex);
    }
  }
}
