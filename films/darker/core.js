/* =========================================================================
   DARKER — core.js
   The timeline of "What if it never stopped getting darker?". Every caption,
   counter key, light, window and pair of eyes is placed on the narrator's
   real word timings (films/darker/words.js), so picture, text and voice
   stay together. The sound mixer (mix.py) reads the same cues from here.
   Requires js/core.js first (it provides U); this replaces window.TL.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U } = g;
  const WORDS = g.DK_WORDS, S = g.DK_SENTENCES, DUR = g.DK_DURATION;
  const at = (i) => S[i][0], end = (i) => S[i][1];
  const norm = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
  function wa(txt, t0 = 0) {
    const k = norm(txt);
    for (const w of WORDS) if (w[0] >= t0 - 0.02 && norm(w[2]) === k) return w[0];
    throw new Error(`word "${txt}" not found after ${t0}`);
  }

  const TL = {
    W: 1080, H: 1920, FPS: 30, DURATION: DUR,
    TITLE: 'Darker', SLUG: 'darker', POSTER: 1.2,
    CUT: +(end(25) + 0.62).toFixed(3),   // the hard cut to black after "And it can see you."
  };

  /* ------------------------------ captions ------------------------------
     [kind, first sentence, last sentence, text]. Numbers are drawn in the mono font. */
  const B = [
    ['title', 0, 0, 'What if it never stopped getting darker?'],
    ['event', 1, 1, "It's getting darker."],
    ['fact', 2, 3, 'An overcast day is about 1,000 lux. A hundred times dimmer than sunlight.'],
    ['event', 4, 4, 'The streetlights flicker on.'],
    ['fact', 5, 5, 'When dusk ends, the light is about 3.4 lux.'],
    ['event', 6, 6, 'The colors drain away.'],
    ['fact', 7, 8, "In dim light, your eyes switch to rod cells. Rods can't see color."],
    ['event', 9, 9, 'Only the moon is left.'],
    ['fact', 10, 11, 'A full moon gives about 0.25 lux. The Sun is 400,000 times brighter.'],
    ['event', 12, 13, 'The streetlights go out. One by one.'],
    ['event', 14, 14, 'Something moves between the trees.'],
    ['fact', 15, 16, "Many animals have a mirror behind the retina. It's why their eyes glow at night."],
    ['event', 17, 17, 'The moon is gone.'],
    ['fact', 18, 18, 'A moonless night, lit only by stars: about 0.002 lux.'],
    ['event', 19, 19, 'The stars go out.'],
    ['fact', 20, 20, 'A cloudy night with no moon: about 0.0001 lux.'],
    ['event', 21, 21, "You can't see your own hand."],
    ['fact', 22, 22, "In total darkness, the brain starts inventing shapes that aren't there."],
    ['event', 23, 23, 'But some of them are real.'],
    ['fact', 24, 24, 'A cat can see in light about six times dimmer than you can.'],
    ['event', 25, 25, 'And it can see you.'],
    ['wait', 26, 26, 'Wait.'],
  ];
  TL.blocks = B.map(([kind, a, b, text], i) => {
    const nextStart = i + 1 < B.length ? at(B[i + 1][1]) : DUR;
    let t1 = Math.min(end(b) + 0.55, nextStart - 0.12);
    if (kind === 'event' && b === 25) t1 = TL.CUT - 0.02;   // vanishes with the cut
    if (kind === 'wait') t1 = at(b) + 1.9;
    return { kind, text, t0: +(at(a) - 0.12).toFixed(3), t1: +t1.toFixed(3) };
  });
  const wait = TL.blocks[TL.blocks.length - 1];
  TL.blocks.push({ kind: 'teaser', text: 'What if it never stopped getting quieter?', t0: +(wait.t1 + 0.5).toFixed(3), t1: +(wait.t1 + 3.6).toFixed(3) });
  TL.blocks.push({ kind: 'final', text: 'What if it never stopped getting darker?', t0: +(wait.t1 + 4.2).toFixed(3), t1: DUR - 0.25 });
  // the SRT track (app.js) reads TL.captions: [start, text] with '' for gaps
  TL.captions = [];
  TL.blocks.forEach((b) => { TL.captions.push([b.t0, b.text]); TL.captions.push([b.t1, '']); });
  TL.captions.sort((x, y) => x[0] - y[0]);

  /* ------------------------------ the counter ------------------------------
     lux keyed in log space: it crawls while a fact is on screen (so the number agrees
     with the fact you are reading) and falls fast during the event lines. */
  const L = [
    [0, 100000], [at(0) + 0.1, 98000], [end(0), 52000], [at(1), 30000], [end(1), 4200],
    [at(2), 1500], [wa('thousand', at(2)), 1000], [end(3), 930],
    [at(4), 640], [end(4), 22], [at(5), 6.5], [wa('four', at(5)), 3.4], [end(5), 3.2],
    [at(6), 2.9], [end(6), 1.25], [at(7), 1.15], [end(8), 0.62],
    [at(9), 0.48], [end(9), 0.3], [wa('quarter', at(10)), 0.25], [end(11), 0.236],
    [at(12), 0.22], [end(13), 0.11], [at(14), 0.092], [end(14), 0.05], [at(15), 0.046], [end(16), 0.021],
    [at(17), 0.016], [end(17), 0.0042], [wa('thousandths', at(18)), 0.002], [end(18), 0.0019],
    [at(19), 0.0017], [end(19), 0.00032], [wa('ten-thousandth', at(20)), 0.0001], [end(20), 0.000095],
    [at(21), 0.00008], [end(21), 1e-5], [end(22), 1e-7], [end(23), 1e-8], [end(24), 1e-11], [end(25), 1e-15], [TL.CUT - 0.01, 1e-17],
  ];
  TL.lux = function (t) {
    if (t >= TL.CUT - 0.3) return 0;   // the counter hits 0 a beat before the cut
    if (t <= L[0][0]) return L[0][1];
    for (let i = 1; i < L.length; i++) if (t < L[i][0]) {
      const [a, va] = L[i - 1], [b, vb] = L[i], k = (t - a) / (b - a);
      return Math.pow(10, U.lerp(Math.log10(va), Math.log10(vb), k));
    }
    return L[L.length - 1][1];
  };

  /* ------------------------------ keyed tracks ------------------------------ */
  function track(keys) {
    return (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
        const [a, va] = keys[i - 1], [b, vb] = keys[i], k = U.smooth(0, 1, (t - a) / (b - a));
        if (typeof va === 'number') return U.lerp(va, vb, k);
        return va.map((x, j) => U.lerp(x, vb[j], k));   // colours as [r,g,b]
      }
      return keys[keys.length - 1][1];
    };
  }
  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const D = {
    day: end(1), overcast: at(2) + 0.6, overcastEnd: end(3), dusk: end(4), duskEnd: end(5),
    drain0: at(6), drain1: end(6), moon0: at(9), moon1: end(9), moonGone0: at(17), moonGone1: end(17),
    starsOut0: at(19), starsOut1: end(19), hand0: at(21), hand1: end(21),
  };
  TL.D = D;
  TL.tr = {
    sun: track([[0, 2.6], [D.day, 2.3], [D.overcast + 1.2, 0.35], [D.overcastEnd, 0.3], [D.dusk, 0.1], [D.duskEnd, 0]]),
    sunCol: track([[0, hex('#ffe2b8')], [D.day, hex('#ffd9a8')], [D.overcast + 1.2, hex('#d9dde3')], [D.dusk, hex('#ff9a62')], [D.duskEnd, hex('#7a6aa0')]]),
    hemi: track([[0, 1.05], [D.overcast + 1.2, 1.15], [D.overcastEnd, 0.95], [D.dusk, 0.55], [D.duskEnd, 0.26], [D.moon1, 0.2], [D.moonGone0, 0.2], [D.moonGone1, 0.07], [D.starsOut0, 0.06], [D.starsOut1, 0.02], [D.hand1, 0]]),
    moon: track([[0, 0], [D.moon0, 0], [D.moon1, 0.95], [D.moonGone0, 0.95], [D.moonGone1, 0]]),
    skyTop: track([[0, hex('#4f86c6')], [D.day, hex('#5b88bd')], [D.overcast + 1.2, hex('#7d8792')], [D.overcastEnd, hex('#6e7884')], [D.dusk, hex('#2c3566')], [D.duskEnd, hex('#141a36')], [D.moon1, hex('#0c1430')], [D.moonGone0, hex('#0c1430')], [D.moonGone1, hex('#04060d')], [D.starsOut1, hex('#000000')]]),
    skyLow: track([[0, hex('#d8e6f2')], [D.day, hex('#d2dfe9')], [D.overcast + 1.2, hex('#b4bac1')], [D.overcastEnd, hex('#a7adb4')], [D.dusk, hex('#d77a55')], [D.duskEnd, hex('#3d3456')], [D.moon1, hex('#1d2a48')], [D.moonGone0, hex('#1d2a48')], [D.moonGone1, hex('#0a0c15')], [D.starsOut1, hex('#000000')]]),
    stars: track([[0, 0], [D.duskEnd - 1, 0], [D.duskEnd + 1.5, 0.35], [D.moon1, 0.25], [D.moonGone0, 0.25], [D.moonGone1, 0.95], [D.starsOut0, 0.95], [D.starsOut1, 0]]),
    clouds: track([[0, 0], [D.moonGone0, 0], [D.moonGone1, 1]]),
    sat: track([[0, 1], [D.drain0, 1], [D.drain1, 0.12]]),
    expo: track([[0, 1], [D.moonGone0, 1], [D.moonGone1, 0.8], [D.starsOut0, 0.72], [D.starsOut1, 0.34], [D.hand0, 0.22], [D.hand1, 0]]),
    grain: track([[0, 0.02], [D.duskEnd, 0.05], [D.moonGone1, 0.09], [D.hand1, 0.12]]),
    phos: track([[0, 0], [at(22), 0], [at(22) + 0.9, 1], [end(22) - 0.2, 1], [at(23) + 0.6, 0.12], [end(23), 0]]),
  };

  /* streetlights: far -> near they go out on "go out. One by one." */
  const lampOn = [wa('flicker', at(4)) - 0.1, wa('flicker', at(4)) + 0.25, wa('on', at(4)) - 0.05, wa('on', at(4)) + 0.35];
  const lampOff = [wa('out', at(12)), wa('one', at(13)), wa('by', at(13)), wa('one', wa('by', at(13)))];
  TL.lamps = lampOn.map((on, i) => ({ on: +on.toFixed(3), off: +lampOff[3 - i].toFixed(3) }));   // index 0 = nearest
  /* house windows: they come on through dusk and go dark while "Only the moon is left" */
  TL.windowsOn = (i) => end(4) + 0.3 + U.hash(i * 7.3) * 4.2;
  TL.windowsOff = (i) => at(9) + U.hash(i * 3.7 + 1) * (end(9) - at(9) + 0.8);

  /* the thing between the trees, and the eyes */
  TL.creature = { t0: at(14) + 0.2, t1: end(14) + 0.3 };
  const eyes = [
    // [x, y, z, appears, size]
    [1.6, 2.5, -86, wa('eyes', at(16)), 1],
    [-7.5, 1.4, -66, wa('glow', at(16)), 1],
    [9.5, 1.9, -47, wa('night', at(16)), 1],
    [-3.6, 1.0, -30, wa('stars', at(18)), 1],
    [7.2, 2.2, -24, wa('lux', at(18)), 1],
    [-9.0, 1.5, -16, wa('moon', at(20)), 1],
    [3.0, 0.7, -12, wa('lux', at(20)), 0.9],
  ];
  const close = wa('hand', at(21));
  TL.eyes = eyes.map(([x, y, z, t0, s], i) => ({ x, y, z, t0: +t0.toFixed(3), t1: +(close + i * 0.04).toFixed(3), s, seed: i * 9.1 + 2 }));
  TL.real = { t0: wa('real', at(23)), x: 0.3, y: 1.75, z: -22, zEnd: -5.5, t1: end(24) };
  TL.close = { t0: at(25) - 0.05, see: wa('see', at(25)), you: wa('you', at(25)), t1: TL.CUT };
  TL.wait = { t0: at(26) };

  TL.chapters = [
    [0, at(4) - 0.1, 'Daylight'], [at(4) - 0.1, at(9) - 0.1, 'Dusk'], [at(9) - 0.1, at(17) - 0.1, 'The moon'],
    [at(17) - 0.1, at(21) - 0.1, 'Starlight'], [at(21) - 0.1, TL.CUT, 'Nothing'], [TL.CUT, DUR, 'Wait.'],
  ];
  TL.at = at; TL.end = end; TL.wa = wa;
  g.TL = TL;
})(window);
