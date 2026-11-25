---
name: frameo-feat-environment-checks
description: Environment detection and blocking feature: Wayland block, missing helper, missing ffmpeg, banners, status footer. Use when editing blocked()/errInfo in src/main.js, probe in src/system.js, or blockedReason in src/renderer/app.js.
---

# Environment checks

`system.probe()` returns session, wayland (XDG_SESSION_TYPE), ffmpeg (spawn -version), helper (xcap found: packaged `resources/bin/xcap` or dev `native/xcap`), audio devices. Re-probed on `state` IPC and when main window becomes visible.

Main-side `blocked()`: wayland, helper, ffmpeg, busy (priority in that order). Capture actions return { error: reason }.

Renderer `blockedReason()` builds banner text: Wayland (log out, pick Cinnamon X11), helper missing (run npm run build:native, needs libx11-dev), ffmpeg missing (apt install ffmpeg). Go button disabled and footer shows "Capture unavailable" with red dot.

Never loosen the Wayland block: Wayland cannot hide Frameo's windows from capture. Keep install instructions in banner text in sync with README.
