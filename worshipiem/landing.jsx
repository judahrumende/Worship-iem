/* WorshipIEM — Landing (light editorial, Basis-style hero) */
const { useState: lpS, useRef: lpR } = React;

function Landing({ go }) {
  const rootRef = lpR(null);

  // GSAP entrance animation
  React.useEffect(() => {
    if (typeof gsap === 'undefined') return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } });
      tl.from('.lp-rise', { y: 18, opacity: 0, duration: 0.55, stagger: 0.07 })
        .from('.lp-phone-wrap', { y: 50, opacity: 0, duration: 0.85, ease: 'power4.out' }, 0.12);
    });
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} style={{ position: 'relative', minHeight: '100dvh', background: '#f5f4ed', color: '#141413', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <style>{`
        @keyframes lpIem { 0%,100%{ transform: translateY(0) rotate(-3deg); } 50%{ transform: translateY(-26px) rotate(1deg); } }
        @keyframes lpIem2 { 0%,100%{ transform: translateY(0) rotate(6deg); } 50%{ transform: translateY(20px) rotate(2deg); } }
        @keyframes lpRing { 0%{ transform: scale(1); border-color: rgba(224,122,85,.95); box-shadow: 0 0 26px rgba(224,122,85,.45);} 100%{ transform: scale(.9); border-color: rgba(255,255,255,.10); box-shadow: 0 0 0 rgba(224,122,85,0);} }
        @keyframes lpDot { 0%,16%{ background: var(--c, #e07a55); transform: scale(1.5); box-shadow: 0 0 12px rgba(224,122,85,.7);} 17%,100%{ background:#33322e; transform: scale(1); box-shadow:none;} }
        @keyframes lpWave { 0%,100%{ transform: scaleY(.28);} 50%{ transform: scaleY(1);} }
        @keyframes lpBlink { 50%{ opacity:.25; } }
        @keyframes lpFloat { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-8px);} }
        .lp-link { color:#5e5d59; font-size:15px; font-weight:500; text-decoration:none; cursor:pointer; transition: color .2s; }
        .lp-link:hover { color:#141413; }
        .lp-pill-btn { display:inline-flex; align-items:center; gap:8px; height:42px; padding:0 18px; border-radius:24px; font-size:15px; font-weight:600; font-family:var(--font-sans); cursor:pointer; border:1px solid #141413; background:#141413; color:#faf9f5; transition: background .24s cubic-bezier(.32,.72,0,1); }
        .lp-pill-btn:hover { background:#000; }
        .lp-pill-ghost { background:transparent; color:#141413; border:1px solid #d9d6cb; }
        .lp-pill-ghost:hover { background:#faf9f5; border-color:#bfbcb0; }
        .lp-cta { display:inline-flex; align-items:center; justify-content:center; gap:10px; height:56px; padding:0 26px; border-radius:14px; font-size:17px; font-weight:600; cursor:pointer; font-family:var(--font-sans); transition: all .24s cubic-bezier(.32,.72,0,1); }
        .lp-cta--dark { background:#141413; color:#faf9f5; border:1px solid #141413; }
        .lp-cta--dark:hover { background:#000; }
        .lp-cta--light { background:#faf9f5; color:#141413; border:1px solid #e2dfd4; }
        .lp-cta--light:hover { border-color:#c2c0b6; }
        @media (max-width: 900px){ .lp-grid{ grid-template-columns:1fr !important; } .lp-phone-col{ justify-content:center !important; } .lp-h1{ font-size:52px !important; } }
        @media (prefers-reduced-motion: reduce){ .lp-anim{ animation:none !important; } }
      `}</style>

      {/* animated IEM background */}
      <img src="assets/iem.png" alt="" aria-hidden="true" className="lp-anim" style={{
        position: 'absolute', width: 760, right: -150, top: '26%', opacity: 0.13,
        mixBlendMode: 'multiply', pointerEvents: 'none', animation: 'lpIem 17s ease-in-out infinite', zIndex: 0,
      }} />
      <img src="assets/iem.png" alt="" aria-hidden="true" className="lp-anim" style={{
        position: 'absolute', width: 420, left: -120, bottom: '-6%', opacity: 0.07,
        mixBlendMode: 'multiply', pointerEvents: 'none', animation: 'lpIem2 21s ease-in-out infinite', zIndex: 0,
      }} />

      {/* nav */}
      <nav style={{ position: 'relative', zIndex: 5, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 21 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: '#c96442', color: '#faf9f5', display: 'grid', placeItems: 'center' }}><WIcon name="radio" size={17} /></span>
          <span>Worship<span style={{ color: '#c96442' }}>IEM</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <a className="lp-link" onClick={(e) => e.preventDefault()}>How it works</a>
          <a className="lp-link" onClick={(e) => e.preventDefault()}>For bands</a>
          <a className="lp-link" onClick={(e) => e.preventDefault()}>FAQ</a>
          <a className="lp-link" onClick={() => go('#/join')}>Join a session</a>
          <button className="lp-pill-btn" onClick={() => go('#/create')}>Host a session</button>
        </div>
      </nav>

      {/* hero */}
      <div className="lp-grid" style={{ position: 'relative', zIndex: 3, maxWidth: 1180, margin: '0 auto', padding: '36px 28px 80px', display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 40, alignItems: 'center' }}>
        {/* left */}
        <div>
          <div className="lp-rise" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 24, background: 'rgba(201,100,66,0.10)', marginBottom: 26 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c96442' }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#a4532f', letterSpacing: 0.2 }}>Wireless in-ear monitoring for worship teams</span>
          </div>
          <h1 className="lp-h1 serif lp-rise" style={{ fontSize: 64, lineHeight: 1.07, margin: '0 0 22px', animationDelay: '.06s' }}>
            One click track,<br /><span style={{ fontStyle: 'italic' }}>every ear in time.</span>
          </h1>
          <p className="lp-rise" style={{ fontSize: 19, lineHeight: 1.6, color: '#5e5d59', maxWidth: 460, margin: '0 0 34px', animationDelay: '.12s' }}>
            The worship leader sets the tempo and talks to the band. Everyone hears the same
            click and the same voice through their own phone — no rig, no install, nothing to
            fight. You just play.
          </p>
          <div className="lp-rise" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animationDelay: '.18s' }}>
            <button className="lp-cta lp-cta--dark" onClick={() => go('#/create')}><WIcon name="radio" size={20} /> Host a session</button>
            <button className="lp-cta lp-cta--light" onClick={() => go('#/join')}>Join with a code <WIcon name="arrowRight" size={19} /></button>
          </div>
          <div className="lp-rise" style={{ display: 'flex', gap: 46, marginTop: 48, animationDelay: '.24s' }}>
            {[['20–300', 'BPM range'], ['0', 'Apps to install'], ['1 tap', 'For the band to join']].map(([n, l]) => (
              <div key={l}>
                <div className="serif" style={{ fontSize: 30, lineHeight: 1, whiteSpace: 'nowrap' }}>{n}</div>
                <div style={{ fontSize: 13.5, color: '#87867f', marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* right — phone */}
        <div className="lp-phone-col lp-phone-wrap" style={{ display: 'flex', justifyContent: 'center', paddingRight: 8 }}>
          <PhoneMock />
        </div>
      </div>

      {/* footer rule */}
      <div style={{ position: 'relative', zIndex: 3, borderTop: '1px solid #e8e6dc', maxWidth: 1180, margin: '0 auto', padding: '22px 28px' }}>
        <span style={{ fontSize: 12.5, color: '#87867f' }}>
          A prototype. The click track and live sync are real across browser tabs — open Host in one tab and a Listener in another to feel it.
        </span>
      </div>
    </div>
  );
}

/* ---- the phone mockup (dark app inside) ---- */
function PhoneMock() {
  const dim = '#33322e';
  return (
    <div className="lp-rise" style={{ position: 'relative', animationDelay: '.18s' }}>
      {/* floating pill — left, beside the click ring */}
      <div className="lp-anim" style={{ position: 'absolute', left: -44, top: 322, zIndex: 4, animation: 'lpFloat 5s ease-in-out infinite' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#faf9f5', borderRadius: 16, padding: '10px 14px', boxShadow: '0 12px 34px rgba(20,20,19,0.14)' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(201,100,66,0.12)', color: '#c96442', display: 'grid', placeItems: 'center' }}><WIcon name="metronome" size={17} /></span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#141413' }}>Locked in time</div>
            <div style={{ fontSize: 11.5, color: '#87867f' }}>± 0 ms across the band</div>
          </div>
        </div>
      </div>

      {/* floating pill — bottom right */}
      <div className="lp-anim" style={{ position: 'absolute', right: -26, bottom: 100, zIndex: 4, animation: 'lpFloat 6s ease-in-out infinite', animationDelay: '.5s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#faf9f5', borderRadius: 16, padding: '10px 14px', boxShadow: '0 12px 34px rgba(20,20,19,0.14)' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#c96442', color: '#faf9f5', display: 'grid', placeItems: 'center' }}><WIcon name="mic" size={14} /></span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#141413' }}>Talkback live</span>
        </div>
      </div>

      {/* phone body */}
      <div style={{ width: 300, borderRadius: 44, background: '#0d0d0c', padding: 10, boxShadow: '0 30px 70px rgba(20,20,19,0.28), 0 0 0 1px rgba(20,20,19,0.06)', position: 'relative', zIndex: 3 }}>
        <div style={{ borderRadius: 36, background: '#141413', overflow: 'hidden', position: 'relative' }}>
          {/* dynamic island */}
          <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 96, height: 28, background: '#000', borderRadius: 16, zIndex: 6 }} />
          {/* status bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 22px 6px', color: '#f5f4ed' }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 11 }}>
                {[5, 7, 9, 11].map((h, i) => <span key={i} style={{ width: 3, height: h, background: '#f5f4ed', borderRadius: 1 }} />)}
              </span>
              <WIcon name="wifi" size={14} />
              <span style={{ width: 22, height: 11, borderRadius: 3, border: '1px solid #f5f4ed', position: 'relative', display: 'inline-block' }}>
                <span style={{ position: 'absolute', inset: 1.5, width: '72%', background: '#f5f4ed', borderRadius: 1 }} />
              </span>
            </div>
          </div>

          {/* app body */}
          <div style={{ padding: '14px 16px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {/* room chip row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: '#7aa860', whiteSpace: 'nowrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7aa860' }} /> Connected
              </span>
              <span className="mono" style={{ fontSize: 12, color: '#82817a', fontWeight: 600, whiteSpace: 'nowrap' }}>AQG6 · 6 ears</span>
            </div>

            {/* now playing — click track */}
            <div style={{ background: '#1b1b18', border: '1px solid #2b2b27', borderRadius: 18, padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: '#e07a55' }}>Click live</div>
                <div className="serif" style={{ fontSize: 21, color: '#f5f4ed', marginTop: 3 }}>King of kings</div>
              </div>
              {/* pulsing ring */}
              <div style={{ position: 'relative', width: 132, height: 132, display: 'grid', placeItems: 'center' }}>
                <span className="lp-anim" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(224,122,85,.9)', animation: 'lpRing .8333s cubic-bezier(.32,.72,0,1) infinite' }} />
                <span style={{ position: 'absolute', inset: '18%', borderRadius: '50%', border: '1px solid #2b2b27' }} />
                <div style={{ textAlign: 'center', zIndex: 1 }}>
                  <div className="mono" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: '#f5f4ed' }}>72</div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, color: '#82817a', marginTop: 2 }}>BPM</div>
                </div>
              </div>
              {/* beat dots */}
              <div style={{ display: 'flex', gap: 11 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="lp-anim" style={{
                    width: 9, height: 9, borderRadius: '50%', background: '#33322e',
                    '--c': i === 0 ? '#e07a55' : '#f5f4ed',
                    animation: 'lpDot 3.3332s steps(1, end) infinite', animationDelay: (i * 0.8333) + 's',
                  }} />
                ))}
              </div>
            </div>

            {/* talkback — recording / voice memo */}
            <div style={{ background: '#1b1b18', border: '1px solid #2b2b27', borderRadius: 16, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 38, height: 38, flex: 'none', borderRadius: '50%', background: '#2a2522', color: '#e07a55', display: 'grid', placeItems: 'center' }}>MA</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#f5f4ed' }}>Marta — worship leader</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#82817a', marginTop: 1 }}>
                  <span className="lp-anim" style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0563f', animation: 'lpBlink 1.2s steps(1) infinite' }} />
                  Talking now · Live
                </div>
              </div>
              {/* waveform */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="lp-anim" style={{
                    width: 3, height: 22, borderRadius: 2, background: '#e07a55', transformOrigin: 'center',
                    animation: 'lpWave .7s ease-in-out infinite', animationDelay: (i * 0.11) + 's',
                  }} />
                ))}
              </div>
            </div>

            {/* in ears list */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 2px 8px' }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: '#82817a' }}>In ears · 6 connected</span>
                <span style={{ fontSize: 12, color: '#e07a55', fontWeight: 600 }}>Manage</span>
              </div>
              {[['Drums — Sam', true], ['Bass — Theo', true], ['Keys — Joy', true]].map(([n, ok]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px', borderTop: '1px solid #232320' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: '#232320', color: '#b0aea5', display: 'grid', placeItems: 'center' }}><WIcon name="headphones" size={15} /></span>
                  <span style={{ flex: 1, fontSize: 13.5, color: '#d8d6cd' }}>{n}</span>
                  <span style={{ color: '#7aa860' }}><WIcon name="check" size={16} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Landing = Landing;
