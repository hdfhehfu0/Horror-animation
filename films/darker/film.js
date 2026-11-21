/* =========================================================================
   DARKER — film.js
   Composites one frame: the 3D street (world.js) graded for the time of
   night, light glows, the eyes, the phosphenes, grain, then the HUD and the
   captions in the reference's style, and the black end cards.
   Film.render(ctx, t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, World } = g;
  const W = TL.W, HT = TL.H, TAU = Math.PI * 2;
  const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
  const MONO = '"JetBrains Mono", "IBM Plex Mono", Menlo, monospace';
  if (document.fonts && document.fonts.load) for (const f of ['700 47px Inter', '800 70px Inter', '500 72px "JetBrains Mono"', '700 20px "JetBrains Mono"']) document.fonts.load(f).catch(() => {});

  let T, Tc;
  function tmp() { if (!T) { T = document.createElement('canvas'); T.width = W; T.height = HT; Tc = T.getContext('2d'); } return Tc; }
  const ramp = (t, a, d) => U.clamp((t - a) / d);

  /* ------------------------------ numbers ------------------------------ */
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function fmt(v) {
    if (v <= 0) return '0';
    if (v >= 1000) return Math.round(v).toLocaleString('en-US');
    if (v >= 10) return v.toFixed(1);
    if (v >= 1) return v.toFixed(2);
    if (v >= 1e-5) return v.toPrecision(3);
    const e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e);
    return `${m.toFixed(1)}×10${String(e).split('').map((ch) => SUP[ch]).join('')}`;
  }

  /* ------------------------------ glow + eyes ------------------------------ */
  function glow(c, x, y, r, rgb, a) {
    if (a <= 0.003) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = (() => { const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.35, `rgba(${rgb},${a * 0.35})`); gr.addColorStop(1, `rgba(${rgb},0)`); return gr; })();
    c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }
  // one pair of eyeshine; s = pixel size of one eye; open 0..1
  function eyePair(c, x, y, s, open, a, tint = '214,255,120') {
    if (a <= 0 || s < 0.6) return;
    const gap = s * 2.6;
    for (const k of [-1, 1]) {
      const ex = x + k * gap / 2;
      glow(c, ex, y, s * 9, tint, 0.22 * a);
      c.save(); c.globalAlpha = a; c.translate(ex, y); c.scale(1, Math.max(0.06, open)); c.rotate(k * -0.12);
      c.fillStyle = `rgb(${tint})`; c.beginPath(); c.ellipse(0, 0, s, s * 0.62, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,240,0.9)'; c.beginPath(); c.ellipse(0, 0, s * 0.45, s * 0.28, 0, 0, TAU); c.fill();
      c.restore();
    }
  }
  const blink = (t, seed) => { const ph = (t * 0.37 + U.hash(seed) * 3) % 3.1; return ph < 0.14 ? Math.abs(ph - 0.07) / 0.07 : 1; };

  // the close-up at the end: two huge slit-pupil eyes right in front of the camera
  function bigEyes(c, t) {
    const C = TL.close;
    if (t < C.t0 || t >= TL.CUT) return;
    const a = U.easeOut(ramp(t, C.t0, 0.5));
    const narrow = 1 - 0.45 * U.easeInOut(ramp(t, C.see, 0.25));
    const bl = t > C.you + 0.25 && t < C.you + 0.55 ? Math.abs((t - C.you - 0.4) / 0.15) : 1;
    const open = narrow * U.clamp(bl);
    const y = 900 + Math.sin(t * 1.3) * 6, gap = 520, s = 210 * (1 + 0.05 * ramp(t, C.t0, 1.4));
    for (const k of [-1, 1]) {
      const ex = 540 + k * gap / 2;
      glow(c, ex, y, s * 2.6, '190,240,90', 0.35 * a);
      c.save(); c.globalAlpha = a; c.translate(ex, y); c.rotate(k * -0.16); c.scale(1, open);
      c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(0, -s * 0.95, s, 0); c.quadraticCurveTo(0, s * 0.95, -s, 0); c.closePath();
      const gr = c.createRadialGradient(0, 0, 4, 0, 0, s); gr.addColorStop(0, '#fbffcf'); gr.addColorStop(0.45, '#d7f36a'); gr.addColorStop(1, '#5c7a12');
      c.fillStyle = gr; c.fill();
      c.save(); c.clip();
      for (let i = 0; i < 40; i++) { const an = (i / 40) * TAU; c.strokeStyle = 'rgba(60,80,10,0.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(Math.cos(an) * s * 0.2, Math.sin(an) * s * 0.2); c.lineTo(Math.cos(an) * s, Math.sin(an) * s); c.stroke(); }
      const pw = s * U.lerp(0.16, 0.07, U.easeInOut(ramp(t, C.see, 0.3)));
      c.fillStyle = '#050505'; c.beginPath(); c.ellipse(0, 0, pw, s * 0.82, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(-s * 0.32, -s * 0.22, s * 0.09, s * 0.05, -0.5, 0, TAU); c.fill();
      c.restore(); c.restore();
    }
  }

  /* ------------------------------ phosphenes ------------------------------ */
  function phosphenes(c, t, k) {
    if (k <= 0) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const hues = ['150,90,255', '60,220,200', '255,120,200', '120,255,140', '90,140,255'];
    for (let i = 0; i < 14; i++) {
      const x = 540 + Math.sin(t * (0.21 + U.hash(i) * 0.3) + i * 2.1) * 420, y = 960 + Math.cos(t * (0.17 + U.hash(i * 3) * 0.25) + i) * 760;
      const r = 120 + U.hash(i * 5) * 260, pulse = 0.5 + 0.5 * Math.sin(t * (0.8 + U.hash(i * 7)) + i);
      glow(c, x, y, r, hues[i % hues.length], 0.12 * k * pulse);
    }
    // faint drifting rings, like pressure patterns behind closed eyes
    c.strokeStyle = `rgba(160,140,255,${0.07 * k})`; c.lineWidth = 3;
    for (let i = 0; i < 6; i++) { const r = ((t * 90 + i * 140) % 840); c.beginPath(); c.arc(540, 980, r, 0, TAU); c.stroke(); }
    // false eyes that flicker in and out
    for (let i = 0; i < 6; i++) {
      const on = U.hash(Math.floor(t * 3) + i * 13) > 0.6;
      if (on) eyePair(c, 200 + U.hash(i * 3.3) * 680, 500 + U.hash(i * 5.7) * 900, 6 + U.hash(i) * 8, 1, 0.55 * k, hues[i % hues.length]);
    }
    c.restore();
  }

  /* ------------------------------ HUD ------------------------------ */
  function hud(c, t) {
    const v = TL.lux(t);
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 10;
    c.fillStyle = 'rgba(235,238,242,0.82)'; c.font = `600 21px ${SANS}`; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    if ('letterSpacing' in c) c.letterSpacing = '4px';
    c.fillText('LIGHT', 73, 230);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.fillStyle = '#ffffff'; c.font = `500 72px ${MONO}`;
    c.fillText(`${fmt(v)} lx`, 70, 318);
    c.fillStyle = 'rgba(225,228,232,0.7)'; c.font = `500 18px ${MONO}`;
    c.fillText(`${fmt(v / 1000)} % OF DAYLIGHT`, 73, 362);
    c.restore();
  }

  /* ------------------------------ captions ------------------------------ */
  const NUM = /\d[\d,.]*\d|\d/g;
  function runs(s) {   // split a line into sans and mono (number) runs
    const out = []; let last = 0, m;
    NUM.lastIndex = 0;
    while ((m = NUM.exec(s))) { if (m.index > last) out.push([s.slice(last, m.index), 0]); out.push([m[0], 1]); last = m.index + m[0].length; }
    if (last < s.length) out.push([s.slice(last), 0]);
    return out;
  }
  function wrap(c, text, size, wt, maxW) {
    const fontS = `${wt} ${size}px ${SANS}`, fontM = `500 ${size * 0.96}px ${MONO}`;
    const width = (s) => runs(s).reduce((a, [p, mono]) => { c.font = mono ? fontM : fontS; return a + c.measureText(p).width; }, 0);
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (width(tst) > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
    if (cur) lines.push(cur);
    return { lines, width, fontS, fontM };
  }
  function block(c, text, cy, size, wt, maxW, alpha, o = {}) {
    if (alpha <= 0) return;
    const { lines, width, fontS, fontM } = wrap(c, text, size, wt, maxW);
    const lh = size * 1.2, h = lines.length * lh, top = cy - h / 2;
    c.save(); c.globalAlpha = alpha;
    if (!o.noHalo) {   // the soft dark halo behind the words
      const wmax = Math.max(...lines.map(width));
      const gr = c.createRadialGradient(540, cy, 10, 540, cy, Math.max(wmax * 0.62, 220));
      gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.save(); c.translate(540, cy); c.scale(1, (h + 90) / Math.max(wmax * 1.24, 440)); c.translate(-540, -cy);
      c.fillStyle = gr; c.fillRect(0, cy - 700, W, 1400); c.restore();
    }
    if (o.fact) {
      const py = top - 46;
      c.fillStyle = '#f2a93b'; c.beginPath(); c.roundRect(540 - 50, py - 19, 100, 38, 8); c.fill();
      c.fillStyle = '#3a2208'; c.font = `800 17px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      if ('letterSpacing' in c) c.letterSpacing = '3px';
      c.fillText('FACT', 541.5, py + 1);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
    }
    c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 8; c.shadowOffsetY = 2;
    c.fillStyle = o.col || '#ffffff'; c.textBaseline = 'middle'; c.textAlign = 'left';
    lines.forEach((ln, i) => {
      let x = 540 - width(ln) / 2; const y = top + lh * (i + 0.5);
      for (const [p, mono] of runs(ln)) { c.font = mono ? fontM : fontS; c.fillText(p, x, y); x += c.measureText(p).width; }
    });
    c.restore();
  }
  function captions(c, t) {
    for (const b of TL.blocks) {
      if (t < b.t0 || t > b.t1) continue;
      const a = Math.min(U.clamp((t - b.t0) / 0.25), U.clamp((b.t1 - t) / 0.3));
      if (b.kind === 'title') block(c, b.text, 640, 68, 800, 960, a);
      else if (b.kind === 'event') block(c, b.text, 1250, 47, 700, 760, a);
      else if (b.kind === 'fact') block(c, b.text, 1230, 47, 700, 760, a, { fact: true });
      else if (b.kind === 'wait') block(c, b.text, 1250, 47, 700, 760, a, { noHalo: true });
      else if (b.kind === 'teaser') {
        c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(200,205,212,0.75)'; c.font = `700 20px ${SANS}`; c.textAlign = 'center';
        if ('letterSpacing' in c) c.letterSpacing = '4px'; c.fillText('PART 2', 545, 790); c.restore();
        block(c, b.text, 880, 62, 800, 780, a, { noHalo: true });
      } else if (b.kind === 'final') {
        block(c, b.text, 760, 62, 800, 780, a, { noHalo: true });
        c.save(); c.globalAlpha = a * 0.8; c.fillStyle = '#c9cdd3'; c.font = `500 19px ${MONO}`; c.textAlign = 'center';
        if ('letterSpacing' in c) c.letterSpacing = '3px';
        c.fillText('ABSOLUTE DARKNESS · 0 LUX', 540, 880); c.fillText('· WHERE YOUR EYES STOP WORKING', 540, 914); c.restore();
      }
    }
  }

  /* ------------------------------ the frame ------------------------------ */
  function render(c, t) {
    t = U.clamp(t, 0, TL.DURATION - 1e-6);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, HT);
    if (t < TL.CUT) {
      const tr = TL.tr, sat = tr.sat(t), expo = tr.expo(t);
      const gl = World.render(t);
      if (expo > 0.002) { c.filter = `saturate(${sat.toFixed(3)}) brightness(${expo.toFixed(3)})`; c.drawImage(gl, 0, 0); c.filter = 'none'; }
      // light glows (they drain of colour with the rest of the picture)
      const warm = sat > 0.6 ? '255,206,140' : `${Math.round(U.lerp(215, 255, sat))},${Math.round(U.lerp(215, 206, sat))},${Math.round(U.lerp(205, 140, sat))}`;
      World.lamps().forEach((p, i) => {
        const v = World.lampLevel(i, t); if (v <= 0) return;
        const s = World.project(p.x, p.y, p.z); if (!s.vis) return;
        const night = U.clamp((t - TL.D.overcast) / 5);
        glow(c, s.x, s.y, 2200 / s.d, warm, (0.25 + 0.5 * night) * v * expo);
      });
      const mo = tr.moon(t);
      if (mo > 0) { const mp = World.moonPos(), s = World.project(mp.x, mp.y, mp.z); glow(c, s.x, s.y, 260, '190,205,235', 0.22 * mo * (1 - tr.clouds(t))); }
      // vignette, darker as the night goes on
      const vg = c.createRadialGradient(540, 900, 380, 540, 960, 1250);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${U.lerp(0.25, 0.7, U.clamp((t - TL.D.dusk) / 20))})`);
      c.fillStyle = vg; c.fillRect(0, 0, W, HT);
      // the eyes in the dark
      TL.eyes.forEach((e) => {
        if (t < e.t0 || t > e.t1 + 0.2) return;
        const s = World.project(e.x, e.y, e.z); if (!s.vis) return;
        const a = Math.min(U.easeOut(ramp(t, e.t0, 0.5)), U.clamp((e.t1 + 0.2 - t) / 0.2));
        eyePair(c, s.x, s.y, Math.max(1.4, 26 / s.d * e.s * 10) , blink(t, e.seed), a);
      });
      const R = TL.real;
      if (t > R.t0 && t < TL.close.t0 + 0.3) {
        const z = U.lerp(R.z, R.zEnd, U.easeIn(ramp(t, R.t0 + 0.3, R.t1 - R.t0)));
        const s = World.project(R.x, R.y, z);
        const a = Math.min(U.easeOut(ramp(t, R.t0, 0.4)), U.clamp((TL.close.t0 + 0.3 - t) / 0.3));
        eyePair(c, s.x, s.y, 280 / s.d, blink(t, 77), a);
      }
      phosphenes(c, t, tr.phos(t));
      bigEyes(c, t);
      // sensor grain, heavier in the dark
      const gk = tr.grain(t), f = Math.floor(t * TL.FPS);
      for (let i = 0; i < 700; i++) {
        c.fillStyle = U.hash(i + f * 1.7) > 0.5 ? `rgba(255,255,255,${gk})` : `rgba(0,0,0,${gk * 1.5})`;
        c.fillRect(U.hash(f * 13 + i) * W, U.hash(f * 7 + i * 3) * HT, 2, 2);
      }
      hud(c, t);
    }
    captions(c, t);
    const k = U.clamp((t - (TL.DURATION - 0.5)) / 0.5);
    if (k > 0) { c.fillStyle = `rgba(0,0,0,${k})`; c.fillRect(0, 0, W, HT); }
    c.restore();
  }
  g.Film = { render, init() {} };
})(window);
