import mysql from "mysql2/promise";
import { miniPC } from "./config.js";

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

  export async function insertPlayers(allPlayers) {
    try {
      // Create a database connection
      const connection = await mysql.createConnection(dbConfig);
  
      // Insert or update players
      for (const player of allPlayers) {
        const { id, name, club, nation } = player;
        await connection.execute(
          `INSERT INTO Player (id, name, club, nation) 
           VALUES (?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
           club = IF(club <> VALUES(club), VALUES(club), club), 
           nation = IF(VALUES(nation) <> 0 AND nation <> VALUES(nation), VALUES(nation), nation)`,
          [id, name, club, nation]
        );
      }
  
      await connection.end(); // Close the connection
      console.log({ message: 'Players loaded successfully!' });
    } catch (error) {
      console.error({ error: 'Error loading players.', details: error.message });
    }
  }
  