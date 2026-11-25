/* =========================================================================
   ROGUE PLANET (first person) — core.js
   "What if a rogue planet passed as close as the Moon?" made to the /mad-space
   standard, in this repository's three.js pipeline (the owner's Blender studio
   is on their PC): a 2.6 s flash-forward of the payoff sky, a countdown that
   lands on zero as the planet's limb clears the sea, a Saturn-sized world
   rising over a harbour city at dusk, its pull draining the harbour, the
   payoff sky, the surge, and a wide shot of two men small under it.
   Film time t maps to one scene clock (sceneT); the hook borrows the payoff.
   Requires js/core.js first (it provides U).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const DUR = g.PL_DURATION, LINES = g.PL_LINES;
  const TL = { W: 1080, H: 1920, FPS: 60, DURATION: DUR, TITLE: 'Rogue planet', SLUG: 'rogue-planet', POSTER: 46 };
  TL.HOOK = 2.6;                                   // the cold open: a flash-forward of the payoff sky
  TL.sceneT = (t) => (t < TL.HOOK ? 43.4 + t * 0.9 : t);
  TL.WIDE = 56.5;                                  // cut to the wide ending

  /* ------------------------------ captions + countdown ------------------------------ */
  TL.blocks = LINES.map(([a, b, voice, text], i) => {
    const next = i + 1 < LINES.length ? LINES[i + 1][0] : DUR;
    return { kind: voice, text, t0: +(a - 0.08).toFixed(3), t1: +Math.min(b + 0.6, next - 0.1).toFixed(3) };
  });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);
  TL.countdown = { label: 'A ROGUE PLANET ARRIVES IN', t0: TL.HOOK, zero: TL.HOOK + 5, t1: TL.HOOK + 5.7 };

  const kf = (K) => (t) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t < K[i][0]) return U.lerp(K[i - 1][1], K[i][1], U.smooth(K[i - 1][0], K[i][0], t)); return K[K.length - 1][1]; };

  /* ------------------------------ the camera (scene time) ------------------------------
     [s, yaw, pitch, fov]: yaw 0 looks east over the sea (-z), +yaw turns left; fov is vertical (deg).
     Long holds get a slow 20-25 % push-in; turns stay under ~110 deg/s. */
  const POV = [
    [2.6, 0.04, -0.06, 78], [7.2, 0.02, -0.03, 74],           // dusk over the sea; the countdown
    [8.4, 0.0, 0.02, 74], [12.5, 0.0, 0.12, 72],             // the limb clears the horizon
    [16.5, 0.0, 0.2, 70], [20.6, -0.02, 0.24, 62],           // it rises; push in
    [21.9, 0.38, 0.12, 66], [23.6, 0.36, 0.16, 66],          // turn to the friend pointing
    [25.2, -0.16, 0.36, 64], [28.2, -0.2, 0.38, 56],         // follow his finger to the rings; push in
    [29.6, -0.05, 0.22, 66], [33.2, 0.05, 0.18, 66],         // the pull: everything shakes
    [34.6, 0.1, -0.8, 70], [37.4, 0.06, -0.86, 64],          // down at the harbour: draining
    [39.2, 0.0, -0.06, 70], [42.6, 0.0, -0.02, 64],          // the sea itself is rising
    [44.0, -0.02, 0.3, 72], [48.6, -0.03, 0.34, 58],         // the payoff sky; slow push-in
    [50.0, -0.1, -0.05, 70], [56.5, -0.16, -0.02, 62],       // here it comes: the wall, the lights fail
  ];
  const povT = (s) => { // piecewise smooth through the keys
    if (s <= POV[0][0]) return POV[0].slice(1);
    for (let i = 1; i < POV.length; i++) if (s < POV[i][0]) { const a = POV[i - 1], b = POV[i], k = U.smooth(a[0], b[0], s); return a.slice(1).map((v, j) => U.lerp(v, b[j + 1], k)); }
    return POV[POV.length - 1].slice(1);
  };
  TL.EYE = [0.0, 43.7, -3.6];                    // standing at the parapet on the roof (roof top y = 42)
  TL.cam = (t) => {
    const s = TL.sceneT(t), n = (f, o) => U.snoise(s * f + o), sh = TL.shake(s);
    if (t >= TL.WIDE) {                          // the wide ending: raised, an 18 mm feel, the two men small under it
      const k = U.clamp((t - TL.WIDE) / (DUR - TL.WIDE));
      return { x: -1.5 + 2 * k, y: 52 + 6 * k, z: 26 - 4 * k, yaw: 0.0, pitch: 0.16 + 0.04 * k, roll: 0, fov: 98 - 6 * k, wide: true };
    }
    const [yaw, pitch, fov] = povT(s);
    return {
      x: TL.EYE[0] + n(0.4, 3) * 0.015, y: TL.EYE[1] + Math.sin(s * 1.5) * 0.006 + n(9, 2) * 0.02 * sh, z: TL.EYE[2] + n(0.5, 9) * 0.015,
      yaw: yaw + n(0.3, 1) * 0.008 + n(12, 4) * 0.02 * sh, pitch: pitch + n(0.35, 7) * 0.007 + n(10, 6) * 0.02 * sh,
      roll: n(0.25, 5) * 0.006 + n(11, 8) * 0.015 * sh, fov, wide: false,
    };
  };

  /* ------------------------------ the planet ------------------------------
     a Saturn-sized world at the Moon's distance: 17.2 deg across, rings to 2.27 R (about 39 deg) */
  TL.PLANET = { radiusDeg: 8.6, ringIn: 1.24, ringOut: 2.27, az: 0.0, tilt: 0.38, open: 0.4 };
  TL.planetEl = kf([[0, -11.5], [TL.HOOK + 5, -8.4], [12, -4.5], [20, 6.5], [30, 13], [44, 19.5], [60, 25]]);   // degrees; the limb clears at zero
  TL.SUN = { az: 180, el: -9 };                    // set behind you, in the west: the planet rises nearly full
  TL.MOON = { az: 26, el: 31, radiusDeg: 0.26 };   // the real Moon, for scale

  /* ------------------------------ light, sky, city ------------------------------ */
  TL.dusk = kf([[0, 1], [TL.HOOK, 1], [9, 0.75], [20, 0.2], [32, 0]]);
  TL.visBright = kf([[0, 1], [TL.HOOK, 0.15], [10, 0.4], [18, 0.8], [26, 1]]);
  TL.visFaint = kf([[0, 1], [TL.HOOK, 0], [14, 0.1], [24, 0.6], [34, 0.85], [52, 1]]);
  TL.visMW = kf([[0, 1], [TL.HOOK, 0], [18, 0.05], [30, 0.55], [44, 0.9], [53, 1]]);
  TL.power = (s) => 1 - U.smooth(50.5, 55, s);  // the city lights fail as the surge comes
  TL.lightPollution = (s) => 0.85 * TL.power(s);

  /* ------------------------------ the pull ------------------------------ */
  TL.harbour = kf([[0, 0], [33.0, 0], [41.5, -5.5], [60, -6.5]]);          // the harbour drains
  TL.surge = { t0: 48.4, t1: 66.5, h: 70 };                                // the wall of water: front from far out to the city
  TL.surgeFront = (s) => U.lerp(-11000, -320, U.easeIn(U.clamp((s - TL.surge.t0) / (TL.surge.t1 - TL.surge.t0))) ** 0.8);
  TL.surgeH = (s) => TL.surge.h * U.smooth(48.4, 60, s);
  TL.shake = (s) => {
    let k = 0.25 * U.smooth(28.8, 31, s) * (1 - U.smooth(34.4, 36, s)) + 0.15 * U.smooth(41, 44, s) + 0.45 * U.smooth(50, 56, s);
    return k;
  };
  TL.point = (s) => U.smooth(21.4, 22.4, s) * (1 - U.smooth(28.0, 29.0, s));  // the friend points at the rings
  TL.hands = (s) => 1;                                                         // your hands on the parapet (POV)

  TL.chapters = [[0, TL.HOOK, 'Hook'], [TL.HOOK, 8.4, 'Countdown'], [8.4, 29, 'It rises'], [29, 43, 'The pull'], [43, 50, 'The sky'], [50, TL.WIDE, 'The surge'], [TL.WIDE, DUR, 'Wide']];
  g.TL = TL;
})(window);
