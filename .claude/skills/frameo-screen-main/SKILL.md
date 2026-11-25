---
name: frameo-screen-main
description: Main window screen of Frameo (480x690 frameless): titlebar, banners, mode/source selector, size fields, audio rows, recent list, status footer. Use when editing mainHtml/dimsHtml/audioRows/recentHtml in src/renderer/app.js or index.html/style.css.
---

# Main window

Files: `src/renderer/index.html` (shell: .titlebar, #banners, #view, #status, #preview, #toast), `app.js` (string-template render into #view), `style.css`. Window made in `createMain()` in main.js: 480x690, frameless, non-resizable, hides to tray on close when `settings.tray`.

## Layout (top to bottom)
1. Titlebar: logo, "Frameo", settings button (`data-act=settings`), minimize/close (`min`/`close`). Drag region; buttons use `.nodrag`.
2. Banners (`renderBanners`): blocked reason (wayland/helper/ffmpeg) + `S.banner` (save error, capture error, tray-mode info). CTA buttons use `data-act` (`fix-save`, `dismiss`).
3. Mode tabs: Screenshot / Recording (`S.mode` = shot|rec). Separate config per mode in `S.cfg`.
4. Source buttons: Full screen / Region / Custom size (`S.cfg[mode].src`).
5. Dimensions (`dimsHtml`): full = primary display size text; region/custom = W/H inputs (`data-f`), lock-ratio button, custom presets (1920x1080, 1280x720, 1080x1080, 800x600) and ratio text.
6. Audio block (recording mode only, see frameo-feat-audio).
7. Primary action button (`data-act=go`): label depends on mode+source, shows shortcut kbd, disabled when blocked or busy.
8. Recent list (see frameo-feat-recents) with empty state.
9. Footer status: ready/unavailable dot + save folder, "Controls never captured · verified".

## State
`S` object: mode, view (main|settings), tab, busy, st (settings), env (probe), recents, preview, editKey, banner, cfg. Single delegated click handler on document switches on `data-act`. Re-render with `render()`; it sets body class to theme.

## Go flow (`go()`)
Clear banner, if src != full call `api.pickRegion` (overlay), store chosen size/lock/ratio, set busy, call `api.shot` or `api.recStart`, then `handleResult`. `cancelled` result just clears busy.

## Rules
Escape every dynamic string with `esc()`. Size inputs clamp to screen px (SCR = screen * devicePixelRatio), min 16. States required: empty, error banner, busy, disabled.
