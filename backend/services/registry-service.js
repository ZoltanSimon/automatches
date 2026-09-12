import { getLeagueFromDb, getMatchDetailsById, getMatchDetailsByIds } from '../data-access.js';
import { allDBLeagues } from '../lib/catalog.js';

let _registryPromise = null;
let _registry = null;
let _refreshPromise = null;

async function buildRegistryFromCurrentLeagues() {
  const leagueConfigs = await getRegistryLeagueSeasonConfigs();
  return buildMatchRegistry(leagueConfigs);
}

async function getRegistryLeagueSeasonConfigs() {
  const leagues = Array.isArray(allDBLeagues) ? allDBLeagues : [];

  // allDBLeagues.season is resolved from LeagueSeason (latest season first in loadLeagues).
  return leagues
    .map((league) => ({
      leagueID: Number(league.id),
      season: Number(league.season),
    }))
    .filter(({ leagueID, season }) => Number.isFinite(leagueID) && Number.isFinite(season));
}

export async function getRegistry() {
  if (_registry) {
    return _registry;
  }

  if (!_registryPromise) {
    _registryPromise = buildRegistryFromCurrentLeagues()
      .then((registry) => {
        _registry = registry;
        return registry;
      })
      .catch((error) => {
        _registryPromise = null;
        throw error;
      });
  }

  return _registryPromise; // all callers await the same promise
}

export async function refreshRegistry(options = {}) {
  if (_refreshPromise) {
    return _refreshPromise;
  }

  _refreshPromise = (async () => {
    const nextRegistry = await buildRegistryFromCurrentLeagues();
    _registry = nextRegistry;
    _registryPromise = Promise.resolve(nextRegistry);
    console.log("Registry refreshed at", new Date().toISOString());
    return nextRegistry;
  })()
    .catch((error) => {
      console.error("Registry refresh failed:", error);
      if (!_registry) {
        _registryPromise = null;
      }
      throw error;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

export async function forceRefreshRegistry(options = {}) {
  return refreshRegistry(options);
}

function normalizeFixtureAsMatch(fixture) {
  const catalogLeague = (allDBLeagues || []).find(
    (league) => Number(league.id) === Number(fixture?.league?.id),
  );
  const existingLeagueName = typeof fixture?.league?.name === "string" ? fixture.league.name.trim() : "";
  const catalogLeagueName = typeof catalogLeague?.name === "string" ? catalogLeague.name.trim() : "";
  const fulltimeHome = fixture?.score?.fulltime?.home ?? fixture?.goals?.home ?? 0;
  const fulltimeAway = fixture?.score?.fulltime?.away ?? fixture?.goals?.away ?? 0;

  return {
    ...fixture,
    league: {
      ...(fixture?.league ?? {}),
      name: existingLeagueName || catalogLeagueName || fixture?.league?.name,
      country: fixture?.league?.country || catalogLeague?.country,
    },
    score: {
      ...(fixture?.score ?? {}),
      fulltime: {
        home: fulltimeHome,
        away: fulltimeAway,
      },
    },
    statistics: fixture?.statistics?.length >= 2
      ? fixture.statistics
      : [{ statistics: [] }, { statistics: [] }],
  };
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function deepMergeMatch(baseValue, extensionValue) {
  if (extensionValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(extensionValue)) {
    return extensionValue;
  }

  if (!isPlainObject(baseValue) || !isPlainObject(extensionValue)) {
    return extensionValue;
  }

  const merged = { ...baseValue };
  const keys = new Set([...Object.keys(baseValue), ...Object.keys(extensionValue)]);
  for (const key of keys) {
    merged[key] = deepMergeMatch(baseValue[key], extensionValue[key]);
  }

  return merged;
}

function extractSavedMatch(payload) {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  if (Array.isArray(payload?.response)) {
    return payload.response[0] ?? null;
  }

  if (payload?.match && typeof payload.match === "object") {
    const nested = payload.match;
    if (Array.isArray(nested)) {
      return nested[0] ?? null;
    }
    if (Array.isArray(nested?.response)) {
      return nested.response[0] ?? null;
    }
    return nested;
  }

  return payload;
}

export function upsertRegistryMatch(registry, matchPayload) {
  if (!registry || !registry.matchByID) {
    return null;
  }

  const savedMatch = extractSavedMatch(matchPayload);
  if (!savedMatch?.fixture?.id) {
    return null;
  }

  const normalizedMatch = normalizeFixtureAsMatch(savedMatch);
  const idAsNumber = Number(normalizedMatch.fixture.id);
  const idAsString = String(normalizedMatch.fixture.id);

  const existingIndex = registry.matches.findIndex((match) => {
    const matchId = Number(match?.fixture?.id);
    return matchId === idAsNumber || String(match?.fixture?.id) === idAsString;
  });

  if (existingIndex >= 0) {
    registry.matches[existingIndex] = normalizedMatch;
  } else {
    registry.matches.push(normalizedMatch);
  }

  if (!Number.isNaN(idAsNumber)) {
    registry.matchByID.set(idAsNumber, normalizedMatch);
  }
  registry.matchByID.set(idAsString, normalizedMatch);

  return normalizedMatch;
}

export function upsertRegistryMatchIfLoaded(matchPayload) {
  if (!_registry) {
    return null;
  }

  return upsertRegistryMatch(_registry, matchPayload);
}

export async function ensureMatchInRegistry(registry, matchID) {
  if (!registry || !registry.matchByID || !matchID) {
    return null;
  }

  const existingMatch = registry.matchByID.get(matchID) ?? registry.matchByID.get(Number(matchID)) ?? registry.matchByID.get(String(matchID));
  if (existingMatch) {
    return existingMatch;
  }

  const savedMatch = await getMatchDetailsById(matchID);
  if (!savedMatch?.fixture?.id) {
    return null;
  }

  return upsertRegistryMatch(registry, savedMatch);
}

export async function buildMatchRegistry(leagueIDs) {
  const allLeagueMatches = await getLeagueFromDb(leagueIDs);
  const baseMatches = allLeagueMatches
    .map(normalizeFixtureAsMatch)
    .filter((match) => match?.fixture?.id !== undefined && match?.fixture?.id !== null);
  const matchIDs = [...new Set(baseMatches.map(({ fixture }) => fixture.id))];

  const detailedMatches = await getMatchDetailsByIds(matchIDs);
  const detailedMatchByID = new Map(
    detailedMatches
      .filter((match) => match?.fixture?.id != null)
      .map((match) => [String(match.fixture.id), match]),
  );

  const mergedMatches = baseMatches.map((baseMatch) => {
    const detailMatch = detailedMatchByID.get(String(baseMatch.fixture.id));
    const merged = detailMatch ? deepMergeMatch(baseMatch, detailMatch) : baseMatch;
    return normalizeFixtureAsMatch(merged);
  });

  const matchByID = new Map(mergedMatches.map((match) => [match.fixture.id, match]));

  // Add string/number aliases to avoid lookup misses when route query IDs and JSON IDs use different types.
  for (const match of mergedMatches) {
    const idAsNumber = Number(match.fixture.id);
    const idAsString = String(match.fixture.id);

    if (!Number.isNaN(idAsNumber)) {
      matchByID.set(idAsNumber, match);
    }
    matchByID.set(idAsString, match);
  }

  return {
    matches: mergedMatches,
    get matchByID() {
      return matchByID;
    },
  };
}