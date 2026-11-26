#!/usr/bin/env bash
# Runs every test. Pure-Node tests always; Electron tests under xvfb-run (or the current $DISPLAY). Never touches your real Frameo settings.
set -euo pipefail
cd "$(dirname "$0")/.."
E="node_modules/.bin/electron --no-sandbox"
if [ -n "${DISPLAY:-}" ]; then X=""; elif command -v xvfb-run >/dev/null; then X="xvfb-run -a"; else echo "no DISPLAY and no xvfb-run: skipping Electron tests"; X="skip"; fi
node test/settings.js
node test/compress.js
[ "$X" = "skip" ] && exit 0
UD=$(mktemp -d); OUT=$(mktemp -d); trap 'rm -rf "$UD" "$OUT"' EXIT
$X $E test/ipc.js --hidden 2>&1 | grep '^\[ipc\]' | tee /dev/stderr | grep -q 'ALL PASS'
$X $E test/rec-fail.js --hidden 2>&1 | grep '^\[rec-fail\]' | tee /dev/stderr | grep -q 'ALL PASS'
FRAMEO_QUIT_OUT="$OUT" $X $E test/quit-rec.js --hidden >/dev/null 2>&1 || true
f=$(ls "$OUT"/*.mp4 2>/dev/null | head -1); [ -n "$f" ] && ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" >/dev/null && echo "[quit-rec] ok   saved $(basename "$f")" || { echo "[quit-rec] FAIL no playable file after quit"; exit 1; }
$X $E --user-data-dir="$UD" test/smoke.js 2>&1 | grep '^\[smoke\]' | tee /dev/stderr | grep -q 'rec stop: Recording'
$X $E --user-data-dir="$UD" test/compress-ui.js 2>&1 | grep '^\[cui\]' | tee /dev/stderr | grep -q 'state: done'
echo "ALL TESTS PASS"
