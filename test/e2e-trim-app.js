// Trim & split wired into the app: entry points, output location policy, recording/export guards, recents refresh.
//   node_modules/.bin/electron --no-sandbox test/e2e-trim-app.js     (needs an X display; xvfb-run works)
const { app } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path'); const cp = require('child_process');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-tapp-ud-')));
const m = require('../src/main.js'); const settings = require('../src/settings.js'); const trimmer = require('../src/trimmer.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const log = (...a) => console.log('[trim-app]', ...a);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-tapp-')); const save = path.join(root, 'save'), cmpDir = path.join(root, 'cmp'), ext = path.join(root, 'elsewhere');
for (const d of [save, cmpDir, ext]) fs.mkdirSync(d);
const mk = (file, secs) => cp.execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', String(secs), '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file]);
const managed = path.join(save, 'Recording 2026-01-01 10-00-00.mp4'), foreign = path.join(ext, 'holiday.mp4'); mk(managed, 12); mk(foreign, 12);
let fails = 0; const ok = (c, n, extra = '') => { log(c ? 'ok  ' : 'FAIL', n, extra); if (!c) fails++; };
const waitFor = async (f, ms = 15000) => { for (let i = 0; i < ms / 200; i++) { try { if (await f()) return true; } catch (e) { /* retry */ } await sleep(200); } return false; };
app.whenReady().then(async () => {
  settings.save({ saveDir: save, compressDir: cmpDir, cd: 0, fps: 15, audio: { sys: false, mic: false, spk: false } }); await sleep(2500);
  const w = m.getMain(); const js = (x) => w.webContents.executeJavaScript(x);
  await js('refreshRecents().then(render)'); await sleep(900);
  ok(await js('!!document.querySelector("[data-act=trim-pick]")'), 'header has the "Trim a video…" button');
  ok(await js('!!document.querySelector("[data-act=trim-row]")'), 'recording rows have a scissors button');
  await js('S.preview=S.recents.find(r=>r.kind==="rec");renderPreview()'); await sleep(500);
  ok(await js('!!document.querySelector("[data-act=pv-trim]")'), 'recording preview has a Trim button'); await js('S.preview=null;renderPreview()');

  // entry via the row button: managed file -> results beside it
  await js('document.querySelector("[data-act=trim-row]").click()');
  ok(await waitFor(() => trimmer.isOpen() && trimmer.getWindow().webContents.executeJavaScript('T.loaded')), 'scissors button opens the trimmer window');
  let tw = trimmer.getWindow(); const tjs = (x) => tw.webContents.executeJavaScript(x);
  ok((await tjs('T.outDir')) === save, 'managed recording: output goes beside the source', await tjs('T.outDir'));

  // export -> main window refreshes its Recent list
  await tjs('T.r.split=[[2,8]]; renderAll(); replan()'); await sleep(500); await tjs('doExport()');
  ok(await waitFor(() => tjs('!!document.querySelector("[data-ov=reveal]")'), 30000), 'export finishes');
  ok(await waitFor(() => js('S.recents.some(r=>/\\(split\\)/.test(r.name))')), 'Recent list refreshes with the new "(split)" video', await js('S.recents.map(r=>r.name).join(" | ")'));
  trimmer.close(); await sleep(500);

  // foreign file (not picked): output goes to the Compress folder, never beside it
  ok((await js(`frameo.trimOpen(${JSON.stringify(foreign)})`)).ok, 'an external video opens'); await waitFor(() => trimmer.getWindow().webContents.executeJavaScript('T.loaded')); tw = trimmer.getWindow();
  ok((await tjs('T.outDir')) === cmpDir, 'unpicked external video: output goes to the Compress folder', await tjs('T.outDir'));
  trimmer.close(); await sleep(500);

  // validation
  ok((await js(`frameo.trimOpen('/etc/passwd')`)).error === 'file', 'non-video path rejected'); ok((await js(`frameo.trimOpen(${JSON.stringify(path.join(root, 'nope.mp4'))})`)).error === 'file', 'missing file rejected'); ok((await js('frameo.trimOpen(5)')).error === 'file', 'bad type rejected');

  // guards: recording blocks opening; a running export blocks recording
  const s = await m.startRecording({ x: 0, y: 0, w: 320, h: 240 }); ok(s.ok, 'recording starts');
  ok((await js(`frameo.trimOpen(${JSON.stringify(managed)})`)).error === 'recording', 'cannot open the trimmer while recording'); await m.stopRecording(); await sleep(500);
  const long = path.join(save, 'Recording 2026-01-02 10-00-00.mp4'); mk(long, 60); await js('refreshRecents()');
  ok((await js(`frameo.trimOpen(${JSON.stringify(long)})`)).ok, 'opens a longer video'); await waitFor(() => trimmer.getWindow().webContents.executeJavaScript('T.loaded')); tw = trimmer.getWindow();
  await tjs('document.getElementById("precise").click(); T.r.split=[[1,59]]; renderAll(); replan()'); await sleep(500); await tjs('doExport()'); await sleep(600);
  ok(trimmer.busy(), 'export is running'); const r = await m.startRecording({ x: 0, y: 0, w: 320, h: 240 }); ok(r.error === 'compressing', 'recording is blocked while an export runs', JSON.stringify(r));
  await tjs('document.querySelector("[data-ov=cancel]").click()'); await sleep(1500); ok(!trimmer.busy(), 'cancel ends the export');
  trimmer.close(); fs.rmSync(root, { recursive: true, force: true }); log(fails ? 'FAILED ' + fails : 'ALL PASS'); app.exit(fails ? 1 : 0);
}).catch((e) => { console.error('[trim-app] FAIL', e); app.exit(1); });
