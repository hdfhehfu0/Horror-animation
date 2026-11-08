/* =========================================================================
   THE HOLLOW HOUSE — app.js : player UI, live playback, exports.
   ========================================================================= */
(function () {
  'use strict';
  const { TL, Film, Sound } = window;
  const canvas = document.getElementById('film');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const isRender = new URLSearchParams(location.search).has('render');
  if (isRender) document.body.classList.add('render');

  let soundtrack = null, ac = null, src = null;
  let playing = false, t = 0, startAt = 0, startT = 0, raf = 0;

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

  /* ---------- soundtrack (rendered once, shared by all outputs) ---------- */
  const fontsReady = (document.fonts ? document.fonts.ready : Promise.resolve()).catch(() => {});
  const audioReady = Sound.renderSoundtrack(44100).then((buf) => { soundtrack = buf; $('status').textContent = ''; return buf; })
    .catch((e) => { console.error(e); $('status').textContent = 'Sound failed to render: ' + e.message; });

  function draw(time) {
    t = time;
    Film.render(ctx, t);
    if (!isRender) {
      $('time').textContent = `${fmt(t)} / ${fmt(TL.DURATION)}`;
      $('scrub').value = t;
      document.querySelectorAll('.chapters button').forEach((b) => b.classList.toggle('on', t >= +b.dataset.a && t < +b.dataset.b));
    }
  }

  function ensureAC() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function play(extraDest) {
    if (playing) return;
    if (t >= TL.DURATION - 0.05) t = 0;
    ensureAC();
    playing = true;
    $('play').textContent = '❚❚'; $('bigplay').hidden = true;
    startT = t;
    if (soundtrack) {
      src = ac.createBufferSource(); src.buffer = soundtrack;
      src.connect(ac.destination);
      if (extraDest) src.connect(extraDest);
      startAt = ac.currentTime + 0.05;
      src.start(startAt, startT);
    } else startAt = ac.currentTime;
    const loop = () => {
      if (!playing) return;
      const now = Math.max(0, ac.currentTime - startAt) + startT;
      if (now >= TL.DURATION) { draw(TL.DURATION - 0.001); stop(); onEnded(); return; }
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    loop();
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; }
    $('play').textContent = '▶';
  }
  let onEnded = () => {};
  function seek(time) { const was = playing; stop(); draw(Math.max(0, Math.min(TL.DURATION - 0.001, time))); if (was) play(); }

  /* ---------------------------- UI ---------------------------- */
  if (!isRender) {
    $('play').onclick = () => (playing ? stop() : play());
    $('bigplay').onclick = () => play();
    canvas.onclick = () => (playing ? stop() : play());
    $('scrub').oninput = (e) => seek(+e.target.value);
    $('fs').onclick = () => { const s = $('stage'); document.fullscreenElement ? document.exitFullscreen() : s.requestFullscreen?.(); };
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      if (e.code === 'Space') { e.preventDefault(); playing ? stop() : play(); }
      if (e.code === 'ArrowRight') seek(t + 2);
      if (e.code === 'ArrowLeft') seek(t - 2);
      if (e.key === 'f') $('fs').click();
    });
    const nav = $('chapters');
    TL.chapters.forEach(([a, b2, name], i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1}. ${name}`; b.dataset.a = a; b.dataset.b = b2;
      b.onclick = () => seek(a + 0.01);
      nav.appendChild(b);
    });

    const download = (blob, name) => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };
    $('wav').onclick = async () => { await audioReady; download(Sound.bufferToWav(soundtrack), 'one-minute.wav'); };
    $('srt').onclick = () => download(new Blob([toSRT()], { type: 'text/plain' }), 'one-minute.srt');
    $('png').onclick = () => canvas.toBlob((b) => download(b, `frame-${t.toFixed(2)}.png`), 'image/png');

    // Real-time recording: canvas stream + soundtrack stream -> MediaRecorder
    $('rec').onclick = async () => {
      if (!window.MediaRecorder) { alert('This browser cannot record video. Use `npm run render` instead.'); return; }
      await audioReady;
      stop(); draw(0);
      ensureAC();
      const dest = ac.createMediaStreamDestination();
      const vstream = canvas.captureStream(TL.FPS);
      const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 16_000_000, audioBitsPerSecond: 192_000 });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'video/webm';
        download(new Blob(chunks, { type }), `one-minute.${type.includes('mp4') ? 'mp4' : 'webm'}`);
        $('rec').classList.remove('recording'); $('rec').textContent = '● Record video with sound'; $('rec').disabled = false;
        $('progress').hidden = true;
      };
      $('rec').classList.add('recording'); $('rec').textContent = '● Recording… keep this tab visible'; $('rec').disabled = true;
      $('progress').hidden = false;
      const prog = setInterval(() => { $('bar').style.width = `${(t / TL.DURATION) * 100}%`; if (!playing) clearInterval(prog); }, 200);
      onEnded = () => { onEnded = () => {}; setTimeout(() => rec.state !== 'inactive' && rec.stop(), 300); };
      rec.start(1000);
      play(dest);
    };
  }

  function toSRT() {
    const ts = (s) => {
      const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
    };
    const out = [];
    TL.captions.forEach((c, i) => {
      if (!c[1]) return;
      const end = i + 1 < TL.captions.length ? TL.captions[i + 1][0] : TL.DURATION;
      out.push(`${out.length + 1}\n${ts(c[0])} --> ${ts(end)}\n${c[1].replace(/[*!]/g, '')}\n`);
    });
    return out.join('\n');
  }

  /* --------------- hooks for the offline renderer (render.js) --------------- */
  window.HH = {
    ready: Promise.all([audioReady, fontsReady]).then(() => true),
    frame(time) { Film.render(ctx, time); return true; },
    frameJPEG(time, q = 0.94) { Film.render(ctx, time); return canvas.toDataURL('image/jpeg', q); },
    async wavBase64() {
      await audioReady;
      const blob = Sound.bufferToWav(soundtrack);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; const CH = 0x8000;
      for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
      return btoa(s);
    },
    srt: toSRT,
    TL,
  };

  // poster frame (lightning over the house) until the viewer presses play
  const poster = () => { if (isRender) draw(0); else if (!playing && t === 0) Film.render(ctx, 1.4); };
  poster();
  fontsReady.then(poster);
})();
