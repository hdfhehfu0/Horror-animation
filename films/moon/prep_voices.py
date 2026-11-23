"""Moon (POV): cut the two voice takes into lines and place each line on the film timeline.

The narrator (calm, deep; white italic captions) and the inner voice (the POV character's prayers; gold
captions) were generated as one take each (the four "Oh God" lines later re-recorded as their own take), with a pause between lines. Each take is split at its pauses,
and every line is set at the moment its scene plays (SLOTS), following the reference's pacing.
Whispered lines are lifted so they read over the effects.

Writes films/moon/lines.js (line timings + caption text), films/moon/audio/voice.wav/.mp3, films/moon/voice-data.js.
usage: python3 films/moon/prep_voices.py
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/moon/'
DUR = 85.5
NARR = [  # (start on the film timeline, caption)   -- one entry per line of the narrator take
    (0.15, 'In five seconds, the Moon stops orbiting Earth.'),
    (3.45, 'And starts to fall.'),
    (10.5, 'The first thing it pulls on is the water.'),
    (19.0, 'You run for the subway.'),
    (26.0, 'Then the water starts climbing… up the stairs.'),   # two pieces in the take, kept together
    (34.0, 'Across the street, a taxi lifts off the road.'),
    (39.5, 'Above you, the Moon is breaking apart.'),
    (43.5, 'Hold on to something.'),
    (49.2, 'The pieces start to fall.'),
    (58.5, 'Now the buildings are being pulled into the sky.'),
    (68.2, 'The railing is holding you.'),
    (69.6, "It's starting to bend."),
]
INNER = [  # (start, caption, target loudness of the line in dBFS RMS, take, line in that take)
    (5.45, 'What the...', -21, 'inner', 0),
    (15.5, 'Oh God.', -23, 'god', 0),
    (23.0, 'Oh God, make this easy for me.', -21, 'god', 1),
    (37.6, 'Oh God.', -23, 'god', 2),
    (66.5, 'Oh God!', -18, 'god', 3),
    (75.0, 'I bear witness that there is no deity except Allah,', -21, 'inner', 5),
    (78.6, 'and I bear witness that Muhammad is His servant and Messenger.', -21, 'inner', 6),
]

def load(path):
    return np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                                        capture_output=True, check=True).stdout, dtype=np.float32).copy()

def split(x, thr_db, min_gap=0.28, min_len=0.15):
    """sound segments separated by pauses of at least min_gap"""
    w = int(0.02 * SR); e = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, len(x) - w, w)])
    on = 20 * np.log10(e + 1e-9) > thr_db; out, i, n = [], 0, len(on)
    while i < n:
        if not on[i]: i += 1; continue
        j = i
        while j < n:
            if on[j]: j += 1; continue
            k = j
            while k < n and not on[k]: k += 1
            if k - j >= min_gap / 0.02 or k == n: break
            j = k
        if (j - i) * 0.02 > min_len: out.append([max(0, i * 0.02 - 0.06), min(len(x) / SR, j * 0.02 + 0.12)])
        i = j
    return out

narr = load(B + 'audio/raw/narr_a.mp3')
takes = {'inner': load(B + 'audio/raw/inner_a.mp3'), 'god': load(B + 'audio/raw/god_a.mp3')}   # god_a: the "Oh God" lines, re-recorded
cuts = {k: split(x, -46) for k, x in takes.items()}
ns = split(narr, -42)
ns = ns[:4] + [[ns[4][0], ns[5][1]]] + ns[6:]          # "climbing... up the stairs" stays one line
assert len(ns) == len(NARR) and len(cuts['inner']) == 7 and len(cuts['god']) == 4, (len(ns), {k: len(v) for k, v in cuts.items()})

film = np.zeros(int(DUR * SR), dtype=np.float32)
def put(seg, t, gain=1.0):
    seg = seg.copy(); f = int(0.015 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    s = int(t * SR); film[s:s + len(seg)] += seg[:len(film) - s] * gain
rms = lambda a: np.sqrt(np.mean(a ** 2)) + 1e-9
lines = []
# narrator: one gain for the whole take, so its delivery stays natural
ng = 10 ** (-19 / 20) / rms(np.concatenate([narr[int(a * SR):int(b * SR)] for a, b in ns]))
for (t, text), (a, b) in zip(NARR, ns):
    seg = narr[int(a * SR):int(b * SR)]; put(seg, t, ng); lines.append([round(t, 3), round(t + (b - a), 3), 'narr', text])
for t, text, db, take, k in INNER:
    a, b = cuts[take][k]; seg = takes[take][int(a * SR):int(b * SR)]
    put(seg, t, 10 ** (db / 20) / rms(seg)); lines.append([round(t, 3), round(t + (b - a), 3), 'inner', text])
lines.sort()
for i in range(len(lines) - 1): assert lines[i][1] < lines[i + 1][0] + 0.05, lines[i:i + 2]
film = np.clip(film, -0.98, 0.98)
with wave.open(B + 'audio/narration.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((film * 32767).astype(np.int16).tobytes())
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', B + 'audio/narration.wav', '-af',
                'highpass=f=55,equalizer=f=3000:t=q:w=1.2:g=1.5,acompressor=threshold=-24dB:ratio=2.5:attack=5:release=150:makeup=3dB,alimiter=limit=0.89:level=false',
                B + 'audio/voice.wav'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', B + 'audio/voice.wav', '-b:a', '160k', B + 'audio/voice.mp3'], check=True)
open(B + 'lines.js', 'w').write('/* generated by films/moon/prep_voices.py: [start, end, voice, caption] on the film timeline */\n'
                                f'window.MOON_DURATION = {DUR};\nwindow.MOON_LINES = ' + json.dumps(lines, indent=0, ensure_ascii=False) + ';\n')
open(B + 'voice-data.js', 'w').write('/* generated by films/moon/prep_voices.py */\nwindow.VOICE = { file: "films/moon/audio/voice.mp3", wav: "films/moon/audio/voice.wav", segments: '
                                     + json.dumps([[l[0], l[1]] for l in lines]) + ' };\n')
for l in lines: print(f'{l[0]:6.2f}-{l[1]:6.2f} {l[2]:5s} {l[3]}')
