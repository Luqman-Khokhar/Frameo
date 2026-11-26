const { BrowserWindow, ipcMain, screen, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const settings = require('./settings');

const R = (n) => path.join(__dirname, 'renderer', 'paint', n);
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const MAX = 100 * 1024 * 1024;
let win = null, src = null, saved = null, onSaved = null, hidden = false;

async function send() {
  const ext = path.extname(src).toLowerCase();
  const buf = await fs.promises.readFile(src);
  if (win && !win.isDestroyed()) win.webContents.send('load', { buf, name: path.basename(src), mime: MIME[ext], theme: settings.load().theme });
}

/* Open the annotate window for an image file. Returns { ok } or { error }. */
function open(file, cb) {
  const f = String(file || ''); const ext = path.extname(f).toLowerCase();
  if (!MIME[ext] || !fs.existsSync(f)) return { error: 'file' };
  src = f; saved = null; onSaved = cb || null; hidden = false;
  if (win && !win.isDestroyed()) { send(); win.show(); win.focus(); return { ok: true }; }
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea; const sz = nativeImage.createFromPath(f).getSize(); // opens on the screen the user is working on
  const clamp = (v, lo, hi) => Math.round(Math.max(lo, Math.min(v, hi)));
  const ew = clamp(sz.width + 48, 760, wa.width * 0.9), eh = clamp(sz.height + 110, 520, wa.height * 0.9);
  win = new BrowserWindow({
    width: ew, height: eh, x: Math.round(wa.x + (wa.width - ew) / 2), y: Math.round(wa.y + (wa.height - eh) / 2), minWidth: 640, minHeight: 420,
    title: 'Frameo — Annotate', icon: path.join(__dirname, '..', 'assets', 'icon.png'), backgroundColor: '#FCF0DA', show: false,
    webPreferences: { preload: R('preload-editor.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(R('editor.html'));
  win.webContents.once('did-finish-load', () => { send(); win.show(); });
  win.on('closed', () => { win = null; src = null; saved = null; onSaved = null; });
  return { ok: true };
}
/* Frameo windows must not appear in captures: hide before grabbing, restore after. */
const hide = () => { if (win && !win.isDestroyed() && win.isVisible()) { win.hide(); hidden = true; return true; } return false; };
const restore = () => { if (hidden && win && !win.isDestroyed()) win.show(); hidden = false; };
const close = () => { if (win && !win.isDestroyed()) win.destroy(); };
const own = (e) => win && !win.isDestroyed() && e.sender === win.webContents && src;
const toBuf = (b) => { const d = Buffer.from(b); return d.length && d.length <= MAX ? d : null; };

/* Save = new file "<name> edited.<ext>" next to the original; later saves in the same session overwrite that copy. */
ipcMain.handle('editor:save', async (e, buf) => {
  if (!own(e)) return { error: 'state' };
  try {
    const data = toBuf(buf); if (!data) return { error: 'size' };
    if (!saved) {
      const ext = path.extname(src), dir = path.dirname(src), base = path.basename(src, ext).replace(/ edited( \d+)?$/, '');
      let out = path.join(dir, base + ' edited' + ext);
      for (let i = 2; fs.existsSync(out); i++) out = path.join(dir, base + ' edited ' + i + ext);
      saved = out;
    }
    await fs.promises.writeFile(saved, data);
    if (onSaved) onSaved(saved);
    return { ok: true, name: path.basename(saved) };
  } catch (err) { return { error: 'save', message: err.message }; }
});
ipcMain.handle('editor:copy', (e, buf) => {
  if (!own(e)) return { error: 'state' };
  const data = toBuf(buf); if (!data) return { error: 'size' };
  const img = nativeImage.createFromBuffer(data); if (img.isEmpty()) return { error: 'image' };
  clipboard.writeImage(img); return { ok: true };
});

module.exports = { open, close, hide, restore, isOpen: () => !!(win && !win.isDestroyed()) };
