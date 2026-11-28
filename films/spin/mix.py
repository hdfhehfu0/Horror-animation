"""Stopped spinning: narration + recorded ElevenLabs effects on the film's timeline -> films/spin/audio/voice_sfx.wav/.mp3
and films/spin/voice-data.js. Cue times come from films/spin/core.js (evaluated with node): the afternoon street
fades as the time-lapse starts, a thud lands when the spin stops, cicadas and a hot wind fill the six-month day,
crickets come up with the long night and stop dead when something walks out of the dark, and it breathes.
usage: python3 films/spin/mix.py   (after prep_narration.py)
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/spin/'
NODE = """
global.window = global;
require('./js/core.js'); require('./films/spin/words.js'); require('./films/spin/core.js');
const T = window.TL;
console.log(JSON.stringify({ at: window.SP_SENTENCES.map((s) => s[0]), end: window.SP_SENTENCES.map((s) => s[1]), lapse: T.T_L, stop: T.T_S,
  creature: T.creature, cut: T.CUT, dur: T.DURATION, sents: window.SP_SENTENCES }));
"""
C = json.loads(subprocess.run(['node', '-e', NODE], capture_output=True, check=True, text=True).stdout)
DUR, S, AT, END = C['dur'], C['sents'], C['at'], C['end']

def load(path, af=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).copy()
def rms_norm(x, db):
    r = np.sqrt(np.mean(x ** 2)); return x if r < 1e-9 else x * (10 ** (db / 20) / r)
sfx = np.zeros(int((DUR + 5) * SR), dtype=np.float32)
def place(x, t, gain_db=0.0, fade_in=0.01, fade_out=0.05):
    x = x.copy()
    fi, fo = min(len(x) // 2, int(fade_in * SR)), min(len(x) // 2, int(fade_out * SR))
    if fi: x[:fi] *= np.linspace(0, 1, fi)
    if fo: x[-fo:] *= np.linspace(1, 0, fo)
    s = int(t * SR); sfx[s:s + len(x)] += x[:len(sfx) - s] * 10 ** (gain_db / 20)
def bed(clip, t0, t1, db, fade_in=0.4, fade_out=0.15, env=None):
    """loop `clip` from t0 to t1 with crossfades; env(t) -> extra gain in dB"""
    t = t0
    while t < t1:
        n = int(min(len(clip), (t1 - t) * SR)); seg = clip[:n].copy()
        if env is not None: seg *= 10 ** (np.array([env(t + i / SR) for i in range(0, n, 441)]).repeat(441)[:n] / 20)
        place(seg, t, db, fade_in=fade_in if t == t0 else 0.25, fade_out=fade_out if t + n / SR >= t1 - 1e-3 else 0.25)
        t += len(clip) / SR - 0.25
D = B + 'audio/sfx/'
ramp = lambda t, a, b: min(1.0, max(0.0, (t - a) / (b - a)))

# a still afternoon: a far-off street, a lawnmower, kids -- swept away when the time-lapse starts
bed(rms_norm(load(D + 'afternoon_4.mp3'), -27), 0, C['lapse'] + 1.2, 0, fade_in=0.05, fade_out=1.0)
place(rms_norm(load(D + 'birds_3.mp3'), -33)[:int(C['lapse'] * SR)], 0, 0, fade_in=0.05, fade_out=1.0)
# the time-lapse: a low rumble under the racing days, gone when it stops
bed(rms_norm(load(D + 'rumble_2.mp3'), -31), C['lapse'], C['stop'] + 0.15, 0, fade_in=1.5, fade_out=0.15,
    env=lambda t: -6 * ramp(t, C['lapse'] + 4, C['stop']))
# it stops: one deep thud
place(rms_norm(load(D + 'blast_1.mp3', 'lowpass=f=900'), -24), C['stop'] - 0.03, 0, fade_out=1.5)
# the six-month day: cicadas and a hot, dry wind -- fading with the sunset
cic = rms_norm(load(D + 'cicadas_4.mp3'), -31)
bed(cic, C['stop'] + 1.0, END[18] + 1.5, 0, fade_in=2.5, fade_out=2.5, env=lambda t: 4 * ramp(t, AT[14], AT[16]) - 10 * ramp(t, AT[18], END[18] + 1.5))
bed(rms_norm(load(D + 'desert_4.mp3', 'highpass=f=70'), -31), AT[16] - 0.5, END[19], 0, fade_in=2.0, fade_out=1.5)
# the long night: crickets come up... and stop, all at once, when it walks out of the dark
def cricket_bed(seconds, seed):
    rng = np.random.default_rng(seed); takes = [rms_norm(load(D + f'crickets_{i}.mp3'), -33) for i in (1, 2, 3, 4)]
    n = int(seconds * SR); y = np.zeros(n + SR * 3, dtype=np.float32); xf = int(0.3 * SR)
    for layer in (0, 1):
        pos = int(layer * 0.45 * SR)
        while pos < n:
            c = takes[rng.integers(4)].copy(); c[:xf] *= np.linspace(0, 1, xf); c[-xf:] *= np.linspace(1, 0, xf)
            y[pos:pos + len(c)] += c * (0.8 + 0.4 * rng.random()); pos += len(c) - xf
    return y[:n]
bed(cricket_bed(C['creature']['t0'] - END[18] + 1, 7), END[18], C['creature']['t0'] + 0.3, 0, fade_in=2.5, fade_out=0.04)
# "And something has been waiting for it.": a breath, close
place(rms_norm(load(D + 'breath_3.mp3', 'lowpass=f=3200'), -22), END[22] - 0.05, 0, fade_out=0.15)

cut = int(C['cut'] * SR); sfx[cut:] = 0
voice = load(B + 'audio/voice.wav')
# duck the effects ~5 dB under the narrator, so the words always sit on top
w = int(0.05 * SR); nv = min(len(voice), len(sfx)); e = np.sqrt(np.convolve(voice[:nv] ** 2, np.ones(w) / w, 'same'))
act = (e > 10 ** (-38 / 20)).astype(np.float32); k = np.hanning(int(0.3 * SR)); act = np.minimum(1, np.convolve(act, k / k.sum() * 3, 'same'))
sfx[:nv] *= 1 - 0.44 * act
out = sfx[:int(DUR * SR)].copy()
out[:min(len(voice), len(out))] += voice[:len(out)]
peak = np.abs(out).max()
if peak > 0.97: out *= 0.97 / peak
with wave.open(B + 'audio/voice_sfx.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', B + 'audio/voice_sfx.wav', '-b:a', '160k', B + 'audio/voice_sfx.mp3'], check=True)
merged = []
for a, b, _ in S:
    if merged and a - merged[-1][1] < 0.35: merged[-1][1] = b
    else: merged.append([a, b])
open(B + 'voice-data.js', 'w').write('/* generated by films/spin/mix.py */\nwindow.VOICE = { file: "films/spin/audio/voice_sfx.mp3", wav: "films/spin/audio/voice_sfx.wav", segments: '
                                     + json.dumps([[round(a, 2), round(b, 2)] for a, b in merged]) + ' };\n')
vr = 20 * np.log10(np.sqrt(np.mean(voice[voice != 0] ** 2)) + 1e-9)
for a, b in [(0, C['lapse']), (C['lapse'], C['stop'] + 2), (C['stop'] + 2, AT[18]), (AT[18], C['cut'])]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('voice rms', round(float(vr), 1), 'dB; peak', round(float(peak), 3))
