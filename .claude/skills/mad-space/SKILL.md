---
name: mad-space
description: The owner's complete space-film standard, from the approved THE NIGHT WE FINALLY LOOKED UP V10 (2026-11-25) on top of NEW YORK FALLS UP V11. It covers the exact star, Milky Way, planet, sky, fire and camera recipes, the halal rules, sound and voice preferences, and the incremental studio pipeline. Use it for every new video, short, reel or film, every space, night-sky, star, planet or cosmic scene, any "make a video about…" request, and any revision, in any project or tab, even when the owner gives only a one-line idea. The owner aims for perfection, and the sky must be dense, coloured and exact down to every star.
---

# /mad-space (MAD SPACE): the owner's style, everywhere

Load these in this order. They are not optional:
1. **This skill.** Read `references/space_look_spec.md` in full before designing anything that has sky in it. Look at `references/frames/*.jpg`, the approved V10 frames, before the first still.
2. **cinematic-pov-studio:** the style authority and the NYFU V11 anchor. Where it and this skill differ on a space look, this skill wins; on everything else it wins.
3. **cosmic-pov-shorts:** the tested tools: deliver.py, audio_dsp, audio_qa, frame QA, gmotion and the black-hole tracer.
4. **The studio** (`C:\Users\Jangis.technology\Documents\Codex\2026-11-06\files-pasted-by-the-user-project\studio\`):
   - It is the incremental pipeline: version folders, hardlinked frames, re-rendering only the frames a change touches, the halal gate, previews and the loop.
   - `python studio\tools\studio.py` lists its commands. Add a new project to `PROJECT_STATE.json`.
   - Run the AFK improvement loop with `/loop /studio-ceo`.

Approved code to adapt, not rewrite: `assets/approved_twfl_v10_tools/`:
- the sky and planets: `sky_build.py`;
- the fire, steak and camp: `camp_build.py`;
- vapour and smoke: `cold.py`;
- wardrobe: `winter.py`;
- aim, pointing and the camera: `animate.py`;
- time map: `timewarp.py`;
- sound: `sfx_synth.py` and `mix.py`;
- captions: `make_overlays_twfl.py`;
- hook: `cold_open.py`;
- rendering: `render_chunks.ps1`.

The studio CLI and scene audit are also copied into `assets/`.

## Non-negotiables (the owner's standard)
**Halal (absolute):**
- men only;
- modest, opaque clothing;
- no visible eyes on anyone: goggles, a mask, or eyes made camera-invisible;
- no music of any kind, no profanity, alcohol, pork, gambling or romance;
- no depiction of Allah or the prophets, and no invented religious claims;
- Arabic is spoken complete, with pronunciation review disclosed as pending;
- supplication only where the scene warrants it, never repeated for effect.

Run `studio.py compliance` before any final render.

**Picture:**
- vertical 1080×1920 at native 60 fps;
- first-person adult male with visible hands that touch the world;
- cinematic, slightly stylised 3D with grounded materials.

Never use stick figures, block worlds, flat placeholder shapes, or generic glow blobs.

**Sky (this is the owner's work, so get every dot right):**
- a deep midnight-blue dome;
- five star populations with random^9 brightness, tiny gaussian cores and colour only in the bright few percent;
- density that varies, with real dark gaps;
- a designed Milky Way: an ivory-gold cloud, a forked ragged dust lane, rose wisps, and a lavender-to-blue far end;
- hero stars that the gaze leads to;
- planets with one shared light direction, shaded globes, ring gaps and both ring shadows.

Glowing things keep their structure and never clip to white. The upper sky stays navy. The full recipe and numbers are in `references/space_look_spec.md`.

**Motion:**
- one scene clock; quiet stretches are tightened, with no global speed ramps;
- weight, anticipation and follow-through on every action;
- the camera aims at its targets, and fingers point exactly at stars;
- long holds get a slow 20–25 % push-in;
- the opening is a hook: a 2–3 s flash-forward of the payoff sky.

**Sound:**
- two distinct male voices, and the owner prefers the original takes: change a caption rather than re-record;
- physical, scene-specific effects with no plain wind and no hiss;
- the fire kept well under speech (speech at least +12 dB, measured +16 dB);
- −16 LUFS.

Sound-only changes never re-render frames.

**Captions:**
- lower middle;
- white for the other character, #FFD54A for the hero;
- the countdown at left centre in the V11 style.

## Workflow (fast, and token-light)
1. **Brief:** infer routine choices from this skill. Ask only when a choice truly blocks progress. When the owner is AFK, ask nothing; mark open questions `needs_owner`.
2. **Design:** place every sky element against every camera framing, using `world_to_camera_view` or `dirty_frames.py`, before rendering.
3. **Proof stills** of the hardest elements, compared side by side with the approved V10 frames: the sky, the hero object, the fire and contact. Fix the problems on stills, never on a full render.
4. **Render:** use version folders and render only the frames that changed. Keep one GPU job at a time; the user's Roblox shares the 4 GB card, so leave it alone. Plan about 2.9 MB of disk per frame and keep 5 GB free.
5. **Export:** the halal gate, `deliver.py` with full QA, then the `_SHARE` copy to the owner's phone with SendUserFile.
6. **Honesty:** never call a draft finished. Say what wasn't watched or listened to.

## Lessons that cost hours (do not repeat them)
- Never seed geometry with Python's `hash()`, which is salted per process. Freeze approved random geometry as an asset instead.
- Build re-render lists from projection with a 5 % margin, plus the first frame after every cut. Never pick frames by hand.
- Put a patch comment at the end of a line only. A `#` inserted mid-line once commented out a rock's placement.
- Glossy meat reads pale under firelight. Round vapour puffs read as moons. A 13 % zoom reads as the same shot.
- Test-render every new material before the full render: they caught a white-blob cap, weak flames and a misplaced rock.

## Running in a cloud session
- The owner's PC holds the studio, the Blender 5.2 scenes, the approved scripts and the reference frames. They are not in this repository.
- Use `references/space_look_spec.md`: it has every number of the approved look.
- Never claim to have rendered on the PC.

