/* =========================================================================
   STOPPED SPINNING — audio.js
   The synthesised layer, rendered once in an OfflineAudioContext: a warm pad
   under the afternoon; then the spin itself as a hum whose pitch follows
   Earth's spin speed, winding down like a record slowing to a stop, with a
   clock tick every quarter-day of the time-lapse and a whoosh at each
   sunrise and sunset; a thud when it stops; a thin heat drone through the
   six-month day; a falling chord for the sunset; a cold drone for the night;
   one low pulse when its eyes catch the light; then the ring after the cut
   and the end-card drone. Recorded effects (afternoon street, cicadas, hot
   wind, crickets, a breath) are mixed with the narration by mix.py.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL } = g;
  const K = TL.k;

  function makeNoise(ac, seconds, seed) {
    const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const r = U.mulberry32(seed + c * 977), d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = r() * 2 - 1; }
    return buf;
  }
  function makeImpulse(ac, seconds, decay, seed) {
    const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const r = U.mulberry32(seed + c * 31), d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1); }
    return buf;
  }

  async function renderSoundtrack(sampleRate = 48000) {
    const DUR = TL.DURATION, at = TL.at, end = TL.end, T_L = TL.T_L, T_S = TL.T_S;
    const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);
    const WHITE = makeNoise(ac, 4, 41);
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    master.connect(comp).connect(ac.destination);
    master.gain.setValueAtTime(0.9, DUR - 0.6); master.gain.linearRampToValueAtTime(0, DUR - 0.02);
    const bed = ac.createGain(), duck = ac.createGain(); bed.connect(duck).connect(master);
    const VO = window.VOICE || null;
    if (VO) for (const [a, b] of VO.segments) { duck.gain.setTargetAtTime(0.5, Math.max(0, a - 0.1), 0.08); duck.gain.setTargetAtTime(1, b + 0.05, 0.35); }
    const rev = ac.createConvolver(); rev.buffer = makeImpulse(ac, 3.5, 2.0, 5);
    const revOut = ac.createGain(); revOut.gain.value = 0.45; rev.connect(revOut).connect(bed);
    const cache = new Map();
    function bus(gain, pan = 0, sendRev = 0, dest = bed) {
      const key = [gain, pan, sendRev, dest === bed ? 'b' : 'm'].join('|'); if (cache.has(key)) return cache.get(key);
      const gN = ac.createGain(); gN.gain.value = gain; const p = ac.createStereoPanner(); p.pan.value = pan; gN.connect(p).connect(dest);
      if (sendRev) { const s = ac.createGain(); s.gain.value = sendRev; p.connect(s).connect(rev); }
      cache.set(key, gN); return gN;
    }
    function noise(buf, t, dur) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(Math.max(0, t)); s.stop(Math.max(0, t) + dur); return s; }
    function filt(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    function osc(type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(Math.max(0, t)); o.stop(Math.max(0, t) + dur); return o; }
    function env(param, pts) { param.setValueAtTime(pts[0][1], Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0])); }
    function amp(t, pts) { const gN = ac.createGain(); gN.gain.value = 0; env(gN.gain, pts.map(([dt, v]) => [t + dt, v])); return gN; }

    /* a warm pad under the still afternoon */
    {
      const lp = filt('lowpass', 1000, 0.6), gN = ac.createGain();
      for (const m of [50, 57, 62, 66, 69]) for (const dt of [-5, 6]) { const o = osc('sawtooth', U.mtof(m), 0, T_L + 2); o.detune.value = dt; o.connect(lp); }
      env(gN.gain, [[0, 0], [1.5, 0.011], [T_L, 0.011], [T_L + 1.5, 0]]);
      lp.connect(gN).connect(bus(1, 0, 0.4));
    }
    /* the spin: a hum that winds down with Earth's spin, like a record slowing to a stop */
    {
      const a = T_L - 0.5, b = T_S + 0.4, lp = filt('lowpass', 700, 1.2), gN = ac.createGain();
      const pts = []; for (let t = a; t <= b; t += 0.1) pts.push([t, 0.15 + 0.85 * TL.speed(Math.max(t, T_L)) / 1670]);
      for (const [base, ty, l] of [[55, 'sawtooth', 1], [110, 'square', 0.35], [82.5, 'triangle', 0.6]]) {
        const o = osc(ty, base, a, b - a), og = ac.createGain(); og.gain.value = l;
        env(o.frequency, pts.map(([t, k]) => [t, base * k])); o.connect(og).connect(lp);
      }
      env(lp.frequency, [[a, 300], [T_L + 2, 900], [T_S, 160]]);
      env(gN.gain, [[a, 0], [T_L + 1.5, 0.05], [T_S - 3, 0.05], [T_S, 0.035], [b, 0]]);
      lp.connect(gN).connect(bus(1, 0, 0.3));
    }
    /* the time-lapse: a clock tick every quarter-day, a whoosh at every sunrise and sunset */
    {
      let last = TL.phi(T_L);
      for (let t = T_L; t < T_S; t += 1 / 400) {
        const p = TL.phi(t);
        if (Math.floor(p * 4) !== Math.floor(last * 4)) {
          const q = Math.floor(p * 4) % 2, o = osc('square', q ? 1800 : 1400, t, 0.05);
          o.connect(filt('bandpass', q ? 1800 : 1400, 6)).connect(amp(t, [[0, 0], [0.002, 0.05], [0.04, 0]])).connect(bus(1, q ? 0.25 : -0.25, 0.3));
        }
        if (Math.floor(p * 2) !== Math.floor(last * 2)) {
          const s = noise(WHITE, t - 0.45, 1.1), bp = filt('bandpass', 400, 0.9);
          env(bp.frequency, [[t - 0.45, 300], [t, 2200], [t + 0.6, 500]]);
          s.connect(bp).connect(amp(t - 0.45, [[0, 0], [0.45, 0.07], [1.1, 0]])).connect(bus(1, Math.floor(p * 2) % 2 ? 0.5 : -0.5, 0.4));
        }
        last = p;
      }
    }
    /* it stops: a heavy thud */
    {
      const o = osc('sine', 60, T_S, 2.5); o.frequency.exponentialRampToValueAtTime(24, T_S + 2);
      o.connect(amp(T_S, [[0, 0], [0.01, 0.34], [2.3, 0]])).connect(bus(1, 0, 0.3));
      noise(WHITE, T_S, 0.4).connect(filt('lowpass', 900)).connect(amp(T_S, [[0, 0], [0.005, 0.12], [0.35, 0]])).connect(bus(1, 0, 0.5));
    }
    /* the six-month day: a thin, high heat drone and a low hum */
    {
      const a = T_S + 0.8, b = end(18) + 1.5;
      [[88, 0.004], [95, 0.003], [100, 0.0025]].forEach(([m, l], i) => {
        const o = osc('sine', U.mtof(m), a, b - a), lfo = osc('sine', 0.13 + i * 0.07, a, b - a), lg = ac.createGain(); lg.gain.value = 9; lfo.connect(lg).connect(o.detune);
        o.connect(amp(a, [[0, 0], [3, l], [b - a - 1.5, l], [b - a, 0]])).connect(bus(1, (i - 1) * 0.5, 0.7));
      });
      osc('triangle', 49, a, b - a).connect(filt('lowpass', 150)).connect(amp(a, [[0, 0], [3, 0.04], [b - a - 1.5, 0.04], [b - a, 0]])).connect(bus(1, 0, 0.2));
    }
    /* the sunset: a falling minor chord */
    {
      const a = at(18) - 0.2, b = at(20) + 1;
      [57, 60, 64, 69].forEach((m, i) => { for (const dt of [-6, 7]) {
        const o = osc('sawtooth', U.mtof(m), a, b - a); o.detune.value = dt; env(o.detune, [[a, dt], [b, dt - 200]]);
        o.connect(filt('lowpass', 1100)).connect(amp(a, [[0, 0], [2, 0.006], [b - a - 1.5, 0.006], [b - a, 0]])).connect(bus(1, (i - 1.5) * 0.35, 0.7));
      } });
    }
    /* the long night: a cold, low drone */
    {
      const a = end(19), b = TL.CUT + 0.1, lp = filt('lowpass', 220, 0.9), gN = ac.createGain();
      for (const [f, ty] of [[41.2, 'sawtooth'], [61.7, 'triangle'], [98, 'sine']]) { const o = osc(ty, f, a, b - a); o.detune.value = (U.hash(f) - 0.5) * 10; o.connect(lp); }
      env(gN.gain, [[a, 0], [a + 3, 0.035], [b - 0.2, 0.035], [b, 0]]);
      lp.connect(gN).connect(bus(1, 0, 0.4));
    }
    /* its eyes catch the light: one low pulse */
    {
      const t = TL.creature.stop, o = osc('sine', 42, t, 2.2); o.frequency.exponentialRampToValueAtTime(27, t + 1.9);
      o.connect(amp(t, [[0, 0], [0.02, 0.2], [2.0, 0]])).connect(bus(1, 0, 0.2, master));
    }
    /* after the cut: a thin ring; a low drone under the end cards */
    {
      const t = TL.CUT + 0.3;
      osc('sine', 6000, t, 5.5).connect(amp(t, [[0, 0], [1.5, 0.01], [4.5, 0.008], [5.4, 0]])).connect(bus(1, 0, 0, master));
      const e0 = TL.blocks.find((b) => b.kind === 'teaser').t0;
      for (const f of [41.2, 61.7]) osc('triangle', f, e0, DUR - e0).connect(filt('lowpass', 200)).connect(amp(e0, [[0, 0], [1.5, 0.05], [DUR - e0 - 0.6, 0.05], [DUR - e0, 0]])).connect(bus(1, 0, 0.4, master));
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
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    return new Blob([data.buffer], { type: 'audio/wav' });
  }
  g.Sound = { renderSoundtrack, bufferToWav };
})(window);
