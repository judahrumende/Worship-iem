/* WorshipIEM — Live DAW (fullscreen)
   Multi-track view: every song sits on its OWN line (lane), with a track header
   on the left (number + name + key/bpm) and a clip on the timeline. Each song
   carries its own bars, click sound, time signature and voice cues. Drag lanes
   to reorder, number keys jump, space plays. A record/upload spoken-cue bar
   lives along the bottom. Exports window.LiveDaw. */

const { useState: ldS, useEffect: ldE, useRef: ldR, useMemo: ldM } = React;

const LD_PX_PER_BAR = 14;
const LD_TH_W = 212;           // track-header width
const LD_LANE_H = 92;          // lane height
const LD_RULER_H = 26;
const LD_HUE = (i) => [292, 330, 355, 25, 50, 268][i % 6]; // violet → pink → salmon → orange → amber → indigo (reference palette)

function ldClipBg(i, active) {
  const h = LD_HUE(i), h2 = (h + 14) % 360;
  return active
    ? `linear-gradient(180deg, oklch(0.82 0.17 ${h}), oklch(0.66 0.205 ${h2}))`
    : `linear-gradient(180deg, oklch(0.72 0.15 ${h}), oklch(0.58 0.17 ${h2}))`;
}

/* deterministic audio-style waveform so each clip reads like the reference DAW */
function ldWave(seed, count) {
  let x = 0; const s = (seed || 'x') + count;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const n = Math.max(20, Math.min(200, count));
  const out = []; let env = 0.5;
  for (let i = 0; i < n; i++) { env = Math.max(0.14, Math.min(1, env + (rnd() - 0.5) * 0.55)); out.push(env * (0.45 + rnd() * 0.55)); }
  return out;
}

/* inline click-to-edit number (used for BPM + bars in the transport) */
function LdNum({ value, onCommit, min, max, w }) {
  const [v, setV] = React.useState(String(value));
  React.useEffect(() => { setV(String(value)); }, [value]);
  const commit = () => {
    let n = parseInt(v, 10);
    if (isNaN(n)) { setV(String(value)); return; }
    n = Math.max(min, Math.min(max, n)); onCommit(n); setV(String(n));
  };
  return (
    <input className="ld-num" style={{ width: w }} value={v} inputMode="numeric"
      onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ''))}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); else if (e.key === 'Escape') { setV(String(value)); e.target.blur(); } }} />
  );
}

function LiveDaw(props) {
  const {
    session, setlist, activeId, playing, anchor, bpm, bpb, players, account,
    onActivate, onToggle, onReorder, onAddSong, onAddFromLibrary, onEditSong, onRemoveSong,
    onUpdateSong, onSetClick, onSetBpm, onSaveToLibrary, onSignIn,
    micOn, talking, onToggleMic, onTalkStart, onTalkEnd,
    onTempo, onTap, onClose,
  } = props;

  const [phx, setPhx] = ldS(0);          // playhead x within the timeline area
  const [dragId, setDragId] = ldS(null);
  const [overId, setOverId] = ldS(null);
  const [recording, setRecording] = ldS(false);
  const [recErr, setRecErr] = ldS('');

  const scrollRef = ldR(null);
  const dragFrom = ldR(null);
  const recRef = ldR(null);
  const audioRef = ldR(null);

  const PX = LD_PX_PER_BAR;
  const barsOf = (s) => Math.max(4, Math.min(256, s.bars || 32));

  // Initialize from persisted song.start fields; overrides take precedence during a drag session
  const [starts, setStarts] = ldS(() => {
    const m = {};
    if (setlist) setlist.forEach(s => { if (s.start != null) m[s.id] = s.start; });
    return m;
  });
  const layout = ldM(() => {
    let cum = 0; const def = {};
    setlist.forEach(s => { def[s.id] = cum; cum += barsOf(s); });
    const list = setlist.map((s, i) => {
      const b = barsOf(s);
      const start = Math.max(0, starts[s.id] != null ? starts[s.id] : (s.start != null ? s.start : def[s.id]));
      return { ...s, i, bars: b, start, left: start * PX, width: b * PX };
    });
    const totalBars = list.reduce((m, c) => Math.max(m, c.start + c.bars), 8);
    return { list, totalBars };
  }, [setlist, starts]);
  const songs = layout.list;
  const maxBars = layout.totalBars;
  const areaW = maxBars * PX;
  const activeClip = songs.find(c => c.id === activeId) || songs[0];
  const clipById = (id) => songs.find(c => c.id === id);
  const setStartOverride = (id, bar) => setStarts(s => ({ ...s, [id]: Math.max(0, bar) }));
  const reflow = () => {
    setStarts({});
    setlist.forEach(s => onUpdateSong(s.id, { start: null }));
  };

  /* playhead sweep within the active song's clip */
  const liveRef = ldR({});
  ldE(() => { liveRef.current = { activeClip, playing, anchor, bpm, bpb }; });
  ldE(() => {
    let raf = 0;
    const tick = () => {
      const { activeClip: ac, playing: pl, anchor: an, bpm: bp, bpb: bb } = liveRef.current;
      if (!ac || !pl) { setPhx(0); raf = requestAnimationFrame(tick); return; }
      const totalBeats = ac.bars * bb;
      const beats = (Date.now() - an) / (60000 / bp);
      const loop = ((beats % totalBeats) + totalBeats) % totalBeats;
      setPhx((loop / totalBeats) * ac.width);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* keep the active lane + clip in view (vertical and horizontal) */
  ldE(() => {
    const el = scrollRef.current; if (!el || !activeClip) return;
    const i = songs.findIndex(c => c.id === activeId);
    const top = LD_RULER_H + i * LD_LANE_H, padY = 16;
    if (top < el.scrollTop + padY) el.scrollTop = Math.max(0, top - padY);
    else if (top + LD_LANE_H > el.scrollTop + el.clientHeight - padY) el.scrollTop = top + LD_LANE_H - el.clientHeight + padY;
    const viewW = el.clientWidth - LD_TH_W, padX = 40;       // visible timeline width (heads are sticky)
    if (activeClip.left < el.scrollLeft + padX) el.scrollLeft = Math.max(0, activeClip.left - padX);
    else if (activeClip.left + activeClip.width > el.scrollLeft + viewW - padX) el.scrollLeft = activeClip.left + activeClip.width - viewW + padX;
  }, [activeId, songs.length, areaW]);

  const curBar = ldM(() => {
    if (!activeClip || !playing) return 0;
    const totalBeats = activeClip.bars * bpb;
    const beats = (Date.now() - anchor) / (60000 / bpm);
    const loop = ((beats % totalBeats) + totalBeats) % totalBeats;
    return Math.floor(loop / bpb);
  }, [activeClip, playing, phx, bpb, bpm, anchor]);

  /* shortcuts: Esc closes, arrows step (numbers + space handled by host) */
  ldE(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') { if (e.key === 'Escape') e.target.blur(); return; }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const step = (dir) => {
    const i = songs.findIndex(c => c.id === activeId);
    const n = songs[i + dir]; if (n) onActivate(n.id);
  };

  const onDrop = (toIdx) => {
    if (dragFrom.current != null && dragFrom.current !== toIdx) onReorder(dragFrom.current, toIdx);
    dragFrom.current = null; setDragId(null); setOverId(null);
  };
  const startResize = (e, c) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX, b0 = c.bars;
    const mv = (ev) => setBars(c.id, b0 + Math.round((ev.clientX - x0) / PX));
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  /* drag a clip horizontally to change WHERE the song sits in time */
  const startMove = (e, c) => {
    e.stopPropagation();
    const x0 = e.clientX, s0 = c.start; let moved = false; let lastBar = s0;
    const mv = (ev) => { const db = Math.round((ev.clientX - x0) / PX); if (db !== 0) { moved = true; lastBar = s0 + db; } setStartOverride(c.id, s0 + db); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) onUpdateSong(c.id, { start: Math.max(0, lastBar) }); else onActivate(c.id); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  /* 101+ bars = infinite (the song loops with no fixed end) */
  const setBars = (id, n) => {
    if (n > 100) onUpdateSong(id, { infinite: true, bars: 64 });
    else onUpdateSong(id, { infinite: false, bars: Math.max(4, Math.min(100, Math.round(n))) });
  };
  const addBars = (n) => { if (activeClip) setBars(activeClip.id, (activeClip.infinite ? 100 : activeClip.bars) + n); };

  /* ---- voice cues, stored on the song ---- */
  const cuesOf = (s) => (s && Array.isArray(s.voiceCues)) ? s.voiceCues : [];
  const addCue = (url, name, kind) => {
    if (!activeClip) return;
    onUpdateSong(activeClip.id, { voiceCues: [...cuesOf(activeClip), { id: uid(), bar: curBar, name, url, kind }] });
  };
  const removeCue = (songId, cueId) => {
    const s = clipById(songId); if (!s) return;
    onUpdateSong(songId, { voiceCues: cuesOf(s).filter(c => c.id !== cueId) });
  };
  const recordCue = async () => {
    if (recording && recRef.current) { recRef.current.stop(); return; }
    setRecErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); const chunks = []; recRef.current = mr;
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); addCue(URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })), 'Spoken cue', 'rec'); setRecording(false); };
      mr.start(); setRecording(true);
    } catch (e) { setRecErr('Microphone access was blocked.'); }
  };
  const uploadCue = (e) => { const f = e.target.files && e.target.files[0]; if (f) addCue(URL.createObjectURL(f), f.name.replace(/\.[^.]+$/, ''), 'file'); e.target.value = ''; };
  const previewCue = (c) => { try { if (audioRef.current) audioRef.current.pause(); const a = new Audio(c.url); audioRef.current = a; a.play(); } catch (e) {} };
  ldE(() => () => { try { if (recRef.current && recording) recRef.current.stop(); } catch (e) {} }, []);

  const pcount = players ? Object.keys(players).length : 0;
  const activeCues = cuesOf(activeClip);

  /* shared bar ruler (0..maxBars, every 4) */
  const ticks = ldM(() => { const out = []; for (let b = 0; b < maxBars; b += 4) out.push({ x: b * PX, label: b + 1, major: b % 16 === 0 }); return out; }, [maxBars]);

  return (
    <div className="ld">
      <div className="ld-top">
        <div className="ld-brand"><span className="g"><WIcon name="radio" size={16} /></span> WorshipIEM</div>
        <span className="ld-tag"><WIcon name="grip" size={13} /> Live DAW</span>
        <span className="ld-sep" />
        <span className="ld-name">{session.name}</span>
        <span className="ld-grow" />
        {account
          ? <button className="ld-iconbtn" onClick={() => window.WIAuth.logout()} title="Sign out"><WIcon name="user" size={15} /> {account}</button>
          : <button className="ld-iconbtn" onClick={onSignIn}><WIcon name="user" size={15} /> Sign in</button>}
        <span className="ld-sep" />
        <span className="ld-stat"><b>{bpm}</b> bpm</span>
        <span className="ld-stat">{setlist.length} songs · <b>{pcount}</b> in-ears</span>
        {micOn && <span className="ld-mic-ind"><span className="d" /> Mic on</span>}
        {playing && <span className="chip chip--live" style={{ height: 30 }}><span className="dot" />live</span>}
        <span className="ld-sep" />
        <button className="ld-iconbtn" onClick={onClose} title="Close (Esc)"><WIcon name="chevronLeft" size={16} /> Exit</button>
      </div>

      <div className="ld-body">
        <div className="ld-main">
          <div className="ld-scroll" ref={scrollRef}>
            {songs.length === 0 ? (
              <div className="ld-empty"><div className="inner">
                <h2 className="serif" style={{ fontSize: 26, marginBottom: 8 }}>An empty stage</h2>
                <p className="muted" style={{ marginBottom: 18 }}>Add songs to stack them as tracks. Each lands on its own line — reorder, cue, extend in bars, and play.</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn--primary btn--lg" onClick={onAddSong}><WIcon name="plus" size={20} /> Add a song</button>
                  <button className="btn btn--lg" onClick={onAddFromLibrary}><WIcon name="bookmark" size={18} /> From library</button>
                </div>
              </div></div>
            ) : (
              <div className="ld-lanes" style={{ width: LD_TH_W + areaW + 40 }}>
                {/* ruler */}
                <div className="ld-lanes-ruler" style={{ height: LD_RULER_H }}>
                  <div className="ld-ruler-corner" style={{ width: LD_TH_W }}><span className="ld-lanelabel" style={{ margin: 0 }}>Tracks</span></div>
                  {ticks.map((t, i) => (
                    <div key={i} className={'bk' + (t.major ? ' major' : '')} style={{ left: LD_TH_W + t.x }}><span>{t.label}</span></div>
                  ))}
                </div>

                {/* lanes */}
                {songs.map(c => {
                  const on = c.id === activeId;
                  const hot = c.i < 9 ? String(c.i + 1) : (c.i === 9 ? '0' : null);
                  return (
                    <div key={c.id} className={'ld-lane' + (on ? ' active' : '') + (overId === c.id ? ' dragover' : '')} style={{ height: LD_LANE_H }}
                      onClick={() => onActivate(c.id)}>
                      {/* track header — drag to reorder */}
                      <div className="ld-lanehead" style={{ width: LD_TH_W }}
                        draggable
                        onDragStart={() => { dragFrom.current = c.i; setDragId(c.id); }}
                        onDragOver={(e) => { e.preventDefault(); if (overId !== c.id) setOverId(c.id); }}
                        onDragLeave={() => setOverId(o => o === c.id ? null : o)}
                        onDrop={() => onDrop(c.i)}
                        onDragEnd={() => { setDragId(null); setOverId(null); }}>
                        <span className="key-cap" title={hot ? 'Press ' + hot : null}>{hot || (c.i + 1)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ld-lane-name">{c.name || 'Untitled'}</div>
                          <div className="ld-lane-meta">{c.key ? c.key + ' · ' : ''}{TS_LABEL[c.bpb] || '4/4'} · {c.bpm} · {c.clickSound || 'wood'}</div>
                        </div>
                        {on && playing && <span className="live-tag"><span className="d" />LIVE</span>}
                        <span className="grab" title="Drag to reorder"><WIcon name="grip2" size={16} /></span>
                      </div>
                      {/* timeline area */}
                      <div className="ld-lanearea" style={{ width: areaW }}>
                        <div className={'ld-clip' + (on ? ' active' : '') + (dragId === c.id ? ' dragging' : '') + (c.infinite ? ' ld-clip--inf' : '')}
                          style={{ left: c.left, width: c.width, background: ldClipBg(c.i, on), '--bar': PX + 'px', '--bar4': (PX * 4) + 'px' }}
                          onPointerDown={(e) => startMove(e, c)} onClick={(e) => e.stopPropagation()}>
                          <div className="grid" />
                          <svg className="ld-wave" viewBox="0 0 1000 100" preserveAspectRatio="none" style={{ color: on ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0.26)' }}>
                            {(() => { const w = ldWave(c.name, Math.round(c.bars * 2)); const bw = 1000 / w.length; return w.map((a, k) => { const h = Math.max(3, a * 92); return <rect key={k} x={k * bw + bw * 0.18} width={bw * 0.64} y={50 - h / 2} height={h} rx={Math.min(2, bw * 0.3)} fill="currentColor" />; }); })()}
                          </svg>
                          <span className="ld-clip-tag" style={{ color: on ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.5)' }}>{c.infinite ? '∞ loop' : c.bars + ' bars'}</span>
                          <span className="resize" onPointerDown={(e) => startResize(e, c)} title="Drag to add or trim bars" />
                        </div>
                        {/* voice-cue markers on this song's line */}
                        {cuesOf(c).map(cue => (
                          <div key={cue.id} className="ld-cue" style={{ left: c.left + Math.min(c.width - 30, cue.bar * PX) }} onClick={(e) => { e.stopPropagation(); previewCue(cue); }} title={cue.name}>
                            <span className="play"><WIcon name="play" size={11} /></span>
                            <span style={{ maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cue.name}</span>
                            <span className="x" onClick={(e) => { e.stopPropagation(); removeCue(c.id, cue.id); }}><WIcon name="x" size={10} /></span>
                          </div>
                        ))}
                        {/* playhead lives only on the active song — only one plays at a time */}
                        {on && <div className={'ld-playhead' + (playing ? '' : ' cued')} style={{ left: c.left + phx }} />}
                      </div>
                    </div>
                  );
                })}
                {/* small status cards in the blank space below the lanes */}
                <div className="ld-blank">
                  <div className="ld-mini">
                    <div className="ld-mini-h">Up next</div>
                    {(() => {
                      const i = songs.findIndex(c => c.id === activeId);
                      const nx = songs[i + 1];
                      return nx
                        ? <div className="ld-mini-up"><span className="nm">{nx.name || 'Untitled'}</span><span className="mt">{nx.key ? 'Key ' + nx.key + ' · ' : ''}{nx.bpm} bpm · {TS_LABEL[nx.bpb] || '4/4'}</span></div>
                        : <div className="ld-mini-up"><span className="end">End of set</span></div>;
                    })()}
                  </div>
                  <div className="ld-mini">
                    <div className="ld-mini-h">Band · {Object.values(players || {}).filter(p => p.ready).length}/{pcount} ready</div>
                    {pcount === 0
                      ? <div className="ld-mini-empty">No one connected yet</div>
                      : <div className="ld-mini-band">
                          {Object.entries(players).map(([id, p]) => (
                            <div key={id} className="ld-band-row"><span className={'ld-dot ' + (p.ready ? 'ok' : 'wait')} /><span className="nm">{p.name || 'Musician'}</span><span className="inst">{p.instrument || ''}</span></div>
                          ))}
                        </div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* bottom dock: spoken-cue bar + transport */}
          <div className="ld-dock">
            <div className="ld-cuebar">
              <span className="ld-cuebar-h"><WIcon name="mic" size={15} /> Voice cue</span>
              {activeClip && <span className="dim" style={{ fontSize: 12.5 }}>onto <span className="muted">{activeClip.name}</span> · bar {curBar + 1}</span>}
              <button className={'ld-tbtn' + (recording ? ' rec' : '')} onClick={recordCue} disabled={!activeClip}>
                {recording ? <><span className="ld-rec-dot" /> Stop recording</> : <><WIcon name="mic" size={16} /> Record</>}
              </button>
              <label className={'ld-tbtn' + (!activeClip ? ' off' : '')} style={{ cursor: activeClip ? 'pointer' : 'not-allowed' }}>
                <WIcon name="upload" size={16} /> Upload
                <input type="file" accept="audio/*" disabled={!activeClip} onChange={uploadCue} style={{ display: 'none' }} />
              </label>
              {recErr && <span style={{ color: 'var(--danger)', fontSize: 12.5 }}>{recErr}</span>}
              <div className="ld-cuechips">
                {activeCues.length === 0
                  ? <span className="dim" style={{ fontSize: 12.5 }}>No cues on this song yet.</span>
                  : activeCues.map(cue => (
                    <span key={cue.id} className="ld-cuechip">
                      <button className="play" onClick={() => previewCue(cue)} title="Play"><WIcon name="play" size={12} /></button>
                      <span className="nm">{cue.name}</span><span className="bar">bar {cue.bar + 1}</span>
                      <button className="x" onClick={() => removeCue(activeClip.id, cue.id)}><WIcon name="x" size={12} /></button>
                    </span>
                  ))}
              </div>
            </div>

            <div className="ld-transbar">
              <button className="ld-tbtn" onClick={() => step(-1)} title="Previous song (↑)" disabled={!activeClip}><WIcon name="chevronLeft" size={18} /></button>
              <button className={'ld-tbtn ld-tbtn--play' + (playing ? ' stop' : '')} onClick={onToggle} disabled={!activeClip}>
                <WIcon name={playing ? 'stop' : 'play'} size={20} /> {playing ? 'Stop' : 'Play'}
              </button>
              <button className="ld-tbtn" onClick={() => step(1)} title="Next song (↓)" disabled={!activeClip}><WIcon name="chevronRight" size={18} /></button>
              <span className="ld-tsep" />
              <button className="ld-tbtn" onClick={() => onTempo(bpm - 1)} title="Slower"><WIcon name="minus" size={16} /></button>
              <div className="ld-bpm"><LdNum value={bpm} onCommit={onTempo} min={20} max={300} w={44} /><span className="u">BPM</span></div>
              <button className="ld-tbtn" onClick={() => onTempo(bpm + 1)} title="Faster"><WIcon name="plus" size={16} /></button>
              <button className="ld-tbtn" onClick={onTap} title="Tap tempo"><WIcon name="hand" size={16} /></button>
              <span className="ld-tsep" />
              {activeClip
                ? <span className="ld-pos">Bar {curBar + 1} / {activeClip.infinite
                    ? <button className="ld-inf" title="Infinite loop — click to set a length" onClick={() => setBars(activeClip.id, 32)}>∞</button>
                    : <LdNum value={activeClip.bars} onCommit={(n) => setBars(activeClip.id, n)} min={4} max={999} w={40} />}</span>
                : <span className="ld-pos">—</span>}
              <span className="ld-hint">1–9 · Space</span>
              <span className="ld-tsep" />
              {micOn ? (
                <button className={'ld-ptt' + (talking ? ' on' : '')}
                  onPointerDown={onTalkStart} onPointerUp={onTalkEnd} onPointerLeave={onTalkEnd} onPointerCancel={onTalkEnd}
                  style={{ touchAction: 'none' }} title="Hold to talk to the band">
                  <WIcon name="mic" size={20} /> {talking ? 'On air — speaking' : 'Hold to talk'}
                </button>
              ) : (
                <button className="ld-tbtn" onClick={onToggleMic} title="Connect your microphone"><WIcon name="mic" size={16} /> Connect mic</button>
              )}
            </div>
          </div>
        </div>

        {/* right panel */}
        <div className="ld-side">
          {activeClip ? (
            <>
              <div className="ld-np-art" style={{ background: ldClipBg(activeClip.i, true) }}>
                <span className="ph" />
                <span className="lbl">{playing ? 'Now playing' : 'Cued'}</span>
              </div>
              <div>
                <div className="ld-np-title">{activeClip.name || 'Untitled'}</div>
                <div className="ld-np-meta" style={{ marginTop: 10 }}>
                  {activeClip.key && <span className="chip" style={{ height: 28 }}>Key {activeClip.key}</span>}
                  <span className="chip" style={{ height: 28 }}>{activeClip.bpm} bpm</span>
                </div>
                {activeClip.notes && <p className="ld-note" style={{ marginTop: 12 }}>{activeClip.notes}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="btn" style={{ height: 40, flex: 1 }} onClick={() => onEditSong(activeClip)}><WIcon name="pencil" size={16} /> Edit</button>
                  <button className="btn btn--ghost btn--icon btn--danger" style={{ height: 40, width: 44 }} onClick={() => onRemoveSong(activeClip.id)}><WIcon name="trash" size={17} /></button>
                </div>
                <button className="btn btn--primary btn--block" style={{ height: 42, marginTop: 8 }} onClick={() => onSaveToLibrary(activeClip)}>
                  <WIcon name="bookmark" size={16} /> Save to library
                </button>
              </div>

              {/* per-song click options */}
              <div className="ld-block">
                <span className="ld-block-h"><WIcon name="metronome" size={13} /> Click options · this song</span>
                <div className="ld-tempo-field">
                  <span className="ld-tempo-lbl">Tempo</span>
                  <LdNum value={activeClip.bpm} onCommit={(n) => onSetBpm(activeClip.id, n)} min={20} max={300} w={70} />
                  <span className="ld-tempo-unit">BPM</span>
                  <span style={{ flex: 1 }} />
                  <button className="ld-tempo-step" onClick={() => onSetBpm(activeClip.id, activeClip.bpm - 1)}><WIcon name="minus" size={15} /></button>
                  <button className="ld-tempo-step" onClick={() => onSetBpm(activeClip.id, activeClip.bpm + 1)}><WIcon name="plus" size={15} /></button>
                </div>
                <window.WISegmented label="Time signature" value={String(activeClip.bpb)} onChange={(v) => onSetClick(activeClip.id, { bpb: +v })}
                  options={[['4', '4/4'], ['3', '3/4'], ['6', '6/8'], ['2', '2/4']]} />
                <window.WISegmented label="Subdivision" value={activeClip.subdivision || 'none'} onChange={(v) => onSetClick(activeClip.id, { subdivision: v })}
                  options={[['none', 'Quarter'], ['8', '8ths'], ['triplet', 'Triplet'], ['16', '16ths']]} />
                <window.WISegmented label="Sound" value={activeClip.clickSound || 'wood'} onChange={(v) => { onSetClick(activeClip.id, { clickSound: v }); window.WIClick.setTimbre(v); window.WIClick.tick(true); }}
                  options={[['wood', 'Wood'], ['beep', 'Beep'], ['hihat', 'Hat'], ['cowbell', 'Bell']]} />
                <button className="btn btn--block" style={{ height: 42, ...(activeClip.accent !== false ? { background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--fg-1)' } : {}) }}
                  onClick={() => onSetClick(activeClip.id, { accent: activeClip.accent === false })}>Accent beat 1</button>
              </div>

              {/* length */}
              <div className="ld-block">
                <span className="ld-block-h"><WIcon name="grip" size={13} /> Length</span>
                {activeClip.infinite ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, textAlign: 'center' }}><span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>∞</span> <span className="dim" style={{ fontSize: 13 }}>infinite loop</span></div>
                    <button className="btn" style={{ height: 40 }} onClick={() => setBars(activeClip.id, 32)}>Set a length</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="btn btn--icon" style={{ height: 40, width: 44 }} onClick={() => addBars(-4)}><WIcon name="minus" size={16} /></button>
                    <div style={{ flex: 1, textAlign: 'center' }}><span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{activeClip.bars}</span> <span className="dim" style={{ fontSize: 13 }}>bars</span></div>
                    <button className="btn btn--icon" style={{ height: 40, width: 44 }} onClick={() => activeClip.bars >= 100 ? setBars(activeClip.id, 101) : addBars(4)}><WIcon name="plus" size={16} /></button>
                  </div>
                )}
                <p className="dim" style={{ fontSize: 12, margin: 0 }}>Drag the clip edge or type a bar count. Set 101 or more to make the song loop infinitely (∞).</p>
              </div>

              {/* setlist actions */}
              <div className="ld-block">
                <span className="ld-block-h"><WIcon name="list" size={13} /> Setlist</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ height: 42, flex: 1 }} onClick={onAddSong}><WIcon name="plus" size={16} /> Add song</button>
                  <button className="btn" style={{ height: 42, flex: 1 }} onClick={onAddFromLibrary}><WIcon name="bookmark" size={16} /> Library</button>
                </div>
                <button className="btn btn--block" style={{ height: 40 }} onClick={reflow}><WIcon name="arrowRight" size={15} /> Line up end to end</button>
                <p className="dim" style={{ fontSize: 12, margin: 0 }}>Songs run back to back by default. Drag a clip left or right to move where it sits, or drag a track header to reorder.</p>
              </div>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>No song selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}

window.LiveDaw = LiveDaw;
