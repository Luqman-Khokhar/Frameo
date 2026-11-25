---
name: frameo-feat-tray
description: System tray feature: tray icon states, context menu, close-to-tray, single instance, hidden launch. Use when editing setTray/updateTray or lifecycle code in src/main.js.
---

# Tray

Icons: `assets/tray.png` idle, `assets/tray-rec.png` recording (resized 22x22). Click opens main window.

Menu (`updateTray`, rebuilt on state change and every 500 ms while recording): idle = Capture screen, Capture region…, Record screen; recording = status line "Recording/Paused mm:ss" (disabled), Pause/Resume, Stop recording; always Open Frameo and Quit (sets `app.isQuitting`). Tooltip shows state and time.

Close behaviour: closing main window hides it when `settings.tray` is true, otherwise quits via window-all-closed (stays alive in tray handler is a no-op). `--hidden` argv starts without a window (used by autostart). `requestSingleInstanceLock`; second instance just shows main window. Tray mode is also the fallback control surface when toolbar cannot be hidden from capture.
