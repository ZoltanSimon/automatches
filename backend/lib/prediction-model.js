import { getHomeAwayXg } from "./match-xg.js";
import { expectedHomeScore, isNeutralVenue } from "./elo.js";

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── PREDICTION SETTINGS ─────────────────────────────────────────────────────
// Weights are in the range 0–1; *_STRENGTH values are the maximum ± change to a team's λ.

export const SETTINGS = {
  LAST_N_MATCHES: 6,
  LAST_N_WEIGHT: 0.40,
  CORNERS_RECENCY: 0.50,
  SHOTS_RECENCY: 0.50,
  POSSESSION_RECENCY: 0.40,

  // Attack/defence rates blend xG with actual goals; one λ pair drives score and probabilities.
  XG_VS_GOALS_BLEND: 0.70,
  HOME_ADVANTAGE: 0.11,
  REFERENCE_FALLBACK: 1.35,

  // Pull noisy attack/defence rates toward the league mean before multiplying.
  MEAN_REVERSION: 0.35,

  // Form is already partly in recency-weighted averages; keep this small.
  FORM_STRENGTH: 0.08,
  ELO_STRENGTH: 0.08,
  H2H_STRENGTH: 0.04,
  H2H_MAX_MEETINGS: 6,
  H2H_DECAY: 0.8,
  // λ penalty by days since the last match; longer rest has no effect.
  REST_PENALTY: { 3: 0.04, 4: 0.02 },

  LAMBDA_MIN: 0.45,
  LAMBDA_MAX: 2.70,

  // Call a draw when home and away win chances are this close. A draw is rarely the single
  // most likely outcome under Poisson; 0.115 was calibrated to call ~25% of games a draw.
  DRAW_MARGIN: 0.115,
};
// ─────────────────────────────────────────────────────────────────────────────

const round1 = (v) => Math.round(v * 10) / 10;

function clampLambda(value) {
  return Math.min(SETTINGS.LAMBDA_MAX, Math.max(SETTINGS.LAMBDA_MIN, value));
}

function shrinkTowardMean(value, mean, weight) {
  return value * (1 - weight) + mean * weight;
}

function blendXg(xg, goals) {
  return xg * SETTINGS.XG_VS_GOALS_BLEND + goals * (1 - SETTINGS.XG_VS_GOALS_BLEND);
}

// Win = 1, draw = 0.5, loss = 0.
function resultPoints(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 1;
  if (goalsFor === goalsAgainst) return 0.5;
  return 0;
}

// ── Per-match stat extraction ─────────────────────────────────────────────────

// Index fallback is for stored rows that carry values without a type label.
const STAT_SPECS = {
  shotsOnGoal: { type: "shots on goal", index: 0 },
  corners:     { type: "corner kicks", index: 7 },
  possession:  { type: "ball possession", index: 9 },
};

function teamStatistics(match, teamId) {
  const entry = (match.statistics ?? []).find((item) => Number(item?.team?.id) === Number(teamId));
  return Array.isArray(entry?.statistics) && entry.statistics.length > 0 ? entry.statistics : null;
}

function readStat(teamStats, { type, index }) {
  const byIndex = teamStats[index];
  const entry = teamStats.find((item) => String(item?.type ?? "").toLowerCase() === type)
    ?? (byIndex && !byIndex.type ? byIndex : null);
  const value = Number.parseFloat(entry?.value);
  return Number.isFinite(value) ? value : null;
}

// The API reports zero counts as null, so a missing count is 0 when the team has statistics at all.
function readCount(teamStats, spec) {
  return teamStats ? readStat(teamStats, spec) ?? 0 : null;
}

function extractTeamMatchStats(match, teamId) {
  const isHome = Number(match.teams.home.id) === Number(teamId);
  const opponentId = isHome ? match.teams.away.id : match.teams.home.id;
  const score = match.score?.fulltime ?? match.goals;
  const goalsFor = score?.[isHome ? "home" : "away"];
  const goalsAgainst = score?.[isHome ? "away" : "home"];
  if (!Number.isFinite(goalsFor) || !Number.isFinite(goalsAgainst)) {
    return null;
  }

  const xg = getHomeAwayXg(match);
  const mine = teamStatistics(match, teamId);
  const theirs = teamStatistics(match, opponentId);
  return {
    goalsFor,
    goalsAgainst,
    xG:                 isHome ? xg.home : xg.away,
    xGA:                isHome ? xg.away : xg.home,
    shotsOnGoal:        readCount(mine, STAT_SPECS.shotsOnGoal),
    shotsOnGoalAgainst: readCount(theirs, STAT_SPECS.shotsOnGoal),
    corners:            readCount(mine, STAT_SPECS.corners),
    cornersAgainst:     readCount(theirs, STAT_SPECS.corners),
    possession:         mine ? readStat(mine, STAT_SPECS.possession) : null,
  };
}

// Finished matches the team played before the fixture, oldest first.
export function teamHistory(matches, teamId, fixture) {
  const before = new Date(fixture?.date).getTime();
  return matches
    .filter((m) => FINISHED_STATUSES.has(m?.fixture?.status?.short))
    .filter((m) => m.fixture.id !== fixture?.id)
    .filter((m) => !Number.isFinite(before) || new Date(m.fixture.date).getTime() < before)
    .filter((m) => m.teams.home.id === teamId || m.teams.away.id === teamId)
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
    .map((m) => extractTeamMatchStats(m, teamId))
    .filter(Boolean);
}

// ── League reference ──────────────────────────────────────────────────────────

// Mean blended rate per team per match — denominator of the multiplicative model.
export function leagueReference(matches) {
  let goals = 0;
  let goalCount = 0;
  let xg = 0;
  let xgCount = 0;
  for (const match of matches) {
    if (!FINISHED_STATUSES.has(match?.fixture?.status?.short)) continue;
    const h = match.score?.fulltime?.home;
    const a = match.score?.fulltime?.away;
    if (Number.isFinite(h) && Number.isFinite(a)) {
      goals += h + a;
      goalCount += 2;
    }
    const matchXg = getHomeAwayXg(match);
    for (const value of [matchXg.home, matchXg.away]) {
      if (value !== null && value > 0) {
        xg += value;
        xgCount++;
      }
    }
  }
  const referenceGoals = goalCount > 10 ? goals / goalCount : SETTINGS.REFERENCE_FALLBACK;
  const referenceXg = xgCount > 10 ? xg / xgCount : referenceGoals;
  return blendXg(referenceXg, referenceGoals);
}

// ── Weighted averages ─────────────────────────────────────────────────────────

function mean(rows, key) {
  const values = rows.map((row) => row[key]).filter(Number.isFinite);
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

function recencyMean(rows, key, recentWeight = SETTINGS.LAST_N_WEIGHT) {
  const all = mean(rows, key);
  const recent = mean(rows.slice(-SETTINGS.LAST_N_MATCHES), key);
  if (all === null || recent === null) return all;
  return recent * recentWeight + all * (1 - recentWeight);
}

function teamAverages(history) {
  const recent = history.slice(-SETTINGS.LAST_N_MATCHES);
  const goals = recencyMean(history, "goalsFor");
  const goalsAgainst = recencyMean(history, "goalsAgainst");
  return {
    goals,
    goalsAgainst,
    // Teams without any xG data fall back to actual goals.
    xG:                 recencyMean(history, "xG") ?? goals,
    xGA:                recencyMean(history, "xGA") ?? goalsAgainst,
    shotsOnGoal:        recencyMean(history, "shotsOnGoal", SETTINGS.SHOTS_RECENCY),
    shotsOnGoalAgainst: recencyMean(history, "shotsOnGoalAgainst", SETTINGS.SHOTS_RECENCY),
    corners:            recencyMean(history, "corners", SETTINGS.CORNERS_RECENCY),
    cornersAgainst:     recencyMean(history, "cornersAgainst", SETTINGS.CORNERS_RECENCY),
    possession:         recencyMean(history, "possession", SETTINGS.POSSESSION_RECENCY),
    recentCount:        recent.length,
    recentGoals:        mean(recent, "goalsFor"),
    recentConceded:     mean(recent, "goalsAgainst"),
  };
}

// ── Base λ ────────────────────────────────────────────────────────────────────

// Attack × opponent defence / league reference, shrunk toward the mean so a couple
// of 4–5 thrillers cannot produce basketball scorelines.
function baseLambdas(homeAvg, awayAvg, reference, neutral) {
  const rate = (value) => shrinkTowardMean(value, reference, SETTINGS.MEAN_REVERSION);
  const attack = (avg) => rate(blendXg(avg.xG, avg.goals));
  const defence = (avg) => rate(blendXg(avg.xGA, avg.goalsAgainst));
  const homeAdvantage = neutral ? 0 : SETTINGS.HOME_ADVANTAGE;
  return {
    home: (attack(homeAvg) * defence(awayAvg)) / reference + homeAdvantage,
    away: (attack(awayAvg) * defence(homeAvg)) / reference,
    homeAdvantage,
  };
}

// ── Factor multipliers ────────────────────────────────────────────────────────
// Each returns { home, away, ...details }; 1.0 means no effect.

const NO_EFFECT = { home: 1, away: 1 };

// edge in [-1, 1]: positive favours the home team, the away team gets the mirror.
function mirrored(edge, strength) {
  return { home: 1 + edge * strength, away: 1 - edge * strength };
}

function formShare(history) {
  const recent = history.slice(-SETTINGS.LAST_N_MATCHES);
  if (!recent.length) return null;
  return recent.reduce((sum, s) => sum + resultPoints(s.goalsFor, s.goalsAgainst), 0) / recent.length;
}

// Each team on its own recent W/D/L record, in range [1 - strength, 1 + strength].
function formFactor(homeHistory, awayHistory) {
  const multiplier = (share) => (share === null ? 1 : 1 + (share - 0.5) * 2 * SETTINGS.FORM_STRENGTH);
  const homeShare = formShare(homeHistory);
  const awayShare = formShare(awayHistory);
  return { home: multiplier(homeShare), away: multiplier(awayShare), homeShare, awayShare };
}

function eloFactor(elo) {
  const homeElo = Number(elo?.home);
  const awayElo = Number(elo?.away);
  if (!Number.isFinite(homeElo) || !Number.isFinite(awayElo)) {
    return { ...NO_EFFECT, available: false };
  }
  // Venue advantage is already in the base λ, so compare raw ratings.
  const expected = expectedHomeScore(homeElo, awayElo, 0);
  return { ...mirrored(2 * expected - 1, SETTINGS.ELO_STRENGTH), available: true, homeElo, awayElo };
}

// Meetings are newest first; results are from the current home team's point of view.
function headToHeadFactor(meetings, homeId) {
  const points = (meetings ?? [])
    .slice(0, SETTINGS.H2H_MAX_MEETINGS)
    .map((meeting) => {
      const isHome = Number(meeting?.teams?.home?.id) === Number(homeId);
      const goalsFor = meeting?.goals?.[isHome ? "home" : "away"];
      const goalsAgainst = meeting?.goals?.[isHome ? "away" : "home"];
      return Number.isFinite(goalsFor) && Number.isFinite(goalsAgainst) ? resultPoints(goalsFor, goalsAgainst) : null;
    })
    .filter((p) => p !== null);
  if (!points.length) {
    return { ...NO_EFFECT, meetings: 0 };
  }

  let weighted = 0;
  let totalWeight = 0;
  points.forEach((p, i) => {
    const weight = SETTINGS.H2H_DECAY ** i;
    weighted += p * weight;
    totalWeight += weight;
  });
  // A single meeting says little, so the edge scales with the sample size.
  const confidence = points.length / SETTINGS.H2H_MAX_MEETINGS;
  return {
    ...mirrored((2 * (weighted / totalWeight) - 1) * confidence, SETTINGS.H2H_STRENGTH),
    meetings: points.length,
    wins: points.filter((p) => p === 1).length,
    draws: points.filter((p) => p === 0.5).length,
    losses: points.filter((p) => p === 0).length,
  };
}

function utcDay(date) {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function restDays(lastMatchDate, fixtureDate) {
  const last = utcDay(lastMatchDate);
  const fixture = utcDay(fixtureDate);
  return last === null || fixture === null ? null : Math.round((fixture - last) / DAY_MS);
}

function restPenalty(days) {
  if (!Number.isFinite(days)) return 0;
  const limit = Object.keys(SETTINGS.REST_PENALTY)
    .map(Number)
    .sort((a, b) => a - b)
    .find((maxDays) => days <= maxDays);
  return limit === undefined ? 0 : SETTINGS.REST_PENALTY[limit];
}

// A team that played very recently loses a little λ; the fresher side gets the relative edge.
function restFactor(lastMatchDates, fixtureDate) {
  const homeDays = restDays(lastMatchDates?.home, fixtureDate);
  const awayDays = restDays(lastMatchDates?.away, fixtureDate);
  return { home: 1 - restPenalty(homeDays), away: 1 - restPenalty(awayDays), homeDays, awayDays };
}

// ── Side stats ────────────────────────────────────────────────────────────────

function meanOfPair(a, b) {
  const values = [a, b].filter(Number.isFinite);
  return values.length ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
}

function sideStats(homeAvg, awayAvg) {
  // Normalise so home + away always equals 100 %
  const homeRawPoss = homeAvg.possession ?? 50;
  const awayRawPoss = awayAvg.possession ?? 50;
  const homePoss = round1((homeRawPoss / (homeRawPoss + awayRawPoss)) * 100);
  return {
    corners:     { home: meanOfPair(homeAvg.corners, awayAvg.cornersAgainst), away: meanOfPair(awayAvg.corners, homeAvg.cornersAgainst) },
    shotsOnGoal: { home: meanOfPair(homeAvg.shotsOnGoal, awayAvg.shotsOnGoalAgainst), away: meanOfPair(awayAvg.shotsOnGoal, homeAvg.shotsOnGoalAgainst) },
    possession:  { home: homePoss, away: round1(100 - homePoss) },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

// "home" | "draw" | "away" from calculateXPts probabilities.
export function predictedOutcome({ winProb, drawProb, lossProb }) {
  if (Math.abs(winProb - lossProb) < SETTINGS.DRAW_MARGIN) return "draw";
  return [["home", winProb], ["draw", drawProb], ["away", lossProb]]
    .reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

export function buildPrediction({ match, homeHistory, awayHistory, reference, elo, meetings, lastMatchDates }) {
  const homeAvg = teamAverages(homeHistory);
  const awayAvg = teamAverages(awayHistory);
  const neutral = isNeutralVenue(match, match.league, match.league?.round);
  const base = baseLambdas(homeAvg, awayAvg, reference, neutral);

  const factors = {
    form: formFactor(homeHistory, awayHistory),
    elo: eloFactor(elo),
    headToHead: headToHeadFactor(meetings, match.teams.home.id),
    rest: restFactor(lastMatchDates, match.fixture?.date),
  };
  const combined = (side) => Object.values(factors).reduce((product, factor) => product * factor[side], 1);

  return {
    neutral,
    base,
    factors,
    lambdas: {
      home: clampLambda(base.home * combined("home")),
      away: clampLambda(base.away * combined("away")),
    },
    homeAvg,
    awayAvg,
    stats: sideStats(homeAvg, awayAvg),
  };
}
