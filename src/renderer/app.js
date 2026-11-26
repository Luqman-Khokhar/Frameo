const api = window.frameo;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SCR = { w: Math.round(screen.width * devicePixelRatio), h: Math.round(screen.height * devicePixelRatio) };

const P = {
  camera: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h1.2l1-1.5h6.6l1 1.5h1.2A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"/><circle cx="10" cy="11" r="2.8"/>',
  video: '<rect x="2.5" y="5.5" width="10.5" height="9" rx="2"/><path d="M13 9l4.5-2.5v7L13 11z"/>',
  full: '<rect x="2.5" y="3.5" width="15" height="10" rx="1.8"/><path d="M7 16.5h6M10 13.5v3"/>',
  region: '<path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13"/>',
  custom: '<rect x="3" y="3" width="11" height="11" rx="1.5" stroke-dasharray="2 2.2"/><path d="M11 17h6v-6M17 17l-5-5"/>',
  sliders: '<path d="M3.5 6h8M16.5 6h0M3.5 14h0M8.5 14h8"/><circle cx="14" cy="6" r="2.2"/><circle cx="6" cy="14" r="2.2"/>',
  lock: '<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
  unlock: '<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 5.7-1.3"/>',
  mic: '<rect x="7.5" y="2.5" width="5" height="9" rx="2.5"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"/>',
  sys: '<rect x="2.5" y="3.5" width="15" height="10.5" rx="1.8"/><path d="M7 17h6M7.5 8.5v1.5M10 6.8v4.9M12.5 8v2.4"/>',
  spk: '<path d="M3.5 8v4h3l4 3.5v-11L6.5 8z"/><path d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.5 6.5 0 0 1 0 9"/>',
  folder: '<path d="M2.8 6A1.5 1.5 0 0 1 4.3 4.5h3.2l1.6 1.8h6.6A1.5 1.5 0 0 1 17.2 7.8v6.7a1.5 1.5 0 0 1-1.5 1.5H4.3a1.5 1.5 0 0 1-1.5-1.5z"/>',
  trash: '<path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 9.5h6.8L14 6M8.5 9v4M11.5 9v4"/>',
  open: '<path d="M11 4.5h4.5V9M15.5 4.5L9 11M8 5.5H5.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V12"/>',
  check: '<path d="M4.5 10.5l3.5 3.5 7.5-8"/>', back: '<path d="M12 4.5L6.5 10l5.5 5.5"/>', x: '<path d="M5 5l10 10M15 5L5 15"/>',
  shield: '<path d="M10 2.8l6 2.2v4.7c0 3.6-2.5 6.1-6 7.5-3.5-1.4-6-3.9-6-7.5V5z"/><path d="M7.3 10l2 2 3.5-4"/>',
  warn: '<path d="M10 3.5l7 12.5H3z"/><path d="M10 8.5v3.2M10 13.6v.1"/>', info: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5M10 6.5v.1"/>',
  copy: '<rect x="7" y="7" width="9" height="9" rx="1.6"/><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7"/>',
  swap: '<path d="M4 8h11l-3-3M16 12H5l3 3"/>',
  shrink: '<path d="M4 8h4V4M16 8h-4V4M4 12h4v4M16 12h-4v4"/>',
  edit: '<path d="M4 16l1-4 8.5-8.5a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 15z"/>'
};
const ico = (n, s = 17, extra = '') => `<svg viewBox="0 0 20 20" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[n]}</svg>`;

const S = {
  mode: 'shot', view: 'main', tab: 'general', busy: false, st: null, env: null, recents: [], preview: null, cmp: null, editKey: null, hints: {},
  banner: null, // {kind,title,body,cta}
  cfg: {
    shot: { src: 'full', lock: false, ratio: 16 / 9, size: { region: null, custom: { w: 1280, h: 720 } } },
    rec: { src: 'full', lock: false, ratio: 16 / 9, size: { region: null, custom: { w: 1280, h: 720 } } }
  }
};
const cur = () => { const c = S.cfg[S.mode]; return { c, src: c.src, size: c.size[c.src] }; };
const keyText = (acc) => acc.split('+').map((k) => (k === 'Control' ? 'Ctrl' : k)).join(' ');
const sinkDesc = (name) => { const s = (S.env.sinks.find((x) => x.name === (name || S.env.defaultSink)) || {}); return s.description || 'default output'; };
const micDesc = () => { const m = S.env.mics.find((x) => x.name === S.st.mic) || S.env.mics[0]; return m ? m.description : ''; };

function blockedReason() {
  const e = S.env;
  if (e.wayland) return { kind: 'warn', title: 'Wayland session: capture unavailable', body: 'Wayland can’t hide Frameo’s own windows from a capture, so Frameo won’t record here. Log out and pick the Cinnamon (X11) session on the login screen.' };
  if (!e.helper) return { kind: 'err', title: 'Capture helper not built', body: 'Run “npm run build:native” (needs libx11-dev), then restart Frameo.' };
  if (!e.ffmpeg) return { kind: 'err', title: 'ffmpeg not found', body: 'Install it with “sudo apt install ffmpeg”, then restart Frameo.' };
  return null;
}
function bannerHtml(b, id) {
  const icon = b.kind === 'info' ? 'info' : 'warn';
  return `<div class="banner ${b.kind}">${ico(icon, 18)}<div style="flex:1"><b>${esc(b.title)}</b><p>${esc(b.body)}</p>${b.cta ? `<div style="display:flex;gap:8px;margin-top:8px">${b.cta.map((c) => `<button class="ghost" data-act="${c.act}">${esc(c.label)}</button>`).join('')}</div>` : ''}</div></div>`;
}
function renderBanners() {
  const list = []; const b = blockedReason(); if (b) list.push(b); if (S.banner) list.push(S.banner);
  $('#banners').innerHTML = list.map(bannerHtml).join('');
}

/* ---------- main view ---------- */
function audioRows() {
  const a = S.st.audio, e = S.env, sink = S.st.sink || e.defaultSink;
  const noMic = e.mics.length === 0, noAudio = !e.audioOk;
  const sameSink = a.sys && a.spk && sink === e.defaultSink;
  return [
    { id: 'sys', icon: 'sys', label: 'System audio', un: noAudio, on: a.sys && !noAudio, sub: noAudio ? 'No audio server found' : a.sys ? 'All app sound · ' + sinkDesc(e.defaultSink) : 'Sound from apps and the system' },
    { id: 'mic', icon: 'mic', label: 'Microphone', un: noMic, on: a.mic && !noMic, sub: noMic ? 'No microphone detected' : micDesc() },
    { id: 'spk', icon: 'spk', label: 'Speaker output', un: noAudio, on: a.spk && !noAudio, sub: noAudio ? 'No audio server found' : sameSink ? 'Same device as System audio — captured once' : a.spk ? 'Captures ' + sinkDesc(sink) : 'Everything sent to ' + sinkDesc(sink) }
  ];
}
function dimsHtml() {
  const { c, src, size } = cur();
  if (src === 'full') return `<div class="row" style="height:36px"><div class="grow" style="display:flex;align-items:baseline;gap:8px"><b style="font-weight:500">Primary display</b><span class="sub tn">${SCR.w} × ${SCR.h}</span></div></div>`;
  const has = !!size; const g = (v) => (has ? v : '—');
  const field = (k, v) => has ? `<label class="fld"><span>${k.toUpperCase()}</span><input data-f="${k}" inputmode="numeric" value="${v}" aria-label="${k === 'w' ? 'Width' : 'Height'} in pixels"></label>` : `<label class="fld dis"><span>${k.toUpperCase()}</span><input value="—" disabled></label>`;
  let tail = '';
  if (src === 'custom') {
    tail = `<div class="chips">${[[1920, 1080], [1280, 720], [1080, 1080], [800, 600]].map(([w, h]) => `<button class="chip tn ${size.w === w && size.h === h ? 'on' : ''}" data-act="preset" data-w="${w}" data-h="${h}">${w} × ${h}</button>`).join('')}<span class="sub tn" style="margin-left:auto" id="ratioTxt">${ratioText(size)}</span></div>`;
  } else tail = `<div class="sub">${has ? 'Select again on screen to change the area. Edit the numbers to fine-tune.' : 'No area yet. You’ll draw one directly on your screen.'}</div>`;
  return `<div style="display:flex;flex-direction:column;gap:10px"><div class="row">${field('w', g(size && size.w))}<button class="lockb ${c.lock ? 'on' : ''}" data-act="lock" aria-label="Lock aspect ratio">${ico(c.lock ? 'lock' : 'unlock', 16)}</button>${field('h', g(size && size.h))}</div>${tail}</div>`;
}
function ratioText(s) { if (!s) return ''; const g = (a, b) => (b ? g(b, a % b) : a); const d = g(s.w, s.h); return s.w / d > 40 ? (s.w / s.h).toFixed(2) + ' : 1' : s.w / d + ' : ' + s.h / d; }
function fmtDur(s) { const m = Math.floor(s / 60), r = s % 60; return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0'); }
function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
function when(t) {
  const d = new Date(t), n = new Date(), s = (n - d) / 1000, hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (s < 60) return 'Just now'; if (d.toDateString() === n.toDateString()) return 'Today, ' + hm;
  const y = new Date(n - 864e5); if (d.toDateString() === y.toDateString()) return 'Yesterday, ' + hm;
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + hm;
}
function recentHtml() {
  const head = `<div class="rhead"><span class="sh">Recent</span><span style="display:flex;gap:10px"><button class="chip" data-act="cmp-pick">${ico('shrink', 14)}Compress a video…</button>${S.recents.length ? `<button class="link" data-act="folder">${ico('folder', 14)}Open folder</button>` : ''}</span></div>`;
  if (!S.recents.length) return `${head}<div class="empty"><svg viewBox="0 0 64 48" width="64" height="48" fill="none" aria-hidden="true"><path d="M8 16V9a3 3 0 0 1 3-3h7M46 6h7a3 3 0 0 1 3 3v7M56 32v7a3 3 0 0 1-3 3h-7M18 42h-7a3 3 0 0 1-3-3v-7" stroke="var(--text)" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="24" r="5" fill="#F2C46A"/></svg><b>Nothing captured yet</b><div class="sub" style="max-width:300px">Your screenshots and recordings will show up here. Try <span class="kbd">${keyText(S.st.keys.shotRegion)}</span> to grab a region without opening Frameo.</div><div class="sub" style="max-width:300px">Big video? Drop it on this window or use <b>Compress a video…</b> to shrink it to half or a fifth of its size.</div></div>`;
  return `${head}<div class="rlist">${S.recents.map((it, i) => `<div class="rrow"><button class="thumb" data-act="open-preview" data-i="${i}" aria-label="Open ${esc(it.name)}">${it.thumb ? `<img src="${it.thumb}" alt="">` : ''}${it.kind === 'rec' ? `<span class="play"><svg viewBox="0 0 20 20" width="8" height="8"><path d="M6 3.5l11 6.5-11 6.5z" fill="#FCF0DA"/></svg></span>` : ''}</button><div class="rmeta"><div class="n">${esc(it.name)}</div><div class="sub tn">${it.kind === 'rec' ? fmtDur(it.dur) + ' · ' + fmtSize(it.bytes) : 'Screenshot'} · ${when(it.mtime)}</div></div>${it.kind === 'rec' ? `<button class="chip" data-act="cmp-row" data-i="${i}" aria-label="Compress ${esc(it.name)}">${ico('shrink', 14)}Compress</button>` : ''}<div class="acts"><button class="ic" data-act="open-preview" data-i="${i}" aria-label="Open">${ico('open', 16)}</button><button class="ic" data-act="reveal" data-i="${i}" aria-label="Reveal in folder">${ico('folder', 16)}</button><button class="ic dng" data-act="del" data-i="${i}" aria-label="Move to Trash">${ico('trash', 16)}</button></div></div>`).join('')}</div>`;
}
function mainHtml() {
  const m = S.mode, isRec = m === 'rec', { c, src, size } = cur(), k = S.st.keys, blocked = !!blockedReason();
  let label, key = keyText(k.shotFull);
  if (isRec) key = keyText(k.rec); 
  if (src === 'full') label = isRec ? 'Start recording' : 'Capture screen';
  else if (src === 'region') { label = isRec ? 'Select region to record' : 'Select region'; key = isRec ? keyText(k.rec) : keyText(k.shotRegion); }
  else label = (isRec ? 'Record ' : 'Capture ') + size.w + ' × ' + size.h;
  const rows = audioRows(), nOn = rows.filter((r) => r.on).length;
  const audio = isRec ? `<div class="audio"><div class="row" style="justify-content:space-between;margin-bottom:4px"><span class="sh">Audio</span><span class="sub">${nOn ? nOn + (nOn === 1 ? ' source' : ' sources') : 'Off'}</span></div>${rows.map((r) => `<div class="arow ${r.on ? '' : 'off'}"><span class="aic">${ico(r.icon, 18)}</span><div class="ameta"><div class="l">${r.label}</div><div class="sub">${esc(r.sub)}</div></div>${r.on ? `<span class="meter" data-m="${r.id}">${'<i style="height:6px"></i>'.repeat(10)}</span>` : ''}${r.un ? `<button class="sw" disabled aria-label="${r.label} (unavailable)"></button>` : `<button class="sw ${r.on ? 'on' : ''}" data-act="audio" data-id="${r.id}" aria-label="${r.label}"></button>`}</div>`).join('')}</div>` : '';
  return `<div class="main">
    <div class="modes"><button class="seg ${m === 'shot' ? 'on' : ''}" data-act="mode" data-m="shot">${ico('camera')}Screenshot</button><button class="seg ${isRec ? 'on' : ''}" data-act="mode" data-m="rec">${ico('video')}Recording</button></div>
    <div class="srcs">${[['full', 'Full screen', 'full'], ['region', 'Region', 'region'], ['custom', 'Custom size', 'custom']].map(([id, l, i]) => `<button class="src ${src === id ? 'on' : ''}" data-act="src" data-s="${id}">${ico(i)}${l}</button>`).join('')}</div>
    ${dimsHtml()}${audio}
    <div style="flex:none"><button class="primary" data-act="go" ${blocked || S.busy ? 'disabled' : ''}>${S.busy ? 'Working…' : (isRec ? '<svg viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="6" fill="#3A3B36"/></svg>' : ico('camera')) + label + `<span class="kbd">${key}</span>`}</button></div>
    <div class="recent">${recentHtml()}</div></div>`;
}
/* ---------- settings ---------- */
function segs(list, cur, act, attr) { return `<div class="segwrap">${list.map((v) => `<button class="seg2 tn ${String(cur) === String(v[1] ?? v) ? 'on' : ''}" data-act="${act}" data-k="${attr}" data-v="${v[1] ?? v}">${v[0] ?? v}</button>`).join('')}</div>`; }
const tog = (label, sub, k) => `<div class="line"><div><div class="t">${label}</div><div class="sub">${sub}</div></div><button class="sw ${S.st[k] ? 'on' : ''}" data-act="toggle" data-k="${k}" aria-label="${label}"></button></div>`;
function settingsHtml() {
  const tabs = [['general', 'General'], ['capture', 'Capture'], ['audio', 'Audio'], ['keys', 'Shortcuts']];
  const st = S.st; let body = '';
  if (S.tab === 'general') body = `
    <div class="grp"><span class="sh">Save location</span><div class="row"><div class="fld" style="flex:1"><span style="letter-spacing:0;font-weight:500;color:var(--text);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(st.saveDir)}</span></div><button class="ghost" data-act="choose-dir">Change…</button></div></div>
    <div class="grp"><span class="sh">Appearance</span><div class="line"><span class="t">Theme</span>${segs([['Light', 'light'], ['Dark', 'dark']], st.theme, 'set', 'theme')}</div></div>
    <div class="grp"><span class="sh">Startup</span>${tog('Launch at login', 'Start Frameo quietly when you sign in', 'launch')}${tog('Keep in tray when closed', 'Shortcuts keep working in the background', 'tray')}</div>
    <div class="grp"><span class="sh">Capture overlay</span><div class="line"><div><div class="t">Screen dimming</div><div class="sub">How dark the screen gets while selecting</div></div><input type="range" min="10" max="70" value="${st.dim}" data-range="dim" aria-label="Screen dimming"></div>${tog('Show size badge', 'Live width × height while selecting', 'badge')}${tog('Show ratio presets', '16:9, 4:3, 1:1 and 9:16 shortcuts', 'ratios')}<div class="line"><div><div class="t">Recording countdown</div><div class="sub">Before a recording begins</div></div>${segs([['Off', 0], ['3 s', 3], ['5 s', 5]], st.cd, 'set', 'cd')}</div></div>`;
  if (S.tab === 'capture') body = `
    <div class="grp"><span class="sh">Screenshots</span><div class="line"><span class="t">Format</span>${segs([['PNG', 'png'], ['JPG', 'jpg'], ['WebP', 'webp']], st.img, 'set', 'img')}</div>${tog('Annotate after capture', 'Open the editor right after a screenshot', 'editAfterShot')}${defDims('shot', 'Independent from recording')}</div>
    <div class="grp"><span class="sh">Recordings</span><div class="line"><span class="t">Format</span>${segs([['MP4', 'mp4'], ['WebM', 'webm']], st.vid, 'set', 'vid')}</div><div class="line"><span class="t">Quality</span>${segs([['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High']], st.quality, 'set', 'quality')}</div><div class="line"><span class="t">Frame rate</span>${segs([['24', 24], ['30', 30], ['60', 60]], st.fps, 'set', 'fps')}</div>${defDims('rec', 'Independent from screenshots')}</div>
    <div class="grp"><span class="sh">Compression</span><div class="line"><div><div class="t">Save compressed videos to</div><div class="sub">Medium and Low copies go here</div></div><div class="row" style="min-width:0;max-width:260px"><div class="fld" style="flex:1"><span style="letter-spacing:0;font-weight:500;color:var(--text);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(st.compressDir)}</span></div><button class="ghost" data-act="choose-cmp-dir">Change…</button></div></div></div>
    <div class="grp" style="gap:10px"><span class="sh">This computer</span><div class="line"><span class="t">Capture engine</span><span class="sub">${S.env.wayland ? 'Not available on Wayland' : 'X11 grab + ffmpeg'}</span></div><div class="line"><span class="t">Frameo’s own windows</span><span class="sub" style="text-align:right;max-width:230px">Rebuilt from a clean snapshot; verified before every recording</span></div></div>`;
  if (S.tab === 'audio') {
    const list = (items, curName, k, none) => items.length ? items.map((d) => `<button class="opt ${(curName || '') === d.name || (!curName && items[0].name === d.name) ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${esc(d.name)}"><span>${esc(d.description)}</span>${(curName || items[0].name) === d.name ? ico('check', 16) : ''}</button>`).join('') : `<div class="sub" style="padding:0 10px">${none}</div>`;
    body = `<div class="grp" style="gap:6px"><span class="sh" style="margin-bottom:4px">Microphone</span>${list(S.env.mics, st.mic, 'mic', 'No microphone detected. Plug one in or check Sound settings.')}</div>
    <div class="grp" style="gap:6px"><span class="sh" style="margin-bottom:4px">Speaker output device</span>${list(S.env.sinks, st.sink || S.env.defaultSink, 'sink', 'No audio output found.')}<div class="sub" style="padding:0 10px">Used when Speaker output is on. Captured from that device’s monitor.</div></div>
    <div class="grp" style="gap:8px"><span class="sh">How audio is captured here</span><div class="sub" style="color:var(--text);opacity:.85">System audio and Speaker output read an output device’s monitor through PipeWire or PulseAudio. The microphone uses the device chosen above.</div></div>`;
  }
  if (S.tab === 'keys') {
    const rows = [['shotFull', 'Capture full screen'], ['shotRegion', 'Capture region'], ['rec', 'Start / stop recording'], ['pause', 'Pause / resume'], ['paint', 'Draw on screen while recording']];
    body = `<div class="grp" style="gap:8px"><span class="sh">Global shortcuts</span>${rows.map(([id, l]) => `<div class="line" style="min-height:40px"><span class="t">${l}</span><div class="row">${S.editKey === id ? `<span class="sub" style="color:var(--text)">Press new shortcut…</span><button class="ghost" data-act="key-cancel">Cancel</button>` : `<span style="display:flex;gap:4px">${st.keys[id].split('+').map((x) => `<span class="kbd">${x === 'Control' ? 'Ctrl' : x}</span>`).join('')}</span><button class="ghost" data-act="key-edit" data-id="${id}">Change</button>`}</div></div>`).join('')}<div class="sub" style="margin-top:6px" id="keyNote">Shortcuts work when Frameo is in the tray, including during a recording.</div></div>`;
  }
  return `<div class="settings"><div class="shead"><button class="ic" data-act="back" aria-label="Back">${ico('back', 18)}</button><span class="disp">Settings</span></div><div class="modes">${tabs.map(([id, l]) => `<button class="seg ${S.tab === id ? 'on' : ''}" data-act="tab" data-t="${id}">${l}</button>`).join('')}</div><div class="sbody">${body}</div></div>`;
}
function defDims(which, note) {
  const d = S.st[which];
  return `<div class="line"><div><div class="t">Default custom size</div><div class="sub">${note}</div></div><div class="row" style="width:200px"><label class="fld"><span>W</span><input data-d="${which}.w" inputmode="numeric" value="${d.w}" aria-label="Default width"></label><label class="fld"><span>H</span><input data-d="${which}.h" inputmode="numeric" value="${d.h}" aria-label="Default height"></label></div></div>`;
}
function statusHtml() {
  const bad = !!blockedReason();
  return `<span><i class="dot ${bad ? 'bad' : ''}"></i>${bad ? 'Capture unavailable' : 'Ready · saving to ' + esc(S.st.saveDir.replace(/^.*\/(Pictures\/)/, '$1'))}</span><span>${ico('shield', 14)}${bad ? 'See notice above' : 'Controls never captured · verified'}</span>`;
}
function render() {
  document.body.className = S.st.theme;
  renderBanners();
  $('#view').innerHTML = S.view === 'main' ? mainHtml() : settingsHtml();
  $('#status').innerHTML = S.view === 'main' ? statusHtml() : '';
  $('[data-act="settings"]').innerHTML = ico('sliders', 18);
  renderPreview(); renderCompress(); syncMeters();
}
/* ---------- preview ---------- */
function renderPreview() {
  const el = $('#preview'), it = S.preview; el.hidden = !it; if (!it) { el.innerHTML = ''; return; }
  const url = 'file://' + encodeURI(it.path).replace(/#/g, '%23');
  el.innerHTML = `<div class="pv"><div class="pvh"><div class="n">${esc(it.name)}</div><button class="ic" data-act="pv-close" aria-label="Close preview">${ico('x', 16)}</button></div>
  <div class="pvm">${it.kind === 'rec' ? `<video src="${url}" controls preload="metadata"></video>` : `<img src="${url}" alt="">`}</div>
  <div class="pvi sub"><span class="tn">${it.kind === 'rec' ? 'Recording · ' + fmtDur(it.dur) : 'Screenshot'} · ${fmtSize(it.bytes)}</span><span>${ico('shield', 14)}Frameo’s controls aren’t in this capture</span></div>
  ${it.kind === 'rec' ? `<div class="pvc" id="pvCmp" aria-live="polite"><span class="sub">Checking size options…</span></div>` : ''}
  <div class="pva"><button class="ghost dng" data-act="pv-del">${ico('trash', 15)}Delete</button><button class="ghost" data-act="pv-reveal">${ico('folder', 15)}Reveal in folder</button>${it.kind === 'shot' ? `<button class="ghost" data-act="pv-edit">${ico('edit', 15)}Annotate</button><button class="ghost" data-act="pv-copy">${ico('copy', 15)}Copy</button>` : `<button class="ghost" data-act="pv-open">${ico('open', 15)}Open in player</button><button class="ghost" data-act="pv-cmp">${ico('shrink', 15)}Compress</button>`}<span class="grow"></span><button class="solid" data-act="pv-close">Done</button></div></div>`;
  if (it.kind === 'rec') loadCmpHint(it);
}
/* Real size estimates for the recording in the preview: one-click Medium / Low. */
function cmpHintHtml(r, it) {
  if (!r || r.error) return '';
  const opts = ['medium', 'low'].map((k) => ({ k, p: r.plans[k] })).filter((o) => o.p && o.p.ok);
  if (!opts.length) return `<span class="sub">${esc((r.plans.medium && r.plans.medium.reason) || 'Too short or small to compress.')}</span>`;
  return `<span class="sub tn">${ico('shrink', 14)} Shrink ${fmtSize(it.bytes)} to</span>${opts.map((o) => `<button class="chip" data-act="pv-cmp" data-k="${o.k}">${o.k === 'medium' ? 'Medium' : 'Low'} · about ${fmtSize(o.p.estBytes)}</button>`).join('')}`;
}
async function loadCmpHint(it) {
  const k = it.path + '|' + it.bytes; let r = S.hints[k];
  if (!r) { r = await api.cmpProbe(it.path); if (r && !r.error) S.hints[k] = r; }
  const box = $('#pvCmp'); if (!box || !S.preview || S.preview.path !== it.path) return;
  box.innerHTML = cmpHintHtml(r, it); if (!box.innerHTML) box.hidden = true;
}
let toastT;
function toast(msg) { const t = $('#toast'); t.innerHTML = `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="#F2C46A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>${esc(msg)}`; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200); }

/* ---------- actions ---------- */
async function refreshRecents() { S.recents = await api.recents(); }
async function save(patch) { const r = await api.saveSettings(patch); S.st = r.settings; return r; }
function handleResult(r, kind) {
  S.busy = false;
  if (!r) return render();
  if (r.error === 'save') S.banner = { kind: 'err', title: 'Couldn’t save the capture', body: 'The folder is read-only or the disk is full. Choose another location and capture again.', cta: [{ act: 'fix-save', label: 'Choose folder' }, { act: 'dismiss', label: 'Dismiss' }] };
  else if (r.error === 'capture') S.banner = { kind: 'err', title: 'Capture failed', body: r.message || 'Something went wrong while capturing.', cta: [{ act: 'dismiss', label: 'Dismiss' }] };
  else if (r.error === 'compressing') S.banner = { kind: 'info', title: 'Compression in progress', body: 'Wait for it to finish, or cancel it, before recording.', cta: [{ act: 'dismiss', label: 'Got it' }] };
  else if (r.mode === 'tray' && r.note) S.banner = { kind: 'info', title: 'Controls are in the tray', body: r.note, cta: [{ act: 'dismiss', label: 'Got it' }] };
  render();
}
async function go() {
  if (S.busy || blockedReason()) return;
  const { c, src, size } = cur(), isRec = S.mode === 'rec';
  S.banner = null; let rect = null;
  if (src !== 'full') {
    const res = await api.pickRegion({ mode: S.mode, size, lock: c.lock, ratio: c.ratio, confirm: isRec ? 'Start recording' : 'Capture' });
    if (!res) return;
    c.size[src] = { w: Math.round(res.rect.w), h: Math.round(res.rect.h) }; c.lock = res.lock; c.ratio = res.ratio; rect = res.rect;
  }
  S.busy = true; render();
  const r = isRec ? await api.recStart(rect) : await api.shot(rect);
  if (r && r.cancelled) { S.busy = false; return render(); }
  handleResult(r);
}
function setDim(axis, raw) {
  const { c, src, size } = cur(); if (!size) return;
  const n = parseInt(String(raw).replace(/\D/g, ''), 10); if (!(n >= 16)) return;
  let w = size.w, h = size.h;
  if (axis === 'w') { w = Math.min(n, SCR.w); if (c.lock) h = Math.round(w / c.ratio); } else { h = Math.min(n, SCR.h); if (c.lock) w = Math.round(h * c.ratio); }
  c.size[src] = { w: Math.min(w, SCR.w), h: Math.min(h, SCR.h) };
  const o = $(`[data-f="${axis === 'w' ? 'h' : 'w'}"]`); if (o && c.lock) o.value = axis === 'w' ? c.size[src].h : c.size[src].w;
  const rt = $('#ratioTxt'); if (rt) rt.textContent = ratioText(c.size[src]);
}
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.f) setDim(t.dataset.f, t.value);
  if (t.dataset.d) { const [w, ax] = t.dataset.d.split('.'); const v = parseInt(t.value.replace(/\D/g, ''), 10); if (v >= 64) { const d = { ...S.st[w], [ax]: Math.min(v, ax === 'w' ? SCR.w : SCR.h) }; S.st[w] = d; S.cfg[w].size.custom = { w: d.w, h: d.h }; save({ [w]: d }); } }
  if (t.dataset.range) { S.st[t.dataset.range] = +t.value; save({ [t.dataset.range]: +t.value }); }
});
document.addEventListener('change', (e) => { if (e.target.dataset.f) render(); });
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return; const d = b.dataset, it = S.recents[+d.i];
  switch (d.act) {
    case 'go': return go();
    case 'mode': S.mode = d.m; return render();
    case 'src': S.cfg[S.mode].src = d.s; return render();
    case 'lock': { const { c, size } = cur(); c.lock = !c.lock; if (c.lock && size) c.ratio = size.w / size.h; return render(); }
    case 'preset': { const { c, src } = cur(); c.size[src] = { w: +d.w, h: +d.h }; if (c.lock) c.ratio = d.w / d.h; return render(); }
    case 'audio': { const a = { ...S.st.audio, [d.id]: !S.st.audio[d.id] }; await save({ audio: a }); return render(); }
    case 'settings': S.view = 'settings'; return render();
    case 'back': S.view = 'main'; S.editKey = null; return render();
    case 'tab': S.tab = d.t; return render();
    case 'toggle': await save({ [d.k]: !S.st[d.k] }); return render();
    case 'set': { const v = /^\d+$/.test(d.v) ? +d.v : d.v; await save({ [d.k]: v }); return render(); }
    case 'choose-dir': { const p = await api.chooseDir(); if (p) { await save({ saveDir: p }); await refreshRecents(); render(); } return; }
    case 'folder': return api.reveal(S.recents[0].path);
    case 'open-preview': S.preview = it; return renderPreview();
    case 'reveal': api.reveal(it.path); return toast('Revealed in folder');
    case 'del': if (await api.del(it.path)) { await refreshRecents(); render(); toast('Moved to Trash'); } return;
    case 'pv-close': S.preview = null; return renderPreview();
    case 'pv-reveal': api.reveal(S.preview.path); return toast('Revealed in folder');
    case 'pv-open': return api.open(S.preview.path);
    case 'pv-edit': { const r = await api.annotate(S.preview.path); if (r && r.error) toast(r.error === 'recording' ? 'Stop recording first' : 'Can’t open this file'); return; }
    case 'pv-copy': await api.copy(S.preview.path); return toast('Copied to clipboard');
    case 'pv-del': if (await api.del(S.preview.path)) { S.preview = null; await refreshRecents(); render(); toast('Moved to Trash'); } return;
    case 'fix-save': S.banner = null; S.view = 'settings'; S.tab = 'general'; return render();
    case 'dismiss': S.banner = null; return render();
    case 'pv-cmp': return openCompress(S.preview.path, S.preview.fresh, d.k);
    case 'cmp-row': return openCompress(it.path, false);
    case 'cmp-pick': { const f = await api.cmpPick(); if (f) openCompress(f, false); return; }
    case 'cmp-close': S.cmp = null; return renderCompress();
    case 'cmp-go': return cmpStart();
    case 'cmp-cancel': S.cmp.cancelling = true; renderCompress(); return api.cmpCancel();
    case 'cmp-retry': S.cmp.state = S.cmp.info ? 'idle' : 'error'; if (!S.cmp.info) return openCompress(S.cmp.file, S.cmp.fresh); return renderCompress();
    case 'cmp-dir': { const p = await api.chooseDir(S.st.compressDir); if (p) { await save({ compressDir: p }); renderCompress(); } return; }
    case 'choose-cmp-dir': { const p = await api.chooseDir(S.st.compressDir); if (p) { await save({ compressDir: p }); render(); } return; }
    case 'cmp-reveal': return api.reveal(S.cmp.result.path);
    case 'cmp-open': return api.open(S.cmp.result.path);
    case 'min': return api.minimize();
    case 'close': return api.close();
    case 'key-edit': S.editKey = d.id; return render();
    case 'key-cancel': S.editKey = null; return render();
  }
});
document.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape' && S.cmp && S.cmp.state !== 'running') { S.cmp = null; return renderCompress(); }
  if (e.key === 'Escape' && S.preview) { S.preview = null; return renderPreview(); }
  if (!S.editKey) return;
  e.preventDefault();
  if (e.key === 'Escape') { S.editKey = null; return render(); }
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
  const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
  if (!mods.length) { const n = $('#keyNote'); if (n) n.textContent = 'Include at least one modifier (Ctrl, Alt, Shift or Super).'; return; }
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key === ' ' ? 'Space' : e.key.replace('Arrow', '');
  const id = S.editKey; const r = await save({ keys: { [id]: [...mods, k].join('+') } });
  S.editKey = null; render();
  if (r.failedKeys && r.failedKeys.length) { const n = $('#keyNote'); if (n) n.textContent = 'That shortcut is already used by another app. Pick a different one.'; }
});

/* ---------- live level meters (only for sources that are switched on, in Recording mode) ---------- */
const meters = { ctx: null, nodes: {}, raf: 0 };
async function startMeter(id, wantLabel) {
  try {
    if (!meters.ctx) meters.ctx = new AudioContext();
    await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const dev = wantLabel ? devs.find((d) => d.label.toLowerCase().includes(wantLabel.toLowerCase())) : devs.find((d) => d.deviceId === 'default') || devs[0];
    if (!dev) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: dev.deviceId } } });
    const an = meters.ctx.createAnalyser(); an.fftSize = 512; meters.ctx.createMediaStreamSource(stream).connect(an);
    meters.nodes[id] = { stream, an, buf: new Uint8Array(an.fftSize) };
    if (!meters.raf) meters.raf = requestAnimationFrame(tickMeters);
  } catch (e) { /* no matching device: no meter is shown */ }
}
function stopMeters(keep = []) { for (const id of Object.keys(meters.nodes)) if (!keep.includes(id)) { meters.nodes[id].stream.getTracks().forEach((t) => t.stop()); delete meters.nodes[id]; } }
function tickMeters() {
  meters.raf = 0; const ids = Object.keys(meters.nodes); if (!ids.length) return;
  for (const id of ids) {
    const n = meters.nodes[id]; n.an.getByteTimeDomainData(n.buf);
    let peak = 0; for (const v of n.buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
    const lvl = clamp(peak * 2.2, 0, 1), el = $(`[data-m="${id}"]`); if (!el) continue;
    [...el.children].forEach((b, i) => { const on = lvl * 10 > i; b.className = on ? (i > 7 ? 'hot' : 'on') : ''; b.style.height = 5 + Math.round(i * 0.9) + 'px'; });
  }
  meters.raf = requestAnimationFrame(tickMeters);
}
function syncMeters() {
  if (S.view !== 'main' || S.mode !== 'rec') return stopMeters();
  const rows = audioRows().filter((r) => r.on); stopMeters(rows.map((r) => r.id));
  const sink = S.st.sink || S.env.defaultSink;
  for (const r of rows) if (!meters.nodes[r.id]) startMeter(r.id, r.id === 'mic' ? (micDesc() && S.st.mic ? micDesc() : '') : 'Monitor of ' + sinkDesc(r.id === 'sys' ? S.env.defaultSink : sink));
}

/* ---------- compress ---------- */
const VIDEO_RE = /\.(mp4|webm|mkv|mov|avi|m4v)$/i;
const fmtEta = (s) => (s < 60 ? Math.max(1, Math.round(s)) + ' s left' : Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s left');
async function openCompress(file, fresh, pref) {
  if (S.cmp && S.cmp.state === 'running') return;
  S.preview = null; renderPreview();
  S.cmp = { file, fresh: !!fresh, state: 'probing', key: 'medium' }; renderCompress();
  const r = await api.cmpProbe(file);
  if (!S.cmp || S.cmp.file !== file) return;
  if (r.error) { S.cmp.state = 'error'; S.cmp.message = r.error; return renderCompress(); }
  S.cmp.info = r.info; S.cmp.plans = r.plans; S.cmp.state = 'idle';
  S.cmp.key = pref && r.plans[pref] && r.plans[pref].ok ? pref : r.plans.medium.ok ? 'medium' : r.plans.low.ok ? 'low' : 'original';
  renderCompress(); const sel = $('#cmpSel'); if (sel) sel.focus();
}
async function cmpStart() {
  const c = S.cmp; if (!c || c.state !== 'idle') return;
  if (c.key === 'original') { S.cmp = null; return renderCompress(); }
  const r = await api.cmpStart(c.file, c.key, c.fresh);
  if (r.error) { c.state = 'error'; c.message = r.error === 'recording' ? 'Stop the recording first.' : r.error === 'busy' ? 'Another compression is running.' : r.message || 'Could not start.'; return renderCompress(); }
  c.state = 'running'; c.pct = 0; c.pass = 1; c.retry = false; c.t0 = Date.now(); renderCompress();
}
function updateCmpProgress() {
  const c = S.cmp; if (!c || c.state !== 'running') return;
  const pct = Math.round((c.pct || 0) * 100), bar = $('#cmpBar');
  if (bar) { bar.setAttribute('aria-valuenow', pct); bar.firstElementChild.style.width = pct + '%'; }
  const t = $('#cmpTxt');
  if (t) { const el = (Date.now() - c.t0) / 1000; t.textContent = (c.retry ? 'Fine-tuning size · ' : 'Pass ' + c.pass + ' of 2 · ') + pct + '%' + (c.pct > 0.04 ? ' · ' + fmtEta(el / c.pct * (1 - c.pct)) : ''); }
}
function cmpOption(c, id, label) {
  if (id === 'original') return `<option value="original" ${c.key === id ? 'selected' : ''}>Original · ${fmtSize(c.info.bytes)}</option>`;
  const p = c.plans[id];
  return p.ok ? `<option value="${id}" ${c.key === id ? 'selected' : ''}>${label} · about ${fmtSize(p.estBytes)}</option>` : `<option value="${id}" disabled>${label} · unavailable</option>`;
}
function renderCompress() {
  const el = $('#compress'), c = S.cmp; el.hidden = !c; if (!c) { el.innerHTML = ''; return; }
  const name = c.info ? c.info.name : c.file.split('/').pop(), running = c.state === 'running';
  let body = '';
  if (c.state === 'probing') body = `<div class="cb"><div class="sub">Reading video…</div></div><div class="pva"><span class="grow"></span><button class="ghost" data-act="cmp-close">Cancel</button></div>`;
  else if (c.state === 'error') body = `<div class="cb"><div class="banner err">${ico('warn', 18)}<div style="flex:1"><b>Couldn’t compress</b><p>${esc(c.message)}</p></div></div></div><div class="pva"><span class="grow"></span><button class="ghost" data-act="cmp-close">Close</button><button class="solid" data-act="cmp-retry">Try again</button></div>`;
  else if (c.state === 'idle') {
    const i = c.info, pl = c.plans[c.key], miss = [['medium', 'Medium'], ['low', 'Low']].filter(([k]) => !c.plans[k].ok).map(([k, l]) => `<div class="sub">${l}: ${esc(c.plans[k].reason)}</div>`).join('');
    const note = c.key === 'original' ? 'Keeps the video exactly as it is.' : pl && pl.ok ? pl.height + 'p · ' + pl.fps + ' fps · final size lands close to this estimate' : '';
    const orig = c.key === 'original' ? '' : c.fresh ? 'Your original recording moves to Trash after compressing.' : 'Your original is not changed. A copy is saved.';
    body = `<div class="cb"><div class="sub tn">${fmtDur(Math.round(i.duration))} · ${i.w} × ${i.h} · ${i.fps} fps · ${fmtSize(i.bytes)}</div>
      <label class="grp" style="gap:6px"><span class="sh">Quality</span><select id="cmpSel" class="cmps">${cmpOption(c, 'original')}${cmpOption(c, 'medium', 'Medium')}${cmpOption(c, 'low', 'Low')}</select></label>
      <div class="sub">${note}</div>${miss}
      <div class="grp" style="gap:6px"><span class="sh">Save to</span><div class="row"><div class="fld" style="flex:1"><span style="letter-spacing:0;font-weight:500;color:var(--text);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(S.st.compressDir)}</span></div><button class="ghost" data-act="cmp-dir">Change…</button></div></div>
      <div class="sub">${orig}</div></div>
      <div class="pva"><span class="grow"></span><button class="ghost" data-act="cmp-close">Cancel</button><button class="solid" data-act="cmp-go">${c.key === 'original' ? 'Keep original' : 'Compress'}</button></div>`;
  } else if (running) body = `<div class="cb"><div class="bar" id="cmpBar" role="progressbar" aria-label="Compression progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="sub tn" id="cmpTxt" aria-live="polite"></div></div><div class="pva"><span class="grow"></span><button class="ghost" data-act="cmp-cancel" ${c.cancelling ? 'disabled' : ''}>${c.cancelling ? 'Cancelling…' : 'Cancel'}</button></div>`;
  else {
    const r = c.result, saved = Math.max(0, Math.round((1 - r.bytes / r.origBytes) * 100));
    body = `<div class="cb"><div class="row" style="gap:10px"><span style="color:var(--text)">${ico('check', 20)}</span><div><b>${esc(r.name)}</b><div class="sub tn">${fmtSize(r.bytes)} · ${saved}% smaller than ${fmtSize(r.origBytes)}</div></div></div><div class="sub">${r.trashed ? 'Original recording moved to Trash. ' : ''}Saved in ${esc(S.st.compressDir)}</div></div>
      <div class="pva"><button class="ghost" data-act="cmp-reveal">${ico('folder', 15)}Reveal in folder</button><button class="ghost" data-act="cmp-open">${ico('open', 15)}Open in player</button><span class="grow"></span><button class="solid" data-act="cmp-close">Done</button></div>`;
  }
  el.innerHTML = `<div class="pv" role="dialog" aria-modal="true" aria-label="Compress video"><div class="pvh"><div class="n">${esc(name)}</div><button class="ic" data-act="cmp-close" aria-label="Close" ${running ? 'disabled' : ''}>${ico('x', 16)}</button></div>${body}</div>`;
  if (running) updateCmpProgress();
}
document.addEventListener('change', (e) => { if (e.target.id === 'cmpSel' && S.cmp) { S.cmp.key = e.target.value; renderCompress(); const s = $('#cmpSel'); if (s) s.focus(); } });

/* ---------- boot ---------- */
(async function init() {
  const s = await api.state(); S.st = s.settings; S.env = s.env;
  S.cfg.shot.size.custom = { ...S.st.shot }; S.cfg.rec.size.custom = { ...S.st.rec };
  await refreshRecents(); render();
  api.on('captured', async (item) => { S.busy = false; S.banner = null; S.view = 'main'; await refreshRecents(); const found = S.recents.find((r) => r.path === item.path) || item; S.preview = item.kind === 'rec' ? { ...found, fresh: true } : found; render(); });
  api.on('capture-error', (r) => handleResult(r));
  api.on('compress:progress', (p) => { if (!S.cmp || S.cmp.state !== 'running') return; S.cmp.pct = p.pct; S.cmp.pass = p.pass; S.cmp.retry = p.retry; updateCmpProgress(); });
  api.on('compress:done', async (r) => {
    const c = S.cmp; if (!c) return;
    c.cancelling = false;
    if (r.cancelled) { c.state = 'idle'; return renderCompress(); }
    if (r.error) { c.state = 'error'; c.message = r.message || 'Compression failed.'; return renderCompress(); }
    c.state = 'done'; c.result = r; await refreshRecents(); render();
  });
  let dragDepth = 0;
  document.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('drop'); });
  document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('drop'); } });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('drop');
    const f = e.dataTransfer.files[0]; if (!f) return;
    const p = api.pathFor(f); if (!VIDEO_RE.test(p)) return toast('That is not a video file');
    openCompress(p, false);
  });
  document.addEventListener('visibilitychange', async () => { if (!document.hidden) { S.env = (await api.state()).env; await refreshRecents(); render(); } });
})();
