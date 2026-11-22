/* =========================================================================
   GALAXY — film.js
   Composites one frame: a 2D sky (stars, the Milky Way, Andromeda growing
   from a faint smudge to a sky-filling spiral, the small neighbour's crash,
   tidal tails, a starburst, the two cores spiralling together, the merge
   flash and golden Milkomeda) behind the transparent 3D street (world.js),
   then the VHS rewind, grain, the distance HUD and the captions.
   Film.render(ctx, t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, World } = g;
  const W = TL.W, HT = TL.H, TAU = Math.PI * 2;
  const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
  const MONO = '"JetBrains Mono", "IBM Plex Mono", Menlo, monospace';
  if (document.fonts && document.fonts.load) for (const f of ['700 47px Inter', '800 70px Inter', '500 72px "JetBrains Mono"', '700 20px "JetBrains Mono"']) document.fonts.load(f).catch(() => {});
  const K = TL.k;
  const HORIZON = 1100;

  function glow(c, x, y, r, rgb, a) {
    if (a <= 0.002 || r <= 1) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.3, `rgba(${rgb},${a * 0.4})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }

  /* ------------------------------ Andromeda: drawn once to an offscreen canvas ------------------------------ */
  let GAL;
  function galaxyTexture() {
    if (GAL) return GAL;
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    const cx = N / 2, R = U.mulberry32(31);
    x.globalCompositeOperation = 'lighter';
    // disk haze
    let gr = x.createRadialGradient(cx, cx, 10, cx, cx, 500); gr.addColorStop(0, 'rgba(255,236,205,0.55)'); gr.addColorStop(0.25, 'rgba(200,205,255,0.18)'); gr.addColorStop(1, 'rgba(120,140,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, N, N);
    // two logarithmic arms of blue stars and pink knots
    for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 2600; i++) {
      const th = (i / 2600) * 3.4 * Math.PI, r = 28 * Math.exp(0.24 * th) + (R() - 0.5) * 26 * (1 + th * 0.3);
      if (r > 480) continue;
      const a = th + arm * Math.PI + (R() - 0.5) * 0.25;
      const px = cx + Math.cos(a) * r, py = cx + Math.sin(a) * r, s = 0.6 + R() * 2.2;
      x.fillStyle = R() > 0.92 ? 'rgba(255,150,200,0.55)' : `rgba(${180 + R() * 60},${200 + R() * 40},255,${0.25 + R() * 0.35})`;
      x.beginPath(); x.arc(px, py, s, 0, TAU); x.fill();
    }
    // a sprinkle of stars everywhere in the disk
    for (let i = 0; i < 5000; i++) { const a = R() * TAU, r = Math.pow(R(), 1.7) * 480; x.fillStyle = `rgba(255,240,220,${0.15 + R() * 0.3})`; x.fillRect(cx + Math.cos(a) * r, cx + Math.sin(a) * r, 1.4, 1.4); }
    // bright core
    gr = x.createRadialGradient(cx, cx, 1, cx, cx, 170); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.2, 'rgba(255,226,170,0.8)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    x.fillStyle = gr; x.fillRect(0, 0, N, N);
    // dust lanes along the arms
    x.globalCompositeOperation = 'destination-out';
    for (let arm = 0; arm < 2; arm++) { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 14; x.beginPath();
      for (let th = 0.6; th < 3.2 * Math.PI; th += 0.05) { const r = 28 * Math.exp(0.24 * th) - 16, a = th + arm * Math.PI + 0.18; const px = cx + Math.cos(a) * r, py = cx + Math.sin(a) * r; th < 0.65 ? x.moveTo(px, py) : x.lineTo(px, py); }
      x.stroke(); }
    GAL = c; return c;
  }

  /* ------------------------------ the sky ------------------------------ */
  function sky(c, t) {
    const st = TL.st(t), dist = TL.dist(t), glowK = K.glow(st), burst = K.burst(st), tear = K.tear(st);
    const merged = st > K.merge ? 1 : 0;
    // base gradient: night navy, warming and brightening as the galaxies close in
    const top = merged ? '#2a1a10' : burst > 0 ? '#120a24' : '#03050d', low = merged ? '#e6b77a' : `rgba(${Math.round(20 + 90 * glowK)},${Math.round(26 + 50 * glowK)},${Math.round(60 + 80 * glowK)},1)`;
    const gr = c.createLinearGradient(0, 0, 0, HORIZON + 200); gr.addColorStop(0, top); gr.addColorStop(1, low);
    c.fillStyle = gr; c.fillRect(0, 0, W, HT);
    // stars (twinkling)
    for (let i = 0; i < 700; i++) { const x = U.hash(i * 1.3) * W, y = U.hash(i * 2.7) * (HORIZON + 50), tw = 0.55 + 0.45 * Math.sin(t * (1 + U.hash(i) * 3) + i); c.fillStyle = `rgba(255,255,255,${(0.15 + U.hash(i * 5.1) * 0.6) * tw})`; c.fillRect(x, y, 1.6 + U.hash(i * 7) * 1.6, 1.6 + U.hash(i * 7) * 1.6); }
    // the Milky Way: a dusty band from the lower left to the upper right, its core low on the left
    const warp = tear * 160;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2600; i++) {
      const u = U.hash(i * 3.7), off = (U.hash(i * 9.1) + U.hash(i * 4.3) - 1) * 170;
      let x = U.lerp(-120, 1200, u), y = U.lerp(1040, 120, u) + off;
      y += Math.sin(u * Math.PI * 2 + t * 0.05) * warp;
      c.fillStyle = `rgba(${200 + 55 * U.hash(i)},${210 + 40 * U.hash(i * 2)},255,${0.08 + 0.22 * U.hash(i * 5.3)})`;
      c.fillRect(x, y, 2, 2);
    }
    c.restore();
    glow(c, 180, 960, 420, '255,220,170', 0.22);               // the galactic core, low on the left
    glow(c, 540, 1090, 760, '110,120,170', 0.3 * (1 - glowK));     // a faint glow along the horizon (tonight)
    // tidal tails: two long arcs of stars flung out when the galaxies tear at each other
    if (tear > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) for (let i = 0; i < 900; i++) {
        const u = U.hash(i * 1.1 + k * 7), a = (k ? 0.9 : 3.9) + u * 2.6 * tear, r = 200 + u * 900 * tear;
        const x = 640 + Math.cos(a) * r * 1.2 + (U.hash(i * 3) - 0.5) * 60, y = 560 + Math.sin(a) * r * 0.55 + (U.hash(i * 5) - 0.5) * 60;
        c.fillStyle = `rgba(200,215,255,${0.25 * tear * U.hash(i * 2.2)})`; c.fillRect(x, y, 2.2, 2.2);
      }
      c.restore();
    }
    // Andromeda: from a faint smudge to the whole sky
    const S = Math.min(5200, 150 * Math.pow(2.5e6 / Math.max(dist, 2e4), 0.9));
    const ax = 700 - tear * 60, ay = 560 + tear * 30;
    if (!merged) {
      const tex = galaxyTexture(), al = U.clamp(0.4 + 0.6 * (1 - dist / 2.5e6) + glowK) * (S > 1800 ? U.lerp(1, 0.4, U.clamp((S - 1800) / 3400)) : 1);
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, al);
      c.translate(ax, ay); c.rotate(-0.62 + tear * 0.4); c.scale(1, 0.38 + tear * 0.25);
      c.drawImage(tex, -S / 2, -S / 2, S, S);
      if (tear > 0) { c.globalAlpha = 0.35 * tear; c.rotate(0.25); c.drawImage(tex, -S * 0.55, -S * 0.5, S * 1.1, S); }
      c.restore();
    }
    // the Large Magellanic Cloud: a ragged blue cloud that swings in and crashes into the band
    const lk = K.lmc(st);
    if (lk > 0 && st < K.lmcHit + 2.5) {
      const x = U.lerp(1180, 330, U.easeIn(lk)), y = U.lerp(250, 780, U.easeIn(lk)), sz = U.lerp(90, 210, lk);
      for (let i = 0; i < 14; i++) glow(c, x + (U.hash(i) - 0.5) * sz, y + (U.hash(i * 3) - 0.5) * sz * 0.6, sz * (0.3 + U.hash(i * 7) * 0.5), i % 3 ? '170,200,255' : '255,170,220', 0.16 * (st < K.lmcHit ? 1 : U.clamp(1 - (st - K.lmcHit) / 2.5)));
      if (st > K.lmcHit) { const f = U.clamp(1 - (st - K.lmcHit) / 1.6); glow(c, 330, 780, 700, '255,235,210', 0.8 * f); }
    }
    // the starburst: pink and blue nurseries lighting up everywhere
    if (burst > 0 && !merged) {
      for (let i = 0; i < 160; i++) {
        const on = U.clamp(burst * 1.4 - U.hash(i * 1.9) * 0.6); if (on <= 0) continue;
        const x = U.hash(i * 4.4) * W, y = U.hash(i * 6.1) * (HORIZON - 80), r = 30 + U.hash(i * 2.5) * 140;
        glow(c, x, y, r * on, U.hash(i) > 0.5 ? '255,120,200' : '120,180,255', 0.22 * on * (0.7 + 0.3 * Math.sin(t * 2 + i)));
      }
      for (let i = 0; i < 6; i++) glow(c, U.hash(i * 9) * W, U.hash(i * 11) * 900, 600, i % 2 ? '200,80,180' : '80,120,255', 0.12 * burst);
    }
    // the two hearts: the Milky Way's core and Andromeda's spiral together, then merge
    const ck = K.cores(st);
    if (ck > 0 && !merged) {
      const m = U.easeIn(ck), cx = 540, cy = 600, ang = ck * 5;
      const r1 = (1 - m) * 520, r2 = (1 - m) * 380;
      const x1 = cx + Math.cos(ang + Math.PI) * r1, y1 = cy + Math.sin(ang + Math.PI) * r1 * 0.5;
      const x2 = cx + Math.cos(ang) * r2, y2 = cy + Math.sin(ang) * r2 * 0.5;
      glow(c, x1, y1, 220, '255,200,140', 0.45); glow(c, x2, y2, 260, '200,215,255', 0.5);
      glow(c, x1, y1, 46, '255,250,230', 0.9); glow(c, x2, y2, 56, '235,240,255', 0.9);
    }
    // Milkomeda: one vast golden elliptical glow
    if (merged) {
      const e = U.clamp((st - K.merge) / 2.5);
      c.save(); c.translate(540, 620); c.scale(1, 0.62);
      const gg = c.createRadialGradient(0, 0, 10, 0, 0, 1500); gg.addColorStop(0, 'rgba(255,248,230,1)'); gg.addColorStop(0.18, 'rgba(255,215,150,0.85)'); gg.addColorStop(0.55, 'rgba(230,150,90,0.35)'); gg.addColorStop(1, 'rgba(120,70,40,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = gg; c.globalAlpha = 0.5 + 0.5 * e; c.fillRect(-1600, -1600, 3200, 3200); c.restore();
    }
  }

  /* ------------------------------ numbers + HUD ------------------------------ */
  function hud(c, t) {
    const d = TL.dist(t), y = TL.years(t);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 10;
    c.fillStyle = 'rgba(235,238,242,0.85)'; c.font = `600 21px ${SANS}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = '4px';
    c.fillText('DISTANCE TO ANDROMEDA', 73, 230);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.fillStyle = '#ffffff'; c.font = `500 72px ${MONO}`;
    c.fillText(`${Math.round(d).toLocaleString('en-US')} ly`, 70, 318);
    c.fillStyle = 'rgba(225,228,232,0.75)'; c.font = `500 18px ${MONO}`;
    c.fillText(y < 0.005 ? 'NOW' : `${y.toFixed(1)} BILLION YEARS FROM NOW`, 73, 362);
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
      if (b.kind === 'title') block(c, b.text, 640, 64, 800, 1000, a);
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


  /* ------------------------------ the frame ------------------------------ */
  function render(c, t) {
    t = U.clamp(t, 0, TL.DURATION - 1e-6);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, HT);
    if (t < TL.CUT) {
      sky(c, t);
      c.drawImage(World.render(t), 0, 0);
      const st = TL.st(t);
      // streetlight glows (tonight only)
      const lamp = 1 - K.empty(st);
      if (lamp > 0.01) World.lamps().forEach((p) => { const s = World.project(p.x, p.y, p.z); if (s.vis) glow(c, s.x, s.y, 2000 / s.d, '255,206,140', 0.55 * lamp); });
      // the merge flash
      if (st > K.merge && st < K.merge + 2) { const f = 1 - (st - K.merge) / 2; c.fillStyle = `rgba(255,252,240,${f * f})`; c.fillRect(0, 0, W, HT); }
      // vignette
      const vg = c.createRadialGradient(540, 900, 420, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = vg; c.fillRect(0, 0, W, HT);
      // the VHS rewind on "Or maybe not."
      const [r0, r1] = TL.REW;
      if (t > r0 - 0.05 && t < r1 + 0.25) {
        const k = Math.sin(Math.PI * U.clamp((t - r0 + 0.05) / (r1 - r0 + 0.3))), f = Math.floor(t * 30);
        const img = c.getImageData(0, 0, W, HT); c.putImageData(img, 0, 0);
        for (let i = 0; i < 26; i++) { const y = Math.floor(U.hash(f * 3 + i) * HT), h = 6 + U.hash(i * 7 + f) * 50; c.drawImage(c.canvas, 0, y, W, h, (U.hash(i + f) - 0.5) * 140 * k, y, W, h); }
        for (let i = 0; i < 3; i++) { const y = ((t * 900 + i * 640) % (HT + 200)) - 100; c.fillStyle = `rgba(255,255,255,${0.18 * k})`; c.fillRect(0, y, W, 18 + i * 6); }
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 * k; c.drawImage(c.canvas, 10 * k, 0); c.restore();
        c.fillStyle = `rgba(255,255,255,${0.85 * k})`; c.font = `700 54px ${MONO}`; c.textAlign = 'right'; c.fillText('◀◀', 1000, 330);
      }
      // grain
      const f = Math.floor(t * TL.FPS);
      for (let i = 0; i < 600; i++) { c.fillStyle = U.hash(i + f * 1.7) > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)'; c.fillRect(U.hash(f * 13 + i) * W, U.hash(f * 7 + i * 3) * HT, 2, 2); }
      hud(c, t);
    }
    captions(c, t);
    const k = U.clamp((t - (TL.DURATION - 0.5)) / 0.5);
    if (k > 0) { c.fillStyle = `rgba(0,0,0,${k})`; c.fillRect(0, 0, W, HT); }
    c.restore();
  }
  g.Film = { render, init() {} };
})(window);
