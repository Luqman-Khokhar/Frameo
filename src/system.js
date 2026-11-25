// Environment probing: session type, ffmpeg, helper binary, PulseAudio/PipeWire devices.
const { execFile, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const run = (cmd, args) => new Promise((res) => execFile(cmd, args, { timeout: 4000, maxBuffer: 4 << 20 }, (e, out) => res(e ? null : String(out))));

function helperPath() {
  const packaged = path.join(process.resourcesPath || '', 'bin', 'xcap');
  if (app.isPackaged && fs.existsSync(packaged)) return packaged;
  const dev = path.join(__dirname, '..', 'native', 'xcap');
  return fs.existsSync(dev) ? dev : null;
}
const hasFfmpeg = () => { try { return spawnSync('ffmpeg', ['-version']).status === 0; } catch (e) { return false; } };

async function pactlList(kind) {
  const j = await run('pactl', ['-f', 'json', 'list', kind]);
  if (j) {
    try {
      return JSON.parse(j).map((d) => ({ name: d.name, description: d.description || d.name, monitor: !!d.monitor_of_sink || /\.monitor$/.test(d.name) }));
    } catch (e) { /* fall through */ }
  }
  const s = await run('pactl', ['list', 'short', kind]);
  if (!s) return [];
  return s.split('\n').filter(Boolean).map((l) => { const n = l.split('\t')[1]; return { name: n, description: n, monitor: /\.monitor$/.test(n) }; });
}

async function probe() {
  const [sinks, sources, defSink] = await Promise.all([pactlList('sinks'), pactlList('sources'), run('pactl', ['get-default-sink'])]);
  const mics = sources.filter((s) => !s.monitor);
  return {
    session: process.env.XDG_SESSION_TYPE || 'x11',
    wayland: (process.env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland',
    ffmpeg: hasFfmpeg(), helper: !!helperPath(),
    sinks, mics, defaultSink: (defSink || '').trim() || (sinks[0] && sinks[0].name) || '',
    audioOk: sinks.length > 0
  };
}
module.exports = { probe, helperPath, run };
