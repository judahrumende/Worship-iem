/* WorshipIEM — Host setup: setlist builder (key, notes, save/reuse, import), session options */
const { useState: useStateH, useEffect: useEffectH, useRef: useRefH } = React;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeRoomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}
function uid() { return Math.random().toString(36).slice(2, 9); }
function listenerLink(room) { return location.origin + location.pathname + '#/listen?room=' + room; }

const KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Am', 'Bm', 'C#m', 'Dm', 'Em', 'F#m', 'Gm'];

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

function HostSetup({ go }) {
  const [name, setName] = useStateH('Sunday morning — 9:00');
  const [password, setPassword] = useStateH('');
  const [code, setCode] = useStateH(() => {
    try { return localStorage.getItem('worshipiem:lastCode') || makeRoomCode(); } catch (e) { return makeRoomCode(); }
  });
  const [songs, setSongs] = useStateH(() => ([
    { id: uid(), name: 'King of kings', key: 'D', bpm: 72, bpb: 4, notes: '' },
    { id: uid(), name: 'What a beautiful name', key: 'D', bpm: 68, bpb: 4, notes: 'Soft start, no click in intro' },
    { id: uid(), name: 'This is amazing grace', key: 'G', bpm: 84, bpb: 4, notes: '' },
    { id: uid(), name: 'Goodness of God', key: 'Ab', bpm: 63, bpb: 6, notes: 'Half-time feel' },
  ]));
  const [modal, setModal] = useStateH(null); // 'import' | 'saved' | null
  const dragFrom = useRefH(null);

  const addSong = () => setSongs(s => [...s, { id: uid(), name: '', key: 'C', bpm: 120, bpb: 4, notes: '' }]);
  const update = (id, patch) => setSongs(s => s.map(x => x.id === id ? { ...x, ...patch } : x));
  const remove = (id) => setSongs(s => s.filter(x => x.id !== id));
  const move = (id, dir) => setSongs(s => {
    const i = s.findIndex(x => x.id === id); const j = i + dir;
    if (j < 0 || j >= s.length) return s;
    const c = s.slice(); [c[i], c[j]] = [c[j], c[i]]; return c;
  });
  const reorder = (from, to) => setSongs(s => {
    if (from === to || from == null) return s;
    const c = s.slice(); const [m] = c.splice(from, 1); c.splice(to, 0, m); return c;
  });

  const valid = songs.filter(s => s.name.trim()).length > 0;

  const cleanSongs = () => songs.filter(s => s.name.trim()).map(s => ({
    ...s, name: s.name.trim(), bpm: Math.min(300, Math.max(20, +s.bpm || 120)),
  }));

  const start = () => {
    const room = (code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || makeRoomCode()).slice(0, 6);
    try { localStorage.setItem('worshipiem:lastCode', room); } catch (e) {}
    window.WISession.save(room, {
      name: name.trim() || 'Worship session', password: password.trim(),
      setlist: cleanSongs(), createdAt: Date.now(),
    });
    go('#/host?room=' + room);
  };

  const importPlan = (plan) => {
    setName(plan.name);
    setSongs(plan.songs.map(s => ({ id: uid(), ...s })));
    setModal(null);
  };

  return (
    <div className="screen">
      <TopBar right={<button className="btn btn--ghost" onClick={() => go('#/')}>Cancel</button>} />
      <div className="wrap fade-in" style={{ paddingTop: 28, paddingBottom: 130 }}>
        <div className="overline">Host · new session</div>
        <h1 className="serif" style={{ fontSize: 36, margin: '8px 0 6px' }}>Build your setlist</h1>
        <p className="muted" style={{ maxWidth: 520, marginBottom: 26 }}>
          Add each song with its key, tempo and any notes. During the service you'll tap a song
          to push its click to everyone's in-ears — instantly, in time.
        </p>

        {/* session options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
          <div className="field">
            <label>Session name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Sunday morning" />
          </div>
          <div className="field">
            <label>Room code <span className="dim" style={{ fontWeight: 400 }}>· reuse it every week</span></label>
            <input className="input mono" value={code} maxLength={6}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="AUTO" />
          </div>
          <div className="field">
            <label>Password <span className="dim" style={{ fontWeight: 400 }}>· optional</span></label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: 16, color: 'var(--fg-3)' }}><WIcon name="lock" size={18} /></span>
              <input className="input" style={{ paddingLeft: 42 }} value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank for open" />
            </div>
          </div>
        </div>

        {/* setlist header + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div className="overline">Setlist · {songs.filter(s => s.name.trim()).length} songs</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ height: 38, fontSize: 14 }} onClick={() => setModal('saved')}><WIcon name="list" size={16} /> Load saved</button>
            <button className="btn" style={{ height: 38, fontSize: 14 }} onClick={() => setModal('import')}><WIcon name="upload" size={16} /> Import from Planning Center</button>
          </div>
        </div>

        {/* songs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {songs.map((s, i) => (
            <div key={s.id} className="card" draggable
              onDragStart={() => { dragFrom.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { reorder(dragFrom.current, i); dragFrom.current = null; }}
              style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--fg-3)', cursor: 'grab', display: 'flex' }} title="Drag to reorder"><WIcon name="grip2" size={18} /></span>
                <span className="mono dim" style={{ width: 20, textAlign: 'center', fontSize: 14 }}>{i + 1}</span>
                <input className="input" style={{ flex: 1, height: 44 }} placeholder="Song name" value={s.name} onChange={e => update(s.id, { name: e.target.value })} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="btn btn--ghost btn--icon" style={{ height: 21, width: 30 }} onClick={() => move(s.id, -1)} disabled={i === 0}><WIcon name="chevronLeft" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                  <button className="btn btn--ghost btn--icon" style={{ height: 21, width: 30 }} onClick={() => move(s.id, 1)} disabled={i === songs.length - 1}><WIcon name="chevronRight" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                </div>
                <button className="btn btn--ghost btn--icon btn--danger" onClick={() => remove(s.id)}><WIcon name="trash" size={18} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={fieldChip}>
                  <span className="overline">Key</span>
                  <select className="mono" value={s.key} onChange={e => update(s.id, { key: e.target.value })} style={selStyle}>
                    {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                <label style={fieldChip}>
                  <span className="overline">BPM</span>
                  <input className="mono" type="number" min="20" max="300" value={s.bpm} onChange={e => update(s.id, { bpm: e.target.value })} style={{ ...selStyle, width: 58 }} />
                </label>
                <label style={fieldChip}>
                  <span className="overline">Time</span>
                  <select className="mono" value={s.bpb} onChange={e => update(s.id, { bpb: +e.target.value })} style={selStyle}>
                    <option value={4}>4/4</option><option value={3}>3/4</option><option value={6}>6/8</option><option value={2}>2/4</option>
                  </select>
                </label>
                <input className="input" style={{ flex: 1, minWidth: 160, height: 40, fontSize: 14 }} placeholder="Notes — e.g. starts without click, half-time feel"
                  value={s.notes} onChange={e => update(s.id, { notes: e.target.value })} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn" onClick={addSong}><WIcon name="plus" size={18} /> Add song</button>
          <button className="btn" onClick={() => { if (valid) { SetlistStore.save(name.trim() || 'Setlist', cleanSongs()); setModal('saved-ok'); setTimeout(() => setModal(null), 1400); } }}>
            <WIcon name="check" size={18} /> Save setlist
          </button>
        </div>
      </div>

      {/* sticky start bar */}
      <div style={{ position: 'sticky', bottom: 0, borderTop: '1px solid var(--border)', background: 'var(--scrim)', backdropFilter: 'blur(12px)', padding: '14px 20px' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', gap: 12 }}>
          <span className="muted" style={{ fontSize: 14 }}>{password ? 'Password protected · ' : ''}Room {code || 'AUTO'}</span>
          <button className="btn btn--primary btn--lg" disabled={!valid} onClick={start}>Start session <WIcon name="arrowRight" size={20} /></button>
        </div>
      </div>

      {/* modals */}
      {(modal === 'import' || modal === 'saved') && (
        <Modal onClose={() => setModal(null)} title={modal === 'import' ? 'Import from Planning Center' : 'Saved setlists'}>
          {modal === 'import' ? (
            <div>
              <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
                Your connected Planning Center service plan. Importing replaces the current setlist with its songs, keys and tempos.
              </p>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{PC_PLAN.name}</span>
                  <span className="chip"><span className="dot" />{PC_PLAN.songs.length} songs</span>
                </div>
                {PC_PLAN.songs.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 0 }}>
                    <span className="mono dim" style={{ width: 18 }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 15 }}>{s.name}</span>
                    <span className="mono dim" style={{ fontSize: 13 }}>{s.key} · {s.bpm}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 16 }} onClick={() => importPlan(PC_PLAN)}>
                <WIcon name="upload" size={18} /> Import these {PC_PLAN.songs.length} songs
              </button>
            </div>
          ) : (
            <SavedList onPick={(songs) => { setSongs(songs.map(s => ({ id: uid(), ...s }))); setModal(null); }} />
          )}
        </Modal>
      )}
      {modal === 'saved-ok' && (
        <div style={{ position: 'fixed', bottom: 92, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '10px 18px', boxShadow: 'var(--shadow-card)' }}>
          <span className="chip chip--ok" style={{ border: 0, background: 'transparent', padding: 0 }}><span className="dot" />Setlist saved for reuse</span>
        </div>
      )}
    </div>
  );
}

const fieldChip = { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '0 8px 0 12px', height: 44 };
const selStyle = { height: 40, background: 'transparent', border: 0, color: 'var(--fg-1)', fontSize: 15, fontWeight: 700, outline: 'none', cursor: 'pointer' };

function SavedList({ onPick }) {
  const [list, setList] = useStateH(SetlistStore.all());
  if (!list.length) return <p className="muted" style={{ fontSize: 14 }}>No saved setlists yet. Build one and tap “Save setlist”, then it'll keep here — quietly, ready for next Sunday.</p>;
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

window.HostSetup = HostSetup;
window.WIModal = Modal;
