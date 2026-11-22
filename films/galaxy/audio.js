/* =========================================================================
   GALAXY — audio.js
   The synthesised layer, rendered once in an OfflineAudioContext: a cosmic
   drone that thickens as Andromeda closes in, a glassy shimmer for the
   starburst, the two galactic "hearts" as two pulses that speed up and
   fuse, a sub hit and a warm chord for Milkomeda -- all cut dead by the
   rewind -- then the ring after the cut and the end-card drone. Recorded
   effects (crickets, desert wind, rumble, blast, rewind, breath) are mixed
   with the narration by mix.py.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL } = g;
  const K = TL.k;

  function makeNoise(ac, seconds, seed) {
    const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const r = U.mulberry32(seed + c * 977), d = buf.getChannelData(c); let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = last * 3.5; } }
    return buf;
  }
  function makeImpulse(ac, seconds, decay, seed) {
    const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const r = U.mulberry32(seed + c * 31), d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1); }
    return buf;
  }

  async function renderSoundtrack(sampleRate = 48000) {
    const DUR = TL.DURATION, at = TL.at, end = TL.end, [REW0, REW1] = TL.REW;
    const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);
    const BROWN = makeNoise(ac, 6, 23);
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    master.connect(comp).connect(ac.destination);
    master.gain.setValueAtTime(0.9, DUR - 0.6); master.gain.linearRampToValueAtTime(0, DUR - 0.02);
    const bed = ac.createGain(), duck = ac.createGain(); bed.connect(duck).connect(master);
    const VO = window.VOICE || null;
    if (VO) for (const [a, b] of VO.segments) { duck.gain.setTargetAtTime(0.5, Math.max(0, a - 0.1), 0.08); duck.gain.setTargetAtTime(1, b + 0.05, 0.35); }
    // the rewind kills the whole future in an instant
    bed.gain.setValueAtTime(1, REW0); bed.gain.linearRampToValueAtTime(0, REW0 + 0.35);
    const rev = ac.createConvolver(); rev.buffer = makeImpulse(ac, 4, 2.0, 5);
    const revOut = ac.createGain(); revOut.gain.value = 0.5; rev.connect(revOut).connect(master);
    const cache = new Map();
    function bus(gain, pan = 0, sendRev = 0, dest = bed) {
      const key = [gain, pan, sendRev, dest === bed ? 'b' : 'm'].join('|'); if (cache.has(key)) return cache.get(key);
      const gN = ac.createGain(); gN.gain.value = gain; const p = ac.createStereoPanner(); p.pan.value = pan; gN.connect(p).connect(dest);
      if (sendRev) { const s = ac.createGain(); s.gain.value = sendRev; p.connect(s).connect(rev); }
      cache.set(key, gN); return gN;
    }
    function filt(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    function osc(type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(Math.max(0, t)); o.stop(Math.max(0, t) + dur); return o; }
    function env(param, pts) { param.setValueAtTime(pts[0][1], Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0])); }
    function amp(t, pts) { const gN = ac.createGain(); gN.gain.value = 0; env(gN.gain, pts.map(([dt, v]) => [t + dt, v])); return gN; }

    /* the cosmic drone: a low fifth that opens up as the sky fills */
    {
      const lp = filt('lowpass', 160, 1.0), gN = ac.createGain();
      env(lp.frequency, [[0, 160], [at(13), 260], [K.merge, 900]]);
      for (const [f, ty] of [[32.7, 'sawtooth'], [49, 'sawtooth'], [65.4, 'triangle'], [98, 'sine']]) { const o = osc(ty, f, 0, REW0 + 0.5); o.detune.value = (U.hash(f) - 0.5) * 14; o.connect(lp); }
      env(gN.gain, [[0, 0], [2, 0.02], [at(6), 0.025], [at(13), 0.05], [K.merge, 0.08], [REW0, 0.06]]);
      lp.connect(gN).connect(bus(1, 0, 0.4));
    }
    /* starburst: glassy, detuned shimmer */
    {
      const a = at(16), b = end(17);
      [84, 88, 91, 95, 100].forEach((m, i) => {
        const o = osc('sine', U.mtof(m), a, b - a + 1), l = osc('sine', 0.25 + i * 0.11, a, b - a + 1), lg = ac.createGain(); lg.gain.value = 14; l.connect(lg).connect(o.detune);
        o.connect(amp(a, [[0, 0], [1.5, 0.01], [b - a - 0.5, 0.01], [b - a + 1, 0]])).connect(bus(1, (i - 2) * 0.35, 0.8));
      });
    }
    /* the two hearts: two pulses, one per galaxy, that speed up and fall into step */
    {
      const a = at(18), m = K.merge;
      for (const [f, ph, pan] of [[52, 0, -0.4], [46, 0.43, 0.4]]) {
        let t = a + ph * 0.5;
        while (t < m - 0.05) {
          const k = U.clamp((t - a) / (m - a)), o = osc('sine', f, t, 0.35); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.25);
          o.connect(amp(t, [[0, 0], [0.01, 0.16 + 0.14 * k], [0.3, 0]])).connect(bus(1, pan * (1 - k), 0.2));
          t += U.lerp(1.1, 0.32, k) + ph * (1 - k) * 0.2;
        }
      }
    }
    /* the merge: a sub drop, then a warm, wide chord for Milkomeda */
    {
      const t = K.merge, o = osc('sine', 44, t, 3); o.frequency.exponentialRampToValueAtTime(24, t + 2.5);
      o.connect(amp(t, [[0, 0], [0.01, 0.55], [2.8, 0]])).connect(bus(1, 0, 0.3));
      [53, 57, 60, 64, 69].forEach((m, i) => { for (const dt of [-6, 7]) { const s = osc('sawtooth', U.mtof(m), t + 0.4, REW0 - t); s.detune.value = dt; s.connect(filt('lowpass', 1400)).connect(amp(t + 0.4, [[0, 0], [2.2, 0.008], [REW0 - t - 0.6, 0.008], [REW0 - t - 0.4, 0]])).connect(bus(1, (i - 2) * 0.3, 0.7)); } });
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
