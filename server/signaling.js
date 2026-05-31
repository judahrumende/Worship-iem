const { WebSocketServer } = require('ws');
const { pool } = require('./db');
const cache = require('./redis');
const { hash: bcryptHash, verify: bcryptVerify } = require('./auth');
const { verify: jwtVerify } = require('./auth');
const { decode: jwtDecode } = require('./auth');

// Room map: code → { host, listeners: Map<id, ws>, passwordHash: string|null }
const rooms = new Map();

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, { host: null, listeners: new Map(), passwordHash: null, lastActivity: Date.now() });
  }
  return rooms.get(code);
}

function pruneRooms() {
  const now = Date.now();
  const STALE = 24 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > STALE && room.listeners.size === 0 && !room.host) {
      rooms.delete(code);
    }
  }
}
setInterval(pruneRooms, 60 * 60 * 1000);

function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(obj)); } catch (_) {}
  }
}

async function getPasswordHash(code) {
  // Check in-memory room first, then DB
  const room = rooms.get(code);
  if (room && room.passwordHash) return room.passwordHash;

  try {
    const { rows } = await pool.query('SELECT password_hash FROM rooms WHERE code=$1', [code]);
    if (rows[0]) {
      if (room) room.passwordHash = rows[0].password_hash;
      return rows[0].password_hash;
    }
  } catch (err) {
    console.error('[signaling] db lookup failed', err.message);
  }
  return null;
}

function attach(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let registered = false;
    let myRoom = null;
    let myRole = null;
    let myId = null;

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (_) { return; }
      const { type, payload } = msg;

      // ---- registration ----
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
          if (r.host && r.host !== ws && r.host.readyState === 1) {
            try { r.host.close(); } catch (_) {}
          }
          r.host = ws;
          // Host sets the room password on register (hashed in DB already, store ref)
          if (msg.passwordHash) r.passwordHash = msg.passwordHash;
        } else {
          r.listeners.set(myId, ws);
          // Send cached state to new listener
          const cached = await cache.get(`state:${myRoom}`);
          if (cached) send(ws, { type: 'state', payload: cached });
        }

        send(ws, { type: 'registered', id: myId });
        return;
      }

      if (!registered) return;

      const room = rooms.get(myRoom);
      if (!room) return;
      room.lastActivity = Date.now();

      // ---- timesync ----
      if (type === 'timesync') {
        const t1 = payload && payload.t1;
        const now = Date.now();
        send(ws, { type: 'timesync', t1, t2: now, t3: Date.now() });
        return;
      }

      // ---- HOST messages ----
      if (myRole === 'host') {
        if (type === 'state') {
          await cache.set(`state:${myRoom}`, payload);
          room.listeners.forEach(lws => send(lws, { type, payload }));
          return;
        }

        // Level — route only to talkTargets (or all if targets empty)
        if (type === 'level') {
          const targets = payload && payload.targets;
          if (targets && targets.length > 0) {
            targets.forEach(id => {
              const lws = room.listeners.get(id);
              if (lws) send(lws, { type, payload });
            });
          } else {
            room.listeners.forEach(lws => send(lws, { type, payload }));
          }
          return;
        }

        // Host → specific listener (payload.to = listenerId)
        if (type === 'granted' || type === 'denied' || type === 'rtc-offer' || type === 'rtc-ice') {
          const toId = payload && payload.to;
          if (toId) {
            const lws = room.listeners.get(toId);
            if (lws) send(lws, { type, payload });
          }
          return;
        }
      }

      // ---- LISTENER messages ----
      if (myRole === 'listener') {
        // hello — validate password server-side before relaying
        if (type === 'hello') {
          const { password, ...rest } = payload || {};
          const storedHash = await getPasswordHash(myRoom);

          if (storedHash) {
            const ok = password ? await bcryptVerify(password, storedHash) : false;
            if (!ok) {
              send(ws, { type: 'denied', payload: { id: myId } });
              return;
            }
            // Password correct — send granted and notify host (without password)
            send(ws, { type: 'granted', payload: { id: myId } });
            if (room.host) {
              send(room.host, { type: 'hello', payload: { ...rest, id: myId } });
            }
          } else {
            // No DB record for this room (host-only / legacy) — relay to host to decide
            if (room.host) {
              send(room.host, { type: 'hello', payload: { ...(payload || {}), id: myId } });
            }
          }
          return;
        }

        if (type === 'ping' || type === 'bye' || type === 'talkreq' || type === 'rtc-answer' || type === 'rtc-ice') {
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
        if (room.host) send(room.host, { type: 'bye', payload: { id: myId } });
      }
    });

    ws.on('error', () => {});
  });
}

module.exports = { attach };
