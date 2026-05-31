/* =============================================================
   WorshipIEM — Transport (real-time sync layer)
   ----------------------------------------------------------------
   Priority order:
     1. Firebase Realtime DB  — set window.WI_FIREBASE_CONFIG
     2. WebSocket server      — set window.WI_SERVER_URL, or deploy
                                server/ to a host with WS support
     3. BroadcastChannel      — same-browser tab testing only
   ============================================================= */
(function () {

  /* ============================================================
     Firebase Transport
     Used when window.WI_FIREBASE_CONFIG is set in index.html.
     Free on Firebase's Spark plan (100 connections, 10 GB/mo).
     ============================================================ */
  class FirebaseTransport {
    constructor(room, role) {
      this.room = room; this.role = role;
      this.handlers = {}; this._closed = false;
      this._id = `${role}_${Math.random().toString(36).slice(2, 8)}`;
      this._subs = []; this._clientRef = null;

      if (!firebase.apps.length) firebase.initializeApp(window.WI_FIREBASE_CONFIG);
      const db = firebase.database();
      const R = db.ref('wi/' + room);
      this._R = R;

      // Listeners receive state updates from host
      if (role === 'listener') {
        this._sub(R.child('state'), 'value', s => s.exists() && this._emit('state', s.val()));
        this._sub(R.child('level'), 'value', s => s.exists() && this._emit('level', s.val()));
      }

      // Host watches client presence (hello / ping / bye)
      if (role === 'host') {
        const cr = R.child('clients');
        this._sub(cr, 'child_added',   s => { const c = s.val(); if (c) this._emit('hello', c); });
        this._sub(cr, 'child_changed', s => { const c = s.val(); if (c) this._emit('ping',  c); });
        this._sub(cr, 'child_removed', s => { const c = s.val(); if (c) this._emit('bye', { id: c.id }); });
        // Host-addressed inbox (rtc-answer, rtc-ice, etc.)
        this._sub(R.child('host-inbox'), 'child_added', s => {
          const m = s.val(); if (m) { this._emit(m.type, m.payload); s.ref.remove(); }
        });
      }

      // Per-client inbox (granted, denied, rtc-offer, etc.)
      this._sub(R.child('inbox/' + this._id), 'child_added', s => {
        const m = s.val(); if (m) { this._emit(m.type, m.payload); s.ref.remove(); }
      });

      // Approximate clock sync via Firebase server timestamp
      this._syncClock();
      this._syncTimer = setInterval(() => this._syncClock(), 30000);

      setTimeout(() => this._emit('registered', { id: this._id }), 50);
    }

    _sub(ref, event, cb) {
      ref.on(event, s => { if (!this._closed) cb(s); });
      this._subs.push({ ref, event });
    }
    _emit(type, payload) { (this.handlers[type] || []).forEach(h => h(payload)); }

    _syncClock(n = 0, best = null) {
      if (this._closed) return;
      const SAMPLES = 6;
      const t1 = Date.now();
      const ref = this._R.child('_clk/' + this._id);
      ref.set({ t: firebase.database.ServerValue.TIMESTAMP })
        .then(() => ref.once('value'))
        .then(s => {
          const serverTs = s.val()?.t;
          if (serverTs) {
            const t4 = Date.now();
            const rtt = t4 - t1;
            const offset = Math.round(serverTs - (t1 + t4) / 2);
            ref.remove();
            // Keep the sample with minimum RTT — lowest round-trip = least asymmetry error
            if (!best || rtt < best.rtt) {
              best = { offset, rtt };
              window.WIClock && window.WIClock.setOffset(best.offset);
            }
          }
          if (n + 1 < SAMPLES) setTimeout(() => this._syncClock(n + 1, best), 200);
        })
        .catch(() => { if (n + 1 < SAMPLES) setTimeout(() => this._syncClock(n + 1, best), 500); });
    }

    on(type, handler) { (this.handlers[type] = this.handlers[type] || []).push(handler); return this; }

    send(type, payload) {
      if (this._closed) return;

      if (type === 'state' && this.role === 'host') {
        this._R.child('state').set(payload); return;
      }
      if (type === 'talkreq') return;
      if (type === 'level' && this.role === 'host') { this._R.child('level').set(payload); return; }
      if (type === 'level') return;

      if (type === 'hello' && this.role === 'listener') {
        const ref = this._R.child('clients/' + this._id);
        ref.set({ ...payload, id: this._id });
        ref.onDisconnect().remove();
        this._clientRef = ref; return;
      }
      if (type === 'ping' && this.role === 'listener') {
        this._R.child('clients/' + this._id).update({ ready: payload.ready }); return;
      }
      if (type === 'bye') {
        if (this._clientRef) this._clientRef.remove(); return;
      }

      // Targeted: granted / denied / rtc-offer / rtc-answer / rtc-ice
      const to = payload?.to || payload?.id;
      if (to && to !== this._id) {
        this._R.child('inbox/' + to).push({ type, payload }); return;
      }
      // Listener → host (no explicit target)
      if (this.role === 'listener') {
        this._R.child('host-inbox').push({ type, payload });
      }
    }

    close() {
      this._closed = true;
      clearInterval(this._syncTimer);
      this._subs.forEach(({ ref, event }) => ref.off(event));
      if (this._clientRef) this._clientRef.remove();
    }
    get id() { return this._id; }
  }


  /* ============================================================
     WebSocket Transport
     Used when WI_FIREBASE_CONFIG is not set. Connects to the
     Node.js server (server/) or Cloudflare Worker (worker/).
     Falls back to BroadcastChannel after repeated failures.
     ============================================================ */
  const WS_URL = window.WI_SERVER_URL || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);

  class WSTransport {
    constructor(room, role) {
      this.room = room; this.role = role;
      this.handlers = {}; this._ws = null;
      this._id = null; this._queue = []; this._closed = false;
      this._syncTimer = null; this._failCount = 0; this._everConnected = false;

      if (location.protocol === 'file:') { this._fallback(); return; }
      this._connect();
    }

    _connect() {
      if (this._closed) return;
      let ws;
      const wsUrl = WS_URL + (WS_URL.includes('?') ? '&' : '?') + 'room=' + encodeURIComponent(this.room);
      try { ws = new WebSocket(wsUrl); }
      catch (e) { this._fallback(); return; }
      this._ws = ws;
      const openedAt = Date.now();

      ws.onopen = () => {
        this._failCount = 0; this._everConnected = true;
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
          this._queue.splice(0).forEach(m => this._raw(m));
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
      if (this._closed || this._id) return;
      console.warn('[WITransport] No server — BroadcastChannel fallback (same browser only)');
      const ch = new BroadcastChannel('worshipiem:' + this.room);
      this._id = `${this.role}_${Math.random().toString(36).slice(2, 6)}`;
      ch.onmessage = (e) => {
        const { type, payload, from } = e.data || {};
        if (from === this.role && this.role === 'host') return;
        (this.handlers[type] || []).forEach(h => h(payload));
      };
      this._raw = (m) => ch.postMessage({ ...m, from: this.role });
      this._queue.splice(0).forEach(m => this._raw(m));
      this.close = () => { try { ch.close(); } catch (_) {} this._closed = true; };
      (this.handlers['registered'] || []).forEach(h => h({ id: this._id }));
    }

    _doTimeSync() { this._raw({ type: 'timesync', payload: { t1: Date.now() } }); }
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


  /* Factory: pick transport based on config */
  window.WITransport = function WITransport(room, role) {
    if (window.WI_FIREBASE_CONFIG) return new FirebaseTransport(room, role);
    return new WSTransport(room, role);
  };


  /* localStorage snapshot — late-joining listener paints last-known
     state instantly before the host re-broadcasts */
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

  /* ---------- theme store ---------- */
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
    set(t) { _theme = t; try { localStorage.setItem('worshipiem:theme', t); } catch (e) {} applyTheme(t); _subs.forEach(f => f(t)); },
    toggle() { this.set(_theme === 'dark' ? 'light' : 'dark'); },
    subscribe(f) { _subs.add(f); return () => _subs.delete(f); },
    apply() { applyTheme(_theme); },
  };
  applyTheme(_theme);

  window.WIIceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  fetch('/api/ice-config').then(r => r.json()).then(cfg => { window.WIIceConfig = cfg; }).catch(() => {});

})();
