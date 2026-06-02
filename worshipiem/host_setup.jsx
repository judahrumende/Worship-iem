/* WorshipIEM — shared host helpers + setlist store + modal
   (The standalone "build your setlist" page was removed — songs are now
   added directly on the live control surface. These helpers stay shared.) */
const { useState: useStateH, useEffect: useEffectH } = React;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
function uid() { return Math.random().toString(36).slice(2, 9); }
function listenerLink(room) { return location.origin + location.pathname + '#/listen?room=' + room; }

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Am', 'Bm', 'C#m', 'Dm', 'Em', 'F#m', 'Gm'];

/* canonical song shape — every song carries its own click + cues */
function normalizeSong(s) {
  return {
    id: (s && s.id) || uid(),
    name: (s && s.name) || '',
    key: (s && s.key) || 'C',
    bpm: Math.min(300, Math.max(20, (s && +s.bpm) || 120)),
    bpb: (s && +s.bpb) || 4,
    notes: (s && s.notes) || '',
    clickSound: (s && s.clickSound) || 'wood',
    subdivision: (s && s.subdivision) || 'none',
    accent: s && s.accent === false ? false : true,
    bars: Math.min(256, Math.max(4, (s && +s.bars) || 32)),
    infinite: !!(s && s.infinite),
    start: (s && s.start != null) ? Math.max(0, Math.round(+s.start)) : null,
    voiceCues: (s && Array.isArray(s.voiceCues)) ? s.voiceCues : [],
  };
}

/* a sensible starter setlist for a freshly created session */
function defaultSetlist() {
  return [
    { name: 'King of kings', key: 'D', bpm: 72, bpb: 4, notes: '', bars: 40 },
    { name: 'What a beautiful name', key: 'D', bpm: 68, bpb: 4, notes: 'Soft start, no click in intro', bars: 36 },
    { name: 'This is amazing grace', key: 'G', bpm: 84, bpb: 4, notes: '', bars: 32 },
    { name: 'Goodness of God', key: 'Ab', bpm: 63, bpb: 6, notes: 'Half-time feel', clickSound: 'beep', bars: 44 },
  ].map(normalizeSong);
}

const PC_PLAN = {
  name: 'Sunday 9:00 — Planning Center',
  songs: [
    { name: 'Praise', key: 'A', bpm: 140, bpb: 4, notes: 'Big intro — hold the last chorus' },
    { name: 'Gratitude', key: 'C', bpm: 70, bpb: 4, notes: 'Starts without click' },
    { name: 'Firm Foundation', key: 'B', bpm: 72, bpb: 4, notes: 'Half-time feel in verse 2' },
    { name: 'Goodness of God', key: 'Ab', bpm: 63, bpb: 6, notes: '' },
    { name: 'I Speak Jesus', key: 'G', bpm: 140, bpb: 4, notes: 'Tag the bridge x4' },
  ],
};

/* saved setlists store */
const SetlistStore = {
  all() { try { return JSON.parse(localStorage.getItem('worshipiem:setlists')) || []; } catch (e) { return []; } },
  save(name, songs) {
    const list = this.all();
    list.unshift({ id: uid(), name, songs, savedAt: Date.now() });
    try { localStorage.setItem('worshipiem:setlists', JSON.stringify(list.slice(0, 20))); } catch (e) {}
  },
  remove(id) {
    try { localStorage.setItem('worshipiem:setlists', JSON.stringify(this.all().filter(s => s.id !== id))); } catch (e) {}
  },
};

function SavedList({ onPick }) {
  const [list, setList] = useStateH(SetlistStore.all());
  if (!list.length) return <p className="muted" style={{ fontSize: 14 }}>No saved setlists yet. Build one on the live page and tap “Save setlist”, then it'll keep here — quietly, ready for next Sunday.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map(s => (
        <div key={s.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            <div className="dim" style={{ fontSize: 13 }}>{s.songs.length} songs · {new Date(s.savedAt).toLocaleDateString()}</div>
          </div>
          <button className="btn btn--primary" style={{ height: 38 }} onClick={() => onPick(s.songs)}>Use</button>
          <button className="btn btn--ghost btn--icon btn--danger" onClick={() => { SetlistStore.remove(s.id); setList(SetlistStore.all()); }}><WIcon name="trash" size={18} /></button>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffectH(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(20,20,19,0.5)', display: 'grid', placeItems: 'center', padding: 20, animation: 'fadein .24s var(--ease)' }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '84dvh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className="serif" style={{ fontSize: 22 }}>{title}</h3>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><WIcon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  WIModal: Modal, WIKEYS: KEYS, WISavedList: SavedList,
  WIPCPlan: PC_PLAN, WISetlistStore: SetlistStore, WIDefaultSetlist: defaultSetlist,
  WINormalizeSong: normalizeSong,
});
