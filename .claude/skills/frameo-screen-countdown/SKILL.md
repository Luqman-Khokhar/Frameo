---
name: frameo-screen-countdown
description: Recording countdown screen (3/5 second circular number before recording). Use when editing src/renderer/countdown.html or countdown() in src/main.js.
---

# Countdown

`countdown(n)` in main.js opens a 220x220 transparent always-on-top non-focusable window centered on the primary display, loads `countdown.html` (reuses `preload-toolbar.js`, uses `tb.onCount`). Sends `count` i each second from n to 1, then destroys the window and waits 300 ms so the WM finishes fading it before the clean base snapshot.

Setting: `cd` in settings (0 = off, 3, 5). When 0, start waits 450 ms instead. If the window is destroyed mid-count, `countdown` returns false and `startRecording` returns { cancelled: true } and shows the main window.

Visual: charcoal circle with large number, caption "Recording starts…". Countdown window must be gone before `snapshotBase` runs, otherwise it would be baked into the clean base.
