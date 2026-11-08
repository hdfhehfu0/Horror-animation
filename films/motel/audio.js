/* =========================================================================
   ROOM 9 — audio.js (shares the engine of js/audio.js)
   Every sound is synthesised with the Web Audio API. The whole soundtrack is
   rendered once in an OfflineAudioContext from the TL timeline, so live
   playback, the in-browser recorder and the offline MP4 export all use the
   exact same AudioBuffer.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL } = g;

  function makeNoise(ac, seconds, seed, brown) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const r = U.mulberry32(seed + c * 977);
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = r() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
    }
    return buf;
  }

  function makeImpulse(ac, seconds, decay, seed) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const r = U.mulberry32(seed + c * 31);
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const x = i / len;
        d[i] = (r() * 2 - 1) * Math.pow(1 - x, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  function distCurve(amount) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 - 1;
      c[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    return c;
  }

  async function renderSoundtrack(sampleRate = 48000) {
    const DUR = TL.DURATION;
    const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);

    const WHITE = makeNoise(ac, 4, 11, false);
    const BROWN = makeNoise(ac, 6, 23, true);

    // ---- master chain ----
    const master = ac.createGain();
    master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.25;
    // music ducks under the narrator (segments come from js/voice-data.js when a narration exists)
    const duck = ac.createGain(); duck.gain.value = 1;
    master.connect(duck).connect(comp).connect(ac.destination);
    const VO = (typeof window !== 'undefined' && window.VOICE) || null;
    if (VO) for (const [a, b] of VO.segments) {
      duck.gain.setTargetAtTime(0.22, Math.max(0, a - 0.08), 0.05);
      duck.gain.setTargetAtTime(1, b + 0.05, 0.25);
    }
    // when the recorded sound effects are present, the synthesised doubles are kept only as low-end weight
    const SYN = VO ? 0.35 : 1;

    // fade out over the last frames
    const LVL = VO ? 0.28 : 0.9; // the score sits further back when there is a narrator
    master.gain.setValueAtTime(LVL, 0);
    master.gain.setValueAtTime(LVL, DUR - 0.8);
    master.gain.linearRampToValueAtTime(0, DUR - 0.02);

    const rev = ac.createConvolver();
    rev.buffer = makeImpulse(ac, 2.2, 2.6, 5);
    const revOut = ac.createGain(); revOut.gain.value = 0.55;
    rev.connect(revOut).connect(master);

    const bigRev = ac.createConvolver();
    bigRev.buffer = makeImpulse(ac, 3.5, 1.8, 9);
    const bigRevOut = ac.createGain(); bigRevOut.gain.value = 0.5;
    bigRev.connect(bigRevOut).connect(master);

    // ---- helpers ----
    const busCache = new Map();
    function bus(gain, pan = 0, sendRev = 0, sendBig = 0) {
      // buses are shared (cached) so thousands of short events don't each keep a mixer chain alive
      const key = [gain, pan, sendRev, sendBig].map((v) => Math.round(v * 20) / 20).join('|');
      if (busCache.has(key)) return busCache.get(key);
      const gN = ac.createGain(); gN.gain.value = gain;
      busCache.set(key, gN);
      const p = ac.createStereoPanner(); p.pan.value = pan;
      gN.connect(p).connect(master);
      if (sendRev) { const s = ac.createGain(); s.gain.value = sendRev; p.connect(s).connect(rev); }
      if (sendBig) { const s = ac.createGain(); s.gain.value = sendBig; p.connect(s).connect(bigRev); }
      return gN;
    }
    function noise(buf, t, dur, seedOff = 0) {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
      s.start(t, (U.hash(t * 13 + seedOff) * (buf.duration - 0.1)) % buf.duration);
      s.stop(t + dur);
      return s;
    }
    function filt(type, f, q = 0.7) {
      const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
    }
    function osc(type, f, t, dur) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(t + dur); return o;
    }
    function env(param, pts) { // pts: [[time, value], ...] absolute
      param.setValueAtTime(pts[0][1], Math.max(0, pts[0][0]));
      for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0]));
    }
    function amp(t, pts) { const gN = ac.createGain(); gN.gain.value = 0; env(gN.gain, pts.map(([dt, v]) => [t + dt, v])); return gN; }


    function strings(t0, t1, freqs, peak, pan = 0) {
      const out = bus(1, pan, 0.6, 0.3);
      const lp = filt('lowpass', 3200, 0.5);
      const gN = ac.createGain();
      env(gN.gain, [[t0, 0], [t0 + (t1 - t0) * 0.6, peak * 0.6], [t1 - 0.05, peak], [t1, 0]]);
      for (const f of freqs) for (const d of [-7, 6]) {
        const o = osc('sawtooth', f, t0, t1 - t0 + 0.1); o.detune.value = d;
        const vib = osc('sine', 5.2 + U.hash(f + d) * 1.2, t0, t1 - t0 + 0.1);
        const vg = ac.createGain(); vg.gain.value = 9; vib.connect(vg).connect(o.detune);
        o.connect(lp);
      }
      lp.connect(gN).connect(out);
    }
    function boom(t, level = 1, pitch = 70) {
      const b = bus(level, 0, 0.2, 0.35);
      const k = osc('sine', pitch * 1.6, t, 1.6); k.frequency.exponentialRampToValueAtTime(pitch * 0.45, t + 1.1);
      k.connect(amp(t, [[0, 0], [0.006, 0.9], [1.4, 0]])).connect(b);
      noise(BROWN, t, 0.5, t).connect(filt('lowpass', 900)).connect(amp(t, [[0, 0], [0.004, 0.6], [0.3, 0]])).connect(b);
    }
    function whoosh(t, dur = 0.35, level = 0.18, up = true) {
      const src = noise(WHITE, t - dur, dur + 0.05, t * 3);
      const bp = filt('bandpass', 800, 1.4);
      env(bp.frequency, up ? [[t - dur, 300], [t, 4200]] : [[t - dur, 4000], [t, 300]]);
      src.connect(bp).connect(amp(t - dur, [[0, 0], [dur * 0.85, level], [dur, 0]])).connect(bus(1, 0, 0.1));
    }
    function thud(t, level = 1, lp = 260, ring = 0) { // fist / shoulder on a door
      const b = bus(level, 0, 0.25 + ring);
      const k = osc('sine', 95, t, 0.5); k.frequency.exponentialRampToValueAtTime(45, t + 0.25);
      k.connect(amp(t, [[0, 0], [0.003, 0.9], [0.3, 0]])).connect(b);
      noise(BROWN, t, 0.3, t * 7).connect(filt('lowpass', lp)).connect(amp(t, [[0, 0], [0.002, 1.2], [0.18, 0]])).connect(b);
      noise(WHITE, t, 0.08, t * 9).connect(filt('bandpass', 1800, 1.5)).connect(amp(t, [[0, 0], [0.001, 0.25], [0.05, 0]])).connect(b);
    }
    function chainRattle(t, dur, level = 0.2) {
      // one noise source, gated into fast metallic ticks
      const src = noise(WHITE, t, dur + 0.05, t * 13);
      const vca = ac.createGain(); vca.gain.value = 0;
      for (let i = 0; i < dur * 22; i++) {
        const tt = t + i / 22 + U.hash(i + t) * 0.015, a = level * (1 - i / (dur * 22)) + 0.02;
        vca.gain.setValueAtTime(a, tt); vca.gain.setTargetAtTime(0, tt + 0.004, 0.012);
      }
      src.connect(filt('bandpass', 4200, 3)).connect(vca).connect(bus(1, 0.2, 0.3));
    }
    function shatter(t) {
      const b = bus(1, 0, 0.35);
      noise(WHITE, t, 0.9, 42).connect(filt('highpass', 2500)).connect(amp(t, [[0, 0], [0.003, 0.7], [0.12, 0.2], [0.8, 0]])).connect(b);
      for (let i = 0; i < 26; i++) {
        const tt = t + U.hash(i * 1.7) * 0.6, f = 2400 + U.hash(i * 5.3) * 5200;
        osc('sine', f, tt, 0.25).connect(amp(tt, [[0, 0], [0.002, 0.08 * (1 - (tt - t))], [0.2, 0]])).connect(bus(1, U.hash(i) * 1.6 - 0.8, 0.5));
      }
      thud(t, 0.6, 600);
    }
    function glitchSfx(t) {
      const b = bus(0.8, 0, 0.1);
      const o = osc('square', 120, t, 0.3);
      const N = 16, cv = new Float32Array(N); for (let i = 0; i < N; i++) cv[i] = 80 + U.hash(t * 10 + i) * 1600;
      o.frequency.setValueCurveAtTime(cv, t, 0.28);
      o.connect(filt('bandpass', 1500, 0.8)).connect(amp(t, [[0, 0], [0.005, 0.25], [0.26, 0.2], [0.3, 0]])).connect(b);
      noise(WHITE, t, 0.3, t).connect(filt('highpass', 3000)).connect(amp(t, [[0, 0], [0.004, 0.25], [0.3, 0]])).connect(b);
    }
    function click(t, level = 0.5, f = 3200) {
      noise(WHITE, t, 0.04, t * 5).connect(filt('bandpass', f, 2)).connect(amp(t, [[0, 0], [0.001, level], [0.03, 0]])).connect(bus(1, 0.1, 0.2));
    }

    /* ================= MUSIC BED (Room 9) ================= */
    {
      const out = bus(1, 0, 0.25, 0.2);
      const lp = filt('lowpass', 280, 1.1);
      const lfo = osc('sine', 0.08, 0, DUR); const lg = ac.createGain(); lg.gain.value = 130; lfo.connect(lg).connect(lp.frequency);
      for (const [f, type] of [[49, 'sawtooth'], [51.9, 'sawtooth'], [73.4, 'triangle'], [36.7, 'sine']]) { const o = osc(type, f, 0, DUR); o.detune.value = (U.hash(f) - 0.5) * 14; o.connect(lp); }
      const gN = ac.createGain();
      env(gN.gain, [[0, 0], [0.3, 0.07], [7.6, 0.05], [20.7, 0.07], [TL.stab, 0.11], [TL.timerStart, 0.09], [49.9, 0.13], [TL.doorBang, 0.15], [DUR - 2, 0.1], [DUR, 0.05]]);
      lp.connect(gN).connect(out);
    }
    // heartbeat pulse that speeds up once the countdown starts
    {
      let t = 7.7;
      while (t < DUR - 1) {
        const k = U.clamp((t - TL.timerStart) / (DUR - TL.timerStart));
        const lvl = t < TL.timerStart ? 0.2 : 0.3 + k * 0.25;
        for (const [dt, a] of [[0, 1], [0.16, 0.6]]) {
          const tt = t + dt;
          const o = osc('sine', 60, tt, 0.3); o.frequency.exponentialRampToValueAtTime(38, tt + 0.2);
          o.connect(amp(tt, [[0, 0], [0.008, lvl * a], [0.22, 0]])).connect(bus(1));
        }
        t += t < TL.timerStart ? 1.15 : U.lerp(0.95, 0.48, k);
      }
    }
    // a lonely detuned guitar-like motif for the motel (2:47 AM section)
    [64, 67, 71, 69, 67, 64, 62, 64].forEach((m, i) => {
      const t = 7.8 + i * 1.5; if (t > 20.5) return;
      const f = U.mtof(m), b = bus(1, -0.2, 0.7, 0.3);
      const o = osc('triangle', f, t, 2); o.detune.value = 8;
      o.connect(filt('lowpass', 1800)).connect(amp(t, [[0, 0], [0.01, 0.07], [1.8, 0]])).connect(b);
    });
    strings(20.7, TL.stab, [415.3, 440], 0.03, 0);
    strings(TL.stab, 32.3, [311.1, 329.6, 466.2], 0.04, 0);
    strings(44.6, 52.6, [233.1, 246.9, 349.2], 0.035, 0);
    strings(52.6, 56.9, [880, 932.3, 1318.5], 0.035, 0);
    strings(67.0, 69.0, [587.3, 622.3], 0.03, 0);
    strings(71.8, DUR, [440, 466.2, 698.5, 739.9], 0.045, 0);

    /* ================= SOUND EFFECTS ================= */
    TL.hits.forEach((t) => boom(t, 0.55));
    TL.shots.forEach(([a]) => { if (a > 0.5) whoosh(a, 0.3, 0.07); });
    boom(TL.shots[2][0], 0.7, 60);                      // the 60 seconds card
    for (let t = TL.shots[4][0]; t < TL.shots[10][0]; t += 1) click(t, 0.06, 3500); // room clock
    // the stab across the lot
    whoosh(TL.stab, 0.25, 0.25); thud(TL.stab + 0.02, 0.6 * (VO ? 0.6 : 1), 400);
    // remote crack
    thud(TL.remoteCrack, 0.5 * SYN, 900);
    // TV and lamp off
    click(TL.tvOff, 0.6 * SYN, 2600); boom(TL.tvOff + 0.05, 0.3, 50); click(TL.lampOff, 0.7 * SYN, 2200);
    // door handles being tried
    TL.doorChecks.forEach((t) => { click(t, 0.4 * SYN, 1800); click(t + 0.12, 0.3 * SYN, 1400); });
    chainRattle(TL.handleTurn[0], TL.handleTurn[1] - TL.handleTurn[0], 0.12 * SYN);
    thud(TL.handleTurn[1], 0.6, 900);
    // countdown ticks
    TL.ticks.forEach((t, i) => { const f = i % 2 ? 1500 : 1900; osc('square', f, t, 0.05).connect(filt('bandpass', f, 4)).connect(amp(t, [[0, 0], [0.002, 0.06], [0.04, 0]])).connect(bus(1, 0.4, 0.05)); });
    // running: footfalls in the corn
    for (let t = 66.9; t < 69.0; t += 0.28) thud(t, 0.35 * SYN, 300);
    // the door bangs open, the final reveal
    boom(TL.doorBang, 1.0, 55); thud(TL.doorBang, 1.0 * SYN, 500);
    TL.glitches.forEach((t) => glitchSfx(t));
    boom(TL.maskReveal, 1.2, 45);
    for (const f of [1760, 1864.7, 2637]) osc('sawtooth', f, TL.maskReveal + 0.05, 1.8).connect(filt('lowpass', 5000)).connect(amp(TL.maskReveal + 0.05, [[0, 0], [0.05, 0.025], [1.7, 0.02], [1.8, 0]])).connect(bus(1, 0, 0.3, 0.5));

    return await ac.startRendering();
  }

  function bufferToWav(buffer) {
    const ch = buffer.numberOfChannels, len = buffer.length, sr = buffer.sampleRate;
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true);
    data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, len * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
    return new Blob([data.buffer], { type: 'audio/wav' });
  }

  g.Sound = { renderSoundtrack, bufferToWav };
})(window);
