import { CURRENT_SEASON } from "../../shared/defaults.js";

export { CURRENT_SEASON };

export const INITIAL_ELO = 1500;
export const HOME_ADVANTAGE = 100;
export const ELO_SEASON_WINDOW = 5;
export const DEFAULT_IMPORTANCE_K = 30;

export const IMPORTANCE_K = Object.freeze({
  wc_final: 60,
  major_nt: 50,
  qualifier_or_major_club: 40,
  domestic: 30,
  friendly: 20,
});

/** Frozen API-Football IDs — do not derive from live League.sort_order. */
export const WORLD_CUP_LEAGUE_ID = 1;

export const MAJOR_NT_LEAGUE_IDS = new Set([
  1, // World Cup
  4, // Euro Championship
  6, // Africa Cup of Nations
  7, // Asian Cup
  9, // Copa America
]);

export const MAJOR_CLUB_CUP_LEAGUE_IDS = new Set([
  2, // UEFA Champions League
  3, // UEFA Europa League
  13, // Copa Libertadores
  15, // FIFA Club World Cup
  16, // CONCACAF Champions Cup
  17, // AFC Champions League
  848, // UEFA Europa Conference League
]);

export const TOURNAMENT_NEUTRAL_LEAGUE_IDS = new Set([
  1, // World Cup
  4, // Euro Championship
  6, // Africa Cup of Nations
  7, // Asian Cup
  9, // Copa America
  15, // FIFA Club World Cup
  531, // UEFA Super Cup
]);

export const CLUB_FINAL_NEUTRAL_LEAGUE_IDS = new Set([
  2, // UCL
  3, // UEL
  13, // Libertadores
  848, // UECL
]);

const FRIENDLY_NAME = /friendly/;
const QUALIFIER_NAME = /qualif/;
const FINAL_ROUND = /\bfinal\b/;
const THIRD_PLACE_ROUND = /third|3rd/;

export function normalizeScope(leagueType) {
  return leagueType === "nt" ? "nt" : leagueType === "league" || leagueType === "cup" ? "club" : null;
}

export function goalDifferenceIndex(homeScore, awayScore) {
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return 1;
  }

  const n = Math.abs(home - away);
  if (n <= 1) {
    return 1;
  }
  if (n === 2) {
    return 1.5;
  }
  return (11 + n) / 8;
}

export function matchResultScore(homeScore, awayScore) {
  const home = Number(homeScore);
  const away = Number(awayScore);
  if (home > away) {
    return 1;
  }
  if (home < away) {
    return 0;
  }
  return 0.5;
}

function leagueName(league) {
  return String(league?.name ?? "").toLowerCase();
}

function roundName(round) {
  return String(round ?? "").toLowerCase();
}

function isFinalRound(round) {
  const text = roundName(round);
  return FINAL_ROUND.test(text) && !THIRD_PLACE_ROUND.test(text);
}

function isFriendly(league, round) {
  const id = Number(league?.id);
  if (id === 10) {
    return true;
  }
  return FRIENDLY_NAME.test(leagueName(league)) || FRIENDLY_NAME.test(roundName(round));
}

function isWorldCup(league) {
  const id = Number(league?.id);
  const name = leagueName(league);
  return id === WORLD_CUP_LEAGUE_ID || (name.includes("world cup") && !name.includes("club") && !QUALIFIER_NAME.test(name));
}

function isMajorNt(league) {
  const id = Number(league?.id);
  if (MAJOR_NT_LEAGUE_IDS.has(id)) {
    return true;
  }
  const name = leagueName(league);
  if (QUALIFIER_NAME.test(name) || FRIENDLY_NAME.test(name)) {
    return false;
  }
  return (
    isWorldCup(league)
    || name.includes("euro championship")
    || name === "euro"
    || name.includes("copa america")
    || name.includes("africa cup")
    || name.includes("african cup")
    || name.includes("asian cup")
  );
}

function isMajorClubCup(league) {
  const id = Number(league?.id);
  if (MAJOR_CLUB_CUP_LEAGUE_IDS.has(id)) {
    return true;
  }
  const name = leagueName(league);
  return (
    name.includes("champions league")
    || name.includes("europa league")
    || name.includes("conference league")
    || name.includes("libertadores")
    || name.includes("club world cup")
  );
}

function isQualifier(league, round) {
  return QUALIFIER_NAME.test(leagueName(league)) || QUALIFIER_NAME.test(roundName(round));
}

export function classifyImportance(league, round) {
  if (isFriendly(league, round) && league?.type !== "league") {
    return { band: "friendly", k: IMPORTANCE_K.friendly };
  }

  if (isWorldCup(league) && isFinalRound(round)) {
    return { band: "wc_final", k: IMPORTANCE_K.wc_final };
  }

  if (isMajorNt(league)) {
    return { band: "major_nt", k: IMPORTANCE_K.major_nt };
  }

  if (isQualifier(league, round) || isMajorClubCup(league)) {
    return { band: "qualifier_or_major_club", k: IMPORTANCE_K.qualifier_or_major_club };
  }

  return { band: "domestic", k: IMPORTANCE_K.domestic };
}

export function importanceK(league, round) {
  const classified = classifyImportance(league, round);
  const k = Number(classified.k);
  if (k === 20 || k === 30 || k === 40 || k === 50 || k === 60) {
    return classified;
  }
  return { band: "domestic", k: DEFAULT_IMPORTANCE_K };
}

export function isNeutralVenue(match, league, round) {
  if (match?.fixture?.neutral === true || match?.fixture?.neutral === 1) {
    return true;
  }

  const id = Number(league?.id);
  const name = leagueName(league);

  if (TOURNAMENT_NEUTRAL_LEAGUE_IDS.has(id)) {
    return true;
  }

  if (
    (name.includes("world cup") && !name.includes("club") && !QUALIFIER_NAME.test(name))
    || name.includes("euro championship")
    || name.includes("copa america")
    || name.includes("africa cup")
    || name.includes("african cup")
    || name.includes("asian cup")
    || name.includes("club world cup")
    || name.includes("super cup")
  ) {
    return true;
  }

  if ((CLUB_FINAL_NEUTRAL_LEAGUE_IDS.has(id) || isMajorClubCup(league)) && isFinalRound(round ?? match?.league?.round)) {
    return true;
  }

  return false;
}

export function homeAdvantage(match, league, round) {
  return isNeutralVenue(match, league, round) ? 0 : HOME_ADVANTAGE;
}

export function expectedHomeScore(homeElo, awayElo, advantage) {
  const h = Number(advantage) || 0;
  return 1 / (1 + 10 ** ((Number(awayElo) - (Number(homeElo) + h)) / 400));
}

export function applyMatchElo({
  homeElo,
  awayElo,
  homeScore,
  awayScore,
  k,
  advantage,
}) {
  const expectedHome = expectedHomeScore(homeElo, awayElo, advantage);
  const actualHome = matchResultScore(homeScore, awayScore);
  const g = goalDifferenceIndex(homeScore, awayScore);
  const deltaHome = k * g * (actualHome - expectedHome);
  const deltaAway = k * g * ((1 - actualHome) - (1 - expectedHome));

  return {
    homeEloAfter: homeElo + deltaHome,
    awayEloAfter: awayElo + deltaAway,
    expectedHome,
    goalIndex: g,
  };
}

export function formatEloDelta(after, before) {
  const end = Number(after);
  const start = Number(before);
  if (!Number.isFinite(end) || !Number.isFinite(start)) {
    return null;
  }

  const value = Math.round(end - start);
  return {
    value,
    display: value > 0 ? `+${value}` : String(value),
    direction: value > 0 ? "up" : value < 0 ? "down" : "flat",
  };
}

export function eloScopeFromTeam(team) {
  if (!team || team.is_club === null || team.is_club === undefined) {
    return "club";
  }
  return Number(team.is_club) === 1 ? "club" : "nt";
}

export function eloSeasonFloor(currentSeason = CURRENT_SEASON, window = ELO_SEASON_WINDOW) {
  const season = Number(currentSeason);
  const size = Number(window);
  if (!Number.isFinite(season) || !Number.isFinite(size) || size < 1) {
    return season;
  }
  return season - (size - 1);
}
