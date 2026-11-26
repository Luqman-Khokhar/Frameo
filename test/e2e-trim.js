// Trimmer window test: opens the real window on a generated video and drives it like a user. Needs an X display (xvfb-run works).
//   node_modules/.bin/electron --no-sandbox test/e2e-trim.js --hidden
const { app } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path'); const cp = require('child_process');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-trim-ud-')));
const settings = require('../src/settings'); const trimmer = require('../src/trimmer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const log = (...a) => console.log('[trim]', ...a);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-trim-e2e-')); const outDir = path.join(dir, 'out'); let fails = 0;
const ok = (c, n, extra = '') => { log(c ? 'ok  ' : 'FAIL', n, extra); if (!c) fails++; };
const dur = (f) => parseFloat(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const outs = () => (fs.existsSync(outDir) ? fs.readdirSync(outDir).map((n) => path.join(outDir, n)) : []);
const src = path.join(dir, 'Recording 2026-01-01 10-00-00.mp4');
cp.execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '30', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50', '-keyint_min', '50', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src]);
const srcSize = fs.statSync(src).size;
app.whenReady().then(async () => {
  settings.save({ theme: 'light' });
  let blocked = 'recording'; const done = [];
  ok(trimmer.open(src, { outDir, canRun: () => blocked, onDone: (d) => done.push(d) }).ok, 'trimmer opens');
  await sleep(800); const w = trimmer.getWindow(); const js = (x) => w.webContents.executeJavaScript(x);
  for (let i = 0; i < 60 && !(await js('T.loaded && T.keys.length > 5')); i++) await sleep(250);
  ok(await js('T.loaded'), 'video info loaded', 'duration=' + (await js('T.dur')).toFixed(1)); ok((await js('T.keys.length')) >= 14, 'keyframes loaded', String(await js('T.keys.length')));
  const waitPlan = async () => { await sleep(350); };
  const waitDone = async () => { for (let i = 0; i < 120; i++) { if (await js('!!document.querySelector("[data-ov=reveal]") || !!document.querySelector("[data-ov=retry]")')) return; await sleep(250); } };

  // split: drag the right handle with real mouse events
  await js('T.r.split=[[6,16]]; renderAll(); replan()'); await waitPlan();
  const hr = JSON.parse(await js('JSON.stringify((()=>{const r=document.querySelector(".rng i.r").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})())'));
  const mouse = (type, x, y) => w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, modifiers: type === 'mouseUp' ? [] : ['leftButtonDown'] });
  mouse('mouseDown', hr.x, hr.y); for (let i = 1; i <= 10; i++) { mouse('mouseMove', hr.x - i * 8, hr.y); await sleep(15); } mouse('mouseUp', hr.x - 80, hr.y); await sleep(400);
  const dragged = await js('T.r.split[0][1]'); ok(dragged < 16 - 1 && dragged > 6, 'dragging the end handle shortens the range', dragged.toFixed(2));
  await js('T.r.split=[[6,16]]; renderAll(); replan()'); await waitPlan();
  ok(/Saves 00:10 of 00:30/.test(await js('document.getElementById("foot").textContent')), 'footer summarises the split', await js('document.getElementById("foot").textContent'));

  // time fields
  await js('(()=>{const i=document.querySelector("input[data-e=\\"0\\"]"); i.value="0:07.5"; i.dispatchEvent(new Event("change",{bubbles:true}))})()'); await sleep(200);
  ok(Math.abs((await js('T.r.split[0][0]')) - 7.5) < 0.01, 'editing the FROM field moves the start'); await js('T.r.split=[[6,16]]; renderAll(); replan()'); await waitPlan();

  // export guarded while "recording"
  await js('doExport()'); await waitDone(); ok(await js('!!document.querySelector("[data-ov=retry]")'), 'export refused while a recording is running'); await js('document.querySelector("[data-ov=close]").click()');
  blocked = null;

  // lossless split export
  await js('doExport()'); await waitDone(); let o = outs();
  ok(o.length === 1 && /\(split\)\.mp4$/.test(o[0]) && Math.abs(dur(o[0]) - 10) < 0.5, 'lossless split saved beside the chosen folder', o.map((x) => path.basename(x) + ' ' + dur(x).toFixed(2) + 's').join());
  ok(await js('!!document.querySelector("[data-ov=reveal]")'), 'done screen offers Reveal / Open'); await js('document.querySelector("[data-ov=close]").click()');

  // trim mode: keyboard + two removed parts
  await js('setMode("trim")'); ok(await js('T.r.trim.length') === 0, 'trim starts with nothing marked');
  await js('addRange(3,7); addRange(20,24)'); await waitPlan();
  ok(/Result 00:21|Result 00:22/.test(await js('document.getElementById("foot").textContent')), 'footer summarises the trim', await js('document.getElementById("foot").textContent'));
  w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'R' }); w.webContents.sendInputEvent({ type: 'char', keyCode: 'r' }); await sleep(300);
  ok((await js('T.r.trim.length')) === 3, 'R adds a part to remove'); w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Delete' }); await sleep(300); ok((await js('T.r.trim.length')) === 2, 'Delete removes the selected part');
  await waitPlan(); await js('doExport()'); await waitDone(); o = outs().filter((x) => /\(trim\)/.test(x));
  ok(o.length === 1 && Math.abs(dur(o[0]) - 21) < 0.7, 'lossless trim saved', o.map((x) => dur(x).toFixed(2)).join());
  await js('document.querySelector("[data-ov=close]").click()');

  // frame-accurate
  await js('setMode("split"); T.r.split=[[5.3,12.7]]; renderAll()'); await js('document.getElementById("precise").click()'); await waitPlan();
  ok(await js('T.plan.precise === true && T.plan.snapped === false'), 'frame-accurate keeps the exact start');
  await js('doExport()'); await waitDone(); o = outs().filter((x) => /\(split\)/.test(x)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  ok(Math.abs(dur(o[0]) - 7.4) < 0.15, 'frame-accurate split is 7.4 s', dur(o[0]).toFixed(2)); await js('document.querySelector("[data-ov=close]").click()');

  // cancel
  const before = outs().length; await js('setMode("trim"); T.r.trim=[[10,11]]; renderAll(); replan()'); await waitPlan();
  await js('doExport()'); await sleep(250); await js('document.querySelector("[data-ov=cancel]").click()'); await sleep(1500);
  ok(outs().length === before && await js('document.getElementById("ov").hidden'), 'cancel stops the export and saves nothing');
  ok(fs.statSync(src).size === srcSize, 'original video untouched');

  // out of screenshots: hide / restore
  trimmer.hide(); ok(!w.isVisible(), 'hidden for captures'); trimmer.restore(); ok(w.isVisible(), 'restored after captures');
  ok(done.length >= 3, 'onDone callback fired for exports', String(done.length));
  trimmer.close(); fs.rmSync(dir, { recursive: true, force: true }); log(fails ? 'FAILED ' + fails : 'ALL PASS'); app.exit(fails ? 1 : 0);
}).catch((e) => { console.error('[trim] FAIL', e); app.exit(1); });
