/* =========================================================================
   THE HOLLOW HOUSE — audio.js
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

    /* ================= MUSIC BED ================= */
    // Dark drone (A + Bb cluster) that thickens as the countdown runs
    {
      const out = bus(1, 0, 0.25, 0.2);
      const lp = filt('lowpass', 300, 1.1);
      const lfo = osc('sine', 0.09, 0, DUR); const lg = ac.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency);
      for (const [f, type] of [[55, 'sawtooth'], [58.27, 'sawtooth'], [82.4, 'triangle'], [41.2, 'sine']]) {
        const o = osc(type, f, 0, DUR); o.detune.value = (U.hash(f) - 0.5) * 14; o.connect(lp);
      }
      const gN = ac.createGain();
      env(gN.gain, [[0, 0.0], [0.3, 0.07], [5, 0.05], [16, 0.07], [19.8, 0.1], [26.6, 0.08], [41, 0.11], [54.6, 0.13], [62, 0.1], [72.3, 0.14], [74, 0.08], [DUR, 0.05]]);
      lp.connect(gN).connect(out);
    }
    // Pulse: a muted low "heartbeat" that speeds up with the countdown
    {
      let t = 5.3;
      while (t < DUR - 1) {
        const k = U.clamp((t - 5) / 70);
        const lvl = t < 26.6 ? 0.22 : 0.32 + k * 0.25;
        for (const [dt, a] of [[0, 1], [0.16, 0.6]]) {
          const tt = t + dt;
          const o = osc('sine', 60, tt, 0.3); o.frequency.exponentialRampToValueAtTime(38, tt + 0.2);
          o.connect(amp(tt, [[0, 0], [0.008, lvl * a], [0.22, 0]])).connect(bus(1));
        }
        t += t < 26.6 ? 1.1 : U.lerp(0.95, 0.5, U.clamp((t - 26.6) / 46));
      }
    }
    // A sparse music-box-like motif during the calm "3 AM" section
    {
      const mel = [76, 72, 69, 71, 72, 69, 64, 65, 64];
      mel.forEach((m, i) => {
        const t = 5.4 + i * 1.18;
        if (t > 16) return;
        const f = U.mtof(m), b = bus(1, 0.2, 0.7, 0.3);
        osc('sine', f, t, 1.6).connect(amp(t, [[0, 0], [0.004, 0.07], [1.5, 0]])).connect(b);
        osc('sine', f * 2.01, t, 0.6).connect(amp(t, [[0, 0], [0.003, 0.025], [0.4, 0]])).connect(b);
      });
    }
    // tension strings
    strings(13.4, 16.1, [440, 466.2], 0.025, -0.2);
    strings(19.8, 23.0, [622.3, 659.3, 880], 0.03, 0.1);
    strings(35.0, 39.3, [233.1, 246.9], 0.03, 0);
    strings(43.0, 45.0, [880, 932.3, 1318.5], 0.035, 0);
    strings(53.7, 57.6, [587.3, 622.3, 830.6], 0.035, 0);
    strings(66.0, 71.0, [1174.7, 1244.5, 1661.2], 0.03, 0);
    strings(75.0, DUR, [440, 466.2, 698.5, 739.9], 0.045, 0);

    /* ================= SOUND EFFECTS ================= */
    // impact on every red "hit" word
    TL.hits.forEach((t) => boom(t, 0.55));
    // whoosh into every cut
    TL.shots.forEach(([a]) => { if (a > 0.5) whoosh(a, 0.3, 0.07); });
    // the opening: knife shing + "one minute"
    {
      const t = 0.3, b = bus(1, 0.3, 0.5);
      noise(WHITE, t, 0.6, 7).connect(filt('bandpass', 6000, 3)).connect(amp(t, [[0, 0], [0.02, 0.18], [0.5, 0]])).connect(b);
      for (const f of [3520, 5280]) osc('sine', f, t, 1.2).connect(amp(t, [[0, 0], [0.01, 0.03], [1.1, 0]])).connect(b);
      boom(3.77, 0.7, 60);
      for (let i = 0; i < 4; i++) click(3.9 + i * 0.3, 0.35, 2500);
    }
    // clock ticking in the flat (3 AM)
    for (let t = 6.73; t < 16.1; t += 1) click(t, 0.12, 4000);
    // the murder: struggle, stab, a muffled scream across the estate
    {
      const t = TL.stab;
      whoosh(t, 0.25, 0.3);
      thud(t + 0.02, 0.8, 400);
      const sc = osc('sawtooth', 700, t - 0.9, 1.0); env(sc.frequency, [[t - 0.9, 650], [t - 0.5, 900], [t, 700]]);
      sc.connect(filt('bandpass', 1100, 3)).connect(filt('lowpass', 1500)).connect(amp(t - 0.9, [[0, 0], [0.1, 0.05], [0.85, 0.06], [0.9, 0]])).connect(bus(1, 0.3, 0.6, 0.4));
      strings(t, 19.8, [311.1, 329.6, 466.2], 0.04, 0);
    }
    // mug slips and smashes
    whoosh(TL.mugSmash, 0.7, 0.1, false);
    if (!VO) shatter(TL.mugSmash); else thud(TL.mugSmash, 0.4, 500);
    // light switch, lamp, curtains
    click(TL.lightOff, 0.8 * SYN, 2200); click(TL.lightOff + 0.03, 0.5 * SYN, 1400);
    boom(TL.lightOff + 0.02, 0.3, 50);
    click(TL.lampOff, 0.6, 2600);
    {
      const [a, b] = TL.curtainShut;
      const src = noise(WHITE, a, b - a + 0.1, 33);
      src.connect(filt('bandpass', 1400, 0.8)).connect(amp(a, [[0, 0], [0.1, 0.25], [b - a - 0.1, 0.2], [b - a + 0.1, 0]])).connect(bus(1, 0, 0.2));
      for (let i = 0; i < 6; i++) click(a + 0.05 + i * 0.12, 0.12, 5000); // curtain rings
    }
    // countdown ticks (the timer box, top right)
    TL.ticks.forEach((t, i) => {
      const f = i % 2 ? 1500 : 1900;
      osc('square', f, t, 0.05).connect(filt('bandpass', f, 4)).connect(amp(t, [[0, 0], [0.002, 0.06], [0.04, 0]])).connect(bus(1, 0.4, 0.05));
    });
    // main door downstairs bangs (distant)
    TL.mainBangs.forEach((t) => thud(t, 0.9 * SYN, 200, 0.4));
    // footsteps on the stairs (getting louder)
    TL.stairSteps.forEach((t, i) => {
      const lvl = (0.35 + (i / TL.stairSteps.length) * 0.6) * SYN;
      noise(BROWN, t, 0.2, i).connect(filt('lowpass', 300)).connect(amp(t, [[0, 0], [0.005, lvl], [0.12, 0]])).connect(bus(1, 0, 0.5));
      noise(WHITE, t, 0.05, i + 9).connect(filt('bandpass', 2000, 2)).connect(amp(t, [[0, 0], [0.002, lvl * 0.15], [0.04, 0]])).connect(bus(1, 0, 0.5));
    });
    // polite knock, then the blows
    TL.knocks.forEach((t) => thud(t, 0.55 * SYN, 900));
    TL.blows.forEach((t, i) => { thud(t, (1.1 + i * 0.03) * (VO ? 0.6 : 1), 220, 0.2); chainRattle(t + 0.02, 0.5, 0.25 * SYN); });
    chainRattle(49.33, 1.6, 0.35 * (VO ? 0.6 : 1));
    {
      const t = TL.doorCrack; // wood splitting
      const src = noise(WHITE, t, 0.6, 77);
      const am = osc('square', 60, t, 0.6); const ag = ac.createGain(); ag.gain.value = 0.5;
      const vca = ac.createGain(); vca.gain.value = 0.5; am.connect(ag).connect(vca.gain);
      src.connect(filt('bandpass', 1300, 1.2)).connect(vca).connect(amp(t, [[0, 0], [0.004, 0.9], [0.3, 0.3], [0.6, 0]])).connect(bus(1, 0, 0.3));
      boom(t, 0.8, 55);
    }
    // window latch + freezing wind
    click(TL.windowOpen - 0.05, 0.6, 1800);
    {
      const src = noise(WHITE, TL.windowOpen, 75 - TL.windowOpen, 61);
      const bp = filt('bandpass', 500, 4);
      const lfo = osc('sine', 0.3, TL.windowOpen, 20); const lg = ac.createGain(); lg.gain.value = 300; lfo.connect(lg).connect(bp.frequency);
      const gN = ac.createGain();
      env(gN.gain, [[TL.windowOpen, 0], [TL.windowOpen + 0.6, 0.35], [62, 0.3], [66, 0.22], [71, 0.25], [71.05, 0.08], [72.3, 0.08], [74, 0.3], [75, 0.0]]);
      src.connect(bp).connect(gN).connect(bus(1, -0.2, 0.2));
      const g2 = noise(BROWN, TL.windowOpen, 75 - TL.windowOpen, 62);
      g2.connect(filt('lowpass', 400)).connect(amp(TL.windowOpen, [[0, 0], [0.6, 0.35], [11.8, 0.25], [15.8, 0]])).connect(bus(1));
    }
    // vertigo riser looking down
    {
      const a = 66.0, b = 68.3;
      const src = noise(WHITE, a, b - a, 12);
      const bp = filt('bandpass', 300, 2); env(bp.frequency, [[a, 300], [b, 3000]]);
      src.connect(bp).connect(amp(a, [[0, 0], [b - a - 0.05, 0.18], [b - a, 0]])).connect(bus(1));
    }
    // the door comes off its hinges
    {
      const t = TL.burst;
      boom(t, 1.3, 50);
      thud(t, 1.3, 500);
      noise(WHITE, t, 1.6, 90).connect(filt('lowpass', 3000)).connect(amp(t, [[0, 0], [0.004, 0.8], [0.4, 0.25], [1.5, 0]])).connect(bus(1, 0, 0.4, 0.4));
      for (let i = 0; i < 8; i++) thud(t + 0.35 + U.hash(i) * 0.9, 0.25, 900); // debris
      strings(t, 74, [523.3, 554.4, 784, 830.6], 0.05, 0);
    }
    // glitch hits + final sting
    TL.glitches.forEach((t) => glitchSfx(t));
    boom(77.0, 1.1, 45);
    {
      const t = 77.05; // high screech under the last shot
      for (const f of [1760, 1864.7, 2637]) osc('sawtooth', f, t, 1.6).connect(filt('lowpass', 5000)).connect(amp(t, [[0, 0], [0.05, 0.025], [1.5, 0.02], [1.6, 0]])).connect(bus(1, 0, 0.3, 0.5));
    }

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
