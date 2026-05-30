/* =============================================================
   WorshipIEM — Mic capture (host side)
   ----------------------------------------------------------------
   Captures the host's microphone (a Bluetooth headset/mic is just
   another input device the browser exposes via getUserMedia). We
   read a live RMS level for the on-screen meter and broadcast that
   level to listeners so they see a "leader is speaking" indicator.

   In PRODUCTION the captured MediaStream would be published to each
   listener over a WebRTC PeerConnection (see transport.js notes).
   Cross-tab MediaStream relay isn't possible without that, so this
   prototype streams the *level*, not the audio, and documents the
   seam where real WebRTC audio attaches.
   ============================================================= */
(function () {
  class MicEngine {
    constructor() {
      this.stream = null;
      this.ctx = null;
      this.analyser = null;
      this.data = null;
      this.raf = null;
      this.level = 0;
      this.onLevel = null;   // callback(level 0..1)
      this.deviceLabel = '';
      this.gain = 1;
    }

    get active() { return !!this.stream; }

    async connect() {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      const track = this.stream.getAudioTracks()[0];
      this.deviceLabel = track ? track.label || 'Microphone' : 'Microphone';
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.6;
      this.data = new Uint8Array(this.analyser.fftSize);
      src.connect(this.analyser);
      // NOTE: production WebRTC attach point — pc.addTrack(track, this.stream)
      this._loop();
      return this.deviceLabel;
    }

    _loop() {
      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(this.data);
        let sum = 0;
        for (let i = 0; i < this.data.length; i++) {
          const v = (this.data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / this.data.length);
        // gentle compression/normalisation for a livelier meter
        this.level = Math.min(1, Math.pow(rms * 3.2 * this.gain, 0.75));
        if (this.onLevel) this.onLevel(this.level);
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }

    setGain(g) { this.gain = g; }

    disconnect() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      if (this.ctx) this.ctx.close();
      this.stream = null; this.ctx = null; this.analyser = null;
      this.level = 0;
      if (this.onLevel) this.onLevel(0);
    }
  }

  window.WIMic = new MicEngine();
})();
