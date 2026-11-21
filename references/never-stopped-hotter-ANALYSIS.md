# Reference 2: "What if it never stopped getting hotter?" — frame-by-frame breakdown

Source: `v14044g50000db3sn5fog65un8r489gg.mp4` (uploaded 2026-11-21, a TikTok download).
Method: frames at 2 fps over the whole video, full-resolution stills of every stage, crops of the HUD,
captions and end cards, ffmpeg scene detection, an EBU R128 loudness measurement and a spectrogram of the soundtrack.

## 1. Technical specs

| | |
|---|---|
| Format | 576×1024 (9:16), 30 fps, H.264, 2,580 frames. Recreate at 1080×1920 (×1.875) |
| Length | 86.0 s, of which 0–70.4 s is the simulation, 70.4–81.8 s the black end cards and 82–86 s TikTok's own outro |
| Cuts | **Only one.** The simulation is a single locked-off shot; the only hard cut is to black at 70.4 s |
| Audio | AAC stereo 44.1 kHz. Integrated -16.1 LUFS, LRA 5.8 LU, peak 0.0 dBFS |
| Voice | **None.** No narrator: the story is told entirely by on-screen text over sound design |
| Added by TikTok (do **not** copy) | the bouncing TikTok logo and `@handle` watermark, and the 82–86 s TikTok outro with the search bar |

## 2. The scene: one street, one camera

- **Camera.** Locked off at about eye height, looking straight down the middle of a suburban street towards a vanishing point
  at roughly (50 %, 33 %) of the frame. It doesn't pan or push; all the motion comes from the world changing. Late in the video (from about 40 s) the
  image gets heavy bloom, depth-of-field blur on the foreground and heat-shimmer distortion, so it *feels* closer.
- **Look.** Real-time 3D, **low-poly and flat-shaded** (every face is one colour, lit by a warm sun from the upper left), with
  soft shadows on the road and a hazy blue-grey sky that is darker at the top.
- **Foreground (bottom 40 %).** Wide grey asphalt with lighter worn patches, a dark **manhole cover** right of centre (≈ 76 %, 67 %),
  thin black **cracks**, and a rectangular patch repair left of centre.
- **Midground.**
  - Left: a blue clapboard house with white windows, a black **mailbox** on a post at the kerb, a sidewalk and green lawn strips.
  - Right: a red-brick house, a grey **streetlamp** arching over the road (top right), and a **red hatchback** parked at the right kerb (≈ 68 %, 53 %).
  - Further back: more houses (white, red, grey), a red garage at the far end.
- **The trees** (the main character of the video):
  - Two rows of deciduous street trees line both sides.
  - **Crowns** are clusters of 3–6 faceted polyhedra (icosahedron-like blobs) per tree. Each facet is lit differently, so a crown reads as light,
    mid and dark green triangles.
  - **Trunks** are thin, dark grey-brown and forked into 2–3 bare branches that reach into the crown.
  - The near-right tree is huge and cropped by the frame edge (top-right corner); the near-left tree is cropped at the left edge.
  - Behind the town, a **forest of small conical / low-poly pines** covers rolling hills right to the horizon.
- **Colour of the trees over time.** This is the clock you can read without the HUD:

  | time | temperature | crowns | lawns / far forest |
  |---|---|---|---|
  | 0–14 s | 85 → 200 °F | vivid green `#3f8f2f` / `#5cae3a` / `#2c6b22` | green |
  | 15–17 s | 211 °F | yellow-green `#a3a64c` | lawns go straw `#c9b77a` |
  | 18–21 s | 213–395 °F | olive / khaki `#9c9358` | the far forest goes khaki |
  | 22–26 s | 445–457 °F | brown `#6e5a3c` | brown |
  | 26–29 s | 468–556 °F | charcoal `#3a2f28` with smoke columns rising | dark |
  | 30–33 s | 567–577 °F | the crowns **ignite** one by one; flames are bright yellow-white low-poly cones | — |
  | 34–41 s | 651–1,268 °F | crowns turn into **ember shells**: black with glowing orange lava-crack veins, then burn away to bare red-hot branches | — |

## 3. The HUD (top left)

| element | at 576 px | at 1080 px | style |
|---|---|---|---|
| `TEMPERATURE` | x 39, y 118, about 11 px | x 73, y 221, about 21 px | uppercase, letter-spacing ≈ 0.18 em, light grey (≈ 80 % white) |
| the value, e.g. `134.2 °F` | y 168 (centre), about 38 px | y 315, about 72 px | **monospaced** digits (JetBrains Mono / IBM Plex Mono-like), white, faint shadow. One decimal below 1,000, then whole numbers with commas (`1,083 °F`), then scientific notation with a superscript exponent (`1.0×10¹⁴ °F`) |
| the Celsius value, e.g. `56.7 °C` | y 207, about 9 px | y 388, about 17 px | monospaced, grey, small |

There's no panel or box behind the HUD; it floats over the sky.

## 4. Text on screen

**Typography.** A bold geometric grotesk (Inter Bold / SF Pro Display Bold-like), white, centred. Behind each caption there's a **soft dark blurred
halo** (a dark ellipse at about 35 % opacity), not a stroke and not a box. **Numbers inside captions switch to the monospaced font**
(`134°F`, `1913`, `10,000°F`), which is a nice detail.

**Three kinds of caption:**
1. **Title** (0–3.5 s): "What if it never / stopped getting hotter?" Two lines, about 70 px on 1080, centred at about 33 % of the height, fades out 3.3–3.8 s.
2. **Event lines**: a short present-tense sentence, one line, about 47 px, centred at about 65 % of the height. No tag.
3. **FACT lines**: an orange pill above the text (`#f2a93b`, about 98×38 px on 1080, dark brown `FACT` in letter-spaced caps), then 2–3 centred lines about 47 px, the block centred at about 64 %.

Captions fade in over about 0.25 s and out over about 0.3 s. Nothing pops or animates beyond the fade.

**The rhythm.** An event line (about 2.3 s on screen), a gap of 0.6 s, a FACT line (about 3.8 s), a gap of 0.6 s, and repeat. Each event + fact cycle takes about 7.4 s.

| on screen | type | text | the counter meanwhile |
|---|---|---|---|
| 0.0–3.5 | title | What if it never stopped getting hotter? | 85.2 → 96.5 °F |
| 4.4–6.3 | event | It's getting hotter. | 102 → 116 °F |
| 6.9–10.6 | FACT | Officially the hottest air ever recorded: 134°F. Death Valley, 1913. | **hovers 132 → 135.6** |
| 11.4–13.8 | event | The asphalt goes soft. | 139 → 192 °F |
| 14.4–18.2 | FACT | Water boils at 212°F (100°C) at sea level. | **hovers 206 → 213** |
| 18.5–20.7 | event | The tires start to sag. | 216 → 356 °F |
| 22.4–26.2 | FACT | Paper can catch fire on its own at about 450°F. | **hovers 446 → 457** |
| 26.5–28.7 | event | The leaves start to smoke. | 468 → 556 °F |
| 29.3–33.2 | FACT | Wood can catch fire on its own at roughly 570°F. | **hovers 565 → 577** |
| 33.9–36.3 | event | The metal starts to droop. | 651 → 1,168 °F |
| 36.9–40.6 | FACT | Aluminum melts at 1,221°F (660°C). | **hovers 1,205 → 1,238** |
| 41.4–43.1 | event | The windows sag. | 1,337 → 1,816 °F |
| 44.4–48.3 | FACT | Lava erupts at roughly 1,500 to 2,200°F. | **hovers 1,971 → 2,139** |
| 48.9–51.2 | event | The street turns to lava. | 2,296 → 2,722 °F |
| 51.9–55.6 | FACT | Iron melts at 2,800°F (1,538°C). | **hovers 2,779 → 2,855** |
| 56.0–58.3 | event | The air itself starts to glow. | 3,031 → 7,204 °F |
| 58.8–62.9 | FACT | The Sun's surface: about 10,000°F. Lightning: about 50,000°F. | 9,843 → 37,500 °F |
| 64.3–66.2 | line (no tag) | Hotter than the core of the Sun: about 27 million °F. | 2.5×10⁸ → 9.3×10¹² °F |
| 66.5–70.3 | FACT | The hottest ever made by people: over 5 trillion °C, at CERN in 2012. | 9.4×10¹² → 1.4×10³² °F |
| 70.4 | **hard cut to black** | | |
| 71.0–73.3 | end | Wait. | — |
| 73.9–76.8 | teaser | (small grey `PART 1`) What if it never stopped getting colder? | — |
| 77.5–81.8 | end | What if it never stopped getting hotter? + small mono grey: `PLANCK TEMPERATURE · ABOUT 1.4 × 10³² K · WHERE KNOWN PHYSICS STOPS WORKING` | — |

**The counter's secret.** It isn't a smooth exponential. It **eases into each fact's number and crawls while that fact is on screen**
(132 → 135.6 °F over 3.7 s around "134°F"), then **accelerates hard** during the next event line. So the number on screen always
agrees with the fact you're reading. After the Sun stage it stops crawling and explodes through scientific notation.

## 5. The stages: what changes in the picture

| time | stage | what you see |
|---|---|---|
| 0–11 | summer day | vivid green; a faint heat shimmer above the road grows slowly |
| 11–14 | asphalt soft | the road surface ripples: dark wavy creases spread across the asphalt and the cracks widen |
| 14–18 | boiling | white **steam puffs** from the drain by the car and from the left kerb; lawns turn straw-yellow; crowns yellow-green |
| 18–21 | tyres sag | the red car sinks a little on deflating tyres; crowns olive; the background forest goes khaki |
| 21–26 | paper ignites | the **mailbox bursts into flame** (24.5 s), a small torch on its post; crowns brown; the first thin smoke |
| 26–29 | leaves smoke | grey-black **smoke columns** rise from the crowns into the sky, which darkens to brown-grey; crowns go charcoal; embers drift |
| 29–33 | wood ignites | crowns catch one by one (far ones first), yellow-white flame cones; the car glows red underneath |
| 33–36 | metal droops | **the streetlamp bends over**; crowns become black ember shells with orange cracks; the houses catch |
| 36–41 | aluminium melts | the car slumps and melts into a glowing puddle; the ground goes red-orange; the image blooms and the foreground blurs |
| 41–44 | windows sag | the houses' window frames droop; everything is fire; orange haze |
| 44–48 | lava heat | the ground glows orange everywhere; the houses are burning frames |
| 48–52 | street to lava | the road **liquefies**: a bright orange flowing surface with dark cooling crust plates that drift towards the camera |
| 52–56 | iron melts | the lamp-post folds and melts (yellow-hot); thick black smoke above; everything is molten |
| 56–59 | the air glows | the whole frame **washes out** to pale orange, then cream; the scene dissolves into light |
| 59–63 | the Sun's surface | the image becomes **solar granulation**: orange-red convection cells with dark lanes, slowly churning and brightening |
| 63–66 | the core | the cells fade to cream and then white |
| 66–70.4 | beyond | pure warm white; only the HUD and caption remain |
| 70.4 | the cut | **instant black** |

## 6. Sound (from the spectrogram)

- **0–15 s, summer.** Cicada choruses (bright blobs at 3–5 kHz at 0–6 s and 9–14 s), a low ~300 Hz hum, and a steady ~800 Hz tone from 9.5–17 s (a heat or boiling whine).
- **15.3 s.** The insects stop dead (the high band empties), which signals that it's now too hot to live.
- **17–66 s.** A broadband **fire roar** that builds continuously, with crackle transients and a low rumble; denser and louder through the lava stages.
- **66.5 s.** At the white-out the roar drops to near silence with a soft low hum.
- **70–75 s.** Over black and "Wait.", a thin **6 kHz ringing tone**, like tinnitus after a blast.
- **77–82 s.** A soft low drone under the final card.
- There's no music with a beat and no voice.

## 7. Rebuild notes

- **Engine.** Real 3D is what gives the faceted trees, sun shadows and depth. Plan: three.js (vendored from npm, no CDN) on a canvas,
  rendered frame by frame by `render.js` as a pure function of `t` (seeded noise only). Flat-shaded `MeshStandardMaterial`s, one directional sun
  with soft shadows, bloom + heat-shimmer + depth-of-field as post-processing, instanced low-poly pines for the forest.
- **Fire and smoke** as seeded billboard particles; **lava** and **granulation** as shader planes; the **counter** as a keyed curve
  that eases into each fact value.
- **Captions and HUD** drawn as a 2D overlay (Inter + JetBrains Mono from Google Fonts) at the measured sizes and positions above.
- **No TikTok branding**, and an original street, houses and car, not a copy of this video's scene.
