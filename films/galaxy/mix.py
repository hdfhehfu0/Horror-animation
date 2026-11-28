"""Galaxy: narration + recorded ElevenLabs effects on the film's timeline -> films/galaxy/audio/voice_sfx.wav/.mp3
and films/galaxy/voice-data.js. Cue times come from films/galaxy/core.js (evaluated with node), so the wind stops
on the rewind frame and the blast lands on the merge.
usage: python3 films/galaxy/mix.py   (after prep_narration.py)
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/galaxy/'
NODE = """
global.window = global;
require('./js/core.js'); require('./films/galaxy/words.js'); require('./films/galaxy/core.js');
const T = window.TL;
console.log(JSON.stringify({ at: [6, 9, 13, 26].map(T.at), end: [6, 26].map(T.end), lmc: T.k.lmcHit, merge: T.k.merge,
  rew: T.REW, cut: T.CUT, creature: T.creature, whisper: T.whisper, dur: T.DURATION, sents: window.GX_SENTENCES }));
"""
C = json.loads(subprocess.run(['node', '-e', NODE], capture_output=True, check=True, text=True).stdout)
DUR, S = C['dur'], C['sents']
AT6, AT9, AT13, AT26 = C['at']; END6, END26 = C['end']
REW0, REW1 = C['rew']

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

# tonight: crickets, until "The street empties." -- they thin out as the years start to run.
# The takes are short, so the bed is two staggered layers of all four, shuffled, so it never audibly loops.
def cricket_bed(seconds, seed):
    rng = np.random.default_rng(seed); takes = [rms_norm(load(D + f'crickets_{i}.mp3'), -33) for i in (1, 2, 3, 4)]
    n = int(seconds * SR); y = np.zeros(n + SR * 3, dtype=np.float32); xf = int(0.3 * SR)
    for layer in (0, 1):
        pos = int(layer * 0.45 * SR)
        while pos < n:
            c = takes[rng.integers(4)].copy(); c[:xf] *= np.linspace(0, 1, xf); c[-xf:] *= np.linspace(1, 0, xf)
            y[pos:pos + len(c)] += c * (0.8 + 0.4 * rng.random()); pos += len(c) - xf
    return y[:n]
crk = cricket_bed(END6 + 0.5, 7)
bed(crk, 0, END6 + 0.4, 0, fade_in=0.05, fade_out=0.5, env=lambda t: -30 * ramp(t, AT6, END6 + 0.4) ** 1.5)
# a billion years on: dry desert wind over the dunes, building as the sky fills -- cut dead by the rewind
bed(rms_norm(load(D + 'desert_4.mp3', 'highpass=f=60'), -27), AT9 - 0.5, REW0 + 0.05, 0, fade_in=2.0, fade_out=0.05,
    env=lambda t: 4 * ramp(t, AT13, C['merge']))
# the collision: a deep cosmic rumble that grows until the cores meet
bed(rms_norm(load(D + 'rumble_4.mp3'), -26), AT13 - 1.5, REW0 + 0.05, 0, fade_in=2.5, fade_out=0.05,
    env=lambda t: -8 + 8 * ramp(t, AT13, C['merge']))
# the Large Magellanic Cloud hits: a distant boom
place(rms_norm(load(D + 'blast_3.mp3'), -25), C['lmc'] - 0.05, 0, fade_out=1.5)
# the merge: the big one
place(rms_norm(load(D + 'blast_1.mp3'), -21), C['merge'] - 0.05, 0, fade_out=2.0)
place(rms_norm(load(D + 'blast_2.mp3', 'lowpass=f=2500'), -31), C['merge'] + 0.15, 0, fade_out=2.0)
# "Or maybe not.": the tape rewinds, and stops on tonight
rw = load(D + 'rewind_3.mp3')[:int((REW1 - REW0 + 0.08) * SR)]
place(rms_norm(rw, -20), REW0, 0, fade_in=0.02, fade_out=0.08)
# tonight again: the crickets come back... and stop, all at once, when it shows up
bed(cricket_bed(AT26 - REW1, 11), REW1, AT26 - 0.15, 0, fade_in=0.6, fade_out=0.04)
# "Something else already is.": something breathing, close
place(rms_norm(load(D + 'breath_3.mp3', 'lowpass=f=3200'), -22), END26 - 0.05, 0, fade_out=0.15)

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
open(B + 'voice-data.js', 'w').write('/* generated by films/galaxy/mix.py */\nwindow.VOICE = { file: "films/galaxy/audio/voice_sfx.mp3", wav: "films/galaxy/audio/voice_sfx.wav", segments: '
                                     + json.dumps([[round(a, 2), round(b, 2)] for a, b in merged]) + ' };\n')
vr = 20 * np.log10(np.sqrt(np.mean(voice[voice != 0] ** 2)) + 1e-9)
for a, b in [(0, AT6), (AT13, C['merge']), (C['merge'], REW0), (REW1, AT26)]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('voice rms', round(float(vr), 1), 'dB; peak', round(float(peak), 3))
