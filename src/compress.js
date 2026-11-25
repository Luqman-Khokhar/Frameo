// Video compression: Medium / Low copies of a video, sized with two-pass x264 so the result lands near the estimate.
// Pure Node (no Electron) so it can be tested on its own. Never touches the source file.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PRESETS = {
  medium: { label: 'Medium', factor: 0.5, maxH: 1080, maxFps: 30, audioK: 96, channels: 2 },
  low: { label: 'Low', factor: 0.2, maxH: 720, maxFps: 24, audioK: 64, channels: 1 }
};
const STALL_MS = 30000; // no ffmpeg progress for this long = stuck
const OVERHEAD = 0.96; // container + rate-control slack
const minVideoK = (h) => (h >= 1080 ? 600 : h >= 720 ? 350 : h >= 480 ? 200 : 120); // below this a screen recording is unwatchable
const LADDER = [1080, 720, 480, 360];

function probe(file) {
  return new Promise((res, rej) => execFile('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { maxBuffer: 8 << 20, timeout: 15000 }, (e, out) => {
    if (e) return rej(new Error('Could not read this video.'));
    let j; try { j = JSON.parse(out); } catch (x) { return rej(new Error('Could not read this video.')); }
    const streams = j.streams || [];
    const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
    if (!v) return rej(new Error('No video found in this file.'));
    const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '0/1').split('/').map(Number);
    const fmt = j.format || {};
    res({
      file, bytes: parseInt(fmt.size, 10) || fs.statSync(file).size,
      duration: parseFloat(fmt.duration) || parseFloat(v.duration) || 0,
      w: v.width, h: v.height, fps: d ? n / d : 30, hasAudio: streams.some((s) => s.codec_type === 'audio')
    });
  }));
}

/* Decide bitrate / resolution / fps for a preset. ok:false carries a user-facing reason. */
function plan(info, key) {
  const p = PRESETS[key]; const base = { key, ok: false };
  if (!p) return { ...base, reason: 'Unknown preset.' };
  if (!(info.duration >= 1) || info.bytes < 512 * 1024) return { ...base, reason: 'Too short or small to compress.' };
  const audioK = info.hasAudio ? p.audioK : 0;
  const targetBytes = Math.floor(info.bytes * p.factor);
  const videoK = Math.floor(targetBytes * 8 / info.duration / 1000 * OVERHEAD - audioK);
  const start = Math.min(info.h, p.maxH);
  const height = [start, ...LADDER.filter((h) => h < start)].find((h) => videoK >= minVideoK(h));
  if (!height) return { ...base, reason: 'Too long to fit at acceptable quality.' };
  const fps = info.fps > p.maxFps + 0.5 ? p.maxFps : info.fps;
  const vf = [info.fps > p.maxFps + 0.5 ? 'fps=' + p.maxFps : null, height < info.h ? 'scale=-2:' + height : 'scale=trunc(iw/2)*2:trunc(ih/2)*2'].filter(Boolean).join(',');
  return { ok: true, key, targetBytes, videoK, audioK, channels: p.channels, height, fps, vf };
}

function outputName(file, key) {
  const base = path.basename(file, path.extname(file)).replace(/ \((medium|low)\)$/, '');
  return `${base} (${key}).mp4`;
}
function uniquePath(dir, name) {
  const ext = path.extname(name), stem = path.basename(name, ext); let p = path.join(dir, name), i = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${stem} (${i++})${ext}`);
  return p;
}
function freeBytes(dir) { try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch (e) { return Infinity; } }
/* Throws a user-facing error when the output folder or temp folder cannot hold the result. */
function preflight(pl, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const need = pl.targetBytes * 1.3 + (8 << 20);
  if (freeBytes(outDir) < need || freeBytes(os.tmpdir()) < need) { const e = new Error('Not enough free disk space.'); e.code = 'ENOSPC'; throw e; }
}

/* Returns { promise, cancel }. promise resolves { path, bytes } or rejects (err.cancelled when cancelled).
   onProgress({ pct 0-1, pass 1|2, retry }). */
function run(info, pl, outDir, onProgress = () => {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-cmp-'));
  const out = path.join(tmpDir, 'out.mp4');
  let child = null, cancelled = false;
  const hardKill = (c) => { c.kill('SIGTERM'); setTimeout(() => c.kill('SIGKILL'), 2000).unref(); }; // a stuck ffmpeg ignores SIGTERM
  const cancel = () => { cancelled = true; if (child) hardKill(child); };

  /* n = 1 or 2 for two-pass, 0 for a single-pass fallback */
  const pass = (n, vK, retry) => new Promise((resolve, reject) => {
    if (cancelled) return reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', '-progress', 'pipe:1', '-nostats', '-i', info.file, '-map', '0:v:0', '-fps_mode', 'cfr', '-vf', pl.vf, // cfr in BOTH passes: mismatched frame counts make pass 2 hang
      '-c:v', 'libx264', '-preset', 'medium', '-b:v', vK + 'k', '-pix_fmt', 'yuv420p'];
    if (n) args.push('-pass', String(n), '-passlogfile', path.join(tmpDir, 'p'));
    if (n === 1) args.push('-an', '-f', 'null', '/dev/null');
    else {
      if (info.hasAudio) args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', pl.audioK + 'k', '-ac', String(pl.channels)); else args.push('-an');
      args.push('-movflags', '+faststart', out);
    }
    child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const c = child; let err = '', buf = '', lastAt = Date.now(), stalled = false;
    const watchdog = setInterval(() => { if (Date.now() - lastAt > STALL_MS) { stalled = true; c.kill('SIGKILL'); } }, 2000);
    child.stderr.on('data', (d) => { err = (err + d).slice(-800); });
    child.stdout.on('data', (d) => {
      lastAt = Date.now(); buf += d; const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) {
        const m = /^out_time_(?:us|ms)=(\d+)/.exec(l); if (!m) continue;
        const frac = Math.min(1, Number(m[1]) / 1e6 / info.duration);
        onProgress({ pct: n === 0 ? frac : n === 1 ? frac * 0.4 : 0.4 + frac * 0.6, pass: n, retry });
      }
    });
    child.on('error', (e) => { clearInterval(watchdog); reject(e); });
    child.on('close', (code) => {
      clearInterval(watchdog); child = null;
      if (stalled && !cancelled) return reject(Object.assign(new Error('Compression stalled and was stopped.'), { stalled: true }));
      if (cancelled) return reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
      code === 0 ? resolve() : reject(new Error(err.trim() || 'ffmpeg failed (' + code + ').'));
    });
  });

  const promise = (async () => {
    try {
      let vK = pl.videoK;
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await pass(1, vK, attempt > 0); await pass(2, vK, attempt > 0); }
        catch (e) { if (!e.stalled) throw e; await pass(0, vK, true); } // two-pass stalled: fall back to single-pass
        const size = fs.statSync(out).size;
        if (size <= pl.targetBytes * 1.05 || attempt === 1) break;
        vK = Math.max(50, Math.floor(vK * pl.targetBytes / size * 0.96)); // came out too big: redo a little lower
      }
      fs.mkdirSync(outDir, { recursive: true });
      const final = uniquePath(outDir, outputName(info.file, pl.key));
      try { fs.renameSync(out, final); } catch (e) { fs.copyFileSync(out, final + '.part'); fs.renameSync(final + '.part', final); }
      return { path: final, bytes: fs.statSync(final).size };
    } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  })();
  return { promise, cancel };
}

module.exports = { PRESETS, probe, plan, run, outputName, uniquePath, preflight };
