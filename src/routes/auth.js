const express = require('express');
const router = express.Router();
const { pool } = require('../lib/db');
const { fga } = require('../lib/fga');
const { generateToken } = require('../middleware/auth');

// Login with email, create if not exists, default role viewer
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    // if user exists, return token and the user
    const isAvailable = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (isAvailable.rows.length > 0) {
    //  generate token and return it
    const token = generateToken(isAvailable.rows[0]);
    return res.json({ token, user: isAvailable.rows[0] });
    }

    // if user does not exist, create it then give it viewer role in FGA then generate token and return token and user
    const result = await pool.query(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email`,
      [email]
    );
    const user = result.rows[0];

    // Ensure the user has at least viewer role in FGA but for the first user, the role should be given admin
    const isFirstUser = await pool.query('SELECT COUNT(*) FROM users');
    const totalUsers = Number(isFirstUser.rows[0].count);
    if (totalUsers === 1) {
      await fga.write({
        writes:  [
            { user: `user:${user.id}`, relation: 'admin', object: 'org:blog' }
          ]
      });
    } else {
      await fga.write({
        writes:  [
            { user: `user:${user.id}`, relation: 'viewer', object: 'org:blog' }
          ]
      });
    }
    

    // Issue token
    const token = generateToken(user);
    return res.json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'login_failed' });
  }
});

module.exports = router;
