/* =========================================================================
   ROOM 9 — scenes.js
   The shots of the motel film, flat vector on a 1080x1920 canvas.
   Film.render(ctx, t) is a pure function of t (seeded noise only).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, Chars: C0, Motel: M } = g;
  const { H } = C0;
  const W = TL.W, HT = TL.H, TAU = Math.PI * 2;
  let T, Tc, ready = false;
  function init() { if (ready) return; T = document.createElement('canvas'); T.width = W; T.height = HT; Tc = T.getContext('2d'); ready = true; }

  const COL = {
    sky0: '#070912', sky1: '#1b1830', stucco: '#b98f86', stuccoDark: '#8a6862', roof: '#3a2f33', trim: '#e9e1cf',
    door: '#2f6f73', doorDark: '#23565a', asphalt: '#1d1f26', line: '#d9d3b0', neonPink: '#ff4f9a', neonBlue: '#4fd8ff',
    red: '#e8322a', yellow: '#f7b500', corn: '#4c5222', cornDark: '#2c3114', cornLight: '#6a6c2c', tv: '#9fd4ff',
  };

  /* ----------------------------- camera ----------------------------- */
  function shakeAt(t) {
    let a = 0;
    const hit = (s, amp, dec) => { const d = t - s; if (d >= 0 && d < 1.5) a = Math.max(a, amp * Math.exp(-d * dec)); };
    TL.hits.forEach((s) => hit(s, 7, 9));
    hit(TL.stab, 18, 6); hit(TL.remoteCrack, 14, 9); hit(TL.handleTurn[1], 10, 10); hit(TL.doorBang, 30, 5); hit(TL.maskReveal, 30, 4);
    TL.glitches.forEach((s) => hit(s, 12, 8));
    return { x: U.snoise(t * 37) * a, y: U.snoise(t * 41 + 7) * a };
  }
  function cam(c, t, cx = 540, cy = 960, z = 1, rot = 0) {
    const s = shakeAt(t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(W / 2 + s.x, HT / 2 + s.y); c.rotate(rot); c.scale(z, z); c.translate(-cx, -cy);
  }
  const glow = (c, x, y, r, col, a) => { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, x, y, 2, r, [[0, col.replace('A', a)], [1, col.replace('A', 0)]]); c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore(); };

  /* ----------------------------- shared art ----------------------------- */
  function sky(c, x = -600, y = -600, w = W + 1200, h = HT + 1200, moon = [820, 300]) {
    c.fillStyle = H.lg(c, 0, y, 0, y + h, [[0, COL.sky0], [0.6, COL.sky1], [1, '#2b2140']]); c.fillRect(x, y, w, h);
    for (let i = 0; i < 120; i++) H.circ(c, x + U.hash(i * 3.3) * w, y + U.hash(i * 7.1) * h * 0.7, 1 + U.hash(i) * 1.8, `rgba(255,255,255,${0.2 + U.hash(i * 2) * 0.5})`);
    if (moon) { glow(c, moon[0], moon[1], 220, 'rgba(220,225,255,A)', 0.25); H.circ(c, moon[0], moon[1], 62, '#efeedd'); H.circ(c, moon[0] - 18, moon[1] - 12, 12, 'rgba(180,180,160,0.5)'); H.circ(c, moon[0] + 20, moon[1] + 16, 9, 'rgba(180,180,160,0.5)'); }
  }
  function cornRow(c, y, n, h, sway, t, col = COL.corn, seed = 1, x0 = -500, x1 = W + 500) {
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = U.lerp(x0, x1, (i + U.hash(i * 1.7 + seed) * 0.6) / n);
      const hh = h * (0.75 + U.hash(i * 3.1 + seed) * 0.5);
      const s = Math.sin(t * 1.6 + i * 0.7 + seed) * sway;
      c.strokeStyle = col; c.lineWidth = h * 0.05;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.4, y - hh * 0.5, x + s, y - hh); c.stroke();
      // leaves
      for (let k = 0; k < 4; k++) {
        const ly = y - hh * (0.25 + k * 0.18), dir = k % 2 ? 1 : -1, lx = x + s * (0.25 + k * 0.18);
        c.beginPath(); c.moveTo(lx, ly); c.quadraticCurveTo(lx + dir * h * 0.25, ly - h * 0.12, lx + dir * h * 0.38 + s * 0.3, ly + h * 0.06);
        c.lineWidth = h * 0.03; c.stroke();
      }
      H.ell(c, x + s, y - hh - h * 0.04, h * 0.03, h * 0.08, '#c7b25a');
    }
  }
  function neonSign(c, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    H.rr(c, -8, 0, 16, 700, 4, '#2a2a30');
    H.rr(c, -170, -260, 340, 250, 18, '#1a1a22');
    const flick = U.hash(Math.floor(t * 12)) > 0.12 ? 1 : 0.25;
    c.shadowBlur = 24; c.shadowColor = COL.neonPink;
    H.text(c, 'MOTEL', 0, -190, '900 92px Montserrat, Arial', `rgba(255,79,154,${flick})`);
    c.shadowColor = COL.neonBlue;
    const vac = U.hash(Math.floor(t * 7) + 3) > 0.3 ? 1 : 0.3;
    H.text(c, 'VACANCY', 0, -80, '800 52px Montserrat, Arial', `rgba(79,216,255,${vac})`);
    c.shadowBlur = 0;
    H.text(c, 'NO', -150, -80, '800 30px Montserrat, Arial', 'rgba(120,60,70,0.6)');
    c.restore();
    glow(c, x, y - 190 * s, 420 * s, 'rgba(255,79,154,A)', 0.18 * flick);
  }
  // a single motel room front: door + window. lit: window colour or null
  function roomFront(c, x, y, num, o = {}) {
    // wall
    c.fillStyle = COL.stucco; c.fillRect(x, y, 420, 560);
    H.rr(c, x + 30, y + 120, 170, 440, 4, COL.trim);
    // door
    c.save(); c.translate(x + 40, y + 130);
    if (o.open) { c.fillStyle = '#fff6dc'; c.fillRect(0, 0, 150, 430); glow(c, 75, 215, 400, 'rgba(255,240,200,A)', 0.4 * o.open); c.transform(1 - o.open * 0.85, -0.15 * o.open, 0, 1, 0, 0); }
    c.fillStyle = COL.door; c.fillRect(0, 0, 150, 430);
    H.rr(c, 14, 20, 122, 170, 4, COL.doorDark); H.rr(c, 14, 220, 122, 190, 4, COL.doorDark);
    H.circ(c, 120, 230, 9, '#c9a34a');
    H.circ(c, 75, 110, 6, '#151515');
    c.restore();
    H.rr(c, x + 92, y + 70, 46, 46, 6, '#c9a34a'); H.text(c, String(num), x + 115, y + 94, '900 32px Montserrat, Arial', '#3a2a10');
    // window with blinds
    const wx = x + 230, wy = y + 200;
    H.rr(c, wx - 10, wy - 10, 180, 210, 4, COL.trim);
    c.fillStyle = o.lit || '#141824'; c.fillRect(wx, wy, 160, 190);
    c.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 190; k += 14) c.fillRect(wx, wy + k, 160, 5);
    if (o.lit) glow(c, wx + 80, wy + 95, 260, o.glow || 'rgba(140,200,255,A)', 0.3);
  }
  // the motel block seen from the lot
  function motel(c, t, o = {}) {
    // roof + overhang
    H.poly(c, [[-200, 980], [1300, 980], [1250, 900], [-150, 900]], COL.roof);
    for (let i = 0; i < 5; i++) {
      const num = 12 - i; // 12 at the left ... 8 at the right
      const x = -170 + i * 300;
      c.save(); c.translate(x, 990); c.scale(0.7, 0.7);
      roomFront(c, 0, 0, num, { lit: num === 9 && o.tv ? (U.hash(Math.floor(t * 9)) > 0.5 ? '#7fb4e6' : '#a7d2f7') : null });
      c.restore();
    }
    for (let i = 0; i < 7; i++) H.rr(c, -170 + i * 220, 980, 12, 400, 2, COL.trim);
    H.rr(c, -300, 1380, W + 600, 20, 0, '#58494a');
  }
  function lot(c, y = 1400) {
    c.fillStyle = H.lg(c, 0, y, 0, y + 600, [[0, '#2a2a33'], [1, COL.asphalt]]); c.fillRect(-400, y, W + 800, 800);
    c.strokeStyle = 'rgba(217,211,176,0.5)'; c.lineWidth = 6;
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-300 + i * 220, y + 40); c.lineTo(-420 + i * 260, y + 600); c.stroke(); }
  }
  function car(c, x, y, s, t, hood = true) {
    c.save(); c.translate(x, y); c.scale(s, s);
    H.ell(c, 0, 20, 330, 30, 'rgba(0,0,0,0.5)');
    H.rr(c, -320, -140, 640, 140, 40, '#5c6f8a'); H.poly(c, [[-180, -140], [-110, -250], [130, -250], [210, -140]], '#4d5f78');
    H.poly(c, [[-160, -145], [-105, -235], [0, -235], [0, -145]], '#1d2433'); H.poly(c, [[15, -145], [15, -235], [120, -235], [190, -145]], '#1d2433');
    H.circ(c, -200, 0, 62, '#141416'); H.circ(c, 200, 0, 62, '#141416'); H.circ(c, -200, 0, 26, '#888'); H.circ(c, 200, 0, 26, '#888');
    if (hood) { c.save(); c.translate(230, -140); c.rotate(-0.9); H.rr(c, 0, -10, 150, 18, 6, '#6d819c'); c.restore(); }
    H.rr(c, 300, -100, 26, 30, 6, '#f2e6b0');
    if (hood) for (let i = 0; i < 4; i++) { // steam
      const p = ((t * 0.4 + i * 0.25) % 1);
      H.circ(c, 260 + Math.sin(t + i) * 20, -170 - p * 220, 30 + p * 50, `rgba(220,220,230,${0.25 * (1 - p)})`);
    }
    c.restore();
  }
  function brackets(c, x, y, w, h, col = COL.red, lw = 6) {
    const k = Math.min(w, h) * 0.28; c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'square';
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const px = x + sx * w, py = y + sy * h, dx = sx ? -k : k, dy = sy ? -k : k;
      c.beginPath(); c.moveTo(px + dx, py); c.lineTo(px, py); c.lineTo(px, py + dy); c.stroke();
    }
  }
  function circleMark(c, x, y, r, p, label) {
    if (p <= 0) return;
    c.save(); c.strokeStyle = COL.red; c.lineWidth = 8; c.lineCap = 'round'; c.shadowColor = 'rgba(232,50,42,0.7)'; c.shadowBlur = 14;
    c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * U.easeOut(U.clamp(p))); c.stroke(); c.restore();
    if (label && p > 0.6) H.text(c, label, x, y - r - 30, '800 34px Montserrat, Arial', COL.red);
  }
  function tag(c, text, x, y, rot = -0.06) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.font = '900 40px Montserrat, Arial'; const w = c.measureText(text).width + 40;
    H.rr(c, -w / 2, -32, w, 64, 6, '#d8261f'); H.text(c, text, 0, 2, '900 40px Montserrat, Arial', '#fff');
    c.restore();
  }
  function tvFlicker(t) { return 0.7 + 0.3 * U.hash(Math.floor(t * 14)); }
  function roomInterior(c, t, dark = 0) {
    c.fillStyle = '#8a5a34'; c.fillRect(-400, -400, W + 800, HT + 800);
    for (let x = -400; x < W + 400; x += 90) for (let y = -400; y < 1300; y += 90) {
      H.circ(c, x + ((y / 90) % 2 ? 45 : 0), y, 18, 'rgba(210,140,60,0.35)'); H.circ(c, x + ((y / 90) % 2 ? 45 : 0), y, 8, 'rgba(90,50,20,0.4)');
    }
    // framed duck picture + headboard
    H.rr(c, 380, 300, 320, 220, 8, '#5a3a20'); H.rr(c, 396, 316, 288, 188, 4, '#9cb7c4'); H.ell(c, 540, 440, 70, 34, '#6b4a2a'); H.circ(c, 600, 400, 26, '#2f5d3a'); H.poly(c, [[620, 400], [660, 392], [622, 410]], '#e0a030');
    H.rr(c, 120, 640, 840, 260, 30, '#4a2d1c');
    // bed
    H.rr(c, 60, 900, 960, 700, 30, '#a5562d'); H.rr(c, 60, 900, 960, 120, 30, '#efe7d6');
    for (let i = 0; i < 6; i++) H.rr(c, 60, 1060 + i * 90, 960, 12, 0, 'rgba(0,0,0,0.12)');
    // nightstand + lamp
    H.rr(c, 900, 960, 200, 260, 10, '#5a3a20');
  }

  /* ============================== SHOTS ============================== */
  const S = {};

  S.maskClose = (c, t, lt, d, v) => {
    const heard = v === 'heard';
    cam(c, t, 540, 900, heard ? U.lerp(1.3, 1.6, U.easeOut(lt / d)) : U.lerp(1.0, 1.15, lt / d));
    c.fillStyle = '#0a0a10'; c.fillRect(-400, -400, W + 800, HT + 800);
    glow(c, 140, 500, 900, 'rgba(255,79,154,A)', 0.22);
    glow(c, 980, 1300, 900, 'rgba(79,216,255,A)', 0.14);
    c.save(); c.translate(540, 900 + Math.sin(t * 1.2) * 6); c.scale(1.55, 1.55);
    M.mask(c, { t, tilt: heard ? -0.22 * U.easeOut(U.clamp(lt / 0.6)) : Math.sin(t * 0.6) * 0.03, look: heard ? 0 : Math.sin(t) * 0.5 });
    c.restore();
    // the knife edge catching the neon
    c.save(); c.translate(140, 1560); c.rotate(-0.25); c.scale(1.6, 1.6); C0.knife(c, 0); c.restore();
    H.circ(c, 150, 1560, 46, M.PAL.glove);
    glow(c, 560, 1440, 120, 'rgba(255,255,255,A)', 0.4 + 0.4 * Math.sin(t * 5));
  };

  S.door9 = (c, t, lt, d, v) => {
    const z = v === 'room' ? U.lerp(1.2, 1.9, U.easeInOut(lt / d)) : 1.05;
    cam(c, t, v === 'room' ? U.lerp(560, 330, U.easeInOut(lt / d)) : 540, v === 'room' ? U.lerp(980, 700, U.easeInOut(lt / d)) : 980, z);
    c.fillStyle = COL.stucco; c.fillRect(-400, -400, W + 800, HT + 800);
    glow(c, 540, 400, 1100, 'rgba(255,79,154,A)', 0.2);
    c.save(); c.translate(120, 520); c.scale(1.75, 1.75); roomFront(c, 0, 0, 9, { lit: '#7fb4e6' }); c.restore();
    // porch lamp with moths
    H.rr(c, 460, 380, 60, 70, 10, '#e9e1cf'); glow(c, 490, 420, 300, 'rgba(255,230,170,A)', 0.5);
    for (let i = 0; i < 5; i++) H.circ(c, 490 + Math.sin(t * 6 + i * 2) * 60, 420 + Math.cos(t * 5 + i) * 40, 4, '#ddd');
    c.fillStyle = '#2a2a33'; c.fillRect(-400, 1540, W + 800, 800);
  };

  S.timer = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1, 1.08, lt / d));
    c.fillStyle = H.rg(c, 540, 900, 50, 1200, [[0, '#3a0606'], [1, '#080202']]); c.fillRect(-300, -300, W + 600, HT + 600);
    const p = U.lin(0.1, d, lt);
    c.save(); c.shadowColor = 'rgba(255,40,40,0.9)'; c.shadowBlur = 30; c.lineCap = 'round';
    c.strokeStyle = 'rgba(232,50,42,0.25)'; c.lineWidth = 26; c.beginPath(); c.arc(540, 820, 280, 0, TAU); c.stroke();
    c.strokeStyle = COL.red; c.beginPath(); c.arc(540, 820, 280, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p * 0.05)); c.stroke();
    H.text(c, '60', 540, 800, '700 220px Orbitron, "Share Tech Mono", monospace', '#ff3b30');
    c.restore();
    H.text(c, 'SECONDS', 540, 960, '800 40px Montserrat, Arial', '#f4f4f4');
  };

  S.motelWide = (c, t, lt, d) => {
    cam(c, t, U.lerp(540, 600, lt / d), U.lerp(1100, 1150, lt / d), U.lerp(1.0, 1.12, lt / d));
    sky(c, -600, -600, W + 1200, 1600, [800, 330]);
    c.fillStyle = '#120f1c'; c.beginPath(); c.moveTo(-600, 900); for (let x = -600; x <= W + 600; x += 60) c.lineTo(x, 880 - U.noise(x * 0.01) * 80); c.lineTo(W + 600, 1000); c.lineTo(-600, 1000); c.fill();
    motel(c, t, { tv: true });
    lot(c);
    car(c, 260, 1700, 0.75, t);
    neonSign(c, 930, 1300, 0.9, t);
  };

  S.room = (c, t, lt, d, v) => {
    cam(c, t, 540, 1000, U.lerp(1.0, 1.06, lt / d));
    roomInterior(c, t);
    const fl = tvFlicker(t);
    const lit = `rgba(120,180,255,${0.18 * fl})`;
    const drop = v === 'drop';
    c.save(); c.translate(360, 900); c.scale(1.35, 1.35);
    M.sister(c, { arms: 'remote', remote: !drop, mouth: drop ? 'o' : 'flat', brow: drop ? 1 : 0.3, lx: drop ? 0.7 : 0.1, lit, blink: !drop && Math.abs(lt - 1.3) < 0.07 });
    c.restore();
    c.save(); c.translate(740, 1000); c.scale(1.3, 1.3);
    M.kid(c, { arms: 'knees', mouth: drop ? 'o' : v === 'fine' ? 'smile' : 'flat', brow: drop ? 1 : 0, lx: drop ? 0.7 : 0, lit });
    c.restore();
    if (drop) { // the remote tumbling
      const p = U.easeIn(U.lin(TL.remoteDrop, TL.remoteDrop + 0.7, t));
      c.save(); c.translate(360 + p * 60, 1170 + p * 800); c.rotate(p * 5);
      H.rr(c, -24, -60, 48, 120, 10, '#2a2a30'); H.circ(c, 0, -34, 6, '#c33'); c.restore();
    }
    // lamp
    H.rr(c, 970, 840, 80, 120, 8, '#d9c7a0'); H.poly(c, [[930, 760], [1090, 760], [1060, 850], [960, 850]], '#f6e3b4');
    glow(c, 1010, 800, 380, 'rgba(255,214,140,A)', 0.35);
    // TV light from the camera
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 540, 1900, 100, 1500, [[0, `rgba(110,170,255,${0.25 * fl})`], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, W, HT); c.restore();
  };

  S.car = (c, t, lt, d) => {
    cam(c, t, U.lerp(480, 600, lt / d), 1150, 1.15);
    sky(c, -600, -600, W + 1200, 1700, [250, 300]);
    c.fillStyle = '#120f1c'; c.fillRect(-600, 1050, W + 1200, 100);
    lot(c, 1100);
    // neon reflections in a puddle
    H.ell(c, 600, 1600, 300, 50, 'rgba(255,79,154,0.18)');
    car(c, 540, 1480, 1.15, t);
    neonSign(c, 1180, 1180, 0.8, t);
  };

  S.tv = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.12, lt / d));
    c.fillStyle = '#2a1a12'; c.fillRect(-300, -300, W + 600, HT + 600);
    H.rr(c, 40, 1300, 1000, 600, 0, '#4a2e1c');
    H.rr(c, 140, 560, 800, 740, 60, '#3a3530'); H.rr(c, 200, 620, 560, 460, 50, '#111');
    // static
    c.save(); c.beginPath(); c.roundRect(220, 640, 520, 420, 40); c.clip();
    const f = Math.floor(t * 30);
    for (let i = 0; i < 900; i++) { const v = U.hash(f * 977 + i) * 255 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(220 + (i % 30) * 18, 640 + Math.floor(i / 30) * 14, 18, 14); }
    c.fillStyle = 'rgba(120,180,255,0.15)'; c.fillRect(220, 640, 520, 420);
    c.restore();
    H.circ(c, 850, 760, 34, '#777'); H.circ(c, 850, 880, 34, '#777'); for (let i = 0; i < 6; i++) H.rr(c, 810, 960 + i * 22, 80, 8, 3, '#222');
    H.line(c, 400, 560, 300, 360, '#999', 8); H.line(c, 680, 560, 800, 380, '#999', 8);
    glow(c, 480, 850, 700, 'rgba(160,210,255,A)', 0.35 * tvFlicker(t));
  };

  S.bolt = (c, t, lt, d) => {
    cam(c, t, 540, 960, 1.0);
    c.fillStyle = COL.door; c.fillRect(-300, -300, W + 600, HT + 600);
    H.rr(c, 100, 200, 600, 600, 10, COL.doorDark); H.rr(c, 100, 900, 600, 900, 10, COL.doorDark);
    H.rr(c, 760, -300, 400, HT + 600, 0, COL.trim);
    // deadbolt: thumb turn rotates, bolt slides into the frame
    const p = U.easeOut(U.lin(0.1, 0.6, lt));
    H.circ(c, 560, 900, 110, '#c9a34a'); c.save(); c.translate(560, 900); c.rotate(-Math.PI / 2 * (1 - p)); H.rr(c, -22, -90, 44, 180, 18, '#e2c470'); c.restore();
    H.rr(c, 640 + p * 140, 880, 140, 40, 8, '#b9bec6');
    H.rr(c, 820, 860, 90, 80, 8, '#9aa0aa');
    glow(c, 600, 900, 400, 'rgba(255,230,170,A)', 0.2);
  };

  S.blinds = (c, t, lt, d) => {
    const e = U.easeInOut(lt / d);
    cam(c, t, U.lerp(540, 330, e), U.lerp(960, 1000, e), U.lerp(1.0, 1.9, e));
    sky(c, -600, -600, W + 1200, 1500, [900, 250]);
    lot(c, 1250);
    // the office across the lot
    H.rr(c, 40, 760, 600, 500, 6, '#c4a497'); H.poly(c, [[10, 760], [670, 760], [640, 700], [40, 700]], COL.roof);
    H.rr(c, 110, 860, 330, 260, 4, '#f5e7b8'); glow(c, 275, 990, 500, 'rgba(255,235,170,A)', 0.4);
    H.text(c, 'OFFICE', 340, 735, '800 40px Montserrat, Arial', '#ffd27a');
    H.rr(c, 470, 900, 120, 360, 4, '#3a3a40');
    // the blinds we're peeking through
    c.setTransform(1, 0, 0, 1, 0, 0);
    const gap = U.lerp(70, 110, U.smooth(0, 0.6, lt));
    c.fillStyle = '#d9d2c2';
    for (let y = -20; y < HT; y += 150) { c.fillRect(0, y, W, 150 - gap); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, y + 150 - gap - 10, W, 10); c.fillStyle = '#d9d2c2'; }
    H.rr(c, 540 + 300, 0, 10, HT, 0, '#bfb8a8');
    c.fillStyle = 'rgba(0,0,10,0.35)'; c.fillRect(0, 0, W, HT);
  };

  // inside the lit office window (seen from across the lot)
  function officeWindow(c, t, o = {}) {
    c.fillStyle = '#c4a497'; c.fillRect(-400, -400, W + 800, HT + 800);
    const wx = 60, wy = 380, ww = 960, wh = 1160;
    c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
    const fl = o.flicker ? (U.hash(Math.floor(t * 16)) > 0.35 ? 1 : 0.35) : 1;
    c.fillStyle = `rgba(${Math.round(240 * fl)},${Math.round(226 * fl)},${Math.round(180 * fl)},1)`; c.fillRect(wx, wy, ww, wh);
    // key rack
    H.rr(c, 120, 480, 360, 300, 10, '#7a5232');
    for (let i = 0; i < 12; i++) { const kx = 160 + (i % 4) * 80, ky = 530 + Math.floor(i / 4) * 80; H.circ(c, kx, ky, 6, '#333'); if (i !== 8) { H.line(c, kx, ky, kx, ky + 34, '#c9a34a', 6); H.rr(c, kx - 12, ky + 34, 24, 30, 4, '#d84a3a'); } }
    // clerk behind the counter
    const fall = U.easeIn(U.lin(TL.stab + 0.25, TL.stab + 0.9, t));
    if (o.clerk !== false && fall < 1) { c.save(); c.translate(680, 1000 + fall * 600); c.rotate(fall * 0.6); c.scale(1.2, 1.2); M.clerk(c, { arms: t > TL.stab - 0.8 && t < TL.stab + 0.3 ? 'up' : 'desk', mouth: t > TL.stab - 0.8 ? 'scream' : 'flat', brow: t > TL.stab - 0.8 ? 1 : 0 }); c.restore(); }
    if (o.killer) o.killer();
    // counter + bell
    H.rr(c, 60, 1200, 960, 340, 0, '#6b4a2e'); H.rr(c, 60, 1190, 960, 26, 0, '#8a6342');
    H.ell(c, 420, 1188, 40, 12, '#c9a34a'); H.circ(c, 420, 1166, 22, '#d9b65a');
    // blood on the glass
    const sp = U.easeOut(U.lin(TL.stab + 0.02, TL.stab + 0.3, t));
    if (sp > 0) for (let i = 0; i < 24; i++) { const a = U.hash(i * 3.3) * TAU, r = (40 + U.hash(i * 5.1) * 280) * sp; H.circ(c, 640 + Math.cos(a) * r, 860 + Math.sin(a) * r * 0.8, (4 + U.hash(i) * 14), M.PAL.blood); }
    c.restore();
    c.strokeStyle = '#e9e1cf'; c.lineWidth = 30; c.strokeRect(wx, wy, ww, wh);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(wx, wy + 500); c.lineTo(wx + 400, wy); c.lineTo(wx + 520, wy); c.lineTo(wx, wy + 640); c.fill();
  }

  S.office = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.1, lt / d));
    const walkIn = U.easeOut(U.lin(TL.shots.find((s) => s[2] === 'office')[0], TL.stab - 1.0, t));
    officeWindow(c, t, {
      flicker: t > TL.stab + 0.6,
      killer: () => {
        const raise = U.easeOut(U.lin(TL.stab - 0.9, TL.stab - 0.15, t)), stab = U.easeIn(U.lin(TL.stab - 0.08, TL.stab + 0.1, t)), lower = U.smooth(TL.stab + 1.2, TL.stab + 1.8, t);
        c.save(); c.translate(U.lerp(1250, 330, walkIn), 1580); c.scale(0.95, 0.95);
        M.maskedMan(c, { back: false, walking: walkIn < 1, walk: t * 1.1, arm: U.clamp(raise - stab * 0.75 - lower * 0.2), blood: U.smooth(TL.stab, TL.stab + 0.3, t), t });
        c.restore();
      },
    });
    const fl = U.clamp(1 - (t - TL.stab) / 0.35);
    if (t >= TL.stab && fl > 0) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(200,10,10,${0.55 * fl})`; c.fillRect(0, 0, W, HT); }
  };

  S.maskTurn = (c, t, lt, d) => {
    const z = U.lerp(1.0, 2.6, U.easeInOut(U.lin(TL.maskStare - 0.4, TL.maskStare + 0.5, t)));
    cam(c, t, U.lerp(540, 380, U.clamp(z - 1)), U.lerp(960, 760, U.clamp(z - 1)), z);
    officeWindow(c, t, { clerk: false, flicker: true, killer: () => {
      const turn = U.easeInOut(U.lin(0.2, 1.4, lt));
      c.save(); c.translate(380, 1700); c.scale(1.05, 1.05);
      M.maskedMan(c, { back: turn < 0.5, arm: 0, blood: 1, t });
      c.restore();
    } });
  };

  S.remote = (c, t) => {
    cam(c, t, 540, 960, 1.05);
    c.fillStyle = '#d7e4ea'; c.fillRect(-300, -300, W + 600, HT + 600);
    c.strokeStyle = '#a9bcc6'; c.lineWidth = 6;
    for (let x = -300; x < W + 300; x += 180) { c.beginPath(); c.moveTo(x, -300); c.lineTo(x, HT + 300); c.stroke(); }
    for (let y = -300; y < HT + 300; y += 180) { c.beginPath(); c.moveTo(-300, y); c.lineTo(W + 300, y); c.stroke(); }
    const e = t - TL.remoteCrack;
    if (e < 0) { c.save(); c.translate(540, U.lerp(-200, 960, U.easeIn(U.clamp(1 + e / 0.3)))); c.rotate(0.6); H.rr(c, -60, -170, 120, 340, 24, '#2a2a30'); c.restore(); return; }
    c.save(); c.translate(540, 960); c.rotate(0.6 + Math.min(e, 0.2) * 0.8);
    H.rr(c, -60, -170, 120, 340, 24, '#2a2a30');
    for (let i = 0; i < 8; i++) H.circ(c, (i % 2 ? 22 : -22), -120 + Math.floor(i / 2) * 50, 12, i === 0 ? '#c33' : '#777');
    c.strokeStyle = '#d8d8d8'; c.lineWidth = 4; c.beginPath(); c.moveTo(-60, 20); c.lineTo(-10, 40); c.lineTo(20, 10); c.lineTo(60, 50); c.stroke();
    c.restore();
    // batteries roll out, back cover flies off
    const p = U.easeOut(U.clamp(e / 0.8));
    for (let i = 0; i < 2; i++) { c.save(); c.translate(540 + (i ? 1 : -1) * p * 280, 1080 + p * (i ? 120 : 200)); c.rotate(p * 6 * (i ? 1 : -1)); H.rr(c, -22, -60, 44, 120, 10, '#c9a34a'); H.rr(c, -22, -60, 44, 26, 6, '#333'); c.restore(); }
    c.save(); c.translate(540 - p * 330, 900 - p * 260); c.rotate(-p * 3); H.rr(c, -55, -70, 110, 140, 12, '#34343a'); c.restore();
  };

  S.tvOff = (c, t, lt, d) => {
    cam(c, t, 540, 960, 1.0);
    c.fillStyle = '#2a1a12'; c.fillRect(-300, -300, W + 600, HT + 600);
    H.rr(c, 140, 560, 800, 740, 60, '#3a3530'); H.rr(c, 200, 620, 560, 460, 50, '#111');
    const off = U.lin(TL.tvOff, TL.tvOff + 0.35, t);
    c.save(); c.beginPath(); c.roundRect(220, 640, 520, 420, 40); c.clip();
    if (off < 1) {
      const sy = off < 0.6 ? 1 - off / 0.6 * 0.98 : 0.02, sx = off < 0.6 ? 1 : 1 - (off - 0.6) / 0.4;
      c.save(); c.translate(480, 850); c.scale(sx, sy);
      const f = Math.floor(t * 30);
      for (let i = 0; i < 900; i++) { const v = U.hash(f * 977 + i) * 255 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(-260 + (i % 30) * 18, -210 + Math.floor(i / 30) * 14, 18, 14); }
      if (off > 0) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(-260, -210, 520, 420); }
      c.restore();
    }
    c.restore();
    if (off < 1) glow(c, 480, 850, 700, 'rgba(160,210,255,A)', 0.35 * (1 - off));
    if (t >= TL.shots.find((s) => s[2] === 'tvOff')[0]) tag(c, 'RULE #1', 540, 380, -0.05);
    if (off >= 1) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgba(2,3,8,0.55)'; c.fillRect(0, 0, W, HT); }
  };

  S.lamp = (c, t, lt) => {
    cam(c, t, 620, 900, 1.25);
    roomInterior(c, t);
    const on = t < TL.lampOff ? 1 : 0;
    H.rr(c, 900, 960, 200, 260, 10, '#5a3a20');
    H.rr(c, 970, 840, 80, 120, 8, '#d9c7a0'); H.poly(c, [[920, 740], [1100, 740], [1068, 846], [952, 846]], on ? '#f6e3b4' : '#7a6a4c');
    if (on) glow(c, 1010, 790, 600, 'rgba(255,214,140,A)', 0.5);
    // the sister's hand reaches for the switch
    const p = U.easeOut(U.lin(TL.lampOff - 0.8, TL.lampOff - 0.05, t));
    H.limb(c, [[300, 1500], [U.lerp(500, 900, p), U.lerp(1200, 900, p)]], M.PAL.hoodie, 70);
    H.circ(c, U.lerp(500, 900, p), U.lerp(1200, 900, p), 34, M.PAL.skin);
    if (!on) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(2,3,10,${0.82 * U.lin(TL.lampOff, TL.lampOff + 0.06, t)})`; c.fillRect(0, 0, W, HT); }
  };

  S.darkRow = (c, t, lt) => {
    cam(c, t, 540 + lt * 20, 1100, 1.25);
    sky(c, -600, -600, W + 1200, 1600, [880, 300]);
    motel(c, t, { tv: false });
    lot(c);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgba(4,6,16,0.35)'; c.fillRect(0, 0, W, HT);
    cam(c, t, 540 + lt * 20, 1100, 1.25);
    const step = Math.floor(lt / 0.55), f = U.easeOut(U.clamp((lt % 0.55) / 0.2));
    const pos = (s) => -170 + (Math.floor(U.hash(s * 9.1) * 5)) * 300 * 0.7 + 160 * 0.7 + 30;
    brackets(c, U.lerp(pos(step), pos(step + 1), f), 1120, 140, 150);
  };

  S.walkway = (c, t, lt, d) => {
    const [a] = TL.shots.find((s) => s[2] === 'walkway');
    // the camera pans left along the doors with him: 12 -> 11 -> 10 -> 9
    const x = U.lerp(1500, 420, U.easeInOut(U.lin(a, TL.doorChecks[2] + 1.2, t)));
    cam(c, t, x, 960, 1.0);
    c.fillStyle = COL.sky0; c.fillRect(-600, -600, 3000, 3000);
    H.poly(c, [[-600, 520], [2400, 520], [2400, 440], [-600, 440]], COL.roof);
    for (let i = 0; i < 4; i++) { // 9 10 11 12 left to right
      c.save(); c.translate(-80 + i * 520, 560); c.scale(1.15, 1.15); roomFront(c, 0, 0, 9 + i); c.restore();
    }
    for (let i = 0; i < 9; i++) H.rr(c, -260 + i * 300, 520, 18, 760, 3, COL.trim);
    c.fillStyle = '#58494a'; c.fillRect(-600, 1200, 3000, 60); c.fillStyle = '#2a2a33'; c.fillRect(-600, 1260, 3000, 800);
    // him, walking left, stopping at each door
    const doorX = (num) => -80 + (num - 9) * 520 + 280;
    let kx = U.lerp(2100, doorX(9) + 120, U.lin(a, TL.doorChecks[2] + 1.6, t));
    TL.doorChecks.forEach((tc, i) => { const n = 12 - i; if (t > tc - 0.3 && t < tc + 0.5) kx = Math.min(kx, doorX(n) + 260); });
    c.save(); c.translate(kx, 1300); c.scale(-0.95, 0.95);
    M.maskedMan(c, { walking: true, walk: t * 1.2, arm: 0.1, blood: 1, t });
    c.restore();
    TL.doorChecks.forEach((tc, i) => { const n = 12 - i; circleMark(c, doorX(n) - 195, 680, 70, U.lin(tc, tc + 0.35, t), null); });
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = H.lg(c, 0, 0, 0, HT, [[0, 'rgba(0,0,10,0.3)'], [1, 'rgba(0,0,10,0.1)']]); c.fillRect(0, 0, W, HT);
  };

  S.handle = (c, t, lt) => {
    cam(c, t, 540, 960, 1.0);
    c.fillStyle = '#1d3f42'; c.fillRect(-300, -300, W + 600, HT + 600);
    H.rr(c, 760, -300, 400, HT + 600, 0, '#9a9488');
    // a thin line of light under the door from the walkway lamp
    glow(c, 540, 1900, 600, 'rgba(255,230,170,A)', 0.25);
    const [t0, t1] = TL.handleTurn;
    const turn = t < t1 ? U.easeInOut(U.lin(t0, t1 - 0.1, t)) * 0.75 : 0.75 * Math.exp(-(t - t1) * 14) * Math.cos((t - t1) * 40);
    H.circ(c, 560, 960, 120, '#b9bec6'); H.circ(c, 560, 960, 70, '#d5d9de');
    c.save(); c.translate(560, 960); c.rotate(turn); H.rr(c, -40, -36, 330, 72, 36, '#e2e5ea'); H.rr(c, -40, -36, 330, 20, 10, '#ffffff'); c.restore();
    H.circ(c, 560, 1240, 50, '#c9a34a'); H.rr(c, 552, 1210, 16, 50, 6, '#3a2a10');
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgba(2,4,10,0.35)'; c.fillRect(0, 0, W, HT);
  };

  S.key = (c, t, lt) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.25, U.smooth(TL.keyIn + 1.2, TL.keyIn + 2.4, t)));
    c.fillStyle = COL.door; c.fillRect(-300, -300, W + 600, HT + 600);
    glow(c, 540, 300, 900, 'rgba(255,230,170,A)', 0.25);
    H.circ(c, 600, 960, 110, '#c9a34a'); H.circ(c, 600, 960, 60, '#a07a30'); H.rr(c, 592, 920, 16, 80, 6, '#2a1a08');
    const p = U.easeInOut(U.lin(TL.keyIn - 0.6, TL.keyIn, t));
    const kx = U.lerp(1000, 640, p);
    // gloved hand + key + tag
    c.save(); c.translate(kx, 960);
    H.rr(c, -40, -12, 120, 24, 8, '#d9b65a'); H.circ(c, 110, 0, 40, '#d9b65a'); H.circ(c, 110, 0, 16, COL.door);
    c.save(); c.translate(160, 40); c.rotate(0.5 + Math.sin(t * 4) * 0.1);
    H.line(c, 0, -40, 0, 40, '#999', 6); H.rr(c, -60, 40, 120, 170, 16, '#d84a3a'); H.text(c, 'OFFICE', 0, 110, '900 30px Montserrat, Arial', '#fff'); H.text(c, '9', 0, 160, '900 40px Montserrat, Arial', '#fff');
    c.restore();
    H.rr(c, 120, -90, 300, 180, 80, M.PAL.glove); H.limb(c, [[380, 0], [900, 300]], M.PAL.overalls, 150);
    c.restore();
  };

  S.sisterClose = (c, t, lt, d) => {
    cam(c, t, 540, 1000, U.lerp(1.0, 1.08, lt / d));
    c.fillStyle = H.lg(c, 0, 0, 0, HT, [[0, '#101826'], [1, '#2a0d14']]); c.fillRect(-300, -300, W + 600, HT + 600);
    const pointing = t > TL.shots.find((s) => s[2] === 'sisterClose')[0] + 1.3;
    c.save(); c.translate(500, 1250); c.scale(2.6, 2.6);
    M.sister(c, { arms: pointing ? 'point' : 'down', point: [230, -40], mouth: 'flat', brow: 1, lx: pointing ? 1 : 0, lit: 'rgba(80,110,200,0.15)' });
    c.restore();
    tag(c, 'RULE #2', 540, 330, -0.05);
  };

  S.bathroom = (c, t, lt, d) => {
    const e = U.easeInOut(lt / d);
    cam(c, t, U.lerp(540, 600, e), U.lerp(1000, 620, e), U.lerp(1.0, 1.6, e));
    c.fillStyle = '#c8d7dd'; c.fillRect(-300, -300, W + 600, HT + 600);
    c.strokeStyle = '#a3b6bf'; c.lineWidth = 4;
    for (let x = -300; x < W + 300; x += 90) { c.beginPath(); c.moveTo(x, -300); c.lineTo(x, HT + 300); c.stroke(); }
    for (let y = -300; y < HT + 300; y += 90) { c.beginPath(); c.moveTo(-300, y); c.lineTo(W + 300, y); c.stroke(); }
    // the tiny window up high
    const open = U.easeOut(U.lin(TL.windowOpen, TL.windowOpen + 0.5, t));
    H.rr(c, 440, 460, 320, 220, 8, '#e9e1cf');
    c.fillStyle = '#0d1020'; c.fillRect(460, 480, 280, 180);
    for (let i = 0; i < 12; i++) H.circ(c, 470 + U.hash(i) * 260, 490 + U.hash(i * 3) * 160, 2, 'rgba(255,255,255,0.6)');
    c.save(); c.translate(460, 480); c.transform(1, 0, 0, 1 - open * 0.85, 0, 0); c.fillStyle = 'rgba(200,215,225,0.85)'; c.fillRect(0, 0, 280, 180); c.restore();
    // tub + toilet
    H.rr(c, -100, 1200, 760, 360, 40, '#f2f2ee'); H.rr(c, 760, 1150, 200, 300, 40, '#f2f2ee');
    c.save(); c.translate(260, 1150); c.scale(1.3, 1.3);
    M.sister(c, { back: true, arms: 'reach', point: [190, -360] });
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgba(5,8,20,0.45)'; c.fillRect(0, 0, W, HT);
  };

  S.escape = (c, t, lt, d) => {
    cam(c, t, 540, 960, U.lerp(1.0, 1.08, lt / d));
    sky(c, -600, -600, W + 1200, 1800, [820, 260]);
    // back wall of the motel
    c.fillStyle = COL.stuccoDark; c.fillRect(-300, 520, W + 600, 1000);
    H.rr(c, 360, 640, 360, 260, 8, '#5a4a48'); c.fillStyle = '#0a0a10'; c.fillRect(380, 660, 320, 220);
    // you squeezing out, the sister's arms behind pushing
    const out = U.easeOut(U.lin(TL.push, TL.push + 1.6, t));
    c.save(); c.beginPath(); c.rect(-300, -300, W + 600, 900 + 300); c.rect(380, 660, 320, 240); c.clip('evenodd'); c.restore();
    const drawKid = () => {
      c.save(); c.translate(540, 820 + out * 520); c.rotate(U.lerp(-1.2, -0.2, out)); c.scale(1.1, 1.1);
      M.kid(c, { arms: 'up', mouth: 'o', brow: 1, legs: out > 0.6 });
      c.restore();
      if (out < 0.8) { H.limb(c, [[480, 680], [560, 760]], M.PAL.hoodie, 40); H.limb(c, [[620, 680], [640, 760]], M.PAL.hoodie, 40); }
    };
    // the corn in front
    cornRow(c, 1700, 26, 380, 14, t, COL.cornDark, 2);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgba(5,8,25,0.25)'; c.fillRect(0, 0, W, HT);
    cam(c, t, 540, 960, U.lerp(1.0, 1.08, lt / d));
    drawKid();
    cornRow(c, 2050, 12, 420, 20, t, COL.corn, 5, -500, 260);
    cornRow(c, 2050, 10, 420, 20, t, COL.corn, 6, 820, W + 500);
  };

  S.cornRun = (c, t, lt) => {
    const bob = Math.abs(Math.sin(t * 9)) * 26;
    cam(c, t, 540 + Math.sin(t * 4.5) * 30, 960 + bob, 1.05, Math.sin(t * 4.5) * 0.03);
    sky(c, -600, -600, W + 1200, 1600, [700, 300]);
    // layers of corn rushing past (parallax)
    for (const [y, n, h, col, sp, seed] of [[1150, 40, 420, '#1f2210', 200, 1], [1450, 26, 640, COL.cornDark, 600, 2], [1800, 14, 900, COL.corn, 1400, 3], [2150, 7, 1200, COL.cornLight, 2600, 4]]) {
      const off = (lt * sp) % 2400;
      c.save(); c.translate(-off, 0); cornRow(c, y, n, h, 30, t, col, seed, -500, 2400); cornRow(c, y, n, h, 30, t, col, seed, 1900, 4800); c.restore();
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = H.rg(c, W / 2, HT / 2, 300, 1200, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,10,0.6)']]); c.fillRect(0, 0, W, HT);
  };

  S.doorBang = (c, t, lt, d) => {
    cam(c, t, 540, 1100, U.lerp(1.0, 1.12, lt / d));
    sky(c, -600, -600, W + 1200, 1500, [850, 280]);
    cornRow(c, 1950, 30, 300, 16, t, COL.cornDark, 7);
    c.save(); c.translate(300, 820); c.scale(1.05, 1.05);
    const open = U.easeOut(U.lin(TL.doorBang, TL.doorBang + 0.18, t));
    roomFront(c, 0, 0, 9, { open });
    if (open > 0.2) { // his silhouette in the doorway
      c.save(); c.translate(115, 560); c.scale(0.42, 0.42); c.globalAlpha = U.clamp((open - 0.2) * 2);
      c.fillStyle = '#0b0b0e'; c.beginPath(); c.ellipse(0, -900, 90, 110, 0, 0, TAU); c.fill(); c.fillRect(-150, -800, 300, 400); c.fillRect(-120, -400, 240, 400);
      c.restore();
    }
    c.restore();
    neonSign(c, 980, 1000, 0.7, t);
    cornRow(c, 2150, 14, 420, 22, t, COL.corn, 9);
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgba(5,8,25,0.3)'; c.fillRect(0, 0, W, HT);
  };

  S.cornStalk = (c, t, lt, d) => {
    const rev = U.easeOut(U.lin(TL.maskReveal - 0.15, TL.maskReveal + 0.25, t));
    cam(c, t, 540, 960, U.lerp(1.0, 1.1, lt / d) + rev * 0.15);
    sky(c, -600, -600, W + 1200, 1600, [300, 260]);
    cornRow(c, 1300, 40, 700, 10, t, '#2e2c12', 11);
    cornRow(c, 1600, 30, 1000, 14 + rev * 30, t, COL.cornDark, 12);
    if (rev <= 0) {
      // something moving deep in the corn
      const mx = 200 + (lt / d) * 700;
      for (let i = 0; i < 6; i++) H.line(c, mx + i * 20 - 60, 900, mx + i * 20 - 60 + Math.sin(t * 20 + i) * 30, 600, '#4a4720', 10);
    }
    const drawMask = () => { c.save(); c.translate(540, 980 + (1 - rev) * 220); c.scale(1.2 + rev * 0.55, 1.2 + rev * 0.55); M.mask(c, { t, blood: 1, look: 0 }); c.restore(); };
    if (rev <= 0) { cornRow(c, 2000, 16, 1100, 26, t, COL.corn, 13); cornRow(c, 2200, 10, 1300, 40, t, COL.cornLight, 14); }
    else { // the front stalks are pushed aside to the edges
      cornRow(c, 2000, 6, 1100, 26 + rev * 60, t, COL.corn, 13, -500, 180);
      cornRow(c, 2000, 6, 1100, -26 - rev * 60, t, COL.corn, 15, 900, W + 500);
      drawMask();
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = H.rg(c, W / 2, HT / 2, 300, 1200, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,10,0.65)']]); c.fillRect(0, 0, W, HT);
  };

  /* ============================== HUD / CAPTIONS / POST ============================== */
  function hud(c, t) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (t >= TL.shots[3][0]) {
      H.circ(c, 72, 108, 22, '#f2e6b0'); H.circ(c, 84, 100, 20, 'rgba(10,10,14,1)'); // crescent moon
      H.text(c, t < TL.clockFlip ? '2:47' : '2:48', 112, 110, '700 46px Orbitron, "Share Tech Mono", monospace', '#ff3b30', 'left');
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
    const s = 1 + 0.18 * (1 - U.easeOut(U.clamp((t - cap[0]) / 0.14)));
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.font = '900 78px Montserrat, "Arial Black", Arial, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    const sp = c.measureText(' ').width;
    const total = words.reduce((a, wd) => a + c.measureText(wd.w).width, 0) + sp * (words.length - 1);
    const k = Math.min(1, 940 / total);
    c.translate(540, 1360); c.scale(s * k, s * k);
    let x = -total / 2;
    for (const wd of words) {
      c.lineJoin = 'round'; c.lineWidth = 14; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(wd.w, x, 0);
      c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 16; c.shadowOffsetY = 6; c.fillStyle = wd.col; c.fillText(wd.w, x, 0);
      c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
      x += c.measureText(wd.w).width + sp;
    }
    c.restore();
  }
  function glitch(c, t) {
    for (const s of TL.glitches) {
      const e = t - s; if (e < 0 || e > 0.3) continue;
      const a = 1 - e / 0.3, f = Math.floor(t * 30);
      Tc.setTransform(1, 0, 0, 1, 0, 0); Tc.globalCompositeOperation = 'copy'; Tc.drawImage(c.canvas, 0, 0);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 * a; c.drawImage(T, 22 * a, 0); c.drawImage(T, -22 * a, 6);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      for (let i = 0; i < 9; i++) { const y = Math.floor(U.hash(f * 7 + i) * HT), h = 20 + U.hash(i * 3 + f) * 90; c.drawImage(T, 0, y, W, h, (U.hash(i * 11 + f) - 0.5) * 120 * a, y, W, h); }
      c.fillStyle = `rgba(255,0,60,${0.12 * a})`; c.fillRect(0, 0, W, HT);
      c.restore();
    }
  }
  function post(c, t) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    const v = c.createRadialGradient(W / 2, HT / 2, HT * 0.3, W / 2, HT / 2, HT * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = v; c.fillRect(0, 0, W, HT);
    const f = Math.floor(t * TL.FPS);
    for (let i = 0; i < 260; i++) { c.fillStyle = U.hash(i + f) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; c.fillRect(U.hash(f * 13 + i) * W, U.hash(f * 7 + i * 3) * HT, 2, 2); }
    const k = Math.max(1 - U.clamp(t / 0.25), U.clamp((t - (TL.DURATION - 0.4)) / 0.4));
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
    post(c, t); glitch(c, t); hud(c, t); captions(c, t);
    c.restore();
  }
  g.Film = { render, init };
})(window);
