---
name: frameo-capture
description: Architecture and invariants of Frameo's capture pipeline (xcap helper, ffmpeg, toolbar exclusion canary). Use before editing src/capture.js, native/xcap.c, or recording/toolbar logic in src/main.js.
---

# Capture pipeline

- `native/xcap.c` grabs the X root window and rebuilds pixels under Frameo's own windows (matched by `--pid` / `--class frameo`) from a clean base snapshot (`--save-base`, `--base`). Modes: `--once <file>` (one raw bgr0 frame) and `--stream --fps N` (raw frames on stdout).
- `src/capture.js`: `grabOnce`, `snapshotBase`, `screenshot` (raw -> ffmpeg -> png/jpg/webp), `Recorder` (segments; pause ends a segment, stop concat-copies them), `audioSources` (PulseAudio monitors + mic).
- Rect sizes must be even (`even()`); encoders need even dimensions.
- Toolbar canary: pixel #3A3C37 near the toolbar's top-left. `toolbarVisible()` scans for it; if found before recording, toolbar closes and controls move to the tray. Never record with controls visible.
- Env overrides `FRAMEO_TEST_PID` / `FRAMEO_TEST_CLASS` exist only for the negative-control test. Do not use otherwise.

- Live ink: the overlay window titled `capture.KEEP_TITLE` ("Frameo ink overlay", src/live.js) is passed to xcap via `--keep-title`, so it is NOT excluded and is redrawn over repaired areas (toolbar/palette stay excluded). Never give another Frameo window that title.

# Invariants
- Clean base snapshot is taken BEFORE any Frameo window is shown.
- Wayland: block capture, show banner.
- Keep ffmpeg args and stream piping order intact unless fixing a verified bug; test with test/smoke.js.
