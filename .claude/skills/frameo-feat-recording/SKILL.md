---
name: frameo-feat-recording
description: Screen recording feature: start with countdown, clean base snapshot, toolbar check, pause/resume segments, stop and concat, formats and quality. Use when editing startRecording/pauseResume/stopRecording in src/main.js or Recorder in src/capture.js.
---

# Recording

`startRecording(rect)`: blocked check -> hide main -> countdown (`cd`) -> `snapshotBase` (all Frameo windows hidden) -> create toolbar, wait 500 ms, `toolbarVisible` canary check (fallback to tray mode with notice) -> `Recorder.start` with rect, base, fps, quality, vid, dir, audio sources -> tray icon becomes recording, 500 ms ticker.

`Recorder` (capture.js): each segment = xcap `--stream --fps N` piped into ffmpeg stdin (rawvideo bgr0). Video: mp4 libx264 veryfast crf by quality (Low 28, Medium 23, High 19), pix_fmt yuv420p; webm libvpx-vp9 crf+10 realtime. Audio via pulse inputs, multiple sources mixed with amix (normalize=0), aac 160k or opus 128k. Pause ends the segment (helper SIGTERM, then ffmpeg SIGINT, SIGKILL after 6 s); resume starts a new one. Stop concatenates segments with ffmpeg concat demuxer `-c copy` (single segment is just renamed) into `Recording <stamp>.<ext>`. Elapsed time sums segment durations.

Controls: toolbar, tray menu (Pause/Resume, Stop), shortcuts rec (toggle) and pause. `stopRecording` closes toolbar, restores tray, removes base file, shows main with preview of the new file.

Rules: rect must be even-sized; never start recording if toolbar is visible in capture without moving controls to tray; clean temp files (`tmp()` paths under os.tmpdir with pid prefix).

- Screenshots taken while recording never call `notify()` (a shell notification would be drawn into the video); feedback goes to the toolbar tick (`shotFeedback` in src/main.js) or a tray menu label in tray mode.
- Multi-screen: `src/displays.js` resolves the Screen setting to a display and a full-screen rect (null = whole X root). `startRecording(null)` / `doScreenshot(null)` use `scr().rect`; toolbar, countdown, overlay and live ink use `target()`.
