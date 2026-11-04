import { getFinishedMatchIdsMissingFotmob, setMatchFotmob } from "../data-access.js";
import { CURRENT_SEASON } from "../../shared/defaults.js";
import { fetchExternalMatchXg } from "./xg-lookup-service.js";

export const DOMESTIC_LEAGUE_IDS = [39, 140, 135, 78, 61, 88, 94, 203];
export const EUROPEAN_CUP_IDS = [2, 3, 848];

const job = {
  running: false,
  stopRequested: false,
  season: null,
  total: 0,
  processed: 0,
  saved: 0,
  missed: 0,
  current: null,
  startedAt: null,
  finishedAt: null,
  error: null,
};

// "all" = every season, otherwise a season year (defaults to CURRENT_SEASON)
export function normalizeBackfillSeason(season) {
  if (String(season).toLowerCase() === "all") {
    return "all";
  }
  const parsed = Number(season);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : CURRENT_SEASON;
}

export function findMatchIdsMissingFotmob(season) {
  return getFinishedMatchIdsMissingFotmob({
    season: normalizeBackfillSeason(season),
    domesticLeagueIds: DOMESTIC_LEAGUE_IDS,
    europeanLeagueIds: EUROPEAN_CUP_IDS,
  });
}

// Fetches and saves FotMob data one match at a time; FotMob calls are rate limited inside xg-lookup-service.
export async function runFotmobBackfill(matchIds, { onResult, shouldStop = () => false } = {}) {
  let saved = 0;
  let missed = 0;

  for (let index = 0; index < matchIds.length; index += 1) {
    if (shouldStop()) {
      break;
    }

    const matchId = matchIds[index];
    const [result] = await fetchExternalMatchXg([matchId]);
    if (result?.fotmob) {
      await setMatchFotmob(matchId, result.fotmob);
      saved += 1;
    } else {
      missed += 1;
    }
    onResult?.({ index, matchId, result, saved, missed });
  }

  return { saved, missed };
}

export function getFotmobBackfillStatus() {
  const { stopRequested, ...status } = job;
  return { ...status, stopping: job.running && stopRequested };
}

export function stopFotmobBackfill() {
  if (job.running) {
    job.stopRequested = true;
  }
  return getFotmobBackfillStatus();
}

// Starts the backfill in the background and returns immediately; poll getFotmobBackfillStatus for progress.
export async function startFotmobBackfill({ season, onSaved } = {}) {
  if (job.running) {
    throw new Error("FotMob backfill is already running");
  }

  const normalizedSeason = normalizeBackfillSeason(season);
  Object.assign(job, {
    running: true,
    stopRequested: false,
    season: normalizedSeason,
    total: 0,
    processed: 0,
    saved: 0,
    missed: 0,
    current: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  });

  let matchIds;
  try {
    matchIds = await findMatchIdsMissingFotmob(normalizedSeason);
  } catch (error) {
    Object.assign(job, { running: false, finishedAt: new Date().toISOString(), error: error.message });
    throw error;
  }
  job.total = matchIds.length;
  console.log(`[fotmob-backfill] Starting ${matchIds.length} matches (season ${normalizedSeason}).`);

  runFotmobBackfill(matchIds, {
    shouldStop: () => job.stopRequested,
    onResult: ({ index, matchId, result, saved, missed }) => {
      Object.assign(job, {
        processed: index + 1,
        saved,
        missed,
        current: result?.sourceMatch || String(matchId),
      });
      if (result?.fotmob) {
        onSaved?.(matchId, result.fotmob);
      }
    },
  })
    .catch((error) => {
      console.error("[fotmob-backfill] Failed:", error);
      job.error = error.message || "FotMob backfill failed";
    })
    .finally(() => {
      Object.assign(job, { running: false, current: null, finishedAt: new Date().toISOString() });
      console.log(`[fotmob-backfill] Done. Saved ${job.saved}, missed ${job.missed}, processed ${job.processed}/${job.total}.`);
    });

  return getFotmobBackfillStatus();
}
