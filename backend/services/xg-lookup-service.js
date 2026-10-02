import { wait } from "../lib/backend-helper.js";
import { parseExpectedGoalsValue } from "../lib/match-details-mapper.js";
import { getMatchesForXgLookup } from "../data-access.js";

const FOTMOB_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

const TEAM_STOP_WORDS = new Set([
  "fc", "cf", "afc", "sc", "ac", "fk", "sk", "bk", "if", "cd", "ssc", "as", "ud",
  "rcd", "sv", "vfl", "vfb", "tsg", "club", "calcio", "de", "the",
]);

const FOTMOB_CALL_GAP_MS = 3000;
const FOTMOB_REQUEST_TIMEOUT_MS = 20000;
let lastFotmobCallAt = 0;
const dayCache = new Map();

function toDateKey(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeTeamName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !TEAM_STOP_WORDS.has(token))
    .join(" ")
    .trim();
}

function nameScore(left, right) {
  const a = normalizeTeamName(left);
  const b = normalizeTeamName(right);
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  if (a.includes(b) || b.includes(a)) {
    return 0.88;
  }

  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  }
  if (overlap === 0) {
    return 0;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

async function fetchJson(url) {
  const gapMs = FOTMOB_CALL_GAP_MS - (Date.now() - lastFotmobCallAt);
  if (lastFotmobCallAt > 0 && gapMs > 0) {
    await wait(gapMs);
  }

  lastFotmobCallAt = Date.now();
  const response = await fetch(url, {
    headers: FOTMOB_HEADERS,
    signal: AbortSignal.timeout(FOTMOB_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`FotMob ${response.status} for ${url}`);
  }
  return response.json();
}

async function getFotmobDayMatches(dateKey) {
  if (dayCache.has(dateKey)) {
    return dayCache.get(dateKey);
  }

  const payload = await fetchJson(`https://www.fotmob.com/api/data/matches?date=${dateKey.replaceAll("-", "")}`);
  const matches = [];
  for (const league of payload?.leagues || []) {
    for (const match of league.matches || []) {
      matches.push({
        id: match.id,
        home: match.home?.name,
        away: match.away?.name,
        homeGoals: match.home?.score,
        awayGoals: match.away?.score,
        league: league.name,
        finished: Boolean(match?.status?.finished),
      });
    }
  }

  dayCache.set(dateKey, matches);
  return matches;
}

function pickFotmobMatch(localMatch, candidates) {
  const scored = candidates
    .map((candidate) => {
      const home = nameScore(localMatch.homeTeamName, candidate.home);
      const away = nameScore(localMatch.awayTeamName, candidate.away);
      let score = (home + away) / 2;
      if (
        localMatch.homeGoals != null
        && localMatch.awayGoals != null
        && Number(candidate.homeGoals) === Number(localMatch.homeGoals)
        && Number(candidate.awayGoals) === Number(localMatch.awayGoals)
      ) {
        score += 0.08;
      }
      return { candidate, home, away, score };
    })
    .filter((entry) => entry.home >= 0.55 && entry.away >= 0.55)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return null;
  }

  if (scored.length > 1 && scored[0].score - scored[1].score < 0.08) {
    return null;
  }

  return scored[0];
}

function roundStat(value, digits) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

function playerStatValue(player, key) {
  for (const group of player?.stats || []) {
    const stats = group?.stats;
    if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
      continue;
    }
    for (const entry of Object.values(stats)) {
      if (entry?.key === key) {
        return entry.stat?.value ?? null;
      }
    }
  }
  return null;
}

function compactFotmobPlayer(person, side, statsById) {
  const stats = statsById.get(Number(person?.id));
  const rating = roundStat(person?.performance?.rating ?? playerStatValue(stats, "rating_title"), 2);
  return {
    side,
    name: person?.name || stats?.name || null,
    shirt: person?.shirtNumber ?? stats?.shirtNumber ?? null,
    rating: rating != null && rating > 0 ? rating : null,
    minutes: roundStat(playerStatValue(stats, "minutes_played"), 0),
    goals: roundStat(playerStatValue(stats, "goals"), 0),
    assists: roundStat(playerStatValue(stats, "assists"), 0),
    xg: roundStat(playerStatValue(stats, "expected_goals"), 2),
    xgot: roundStat(playerStatValue(stats, "expected_goals_on_target_variant"), 2),
    xa: roundStat(playerStatValue(stats, "expected_assists"), 2),
    shots: roundStat(playerStatValue(stats, "total_shots"), 0),
  };
}

function buildFotmobSnapshot(details, sourceId) {
  const lineup = details?.content?.lineup;
  const statsById = new Map(
    Object.values(details?.content?.playerStats || {})
      .filter((player) => player?.id != null)
      .map((player) => [Number(player.id), player]),
  );
  const xg = extractExpectedGoalsFromDetails(details);
  const players = ["home", "away"].flatMap((side) => {
    const team = side === "home" ? lineup?.homeTeam : lineup?.awayTeam;
    return [...(team?.starters || []), ...(team?.subs || [])]
      .map((person) => compactFotmobPlayer(person, side, statsById))
      .filter((person) => person.name);
  });

  if (!xg && players.length === 0) {
    return null;
  }

  return {
    sourceId: Number(sourceId) || null,
    fetchedAt: new Date().toISOString(),
    homeXg: xg?.home ?? null,
    awayXg: xg?.away ?? null,
    homeRating: roundStat(lineup?.homeTeam?.rating, 2),
    awayRating: roundStat(lineup?.awayTeam?.rating, 2),
    players,
  };
}

function extractExpectedGoalsFromDetails(details) {
  const groups = [];
  const stats = details?.content?.stats;
  if (Array.isArray(stats)) {
    groups.push(...stats);
  }
  if (Array.isArray(stats?.stats)) {
    groups.push(...stats.stats);
  }
  if (Array.isArray(stats?.Periods?.All?.stats)) {
    groups.push(...stats.Periods.All.stats);
  }

  for (const group of groups) {
    for (const item of group?.stats || []) {
      const isXg = item?.key === "expected_goals" || /expected goals \(xg\)/i.test(item?.title || "");
      if (!isXg || !Array.isArray(item.stats) || item.stats.length < 2) {
        continue;
      }
      const home = parseExpectedGoalsValue(item.stats[0]);
      const away = parseExpectedGoalsValue(item.stats[1]);
      if (Number.isFinite(home) && Number.isFinite(away)) {
        return { home, away };
      }
    }
  }

  return null;
}

async function lookupMatchXg(localMatch) {
  const dateKey = toDateKey(localMatch.fixtureDate);
  if (!dateKey) {
    return { ok: false, error: "Match date is missing" };
  }

  const dateKeys = [dateKey, shiftDateKey(dateKey, -1), shiftDateKey(dateKey, 1)];
  let picked = null;
  let matchedDate = dateKey;

  for (const key of dateKeys) {
    const candidates = await getFotmobDayMatches(key);
    const match = pickFotmobMatch(localMatch, candidates);
    if (match) {
      picked = match;
      matchedDate = key;
      break;
    }
  }

  if (!picked) {
    return { ok: false, error: "No FotMob match matched these team names" };
  }

  const details = await fetchJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${picked.candidate.id}`);
  const xg = extractExpectedGoalsFromDetails(details);
  const fotmob = buildFotmobSnapshot(details, picked.candidate.id);
  const base = {
    source: "fotmob",
    sourceId: picked.candidate.id,
    sourceDate: matchedDate,
    sourceMatch: `${picked.candidate.home} – ${picked.candidate.away}`,
    fotmob,
  };

  if (!xg) {
    return {
      ...base,
      ok: false,
      error: fotmob ? "FotMob match has no team xG yet" : "FotMob match has no xG yet",
    };
  }

  return {
    ...base,
    ok: true,
    home: xg.home,
    away: xg.away,
  };
}

export function parseFotmobMatchId(input) {
  const raw = String(input ?? "").trim();
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  const match = raw.match(/#(\d+)/) || raw.match(/\/match\/(\d+)/) || raw.match(/matchId=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function fotmobDetailsTeamNames(details) {
  const general = details?.general;
  const headerTeams = details?.header?.teams;
  return {
    home: general?.homeTeam?.name ?? headerTeams?.[0]?.name ?? null,
    away: general?.awayTeam?.name ?? headerTeams?.[1]?.name ?? null,
  };
}

export async function fetchFotmobMatchById(localMatchId, fotmobInput) {
  const fotmobId = parseFotmobMatchId(fotmobInput);
  if (!fotmobId) {
    return { matchId: Number(localMatchId), ok: false, error: "Could not read a FotMob match ID from that input" };
  }

  const [localMatch] = await getMatchesForXgLookup([localMatchId]);
  if (!localMatch) {
    return { matchId: Number(localMatchId), ok: false, error: "Match was not found" };
  }

  const base = {
    matchId: localMatch.fixtureId,
    homeTeamName: localMatch.homeTeamName,
    awayTeamName: localMatch.awayTeamName,
    source: "fotmob",
    sourceId: fotmobId,
  };

  const details = await fetchJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${fotmobId}`);
  const names = fotmobDetailsTeamNames(details);
  const fotmob = buildFotmobSnapshot(details, fotmobId);
  const xg = extractExpectedGoalsFromDetails(details);
  const namesLookRight = nameScore(localMatch.homeTeamName, names.home) > 0
    || nameScore(localMatch.awayTeamName, names.away) > 0;

  const result = {
    ...base,
    sourceMatch: names.home && names.away ? `${names.home} – ${names.away}` : null,
    warning: namesLookRight ? null : "FotMob team names look different, check this is the right match",
    fotmob,
  };

  if (!fotmob) {
    return { ...result, ok: false, error: "FotMob match has no stats yet" };
  }
  if (!xg) {
    return { ...result, ok: false, error: "FotMob match has no team xG yet" };
  }
  return { ...result, ok: true, home: xg.home, away: xg.away };
}

export async function fetchExternalMatchXg(rawIds) {
  const requested = [...new Set(
    (rawIds === undefined || rawIds === null ? [] : Array.isArray(rawIds) ? rawIds : [rawIds])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  )];
  const matches = await getMatchesForXgLookup(requested);
  const foundIds = new Set(matches.map((match) => match.fixtureId));
  const results = requested
    .filter((id) => !foundIds.has(id))
    .map((id) => ({ matchId: id, ok: false, error: "Match was not found" }));

  for (const match of matches) {
    try {
      const lookup = await lookupMatchXg(match);
      results.push({
        matchId: match.fixtureId,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        ...lookup,
      });
    } catch (error) {
      results.push({
        matchId: match.fixtureId,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        ok: false,
        error: error.message || "FotMob lookup failed",
      });
    }
  }

  return results;
}
