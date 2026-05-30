/* =============================================================
   WorshipIEM — Production server
   HTTP static file server + WebSocket signalling
   ============================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(__dirname, 'worshipiem');

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

// ---- MIME types ----
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

// ---- HTTP server ----
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // API: ICE config
  if (url.pathname === '/api/ice-config') {
    const body = JSON.stringify(getIceConfig());
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
    return;
  }

  // Static files
  let filePath = path.join(STATIC_DIR, url.pathname === '/' ? '/index.html' : url.pathname);
  // Normalise to prevent directory traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const ext = path.extname(filePath).toLowerCase();
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback — serve index.html for unknown routes
      filePath = path.join(STATIC_DIR, 'index.html');
      fs.readFile(filePath, (e2, data) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }
    fs.readFile(filePath, (e2, data) => {
      if (e2) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

// ---- WebSocket signalling ----
// Room map: Map<code, { host: WebSocket|null, listeners: Map<id, WebSocket>, lastState: object|null, lastActivity: number }>
const rooms = new Map();

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, { host: null, listeners: new Map(), lastState: null, lastActivity: Date.now() });
  }
  return rooms.get(code);
}

function pruneRooms() {
  const now = Date.now();
  const STALE = 24 * 60 * 60 * 1000; // 24 hours
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > STALE && room.listeners.size === 0 && !room.host) {
      rooms.delete(code);
    }
  }
}
setInterval(pruneRooms, 60 * 60 * 1000); // check hourly

function send(ws, obj) {
  if (ws && ws.readyState === 1 /* OPEN */) {
    try { ws.send(JSON.stringify(obj)); } catch (_) {}
  }
}

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let registered = false;
  let myRoom = null;
  let myRole = null;
  let myId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }
    const { type, payload } = msg;

    // ---- registration (first message) ----
    if (type === 'register') {
      const { room, role, id } = msg;
      if (!room || !role || !id) return;
      myRoom = room.toUpperCase().slice(0, 6);
      myRole = role;
      myId = id;
      registered = true;

      const r = getRoom(myRoom);
      r.lastActivity = Date.now();

      if (role === 'host') {
        // Close previous host connection if any
        if (r.host && r.host !== ws && r.host.readyState === 1) {
          try { r.host.close(); } catch (_) {}
        }
        r.host = ws;
      } else {
        r.listeners.set(myId, ws);
        // Send cached state to new listener
        if (r.lastState) {
          send(ws, { type: 'state', payload: r.lastState });
        }
      }

      send(ws, { type: 'registered', id: myId });
      return;
    }

    if (!registered) return;

    const room = rooms.get(myRoom);
    if (!room) return;
    room.lastActivity = Date.now();

    // ---- time sync ----
    if (type === 'timesync') {
      const t1 = payload && payload.t1;
      const now = Date.now();
      send(ws, { type: 'timesync', t1, t2: now, t3: Date.now() });
      return;
    }

    if (myRole === 'host') {
      // ---- host → all listeners ----
      if (type === 'state') {
        room.lastState = payload;
        room.listeners.forEach(lws => send(lws, { type, payload }));
        return;
      }
      if (type === 'level') {
        room.listeners.forEach(lws => send(lws, { type, payload }));
        return;
      }
      // ---- host → specific listener (payload.to = listenerId) ----
      if (type === 'granted' || type === 'denied' || type === 'rtc-offer' || type === 'rtc-ice') {
        const toId = payload && payload.to;
        if (toId) {
          const lws = room.listeners.get(toId);
          if (lws) send(lws, { type, payload });
        }
        return;
      }
    }

    if (myRole === 'listener') {
      // ---- listener → host (enrich with listener id) ----
      if (type === 'hello' || type === 'ping' || type === 'bye' || type === 'talkreq' || type === 'rtc-answer' || type === 'rtc-ice') {
        if (room.host) {
          send(room.host, { type, payload: { ...(payload || {}), id: myId } });
        }
        return;
      }
    }
  });

  ws.on('close', () => {
    if (!registered || !myRoom) return;
    const room = rooms.get(myRoom);
    if (!room) return;
    room.lastActivity = Date.now();

    if (myRole === 'host') {
      room.host = null;
    } else {
      room.listeners.delete(myId);
      // Notify host that this listener left
      if (room.host) {
        send(room.host, { type: 'bye', payload: { id: myId } });
      }
    }
  });

  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`WorshipIEM server running on http://localhost:${PORT}`);
});
