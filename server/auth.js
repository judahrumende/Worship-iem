const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = '30d';

const hash = (password) => bcrypt.hash(password, SALT_ROUNDS);
const verify = (password, hash) => bcrypt.compare(password, hash);

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function decode(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch (_) { return null; }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? decode(token) : null;
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.account = payload;
  next();
}

module.exports = { hash, verify, sign, decode, requireAuth };
