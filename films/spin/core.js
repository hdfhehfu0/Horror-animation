/* =========================================================================
   STOPPED SPINNING — core.js
   "What if Earth stopped spinning?" (Part 3 of the galaxy series.)
   The timeline: captions, the spin counter, and the day clock phi(t) that
   drives everything -- a still afternoon; a time-lapse of days and nights
   that slow down until the Sun stops dead at noon; a day six months long
   that bakes the street; a slow sunset into a six-month night; and the thing
   that has been waiting for it. Placed on the narrator's word timings
   (films/spin/words.js). Requires js/core.js first (it provides U).
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const WORDS = g.SP_WORDS, S = g.SP_SENTENCES, DUR = g.SP_DURATION;
  const at = (i) => S[i][0], end = (i) => S[i][1];
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  function wa(txt, t0 = 0) {
    const k = norm(txt);
    for (const w of WORDS) if (w[0] >= t0 - 0.02 && norm(w[2]) === k) return w[0];
    throw new Error(`word "${txt}" not found after ${t0}`);
  }
  const TL = { W: 1080, H: 1920, FPS: 30, DURATION: DUR, TITLE: 'Stopped spinning', SLUG: 'stopped-spinning', POSTER: 1.2 };
  TL.CUT = +(end(22) + 0.6).toFixed(3);

  /* ------------------------------ captions ------------------------------ */
  const B = [
    ['title', 0, 0, 'What if Earth stopped spinning?'],
    ['event', 1, 1, "Right now, you're moving."],
    ['fact', 2, 3, "At the equator, Earth's surface spins at about 1,670 km/h. You just can't feel it."],
    ['event', 4, 4, 'Now imagine it slowing down.'],
    ['event', 5, 5, 'The days get longer.'],
    ['fact', 6, 7, "It's already happening. Every century, the day gets about 2 milliseconds longer."],
    ['fact', 8, 8, '1.4 billion years ago, a day lasted only about 18 hours.'],
    ['event', 9, 9, 'Then it stops.'],
    ['event', 10, 10, 'Now one day lasts a whole year.'],
    ['fact', 11, 13, 'The Sun would rise and set just once a year. 6 months of daylight. 6 months of night.'],
    ['event', 14, 15, "The Sun hangs in the sky. It doesn't move."],
    ['event', 16, 16, 'The ground bakes.'],
    ['fact', 17, 17, "Without the spin, Earth's oceans would drain toward the poles."],
    ['event', 18, 18, 'Then, finally, the Sun starts to set.'],
    ['event', 19, 19, 'And the night begins.'],
    ['fact', 20, 20, 'With no sunlight for months, the night side would plunge far below freezing.'],
    ['event', 21, 21, 'For anything that hunts in the dark, this is the longest night there has ever been.'],
    ['event', 22, 22, 'And something has been waiting for it.'],
    ['wait', 23, 23, 'Wait.'],
  ];
  TL.blocks = B.map(([kind, a, b, text], i) => {
    const nextStart = i + 1 < B.length ? at(B[i + 1][1]) : DUR;
    let t1 = Math.min(end(b) + 0.55, nextStart - 0.12);
    if (b === 22) t1 = TL.CUT - 0.02;
    if (kind === 'wait') t1 = at(b) + 1.9;
    return { kind, text, t0: +(at(a) - 0.12).toFixed(3), t1: +t1.toFixed(3) };
  });
  const wait = TL.blocks[TL.blocks.length - 1];
  TL.blocks.push({ kind: 'teaser', part: 'PART 4', text: 'What if the Moon crashed into Earth?', t0: +(wait.t1 + 0.5).toFixed(3), t1: +(wait.t1 + 3.6).toFixed(3) });
  TL.blocks.push({ kind: 'final', text: 'What if Earth stopped spinning?', mono: ['1,670 KM/H · +1.8 MS PER CENTURY · 18-HOUR DAYS', '· ONE DAY = ONE YEAR'], t0: +(wait.t1 + 4.2).toFixed(3), t1: DUR - 0.25 });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);

  /* ------------------------------ the day clock ------------------------------
     phi = days elapsed; frac(phi) in [0, .5) is daytime (sunrise -> noon at .25 -> sunset), [.5, 1) night.
     Still afternoon until the time-lapse starts; then days flash past and slow down until the Sun stops
     exactly at noon on "stops"; it holds for six months; then sets into the long night. */
  const T_L = at(4), T_S = wa('stops', at(9)), PHI0 = 0.17;
  const shape = (t) => U.smooth(T_L, T_L + 1.4, t) * Math.pow(U.clamp((T_S - t) / (T_S - T_L)), 1.8);
  const STEPS = 2000, dt = (T_S - T_L) / STEPS, cum = [0];
  for (let i = 0; i < STEPS; i++) cum.push(cum[i] + shape(T_L + (i + 0.5) * dt) * dt);
  const G = cum[STEPS], N = Math.max(1, Math.round(0.55 * G - 0.08)), SCALE = (N + 0.25 - PHI0) / G;
  const NIGHT = [[T_S, N + 0.25], [at(18), N + 0.25], [end(18) + 0.9, N + 0.5], [at(20) + 0.6, N + 0.6], [DUR, N + 0.66]];
  const kf = (K, x) => { if (x <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (x < K[i][0]) return U.lerp(K[i - 1][1], K[i][1], U.smooth(K[i - 1][0], K[i][0], x)); return K[K.length - 1][1]; };
  TL.phi = (t) => {
    if (t <= T_L) return PHI0;
    if (t < T_S) { const i = Math.min(STEPS, (t - T_L) / dt), k = Math.floor(i); return PHI0 + SCALE * U.lerp(cum[k], cum[Math.min(STEPS, k + 1)], i - k); }
    return kf(NIGHT, t);
  };
  TL.lapseRate = (t) => (t > T_L && t < T_S ? SCALE * shape(t) : 0);   // days per second of film
  // the Sun: s in [0,1] across the sky (0 = rising on the left, 1 = setting on the right), elev = sin(pi s); daylight 0..1
  TL.sun = (t) => {
    const f = ((TL.phi(t) % 1) + 1) % 1;
    if (f < 0.5) { const s = f / 0.5, e = Math.sin(Math.PI * s); return { s, e, day: U.smooth(-0.02, 0.22, e), tw: 1 - U.smooth(0.02, 0.3, e), up: true }; }
    const s = (f - 0.5) / 0.5;   // night: twilight right after sunset and right before sunrise
    return { s: 1 + s, e: -Math.sin(Math.PI * s), day: 0, tw: Math.max(1 - U.smooth(0, 0.12, s), U.smooth(0.88, 1, s)), up: false };
  };

  /* ------------------------------ the counter ------------------------------ */
  TL.T_L = T_L; TL.T_S = T_S;
  TL.speed = (t) => (t <= T_L ? 1670 : t >= T_S ? 0 : 1670 * Math.pow((T_S - t) / (T_S - T_L), 1.3));
  const sunsetIn = (t) => Math.max(1, Math.round(182 * (1 - U.clamp((t - at(12)) / (at(18) - at(12))))));
  TL.status = (t) => {
    if (t < T_S) {
      const h = 24 * 1670 / Math.max(TL.speed(t), 1e-3);
      if (h < 72) return `1 DAY = ${Math.round(h)} HOURS`;
      if (h < 24 * 60) return `1 DAY = ${Math.round(h / 24)} DAYS`;
      if (h < 24 * 330) return `1 DAY = ${Math.round(h / 24 / 30.4)} MONTHS`;
      return '1 DAY = 1 YEAR';
    }
    if (t < at(12)) return '1 DAY = 1 YEAR';
    if (t < at(18)) return `SUNSET IN ${sunsetIn(t)} DAYS`;
    if (t < end(19)) return 'SUNSET';
    return `NIGHT · DAY ${1 + Math.floor(2.4 * U.clamp((t - end(19)) / (TL.CUT - end(19))))} OF 182`;
  };

  /* ------------------------------ stage tracks ------------------------------ */
  const sm = (a, b) => (t) => U.smooth(a, b, t);
  TL.k = {
    lapse: (t) => Math.min(U.smooth(T_L - 0.2, T_L + 0.6, t), 1 - U.smooth(T_S - 0.6, T_S + 0.2, t)),   // the time-lapse badge
    stopHit: T_S,
    bake: sm(at(14), at(18)),          // the long day: grass browns, everything bleaches, heat haze
    leftHome: sm(at(14), at(16)),      // the windows stay dark from here on
    frost: sm(at(20), end(21) + 0.5),  // the long night: a cold rime
    longNight: end(19),
  };
  TL.creature = { t0: end(21) + 0.1, stop: at(22) + 0.3, t1: TL.CUT };

  TL.chapters = [
    [0, T_L - 0.1, 'An afternoon'], [T_L - 0.1, T_S, 'Slowing down'], [T_S, at(18) - 0.1, 'The longest day'],
    [at(18) - 0.1, at(21) - 0.1, 'Sunset'], [at(21) - 0.1, TL.CUT, 'The longest night'], [TL.CUT, DUR, 'Wait.'],
  ];
  TL.at = at; TL.end = end; TL.wa = wa;
  g.TL = TL;
})(window);
