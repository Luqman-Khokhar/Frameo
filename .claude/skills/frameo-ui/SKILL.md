---
name: frameo-ui
description: Conventions for Frameo's renderer UI and IPC (plain HTML/CSS/JS, preload bridges, settings). Use when editing src/renderer/* or adding settings/IPC channels.
---

# Renderer conventions

- No framework, no bundler: plain HTML + CSS + vanilla JS in `src/renderer/`. Do not add a second styling system or packages.
- Palette: cream / olive / amber / charcoal. Reuse the CSS variables in `style.css`; no new raw colors without need. Light and dark themes (`settings.theme`) must both work.
- Windows: main (index.html), overlay (region select), toolbar (recording controls), countdown. Each has its own preload (`preload-*.js`) using contextBridge; renderers never get Node access.
- IPC: `ipcMain.handle` in `src/main.js` (state, settings save, shot, rec start/pause/resume/stop, recents, delete, reveal, open, copy, choose). New channel = handler in main + exposure in the matching preload.
- Settings: defaults and merge logic in `src/settings.js` (nested keys shot/rec/audio/keys merge shallowly). Add new settings to DEFAULTS first.
- Accessibility: real buttons, visible focus, labels on inputs, icon-only controls get aria-label.
- Keep the toolbar's canary pixel intact (see frameo-capture).
