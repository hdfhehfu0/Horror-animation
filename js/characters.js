/* =========================================================================
   ONE MINUTE — characters.js
   Flat-vector cast in the style of the reference: the grinning killer,
   Mum (blue puffer, hair bun), the girl (pink star pyjamas, pigtails),
   the wife across the estate, and the POV hand. Local units; callers
   translate/scale.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const TAU = Math.PI * 2;

  const PAL = {
    skin: '#f3c8a2', skinShade: '#dba37e', blush: 'rgba(235,120,110,0.45)',
    mumHair: '#5a3524', mumHairHi: '#7a4a32', coat: '#3b5c9e', coatDark: '#2c477e', coatLight: '#5272b5',
    girlHair: '#e7a93f', girlHairDark: '#c98a2a', pj: '#ef9cc4', pjDark: '#d77fab', star: '#ffd34d', tie: '#e8507a',
    kSkin: '#dcd8c8', kSkinShade: '#b9b4a2', kHair: '#8e8a80', sweater: '#d8c9a6', sweaterDark: '#b9a882',
    trousers: '#3a3a40', blood: '#b3121b', bloodDark: '#7a0a10', steel: '#c9ced6',
  };

  /* ------------------------------ helpers ------------------------------ */
  const H = {
    rr(c, x, y, w, h, r, f) { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = f; c.fill(); },
    circ(c, x, y, r, f) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = f; c.fill(); },
    ell(c, x, y, rx, ry, f, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); c.fillStyle = f; c.fill(); },
    poly(c, pts, f) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = f; c.fill(); },
    line(c, x0, y0, x1, y1, col, w, cap = 'round') { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = w; c.lineCap = cap; c.stroke(); },
    limb(c, pts, col, w) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); },
    lg(c, x0, y0, x1, y1, stops) { const gr = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, s]) => gr.addColorStop(o, s)); return gr; },
    rg(c, x, y, r0, r1, stops) { const gr = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, s]) => gr.addColorStop(o, s)); return gr; },
    star(c, x, y, r, f) {
      c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      c.closePath(); c.fillStyle = f; c.fill();
    },
    text(c, s, x, y, font, col, align = 'center') { c.font = font; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y); },
  };

  // simple face used by mum / girl / wife.  o: { mouth:'smile'|'o'|'flat'|'scream', lx, ly, brow (0 calm .. 1 worried), blink, big }
  function face(c, r, o = {}) {
    const lx = (o.lx || 0) * r * 0.07, ly = (o.ly || 0) * r * 0.05;
    const ey = -r * 0.02, ex = r * 0.36, big = o.big ? 1.25 : 1;
    // blush
    H.ell(c, -r * 0.5, r * 0.3, r * 0.17, r * 0.1, PAL.blush);
    H.ell(c, r * 0.5, r * 0.3, r * 0.17, r * 0.1, PAL.blush);
    for (const s of [-1, 1]) {
      const x = s * ex;
      if (o.blink) { H.line(c, x - r * 0.12, ey, x + r * 0.12, ey, '#2a1a14', r * 0.04); continue; }
      H.ell(c, x, ey, r * 0.17 * big, r * 0.15 * big, '#fffaf2');
      H.circ(c, x + lx, ey + ly, r * 0.1 * big, '#2a1a14');
      H.circ(c, x + lx + r * 0.035, ey + ly - r * 0.04, r * 0.03 * big, '#fff');
      // upper lid (half-lidded when worried)
      c.beginPath(); c.ellipse(x, ey, r * 0.18 * big, r * 0.16 * big, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.strokeStyle = '#2a1a14'; c.lineWidth = r * 0.035; c.stroke();
      // brows
      const w = o.brow || 0;
      H.line(c, x - s * r * 0.16, ey - r * 0.27 - w * r * 0.08, x + s * r * 0.14, ey - r * 0.3 + w * r * 0.05, '#3a2418', r * 0.045);
    }
    // nose
    H.ell(c, 0, r * 0.2, r * 0.05, r * 0.035, 'rgba(160,90,60,0.45)');
    const m = o.mouth || 'smile';
    if (m === 'smile') { c.beginPath(); c.arc(0, r * 0.33, r * 0.16, 0.2, Math.PI - 0.2); c.strokeStyle = '#7a3428'; c.lineWidth = r * 0.04; c.lineCap = 'round'; c.stroke(); }
    else if (m === 'flat') H.line(c, -r * 0.1, r * 0.45, r * 0.1, r * 0.45, '#7a3428', r * 0.04);
    else if (m === 'o') { H.ell(c, 0, r * 0.47, r * 0.09, r * 0.12, '#5a1f1a'); H.ell(c, 0, r * 0.53, r * 0.05, r * 0.04, '#d9666a'); }
    else if (m === 'scream') { H.ell(c, 0, r * 0.5, r * 0.15, r * 0.22, '#4a1414'); H.ell(c, 0, r * 0.62, r * 0.08, r * 0.06, '#d9666a'); }
  }

  /* ------------------------------ MUM ------------------------------
     origin = neck base. Head centre at (0,-100), r 82.
     o: { back, mouth, lx, ly, brow, blink, arms:'mug'|'down'|'hug'|'up'|'reach', reach:[x,y], mug:true, wind }  */
  function mum(c, o = {}) {
    const r = 82, hy = -100, wind = o.wind || 0;
    c.save();
    // body: puffer coat
    c.beginPath();
    c.moveTo(-120, 20); c.quadraticCurveTo(-118, -6, -60, -10); c.lineTo(60, -10); c.quadraticCurveTo(118, -6, 120, 20);
    c.lineTo(140, 330); c.lineTo(-140, 330); c.closePath();
    c.fillStyle = PAL.coat; c.fill();
    c.save(); c.clip();
    for (let y = 40; y < 330; y += 46) { H.line(c, -150, y, 150, y + 4, PAL.coatDark, 4); H.rr(c, -150, y + 6, 300, 10, 4, 'rgba(255,255,255,0.06)'); }
    H.rr(c, -150, -20, 40, 360, 0, 'rgba(0,0,0,0.12)');
    c.restore();
    if (!o.back) {
      H.poly(c, [[-38, -10], [38, -10], [0, 56]], '#f4efe6'); // shirt V
      H.line(c, 0, 56, 0, 330, PAL.coatDark, 4);
    }
    // neck
    if (!o.back) H.rr(c, -22, -40, 44, 38, 10, PAL.skinShade);
    // head
    if (o.back) {
      H.circ(c, 0, hy, r + 4, PAL.mumHair);
      c.beginPath(); c.arc(0, hy, r - 6, -2.6, -1.2); c.strokeStyle = PAL.mumHairHi; c.lineWidth = 6; c.stroke();
      H.circ(c, 0, hy - r - 12, 34, PAL.mumHair);
      H.rr(c, -54, hy + 40, 108, 40, 18, PAL.mumHair);
    } else {
      // hair behind
      H.ell(c, 0, hy - 4, r + 10, r + 6, PAL.mumHair);
      H.rr(c, -r - 10, hy, 2 * r + 20, r * 0.9, 30, PAL.mumHair);
      H.circ(c, 0, hy - r - 14, 36, PAL.mumHair); // bun
      c.beginPath(); c.arc(0, hy - r - 14, 26, -2.4, -0.9); c.strokeStyle = PAL.mumHairHi; c.lineWidth = 5; c.stroke();
      // ears + face
      H.ell(c, -r + 2, hy + 6, 14, 18, PAL.skinShade); H.ell(c, r - 2, hy + 6, 14, 18, PAL.skinShade);
      H.ell(c, 0, hy, r * 0.92, r, PAL.skin);
      c.save(); c.translate(0, hy); face(c, r, o); c.restore();
      // fringe swept to one side
      c.beginPath();
      c.moveTo(-r * 0.95, hy - 6); c.quadraticCurveTo(-r, hy - r * 1.1, 0, hy - r * 1.02);
      c.quadraticCurveTo(r * 0.95, hy - r * 1.05, r * 0.98, hy - 10);
      c.quadraticCurveTo(r * 0.6, hy - r * 0.62 + wind * 10, r * 0.05, hy - r * 0.55);
      c.quadraticCurveTo(-r * 0.5, hy - r * 0.6, -r * 0.95, hy - 6);
      c.fillStyle = PAL.mumHair; c.fill();
    }
    // arms
    const sleeve = (pts) => { H.limb(c, pts, PAL.coat, 50); H.limb(c, pts, 'rgba(0,0,0,0.08)', 4); };
    const hand = (x, y) => H.circ(c, x, y, 21, PAL.skin);
    const arms = o.arms || 'down';
    if (arms === 'mug') {
      sleeve([[-112, 30], [-120, 180], [-30, 220]]); sleeve([[112, 30], [120, 180], [30, 220]]);
      if (o.mug !== false) { H.rr(c, -36, 170, 72, 82, 10, '#f6f4ef'); c.beginPath(); c.arc(40, 205, 18, -1.3, 1.3); c.strokeStyle = '#f6f4ef'; c.lineWidth = 9; c.stroke(); }
      hand(-30, 222); hand(30, 222);
    } else if (arms === 'hug') {
      sleeve([[-112, 30], [-150, 220], [-20, 300]]); sleeve([[112, 30], [150, 220], [20, 300]]);
      hand(-20, 300); hand(20, 300);
    } else if (arms === 'reach') {
      const [rx, ry] = o.reach || [260, -40];
      sleeve([[-112, 30], [-125, 220]]); hand(-125, 230);
      sleeve([[112, 30], [U.lerp(112, rx, 0.5), U.lerp(30, ry, 0.5) + 30], [rx, ry]]); hand(rx, ry);
    } else if (arms === 'spread') {
      const [lx, ly] = o.reachL || [-260, -60], [rx, ry] = o.reach || [260, -60];
      sleeve([[-112, 30], [lx, ly]]); hand(lx, ly);
      sleeve([[112, 30], [rx, ry]]); hand(rx, ry);
    } else { sleeve([[-112, 30], [-130, 240]]); sleeve([[112, 30], [130, 240]]); hand(-130, 250); hand(130, 250); }
    // legs (optional)
    if (o.legs) {
      H.rr(c, -110, 320, 100, 300, 30, '#2c3446'); H.rr(c, 10, 320, 100, 300, 30, '#2c3446');
      H.rr(c, -120, 600, 120, 40, 18, '#1a1a20'); H.rr(c, 0, 600, 120, 40, 18, '#1a1a20');
    }
    c.restore();
  }

  /* ------------------------------ GIRL ------------------------------
     origin = neck base. o: { back, mouth, lx, brow, arms, mug, wind, legs } */
  function girl(c, o = {}) {
    const r = 66, hy = -80, wind = o.wind || 0;
    c.save();
    // pyjama top
    c.beginPath(); c.moveTo(-82, 10); c.quadraticCurveTo(-80, -8, -40, -10); c.lineTo(40, -10); c.quadraticCurveTo(80, -8, 82, 10);
    c.lineTo(96, 250); c.lineTo(-96, 250); c.closePath(); c.fillStyle = PAL.pj; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 14; i++) H.star(c, -80 + U.hash(i * 3.1) * 160, 10 + U.hash(i * 7.7) * 230, 7 + U.hash(i) * 4, PAL.star);
    H.rr(c, -100, -20, 26, 280, 0, 'rgba(0,0,0,0.08)');
    c.restore();
    if (!o.back) { H.poly(c, [[-24, -10], [24, -10], [0, 24]], PAL.pjDark); }
    // legs
    if (o.legs) {
      H.rr(c, -78, 240, 70, 210, 26, PAL.pj); H.rr(c, 8, 240, 70, 210, 26, PAL.pj);
      for (let i = 0; i < 4; i++) H.star(c, -60 + (i % 2) * 90, 290 + i * 36, 7, PAL.star);
      H.rr(c, -84, 440, 84, 30, 14, '#f4f0f4'); H.rr(c, 4, 440, 84, 30, 14, '#f4f0f4');
    }
    // head
    const sway = Math.sin(wind * 3) * wind * 12;
    if (o.back) {
      H.circ(c, 0, hy, r + 4, PAL.girlHair);
      H.ell(c, -r - 12 + sway, hy + 20, 22, 32, PAL.girlHair); H.ell(c, r + 12 + sway, hy + 20, 22, 32, PAL.girlHair);
      H.circ(c, -r + 2, hy - 2, 9, PAL.tie); H.circ(c, r - 2, hy - 2, 9, PAL.tie);
    } else {
      H.ell(c, -r - 12 + sway, hy + 20, 24, 34, PAL.girlHair); H.ell(c, r + 12 + sway, hy + 20, 24, 34, PAL.girlHair);
      H.circ(c, -r + 4, hy - 4, 10, PAL.tie); H.circ(c, r - 4, hy - 4, 10, PAL.tie);
      H.ell(c, 0, hy, r, r * 0.98, PAL.skin);
      c.save(); c.translate(0, hy); face(c, r, Object.assign({ big: true }, o)); c.restore();
      // fringe
      c.beginPath(); c.moveTo(-r - 2, hy + 2); c.quadraticCurveTo(-r, hy - r * 1.15, 0, hy - r * 1.05);
      c.quadraticCurveTo(r, hy - r * 1.15, r + 2, hy + 2); c.quadraticCurveTo(r * 0.7, hy - r * 0.55, r * 0.3, hy - r * 0.5);
      c.lineTo(0, hy - r * 0.38); c.lineTo(-r * 0.3, hy - r * 0.5); c.quadraticCurveTo(-r * 0.7, hy - r * 0.55, -r - 2, hy + 2);
      c.fillStyle = PAL.girlHair; c.fill();
    }
    // arms
    const sleeve = (pts) => H.limb(c, pts, PAL.pj, 36);
    const hand = (x, y) => H.circ(c, x, y, 16, PAL.skin);
    const arms = o.arms || 'down';
    if (arms === 'mug') {
      sleeve([[-76, 24], [-80, 140], [-24, 170]]); sleeve([[76, 24], [80, 140], [24, 170]]);
      if (o.mug !== false) {
        H.rr(c, -32, 120, 64, 70, 9, '#f6f4ef'); c.beginPath(); c.arc(34, 150, 15, -1.3, 1.3); c.strokeStyle = '#f6f4ef'; c.lineWidth = 8; c.stroke();
        H.text(c, 'MUM', 0, 150, '900 20px Montserrat, Arial', PAL.tie);
      }
      hand(-24, 172); hand(24, 172);
    } else if (arms === 'up') { sleeve([[-76, 24], [-110, -60]]); sleeve([[76, 24], [110, -60]]); hand(-112, -66); hand(112, -66); }
    else if (arms === 'hold') { sleeve([[-76, 24], [-90, 140], [-150, 120]]); hand(-150, 118); sleeve([[76, 24], [90, 200]]); hand(90, 208); }
    else { sleeve([[-76, 24], [-90, 200]]); sleeve([[76, 24], [90, 200]]); hand(-90, 208); hand(90, 208); }
    c.restore();
  }

  /* ------------------------------ WIFE (across the estate) ------------------------------ */
  function wife(c, o = {}) {
    const r = 70, hy = -90;
    c.save();
    c.beginPath(); c.moveTo(-90, 10); c.quadraticCurveTo(-88, -8, -40, -10); c.lineTo(40, -10); c.quadraticCurveTo(88, -8, 90, 10);
    c.lineTo(100, 420); c.lineTo(-100, 420); c.closePath(); c.fillStyle = '#e991b7'; c.fill();
    H.rr(c, -90, 380, 80, 260, 26, '#e991b7'); H.rr(c, 10, 380, 80, 260, 26, '#e991b7');
    H.ell(c, 0, hy - 6, r + 10, r + 6, '#e8c37a');
    H.ell(c, 0, hy, r * 0.92, r, PAL.skin);
    c.save(); c.translate(0, hy); face(c, r, { mouth: o.mouth || 'scream', brow: 1, big: true }); c.restore();
    c.beginPath(); c.moveTo(-r, hy); c.quadraticCurveTo(-r, hy - r * 1.2, 0, hy - r * 1.05); c.quadraticCurveTo(r, hy - r * 1.2, r, hy); c.quadraticCurveTo(0, hy - r * 0.6, -r, hy); c.fillStyle = '#e8c37a'; c.fill();
    // hands up by the face
    H.limb(c, [[-80, 30], [-120, -40], [-70, -110]], '#e991b7', 38); H.circ(c, -70, -118, 18, PAL.skin);
    H.limb(c, [[80, 30], [120, -40], [70, -110]], '#e991b7', 38); H.circ(c, 70, -118, 18, PAL.skin);
    c.restore();
  }

  /* ------------------------------ THE KILLER: close-up face ------------------------------
     origin = centre of the head (head ~560 wide). o: { t, grin (0..1), look }  */
  function killerFace(c, o = {}) {
    const t = o.t || 0, grin = o.grin ?? 1;
    c.save();
    // sweater shoulders
    c.beginPath(); c.moveTo(-480, 760); c.quadraticCurveTo(-440, 360, -120, 330); c.lineTo(120, 330); c.quadraticCurveTo(440, 360, 480, 760); c.closePath();
    c.fillStyle = PAL.sweater; c.fill();
    c.save(); c.clip();
    for (let x = -460; x < 480; x += 44) for (let y = 360; y < 760; y += 28) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 11, y + 14); c.lineTo(x + 22, y); c.strokeStyle = PAL.sweaterDark; c.lineWidth = 3; c.stroke(); }
    for (const [x, y, rr] of [[-150, 470, 22], [120, 520, 16], [60, 420, 10], [-60, 600, 14], [200, 640, 9]]) H.circ(c, x, y, rr, PAL.blood);
    c.restore();
    // collar + neck
    H.rr(c, -110, 210, 220, 160, 40, PAL.kSkinShade);
    c.beginPath(); c.moveTo(-140, 330); c.quadraticCurveTo(0, 400, 140, 330); c.lineTo(130, 360); c.quadraticCurveTo(0, 430, -130, 360); c.closePath(); c.fillStyle = PAL.sweaterDark; c.fill();
    // ears
    for (const s of [-1, 1]) { H.ell(c, s * 272, 10, 42, 70, PAL.kSkinShade); H.ell(c, s * 270, 12, 22, 44, '#a59f8c'); }
    // head
    c.beginPath(); c.moveTo(0, -330);
    c.bezierCurveTo(200, -330, 275, -200, 275, -20); c.bezierCurveTo(275, 160, 200, 300, 0, 310);
    c.bezierCurveTo(-200, 300, -275, 160, -275, -20); c.bezierCurveTo(-275, -200, -200, -330, 0, -330); c.closePath();
    c.fillStyle = H.rg(c, -40, -60, 40, 360, [[0, '#e6e3d6'], [0.7, PAL.kSkin], [1, PAL.kSkinShade]]); c.fill();
    c.save(); c.clip();
    // stubble
    for (let i = 0; i < 260; i++) {
      const a = U.hash(i * 2.3) * Math.PI, rr = 180 + U.hash(i * 5.1) * 120;
      const x = Math.cos(a) * rr * 0.95, y = 90 + Math.sin(a) * rr * 0.75;
      if (y > 60) H.circ(c, x, y, 2.6, 'rgba(70,64,56,0.55)');
    }
    // temple shadows
    H.ell(c, -250, -40, 60, 200, 'rgba(120,110,95,0.25)'); H.ell(c, 250, -40, 60, 200, 'rgba(120,110,95,0.25)');
    c.restore();
    // combover hair
    c.strokeStyle = PAL.kHair; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      c.lineWidth = 16 - i;
      c.beginPath(); c.moveTo(-230 + i * 8, -150 - i * 22); c.quadraticCurveTo(-40, -320 - i * 6 + Math.sin(t * 2 + i) * 3, 200 - i * 10, -250 + i * 8); c.stroke();
    }
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 255, -110, 30, 80, s * 0.2, 0, TAU); c.fillStyle = PAL.kHair; c.fill(); }
    // forehead wrinkles
    c.strokeStyle = 'rgba(110,100,85,0.55)'; c.lineWidth = 6;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-150 + i * 10, -150 + i * 26); c.quadraticCurveTo(0, -180 + i * 26, 150 - i * 10, -150 + i * 26); c.stroke(); }
    // eye bags
    for (const s of [-1, 1]) H.ell(c, s * 110, -20, 92, 86, 'rgba(150,130,140,0.55)');
    // eyes: bloodshot, wide, twitching
    const tw = U.snoise(t * 6) * 4;
    for (const s of [-1, 1]) {
      const ex = s * 110, ey = -25;
      H.circ(c, ex, ey, 62, '#f6f2ea');
      c.save(); c.beginPath(); c.arc(ex, ey, 62, 0, TAU); c.clip();
      c.strokeStyle = 'rgba(200,40,40,0.75)'; c.lineWidth = 2.4;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU + U.hash(k + s) * 0.3; let x = ex + Math.cos(a) * 62, y = ey + Math.sin(a) * 62;
        c.beginPath(); c.moveTo(x, y);
        for (let j = 0; j < 4; j++) { x += (ex - x) * 0.25 + (U.hash(k * 9 + j + s) - 0.5) * 14; y += (ey - y) * 0.25 + (U.hash(k * 7 + j - s) - 0.5) * 14; c.lineTo(x, y); }
        c.stroke();
      }
      c.restore();
      const ix = ex + (o.look || 0) * 10 + tw * 0.5, iy = ey + tw * 0.3;
      H.circ(c, ix, iy, 26, '#7d8e9e'); H.circ(c, ix, iy, 13, '#141414'); H.circ(c, ix + 8, iy - 8, 6, '#fff');
      c.beginPath(); c.arc(ex, ey, 63, 0, TAU); c.strokeStyle = '#8a5a5a'; c.lineWidth = 4; c.stroke();
      // thin raised brows
      H.line(c, ex - s * 70, ey - 100, ex + s * 60, ey - 120, '#7e786c', 10);
    }
    // nose
    c.beginPath(); c.moveTo(-10, -10); c.quadraticCurveTo(-30, 90, -46, 108); c.quadraticCurveTo(0, 130, 46, 108); c.quadraticCurveTo(26, 90, 14, -10);
    c.fillStyle = 'rgba(170,160,140,0.6)'; c.fill();
    H.ell(c, -24, 112, 12, 7, 'rgba(90,70,60,0.6)'); H.ell(c, 24, 112, 12, 7, 'rgba(90,70,60,0.6)');
    // grin
    const w = 120 + grin * 90, d = 40 + grin * 60;
    c.beginPath(); c.moveTo(-w, 150); c.quadraticCurveTo(0, 150 + d * 2.2, w, 150); c.quadraticCurveTo(0, 170 + d * 0.3, -w, 150); c.closePath();
    c.fillStyle = '#3a0c10'; c.fill();
    c.save(); c.clip();
    c.fillStyle = '#f7f3e8'; c.beginPath(); c.moveTo(-w, 140); c.quadraticCurveTo(0, 190 + d * 0.3, w, 140); c.lineTo(w, 140 + d * 0.5); c.quadraticCurveTo(0, 175 + d * 1.3, -w, 140 + d * 0.5); c.closePath(); c.fill();
    c.strokeStyle = '#a89c88'; c.lineWidth = 3;
    for (let i = -8; i <= 8; i++) { const x = i * w / 9; c.beginPath(); c.moveTo(x, 140); c.lineTo(x, 200 + d * 0.9 - Math.abs(i) * 6); c.stroke(); }
    c.restore();
    c.beginPath(); c.moveTo(-w, 150); c.quadraticCurveTo(0, 150 + d * 2.2, w, 150); c.strokeStyle = '#b5414a'; c.lineWidth = 12; c.stroke();
    c.beginPath(); c.moveTo(-w, 150); c.quadraticCurveTo(0, 170 + d * 0.3, w, 150); c.strokeStyle = '#c4585e'; c.lineWidth = 9; c.stroke();
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * (w + 6), 150); c.quadraticCurveTo(s * (w + 30), 100, s * (w + 10), 60); c.strokeStyle = 'rgba(110,100,85,0.55)'; c.lineWidth = 6; c.stroke(); }
    // blood spatter on cheek + forehead
    for (const [x, y, rr] of [[150, 90, 15], [178, 128, 9], [130, 160, 7], [200, 60, 6], [165, 190, 11], [-160, -200, 6], [90, -170, 5], [210, 170, 5], [120, 230, 8]]) H.circ(c, x, y, rr, PAL.blood);
    c.beginPath(); c.moveTo(165, 190); c.quadraticCurveTo(170, 230, 160, 268); c.strokeStyle = PAL.blood; c.lineWidth = 7; c.stroke();
    c.restore();
  }

  // bloody kitchen knife, blade pointing +x, origin at the hilt.  len ≈ 330
  function knife(c, bloody = 1) {
    c.save();
    H.rr(c, -150, -18, 150, 36, 10, '#2c2c30');
    H.circ(c, -110, 0, 5, '#9aa0a8'); H.circ(c, -50, 0, 5, '#9aa0a8');
    c.beginPath(); c.moveTo(0, -22); c.lineTo(250, -18); c.quadraticCurveTo(320, -10, 340, 10); c.lineTo(0, 22); c.closePath();
    c.fillStyle = H.lg(c, 0, -22, 0, 22, [[0, '#eef1f5'], [0.5, PAL.steel], [1, '#8d939c']]); c.fill();
    if (bloody) {
      c.save(); c.clip();
      c.beginPath(); c.moveTo(120, 25); c.quadraticCurveTo(170, -10, 210, -6); c.quadraticCurveTo(260, -20, 345, 0); c.lineTo(345, 30); c.closePath();
      c.fillStyle = PAL.blood; c.globalAlpha = bloody; c.fill();
      H.circ(c, 100, 8, 8, PAL.blood);
      c.restore();
    }
    c.restore();
  }

  /* ------------------------------ THE KILLER: full body ------------------------------
     origin = feet. height ≈ 900. o: { back, arm (radians, knife arm), grin, bloody, t } */
  function killerBody(c, o = {}) {
    c.save();
    // legs
    H.rr(c, -80, -420, 74, 400, 24, PAL.trousers); H.rr(c, 6, -420, 74, 400, 24, PAL.trousers);
    H.rr(c, -96, -36, 96, 36, 14, '#5a3e2c'); H.rr(c, 4, -36, 96, 36, 14, '#5a3e2c');
    // sweater
    c.beginPath(); c.moveTo(-120, -380); c.lineTo(-130, -690); c.quadraticCurveTo(-120, -730, -60, -738); c.lineTo(60, -738); c.quadraticCurveTo(120, -730, 130, -690); c.lineTo(120, -380); c.closePath();
    c.fillStyle = PAL.sweater; c.fill();
    c.save(); c.clip();
    for (let x = -130; x < 130; x += 26) for (let y = -730; y < -380; y += 20) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 7, y + 9); c.lineTo(x + 14, y); c.strokeStyle = PAL.sweaterDark; c.lineWidth = 2; c.stroke(); }
    if (o.bloody) for (const [x, y, rr] of [[-40, -600, 16], [30, -520, 22], [-70, -470, 10], [60, -650, 9], [0, -430, 13]]) H.circ(c, x, y, rr * o.bloody, PAL.blood);
    c.restore();
    H.rr(c, -130, -400, 260, 26, 10, PAL.sweaterDark);
    // free arm
    H.limb(c, [[-118, -700], [-150, -520], [-140, -420]], PAL.sweater, 52); H.circ(c, -140, -405, 24, PAL.kSkin);
    // head
    const hy = -820;
    H.rr(c, -30, -770, 60, 50, 12, PAL.kSkinShade);
    if (o.back) {
      H.ell(c, 0, hy, 82, 92, PAL.kSkin);
      // grey hair: thin on top, a fuller horseshoe round the back
      c.save(); c.beginPath(); c.ellipse(0, hy, 82, 92, 0, 0, TAU); c.clip();
      H.ell(c, 0, hy + 70, 110, 70, PAL.kHair);
      c.strokeStyle = 'rgba(120,115,105,0.9)'; c.lineWidth = 7; c.lineCap = 'round';
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-60 + i * 30, hy - 80); c.quadraticCurveTo(-50 + i * 30, hy - 20, -64 + i * 32, hy + 20); c.stroke(); }
      c.restore();
      c.strokeStyle = 'rgba(150,140,125,0.6)'; c.lineWidth = 4;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-40, hy + 30 + i * 10); c.quadraticCurveTo(0, hy + 38 + i * 10, 40, hy + 30 + i * 10); c.stroke(); }
      H.ell(c, -82, hy + 6, 14, 22, PAL.kSkinShade); H.ell(c, 82, hy + 6, 14, 22, PAL.kSkinShade);
    } else {
      H.ell(c, -82, hy + 6, 16, 26, PAL.kSkinShade); H.ell(c, 82, hy + 6, 16, 26, PAL.kSkinShade);
      H.ell(c, 0, hy, 82, 94, PAL.kSkin);
      for (const s of [-1, 1]) { H.ell(c, s * 32, hy - 8, 26, 24, 'rgba(150,130,140,0.6)'); H.circ(c, s * 32, hy - 10, 17, '#f6f2ea'); H.circ(c, s * 32, hy - 10, 7, '#141414'); }
      c.strokeStyle = PAL.kHair; c.lineWidth = 10; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-70, hy - 50 - i * 10); c.quadraticCurveTo(0, hy - 100 - i * 4, 66, hy - 70 + i * 6); c.stroke(); }
      const w = 44 + (o.grin ?? 1) * 18;
      c.beginPath(); c.moveTo(-w, hy + 40); c.quadraticCurveTo(0, hy + 90, w, hy + 40); c.quadraticCurveTo(0, hy + 55, -w, hy + 40); c.fillStyle = '#f7f3e8'; c.fill();
      c.strokeStyle = '#b5414a'; c.lineWidth = 5; c.stroke();
      c.strokeStyle = '#a89c88'; c.lineWidth = 2; for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 5, hy + 44); c.lineTo(i * w / 5, hy + 62 - Math.abs(i) * 3); c.stroke(); }
      for (const [x, y] of [[40, hy + 10], [55, hy + 30], [-30, hy - 50]]) H.circ(c, x, y, 6, PAL.blood);
    }
    // knife arm: o.arm 0 = hanging with the knife pointing down, 1 = raised high overhead
    const up = U.clamp(o.arm ?? 0);
    const sx = 118, sy = -700;
    const ex = U.lerp(176, 210, up), ey = U.lerp(-560, -860, up);
    const hx = U.lerp(160, 140, up), hy2 = U.lerp(-410, -1010, up);
    H.limb(c, [[sx, sy], [ex, ey], [hx, hy2]], PAL.sweater, 52);
    c.save(); c.translate(hx, hy2); c.rotate(o.knifeAngle ?? U.lerp(Math.PI / 2 - 0.1, -Math.PI / 2 - 0.25, up)); knife(c, o.bloody ?? 1); c.restore();
    H.circ(c, hx, hy2, 26, PAL.kSkin);
    c.restore();
  }

  // the viewer's own hand (POV), palm flat
  function hand(c) {
    c.save();
    H.limb(c, [[0, 520], [0, 150]], PAL.coat, 150);
    H.rr(c, -86, -60, 172, 220, 60, PAL.skin);
    for (let i = 0; i < 4; i++) H.rr(c, -82 + i * 44, -190 + Math.abs(i - 1.5) * 18, 38, 170, 19, PAL.skin);
    H.rr(c, 60, -10, 44, 120, 22, PAL.skin);
    c.strokeStyle = 'rgba(180,110,80,0.45)'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-60 + i * 44, -40); c.lineTo(-60 + i * 44, -12); c.stroke(); }
    c.restore();
  }

  // Union Jack, w x h at origin top-left
  function unionJack(c, w, h) {
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
    c.fillStyle = '#123a8c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#fff'; c.lineWidth = h * 0.3;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
    c.strokeStyle = '#cf142b'; c.lineWidth = h * 0.1;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(w * 0.4, 0, w * 0.2, h); c.fillRect(0, h * 0.33, w, h * 0.34);
    c.fillStyle = '#cf142b'; c.fillRect(w * 0.45, 0, w * 0.1, h); c.fillRect(0, h * 0.4, w, h * 0.2);
    c.restore();
  }

  g.Chars = { PAL, H, face, mum, girl, wife, killerFace, killerBody, knife, hand, unionJack };
})(window);
