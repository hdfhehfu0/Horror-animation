"""Betelgeuse (POV): the two voices + recorded physical effects on the film's timeline -> films/nova/audio/voice_sfx.wav/.mp3
and films/nova/voice-data.js. No music of any kind. Cue times follow films/nova/core.js: the fire and the mantel clock
indoors (the clock ticks the countdown down and lands on zero), floorboards, the door your friend opens, snow under your
boots, your breath in the cold; outside it is nearly silent, with the fire far behind you through the open door. The
supernova itself makes no sound -- nothing would reach you. The effects duck under every line so speech sits at least
+12 dB over them.
usage: python3 films/nova/mix.py   (after prep_voices.py)
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/nova/'
NODE = """
global.window = global;
require('./js/core.js'); require('./films/nova/lines.js'); require('./films/nova/core.js');
const T = window.TL;
console.log(JSON.stringify({ dur: T.DURATION, hook: T.HOOK, zero: T.ZERO, wide: T.WIDE, lines: window.NV_LINES }));
"""
C = json.loads(subprocess.run(['node', '-e', NODE], capture_output=True, check=True, text=True).stdout)
DUR, HOOK, ZERO = C['dur'], C['hook'], C['zero']
rng = np.random.default_rng(20261127)

def load(path, af=None):
    cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).copy()
def rms_norm(x, db):
    r = np.sqrt(np.mean(x ** 2)); return x if r < 1e-9 else x * (10 ** (db / 20) / r)
def peak_norm(x, db):
    p = np.abs(x).max(); return x if p < 1e-9 else x * (10 ** (db / 20) / p)
sfx = np.zeros(int((DUR + 5) * SR), dtype=np.float32)
def place(x, t, gain_db=0.0, fade_in=0.01, fade_out=0.05):
    x = x.copy()
    fi, fo = min(len(x) // 2, int(fade_in * SR)), min(len(x) // 2, int(fade_out * SR))
    if fi: x[:fi] *= np.linspace(0, 1, fi)
    if fo: x[-fo:] *= np.linspace(1, 0, fo)
    s = int(t * SR); sfx[s:s + len(x)] += x[:len(sfx) - s] * 10 ** (gain_db / 20)
def bed(clip, t0, t1, db, fade_in=0.4, fade_out=0.15, env=None, xf=0.3):
    """loop `clip` from t0 to t1 with crossfades; env(t) -> extra gain in dB"""
    t = t0
    while t < t1:
        n = int(min(len(clip), (t1 - t) * SR)); seg = clip[:n].copy()
        if env is not None: seg *= 10 ** (np.array([env(t + i / SR) for i in range(0, n, 441)]).repeat(441)[:n] / 20)
        place(seg, t, db, fade_in=fade_in if t == t0 else xf, fade_out=fade_out if t + n / SR >= t1 - 1e-3 else xf)
        t += len(clip) / SR - xf
def cut(x, a, b): return x[int(a * SR):int(b * SR)].copy()
def pitch(x, k):   # resample: k > 1 higher and shorter
    idx = np.arange(0, len(x) - 1, k); return np.interp(idx, np.arange(len(x)), x).astype(np.float32)
D = B + 'audio/sfx/'
ramp = lambda t, a, b: min(1.0, max(0.0, (t - a) / (b - a)))

# ---- the sounds
fire3 = load(D + 'fire_3.mp3', 'highpass=f=60')
fireBed = rms_norm(cut(fire3, 0.0, 5.4), -27)                              # the steady stretch of the long take
pops = [peak_norm(cut(load(D + f), a, b), db - 1) for f, a, b, db in
        [('fire_1.mp3', 0.4, 1.0, -18), ('fire_2.mp3', 0.0, 0.5, -17), ('fire_5.mp3', 0.0, 0.4, -17), ('fire_4.mp3', 0.0, 0.3, -18), ('fire_3.mp3', 3.5, 3.8, -18), ('fire_3.mp3', 4.55, 4.8, -19)]]
c2, c4 = load(D + 'clock_2.mp3'), load(D + 'clock_4.mp3')
ticks = [peak_norm(cut(c2, 0.97, 1.13), -20), peak_norm(cut(c4, 0.27, 0.43), -21)]    # tick, tock
door = load(D + 'door_1.mp3', 'highpass=f=70')
latch, creak = peak_norm(cut(door, 0.0, 0.35), -16), peak_norm(cut(door, 1.35, 2.6), -13)
floor = peak_norm(load(D + 'floor_1.mp3', 'highpass=f=60'), -16)
snow = load(D + 'snow_1.mp3', 'highpass=f=90'); snow = peak_norm(cut(snow, 0.0, 0.75), -17)
breath = rms_norm(load(D + 'breath_2.mp3', 'highpass=f=150,lowpass=f=6000'), -36)
fireFar = rms_norm(load(D + 'fire_3.mp3', 'highpass=f=60,lowpass=f=700'), -44)

# ---- the hook: outside under the new star, almost silent; your breath in the cold
bed(breath, 0.0, HOOK, -2, fade_in=0.05, fade_out=0.08)
# ---- indoors: the fire, close and warm; it falls away behind you as you go out
bed(fireBed, HOOK, 30.2, 0, fade_in=0.06, fade_out=1.6, env=lambda t: -2 * ramp(t, 12.0, 14.2) - 4 * ramp(t, 26.5, 30.0))
t = HOOK + 0.4
while t < 28.0:                                                            # crackles and pops, never on top of each other
    p = pops[rng.integers(len(pops))]; place(p, t, float(rng.uniform(-4, 0)), fade_out=0.08); t += float(rng.uniform(1.2, 3.4))
# the mantel clock: tick... tock, one a second through the countdown, landing on zero; quieter after
for k, tt in enumerate(np.arange(HOOK, 28.0, 1.0)):
    place(ticks[k % 2], float(tt), 0 if tt <= ZERO + 0.01 else -6, fade_out=0.02)
# the floor: you get up and cross to the window; your friend goes to the door; you go out
place(floor, 10.95, -4, fade_out=0.2); place(floor, 12.1, -2, fade_out=0.2)
place(floor, 16.6, -13, fade_out=0.3); place(floor, 17.9, -14, fade_out=0.3)
place(latch, 18.45, -9); place(creak, 19.75, -12, fade_in=0.05, fade_out=0.3)     # he opens the door, behind you
mug = load(D + 'mug_1.mp3', 'highpass=f=80'); on = int(np.argmax(np.abs(mug) > 0.25 * np.abs(mug).max())); mug = peak_norm(mug[max(0, on - int(0.02 * SR)):on + int(0.5 * SR)], -17)
place(mug, 23.47, 0, fade_in=0.005, fade_out=0.15)                              # your mug on the sill
place(floor, 24.9, -3, fade_out=0.2); place(floor, 26.5, -3, fade_out=0.2)
place(creak, 28.55, -9, fade_in=0.05, fade_out=0.3)                              # you push the door a little wider
# ---- outside: snow under your boots, then stillness
for k, tt in enumerate(np.arange(28.95, 31.6, 0.56)):
    sv = pitch(snow, float(rng.uniform(0.9, 1.12))); place(sv, float(tt), float(rng.uniform(-3, 0)), fade_out=0.06)
bed(fireFar, 29.0, DUR, 0, fade_in=1.5, fade_out=2.0, env=lambda t: -10 * ramp(t, 31.0, 36.0) - 6 * ramp(t, 55.5, 57.5))
bed(breath, 31.0, 55.8, 0, fade_in=1.5, fade_out=1.0, env=lambda t: -3 * ramp(t, 48, 54))
for tt in (40.4, 41.2):                                                          # you turn round in the snow
    place(pitch(snow, 1.25), tt, -8, fade_out=0.05)
for tt in (44.0, 44.7):
    place(pitch(snow, 1.2), tt, -9, fade_out=0.05)

sfx = 0.3 * np.tanh(sfx / 0.3)                                                   # a gentle limiter on the effects bus
voice = load(B + 'audio/voice.wav')
# duck the effects under the voices, and lift the voices a little
w = int(0.05 * SR); nv = min(len(voice), len(sfx)); e = np.sqrt(np.convolve(voice[:nv] ** 2, np.ones(w) / w, 'same'))
act = (e > 10 ** (-40 / 20)).astype(np.float32); k = np.hanning(int(0.3 * SR)); act = np.minimum(1, np.convolve(act, k / k.sum() * 3, 'same'))
sfx[:nv] *= 1 - 0.72 * act
voice = voice * 1.41
# the last second fades to nothing
f0, f1 = int((DUR - 1.1) * SR), int((DUR - 0.05) * SR)
sfx[f0:f1] *= np.linspace(1, 0, f1 - f0); sfx[f1:] = 0
out = sfx[:int(DUR * SR)].copy()
out[:min(len(voice), len(out))] += voice[:len(out)]
peak = np.abs(out).max()
if peak > 0.97: out *= 0.97 / peak
with wave.open(B + 'audio/voice_sfx.wav', 'wb') as wv:
    wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', B + 'audio/voice_sfx.wav', '-b:a', '160k', B + 'audio/voice_sfx.mp3'], check=True)
open(B + 'voice-data.js', 'w').write('/* generated by films/nova/mix.py */\nwindow.VOICE = { file: "films/nova/audio/voice_sfx.mp3", wav: "films/nova/audio/voice_sfx.wav", segments: '
                                     + json.dumps([[l[0], l[1]] for l in C['lines']]) + ' };\n')
# speech over effects, line by line (the standard: at least +12 dB)
sc = 1.0 if peak <= 0.97 else 0.97 / peak
for a, b, who, text in C['lines']:
    v = voice[int(a * SR):int(b * SR)] * sc; s = sfx[int(a * SR):int(b * SR)] * sc
    v = v[np.abs(v) > 1e-4]
    vr, sr_ = 20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-9), 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)
    print(f'{a:5.1f}-{b:5.1f} {who:6s} voice {vr:6.1f} dB  sfx {sr_:6.1f} dB  margin {vr - sr_:+5.1f} dB  {"OK" if vr - sr_ >= 12 else "LOW"}')
for a, b in [(0, HOOK), (HOOK, ZERO + 0.5), (ZERO + 0.5, 28.5), (28.5, 32), (32, 56), (56, DUR)]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('peak', round(float(peak), 3))
