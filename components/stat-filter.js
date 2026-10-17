import { getPositionGroupOrder } from "../classes/player-positions.js";

const DEFAULT_STORAGE_PREFIX = "table-stat-filter";
const DEFAULT_OPERATOR = "gte";
const EPSILON = 0.0001;
const popoverSelectors = {
  title: ".stat-filter-popover__title",
  operator: '[data-role="operator"]',
  operatorField: '[data-role="operator-field"]',
  min: '[data-role="min"]',
  max: '[data-role="max"]',
  maxField: '[data-role="max-field"]',
  range: '[data-role="range"]',
  positionList: '[data-role="position-list"]',
  positionField: '[data-role="position-field"]',
  nationInput: '[data-role="nation-input"]',
  nationList: '[data-role="nation-list"]',
  nationField: '[data-role="nation-field"]',
  nationEmpty: '[data-role="nation-empty"]',
};
const GENERIC_POSITION_VALUES = new Set(["defender", "midfielder", "forward"]);
const POSITION_GROUP_LABELS = {
  0: "Goalkeeper",
  1: "Defender",
  2: "Midfielder",
  3: "Attacker",
};
const POPOVER_SIZES = {
  number: { width: 280, height: 260 },
  select: { width: 360, height: 420 },
  nation: { width: 320, height: 460 },
};

const stateByTable = new Map();
let listenersInstalled = false;
let popoverElement = null;
let nationOptions = null;

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericValue(value) {
  const normalized = normalizeText(value).replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : Number.NaN;
}

function readJsonOptions(elementId) {
  const node = document.getElementById(elementId);
  if (!node) {
    return [];
  }

  try {
    const parsed = JSON.parse(node.textContent || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function getPopoverField(popover, field) {
  return popover?.querySelector(popoverSelectors[field]);
}

function getHeaderLabel(header, config, fallback = "") {
  return normalizeText(
    typeof config?.getLabel === "function"
      ? config.getLabel(header, config.table)
      : header.getAttribute("title") || header.innerText || header.dataset.stat || fallback,
  );
}

function filterModeName(filterType) {
  return POPOVER_SIZES[filterType] ? filterType : "number";
}

function validateFilterInput({ operator, min, max }) {
  if (operator === "between") {
    return Boolean(min && max);
  }

  if (operator === "lte") {
    return Boolean(max || min);
  }

  if (operator === "gte" || operator === "eq" || operator === "neq") {
    return Boolean(min);
  }

  return true;
}

function toFilterValue(operator, min, max) {
  return operator === "lte" && max ? max : min;
}

function normalizeRangeValues(filter) {
  return {
    min: Number.parseFloat(filter.min),
    max: Number.parseFloat(filter.max),
    target: Number.parseFloat(filter.value),
  };
}

function getConfig(tableId) {
  return stateByTable.get(tableId);
}

function getConfigFilters(config) {
  return Array.isArray(config?.state?.filters) ? config.state.filters : [];
}

function findFilterIndex(filters, filter) {
  if (!Array.isArray(filters) || !filter) {
    return -1;
  }

  const requestedColumnIndex = Number.parseInt(filter.columnIndex, 10);
  if (Number.isFinite(requestedColumnIndex)) {
    return filters.findIndex((item) => Number.parseInt(item?.columnIndex, 10) === requestedColumnIndex);
  }

  return filters.findIndex((item) => String(item?.stat || "") === String(filter.stat || ""));
}

function upsertFilter(filters, filter) {
  const nextFilters = [...filters];
  const existingIndex = findFilterIndex(nextFilters, filter);

  if (existingIndex >= 0) {
    nextFilters[existingIndex] = filter;
    return nextFilters;
  }

  nextFilters.push(filter);
  return nextFilters;
}

function removeFilter(filters, filter = null) {
  if (!filter) {
    return [];
  }

  const index = findFilterIndex(filters, filter);
  if (index < 0) {
    return filters;
  }

  const nextFilters = [...filters];
  nextFilters.splice(index, 1);
  return nextFilters;
}

function popoverFilter(operator, min, max = "", value = min) {
  return {
    stat: popoverElement.dataset.stat,
    label: popoverElement.dataset.label,
    columnIndex: Number.parseInt(popoverElement.dataset.columnIndex, 10),
    operator,
    min,
    max,
    value,
  };
}

function commitPopoverFilter(filter) {
  const config = getConfig(popoverElement?.dataset.tableId);
  if (!config) {
    return;
  }

  applyConfigFilterState(config, upsertFilter(getConfigFilters(config), filter));
  hidePopover();
}

function clearCurrentPopoverFilter() {
  if (!popoverElement) {
    return;
  }

  clearTableStatFilter(popoverElement.dataset.tableId, {
    stat: popoverElement.dataset.stat,
    columnIndex: popoverElement.dataset.columnIndex,
  });
  hidePopover();
}

function sameColumnFilter(config, trigger, header) {
  const currentFilter = getConfigFilters(config).find(
    (filter) => String(filter?.columnIndex ?? "") === trigger.dataset.columnIndex,
  );
  const isSameColumn = currentFilter?.stat === header.dataset.stat
    && String(currentFilter?.columnIndex ?? "") === trigger.dataset.columnIndex;

  return { currentFilter, isSameColumn };
}

function hydrateFilterMetadata(config, filter) {
  if (!filter || !config?.table) {
    return filter;
  }

  const columnIndex = Number.parseInt(filter.columnIndex, 10);
  const hasColumnIndex = Number.isFinite(columnIndex);
  const headers = Array.from(config.table.querySelectorAll(config.headerSelector || ""));

  if (!headers.length) {
    return hasColumnIndex
      ? { ...filter, columnIndex }
      : filter;
  }

  if (hasColumnIndex) {
    return {
      ...filter,
      columnIndex,
      label: filter.label || "",
    };
  }

  const matchingHeader = headers.find((header) => String(header.dataset.stat || "") === String(filter.stat || ""));
  if (!matchingHeader || typeof config.getColumnIndex !== "function") {
    return filter;
  }

  return {
    ...filter,
    columnIndex: Number.parseInt(config.getColumnIndex(matchingHeader, config.table), 10),
    label: filter.label || getHeaderLabel(matchingHeader, config, filter.stat),
  };
}

function hydrateFiltersMetadata(config, filters) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((filter) => hydrateFilterMetadata(config, filter))
    .filter((filter) => filter && filter.stat && filter.operator && Number.isFinite(Number.parseInt(filter.columnIndex, 10)));
}

function applyConfigFilterState(config, nextFilters) {
  config.state.filters = Array.isArray(nextFilters)
    ? nextFilters.filter(Boolean)
    : [];
  persistState(config.tableId);
  setActiveHeaderState(config.tableId, config.state.filters);
  applyFilterToTable(config.tableId);
  config.onFilterChange?.(config.state.filters);
}

function persistState(tableId) {
  const config = getConfig(tableId);
  if (!config?.storageKey || config.serverSide || !config.useLocalState) {
    return;
  }

  try {
    const filters = getConfigFilters(config);
    window.localStorage.setItem(config.storageKey, filters.length ? JSON.stringify(filters) : "");
  } catch (error) {
    console.error("Unable to persist stat filter state", error);
  }
}

function restoreState(tableId) {
  const config = getConfig(tableId);
  if (!config?.storageKey || config.serverSide || !config.useLocalState) {
    return;
  }

  try {
    const savedValue = window.localStorage.getItem(config.storageKey);
    if (!savedValue) {
      return;
    }

    const parsed = JSON.parse(savedValue);
    const parsedFilters = Array.isArray(parsed) ? parsed : [parsed];
    config.state.filters = parsedFilters.filter((item) => item?.stat && item?.operator);
  } catch (error) {
    console.error("Unable to restore stat filter state", error);
  }
}

function getPositionFilterOptions() {
  return readJsonOptions("player-position-options");
}

function parsePositionFilterValues(filter) {
  return String(filter?.value || filter?.min || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function serializePositionFilterValues(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean),
  )].join(",");
}

function positionFilterLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const match = getPositionFilterOptions().find((option) => option.value === normalized);
  return match?.abbreviation || value;
}

function getOptionGroup(option) {
  const explicitGroup = Number(option?.group);
  if (Number.isInteger(explicitGroup) && explicitGroup >= 0 && explicitGroup <= 3) {
    return explicitGroup;
  }

  return getPositionGroupOrder(option?.label || option?.value);
}

function createPositionOptionButton(option) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "position-option";
  button.dataset.value = option.value;
  button.textContent = option.abbreviation || option.label;
  button.title = option.label || option.abbreviation || option.value;
  return button;
}

function updatePositionGroupState(group) {
  if (!group) {
    return;
  }

  const options = Array.from(group.querySelectorAll(".position-option"));
  const allSelected = options.length > 0 && options.every((button) => button.classList.contains("selected-position"));
  group.querySelector(".position-group__title")?.classList.toggle("selected-group", allSelected);
}

function updateAllPositionGroupStates(list) {
  list?.querySelectorAll(".position-group").forEach(updatePositionGroupState);
}

function togglePositionGroup(group) {
  if (!group) {
    return;
  }

  const options = Array.from(group.querySelectorAll(".position-option"));
  const selectAll = !options.every((button) => button.classList.contains("selected-position"));
  options.forEach((button) => button.classList.toggle("selected-position", selectAll));
  updatePositionGroupState(group);
}

function ensurePositionOptions(list) {
  if (!list || list.dataset.ready === "true") {
    return;
  }

  list.dataset.ready = "true";
  const optionsByGroup = new Map();
  getPositionFilterOptions().forEach((option) => {
    if (GENERIC_POSITION_VALUES.has(String(option.value || "").toLowerCase())) {
      return;
    }

    const groupId = getOptionGroup(option);
    if (groupId < 0 || groupId > 3) {
      return;
    }

    if (!optionsByGroup.has(groupId)) {
      optionsByGroup.set(groupId, []);
    }
    optionsByGroup.get(groupId).push(option);
  });

  Object.entries(POSITION_GROUP_LABELS).forEach(([groupId, label]) => {
    const options = optionsByGroup.get(Number(groupId)) || [];
    if (!options.length) {
      return;
    }

    const group = document.createElement("div");
    group.className = "position-group";
    group.dataset.group = groupId;

    const title = document.createElement("button");
    title.type = "button";
    title.className = "position-group__title";
    title.textContent = label;
    title.title = `Select all ${label.toLowerCase()}s`;

    const chips = document.createElement("div");
    chips.className = "position-group__options";
    options.forEach((option) => chips.appendChild(createPositionOptionButton(option)));

    group.append(title, chips);
    list.appendChild(group);
  });
}

function getSelectedPositionValues(list) {
  return Array.from(list?.querySelectorAll(".position-option.selected-position") || [])
    .map((button) => button.dataset.value)
    .filter(Boolean);
}

function setSelectedPositionValues(list, values) {
  const selected = new Set(parsePositionFilterValues({ value: Array.isArray(values) ? values.join(",") : values }));
  list?.querySelectorAll(".position-option").forEach((button) => {
    button.classList.toggle("selected-position", selected.has(button.dataset.value));
  });
  updateAllPositionGroupStates(list);
}

function loadNationOptions() {
  if (nationOptions) {
    return nationOptions;
  }

  try {
    nationOptions = readJsonOptions("player-nation-options");
  } catch (error) {
    nationOptions = [];
  }

  return nationOptions;
}

function nationFilterLabel(nationId) {
  const match = loadNationOptions().find((nation) => String(nation.id) === String(nationId));
  return match?.name || String(nationId || "");
}

function ensureNationOptions(list) {
  if (!list || list.dataset.ready === "true") {
    return;
  }

  const allNations = document.createElement("button");
  allNations.type = "button";
  allNations.className = "nation-option nation-option--all";
  allNations.dataset.value = "";
  allNations.textContent = "All nations";
  list.appendChild(allNations);

  loadNationOptions().forEach((nation) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nation-option";
    button.dataset.value = String(nation.id);
    const flag = document.createElement("img");
    flag.className = "nation-option__flag";
    flag.alt = "";
    flag.src = `/images/logos/${nation.id}.png`;
    const name = document.createElement("span");
    name.className = "nation-option__name";
    name.textContent = nation.name;
    button.append(flag, name);
    list.appendChild(button);
  });

  list.dataset.ready = "true";
}

function filterNationList(query) {
  const list = getPopoverField(popoverElement, "nationList");
  const empty = getPopoverField(popoverElement, "nationEmpty");
  const normalized = String(query || "").trim().toLowerCase();
  let visible = 0;

  list?.querySelectorAll(".nation-option").forEach((button) => {
    const isAll = !button.dataset.value;
    const name = button.querySelector(".nation-option__name")?.textContent.toLowerCase() || "";
    const show = isAll ? !normalized : name.includes(normalized);
    button.hidden = !show;
    if (show) {
      visible += 1;
    }
  });

  if (empty) {
    empty.hidden = visible !== 0;
  }
}

function setSelectedNation(list, value) {
  const selected = String(value || "");
  list?.querySelectorAll(".nation-option").forEach((button) => {
    button.classList.toggle("selected-nation", Boolean(selected) && button.dataset.value === selected);
  });
}

function applyNationSelection(nationId) {
  if (!popoverElement || !getConfig(popoverElement.dataset.tableId)) {
    return;
  }

  if (!nationId) {
    clearCurrentPopoverFilter();
    return;
  }

  commitPopoverFilter(popoverFilter("eq", nationId, "", nationId));
}

const filterModes = {
  number: {
    prepare(popover, { isSameColumn, currentFilter }) {
      getPopoverField(popover, "operator").value = isSameColumn ? (currentFilter?.operator || DEFAULT_OPERATOR) : DEFAULT_OPERATOR;
      getPopoverField(popover, "min").value = isSameColumn ? (currentFilter?.min ?? "") : "";
      getPopoverField(popover, "max").value = isSameColumn ? (currentFilter?.max ?? "") : "";
      getPopoverField(popover, "operator").dispatchEvent(new Event("change", { bubbles: true }));
    },
    focus(popover) {
      getPopoverField(popover, "min").focus();
    },
    apply() {
      const operator = getPopoverField(popoverElement, "operator").value;
      const min = getPopoverField(popoverElement, "min").value;
      const max = getPopoverField(popoverElement, "max").value;
      if (!validateFilterInput({ operator, min, max })) {
        return;
      }

      commitPopoverFilter(popoverFilter(operator, min, max, toFilterValue(operator, min, max)));
    },
  },
  select: {
    prepare(popover, { isSameColumn, currentFilter }) {
      const positionList = getPopoverField(popover, "positionList");
      ensurePositionOptions(positionList);
      setSelectedPositionValues(
        positionList,
        isSameColumn ? (currentFilter?.value || currentFilter?.min || "") : "",
      );
    },
    apply() {
      const selectedPositions = serializePositionFilterValues(
        getSelectedPositionValues(getPopoverField(popoverElement, "positionList")),
      );
      if (!selectedPositions) {
        clearCurrentPopoverFilter();
        return;
      }

      commitPopoverFilter(popoverFilter("in", selectedPositions, "", selectedPositions));
    },
  },
  nation: {
    hideApply: true,
    prepare(popover, { isSameColumn, currentFilter }) {
      const nationList = getPopoverField(popover, "nationList");
      const nationInput = getPopoverField(popover, "nationInput");
      ensureNationOptions(nationList);
      nationInput.value = "";
      filterNationList("");
      setSelectedNation(nationList, isSameColumn ? (currentFilter?.value || currentFilter?.min || "") : "");
    },
    focus(popover) {
      getPopoverField(popover, "nationInput").focus();
    },
    apply() {},
  },
};

function setPopoverMode(popover, modeName) {
  const mode = filterModeName(modeName);
  popover.dataset.filterType = mode;
  popover.classList.toggle("stat-filter-popover--positions", mode === "select");
  popover.classList.toggle("stat-filter-popover--nations", mode === "nation");
  const showsChoices = mode !== "number";
  getPopoverField(popover, "operatorField").hidden = showsChoices;
  getPopoverField(popover, "range").hidden = showsChoices;
  getPopoverField(popover, "positionField").hidden = mode !== "select";
  getPopoverField(popover, "nationField").hidden = mode !== "nation";
  const applyButton = popover.querySelector('[data-action="apply"]');
  if (applyButton) {
    applyButton.hidden = Boolean(filterModes[mode].hideApply);
  }
}

function formatFilterSummary(filter) {
  if (!filter) {
    return "";
  }

  if (filter.stat === "position" || filter.stat === "secondaryPosition") {
    return parsePositionFilterValues(filter).map(positionFilterLabel).join(", ");
  }

  if (filter.stat === "nation") {
    return nationFilterLabel(filter.value || filter.min);
  }

  const min = String(filter.min ?? "").trim();
  const max = String(filter.max ?? "").trim();
  const value = String(filter.value ?? min ?? max ?? "").trim();

  switch (filter.operator) {
    case "gte":
      return `≥ ${min || value}`;
    case "lte":
      return `≤ ${max || value}`;
    case "between":
      return min && max ? `${min}–${max}` : "Between";
    case "eq":
      return `= ${value}`;
    case "neq":
      return `≠ ${value}`;
    default:
      return value;
  }
}

function setActiveHeaderState(tableId, filters) {
  const config = getConfig(tableId);
  if (!config?.table) {
    return;
  }

  config.table.querySelectorAll(".stat-filter-trigger").forEach((trigger) => {
    trigger.classList.remove("active");
    trigger.textContent = "";
    delete trigger.dataset.summary;
  });

  const filterList = Array.isArray(filters) ? filters : filters ? [filters] : [];
  filterList.forEach((filter) => {
    const trigger = config.table.querySelector(
      `.stat-filter-trigger[data-column-index="${filter.columnIndex}"]`,
    );
    if (!trigger) {
      return;
    }

    const summary = formatFilterSummary(filter);
    trigger.classList.add("active");
    trigger.dataset.summary = summary;
    trigger.setAttribute("aria-label", `${filter.label || filter.stat || "Filter"}: ${summary}`);
    trigger.title = `${filter.label || filter.stat || "Filter"}: ${summary}`;
  });
}

function getCellValue(row, columnIndex) {
  const cell = row.cells[columnIndex];
  if (!cell) {
    return Number.NaN;
  }

  return parseNumericValue(cell.innerText);
}

function matchesNumericFilter(value, filter) {
  if (!Number.isFinite(value)) {
    return false;
  }

  const { min, max, target } = normalizeRangeValues(filter);

  switch (filter.operator) {
    case "gte":
      return Number.isFinite(min) && value >= min;
    case "lte":
      return Number.isFinite(max) ? value <= max : Number.isFinite(min) && value <= min;
    case "between": {
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return false;
      }

      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      return value >= lower && value <= upper;
    }
    case "eq":
      return Number.isFinite(target) && Math.abs(value - target) < EPSILON;
    case "neq":
      return Number.isFinite(target) && Math.abs(value - target) >= EPSILON;
    default:
      return true;
  }
}

function rowMatchesFilter(row, filter) {
  if (filter.stat === "position" || filter.stat === "secondaryPosition") {
    const cell = row.cells[filter.columnIndex];
    const playerValue = normalizeText(cell?.getAttribute("title") || cell?.innerText).toLowerCase();
    const selected = parsePositionFilterValues(filter);
    if (!selected.length) {
      return true;
    }

    const isMatch = selected.includes(playerValue);
    return filter.operator === "neq" ? !isMatch : isMatch;
  }

  if (filter.stat === "nation") {
    const cell = row.cells[filter.columnIndex];
    const playerNation = String(cell?.id || "").trim();
    const selected = String(filter.value || filter.min || "").trim();
    if (!selected) {
      return true;
    }

    return filter.operator === "neq" ? playerNation !== selected : playerNation === selected;
  }

  return matchesNumericFilter(getCellValue(row, filter.columnIndex), filter);
}

function applyFilterToTable(tableId) {
  const config = getConfig(tableId);
  if (!config || config.serverSide || !config.table) {
    return;
  }

  const filters = getConfigFilters(config);
  Array.from(config.table.querySelectorAll(config.rowSelector)).forEach((row) => {
    const isVisible = !filters.length || filters.every((filter) => rowMatchesFilter(row, filter));
    row.style.display = isVisible ? "" : "none";
    row.dataset.statFilterHidden = isVisible ? "false" : "true";
  });
}

function createPopover() {
  if (popoverElement) {
    return popoverElement;
  }

  popoverElement = document.createElement("div");
  popoverElement.className = "stat-filter-popover";
  popoverElement.hidden = true;
  popoverElement.innerHTML = `
    <div class="stat-filter-popover__header">
      <strong class="stat-filter-popover__title"></strong>
      <button type="button" class="stat-filter-popover__close" data-action="close" aria-label="Close filter">&times;</button>
    </div>
    <label class="stat-filter-popover__field" data-role="operator-field">
      <span>Rule</span>
      <select class="stat-filter-popover__operator" data-role="operator">
        <option value="gte">Greater than or equal</option>
        <option value="lte">Less than or equal</option>
        <option value="between">Between</option>
        <option value="eq">Equals</option>
        <option value="neq">Does not equal</option>
      </select>
    </label>
    <div class="stat-filter-popover__positions" data-role="position-field" hidden>
      <div class="stat-filter-popover__position-list" data-role="position-list"></div>
    </div>
    <div class="stat-filter-popover__nations" data-role="nation-field" hidden>
      <input class="stat-filter-popover__nation-input" data-role="nation-input" type="text" placeholder="Type to filter nations" aria-label="Filter nations" />
      <div class="stat-filter-popover__nation-list" data-role="nation-list"></div>
      <div class="stat-filter-popover__nation-empty" data-role="nation-empty" hidden>No nations match your search.</div>
    </div>
    <div class="stat-filter-popover__range" data-role="range">
      <label class="stat-filter-popover__field" data-role="min-field">
        <span>Value</span>
        <input class="stat-filter-popover__input" data-role="min" type="number" step="any" inputmode="decimal" />
      </label>
      <label class="stat-filter-popover__field" data-role="max-field">
        <span>Max</span>
        <input class="stat-filter-popover__input" data-role="max" type="number" step="any" inputmode="decimal" />
      </label>
    </div>
    <div class="stat-filter-popover__actions">
      <button type="button" class="stat-filter-popover__button stat-filter-popover__button--ghost" data-action="clear">Clear</button>
      <button type="button" class="stat-filter-popover__button stat-filter-popover__button--primary" data-action="apply">Apply</button>
    </div>
  `;

  document.body.appendChild(popoverElement);

  const operatorSelect = getPopoverField(popoverElement, "operator");
  const updateRangeVisibility = () => {
    getPopoverField(popoverElement, "maxField").style.display = operatorSelect.value === "between" ? "grid" : "none";
  };

  operatorSelect.addEventListener("change", updateRangeVisibility);
  updateRangeVisibility();
  getPopoverField(popoverElement, "nationInput").addEventListener("input", (event) => {
    filterNationList(event.target.value);
  });

  popoverElement.addEventListener("click", (event) => {
    const groupTitle = event.target.closest(".position-group__title");
    if (groupTitle && popoverElement.contains(groupTitle)) {
      togglePositionGroup(groupTitle.closest(".position-group"));
      return;
    }

    const positionOption = event.target.closest(".position-option");
    if (positionOption && popoverElement.contains(positionOption)) {
      positionOption.classList.toggle("selected-position");
      updatePositionGroupState(positionOption.closest(".position-group"));
      return;
    }

    const nationOption = event.target.closest(".nation-option");
    if (nationOption && popoverElement.contains(nationOption)) {
      applyNationSelection(nationOption.dataset.value || "");
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "close") {
      hidePopover();
    } else if (action === "clear") {
      clearCurrentPopoverFilter();
    } else if (action === "apply") {
      applyPopoverFilter();
    }
  });

  popoverElement.addEventListener("submit", (event) => {
    event.preventDefault();
    applyPopoverFilter();
  });

  return popoverElement;
}

function ensureListeners() {
  if (listenersInstalled) {
    return;
  }

  listenersInstalled = true;

  document.addEventListener("click", (event) => {
    if (!popoverElement || popoverElement.hidden || popoverElement.contains(event.target)) {
      return;
    }

    if (!event.target.closest(".stat-filter-trigger")) {
      hidePopover();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hidePopover();
    }
  });

  document.addEventListener("gf:table-sorted", (event) => {
    const tableId = event.detail?.tableId;
    if (tableId) {
      applyTableStatFilter(tableId);
    }
  });
}

function updatePopoverPosition(trigger, tableId) {
  const rect = trigger.getBoundingClientRect();
  const popover = createPopover();
  const { width, height } = POPOVER_SIZES[filterModeName(popover.dataset.filterType)];
  const padding = 8;
  const left = Math.min(window.innerWidth - width - padding, Math.max(padding, rect.left));
  const belowTop = rect.bottom + 8;
  const aboveTop = rect.top - height - 8;

  popover.style.left = `${left}px`;
  popover.style.top = `${belowTop + height <= window.innerHeight ? belowTop : Math.max(padding, aboveTop)}px`;
  popover.dataset.tableId = tableId;
}

function hidePopover() {
  if (!popoverElement) {
    return;
  }

  popoverElement.hidden = true;
  popoverElement.dataset.tableId = "";
  popoverElement.dataset.columnIndex = "";
}

function applyPopoverFilter() {
  if (!popoverElement || !getConfig(popoverElement.dataset.tableId)) {
    return;
  }

  filterModes[filterModeName(popoverElement.dataset.filterType)].apply();
}

function openPopover(trigger, header, config) {
  const popover = createPopover();
  const mode = filterModeName(header.dataset.filterType);
  const { currentFilter, isSameColumn } = sameColumnFilter(config, trigger, header);

  popover.hidden = false;
  popover.dataset.tableId = config.tableId;
  popover.dataset.stat = header.dataset.stat || "";
  popover.dataset.label = getHeaderLabel(header, config);
  popover.dataset.columnIndex = String(trigger.dataset.columnIndex);
  getPopoverField(popover, "title").textContent = `Filter: ${popover.dataset.label}`;
  setPopoverMode(popover, mode);
  filterModes[mode].prepare(popover, { isSameColumn, currentFilter });
  updatePopoverPosition(trigger, config.tableId);
  filterModes[mode].focus?.(popover);
}

function registerHeaderTrigger(header, config) {
  if (header.querySelector(".stat-filter-trigger")) {
    return;
  }

  const columnIndex = config.getColumnIndex(header, config.table);
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "stat-filter-trigger";
  trigger.title = "Filter this statistic";
  trigger.setAttribute("aria-label", "Filter this statistic");
  trigger.dataset.columnIndex = String(columnIndex);
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const popover = createPopover();
    const isOpen = !popover.hidden
      && popover.dataset.tableId === config.tableId
      && popover.dataset.columnIndex === String(columnIndex);

    if (isOpen) {
      hidePopover();
      return;
    }

    openPopover(trigger, header, config);
  });

  header.classList.add("has-stat-filter-trigger");
  header.appendChild(trigger);
}

export function registerStatFilterPopover({
  tableId,
  headerSelector,
  rowSelector = "tbody tr",
  storageKey = `${DEFAULT_STORAGE_PREFIX}.${tableId}`,
  getColumnIndex,
  getLabel,
  initialFilter = null,
  initialFilters = null,
  serverSide = false,
  onFilterChange,
}) {
  const table = document.getElementById(tableId);
  if (!table) {
    return;
  }

  const config = {
    tableId,
    table,
    headerSelector,
    rowSelector,
    storageKey,
    getColumnIndex,
    getLabel,
    serverSide,
    useLocalState: !serverSide,
    onFilterChange,
    state: { filters: [] },
  };

  stateByTable.set(tableId, config);
  ensureListeners();
  createPopover();

  table.querySelectorAll(headerSelector).forEach((header) => {
    if (typeof config.getColumnIndex !== "function") {
      return;
    }

    registerHeaderTrigger(header, config);
  });

  if (Array.isArray(initialFilters) && initialFilters.length) {
    config.state.filters = hydrateFiltersMetadata(config, initialFilters);
  } else if (initialFilter) {
    config.state.filters = hydrateFiltersMetadata(config, [initialFilter]);
  } else {
    restoreState(tableId);
  }
  config.state.filters = hydrateFiltersMetadata(config, config.state.filters);
  if (config.state.filters.length) {
    setActiveHeaderState(tableId, config.state.filters);
  }
  applyFilterToTable(tableId);
}

export function applyTableStatFilter(tableId) {
  applyFilterToTable(tableId);
}

export function hasActiveTableStatFilter(tableId) {
  return getConfigFilters(getConfig(tableId)).length > 0;
}

export function clearTableStatFilter(tableId, filter = null) {
  const config = getConfig(tableId);
  if (!config) {
    return;
  }

  applyConfigFilterState(
    config,
    filter ? removeFilter(getConfigFilters(config), filter) : [],
  );
}
