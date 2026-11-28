/* =========================================================================
   QUIETER — core.js
   Part 2: "What if it never stopped getting quieter?". The timeline: every
   caption, counter key, car, bird, gust and heartbeat is placed on the
   narrator's word timings (films/quieter/words.js). mix.py reads the same
   cues from here.
   Requires js/core.js first (it provides U); this replaces window.TL.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const WORDS = g.QT_WORDS, S = g.QT_SENTENCES, DUR = g.QT_DURATION;
  const at = (i) => S[i][0], end = (i) => S[i][1];
  const norm = (s) => s.toLowerCase().replace(/[^a-z'-]/g, '');
  function wa(txt, t0 = 0) {
    const k = norm(txt);
    for (const w of WORDS) if (w[0] >= t0 - 0.02 && norm(w[2]) === k) return w[0];
    throw new Error(`word "${txt}" not found after ${t0}`);
  }

  const TL = { W: 1080, H: 1920, FPS: 30, DURATION: DUR, TITLE: 'Quieter', SLUG: 'quieter', POSTER: 1.2 };
  TL.CUT = +(end(23) + 0.55).toFixed(3);

  /* ------------------------------ captions ------------------------------ */
  const B = [
    ['title', 0, 0, 'What if it never stopped getting quieter?'],
    ['event', 1, 1, "It's getting quieter."],
    ['fact', 2, 2, 'A normal conversation is about 60 decibels.'],
    ['event', 3, 3, 'The traffic fades away.'],
    ['fact', 4, 4, 'A quiet library: about 40 decibels.'],
    ['event', 5, 5, 'The birds stop singing.'],
    ['fact', 6, 6, 'A whisper is about 30 decibels.'],
    ['event', 7, 7, 'Even the wind goes still.'],
    ['fact', 8, 8, 'Rustling leaves: about 20 decibels.'],
    ['event', 9, 9, 'Now you can hear yourself breathe.'],
    ['fact', 10, 10, 'Normal breathing is about 10 decibels.'],
    ['event', 11, 11, 'Then, nothing at all.'],
    ['fact', 12, 12, '0 decibels is the quietest sound a healthy human ear can detect.'],
    ['event', 13, 13, 'But you still hear something.'],
    ['fact', 14, 14, "In one famous study, 94% of people in a soundproof room started hearing ringing that wasn't there."],
    ['event', 15, 16, 'Your heartbeat. Your blood.'],
    ['fact', 17, 18, 'The quietest room ever measured: about −20 decibels. People inside can hear their own hearts beating.'],
    ['event', 19, 19, 'Then even that is gone.'],
    ['fact', 20, 20, 'At about −23 decibels, the only sound left would be air molecules hitting your eardrums.'],
    ['event', 21, 21, 'Total silence.'],
    ['event', 22, 22, 'So you would hear anything.'],
    ['event', 23, 23, 'Even something breathing…'],
    ['wait', 24, 24, 'Wait.'],
  ];
  const RIGHT = wa('right', at(23));
  TL.blocks = B.map(([kind, a, b, text], i) => {
    const nextStart = i + 1 < B.length ? at(B[i + 1][1]) : DUR;
    let t1 = Math.min(end(b) + 0.55, nextStart - 0.12);
    if (b === 23) t1 = RIGHT - 0.06;
    if (kind === 'wait') t1 = at(b) + 1.9;
    return { kind, text, t0: +(at(a) - 0.12).toFixed(3), t1: +t1.toFixed(3) };
  });
  TL.blocks.splice(TL.blocks.length - 1, 0, { kind: 'event', text: 'right behind you.', t0: +(RIGHT - 0.04).toFixed(3), t1: TL.CUT - 0.02 });
  const wait = TL.blocks[TL.blocks.length - 1];
  TL.blocks.push({ kind: 'teaser', part: 'PART 3', text: 'What if it never stopped getting closer?', t0: +(wait.t1 + 0.5).toFixed(3), t1: +(wait.t1 + 3.6).toFixed(3) });
  TL.blocks.push({ kind: 'final', text: 'What if it never stopped getting quieter?', mono: ['TOTAL SILENCE · −∞ dB', '· WHERE YOU HEAR EVERYTHING'], t0: +(wait.t1 + 4.2).toFixed(3), t1: DUR - 0.25 });
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);

  /* ------------------------------ the counter (dB) ------------------------------
     crawls at each fact's number while the fact is on screen, falls fast between them,
     reaches −∞ on "Total silence" -- then jumps back up when something starts breathing */
  const SIL = wa('silence', at(21)), BREATH = wa('breathing', at(23));
  const K = [
    [0, 74.2], [end(0), 70.5], [at(1), 69], [end(1), 64], [at(2), 61.2], [wa('sixty', at(2)), 60], [end(2), 59.6],
    [at(3), 57], [end(3), 43], [at(4), 41.4], [wa('forty', at(4)), 40], [end(4), 39.6],
    [at(5), 38.5], [end(5), 32.5], [at(6), 31], [wa('thirty', at(6)), 30], [end(6), 29.6],
    [at(7), 28.5], [end(7), 22], [at(8), 21], [wa('twenty', at(8)), 20], [end(8), 19.6],
    [at(9), 18.5], [end(9), 12], [at(10), 11], [wa('ten', at(10)), 10], [end(10), 9.6],
    [at(11), 8.5], [end(11), 1.5], [wa('zero', at(12)), 0], [end(12), -0.4],
    [at(13), -1.2], [end(13), -4.5], [at(14), -5.5], [end(14), -9],
    [at(15), -10], [end(16), -16.5], [at(17), -18.5], [wa('twenty', at(17)), -20], [end(18), -20.4],
    [at(19), -20.8], [end(19), -22.2], [wa('twenty-three', at(20)), -23], [end(20), -23.2], [SIL - 0.2, -23.4],
  ];
  TL.db = function (t) {
    if (t >= BREATH) return 9.5 + 2.5 * Math.sin(t * 3.1) + (t > RIGHT ? 4 : 0);    // something is breathing
    if (t >= SIL) return -Infinity;
    if (t <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (t < K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; return U.lerp(va, vb, (t - a) / (b - a)); }
    return K[K.length - 1][1];
  };

  /* ------------------------------ cues ------------------------------ */
  TL.Q = {
    still: wa('still', at(7)),                    // the wind stops; everything that moved in it freezes
    birdsOff: wa('stop', at(5)),                 // the birds leave the wire
    breathe0: wa('breathe', at(9)), breathe1: at(11),   // your breathing; held on "Then,"
    heart0: wa('heartbeat', at(15)), heart1: wa('gone', at(19)),
    ring: wa('ringing', at(14)),
    molecules: wa('molecules', at(20)),
    silence: SIL, anything: wa('anything', at(22)), breath: BREATH, right: RIGHT, you: wa('you', RIGHT),
  };
  // cars crossing behind the barricade, until the traffic fades away: [start, dir, lane, colour]
  TL.cars = [[0.0, 1, 0, '#b8322a'], [1.9, -1, 1, '#e6e2d8'], [4.2, 1, 0, '#2f5f8a'], [6.0, -1, 1, '#c9a13a'], [7.9, 1, 0, '#3d3d42'], [at(3) + 0.6, -1, 1, '#8a2d2d']];
  TL.carTime = 6.5;   // seconds for a car to cross the gap
  TL.sat = (t) => U.lerp(1, 0.62, U.smooth(TL.Q.still, SIL, t));
  TL.wind = (t) => (t < TL.Q.still ? 1 : 0);

  TL.chapters = [
    [0, at(3) - 0.1, 'Afternoon'], [at(3) - 0.1, at(9) - 0.1, 'The world goes quiet'], [at(9) - 0.1, at(13) - 0.1, 'Your breath'],
    [at(13) - 0.1, SIL, 'Your heart'], [SIL, TL.CUT, 'Silence'], [TL.CUT, DUR, 'Wait.'],
  ];
  TL.at = at; TL.end = end; TL.wa = wa;
  g.TL = TL;
})(window);
