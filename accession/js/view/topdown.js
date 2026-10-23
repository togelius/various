// ACCESSION — TopDownView: the reference board, Canvas 2D (BUILD.md §6.2). It draws the
// view model and answers which tile is under a point; it never reads the state.
'use strict';
Views.register('topdown', 'Flat', host => {
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const ZOOM = [32, 48];
  // Tiles drawn as plain floor on purpose (the tile-art test checks every other tile has a case).
  const PLAIN = ['.', ','];
  let zoom = 0, tile = ZOOM[0], ox = 0, oy = 0, last = null, items = [], tiles = [], size = { width: 0, height: 0 }, inset = 0;

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

  // The camera centres on vm.camera within the part of the board not covered by the
  // bottom inset (the label sheet on a phone).
  function draw(vm) {
    last = vm;
    const r = resize(), P = ART.palettes.dept[vm.dept] || ART.palettes.dept.T0, t = tile;
    size = { width: r.width, height: r.height };
    ctx.fillStyle = '#0d0c10'; ctx.fillRect(0, 0, r.width, r.height);
    ox = Math.floor(r.width / 2 - (vm.camera.x + 0.5) * t);
    oy = Math.floor(Math.max(t, r.height - inset) / 2 - (vm.camera.y + 0.5) * t);
    const x0 = Math.max(0, Math.floor(-ox / t)), y0 = Math.max(0, Math.floor(-oy / t));
    const x1 = Math.min(vm.w - 1, Math.ceil((r.width - ox) / t)), y1 = Math.min(vm.h - 1, Math.ceil((r.height - oy) / t));
    tiles = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = vm.vis[y * vm.w + x];
      if (!v) continue;
      const px = ox + x * t, py = oy + y * t;
      drawTile(vm, P, x, y, px, py);
      tiles.push({ kind: 'tile', id: x + ',' + y, x, y, rect: { x: px, y: py, w: t, h: t } });
      if (v === 1) { ctx.fillStyle = 'rgba(8,7,12,0.58)'; ctx.fillRect(px, py, t, t); }
    }
    const rectOf = (x, y) => ({ x: ox + x * t, y: oy + y * t, w: t, h: t });
    const actorRect = a => ({ x: ox + a.x * t, y: oy + a.y * t, w: t * (a.size || 1), h: t * (a.size || 1) });
    items = Marks.list(vm, rectOf, actorRect, t, r.width, r.height);
    for (const it of items) it.paint(ctx);
  }

  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((cx - r.left - ox) / tile), y = Math.floor((cy - r.top - oy) / tile);
    if (!last || x < 0 || y < 0 || x >= last.w || y >= last.h) return null;
    return { x, y };
  }
  // A tile's centre and rectangle in client CSS pixels, and the radius of the disc round
  // its centre that pick() maps to it.
  function tileRect(x, y) {
    const r = canvas.getBoundingClientRect(), px = r.left + ox + x * tile, py = r.top + oy + y * tile;
    return { centre: { x: px + tile / 2, y: py + tile / 2 }, rect: { x: px, y: py, w: tile, h: tile }, tapRadius: tile / 2 };
  }
  function inspect() {
    const r = canvas.getBoundingClientRect();
    const on = tiles.filter(d => d.rect.x + d.rect.w > 0 && d.rect.y + d.rect.h > 0 && d.rect.x < size.width && d.rect.y < size.height)
      .map(d => ({ kind: d.kind, id: d.id, x: d.x, y: d.y, rect: { x: r.left + d.rect.x, y: r.top + d.rect.y, w: d.rect.w, h: d.rect.h } }));
    return on.concat(Marks.inspected(items, r.left, r.top, size.width, size.height));
  }
  return {
    id: 'topdown', ready: Promise.resolve(), draw, pick, tileRect, inspect, zooms: ZOOM, PLAIN,
    get zoom() { return zoom; },
    setZoom(step) { zoom = Math.max(0, Math.min(ZOOM.length - 1, step)); tile = ZOOM[zoom]; },
    setInset(px) { inset = Math.max(0, px || 0); },
    dispose: () => canvas.remove(),
  };
});
