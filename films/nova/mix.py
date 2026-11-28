"""Betelgeuse (POV): the two voices + recorded physical effects on the film's timeline -> films/nova/audio/voice_sfx.wav/.mp3
and films/nova/voice-data.js. No music of any kind. Cue times follow films/nova/core.js: the fire and a quiet mantel clock
indoors, the floorboards as you stand and cross to the window, two mugs set on the sill, your friend's steps to the door,
its latch and hinge, snow under his boots ahead of you and under yours; outside it is nearly silent -- your breath, the
fire far behind you through the open door. The countdown is only breath. The supernova makes no sound (nothing would reach
you): at the flash you catch your breath. The effects duck under every line so speech sits at least +12 dB over them.
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

# ---- the hook: outside under Orion, almost silent; your breath in the cold
bed(breath, 0.0, HOOK, -2, fade_in=0.05, fade_out=0.08)
# ---- indoors: the fire, close and warm; a little further from it at the window; it falls away as you go out
bed(fireBed, HOOK, 31.8, 0, fade_in=0.06, fade_out=1.6, env=lambda t: -2 * ramp(t, 5.5, 7.5) - 3 * ramp(t, 28.8, 31.5))
t = HOOK + 0.4
while t < 30.0:                                                            # crackles and pops, never on top of each other
    p = pops[rng.integers(len(pops))]; place(p, t, float(rng.uniform(-4, 0)) - (2 if t > 7.5 else 0), fade_out=0.08); t += float(rng.uniform(1.2, 3.4))
for k, tt in enumerate(np.arange(HOOK + 0.3, 29.0, 1.0)):                  # the mantel clock, quietly
    place(ticks[k % 2], float(tt), -9 if tt < 7.5 else -12, fade_out=0.02)
# you stand and cross to the window
place(floor, 4.7, -4, fade_out=0.2); place(floor, 5.8, -5, fade_out=0.2); place(floor, 6.9, -6, fade_out=0.2)
mug = load(D + 'mug_1.mp3', 'highpass=f=80'); on = int(np.argmax(np.abs(mug) > 0.25 * np.abs(mug).max())); mug = peak_norm(mug[max(0, on - int(0.02 * SR)):on + int(0.5 * SR)], -17)
place(mug, 18.95, 0, fade_in=0.005, fade_out=0.15)                              # your mug on the sill
place(pitch(mug, 1.08), 26.95, -2, fade_in=0.005, fade_out=0.15)                # his, beside it
# his steps to the door; the latch; the hinge as he pushes it open; your steps after him
place(floor, 27.8, -9, fade_out=0.25); place(floor, 28.5, -10, fade_out=0.25)
place(latch, 28.6, -8); place(creak, 28.85, -10, fade_in=0.05, fade_out=0.3)
place(floor, 29.2, -5, fade_out=0.2); place(floor, 30.0, -6, fade_out=0.2)
place(creak, 30.95, -12, fade_in=0.05, fade_out=0.3)                             # your hand pushes it a little wider
# ---- outside: snow under his boots ahead of you, and under yours; then stillness
for tt in np.arange(29.95, 35.1, 0.64):
    place(pitch(snow, float(rng.uniform(0.95, 1.1))), float(tt), float(rng.uniform(-10, -8)), fade_out=0.06)
for tt in np.arange(31.55, 36.0, 0.6):
    place(pitch(snow, float(rng.uniform(0.9, 1.12))), float(tt), float(rng.uniform(-3, 0)), fade_out=0.06)
bed(fireFar, 29.0, DUR, 0, fade_in=1.5, fade_out=2.0, env=lambda t: -8 * ramp(t, 32.0, 37.0) - 6 * ramp(t, 52.0, 55.0))
bed(breath, 31.5, 53.5, 0, fade_in=1.5, fade_out=1.0, env=lambda t: -2 * ramp(t, 41.0, 44.5) - 3 * ramp(t, 48, 53))
# the flash: you catch your breath
w2 = int(0.7 * SR); bb = load(D + 'breath_2.mp3', 'highpass=f=150,lowpass=f=6000')
env = np.convolve(bb ** 2, np.ones(w2) / w2, 'valid'); i0 = int(np.argmax(env)); gasp = peak_norm(bb[i0:i0 + w2], -16)
place(gasp, ZERO + 0.12, -2, fade_in=0.02, fade_out=0.25)
for tt in (46.95, 47.6):                                                       # you turn round in the snow
    place(pitch(snow, 1.25), tt, -8, fade_out=0.05)
for tt in (50.25, 50.95):                                                      # and back
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
for a, b in [(0, HOOK), (HOOK, 27.5), (27.5, 31.5), (31.5, 36), (36, ZERO), (ZERO, C['wide']), (C['wide'], DUR)]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('peak', round(float(peak), 3))
