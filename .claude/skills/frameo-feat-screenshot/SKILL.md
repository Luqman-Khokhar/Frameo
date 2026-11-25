---
name: frameo-feat-screenshot
description: Screenshot feature: full screen, region, custom size capture, file naming and formats. Use when editing doScreenshot/regionScreenshot in src/main.js or screenshot() in src/capture.js.
---

# Screenshot

Entry points: main window Go button (`shot` IPC), tray "Capture screen" / "Capture region…", global shortcuts shotFull / shotRegion.

Flow (`doScreenshot(rect)`): check `blocked()` (wayland/helper/ffmpeg/busy) -> hide main window and wait 450 ms (WM fade) unless a recording is active -> `capture.screenshot`: xcap `--once` raw frame (with `--base` if recording) -> ffmpeg converts bgr0 raw to png/jpg (q 2)/webp (quality 92) -> file `Screenshot YYYY-MM-DD HH-MM-SS.ext` (`uniquePath` adds " (2)") in `settings.saveDir` -> `itemFor` builds item -> show main + emit `captured` (or desktop notification when recording).

Region flow: `regionScreenshot` opens overlay with confirm "Capture", then `doScreenshot(rect)`. Cancel restores the main window.

During a recording, screenshots reuse that recording's clean base snapshot (`recBase`), main window stays untouched.

Errors: `errInfo` classifies save errors (EACCES, EROFS, ENOSPC...) vs capture errors; main window shows a banner. `busy` flag blocks concurrent captures.
