# Frameo for Linux Mint

Offline screenshot and screen-recording app (Electron). Cream/olive/amber/charcoal UI, tray icon, global shortcuts, region overlay, and a floating always-on-top recording toolbar that is kept out of your captures.

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
```
## Package (.deb and AppImage)
```
npm run dist           # output in dist/
sudo apt install ./dist/frameo_*.deb
```
The .deb pulls in ffmpeg and pulseaudio-utils. The AppImage does not bundle them: install `ffmpeg` and `pulseaudio-utils` on the system first.
## Compress videos
After a recording, or from "Compress a video…" (or by dropping a video onto the window), choose Original, Medium (about half the size) or Low (about a fifth). A copy named `… (medium).mp4` or `… (low).mp4` is saved to Downloads (changeable in Settings → Capture). A video you just recorded is replaced by the compressed one (the original goes to Trash); other videos are never changed.

## Default shortcuts
Ctrl+Alt+1 full-screen shot · Ctrl+Alt+2 region shot · record start/stop and pause/resume are in Settings → Shortcuts (all changeable).

## How the toolbar is kept out of captures
Frameo grabs the X root window, then rebuilds the pixels under its own windows from a clean snapshot taken before the toolbar appeared (other windows are re-blitted in stacking order). Before every recording, a hidden marker pixel in the toolbar is checked in a test capture. If it shows up, the toolbar is closed and controls move to the tray, with a notice. Frameo never silently records its own controls.

## Limits (stated plainly)
- **Wayland is unsupported.** Choose the Cinnamon (X11) session at login. Frameo shows a banner and blocks capture on Wayland.
- Tested here only on Xvfb with headless Electron (screenshot, region, recording, pause/resume, toolbar exclusion, and a negative control that correctly falls back to the tray). **Not yet run on a real Mint desktop**, so Cinnamon/Muffin behavior and audio devices are untested.
- Cinnamon panel and menus are drawn by the shell; they can appear in captures differently from normal windows.
- Window fade-out animations need about 450 ms to finish before screenshots.
- The region overlay covers the primary display only.
- A screenshot taken during a recording reuses that recording's clean base snapshot.
- Audio uses PulseAudio/PipeWire (`pactl`): System audio and Speaker output read an output device's monitor; the microphone uses the device chosen in Settings → Audio.
