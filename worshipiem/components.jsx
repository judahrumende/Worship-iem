/* WorshipIEM — shared UI components */
const { useState, useEffect, useRef, useCallback } = React;

/* ----- instruments ----- */
const INSTRUMENTS = ['Drums', 'Bass', 'Electric Guitar', 'Acoustic Guitar', 'Keys', 'Piano', 'Vocals', 'Worship Leader', 'Sound Tech', 'Other'];
const INSTRUMENT_ICON = {
  'Drums': 'drum', 'Bass': 'guitar', 'Electric Guitar': 'guitar', 'Acoustic Guitar': 'guitar',
  'Keys': 'piano', 'Piano': 'piano', 'Vocals': 'mic', 'Worship Leader': 'radio',
  'Sound Tech': 'speaker', 'Other': 'music',
};
function instIcon(name) { return INSTRUMENT_ICON[name] || 'music'; }

const TS_LABEL = { 4: '4/4', 3: '3/4', 6: '6/8', 2: '2/4' };
const SUBDIV_LABEL = { none: 'Quarter', '8': '8ths', triplet: 'Triplets', '16': '16ths' };

/* ----- theme toggle ----- */
function useTheme() {
  const [theme, setTheme] = useState(window.WITheme ? window.WITheme.get() : 'dark');
  useEffect(() => window.WITheme && window.WITheme.subscribe(setTheme), []);
  return theme;
}
function ThemeToggle() {
  const theme = useTheme();
  return (
    <button className="btn btn--ghost btn--icon" title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      onClick={() => window.WITheme.toggle()} style={{ height: 40, width: 40 }}>
      <WIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

/* ----- Top bar ----- */
function TopBar({ live, right, sub }) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="glyph"><WIcon name="radio" size={15} /></span>
        <b>Worship<span style={{ color: 'var(--accent)' }}>IEM</span></b>
        {sub && <span className="dim" style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, marginLeft: 4 }}>{sub}</span>}
        {live && <span className="live-dot" style={{ marginLeft: 6 }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{right}<ThemeToggle /></div>
    </div>
  );
}

/* ----- Visual metronome ----- */
/* Self-animates from the shared epoch clock so it stays locked to the
   audio click without prop churn re-rendering its parent. */
function Metronome({ playing, anchor, bpm, beatsPerBar = 4, style = 'pulse', size = 280, onBpm }) {
  const ringRef = useRef(null);
  const dotsRef = useRef(null);
  const glowRef = useRef(null);
  const rafRef = useRef(0);
  const lastBeat = useRef(-1);
  const [editBpm, setEditBpm] = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');
  const commitBpm = () => { const n = parseInt(bpmDraft, 10); if (!isNaN(n) && onBpm) onBpm(Math.max(20, Math.min(300, n))); setEditBpm(false); };

  useEffect(() => {
    const dots = dotsRef.current ? Array.from(dotsRef.current.children) : [];
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const ring = ringRef.current, glow = glowRef.current;
      if (!ring) return;
      const beatMs = 60000 / (bpm || 120);
      let env = 0, beatInBar = 0;
      if (playing) {
        const elapsed = Date.now() - anchor;
        const beatFloat = elapsed / beatMs;
        const beatIndex = Math.floor(beatFloat);
        const phase = beatFloat - beatIndex;
        beatInBar = ((beatIndex % beatsPerBar) + beatsPerBar) % beatsPerBar;
        env = Math.max(0, 1 - phase / 0.55);  // attack-decay envelope per beat
        env = env * env;
        lastBeat.current = beatIndex;
      }
      const isDown = beatInBar === 0;
      const scale = 1 + (playing ? env * (isDown ? 0.13 : 0.085) : 0);
      ring.style.transform = `scale(${scale})`;
      ring.style.borderColor = playing
        ? `color-mix(in oklab, var(--accent) ${20 + env * 80}%, var(--border-2))`
        : 'var(--border-2)';
      if (glow) glow.style.opacity = playing ? (isDown ? env * 0.9 : env * 0.5) : 0;
      // beat dots
      for (let i = 0; i < dots.length; i++) {
        const on = playing && i === beatInBar;
        dots[i].style.background = on
          ? (i === 0 ? 'var(--accent)' : 'var(--fg-1)')
          : 'var(--surface-3)';
        dots[i].style.transform = on ? `scale(${1 + env * 0.5})` : 'scale(1)';
        dots[i].style.boxShadow = on ? `0 0 ${10 + env * 16}px var(--accent-glow)` : 'none';
      }
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, anchor, bpm, beatsPerBar]);

  const dots = [];
  for (let i = 0; i < beatsPerBar; i++) {
    dots.push(<span key={i} style={{
      width: 13, height: 13, borderRadius: '50%', background: 'var(--surface-3)',
      transition: 'background 90ms linear', display: 'block',
    }} />);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
        <div ref={glowRef} style={{
          position: 'absolute', inset: '8%', borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 68%)',
          opacity: 0, transition: 'opacity 40ms linear', pointerEvents: 'none',
        }} />
        <div ref={ringRef} style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid var(--border-2)',
          transition: 'transform 30ms linear',
          willChange: 'transform',
        }} />
        <div style={{
          position: 'absolute', inset: '15%', borderRadius: '50%',
          border: '1px solid var(--border)',
        }} />
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          {onBpm && editBpm ? (
            <input className="mono" autoFocus value={bpmDraft} inputMode="numeric"
              onChange={(e) => setBpmDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onFocus={(e) => e.target.select()}
              onBlur={commitBpm}
              onKeyDown={(e) => { if (e.key === 'Enter') commitBpm(); else if (e.key === 'Escape') setEditBpm(false); }}
              style={{ width: size * 0.64, fontSize: size * 0.3, fontWeight: 700, lineHeight: 1, color: 'var(--fg-1)', background: 'transparent', border: 0, outline: 'none', textAlign: 'center', padding: 0, fontFamily: 'var(--font-mono)' }} />
          ) : (
            <div className="mono" onClick={onBpm ? () => { setBpmDraft(String(bpm || 120)); setEditBpm(true); } : undefined}
              title={onBpm ? 'Click to type a BPM' : undefined}
              style={{ fontSize: size * 0.3, fontWeight: 700, lineHeight: 1, color: 'var(--fg-1)', cursor: onBpm ? 'text' : 'default', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={onBpm ? (e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; } : undefined}
              onMouseLeave={onBpm ? (e) => { e.currentTarget.style.background = 'transparent'; } : undefined}>
              {bpm || '—'}
          </div>
          )}
          <div className="overline" style={{ marginTop: 6 }}>BPM</div>
        </div>
      </div>
      <div ref={dotsRef} style={{ display: 'flex', gap: 14, alignItems: 'center', height: 20 }}>
        {dots}
      </div>
    </div>
  );
}

/* ----- Mix slider ----- */
function MixSlider({ icon, label, value, onChange, accent, suffix = '%' }) {
  return (
    <div className="slider-row">
      <div className="slider-head">
        <span className="name"><WIcon name={icon} size={18} /> {label}</span>
        <span className="val">{Math.round(value)}{suffix}</span>
      </div>
      <input type="range" className={'range' + (accent ? ' accent' : '')} min="0" max="100"
        value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

/* ----- Copy-to-clipboard pill ----- */
function CopyButton({ text, label = 'Copy', className = 'btn' }) {
  const [done, setDone] = useState(false);
  return (
    <button className={className} onClick={() => {
      try { navigator.clipboard.writeText(text); } catch (e) {}
      setDone(true); setTimeout(() => setDone(false), 1600);
    }}>
      <WIcon name={done ? 'check' : 'copy'} size={18} />
      {done ? 'Copied' : label}
    </button>
  );
}

/* ----- Count-in overlay (N-bar lead-in countdown to the downbeat) ----- */
function CountInOverlay({ active, anchor, bpm, beatsPerBar, bars = 1, onDone }) {
  const total = beatsPerBar * (bars || 1);
  const [num, setNum] = useState(total);
  const ref = useRef(0);
  useEffect(() => {
    if (!active) return;
    const beatMs = 60000 / (bpm || 120);
    const loop = () => {
      ref.current = requestAnimationFrame(loop);
      const remainMs = anchor - Date.now();
      if (remainMs <= 0) { onDone && onDone(); return; }
      const beatsLeft = Math.min(total, Math.ceil(remainMs / beatMs));
      setNum(beatsLeft);
    };
    loop();
    return () => cancelAnimationFrame(ref.current);
  }, [active, anchor, bpm, beatsPerBar, bars]);
  if (!active) return null;
  // which beat-in-bar are we on, for the dot row
  const beatInBar = ((num - 1) % beatsPerBar);
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      background: 'radial-gradient(circle, color-mix(in oklab, var(--bg) 86%, transparent) 42%, color-mix(in oklab, var(--bg) 52%, transparent) 100%)',
      borderRadius: '50%', zIndex: 4,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="overline" style={{ color: 'var(--accent)' }}>Count-in{bars > 1 ? ' · ' + bars + ' bars' : ''}</div>
        <div className="mono" style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, color: 'var(--fg-1)' }}>{num}</div>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'center', marginTop: 14 }}>
          {Array.from({ length: beatsPerBar }).map((_, i) => (
            <span key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i === ((beatsPerBar - 1) - beatInBar) ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'background 80ms linear',
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, ThemeToggle, useTheme, Metronome, MixSlider, CopyButton, CountInOverlay, INSTRUMENTS, instIcon, TS_LABEL, SUBDIV_LABEL });
