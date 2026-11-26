# Frameo for Linux Mint

Offline screenshot and screen-recording app (Electron) for Linux Mint (Cinnamon on X11). Warm cream, olive and amber UI with light and dark themes. Its own windows never appear in your captures.

## Features
- **Screenshots:** full screen, region (drag, move, resize, ratio presets) or an exact custom size. PNG, JPG or WebP.
- **Screen recording:** MP4 or WebM, pause/resume, system audio, microphone and speaker output with live level meters, optional countdown.
- **Floating recording toolbar** that is kept out of the video: timer, pause, stop, draw on screen, and a **one-click screenshot** button. The screenshot is saved instantly and silently (no preview, no notification, nothing drawn into the recording); the button shows a green tick.
- **Draw on screen while recording:** pen, line, arrow, rectangle, ellipse, text and eraser; the ink stays in the video.
- **Annotation editor** for screenshots: the same tools, undo/redo, colors and stroke sizes, copy or save an edited copy.
- **Multi-screen:** with two or more displays a **Screen** picker appears (each display, plus "All screens" for full-screen shots). Full screen, the region overlay, the countdown, the toolbar and live drawing follow the chosen display.
- **Trim and split videos** (see below) and **compress videos** (see below).
- Tray icon, global shortcuts you can rebind (with conflict detection), launch at login, recent captures with thumbnails.

## Requirements (Linux Mint, Cinnamon on X11)
```
sudo apt install ffmpeg pulseaudio-utils build-essential libx11-dev nodejs npm
```
Node 18+ is needed (use NodeSource or nvm if your repo version is older).

## Run
```
npm install
npm run build:native   # compiles native/xcap (the X11 capture helper)
npm start
```

## Test
```
npm test               # unit tests + Electron tests (uses xvfb-run when there is no display)
npm run test:real      # end-to-end on your real X11 desktop with real audio devices (briefly shows Frameo windows)
```

## Package (.deb and AppImage)
```
npm run dist           # output in dist/
sudo apt install ./dist/frameo_*.deb
```
The .deb pulls in ffmpeg and pulseaudio-utils. The AppImage does not bundle them: install `ffmpeg` and `pulseaudio-utils` on the system first.

## Compress videos
When a recording finishes, the preview offers one-click Medium and Low buttons with the estimated size. You can also use the compress icon on any recording in Recent, or "Compress a video…" (or drop a video onto the window), and choose Original, Medium (about half the size) or Low (about a fifth). A copy named `… (medium).mp4` or `… (low).mp4` is saved to Downloads (changeable in Settings → Capture). A video you just recorded is replaced by the compressed one (the original goes to Trash); other videos are never changed.

## Trim and split videos
Open **Trim a video…** (header of the Recent list), the scissors icon on a recording, or **Trim** in a recording's preview. A window opens with the video and a timeline.
- **Split** keeps one selected part and drops the rest. Drag the handles on the timeline or type exact times.
- **Trim** removes one or more marked parts (add each with **R**) and joins what is left into one video.
- Export is **lossless and near-instant** by default: no quality loss, but cuts start on the next keyframe (Frameo recordings have one about every 2 s). Turn on **Frame-accurate** to re-encode for exact cut points (slower).
- The original is never changed. The result is saved beside it as `… (split).mp4` or `… (trim).mp4` (videos that Frameo does not manage are saved to the Compress folder).
- Keys: Space play/pause, arrows step one frame (Shift: one second), **I**/**O** set start/end at the playhead, **R** add a part, **Delete** remove it. While playing in Trim mode, removed parts are skipped so you hear the result.

## Default shortcuts
Ctrl+Alt+1 full-screen shot · Ctrl+Alt+2 region shot · Ctrl+Alt+3 start/stop recording · Ctrl+Alt+P pause/resume · Ctrl+Alt+A draw on screen while recording. All can be changed in Settings → Shortcuts.

## How the toolbar is kept out of captures
Frameo grabs the X root window, then rebuilds the pixels under its own windows from a clean snapshot taken before the toolbar appeared (other windows are re-blitted in stacking order). Before every recording, a hidden marker pixel in the toolbar is checked in a test capture. If it shows up, the toolbar is closed and controls move to the tray, with a notice. Frameo never silently records its own controls.

## Limits (stated plainly)
- **Wayland is unsupported.** Choose the Cinnamon (X11) session at login. Frameo shows a banner and blocks capture on Wayland. Windows and macOS are not supported either (the capture helper and audio handling are X11 and PulseAudio specific).
- Verified on Linux Mint 22 (Cinnamon, X11) with `npm run test:real`: screenshots, recording with audio, toolbar exclusion, live drawing, the editor and the toolbar screenshot button. The multi-screen picker is tested by splitting one real screen into two logical displays; it has not yet been tried with a physical second monitor.
- Cinnamon panel and menus are drawn by the shell; they can appear in captures differently from normal windows.
- Window fade-out animations need about 450 ms to finish before screenshots.
- A screenshot taken during a recording reuses that recording's clean base snapshot.
- If a recording is interrupted (crash, killed process), the video is kept up to about the last 2 seconds.
- Audio uses PulseAudio/PipeWire (`pactl`): System audio and Speaker output read an output device's monitor; the microphone uses the device chosen in Settings → Audio.

## License
MIT. See `LICENSE`.
