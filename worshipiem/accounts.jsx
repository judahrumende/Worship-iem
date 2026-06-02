/* WorshipIEM — auth + library React layer.
   useAuth() / useLibrary() subscribe to the WIAuth/WILibrary stores.
   AuthModal: username + password sign in / create account (no email).
   LibraryPicker: pick a saved song (with its click + cues) to add.
   AccountChip: small status control. */

function useAuth() {
  const [u, setU] = React.useState(window.WIAuth.current());
  React.useEffect(() => window.WIAuth.onChange(setU), []);
  return u;
}
function useLibrary() {
  const [list, setList] = React.useState(window.WILibrary.list());
  React.useEffect(() => window.WIAuth.onChange(() => setList(window.WILibrary.list())), []);
  const refresh = () => setList(window.WILibrary.list());
  return [list, refresh];
}

function AuthModal({ onClose, onDone, intro }) {
  const M = window.WIModal;
  const [mode, setMode] = React.useState('login');
  const [u, setU] = React.useState('');
  const [p, setP] = React.useState('');
  const [err, setErr] = React.useState('');
  const submit = () => {
    setErr('');
    try {
      const name = mode === 'login' ? window.WIAuth.login(u, p) : window.WIAuth.signup(u, p);
      onDone && onDone(name); onClose();
    } catch (e) { setErr(e.message || 'Something went wrong.'); }
  };
  return (
    <M title={mode === 'login' ? 'Sign in' : 'Create an account'} onClose={onClose}>
      {intro && <p className="muted" style={{ fontSize: 14, marginTop: -4, marginBottom: 16 }}>{intro}</p>}
      <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 4, marginBottom: 18 }}>
        {[['login', 'Sign in'], ['signup', 'New account']].map(([v, l]) => (
          <button key={v} className="btn btn--ghost" style={{ flex: 1, height: 38, fontSize: 14, ...(mode === v ? { background: 'var(--surface-3)', color: 'var(--fg-1)' } : { color: 'var(--fg-3)' }) }} onClick={() => { setMode(v); setErr(''); }}>{l}</button>
        ))}
      </div>
      <div className="field" style={{ marginBottom: 12 }}>
        <label>Username</label>
        <input className="input" autoFocus value={u} placeholder="e.g. hillsong-mdq" autoCapitalize="off" autoCorrect="off"
          onChange={e => setU(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Password</label>
        <input className="input" type="password" value={p} placeholder={mode === 'signup' ? 'At least 4 characters' : 'Your password'}
          onChange={e => setP(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
      </div>
      {err && <p style={{ color: 'var(--danger)', fontSize: 13.5, margin: '0 0 14px' }}>{err}</p>}
      <button className="btn btn--primary btn--block btn--lg" onClick={submit}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <p className="dim" style={{ fontSize: 12.5, textAlign: 'center', margin: '14px 0 0' }}>
        No email needed — just a username and password. Your saved songs live under your account on this device.
      </p>
    </M>
  );
}

function LibraryPicker({ onPick, onClose }) {
  const M = window.WIModal;
  const [list, refresh] = useLibrary();
  return (
    <M title="Add from your library" onClose={onClose}>
      {list.length === 0 ? (
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          Your library is empty. In the Live DAW, dial in a song's tempo, time signature, click sound and voice cues, then tap <strong>Save to library</strong> — it'll keep here for any future setlist.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(s => (
            <div key={s.libId} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="dim" style={{ fontSize: 12.5 }}>
                  {s.key ? 'Key ' + s.key + ' · ' : ''}{TS_LABEL[s.bpb] || '4/4'} · {s.bpm} bpm · {(s.clickSound || 'wood')}
                  {s.voiceCues && s.voiceCues.length ? ' · ' + s.voiceCues.length + ' cue' + (s.voiceCues.length > 1 ? 's' : '') : ''}
                </div>
              </div>
              <button className="btn btn--primary" style={{ height: 38 }} onClick={() => { onPick(s); onClose(); }}>Add</button>
              <button className="btn btn--ghost btn--icon btn--danger" onClick={() => { window.WILibrary.remove(s.libId); refresh(); }}><WIcon name="trash" size={17} /></button>
            </div>
          ))}
        </div>
      )}
    </M>
  );
}

window.useAuth = useAuth;
window.useLibrary = useLibrary;
window.AuthModal = AuthModal;
window.LibraryPicker = LibraryPicker;
