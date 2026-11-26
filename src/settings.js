const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const DEFAULTS = {
  saveDir: path.join(os.homedir(), 'Pictures', 'Frameo'),
  compressDir: path.join(os.homedir(), 'Downloads'),
  theme: 'light', img: 'png', vid: 'mp4', quality: 'High', fps: 30,
  dim: 42, cd: 3, editAfterShot: false, badge: true, ratios: true, launch: false, tray: true,
  shot: { w: 1280, h: 720 }, rec: { w: 1280, h: 720 },
  audio: { sys: true, mic: false, spk: false },
  mic: '', sink: '',
  keys: { shotFull: 'Control+Alt+1', shotRegion: 'Control+Alt+2', rec: 'Control+Alt+3', pause: 'Control+Alt+P', paint: 'Control+Alt+A' }
};

const file = () => path.join(app.getPath('userData'), 'settings.json');
let cache = null;

/* Whitelist + type/range check. Unknown keys and invalid values are dropped (the previous value stays). */
const KEY_RE = /^(?:(?:Control|Ctrl|Alt|Shift|Super|Meta|CommandOrControl)\+)*[A-Za-z0-9]{1,12}$/;
const str = (v, max) => (typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v.trim() : undefined);
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined);
const absDir = (v) => { const s = str(v, 4096); return s && path.isAbsolute(s) ? path.normalize(s) : undefined; };
const oneOf = (list) => (v) => (list.includes(v) ? v : undefined);
const bool = (v) => (typeof v === 'boolean' ? v : undefined);
const dims = (v) => { if (!v || typeof v !== 'object') return undefined; const o = {}; const w = num(v.w, 16, 16384), h = num(v.h, 16, 16384); if (w !== undefined) o.w = w; if (h !== undefined) o.h = h; return Object.keys(o).length ? o : undefined; };
const SCHEMA = {
  saveDir: absDir, compressDir: absDir,
  theme: oneOf(['light', 'dark']), img: oneOf(['png', 'jpg', 'webp']), vid: oneOf(['mp4', 'webm']), quality: oneOf(['Low', 'Medium', 'High']),
  fps: (v) => num(v, 5, 60), dim: (v) => num(v, 0, 100), cd: (v) => num(v, 0, 10),
  editAfterShot: bool, badge: bool, ratios: bool, launch: bool, tray: bool,
  shot: dims, rec: dims,
  audio: (v) => { if (!v || typeof v !== 'object') return undefined; const o = {}; for (const k of ['sys', 'mic', 'spk']) if (typeof v[k] === 'boolean') o[k] = v[k]; return Object.keys(o).length ? o : undefined; },
  mic: (v) => (v === '' ? '' : str(v, 300)), sink: (v) => (v === '' ? '' : str(v, 300)),
  keys: (v) => { if (!v || typeof v !== 'object') return undefined; const o = {}; for (const k of Object.keys(DEFAULTS.keys)) if (typeof v[k] === 'string' && KEY_RE.test(v[k].trim())) o[k] = v[k].trim(); return Object.keys(o).length ? o : undefined; }
};
function sanitize(patch) {
  const out = {}; if (!patch || typeof patch !== 'object') return out;
  for (const k of Object.keys(SCHEMA)) { if (!Object.prototype.hasOwnProperty.call(patch, k)) continue; const v = SCHEMA[k](patch[k]); if (v !== undefined) out[k] = v; }
  return out;
}

function load() {
  if (cache) return cache;
  let saved = {};
  try { saved = sanitize(JSON.parse(fs.readFileSync(file(), 'utf8'))); }
  catch (e) { if (e.code !== 'ENOENT') { try { fs.copyFileSync(file(), file() + '.bad'); } catch (x) { /* ignore */ } } } // first run = ENOENT; anything else is a corrupt file: keep a copy before defaults take over
  cache = { ...DEFAULTS, ...saved, shot: { ...DEFAULTS.shot, ...saved.shot }, rec: { ...DEFAULTS.rec, ...saved.rec },
    audio: { ...DEFAULTS.audio, ...saved.audio }, keys: { ...DEFAULTS.keys, ...saved.keys } };
  return cache;
}
function save(raw) {
  const patch = sanitize(raw);
  const cur = load();
  cache = { ...cur, ...patch };
  for (const k of ['shot', 'rec', 'audio', 'keys']) if (patch[k]) cache[k] = { ...cur[k], ...patch[k] };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  const tmpf = file() + '.tmp'; fs.writeFileSync(tmpf, JSON.stringify(cache, null, 2)); fs.renameSync(tmpf, file()); // atomic: a crash mid-write can't leave a truncated settings.json
  return cache;
}
module.exports = { load, save, sanitize, DEFAULTS };
