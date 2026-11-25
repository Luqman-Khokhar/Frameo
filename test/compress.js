// Compression engine test (no Electron): node test/compress.js
const fs = require('fs'); const os = require('os'); const path = require('path'); const cp = require('child_process');
const c = require('../src/compress.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-ctest-')); const outDir = path.join(dir, 'out');
const ok = (cond, msg) => { if (!cond) { console.error('[compress] FAIL', msg); process.exit(1); } console.log('[compress] ok  ', msg); };
(async () => {
  const src = path.join(dir, 'Recording test.mp4');
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=60', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '20', '-c:v', 'libx264', '-crf', '14', '-preset', 'veryfast', '-c:a', 'aac', src]);
  const info = await c.probe(src);
  ok(info.w === 1920 && info.h === 1080 && info.hasAudio && Math.abs(info.duration - 20) < 1, 'probe ' + JSON.stringify({ w: info.w, h: info.h, fps: info.fps, d: info.duration, mb: (info.bytes / 1048576).toFixed(1) }));
  for (const key of ['medium', 'low']) {
    const pl = c.plan(info, key); ok(pl.ok, key + ' plan ' + pl.height + 'p ' + pl.fps + 'fps ' + pl.videoK + 'k est ' + (pl.targetBytes / 1048576).toFixed(1) + ' MB');
    let last = 0; const job = c.run(info, pl, outDir, (p) => { last = p.pct; });
    const r = await job.promise; const ratio = r.bytes / pl.targetBytes;
    ok(fs.existsSync(r.path) && r.path.endsWith('(' + key + ').mp4'), key + ' file ' + path.basename(r.path));
    ok(r.bytes < info.bytes, key + ' smaller: ' + (r.bytes / 1048576).toFixed(2) + ' MB vs est ' + (pl.targetBytes / 1048576).toFixed(2) + ' MB (x' + ratio.toFixed(2) + ')');
    ok(ratio < 1.1 && ratio > 0.6, key + ' within estimate band 0.6-1.1');
    ok(last > 0.9, key + ' progress reached ' + last.toFixed(2));
    const after = await c.probe(r.path); ok(after.h <= pl.height && after.fps <= pl.fps + 0.5 && after.hasAudio, key + ' output ' + after.w + 'x' + after.h + ' ' + after.fps.toFixed(1) + 'fps');
  }
  const short = c.plan({ ...info, duration: 36000, bytes: info.bytes }, 'low'); ok(!short.ok && short.reason, 'infeasible plan rejected: ' + short.reason);
  const job = c.run(info, c.plan(info, 'medium'), outDir); setTimeout(() => job.cancel(), 800);
  let cancelled = false; try { await job.promise; } catch (e) { cancelled = !!e.cancelled; }
  ok(cancelled, 'cancel works'); ok(!fs.readdirSync(os.tmpdir()).some((n) => n.startsWith('frameo-cmp-')), 'temp dir cleaned');
  ok(c.outputName('/x/Rec (medium).webm', 'low') === 'Rec (low).mp4', 'output name strips old suffix');
  fs.rmSync(dir, { recursive: true, force: true }); console.log('[compress] ALL PASS');
})().catch((e) => { console.error('[compress] FAIL', e); process.exit(1); });
