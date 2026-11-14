import { getRegistry } from "./registry-service.js";
import { calculateXPts, mostLikelyScore } from "./poisson-model.js";
import { getMatchById } from "./matches-service.js";
import { getTeamById } from "./teams-service.js";
import {
  getHeadToHeadFixturesFromDb,
  getLastMatchDatesBeforeFromDb,
  getMatchEloByMatchId,
  getTeamEloForTeam,
} from "../data-access.js";
import { eloScopeFromTeam } from "../lib/elo.js";
import { buildPrediction, leagueReference, predictedOutcome, SETTINGS, teamHistory } from "../lib/prediction-model.js";
import { buildReasoning } from "../lib/prediction-reasoning.js";

const round2 = (v) => Math.round(v * 100) / 100;

// Optional inputs must never break a prediction; a failed load just means that factor has no effect.
async function orFallback(label, load, fallback) {
  try {
    return await load();
  } catch (error) {
    console.error(`Prediction: failed to load ${label}:`, error);
    return fallback;
  }
}

// Finished matches keep the ratings from before kick-off so the result cannot leak in.
async function loadElo(match) {
  const { home, away } = match.teams;
  const row = await getMatchEloByMatchId(match.fixture.id);
  if (row) {
    return { home: Number(row.home_elo_before), away: Number(row.away_elo_before) };
  }

  const scope = eloScopeFromTeam(getTeamById(home.id));
  const [homeRatings, awayRatings] = await Promise.all([getTeamEloForTeam(home.id), getTeamEloForTeam(away.id)]);
  return { home: Number(homeRatings?.[scope]?.elo), away: Number(awayRatings?.[scope]?.elo) };
}

async function loadLastMatchDates(match) {
  const { home, away } = match.teams;
  const dates = await getLastMatchDatesBeforeFromDb([home.id, away.id], match.fixture.date, match.fixture.id);
  return { home: dates.get(Number(home.id)) ?? null, away: dates.get(Number(away.id)) ?? null };
}

export async function getPredictionForMatch(matchID) {
  const registry = await getRegistry();
  const match = getMatchById(registry, matchID);

  if (!match) {
    throw new Error(`Match ${matchID} not found in registry`);
  }

  const { home, away } = match.teams;
  const homeHistory = teamHistory(registry.matches, home.id, match.fixture);
  const awayHistory = teamHistory(registry.matches, away.id, match.fixture);

  if (!homeHistory.length || !awayHistory.length) {
    throw new Error(`Insufficient match history to predict match ${matchID}`);
  }

  const [elo, meetings, lastMatchDates] = await Promise.all([
    orFallback("Elo", () => loadElo(match), null),
    orFallback("head to head", () => getHeadToHeadFixturesFromDb(home.id, away.id, {
      beforeDate: match.fixture.date,
      excludeId: match.fixture.id,
      limit: SETTINGS.H2H_MAX_MEETINGS,
    }), []),
    orFallback("rest days", () => loadLastMatchDates(match), null),
  ]);

  const prediction = buildPrediction({
    match,
    homeHistory,
    awayHistory,
    reference: leagueReference(registry.matches),
    elo,
    meetings,
    lastMatchDates,
  });
  const { lambdas, factors } = prediction;
  const probabilities = calculateXPts(lambdas.home, lambdas.away);
  // The shown scoreline is the most likely one within the predicted outcome.
  const outcome = predictedOutcome(probabilities);
  const score = mostLikelyScore(lambdas.home, lambdas.away, undefined, outcome);

  return {
    matchID:  match.fixture.id,
    homeTeam: home.name,
    awayTeam: away.name,
    score,
    probabilities: {
      homeWin: probabilities.winProb,
      draw:    probabilities.drawProb,
      awayWin: probabilities.lossProb,
    },
    stats: {
      xG: { home: round2(lambdas.home), away: round2(lambdas.away) },
      ...prediction.stats,
    },
    factors: {
      neutralVenue: prediction.neutral,
      homeAdvantage: prediction.base.homeAdvantage,
      baseLambda: { home: round2(prediction.base.home), away: round2(prediction.base.away) },
      form: factors.form,
      elo: factors.elo,
      headToHead: factors.headToHead,
      rest: factors.rest,
    },
    reasoning: buildReasoning({ home, away, prediction, probabilities, outcome }),
  };
}
