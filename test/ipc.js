// IPC path-trust test: electron --no-sandbox test/ipc.js --hidden   (needs an X display, e.g. xvfb-run -a)
const { app } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path'); const assert = require('assert');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-ipc-ud-'))); // never touch the real settings.json
const m = require('../src/main.js'); const settings = require('../src/settings.js');
const log = (...a) => console.log('[ipc]', ...a);
app.whenReady().then(() => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-ipc-')));
  const save = path.join(root, 'save'), dl = path.join(root, 'dl'), other = path.join(root, 'other'); for (const d of [save, dl, other]) fs.mkdirSync(d);
  settings.save({ saveDir: save, compressDir: dl });
  const w = (d, n) => { const p = path.join(d, n); fs.writeFileSync(p, 'x'); return p; };
  const shot = w(save, 'Screenshot 2026-01-01 10-00-00.png'), rec = w(save, 'Recording 2026-01-01 10-00-00.mp4'), cmp = w(dl, 'Recording x (low) (2).mp4');
  const t = (n, f) => { f(); log('ok  ', n); };
  t('managed files accepted', () => { assert.strictEqual(m.itemPath(shot), shot); assert.strictEqual(m.itemPath(rec), rec); assert.strictEqual(m.itemPath(cmp), cmp); });
  t('foreign names rejected', () => { assert.strictEqual(m.itemPath(w(save, 'notes.txt')), null); assert.strictEqual(m.itemPath(w(other, 'Screenshot a.png')), null); assert.strictEqual(m.itemPath(w(dl, 'Screenshot a.png')), null); });
  t('traversal rejected', () => { assert.strictEqual(m.itemPath(path.join(save, '..', 'other', 'Screenshot a.png')), null); assert.strictEqual(m.itemPath('/etc/passwd'), null); });
  t('symlink escape rejected', () => { const l = path.join(save, 'Screenshot link.png'); fs.symlinkSync(path.join(other, 'Screenshot a.png'), l); assert.strictEqual(m.itemPath(l), null); });
  t('bad types rejected', () => { for (const v of [null, undefined, 5, {}, [], '']) assert.strictEqual(m.itemPath(v), null); assert.strictEqual(m.itemPath(save), null); });
  t('video source: ext + regular file only', () => { assert.strictEqual(m.videoPath(rec), rec); assert.strictEqual(m.videoPath(w(other, 'a.mkv')), path.join(other, 'a.mkv')); assert.strictEqual(m.videoPath(w(other, 'a.txt')), null); assert.strictEqual(m.videoPath(other), null); assert.strictEqual(m.videoPath('/nope.mp4'), null); });
  fs.rmSync(root, { recursive: true, force: true }); log('ALL PASS'); app.exit(0);
}).catch((e) => { console.error('[ipc] FAIL', e); app.exit(1); });
