/* =========================================================================
   DARKER — audio.js
   The synthesised layer of the soundtrack, rendered once in an
   OfflineAudioContext from the TL cues: an afternoon of birds and wind, the
   streetlights' hum, a drone that grows as the colour drains, a heartbeat
   in the dark, glassy shimmer for the phosphenes, the sting, and the ringing
   after the cut. The recorded effects (crickets, the lamps dying, the
   breath) are mixed with the narration by mix.py.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL } = g;

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
    const DUR = TL.DURATION, D = TL.D;
    const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);
    const WHITE = makeNoise(ac, 4, 11, false), BROWN = makeNoise(ac, 6, 23, true);
    const master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    master.connect(comp).connect(ac.destination);
    master.gain.setValueAtTime(0.9, DUR - 0.6); master.gain.linearRampToValueAtTime(0, DUR - 0.02);
    // the bed ducks a little under the narrator
    const bed = ac.createGain(); const duck = ac.createGain(); bed.connect(duck).connect(master);
    const VO = window.VOICE || null;
    if (VO) for (const [a, b] of VO.segments) { duck.gain.setTargetAtTime(0.45, Math.max(0, a - 0.1), 0.08); duck.gain.setTargetAtTime(1, b + 0.05, 0.35); }
    const rev = ac.createConvolver(); rev.buffer = makeImpulse(ac, 3.2, 2.2, 5);
    const revOut = ac.createGain(); revOut.gain.value = 0.45; rev.connect(revOut).connect(master);

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

    /* ---- afternoon: wind + birdsong, fading with the light ---- */
    {
      const w = noise(BROWN, 0, D.duskEnd + 2, 1), lp = filt('lowpass', 500, 0.5);
      env(lp.frequency, [[0, 700], [D.overcast, 420], [D.duskEnd, 260]]);
      w.connect(lp).connect(amp(0, [[0, 0], [0.4, 0.14], [D.dusk, 0.1], [D.duskEnd + 2, 0]])).connect(bus(1, 0, 0.1));
      for (let i = 0; i < 46; i++) {           // little chirps, thinning out towards dusk
        const t = U.hash(i * 3.3) * D.dusk, f = 2600 + U.hash(i * 7.1) * 2400, n = 2 + Math.floor(U.hash(i) * 3);
        for (let k = 0; k < n; k++) {
          const tt = t + k * 0.09, o = osc('sine', f, tt, 0.08);
          o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * (1.25 + U.hash(i + k) * 0.3), tt + 0.06);
          o.connect(amp(tt, [[0, 0], [0.01, 0.06 * (1 - t / D.dusk * 0.7)], [0.07, 0]])).connect(bus(1, U.hash(i) * 1.4 - 0.7, 0.3));
        }
      }
    }
    /* ---- the streetlights: a mains hum while they're lit ---- */
    TL.lamps.forEach((L, i) => {
      const t0 = L.on, t1 = L.off;
      const o = osc('sawtooth', 120, t0, t1 - t0 + 0.1);
      o.connect(filt('bandpass', 240, 3)).connect(amp(t0, [[0, 0], [0.6, 0.012 / (i + 1)], [t1 - t0 - 0.05, 0.012 / (i + 1)], [t1 - t0, 0]])).connect(bus(1, i % 2 ? -0.3 : 0.3));
    });
    /* ---- the drone: comes in as the colour drains, deepens with every stage ---- */
    {
      const lp = filt('lowpass', 300, 1.2), gN = ac.createGain();
      env(lp.frequency, [[D.drain0, 180], [D.moonGone1, 320], [D.hand1, 520], [TL.CUT, 700]]);
      for (const [f, ty] of [[36.7, 'sawtooth'], [38.9, 'sawtooth'], [55, 'triangle'], [73.4, 'sine']]) { const o = osc(ty, f, D.drain0, TL.CUT - D.drain0 + 0.1); o.detune.value = (U.hash(f) - 0.5) * 12; o.connect(lp); }
      env(gN.gain, [[D.drain0, 0], [D.drain1 + 1, 0.022], [D.moonGone1, 0.03], [D.hand1, 0.04], [TL.CUT - 0.05, 0.05], [TL.CUT, 0]]);
      lp.connect(gN).connect(bus(1, 0, 0.3));
    }
    /* ---- eyes: a low pulse each time a pair opens ---- */
    TL.eyes.forEach((e) => { const o = osc('sine', 55, e.t0, 1.2); o.frequency.exponentialRampToValueAtTime(32, e.t0 + 1); o.connect(amp(e.t0, [[0, 0], [0.02, 0.11], [1.1, 0]])).connect(bus(1, 0, 0.3)); });
    /* ---- the creature passing: leaves and a snapped twig ---- */
    {
      const c = TL.creature;
      noise(WHITE, c.t0, c.t1 - c.t0 + 0.6, 3).connect(filt('bandpass', 2400, 0.8)).connect(amp(c.t0, [[0, 0], [0.3, 0.05], [c.t1 - c.t0, 0.04], [c.t1 - c.t0 + 0.6, 0]])).connect(bus(1, 0, 0.4));
      const tw = c.t0 + (c.t1 - c.t0) * 0.6;
      noise(WHITE, tw, 0.05, 9).connect(filt('bandpass', 1800, 2)).connect(amp(tw, [[0, 0], [0.002, 0.35], [0.04, 0]])).connect(bus(1, 0.2, 0.6));
    }
    /* ---- the heartbeat in total darkness ---- */
    {
      let t = D.hand0;
      while (t < TL.CUT - 0.1) {
        const k = U.clamp((t - D.hand0) / (TL.CUT - D.hand0));
        for (const [dt, a] of [[0, 1], [0.17, 0.6]]) {
          const tt = t + dt, o = osc('sine', 62, tt, 0.3); o.frequency.exponentialRampToValueAtTime(36, tt + 0.2);
          o.connect(amp(tt, [[0, 0], [0.008, (0.13 + 0.15 * k) * a], [0.24, 0]])).connect(bus(1));
        }
        t += U.lerp(1.05, 0.55, k);
      }
    }
    /* ---- phosphenes: glassy, detuned shimmer ---- */
    {
      const a = TL.at(22), b = TL.end(23);
      [83, 86, 90, 95, 98].forEach((m, i) => {
        const o = osc('sine', U.mtof(m), a, b - a + 0.2), lfo = osc('sine', 0.3 + i * 0.13, a, b - a + 0.2), lg = ac.createGain(); lg.gain.value = 12;
        lfo.connect(lg).connect(o.detune);
        o.connect(amp(a, [[0, 0], [1.2, 0.012], [b - a - 1, 0.01], [b - a, 0]])).connect(bus(1, (i - 2) * 0.35, 0.8));
      });
    }
    /* ---- "some of them are real": the sting, then the approach ---- */
    {
      const t = TL.real.t0;
      for (const f of [440, 466.2, 659.3]) osc('sawtooth', f, t, 1.6).connect(filt('lowpass', 2600)).connect(amp(t, [[0, 0], [0.03, 0.03], [1.5, 0]])).connect(bus(1, 0, 0.6));
      const o = osc('sine', 48, t, 0.9); o.frequency.exponentialRampToValueAtTime(30, t + 0.8); o.connect(amp(t, [[0, 0], [0.01, 0.35], [0.85, 0]])).connect(bus(1));
      const r0 = TL.real.t0 + 0.3, r1 = TL.CUT;
      const src = noise(WHITE, r0, r1 - r0, 5), bp = filt('bandpass', 200, 2); env(bp.frequency, [[r0, 150], [r1, 1400]]);
      src.connect(bp).connect(amp(r0, [[0, 0], [r1 - r0 - 0.05, 0.045], [r1 - r0, 0]])).connect(bus(1, 0, 0.3));
    }
    /* ---- the close-up: a sub hit on "see"; then the cut takes everything away ---- */
    { const t = TL.close.see, o = osc('sine', 44, t, 1.4); o.frequency.exponentialRampToValueAtTime(28, t + 1.2); o.connect(amp(t, [[0, 0], [0.01, 0.5], [1.3, 0]])).connect(bus(1, 0, 0, master)); }
    /* ---- after the cut: a thin ring, like ears after a blast; a low drone under the end cards ---- */
    {
      const t = TL.CUT + 0.3;
      osc('sine', 6000, t, 5.5).connect(amp(t, [[0, 0], [1.5, 0.012], [4.5, 0.01], [5.4, 0]])).connect(bus(1, 0, 0, master));
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
