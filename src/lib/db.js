// Load env
require('dotenv').config();

// Import pg Pool
const { Pool } = require('pg');

// Create pool using env vars
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
});

// Export the pool
module.exports = { pool };
