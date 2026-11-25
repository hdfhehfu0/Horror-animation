"""Rogue planet (POV): the two voices + recorded physical effects on the film's timeline -> films/planet/audio/voice_sfx.wav/.mp3
and films/planet/voice-data.js. No music of any kind. Cue times come from films/planet/core.js (evaluated with node):
the rooftop at dusk over a harbour city, the building groaning as the pull arrives, the harbour draining, the warning
sirens, the surge coming in, the city's power failing, your breathing. The effects duck under every line so speech
sits at least +12 dB over them.
usage: python3 films/planet/mix.py   (after prep_voices.py)
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/planet/'
NODE = """
global.window = global;
require('./js/core.js'); require('./films/planet/lines.js'); require('./films/planet/core.js');
const T = window.TL;
console.log(JSON.stringify({ dur: T.DURATION, hook: T.HOOK, wide: T.WIDE, surge: T.surge, lines: window.PL_LINES }));
"""
C = json.loads(subprocess.run(['node', '-e', NODE], capture_output=True, check=True, text=True).stdout)
DUR, HOOK = C['dur'], C['hook']

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
# scene time -> film time is the identity after the hook; the hook (0..HOOK) borrows the payoff (scene 43.4..45.7)

# rooftop_1 has two loud one-off events (about 2-3 s and 9-10 s in); the bed loops only its steady stretches
_r = load(D + 'rooftop_1.mp3', 'highpass=f=90')
roof = rms_norm(np.concatenate([_r[int(3.6 * SR):int(8.9 * SR)], _r[int(10.6 * SR):int(15.0 * SR)]]), -36)
rumble = rms_norm(load(D + 'rumble_4.mp3'), -32)
sirens = rms_norm(load(D + 'sirens_1.mp3'), -34)
drain = rms_norm(load(D + 'water_4.mp3'), -31)
surge = rms_norm(load(D + 'water_2.mp3', 'lowpass=f=2500'), -30)
groan = rms_norm(load(D + 'railing_2.mp3', 'lowpass=f=1800'), -27)
blast = rms_norm(load(D + 'blast_1.mp3', 'lowpass=f=500'), -30)
breath = rms_norm(load(D + 'breath_2.mp3', 'highpass=f=120'), -32)

# the hook: the payoff a second and a half early -- sirens, the low rumble, the sea moving
bed(sirens, 0, HOOK, 0, fade_in=0.05, fade_out=0.06)
bed(rumble, 0, HOOK, -2, fade_in=0.05, fade_out=0.06)
bed(drain, 0, HOOK, -8, fade_in=0.05, fade_out=0.06)
# the rooftop at dusk: the city below, the harbour; it thins out as everything goes quiet, and dies with the power
bed(roof, HOOK, 56.0, 0, fade_in=0.08, fade_out=2.5, env=lambda t: -6 * ramp(t, 30, 40) - 14 * ramp(t, 50.5, 55.5))
# the pull arrives: a deep rumble that never leaves, the building groaning under you
bed(rumble, 27.5, DUR, 0, fade_in=2.5, fade_out=0.9, env=lambda t: -8 + 4 * ramp(t, 29, 34) + 6 * ramp(t, 44, 58))
place(groan, 29.6, 0, fade_in=0.2, fade_out=0.8)
place(groan, 42.2, -3, fade_in=0.3, fade_out=0.8)
place(groan, 52.4, 0, fade_in=0.1, fade_out=0.9)
# the harbour drains: water running out past the hulls, onto the mud
bed(drain, 33.4, 43.5, 0, fade_in=1.5, fade_out=2.0, env=lambda t: 3 * ramp(t, 34, 37) - 5 * ramp(t, 40, 43.5))
# warning sirens across the city
bed(sirens, 43.0, DUR, 0, fade_in=2.0, fade_out=0.9, env=lambda t: 3 * ramp(t, 45, 50) - 8 * ramp(t, 53, 56))
# the surge: a roar building from far out to the quay
bed(surge, 48.6, DUR, 0, fade_in=3.0, fade_out=0.9, env=lambda t: -12 + 14 * ramp(t, 49, 64))
# the power fails: transformers going one after another
for t, g in [(50.7, -4), (52.1, -2), (53.6, 0)]: place(blast, t, g, fade_out=1.4)
# your breathing, when it gets close
bed(breath, 44.5, 56.4, 0, fade_in=1.2, fade_out=0.6)

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
open(B + 'voice-data.js', 'w').write('/* generated by films/planet/mix.py */\nwindow.VOICE = { file: "films/planet/audio/voice_sfx.mp3", wav: "films/planet/audio/voice_sfx.wav", segments: '
                                     + json.dumps([[l[0], l[1]] for l in C['lines']]) + ' };\n')
# speech over effects, line by line (the standard: at least +12 dB)
sc = 1.0 if peak <= 0.97 else 0.97 / peak
for a, b, who, text in C['lines']:
    v = voice[int(a * SR):int(b * SR)] * sc; s = sfx[int(a * SR):int(b * SR)] * sc
    v = v[np.abs(v) > 1e-4]
    vr, sr_ = 20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-9), 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)
    print(f'{a:5.1f}-{b:5.1f} {who:6s} voice {vr:6.1f} dB  sfx {sr_:6.1f} dB  margin {vr - sr_:+5.1f} dB  {"OK" if vr - sr_ >= 12 else "LOW"}')
for a, b in [(0, HOOK), (HOOK, 29), (29, 43), (43, 50), (50, 56.5), (56.5, DUR)]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('peak', round(float(peak), 3))
