import { comparePositionsByDisplayOrder, roleNameFromCode } from "../../classes/player-positions.js";

// Each football season back counts half as much towards the main position and the ranking.
export const SEASON_DECAY = 0.5;
// A role beyond the main one is "regular" with this share of weighted starts...
export const MIN_ROLE_SHARE = 0.1;
// ...and at least this many actual starts.
export const MIN_ROLE_STARTS = 3;
// Football seasons run July to June: a match in August 2026 is in 2026-2027.
const SEASON_START_MONTH = 7;

/**
 * Start year of the football season a date falls in: "2026-08-15" -> 2026, "2026-03-01" -> 2025.
 * @param {string|Date} date "YYYY-MM-DD" or a Date
 * @returns {number|null}
 */
export function footballSeasonOfDate(date) {
  const day = date instanceof Date ? date.toISOString().slice(0, 10) : String(date || "");
  const match = /^(\d{4})-(\d{2})/.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  return Number(match[2]) >= SEASON_START_MONTH ? year : year - 1;
}

/** 2026 -> "2026-2027" */
export function footballSeasonLabel(season) {
  return `${season}-${Number(season) + 1}`;
}

/**
 * @typedef {{ code: string, name: string, starts: number, weighted: number, share: number, isMain: boolean }} ProfileRole
 * @typedef {{ season: number, label: string, firstStart: string|null, lastStart: string|null, total: number, ntStarts: number, roles: { code: string, name: string, starts: number, ntStarts: number }[] }} ProfileSeason
 *   one row per football season (July-June) the starts were played in, club and national team together
 * @typedef {{ main: string, roles: ProfileRole[], bySeason: ProfileSeason[], totalStarts: number }} PositionProfile
 */

/**
 * Position profiles from player_position rows. Club and national-team starts count the same.
 * @param {{ player_id: number, played_season: number, scope: string, role: string, starts: number, first_start?: string, last_start?: string }[]} rows
 * @param {number} currentSeason football season of today (footballSeasonOfDate)
 * @returns {Map<number, PositionProfile>}
 */
export function buildPositionProfiles(rows, currentSeason) {
  const entriesByPlayer = new Map();

  for (const row of rows || []) {
    const playerId = Number(row?.player_id);
    const season = Number(row?.played_season);
    const starts = Number(row?.starts);
    const code = String(row?.role || "").toUpperCase();
    const name = roleNameFromCode(code);
    if (!Number.isFinite(playerId) || !Number.isFinite(season) || !(starts > 0) || !name) {
      continue;
    }

    if (!entriesByPlayer.has(playerId)) entriesByPlayer.set(playerId, []);
    entriesByPlayer.get(playerId).push({
      season,
      isNationalTeam: row.scope === "nt",
      code,
      name,
      starts,
      firstStart: row.first_start || null,
      lastStart: row.last_start || null,
    });
  }

  const profiles = new Map();
  for (const [playerId, entries] of entriesByPlayer) {
    profiles.set(playerId, buildProfile(entries, Number(currentSeason)));
  }
  return profiles;
}

function buildProfile(entries, currentSeason) {
  const roles = new Map();
  const seasons = new Map();
  let totalWeighted = 0;
  let totalStarts = 0;

  for (const { season, isNationalTeam, code, name, starts, firstStart, lastStart } of entries) {
    const weight = SEASON_DECAY ** Math.max(0, currentSeason - season);
    const role = roles.get(code) ?? { code, name, starts: 0, weighted: 0 };
    role.starts += starts;
    role.weighted += starts * weight;
    roles.set(code, role);
    totalWeighted += starts * weight;
    totalStarts += starts;

    if (!seasons.has(season)) {
      seasons.set(season, { season, firstStart: null, lastStart: null, ntStarts: 0, roles: new Map() });
    }
    const seasonRow = seasons.get(season);
    if (firstStart && (!seasonRow.firstStart || firstStart < seasonRow.firstStart)) seasonRow.firstStart = firstStart;
    if (lastStart && (!seasonRow.lastStart || lastStart > seasonRow.lastStart)) seasonRow.lastStart = lastStart;
    const seasonRole = seasonRow.roles.get(code) ?? { code, name, starts: 0, ntStarts: 0 };
    seasonRole.starts += starts;
    if (isNationalTeam) {
      seasonRole.ntStarts += starts;
      seasonRow.ntStarts += starts;
    }
    seasonRow.roles.set(code, seasonRole);
  }

  const byStarts = (a, b) => b.starts - a.starts || comparePositionsByDisplayOrder(a.name, b.name);
  const ranked = [...roles.values()]
    .map((role) => ({ ...role, share: totalWeighted > 0 ? role.weighted / totalWeighted : 0 }))
    .sort((a, b) => b.weighted - a.weighted || byStarts(a, b));

  const regular = ranked
    .filter((role, index) => index === 0 || (role.share >= MIN_ROLE_SHARE && role.starts >= MIN_ROLE_STARTS))
    .map((role, index) => ({ ...role, isMain: index === 0 }));

  const bySeason = [...seasons.values()]
    .sort((a, b) => b.season - a.season)
    .map(({ roles: seasonRoles, ...seasonRow }) => {
      const seasonList = [...seasonRoles.values()].sort(byStarts);
      return {
        ...seasonRow,
        label: footballSeasonLabel(seasonRow.season),
        total: seasonList.reduce((sum, role) => sum + role.starts, 0),
        roles: seasonList,
      };
    });

  return { main: regular[0].code, roles: regular, bySeason, totalStarts };
}
