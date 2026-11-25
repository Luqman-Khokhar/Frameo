/* Frameo paint engine: vector annotations on a canvas. No DOM chrome, no image dependency, so the
   screenshot editor and (later) the live recording overlay share it. Coordinates are canvas pixels. */
(function (g) {
  const TOOLS = ['pen', 'line', 'arrow', 'rect', 'ellipse', 'text', 'eraser'];
  const FONT = (s) => '600 ' + s + 'px Inter, Ubuntu, system-ui, sans-serif';
  const textSize = (o) => o.w * 4 + 12;

  const norm = (a, b) => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) });

  function create(opts) {
    const canvas = opts.canvas, base = opts.base || null, onChange = opts.onChange || function () {};
    if (base) { canvas.width = base.width; canvas.height = base.height; } else { canvas.width = opts.width || canvas.width; canvas.height = opts.height || canvas.height; }
    const ctx = canvas.getContext('2d');
    let hist = [[]], hi = 0, list = hist[0], cur = null, raf = 0;

    const p = { tool: 'pen', color: '#E5484D', width: 6, shift: false };

    /* ---- drawing ---- */
    function textBox(o) {
      const s = textSize(o), lines = o.s.split('\n'); ctx.font = FONT(s);
      let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      return { x: o.x, y: o.y, w, h: lines.length * s * 1.25, s, lines };
    }
    function draw(o, ctx) {
      ctx.strokeStyle = o.c; ctx.fillStyle = o.c; ctx.lineWidth = o.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = o.t === 'erase' ? 'destination-out' : 'source-over'; // erase strokes only wipe ink, never the base image
      if (o.t === 'pen' || o.t === 'erase') {
        const q = o.pts;
        if (q.length < 4) { ctx.beginPath(); ctx.arc(q[0], q[1], o.w / 2, 0, 6.2832); ctx.fill(); return; }
        ctx.beginPath(); ctx.moveTo(q[0], q[1]);
        for (let i = 2; i < q.length - 2; i += 2) ctx.quadraticCurveTo(q[i], q[i + 1], (q[i] + q[i + 2]) / 2, (q[i + 1] + q[i + 3]) / 2);
        ctx.lineTo(q[q.length - 2], q[q.length - 1]); ctx.stroke();
      } else if (o.t === 'line' || o.t === 'arrow') {
        ctx.beginPath(); ctx.moveTo(o.a[0], o.a[1]); ctx.lineTo(o.b[0], o.b[1]); ctx.stroke();
        if (o.t === 'arrow') {
          const ang = Math.atan2(o.b[1] - o.a[1], o.b[0] - o.a[0]), h = Math.max(14, o.w * 4);
          ctx.beginPath(); ctx.moveTo(o.b[0], o.b[1]);
          ctx.lineTo(o.b[0] - h * Math.cos(ang - 0.45), o.b[1] - h * Math.sin(ang - 0.45));
          ctx.lineTo(o.b[0] - h * Math.cos(ang + 0.45), o.b[1] - h * Math.sin(ang + 0.45));
          ctx.closePath(); ctx.fill();
        }
      } else if (o.t === 'rect') { const r = norm(o.a, o.b); ctx.strokeRect(r.x, r.y, r.w, r.h); }
      else if (o.t === 'ellipse') {
        const r = norm(o.a, o.b); ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, 6.2832); ctx.stroke();
      } else if (o.t === 'text') {
        const b = textBox(o); ctx.textBaseline = 'top'; ctx.font = FONT(b.s);
        b.lines.forEach((l, i) => ctx.fillText(l, o.x, o.y + i * b.s * 1.25));
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // Ink is drawn on its own layer so erase strokes (destination-out) can clear ink without touching the base image.
    const layer = document.createElement('canvas'), lctx = layer.getContext('2d');
    function render() {
      raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (base) ctx.drawImage(base, 0, 0);
      if (layer.width !== canvas.width || layer.height !== canvas.height) { layer.width = canvas.width; layer.height = canvas.height; }
      lctx.clearRect(0, 0, layer.width, layer.height);
      for (const o of list) draw(o, lctx);
      if (cur) draw(cur, lctx);
      ctx.drawImage(layer, 0, 0);
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(render); }

    /* ---- history ---- */
    function commit(next) {
      hist = hist.slice(0, hi + 1); hist.push(next); if (hist.length > 101) hist.shift();
      hi = hist.length - 1; list = hist[hi]; schedule(); onChange();
    }
    function go(i) { if (i < 0 || i >= hist.length || i === hi) return; hi = i; list = hist[hi]; schedule(); onChange(); }

    /* ---- input (canvas coords) ---- */
    function shape(x, y) {
      const a = cur.a; let bx = x, by = y;
      if (p.shift && (cur.t === 'rect' || cur.t === 'ellipse')) { const m = Math.max(Math.abs(x - a[0]), Math.abs(y - a[1])); bx = a[0] + Math.sign(x - a[0] || 1) * m; by = a[1] + Math.sign(y - a[1] || 1) * m; }
      else if (p.shift && (cur.t === 'line' || cur.t === 'arrow')) { const d = Math.hypot(x - a[0], y - a[1]), an = Math.round(Math.atan2(y - a[1], x - a[0]) / 0.7854) * 0.7854; bx = a[0] + d * Math.cos(an); by = a[1] + d * Math.sin(an); }
      cur.b = [bx, by];
    }
    p.pointerDown = function (x, y) {
      if (p.tool === 'text') return;
      const eraser = p.tool === 'eraser';
      const base0 = { t: eraser ? 'erase' : p.tool, c: p.color, w: eraser ? p.width * 3 : p.width };
      cur = (p.tool === 'pen' || eraser) ? { ...base0, pts: [x, y] } : { ...base0, a: [x, y], b: [x, y] };
      schedule();
    };
    p.pointerMove = function (x, y) {
      if (!cur) return;
      if (cur.pts) { const q = cur.pts; if (Math.hypot(x - q[q.length - 2], y - q[q.length - 1]) >= 1) q.push(x, y); } else shape(x, y);
      schedule();
    };
    p.pointerUp = function () {
      if (!cur) return;
      const o = cur; cur = null;
      if (!o.pts && Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) < 2) return schedule();
      commit(list.concat([o]));
    };
    p.addText = function (x, y, str) { str = String(str).replace(/\s+$/, ''); if (!str.trim()) return; commit(list.concat([{ t: 'text', c: p.color, w: p.width, x, y, s: str }])); };
    p.undo = () => go(hi - 1);
    p.redo = () => go(hi + 1);
    p.clear = () => { if (list.length) commit([]); };
    p.canUndo = () => hi > 0;
    p.canRedo = () => hi < hist.length - 1;
    p.count = () => list.length;
    p.textSize = () => textSize({ w: p.width });
    p.toBlob = (type, q) => { if (raf) { cancelAnimationFrame(raf); render(); } return new Promise((res) => canvas.toBlob(res, type || 'image/png', q)); };

    render();
    return p;
  }
  g.Paint = { create, TOOLS };
})(window);
