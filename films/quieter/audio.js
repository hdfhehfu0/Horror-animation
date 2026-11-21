/* =========================================================================
   QUIETER — audio.js
   The synthesised layer of Part 2, rendered once in an OfflineAudioContext.
   In a film about silence this layer is mostly *absence*: a soft warm pad
   under the afternoon that thins out, then your own body (heartbeat, the
   rush of blood, the phantom ringing), then true digital silence, then the
   hits when something breathes. Recorded effects (traffic, birds, wind,
   your breath, its breath) are mixed with the narration by mix.py.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL } = g;
  const Q = TL.Q;

  function makeNoise(ac, seconds, seed, brown) {
    const len = Math.floor(ac.sampleRate * seconds), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const r = U.mulberry32(seed + c * 977), d = buf.getChannelData(c); let last = 0;
      for (let i = 0; i < len; i++) { const w = r() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    }
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
    const WHITE = makeNoise(ac, 4, 11, false), BROWN = makeNoise(ac, 6, 23, true);
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    master.connect(comp).connect(ac.destination);
    master.gain.setValueAtTime(0.9, DUR - 0.6); master.gain.linearRampToValueAtTime(0, DUR - 0.02);
    const bed = ac.createGain(), duck = ac.createGain(); bed.connect(duck).connect(master);
    const VO = window.VOICE || null;
    if (VO) for (const [a, b] of VO.segments) { duck.gain.setTargetAtTime(0.5, Math.max(0, a - 0.1), 0.08); duck.gain.setTargetAtTime(1, b + 0.05, 0.35); }
    const rev = ac.createConvolver(); rev.buffer = makeImpulse(ac, 2.6, 2.4, 5);
    const revOut = ac.createGain(); revOut.gain.value = 0.4; rev.connect(revOut).connect(master);
    const cache = new Map();
    function bus(gain, pan = 0, sendRev = 0, dest = bed) {
      const key = [gain, pan, sendRev, dest === bed ? 'b' : 'm'].join('|');
      if (cache.has(key)) return cache.get(key);
      const gN = ac.createGain(); gN.gain.value = gain; const p = ac.createStereoPanner(); p.pan.value = pan;
      gN.connect(p).connect(dest);
      if (sendRev) { const s = ac.createGain(); s.gain.value = sendRev; p.connect(s).connect(rev); }
      cache.set(key, gN); return gN;
    }
    function noise(buf, t, dur, seed = 0) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(Math.max(0, t), (U.hash(t * 13 + seed) * (buf.duration - 0.1)) % buf.duration); s.stop(Math.max(0, t) + dur); return s; }
    function filt(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    function osc(type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(Math.max(0, t)); o.stop(Math.max(0, t) + dur); return o; }
    function env(param, pts) { param.setValueAtTime(pts[0][1], Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0])); }
    function amp(t, pts) { const gN = ac.createGain(); gN.gain.value = 0; env(gN.gain, pts.map(([dt, v]) => [t + dt, v])); return gN; }

    /* a warm, slow pad under the afternoon that thins out as the world goes quiet */
    {
      const lp = filt('lowpass', 900, 0.6), gN = ac.createGain();
      env(lp.frequency, [[0, 1100], [Q.still, 500], [Q.breathe1, 250]]);
      for (const m of [50, 57, 62, 64, 69]) for (const dt of [-5, 6]) { const o = osc('sawtooth', U.mtof(m), 0, Q.breathe1 + 0.2); o.detune.value = dt; o.connect(lp); }
      env(gN.gain, [[0, 0], [1.5, 0.012], [Q.still, 0.01], [Q.breathe1, 0]]);
      lp.connect(gN).connect(bus(1, 0, 0.4));
    }
    /* "But you still hear something": the phantom ring, very high and thin */
    {
      const a = Q.ring - 2.5, b = Q.heart0 + 1.2;
      for (const [f, l] of [[7800, 0.01], [7830, 0.006]]) osc('sine', f, a, b - a).connect(amp(a, [[0, 0], [2.5, l], [b - a - 1.2, l], [b - a, 0]])).connect(bus(1, 0, 0, master));
    }
    /* your heartbeat and the rush of your blood */
    {
      const t0 = Q.heart0 - 0.05, t1 = Q.heart1 + 0.4;
      for (let t = t0; t < t1; t += 0.86) {
        const lvl = Math.min(1, (t - t0) / 1.2 + 0.4, (t1 - t) / 1.2);
        for (const [dt, a] of [[0, 1], [0.17, 0.6]]) {
          const tt = t + dt, o = osc('sine', 58, tt, 0.3); o.frequency.exponentialRampToValueAtTime(34, tt + 0.2);
          o.connect(amp(tt, [[0, 0], [0.008, 0.2 * a * lvl], [0.24, 0]])).connect(bus(1, 0, 0, master));
        }
        // blood: a filtered whoosh swelling with each beat
        noise(BROWN, t, 0.7, t).connect(filt('lowpass', 240, 0.8)).connect(amp(t, [[0, 0], [0.12, 0.11 * lvl], [0.6, 0]])).connect(bus(1, 0, 0, master));
      }
    }
    /* "air molecules hitting your eardrums": a fine, faint hiss that then stops dead */
    {
      const a = Q.molecules - 0.2, b = Q.silence;
      noise(WHITE, a, b - a, 9).connect(filt('highpass', 6000)).connect(amp(a, [[0, 0], [0.8, 0.012], [b - a - 0.05, 0.012], [b - a, 0]])).connect(bus(1, 0, 0, master));
    }
    /* total silence: nothing is scheduled between Q.silence and the breath */
    /* something breathing: a sub drop on "breathing", a closer one on "right" */
    for (const [t, l] of [[Q.breath, 0.3], [Q.right, 0.4]]) {
      const o = osc('sine', 46, t, 1.5); o.frequency.exponentialRampToValueAtTime(27, t + 1.3);
      o.connect(amp(t, [[0, 0], [0.01, l], [1.4, 0]])).connect(bus(1, 0, 0, master));
    }
    {
      const t = Q.right;
      for (const f of [415.3, 440, 622.3]) osc('sawtooth', f, t, 1.4).connect(filt('lowpass', 2400)).connect(amp(t, [[0, 0], [0.02, 0.02], [1.3, 0]])).connect(bus(1, 0, 0.6, master));
    }
    /* after the cut: a thin ring, then a low drone under the end cards */
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
