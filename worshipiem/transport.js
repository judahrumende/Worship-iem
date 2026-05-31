/* =============================================================
   WorshipIEM — Transport (real-time sync layer)
   ----------------------------------------------------------------
   Production implementation: WebSocket to signalling server with
   NTP-style clock sync. Falls back to BroadcastChannel when no
   server is reachable (same-browser tab testing, static hosting).

   Interface (stable across implementations):
     new WITransport(room, role)
     .on(type, handler)        subscribe
     .send(type, payload)      publish
     .close()
     .id                       this client's server-assigned id
   ============================================================= */
(function () {
  // WI_SERVER_URL can be set in index.html to point to a separate backend host.
  // If unset, the transport connects to the same host that served the page.
  const WS_URL = window.WI_SERVER_URL || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);

  class WITransport {
    constructor(room, role) {
      this.room = room; this.role = role;
      this.handlers = {}; this._ws = null;
      this._id = null; this._queue = []; this._closed = false;
      this._syncTimer = null;
      this._failCount = 0;
      this._everConnected = false;

      // Use BroadcastChannel when running from file:// (local dev without server)
      if (location.protocol === 'file:') {
        this._fallback();
        return;
      }
      this._connect();
    }

    _connect() {
      if (this._closed) return;
      let ws;
      // Include room in URL so the Cloudflare Worker can route to the right
      // Durable Object before the first message; Node.js server ignores it.
      const wsUrl = WS_URL + (WS_URL.includes('?') ? '&' : '?') + 'room=' + encodeURIComponent(this.room);
      try { ws = new WebSocket(wsUrl); }
      catch (e) { this._fallback(); return; }
      this._ws = ws;
      const openedAt = Date.now();

      ws.onopen = () => {
        this._failCount = 0;
        this._everConnected = true;
        const myId = `${this.role}_${Math.random().toString(36).slice(2, 8)}`;
        ws.send(JSON.stringify({ type: 'register', room: this.room, role: this.role, id: myId }));
        this._doTimeSync();
        this._syncTimer = setInterval(() => this._doTimeSync(), 30000);
      };

      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch (_) { return; }
        const { type, payload } = msg;
        if (type === 'registered') {
          this._id = msg.id;
          const q = this._queue.splice(0);
          q.forEach(m => this._raw(m));
          return;
        }
        if (type === 'timesync') {
          const t4 = Date.now();
          const offset = Math.round(((msg.t2 - msg.t1) + (msg.t3 - t4)) / 2);
          window.WIClock && window.WIClock.setOffset(offset);
          return;
        }
        const list = this.handlers[type];
        if (list) list.forEach(h => h(payload));
      };

      ws.onclose = () => {
        clearInterval(this._syncTimer);
        if (this._closed) return;
        // If we never connected and failed quickly, it's a "no server" environment
        const quickFail = !this._everConnected && (Date.now() - openedAt < 1500);
        if (quickFail) {
          this._failCount++;
          if (this._failCount >= 3) { this._fallback(); return; }
          setTimeout(() => this._connect(), 800);
        } else {
          setTimeout(() => this._connect(), 2000);
        }
      };
      ws.onerror = () => {};
    }

    _fallback() {
      if (this._closed || this._id) return; // already set up
      console.warn('[WITransport] No server reachable — using BroadcastChannel (same-browser tabs only)');
      const ch = new BroadcastChannel('worshipiem:' + this.room);
      this._id = `${this.role}_${Math.random().toString(36).slice(2, 6)}`;
      ch.onmessage = (e) => {
        const { type, payload, from } = e.data || {};
        if (from === this.role && this.role === 'host') return;
        const list = this.handlers[type];
        if (list) list.forEach(h => h(payload));
      };
      // Drain queue
      const q = this._queue.splice(0);
      this._raw = (m) => ch.postMessage({ ...m, from: this.role });
      q.forEach(m => this._raw(m));
      this.close = () => { try { ch.close(); } catch (_) {} this._closed = true; };
      // Fire a synthetic 'registered' so listeners know their id
      const list = this.handlers['registered'];
      if (list) list.forEach(h => h({ id: this._id }));
    }

    _doTimeSync() {
      this._raw({ type: 'timesync', payload: { t1: Date.now() } });
    }

    _raw(msg) {
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        try { this._ws.send(JSON.stringify(msg)); } catch (_) {}
      }
    }

    on(type, handler) { (this.handlers[type] = this.handlers[type] || []).push(handler); return this; }
    send(type, payload) {
      const msg = { type, payload };
      if (this._id) this._raw(msg); else this._queue.push(msg);
    }
    close() {
      this._closed = true;
      clearInterval(this._syncTimer);
      if (this._ws) { try { this._ws.close(); } catch (_) {} this._ws = null; }
    }
    get id() { return this._id; }
  }

  /* localStorage snapshot so a late-joining listener (or a reload)
     can paint last-known state instantly before the host re-broadcasts. */
  const KEY = (room) => 'worshipiem:snap:' + room;
  window.WISnap = {
    save(room, state) { try { localStorage.setItem(KEY(room), JSON.stringify(state)); } catch (e) {} },
    load(room) { try { return JSON.parse(localStorage.getItem(KEY(room))); } catch (e) { return null; } },
  };

  /* session (name + setlist) persistence, keyed by room */
  const SKEY = (room) => 'worshipiem:session:' + room;
  window.WISession = {
    save(room, session) { try { localStorage.setItem(SKEY(room), JSON.stringify(session)); } catch (e) {} },
    load(room) { try { return JSON.parse(localStorage.getItem(SKEY(room))); } catch (e) { return null; } },
  };

  /* ---------- theme store (light / dark) ---------- */
  const THEME_TOKENS = {
    dark: {
      '--bg': '#0d0d0c', '--surface': '#161614', '--surface-2': '#1f1f1c', '--surface-3': '#292925',
      '--border': '#2b2b27', '--border-2': '#3a3a34',
      '--fg-1': '#f5f4ed', '--fg-2': '#b0aea5', '--fg-3': '#82817a',
      '--on-accent': '#1a0f0a', '--success': '#7aa860', '--danger': '#d8574c',
      '--shadow-card': 'none', '--topbar-bg': 'rgba(13,13,12,0.82)', '--scrim': 'rgba(13,13,12,0.9)',
    },
    light: {
      '--bg': '#f5f4ed', '--surface': '#faf9f5', '--surface-2': '#f0eee6', '--surface-3': '#e8e6dc',
      '--border': '#ece9df', '--border-2': '#dcd8cb',
      '--fg-1': '#141413', '--fg-2': '#5e5d59', '--fg-3': '#87867f',
      '--on-accent': '#faf9f5', '--success': '#4a6b3a', '--danger': '#b53333',
      '--shadow-card': '0 4px 24px rgba(20,20,19,0.06)', '--topbar-bg': 'rgba(245,244,237,0.82)', '--scrim': 'rgba(245,244,237,0.92)',
    },
  };
  let _theme = 'light';
  try { _theme = localStorage.getItem('worshipiem:theme') || 'light'; } catch (e) {}
  const _subs = new Set();
  function applyTheme(theme) {
    const map = THEME_TOKENS[theme] || THEME_TOKENS.dark;
    const root = document.documentElement.style;
    for (const k in map) root.setProperty(k, map[k]);
    document.documentElement.setAttribute('data-theme', theme);
  }
  window.WITheme = {
    get() { return _theme; },
    set(t) {
      _theme = t; try { localStorage.setItem('worshipiem:theme', t); } catch (e) {}
      applyTheme(t); _subs.forEach((f) => f(t));
    },
    toggle() { this.set(_theme === 'dark' ? 'light' : 'dark'); },
    subscribe(f) { _subs.add(f); return () => _subs.delete(f); },
    apply() { applyTheme(_theme); },
  };
  applyTheme(_theme);

  // Fetch ICE config on load
  window.WIIceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  fetch('/api/ice-config').then(r => r.json()).then(cfg => { window.WIIceConfig = cfg; }).catch(() => {});

  window.WITransport = WITransport;
})();
