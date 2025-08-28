const express = require('express');
const router = express.Router();
const { pool } = require('../lib/db');
const { fga, userObj, postObj } = require('../lib/fga');

async function can(userId, relation, postId) {
  const resp = await fga.check({ user: userObj(userId), relation, object: postObj(postId) });
  return resp.allowed === 'ALLOW';
}

async function hasOrgRole(userId, relation) {
  const resp = await fga.check({ user: userObj(userId), relation, object: 'org:blog' });
  return resp.allowed === 'ALLOW';
}

// Create post (editor/moderator/admin). Default draft. Owner is creator.
router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content required' });

    // Only editor, moderator, or admin can create
    const userId = req.user.id;
    const canCreate = await hasOrgRole(userId, 'admin') || await hasOrgRole(userId, 'editor') || await hasOrgRole(userId, 'moderator');
    if (!canCreate) return res.status(403).json({ error: 'forbidden' });

    const ownerId = req.user.id;
    const rs = await pool.query(
      `INSERT INTO posts (title, content, owner_id, status)
       VALUES ($1, $2, $3, 'draft') RETURNING *`,
      [title, content, ownerId]
    );
    const post = rs.rows[0];

    // Write owner tuple in FGA
    await fga.write({ writes:  [ { user: userObj(ownerId), relation: 'owner', object: postObj(post.id) } ] } );

    res.status(201).json(post);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'create_failed' });
  }
});

// List posts
router.get('/', async (req, res) => {
  // Viewers can only see published; others can see their own and published
  const rs = await pool.query(
    `SELECT p.*, u.email AS owner_email FROM posts p
     JOIN users u ON u.id = p.owner_id
     WHERE p.status = 'published' OR p.owner_id = $1
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json(rs.rows);
});

// Get post by id (published or own)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const rs = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
  if (rs.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  const post = rs.rows[0];
  if (post.status !== 'published' && post.owner_id !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  res.json(post);
});

// Edit post
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    if (!await can(req.user.id, 'can_edit', id)) return res.status(403).json({ error: 'forbidden' });
    const rs = await pool.query(
      `UPDATE posts SET title = COALESCE($2,title), content = COALESCE($3,content), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, title, content]
    );
    res.json(rs.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'edit_failed' });
  }
});

// Delete post
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isOwner = await can(req.user.id, 'owner', id).catch(() => false);
    const isAdmin = await hasOrgRole(req.user.id, 'admin');
    const isModerator = await hasOrgRole(req.user.id, 'moderator');
    if (!(isOwner || isAdmin || isModerator)) return res.status(403).json({ error: 'forbidden' });
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'delete_failed' });
  }
});

// Publish post (moderator or admin)
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = await hasOrgRole(req.user.id, 'admin') || await hasOrgRole(req.user.id, 'moderator');
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    const rs = await pool.query("UPDATE posts SET status = 'published', updated_at = NOW() WHERE id = $1 RETURNING *", [id]);
    res.json(rs.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'publish_failed' });
  }
});

// Transfer ownership (editor can transfer own post to another editor)
router.post('/:id/transfer-owner', async (req, res) => {
  try {
    const { id } = req.params;
    const { newOwnerUserId } = req.body;
    if (!newOwnerUserId) return res.status(400).json({ error: 'newOwnerUserId required' });

    // Only current owner or admin can transfer ownership
    const isOwner = await can(req.user.id, 'owner', id).catch(() => false); // owner is a direct relation
    const isAdmin = await hasOrgRole(req.user.id, 'admin');
    if (!(isOwner || isAdmin)) return res.status(403).json({ error: 'forbidden' });

    // New owner must be an editor
    const newIsEditor = await hasOrgRole(newOwnerUserId, 'editor');
    if (!newIsEditor) return res.status(400).json({ error: 'new_owner_must_be_editor' });

    // Update DB
    const rs = await pool.query('UPDATE posts SET owner_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *', [id, newOwnerUserId]);
    if (rs.rowCount === 0) return res.status(404).json({ error: 'not_found' });

    // Update FGA owner tuple
    await fga.write({
      deletes: { tuple_keys: [ { user: userObj(req.user.id), relation: 'owner', object: postObj(id) } ] },
      writes:  { tuple_keys: [ { user: userObj(newOwnerUserId), relation: 'owner', object: postObj(id) } ] }
    });

    res.json(rs.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'transfer_failed' });
  }
});

// Grant per-post edit to a moderator (admin only per requirement)
router.post('/:id/grant-edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { moderatorUserId } = req.body;
    if (!moderatorUserId) return res.status(400).json({ error: 'moderatorUserId required' });

    // Only admins can grant per-post edit
    const admin = await hasOrgRole(req.user.id, 'admin');
    if (!admin) return res.status(403).json({ error: 'forbidden' });

    // Target must be a moderator
    const isModerator = await hasOrgRole(moderatorUserId, 'moderator');
    if (!isModerator) return res.status(400).json({ error: 'target_not_moderator' });

    // Grant via granted_editor relation
    await fga.write({ writes: { tuple_keys: [ { user: userObj(moderatorUserId), relation: 'granted_editor', object: postObj(id) } ] } });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'grant_failed' });
  }
});

module.exports = router;
