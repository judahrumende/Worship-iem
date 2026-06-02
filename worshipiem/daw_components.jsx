/* WorshipIEM — Advanced DAW mode components (presentation mock) */
const { useState: dS, useRef: dR, useMemo: dM, useEffect: dE } = React;

/* ---------- shared style ---------- */
const activeBtn = { background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--fg-1)' };

/* ---------- shared data ---------- */
const SOUND_OPTIONS = ['Woodblock', 'Beep', 'Hi-hat', 'Cowbell', 'Rimshot', 'Clap', 'Sine tone'];
const CUE_PALETTE = ['#e07a55', '#ca9450', '#7d9b6a', '#6f8595', '#a87298', '#b6705a', '#c0563f', '#8f8a7a'];

/* fmt seconds -> m:ss */
function mmss(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

/* ============================================================
   TIMELINE
   ============================================================ */
function Timeline({ cues, total, sel, active, posFrac, onSelect, onScrubStart }) {
  // ruler ticks every N bars
  const step = total > 80 ? 16 : 8;
  const ticks = [];
  for (let b = 0; b <= total; b += step) ticks.push(b);

  return (
    <div className="tl">
      <div className="tl-ruler">
        {ticks.map(b => (
          <div key={b} className="tl-tick" style={{ left: (b / total * 100) + '%' }}>
            <span>{b === 0 ? 'Bar 1' : b + 1}</span>
          </div>
        ))}
      </div>
      <div className="tl-lane">
        {cues.map((c, i) => (
          <div key={c.id}
            className={'tl-block' + (i === sel ? ' sel' : '') + (i === active ? ' active' : '')}
            style={{ flexGrow: c.bars, flexBasis: 0, '--cue': c.color }}
            onClick={() => onSelect(i)}>
            <div className="cue-name">{c.name}</div>
            <div className="cue-meta">{c.bars} bars · {c.bpm}</div>
            <div className="cue-badges">
              {c.countIn > 0 && <span className="cue-badge"><WIcon name="metronome" size={9} />{c.countIn}</span>}
              {c.bpmChange && <span className="cue-badge">♩{c.bpm}</span>}
              {c.tsChange && <span className="cue-badge">{c.ts}</span>}
              {c.voice && <span className="cue-badge"><WIcon name="mic" size={9} /></span>}
            </div>
          </div>
        ))}
        <div className="tl-playhead" style={{ left: (posFrac * 100) + '%' }} />
      </div>
    </div>
  );
}

/* ============================================================
   CUE INSPECTOR
   ============================================================ */
function CueInspector({ cue, startBar, onPatch, onDelete }) {
  if (!cue) return null;
  const stepBpm = (d) => onPatch({ bpm: Math.min(300, Math.max(20, cue.bpm + d)), bpmChange: true });
  return (
    <div className="psec">
      <div className="daw-head">
        <span className="overline"><WIcon name="grip" size={13} /> Cue inspector</span>
        <span className="chip" style={{ height: 26, color: cue.color, borderColor: 'color-mix(in oklab,' + cue.color + ' 35%, transparent)' }}>
          <span className="dot" style={{ background: cue.color }} /> {cue.name}
        </span>
      </div>

      <input value={cue.name} onChange={e => onPatch({ name: e.target.value })}
        className="input" style={{ height: 46, fontSize: 17, fontWeight: 600, marginBottom: 4 }} />

      <div className="kv">
        <span className="k"><WIcon name="list" size={16} /> Starts at</span>
        <span className="mono" style={{ fontWeight: 700 }}>Bar {startBar + 1}</span>
      </div>

      <div className="kv">
        <span className="k"><WIcon name="metronome" size={16} /> Tempo</span>
        <div className="stepper">
          <button className="istep" onClick={() => stepBpm(-1)}><WIcon name="minus" size={15} /></button>
          <span className="sv">{cue.bpm}<span className="dim" style={{ fontSize: 11, fontWeight: 500 }}> bpm</span></span>
          <button className="istep" onClick={() => stepBpm(1)}><WIcon name="plus" size={15} /></button>
        </div>
      </div>

      <div className="kv">
        <span className="k"><WIcon name="music" size={16} /> Time signature</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {['4/4', '3/4', '6/8', '2/4'].map(t => (
            <button key={t} className="btn" style={{ height: 34, padding: '0 11px', fontSize: 13, ...(cue.ts === t ? activeBtn : {}) }}
              onClick={() => onPatch({ ts: t, tsChange: t !== '4/4' })}>{t}</button>
          ))}
        </div>
      </div>

      <div className="kv">
        <span className="k"><WIcon name="bell" size={16} /> Count-in</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ci-dots">
            {[0, 1, 2, 3].map(i => <i key={i} className={i < cue.countIn ? 'on' : ''} />)}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[0, 2, 4].map(n => (
              <button key={n} className="btn" style={{ height: 34, padding: '0 11px', fontSize: 13, ...(cue.countIn === n ? activeBtn : {}) }}
                onClick={() => onPatch({ countIn: n })}>{n === 0 ? 'Off' : n}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="kv" style={{ alignItems: 'flex-start' }}>
        <span className="k" style={{ paddingTop: 4 }}><WIcon name="sun" size={16} /> Label colour</span>
        <div className="swatches" style={{ maxWidth: 230, justifyContent: 'flex-end' }}>
          {CUE_PALETTE.map(c => (
            <button key={c} className={'swatch' + (cue.color === c ? ' on' : '')} style={{ background: c }} onClick={() => onPatch({ color: c })} />
          ))}
        </div>
      </div>

      {onDelete && (
        <button className="btn btn--danger" style={{ marginTop: 16, width: '100%' }} onClick={onDelete}><WIcon name="trash" size={16} /> Delete cue</button>
      )}
    </div>
  );
}

/* ============================================================
   VOICE CUES
   ============================================================ */
function VoiceCues({ cues, custom, voice, onVoice, playing, onPlay, onRecord, recording, hasSpeech }) {
  return (
    <div className="psec">
      <div className="daw-head">
        <span className="overline"><WIcon name="mic" size={13} /> Voice cues</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {['Male', 'Female', 'Neutral'].map(v => (
            <button key={v} className="btn" style={{ height: 32, padding: '0 11px', fontSize: 12.5, ...(voice === v ? activeBtn : {}) }} onClick={() => onVoice(v)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="vcue-grid">
        {cues.map((c, i) => (
          <button key={c.label} className={'vcue' + (playing === c.label ? ' on' : '')} onClick={() => onPlay(c.label)}>
            <span className="vc-play"><WIcon name={playing === c.label ? 'stop' : 'play'} size={13} /></span>
            <span>
              <span className="vc-name" style={{ display: 'block' }}>{c.label}</span>
              <span className="vc-dur">{c.dur}</span>
            </span>
            <span className="wave">
              {c.bars.map((h, j) => <i key={j} style={{ height: h + '%' }} />)}
            </span>
          </button>
        ))}
        {(custom || []).map((c) => (
          <button key={c.url} className="vcue" onClick={() => { const a = new Audio(c.url); a.play(); }}>
            <span className="vc-play"><WIcon name="play" size={13} /></span>
            <span><span className="vc-name" style={{ display: 'block' }}>{c.label}</span><span className="vc-dur">your recording</span></span>
            <span className="wave">{[40, 70, 90, 60, 80, 50].map((h, j) => <i key={j} style={{ height: h + '%' }} />)}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className={'btn' + (recording ? ' btn--danger' : '')} style={{ flex: 1, ...(recording ? { borderColor: 'var(--danger)' } : {}) }} onClick={onRecord}>
          <WIcon name={recording ? 'stop' : 'mic'} size={18} /> {recording ? 'Stop recording' : 'Record custom cue'}
        </button>
        <button className="btn btn--icon" title="Count-in audible to band"><WIcon name="users" size={18} /></button>
      </div>
      <p className="dim" style={{ fontSize: 12, margin: '10px 0 0' }}>
        {hasSpeech ? 'Tap a cue to hear it spoken in the selected voice. Record your own and it drops in beside them.' : 'Voice playback needs the Web Speech API — not available in this browser.'}
      </p>
    </div>
  );
}

/* ============================================================
   CLICK SOUND EDITOR
   ============================================================ */
function ClickEditor({ layers, onPatch, preset, presetNames, onPreset, onSavePreset, onPreview }) {
  return (
    <div className="psec">
      <div className="daw-head">
        <span className="overline"><WIcon name="sliders" size={13} /> Click sound editor</span>
        <button className="tbtn" style={{ height: 32 }} onClick={onPreview}><WIcon name="play" size={14} /> Preview</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {layers.map((L, i) => (
          <div key={L.key} className="layer">
            <div className="layer-top">
              <span className="layer-ico"><WIcon name={L.icon} size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{L.name}</div>
                <div className="dim" style={{ fontSize: 11.5 }}>{L.hint}</div>
              </div>
              <select className="dsel" value={L.sound} onChange={e => onPatch(i, { sound: e.target.value })}>
                {SOUND_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="layer-knobs">
              <MiniKnob label="Pitch" value={L.pitch} unit=" Hz" min={120} max={1600} onChange={v => onPatch(i, { pitch: v })} />
              <MiniKnob label="Volume" value={L.vol} unit="%" min={0} max={100} onChange={v => onPatch(i, { vol: v })} />
              <MiniKnob label="Attack" value={L.attack} unit=" ms" min={0} max={60} onChange={v => onPatch(i, { attack: v })} />
            </div>
            <button className="tbtn" style={{ alignSelf: 'flex-start', height: 30, fontSize: 12.5 }}><WIcon name="upload" size={14} /> Upload sample</button>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 14 }}>
        <div className="overline" style={{ marginBottom: 9 }}>Saved presets</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {(presetNames || ['Sunday Morning', 'Rehearsal', 'Acoustic Set']).map(p => (
            <button key={p} className="btn" style={{ height: 36, fontSize: 13, ...(preset === p ? activeBtn : {}) }} onClick={() => onPreset(p)}>
              {preset === p && <WIcon name="check" size={15} />} {p}
            </button>
          ))}
          <button className="tbtn" onClick={onSavePreset}><WIcon name="plus" size={15} /> Save preset</button>
        </div>
      </div>
    </div>
  );
}

function MiniKnob({ label, value, unit, min, max, onChange }) {
  return (
    <div className="drow">
      <div className="drow-head"><span className="lbl">{label}</span><span className="v">{value}{unit}</span></div>
      <input type="range" className="drange" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} />
    </div>
  );
}

/* ============================================================
   TRANSPORT BAR
   ============================================================ */
function Transport({ sections, totalSec, posSec, playing, loop, curCue, onToggle, onRestart, onLoop, onScrub }) {
  const trackRef = dR(null);
  const posFrac = totalSec ? posSec / totalSec : 0;
  const bpb = curCue.ts === '3/4' ? 3 : curCue.ts === '2/4' ? 2 : curCue.ts === '6/8' ? 6 : 4;
  const beatInto = Math.max(0, (posSec - (curCue.startSec || 0)) * (curCue.bpm / 60));
  const barInSec = Math.floor(beatInto / bpb) + 1;
  const scrub = (clientX) => {
    const el = trackRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    onScrub(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * totalSec);
  };
  const down = (e) => {
    scrub(e.clientX);
    const mv = (ev) => scrub(ev.clientX);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  return (
    <div className="transport">
      <div className="transport-inner">
        <button className="tp-btn" onClick={onRestart} title="Restart section (R)"><WIcon name="radio" size={20} /></button>
        <button className="tp-btn primary" onClick={onToggle} title="Play / Stop (Space)"><WIcon name={playing ? 'stop' : 'play'} size={24} /></button>
        <button className={'tp-btn' + (loop ? ' on' : '')} onClick={onLoop} title="Loop section (L)"><WIcon name="copy" size={19} /></button>

        <div style={{ flex: 'none', minWidth: 150 }}>
          <div className="mono" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{mmss(posSec)} <span className="dim" style={{ fontSize: 13, fontWeight: 500 }}>/ {mmss(totalSec)}</span></div>
          <div className="mono dim" style={{ fontSize: 12, marginTop: 3 }}>Bar {barInSec} · {curCue.ts} · {curCue.bpm} bpm</div>
        </div>

        <div className="scrub" ref={trackRef} onPointerDown={down}>
          <div className="scrub-track">
            {sections.map((c, i) => <div key={i} className="scrub-seg" style={{ flexGrow: c.secs, flexBasis: 0, background: 'color-mix(in oklab,' + c.color + ' 55%, var(--surface-3))' }} />)}
            <div className="scrub-fill" style={{ width: (posFrac * 100) + '%' }} />
          </div>
          <div className="scrub-head" style={{ left: (posFrac * 100) + '%' }} />
        </div>

        <div style={{ flex: 'none', textAlign: 'right' }}>
          <div className="overline" style={{ color: curCue.color }}>Now</div>
          <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.1 }}>{curCue.name}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SHORTCUTS MODAL
   ============================================================ */
const SHORTCUTS = [
  [['Space'], 'Play / Stop click'],
  [['1', '–', '9'], 'Jump to song 1–9'],
  [['→'], 'Next cue'],
  [['←'], 'Previous cue'],
  [['↑', '↓'], 'Prev / next song'],
  [['M'], 'Mute / unmute click'],
  [['T'], 'Tap tempo'],
  [['R'], 'Restart cue + count-in'],
  [['L'], 'Toggle loop'],
  [['Esc'], 'Exit Advanced mode'],
];
function Shortcuts({ onClose }) {
  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="daw-head" style={{ marginBottom: 18 }}>
          <div>
            <div className="overline">Host device</div>
            <h3 className="serif" style={{ fontSize: 24, margin: '4px 0 0' }}>Keyboard shortcuts</h3>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><WIcon name="x" size={18} /></button>
        </div>
        <div className="sc-list">
          {SHORTCUTS.map(([keys, label], i) => (
            <div key={i} className="sc-item">
              <span className="sc-lbl">{label}</span>
              <span className="sc-keys">{keys.map((k, j) => k === '–' ? <span key={j} className="dim" style={{ alignSelf: 'center' }}>–</span> : <kbd key={j} className="kbd">{k}</kbd>)}</span>
            </div>
          ))}
        </div>
        <p className="dim" style={{ fontSize: 12.5, margin: '18px 0 0' }}>
          Works with a Bluetooth keyboard paired to your phone or tablet. Every shortcut is remappable in settings.
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { DawTimeline: Timeline, DawCueInspector: CueInspector, DawVoiceCues: VoiceCues, DawClickEditor: ClickEditor, DawTransport: Transport, DawShortcuts: Shortcuts, dawMMSS: mmss });

/* ============================================================
   ARRANGEMENT — waveform tracks (pro DAW look)
   ============================================================ */
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function ampSamples(n, kind, seed) {
  const r = rng(seed), a = [];
  for (let i = 0; i < n; i++) {
    let v;
    if (kind === 'click') { const b = i % 16; v = b < 2 ? 0.92 - r() * 0.12 : 0.10 + r() * 0.10; }
    else if (kind === 'sub') { const b = i % 8; v = (b < 1 ? 0.55 + r() * 0.1 : 0.18 + r() * 0.16) * 0.78; }
    else if (kind === 'pad') { v = 0.34 + 0.26 * Math.sin(i / 13) + 0.12 * Math.sin(i / 4.3) + r() * 0.05; v = Math.max(0.07, v * 0.72); }
    else { v = 0.30 + r() * 0.45; }
    a.push(Math.min(1, v));
  }
  return a;
}
function wavePath(a) {
  const n = a.length, W = 1000, mid = 50, amp = 46;
  let d = 'M0,' + mid;
  for (let i = 0; i < n; i++) d += ' L' + ((i / (n - 1)) * W).toFixed(1) + ',' + (mid - a[i] * amp).toFixed(1);
  for (let i = n - 1; i >= 0; i--) d += ' L' + ((i / (n - 1)) * W).toFixed(1) + ',' + (mid + a[i] * amp).toFixed(1);
  return d + ' Z';
}
function Wave({ kind, seed, n = 260 }) {
  const d = dM(() => wavePath(ampSamples(n, kind, seed)), [kind, seed, n]);
  return <svg className="wf" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d={d} /></svg>;
}

/* one track lane: full-width clip, or scattered clips for voice cues */
function ArrLane({ track, sections, onSelectSection }) {
  if (track.kind === 'voice') {
    const clips = sections.filter(s => s.voice);
    return (
      <div className="lane" style={{ '--tcol': track.color }}>
        {clips.map(s => (
          <div key={s.id} className="clip" style={{ left: 'calc(' + s.left + '% + 6px)', width: 'calc(' + (s.width * 0.62) + '% )', '--tcol': track.color }}
            onClick={() => onSelectSection(s.idx)} title={s.name}>
            <span className="cliplbl">cue</span>
            <Wave kind="voice" seed={s.startBar * 7 + 3} n={48} />
          </div>
        ))}
      </div>
    );
  }
  const start = track.start || 0;
  return (
    <div className="lane" style={{ '--tcol': track.color }}>
      <div className="clip" style={{ left: 'calc(' + start + '% + 6px)', width: 'calc(' + (100 - start) + '% - 12px)', '--tcol': track.color }}>
        <span className="cliplbl">{track.clip}</span>
        <Wave kind={track.kind} seed={track.seed} n={track.kind === 'pad' ? 200 : 320} />
      </div>
    </div>
  );
}

function ArrTrackHead({ track, on, onSelect, mute, solo, onMute, onSolo }) {
  return (
    <div className={'thead' + (on ? ' on' : '')} style={{ '--tcol': track.color }} onClick={onSelect}>
      <span className="thead-ico"><WIcon name={track.icon} size={16} /></span>
      <span className="thead-name">
        <span className="tn">{track.name}</span>
        <span className="ts">{track.sub}</span>
      </span>
      <span className="ms" onClick={e => e.stopPropagation()}>
        <button className={'msbtn m' + (mute ? ' on' : '')} onClick={onMute} title="Mute">M</button>
        <button className={'msbtn s' + (solo ? ' on' : '')} onClick={onSolo} title="Solo">S</button>
      </span>
    </div>
  );
}

Object.assign(window, { DawWave: Wave, DawArrLane: ArrLane, DawArrTrackHead: ArrTrackHead });
