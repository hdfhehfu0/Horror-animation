/* =========================================================================
   STOPPED SPINNING — film.js
   Composites one frame: a 2D sky that follows the day clock (blue day,
   orange dusk and dawn, starry night), the Sun's disc and glare moving along
   its arc -- racing in the time-lapse, then stuck at noon, then sinking --
   behind the transparent 3D street (world.js). Then heat haze in the long
   day, a ▶▶ TIME-LAPSE badge, grain, the spin HUD and the captions.
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
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  // where the Sun is on screen for a position s along its arc (0 = rising left, 1 = setting right)
  const sunXY = (s) => [U.lerp(-170, 1250, s), 1090 - 730 * Math.sin(Math.PI * U.clamp(s))];

  /* ------------------------------ the sky ------------------------------ */
  function sky(c, t) {
    const S = TL.sun(t), day = S.day, tw = S.tw, bake = K.bake(t);
    // colours: night -> twilight (orange low, violet high) -> day blue -> the bleached white-blue of the long day
    let top = mix([3, 5, 14], [44, 52, 104], tw), low = mix([12, 18, 42], [236, 132, 72], tw);
    top = mix(top, mix([52, 118, 204], [140, 170, 205], bake), day); low = mix(low, mix([186, 214, 238], [242, 230, 200], bake), day);
    const gr = c.createLinearGradient(0, 0, 0, HORIZON + 80); gr.addColorStop(0, rgb(top)); gr.addColorStop(0.75, rgb(mix(top, low, 0.65))); gr.addColorStop(1, rgb(low));
    c.fillStyle = gr; c.fillRect(0, 0, W, HT);
    // the glow of dusk/dawn sits on the horizon where the Sun is (or just was)
    if (tw > 0.01) { const hx = S.up ? sunXY(S.s)[0] : S.s < 1.5 ? 1080 : 0; glow(c, U.clamp(hx, 0, W), HORIZON, 900, '255,140,70', 0.42 * tw); }
    // stars whenever it's dark; in the long night they come out fully
    const starA = (1 - day) * (1 - 0.7 * tw);
    if (starA > 0.02) {
      for (let i = 0; i < 900; i++) {
        const x = U.hash(i * 1.3) * W, y = U.hash(i * 2.7) * (HORIZON + 40), tw2 = 0.6 + 0.4 * Math.sin(t * (1 + U.hash(i) * 3) + i);
        c.fillStyle = `rgba(255,255,255,${(0.12 + U.hash(i * 5.1) * 0.6) * tw2 * starA})`; const s2 = 1.4 + U.hash(i * 7) * 1.8; c.fillRect(x, y, s2, s2);
      }
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2200; i++) { const u = U.hash(i * 3.7), off = (U.hash(i * 9.1) + U.hash(i * 4.3) - 1) * 160; c.fillStyle = `rgba(215,225,255,${(0.05 + 0.18 * U.hash(i * 5.3)) * starA})`; c.fillRect(U.lerp(-100, 1180, u), U.lerp(1000, 150, u) + off, 2, 2); }
      c.restore();
    }
    // the Sun: disc + glare; it streaks while the time-lapse races, burns bigger and whiter in the long day
    if (S.up && S.e > -0.05) {
      const [x, y] = sunXY(S.s), rate = TL.lapseRate(t), warm = 1 - U.smooth(0.15, 0.6, S.e);
      const core = mix([255, 252, 240], [255, 178, 96], warm).join(',');
      glow(c, x, y, 520 + 140 * bake, mix([255, 236, 190], [255, 150, 80], warm).join(','), 0.5 + 0.1 * bake);
      if (rate > 0.05) { for (let k = 1; k <= 6; k++) { const [px, py] = sunXY(S.s - k * rate * 0.012); glow(c, px, py, 70, core, 0.35 * (1 - k / 7)); } }
      glow(c, x, y, 120 + 40 * bake, core, 0.9);
      c.fillStyle = `rgb(${core})`; c.beginPath(); c.arc(x, y, 34 + 6 * bake, 0, TAU); c.fill();
    }
  }

  /* ------------------------------ heat haze: the lower frame shimmers in the long day ------------------------------ */
  function haze(c, t) {
    const k = K.bake(t) * (1 - U.smooth(TL.at(18), TL.end(18) + 1, t)); if (k < 0.02) return;
    for (let y = 880; y < 1500; y += 8) { const dx = Math.sin(y * 0.045 + t * 9) * 3.2 * k + Math.sin(y * 0.11 - t * 13) * 1.6 * k; c.drawImage(c.canvas, 0, y, W, 8, dx, y, W, 8); }
    c.fillStyle = `rgba(255,236,200,${0.1 * k})`; c.fillRect(0, 0, W, HT);
  }

  /* ------------------------------ numbers + HUD ------------------------------ */
  function hud(c, t) {
    const v = Math.round(TL.speed(t)), day = TL.sun(t).day;
    // a soft shade behind the HUD so it reads on a bright sky
    if (day > 0.01) { const sg = c.createLinearGradient(0, 0, 0, 560); sg.addColorStop(0, `rgba(10,16,28,${0.3 * day})`); sg.addColorStop(0.45, `rgba(10,16,28,${0.4 * day})`); sg.addColorStop(1, 'rgba(10,16,28,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, 560); }
    c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 10;
    c.fillStyle = 'rgba(235,238,242,0.9)'; c.font = `600 21px ${SANS}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = '4px';
    c.fillText("EARTH'S SPIN AT THE EQUATOR", 73, 230);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.fillStyle = v === 0 ? '#ffb27a' : '#ffffff'; c.font = `500 72px ${MONO}`;
    c.fillText(`${v.toLocaleString('en-US')} km/h`, 70, 318);
    c.fillStyle = 'rgba(232,235,240,0.85)'; c.font = `500 18px ${MONO}`;
    c.fillText(TL.status(t), 73, 362);
    // the time-lapse badge
    const lk = K.lapse(t);
    if (lk > 0.01) {
      c.globalAlpha = lk; c.textAlign = 'right'; c.font = `700 22px ${MONO}`; c.fillStyle = '#ffffff';
      if ('letterSpacing' in c) c.letterSpacing = '3px';
      c.fillText('▶▶ TIME-LAPSE', 1006, 230);
    }
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
      World.lamps().forEach((p, i) => { const v = World.lampLevel(i, t); if (v < 0.02) return; const s = World.project(p.x, p.y, p.z); if (s.vis) glow(c, s.x, s.y, 2000 / s.d, '255,206,140', 0.55 * v); });
      World.eyes(t).forEach((e) => { glow(c, e.x, e.y, 16, '255,214,170', 0.85 * e.a); glow(c, e.x, e.y, 4, '255,255,255', e.a); });
      haze(c, t);
      // the moment it stops: a jolt of light
      const hit = t - K.stopHit; if (hit > 0 && hit < 0.8) { c.fillStyle = `rgba(255,248,235,${0.35 * (1 - hit / 0.8)})`; c.fillRect(0, 0, W, HT); }
      // a cold rime creeping in from the edges in the long night
      const fr = K.frost(t);
      if (fr > 0.01) { const fg = c.createRadialGradient(540, 960, 540, 540, 960, 1150); fg.addColorStop(0, 'rgba(200,225,245,0)'); fg.addColorStop(1, `rgba(200,225,245,${0.22 * fr})`); c.fillStyle = fg; c.fillRect(0, 0, W, HT); }
      const vg = c.createRadialGradient(540, 900, 420, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      c.fillStyle = vg; c.fillRect(0, 0, W, HT);
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
