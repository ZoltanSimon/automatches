import { CURRENT_SEASON } from "../shared/defaults.js";
import {
  showMatchesOnDate,
  download,
  showToast,
  addLeagues,
  selectedLeagues,
} from "../common-functions.js";
import { matchesToCanvas, matchList } from "../components/match-list.js";
import { make_base, fontY } from "../instapics.js";
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

function setActiveLeague(leagueID) {
  const normalizedLeagueID = Number(leagueID);
  activeLeagueID = Number.isNaN(normalizedLeagueID) ? null : normalizedLeagueID;
  renderSeasonOptions(activeLeagueID);
}

seasonSelect.addEventListener("change", () => {
  if (activeLeagueID === null) {
    return;
  }

  selectedLeagueSeasons.set(activeLeagueID, Number(seasonSelect.value));
});

const datepickerInput = document.getElementById("datepicker-input");
if (datepickerInput) {
  datepickerInput.addEventListener("change", function () {
    document.getElementById("fixtures-info").innerHTML = "";
    const selectedDate = this.value;
    showMatchesOnDate(selectedDate, true);
  });
}

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
async function submitRequest_matchList() {
  let leagueID = selectedLeagues[0];
  let startDate = document.getElementById("dateStart").value;
  let endDate = document.getElementById("dateEnd").value;
  getResultsDate(leagueID, 2024, startDate, endDate).then((response) => {
    matchList(response.response, true);
    addText(response.response);
  });
}

document.getElementById("select-all-leagues").onclick = function () {
  const allTheLeagues = document
    .getElementById("league-list")
    .querySelectorAll("img");
  selectedLeagues.length = 0;
  for (let i = 0; i < 10; i++) {
    let league = allTheLeagues[i];
    league.classList.add("selected-league");
    const leagueID = Number(league.id.split("img-")[1]);
    selectedLeagues.push(leagueID);
    getStoredSeason(leagueID);
  }
  setActiveLeague(selectedLeagues[0] ?? null);
  const missingXgPanel = document.getElementById("missing-xg-panel");
  if (missingXgPanel && !missingXgPanel.hidden) {
    applyMissingXgFilters();
  }
};

document.getElementById("submit-league-info").onclick = async function () {
  await leagueStandings(selectedLeagues[0]);
};

const getMatchesByRoundButton = document.getElementById("get-matches-by-round");
if (getMatchesByRoundButton) {
  getMatchesByRoundButton.onclick = async function () {
    let leagueID = selectedLeagues[0];
    let roundNumber = document.getElementById("roundnr").value;
    let roundLabel = leagueID != 2 ? `Regular Season - ${roundNumber}` : `League Stage - ${roundNumber}`;
    console.log(roundLabel);
    const response = await fetch(`/api/get-matches-by-round?leagueID=${leagueID}&roundNo=${roundLabel}`);
    const matches = await response.json();
    matchList(matches, true);
    addText(matches);
    buildResults(matches);
  };
}

const submitMatchListButton = document.getElementById("submit-match-list");
if (submitMatchListButton) {
  submitMatchListButton.onclick = async function () {
    await submitRequest_matchList();
  };
}

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
  const hint = document.getElementById("missing-xg-selection-hint");

  if (refetchSelectedButton) {
    refetchSelectedButton.textContent = `Refetch selected (${selectedCount})`;
    refetchSelectedButton.disabled = selectedCount === 0;
  }

  if (hint) {
    hint.textContent = selectedCount >= MISSING_XG_MAX_SELECTION
      ? `${MISSING_XG_MAX_SELECTION} selected (max)`
      : `${selectedCount} selected · max ${MISSING_XG_MAX_SELECTION}`;
  }
}

function applyMissingXgGrabResult(row, result, matchId) {
  const statusCell = row?.querySelector(".missing-xg-status");
  const refetchButton = row?.querySelector("button[data-match-id]");
  const checkbox = row?.querySelector("input[type='checkbox'][data-match-id]");
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
    return { saved: false, hasXg: false };
  }

  if (hasXg) {
    setMissingXgStatus(
      statusCell,
      `Saved · xG ${formatXgValue(xgInfo.home)}–${formatXgValue(xgInfo.away)}`,
      "success",
    );
    if (refetchButton) {
      refetchButton.textContent = "Done";
      refetchButton.disabled = true;
    }
    if (checkbox) {
      checkbox.checked = false;
      checkbox.disabled = true;
    }
    return { saved: true, hasXg: true };
  }

  setMissingXgStatus(statusCell, "Saved · still no xG", "warn");
  if (refetchButton) {
    refetchButton.disabled = false;
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
    emptyRow.innerHTML = `<td colspan="7">No finished current-season matches are missing xG.</td>`;
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

    const actionTd = document.createElement("td");
    const refetchButton = document.createElement("button");
    refetchButton.type = "button";
    refetchButton.textContent = "Refetch";
    refetchButton.dataset.matchId = String(matchId);
    actionTd.append(refetchButton);

    const statusTd = document.createElement("td");
    setMissingXgStatus(
      statusTd,
      match.missingDetails ? "No details yet" : "No xG yet",
    );

    tr.append(selectTd, dateTd, leagueTd, matchTd, scoreTd, actionTd, statusTd);
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
      const response = await fetch(`/api/matches-missing-xg?season=${CURRENT_SEASON}`);
      const data = await response.json();
      if (!response.ok || data.success === false) {
        showToast(data.message || "Failed to load matches missing xG.");
        return;
      }

      renderMissingXgMatches(data.matches);
      showToast(`Found ${data.count} match(es) without xG in season ${data.season}.`, "success");
    } catch (error) {
      console.error("Failed to load matches missing xG:", error);
      showToast(error.message || "Failed to load matches missing xG.");
    } finally {
      matchesMissingXgButton.disabled = false;
    }
  };
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

    button.disabled = true;
    setMissingXgStatus(statusCell, "Refetching…", "loading");

    try {
      const result = await refetchMissingXgMatches([matchId]);
      applyMissingXgGrabResult(row, result, matchId);
    } catch (error) {
      console.error(`Failed to refetch match ${matchId}:`, error);
      setMissingXgStatus(statusCell, error.message || "Refetch failed", "error");
      showToast(error.message || `Failed to refetch match ${matchId}.`);
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
    const refetchButton = row?.querySelector("button[data-match-id]");
    if (refetchButton) {
      refetchButton.disabled = true;
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
      const refetchButton = row?.querySelector("button[data-match-id]");
      if (statusCell) {
        setMissingXgStatus(statusCell, error.message || "Refetch failed", "error");
      }
      if (refetchButton && refetchButton.textContent !== "Done") {
        refetchButton.disabled = false;
      }
    }
  } finally {
    updateMissingXgSelectionUi();
  }
});

document.getElementById("update-leagues").onclick = async function () {
  const response = await fetch(
    "/api/update-leagues",
    {
      method: "GET",
    }
  );
  const data = await response.json();
  showToast(`Updated ${data.updatedLeagues} leagues for season ${data.season}.`, 'success');
  console.log(data);
};

document.getElementById("import-and-update-matches").onclick = async function () {
  const response = await fetch("/api/import-and-update-matches", {
    method: "GET",
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    showToast(data.message || "Failed to import and update matches.");
    console.log(data);
    return;
  }

  showToast(
    `Imported ${data.leagueUpdate.updatedLeagues} leagues and saved ${data.hydration.savedCount}/${data.missingMatches} match files.`,
    "success",
  );
  console.log(data);
};

document.getElementById("update-league-all-seasons").onclick = async function () {
  const leagueID = selectedLeagues[0];
  if (!leagueID) {
    showToast("Select one league before updating all seasons.");
    return;
  }

  const response = await fetch(
    `/api/update-league-all-seasons?leagueID=${leagueID}`,
    {
      method: "GET",
    }
  );

  const data = await response.json();
  if (!response.ok || !data.success) {
    showToast(data.message || "Failed to update all seasons.");
    return;
  }

  showToast(
    `Updated ${data.updatedSeasons}/${data.totalSeasons} seasons for league ${leagueID}.`,
    "success",
  );
  console.log(data);
};

const grabMatchInfoButton = document.getElementById("grab-match-info");
if (grabMatchInfoButton) {
  grabMatchInfoButton.onclick = async function () {
    const matchIDs = document.getElementById("matchIDs").value.trim();
    if (!matchIDs) {
      showToast("Enter one or more match IDs first.");
      return;
    }

    const response = await fetch(`/api/grab-match-info?matchIDs=${encodeURIComponent(matchIDs)}&includeMatches=1`, {
      method: "GET",
    });
    const result = await response.json();

    if (!response.ok || result.success === false) {
      showToast(result.message || "Failed to grab match info.");
      return;
    }

    const remaining = result.limits
      ? `${result.limits.dailyRemaining} requests left today, ${result.limits.perMinuteRemaining} left this minute`
      : "";
    showToast(`Grabbed ${result.savedCount}/${result.requested} matches ${remaining}`.trim());

    const matches = Array.isArray(result?.match) ? result.match : result?.matches;
    try {
      if (Array.isArray(matches) && matches.length > 0) {
        oneFixture(matches);
        addMatchStats(matches[0]);
      }
    } catch (error) {
      console.error("Could not render grabbed match:", error);
    }
  };
}

const missingMatchesButton = document.getElementById("missing-matches");
if (missingMatchesButton) {
  missingMatchesButton.onclick = async function () {
    let leagueID = selectedLeagues.join(",");
    const response = await fetch(`/api/missing-matches?leagueID=${leagueID}`, {
      method: "GET",
    });
    const data = await response.json();
    if (data.length > 0) matchList(data, true);
    console.log(data);
  };
}

document.getElementById("get-player-goal-list").onclick = async function () {
  playerGoalList({ big: false, enableStatFilters: false });
};

document.getElementById("get-all-clubs").onclick = async function () {
  let response = await fetch("/api/insert-all-clubs-to-db", {
    method: "GET",
  });
  let result = await response.json();
  console.log("Inserted teams:", result);
};

document.getElementById("insert-all-players").onclick = async function () {
  try {
    const response = await fetch(`/api/insert-all-players`);
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Failed to fetch and build player list:", error);
    return [];
  }
};

const getPlayerStatsButton = document.getElementById("getPlayerStats");
if (getPlayerStatsButton) {
  getPlayerStatsButton.onclick = async function () {
    const playerID = document.getElementById("playerID").value;
    if (!playerID) {
      showToast("Enter a player ID first.");
      return;
    }

    try {
      const response = await fetch(`/api/get-player-stats?playerID=${playerID}`);
      const data = await response.json();
      console.log(data);
      if (!response.ok || !data.success) {
        showToast(data.message || "Failed to fetch player stats.");
        return;
      }
      showToast(`Got stats for player ${playerID}. See console.`, "success");
    } catch (error) {
      console.error("Failed to fetch player stats:", error);
      showToast(error.message || "Failed to fetch player stats.");
    }
  };
}

document.getElementById("get-player-profile").onclick = async function () {
  const button = document.getElementById("get-player-profile");
  const playerID = document.getElementById("playerID").value.trim();

  if (!playerID) {
    showToast("Enter a player ID first.");
    return;
  }

  button.disabled = true;

  try {
    const response = await fetch(`/api/get-player-profile?playerID=${playerID}`);
    const data = await response.json();
    console.log(data);
    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to fetch player info.");
      return;
    }

    showToast(`Updated Player table for ${data.player?.name || playerID}.`, "success");
  } catch (error) {
    console.error("Failed to fetch player info:", error);
    showToast(error.message || "Failed to fetch player info.");
  } finally {
    button.disabled = false;
  }
};

document.getElementById("get-teams-by-player").onclick = async function () {
  const playerID = document.getElementById("playerID").value;
  if (!playerID) {
    showToast("Enter a player ID first.");
    return;
  }

  try {
    const response = await fetch(`/api/get-teams-by-player?playerID=${playerID}`);
    const data = await response.json();
    console.log(data);
    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to fetch player teams.");
      return;
    }
    showToast(`Got teams for player ${playerID}. See console.`, "success");
  } catch (error) {
    console.error("Failed to fetch player teams:", error);
    showToast(error.message || "Failed to fetch player teams.");
  }
};

document.getElementById("getSquads").onclick = async function () {
  const teamID = document.getElementById("teamID").value;
  if (!teamID) {
    showToast("Enter a team ID first.");
    return;
  }

  try {
    const response = await fetch(`/api/get-squads?teamID=${teamID}`);
    const data = await response.json();
    console.log(data);

    if (!response.ok || !data.success) {
      throw new Error(data?.message || "Failed to fetch squad.");
    }

    addSquad(data.squads);
    showToast(`Fetched squad for team ${teamID}.`, "success");
  } catch (error) {
    console.error("Failed to fetch squad:", error);
    showToast(error.message || "Failed to fetch squad.");
  }
};

document.getElementById("get-transfers-by-team").onclick = async function () {
  const teamID = document.getElementById("teamID").value;
  if (!teamID) {
    showToast("Enter a team ID first.");
    return;
  }

  try {
    const response = await fetch(`/api/get-transfers-by-team?teamID=${teamID}`);
    const data = await response.json();
    console.log(data);
    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to fetch transfers.");
      return;
    }
    showToast(`Got transfers for team ${teamID}. See console.`, "success");
  } catch (error) {
    console.error("Failed to fetch transfers by team:", error);
    showToast(error.message || "Failed to fetch transfers.");
  }
};

document.getElementById("get-transfers-by-player").onclick = async function () {
  const playerID = document.getElementById("playerID").value;
  if (!playerID) {
    showToast("Enter a player ID first.");
    return;
  }

  try {
    const response = await fetch(`/api/get-transfers-by-player?playerID=${playerID}`);
    const data = await response.json();
    console.log(data);
    if (!response.ok || !data.success) {
      showToast(data.message || "Failed to fetch player transfers.");
      return;
    }
    showToast(`Saved ${data.saved ?? 0} transfer row(s) for player ${playerID}.`, "success");
  } catch (error) {
    console.error("Failed to fetch transfers by player:", error);
    showToast(error.message || "Failed to fetch player transfers.");
  }
};

document.getElementById("update-squads").onclick = async function () {
  const button = this;
  button.disabled = true;
  showToast("Fetching squads for teams due an update (10s between calls, this can take a while)...", "success");

  try {
    const response = await fetch("/api/update-squads");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data?.message || "Failed to fetch squads.");
    }

    console.log(data.results);
    showToast(`Processed ${data.teamsProcessed} team(s), saved ${data.totalSaved} squad(s).`, "success");
  } catch (error) {
    console.error("Failed to fetch squads:", error);
    showToast(error.message || "Failed to fetch squads.");
  } finally {
    button.disabled = false;
  }
};

document.getElementById("get-transfers").onclick = async function () {
  const button = this;
  button.disabled = true;
  showToast("Fetching transfers for clubs due an update (10s between calls, this can take a while)...", "success");

  try {
    const response = await fetch("/api/get-transfers");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data?.message || "Failed to fetch transfers.");
    }

    console.log(data.results);
    showToast(`Processed ${data.teamsProcessed} club(s), saved ${data.totalSaved} transfer row(s).`, "success");
  } catch (error) {
    console.error("Failed to fetch transfers:", error);
    showToast(error.message || "Failed to fetch transfers.");
  } finally {
    button.disabled = false;
  }
};

document.getElementById("clear-results").onclick = async function () {
  document.getElementById("fixtures-info").innerHTML = "";
};

document.getElementById("copy-for-blog").onclick = function () {
  copyToClipboard("league-stuff");
};

document.getElementById("generate-text").onclick = async function () {};

document.getElementById("copy-text").onclick = async function () {
  copyText("generated-text");
};

document.getElementById("textOnPic").onkeyup = function () {
  let inputTextValue = document.getElementById("textOnPic").value;
  let breakingText = document.getElementById("breaking-official").value;
  make_base(inputTextValue, breakingText);
};

document.getElementById("add-breaking").onclick = function () {
  document.getElementById("breaking-official").value =
    document.getElementById("add-breaking").innerHTML;
};

document.getElementById("happy-bday").onclick = function () {
  document.getElementById("breaking-official").value = "🎉HAPPY BIRTHDAY🎂";
};

document.getElementById("pasteArea").onpaste = function (event) {
  let breakingText = document.getElementById("breaking-official").value;
  // use event.originalEvent.clipboard for newer chrome versions
  var items = (event.clipboardData || event.originalEvent.clipboardData).items;
  // find pasted image among pasted items
  var blob = null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") === 0) {
      blob = items[i].getAsFile();
    }
  }
  // load image if there is a pasted image
  if (blob !== null) {
    var reader = new FileReader();
    reader.onload = function (event) {
      imgHeight = fontY - 34 - lineheight;
      if (breakingText) imgHeight -= 66;

      base_image = new Image();
      base_image.src = event.target.result;
      base_image.onload = function () {
        drawResizedImage(base_image, imgHeight, 1080, 30);
        ctx.drawImage(border_image, 0, 0);
      };
    };
    reader.readAsDataURL(blob);
  }
};

document.getElementById("copy-match-stats").onclick = function () {
  matchStatsToCanvas();
};

document.getElementById("copy-standings").onclick = function (event) {
  standingsToCanvas();
};

document.getElementById("copy-player-stats").onclick = function () {
  playerStatsToCanvas();
};

document.getElementById("copy-matches").onclick = function () {
  matchesToCanvas("match-list");
};

document.getElementById("copy-selected").onclick = function () {
  matchesToCanvas("selected-matches");
};

document.getElementById("copy-player-list").onclick = function () {
  playerListToCanvas();
};

document.getElementById("download-image").onclick = function () {
  download();
};

document.getElementById("test-standings").onclick = async function () {
  const leagueID = selectedLeagues[0] || 1;
  const season = getStoredSeason(leagueID) || CURRENT_SEASON;
  console.log(`Testing standings for league ID: ${leagueID}, season: ${season}`);
  const response = await fetch(`/api/test-standings?leagueID=${leagueID}&season=${season}`);
  const result = await response.json();
  console.log(result);
};
