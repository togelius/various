// ACCESSION — TopDownView: the reference board, Canvas 2D (BUILD.md §6.2). It draws the
// view model and answers which tile is under a point; it never reads the state.
'use strict';
Views.register('topdown', host => {
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const ZOOM = [32, 44];
  let zoom = 0, tile = ZOOM[0], ox = 0, oy = 0, last = null;

  function resize() {
    const r = host.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return r;
  }

  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  };

  function drawTile(vm, P, x, y, px, py) {
    const ch = vm.tiles[y][x], t = tile, below = y + 1 < vm.h ? vm.tiles[y + 1][x] : '#';
    const floor = ((x + y) & 1) ? P.floor2 : P.floor;
    const isWall = ch === '#';
    if (isWall) {
      ctx.fillStyle = P.wallTop; ctx.fillRect(px, py, t, t);
      if (below !== '#') { ctx.fillStyle = P.wall; ctx.fillRect(px, py + t * 0.45, t, t * 0.55); ctx.fillStyle = shade(P.wall, 0.75); ctx.fillRect(px, py + t - 2, t, 2); }
      return;
    }
    ctx.fillStyle = floor; ctx.fillRect(px, py, t, t);
    const u = t / 16;
    switch (ch) {
      case 'v': case 'k':
        ctx.fillStyle = shade(P.floor, 0.7); ctx.fillRect(px + u, py + 3 * u, t - 2 * u, t - 3 * u);
        if (ch === 'v') {
          ctx.fillStyle = P.glass; ctx.globalAlpha = 0.55; ctx.fillRect(px + u, py + u, t - 2 * u, t - 4 * u); ctx.globalAlpha = 1;
          ctx.strokeStyle = shade(P.glass, 1.15); ctx.lineWidth = 1; ctx.strokeRect(px + u + 0.5, py + u + 0.5, t - 2 * u - 1, t - 4 * u - 1);
          ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.6; ctx.fillRect(px + 3 * u, py + 3 * u, u, 4 * u); ctx.globalAlpha = 1;
        } else { ctx.fillStyle = P.glass; for (let i = 0; i < 5; i++) ctx.fillRect(px + ((x * 7 + i * 5) % 12 + 2) * u, py + ((y * 5 + i * 3) % 10 + 4) * u, u, u); }
        break;
      case 'x':
        ctx.fillStyle = P.glass; for (let i = 0; i < 6; i++) ctx.fillRect(px + ((x * 7 + i * 5) % 13 + 1) * u, py + ((y * 5 + i * 7) % 13 + 1) * u, u, u);
        break;
      case 'p': case 'C':
        ctx.fillStyle = shade(P['3'] || '#999999', 0.9); ctx.fillRect(px + 2 * u, py + 4 * u, t - 4 * u, t - 5 * u);
        ctx.fillStyle = shade(P['3'] || '#999999', 1.15); ctx.fillRect(px + 2 * u, py + 2 * u, t - 4 * u, 3 * u);
        break;
      case 'o':
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + 3 * u, py + 12 * u, 11 * u, 3 * u);
        ctx.fillStyle = shade(P.wall, 0.95); ctx.fillRect(px + 4 * u, py + 2 * u, 8 * u, 12 * u);
        ctx.fillStyle = P.wallTop; ctx.fillRect(px + 3 * u, py + u, 10 * u, 2 * u);
        ctx.fillStyle = shade(P.wallTop, 1.15); ctx.fillRect(px + 5 * u, py + 3 * u, 2 * u, 10 * u);
        break;
      case 'b':
        ctx.fillStyle = '#6b4a2e'; ctx.fillRect(px + u, py + 6 * u, t - 2 * u, 4 * u);
        ctx.fillStyle = '#8a6440'; ctx.fillRect(px + u, py + 6 * u, t - 2 * u, u);
        ctx.fillStyle = '#4a321f'; ctx.fillRect(px + 2 * u, py + 10 * u, u, 3 * u); ctx.fillRect(px + 13 * u, py + 10 * u, u, 3 * u);
        break;
      case 'l':
        ctx.fillStyle = '#5a3e26'; ctx.fillRect(px + 6 * u, py + 8 * u, 4 * u, 7 * u);
        ctx.fillStyle = '#8a6440'; ctx.fillRect(px + 3 * u, py + 4 * u, 10 * u, 5 * u);
        ctx.fillStyle = ART.palettes.semantic.readable; ctx.fillRect(px + 4 * u, py + 5 * u, 8 * u, 2 * u);
        break;
      case 'f': case 'H': case '|': case 'c':
        ctx.fillStyle = ch === 'H' ? '#4b4038' : ch === '|' ? shade(P.wall, 0.9) : '#6b4a2e';
        ctx.fillRect(px + u, py + u, t - 2 * u, t - 2 * u);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(px + u, py + u, t - 2 * u, 2 * u);
        break;
      case '~': case 'w':
        ctx.fillStyle = '#2b4f66'; ctx.fillRect(px, py, t, t);
        ctx.fillStyle = '#3d6c88'; ctx.fillRect(px + ((x * 3) % 8) * u, py + 5 * u, 5 * u, u); ctx.fillRect(px + ((x * 5 + 4) % 9) * u, py + 11 * u, 4 * u, u);
        break;
      case '+': case 'S':
        ctx.fillStyle = P.wallTop; ctx.fillRect(px, py, t, t);
        ctx.fillStyle = ch === 'S' ? '#5c5560' : '#7a5232'; ctx.fillRect(px + 2 * u, py + 3 * u, t - 4 * u, t - 3 * u);
        ctx.fillStyle = ART.palettes.semantic.readable; ctx.fillRect(px + 10 * u, py + 9 * u, u, u);
        break;
      case "'":
        ctx.fillStyle = shade(floor, 0.8); ctx.fillRect(px, py, t, t);
        ctx.fillStyle = '#7a5232'; ctx.fillRect(px, py, 2 * u, t);
        break;
      case '=':
        ctx.fillStyle = '#9a2a3a'; ctx.fillRect(px, py + 7 * u, t, u * 1.5);
        break;
      case 'E': case 'X':
        ctx.fillStyle = ART.palettes.semantic.readable; ctx.globalAlpha = 0.35;
        ctx.fillRect(px + 5 * u, py + 5 * u, 6 * u, 6 * u); ctx.globalAlpha = 1;
        break;
    }
  }

  function draw(vm) {
    last = vm;
    const r = resize(), P = ART.palettes.dept[vm.dept] || ART.palettes.dept.T0, t = tile;
    ctx.fillStyle = '#0d0c10'; ctx.fillRect(0, 0, r.width, r.height);
    ox = Math.floor(r.width / 2 - (vm.camera.x + 0.5) * t);
    oy = Math.floor(r.height / 2 - (vm.camera.y + 0.5) * t);
    const x0 = Math.max(0, Math.floor(-ox / t)), y0 = Math.max(0, Math.floor(-oy / t));
    const x1 = Math.min(vm.w - 1, Math.ceil((r.width - ox) / t)), y1 = Math.min(vm.h - 1, Math.ceil((r.height - oy) / t));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = vm.vis[y * vm.w + x];
      if (!v) continue;
      const px = ox + x * t, py = oy + y * t;
      drawTile(vm, P, x, y, px, py);
      if (v === 1) { ctx.fillStyle = 'rgba(8,7,12,0.58)'; ctx.fillRect(px, py, t, t); }
    }
    // Your ring: the tiles that count as close.
    ctx.strokeStyle = ART.palettes.semantic.player; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!vm.ring[y * vm.w + x]) continue;
      const px = ox + x * t, py = oy + y * t, at = (i, j) => i >= 0 && j >= 0 && i < vm.w && j < vm.h && vm.ring[j * vm.w + i];
      ctx.beginPath();
      if (!at(x, y - 1)) { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + t, py + 0.5); }
      if (!at(x, y + 1)) { ctx.moveTo(px, py + t - 0.5); ctx.lineTo(px + t, py + t - 0.5); }
      if (!at(x - 1, y)) { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + t); }
      if (!at(x + 1, y)) { ctx.moveTo(px + t - 0.5, py); ctx.lineTo(px + t - 0.5, py + t); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(90,167,232,0.07)'; ctx.fillRect(px, py, t, t);
    }
    ctx.globalAlpha = 1;
    // Path preview.
    if (vm.path) { ctx.fillStyle = ART.palettes.semantic.player; for (const [x, y] of vm.path) ctx.fillRect(ox + x * t + t / 2 - 2, oy + y * t + t / 2 - 2, 4, 4); }
    // Telegraphs: the exact damage you would take, in the hazard colour.
    for (const m of vm.marks) {
      if (m.kind !== 'telegraph') continue;
      const px = ox + m.x * t, py = oy + m.y * t;
      ctx.fillStyle = 'rgba(240,138,44,0.35)'; ctx.fillRect(px, py, t, t);
      ctx.strokeStyle = ART.palettes.semantic.hazard; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, t - 2, t - 2);
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.floor(t * 0.42)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(m.dmg), px + t / 2, py + t / 2);
    }
    // Actors.
    for (const a of vm.actors) {
      const n = a.size || 1, px = ox + a.x * t, py = oy + a.y * t, sz = t * n;
      const img = Sprites.board(a.sprite, vm.dept);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + sz * 0.15, py + sz * 0.84, sz * 0.7, sz * 0.12);
      if (img) ctx.drawImage(img, px, py, sz, sz);
      else { ctx.fillStyle = a.hostile ? '#d8484e' : '#5aa7e8'; ctx.fillRect(px + 4, py + 4, sz - 8, sz - 8); }
      // The reserved mark: a hostile base bar, your blue one.
      ctx.fillStyle = a.hostile ? ART.palettes.semantic.hostile : ART.palettes.semantic.player;
      ctx.fillRect(px + sz * 0.2, py + sz - 3, sz * 0.6, 2);
      if (a.hostile) stateGlyph(a, px, py, sz);
      if (vm.selection === a.uid) bracket(px, py, sz);
    }
    if (vm.selectedTile) bracket(ox + vm.selectedTile.x * t, oy + vm.selectedTile.y * t, t);
  }

  function stateGlyph(a, px, py, sz) {
    const g = Math.max(8, Math.floor(tile / 3)), y = py - g + 2;
    if (a.mode === 'dormant' && !a.pips) Pictograms.draw(ctx, 'asleep', px + sz - g, y, g);
    else if (a.mode === 'dormant') { for (let i = 0; i < 3; i++) Pictograms.draw(ctx, i < a.pips ? 'pip' : 'pip_empty', px + sz / 2 - 1.5 * g + i * g, y, g); }
    else if (a.mode === 'hunting') Pictograms.draw(ctx, 'hunting', px + sz / 2 - g / 2, y, g);
    else if (a.mode === 'returning') Pictograms.draw(ctx, 'returning', px + sz / 2 - g / 2, y, g);
    else Pictograms.draw(ctx, 'alert', px + sz / 2 - g / 2, y, g);
  }

  function bracket(px, py, s) {
    ctx.strokeStyle = ART.palettes.semantic.readable; ctx.lineWidth = 2;
    const k = Math.floor(s / 4);
    ctx.beginPath();
    ctx.moveTo(px + 1, py + k); ctx.lineTo(px + 1, py + 1); ctx.lineTo(px + k, py + 1);
    ctx.moveTo(px + s - k, py + 1); ctx.lineTo(px + s - 1, py + 1); ctx.lineTo(px + s - 1, py + k);
    ctx.moveTo(px + 1, py + s - k); ctx.lineTo(px + 1, py + s - 1); ctx.lineTo(px + k, py + s - 1);
    ctx.moveTo(px + s - k, py + s - 1); ctx.lineTo(px + s - 1, py + s - 1); ctx.lineTo(px + s - 1, py + s - k);
    ctx.stroke();
  }

  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((cx - r.left - ox) / tile), y = Math.floor((cy - r.top - oy) / tile);
    if (!last || x < 0 || y < 0 || x >= last.w || y >= last.h) return null;
    return { x, y };
  }
  function tileRect(x, y) {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ox + x * tile, y: r.top + oy + y * tile, w: tile, h: tile };
  }
  return {
    id: 'topdown', draw, pick, tileRect, zooms: ZOOM,
    setZoom(step) { zoom = Math.max(0, Math.min(ZOOM.length - 1, step)); tile = ZOOM[zoom]; },
    zoomStep: () => zoom,
    dispose: () => canvas.remove(),
  };
});
