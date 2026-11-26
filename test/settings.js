// Pure-Node test for settings validation + atomic write: node test/settings.js
const Module = require('module'); const fs = require('fs'); const os = require('os'); const path = require('path'); const assert = require('assert');
const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-settings-test-'));
const o = Module._load; Module._load = function (r, ...a) { return r === 'electron' ? { app: { getPath: () => ud } } : o.call(this, r, ...a); };
const s = require('../src/settings');
const t = (n, f) => { f(); console.log('[settings] ok  ', n); };
t('unknown keys dropped', () => assert.deepStrictEqual(s.sanitize({ evil: 1, __proto__: { x: 1 }, tray: false }), { tray: false }));
t('enums + ranges', () => { const r = s.sanitize({ img: 'exe', vid: 'webm', fps: 9999, cd: -3, dim: 50.4 }); assert.deepStrictEqual(r, { vid: 'webm', fps: 60, cd: 0, dim: 50 }); });
t('dirs must be absolute strings', () => { assert.deepStrictEqual(s.sanitize({ saveDir: 'rel/x', compressDir: 5 }), {}); assert.strictEqual(s.sanitize({ saveDir: '/home/u/../u/Pics ' }).saveDir, '/home/u/Pics'); });
t('dims clamp', () => assert.deepStrictEqual(s.sanitize({ shot: { w: 1, h: 99999, z: 3 } }), { shot: { w: 16, h: 16384 } }));
t('keys validated', () => assert.deepStrictEqual(s.sanitize({ keys: { rec: 'Control+Alt+3', pause: 'rm -rf /', other: 'A' } }), { keys: { rec: 'Control+Alt+3' } }));
t('non-object patch', () => { assert.deepStrictEqual(s.sanitize(null), {}); assert.deepStrictEqual(s.sanitize('x'), {}); });
t('save is atomic + sanitized', () => { const r = s.save({ fps: 24, junk: 1, audio: { mic: true } }); assert.strictEqual(r.fps, 24); assert.strictEqual(r.junk, undefined); assert.strictEqual(r.audio.sys, true); assert.ok(!fs.existsSync(path.join(ud, 'settings.json.tmp'))); assert.strictEqual(JSON.parse(fs.readFileSync(path.join(ud, 'settings.json'), 'utf8')).fps, 24); });
t('corrupt file backed up, defaults used', () => {
  fs.writeFileSync(path.join(ud, 'settings.json'), '{"fps": 2'); delete require.cache[require.resolve('../src/settings')];
  const s2 = require('../src/settings'); assert.strictEqual(s2.load().fps, 30);
  assert.strictEqual(fs.readFileSync(path.join(ud, 'settings.json.bad'), 'utf8'), '{"fps": 2');
});
fs.rmSync(ud, { recursive: true, force: true }); console.log('[settings] ALL PASS');
