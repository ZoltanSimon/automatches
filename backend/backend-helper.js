import { Team } from "../classes/team.js";
import { defaultLeagues } from "./services/leagues-service.js";

export function findOrCreateTeam(teams, teamData) {
  let team = teams.find((t) => t.id === teamData.id);
  if (!team) {
    team = new Team(teamData);
    teams.push(team);
  }
  return team;
}

// Helper function to parse league IDs from query string
export const parseLeagueIds = (leagueQuery) => {
  if (!leagueQuery) return defaultLeagues;

  return leagueQuery
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean);
};

// Helper function to parse date from query string
export const parseDate = (dateQuery) => {
  return dateQuery ? new Date(dateQuery) : new Date();
};

// Centralized error handler
export const handleError = (res, error, message = "Error fetching data") => {
  console.error(message, error);
  res.status(500).send(message);
};

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
    // Midfielders: defensive -> central -> attacking, then side priority.
    return getMidfielderSubtypeOrder(position) * 10 + getSideOrder(position);
  }

  if (group === 1 || group === 3) {
    // Defenders and attackers: right -> center -> left.
    return getSideOrder(position);
  }

  return 0;
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

  return a.localeCompare(b);
}
