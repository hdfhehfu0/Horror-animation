/* =========================================================================
   BOOKMARKED — scenes.js
   The 21 shots, drawn flat-vector on a 1080x1920 canvas in the grammar of
   the reference: hard cuts, a slow push-in on every shot, props that pop in
   with sparkles, and ONE caption word at a time.
   Film.render(ctx, t) is a pure function of t (seeded noise only).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, Chars, BM } = g;
  const { H } = Chars;
  const { P, person, shadowSelf } = BM;
  const W = TL.W, HT = TL.H, TAU = Math.PI * 2;
  const FONT = 'Poppins, Montserrat, "Arial Black", Arial, sans-serif';
  // ask for the web fonts up front so the first rendered frames already use them
  if (document.fonts && document.fonts.load) for (const f of ['700 70px Poppins', '800 70px Poppins', '900 70px Poppins', '400 40px "Permanent Marker"']) document.fonts.load(f).catch(() => {});

  const COL = {
    silasA: '#6e1626', silasB: '#3e0b15', ezraA: '#245a46', ezraB: '#123528', seam: '#e8c25a',
    wood: '#5b3720', woodDark: '#3f2414', red: '#e0322b', gold: '#f2c14e', navy: '#1d2b45',
  };

  /* ----------------------------- helpers ----------------------------- */
  const pop = (t, t0, dur = 0.32) => (t < t0 ? 0 : t > t0 + dur ? 1 : U.backOut((t - t0) / dur));
  const ramp = (t, t0, dur) => U.clamp((t - t0) / dur);
  function shake(t) {
    let a = 0;
    const hit = (s, amp, dec) => { const d = t - s; if (d >= 0 && d < 1.2) a = Math.max(a, amp * Math.exp(-d * dec)); };
    hit(TL.grab, 10, 10); hit(TL.stamp, 22, 7); hit(TL.calDrop + 0.18, 5, 12); hit(TL.bookClose, 4, 14);
    return { x: U.snoise(t * 37) * a, y: U.snoise(t * 41 + 7) * a };
  }
  // slow push-in on (fx, fy): zoom from z0 to z1 across the shot
  function cam(c, t, lt, d, fx = 540, fy = 960, z0 = 1, z1 = 1.045, sx = W / 2, sy = HT / 2) {
    const s = shake(t), z = U.lerp(z0, z1, U.clamp(lt / d));
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(sx + s.x, sy + s.y); c.scale(z, z); c.translate(-fx, -fy);
  }
  function ch(c, who, x, y, s, o) { c.save(); c.translate(x, y); c.scale(s, s); person(c, who, o); c.restore(); }
  function stripes(c, x0, x1, alpha = 0.09) {
    c.fillStyle = `rgba(255,255,255,${alpha})`;
    for (let x = x0; x < x1; x += 24) c.fillRect(x, -200, 3, HT + 400);
  }
  function label(c, s, x, y, size, col = '#fff', wt = 800) {
    c.save(); c.font = `${wt} ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = size * 0.16; c.strokeStyle = 'rgba(0,0,0,0.55)'; c.strokeText(s, x, y);
    c.fillStyle = col; c.fillText(s, x, y); c.restore();
  }
  function glow(c, x, y, r, rgb, a) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = H.rg(c, x, y, 1, r, [[0, `rgba(${rgb},${a})`], [1, `rgba(${rgb},0)`]]);
    c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
  }
  function vignette(c, a = 0.5, inner = 0.35) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = H.rg(c, W / 2, HT / 2, HT * inner, HT * 0.78, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${a})`]]);
    c.fillRect(0, 0, W, HT); c.restore();
  }
  function ringMark(c, x, y, rx, ry, p, col = COL.red, lw = 9) {
    if (p <= 0) return;
    c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.shadowColor = 'rgba(224,50,43,0.6)'; c.shadowBlur = 12;
    c.beginPath(); c.ellipse(x, y, rx, ry, -0.06, -Math.PI / 2, -Math.PI / 2 + TAU * U.easeOut(U.clamp(p))); c.stroke(); c.restore();
  }
  function rain(c, t, a = 0.18, n = 90) {
    c.save(); c.strokeStyle = `rgba(200,220,255,${a})`; c.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const x = U.hash(i * 3.1) * (W + 300) - 150, sp = 1400 + U.hash(i) * 600;
      const y = ((U.hash(i * 7.3) * HT + t * sp) % (HT + 200)) - 100;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10, y + 44); c.stroke();
    }
    c.restore();
  }
  function wallpaper(c, col, dot) {
    c.fillStyle = col; c.fillRect(-200, -200, W + 400, HT + 400);
    for (let y = -160; y < HT + 200; y += 90) for (let x = -160 + ((y / 90) % 2) * 45; x < W + 200; x += 90) {
      c.save(); c.translate(x, y); c.rotate(Math.PI / 4); H.rr(c, -9, -9, 18, 18, 3, dot); c.restore();
    }
  }
  function windowNight(c, x, y, w, h, t) {
    H.rr(c, x - 14, y - 14, w + 28, h + 28, 6, COL.woodDark);
    c.fillStyle = H.lg(c, 0, y, 0, y + h, [[0, '#0b1230'], [1, '#26305a']]); c.fillRect(x, y, w, h);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    for (let i = 0; i < 40; i++) { const rx = x + U.hash(i * 1.9) * w, ry = ((U.hash(i * 4.4) * h + t * (260 + U.hash(i) * 120)) % h) + y; H.line(c, rx, ry, rx - 4, ry + 22, 'rgba(180,200,255,0.35)', 2); }
    c.restore();
    H.rr(c, x + w / 2 - 6, y, 12, h, 0, COL.woodDark); H.rr(c, x, y + h / 2 - 6, w, 12, 0, COL.woodDark);
  }

  /* ------------------------------ scenes ------------------------------ */
  const S = {};

  // 1 + 14: the colour-coded VS split (crimson = Silas, green = Ezra)
  S.vs = function (c, t, lt, d, v) {
    cam(c, t, lt, d, 540, 960, 1, 1.04);
    const sx0 = 610, sx1 = 470;
    c.fillStyle = H.lg(c, 0, 0, 0, HT, [[0, COL.silasA], [1, COL.silasB]]);
    c.fillRect(-200, -200, W + 400, HT + 400);
    c.save(); c.beginPath(); c.rect(-200, -200, W + 400, HT + 400); c.clip(); stripes(c, -200, W + 200); c.restore();
    c.save();
    c.beginPath(); c.moveTo(sx0, -200); c.lineTo(W + 300, -200); c.lineTo(W + 300, HT + 200); c.lineTo(sx1, HT + 200); c.closePath(); c.clip();
    c.fillStyle = H.lg(c, 0, 0, 0, HT, [[0, COL.ezraA], [1, COL.ezraB]]); c.fillRect(-200, -200, W + 400, HT + 400);
    stripes(c, -200, W + 200);
    c.restore();
    H.line(c, sx0 + 20, -200, sx1 - 20, HT + 200, COL.seam, 7);

    const team = v === 'team';
    const tu = team ? ramp(t, TL.teamUp, 0.28) : 0;
    const silasExpr = team ? (t > TL.teamUp + 0.2 ? 'smile' : 'smug') : (t > 2.6 ? 'smirk' : 'squint');
    const ezraExpr = team ? (t > TL.teamUp + 0.2 ? 'grin' : 'smug') : (t > TL.ezraGrin ? 'grin' : 'smile');
    const sHand = [U.lerp(140, 196, U.easeOut(tu)), U.lerp(350, 290, U.easeOut(tu))];
    const eHand = [U.lerp(-140, -196, U.easeOut(tu)), U.lerp(350, 290, U.easeOut(tu))];
    ch(c, 'silas', 290, 930, 1.28, { t, expr: silasExpr, look: [0.6, 0], arms: { r: sHand } });
    ch(c, 'ezra', 800, 930, 1.28, { t, expr: ezraExpr, look: [-0.6, 0], arms: { l: eHand } });
    if (team && tu > 0) P.sparkles(c, 540, 1300, 120, 12, ramp(t, TL.teamUp + 0.15, 0.9), 4);

    if (v === 'intro') { label(c, 'SILAS', 220, 300, 66); label(c, 'EZRA', 850, 300, 66); }
    // VS -> TEAM UP
    const word = team && t >= TL.teamUp ? 'TEAM UP' : 'VS';
    const t0 = team ? (t >= TL.teamUp ? TL.teamUp : TL.shots[14][0] - 1) : TL.vsPop;
    const k = pop(t, t0, 0.35);
    if (k > 0) {
      c.save(); c.translate(540, 640); c.scale(k, k); c.rotate(-0.06);
      c.font = `900 ${word === 'VS' ? 170 : 128}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = 22; c.strokeStyle = '#2a1205'; c.strokeText(word, 0, 0);
      c.fillStyle = H.lg(c, 0, -70, 0, 70, [[0, '#ffe08a'], [1, '#f0a92b']]); c.fillText(word, 0, 0);
      c.restore();
      if (word === 'TEAM UP') P.sparkles(c, 540, 640, 260, 14, ramp(t, TL.teamUp, 0.8), 9);
    }
    vignette(c, 0.35);
  };

  // 2: Port Halden at night — harbour cranes, a lighthouse, police tape
  S.city = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 1000, 1.02, 1.07);
    c.fillStyle = H.lg(c, 0, -200, 0, 1180, [[0, '#0a0d2a'], [0.55, '#2c1d55'], [1, '#93385f']]); c.fillRect(-200, -200, W + 400, 1400);
    for (let i = 0; i < 90; i++) H.circ(c, U.hash(i * 3.3) * (W + 200) - 100, U.hash(i * 7.1) * 800 - 100, 1 + U.hash(i) * 2, `rgba(255,255,255,${0.25 + 0.5 * U.hash(i * 2)})`);
    glow(c, 790, 400, 260, '255,236,170', 0.22);
    H.circ(c, 790, 400, 72, '#f7e7a8'); H.circ(c, 770, 386, 12, 'rgba(210,190,130,0.5)'); H.circ(c, 812, 420, 9, 'rgba(210,190,130,0.5)');
    // skyline
    const base = 1180;
    for (let i = 0; i < 16; i++) {
      const x = -120 + i * 85, w = 70 + U.hash(i * 2.2) * 40, h = 220 + U.hash(i * 5.7) * 420;
      H.rr(c, x, base - h, w, h, 2, i % 2 ? '#1b1838' : '#221e45');
      for (let yy = base - h + 22; yy < base - 20; yy += 34) for (let xx = x + 12; xx < x + w - 14; xx += 22) {
        const on = U.hash(i * 31 + xx * 0.7 + yy * 1.3) > 0.42;
        if (on) H.rr(c, xx, yy, 10, 14, 1, U.hash(xx + yy) > 0.8 ? '#ffe6a0' : '#f1c96a');
      }
    }
    // harbour cranes on the left
    for (const [x, s] of [[70, 1], [250, 0.8]]) {
      c.save(); c.translate(x, base); c.scale(s, s); c.strokeStyle = '#120f26'; c.lineWidth = 12;
      c.beginPath(); c.moveTo(-50, 0); c.lineTo(-10, -420); c.lineTo(30, 0); c.moveTo(-10, -420); c.lineTo(220, -420); c.moveTo(-10, -420); c.lineTo(-90, -400); c.moveTo(-10, -380); c.lineTo(180, -420); c.stroke();
      H.line(c, 190, -420, 190, -300, '#120f26', 4); H.rr(c, 176, -300, 28, 20, 2, '#120f26');
      H.circ(c, -10, -432, 6, U.hash(Math.floor(t * 2) + x) > 0.4 ? '#ff4040' : '#5a1010');
      c.restore();
    }
    // lighthouse on the right with a sweeping beam
    c.save(); c.translate(960, base);
    H.poly(c, [[-40, 0], [40, 0], [26, -330], [-26, -330]], '#e9e4dc');
    for (let k = 0; k < 3; k++) H.poly(c, [[-38 + k * 4.6, -60 - k * 100], [38 - k * 4.6, -60 - k * 100], [36 - k * 4.6, -100 - k * 100], [-36 + k * 4.6, -100 - k * 100]], '#c0392b');
    H.rr(c, -30, -380, 60, 50, 4, '#ffe9a6'); H.poly(c, [[-36, -380], [36, -380], [0, -420]], '#2a2440');
    c.restore();
    const ang = Math.PI + Math.sin(t * 1.1) * 0.55;
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(960, base - 355);
    c.fillStyle = H.lg(c, 0, 0, Math.cos(ang) * 900, Math.sin(ang) * 900, [[0, 'rgba(255,240,180,0.45)'], [1, 'rgba(255,240,180,0)']]);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(ang - 0.09) * 1000, Math.sin(ang - 0.09) * 1000); c.lineTo(Math.cos(ang + 0.09) * 1000, Math.sin(ang + 0.09) * 1000); c.closePath(); c.fill();
    c.restore();
    // water with reflections
    c.fillStyle = H.lg(c, 0, base, 0, HT + 200, [[0, '#1b2452'], [1, '#080b20']]); c.fillRect(-200, base, W + 400, HT);
    for (let i = 0; i < 60; i++) {
      const x = U.hash(i * 2.7) * W, y = base + 20 + U.hash(i * 5.1) * 520, w = 30 + U.hash(i) * 70;
      const sh = Math.sin(t * 3 + i) * 10;
      H.rr(c, x + sh, y, w, 4, 2, `rgba(241,201,106,${0.12 + 0.2 * U.hash(i * 9)})`);
    }
    // police lights
    const ph = Math.floor(t * 4) % 2;
    glow(c, 120, 1640, 520, ph ? '255,40,40' : '40,90,255', 0.35);
    glow(c, 960, 1700, 360, ph ? '40,90,255' : '255,40,40', 0.18);
    // two strips of police tape
    for (const [y, rot, off] of [[1520, -0.11, 0], [1640, 0.07, 140]]) {
      c.save(); c.translate(540, y + Math.sin(t * 1.4 + off) * 4); c.rotate(rot);
      H.rr(c, -800, -34, 1600, 68, 0, '#f5d132');
      c.fillStyle = '#1b1b1b'; c.fillRect(-800, -34, 1600, 5); c.fillRect(-800, 29, 1600, 5);
      c.font = `800 30px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      for (let x = -900 + ((t * 30 + off) % 420); x < 800; x += 420) c.fillText('POLICE LINE · DO NOT CROSS', x, 2);
      c.restore();
    }
    vignette(c, 0.45);
  };

  // 3: the evidence card — empty, then the bookmark
  S.evidence = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.05);
    c.fillStyle = H.rg(c, 540, 860, 60, 1300, [[0, '#33465e'], [1, '#0f1622']]); c.fillRect(-200, -200, W + 400, HT + 400);
    const k = U.backOut(U.clamp(lt / 0.35)) * 0.1 + 0.9;
    c.save(); c.translate(540, 860); c.scale(k, k);
    H.rr(c, -270, -400, 540, 800, 30, 'rgba(255,255,255,0.07)');
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 4; c.beginPath(); c.roundRect(-270, -400, 540, 800, 30); c.stroke();
    H.rr(c, -270, -400, 540, 84, [30, 30, 0, 0], '#c8323a');
    H.text(c, 'EVIDENCE', 0, -356, `800 40px ${FONT}`, '#fff');
    H.rr(c, -210, 250, 420, 100, 12, '#f6f6f2');
    H.text(c, 'CASE #0611 · PORT HALDEN PD', 0, 285, `700 22px ${FONT}`, '#333');
    H.text(c, 'ITEM 1 of 3', 0, 320, `700 20px ${FONT}`, '#666');
    const b = pop(t, TL.bookmarkIn - 0.1, 0.4);
    if (b > 0) { c.save(); c.translate(0, -50); c.scale(0.55 + 0.45 * b, 0.55 + 0.45 * b); c.globalAlpha = U.clamp(b); P.bookmark(c, { rot: -0.1, blood: 1 }); c.restore(); }
    else H.text(c, '?', 0, -50, `800 200px ${FONT}`, 'rgba(255,255,255,0.12)');
    c.restore();
    P.sparkles(c, 540, 810, 260, 10, ramp(t, TL.bookmarkIn, 0.9), 2);
    vignette(c, 0.4);
  };

  // 4: the crime-lab corkboard
  S.board = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.05);
    c.fillStyle = H.lg(c, 0, 0, 0, HT, [[0, '#e3e9ef'], [1, '#aeb9c6']]); c.fillRect(-200, -200, W + 400, HT + 400);
    H.rr(c, 170, 300, 740, 70, 10, COL.navy);
    H.text(c, 'PORT HALDEN PD · CRIME LAB', 540, 336, `800 32px ${FONT}`, '#fff');
    H.rr(c, 120, 410, 840, 700, 12, '#7a5230');
    c.fillStyle = '#c99c64'; c.fillRect(140, 430, 800, 660);
    for (let i = 0; i < 160; i++) H.circ(c, 140 + U.hash(i * 1.1) * 800, 430 + U.hash(i * 2.3) * 660, 2 + U.hash(i) * 2, 'rgba(110,70,30,0.35)');
    const photos = [[230, 520], [800, 500], [260, 900], [820, 930], [540, 980]];
    photos.forEach(([x, y], i) => {
      c.save(); c.translate(x, y); c.rotate((U.hash(i * 3) - 0.5) * 0.2);
      H.rr(c, -70, -80, 140, 160, 4, '#fbfbf6'); H.rr(c, -58, -68, 116, 110, 2, ['#8aa0b8', '#9a8a7a', '#7d8f7c', '#a68c8c', '#8b98a8'][i]);
      H.circ(c, -10, -20, 22, 'rgba(255,255,255,0.35)'); c.restore();
      H.circ(c, x, y - 86, 9, '#d33');
    });
    const bms = [[440, 620], [680, 640], [560, 820]];
    // red string drawn from pin to pin
    const sp = ramp(t, TL.strings - 0.15, 0.9);
    const path = [photos[0], bms[0], bms[2], bms[1], photos[1], bms[1], photos[3], bms[2], photos[2]];
    c.strokeStyle = '#c4161c'; c.lineWidth = 4;
    const n = path.length - 1, upto = sp * n;
    c.beginPath(); c.moveTo(path[0][0], path[0][1] - 86);
    for (let i = 0; i < n; i++) {
      const f = U.clamp(upto - i); if (f <= 0) break;
      const [x0, y0] = i === 0 ? [path[0][0], path[0][1] - 86] : path[i], [x1, y1] = path[i + 1];
      c.lineTo(U.lerp(x0, x1, f), U.lerp(y0, y1, f));
    }
    c.stroke();
    bms.forEach(([x, y], i) => { c.save(); c.translate(x, y); c.scale(0.38, 0.38); P.bookmark(c, { rot: (i - 1) * 0.12, blood: 1 }); c.restore(); H.circ(c, x, y - 66, 10, '#d33'); });
    // Silas in the foreground, looking up at the board
    ch(c, 'silas', 540, 1500, 1.12, { t, expr: 'squint', look: [0.2, -0.9] });
    vignette(c, 0.35);
  };

  // 5: the map — three pins, dashed lines, one shop
  S.map = function (c, t, lt, d) {
    cam(c, t, lt, d, 600, 820, 1, 1.06);
    c.fillStyle = '#ecdcb8'; c.fillRect(-200, -200, W + 400, HT + 400);
    // parks
    for (const [x, y, w, h] of [[640, 300, 200, 150], [300, 1180, 260, 160], [820, 1080, 180, 220]]) H.rr(c, x, y, w, h, 14, '#bcd49a');
    // street grid (slightly rotated)
    c.save(); c.translate(540, 900); c.rotate(0.12);
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 12;
    for (let x = -900; x <= 900; x += 120) { c.beginPath(); c.moveTo(x, -1300); c.lineTo(x, 1300); c.stroke(); }
    for (let y = -1300; y <= 1300; y += 130) { c.beginPath(); c.moveTo(-900, y); c.lineTo(900, y); c.stroke(); }
    c.lineWidth = 26; c.beginPath(); c.moveTo(-900, 260); c.lineTo(900, -160); c.stroke();
    c.restore();
    // the harbour on the left
    c.fillStyle = '#a7d3dc';
    c.beginPath(); c.moveTo(-200, -200); c.lineTo(250, -200);
    for (let y = -200; y <= HT + 200; y += 80) c.lineTo(200 + Math.sin(y * 0.006) * 60 + Math.sin(y * 0.017) * 18, y);
    c.lineTo(-200, HT + 200); c.closePath(); c.fill();
    for (let i = 0; i < 4; i++) H.rr(c, 150 + Math.sin(i * 2) * 30, 420 + i * 260, 90, 18, 4, '#ecdcb8');   // piers
    H.text(c, 'PORT HALDEN', 360, 300, `800 46px ${FONT}`, 'rgba(120,100,70,0.75)');
    H.text(c, 'harbour', 110, 760, `italic 600 28px ${FONT}`, 'rgba(60,110,130,0.7)');
    const M = [640, 820];
    const pins = [[430, 560], [860, 620], [520, 1100]];
    // dashed lines to the meeting point
    const lp = ramp(t, TL.mapLines, 0.55);
    if (lp > 0) {
      c.save(); c.strokeStyle = '#d4232b'; c.lineWidth = 6; c.setLineDash([16, 14]); c.lineCap = 'round';
      for (const [x, y] of pins) { c.beginPath(); c.moveTo(x, y - 70); c.lineTo(U.lerp(x, M[0], lp), U.lerp(y - 70, M[1], lp)); c.stroke(); }
      c.restore();
    }
    const dk = pop(t, TL.mapDisc, 0.38);
    if (dk > 0) {
      c.save(); c.translate(M[0], M[1]); c.scale(dk, dk);
      H.circ(c, 0, 0, 92, '#141414');
      // little shopfront icon
      H.rr(c, -46, -20, 92, 62, 4, '#fff'); H.poly(c, [[-56, -20], [56, -20], [44, -52], [-44, -52]], '#fff');
      H.rr(c, -10, 6, 20, 36, 2, '#141414'); H.rr(c, -38, -6, 20, 20, 2, '#141414'); H.rr(c, 18, -6, 20, 20, 2, '#141414');
      H.text(c, '?', 58, -58, `900 54px ${FONT}`, '#ffd34d');
      c.restore();
    }
    pins.forEach(([x, y], i) => {
      const k = pop(t, TL.pins[i], 0.35); if (k <= 0) return;
      c.save(); c.translate(x, y - (1 - U.clamp(k)) * 120); P.pin(c, 0.9 * k); c.restore();
    });
    vignette(c, 0.3);
  };

  // 6: the shopfront — WREN & PAGE
  S.shop = function (c, t, lt, d) {
    cam(c, t, lt, d, 600, 880, 1, 1.05);
    c.fillStyle = '#10141f'; c.fillRect(-200, -200, W + 400, HT + 400);
    // facade
    H.rr(c, 40, 240, 1000, 1180, 6, '#1f4a3a');
    H.rr(c, 40, 240, 1000, 40, 0, '#173a2d');
    // sign
    const sg = ramp(t, TL.shopSign, 0.3);
    H.rr(c, 90, 320, 900, 210, 10, '#0f2a20');
    c.strokeStyle = COL.gold; c.lineWidth = 5; c.beginPath(); c.roundRect(104, 334, 872, 182, 8); c.stroke();
    if (sg > 0) glow(c, 540, 420, 520, '255,210,110', 0.18 * sg);
    H.text(c, 'WREN & PAGE', 560, 408, `900 92px ${FONT}`, '#f2c14e');
    H.text(c, 'USED BOOKS · EST. 1987', 560, 478, `700 30px ${FONT}`, '#d8b45a');
    P.wren(c, 170, 410, 1.1, '#f2c14e');
    // display window
    H.rr(c, 90, 600, 520, 560, 6, '#0f2a20');
    c.fillStyle = H.rg(c, 350, 880, 30, 420, [[0, '#ffd99a'], [1, '#b8742e']]); c.fillRect(110, 620, 480, 520);
    for (let r = 0; r < 3; r++) { P.shelfRow(c, 120, 580, 800 + r * 160, 120, 40 + r * 7); H.rr(c, 110, 800 + r * 160, 480, 12, 0, '#5b3720'); }
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(110, 620); c.lineTo(300, 620); c.lineTo(110, 900); c.fill();
    // door
    H.rr(c, 660, 600, 320, 760, 6, '#163528');
    H.rr(c, 690, 630, 260, 330, 4, '#ffcf8a');
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(690, 630); c.lineTo(820, 630); c.lineTo(690, 820); c.fill();
    H.rr(c, 690, 990, 260, 340, 4, '#123024');
    H.circ(c, 940, 1060, 14, COL.gold);
    // OPEN sign on a string + bell
    H.line(c, 770, 650, 820, 700, '#2a2a2a', 3); H.line(c, 870, 650, 820, 700, '#2a2a2a', 3);
    c.save(); c.translate(820, 760); c.rotate(Math.sin(t * 2) * 0.03); H.rr(c, -90, -40, 180, 80, 8, '#fdf6e3'); H.text(c, 'OPEN', 0, 2, `900 46px ${FONT}`, '#2f6f5a'); c.restore();
    c.save(); c.translate(820, 590); c.rotate(Math.sin(t * 9) * 0.25 * Math.exp(-lt * 2)); H.poly(c, [[-20, 0], [20, 0], [12, -30], [-12, -30]], COL.gold); H.circ(c, 0, 4, 6, COL.gold); c.restore();
    // pavement + reflections
    c.fillStyle = H.lg(c, 0, 1420, 0, HT, [[0, '#262b36'], [1, '#0d0f15']]); c.fillRect(-200, 1420, W + 400, 700);
    glow(c, 820, 1520, 300, '255,200,120', 0.18); glow(c, 350, 1500, 300, '255,200,120', 0.15);
    rain(c, t, 0.22);
    // Silas walks into frame from the left
    const e = U.easeOut(ramp(lt, 0.0, 0.7));
    ch(c, 'silas', U.lerp(-200, 230, e), 1450, 1.32, { t, expr: 'squint', look: [0.8, -0.4] });
    vignette(c, 0.45);
  };

  // shared bookshop interior
  function shopInterior(c, t, tint = 0) {
    c.fillStyle = '#2a1810'; c.fillRect(-200, -200, W + 400, HT + 400);
    P.shelves(c, -100, 180, W + 200, 1080, 4, 11);
    // pendant lamp
    H.line(c, 540, -200, 540, 150, '#222', 4);
    H.poly(c, [[470, 190], [610, 190], [580, 140], [500, 140]], '#2f5e4e'); H.ell(c, 540, 192, 70, 10, '#ffe6a8');
    glow(c, 540, 260, 700, '255,190,110', 0.28);
    if (tint) { c.fillStyle = `rgba(20,0,4,${tint})`; c.fillRect(-200, -200, W + 400, HT + 400); }
  }

  // 7: Ezra behind the counter closes his book and smiles
  S.counter = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 880, 1, 1.05);
    shopInterior(c, t);
    const cl = ramp(t, TL.bookClose, 0.18);
    const talking = TL.mouth(t, TL.ezraLine1[0], TL.ezraLine1[1]);
    const expr = t >= TL.ezraSmile ? (t > TL.ezraLine1[1] + 0.2 ? 'smug' : 'smile') : 'neutral';
    const look = t < TL.bookClose ? [0.1, 0.9] : [0, 0];
    const book = (cc) => {
      // the book held at chest height: open pages fold shut on "closed"
      cc.save(); cc.translate(0, 236);
      const a = (1 - cl) * 0.9;
      for (const s of [-1, 1]) {
        cc.save(); cc.scale(s, 1); cc.transform(1, -Math.sin(a) * 0.35, 0, 1, 0, 0);
        H.rr(cc, 0, -70, 110 * Math.cos(a * 0.9) + 8, 140, 4, '#7c1d2b');
        if (a > 0.05) { H.rr(cc, 4, -64, 100 * Math.cos(a * 0.9), 128, 2, '#f6efdc'); for (let i = 0; i < 6; i++) H.rr(cc, 16, -46 + i * 18, 70 * Math.cos(a), 4, 2, '#c8bfa8'); }
        cc.restore();
      }
      if (cl >= 1) { H.rr(cc, -4, -70, 14, 140, 3, '#5c1220'); H.text(cc, 'W&P', 60, 0, `800 26px ${FONT}`, COL.gold); }
      cc.restore();
    };
    ch(c, 'ezra', 540, 820, 1.3, { t, expr, talk: talking, look, arms: { l: [-70, 240], r: [70, 240] }, prop: book });
    // counter
    H.rr(c, -100, 1180, W + 200, 40, 6, '#6b4026');
    c.fillStyle = H.lg(c, 0, 1220, 0, HT, [[0, '#4a2a17'], [1, '#2a170c']]); c.fillRect(-100, 1220, W + 200, 800);
    for (let i = 0; i < 6; i++) H.rr(c, -60 + i * 210, 1260, 180, 600, 10, 'rgba(0,0,0,0.12)');
    // stack of books + a brass bell on the counter
    for (let i = 0; i < 4; i++) H.rr(c, 90 + i * 6, 1180 - (i + 1) * 34, 190 - i * 14, 32, 4, ['#2f5e4e', '#c9962f', '#3c4f7a', '#8a2d2d'][i]);
    H.ell(c, 900, 1178, 60, 12, '#8a6a2a'); c.beginPath(); c.arc(900, 1176, 46, Math.PI, 0); c.fillStyle = '#d8a948'; c.fill(); H.circ(c, 900, 1124, 10, '#d8a948');
    P.sparkles(c, 540, 1060, 180, 8, ramp(t, TL.bookClose, 0.6), 7);
    vignette(c, 0.45);
  };

  // 8: the darkness behind Silas, seen for the first time
  S.shadow = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.06);
    const r = U.easeInOut(ramp(t, TL.shadowRise - 0.2, 1.3));
    shopInterior(c, t, 0.15 + 0.6 * r);
    if (r > 0) { c.fillStyle = `rgba(90,0,12,${0.35 * r})`; c.fillRect(-200, -200, W + 400, HT + 400); }
    const eyes = U.easeOut(ramp(t, TL.shadowEyes, 0.25));
    if (r > 0) { c.save(); c.translate(540, U.lerp(1500, 520, r)); c.scale(2.3, 2.3); shadowSelf(c, { alpha: U.clamp(r * 1.5), eyes }); c.restore(); }
    if (eyes > 0) glow(c, 540, 500, 420, '255,30,40', 0.25 * eyes);
    const expr = t > TL.shadowEyes + 0.6 ? 'smirk' : 'squint';
    ch(c, 'silas', 540, 980, 1.3, { t, expr, look: [0, 0] });
    vignette(c, 0.55 + 0.2 * r);
  };

  // 9: Ezra leans in and whispers
  S.lean = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 960, 1, 1.05);
    shopInterior(c, t, 0.1);
    H.rr(c, -100, 1380, W + 200, 600, 0, '#3b2213');
    const ln = U.easeInOut(ramp(t, TL.lean, 0.6));
    const shocked = t >= TL.relax && t < TL.people1 + 0.4;
    ch(c, 'silas', 320, 960, 1.08, { t, expr: shocked ? 'shock' : 'squint', look: [0.8, 0] });
    const wm = TL.mouth(t, TL.whisper[0], TL.whisper[1]);
    const expr = t > TL.whisper[1] ? 'smile' : t >= TL.whisper[0] ? 'whisper' : 'smug';
    ch(c, 'ezra', U.lerp(770, 730, ln), 960, 1.08, { t, expr, talk: wm * 0.55, look: [-0.8, 0], lean: -0.17 * ln, headTilt: -0.12 * ln });
    // whisper curls
    if (wm > 0 || (t > TL.whisper[0] && t < TL.whisper[1])) {
      c.save(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 5; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const p = (t * 1.6 + i / 3) % 1, x = U.lerp(560, 470, p), y = 930 + (i - 1) * 34; c.globalAlpha = Math.sin(p * Math.PI); c.beginPath(); c.arc(x, y, 18, -0.9, 0.9); c.stroke(); }
      c.restore();
    }
    vignette(c, 0.45);
  };

  // 10: after closing — the sign flips
  S.backroom = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.05);
    wallpaper(c, '#1f3a30', 'rgba(255,220,150,0.06)');
    // the shop door at the left with the sign
    H.rr(c, 70, 260, 360, 1100, 8, '#163528');
    windowNight(c, 110, 300, 280, 420, t);
    const f = ramp(t, TL.signFlip, 0.35), sx = Math.cos(f * Math.PI);
    H.line(c, 190, 300, 250, 400, '#cfcfcf', 3); H.line(c, 310, 300, 250, 400, '#cfcfcf', 3);
    c.save(); c.translate(250, 470); c.scale(Math.max(0.02, Math.abs(sx)), 1);
    H.rr(c, -110, -56, 220, 112, 10, '#fdf6e3');
    if (sx >= 0) H.text(c, 'OPEN', 0, 2, `900 54px ${FONT}`, '#2f6f5a'); else H.text(c, 'CLOSED', 0, 2, `900 46px ${FONT}`, '#b3262c');
    c.restore();
    // lamp on a side table
    c.save(); c.translate(900, 640); P.lamp(c, 1); c.restore();
    H.rr(c, 790, 800, 220, 20, 4, COL.wood);
    H.rr(c, -100, 1380, W + 200, 600, 0, '#2b1a10');
    ch(c, 'silas', 360, 1010, 1.05, { t, expr: 'squint', look: [0.8, 0] });
    const g2 = U.easeOut(ramp(t, TL.shots[9][0] + 0.2, 0.5));
    ch(c, 'ezra', 790, 990, 1.05, { t, expr: 'smile', look: [-0.6, 0], arms: { l: [U.lerp(-140, -230, g2), U.lerp(350, 180, g2)] }, bendL: -0.6 });
    vignette(c, 0.45);
  };

  // 11: Silas came prepared — the black case
  S.case = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.06);
    wallpaper(c, '#1f3a30', 'rgba(255,220,150,0.06)');
    c.save(); c.translate(140, 720); P.lamp(c, 1); c.restore();
    const expr = t >= TL.justInCase ? 'smirk' : 'squint';
    ch(c, 'silas', 560, 820, 1.3, { t, expr, look: t >= TL.justInCase ? [0, 0] : [0.2, 0.6], arms: { l: 'table', r: 'table' } });
    H.rr(c, -100, 1180, W + 200, 30, 4, '#6b4026');
    c.fillStyle = H.lg(c, 0, 1210, 0, HT, [[0, '#4a2a17'], [1, '#22130a']]); c.fillRect(-100, 1210, W + 200, 800);
    c.save(); c.translate(560, 1150); P.blackCase(c, { glint: ramp(t, TL.caseGlint, 0.45) }); c.restore();
    P.sparkles(c, 700, 1060, 120, 6, ramp(t, TL.caseGlint + 0.2, 0.6), 3);
    vignette(c, 0.5);
  };

  // 12: but Ezra brought a box of receipts
  S.box = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.06);
    wallpaper(c, '#1f3a30', 'rgba(255,220,150,0.06)');
    c.save(); c.translate(940, 720); P.lamp(c, 1); c.restore();
    const push = U.easeOut(ramp(t, TL.boxPush, 0.4));
    ch(c, 'ezra', 540, 820, 1.3, { t, expr: t > TL.receiptsFly ? 'grin' : 'smile', look: [0, 0.3], arms: { l: [-120, U.lerp(280, 330, push)], r: [120, U.lerp(280, 330, push)] } });
    H.rr(c, -100, 1180, W + 200, 30, 4, '#6b4026');
    c.fillStyle = H.lg(c, 0, 1210, 0, HT, [[0, '#4a2a17'], [1, '#22130a']]); c.fillRect(-100, 1210, W + 200, 800);
    const lift = Math.sin(U.clamp((t - TL.receiptsFly) / 0.9) * Math.PI);
    c.save(); c.translate(540, U.lerp(1180, 1230, push)); c.scale(U.lerp(0.9, 1.05, push), U.lerp(0.9, 1.05, push)); P.receiptBox(c, { lift }); c.restore();
    vignette(c, 0.5);
  };

  // 13: the receipts — every one a Friday
  S.receipts = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1.06, 1);
    c.fillStyle = '#5b3720'; c.fillRect(-200, -200, W + 400, HT + 400);
    for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(30,15,5,${0.15 + U.hash(i) * 0.15})`; c.lineWidth = 2 + U.hash(i * 3) * 4; const y = -100 + i * 55; c.beginPath(); c.moveTo(-200, y); c.bezierCurveTo(300, y + 30, 700, y - 30, 1300, y + 10); c.stroke(); }
    const R = [[300, 760, -0.13, 'THE QUIET HOUR', '6:42 PM', '0611'], [570, 700, 0.04, 'A HOUSE OF SALT', '6:38 PM', '0611'], [810, 800, 0.15, 'NIGHT TIDE', '6:45 PM', '0611']];
    R.forEach(([x, y, rot, title, time, card], i) => {
      const k = pop(t, TL.receiptPops[i] - 0.05, 0.35); if (k <= 0) return;
      c.save(); c.translate(x, y + (1 - U.clamp(k)) * 200); c.scale(0.86 * k, 0.86 * k);
      P.receipt(c, { rot, title, time, card, mark: ramp(t, TL.fridayMark + i * 0.12, 0.35) });
      c.restore();
    });
    if (t > TL.fridayMark) { const k = pop(t, TL.fridayMark + 0.4, 0.3); c.save(); c.translate(540, 1150); c.scale(k, k); H.rr(c, -230, -48, 460, 96, 48, '#d4232b'); H.text(c, 'EVERY FRIDAY', 0, 2, `900 50px ${FONT}`, '#fff'); c.restore(); }
    vignette(c, 0.45);
  };

  // 14: "...and I remember every customer."
  S.temple = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 860, 1, 1.06);
    shopInterior(c, t, 0.35);
    const talk = TL.mouth(t, TL.ezraLine2[0], TL.ezraLine2[1]);
    const expr = t > TL.ezraLine2[1] ? 'grin' : 'smug';
    // a ring of customer faces pops in around his head
    const cols = ['#e8b88f', '#c98d63', '#f1d0b5', '#a8724e', '#e2b088', '#8d5a3b', '#f4d3b5', '#d7a27a', '#b67c55', '#efc7a4'];
    const hairs = ['#2a1d18', '#6b3e1f', '#d8b25a', '#1d1d24', '#9a9a9a', '#3a2a24', '#b44a2a', '#1d1d24', '#5a3520', '#e0c58a'];
    for (let i = 0; i < 10; i++) {
      const k = pop(t, TL.faces + i * 0.07, 0.3); if (k <= 0) continue;
      const a = -Math.PI / 2 + (i / 10) * TAU + t * 0.25, x = 540 + Math.cos(a) * 330, y = 800 + Math.sin(a) * 330;
      c.save(); c.translate(x, y); c.scale(0.5 * k, 0.5 * k);
      H.circ(c, 0, 4, 136, 'rgba(0,0,0,0.35)'); H.circ(c, 0, 0, 132, '#fdf6e3'); H.circ(c, 0, 0, 118, '#c9962f');
      c.beginPath(); c.arc(0, 0, 118, 0, TAU); c.clip();
      H.rr(c, -90, 70, 180, 120, 60, ['#3c4f7a', '#7c1d2b', '#2f5e4e', '#5a2f5e', '#8a5a3a'][i % 5]);
      H.circ(c, 0, 0, 100, cols[i]); c.beginPath(); c.arc(0, -10, 104, Math.PI * 1.05, Math.PI * 1.95); c.fillStyle = hairs[i]; c.fill();
      H.circ(c, -34, 6, 12, '#2a1a14'); H.circ(c, 34, 6, 12, '#2a1a14');
      H.line(c, -18, 50, 18, 50, '#2a1a14', 7);
      c.restore();
    }
    ch(c, 'ezra', 540, 880, 1.42, { t, expr, talk, look: [0, 0], arms: { r: 'temple' }, bendR: -0.4 });
    vignette(c, 0.5);
  };

  // 15: the skills — Silas reads the blood, Ezra reads the people
  S.skills = function (c, t, lt, d) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    // top half: the lab
    c.save(); c.beginPath(); c.rect(0, 0, W, 960); c.clip();
    cam(c, t, lt, d, 540, 480, 1, 1.04, 540, 480);
    c.fillStyle = H.lg(c, 0, 0, 0, 960, [[0, '#eef2f5'], [1, '#c9d3dc']]); c.fillRect(-200, -200, W + 400, 1300);
    H.rr(c, 470, 200, 520, 560, 10, '#9aa6b2'); H.rr(c, 486, 216, 488, 528, 6, '#fff');
    const P0 = [700, 560];
    const drops = [[560, 300, 0.9], [880, 290, 2.3], [930, 520, 3.3], [600, 690, 5.0], [820, 700, 4.2], [530, 470, 6.0], [760, 330, 1.6]];
    drops.forEach(([x, y], i) => {
      const k = ramp(t, TL.shots[15][0] + 0.15 + i * ((TL.blood - TL.shots[15][0]) / drops.length), 0.12); if (k <= 0) return;
      const ang = Math.atan2(y - P0[1], x - P0[0]);
      c.save(); c.globalAlpha = 0.45 * k; c.strokeStyle = '#c4161c'; c.lineWidth = 2; c.setLineDash([8, 8]);
      c.beginPath(); c.moveTo(x, y); c.lineTo(P0[0], P0[1]); c.stroke(); c.restore();
      c.save(); c.translate(x, y); c.rotate(ang + Math.PI); c.scale(k, k);
      H.ell(c, 0, 0, 22, 14, '#b3121b'); H.poly(c, [[14, -8], [60, 0], [14, 8]], '#b3121b'); H.circ(c, 76, 0, 5, '#b3121b');
      c.restore();
    });
    ringMark(c, P0[0], P0[1], 36, 36, ramp(t, TL.blood, 0.3), '#c4161c', 6);
    ch(c, 'silas', 290, 600, 0.95, { t, expr: 'squint', look: [0.9, -0.2], arms: { r: [300, 40] }, bendR: -0.5 });
    c.restore();
    // bottom half: the shop, Ezra fades in, a thought bubble
    c.save(); c.beginPath(); c.rect(0, 960, W, 960); c.clip();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = H.lg(c, 0, 960, 0, HT, [[0, '#3a2214'], [1, '#1a0e07']]); c.fillRect(0, 960, W, 960);
    c.save(); c.globalAlpha = 0.35; P.shelves(c, -60, 1000, W + 120, 560, 2, 77); c.restore();
    const fa = U.lerp(0.25, 1, U.easeOut(ramp(t, TL.ezraIn - 0.3, 0.6)));
    ch(c, 'ezra', 720, 1540, 0.95, { t, expr: t > TL.bubble ? 'smug' : 'smile', look: [-0.5, -0.4], alpha: fa });
    const bk = pop(t, TL.bubble - 0.05, 0.35);
    if (bk > 0) {
      for (const [x, y, r] of [[590, 1400, 14], [530, 1340, 22]]) H.circ(c, x, y, r * bk, '#fff');
      c.save(); c.translate(330, 1180); c.scale(bk, bk);
      H.ell(c, 0, 0, 170, 120, '#fff');
      H.circ(c, -36, -24, 40, '#1a1a1a'); H.rr(c, -96, 20, 120, 80, [60, 60, 0, 0], '#1a1a1a');
      c.save(); c.beginPath(); c.ellipse(0, 0, 170, 120, 0, 0, TAU); c.clip(); c.restore();
      c.strokeStyle = '#1a1a1a'; c.lineWidth = 9; c.beginPath(); c.arc(60, -10, 34, 0, TAU); c.stroke(); H.line(c, 84, 14, 116, 46, '#1a1a1a', 12);
      c.restore();
    }
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    H.rr(c, 0, 954, W, 12, 0, COL.seam);
    vignette(c, 0.35);
  };

  // the special red book (the bait) with a bookmark poking out
  function baitBook(c, x, y, w, h, glowA) {
    if (glowA > 0) glow(c, x + w / 2, y - h / 2, h, '255,80,60', 0.35 * glowA);
    // bookmark tassel poking out of the top
    H.rr(c, x + w * 0.55, y - h - 50, w * 0.28, 70, 3, '#7c1d2b'); H.line(c, x + w * 0.7, y - h - 50, x + w * 0.9, y - h - 90, COL.gold, 3);
    P.spine(c, x, y, w, h, '#a0141f', { title: 'THE QUIET HOUR', titleCol: '#ffe08a' });
  }

  // 16: the trap — one book, one shelf
  S.shelf = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 760, 1, 1.05);
    c.fillStyle = '#1e120b'; c.fillRect(-200, -200, W + 400, HT + 400);
    const x0 = 60, y0 = 240, w = 960, h = 1000, rows = 4, rh = h / rows;
    P.shelves(c, x0, y0, w, h, rows, 23);
    const by = y0 + rh * 2 - 14;   // the third row's baseline
    const bx = 560, bw = 60, bh = rh * 0.74;
    const out = U.easeOut(ramp(t, TL.bookOut, 0.25));
    c.fillStyle = '#120a06'; c.fillRect(bx - 6, by - bh - 30, bw + 12, bh + 30);
    c.save(); c.translate(0, -out * 16); baitBook(c, bx, by, bw, bh, ramp(t, TL.trapCircle, 0.4)); c.restore();
    ringMark(c, bx + bw / 2, by - bh / 2 - 10, 90, bh * 0.68, ramp(t, TL.trapCircle - 0.05, 0.4));
    // "one shelf": everything else dims
    const dim = ramp(t, TL.shelfMark, 0.3) * 0.62;
    if (dim > 0) {
      c.fillStyle = `rgba(0,0,0,${dim})`;
      c.fillRect(-200, -200, W + 400, by - rh + 4 + 200); c.fillRect(-200, by + 20, W + 400, HT + 400);
      c.strokeStyle = `rgba(242,193,78,${dim * 1.4})`; c.lineWidth = 6; c.beginPath(); c.roundRect(x0 - 10, by - rh + 4, w + 20, rh + 16, 8); c.stroke();
    }
    H.rr(c, -200, y0 + h + 30, W + 400, 800, 0, '#140b06');
    vignette(c, 0.45);
  };

  // 17: That Friday — the gloved hand reaches, Silas grabs it, CASE CLOSED
  S.caught = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1.03, 1.08);
    c.fillStyle = '#1e120b'; c.fillRect(-200, -200, W + 400, HT + 400);
    // a big close shelf
    c.fillStyle = '#2a1810'; c.fillRect(-200, 300, W + 400, 960);
    P.shelfRow(c, -120, 470, 1180, 760, 61);
    P.shelfRow(c, 640, 1260, 1180, 760, 67);
    c.fillStyle = '#120a06'; c.fillRect(475, 300, 160, 880);
    baitBook(c, 490, 1180, 130, 720, 0.6);
    H.rr(c, -200, 1180, W + 400, 44, 3, COL.wood);
    c.fillStyle = '#140b06'; c.fillRect(-200, 1224, W + 400, 800);
    // the gloved hand
    const re = U.easeOut(ramp(t, TL.reach, 0.6)), grip = U.easeOut(ramp(t, TL.grip, 0.2));
    if (re > 0) { c.save(); c.translate(U.lerp(1450, 740, re), 840); P.glove(c, grip); c.restore(); }
    // Silas's hand clamps the wrist
    const gr = U.easeOut(ramp(t, TL.grab, 0.14));
    if (gr > 0) { c.save(); c.translate(860, U.lerp(-500, 830, gr)); P.grab(c); c.restore(); }
    vignette(c, 0.5);
    // CASE CLOSED
    const st = ramp(t, TL.stamp, 0.14);
    if (st > 0) {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      const s = shake(t); c.translate(540 + s.x, 520 + s.y); c.rotate(-0.12);
      const k = U.lerp(2.4, 1, U.easeIn(st)); c.scale(k, k); c.globalAlpha = U.clamp(st * 1.5);
      P.stamp(c); c.restore();
      const fl = 1 - ramp(t, TL.stamp, 0.25);
      if (fl > 0 && fl < 1) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(255,60,60,${0.25 * fl})`; c.fillRect(0, 0, W, HT); }
    }
  };

  // 18: the police never found out
  S.police = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.05);
    c.fillStyle = H.lg(c, 0, 0, 0, HT, [[0, '#dfe6ee'], [1, '#aab6c3']]); c.fillRect(-200, -200, W + 400, HT + 400);
    H.rr(c, 170, 280, 740, 70, 10, COL.navy);
    H.text(c, 'PORT HALDEN PD · HOMICIDE', 540, 316, `800 32px ${FONT}`, '#fff');
    H.rr(c, 110, 390, 860, 560, 12, '#7a5230'); c.fillStyle = '#c99c64'; c.fillRect(130, 410, 820, 520);
    for (const [x, y, r, q] of [[230, 500, -0.1, 1], [400, 470, 0.08, 0], [690, 490, -0.06, 1], [850, 520, 0.1, 0], [260, 780, 0.06, 0], [830, 800, -0.08, 1]]) {
      c.save(); c.translate(x, y); c.rotate(r); H.rr(c, -70, -50, 140, 100, 4, q ? '#e2463f' : '#fbfbf6'); if (!q) for (let k = 0; k < 4; k++) H.rr(c, -50, -30 + k * 18, 90, 5, 2, '#bbb'); c.restore();
    }
    ch(c, 'detective', 540, 980, 1.15, { t, expr: 'shock', look: [0.2, -0.3], arms: { r: 'temple' }, bendR: -0.4 });
    TL.questions.forEach((q, i) => {
      const k = pop(t, q, 0.3); if (k <= 0) return;
      const [x, y] = [[330, 720], [760, 690], [880, 900]][i];
      c.save(); c.translate(x, y + Math.sin(t * 5 + i) * 8); c.rotate(Math.sin(t * 3 + i * 2) * 0.15); c.scale(k, k);
      label(c, '?', 0, 0, 130, i === 1 ? '#ffd34d' : '#ff4b4b', 900); c.restore();
    });
    // desk + newspaper
    H.rr(c, -100, 1440, W + 200, 40, 4, '#6b4026'); c.fillStyle = '#4a2a17'; c.fillRect(-100, 1480, W + 200, 600);
    c.save(); c.translate(540, 1500); c.rotate(-0.04);
    H.rr(c, -300, -120, 600, 300, 4, '#f3efe3');
    H.text(c, 'PORT HALDEN HERALD', 0, -86, `900 40px Georgia, "Times New Roman", serif`, '#222');
    H.rr(c, -270, -60, 540, 3, 0, '#444');
    H.text(c, 'BOOKMARK KILLER CAUGHT', 0, -22, `900 38px ${FONT}`, '#b3121b');
    H.text(c, '— but who tipped off police?', 0, 22, `italic 700 26px Georgia, serif`, '#333');
    for (let k = 0; k < 4; k++) { H.rr(c, -270, 56 + k * 22, 250, 6, 2, '#bbb'); H.rr(c, 20, 56 + k * 22, 250, 6, 2, '#bbb'); }
    c.restore();
    vignette(c, 0.35);
  };

  // shared: the two armchairs in the back room
  function friends(c, t, o = {}) {
    wallpaper(c, '#1f3a30', 'rgba(255,220,150,0.06)');
    // a framed wren print + shelves
    H.rr(c, 410, 220, 260, 200, 8, '#8a6a2a'); H.rr(c, 426, 236, 228, 168, 4, '#efe3c4'); P.wren(c, 540, 330, 1.3, '#5b3720');
    c.save(); c.globalAlpha = 0.85; P.shelves(c, -40, 520, 300, 520, 2, 91); P.shelves(c, 820, 520, 300, 520, 2, 97); c.restore();
    c.save(); c.translate(300, 1220); c.scale(1.12, 1.12); P.armchair(c, '#5a3a2c', '#3e271c'); c.restore();
    c.save(); c.translate(790, 1220); c.scale(1.12, 1.12); P.armchair(c, '#2f6a55', '#1f4a3a'); c.restore();
    ch(c, 'silas', 300, 1000, 1.0, { t, expr: o.silas || 'smirk', look: o.sLook || [0, 0], arms: { l: [-110, 330], r: [110, 330] } });
    ch(c, 'ezra', 790, 1000, 1.0, { t, expr: o.ezra || 'smile', look: o.eLook || [0, 0], arms: { l: [-110, 330], r: [110, 330] } });
    // side table with two mugs and a book
    c.save(); c.translate(545, 1340);
    H.rr(c, -150, 0, 300, 26, 6, '#6b4026'); H.rr(c, -130, 26, 20, 400, 4, '#4a2a17'); H.rr(c, 110, 26, 20, 400, 4, '#4a2a17');
    c.save(); c.translate(-70, 0); P.mug(c, '#7c1d2b'); c.restore(); c.save(); c.translate(70, 0); P.mug(c, '#2f5e4e'); c.restore();
    H.rr(c, -40, -28, 90, 28, 3, '#c9962f');
    c.restore();
    glow(c, 545, 900, 700, '255,190,110', 0.16);
  }

  // 19: still meeting every Friday — the calendar flips
  S.friday = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1, 1.04);
    const late = t > TL.calFlips[0];
    friends(c, t, { silas: late ? 'smug' : 'smirk', ezra: t > TL.calDrop && t < TL.calFlips[0] ? 'grin' : 'smile', sLook: [0.4, 0], eLook: [-0.4, 0] });
    const dk = ramp(t, TL.calDrop, 0.32);
    if (dk > 0) {
      const days = [6, 13, 20];
      let i = 0; for (const f of TL.calFlips) if (t >= f) i++;
      const fl = i > 0 ? ramp(t, TL.calFlips[i - 1], 0.25) : 1;
      c.save(); c.translate(540, U.lerp(-250, 330, U.backOut(dk)));
      P.calendar(c, days[i], 'FRIDAY', 0);
      if (i > 0 && fl < 1) { c.save(); c.globalAlpha = 1 - fl; c.translate(0, -fl * 60); H.rr(c, -100, -60, 200, 170, 8, '#fff'); H.text(c, String(days[i - 1]), 0, 30, `800 120px ${FONT}`, '#222'); c.restore(); }
      c.restore();
    }
    vignette(c, 0.45);
  };

  // 20: the poll end card
  S.poll = function (c, t, lt, d) {
    cam(c, t, lt, d, 540, 900, 1.04, 1.07);
    const sOn = t >= TL.pollSilas && (t < TL.pollEzra || (t > TL.comment && Math.floor((t - TL.comment) * 2) % 2 === 0));
    const eOn = t >= TL.pollEzra && (t < TL.comment || Math.floor((t - TL.comment) * 2) % 2 === 1);
    friends(c, t, { silas: sOn ? 'grin' : 'smirk', ezra: eOn ? 'grin' : 'smug', sLook: [0.4, 0], eLook: [-0.4, 0] });
    c.setTransform(1, 0, 0, 1, 0, 0);
    const pills = [['SILAS is scarier', '#e0414f', sOn, 300], ['EZRA is scarier', '#3fb28a', eOn, 420]];
    pills.forEach(([txt, col, on, y], i) => {
      const k = pop(t, TL.shots[20][0] + 0.1 + i * 0.12, 0.3); if (k <= 0) return;
      c.save(); c.translate(540, y); c.scale(k * (on ? 1.06 : 1), k * (on ? 1.06 : 1));
      H.rr(c, -300, -46, 600, 92, 46, on ? col : 'rgba(12,16,28,0.92)');
      c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.roundRect(-300, -46, 600, 92, 46); c.stroke();
      H.text(c, txt, 0, 2, `800 40px ${FONT}`, '#fff');
      c.restore();
    });
    vignette(c, 0.45);
  };

  /* ============================ CAPTIONS / POST ============================ */
  function captions(c, t) {
    const cap = TL.captionAt(t);
    if (!cap) return;
    const txt = cap[1];
    const fin = txt === 'Comment below';
    const s = 1 + 0.14 * (1 - U.easeOut(U.clamp((t - cap[0]) / 0.1)));
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.font = `800 ${fin ? 64 : 76}px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'center';
    const k = Math.min(1, 940 / c.measureText(txt).width);
    c.translate(540, fin ? 1180 : 1310); c.scale(s * k, s * k);
    c.lineJoin = 'round'; c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeText(txt, 0, 0);
    c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 14; c.shadowOffsetY = 5;
    c.fillStyle = '#fff'; c.fillText(txt, 0, 0);
    c.restore();
    if (fin) {  // a small bouncing arrow under the end line
      const y = 1260 + Math.abs(Math.sin(t * 5)) * 16;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineWidth = 8; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(510, y); c.lineTo(570, y); c.lineTo(570, y + 30); c.lineTo(596, y + 30); c.lineTo(540, y + 76); c.lineTo(484, y + 30); c.lineTo(510, y + 30); c.closePath(); c.stroke(); c.fill();
      c.restore();
    }
  }
  function post(c, t) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    const k = U.clamp((t - (TL.DURATION - 0.6)) / 0.6);
    if (k > 0) { c.fillStyle = `rgba(0,0,0,${k})`; c.fillRect(0, 0, W, HT); }
  }

  function render(c, t) {
    t = U.clamp(t, 0, TL.DURATION - 1e-6);
    const [a, b, id, variant] = TL.shotAt(t);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, HT);
    S[id](c, t, t - a, b - a, variant);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.shadowBlur = 0; c.shadowColor = 'transparent'; c.setLineDash([]);
    captions(c, t); post(c, t);
    c.restore();
  }
  g.Film = { render, init() {} };
})(window);
