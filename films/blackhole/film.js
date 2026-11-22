/* =========================================================================
   BLACK HOLE — film.js
   Composites one frame: a 2D sky (a rotating starfield, the Milky Way, the
   Moon) seen through the black hole -- a real point-lens remap of the sky
   pixels, so the stars smear into arcs and an Einstein ring around a patch
   of nothing -- behind the transparent 3D street (world.js). Then the Moon
   is torn away, the sky swings as Earth is flung out of orbit, a dawn
   fails, the Sun shrinks to a star, frost creeps in from the edges and the
   air falls as snow. Grain, the temperature HUD and the captions on top.
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
  const SKY_H = 1300, PIV = [540, 1900], ROT = 1.9;   // the sky turns about a point far below the frame

  function glow(c, x, y, r, rgb, a) {
    if (a <= 0.002 || r <= 1) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.3, `rgba(${rgb},${a * 0.4})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }

  /* ------------------------------ the star field (pivot-polar, so it can swing) ------------------------------ */
  let STARS, BANDS;
  function build() {
    if (STARS) return;
    const R = U.mulberry32(77); STARS = [];
    for (let i = 0; i < 14000; i++) {
      const r = Math.sqrt(R() * (2080 ** 2 - 540 ** 2) + 540 ** 2), a = R() * TAU, b = R();
      STARS.push([r, a, 0.7 + Math.pow(R(), 3) * 2.6, 0.12 + Math.pow(b, 2) * 0.85, R() * 6, R() < 0.12 ? 1 : R() < 0.2 ? 2 : 0]);
    }
    // two Milky Way bands: one in tonight's sky, one that swings into view after Earth is thrown out
    BANDS = [];
    for (const [rot, x0, y0, x1, y1, n] of [[0, -120, 1040, 1200, 120, 5200], [ROT, -100, 180, 1180, 1000, 7000]]) {
      for (let i = 0; i < n; i++) {
        const u = R(), off = (R() + R() + R() - 1.5) * 150;
        const x = U.lerp(x0, x1, u) + off * 0.45, y = U.lerp(y0, y1, u) + off;
        const dx = x - PIV[0], dy = y - PIV[1];
        BANDS.push([Math.hypot(dx, dy), Math.atan2(dy, dx) - rot, 0.6 + R() * 1.6, 0.05 + R() * 0.22, rot ? 1 : 0, R()]);
      }
    }
  }
  const rotAt = (t) => ROT * U.easeInOut(K.fling(t));

  /* ------------------------------ the sky layer (everything the lens bends) ------------------------------ */
  let SL, sx;
  function skyLayer(t) {
    build();
    if (!SL) { SL = document.createElement('canvas'); SL.width = W; SL.height = SKY_H; sx = SL.getContext('2d', { willReadFrequently: true }); }
    const c = sx, moonLight = 1 - K.moon(t), airless = K.airless(t), dawn = K.dawn(t), lightsOff = U.smooth(K.out, K.out + 1, t);
    const gr = c.createLinearGradient(0, 0, 0, SKY_H);
    gr.addColorStop(0, '#02030a'); gr.addColorStop(0.7, moonLight > 0 ? `rgba(${8 + 10 * moonLight},${12 + 16 * moonLight},${30 + 26 * moonLight},1)` : '#04060d');
    gr.addColorStop(1, `rgba(${Math.round(14 + 20 * moonLight * (1 - lightsOff))},${Math.round(18 + 22 * moonLight * (1 - lightsOff))},${Math.round(38 + 26 * moonLight)},1)`);
    c.globalCompositeOperation = 'source-over'; c.fillStyle = gr; c.fillRect(0, 0, W, SKY_H);
    c.fillStyle = `rgba(2,3,8,${airless * 0.85})`; c.fillRect(0, 0, W, SKY_H);   // no air: no sky glow at all
    // stars: they swing with the sky, streaking while it moves
    const rot = rotAt(t), vel = (rotAt(t + 0.04) - rot) / 0.04, bright = 0.75 + 0.25 * lightsOff + 0.35 * airless;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const [r, a0, sz, al, ph, col] of STARS) {
      const a = a0 + rot, x = PIV[0] + Math.cos(a) * r, y = PIV[1] + Math.sin(a) * r;
      if (x < -20 || x > W + 20 || y < -20 || y > SKY_H) continue;
      const tw = 1 - (1 - airless) * 0.4 * (0.5 + 0.5 * Math.sin(t * (1.5 + ph) + ph * 9));
      const rgb = col === 1 ? '255,214,170' : col === 2 ? '170,200,255' : '255,255,255';
      const A = Math.min(1, al * tw * bright);
      if (Math.abs(vel) > 0.05) {
        const L = vel * 0.06 * r; c.strokeStyle = `rgba(${rgb},${A * 0.8})`; c.lineWidth = sz;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * L, y - Math.cos(a) * L); c.stroke();
      } else { c.fillStyle = `rgba(${rgb},${A})`; c.fillRect(x - sz / 2, y - sz / 2, sz, sz); }
    }
    for (const [r, a0, sz, al, which, h] of BANDS) {
      const a = a0 + rot, x = PIV[0] + Math.cos(a) * r, y = PIV[1] + Math.sin(a) * r;
      if (x < -10 || x > W + 10 || y < -10 || y > SKY_H) continue;
      const vis = which ? 0.8 + 0.9 * airless : 0.7 + 0.4 * lightsOff;
      c.fillStyle = `rgba(${200 + 55 * h},${210 + 40 * h},255,${al * vis})`; c.fillRect(x, y, sz, sz);
    }
    c.restore();
    // tonight's Milky Way glow, low on the left; after the fling, a brighter core swings in
    const swing = (x, y) => { const dx = x - PIV[0], dy = y - PIV[1], a = Math.atan2(dy, dx) + rot, r = Math.hypot(dx, dy); return [PIV[0] + Math.cos(a) * r, PIV[1] + Math.sin(a) * r]; };
    const [gx, gy] = swing(160, 960); glow(c, gx, gy, 420, '255,220,170', 0.16);
    const [hx, hy] = swing(...(() => { const dx = 300 - PIV[0], dy = 520 - PIV[1], a = Math.atan2(dy, dx) - ROT, r = Math.hypot(dx, dy); return [PIV[0] + Math.cos(a) * r, PIV[1] + Math.sin(a) * r]; })());
    glow(c, hx, hy, 520, '255,226,190', 0.1 + 0.16 * airless);
    // the Moon -- until the black hole tears it away
    const mk = K.moon(t);
    if (mk < 1) {
      const [lx, ly] = K.lensPos(t), q = U.easeIn(mk);
      const p0 = [830, 300], p1 = [lx + 110, ly - 70], p2 = [-420, 120];
      const B = (i) => (1 - q) * (1 - q) * p0[i] + 2 * q * (1 - q) * p1[i] + q * q * p2[i];
      const dB = (i) => 2 * (1 - q) * (p1[i] - p0[i]) + 2 * q * (p2[i] - p1[i]);
      const mx = B(0), my = B(1), ang = Math.atan2(dB(1), dB(0)), str = 1 + 2.4 * Math.sin(Math.PI * mk);
      glow(c, mx, my, 260, '190,205,235', 0.32 * (1 - mk));
      c.save(); c.translate(mx, my); c.rotate(ang); c.scale(str, 1 / Math.sqrt(str));
      const mr = 44, mg = c.createRadialGradient(-10, -10, 4, 0, 0, mr); mg.addColorStop(0, '#fbfaf3'); mg.addColorStop(1, '#d4d1c4');
      c.fillStyle = mg; c.beginPath(); c.arc(0, 0, mr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(120,124,128,0.28)';
      for (const [ox, oy, rr] of [[-14, -10, 12], [8, -16, 9], [12, 6, 14], [-8, 14, 8], [-22, 6, 6]]) { c.beginPath(); c.arc(ox, oy, rr, 0, TAU); c.fill(); }
      c.restore();
    }
    // a dawn that never comes, then the Sun -- just a bright star, low on the left
    const SUN = swing(...(() => { const dx = 600 - PIV[0], dy = 880 - PIV[1], a = Math.atan2(dy, dx) - ROT, r = Math.hypot(dx, dy); return [PIV[0] + Math.cos(a) * r, PIV[1] + Math.sin(a) * r]; })());
    glow(c, SUN[0], 1060, 760, '255,170,110', 0.32 * dawn);
    const sun = K.sun(t);
    if (sun > 0) {
      glow(c, SUN[0], SUN[1], 90, '255,240,215', 0.5 * sun); glow(c, SUN[0], SUN[1], 14, '255,255,250', 1 * sun);
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(SUN[0], SUN[1]);
      for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); const sg = c.createLinearGradient(0, 0, 150, 0); sg.addColorStop(0, `rgba(255,248,235,${0.75 * sun})`); sg.addColorStop(1, 'rgba(255,248,235,0)'); c.fillStyle = sg; c.fillRect(0, -1.5, 150, 3); }
      c.restore();
    }
    return SL;
  }

  /* ------------------------------ the lens: remap the sky pixels through a point mass ------------------------------ */
  let OUT, outW = 0, outH = 0;
  function lens(c, t) {
    const tE = K.lensR(t);
    if (tE < 1.5) return;
    let [bx, by] = K.lensPos(t);
    const rot = rotAt(t); if (rot > 0) { const dx = bx - PIV[0], dy = by - PIV[1], a = Math.atan2(dy, dx) + rot, r = Math.hypot(dx, dy); bx = PIV[0] + Math.cos(a) * r; by = PIV[1] + Math.sin(a) * r; }
    const R = Math.min(1000, Math.max(tE * 3.4, 60));
    const x0 = Math.max(0, Math.floor(bx - R)), y0 = Math.max(0, Math.floor(by - R)), x1 = Math.min(W, Math.ceil(bx + R)), y1 = Math.min(SKY_H, Math.ceil(by + R));
    const w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return;
    const src = sx.getImageData(x0, y0, w, h).data;
    if (w !== outW || h !== outH) { OUT = c.createImageData(w, h); outW = w; outH = h; }
    const o = OUT.data, e2 = tE * tE, rs = 0.42 * tE, R0 = 0.55 * R;
    for (let j = 0; j < h; j++) {
      const dy = y0 + j + 0.5 - by;
      for (let i = 0; i < w; i++) {
        const dx = x0 + i + 0.5 - bx, r = Math.sqrt(dx * dx + dy * dy) + 1e-6, q = (j * w + i) * 4;
        if (r < rs - 1) { o[q] = 0; o[q + 1] = 0; o[q + 2] = 0; o[q + 3] = 255; continue; }
        const wgt = r < R0 ? 1 : r > R ? 0 : 1 - U.smooth(R0, R, r);
        const beta = r - wgt * e2 / r, f = beta / r;
        let si = Math.round(bx + dx * f - x0 - 0.5), sj = Math.round(by + dy * f - y0 - 0.5);
        si = si < 0 ? 0 : si >= w ? w - 1 : si; sj = sj < 0 ? 0 : sj >= h ? h - 1 : sj;
        const p = (sj * w + si) * 4, u = tE / r;
        let mu = wgt > 0 ? 1 / Math.abs(1 - u * u * u * u * wgt) : 1; mu = mu > 4 ? 4 : mu;
        const m = Math.pow(mu, 0.55), edge = r < rs + 1 ? U.clamp((r - rs + 1) / 2) : 1;
        o[q] = Math.min(255, src[p] * m) * edge; o[q + 1] = Math.min(255, src[p + 1] * m) * edge; o[q + 2] = Math.min(255, src[p + 2] * m) * edge; o[q + 3] = 255;
      }
    }
    c.putImageData(OUT, x0, y0);
    // a faint ring of bent starlight hugging the edge of the shadow
    c.save(); c.globalCompositeOperation = 'lighter';
    const rg = c.createRadialGradient(bx, by, rs * 0.98, bx, by, rs * 1.35); rg.addColorStop(0, 'rgba(190,210,255,0.22)'); rg.addColorStop(0.25, 'rgba(160,185,255,0.08)'); rg.addColorStop(1, 'rgba(150,170,255,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(bx, by, rs * 1.4, 0, TAU); c.arc(bx, by, rs, 0, TAU, true); c.fill('evenodd'); c.restore();
    return [bx, by, tE];
  }

  /* ------------------------------ snow: the frozen air, falling ------------------------------ */
  function snow(c, t) {
    const k = K.snow(t); if (k <= 0.01) return;
    c.save();
    for (let i = 0; i < 1100; i++) {
      if (U.hash(i * 1.7) > k) continue;
      const d = 0.3 + U.hash(i * 3.1) * 0.7, sp = 50 + 170 * d, sw = Math.sin(t * (0.6 + U.hash(i) * 0.8) + i) * 26 * d;
      const x = ((U.hash(i * 5.3) * W + t * 22 * d + sw) % (W + 40) + W + 40) % (W + 40) - 20, y = ((U.hash(i * 7.9) * (HT + 60) + t * sp) % (HT + 60)) - 30;
      c.fillStyle = `rgba(235,242,250,${(0.35 + 0.5 * d) * Math.min(1, k * 1.5)})`;
      c.beginPath(); c.arc(x, y, 1 + 3.2 * d * d, 0, TAU); c.fill();
    }
    c.restore();
  }

  /* ------------------------------ numbers + HUD ------------------------------ */
  function hud(c, t) {
    const T = Math.round(TL.temp(t));
    c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 10;
    c.fillStyle = 'rgba(235,238,242,0.85)'; c.font = `600 21px ${SANS}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = '4px';
    c.fillText('AVERAGE TEMPERATURE', 73, 230);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.fillStyle = T < -100 ? '#cfe3ff' : '#ffffff'; c.font = `500 72px ${MONO}`;
    c.fillText(`${T < 0 ? '−' : ''}${Math.abs(T)}°C`, 70, 318);
    c.fillStyle = 'rgba(225,228,232,0.75)'; c.font = `500 18px ${MONO}`;
    c.fillText(TL.status(t), 73, 362);
    c.restore();
  }
  // a thin targeting box around the patch of sky that's wrong
  function tag(c, t, L) {
    const a = K.tag(t); if (a <= 0.01 || !L) return;
    const [bx, by, tE] = L, s = Math.max(70, tE * 0.75), k = s * 0.3;
    c.save(); c.globalAlpha = a * 0.85; c.strokeStyle = '#e9eef4'; c.lineWidth = 2;
    for (const [sx2, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.beginPath(); c.moveTo(bx + sx2 * s, by + sy2 * (s - k)); c.lineTo(bx + sx2 * s, by + sy2 * s); c.lineTo(bx + sx2 * (s - k), by + sy2 * s); c.stroke(); }
    c.fillStyle = '#e9eef4'; c.font = `500 18px ${MONO}`; c.textAlign = 'left'; c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 6;
    if ('letterSpacing' in c) c.letterSpacing = '2px';
    c.fillText('BLACK HOLE · 7 SUNS', bx - s, by + s + 30);
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
      c.drawImage(skyLayer(t), 0, 0);
      const L = lens(c, t);
      c.drawImage(World.render(t), 0, 0);
      // streetlight glows
      World.lamps().forEach((p, i) => { const v = World.lampLevel(i, t); if (v < 0.02) return; const s = World.project(p.x, p.y, p.z); if (s.vis) glow(c, s.x, s.y, 2000 / s.d, '255,206,140', 0.55 * v); });
      World.eyes(t).forEach((e) => { glow(c, e.x, e.y, 16, '200,230,255', 0.8 * e.a); glow(c, e.x, e.y, 4, '255,255,255', e.a); });
      snow(c, t);
      tag(c, t, L);
      // frost creeping in from the edges of the frame
      const fr = K.frost(t);
      if (fr > 0.01) {
        const fg = c.createRadialGradient(540, 960, 520, 540, 960, 1150); fg.addColorStop(0, 'rgba(200,225,245,0)'); fg.addColorStop(1, `rgba(200,225,245,${0.3 * fr})`);
        c.fillStyle = fg; c.fillRect(0, 0, W, HT);
      }
      // vignette
      const vg = c.createRadialGradient(540, 900, 420, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = vg; c.fillRect(0, 0, W, HT);
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
