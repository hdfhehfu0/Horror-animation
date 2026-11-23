/* =========================================================================
   MOON (first person) — core.js
   "What if the Moon crashed into Earth?" told the way the reference tells its
   black hole: one continuous handheld first-person shot on a city avenue, a
   5-4-3-2-1 countdown, a calm narrator in white italic serif and your own
   prayers in gold. This file is the timeline: the voice lines (from
   films/moon/lines.js), the camera path, the light (day -> dusk -> night),
   the Moon (growing, cracking, breaking apart), the falling pieces, and the
   moments things leave the ground. Requires js/core.js first (it provides U).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const DUR = g.MOON_DURATION, LINES = g.MOON_LINES;
  const TL = { W: 1080, H: 1920, FPS: 30, DURATION: DUR, TITLE: 'The Moon', SLUG: 'moon-pov', POSTER: 2.5, FOV: 64 };

  /* ------------------------------ captions: one block per voice line ------------------------------ */
  TL.blocks = LINES.map(([a, b, voice, text], i) => {
    const next = i + 1 < LINES.length ? LINES[i + 1][0] : DUR;
    return { kind: voice, text, t0: +(a - 0.08).toFixed(3), t1: +Math.min(b + 0.6, next - 0.1).toFixed(3) };
  });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);
  TL.countdown = { label: 'THE MOON', sub: 'IMAGINED SCENARIO', t1: 5.0 };

  /* ------------------------------ keyframe helper (Catmull-Rom through the keys) ------------------------------ */
  function track(keys) {
    const n = keys.length;
    return (t) => {
      if (t <= keys[0][0]) return keys[0].slice(1);
      if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
      let i = 0; while (keys[i + 1][0] < t) i++;
      const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
      const u = (t - k1[0]) / (k2[0] - k1[0]), s = u * u * (3 - 2 * u);
      return k1.slice(1).map((v, j) => {
        const p0 = k0[j + 1], p1 = v, p2 = k2[j + 1], p3 = k3[j + 1];
        // centripetal-ish: catmull-rom on the eased parameter keeps it smooth without overshooting much
        const cr = 0.5 * ((2 * p1) + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s + (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s);
        return U.lerp(U.lerp(p1, p2, s), cr, 0.55);
      });
    };
  }

  /* ------------------------------ the camera: [t, x, y, z, yaw, pitch] ------------------------------
     yaw 0 looks down the avenue (-z), toward the Moon; +yaw turns left. The street is at +x. */
  const CAM = [
    [0.0, -10.0, 1.68, 1.5, -0.10, 0.10],
    [4.9, -10.0, 1.68, 1.35, -0.12, 0.13],
    [6.3, -10.0, 1.68, 1.25, -0.15, 0.40],     // "What the..." -- looking up at it
    [9.4, -9.9, 1.68, 1.05, -0.14, 0.44],
    [11.3, -9.0, 1.66, 0.9, -0.40, -0.66],     // down at the gutter: the water is running the wrong way
    [14.8, -8.95, 1.66, 0.6, -0.30, -0.58],
    [16.8, -9.2, 1.68, 0.2, -0.17, 0.33],    // up again: it's bigger, the light is going
    [18.5, -9.7, 1.68, -0.7, 0.40, 0.02],      // turn for the subway
    [20.6, -12.2, 1.68, -1.7, 0.04, -0.30],    // top of the stairs
    [22.1, -12.2, 1.42, -3.3, 0.0, -0.33],
    [25.4, -12.2, -0.85, -6.3, 0.02, -0.36],   // going down
    [26.4, -12.2, -1.25, -6.75, 0.0, -0.46],   // stop: the water is coming up the stairs
    [28.9, -12.2, -1.2, -6.7, 0.05, -0.56],
    [30.3, -12.25, -0.95, -6.3, 3.14, -0.08],  // spin round
    [32.2, -12.2, 1.2, -3.1, 3.14, 0.02],      // run back up
    [33.5, -10.6, 1.68, -1.8, 3.9, 0.05],      // out, toward the street
    [35.0, -9.6, 1.68, -1.6, 4.35, 0.02],      // the taxi
    [37.2, -9.6, 1.68, -1.6, 4.40, 0.12],
    [39.4, -9.6, 1.68, -1.7, 6.13, 0.50],      // up at the Moon: it's cracking
    [42.8, -9.55, 1.68, -1.8, 6.20, 0.56],
    [44.8, -9.0, 1.5, -5.2, 5.55, -0.30],      // "Hold on to something": to the railing on the curb
    [46.6, -8.95, 1.40, -6.0, 5.40, -0.42],    // hands on the rail
    [48.8, -8.95, 1.42, -6.0, 6.24, 0.22],     // look up the avenue: the pieces start to fall
    [57.0, -8.95, 1.42, -6.0, 6.30, 0.26],
    [59.2, -8.95, 1.42, -6.0, 5.55, 0.16],     // across the street: the buildings are going up
    [63.0, -8.95, 1.42, -6.0, 5.60, 0.34],
    [65.0, -8.95, 1.40, -6.0, 5.40, -0.50],    // down at your hands
    [67.6, -8.95, 1.45, -6.0, 5.42, -0.45],
    [71.6, -8.8, 2.7, -6.05, 5.45, -0.72],     // the railing bends up with you
    [74.0, -8.6, 9.5, -6.2, 5.7, -1.18],       // off the ground, looking down
    [81.0, -8.0, 52.0, -8.0, 6.6, -1.28],      // higher; the city turns below
    [83.0, -7.8, 74.0, -9.0, 6.55, 0.15],      // swing up...
    [85.5, -7.6, 100.0, -10.5, 6.20, 1.05],    // ...into it
  ];
  const camT = track(CAM);
  // a handheld camera: breathing, a little sway, and a bob that grows with walking speed
  TL.cam = (t) => {
    const [x, y, z, yaw, pitch] = camT(t), [x2, , z2] = camT(t + 0.05);
    const speed = Math.hypot(x2 - x, z2 - z) / 0.05, step = Math.min(1, speed / 2.2);
    const panic = U.smooth(30, 45, t), shake = TL.shake(t);
    const n = (f, s) => U.snoise(t * f + s);
    return {
      x: x + n(0.6, 3) * 0.02, z: z + n(0.5, 9) * 0.02,
      y: y + Math.sin(t * 1.6) * 0.008 + Math.abs(Math.sin(t * 9.0)) * 0.05 * step + n(9, 2) * 0.012 * shake,
      yaw: yaw + n(0.35, 1) * (0.012 + 0.02 * panic) + Math.sin(t * 4.5) * 0.012 * step + n(13, 4) * 0.022 * shake,
      pitch: pitch + n(0.4, 7) * (0.01 + 0.015 * panic) + Math.sin(t * 9.0) * 0.012 * step + n(11, 6) * 0.025 * shake,
      roll: n(0.3, 5) * 0.012 + Math.sin(t * 4.5) * 0.01 * step + n(10, 8) * 0.02 * shake, speed,
    };
  };

  /* ------------------------------ the Moon ------------------------------
     where it sits in the sky (yaw, elevation) and its angular radius (deg); then it cracks and comes apart */
  const kf = (K) => (t) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t < K[i][0]) return U.lerp(K[i - 1][1], K[i][1], U.smooth(K[i - 1][0], K[i][0], t)); return K[K.length - 1][1]; };
  TL.moonR = kf([[0, 0.9], [5.0, 0.9], [6.0, 1.7], [10, 3.0], [16, 5.5], [20, 7.0], [30, 11], [34, 13], [39.5, 17], [43, 19], [50, 23], [60, 27], [70, 30], [80, 34], [85.5, 44]]);
  TL.moonEl = kf([[0, 0.40], [20, 0.42], [40, 0.55], [60, 0.66], [85.5, 0.95]]);
  TL.moonYaw = -0.12;
  TL.moonDir = (t) => { const e = TL.moonEl(t), a = TL.moonYaw; return [-Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]; };
  TL.lurch = 5.0;                                         // it starts to fall
  TL.crack = (t) => U.smooth(39.2, 45.5, t);              // glowing fissures
  TL.split = (t) => U.clamp((t - 45.0) / 40.5) ** 1.35;   // the pieces drift apart

  /* ------------------------------ light: day -> dusk -> night ------------------------------ */
  TL.day = (t) => 1 - U.smooth(12.5, 27, t);
  TL.dusk = (t) => Math.max(0, Math.sin(Math.PI * U.clamp((t - 12.5) / 19)));
  TL.night = (t) => U.smooth(20, 33, t);
  TL.lamps = (t) => U.smooth(19.5, 21.5, t);

  /* ------------------------------ what happens on the ground ------------------------------ */
  TL.water = (t) => U.smooth(10.0, 11.5, t) * (1 - U.smooth(17, 19, t));        // the gutter runs the wrong way
  TL.stairWater = (t) => U.smooth(25.6, 29.6, t);                               // the water climbs the stairs
  TL.litter = (t) => U.clamp((t - 10.5) / 30);                                  // paper starts to float
  TL.taxi = (t) => U.clamp((t - 34.3) / 9);                                     // the taxi lifts
  TL.pull = (t) => U.smooth(48, 75, t);                                         // general upward pull on loose things
  TL.buildings = (t) => U.clamp((t - 57.4) / 14);                               // the buildings leave their foundations
  TL.railBend = (t) => U.smooth(67.6, 71.8, t);                                 // the railing bends up
  TL.lift = (t) => U.clamp((t - 71.8) / 13.7);                                  // you're off the ground
  TL.grip = (t) => U.smooth(44.6, 46.2, t) * (t < 85 ? 1 : 0);                  // both hands on the rail
  TL.reach = (t) => (1 - U.smooth(17.6, 18.6, t)) + U.smooth(33.4, 34.4, t) * (1 - U.smooth(43.6, 44.6, t)); // your right hand, out in front
  const JOLTS = [[5.0, 0.6], [39.6, 0.35], [49.6, 0.5], [53.0, 0.45], [56.4, 0.55], [60.8, 0.6], [64.2, 0.6], [66.5, 1.0], [71.8, 0.8]];
  TL.jolts = JOLTS;
  TL.shake = (t) => {
    let s = U.smooth(44, 72, t) * 0.25 + U.smooth(72, 85, t) * 0.35;
    for (const [a, k] of JOLTS) if (t > a) s += k * Math.exp(-(t - a) * 2.2);
    return Math.min(1.4, s);
  };

  /* ------------------------------ the pieces that fall ------------------------------
     each meteor: launch time, impact time, impact point on the ground (world x, z), size */
  const R = U.mulberry32(4242), M = [];
  const slots = [48.4, 49.0, 49.6, 50.8, 51.5, 53.0, 54.1, 55.2, 56.4, 57.3, 58.6, 59.9, 60.8, 61.9, 63.0, 64.2, 65.1, 66.0, 67.2, 68.5, 69.8, 71.0];
  for (const ti of slots) {
    const far = R(), side = R();
    // most land down the avenue toward the Moon; some across the street, a few close
    let x, z;
    if (side < 0.72) { x = -70 + R() * 180; z = -180 - far * 520; }
    else if (side < 0.92) { x = 50 + R() * 220; z = -30 - R() * 230; }
    else { x = -40 - R() * 160; z = -80 - R() * 200; }
    M.push({ t1: ti, t0: ti - 1.4 - R() * 1.2, x, z, s: 0.6 + R() * 1.2, seed: R() * 100 });
  }
  TL.meteors = M;
  TL.impacts = M.map((m) => m.t1);

  TL.chapters = [
    [0, 5, '5, 4, 3, 2, 1'], [5, 19, 'It starts to fall'], [19, 33.5, 'The subway'], [33.5, 44, 'The taxi'],
    [44, 66.5, 'Hold on'], [66.5, 75, 'The railing'], [75, DUR, 'Pulled up'],
  ];
  g.TL = TL;
})(window);
