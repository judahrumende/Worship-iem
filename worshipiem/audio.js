/* =============================================================
   WorshipIEM — Click engine (Web Audio API)
   ----------------------------------------------------------------
   Generates the metronome on-device. It is NOT streamed — every
   client renders identical clicks locally and stays in phase by
   scheduling against a SHARED EPOCH CLOCK (Date.now), common across
   tabs and, in production, replaced by an NTP-style server offset.

   Each subdivision tick fires at:
       anchor + tickIndex * (60000 / bpm / div)        [ms]
   where div = 1 (quarter), 2 (8ths), 3 (triplets), 4 (16ths).
   Main beats land on tickIndex % div === 0; beat 1 of the bar is
   accented. Sub-ticks are quieter. A 25ms lookahead loop schedules
   every tick inside the next 120ms window using the sample-accurate
   AudioContext clock, so timing never depends on setInterval jitter.
   ============================================================= */
(function () {
  const now = () => window.WIClock ? window.WIClock.now() : Date.now();
  const DIV = { none: 1, '8': 2, triplet: 3, '16': 4 };

  class ClickEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.lookahead = 0.12;
      this.timer = null;
      this.scheduledUntilTick = -1;
      this.transport = { playing: false, anchor: 0, bpm: 120, beatsPerBar: 4 };
      this.accentEnabled = true;
      this.timbre = 'wood';        // wood | beep | hihat | cowbell
      this.subdivision = 'none';   // none | 8 | triplet | 16
      this.onBeat = null;          // callback(beatInBar) on each MAIN beat
      this._beatTimers = [];
    }

    async resume() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.gain.value = 10;
        this.master.connect(this.ctx.destination);
        this._sync();
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this._sync();
      return this.ctx.state;
    }

    _sync() { if (this.ctx) this.epochOfCtxZero = now() - this.ctx.currentTime * 1000; }
    _epochToCtx(epochMs) { return (epochMs - this.epochOfCtxZero) / 1000; }

    setVolume(v) { if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02); }
    setTimbre(t) { this.timbre = t; }
    setAccent(on) { this.accentEnabled = !!on; }
    setSubdivision(s) {
      this.subdivision = s;
      if (this.ctx && this.transport.playing) this._reseek();
    }

    setTransport(t) {
      this.transport = Object.assign({}, this.transport, t);
      if (!this.ctx) return;
      if (this.transport.playing && !this.timer) this._startLoop();
      if (!this.transport.playing) this._stopLoop();
      if (this.transport.playing) this._reseek();
    }

    _div() { return DIV[this.subdivision] || 1; }
    _reseek() {
      const div = this._div();
      const tickMs = (60000 / this.transport.bpm) / div;
      const elapsed = now() - this.transport.anchor;
      this.scheduledUntilTick = Math.max(-1, Math.floor(elapsed / tickMs));
    }

    _startLoop() {
      this._sync(); this._reseek();
      this.timer = setInterval(() => this._schedule(), 25);
      this._schedule();
    }
    _stopLoop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      this._beatTimers.forEach(clearTimeout); this._beatTimers = [];
    }

    _schedule() {
      if (!this.transport.playing || !this.ctx) return;
      this._sync(); // keep epoch→AudioContext mapping fresh as WIClock offset converges
      const { anchor, bpm, beatsPerBar } = this.transport;
      const div = this._div();
      const tickMs = (60000 / bpm) / div;
      const horizonEpoch = now() + this.lookahead * 1000;
      let next = this.scheduledUntilTick + 1;
      const minTick = Math.floor((now() - anchor) / tickMs);
      if (next < minTick) next = minTick;
      while (true) {
        const tickEpoch = anchor + next * tickMs;
        if (tickEpoch > horizonEpoch) break;
        const when = this._epochToCtx(tickEpoch);
        const isMain = next % div === 0;
        const beatIndex = next / div;
        if (when > this.ctx.currentTime - 0.02) {
          if (isMain) {
            const accent = (beatIndex % beatsPerBar) === 0;
            this._click(when, accent, 1);
            // fire beat callback (for vibration / external sync)
            if (this.onBeat) {
              const delay = Math.max(0, tickEpoch - now());
              const bib = ((Math.round(beatIndex) % beatsPerBar) + beatsPerBar) % beatsPerBar;
              const id = setTimeout(() => { try { this.onBeat(bib); } catch (e) {} }, delay);
              this._beatTimers.push(id);
            }
          } else {
            this._click(when, false, 0.42);  // subdivision — quieter
          }
        }
        this.scheduledUntilTick = next;
        next++;
      }
      // keep beat-timer list from growing
      if (this._beatTimers.length > 64) this._beatTimers = this._beatTimers.slice(-32);
    }

    _click(when, accent, vol) {
      const ctx = this.ctx;
      const t = Math.max(when, ctx.currentTime + 0.001);
      const g = ctx.createGain();
      g.connect(this.master);
      const acc = accent && this.accentEnabled;
      const V = vol == null ? 1 : vol;

      if (this.timbre === 'beep') {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = acc ? 1760 : 1100;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime((acc ? 0.5 : 0.32) * V, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        o.connect(g); o.start(t); o.stop(t + 0.06);
      } else if (this.timbre === 'hihat') {
        const dur = acc ? 0.06 : 0.035;
        const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = acc ? 8000 : 9000;
        g.gain.setValueAtTime((acc ? 0.55 : 0.34) * V, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(hp); hp.connect(g); src.start(t); src.stop(t + dur);
      } else if (this.timbre === 'cowbell') {
        // two detuned square waves through a bandpass — classic cowbell
        const o1 = ctx.createOscillator(); o1.type = 'square'; o1.frequency.value = acc ? 845 : 560;
        const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = acc ? 1290 : 845;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = acc ? 900 : 620; bp.Q.value = 1.2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime((acc ? 0.5 : 0.32) * V, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o1.connect(bp); o2.connect(bp); bp.connect(g);
        o1.start(t); o2.start(t); o1.stop(t + 0.2); o2.stop(t + 0.2);
      } else {
        // 'wood' — woodblock
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(acc ? 1300 : 880, t);
        o.frequency.exponentialRampToValueAtTime(acc ? 900 : 620, t + 0.03);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime((acc ? 0.6 : 0.4) * V, t + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        o.connect(g); o.start(t); o.stop(t + 0.08);
      }
    }

    tick(accent) {
      if (!this.ctx) return;
      this._click(this.ctx.currentTime + 0.005, !!accent, 1);
    }

    getCtx() { return this.ctx; }
  }

  window.WIClick = new ClickEngine();
})();
