/* Live ink overlay: fullscreen transparent canvas driven by the shared paint engine. Commands come from the recording toolbar. */
const cv = document.getElementById('cv');
const dpr = window.devicePixelRatio || 1;
cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
const P = Paint.create({ canvas: cv, width: cv.width, height: cv.height });
P.color = '#E5484D'; P.width = 6 * dpr;
const pt = (e) => [e.clientX * dpr, e.clientY * dpr];
cv.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (P.tool === 'text') { e.preventDefault(); return window.live.text({ x: e.clientX, y: e.clientY, color: P.color, px: P.textSize() / dpr }); }
  window.live.down(); cv.setPointerCapture(e.pointerId); P.shift = e.shiftKey; P.pointerDown(...pt(e)); });
cv.addEventListener('pointermove', (e) => { if (!cv.hasPointerCapture(e.pointerId)) return; P.shift = e.shiftKey; P.pointerMove(...pt(e)); });
const up = (e) => { if (cv.hasPointerCapture(e.pointerId)) { cv.releasePointerCapture(e.pointerId); P.pointerUp(); } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
const TOOLS = ['pen', 'line', 'arrow', 'rect', 'ellipse', 'text', 'eraser'];
window.live.onCmd((c, a) => {
  if (c === 'tool' && TOOLS.includes(a)) { P.tool = a; cv.className = 't-' + a; }
  else if (c === 'color' && /^#[0-9a-f]{6}$/i.test(a)) P.color = a;
  else if (c === 'width' && a > 0 && a <= 40) P.width = a * dpr;
  else if (c === 'text' && a && typeof a.s === 'string') P.addText(a.x * dpr, a.y * dpr, a.s);
  else if (c === 'undo') P.undo(); else if (c === 'redo') P.redo(); else if (c === 'clear') P.clear();
});
