const API_XG_INDEX = 16;
const XG_TYPES = new Set(["expected_goals", "expected goals"]);

function parseXg(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function teamSide(match, teamId) {
  const numericTeamId = Number(teamId);
  if (numericTeamId === Number(match?.teams?.home?.id)) return "home";
  if (numericTeamId === Number(match?.teams?.away?.id)) return "away";
  return null;
}

export function getOfficialTeamXg(match, teamId, side = teamSide(match, teamId)) {
  const stats = Array.isArray(match?.statistics) ? match.statistics : [];
  const fallbackEntry = side === "home" ? stats[0] : side === "away" ? stats[1] : undefined;
  const entry = stats.find((item) => Number(item?.team?.id) === Number(teamId)) ?? fallbackEntry;
  const teamStats = Array.isArray(entry?.statistics) ? entry.statistics : [];

  const byType = teamStats.find((item) => XG_TYPES.has(String(item?.type ?? "").toLowerCase()));
  if (byType) return parseXg(byType.value);

  const byIndex = teamStats[API_XG_INDEX];
  return byIndex && !byIndex.type ? parseXg(byIndex.value) : null;
}

export function getFotmobTeamXg(match, teamId, side = teamSide(match, teamId)) {
  if (side === "home") return parseXg(match?.fotmob?.homeXg);
  if (side === "away") return parseXg(match?.fotmob?.awayXg);
  return null;
}

// Official API-Football xG first, FotMob as fallback. Returns a number or null.
export function getTeamXg(match, teamId) {
  const side = teamSide(match, teamId);
  return getOfficialTeamXg(match, teamId, side) ?? getFotmobTeamXg(match, teamId, side);
}

export function getHomeAwayXg(match) {
  return {
    home: getTeamXg(match, match?.teams?.home?.id),
    away: getTeamXg(match, match?.teams?.away?.id),
  };
}

export function formatTeamXg(match, teamId) {
  const xg = getTeamXg(match, teamId);
  return xg === null ? "" : xg.toFixed(2);
}
