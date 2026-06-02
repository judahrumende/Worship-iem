/* =============================================================
   WorshipIEM — Advanced DAW audio orchestration
   Wraps the WIClick engine and adds: a synth guide-pad track,
   spoken voice cues (Web Speech), and a musical count-in.
   Plain JS — exposes window.DawAudio.
   ============================================================= */
(function () {
  const SOUND_TO_TIMBRE = {
    'Woodblock': 'wood', 'Beep': 'beep', 'Hi-hat': 'hihat', 'Cowbell': 'cowbell',
    'Rimshot': 'wood', 'Clap': 'hihat', 'Sine tone': 'beep',
  };

  const Pad = {
    ctx: null, gain: null, voices: [], filter: null, on: false,
    async ensure() {
      const click = window.WIClick;
      await click.resume();
      if (!this.ctx) {
        this.ctx = click.ctx;                  // share the engine's AudioContext
        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 1200;
        this.gain.connect(this.filter);
        this.filter.connect(this.ctx.destination);
      }
    },
    // key of G major guide pad
    freqs: [196.0, 246.94, 293.66, 392.0],
    async start(level) {
      await this.ensure();
      if (this.on) { this.setLevel(level); return; }
      this.on = true;
      const t = this.ctx.currentTime;
      this.voices = this.freqs.map((f, i) => {
        const o = this.ctx.createOscillator();
        o.type = i % 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 4;
        o.connect(this.gain); o.start(t);
        return o;
      });
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime((level == null ? 0.10 : level) * 0.10, t + 0.9);
    },
    setLevel(level) {
      if (!this.ctx || !this.on) return;
      const t = this.ctx.currentTime;
      this.gain.gain.linearRampToValueAtTime((level == null ? 1 : level) * 0.10, t + 0.2);
    },
    stop() {
      if (!this.ctx || !this.on) return;
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(0, t + 0.5);
      const vs = this.voices; this.voices = []; this.on = false;
      setTimeout(() => vs.forEach(o => { try { o.stop(); } catch (e) {} }), 650);
    },
  };

  /* ---- speech voice cues ---- */
  let voiceList = [];
  function loadVoices() { try { voiceList = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) {} }
  if (window.speechSynthesis) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  function pickVoice(gender) {
    if (!voiceList.length) loadVoices();
    const en = voiceList.filter(v => /en(-|_|$)/i.test(v.lang));
    const pool = en.length ? en : voiceList;
    const femaleHints = /(female|woman|samantha|victoria|karen|moira|tessa|fiona|serena|zira|susan|allison|ava|joanna|salli|kendra)/i;
    const maleHints = /(male|man|daniel|alex|fred|tom|david|mark|oliver|aaron|arthur|gordon|matthew|guy)/i;
    if (gender === 'Male') return pool.find(v => maleHints.test(v.name)) || pool.find(v => !femaleHints.test(v.name)) || pool[0];
    if (gender === 'Female') return pool.find(v => femaleHints.test(v.name)) || pool[0];
    return pool.find(v => /(neutral|google|samantha)/i.test(v.name)) || pool[0];
  }

  function speak(text, gender) {
    if (!window.speechSynthesis) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(gender);
      if (v) u.voice = v;
      u.rate = 1.02; u.pitch = gender === 'Male' ? 0.85 : gender === 'Female' ? 1.12 : 1.0;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  /* ---- count-in: N beats of accented clicks, then cb() ---- */
  let countTimers = [];
  function clearCount() { countTimers.forEach(clearTimeout); countTimers = []; }
  async function countIn(bpm, beats, beatsPerBar, onBeat, done) {
    await window.WIClick.resume();
    clearCount();
    const beatMs = 60000 / bpm;
    for (let i = 0; i < beats; i++) {
      countTimers.push(setTimeout(() => {
        const accent = (i % beatsPerBar) === 0;
        window.WIClick.tick(accent);
        if (onBeat) try { onBeat(beats - i); } catch (e) {}
      }, i * beatMs));
    }
    countTimers.push(setTimeout(() => { if (done) done(); }, beats * beatMs));
    return beats * beatMs;
  }

  window.DawAudio = {
    SOUND_TO_TIMBRE,
    pad: Pad,
    speak,
    cancelSpeak() { try { speechSynthesis.cancel(); } catch (e) {} },
    countIn, clearCount,
    hasSpeech: !!window.speechSynthesis,
  };
})();
