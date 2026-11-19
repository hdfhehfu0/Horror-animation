/* =========================================================================
   BOOKMARKED — audio.js
   The score and the small sound effects, synthesised with the Web Audio API
   and rendered once in an OfflineAudioContext from the TL cues. The music is
   a quiet, sly bed (D minor pizzicato + low pad + a music-box motif) that
   ducks under the narrator, like the reference's soft bed.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL } = g;

  function makeNoise(ac, seconds, seed, brown) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const r = U.mulberry32(seed + c * 977), d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = r() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    }
    return buf;
  }
  function makeImpulse(ac, seconds, decay, seed) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const r = U.mulberry32(seed + c * 31), d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) { const x = i / len; d[i] = (r() * 2 - 1) * Math.pow(1 - x, decay) * (i < 200 ? i / 200 : 1); }
    }
    return buf;
  }

  async function renderSoundtrack(sampleRate = 48000) {
    const DUR = TL.DURATION;
    const ac = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);
    const WHITE = makeNoise(ac, 4, 11, false), BROWN = makeNoise(ac, 6, 23, true);

    // master: music bus (ducked under the narrator) + sfx bus (not ducked)
    const master = ac.createGain(); master.gain.value = 1;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp).connect(ac.destination);
    master.gain.setValueAtTime(1, 0); master.gain.setValueAtTime(1, DUR - 0.7); master.gain.linearRampToValueAtTime(0, DUR - 0.02);

    const music = ac.createGain(); music.gain.value = 0.45;
    const duck = ac.createGain(); duck.gain.value = 1;
    music.connect(duck).connect(master);
    const VO = (typeof window !== 'undefined' && window.VOICE) || null;
    if (VO) for (const [a, b] of VO.segments) { duck.gain.setTargetAtTime(0.32, Math.max(0, a - 0.1), 0.06); duck.gain.setTargetAtTime(1, b + 0.05, 0.3); }
    const sfx = ac.createGain(); sfx.gain.value = 0.32; sfx.connect(master);

    const rev = ac.createConvolver(); rev.buffer = makeImpulse(ac, 2.4, 2.4, 5);
    const revOut = ac.createGain(); revOut.gain.value = 0.5; rev.connect(revOut).connect(master);

    const busCache = new Map();
    function bus(dest, gain, pan = 0, sendRev = 0) {
      const key = [dest === music ? 'm' : 's', gain, pan, sendRev].map((v) => (typeof v === 'number' ? Math.round(v * 20) / 20 : v)).join('|');
      if (busCache.has(key)) return busCache.get(key);
      const gN = ac.createGain(); gN.gain.value = gain;
      const p = ac.createStereoPanner(); p.pan.value = pan;
      gN.connect(p).connect(dest);
      if (sendRev) { const s = ac.createGain(); s.gain.value = sendRev; p.connect(s).connect(rev); }
      busCache.set(key, gN); return gN;
    }
    const M = (gain, pan, r) => bus(music, gain, pan, r), X = (gain, pan, r) => bus(sfx, gain, pan, r);
    function noise(buf, t, dur, seedOff = 0) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(Math.max(0, t), (U.hash(t * 13 + seedOff) * (buf.duration - 0.1)) % buf.duration); s.stop(Math.max(0, t) + dur); return s; }
    function filt(type, f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
    function osc(type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(Math.max(0, t)); o.stop(Math.max(0, t) + dur); return o; }
    function env(param, pts) { param.setValueAtTime(pts[0][1], Math.max(0, pts[0][0])); for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], Math.max(0, pts[i][0])); }
    function amp(t, pts) { const gN = ac.createGain(); gN.gain.value = 0; env(gN.gain, pts.map(([dt, v]) => [t + dt, v])); return gN; }

    /* ------------------------------ instruments ------------------------------ */
    function pluck(t, m, lvl = 0.12, pan = 0) {   // pizzicato
      const f = U.mtof(m), o = osc('triangle', f, t, 0.5), o2 = osc('sine', f * 2, t, 0.3);
      const lp = filt('lowpass', 1600, 1.2); env(lp.frequency, [[t, 2600], [t + 0.12, 700]]);
      o.connect(lp); o2.connect(amp(t, [[0, 0], [0.003, 0.3], [0.1, 0]])).connect(lp);
      lp.connect(amp(t, [[0, 0], [0.004, lvl], [0.09, lvl * 0.35], [0.42, 0]])).connect(M(1, pan, 0.25));
    }
    function bell(t, m, lvl = 0.06, pan = 0) {    // music box
      const f = U.mtof(m);
      for (const [mul, a, d] of [[1, 1, 1.6], [2.76, 0.35, 0.6], [5.4, 0.15, 0.25]]) osc('sine', f * mul, t, d + 0.05).connect(amp(t, [[0, 0], [0.002, lvl * a], [d, 0]])).connect(M(1, pan, 0.6));
    }
    function pad(t0, t1, ms, lvl = 0.035) {
      const lp = filt('lowpass', 520, 0.8), gN = ac.createGain();
      env(gN.gain, [[t0, 0], [t0 + 1.2, lvl], [t1 - 0.8, lvl], [t1, 0]]);
      for (const m of ms) for (const dt of [-6, 7]) { const o = osc('sawtooth', U.mtof(m), t0, t1 - t0 + 0.1); o.detune.value = dt; o.connect(lp); }
      lp.connect(gN).connect(M(1, 0, 0.35));
    }
    function pop(t, lvl = 0.5, f = 520) {
      const o = osc('sine', f, t, 0.15); o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.06);
      o.connect(amp(t, [[0, 0], [0.004, lvl], [0.11, 0]])).connect(X(1, 0, 0.15));
      noise(WHITE, t, 0.03, t).connect(filt('bandpass', 3000, 1)).connect(amp(t, [[0, 0], [0.001, lvl * 0.3], [0.02, 0]])).connect(X(1));
    }
    function chime(t, lvl = 0.18, base = 84) {
      [0, 4, 7, 12, 16].forEach((st, i) => { const tt = t + i * 0.035; osc('sine', U.mtof(base + st), tt, 0.9).connect(amp(tt, [[0, 0], [0.003, lvl * (1 - i * 0.12)], [0.8, 0]])).connect(X(1, (i - 2) * 0.25, 0.7)); });
    }
    function swish(t, dur = 0.3, lvl = 0.16, up = true) {
      const src = noise(WHITE, t - dur * 0.2, dur + 0.05, t * 3), bp = filt('bandpass', 900, 1.3);
      env(bp.frequency, up ? [[t - dur * 0.2, 500], [t + dur, 5200]] : [[t, 4200], [t + dur, 500]]);
      src.connect(bp).connect(amp(t - dur * 0.2, [[0, 0], [dur * 0.6, lvl], [dur + 0.05, 0]])).connect(X(1, 0, 0.1));
    }
    function thud(t, lvl = 0.6, lp = 300) {
      const b = X(lvl, 0, 0.2);
      const k = osc('sine', 110, t, 0.5); k.frequency.exponentialRampToValueAtTime(45, t + 0.22);
      k.connect(amp(t, [[0, 0], [0.003, 0.9], [0.3, 0]])).connect(b);
      noise(BROWN, t, 0.25, t * 7).connect(filt('lowpass', lp)).connect(amp(t, [[0, 0], [0.002, 1.1], [0.16, 0]])).connect(b);
    }
    function boom(t, lvl = 0.8, pitch = 60) {
      const b = X(lvl, 0, 0.4);
      const k = osc('sine', pitch * 1.7, t, 1.8); k.frequency.exponentialRampToValueAtTime(pitch * 0.45, t + 1.2);
      k.connect(amp(t, [[0, 0], [0.006, 0.9], [1.6, 0]])).connect(b);
      noise(BROWN, t, 0.6, t).connect(filt('lowpass', 800)).connect(amp(t, [[0, 0], [0.004, 0.6], [0.4, 0]])).connect(b);
    }
    function click(t, lvl = 0.4, f = 2600) { noise(WHITE, t, 0.04, t * 5).connect(filt('bandpass', f, 2.5)).connect(amp(t, [[0, 0], [0.001, lvl], [0.03, 0]])).connect(X(1, 0.1, 0.15)); }
    function paper(t, dur = 0.25, lvl = 0.2) {   // rustle / flick
      const src = noise(WHITE, t, dur + 0.05, t * 11), vca = ac.createGain(); vca.gain.value = 0;
      for (let i = 0; i < dur * 40; i++) { const tt = t + i / 40 + U.hash(i + t) * 0.01; vca.gain.setValueAtTime(lvl * (0.4 + U.hash(i * 3 + t) * 0.6), tt); vca.gain.setTargetAtTime(0, tt + 0.004, 0.01); }
      src.connect(filt('highpass', 2200)).connect(vca).connect(X(1, 0, 0.1));
    }
    function shopBell(t) { [88, 93, 88.3, 93.4].forEach((m, i) => { const tt = t + i * 0.09; osc('sine', U.mtof(m), tt, 1.1).connect(amp(tt, [[0, 0], [0.002, 0.07], [1.0, 0]])).connect(X(1, 0.3, 0.6)); osc('sine', U.mtof(m) * 2.7, tt, 0.4).connect(amp(tt, [[0, 0], [0.002, 0.02], [0.3, 0]])).connect(X(1, 0.3, 0.6)); }); }
    function splat(t, lvl = 0.25) { noise(BROWN, t, 0.12, t * 3).connect(filt('lowpass', 900)).connect(amp(t, [[0, 0], [0.002, lvl], [0.09, 0]])).connect(X(1, (U.hash(t) - 0.5), 0.1)); }
    function riser(t0, t1, lvl = 0.12) {
      const src = noise(WHITE, t0, t1 - t0 + 0.05, t0), bp = filt('bandpass', 300, 2); env(bp.frequency, [[t0, 200], [t1, 2400]]);
      src.connect(bp).connect(amp(t0, [[0, 0], [t1 - t0, lvl], [t1 - t0 + 0.04, 0]])).connect(X(1, 0, 0.4));
      for (const f of [73.4, 77.8]) { const o = osc('sawtooth', f, t0, t1 - t0 + 0.05); o.connect(filt('lowpass', 400)).connect(amp(t0, [[0, 0], [t1 - t0, lvl * 0.8], [t1 - t0 + 0.04, 0]])).connect(X(1, 0, 0.3)); }
    }

    /* ================================ MUSIC ================================ */
    const BPM = 92, beat = 60 / BPM, e8 = beat / 2;
    // pizzicato ostinato in D minor, 4-bar loop: Dm  A/C#  Bb  A
    const BARS = [[50, 53, 57, 53, 50, 53, 57, 53], [49, 52, 57, 52, 49, 52, 57, 52], [46, 50, 53, 50, 46, 50, 53, 50], [45, 49, 52, 49, 45, 49, 57, 49]];
    const playPizz = (t0, t1, lvl) => { let i = 0; for (let t = t0; t < t1 - 0.05; t += e8, i++) { const bar = Math.floor(i / 8) % 4; pluck(t, BARS[bar][i % 8], lvl * (i % 2 ? 0.75 : 1), i % 2 ? 0.2 : -0.2); } };
    const sh = TL.shots;
    playPizz(sh[1][0], sh[7][0] - 0.1, 0.11);                 // the case: city -> shop
    playPizz(sh[8][0] + 0.2, sh[14][0] - 0.1, 0.09);          // after the darkness: lean -> temple
    playPizz(sh[14][0], TL.stamp - 0.15, 0.12);               // team up -> trap
    playPizz(sh[19][0] + 0.3, DUR - 0.6, 0.08);               // epilogue
    // low pads under it all
    pad(0, sh[7][0], [38, 45, 50]);
    pad(sh[7][0], sh[14][0], [37, 44, 49], 0.03);
    pad(sh[14][0], TL.stamp, [34, 41, 46], 0.035);
    pad(TL.stamp, DUR, [38, 45, 53], 0.03);
    // music-box motif on the hook and the epilogue
    const motif = [74, 77, 81, 79, 77, 74, 73, 74];
    motif.forEach((m, i) => bell(0.35 + i * beat * 0.5, m, 0.05, 0.3));
    motif.forEach((m, i) => bell(sh[19][0] + 0.3 + i * beat, m, 0.045, -0.2));
    motif.slice(0, 4).forEach((m, i) => bell(sh[20][0] + 0.2 + i * beat * 0.5, m + 12, 0.035, 0.2));

    /* =============================== SFX =============================== */
    swish(TL.vsPop - 0.1, 0.25, 0.12); pop(TL.vsPop, 0.5, 300); thud(TL.vsPop, 0.35, 500);
    chime(TL.bookmarkIn, 0.12, 86);
    paper(TL.strings, 0.9, 0.06);
    TL.pins.forEach((t, i) => { pop(t, 0.35, 700 + i * 120); thud(t + 0.12, 0.2, 700); });
    swish(TL.mapLines, 0.5, 0.08); pop(TL.mapDisc, 0.45, 260); chime(TL.mapDisc + 0.05, 0.06, 79);
    shopBell(sh[5][0] + 0.25);
    thud(TL.bookClose, 0.55, 900); paper(TL.bookClose - 0.06, 0.1, 0.12);
    riser(TL.shadowRise - 0.2, TL.shadowEyes, 0.13); boom(TL.shadowEyes, 0.45, 50);
    for (const f of [587.3, 622.3, 880]) osc('sawtooth', f, TL.shadowEyes + 0.02, 1.4).connect(filt('lowpass', 3000)).connect(amp(TL.shadowEyes + 0.02, [[0, 0], [0.05, 0.02], [1.3, 0]])).connect(X(1, 0, 0.6));
    click(TL.signFlip, 0.35, 2200); click(TL.signFlip + 0.08, 0.2, 1700); paper(TL.signFlip, 0.12, 0.08);
    click(TL.caseGlint - 0.05, 0.45, 3200); click(TL.caseGlint + 0.03, 0.4, 2600); chime(TL.caseGlint + 0.1, 0.05, 91);
    thud(TL.boxPush, 0.3, 400); paper(TL.receiptsFly, 0.5, 0.18);
    TL.receiptPops.forEach((t) => { paper(t, 0.12, 0.18); pop(t + 0.02, 0.18, 900); });
    swish(TL.fridayMark, 0.3, 0.08); pop(TL.fridayMark + 0.4, 0.3, 420);
    for (let i = 0; i < 10; i++) pop(TL.faces + i * 0.07, 0.12, 900 + i * 60);
    pop(TL.teamUp, 0.55, 300); chime(TL.teamUp + 0.05, 0.16, 84); thud(TL.teamUp + 0.25, 0.3, 600);
    for (let i = 0; i < 7; i++) splat(sh[15][0] + 0.15 + i * ((TL.blood - sh[15][0]) / 7), 0.22);
    pop(TL.bubble, 0.4, 600);
    swish(TL.trapCircle - 0.05, 0.4, 0.09); click(TL.bookOut, 0.25, 900); swish(TL.shelfMark, 0.3, 0.06, false);
    swish(TL.reach, 0.5, 0.1); paper(TL.grip, 0.08, 0.1);
    thud(TL.grab, 0.5, 600); boom(TL.stamp, 0.55, 55); thud(TL.stamp, 0.5, 1400); click(TL.stamp, 0.4, 1200);
    TL.questions.forEach((t, i) => { const o = osc('sine', 400 + i * 80, t, 0.3); o.frequency.exponentialRampToValueAtTime(900 + i * 100, t + 0.18); o.connect(amp(t, [[0, 0], [0.01, 0.12], [0.25, 0]])).connect(X(1, 0, 0.2)); });
    swish(TL.calDrop, 0.2, 0.08, false); thud(TL.calDrop + 0.2, 0.35, 700);
    TL.calFlips.forEach((t) => paper(t, 0.14, 0.2));
    pop(sh[20][0] + 0.1, 0.25, 500); pop(sh[20][0] + 0.22, 0.25, 600);
    pop(TL.pollSilas, 0.3, 700); pop(TL.pollEzra, 0.3, 800);
    chime(TL.comment, 0.1, 88);

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
