# One Minute

A 79-second vertical (9:16) animated horror story made with **HTML canvas, CSS and JavaScript**, recreating the shot list, captions and timing of a reference short-form video.
Every frame is drawn in code. The music score is synthesised with the Web Audio API, and the narrator and the recorded sound effects come from ElevenLabs.

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
node render.js --voice other.wav     # use a different narration/SFX track instead of audio/voice_sfx.wav
node render.js --from 45 --to 57 --out out/clip.mp4
node render.js --stills 2,17.9,44.5,73.4
```

Requires Node 18+ and `ffmpeg` on your PATH.

### Narration and sound effects

The film is narrated by an ElevenLabs voice ("Jack – Deep Dark Horror Narrator", model `eleven_v4`). It also uses recorded sound effects from ElevenLabs Sound Effects, layered on the synthesised score:
knife, distant scream, mug smash, light switch, curtains, main-door bangs, stairwell footsteps, the polite knock, door pounding with the chain, wood cracking, freezing wind, the door coming off its hinges, glitches and the final sting.

| File | What it is |
|---|---|
| `audio/narration.json` | the script: every sentence with the time it must start (the caption times) |
| `audio/raw/narr_a.mp3` | the single narration take from ElevenLabs |
| `audio/narration.wav` | that take cut into sentences and placed on the timeline |
| `audio/sfx/` | the generated sound effects (`alt/` holds alternative takes) |
| `audio/voice_sfx.wav/.mp3` | narration + effects on the timeline, ready to mix |
| `js/voice-data.js` | when the narrator speaks, so the music ducks under the voice |

To rebuild after changing the script or swapping a take:

```bash
python3 tools/align_narration.py audio/raw/narr_a.mp3 audio/narration.json audio/narration.wav
python3 tools/mix_voice_sfx.py
ffmpeg -y -i audio/voice_sfx.wav -b:a 160k audio/voice_sfx.mp3
npm run render                      # mixes score + voice/SFX, loudness-normalised to -14 LUFS
```

`node render.js --no-voice` renders with the synthesised score only.
In the browser player the narration plays in sync either way. To include it when recording from the page, open the page through `npm run serve`; opening it from a `file://` URL leaves the narration out of the recording.

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
