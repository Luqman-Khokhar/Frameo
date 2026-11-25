---
name: frameo-screen-toolbar
description: Floating recording toolbar screen (timer, pause/resume, stop, hidden canary pixel). Use when editing src/renderer/toolbar.html, createToolbar/closeToolbar or tick updates in src/main.js.
---

# Recording toolbar

236x44 pill window (`TB` in main.js), frameless, transparent, always-on-top ('screen-saver' level), non-focusable, skip taskbar, shown with `showInactive`. Placed bottom-center of primary work area. Preload `preload-toolbar.js` exposes `tb.pause`, `tb.stop`, `tb.onTick`, `tb.onCount`.

Contents: drag grip, pulsing amber dot (hollow when paused), timer mm:ss (h:mm:ss over an hour), "PAUSED" label, pause/resume button (icon + aria-label swap), stop button. Whole body except buttons is a drag region.

Updates: main sends `tick` {ms, paused} every 500 ms while recording and immediately on pause/resume. Buttons send `toolbar:pause` / `toolbar:stop` (ipcMain.on).

## Canary (critical)
`.canary` 4x4 px, color #3A3C37 at left 117 / top 2. `capture.toolbarVisible` scans for that exact color in a test frame. Do not move, recolor, or remove it; if bar background changes keep canary exactly 1 unit off. If found in capture, toolbar is destroyed and controls fall back to tray (`recMode='tray'`).
