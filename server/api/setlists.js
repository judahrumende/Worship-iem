const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requireAuth } = require('../auth');

// GET /api/setlists/:roomCode
router.get('/:roomCode', requireAuth, async (req, res) => {
  const code = req.params.roomCode.toUpperCase().slice(0, 6);
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.items, s.updated_at
     FROM setlists s JOIN rooms r ON s.room_id = r.id
     WHERE r.code=$1 AND r.owner_id=$2
     ORDER BY s.updated_at DESC`,
    [code, req.account.id]
  );
  res.json(rows);
});

// PUT /api/setlists/:roomCode  — upsert (one setlist per room for now)
router.put('/:roomCode', requireAuth, async (req, res) => {
  const code = req.params.roomCode.toUpperCase().slice(0, 6);
  const { title, items } = req.body || {};
  if (!title || !Array.isArray(items)) return res.status(400).json({ error: 'title and items required' });

  const { rows: roomRows } = await pool.query(
    'SELECT id FROM rooms WHERE code=$1 AND owner_id=$2',
    [code, req.account.id]
  );
  if (!roomRows[0]) return res.status(404).json({ error: 'Room not found' });

  const roomId = roomRows[0].id;
  const { rows } = await pool.query(
    `INSERT INTO setlists(room_id, title, items, updated_at)
     VALUES($1,$2,$3,NOW())
     ON CONFLICT (room_id) DO UPDATE
       SET title=EXCLUDED.title, items=EXCLUDED.items, updated_at=NOW()
     RETURNING id, title, items, updated_at`,
    [roomId, title, JSON.stringify(items)]
  );
  res.json(rows[0]);
});

module.exports = router;
