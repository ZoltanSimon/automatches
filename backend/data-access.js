import pool, { networkPath } from "./config.js";
import fs from "fs";

export let allDBPlayers = [];
export let allDBTeams = [];
export let allDBLeagues = [];

const leagueCache = new Map();
const CACHE_TTL = 60 * 10000;

export async function loadPlayers() {
  try {
    const [rows] = await pool.query("SELECT * FROM Player");
    allDBPlayers = rows;
    //console.log("Players loaded from the database:", allDBPlayers);
  } catch (error) {
    console.error("Error loading players from the database:", error);
    throw error;
  }
}

export async function loadTeams() {
  try {
    const [rows] = await pool.query("SELECT * FROM Team");
    allDBTeams = rows;
    //console.log("Team loaded from the database:", allTteams);
  } catch (error) {
    console.error("Error loading teams from the database:", error);
    throw error;
  }
}

export async function loadLeagues() {
  try {
    const [rows] = await pool.query("SELECT * FROM League");
    allDBLeagues = rows;
    //remove leagues which are not visible
    allDBLeagues = allDBLeagues.filter((lg) => lg.Visible);
    //console.log("League loaded from the database:", teams);
  } catch (error) {
    console.error("Error loading leagues from the database:", error);
    throw error;
  }
}

(async () => {
  await loadPlayers();
  await loadTeams();
  await loadLeagues();
})();

export async function insertPlayersToDb(allPlayers) {
  try {
    // Insert or update players
    for (const player of allPlayers) {
      const { id, name, club, nation, position } = player;
      await pool.execute(
        `INSERT INTO Player (id, name, club, nation, position)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          club = IF(VALUES(club) <> 0 AND club <> VALUES(club), VALUES(club), club),
          nation = IF(VALUES(nation) <> 0 AND nation <> VALUES(nation), VALUES(nation), nation),
          position = VALUES(position);`,
        [id, name, club, nation, position[0] || ""]
      );
    }

    console.log({ message: "Players loaded successfully!" });
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
        [ID, name]
      );
    }
    console.log({ message: "Teams loaded successfully!" });
  } catch (error) {
    console.error({ error: "Error loading teams.", details: error.message });
  }
}

export async function insertMatchesToQueue(matches) {
  for (const match of matches) {
    let matchID = match.id;
    let leagueID = match.league.id;
    let matchDate = match.fixture.date;
    await pool.query(
      `INSERT IGNORE INTO match_queue (match_id, league_id, match_date) VALUES (?, ?, ?)`,
      [matchID, leagueID, matchDate]
    );
  }
}

export async function removeMatchesFromQueue(matchIDs) {
  if (matchIDs.length === 0) return;

  const placeholders = matchIDs.map(() => "?").join(",");
  await pool.query(
    `DELETE FROM match_queue WHERE match_id IN (${placeholders})`,
    matchIDs
  );
}

export async function importLeague(leagueID) {
  const filePath = `${networkPath}leagues\\${leagueID}.json`;

  const raw = fs.readFileSync(filePath);
  const json = JSON.parse(raw);

  const matches = Array.isArray(json.response) ? json.response : json;

  if (!Array.isArray(matches) || matches.length === 0) {
    console.log("❌ No matches found in file");
    return;
  }

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
      ]
    );
  }

  console.log(`✅ Imported ${matches.length} matches for league ${leagueID} season ${season}`);

  // Update cache after import
  const cacheKey = `${leagueID}-${season}`;
  const now = Date.now();
  
  // Fetch the updated data from database and transform it
  const [rows] = await pool.query(
    `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
     FROM matches
     WHERE league_id = ? AND season = ?
     ORDER BY match_date ASC`,
    [leagueID, season]
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
        name: allDBTeams.find((t) => t.ID === r.home_team_id)?.name || "Unknown",
      },
      away: {
        id: r.away_team_id,
        name: allDBTeams.find((t) => t.ID === r.away_team_id)?.name || "Unknown",
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

export async function getLeagueFromDb(leagueID) {
  const season =
    allDBLeagues.find((lg) => lg.id == leagueID)?.season ||
    new Date().getFullYear();
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
    const [rows] = await pool.query(
      `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM matches
       WHERE league_id = ? AND season = ?
       ORDER BY match_date ASC`,
      [leagueID, season]
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
          name: allDBTeams.find((t) => t.ID === r.home_team_id)?.name || "Unknown",
        },
        away: {
          id: r.away_team_id,
          name: allDBTeams.find((t) => t.ID === r.away_team_id)?.name || "Unknown",
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

export async function getAllTeamMatchesFromDb(teams) {
  try {
    const [rows] = await pool.query(
      `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM matches
       WHERE home_team_id IN (?) 
          OR away_team_id IN (?)
       ORDER BY match_date ASC`,
      [teams, teams] 
    );

    return rows;
  } catch (err) {
    console.error(err);
    throw err;
  }
}


export async function getMatchById(fixtureId) {
  const cacheKey = `match-${fixtureId}`;
  const now = Date.now();

  // Check cache first
  if (leagueCache.has(cacheKey)) {
    console.log("Using cached match data for", cacheKey);
    const { data, timestamp } = leagueCache.get(cacheKey);
    if (now - timestamp < CACHE_TTL) {
      return data;
    }
  }

  try {
    const [rows] = await pool.query(
      `SELECT id AS fixtureId, league_id, season, round, home_team_id, away_team_id, match_date, status, home_score, away_score
       FROM matches
       WHERE id = ?`,
      [fixtureId]
    );

    if (rows.length === 0) {
      console.log(`❌ Match ${fixtureId} not found`);
      return null;
    }
    console.log(rows);
    const r = rows[0];
    const match = {
          fixtureId: r.fixtureId,
          fixtureDate: r.match_date,
          fixtureStatus: r.status,
          leagueId: r.league_id,
          leagueSeason: r.season,
          leagueRound: r.round,
          homeTeamId: r.home_team_id,
          homeTeamName: allDBTeams.find((t) => t.ID === r.home_team_id)?.name || "Unknown",
          awayTeamId: r.away_team_id,
          awayTeamName: allDBTeams.find((t) => t.ID === r.away_team_id)?.name || "Unknown",
          homeGoals: r.home_score,
          awayGoals: r.away_score,
      };

    // Cache the match
    leagueCache.set(cacheKey, { data: match, timestamp: now });
    return match;
  } catch (e) {
    console.error(`❌ Failed to load match ${fixtureId} from DB:`, e);
    return null;
  }
}