import { CURRENT_SEASON } from "../shared/defaults.js";
import {
  showMatchesOnDate,
  download,
  showToast,
  addLeagues,
  selectedLeagues,
  copyText,
  copyToClipboard,
} from "../common-functions.js";
import { matchesToCanvas, matchList } from "../components/match-list.js";
import { make_base, drawPastedImage } from "../instapics.js";
import {
  standingsToCanvas,
  leagueStandings
} from "../components/league-standings.js";
import { addText, buildResults } from "../autotext.js";
import { playerGoalList, playerListToCanvas } from "../components/player-list.js";
import { oneFixture } from "../components/match-details.js";
import { addMatchStats, matchStatsToCanvas } from "../components/match-statistics.js";
import { addSquad } from "../../components/team-squad.js";

const allLeagues = window.allLeagues || [];
const leagueById = new Map(allLeagues.map((league) => [Number(league.id), league]));
const selectedLeagueSeasons = new Map();
const seasonSelect = document.getElementById("league-season-select");
const seasonTarget = document.getElementById("league-season-target");
let activeLeagueID = null;

function getLeagueSeasons(leagueID) {
  const league = leagueById.get(Number(leagueID));
  if (!league) {
    return [];
  }

  const seasons = Array.isArray(league.seasons) && league.seasons.length > 0
    ? league.seasons
    : [league.season];

  return [...new Set(
    seasons
      .map((season) => Number(season))
      .filter((season) => !Number.isNaN(season))
  )].sort((a, b) => b - a);
}

function getStoredSeason(leagueID) {
  const normalizedLeagueID = Number(leagueID);
  if (!selectedLeagueSeasons.has(normalizedLeagueID)) {
    const [defaultSeason] = getLeagueSeasons(normalizedLeagueID);
    if (defaultSeason) {
      selectedLeagueSeasons.set(normalizedLeagueID, defaultSeason);
    }
  }

  return selectedLeagueSeasons.get(normalizedLeagueID) ?? "";
}

function renderSeasonOptions(leagueID) {
  const normalizedLeagueID = Number(leagueID);
  const league = leagueById.get(normalizedLeagueID);
  const seasons = getLeagueSeasons(normalizedLeagueID);

  seasonSelect.innerHTML = "";

  if (!league || seasons.length === 0) {
    seasonSelect.disabled = true;
    seasonTarget.textContent = "No league selected";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Select a league";
    seasonSelect.append(emptyOption);
    return;
  }

  seasonSelect.disabled = false;
  seasonTarget.textContent = league.name;
  const selectedSeason = String(getStoredSeason(normalizedLeagueID));

  for (const season of seasons) {
    const option = document.createElement("option");
    option.value = String(season);
    option.textContent = String(season);
    option.selected = option.value === selectedSeason;
    seasonSelect.append(option);
  }
}

function renderSelectedSummary() {
  const summary = document.getElementById("admin-selected-summary");
  if (!summary) {
    return;
  }

  const names = selectedLeagues.map((leagueID) => leagueById.get(Number(leagueID))?.name || String(leagueID));
  if (names.length === 0) {
    summary.textContent = "None selected";
    return;
  }

  const shown = names.slice(0, 3).join(", ");
  summary.textContent = names.length > 3 ? `${shown} (+${names.length - 3})` : shown;
}

function setActiveLeague(leagueID) {
  const normalizedLeagueID = Number(leagueID);
  activeLeagueID = leagueID === null || Number.isNaN(normalizedLeagueID) ? null : normalizedLeagueID;
  renderSeasonOptions(activeLeagueID);
  renderSelectedSummary();
}

seasonSelect.addEventListener("change", () => {
  if (activeLeagueID === null) {
    return;
  }

  selectedLeagueSeasons.set(activeLeagueID, Number(seasonSelect.value));
});

// ---------- Activity log + action helper ----------

const ADMIN_LOG_MAX_ENTRIES = 200;
const ADMIN_LOG_MAX_JSON_CHARS = 20000;
const adminLog = document.getElementById("admin-log");

const LOG_KINDS = {
  click: { className: " is-click", badge: "BTN" },
  api: { className: " is-api", badge: "API" },
};

function logActivity({ label, ok = true, summary = "", data, elapsedMs, kind }) {
  if (!adminLog) {
    return;
  }

  adminLog.querySelector(".admin-log-empty")?.remove();

  const kindStyle = LOG_KINDS[kind];
  const entry = document.createElement("details");
  entry.className = `admin-log-entry${ok ? kindStyle?.className ?? "" : " is-error"}`;

  const head = document.createElement("summary");
  const time = document.createElement("span");
  time.className = "admin-log-time";
  time.textContent = new Date().toLocaleTimeString();
  const badge = document.createElement("span");
  badge.className = "admin-log-badge";
  badge.textContent = ok ? kindStyle?.badge ?? "OK" : "ERR";
  const labelEl = document.createElement("span");
  labelEl.className = "admin-log-label";
  labelEl.textContent = label;
  const summaryEl = document.createElement("span");
  summaryEl.textContent = `${summary}${elapsedMs !== undefined ? ` (${(elapsedMs / 1000).toFixed(1)}s)` : ""}`;
  head.append(time, badge, labelEl, summaryEl);
  entry.append(head);

  if (data !== undefined) {
    let json;
    try {
      json = JSON.stringify(data, null, 2);
    } catch {
      json = String(data);
    }
    const pre = document.createElement("pre");
    pre.textContent = json.length > ADMIN_LOG_MAX_JSON_CHARS
      ? `${json.slice(0, ADMIN_LOG_MAX_JSON_CHARS)}\n… truncated (${json.length} chars)`
      : json;
    entry.append(pre);
  }

  adminLog.prepend(entry);
  while (adminLog.children.length > ADMIN_LOG_MAX_ENTRIES) {
    adminLog.lastElementChild.remove();
  }
}

document.getElementById("admin-log-clear")?.addEventListener("click", (event) => {
  event.preventDefault();
  adminLog.innerHTML = `<div class="admin-muted admin-log-empty">Nothing yet.</div>`;
});

// Every /api/ call on this page is logged, including ones made inside shared components.
// Callers that write their own, more specific log entry pass { [SKIP_ACTIVITY_LOG]: true }.
const SKIP_ACTIVITY_LOG = Symbol("skipActivityLog");
const nativeFetch = window.fetch.bind(window);

function summarizeApiResponse(status, data) {
  if (Array.isArray(data)) {
    return `HTTP ${status} · ${data.length} item(s)`;
  }
  if (data && typeof data === "object") {
    if (data.message) {
      return `HTTP ${status} · ${data.message}`;
    }
    if ("savedCount" in data && "requested" in data) {
      return `HTTP ${status} · saved ${data.savedCount}/${data.requested}`;
    }
    if ("count" in data) {
      return `HTTP ${status} · count ${data.count}`;
    }
  }
  return `HTTP ${status}`;
}

window.fetch = async function (input, init = {}) {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  const path = url.replace(window.location.origin, "");
  if (!path.startsWith("/api/") || init?.[SKIP_ACTIVITY_LOG]) {
    return nativeFetch(input, init);
  }

  const method = (init?.method || "GET").toUpperCase();
  const label = `${method} ${decodeURIComponent(path).slice(0, 140)}`;
  const startedAt = performance.now();

  let response;
  try {
    response = await nativeFetch(input, init);
  } catch (error) {
    logActivity({ label, ok: false, summary: error.message, elapsedMs: performance.now() - startedAt, kind: "api" });
    throw error;
  }

  const elapsedMs = performance.now() - startedAt;
  response.clone().json()
    .then((data) => {
      logActivity({
        label,
        ok: response.ok && data?.success !== false,
        summary: summarizeApiResponse(response.status, data),
        data,
        elapsedMs,
        kind: "api",
      });
    })
    .catch(() => {
      logActivity({ label, ok: response.ok, summary: `HTTP ${response.status}`, elapsedMs, kind: "api" });
    });

  return response;
};

// Button presses are logged in the capture phase, so they appear before whatever the handler does
document.getElementById("admin-page")?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled || button.id === "admin-log-clear") {
    return;
  }

  const text = (button.firstChild?.textContent || button.textContent).trim() || button.title || button.id;
  const matchSuffix = button.dataset.matchId ? ` (match ${button.dataset.matchId})` : "";
  logActivity({ label: `${text}${matchSuffix}`, summary: "", kind: "click" });
}, true);

window.addEventListener("error", (event) => {
  logActivity({ label: "Script error", ok: false, summary: event.message || String(event.error) });
});

window.addEventListener("unhandledrejection", (event) => {
  logActivity({ label: "Unhandled promise rejection", ok: false, summary: event.reason?.message || String(event.reason) });
});

/**
 * Runs a JSON API call for a button: optional confirm, busy state, activity log entry and toast.
 * Returns the parsed response on success, or null on failure/cancel.
 */
async function runAction(button, { label, url, method = "GET", body, confirmText, summarize, toastSuccess = true }) {
  if (confirmText && !window.confirm(confirmText)) {
    return null;
  }

  if (button) {
    button.disabled = true;
    button.classList.add("is-busy");
  }
  const startedAt = performance.now();

  try {
    const response = await fetch(url, body === undefined
      ? { method, [SKIP_ACTIVITY_LOG]: true }
      : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), [SKIP_ACTIVITY_LOG]: true });
    const data = await response.json().catch(() => null);
    const elapsedMs = performance.now() - startedAt;

    if (!response.ok || data?.success === false) {
      const message = data?.message || `${label} failed (HTTP ${response.status}).`;
      logActivity({ label, ok: false, summary: message, data, elapsedMs });
      showToast(message, "error");
      return null;
    }

    let summary = "Done.";
    try {
      summary = summarize ? summarize(data) : summary;
    } catch (error) {
      console.warn(`${label}: could not summarize response`, error);
    }
    logActivity({ label, ok: true, summary, data, elapsedMs });
    if (toastSuccess) {
      showToast(`${label}: ${summary}`, "success");
    }
    return data;
  } catch (error) {
    console.error(`${label} failed:`, error);
    logActivity({ label, ok: false, summary: error.message, elapsedMs: performance.now() - startedAt });
    showToast(error.message || `${label} failed.`, "error");
    return null;
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove("is-busy");
    }
  }
}

function requireInput(id, message) {
  const value = document.getElementById(id)?.value.trim() ?? "";
  if (!value) {
    showToast(message, "error");
  }
  return value;
}

function onClick(id, handler) {
  const element = document.getElementById(id);
  if (element) {
    element.onclick = (event) => handler(event.currentTarget, event);
  }
}

// ---------- Remembered UI state (open groups, graphics column) ----------

const ADMIN_UI_STATE_KEY = "gf-admin-ui";

function readUiState() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_UI_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeUiState(patch) {
  try {
    localStorage.setItem(ADMIN_UI_STATE_KEY, JSON.stringify({ ...readUiState(), ...patch }));
  } catch {
    // storage unavailable, state just isn't remembered
  }
}

const adminGrid = document.getElementById("admin-grid");
const toggleGraphicsButton = document.getElementById("toggle-graphics");

function setGraphicsCollapsed(collapsed) {
  adminGrid?.classList.toggle("graphics-collapsed", collapsed);
  if (toggleGraphicsButton) {
    toggleGraphicsButton.textContent = collapsed ? "Show" : "Hide";
  }
}

{
  const uiState = readUiState();
  const openGroups = uiState.openGroups || {};
  document.querySelectorAll("details[data-persist][id]").forEach((details) => {
    if (details.id in openGroups) {
      details.open = Boolean(openGroups[details.id]);
    }
    details.addEventListener("toggle", () => {
      writeUiState({ openGroups: { ...(readUiState().openGroups || {}), [details.id]: details.open } });
    });
  });

  setGraphicsCollapsed(Boolean(uiState.graphicsCollapsed));
  toggleGraphicsButton?.addEventListener("click", () => {
    const collapsed = !adminGrid.classList.contains("graphics-collapsed");
    setGraphicsCollapsed(collapsed);
    writeUiState({ graphicsCollapsed: collapsed });
  });
}

// ---------- Matches on a date ----------

function toIsoDay(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const matchesDateInput = document.getElementById("matches-date");
if (matchesDateInput) {
  matchesDateInput.value = toIsoDay(new Date());
}

onClick("show-matches-on-date", async () => {
  const day = requireInput("matches-date", "Pick a date first.");
  if (!day) {
    return;
  }
  document.getElementById("fixtures-info").innerHTML = "";
  await showMatchesOnDate(day, true);
});

onClick("refetch-day", async (button) => {
  const day = requireInput("matches-date", "Pick a date first.");
  if (!day) {
    return;
  }
  await runAction(button, {
    label: `Refetch day ${day}`,
    url: `/api/refetch-day?date=${encodeURIComponent(day)}`,
    confirmText: `Refetch every tracked fixture on ${day} from the API?`,
    summarize: (data) => `Saved ${data.savedCount}/${data.requested} matches.`,
  });
});

await showMatchesOnDate(new Date(), true);
addLeagues("admin", true);

document.querySelectorAll(".admin-league-to-select").forEach((element) => {
  element.addEventListener("click", () => {
    const leagueID = Number(element.id.replace("img-", ""));
    if (selectedLeagues.includes(leagueID)) {
      setActiveLeague(leagueID);
    } else {
      const fallbackLeagueID = selectedLeagues[0] ?? null;
      setActiveLeague(fallbackLeagueID);
    }

    const missingXgPanel = document.getElementById("missing-xg-panel");
    if (missingXgPanel && !missingXgPanel.hidden) {
      applyMissingXgFilters();
    }
  });
});

const matchListDiv = document.getElementById("match-list");
if (matchListDiv) {
  matchListDiv.style.visibility = "visible";
}

function selectLeagueElements(leagueElements) {
  document.querySelectorAll("#league-list .admin-league-to-select").forEach((element) => {
    element.classList.remove("selected-league");
  });

  selectedLeagues.length = 0;
  for (const league of leagueElements) {
    league.classList.add("selected-league");
    const leagueID = Number(league.id.split("img-")[1]);
    if (!Number.isFinite(leagueID)) {
      continue;
    }
    selectedLeagues.push(leagueID);
    getStoredSeason(leagueID);
  }

  setActiveLeague(selectedLeagues[0] ?? null);
  const missingXgPanel = document.getElementById("missing-xg-panel");
  if (missingXgPanel && !missingXgPanel.hidden) {
    applyMissingXgFilters();
  }
}

function groupImagesIntoRows(images) {
  const rows = [];
  for (const image of images) {
    const top = image.getBoundingClientRect().top;
    const existing = rows.find((row) => Math.abs(row.top - top) <= 8);
    if (existing) {
      existing.images.push(image);
      continue;
    }
    rows.push({ top, images: [image] });
  }
  return rows;
}

function addLeagueRowSelectButtons() {
  const containers = ["league-list-league", "league-list-cup", "league-list-nt"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  // Fill the picker width left over by the season panel, minus room for each row's Select button
  const toolbar = document.querySelector(".admin-league-toolbar");
  const sidePanel = document.querySelector(".admin-league-side");
  const availableWidth = (toolbar?.clientWidth ?? 0) - (sidePanel?.offsetWidth ?? 0) - 16 - 70;
  const iconRowWidth = Math.max(450, availableWidth);

  for (const container of containers) {
    container.style.width = `${iconRowWidth}px`;
  }
  document.getElementById("league-list")?.getBoundingClientRect();

  const plans = containers.map((container) => ({
    container,
    rows: groupImagesIntoRows([...container.querySelectorAll("img.admin-league-to-select")]),
  }));

  for (const { container, rows } of plans) {
    container.style.width = "";
    const rowElements = rows
      .filter((row) => row.images.length > 0)
      .map((row) => {
        const rowEl = document.createElement("div");
        rowEl.className = "admin-league-row";
        rowEl.append(...row.images);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "select-league-row";
        button.textContent = "Select";
        button.title = "Select this row";
        button.addEventListener("click", () => {
          selectLeagueElements(row.images);
        });
        rowEl.append(button);
        return rowEl;
      });

    container.replaceChildren(...rowElements);
  }
}

await Promise.all(
  [...document.querySelectorAll("#league-list img.admin-league-to-select")].map((img) => {
    if (img.complete) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }),
);
{
  // Rows are built from measured icon positions, so the picker must be open while measuring
  const leaguePicker = document.getElementById("admin-league-picker");
  const wasOpen = leaguePicker?.open ?? true;
  if (leaguePicker && !wasOpen) {
    leaguePicker.open = true;
  }
  addLeagueRowSelectButtons();
  if (leaguePicker && !wasOpen) {
    leaguePicker.open = false;
  }
}

document.getElementById("select-all-leagues").onclick = function () {
  const allTheLeagues = document
    .getElementById("league-list")
    .querySelectorAll("img");
  selectLeagueElements([...allTheLeagues].slice(0, 10));
};

onClick("clear-leagues", () => {
  selectLeagueElements([]);
});

function requireSelectedLeague(action) {
  const leagueID = selectedLeagues[0];
  if (!leagueID) {
    showToast(`Select a league before ${action}.`, "error");
  }
  return leagueID;
}

onClick("submit-league-info", async () => {
  const leagueID = requireSelectedLeague("loading standings");
  if (leagueID) {
    await leagueStandings(leagueID);
  }
});

function roundLabelFor(leagueID, roundNumber) {
  return Number(leagueID) !== 2 ? `Regular Season - ${roundNumber}` : `League Stage - ${roundNumber}`;
}

onClick("get-matches-by-round", async (button) => {
  const leagueID = requireSelectedLeague("loading a round");
  const roundNumber = leagueID && requireInput("roundnr", "Enter a round number first.");
  if (!leagueID || !roundNumber) {
    return;
  }

  const matches = await runAction(button, {
    label: `Round ${roundNumber} (league ${leagueID})`,
    url: `/api/get-matches-by-round?leagueID=${leagueID}&roundNo=${encodeURIComponent(roundNumber)}`,
    summarize: (data) => `${data.length} match(es).`,
    toastSuccess: false,
  });
  if (!Array.isArray(matches) || matches.length === 0) {
    if (matches) {
      showToast(`No matches found for round ${roundNumber}.`, "error");
    }
    return;
  }

  matchList(matches, true);
  addText(matches);
  buildResults(matches);
});

onClick("refetch-round", async (button) => {
  const leagueID = requireSelectedLeague("refetching a round");
  const roundNumber = leagueID && requireInput("roundnr", "Enter a round number first.");
  if (!leagueID || !roundNumber) {
    return;
  }

  const season = getStoredSeason(leagueID) || CURRENT_SEASON;
  const roundLabel = roundLabelFor(leagueID, roundNumber);
  await runAction(button, {
    label: `Refetch round ${roundNumber} (league ${leagueID}, ${season})`,
    url: `/api/refetch-round?leagueID=${leagueID}&season=${season}&round=${encodeURIComponent(roundLabel)}`,
    confirmText: `Refetch "${roundLabel}" for league ${leagueID}, season ${season} from the API?`,
    summarize: (data) => `Saved ${data.savedCount}/${data.requested} matches.`,
  });
});

function formatMissingXgDate(value) {
  if (!value) {
    return "";
  }

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toISOString().slice(0, 10);
}

function formatXgValue(value) {
  if (value === null || value === undefined || value === "") {
    return "–";
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
}

const MISSING_XG_MAX_SELECTION = 20;
const MISSING_XG_MAX_AGE_MONTHS = 6;
let hideOldMissingXg = false;

function missingXgCutoffDate() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MISSING_XG_MAX_AGE_MONTHS);
  return cutoff;
}

function isMissingXgOlderThanCutoff(value, cutoff = missingXgCutoffDate()) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date < cutoff;
}

function setMissingXgStatus(cell, text, kind) {
  cell.textContent = text;
  cell.className = `missing-xg-status${kind ? ` is-${kind}` : ""}`;
}

function getMissingXgCheckboxes() {
  return [...document.querySelectorAll("#missing-xg-table tbody input[type='checkbox'][data-match-id]")]
    .filter((checkbox) => !checkbox.closest("tr")?.hidden);
}

function getSelectedMissingXgIds() {
  return getMissingXgCheckboxes()
    .filter((checkbox) => checkbox.checked && !checkbox.disabled)
    .map((checkbox) => checkbox.dataset.matchId);
}

function getVisuallySelectedLeagueIds() {
  return [...document.querySelectorAll("#league-list .admin-league-to-select.selected-league")]
    .map((element) => Number(element.id.replace("img-", "")))
    .filter((leagueID) => Number.isFinite(leagueID) && leagueID > 0);
}

function syncMissingXgLeagueSelection(leagueIds) {
  const ids = [...new Set(
    (Array.isArray(leagueIds) ? leagueIds : [])
      .map((leagueID) => Number(leagueID))
      .filter((leagueID) => Number.isFinite(leagueID) && leagueID > 0),
  )];
  const selected = new Set(ids);

  document.querySelectorAll("#league-list .admin-league-to-select").forEach((element) => {
    const leagueID = Number(element.id.replace("img-", ""));
    element.classList.toggle("selected-league", selected.has(leagueID));
  });

  selectedLeagues.length = 0;
  selectedLeagues.push(...ids);
  setActiveLeague(selectedLeagues[0] ?? null);
}

function applyMissingXgFilters() {
  const tbody = document.querySelector("#missing-xg-table tbody");
  const countEl = document.getElementById("missing-xg-count");
  const hideOldButton = document.getElementById("missing-xg-hide-old");
  if (!tbody) {
    return;
  }

  const cutoff = missingXgCutoffDate();
  const selectedLeagueIds = new Set(getVisuallySelectedLeagueIds());
  const rows = [...tbody.querySelectorAll("tr[data-match-id]")];
  let visibleCount = 0;

  for (const row of rows) {
    const hideByAge = hideOldMissingXg && isMissingXgOlderThanCutoff(row.dataset.fixtureDate, cutoff);
    const hideByLeague = !selectedLeagueIds.has(Number(row.dataset.leagueId));
    const hide = hideByAge || hideByLeague;
    row.hidden = hide;
    if (hide) {
      const checkbox = row.querySelector("input[type='checkbox'][data-match-id]");
      if (checkbox && !checkbox.disabled) {
        checkbox.checked = false;
      }
    } else {
      visibleCount += 1;
    }
  }

  if (countEl) {
    countEl.textContent = visibleCount === rows.length
      ? `(${rows.length})`
      : `(${visibleCount} of ${rows.length})`;
  }

  if (hideOldButton) {
    hideOldButton.textContent = hideOldMissingXg
      ? "Show older than 6 months"
      : "Hide older than 6 months";
  }

  updateMissingXgSelectionUi();
}

function updateMissingXgSelectionUi() {
  const selectedCount = getSelectedMissingXgIds().length;
  const refetchSelectedButton = document.getElementById("missing-xg-refetch-selected");
  const fetchXgSelectedButton = document.getElementById("missing-xg-fetch-xg-selected");
  const hint = document.getElementById("missing-xg-selection-hint");

  if (refetchSelectedButton) {
    refetchSelectedButton.textContent = `Refetch selected (${selectedCount})`;
    refetchSelectedButton.disabled = selectedCount === 0;
  }

  if (fetchXgSelectedButton) {
    fetchXgSelectedButton.textContent = `Fetch xG selected (${selectedCount})`;
    fetchXgSelectedButton.disabled = selectedCount === 0;
  }

  if (hint) {
    hint.textContent = selectedCount >= MISSING_XG_MAX_SELECTION
      ? `${MISSING_XG_MAX_SELECTION} selected (max)`
      : `${selectedCount} selected · max ${MISSING_XG_MAX_SELECTION}`;
  }
}

function markMissingXgRowComplete(row, homeXg, awayXg) {
  const statusCell = row?.querySelector(".missing-xg-status");
  const refetchButton = row?.querySelector("button[data-action='refetch']");
  const saveButton = row?.querySelector("button[data-action='save-xg']");
  const checkbox = row?.querySelector("input[type='checkbox'][data-match-id]");
  const homeInput = row?.querySelector("input[data-side='home']");
  const awayInput = row?.querySelector("input[data-side='away']");

  if (statusCell) {
    setMissingXgStatus(
      statusCell,
      `Saved · xG ${formatXgValue(homeXg)}–${formatXgValue(awayXg)}`,
      "success",
    );
  }
  if (refetchButton) {
    refetchButton.textContent = "Done";
    refetchButton.disabled = true;
  }
  const fetchButton = row?.querySelector("button[data-action='fetch-xg']");
  if (fetchButton) {
    fetchButton.disabled = true;
  }
  if (saveButton) {
    saveButton.disabled = true;
  }
  if (checkbox) {
    checkbox.checked = false;
    checkbox.disabled = true;
  }
  if (homeInput) {
    homeInput.value = formatXgValue(homeXg);
    homeInput.disabled = true;
  }
  if (awayInput) {
    awayInput.value = formatXgValue(awayXg);
    awayInput.disabled = true;
  }
}

async function saveManualMissingXg(row, matchId) {
  const homeInput = row?.querySelector("input[data-side='home']");
  const awayInput = row?.querySelector("input[data-side='away']");
  const homeXg = homeInput?.value;
  const awayXg = awayInput?.value;

  const response = await fetch("/api/set-match-xg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchID: matchId, homeXg, awayXg }),
  });
  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to save xG.");
  }

  markMissingXgRowComplete(row, result.home, result.away);
  return result;
}

function applyExternalXgResult(row, result) {
  const statusCell = row?.querySelector(".missing-xg-status");
  const refetchButton = row?.querySelector("button[data-action='refetch']");
  const fetchButton = row?.querySelector("button[data-action='fetch-xg']");
  const saveButton = row?.querySelector("button[data-action='save-xg']");
  const homeInput = row?.querySelector("input[data-side='home']");
  const awayInput = row?.querySelector("input[data-side='away']");

  if (fetchButton) {
    fetchButton.disabled = false;
  }
  if (saveButton && saveButton.textContent !== "Done") {
    saveButton.disabled = false;
  }
  if (refetchButton && refetchButton.textContent !== "Done") {
    refetchButton.disabled = false;
  }

  if (!result?.ok) {
    if (statusCell) {
      setMissingXgStatus(statusCell, result?.error || "No xG found", "warn");
    }
    return { found: false };
  }

  if (homeInput) {
    homeInput.value = formatXgValue(result.home);
  }
  if (awayInput) {
    awayInput.value = formatXgValue(result.away);
  }
  if (statusCell) {
    setMissingXgStatus(
      statusCell,
      result.fotmobSaved
        ? `FotMob xG saved · ${formatXgValue(result.home)}–${formatXgValue(result.away)}`
        : `FotMob ${formatXgValue(result.home)}–${formatXgValue(result.away)} · review & Save`,
      "success",
    );
  }
  if (result.fotmobSaved) {
    const checkbox = row?.querySelector("input[type='checkbox'][data-match-id]");
    if (checkbox) {
      checkbox.checked = false;
      checkbox.disabled = true;
    }
    if (fetchButton) {
      fetchButton.disabled = true;
    }
  }
  return { found: true };
}

async function fetchExternalXgMatches(matchIds, fotmobID = "", { skipActivityLog = false } = {}) {
  const ids = [...new Set((matchIds || []).map(String).filter(Boolean))].slice(0, MISSING_XG_MAX_SELECTION);
  if (ids.length === 0) {
    throw new Error("Select at least one match.");
  }

  const response = await fetch("/api/fetch-xg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fotmobID ? { matchIDs: ids, fotmobID } : { matchIDs: ids }),
    [SKIP_ACTIVITY_LOG]: skipActivityLog,
  });
  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to fetch xG.");
  }

  return result;
}

function applyMissingXgGrabResult(row, result, matchId) {
  const statusCell = row?.querySelector(".missing-xg-status");
  const refetchButton = row?.querySelector("button[data-action='refetch']");
  const fetchButton = row?.querySelector("button[data-action='fetch-xg']");
  const saveButton = row?.querySelector("button[data-action='save-xg']");
  if (!statusCell) {
    return { saved: false, hasXg: false };
  }

  const savedIds = new Set((result.saved || []).map(String));
  const failed = (result.failed || []).find((entry) => String(entry.fixtureID) === String(matchId));
  const saved = savedIds.has(String(matchId));
  const xgInfo = Array.isArray(result.xg)
    ? result.xg.find((entry) => Number(entry.matchId) === Number(matchId))
    : null;
  const hasXg = Boolean(xgInfo?.hasXg);

  if (!saved) {
    setMissingXgStatus(statusCell, `Failed (${failed?.error || "not saved"})`, "error");
    if (refetchButton) {
      refetchButton.disabled = false;
    }
    if (saveButton) {
      saveButton.disabled = false;
    }
    if (fetchButton) {
      fetchButton.disabled = false;
    }
    return { saved: false, hasXg: false };
  }

  if (hasXg) {
    markMissingXgRowComplete(row, xgInfo.home, xgInfo.away);
    return { saved: true, hasXg: true };
  }

  setMissingXgStatus(statusCell, "Saved · still no xG", "warn");
  if (refetchButton) {
    refetchButton.disabled = false;
  }
  if (saveButton) {
    saveButton.disabled = false;
  }
  if (fetchButton) {
    fetchButton.disabled = false;
  }
  return { saved: true, hasXg: false };
}

async function refetchMissingXgMatches(matchIds) {
  const ids = [...new Set((matchIds || []).map(String).filter(Boolean))].slice(0, MISSING_XG_MAX_SELECTION);
  if (ids.length === 0) {
    throw new Error("Select at least one match.");
  }

  const response = await fetch(
    `/api/grab-match-info?matchIDs=${encodeURIComponent(ids.join(","))}&includeMatches=1`,
  );
  const result = await response.json();

  if (!response.ok && Number(result.savedCount || 0) === 0) {
    throw new Error(result.message || "Failed to refetch matches.");
  }

  return result;
}

function renderMissingXgMatches(matches) {
  const panel = document.getElementById("missing-xg-panel");
  const countEl = document.getElementById("missing-xg-count");
  const tbody = document.querySelector("#missing-xg-table tbody");
  if (!panel || !tbody) {
    return;
  }

  tbody.innerHTML = "";
  const rows = Array.isArray(matches) ? matches : [];
  countEl.textContent = `(${rows.length})`;
  panel.hidden = false;

  if (rows.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="9">No finished current-season matches are missing xG.</td>`;
    tbody.append(emptyRow);
    updateMissingXgSelectionUi();
    return;
  }

  for (const match of rows) {
    const matchId = Number(match.fixtureId);
    const tr = document.createElement("tr");
    tr.dataset.matchId = String(matchId);
    const fixtureDate = new Date(match.fixtureDate);
    tr.dataset.fixtureDate = Number.isNaN(fixtureDate.getTime()) ? "" : fixtureDate.toISOString();
    tr.dataset.leagueId = String(Number(match.leagueId) || "");

    const selectTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.matchId = String(matchId);
    checkbox.setAttribute("aria-label", `Select match ${matchId}`);
    selectTd.append(checkbox);

    const dateTd = document.createElement("td");
    dateTd.textContent = formatMissingXgDate(match.fixtureDate);

    const leagueTd = document.createElement("td");
    leagueTd.textContent = match.leagueName || match.leagueId || "";
    leagueTd.title = match.leagueRound || "";

    const matchTd = document.createElement("td");
    matchTd.textContent = `${match.homeTeamName} – ${match.awayTeamName}`;

    const scoreTd = document.createElement("td");
    scoreTd.textContent = `${match.homeGoals ?? ""}–${match.awayGoals ?? ""}`;
    scoreTd.style.textAlign = "center";

    const homeXgTd = document.createElement("td");
    const homeXgInput = document.createElement("input");
    homeXgInput.type = "number";
    homeXgInput.min = "0";
    homeXgInput.max = "20";
    homeXgInput.step = "0.01";
    homeXgInput.className = "missing-xg-input";
    homeXgInput.dataset.side = "home";
    homeXgInput.setAttribute("aria-label", `Home xG for match ${matchId}`);
    homeXgTd.append(homeXgInput);

    const awayXgTd = document.createElement("td");
    const awayXgInput = document.createElement("input");
    awayXgInput.type = "number";
    awayXgInput.min = "0";
    awayXgInput.max = "20";
    awayXgInput.step = "0.01";
    awayXgInput.className = "missing-xg-input";
    awayXgInput.dataset.side = "away";
    awayXgInput.setAttribute("aria-label", `Away xG for match ${matchId}`);
    awayXgTd.append(awayXgInput);

    const fotmobTd = document.createElement("td");
    const fotmobInput = document.createElement("input");
    fotmobInput.type = "text";
    fotmobInput.className = "missing-xg-fotmob-input";
    fotmobInput.dataset.role = "fotmob-id";
    fotmobInput.placeholder = "auto";
    fotmobInput.setAttribute("aria-label", `FotMob match URL or ID for match ${matchId}`);
    fotmobTd.append(fotmobInput);

    const actionTd = document.createElement("td");
    actionTd.className = "missing-xg-actions";
    const refetchButton = document.createElement("button");
    refetchButton.type = "button";
    refetchButton.textContent = "Refetch";
    refetchButton.dataset.matchId = String(matchId);
    refetchButton.dataset.action = "refetch";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save xG";
    saveButton.dataset.matchId = String(matchId);
    saveButton.dataset.action = "save-xg";
    const fetchButton = document.createElement("button");
    fetchButton.type = "button";
    fetchButton.textContent = "Fetch xG";
    fetchButton.dataset.matchId = String(matchId);
    fetchButton.dataset.action = "fetch-xg";
    actionTd.append(refetchButton, fetchButton, saveButton);

    const statusTd = document.createElement("td");
    setMissingXgStatus(
      statusTd,
      match.missingDetails ? "No details yet" : "No xG yet",
    );

    tr.append(selectTd, dateTd, leagueTd, matchTd, scoreTd, homeXgTd, awayXgTd, fotmobTd, actionTd, statusTd);
    tbody.append(tr);
  }

  syncMissingXgLeagueSelection(rows.map((match) => match.leagueId));
  applyMissingXgFilters();
}

const matchesMissingXgButton = document.getElementById("matches-missing-xg");
if (matchesMissingXgButton) {
  matchesMissingXgButton.onclick = async function () {
    matchesMissingXgButton.disabled = true;
    try {
      const response = await fetch(`/api/matches-missing-xg?season=${CURRENT_SEASON}`, { [SKIP_ACTIVITY_LOG]: true });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        logActivity({ label: "Missing xG", ok: false, summary: data.message || "Failed to load.", data });
        showToast(data.message || "Failed to load matches missing xG.", "error");
        return;
      }

      renderMissingXgMatches(data.matches);
      logActivity({ label: "Missing xG", summary: `${data.count} match(es) without xG in season ${data.season}.` });
      showToast(`Found ${data.count} match(es) without xG in season ${data.season}.`, "success");
    } catch (error) {
      console.error("Failed to load matches missing xG:", error);
      logActivity({ label: "Missing xG", ok: false, summary: error.message });
      showToast(error.message || "Failed to load matches missing xG.", "error");
    } finally {
      matchesMissingXgButton.disabled = false;
    }
  };
}

const fotmobLinkButton = document.getElementById("fotmob-link-fetch");
if (fotmobLinkButton) {
  fotmobLinkButton.onclick = async function () {
    const matchId = document.getElementById("fotmob-link-match-id")?.value.trim();
    const fotmobID = document.getElementById("fotmob-link-input")?.value.trim();
    if (!matchId || !fotmobID) {
      showToast("Enter both the match ID and the FotMob match URL or ID.");
      return;
    }

    fotmobLinkButton.disabled = true;
    try {
      const result = await fetchExternalXgMatches([matchId], fotmobID, { skipActivityLog: true });
      const lookup = (result.results || [])[0];
      const label = lookup?.sourceMatch ? ` (${lookup.sourceMatch})` : "";
      logActivity({
        label: `FotMob ${matchId}`,
        ok: Boolean(lookup?.fotmobSaved),
        summary: lookup?.fotmobSaved
          ? `Saved${label}${lookup.ok ? `, xG ${formatXgValue(lookup.home)}–${formatXgValue(lookup.away)}` : ""}`
          : lookup?.error || "Nothing saved.",
        data: result,
      });
      if (!lookup?.fotmobSaved) {
        showToast(lookup?.error || `Nothing saved for match ${matchId}.`);
      } else if (lookup.warning) {
        showToast(`Saved, but ${lookup.warning.toLowerCase()}${label}`);
      } else if (lookup.ok) {
        showToast(`Saved FotMob data for match ${matchId}${label}: xG ${formatXgValue(lookup.home)}–${formatXgValue(lookup.away)}`, "success");
      } else {
        showToast(`Saved FotMob player data for match ${matchId}${label}, but ${lookup.error.toLowerCase()}`);
      }
    } catch (error) {
      console.error("Failed to fetch FotMob by ID:", error);
      logActivity({ label: `FotMob ${matchId}`, ok: false, summary: error.message });
      showToast(error.message || "Failed to fetch FotMob data.", "error");
    } finally {
      fotmobLinkButton.disabled = false;
    }
  };
}

const fotmobBackfillSeasonSelect = document.getElementById("fotmob-backfill-season");
const fotmobBackfillCountButton = document.getElementById("fotmob-backfill-count");
const fotmobBackfillStartButton = document.getElementById("fotmob-backfill-start");
const fotmobBackfillStopButton = document.getElementById("fotmob-backfill-stop");
const fotmobBackfillStatus = document.getElementById("fotmob-backfill-status");
let fotmobBackfillPollTimer = null;

function fotmobBackfillSeasonLabel(season) {
  return season === "all" ? "all seasons" : `season ${season}`;
}

// Logged by the callers instead of the fetch wrapper, so the 3s status poll doesn't flood the log
async function fotmobBackfillRequest(path, options = {}) {
  const response = await fetch(`/api/fotmob-backfill/${path}`, { ...options, [SKIP_ACTIVITY_LOG]: true });
  const result = await response.json();
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "FotMob backfill request failed.");
  }
  return result;
}

function renderFotmobBackfillStatus(status) {
  const running = Boolean(status?.running);
  fotmobBackfillStartButton.disabled = running;
  fotmobBackfillCountButton.disabled = running;
  fotmobBackfillSeasonSelect.disabled = running;
  fotmobBackfillStopButton.disabled = !running || Boolean(status?.stopping);

  if (!status?.startedAt) {
    fotmobBackfillStatus.textContent = "";
    return;
  }

  const progress = `${status.processed}/${status.total} · saved ${status.saved} · missed ${status.missed}`;
  if (running) {
    const remainingMin = Math.ceil(((status.total - status.processed) * 4) / 60);
    fotmobBackfillStatus.textContent = `${status.stopping ? "Stopping" : "Running"} (${fotmobBackfillSeasonLabel(status.season)}): ${progress} · ~${remainingMin} min left${status.current ? ` · ${status.current}` : ""}`;
  } else {
    fotmobBackfillStatus.textContent = `${status.error ? `Failed: ${status.error} · ` : "Last run: "}${progress} (${fotmobBackfillSeasonLabel(status.season)})`;
  }
}

async function pollFotmobBackfill() {
  clearTimeout(fotmobBackfillPollTimer);
  try {
    const status = await fotmobBackfillRequest("status");
    renderFotmobBackfillStatus(status);
    if (status.running) {
      fotmobBackfillPollTimer = setTimeout(pollFotmobBackfill, 3000);
    } else if (status.finishedAt && fotmobBackfillPollTimer !== null) {
      logActivity({
        label: "FotMob backfill",
        ok: !status.error,
        summary: `${status.error ? `Failed: ${status.error} · ` : "Finished: "}saved ${status.saved}, missed ${status.missed} (${fotmobBackfillSeasonLabel(status.season)}).`,
        data: status,
      });
      showToast(`FotMob backfill finished: saved ${status.saved}, missed ${status.missed}.`, status.saved > 0 ? "success" : undefined);
      fotmobBackfillPollTimer = null;
    }
  } catch (error) {
    console.error("Failed to read FotMob backfill status:", error);
    logActivity({ label: "FotMob backfill status", ok: false, summary: error.message });
    fotmobBackfillStatus.textContent = error.message;
  }
}

if (fotmobBackfillSeasonSelect) {
  const seasonOptions = [CURRENT_SEASON, CURRENT_SEASON - 1, CURRENT_SEASON - 2, CURRENT_SEASON - 3, "all"];
  for (const season of seasonOptions) {
    const option = document.createElement("option");
    option.value = String(season);
    option.textContent = season === "all" ? "All seasons" : String(season);
    fotmobBackfillSeasonSelect.append(option);
  }

  fotmobBackfillCountButton.onclick = async function () {
    const season = fotmobBackfillSeasonSelect.value;
    fotmobBackfillCountButton.disabled = true;
    try {
      const result = await fotmobBackfillRequest(`count?season=${encodeURIComponent(season)}`);
      const minutes = Math.ceil((result.count * 4) / 60);
      logActivity({ label: "FotMob backfill count", summary: `${result.count} missing (${fotmobBackfillSeasonLabel(season)}), ~${minutes} min.` });
      showToast(`${result.count} finished matches missing FotMob (${fotmobBackfillSeasonLabel(season)}), ~${minutes} min to backfill.`, "success");
    } catch (error) {
      console.error("Failed to count missing FotMob:", error);
      showToast(error.message);
    } finally {
      fotmobBackfillCountButton.disabled = false;
    }
  };

  fotmobBackfillStartButton.onclick = async function () {
    const season = fotmobBackfillSeasonSelect.value;
    if (!window.confirm(`Start FotMob backfill for ${fotmobBackfillSeasonLabel(season)}? It runs in the background (~4s per match).`)) {
      return;
    }
    fotmobBackfillStartButton.disabled = true;
    try {
      const status = await fotmobBackfillRequest("start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season }),
      });
      logActivity({ label: "FotMob backfill", summary: `Started: ${status.total} matches (${fotmobBackfillSeasonLabel(status.season)}).` });
      showToast(`FotMob backfill started: ${status.total} matches (${fotmobBackfillSeasonLabel(status.season)}).`, "success");
      fotmobBackfillPollTimer = 0;
      pollFotmobBackfill();
    } catch (error) {
      console.error("Failed to start FotMob backfill:", error);
      showToast(error.message);
      fotmobBackfillStartButton.disabled = false;
    }
  };

  fotmobBackfillStopButton.onclick = async function () {
    fotmobBackfillStopButton.disabled = true;
    try {
      const status = await fotmobBackfillRequest("stop", { method: "POST" });
      logActivity({ label: "FotMob backfill", summary: `Stop requested at ${status.processed}/${status.total}.`, data: status });
      renderFotmobBackfillStatus(status);
    } catch (error) {
      console.error("Failed to stop FotMob backfill:", error);
      logActivity({ label: "FotMob backfill stop", ok: false, summary: error.message });
      showToast(error.message);
    }
  };

  // Picks up a job that is already running, e.g. after a page reload
  pollFotmobBackfill();
}

const missingXgTable = document.getElementById("missing-xg-table");
if (missingXgTable) {
  missingXgTable.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[type='checkbox'][data-match-id]");
    if (!checkbox) {
      return;
    }

    if (checkbox.checked && getSelectedMissingXgIds().length > MISSING_XG_MAX_SELECTION) {
      checkbox.checked = false;
      showToast(`You can select at most ${MISSING_XG_MAX_SELECTION} matches.`);
    }

    updateMissingXgSelectionUi();
  });

  missingXgTable.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-match-id]");
    if (!button) {
      return;
    }

    const matchId = button.dataset.matchId;
    const row = button.closest("tr");
    const statusCell = row?.querySelector(".missing-xg-status");
    if (!statusCell) {
      return;
    }

    const action = button.dataset.action || "refetch";
    button.disabled = true;
    const statusText = action === "save-xg"
      ? "Saving xG…"
      : action === "fetch-xg"
        ? "Fetching xG…"
        : "Refetching…";
    setMissingXgStatus(statusCell, statusText, "loading");

    try {
      if (action === "save-xg") {
        await saveManualMissingXg(row, matchId);
        showToast(`Saved xG for match ${matchId}.`, "success");
        return;
      }

      if (action === "fetch-xg") {
        const fotmobID = row?.querySelector("input[data-role='fotmob-id']")?.value.trim() || "";
        const result = await fetchExternalXgMatches([matchId], fotmobID);
        const lookup = (result.results || []).find((entry) => String(entry.matchId) === String(matchId));
        applyExternalXgResult(row, lookup);
        if (lookup?.warning) {
          showToast(`${lookup.warning}: ${lookup.sourceMatch || "unknown teams"}`);
        } else if (lookup?.ok) {
          showToast(`Saved FotMob xG for match ${matchId}.`, "success");
        } else {
          showToast(lookup?.error || `No xG found for match ${matchId}.`);
        }
        return;
      }

      const result = await refetchMissingXgMatches([matchId]);
      applyMissingXgGrabResult(row, result, matchId);
    } catch (error) {
      const verb = action === "save-xg" ? "save xG" : action === "fetch-xg" ? "fetch xG" : "refetch";
      console.error(`Failed to ${verb} match ${matchId}:`, error);
      setMissingXgStatus(statusCell, error.message || `${verb} failed`, "error");
      showToast(error.message || `Failed to ${verb} match ${matchId}.`);
      button.disabled = false;
    } finally {
      updateMissingXgSelectionUi();
    }
  });
}

document.getElementById("missing-xg-select-20")?.addEventListener("click", () => {
  const checkboxes = getMissingXgCheckboxes().filter((checkbox) => !checkbox.disabled);
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });

  for (let i = checkboxes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [checkboxes[i], checkboxes[j]] = [checkboxes[j], checkboxes[i]];
  }

  checkboxes.slice(0, MISSING_XG_MAX_SELECTION).forEach((checkbox) => {
    checkbox.checked = true;
  });
  updateMissingXgSelectionUi();
});

document.getElementById("missing-xg-clear-selection")?.addEventListener("click", () => {
  getMissingXgCheckboxes().forEach((checkbox) => {
    if (!checkbox.disabled) {
      checkbox.checked = false;
    }
  });
  updateMissingXgSelectionUi();
});

document.getElementById("missing-xg-hide-old")?.addEventListener("click", () => {
  hideOldMissingXg = !hideOldMissingXg;
  applyMissingXgFilters();
});

document.getElementById("missing-xg-refetch-selected")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const ids = getSelectedMissingXgIds();
  if (ids.length === 0) {
    showToast("Select at least one match.");
    return;
  }

  button.disabled = true;
  const rowsById = new Map();
  for (const matchId of ids) {
    const row = document.querySelector(`#missing-xg-table tbody tr[data-match-id="${matchId}"]`);
    rowsById.set(String(matchId), row);
    const statusCell = row?.querySelector(".missing-xg-status");
    const refetchButton = row?.querySelector("button[data-action='refetch']");
    const fetchButton = row?.querySelector("button[data-action='fetch-xg']");
    const saveButton = row?.querySelector("button[data-action='save-xg']");
    if (refetchButton) {
      refetchButton.disabled = true;
    }
    if (fetchButton) {
      fetchButton.disabled = true;
    }
    if (saveButton) {
      saveButton.disabled = true;
    }
    if (statusCell) {
      setMissingXgStatus(statusCell, "Refetching…", "loading");
    }
  }

  try {
    const result = await refetchMissingXgMatches(ids);
    let savedCount = 0;
    let xgCount = 0;
    for (const matchId of ids) {
      const outcome = applyMissingXgGrabResult(rowsById.get(String(matchId)), result, matchId);
      if (outcome.saved) {
        savedCount += 1;
      }
      if (outcome.hasXg) {
        xgCount += 1;
      }
    }
    showToast(`Saved ${savedCount}/${ids.length}. xG on ${xgCount}.`, savedCount > 0 ? "success" : undefined);
  } catch (error) {
    console.error("Failed to refetch selected matches:", error);
    showToast(error.message || "Failed to refetch selected matches.");
    for (const matchId of ids) {
      const row = rowsById.get(String(matchId));
      const statusCell = row?.querySelector(".missing-xg-status");
      const refetchButton = row?.querySelector("button[data-action='refetch']");
      const fetchButton = row?.querySelector("button[data-action='fetch-xg']");
      const saveButton = row?.querySelector("button[data-action='save-xg']");
      if (statusCell) {
        setMissingXgStatus(statusCell, error.message || "Refetch failed", "error");
      }
      if (refetchButton && refetchButton.textContent !== "Done") {
        refetchButton.disabled = false;
      }
      if (fetchButton) {
        fetchButton.disabled = false;
      }
      if (saveButton && refetchButton?.textContent !== "Done") {
        saveButton.disabled = false;
      }
    }
  } finally {
    updateMissingXgSelectionUi();
  }
});

document.getElementById("missing-xg-fetch-xg-selected")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const ids = getSelectedMissingXgIds();
  if (ids.length === 0) {
    showToast("Select at least one match.");
    return;
  }

  button.disabled = true;
  const rowsById = new Map();
  for (const matchId of ids) {
    const row = document.querySelector(`#missing-xg-table tbody tr[data-match-id="${matchId}"]`);
    rowsById.set(String(matchId), row);
    const statusCell = row?.querySelector(".missing-xg-status");
    const fetchButton = row?.querySelector("button[data-action='fetch-xg']");
    if (fetchButton) {
      fetchButton.disabled = true;
    }
    if (statusCell) {
      setMissingXgStatus(statusCell, "Fetching xG…", "loading");
    }
  }
  [...rowsById.values()].find(Boolean)?.scrollIntoView({ block: "center", behavior: "smooth" });
  showToast(`Fetching FotMob xG for ${ids.length} match(es), about ${ids.length * 4}s…`, "success");

  try {
    const result = await fetchExternalXgMatches(ids);
    let foundCount = 0;
    for (const matchId of ids) {
      const lookup = (result.results || []).find((entry) => String(entry.matchId) === String(matchId));
      const outcome = applyExternalXgResult(rowsById.get(String(matchId)), lookup);
      if (outcome.found) {
        foundCount += 1;
      }
    }
    showToast(`Saved FotMob xG for ${foundCount}/${ids.length}.`, foundCount > 0 ? "success" : undefined);
  } catch (error) {
    console.error("Failed to fetch selected xG:", error);
    showToast(error.message || "Failed to fetch selected xG.");
    for (const matchId of ids) {
      const row = rowsById.get(String(matchId));
      const statusCell = row?.querySelector(".missing-xg-status");
      const fetchButton = row?.querySelector("button[data-action='fetch-xg']");
      if (statusCell) {
        setMissingXgStatus(statusCell, error.message || "Fetch failed", "error");
      }
      if (fetchButton) {
        fetchButton.disabled = false;
      }
    }
  } finally {
    updateMissingXgSelectionUi();
  }
});

// ---------- Data sync ----------

onClick("update-leagues", (button) => runAction(button, {
  label: "Update leagues",
  url: "/api/update-leagues",
  summarize: (data) => `Updated ${data.updatedSeasons} seasons across ${data.updatedLeagues} leagues (season ${data.season} or newer).`,
}));

onClick("import-and-update-matches", (button) => runAction(button, {
  label: "Import + update matches",
  url: "/api/import-and-update-matches",
  confirmText: "Update all leagues and fetch every missing finished match? This can take a while.",
  summarize: (data) => `Imported ${data.leagueUpdate.updatedLeagues} leagues and saved ${data.hydration.savedCount}/${data.missingMatches} match files.`,
}));

onClick("update-league-all-seasons", (button) => {
  const leagueID = requireSelectedLeague("updating all seasons");
  if (!leagueID) {
    return null;
  }
  return runAction(button, {
    label: `Update league ${leagueID} (all seasons)`,
    url: `/api/update-league-all-seasons?leagueID=${leagueID}`,
    summarize: (data) => `Updated ${data.updatedSeasons}/${data.totalSeasons} seasons for ${data.leagueName || `league ${leagueID}`}.`,
  });
});

onClick("reload-runtime-cache", (button) => runAction(button, {
  label: "Reload runtime cache",
  url: "/api/reload-runtime-cache",
  summarize: (data) => `${data.players} players, ${data.teams} teams, ${data.leagues} leagues, ${data.matches} matches.`,
}));

onClick("missing-matches", async (button) => {
  if (selectedLeagues.length === 0) {
    showToast("Select one or more leagues first.", "error");
    return;
  }
  const matches = await runAction(button, {
    label: "Missing match details",
    url: `/api/missing-matches?leagueID=${selectedLeagues.join(",")}`,
    summarize: (data) => `${data.length} finished match(es) without details.`,
  });
  if (Array.isArray(matches) && matches.length > 0) {
    matchList(matches, true);
  }
});

onClick("test-standings", (button) => {
  const leagueID = requireSelectedLeague("fetching standings");
  if (!leagueID) {
    return null;
  }
  const season = getStoredSeason(leagueID) || CURRENT_SEASON;
  return runAction(button, {
    label: `Fetch + save standings (league ${leagueID}, ${season})`,
    url: `/api/test-standings?leagueID=${leagueID}&season=${season}`,
    summarize: (data) => `Saved ${data.standings?.length ?? 0} standings group(s).`,
  });
});

// ---------- Match info ----------

onClick("grab-match-info", async (button) => {
  const matchIDs = requireInput("matchIDs", "Enter one or more match IDs first.");
  if (!matchIDs) {
    return;
  }

  const result = await runAction(button, {
    label: `Grab match info ${matchIDs}`,
    url: `/api/grab-match-info?matchIDs=${encodeURIComponent(matchIDs)}&includeMatches=1`,
    summarize: (data) => {
      const remaining = data.limits
        ? ` · ${data.limits.dailyRemaining} requests left today, ${data.limits.perMinuteRemaining} this minute`
        : "";
      return `Grabbed ${data.savedCount}/${data.requested} matches${remaining}.`;
    },
  });

  const matches = Array.isArray(result?.match) ? result.match : result?.matches;
  try {
    if (Array.isArray(matches) && matches.length > 0) {
      oneFixture(matches);
      addMatchStats(matches[0]);
    }
  } catch (error) {
    console.error("Could not render grabbed match:", error);
  }
});

// ---------- Players & teams ----------

function playerAction(id, { label, path, summarize }) {
  onClick(id, (button) => {
    const playerID = requireInput("playerID", "Enter a player ID first.");
    if (!playerID) {
      return null;
    }
    return runAction(button, {
      label: `${label} ${playerID}`,
      url: `/api/${path}?playerID=${encodeURIComponent(playerID)}`,
      summarize,
    });
  });
}

function teamAction(id, { label, path, summarize, onResult }) {
  onClick(id, async (button) => {
    const teamID = requireInput("teamID", "Enter a team ID first.");
    if (!teamID) {
      return;
    }
    const data = await runAction(button, {
      label: `${label} ${teamID}`,
      url: `/api/${path}?teamID=${encodeURIComponent(teamID)}`,
      summarize,
    });
    if (data && onResult) {
      onResult(data);
    }
  });
}

playerAction("get-player-profile", {
  label: "Player info",
  path: "get-player-profile",
  summarize: (data) => `Updated Player table for ${data.player?.name || "player"}.`,
});

playerAction("get-teams-by-player", {
  label: "Player teams",
  path: "get-teams-by-player",
  summarize: () => "Fetched (details in log).",
});

playerAction("get-transfers-by-player", {
  label: "Player transfers",
  path: "get-transfers-by-player",
  summarize: (data) => `Saved ${data.saved ?? 0} transfer row(s).`,
});

playerAction("refetch-player", {
  label: "Refetch player",
  path: "refetch-player",
  summarize: (data) => `Profile saved, ${data.transfersSaved ?? 0} transfer row(s).`,
});

teamAction("getSquads", {
  label: "Squad",
  path: "get-squads",
  summarize: () => "Fetched squad.",
  onResult: (data) => addSquad(data.squads),
});

teamAction("get-transfers-by-team", {
  label: "Team transfers",
  path: "get-transfers-by-team",
  summarize: () => "Fetched (details in log).",
});

teamAction("refetch-team", {
  label: "Refetch team",
  path: "refetch-team",
  summarize: (data) => `Saved ${data.savedCount ?? 0}/${data.requested ?? 0}${data.failed?.length ? `, ${data.failed.length} failed` : ""}.`,
});

teamAction("team-elo", {
  label: "Team Elo",
  path: "team-elo",
  summarize: ({ elo }) => {
    const parts = ["club", "nt"]
      .filter((scope) => elo?.[scope])
      .map((scope) => `${scope}: ${Math.round(elo[scope].elo)} (${elo[scope].matchesPlayed} matches)`);
    return parts.length > 0 ? parts.join(" · ") : "No Elo rating.";
  },
});

onClick("get-player-goal-list", () => {
  playerGoalList({ big: false, enableStatFilters: false });
});

// ---------- Elo ----------

onClick("backfill-elo", (button) => {
  const scope = document.getElementById("elo-backfill-scope").value;
  const dryRun = document.getElementById("elo-backfill-dry-run").checked;
  const scopeLabel = scope || "all";
  return runAction(button, {
    label: `Elo backfill (${scopeLabel}${dryRun ? ", dry run" : ""})`,
    url: "/api/backfill-elo",
    method: "POST",
    body: { scope, dryRun },
    confirmText: dryRun ? undefined : `Replay Elo from scratch for scope "${scopeLabel}"? This rewrites the Elo tables.`,
    summarize: () => (dryRun ? "Dry run finished (details in log)." : "Elo replayed (details in log)."),
  });
});

onClick("show-elo-rankings", async (button) => {
  const scope = document.getElementById("elo-rankings-scope").value;
  const limit = Number(document.getElementById("elo-rankings-limit").value) || 50;
  const data = await runAction(button, {
    label: `Elo rankings (${scope})`,
    url: `/api/elo-rankings?scope=${scope}&limit=${limit}`,
    summarize: (result) => `${result.rankings.length} team(s).`,
    toastSuccess: false,
  });
  if (!data) {
    return;
  }

  const tbody = document.querySelector("#elo-rankings-table tbody");
  tbody.replaceChildren(...data.rankings.map((row, index) => {
    const tr = document.createElement("tr");
    for (const value of [index + 1, row.name || "?", row.team_id, Math.round(Number(row.elo)), row.matches_played]) {
      const td = document.createElement("td");
      td.textContent = String(value ?? "");
      tr.append(td);
    }
    return tr;
  }));
  document.getElementById("elo-rankings-caption").textContent = `${scope === "nt" ? "National teams" : "Clubs"} · top ${data.rankings.length}`;
  const panel = document.getElementById("elo-rankings-panel");
  panel.hidden = false;
  panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

// ---------- Data sync: bulk jobs ----------

onClick("update-squads", (button) => runAction(button, {
  label: "Squads (teams due)",
  url: "/api/update-squads",
  confirmText: "Fetch squads for every team due an update? 10s between calls, this can take a while.",
  summarize: (data) => `Processed ${data.teamsProcessed} team(s), saved ${data.totalSaved} squad(s).`,
}));

onClick("get-transfers", (button) => runAction(button, {
  label: "Transfers (clubs due)",
  url: "/api/get-transfers",
  confirmText: "Fetch transfers for every club due an update? 10s between calls, this can take a while.",
  summarize: (data) => `Processed ${data.teamsProcessed} club(s), saved ${data.totalSaved} transfer row(s).`,
}));

onClick("get-all-clubs", (button) => runAction(button, {
  label: "Insert all clubs",
  url: "/api/insert-all-clubs-to-db",
  confirmText: "Insert every club found in matches into the Team table?",
  summarize: () => "Done (details in log).",
}));

onClick("insert-all-players", (button) => runAction(button, {
  label: "Insert all players",
  url: "/api/insert-all-players",
  confirmText: "Insert all players from files into the DB?",
  summarize: () => "Done (details in log).",
}));

onClick("update-player-profiles-from-files", (button) => runAction(button, {
  label: "Update player profiles from files",
  url: "/api/update-player-profiles-from-files",
  confirmText: "Update player profile fields from the player files?",
  summarize: (data) => data.message || "Done.",
}));

// ---------- Results area ----------

onClick("clear-results", () => {
  for (const id of ["fixtures-info", "results-text", "standings", "standings-text", "one-fixture", "selected-matches"]) {
    const element = document.getElementById(id);
    if (element) {
      element.innerHTML = "";
    }
  }
  document.getElementById("elo-rankings-panel").hidden = true;
});

onClick("copy-for-blog", () => {
  copyToClipboard("league-stuff");
});

// ---------- Graphics ----------

onClick("copy-text", () => {
  copyText("generated-text");
});

function redrawBaseImage() {
  make_base(
    document.getElementById("textOnPic").value,
    document.getElementById("breaking-official").value,
  );
}

document.getElementById("textOnPic").onkeyup = redrawBaseImage;
document.getElementById("breaking-official").onkeyup = redrawBaseImage;

onClick("add-breaking", (button) => {
  document.getElementById("breaking-official").value = button.textContent;
  redrawBaseImage();
});

onClick("happy-bday", () => {
  document.getElementById("breaking-official").value = "🎉HAPPY BIRTHDAY🎂";
  redrawBaseImage();
});

document.getElementById("pasteArea").onpaste = function (event) {
  const items = [...(event.clipboardData?.items || [])];
  const imageItem = items.find((item) => item.type.startsWith("image"));
  if (!imageItem) {
    showToast("No image found on the clipboard.", "error");
    return;
  }

  event.preventDefault();
  drawPastedImage(imageItem.getAsFile(), Boolean(document.getElementById("breaking-official").value));
};

onClick("copy-match-stats", () => matchStatsToCanvas());
onClick("copy-standings", () => standingsToCanvas());
onClick("copy-matches", () => matchesToCanvas("match-list"));
onClick("copy-selected", () => matchesToCanvas("selected-matches"));
onClick("copy-player-list", () => playerListToCanvas());
onClick("download-image", () => download());
