import { buildTeamList } from "../services/json-reader.js";
import { memoizeRegistryStat } from "../services/registry-stats.js";
export {
  abbreviatePlayerPosition,
  comparePositionsByDisplayOrder,
  formatPlayerPosition,
  getPositionGroupOrder,
} from "../../classes/player-positions.js";

// Helper function to parse date from query string
export const parseDate = (dateQuery) => {
  return dateQuery ? new Date(dateQuery) : new Date();
};

// Centralized error handler
export const handleError = (res, error, message = "Error fetching data") => {
  console.error(message, error);
  res.status(500).send(message);
};

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isLocalRequest(request) {
  const ip = String(request.ip || request.socket?.remoteAddress || "").toLowerCase();
  const hostname = String(request.hostname || "").toLowerCase();

  return LOCAL_IPS.has(ip) || hostname === "localhost";
}

export function localhostOnly(request, response, next) {
  if (!isLocalRequest(request)) {
    return response.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  next();
}

export function toTrimmedString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseStringList(value) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value ?? "").split(",");

  return rawValues
    .map((item) => toTrimmedString(item))
    .filter(Boolean);
}

export function parseLowercaseStringList(value, unique = false) {
  const normalized = parseStringList(value).map((item) => item.toLowerCase());
  return unique ? [...new Set(normalized)] : normalized;
}

export function toShirtNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function toIntegerValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const match = String(value).match(/-?\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mergeProfileValue(existingValue, nextValue) {
  return nextValue !== null && nextValue !== undefined ? nextValue : existingValue;
}

export function extractPlayerProfile(playerPayload, options = {}) {
  const { resolveNationId } = options;
  const player = playerPayload?.player || playerPayload;
  const id = Number(player?.id);

  if (!Number.isFinite(id)) {
    return null;
  }

  const birthPlace = toTrimmedString(player?.birth?.place);
  const birthCountry = toTrimmedString(player?.birth?.country);
  const birthLocation = [birthPlace, birthCountry].filter(Boolean).join(", ") || null;

  const shirtNumber = Array.isArray(playerPayload?.statistics)
    ? playerPayload.statistics
      .map((stat) => toShirtNumber(stat?.games?.number))
      .find((number) => number !== null) ?? null
    : null;

  const nationality = toTrimmedString(player?.nationality);
  const nation = typeof resolveNationId === "function"
    ? resolveNationId(nationality)
    : null;

  return {
    id,
    firstName: toTrimmedString(player?.firstname),
    lastName: toTrimmedString(player?.lastname),
    birthDate: toTrimmedString(player?.birth?.date),
    birthLocation,
    height: toIntegerValue(player?.height),
    weight: toIntegerValue(player?.weight),
    nation,
    shirtNumber,
  };
}

function isWorldCupGroupMatch(match) {
  const roundName = String(match?.league?.round || "").toLowerCase();
  return (
    match?.league?.id === 1 &&
    ["FT", "AET", "PEN"].includes(match?.fixture?.status?.short) &&
    roundName.includes("group")
  );
}

export function mergeWorldCupGroupStandings(baseGroups, registry) {
  if (!Array.isArray(baseGroups) || baseGroups.length === 0) {
    return [];
  }

  const computedTeams = memoizeRegistryStat(registry, "teams:world-cup-groups", () => {
    const completedGroupMatches = registry.matches
      .filter(isWorldCupGroupMatch)
      .filter((match) => match?.teams?.home && match?.teams?.away);

    return new Map(
      buildTeamList(completedGroupMatches).map((team) => [Number(team.id), team]),
    );
  });

  return baseGroups.map((group) => {
    if (!Array.isArray(group) || group.length === 0) {
      return group;
    }

    const mergedGroup = group.map((baseTeam, index) => {
      const teamID = Number(baseTeam?.team?.id);
      const computedTeam = computedTeams.get(teamID);
      const baseGoalsFor = Number(baseTeam?.goals?.for ?? 0);
      const baseGoalsAgainst = Number(baseTeam?.goals?.against ?? 0);

      if (!computedTeam) {
        return {
          ...baseTeam,
          rank: baseTeam.rank ?? index + 1,
          goalsDiff: baseTeam.goalsDiff ?? baseGoalsFor - baseGoalsAgainst,
          all: {
            ...(baseTeam.all ?? {}),
            played: baseTeam.all?.played ?? 0,
          },
        };
      }

      const played = Number(computedTeam.played ?? baseTeam.all?.played ?? 0);
      const goalsFor = Number(computedTeam.total?.goals ?? baseGoalsFor);
      const goalsAgainst = Number(
        computedTeam.total?.goalsAgainst ?? baseGoalsAgainst,
      );

      return {
        ...baseTeam,
        ...computedTeam,
        team: baseTeam.team ?? {
          id: computedTeam.id,
          name: computedTeam.name,
          logo: computedTeam.logo,
        },
        rank: baseTeam.rank ?? index + 1,
        played,
        points: Number(computedTeam.total?.points ?? baseTeam.points ?? 0),
        form: computedTeam.form || baseTeam.form || "",
        goalsDiff: goalsFor - goalsAgainst,
        all: {
          ...(baseTeam.all ?? {}),
          played,
          win: computedTeam.wins ?? baseTeam.all?.win ?? 0,
          draw: computedTeam.draws ?? baseTeam.all?.draw ?? 0,
          lose: computedTeam.losses ?? baseTeam.all?.lose ?? 0,
        },
        goals: {
          ...(baseTeam.goals ?? {}),
          for: goalsFor,
          against: goalsAgainst,
        },
        total: {
          ...(computedTeam.total ?? {}),
          goals: goalsFor,
          goalsAgainst,
        },
      };
    });

    mergedGroup.sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsDiff - a.goalsDiff ||
        Number(b.goals?.for ?? 0) - Number(a.goals?.for ?? 0) ||
        Number(a.rank ?? Number.MAX_SAFE_INTEGER) -
          Number(b.rank ?? Number.MAX_SAFE_INTEGER),
    );

    return mergedGroup.map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
  });
}
