// Factors that change λ by less than this are left out of the text.
const MIN_MENTIONED_EFFECT = 0.005;
// Win chance above which the favourite is called a clear favourite.
const CLEAR_FAVOURITE = 0.6;

function formDesc(share) {
  if (share === null) return "no recent form to go on";
  if (share >= 0.875) return "excellent form";
  if (share >= 0.65) return "good form";
  if (share <= 0.125) return "poor form";
  if (share <= 0.35) return "below-par form";
  return "average form";
}

// For mirrored factors: the favoured team, or null when the effect is negligible.
function favoured(factor, home, away) {
  if (Math.abs(factor.home - 1) < MIN_MENTIONED_EFFECT) return null;
  return factor.home > 1 ? home : away;
}

function edgeSentence(eloTeam, h2hTeam) {
  if (eloTeam && eloTeam === h2hTeam) {
    return `${eloTeam.name} are the higher-rated side and have the better head-to-head record.`;
  }
  return [
    eloTeam && `${eloTeam.name} are the higher-rated side.`,
    h2hTeam && `${h2hTeam.name} have the better head-to-head record.`,
  ].filter(Boolean).join(" ");
}

function restSentence(home, away, rest) {
  const tired = [[home, rest.homeDays, rest.home], [away, rest.awayDays, rest.away]]
    .filter(([, , multiplier]) => multiplier < 1);
  if (tired.length === 2) return "Both teams played very recently and may be tired.";
  if (tired.length === 0) return "";
  const [team, days] = tired[0];
  return `${team.name} played ${days === 1 ? "yesterday" : `${days} days ago`} and may be tired.`;
}

function verdictSentence(home, away, probabilities, outcome) {
  if (outcome === "draw") {
    const drawIsLikeliest = probabilities.drawProb >= Math.max(probabilities.winProb, probabilities.lossProb);
    return drawIsLikeliest ? "A draw looks most likely." : "Too close to call, so we predict a draw.";
  }
  const [team, chance] = outcome === "home" ? [home, probabilities.winProb] : [away, probabilities.lossProb];
  return chance >= CLEAR_FAVOURITE ? `${team.name} are clear favourites.` : `${team.name} are slight favourites.`;
}

function formSentence(home, away, form) {
  const homeForm = formDesc(form.homeShare);
  const awayForm = formDesc(form.awayShare);
  return homeForm === awayForm
    ? `Both teams come in with ${homeForm}.`
    : `${home.name} come in with ${homeForm}, ${away.name} with ${awayForm}.`;
}

export function buildReasoning({ home, away, prediction, probabilities, outcome }) {
  const { factors, neutral } = prediction;
  const { form, elo, headToHead, rest } = factors;

  return [
    formSentence(home, away, form),
    neutral ? "It's a neutral venue, so there's no home advantage." : "",
    edgeSentence(elo.available ? favoured(elo, home, away) : null, favoured(headToHead, home, away)),
    restSentence(home, away, rest),
    verdictSentence(home, away, probabilities, outcome),
  ].filter(Boolean).join(" ");
}
