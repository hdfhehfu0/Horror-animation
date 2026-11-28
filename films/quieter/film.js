/* =========================================================================
   QUIETER — film.js
   Composites one frame of Part 2: the golden-hour street (world.js), muted
   as the silence grows, with dust motes in the light, a heartbeat pulse,
   the ringing, then the SOUND counter (with a live trace that flattens)
   and the reference-style captions and end cards.
   Film.render(ctx, t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, World } = g;
  const W = TL.W, HT = TL.H, TAU = Math.PI * 2;
  const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
  const MONO = '"JetBrains Mono", "IBM Plex Mono", Menlo, monospace';
  if (document.fonts && document.fonts.load) for (const f of ['700 47px Inter', '800 70px Inter', '500 72px "JetBrains Mono"', '700 20px "JetBrains Mono"']) document.fonts.load(f).catch(() => {});
  const ramp = (t, a, d) => U.clamp((t - a) / d);
  const Q = TL.Q;

  function glow(c, x, y, r, rgb, a) {
    if (a <= 0.003) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.35, `rgba(${rgb},${a * 0.35})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }

  /* ------------------------------ numbers ------------------------------ */
  function fmtNum(v) {
    if (v >= 1000) return Math.round(v).toLocaleString('en-US');
    if (v >= 10) return v.toFixed(1);
    if (v >= 0.1) return v.toFixed(2);
    return v.toFixed(3);
  }

  /* ------------------------------ HUD ------------------------------ */
  function hud(c, t) {
    const db = TL.db(t), silent = db === -Infinity;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 10;
    c.fillStyle = 'rgba(235,238,242,0.85)'; c.font = `600 21px ${SANS}`; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    if ('letterSpacing' in c) c.letterSpacing = '4px';
    c.fillText('SOUND', 73, 230);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    const jumped = t >= Q.breath;
    c.fillStyle = jumped ? '#ff5a4e' : '#ffffff'; c.font = `500 72px ${MONO}`;
    const s = silent ? '−∞' : (db < 0 ? '−' + Math.abs(db).toFixed(1) : db.toFixed(1));
    c.fillText(`${s} dB`, 70, 318);
    c.fillStyle = 'rgba(225,228,232,0.72)'; c.font = `500 18px ${MONO}`;
    const p = silent ? 0 : 20 * Math.pow(10, db / 20);
    c.fillText(`PRESSURE ${fmtNum(p)} µPa`, 73, 362);
    // a live trace whose amplitude follows the level: it flattens into a line
    const amp = silent ? 0 : U.clamp(Math.pow(10, (db - 74) / 40)) * 34;
    c.shadowBlur = 0; c.strokeStyle = jumped ? 'rgba(255,90,78,0.9)' : 'rgba(255,255,255,0.75)'; c.lineWidth = 2.5;
    c.beginPath();
    for (let i = 0; i <= 120; i++) {
      const x = 73 + i * 2.6, k = i * 0.37 + t * 23;
      const y = 404 + amp * (Math.sin(k) * 0.55 + Math.sin(k * 2.7 + 1) * 0.3 + (U.hash(Math.floor(k * 3) + 7) - 0.5) * 0.5);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    c.restore();
  }

  /* ------------------------------ captions (the reference's style) ------------------------------ */
  const NUM = /[−-]?\d[\d,.]*\d%?|[−-]?\d%?/g;
  function runs(s) {
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
    if (!o.noHalo) {
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
        if ('letterSpacing' in c) c.letterSpacing = '4px'; c.fillText(b.part, 545, 790); c.restore();
        block(c, b.text, 880, 62, 800, 780, a, { noHalo: true });
      } else if (b.kind === 'final') {
        block(c, b.text, 760, 62, 800, 780, a, { noHalo: true });
        c.save(); c.globalAlpha = a * 0.8; c.fillStyle = '#c9cdd3'; c.font = `500 19px ${MONO}`; c.textAlign = 'center';
        if ('letterSpacing' in c) c.letterSpacing = '3px';
        c.fillText(b.mono[0], 540, 880); c.fillText(b.mono[1], 540, 914); c.restore();
      }
    }
  }

  /* ------------------------------ dust motes in the light ------------------------------
     they drift (Brownian), glitter on "air molecules", freeze in total silence,
     and are blown away from the camera when something breathes behind it */
  function motes(c, t) {
    const mt = Math.min(t, Q.silence), push = t > Q.breath ? U.easeOut(U.clamp((t - Q.breath) / 1.8)) : 0;
    const glit = 1 + 1.4 * Math.sin(Math.PI * U.clamp((t - Q.molecules + 0.3) / 3.2)) * (t > Q.molecules - 0.3 && t < Q.silence ? 1 : 0);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 110; i++) {
      const bx = U.hash(i * 1.7) * W, by = 300 + U.hash(i * 2.9) * 1500;
      let x = bx + U.snoise(mt * 0.13 + i * 7.1) * 90, y = by + U.snoise(mt * 0.11 + i * 3.3) * 70 - mt * 4;
      // the breath pushes them out from the bottom centre, away from you
      const dx = x - 540, dy = y - 2100, d = Math.hypot(dx, dy);
      x += (dx / d) * push * 380 * (1 - U.clamp(d / 2400)); y += (dy / d) * push * 380 * (1 - U.clamp(d / 2400));
      const r = 1.2 + U.hash(i * 5.3) * 2.6, tw = 0.5 + 0.5 * Math.sin(mt * (1 + U.hash(i) * 2) + i);
      const a = (0.25 + 0.45 * tw) * glit * (1 - push * 0.6);
      c.fillStyle = `rgba(255,236,200,${Math.min(1, a)})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (r > 3) glow(c, x, y, r * 5, '255,225,170', 0.08 * a);
    }
    c.restore();
  }

  /* ------------------------------ the frame ------------------------------ */
  function render(c, t) {
    t = U.clamp(t, 0, TL.DURATION - 1e-6);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, HT);
    if (t < TL.CUT) {
      const gl = World.render(t);
      // heartbeat: the whole picture thumps on each beat (lub-dub at ~70 bpm)
      let beat = 0;
      if (t > Q.heart0 - 0.2 && t < Q.heart1 + 0.4) {
        const env = Math.min(U.clamp((t - Q.heart0 + 0.2) / 0.6), U.clamp((Q.heart1 + 0.4 - t) / 0.6));
        const ph = ((t - Q.heart0) % 0.86 + 0.86) % 0.86;
        beat = env * (Math.exp(-ph * 14) + 0.6 * Math.exp(-Math.max(0, ph - 0.17) * 14) * (ph > 0.17 ? 1 : 0));
      }
      const z = 1 + 0.012 * beat;
      c.filter = `saturate(${TL.sat(t).toFixed(3)})`;
      c.drawImage(gl, (W - W * z) / 2, (HT - HT * z) / 2, W * z, HT * z);
      c.filter = 'none';
      // the low sun's haze
      glow(c, 760, 2050, 900, '255,190,120', 0.12);
      motes(c, t);
      // vignette: tightens with the silence, reddens on the heartbeat
      const quiet = U.smooth(Q.still, Q.silence, t);
      const vg = c.createRadialGradient(540, 980, U.lerp(520, 340, quiet), 540, 980, 1250);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${Math.round(70 * beat)},0,0,${U.lerp(0.28, 0.62, quiet) + 0.15 * beat})`);
      c.fillStyle = vg; c.fillRect(0, 0, W, HT);
      // the ringing that isn't there: a faint shimmer line across the frame
      if (t > Q.ring - 0.2 && t < Q.heart0 + 0.6) {
        const a = Math.min(U.clamp((t - Q.ring + 0.2) / 0.5), U.clamp((Q.heart0 + 0.6 - t) / 0.6));
        for (let i = 0; i < 3; i++) { const y = 960 + Math.sin(t * 40 + i * 2) * 3 + (i - 1) * 7; c.fillStyle = `rgba(255,255,255,${0.05 * a})`; c.fillRect(0, y, W, 1.5); }
      }
      // light grain, a touch heavier as it gets quieter
      const gk = 0.02 + 0.04 * quiet, f = Math.floor(t * TL.FPS);
      for (let i = 0; i < 600; i++) { c.fillStyle = U.hash(i + f * 1.7) > 0.5 ? `rgba(255,255,255,${gk})` : `rgba(0,0,0,${gk * 1.5})`; c.fillRect(U.hash(f * 13 + i) * W, U.hash(f * 7 + i * 3) * HT, 2, 2); }
      hud(c, t);
    }
    captions(c, t);
    const k = U.clamp((t - (TL.DURATION - 0.5)) / 0.5);
    if (k > 0) { c.fillStyle = `rgba(0,0,0,${k})`; c.fillRect(0, 0, W, HT); }
    c.restore();
  }
  g.Film = { render, init() {} };
})(window);
