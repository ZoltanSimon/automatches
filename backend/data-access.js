import pool, { networkPath } from "./config.js";
import fs from "fs";
import { allDBLeagues, allDBTeams, allDBPlayers } from "./index.js";

const leagueCache = new Map();
const CACHE_TTL = 60 * 10000;
let leagueSeasonTableConfigPromise = null;

function normalizeSeasonValue(season) {
  if (season === null || season === undefined || season === "") {
    return null;
  }

  const parsedSeason = Number(season);
  return Number.isNaN(parsedSeason) ? null : parsedSeason;
}

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

async function loadLeagueSeasonRows() {
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

function getLeagueSeasonsFromMetadata(leagueID) {
  const league = allDBLeagues?.find((item) => Number(item.id) === Number(leagueID));

  if (Array.isArray(league?.seasons) && league.seasons.length > 0) {
    return league.seasons.map((season) => Number(season)).filter((season) => !Number.isNaN(season));
  }

  const fallbackSeason = normalizeSeasonValue(league?.season);
  return fallbackSeason === null ? [] : [fallbackSeason];
}

export function getLeagueSeasons(leagueID) {
  return getLeagueSeasonsFromMetadata(leagueID);
}

export function getLeagueSeason(leagueID, requestedSeason = null) {
  const normalizedRequestedSeason = normalizeSeasonValue(requestedSeason);
  const availableSeasons = getLeagueSeasonsFromMetadata(leagueID);

  if (
    normalizedRequestedSeason !== null &&
    availableSeasons.includes(normalizedRequestedSeason)
  ) {
    return normalizedRequestedSeason;
  }

  if (availableSeasons.length > 0) {
    return availableSeasons[0];
  }

  return normalizeSeasonValue(requestedSeason) ?? new Date().getFullYear();
}

function normalizeLeagueConfig(input) {
  if (typeof input === "object" && input !== null) {
    const leagueID = Number(input.leagueID ?? input.id);
    return {
      leagueID,
      season: getLeagueSeason(leagueID, input.season),
    };
  }

  const leagueID = Number(input);
  return {
    leagueID,
    season: getLeagueSeason(leagueID),
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

export async function insertPlayersToDb(allPlayers) {
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

      await pool.execute(
        `INSERT INTO Player (id, name, club, nation, position)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
          club = IF(VALUES(club) <> 0 AND club <> VALUES(club), VALUES(club), club),
          nation = IF(VALUES(nation) <> 0 AND nation <> VALUES(nation), VALUES(nation), nation),
          position = VALUES(position);`,
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

export async function importLeague(fileName) {
  const filePath = `${networkPath}leagues\\${fileName}`;

  const raw = fs.readFileSync(filePath);
  const json = JSON.parse(raw);

  const matches = Array.isArray(json.response) ? json.response : json;

  if (!Array.isArray(matches) || matches.length === 0) {
    console.log("❌ No matches found in file");
    return;
  }

  const leagueID = matches[0].league.id;
  const season = matches[0].league.season;

  // Create single table if it doesn't exist
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

  console.log(
    `✅ Table 'matches' ensured for league ${leagueID} season ${season}`,
  );
  // Insert matches
  for (const match of matches) {
    await pool.query(
      `REPLACE INTO matches
    (id, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match.fixture.id,
        leagueID,
        season,
        match.league.round,
        match.teams.home.id,
        match.teams.away.id,
        match.fixture.date.replace("T", " ").slice(0, 19),
        match.fixture.status.short,
        match.goals.home,
        match.goals.away,
      ],
    );
  }

  console.log(
    `✅ Imported ${matches.length} matches for league ${leagueID} season ${season}`,
  );

  // Update cache after import
  const cacheKey = `${leagueID}-${season}`;
  const now = Date.now();

  // Fetch the updated data from database and transform it
  const [rows] = await pool.query(
    `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
     FROM matches
     WHERE league_id = ? AND season = ?
     ORDER BY match_date ASC`,
    [leagueID, season],
  );

  let leaguematches = rows.map((r) => ({
    fixture: {
      id: r.fixtureId,
      date: r.match_date,
      status: { short: r.status },
    },
    league: {
      id: r.league_id,
      season: r.season,
      round: r.round,
    },
    teams: {
      home: {
        id: r.home_team_id,
        name:
          allDBTeams.find((t) => t.ID === r.home_team_id)?.name || "Unknown",
      },
      away: {
        id: r.away_team_id,
        name:
          allDBTeams.find((t) => t.ID === r.away_team_id)?.name || "Unknown",
      },
    },
    goals: {
      home: r.home_score,
      away: r.away_score,
    },
  }));

  leagueCache.set(cacheKey, { data: leaguematches, timestamp: now });
  console.log(`✅ Cache updated for ${cacheKey}`);
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
        date: r.match_date,
        status: { short: r.status },
      },
      league: {
        id: r.league_id,
        season: r.season,
        round: r.round,
      },
      teams: {
        home: {
          id: r.home_team_id,
          name:
            allDBTeams.find((t) => t.ID === r.home_team_id)?.name || "Unknown",
        },
        away: {
          id: r.away_team_id,
          name:
            allDBTeams.find((t) => t.ID === r.away_team_id)?.name || "Unknown",
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
    return rows.map((r) => ({
      fixtureId: r.fixtureId,
      fixtureDate: r.match_date,
      fixtureStatus: r.status,
      leagueId: r.league_id,
      leagueSeason: r.season,
      leagueRound: r.round,
      homeTeamId: r.home_team_id,
      homeTeamName:
        allDBTeams.find((t) => t.ID === r.home_team_id)?.name || "Unknown",
      awayTeamId: r.away_team_id,
      awayTeamName:
        allDBTeams.find((t) => t.ID === r.away_team_id)?.name || "Unknown",
      homeGoals: r.home_score,
      awayGoals: r.away_score,
    }));
  } catch (e) {
    console.error(`❌ Failed to load all matches from DB:`, e);
    return [];
  }
}
