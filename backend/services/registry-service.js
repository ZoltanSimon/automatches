import {  getLeagueFromDb } from '../data-access.js';
import { getMatchFromServer } from '../json-reader.js';
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

export async function buildMatchRegistry(leagueIDs, options = {}) {
  const rehydrateIncomplete = options.rehydrateIncomplete === true;

  const allFixtures = await getLeagueFromDb(leagueIDs);
  const completedFixtures = allFixtures.filter(
    ({ fixture }) => ["FT", "AET", "PEN"].includes(fixture.status.short),
  );
  const completedIDs = completedFixtures.map(({ fixture }) => fixture.id);

  let _matchByID = null;
  let _fixturesByLeague = null;

  function buildMatchByID() {
    if (_matchByID) return _matchByID;
    _matchByID = new Map(
      completedFixtures.map((fixture) => [fixture.fixture.id, normalizeFixtureAsMatch(fixture)]),
    );
    return _matchByID;
  }

  function buildFixturesByLeague() {
    if (_fixturesByLeague) return _fixturesByLeague;
    _fixturesByLeague = Map.groupBy(allFixtures, f => f.league.id);
    return _fixturesByLeague;
  }

  const results = await Promise.allSettled(
    completedIDs.map(id => getMatchFromServer(id))
  );
  const detailedMatches = [];

  results.forEach((r, i) => {
    const fixtureID = completedIDs[i];

    if (r.status === "rejected") {
      console.error(`Failed to read saved match ${fixtureID}:`, r.reason);
      return;
    }

    const match = Array.isArray(r.value)
      ? (r.value[0] ?? null)
      : (r.value ?? null);
    if (!match) {
      return;
    }

    if (rehydrateIncomplete && !hasDetailedMatchData(match)) {
      return;
    }

    detailedMatches.push(match);
  });

  const matchByID = buildMatchByID();
  for (const match of detailedMatches) {
    matchByID.set(match.fixture.id, match);
  }

  const allMatches = completedIDs
    .map((id) => matchByID.get(id))
    .filter(Boolean);

  return {
    fixtures: allFixtures,
    matches: allMatches,
    get matchByID() {
      return buildMatchByID();
    },
    get fixturesByLeague() {
      return buildFixturesByLeague();
    },
  };
}