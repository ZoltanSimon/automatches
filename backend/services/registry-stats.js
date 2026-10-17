import { getCatalogVersion } from "../lib/catalog.js";

// Request-driven keys (league combinations, dates) are unbounded, so the least recently used entries are dropped.
const MAX_STAT_ENTRIES = 300;

export function createRegistryStats() {
  return {
    catalogVersion: getCatalogVersion(),
    entries: new Map(),
    pinned: new Set(),
  };
}

export function clearRegistryStats(registry) {
  registry?.stats?.entries.clear();
  registry?.stats?.pinned?.clear();
}

function evictUnpinnedStats(stats) {
  while (stats.entries.size > MAX_STAT_ENTRIES) {
    let evicted = false;
    for (const key of stats.entries.keys()) {
      if (stats.pinned.has(key)) {
        continue;
      }
      stats.entries.delete(key);
      evicted = true;
      break;
    }
    if (!evicted) {
      break;
    }
  }
}

export function memoizeRegistryStat(registry, key, compute, { pin = false } = {}) {
  const stats = registry?.stats;
  if (!stats) {
    return compute();
  }

  const catalogVersion = getCatalogVersion();
  if (stats.catalogVersion !== catalogVersion) {
    stats.entries.clear();
    stats.pinned.clear();
    stats.catalogVersion = catalogVersion;
  }

  if (stats.entries.has(key)) {
    const cached = stats.entries.get(key);
    stats.entries.delete(key);
    stats.entries.set(key, cached);
    if (pin) {
      stats.pinned.add(key);
    }
    return cached;
  }

  const value = compute();
  stats.entries.set(key, value);
  if (pin) {
    stats.pinned.add(key);
  }
  evictUnpinnedStats(stats);
  return value;
}
