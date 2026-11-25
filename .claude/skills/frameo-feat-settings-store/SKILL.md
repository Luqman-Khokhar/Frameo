---
name: frameo-feat-settings-store
description: Settings persistence feature: settings.json in userData, defaults, merge rules, autostart desktop entry, theme. Use when adding or changing settings in src/settings.js or settings:save in src/main.js.
---

# Settings store

`src/settings.js`: `load()` caches and merges DEFAULTS with `userData/settings.json` (nested shot/rec/audio/keys merged one level). `save(patch)` merges, writes JSON, returns cache. Defaults: saveDir ~/Pictures/Frameo, theme light, img png, vid mp4, quality High, fps 30, dim 42, cd 3, badge/ratios/tray on, launch off, shot/rec 1280x720, audio sys on, keys (see frameo-feat-shortcuts).

IPC `settings:save` returns { settings, failedKeys }. Side effects: `launch` change writes/removes `~/.config/autostart/frameo.desktop` (Exec uses APPIMAGE or execPath with `--hidden`); `keys` change re-registers shortcuts and rebuilds tray.

Theme: body class light/dark set in `render()`; both themes must work. Smoke test overrides settings via `settings.save` before capture.
