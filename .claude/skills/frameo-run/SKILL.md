---
name: frameo-run
description: Build, run, test and package Frameo (Electron screenshot/recorder for Linux X11). Use when asked to start the app, compile the native helper, run the smoke test, or build .deb/AppImage.
---

# Frameo build / run / test

System deps: `ffmpeg pulseaudio-utils build-essential libx11-dev nodejs npm`. Node 18+. X11 session only (Wayland blocked).

```
npm install
npm run build:native   # make -C native -> native/xcap (gitignored binary)
npm start              # builds native, then electron .
npm run dist           # deb + AppImage into dist/
```

Headless smoke test (screenshot, region, record, pause/resume, toolbar exclusion):
```
xvfb-run -a npx electron --no-sandbox test/smoke.js
```
Output lands in /tmp/frameo-smoke. Exit code 0 = pass.

Notes: `native/xcap` must exist before capture works. Never commit it or `dist/`. Not yet verified on a real Mint desktop.
