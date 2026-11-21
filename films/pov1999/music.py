"""POV 1999: an original, warm, nostalgic Christmas-morning cue (no existing song), synthesised in numpy.
Soft felt piano chords + a music-box melody + light sleigh-bell shimmer + a touch of tape hiss and wow.
usage: python3 films/pov1999/music.py [seconds]  -> films/pov1999/music.wav
"""
import sys, wave
import numpy as np

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 24.0
BPM = 76
beat = 60 / BPM
out = np.zeros(int((DUR + 4) * SR))
rng = np.random.default_rng(1999)
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)

def add(x, t, g=1.0):
    s = int(t * SR); e = min(len(out), s + len(x)); out[s:e] += x[:e - s] * g

def piano(m, dur, vel=0.5):
    """felt piano: a few slightly inharmonic partials, soft attack, two-stage decay"""
    n = int((dur + 1.5) * SR); t = np.arange(n) / SR; f = mtof(m)
    y = np.zeros(n)
    for k, a in [(1, 1), (2, 0.42), (3, 0.18), (4, 0.09), (5, 0.04)]:
        fk = f * k * (1 + 0.0004 * k * k)
        y += a * np.sin(2 * np.pi * fk * t + rng.random()) * np.exp(-t * (0.9 + 0.55 * k))
    env = np.minimum(1, t / 0.012) * (0.75 * np.exp(-t * 1.1) + 0.25)
    rel = np.clip((dur + 0.25 - t) / 0.25, 0, 1)
    return y * env * rel * vel

def musicbox(m, vel=0.35):
    n = int(2.4 * SR); t = np.arange(n) / SR; f = mtof(m)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 2.4), (2.0, 0.3, 4), (3.0, 0.12, 6), (5.4, 0.06, 9)])
    return y * np.minimum(1, t / 0.002) * vel

def bells(t0, length, vel=0.05):
    """sleigh-bell shimmer: short bright noise grains"""
    n = int(length * SR); y = np.zeros(n)
    for i in range(int(length * 9)):
        s = int((i / 9 + rng.random() * 0.03) * SR); g = int(0.05 * SR)
        if s + g >= n: break
        grain = rng.standard_normal(g) * np.exp(-np.arange(g) / SR * 70)
        y[s:s + g] += grain * (0.6 + 0.4 * rng.random())
    # brighten: crude high-pass by differencing
    y = np.diff(y, prepend=0)
    add(y * vel, t0)

# I - vi - IV - V in F major, two bars each chord-pair; then a resolving IV - I
prog = [[53, 57, 60, 65], [50, 57, 62, 65], [46, 58, 62, 65], [48, 55, 60, 64],
        [53, 57, 60, 65], [50, 57, 62, 65], [46, 58, 62, 65], [48, 55, 58, 64], [53, 57, 60, 65]]
bar = 4 * beat
for i, ch in enumerate(prog):
    t0 = i * bar
    if t0 > DUR: break
    add(piano(ch[0] - 12, bar, 0.35), t0)                     # low root
    for k, m in enumerate(ch[1:]):                           # gently rolled chord
        add(piano(m, bar - 0.1, 0.22), t0 + 0.035 * k)
    add(piano(ch[1], beat, 0.12), t0 + 2 * beat)             # soft re-strike on beat 3

# an original music-box line (two phrases), entering on bar 2
mel = [(72, 0), (74, 1), (76, 2), (77, 2.5), (76, 3), (72, 4), (69, 5), (72, 6), (74, 7.5),
       (74, 8), (76, 9), (77, 10), (79, 10.5), (77, 11), (74, 12), (72, 13), (70, 14), (69, 15), (72, 16)]
for m, b in mel:
    t = bar + b * beat
    if t < DUR - 0.5: add(musicbox(m + 12, 0.16), t)
bells(bar * 2, min(DUR - bar * 2, bar * 5), 0.03)

# tape warmth: slow wow (pitch-ish via tiny resampling), hiss, gentle low-pass, fade out
x = out[:int(DUR * SR)]
k = np.arange(len(x)); wow = k + 18 * np.sin(2 * np.pi * 0.55 * k / SR)
x = np.interp(wow, k, x)
x += rng.standard_normal(len(x)) * 0.0025
a = np.exp(-2 * np.pi * 7000 / SR); y = np.zeros_like(x)
for i in range(1, len(x)): y[i] = (1 - a) * x[i] + a * y[i - 1]
fade = int(2.5 * SR); y[-fade:] *= np.linspace(1, 0, fade) ** 1.5
y[:int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
y /= np.abs(y).max() / 0.8
st = np.stack([y, np.roll(y, 220) * 0.96], 1)               # a little width
with wave.open('films/pov1999/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
print('music.wav', DUR, 's')
