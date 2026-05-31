const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { hash } = require('../auth');
const { requireAuth } = require('../auth');

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/rooms/create
router.post('/create', requireAuth, async (req, res) => {
  const { password, name } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  const passwordHash = await hash(password);

  // Retry on code collision (astronomically rare)
  let code, attempt = 0;
  while (attempt++ < 10) {
    code = randomCode();
    try {
      await pool.query(
        'INSERT INTO rooms(code, owner_id, password_hash, name) VALUES($1,$2,$3,$4)',
        [code, req.account.id, passwordHash, (name || '').trim()]
      );
      break;
    } catch (err) {
      if (err.code === '23505') { code = null; continue; }
      console.error('[rooms] create error', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
  if (!code) return res.status(500).json({ error: 'Could not generate unique code' });

  res.json({ code });
});

// GET /api/rooms/:code/check  — verify room exists (no auth required)
router.get('/:code/check', async (req, res) => {
  const code = req.params.code.toUpperCase().slice(0, 6);
  const { rows } = await pool.query('SELECT code, name FROM rooms WHERE code=$1', [code]);
  if (!rows[0]) return res.status(404).json({ error: 'Room not found' });
  res.json({ code: rows[0].code, name: rows[0].name });
});

// GET /api/rooms  — list rooms owned by authed user
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT code, name, created_at FROM rooms WHERE owner_id=$1 ORDER BY created_at DESC',
    [req.account.id]
  );
  res.json(rows);
});

module.exports = router;
