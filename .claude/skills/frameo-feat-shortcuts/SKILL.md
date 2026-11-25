---
name: frameo-feat-shortcuts
description: Global keyboard shortcuts feature: defaults, registration, rebinding UI, conflict handling. Use when editing registerKeys in src/main.js, keys in src/settings.js, or the Shortcuts tab/keydown handler in src/renderer/app.js.
---

# Shortcuts

Defaults (`settings.DEFAULTS.keys`): shotFull Control+Alt+1, shotRegion Control+Alt+2, rec Control+Alt+3 (toggle start/stop), pause Control+Alt+P.

`registerKeys()` (main.js): `globalShortcut.unregisterAll()` then registers four; returns list of labels that failed (taken by another app). Called on app ready and after any `keys` patch in `settings:save`, which returns `failedKeys` to the renderer.

Rebind UI: Settings -> Shortcuts, `key-edit` sets `S.editKey`; document keydown builds Electron accelerator (Control/Alt/Shift/Super + key; arrows trimmed, Space named). Requires at least one modifier. Esc cancels. After save, if `failedKeys` non-empty show "already used by another app".

Tray menu shows accelerators with `registerAccelerator:false` (display only). Shortcuts stay active while hidden in tray and during recording. New shortcut = add default, register in `registerKeys`, add row in the keys list, add tray label.
