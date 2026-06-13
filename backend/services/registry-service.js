import {  getLeagueFromDb } from '../data-access.js';
import { getMatchFromServer, saveMatchesToServer } from '../json-reader.js';
import { allDBLeagues } from '../index.js';

let _registryPromise = null;

export function clearRegistryCache() {
  _registryPromise = null;
}

export async function getRegistry() {
  if (!_registryPromise) {
    _registryPromise = buildMatchRegistry(allDBLeagues.map(l => l.id));
  }
  return _registryPromise; // all callers await the same promise
}

export async function refreshRegistry(options = {}) {
  _registryPromise = buildMatchRegistry(allDBLeagues.map(l => l.id), options);
  await _registryPromise;
  console.log("Registry refreshed at", new Date().toISOString());
}

export async function forceRefreshRegistry(options = {}) {
  clearRegistryCache();
  return refreshRegistry(options);
}

setInterval(refreshRegistry, 30 * 60 * 1000);

function normalizeFixtureAsMatch(fixture) {
  return {
    ...fixture,
    score: {
      fulltime: {
        home: fixture?.goals?.home ?? 0,
        away: fixture?.goals?.away ?? 0,
      },
    },
    statistics: fixture?.statistics?.length >= 2
      ? fixture.statistics
      : [{ statistics: [] }, { statistics: [] }],
  };
}

function hasDetailedMatchData(match) {
  const hasPlayers = Array.isArray(match?.players) && match.players.length > 0;
  const hasStatistics = Array.isArray(match?.statistics) && match.statistics.length >= 2;
  const hasLineups = Array.isArray(match?.lineups) && match.lineups.length > 0;
  return hasPlayers || hasStatistics || hasLineups;
}

async function hydrateMatchesFromApi(ids, overwrite = false) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const batchSize = 20;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize).map(String);
    try {
      await saveMatchesToServer(batch, { overwrite });
    } catch (error) {
      console.error(`Failed to hydrate registry matches for batch [${batch.join(",")}]:`, error);
    }
  }
}

export async function buildMatchRegistry(leagueIDs, options = {}) {
  const hydrateMissingFromApi = options.hydrateMissingFromApi !== false;
  const rehydrateIncomplete = options.rehydrateIncomplete === true;

  const allFixtures = await getLeagueFromDb(leagueIDs);
  const completedFixtures = allFixtures.filter(
    ({ fixture }) => ["FT", "AET", "PEN"].includes(fixture.status.short),
  );
  const completedIDs = completedFixtures.map(({ fixture }) => fixture.id);

  const matchByID = new Map(
    completedFixtures.map((fixture) => [fixture.fixture.id, normalizeFixtureAsMatch(fixture)]),
  );

  const results = await Promise.allSettled(
    completedIDs.map(id => getMatchFromServer(id))
  );
  const detailedMatches = [];
  const matchesToHydrate = [];

  results.forEach((r, i) => {
    const fixtureID = completedIDs[i];

    if (r.status === "rejected") {
      console.error(`Failed to read saved match ${fixtureID}:`, r.reason);
      matchesToHydrate.push(fixtureID);
      return;
    }

    const match = r.value?.[0] ?? null;
    if (!match) {
      matchesToHydrate.push(fixtureID);
      return;
    }

    if (rehydrateIncomplete && !hasDetailedMatchData(match)) {
      matchesToHydrate.push(fixtureID);
      return;
    }

    detailedMatches.push(match);
  });

  if (hydrateMissingFromApi && matchesToHydrate.length > 0) {
    await hydrateMatchesFromApi(matchesToHydrate, rehydrateIncomplete);

    const reloaded = await Promise.allSettled(matchesToHydrate.map((id) => getMatchFromServer(id)));
    reloaded.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`Failed to reload hydrated match ${matchesToHydrate[i]}:`, r.reason);
        return;
      }
      const hydratedMatch = r.value?.[0] ?? null;
      if (hydratedMatch) {
        detailedMatches.push(hydratedMatch);
      }
    });
  }

  for (const match of detailedMatches) {
    matchByID.set(match.fixture.id, match);
  }

  const allMatches = completedIDs
    .map((id) => matchByID.get(id))
    .filter(Boolean);

  return {
    fixtures: allFixtures,
    matches: allMatches,
    matchByID,
    fixturesByLeague: Map.groupBy(allFixtures, f => f.league.id),
  };
}