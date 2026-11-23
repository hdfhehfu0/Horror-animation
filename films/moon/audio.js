/* =========================================================================
   MOON (first person) — audio.js
   The synthesised layer, rendered once in an OfflineAudioContext, under the
   recorded effects and the two voices (mix.py): a tense sustained drone that
   thickens as the Moon falls, a sub hit when it starts to fall, a deep groan
   as it cracks, a thump for every impact (louder the closer it lands), the
   jolt when the railing gives, a rising rush as you're pulled up, and a last
   swell that cuts to nothing.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL } = g;

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
    const DUR = TL.DURATION;
    const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);
    const WHITE = makeNoise(ac, 4, 41);
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    master.connect(comp).connect(ac.destination);
    master.gain.setValueAtTime(0.9, DUR - 0.12); master.gain.linearRampToValueAtTime(0, DUR - 0.05);   // hard cut at the end
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
    function boom(t, f0, l, len = 2.5) { const o = osc('sine', f0, t, len); o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + len * 0.9); o.connect(amp(t, [[0, 0], [0.015, l], [len - 0.1, 0]])).connect(bus(1, 0, 0.25)); }

    /* a tense drone that thickens as it falls: a low fifth, a minor second high up, a slow swell */
    {
      const lp = filt('lowpass', 220, 0.8), gN = ac.createGain();
      env(lp.frequency, [[0, 220], [5, 260], [40, 600], [66, 1100], [85, 1800]]);
      for (const [f, ty] of [[36.7, 'sawtooth'], [55, 'sawtooth'], [73.4, 'triangle'], [392, 'sine'], [415.3, 'sine']]) { const o = osc(ty, f, 0, DUR); o.detune.value = (U.hash(f) - 0.5) * 14; o.connect(lp); }
      env(gN.gain, [[0, 0], [3, 0.012], [5, 0.02], [20, 0.026], [44, 0.04], [66, 0.055], [84.9, 0.08], [85.3, 0]]);
      lp.connect(gN).connect(bus(1, 0, 0.4));
    }
    /* "And starts to fall": a sub hit */
    boom(TL.lurch, 48, 0.5, 3.2);
    /* it cracks: a deep groan sliding down, and splintering hits */
    {
      const t = 39.4, o = osc('sawtooth', 70, t, 6); o.frequency.exponentialRampToValueAtTime(34, t + 5.5);
      o.connect(filt('lowpass', 300, 2)).connect(amp(t, [[0, 0], [0.8, 0.09], [5.5, 0]])).connect(bus(1, 0, 0.5));
      for (const dt of [0.2, 1.1, 2.4, 3.6, 5.0]) { const tt = t + dt; noise(WHITE, tt, 0.4).connect(filt('bandpass', 1400, 1.5)).connect(amp(tt, [[0, 0], [0.005, 0.12], [0.35, 0]])).connect(bus(1, (U.hash(dt) - 0.5) * 1.2, 0.6)); }
    }
    /* every impact: a thump, louder and lower the closer it lands */
    for (const m of TL.meteors) { const d = Math.hypot(m.x + 9, m.z + 6), l = Math.min(0.5, 60 / d) * m.s; boom(m.t1 + d / 340, 44, l, 2.2); }
    /* the jolts: the railing giving, the bolts */
    boom(66.5, 40, 0.55, 3); boom(71.8, 36, 0.5, 3);
    /* pulled up: a rising rush */
    {
      const a = 71.6, b = 85.35, s = noise(WHITE, a, b - a), bp = filt('bandpass', 300, 0.8);
      env(bp.frequency, [[a, 250], [b, 3200]]);
      s.connect(bp).connect(amp(a, [[0, 0], [2, 0.08], [b - a - 0.4, 0.2], [b - a, 0]])).connect(bus(1, 0, 0.3));
      for (const [f0, f1] of [[110, 440], [164.8, 659]]) { const o = osc('sawtooth', f0, a, b - a); o.frequency.exponentialRampToValueAtTime(f1, b); o.connect(filt('lowpass', 1500)).connect(amp(a, [[0, 0], [3, 0.008], [b - a - 0.3, 0.02], [b - a, 0]])).connect(bus(1, 0, 0.6)); }
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
