require('dotenv').config();

const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { migrate } = require('./db');
const signaling = require('./signaling');

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, '..', 'worshipiem');

// ---- ICE config ----
function getIceConfig() {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.TURN_URLS) {
    iceServers.push({
      urls: process.env.TURN_URLS.split(',').map(s => s.trim()),
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  }
  return { iceServers };
}

// ---- Express app ----
const app = express();
app.use(express.json());

// API routes
app.use('/api/auth', require('./api/auth'));
app.use('/api/rooms', require('./api/rooms'));
app.use('/api/setlists', require('./api/setlists'));
app.get('/api/ice-config', (req, res) => res.json(getIceConfig()));

// Static files
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.jsx':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

app.use((req, res, next) => {
  // Prevent directory traversal
  const urlPath = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.join(STATIC_DIR, urlPath);
  if (!filePath.startsWith(STATIC_DIR)) { res.status(403).end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return next(); // fall through to SPA handler
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  const indexPath = path.join(STATIC_DIR, 'index.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  fs.createReadStream(indexPath).pipe(res);
});

// ---- Boot ----
async function start() {
  if (process.env.DATABASE_URL) {
    await migrate();
  } else {
    console.warn('[db] DATABASE_URL not set — skipping migrations (rooms API unavailable)');
  }

  const server = http.createServer(app);
  signaling.attach(server);

  server.listen(PORT, () => {
    console.log(`WorshipIEM server on http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
