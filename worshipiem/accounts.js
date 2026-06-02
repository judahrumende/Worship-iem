/* WorshipIEM — accounts + library (localStorage, username/password, no email).
   Prototype-grade auth: passwords are stored in plain localStorage. Tell Claude
   Code to move this to a real backend with hashing before production. */
(function () {
  const UKEY = 'worshipiem:users';
  const AKEY = 'worshipiem:auth';

  function readUsers() { try { return JSON.parse(localStorage.getItem(UKEY)) || {}; } catch (e) { return {}; } }
  function writeUsers(u) { try { localStorage.setItem(UKEY, JSON.stringify(u)); } catch (e) {} }

  let listeners = [];
  function emit() { const c = current(); listeners.forEach(f => { try { f(c); } catch (e) {} }); }
  function current() { try { return localStorage.getItem(AKEY) || null; } catch (e) { return null; } }

  window.WIAuth = {
    current,
    signup(username, password) {
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
    login(username, password) {
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
      // de-dupe by name: replace existing
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
