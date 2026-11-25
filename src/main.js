const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, shell, nativeImage, clipboard, dialog, session, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const settings = require('./settings');
const system = require('./system');
const capture = require('./capture');

app.setName('frameo');
app.commandLine.appendSwitch('class', 'frameo');
if (!app.requestSingleInstanceLock()) { app.quit(); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const asset = (n) => path.join(__dirname, '..', 'assets', n);
const R = (n) => path.join(__dirname, 'renderer', n);
const TB = { w: 236, h: 44 };
// On Linux/X11 Electron works in DIPs; physical pixels = DIPs × the display scale factor.
const toPhys = (r) => { const f = screen.getPrimaryDisplay().scaleFactor || 1; return { x: Math.round(r.x * f), y: Math.round(r.y * f), width: Math.round(r.width * f), height: Math.round(r.height * f) }; };

let mainWin = null, tray = null, toolbarWin = null, overlayWin = null, countdownWin = null;
let env = { wayland: false, ffmpeg: true, helper: true, sinks: [], mics: [], defaultSink: '' };
const rec = new capture.Recorder();
let recBase = null, recTimer = null, recMode = 'toolbar', busy = false, overlayDone = null;

/* ---------------- windows ---------------- */
function createMain() {
  mainWin = new BrowserWindow({
    width: 480, height: 690, frame: false, resizable: false, show: false, title: 'Frameo', icon: asset('icon.png'),
    backgroundColor: '#FCF0DA',
    webPreferences: { preload: R('preload-main.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(R('index.html'));
  mainWin.once('ready-to-show', () => mainWin.show());
  mainWin.on('close', (e) => { if (!app.isQuitting && settings.load().tray) { e.preventDefault(); mainWin.hide(); } });
}
function showMain() { if (!mainWin) createMain(); else { mainWin.show(); mainWin.focus(); } }
function toMain(ch, ...a) { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(ch, ...a); }
const notify = (title, body) => { try { new Notification({ title, body }).show(); } catch (e) { /* ignore */ } };

function createToolbar() {
  const wa = screen.getPrimaryDisplay().workArea;
  toolbarWin = new BrowserWindow({
    width: TB.w, height: TB.h, x: Math.round(wa.x + (wa.width - TB.w) / 2), y: Math.round(wa.y + wa.height - TB.h - 28),
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, skipTaskbar: true,
    focusable: false, hasShadow: false, alwaysOnTop: true, show: false, title: 'Frameo toolbar',
    webPreferences: { preload: R('preload-toolbar.js'), contextIsolation: true }
  });
  toolbarWin.setAlwaysOnTop(true, 'screen-saver');
  toolbarWin.loadFile(R('toolbar.html'));
  return new Promise((res) => toolbarWin.webContents.once('did-finish-load', () => { toolbarWin.showInactive(); res(); }));
}
function closeToolbar() { if (toolbarWin && !toolbarWin.isDestroyed()) toolbarWin.destroy(); toolbarWin = null; }

async function countdown(n) {
  const d = screen.getPrimaryDisplay().bounds;
  countdownWin = new BrowserWindow({ width: 220, height: 220, x: Math.round(d.x + d.width / 2 - 110), y: Math.round(d.y + d.height / 2 - 110),
    frame: false, transparent: true, skipTaskbar: true, focusable: false, hasShadow: false, alwaysOnTop: true, show: false,
    webPreferences: { preload: R('preload-toolbar.js'), contextIsolation: true } });
  countdownWin.setAlwaysOnTop(true, 'screen-saver');
  await countdownWin.loadFile(R('countdown.html'));
  countdownWin.showInactive();
  for (let i = n; i > 0; i--) { if (!countdownWin || countdownWin.isDestroyed()) return false; countdownWin.webContents.send('count', i); await sleep(1000); }
  if (countdownWin && !countdownWin.isDestroyed()) countdownWin.destroy(); countdownWin = null;
  await sleep(300);
  return true;
}

/* Region picker overlay → resolves { rect (physical px), lock, ratio } or null */
function pickRegion(init) {
  return new Promise((resolve) => {
    const d = screen.getPrimaryDisplay(); const b = d.bounds;
    overlayWin = new BrowserWindow({ x: b.x, y: b.y, width: b.width, height: b.height, frame: false, transparent: true, alwaysOnTop: true,
      skipTaskbar: true, resizable: false, movable: false, hasShadow: false, show: false, enableLargerThanScreen: true,
      webPreferences: { preload: R('preload-overlay.js'), contextIsolation: true } });
    overlayWin.setAlwaysOnTop(true, 'screen-saver');
    overlayWin.loadFile(R('overlay.html'));
    overlayWin.webContents.once('did-finish-load', () => { overlayWin.webContents.send('init', { ...init, scale: d.scaleFactor }); overlayWin.show(); overlayWin.focus(); });
    overlayDone = (res) => {
      overlayDone = null;
      if (overlayWin && !overlayWin.isDestroyed()) overlayWin.destroy();
      overlayWin = null;
      if (!res || !res.rect) return resolve(null);
      const phys = toPhys({ x: b.x + res.rect.x, y: b.y + res.rect.y, width: res.rect.w, height: res.rect.h });
      resolve({ rect: { x: phys.x, y: phys.y, w: phys.width, h: phys.height }, lock: res.lock, ratio: res.ratio });
    };
  });
}
ipcMain.handle('overlay:done', (_e, res) => { if (overlayDone) overlayDone(res); });

/* ---------------- items ---------------- */
async function itemFor(file) {
  const st = fs.statSync(file); const name = path.basename(file);
  const kind = /^Recording /.test(name) ? 'rec' : 'shot';
  const it = { path: file, name, kind, mtime: st.mtimeMs, bytes: st.size, dur: 0, thumb: '' };
  try {
    if (kind === 'shot') it.thumb = nativeImage.createFromPath(file).resize({ width: 112 }).toDataURL();
    else {
      const dir = path.join(app.getPath('userData'), 'thumbs'); fs.mkdirSync(dir, { recursive: true });
      const tp = path.join(dir, name.replace(/\.[^.]+$/, '') + '.png');
      if (!fs.existsSync(tp)) await system.run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.3', '-i', file, '-frames:v', '1', '-vf', 'scale=112:-2', tp]);
      if (fs.existsSync(tp)) it.thumb = nativeImage.createFromPath(tp).toDataURL();
      const dur = await system.run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
      it.dur = Math.round(parseFloat(dur) || 0);
    }
  } catch (e) { /* thumbnail is optional */ }
  return it;
}
async function recents() {
  const dir = settings.load().saveDir;
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => /^(Screenshot|Recording) .*\.(png|jpg|webp|mp4|webm)$/.test(n)); } catch (e) { return []; }
  const files = names.map((n) => path.join(dir, n)).map((p) => ({ p, t: fs.statSync(p).mtimeMs })).sort((a, b) => b.t - a.t).slice(0, 12);
  return Promise.all(files.map((f) => itemFor(f.p)));
}

/* ---------------- capture actions ---------------- */
const blocked = () => (env.wayland ? 'wayland' : !env.helper ? 'helper' : !env.ffmpeg ? 'ffmpeg' : busy ? 'busy' : null);
const errInfo = (e) => {
  const m = String((e && e.message) || e);
  const save = /EACCES|EROFS|ENOSPC|ENOENT|permission denied|read-only|No space/i.test(m);
  return { error: save ? 'save' : 'capture', message: m };
};

async function doScreenshot(rect) {
  const b = blocked(); if (b) return { error: b };
  busy = true;
  const st = settings.load();
  const wasVisible = mainWin && mainWin.isVisible();
  try {
    if (wasVisible && !rec.active) { mainWin.hide(); await sleep(450); } // let the WM finish fading our windows out
    fs.mkdirSync(st.saveDir, { recursive: true });
    const r = await capture.screenshot({ rect, dir: st.saveDir, fmt: st.img, base: rec.active ? recBase : null });
    const item = await itemFor(r.path);
    if (!rec.active) { showMain(); toMain('captured', item); } else notify('Screenshot saved', item.name);
    return { item };
  } catch (e) {
    if (!rec.active) showMain();
    const info = errInfo(e); toMain('capture-error', info); return info;
  } finally { busy = false; }
}

async function regionScreenshot() {
  if (blocked()) return;
  const st = settings.load();
  if (mainWin && mainWin.isVisible() && !rec.active) mainWin.hide();
  const res = await pickRegion({ mode: 'shot', rect: null, lock: false, ratio: 16 / 9, dim: st.dim, badge: st.badge, ratios: st.ratios, confirm: 'Capture' });
  if (!res) { if (!rec.active) showMain(); return; }
  return doScreenshot(res.rect);
}

async function startRecording(rectIn) {
  const b = blocked(); if (b) return { error: b };
  if (rec.active) return { error: 'busy' };
  busy = true;
  const st = settings.load();
  try {
    if (mainWin) mainWin.hide();
    const rect = rectIn ? { ...rectIn } : null;
    if (st.cd > 0) { const ok = await countdown(st.cd); if (!ok) { showMain(); return { cancelled: true }; } } else await sleep(450);
    recBase = capture.tmp('base.raw');
    const raw = capture.tmp('first.raw');
    const g = await capture.snapshotBase({ rect, baseFile: recBase, out: raw }); // all Frameo windows are hidden here
    fs.rm(raw, () => {});
    // Show the toolbar, then prove it is absent from a captured frame before recording anything.
    recMode = 'toolbar'; let note = '';
    await createToolbar(); await sleep(500);
    const phys = toPhys(toolbarWin.getBounds());
    const visible = await capture.toolbarVisible({ bounds: { x: phys.x, y: phys.y }, base: recBase });
    if (visible) { closeToolbar(); recMode = 'tray'; note = 'The floating toolbar could not be hidden from capture on this system, so controls are in the tray instead.'; }
    const audioSrcs = capture.audioSources(st.audio, env, st);
    rec.start({ rect: { x: g.x, y: g.y, w: g.w, h: g.h }, base: recBase, fps: st.fps, quality: st.quality, vid: st.vid, dir: st.saveDir, audioSrcs });
    setTray(true);
    clearInterval(recTimer);
    recTimer = setInterval(() => { const s = { ms: rec.ms(), paused: rec.paused }; if (toolbarWin && !toolbarWin.isDestroyed()) toolbarWin.webContents.send('tick', s); updateTray(); }, 500);
    if (note) notify('Recording started', note);
    return { ok: true, mode: recMode, note, audio: audioSrcs.length };
  } catch (e) {
    closeToolbar(); showMain(); const info = errInfo(e); toMain('capture-error', info); return info;
  } finally { busy = false; }
}
async function pauseResume() {
  if (!rec.active) return;
  if (rec.paused) rec.resume(); else await rec.pause();
  if (toolbarWin && !toolbarWin.isDestroyed()) toolbarWin.webContents.send('tick', { ms: rec.ms(), paused: rec.paused });
  updateTray();
}
async function stopRecording() {
  if (!rec.active) return null;
  clearInterval(recTimer); closeToolbar(); setTray(false);
  try {
    const r = await rec.stop();
    if (recBase) fs.rm(recBase, () => {}); recBase = null;
    const item = await itemFor(r.path);
    showMain(); toMain('captured', item); return { item };
  } catch (e) { showMain(); const info = errInfo(e); toMain('capture-error', info); return info; }
}

/* ---------------- tray + shortcuts ---------------- */
function setTray(recording) {
  if (!tray) return;
  tray.setImage(nativeImage.createFromPath(asset(recording ? 'tray-rec.png' : 'tray.png')).resize({ width: 22, height: 22 }));
  updateTray();
}
const fmt = (ms) => { const t = Math.floor(ms / 1000); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function updateTray() {
  if (!tray) return;
  const k = settings.load().keys; const items = [];
  if (rec.active) {
    items.push({ label: `${rec.paused ? 'Paused' : 'Recording'}  ${fmt(rec.ms())}`, enabled: false },
      { label: rec.paused ? 'Resume' : 'Pause', accelerator: k.pause, registerAccelerator: false, click: pauseResume },
      { label: 'Stop recording', accelerator: k.rec, registerAccelerator: false, click: stopRecording });
  } else {
    items.push({ label: 'Capture screen', accelerator: k.shotFull, registerAccelerator: false, click: () => doScreenshot(null) },
      { label: 'Capture region…', accelerator: k.shotRegion, registerAccelerator: false, click: regionScreenshot },
      { label: 'Record screen', accelerator: k.rec, registerAccelerator: false, click: () => startRecording(null) });
  }
  items.push({ type: 'separator' }, { label: 'Open Frameo', click: showMain }, { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(rec.active ? `Frameo — ${rec.paused ? 'paused' : 'recording'} ${fmt(rec.ms())}` : 'Frameo');
}
function registerKeys() {
  globalShortcut.unregisterAll();
  const k = settings.load().keys; const failed = [];
  const reg = (acc, fn, label) => { try { if (!globalShortcut.register(acc, fn)) failed.push(label); } catch (e) { failed.push(label); } };
  reg(k.shotFull, () => doScreenshot(null), 'shotFull');
  reg(k.shotRegion, regionScreenshot, 'shotRegion');
  reg(k.rec, () => (rec.active ? stopRecording() : startRecording(null)), 'rec');
  reg(k.pause, pauseResume, 'pause');
  return failed;
}
function setAutostart(on) {
  const dir = path.join(os.homedir(), '.config', 'autostart'); const f = path.join(dir, 'frameo.desktop');
  if (!on) { fs.rmSync(f, { force: true }); return; }
  fs.mkdirSync(dir, { recursive: true });
  const exec = process.env.APPIMAGE || process.execPath;
  fs.writeFileSync(f, `[Desktop Entry]\nType=Application\nName=Frameo\nExec="${exec}" --hidden\nX-GNOME-Autostart-enabled=true\nIcon=frameo\n`);
}

/* ---------------- IPC ---------------- */
ipcMain.handle('state', async () => {
  env = { ...env, ...(await system.probe()) };
  return { settings: settings.load(), env, recording: { active: rec.active, paused: rec.paused }, platform: process.platform };
});
ipcMain.handle('settings:save', (_e, patch) => {
  const before = settings.load(); const after = settings.save(patch);
  if (patch.launch !== undefined && patch.launch !== before.launch) setAutostart(after.launch);
  let failed = [];
  if (patch.keys) { failed = registerKeys(); updateTray(); }
  return { settings: after, failedKeys: failed };
});
ipcMain.handle('region:pick', async (_e, init) => {
  const st = settings.load();
  if (mainWin) mainWin.hide();
  const res = await pickRegion({ ...init, dim: st.dim, badge: st.badge, ratios: st.ratios });
  if (!res) showMain(); // on success the caller captures right away, so the window stays hidden
  return res;
});
ipcMain.handle('shot', (_e, rect) => doScreenshot(rect));
ipcMain.handle('rec:start', (_e, rect) => startRecording(rect));
ipcMain.handle('rec:pause', pauseResume);
ipcMain.handle('rec:resume', pauseResume);
ipcMain.handle('rec:stop', stopRecording);
ipcMain.handle('recents', recents);
ipcMain.handle('item:delete', async (_e, p) => { try { await shell.trashItem(p); return true; } catch (e) { return false; } });
ipcMain.handle('item:reveal', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('item:open', (_e, p) => shell.openPath(p));
ipcMain.handle('item:copy', (_e, p) => { clipboard.writeImage(nativeImage.createFromPath(p)); return true; });
ipcMain.handle('dir:choose', async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ['openDirectory', 'createDirectory'], defaultPath: settings.load().saveDir });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('win:min', () => mainWin && mainWin.minimize());
ipcMain.handle('win:close', () => mainWin && mainWin.close());
ipcMain.on('toolbar:pause', pauseResume);
ipcMain.on('toolbar:stop', stopRecording);

/* ---------------- lifecycle ---------------- */
app.on('second-instance', showMain);
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
  env = { ...env, ...(await system.probe()) };
  tray = new Tray(nativeImage.createFromPath(asset('tray.png')).resize({ width: 22, height: 22 }));
  tray.on('click', showMain); updateTray();
  registerKeys();
  if (!process.argv.includes('--hidden')) createMain();
});
app.on('window-all-closed', () => { /* stay in the tray */ });
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (recBase) fs.rmSync(recBase, { force: true }); });

module.exports = { doScreenshot, startRecording, pauseResume, stopRecording, regionScreenshot, rec, getMain: () => mainWin, getToolbar: () => toolbarWin, getMode: () => recMode };
