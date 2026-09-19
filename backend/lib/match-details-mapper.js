const STATISTIC_SPECS = [
  { column: "shots_on_goal", apiType: "Shots on Goal", kind: "int", aliases: ["shots on goal"] },
  { column: "shots_off_goal", apiType: "Shots off Goal", kind: "int", aliases: ["shots off goal"] },
  { column: "total_shots", apiType: "Total Shots", kind: "int", aliases: ["total shots"] },
  { column: "blocked_shots", apiType: "Blocked Shots", kind: "int", aliases: ["blocked shots"] },
  { column: "shots_insidebox", apiType: "Shots insidebox", kind: "int", aliases: ["shots insidebox", "shots inside box"] },
  { column: "shots_outsidebox", apiType: "Shots outsidebox", kind: "int", aliases: ["shots outsidebox", "shots outside box"] },
  { column: "fouls", apiType: "Fouls", kind: "int", aliases: ["fouls"] },
  { column: "corners", apiType: "Corner Kicks", kind: "int", aliases: ["corner kicks"] },
  { column: "offsides", apiType: "Offsides", kind: "int", aliases: ["offsides"] },
  { column: "possession", apiType: "Ball Possession", kind: "percent", aliases: ["ball possession"] },
  { column: "yellow_cards", apiType: "Yellow Cards", kind: "int", aliases: ["yellow cards"] },
  { column: "red_cards", apiType: "Red Cards", kind: "int", aliases: ["red cards"] },
  { column: "gk_saves", apiType: "Goalkeeper Saves", kind: "int", aliases: ["goalkeeper saves"] },
  { column: "total_passes", apiType: "Total passes", kind: "int", aliases: ["total passes"] },
  { column: "passes_accurate", apiType: "Passes accurate", kind: "int", aliases: ["passes accurate"] },
  { column: "passes_pct", apiType: "Passes %", kind: "percent", aliases: ["passes %", "passes percent"] },
  { column: "xg", apiType: "expected_goals", kind: "decimal", aliases: ["expected_goals", "expected goals"] },
  { column: "goals_prevented", apiType: "goals_prevented", kind: "decimal", aliases: ["goals_prevented", "goals prevented"] },
];

const STAT_TYPE_TO_SPEC = new Map();
for (const spec of STATISTIC_SPECS) {
  for (const alias of spec.aliases) {
    STAT_TYPE_TO_SPEC.set(normalizeStatType(alias), spec);
  }
}

export const MATCH_DETAILS_COLUMNS = [
  "match_id",
  "referee",
  "timezone",
  "fixture_timestamp",
  "venue_id",
  "venue_name",
  "venue_city",
  "periods_first",
  "periods_second",
  "status_long",
  "status_elapsed",
  "status_extra",
  "ht_home",
  "ht_away",
  "et_home",
  "et_away",
  "pen_home",
  "pen_away",
  "home_winner",
  "away_winner",
  ...STATISTIC_SPECS.flatMap((spec) => [`home_${spec.column}`, `away_${spec.column}`]),
  "events",
  "lineups",
  "players",
  "statistics_extra",
];

function normalizeStatType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function serializeFixtureDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return value ?? null;
}

export function unwrapMatchPayload(payload) {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    return unwrapMatchPayload(payload[0]);
  }

  if (Array.isArray(payload.response)) {
    return unwrapMatchPayload(payload.response[0]);
  }

  if (payload.match && typeof payload.match === "object") {
    return unwrapMatchPayload(payload.match);
  }

  if (payload.fixture || payload.statistics || payload.teams) {
    return payload;
  }

  return null;
}

export function teamNameFromMatchDetails(match, teamID) {
  if (Number(match?.teams?.home?.id) === teamID && match?.teams?.home?.name) {
    return String(match.teams.home.name).trim();
  }

  if (Number(match?.teams?.away?.id) === teamID && match?.teams?.away?.name) {
    return String(match.teams.away.name).trim();
  }

  const lineup = match?.lineups?.find((entry) => Number(entry?.team?.id) === teamID);
  if (lineup?.team?.name) {
    return String(lineup.team.name).trim();
  }

  const players = match?.players?.find((entry) => Number(entry?.team?.id) === teamID);
  if (players?.team?.name) {
    return String(players.team.name).trim();
  }

  const event = match?.events?.find((entry) => Number(entry?.team?.id) === teamID);
  if (event?.team?.name) {
    return String(event.team.name).trim();
  }

  return "";
}

function toNullableInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value).replace("%", ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableDecimal(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullablePercent(value) {
  const parsed = toNullableInt(value);
  if (parsed === null) {
    return null;
  }

  return Math.min(100, Math.max(0, parsed));
}

function toWinnerFlag(value) {
  if (value === true || value === 1 || value === "1") {
    return 1;
  }

  if (value === false || value === 0 || value === "0") {
    return 0;
  }

  return null;
}

function parseStatValue(spec, rawValue) {
  if (spec.kind === "percent") {
    return toNullablePercent(rawValue);
  }

  if (spec.kind === "decimal") {
    return toNullableDecimal(rawValue);
  }

  return toNullableInt(rawValue);
}

function formatStatValue(spec, storedValue) {
  if (storedValue === null || storedValue === undefined) {
    return null;
  }

  if (spec.kind === "percent") {
    return `${storedValue}%`;
  }

  if (spec.kind === "decimal") {
    const asNumber = Number(storedValue);
    return Number.isFinite(asNumber) ? String(asNumber) : null;
  }

  return storedValue;
}

function statsArrayToMap(statistics = []) {
  const byType = new Map();

  for (const entry of statistics) {
    const spec = STAT_TYPE_TO_SPEC.get(normalizeStatType(entry?.type));
    if (!spec) {
      continue;
    }

    byType.set(spec.column, entry.value);
  }

  return byType;
}

function extraStats(statistics = []) {
  return (Array.isArray(statistics) ? statistics : [])
    .filter((entry) => entry && !STAT_TYPE_TO_SPEC.has(normalizeStatType(entry.type)))
    .map((entry) => ({ type: entry.type, value: entry.value ?? null }));
}

function findTeamStats(statistics, teamId) {
  if (!Array.isArray(statistics) || !Number.isFinite(teamId)) {
    return [];
  }

  const match = statistics.find((entry) => Number(entry?.team?.id) === teamId);
  return Array.isArray(match?.statistics) ? match.statistics : [];
}

function serializeJsonColumn(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

export function parseJsonColumn(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error("Failed to parse match_details JSON column:", error);
      return null;
    }
  }

  return value;
}

export function matchObjectToDetailsRow(matchPayload) {
  const match = unwrapMatchPayload(matchPayload);
  const matchId = Number(match?.fixture?.id);

  if (!Number.isFinite(matchId)) {
    return null;
  }

  const homeId = Number(match?.teams?.home?.id);
  const awayId = Number(match?.teams?.away?.id);
  const homeStats = statsArrayToMap(findTeamStats(match?.statistics, homeId));
  const awayStats = statsArrayToMap(findTeamStats(match?.statistics, awayId));
  const homeExtra = extraStats(findTeamStats(match?.statistics, homeId));
  const awayExtra = extraStats(findTeamStats(match?.statistics, awayId));

  const row = {
    match_id: matchId,
    referee: match?.fixture?.referee ?? null,
    timezone: match?.fixture?.timezone ?? null,
    fixture_timestamp: toNullableInt(match?.fixture?.timestamp),
    venue_id: toNullableInt(match?.fixture?.venue?.id),
    venue_name: match?.fixture?.venue?.name ?? null,
    venue_city: match?.fixture?.venue?.city ?? null,
    periods_first: toNullableInt(match?.fixture?.periods?.first),
    periods_second: toNullableInt(match?.fixture?.periods?.second),
    status_long: match?.fixture?.status?.long ?? null,
    status_elapsed: toNullableInt(match?.fixture?.status?.elapsed),
    status_extra: toNullableInt(match?.fixture?.status?.extra),
    ht_home: toNullableInt(match?.score?.halftime?.home),
    ht_away: toNullableInt(match?.score?.halftime?.away),
    et_home: toNullableInt(match?.score?.extratime?.home),
    et_away: toNullableInt(match?.score?.extratime?.away),
    pen_home: toNullableInt(match?.score?.penalty?.home),
    pen_away: toNullableInt(match?.score?.penalty?.away),
    home_winner: toWinnerFlag(match?.teams?.home?.winner),
    away_winner: toWinnerFlag(match?.teams?.away?.winner),
    events: serializeJsonColumn(match?.events ?? null),
    lineups: serializeJsonColumn(match?.lineups ?? null),
    players: serializeJsonColumn(match?.players ?? null),
    statistics_extra: serializeJsonColumn(
      homeExtra.length || awayExtra.length ? { home: homeExtra, away: awayExtra } : null,
    ),
  };

  for (const spec of STATISTIC_SPECS) {
    row[`home_${spec.column}`] = parseStatValue(spec, homeStats.get(spec.column));
    row[`away_${spec.column}`] = parseStatValue(spec, awayStats.get(spec.column));
  }

  return row;
}

function winnerFromFlag(value) {
  if (value === 1 || value === true) {
    return true;
  }

  if (value === 0 || value === false) {
    return false;
  }

  return null;
}

function buildTeamStatistics(row, side) {
  const canonical = STATISTIC_SPECS.map((spec) => ({
    type: spec.apiType,
    value: formatStatValue(spec, row[`${side}_${spec.column}`]),
  }));

  const extra = parseJsonColumn(row.statistics_extra);
  const extraForSide = Array.isArray(extra?.[side]) ? extra[side] : [];

  return [...canonical, ...extraForSide];
}

export function detailsRowToMatchObject(row, baseFixture = null) {
  if (!row) {
    return null;
  }

  const matchId = Number(row.match_id);
  const base = baseFixture && typeof baseFixture === "object" ? baseFixture : {};
  const homeId = Number(base?.teams?.home?.id);
  const awayId = Number(base?.teams?.away?.id);

  return {
    ...base,
    fixture: {
      ...(base.fixture ?? {}),
      id: Number.isFinite(matchId) ? matchId : base?.fixture?.id,
      date: serializeFixtureDate(base?.fixture?.date),
      referee: row.referee ?? base?.fixture?.referee ?? null,
      timezone: row.timezone ?? base?.fixture?.timezone ?? null,
      timestamp: row.fixture_timestamp ?? base?.fixture?.timestamp ?? null,
      periods: {
        ...(base.fixture?.periods ?? {}),
        first: row.periods_first,
        second: row.periods_second,
      },
      venue: {
        ...(base.fixture?.venue ?? {}),
        id: row.venue_id,
        name: row.venue_name,
        city: row.venue_city,
      },
      status: {
        ...(base.fixture?.status ?? {}),
        long: row.status_long,
        elapsed: row.status_elapsed,
        extra: row.status_extra,
      },
    },
    teams: {
      home: {
        ...(base.teams?.home ?? {}),
        winner: winnerFromFlag(row.home_winner),
      },
      away: {
        ...(base.teams?.away ?? {}),
        winner: winnerFromFlag(row.away_winner),
      },
    },
    score: {
      ...(base.score ?? {}),
      halftime: {
        home: row.ht_home,
        away: row.ht_away,
      },
      fulltime: {
        home: base?.score?.fulltime?.home ?? base?.goals?.home ?? null,
        away: base?.score?.fulltime?.away ?? base?.goals?.away ?? null,
      },
      extratime: {
        home: row.et_home,
        away: row.et_away,
      },
      penalty: {
        home: row.pen_home,
        away: row.pen_away,
      },
    },
    events: parseJsonColumn(row.events) ?? [],
    lineups: parseJsonColumn(row.lineups) ?? [],
    players: parseJsonColumn(row.players) ?? [],
    statistics: [
      {
        team: {
          id: Number.isFinite(homeId) ? homeId : undefined,
          name: base?.teams?.home?.name,
          logo: base?.teams?.home?.logo,
        },
        statistics: buildTeamStatistics(row, "home"),
      },
      {
        team: {
          id: Number.isFinite(awayId) ? awayId : undefined,
          name: base?.teams?.away?.name,
          logo: base?.teams?.away?.logo,
        },
        statistics: buildTeamStatistics(row, "away"),
      },
    ],
  };
}

export function extractExpectedGoals(matchPayload) {
  const row = matchObjectToDetailsRow(matchPayload);
  if (!row) {
    return { hasXg: false, home: null, away: null };
  }

  const home = row.home_xg;
  const away = row.away_xg;

  return {
    hasXg: home != null || away != null,
    home,
    away,
  };
}
