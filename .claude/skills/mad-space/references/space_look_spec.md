# Approved space look: THE NIGHT WE FINALLY LOOKED UP V10 (the owner's approval, 2026-11-25)

The exact values below come from the approved code in `assets/approved_twfl_v10_tools/` (mainly sky_build.py, scene_build.py, camp_build.py, cold.py and winter.py). The reference frames are in `frames/`.

- Reuse the approved code and adapt its parameters to the new story. Do not rebuild from memory.
- Every number here is a starting point that has been proven on screen. Change one only with a reason, and check it on a still before rendering.

## 1. Render and colour pipeline
- **Engine:** Blender 5.2 EEVEE, 1080×1920 at 60 fps.
  - Samples: 16 TAA for the final render, 32 for proof stills.
  - Motion blur: shutter 0.5.
- **Colour:** AgX view transform with the look "AgX - Medium High Contrast".
- **Bloom:** compositor Glare set to Bloom: threshold 0.6, size 0.55, strength 0.35.
- **Delivery:** PNG frames, then cosmic-pov-shorts `deliver.py` (master, phone, preview and a share copy under 28 MiB). Sound at −16 LUFS.
- **Camera:** degrees per pixel ≈ 0.0643 (horizontal FOV over 1080). A POV lens of 26 mm with a 36 mm horizontal sensor gives a portrait frame about 102° tall. Compose every sky element against that height.

## 2. The sky dome (world shader, sky_build.build_world)
- **Base colour:** a deep midnight blue. Mix by `elevation^0.6`:
  - from (0.014, 0.021, 0.042) near the horizon
  - to (0.0030, 0.0050, 0.0140) at the zenith, a deep indigo-navy.
- **Horizon:** a faint green-blue lift of +(0.008, 0.013, 0.012) in the lowest 0.18 of the dome.
- **Airglow:** a faint green band, kept low (dz 0.02–0.26) and modulated by noise.
- **Upper sky:** it must stay navy. A strong red airglow once turned it mauve-grey; the owner rejected that.
- **Settlement glow and light pollution:** a warm dome (0.50, 0.29, 0.14) × dome^1.35 inside an azimuth window. It fades on the story beat; in the V5 countdown, zero lands on the first visible loss of skyglow.
- **Sky gating:** the stars and the band fade in through VIS_* values keyed on story beats: medium stars, faint stars, the Milky Way, then the named stars.

## 3. Stars: every dot counts
Stars are Voronoi point stars in 3D, using the `star_layer(scale, keep, gain, rad_px, seed, temp_bias, patch)` helper. Each layer is a separate population:

| Layer | Scale (cells) | Keep | Gain | Core radius (px) | Seed | Density |
|---|---|---|---|---|---|---|
| bright | 70 | 0.10 | 6.5 | 1.1 | 0 | uniform; dimmed by light pollution (× (1 − 0.75·LP)) |
| medium | 190 | 0.12 | 2.8 | 0.9 | 31 | patchy (`patch` mask), gated by VIS_MED |
| faint | 420 | 0.14 | 1.3 | 0.85 | 77 | patchy, VIS_FAINT |
| very faint | 640 | 0.12 | 0.9 | 0.8 | 151 | patchy, VIS_FAINT |
| in the Milky Way | 760 | 0.30 | 1.5 | 0.8 | 113 | only inside the band: the dense star cloud |

- **Brightness:** brightness = random^9 × gain. That gives many dim stars and very few bright ones, like a real sky.
- **Shape:** each star is a gaussian core of `rad_px` pixels, so stars are tiny, sharp points that never bloat.
- **Colour:**
  - Colour comes from the temperature ramp: (1.0, 0.45, 0.25) red-orange, (1.0, 0.62, 0.32), (1.0, 0.82, 0.55) gold, (1.0, 0.92, 0.80) white-warm, (0.70, 0.82, 1.0), (0.55, 0.68, 1.0), (0.45, 0.58, 1.0) blue.
  - Saturation rises only for the brightest few percent of each layer (a ramp from 0.80 to 0.97 on brightness), so the colour sits in selected stars and the rest stay near white.
- **Density varies:** a noise patch mask (scale 2.6), plus a boost inside the band, makes dark stretches between the bright features. That darkness is deliberate.
- **Named or hero stars** are `spot()` objects: a tight core of 0.15° plus a halo of 0.9°.
  - Icy blue-white: (0.66, 0.80, 1.0), core 16, halo 0.38.
  - Orange-gold: (1.0, 0.62, 0.26), core 13, halo 0.32.
  - Place them where the characters' gaze and gestures lead. Keep them distinct and stable.
- **The owner's taste:** a dense, visibly coloured sky, about twice what "realistic" would give. Orange, gold, white and blue stars. Never restrained.

## 4. The Milky Way, designed (mw_frame and the band in build_world)
- **Geometry:** a great circle through the points a = (az 28, el 0) and b = (86, 34), with the core at (52, 17). It runs diagonally across the frame.
  - Coordinates: ll runs along the band (0 at the gold cloud), bb runs across it.
  - The band fades at both ends.
- **Body:** clouds and clumps from two noise scales, plus fine filaments.
- **Gold cloud:** an ivory-gold star cloud, gauss(ll, 0.30) × gauss(bb, 0.10), with luminance boost ×4.2.
- **Dust lane:**
  - One lane runs through the gold cloud and forks just above it (f0 = 0.06, k = 0.21).
  - Lane width is 0.018 + 0.012·(ll − f0).
  - The edges are ragged and filamentary (noise scales 14 and 40). The fork must read on a phone.
- **Tone along the band:** gold (1.0, 0.70, 0.36), then (1.0, 0.78, 0.46), ivory (0.98, 0.90, 0.78), lavender (0.80, 0.70, 1.0), (0.52, 0.66, 1.0), and cool blue (0.45, 0.60, 1.0). Band luminance × 0.24, with extinction near the horizon (dz 0 to 0.16).
- **Rose emission:** dusty rose (0.95, 0.36, 0.50) × 0.95 on the upper side of the band near the gold cloud, breaking into wisps (two noise scales).
- **Far end:** a faint lavender and cool-blue haze where the band recedes.

## 5. Planets (sky_build.build_planets), stylised but physically lit
- **Shared light:** every planet shares one apparent light direction, toward a sun below the horizon (az 18, el −22). Each planet has its own phase angle.
  - Shading is emission, with Lambert ndl^0.85 times limb darkening ndv^k.
  - Globes use the DITHERED render method and rings use BLENDED, so the far half of the ring sorts behind the globe.
- **Turquoise crescent** (az 12, el 14.2, 2.4°, phase 150):
  - a thin lit edge, lit × 4.0 with a rim of 1.1;
  - a dark face of about sky colour (0.006, 0.011, 0.017);
  - a finger-width of dark sky between it and the ridge below.
- **Rust-copper planet** (az 82, el 25, 4°, phase 105):
  - Surface ramp: rust (0.30, 0.09, 0.05), then (0.55, 0.18, 0.08) and (0.66, 0.28, 0.11), up to ochre highlands (0.78, 0.52, 0.22) and (0.86, 0.62, 0.30).
  - A darker maria region (0.20, 0.07, 0.045).
  - A small frost polar cap on the lit limb, about 22°, colour (0.50, 0.46, 0.43). It must not be white: a white cap at ×2.1 gain clipped into a blob.
  - A soft terminator, ndl^0.6 · ndv^0.3, with a faint warm night side (0.010, 0.0066, 0.0062).
- **Ringed giant** (az 74, el 79, 11°, phase 35, rings open 22°, tilted 18°):
  - Cream-and-honey bands: a 13-stop ramp from (0.52, 0.40, 0.26) through (0.96, 0.90, 0.74), with turbulence and swirl noise.
  - A muted violet storm belt (0.44, 0.32, 0.66), plus a storm oval (0.66, 0.50, 0.72).
  - The ring shadow on the globe is ray-marched to the ring plane (× 0.95); the globe's shadow on the rings is a ray-sphere test.
  - Rings run to 2.24 R: a faint C ring, a bright B ring, the Cassini gap, and an A ring with the Encke gap, plus fine ringlets.
  - Exposure × 1.4, so it isn't washed out.
- **Composition rule:** check every planet against every earlier framing. A payoff planet (the giant) must stay out of frame until its moment.
  - The giant sits at el 79 so the earlier views can't catch it.
  - The copper planet enters at the frame edge as the friend points.
- **Fade-in:** each planet's visibility is keyed with the stars. The copper planet fades in later (story 30 to 38).

## 6. Camp, people and fire (the warm counterpoint)
- **Fire bed:**
  - Logs: charred and alligator-cracked, with cracks that glow only where the fire is hot.
  - Coals: lumpy, mostly dark with white ash, glowing veins.
  - Ash bed: mottled.
  - Light: point lights FIRE_KEY, FILL and LOW, with keyed flicker.
- **Flames:** 7 cards plus 5 small licks. The material sways and curls, has a hot yellow-white core near the base and soft edges. Thin blade flames were rejected.
- **Steak:** irregular shape, about 2.6 cm thick, with a dark mahogany sear, diamond crosshatch grill marks, a fat cap facing the camera, glossy wet spots and low specular. "Paper" and "cookie" looks were rejected.
- **People:**
  - Adult men, in quilted down coats, a beanie, fleece gloves with an amber fire rim, and a balaclava.
  - Goggles are expedition style, with a blue-to-violet mirrored lens.
  - Eyes: never visible. Eyeballs are camera-invisible (`visible_camera = False`), never hidden with hide_render, which leaks light through the sockets.
- **Cold air:** breath vapour is shaped by noise and stretched along the breath, never round balls. A smoke wisp rises off the food.

## 7. Camera and motion (on screen)
- **Clock and speed:** one scene clock, and a story-to-film time map (timewarp) that only tightens quiet stretches. No global speed ramps.
- **Aim:** the camera itself is aimed at its targets (`aim_solve`, within 0.5°). Pointing fingers are solved in 3D so the finger line runs to the star's vanishing point.
- **Turns:** keep below about 110°/s on screen.
- **Variety on long holds:** a slow lens push-in of 20–25 % (26 → 33 mm), easing back before the next gesture.
- **Hook:** the first 2–3 s are a flash-forward of the payoff sky (a cold open), then a hard cut to the story. Never repeat a religious line in a hook.
- **Ending:** a wide shot with the whole payoff in frame (an 18 mm lens, raised), and the people small under the sky.

## 8. Captions and countdown
- **Captions:** lower middle, at y about 1401. White for the other character, #FFD54A for the hero. One caption at a time.
- **Countdown:** a left-centre panel in the V11 style ("LIGHT POLLUTION DISAPPEARS IN", with large numerals). One real second per number, landing on zero.
- **Arabic:** stays Arabic in the sound, with an accurate English caption. Pronunciation review is disclosed as pending.

