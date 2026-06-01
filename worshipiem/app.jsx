/* WorshipIEM — router + tweaks (Landing lives in landing.jsx) */
const { useState: aS, useEffect: aE } = React;

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 40, color: '#f5f4ed', background: '#0d0d0c', minHeight: '100dvh', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#e07a55' }}>Something went wrong</h2>
        <pre style={{ fontSize: 13, color: '#b0aea5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{String(this.state.err)}</pre>
        <button onClick={() => location.reload()} style={{ marginTop: 20, padding: '10px 20px', background: '#e07a55', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>Reload</button>
      </div>
    );
    return this.props.children;
  }
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": ["#e07a55", "#c96442"],
  "clickSound": "wood"
}/*EDITMODE-END*/;

function hexRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function applyTweaks(t) {
  const root = document.documentElement.style;
  const a = (t.accent && t.accent[0]) || '#e07a55';
  const a2 = (t.accent && t.accent[1]) || '#c96442';
  root.setProperty('--accent', a);
  root.setProperty('--accent-strong', a2);
  root.setProperty('--accent-soft', hexRgba(a, 0.16));
  root.setProperty('--accent-glow', hexRgba(a, 0.45));
  root.setProperty('--live', a2);
}

/* ---------- router ---------- */
function parseHash() {
  const h = location.hash || '#/';
  const [path, query] = h.replace(/^#/, '').split('?');
  const params = {};
  if (query) query.split('&').forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v || ''); });
  return { path: path || '/', params };
}

function App() {
  const [route, setRoute] = aS(parseHash());
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  aE(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  aE(() => { applyTweaks(t); }, [t.accent]);
  aE(() => { if (window.WIClick) window.WIClick.setTimbre(t.clickSound); }, [t.clickSound]);


  const go = (hash) => { if (location.hash === hash) setRoute(parseHash()); else location.hash = hash; window.scrollTo(0, 0); };

  const { path, params } = route;
  let screen;
  if (path === '/host') screen = params.room ? <HostControl key={params.room} room={params.room} go={go} /> : <Landing go={go} />;
  else if (path === '/join') screen = <JoinScreen go={go} presetRoom={(params.room || '').toUpperCase()} />;
  else if (path === '/listen') screen = params.room ? <Listener key={params.room} room={(params.room || '').toUpperCase()} go={go} /> : <JoinScreen go={go} />;
  else screen = <Landing go={go} />;

  return (
    <>
      {screen}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent" />
        <TweakColor label="Highlight & click pulse" value={t.accent}
          options={[['#e07a55', '#c96442'], ['#5b9dd6', '#3f7cb3'], ['#6db38a', '#4d8c66'], ['#c98ad6', '#a866b8'], ['#d9b34a', '#b89232']]}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Click" />
        <TweakSelect label="Default sound" value={t.clickSound}
          options={['wood', 'beep', 'hihat', 'cowbell']}
          onChange={(v) => setTweak('clickSound', v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
