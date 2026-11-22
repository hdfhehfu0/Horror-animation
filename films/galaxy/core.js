/* =========================================================================
   GALAXY — core.js
   "What if another galaxy hit us?" The timeline: captions, the distance /
   years counter, and every stage of the street ageing and the sky filling
   with Andromeda, placed on the narrator's word timings (films/galaxy/words.js).
   Everything visual reads a *story time* st(t): it runs forward with the film,
   rewinds to tonight on "Or maybe not.", and stays there for the ending.
   Requires js/core.js first (it provides U); this replaces window.TL.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const WORDS = g.GX_WORDS, S = g.GX_SENTENCES, DUR = g.GX_DURATION;
  const at = (i) => S[i][0], end = (i) => S[i][1];
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9'-]/g, '');
  function wa(txt, t0 = 0) {
    const k = norm(txt);
    for (const w of WORDS) if (w[0] >= t0 - 0.02 && norm(w[2]) === k) return w[0];
    throw new Error(`word "${txt}" not found after ${t0}`);
  }
  const TL = { W: 1080, H: 1920, FPS: 30, DURATION: DUR, TITLE: 'Galaxy', SLUG: 'galaxy', POSTER: 1.2 };
  TL.CUT = +(end(26) + 0.6).toFixed(3);

  /* ------------------------------ captions ------------------------------ */
  const B = [
    ['title', 0, 0, 'What if another galaxy hit us?'],
    ['event', 1, 1, "It's already on its way."],
    ['fact', 2, 3, 'The Andromeda galaxy is about 2.5 million light-years away. You can see it without a telescope.'],
    ['event', 4, 4, "And it's getting closer."],
    ['fact', 5, 5, "It's coming toward us at about 110 kilometers per second."],
    ['event', 6, 6, 'The street empties.'],
    ['fact', 7, 7, 'In about 1 billion years, the brightening Sun will make Earth too hot for life.'],
    ['event', 8, 9, 'The trees die. The road turns to dust.'],
    ['fact', 10, 10, 'Andromeda holds about a trillion stars.'],
    ['event', 11, 11, 'Then a smaller galaxy hits us first.'],
    ['fact', 12, 12, 'The Large Magellanic Cloud should crash into the Milky Way in about 2.5 billion years.'],
    ['event', 13, 13, 'Now the sky is tearing apart.'],
    ['fact', 14, 15, 'Even then, stars almost never collide. Space is that empty.'],
    ['event', 16, 16, 'The sky catches fire with newborn stars.'],
    ['fact', 17, 17, 'Colliding galaxies squeeze their gas clouds, setting off bursts of new stars.'],
    ['event', 18, 18, 'The two hearts close in.'],
    ['fact', 19, 19, "Andromeda's central black hole is dozens of times heavier than ours."],
    ['event', 20, 20, 'Together, they become one galaxy.'],
    ['fact', 21, 21, 'Astronomers already have a name for it: Milkomeda.'],
    ['event', 22, 22, 'Or maybe not.'],
    ['fact', 23, 24, 'In 2025, astronomers ran thousands of simulations. Only about half ended in a crash within 10 billion years.'],
    ['event', 25, 25, 'So keep watching the sky.'],
    ['event', 26, 26, 'Something else already is.'],
    ['wait', 27, 27, 'Wait.'],
  ];
  TL.blocks = B.map(([kind, a, b, text], i) => {
    const nextStart = i + 1 < B.length ? at(B[i + 1][1]) : DUR;
    let t1 = Math.min(end(b) + 0.55, nextStart - 0.12);
    if (b === 26) t1 = TL.CUT - 0.02;
    if (kind === 'wait') t1 = at(b) + 1.9;
    return { kind, text, t0: +(at(a) - 0.12).toFixed(3), t1: +t1.toFixed(3) };
  });
  const wait = TL.blocks[TL.blocks.length - 1];
  TL.blocks.push({ kind: 'teaser', part: 'PART 2', text: 'What if a black hole passed through?', t0: +(wait.t1 + 0.5).toFixed(3), t1: +(wait.t1 + 3.6).toFixed(3) });
  TL.blocks.push({ kind: 'final', text: 'What if another galaxy hit us?', mono: ['MILKOMEDA · ONE GALAXY · A COIN FLIP', '· ABOUT 50% WITHIN 10 BILLION YEARS'], t0: +(wait.t1 + 4.2).toFixed(3), t1: DUR - 0.25 });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);

  /* ------------------------------ story time ------------------------------ */
  const REW0 = wa('or', at(22)), REW1 = end(22) + 0.15, PRESENT = 3.0;
  TL.REW = [REW0, REW1];
  TL.st = (t) => (t < REW0 ? t : t < REW1 ? U.lerp(REW0, PRESENT, U.easeInOut((t - REW0) / (REW1 - REW0))) : PRESENT);

  /* ------------------------------ the counter ------------------------------
     years from now (billions), keyed on story time; distance follows the years */
  const Y = [
    [0, 0], [at(6), 0], [end(6), 0.5], [at(7), 0.6], [wa('billion', at(7)), 1.0], [end(7), 1.08],
    [at(8), 1.15], [end(9), 1.8], [at(10), 1.85], [end(10), 2.15], [at(11), 2.2], [end(11), 2.38],
    [wa('half', at(12)), 2.5], [end(12), 2.56], [at(13), 2.6], [end(13), 4.5], [at(14), 4.55], [end(15), 4.8],
    [at(16), 4.85], [end(16), 5.15], [at(17), 5.2], [end(17), 5.45], [at(18), 5.5], [end(18), 5.95],
    [at(19), 6.0], [end(19), 6.3], [wa('galaxy', at(20)), 6.6], [end(21), 7.0],
  ];
  const D = [[0, 2.5e6], [1, 2.13e6], [2.5, 1.52e6], [4.5, 1.5e5], [4.8, 9e4], [5.2, 6e4], [5.5, 3e4], [6.0, 1e4], [6.3, 3e3], [6.6, 0], [99, 0]];
  const interp = (K, x) => { if (x <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (x < K[i][0]) return U.lerp(K[i - 1][1], K[i][1], (x - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); return K[K.length - 1][1]; };
  TL.years = (t) => interp(Y, TL.st(t));
  TL.dist = (t) => interp(D, TL.years(t));

  /* ------------------------------ stage tracks (functions of story time) ------------------------------ */
  const sm = (a, b) => (st) => U.smooth(a, b, st);
  TL.k = {
    empty: sm(at(6), end(6) + 0.3),                 // windows and streetlights go out
    leaves: sm(at(8), end(8) + 0.5),                // crowns wither
    dust: sm(at(9), end(9) + 0.8),                  // sand rises over the road
    ruin: sm(at(9), at(13)),                        // houses crumble
    fall: sm(at(13), end(13)),                      // the last trunks go down
    lmc: (st) => U.clamp((st - at(11)) / (wa('crash', at(12)) - at(11))),
    lmcHit: wa('crash', at(12)),
    tear: sm(at(13), end(13) + 1),
    burst: sm(at(16), end(17)),
    cores: (st) => U.clamp((st - at(18)) / (wa('galaxy', at(20)) - at(18))),
    merge: wa('galaxy', at(20)),
    glow: (st) => U.smooth(at(13), wa('galaxy', at(20)), st),   // how much the sky lights the ground
  };
  TL.creature = { t0: at(25) - 0.4, t1: TL.CUT };
  TL.whisper = at(26);

  TL.chapters = [
    [0, at(6) - 0.1, 'Tonight'], [at(6) - 0.1, at(13) - 0.1, 'A billion years'], [at(13) - 0.1, at(20) - 0.1, 'The collision'],
    [at(20) - 0.1, REW0, 'Milkomeda'], [REW0, TL.CUT, 'Or maybe not'], [TL.CUT, DUR, 'Wait.'],
  ];
  TL.at = at; TL.end = end; TL.wa = wa;
  g.TL = TL;
})(window);
