// Live ink overlay window: transparent, fullscreen, never focused. It is kept IN recordings on purpose
// (title = capture.KEEP_TITLE, see native/xcap.c --keep-title); the toolbar and palette stay excluded.
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { KEEP_TITLE } = require('./capture');

const R = (n) => path.join(__dirname, 'renderer', 'paint', n);
let win = null, ready = null;

function ensure() {
  if (win && !win.isDestroyed()) return ready;
  const b = screen.getPrimaryDisplay().bounds;
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
}
/* Remove rect r (screen DIPs) from the overlay's shape so clicks there reach the toolbar window beneath it. */
function cutout(r) {
  if (!win || win.isDestroyed()) return;
  const o = win.getBounds(), W = o.width, H = o.height;
  const x = Math.max(0, Math.round(r.x - o.x)), y = Math.max(0, Math.round(r.y - o.y)), x2 = Math.min(W, Math.round(r.x - o.x + r.width)), y2 = Math.min(H, Math.round(r.y - o.y + r.height));
  win.setShape([{ x: 0, y: 0, width: W, height: y }, { x: 0, y: y2, width: W, height: H - y2 }, { x: 0, y, width: x, height: y2 - y }, { x: x2, y, width: W - x2, height: y2 - y }].filter((q) => q.width > 0 && q.height > 0));
}
function send(c, a) { if (win && !win.isDestroyed()) win.webContents.send('cmd', c, a); }
function destroy() { if (win && !win.isDestroyed()) win.destroy(); win = null; ready = null; }
module.exports = { setDraw, cutout, send, destroy };
