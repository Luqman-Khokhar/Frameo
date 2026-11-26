// Video trimmer/splitter window: Split (keep one range) and Trim (remove ranges). The window only ever works on the file it was opened with;
// the renderer never sends a path. Frameo windows must stay out of captures, so hide()/restore() mirror the annotation editor.
const { BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const settings = require('./settings');
const cut = require('./videocut');

const R = (n) => path.join(__dirname, 'renderer', 'trim', n);
let win = null, src = null, info = null, kf = [], outDir = null, job = null, result = null, hidden = false, guard = () => null, onDone = null;

const own = (e) => win && !win.isDestroyed() && e.sender === win.webContents && src;
const send = (ch, d) => { if (win && !win.isDestroyed()) win.webContents.send(ch, d); };
const urlOf = (p) => 'file://' + encodeURI(p).replace(/#/g, '%23');

async function load() {
  const file = src;
  try {
    const i = await cut.probe(file);
    if (src !== file) return;
    info = i; kf = [];
    send('info', { name: path.basename(file), url: urlOf(file), duration: i.duration, fps: i.fps, w: i.w, h: i.h, bytes: i.bytes, hasAudio: i.hasAudio, theme: settings.load().theme, outDir });
    const k = await cut.keyframes(file);
    if (src === file) { kf = k; send('keys', k); }
  } catch (e) { if (src === file) send('info', { error: e.message || 'Could not read this video.' }); }
}

/* Open the trimmer for a video file. opts.outDir = where results are saved; opts.canRun() returns a reason string when exporting is not allowed right now
   (for example while recording); opts.onDone(result) is called after a successful export. Returns { ok } or { error }. */
function open(file, opts = {}) {
  if (job) return { error: 'busy' };
  src = file; info = null; kf = []; result = null; hidden = false; outDir = opts.outDir; guard = opts.canRun || (() => null); onDone = opts.onDone || null;
  if (win && !win.isDestroyed()) { send('reset'); load(); win.show(); win.focus(); return { ok: true }; }
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const w = Math.min(980, Math.round(wa.width * 0.9)), h = Math.min(700, Math.round(wa.height * 0.9));
  win = new BrowserWindow({
    width: w, height: h, x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2), minWidth: 720, minHeight: 500,
    title: 'Frameo — Trim & split', icon: path.join(__dirname, '..', 'assets', 'icon.png'), backgroundColor: '#FCF0DA', show: false,
    webPreferences: { preload: R('preload-trim.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(R('trim.html'));
  win.webContents.once('did-finish-load', () => { load(); win.show(); });
  const me = win;
  win.on('closed', () => { if (win !== me) return; /* a newer window already replaced this one */ if (job) job.cancel(); win = null; src = null; info = null; job = null; result = null; });
  return { ok: true };
}

/* Not captured: hide before a screenshot/recording grabs the screen, restore after. */
const hide = () => { if (win && !win.isDestroyed() && win.isVisible()) { win.hide(); hidden = true; return true; } return false; };
const restore = () => { if (hidden && win && !win.isDestroyed()) win.show(); hidden = false; };
const close = () => { if (job) job.cancel(); if (win && !win.isDestroyed()) win.destroy(); };

function planFor(a) {
  try {
    const keep = cut.keepSegments(info.duration, a && a.mode, a && a.ranges);
    const pl = cut.plan(info, keep, { precise: !!(a && a.precise), keyframes: kf });
    return pl.ok ? { ok: true, plan: pl } : { ok: false, reason: pl.reason };
  } catch (e) { return { ok: false, reason: e.message }; }
}

ipcMain.handle('trim:plan', (e, a) => {
  if (!own(e) || !info) return { ok: false, reason: 'Video not loaded yet.' };
  const p = planFor(a); return p.ok ? { ok: true, segments: p.plan.segments, total: p.plan.total, estBytes: p.plan.estBytes, snapped: p.plan.snapped, precise: p.plan.precise } : p;
});

ipcMain.handle('trim:export', (e, a) => {
  if (!own(e) || !info) return { error: 'state' };
  if (job) return { error: 'busy' };
  const why = guard(); if (why) return { error: why };
  const p = planFor(a); if (!p.ok) return { error: 'plan', message: p.reason };
  try { cut.preflight(p.plan, outDir); } catch (err) { return { error: err.code === 'ENOSPC' ? 'space' : 'plan', message: err.message }; }
  const mode = a.mode, origBytes = info.bytes;
  job = cut.run(info, p.plan, mode, outDir, (pr) => send('progress', pr));
  const j = job;
  j.promise.then((r) => {
    result = r.path;
    const d = { path: r.path, name: path.basename(r.path), bytes: r.bytes, origBytes, kept: p.plan.total, duration: info.duration, mode };
    send('done', d); if (onDone) { try { onDone(d); } catch (x) { /* ignore */ } }
  }).catch((err) => send('done', err.cancelled ? { cancelled: true } : { error: 'failed', message: err.message }))
    .finally(() => { if (job === j) job = null; });
  return { started: true };
});

ipcMain.handle('trim:cancel', (e) => { if (own(e) && job) job.cancel(); });
ipcMain.handle('trim:reveal', (e) => { if (own(e) && result && fs.existsSync(result)) shell.showItemInFolder(result); });
ipcMain.handle('trim:open-result', (e) => { if (own(e) && result && fs.existsSync(result)) return shell.openPath(result); });
ipcMain.handle('trim:close', (e) => { if (own(e)) close(); });

module.exports = { open, close, hide, restore, isOpen: () => !!(win && !win.isDestroyed()), busy: () => !!job, cancel: () => { if (job) job.cancel(); }, getWindow: () => win };
