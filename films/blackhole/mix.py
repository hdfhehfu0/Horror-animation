"""Black hole: narration + recorded ElevenLabs effects on the film's timeline -> films/blackhole/audio/voice_sfx.wav/.mp3
and films/blackhole/voice-data.js. Cue times come from films/blackhole/core.js (evaluated with node): the crickets
fall silent as the black hole closes in, the blasts land on the Moon and the throw, the wind dies as the air
freezes, and from "No sunlight. No air. No sound." there is nothing at all but the narrator.
usage: python3 films/blackhole/mix.py   (after prep_narration.py)
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/blackhole/'
NODE = """
global.window = global;
require('./js/core.js'); require('./films/blackhole/words.js'); require('./films/blackhole/core.js');
const T = window.TL;
console.log(JSON.stringify({ at: window.BH_SENTENCES.map((s) => s[0]), moon: T.T_MOON, throw: T.T_THROW, out: T.k.out,
  cut: T.CUT, dur: T.DURATION, sents: window.BH_SENTENCES }));
"""
C = json.loads(subprocess.run(['node', '-e', NODE], capture_output=True, check=True, text=True).stdout)
DUR, S, AT = C['dur'], C['sents'], C['at']
AIRLESS = AT[23]

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

# tonight: crickets -- they fall silent as the black hole closes in
def cricket_bed(seconds, seed):
    rng = np.random.default_rng(seed); takes = [rms_norm(load(D + f'crickets_{i}.mp3'), -33) for i in (1, 2, 3, 4)]
    n = int(seconds * SR); y = np.zeros(n + SR * 3, dtype=np.float32); xf = int(0.3 * SR)
    for layer in (0, 1):
        pos = int(layer * 0.45 * SR)
        while pos < n:
            c = takes[rng.integers(4)].copy(); c[:xf] *= np.linspace(0, 1, xf); c[-xf:] *= np.linspace(1, 0, xf)
            y[pos:pos + len(c)] += c * (0.8 + 0.4 * rng.random()); pos += len(c) - xf
    return y[:n]
crk = cricket_bed(C['moon'] + 0.5, 7)
bed(crk, 0, C['moon'], 0, fade_in=0.05, fade_out=0.3, env=lambda t: -32 * ramp(t, AT[9], C['moon']) ** 1.4)
# the approach: a deep rumble that grows until Earth is thrown, then is swept away with the sky
bed(rms_norm(load(D + 'rumble_4.mp3'), -27), AT[7] - 1.0, C['throw'] + 2.2, 0, fade_in=3.0, fade_out=1.6,
    env=lambda t: -12 + 12 * ramp(t, AT[7], C['throw']))
# the Moon torn away, then Earth thrown out of its orbit
place(rms_norm(load(D + 'blast_3.mp3'), -26), C['moon'] + 0.1, 0, fade_out=1.5)
place(rms_norm(load(D + 'blast_1.mp3'), -20), C['throw'] - 0.05, 0, fade_out=2.0)
# a freezing wind over the dark street -- it dies as the air itself freezes
bed(rms_norm(load(D + 'wind_1.mp3', 'highpass=f=90'), -28), AT[13] - 0.4, AIRLESS - 0.1, 0, fade_in=2.0, fade_out=0.4,
    env=lambda t: -6 + 6 * ramp(t, AT[13], AT[15]) - 30 * ramp(t, AT[21], AIRLESS - 0.1) ** 1.5)
# the lights go out: buzz, relays clicking off
place(rms_norm(load(D + 'power_2.mp3'), -24), C['out'] - 0.3, 0, fade_out=0.4)
# frost, then the oceans freezing over: ice groaning and cracking
place(rms_norm(load(D + 'ice_3.mp3'), -31), AT[15] + 0.8, 0, fade_in=0.5, fade_out=1.0)
place(rms_norm(load(D + 'ice_4.mp3'), -24), AT[17] - 0.2, 0, fade_out=1.5)
# no air, no sound: nothing after this point
sfx[int(AIRLESS * SR):] = 0

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
open(B + 'voice-data.js', 'w').write('/* generated by films/blackhole/mix.py */\nwindow.VOICE = { file: "films/blackhole/audio/voice_sfx.mp3", wav: "films/blackhole/audio/voice_sfx.wav", segments: '
                                     + json.dumps([[round(a, 2), round(b, 2)] for a, b in merged]) + ' };\n')
vr = 20 * np.log10(np.sqrt(np.mean(voice[voice != 0] ** 2)) + 1e-9)
for a, b in [(0, AT[9]), (AT[9], C['throw'] + 2), (AT[13], AT[23]), (AT[23], C['cut'])]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('voice rms', round(float(vr), 1), 'dB; peak', round(float(peak), 3))
