// Recorder failure test: electron --no-sandbox test/rec-fail.js --hidden   (needs an X display, ffmpeg, built xcap)
const { app } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path'); const cp = require('child_process');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-rf-ud-'))); // never touch the real settings.json
const m = require('../src/main.js'); const settings = require('../src/settings.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const log = (...a) => console.log('[rec-fail]', ...a);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-rf-')); let fails = 0;
const ok = (c, n) => { log(c ? 'ok  ' : 'FAIL', n); if (!c) fails++; };
const kids = (name) => { try { return cp.execFileSync('pgrep', ['-P', String(process.pid), '-x', name]).toString().trim().split('\n').filter(Boolean); } catch (e) { return []; } };
app.whenReady().then(async () => {
  settings.save({ saveDir: out, cd: 0, fps: 15, audio: { sys: false, mic: false, spk: false } });
  let reason = null; m.rec.on('failed', (w) => { reason = w; });
  const s = await m.startRecording({ x: 50, y: 50, w: 320, h: 240 }); ok(s && s.ok, 'recording started');
  await sleep(1500);
  const ff = kids('ffmpeg'); ok(ff.length === 1, 'one ffmpeg child'); cp.execSync('kill -9 ' + ff[0]);
  for (let i = 0; i < 40 && !reason; i++) await sleep(250);
  ok(!!reason, 'failed event fired: ' + reason);
  for (let i = 0; i < 40 && m.rec.active; i++) await sleep(250);
  ok(!m.rec.active, 'recorder stopped itself after failure');
  for (let i = 0; i < 20 && (kids('xcap').length || kids('ffmpeg').length); i++) await sleep(250); log('left:', kids('xcap').join(','), kids('ffmpeg').join(',')); ok(kids('xcap').length === 0 && kids('ffmpeg').length === 0, 'no orphan helper/ffmpeg');
  log('files:', fs.readdirSync(out).join(', ') || '(none)');
  // second run: clean stop still works
  const s2 = await m.startRecording({ x: 50, y: 50, w: 320, h: 240 }); ok(s2 && s2.ok, 'recording restarted');
  await sleep(1500); const r = await m.stopRecording(); ok(r && r.item && r.item.bytes > 0 && r.item.dur >= 1, 'clean stop saved a playable file');
  fs.rmSync(out, { recursive: true, force: true }); log(fails ? 'FAILED ' + fails : 'ALL PASS'); app.exit(fails ? 1 : 0);
}).catch((e) => { console.error('[rec-fail] FAIL', e); app.exit(1); });
