const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const DEFAULTS = {
  saveDir: path.join(os.homedir(), 'Pictures', 'Frameo'),
  compressDir: path.join(os.homedir(), 'Downloads'),
  theme: 'light', img: 'png', vid: 'mp4', quality: 'High', fps: 30,
  dim: 42, cd: 3, badge: true, ratios: true, launch: false, tray: true,
  shot: { w: 1280, h: 720 }, rec: { w: 1280, h: 720 },
  audio: { sys: true, mic: false, spk: false },
  mic: '', sink: '',
  keys: { shotFull: 'Control+Alt+1', shotRegion: 'Control+Alt+2', rec: 'Control+Alt+3', pause: 'Control+Alt+P' }
};

const file = () => path.join(app.getPath('userData'), 'settings.json');
let cache = null;

function load() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { /* first run */ }
  cache = { ...DEFAULTS, ...saved, shot: { ...DEFAULTS.shot, ...saved.shot }, rec: { ...DEFAULTS.rec, ...saved.rec },
    audio: { ...DEFAULTS.audio, ...saved.audio }, keys: { ...DEFAULTS.keys, ...saved.keys } };
  return cache;
}
function save(patch) {
  const cur = load();
  cache = { ...cur, ...patch };
  for (const k of ['shot', 'rec', 'audio', 'keys']) if (patch[k]) cache[k] = { ...cur[k], ...patch[k] };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
  return cache;
}
module.exports = { load, save, DEFAULTS };
