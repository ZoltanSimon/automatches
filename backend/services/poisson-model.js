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
function poissonProbability(k, lambda) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}