---
name: frameo-feat-trim
description: Video trim/split feature: Split (keep one range) and Trim (remove ranges), lossless vs frame-accurate export, the editor window and its IPC. Use when editing src/videocut.js, src/trimmer.js, src/renderer/trim/*, or the trim entry points in src/main.js and src/renderer/app.js.
---

# Trim & split

- Terminology (the user's): **Split** = keep ONE selected range, drop the rest. **Trim** = remove one or more ranges, join the rest.
- `src/videocut.js` is pure Node (no Electron), modelled on `compress.js`: `keepSegments(duration, mode, ranges)` (pure), `plan(info, keep, { precise, keyframes })`, `run(info, plan, mode, outDir, onProgress)` -> `{ promise, cancel }`, `preflight`, `keyframes(file)`. Tested by `test/videocut.js`.
- Lossless = stream copy, each segment START snaps forward to the next keyframe (no unwanted pre-roll); precise = re-encode (x264/aac, or vp9/opus for webm). Seek placement matters: input seeking (`-ss` before `-i`) for mp4 copy and all re-encodes; **output seeking for webm/mkv stream copy** (input seeking adds ~1 s of pre-roll there). Segments are joined with the concat demuxer. Never overwrites (`compress.uniquePath`), never touches the source.
- `src/trimmer.js` is the window (modelled on `editor.js`): the file path lives in main, the renderer never sends a path for export; IPC `trim:plan|export|cancel|reveal|open-result|close` all check `own(e)`. Renderer: `src/renderer/trim/` (shared `style.css` tokens). `hide()/restore()` keep it out of captures; it is hidden next to `editor.hide()` in main.js.
- main.js `trim:open`: path validated with `videoPath()`; output beside the source only if `picked.has(f) || itemPath(f)`, else `compressDir`. Recording blocks opening; a running export blocks recording (same `'compressing'` error as compression); `before-quit` cancels it. `recents-changed` refreshes the list after an export.
- Tests: `test/videocut.js` (engine), `test/e2e-trim.js` (window, mouse/keyboard), `test/e2e-trim-app.js` (entry points, output policy, guards).
