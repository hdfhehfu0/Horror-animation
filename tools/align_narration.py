"""Split a one-take narration at its pauses and place each sentence on its caption time.

usage: python3 tools/align_narration.py audio/raw/narr_a.mp3 audio/narration.json audio/narration.wav
"""
import json, re, subprocess, sys, wave
import numpy as np

SR = 44100
src, script_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
lines = json.load(open(script_path))
N = len(lines)
DUR = 78.7

pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768

# silences (>=0.12 s) from ffmpeg
log = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
starts = [float(v) for v in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(v) for v in re.findall(r'silence_end: ([\d.]+)', log)]
total = len(x) / SR
sil = [(s, e) for s, e in zip(starts, ends) if s > 0.05 and e < total - 0.05]   # internal gaps only
speech_start = ends[0] if starts and starts[0] < 0.05 else 0.0
speech_end = starts[-1] if starts and ends[-1] >= total - 0.05 else total

# Choose N-1 of the candidate gaps so that every segment's length best matches its text length
# (dynamic programming over gaps; longer gaps are preferred as sentence breaks).
def weight(text):
    return len(re.sub(r'[^A-Za-z0-9]', '', text)) + 4 * len(re.findall(r'[.,:?…]', text)) + 3
wts = [weight(l[1]) for l in lines]
voiced = (speech_end - speech_start) - 0.35 * (N - 1)
rate = voiced / sum(wts)
M = len(sil)
pts = [(speech_start, speech_start)] + sil + [(speech_end, speech_end)]   # index 0 and M+1 are the ends
INF = float('inf')
cost = [[INF] * (M + 2) for _ in range(N + 1)]
back = [[-1] * (M + 2) for _ in range(N + 1)]
cost[0][0] = 0.0
for k in range(1, N + 1):
    for j in range(1, M + 2):
        if (k < N) == (j == M + 1):
            continue
        gap_bonus = 0 if j == M + 1 else -0.6 * min(1.0, (pts[j][1] - pts[j][0]) / 0.6)
        for i in range(0, j):
            if cost[k - 1][i] == INF:
                continue
            d = pts[j][0] - pts[i][1]
            if d <= 0.05:
                continue
            c = cost[k - 1][i] + np.log(d / (wts[k - 1] * rate)) ** 2 + gap_bonus
            if c < cost[k][j]:
                cost[k][j] = c; back[k][j] = i
j, path = M + 1, []
for k in range(N, 0, -1):
    i = back[k][j]; path.append((pts[i][1], pts[j][0])); j = i
segs = path[::-1]
assert len(segs) == N

mix = np.zeros(int(DUR * SR) + SR, dtype=np.float32)
cursor = 0.0
report = []
for i, ((a, b), (t, text)) in enumerate(zip(segs, lines)):
    a = max(0, a - 0.03); b = b + 0.06
    clip = x[int(a * SR):int(b * SR)].copy()
    nxt = lines[i + 1][0] if i + 1 < N else DUR - 0.3
    start = max(t, cursor + 0.04)                 # never overlap the previous sentence
    room = nxt - start
    dur = len(clip) / SR
    tempo = 1.0
    if dur > room and room > 0.2:                 # tighten slightly to fit its slot
        tempo = min(1.25, dur / room)
        if tempo > 1.01:
            r = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                                '-af', f'atempo={tempo:.3f}', '-f', 'f32le', '-'], input=clip.tobytes(), capture_output=True, check=True)
            clip = np.frombuffer(r.stdout, dtype=np.float32).copy()
    fade = int(0.01 * SR)
    clip[:fade] *= np.linspace(0, 1, fade); clip[-fade:] *= np.linspace(1, 0, fade)
    s = int(start * SR)
    mix[s:s + len(clip)] += clip[:len(mix) - s]
    cursor = start + len(clip) / SR
    report.append(f'{t:6.2f} -> {start:6.2f}  {len(clip)/SR:4.2f}s  x{tempo:.2f}  {text}')

mix = mix[:int(DUR * SR)]
mix /= max(1e-6, np.abs(mix).max()) / 0.89
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print('\n'.join(report))
