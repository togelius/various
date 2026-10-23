// ACCESSION — the overlays both board views share (BUILD.md §6.2): your ring, the path
// preview, telegraphs, one-turn cues, actors with the hostile mark and state glyphs, the
// selection and edge arrows. Each view supplies rectOf(x, y), a tile's rectangle in canvas
// CSS pixels, and actorRect(a), an actor's sprite square, so the same marks look the same
// in top-down and 3D, and in 3D nothing in the scene can hide them.
//
// list() returns a display list in drawing order: { kind, id, x, y, rect, paint(ctx) }.
// A view paints it, keeps it for renderer.inspect(), and the 3D view repaints items one at
// a time to build its id buffer, so what the checks measure is exactly what was drawn.
'use strict';
const Marks = (() => {
  const S = () => ART.palettes.semantic;

  function list(vm, rectOf, actorRect, tile, width, height) {
    const out = [], add = (kind, id, x, y, rect, paint) => out.push({ kind, id, x, y, rect, paint });
    const ringAt = (i, j) => i >= 0 && j >= 0 && i < vm.w && j < vm.h && vm.ring[j * vm.w + i];

    // Your ring: a faint fill and an outline round the tiles that count as close.
    for (let y = 0; y < vm.h; y++) for (let x = 0; x < vm.w; x++) {
      if (!vm.ring[y * vm.w + x]) continue;
      const r = rectOf(x, y);
      if (r.x + r.w < 0 || r.y + r.h < 0 || r.x > width || r.y > height) continue;
      add('ring', 'ring:' + x + ',' + y, x, y, r, ctx => {
        ctx.globalAlpha = 0.08; ctx.fillStyle = S().player; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 0.55; ctx.strokeStyle = S().player; ctx.lineWidth = 1; ctx.beginPath();
        if (!ringAt(x, y - 1)) { ctx.moveTo(r.x, r.y + 0.5); ctx.lineTo(r.x + r.w, r.y + 0.5); }
        if (!ringAt(x, y + 1)) { ctx.moveTo(r.x, r.y + r.h - 0.5); ctx.lineTo(r.x + r.w, r.y + r.h - 0.5); }
        if (!ringAt(x - 1, y)) { ctx.moveTo(r.x + 0.5, r.y); ctx.lineTo(r.x + 0.5, r.y + r.h); }
        if (!ringAt(x + 1, y)) { ctx.moveTo(r.x + r.w - 0.5, r.y); ctx.lineTo(r.x + r.w - 0.5, r.y + r.h); }
        ctx.stroke(); ctx.globalAlpha = 1;
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
      add('mark', 'path:' + x + ',' + y, x, y, r, ctx => { ctx.fillStyle = S().player; ctx.fillRect(r.x, r.y, r.w, r.h); });
    }

    // A telegraphed tile: the hazard fill under the actors; its number goes on last.
    const tele = vm.marks.filter(m => m.kind === 'telegraph');
    for (const m of tele) {
      const r = rectOf(m.x, m.y);
      add('mark', 'telegraph:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.globalAlpha = 0.35; ctx.fillStyle = S().hazard; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
        ctx.strokeStyle = S().hazard; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      });
    }

    // Actors, back to front: northern ones first, so a nearer one is drawn over a farther one.
    const placed = order(vm.actors).map(a => ({ a, r: actorRect(a) }));
    for (const { a, r } of placed) {
      add('actor', a.uid, a.x, a.y, r, ctx => {
        const img = Sprites.board(a.sprite, vm.dept);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(r.x + r.w * 0.15, r.y + r.h * 0.84, r.w * 0.7, r.h * 0.12);
        if (img) ctx.drawImage(img, r.x, r.y, r.w, r.h);
        else { ctx.fillStyle = a.hostile ? S().hostile : S().player; ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); }
      });
    }

    // Each actor's marks: the reserved base bar (hostile red, your blue), its state glyph or
    // pips above it, a hit cue, and the selection bracket.
    const hit = new Set((vm.cues && vm.cues.hit) || []);
    for (const { a, r } of placed) {
      const bar = { x: r.x + r.w * 0.2, y: r.y + r.h - 3, w: r.w * 0.6, h: 2 };
      add(a.hostile ? 'mark' : 'own', a.hostile ? 'hostile:' + a.uid : 'you-bar', a.x, a.y, bar, ctx => {
        ctx.fillStyle = a.hostile ? S().hostile : S().player; ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      });
      if (a.hostile) {
        const g = Math.max(8, Math.floor(tile / 3)), y = r.y - g + 2;
        if (a.mode === 'dormant' && a.pips) {
          const q = { x: r.x + r.w / 2 - 1.5 * g, y, w: 3 * g, h: g };
          add('mark', 'state:' + a.uid, a.x, a.y, q, ctx => { for (let i = 0; i < 3; i++) Pictograms.draw(ctx, i < a.pips ? 'pip' : 'pip_empty', q.x + i * g, y, g); });
        } else {
          const id = a.mode === 'dormant' ? 'asleep' : a.mode === 'hunting' ? 'hunting' : a.mode === 'returning' ? 'returning' : 'alert';
          const q = id === 'asleep' ? { x: r.x + r.w - g, y, w: g, h: g } : { x: r.x + r.w / 2 - g / 2, y, w: g, h: g };
          add('mark', 'state:' + a.uid, a.x, a.y, q, ctx => Pictograms.draw(ctx, id, q.x, q.y, g));
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
      if (vm.selection === a.uid) add('mark', 'selection', a.x, a.y, r, ctx => bracket(ctx, r.x, r.y, r.w, r.h));
    }

    if (vm.selectedTile) {
      const r = rectOf(vm.selectedTile.x, vm.selectedTile.y);
      add('mark', 'selection', vm.selectedTile.x, vm.selectedTile.y, r, ctx => bracket(ctx, r.x, r.y, r.w, r.h));
    }

    // Off-screen threats (§7.2): a hostile you can see whose centre is off the board gets a
    // hostile-red arrow at the nearest edge, pointing towards it.
    const k = 10;
    for (const { a, r } of placed) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (!a.hostile || (cx >= 0 && cy >= 0 && cx < width && cy < height)) continue;
      const ex = Math.max(k, Math.min(width - k, cx)), ey = Math.max(k, Math.min(height - k, cy)), ang = Math.atan2(cy - ey, cx - ex);
      add('mark', 'edge:' + a.uid, a.x, a.y, { x: ex - k, y: ey - k, w: 2 * k, h: 2 * k }, ctx => {
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
        ctx.fillStyle = S().hostile; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(-k * 0.7, -k * 0.8); ctx.lineTo(-k * 0.7, k * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      });
    }

    // The telegraph numbers go on last, so no actor covers them.
    for (const m of tele) {
      const t = rectOf(m.x, m.y), fs = Math.floor(Math.min(t.w, t.h) * 0.42), r = { x: t.x + t.w / 2 - fs, y: t.y + t.h / 2 - fs * 0.6, w: 2 * fs, h: 1.2 * fs };
      add('mark', 'telegraph:' + m.x + ',' + m.y, m.x, m.y, r, ctx => {
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
        ctx.font = `bold ${fs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeText(String(m.dmg), t.x + t.w / 2, t.y + t.h / 2); ctx.fillText(String(m.dmg), t.x + t.w / 2, t.y + t.h / 2);
      });
    }
    return out;
  }

  function bracket(ctx, px, py, w, h) {
    ctx.strokeStyle = S().readable; ctx.lineWidth = 2;
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

  return { list, inspected, bracket, order };
})();
