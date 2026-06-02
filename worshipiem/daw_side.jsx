/* WorshipIEM — Advanced DAW side panels: app rail, lyrics, voice composer */
const { useState: sS, useRef: sR, useEffect: sE } = React;

function fmtT(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/* ---------------- left app rail ---------------- */
function AppRail({ nav, onNav }) {
  const items = [['create', 'Create', 'music'], ['library', 'Library', 'list'], ['discover', 'Discover', 'radio']];
  return (
    <div className="rail">
      <div className="rail-logo">
        <span className="glyph"><WIcon name="headphones" size={16} /></span>
        <b>WorshipIEM</b>
      </div>
      <div className="rail-nav">
        {items.map(([id, label, icon]) => (
          <button key={id} className={'rail-item' + (nav === id ? ' on' : '')} onClick={() => onNav(id)}>
            <WIcon name={icon} size={18} /> {label}
          </button>
        ))}
      </div>
      <div className="rail-spacer" />
      <div className="rail-credits">
        <WIcon name="bell" size={14} /> 16.9k in-ear minutes
      </div>
      <div className="rail-user">
        <span className="rail-ava">WL</span>
        <span style={{ minWidth: 0 }}>
          <span className="ru-name">Worship lead</span>
          <span className="ru-mail">grace@city.church</span>
        </span>
      </div>
    </div>
  );
}

/* ---------------- right lyrics panel ---------------- */
function LyricsPanel({ song, sections, curIdx, posSec, onSeek, query, onQuery, results, onPick }) {
  const [open, setOpen] = sS(false);
  const cur = sections[curIdx] || {};
  const bodyRef = sR(null);
  const activeRef = sR(null);
  sE(() => { if (activeRef.current && bodyRef.current) { const a = activeRef.current, b = bodyRef.current; const top = a.offsetTop - b.clientHeight / 2 + a.clientHeight / 2; b.scrollTo({ top, behavior: 'smooth' }); } }, [curIdx]);

  return (
    <div className="lyrics">
      <div className="ly-head">
        <div className="ly-art" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="overline">Now rehearsing</div>
          <div className="ly-title serif">{song.title}</div>
          <div className="ly-artist">{song.artist}</div>
        </div>
      </div>

      <div className="ly-stats">
        <span className="chip" style={{ height: 26 }}>Key {song.key}</span>
        <span className="chip" style={{ height: 26 }}>{song.bpm} bpm</span>
        <span className="chip" style={{ height: 26 }}>{song.ts}</span>
        <span className="chip" style={{ height: 26 }}>{fmtT(sections.reduce((a, s) => a + s.secs, 0))}</span>
      </div>

      {/* search */}
      <div className="ly-search">
        <WIcon name="link" size={15} style={{ color: 'var(--fg-3)', flex: 'none' }} />
        <input value={query} onFocus={() => setOpen(true)} onChange={e => { onQuery(e.target.value); setOpen(true); }}
          placeholder="Search a song to pull timed lyrics…" />
        {open && (
          <div className="ly-results" onMouseLeave={() => setOpen(false)}>
            {results.length === 0 && <div className="ly-res dim" style={{ cursor: 'default' }}>No public-domain match</div>}
            {results.map(r => (
              <div key={r.id} className="ly-res" onClick={() => { onPick(r.id); setOpen(false); }}>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                <span className="dim" style={{ fontSize: 12 }}>{r.artist} · {r.year}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* timed sections */}
      <div className="ly-body" ref={bodyRef}>
        {sections.map((s, i) => {
          const on = i === curIdx;
          let lineIdx = -1;
          if (on && s.lyrics.length) { const p = (posSec - s.startSec) / s.secs; lineIdx = Math.max(0, Math.min(s.lyrics.length - 1, Math.floor(p * s.lyrics.length))); }
          return (
            <div key={i} ref={on ? activeRef : null} className={'ly-sec' + (on ? ' on' : '')} onClick={() => onSeek(i)}>
              <div className="ly-sec-head">
                <span className="ly-sec-name" style={{ color: s.color }}>[{s.name}{s.note ? ' — ' + s.note : ''}]</span>
                <span className="ly-sec-time mono">{fmtT(s.secs)}</span>
              </div>
              {s.lyrics.length === 0
                ? <div className="ly-instr">instrumental</div>
                : s.lyrics.map((ln, j) => <div key={j} className={'ly-line' + (on && j === lineIdx ? ' now' : '')}>{ln}</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- voice cue composer ---------------- */
function VoiceComposer({ value, onChange, onPlace, onPreview, voice, onVoice, phrases, onSave, hasSpeech }) {
  const drag = (text) => (e) => { e.dataTransfer.setData('text/plain', text); e.dataTransfer.effectAllowed = 'copy'; };
  const text = value.trim();
  return (
    <div className="composer">
      <span className="overline" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}><WIcon name="mic" size={13} /> Voice cue</span>
      <input className="comp-in" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text) onPlace(text); }}
        placeholder="Type a cue — “Going to the bridge”, then drag it onto the Voice track →" />

      {text && (
        <span className="comp-pill" draggable onDragStart={drag(text)} title="Drag onto the Voice track, or click to drop at the playhead" onClick={() => onPlace(text)}>
          <WIcon name="grip2" size={13} /> {text.length > 22 ? text.slice(0, 22) + '…' : text}
        </span>
      )}

      <button className="tbtn" disabled={!text} onClick={() => onPreview(text)} title="Hear it"><WIcon name="play" size={14} /></button>
      <button className="tbtn" disabled={!text} onClick={() => onSave(text)} title="Save phrase"><WIcon name="plus" size={14} /></button>

      <span className="sb-sep" style={{ height: 22 }} />
      <div className="comp-saved">
        {phrases.map(p => (
          <span key={p} className="comp-chip" draggable onDragStart={drag(p)} onClick={() => onPlace(p)} title="Drag onto the Voice track">{p}</span>
        ))}
      </div>

      <span className="grow" />
      <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
        {['Male', 'Female', 'Neutral'].map(v => (
          <button key={v} className="btn" style={{ height: 30, padding: '0 9px', fontSize: 12, ...(voice === v ? { background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--fg-1)' } : {}) }} onClick={() => onVoice(v)}>{v}</button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { DawAppRail: AppRail, DawLyrics: LyricsPanel, DawComposer: VoiceComposer, dawFmtT: fmtT });
