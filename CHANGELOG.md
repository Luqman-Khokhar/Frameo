# Changelog

## Unreleased
- Recording: segments are written as fragmented mp4 (keyframe every 2 s, flushed to disk), so a crash or killed ffmpeg leaves a playable file missing at most the last ~2 s; stop remuxes to a normal faststart mp4.
- `npm run test:real`: end-to-end check on a real X11 desktop (screenshots, recording with audio, toolbar exclusion, live ink, annotate editor).

## 0.3.0 (2026-11-26)
- UI refinement: shared design tokens (accent, chrome, spacing, radii), yellow reserved for primary actions and the selected editor tool, consistent hover/pressed/disabled/focus states, thin themed scrollbars.
- Main window: denser Recording view so Recent gets more room, one-line recent rows with a clickable name, shorter times, `~` in the save path.
- Annotation editor: canvas now fills the available stage exactly (it left a gap before), no scrollbar feedback, grouped tool buttons, accent for the selected tool and Save.
- Settings: grouped rows with hairline separators; shortcuts show keycap badges, an editing state, in-app conflict detection and a confirmation toast.
- Compression is easier to find: one-click Medium / Low buttons with real size estimates in the recording preview, a visible Compress button and file size on every recording in Recent, a clearer "Compress a video…" button, and a drop hint in the empty state.
- Security: private 0700 temp dir for capture files; settings validated and written atomically; IPC restricted to the main window and to files Frameo manages.
- Recording: a dead ffmpeg or capture helper is detected and what was recorded is saved; quitting mid-recording stops and saves first.
- Electron 33 to 45.5.0; electron-builder 25 to 26.
- Microphone permission limited to the main window (audio only).
- Recent captures: recordings are probed once, thumbnails keyed by modification time and swept after 30 days, vanished files tolerated.
- Autostart entry works from a dev checkout.
- Tests: `npm test` runs everything; CI on GitHub Actions.

## 0.2.0
- Screenshot annotation editor (pen, line, arrow, rectangle, ellipse, text, pixel eraser, undo/redo).
- Draw on screen while recording; the ink stays in the recording.

## 0.1.0
- Screenshots (full, region, custom size), screen recording with pause/resume, system/mic/speaker audio, region overlay, recording toolbar kept out of captures, tray, global shortcuts, video compression.
