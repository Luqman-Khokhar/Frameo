---
name: frameo-screen-overlay
description: Region selection overlay screen (fullscreen transparent window to drag, move, resize an area with ratio lock and presets). Use when editing src/renderer/overlay.html/js/css or pickRegion in src/main.js.
---

# Region overlay

Created by `pickRegion(init)` in main.js: frameless transparent always-on-top window covering the primary display, preload `preload-overlay.js` (exposes `ov.onInit`, `ov.done`). Main sends `init` with { mode, size, lock, ratio, dim, badge, ratios, confirm, scale }. Result goes back via `overlay:done` -> promise resolves { rect (physical px), lock, ratio } or null.

## Elements
`#dim` full dim (hidden once a rect exists), `#hint` "Drag anywhere to select an area", `#sel` selection with 8 handles (`.h[data-h]`) and box-shadow dim outside, `#badge` live W x H px (physical = css px * scale), `#bar` floating action bar: ratio chips (16:9, 4:3, 1:1, 9:16), Lock ratio, Cancel (Esc), confirm button (label from `confirm`: Capture / Start recording).

## Behaviour
Drag new rect; drag inside to move; drag handles to resize (`resize()` keeps ratio when locked, min 24 px, clamped to screen). Tiny drags (<12 px) restore previous rect. Enter confirms, Esc cancels. Initial `size` (physical) is converted to css px and centered. Dim level from `settings.dim`.

## Rules
DIP to physical conversion is `toPhys` in main.js using primary display scaleFactor. Overlay covers primary display only. Colors are hardcoded here (charcoal #3A3C36, cream #FCF0DA, amber #F2C46A) because overlay.css is standalone.
