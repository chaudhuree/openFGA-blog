const express = require('express');
const router = express.Router();
const { pool } = require('../lib/db');
const { fga } = require('../lib/fga');
const { generateToken } = require('../middleware/auth');

// Login with email, create if not exists, default role viewer
router.post('/login', async (req, res) => {
  try {
    console.log(req.body);
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    // Upsert user by email
    const result = await pool.query(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email`,
      [email]
    );
    const user = result.rows[0];
    console.log(user);

    // Ensure the user has at least viewer role in FGA
    await fga.write({
      writes:  [
          { user: `user:${user.id}`, relation: 'viewer', object: 'org:blog' }
        ]
      
    });

    // Issue token
    const token = generateToken(user);
    return res.json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'login_failed' });
  }
});

module.exports = router;
