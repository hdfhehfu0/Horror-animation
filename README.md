# One Minute

A 79-second vertical (9:16) animated horror story made entirely with **HTML canvas, CSS and JavaScript**, recreating the shot list, captions and timing of a reference short-form video.
There are no images, video clips or audio files: every frame is drawn in code and every sound is synthesised with the Web Audio API.

**Story:** *What do you do when a killer has seen you?* It's 3 AM. You and Mum are sitting by the window when, across the estate, a man kills his wife. He looks straight at you. You have one minute.
Rule one: kill the light. Rule two: don't wait to see if the door holds. Out of the window there is a ledge 30 cm wide, eleven floors up.

| Time | Section | Shots |
|---|---|---|
| 0:00 | The question | killer close-up, door, "1:00 minute" timer |
| 0:05 | 3 AM | the block, Mum and you by the window, the chain lock, looking across the estate |
| 0:16 | Across the estate | the murder in the lit window, "he looks straight at you", the mug smashes |
| 0:28 | Rule one | light switch, curtains, he counts the windows: your window, floor, block |
| 0:39 | Closer | Kestrel House entrance, stairs (floor 9), stairwell lights, floor 11, the knock |
| 0:51 | Rule two | the blows, the chain shakes, the door splits, Mum looks at the window |
| 1:02 | The ledge | freezing wind, the ledge, eleven floors of nothing, she steps out |
| 1:11 | Behind you | the door comes off its hinges, your hand on the wall, he looks down |

A UK flag and clock (3:00 → 3:01) sit top-left, and a **TIME LEFT** countdown starts at "You saw everything".
Bold word-by-word captions show key words in yellow and danger words in red. Each red word gets an impact sound.

## Watch it

Open `index.html` in Chrome, Edge or Firefox (or `npm run serve` and visit http://localhost:8080).
Press **Play with sound**. Space = play/pause, ←/→ = seek 2 s, F = fullscreen; the chapter buttons jump around the story.

## Export as a video

**In the browser:** click **● Record video with sound**. It plays once in real time and downloads `one-minute.mp4` (Chrome/Edge) or `.webm` (Firefox).
The panel also saves the soundtrack (`.wav`), the captions (`.srt`) and the current frame (`.png`).

**Frame-perfect MP4 (recommended):**

```bash
npm install && npx playwright install chromium
npm run render                       # -> out/one-minute.mp4 (1080x1920, 30 fps, H.264 + AAC) + out/one-minute.srt
node render.js --voice narration.mp3 # same, with your voiceover mixed in (music ducks under it)
node render.js --from 45 --to 57 --out out/clip.mp4
node render.js --stills 2,17.9,44.5,73.4
```

Requires Node 18+ and `ffmpeg` on your PATH.

### Narration

The reference is narrated. This project has no recorded voice. To add one, record or generate the narration so it follows the caption timings in `js/core.js` (`TL.captions`).
Then pass it with `--voice`. The soundtrack ducks under the voice automatically.

## How it's built

```
index.html         player + export panel
js/core.js         THE TIMELINE: shot list, captions, every sound/picture cue, countdown
js/audio.js        synthesised score + SFX rendered once from the timeline (OfflineAudioContext)
js/characters.js   flat-vector cast: the killer (face + body), Mum, the girl, the wife, POV hand, knife, flag
js/scenes.js       the 42 shots, camera moves + shake, HUD, captions, glitch, film grain
js/app.js          playback, scrubbing, recording, hooks for render.js
render.js          headless Chrome -> ffmpeg exporter
```

- **One timeline.** Shots, captions, the stab, the mug smash, the light switch, knocks, blows, the door crack and the burst are all defined once in `TL`. The picture and the audio both read them, so they can't drift apart.
- **Deterministic.** `Film.render(ctx, t)` is a pure function of time (seeded noise, no `Math.random`). Preview, recording and export all produce the same frames.
- **Editing.** To retime anything, change the numbers in `TL`. To change wording, edit `TL.captions` (`*word` = yellow, `!word` = red). Each shot is one function in `js/scenes.js`.
