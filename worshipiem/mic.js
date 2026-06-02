/* =============================================================
   WorshipIEM — Mic capture (host side)
   ----------------------------------------------------------------
   Captures the host's microphone (a Bluetooth headset/mic is just
   another input device the browser exposes via getUserMedia). We
   read a live RMS level for the on-screen meter and broadcast that
   level to listeners so they see a "leader is speaking" indicator.

   In PRODUCTION the captured MediaStream is published to each
   listener over a WebRTC PeerConnection. Each listener gets their
   own RTCPeerConnection via addListener(id).
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
      this._pcs = new Map();     // listenerId → RTCPeerConnection
      this._transport = null;
      this._registeredTransport = null;
      this._live = true;         // is the mic currently "on air" (open mic, or PTT held)
      this._targets = [];        // [] = whole band; else only these listener ids hear audio
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
      this._pcs.forEach(pc => { try { pc.close(); } catch (_) {} });
      this._pcs.clear();
    }

    setTransport(t) {
      this._transport = t;
      if (this._registeredTransport === t) return;
      this._registeredTransport = t;
      t.on('rtc-answer', (p) => {
        const pc = this._pcs.get(p.id);
        if (pc && p.sdp) pc.setRemoteDescription(new RTCSessionDescription(p.sdp)).catch(() => {});
      });
      t.on('rtc-ice', (p) => {
        const pc = this._pcs.get(p.id);
        if (pc && p.candidate) pc.addIceCandidate(new RTCIceCandidate(p.candidate)).catch(() => {});
      });
    }

    async addListener(id) {
      if (!this.stream || !this._transport) return;
      if (this._pcs.has(id)) { this._pcs.get(id).close(); }
      const iceConfig = window.WIIceConfig || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const pc = new RTCPeerConnection(iceConfig);
      this._pcs.set(id, pc);
      this.stream.getAudioTracks().forEach(t => pc.addTrack(t, this.stream));
      pc.onicecandidate = (e) => {
        if (e.candidate && this._transport)
          this._transport.send('rtc-ice', { to: id, candidate: e.candidate.toJSON() });
      };
      // Honour current on-air + targeting state for this new peer immediately.
      this._applyRouting(id, pc);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this._transport.send('rtc-offer', { to: id, sdp: pc.localDescription });
      } catch (e) {}
    }

    removeListener(id) {
      const pc = this._pcs.get(id);
      if (pc) { pc.close(); this._pcs.delete(id); }
    }

    /* Per-listener audio isolation. A listener hears audio only when the mic is
       on-air AND (no targets set, or it is one of the targets). We gate at the
       RTCRtpSender via replaceTrack — track.enabled is shared across every peer,
       so it can't isolate; replaceTrack(null) genuinely sends silence to one
       peer while others keep the live track. */
    _applyRouting(id, pc) {
      const track = this.stream && this.stream.getAudioTracks()[0];
      const wants = this._live && (this._targets.length === 0 || this._targets.includes(id));
      const sender = pc.getSenders().find(s => !s.track || (s.track && s.track.kind === 'audio'));
      if (!sender) return;
      const desired = wants ? (track || null) : null;
      if (sender.track === desired) return;
      try { sender.replaceTrack(desired); } catch (_) {}
    }

    /* live = mic on-air (open mic, or PTT held); targets = [] for whole band */
    setRouting(live, targets) {
      this._live = !!live;
      this._targets = Array.isArray(targets) ? targets : [];
      this._pcs.forEach((pc, id) => this._applyRouting(id, pc));
    }

    /* kept for back-compat — global on-air toggle with no targeting */
    setPttEnabled(enabled) { this.setRouting(enabled, this._targets); }
  }

  window.WIMic = new MicEngine();
})();
