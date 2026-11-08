/* =========================================================================
   ROOM 9 — characters.js
   Cast for the motel film, in the same flat style as One Minute:
   the big sister (green hoodie), you (the kid), the night clerk,
   and the Masked Man: an original slasher — hooded, porcelain mask with a
   crack and slit eyes, grey work overalls, gloves.
   Reuses the helpers (H, face, knife, hand) from js/characters.js.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, Chars: C0 } = g;
  const { H, face, knife } = C0;
  const TAU = Math.PI * 2;

  const PAL = {
    skin: '#f1c39c', skinDark: '#c98f68', blush: 'rgba(235,120,110,0.45)',
    sisHair: '#2b1a14', hoodie: '#3f7a52', hoodieDark: '#2e5c3d', jeans: '#2f3f63',
    kidHair: '#c8622e', tee: '#f2c23a', teeDark: '#d29f1f',
    clerkShirt: '#e8e2d0', vest: '#7a5232', clerkHair: '#b9b2a6',
    mask: '#ece8de', maskShade: '#c9c3b5', hood: '#26282e', hoodDark: '#18191d', overalls: '#4b5058', overallsDark: '#383c43', glove: '#1b1b1d',
    blood: '#b3121b',
  };

  /* ---------- the big sister. origin = neck base. o: { back, mouth, lx, ly, brow, blink, arms, point:[x,y], legs, lit } ---------- */
  function sister(c, o = {}) {
    const r = 78, hy = -96;
    c.save();
    // hoodie body
    c.beginPath(); c.moveTo(-112, 18); c.quadraticCurveTo(-110, -8, -56, -12); c.lineTo(56, -12); c.quadraticCurveTo(110, -8, 112, 18);
    c.lineTo(126, 300); c.lineTo(-126, 300); c.closePath(); c.fillStyle = PAL.hoodie; c.fill();
    c.save(); c.clip();
    H.rr(c, -140, -20, 40, 340, 0, 'rgba(0,0,0,0.12)');
    if (!o.back) { H.rr(c, -70, 170, 140, 70, 18, PAL.hoodieDark); H.line(c, -22, 0, -26, 110, '#d9d4c8', 5); H.line(c, 22, 0, 26, 110, '#d9d4c8', 5); }
    c.restore();
    // hood bunched behind the neck
    c.beginPath(); c.ellipse(0, -6, 80, 30, 0, Math.PI, 0); c.fillStyle = PAL.hoodieDark; c.fill();
    if (o.legs) {
      H.rr(c, -100, 290, 92, 300, 30, PAL.jeans); H.rr(c, 8, 290, 92, 300, 30, PAL.jeans);
      H.rr(c, -112, 572, 112, 40, 18, '#ece9e2'); H.rr(c, 0, 572, 112, 40, 18, '#ece9e2');
    }
    if (!o.back) H.rr(c, -20, -38, 40, 34, 10, PAL.skinDark);
    if (o.back) {
      H.circ(c, 0, hy, r + 4, PAL.sisHair);
      for (let i = 0; i < 9; i++) H.circ(c, Math.cos(i * 0.7) * (r - 8), hy - 10 + Math.sin(i * 0.7) * (r - 12), 22, PAL.sisHair);
      H.ell(c, 0, hy - r - 10, 30, 24, PAL.sisHair); // ponytail knot
    } else {
      // curly hair behind + ponytail
      for (let i = 0; i < 12; i++) { const a = Math.PI * (0.95 + i * 0.1); H.circ(c, Math.cos(a) * (r + 2), hy + Math.sin(a) * (r - 4) + 6, 24, PAL.sisHair); }
      H.ell(c, r * 0.4, hy - r - 6, 34, 26, PAL.sisHair);
      H.ell(c, -r + 4, hy + 8, 13, 18, PAL.skinDark); H.ell(c, r - 4, hy + 8, 13, 18, PAL.skinDark);
      H.ell(c, 0, hy, r * 0.9, r, PAL.skin);
      if (o.lit) { c.save(); c.beginPath(); c.ellipse(0, hy, r * 0.9, r, 0, 0, TAU); c.clip(); c.fillStyle = o.lit; c.fillRect(-r, hy - r, 2 * r, 2 * r); c.restore(); }
      c.save(); c.translate(0, hy); face(c, r, o); c.restore();
      // curly fringe
      for (let i = 0; i < 7; i++) H.circ(c, -r * 0.75 + i * r * 0.25, hy - r * 0.78 + Math.abs(i - 3) * 4, 22, PAL.sisHair);
      H.ell(c, 0, hy - r * 0.95, r * 0.9, r * 0.32, PAL.sisHair);
    }
    // arms
    const sleeve = (pts) => H.limb(c, pts, PAL.hoodie, 46);
    const hand = (x, y) => H.circ(c, x, y, 20, PAL.skin);
    const arms = o.arms || 'down';
    if (arms === 'point') {
      const [px, py] = o.point || [260, -80];
      sleeve([[-104, 28], [-118, 240]]); hand(-118, 250);
      sleeve([[104, 28], [U.lerp(104, px, 0.5), U.lerp(28, py, 0.5) + 20], [px, py]]); hand(px, py);
      H.rr(c, px + 4, py - 8, 34, 14, 7, PAL.skin);
    } else if (arms === 'remote') {
      sleeve([[-104, 28], [-112, 170], [-30, 200]]); sleeve([[104, 28], [112, 170], [30, 200]]);
      if (o.remote !== false) { H.rr(c, -18, 150, 36, 90, 8, '#2a2a30'); for (let i = 0; i < 4; i++) H.circ(c, 0, 172 + i * 16, 4, i ? '#888' : '#c33'); }
      hand(-28, 205); hand(28, 205);
    } else if (arms === 'push') {
      sleeve([[-104, 28], [-150, -120]]); sleeve([[104, 28], [150, -120]]); hand(-150, -128); hand(150, -128);
    } else if (arms === 'reach') {
      const [px, py] = o.point || [260, -80];
      sleeve([[-104, 28], [-118, 240]]); hand(-118, 250);
      sleeve([[104, 28], [px, py]]); hand(px, py);
    } else { sleeve([[-104, 28], [-120, 240]]); sleeve([[104, 28], [120, 240]]); hand(-120, 250); hand(120, 250); }
    c.restore();
  }

  /* ---------- you: the kid. origin = neck base. ---------- */
  function kid(c, o = {}) {
    const r = 62, hy = -76;
    c.save();
    c.beginPath(); c.moveTo(-78, 12); c.quadraticCurveTo(-76, -6, -38, -10); c.lineTo(38, -10); c.quadraticCurveTo(76, -6, 78, 12);
    c.lineTo(88, 220); c.lineTo(-88, 220); c.closePath(); c.fillStyle = PAL.tee; c.fill();
    if (!o.back) H.star(c, 0, 90, 26, '#e0602e');
    if (o.legs) {
      H.rr(c, -72, 210, 66, 200, 26, '#3c5a86'); H.rr(c, 6, 210, 66, 200, 26, '#3c5a86');
      H.rr(c, -80, 395, 80, 30, 14, '#d23c3c'); H.rr(c, 0, 395, 80, 30, 14, '#d23c3c');
    }
    if (o.back) { H.circ(c, 0, hy, r + 4, PAL.kidHair); for (let i = 0; i < 6; i++) H.ell(c, -40 + i * 16, hy - r + 4, 10, 18, PAL.kidHair, -0.3 + i * 0.12); }
    else {
      H.ell(c, -r + 2, hy + 6, 11, 15, PAL.skinDark); H.ell(c, r - 2, hy + 6, 11, 15, PAL.skinDark);
      H.ell(c, 0, hy, r, r * 0.98, PAL.skin);
      if (o.lit) { c.save(); c.beginPath(); c.ellipse(0, hy, r, r, 0, 0, TAU); c.clip(); c.fillStyle = o.lit; c.fillRect(-r, hy - r, 2 * r, 2 * r); c.restore(); }
      c.save(); c.translate(0, hy); face(c, r, Object.assign({ big: true }, o)); c.restore();
      for (let i = 0; i < 8; i++) H.ell(c, -r * 0.8 + i * r * 0.23, hy - r * 0.78, 16, 22, PAL.kidHair, -0.4 + i * 0.1);
      H.ell(c, 0, hy - r * 0.95, r * 0.95, r * 0.35, PAL.kidHair);
      // freckles
      for (let i = 0; i < 6; i++) H.circ(c, (i < 3 ? -1 : 1) * (r * 0.38 + (i % 3) * 7), hy + r * 0.18 + (i % 2) * 6, 2.2, 'rgba(170,90,50,0.6)');
    }
    const sleeve = (pts) => H.limb(c, pts, PAL.tee, 32);
    const hand = (x, y) => H.circ(c, x, y, 15, PAL.skin);
    if (o.arms === 'up') { sleeve([[-70, 20], [-100, -80]]); sleeve([[70, 20], [100, -80]]); hand(-102, -88); hand(102, -88); }
    else if (o.arms === 'knees') { sleeve([[-70, 20], [-80, 140], [-20, 170]]); sleeve([[70, 20], [80, 140], [20, 170]]); hand(-20, 172); hand(20, 172); }
    else { sleeve([[-70, 20], [-84, 190]]); sleeve([[70, 20], [84, 190]]); hand(-84, 198); hand(84, 198); }
    c.restore();
  }

  /* ---------- the night clerk. origin = neck base ---------- */
  function clerk(c, o = {}) {
    const r = 74, hy = -92;
    c.save();
    c.beginPath(); c.moveTo(-110, 16); c.quadraticCurveTo(-108, -8, -54, -12); c.lineTo(54, -12); c.quadraticCurveTo(108, -8, 110, 16);
    c.lineTo(120, 300); c.lineTo(-120, 300); c.closePath(); c.fillStyle = PAL.clerkShirt; c.fill();
    H.poly(c, [[-110, 16], [-40, -10], [-20, 300], [-120, 300]], PAL.vest); H.poly(c, [[110, 16], [40, -10], [20, 300], [120, 300]], PAL.vest);
    H.rr(c, 40, 60, 50, 24, 4, '#e8d9a0'); // name badge
    H.ell(c, -r + 4, hy + 6, 13, 18, PAL.skinDark); H.ell(c, r - 4, hy + 6, 13, 18, PAL.skinDark);
    H.ell(c, 0, hy, r * 0.92, r, '#eab995');
    c.save(); c.translate(0, hy); face(c, r, Object.assign({ mouth: 'flat' }, o)); c.restore();
    // glasses + combed side hair
    c.strokeStyle = '#333'; c.lineWidth = 4;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * 0.36, hy - 2, r * 0.22, 0, TAU); c.stroke(); }
    H.line(c, -r * 0.14, hy - 4, r * 0.14, hy - 4, '#333', 4);
    H.ell(c, -r * 0.82, hy - 10, 18, 34, PAL.clerkHair); H.ell(c, r * 0.82, hy - 10, 18, 34, PAL.clerkHair);
    const arms = o.arms || 'desk';
    if (arms === 'up') { H.limb(c, [[-100, 26], [-140, -60], [-90, -140]], PAL.clerkShirt, 40); H.limb(c, [[100, 26], [140, -60], [90, -140]], PAL.clerkShirt, 40); H.circ(c, -90, -146, 18, '#eab995'); H.circ(c, 90, -146, 18, '#eab995'); }
    else { H.limb(c, [[-100, 26], [-110, 180], [-40, 210]], PAL.clerkShirt, 40); H.limb(c, [[100, 26], [110, 180], [40, 210]], PAL.clerkShirt, 40); }
    c.restore();
  }

  /* ---------- the Masked Man: the mask itself (close-up). origin = centre of the mask, ~ 300 wide ---------- */
  function mask(c, o = {}) {
    const t = o.t || 0, tilt = o.tilt || 0;
    c.save(); c.rotate(tilt);
    // hood around the face
    c.beginPath(); c.moveTo(-250, 520); c.quadraticCurveTo(-300, -40, -150, -300); c.quadraticCurveTo(0, -400, 150, -300); c.quadraticCurveTo(300, -40, 250, 520); c.closePath();
    c.fillStyle = H.lg(c, 0, -400, 0, 520, [[0, '#33363d'], [1, PAL.hoodDark]]); c.fill();
    c.beginPath(); c.ellipse(0, 10, 200, 260, 0, 0, TAU); c.fillStyle = '#0b0b0d'; c.fill(); // shadow inside the hood
    // the porcelain mask
    c.beginPath(); c.moveTo(0, -230);
    c.bezierCurveTo(130, -230, 170, -120, 168, 0); c.bezierCurveTo(166, 140, 100, 250, 0, 262);
    c.bezierCurveTo(-100, 250, -166, 140, -168, 0); c.bezierCurveTo(-170, -120, -130, -230, 0, -230); c.closePath();
    c.fillStyle = H.rg(c, -40, -60, 20, 300, [[0, '#fbf8f1'], [0.7, PAL.mask], [1, PAL.maskShade]]); c.fill();
    c.save(); c.clip();
    H.ell(c, -150, 20, 50, 220, 'rgba(120,110,95,0.18)'); H.ell(c, 150, 20, 50, 220, 'rgba(120,110,95,0.18)');
    // grime
    H.ell(c, 60, 170, 50, 26, 'rgba(110,95,70,0.18)'); H.ell(c, -90, -150, 30, 18, 'rgba(110,95,70,0.14)');
    c.restore();
    // slit eyes (dark, with a faint glint deep inside)
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 20, -36); c.quadraticCurveTo(s * 70, -64, s * 118, -40); c.quadraticCurveTo(s * 70, -22, s * 20, -36); c.closePath();
      c.fillStyle = '#060607'; c.fill();
      const gl = 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.7 + s));
      H.circ(c, s * 68 + (o.look || 0) * 10, -40, 4, `rgba(230,230,220,${0.5 * gl})`);
    }
    // carved brow ridge + nose bridge
    c.strokeStyle = 'rgba(150,140,125,0.6)'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-120, -84); c.quadraticCurveTo(0, -112, 120, -84); c.stroke();
    c.beginPath(); c.moveTo(0, -30); c.quadraticCurveTo(-10, 40, -14, 70); c.quadraticCurveTo(0, 82, 14, 70); c.stroke();
    // a thin, closed mouth line
    c.beginPath(); c.moveTo(-50, 150); c.quadraticCurveTo(0, 158, 50, 150); c.strokeStyle = '#2a2724'; c.lineWidth = 4; c.stroke();
    // the crack
    c.strokeStyle = '#2a2622'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(150, -150); c.lineTo(110, -110); c.lineTo(122, -84); c.lineTo(84, -30); c.lineTo(96, 10); c.lineTo(70, 60); c.stroke();
    c.beginPath(); c.moveTo(110, -110); c.lineTo(80, -126); c.stroke();
    // blood flecks
    if (o.blood) for (const [x, y, rr] of [[-60, 120, 9], [-80, 96, 5], [-40, 190, 6], [40, -170, 4], [-120, 40, 5]]) H.circ(c, x, y, rr * o.blood, PAL.blood);
    c.restore();
  }

  /* ---------- the Masked Man, full body. origin = feet. o: { arm 0..1 raise, knife, back, key, walk } ---------- */
  function maskedMan(c, o = {}) {
    const walk = o.walk || 0, sw = Math.sin(walk * TAU) * (o.walking ? 1 : 0);
    c.save();
    // legs (striding)
    c.save(); c.translate(-30, -440); c.rotate(sw * 0.25); H.rr(c, -40, 0, 80, 420, 30, PAL.overallsDark); H.rr(c, -46, 400, 100, 44, 16, '#141416'); c.restore();
    c.save(); c.translate(30, -440); c.rotate(-sw * 0.25); H.rr(c, -40, 0, 80, 420, 30, PAL.overalls); H.rr(c, -46, 400, 100, 44, 16, '#141416'); c.restore();
    // torso: overalls
    c.beginPath(); c.moveTo(-140, -420); c.lineTo(-150, -760); c.quadraticCurveTo(-140, -810, -70, -816); c.lineTo(70, -816); c.quadraticCurveTo(140, -810, 150, -760); c.lineTo(140, -420); c.closePath();
    c.fillStyle = PAL.overalls; c.fill();
    H.line(c, 0, -800, 0, -430, PAL.overallsDark, 6); // zip
    H.rr(c, 40, -740, 70, 40, 5, '#5d636c'); // blank name patch
    H.rr(c, -140, -470, 280, 28, 8, PAL.overallsDark); // belt
    if (o.blood) for (const [x, y, rr] of [[-60, -650, 16], [40, -560, 22], [-20, -500, 12]]) H.circ(c, x, y, rr * o.blood, PAL.blood);
    // free arm (swings)
    H.limb(c, [[-136, -780], [-170 - sw * 20, -600], [-160 - sw * 30, -470]], PAL.overalls, 58); H.circ(c, -160 - sw * 30, -455, 30, PAL.glove);
    // head: hood + mask (small)
    c.save(); c.translate(0, -910); c.scale(0.34, 0.34);
    if (o.back) { c.beginPath(); c.ellipse(0, 40, 250, 300, 0, 0, TAU); c.fillStyle = PAL.hood; c.fill(); H.ell(c, 0, 220, 230, 120, PAL.hoodDark); }
    else mask(c, { t: o.t, blood: o.blood });
    c.restore();
    // knife / key arm
    const up = U.clamp(o.arm || 0);
    const sx = 136, sy = -780, ex = U.lerp(190, 230, up), ey = U.lerp(-620, -920, up), hx = U.lerp(176, 150, up), hy = U.lerp(-470, -1080, up);
    H.limb(c, [[sx, sy], [ex, ey], [hx, hy]], PAL.overalls, 58);
    if (o.knife !== false) { c.save(); c.translate(hx, hy); c.rotate(U.lerp(Math.PI / 2 - 0.1, -Math.PI / 2 - 0.25, up)); knife(c, o.blood ?? 0); c.restore(); }
    H.circ(c, hx, hy, 30, PAL.glove);
    c.restore();
  }

  g.Motel = { PAL, sister, kid, clerk, mask, maskedMan };
})(window);
