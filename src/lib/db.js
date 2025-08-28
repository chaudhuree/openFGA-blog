// Load env
require('dotenv').config();

// Import pg Pool
const { Pool } = require('pg');

// Create pool using env vars
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  database: process.env.PGDATABASE || 'blogdb',
  user: process.env.PGUSER || 'bloguser',
  password: process.env.PGPASSWORD || 'blogpass',
});

// Export the pool
module.exports = { pool };
