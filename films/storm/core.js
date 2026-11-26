/* =========================================================================
   SOLAR STORM (first person) — core.js
   "What if a solar storm as strong as 1859 hit tonight?" made to the
   /mad-space standard in this repository's three.js pipeline: a 2.6 s
   flash-forward of the payoff sky, a countdown that lands on zero as a red
   glow rises in the north, the aurora spreading overhead, transformers
   blowing, the city going dark block by block, your phone losing signal,
   and the full Milky Way behind the aurora once every light is out.
   Film time t maps to one scene clock (sceneT); the hook borrows the payoff.
   Requires js/core.js first (it provides U).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const DUR = g.ST_DURATION, LINES = g.ST_LINES;
  const TL = { W: 1080, H: 1920, FPS: 60, DURATION: DUR, TITLE: 'Solar storm', SLUG: 'solar-storm', POSTER: 47 };
  TL.HOOK = 2.6;                                   // the cold open: a flash-forward of the payoff sky
  TL.sceneT = (t) => (t < TL.HOOK ? 46.0 + t * 0.9 : t);
  TL.WIDE = 56.2;                                  // cut to the wide ending

  /* ------------------------------ captions + countdown ------------------------------ */
  TL.blocks = LINES.map(([a, b, voice, text], i) => {
    const next = i + 1 < LINES.length ? LINES[i + 1][0] : DUR;
    return { kind: voice, text, t0: +(a - 0.08).toFixed(3), t1: +Math.min(b + 0.6, next - 0.1).toFixed(3) };
  });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);
  TL.countdown = { label: 'THE STORM HITS IN', t0: TL.HOOK, zero: TL.HOOK + 5, t1: TL.HOOK + 5.7 };

  const kf = (K) => (t) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t < K[i][0]) return U.lerp(K[i - 1][1], K[i][1], U.smooth(K[i - 1][0], K[i][0], t)); return K[K.length - 1][1]; };

  /* ------------------------------ the camera (scene time) ------------------------------
     [s, yaw, pitch, fov]: yaw 0 looks north over the city (-z), +yaw turns left; fov is vertical (deg).
     Long holds get a slow 20-25 % push-in; turns stay under ~110 deg/s. */
  const POV = [
    [2.6, 0.0, -0.1, 74], [7.4, 0.0, -0.06, 68],             // the lit city at night; the countdown; push in
    [8.6, 0.0, 0.02, 72], [10.2, 0.02, 0.08, 70],            // a red glow rises low in the north
    [11.6, 1.3, 0.1, 64], [13.4, 1.24, 0.14, 62],            // turn to your friend: he points at it
    [15.2, 0.05, 0.22, 70], [16.6, 0.04, 0.3, 74],           // follow his finger
    [21.0, 0.0, 0.62, 82], [23.4, -0.08, 0.7, 84],           // look up: the curtains spread overhead and move
    [28.2, 0.1, 0.35, 76],
    [29.5, 0.34, 0.02, 70], [31.0, 0.3, -0.02, 66],          // a flash to your left: the first transformer
    [35.0, 0.12, -0.05, 64],
    [36.0, 0.0, -0.04, 72], [41.0, -0.05, -0.02, 62],        // block by block, the city goes dark; push in
    [42.4, -0.02, -0.34, 66], [44.4, -0.02, -0.36, 62],      // your phone: no signal
    [45.8, 0.0, 0.78, 86], [49.8, 0.0, 0.95, 72],            // look up: every light is out; push in
    [52.0, 0.05, 0.55, 78], [56.2, 0.02, 0.45, 70],
  ];
  const povT = (s) => {
    if (s <= POV[0][0]) return POV[0].slice(1);
    for (let i = 1; i < POV.length; i++) if (s < POV[i][0]) { const a = POV[i - 1], b = POV[i], k = U.smooth(a[0], b[0], s); return a.slice(1).map((v, j) => U.lerp(v, b[j + 1], k)); }
    return POV[POV.length - 1].slice(1);
  };
  TL.EYE = [0.0, 43.58, -4.62];                  // leaning on the parapet (roof y = 42, coping top 43.07)
  TL.cam = (t) => {
    const s = TL.sceneT(t), n = (f, o) => U.snoise(s * f + o), sh = TL.shake(s);
    if (t >= TL.WIDE) {                          // the wide ending: raised, an 18 mm feel, the two men small under it
      const k = U.clamp((t - TL.WIDE) / (DUR - TL.WIDE));
      return { x: -1.8 + 1.6 * k, y: 47 + 1.5 * k, z: 27 - 3 * k, yaw: 0.0, pitch: 0.18 + 0.04 * k, roll: 0, fov: 98 - 6 * k, wide: true };
    }
    const [yaw, pitch, fov] = povT(s);
    return {
      x: TL.EYE[0] + n(0.4, 3) * 0.015, y: TL.EYE[1] + Math.sin(s * 1.5) * 0.006 + n(9, 2) * 0.02 * sh, z: TL.EYE[2] + n(0.5, 9) * 0.015,
      yaw: yaw + n(0.3, 1) * 0.008 + n(12, 4) * 0.02 * sh, pitch: pitch + n(0.35, 7) * 0.007 + n(10, 6) * 0.02 * sh,
      roll: n(0.25, 5) * 0.006 + n(11, 8) * 0.015 * sh, fov, wide: false,
    };
  };
  TL.shake = (s) => 0.5 * U.smooth(29.15, 29.3, s) * (1 - U.smooth(29.4, 30.4, s));   // the first bang startles you

  /* ------------------------------ the storm ------------------------------ */
  TL.aurora = kf([[0, 0], [TL.HOOK + 5, 0], [9.0, 0.3], [16, 0.55], [21, 0.85], [30, 0.95], [44, 1.0], [48, 1.25], [64, 1.2]]);
  TL.auroraRed = kf([[0, 0], [TL.HOOK + 5, 0], [9, 0.7], [14, 1], [64, 1]]);          // the high red glow comes first
  TL.auroraGreen = kf([[0, 0], [11, 0], [18, 0.7], [22, 1], [64, 1]]);                // then the green curtains
  TL.auroraSouth = kf([[0, 0], [TL.HOOK + 5, 0], [20, 150], [44, 300], [64, 345]]);   // km: the oval sweeps south over you
  TL.AURORA_Z = [-320, -430, -570, -760, -1000];                                        // km north of you, before the sweep

  /* ------------------------------ the blackout ------------------------------
     Each transformer that blows takes its part of the city with it: a block goes dark at
     t_pop + distance / 220 m/s (plus a little scatter); it flickers for a moment first. */
  TL.POPS = [
    { t: 29.2, x: -60, y: 7, z: -150, big: 1.0 },
    { t: 33.2, x: 170, y: 8, z: -620, big: 0.8 }, { t: 34.9, x: -380, y: 8, z: -820, big: 0.7 },
    { t: 36.6, x: 420, y: 8, z: -300, big: 0.8 }, { t: 38.0, x: -150, y: 8, z: -420, big: 0.9 },
    { t: 39.4, x: 260, y: 8, z: -1100, big: 0.6 }, { t: 40.8, x: -620, y: 8, z: -480, big: 0.7 },
    { t: 42.1, x: 60, y: 8, z: -900, big: 0.6 },
  ];
  TL.cutTime = (x, z) => {
    const h = U.hash(Math.floor((x + 3000) / 140) * 7.31 + Math.floor((3000 - z) / 140) * 13.17);
    let m = 1e9; for (const p of TL.POPS) m = Math.min(m, p.t + Math.hypot(x - p.x, z - p.z) / 220 + h * 1.2);
    return Math.max(m, 29.25);
  };
  TL.lit = (s) => 1 - U.smooth(29.0, 44.6, s);           // how much of the city is still lit (for the sky glow)
  TL.lightPollution = (s) => 0.9 * (0.15 + 0.85 * TL.lit(s)) * (1 - U.smooth(43.5, 45.0, s));

  /* ------------------------------ the sky ------------------------------ */
  TL.visBright = kf([[0, 1], [TL.HOOK, 0.45], [40, 0.55], [45.5, 1]]);
  TL.visFaint = kf([[0, 1], [TL.HOOK, 0.1], [38, 0.18], [46, 1]]);
  TL.visMW = kf([[0, 1], [TL.HOOK, 0], [40, 0.04], [46.5, 1]]);

  /* ------------------------------ you and your friend ------------------------------ */
  TL.point = (s) => U.smooth(11.0, 11.9, s) * (1 - U.smooth(15.6, 16.6, s));         // he points at the red glow
  TL.POINT_AT = { az: -6, el: 13 };                                                    // where he points (deg)
  TL.phone = (s) => U.smooth(41.5, 42.5, s) * (1 - U.smooth(45.4, 46.4, s));          // your phone, raised
  TL.noSignal = (s) => s > 42.7;

  TL.chapters = [[0, TL.HOOK, 'Hook'], [TL.HOOK, 8.3, 'Countdown'], [8.3, 29, 'The aurora'], [29, 44.5, 'The blackout'], [44.5, TL.WIDE, 'The sky'], [TL.WIDE, DUR, 'Wide']];
  g.TL = TL;
})(window);
