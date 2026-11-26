// End-to-end check on a REAL X11 desktop with real audio devices (not part of `npm test`): screenshots, recording with audio,
// toolbar exclusion, live ink in a recording, annotate editor save. It briefly shows Frameo windows on your screen.
//   node_modules/.bin/electron --no-sandbox test/e2e-real.js --hidden
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path'); const cp = require('child_process');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-e2e-ud-'))); // never touch the real settings.json
const { Notification } = require('electron'); let notes = 0; const realShow = Notification.prototype.show; Notification.prototype.show = function () { notes++; return realShow.apply(this, arguments); }; // count desktop notifications (they would be drawn into a recording)
const m = require('../src/main.js'); const settings = require('../src/settings.js'); const system = require('../src/system.js'); const live = require('../src/live.js'); const editor = require('../src/editor.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const log = (...a) => console.log('[e2e]', ...a);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-e2e-')); let fails = 0;
const ok = (c, n, extra = '') => { log(c ? 'ok  ' : 'FAIL', n, extra); if (!c) fails++; };
const probe = (f, e) => cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', e, '-of', 'csv=p=0', f]).toString().trim();
/* count strongly red pixels (the live ink colour #E5484D) in a PNG via ffmpeg */
function redPixels(png) {
  const raw = cp.execFileSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  let n = 0; for (let i = 0; i < raw.length; i += 3) if (raw[i] > 200 && raw[i + 1] < 110 && raw[i + 2] < 110) n++; return n;
}
const mouse = (wc, type, x, y) => wc.sendInputEvent({ type, x, y, button: 'left', clickCount: 1, modifiers: type === 'mouseUp' ? [] : ['leftButtonDown'] }); // moves need leftButtonDown to count as a drag
app.whenReady().then(async () => {
  const env = await system.probe(); log('env', JSON.stringify({ session: env.session, ffmpeg: env.ffmpeg, helper: env.helper, mics: env.mics.length, sinks: env.sinks.length, defaultSink: env.defaultSink }));
  ok(!env.wayland && env.ffmpeg && env.helper, 'X11 + ffmpeg + helper present');
  const withMic = env.mics.length > 0;
  settings.save({ saveDir: out, cd: 0, fps: 15, audio: { sys: env.audioOk, mic: false, spk: false } });
  await sleep(2000);

  // 1. screenshots
  let r = await m.doScreenshot(null); ok(r.item && /1920x1080/.test(probe(r.item.path, 'stream=width,height').replace(',', 'x')), 'full-screen screenshot is 1920x1080', r.item ? r.item.name : JSON.stringify(r));
  r = await m.doScreenshot({ x: 100, y: 80, w: 300, h: 200 }); ok(r.item && probe(r.item.path, 'stream=width,height') === '300,200', 'region screenshot is 300x200');

  // 2. recording: toolbar mode, system audio, pause/resume, live ink
  const s = await m.startRecording({ x: 0, y: 0, w: 1280, h: 720 }); ok(s.ok && s.mode === 'toolbar', 'recording starts with the floating toolbar (canary check passed)', JSON.stringify(s));
  ok(!!m.getToolbar() && !m.getToolbar().isDestroyed(), 'toolbar window exists');
  if (env.audioOk) { const p = cp.spawn('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-f', 'pulse', 'frameo-e2e'], { stdio: 'ignore' }); p.on('error', () => {}); }
  await sleep(1500);
  r = await m.doScreenshot({ x: 0, y: 0, w: 1280, h: 720 }); const baseReds = r.item ? redPixels(r.item.path) : 0; // the desktop itself may contain red
  await m.paintToggle(); await sleep(800); // ink on: overlay captures the mouse
  const ow = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Frameo ink overlay'); ok(!!ow, 'live ink overlay window exists');
  if (ow) {
    live.send('color', '#E5484D'); live.send('width', 14); await sleep(300);
    mouse(ow.webContents, 'mouseDown', 400, 300); for (let i = 0; i <= 40; i++) { mouse(ow.webContents, 'mouseMove', 400 + i * 8, 300 + Math.round(Math.sin(i / 4) * 40)); await sleep(15); } mouse(ow.webContents, 'mouseUp', 720, 300);
    await sleep(500);
  }
  await m.paintToggle(); await sleep(500); // ink off: stays visible, click-through
  r = await m.doScreenshot({ x: 0, y: 0, w: 1280, h: 720 }); const reds = r.item ? redPixels(r.item.path) : 0;
  ok(reds > baseReds + 1500, 'live ink is present in a capture taken during recording', 'red px before=' + baseReds + ' after=' + reds);
  // one-click screenshot from the toolbar: saved silently, tick on the button, no notification
  const tbw = m.getToolbar(); const filesBefore = fs.readdirSync(out).filter((n) => /^Screenshot /.test(n)).length; notes = 0;
  await tbw.webContents.executeJavaScript('document.getElementById("shot").click()'); await sleep(1500);
  const filesAfter = fs.readdirSync(out).filter((n) => /^Screenshot /.test(n)); ok(filesAfter.length === filesBefore + 1, 'toolbar screenshot button saved one new screenshot');
  const newest = filesAfter.map((n) => path.join(out, n)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  ok(probe(newest, 'stream=width,height') === '1280,720', 'toolbar screenshot covers the recorded area (1280x720)');
  ok(notes === 0, 'no desktop notification while recording', 'notifications=' + notes);
  await tbw.webContents.executeJavaScript('document.getElementById("shot").click()');
  let tick = ''; for (let i = 0; i < 20 && tick !== 'ok'; i++) { await sleep(100); tick = await tbw.webContents.executeJavaScript('document.getElementById("shot").className'); } // the screenshot takes a moment, then the tick appears
  ok(tick === 'ok', 'toolbar button shows the green tick');
  await sleep(1500); ok(await tbw.webContents.executeJavaScript('document.getElementById("shot").className') === '', 'tick resets to the camera icon');
  await m.pauseResume(); await sleep(600); await m.pauseResume(); await sleep(1500);
  const f = await m.stopRecording() || {};
  ok(f.item && f.item.bytes > 0, 'recording saved', f.item && f.item.name);
  if (f.item) {
    ok(probe(f.item.path, 'stream=width,height').split('\n')[0] === '1280,720', 'recording is 1280x720');
    ok(parseFloat(probe(f.item.path, 'format=duration')) > 3, 'recording duration > 3 s', probe(f.item.path, 'format=duration') + 's');
    const streams = probe(f.item.path, 'stream=codec_type'); ok(env.audioOk ? /audio/.test(streams) : true, 'recording has an audio track', streams.replace(/\n/g, ','));
  }

  // 3. annotate editor: draw, save, edited copy has ink
  const plain = path.join(out, 'Screenshot 2000-01-01 00-00-00.png'); cp.execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x808080:s=1280x720', '-frames:v', '1', plain]); const before = redPixels(plain);
  const eo = editor.open(plain); ok(eo.ok, 'editor opens'); await sleep(2500);
  const ew = BrowserWindow.getAllWindows().find((w) => /Annotate/.test(w.getTitle()));
  ok(!!ew, 'editor window exists');
  if (ew) {
    const c = JSON.parse(await ew.webContents.executeJavaScript('JSON.stringify((()=>{const r=cv.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})())'));
    await ew.webContents.executeJavaScript('setColor("#E5484D");setWidth(12)');
    mouse(ew.webContents, 'mouseDown', c.x + c.w * 0.2, c.y + c.h * 0.3); for (let i = 0; i <= 30; i++) { mouse(ew.webContents, 'mouseMove', c.x + c.w * 0.2 + i * 10, c.y + c.h * 0.3 + i * 4); await sleep(15); } mouse(ew.webContents, 'mouseUp', c.x + c.w * 0.2 + 300, c.y + c.h * 0.3 + 120);
    await sleep(300); await ew.webContents.executeJavaScript('out("save")'); await sleep(1200);
    const edited = fs.readdirSync(out).find((n) => / edited\.png$/.test(n)); ok(!!edited, 'editor saved "… edited.png"', edited);
    const strokes = await ew.webContents.executeJavaScript('P.count()').catch(() => -1);
    if (edited) ok(redPixels(path.join(out, edited)) > before + 300, 'edited copy contains the drawn stroke', 'before=' + before + ' after=' + redPixels(path.join(out, edited)) + ' strokes=' + strokes);
    editor.close();
  }
  fs.rmSync(out, { recursive: true, force: true }); log(fails ? 'FAILED ' + fails : 'ALL PASS'); app.exit(fails ? 1 : 0);
}).catch((e) => { console.error('[e2e] FAIL', e); app.exit(1); });
