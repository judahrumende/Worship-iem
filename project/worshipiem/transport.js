/* =============================================================
   WorshipIEM — Transport (real-time sync layer)
   ----------------------------------------------------------------
   This is the ONE module a developer swaps to go from prototype to
   production. Everything else (UI, click engine, mic) talks to this
   interface and never touches the wire directly.

   PROTOTYPE IMPLEMENTATION — BroadcastChannel:
     Genuinely syncs across browser tabs on one machine, so you can
     open Host in one tab and Listener(s) in others and watch BPM
     changes, song switches, play/stop and mic level propagate live.
     The shared system clock (Date.now) keeps every tab's click in
     phase — exactly the role a server time-offset plays in prod.

   PRODUCTION SWAP — WebSocket + WebRTC:
     Replace the BroadcastChannel with a WebSocket to a signalling
     server keyed by room code. Same message shapes:
       'state'  — host → all: full authoritative session state
       'hello'  — listener → host: request current state + announce
       'level'  — host → all: live mic amplitude (0..1)
       'bye'    — peer leaving
     Then add an RTCPeerConnection per listener for the host's mic
     audio track (offer/answer/ICE relayed as extra message types).
     Clock sync: replace Date.now() with server-time + measured RTT
     offset so phase alignment survives across the open internet.

   Interface (stable across implementations):
     new WITransport(room, role)
     .on(type, handler)        subscribe
     .send(type, payload)      publish
     .close()
   ============================================================= */
(function () {
  class WITransport {
    constructor(room, role) {
      this.room = room;
      this.role = role;               // 'host' | 'listener'
      this.handlers = {};
      this.ch = new BroadcastChannel('worshipiem:' + room);
      this.ch.onmessage = (e) => {
        const { type, payload, from } = e.data || {};
        if (from === this.role && from === 'host') return; // ignore self echo for host
        const list = this.handlers[type];
        if (list) list.forEach((h) => h(payload, from));
      };
    }
    on(type, handler) {
      (this.handlers[type] = this.handlers[type] || []).push(handler);
      return this;
    }
    send(type, payload) {
      this.ch.postMessage({ type, payload, from: this.role });
    }
    close() { try { this.ch.close(); } catch (e) {} }
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

  window.WITransport = WITransport;

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
})();
