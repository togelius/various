// common.js: shared by topdown.html, iso.js and the Node checks.
// Layout parsing, the movement x sight semantics of prototypes/layout/proto.js,
// symmetric shadowcasting FOV, tap-to-move pathing, and the probe scenarios.
(function (root) {
  'use strict';

  // Same sets as proto.js (SEE / WALK), plus the display-only room labels I, K, s,
  // which --show writes over ordinary floor tiles.
  const SEE_CH = '.,:^=bwEXvdfp~lIKs';
  const WALK_CH = '.,+EX:^=bwSIKs';

  function parse(text) {
    const rows = text.split('\n').filter(r => r.length);
    const H = rows.length, W = Math.max(...rows.map(r => r.length));
    const t = rows.map(r => r.padEnd(W, '#'));
    return {
      W, H, rows: t,
      at(x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? '#' : t[y][x]; },
    };
  }
  const seeThrough = (L, x, y) => SEE_CH.includes(L.at(x, y));
  const walkable = (L, x, y) => WALK_CH.includes(L.at(x, y));

  // 'o' is "plinth or column" in proto.js: both block movement and sight.
  // Render it as a column when it is part of a regular row (another 'o' two tiles away),
  // otherwise as a statue on a plinth.
  function oKind(L, x, y) {
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (L.at(x + dx, y + dy) === 'o') return 'column';
    return 'statue';
  }

  // Symmetric shadowcasting (Albert Ford, 2021), unlimited radius, floats.
  function fov(L, ox, oy) {
    const W = L.W, H = L.H, vis = new Uint8Array(W * H);
    const blocks = (x, y) => !seeThrough(L, x, y);
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) vis[y * W + x] = 1; };
    mark(ox, oy);
    for (let q = 0; q < 4; q++) {
      const tr = (row, col) => q === 0 ? [ox + col, oy - row] : q === 1 ? [ox + row, oy + col]
        : q === 2 ? [ox + col, oy + row] : [ox - row, oy + col];
      const scan = (depth, start, end) => {
        if (depth > 80) return;
        let prev = 0; // 0 none, 1 wall, 2 floor
        const minCol = Math.floor(depth * start + 0.5), maxCol = Math.ceil(depth * end - 0.5);
        for (let col = minCol; col <= maxCol; col++) {
          const [x, y] = tr(depth, col);
          const wall = blocks(x, y);
          const sym = col >= depth * start && col <= depth * end;
          if (wall || sym) mark(x, y);
          if (prev === 1 && !wall) start = (2 * col - 1) / (2 * depth);
          if (prev === 2 && wall) scan(depth + 1, start, (2 * col - 1) / (2 * depth));
          prev = wall ? 1 : 2;
        }
        if (prev === 2) scan(depth + 1, start, end);
      };
      scan(1, -1, 1);
    }
    return vis;
  }

  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // Tap-to-move: BFS, 8 directions, no cutting past blocked corners.
  function path(L, from, to) {
    const W = L.W, prev = new Int32Array(L.W * L.H).fill(-1);
    const s = from[1] * W + from[0], t = to[1] * W + to[0];
    const q = [s]; prev[s] = s;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (i === t) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy;
        if (!walkable(L, nx, ny)) continue;
        if (dx && dy && (!walkable(L, x + dx, y) || !walkable(L, x, y + dy))) continue;
        const j = ny * W + nx; if (prev[j] !== -1) continue;
        prev[j] = i; q.push(j);
      }
    }
    if (prev[t] === -1) return null;
    const out = []; for (let i = t; i !== s; i = prev[i]) out.push([i % W, (i / W) | 0]);
    return out.reverse();
  }

  // Probe scenarios. Camera for the isometric view sits to the south-east (+x, +y on the map),
  // so "behind" for the camera means north-west of an occluder.
  const SCEN = {
    sculpture_court_6_1: {
      title: 'Sculpture court, Department size, seed 6',
      player: [25, 11],
      exhibits: [
        { id: 'A', x: 28, y: 11, where: 'vitrine', state: 'asleep', note: 'inside the glass case in the window between court and Centrepiece hall' },
        { id: 'B', x: 25, y: 8, where: 'column', state: 'stirring', note: 'directly behind (north-west of) a colonnade column, in the player\'s line of sight' },
        { id: 'C', x: 22, y: 14, where: 'open', state: 'awake', note: 'in the open court, awake and telegraphing a three-tile lunge at the player' },
        { id: 'D', x: 23, y: 12, where: 'plinth', state: 'asleep', note: 'on a low plinth' },
        { id: 'E', x: 21, y: 18, where: 'wall', state: 'asleep', note: 'in the open, one tile in front of the court\'s south wall' },
      ],
      telegraph: { from: 'C', len: 3, dmg: 6 },
      tap: [22, 9],
    },
    enfilade_3_0: {
      title: 'Enfilade, Cabinet size, seed 3',
      player: [20, 8],
      exhibits: [
        { id: 'A', x: 21, y: 4, where: 'vitrine', state: 'asleep', note: 'inside a vitrine against the gallery\'s north wall' },
        { id: 'B', x: 17, y: 10, where: 'column', state: 'stirring', note: 'directly behind (north-west of) a statue on a plinth, in line of sight' },
        { id: 'C', x: 12, y: 8, where: 'open', state: 'awake', note: 'in the open in the next gallery, seen through the archway, telegraphing a charge' },
        { id: 'D', x: 18, y: 5, where: 'plinth', state: 'asleep', note: 'on a statue plinth' },
        { id: 'E', x: 22, y: 12, where: 'wall', state: 'asleep', note: 'in the open, against the gallery\'s south wall' },
      ],
      telegraph: { from: 'C', len: 4, dmg: 7 },
      tap: [14, 10],
    },
  };

  function bresenham(x0, y0, x1, y1) {
    const out = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) { out.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    return out;
  }

  // Resolve a scenario against its layout: FOV, telegraph tiles, tap path.
  function resolve(L, name) {
    const S = SCEN[name];
    const [px, py] = S.player;
    const vis = fov(L, px, py);
    const ex = S.exhibits.map(e => ({ ...e, visible: !!vis[e.y * L.W + e.x], tile: L.at(e.x, e.y) }));
    const src = ex.find(e => e.id === S.telegraph.from);
    const ln = bresenham(src.x, src.y, px, py).slice(1, 1 + S.telegraph.len).filter(([x, y]) => walkable(L, x, y));
    const tapPath = path(L, S.player, S.tap);
    return { ...S, vis, exhibits: ex, telegraphTiles: ln, tapPath };
  }

  root.ACC = { parse, seeThrough, walkable, oKind, fov, path, bresenham, resolve, SCEN, SEE_CH, WALK_CH };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ACC;
})(typeof window !== 'undefined' ? window : globalThis);
