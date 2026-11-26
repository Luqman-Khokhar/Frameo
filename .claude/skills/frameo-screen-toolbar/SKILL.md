---
name: frameo-screen-toolbar
description: Floating recording toolbar screen (timer, pause/resume, stop, hidden canary pixel). Use when editing src/renderer/toolbar.html, createToolbar/closeToolbar or tick updates in src/main.js.
---

# Recording toolbar

236x44 pill window (`TB` in main.js), frameless, transparent, always-on-top ('screen-saver' level), non-focusable, skip taskbar, shown with `showInactive`. Placed bottom-center of primary work area. Preload `preload-toolbar.js` exposes `tb.pause`, `tb.stop`, `tb.onTick`, `tb.onCount`.

Contents: drag grip, pulsing amber dot (hollow when paused), timer mm:ss (h:mm:ss over an hour), "PAUSED" label, pause/resume button (icon + aria-label swap), stop button. Dragging is manual (CSS app-region drag does not work on this non-focusable transparent window): pointerdown on grip/timer area sends screen coords via `tb.move` -> `toolbar:move` -> `setBounds` with fixed size.

Updates: main sends `tick` {ms, paused} every 500 ms while recording and immediately on pause/resume. Buttons send `toolbar:pause` / `toolbar:stop` (ipcMain.on).

## Canary (critical)
`.canary` 4x4 px, color #3A3C37 at left 117 / top 2. `capture.toolbarVisible` scans for that exact color in a test frame. Do not move, recolor, or remove it; if bar background changes keep canary exactly 1 unit off. If found in capture, toolbar is destroyed and controls fall back to tray (`recMode='tray'`).

- Toolbar width is 308 px (TB.w in src/main.js and the .bar/.panel widths in toolbar.html). It has a camera button (`#shot`, IPC `toolbar:shot`): saves a screenshot of the recorded area via `doScreenshot(recRect)` and shows a green tick (`shot` message from main). The canary pixel stays at left:117px;top:2px.
