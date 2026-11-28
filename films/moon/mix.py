"""Moon (POV): the two voices + recorded ElevenLabs effects on the film's timeline -> films/moon/audio/voice_sfx.wav/.mp3
and films/moon/voice-data.js. Cue times come from films/moon/core.js (evaluated with node): the city fades as it starts to
fall, water runs in the gutter and then climbs the stairs, car alarms go off when the taxi lifts, every impact lands
as far away as the piece fell (sound takes time to arrive), the railing groans and gives, and the wind keeps rising
until the end.
usage: python3 films/moon/mix.py   (after prep_voices.py)
"""
import json, subprocess, wave
import numpy as np

SR = 44100
B = 'films/moon/'
NODE = """
global.window = global;
require('./js/core.js'); require('./films/moon/lines.js'); require('./films/moon/core.js');
const T = window.TL;
console.log(JSON.stringify({ dur: T.DURATION, meteors: T.meteors, lurch: T.lurch, lines: window.MOON_LINES }));
"""
C = json.loads(subprocess.run(['node', '-e', NODE], capture_output=True, check=True, text=True).stdout)
DUR = C['dur']

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

# the city, an ordinary afternoon -- it drains away as the Moon falls
bed(rms_norm(load(D + 'city_2.mp3'), -27), 0, 24, 0, fade_in=0.05, fade_out=2.0, env=lambda t: -16 * ramp(t, 8, 22))
# the gutter runs the wrong way; then the water comes up the stairs
bed(rms_norm(load(D + 'water_2.mp3'), -30), 10.2, 18.0, 0, fade_in=1.0, fade_out=1.5)
bed(rms_norm(load(D + 'water_4.mp3'), -24), 25.2, 33.5, 0, fade_in=1.2, fade_out=2.0, env=lambda t: -8 * ramp(t, 30, 33.5))
# car alarms, once the taxi leaves the road
bed(rms_norm(load(D + 'alarms_1.mp3'), -33), 33.6, 70, 0, fade_in=2.0, fade_out=3.0, env=lambda t: -6 * ramp(t, 60, 70))
# the pull: wind rising and a low rumble growing to the end
bed(rms_norm(load(D + 'wind_2.mp3'), -29), 28, DUR, 0, fade_in=4.0, fade_out=0.08, env=lambda t: -14 + 14 * ramp(t, 30, 80))
bed(rms_norm(load(D + 'wind_4.mp3'), -32), 64, DUR, 0, fade_in=3.0, fade_out=0.08, env=lambda t: -6 + 8 * ramp(t, 66, 84))
bed(rms_norm(load(D + 'rumble_4.mp3'), -32), 38, DUR, 0, fade_in=3.0, fade_out=0.08, env=lambda t: 6 * ramp(t, 40, 84))
# "And starts to fall": a deep hit
place(rms_norm(load(D + 'blast_3.mp3', 'lowpass=f=600'), -30), C['lurch'] - 0.02, 0, fade_out=1.5)
# every impact, delayed by how far away it landed
imp = [rms_norm(load(D + f'impacts_{i}.mp3')[:int(3.5 * SR)], -24) for i in (1, 2, 4)]
for i, m in enumerate(C['meteors']):
    d = float(np.hypot(m['x'] + 9, m['z'] + 6))
    place(imp[i % 3], m['t1'] + d / 340, float(np.clip(-6 - 18 * np.log10(d / 120) + 4 * (m['s'] - 1), -18, 0)), fade_out=1.2)
# the railing groans and gives; the jolts
place(rms_norm(load(D + 'railing_2.mp3'), -24), 70.0, 0, fade_out=0.6)
place(rms_norm(load(D + 'blast_1.mp3', 'lowpass=f=500'), -28), 66.45, 0, fade_out=1.5)
place(rms_norm(load(D + 'blast_1.mp3', 'lowpass=f=400'), -28), 71.75, 0, fade_out=1.5)
# your breathing: on the stairs, holding on, and pulled up
br = rms_norm(load(D + 'breath_2.mp3', 'highpass=f=120'), -31)
for a, b in [(20.4, 33.2), (44.6, 66.3), (72.4, DUR)]: bed(br, a, b, 0, fade_in=0.8, fade_out=0.6)

voice = load(B + 'audio/voice.wav')
# duck the effects ~8 dB under the voices, and lift the voices a little
w = int(0.05 * SR); nv = min(len(voice), len(sfx)); e = np.sqrt(np.convolve(voice[:nv] ** 2, np.ones(w) / w, 'same'))
act = (e > 10 ** (-40 / 20)).astype(np.float32); k = np.hanning(int(0.3 * SR)); act = np.minimum(1, np.convolve(act, k / k.sum() * 3, 'same'))
sfx[:nv] *= 1 - 0.6 * act
voice = voice * 1.41
cut = int((DUR - 0.08) * SR); sfx[cut:] = 0
out = sfx[:int(DUR * SR)].copy()
out[:min(len(voice), len(out))] += voice[:len(out)]
peak = np.abs(out).max()
if peak > 0.97: out *= 0.97 / peak
with wave.open(B + 'audio/voice_sfx.wav', 'wb') as wv:
    wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', B + 'audio/voice_sfx.wav', '-b:a', '160k', B + 'audio/voice_sfx.mp3'], check=True)
open(B + 'voice-data.js', 'w').write('/* generated by films/moon/mix.py */\nwindow.VOICE = { file: "films/moon/audio/voice_sfx.mp3", wav: "films/moon/audio/voice_sfx.wav", segments: '
                                     + json.dumps([[l[0], l[1]] for l in C['lines']]) + ' };\n')
vr = 20 * np.log10(np.sqrt(np.mean(voice[voice != 0] ** 2)) + 1e-9)
for a, b in [(0, 10), (10, 34), (34, 48), (48, 66), (66, 85.4)]:
    s = sfx[int(a * SR):int(b * SR)]; print(f'sfx {a:5.1f}-{b:5.1f}s rms {20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9):6.1f} dB')
print('voice rms', round(float(vr), 1), 'dB; peak', round(float(peak), 3))
