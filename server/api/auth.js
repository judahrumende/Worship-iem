const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { hash, verify, sign } = require('../auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });
  if (password.length < 8) return res.status(400).json({ error: 'password min 8 chars' });

  try {
    const passwordHash = await hash(password);
    const { rows } = await pool.query(
      'INSERT INTO accounts(email,password,name) VALUES($1,$2,$3) RETURNING id,email,name',
      [email.toLowerCase().trim(), passwordHash, name.trim()]
    );
    const account = rows[0];
    res.json({ token: sign({ id: account.id, email: account.email, name: account.name }) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error('[auth] register error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const { rows } = await pool.query('SELECT * FROM accounts WHERE email=$1', [email.toLowerCase().trim()]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid credentials' });

    const account = rows[0];
    const ok = await verify(password, account.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: sign({ id: account.id, email: account.email, name: account.name }) });
  } catch (err) {
    console.error('[auth] login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
