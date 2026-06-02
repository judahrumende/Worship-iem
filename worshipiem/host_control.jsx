/* WorshipIEM — Host live control surface */
const { useState: uS, useEffect: uE, useRef: uR, useMemo: uM, useCallback: uC } = React;

function HostControl({ room, go }) {
  const session = uM(() => window.WISession.load(room), [room]);

  if (!session) {
    return (
      <div className="screen"><TopBar />
        <div className="wrap fade-in" style={{ paddingTop: 80, textAlign: 'center' }}>
          <h2 className="serif" style={{ fontSize: 30 }}>Session not found</h2>
          <p className="muted" style={{ margin: '10px 0 24px' }}>This room has no setlist on this device.</p>
          <button className="btn btn--primary btn--lg" onClick={() => go('#/create')}>Start a new session</button>
        </div>
      </div>
    );
  }

  const [setlist, setSetlist] = uS(session.setlist);
  const [activeId, setActiveId] = uS(session.setlist[0]?.id || null);
  const [playing, setPlaying] = uS(false);
  const [anchor, setAnchor] = uS(0);
  const [bpm, setBpm] = uS(session.setlist[0]?.bpm || 120);
  const [bpb, setBpb] = uS(session.setlist[0]?.bpb || 4);
  const [clickVol, setClickVol] = uS(80);
  const [micVol, setMicVol] = uS(75);
  const [countInBars, setCountInBars] = uS(0);   // 0 = off, 1 or 2 bars
  const [counting, setCounting] = uS(false);
  const [timbre, setTimbre] = uS(session.setlist[0]?.clickSound || 'wood');
  const [subdivision, setSubdivision] = uS(session.setlist[0]?.subdivision || 'none');
  const [accent, setAccent] = uS(session.setlist[0]?.accent !== false);
  const [rampOn, setRampOn] = uS(false);
  const [rampStart, setRampStart] = uS(60);
  const [micOn, setMicOn] = uS(false);
  const [micLevel, setMicLevel] = uS(0);
  const [micLabel, setMicLabel] = uS('');
  const [micErr, setMicErr] = uS('');
  const [pttMode, setPttMode] = uS('open');   // open | ptt
  const [talkTargets, setTalkTargets] = uS([]);   // [] = whole band; else player ids
  const [holding, setHolding] = uS(false);
  const [ready, setReady] = uS(false);
  const [players, setPlayers] = uS({});
  const [talkers, setTalkers] = uS({});
  const [tab, setTab] = uS('setlist');         // setlist | players
  const [advanced, setAdvanced] = uS(false);
  const [activeCueId, setActiveCueId] = uS(null);
  const [songModal, setSongModal] = uS(null);  // {mode:'add'} | {mode:'edit', song} | 'import' | 'saved' | 'library'
  const [savedOk, setSavedOk] = uS('');         // toast text
  const [showDaw, setShowDaw] = uS(false);      // fullscreen Live DAW overlay
  const [authOpen, setAuthOpen] = uS(false);
  const account = useAuth();
  const pendingSave = uR(null);
  const flash = (m) => { setSavedOk(m); clearTimeout(flash._t); flash._t = setTimeout(() => setSavedOk(''), 1700); };

  const tx = uR(null);
  const tapTimes = uR([]);
  const lvlThrottle = uR(0);
  const rampTimer = uR(null);
  const dragFrom = uR(null);
  // live refs for async (ramp / ptt)
  const aRef = uR(anchor), bRef = uR(bpm), pRef = uR(playing), bpbRef = uR(bpb);
  const pttRef = uR(pttMode), holdRef = uR(holding), micVolRef = uR(micVol), targetsRef = uR(talkTargets);
  uE(() => { aRef.current = anchor; bRef.current = bpm; pRef.current = playing; bpbRef.current = bpb; pttRef.current = pttMode; holdRef.current = holding; micVolRef.current = micVol; targetsRef.current = talkTargets; });

  const activeSong = setlist.find(s => s.id === activeId);

  /* ---- audio gate ---- */
  const ensureAudio = uC(async () => { try { await window.WIClick.resume(); setReady(true); } catch (e) {} }, []);
  uE(() => {
    const h = () => { ensureAudio(); window.removeEventListener('pointerdown', h); };
    window.addEventListener('pointerdown', h);
    return () => window.removeEventListener('pointerdown', h);
  }, []);

  /* ---- transport / presence ---- */
  uE(() => {
    const t = new window.WITransport(room, 'host');
    tx.current = t;
    window.WIMic.setTransport(t);
    const see = (p) => {
      if (!p || !p.id) return;
      setPlayers(prev => ({ ...prev, [p.id]: { name: p.name || 'Musician', instrument: p.instrument || 'Other', ready: !!p.ready, t: Date.now() } }));
    };
    t.on('hello', (p) => {
      if (session.password) {
        if (!p || p.password !== session.password) { t.send('denied', { to: p && p.id, id: p && p.id }); return; }
        t.send('granted', { to: p.id, id: p.id });
      }
      see(p); broadcast();
      if (window.WIMic.active) window.WIMic.addListener(p.id);
    });
    t.on('ping', see);
    t.on('bye', (p) => {
      if (!p) return;
      window.WIMic.removeListener(p.id);
      setPlayers(prev => { const c = { ...prev }; delete c[p.id]; return c; });
    });
    t.on('talkreq', (p) => p && p.id && setTalkers(prev => ({ ...prev, [p.id]: { name: p.name || 'Musician', level: p.level || 0, t: Date.now() } })));
    const prune = setInterval(() => {
      const now = Date.now();
      setPlayers(prev => { let ch = false; const c = { ...prev }; for (const k in c) if (now - c[k].t > 8000) { delete c[k]; ch = true; } return ch ? c : prev; });
      setTalkers(prev => { let ch = false; const c = { ...prev }; for (const k in c) if (now - c[k].t > 700) { delete c[k]; ch = true; } return ch ? c : prev; });
    }, 600);
    return () => { clearInterval(prune); t.close(); };
  }, [room]);

  const stateObj = () => {
    const s = setlist.find(x => x.id === activeId);
    const cue = s && s.cues && s.cues.find(c => c.id === activeCueId);
    return {
      sessionName: session.name, needsPassword: !!session.password, setlist, activeId, playing, anchor, bpm, bpb,
      clickVol, micVol, micOn, timbre, subdivision, accent, pttMode, countInBars, talkTargets,
      activeCue: cue ? cue.name : null, ts: Date.now(),
    };
  };
  const broadcast = () => { if (tx.current) tx.current.send('state', stateObj()); };

  uE(() => { window.WIClick.setTransport({ playing, anchor, bpm, beatsPerBar: bpb }); }, [playing, anchor, bpm, bpb, ready]);
  uE(() => { window.WIClick.setVolume(clickVol / 100); }, [clickVol]);
  uE(() => { window.WIClick.setTimbre(timbre); }, [timbre]);
  uE(() => { window.WIClick.setSubdivision(subdivision); }, [subdivision]);
  uE(() => { window.WIClick.setAccent(accent); }, [accent]);
  uE(() => { broadcast(); window.WISnap.save(room, stateObj()); },
    [activeId, playing, anchor, bpm, bpb, clickVol, micVol, micOn, timbre, subdivision, accent, pttMode, setlist, activeCueId, countInBars, talkTargets]);

  /* persist setlist edits to localStorage so nothing resets on reload */
  uE(() => { window.WISession.save(room, { ...session, setlist }); }, [setlist]);

  /* PTT gate + per-listener targeting — route real audio, not just the meter.
     On-air when open-mic, or when push-to-talk is being held. talkTargets [] = whole band. */
  uE(() => { if (window.WIMic.active) window.WIMic.setRouting(pttMode !== 'ptt' || holding, talkTargets); }, [pttMode, holding, micOn, talkTargets]);

  /* drop talkback targets for musicians who have left */
  uE(() => { setTalkTargets(t => { const f = t.filter(id => players[id]); return f.length === t.length ? t : f; }); }, [players]);

  /* ---- clock helper (uses server-synced offset when available) ---- */
  const wiNow = () => window.WIClock ? window.WIClock.now() : Date.now();

  /* ---- tempo helpers (phase-preserving) ---- */
  const reanchorFor = (newBpm) => {
    const oldBeatMs = 60000 / bRef.current;
    const idx = (wiNow() - aRef.current) / oldBeatMs;
    return wiNow() - idx * (60000 / newBpm);
  };
  const setTempo = (nb) => {
    nb = Math.min(300, Math.max(20, Math.round(nb)));
    if (pRef.current) setAnchor(reanchorFor(nb));
    setBpm(nb);
  };

  /* ---- transport actions ---- */
  const leadMs = (tempo, beats) => (countInBars > 0 ? countInBars * beats * (60000 / tempo) : 0);
  const start = async () => {
    await ensureAudio();
    const target = activeSong ? activeSong.bpm : bpm;
    clearInterval(rampTimer.current);
    if (rampOn) {
      const s0 = Math.min(rampStart, target);
      setBpm(s0); bRef.current = s0;
      const a = wiNow() + leadMs(s0, bpb); setAnchor(a); aRef.current = a; setPlaying(true);
      if (countInBars > 0) setCounting(true);
      const t0 = a, dur = 12000;
      rampTimer.current = setInterval(() => {
        const k = (wiNow() - t0) / dur;
        if (k < 0) return;            // still counting in
        const kk = Math.min(1, k);
        const nb = Math.round(s0 + (target - s0) * kk);
        const na = reanchorFor(nb);
        setAnchor(na); aRef.current = na; setBpm(nb); bRef.current = nb;
        if (kk >= 1) { clearInterval(rampTimer.current); }
      }, 180);
    } else {
      setBpm(target); bRef.current = target;
      const a = wiNow() + leadMs(target, bpb); setAnchor(a); setPlaying(true);
      if (countInBars > 0) setCounting(true);
    }
  };
  const stop = () => { clearInterval(rampTimer.current); setPlaying(false); setCounting(false); setActiveCueId(null); };
  const toggle = () => { playing ? stop() : start(); };

  const activate = (id) => {
    const s = setlist.find(x => x.id === id); if (!s) return;
    clearInterval(rampTimer.current);
    setActiveId(id); setActiveCueId(null); setBpm(s.bpm); setBpb(s.bpb);
    setTimbre(s.clickSound || 'wood'); setSubdivision(s.subdivision || 'none'); setAccent(s.accent !== false);
    if (pRef.current) { const a = wiNow() + leadMs(s.bpm, s.bpb); setAnchor(a); if (countInBars > 0) setCounting(true); }
  };
  const nextSong = () => {
    const i = setlist.findIndex(s => s.id === activeId);
    if (i < setlist.length - 1) activate(setlist[i + 1].id);
  };
  const reorder = (from, to) => {
    if (from == null || from === to) return;
    setSetlist(s => { const c = s.slice(); const [m] = c.splice(from, 1); c.splice(to, 0, m); return c; });
  };

  /* ---- inline setlist editing (no more separate setup page) ---- */
  const addSong = (data) => {
    const s = window.WINormalizeSong({ ...data, id: uid() });
    setSetlist(l => [...l, s]);
    setActiveId(prev => prev || s.id);
    return s.id;
  };
  const updateSong = (id, patch) => setSetlist(l => l.map(x => x.id === id ? { ...x, ...patch } : x));
  const removeSong = (id) => {
    const n = setlist.filter(x => x.id !== id);
    setSetlist(n);
    if (activeId === id) {
      clearInterval(rampTimer.current);
      const nx = n[0];
      setActiveId(nx ? nx.id : null); setActiveCueId(null);
      if (nx) { setBpm(nx.bpm); setBpb(nx.bpb); } else { setPlaying(false); }
    }
  };
  const replaceSetlist = (songs) => {
    const mapped = songs.map(s => window.WINormalizeSong({ ...s, id: uid() }));
    clearInterval(rampTimer.current); setPlaying(false); setActiveCueId(null);
    setSetlist(mapped); setActiveId(mapped[0] ? mapped[0].id : null);
    if (mapped[0]) { setBpm(mapped[0].bpm); setBpb(mapped[0].bpb); }
  };
  const saveSetlist = () => {
    const clean = setlist.filter(s => (s.name || '').trim());
    if (!clean.length) return;
    window.WISetlistStore.save(session.name || 'Setlist', clean.map(s => ({ name: s.name, key: s.key, bpm: s.bpm, bpb: s.bpb, notes: s.notes })));
    flash('Setlist saved for reuse');
  };

  /* ---- per-song click settings: write to the song AND keep the engine in sync ---- */
  const setClick = (id, patch) => {
    updateSong(id, patch);
    if (id !== activeId) return;
    if ('clickSound' in patch) { setTimbre(patch.clickSound); window.WIClick.setTimbre(patch.clickSound); }
    if ('subdivision' in patch) setSubdivision(patch.subdivision);
    if ('accent' in patch) setAccent(patch.accent);
    if ('bpb' in patch) { setBpb(patch.bpb); if (pRef.current) setAnchor(wiNow()); }
  };

  /* ---- library ---- */
  const doSaveToLibrary = (song) => {
    const item = window.WILibrary.add(window.WINormalizeSong(song));
    if (item) flash('Saved “' + (song.name || 'song') + '” to your library');
  };
  const saveSongToLibrary = (song) => {
    if (!window.WIAuth.current()) { pendingSave.current = song; setAuthOpen(true); return; }
    doSaveToLibrary(song);
  };
  const addFromLibrary = (libSong) => { const id = addSong(libSong); setActiveId(id); };

  /* ---- keyboard shortcuts: 1–9 (0 = 10th) jump to a song, Space starts/stops ---- */
  uE(() => {
    const onKey = (e) => {
      if (songModal) return;
      const el = e.target;
      const tag = (el && el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || (el && el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === '0' ? 9 : (parseInt(e.key, 10) - 1);
        if (setlist[idx]) { e.preventDefault(); activate(setlist[idx].id); }
      } else if (e.code === 'Space' && tag !== 'button') {
        e.preventDefault();
        pRef.current ? stop() : start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setlist, songModal, activeId, playing, bpm, bpb, countInBars, rampOn, rampStart]);

  /* ---- cues (Ableton-style, saved per song) ---- */
  const DEFAULT_CUES = (song) => ['Intro', 'Verse', 'Chorus', 'Bridge', 'Outro'].map((n, i) => ({ id: uid(), name: n, bpm: song.bpm, bars: i === 0 ? 4 : 8, bpb: song.bpb, note: '' }));
  const setCues = (updater) => setSetlist(list => list.map(s => s.id === activeId ? { ...s, cues: updater(s.cues || []) } : s));
  const addCue = () => setCues(cs => [...cs, { id: uid(), name: 'New cue', bpm, bars: 8, bpb, note: '' }]);
  const updateCue = (id, patch) => setCues(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeCue = (id) => { setCues(cs => cs.filter(c => c.id !== id)); if (activeCueId === id) setActiveCueId(null); };
  const moveCue = (id, dir) => setCues(cs => { const i = cs.findIndex(c => c.id === id); const j = i + dir; if (j < 0 || j >= cs.length) return cs; const c = cs.slice(); [c[i], c[j]] = [c[j], c[i]]; return c; });
  const goAdvanced = () => { if (activeSong && (!activeSong.cues || !activeSong.cues.length)) setCues(() => DEFAULT_CUES(activeSong)); setAdvanced(true); };
  const fireCue = async (cue) => {
    await ensureAudio();
    clearInterval(rampTimer.current);
    setActiveCueId(cue.id);
    setBpb(cue.bpb || bpb); setBpm(cue.bpm || bpm);
    setAnchor(wiNow() + leadMs(cue.bpm || bpm, cue.bpb || bpb)); setPlaying(true);
    if (countInBars > 0) setCounting(true);
  };

  const tap = async () => {
    await ensureAudio();
    const now = Date.now();
    const arr = tapTimes.current.filter(t => now - t < 2500); arr.push(now); tapTimes.current = arr;
    window.WIClick.tick(false);
    if (arr.length >= 2) {
      const ints = []; for (let i = 1; i < arr.length; i++) ints.push(arr[i] - arr[i - 1]);
      const avg = ints.reduce((a, b) => a + b, 0) / ints.length;
      setTempo(60000 / avg);
    }
  };

  /* ---- mic ---- */
  const toggleMic = async () => {
    if (micOn) { window.WIMic.disconnect(); setMicOn(false); setMicLevel(0); return; }
    setMicErr('');
    try {
      const label = await window.WIMic.connect();
      setMicLabel(label); setMicOn(true);
      Object.keys(players).forEach(id => window.WIMic.addListener(id));
      window.WIMic.onLevel = (lv) => {
        setMicLevel(lv);
        const now = Date.now();
        if (now - lvlThrottle.current > 80 && tx.current) {
          lvlThrottle.current = now;
          const gated = (pttRef.current === 'ptt' && !holdRef.current) ? 0 : lv;
          tx.current.send('level', { level: gated * (micVolRef.current / 100), targets: targetsRef.current });
        }
      };
    } catch (e) { setMicErr('Microphone permission was blocked. Allow access to talk to the band.'); }
  };
  uE(() => () => { window.WIMic.disconnect(); clearInterval(rampTimer.current); }, []);

  const pcount = Object.keys(players).length;
  const readyCount = Object.values(players).filter(p => p.ready).length;
  const talkerList = Object.values(talkers).filter(t => t.level > 0.04);

  return (
    <div className="screen">
      <TopBar live sub={'· ' + session.name} right={
        <>
          {account
            ? <button className="chip" onClick={() => window.WIAuth.logout()} title="Sign out" style={{ cursor: 'pointer' }}><WIcon name="user" size={14} /> {account}</button>
            : <button className="chip" onClick={() => setAuthOpen(true)} style={{ cursor: 'pointer' }}><WIcon name="user" size={14} /> Sign in</button>}
          <button className="chip" onClick={() => setTab('players')} style={{ cursor: 'pointer' }}><WIcon name="users" size={15} /> {pcount}</button>
          <button className="btn btn--ghost btn--icon" onClick={() => go('#/')} title="Leave"><WIcon name="x" size={18} /></button>
        </>
      } />

      {/* share banner */}
      <div className="wrap wide" style={{ paddingTop: 16 }}>
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div className="overline">Room code</div>
              <div className="mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>{room}</div>
            </div>
            <div className="hr" style={{ width: 1, height: 40 }} />
            <div className="muted" style={{ fontSize: 14, maxWidth: 230 }}>
              {session.password ? 'Password protected. ' : ''}Same link every week — band members just bookmark it.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <CopyButton text={room} label="Copy code" className="btn" />
            <CopyButton text={listenerLink(room)} label="Copy link" className="btn btn--primary" />
          </div>
        </div>
      </div>

      <div className="wrap wide live-grid" style={{ paddingTop: 20, paddingBottom: 40, display: 'grid', gap: 20, alignItems: 'start' }}>

        {/* LEFT — now playing + metronome + transport + click options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 26, paddingBottom: 26, position: 'relative' }}>
            <button className="btn btn--ghost" style={{ position: 'absolute', top: 14, right: 14, height: 34, fontSize: 13.5 }} onClick={() => setShowDaw(true)} disabled={!activeSong}>
              <WIcon name="grip" size={15} /> Live DAW
            </button>
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div className="overline" style={{ color: playing ? 'var(--accent)' : 'var(--fg-3)' }}>{playing ? 'Click live' : 'Now playing'}</div>
              <h2 className="serif" style={{ fontSize: 30, marginTop: 6 }}>{activeSong ? activeSong.name : 'No song selected'}</h2>
              {activeSong && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  {activeSong.key && <span className="chip" style={{ height: 26 }}>Key {activeSong.key}</span>}
                  <span className="chip" style={{ height: 26 }}>{TS_LABEL[bpb]}</span>
                  {activeSong.notes && <span className="chip" style={{ height: 26, color: 'var(--accent)', borderColor: 'rgba(224,122,85,0.3)' }}>{activeSong.notes}</span>}
                </div>
              )}
            </div>

            {!advanced ? (
              <>
                <div style={{ position: 'relative' }}>
                  <Metronome playing={playing} anchor={anchor} bpm={bpm} beatsPerBar={bpb} size={252} onBpm={setTempo} />
                  <CountInOverlay active={counting && playing} anchor={anchor} bpm={bpm} beatsPerBar={bpb} bars={countInBars || 1} onDone={() => setCounting(false)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button className="btn btn--icon" onClick={() => setTempo(bpm - 1)}><WIcon name="minus" size={20} /></button>
                  <span className="muted mono" style={{ fontSize: 14, minWidth: 96, textAlign: 'center' }}>{TS_LABEL[bpb]} · {bpm} bpm</span>
                  <button className="btn btn--icon" onClick={() => setTempo(bpm + 1)}><WIcon name="plus" size={20} /></button>
                </div>
              </>
            ) : (
              <CuePanel cues={activeSong ? (activeSong.cues || []) : []} activeCueId={activeCueId} playing={playing}
                onFire={fireCue} onStop={stop} onAdd={addCue} onUpdate={updateCue} onRemove={removeCue} onMove={moveCue} />
            )}

            {/* BIG transport */}
            <button className={'btn btn--lg btn--block ' + (playing ? 'btn--danger' : 'btn--primary')} style={{ height: 76, fontSize: 22, borderRadius: 'var(--r-lg)' }} onClick={toggle}>
              <WIcon name={playing ? 'stop' : 'play'} size={28} /> {playing ? 'Stop click' : 'Start click'}
            </button>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button className="btn" style={{ flex: 1 }} onClick={tap}><WIcon name="hand" size={20} /> Tap tempo</button>
              <button className="btn" style={{ flex: 1, ...(countInBars > 0 ? activeBtn : {}) }} onClick={() => setCountInBars(v => (v + 1) % 3)}>
                <WIcon name="metronome" size={18} /> {countInBars === 0 ? 'Count-in' : 'Count-in · ' + countInBars + ' bar' + (countInBars > 1 ? 's' : '')}
              </button>
            </div>
            <p className="dim" style={{ fontSize: 12, margin: 0, textAlign: 'center' }}>
              Keyboard: press <span className="kbd">1</span>–<span className="kbd">9</span> (<span className="kbd">0</span> = 10th) to jump to a song · <span className="kbd">Space</span> starts &amp; stops
            </p>
          </div>

          {/* click options */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span className="overline"><WIcon name="metronome" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Click options</span>
            <Segmented label="Time signature" value={String(bpb)} onChange={(v) => setClick(activeId, { bpb: +v })}
              options={[['4', '4/4'], ['3', '3/4'], ['6', '6/8'], ['2', '2/4']]} />
            <Segmented label="Subdivision" value={subdivision} onChange={(v) => setClick(activeId, { subdivision: v })}
              options={[['none', 'Quarter'], ['8', '8ths'], ['triplet', 'Triplet'], ['16', '16ths']]} />
            <Segmented label="Sound" value={timbre} onChange={(v) => { setClick(activeId, { clickSound: v }); window.WIClick.setTimbre(v); window.WIClick.tick(true); }}
              options={[['wood', 'Wood'], ['beep', 'Beep'], ['hihat', 'Hat'], ['cowbell', 'Bell']]} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, ...(accent ? activeBtn : {}) }} onClick={() => setClick(activeId, { accent: !accent })}>Accent beat 1</button>
              <button className="btn" style={{ flex: 1, ...(rampOn ? activeBtn : {}) }} onClick={() => setRampOn(r => !r)}>Ramp-up</button>
            </div>
            {rampOn && (
              <div className="slider-row">
                <div className="slider-head"><span className="name">Ramp starts at</span><span className="val">{rampStart} bpm</span></div>
                <input type="range" className="range accent" min="30" max="160" value={rampStart} onChange={e => setRampStart(+e.target.value)} />
                <span className="dim" style={{ fontSize: 12 }}>Starts slow and speeds to {activeSong ? activeSong.bpm : bpm} bpm over the first few bars.</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — tabs: setlist / players + mic + mixer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* tabbed list */}
          <div className="card card--flush">
            <div style={{ display: 'flex', gap: 4, padding: 10, borderBottom: '1px solid var(--border)' }}>
              <TabBtn active={tab === 'setlist'} onClick={() => setTab('setlist')} icon="list" label="Setlist" />
              <TabBtn active={tab === 'players'} onClick={() => setTab('players')} icon="users" label={`Band · ${pcount}`} />
              {tab === 'setlist' && <button className="btn btn--ghost" style={{ marginLeft: 'auto', height: 34, fontSize: 14 }} onClick={nextSong} disabled={!activeId}>Next <WIcon name="arrowRight" size={16} /></button>}
            </div>

            {tab === 'setlist' ? (
              <div>
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn btn--primary" style={{ height: 36, fontSize: 14 }} onClick={() => setSongModal({ mode: 'add' })}><WIcon name="plus" size={16} /> Add song</button>
                  <button className="btn" style={{ height: 36, fontSize: 14 }} onClick={() => setSongModal('library')}><WIcon name="bookmark" size={15} /> From library</button>
                  <button className="btn" style={{ height: 36, fontSize: 14 }} onClick={() => setSongModal('import')}><WIcon name="upload" size={15} /> Import</button>
                  <button className="btn btn--ghost" style={{ height: 36, fontSize: 14, marginLeft: 'auto' }} onClick={saveSetlist} disabled={!setlist.length}><WIcon name="check" size={15} /> Save</button>
                </div>
                {setlist.length === 0 ? (
                  <p className="muted" style={{ fontSize: 14, padding: '20px 16px', lineHeight: 1.6 }}>
                    No songs yet. Tap <strong>Add song</strong> to build the setlist right here — keys, tempo and notes push live to everyone's in-ears the moment you add them.
                  </p>
                ) : setlist.map((s, i) => {
                  const on = s.id === activeId;
                  const hotkey = i < 9 ? String(i + 1) : (i === 9 ? '0' : null);
                  return (
                    <div key={s.id} draggable
                      onDragStart={() => { dragFrom.current = i; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { reorder(dragFrom.current, i); dragFrom.current = null; }}
                      onClick={() => activate(s.id)}
                      className="song-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer',
                        background: on ? 'var(--accent-soft)' : 'transparent', borderTop: '1px solid var(--border)',
                        borderLeft: '3px solid ' + (on ? 'var(--accent)' : 'transparent'), transition: 'background 180ms var(--ease)',
                      }}>
                      <span style={{ color: 'var(--fg-3)', cursor: 'grab', display: 'flex' }} onClick={e => e.stopPropagation()}><WIcon name="grip2" size={16} /></span>
                      <span className="mono" title={hotkey ? 'Press ' + hotkey : null} style={{
                        width: 26, height: 26, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 6,
                        fontSize: 13, fontWeight: 700,
                        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-2)'),
                        background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
                        color: on ? 'var(--accent)' : 'var(--fg-3)',
                        boxShadow: hotkey ? 'inset 0 -2px 0 rgba(0,0,0,0.18)' : 'none',
                      }}>{hotkey || (i + 1)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: on ? 600 : 500, fontSize: 16, color: on ? 'var(--fg-1)' : 'var(--fg-2)' }}>{s.name || <span className="dim">Untitled song</span>}</div>
                        {s.notes && <div className="dim" style={{ fontSize: 12, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.notes}</div>}
                      </div>
                      {on && playing && <span className="chip chip--live" style={{ height: 24 }}><span className="dot" />live</span>}
                      {s.key && <span className="mono dim" style={{ fontSize: 13, fontWeight: 600 }}>{s.key}</span>}
                      <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: on ? 'var(--fg-1)' : 'var(--fg-3)' }}>{s.bpm}</span>
                      <div className="song-row__actions" style={{ display: 'flex', gap: 2 }}>
                        <button className="btn btn--ghost btn--icon" style={{ height: 32, width: 32 }} title="Edit song" onClick={e => { e.stopPropagation(); setSongModal({ mode: 'edit', song: s }); }}><WIcon name="pencil" size={15} /></button>
                        <button className="btn btn--ghost btn--icon btn--danger" style={{ height: 32, width: 32 }} title="Remove song" onClick={e => { e.stopPropagation(); removeSong(s.id); }}><WIcon name="trash" size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: 8 }}>
                {pcount === 0
                  ? <p className="muted" style={{ fontSize: 14, padding: '12px 10px' }}>No one has joined yet. Share the room code so the band can drop in.</p>
                  : <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="dim" style={{ fontSize: 12.5, padding: '4px 10px 8px' }}>{readyCount} of {pcount} ready</div>
                      {Object.entries(players).map(([id, p]) => (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', borderTop: '1px solid var(--border)' }}>
                          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--fg-1)', display: 'grid', placeItems: 'center', flex: 'none' }}><WIcon name={instIcon(p.instrument)} size={18} /></span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                            <div className="dim" style={{ fontSize: 12.5 }}>{p.instrument}</div>
                          </div>
                          {talkers[id] && talkers[id].level > 0.04
                            ? <span className="chip chip--live" style={{ height: 26 }}><span className="dot" />talking</span>
                            : p.ready
                              ? <span className="chip chip--ok" style={{ height: 26 }}><WIcon name="check" size={13} /> ready</span>
                              : <span className="chip" style={{ height: 26 }}>connecting</span>}
                        </div>
                      ))}
                    </div>}
              </div>
            )}
          </div>

          {/* mic / talkback */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="overline"><WIcon name="mic" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Talk to the band</span>
              {micOn && pttMode === 'open' && <span className="chip chip--live" style={{ height: 26 }}><span className="dot" />{talkTargets.length ? 'private · ' + talkTargets.length : 'on air'}</span>}
            </div>
            <div className="meter"><i style={{ width: (micOn && (pttMode === 'open' || holding) ? micLevel * 100 : 0) + '%' }} /></div>
            {!micOn ? (
              <button className="btn btn--block" onClick={toggleMic}><WIcon name="mic" size={20} /> Connect microphone</button>
            ) : (
              <>
                <Segmented label="Mic mode" value={pttMode} onChange={setPttMode} options={[['open', 'Open mic'], ['ptt', 'Push-to-talk']]} />
                {pcount > 0 && (
                  <div>
                    <div className="overline" style={{ marginBottom: 8 }}>Talk to</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <TalkChip on={talkTargets.length === 0} icon="users" label="Whole band" onClick={() => setTalkTargets([])} />
                      {Object.entries(players).map(([id, p]) => (
                        <TalkChip key={id} on={talkTargets.includes(id)} icon={instIcon(p.instrument)} label={p.name}
                          onClick={() => setTalkTargets(t => {
                            const next = t.includes(id) ? t.filter(x => x !== id) : [...t, id];
                            return next.length >= pcount ? [] : next;
                          })} />
                      ))}
                    </div>
                    <p className="dim" style={{ fontSize: 12, margin: '8px 0 0' }}>
                      {talkTargets.length === 0
                        ? 'Everyone hears you in their in-ears.'
                        : 'Private — only ' + talkTargets.map(id => players[id] && players[id].name).filter(Boolean).join(', ') + ' hears you.'}
                    </p>
                  </div>
                )}
                {pttMode === 'ptt' && (
                  <button
                    onPointerDown={() => setHolding(true)} onPointerUp={() => setHolding(false)} onPointerLeave={() => setHolding(false)}
                    className={'btn btn--lg btn--block ' + (holding ? 'btn--primary' : '')}
                    style={{ height: 64, userSelect: 'none', touchAction: 'none' }}>
                    <WIcon name="mic" size={22} /> {holding ? 'On air — speaking' : 'Hold to talk'}
                  </button>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn--danger" style={{ flex: 1 }} onClick={toggleMic}><WIcon name="micOff" size={18} /> Disconnect</button>
                </div>
                <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>Live from <span className="muted">{micLabel || 'microphone'}</span> · a Bluetooth headset shows up here too.</p>
              </>
            )}
            {micErr && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{micErr}</p>}
            {talkerList.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {talkerList.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                    <span className="chip chip--live" style={{ height: 24 }}><span className="dot" /></span>
                    <span style={{ fontWeight: 600 }}>{t.name}</span> <span className="dim">is talking back</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* mixer */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <span className="overline"><WIcon name="sliders" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Master mix — everyone's in-ears</span>
            <MixSlider icon="metronome" label="Click" value={clickVol} onChange={setClickVol} accent />
            <MixSlider icon="volume" label="My voice" value={micVol} onChange={setMicVol} accent />
            <p className="dim" style={{ fontSize: 12, margin: 0 }}>Each musician fine-tunes their own click/voice balance on their device.</p>
          </div>
        </div>
      </div>

      {showDaw && (
        <LiveDaw
          session={session} room={room} setlist={setlist}
          activeId={activeId} playing={playing} anchor={anchor} bpm={bpm} bpb={bpb} players={players}
          account={account}
          onActivate={activate} onToggle={toggle} onReorder={reorder}
          onAddSong={() => setSongModal({ mode: 'add' })}
          onAddFromLibrary={() => setSongModal('library')}
          onEditSong={(s) => setSongModal({ mode: 'edit', song: s })}
          onRemoveSong={removeSong}
          onUpdateSong={updateSong}
          onSetClick={setClick}
          onSetBpm={(id, n) => { updateSong(id, { bpm: n }); if (id === activeId) setTempo(n); }}
          onSaveToLibrary={saveSongToLibrary}
          onSignIn={() => setAuthOpen(true)}
          micOn={micOn} talking={micOn && holding}
          onToggleMic={toggleMic}
          onTalkStart={() => { setPttMode('ptt'); setHolding(true); }}
          onTalkEnd={() => setHolding(false)}
          onTempo={setTempo} onTap={tap} onClose={() => setShowDaw(false)}
        />
      )}

      {songModal && (songModal.mode === 'add' || songModal.mode === 'edit') && (
        <SongEditor
          song={songModal.mode === 'edit' ? songModal.song : null}
          onClose={() => setSongModal(null)}
          onSave={(data) => {
            if (songModal.mode === 'edit') updateSong(songModal.song.id, data);
            else addSong(data);
            setSongModal(null);
          }} />
      )}
      {songModal === 'import' && (
        <window.WIModal title="Import from Planning Center" onClose={() => setSongModal(null)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
            Your connected Planning Center service plan. Importing replaces the current setlist with its songs, keys and tempos.
          </p>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{window.WIPCPlan.name}</span>
              <span className="chip"><span className="dot" />{window.WIPCPlan.songs.length} songs</span>
            </div>
            {window.WIPCPlan.songs.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 0 }}>
                <span className="mono dim" style={{ width: 18 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 15 }}>{s.name}</span>
                <span className="mono dim" style={{ fontSize: 13 }}>{s.key} · {s.bpm}</span>
              </div>
            ))}
          </div>
          <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 16 }} onClick={() => { replaceSetlist(window.WIPCPlan.songs); setSongModal(null); }}>
            <WIcon name="upload" size={18} /> Import these {window.WIPCPlan.songs.length} songs
          </button>
        </window.WIModal>
      )}
      {songModal === 'saved' && (
        <window.WIModal title="Saved setlists" onClose={() => setSongModal(null)}>
          <window.WISavedList onPick={(songs) => { replaceSetlist(songs); setSongModal(null); }} />
        </window.WIModal>
      )}
      {songModal === 'library' && (
        <LibraryPicker onClose={() => setSongModal(null)} onPick={(s) => addFromLibrary(s)} />
      )}
      {authOpen && (
        <AuthModal intro={pendingSave.current ? 'Sign in to keep this song in your library.' : 'Sign in to save songs to your personal library.'}
          onClose={() => { setAuthOpen(false); pendingSave.current = null; }}
          onDone={() => { if (pendingSave.current) { doSaveToLibrary(pendingSave.current); pendingSave.current = null; } }} />
      )}
      {savedOk && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 90, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '10px 18px', boxShadow: 'var(--shadow-card)' }}>
          <span className="chip chip--ok" style={{ border: 0, background: 'transparent', padding: 0 }}><span className="dot" />{savedOk}</span>
        </div>
      )}
    </div>
  );
}

const activeBtn = { background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--fg-1)' };

function Segmented({ label, value, onChange, options }) {
  return (
    <div>
      {label && <div className="overline" style={{ marginBottom: 8 }}>{label}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(([v, l]) => (
          <button key={v} className="btn" style={{ flex: 1, height: 42, fontSize: 14, padding: '0 6px', ...(value === v ? activeBtn : {}) }} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button className="btn btn--ghost" onClick={onClick}
      style={{ height: 38, fontSize: 14, ...(active ? { background: 'var(--surface-2)', color: 'var(--fg-1)' } : { color: 'var(--fg-3)' }) }}>
      <WIcon name={icon} size={16} /> {label}
    </button>
  );
}

function TalkChip({ on, icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', cursor: 'pointer',
      borderRadius: 999, fontSize: 13.5, fontWeight: on ? 600 : 500, maxWidth: 190,
      background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
      border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
      color: on ? 'var(--fg-1)' : 'var(--fg-2)', transition: 'all 150ms var(--ease)',
    }}>
      <WIcon name={icon} size={15} style={{ color: on ? 'var(--accent)' : 'var(--fg-3)', flex: 'none' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

/* ---- Ableton-style cue launcher ---- */
const cueChip = { display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 8px', height: 34 };
const cueInput = { height: 32, width: 50, background: 'transparent', border: 0, color: 'var(--fg-1)', fontSize: 14, fontWeight: 700, outline: 'none', cursor: 'pointer' };

function CuePanel({ cues, activeCueId, playing, onFire, onStop, onAdd, onUpdate, onRemove, onMove }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="overline" style={{ alignSelf: 'flex-start' }}>Cues · tap to launch</div>
      {cues.length === 0 && <p className="muted" style={{ fontSize: 14, padding: '8px 0' }}>No cues for this song yet.</p>}
      {cues.map((c, i) => {
        const on = c.id === activeCueId;
        return (
          <div key={c.id} style={{
            border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
            background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
            borderRadius: 'var(--r-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
            transition: 'background 160ms var(--ease), border-color 160ms var(--ease)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className={'btn btn--icon ' + ((on && playing) ? 'btn--danger' : 'btn--primary')} style={{ height: 40, width: 40, flex: 'none' }}
                onClick={() => (on && playing) ? onStop() : onFire(c)}>
                <WIcon name={(on && playing) ? 'stop' : 'play'} size={18} />
              </button>
              <input value={c.name} onChange={e => onUpdate(c.id, { name: e.target.value })} placeholder="Cue name"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, color: 'var(--fg-1)', fontSize: 16, fontWeight: 600, outline: 'none' }} />
              {on && <span className="chip chip--live" style={{ height: 24 }}><span className="dot" />{playing ? 'live' : 'cued'}</span>}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button className="btn btn--ghost btn--icon" style={{ height: 18, width: 26 }} onClick={() => onMove(c.id, -1)} disabled={i === 0}><WIcon name="chevronLeft" size={13} style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="btn btn--ghost btn--icon" style={{ height: 18, width: 26 }} onClick={() => onMove(c.id, 1)} disabled={i === cues.length - 1}><WIcon name="chevronRight" size={13} style={{ transform: 'rotate(90deg)' }} /></button>
              </div>
              <button className="btn btn--ghost btn--icon btn--danger" style={{ height: 36, width: 36 }} onClick={() => onRemove(c.id)}><WIcon name="trash" size={16} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label style={cueChip}><span className="overline">BPM</span><input type="number" min="20" max="300" value={c.bpm} onChange={e => onUpdate(c.id, { bpm: Math.min(300, Math.max(20, +e.target.value || 120)) })} style={cueInput} /></label>
              <label style={cueChip}><span className="overline">Bars</span><input type="number" min="1" max="64" value={c.bars} onChange={e => onUpdate(c.id, { bars: +e.target.value || 8 })} style={{ ...cueInput, width: 38 }} /></label>
              <label style={cueChip}><span className="overline">Time</span>
                <select value={c.bpb} onChange={e => onUpdate(c.id, { bpb: +e.target.value })} style={cueInput}>
                  <option value={4}>4/4</option><option value={3}>3/4</option><option value={6}>6/8</option><option value={2}>2/4</option>
                </select>
              </label>
              <input value={c.note} onChange={e => onUpdate(c.id, { note: e.target.value })} placeholder="Note"
                style={{ flex: 1, minWidth: 90, height: 34, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-1)', fontSize: 13, padding: '0 10px', outline: 'none' }} />
            </div>
          </div>
        );
      })}
      <button className="btn btn--block" style={{ marginTop: 4 }} onClick={onAdd}><WIcon name="plus" size={18} /> Add cue</button>
    </div>
  );
}

/* ---- inline song add / edit (replaces the old setup page) ---- */
function SongEditor({ song, onSave, onClose }) {
  const init = song || { name: '', key: 'C', bpm: 120, bpb: 4, notes: '', clickSound: 'wood' };
  const [f, setF] = uS(init);
  const M = window.WIModal;
  const KEYS = window.WIKEYS;
  const Seg = window.WISegmented;
  const set = (patch) => setF(v => ({ ...v, ...patch }));
  const valid = (f.name || '').trim().length > 0;
  const commit = () => {
    if (!valid) return;
    onSave({
      name: f.name.trim(), key: f.key,
      bpm: Math.min(300, Math.max(20, +f.bpm || 120)),
      bpb: +f.bpb || 4, notes: (f.notes || '').trim(), clickSound: f.clickSound || 'wood',
    });
  };
  return (
    <M title={song ? 'Edit song' : 'Add song'} onClose={onClose}>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Song name</label>
        <input className="input" autoFocus value={f.name} placeholder="e.g. King of kings"
          onChange={e => set({ name: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={seChip}>
          <span className="overline">Key</span>
          <select className="mono" value={f.key} onChange={e => set({ key: e.target.value })} style={seSel}>
            {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label style={seChip}>
          <span className="overline">BPM</span>
          <input className="mono" type="number" min="20" max="300" value={f.bpm} onChange={e => set({ bpm: e.target.value })} style={{ ...seSel, width: 62 }} />
        </label>
        <label style={seChip}>
          <span className="overline">Time</span>
          <select className="mono" value={f.bpb} onChange={e => set({ bpb: +e.target.value })} style={seSel}>
            <option value={4}>4/4</option><option value={3}>3/4</option><option value={6}>6/8</option><option value={2}>2/4</option>
          </select>
        </label>
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Notes <span className="dim" style={{ fontWeight: 400 }}>· optional</span></label>
        <input className="input" value={f.notes} placeholder="e.g. starts without click, half-time feel"
          onChange={e => set({ notes: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <Seg label="Click sound" value={f.clickSound || 'wood'} onChange={(v) => set({ clickSound: v })}
          options={[['wood', 'Wood'], ['beep', 'Beep'], ['hihat', 'Hat'], ['cowbell', 'Bell']]} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" style={{ flex: 1 }} disabled={!valid} onClick={commit}>
          <WIcon name="check" size={18} /> {song ? 'Save changes' : 'Add to setlist'}
        </button>
      </div>
    </M>
  );
}

const seChip = { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 8px 0 12px', height: 48 };
const seSel = { height: 44, background: 'transparent', border: 0, color: 'var(--fg-1)', fontSize: 16, fontWeight: 700, outline: 'none', cursor: 'pointer' };

window.HostControl = HostControl;
window.WISegmented = Segmented;
