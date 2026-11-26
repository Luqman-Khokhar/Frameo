// Multi-screen wiring test on the real X11 desktop: the one physical screen is split into two LOGICAL displays
// (left/right halves) by faking Electron's screen API, so every capture surface can be checked without a second monitor.
//   node_modules/.bin/electron --no-sandbox test/e2e-multiscreen.js
const { app, screen } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path'); const cp = require('child_process');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-ms-ud-')));
let m, settings, W, H, half, fake; // set up after 'ready': Electron's screen module cannot be used earlier
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const log = (...a) => console.log('[ms]', ...a);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-ms-')); let fails = 0;
const ok = (c, n, extra = '') => { log(c ? 'ok  ' : 'FAIL', n, extra); if (!c) fails++; };
const dims = (f) => cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split('\n')[0];
const psnr = (a, b) => { const o = cp.spawnSync('ffmpeg', ['-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' }).stderr; const x = /average:([\d.]+|inf)/.exec(o); return x ? (x[1] === 'inf' ? 99 : parseFloat(x[1])) : 0; };
app.whenReady().then(async () => {
  const real = screen.getPrimaryDisplay(); W = real.bounds.width; H = real.bounds.height; half = Math.floor(W / 2);
  const mk = (id, x, w) => ({ id, scaleFactor: real.scaleFactor, bounds: { x, y: 0, width: w, height: H }, workArea: { x, y: 0, width: w, height: H - 40 } });
  fake = [mk(11, 0, half), mk(22, half, W - half)];
  screen.getAllDisplays = () => fake; screen.getPrimaryDisplay = () => fake[0];
  m = require('../src/main.js'); settings = require('../src/settings.js');
  settings.save({ saveDir: out, cd: 0, fps: 15, audio: { sys: false, mic: false, spk: false } }); await sleep(2500);
  const w = m.getMain(); const js = (x) => w.webContents.executeJavaScript(x);
  ok((await js('S.displays.length')) === 2, 'renderer receives 2 displays', JSON.stringify(await js('S.displays.map(d=>d.label)')));
  ok(await js('!!document.getElementById("screenSel")'), 'Screen picker is shown with 2 displays');
  const shot = async (choice) => { settings.save({ screen: choice }); const r = await m.doScreenshot(null); return r.item && r.item.path; };
  const all = await shot('all'), left = await shot('11'), right = await shot('22');
  ok(dims(all) === `${W},${H}`, 'All screens = whole desktop', dims(all));
  ok(dims(left) === `${half & ~1},${H}`, 'Screen 1 full capture = left half', dims(left));
  ok(dims(right) === `${(W - half) & ~1},${H}`, 'Screen 2 full capture = right half', dims(right));
  const cropR = path.join(out, 'crop-right.png'); cp.execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', all, '-vf', `crop=${(W - half) & ~1}:${H}:${half}:0`, cropR]);
  ok(psnr(right, cropR) > 25, 'Screen 2 capture matches the right half of the desktop', 'psnr=' + psnr(right, cropR).toFixed(1));
  settings.save({ screen: '22' });
  const s = await m.startRecording(null); ok(s.ok, 'recording on Screen 2 starts', JSON.stringify(s));
  const tb = m.getToolbar().getBounds(); ok(tb.x >= half && tb.x + tb.width <= W, 'toolbar sits on Screen 2', JSON.stringify(tb));
  await sleep(2500); const f = await m.stopRecording() || {};
  ok(f.item && dims(f.item.path) === `${(W - half) & ~1},${H}`, 'recording of Screen 2 has Screen 2 dimensions', f.item && dims(f.item.path));
  const fb = await shot('999'); ok(fb && dims(fb) === `${half & ~1},${H}`, 'unknown display id falls back to the primary display');
  fs.rmSync(out, { recursive: true, force: true }); log(fails ? 'FAILED ' + fails : 'ALL PASS'); app.exit(fails ? 1 : 0);
}).catch((e) => { console.error('[ms] FAIL', e); app.exit(1); });
