// ACCESSION — sprite canvases from the palette-indexed grids in art.gen.js, coloured per
// department, and 64×64 label close-ups made by Scale2x twice over (BUILD.md §9.1).
'use strict';
const Sprites = (() => {
  const cache = new Map();
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  function colourOf(ch, pal, dept) {
    if (ch === 'g') return dept.glass;
    return pal[ch];
  }

  function paint(rows, pal, dept) {
    const n = rows.length, c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d'), img = x.createImageData(n, n), d = img.data;
    for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) {
      const ch = rows[y][i];
      if (ch === '.' || ch === ' ') continue;
      const col = colourOf(ch, pal, dept);
      if (!col) continue;
      const [r, g, b] = hex(col), o = (y * n + i) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // Scale2x (EPX): each pixel becomes 2×2, rounding diagonals where neighbours agree.
  function scale2x(rows) {
    const h = rows.length, w = rows[0].length;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : rows[y][x];
    const out = [];
    for (let y = 0; y < h; y++) {
      let a = '', b = '';
      for (let x = 0; x < w; x++) {
        const P = at(x, y), A = at(x, y - 1) ?? P, B = at(x + 1, y) ?? P, C = at(x - 1, y) ?? P, D = at(x, y + 1) ?? P;
        a += (C === A && C !== D && A !== B ? A : P) + (A === B && A !== C && B !== D ? B : P);
        b += (D === C && D !== B && C !== A ? C : P) + (B === D && B !== A && D !== C ? D : P);
      }
      out.push(a, b);
    }
    return out;
  }

  function palettes(name, deptKey) {
    const s = ART.sprites[name], dept = ART.palettes.dept[deptKey] || ART.palettes.dept.T0;
    return { s, dept, pal: s.kind === 'player' ? ART.palettes.player : dept };
  }

  // The board sprite (16×16, or 32×32 for a Centrepiece).
  function board(name, deptKey) {
    const key = 'b/' + name + '/' + deptKey;
    if (!cache.has(key)) {
      if (!ART.sprites[name]) return null;
      const { s, dept, pal } = palettes(name, deptKey);
      cache.set(key, paint(s.rows, pal, dept));
    }
    return cache.get(key);
  }

  // The 64×64 close-up for a label: Scale2x until 64 wide.
  function closeup(name, deptKey) {
    const key = 'c/' + name + '/' + deptKey;
    if (!cache.has(key)) {
      if (!ART.sprites[name]) return null;
      const { s, dept, pal } = palettes(name, deptKey);
      let rows = s.rows;
      while (rows.length < 64) rows = scale2x(rows);
      cache.set(key, paint(rows, pal, dept));
    }
    return cache.get(key);
  }

  return { board, closeup, scale2x };
})();
