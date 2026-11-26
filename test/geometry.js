// Pure-Node test for display selection geometry: node test/geometry.js
const assert = require('assert'); const d = require('../src/displays');
const disp = (id, x, y, w, h, scale = 1) => ({ id, scaleFactor: scale, bounds: { x, y, width: w, height: h }, workArea: { x, y, width: w, height: h } });
const api = (list, primaryId) => ({ getAllDisplays: () => list, getPrimaryDisplay: () => list.find((x) => x.id === primaryId) });
const t = (n, f) => { f(); console.log('[geometry] ok  ', n); };
const two = api([disp(2, 1920, 0, 1280, 1024), disp(1, 0, 0, 1920, 1080)], 1);
t('list sorted left to right, primary flagged', () => { const l = d.list(two); assert.deepStrictEqual(l.map((x) => x.id), [1, 2]); assert.deepStrictEqual(l.map((x) => x.primary), [true, false]); assert.strictEqual(l[1].label, 'Screen 2 · 1280×1024'); assert.strictEqual(l[0].label, 'Screen 1 · 1920×1080 (primary)'); });
t('physical rects use the scale factor', () => { const l = d.list(api([disp(1, 0, 0, 1280, 720, 1.5), disp(2, 1280, 0, 1280, 720, 1.5)], 1)); assert.deepStrictEqual(l[1].phys, { x: 1920, y: 0, w: 1920, h: 1080 }); });
t('resolve: default, id, all, unknown id, junk', () => {
  const l = d.list(two);
  assert.strictEqual(d.resolve('primary', l).display.id, 1); assert.strictEqual(d.resolve('2', l).display.id, 2); assert.strictEqual(d.resolve(2, l).display.id, 2);
  assert.strictEqual(d.resolve('all', l).all, true); assert.strictEqual(d.resolve('99', l).display.id, 1); assert.strictEqual(d.resolve('../x', l).display.id, 1); assert.strictEqual(d.resolve(undefined, l).display.id, 1);
});
t('fullRect: chosen display in root coordinates, even sized', () => {
  const l = d.list(api([disp(1, 0, 0, 1920, 1080), disp(2, 1920, -100, 1281, 1025)], 1));
  assert.deepStrictEqual(d.fullRect(d.resolve('2', l), l), { x: 1920, y: -100, w: 1280, h: 1024 });
  assert.deepStrictEqual(d.fullRect(d.resolve('primary', l), l), { x: 0, y: 0, w: 1920, h: 1080 });
});
t('fullRect: null for All screens (whole root)', () => { const l = d.list(two); assert.strictEqual(d.fullRect(d.resolve('all', l), l), null); });
t('single display never changes behaviour: null rect, ignores setting', () => {
  const one = api([disp(7, 0, 0, 1920, 1080)], 7), c = d.current(one, '2');
  assert.strictEqual(c.rect, null); assert.strictEqual(c.multi, false); assert.strictEqual(c.display.id, 7); assert.strictEqual(d.current(one, 'all').all, undefined);
});
t('three monitors with negative offsets', () => {
  const l = d.list(api([disp(3, 3840, 0, 1920, 1080), disp(1, 0, 0, 1920, 1080), disp(2, -1280, 100, 1280, 1024)], 1));
  assert.deepStrictEqual(l.map((x) => x.id), [2, 1, 3]); assert.deepStrictEqual(d.fullRect(d.resolve('2', l), l), { x: -1280, y: 100, w: 1280, h: 1024 });
});
console.log('[geometry] ALL PASS');
