#!/usr/bin/env node
/* Frame-accurate offline export -> out/one-minute.mp4 (H.264 + AAC)
 *
 *   npm run render                 full film, 1080x1920 (9:16) @ 30 fps
 *   node render.js --from 48 --to 56 --out out/scare.mp4     a section
 *   node render.js --stills 3.2,18,35.2,44.9,55.1            PNG stills -> out/stills/
 *
 *   node render.js --voice narration.mp3                     mix your own voiceover over the soundtrack
 *
 * Needs Node 18+, ffmpeg on PATH and Playwright (npm i -D playwright && npx playwright install chromium).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });
const url = 'file://' + path.join(ROOT, 'index.html') + '?render=1';
const WORKERS = +opt('workers', Math.max(1, Math.min(4, require('os').cpus().length)));

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => !!window.HH, null, { timeout: 60000 });
  await page.evaluate(() => window.HH.ready);
  return page;
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const first = await openPage(browser);
  const TL = await first.evaluate(() => ({ FPS: HH.TL.FPS, DURATION: HH.TL.DURATION }));

  // --- stills mode
  const stills = opt('stills');
  if (stills) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const s of stills.split(',').map(Number)) {
      const data = await first.evaluate((t) => HH.frameJPEG(t, 0.92), s);
      const f = path.join(dir, `t${s.toFixed(2)}.jpg`);
      fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
      console.log('wrote', f);
    }
    await browser.close(); return;
  }

  const from = +opt('from', 0), to = +opt('to', TL.DURATION);
  const outFile = path.resolve(opt('out', path.join(OUT, 'one-minute.mp4')));
  const voice = opt('voice');
  const fps = TL.FPS, N = Math.round((to - from) * fps);

  // --- audio + subtitles
  const wavPath = path.join(OUT, 'soundtrack.wav');
  fs.writeFileSync(wavPath, Buffer.from(await first.evaluate(() => HH.wavBase64()), 'base64'));
  fs.writeFileSync(path.join(OUT, 'one-minute.srt'), await first.evaluate(() => HH.srt()));
  console.log('soundtrack ->', wavPath);
  if (args.includes('--audio-only')) { await browser.close(); return; }

  // --- video: parallel pages render frames, written in order to ffmpeg
  const pages = [first];
  for (let i = 1; i < WORKERS; i++) pages.push(await openPage(browser));
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(from), '-t', String(to - from), '-i', wavPath,
    ...(voice ? ['-ss', String(from), '-t', String(to - from), '-i', path.resolve(voice)] : []),
    ...(voice ? ['-filter_complex', '[2:a]volume=1.6[v];[1:a][v]sidechaincompress=threshold=0.05:ratio=6:release=300[m];[m][v]amix=inputs=2:duration=first:normalize=0[a]', '-map', '0:v', '-map', '[a]'] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));

  const t0 = Date.now();
  for (let i = 0; i < N; i += pages.length) {
    const batch = pages.map((p, k) => (i + k < N ? p.evaluate((t) => HH.frameJPEG(t, 0.95), from + (i + k) / fps) : null));
    const res = await Promise.all(batch);
    for (const d of res) {
      if (!d) continue;
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    }
    if ((i / pages.length) % 30 === 0) {
      const el = (Date.now() - t0) / 1000, k = Math.min(N, i + pages.length);
      process.stdout.write(`\rframe ${k}/${N}  ${(k / el).toFixed(1)} fps  eta ${Math.round((N - k) / (k / el))}s   `);
    }
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`\ndone -> ${outFile}`);
})().catch((e) => { console.error(e); process.exit(1); });
