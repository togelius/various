// ACCESSION — the overlays both board views share (BUILD.md §6.2): your ring, the path
// preview, telegraphs, actors with the hostile mark and state glyphs, and the selection.
// Each view supplies rectOf(x, y), a tile's rectangle in canvas CSS pixels, so the same
// marks look the same in top-down and 3D, and in 3D nothing in the scene can hide them.
// Every draw call returns what it drew, for renderer.inspect().
'use strict';
const Marks = (() => {
  const S = () => ART.palettes.semantic;

  // Your ring: a faint fill and an outline round the tiles that count as close.
  function ring(ctx, vm, rectOf, x0, y0, x1, y1) {
    const at = (i, j) => i >= 0 && j >= 0 && i < vm.w && j < vm.h && vm.ring[j * vm.w + i];
    ctx.strokeStyle = S().player; ctx.lineWidth = 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!vm.ring[y * vm.w + x]) continue;
      const r = rectOf(x, y);
      ctx.globalAlpha = 0.08; ctx.fillStyle = S().player; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 0.55; ctx.beginPath();
      if (!at(x, y - 1)) { ctx.moveTo(r.x, r.y + 0.5); ctx.lineTo(r.x + r.w, r.y + 0.5); }
      if (!at(x, y + 1)) { ctx.moveTo(r.x, r.y + r.h - 0.5); ctx.lineTo(r.x + r.w, r.y + r.h - 0.5); }
      if (!at(x - 1, y)) { ctx.moveTo(r.x + 0.5, r.y); ctx.lineTo(r.x + 0.5, r.y + r.h); }
      if (!at(x + 1, y)) { ctx.moveTo(r.x + r.w - 0.5, r.y); ctx.lineTo(r.x + r.w - 0.5, r.y + r.h); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function path(ctx, vm, rectOf) {
    if (!vm.path) return;
    ctx.fillStyle = S().player;
    for (const [x, y] of vm.path) { const r = rectOf(x, y); ctx.fillRect(r.x + r.w / 2 - 2, r.y + r.h / 2 - 2, 4, 4); }
  }

  // A telegraphed tile: the exact damage you would take, in the hazard colour.
  function telegraphs(ctx, vm, rectOf) {
    const out = [];
    for (const m of vm.marks) {
      if (m.kind !== 'telegraph') continue;
      const r = rectOf(m.x, m.y);
      ctx.globalAlpha = 0.35; ctx.fillStyle = S().hazard; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = 1;
      ctx.strokeStyle = S().hazard; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      out.push({ kind: 'mark', id: 'telegraph:' + m.x + ',' + m.y, x: m.x, y: m.y, rect: r, dmg: m.dmg });
    }
    return out;
  }
  // The numbers go on last, so no actor covers them.
  function telegraphNumbers(ctx, drawn) {
    for (const d of drawn) {
      const r = d.rect;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
      ctx.font = `bold ${Math.floor(Math.min(r.w, r.h) * 0.42)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeText(String(d.dmg), r.x + r.w / 2, r.y + r.h / 2); ctx.fillText(String(d.dmg), r.x + r.w / 2, r.y + r.h / 2);
    }
  }

  // An actor in the square (px, py, sz): its shadow and sprite.
  function actor(ctx, a, dept, px, py, sz) {
    const img = Sprites.board(a.sprite, dept);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + sz * 0.15, py + sz * 0.84, sz * 0.7, sz * 0.12);
    if (img) ctx.drawImage(img, px, py, sz, sz);
    else { ctx.fillStyle = a.hostile ? S().hostile : S().player; ctx.fillRect(px + 4, py + 4, sz - 8, sz - 8); }
    return { kind: 'actor', id: a.uid, x: a.x, y: a.y, rect: { x: px, y: py, w: sz, h: sz } };
  }

  // The actor's marks: the reserved base bar (hostile red, your blue), its state glyph or
  // pips above it, and the selection bracket. Drawn after every actor.
  function actorMarks(ctx, vm, a, px, py, sz, tile) {
    const out = [];
    const bar = { x: px + sz * 0.2, y: py + sz - 3, w: sz * 0.6, h: 2 };
    ctx.fillStyle = a.hostile ? S().hostile : S().player; ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
    if (a.hostile) {
      out.push({ kind: 'mark', id: 'hostile:' + a.uid, x: a.x, y: a.y, rect: bar });
      const g = Math.max(8, Math.floor(tile / 3)), y = py - g + 2;
      if (a.mode === 'dormant' && !a.pips) Pictograms.draw(ctx, 'asleep', px + sz - g, y, g);
      else if (a.mode === 'dormant') { for (let i = 0; i < 3; i++) Pictograms.draw(ctx, i < a.pips ? 'pip' : 'pip_empty', px + sz / 2 - 1.5 * g + i * g, y, g); }
      else Pictograms.draw(ctx, a.mode === 'hunting' ? 'hunting' : a.mode === 'returning' ? 'returning' : 'alert', px + sz / 2 - g / 2, y, g);
      out.push({ kind: 'mark', id: 'state:' + a.uid, x: a.x, y: a.y, rect: { x: px, y, w: sz, h: g } });
    }
    if (vm.selection === a.uid) { bracket(ctx, px, py, sz, sz); out.push({ kind: 'mark', id: 'selection', x: a.x, y: a.y, rect: { x: px, y: py, w: sz, h: sz } }); }
    return out;
  }

  function selectedTile(ctx, vm, rectOf) {
    if (!vm.selectedTile) return [];
    const r = rectOf(vm.selectedTile.x, vm.selectedTile.y);
    bracket(ctx, r.x, r.y, r.w, r.h);
    return [{ kind: 'mark', id: 'selection', x: vm.selectedTile.x, y: vm.selectedTile.y, rect: r }];
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

  // Off-screen threats (§7.2): a hostile you can see whose centre is off the board gets a
  // hostile-red arrow at the nearest edge, pointing towards it.
  function edges(ctx, placed, width, height) {
    const out = [], k = 10;
    for (const { a, px, py, sz } of placed) {
      const cx = px + sz / 2, cy = py + sz / 2;
      if (!a.hostile || (cx >= 0 && cy >= 0 && cx < width && cy < height)) continue;
      const ex = Math.max(k, Math.min(width - k, cx)), ey = Math.max(k, Math.min(height - k, cy));
      const ang = Math.atan2(cy - ey, cx - ex);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang);
      ctx.fillStyle = S().hostile; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(-k * 0.7, -k * 0.8); ctx.lineTo(-k * 0.7, k * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      out.push({ kind: 'mark', id: 'edge:' + a.uid, x: a.x, y: a.y, rect: { x: ex - k, y: ey - k, w: 2 * k, h: 2 * k } });
    }
    return out;
  }

  // Back to front: northern actors first, so a nearer one is drawn over a farther one.
  const order = actors => actors.slice().sort((a, b) => (a.y + (a.size || 1)) - (b.y + (b.size || 1)) || a.x - b.x);

  return { ring, path, telegraphs, telegraphNumbers, actor, actorMarks, selectedTile, edges, bracket, order };
})();
