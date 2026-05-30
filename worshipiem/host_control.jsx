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
  const [countInBars, setCountInBars] = uS(0);  // 0=off, 1=1-bar, 2=2-bar
  const [counting, setCounting] = uS(false);
  const [timbre, setTimbre] = uS('wood');
  const [subdivision, setSubdivision] = uS('none');
  const [accent, setAccent] = uS(true);
  const [rampOn, setRampOn] = uS(false);
  const [rampStart, setRampStart] = uS(60);
  const [micOn, setMicOn] = uS(false);
  const [micLevel, setMicLevel] = uS(0);
  const [micLabel, setMicLabel] = uS('');
  const [micErr, setMicErr] = uS('');
  const [pttMode, setPttMode] = uS('open');   // open | ptt
  const [holding, setHolding] = uS(false);
  const [ready, setReady] = uS(false);
  const [players, setPlayers] = uS({});
  const [talkers, setTalkers] = uS({});
  const [tab, setTab] = uS('setlist');         // setlist | players
  const [advanced, setAdvanced] = uS(false);
  const [activeCueId, setActiveCueId] = uS(null);
  const [talkTargets, setTalkTargets] = uS([]);

  const tx = uR(null);
  const tapTimes = uR([]);
  const lvlThrottle = uR(0);
  const rampTimer = uR(null);
  const dragFrom = uR(null);
  // live refs for async (ramp / ptt)
  const aRef = uR(anchor), bRef = uR(bpm), pRef = uR(playing), bpbRef = uR(bpb);
  const pttRef = uR(pttMode), holdRef = uR(holding), micVolRef = uR(micVol);
  // ref for players so toggleMic closure can read current value
  const playersRef = uR({});
  const broadcastRef = uR(null);
  const targetsRef = uR([]);
  uE(() => { aRef.current = anchor; bRef.current = bpm; pRef.current = playing; bpbRef.current = bpb; pttRef.current = pttMode; holdRef.current = holding; micVolRef.current = micVol; targetsRef.current = talkTargets; });
  uE(() => { playersRef.current = players; }, [players]);

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
      see(p); broadcastRef.current && broadcastRef.current();
      if (window.WIMic.active) window.WIMic.addListener(p.id);
    });
    t.on('ping', see);
    t.on('bye', (p) => {
      if (p && p.id) {
        setPlayers(prev => { const c = { ...prev }; delete c[p.id]; return c; });
        window.WIMic.removeListener(p.id);
      }
    });
    t.on('talkreq', (p) => p && p.id && setTalkers(prev => ({ ...prev, [p.id]: { name: p.name || 'Musician', level: p.level || 0, t: Date.now() } })));
    const prune = setInterval(() => {
      const now = Date.now();
      setPlayers(prev => { let ch = false; const c = { ...prev }; for (const k in c) if (now - c[k].t > 8000) { delete c[k]; ch = true; } return ch ? c : prev; });
      setTalkers(prev => { let ch = false; const c = { ...prev }; for (const k in c) if (now - c[k].t > 700) { delete c[k]; ch = true; } return ch ? c : prev; });
    }, 600);
    return () => { clearInterval(prune); t.close(); };
  }, [room]);

  const wiNow = () => window.WIClock ? window.WIClock.now() : Date.now();
  const leadMs = (tempo, beats) => countInBars > 0 ? countInBars * beats * (60000 / tempo) : 0;
  const stateObj = () => {
    const s = setlist.find(x => x.id === activeId);
    const cue = s && s.cues && s.cues.find(c => c.id === activeCueId);
    return {
      sessionName: session.name, needsPassword: !!session.password, setlist, activeId, playing, anchor, bpm, bpb,
      clickVol, micVol, micOn, timbre, subdivision, accent, pttMode, countInBars,
      activeCue: cue ? cue.name : null, ts: Date.now(),
    };
  };
  const broadcast = () => { if (tx.current) tx.current.send('state', stateObj()); };
  broadcastRef.current = broadcast;

  uE(() => { window.WIClick.setTransport({ playing, anchor, bpm, beatsPerBar: bpb }); }, [playing, anchor, bpm, bpb, ready]);
  uE(() => { window.WIClick.setVolume(clickVol / 100); }, [clickVol]);
  uE(() => { window.WIClick.setTimbre(timbre); }, [timbre]);
  uE(() => { window.WIClick.setSubdivision(subdivision); }, [subdivision]);
  uE(() => { window.WIClick.setAccent(accent); }, [accent]);
  uE(() => { broadcast(); window.WISnap.save(room, stateObj()); },
    [activeId, playing, anchor, bpm, bpb, clickVol, micVol, micOn, timbre, subdivision, accent, pttMode, setlist, activeCueId, countInBars]);

  /* ---- PTT state effect — enable/disable mic tracks ---- */
  uE(() => {
    if (window.WIMic.active) {
      window.WIMic.setPttEnabled(pttMode !== 'ptt' || holding);
    }
  }, [pttMode, holding, micOn]);

  /* ---- tempo helpers (phase-preserving) ---- */
  const reanchorFor = (newBpm) => {
    const now = wiNow();
    const oldBeatMs = 60000 / bRef.current;
    const idx = (now - aRef.current) / oldBeatMs;
    return now - idx * (60000 / newBpm);
  };
  const setTempo = (nb) => {
    nb = Math.min(300, Math.max(20, Math.round(nb)));
    if (pRef.current) setAnchor(reanchorFor(nb));
    setBpm(nb);
  };

  /* ---- transport actions ---- */
  const start = async () => {
    await ensureAudio();
    const target = activeSong ? activeSong.bpm : bpm;
    clearInterval(rampTimer.current);
    if (rampOn) {
      const s0 = Math.min(rampStart, target);
      setBpm(s0); bRef.current = s0;
      const a = wiNow(); setAnchor(a); aRef.current = a; setPlaying(true);
      const t0 = wiNow(), dur = 12000;
      rampTimer.current = setInterval(() => {
        const k = Math.min(1, (wiNow() - t0) / dur);
        const nb = Math.round(s0 + (target - s0) * k);
        const na = reanchorFor(nb);
        setAnchor(na); aRef.current = na; setBpm(nb); bRef.current = nb;
        if (k >= 1) { clearInterval(rampTimer.current); }
      }, 180);
    } else {
      setBpm(target);
      const a = wiNow() + leadMs(target, bpb);
      setAnchor(a); aRef.current = a; setPlaying(true);
      if (countInBars > 0) setCounting(true);
    }
  };
  const stop = () => { clearInterval(rampTimer.current); setPlaying(false); setCounting(false); setActiveCueId(null); };
  const toggle = () => { playing ? stop() : start(); };

  const activate = (id) => {
    const s = setlist.find(x => x.id === id); if (!s) return;
    clearInterval(rampTimer.current);
    setActiveId(id); setActiveCueId(null); setBpm(s.bpm); setBpb(s.bpb);
    if (pRef.current) { const a = wiNow() + leadMs(s.bpm, s.bpb); setAnchor(a); aRef.current = a; if (countInBars > 0) setCounting(true); }
  };
  const nextSong = () => {
    const i = setlist.findIndex(s => s.id === activeId);
    if (i < setlist.length - 1) activate(setlist[i + 1].id);
  };
  const reorder = (from, to) => {
    if (from == null || from === to) return;
    setSetlist(s => { const c = s.slice(); const [m] = c.splice(from, 1); c.splice(to, 0, m); return c; });
  };

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
    const cueAnchor = wiNow() + leadMs(cue.bpm || bpm, cue.bpb || bpb);
    setAnchor(cueAnchor); aRef.current = cueAnchor; setPlaying(true);
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
      Object.keys(playersRef.current).forEach(pid => window.WIMic.addListener(pid));
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

  uE(() => {
    setTalkTargets(t => {
      const f = t.filter(id => players[id]);
      return f.length === t.length ? t : f;
    });
  }, [players]);

  const pcount = Object.keys(players).length;
  const readyCount = Object.values(players).filter(p => p.ready).length;
  const talkerList = Object.values(talkers).filter(t => t.level > 0.04);

  return (
    <div className="screen">
      <TopBar live sub={'· ' + session.name} right={
        <>
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
            <button className="btn btn--ghost" style={{ position: 'absolute', top: 14, right: 14, height: 34, fontSize: 13.5 }} onClick={() => advanced ? setAdvanced(false) : goAdvanced()} disabled={!activeSong}>
              {advanced ? <><WIcon name="chevronLeft" size={15} /> Simple</> : <><WIcon name="grip" size={15} /> Advanced</>}
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
                  <Metronome playing={playing} anchor={anchor} bpm={bpm} beatsPerBar={bpb} size={252} />
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
                <WIcon name="metronome" size={18} /> {countInBars === 0 ? 'Count-in' : countInBars === 1 ? '1-bar count-in' : '2-bar count-in'}
              </button>
            </div>
          </div>

          {/* click options */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span className="overline"><WIcon name="metronome" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Click options</span>
            <Segmented label="Time signature" value={String(bpb)} onChange={(v) => { setBpb(+v); if (pRef.current) setAnchor(wiNow()); }}
              options={[['4', '4/4'], ['3', '3/4'], ['6', '6/8'], ['2', '2/4']]} />
            <Segmented label="Subdivision" value={subdivision} onChange={setSubdivision}
              options={[['none', 'Quarter'], ['8', '8ths'], ['triplet', 'Triplet'], ['16', '16ths']]} />
            <Segmented label="Sound" value={timbre} onChange={(v) => { setTimbre(v); window.WIClick.setTimbre(v); window.WIClick.tick(true); }}
              options={[['wood', 'Wood'], ['beep', 'Beep'], ['hihat', 'Hat'], ['cowbell', 'Bell']]} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" style={{ flex: 1, ...(accent ? activeBtn : {}) }} onClick={() => setAccent(a => !a)}>Accent beat 1</button>
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
                {setlist.map((s, i) => {
                  const on = s.id === activeId;
                  return (
                    <div key={s.id} draggable
                      onDragStart={() => { dragFrom.current = i; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { reorder(dragFrom.current, i); dragFrom.current = null; }}
                      onClick={() => activate(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer',
                        background: on ? 'var(--accent-soft)' : 'transparent', borderTop: '1px solid var(--border)',
                        borderLeft: '3px solid ' + (on ? 'var(--accent)' : 'transparent'), transition: 'background 180ms var(--ease)',
                      }}>
                      <span style={{ color: 'var(--fg-3)', cursor: 'grab', display: 'flex' }} onClick={e => e.stopPropagation()}><WIcon name="grip2" size={16} /></span>
                      <span className="mono" style={{ width: 18, color: on ? 'var(--accent)' : 'var(--fg-3)', fontWeight: 700 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: on ? 600 : 500, fontSize: 16, color: on ? 'var(--fg-1)' : 'var(--fg-2)' }}>{s.name}</div>
                        {s.notes && <div className="dim" style={{ fontSize: 12, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.notes}</div>}
                      </div>
                      {on && playing && <span className="chip chip--live" style={{ height: 24 }}><span className="dot" />live</span>}
                      {s.key && <span className="mono dim" style={{ fontSize: 13, fontWeight: 600 }}>{s.key}</span>}
                      <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: on ? 'var(--fg-1)' : 'var(--fg-3)' }}>{s.bpm}</span>
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
              {micOn && pttMode === 'open' && <span className="chip chip--live" style={{ height: 26 }}><span className="dot" />on air</span>}
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
                      <TalkChip name="Whole band" icon="users" active={talkTargets.length === 0} onClick={() => setTalkTargets([])} />
                      {Object.entries(players).map(([id, p]) => (
                        <TalkChip key={id} name={p.name} icon={instIcon(p.instrument)}
                          active={talkTargets.includes(id)}
                          onClick={() => setTalkTargets(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id])} />
                      ))}
                    </div>
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
    </div>
  );
}

const activeBtn = { background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--fg-1)' };

function TalkChip({ name, icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px',
      borderRadius: 'var(--r-pill)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
      border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
      color: active ? 'var(--fg-1)' : 'var(--fg-2)',
      transition: 'all 140ms var(--ease)',
    }}>
      <WIcon name={icon} size={13} />{name}
    </button>
  );
}

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

window.HostControl = HostControl;
window.WISegmented = Segmented;
