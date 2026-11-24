// Copy to backend/config.js (gitignored). All values come from environment
// variables so the same file works in Docker (see docker-compose.local.yml / .env).
import mysql from "mysql2/promise";

export const PORT = process.env.PORT || 3000;

// Folder holding the JSON data (matches/, leagues/, players/).
export const networkPath = process.env.DATA_PATH || "./data";

export const RAPID_API_HOST = process.env.RAPID_API_HOST || "v3.football.api-sports.io";
export const RAPID_API_KEY = process.env.RAPID_API_KEY || "";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "automatches",
  password: process.env.DB_PASSWORD || "automatches",
  database: process.env.DB_NAME || "automatches",
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 20,
  connectTimeout: 20000,
  charset: "utf8mb4",
});

export default pool;
