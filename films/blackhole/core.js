/* =========================================================================
   BLACK HOLE — core.js
   "What if a black hole passed through?" (Part 2 of the galaxy series.)
   The timeline: captions, the temperature counter and every stage of the
   flyby and the freeze -- the lens growing in the sky, the Moon torn away,
   Earth flung out of orbit, the frost, the lights dying, the air falling as
   snow -- placed on the narrator's word timings (films/blackhole/words.js).
   Requires js/core.js first (it provides U); this replaces window.TL.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const WORDS = g.BH_WORDS, S = g.BH_SENTENCES, DUR = g.BH_DURATION;
  const at = (i) => S[i][0], end = (i) => S[i][1];
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  function wa(txt, t0 = 0) {
    const k = norm(txt);
    for (const w of WORDS) if (w[0] >= t0 - 0.02 && norm(w[2]) === k) return w[0];
    throw new Error(`word "${txt}" not found after ${t0}`);
  }
  const TL = { W: 1080, H: 1920, FPS: 30, DURATION: DUR, TITLE: 'Black hole', SLUG: 'black-hole', POSTER: 1.2 };
  TL.CUT = +(end(27) + 0.6).toFixed(3);

  /* ------------------------------ captions ------------------------------ */
  const B = [
    ['title', 0, 0, 'What if a black hole passed through?'],
    ['event', 1, 1, "There's one out there right now."],
    ['fact', 2, 3, 'In 2022, astronomers found the first black hole drifting alone through space, about 5,000 light-years away.'],
    ['fact', 4, 4, 'Our galaxy could hold about 100 million more.'],
    ['event', 5, 5, 'Now imagine one heading our way.'],
    ['event', 6, 6, "You wouldn't see it coming."],
    ['fact', 7, 8, "It gives off no light at all. You'd only see the stars bending around it."],
    ['fact', 9, 9, 'A black hole 7 times heavier than the Sun is only about 40 km wide.'],
    ['event', 10, 10, "It doesn't even need to hit us."],
    ['event', 11, 11, 'Its gravity rips the Moon away.'],
    ['event', 12, 12, 'Then it throws Earth out of its orbit.'],
    ['event', 13, 14, 'Morning never comes. The Sun is just a bright star now.'],
    ['fact', 15, 15, 'Within about a week, the whole planet would be colder than a freezer: below −18°C.'],
    ['event', 16, 17, 'The lights go out. The oceans freeze over.'],
    ['event', 18, 19, 'Then the air itself starts to freeze. It falls like snow.'],
    ['fact', 20, 20, 'Nitrogen, most of the air we breathe, freezes at −210°C.'],
    ['event', 21, 21, 'Earth is a rogue planet now.'],
    ['fact', 22, 22, 'Rogue planets may outnumber the stars in our galaxy.'],
    ['event', 23, 25, 'No sunlight. No air. No sound.'],
    ['event', 26, 26, 'Nothing could survive out here.'],
    ['event', 27, 27, 'Nothing human.'],
    ['wait', 28, 28, 'Wait.'],
  ];
  TL.blocks = B.map(([kind, a, b, text], i) => {
    const nextStart = i + 1 < B.length ? at(B[i + 1][1]) : DUR;
    let t1 = Math.min(end(b) + 0.55, nextStart - 0.12);
    if (b === 27) t1 = TL.CUT - 0.02;
    if (kind === 'wait') t1 = at(b) + 1.9;
    return { kind, text, t0: +(at(a) - 0.12).toFixed(3), t1: +t1.toFixed(3) };
  });
  const wait = TL.blocks[TL.blocks.length - 1];
  TL.blocks.push({ kind: 'teaser', part: 'PART 3', text: 'What if Earth stopped spinning?', t0: +(wait.t1 + 0.5).toFixed(3), t1: +(wait.t1 + 3.6).toFixed(3) });
  TL.blocks.push({ kind: 'final', text: 'What if a black hole passed through?', mono: ['OGLE-2011-BLG-0462 · ABOUT 7 SUNS · ~40 KM WIDE', '· ABOUT 5,000 LIGHT-YEARS AWAY'], t0: +(wait.t1 + 4.2).toFixed(3), t1: DUR - 0.25 });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);

  /* ------------------------------ the counter ------------------------------
     average surface temperature (°C), and a status line under it */
  const interp = (K, x) => { if (x <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (x < K[i][0]) return U.lerp(K[i - 1][1], K[i][1], U.smooth(K[i - 1][0], K[i][0], x)); return K[K.length - 1][1]; };
  const T = [
    [0, 15], [at(12), 15], [end(12), 13], [at(13), 12], [end(14), 4], [at(15), 2], [end(15), -18], [at(16), -22],
    [end(17), -73], [at(18), -80], [end(20), -210], [at(21), -214], [end(22), -228], [at(23), -232], [DUR, -236],
  ];
  TL.temp = (t) => interp(T, t);
  const BHD = [[0, 5000 * 63241], [at(5), 5000 * 63241], [at(6), 3000], [at(8), 400], [at(9), 60], [at(10), 8], [at(11), 0.4], [wa('moon', at(11)), 0.02]];
  TL.status = (t) => {
    if (t < at(12)) {
      const au = interp(BHD, t);
      if (au > 63241 * 2) return `BLACK HOLE: ${Math.round(au / 63241).toLocaleString('en-US')} LIGHT-YEARS AWAY`;
      return `BLACK HOLE: ${au >= 10 ? Math.round(au).toLocaleString('en-US') : au.toFixed(2)} AU AWAY`;
    }
    if (t < at(13)) return 'EARTH: OUT OF ORBIT';
    if (t < at(15)) return 'DAY 1';
    if (t < end(15)) return `DAY ${1 + Math.floor(6 * U.clamp((t - at(15)) / (end(15) - at(15) - 0.3)))}`;
    if (t < at(16)) return 'DAY 7';
    if (t < end(17)) return `DAY ${7 + Math.floor(358 * U.clamp((t - at(16)) / (end(17) - at(16))))}`;
    if (t < at(21)) return 'YEAR 1 AND COUNTING';
    return 'EARTH: ROGUE PLANET';
  };

  /* ------------------------------ stage tracks ------------------------------ */
  const sm = (a, b) => (t) => U.smooth(a, b, t);
  const T_MOON = wa('rips', at(11)), T_THROW = wa('throws', at(12)), T_OUT = wa('out', at(16));
  TL.k = {
    // the lens: its Einstein radius (px) and where it is in the sky
    lensR: (t) => {
      if (t < at(5) - 0.5) return 0;
      if (t < end(11)) return 300 * Math.pow(U.clamp((t - at(5) + 0.5) / (end(11) - at(5) + 0.5)), 1.3);
      return 300 * (1 - U.smooth(T_THROW, end(12) + 0.6, t));
    },
    lensPos: (t) => {
      const k = U.clamp((t - at(5)) / (end(11) - at(5)));
      if (t < end(11)) return [U.lerp(330, 610, U.easeInOut(k)), U.lerp(330, 470, U.easeInOut(k))];
      const q = U.clamp((t - end(11)) / (end(12) + 0.6 - end(11)));
      return [U.lerp(610, 200, U.easeIn(q)), U.lerp(470, 800, U.easeIn(q))];
    },
    tag: (t) => Math.min(U.smooth(at(5), at(5) + 0.8, t), 1 - U.smooth(T_THROW - 0.4, T_THROW + 0.2, t)),
    moon: (t) => U.clamp((t - T_MOON) / (end(11) + 0.35 - T_MOON)),    // 0 = in place, 1 = gone
    fling: sm(T_THROW - 0.2, end(12) + 0.4),                              // the sky swings away
    shake: (t) => Math.max(0, 1 - Math.abs(t - (T_THROW + 0.5)) / 1.6),
    dawn: (t) => Math.max(0, Math.sin(Math.PI * U.clamp((t - at(13)) / (end(13) + 0.6 - at(13))))),  // a dawn that never comes
    sun: sm(at(14), at(14) + 1.2),                                         // the Sun: just a bright star
    frost: sm(at(15), end(17) + 1.2),
    out: T_OUT,                                                            // lights flicker and die
    ice: at(17),
    snow: (t) => Math.min(U.smooth(at(18) + 0.3, end(19), t), 1 - U.smooth(end(22) - 0.5, at(24), t)),
    drift: sm(at(18), end(22)),
    airless: sm(end(22), at(24)),                                          // no air: no twinkle, no glow, perfect black
  };
  TL.T_MOON = T_MOON; TL.T_THROW = T_THROW;
  TL.creature = { t0: end(26) + 0.15, stop: at(27), t1: TL.CUT };

  TL.chapters = [
    [0, at(5) - 0.1, 'Out there'], [at(5) - 0.1, at(12) - 0.1, 'The approach'], [at(12) - 0.1, at(15) - 0.1, 'Thrown out'],
    [at(15) - 0.1, at(21) - 0.1, 'The freeze'], [at(21) - 0.1, TL.CUT, 'Rogue planet'], [TL.CUT, DUR, 'Wait.'],
  ];
  TL.at = at; TL.end = end; TL.wa = wa;
  g.TL = TL;
})(window);
