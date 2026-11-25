---
name: frameo-feat-compress
description: Video compression feature: Medium/Low copies via two-pass x264, compress modal, entry points, output folder. Use when editing src/compress.js, compress IPC in src/main.js, or the compress modal in src/renderer/app.js.
---

# Video compression

Goal: make big recordings (or any video) small enough to send. Options: Original, Medium (~50% size, max 1080p, 30 fps, AAC 96k), Low (~20% size, max 720p, 24 fps, AAC 64k mono). Output is always H.264 + AAC MP4 with faststart. No trim, no hardware encoders.

## Engine (`src/compress.js`, pure Node, testable)
- `probe(file)`: ffprobe -> duration, bytes, w/h, fps, hasAudio.
- `plan(info, key)`: target bytes = bytes x factor; video kbps = target*8/duration*0.96 - audio kbps. Walks resolution down 1080/720/480/360 until bitrate >= floor (600/350/200/120 kbps). Returns { ok:false, reason } when too short/small or too long to fit.
- `run(info, plan, outDir, onProgress)` -> { promise, cancel }. Two-pass x264 (preset medium) into a temp dir; pass 1 = 40% of progress, pass 2 = 60%, parsed from `-progress pipe:1`. If result is >5% over target, redo once at a lower bitrate (`retry:true`). Output moved into outDir (copy+rename fallback), temp dir always removed. Cancel kills ffmpeg.
- `outputName`: `<name> (medium|low).mp4`, strips an old suffix; `uniquePath` adds " (2)". `preflight` checks free disk.

## Main process (`src/main.js`)
IPC: `compress:pick` (file dialog), `compress:probe` (info + plans for medium/low with estimates), `compress:start(file, key, replaceOriginal)`, `compress:cancel`. Events to renderer: `compress:progress`, `compress:done`. One job at a time (`compressJob`); refused while recording; starting a recording is refused while compressing (`error:'compressing'`). `dir:choose` takes an optional start folder.

## Rules
- Never overwrite the source. Fresh recording (preview opened right after stopping) + Medium/Low = compressed copy saved and original moved to Trash (`replaceOriginal`); anything else keeps the original.
- Output folder = `settings.compressDir` (default ~/Downloads), changeable in the modal and Settings -> Capture, remembered. Recents only scans saveDir, so compressed files are not listed there.
- UI: `#compress` modal (states probing, idle, running, done, error) reuses preview modal styles. Entry points: preview "Compress" button (recordings), recents row icon (recordings), "Compress a video…" link in Recent header, drag and drop a video onto the window (`webUtils.getPathForFile` via preload `pathFor`).
- Tests: `node test/compress.js` (engine, accuracy within band, cancel, cleanup); `test/compress-ui.js` under Electron + X server.
