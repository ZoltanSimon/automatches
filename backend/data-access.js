import mysql from "mysql2/promise";
import { miniPC } from "./config.js";
import fs from "fs";

export let players = [];
export let teams = [];
export let allLeagues = [];

// Database connection details
const dbConfig = {
  host: miniPC,
  user: "football_user",
  password: "password",
  database: "football_db",
};

const leagueCache = new Map();
const CACHE_TTL = 60 * 10000; // 1 minute

export async function loadPlayers() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query("SELECT * FROM Player");
    players = rows;
    console.log("Players loaded from the database:", players);
  } catch (error) {
    console.error("Error loading players from the database:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function loadTeams() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query("SELECT * FROM Team");
    teams = rows;
    console.log("Team loaded from the database:", teams);
  } catch (error) {
    console.error("Error loading teams from the database:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function loadLeagues() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query("SELECT * FROM League");
    allLeagues = rows;
    //remove leagues which are not visible
    allLeagues = allLeagues.filter(lg => lg.Visible);
    console.log("League loaded from the database:", teams);
  } catch (error) {
    console.error("Error loading leagues from the database:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

(async () => {
  await loadPlayers();
  await loadTeams();
  await loadLeagues();
})();

export async function insertPlayersToDb(allPlayers) {
  try {
    // Create a database connection
    const connection = await mysql.createConnection(dbConfig);

    // Insert or update players
    for (const player of allPlayers) {
      const { id, name, club, nation, position } = player;
      await connection.execute(
        `INSERT INTO Player (id, name, club, nation, position)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          club = IF(VALUES(club) <> 0 AND club <> VALUES(club), VALUES(club), club),
          nation = IF(VALUES(nation) <> 0 AND nation <> VALUES(nation), VALUES(nation), nation),
          position = VALUES(position);`,
        [id, name, club, nation, position[0] || ""]
      );
    }

    await connection.end(); // Close the connection
    console.log({ message: "Players loaded successfully!" });
  } catch (error) {
    console.error({ error: "Error loading players.", details: error.message });
  }
}

export async function insertMatchesToQueue(matches) {
  const connection = await mysql.createConnection(dbConfig);

  for (const match of matches) {
    let matchID = match.id;
    let leagueID = match.league.id;
    let matchDate = match.fixture.date;
    await connection.query(
      `INSERT IGNORE INTO match_queue (match_id, league_id, match_date) VALUES (?, ?, ?)`,
      [matchID, leagueID, matchDate]
    );
  }
  await connection.end();
}

export async function removeMatchesFromQueue(matchIDs) {
  if (matchIDs.length === 0) return;

  const placeholders = matchIDs.map(() => "?").join(",");
  await db.query(
    `DELETE FROM match_queue WHERE match_id IN (${placeholders})`,
    matchIDs
  );
}

export async function importLeague(leagueID) {
  const connection = await mysql.createConnection(dbConfig);
  const filePath = `\\\\ZOLIMINIPC\\data2\\leagues\\${leagueID}.json`;

  const raw = fs.readFileSync(filePath);
  const json = JSON.parse(raw);

  const matches = Array.isArray(json.response) ? json.response : json;

  if (!Array.isArray(matches) || matches.length === 0) {
    console.log("❌ No matches found in file");
    return;
  }

  const season = matches[0].league.season;
  const tableName = `league-${leagueID}-${season}`;

  // Create table if it doesn’t exist
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      id INT PRIMARY KEY,
      round VARCHAR(100),
      home_team_id INT NOT NULL,
      away_team_id INT NOT NULL,
      match_date DATETIME NOT NULL,
      status VARCHAR(20) NOT NULL,
      home_score INT,
      away_score INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Insert matches

  for (const match of matches) {
    await connection.query(
      `REPLACE INTO \`${tableName}\`
    (id, round, home_team_id, away_team_id, match_date, status, home_score, away_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match.fixture.id,
        match.league.round,
        match.teams.home.id,
        match.teams.away.id,
        match.fixture.date.replace("T", " ").slice(0, 19),
        match.fixture.status.short,
        match.goals.home,
        match.goals.away,
      ]
    );
  }

  console.log(`✅ Imported ${matches.length} matches into ${tableName}`);

  await connection.end();
}

export async function getLeagueFromDb(leagueID) {
  const connection = await mysql.createConnection(dbConfig);
  const season =
    allLeagues.find((lg) => lg.id == leagueID)?.season ||
    new Date().getFullYear();
  const tableName = `league-${leagueID}-${season}`;
  const cacheKey = `${leagueID}-${season}`;
  const now = Date.now();

  if (leagueCache.has(cacheKey)) {
    console.log("Using cached league data for", cacheKey);
    const { data, timestamp } = leagueCache.get(cacheKey);
    if (now - timestamp < CACHE_TTL) {
      return data;
    }
  }

  try {
    const [rows] = await connection.query(
      `SELECT id AS fixtureId, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM \`${tableName}\`
       ORDER BY match_date ASC`
    );
    await connection.end();
    let leaguematches =  rows.map((r) => ({
      fixture: {
        id: r.fixtureId,
        date: r.match_date,
        status: { short: r.status },
      },
      league: {
        id: leagueID,
        season: season,
        round: r.round,
      },
      teams: {
        home: {
          id: r.home_team_id,
          name: teams.find((t) => t.ID === r.home_team_id)?.name || "Unknown",
        },
        away: {
          id: r.away_team_id,
          name: teams.find((t) => t.ID === r.away_team_id)?.name || "Unknown",
        },
      },
      goals: {
        home: r.home_score,
        away: r.away_score,
      },
    }));

    leagueCache.set(cacheKey, { data: leaguematches, timestamp: now });
    return leaguematches;
  } catch (e) {
    console.error(`❌ Failed to load league ${leagueID} ${season} from DB:`, e);
    return [];
  }
}
