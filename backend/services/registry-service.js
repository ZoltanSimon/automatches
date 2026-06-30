import {  getLeagueFromDb } from '../data-access.js';
import { getMatchFromServer } from '../json-reader.js';
import { allDBLeagues } from '../index.js';

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
  const fulltimeHome = fixture?.score?.fulltime?.home ?? fixture?.goals?.home ?? 0;
  const fulltimeAway = fixture?.score?.fulltime?.away ?? fixture?.goals?.away ?? 0;

  return {
    ...fixture,
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
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

export async function ensureMatchInRegistry(registry, matchID) {
  if (!registry || !registry.matchByID || !matchID) {
    return null;
  }

  const existingMatch = registry.matchByID.get(matchID) ?? registry.matchByID.get(Number(matchID)) ?? registry.matchByID.get(String(matchID));
  if (existingMatch) {
    return existingMatch;
  }

  const savedMatchPayload = await getMatchFromServer(matchID);
  const savedMatch = extractSavedMatch(savedMatchPayload);
  if (!savedMatch?.fixture?.id) {
    return null;
  }

  const normalizedMatch = normalizeFixtureAsMatch(savedMatch);
  const idAsNumber = Number(normalizedMatch.fixture.id);
  const idAsString = String(normalizedMatch.fixture.id);

  const alreadyInRegistry = registry.matchByID.get(idAsNumber) || registry.matchByID.get(idAsString);
  if (!alreadyInRegistry) {
    registry.matches.push(normalizedMatch);
  }

  if (!Number.isNaN(idAsNumber)) {
    registry.matchByID.set(idAsNumber, normalizedMatch);
  }
  registry.matchByID.set(idAsString, normalizedMatch);

  return normalizedMatch;
}

export async function buildMatchRegistry(leagueIDs) {
  const allLeagueMatches = await getLeagueFromDb(leagueIDs);
  const baseMatches = allLeagueMatches
    .map(normalizeFixtureAsMatch)
    .filter((match) => match?.fixture?.id !== undefined && match?.fixture?.id !== null);
  const matchIDs = [...new Set(baseMatches.map(({ fixture }) => fixture.id))];

  const detailedMatchByID = new Map();
  const batchSize = 150;

  for (let i = 0; i < matchIDs.length; i += batchSize) {
    const idBatch = matchIDs.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      idBatch.map((id) => getMatchFromServer(id)),
    );

    results.forEach((result, index) => {
      const fixtureID = idBatch[index];

      if (result.status === "rejected") {
        console.error(`Failed to read saved match ${fixtureID}:`, result.reason);
        return;
      }

      const match = extractSavedMatch(result.value);
      if (!match?.fixture?.id) {
        return;
      }

      detailedMatchByID.set(String(match.fixture.id), match);
    });
  }

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