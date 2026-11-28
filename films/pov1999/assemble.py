"""POV 1999: put the generated clips together like the reference.
Each clip is trimmed to its plan length (`use`), gently slowed with motion interpolation (`speed` < 1, so the
shots linger like the reference's), scaled to 1080x1920 @ 24 fps and hard-cut to the next.
Areas listed under a scene's "blur" are softened in every frame through a feathered mask, so they read as
out-of-focus signage rather than a box. The red slab-serif title sits over the first 2.95 s, the picture gets a warm, slightly soft grade,
the last shot sinks to black like the reference, and the original music bed (music.py) replaces the clips' audio.

usage: python3 films/pov1999/assemble.py clip1.mp4 ... clip6.mp4   -> out/pov-1999.mp4
"""
import json, subprocess, sys

P = 'films/pov1999/'
plan = json.load(open(P + 'plan.json'))
clips = sys.argv[1:]
assert len(clips) == len(plan['scenes']), f"need {len(plan['scenes'])} clips"
uses = [s.get('use', s['duration']) for s in plan['scenes']]
speeds = [s.get('speed', 1.0) for s in plan['scenes']]
frames = [round(u / sp * 24) for u, sp in zip(uses, speeds)]   # whole frames, so cuts, fade and music line up exactly
durs = [n / 24 for n in frames]
total = sum(frames) / 24
subprocess.run(['python3', P + 'music.py', str(total)], check=True)

inputs, parts = [], []
for i, (c, d) in enumerate(zip(clips, durs)):
    inputs += ['-i', c]
    sp = speeds[i]
    slow = '' if sp >= 0.999 else f',setpts=PTS/{sp},minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1'
    # tpad holds the last frame for a moment, so interpolation can never leave a clip short of its slot
    base = (f'[{i}:v]trim=0:{uses[i]},setpts=PTS-STARTPTS,fps=24{slow},tpad=stop_mode=clone:stop_duration=0.5,trim=end_frame={frames[i]},setpts=PTS-STARTPTS,'
            'scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1')
    boxes = plan['scenes'][i].get('blur', [])
    if not boxes:
        parts.append(base + f'[v{i}]'); continue
    # soften anything that reads as a real brand: blur the box in every frame of this clip
    parts.append(base + f',split=2[b{i}][s{i}]')
    x, y, w, h = boxes[0]
    # a feathered mask: white box, blurred hard, used as the alpha of a blurred copy of the frame
    parts.append(f'color=c=black:s=1080x1920:r=24:d={d},format=gray,drawbox=x={x}:y={y}:w={w}:h={h}:color=white:t=fill,boxblur=60:2[m{i}]')
    parts.append(f'[s{i}]boxblur=28:3,format=yuva420p[bl{i}];[bl{i}][m{i}]alphamerge[ba{i}];[b{i}][ba{i}]overlay=0:0:shortest=1[v{i}]')
n = len(clips)
inputs += ['-loop', '1', '-t', '3', '-i', P + 'title.png', '-i', P + 'music.wav']
f = ';'.join(parts) + ';' + ''.join(f'[v{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0[cat];'
f += ("[cat]eq=saturation=1.06:gamma=0.98,colorbalance=rs=0.03:bs=-0.03:rm=0.02:bm=-0.02,"
      "noise=alls=6:allf=t,unsharp=5:5:-0.25" f",fade=t=out:st={total - 2.2}:d=2.2[g];")
f += f"[g][{n}:v]overlay=0:0:enable='lt(t,2.95)'[out]"
cmd = ['ffmpeg', '-y', '-loglevel', 'error'] + inputs + ['-filter_complex', f, '-map', '[out]', '-map', f'{n + 1}:a',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '24',
       '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out/pov-1999.mp4']
subprocess.run(cmd, check=True)
print('out/pov-1999.mp4', total, 's')
