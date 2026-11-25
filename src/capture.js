// Screenshot + recording pipeline. Frames come from the xcap helper, which never
// outputs Frameo's own windows; ffmpeg encodes them (and records audio via PulseAudio/PipeWire).
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { helperPath } = require('./system');

const tmp = (n) => path.join(os.tmpdir(), 'frameo-' + process.pid + '-' + n);
const pad = (n) => String(n).padStart(2, '0');
function stamp() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`; }
function uniquePath(dir, base, ext) { let p = path.join(dir, `${base}.${ext}`), i = 2; while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++}).${ext}`); return p; }
const even = (rect, scr) => ({ x: Math.max(0, Math.round(rect.x)), y: Math.max(0, Math.round(rect.y)), w: Math.round(rect.w) & ~1, h: Math.round(rect.h) & ~1 });
const regionArg = (r) => ['--region', `${r.x},${r.y},${r.w},${r.h}`];

function exec(cmd, args) {
  return new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 8 << 20 }, (e, out, err) => (e ? rej(new Error((err || e.message).toString().trim())) : res(String(out)))));
}

/* One raw frame via the helper. `base` is the clean snapshot taken before Frameo's windows were shown (recording only). */
async function grabOnce({ rect, base, out, saveBase }) {
  const h = helperPath(); if (!h) throw new Error('Capture helper (xcap) is not built. Run: npm run build:native');
  const args = ['--pid', process.env.FRAMEO_TEST_PID || String(process.pid), '--class', process.env.FRAMEO_TEST_CLASS || 'frameo']; // env overrides exist only for the negative-control test
  if (rect) args.push(...regionArg(rect));
  if (base) args.push('--base', base);
  if (saveBase) args.push('--save-base', saveBase);
  args.push('--once', out);
  const o = (await exec(h, args)).trim().split(/\s+/).map(Number);
  return { x: o[0], y: o[1], w: o[2], h: o[3], sw: o[4], sh: o[5] };
}

/* Clean snapshot of the whole screen, taken while all Frameo windows are hidden. Also returns the (even-sized) region geometry. */
async function snapshotBase({ rect, baseFile, out }) {
  return grabOnce({ rect: rect ? even(rect) : null, base: null, out, saveBase: baseFile });
}

async function screenshot({ rect, dir, fmt, base }) {
  fs.mkdirSync(dir, { recursive: true });
  const raw = tmp('shot.raw');
  const g = await grabOnce({ rect: rect ? even(rect) : null, base, out: raw });
  const file = uniquePath(dir, 'Screenshot ' + stamp(), fmt);
  const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr0', '-video_size', `${g.w}x${g.h}`, '-i', raw, '-frames:v', '1'];
  if (fmt === 'jpg') args.push('-q:v', '2'); if (fmt === 'webp') args.push('-quality', '92');
  args.push(file);
  try { await exec('ffmpeg', args); } finally { fs.rm(raw, () => {}); }
  return { path: file, w: g.w, h: g.h };
}

/* Is Frameo's toolbar visible in a fresh frame? Looks for the toolbar's invisible canary pixel (#3A3C37). */
async function toolbarVisible({ bounds, base }) {
  const raw = tmp('check.raw');
  try {
    const g = await grabOnce({ rect: null, base, out: raw });
    const buf = fs.readFileSync(raw);
    // Scan a small window around the canary (the toolbar's exact position can be off by a pixel or two).
    for (let dy = 0; dy < 12; dy++) for (let dx = 110; dx < 130; dx++) {
      const x = Math.round(bounds.x) + dx, y = Math.round(bounds.y) + dy; if (x >= g.sw || y >= g.sh) continue;
      const i = (y * g.sw + x) * 4;
      if (buf[i + 2] === 0x3a && buf[i + 1] === 0x3c && buf[i] === 0x37) return true;
    }
    return false;
  } finally { fs.rm(raw, () => {}); }
}

function audioSources(audio, env, st) {
  const out = [];
  if (audio.sys && env.defaultSink) out.push(env.defaultSink + '.monitor');
  if (audio.spk) { const m = (st.sink || env.defaultSink) + '.monitor'; if (st.sink || env.defaultSink) if (!out.includes(m)) out.push(m); }
  if (audio.mic && env.mics.length) out.push(st.mic && env.mics.some((m) => m.name === st.mic) ? st.mic : env.mics[0].name);
  return out;
}

class Recorder {
  constructor() { this.reset(); }
  reset() { this.active = false; this.paused = false; this.segs = []; this.elapsed = 0; this.segStart = 0; this.cur = null; this.opts = null; }

  startSegment() {
    const o = this.opts; const ext = o.vid; const file = tmp(`seg${this.segs.length}.${ext}`);
    const helper = spawn(helperPath(), ['--pid', String(process.pid), '--class', 'frameo', ...regionArg(o.rect), '--base', o.base, '--stream', '--fps', String(o.fps)], { stdio: ['ignore', 'pipe', 'pipe'] });
    const a = o.audioSrcs;
    const args = ['-y', '-loglevel', 'error', '-thread_queue_size', '512', '-use_wallclock_as_timestamps', '1', '-f', 'rawvideo', '-pix_fmt', 'bgr0', '-video_size', `${o.rect.w}x${o.rect.h}`, '-i', 'pipe:0'];
    for (const s of a) args.push('-thread_queue_size', '512', '-f', 'pulse', '-i', s);
    if (a.length > 1) args.push('-filter_complex', a.map((_, i) => `[${i + 1}:a]`).join('') + `amix=inputs=${a.length}:duration=longest:normalize=0[a]`, '-map', '0:v', '-map', '[a]');
    else if (a.length === 1) args.push('-map', '0:v', '-map', '1:a');
    args.push('-vf', `fps=${o.fps},scale=trunc(iw/2)*2:trunc(ih/2)*2`);
    const crf = { Low: 28, Medium: 23, High: 19 }[o.quality] || 23;
    if (ext === 'webm') args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf + 10), '-deadline', 'realtime', '-cpu-used', '6', '-row-mt', '1');
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p');
    if (a.length) args.push(...(ext === 'webm' ? ['-c:a', 'libopus', '-b:a', '128k'] : ['-c:a', 'aac', '-b:a', '160k']));
    args.push(file);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = ''; ff.stderr.on('data', (d) => { ffErr += d; });
    helper.stdout.pipe(ff.stdin); ff.stdin.on('error', () => {}); helper.stdout.on('error', () => {});
    const closed = new Promise((res) => ff.on('close', res));
    this.cur = { helper, ff, file, closed, getErr: () => ffErr };
    this.segStart = Date.now();
  }
  async endSegment() {
    const c = this.cur; if (!c) return; this.cur = null;
    this.elapsed += Date.now() - this.segStart;
    c.helper.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 150));
    c.ff.kill('SIGINT');
    const t = setTimeout(() => c.ff.kill('SIGKILL'), 6000);
    await c.closed; clearTimeout(t);
    if (fs.existsSync(c.file) && fs.statSync(c.file).size > 0) this.segs.push(c.file);
  }
  start(opts) { this.reset(); this.opts = opts; this.active = true; this.startSegment(); }
  ms() { return this.elapsed + (this.cur ? Date.now() - this.segStart : 0); }
  async pause() { if (!this.active || this.paused) return; this.paused = true; await this.endSegment(); }
  resume() { if (!this.active || !this.paused) return; this.paused = false; this.startSegment(); }
  async stop() {
    if (!this.active) return null;
    await this.endSegment();
    const o = this.opts; const dir = o.dir; fs.mkdirSync(dir, { recursive: true });
    const out = uniquePath(dir, 'Recording ' + stamp(), o.vid);
    const segs = this.segs.slice(); const ms = this.elapsed;
    this.reset();
    if (!segs.length) throw new Error('Nothing was recorded.');
    if (segs.length === 1) { try { fs.renameSync(segs[0], out); } catch (e) { fs.copyFileSync(segs[0], out); fs.rmSync(segs[0], { force: true }); } }
    else {
      const list = tmp('list.txt'); fs.writeFileSync(list, segs.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
      try { await exec('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]); }
      finally { fs.rmSync(list, { force: true }); segs.forEach((s) => fs.rmSync(s, { force: true })); }
    }
    return { path: out, ms };
  }
}
module.exports = { snapshotBase, screenshot, grabOnce, toolbarVisible, audioSources, Recorder, even, tmp };
