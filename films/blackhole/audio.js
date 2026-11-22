/* =========================================================================
   BLACK HOLE — audio.js
   The synthesised layer, rendered once in an OfflineAudioContext: a cold
   drone under the night; as the lens grows, two low tones beating against
   each other (gravity you can't see); a rising swell into the Moon being torn
   away and a sub drop when Earth is thrown; a dying hum when the lights go
   out; glassy shimmer while everything freezes. When the air is gone, the
   synth stops dead (no air, no sound) -- one sub pulse on "Nothing human",
   then the ring after the cut and the end-card drone. Recorded effects
   (crickets, rumble, blasts, wind, ice) are mixed with the narration by mix.py.
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
    const DUR = TL.DURATION, at = TL.at, end = TL.end;
    const AIRLESS = at(23);                       // "No sunlight. No air. No sound."
    const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);
    const WHITE = makeNoise(ac, 4, 41);
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    master.connect(comp).connect(ac.destination);
    master.gain.setValueAtTime(0.9, DUR - 0.6); master.gain.linearRampToValueAtTime(0, DUR - 0.02);
    const bed = ac.createGain(), duck = ac.createGain(); bed.connect(duck).connect(master);
    const VO = window.VOICE || null;
    if (VO) for (const [a, b] of VO.segments) { duck.gain.setTargetAtTime(0.5, Math.max(0, a - 0.1), 0.08); duck.gain.setTargetAtTime(1, b + 0.05, 0.35); }
    // no air, no sound: the whole bed stops when the air is gone
    bed.gain.setValueAtTime(1, AIRLESS - 0.6); bed.gain.linearRampToValueAtTime(0, AIRLESS + 0.1);
    const rev = ac.createConvolver(); rev.buffer = makeImpulse(ac, 4, 2.0, 5);
    const revOut = ac.createGain(); revOut.gain.value = 0.5; rev.connect(revOut).connect(bed);
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

    /* a cold, low drone under the night (A, E, a little high B) */
    {
      const lp = filt('lowpass', 180, 0.9), gN = ac.createGain();
      env(lp.frequency, [[0, 180], [at(9), 320], [TL.T_THROW, 700], [at(15), 260]]);
      for (const [f, ty] of [[55, 'sawtooth'], [82.4, 'triangle'], [110, 'sine'], [123.5, 'sine']]) { const o = osc(ty, f, 0, AIRLESS + 0.2); o.detune.value = (U.hash(f) - 0.5) * 12; o.connect(lp); }
      env(gN.gain, [[0, 0], [2.5, 0.022], [at(5), 0.026], [TL.T_THROW, 0.05], [at(15), 0.03], [AIRLESS, 0.03]]);
      lp.connect(gN).connect(bus(1, 0, 0.4));
    }
    /* gravity you can't see: two low tones beating faster and faster as the lens grows */
    {
      const a = at(5), b = end(12) + 0.6;
      const o1 = osc('sine', 41, a, b - a), o2 = osc('sine', 41.3, a, b - a);
      env(o2.frequency, [[a, 41.3], [TL.T_MOON, 43.5], [TL.T_THROW, 46]]);
      const gN = amp(a, [[0, 0], [TL.T_MOON - a, 0.16], [TL.T_THROW - a + 0.2, 0.26], [b - a, 0]]);
      o1.connect(gN); o2.connect(gN); gN.connect(bus(1, 0, 0.2));
      // and a thin, high, uneasy whine that bends down with them
      const w = osc('sine', 1760, a + 2, b - a - 2); env(w.frequency, [[a + 2, 1760], [TL.T_THROW, 1320]]);
      w.connect(amp(a + 2, [[0, 0], [4, 0.004], [TL.T_THROW - a - 2, 0.009], [b - a - 2, 0]])).connect(bus(1, 0.2, 0.7));
    }
    /* the Moon torn away: a rising swell into it */
    {
      const t = TL.T_MOON, s = noise(WHITE, t - 2.2, 3.2), bp = filt('bandpass', 300, 1.2);
      env(bp.frequency, [[t - 2.2, 300], [t + 0.3, 3200], [t + 1, 600]]);
      s.connect(bp).connect(amp(t - 2.2, [[0, 0], [2.1, 0.12], [2.5, 0.04], [3.2, 0]])).connect(bus(1, -0.3, 0.5));
    }
    /* Earth thrown out of orbit: a sub drop */
    {
      const t = TL.T_THROW, o = osc('sine', 52, t, 3.5); o.frequency.exponentialRampToValueAtTime(20, t + 3);
      o.connect(amp(t, [[0, 0], [0.02, 0.6], [3.3, 0]])).connect(bus(1, 0, 0.3));
    }
    /* the lights go out: the mains hum winds down and dies */
    {
      const t = K.out - 0.35;
      for (const [f, l] of [[120, 0.012], [60, 0.02], [180, 0.006]]) {
        const o = osc('sawtooth', f, t, 1.6); o.frequency.exponentialRampToValueAtTime(f * 0.25, t + 1.4);
        o.connect(filt('lowpass', 900)).connect(amp(t, [[0, 0], [0.05, l], [0.5, l * 0.9], [1.5, 0]])).connect(bus(1, 0.1, 0));
      }
    }
    /* freezing: a faint glassy shimmer */
    {
      const a = at(15), b = AIRLESS;
      [93, 98, 100, 105].forEach((m, i) => {
        const o = osc('sine', U.mtof(m), a, b - a), l = osc('sine', 0.17 + i * 0.09, a, b - a), lg = ac.createGain(); lg.gain.value = 10; l.connect(lg).connect(o.detune);
        o.connect(amp(a, [[0, 0], [3, 0.0045], [b - a - 0.5, 0.0045], [b - a, 0]])).connect(bus(1, (i - 1.5) * 0.4, 0.8));
      });
    }
    /* "Nothing human.": one deep pulse you feel more than hear */
    {
      const t = TL.creature.stop, o = osc('sine', 40, t, 2.4); o.frequency.exponentialRampToValueAtTime(26, t + 2);
      o.connect(amp(t, [[0, 0], [0.02, 0.5], [2.2, 0]])).connect(bus(1, 0, 0.2, master));
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
