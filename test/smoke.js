// Headless smoke test: run with xvfb: electron --no-sandbox test/smoke.js
const { app } = require('electron');
const fs = require('fs'); const cp = require('child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = '/tmp/frameo-smoke'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const m = require('../src/main.js'); const settings = require('../src/settings.js');
const log = (...a) => console.log('[smoke]', ...a);
app.whenReady().then(async () => {
  settings.save({ saveDir: out, cd: 0, fps: 15, audio: { sys: false, mic: false, spk: false } });
  await sleep(2500);
  const win = m.getMain();
  const img = await win.webContents.capturePage(); fs.writeFileSync(out + '/ui-main.png', img.toPNG()); log('ui rendered', img.getSize());
  let r = await m.doScreenshot(null); log('screenshot full:', r.item ? r.item.name : r);
  r = await m.doScreenshot({ x: 100, y: 80, w: 300, h: 200 }); log('screenshot region:', r.item ? r.item.name + ' ' + r.item.bytes : r);
  const s = await m.startRecording({ x: 50, y: 50, w: 400, h: 300 }); log('rec start:', JSON.stringify(s), 'toolbar window:', !!m.getToolbar());
  await sleep(1800); await m.pauseResume(); log('paused', m.rec.paused); await sleep(600); await m.pauseResume(); await sleep(1500);
  const shot = await m.doScreenshot(null); log('screenshot during recording (toolbar up):', shot && shot.item ? shot.item.name : shot);
  const f = await m.stopRecording() || {}; log("rec stop:", f.item ? f.item.name + ' dur=' + f.item.dur + 's bytes=' + f.item.bytes : f);
  for (const n of fs.readdirSync(out)) log('file', n, fs.statSync(out + '/' + n).size);
  app.exit(0);
}).catch((e) => { console.error('[smoke] FAIL', e); app.exit(1); });
