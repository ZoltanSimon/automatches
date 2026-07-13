import { buildTeamList } from "./json-reader.js";

// Helper function to parse date from query string
export const parseDate = (dateQuery) => {
  return dateQuery ? new Date(dateQuery) : new Date();
};

// Centralized error handler
export const handleError = (res, error, message = "Error fetching data") => {
  console.error(message, error);
  res.status(500).send(message);
};

export function toTrimmedString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
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

  const completedGroupMatches = registry.matches
    .filter(isWorldCupGroupMatch)
    .filter((match) => match?.teams?.home && match?.teams?.away);

  const computedTeams = new Map(
    buildTeamList(completedGroupMatches).map((team) => [Number(team.id), team]),
  );

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

export async function dumpRegistryOnStartup(registry) {
  const dumpPath = path.join(__dirname, "../data/registry-startup.json");
  const fileHandle = await open(dumpPath, "w");

  const writeChunk = async (chunk) => {
    await fileHandle.write(chunk);
  };

  try {
    await writeChunk("{\n");
    await writeChunk(`  \"generatedAt\": ${JSON.stringify(new Date().toISOString())},\n`);

    await writeChunk("  \"matches\": [\n");
    for (let i = 0; i < registry.matches.length; i += 1) {
      const suffix = i < registry.matches.length - 1 ? ",\n" : "\n";
      await writeChunk(`    ${JSON.stringify(registry.matches[i])}${suffix}`);
    }
    await writeChunk("  ],\n");

    const matchEntries = [...registry.matchByID.entries()];
    await writeChunk("  \"matchByID\": {\n");
    for (let i = 0; i < matchEntries.length; i += 1) {
      const [matchID, match] = matchEntries[i];
      const suffix = i < matchEntries.length - 1 ? ",\n" : "\n";
      await writeChunk(`    ${JSON.stringify(String(matchID))}: ${JSON.stringify(match)}${suffix}`);
    }
    await writeChunk("  }\n");
    await writeChunk("}\n");
  } finally {
    await fileHandle.close();
  }

  console.log(`Registry startup dump written to ${dumpPath}`);
}
