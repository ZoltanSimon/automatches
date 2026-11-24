import { isValidPlayerId } from "./backend-helper.js";

// Lays out both starting XIs of an API-Football match on one horizontal pitch:
// home on the left attacking right, away on the right attacking left.
// Coordinates are percentages of the pitch (the playing area inside the frame).

const FALLBACK_KITS = {
  home: {
    player: { primary: "#1D3557", number: "#FFFFFF", border: "#0B1A2E" },
    goalkeeper: { primary: "#F4D35E", number: "#1D3557", border: "#8A6D00" },
  },
  away: {
    player: { primary: "#E63946", number: "#FFFFFF", border: "#8C1C26" },
    goalkeeper: { primary: "#2A9D8F", number: "#FFFFFF", border: "#145049" },
  },
};

const GK_X = 4.5;
const FIRST_ROW_X = 14;
const LAST_ROW_X = 44;

/**
 * @param {object} matchInfo API-Football fixture object (teams, lineups, events)
 * @param {{ ratingFor?: (team: object, player: object) => ({ value: string, className: string } | null) }} options
 * @returns {{ home: object|null, away: object|null } | null} null when no lineup has grid data
 */
export function buildMatchPitch(matchInfo, { ratingFor } = {}) {
  const lineups = Array.isArray(matchInfo?.lineups) ? matchInfo.lineups : [];
  const homeId = Number(matchInfo?.teams?.home?.id);
  const awayId = Number(matchInfo?.teams?.away?.id);
  const eventStats = collectEventStats(matchInfo?.events);

  const sides = {};
  for (const [side, teamId] of [["home", homeId], ["away", awayId]]) {
    const lineup = lineups.find((entry) => Number(entry?.team?.id) === teamId);
    sides[side] = lineup ? buildTeam(lineup, side, eventStats, ratingFor) : null;
  }

  if (!sides.home && !sides.away) {
    return null;
  }
  return sides;
}

function buildTeam(lineup, side, eventStats, ratingFor) {
  const starters = (Array.isArray(lineup.startXI) ? lineup.startXI : [])
    .map((entry) => entry?.player)
    .filter(Boolean)
    .map((player) => ({ player, grid: parseGrid(player.grid) }));

  // Without a grid for every starter there is no reliable shape to draw.
  if (starters.length === 0 || starters.some((entry) => !entry.grid)) {
    return null;
  }

  const kit = resolveKit(lineup.team?.colors?.player, FALLBACK_KITS[side].player);
  const gkKit = resolveKit(lineup.team?.colors?.goalkeeper, FALLBACK_KITS[side].goalkeeper);

  const maxRow = Math.max(...starters.map((entry) => entry.grid.row));
  const rowSizes = new Map();
  for (const { grid } of starters) {
    rowSizes.set(grid.row, Math.max(rowSizes.get(grid.row) ?? 0, grid.col));
  }

  const players = starters.map(({ player, grid }) => {
    const isGK = grid.row === 1;
    const homeX = rowX(grid.row, maxRow);
    const inRow = rowSizes.get(grid.row);
    // The highest col is the team's right side. Facing right (home), that is the
    // bottom of the pitch; facing left (away), it is the top.
    const slot = side === "home" ? grid.col : inRow + 1 - grid.col;
    const stats = eventStats.lookup(player);
    // { value, className } or null
    const rating = typeof ratingFor === "function" ? ratingFor(lineup.team, player) : null;
    const colours = isGK ? gkKit : kit;

    return {
      id: player.id,
      linkable: isValidPlayerId(player.id),
      number: player.number ?? "",
      fullName: player.name ?? "",
      shortName: shortPlayerName(player.name),
      x: round(side === "home" ? homeX : 100 - homeX),
      y: round(10 + ((slot - 0.5) / inRow) * 80),
      isGK,
      kitStyle: `--kit-1:${colours.primary};--kit-text:${colours.number};--kit-border:${colours.border};`,
      rating,
      goals: stats.goals,
      ownGoals: stats.ownGoals,
      yellow: stats.yellow && !stats.red,
      red: stats.red,
      subOffMinute: stats.subOffMinute,
      hasEvents: stats.goals.length > 0 || stats.ownGoals.length > 0 || stats.yellow || stats.red,
    };
  });

  return {
    teamId: lineup.team?.id,
    name: lineup.team?.name ?? "",
    formation: lineup.formation ?? "",
    kitPrimary: kit.primary,
    players,
  };
}

function rowX(row, maxRow) {
  if (row === 1) return GK_X;
  if (maxRow <= 2) return (FIRST_ROW_X + LAST_ROW_X) / 2;
  return FIRST_ROW_X + ((row - 2) / (maxRow - 2)) * (LAST_ROW_X - FIRST_ROW_X);
}

function parseGrid(grid) {
  const match = /^(\d+):(\d+)$/.exec(String(grid ?? "").trim());
  if (!match) return null;
  const row = Number(match[1]);
  const col = Number(match[2]);
  return row > 0 && col > 0 ? { row, col } : null;
}

function resolveKit(colors, fallback) {
  const primary = hexColour(colors?.primary);
  if (!primary) {
    return fallback;
  }
  return {
    primary,
    number: hexColour(colors?.number) ?? readableTextColour(primary),
    border: hexColour(colors?.border) ?? primary,
  };
}

// API-Football sends colours as hex without the leading "#".
function hexColour(value) {
  const hex = String(value ?? "").trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : null;
}

function readableTextColour(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#000000" : "#FFFFFF";
}

const SURNAME_PARTICLES = new Set(["van", "von", "de", "der", "den", "da", "di", "do", "dos", "das", "del", "della", "le", "la", "ter", "ten", "el", "al", "bin", "ben", "mac", "mc"]);

// The surname as shown on the pitch: "K. Mbappé" -> "Mbappé", "Paul Pogba" -> "Pogba",
// "Virgil van Dijk" -> "van Dijk". Mononyms ("Pedri") stay as they are.
export function shortPlayerName(name) {
  const words = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const withoutInitials = words.filter((word) => !/^\p{L}{1,2}\.$/u.test(word));
  const kept = withoutInitials.length > 0 ? withoutInitials : words;
  if (kept.length <= 1) {
    return kept.join(" ");
  }

  let start = kept.length - 1;
  while (start > 1 && SURNAME_PARTICLES.has(kept[start - 1].toLowerCase())) {
    start--;
  }
  // "Van Dijk" with the given name already stripped: keep the particle too.
  if (start === 1 && SURNAME_PARTICLES.has(kept[0].toLowerCase()) && withoutInitials.length < words.length) {
    start = 0;
  }
  return kept.slice(start).join(" ");
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function nameKey(name) {
  return String(name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function playerKeys(player) {
  const keys = [];
  if (isValidPlayerId(player?.id)) keys.push(`id:${Number(player.id)}`);
  if (player?.name) keys.push(`name:${nameKey(player.name)}`);
  return keys;
}

// Goals, cards and substitutions per player, keyed by id (or name when the API
// has no id). In a "subst" event, `player` is the one going off.
function collectEventStats(events) {
  const byKey = new Map();
  // One stats object per player, reachable by both its id and its name, so a
  // lineup entry without an id still finds its events.
  const statsFor = (player) => {
    const keys = playerKeys(player);
    if (keys.length === 0) return null;
    const stats = keys.map((key) => byKey.get(key)).find(Boolean)
      ?? { goals: [], ownGoals: [], yellow: false, red: false, subOffMinute: null };
    for (const key of keys) byKey.set(key, stats);
    return stats;
  };

  for (const event of Array.isArray(events) ? events : []) {
    const type = String(event?.type ?? "").trim().toLowerCase();
    const detail = String(event?.detail ?? "").trim().toLowerCase();
    const minute = formatMinute(event?.time);
    const stats = statsFor(event?.player);
    if (!stats) continue;

    if (type === "goal") {
      if (detail === "own goal") stats.ownGoals.push(minute);
      else if (!detail.includes("missed")) stats.goals.push(minute);
    } else if (type === "var" && detail === "goal cancelled") {
      // The disallowed goal stays in the feed; drop that player's latest goal.
      if (stats.goals.length > 0) stats.goals.pop();
      else if (stats.ownGoals.length > 0) stats.ownGoals.pop();
    } else if (type === "card") {
      if (detail.includes("red") || detail.includes("second yellow")) stats.red = true;
      else if (detail.includes("yellow")) stats.yellow = true;
    } else if (type === "subst" && stats.subOffMinute == null) {
      stats.subOffMinute = minute;
    }
  }

  const empty = { goals: [], ownGoals: [], yellow: false, red: false, subOffMinute: null };
  return {
    lookup(player) {
      for (const key of playerKeys(player)) {
        if (byKey.has(key)) return byKey.get(key);
      }
      return empty;
    },
  };
}

function formatMinute(time) {
  const elapsed = Number(time?.elapsed);
  if (!Number.isFinite(elapsed)) return "";
  const extra = Number(time?.extra);
  return Number.isFinite(extra) && extra > 0 ? `${elapsed}+${extra}'` : `${elapsed}'`;
}
