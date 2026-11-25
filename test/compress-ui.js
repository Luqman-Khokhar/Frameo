// Headless UI test for the compress modal: xvfb-run -a npx electron --no-sandbox test/compress-ui.js
const { app } = require('electron');
const fs = require('fs'); const cp = require('child_process'); const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = '/tmp/frameo-cui'; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out + '/dl', { recursive: true });
const src = out + '/Recording 2026-01-01 10-00-00.mp4';
cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '12', '-c:v', 'libx264', '-crf', '16', '-preset', 'veryfast', '-c:a', 'aac', src]);
const m = require('../src/main.js'); const settings = require('../src/settings.js');
const log = (...a) => console.log('[cui]', ...a);
app.whenReady().then(async () => {
  settings.save({ saveDir: out, compressDir: out + '/dl', cd: 0 });
  await sleep(2500);
  const w = m.getMain(); const js = (s) => w.webContents.executeJavaScript(s);
  const shot = async (n) => fs.writeFileSync(out + '/' + n + '.png', (await w.webContents.capturePage()).toPNG());
  await js(`openCompress(${JSON.stringify(src)}, false)`); await sleep(1500); await shot('1-idle');
  log('options:', await js(`[...document.querySelectorAll('#cmpSel option')].map(o=>o.textContent+(o.disabled?' (disabled)':'')).join(' | ')`));
  await js(`document.querySelector('[data-act=cmp-go]').click()`); await sleep(1500); await shot('2-running');
  log('progress text:', await js(`document.querySelector('#cmpTxt').textContent`));
  for (let i = 0; i < 120; i++) { if (await js(`S.cmp.state==='done'||S.cmp.state==='error'`)) break; await sleep(500); }
  log('state:', await js(`S.cmp.state`), await js(`JSON.stringify(S.cmp.result||S.cmp.message)`)); await shot('3-done');
  log('files in dl:', fs.readdirSync(out + '/dl').join(', '), 'original kept:', fs.existsSync(src));
  await js(`document.querySelector('[data-act=cmp-close]').click()`);
  const bad = await js(`window.frameo.cmpProbe('/nonexistent.mp4')`); log('bad file ->', JSON.stringify(bad));
  await shot('4-main'); app.exit(0);
}).catch((e) => { console.error('[cui] FAIL', e); app.exit(1); });
