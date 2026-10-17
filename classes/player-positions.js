import { LineupParser } from "./lineupparser.js";

export const POSITION_FILTER_GROUPS = [
  { id: 0, label: "Goalkeeper" },
  { id: 1, label: "Defender" },
  { id: 2, label: "Midfielder" },
  { id: 3, label: "Attacker" },
];

const PLAYER_POSITION_LABELS = {
  g: "Goalkeeper",
  gk: "Goalkeeper",
  d: "Defender",
  m: "Midfielder",
  f: "Forward",
  attacker: "Forward",
};

const PLAYER_POSITION_ABBREVIATIONS = {
  goalkeeper: "GK",
  "right back": "RB",
  "left back": "LB",
  "center back": "CB",
  "centre back": "CB",
  "right wing back": "RWB",
  "left wing back": "LWB",
  "defensive midfielder": "DM",
  "central midfielder": "CM",
  "attacking midfielder": "AM",
  "right midfielder": "RM",
  "left midfielder": "LM",
  "right winger": "RW",
  "left winger": "LW",
  striker: "ST",
  defender: "DF",
  midfielder: "MF",
  forward: "FW",
  attacker: "FW",
};

function toTrimmedString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizePlayerPositionToken(position) {
  const trimmed = toTrimmedString(position);
  if (!trimmed) {
    return "";
  }

  return PLAYER_POSITION_LABELS[trimmed.toLowerCase()] || trimmed;
}

export function formatPlayerPosition(positionValue) {
  if (Array.isArray(positionValue)) {
    return positionValue
      .map((position) => normalizePlayerPositionToken(position))
      .filter(Boolean)
      .join(", ");
  }

  const trimmed = toTrimmedString(positionValue);
  if (!trimmed) {
    return "";
  }

  return trimmed
    .split(",")
    .map((position) => normalizePlayerPositionToken(position))
    .filter(Boolean)
    .join(", ");
}

export function abbreviatePlayerPosition(positionValue) {
  const fullName = formatPlayerPosition(positionValue).split(",")[0].trim();
  if (!fullName) {
    return "";
  }

  return PLAYER_POSITION_ABBREVIATIONS[fullName.toLowerCase()] || fullName;
}

export function getPositionGroupOrder(position) {
  const normalized = String(position || "").toLowerCase();

  if (normalized.includes("goalkeeper")) return 0;

  const isDefender =
    normalized.includes("back") ||
    normalized.includes("center back") ||
    normalized.includes("defender");
  if (isDefender) return 1;

  const isMidfielder = normalized.includes("midfielder");
  if (isMidfielder) return 2;

  const isAttacker =
    normalized.includes("striker") ||
    normalized.includes("winger") ||
    normalized.includes("forward");
  if (isAttacker) return 3;

  return 4;
}

function getSideOrder(position) {
  const normalized = String(position || "").toLowerCase();

  if (normalized.includes("right")) return 0;
  if (normalized.includes("center") || normalized.includes("centre") || normalized.includes("central") || normalized.includes("striker") || normalized.includes("forward")) return 1;
  if (normalized.includes("left")) return 2;

  return 1;
}

function getMidfielderSubtypeOrder(position) {
  const normalized = String(position || "").toLowerCase();

  if (normalized.includes("defensive midfielder")) return 0;
  if (normalized.includes("central midfielder")) return 1;
  if (normalized.includes("attacking midfielder")) return 2;

  return 3;
}

function getPositionDetailOrder(position) {
  const group = getPositionGroupOrder(position);

  if (group === 2) {
    return getMidfielderSubtypeOrder(position) * 10 + getSideOrder(position);
  }

  if (group === 1 || group === 3) {
    return getSideOrder(position);
  }

  return 0;
}

export function buildPositionFilterOptions() {
  const uniquePositions = [...new Set(
    LineupParser.formations.flatMap((formation) => formation.positions),
  )]
    .filter((position) => position && position !== "Unknown" && !String(position).includes(","))
    .sort(comparePositionsByDisplayOrder);

  return uniquePositions
    .map((position) => ({
      value: position.toLowerCase(),
      label: position,
      abbreviation: abbreviatePlayerPosition(position),
      group: getPositionGroupOrder(position),
    }))
    .filter((option) => option.group >= 0 && option.group <= 3);
}

export function comparePositionsByDisplayOrder(a, b) {
  const groupDiff = getPositionGroupOrder(a) - getPositionGroupOrder(b);
  if (groupDiff !== 0) {
    return groupDiff;
  }

  const detailDiff = getPositionDetailOrder(a) - getPositionDetailOrder(b);
  if (detailDiff !== 0) {
    return detailDiff;
  }

  return String(a || "").localeCompare(String(b || ""));
}
