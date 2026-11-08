/* =========================================================================
   ROOM 9 — core.js
   The timeline for the motel film. Shots and cues are placed on the real
   timing of the narration (films/motel/sentences.js), and the captions are
   cut from those sentences, so picture, words and voice stay together.
   Requires js/core.js first (it provides U); this replaces window.TL.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const S = g.MOTEL_SENTENCES;
  const at = (i) => S[i][0];   // when sentence i starts

  const TL = {
    W: 1080, H: 1920, FPS: 30, DURATION: 77.6,
    TITLE: 'Room 9', SLUG: 'room-9', POSTER: 1.6,

    shots: [
      [0, at(1), 'maskClose', 'intro'],
      [at(1), at(2), 'door9', 'simple'],
      [at(2), at(3), 'timer'],
      [at(3), at(4), 'motelWide'],
      [at(4), at(5), 'room', 'calm'],
      [at(5), at(6), 'car'],
      [at(6), at(7), 'door9', 'room'],
      [at(7), at(8), 'tv'],
      [at(8), at(9), 'bolt'],
      [at(9), at(10), 'room', 'fine'],
      [at(10), at(11), 'blinds'],
      [at(11), at(13), 'office'],
      [at(13), at(14), 'maskTurn'],
      [at(14), at(15), 'room', 'drop'],
      [at(15), at(16), 'remote'],
      [at(16), at(17), 'maskClose', 'heard'],
      [at(17), at(19), 'tvOff'],
      [at(19), at(20), 'lamp'],
      [at(20), at(21), 'darkRow'],
      [at(21), at(25), 'walkway'],
      [at(25), at(28), 'handle'],
      [at(28), at(30), 'key'],
      [at(30), at(32), 'sisterClose'],
      [at(32), at(34), 'bathroom'],
      [at(34), at(36), 'escape'],
      [at(36), at(38), 'cornRun'],
      [at(38), at(39), 'doorBang'],
      [at(39), 77.6, 'cornStalk'],
    ],

    /* cues (picture + sound read the same numbers) */
    stab: at(12) + 0.35,
    maskStare: at(13) + 1.5,
    remoteDrop: at(14) + 0.7,
    remoteCrack: at(15) + 0.05,
    tvOff: at(18) + 0.15,
    lampOff: at(19) + 1.2,
    doorChecks: [at(22) - 0.2, at(23) - 0.2, at(24) - 0.2],
    handleTurn: [at(25), at(27) + 0.05],       // turns slowly, snaps back on "Locked"
    keyIn: at(28) + 0.45,
    windowOpen: at(33) + 0.4,
    push: at(34) + 0.3,
    doorBang: at(38) + 1.55,
    maskReveal: 75.15,
    glitches: [at(16), at(26) - 0.1, 75.15],
    timerStart: at(16),
    clockFlip: 52.0,                           // 2:47 -> 2:48
  };

  TL.timeLeft = function (t) {
    const k = [[TL.timerStart, 60], [74.5, 6], [75.2, 1], [76.0, 0]];
    if (t < k[0][0]) return 60;
    for (let i = 1; i < k.length; i++) if (t < k[i][0]) return U.lerp(k[i - 1][1], k[i][1], (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
    return 0;
  };
  TL.ticks = [];
  { let last = 61; for (let t = TL.timerStart; t < TL.DURATION; t += 1 / 30) { const s = Math.ceil(TL.timeLeft(t) - 1e-6); if (s < last) { TL.ticks.push(+t.toFixed(3)); last = s; } } }

  // captions: each sentence cut into chunks of up to 3 words, timed by length
  TL.captions = [];
  S.forEach(([a, b, text], si) => {
    const words = text.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length;) {
      let n = Math.min(3, words.length - i);
      if (words.length - i - n === 1 && n === 3) n = 2; // avoid a lonely last word
      chunks.push(words.slice(i, i + n).join(' ')); i += n;
    }
    const len = chunks.map((c) => c.replace(/[*!]/g, '').length + 4);
    const tot = len.reduce((x, y) => x + y, 0);
    let t = a - 0.05;
    chunks.forEach((c, k) => { TL.captions.push([+t.toFixed(3), c]); t += (b - a + 0.1) * len[k] / tot; });
    const next = si + 1 < S.length ? S[si + 1][0] : TL.DURATION;
    if (next - b > 0.9) TL.captions.push([+(b + 0.45).toFixed(3), '']);
  });
  TL.captions.sort((x, y) => x[0] - y[0]);
  TL.hits = TL.captions.filter((c) => c[1].includes('!')).map((c) => c[0]);

  TL.chapters = [
    [0, at(3), 'The question'], [at(3), at(10), '2:47 AM'], [at(10), at(17), 'The office'], [at(17), at(21), 'Rule one'],
    [at(21), at(30), 'The doors'], [at(30), at(36), 'Rule two'], [at(36), TL.DURATION, 'The corn'],
  ];

  TL.shotAt = function (t) { for (const s of TL.shots) if (t >= s[0] && t < s[1]) return s; return TL.shots[TL.shots.length - 1]; };
  TL.captionAt = function (t) { let c = null; for (const k of TL.captions) { if (k[0] <= t) c = k; else break; } return c && c[1] ? c : null; };

  g.TL = TL;
})(window);
