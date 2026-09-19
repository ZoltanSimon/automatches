import { allDBLeagues, allDBTeams } from "../lib/catalog.js";
import {
  applyMatchElo,
  CURRENT_SEASON,
  eloSeasonFloor,
  homeAdvantage,
  importanceK,
  INITIAL_ELO,
  isNeutralVenue,
  normalizeScope,
} from "../lib/elo.js";
import {
  ensureEloTables,
  getFinishedMatchesForElo,
  getMaxMatchEloDate,
  getMatchEloRowsByIds,
  getUnprocessedFinishedEloMatchIds,
  loadTeamEloRows,
  replaceEloResults,
  replaceEloScopeResults,
} from "../data-access.js";

let eloWriteQueue = Promise.resolve();

function withEloWriteLock(task) {
  const run = eloWriteQueue.then(task, task);
  eloWriteQueue = run.then(() => undefined, () => undefined);
  return run;
}

function teamIsClub(teamId) {
  const team = allDBTeams.find((row) => Number(row.ID) === Number(teamId));
  if (!team || team.is_club === null || team.is_club === undefined) {
    return null;
  }
  return Number(team.is_club) === 1;
}

function isMixedRoster(homeTeamId, awayTeamId) {
  const homeClub = teamIsClub(homeTeamId);
  const awayClub = teamIsClub(awayTeamId);
  if (homeClub === null || awayClub === null) {
    return false;
  }
  return homeClub !== awayClub;
}

function sortMatches(matches) {
  return [...matches].sort((a, b) => {
    const dateA = new Date(a.match_date).getTime();
    const dateB = new Date(b.match_date).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    return Number(a.id) - Number(b.id);
  });
}

function leagueFromRow(row) {
  const catalog = allDBLeagues.find((league) => Number(league.id) === Number(row.league_id));
  return {
    id: Number(row.league_id),
    name: catalog?.name ?? row.league_name,
    type: catalog?.type ?? row.league_type,
  };
}

function toTeamRows(ratings) {
  return [...ratings.values()].map((entry) => ({
    team_id: entry.teamId,
    scope: entry.scope,
    elo: Number(entry.elo.toFixed(4)),
    matches_played: entry.matchesPlayed,
    last_match_id: entry.lastMatchId,
    last_match_date: entry.lastMatchDate,
  }));
}

function ratingKey(teamId, scope) {
  return `${scope}:${Number(teamId)}`;
}

function getOrCreateRating(ratings, teamId, scope) {
  const key = ratingKey(teamId, scope);
  if (!ratings.has(key)) {
    ratings.set(key, {
      teamId: Number(teamId),
      scope,
      elo: INITIAL_ELO,
      matchesPlayed: 0,
      lastMatchId: null,
      lastMatchDate: null,
    });
  }
  return ratings.get(key);
}

function rowIsNeutralFixture(row) {
  return row?.neutral === true || Number(row?.neutral) === 1;
}

function processMatch(row, ratings) {
  const league = leagueFromRow(row);
  const scope = normalizeScope(league.type);
  if (!scope) {
    return null;
  }
  if (isMixedRoster(row.home_team_id, row.away_team_id)) {
    return null;
  }

  const { band, k } = importanceK(league, row.round);
  const matchLike = {
    fixture: { neutral: rowIsNeutralFixture(row) },
    league: { round: row.round },
  };
  const neutral = isNeutralVenue(matchLike, league, row.round) ? 1 : 0;
  const advantage = homeAdvantage(matchLike, league, row.round);

  const home = getOrCreateRating(ratings, row.home_team_id, scope);
  const away = getOrCreateRating(ratings, row.away_team_id, scope);
  const homeBefore = home.elo;
  const awayBefore = away.elo;
  const updated = applyMatchElo({
    homeElo: homeBefore,
    awayElo: awayBefore,
    homeScore: row.home_score,
    awayScore: row.away_score,
    k,
    advantage,
  });

  home.elo = updated.homeEloAfter;
  away.elo = updated.awayEloAfter;
  home.matchesPlayed += 1;
  away.matchesPlayed += 1;
  home.lastMatchId = row.id;
  away.lastMatchId = row.id;
  home.lastMatchDate = row.match_date;
  away.lastMatchDate = row.match_date;

  return {
    match_id: row.id,
    scope,
    home_team_id: Number(row.home_team_id),
    away_team_id: Number(row.away_team_id),
    home_elo_before: Number(homeBefore.toFixed(4)),
    away_elo_before: Number(awayBefore.toFixed(4)),
    home_elo_after: Number(updated.homeEloAfter.toFixed(4)),
    away_elo_after: Number(updated.awayEloAfter.toFixed(4)),
    k_factor: k,
    importance_band: band,
    home_advantage: advantage,
    neutral,
    expected_home: Number(updated.expectedHome.toFixed(6)),
    match_date: row.match_date,
  };
}

async function loadRatings(scope = null) {
  const rows = await loadTeamEloRows(scope);
  const ratings = new Map();
  for (const row of rows) {
    ratings.set(ratingKey(row.team_id, row.scope), {
      teamId: Number(row.team_id),
      scope: row.scope,
      elo: Number(row.elo),
      matchesPlayed: Number(row.matches_played) || 0,
      lastMatchId: row.last_match_id,
      lastMatchDate: row.last_match_date,
    });
  }
  return ratings;
}

function storedEloMismatch(row, existing) {
  const league = leagueFromRow(row);
  const { k } = importanceK(league, row.round);
  const matchLike = {
    fixture: { neutral: rowIsNeutralFixture(row) },
    league: { round: row.round },
  };
  const advantage = homeAdvantage(matchLike, league, row.round);
  const updated = applyMatchElo({
    homeElo: Number(existing.home_elo_before),
    awayElo: Number(existing.away_elo_before),
    homeScore: row.home_score,
    awayScore: row.away_score,
    k,
    advantage,
  });

  return (
    Math.abs(updated.homeEloAfter - Number(existing.home_elo_after)) > 0.02
    || Math.abs(updated.awayEloAfter - Number(existing.away_elo_after)) > 0.02
    || Number(existing.k_factor) !== k
    || Number(existing.home_advantage) !== advantage
  );
}

async function replayEloUnlocked({ scope = null, dryRun = false } = {}) {
  await ensureEloTables();
  const seasonFloor = eloSeasonFloor();
  const rows = sortMatches(await getFinishedMatchesForElo({ seasonFloor, scope }));
  const ratings = new Map();
  const matchRows = [];
  let skippedMixed = 0;
  let skippedScope = 0;

  for (const row of rows) {
    const league = leagueFromRow(row);
    const matchScope = normalizeScope(league.type);
    if (!matchScope || (scope && matchScope !== scope)) {
      skippedScope += 1;
      continue;
    }
    const processed = processMatch(row, ratings);
    if (!processed) {
      skippedMixed += 1;
      continue;
    }
    matchRows.push(processed);
  }

  if (!dryRun) {
    await replaceEloScopeResults({
      scope,
      teamRows: toTeamRows(ratings),
      matchRows,
    });
  }

  return {
    seasonFloor,
    currentSeason: CURRENT_SEASON,
    considered: rows.length,
    applied: matchRows.length,
    skippedMixed,
    skippedScope,
    teams: ratings.size,
    dryRun,
    scope: scope ?? "all",
  };
}

async function applyEloForFinishedMatchesUnlocked(matchIds) {
  const ids = [...new Set((Array.isArray(matchIds) ? matchIds : [matchIds]).map((id) => Number(id)).filter(Number.isFinite))];
  if (ids.length === 0) {
    return { applied: 0, skipped: 0, replayed: [] };
  }

  await ensureEloTables();
  const seasonFloor = eloSeasonFloor();
  const rows = sortMatches(await getFinishedMatchesForElo({ matchIds: ids }));
  const processedRows = await getMatchEloRowsByIds(ids);
  const pending = [];
  const staleScopes = new Set();

  for (const row of rows) {
    if (Number(row.season) < seasonFloor) {
      continue;
    }
    const matchScope = normalizeScope(leagueFromRow(row).type);
    if (!matchScope) {
      continue;
    }

    const existing = processedRows.get(Number(row.id));
    if (existing) {
      if (storedEloMismatch(row, existing)) {
        staleScopes.add(matchScope);
      }
      continue;
    }
    pending.push(row);
  }

  if (pending.length === 0 && staleScopes.size === 0) {
    return { applied: 0, skipped: ids.length, replayed: [] };
  }

  const replayed = [];
  const scopes = new Set([
    ...pending.map((row) => normalizeScope(leagueFromRow(row).type)).filter(Boolean),
    ...staleScopes,
  ]);

  for (const pendingScope of scopes) {
    const scopeRows = pending.filter((row) => normalizeScope(leagueFromRow(row).type) === pendingScope);
    const oldest = scopeRows[0]?.match_date;
    const maxDate = await getMaxMatchEloDate(pendingScope);
    const outOfOrder = oldest && maxDate && new Date(oldest).getTime() < new Date(maxDate).getTime();

    if (outOfOrder || staleScopes.has(pendingScope)) {
      await replayEloUnlocked({ scope: pendingScope });
      replayed.push(pendingScope);
    }
  }

  if (replayed.length === scopes.size) {
    return { applied: pending.length + staleScopes.size, skipped: ids.length - pending.length, replayed };
  }

  const remainingScopes = [...scopes].filter((value) => !replayed.includes(value));
  const ratings = await loadRatings();
  const matchRows = [];

  for (const row of pending) {
    const matchScope = normalizeScope(leagueFromRow(row).type);
    if (!remainingScopes.includes(matchScope)) {
      continue;
    }
    const processed = processMatch(row, ratings);
    if (processed) {
      matchRows.push(processed);
    }
  }

  const touchedKeys = new Set();
  for (const row of matchRows) {
    touchedKeys.add(ratingKey(row.home_team_id, row.scope));
    touchedKeys.add(ratingKey(row.away_team_id, row.scope));
  }

  const teamRows = toTeamRows(ratings).filter((row) => touchedKeys.has(ratingKey(row.team_id, row.scope)));
  if (matchRows.length > 0) {
    await replaceEloResults({ teamRows, matchRows });
  }

  return {
    applied: matchRows.length,
    skipped: ids.length - matchRows.length,
    replayed,
  };
}

export async function replayElo({ scope = null, dryRun = false } = {}) {
  return withEloWriteLock(() => replayEloUnlocked({ scope, dryRun }));
}

export async function applyEloForFinishedMatches(matchIds) {
  return withEloWriteLock(() => applyEloForFinishedMatchesUnlocked(matchIds));
}

export async function applyPendingElo({ scope = null, dryRun = false } = {}) {
  await ensureEloTables();
  const seasonFloor = eloSeasonFloor();
  const ids = await getUnprocessedFinishedEloMatchIds({ seasonFloor, scope });
  if (dryRun) {
    return {
      seasonFloor,
      currentSeason: CURRENT_SEASON,
      pending: ids.length,
      applied: 0,
      dryRun: true,
      scope: scope ?? "all",
    };
  }

  const result = await applyEloForFinishedMatches(ids);
  return {
    seasonFloor,
    currentSeason: CURRENT_SEASON,
    pending: ids.length,
    scope: scope ?? "all",
    ...result,
  };
}

export async function applyEloForMatchPayloads(matchPayloads) {
  const ids = (Array.isArray(matchPayloads) ? matchPayloads : [matchPayloads])
    .map((match) => Number(match?.fixture?.id))
    .filter(Number.isFinite);
  try {
    return await applyEloForFinishedMatches(ids);
  } catch (error) {
    console.error("Failed to apply Elo after match persist:", error);
    return { applied: 0, skipped: ids.length, error: error.message };
  }
}
