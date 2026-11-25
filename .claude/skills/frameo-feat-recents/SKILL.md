---
name: frameo-feat-recents
description: Recent captures feature: listing, thumbnails, durations, open/reveal/copy/delete. Use when editing itemFor/recents or item:* IPC in src/main.js, or recentHtml in src/renderer/app.js.
---

# Recents

`recents()`: reads `settings.saveDir`, keeps files matching `^(Screenshot|Recording) .*\.(png|jpg|webp|mp4|webm)$`, sorts by mtime desc, top 12, maps through `itemFor`.

`itemFor(file)` -> { path, name, kind (rec if name starts "Recording "), mtime, bytes, dur, thumb }. Screenshot thumb: nativeImage resize 112 px to data URL. Recording thumb: ffmpeg frame at 0.3 s scaled to 112 px cached in `userData/thumbs`; duration via ffprobe. Thumbnails are optional (errors swallowed).

UI: rows with thumbnail button (opens preview), name, meta line ("Recording · mm:ss · Today, 3:04 PM" / "Screenshot · ..."), actions Open, Reveal, Delete. Header has "Open folder". Empty state suggests the region shortcut. Refreshed on capture, folder change, delete, and window becoming visible.

IPC: `item:delete` (shell.trashItem, returns bool), `item:reveal`, `item:open`, `item:copy` (image to clipboard), `dir:choose`. File naming must stay "Screenshot ..." / "Recording ..." or items disappear from the list.
