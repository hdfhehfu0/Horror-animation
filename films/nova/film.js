/* =========================================================================
   BETELGEUSE (first person) — film.js
   Composites one frame: the 3D world (world.js: the cabin, the fire, the
   window, your hands, your friend, the snow and the sky with Orion and the
   supernova), then the grade -- warm by the fire, cold blue outside -- a
   vignette and fine grain;
   then the text: the countdown at left centre (V11 style, one second per
   number, landing on zero), your friend in white italic serif, you in
   #FFD54A. Film.render(ctx, t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, World } = g;
  const W = TL.W, HT = TL.H;
  const SERIF = '"EB Garamond", "Cormorant Garamond", Garamond, Georgia, serif';
  const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
  if (document.fonts && document.fonts.load) for (const f of ['italic 400 40px "EB Garamond"', '500 40px "EB Garamond"', '500 150px "EB Garamond"', '700 21px Inter', '600 14px Inter']) document.fonts.load(f).catch(() => {});

  function glow(c, x, y, r, rgb, a) {
    if (a <= 0.002 || r <= 1) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.3, `rgba(${rgb},${a * 0.4})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }

  /* ------------------------------ text ------------------------------ */
  function wrap(c, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (c.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
    if (cur) lines.push(cur); return lines;
  }
  function captions(c, t) {
    for (const b of TL.blocks) {
      if (t < b.t0 || t > b.t1) continue;
      const a = Math.min(U.clamp((t - b.t0) / 0.18), U.clamp((b.t1 - t) / 0.25)), hero = b.kind === 'hero';
      c.save(); c.globalAlpha = a;
      c.font = hero ? `500 41px ${SERIF}` : `italic 400 41px ${SERIF}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const lines = wrap(c, b.text, 760), lh = 55, y0 = 1401 - (lines.length - 1) * lh / 2;
      c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 9; c.shadowOffsetY = 1.5;
      c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.5)'; lines.forEach((ln, i) => c.strokeText(ln, 540, y0 + i * lh));
      c.fillStyle = hero ? '#FFD54A' : '#f2f2ef';
      lines.forEach((ln, i) => c.fillText(ln, 540, y0 + i * lh));
      c.restore();
    }
  }
  // V11 countdown: a small spaced label, a big gold numeral, one second per number, landing on zero
  function countdown(c, t) {
    const C = TL.countdown; if (t < C.t0 || t > C.t1 + 0.4) return;
    const into = t - C.t0, n = Math.max(0, 5 - Math.floor(into)), frac = into - Math.floor(into);
    const a = Math.min(U.clamp(into / 0.2), 1 - U.clamp((t - C.t1) / 0.4));
    c.save(); c.globalAlpha = a; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 8;
    c.fillStyle = '#f4f4f2'; c.font = `700 21px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '4px'; c.fillText(C.label, 74, 870);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    const pop = n === 0 ? U.clamp((t - C.zero) / 0.12) : U.clamp(frac / 0.12), sc = 1.08 - 0.08 * pop;
    c.save(); c.translate(66, 1092); c.scale(sc, sc);
    c.globalAlpha = a * (0.35 + 0.65 * pop); c.fillStyle = '#e0bb62'; c.font = `500 150px ${SERIF}`; c.fillText(String(n), 0, 0);
    c.restore();
    c.globalAlpha = a * 0.78; c.fillStyle = '#e2e2df'; c.font = `600 14px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '3.5px';
    c.fillText(n === 0 ? 'NOW' : 'SECONDS', 74, 1152);
    c.restore();
  }

  /* ------------------------------ the frame ------------------------------ */
  let BLUR;
  function render(c, t) {
    t = U.clamp(t, 0, TL.DURATION - 1e-6);
    const s = TL.sceneT(t), C = TL.cam(t);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, HT);
    World.prepare(t);
    c.drawImage(World.draw(), 0, 0);
    // grade: warm and close by the fire; cold and open in the snow
    const inside = !C.wide && TL.inside(s);
    c.fillStyle = inside ? 'rgba(46,22,6,0.07)' : 'rgba(14,22,46,0.08)'; c.fillRect(0, 0, W, HT);
    const vg = c.createRadialGradient(540, 960, 560, 540, 960, 1260); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, inside ? 'rgba(8,3,0,0.45)' : 'rgba(0,0,0,0.36)');
    c.fillStyle = vg; c.fillRect(0, 0, W, HT);
    // the flash: a cold bloom round the star as its light arrives, and the whole night lifted for a moment
    const bu = C.wide ? 0 : TL.burst(s);
    if (bu > 0.003) {
      const sp = World.starScreen();
      if (sp) {                                     // a soft bloom (gaussian-like falloff: no edge)
        const r = 300 + 560 * (1 - bu), gr = c.createRadialGradient(sp.x, sp.y, 1, sp.x, sp.y, r);
        [[0, 1], [0.08, 0.62], [0.2, 0.3], [0.36, 0.12], [0.55, 0.04], [0.78, 0.01], [1, 0]].forEach(([o, k]) => gr.addColorStop(o, `rgba(205,222,255,${0.42 * bu * k})`));
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.fillRect(sp.x - r, sp.y - r, 2 * r, 2 * r); c.restore();
      }
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(120,140,190,${0.1 * bu})`; c.fillRect(0, 0, W, HT); c.restore();
    }
    const f = Math.floor(t * TL.FPS);
    for (let i = 0; i < 520; i++) { c.fillStyle = U.hash(i + f * 1.7) > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.045)'; c.fillRect(U.hash(f * 13 + i) * W, U.hash(f * 7 + i * 3) * HT, 2, 2); }
    // the hook's hard cut back to the start: a brief dip
    const dip = 1 - U.clamp(Math.abs(t - TL.HOOK) / 0.09);
    if (dip > 0) { c.fillStyle = `rgba(0,0,0,${0.85 * dip})`; c.fillRect(0, 0, W, HT); }
    // the last second: to black
    const end = U.clamp((t - (TL.DURATION - 1.1)) / 1.0);
    if (end > 0) { c.fillStyle = `rgba(0,0,0,${end})`; c.fillRect(0, 0, W, HT); }
    countdown(c, t);
    captions(c, t);
    c.restore();
  }
  g.Film = { render, init() {} };
})(window);
