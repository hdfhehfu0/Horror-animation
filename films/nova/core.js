/* =========================================================================
   BETELGEUSE (first person) — core.js
   "What if Betelgeuse exploded tonight?" made to the /mad-space standard in
   this repository's three.js pipeline. Two friends in a log cabin on a winter
   night, tea and a fire. Your friend at the window shows you Betelgeuse, red
   on Orion's shoulder: its neutrinos came through the Earth hours ago, so it
   has already exploded and its light is on the way. You follow him out into
   the snow; he counts it down, and the star blows.
   A 3.1 s flash-forward opens the film: outside, your friend pointing at a
   star that still looks like nothing ("A star just exploded. Right there.").
   Film time t maps to one scene clock (sceneT); the hook borrows that moment.
   Requires js/core.js first (it provides U).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const DUR = g.NV_DURATION, LINES = g.NV_LINES;
  const TL = { W: 1080, H: 1920, FPS: 60, DURATION: DUR, TITLE: 'Betelgeuse', SLUG: 'betelgeuse', POSTER: 50 };
  TL.HOOK = 3.1;                                   // the cold open: outside, your friend points at a star that looks like nothing yet
  TL.HOOKS = 37.15;                                // the scene moment the hook borrows (the same shot, met again later)
  TL.sceneT = (t) => (t < TL.HOOK ? TL.HOOKS + t * 0.98 : t);
  TL.WIDE = 54.1;                                  // cut to the wide ending

  /* ------------------------------ captions + countdown ------------------------------ */
  TL.blocks = LINES.map(([a, b, voice, text], i) => {
    const next = i + 1 < LINES.length ? LINES[i + 1][0] : DUR;
    return { kind: voice, text, t0: +Math.max(0, a - 0.08).toFixed(3), t1: +Math.min(b + 0.6, next - 0.1, a < TL.HOOK ? TL.HOOK - 0.02 : 1e9).toFixed(3) };
  });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);
  TL.ZERO = 45.3;                                  // the light arrives: four and a half seconds into "In five seconds..."
  TL.countdown = { label: 'THE LIGHT ARRIVES IN', t0: TL.ZERO - 5, zero: TL.ZERO, t1: TL.ZERO + 0.7 };

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
  // the supernova: Betelgeuse's own orange light until the countdown lands, then the flash (a burst that overshoots and
  // settles) and a slow climb
  TL.nova = (s) => (s < TL.ZERO ? 0 : 0.84 * U.easeOut(U.clamp((s - TL.ZERO) / 0.4)) + 0.16 * U.smooth(TL.ZERO + 0.4, TL.ZERO + 7, s));
  TL.burst = (s) => (s < TL.ZERO ? 0 : U.smooth(TL.ZERO, TL.ZERO + 0.12, s) * Math.exp(-Math.max(0, s - TL.ZERO - 0.12) / 0.55));
  TL.visBright = kf([[0, 1], [TL.HOOK, 1], [64, 1]]);
  TL.visFaint = kf([[0, 1], [TL.HOOK, 1], [64, 1]]);
  TL.visMW = kf([[0, 1], [TL.HOOK, 1], [64, 1]]);

  /* ------------------------------ where you are ------------------------------
     The cabin: interior x -4..4, z -3..3, floor y 0; the south wall (z = -3) holds the fireplace (centre x 0.4), the
     window (x 1.6..2.9) and the door (x 3.15..3.95, hinged at 3.95, opening outward). Outside, the snow is at y -0.45;
     a stone step (top -0.22) lies in front of the door. Camera positions are your eyes; your friend's are his feet. */
  TL.SEAT = [0.2, 1.12, 1.3];
  TL.WINDOW = [1.85, 1.6, -2.48];                  // close to the glass, a little bent: the star in the upper-left pane
  TL.OUT = [5.0, 1.21, -8.0];
  TL.FRIEND_WIN = [2.75, 0, -2.5];                 // at the window, on your right
  TL.FRIEND_OUT = [5.03, -0.45, -9.09];            // a step ahead of where you stop, a little to the left
  // a path walked with time-stamped points: distance along it follows a smooth (monotone cubic) curve through the
  // stamps, starting and ending at rest, so walking speeds up and slows down instead of stopping at every corner
  const walker = (K) => {
    const P = K.map((k) => k.slice(1)), T = K.map((k) => k[0]), D = [0];
    for (let i = 1; i < P.length; i++) D.push(D[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
    const n = T.length, sl = [], m = [];
    for (let i = 0; i < n - 1; i++) sl.push((D[i + 1] - D[i]) / (T[i + 1] - T[i]));
    for (let i = 0; i < n; i++) m.push(i === 0 || i === n - 1 ? 0 : (sl[i - 1] * sl[i] <= 0 ? 0 : 2 / (1 / sl[i - 1] + 1 / sl[i])));
    const dist = (s) => {
      if (s <= T[0]) return 0; if (s >= T[n - 1]) return D[n - 1];
      let i = 0; while (s > T[i + 1]) i++;
      const h = T[i + 1] - T[i], u = (s - T[i]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * D[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * D[i + 1] + (u3 - u2) * h * m[i + 1];
    };
    const at = (d) => { for (let i = 1; i < P.length; i++) { if (d <= D[i] || i === P.length - 1) { const l = D[i] - D[i - 1], k = l > 0 ? U.clamp((d - D[i - 1]) / l) : 1; return P[i - 1].map((v, j) => U.lerp(v, P[i][j], k)); } } return P[P.length - 1]; };
    return (s) => { const d = dist(s), e = 0.02; const a = at(Math.max(0, d - e)), b = at(Math.min(D[n - 1], d + e)); return { p: at(d), d, speed: (dist(s + 0.02) - dist(s - 0.02)) / 0.04, dir: [b[0] - a[0], b[2] - a[2]], t0: T[0], t1: T[n - 1] }; };
  };
  // you: stand up from the fire and go to the window with your tea; later, follow your friend out
  const heroWin = walker([[4.6, ...TL.SEAT], [5.5, 0.36, 1.66, 1.0], [7.5, ...TL.WINDOW]]);
  const heroOut = walker([[28.6, ...TL.WINDOW], [29.5, 2.7, 1.66, -2.3], [30.35, 3.42, 1.66, -2.62], [30.85, 3.54, 1.66, -3.05], [31.2, 3.6, 1.6, -3.4],
    [31.65, 3.7, 1.45, -3.8], [32.95, 4.25, 1.26, -5.1], [36.0, ...TL.OUT]]);
  // your friend: from the window to the door, through it, and out into the snow ahead of you
  const friendOut = walker([[27.45, ...TL.FRIEND_WIN], [28.5, 3.43, 0, -2.58], [29.35, 3.55, 0, -3.1], [29.85, 3.62, -0.22, -3.5], [30.45, 3.8, -0.45, -4.1],
    [31.85, 4.3, -0.45, -5.6], [33.85, 4.85, -0.45, -7.8], [35.25, ...TL.FRIEND_OUT]]);
  TL.pos = (s) => {
    let p = TL.SEAT, walked = 0, moving = 0;
    if (s >= 4.6 && s < 5.5) {                       // lean forward, then rise
      const k = U.clamp((s - 4.6) / 0.9), e = U.easeInOut(k);
      p = TL.SEAT.map((v, j) => U.lerp(v, [0.36, 1.66, 1.0][j], e)); p[1] -= 0.09 * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k);
    } else if (s >= 5.5 && s < 28.6) { const w = heroWin(s); p = w.p; walked = w.d; moving = U.clamp(w.speed / 1.1); }
    else if (s >= 28.6) { const w = heroOut(s); p = w.p; walked = 3 + w.d; moving = U.clamp(w.speed / 1.1); }
    return { p, walked, moving };
  };
  TL.inside = (s) => s < 31.25;
  TL.friendWalk = (s) => (s < 27.45 ? null : friendOut(s));

  /* ------------------------------ the camera ------------------------------
     [s, yaw, pitch, fov]: yaw 0 looks south (-z) toward the fireplace wall, +yaw turns left (east); fov is vertical (deg).
     Long holds get a slow 20-25 % push-in; turns stay under ~110 deg/s. While you follow your friend out, your eyes
     stay on him (FOLLOW). */
  const BY = -TL.BETEL.az * Math.PI / 180, BP = TL.BETEL.el * Math.PI / 180;   // aimed exactly at the star
  TL.BY = BY; TL.BP = BP;
  const POV = [
    [3.1, -0.3, -0.12, 78], [4.4, -0.34, -0.1, 72],           // the fire, your tea, your friend at the window; push in
    [5.5, -0.48, -0.02, 72], [7.3, -0.42, 0.3, 72],             // up, and across to the window beside him
    [8.2, BY, BP, 72], [15.6, BY + 0.01, BP + 0.01, 58],        // through the glass: Orion, and Betelgeuse, red; push in
    [16.5, -1.5, 0.02, 68], [17.7, -1.52, 0.02, 66],         // "Hours ago...": to him
    [18.3, -0.18, -0.62, 70], [19.2, -0.2, -0.55, 70],          // your mug on the sill
    [19.7, -0.36, -0.34, 70], [21.0, -0.36, -0.32, 70],         // "Through us?": your own hand
    [21.8, -1.5, 0.02, 66], [24.1, -1.52, 0.02, 64],         // to him: "Billions of billions"
    [24.8, BY, BP - 0.05, 66], [25.7, BY, BP - 0.04, 64],       // "Can it hurt us?": the star again
    [26.5, -1.2, -0.36, 70], [27.1, -1.25, -0.34, 70],           // "No...": he sets his mug down by yours
    [36.0, BY + 0.1, 0.26, 80], [37.0, BY + 0.16, 0.22, 78],   // out under the sky: Orion over the valley, him against it
    [45.3, BY + 0.13, 0.27, 64],                                // he points; the countdown; push in
    [46.7, BY + 0.12, 0.29, 62],                                // the flash: hold
    [48.3, 2.55, -0.42, 80], [50.0, 2.58, -0.37, 74],           // "Look at the snow": turn round; your two shadows, long, to the cabin
    [51.6, BY, 0.52, 76], [53.0, BY + 0.12, 0.98, 88], [54.1, BY + 0.14, 1.04, 84],   // a different sky
  ];
  const povT = (s) => {
    if (s <= POV[0][0]) return POV[0].slice(1);
    for (let i = 1; i < POV.length; i++) if (s < POV[i][0]) { const a = POV[i - 1], b = POV[i], k = U.smooth(a[0], b[0], s); return a.slice(1).map((v, j) => U.lerp(v, b[j + 1], k)); }
    return POV[POV.length - 1].slice(1);
  };
  TL.FOLLOW = [27.1, 27.9, 35.2, 36.0];                // eyes on your friend from 27.9 to 35.2, easing in and out
  TL.friendHead = (s) => { const f = TL.friendWalk(s), p = f ? f.p : TL.FRIEND_WIN; return [p[0], p[1] + 1.78, p[2]]; };
  TL.cam = (t) => {
    const s = TL.sceneT(t), n = (f, o) => U.snoise(s * f + o);
    if (t >= TL.WIDE) {                          // the wide ending: raised over the roof, an 18 mm feel, the two of you small in the snow
      const k = U.clamp((t - TL.WIDE) / (DUR - TL.WIDE));
      return { x: 2.6 + 0.4 * k, y: 9.3 + 0.5 * k, z: 4.6 - 0.6 * k, yaw: -0.22 - 0.02 * k, pitch: -0.02 + 0.05 * k, roll: 0, fov: 98 - 6 * k, wide: true };
    }
    let [yaw, pitch, fov] = povT(s);
    const P = TL.pos(s);
    const [a0, a1, b0, b1] = TL.FOLLOW, wf = U.smooth(a0, a1, s) * (1 - U.smooth(b0, b1, s));
    if (wf > 0) {                                // eyes on him walking ahead of you: all of him, from his boots to his beanie
      const h = TL.friendHead(s), dx = h[0] - P.p[0], dy = h[1] - 0.53 - P.p[1], dz = h[2] - P.p[2];
      let fy = Math.atan2(-dx, -dz); while (fy - yaw > Math.PI) fy -= 2 * Math.PI; while (fy - yaw < -Math.PI) fy += 2 * Math.PI;
      const fp = Math.atan2(dy, Math.hypot(dx, dz));
      yaw = U.lerp(yaw, fy, wf); pitch = U.lerp(pitch, fp, wf); fov = U.lerp(fov, 84, wf);
    }
    const bob = Math.sin(P.walked / 0.72 * Math.PI) * 0.022 * P.moving, sway = Math.sin(P.walked / 0.72 * Math.PI * 0.5) * 0.014 * P.moving;
    const seated = s < 4.6 ? 1 : 0;
    const jolt = s > TL.ZERO ? 0.012 * Math.exp(-(s - TL.ZERO) / 0.35) * Math.sin((s - TL.ZERO) * 38) : 0;   // you flinch at the flash
    return {
      x: P.p[0] + n(0.4, 3) * 0.008 + sway * Math.cos(yaw), y: P.p[1] + Math.sin(s * 1.4) * 0.004 * (1 + seated) + Math.abs(bob), z: P.p[2] + n(0.5, 9) * 0.008 - sway * Math.sin(yaw),
      yaw: yaw + n(0.3, 1) * 0.006 + jolt * 0.4, pitch: pitch + n(0.35, 7) * 0.005 + bob * 0.25 + jolt,
      roll: n(0.25, 5) * 0.005 + sway * 0.6, fov, wide: false,
    };
  };

  /* ------------------------------ you, your friend, the door ------------------------------ */
  TL.mugSet = (s) => U.smooth(18.2, 19.0, s);                                         // your tea goes on the sill (right hand)
  TL.palm = (s) => U.smooth(19.3, 19.9, s) * (1 - U.smooth(20.9, 21.6, s));          // "Through us?": you look at your hand
  TL.doorTouch = (s) => U.smooth(30.75, 31.05, s) * (1 - U.smooth(31.35, 31.7, s));   // your right hand on the open door as you pass it
  TL.door = (s) => 1.45 * U.easeInOut(U.clamp((s - 28.75) / 1.1)) + 0.1 * U.smooth(30.9, 31.5, s);   // he pushes it open (outward); you push it wider
  TL.friendPush = (s) => U.smooth(28.35, 28.75, s) * (1 - U.smooth(29.55, 29.95, s)); // his right hand on the door
  TL.friendMugSet = (s) => U.smooth(26.3, 27.0, s);                                   // his tea on the sill, by yours
  TL.beckon = (s) => U.smooth(3.6, 4.0, s) * (1 - U.smooth(4.9, 5.4, s));             // he looks back at you from the window
  TL.lookYou = (s) => Math.max(U.smooth(15.9, 16.5, s) * (1 - U.smooth(24.3, 24.8, s)), U.smooth(25.8, 26.2, s) * (1 - U.smooth(26.4, 26.8, s)));
  TL.pointWin = (s) => U.smooth(8.0, 8.8, s) * (1 - U.smooth(10.6, 11.3, s));          // "That's Betelgeuse": up through the glass
  TL.point = (s) => U.smooth(36.9, 37.8, s) * (1 - U.smooth(46.4, 47.2, s));          // outside: he points at it, through the countdown
  TL.lookDown = (s) => U.smooth(46.9, 47.6, s) * (1 - U.smooth(49.8, 50.6, s));       // "Look at the snow"

  TL.chapters = [[0, TL.HOOK, 'Hook'], [TL.HOOK, 7.5, 'The fire'], [7.5, 27.4, 'The window'], [27.4, 36.0, 'Out'], [36.0, TL.ZERO, 'Countdown'], [TL.ZERO, TL.WIDE, 'The light'], [TL.WIDE, DUR, 'Wide']];
  g.TL = TL;
})(window);
