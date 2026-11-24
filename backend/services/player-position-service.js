import { LineupParser } from "../../classes/lineupparser.js";
import { roleCodeFromName, roleNameFromCode } from "../../classes/player-positions.js";
import { isValidPlayerId } from "../lib/backend-helper.js";
import { allDBPlayers, setCatalog } from "../lib/catalog.js";
import { buildPositionProfiles, footballSeasonOfDate } from "../lib/player-position-profile.js";
import {
  clearDirtyPlayerPositionSeasons,
  getDirtyPlayerPositionSeasons,
  getLineupsForPositionRebuild,
  hasPlayerPositions,
  loadPlayerPositions,
  markAllPlayerPositionSeasonsDirty,
  replacePlayerPositions,
  updatePlayerPositionCache,
} from "../data-access.js";

const PAGE_SIZE = 2000;
const FULL_LINEUP_SIZE = 11;
const REFRESH_DEBOUNCE_MS = 60 * 1000;
const KNOWN_FORMATIONS = new Set(LineupParser.formations.map((entry) => entry.formation));

warnAboutUnmappedFormationRoles();

let positionQueue = Promise.resolve();

function withPositionLock(task) {
  const run = positionQueue.then(task, task);
  positionQueue = run.then(() => undefined, () => undefined);
  return run;
}

function warnAboutUnmappedFormationRoles() {
  const unmapped = [...new Set(LineupParser.formations.flatMap((entry) => entry.positions))]
    .filter((role) => role !== "Unknown" && !roleCodeFromName(role));
  if (unmapped.length > 0) {
    console.warn(`[player-positions] Formation roles without a role code: ${unmapped.join(", ")}`);
  }
}

// Roles come from grid order, so a lineup with a missing grid would shift every later
// player into the wrong slot; such lineups are skipped instead of guessed.
function usableLineups(lineups, stats) {
  return (Array.isArray(lineups) ? lineups : []).filter((lineup) => {
    const starters = Array.isArray(lineup?.startXI) ? lineup.startXI : [];
    if (starters.length === 0) {
      return false;
    }
    // API-Football sends some lineups (mostly smaller national teams) without formation or grid.
    if (!lineup?.formation) {
      stats.noFormationLineups += 1;
      return false;
    }
    if (!KNOWN_FORMATIONS.has(lineup.formation)) {
      const formation = String(lineup.formation);
      stats.unknownFormations[formation] = (stats.unknownFormations[formation] || 0) + 1;
      return false;
    }
    if (starters.length !== FULL_LINEUP_SIZE || starters.some((entry) => !entry?.player?.grid)) {
      stats.skippedLineups += 1;
      return false;
    }
    return true;
  });
}

async function collectPositionRows(seasons, stats) {
  const counts = new Map();
  let afterMatchId = 0;

  for (;;) {
    const page = await getLineupsForPositionRebuild({ seasons, afterMatchId, limit: PAGE_SIZE });
    if (page.length === 0) {
      break;
    }

    for (const match of page) {
      const season = Number(match.season);
      const matchDay = match.match_day || null;
      // The football season it was played in, from the match date (the competition's own
      // season number can be a tournament year, e.g. 2027 for qualifiers played in 2025-26).
      const playedSeason = footballSeasonOfDate(matchDay);
      if (!Number.isFinite(season) || playedSeason === null) {
        continue;
      }

      stats.matches += 1;
      const scope = match.league_type === "nt" ? "nt" : "club";
      const roles = LineupParser.starterRolesByPlayerId(usableLineups(match.lineups, stats));

      for (const [playerId, roleName] of roles) {
        const role = roleCodeFromName(roleName);
        if (!role || !isValidPlayerId(playerId)) {
          continue;
        }

        const key = `${playerId}|${season}|${playedSeason}|${scope}|${role}`;
        const entry = counts.get(key);
        if (!entry) {
          counts.set(key, { playerId, season, playedSeason, scope, role, starts: 1, firstStart: matchDay, lastStart: matchDay });
          continue;
        }
        entry.starts += 1;
        if (matchDay && (!entry.firstStart || matchDay < entry.firstStart)) {
          entry.firstStart = matchDay;
        }
        if (matchDay && (!entry.lastStart || matchDay > entry.lastStart)) {
          entry.lastStart = matchDay;
        }
      }
    }

    afterMatchId = Number(page[page.length - 1].match_id);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return [...counts.values()];
}

async function rebuildUnlocked({ seasons = null, dryRun = false } = {}) {
  const startedAt = Date.now();
  const stats = { matches: 0, skippedLineups: 0, noFormationLineups: 0, unknownFormations: {} };

  // Everything is counted before the table is touched, so a failed read changes nothing.
  const rows = await collectPositionRows(seasons, stats);
  if (!dryRun) {
    await replacePlayerPositions(rows, { seasons });
  }

  const result = {
    seasons: seasons ?? "all",
    dryRun,
    ...stats,
    rows: rows.length,
    players: new Set(rows.map((row) => row.playerId)).size,
    ms: Date.now() - startedAt,
  };
  console.log("[player-positions] Rebuilt:", JSON.stringify(result));
  return result;
}

/** Recounts player_position from lineups: all seasons (null) or only the given ones. */
export function rebuildPlayerPositions(options) {
  return withPositionLock(() => rebuildUnlocked(options));
}

/**
 * Loads player_position into catalog profiles and refreshes the Player.position cache
 * (DB and catalog) for players whose main position changed.
 */
export async function reloadPlayerPositionProfiles() {
  const profiles = buildPositionProfiles(await loadPlayerPositions(), footballSeasonOfDate(new Date()));

  const changes = [];
  for (const player of allDBPlayers) {
    const profile = profiles.get(Number(player.id));
    const mainName = profile ? roleNameFromCode(profile.main) : "";
    if (mainName && player.position !== mainName) {
      changes.push({ id: Number(player.id), position: mainName });
      player.position = mainName;
    }
  }

  await updatePlayerPositionCache(changes);
  setCatalog({ positionProfiles: profiles });
  return { profiles: profiles.size, positionCacheUpdates: changes.length };
}

/** Rebuilds the seasons marked dirty since the last run, then reloads the profiles. */
export function processDirtyPlayerPositions() {
  return withPositionLock(async () => {
    const { markedBefore, seasons } = await getDirtyPlayerPositionSeasons();
    if (seasons.length === 0) {
      return { rebuilt: false };
    }

    const rebuild = await rebuildUnlocked({ seasons });
    await clearDirtyPlayerPositionSeasons(seasons, markedBefore);
    const reload = await reloadPlayerPositionProfiles();
    return { rebuilt: true, ...rebuild, ...reload };
  });
}

/**
 * Startup: loads the profiles, and in the background rebuilds whatever is dirty. An empty
 * table (first run) marks every season, so the full backfill happens without a script.
 */
export async function initPlayerPositions() {
  if (!(await hasPlayerPositions())) {
    await markAllPlayerPositionSeasonsDirty();
  }
  await reloadPlayerPositionProfiles();

  processDirtyPlayerPositions().catch((error) => {
    console.error("[player-positions] Startup rebuild failed:", error);
  });
}

let refreshTimer = null;

/** Rebuild soon after new results are saved, instead of waiting for the next scheduled tick. */
export function schedulePlayerPositionRefresh() {
  if (refreshTimer) {
    return;
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    processDirtyPlayerPositions().catch((error) => {
      console.error("[player-positions] Scheduled rebuild failed:", error);
    });
  }, REFRESH_DEBOUNCE_MS);
  refreshTimer.unref?.();
}
