---
name: frameo-screen-settings
description: Settings screen of Frameo with tabs General, Capture, Audio, Shortcuts. Use when editing settingsHtml/defDims in src/renderer/app.js or changing settings keys in src/settings.js.
---

# Settings screen

Opened via titlebar settings button (`S.view='settings'`); back arrow returns. Rendered by `settingsHtml()`. Tabs via `data-act=tab`.

## General
Save location (path + "Change…" -> `dir:choose`), Theme light/dark, Launch at login (`launch`), Keep in tray (`tray`), Capture overlay: dimming range 10-70 (`dim`), size badge (`badge`), ratio presets (`ratios`), recording countdown Off/3/5 s (`cd`).

## Capture
Screenshots: format png/jpg/webp (`img`), default custom size (`shot`). Recordings: format mp4/webm (`vid`), quality Low/Medium/High (`quality`), fps 24/30/60 (`fps`), default custom size (`rec`). Info lines: capture engine, own-window exclusion.

## Audio
Microphone device list (`mic`), speaker output device list (`sink`), explanation text. Lists come from `env.mics` / `env.sinks`; empty-state text when none.

## Shortcuts
Four rows: shotFull, shotRegion, rec, pause. "Change" enters capture mode (`S.editKey`); next keydown with at least one modifier saves `keys.<id>`. Esc cancels. If `failedKeys` returned, note says shortcut is taken.

## Wiring
Generic controls: `data-act=toggle` (booleans), `data-act=set data-k data-v` (value; numeric strings become numbers), `data-range` inputs, `data-d="shot.w"` inputs. All persist through `api.saveSettings(patch)` -> `settings:save` in main.js -> `settings.save` (shallow merge for shot/rec/audio/keys). New setting: add to DEFAULTS in settings.js, add control here, consume in main.js/capture.js. Side effects live in the `settings:save` handler (autostart, re-register keys).
