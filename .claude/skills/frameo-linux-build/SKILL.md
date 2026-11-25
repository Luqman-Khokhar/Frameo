---
name: frameo-linux-build
description: Build, verify, install and troubleshoot Frameo release packages (.deb and AppImage) for Linux Mint. Use when asked to make a new build, package, release, version bump, or install the latest build.
---

# Linux Mint build (verified on Node 22 / npm 10, electron 33, electron-builder 25)

Targets: `.deb` (preferred) and `AppImage`, x64, X11 only. Output goes to `dist/` (gitignored, never commit).

## 1. Pre-flight
```
cd ~/Projects/frameo-linux
git status --short          # must be clean; commit work first
git pull
npm install
sudo apt install ffmpeg pulseaudio-utils build-essential libx11-dev   # build + runtime deps, once
```
Run checks before packaging:
```
node test/compress.js       # compression engine, ~2 min, must print ALL PASS
```
Optional app smoke test (needs an X server; no `xvfb-run` on this machine, use Xephyr):
```
Xephyr :99 -screen 1280x800 -ac &
DISPLAY=:99 npx electron --no-sandbox --disable-gpu --user-data-dir=/tmp/frameo-ud test/smoke.js
```
`--user-data-dir` matters: without it the single-instance lock quits the test when a real Frameo is running.

## 2. Version
Bump so installs upgrade cleanly (same version needs `--reinstall`):
```
npm version 0.2.0 --no-git-tag-version   # edits package.json + package-lock.json
git commit -am "chore: bump version to 0.2.0"
```
Use semver: patch = fixes, minor = new feature (e.g. compress was minor).

## 3. Build
```
npm run dist       # = build:native (make -C native) + electron-builder --linux deb AppImage
```
First run downloads Electron (~100 MB zip, cached in ~/.cache/electron) and electron-builder helpers, so it needs internet; later runs take 1-2 min. Output:
- `dist/frameo_<version>_amd64.deb` (~72 MB)
- `dist/Frameo-<version>.AppImage` (~103 MB)
- `dist/linux-unpacked/` (raw app folder, for quick manual testing)

## 4. Verify the artifacts
```
dpkg -I dist/frameo_*.deb                      # Maintainer set, Depends: ffmpeg, pulseaudio-utils, libx11-6
dpkg -c dist/frameo_*.deb | grep -E "xcap|app.asar|frameo.desktop"
ls -la dist/linux-unpacked/resources/bin/xcap  # must exist and be executable
npx asar list dist/linux-unpacked/resources/app.asar | grep -E "compress.js|main.js"
```
Packaged capture helper lives at `/opt/Frameo/resources/bin/xcap` (`system.helperPath` reads `process.resourcesPath/bin/xcap` when packaged). If xcap is missing the app shows "Capture helper not built".

## 5. Install / upgrade / remove
```
pkill ffmpeg; pkill frameo                     # stop old instance and any stuck encoder
sudo apt install ./dist/frameo_<version>_amd64.deb
sudo apt install --reinstall ./dist/frameo_*.deb   # when version is unchanged
sudo apt remove frameo                         # uninstall
```
AppImage: `chmod +x dist/Frameo-*.AppImage && ./dist/Frameo-*.AppImage`. If it will not start, install FUSE (`libfuse2`, `libfuse2t64` on Mint 22) and try `--no-sandbox` (Ubuntu 24.04 based releases restrict user namespaces; the .deb installs the sandbox helper with correct permissions, so prefer the .deb).
After upgrading, toggle "Launch at login" off and on once so the autostart entry points at the new binary. User must log into the Cinnamon (X11) session.

## 6. Troubleshooting
- `Please specify author 'email'`: package.json `author` must be an object with name and email (set to Luqman Khokhar). Required for the .deb maintainer field.
- `xcap.c` compile errors or `X11/Xlib.h` missing: `sudo apt install libx11-dev build-essential`.
- `downloading ... failed`: first build needs internet; retry, or clear a corrupt cache in ~/.cache/electron and ~/.cache/electron-builder.
- Build seems stuck on a changed file list: delete `dist/` and rebuild (`rm -rf dist`).
- Package too big: `files` in package.json limits app contents to src, assets, package.json; the size is mostly the Electron runtime.

## 7. After the build
Do not commit `dist/`. Tagging (`git tag v0.2.0`), pushing, or uploading a GitHub release are outward-facing: ask the user first. Git identity and one-line commit rules are in the personal git-commit skill.
