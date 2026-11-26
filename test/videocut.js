// Pure-Node test for the video cutting engine (needs ffmpeg/ffprobe): node test/videocut.js
const assert = require('assert'); const fs = require('fs'); const os = require('os'); const path = require('path'); const cp = require('child_process');
const cut = require('../src/videocut');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-cut-test-')); const outDir = path.join(tmp, 'out');
const log = (...a) => console.log('[videocut]', ...a);
let n = 0; const t = async (name, f) => { await f(); n++; log('ok  ', name); };
const probeNum = (f, e) => parseFloat(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', e, '-of', 'csv=p=0', f]).toString().split('\n')[0]);
const streams = (f) => cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f]).toString().trim().split('\n');
const firstIsKey = (f) => /K/.test(cp.execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=flags', '-of', 'csv=p=0', '-read_intervals', '%+#1', f]).toString());
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a.toFixed(3)}, want ${b} ±${tol}`);
const cutDirs = () => fs.readdirSync(os.tmpdir()).filter((x) => x.startsWith('frameo-cut-') && !x.startsWith('frameo-cut-test-')).length;

(async () => {
  // ---- pure logic ----
  await t('split keeps one range, clamped', () => { assert.deepStrictEqual(cut.keepSegments(30, 'split', [[5, 15]]), [[5, 15]]); assert.deepStrictEqual(cut.keepSegments(30, 'split', [[25, 99]]), [[25, 30]]); assert.deepStrictEqual(cut.keepSegments(30, 'split', [[15, 5]]), [[5, 15]]); });
  await t('trim removes ranges and keeps the rest in order', () => { assert.deepStrictEqual(cut.keepSegments(30, 'trim', [[20, 24], [3, 7]]), [[0, 3], [7, 20], [24, 30]]); });
  await t('trim merges overlapping and adjacent ranges', () => { assert.deepStrictEqual(cut.keepSegments(30, 'trim', [[3, 8], [6, 10], [10, 12]]), [[0, 3], [12, 30]]); });
  await t('trim at the edges', () => { assert.deepStrictEqual(cut.keepSegments(30, 'trim', [[0, 5]]), [[5, 30]]); assert.deepStrictEqual(cut.keepSegments(30, 'trim', [[25, 30]]), [[0, 25]]); });
  await t('rejections', () => {
    assert.throws(() => cut.keepSegments(30, 'trim', [[0, 30]]), /Nothing would be left/); assert.throws(() => cut.keepSegments(30, 'trim', []), /at least one/);
    assert.throws(() => cut.keepSegments(30, 'split', [[1, 2], [5, 6]]), /one range/); assert.throws(() => cut.keepSegments(30, 'split', [[1, 1.05]]), /shorter/);
    assert.throws(() => cut.keepSegments(30, 'split', [[40, 50]]), /shorter|outside/); assert.throws(() => cut.keepSegments(30, 'split', [['a', 2]]), /invalid/);
    assert.throws(() => cut.keepSegments(0, 'split', [[0, 1]]), /length/); assert.throws(() => cut.keepSegments(30, 'nope', [[0, 1]]), /mode/);
  });
  await t('lossless plan snaps starts forward to keyframes, precise does not', () => {
    const info = { bytes: 3000, duration: 30 }, kf = [0, 2, 4, 6, 8, 10];
    const a = cut.plan(info, [[5, 9]], { keyframes: kf }); assert.strictEqual(a.segments[0].start, 6); assert.strictEqual(a.segments[0].from, 5); assert.ok(a.snapped); assert.strictEqual(a.total, 3);
    const b = cut.plan(info, [[5, 9]], { precise: true, keyframes: kf }); assert.strictEqual(b.segments[0].start, 5); assert.ok(!b.snapped);
    const c = cut.plan(info, [[6.2, 7.5]], { keyframes: kf }); assert.strictEqual(c.ok, false); assert.match(c.reason, /Frame-accurate/);
  });
  await t('output names', () => { assert.strictEqual(cut.outputName('/a/Recording x.mp4', 'split'), 'Recording x (split).mp4'); assert.strictEqual(cut.outputName('/a/Recording x (trim).webm', 'trim'), 'Recording x (trim).webm'); assert.strictEqual(cut.outputName('/a/clip.MKV', 'trim'), 'clip (trim).MKV'); });

  // ---- real ffmpeg ----
  const src = path.join(tmp, 'Recording test.mp4');
  cp.execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '30', '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '50', '-keyint_min', '50', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src]);
  const info = await cut.probe(src); const kf = await cut.keyframes(src); const srcStat = fs.statSync(src); const srcSize = srcStat.size, srcM = srcStat.mtimeMs;
  await t('keyframes read (every 2 s)', () => { assert.ok(kf.length >= 14 && kf.length <= 16, 'count ' + kf.length); near(kf[3], 6, 0.05, 'keyframe 3'); });
  const go = async (mode, ranges, opts) => { const pl = cut.plan(info, cut.keepSegments(info.duration, mode, ranges), { keyframes: kf, ...opts }); assert.ok(pl.ok, pl.reason); cut.preflight(pl, outDir); const r = cut.run(info, pl, mode, outDir); return { pl, res: await r.promise }; };

  await t('lossless split: only the selected part, starts on a keyframe, audio kept', async () => {
    const { pl, res } = await go('split', [[5, 15]]); assert.strictEqual(pl.segments[0].start, 6);
    near(probeNum(res.path, 'format=duration'), 9, 0.4, 'duration'); assert.ok(firstIsKey(res.path), 'first packet is a keyframe'); assert.ok(streams(res.path).includes('audio'), 'audio kept'); assert.ok(/\(split\)\.mp4$/.test(res.path));
  });
  await t('lossless trim of two ranges joins the rest', async () => {
    const { res } = await go('trim', [[3, 7], [20, 24]]); near(probeNum(res.path, 'format=duration'), 21, 0.6, 'duration (0-3, 8-20, 24-30)'); assert.ok(streams(res.path).includes('audio'));
  });
  await t('precise split is frame-accurate', async () => {
    const { res } = await go('split', [[5.3, 12.7]], { precise: true }); near(probeNum(res.path, 'format=duration'), 7.4, 0.15, 'duration'); assert.strictEqual(probeNum(res.path, 'stream=width'), 320); assert.ok(streams(res.path).includes('audio'));
  });
  await t('precise trim of two ranges is exact', async () => {
    const { res } = await go('trim', [[3, 7], [20, 24]], { precise: true }); near(probeNum(res.path, 'format=duration'), 22, 0.25, 'duration (0-3, 7-20, 24-30)');
  });
  await t('outputs never overwrite; original untouched', async () => {
    const a = await go('split', [[2, 6]]), b = await go('split', [[2, 6]]); assert.notStrictEqual(a.res.path, b.res.path); assert.ok(fs.existsSync(a.res.path) && fs.existsSync(b.res.path));
    const s = fs.statSync(src); assert.strictEqual(s.size, srcSize); assert.strictEqual(s.mtimeMs, srcM);
  });
  await t('progress reaches 100%', async () => {
    const pl = cut.plan(info, cut.keepSegments(30, 'split', [[1, 12]]), { precise: true }); const seen = []; await cut.run(info, pl, 'split', outDir, (p) => seen.push(p.pct)).promise;
    assert.ok(seen.length >= 2 && seen[seen.length - 1] === 1 && seen.every((v, i) => i === 0 || v >= seen[i - 1] - 1e-9), 'monotonic, ends at 1: ' + seen.slice(-3));
  });
  await t('cancel leaves no output and no temp dir', async () => {
    const before = cutDirs(), files = fs.readdirSync(outDir).length;
    const pl = cut.plan(info, cut.keepSegments(30, 'trim', [[10, 11]]), { precise: true }); const job = cut.run(info, pl, 'trim', outDir);
    setTimeout(() => job.cancel(), 250); await assert.rejects(job.promise, (e) => e.cancelled === true);
    assert.strictEqual(fs.readdirSync(outDir).length, files); assert.strictEqual(cutDirs(), before);
  });
  await t('webm lossless + precise', async () => {
    const w = path.join(tmp, 'clip.webm'); cp.execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=160x120:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=330', '-t', '8', '-c:v', 'libvpx-vp9', '-g', '25', '-b:v', '200k', '-c:a', 'libopus', '-shortest', w]);
    const wi = await cut.probe(w); const wk = await cut.keyframes(w);
    const pl = cut.plan(wi, cut.keepSegments(wi.duration, 'split', [[2.2, 6]]), { precise: true, keyframes: wk }); const r = await cut.run(wi, pl, 'split', outDir).promise; near(probeNum(r.path, 'format=duration'), 3.8, 0.25, 'webm precise');
    const pl2 = cut.plan(wi, cut.keepSegments(wi.duration, 'split', [[2, 6]]), { keyframes: wk }); const r2 = await cut.run(wi, pl2, 'split', outDir).promise; near(probeNum(r2.path, 'format=duration'), 4, 0.5, 'webm lossless');
  });
  fs.rmSync(tmp, { recursive: true, force: true }); log(n + ' tests', 'ALL PASS');
})().catch((e) => { console.error('[videocut] FAIL', e); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); });
