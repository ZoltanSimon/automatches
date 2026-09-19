/**
 * Calculate Expected Points using Poisson model
 * @param {number} xGFor - Team's expected goals
 * @param {number} xGAgainst - Opponent's expected goals
 * @param {number} maxGoals - Max goals to iterate (default 6 is enough)
 * @returns {object} probabilities and xPts
 */
export function calculateXPts(xGFor, xGAgainst, maxGoals = 6) {
  let winProb = 0;
  let drawProb = 0;
  let lossProb = 0;

  for (let goalsFor = 0; goalsFor <= maxGoals; goalsFor++) {
    const pFor = poissonProbability(goalsFor, xGFor);

    for (let goalsAgainst = 0; goalsAgainst <= maxGoals; goalsAgainst++) {
      const pAgainst = poissonProbability(goalsAgainst, xGAgainst);
      const jointProb = pFor * pAgainst;

      if (goalsFor > goalsAgainst) winProb += jointProb;
      else if (goalsFor === goalsAgainst) drawProb += jointProb;
      else lossProb += jointProb;
    }
  }

  const xPts = (winProb * 3) + drawProb;

  return {
    xPts: Number(xPts.toFixed(2)),
    winProb: Number(winProb.toFixed(3)),
    drawProb: Number(drawProb.toFixed(3)),
    lossProb: Number(lossProb.toFixed(3))
  };
}

// Factorial with memoization (fast enough for football scores)
const factorialCache = {};
function factorial(n) {
  if (n === 0) return 1;
  if (factorialCache[n]) return factorialCache[n];
  factorialCache[n] = n * factorial(n - 1);
  return factorialCache[n];
}

// Poisson probability: P(k goals | lambda = xG)
export function poissonProbability(k, lambda) {
  const safeLambda = Math.max(Number(lambda) || 0, 0.05);
  return (Math.exp(-safeLambda) * Math.pow(safeLambda, k)) / factorial(k);
}

/** Most probable scoreline under independent Poisson scoring. */
export function mostLikelyScore(lambdaHome, lambdaAway, maxGoals = 6) {
  let bestHome = 0;
  let bestAway = 0;
  let bestP = -1;

  for (let home = 0; home <= maxGoals; home++) {
    const pHome = poissonProbability(home, lambdaHome);
    for (let away = 0; away <= maxGoals; away++) {
      const p = pHome * poissonProbability(away, lambdaAway);
      if (p > bestP) {
        bestP = p;
        bestHome = home;
        bestAway = away;
      }
    }
  }

  return { home: bestHome, away: bestAway };
}