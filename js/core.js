/* =========================================================================
   ONE MINUTE — core.js
   Utilities + the TIMELINE. The picture (scenes.js) and the soundtrack
   (audio.js) both read every shot, caption and sound cue from TL.
   Timings follow the reference video (9:16, 78.7 s).
   ========================================================================= */
(function (g) {
  'use strict';

  const U = {
    clamp: (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
    lerp: (a, b, t) => a + (b - a) * t,
    smooth(a, b, x) { const t = U.clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); },
    lin(a, b, x) { return U.clamp((x - a) / (b - a)); },
    easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeIn: (t) => t * t * t,
    backOut(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); },
    noise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return U.lerp(U.hash(i), U.hash(i + 1), u); },
    snoise(x) { return (U.noise(x) * 0.65 + U.noise(x * 2.3 + 17) * 0.35) * 2 - 1; },
    mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
  };

  const TL = {
    W: 1080, H: 1920, FPS: 30, DURATION: 78.7,
    TITLE: 'One Minute',

    /* ---- shots: [start, end, scene id, variant] ---- */
    shots: [
      [0.00, 2.73, 'killerFace', 'intro'],
      [2.73, 3.77, 'doorFeet', 'intro'],
      [3.77, 5.00, 'timer'],
      [5.00, 6.73, 'blockZoom'],
      [6.73, 10.13, 'windowSit', 'calm'],
      [10.13, 12.33, 'doorLock'],
      [12.33, 13.43, 'windowSit', 'safe'],
      [13.43, 15.00, 'lookOut'],
      [15.00, 16.10, 'acrossZoom'],
      [16.10, 19.83, 'murder'],
      [19.83, 22.83, 'killerFace', 'stare'],
      [22.83, 23.97, 'windowSit', 'slip'],
      [23.97, 25.67, 'mugSmash'],
      [25.67, 26.60, 'blockScan', 'a'],
      [26.60, 28.03, 'windowSit', 'target'],
      [28.03, 29.97, 'lightSwitch'],
      [29.97, 32.33, 'blockScan', 'dark'],
      [32.33, 35.00, 'curtains'],
      [35.00, 37.33, 'blockCount', 'window'],
      [37.33, 38.00, 'blockCount', 'floor'],
      [38.00, 39.33, 'blockAngle'],
      [39.33, 41.67, 'entrance'],
      [41.67, 43.00, 'stairs'],
      [43.00, 43.93, 'stairLights'],
      [43.93, 45.00, 'corridor'],
      [45.00, 45.67, 'doorFeet', 'knock'],
      [45.67, 48.33, 'hug'],
      [48.33, 49.33, 'doorFeet', 'blows'],
      [49.33, 51.00, 'doorChain'],
      [51.00, 54.67, 'doorFeet', 'rule2'],
      [54.67, 57.67, 'mumFace'],
      [57.67, 60.67, 'openWindow'],
      [60.67, 62.00, 'windowWind'],
      [62.00, 63.33, 'ledgeBelow'],
      [63.33, 66.00, 'ledge'],
      [66.00, 68.33, 'lookDown'],
      [68.33, 71.00, 'onLedge'],
      [71.00, 72.33, 'doorFeet', 'behind'],
      [72.33, 74.00, 'doorBurst'],
      [74.00, 75.00, 'onLedge', 'after'],
      [75.00, 77.00, 'handWall'],
      [77.00, 78.70, 'killerAbove'],
    ],

    /* ---- captions: [start, text]  *word = yellow, !word = red, '' = none ---- */
    captions: [
      [0.33, 'WHAT DO *YOU'], [0.67, 'DO WHEN A'], [1.33, '!KILLER HAS SEEN'], [2.0, '*YOU?'],
      [2.67, '*SIMPLE.'], [3.67, ''], [4.0, "*YOU'VE GOT ONE"], [4.33, '!MINUTE.'], [5.0, ''],
      [5.33, '*3 AM.'], [6.67, '*YOU AND *MUM'], [7.0, 'ARE *SITTING BY'], [7.67, 'THE *WINDOW.'],
      [8.67, 'NOBODY CAN *SLEEP.'], [10.33, "THE DOOR'S *LOCKED."], [11.33, '*CHAIN ON.'],
      [12.33, "YOU'RE *SAFE."], [13.67, 'BUT *ACROSS THE'], [14.0, '*ESTATE,'], [14.67, 'IN A *LIT'],
      [15.0, '*WINDOW...'], [16.0, 'A MAN *RAISES'], [17.0, 'A KITCHEN !KNIFE...'], [17.67, 'AND !KILLS HIS'],
      [19.0, '!WIFE.'], [19.83, ''], [20.0, 'IN THE *LAST'], [20.33, '*SECOND,'], [21.0, 'HE LOOKS !STRAIGHT'],
      [21.67, 'AT *YOU.'], [22.83, ''], [23.0, '*YOUR MUG SLIPS.'], [24.0, 'IT !SMASHES ON'], [24.67, 'THE *FLOOR.'],
      [25.67, 'HE !KNOWS.'], [26.67, '*YOU *SAW EVERYTHING.'], [28.0, '*RULE ONE:'], [29.0, 'KILL THE *LIGHT.'],
      [30.0, "IF HE *CAN'T"], [30.33, '*SEE YOU,'], [31.0, "*YOU'RE JUST A"], [31.67, '*SHADOW.'],
      [32.33, '*MUM HITS THE'], [33.0, '*LAMP AND YANKS'], [33.67, 'THE *CURTAINS SHUT.'], [35.0, "BUT HE'S *ALREADY"],
      [35.67, '!COUNTED.'], [36.33, '*YOUR WINDOW.'], [37.33, '*YOUR FLOOR.'], [38.0, '*YOUR BLOCK.'],
      [39.33, '*DOWNSTAIRS,'], [40.0, 'THE MAIN *DOOR'], [41.0, '!BANGS.'], [41.67, '*FOOTSTEPS ON THE'],
      [42.33, '*STAIRS.'], [43.0, '!CLOSER.'], [45.0, 'A *KNOCK.'], [45.67, '*CALM.'], [46.67, '*POLITE.'],
      [47.33, 'LIKE A *NEIGHBOUR.'], [48.33, 'THEN THE !BLOWS.'], [49.33, 'THE *CHAIN STARTS'], [50.33, 'TO *SHAKE.'],
      [51.0, '*RULE TWO:'], [52.0, "*DON'T WAIT TO"], [52.67, '*SEE IF THE'], [53.0, '*DOOR HOLDS.'],
      [53.67, "IT !WON'T."], [54.67, '*MUM LOOKS AT'], [55.33, 'THE *DOOR.'], [56.0, 'AT *YOU.'],
      [56.67, 'AT THE *WINDOW.'], [57.67, 'SHE *PULLS THE'], [58.67, '*CURTAIN BACK...'], [59.0, 'AND *OPENS IT.'],
      [60.67, '*FREEZING WIND.'], [62.0, '*RIGHT UNDER THE'], [62.67, '*WINDOW,'], [63.33, 'A *LEDGE.'],
      [64.0, '*THIRTY CENTIMETRES OF'], [65.33, '*CONCRETE.'], [66.0, '!ELEVEN FLOORS OF'], [67.33, '!NOTHING BELOW.'],
      [68.33, 'SHE GRABS *YOUR'], [69.0, '*HAND...'], [69.33, 'AND *STEPS OUT.'], [71.0, 'BEHIND *YOU,'],
      [71.67, 'THE *DOOR COMES'], [72.33, 'OFF ITS !HINGES.'], [73.7, ''],
    ],

    /* ---- sound + picture cues (both sides read these) ---- */
    lightOff: 29.25,          // finger hits the switch
    lampOff: 32.75,
    curtainShut: [33.67, 34.5],
    mugDrop: 23.25, mugSmash: 24.0,
    stab: 17.67,
    mainBangs: [41.0, 41.35, 41.7],
    knocks: [45.05, 45.3, 45.55],
    blows: [48.4, 49.05, 49.7, 50.3, 50.95, 51.6, 52.25, 52.9, 53.55, 54.2],
    doorCrack: 53.67,
    windowOpen: 59.2,
    burst: 72.33,
    glitches: [21.0, 53.67, 77.0],
    clockFlip: 63.0,          // 3:00 -> 3:01
    timerStart: 26.6,
  };

  TL.chapters = [
    [0, 5.0, 'The question'], [5.0, 16.1, '3 AM'], [16.1, 28.03, 'Across the estate'], [28.03, 39.33, 'Rule one'],
    [39.33, 51.0, 'Closer'], [51.0, 62.0, 'Rule two'], [62.0, 71.0, 'The ledge'], [71.0, 78.7, 'Behind you'],
  ];

  // footsteps on the stairs
  TL.stairSteps = [];
  for (let t = 41.75; t < 44.9; t += 0.33) TL.stairSteps.push(+t.toFixed(3));

  // seconds left on the countdown (shown top-right)
  TL.timeLeft = function (t) {
    const k = [[26.6, 60], [74, 9], [75, 2], [76.2, 0]];
    if (t < k[0][0]) return 60;
    for (let i = 1; i < k.length; i++) if (t < k[i][0]) return U.lerp(k[i - 1][1], k[i][1], (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]));
    return 0;
  };
  // countdown ticks (one per displayed second)
  TL.ticks = [];
  { let last = 61; for (let t = TL.timerStart; t < TL.DURATION; t += 1 / 30) { const s = Math.ceil(TL.timeLeft(t) - 1e-6); if (s < last) { TL.ticks.push(+t.toFixed(3)); last = s; } } }

  TL.shotAt = function (t) {
    for (const s of TL.shots) if (t >= s[0] && t < s[1]) return s;
    return TL.shots[TL.shots.length - 1];
  };
  TL.captionAt = function (t) {
    let c = null;
    for (const k of TL.captions) { if (k[0] <= t) c = k; else break; }
    return c && c[1] ? c : null;
  };
  // the "hit" words (red) get an impact sound
  TL.hits = TL.captions.filter((c) => c[1].includes('!')).map((c) => c[0]);

  g.U = U; g.TL = TL;
  if (typeof module !== 'undefined') module.exports = { U, TL };
})(typeof window !== 'undefined' ? window : globalThis);
