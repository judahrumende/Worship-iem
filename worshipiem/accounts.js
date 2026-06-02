/* WorshipIEM — accounts + library.
   PRODUCTION PATH (default): Firebase Auth for username/password (real password
   hashing, sessions and token persistence handled by Firebase) + Realtime
   Database for the per-user song library, so saved songs follow a user across
   devices. The public interface (WIAuth / WILibrary) is unchanged.

   USERNAME/PASSWORD, NO EMAIL: Firebase Auth is email-based, so we map a
   username to a synthetic address (username -> "<encoded>@worshipiem.local")
   and keep the human username in the account displayName. The UX stays
   username-only exactly as before.

   FALLBACK: if the Firebase Auth SDK isn't loaded, we fall back to the original
   localStorage prototype so the app still runs offline / standalone. */
(function () {
  const hasFirebaseAuth = typeof firebase !== 'undefined' && firebase.auth && window.WI_FIREBASE_CONFIG;

  /* shared listener plumbing — library changes notify the same listeners as
     auth changes (matches the original contract that useLibrary refreshes on
     WIAuth.onChange). */
  let listeners = [];

  if (hasFirebaseAuth) {
    if (!firebase.apps.length) firebase.initializeApp(window.WI_FIREBASE_CONFIG);
    const auth = firebase.auth();
    const db = firebase.database();

    // keep users signed in across reloads / devices
    try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}

    const emailFor = (u) => encodeURIComponent((u || '').trim().toLowerCase()).replace(/[%.]/g, '_') + '@worshipiem.local';
    const clean = (o) => JSON.parse(JSON.stringify(o)); // drop undefined for RTDB

    function current() {
      const u = auth.currentUser;
      return u ? (u.displayName || (u.email || '').split('@')[0]) : null;
    }
    function emit() { const c = current(); listeners.forEach(f => { try { f(c); } catch (e) {} }); }

    function friendly(e) {
      const code = (e && e.code) || '';
      if (code === 'auth/email-already-in-use') return 'That username is already taken.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' ||
          code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials') return 'Wrong username or password.';
      if (code === 'auth/weak-password') return 'Use a password of at least 6 characters.';
      if (code === 'auth/network-request-failed') return 'Network problem — check your connection and try again.';
      if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
      return (e && e.message) || 'Something went wrong.';
    }

    /* ---- per-user library, mirrored into a local cache so list() stays sync ---- */
    let _lib = [];
    let _libRef = null;
    function bindLibrary(user) {
      if (_libRef) { try { _libRef.off(); } catch (e) {} _libRef = null; }
      _lib = [];
      if (!user) { emit(); return; }
      _libRef = db.ref('users/' + user.uid + '/library');
      _libRef.on('value', (snap) => {
        const val = snap.val() || {};
        _lib = Object.keys(val)
          .map(k => Object.assign({}, val[k], { libId: k }))
          .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        emit();
      }, () => { /* permission / network error — leave cache empty */ emit(); });
    }

    auth.onAuthStateChanged((user) => { bindLibrary(user); emit(); });

    window.WIAuth = {
      current,
      async signup(username, password) {
        username = (username || '').trim();
        if (!username) throw new Error('Choose a username.');
        if (username.length < 2) throw new Error('Username is too short.');
        if (!password || password.length < 6) throw new Error('Use a password of at least 6 characters.');
        try {
          const cred = await auth.createUserWithEmailAndPassword(emailFor(username), password);
          await cred.user.updateProfile({ displayName: username });
          emit();
          return username;
        } catch (e) { throw new Error(friendly(e)); }
      },
      async login(username, password) {
        username = (username || '').trim();
        if (!username) throw new Error('Enter your username.');
        try {
          const cred = await auth.signInWithEmailAndPassword(emailFor(username), password);
          return cred.user.displayName || username;
        } catch (e) { throw new Error(friendly(e)); }
      },
      logout() { auth.signOut(); },
      onChange(f) { listeners.push(f); return () => { listeners = listeners.filter(x => x !== f); }; },
    };

    window.WILibrary = {
      list() { return _lib; },
      has(name) { const n = (name || '').trim().toLowerCase(); return _lib.some(s => (s.name || '').trim().toLowerCase() === n); },
      add(song) {
        const user = auth.currentUser; if (!user) return null;
        const ref = db.ref('users/' + user.uid + '/library');
        const n = (song.name || '').trim().toLowerCase();
        // de-dupe by name: drop any existing same-name entries first
        _lib.filter(s => (s.name || '').trim().toLowerCase() === n).forEach(s => ref.child(s.libId).remove());
        const item = clean(Object.assign({}, song, { savedAt: Date.now() }));
        delete item.libId;
        const newRef = ref.push();
        newRef.set(item);
        return Object.assign({}, item, { libId: newRef.key });
      },
      remove(libId) {
        const user = auth.currentUser; if (!user || !libId) return;
        db.ref('users/' + user.uid + '/library/' + libId).remove();
      },
    };

    return;
  }

  /* =========================================================================
     FALLBACK — original localStorage prototype (no Firebase Auth available).
     ========================================================================= */
  const UKEY = 'worshipiem:users';
  const AKEY = 'worshipiem:auth';
  function readUsers() { try { return JSON.parse(localStorage.getItem(UKEY)) || {}; } catch (e) { return {}; } }
  function writeUsers(u) { try { localStorage.setItem(UKEY, JSON.stringify(u)); } catch (e) {} }
  function current() { try { return localStorage.getItem(AKEY) || null; } catch (e) { return null; } }
  function emit() { const c = current(); listeners.forEach(f => { try { f(c); } catch (e) {} }); }

  window.WIAuth = {
    current,
    async signup(username, password) {
      username = (username || '').trim();
      if (!username) throw new Error('Choose a username.');
      if (username.length < 2) throw new Error('Username is too short.');
      if (!password || password.length < 4) throw new Error('Use a password of at least 4 characters.');
      const u = readUsers();
      if (u[username]) throw new Error('That username is already taken.');
      u[username] = { password, library: [] };
      writeUsers(u);
      try { localStorage.setItem(AKEY, username); } catch (e) {}
      emit(); return username;
    },
    async login(username, password) {
      username = (username || '').trim();
      const u = readUsers();
      if (!u[username] || u[username].password !== password) throw new Error('Wrong username or password.');
      try { localStorage.setItem(AKEY, username); } catch (e) {}
      emit(); return username;
    },
    logout() { try { localStorage.removeItem(AKEY); } catch (e) {} emit(); },
    onChange(f) { listeners.push(f); return () => { listeners = listeners.filter(x => x !== f); }; },
  };

  window.WILibrary = {
    list() { const u = readUsers(); const c = current(); return (c && u[c] && u[c].library) || []; },
    has(name) { const n = (name || '').trim().toLowerCase(); return this.list().some(s => (s.name || '').trim().toLowerCase() === n); },
    add(song) {
      const c = current(); if (!c) return null;
      const u = readUsers(); u[c] = u[c] || { password: '', library: [] };
      const item = Object.assign({}, song, { libId: Math.random().toString(36).slice(2, 9), savedAt: Date.now() });
      u[c].library = [item, ...(u[c].library || []).filter(s => (s.name || '').trim().toLowerCase() !== (song.name || '').trim().toLowerCase())].slice(0, 200);
      writeUsers(u); emit(); return item;
    },
    remove(libId) {
      const c = current(); if (!c) return;
      const u = readUsers(); if (u[c]) u[c].library = (u[c].library || []).filter(s => s.libId !== libId);
      writeUsers(u); emit();
    },
  };
})();
