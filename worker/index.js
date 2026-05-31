/* WorshipIEM — Cloudflare Worker + Durable Object signaling relay
   Each room gets its own DO instance that holds all WebSocket connections
   for that room and relays messages between them. */

export class Room {
  constructor(state) {
    this.sessions = new Map(); // socketId -> { ws, id, role }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket required', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const socketId = crypto.randomUUID();
    this.sessions.set(socketId, { ws: server, id: null, role: null });

    server.addEventListener('message', ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === 'register') {
        const s = this.sessions.get(socketId);
        if (s) { s.id = msg.id; s.role = msg.role; }
        server.send(JSON.stringify({ type: 'registered', id: msg.id }));
        return;
      }

      if (msg.type === 'timesync') {
        const t2 = Date.now();
        server.send(JSON.stringify({ type: 'timesync', t1: msg.payload?.t1, t2, t3: Date.now() }));
        return;
      }

      // Relay to all other sessions in this room
      const out = JSON.stringify(msg);
      for (const [id, s] of this.sessions) {
        if (id === socketId) continue;
        try { s.ws.send(out); } catch { this.sessions.delete(id); }
      }
    });

    server.addEventListener('close', () => this.sessions.delete(socketId));
    server.addEventListener('error', () => this.sessions.delete(socketId));

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const room = url.searchParams.get('room') || 'default';
      const id = env.ROOMS.idFromName(room);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    return new Response('WorshipIEM signaling', { headers: { 'Access-Control-Allow-Origin': '*' } });
  },
};
