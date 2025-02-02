import mysql from 'mysql2/promise'; // Use import syntax

// Example database connection and JSON loading code:
import fs from 'fs/promises'; // For reading the JSON file
import { miniPC, networkPath } from './config.js';
import { pathToFileURL } from 'url';
import { allLeagues } from "./../data/leagues.js"; // Import the leagues data

// Database connection settings
const dbConfig = {
  host: miniPC,
  user: 'football_user',
  password: 'password',
  database: 'football_db',
  port: 3306, // Change to your MySQL port
};

async function loadPlayers() {
  try {
    // Create a database connection
    const connection = await mysql.createConnection(dbConfig);

    // Read the players.json file
    const data = await fs.readFile(networkPath + 'players.json', 'utf-8');
    const players = JSON.parse(data);

    // Insert players into the database
    for (const player of players) {
      const { id, name, club, nation } = player;
      await connection.execute(
        'INSERT IGNORE INTO Player (id, name, club, nation) VALUES (?, ?, ?, ?)',
        [id, name, club, nation]
      );
    }

    console.log('Players loaded successfully!');
    await connection.end(); // Close the connection
  } catch (error) {
    console.error('Error loading players:', error);
  }
}

async function loadClubs() {
  try {
    // Convert the network path to a file URL
    const fileURL = pathToFileURL(networkPath + 'clubs.js');

    // Dynamically import the clubs array from clubs.js
    const { clubs } = await import(fileURL.href);

    // Create a database connection
    const connection = await mysql.createConnection(dbConfig);

    // Insert clubs into the database
    for (const club of clubs) {
      const { id, name } = club;
      await connection.execute(
        'INSERT IGNORE INTO Team (ID, name) VALUES (?, ?)',
        [id, name]
      );
    }

    console.log('Clubs loaded successfully!');
    await connection.end(); // Close the connection
  } catch (error) {
    console.error('Error loading clubs:', error);
  }
}

async function insertLeagues() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const insertQuery = `INSERT INTO League (id, name, season, type) VALUES (?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE name=VALUES(name), season=VALUES(season), type=VALUES(type)`;

    for (const league of allLeagues) {
      await connection.execute(insertQuery, [league.id, league.name, league.season, league.type]);
      console.log(`Inserted/Updated: ${league.name}`);
    }
  } catch (error) {
    console.error("Error inserting leagues:", error);
  } finally {
    await connection.end();
  }
}

insertLeagues();

//loadPlayers();
//loadClubs();
