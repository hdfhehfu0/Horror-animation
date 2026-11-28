/* =========================================================================
   MOON (first person) — film.js
   Composites one frame: the sky behind everything (day blue -> dusk -> night
   with stars), the Moon drawn where it really sits in your view -- small,
   then huge, then cracking with glowing fissures and coming apart into
   drifting pieces -- and the burning pieces streaking down; then the 3D city
   (world.js) over it; then the light of the impacts, dust, lamp glow, motion
   blur when you whip your head round, grain; then the reference's text:
   the 5-4-3-2-1 countdown, the narrator in white italic serif and your own
   prayers in gold. Film.render(ctx, t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, World } = g;
  const W = TL.W, HT = TL.H, TAU = Math.PI * 2;
  const SERIF = '"EB Garamond", "Cormorant Garamond", Garamond, Georgia, serif';
  const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';
  if (document.fonts && document.fonts.load) for (const f of ['italic 400 39px "EB Garamond"', '500 38px "EB Garamond"', '600 128px "EB Garamond"', '700 20px Inter', '600 14px Inter']) document.fonts.load(f).catch(() => {});
  const F = 1 / Math.tan(TL.FOV * Math.PI / 360);   // focal length in half-heights

  function glow(c, x, y, r, rgb, a) {
    if (a <= 0.002 || r <= 1) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.3, `rgba(${rgb},${a * 0.4})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }
  const mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const rgb = (a) => `rgb(${a.map((v) => Math.round(v)).join(',')})`;

  /* ------------------------------ the Moon's face, drawn once ------------------------------ */
  let MOON;
  function moonTexture() {
    if (MOON) return MOON;
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), r = N / 2, Rr = U.mulberry32(77);
    x.save(); x.beginPath(); x.arc(r, r, r, 0, TAU); x.clip();
    let gr = x.createRadialGradient(r * 0.85, r * 0.8, r * 0.1, r, r, r); gr.addColorStop(0, '#f1eee6'); gr.addColorStop(0.75, '#d9d4c8'); gr.addColorStop(1, '#a9a498');
    x.fillStyle = gr; x.fillRect(0, 0, N, N);
    // maria: the dark seas
    for (const [mx, my, mr] of [[0.38, 0.36, 0.2], [0.55, 0.3, 0.16], [0.62, 0.48, 0.18], [0.3, 0.58, 0.14], [0.47, 0.62, 0.12], [0.7, 0.66, 0.1], [0.45, 0.45, 0.1]]) {
      for (let k = 0; k < 14; k++) {
        const px = (mx + (Rr() - 0.5) * mr) * N, py = (my + (Rr() - 0.5) * mr) * N, pr = mr * N * (0.25 + Rr() * 0.4);
        const g2 = x.createRadialGradient(px, py, 1, px, py, pr); g2.addColorStop(0, 'rgba(96,98,104,0.22)'); g2.addColorStop(1, 'rgba(96,98,104,0)');
        x.fillStyle = g2; x.fillRect(px - pr, py - pr, 2 * pr, 2 * pr);
      }
    }
    // craters: shadow on the lower right, light on the upper left
    for (let i = 0; i < 260; i++) {
      const a = Rr() * TAU, d = Math.sqrt(Rr()) * r * 0.97, cx = r + Math.cos(a) * d, cy = r + Math.sin(a) * d, cr = Math.pow(Rr(), 2.4) * 46 + 3;
      x.fillStyle = 'rgba(70,70,74,0.18)'; x.beginPath(); x.arc(cx + cr * 0.12, cy + cr * 0.12, cr, 0, TAU); x.fill();
      x.fillStyle = 'rgba(250,248,240,0.16)'; x.beginPath(); x.arc(cx - cr * 0.1, cy - cr * 0.1, cr * 0.85, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(255,255,250,0.12)'; x.lineWidth = Math.max(1, cr * 0.12); x.beginPath(); x.arc(cx, cy, cr, 0, TAU); x.stroke();
    }
    // a bright rayed crater low down
    x.strokeStyle = 'rgba(255,255,250,0.07)'; x.lineWidth = 3;
    for (let i = 0; i < 26; i++) { const a = Rr() * TAU, L = 120 + Rr() * 260; x.beginPath(); x.moveTo(r * 0.9, r * 1.55); x.lineTo(r * 0.9 + Math.cos(a) * L, r * 1.55 + Math.sin(a) * L); x.stroke(); }
    x.fillStyle = 'rgba(255,255,250,0.5)'; x.beginPath(); x.arc(r * 0.9, r * 1.55, 9, 0, TAU); x.fill();
    for (let i = 0; i < 9000; i++) { x.fillStyle = Rr() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; x.fillRect(Rr() * N, Rr() * N, 2, 2); }
    x.restore();
    MOON = c; return c;
  }

  /* ------------------------------ how it breaks: Voronoi pieces of the unit disc ------------------------------ */
  let PIECES;
  function pieces() {
    if (PIECES) return PIECES;
    const Rr = U.mulberry32(9), seeds = [];
    for (let i = 0; i < 15; i++) { const a = Rr() * TAU, d = Math.sqrt(Rr()) * 0.92; seeds.push([Math.cos(a) * d, Math.sin(a) * d]); }
    const circle = []; for (let i = 0; i < 72; i++) circle.push([Math.cos(i / 72 * TAU), Math.sin(i / 72 * TAU)]);
    const clip = (poly, nx, ny, c0) => {   // keep the side where nx*x + ny*y <= c0
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length], da = nx * A[0] + ny * A[1] - c0, db = nx * B[0] + ny * B[1] - c0;
        if (da <= 0) out.push(A);
        if ((da < 0) !== (db < 0)) { const k = da / (da - db); out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k]); }
      }
      return out;
    };
    PIECES = seeds.map((s, i) => {
      let poly = circle.slice();
      seeds.forEach((o, j) => { if (j === i) return; const nx = o[0] - s[0], ny = o[1] - s[1], c0 = (o[0] * o[0] + o[1] * o[1] - s[0] * s[0] - s[1] * s[1]) / 2; poly = clip(poly, nx, ny, c0); });
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length, d = Math.hypot(cx, cy) || 1;
      return { poly, cx, cy, dx: cx / d, dy: cy / d, far: 0.25 + Rr() * 0.6, rot: (Rr() - 0.5) * 1.0, grow: Rr() * 0.4 };
    });
    return PIECES;
  }

  /* ------------------------------ stars, fixed in the sky ------------------------------ */
  const STARS = []; { const r = U.mulberry32(5); for (let i = 0; i < 700; i++) { const a = r() * TAU, e = Math.asin(0.05 + r() * 0.95); STARS.push([Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a), 0.2 + r() * 0.8, 1 + r() * 1.6]); } }

  /* ------------------------------ the sky and the Moon (behind the city) ------------------------------ */
  function sky(c, t) {
    const C = TL.cam(t), day = TL.day(t), dusk = TL.dusk(t), night = TL.night(t), split = TL.split(t), crack = TL.crack(t);
    // the horizon's height on screen depends on where you're looking
    const yh = HT / 2 + Math.tan(C.pitch) * F * HT / 2;
    let top = mix3([62, 118, 196], [44, 56, 104], dusk), low = mix3([196, 220, 238], [236, 152, 112], dusk);
    top = mix3(top, [5, 7, 16], night); low = mix3(low, [24, 30, 52], night);
    top = mix3(top, [40, 16, 10], 0.35 * split); low = mix3(low, [90, 40, 24], 0.45 * split);
    const gr = c.createLinearGradient(0, yh - HT * 1.4, 0, yh); gr.addColorStop(0, rgb(top)); gr.addColorStop(0.7, rgb(mix3(top, low, 0.55))); gr.addColorStop(1, rgb(low));
    c.fillStyle = gr; c.fillRect(0, 0, W, HT);
    if (yh < HT) { c.fillStyle = rgb(low); c.fillRect(0, yh, W, HT - yh); }
    // stars
    if (night > 0.02) for (const [x, y, z, b, s] of STARS) { const p = World.projectDir(x, y, z); if (!p || p.x < 0 || p.x > W || p.y < 0 || p.y > HT) continue; c.fillStyle = `rgba(255,255,255,${b * night * (0.6 + 0.4 * Math.sin(t * 2 + x * 40))})`; c.fillRect(p.x, p.y, s, s); }
    // the Moon
    const md = TL.moonDir(t), p = World.projectDir(md[0], md[1], md[2]);
    if (!p) return null;
    const Rpx = Math.tan(TL.moonR(t) * Math.PI / 180) * F * HT / 2;
    if (p.x < -Rpx * 3 || p.x > W + Rpx * 3 || p.y < -Rpx * 3 || p.y > HT + Rpx * 3) return null;
    const tex = moonTexture(), vis = 0.55 + 0.45 * Math.max(night, dusk);
    glow(c, p.x, p.y, Rpx * 2.6, '200,214,240', 0.22 * night + 0.06);
    const P = pieces();
    // the hot inside, showing through the cracks and the gaps
    if (crack > 0) { glow(c, p.x, p.y, Rpx * (1.1 + 0.5 * split), '255,96,40', 0.3 * crack + 0.22 * split); glow(c, p.x, p.y, Rpx * 0.6, '255,180,100', 0.25 * split); }
    c.save(); c.translate(p.x, p.y); c.rotate(-C.roll);
    for (const pc of P) {
      const off = split * pc.far * 0.45, sc = 1 + split * pc.grow * 0.5;
      c.save(); c.translate(pc.dx * off * Rpx, pc.dy * off * Rpx); c.rotate(pc.rot * split); c.scale(Rpx * sc, Rpx * sc);
      c.beginPath(); pc.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      c.save(); c.clip(); c.globalAlpha = vis; c.drawImage(tex, -1, -1, 2, 2);
      if (split > 0) { c.globalAlpha = 1; c.fillStyle = `rgba(0,0,0,${(0.08 + 0.22 * Math.abs(pc.rot)) * split})`; c.fill(); c.lineWidth = 0.05; c.strokeStyle = `rgba(30,20,16,${0.6 * split})`; c.stroke(); }
      c.restore();
      // the fissures glow along the edges of every piece (not along the outline of the whole Moon)
      if (crack > 0) {
        c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
        for (const [lw, col] of [[14, `rgba(255,110,40,${0.25 * crack})`], [5, `rgba(255,180,90,${0.7 * crack})`], [1.6, `rgba(255,240,200,${0.9 * crack})`]]) {
          c.lineWidth = lw / Rpx * (0.6 + 0.6 * crack) * Math.min(3, Math.max(1, Rpx / 300)); c.strokeStyle = col; c.beginPath();
          for (let i = 0; i < pc.poly.length; i++) {
            const A = pc.poly[i], B = pc.poly[(i + 1) % pc.poly.length];
            if (Math.hypot(A[0], A[1]) > 0.985 && Math.hypot(B[0], B[1]) > 0.985) continue;
            c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]);
          }
          c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
    }
    // a cloud of smaller rocks spreading out from it
    if (split > 0) {
      const r = U.mulberry32(31);
      for (let i = 0; i < 260; i++) {
        const a = r() * TAU, d = 0.9 + r() * 0.4 + split * (0.2 + r() * 0.9), s2 = (1 + r() * 4) * Math.max(1, Rpx / 400);
        const x = Math.cos(a + split * (r() - 0.5)) * d * Rpx, y = Math.sin(a + split * (r() - 0.5)) * d * Rpx;
        c.fillStyle = r() > 0.75 ? `rgba(255,150,80,${0.8 * split})` : `rgba(170,165,158,${0.9 * Math.min(1, split * 3)})`;
        c.beginPath(); c.arc(x, y, s2, 0, TAU); c.fill();
      }
    }
    c.restore();
    return { x: p.x, y: p.y, R: Rpx };
  }

  /* ------------------------------ burning pieces falling into the city (behind the buildings) ------------------------------ */
  function meteorPath(m, k) {
    const md = TL.moonDir(m.t0), D = 1500;
    const S = [m.x + md[0] * D * 0.3, (md[1] * 0.3 + 0.7) * D, m.z + md[2] * D * 0.3];
    const u = Math.pow(k, 1.35);
    return [S[0] + (m.x - S[0]) * u, S[1] * (1 - u), S[2] + (m.z - S[2]) * u];
  }
  function meteors(c, t) {
    for (const m of TL.meteors) {
      if (t < m.t0 || t > m.t1) continue;
      const k = (t - m.t0) / (m.t1 - m.t0), H = meteorPath(m, k), T = meteorPath(m, Math.max(0, k - 0.32));
      const a = World.project(...H), b = World.project(...T);
      if (!a.vis || !b.vis) continue;
      const w = (9 + 16 * m.s) * Math.min(2.2, 500 / Math.max(80, a.d) + 0.7);
      const gr = c.createLinearGradient(b.x, b.y, a.x, a.y); gr.addColorStop(0, 'rgba(255,120,40,0)'); gr.addColorStop(0.7, 'rgba(255,150,60,0.55)'); gr.addColorStop(1, 'rgba(255,240,210,0.95)');
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = gr; c.lineCap = 'round'; c.lineWidth = w; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(a.x, a.y); c.stroke(); c.restore();
      glow(c, a.x, a.y, w * 6, '255,190,120', 0.8);
    }
  }
  // what the impacts do on the ground: a flash, a fireball, a column of dust
  function impacts(c, t) {
    for (const m of TL.meteors) {
      const k = t - m.t1; if (k < 0 || k > 9) continue;
      const P = World.project(m.x, 0, m.z); if (!P.vis) continue;
      const sz = Math.min(1100, 70000 * m.s / Math.max(60, P.d));
      if (k < 1.2) glow(c, P.x, P.y, sz * (1 + k), '255,236,200', 0.9 * Math.exp(-k * 3.2));
      glow(c, P.x, P.y - sz * 0.2 * k, sz * (0.5 + 0.4 * k), '255,120,50', 0.6 * Math.exp(-k * 0.9));
      const D = World.project(m.x, 30 * Math.min(k, 4), m.z);
      if (D.vis) glow(c, D.x, D.y, sz * (0.4 + 0.25 * k), '120,96,84', 0.35 * Math.min(1, k) * Math.exp(-k * 0.25));
    }
  }
  // dust where the buildings tear free
  function foundations(c, t) {
    const bk = TL.buildings(t); if (bk <= 0) return;
    for (const B of World.bases()) {
      const k = U.clamp((bk - B.delay) / (1 - B.delay)); if (k <= 0 || k > 0.9) continue;
      const P = World.project(B.x, 2, B.z); if (!P.vis) continue;
      glow(c, P.x, P.y, Math.min(900, 30000 / Math.max(20, P.d)), '150,130,115', 0.5 * Math.sin(Math.PI * k / 0.9));
    }
  }

  /* ------------------------------ the reference's text ------------------------------ */
  function wrap(c, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (c.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
    if (cur) lines.push(cur); return lines;
  }
  function captions(c, t) {
    for (const b of TL.blocks) {
      if (t < b.t0 || t > b.t1) continue;
      const a = Math.min(U.clamp((t - b.t0) / 0.18), U.clamp((b.t1 - t) / 0.25));
      const inner = b.kind === 'inner';
      c.save(); c.globalAlpha = a;
      c.font = inner ? `500 38px ${SERIF}` : `italic 400 40px ${SERIF}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const lines = wrap(c, b.text, 720), lh = 54, y0 = 1404 - (lines.length - 1) * lh / 2;
      c.shadowColor = 'rgba(0,0,0,0.75)'; c.shadowBlur = 8; c.shadowOffsetY = 1.5;
      c.fillStyle = inner ? '#e8c86a' : '#ececea';
      lines.forEach((ln, i) => c.fillText(ln, 540, y0 + i * lh));
      c.restore();
    }
  }
  function countdown(c, t) {
    const C = TL.countdown; if (t > C.t1 + 0.4) return;
    const a = 1 - U.clamp((t - C.t1) / 0.4), n = Math.max(1, 5 - Math.floor(t));
    c.save(); c.globalAlpha = a; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 6;
    c.fillStyle = '#f4f4f2'; c.font = `700 21px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '4px'; c.fillText(C.label, 74, 870);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    const pop = U.clamp((t % 1) / 0.15);
    c.globalAlpha = a * (0.4 + 0.6 * pop); c.fillStyle = '#d8b46b'; c.font = `500 132px ${SERIF}`; c.fillText(String(n), 66, 1092);
    c.globalAlpha = a * 0.75; c.fillStyle = '#e2e2df'; c.font = `600 14px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '3.5px'; c.fillText(C.sub, 74, 1152);
    c.restore();
  }

  /* ------------------------------ the frame ------------------------------ */
  let BLUR;
  function render(c, t) {
    t = U.clamp(t, 0, TL.DURATION - 1e-6);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, HT);
    World.prepare(t);
    sky(c, t);
    meteors(c, t);
    c.drawImage(World.draw(), 0, 0);
    // street lamps
    const lampsOn = TL.lamps(t);
    if (lampsOn > 0.02) for (const L of World.lamps()) { const P = World.project(L.x, L.y, L.z); if (P.vis && P.d < 260) glow(c, P.x, P.y, Math.min(700, 2600 / P.d), '255,206,140', 0.6 * lampsOn); }
    impacts(c, t); foundations(c, t);
    // whip pans blur
    const A = TL.cam(t), B2 = TL.cam(t + 1 / 30);
    const wy = (B2.yaw - A.yaw) * 30, wp = (B2.pitch - A.pitch) * 30, om = Math.hypot(wy, wp);
    if (om > 1.1) {
      if (!BLUR) { BLUR = document.createElement('canvas'); BLUR.width = W; BLUR.height = HT; }
      const bx = BLUR.getContext('2d'); bx.clearRect(0, 0, W, HT); bx.drawImage(c.canvas, 0, 0);
      const L = Math.min(90, (om - 1.1) * 38), dx = wy / om * L, dy = -wp / om * L;
      c.save(); for (const [k, a] of [[0.33, 0.35], [0.66, 0.25], [1, 0.18]]) { c.globalAlpha = a; c.drawImage(BLUR, dx * k, dy * k); c.drawImage(BLUR, -dx * k, -dy * k); } c.restore();
    }
    // a warm-cold grade, vignette, grain
    const night = TL.night(t);
    c.fillStyle = `rgba(20,30,60,${0.12 * night})`; c.fillRect(0, 0, W, HT);
    const vg = c.createRadialGradient(540, 960, 560, 540, 960, 1240); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.32 + 0.2 * night})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, HT);
    const f = Math.floor(t * TL.FPS);
    for (let i = 0; i < 700; i++) { c.fillStyle = U.hash(i + f * 1.7) > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'; c.fillRect(U.hash(f * 13 + i) * W, U.hash(f * 7 + i * 3) * HT, 2, 2); }
    // the end: it fills everything, a white flash, then nothing
    const end = U.clamp((t - 84.7) / 0.55);
    if (end > 0) { c.fillStyle = `rgba(255,246,232,${Math.sin(Math.PI * Math.min(1, end * 1.3)) * 0.95})`; c.fillRect(0, 0, W, HT); }
    countdown(c, t);
    captions(c, t);
    if (t > TL.DURATION - 0.1) { c.fillStyle = '#000'; c.fillRect(0, 0, W, HT); }
    c.restore();
  }
  g.Film = { render, init() {} };
})(window);
