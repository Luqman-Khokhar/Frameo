// Display selection helpers. Pure: pass Electron's `screen` module in, so this runs (and is tested) without Electron.
// Coordinates: Electron reports bounds in DIPs; xcap and ffmpeg work in physical pixels of the X root window,
// which spans every monitor. On X11 Electron uses one global scale factor, so physical = DIP * scale.
const even = (n) => Math.round(n) & ~1;
const toPhys = (r, scale) => ({ x: Math.round(r.x * scale), y: Math.round(r.y * scale), w: Math.round(r.width * scale), h: Math.round(r.height * scale) });

/* All displays, left-to-right then top-to-bottom: [{ id, label, primary, bounds, scale, phys }] */
function list(screenApi) {
  const primary = screenApi.getPrimaryDisplay().id;
  const ds = screenApi.getAllDisplays().slice().sort((a, b) => (a.bounds.x - b.bounds.x) || (a.bounds.y - b.bounds.y));
  return ds.map((d, i) => {
    const scale = d.scaleFactor || 1, phys = toPhys(d.bounds, scale);
    return { id: d.id, primary: d.id === primary, bounds: d.bounds, workArea: d.workArea, scale, phys,
      label: 'Screen ' + (i + 1) + ' · ' + phys.w + '×' + phys.h + (d.id === primary ? ' (primary)' : '') };
  });
}

/* Setting value ('primary' | 'all' | display id) -> { all, display }. Unknown ids and single-display systems fall back to the primary display. */
function resolve(setting, ds) {
  const primary = ds.find((d) => d.primary) || ds[0];
  if (ds.length > 1 && setting === 'all') return { all: true, display: primary };
  const hit = ds.length > 1 && /^\d+$/.test(String(setting)) ? ds.find((d) => String(d.id) === String(setting)) : null;
  return { all: false, display: hit || primary };
}

/* Physical rect to hand to xcap for "full screen", or null for the whole X root (single display, or "All screens"). Even-sized for the encoders. */
function fullRect(choice, ds) {
  if (ds.length <= 1 || choice.all) return null;
  const p = choice.display.phys;
  return { x: p.x, y: p.y, w: even(p.w), h: even(p.h) };
}

/* Everything main.js needs for one setting value. */
function current(screenApi, setting) {
  const all = list(screenApi), choice = resolve(setting, all);
  return { list: all, choice, display: choice.display, rect: fullRect(choice, all), multi: all.length > 1 };
}

module.exports = { list, resolve, fullRect, current, toPhys, even };
