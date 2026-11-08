/* =========================================================================
   ONE MINUTE — scenes.js
   Every shot of the reference, redrawn as flat vector art on a 1080x1920
   canvas. Film.render(ctx, t) is a pure function of t (seeded noise only),
   so live playback and the offline MP4 export produce identical frames.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, Chars: C } = g;
  const { H } = C;
  const { W, H: HT } = TL;
  const TAU = Math.PI * 2;
  let T, Tc, ready = false;

  function init() {
    if (ready) return;
    T = document.createElement('canvas'); T.width = W; T.height = HT; Tc = T.getContext('2d');
    ready = true;
  }

  /* ----------------------------- camera ----------------------------- */
  function shakeAt(t) {
    let a = 0;
    const hit = (s, amp, dec) => { const d = t - s; if (d >= 0 && d < 1.5) a = Math.max(a, amp * Math.exp(-d * dec)); };
    TL.hits.forEach((s) => hit(s, 7, 9));
    hit(TL.mugSmash, 22, 7); hit(TL.stab, 16, 6);
    TL.mainBangs.forEach((s) => hit(s, 14, 9));
    TL.knocks.forEach((s) => hit(s, 4, 12));
    TL.blows.forEach((s) => hit(s, 20, 8));
    hit(TL.doorCrack, 28, 6); hit(TL.burst, 40, 4);
    TL.glitches.forEach((s) => hit(s, 12, 8));
    return { x: U.snoise(t * 37) * a, y: U.snoise(t * 41 + 7) * a };
  }
  function cam(c, t, cx = 540, cy = 960, z = 1, rot = 0) {
    const s = shakeAt(t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(W / 2 + s.x, HT / 2 + s.y); c.rotate(rot); c.scale(z, z); c.translate(-cx, -cy);
  }

  /* ----------------------------- shared art ----------------------------- */
  const COL = {
    night0: '#0a0e18', night1: '#1a2132', wall: '#283143', seam: '#20283a',
    frame: '#56627a', glass: '#121826', litDeep: '#d98b2c',
    door: '#3a2a22', doorDark: '#2a1d17', doorFrame: '#d6d3cb', steel: '#c7ccd3', red: '#e8322a', yellow: '#f7b500',
  };

  function sky(c, x = -600, y = -600, w = W + 1200, h = HT + 1200) {
    c.fillStyle = H.lg(c, 0, y, 0, y + h, [[0, COL.night0], [1, COL.night1]]); c.fillRect(x, y, w, h);
    for (let i = 0; i < 90; i++) H.circ(c, x + U.hash(i * 3.3) * w, y + U.hash(i * 7.1) * h, 1 + U.hash(i) * 1.6, `rgba(255,255,255,${0.25 + U.hash(i * 2) * 0.4})`);
  }
  function snow(c, t, n = 110, wind = 0.15, speed = 90, alpha = 0.8) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < n; i++) {
      const sp = speed * (0.6 + U.hash(i * 1.7) * 0.8);
      const y = (U.hash(i * 2.9) * (HT + 100) + t * sp) % (HT + 100) - 50;
      const x = ((U.hash(i * 5.3) * (W + 200) + t * sp * wind + Math.sin(t + i) * 12) % (W + 200) + W + 200) % (W + 200) - 100;
      H.circ(c, x, y, 1.5 + U.hash(i * 4.4) * 2.8, `rgba(235,240,255,${alpha * (0.4 + U.hash(i) * 0.6)})`);
    }
    c.restore();
  }
  function streaks(c, t, n = 70) { // wind-driven snow
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const sp = 1400 * (0.6 + U.hash(i) * 0.6);
      const x = (U.hash(i * 3.1) * (W + 400) + t * sp) % (W + 400) - 200, y = (U.hash(i * 6.7) * HT + t * sp * 0.25) % HT;
      H.line(c, x, y, x - 60, y - 14, `rgba(230,238,255,${0.25 + U.hash(i * 2) * 0.4})`, 2.5);
    }
    c.restore();
  }
  // apartment window. lit: 0..1
  function aptWindow(c, x, y, w, h, lit = 0, o = {}) {
    H.rr(c, x - 6, y - 6, w + 12, h + 12, 3, o.frame || COL.frame);
    if (lit > 0) {
      c.fillStyle = H.lg(c, 0, y, 0, y + h, [[0, '#f7c977'], [1, COL.litDeep]]); c.fillRect(x, y, w, h);
      if (o.people) {
        H.circ(c, x + w * 0.33, y + h * 0.52, w * 0.09, '#3b2418'); H.rr(c, x + w * 0.2, y + h * 0.62, w * 0.26, h * 0.38, 8, '#3b5c9e');
        H.circ(c, x + w * 0.67, y + h * 0.6, w * 0.08, '#e7a93f'); H.rr(c, x + w * 0.56, y + h * 0.7, w * 0.22, h * 0.3, 8, '#ef9cc4');
      }
      if (o.couple) {
        H.circ(c, x + w * 0.35, y + h * 0.45, w * 0.09, '#cfc9b8'); H.rr(c, x + w * 0.22, y + h * 0.55, w * 0.26, h * 0.45, 8, '#d8c9a6');
        H.circ(c, x + w * 0.66, y + h * 0.47, w * 0.08, '#e8c37a'); H.rr(c, x + w * 0.55, y + h * 0.56, w * 0.22, h * 0.44, 8, '#e991b7');
      }
      c.globalAlpha = 1 - lit; c.fillStyle = COL.glass; c.fillRect(x, y, w, h); c.globalAlpha = 1;
    } else { c.fillStyle = COL.glass; c.fillRect(x, y, w, h); }
    c.fillStyle = o.frame || COL.frame;
    c.fillRect(x + w / 2 - 3, y, 6, h); c.fillRect(x, y + h * 0.38 - 3, w, 6);
    if (!lit) { c.fillStyle = 'rgba(120,140,180,0.08)'; c.beginPath(); c.moveTo(x, y + h * 0.6); c.lineTo(x + w * 0.5, y); c.lineTo(x + w * 0.62, y); c.lineTo(x, y + h * 0.75); c.fill(); }
  }
  // grid facade. lit(col,row) -> 0..1
  function facade(c, x0, y0, cols, rows, cw, ch, lit, o = {}) {
    c.fillStyle = o.wall || COL.wall; c.fillRect(x0, y0, cols * cw, rows * ch);
    c.strokeStyle = COL.seam; c.lineWidth = 3;
    for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(x0, y0 + r * ch); c.lineTo(x0 + cols * cw, y0 + r * ch); c.stroke(); }
    for (let k = 0; k <= cols; k++) { c.beginPath(); c.moveTo(x0 + k * cw, y0); c.lineTo(x0 + k * cw, y0 + rows * ch); c.stroke(); }
    const ww = cw * 0.56, wh = ch * 0.6;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const L = lit ? lit(k, r) : 0;
      aptWindow(c, x0 + k * cw + (cw - ww) / 2, y0 + r * ch + (ch - wh) / 2, ww, wh, L, (o.extra && o.extra(k, r)) || {});
      if (L > 0.3) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const cx = x0 + k * cw + cw / 2, cy = y0 + r * ch + ch / 2;
        c.fillStyle = H.rg(c, cx, cy, 4, cw * 0.9, [[0, `rgba(255,170,70,${0.18 * L})`], [1, 'rgba(255,150,50,0)']]);
        c.fillRect(cx - cw, cy - cw, cw * 2, cw * 2); c.restore();
      }
    }
  }
  function brackets(c, x, y, w, h, col = COL.red, lw = 6) {
    const k = Math.min(w, h) * 0.28;
    c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'square';
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const px = x + sx * w, py = y + sy * h, dx = sx ? -k : k, dy = sy ? -k : k;
      c.beginPath(); c.moveTo(px + dx, py); c.lineTo(px, py); c.lineTo(px, py + dy); c.stroke();
    }
  }
  function circleMark(c, x, y, r, p, label, lx = 1) {
    if (p <= 0) return;
    c.save(); c.strokeStyle = COL.red; c.lineWidth = 8; c.lineCap = 'round';
    c.shadowColor = 'rgba(232,50,42,0.7)'; c.shadowBlur = 14;
    c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * U.easeOut(p)); c.stroke();
    c.restore();
    if (label && p > 0.6) H.text(c, label, x + lx * (r + 20), y - r * 0.2, '800 34px Montserrat, Arial', COL.red, lx > 0 ? 'left' : 'right');
  }
  function tag(c, text, x, y, rot = -0.06, s = 1) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.font = '900 40px Montserrat, Arial'; const w = c.measureText(text).width + 40;
    H.rr(c, -w / 2, -32, w, 64, 6, '#d8261f');
    H.text(c, text, 0, 2, '900 40px Montserrat, Arial', '#fff');
    c.restore();
  }

  /* ----------------------------- the front door ----------------------------- */
  function frontDoor(c, x, y, w, h, o = {}) {
    H.rr(c, x - 28, y - 28, w + 56, h + 28, 4, COL.doorFrame);
    H.rr(c, x - 10, y - 10, w + 20, h + 10, 2, '#a9a69e');
    const sx = o.shakeX || 0;
    c.save(); c.translate(sx, 0);
    c.fillStyle = H.lg(c, x, 0, x + w, 0, [[0, COL.doorDark], [0.5, COL.door], [1, COL.doorDark]]); c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3;
    for (let i = 1; i < 9; i++) { c.beginPath(); c.moveTo(x + (w * i) / 9, y); c.lineTo(x + (w * i) / 9, y + h); c.stroke(); }
    H.circ(c, x + w * 0.5, y + h * 0.3, 10, '#d9d6cf'); H.circ(c, x + w * 0.5, y + h * 0.3, 5, '#333');
    // chain lock
    const cy = y + h * 0.36, swing = o.chainSwing || 0;
    H.rr(c, x + w * 0.66, cy - 12, w * 0.24, 24, 6, COL.steel);
    H.rr(c, x + w - 4, cy - 26, 40, 52, 6, COL.steel);
    c.strokeStyle = '#d7dbe1'; c.lineWidth = 5;
    for (let i = 0; i < 7; i++) {
      const u = i / 6, px = U.lerp(x + w * 0.7, x + w + 14, u);
      const py = cy + Math.sin(u * Math.PI) * (16 + Math.abs(swing) * 10) + swing * Math.sin(u * Math.PI) * 14;
      c.beginPath(); c.ellipse(px, py, 9, 6, u * 2 + swing, 0, TAU); c.stroke();
    }
    // lock + lever handle
    H.rr(c, x + w * 0.76, y + h * 0.43, 46, 70, 8, COL.steel); H.circ(c, x + w * 0.76 + 23, y + h * 0.43 + 35, 12, '#8a9098');
    H.rr(c, x + w * 0.78, y + h * 0.53, 30, 110, 8, COL.steel);
    c.save(); c.translate(x + w * 0.78 + 15, y + h * 0.56); c.rotate(o.handle || 0);
    H.rr(c, -110, -10, 125, 22, 10, '#e2e5ea'); c.restore();
    // letterbox
    H.rr(c, x + w * 0.2, y + h * 0.66, w * 0.42, 36, 6, COL.steel); H.rr(c, x + w * 0.22, y + h * 0.66 + 12, w * 0.38, 12, 4, '#5d636c');
    // cracks
    if (o.crack > 0) {
      c.strokeStyle = '#120a07'; c.lineWidth = 5; c.lineCap = 'round';
      const cx0 = x + w * 0.62, cy0 = y + h * 0.38;
      for (let k = 0; k < 7; k++) {
        const a = -2.6 + k * 0.62, len = (90 + U.hash(k * 3) * 130) * U.clamp(o.crack);
        c.beginPath(); c.moveTo(cx0, cy0);
        for (let j = 1; j <= 4; j++) {
          c.lineTo(cx0 + Math.cos(a + (U.hash(k * 7 + j) - 0.5) * 0.5) * len * j / 4, cy0 + Math.sin(a + (U.hash(k * 5 + j) - 0.5) * 0.5) * len * j / 4);
        }
        c.stroke();
      }
    }
    c.restore();
    if (o.wallBits !== false) {
      H.rr(c, x + w + 70, y + h * 0.28, 70, 140, 10, '#e9e7e2'); H.rr(c, x + w + 82, y + h * 0.28 + 16, 46, 54, 6, '#cfcdc8');
      H.rr(c, x + w + 76, y + h * 0.5, 60, 60, 8, '#e9e7e2');
      H.rr(c, x - 150, y + h * 0.2, 90, 300, 40, '#3e5a46');
      H.rr(c, x - 140, y + h * 0.2 + 40, 70, 250, 30, '#334b3a');
    }
  }
  // hallway: door + light from the gap + shadows of feet
  function doorHall(c, t, o = {}) {
    c.fillStyle = H.lg(c, 0, 0, W, 0, [[0, '#1d1714'], [0.5, '#2a211c'], [1, '#1d1714']]); c.fillRect(-300, -300, W + 600, HT + 600);
    for (let x = -300; x < W + 300; x += 70) H.rr(c, x, -300, 4, 1650, 0, 'rgba(0,0,0,0.25)');
    const x = 330, y = 300, w = 420, h = 1050;
    frontDoor(c, x, y, w, h, o);
    c.fillStyle = H.lg(c, 0, y + h, 0, HT + 200, [[0, '#14100d'], [1, '#2a211b']]); c.fillRect(-300, y + h, W + 600, HT);
    const L = o.light ?? 1;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = H.lg(c, 0, y + h, 0, HT + 100, [[0, `rgba(255,236,200,${0.55 * L})`], [1, `rgba(255,236,200,${0.06 * L})`]]);
    c.beginPath(); c.moveTo(x + 6, y + h); c.lineTo(x + w - 6, y + h); c.lineTo(W + 260, HT + 120); c.lineTo(-260, HT + 120); c.closePath(); c.fill();
    H.rr(c, x, y + h - 6, w, 8, 0, `rgba(255,240,210,${0.9 * L})`);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,0.92)';
    for (const fx of [x + w * 0.38, x + w * 0.62]) {
      c.beginPath(); c.moveTo(fx - 18, y + h); c.lineTo(fx + 18, y + h);
      c.lineTo(fx + 18 + (fx - 540) * 1.6 + 35, HT + 120); c.lineTo(fx - 18 + (fx - 540) * 1.6 - 35, HT + 120); c.closePath(); c.fill();
    }
  }

  /* ----------------------------- the flat ----------------------------- */
  function roomWall(c, x, y, w, h) {
    c.fillStyle = H.lg(c, 0, y, 0, y + h, [[0, '#7c5640'], [1, '#5e3f2e']]); c.fillRect(x, y, w, h);
    for (let i = x; i < x + w; i += 46) H.rr(c, i, y, 18, h, 0, 'rgba(255,220,180,0.05)');
  }
  function clock(c, x, y, r, minute = 0) {
    H.circ(c, x, y, r + 8, '#d9d4c8'); H.circ(c, x, y, r, '#fbfaf6');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; H.line(c, x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, '#333', 3); }
    const ha = -Math.PI / 2 + (3 / 12) * TAU + minute * (TAU / 720), ma = -Math.PI / 2 + minute * (TAU / 60);
    H.line(c, x, y, x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5, '#222', 6);
    H.line(c, x, y, x + Math.cos(ma) * r * 0.75, y + Math.sin(ma) * r * 0.75, '#222', 4);
    H.circ(c, x, y, 5, '#222');
  }
  function lamp(c, x, y, on = 1) {
    if (on > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, x, y, 10, 360, [[0, `rgba(255,214,140,${0.45 * on})`], [1, 'rgba(255,200,120,0)']]); c.fillRect(x - 360, y - 360, 720, 720); c.restore(); }
    H.poly(c, [[x - 44, y - 60], [x + 44, y - 60], [x + 66, y + 20], [x - 66, y + 20]], on > 0.5 ? '#f6e3b4' : '#8a7a5c');
    H.rr(c, x - 5, y + 20, 10, 140, 3, '#3a3a3a'); H.rr(c, x - 40, y + 156, 80, 14, 6, '#3a3a3a');
  }
  function steam(c, x, y, t, a = 0.5) {
    if (a <= 0) return;
    c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 4; c.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let i = 0; i <= 10; i++) { const yy = y - i * 9, xx = x + k * 18 + Math.sin(t * 3 + i * 0.7 + k) * 6; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke();
    }
  }

  /* ============================== SHOTS ============================== */
  const S = {};

  S.killerFace = (c, t, lt, d, v) => {
    const z = v === 'intro' ? U.lerp(1.04, 1.16, lt / d) : U.lerp(1.1, 1.3, U.easeInOut(lt / d));
    cam(c, t, 540, 900, z, Math.sin(t * 0.8) * 0.01);
    c.fillStyle = '#4c4d3c'; c.fillRect(-400, -400, W + 800, HT + 800);
    for (let x = -400; x < W + 400; x += 60) H.rr(c, x, -400, 22, HT + 800, 0, 'rgba(0,0,0,0.12)');
    c.save(); c.translate(540, 860 + Math.sin(t * 1.4) * 6); c.rotate(Math.sin(t * 0.9) * 0.02);
    C.killerFace(c, { t, grin: v === 'stare' ? U.lerp(0.8, 1.15, U.smooth(0, 1.2, lt)) : U.lerp(0.75, 1, U.smooth(0, 2, lt)) });
    c.restore();
    // knife held across the bottom of frame, with a glint
    c.save(); c.translate(250, 1520); c.rotate(-0.06); c.scale(1.55, 1.55); C.knife(c, 1); c.restore();
    H.rr(c, 120, 1490, 260, 80, 40, C.PAL.kSkin);
    const gl = 0.5 + 0.5 * Math.sin(t * 5);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = H.rg(c, 470, 1490, 2, 90, [[0, `rgba(255,255,255,${0.9 * gl})`], [1, 'rgba(255,255,255,0)']]); c.fillRect(380, 1400, 180, 180);
    c.restore();
  };

  S.doorFeet = (c, t, lt, d, v) => {
    let z = U.lerp(1.0, 1.06, lt / d);
    let shakeX = 0, crack = 0, chainSwing = 0;
    if (v === 'knock') TL.knocks.forEach((k) => { if (t > k && t < k + 0.12) shakeX = 3; });
    if (v === 'blows' || v === 'rule2' || v === 'behind') {
      TL.blows.forEach((k) => { const e = t - k; if (e > 0 && e < 0.3) { shakeX = 12 * Math.exp(-e * 12); chainSwing = Math.exp(-e * 6) * Math.sin(e * 40); } });
      crack = U.lin(TL.doorCrack, TL.doorCrack + 0.25, t);
      if (v === 'behind') { crack = 1; shakeX = U.snoise(t * 30) * 10; z = U.lerp(1.0, 1.2, U.easeIn(lt / d)); }
    }
    cam(c, t, 540, 960, z);
    doorHall(c, t, { shakeX, crack, chainSwing, light: v === 'behind' ? 1.3 : 1 });
    if (v === 'rule2' && t >= 51.0) tag(c, 'RULE #2', 540, 420 - (t < 51.2 ? (51.2 - t) * 300 : 0), -0.05);
  };

  S.timer = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1, 1.08, lt / d));
    c.fillStyle = H.rg(c, 540, 900, 50, 1200, [[0, '#3a0606'], [1, '#080202']]); c.fillRect(-300, -300, W + 600, HT + 600);
    const p = U.lin(0.1, d, lt);
    c.save(); c.shadowColor = 'rgba(255,40,40,0.9)'; c.shadowBlur = 30; c.lineCap = 'round';
    c.strokeStyle = 'rgba(232,50,42,0.25)'; c.lineWidth = 26; c.beginPath(); c.arc(540, 820, 280, 0, TAU); c.stroke();
    c.strokeStyle = COL.red; c.beginPath(); c.arc(540, 820, 280, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p * 0.05)); c.stroke();
    H.text(c, '1:00', 540, 800, '700 190px Orbitron, "Share Tech Mono", monospace', '#ff3b30');
    c.restore();
    H.text(c, 'MINUTE', 540, 960, '800 40px Montserrat, Arial', '#f4f4f4');
  };

  // the block at 3 AM, zooming into our lit window
  const BLOCK = { x: 150, y: 260, cols: 6, rows: 11, cw: 130, ch: 150 };
  const OUR = { k: 3, r: 6 };
  S.blockZoom = (c, t, lt, d) => {
    const tx = BLOCK.x + (OUR.k + 0.5) * BLOCK.cw, ty = BLOCK.y + (OUR.r + 0.5) * BLOCK.ch;
    const e = U.easeInOut(U.clamp(lt / d));
    cam(c, t, U.lerp(540, tx, e), U.lerp(960, ty, e), U.lerp(1, 4.2, e));
    sky(c);
    facade(c, BLOCK.x, BLOCK.y, BLOCK.cols, BLOCK.rows + 4, BLOCK.cw, BLOCK.ch,
      (k, r) => (k === OUR.k && r === OUR.r ? 1 : (U.hash(k * 13 + r * 7) > 0.86 ? 0.9 : 0)),
      { extra: (k, r) => (k === OUR.k && r === OUR.r ? { people: true } : null) });
    H.rr(c, BLOCK.x - 10, BLOCK.y - 20, BLOCK.cols * BLOCK.cw + 20, 24, 2, '#1c2230');
    snow(c, t, 90);
  };

  // outside looking in: Mum and you by the window
  S.windowSit = (c, t, lt, d, v) => {
    const z = v === 'calm' ? U.lerp(1.0, 1.08, lt / d) : v === 'target' ? 1.06 : 1.04;
    cam(c, t, 540, 940, z);
    c.fillStyle = COL.wall; c.fillRect(-300, -300, W + 600, HT + 600);
    const wx = 110, wy = 360, ww = 860, wh = 860;
    roomWall(c, wx, wy, ww, wh);
    H.rr(c, wx + 30, wy + 90, 240, 16, 3, '#4a3020');
    for (let i = 0; i < 7; i++) H.rr(c, wx + 40 + i * 30, wy + 30 + (i % 3) * 6, 24, 60 - (i % 3) * 6, 3, ['#5a7a9a', '#9a5a4a', '#c9b06a', '#6a8a5a'][i % 4]);
    clock(c, wx + ww - 150, wy + 150, 72, 0);
    lamp(c, wx + 60, wy + 420, 1);
    const slip = v === 'slip';
    const gasp = slip || v === 'target';
    c.save(); c.translate(wx + 270, wy + 560); c.scale(1.12, 1.12);
    C.mum(c, { arms: 'mug', mouth: gasp ? 'o' : 'smile', brow: gasp ? 1 : 0, lx: gasp ? 0.6 : 0, blink: !gasp && Math.abs(lt - 1.6) < 0.08 });
    c.restore();
    steam(c, wx + 260, wy + 730, t, slip ? 0 : 0.5);
    c.save(); c.translate(wx + 630, wy + 600); c.scale(1.08, 1.08);
    C.girl(c, { arms: 'mug', mug: !slip, mouth: gasp ? 'o' : 'smile', brow: gasp ? 1 : 0, lx: gasp ? 0.6 : 0 });
    c.restore();
    if (slip) { // the mug tumbling out of your hands
      const mugY = U.easeIn(U.lin(TL.mugDrop, TL.mugSmash, t)) * 600;
      c.save(); c.translate(wx + 630, wy + 760 + mugY); c.rotate(mugY * 0.008);
      H.rr(c, -34, -38, 68, 76, 9, '#f6f4ef'); H.text(c, 'MUM', 0, 0, '900 20px Montserrat, Arial', C.PAL.tie); c.restore();
    } else steam(c, wx + 620, wy + 690, t + 1, 0.45);
    // window frame + snowy sill
    c.strokeStyle = '#aab6c4'; c.lineWidth = 34; c.strokeRect(wx, wy, ww, wh);
    H.rr(c, wx + ww / 2 - 14, wy, 28, wh, 0, '#aab6c4');
    c.fillStyle = 'rgba(200,220,255,0.06)'; c.beginPath(); c.moveTo(wx, wy + 300); c.lineTo(wx + 300, wy); c.lineTo(wx + 380, wy); c.lineTo(wx, wy + 400); c.fill();
    H.rr(c, wx - 50, wy + wh - 10, ww + 100, 44, 4, '#c7ced8');
    c.fillStyle = '#f4f7fb';
    c.beginPath(); c.moveTo(wx - 50, wy + wh - 6);
    for (let x = wx - 50; x <= wx + ww + 50; x += 30) c.quadraticCurveTo(x + 15, wy + wh - 24 - U.hash(x) * 10, x + 30, wy + wh - 6);
    c.lineTo(wx + ww + 50, wy + wh + 8); c.lineTo(wx - 50, wy + wh + 8); c.fill();
    if (v === 'target') {
      const p = U.easeOut(U.lin(0, 0.3, lt));
      brackets(c, wx + 120 - (1 - p) * 120, wy + 300 - (1 - p) * 120, 320 + (1 - p) * 240, 420 + (1 - p) * 240);
    }
    snow(c, t, 70);
  };

  S.doorLock = (c, t, lt, d) => {
    const e = U.easeInOut(lt / d);
    cam(c, t, U.lerp(690, 720, e), U.lerp(650, 980, e), 2.4);
    c.fillStyle = '#211a16'; c.fillRect(-300, -300, W + 600, HT + 600);
    frontDoor(c, 330, 300, 420, 1050, { chainSwing: Math.sin(t * 2) * 0.05 });
    if (t >= 11.33) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 690, 680, 10, 160, [[0, 'rgba(255,220,120,0.18)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(530, 520, 320, 320); c.restore(); }
  };

  // across the estate
  const ACROSS = { x: 60, y: 200, cols: 7, rows: 9, cw: 140, ch: 170, k: 4, r: 3 };
  function estate(c) {
    sky(c);
    facade(c, ACROSS.x, ACROSS.y, ACROSS.cols, ACROSS.rows + 3, ACROSS.cw, ACROSS.ch,
      (k, r) => (k === ACROSS.k && r === ACROSS.r ? 1 : U.hash(k * 5 + r * 11) > 0.72 ? 0.85 : 0),
      { extra: (k, r) => (k === ACROSS.k && r === ACROSS.r ? { couple: true } : null) });
  }
  S.lookOut = (c, t, lt, d) => {
    const e = U.easeInOut(lt / d);
    cam(c, t, U.lerp(540, 610, e), U.lerp(960, 820, e), U.lerp(1, 1.25, e));
    estate(c);
    c.fillStyle = '#20160f';
    c.beginPath(); c.rect(-400, -400, W + 800, HT + 800); c.rect(170, 260, 740, 920); c.fill('evenodd');
    c.strokeStyle = '#3b2b20'; c.lineWidth = 30; c.strokeRect(170, 260, 740, 920);
    H.rr(c, 525, 260, 30, 920, 0, '#3b2b20');
    for (const s of [-1, 1]) {
      c.fillStyle = '#7a3524'; c.beginPath(); const x0 = s < 0 ? 60 : 1020;
      c.moveTo(x0, 200); c.lineTo(x0 - s * 170, 200); for (let y = 200; y <= 1260; y += 60) c.lineTo(x0 - s * 150 + Math.sin(y * 0.02) * 12, y); c.lineTo(x0, 1260); c.fill();
    }
    H.rr(c, 120, 1170, 840, 40, 4, '#5a4636');
    c.save(); c.translate(370, 1360); c.scale(1.45, 1.45); C.mum(c, { back: true, arms: 'down' }); c.restore();
    c.save(); c.translate(760, 1440); c.scale(1.3, 1.3); C.girl(c, { back: true }); c.restore();
    snow(c, t, 50, 0.1, 60, 0.4);
  };
  S.acrossZoom = (c, t, lt, d) => {
    const tx = ACROSS.x + (ACROSS.k + 0.5) * ACROSS.cw, ty = ACROSS.y + (ACROSS.r + 0.5) * ACROSS.ch;
    const e = U.easeInOut(lt / d);
    cam(c, t, U.lerp(540, tx, e), U.lerp(900, ty, e), U.lerp(1.3, 3.4, e));
    estate(c);
    snow(c, t, 80);
  };

  S.murder = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.08, lt / d));
    c.fillStyle = COL.wall; c.fillRect(-300, -300, W + 600, HT + 600);
    const wx = 90, wy = 260, ww = 900, wh = 1340;
    c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
    c.fillStyle = H.lg(c, 0, wy, 0, wy + wh, [[0, '#b5b391'], [1, '#8d8a6c']]); c.fillRect(wx, wy, ww, wh);
    H.rr(c, wx + ww - 220, wy + 260, 180, 1100, 0, '#6d5a44');
    H.line(c, 540, wy, 540, wy + 300, '#222', 4);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 540, wy + 330, 5, 500, [[0, 'rgba(255,240,200,0.5)'], [1, 'rgba(255,230,180,0)']]); c.fillRect(wx, wy, ww, wh); c.restore();
    H.circ(c, 540, wy + 320, 26, '#fff6d8');
    const fall = U.easeIn(U.lin(TL.stab + 0.25, TL.stab + 0.9, t));
    if (fall < 1) {
      c.save(); c.translate(700 + fall * 80, 900 + fall * 700); c.rotate(fall * 0.9); c.scale(1.15, 1.15);
      C.wife(c, { mouth: t < TL.stab ? 'scream' : 'o' }); c.restore();
    }
    const raise = U.easeOut(U.lin(16.1, 17.3, t));
    const stab = U.easeIn(U.lin(TL.stab - 0.06, TL.stab + 0.1, t));
    const lower = U.smooth(18.8, 19.4, t);
    const arm = U.clamp(raise - stab * 0.75 - lower * 0.25, 0, 1);
    c.save(); c.translate(380, 1700); c.scale(1.1, 1.1);
    C.killerBody(c, { back: true, arm, bloody: U.smooth(TL.stab, TL.stab + 0.3, t) });
    c.restore();
    const sp = U.easeOut(U.lin(TL.stab + 0.02, TL.stab + 0.25, t));
    if (sp > 0) for (let i = 0; i < 26; i++) {
      const a = U.hash(i * 3.3) * TAU, r = (40 + U.hash(i * 5.1) * 300) * sp;
      H.circ(c, 720 + Math.cos(a) * r, 760 + Math.sin(a) * r * 0.8, (4 + U.hash(i) * 16) * (0.5 + sp * 0.5), C.PAL.blood);
    }
    c.restore();
    c.strokeStyle = '#8f99a8'; c.lineWidth = 30; c.strokeRect(wx, wy, ww, wh);
    H.rr(c, wx, wy + 420, ww, 22, 0, '#8f99a8');
    c.fillStyle = 'rgba(210,225,255,0.07)'; c.beginPath(); c.moveTo(wx, wy + 600); c.lineTo(wx + 500, wy); c.lineTo(wx + 620, wy); c.lineTo(wx, wy + 760); c.fill();
    const fl = U.clamp(1 - (t - TL.stab) / 0.35);
    if (t >= TL.stab && fl > 0) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(200,10,10,${0.55 * fl})`; c.fillRect(0, 0, W, HT); }
    snow(c, t, 60);
  };

  S.mugSmash = (c, t) => {
    cam(c, t, 540, 960, 1.05);
    c.fillStyle = '#4a3020'; c.fillRect(-300, -300, W + 600, HT + 600);
    for (let y = -300; y < HT + 300; y += 110) {
      H.rr(c, -300, y, W + 600, 6, 0, 'rgba(0,0,0,0.3)');
      for (let x = (Math.round(y / 110) % 2) ? -100 : 120; x < W + 300; x += 440) H.rr(c, x, y, 6, 110, 0, 'rgba(0,0,0,0.25)');
    }
    const e = t - TL.mugSmash;
    if (e < 0) { H.rr(c, 500, 860, 80, 100, 10, '#f6f4ef'); return; }
    const p = U.easeOut(U.clamp(e / 0.25));
    H.ell(c, 540, 1010, 380 * p, 160 * p, '#3b1f10');
    H.ell(c, 520, 1000, 300 * p, 110 * p, '#5a3018');
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + U.hash(i) * 0.3, dist = (160 + U.hash(i * 4.4) * 320) * U.easeOut(U.clamp(e / 0.5));
      const x = 540 + Math.cos(a) * dist, y = 980 + Math.sin(a) * dist * 0.55;
      c.save(); c.translate(x, y); c.rotate(a + e * 6 * (1 - U.clamp(e / 0.5)));
      H.poly(c, [[-18, -10], [22, -4], [-2, 20]], i % 4 === 0 ? COL.red : '#f6f4ef'); c.restore();
    }
  };

  S.blockScan = (c, t, lt, d, v) => {
    cam(c, t, 540 + lt * 40, 960, 1.15);
    const dark = v === 'dark';
    sky(c);
    facade(c, -300, -100, 11, 13, 210, 230, (k, r) => (dark ? (U.hash(k * 3 + r) > 0.93 ? 0.6 : 0) : U.hash(k * 3 + r) > 0.8 ? 0.85 : 0));
    const step = Math.floor(lt / 0.45), f = U.easeOut(U.clamp((lt % 0.45) / 0.18));
    const pos = (s) => [-300 + (2 + Math.floor(U.hash(s * 9.1 + (dark ? 50 : 0)) * 5)) * 210 + 30, -100 + (2 + Math.floor(U.hash(s * 4.7 + (dark ? 50 : 0)) * 5)) * 230 + 40];
    const [x0, y0] = pos(step), [x1, y1] = pos(step + 1);
    brackets(c, U.lerp(x0, x1, f), U.lerp(y0, y1, f), 150, 150);
    snow(c, t, 70);
  };

  S.lightSwitch = (c, t) => {
    cam(c, t, 540, 960, 1.0);
    c.fillStyle = '#8a6040'; c.fillRect(-300, -300, W + 600, HT + 600);
    for (let i = 0; i < 400; i++) H.circ(c, U.hash(i * 1.1) * W, U.hash(i * 2.3) * HT, 1.5 + U.hash(i) * 2, 'rgba(60,35,20,0.25)');
    tag(c, 'RULE #1', 470, 520, -0.07);
    H.rr(c, 400, 760, 280, 300, 22, '#ece6d8'); H.rr(c, 420, 780, 240, 260, 16, '#f8f4ea');
    const off = t >= TL.lightOff;
    H.rr(c, 470, 820, 140, 180, 10, '#dcd6c8');
    H.rr(c, 478, off ? 910 : 828, 124, 82, 8, '#c7c0b0');
    const p = U.easeOut(U.lin(28.55, TL.lightOff, t)) - U.smooth(TL.lightOff + 0.25, TL.lightOff + 0.7, t) * 0.4;
    if (p > 0) {
      const hx = U.lerp(1200, 590, p), hy = U.lerp(1100, 900, p);
      H.limb(c, [[1300, 1250], [hx + 150, hy + 60]], C.PAL.coat, 120);
      H.rr(c, hx - 30, hy - 40, 190, 120, 50, C.PAL.skin);
      H.rr(c, hx - 60, hy - 30, 90, 46, 23, C.PAL.skin);
    }
    if (off) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(4,6,14,${0.72 * U.lin(TL.lightOff, TL.lightOff + 0.08, t)})`; c.fillRect(0, 0, W, HT); }
  };

  S.curtains = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.06, lt / d));
    const lampOn = t < TL.lampOff ? 1 : 0;
    c.save(); c.beginPath(); c.rect(250, 330, 580, 760); c.clip();
    sky(c, 250, 330, 580, 760);
    facade(c, 250, 600, 4, 5, 150, 170, (k, r) => (U.hash(k * 9 + r * 2) > 0.7 ? 0.8 : 0));
    c.restore();
    c.fillStyle = '#2a1d16'; c.beginPath(); c.rect(-300, -300, W + 600, HT + 600); c.rect(250, 330, 580, 760); c.fill('evenodd');
    c.strokeStyle = '#4a3a30'; c.lineWidth = 26; c.strokeRect(250, 330, 580, 760);
    H.rr(c, 300, 1150, 480, 190, 10, '#b9b9b4');
    for (let x = 316; x < 770; x += 30) H.rr(c, x, 1160, 18, 170, 8, '#d9d9d4');
    lamp(c, 140, 900, lampOn);
    const sh = U.easeInOut(U.lin(TL.curtainShut[0], TL.curtainShut[1], t));
    for (const s of [-1, 1]) {
      const inner = U.lerp(s < 0 ? 300 : 780, 540, sh), outer = s < 0 ? 170 : 910;
      c.fillStyle = '#7a3524'; c.beginPath(); c.moveTo(outer, 280);
      c.lineTo(inner, 280); for (let y = 280; y <= 1130; y += 50) c.lineTo(inner + Math.sin(y * 0.03 + t * 4 * (1 - sh)) * 10 * (1 - sh * 0.7), y);
      c.lineTo(outer, 1130); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 6;
      for (let k = 1; k < 4; k++) { const x = U.lerp(outer, inner, k / 4); c.beginPath(); c.moveTo(x, 290); c.lineTo(x, 1120); c.stroke(); }
    }
    H.rr(c, 130, 262, 820, 22, 6, '#3a2a20');
    const toLamp = U.smooth(32.33, 32.6, t) * (1 - U.smooth(32.9, 33.4, t));
    c.save(); c.translate(540, 1150); c.scale(1.35, 1.35);
    if (toLamp > 0.2) C.mum(c, { back: true, arms: 'reach', reach: [U.lerp(150, -280, toLamp), U.lerp(100, -140, toLamp)] });
    else C.mum(c, { back: true, arms: 'spread', reachL: [U.lerp(-190, -20, sh), -150], reach: [U.lerp(190, 20, sh), -150] });
    c.restore();
    c.save(); c.translate(900, 1330); c.scale(0.95, 0.95); C.girl(c, { mouth: 'o', brow: 1, legs: true }); c.restore();
    const dark = lampOn ? 0.15 : 0.55 + sh * 0.15;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(4,6,16,${dark})`; c.fillRect(0, 0, W, HT);
  };

  S.blockCount = (c, t, lt, d, v) => {
    const win = v === 'window';
    const B = { x: -200, y: -300, cw: 230, ch: 250 };
    const tk = 4, tr = 5;
    const tx = B.x + (tk + 0.5) * B.cw, ty = B.y + (tr + 0.5) * B.ch;
    cam(c, t, win ? tx : U.lerp(tx, 540, 0.4), win ? ty : U.lerp(ty, 960, 0.3), win ? U.lerp(1.25, 1.1, lt / d) : U.lerp(0.85, 0.7, lt / d));
    sky(c, -1200, -1200, 3600, 4000);
    facade(c, B.x - B.cw * 2, B.y - B.ch * 3, 12, 16, B.cw, B.ch, () => 0);
    if (win) circleMark(c, tx, ty, 130, U.lin(1.35, 1.75, lt), 'WINDOW');
    else {
      circleMark(c, tx, ty, 130, 1, null);
      const p = U.easeOut(U.lin(0, 0.3, lt));
      c.strokeStyle = COL.red; c.lineWidth = 6; c.setLineDash([18, 12]);
      c.beginPath(); c.moveTo(tx - 1400 * p, ty); c.lineTo(tx + 1400 * p, ty); c.stroke(); c.setLineDash([]);
      if (p > 0.6) H.text(c, '11TH FLOOR', tx + 160, ty - 40, '800 48px Montserrat, Arial', COL.red, 'left');
    }
    snow(c, t, 80);
  };

  S.blockAngle = (c, t, lt) => {
    cam(c, t, 540, 960, 1.0);
    sky(c);
    c.save(); c.translate(540, 1300); c.transform(1, -0.32, 0.25, 1, 0, 0);
    facade(c, -700, -1800, 9, 9, 190, 200, () => 0);
    H.rr(c, -700, 0, 1710, 30, 0, '#1a2030');
    c.fillStyle = '#2a2f3a'; c.fillRect(-1200, 30, 2800, 300);
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 6; c.setLineDash([60, 50]); c.beginPath(); c.moveTo(-1200, 180); c.lineTo(1600, 180); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const x = ((lt * 260 + i * 520) % 1800) - 700, y = 80 + (i % 2) * 120;
      H.rr(c, x, y + 30, 190, 60, 18, '#9aa0aa'); H.rr(c, x + 40, y, 110, 44, 14, '#b9bec6');
      H.circ(c, x + 40, y + 90, 18, '#111'); H.circ(c, x + 150, y + 90, 18, '#111');
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, x + 195, y + 55, 2, 160, [[0, 'rgba(255,240,200,0.45)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(x + 190, y - 110, 320, 330); c.restore();
    }
    circleMark(c, 150, -560, 170, U.lin(0.2, 0.6, lt), 'YOUR BLOCK');
    c.restore();
    snow(c, t, 90);
  };

  S.entrance = (c, t, lt, d) => {
    let sx = 0; TL.mainBangs.forEach((k) => { const e = t - k; if (e > 0 && e < 0.2) sx = 10 * Math.exp(-e * 15); });
    cam(c, t, 540, 980, U.lerp(1.0, 1.1, lt / d));
    sky(c);
    c.fillStyle = COL.wall; c.fillRect(-300, 200, W + 600, 1300);
    aptWindow(c, -40, 620, 300, 380, 0);
    H.rr(c, 300, 560, 480, 60, 4, '#3a4356');
    H.text(c, 'KESTREL HOUSE', 540, 660, '800 34px Montserrat, Arial', '#e8e8e8');
    H.text(c, 'FLATS 1–88', 540, 700, '600 20px Montserrat, Arial', '#b8bec8');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 540, 740, 4, 420, [[0, 'rgba(255,240,200,0.55)'], [1, 'rgba(255,240,200,0)']]); c.fillRect(100, 600, 880, 900); c.restore();
    H.circ(c, 540, 740, 16, '#fff7dc');
    c.save(); c.translate(sx, 0);
    H.rr(c, 380, 780, 320, 620, 4, '#9ea6b2'); H.rr(c, 400, 800, 280, 600, 2, '#151b27');
    H.rr(c, 650, 1060, 14, 140, 6, '#d8dce2');
    c.restore();
    H.rr(c, 740, 980, 80, 150, 8, '#2a2f38'); for (let i = 0; i < 9; i++) H.rr(c, 754 + (i % 3) * 20, 1000 + Math.floor(i / 3) * 26, 14, 16, 3, '#9aa3ae');
    c.fillStyle = '#4a5160'; c.fillRect(-300, 1400, W + 600, 700);
    c.fillStyle = 'rgba(240,245,255,0.8)'; c.fillRect(-300, 1400, W + 600, 14);
    snow(c, t, 110);
  };

  S.stairs = (c, t, lt) => {
    cam(c, t, 540 + lt * 120, 960 - lt * 160, 1.0);
    c.fillStyle = '#d9cfb4'; c.fillRect(-500, -800, W + 1400, HT + 1400);
    c.fillStyle = '#3e5f47'; c.beginPath(); c.moveTo(-500, 1700); c.lineTo(1800, 300); c.lineTo(1800, 2400); c.lineTo(-500, 2400); c.fill();
    for (let i = 0; i < 18; i++) {
      const x = -400 + i * 120, y = 1760 - i * 75;
      H.rr(c, x, y, 140, 80, 0, i % 2 ? '#5b4636' : '#6a5240'); H.rr(c, x, y, 140, 10, 0, '#8a6c52');
    }
    H.line(c, -500, 1480, 1800, 80, '#5a3e2c', 18);
    H.text(c, '9', 230, 380, '900 300px Montserrat, Arial', '#c42a22');
    H.text(c, 'FLOOR', 230, 560, '800 56px Montserrat, Arial', '#c42a22');
    const bx = 480 + lt * 120 + Math.sin(lt * 9) * 10, by = 900 - lt * 160 + Math.abs(Math.sin(lt * 9)) * 16;
    H.limb(c, [[bx - 500, by + 700], [bx - 120, by + 170], [bx, by]], C.PAL.sweater, 110);
    c.save(); c.translate(bx + 30, by - 10); c.rotate(-0.7); c.scale(1.2, 1.2); C.knife(c, 1); c.restore();
    H.circ(c, bx + 10, by, 48, C.PAL.kSkin);
  };

  S.stairLights = (c, t, lt, d) => {
    cam(c, t, 540, 960, 1.05);
    sky(c);
    facade(c, -120, -200, 6, 11, 240, 220, (k, r) => (U.hash(k * 5 + r) > 0.85 ? 0.7 : 0));
    const lvl = U.lin(0, d, lt) * 8;
    for (let i = 0; i < 9; i++) {
      const y = 1700 - i * 200, on = U.clamp(lvl - i + 1);
      H.rr(c, 838, y - 6, 44, 152, 3, COL.frame);
      H.rr(c, 844, y, 32, 140, 2, on > 0 ? `rgba(255,250,235,${0.4 + on * 0.6})` : COL.glass);
      if (on > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 860, y + 70, 2, 160, [[0, `rgba(255,250,230,${0.35 * on})`], [1, 'rgba(0,0,0,0)']]); c.fillRect(700, y - 90, 320, 320); c.restore(); }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = H.lg(c, W * 0.6, 0, W, 0, [[0, 'rgba(160,0,0,0)'], [1, 'rgba(160,0,0,0.35)']]); c.fillRect(0, 0, W, HT);
    snow(c, t, 60);
  };

  S.corridor = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.06, lt / d));
    c.fillStyle = '#e5dcc6'; c.fillRect(-300, -300, W + 600, 1500);
    c.fillStyle = '#365640'; c.fillRect(-300, 1200, W + 600, 1100);
    H.rr(c, -300, 1190, W + 600, 16, 0, '#2a3e30');
    H.text(c, '11', 200, 380, '900 260px Montserrat, Arial', '#c42a22');
    H.text(c, 'FLOOR', 200, 540, '800 52px Montserrat, Arial', '#c42a22');
    H.rr(c, 40, 640, 330, 560, 4, '#9aa0a8'); H.rr(c, 58, 660, 144, 540, 2, '#d5d9de'); H.rr(c, 208, 660, 144, 540, 2, '#c9ced4');
    H.rr(c, 390, 860, 26, 60, 6, '#555'); H.circ(c, 403, 890, 7, '#ffcc33');
    H.rr(c, 600, 560, 340, 660, 4, '#d6d3cb'); H.rr(c, 620, 580, 300, 640, 2, '#4a3226');
    H.rr(c, 735, 650, 70, 40, 6, '#c9a34a'); H.text(c, '58', 770, 671, '800 26px Montserrat, Arial', '#2a1a10');
    H.rr(c, 640, 880, 120, 18, 8, COL.steel);
    const x = U.lerp(1250, 980, U.easeOut(lt / d));
    c.save(); c.translate(x, 2000); c.scale(1.6, 1.6); c.globalAlpha = 0.92;
    c.fillStyle = '#120d0b';
    c.beginPath(); c.ellipse(0, -820, 80, 92, 0, 0, TAU); c.fill();
    c.fillRect(-130, -740, 260, 380); c.fillRect(-110, -380, 220, 380);
    c.save(); c.translate(-140, -470); c.rotate(2.4); c.scale(0.9, 0.9); C.knife(c, 1); c.restore();
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = H.rg(c, W / 2, HT / 2, 300, 1200, [[0, 'rgba(120,0,0,0)'], [1, 'rgba(120,0,0,0.45)']]); c.fillRect(0, 0, W, HT);
  };

  S.hug = (c, t, lt, d) => {
    cam(c, t, 540, 1000, U.lerp(1.02, 1.12, lt / d));
    c.fillStyle = '#151a26'; c.fillRect(-300, -300, W + 600, HT + 600);
    H.rr(c, 900, -300, 80, HT + 600, 0, '#c8c4b8'); H.rr(c, 980, -300, 400, HT + 600, 0, '#2a2420');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.lg(c, 980, 0, 700, 0, [[0, 'rgba(255,240,210,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(600, -300, 400, HT + 600); c.restore();
    c.save(); c.translate(500, 760); c.scale(1.9, 1.9); C.mum(c, { arms: 'hug', mouth: 'flat', brow: 1, lx: 0.8 }); c.restore();
    c.save(); c.translate(560, 1060); c.scale(1.9, 1.9); C.girl(c, { mouth: 'flat', brow: 1, lx: 0.6, blink: Math.abs(lt - 1.3) < 0.07 }); c.restore();
  };

  S.doorChain = (c, t) => {
    let sw = 0, sx = 0;
    TL.blows.forEach((k) => { const e = t - k; if (e > 0 && e < 0.6) { sw += Math.exp(-e * 5) * Math.sin(e * 38); if (e < 0.2) sx = 14 * Math.exp(-e * 14); } });
    cam(c, t, 720, 700, 3.0);
    c.fillStyle = '#211a16'; c.fillRect(-300, -300, W + 600, HT + 600);
    frontDoor(c, 330, 300, 420, 1050, { chainSwing: sw * 1.4, shakeX: sx });
  };

  S.mumFace = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.06, lt / d));
    c.fillStyle = H.lg(c, 0, 0, 0, HT, [[0, '#1b2238'], [1, '#3a0d12']]); c.fillRect(-300, -300, W + 600, HT + 600);
    const look = t < 55.33 ? [0, 0] : t < 56 ? [-1, -0.6] : t < 56.67 ? [1, 0.8] : [1, -0.6];
    c.save(); c.translate(540, 1300); c.scale(3.1, 3.1); C.mum(c, { arms: 'down', mouth: 'o', brow: 1, lx: look[0], ly: look[1] }); c.restore();
    const inset = (x, y, a, b, draw) => {
      if (t < a || t >= b) return;
      const s = U.backOut(U.clamp((t - a) / 0.2));
      c.save(); c.translate(x, y); c.scale(s, s);
      c.save(); c.beginPath(); c.arc(0, 0, 150, 0, TAU); c.clip(); c.fillStyle = '#111'; c.fillRect(-150, -150, 300, 300); draw(); c.restore();
      c.beginPath(); c.arc(0, 0, 150, 0, TAU); c.strokeStyle = '#d6a64a'; c.lineWidth = 10; c.stroke();
      c.restore();
    };
    inset(250, 420, 55.33, 56.0, () => { c.save(); c.scale(0.3, 0.3); c.translate(-540, -800); frontDoor(c, 330, 300, 420, 1050, { wallBits: false }); c.restore(); });
    inset(820, 1520, 56.0, 56.67, () => { c.save(); c.translate(0, 70); c.scale(0.9, 0.9); C.girl(c, { mouth: 'o', brow: 1 }); c.restore(); });
    inset(820, 420, 56.67, 57.67, () => { c.save(); c.scale(0.36, 0.36); sky(c, -500, -500, 1000, 1000); aptWindow(c, -280, -330, 560, 660, 0, { frame: '#aab6c4' }); c.restore(); });
  };

  S.openWindow = (c, t, lt, d) => {
    cam(c, t, 540, 900, U.lerp(1.0, 1.08, lt / d));
    const pull = U.easeInOut(U.lin(57.8, 58.9, t));
    const open = U.easeInOut(U.lin(TL.windowOpen, TL.windowOpen + 0.9, t));
    c.save(); c.beginPath(); c.rect(180, 260, 720, 900); c.clip();
    sky(c, 180, 260, 720, 900);
    facade(c, 120, 520, 5, 5, 170, 190, (k, r) => (U.hash(k * 2 + r * 9) > 0.65 ? 0.85 : 0));
    c.restore();
    c.fillStyle = '#22180f'; c.beginPath(); c.rect(-300, -300, W + 600, HT + 600); c.rect(180, 260, 720, 900); c.fill('evenodd');
    const sw = Math.cos(open * 1.25);
    c.fillStyle = 'rgba(120,150,200,0.12)'; c.fillRect(180, 260, 360 * sw, 900);
    c.strokeStyle = '#7d8796'; c.lineWidth = 22; c.strokeRect(180, 260, 360 * sw, 900); c.strokeRect(540, 260, 360, 900);
    c.strokeStyle = '#a9b3c0'; c.lineWidth = 30; c.strokeRect(170, 250, 740, 920);
    H.rr(c, 240, 1260, 600, 220, 10, '#a9a9a4'); for (let x = 256; x < 830; x += 34) H.rr(c, x, 1270, 20, 200, 9, '#d4d4cf');
    for (const s of [-1, 1]) {
      const inner = s < 0 ? U.lerp(420, 140, pull) : 700, outer = s < 0 ? 60 : 1020;
      c.fillStyle = '#7a3524'; c.beginPath(); c.moveTo(outer, 200); c.lineTo(inner, 200);
      for (let y = 200; y <= 1220; y += 60) c.lineTo(inner + Math.sin(y * 0.02 + t * 2) * 10 + (open > 0 ? Math.sin(y * 0.05 + t * 9) * 16 * open : 0), y);
      c.lineTo(outer, 1220); c.closePath(); c.fill();
    }
    const hx = U.lerp(460, 180, pull) + (open > 0 ? 200 * open : 0), hy = U.lerp(720, 700, pull);
    H.limb(c, [[1250, 1500], [U.lerp(900, 700, pull), 1000], [hx, hy]], C.PAL.coat, 90);
    H.circ(c, hx, hy, 40, C.PAL.skin);
    if (open > 0) streaks(c, t, Math.round(60 * open));
  };

  S.windowWind = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.06, lt / d));
    c.fillStyle = COL.wall; c.fillRect(-300, -300, W + 600, HT + 600);
    for (let y = -300; y < HT; y += 230) H.rr(c, -300, y, W + 600, 4, 0, COL.seam);
    const wx = 200, wy = 360, ww = 680, wh = 1060;
    c.fillStyle = '#121826'; c.fillRect(wx, wy, ww, wh);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 540, 700, 10, 600, [[0, 'rgba(120,150,220,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(wx, wy, ww, wh); c.restore();
    c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
    c.save(); c.translate(430, 820); c.scale(1.35, 1.35); C.mum(c, { arms: 'reach', reach: [-200, -40], mouth: 'flat', brow: 1, wind: 1, legs: true }); c.restore();
    c.save(); c.translate(680, 1050); c.scale(1.3, 1.3); C.girl(c, { mouth: 'o', brow: 1, wind: t, legs: true }); c.restore();
    c.restore();
    c.strokeStyle = '#9fb3c8'; c.lineWidth = 32; c.strokeRect(wx, wy, ww, wh);
    H.rr(c, wx - 40, wy + wh, ww + 80, 36, 4, '#c7ced8');
    streaks(c, t, 90);
  };

  // exterior wall at a steep angle: curtains blowing out above, the ledge, a window below
  function wallAngle(c, t, o = {}) {
    sky(c);
    c.save(); c.translate(540, 900); c.transform(1, 0.12, -0.45, 1, 0, 0);
    c.fillStyle = '#2f3a52'; c.fillRect(-900, -1400, 1900, 2800);
    for (let y = -1400; y < 1400; y += 300) H.rr(c, -900, y, 1900, 6, 0, '#26304a');
    for (let x = -900; x < 1000; x += 380) H.rr(c, x, -1400, 6, 2800, 0, '#26304a');
    H.rr(c, -170, -1200, 520, 560, 6, '#151b28');
    for (let k = 0; k < 2; k++) {
      c.fillStyle = '#9a2a1e'; c.beginPath();
      const bx = -120 + k * 300;
      c.moveTo(bx, -1200);
      for (let i = 0; i <= 12; i++) c.lineTo(bx + Math.sin(t * 6 + i * 0.7 + k) * (20 + i * 6) + i * 10, -1200 + i * 70);
      for (let i = 12; i >= 0; i--) c.lineTo(bx + 90 + Math.sin(t * 6 + i * 0.7 + k + 0.5) * (20 + i * 6) + i * 10, -1200 + i * 70);
      c.fill();
    }
    H.rr(c, -900, -560, 1900, 44, 0, '#8d96a8'); H.rr(c, -900, -516, 1900, 22, 0, '#5d667a');
    H.rr(c, -200, 0, 560, 520, 6, '#0e131e');
    c.strokeStyle = '#56627a'; c.lineWidth = 16; c.strokeRect(-200, 0, 560, 520);
    if (o.annot) {
      const p = U.easeOut(o.annot);
      c.strokeStyle = '#e8c35a'; c.lineWidth = 4; c.beginPath(); c.moveTo(150, -540); c.lineTo(150, -540 + 520 * p); c.stroke();
      if (p > 0.8) { H.text(c, 'LEDGE', 150, 30, '800 44px Montserrat, Arial', '#f1d27a'); H.text(c, '≈ 30 CM', 150, 80, '700 26px Montserrat, Arial', '#f1d27a'); }
    }
    c.restore();
  }
  S.ledgeBelow = (c, t, lt, d) => { cam(c, t, 540, U.lerp(700, 980, U.easeInOut(lt / d)), 1.0); wallAngle(c, t); streaks(c, t, 50); };
  S.ledge = (c, t, lt, d) => { cam(c, t, 560, 600, U.lerp(1.2, 1.35, lt / d)); wallAngle(c, t, { annot: U.lin(0.5, 1.1, lt) }); streaks(c, t, 40); };

  S.lookDown = (c, t, lt, d) => {
    const z = U.lerp(1.0, 1.35, U.easeInOut(lt / d));
    cam(c, t, 540, 1000, z, Math.sin(t * 0.7) * 0.03);
    c.fillStyle = '#0d1220'; c.fillRect(-600, -600, W + 1200, HT + 1200);
    c.save(); c.translate(540, 1050); c.scale(0.55, 0.55);
    c.fillStyle = '#1d2638'; c.fillRect(-900, -900, 1800, 1800);
    c.fillStyle = '#2e3646'; c.fillRect(-900, -120, 1800, 240);
    for (let i = 0; i < 60; i++) H.circ(c, -880 + U.hash(i) * 1760, -880 + U.hash(i * 3) * 1760, 4 + U.hash(i * 7) * 6, 'rgba(230,236,245,0.5)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 260, -280, 10, 380, [[0, 'rgba(255,240,200,0.6)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(-200, -700, 900, 900); c.restore();
    H.circ(c, 260, -280, 26, '#fff7dc'); H.line(c, 260, -280, 240, -60, '#111', 10);
    c.strokeStyle = '#0a0d14'; c.lineWidth = 10; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-420, -200); c.lineTo(-420 + Math.cos(i * 1.05) * 140, -200 + Math.sin(i * 1.05) * 140); c.stroke(); }
    c.restore();
    c.fillStyle = '#2f3a52';
    c.beginPath(); c.moveTo(-600, -600); c.lineTo(250, 560); c.lineTo(250, 1540); c.lineTo(-600, 2600); c.fill();
    c.fillStyle = '#26304a';
    c.beginPath(); c.moveTo(W + 600, -600); c.lineTo(830, 560); c.lineTo(830, 1540); c.lineTo(W + 600, 2600); c.fill();
    c.strokeStyle = '#1d2538'; c.lineWidth = 6;
    for (let i = 1; i < 11; i++) { const k = Math.pow(i / 11, 0.5); c.beginPath(); c.moveTo(U.lerp(-600, 250, k), U.lerp(-600, 560, k)); c.lineTo(U.lerp(-600, 250, k), U.lerp(2600, 1540, k)); c.stroke(); }
    H.rr(c, -300, 1650, W + 600, 80, 0, '#8d96a8'); H.rr(c, -300, 1730, W + 600, 300, 0, '#5d667a');
    snow(c, t, 70, 0.1, 140);
  };

  S.onLedge = (c, t, lt, d, v) => {
    const after = v === 'after';
    const e = U.easeInOut(lt / d);
    cam(c, t, after ? 540 : U.lerp(640, 520, e), after ? 960 : U.lerp(700, 980, e), after ? 1.0 : 1.05);
    c.fillStyle = '#2f3a52'; c.fillRect(-400, -400, W + 800, HT + 800);
    for (let y = -400; y < HT + 400; y += 300) H.rr(c, -400, y, W + 800, 6, 0, '#26304a');
    H.rr(c, 640, 260, 420, 820, 6, after ? '#e8e2d2' : '#141a28');
    if (after) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 850, 670, 20, 600, [[0, 'rgba(255,250,235,0.5)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(300, 100, 1000, 1200); c.restore(); }
    for (let k = 0; k < 2; k++) {
      c.fillStyle = '#9a2a1e'; c.beginPath(); const bx = 660 + k * 300;
      c.moveTo(bx, 260); for (let i = 0; i <= 11; i++) c.lineTo(bx + Math.sin(t * 6 + i * 0.6 + k) * (14 + i * 4) - i * 6, 260 + i * 75);
      for (let i = 11; i >= 0; i--) c.lineTo(bx + 80 + Math.sin(t * 6 + i * 0.6 + k + 0.6) * (14 + i * 4) - i * 6, 260 + i * 75);
      c.fill();
    }
    c.strokeStyle = '#7d8796'; c.lineWidth = 20; c.strokeRect(640, 260, 420, 820);
    H.rr(c, -400, 1300, W + 800, 46, 0, '#8d96a8'); H.rr(c, -400, 1346, W + 800, 24, 0, '#5d667a');
    const shuffle = after ? 0 : lt * 30;
    const mx = (after ? 230 : 470) - shuffle, gx = mx + 230;
    c.save(); c.translate(mx, 690); C.mum(c, { arms: 'spread', reachL: [-200, 40], reach: [190, 160], mouth: 'flat', brow: 1, lx: -0.6, legs: true, wind: 1 }); c.restore();
    c.save(); c.translate(gx, 860); c.scale(0.95, 0.95); C.girl(c, { mouth: 'o', brow: 1, legs: true, wind: t, arms: 'hold' }); c.restore();
    streaks(c, t, 70);
  };

  S.doorBurst = (c, t, lt) => {
    cam(c, t, 540, 960, U.lerp(1.15, 1.0, U.easeOut(U.clamp(lt / 0.6))));
    c.fillStyle = '#1d1714'; c.fillRect(-300, -300, W + 600, HT + 600);
    H.rr(c, 302, 272, 476, 1078, 4, COL.doorFrame);
    c.fillStyle = '#f4f1ea'; c.fillRect(330, 300, 420, 1050);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 540, 820, 50, 900, [[0, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(-300, -300, W + 600, HT + 600); c.restore();
    const rev = U.smooth(0.15, 0.7, lt);
    c.save(); c.translate(540, 1370); c.scale(1.15, 1.15); c.globalAlpha = rev;
    C.killerBody(c, { arm: 0.05, grin: 1, bloody: 1 }); c.restore();
    const f = U.easeIn(U.clamp(lt / 0.45));
    if (f < 1) {
      c.save(); c.translate(540, 1350); c.transform(1, 0, 0, 1 - f * 0.9, 0, 0); c.translate(-540, -1350);
      c.fillStyle = COL.door; c.fillRect(330 - f * 120, 300 + f * 400, 420 + f * 240, 1050 - f * 400); c.restore();
    }
    for (let i = 0; i < 12; i++) {
      const p = U.easeOut(U.clamp((lt - 0.1) / 1.2));
      const x = 540 + (i - 5.5) * 90 * (0.4 + p), y = 1330 - p * 60 - U.hash(i) * 80 * p, r = (60 + U.hash(i * 3) * 80) * (0.3 + p);
      H.circ(c, x, y, r, `rgba(200,195,185,${0.55 * (1 - p * 0.6)})`);
    }
    const fl = U.clamp(1 - lt / 0.35);
    if (fl > 0) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(255,255,255,${fl})`; c.fillRect(0, 0, W, HT); }
  };

  S.handWall = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.1, lt / d));
    c.fillStyle = '#0c1120'; c.fillRect(-300, -300, W + 600, HT + 600);
    c.fillStyle = '#34405a'; c.beginPath(); c.moveTo(-200, -300); c.lineTo(820, -300); c.lineTo(980, 2300); c.lineTo(-200, 2300); c.fill();
    for (let i = 0; i < 12; i++) { const y = -300 + Math.pow(i / 12, 1.6) * 2600; H.rr(c, -200, y, 1200, 8, 0, '#283249'); }
    for (const [x0, x1] of [[60, 20], [520, 560]]) for (let i = 0; i < 6; i++) {
      const y = -260 + Math.pow(i / 6, 1.6) * 2400, h = 60 + i * 50;
      H.rr(c, U.lerp(x0, x1, i / 6), y, 220 + i * 26, h, 3, '#121828');
    }
    c.save(); c.translate(560 + U.snoise(t * 8) * 4, 1150 + U.snoise(t * 7 + 3) * 4); c.scale(1.35, 1.35); C.hand(c); c.restore();
    snow(c, t, 80, 0.4, 120);
  };

  S.killerAbove = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.12, lt / d));
    c.fillStyle = '#0c1120'; c.fillRect(-300, -300, W + 600, HT + 600);
    for (let i = 0; i < 70; i++) H.circ(c, U.hash(i * 3.3) * W, U.hash(i * 7.1) * HT, 1.5, 'rgba(255,255,255,0.4)');
    c.save(); c.translate(-80, 0); c.transform(1, 0, -0.35, 1, 0, 0);
    c.fillStyle = '#2f3a52'; c.fillRect(0, -300, 700, 2600);
    for (let y = -300; y < 2300; y += 260) H.rr(c, 0, y, 700, 6, 0, '#26304a');
    H.rr(c, 300, 300, 360, 560, 4, '#e8e2d2');
    H.rr(c, 280, 850, 400, 24, 2, '#8d96a8');
    // him, leaning out of our window from the waist, looking down at you
    const lean = U.easeOut(U.lin(0, 0.5, lt));
    c.save(); c.beginPath(); c.rect(-400, -400, 1300, 1250); c.clip();
    c.translate(480, 850); c.rotate(U.lerp(0.1, 0.55, lean)); c.scale(1.05, 1.05); c.translate(0, 380);
    C.killerBody(c, { arm: 0.55, grin: 1, bloody: 1, knifeAngle: -0.9 });
    c.restore();
    c.restore();
    snow(c, t, 70, 0.2, 110);
  };

  /* ============================== HUD / CAPTIONS / POST ============================== */
  function hud(c, t) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (t >= 5.0) {
      c.save(); c.translate(44, 92); C.unionJack(c, 58, 34); c.restore();
      H.text(c, t < TL.clockFlip ? '3:00' : '3:01', 118, 110, '700 46px Orbitron, "Share Tech Mono", monospace', '#ff3b30', 'left');
    }
    if (t >= TL.timerStart) {
      const s = Math.max(0, Math.ceil(TL.timeLeft(t) - 1e-6));
      const x = 868, y = 68;
      H.rr(c, x, y, 170, 92, 10, 'rgba(10,10,14,0.85)');
      c.strokeStyle = 'rgba(255,60,50,0.7)'; c.lineWidth = 3; c.beginPath(); c.roundRect(x, y, 170, 92, 10); c.stroke();
      H.text(c, 'TIME LEFT', x + 85, y + 20, '700 15px Montserrat, Arial', '#e8e8e8');
      c.globalAlpha = s <= 10 && (t * 2) % 1 < 0.5 ? 0.55 : 1;
      H.text(c, s >= 60 ? '01:00' : `00:${String(s).padStart(2, '0')}`, x + 85, y + 60, '700 40px Orbitron, "Share Tech Mono", monospace', '#ff3b30');
      c.globalAlpha = 1;
    }
  }

  function captions(c, t) {
    const cap = TL.captionAt(t);
    if (!cap) return;
    const words = cap[1].split(' ').map((w) => ({ w: w.replace(/^[*!]/, ''), col: w[0] === '*' ? COL.yellow : w[0] === '!' ? COL.red : '#ffffff' }));
    const age = t - cap[0];
    const s = 1 + 0.18 * (1 - U.easeOut(U.clamp(age / 0.14)));
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.font = '900 78px Montserrat, "Arial Black", Arial, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    const sp = c.measureText(' ').width;
    const lines = [[]]; let lw = 0;
    for (const wd of words) {
      const w = c.measureText(wd.w).width;
      if (lw + w > 900 && lines[lines.length - 1].length) { lines.push([]); lw = 0; }
      lines[lines.length - 1].push(wd); lw += w + sp;
    }
    c.translate(540, 1360 - (lines.length - 1) * 44); c.scale(s, s);
    lines.forEach((ln, li) => {
      const total = ln.reduce((a, wd) => a + c.measureText(wd.w).width, 0) + sp * (ln.length - 1);
      let x = -total / 2; const y = li * 88;
      for (const wd of ln) {
        c.lineJoin = 'round'; c.lineWidth = 14; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(wd.w, x, y);
        c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
        c.fillStyle = wd.col; c.fillText(wd.w, x, y);
        c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
        x += c.measureText(wd.w).width + sp;
      }
    });
    c.restore();
  }

  function glitch(c, t) {
    for (const s of TL.glitches) {
      const e = t - s;
      if (e < 0 || e > 0.3) continue;
      const a = 1 - e / 0.3, f = Math.floor(t * 30);
      Tc.setTransform(1, 0, 0, 1, 0, 0); Tc.globalCompositeOperation = 'copy'; Tc.drawImage(c.canvas, 0, 0);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * a;
      c.drawImage(T, 22 * a, 0); c.drawImage(T, -22 * a, 6);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      for (let i = 0; i < 9; i++) {
        const y = Math.floor(U.hash(f * 7 + i) * HT), h = 20 + U.hash(i * 3 + f) * 90;
        c.drawImage(T, 0, y, W, h, (U.hash(i * 11 + f) - 0.5) * 120 * a, y, W, h);
      }
      c.fillStyle = `rgba(255,0,60,${0.12 * a})`; c.fillRect(0, 0, W, HT);
      c.restore();
    }
  }

  function post(c, t) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    const v = c.createRadialGradient(W / 2, HT / 2, HT * 0.3, W / 2, HT / 2, HT * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = v; c.fillRect(0, 0, W, HT);
    const f = Math.floor(t * TL.FPS);
    for (let i = 0; i < 260; i++) { c.fillStyle = U.hash(i + f) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; c.fillRect(U.hash(f * 13 + i) * W, U.hash(f * 7 + i * 3) * HT, 2, 2); }
    const k = Math.max(1 - U.clamp(t / 0.25), U.clamp((t - (TL.DURATION - 0.35)) / 0.35));
    if (k > 0) { c.fillStyle = `rgba(0,0,0,${k})`; c.fillRect(0, 0, W, HT); }
  }

  function render(c, t) {
    init();
    t = U.clamp(t, 0, TL.DURATION - 1e-6);
    const [a, b, id, variant] = TL.shotAt(t);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, HT);
    S[id](c, t, t - a, b - a, variant);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    post(c, t);
    glitch(c, t);
    hud(c, t);
    captions(c, t);
    c.restore();
  }

  g.Film = { render, init };
})(window);
