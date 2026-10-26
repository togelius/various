// ACCESSION — the overlays both board views share (BUILD.md §6.2): surfaces, your ring, the
// marks of the view model (calls, noise rings, a thrown Solution's area, the path preview,
// telegraphs), what stands or lies on a tile (case glyphs, staff-door grades, labels, items),
// one-turn cues, actors with the hostile mark and their glyphs, the aim, the selection and
// edge arrows. Each view supplies rectOf(x, y), a tile's rectangle in canvas CSS pixels, and
// actorRect(a), an actor's sprite square, so the same marks look the same in top-down and
// 3D, and in 3D nothing in the scene can hide them.
//
// list() returns a display list in drawing order: { kind, id, group, x, y, rect, paint(ctx) }.
// A view paints it, keeps it for renderer.inspect(), and the 3D view repaints items one at
// a time to build its id buffer, so what the checks measure is exactly what was drawn. An
// actor and its own marks share a group, as do a telegraph's fill and its number.
//
// Every colour that carries meaning is one of the reserved five (§7.2, §9.1), named in
// COLOURS, and every mark's meaning is in its shape too: a telegraph is a filled, outlined
// tile with its number; a call a dashed outline round the tiles it reaches; a noise ring a
// faint fill whose edge is dotted (soft), dashed (loud) or solid and double (crash); a
// Solution's area a dotted square; the aim four inward ticks; a case's lock a padlock with
// one bar per grade; cracks jagged lines, one per blow taken; a surface hatching with its
// pictogram. White and black are used only for outlines, cues and numbers.
//
// clearBottom is how far down the board is uncovered (the phone's label sheet covers the
// rest). A hostile whose centre is outside the clear part gets an edge arrow inside it.
'use strict';
const Marks = (() => {
  const S = () => ART.palettes.semantic;
  // The reserved colour each kind of mark or glyph is drawn in (pictograms take theirs from
  // Pictograms.COLOUR). test/colours.test.js checks every one is a reserved colour.
  const COLOURS = {
    ring: 'player', path: 'player', area: 'player', aim: 'player', you: 'player',
    telegraph: 'hazard', call: 'hazard', surface: 'hazard', special: 'hazard',
    noise: 'readable', lock: 'readable', cracks: 'readable', selection: 'readable',
    hostile: 'hostile', edge: 'hostile',
  };
  const col = k => S()[COLOURS[k]];
  // The state glyph of an exhibit's mode (§8.2's table folds searching into hunting and
  // reinstalling into returning, D1.1); a sleeper with pips shows its pips instead.
  const GLYPH = { dormant: 'asleep', awake: 'alert', hunting: 'hunting', searching: 'hunting', returning: 'returning', reinstalling: 'returning' };
  const glyphOf = mode => GLYPH[mode] || 'alert';
  // An item's pictogram: a consumable's seal shape (D5.11), else its kind's.
  const iconOf = it => (it && it.shape) || (it && it.icon === 'consumable' ? 'seal' : (it && it.icon) || 'seal');
  const NOISE = { soft: 1, loud: 2, crash: 3 };

  function list(vm, rectOf, actorRect, tile, width, height, clearBottom) {
    const out = [];
    let group = null;
    const add = (kind, id, x, y, rect, paint) => out.push({ kind, id, group: group || id, x, y, rect, paint });
    const bottom = clearBottom == null ? height : Math.min(height, clearBottom);
    const g = Math.max(8, Math.floor(tile / 3));
    const off = r => r.x + r.w < 0 || r.y + r.h < 0 || r.x > width || r.y > height;
    const marks = vm.marks || [];
    const ofKind = k => marks.filter(m => m.kind === k);
    // A set of tiles, for drawing a region's edges: at(x, y) → the value stored, or 0.
    const tileSet = (list, value) => {
      const t = new Map();
      for (const m of list) t.set(m.y * vm.w + m.x, value ? value(m) : 1);
      return (x, y) => (x < 0 || y < 0 || x >= vm.w || y >= vm.h ? 0 : t.get(y * vm.w + x) || 0);
    };
    // The edges of tile (x, y) whose neighbour `at` holds less than `v`, as one path.
    const edges = (ctx, r, x, y, at, v, inset) => {
      const k = inset || 0.5;
      ctx.beginPath();
      if (at(x, y - 1) < v) { ctx.moveTo(r.x, r.y + k); ctx.lineTo(r.x + r.w, r.y + k); }
      if (at(x, y + 1) < v) { ctx.moveTo(r.x, r.y + r.h - k); ctx.lineTo(r.x + r.w, r.y + r.h - k); }
      if (at(x - 1, y) < v) { ctx.moveTo(r.x + k, r.y); ctx.lineTo(r.x + k, r.y + r.h); }
      if (at(x + 1, y) < v) { ctx.moveTo(r.x + r.w - k, r.y); ctx.lineTo(r.x + r.w - k, r.y + r.h); }
      ctx.stroke();
    };

    // Surfaces (a Fumigant cloud, plaster dust): hatching over each tile in view that one
    // covers, with the surface's pictogram in the tile's corner.
    for (const s of vm.surfaces || []) {
      const r = rectOf(s.x, s.y);
      if (off(r)) continue;
      add('mark', `surface:${s.kind}:${s.x},${s.y}`, s.x, s.y, r, ctx => {
        ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = col('surface'); ctx.lineWidth = 1; ctx.beginPath();
        for (let d = -r.h; d < r.w; d += 6) { ctx.moveTo(r.x + d, r.y + r.h); ctx.lineTo(r.x + d + r.h, r.y); }
        ctx.stroke(); ctx.restore();
        Pictograms.draw(ctx, Pictograms.G[s.kind] ? s.kind : 'dust', r.x + r.w - g, r.y, g);
      });
    }

    // Your ring: a faint fill and an outline round the tiles that count as close.
    const ringAt = (i, j) => (i >= 0 && j >= 0 && i < vm.w && j < vm.h && vm.ring[j * vm.w + i] ? 1 : 0);
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
      if (!vm.ring[y * vm.w + x]) continue;
      const r = rectOf(x, y);
      if (off(r)) continue;
      add('ring', 'ring:' + x + ',' + y, x, y, r, ctx => {
        ctx.globalAlpha = 0.08; ctx.fillStyle = col('ring'); ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 0.55; ctx.strokeStyle = col('ring'); ctx.lineWidth = 1;
        edges(ctx, r, x, y, ringAt, 1); ctx.globalAlpha = 1;
      });
    }

    // A herald's call, beneath every other mark and the actors (§6.3's exemption, as the
    // telegraph fill): a faint fill, with a dashed outline round the tiles it reaches.
    const calls = ofKind('call'), callAt = tileSet(calls);
    for (const m of calls) {
      const r = rectOf(m.x, m.y);
      if (off(r)) continue;
      add('mark', 'call:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.globalAlpha = 0.12; ctx.fillStyle = col('call'); ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 0.9; ctx.strokeStyle = col('call'); ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        edges(ctx, r, m.x, m.y, callAt, 1, 1); ctx.setLineDash([]); ctx.globalAlpha = 1;
      });
    }

    // The noise rings of the last step: a faint fill over every tile a noise reached, edged
    // where a quieter noise or none reached the next tile: dotted for soft, dashed for loud,
    // solid and double for a crash.
    const noises = ofKind('noise'), noiseAt = tileSet(noises, m => NOISE[m.cls] || 1);
    for (const m of noises) {
      const r = rectOf(m.x, m.y), v = NOISE[m.cls] || 1;
      if (off(r)) continue;
      add('mark', 'noise:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.globalAlpha = 0.1; ctx.fillStyle = col('noise'); ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 0.85; ctx.strokeStyle = col('noise');
        ctx.lineWidth = v === 3 ? 2 : 1.5; ctx.setLineDash(v === 1 ? [1.5, 3] : v === 2 ? [5, 3] : []);
        edges(ctx, r, m.x, m.y, noiseAt, v, 1);
        if (v === 3) { ctx.lineWidth = 1; edges(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, m.x, m.y, noiseAt, v, 1); }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      });
    }

    // The square a thrown Solution would cover, round where you aim it: a dotted outline
    // round a faint fill.
    const area = ofKind('area'), areaAt = tileSet(area);
    for (const m of area) {
      const r = rectOf(m.x, m.y);
      if (off(r)) continue;
      add('mark', 'area:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.globalAlpha = 0.18; ctx.fillStyle = col('area'); ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 1; ctx.strokeStyle = col('area'); ctx.lineWidth = 2; ctx.setLineDash([2, 2]);
        edges(ctx, r, m.x, m.y, areaAt, 1, 1); ctx.setLineDash([]);
      });
    }

    // One-turn cue: the tile an actor has just left, as a faint trace.
    for (const c of (vm.cues && vm.cues.movedFrom) || []) {
      const r = rectOf(c.x, c.y);
      add('cue', 'moved:' + c.uid, c.x, c.y, r, ctx => {
        ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.strokeRect(r.x + r.w * 0.25, r.y + r.h * 0.25, r.w * 0.5, r.h * 0.5);
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      });
    }

    // The path preview.
    for (const [x, y] of vm.path || []) {
      const t = rectOf(x, y), r = { x: t.x + t.w / 2 - 2, y: t.y + t.h / 2 - 2, w: 4, h: 4 };
      add('mark', 'path:' + x + ',' + y, x, y, r, ctx => { ctx.fillStyle = col('path'); ctx.fillRect(r.x, r.y, r.w, r.h); });
    }

    // A telegraphed tile: the hazard fill under the actors; its number goes on last.
    const tele = ofKind('telegraph');
    for (const m of tele) {
      const r = rectOf(m.x, m.y);
      group = 'telegraph:' + m.x + ',' + m.y;
      add('mark', 'telegraph:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.globalAlpha = 0.35; ctx.fillStyle = col('telegraph'); ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
        ctx.strokeStyle = col('telegraph'); ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      });
      group = null;
    }

    // What stands or lies on a tile, beneath the actors (an exhibit in a case stands over its
    // case's glyphs). A case: its lock (a padlock with one bar per grade it needs) while it is
    // shut, cracks for the blows its glass has taken, and what it holds or, on loan, the empty
    // frame. A closed staff door: its lock and grade. An identifying label: its pictogram.
    // One bar per grade, as wide as the tile allows beside the padlock.
    const bars = (r, grade) => {
      const n = Math.max(1, grade), per = Math.max(2, Math.min(Math.floor(g / 5) + 1, Math.floor((r.w - g - 3) / n))), q = Math.max(1, per - 1);
      return { q, gap: per - q, w: Math.max(0, grade) * per };
    };
    const lockRect = (r, grade) => ({ x: r.x + 1, y: r.y + r.h - g - 1, w: g + 2 + bars(r, grade).w, h: g });
    const lockGlyph = (ctx, r, grade) => {
      const { q, gap, w } = bars(r, grade), y = r.y + r.h - g - 1, top = Math.floor(g / 4);
      Pictograms.draw(ctx, 'lock', r.x + 1, y, g, col('lock'));
      ctx.fillStyle = '#000000'; ctx.fillRect(r.x + g + 1, y + top - 1, w + 1, g - top + 2);
      ctx.fillStyle = col('lock');
      for (let i = 0; i < grade; i++) ctx.fillRect(r.x + g + 2 + i * (q + gap), y + top, q, g - top);
    };
    const centre = r => ({ x: r.x + r.w / 2 - g / 2, y: r.y + r.h / 2 - g / 2 - Math.floor(g / 4), w: g, h: g });
    for (const c of vm.cases || []) {
      const r = rectOf(c.x, c.y);
      if (off(r)) continue;
      const at = c.x + ',' + c.y;
      if (c.holds) {
        const q = centre(r), shown = (vm.items || []).find(i => i.uid === c.holds.uid) || c.holds;
        add('mark', 'holds:' + at, c.x, c.y, q, ctx => Pictograms.draw(ctx, iconOf(shown), q.x, q.y, g));
      } else if (c.loan) {
        const q = centre(r);
        add('mark', 'loan:' + at, c.x, c.y, q, ctx => Pictograms.draw(ctx, 'loan', q.x, q.y, g));
      }
      if (c.st === 'shut' && c.hits > 0) {
        const q = { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - g - 4 };
        add('mark', 'cracks:' + at, c.x, c.y, q, ctx => {
          ctx.strokeStyle = col('cracks'); ctx.lineWidth = 1.5; ctx.beginPath();
          for (let i = 0; i < c.hits; i++) {
            const x0 = q.x + q.w * (0.2 + 0.3 * i), steps = 4;
            ctx.moveTo(x0, q.y);
            for (let k = 1; k <= steps; k++) ctx.lineTo(x0 + (k % 2 ? 0.12 : -0.04) * q.w, q.y + q.h * k / steps);
          }
          ctx.stroke();
        });
      }
      if (c.st === 'shut') { const q = lockRect(r, c.lock); add('mark', 'lock:' + at, c.x, c.y, q, ctx => lockGlyph(ctx, r, c.lock)); }
    }
    for (const f of vm.staff || []) {
      const r = rectOf(f.x, f.y);
      if (f.open || off(r)) continue;
      const q = lockRect(r, f.grade);
      add('mark', 'lock:' + f.x + ',' + f.y, f.x, f.y, q, ctx => lockGlyph(ctx, r, f.grade));
    }
    for (const p of vm.plaques || []) {
      const r = rectOf(p.x, p.y), q = { x: r.x + r.w / 2 - g / 2, y: r.y + r.h / 2 - g / 2, w: g, h: g };
      if (off(r)) continue;
      add('mark', 'plaque:' + p.x + ',' + p.y, p.x, p.y, q, ctx => Pictograms.draw(ctx, 'reads', q.x, q.y, g));
    }
    // Items on the floor (and in a case that does not list them): the first on each tile, with
    // a second outline behind it where there are more.
    const caseHolds = new Set((vm.cases || []).filter(c => c.holds).map(c => c.holds.uid));
    const firstOn = new Map();
    for (const it of vm.items || []) {
      if (caseHolds.has(it.uid)) continue;
      const k = it.y * vm.w + it.x;
      if (firstOn.has(k)) firstOn.get(k).more = true; else firstOn.set(k, { it, more: false });
    }
    for (const it of vm.items || []) {
      const e = firstOn.get(it.y * vm.w + it.x);
      if (!e || e.it !== it) continue;
      const r = rectOf(it.x, it.y), k = Math.round(g * 1.25), q = { x: r.x + r.w / 2 - k / 2, y: r.y + r.h / 2 - k / 2, w: k, h: k };
      if (off(r)) continue;
      add('mark', 'item:' + it.x + ',' + it.y, it.x, it.y, q, ctx => {
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(q.x - 1, q.y - 1, q.w + 2, q.h + 2);
        if (e.more) { ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.strokeRect(q.x + 2.5, q.y - 2.5, q.w, q.h); }
        Pictograms.draw(ctx, iconOf(it), q.x, q.y, k);
      });
    }

    // Actors, back to front: northern ones first, so a nearer one is drawn over a farther one.
    const placed = order(vm.actors).map(a => ({ a, r: actorRect(a) }));
    for (const { a, r } of placed) {
      group = a.uid;
      add('actor', a.uid, a.x, a.y, r, ctx => {
        const img = Sprites.board(a.sprite, vm.dept);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(r.x + r.w * 0.15, r.y + r.h * 0.84, r.w * 0.7, r.h * 0.12);
        if (img) ctx.drawImage(img, r.x, r.y, r.w, r.h);
        else { ctx.fillStyle = a.hostile ? S().hostile : S().player; ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); }
      });
    }

    // Each actor's marks: the reserved base bar (hostile red, your blue), its glyph row (an
    // exhibit in a case shows the glass, then its state glyph or pips, then the special it is
    // marking), a hit cue, a cue when its special has just gone off, and the selection bracket.
    // The glyph row sits above the actor or, where another actor stands there, beside its head,
    // so it never covers another exhibit (§6.3: actors are never hidden), and along the top of
    // its own square only where every side is taken.
    group = null;
    // An actor counts as on the board when at least a quarter of its square shows each way
    // in the clear part; a hostile on the board keeps its bar inside the part that shows, and
    // any other hostile gets an edge arrow instead (below).
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(Math.max(lo, hi), v));
    const shows = r => ({ x0: Math.max(0, r.x), x1: Math.min(width, r.x + r.w), y0: Math.max(0, r.y), y1: Math.min(bottom, r.y + r.h) });
    const inClear = r => { const v = shows(r); return v.x1 - v.x0 >= r.w / 4 && v.y1 - v.y0 >= r.h / 4; };
    const meets = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
    const hit = new Set((vm.cues && vm.cues.hit) || []), went = new Set((vm.cues && vm.cues.special) || []);
    const rows = new Map();
    for (const { a, r } of placed) {
      group = a.uid;
      let bar = { x: r.x + r.w * 0.2, y: r.y + r.h - 3, w: r.w * 0.6, h: 2 };
      if (inClear(r)) {
        const v = shows(r), w = Math.min(bar.w, v.x1 - v.x0);
        bar = { x: clamp(bar.x, v.x0, v.x1 - w), y: clamp(bar.y, v.y0, v.y1 - 3), w, h: 2 };
      }
      add(a.hostile ? 'mark' : 'own', a.hostile ? 'hostile:' + a.uid : 'you-bar', a.x, a.y, bar, ctx => {
        ctx.fillStyle = a.hostile ? col('hostile') : col('you'); ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      });
      if (a.hostile) {
        const pips = a.mode === 'dormant' && a.pips, id = glyphOf(a.mode);
        const parts = [];
        if (a.encased) parts.push({ id: 'encased:' + a.uid, w: g, draw: (ctx, x, y) => Pictograms.draw(ctx, 'glass', x, y, g) });
        parts.push(pips ? { id: 'state:' + a.uid, w: 3 * g, draw: (ctx, x, y) => { for (let i = 0; i < 3; i++) Pictograms.draw(ctx, i < a.pips ? 'pip' : 'pip_empty', x + i * g, y, g); } }
          : { id: 'state:' + a.uid, w: g, draw: (ctx, x, y) => Pictograms.draw(ctx, id, x, y, g) });
        if (a.telegraphing) parts.push({ id: 'telegraphing:' + a.uid, w: g, draw: (ctx, x, y) => Pictograms.draw(ctx, 'special', x, y, g, col('special')) });
        const total = parts.reduce((s, p) => s + p.w, 0);
        // Alone, a sleeper's glyph sits at the right; anything else is centred.
        let x = parts.length === 1 && !pips && id === 'asleep' ? r.x + r.w - g : r.x + r.w / 2 - total / 2;
        // Above it; where another actor stands there, beside its head, right then left; where
        // both sides are taken too, along the top of its own square.
        const spots = [{ x, y: r.y - g + 2 }, { x: r.x + r.w, y: r.y + 1 }, { x: r.x - total, y: r.y + 1 }];
        const spot = spots.find(q => !placed.some(p => p.a !== a && meets({ x: q.x, y: q.y, w: total, h: g }, p.r))) || { x, y: r.y + 1 };
        x = spot.x;
        const y = spot.y;
        rows.set(a.uid, { x, y, w: total, h: g });
        for (const p of parts) {
          const q = { x, y, w: p.w, h: g }, draw = p.draw;
          add('mark', p.id, a.x, a.y, q, ctx => draw(ctx, q.x, q.y));
          x += p.w;
        }
      }
      if (hit.has(a.uid)) {
        const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 }, k = r.w * 0.45;
        add('cue', 'hit:' + a.uid, a.x, a.y, { x: c.x - k, y: c.y - k, w: 2 * k, h: 2 * k }, ctx => {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const ang = i * Math.PI / 4, a0 = k * 0.62, a1 = k;
            ctx.moveTo(c.x + Math.cos(ang) * a0, c.y + Math.sin(ang) * a0); ctx.lineTo(c.x + Math.cos(ang) * a1, c.y + Math.sin(ang) * a1);
          }
          ctx.stroke();
        });
      }
      if (went.has(a.uid)) {
        const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 }, k = r.w * 0.5;
        add('cue', 'special:' + a.uid, a.x, a.y, { x: c.x - k, y: c.y - k, w: 2 * k, h: 2 * k }, ctx => {
          ctx.strokeStyle = col('special'); ctx.lineWidth = 2; ctx.setLineDash([3, 2]);
          ctx.beginPath(); ctx.arc(c.x, c.y, k - 1, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        });
      }
      if (vm.selection === a.uid) add('mark', 'selection', a.x, a.y, r, ctx => bracket(ctx, r.x, r.y, r.w, r.h));
    }
    group = null;

    // The aim: four ticks pointing in from the middle of each edge of the tile you aim at.
    for (const m of ofKind('aim')) {
      const r = rectOf(m.x, m.y), k = Math.max(4, Math.floor(Math.min(r.w, r.h) / 4));
      add('mark', 'aim:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 4; ticks(ctx, r, k);
        ctx.strokeStyle = col('aim'); ctx.lineWidth = 2; ticks(ctx, r, k);
      });
    }

    // One-turn cue: glass that has just broken, as a burst over its tile.
    for (const c of (vm.cues && vm.cues.broke) || []) {
      const r = rectOf(c.x, c.y), cx = r.x + r.w / 2, cy = r.y + r.h / 2, k = Math.min(r.w, r.h) * 0.48;
      add('cue', 'broke:' + c.x + ',' + c.y, c.x, c.y, r, ctx => {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = i * Math.PI / 3 + 0.3;
          ctx.moveTo(cx + Math.cos(ang) * k * 0.3, cy + Math.sin(ang) * k * 0.3); ctx.lineTo(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
        }
        ctx.stroke();
      });
    }

    if (vm.selectedTile) {
      const r = rectOf(vm.selectedTile.x, vm.selectedTile.y);
      add('mark', 'selection', vm.selectedTile.x, vm.selectedTile.y, r, ctx => bracket(ctx, r.x, r.y, r.w, r.h));
    }

    // Off-screen threats (§7.2): a hostile you can see that lies wholly outside the clear part
    // of the board gets a hostile-red arrow at the nearest clear edge, pointing towards it,
    // moved along the edge to the nearest spot that covers no visible actor and no other arrow
    // (or, if the whole edge is taken, where it overlaps least).
    // An actor that shows takes its square, and a hostile's glyph row too.
    const k = 10, taken = placed.filter(p => { const v = shows(p.r); return v.x1 > v.x0 && v.y1 > v.y0; })
      .map(p => {
        const q = rows.get(p.a.uid);
        if (!q) return p.r;
        const x0 = Math.min(p.r.x, q.x), y0 = Math.min(p.r.y, q.y);
        return { x: x0, y: y0, w: Math.max(p.r.x + p.r.w, q.x + q.w) - x0, h: Math.max(p.r.y + p.r.h, q.y + q.h) - y0 };
      });
    const overlap = (x, y) => taken.reduce((n, q) => n + Math.max(0, Math.min(x + k, q.x + q.w) - Math.max(x - k, q.x)) * Math.max(0, Math.min(y + k, q.y + q.h) - Math.max(y - k, q.y)), 0);
    for (const { a, r } of placed) {
      if (!a.hostile || inClear(r)) continue;
      group = a.uid;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, x0 = clamp(cx, k, width - k), y0 = clamp(cy, k, bottom - k);
      const alongX = y0 <= k || y0 >= bottom - k, hi = alongX ? width - k : bottom - k, home = alongX ? x0 : y0;
      // Candidates along the edge: the clamped spot, and just past each end of everything already
      // there; the clear one nearest the clamped spot wins, else the one overlapping least.
      const cands = [home];
      for (const q of taken) { const lo = alongX ? q.x : q.y, len = alongX ? q.w : q.h; cands.push(lo - k - 1, lo + len + k + 1); }
      const place = c => alongX ? [clamp(c, k, hi), y0] : [x0, clamp(c, k, hi)];
      let bx = x0, by = y0, best = Infinity, bestD = Infinity;
      for (const c of cands) {
        const [px, py] = place(c), o = overlap(px, py), d = Math.abs((alongX ? px : py) - home);
        if (o < best || (o === best && d < bestD)) { best = o; bestD = d; bx = px; by = py; }
      }
      const ex = bx, ey = by;
      taken.push({ x: ex - k, y: ey - k, w: 2 * k, h: 2 * k });
      const ang = Math.atan2(cy - ey, cx - ex), at = { x: ex, y: ey };
      add('mark', 'edge:' + a.uid, a.x, a.y, { x: at.x - k, y: at.y - k, w: 2 * k, h: 2 * k }, ctx => {
        ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(ang);
        ctx.fillStyle = col('edge'); ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(-k * 0.7, -k * 0.8); ctx.lineTo(-k * 0.7, k * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      });
    }
    group = null;

    // The telegraph numbers go on last, so no actor covers them.
    for (const m of tele) {
      const t = rectOf(m.x, m.y), fs = Math.floor(Math.min(t.w, t.h) * 0.42), r = { x: t.x + t.w / 2 - fs, y: t.y + t.h / 2 - fs * 0.6, w: 2 * fs, h: 1.2 * fs };
      group = 'telegraph:' + m.x + ',' + m.y;
      add('mark', 'telegraph:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
        ctx.font = `bold ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeText(String(m.dmg), t.x + t.w / 2, t.y + t.h / 2); ctx.fillText(String(m.dmg), t.x + t.w / 2, t.y + t.h / 2);
      });
    }
    return out;
  }

  // Four short ticks pointing in from the middle of each edge of r.
  function ticks(ctx, r, k) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, r.y + 1); ctx.lineTo(cx, r.y + 1 + k);
    ctx.moveTo(cx, r.y + r.h - 1); ctx.lineTo(cx, r.y + r.h - 1 - k);
    ctx.moveTo(r.x + 1, cy); ctx.lineTo(r.x + 1 + k, cy);
    ctx.moveTo(r.x + r.w - 1, cy); ctx.lineTo(r.x + r.w - 1 - k, cy);
    ctx.stroke();
  }

  function bracket(ctx, px, py, w, h) {
    ctx.strokeStyle = S()[COLOURS.selection]; ctx.lineWidth = 2;
    const k = Math.floor(Math.min(w, h) / 4);
    ctx.beginPath();
    ctx.moveTo(px + 1, py + k); ctx.lineTo(px + 1, py + 1); ctx.lineTo(px + k, py + 1);
    ctx.moveTo(px + w - k, py + 1); ctx.lineTo(px + w - 1, py + 1); ctx.lineTo(px + w - 1, py + k);
    ctx.moveTo(px + 1, py + h - k); ctx.lineTo(px + 1, py + h - 1); ctx.lineTo(px + k, py + h - 1);
    ctx.moveTo(px + w - k, py + h - 1); ctx.lineTo(px + w - 1, py + h - 1); ctx.lineTo(px + w - 1, py + h - k);
    ctx.stroke();
  }

  const order = actors => actors.slice().sort((a, b) => (a.y + (a.size || 1)) - (b.y + (b.size || 1)) || a.x - b.x);

  // What renderer.inspect() reports: actors and marks (ring, cues and your own bar are
  // drawn but are not marks of the view model) that touch the board, in client coordinates.
  function inspected(items, left, top, width, height) {
    return items.filter(d => (d.kind === 'actor' || d.kind === 'mark') && d.rect.x + d.rect.w > 0 && d.rect.y + d.rect.h > 0 && d.rect.x < width && d.rect.y < height)
      .map(d => ({ kind: d.kind, id: d.id, x: d.x, y: d.y, rect: { x: left + d.rect.x, y: top + d.rect.y, w: d.rect.w, h: d.rect.h } }));
  }

  return { list, inspected, bracket, order, COLOURS, GLYPH, glyphOf, iconOf };
})();
