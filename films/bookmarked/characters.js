/* =========================================================================
   BOOKMARKED — characters.js
   Original flat-vector cast in the "explainer short" style of the reference
   (big round heads, white eyes, ball hands, no outlines):
     Silas Crane  — crime-lab analyst: black side-parted hair, heavy-lidded
                    deadpan eyes, slate lab jacket with a clipped ID badge.
     Ezra Wren    — bookseller: fluffy chestnut hair, round glasses,
                    mustard cardigan over a cream shirt.
     the detective — grey hair, moustache, tan trench coat.
   Plus the props: the bookmark, books, receipts, the case, map pins,
   the calendar, the stamp, gloved hand, mugs, armchairs.
   Every drawing is in local units with the head radius = 100.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, Chars } = g;
  const { H } = Chars;
  const TAU = Math.PI * 2;

  const PAL = {
    ink: '#2a1a14', mouth: '#5a1a1e', tongue: '#c4505a', white: '#fffaf2',
    silasSkin: '#eab98f', silasShade: '#d49e74', silasHair: '#1d1d24', silasHairHi: '#383845',
    jacket: '#3d5068', jacketDark: '#2c3b4f', jacketLight: '#4e6380', shirt: '#c6d9ea',
    ezraSkin: '#f4d3b5', ezraShade: '#e0b592', ezraHair: '#7a4a2a', ezraHairHi: '#9c6340',
    cardigan: '#d19a2c', cardiganDark: '#a9781c', cardiganLight: '#e2b04a', cream: '#f4ead6',
    detSkin: '#e2b088', coat: '#b48f5a', coatDark: '#93723f',
    blood: '#b3121b', bloodDark: '#7a0a10', gold: '#e8c25a', red: '#e0322b',
    bookmark: '#7c1d2b', bookmarkDark: '#5c1220',
  };

  const SPECS = {
    silas: {
      skin: PAL.silasSkin, shade: PAL.silasShade, brow: '#16161c', browW: 12, lids: 0.38, blush: null,
      sleeve: PAL.jacket, sleeveDark: PAL.jacketDark, hair: silasHair, outfit: silasOutfit, seed: 3.1,
    },
    ezra: {
      skin: PAL.ezraSkin, shade: PAL.ezraShade, brow: '#5a3520', browW: 8, lids: 0, blush: 'rgba(235,130,110,0.35)',
      sleeve: PAL.cardigan, sleeveDark: PAL.cardiganDark, hair: ezraHair, outfit: ezraOutfit, glasses: true, seed: 7.7,
    },
    detective: {
      skin: PAL.detSkin, shade: '#c9946c', brow: '#8a8a8a', browW: 9, lids: 0.15, blush: 'rgba(220,110,90,0.3)',
      sleeve: PAL.coat, sleeveDark: PAL.coatDark, hair: detHair, outfit: detOutfit, moustache: true, seed: 5.3,
    },
  };

  /* ------------------------------- parts ------------------------------- */
  function silasHair(c) {
    const col = PAL.silasHair;
    c.beginPath();
    c.moveTo(-99, 18);
    c.lineTo(-104, -18);
    c.arc(0, 0, 106, Math.PI * 1.06, Math.PI * 1.94);
    c.lineTo(99, 16); c.lineTo(88, 16);
    c.lineTo(88, -30);
    c.quadraticCurveTo(70, -60, 22, -60);           // the swoop on the right
    c.quadraticCurveTo(-20, -58, -52, -46);
    c.quadraticCurveTo(-80, -38, -88, -24);
    c.lineTo(-88, 18); c.closePath();
    c.fillStyle = col; c.fill();
    H.ell(c, 14, -92, 66, 22, col, -0.1);            // volume on top
    // side part and a soft highlight
    H.line(c, -46, -104, -38, -70, 'rgba(255,255,255,0.12)', 4);
    H.ell(c, 18, -96, 34, 7, PAL.silasHairHi, -0.1);
  }
  function ezraHair(c) {
    const col = PAL.ezraHair;
    c.beginPath(); c.moveTo(-98, 14); c.lineTo(-100, -20);
    c.arc(0, 0, 102, Math.PI * 1.05, Math.PI * 1.95);
    c.lineTo(97, 12); c.lineTo(88, 12); c.lineTo(86, -34);
    // wavy hairline
    for (let i = 0; i <= 8; i++) { const x = 86 - i * 21.5, y = -44 - Math.sin(i * 1.3) * 7; c.lineTo(x, y); }
    c.lineTo(-88, 14); c.closePath(); c.fillStyle = col; c.fill();
    // fluffy bumps along the top
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.02 + i * 0.12), r = 96 + U.hash(i * 3.7) * 8;
      H.circ(c, Math.cos(a) * r, Math.sin(a) * r, 30 + U.hash(i * 1.3) * 8, col);
    }
    for (let i = 0; i < 5; i++) { const a = Math.PI * (1.2 + i * 0.15); H.circ(c, Math.cos(a) * 100, Math.sin(a) * 100 - 6, 10, PAL.ezraHairHi); }
    // the curl over the forehead
    c.strokeStyle = col; c.lineWidth = 13; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-14, -60); c.quadraticCurveTo(-34, -40, -14, -30); c.quadraticCurveTo(2, -26, -4, -40); c.stroke();
  }
  function detHair(c) {
    const col = '#a3a3a6';
    H.ell(c, -86, -18, 22, 42, col, 0.2); H.ell(c, 86, -18, 22, 42, col, -0.2);
    c.beginPath(); c.arc(0, 0, 103, Math.PI * 1.1, Math.PI * 1.9); c.lineTo(70, -60); c.quadraticCurveTo(0, -84, -70, -60); c.closePath(); c.fillStyle = col; c.fill();
  }

  function torso(c, col) { H.rr(c, -128, 88, 256, 520, [62, 62, 10, 10], col); }
  function silasOutfit(c) {
    torso(c, PAL.jacket);
    H.poly(c, [[-36, 88], [0, 140], [36, 88]], PAL.shirt);
    H.poly(c, [[-38, 86], [-62, 92], [-20, 150]], PAL.jacketLight);   // jacket collar
    H.poly(c, [[38, 86], [62, 92], [20, 150]], PAL.jacketLight);
    H.line(c, 0, 140, 0, 600, PAL.jacketDark, 5);                       // zip
    H.rr(c, 30, 300, 70, 10, 4, PAL.jacketDark);                          // pocket welt
    // clipped ID badge
    H.rr(c, -92, 150, 52, 70, 6, '#f4f6f8');
    H.rr(c, -92, 150, 52, 16, [6, 6, 0, 0], '#c0392b');
    H.rr(c, -84, 172, 18, 22, 2, '#9fb3c8');
    H.rr(c, -62, 174, 16, 4, 2, '#8a96a3'); H.rr(c, -62, 184, 14, 4, 2, '#8a96a3'); H.rr(c, -84, 202, 36, 4, 2, '#8a96a3');
    H.rr(c, -72, 140, 12, 16, 2, '#9aa4ae');
  }
  function ezraOutfit(c) {
    torso(c, PAL.cardigan);
    H.poly(c, [[-38, 88], [38, 88], [8, 600], [-8, 600]], PAL.cream);
    H.poly(c, [[-22, 88], [0, 118], [22, 88]], '#e8dcc3');
    // ribbed front edges
    c.lineCap = 'round';
    H.line(c, -40, 92, -9, 600, PAL.cardiganDark, 14); H.line(c, 40, 92, 9, 600, PAL.cardiganDark, 14);
    for (const y of [210, 280, 350]) H.circ(c, 4 + (600 - y) * 0.0, y, 7, '#6b4a1a');
    // knit texture
    for (let y = 130; y < 600; y += 26) for (let x = -112; x < 112; x += 24) { if (Math.abs(x) < 46) continue; H.ell(c, x, y, 5, 8, 'rgba(255,255,255,0.07)'); }
    H.rr(c, -98, 300, 52, 50, 8, PAL.cardiganDark);                       // patch pocket
    H.rr(c, -92, 280, 10, 34, 3, '#2f6f5a'); H.rr(c, -80, 286, 8, 28, 3, '#8a2d2d'); // pens in it
  }
  function detOutfit(c) {
    torso(c, PAL.coat);
    H.poly(c, [[-40, 88], [40, 88], [16, 300], [-16, 300]], '#f2f2ee');
    H.poly(c, [[-8, 110], [8, 110], [14, 260], [0, 280], [-14, 260]], '#7a1f25');   // loose tie
    H.poly(c, [[-8, 100], [8, 100], [10, 116], [-10, 116]], '#5e161b');
    H.poly(c, [[-40, 86], [-80, 96], [-30, 250], [-20, 150]], PAL.coatDark);        // lapels
    H.poly(c, [[40, 86], [80, 96], [30, 250], [20, 150]], PAL.coatDark);
    for (const y of [330, 410]) { H.circ(c, -40, y, 8, '#5b4325'); H.circ(c, 40, y, 8, '#5b4325'); }
  }

  /* arm from the shoulder to a hand target (local units), bent like a soft tube */
  function arm(c, side, hand, sp, bend = 1) {
    const sx = side * 108, sy = 132;
    const [hx, hy] = hand;
    const mx = (sx + hx) / 2 + side * 40 * bend, my = (sy + hy) / 2 + 10;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = sp.sleeveDark; c.lineWidth = 60;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, hx, hy); c.stroke();
    c.strokeStyle = sp.sleeve; c.lineWidth = 48;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, hx, hy); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 10;
    c.beginPath(); c.moveTo(sx + side * 16, sy + 10); c.quadraticCurveTo(mx + side * 16, my, hx + side * 10, hy - 8); c.stroke();
    c.restore();
    H.circ(c, hx, hy, 27, sp.skin);
    H.circ(c, hx - side * 6, hy + 6, 18, sp.shade);
    H.circ(c, hx - side * 2, hy - 2, 22, sp.skin);
  }
  const ARMS = {
    down: (s) => [s * 140, 350],
    hip: (s) => [s * 150, 300],
    table: (s) => [s * 74, 300],
    shake: (s) => [s * 30, 250],
    temple: (s) => [s * 104, -30],
    up: (s) => [s * 190, 60],
    point: (s) => [s * 260, 120],
    chin: (s) => [s * 30, 112],
    book: (s) => [s * 60, 230],
  };

  /* --------------------------------- face --------------------------------- */
  function face(c, sp, o) {
    const t = o.t || 0;
    const ex = 36, ey = -2;
    const blink = o.blink != null ? o.blink : (() => { const k = (t + sp.seed) / 3.3, ph = k - Math.floor(k); return U.hash(Math.floor(k) + sp.seed) > 0.25 && ph < 0.045; })();
    const expr = o.expr || 'neutral';
    const lx = (o.look ? o.look[0] : 0) * 7, ly = (o.look ? o.look[1] : 0) * 5;
    if (sp.blush) { H.ell(c, -56, 36, 17, 10, sp.blush); H.ell(c, 56, 36, 17, 10, sp.blush); }
    const closed = blink || expr === 'grin';
    for (const s of [-1, 1]) {
      const x = s * ex;
      if (closed) {
        c.strokeStyle = PAL.ink; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath();
        if (expr === 'grin') { c.moveTo(x - 15, ey + 6); c.quadraticCurveTo(x, ey - 14, x + 15, ey + 6); }
        else { c.moveTo(x - 16, ey + 2); c.quadraticCurveTo(x, ey + 8, x + 16, ey + 2); }
        c.stroke();
      } else {
        const big = expr === 'shock' ? 1.18 : 1;
        H.ell(c, x, ey, 21 * big, 23 * big, PAL.white);
        H.circ(c, x + lx, ey + ly + 2, (expr === 'shock' ? 8 : 9.5), PAL.ink);
        H.circ(c, x + lx + 3, ey + ly - 2, 3, '#fff');
        // heavy upper lid (Silas's deadpan); lifts when shocked
        const lid = expr === 'shock' ? 0 : Math.max(sp.lids, expr === 'smug' || expr === 'squint' ? 0.5 : 0);
        if (lid > 0) {
          c.save(); c.beginPath(); c.ellipse(x, ey, 22 * big, 24 * big, 0, 0, TAU); c.clip();
          c.fillStyle = sp.skin; c.fillRect(x - 30, ey - 30, 60, 48 * lid);
          c.restore();
          H.line(c, x - 21, ey - 24 + 48 * lid, x + 21, ey - 24 + 48 * lid, PAL.ink, 4);
        }
      }
      // brows
      const br = expr === 'frown' || expr === 'squint' ? 1 : expr === 'shock' ? -1 : expr === 'smug' ? 0.4 : 0;
      const by = ey - 36 - (expr === 'shock' ? 10 : 0);
      c.strokeStyle = sp.brow; c.lineWidth = sp.browW; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x - s * 22, by - br * 4); c.quadraticCurveTo(x, by - 6 - (sp === SPECS.ezra ? 4 : 0), x + s * 20, by + br * 9);
      c.stroke();
    }
    // nose
    H.ell(c, 0, 24, 8, 6, 'rgba(150,80,50,0.35)');
    if (sp.moustache) {
      c.fillStyle = '#8c8c8f'; c.beginPath(); c.moveTo(-34, 44); c.quadraticCurveTo(0, 22, 34, 44); c.quadraticCurveTo(0, 36, -34, 44); c.fill();
    }
    // mouth
    const my = 52;
    c.strokeStyle = PAL.ink; c.lineWidth = 5; c.lineCap = 'round';
    const talk = o.talk || 0;
    if (talk > 0.05) {
      H.ell(c, 0, my + 4, 15, 3 + 13 * talk, PAL.mouth);
      H.ell(c, 0, my + 6 + 8 * talk, 8, 3 * talk, PAL.tongue);
    } else if (expr === 'shock') {
      H.ell(c, 0, my + 6, 12, 16, PAL.mouth);
    } else if (expr === 'whisper') {
      H.ell(c, 2, my + 2, 9, 6, PAL.mouth);
    } else if (expr === 'grin') {
      c.beginPath(); c.moveTo(-32, my - 6); c.quadraticCurveTo(0, my + 40, 32, my - 6); c.closePath(); c.fillStyle = PAL.mouth; c.fill();
      c.save(); c.clip(); H.rr(c, -32, my - 8, 64, 12, 3, '#fff'); c.restore();
    } else if (expr === 'smile') {
      c.beginPath(); c.moveTo(-26, my - 4); c.quadraticCurveTo(0, my + 20, 26, my - 4); c.stroke();
    } else if (expr === 'smirk' || expr === 'smug') {
      c.beginPath(); c.moveTo(-18, my + 2); c.quadraticCurveTo(6, my + 10, 24, my - 6); c.stroke();
    } else if (expr === 'frown' || expr === 'squint') {
      c.beginPath(); c.moveTo(-16, my + 4); c.quadraticCurveTo(0, my - 2, 16, my + 4); c.stroke();
    } else {
      c.beginPath(); c.moveTo(-15, my + 2); c.lineTo(15, my + 2); c.stroke();
    }
    if (sp.glasses) {
      c.strokeStyle = '#3b2a1e'; c.lineWidth = 5;
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * ex, ey, 29, 0, TAU); c.stroke(); H.ell(c, s * ex - 8, ey - 10, 7, 4, 'rgba(255,255,255,0.35)', -0.6); }
      c.beginPath(); c.moveTo(-8, ey - 4); c.quadraticCurveTo(0, ey - 10, 8, ey - 4); c.stroke();
      H.line(c, -65, ey - 4, -94, ey - 8, '#3b2a1e', 4); H.line(c, 65, ey - 4, 94, ey - 8, '#3b2a1e', 4);
    }
  }

  /* --------------------------------- person ---------------------------------
     o: { t, expr, talk, look:[x,y], lean (rad), arms:{l,r} (ARMS key or [x,y]), headTilt, alpha, prop(c) }
     origin = head centre, head radius 100 (scale with c.scale) */
  function person(c, who, o = {}) {
    const sp = SPECS[who];
    c.save();
    if (o.alpha != null) c.globalAlpha *= o.alpha;
    if (o.lean) { c.translate(0, 600); c.rotate(o.lean); c.translate(0, -600); }
    const armOf = (side) => { const a = o.arms ? o.arms[side < 0 ? 'l' : 'r'] : null; const k = a || 'down'; return typeof k === 'string' ? ARMS[k](side) : k; };
    // shadow + body
    sp.outfit(c);
    // neck
    H.rr(c, -26, 64, 52, 40, 10, sp.shade);
    // arms (behind the prop, in front of the body)
    if (o.behindArms) o.behindArms(c);
    // a hand raised above the shoulders is drawn after the head, so it stays in front of it
    const L = armOf(-1), R = armOf(1), high = (h) => h[1] < 90;
    if (!high(L)) arm(c, -1, L, sp, o.bendL != null ? o.bendL : 1);
    if (!high(R)) arm(c, 1, R, sp, o.bendR != null ? o.bendR : 1);
    // head
    c.save();
    c.rotate(o.headTilt || 0);
    for (const s of [-1, 1]) { H.circ(c, s * 97, 10, 18, sp.skin); H.circ(c, s * 99, 12, 9, sp.shade); }
    H.circ(c, 0, 0, 100, sp.skin);
    H.ell(c, 0, 70, 70, 26, 'rgba(0,0,0,0.04)');
    sp.hair(c);
    face(c, sp, o);
    c.restore();
    if (high(L)) arm(c, -1, L, sp, o.bendL != null ? o.bendL : 1);
    if (high(R)) arm(c, 1, R, sp, o.bendR != null ? o.bendR : 1);
    if (o.prop) o.prop(c);
    c.restore();
  }

  /* the dark self behind Silas: a giant silhouette with a red rim and red eyes */
  function shadowSelf(c, o = {}) {
    const a = o.alpha == null ? 1 : o.alpha, eyes = o.eyes || 0;
    c.save(); c.globalAlpha *= a;
    c.shadowColor = 'rgba(220,30,40,0.85)'; c.shadowBlur = 50;
    c.fillStyle = '#0c0306';
    c.beginPath(); c.arc(0, 0, 110, 0, TAU); c.fill();
    c.beginPath(); c.roundRect(-150, 90, 300, 700, [80, 80, 0, 0]); c.fill();
    c.shadowBlur = 0;
    if (eyes > 0) {
      c.shadowColor = '#ff2a2a'; c.shadowBlur = 30;
      for (const s of [-1, 1]) { c.save(); c.translate(s * 40, -6); c.rotate(s * 0.18); H.ell(c, 0, 0, 26, 9 * eyes, '#ff2b2b'); H.ell(c, 0, 0, 12, 4 * eyes, '#ffd0d0'); c.restore(); }
    }
    c.restore();
  }

  /* ---------------------------------- props ---------------------------------- */
  const P = {};
  // the bookmark: burgundy ribbon card with a gold border, a wren and "W&P"
  P.bookmark = function (c, o = {}) {
    const w = 120, h = 340;
    c.save();
    c.rotate(o.rot || 0);
    // tassel
    c.strokeStyle = PAL.gold; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, -h / 2 + 24); c.quadraticCurveTo(-30, -h / 2 - 40, -12, -h / 2 - 80); c.stroke();
    H.poly(c, [[-12, -h / 2 - 80], [-24, -h / 2 - 130], [0, -h / 2 - 130]], PAL.gold);
    H.rr(c, -w / 2 + 6, -h / 2 + 6, w, h, 10, 'rgba(0,0,0,0.35)');
    H.rr(c, -w / 2, -h / 2, w, h, 10, PAL.bookmark);
    c.strokeStyle = PAL.gold; c.lineWidth = 4; c.beginPath(); c.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 6); c.stroke();
    H.circ(c, 0, -h / 2 + 24, 8, '#2a0b10');
    wren(c, 0, -30, 0.9, PAL.gold);
    H.text(c, 'W&P', 0, 50, '800 30px Poppins, Montserrat, Arial', PAL.gold);
    H.rr(c, -30, 82, 60, 3, 2, 'rgba(232,194,90,0.6)');
    H.text(c, 'EST. 1987', 0, 104, '700 14px Poppins, Montserrat, Arial', 'rgba(232,194,90,0.8)');
    if (o.blood) { H.circ(c, 26, 128, 9, PAL.blood); H.circ(c, 38, 140, 4, PAL.blood); H.circ(c, 14, 146, 3, PAL.blood); }
    c.restore();
  };
  // a little wren silhouette (logo)
  function wren(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    H.ell(c, 0, 0, 30, 22, col);                     // body
    H.circ(c, -24, -14, 14, col);                    // head
    H.poly(c, [[-36, -16], [-50, -12], [-36, -10]], col); // beak
    H.poly(c, [[22, -6], [44, -40], [34, -4]], col);      // cocked tail
    H.line(c, -6, 20, -10, 34, col, 3); H.line(c, 6, 20, 8, 34, col, 3);
    H.circ(c, -26, -16, 2.5, 'rgba(0,0,0,0.6)');
    c.restore();
  }
  P.wren = wren;

  // a book standing on a shelf (spine view)
  P.spine = function (c, x, y, w, h, col, o = {}) {
    H.rr(c, x, y - h, w, h, 3, col);
    H.rr(c, x, y - h + h * 0.12, w, 4, 1, 'rgba(255,255,255,0.35)');
    H.rr(c, x, y - h * 0.18, w, 4, 1, 'rgba(255,255,255,0.35)');
    H.rr(c, x + w * 0.2, y - h * 0.6, w * 0.6, h * 0.22, 2, 'rgba(0,0,0,0.18)');
    if (o.title) {
      c.save(); c.translate(x + w / 2, y - h / 2); c.rotate(-Math.PI / 2);
      H.text(c, o.title, 0, 2, `800 ${Math.round(w * 0.42)}px Poppins, Montserrat, Arial`, o.titleCol || '#f6e7b8');
      c.restore();
    }
  };
  // a row of books on a shelf from x0 to x1 at baseline y (deterministic)
  P.shelfRow = function (c, x0, x1, y, hMax, seed, o = {}) {
    const cols = ['#7c1d2b', '#2f5e4e', '#c9962f', '#3c4f7a', '#8a5a3a', '#5a2f5e', '#a33a2a', '#2c6e7a', '#d8c7a0', '#4a4a52'];
    let x = x0, i = 0;
    const out = [];
    while (x < x1 - 20) {
      const w = 26 + U.hash(seed + i * 1.7) * 26, h = hMax * (0.7 + U.hash(seed + i * 2.9) * 0.3);
      const col = cols[Math.floor(U.hash(seed + i * 4.1) * cols.length)];
      const tilt = U.hash(seed + i * 9.3) > 0.93 && x + w + 30 < x1;
      if (o.skip && o.skip(i)) { out.push([x, w, h, i]); x += w + 2; i++; continue; }
      if (tilt) { c.save(); c.translate(x, y); c.rotate(0.22); P.spine(c, 0, 0, w, h, col); c.restore(); x += w + 22; }
      else { P.spine(c, x, y, w, h, col); x += w + 2; }
      out.push([x - w - 2, w, h, i]);
      i++;
    }
    return out;
  };
  P.shelves = function (c, x, y, w, h, rows, seed, o = {}) {
    H.rr(c, x - 18, y - 18, w + 36, h + 36, 6, o.frame || '#4a2c1a');
    c.fillStyle = o.back || '#2a1810'; c.fillRect(x, y, w, h);
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const by = y + rh * (r + 1) - 14;
      P.shelfRow(c, x + 8, x + w - 8, by, rh * 0.72, seed + r * 31);
      H.rr(c, x - 6, by, w + 12, 16, 2, o.frame || '#5b3720');
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, by + 16, w, 10);
    }
  };

  // receipt paper with ragged bottom edge
  P.receipt = function (c, o = {}) {
    const w = 300, h = 430;
    c.save(); c.rotate(o.rot || 0);
    H.rr(c, -w / 2 + 10, -h / 2 + 12, w, h, 4, 'rgba(0,0,0,0.3)');
    c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2);
    for (let i = 0; i <= 12; i++) c.lineTo(w / 2 - (i * w) / 12, h / 2 - (i % 2 ? 0 : 12));
    c.closePath(); c.fillStyle = '#fbf8ef'; c.fill();
    const f = (s, y, col = '#3a3a3a', wt = 700, sz = 22, al = 'center', x = 0) => H.text(c, s, x, y, `${wt} ${sz}px "Courier New", monospace`, col, al);
    f('WREN & PAGE', -h / 2 + 40, '#222', 800, 28);
    f('USED BOOKS', -h / 2 + 70, '#666', 700, 18);
    f('- - - - - - - - - - -', -h / 2 + 96, '#999', 400, 18);
    f(o.day || 'FRI', -h / 2 + 130, '#222', 800, 26, 'left', -w / 2 + 26);
    f(o.time || '6:42 PM', -h / 2 + 130, '#444', 700, 22, 'right', w / 2 - 26);
    f(o.title || 'THE QUIET HOUR', -h / 2 + 178, '#222', 800, 21, 'left', -w / 2 + 26);
    f('1 x', -h / 2 + 210, '#555', 700, 20, 'left', -w / 2 + 26);
    f(o.price || '$12.99', -h / 2 + 210, '#222', 700, 20, 'right', w / 2 - 26);
    f('- - - - - - - - - - -', -h / 2 + 244, '#999', 400, 18);
    f('CARD ****' + (o.card || '0611'), -h / 2 + 276, '#555', 700, 18);
    f('THANK YOU', -h / 2 + 318, '#555', 700, 18);
    for (let i = 0; i < 26; i++) H.rr(c, -w / 2 + 40 + i * 8.6, h / 2 - 72, U.hash(i * 3.3) > 0.5 ? 5 : 2.5, 40, 0, '#333');
    if (o.mark > 0) {   // red circle around the day
      c.strokeStyle = PAL.red; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.ellipse(-w / 2 + 52, -h / 2 + 130, 48, 26, -0.1, -Math.PI / 2, -Math.PI / 2 + TAU * U.easeOut(U.clamp(o.mark))); c.stroke();
    }
    c.restore();
  };
  // cardboard box of receipts
  P.receiptBox = function (c, o = {}) {
    const lift = o.lift || 0;
    for (let i = 0; i < 7; i++) {
      const x = -150 + i * 50 + U.hash(i) * 20, rot = (U.hash(i * 3) - 0.5) * 0.5, up = 30 + U.hash(i * 7) * 40 + lift * (60 + U.hash(i * 5) * 90);
      c.save(); c.translate(x, -60 - up); c.rotate(rot + lift * (U.hash(i * 11) - 0.5) * 0.6);
      H.rr(c, -34, -60, 68, 120, 2, '#fbf8ef');
      for (let k = 0; k < 6; k++) H.rr(c, -24, -46 + k * 16, 30 + U.hash(i + k) * 18, 4, 2, '#b9b4a8');
      c.restore();
    }
    H.poly(c, [[-210, -70], [210, -70], [190, 160], [-190, 160]], '#c08a4e');
    H.poly(c, [[-210, -70], [210, -70], [200, -40], [-200, -40]], '#a9743c');
    H.rr(c, -110, 10, 220, 66, 6, '#f2e6c9');
    H.text(c, 'RECEIPTS', 0, 44, '800 38px "Permanent Marker", Poppins, Arial', '#2a2a2a');
  };
  // Silas's black case
  P.blackCase = function (c, o = {}) {
    H.rr(c, -170, -120, 340, 230, 18, '#151519');
    H.rr(c, -170, -120, 340, 40, [18, 18, 0, 0], '#202027');
    c.strokeStyle = '#2b2b33'; c.lineWidth = 12; c.beginPath(); c.roundRect(-60, -170, 120, 70, 16); c.stroke();
    H.rr(c, -120, -96, 40, 18, 4, '#9aa0a8'); H.rr(c, 80, -96, 40, 18, 4, '#9aa0a8');
    if (o.glint > 0) {
      c.save(); c.beginPath(); c.roundRect(-170, -120, 340, 230, 18); c.clip();
      const gx = -260 + o.glint * 520;
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(gx, -130); c.lineTo(gx + 60, -130); c.lineTo(gx - 40, 120); c.lineTo(gx - 100, 120); c.fill();
      c.restore();
    }
  };
  // map pin with a bookmark glyph
  P.pin = function (c, s = 1) {
    c.save(); c.scale(s, s);
    H.ell(c, 0, 4, 18, 7, 'rgba(0,0,0,0.25)');
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-46, -60, -46, -110, 0, -110); c.bezierCurveTo(46, -110, 46, -60, 0, 0); c.fillStyle = PAL.red; c.fill();
    H.circ(c, 0, -74, 24, '#fff');
    H.rr(c, -8, -90, 16, 30, 2, PAL.bookmark); H.poly(c, [[-8, -62], [0, -70], [8, -62]], '#fff');
    c.restore();
  };
  // the poster calendar
  P.calendar = function (c, day, label = 'FRIDAY', flip = 0) {
    H.rr(c, -110, -130 + 8, 220, 250, 14, 'rgba(0,0,0,0.3)');
    H.rr(c, -110, -130, 220, 250, 14, '#fff');
    H.rr(c, -110, -130, 220, 60, [14, 14, 0, 0], '#d52f2a');
    H.text(c, label, 0, -98, '800 30px Poppins, Montserrat, Arial', '#fff');
    for (const s of [-1, 1]) { H.circ(c, s * 60, -132, 10, '#444'); H.rr(c, s * 60 - 4, -152, 8, 26, 3, '#777'); }
    c.save();
    if (flip > 0) { c.globalAlpha *= 1 - flip; c.translate(0, -flip * 40); }
    H.text(c, String(day), 0, 30, '800 120px Poppins, Montserrat, Arial', '#222');
    c.restore();
  };
  P.mug = function (c, col = '#2f5e4e') {
    H.rr(c, -40, -60, 80, 90, [6, 6, 18, 18], col);
    c.strokeStyle = col; c.lineWidth = 12; c.beginPath(); c.arc(42, -16, 20, -1.2, 1.2); c.stroke();
    H.ell(c, 0, -60, 40, 8, '#3b2312');
  };
  P.armchair = function (c, col, dark) {
    H.rr(c, -200, -320, 400, 420, [120, 120, 20, 20], dark);
    H.rr(c, -170, -290, 340, 360, [100, 100, 10, 10], col);
    for (const s of [-1, 1]) H.rr(c, s * 175 - 55, -90, 110, 190, 40, dark);
  };
  P.lamp = function (c, on = 1) {
    H.poly(c, [[-70, 0], [70, 0], [44, -90], [-44, -90]], '#d8a948');
    H.rr(c, -6, 0, 12, 160, 4, '#5a3e22'); H.rr(c, -50, 156, 100, 16, 6, '#5a3e22');
    if (on) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = H.rg(c, 0, 10, 10, 360, [[0, 'rgba(255,200,120,0.45)'], [1, 'rgba(255,200,120,0)']]); c.fillRect(-360, -350, 720, 720); c.restore(); }
  };
  P.stamp = function (c, text = 'CASE CLOSED') {
    c.save();
    c.strokeStyle = '#d4232b'; c.lineWidth = 12; c.beginPath(); c.roundRect(-330, -80, 660, 160, 10); c.stroke();
    c.lineWidth = 4; c.beginPath(); c.roundRect(-312, -62, 624, 124, 6); c.stroke();
    H.text(c, text, 0, 6, '900 104px Poppins, Montserrat, Arial', '#d4232b');
    // worn ink speckle
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) H.circ(c, (U.hash(i * 1.3) - 0.5) * 640, (U.hash(i * 7.7) - 0.5) * 150, 1 + U.hash(i * 3.1) * 4, 'rgba(0,0,0,0.8)');
    c.restore();
  };
  // a black-gloved hand reaching in from the right (pointing left), wrist at origin
  P.glove = function (c, grip = 0) {
    H.rr(c, 0, -46, 420, 92, 20, '#1c1d22');          // sleeve
    H.rr(c, -20, -50, 50, 100, 12, '#2a2b31');         // cuff
    H.ell(c, -80, 0, 76, 56, '#0f0f12');               // palm
    for (let i = 0; i < 4; i++) { const y = -34 + i * 23, len = 70 - Math.abs(i - 1.2) * 10 - grip * 34; H.rr(c, -150 - len + 60, y - 10, len + 20, 22, 11, '#0f0f12'); }
    H.rr(c, -110, 36, 60, 24, 12, '#0f0f12');          // thumb
  };
  // Silas's hand gripping a wrist from above
  P.grab = function (c) {
    H.rr(c, -46, -460, 92, 420, 26, PAL.jacket);
    H.rr(c, -52, -60, 104, 34, 8, PAL.jacketDark);
    H.ell(c, 0, 10, 62, 52, PAL.silasSkin);
    for (let i = 0; i < 4; i++) H.rr(c, -54 + i * 28, 20, 24, 74, 12, PAL.silasSkin);
    H.rr(c, 44, -10, 26, 64, 13, PAL.silasShade);
  };
  P.sparkles = function (c, x, y, r, n, p, seed = 1) {
    if (p <= 0 || p >= 1) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + U.hash(seed + i) * 0.6, d = r * (0.6 + 0.5 * U.easeOut(p)) * (0.8 + U.hash(seed * 3 + i) * 0.4);
      const s = (1 - p) * (10 + U.hash(i * 5 + seed) * 10);
      H.star(c, x + Math.cos(a) * d, y + Math.sin(a) * d, s, `rgba(255,214,90,${1 - p})`);
    }
  };

  g.BM = { PAL, SPECS, person, shadowSelf, P, ARMS, face };
})(window);
