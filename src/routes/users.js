const express = require('express');
const router = express.Router();
const { pool } = require('../lib/db');
const { fga, userObj } = require('../lib/fga');

// Helper: check if caller is admin
async function isAdmin(userId) {
  const resp = await fga.check({ user: userObj(userId), relation: 'admin', object: 'org:blog' });
  return resp.allowed === 'ALLOW' || resp.allowed === true;
}

// List users (any logged-in user can list)
router.get('/', async (req, res) => {
  const hasAdmin = await isAdmin(req.user.id);
  if (!hasAdmin) return res.status(403).json({ error: 'forbidden' });
  const rs = await pool.query('SELECT id, email, created_at FROM users ORDER BY created_at DESC');
  res.json(rs.rows);
});

// Grant or revoke role (admin only)
router.post('/:userId/roles', async (req, res) => {
  const actorId = req.user?.id;
  const { userId } = req.params;
  const { role, action } = req.body; // role: admin|editor|moderator|viewer, action: grant|revoke

  if (!actorId) return res.status(401).json({ error: 'unauthorized' });
  if (!['admin','editor','moderator','viewer'].includes(role)) return res.status(400).json({ error: 'invalid_role' });
  if (!['grant','revoke'].includes(action)) return res.status(400).json({ error: 'invalid_action' });

  // Only admins can manage roles
  if (!(await isAdmin(actorId))) return res.status(403).json({ error: 'forbidden' });

  const tuple = { user: `user:${userId}`, relation: role, object: 'org:blog' };

  if (action === 'grant') {
    await fga.write({ writes: [tuple] });
  } else {
    await fga.write({ deletes: [tuple] });
  }

  res.json({ ok: true });
});

module.exports = router;
