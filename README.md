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

---

# Room 9 (second film)

A second 78-second vertical story in the same format, set somewhere new: a **roadside motel at 2:47 AM**, with a cornfield behind it.
Open **`motel.html`**, or render it with `node render.js --page motel.html`, which writes `out/room-9.mp4` and `out/room-9.srt`.

**Story:** you and your big sister are stuck at a roadside motel after the car broke down. Across the parking lot, a man in a white mask walks into the office, and the night clerk never walks out.
He hears you. Rule one: go dark. He checks the doors: Room 12, 11, 10… then yours, and he has the key from the office.
Rule two: never stay where he expects you. Out through the tiny bathroom window, into the corn. Something in the corn is running too.

**Cast:** the big sister (green hoodie, curly ponytail), you (the kid in the yellow star tee), the night clerk, and **the Masked Man**.
He is an original slasher, not a copy of an existing film character: a dark hood, a cracked porcelain mask with slit eyes, grey work overalls and gloves.

Same narrator voice as One Minute, plus 11 new ElevenLabs sound effects: neon/crickets ambience, TV static, the struggle in the office, the remote cracking, TV and lamp off, door handles, the office key, the bathroom window, running through corn, the door kicked open, and the final crash.
The shots are timed to the narration's natural pacing.

```
motel.html                      the player page for Room 9
films/motel/core.js             timeline: shots, cues, captions cut from the narration timings
films/motel/sentences.js        sentence timings + caption markup (generated from the narration)
films/motel/characters.js       sister, kid, clerk, the Masked Man (mask close-up + full body)
films/motel/scenes.js           the 28 shots, HUD, captions, glitch, grain
films/motel/audio.js            synthesised score (shares the engine of js/audio.js)
films/motel/mix.py              narration + SFX mix -> films/motel/audio/voice_sfx.*
films/motel/audio/              narration take, aligned narration, sound effects
```

Rebuild the audio after edits:

```bash
python3 tools/align_narration.py films/motel/audio/raw/narr_a.mp3 films/motel/audio/narration.json films/motel/audio/narration.wav
python3 films/motel/mix.py
node render.js --page motel.html
```

---

# Bookmarked (third film)

A 71-second vertical "what if" short, recreating the **format** of a reference short shot by shot: a colour-coded VS card, a clue object,
a corkboard and a map, the meeting, a red-eyed shadow, a lean-in whisper, the TEAM UP turn, a trap with a CASE CLOSED stamp, a clueless
police department, a calendar epilogue and a comment-bait poll. Captions show **one word at a time**, timed to the narrator's words.
The frame-by-frame breakdown of the reference is in [`films/bookmarked/REFERENCE-ANALYSIS.md`](films/bookmarked/REFERENCE-ANALYSIS.md).

Open **`bookmarked.html`**, or render it with `node render.js --page bookmarked.html` (writes `out/bookmarked.mp4` and `out/bookmarked.srt`).

**Story:** *What if a man who hunts killers met a man who watches everyone?* A killer in the harbour town of Port Halden leaves a bookmark at
every scene. Crime-lab analyst **Silas Crane** follows them to a little bookstore, Wren & Page, where **Ezra Wren** closes his book and smiles:
"I know what you do at night, Silas." Ezra has a box of receipts: the killer buys a book every Friday. Silas reads the blood, Ezra reads the people,
and one book on one shelf is the trap. They still meet every Friday.

**Cast:** both leads are original characters, written to have the energy of the requested pairing (a vigilante forensic analyst and an obsessive
bookseller). They are not the TV characters. Silas has black side-parted hair, heavy-lidded deadpan eyes and a slate crime-lab jacket with a clipped ID badge,
and his side of the split is crimson. Ezra has fluffy chestnut curls, round glasses and a mustard cardigan, and his side is green. There is also a grey-moustached detective.

**Narrator:** ElevenLabs "Mark Vale – Deep Storyteller" (deep, cinematic American true-crime voice), model `eleven_v4`, with a `[whispering]`
tag on Ezra's "Relax. I just watch people." The take was read slowly (88 s), so `prep_narration.py` shortens the pauses and plays it 1.12× faster (same pitch).
It then maps the per-word times from the ElevenLabs transcript through that edit. Every cut, pop and caption is placed on those word times.

**Sound:** a quiet D-minor pizzicato + pad + music-box bed (ducked under the voice, like the reference's soft bed) and small synthesised
effects on the cues: VS pop, pin drops, shop bell, book thump, the shadow's riser and sting, sign flip, case latch, receipts, TEAM UP chime,
blood splats, the grab, the CASE CLOSED slam, calendar flips and the end-card chime.

```
bookmarked.html                    the player page
films/bookmarked/REFERENCE-ANALYSIS.md   frame-by-frame breakdown of the reference video
films/bookmarked/prep_narration.py tightens the take, maps word times -> words.js, voice.mp3, voice-data.js
films/bookmarked/words.js          generated: every word and sentence on the film timeline
films/bookmarked/core.js           timeline: shots and cues looked up by word, one-word captions, lip flaps
films/bookmarked/characters.js     Silas, Ezra, the detective + props (bookmark, shelves, receipts, case, pins, calendar, stamp…)
films/bookmarked/scenes.js         the 21 shots, captions, end fade
films/bookmarked/audio.js          synthesised score + sound effects
films/bookmarked/audio/raw/        the ElevenLabs take and its word-timed transcript
```

Rebuild after changing the take or the tempo:

```bash
python3 films/bookmarked/prep_narration.py 1.12   # tempo
node render.js --page bookmarked.html
```

---

# Darker (fourth film)

*What if it never stopped getting darker?* An 80-second vertical escalation short in the style of the
"never stopped getting hotter" reference (breakdown: [`references/never-stopped-hotter-ANALYSIS.md`](references/never-stopped-hotter-ANALYSIS.md)):
one locked-off camera on a low-poly street, a counter in the top-left corner, and an event line followed by a **FACT** at every stage, with a deep horror narrator added.

Open **`darker.html`**, or render it with `node render.js --page darker.html` (writes `out/darker.mp4` and `out/darker.srt`).

**The story.** A sunny afternoon on a dead-end street at the edge of a pine forest. The **LIGHT** counter falls from 100,000 lux to 0:
- overcast (1,000 lux), then the streetlights flicker on, then dusk ends (3.4 lux);
- the colours drain away (rod vision), then only the moon is left (0.25 lux), then the streetlights go out one by one;
- *something moves between the trees*, and eyes start to shine in the dark;
- the moon goes, then starlight (0.002 lux), then the stars go, then a cloudy night with no moon (0.0001 lux);
- you can't see your own hand, the brain invents shapes (phosphenes), *but some of them are real*;
- a cat can see in light about six times dimmer than you can. *And it can see you.* Cut to black. "Wait." Then a PART 2 teaser.

**How it's made.**
- **The street is real 3D** (three.js r170, vendored in `vendor/three.r170.js`, MIT), rendered headless frame by frame:
  - flat-shaded faceted trees (jittered icosahedron crowns on forked trunks), about 600 instanced pines;
  - clapboard houses whose windows light up and go dark, four streetlamps with spotlight pools, a parked station wagon, a striped dead-end barricade and a DEAD END sign;
  - a sky shader, stars, the moon, and clouds that cover it;
  - a long, low, four-legged silhouette that slinks across the road.
- **The picture is graded in 2D on top.** The colour drains with `saturate()`, the exposure falls, lamp and moon glows are added, and the eyeshine is drawn at the projected 3D positions. The phosphenes, sensor grain, the slit-pupil close-up, the HUD (Inter + JetBrains Mono) and the reference-style captions come last: a soft dark halo behind the text, an orange FACT pill, and numbers in the mono font.
- **The counter** is keyed in log space: it crawls while each fact is on screen, so the number agrees with what you read, and falls fast during the event lines.
- **The narrator** is ElevenLabs "Jack – Deep Dark Horror Narrator" (`eleven_v4`), with the last two lines whispered, at its natural pace.
  Every caption, light, window and pair of eyes is timed from the word timings of the ElevenLabs transcript.
- **The sound.** A synthesised bed: afternoon birds and wind, the lamps' mains hum, a drone that grows as the colour drains, a pulse for each pair of eyes, a heartbeat in the dark, glassy phosphene shimmer, a sting, and a ringing after the cut. Recorded ElevenLabs effects are mixed on top: crickets that stop dead when something moves, the streetlights dying one by one, and a heavy breath at the close-up.

```
darker.html                       the player page
films/darker/prep_narration.py    places the take on the timeline (moves the whispered "Wait." after the cut)
films/darker/words.js             generated: word and sentence timings
films/darker/core.js              timeline: captions, the lux counter, light/sky/exposure tracks, lamps, windows, eyes
films/darker/world.js             the 3D street
films/darker/film.js              compositor: grade, glows, eyes, phosphenes, HUD, captions, end cards
films/darker/audio.js             synthesised soundtrack
films/darker/mix.py               narration + recorded effects -> audio/voice_sfx.*, voice-data.js
films/darker/audio/raw/, sfx/     the ElevenLabs takes, transcript and effects
```

Rebuild the audio: `python3 films/darker/prep_narration.py && python3 films/darker/mix.py`, then `node render.js --page darker.html`.

---

# Quieter (fifth film, Part 2 of the series)

*What if it never stopped getting quieter?* The sequel teased at the end of Darker. It's the same street, the same narrator and the same reference format,
but here **sound** is the story. Open **`quieter.html`**, or render it with `node render.js --page quieter.html` (writes `out/quieter.mp4` and `out/quieter.srt`).

**The story.**
- A golden-hour afternoon full of sound. The **SOUND** counter falls from 74 dB as each sound stops on its line:
  - the traffic fades (cars stop crossing behind the dead end);
  - the birds stop singing (the crows on the wire fly off);
  - the wind goes still (trees, a flag and the falling leaves **freeze in mid-air**);
  - you hear your own breath (the view rises and falls), then hold it.
- At 0 dB you still hear something: the phantom ringing that 94% of people heard in a soundproof room in Heller & Bergman's 1953 study.
- Then your heartbeat and your blood (the frame thumps). The quietest room ever measured is about −20 dB (Microsoft, Guinness 2015).
- At about −23 dB the only sound left is air molecules (the dust motes glitter), then **−∞ dB**: total silence, digital zero.
- Then the counter jumps back to 10 dB, because *something else is breathing*. Its long shadow creeps up the road from behind the camera: *right behind you.*
- Cut to black. "Wait." Then a PART 3 teaser: *What if it never stopped getting closer?*

**How it's made.**
- `films/quieter/world.js` is Part 1's three.js street re-lit at golden hour, with the sun low **behind the camera**. It adds a cross street with traffic, a phone wire with crows, a waving flag and instanced leaves (all frozen by one "wind time" clock), and the creature from Part 1, kept behind the camera so that only its shadow enters the frame.
- `film.js` adds a SOUND HUD: dB, sound pressure in µPa, and a live trace that flattens into a line. It also draws dust motes that freeze in the silence and blow away from the breath, the heartbeat pulse, the ringing shimmer, and the same caption style.
- The sound is mostly recorded ElevenLabs effects (afternoon street, car passes, birdsong, wind, your breath, and the creature's breath from Part 1). Each one stops on the frame its source stops. The synthesised layer is your body (heartbeat, blood, the 7.8 kHz phantom ring, the molecule hiss). Between "Total silence" and the breath, nothing plays but the narrator.

Rebuild the audio: `python3 films/quieter/prep_narration.py && python3 films/quieter/mix.py`, then `node render.js --page quieter.html`.

---

# POV: You wake up as a Kid in December of 1999 (sixth film)

A recreation of a photoreal "POV nostalgia" short: six first-person shots, each with a hard cut, of a kid's December day in 1999. The shots are breakfast cereal at the kitchen table, pushing through the doors of a giant toy store, the minivan ride home with bags of presents, holding up a VHS box in a video rental store, pizza with mom and dad, and popcorn in front of the Christmas tree. A red slab-serif title sits over the first three seconds, and the film ends on a slow sink to black.

The shots are **real AI video clips** generated with the user's vidIQ connector (MiniMax H3, 768p, 9:16, 4.5 s each; 140 credits including one retake). They are kept in `films/pov1999/clips/`.
Every prompt is original and unbranded: no real store logos, cereal mascots or film footage. Where the model drifted towards something recognisable, the shot was fixed:
- the toy-store ceiling banner is softened in every frame through a feathered mask (`"blur"` in `plan.json`), so it reads as out-of-focus signage;
- the video-store shot was re-generated with faceless, snowy VHS covers.

Output: `out/pov-1999.mp4` (1080×1920, 24 fps, 29.6 s, about −16.5 LUFS). The clips' own audio is replaced by the original music cue.
To match the reference's lingering pacing, each clip is gently slowed with motion interpolation (`speed` in `plan.json`). The opening breakfast shot is held longest (0.78×, 5.6 s) and the rest run at 0.92×. Each clip is cut to a whole number of frames, so the fade and the music end on the last frame.

```
films/pov1999/plan.json     the six shot prompts, model and lengths
films/pov1999/title.html    the title (Roboto Slab 800, red with a white outline) -> title.png
films/pov1999/music.py      an original warm piano + music-box + sleigh-bell cue (no existing song) -> music.wav
films/pov1999/assemble.py   scales and cuts the clips, title, warm grade, fade, music -> out/pov-1999.mp4
```

Re-assemble: `python3 films/pov1999/assemble.py films/pov1999/clips/{1_breakfast,2_toystore,3_minivan,4_videostore,5_pizza,6_movienight}.mp4`.

---

# What if another galaxy hit us? (seventh film)

Same format as Darker and Quieter: the same deep narrator, caption and FACT style and end cards, on a three.js street under an animated sky. Open **`galaxy.html`**, or render it with `node render.js --page galaxy.html` (writes `out/galaxy.mp4` and `out/galaxy.srt`).

**The story.**
- Tonight: Andromeda is a faint smudge above a quiet street. The **DISTANCE TO ANDROMEDA** counter starts at 2,500,000 ly, and a second line reads NOW.
- The years run forward in billions. The street empties; the trees wither and fall; dunes swallow the road, the car and the lamps; the houses crumble. Meanwhile Andromeda swells across the sky.
- The Large Magellanic Cloud crashes in first. Then the Milky Way tears into tidal tails, newborn stars light the sky, and the two galactic "hearts" spiral together. A flash, and the merged galaxy, **Milkomeda**, glows over the ruins.
- *Or maybe not.* The tape rewinds (◀◀) back to tonight: 2025 simulations put the crash at only about a coin flip within 10 billion years.
- Back on the street, something is standing in the road, looking up. *Something else already is.* Cut to black. "Wait." Then a PART 2 teaser.

**How it's made.**
- `core.js` runs a *story time* `TL.st(t)`. It moves forward with the narration, rewinds on "Or maybe not." and then holds on tonight. Every stage (street ageing, collision, merge) and the counter are functions of it, so the rewind plays everything backwards for free.
- `world.js` is Darker's street with a transparent background, dunes that rise through the road, a dust coat over every material, and crumbling houses, falling trees and lamps, and a sinking car. The creature returns at the end.
- `film.js` paints the sky behind the 3D scene, including a procedural Andromeda (log-spiral arms, core and dust lanes) that grows with the distance. It also adds the VHS rewind, the HUD and the captions.
- Sound:
  - recorded ElevenLabs effects: crickets (two shuffled layers, so the short takes never audibly loop), desert wind, a cosmic rumble, the LMC and merge blasts, a tape rewind and the creature's breath;
  - a synthesised cosmic drone, a starburst shimmer, two pulses for the galactic cores that fuse at the merge, and a Milkomeda chord;
  - everything in the future is cut dead on the rewind frame, and the effects are ducked about 5 dB under the narrator.

Rebuild the audio: `python3 films/galaxy/prep_narration.py && python3 films/galaxy/mix.py`, then `node render.js --page galaxy.html`.

---

# What if a black hole passed through? (eighth film, Part 2 of the galaxy series)

The sequel teased at the end of *What if another galaxy hit us?*, made in the same format: the same narrator, caption and FACT style, and end cards. Open **`blackhole.html`**, or render it with `node render.js --page blackhole.html` (writes `out/black-hole.mp4` and `out/black-hole.srt`).

**The story.**
- A moonlit night on the street, crickets, 15°C. In 2022 Hubble found the first black hole drifting alone, about 5,000 light-years away, and there could be 100 million more.
- One heads our way, and you can't see it. Only the stars bend: a patch of sky smears into arcs and an Einstein ring around nothing. A targeting box tracks it, and the status line counts it down from light-years to AU.
- Its gravity tears the Moon away. The Moon stretches and splits into lensed images. Then it throws Earth out of orbit: the whole sky swings in star trails and the frame shakes.
- A dawn starts and fails. The Sun is just a bright star. The **AVERAGE TEMPERATURE** counter falls past −18°C in a week and −73°C in a year. The lights flicker and die, and frost creeps over everything.
- The air freezes and falls as snow (nitrogen freezes at −210°C), and drifts bury the road. Earth is a rogue planet. With no air left, the stars stop twinkling and the Milky Way blazes, and the soundtrack goes completely silent.
- In that silence something walks down the frozen road and stops under the Sun-star. Its eyes catch the light: *Nothing human.* Cut to black. "Wait." Then a PART 3 teaser.

**How it's made.**
- `film.js` draws the sky on an offscreen layer: a starfield stored in polar coordinates around a point far below the frame, so it can swing, plus two Milky Way bands and the Moon. Each frame, the region around the black hole is remapped pixel by pixel through the point-lens equation β = θ − θE²/θ, with magnification brightening the Einstein ring. That makes the lensing real image distortion, not a sprite.
- `world.js` is the series' street. Frost lerps every cached material toward ice, snowdrifts rise through the road, the lamps flicker out one by one, the camera shakes on the throw, and the creature (with eyeshine) walks in at the end.
- Sound:
  - recorded ElevenLabs effects: crickets, the approach rumble, blasts for the Moon and the throw, a freezing wind that dies as the air freezes, relays clicking off, and ice groaning;
  - a synthesised drone, two low tones beating faster as the lens grows, a swell into the Moon, a sub drop, the mains hum winding down, a glassy freeze shimmer, and one sub pulse on "Nothing human.";
  - from "No air." on, nothing plays but the narrator.

Rebuild the audio: `python3 films/blackhole/prep_narration.py && python3 films/blackhole/mix.py`, then `node render.js --page blackhole.html`.

---

# What if Earth stopped spinning? (ninth film, Part 3 of the galaxy series)

The sequel teased at the end of *What if a black hole passed through?*, with the same narrator, caption and FACT style, and end cards. Open **`spin.html`**, or render it with `node render.js --page spin.html` (writes `out/stopped-spinning.mp4` and `out/stopped-spinning.srt`).

**The story.**
- A sunny afternoon on the street. The **EARTH'S SPIN AT THE EQUATOR** counter reads 1,670 km/h, and the line under it reads 1 DAY = 24 HOURS.
- *Now imagine it slowing down.* A ▶▶ TIME-LAPSE runs: the Sun races across the sky, shadows sweep the street, and lamps and windows come on each dusk. The days visibly get longer, the counter winds down and the day length climbs. The fact cards say days lengthen by about 1.8 ms per century, and that a day lasted about 18 hours 1.4 billion years ago.
- *Then it stops.* The Sun freezes at noon, the counter reads 0 km/h, and 1 DAY = 1 YEAR.
- The six-month day: SUNSET IN 182 DAYS counts down while the street bakes. The grass browns, everything bleaches, and heat haze shimmers. The fact card: without the spin, the oceans would drain toward the poles (Esri's Fraczek model).
- A long sunset into a six-month night. Frost creeps in, and two streetlamps can't hold a steady light. Something walks down the road under the lamps, and its eyes catch the light: *And something has been waiting for it.* Cut to black. "Wait." Then a PART 4 teaser.

**How it's made.**
- `core.js` drives everything from a day clock `TL.phi(t)`. During the time-lapse, its rate is a decaying curve, integrated and scaled so the Sun stops exactly at noon on the word "stops". It then holds for the long day and sets into the night. The Sun's position, the daylight, twilight, lamps, windows and the counter all read from it.
- `world.js` is the series' street with the key light following the Sun across the sky, so the shadows sweep. It adds the bleach of the long day, the rime of the long night, and the creature.
- `film.js` paints the sky (day blue, orange dusk, stars), the Sun's disc and glare (streaking in the time-lapse), the heat haze, the badge and HUD, and the captions.
- Sound:
  - a spin hum whose pitch follows the counter, winding down like a record slowing to a stop, with a clock tick every quarter-day and a whoosh at each sunrise and sunset;
  - a thud when the spin stops, cicadas and hot wind for the long day, a falling chord for the sunset, and a cold drone for the night;
  - crickets that stop dead when the creature walks out of the dark, then its breath.

Rebuild the audio: `python3 films/spin/prep_narration.py && python3 films/spin/mix.py`, then `node render.js --page spin.html`.
