/* Trim & split window. Split = keep one range. Trim = remove ranges, keep the rest. The main process owns the file path and the cutting;
   this script only edits ranges, previews, and asks main for a plan/export. */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ICON = {
  play: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M6.5 4.5l9 5.5-9 5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 20 20" width="18" height="18"><rect x="5" y="4.5" width="3.4" height="11" rx="1" fill="currentColor"/><rect x="11.6" y="4.5" width="3.4" height="11" rx="1" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  trash: '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 9.5h6.8L14 6"/></svg>',
  check: '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
  warn: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3.5l7 12.5H3z"/><path d="M10 8.5v3.2M10 13.6v.1"/></svg>'
};

const T = { loaded: false, mode: 'split', dur: 0, fps: 25, keys: [], r: { split: [], trim: [] }, sel: 0, precise: false, plan: null, running: false, outDir: '' };
const v = $('#v'), track = $('#track'), ruler = $('#ruler'), ticks = $('#ticks');
let planSeq = 0, raf = 0;

/* ---------- formatting / parsing ---------- */
function fmt(t, ms = true) {
  t = Math.max(0, t || 0); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60, p = (n) => String(n).padStart(2, '0');
  const sec = ms ? s.toFixed(1).padStart(4, '0') : p(Math.floor(s));
  return h ? `${h}:${p(m)}:${sec}` : `${p(m)}:${sec}`; // mm:ss like the rest of Frameo
}
function parseTime(str) { // "75", "1:15", "1:15.5", "1:02:03.25"
  const parts = String(str).trim().split(':').map((x) => x.trim()); if (!parts.length || parts.length > 3 || parts.some((x) => !/^\d+(\.\d+)?$/.test(x))) return NaN;
  return parts.reduce((acc, x) => acc * 60 + parseFloat(x), 0);
}
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const ranges = () => T.r[T.mode];
const pps = () => track.clientWidth / Math.max(T.dur, 0.001);
const xOf = (t) => t * pps();

/* ---------- ranges ---------- */
function setMode(m) {
  T.mode = m; T.sel = 0;
  document.querySelectorAll('[data-mode]').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $('#hint').textContent = m === 'split' ? 'Select the part to keep. Everything else is dropped.' : 'Mark the parts to remove. The rest is joined into one video.';
  renderAll(); replan();
}
function addRange(a, b) {
  const t = a ?? v.currentTime, len = Math.max(1, T.dur * 0.05);
  const s = clamp(t, 0, Math.max(0, T.dur - 0.2)), e = b ?? Math.min(T.dur, s + len);
  if (T.mode === 'split') T.r.split = [[s, e]]; else T.r.trim.push([s, e]);
  T.sel = ranges().length - 1; renderAll(); replan();
}
function removeRange(i) { if (T.mode === 'split') return; T.r.trim.splice(i, 1); T.sel = clamp(T.sel, 0, T.r.trim.length - 1); renderAll(); replan(); }
function setEdge(i, edge, t) {
  const r = ranges()[i]; if (!r) return; const gap = 0.1;
  if (edge === 0) r[0] = clamp(t, 0, r[1] - gap); else r[1] = clamp(t, r[0] + gap, T.dur);
  renderAll(); replan();
}

/* ---------- rendering ---------- */
function renderRuler() {
  const w = track.clientWidth, dpr = devicePixelRatio || 1; if (!w || !T.dur) return;
  const cs = getComputedStyle(document.body), muted = cs.getPropertyValue('--muted').trim() || '#666', line = cs.getPropertyValue('--line').trim() || '#999';
  ruler.width = Math.round(w * dpr); ruler.height = Math.round(22 * dpr); ruler.style.width = w + 'px';
  const c = ruler.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, 22); c.font = '11px Inter, Ubuntu, system-ui, sans-serif'; c.textBaseline = 'top';
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600], step = steps.find((s) => s * pps() >= 80) || 3600;
  for (let t = 0; t <= T.dur + 1e-6; t += step) { const x = Math.round(xOf(t)) + 0.5; c.strokeStyle = line; c.beginPath(); c.moveTo(x, 14); c.lineTo(x, 22); c.stroke(); c.fillStyle = muted; c.fillText(fmt(t, false), Math.min(x + 3, w - 40), 1); }
  ticks.width = Math.round(w * dpr); ticks.height = Math.round(8 * dpr); ticks.style.width = w + 'px';
  const k = ticks.getContext('2d'); k.scale(dpr, dpr); k.clearRect(0, 0, w, 8); k.fillStyle = muted; k.globalAlpha = 0.55;
  if (T.keys.length && T.keys.length * 3 < w) for (const t of T.keys) k.fillRect(Math.round(xOf(t)), 2, 1, 6); // faint keyframe marks (skipped when too dense to read)
}
function renderTimeline() {
  const cut = T.mode === 'trim';
  $('#rs').innerHTML = ranges().map(([a, b], i) => `<div class="rng ${cut ? 'cut' : ''} ${i === T.sel ? 'sel' : ''}" data-i="${i}" style="left:${xOf(a)}px;width:${Math.max(4, xOf(b - a))}px" aria-label="${cut ? 'Removed' : 'Kept'} part ${i + 1}"><i class="l" data-e="0" tabindex="0" role="slider" aria-label="Start" aria-valuenow="${a.toFixed(1)}"></i><i class="r" data-e="1" tabindex="0" role="slider" aria-label="End" aria-valuenow="${b.toFixed(1)}"></i></div>`).join('');
  movePlayhead();
}
function renderRanges() {
  const cut = T.mode === 'trim';
  const rows = ranges().map(([a, b], i) => `<div class="rr ${i === T.sel ? 'sel' : ''}" data-i="${i}"><span class="t">${cut ? 'Remove' : 'Keep'}${cut ? ' ' + (i + 1) : ''}</span>
    <label class="fld"><span>FROM</span><input data-i="${i}" data-e="0" value="${fmt(a)}" aria-label="Start time of part ${i + 1}" inputmode="decimal"></label>
    <label class="fld"><span>TO</span><input data-i="${i}" data-e="1" value="${fmt(b)}" aria-label="End time of part ${i + 1}" inputmode="decimal"></label>
    <span class="sub tn">${fmt(b - a)} long</span><span class="grow"></span>
    ${cut ? `<button class="ic dng" data-del="${i}" aria-label="Remove part ${i + 1}" title="Delete this part (Delete)">${ICON.trash}</button>` : ''}</div>`).join('');
  $('#ranges').innerHTML = rows + (cut ? `<div class="rr"><button class="ghost" id="addr">+ Mark part to remove <span class="kbd">R</span></button></div>` : (ranges().length ? '' : '<div class="rr"><button class="ghost" id="addr">Select a part <span class="kbd">R</span></button></div>'));
}
function renderFoot() {
  const f = $('#foot'), p = T.plan; $('#export').disabled = T.running || !T.loaded || !p || !p.ok;
  if (!T.loaded) { f.textContent = ''; return; }
  if (!p) { f.className = ''; f.textContent = ''; return; }
  if (!p.ok) { f.className = 'err'; f.textContent = p.reason; return; }
  f.className = '';
  const first = p.segments[0], size = p.precise ? '' : ' · about ' + fmtSize(p.estBytes);
  const main = T.mode === 'split' ? `Saves ${fmt(p.total, false)} of ${fmt(T.dur, false)}` : `Result ${fmt(p.total, false)} · removes ${fmt(T.dur - p.total, false)}`;
  const snap = p.snapped ? ` · cuts start on keyframes (first at ${fmt(first.start)}); turn on Frame-accurate for exact points` : '';
  f.textContent = main + size + snap;
}
function renderAll() { renderRuler(); renderTimeline(); renderRanges(); renderFoot(); }
function movePlayhead() { $('#ph').style.left = xOf(v.currentTime || 0) + 'px'; $('#cur').textContent = fmt(v.currentTime || 0); }

/* ---------- plan (asked of the main process: it owns the keyframes and the rules) ---------- */
let planTimer = 0;
function replan() {
  clearTimeout(planTimer);
  planTimer = setTimeout(async () => {
    const seq = ++planSeq; const p = await trim.plan({ mode: T.mode, ranges: ranges(), precise: T.precise });
    if (seq === planSeq) { T.plan = p; renderFoot(); }
  }, 120);
}

/* ---------- playback ---------- */
function setPlaying(on) { if (on) v.play().catch(() => {}); else v.pause(); }
function tick() {
  movePlayhead();
  const t = v.currentTime, rs = ranges();
  if (!v.paused) { // preview of the result: skip removed parts (Trim), stop at the end of the kept part (Split)
    if (T.mode === 'trim') { const hit = rs.find(([a, b]) => t >= a && t < b - 0.02); if (hit) v.currentTime = Math.min(hit[1], T.dur); }
    else if (rs[0] && t >= rs[0][1]) { v.pause(); v.currentTime = rs[0][1]; }
  }
  raf = v.paused ? 0 : requestAnimationFrame(tick);
}
v.addEventListener('play', () => { $('#play').innerHTML = ICON.pause; $('#play').setAttribute('aria-label', 'Pause'); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
v.addEventListener('pause', () => { $('#play').innerHTML = ICON.play; $('#play').setAttribute('aria-label', 'Play'); movePlayhead(); });
v.addEventListener('seeked', movePlayhead); v.addEventListener('timeupdate', () => { if (v.paused) movePlayhead(); });
const seek = (t) => { v.currentTime = clamp(t, 0, T.dur); movePlayhead(); };

/* ---------- pointer interaction on the timeline ---------- */
let drag = null;
track.addEventListener('pointerdown', (e) => {
  if (!T.loaded || e.button !== 0) return;
  const h = e.target.closest('i[data-e]'), rg = e.target.closest('.rng');
  const rect = track.getBoundingClientRect();
  if (h || rg) {
    const i = +rg.dataset.i; T.sel = i; const r = ranges()[i];
    drag = { kind: h ? +h.dataset.e : 'm', i, x0: e.clientX, orig: [r[0], r[1]], el: h || rg }; (h || rg).setPointerCapture(e.pointerId);
    renderRanges(); document.querySelectorAll('.rng').forEach((n) => n.classList.toggle('sel', +n.dataset.i === i));
  } else { drag = { kind: 'scrub' }; track.setPointerCapture(e.pointerId); seek((e.clientX - rect.left) / pps()); }
  e.preventDefault();
});
track.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (drag.kind === 'scrub') return seek((e.clientX - track.getBoundingClientRect().left) / pps());
  const dt = (e.clientX - drag.x0) / pps(), r = ranges()[drag.i]; if (!r) return;
  if (drag.kind === 0) r[0] = clamp(drag.orig[0] + dt, 0, r[1] - 0.1);
  else if (drag.kind === 1) r[1] = clamp(drag.orig[1] + dt, r[0] + 0.1, T.dur);
  else { const len = drag.orig[1] - drag.orig[0], a = clamp(drag.orig[0] + dt, 0, T.dur - len); r[0] = a; r[1] = a + len; }
  const el = document.querySelector(`.rng[data-i="${drag.i}"]`); if (el) { el.style.left = xOf(r[0]) + 'px'; el.style.width = Math.max(4, xOf(r[1] - r[0])) + 'px'; }
  if (drag.kind !== 'm') seek(drag.kind === 0 ? r[0] : r[1]); // show the frame at the edge being dragged
});
const endDrag = () => { if (!drag) return; const was = drag; drag = null; if (was.kind !== 'scrub') { renderAll(); replan(); } };
track.addEventListener('pointerup', endDrag); track.addEventListener('pointercancel', endDrag);
track.addEventListener('keydown', (e) => { // arrow keys on a focused handle nudge it by one frame (Shift: one second)
  const h = e.target.closest('i[data-e]'); if (!h || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault(); e.stopPropagation(); const i = +h.closest('.rng').dataset.i, edge = +h.dataset.e, r = ranges()[i], step = (e.shiftKey ? 1 : 1 / T.fps) * (e.key === 'ArrowLeft' ? -1 : 1);
  setEdge(i, edge, r[edge] + step); seek(r[edge]); document.querySelector(`.rng[data-i="${i}"] i[data-e="${edge}"]`)?.focus();
});

/* ---------- controls ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.mode) return setMode(b.dataset.mode);
  if (b.id === 'play') return setPlaying(v.paused);
  if (b.id === 'addr') return addRange();
  if (b.dataset.del !== undefined) return removeRange(+b.dataset.del);
  if (b.id === 'precise') { T.precise = !T.precise; b.classList.toggle('on', T.precise); b.setAttribute('aria-checked', T.precise); return replan(); }
  if (b.id === 'export') return doExport();
  if (b.dataset.ov === 'cancel') return trim.cancel();
  if (b.dataset.ov === 'close') { $('#ov').hidden = true; return; }
  if (b.dataset.ov === 'reveal') return trim.reveal();
  if (b.dataset.ov === 'open') return trim.openResult();
  if (b.dataset.ov === 'retry') { $('#ov').hidden = true; return doExport(); }
});
document.addEventListener('change', (e) => {
  const inp = e.target.closest('input[data-e]'); if (!inp) return;
  const t = parseTime(inp.value), i = +inp.dataset.i, edge = +inp.dataset.e;
  if (isNaN(t)) { inp.value = fmt(ranges()[i][edge]); return; }
  setEdge(i, edge, t); seek(ranges()[i][edge]);
});
document.addEventListener('focusin', (e) => { const row = e.target.closest('.rr[data-i]'); if (row && +row.dataset.i !== T.sel) { T.sel = +row.dataset.i; document.querySelectorAll('.rr,.rng').forEach((n) => n.classList.toggle('sel', n.dataset.i !== undefined && +n.dataset.i === T.sel)); } });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input')) { if (e.key === 'Enter') e.target.blur(); return; }
  if (!$('#ov').hidden) { if (e.key === 'Escape' && !T.running) $('#ov').hidden = true; return; }
  if (!T.loaded) return; const k = e.key;
  if (k === ' ') { e.preventDefault(); setPlaying(v.paused); }
  else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); v.pause(); seek(v.currentTime + (k === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / T.fps)); }
  else if (k === 'Home') seek(0); else if (k === 'End') seek(T.dur);
  else if (k.toLowerCase() === 'i') { if (!ranges()[T.sel]) addRange(v.currentTime); else setEdge(T.sel, 0, v.currentTime); }
  else if (k.toLowerCase() === 'o') { if (!ranges()[T.sel]) addRange(Math.max(0, v.currentTime - 1), v.currentTime); else setEdge(T.sel, 1, v.currentTime); }
  else if (k.toLowerCase() === 'r') addRange();
  else if (k === 'Delete' || k === 'Backspace') removeRange(T.sel);
});
new ResizeObserver(() => { renderRuler(); renderTimeline(); }).observe(track);

/* ---------- export + overlay ---------- */
function overlay(html) { const o = $('#ov'); o.innerHTML = `<div class="pv" role="dialog" aria-modal="true" aria-label="Export">${html}</div>`; o.hidden = false; }
async function doExport() {
  if (!T.plan || !T.plan.ok || T.running) return;
  T.running = true; renderFoot(); v.pause();
  overlay(`<div class="pvh"><div class="n">Exporting…</div></div><div class="cb"><div class="bar" role="progressbar" aria-label="Export progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="obar"></i></div><div class="sub tn" id="otxt" aria-live="polite">Starting…</div></div><div class="pva"><span class="grow"></span><button class="ghost" data-ov="cancel">Cancel</button></div>`);
  const r = await trim.export({ mode: T.mode, ranges: ranges(), precise: T.precise });
  if (r && (r.error || !r.started)) { T.running = false; renderFoot(); const msg = r.error === 'recording' ? 'Stop the recording before exporting.' : r.error === 'busy' ? 'Another export is running.' : r.message || 'Could not start the export.'; showError(msg); }
}
function showError(msg) {
  overlay(`<div class="pvh"><div class="n">Couldn’t export</div><button class="ic" data-ov="close" aria-label="Close">${ICON.x}</button></div><div class="cb"><div class="banner err">${ICON.warn}<div style="flex:1"><p>${esc(msg)}</p></div></div></div><div class="pva"><span class="grow"></span><button class="ghost" data-ov="close">Close</button><button class="solid" data-ov="retry">Try again</button></div>`);
}
trim.onProgress((p) => { const pct = Math.round(p.pct * 100), bar = $('#obar'); if (bar) { bar.style.width = pct + '%'; bar.parentElement.setAttribute('aria-valuenow', pct); } const t = $('#otxt'); if (t) t.textContent = pct + '%'; });
trim.onDone((d) => {
  T.running = false; renderFoot();
  if (d.cancelled) return void ($('#ov').hidden = true);
  if (d.error) return showError(d.message || 'Something went wrong while cutting.');
  const saved = d.mode === 'split' ? `${fmt(d.kept, false)} kept of ${fmt(d.duration, false)}` : `${fmt(d.duration - d.kept, false)} removed, ${fmt(d.kept, false)} left`;
  overlay(`<div class="pvh"><div class="n">Saved</div><button class="ic" data-ov="close" aria-label="Close">${ICON.x}</button></div><div class="cb"><div class="row" style="gap:10px"><span style="color:var(--text)">${ICON.check}</span><div style="min-width:0"><b style="overflow-wrap:anywhere">${esc(d.name)}</b><div class="sub tn">${esc(saved)} · ${fmtSize(d.bytes)}</div></div></div><div class="sub">The original video is unchanged.</div></div><div class="pva"><button class="ghost" data-ov="reveal">Reveal in folder</button><button class="ghost" data-ov="open">Open in player</button><span class="grow"></span><button class="solid" data-ov="close">Done</button></div>`);
});

/* ---------- load ---------- */
trim.onInfo((d) => {
  document.body.className = d.theme === 'dark' ? 'dark' : 'light';
  if (d.error) { $('#msg').textContent = d.error; $('#msg').hidden = false; return; }
  document.title = 'Frameo — Trim & split · ' + d.name;
  Object.assign(T, { loaded: true, dur: d.duration, fps: d.fps > 0 && d.fps < 240 ? d.fps : 25, keys: [], plan: null, outDir: d.outDir });
  T.r = { split: [[0, d.duration]], trim: [] }; T.sel = 0;
  $('#tot').textContent = fmt(d.duration); $('#msg').hidden = true; $('#keyinfo').textContent = '';
  v.src = d.url; v.addEventListener('loadedmetadata', () => { movePlayhead(); }, { once: true });
  $('#play').innerHTML = ICON.play; setMode(T.mode);
});
trim.onKeys((k) => { T.keys = k; $('#keyinfo').textContent = k.length > 1 ? 'Keyframe about every ' + ((T.dur / Math.max(1, k.length)).toFixed(1)) + ' s' : ''; renderRuler(); replan(); });
trim.onReset(() => { T.loaded = false; v.removeAttribute('src'); v.load(); $('#msg').textContent = 'Loading…'; $('#msg').hidden = false; $('#ov').hidden = true; T.running = false; });
$('#play').innerHTML = ICON.play;
