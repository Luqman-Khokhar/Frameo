/* Frameo paint engine: vector annotations on a canvas. No DOM chrome, no image dependency, so the
   screenshot editor and (later) the live recording overlay share it. Coordinates are canvas pixels. */
(function (g) {
  const TOOLS = ['pen', 'line', 'arrow', 'rect', 'ellipse', 'text', 'eraser'];
  const FONT = (s) => '600 ' + s + 'px Inter, Ubuntu, system-ui, sans-serif';
  const textSize = (o) => o.w * 4 + 12;

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  const norm = (a, b) => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) });

  function create(opts) {
    const canvas = opts.canvas, base = opts.base || null, onChange = opts.onChange || function () {};
    if (base) { canvas.width = base.width; canvas.height = base.height; } else { canvas.width = opts.width || canvas.width; canvas.height = opts.height || canvas.height; }
    const ctx = canvas.getContext('2d');
    let hist = [[]], hi = 0, list = hist[0], cur = null, erasing = null, last = null, raf = 0;

    const p = { tool: 'pen', color: '#E5484D', width: 6, shift: false };

    /* ---- drawing ---- */
    function textBox(o) {
      const s = textSize(o), lines = o.s.split('\n'); ctx.font = FONT(s);
      let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      return { x: o.x, y: o.y, w, h: lines.length * s * 1.25, s, lines };
    }
    function draw(o) {
      ctx.strokeStyle = o.c; ctx.fillStyle = o.c; ctx.lineWidth = o.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (o.t === 'pen') {
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
        const b = textBox(o); ctx.textBaseline = 'top';
        b.lines.forEach((l, i) => ctx.fillText(l, o.x, o.y + i * b.s * 1.25));
      }
    }
    function render() {
      raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (base) ctx.drawImage(base, 0, 0);
      for (const o of (erasing || list)) draw(o);
      if (cur) draw(cur);
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(render); }

    /* ---- erasing ---- */
    function hit(o, x, y, tol) {
      const r = o.w / 2 + tol;
      if (o.t === 'pen') {
        const q = o.pts; if (q.length < 4) return Math.hypot(x - q[0], y - q[1]) <= r;
        for (let i = 0; i < q.length - 2; i += 2) if (segDist(x, y, q[i], q[i + 1], q[i + 2], q[i + 3]) <= r) return true;
        return false;
      }
      if (o.t === 'line' || o.t === 'arrow') return segDist(x, y, o.a[0], o.a[1], o.b[0], o.b[1]) <= r;
      if (o.t === 'rect') {
        const b = norm(o.a, o.b), x2 = b.x + b.w, y2 = b.y + b.h;
        return Math.min(segDist(x, y, b.x, b.y, x2, b.y), segDist(x, y, x2, b.y, x2, y2), segDist(x, y, x2, y2, b.x, y2), segDist(x, y, b.x, y2, b.x, b.y)) <= r;
      }
      if (o.t === 'ellipse') {
        const b = norm(o.a, o.b), rx = Math.max(b.w / 2, 1), ry = Math.max(b.h / 2, 1);
        return Math.abs(Math.hypot((x - b.x - rx) / rx, (y - b.y - ry) / ry) - 1) * Math.min(rx, ry) <= r;
      }
      const b = textBox(o); return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
    }
    function tol() { const r = canvas.getBoundingClientRect(); return 8 * (r.width ? canvas.width / r.width : 1); }
    function eraseAt(x, y) {
      const t = tol(), a = last || [x, y], n = Math.max(1, Math.ceil(Math.hypot(x - a[0], y - a[1]) / (t / 2)));
      for (let i = 1; i <= n; i++) {
        const px = a[0] + (x - a[0]) * i / n, py = a[1] + (y - a[1]) * i / n;
        const keep = erasing.filter((o) => !hit(o, px, py, t));
        if (keep.length !== erasing.length) erasing = keep;
      }
      last = [x, y]; schedule();
    }

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
      if (p.tool === 'eraser') { erasing = list.slice(); last = null; eraseAt(x, y); return; }
      const base0 = { t: p.tool, c: p.color, w: p.width };
      cur = p.tool === 'pen' ? { ...base0, pts: [x, y] } : { ...base0, a: [x, y], b: [x, y] };
      schedule();
    };
    p.pointerMove = function (x, y) {
      if (erasing) return eraseAt(x, y);
      if (!cur) return;
      if (cur.t === 'pen') { const q = cur.pts; if (Math.hypot(x - q[q.length - 2], y - q[q.length - 1]) >= 1) q.push(x, y); } else shape(x, y);
      schedule();
    };
    p.pointerUp = function () {
      if (erasing) { const changed = erasing.length !== list.length, e = erasing; erasing = null; last = null; if (changed) commit(e); else schedule(); return; }
      if (!cur) return;
      const o = cur; cur = null;
      if (o.t !== 'pen' && Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]) < 2) return schedule();
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
