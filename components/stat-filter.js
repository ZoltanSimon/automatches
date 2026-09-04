const DEFAULT_STORAGE_PREFIX = "table-stat-filter";
const DEFAULT_OPERATOR = "gte";
const EPSILON = 0.0001;
const popoverSelectors = {
  title: ".stat-filter-popover__title",
  operator: '[data-role="operator"]',
  min: '[data-role="min"]',
  max: '[data-role="max"]',
  maxField: '[data-role="max-field"]',
};
const stateByTable = new Map();
let listenersInstalled = false;
let popoverElement = null;

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
  const min = Number.parseFloat(filter.min);
  const max = Number.parseFloat(filter.max);
  const target = Number.parseFloat(filter.value);

  return { min, max, target };
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
    <label class="stat-filter-popover__field">
      <span>Rule</span>
      <select class="stat-filter-popover__operator" data-role="operator">
        <option value="gte">Greater than or equal</option>
        <option value="lte">Less than or equal</option>
        <option value="between">Between</option>
        <option value="eq">Equals</option>
        <option value="neq">Does not equal</option>
      </select>
    </label>
    <div class="stat-filter-popover__range">
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
    const isBetween = operatorSelect.value === "between";
    getPopoverField(popoverElement, "maxField").style.display = isBetween ? "grid" : "none";
  };

  operatorSelect.addEventListener("change", updateRangeVisibility);
  updateRangeVisibility();

  popoverElement.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;
    const tableId = popoverElement.dataset.tableId;

    if (action === "close") {
      hidePopover();
      return;
    }

    if (action === "clear") {
      clearTableStatFilter(tableId, {
        stat: popoverElement.dataset.stat,
        columnIndex: popoverElement.dataset.columnIndex,
      });
      hidePopover();
      return;
    }

    if (action === "apply") {
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
    if (!popoverElement || popoverElement.hidden) {
      return;
    }

    if (popoverElement.contains(event.target)) {
      return;
    }

    const trigger = event.target.closest(".stat-filter-trigger");
    if (trigger) {
      return;
    }

    hidePopover();
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

  const resolvedColumnIndex = config.getColumnIndex(matchingHeader, config.table);
  const resolvedLabel = getHeaderLabel(matchingHeader, config, filter.stat);

  return {
    ...filter,
    columnIndex: Number.parseInt(resolvedColumnIndex, 10),
    label: filter.label || resolvedLabel,
  };
}

function formatFilterSummary(filter) {
  if (!filter) {
    return "";
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

  config.table
    .querySelectorAll(".stat-filter-trigger")
    .forEach((trigger) => {
      trigger.classList.remove("active");
      trigger.textContent = "";
      delete trigger.dataset.summary;
    });

  const filterList = Array.isArray(filters)
    ? filters
    : filters
      ? [filters]
      : [];

  if (!filterList.length) {
    return;
  }

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

function persistState(tableId) {
  const config = getConfig(tableId);
  if (!config?.storageKey || config.serverSide || !config.useLocalState) {
    return;
  }

  try {
    const filters = getConfigFilters(config);
    const payload = filters.length ? JSON.stringify(filters) : "";
    window.localStorage.setItem(config.storageKey, payload);
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

function getColumnIndexForPlayerHeader(header) {
  const headerCells = Array.from(header.parentElement.children);
  const headerIndex = headerCells.indexOf(header);

  return headerCells.slice(0, headerIndex).reduce((sum, th) => sum + (Number(th.colSpan) || 1), 0);
}

function getColumnIndexForTeamHeader(header, table) {
  const headerRow = header.parentElement;
  const headerCells = Array.from(headerRow.children);
  const headerIndex = headerCells.indexOf(header);
  const firstBodyRow = table.querySelector("tbody tr");
  const lastRowLength = firstBodyRow ? firstBodyRow.cells.length : headerRow.cells.length;

  return lastRowLength - headerCells.length + headerIndex;
}

function getCellValue(row, columnIndex) {
  const cell = row.cells[columnIndex];
  if (!cell) {
    return Number.NaN;
  }

  return parseNumericValue(cell.innerText);
}

function matchesFilter(value, filter) {
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

function applyFilterToTable(tableId) {
  const config = getConfig(tableId);
  if (!config) {
    return;
  }

  if (config.serverSide) {
    return;
  }

  const table = config.table;
  if (!table) {
    return;
  }

  const filters = getConfigFilters(config);
  const rows = Array.from(table.querySelectorAll(config.rowSelector));

  rows.forEach((row) => {
    if (!filters.length) {
      row.style.display = "";
      row.dataset.statFilterHidden = "false";
      return;
    }

    const isVisible = filters.every((filter) => {
      const value = getCellValue(row, filter.columnIndex);
      return matchesFilter(value, filter);
    });
    row.style.display = isVisible ? "" : "none";
    row.dataset.statFilterHidden = isVisible ? "false" : "true";
  });
}

function updatePopoverPosition(trigger, tableId) {
  const rect = trigger.getBoundingClientRect();
  const popover = createPopover();
  const estimatedWidth = 280;
  const estimatedHeight = 260;
  const padding = 8;
  const left = Math.min(window.innerWidth - estimatedWidth - padding, Math.max(padding, rect.left));
  const belowTop = rect.bottom + 8;
  const aboveTop = rect.top - estimatedHeight - 8;
  const top = belowTop + estimatedHeight <= window.innerHeight ? belowTop : Math.max(padding, aboveTop);

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
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
  if (!popoverElement) {
    return;
  }

  const tableId = popoverElement.dataset.tableId;
  const config = getConfig(tableId);
  if (!config) {
    return;
  }

  const operator = getPopoverField(popoverElement, "operator").value;
  const min = getPopoverField(popoverElement, "min").value;
  const max = getPopoverField(popoverElement, "max").value;
  const nextFilter = {
    stat: popoverElement.dataset.stat,
    label: popoverElement.dataset.label,
    columnIndex: Number.parseInt(popoverElement.dataset.columnIndex, 10),
    operator,
    min,
    max,
    value: toFilterValue(operator, min, max),
  };

  if (!validateFilterInput({ operator, min, max })) {
    return;
  }

  const nextFilters = upsertFilter(getConfigFilters(config), nextFilter);
  applyConfigFilterState(config, nextFilters);
  hidePopover();
}

function openPopover(trigger, header, config) {
  const popover = createPopover();
  const label = getHeaderLabel(header, config);
  const currentFilter = getConfigFilters(config).find(
    (filter) => String(filter?.columnIndex ?? "") === trigger.dataset.columnIndex,
  );
  const isSameColumn = currentFilter?.stat === header.dataset.stat && String(currentFilter?.columnIndex ?? "") === trigger.dataset.columnIndex;
  const minValue = isSameColumn ? (currentFilter?.min ?? "") : "";
  const maxValue = isSameColumn ? (currentFilter?.max ?? "") : "";
  const operatorValue = isSameColumn ? (currentFilter?.operator || DEFAULT_OPERATOR) : DEFAULT_OPERATOR;

  popover.hidden = false;
  popover.dataset.tableId = config.tableId;
  popover.dataset.stat = header.dataset.stat || "";
  popover.dataset.label = label;
  popover.dataset.columnIndex = String(trigger.dataset.columnIndex);
  getPopoverField(popover, "title").textContent = `Filter: ${label}`;
  getPopoverField(popover, "operator").value = operatorValue;
  getPopoverField(popover, "min").value = minValue;
  getPopoverField(popover, "max").value = maxValue;
  getPopoverField(popover, "operator").dispatchEvent(new Event("change", { bubbles: true }));

  updatePopoverPosition(trigger, config.tableId);
  getPopoverField(popover, "min").focus();
}

function registerHeaderTrigger(header, config) {
  if (header.querySelector(".stat-filter-trigger")) {
    return;
  }

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "stat-filter-trigger";
  trigger.title = "Filter this statistic";
  trigger.setAttribute("aria-label", "Filter this statistic");

  const columnIndex = config.getColumnIndex(header, config.table);
  trigger.dataset.columnIndex = String(columnIndex);

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const popover = createPopover();
    const isOpen = !popover.hidden && popover.dataset.tableId === config.tableId && popover.dataset.columnIndex === String(columnIndex);

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

  if (!filter) {
    applyConfigFilterState(config, []);
    return;
  }

  const nextFilters = removeFilter(getConfigFilters(config), filter);
  applyConfigFilterState(config, nextFilters);
}

function hydrateFiltersMetadata(config, filters) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((filter) => hydrateFilterMetadata(config, filter))
    .filter((filter) => filter && filter.stat && filter.operator && Number.isFinite(Number.parseInt(filter.columnIndex, 10)));
}