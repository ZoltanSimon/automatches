import mysql from 'mysql2/promise'; // Use import syntax

// Example database connection and JSON loading code:
import fs from 'fs/promises'; // For reading the JSON file
import { miniPC, networkPath } from './config.js';

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

loadPlayers();
