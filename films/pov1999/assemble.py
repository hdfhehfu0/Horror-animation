"""POV 1999: put the generated clips together like the reference.
Each clip is scaled to 1080x1920 @ 24 fps, trimmed to its plan length and hard-cut to the next.
Areas listed under a scene's "blur" are softened in every frame. The red slab-serif title sits over the first 2.95 s, the picture gets a warm, slightly soft grade,
the last shot sinks to black like the reference, and the original music bed (music.py) replaces the clips' audio.

usage: python3 films/pov1999/assemble.py clip1.mp4 ... clip6.mp4   -> out/pov-1999.mp4
"""
import json, subprocess, sys

P = 'films/pov1999/'
plan = json.load(open(P + 'plan.json'))
clips = sys.argv[1:]
assert len(clips) == len(plan['scenes']), f"need {len(plan['scenes'])} clips"
durs = [s.get('use', s['duration']) for s in plan['scenes']]
total = sum(durs)
subprocess.run(['python3', P + 'music.py', str(total)], check=True)

inputs, parts = [], []
for i, (c, d) in enumerate(zip(clips, durs)):
    inputs += ['-i', c]
    base = f'[{i}:v]trim=0:{d},setpts=PTS-STARTPTS,fps=24,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1'
    boxes = plan['scenes'][i].get('blur', [])
    if not boxes:
        parts.append(base + f'[v{i}]'); continue
    # soften anything that reads as a real brand: blur the box in every frame of this clip
    parts.append(base + f',split=2[b{i}][s{i}]')
    x, y, w, h = boxes[0]
    parts.append(f'[s{i}]crop={w}:{h}:{x}:{y},boxblur=26:3[bb{i}];[b{i}][bb{i}]overlay={x}:{y}[v{i}]')
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
