const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

const ROUND_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Third place",
  "Final",
];

function normalizeRound(roundName) {
  return String(roundName || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapRoundLabel(roundName) {
  const normalized = normalizeRound(roundName);

  if (!normalized) return null;
  if (normalized.includes("third") && normalized.includes("place")) return "Third place";
  if ((normalized.includes("round") && normalized.includes("32")) || normalized.includes("1 16")) {
    return "Round of 32";
  }
  if ((normalized.includes("round") && normalized.includes("16")) || normalized.includes("1 8")) {
    return "Round of 16";
  }
  if (normalized.includes("quarter") || normalized.includes("1 4")) return "Quarter-finals";
  if (normalized.includes("semi") || normalized.includes("1 2")) return "Semi-finals";
  if (normalized === "final" || (normalized.includes("final") && !normalized.includes("semi") && !normalized.includes("quarter"))) {
    return "Final";
  }

  return null;
}

function scoreForTeam(match, side) {
  const value = match?.goals?.[side];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function winnerSide(match) {
  const status = match?.fixture?.status?.short;
  if (!FINISHED_STATUSES.has(status)) {
    return null;
  }

  const home = scoreForTeam(match, "home");
  const away = scoreForTeam(match, "away");
  if (home === null || away === null || home === away) {
    return null;
  }

  return home > away ? "home" : "away";
}

function sortRounds(a, b) {
  const ai = ROUND_ORDER.indexOf(a);
  const bi = ROUND_ORDER.indexOf(b);
  return ai - bi;
}

function toMatchCard(match) {
  const fixtureId = match?.fixture?.id;
  const dateRaw = match?.fixture?.date;
  const date = dateRaw ? new Date(dateRaw) : null;
  const winner = winnerSide(match);
  const homeGoals = scoreForTeam(match, "home");
  const awayGoals = scoreForTeam(match, "away");

  return {
    fixtureId,
    date,
    home: {
      id: match?.teams?.home?.id,
      name: match?.teams?.home?.name || "TBD",
      goals: homeGoals,
      winner: winner === "home",
    },
    away: {
      id: match?.teams?.away?.id,
      name: match?.teams?.away?.name || "TBD",
      goals: awayGoals,
      winner: winner === "away",
    },
    status: match?.fixture?.status?.short || "",
  };
}

function createTeamRow(team, fixtureId) {
  const row = document.createElement("button");
  row.className = `knockout-team${team.winner ? " is-winner" : ""}`;
  row.type = "button";

  const scoreText = team.goals === null ? "-" : String(team.goals);
  const name = document.createElement("span");
  name.className = "knockout-team-name";
  name.textContent = team.name;

  const score = document.createElement("span");
  score.className = "knockout-team-score";
  score.textContent = scoreText;

  row.appendChild(name);
  row.appendChild(score);

  if (fixtureId) {
    row.addEventListener("click", () => {
      window.location.href = `/match?matchID=${encodeURIComponent(fixtureId)}`;
    });
  }

  return row;
}

function createMatchCard(cardData) {
  const card = document.createElement("article");
  card.className = "knockout-match";

  const status = document.createElement("div");
  status.className = "knockout-match-status";
  status.textContent = cardData.status || "NS";
  card.appendChild(status);

  card.appendChild(createTeamRow(cardData.home, cardData.fixtureId));
  card.appendChild(createTeamRow(cardData.away, cardData.fixtureId));

  return card;
}

export function renderKnockoutBracket(container, matches) {
  if (!container || !Array.isArray(matches) || matches.length === 0) {
    return false;
  }

  const grouped = new Map();

  for (const match of matches) {
    const phase = mapRoundLabel(match?.league?.round);
    if (!phase) continue;

    if (!grouped.has(phase)) grouped.set(phase, []);
    grouped.get(phase).push(toMatchCard(match));
  }

  if (grouped.size === 0) {
    return false;
  }

  const orderedRounds = [...grouped.keys()].sort(sortRounds);
  container.innerHTML = "";

  const bracket = document.createElement("div");
  bracket.className = "knockout-bracket";

  for (const roundName of orderedRounds) {
    const column = document.createElement("section");
    column.className = "knockout-round";

    const title = document.createElement("h3");
    title.className = "knockout-round-title";
    title.textContent = roundName;
    column.appendChild(title);

    const matchesInRound = grouped.get(roundName);
    matchesInRound.sort((a, b) => {
      const at = a.date ? a.date.getTime() : 0;
      const bt = b.date ? b.date.getTime() : 0;
      return at - bt;
    });

    const list = document.createElement("div");
    list.className = "knockout-round-matches";

    for (const card of matchesInRound) {
      list.appendChild(createMatchCard(card));
    }

    column.appendChild(list);
    bracket.appendChild(column);
  }

  container.appendChild(bracket);
  return true;
}