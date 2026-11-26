# Changelog

## Unreleased
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
