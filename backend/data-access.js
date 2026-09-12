import pool from "./config.js";
import { allDBTeams, getCatalogLeague } from "./lib/catalog.js";
import { getTeamById } from "./services/teams-service.js";
import {
  extractPlayerProfile,
  mergeProfileValue,
} from "./lib/backend-helper.js";
import {
  MATCH_DETAILS_COLUMNS,
  detailsRowToMatchObject,
  matchObjectToDetailsRow,
  serializeFixtureDate,
  unwrapMatchPayload,
} from "./lib/match-details-mapper.js";
import { normalizeLeagueConfig, normalizeSeasonValue } from "./lib/league-season.js";

let leagueSeasonTableConfigPromise = null;
const FINISHED_MATCH_STATUSES = new Set(["FT", "AET", "PEN"]);

async function getLeagueSeasonTableConfig() {
  if (!leagueSeasonTableConfigPromise) {
    leagueSeasonTableConfigPromise = (async () => {
      try {
        const [columns] = await pool.query("SHOW COLUMNS FROM LeagueSeason");
        const fields = columns.map((column) => column.Field);
        const fieldLookup = new Map(fields.map((field) => [field.toLowerCase(), field]));
        const leagueColumn = ["league_id", "league", "leagueid"].find((candidate) => fieldLookup.has(candidate));
        const seasonColumn = ["season", "year"].find((candidate) => fieldLookup.has(candidate));

        if (!leagueColumn || !seasonColumn) {
          console.warn("LeagueSeason table found, but expected league/season columns were not detected.");
          return null;
        }

        return {
          leagueColumn: fieldLookup.get(leagueColumn),
          seasonColumn: fieldLookup.get(seasonColumn),
        };
      } catch (error) {
        console.warn("LeagueSeason table is unavailable, falling back to League.season.", error.message);
        return null;
      }
    })();
  }

  return leagueSeasonTableConfigPromise;
}

export async function loadLeagueSeasonRows() {
  const tableConfig = await getLeagueSeasonTableConfig();
  if (!tableConfig) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT \`${tableConfig.leagueColumn}\` AS leagueID, \`${tableConfig.seasonColumn}\` AS season FROM LeagueSeason`,
  );

  return rows
    .map((row) => ({
      leagueID: Number(row.leagueID),
      season: normalizeSeasonValue(row.season),
    }))
    .filter((row) => Number.isFinite(row.leagueID) && row.season !== null);
}

function normalizeNationLookupKey(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

function buildNationIdResolver() {
  const nationIdByName = new Map();

  for (const team of allDBTeams || []) {
    const key = normalizeNationLookupKey(team?.name);
    const teamID = Number(team?.ID);

    if (!key || !Number.isFinite(teamID) || nationIdByName.has(key)) {
      continue;
    }

    nationIdByName.set(key, teamID);
  }

  return (nationName) => {
    const key = normalizeNationLookupKey(nationName);
    if (!key) {
      return null;
    }

    return nationIdByName.get(key) ?? null;
  };
}

export async function loadPlayers() {
  try {
    const [rows] = await pool.query("SELECT * FROM Player");
    return rows;
  } catch (error) {
    console.error("Error loading players from the database:", error);
    throw error;
  }
}

export async function loadPlayerById(playerID) {
  const normalizedID = Number(playerID);
  if (!Number.isFinite(normalizedID) || normalizedID <= 0) {
    return null;
  }

  const [rows] = await pool.query("SELECT * FROM Player WHERE id = ?", [normalizedID]);
  return rows[0] ?? null;
}

export async function loadTeams() {
  try {
    const [rows] = await pool.query("SELECT * FROM Team");
    return rows;
  } catch (error) {
    console.error("Error loading teams from the database:", error);
    throw error;
  }
}

export async function loadLeagues() {
  try {
    const [rows] = await pool.query("SELECT * FROM League");
    const leagueSeasonRows = await loadLeagueSeasonRows();
    const seasonsByLeague = new Map();

    for (const { leagueID, season } of leagueSeasonRows) {
      if (!seasonsByLeague.has(leagueID)) {
        seasonsByLeague.set(leagueID, new Set());
      }

      seasonsByLeague.get(leagueID).add(season);
    }

    let leagues = rows.map((league) => {
      const seasons = [...(seasonsByLeague.get(Number(league.id)) ?? [])]
        .sort((a, b) => b - a);

      return {
        ...league,
        season: seasons[0] ?? league.season,
        seasons: seasons.length > 0 ? seasons : [Number(league.season)],
      };
    });
    leagues = leagues.sort((a, b) => a.sort_order - b.sort_order);
    leagues = leagues.filter((lg) => lg.Visible);
    return leagues;
  } catch (error) {
    console.error("Error loading leagues from the database:", error);
    throw error;
  }
}

export async function saveLeagueStandingsToDb(leagueID, standings, season = 2026) {
  try {
    await pool.execute(
      "INSERT INTO `League_Standing` (league_id, standings, season) VALUES (?, ?, ?)",
      [leagueID, JSON.stringify(standings), season],
    );

    return { leagueID, standings };
  } catch (error) {
    console.error(`Error saving standings for league ${leagueID}:`, error);
    throw error;
  }
}

export async function getLeagueStandingsFromDb(leagueID, season = null) {
  try {
    const normalizedSeason = normalizeSeasonValue(season);
    const query = normalizedSeason === null
      ? "SELECT standings FROM `League_Standing` WHERE league_id = ? ORDER BY id DESC LIMIT 1"
      : "SELECT standings FROM `League_Standing` WHERE league_id = ? AND season = ? ORDER BY id DESC LIMIT 1";
    const params = normalizedSeason === null
      ? [leagueID]
      : [leagueID, normalizedSeason];
    const [rows] = await pool.query(query, params);

    if (!rows.length) {
      return [];
    }

    const standings = rows[0].standings;

    if (Array.isArray(standings)) {
      return standings;
    }

    if (typeof standings === "string") {
      return JSON.parse(standings);
    }

    return standings || [];
  } catch (error) {
    console.error(
      `Error loading standings for league ${leagueID}${normalizedSeason === null ? "" : ` in season ${normalizedSeason}`}:`,
      error,
    );
    return [];
  }
}

export async function insertPlayersToDb(allPlayers, { overwritePosition = true } = {}) {
  // Filter out players without valid IDs
  const validPlayers = allPlayers.filter(
    (player) => player.id != null && player.id !== "",
  );

  if (validPlayers.length === 0) {
    console.log({ message: "No valid players to insert." });
    return;
  }

  const BATCH_SIZE = 500; // Reduced to 500 (2500 placeholders per batch)
  let totalInserted = 0;

  try {
    // Process in batches
    for (let i = 0; i < validPlayers.length; i += BATCH_SIZE) {
      const batch = validPlayers.slice(i, i + BATCH_SIZE);

      // Prepare bulk insert values for this batch
      const values = batch.map((player) => [
        player.id,
        player.name,
        player.club,
        player.nation,
        player.position[0] || "",
      ]);

      // Create placeholders and flatten values
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
      const flatValues = values.flat();

      const positionUpdate = overwritePosition
        ? "position = VALUES(position)"
        : "position = IF(position IS NULL OR TRIM(IFNULL(position, '')) = '', VALUES(position), position)";

      await pool.execute(
        `INSERT INTO Player (id, name, club, nation, position)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
          club = IF(VALUES(club) <> 0 AND club <> VALUES(club), VALUES(club), club),
          nation = IF(VALUES(nation) <> 0 AND nation <> VALUES(nation), VALUES(nation), nation),
          ${positionUpdate};`,
        flatValues,
      );

      totalInserted += batch.length;
      console.log(
        `Processed ${totalInserted}/${validPlayers.length} players...`,
      );
    }

    console.log({
      message: `${validPlayers.length} players loaded successfully!`,
    });
  } catch (error) {
    console.error({ error: "Error loading players.", details: error.message });
  }
}

export async function getTransferPlayersForInsert() {
  try {
    const [rows] = await pool.query(
      `SELECT
         latest.player_id AS id,
         COALESCE(NULLIF(TRIM(latest.player_name), ''), CONCAT('Player ', latest.player_id)) AS name,
         COALESCE(
           NULLIF(latest.team_in_id, 0),
           NULLIF(latest.team_out_id, 0),
           0
         ) AS club
       FROM Player_Transfer latest
       INNER JOIN (
         SELECT player_id, id AS max_id
         FROM (
           SELECT player_id, id,
             ROW_NUMBER() OVER (
               PARTITION BY player_id
               ORDER BY transfer_date IS NULL ASC, transfer_date DESC, id DESC
             ) AS rn
           FROM Player_Transfer
         ) ranked
         WHERE rn = 1
       ) grouped ON grouped.max_id = latest.id`,
    );

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      club: Number(row.club) || 0,
      nation: 0,
      position: [""],
    }));
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      console.warn("[getTransferPlayersForInsert] Player_Transfer table does not exist yet.");
      return [];
    }

    console.error("Error loading transfer players for insert:", error);
    throw error;
  }
}

export async function getPlayersMissingExtraData() {
  try {
    const [rows] = await pool.query(
      `SELECT id, name
       FROM Player
       WHERE (first_name IS NULL OR TRIM(first_name) = '')
         AND (last_name IS NULL OR TRIM(last_name) = '')
         AND birth_date IS NULL
         AND (birth_location IS NULL OR TRIM(birth_location) = '')
         AND (height IS NULL OR height = 0)
         AND (weight IS NULL OR weight = 0)
         AND (shirt_number IS NULL OR shirt_number = 0)
       ORDER BY name ASC, id ASC`,
    );

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
    }));
  } catch (error) {
    console.error("Error loading players missing extra data:", error);
    throw error;
  }
}

export async function updatePlayerProfilesInDb(playerPayloads = []) {
  console.log(
    `[updatePlayerProfilesInDb] Starting profile update from ${playerPayloads.length} raw player payload(s).`,
  );

  const profilesById = new Map();
  const resolveNationId = buildNationIdResolver();
  let skippedPayloads = 0;
  let unresolvedNationPayloads = 0;

  for (const payload of playerPayloads) {
    const profile = extractPlayerProfile(payload, { resolveNationId });
    if (!profile) {
      skippedPayloads += 1;
      continue;
    }

    const nationality = String(payload?.player?.nationality || payload?.nationality || "").trim();
    if (nationality && profile.nation === null) {
      unresolvedNationPayloads += 1;
    }

    const existing = profilesById.get(profile.id);
    if (!existing) {
      profilesById.set(profile.id, profile);
      continue;
    }

    profilesById.set(profile.id, {
      id: profile.id,
      firstName: mergeProfileValue(existing.firstName, profile.firstName),
      lastName: mergeProfileValue(existing.lastName, profile.lastName),
      birthDate: mergeProfileValue(existing.birthDate, profile.birthDate),
      birthLocation: mergeProfileValue(existing.birthLocation, profile.birthLocation),
      height: mergeProfileValue(existing.height, profile.height),
      weight: mergeProfileValue(existing.weight, profile.weight),
      nation: mergeProfileValue(existing.nation, profile.nation),
      shirtNumber: mergeProfileValue(existing.shirtNumber, profile.shirtNumber),
    });
  }

  const profiles = [...profilesById.values()];
  console.log(
    `[updatePlayerProfilesInDb] Collapsed to ${profiles.length} unique player profile(s). Skipped ${skippedPayloads} payload(s) without a valid player id.`,
  );

  if (unresolvedNationPayloads > 0) {
    console.warn(
      `[updatePlayerProfilesInDb] Could not map nationality name to nation ID for ${unresolvedNationPayloads} payload(s). Existing DB nation values were preserved for those players.`,
    );
  }

  if (profiles.length === 0) {
    console.warn("[updatePlayerProfilesInDb] No valid player profiles found to update.");
    return {
      processed: 0,
      updatedRows: 0,
    };
  }

  let updatedRows = 0;
  const LOG_INTERVAL = 250;

  for (let i = 0; i < profiles.length; i += 1) {
    const profile = profiles[i];

    try {
      const [result] = await pool.execute(
        `UPDATE Player
         SET
           first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           birth_date = COALESCE(?, birth_date),
           birth_location = COALESCE(?, birth_location),
           height = COALESCE(?, height),
           weight = COALESCE(?, weight),
           nation = COALESCE(?, nation),
           shirt_number = COALESCE(?, shirt_number)
         WHERE id = ?`,
        [
          profile.firstName,
          profile.lastName,
          profile.birthDate,
          profile.birthLocation,
          profile.height,
          profile.weight,
          profile.nation,
          profile.shirtNumber,
          profile.id,
        ],
      );

      updatedRows += Number(result?.affectedRows || 0);
    } catch (error) {
      console.error(
        `[updatePlayerProfilesInDb] Failed updating player ${profile.id}:`,
        {
          profile,
          error: error.message,
        },
      );
      throw error;
    }

    const processed = i + 1;
    if (processed % LOG_INTERVAL === 0 || processed === profiles.length) {
      console.log(
        `[updatePlayerProfilesInDb] Processed ${processed}/${profiles.length} profile(s). Rows affected so far: ${updatedRows}`,
      );
    }
  }

  console.log(
    `[updatePlayerProfilesInDb] Completed profile update. Processed ${profiles.length} unique player(s), rows affected: ${updatedRows}`,
  );

  return {
    processed: profiles.length,
    updatedRows,
  };
}

export async function insertTeamsToDb(teams) {
  try {
    for (const team of teams) {
      const { ID, name } = team;
      await pool.execute(
        `INSERT INTO Team (ID, name)
          VALUES (?, ?)
          ON DUPLICATE KEY UPDATE
          name = VALUES(name);`,
        [ID, name],
      );
    }
    console.log({ message: "Teams loaded successfully!" });
  } catch (error) {
    console.error({ error: "Error loading teams.", details: error.message });
  }
}

export async function ensureMatchesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS matches (
      id INT PRIMARY KEY,
      league_id INT NOT NULL,
      season INT NOT NULL,
      round VARCHAR(100),
      home_team_id INT NOT NULL,
      away_team_id INT NOT NULL,
      match_date DATETIME NOT NULL,
      status VARCHAR(20) NOT NULL,
      home_score INT,
      away_score INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_league_season (league_id, season),
      INDEX idx_match_date (match_date)
    )
  `);
}

export async function upsertMatchSummaries(matchPayloads, { skipExistingFinished = false } = {}) {
  const matches = (Array.isArray(matchPayloads) ? matchPayloads : [matchPayloads])
    .map((payload) => unwrapMatchPayload(payload))
    .filter(Boolean);

  if (matches.length === 0) {
    return { importedMatches: 0, skippedFinishedMatches: 0 };
  }

  const fixtureIDs = matches
    .map((match) => Number(match?.fixture?.id))
    .filter((fixtureID) => Number.isFinite(fixtureID));
  const finishedFixtureIDs = new Set();

  if (skipExistingFinished && fixtureIDs.length > 0) {
    const [existingFinishedMatches] = await pool.query(
      "SELECT id FROM matches WHERE id IN (?) AND status IN (?)",
      [fixtureIDs, [...FINISHED_MATCH_STATUSES]],
    );

    for (const row of existingFinishedMatches) {
      finishedFixtureIDs.add(Number(row.id));
    }
  }

  let importedMatches = 0;
  let skippedFinishedMatches = 0;

  for (const match of matches) {
    const fixtureID = Number(match?.fixture?.id);
    if (!Number.isFinite(fixtureID)) {
      continue;
    }

    if (skipExistingFinished && finishedFixtureIDs.has(fixtureID)) {
      skippedFinishedMatches += 1;
      continue;
    }

    await pool.query(
      `INSERT INTO matches
    (id, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      league_id = VALUES(league_id),
      season = VALUES(season),
      round = VALUES(round),
      home_team_id = VALUES(home_team_id),
      away_team_id = VALUES(away_team_id),
      match_date = VALUES(match_date),
      status = VALUES(status),
      home_score = VALUES(home_score),
      away_score = VALUES(away_score)`,
      [
        fixtureID,
        match.league?.id,
        match.league?.season,
        match.league?.round,
        match.teams?.home?.id,
        match.teams?.away?.id,
        String(match.fixture?.date ?? "").replace("T", " ").slice(0, 19),
        match.fixture?.status?.short,
        match.goals?.home,
        match.goals?.away,
      ],
    );
    importedMatches += 1;
  }

  return { importedMatches, skippedFinishedMatches };
}

export async function getLeagueFromDb(leagueIDs) {
  leagueIDs = Array.isArray(leagueIDs) ? leagueIDs : [leagueIDs];
  const leagueConfigs = leagueIDs
    .map(normalizeLeagueConfig)
    .filter(({ leagueID, season }) => Number.isFinite(leagueID) && season !== null);

  if (leagueConfigs.length === 0) {
    return [];
  }

  try {
    const placeholders = leagueConfigs
      .map(() => "(league_id = ? AND season = ?)")
      .join(" OR ");
    const params = leagueConfigs.flatMap(({ leagueID, season }) => [
      leagueID,
      season,
    ]);

    const [rows] = await pool.query(
      `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM matches
       WHERE (${placeholders})
       ORDER BY match_date ASC`,
      params,
    );

    return rows.map((r) => ({
      fixture: {
        id: r.fixtureId,
        date: serializeFixtureDate(r.match_date),
        status: { short: r.status },
      },
      league: {
        id: r.league_id,
        season: r.season,
        round: r.round,
        name: getCatalogLeague(r.league_id)?.name ?? null,
        country: getCatalogLeague(r.league_id)?.country ?? null,
      },
      teams: {
        home: {
          id: r.home_team_id,
          name: getTeamById(r.home_team_id)?.name || "Unknown",
        },
        away: {
          id: r.away_team_id,
          name: getTeamById(r.away_team_id)?.name || "Unknown",
        },
      },
      goals: {
        home: r.home_score,
        away: r.away_score,
      },
    }));
  } catch (e) {
    console.error(
      `❌ Failed to load leagues ${leagueIDs.join(", ")} from DB:`,
      e,
    );
    return [];
  }
}

export async function getLeagueSeasonConfigsFromMatches(leagueIDs) {
  const ids = (Array.isArray(leagueIDs) ? leagueIDs : [leagueIDs])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  if (ids.length === 0) {
    return [];
  }

  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT league_id AS leagueID, season
       FROM matches
       WHERE league_id IN (?)
       ORDER BY league_id ASC, season DESC`,
      [ids],
    );

    return rows
      .map((row) => ({
        leagueID: Number(row.leagueID),
        season: normalizeSeasonValue(row.season),
      }))
      .filter(({ leagueID, season }) => Number.isFinite(leagueID) && season !== null);
  } catch (error) {
    console.error("Error loading league season configs from matches table:", error);
    return [];
  }
}

export async function getAllTeamMatchesFromDb(teams) {
  try {
    const [rows] = await pool.query(
      `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM matches
       WHERE home_team_id IN (?) 
          OR away_team_id IN (?)
       ORDER BY match_date ASC`,
      [teams, teams],
    );

    return rows;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function getAllMatchesFromDbUntilDate(givenDate) {
  try {
    const [rows] = await pool.query(
      `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM matches
        WHERE match_date < ? AND status <> 'PST'
       ORDER BY match_date ASC`,
      [givenDate],
    );

    const teamNameById = new Map((allDBTeams || []).map((team) => [team.ID, team.name]));

    return rows.map((r) => ({
      fixtureId: r.fixtureId,
      fixtureDate: r.match_date,
      fixtureStatus: r.status,
      leagueId: r.league_id,
      leagueSeason: r.season,
      leagueRound: r.round,
      homeTeamId: r.home_team_id,
      homeTeamName: teamNameById.get(r.home_team_id) || "Unknown",
      awayTeamId: r.away_team_id,
      awayTeamName: teamNameById.get(r.away_team_id) || "Unknown",
      homeGoals: r.home_score,
      awayGoals: r.away_score,
    }));
  } catch (e) {
    console.error(`❌ Failed to load all matches from DB:`, e);
    return [];
  }
}

export async function getAllMatchesFromDb() {
  try {
    const [rows] = await pool.query(
      `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM matches
       WHERE status <> 'PST'
       ORDER BY match_date ASC`,
    );

    const teamNameById = new Map((allDBTeams || []).map((team) => [team.ID, team.name]));

    return rows.map((r) => ({
      fixtureId: r.fixtureId,
      fixtureDate: r.match_date,
      fixtureStatus: r.status,
      leagueId: r.league_id,
      leagueSeason: r.season,
      leagueRound: r.round,
      homeTeamId: r.home_team_id,
      homeTeamName: teamNameById.get(r.home_team_id) || "Unknown",
      awayTeamId: r.away_team_id,
      awayTeamName: teamNameById.get(r.away_team_id) || "Unknown",
      homeGoals: r.home_score,
      awayGoals: r.away_score,
    }));
  } catch (e) {
    console.error(`❌ Failed to load all matches from DB:`, e);
    return [];
  }
}

const MATCH_DETAILS_ID_CHUNK_SIZE = 500;
const MATCH_DETAILS_UPDATE_COLUMNS = MATCH_DETAILS_COLUMNS.filter((column) => column !== "match_id");
const MATCH_DETAILS_INSERT_PLACEHOLDERS = MATCH_DETAILS_COLUMNS.map(() => "?").join(", ");
const MATCH_DETAILS_ON_UPDATE = MATCH_DETAILS_UPDATE_COLUMNS
  .map((column) => `${column} = VALUES(${column})`)
  .join(", ");

function chunkIds(ids, size) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

function normalizeMatchIds(ids) {
  const source = ids === undefined || ids === null ? [] : Array.isArray(ids) ? ids : [ids];
  return [...new Set(source.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
}

function detailsRowValues(row) {
  return MATCH_DETAILS_COLUMNS.map((column) => row[column] ?? null);
}

function baseFixtureFromDetailsRow(row) {
  const homeTeamId = Number(row.home_team_id);
  const awayTeamId = Number(row.away_team_id);

  return {
    fixture: {
      id: Number(row.match_id),
      date: serializeFixtureDate(row.match_date),
      status: { short: row.match_status },
    },
    league: {
      id: row.league_id,
      season: row.season,
      round: row.round,
      name: getCatalogLeague(row.league_id)?.name ?? null,
      country: getCatalogLeague(row.league_id)?.country ?? null,
    },
    teams: {
      home: {
        id: Number.isFinite(homeTeamId) ? homeTeamId : undefined,
        name: Number.isFinite(homeTeamId) ? getTeamById(homeTeamId)?.name : undefined,
      },
      away: {
        id: Number.isFinite(awayTeamId) ? awayTeamId : undefined,
        name: Number.isFinite(awayTeamId) ? getTeamById(awayTeamId)?.name : undefined,
      },
    },
    goals: {
      home: row.home_score,
      away: row.away_score,
    },
  };
}

export async function getMatchDetailsByIds(ids) {
  const matchIds = normalizeMatchIds(ids);
  if (matchIds.length === 0) {
    return [];
  }

  const detailsById = new Map();

  for (const idChunk of chunkIds(matchIds, MATCH_DETAILS_ID_CHUNK_SIZE)) {
    const [rows] = await pool.query(
      `SELECT d.*,
              m.home_team_id,
              m.away_team_id,
              m.home_score,
              m.away_score,
              m.status AS match_status,
              m.match_date,
              m.league_id,
              m.season,
              m.round
       FROM match_details d
       LEFT JOIN matches m ON m.id = d.match_id
       WHERE d.match_id IN (?)`,
      [idChunk],
    );

    for (const row of rows) {
      const matchObject = detailsRowToMatchObject(row, baseFixtureFromDetailsRow(row));
      if (matchObject?.fixture?.id != null) {
        detailsById.set(Number(row.match_id), matchObject);
      }
    }
  }

  return matchIds
    .map((matchId) => detailsById.get(matchId))
    .filter(Boolean);
}

export async function getMatchDetailsById(id) {
  const [match] = await getMatchDetailsByIds([id]);
  return match ?? null;
}

export async function upsertMatchDetails(matchId, matchObject, { overwrite = false } = {}) {
  const row = matchObjectToDetailsRow(matchPayloadWithId(matchObject, matchId));
  if (!row) {
    throw new Error("Invalid match payload provided for match_details save.");
  }

  const values = detailsRowValues(row);

  if (overwrite) {
    await pool.query(
      `INSERT INTO match_details (${MATCH_DETAILS_COLUMNS.join(", ")})
       VALUES (${MATCH_DETAILS_INSERT_PLACEHOLDERS})
       ON DUPLICATE KEY UPDATE ${MATCH_DETAILS_ON_UPDATE}`,
      values,
    );

    return { matchId: row.match_id, saved: true, skipped: false };
  }

  const [result] = await pool.query(
    `INSERT IGNORE INTO match_details (${MATCH_DETAILS_COLUMNS.join(", ")})
     VALUES (${MATCH_DETAILS_INSERT_PLACEHOLDERS})`,
    values,
  );

  const skipped = Number(result?.affectedRows || 0) === 0;
  return {
    matchId: row.match_id,
    saved: !skipped,
    skipped,
  };
}

export async function insertMatchDetailsRows(rows, { overwrite = false } = {}) {
  const validRows = (Array.isArray(rows) ? rows : []).filter((row) => Number.isFinite(Number(row?.match_id)));
  if (validRows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const placeholders = validRows.map(() => `(${MATCH_DETAILS_INSERT_PLACEHOLDERS})`).join(", ");
  const values = validRows.flatMap((row) => detailsRowValues(row));

  const sql = overwrite
    ? `INSERT INTO match_details (${MATCH_DETAILS_COLUMNS.join(", ")})
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE ${MATCH_DETAILS_ON_UPDATE}`
    : `INSERT IGNORE INTO match_details (${MATCH_DETAILS_COLUMNS.join(", ")})
       VALUES ${placeholders}`;

  const [result] = await pool.query(sql, values);
  const affectedRows = Number(result?.affectedRows || 0);

  if (overwrite) {
    return { inserted: validRows.length, skipped: 0 };
  }

  return {
    inserted: affectedRows,
    skipped: Math.max(0, validRows.length - affectedRows),
  };
}

function matchPayloadWithId(matchObject, matchId) {
  const numericId = Number(matchId);
  if (!Number.isFinite(numericId) || !matchObject || typeof matchObject !== "object") {
    return matchObject;
  }

  if (Number(matchObject?.fixture?.id) === numericId) {
    return matchObject;
  }

  return {
    ...matchObject,
    fixture: {
      ...(matchObject.fixture ?? {}),
      id: numericId,
    },
  };
}

export async function getMatchIdsMissingDetails(ids) {
  const matchIds = normalizeMatchIds(ids);
  const finishedStatuses = [...FINISHED_MATCH_STATUSES];

  if (matchIds.length > 0) {
    const missing = [];

    for (const idChunk of chunkIds(matchIds, MATCH_DETAILS_ID_CHUNK_SIZE)) {
      const [rows] = await pool.query(
        `SELECT m.id AS fixtureId
         FROM matches m
         LEFT JOIN match_details d ON d.match_id = m.id
         WHERE m.id IN (?)
           AND m.status IN (?)
           AND d.match_id IS NULL`,
        [idChunk, finishedStatuses],
      );
      missing.push(...rows.map((row) => Number(row.fixtureId)));
    }

    return missing;
  }

  const [rows] = await pool.query(
    `SELECT m.id AS fixtureId
     FROM matches m
     LEFT JOIN match_details d ON d.match_id = m.id
     WHERE m.status IN (?)
       AND d.match_id IS NULL
     ORDER BY m.match_date ASC`,
    [finishedStatuses],
  );

  return rows.map((row) => Number(row.fixtureId));
}

export async function getMatchIdsWithoutDetails({ finishedOnly = false, overwrite = false, limit = null } = {}) {
  const params = [];
  let sql = overwrite
    ? `SELECT m.id AS fixtureId FROM matches m`
    : `SELECT m.id AS fixtureId
       FROM matches m
       LEFT JOIN match_details d ON d.match_id = m.id
       WHERE d.match_id IS NULL`;

  if (finishedOnly) {
    sql += overwrite ? ` WHERE m.status IN (?)` : ` AND m.status IN (?)`;
    params.push([...FINISHED_MATCH_STATUSES]);
  }

  sql += ` ORDER BY m.match_date ASC`;

  const parsedLimit = Number(limit);
  if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
    sql += ` LIMIT ?`;
    params.push(parsedLimit);
  }

  const [rows] = await pool.query(sql, params);
  return rows.map((row) => Number(row.fixtureId)).filter((id) => Number.isFinite(id));
}

function parseStoredSquad(rawSquad) {
  if (rawSquad == null) {
    return null;
  }

  if (typeof rawSquad === "string") {
    try {
      return JSON.parse(rawSquad);
    } catch (error) {
      console.error("Failed to parse stored squad JSON:", error);
      return null;
    }
  }

  return rawSquad;
}

function squadHasPlayers(squad) {
  const candidates = Array.isArray(squad) ? squad : [squad];
  return candidates.some((entry) => Array.isArray(entry?.players) && entry.players.length > 0);
}

function normalizeSquadRecord(rawSquad) {
  const parsed = parseStoredSquad(rawSquad);
  if (!parsed) {
    return null;
  }

  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  const squadWithPlayers = candidates.find((entry) => Array.isArray(entry?.players) && entry.players.length > 0);

  return squadWithPlayers || null;
}

export async function markTeamSquadUpdated(teamID) {
  const normalizedTeamID = Number(teamID);
  if (!Number.isFinite(normalizedTeamID)) {
    return;
  }

  await pool.execute("UPDATE Team SET squad_updated = NOW() WHERE ID = ?", [normalizedTeamID]);
}

export async function saveSquadToDb(teamID, squad) {
  const normalizedTeamID = Number(teamID);
  if (!Number.isFinite(normalizedTeamID)) {
    throw new Error("Invalid team ID provided for squad save.");
  }

  if (!squad || typeof squad !== "object") {
    throw new Error("Invalid squad payload provided for squad save.");
  }

  if (!squadHasPlayers(squad)) {
    throw new Error("Refusing to save empty squad payload.");
  }

  const serializedSquad = JSON.stringify(squad);

  await pool.execute("DELETE FROM Squads WHERE team_id = ?", [normalizedTeamID]);
  await pool.execute(
    "INSERT INTO Squads (team_id, squad) VALUES (?, ?)",
    [normalizedTeamID, serializedSquad],
  );
  await markTeamSquadUpdated(normalizedTeamID);

  return {
    teamID: normalizedTeamID,
    saved: true,
  };
}

export async function getSquadFromDb(teamID) {
  const normalizedTeamID = Number(teamID);
  if (!Number.isFinite(normalizedTeamID)) {
    throw new Error("Invalid team ID provided for squad lookup.");
  }

  const [rows] = await pool.query(
    `SELECT s.squad, t.squad_updated, t.transfer_updated
     FROM Team t
     LEFT JOIN Squads s ON s.team_id = t.ID
     WHERE t.ID = ?
     ORDER BY s.id DESC
     LIMIT 1`,
    [normalizedTeamID],
  );

  if (!rows.length) {
    return { squad: null, squadUpdatedAt: null, transferUpdatedAt: null };
  }

  return {
    squad: normalizeSquadRecord(rows[0].squad),
    squadUpdatedAt: rows[0].squad_updated ?? null,
    transferUpdatedAt: rows[0].transfer_updated ?? null,
  };
}

export async function getTeamsDueForSquadUpdate(limit = 150) {
  const normalizedLimit = Number(limit);
  const safeLimit = Number.isFinite(normalizedLimit) && normalizedLimit > 0
    ? Math.floor(normalizedLimit)
    : 150;

  try {
    const [rows] = await pool.query(
      `SELECT ID, name FROM Team m
       ORDER BY (m.squad_updated IS NOT NULL), m.squad_updated ASC
       LIMIT ${safeLimit}`,
    );

    return rows;
  } catch (error) {
    console.error("Error loading teams due for a squad update:", error);
    return [];
  }
}

export async function saveTransfersToDb(transfersData, { replacePlayerHistory = false } = {}) {
  const players = Array.isArray(transfersData) ? transfersData : [];

  if (players.length === 0) {
    return { saved: 0 };
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Player_Transfer (
      id INT AUTO_INCREMENT PRIMARY KEY,
      player_id INT NOT NULL,
      player_name VARCHAR(255) NOT NULL,
      transfer_date DATE NULL,
      type VARCHAR(50) NULL,
      team_in_id INT NULL,
      team_in_name VARCHAR(255) NULL,
      team_out_id INT NULL,
      team_out_name VARCHAR(255) NULL,
      api_updated_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_transfer (player_id, transfer_date, team_in_id, team_out_id),
      INDEX idx_player (player_id),
      INDEX idx_team_in (team_in_id),
      INDEX idx_team_out (team_out_id)
    )
  `);

  const playersByID = new Map();
  for (const playerEntry of players) {
    const playerID = Number(playerEntry?.player?.id);
    if (!Number.isFinite(playerID)) {
      continue;
    }

    playersByID.set(playerID, playerEntry);
  }

  if (playersByID.size === 0) {
    return { saved: 0 };
  }

  // The API occasionally returns players without a name; fall back to the stored name.
  const idsMissingName = [...playersByID.entries()]
    .filter(([, entry]) => !entry?.player?.name)
    .map(([playerID]) => playerID);
  const fallbackNames = new Map();

  if (idsMissingName.length > 0) {
    const [rows] = await pool.query(
      `SELECT id, name FROM Player WHERE id IN (${idsMissingName.map(() => "?").join(", ")})`,
      idsMissingName,
    );

    for (const row of rows) {
      if (row?.name) {
        fallbackNames.set(Number(row.id), row.name);
      }
    }
  }

  const connection = await pool.getConnection();
  let savedCount = 0;

  try {
    await connection.beginTransaction();

    for (const [playerID, playerEntry] of playersByID) {
      const playerName = playerEntry?.player?.name || fallbackNames.get(playerID) || null;
      if (!playerName) {
        console.warn(`Skipping transfers for player ${playerID}: missing player name.`);
        continue;
      }
      const apiUpdatedAt = playerEntry?.update
        ? new Date(playerEntry.update)
        : null;
      const transfers = Array.isArray(playerEntry.transfers) ? playerEntry.transfers : [];
      const transferKeys = new Set();

      // Team-level API payloads only include transfers involving that club, not the
      // player's full history. Replacing all rows would wipe career moves gathered
      // from other clubs. Only wipe when we have a complete player-level payload.
      if (replacePlayerHistory) {
        await connection.execute("DELETE FROM Player_Transfer WHERE player_id = ?", [playerID]);
      }

      for (const transfer of transfers) {
        const transferDate = transfer?.date || null;
        const teamInID = transfer?.teams?.in?.id ?? null;
        const teamOutID = transfer?.teams?.out?.id ?? null;
        const transferKey = JSON.stringify([transferDate, teamInID, teamOutID]);
        if (transferKeys.has(transferKey)) {
          continue;
        }
        transferKeys.add(transferKey);

        const type = transfer?.type ?? null;
        const teamInName = transfer?.teams?.in?.name ?? null;
        const teamOutName = transfer?.teams?.out?.name ?? null;

        const insertSql = replacePlayerHistory
          ? `INSERT INTO Player_Transfer
          (player_id, player_name, transfer_date, type, team_in_id, team_in_name, team_out_id, team_out_name, api_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`
          : `INSERT INTO Player_Transfer
          (player_id, player_name, transfer_date, type, team_in_id, team_in_name, team_out_id, team_out_name, api_updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            player_name = VALUES(player_name),
            type = VALUES(type),
            team_in_name = VALUES(team_in_name),
            team_out_name = VALUES(team_out_name),
            api_updated_at = VALUES(api_updated_at);`;

        const [result] = await connection.execute(
          insertSql,
          [playerID, playerName, transferDate, type, teamInID, teamInName, teamOutID, teamOutName, apiUpdatedAt],
        );
        savedCount += result.affectedRows;
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return { saved: savedCount };
}

export async function getLatestTransfers(limit = 10, leagueIDs = []) {
  const normalizedLimit = Number(limit);
  const safeLimit = Number.isFinite(normalizedLimit) && normalizedLimit > 0
    ? Math.floor(normalizedLimit)
    : 10;
  const leagues = (Array.isArray(leagueIDs) ? leagueIDs : [leagueIDs])
    .map(Number)
    .filter(Number.isFinite);

  // Team-to-league membership only exists per-fixture in `matches`. Resolve it to a team ID list first
  // (filtered by the indexed league_id) instead of correlating against the ~80k-row matches table per
  // transfer row, which was a full cross-scan against Player_Transfer's ~240k rows and hung indefinitely.
  let teamFilter = "";
  let teamParams = [];
  if (leagues.length) {
    const placeholders = leagues.map(() => "?").join(",");
    const [teamRows] = await pool.query(
      `SELECT DISTINCT home_team_id AS team_id FROM matches WHERE league_id IN (${placeholders})
       UNION
       SELECT DISTINCT away_team_id AS team_id FROM matches WHERE league_id IN (${placeholders})`,
      [...leagues, ...leagues],
    );
    const teamIDs = teamRows.map((row) => Number(row.team_id)).filter(Number.isFinite);

    if (teamIDs.length === 0) {
      return [];
    }

    const teamPlaceholders = teamIDs.map(() => "?").join(",");
    teamFilter = `AND (pt.team_in_id IN (${teamPlaceholders}) OR pt.team_out_id IN (${teamPlaceholders}))`;
    teamParams = [...teamIDs, ...teamIDs];
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         pt.player_id,
         pt.player_name,
         pt.transfer_date,
         pt.type,
         pt.team_in_id,
         pt.team_in_name,
         pt.team_out_id,
         pt.team_out_name,
         p.nation AS player_nation,
         nation.name AS player_nation_name,
         p.position AS player_position
       FROM Player_Transfer pt
       LEFT JOIN Player p ON p.id = pt.player_id
       LEFT JOIN Team nation ON nation.ID = p.nation
       WHERE 1=1 ${teamFilter}
       ORDER BY pt.transfer_date DESC, pt.id DESC
       LIMIT ${safeLimit}`,
      teamParams,
    );

    return rows;
  } catch (error) {
    console.error("Error loading latest transfers:", error);
    return [];
  }
}

export async function getTransfersByPlayer(playerID) {
  const normalizedPlayerID = Number(playerID);
  if (!Number.isFinite(normalizedPlayerID)) {
    return [];
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         pt.player_id,
         pt.player_name,
         pt.transfer_date,
         pt.type,
         pt.team_in_id,
         pt.team_in_name,
         pt.team_out_id,
         pt.team_out_name,
         p.nation AS player_nation,
         nation.name AS player_nation_name,
         p.position AS player_position
       FROM Player_Transfer pt
       LEFT JOIN Player p ON p.id = pt.player_id
       LEFT JOIN Team nation ON nation.ID = p.nation
       WHERE pt.player_id = ?
       ORDER BY pt.transfer_date DESC, pt.id DESC`,
      [normalizedPlayerID],
    );

    return rows;
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return [];
    }

    console.error(`Error loading transfers for player ${normalizedPlayerID}:`, error);
    return [];
  }
}

export async function getTransfersByTeam(teamID, limit = 25) {
  const normalizedTeamID = Number(teamID);
  const normalizedLimit = Number(limit);
  const safeLimit = Number.isFinite(normalizedLimit) && normalizedLimit > 0
    ? Math.floor(normalizedLimit)
    : 25;

  if (!Number.isFinite(normalizedTeamID)) {
    return [];
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         pt.player_id,
         pt.player_name,
         pt.transfer_date,
         pt.type,
         pt.team_in_id,
         pt.team_in_name,
         pt.team_out_id,
         pt.team_out_name,
         p.nation AS player_nation,
         nation.name AS player_nation_name,
         p.position AS player_position
       FROM Player_Transfer pt
       LEFT JOIN Player p ON p.id = pt.player_id
       LEFT JOIN Team nation ON nation.ID = p.nation
       WHERE pt.team_in_id = ? OR pt.team_out_id = ?
       ORDER BY pt.transfer_date DESC, pt.id DESC
       LIMIT ${safeLimit}`,
      [normalizedTeamID, normalizedTeamID],
    );

    return rows;
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return [];
    }

    console.error(`Error loading transfers for team ${normalizedTeamID}:`, error);
    return [];
  }
}

export async function getTeamsDueForTransferUpdate(limit = 150) {
  const normalizedLimit = Number(limit);
  const safeLimit = Number.isFinite(normalizedLimit) && normalizedLimit > 0
    ? Math.floor(normalizedLimit)
    : 150;

  try {
    const [rows] = await pool.query(
      `SELECT ID, name FROM Team m 
       WHERE is_club = 1
       ORDER BY (m.transfer_updated IS NOT NULL), m.transfer_updated ASC
       LIMIT ${safeLimit}`,
    );

    return rows;
  } catch (error) {
    console.error("Error loading clubs due for a transfer update:", error);
    return [];
  }
}

export async function markTeamTransfersUpdated(teamID) {
  const normalizedTeamID = Number(teamID);
  if (!Number.isFinite(normalizedTeamID)) {
    return;
  }

  await pool.execute("UPDATE Team SET transfer_updated = NOW() WHERE ID = ?", [normalizedTeamID]);
}

