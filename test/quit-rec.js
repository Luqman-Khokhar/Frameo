// Quit-while-recording test: electron --no-sandbox test/quit-rec.js --hidden; the PARENT shell checks the saved file (this process exits via app.quit).
const { app } = require('electron');
const fs = require('fs'); const os = require('os'); const path = require('path');
const out = process.env.FRAMEO_QUIT_OUT || path.join(os.tmpdir(), 'frameo-quit-out');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'frameo-qr-ud-'))); // never touch the real settings.json
fs.mkdirSync(out, { recursive: true });
const m = require('../src/main.js'); const settings = require('../src/settings.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  settings.save({ saveDir: out, cd: 0, fps: 15, audio: { sys: false, mic: false, spk: false } });
  const s = await m.startRecording({ x: 50, y: 50, w: 320, h: 240 }); if (!s || !s.ok) { console.log('[quit-rec] start failed'); return app.exit(1); }
  await sleep(1500); console.log('[quit-rec] quitting mid-recording'); app.quit();
});
