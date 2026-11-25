---
name: frameo-feat-audio
description: Audio feature: system audio, microphone, speaker output sources, device probing via pactl, live level meters. Use when editing audioRows/meters in src/renderer/app.js, audioSources in src/capture.js, or probe in src/system.js.
---

# Audio

Probe (`system.probe`): `pactl -f json list sinks|sources` (fallback to `list short`), default sink via `pactl get-default-sink`. Mics = sources that are not monitors. `audioOk` = at least one sink.

Toggles (settings.audio): `sys`, `mic`, `spk`. Shown only in Recording mode (`audioRows`); unavailable rows are disabled with reason text. `sys` and `spk` on the same device are captured once ("Same device as System audio").

`capture.audioSources`: sys -> `<defaultSink>.monitor`; spk -> `<chosen sink || default>.monitor` (deduped); mic -> chosen mic if still present else first mic. Result list feeds ffmpeg pulse inputs.

Devices chosen in Settings -> Audio (`mic`, `sink`). Names persisted are pulse source/sink names.

Live meters: `syncMeters` opens getUserMedia streams only for switched-on rows in Recording mode, matches device by label ("Monitor of <sink description>"), AnalyserNode drives 10-bar meter in `tickMeters`. Stopped when leaving the screen. Only 'media' permission is granted (main.js permission handlers). No meter shown if no matching device.
