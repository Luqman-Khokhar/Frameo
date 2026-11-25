const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const COLORS = ['#E5484D', '#F2C46A', '#46A758', '#3E63DD', '#8E4EC6', '#000000', '#FFFFFF', '#4A4C45']; // annotation palette = user data, not UI tokens
const KEYS = { 1: 'pen', 2: 'line', 3: 'arrow', 4: 'rect', 5: 'ellipse', 6: 'text', 7: 'eraser' };
const cv = $('#cv'), wrap = $('#wrap'), stage = $('#stage'), msg = $('#msg');
let P = null, bmp = null, mime = 'image/png', kScale = 1, tx = null, msgT = 0;

function say(t) { msg.textContent = t; clearTimeout(msgT); msgT = setTimeout(() => (msg.textContent = ''), 2500); }
function fit() {
  if (!bmp) return;
  const s = Math.min((stage.clientWidth - 32) / bmp.width, (stage.clientHeight - 32) / bmp.height, 1);
  cv.style.width = Math.max(1, Math.floor(bmp.width * s)) + 'px'; cv.style.height = Math.max(1, Math.floor(bmp.height * s)) + 'px';
}
const disp = () => cv.getBoundingClientRect().width / cv.width; // css px per canvas px
function pt(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }

/* ---- toolbar state ---- */
function sync() {
  $$('[data-tool]').forEach((b) => { const on = b.dataset.tool === P.tool; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $$('.pcol').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c.toLowerCase() === P.color.toLowerCase()));
  $$('.wd').forEach((b) => { const on = Math.round(b.dataset.w * kScale) === Math.round(P.width); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $('#undo').disabled = !P.canUndo(); $('#redo').disabled = !P.canRedo(); $('#clear').disabled = !P.count();
  cv.className = 't-' + P.tool;
}
function setTool(t) { commitText(); P.tool = t; sync(); }
function setColor(c) { P.color = c; if (tx) tx.style.color = c; if (/^#[0-9a-f]{6}$/i.test(c)) $('#cc').value = c.toLowerCase(); sync(); }
function setWidth(w) { P.width = w * kScale; if (tx) tx.style.fontSize = P.textSize() * disp() + 'px'; sync(); }

/* ---- text box ---- */
function openText(x, y) {
  commitText();
  const t = document.createElement('textarea'); t.id = 'tx'; t.rows = 1; t.spellcheck = false; t.setAttribute('aria-label', 'Annotation text');
  const d = disp(); t.style.left = x * d + 'px'; t.style.top = y * d + 'px'; t.style.fontSize = P.textSize() * d + 'px'; t.style.color = P.color;
  t.dataset.x = x; t.dataset.y = y; wrap.appendChild(t); tx = t; t.focus();
  t.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeText(); }
    e.stopPropagation();
  });
  t.addEventListener('blur', () => commitText());
}
function closeText() { if (!tx) return; const t = tx; tx = null; t.remove(); }
function commitText() { if (!tx) return; const t = tx; tx = null; const v = t.value, x = +t.dataset.x, y = +t.dataset.y; t.remove(); P.addText(x, y, v); }

/* ---- save / copy ---- */
async function out(kind) {
  if (!P) return;
  commitText();
  try {
    const blob = await P.toBlob(kind === 'copy' ? 'image/png' : mime, 0.92);
    if (!blob) return say('Could not export the image');
    const r = await window.ed[kind](await blob.arrayBuffer());
    say(r && r.ok ? (kind === 'copy' ? 'Copied to clipboard' : 'Saved ' + r.name) : 'Failed: ' + ((r && (r.message || r.error)) || 'unknown'));
  } catch (e) { say('Failed: ' + e.message); }
}

/* ---- pointer ---- */
cv.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !P) return;
  const [x, y] = pt(e); P.shift = e.shiftKey;
  if (P.tool === 'text') { e.preventDefault(); return openText(x, y); }
  cv.setPointerCapture(e.pointerId); P.pointerDown(x, y);
});
cv.addEventListener('pointermove', (e) => { if (!P || !cv.hasPointerCapture(e.pointerId)) return; P.shift = e.shiftKey; const [x, y] = pt(e); P.pointerMove(x, y); });
const up = (e) => { if (P && cv.hasPointerCapture(e.pointerId)) { cv.releasePointerCapture(e.pointerId); P.pointerUp(); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

/* ---- ui events ---- */
$('#sw').innerHTML = COLORS.map((c) => '<button class="pcol" data-c="' + c + '" style="background:' + c + '" aria-label="Color ' + c + '" aria-pressed="false"></button>').join('');
document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !P) return;
  if (b.dataset.tool) setTool(b.dataset.tool);
  else if (b.dataset.c) setColor(b.dataset.c);
  else if (b.dataset.w) setWidth(+b.dataset.w);
  else if (b.id === 'undo') { commitText(); P.undo(); } else if (b.id === 'redo') P.redo();
  else if (b.id === 'clear') { commitText(); P.clear(); }
  else if (b.id === 'save') out('save'); else if (b.id === 'copy') out('copy');
});
$('#cc').addEventListener('input', (e) => setColor(e.target.value));
document.addEventListener('keydown', (e) => {
  if (!P) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); commitText(); return e.shiftKey ? P.redo() : P.undo(); }
  if (mod && k === 'y') { e.preventDefault(); return P.redo(); }
  if (mod && k === 's') { e.preventDefault(); return out('save'); }
  if (mod && k === 'c') { e.preventDefault(); return out('copy'); }
  if (!mod && !e.altKey && KEYS[e.key]) setTool(KEYS[e.key]);
});
new ResizeObserver(() => { fit(); if (tx) commitText(); }).observe(stage);

window.ed.onLoad(async (d) => {
  document.body.className = d.theme === 'dark' ? 'dark' : 'light';
  document.title = 'Frameo — Annotate · ' + d.name; mime = d.mime;
  closeText();
  try { bmp = await createImageBitmap(new Blob([d.buf])); } catch (e) { P = null; bmp = null; return say('Could not open this image'); }
  kScale = Math.max(1, bmp.width / 1920);
  const prev = P;
  P = Paint.create({ canvas: cv, base: bmp, onChange: sync });
  if (prev) { P.tool = prev.tool; P.color = prev.color; }
  P.width = 6 * kScale; fit(); sync();
});
