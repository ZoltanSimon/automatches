import { getRegistry } from "./registry-service.js";
import { calculateXPts, mostLikelyScore } from "./poisson-model.js";
import { getMatchById } from "./matches-service.js";

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

// ─── PREDICTION SETTINGS ─────────────────────────────────────────────────────
// All weights are in the range 0–1 unless noted otherwise.

const SETTINGS = {
  LAST_N_MATCHES: 6,
  LAST_N_WEIGHT: 0.40,

  SCORE_GOALS_RECENCY: 0.40,
  HOME_ADVANTAGE_GOALS: 0.12,
  REFERENCE_GOALS_FALLBACK: 1.35,

  XG_VS_GOALS_BLEND: 0.70,
  HOME_ADVANTAGE_XG: 0.10,
  REFERENCE_XG_FALLBACK: 1.35,

  CORNERS_RECENCY:    0.50,
  SHOTS_RECENCY:      0.50,
  POSSESSION_RECENCY: 0.40,

  // Form is already partly in recency-weighted averages; keep this small.
  FORM_MULTIPLIER_STRENGTH: 0.08,

  // Pull noisy attack/defence rates toward the league mean before multiplying.
  MEAN_REVERSION: 0.35,

  LAMBDA_MIN: 0.45,
  LAMBDA_MAX: 2.70,
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers ──────────────────────────────────────────────────────────────────

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;

// ── Per-match stat extraction ─────────────────────────────────────────────────

function extractMatchStatsForTeam(match, teamId) {
  const stats = match.statistics ?? [];
  // Match by team ID — the API does not guarantee home team is always at index 0
  const myEntry  = stats.find((s) => s.team?.id === teamId);
  const oppEntry = stats.find((s) => s.team?.id !== teamId);
  const myStats  = myEntry?.statistics;
  const oppStats = oppEntry?.statistics;

  if (!Array.isArray(myStats) || !Array.isArray(oppStats) || myStats.length === 0 || oppStats.length === 0) {
    return null;
  }

  const get = (arr, idx) => {
    const v = arr?.[idx]?.value;
    return v === null || v === undefined || v === "" ? null : v;
  };

  const isHome = match.teams.home.id === teamId;
  return {
    goalsFor:           match.score.fulltime[isHome ? "home" : "away"] ?? 0,
    goalsAgainst:       match.score.fulltime[isHome ? "away" : "home"] ?? 0,
    xG:                 parseFloat(get(myStats,  16)) || 0,
    xGA:                parseFloat(get(oppStats, 16)) || 0,
    shotsOnGoal:        Number(get(myStats,  0)) || 0,
    shotsOnGoalAgainst: Number(get(oppStats, 0)) || 0,
    corners:            Number(get(myStats,  7)) || 0,
    cornersAgainst:     Number(get(oppStats, 7)) || 0,
    possession:         parseInt(get(myStats, 9)) || 50,
  };
}

function isFinishedMatch(match) {
  return FINISHED_STATUSES.has(match?.fixture?.status?.short);
}

function getTeamMatchStats(registry, teamId, excludeMatchId) {
  return registry.matches
    .filter((m) => isFinishedMatch(m))
    .filter((m) => m.fixture?.id !== excludeMatchId)
    .filter((m) => m.teams.home.id === teamId || m.teams.away.id === teamId)
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
    .map((m) => extractMatchStatsForTeam(m, teamId))
    .filter(Boolean);
}

// ── League reference averages ─────────────────────────────────────────────────
// Mean xG per team per match — denominator for the xG multiplicative model.
function computeReferenceXG(registry) {
  let total = 0;
  let count = 0;
  for (const match of registry.matches) {
    if (!isFinishedMatch(match)) continue;
    for (const teamStats of (match.statistics ?? [])) {
      const xgVal = parseFloat(teamStats?.statistics?.[16]?.value);
      if (!Number.isNaN(xgVal) && xgVal > 0) {
        total += xgVal;
        count++;
      }
    }
  }
  return count > 10 ? total / count : SETTINGS.REFERENCE_XG_FALLBACK;
}

// Mean actual goals per team per match — denominator for the score multiplicative model.
function computeReferenceGoals(registry) {
  let total = 0;
  let count = 0;
  for (const match of registry.matches) {
    if (!isFinishedMatch(match)) continue;
    const h = match.score?.fulltime?.home;
    const a = match.score?.fulltime?.away;
    if (Number.isFinite(h) && Number.isFinite(a)) {
      total += h + a;
      count += 2;
    }
  }
  return count > 10 ? total / count : SETTINGS.REFERENCE_GOALS_FALLBACK;
}

function shrinkTowardMean(value, mean, weight) {
  return value * (1 - weight) + mean * weight;
}

function clampLambda(value) {
  return Math.min(SETTINGS.LAMBDA_MAX, Math.max(SETTINGS.LAMBDA_MIN, value));
}

// Returns a multiplier in range [1 - strength, 1 + strength]
// based on recent W/D/L record. Win = 1pt, Draw = 0.5pt, Loss = 0pt.
function computeFormMultiplier(stats) {
  const recent = stats.slice(-SETTINGS.LAST_N_MATCHES);
  if (!recent.length) return 1.0;

  const points = recent.reduce((sum, s) => {
    if (s.goalsFor > s.goalsAgainst) return sum + 1.0;
    if (s.goalsFor === s.goalsAgainst) return sum + 0.5;
    return sum;
  }, 0);

  const maxPoints = recent.length; // max is 1 per game
  const normalized = points / maxPoints; // 0 = all losses, 1 = all wins
  const centered = normalized - 0.5;    // -0.5 to +0.5

  return 1 + centered * SETTINGS.FORM_MULTIPLIER_STRENGTH * 2;
}

// ── Weighted averages ─────────────────────────────────────────────────────────

function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((sum, s) => sum + (s[key] || 0), 0) / arr.length;
}

function blend(allAvg, recentAvg, recentWeight) {
  return recentAvg * recentWeight + allAvg * (1 - recentWeight);
}

function computeTeamAverages(stats) {
  const recent = stats.slice(-SETTINGS.LAST_N_MATCHES);
  const recW   = SETTINGS.LAST_N_WEIGHT;

  const mix = (key, recency = recW) =>
    blend(avg(stats, key), recent.length ? avg(recent, key) : avg(stats, key), recency);

  return {
    xG:                   mix("xG"),
    xGA:                  mix("xGA"),
    goals:                mix("goalsFor"),
    goalsAgainst:         mix("goalsAgainst"),
    shotsOnGoal:          mix("shotsOnGoal",        SETTINGS.SHOTS_RECENCY),
    shotsOnGoalAgainst:   mix("shotsOnGoalAgainst", SETTINGS.SHOTS_RECENCY),
    corners:              mix("corners",             SETTINGS.CORNERS_RECENCY),
    cornersAgainst:       mix("cornersAgainst",     SETTINGS.CORNERS_RECENCY),
    possession:           mix("possession",          SETTINGS.POSSESSION_RECENCY),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getPredictionForMatch(matchID) {
  const registry = await getRegistry();
  const match = getMatchById(registry, matchID);

  if (!match) {
    throw new Error(`Match ${matchID} not found in registry`);
  }

  const { home, away } = match.teams;
  const excludeMatchId = match.fixture?.id;
  const homeStats = getTeamMatchStats(registry, home.id, excludeMatchId);
  const awayStats = getTeamMatchStats(registry, away.id, excludeMatchId);

  if (!homeStats.length || !awayStats.length) {
    throw new Error(`Insufficient match history to predict match ${matchID}`);
  }

  const homeAvg = computeTeamAverages(homeStats);
  const awayAvg = computeTeamAverages(awayStats);

  // ── Score prediction (actual goals, modest recency) ────────────────────────
  // Attack × opponent defence / league average, shrunk toward the mean and clamped
  // so a couple of 4–5 thrillers cannot produce basketball scorelines.
  const recG = SETTINGS.SCORE_GOALS_RECENCY;
  const recentHome = homeStats.slice(-SETTINGS.LAST_N_MATCHES);
  const recentAway = awayStats.slice(-SETTINGS.LAST_N_MATCHES);

  const homeGoalAttack  = avg(recentHome, "goalsFor")      * recG + avg(homeStats, "goalsFor")      * (1 - recG);
  const homeGoalDefense = avg(recentHome, "goalsAgainst")  * recG + avg(homeStats, "goalsAgainst")  * (1 - recG);
  const awayGoalAttack  = avg(recentAway, "goalsFor")      * recG + avg(awayStats, "goalsFor")      * (1 - recG);
  const awayGoalDefense = avg(recentAway, "goalsAgainst")  * recG + avg(awayStats, "goalsAgainst")  * (1 - recG);

  const referenceGoals = computeReferenceGoals(registry);
  const revert = SETTINGS.MEAN_REVERSION;
  const homeAttack = shrinkTowardMean(homeGoalAttack, referenceGoals, revert);
  const homeDefense = shrinkTowardMean(homeGoalDefense, referenceGoals, revert);
  const awayAttack = shrinkTowardMean(awayGoalAttack, referenceGoals, revert);
  const awayDefense = shrinkTowardMean(awayGoalDefense, referenceGoals, revert);

  const homeFormMult = computeFormMultiplier(homeStats);
  const awayFormMult = computeFormMultiplier(awayStats);

  const homeGoalLambdaFinal = clampLambda(
    ((homeAttack * awayDefense) / referenceGoals + SETTINGS.HOME_ADVANTAGE_GOALS) * homeFormMult,
  );
  const awayGoalLambdaFinal = clampLambda(
    ((awayAttack * homeDefense) / referenceGoals) * awayFormMult,
  );

  // ── xG prediction (for probabilities and xG stat) ───────────────────────────
  // xG stays separate: blended with actual goals but at lower recency.
  // Drives win/draw/loss probabilities via Poisson.
  const xgBlend   = SETTINGS.XG_VS_GOALS_BLEND;
  const homeXgAttack  = homeAvg.xG * xgBlend + homeAvg.goals        * (1 - xgBlend);
  const homeXgDefense = homeAvg.xGA * xgBlend + homeAvg.goalsAgainst * (1 - xgBlend);
  const awayXgAttack  = awayAvg.xG * xgBlend + awayAvg.goals        * (1 - xgBlend);
  const awayXgDefense = awayAvg.xGA * xgBlend + awayAvg.goalsAgainst * (1 - xgBlend);

  const referenceXG = computeReferenceXG(registry);
  const homeXgPredicted = clampLambda(
    (shrinkTowardMean(homeXgAttack, referenceXG, revert) *
      shrinkTowardMean(awayXgDefense, referenceXG, revert)) / referenceXG + SETTINGS.HOME_ADVANTAGE_XG,
  );
  const awayXgPredicted = clampLambda(
    (shrinkTowardMean(awayXgAttack, referenceXG, revert) *
      shrinkTowardMean(homeXgDefense, referenceXG, revert)) / referenceXG,
  );

  const probabilities = calculateXPts(homeXgPredicted, awayXgPredicted);

  // ── Corners ─────────────────────────────────────────────────────────────────
  const homeCorners = round1((homeAvg.corners        + awayAvg.cornersAgainst) / 2);
  const awayCorners = round1((awayAvg.corners        + homeAvg.cornersAgainst) / 2);

  // ── Shots on goal ───────────────────────────────────────────────────────────
  const homeShots = round1((homeAvg.shotsOnGoal      + awayAvg.shotsOnGoalAgainst) / 2);
  const awayShots = round1((awayAvg.shotsOnGoal      + homeAvg.shotsOnGoalAgainst) / 2);

  // ── Possession ──────────────────────────────────────────────────────────────
  // Normalise so home + away always equals 100 %
  const rawTotal  = homeAvg.possession + awayAvg.possession;
  const homePoss  = round1((homeAvg.possession / rawTotal) * 100);
  const awayPoss  = round1(100 - homePoss);

  // ── Reasoning ────────────────────────────────────────────────────────────────
  const pct = (v) => Math.round(v * 100);
  const r1  = (v) => Math.round(v * 10) / 10;

  const homeRecentGoals   = r1(avg(recentHome, "goalsFor"));
  const awayRecentGoals   = r1(avg(recentAway, "goalsFor"));
  const homeRecentConcede = r1(avg(recentHome, "goalsAgainst"));
  const awayRecentConcede = r1(avg(recentAway, "goalsAgainst"));

  const formDesc = (mult) => {
    if (mult >= 1.06) return "excellent recent form";
    if (mult >= 1.025) return "good recent form";
    if (mult <= 0.94) return "poor recent form";
    if (mult <= 0.975) return "below-par recent form";
    return "average recent form";
  };

  const homeRecentCount = recentHome.length || SETTINGS.LAST_N_MATCHES;
  const awayRecentCount = recentAway.length || SETTINGS.LAST_N_MATCHES;

  const reasoning =
    `${home.name} score ${homeRecentGoals} goals/game in their last ${homeRecentCount} matches ` +
    `while conceding ${homeRecentConcede}/game — ${formDesc(homeFormMult)}. ` +
    `Against ${away.name}'s defensive record, with home advantage and form applied, ` +
    `their predicted scoring rate is ${round2(homeGoalLambdaFinal)} goals. ` +
    `${away.name} score ${awayRecentGoals} goals/game in their last ${awayRecentCount} matches ` +
    `while conceding ${awayRecentConcede}/game — ` +
    `${formDesc(awayFormMult)}. ` +
    `Their predicted scoring rate is ${round2(awayGoalLambdaFinal)} goals. ` +
    `xG-based Poisson model gives ${home.name} a ${pct(probabilities.winProb)}% chance to win, ` +
    `${pct(probabilities.drawProb)}% draw, ${pct(probabilities.lossProb)}% ${away.name} win.`;

  return {
    matchID:  match.fixture.id,
    homeTeam: home.name,
    awayTeam: away.name,
    score: mostLikelyScore(homeGoalLambdaFinal, awayGoalLambdaFinal),
    probabilities: {
      homeWin: probabilities.winProb,
      draw:    probabilities.drawProb,
      awayWin: probabilities.lossProb,
    },
    stats: {
      xG:          { home: round2(homeXgPredicted), away: round2(awayXgPredicted) },
      corners:     { home: homeCorners,             away: awayCorners },
      shotsOnGoal: { home: homeShots,               away: awayShots },
      possession:  { home: homePoss,                away: awayPoss },
    },
    reasoning,
  };
}
