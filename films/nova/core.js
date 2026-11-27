/* =========================================================================
   BETELGEUSE (first person) — core.js
   "What if Betelgeuse exploded tonight?" made to the /mad-space standard in
   this repository's three.js pipeline. Two friends in a log cabin on a winter
   night, tea and a fire; the light of a star that blew up over 500 years ago
   arrives, pours through the window across the floor, and they go out into
   the snow under Orion with one blazing new star in it.
   A 3.1 s flash-forward of the payoff (your friend pointing at it) opens the
   film; then a countdown by the fire lands on zero as the light arrives.
   Film time t maps to one scene clock (sceneT); the hook borrows the payoff.
   Requires js/core.js first (it provides U).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const DUR = g.NV_DURATION, LINES = g.NV_LINES;
  const TL = { W: 1080, H: 1920, FPS: 60, DURATION: DUR, TITLE: 'Betelgeuse', SLUG: 'betelgeuse', POSTER: 50 };
  TL.HOOK = 3.1;                                   // the cold open: the payoff, a flash-forward
  TL.sceneT = (t) => (t < TL.HOOK ? 48.9 + t * 0.9 : t);
  TL.WIDE = 56.0;                                  // cut to the wide ending

  /* ------------------------------ captions + countdown ------------------------------ */
  TL.blocks = LINES.map(([a, b, voice, text], i) => {
    const next = i + 1 < LINES.length ? LINES[i + 1][0] : DUR;
    return { kind: voice, text, t0: +Math.max(0, a - 0.08).toFixed(3), t1: +Math.min(b + 0.6, next - 0.1, a < TL.HOOK ? TL.HOOK - 0.02 : 1e9).toFixed(3) };
  });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);
  TL.ZERO = TL.HOOK + 5;                           // 8.1: the light arrives
  TL.countdown = { label: 'THE LIGHT ARRIVES IN', t0: TL.HOOK, zero: TL.ZERO, t1: TL.ZERO + 0.7 };

  const kf = (K) => (t) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t < K[i][0]) return U.lerp(K[i - 1][1], K[i][1], U.smooth(K[i - 1][0], K[i][0], t)); return K[K.length - 1][1]; };

  /* ------------------------------ the sky ------------------------------
     Real positions for a winter night at 60 deg N (local sidereal time 118 deg), Orion setting over the valley to the
     south-west; scene azimuth = azimuth from south (west positive) + AZ_OFF, so the cabin's window faces the star. */
  TL.LAT = 60; TL.LST = 118; TL.AZ_OFF = -9.7;
  TL.altaz = (raDeg, decDeg) => {
    const D = Math.PI / 180, H = (TL.LST - raDeg) * D, d = decDeg * D, p = TL.LAT * D;
    const alt = Math.asin(Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H));
    const A = Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
    return { az: ((A / D) + 360) % 360 - 180 + TL.AZ_OFF, el: alt / D };
  };
  TL.BETEL = TL.altaz(88.793, 7.407);              // ~ az 25.5, el 33.0
  // the supernova: Betelgeuse's own orange light until the countdown lands, then the flash and a slow climb
  TL.nova = (s) => (s < TL.ZERO ? 0 : 0.82 * U.easeOut(U.clamp((s - TL.ZERO) / 0.7)) + 0.18 * U.smooth(TL.ZERO + 0.5, TL.ZERO + 9, s));
  TL.visBright = kf([[0, 1], [TL.HOOK, 1], [64, 1]]);
  TL.visFaint = kf([[0, 1], [TL.HOOK, 1], [64, 1]]);
  TL.visMW = kf([[0, 1], [TL.HOOK, 1], [64, 1]]);

  /* ------------------------------ where you are ------------------------------
     The cabin: interior x -4..4, z -3..3, floor y 0; the south wall (z = -3) holds the fireplace (centre x 0.4), the
     window (x 1.6..2.9) and the door (x 3.15..3.95, hinged at 3.95, opening inward). Outside, the snow is at y -0.45. */
  TL.SEAT = [0.2, 1.12, 1.3];
  TL.WINDOW = [2.28, 1.6, -2.48];                  // close to the glass and a little bent, to look up past the eaves
  TL.DOORSPOT = [3.12, 1.66, -2.62];
  TL.OUT = [5.0, 1.21, -8.0];
  const MOVES = [   // [t0, t1, polyline] -- each move eases in and out along its path; you bob as you walk
    [10.9, 12.0, [TL.SEAT, [0.36, 1.66, 1.0]], 'stand'],
    [12.0, 14.2, [[0.36, 1.66, 1.0], [1.3, 1.64, -1.2], TL.WINDOW]],
    [24.8, 31.7, [TL.WINDOW, [2.85, 1.65, -2.15], [3.42, 1.66, -2.6], [3.54, 1.66, -3.05], [3.58, 1.66, -3.35], [3.7, 1.45, -3.8], [4.25, 1.26, -5.1], TL.OUT]],
  ];
  const plen = (P) => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); return L; };
  const pat = (P, d) => { for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); if (d <= l || i === P.length - 1) { const k = l > 0 ? U.clamp(d / l) : 1; return P[i - 1].map((v, j) => U.lerp(v, P[i][j], k)); } d -= l; } return P[P.length - 1]; };
  TL.pos = (s) => {
    let p = TL.SEAT, walked = 0, moving = 0;
    for (const [a, b, P, kind] of MOVES) {
      if (s < a) break;
      const L = plen(P), k = U.clamp((s - a) / (b - a));
      if (kind === 'stand') {                    // lean forward, then rise
        const e = U.easeInOut(k); p = pat(P, L * e).slice(); p[1] -= 0.09 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k);
      } else { const e = U.easeInOut(k); p = pat(P, L * e); walked += L * e; if (k > 0 && k < 1) moving = Math.sin(Math.PI * k); }
      if (s >= b) walked += 0;
    }
    return { p, walked, moving };
  };
  TL.inside = (s) => s < 29.2;

  /* ------------------------------ the camera ------------------------------
     [s, yaw, pitch, fov]: yaw 0 looks south (-z) toward the fireplace wall, +yaw turns left (east); fov is vertical (deg).
     Long holds get a slow 20-25 % push-in; turns stay under ~110 deg/s. */
  const BY = -TL.BETEL.az * Math.PI / 180, BP = TL.BETEL.el * Math.PI / 180;   // aimed exactly at the star
  const POV = [
    [3.1, -0.24, -0.15, 80], [7.9, -0.25, -0.14, 64],          // the fire, your friend, the dark window; push in
    [8.7, -0.25, -0.14, 64],                                    // the light pours in
    [10.0, -0.40, -0.26, 72], [10.9, -0.42, -0.2, 72],          // toward the window and the light on the floor
    [12.0, -0.46, -0.06, 74], [13.7, -0.45, 0.08, 74],          // up, and across the room
    [15.2, BY, BP, 72], [22.2, BY + 0.01, BP + 0.01, 56],       // through the glass: Orion, and the new star; push in
    [23.1, -0.32, -0.5, 70], [24.4, -0.36, -0.3, 72],           // set the mug on the sill: he is already out in the snow
    [25.8, -0.6, -0.1, 74], [27.0, -0.36, -0.06, 76],           // the door stands open; through it, your friend under the sky
    [28.6, -0.3, -0.06, 76], [30.2, -0.36, 0.02, 78],           // your hand on the door as you go out
    [31.9, BY, 0.42, 82], [34.6, BY, 0.5, 70],                  // the sky over the valley; push in
    [35.4, -0.36, -0.12, 70], [36.8, -0.36, -0.1, 70],          // your own hand
    [38.4, BY, 0.4, 76], [39.8, BY, 0.36, 72],
    [41.4, 2.55, -0.42, 80], [43.5, 2.58, -0.36, 72],            // turn round: your shadows, long across the snow to the cabin's warm windows
    [45.4, BY, 0.42, 80], [47.8, BY, 0.5, 70],                  // and back to the star
    [48.7, BY, BP - 0.12, 64], [52.3, BY, BP - 0.1, 50],        // your friend points at it; push in
    [53.6, BY + 0.12, 0.98, 88], [56.0, BY + 0.14, 1.04, 82],   // a different sky
  ];
  const povT = (s) => {
    if (s <= POV[0][0]) return POV[0].slice(1);
    for (let i = 1; i < POV.length; i++) if (s < POV[i][0]) { const a = POV[i - 1], b = POV[i], k = U.smooth(a[0], b[0], s); return a.slice(1).map((v, j) => U.lerp(v, b[j + 1], k)); }
    return POV[POV.length - 1].slice(1);
  };
  TL.cam = (t) => {
    const s = TL.sceneT(t), n = (f, o) => U.snoise(s * f + o);
    if (t >= TL.WIDE) {                          // the wide ending: raised over the roof, an 18 mm feel, the two of you small in the snow
      const k = U.clamp((t - TL.WIDE) / (DUR - TL.WIDE));
      return { x: 2.6 + 0.4 * k, y: 9.3 + 0.5 * k, z: 4.6 - 0.6 * k, yaw: -0.22 - 0.02 * k, pitch: -0.02 + 0.05 * k, roll: 0, fov: 98 - 6 * k, wide: true };
    }
    const [yaw, pitch, fov] = povT(s), P = TL.pos(s);
    const bob = Math.sin(P.walked / 0.72 * Math.PI) * 0.022 * P.moving, sway = Math.sin(P.walked / 0.72 * Math.PI * 0.5) * 0.014 * P.moving;
    const seated = s < 10.9 ? 1 : 0;
    return {
      x: P.p[0] + n(0.4, 3) * 0.008 + sway * Math.cos(yaw), y: P.p[1] + Math.sin(s * 1.4) * 0.004 * (1 + seated) + Math.abs(bob), z: P.p[2] + n(0.5, 9) * 0.008 - sway * Math.sin(yaw),
      yaw: yaw + n(0.3, 1) * 0.006, pitch: pitch + n(0.35, 7) * 0.005 + bob * 0.25,
      roll: n(0.25, 5) * 0.005 + sway * 0.6, fov, wide: false,
    };
  };

  /* ------------------------------ you, your friend, the door ------------------------------ */
  TL.mugHeld = (s) => s < 22.7;                                                       // until it goes on the sill
  TL.mugSet = (s) => U.smooth(22.7, 23.5, s);                                         // the right hand carries it there
    TL.doorTouch = (s) => U.smooth(28.3, 28.85, s) * (1 - U.smooth(29.35, 29.9, s));  // your right hand on the open door as you pass it
  TL.door = (s) => 1.45 * U.easeInOut(U.clamp((s - 19.6) / 1.3)) + 0.12 * U.smooth(28.6, 29.4, s);   // he opens it (outward); you push it wider
  TL.palm = (s) => U.smooth(34.7, 35.5, s) * (1 - U.smooth(36.8, 37.6, s));          // "Through us?": you look at your hand
  TL.friendTurn = (s) => U.smooth(8.25, 9.2, s);                                      // he turns to the window
  TL.friendGone = (s) => s >= 16.0 && s < 20.9;                                       // he goes to the door while you look up
TL.friendOut = (s) => s >= 20.9;                                                    // and out into the snow
  TL.point = (s) => U.smooth(47.6, 48.5, s) * (1 - U.smooth(52.4, 53.3, s));         // he points at the star
  TL.FRIEND_IN = [1.35, 0, -1.95];
  TL.FRIEND_OUT = [5.03, -0.45, -9.09];             // a step ahead of where you stop, a little to the left

  TL.chapters = [[0, TL.HOOK, 'Hook'], [TL.HOOK, TL.ZERO + 0.5, 'Countdown'], [TL.ZERO + 0.5, 24.8, 'The window'], [24.8, 31.6, 'Outside'], [31.6, TL.WIDE, 'The sky'], [TL.WIDE, DUR, 'Wide']];
  g.TL = TL;
})(window);
