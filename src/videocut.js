// Video cutting: Split (keep one range) and Trim (remove ranges, join the rest). Pure Node (no Electron) so it can be tested on its own.
// Never touches the source file. Lossless by default (stream copy: no quality loss, near-instant, start points snap to keyframes);
// "precise" re-encodes for exact cut points.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const compress = require('./compress');

const STALL_MS = 30000; // no ffmpeg progress for this long = stuck
const MIN_LEN = 0.1; // seconds: shorter ranges are rejected
const EPS = 1e-3;
const MODES = ['split', 'trim'];

const probe = (file) => compress.probe(file);

/* Keyframe times (s) of the first video stream; [] when they cannot be read (lossless cuts then keep the exact start). */
function keyframes(file) {
  return new Promise((res) => execFile('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags', '-of', 'csv=p=0', file],
    { maxBuffer: 128 << 20, timeout: 90000 }, (e, out) => {
      if (e) return res([]);
      const t = [];
      for (const l of String(out).split('\n')) { const [pts, fl] = l.split(','); if (fl && fl.includes('K')) { const v = parseFloat(pts); if (isFinite(v)) t.push(v); } }
      res(t.sort((a, b) => a - b));
    }));
}

/* Ranges the user marked -> sorted, clamped to the video, merged. Throws a user-facing Error when a range is unusable. */
function cleanRanges(duration, ranges) {
  if (!(duration > 0)) throw new Error('Could not read the video length.');
  const out = [];
  for (const r of Array.isArray(ranges) ? ranges : []) {
    const a0 = Number(r && r[0]), b0 = Number(r && r[1]);
    if (!isFinite(a0) || !isFinite(b0)) throw new Error('A range has an invalid time.');
    const a = Math.max(0, Math.min(a0, b0)), b = Math.min(duration, Math.max(a0, b0));
    if (b - a < MIN_LEN) throw new Error('A range is shorter than ' + MIN_LEN + ' s or outside the video.');
    out.push([a, b]);
  }
  out.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const r of out) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1] + EPS) last[1] = Math.max(last[1], r[1]); else merged.push([r[0], r[1]]); }
  return merged;
}

/* mode 'split': ranges = [the part to KEEP]. mode 'trim': ranges = parts to REMOVE. Returns the segments to keep, in order. */
function keepSegments(duration, mode, ranges) {
  if (!MODES.includes(mode)) throw new Error('Unknown mode.');
  const c = cleanRanges(duration, ranges);
  if (mode === 'split') {
    if (c.length !== 1) throw new Error('Select one range to keep.');
    return [c[0]];
  }
  if (!c.length) throw new Error('Mark at least one part to remove.');
  const keep = []; let pos = 0;
  for (const [a, b] of c) { if (a - pos >= MIN_LEN) keep.push([pos, a]); pos = Math.max(pos, b); }
  if (duration - pos >= MIN_LEN) keep.push([pos, duration]);
  if (!keep.length) throw new Error('Nothing would be left of the video.');
  return keep;
}

/* Lossless: each segment start moves forward to the next keyframe (no unwanted pre-roll; the end stays exact because trailing P-frames decode).
   Precise: exact times. Returns { ok, segments:[{start,end,from}], total, estBytes, snapped } or { ok:false, reason }. */
function plan(info, keep, { precise = false, keyframes: kf = [] } = {}) {
  const segs = [];
  for (const [s, e] of keep) {
    let start = s;
    if (!precise && kf.length) { const k = kf.find((t) => t >= s - EPS); start = k === undefined ? s : k; }
    if (e - start >= MIN_LEN) segs.push({ start, end: e, from: s });
  }
  if (!segs.length) return { ok: false, reason: 'The selection is shorter than the gap between keyframes. Turn on Frame-accurate to cut exactly.' };
  const total = segs.reduce((n, x) => n + (x.end - x.start), 0);
  return { ok: true, precise: !!precise, segments: segs, total, estBytes: Math.round(info.bytes * total / Math.max(info.duration, 1)), snapped: segs.some((x) => Math.abs(x.start - x.from) > EPS) };
}

function outputName(file, mode) {
  const ext = path.extname(file) || '.mp4';
  const base = path.basename(file, ext).replace(/ \((split|trim)\)( \(\d+\))?$/, '');
  return `${base} (${mode})${ext}`;
}

function freeBytes(dir) { try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch (e) { return Infinity; } }
/* Throws a user-facing error when the output or temp folder cannot hold the result. */
function preflight(pl, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const need = pl.estBytes * (pl.precise ? 2 : 1.3) + (8 << 20);
  if (freeBytes(outDir) < need || freeBytes(os.tmpdir()) < need) { const e = new Error('Not enough free disk space.'); e.code = 'ENOSPC'; throw e; }
}

const isMp4 = (f) => /\.(mp4|m4v|mov)$/i.test(f);
const isWebm = (f) => /\.webm$/i.test(f);
function encodeArgs(file) {
  if (isWebm(file)) return ['-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '160k'];
  return ['-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'];
}

/* Returns { promise, cancel }. promise resolves { path, bytes } or rejects (err.cancelled when cancelled). onProgress({ pct 0-1 }). */
function run(info, pl, mode, outDir, onProgress = () => {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-cut-'));
  const ext = path.extname(info.file) || '.mp4';
  const out = path.join(tmpDir, 'out' + ext);
  let child = null, cancelled = false;
  const hardKill = (c) => { c.kill('SIGTERM'); setTimeout(() => c.kill('SIGKILL'), 2000).unref(); };
  const cancel = () => { cancelled = true; if (child) hardKill(child); };
  const gone = () => Object.assign(new Error('Cancelled'), { cancelled: true });

  /* one ffmpeg run; onFrac(0-1) of `dur` seconds of output */
  const ff = (args, dur, onFrac) => new Promise((resolve, reject) => {
    if (cancelled) return reject(gone());
    child = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', '-progress', 'pipe:1', '-nostats', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const c = child; let err = '', buf = '', lastAt = Date.now(), stalled = false;
    const watchdog = setInterval(() => { if (Date.now() - lastAt > STALL_MS) { stalled = true; c.kill('SIGKILL'); } }, 2000);
    c.stderr.on('data', (d) => { err = (err + d).slice(-800); });
    c.stdout.on('data', (d) => {
      lastAt = Date.now(); buf += d; const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) { const m = /^out_time_(?:us|ms)=(\d+)/.exec(l); if (m) onFrac(Math.min(1, Number(m[1]) / 1e6 / Math.max(dur, 0.1))); }
    });
    c.on('error', (e) => { clearInterval(watchdog); reject(e); });
    c.on('close', (code) => {
      clearInterval(watchdog); child = null;
      if (stalled && !cancelled) return reject(Object.assign(new Error('Cutting stalled and was stopped.'), { stalled: true }));
      if (cancelled) return reject(gone());
      code === 0 ? resolve() : reject(new Error(err.trim() || 'ffmpeg failed (' + code + ').'));
    });
  });

  const promise = (async () => {
    try {
      const segs = pl.segments, total = pl.total, mp4 = isMp4(info.file);
      const mapArgs = ['-map', '0:v:0', '-map', '0:a?', '-sn', '-dn'];
      const codec = pl.precise ? encodeArgs(info.file) : ['-c', 'copy', '-avoid_negative_ts', 'make_zero'];
      const tail = mp4 ? ['-movflags', '+faststart'] : [];
      // Fast input seeking is exact for mp4 stream copy and for any re-encode; Matroska/WebM stream copy needs output seeking (input seeking adds ~1 s of pre-roll there).
      const seekFirst = pl.precise || mp4;
      const files = []; let done = 0;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], dur = s.end - s.start, single = segs.length === 1;
        const dest = single ? out : path.join(tmpDir, 'seg' + i + ext);
        const seek = seekFirst ? ['-ss', String(s.start), '-i', info.file, '-t', String(dur)] : ['-i', info.file, '-ss', String(s.start), '-t', String(dur)];
        await ff([...seek, ...mapArgs, ...codec, ...(single ? tail : []), dest], dur, (f) => onProgress({ pct: Math.min(0.98, (done + f * dur) / total) }));
        done += dur; files.push(dest);
      }
      if (files.length > 1) {
        const list = path.join(tmpDir, 'list.txt');
        fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
        await ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', ...tail, out], total, () => {});
      }
      onProgress({ pct: 1 });
      fs.mkdirSync(outDir, { recursive: true });
      const final = compress.uniquePath(outDir, outputName(info.file, mode));
      try { fs.renameSync(out, final); } catch (e) { fs.copyFileSync(out, final + '.part'); fs.renameSync(final + '.part', final); }
      return { path: final, bytes: fs.statSync(final).size };
    } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  })();
  return { promise, cancel };
}

module.exports = { MODES, MIN_LEN, probe, keyframes, cleanRanges, keepSegments, plan, preflight, run, outputName };
