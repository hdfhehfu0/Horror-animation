"""Solar storm (POV): the two voices + recorded physical effects on the film's timeline -> films/storm/audio/voice_sfx.wav/.mp3
and films/storm/voice-data.js. No music of any kind. Cue times come from films/storm/core.js (evaluated with node):
the city at night from a rooftop, power lines buzzing, each transformer's bang arriving as late as it is far away
(340 m/s), the city's hum dying block by block, then the blackout: dogs, horns, distant sirens, your breathing.
The effects duck under every line so speech sits at least +12 dB over them.
usage: python3 films/storm/mix.py   (after prep_voices.py)
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/storm/'
NODE = """
global.window = global;
require('./js/core.js'); require('./films/storm/lines.js'); require('./films/storm/core.js');
const T = window.TL;
console.log(JSON.stringify({ dur: T.DURATION, hook: T.HOOK, wide: T.WIDE, pops: T.POPS, eye: T.EYE, lines: window.ST_LINES }));
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
_r = load(D + 'rooftop_1.mp3', 'highpass=f=90')
city = rms_norm(np.concatenate([_r[int(3.6 * SR):int(8.9 * SR)], _r[int(10.6 * SR):int(15.0 * SR)]]), -33)
buzz = rms_norm(load(D + 'buzz_1.mp3'), -30)
bangs = [rms_norm(load(D + f'transformer_{i}.mp3'), -22) for i in (1, 3, 4, 2)]
after = [rms_norm(load(D + f'blackout_{i}.mp3'), -36) for i in (1, 2, 3, 4)]
sirens = rms_norm(load(D + 'sirens_1.mp3', 'lowpass=f=2200'), -42)
breath = rms_norm(load(D + 'breath_2.mp3', 'highpass=f=120'), -33)

# the hook: the dark city under the full sky -- far-off dogs and horns, a breath
for i, t in enumerate(np.arange(0.0, HOOK, 1.7)): place(after[i % 4][:int(2.0 * SR)], t, -4, fade_in=0.2, fade_out=0.3)
place(breath[:int(2.4 * SR)], 0.1, -3, fade_in=0.3, fade_out=0.3)
# the city at night, its hum thinning as each district goes dark, gone once the last lights are out
bed(city, HOOK, 45.0, 0, fade_in=0.08, fade_out=1.2, env=lambda t: -14 * ramp(t, 29.0, 44.6) ** 0.7)
# power lines buzzing, louder just before things blow
for t, gn in [(27.6, -4), (32.4, -6), (35.9, -6), (39.0, -8)]: place(buzz, t, gn, fade_in=0.4, fade_out=0.4)
# every transformer: a bang and an arc, arriving at the speed of sound
ex, ey, ez = C['eye']
for i, p in enumerate(C['pops']):
    d = float(np.sqrt((p['x'] - ex) ** 2 + (p['y'] - ey) ** 2 + (p['z'] - ez) ** 2))
    clip = bangs[i % 4][:int(0.62 * SR)] if i == 0 else bangs[i % 4]          # the first one is cut short: your own startled line follows it
    place(clip, p['t'] + d / 340.0, float(np.clip(-20 * np.log10(d / 160.0), -14, 0)) + 4 * (p['big'] - 0.8), fade_out=0.25)
# the blackout: dogs, horns, people far below, layered from short takes so nothing loops audibly
rng = np.random.default_rng(7)
t = 40.5
while t < DUR - 0.5:
    place(after[int(rng.integers(0, 4))][:int(2.0 * SR)], t, float(rng.uniform(-9, -1) + 4 * ramp(t, 40.5, 46)), fade_in=0.25, fade_out=0.35)
    t += float(rng.uniform(0.9, 1.6))
bed(sirens, 44.0, DUR, 0, fade_in=3.0, fade_out=1.0)
# your breathing: the phone, and looking up
bed(breath, 42.2, 50.5, 0, fade_in=1.0, fade_out=1.0)

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
open(B + 'voice-data.js', 'w').write('/* generated by films/storm/mix.py */\nwindow.VOICE = { file: "films/storm/audio/voice_sfx.mp3", wav: "films/storm/audio/voice_sfx.wav", segments: '
                                     + json.dumps([[l[0], l[1]] for l in C['lines']]) + ' };\n')
# speech over effects, line by line (the standard: at least +12 dB)
sc = 1.0 if peak <= 0.97 else 0.97 / peak
for a, b, who, text in C['lines']:
    v = voice[int(a * SR):int(b * SR)] * sc; s = sfx[int(a * SR):int(b * SR)] * sc
    v = v[np.abs(v) > 1e-4]
    vr, sr_ = 20 * np.log10(np.sqrt(np.mean(v ** 2)) + 1e-9), 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)
    print(f'{a:5.1f}-{b:5.1f} {who:6s} voice {vr:6.1f} dB  sfx {sr_:6.1f} dB  margin {vr - sr_:+5.1f} dB  {"OK" if vr - sr_ >= 12 else "LOW"}')
for a, b in [(0, HOOK), (HOOK, 29), (29, 44.5), (44.5, 50), (50, 56.2), (56.2, DUR)]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('peak', round(float(peak), 3))
