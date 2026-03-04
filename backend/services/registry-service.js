import {  getLeagueFromDb } from '../data-access.js';
import { getMatchFromServer } from '../json-reader.js';
import { allDBLeagues } from '../index.js';

let _registryPromise = null;

export async function getRegistry() {
  if (!_registryPromise) {
    _registryPromise = buildMatchRegistry(allDBLeagues.map(l => l.id));
  }
  return _registryPromise; // all callers await the same promise
}

export async function refreshRegistry() {
  _registryPromise = buildMatchRegistry(allDBLeagues.map(l => l.id));
  await _registryPromise;
  console.log("Registry refreshed at", new Date().toISOString());
}

setInterval(refreshRegistry, 30 * 60 * 1000);

export async function buildMatchRegistry(leagueIDs) {
  const allFixtures = await getLeagueFromDb(leagueIDs);
  // Only fetch match data for completed fixtures
  const completedIDs = allFixtures
    .filter(({ fixture }) => ["FT", "AET", "PEN"].includes(fixture.status.short))
    .map(({ fixture }) => fixture.id);
  const results = await Promise.allSettled(
    completedIDs.map(id => getMatchFromServer(id))
  );
  const allMatches = results
    .map((r, i) => {
      if (r.status === "rejected") {
        console.error(`Failed to fetch match ${completedIDs[i]}:`, r.reason);
        return null;
      }
      return r.value?.[0] ?? null;
    })
    .filter(Boolean);
  return {
    fixtures: allFixtures,
    matches: allMatches,
    matchByID: new Map(allMatches.map(m => [m.fixture.id, m])),
    fixturesByLeague: Map.groupBy(allFixtures, f => f.league.id),
  };
}