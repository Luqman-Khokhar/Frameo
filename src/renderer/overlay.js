const $ = (id) => document.getElementById(id);
const MIN = 24;
let S = { rect: null, lock: false, ratio: 16 / 9, drag: null, cfg: null };
const W = () => innerWidth, H = () => innerHeight;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let scale = 1;

function layout() {
  const r = S.rect, has = !!r;
  $('dim').hidden = has; $('hint').hidden = has; $('sel').hidden = !has; $('ok').disabled = !has;
  const bar = $('bar'); const bw = bar.offsetWidth || 560;
  let bx = (W() - bw) / 2, by = H() - 130;
  if (has) {
    const s = $('sel').style; s.left = r.x + 'px'; s.top = r.y + 'px'; s.width = r.w + 'px'; s.height = r.h + 'px';
    bx = clamp(r.x + r.w / 2 - bw / 2, 12, W() - bw - 12);
    by = r.y + r.h + 16; if (by > H() - 68) by = r.y - 64; if (by < 12) by = clamp(r.y + r.h - 64, 12, H() - 68);
    const bd = $('badge'); bd.hidden = !S.cfg.badge;
    if (!bd.hidden) { bd.textContent = Math.round(r.w * scale).toLocaleString('en-US') + ' × ' + Math.round(r.h * scale).toLocaleString('en-US') + ' px'; bd.style.left = r.x + 'px'; bd.style.top = (r.y - 34 < 6 ? r.y + 8 : r.y - 34) + 'px'; }
  } else $('badge').hidden = true;
  bar.style.left = bx + 'px'; bar.style.top = by + 'px';
  $('lock').classList.toggle('on', S.lock);
  $('lk').innerHTML = S.lock ? '<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>' : '<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 5.7-1.3"/>';
  document.querySelectorAll('#chips .b').forEach((c) => c.classList.toggle('on', S.lock && Math.abs(S.ratio - +c.dataset.r) < 0.01));
}
function applyRatio(rw, rh) {
  const ratio = rw / rh; const b = S.rect || { x: W() / 2 - 300, y: H() / 2 - 200, w: 600, h: 400 };
  let w = b.w, h = w / ratio; if (h > H() * 0.9) { h = H() * 0.9; w = h * ratio; } if (w > W() * 0.95) { w = W() * 0.95; h = w / ratio; }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  S.lock = true; S.ratio = ratio; S.rect = { x: clamp(cx - w / 2, 0, W() - w), y: clamp(cy - h / 2, 0, H() - h), w, h }; layout();
}
function resize(o, hd, dx, dy) {
  let l = o.x, t = o.y, r = o.x + o.w, b = o.y + o.h;
  if (hd.includes('w')) l += dx; if (hd.includes('e')) r += dx; if (hd.includes('n')) t += dy; if (hd.includes('s')) b += dy;
  l = Math.max(0, l); t = Math.max(0, t); r = Math.min(W(), r); b = Math.min(H(), b);
  if (r - l < MIN) { if (hd.includes('w')) l = r - MIN; else r = l + MIN; }
  if (b - t < MIN) { if (hd.includes('n')) t = b - MIN; else b = t + MIN; }
  if (S.lock) {
    let w = r - l, h = b - t;
    if (hd.length === 2) { if (Math.abs(dx) >= Math.abs(dy)) h = w / S.ratio; else w = h * S.ratio; if (hd.includes('w')) l = r - w; else r = l + w; if (hd.includes('n')) t = b - h; else b = t + h; }
    else if (hd === 'e' || hd === 'w') { h = w / S.ratio; const cy = (t + b) / 2; t = cy - h / 2; b = cy + h / 2; }
    else { w = h * S.ratio; const cx = (l + r) / 2; l = cx - w / 2; r = cx + w / 2; }
    if (l < 0 || t < 0 || r > W() || b > H() || r - l < MIN || b - t < MIN) return o;
  }
  return { x: l, y: t, w: r - l, h: b - t };
}
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('#bar')) return;
  const h = e.target.closest('.h'); const inSel = e.target.closest('#sel');
  const p = { x: e.clientX, y: e.clientY };
  if (S.rect && h) S.drag = { mode: 'resize', h: h.dataset.h, p0: p, o: { ...S.rect } };
  else if (S.rect && inSel) S.drag = { mode: 'move', p0: p, o: { ...S.rect } };
  else { S.drag = { mode: 'new', p0: p, o: S.rect }; S.rect = null; layout(); }
});
document.addEventListener('mousemove', (e) => {
  const d = S.drag; if (!d) return;
  const dx = e.clientX - d.p0.x, dy = e.clientY - d.p0.y;
  if (d.mode === 'move') S.rect = { ...d.o, x: clamp(d.o.x + dx, 0, W() - d.o.w), y: clamp(d.o.y + dy, 0, H() - d.o.h) };
  else if (d.mode === 'resize') S.rect = resize(d.o, d.h, dx, dy);
  else {
    let ddy = dy; if (S.lock) { const h = Math.abs(dx) / S.ratio; ddy = dy < 0 ? -h : h; }
    let x = Math.min(d.p0.x, d.p0.x + dx), y = Math.min(d.p0.y, d.p0.y + ddy), w = Math.abs(dx), h = Math.abs(ddy);
    x = clamp(x, 0, W()); y = clamp(y, 0, H()); S.rect = { x, y, w: Math.min(w, W() - x), h: Math.min(h, H() - y) };
  }
  layout();
});
document.addEventListener('mouseup', () => {
  const d = S.drag; S.drag = null; if (!d) return;
  if (d.mode === 'new' && (!S.rect || S.rect.w < 12 || S.rect.h < 12)) S.rect = d.o;
  layout();
});
const finish = (ok) => ov.done(ok && S.rect ? { rect: S.rect, lock: S.lock, ratio: S.ratio } : null);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(false); if (e.key === 'Enter' && S.rect) finish(true); });
$('cancel').onclick = () => finish(false); $('ok').onclick = () => finish(true);
$('lock').onclick = () => { S.lock = !S.lock; if (S.lock && S.rect) S.ratio = S.rect.w / S.rect.h; layout(); };
ov.onInit((c) => {
  S.cfg = c; scale = c.scale || 1; S.lock = !!c.lock; S.ratio = c.ratio || 16 / 9;
  document.documentElement.style.setProperty('--dim', c.dim / 100);
  const dim = 'rgba(34,35,30,' + (c.dim / 100) + ')';
  $('dim').style.background = dim; $('sel').style.boxShadow = '0 0 0 2px #F2C46A, 0 0 0 9999px ' + dim;
  $('ok').textContent = c.confirm || 'Capture';
  if (c.size) { const w = Math.min(c.size.w / scale, W()), h = Math.min(c.size.h / scale, H()); S.rect = { x: (W() - w) / 2, y: (H() - h) / 2, w, h }; }
  const chips = $('chips'); chips.innerHTML = '';
  if (c.ratios) [['16:9', 16, 9], ['4:3', 4, 3], ['1:1', 1, 1], ['9:16', 9, 16]].forEach(([l, a, b]) => {
    const el = document.createElement('button'); el.className = 'b'; el.textContent = l; el.dataset.r = a / b; el.onclick = () => applyRatio(a, b); chips.appendChild(el);
  });
  $('sep').hidden = !c.ratios;
  layout();
});
