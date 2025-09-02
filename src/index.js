// Import environment variables from .env
require('dotenv').config();

// Import required libraries
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// Import internal modules
const { pool } = require('./lib/db');
const { fga, ensureFGAStoreAndModel } = require('./lib/fga');
const authMiddleware = require('./middleware/auth');

// Import routers
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const postsRouter = require('./routes/posts');

// Create express app
const app = express();

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => res.json({ ok: true }));

// Attach routers
app.use('/auth', authRouter);
app.use('/users', authMiddleware.optionalAuth, usersRouter);
app.use('/posts', authMiddleware.requiredAuth, postsRouter);

// Swagger docs
const swaggerPath = path.join(__dirname, 'swagger.yaml');
const swaggerDoc = yaml.parse(fs.readFileSync(swaggerPath, 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Start server only after ensuring DB and FGA are ready
const PORT = process.env.PORT || 5000;

// Ensure DB schema (idempotent using IF NOT EXISTS in init.sql)
async function ensureDatabaseSchema() {
  const sqlPath = path.join(__dirname, '..', 'sql', 'init.sql');
  const initSql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(initSql);
  console.log('Database schema ensured.');
}

(async () => {
  try {
    // Test DB connection
    await pool.query('SELECT 1');

    // Ensure DB schema exists
    await ensureDatabaseSchema();

    // Ensure OpenFGA store and model are set
    await ensureFGAStoreAndModel();

    // Start listening
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
})();
