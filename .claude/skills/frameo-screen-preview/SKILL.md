---
name: frameo-screen-preview
description: Preview modal and toast in the Frameo main window (image/video viewer with delete, reveal, copy, open). Use when editing renderPreview or toast in src/renderer/app.js.
---

# Preview modal + toast

`#preview` overlay inside the main window, rendered by `renderPreview()` from `S.preview`.

- Header: file name + close (`pv-close`). Esc also closes.
- Media: `<video controls preload=metadata>` for recordings, `<img>` for screenshots; URL = `file://` + encodeURI(path) with `#` escaped. CSP in index.html allows `file:` for img/media only.
- Info row: kind, duration (recordings), size (`fmtSize`), shield note "controls aren't in this capture".
- Recordings also get a Compress button (opens the compress modal, see frameo-feat-compress; a just-recorded file is flagged `fresh`).
- Actions: Delete (`pv-del` -> trash), Reveal (`pv-reveal`), Copy (`pv-copy`, screenshots only, clipboard.writeImage) or Open in player (`pv-open`, recordings), Done.
- Auto-opens after every capture: `captured` event from main sets `S.preview` to the new item.

Toast: `toast(msg)` shows a 2.2 s confirmation (revealed, moved to Trash, copied).

Keep CSP strict; do not add remote media. Delete uses `shell.trashItem`, never permanent unlink.
