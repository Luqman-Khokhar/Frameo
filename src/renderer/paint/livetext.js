const t = document.getElementById('t');
const q = new URLSearchParams(location.search);
const col = q.get('c') || '', px = Number(q.get('px'));
t.style.color = /^#[0-9a-f]{6}$/i.test(col) ? col : '#E5484D';
t.style.fontSize = (px >= 8 && px <= 400 ? px : 20) + 'px';
t.focus();
t.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.lt.done(t.value); }
  else if (e.key === 'Escape') { e.preventDefault(); window.lt.done(''); }
});
window.lt.onCommit(() => window.lt.done(t.value));
window.addEventListener('focus', () => t.focus());
