/* WorshipIEM — Listener: join (name + instrument) + live in-ear */
const { useState: lS, useEffect: lE, useRef: lR, useCallback: lC } = React;

function getStore(k, d) { try { return localStorage.getItem('worshipiem:' + k) || d; } catch (e) { return d; } }
function setStore(k, v) { try { localStorage.setItem('worshipiem:' + k, v); } catch (e) {} }

/* ============================ JOIN ============================ */
function JoinScreen({ go, presetRoom }) {
  const [code, setCode] = lS(presetRoom || '');
  const [name, setNm] = lS(getStore('name', ''));
  const [inst, setInst] = lS(getStore('inst', 'Drums'));
  const valid = code.trim().length >= 4 && name.trim();
  const join = () => {
    if (!valid) return;
    setStore('name', name.trim()); setStore('inst', inst);
    go('#/listen?room=' + code.trim().toUpperCase());
  };
  return (
    <div className="screen">
      <TopBar right={<button className="btn btn--ghost" onClick={() => go('#/')}>Back</button>} />
      <div className="wrap fade-in" style={{ maxWidth: 480, paddingTop: 36, paddingBottom: 60, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ width: 60, height: 60, borderRadius: 17, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', color: 'var(--accent)' }}>
            <WIcon name="headphones" size={28} />
          </div>
          <h1 className="serif" style={{ fontSize: 32, marginBottom: 6 }}>Join the session</h1>
          <p className="muted">Enter the room code from your worship leader.</p>
        </div>

        <input className="codebox" value={code} maxLength={6} autoFocus
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={e => e.key === 'Enter' && valid && join()} placeholder="––––" />

        <div className="field" style={{ marginTop: 18 }}>
          <label>Your name</label>
          <input className="input" value={name} onChange={e => setNm(e.target.value)} placeholder="e.g. Sam" />
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>Your instrument</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 8 }}>
            {INSTRUMENTS.map(ins => {
              const on = ins === inst;
              return (
                <button key={ins} onClick={() => setInst(ins)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', cursor: 'pointer',
                    background: on ? 'var(--accent-soft)' : 'var(--surface-2)', textAlign: 'left',
                    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'), borderRadius: 'var(--r-md)',
                    color: on ? 'var(--fg-1)' : 'var(--fg-2)', fontWeight: on ? 600 : 500, fontSize: 13.5,
                    transition: 'all 160ms var(--ease)',
                  }}>
                  <WIcon name={instIcon(ins)} size={17} style={{ color: on ? 'var(--accent)' : 'var(--fg-3)', flex: 'none' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ins}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 24 }} disabled={!valid} onClick={join}>
          Join <WIcon name="arrowRight" size={20} />
        </button>
      </div>
    </div>
  );
}

/* ============================ LISTENER ============================ */
function Listener({ room, go }) {
  const [st, setSt] = lS(() => window.WISnap.load(room));
  const [authed, setAuthed] = lS(false);
  const [denied, setDenied] = lS(false);
  const [audioOn, setAudioOn] = lS(false);
  const [connected, setConnected] = lS(false);
  const [iAmReady, setIAmReady] = lS(false);
  const [clickVol, setClickVol] = lS(80);
  const [micVol, setMicVol] = lS(85);
  const [hostLevel, setHostLevel] = lS(0);
  const [vibrate, setVibrate] = lS(false);
  const [talking, setTalking] = lS(false);
  const [pwInput, setPwInput] = lS('');
  const [pwErr, setPwErr] = lS('');
  const [addressed, setAddressed] = lS(false);
  const [inCountIn, setInCountIn] = lS(false);

  const tx = lR(null);
  const myId = lR('L' + Math.random().toString(36).slice(2, 8));
  const myName = lR(getStore('name', 'Musician'));
  const myInst = lR(getStore('inst', 'Other'));
  const pw = lR('');
  const lastState = lR(0);
  const lvlDecay = lR(0);
  const vibrateRef = lR(false);
  const readyRef = lR(false);
  const talkTimer = lR(null);
  const vibSupported = typeof navigator !== 'undefined' && !!navigator.vibrate;

  // WebRTC refs
  const pcRef = lR(null);
  const remoteStreamRef = lR(null);
  const remoteGainRef = lR(null);
  const connectRemoteStreamRef = lR(null);

  lE(() => { vibrateRef.current = vibrate; }, [vibrate]);
  lE(() => { readyRef.current = iAmReady; }, [iAmReady]);

  const sendHello = () => tx.current && tx.current.send('hello', { id: myId.current, name: myName.current, instrument: myInst.current, ready: readyRef.current, password: pw.current });
  const ping = () => tx.current && tx.current.send('ping', { id: myId.current, name: myName.current, instrument: myInst.current, ready: readyRef.current });

  // Connect remote WebRTC audio stream to AudioContext
  const connectRemoteStream = lC((stream) => {
    const ctx = window.WIClick.getCtx();
    if (!ctx || ctx.state === 'suspended') { remoteStreamRef.current = stream; return; }
    if (remoteGainRef.current) return;
    try {
      const src = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = micVol / 100;
      src.connect(gain);
      gain.connect(ctx.destination);
      remoteGainRef.current = gain;
    } catch (e) {}
  }, [micVol]);
  connectRemoteStreamRef.current = connectRemoteStream;

  // Update remote gain when micVol changes
  lE(() => {
    if (remoteGainRef.current) {
      try {
        const ctx = window.WIClick.getCtx();
        if (ctx) remoteGainRef.current.gain.setTargetAtTime(micVol / 100, ctx.currentTime, 0.05);
      } catch (_) {}
    }
  }, [micVol]);

  lE(() => {
    const t = new window.WITransport(room, 'listener');
    tx.current = t;
    t.on('state', (s) => { setSt(s); lastState.current = Date.now(); setConnected(true); });
    t.on('level', (p) => {
      const targeted = p && Array.isArray(p.targets) && p.targets.length > 0;
      if (targeted && !p.targets.includes(myId.current)) {
        setHostLevel(0); setAddressed(false); return;
      }
      setAddressed(targeted);
      setHostLevel(p && p.level ? p.level : 0);
      lvlDecay.current = Date.now();
    });
    t.on(‘granted’, () => { setAuthed(true); setDenied(false); setPwErr(‘’); });
    t.on(‘denied’, () => { setDenied(true); setAuthed(false); setPwErr(pw.current ? "That password didn’t match. Try again." : ‘’); });

    // WebRTC: receive offer from host
    t.on('rtc-offer', async (p) => {
      if (!p || !p.sdp) return;
      const iceConfig = window.WIIceConfig || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      if (pcRef.current) { try { pcRef.current.close(); } catch (_) {} }
      remoteGainRef.current = null;
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;
      pc.onicecandidate = (e) => {
        if (e.candidate && tx.current)
          tx.current.send('rtc-ice', { id: myId.current, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const stream = e.streams && e.streams[0];
        if (stream) connectRemoteStreamRef.current(stream);
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        tx.current && tx.current.send('rtc-answer', { id: myId.current, sdp: pc.localDescription });
      } catch (err) { console.warn('WebRTC answer error:', err); }
    });

    // WebRTC: receive ICE candidate from host
    t.on('rtc-ice', async (p) => {
      if (pcRef.current && p && p.candidate) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(p.candidate)); } catch (_) {}
      }
    });

    sendHello();
    const pingId = setInterval(ping, 3000);
    const stale = setInterval(() => {
      if (Date.now() - lastState.current > 7000) setConnected(false);
      if (Date.now() - lvlDecay.current > 400) { setHostLevel(0); setAddressed(false); }
    }, 1000);
    window.addEventListener('beforeunload', () => t.send('bye', { id: myId.current }));
    return () => {
      clearInterval(pingId); clearInterval(stale); clearInterval(talkTimer.current);
      t.send('bye', { id: myId.current }); t.close();
      if (pcRef.current) { try { pcRef.current.close(); } catch (_) {} pcRef.current = null; }
    };
  }, [room]);

  /* push transport to local click engine */
  lE(() => {
    if (!audioOn || !st) return;
    window.WIClick.setTimbre(st.timbre || 'wood');
    window.WIClick.setSubdivision(st.subdivision || 'none');
    window.WIClick.setAccent(st.accent !== false);
    window.WIClick.setTransport({ playing: !!st.playing, anchor: st.anchor || 0, bpm: st.bpm || 120, beatsPerBar: st.bpb || 4 });
  }, [audioOn, st && st.playing, st && st.anchor, st && st.bpm, st && st.bpb, st && st.timbre, st && st.subdivision, st && st.accent]);

  lE(() => {
    if (!(st && st.playing && st.countInBars > 0 && Date.now() < (st.anchor || 0))) {
      setInCountIn(false); return;
    }
    setInCountIn(true);
    const id = setInterval(() => {
      if (Date.now() >= (st.anchor || 0)) { setInCountIn(false); clearInterval(id); }
    }, 50);
    return () => clearInterval(id);
  }, [st && st.anchor, st && st.playing, st && st.countInBars]);

  lE(() => {
    const master = st ? (st.clickVol ?? 80) : 80;
    window.WIClick.setVolume((master / 100) * (clickVol / 100));
  }, [clickVol, st && st.clickVol, audioOn]);

  /* vibration on beat 1 */
  lE(() => {
    if (!audioOn) return;
    window.WIClick.onBeat = (bib) => { if (vibrateRef.current && bib === 0 && navigator.vibrate) navigator.vibrate(45); };
    return () => { window.WIClick.onBeat = null; };
  }, [audioOn]);

  const enterAudio = async () => {
    try { await window.WIClick.resume(); } catch (e) {}
    setAudioOn(true);
    if (st) window.WIClick.setTransport({ playing: !!st.playing, anchor: st.anchor || 0, bpm: st.bpm || 120, beatsPerBar: st.bpb || 4 });
    // Connect any pending remote stream
    if (remoteStreamRef.current) {
      connectRemoteStream(remoteStreamRef.current);
      remoteStreamRef.current = null;
    }
  };

  const submitPw = () => { pw.current = pwInput.trim(); setPwErr(''); setDenied(false); sendHello(); };
  const toggleReady = () => { setIAmReady(v => { readyRef.current = !v; ping(); return !v; }); };

  /* talk-back to host */
  const startTalk = () => {
    setTalking(true);
    clearInterval(talkTimer.current);
    talkTimer.current = setInterval(() => {
      tx.current && tx.current.send('talkreq', { id: myId.current, name: myName.current, level: 0.45 + Math.random() * 0.4 });
    }, 120);
  };
  const stopTalk = () => { setTalking(false); clearInterval(talkTimer.current); tx.current && tx.current.send('talkreq', { id: myId.current, name: myName.current, level: 0 }); };

  const activeSong = st && st.setlist ? st.setlist.find(s => s.id === st.activeId) : null;
  const speaking = (st && st.micOn) && hostLevel * (micVol / 100) > 0.04;
  const bpb = (st && st.bpb) || 4;

  /* ---- password gate ---- */
  const pwRequired = (st && st.needsPassword) || denied;
  if (pwRequired && !authed) {
    return (
      <div className="screen"><TopBar sub={st ? '· ' + (st.sessionName || '') : ''} />
        <div className="wrap fade-in" style={{ maxWidth: 420, margin: '0 auto', paddingTop: 60, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 17, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', color: 'var(--accent)' }}><WIcon name="lock" size={26} /></div>
          <h1 className="serif" style={{ fontSize: 28, marginBottom: 8 }}>This session is locked</h1>
          <p className="muted" style={{ marginBottom: 22 }}>Enter the password your worship leader set for room {room}.</p>
          <input className="input" type="password" value={pwInput} autoFocus onChange={e => setPwInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitPw()} placeholder="Password" style={{ textAlign: 'center' }} />
          {pwErr && <p style={{ color: 'var(--danger)', fontSize: 13.5, marginTop: 10 }}>{pwErr}</p>}
          <button className="btn btn--primary btn--lg btn--block" style={{ marginTop: 18 }} onClick={submitPw}>Unlock <WIcon name="arrowRight" size={20} /></button>
        </div>
      </div>
    );
  }

  /* ---- audio gate ---- */
  if (!audioOn) {
    return (
      <div className="screen"><TopBar sub={st ? '· ' + (st.sessionName || '') : ''} />
        <div className="wrap fade-in" style={{ maxWidth: 460, margin: '0 auto', paddingTop: 56, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--accent)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center', margin: '0 auto 22px' }}><WIcon name="headphones" size={34} /></div>
          <h1 className="serif" style={{ fontSize: 30, marginBottom: 8 }}>You're in room {room}</h1>
          <p className="muted" style={{ marginBottom: 30 }}>Put your in-ears in, then tap below. Mobile browsers only start audio after a tap — this is the one we need.</p>
          <button className="btn btn--primary btn--lg btn--block" onClick={enterAudio}><WIcon name="play" size={22} /> Tap to listen</button>
          <p className="dim" style={{ fontSize: 13, marginTop: 16 }}>{st ? 'Connected to the leader.' : 'Waiting for the worship leader to start…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar live={connected} sub={st ? '· ' + (st.sessionName || '') : ''} right={
        <span className={'chip ' + (connected ? 'chip--ok' : '')}><span className="dot" />{connected ? 'Connected' : 'Reconnecting'}</span>
      } />

      <div className="wrap" style={{ maxWidth: 540, margin: '0 auto', paddingTop: 22, paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center', flex: 1 }}>

        <div style={{ textAlign: 'center' }}>
          <div className="overline" style={{ color: st && st.playing ? 'var(--accent)' : 'var(--fg-3)' }}>{st && st.playing ? (st.activeCue ? 'Click live · ' + st.activeCue : 'Click live') : (st ? 'Up next' : 'Standing by')}</div>
          <h1 className="serif" style={{ fontSize: 34, marginTop: 6 }}>{activeSong ? activeSong.name : (st ? 'Waiting for a song' : 'Waiting for the leader')}</h1>
          {activeSong && (activeSong.key || activeSong.notes) && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              {activeSong.key && <span className="chip" style={{ height: 26 }}>Key {activeSong.key}</span>}
              {activeSong.notes && <span className="chip" style={{ height: 26, color: 'var(--accent)', borderColor: 'rgba(224,122,85,0.3)' }}>{activeSong.notes}</span>}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <Metronome playing={!!(st && st.playing)} anchor={(st && st.anchor) || 0} bpm={(st && st.bpm) || 120} beatsPerBar={bpb} size={300} />
          {inCountIn && (
            <CountInOverlay active={true} anchor={(st && st.anchor) || 0} bpm={(st && st.bpm) || 120}
              beatsPerBar={bpb} bars={(st && st.countInBars) || 1} onDone={() => setInCountIn(false)} />
          )}
        </div>
        <div className="mono muted" style={{ fontSize: 15 }}>{TS_LABEL[bpb] || '4/4'} · {(st && st.bpm) || '—'} bpm{st && st.subdivision && st.subdivision !== 'none' ? ' · ' + SUBDIV_LABEL[st.subdivision] : ''}</div>
        {addressed && (
          <div style={{
            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
            borderRadius: 'var(--r-md)', padding: '8px 14px', width: '100%',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flex: 'none', animation: 'fadein 0s' }} />
            Leader is talking to you
            <span className="dim" style={{ fontWeight: 400, marginLeft: 'auto', fontSize: 13 }}>Just for you</span>
          </div>
        )}

        {/* ready + vibrate */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button className={'btn btn--lg ' + (iAmReady ? 'btn--primary' : '')} style={{ flex: 1 }} onClick={toggleReady}>
            <WIcon name="check" size={20} /> {iAmReady ? "You're ready" : "I'm ready"}
          </button>
          <button className="btn btn--lg btn--icon" title="Vibrate on beat 1" onClick={() => setVibrate(v => !v)}
            style={{ width: 60, ...(vibrate ? { background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--accent)' } : {}) }} disabled={!vibSupported}>
            <WIcon name="bell" size={20} />
          </button>
        </div>
        {vibrate && vibSupported && <div className="dim" style={{ fontSize: 12.5, marginTop: -10 }}>Your phone buzzes on beat 1 — handy with one earbud out.</div>}
        {!vibSupported && <div className="dim" style={{ fontSize: 12, marginTop: -10 }}>Vibration isn't supported in this browser (works on Android Chrome).</div>}

        {/* leader speaking */}
        <div className="card" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, opacity: st && st.micOn ? 1 : 0.55 }}>
          <span style={{
            width: 44, height: 44, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: speaking ? 'var(--accent)' : 'var(--surface-2)', color: speaking ? 'var(--on-accent)' : 'var(--fg-3)',
            border: '1px solid ' + (speaking ? 'var(--accent)' : 'var(--border)'),
            boxShadow: speaking ? '0 0 0 ' + (4 + hostLevel * 14) + 'px var(--accent-soft)' : 'none',
            transition: 'background 120ms, box-shadow 80ms linear',
          }}><WIcon name={st && st.micOn ? 'mic' : 'micOff'} size={20} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{st && st.micOn ? (speaking ? 'Leader is talking' : 'Leader mic is open') : 'Leader mic is off'}</div>
            <div className="meter" style={{ marginTop: 7 }}><i style={{ width: (st && st.micOn ? hostLevel * (micVol / 100) * 100 : 0) + '%' }} /></div>
          </div>
        </div>

        {/* personal mix */}
        <div className="card" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span className="overline"><WIcon name="sliders" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Your in-ear mix</span>
          <MixSlider icon="metronome" label="Click" value={clickVol} onChange={setClickVol} accent />
          <MixSlider icon="volume" label="Leader's voice" value={micVol} onChange={setMicVol} accent />
          <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>Only you hear this mix. The tempo and song are set by the leader.</p>
        </div>

        {/* talk back */}
        <div className="card" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="overline"><WIcon name="mic" size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Talk back to the leader</span>
          <button onPointerDown={startTalk} onPointerUp={stopTalk} onPointerLeave={stopTalk}
            className={'btn btn--lg btn--block ' + (talking ? 'btn--primary' : '')} style={{ height: 60, userSelect: 'none', touchAction: 'none' }}>
            <WIcon name="mic" size={22} /> {talking ? 'On air — speaking' : 'Hold to talk'}
          </button>
          <p className="dim" style={{ fontSize: 12, margin: 0 }}>The leader sees you're talking; on a live server your voice routes back over the same channel.</p>
        </div>
      </div>
    </div>
  );
}

window.JoinScreen = JoinScreen;
window.Listener = Listener;
