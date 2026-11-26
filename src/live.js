// Live ink overlay window: transparent, fullscreen, never focused. It is kept IN recordings on purpose
// (title = capture.KEEP_TITLE, see native/xcap.c --keep-title); the toolbar, palette and text box stay excluded.
const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { KEEP_TITLE } = require('./capture');

const R = (n) => path.join(__dirname, 'renderer', 'paint', n);
let display = null; // bounds of the display to cover; set by main.js before drawing starts
let win = null, ready = null, tw = null, tpos = null, pending = null;
const cuts = {}; // screen rects punched out of the overlay so the windows beneath stay clickable: { toolbar, text }

function ensure() {
  if (win && !win.isDestroyed()) return ready;
  const b = display || screen.getPrimaryDisplay().bounds;
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false,
    movable: false, hasShadow: false, focusable: false, show: false, enableLargerThanScreen: true, title: KEEP_TITLE,
    webPreferences: { preload: R('preload-live.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true);
  win.on('page-title-updated', (e) => e.preventDefault());
  win.loadFile(R('live.html'));
  ready = new Promise((res) => { win.once('closed', res); win.webContents.once('did-finish-load', () => { win.showInactive(); res(); }); });
  return ready;
}
/* on = capture the mouse and draw; off = ink stays visible, clicks pass through to the desktop */
async function setDraw(on) {
  await ensure();
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(!on);
  if (!on) closeText();
}

/* The WM keeps the overlay above our other windows, so subtract their rects from its shape instead of fighting the stacking order. */
function applyCuts() {
  if (!win || win.isDestroyed()) return;
  const o = win.getBounds(), W = o.width, H = o.height, cl = (v, m) => Math.max(0, Math.min(m, Math.round(v)));
  const cs = Object.values(cuts).filter(Boolean).map((r) => ({ x0: cl(r.x - o.x, W), y0: cl(r.y - o.y, H), x1: cl(r.x - o.x + r.width, W), y1: cl(r.y - o.y + r.height, H) })).filter((c) => c.x1 > c.x0 && c.y1 > c.y0);
  const ys = [...new Set([0, H, ...cs.flatMap((c) => [c.y0, c.y1])])].sort((a, b) => a - b), out = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const ya = ys[i], yb = ys[i + 1], cov = cs.filter((c) => c.y0 <= ya && c.y1 >= yb).sort((a, b) => a.x0 - b.x0); let x = 0;
    for (const c of cov) { if (c.x0 > x) out.push({ x, y: ya, width: c.x0 - x, height: yb - ya }); x = Math.max(x, c.x1); }
    if (x < W) out.push({ x, y: ya, width: W - x, height: yb - ya });
  }
  win.setShape(out);
}
function setCut(key, rect) { cuts[key] = rect; applyCuts(); }

/* ---- text box: a small focusable window (the overlay itself can never take keyboard focus) ---- */
function closeText() {
  const w = tw; tw = null; tpos = null; cuts.text = null;
  if (w && !w.isDestroyed()) w.destroy();
  applyCuts();
  if (pending) { const p = pending; pending = null; p(); }
}
function commitText() {
  if (!tw || tw.isDestroyed()) return Promise.resolve();
  return new Promise((res) => { pending = res; tw.webContents.send('commit'); setTimeout(() => { if (pending === res) closeText(); }, 600); });
}
function openText(d) {
  const b = win.getBounds(), W = 380, H = 130;
  const x = Math.max(b.x, Math.min(b.x + Math.round(d.x), b.x + b.width - W)), y = Math.max(b.y, Math.min(b.y + Math.round(d.y), b.y + b.height - H));
  tpos = { x: d.x, y: d.y };
  tw = new BrowserWindow({
    x, y, width: W, height: H, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, show: false, focusable: true,
    title: 'Frameo text', webPreferences: { preload: R('preload-livetext.js'), contextIsolation: true, nodeIntegration: false }
  });
  tw.setAlwaysOnTop(true, 'screen-saver');
  tw.loadFile(R('livetext.html'), { query: { c: d.color, px: String(d.px) } });
  tw.webContents.once('did-finish-load', () => { if (!tw || tw.isDestroyed()) return; tw.show(); tw.focus(); setCut('text', tw.getBounds()); });
}
ipcMain.on('live:text', async (e, d) => {
  if (!win || win.isDestroyed() || e.sender !== win.webContents || !d) return;
  const x = Number(d.x), y = Number(d.y), px = Number(d.px);
  if (!(isFinite(x) && isFinite(y) && px >= 8 && px <= 400) || !/^#[0-9a-f]{6}$/i.test(String(d.color))) return;
  await commitText();
  if (win && !win.isDestroyed()) openText({ x, y, px, color: d.color });
});
ipcMain.on('live:down', (e) => { if (win && !win.isDestroyed() && e.sender === win.webContents && tw) commitText(); });
ipcMain.on('livetext:done', (e, s) => {
  if (!tw || tw.isDestroyed() || e.sender !== tw.webContents) return;
  const p = tpos, str = String(s).slice(0, 2000);
  closeText();
  if (p && str.trim()) send('text', { x: p.x, y: p.y, s: str });
});

function send(c, a) { if (win && !win.isDestroyed()) win.webContents.send('cmd', c, a); }
function destroy() { closeText(); if (win && !win.isDestroyed()) win.destroy(); win = null; ready = null; for (const k of Object.keys(cuts)) delete cuts[k]; }
/* A different display needs a new overlay window: drop the old one. */
function setDisplay(b) { if (display && b && (display.x !== b.x || display.y !== b.y || display.width !== b.width || display.height !== b.height) && win && !win.isDestroyed()) { closeText(); win.destroy(); win = null; ready = null; } display = b; }
module.exports = { setDisplay, setDraw, setCut, send, destroy };
