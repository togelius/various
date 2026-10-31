// SQUARE OFF — navigation grid, flow fields, A*, line of sight (DESIGN §7.4).
// Headless. SQ.nav.build(GEO) rasterises the real OSM geometry into a 1 m grid.
(function (SQ) {
  'use strict';

  const T = { PATH: 0, LAWN: 1, BED: 2, WATER: 3, ROAD: 4, BLOCKED: 5, FENCE: 6 };
  const T_NAMES = ['path', 'lawn', 'bed', 'water', 'road', 'blocked', 'fence'];
  const T_COST = [10, 13, 30, 18, 12, 255, 255];
  const T_SPEED = [1.0, 0.85, 0.7, 0.6, 1.0, 0, 0];
  const BOUNDS = { x0: -200, x1: 170, z0: -110, z1: 130 };
  const SQRT2 = Math.SQRT2;
  const fr = Math.fround;

  // ---------------------------------------------------------------- heap
  function Heap(cap) {
    this.k = new Float64Array(cap);
    this.v = new Int32Array(cap);
    this.n = 0;
  }
  Heap.prototype.push = function (key, val) {
    if (this.n >= this.k.length) {
      const k2 = new Float64Array(this.k.length * 2); k2.set(this.k); this.k = k2;
      const v2 = new Int32Array(this.v.length * 2); v2.set(this.v); this.v = v2;
    }
    const k = this.k, v = this.v;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v;
    const top = v[0];
    this.topKey = k[0];
    const n = --this.n;
    if (n > 0) {
      const key = k[n], val = v[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= key) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = key; v[i] = val;
    }
    return top;
  };

  // ---------------------------------------------------------------- grid
  function Grid(bounds) {
    this.x0 = bounds.x0; this.z0 = bounds.z0;
    this.w = Math.round(bounds.x1 - bounds.x0);
    this.h = Math.round(bounds.z1 - bounds.z0);
    this.size = this.w * this.h;
    this.terrain = new Uint8Array(this.size);       // T.*
    this.cost = new Uint8Array(this.size);          // 10..255
    this.park = new Uint8Array(this.size);          // 1 inside the park polygon
    this.shelter = new Uint8Array(this.size);       // 1 within 4 m of a tree trunk
    this.fields = Object.create(null);              // key -> Float32Array distance field
    this.adhoc = [];                                // LRU [{key, field}]
    this.heap = new Heap(1 << 16);
    this.gates = [];                                // detected + override gates [{x,z,w,name}]
    this.exitField = null;
  }

  Grid.prototype.cx = function (x) { return Math.floor(x - this.x0); };
  Grid.prototype.cz = function (z) { return Math.floor(z - this.z0); };
  Grid.prototype.idx = function (x, z) {
    const i = Math.floor(x - this.x0), j = Math.floor(z - this.z0);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  };
  Grid.prototype.centerX = function (c) { return this.x0 + (c % this.w) + 0.5; };
  Grid.prototype.centerZ = function (c) { return this.z0 + Math.floor(c / this.w) + 0.5; };
  Grid.prototype.inBounds = function (x, z) { return this.idx(x, z) >= 0; };

  /** Terrain type name at a point: 'path'|'lawn'|'bed'|'water'|'road'|'blocked'|'fence' ('blocked' off-grid). */
  Grid.prototype.sample = function (x, z) {
    const c = this.idx(x, z);
    return c < 0 ? 'blocked' : T_NAMES[this.terrain[c]];
  };
  Grid.prototype.terrainAt = function (x, z) {
    const c = this.idx(x, z);
    return c < 0 ? T.BLOCKED : this.terrain[c];
  };
  Grid.prototype.walkable = function (x, z) {
    const c = this.idx(x, z);
    return c >= 0 && this.cost[c] < 255;
  };
  Grid.prototype.walkableCell = function (c) { return c >= 0 && this.cost[c] < 255; };
  Grid.prototype.speedAt = function (x, z, noLawnPenalty) {
    const t = this.terrainAt(x, z);
    if (noLawnPenalty && (t === T.LAWN || t === T.BED)) return 1;
    return T_SPEED[t] || 1;
  };
  Grid.prototype.inPark = function (x, z) {
    const c = this.idx(x, z);
    return c >= 0 && this.park[c] === 1;
  };
  Grid.prototype.sheltered = function (x, z) {
    const c = this.idx(x, z);
    return c >= 0 && this.shelter[c] === 1;
  };

  /** Nearest walkable point (cell center) within maxR meters, or null. Deterministic ring search. */
  Grid.prototype.nearestWalkable = function (x, z, maxR) {
    maxR = maxR || 30;
    const ci = Math.floor(x - this.x0), cj = Math.floor(z - this.z0);
    const c0 = this.idx(x, z);
    if (c0 >= 0 && this.cost[c0] < 255) return { x: x, z: z, c: c0 };
    let best = -1, bestD = Infinity;
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          const c = j * this.w + i;
          if (this.cost[c] >= 255) continue;
          const px = this.x0 + i + 0.5, pz = this.z0 + j + 0.5;
          const d = (px - x) * (px - x) + (pz - z) * (pz - z);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best >= 0 && Math.sqrt(bestD) <= r) break;
    }
    if (best < 0) return null;
    return { x: this.centerX(best), z: this.centerZ(best), c: best };
  };

  /** Grid line of sight: true when no blocked cell lies on the segment (supercover walk). */
  Grid.prototype.los = function (ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return this.walkable(ax, az);
    const steps = Math.ceil(len / 0.4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const c = this.idx(ax + dx * t, az + dz * t);
      if (c < 0 || this.cost[c] >= 255) return false;
    }
    return true;
  };

  // ------------------------------------------------------------- dijkstra
  /** Multi-source Dijkstra. sources: array of cell indices. Returns Float32Array of distances (m-ish). */
  Grid.prototype.dijkstra = function (sources) {
    const w = this.w, h = this.h, cost = this.cost;
    const dist = new Float32Array(this.size).fill(Infinity);
    const heap = this.heap;
    heap.n = 0;
    for (const s of sources) {
      if (s < 0 || cost[s] >= 255) continue;
      if (dist[s] === 0) continue;
      dist[s] = 0;
      heap.push(0, s);
    }
    while (heap.n > 0) {
      const c = heap.pop();
      const d = heap.topKey;
      if (d > dist[c]) continue;
      const i = c % w, j = (c - i) / w;
      // orthogonal
      const nE = i + 1 < w ? c + 1 : -1, nW = i > 0 ? c - 1 : -1;
      const nS = j + 1 < h ? c + w : -1, nN = j > 0 ? c - w : -1;
      const oE = nE >= 0 && cost[nE] < 255, oW = nW >= 0 && cost[nW] < 255;
      const oS = nS >= 0 && cost[nS] < 255, oN = nN >= 0 && cost[nN] < 255;
      // edge cost uses the destination cell's cost (dist from target outward; symmetric enough)
      const base = cost[c] * 0.1;
      if (oE) { const nd = fr(d + (cost[nE] * 0.1 + base) * 0.5); if (nd < dist[nE]) { dist[nE] = nd; heap.push(nd, nE); } }
      if (oW) { const nd = fr(d + (cost[nW] * 0.1 + base) * 0.5); if (nd < dist[nW]) { dist[nW] = nd; heap.push(nd, nW); } }
      if (oS) { const nd = fr(d + (cost[nS] * 0.1 + base) * 0.5); if (nd < dist[nS]) { dist[nS] = nd; heap.push(nd, nS); } }
      if (oN) { const nd = fr(d + (cost[nN] * 0.1 + base) * 0.5); if (nd < dist[nN]) { dist[nN] = nd; heap.push(nd, nN); } }
      // diagonals (no corner cutting)
      if (oE && oS) { const n = c + 1 + w; if (cost[n] < 255) { const nd = fr(d + (cost[n] * 0.1 + base) * 0.5 * SQRT2); if (nd < dist[n]) { dist[n] = nd; heap.push(nd, n); } } }
      if (oE && oN) { const n = c + 1 - w; if (cost[n] < 255) { const nd = fr(d + (cost[n] * 0.1 + base) * 0.5 * SQRT2); if (nd < dist[n]) { dist[n] = nd; heap.push(nd, n); } } }
      if (oW && oS) { const n = c - 1 + w; if (cost[n] < 255) { const nd = fr(d + (cost[n] * 0.1 + base) * 0.5 * SQRT2); if (nd < dist[n]) { dist[n] = nd; heap.push(nd, n); } } }
      if (oW && oN) { const n = c - 1 - w; if (cost[n] < 255) { const nd = fr(d + (cost[n] * 0.1 + base) * 0.5 * SQRT2); if (nd < dist[n]) { dist[n] = nd; heap.push(nd, n); } } }
    }
    return dist;
  };

  /** Register (or fetch) a named flow field toward point (x,z). */
  Grid.prototype.registerField = function (key, x, z) {
    if (this.fields[key]) return this.fields[key];
    const p = this.nearestWalkable(x, z, 40);
    const f = this.dijkstra(p ? [p.c] : []);
    f.key = key; f.tx = p ? p.x : x; f.tz = p ? p.z : z;
    this.fields[key] = f;
    return f;
  };

  /** Named field previously registered (landmarks and Home Spots are registered by the match). */
  Grid.prototype.flowTo = function (key) { return this.fields[key] || null; };

  /** Ad-hoc field toward any ground point. Quantised to 2 m and cached (LRU of 24). */
  Grid.prototype.fieldTo = function (x, z) {
    const qx = Math.round(x / 2) * 2, qz = Math.round(z / 2) * 2;
    const key = qx + ',' + qz;
    for (let i = 0; i < this.adhoc.length; i++) {
      if (this.adhoc[i].key === key) {
        const e = this.adhoc[i];
        if (i > 0) { this.adhoc.splice(i, 1); this.adhoc.unshift(e); }
        return e.field;
      }
    }
    const p = this.nearestWalkable(x, z, 40);
    const f = this.dijkstra(p ? [p.c] : []);
    f.key = 'pt:' + key; f.tx = p ? p.x : x; f.tz = p ? p.z : z;
    this.adhoc.unshift({ key: key, field: f });
    if (this.adhoc.length > 24) this.adhoc.pop();
    return f;
  };

  /** Distance along field from (x,z) to its target; Infinity if unreachable. */
  Grid.prototype.distance = function (field, x, z) {
    const c = this.idx(x, z);
    return c < 0 ? Infinity : field[c];
  };

  /**
   * Follow a field downhill up to `look` cells; returns the look-ahead point {x,z} or null at the goal.
   * No corner cutting. Used by movement steering.
   */
  Grid.prototype.step = function (field, x, z, look, out) {
    look = look || 4;
    const w = this.w, h = this.h, cost = this.cost;
    let c = this.idx(x, z);
    if (c < 0) return null;
    if (!(field[c] < Infinity)) {
      const p = this.nearestWalkable(x, z, 6);
      if (!p) return null;
      out = out || {}; out.x = p.x; out.z = p.z; return out;
    }
    const start = c;
    for (let s = 0; s < look; s++) {
      const i = c % w, j = (c - i) / w;
      let best = c, bd = field[c];
      const oE = i + 1 < w && cost[c + 1] < 255, oW = i > 0 && cost[c - 1] < 255;
      const oS = j + 1 < h && cost[c + w] < 255, oN = j > 0 && cost[c - w] < 255;
      if (oE && field[c + 1] < bd) { bd = field[c + 1]; best = c + 1; }
      if (oW && field[c - 1] < bd) { bd = field[c - 1]; best = c - 1; }
      if (oS && field[c + w] < bd) { bd = field[c + w]; best = c + w; }
      if (oN && field[c - w] < bd) { bd = field[c - w]; best = c - w; }
      if (oE && oS && field[c + 1 + w] < bd) { bd = field[c + 1 + w]; best = c + 1 + w; }
      if (oE && oN && field[c + 1 - w] < bd) { bd = field[c + 1 - w]; best = c + 1 - w; }
      if (oW && oS && field[c - 1 + w] < bd) { bd = field[c - 1 + w]; best = c - 1 + w; }
      if (oW && oN && field[c - 1 - w] < bd) { bd = field[c - 1 - w]; best = c - 1 - w; }
      if (best === c) break;
      c = best;
    }
    if (c === start) return null;
    out = out || {};
    out.x = this.centerX(c); out.z = this.centerZ(c);
    return out;
  };

  /** A* on the 1 m grid; returns smoothed waypoints [[x,z],...] (start excluded) or null. */
  Grid.prototype.astar = function (ax, az, bx, bz) {
    const s = this.nearestWalkable(ax, az, 10), g = this.nearestWalkable(bx, bz, 30);
    if (!s || !g) return null;
    const w = this.w, h = this.h, cost = this.cost;
    const gs = this._g || (this._g = new Float64Array(this.size));
    const from = this._from || (this._from = new Int32Array(this.size));
    gs.fill(Infinity);
    const heap = new Heap(4096);
    const gx = g.c % w, gz = Math.floor(g.c / w);
    const hfn = (c) => {
      const dx = Math.abs((c % w) - gx), dz = Math.abs(Math.floor(c / w) - gz);
      return (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz));
    };
    gs[s.c] = 0; from[s.c] = -1;
    heap.push(hfn(s.c), s.c);
    let found = false, iter = 0;
    const dirs = [1, -1, w, -w, 1 + w, 1 - w, -1 + w, -1 - w];
    while (heap.n > 0 && iter++ < 200000) {
      const c = heap.pop();
      if (c === g.c) { found = true; break; }
      const i = c % w, j = (c - i) / w;
      const gc = gs[c];
      for (let d = 0; d < 8; d++) {
        const di = d === 0 || d === 4 || d === 5 ? 1 : d === 1 || d === 6 || d === 7 ? -1 : 0;
        const dj = d === 2 || d === 4 || d === 6 ? 1 : d === 3 || d === 5 || d === 7 ? -1 : 0;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const n = c + dirs[d];
        if (cost[n] >= 255) continue;
        if (di && dj && (cost[c + di] >= 255 || cost[c + dj * w] >= 255)) continue;
        const ng = gc + cost[n] * 0.1 * (di && dj ? SQRT2 : 1);
        if (ng < gs[n]) { gs[n] = ng; from[n] = c; heap.push(ng + hfn(n), n); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = g.c; c !== -1; c = from[c]) cells.push(c);
    cells.reverse();
    // string-pull smoothing via LOS
    const pts = [];
    let ax0 = this.centerX(cells[0]), az0 = this.centerZ(cells[0]);
    let k = 0;
    while (k < cells.length - 1) {
      let far = k + 1;
      for (let m = cells.length - 1; m > k + 1; m--) {
        if (this.los(ax0, az0, this.centerX(cells[m]), this.centerZ(cells[m]))) { far = m; break; }
      }
      ax0 = this.centerX(cells[far]); az0 = this.centerZ(cells[far]);
      pts.push([ax0, az0]);
      k = far;
    }
    return pts;
  };

  // ------------------------------------------------------------ painting
  function bbox(pts) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    return { x0, x1, z0, z1 };
  }

  function fillPoly(grid, pts, fn) {
    const b = bbox(pts);
    const i0 = Math.max(0, Math.floor(b.x0 - grid.x0)), i1 = Math.min(grid.w - 1, Math.floor(b.x1 - grid.x0));
    const j0 = Math.max(0, Math.floor(b.z0 - grid.z0)), j1 = Math.min(grid.h - 1, Math.floor(b.z1 - grid.z0));
    const pip = SQ.util.pointInPoly;
    for (let j = j0; j <= j1; j++) {
      const z = grid.z0 + j + 0.5;
      for (let i = i0; i <= i1; i++) {
        const x = grid.x0 + i + 0.5;
        if (pip(x, z, pts)) fn(j * grid.w + i);
      }
    }
  }

  // Mark every cell within `half` meters of the segment.
  function strokeSeg(grid, ax, az, bx, bz, half, fn) {
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - half - grid.x0)), i1 = Math.min(grid.w - 1, Math.floor(Math.max(ax, bx) + half - grid.x0));
    const j0 = Math.max(0, Math.floor(Math.min(az, bz) - half - grid.z0)), j1 = Math.min(grid.h - 1, Math.floor(Math.max(az, bz) + half - grid.z0));
    const h2 = half * half;
    for (let j = j0; j <= j1; j++) {
      const z = grid.z0 + j + 0.5;
      for (let i = i0; i <= i1; i++) {
        const x = grid.x0 + i + 0.5;
        if (SQ.util.segDist2(x, z, ax, az, bx, bz) <= h2) fn(j * grid.w + i);
      }
    }
  }

  // Supercover rasterisation: every cell the segment touches (watertight walls).
  function coverSeg(grid, ax, az, bx, bz, fn) {
    const dx = bx - ax, dz = bz - az;
    const len = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.ceil(len / 0.25));
    let last = -2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = ax + dx * t, z = az + dz * t;
      const c = grid.idx(x, z);
      if (c >= 0 && c !== last) {
        fn(c);
        // close diagonal leaks: when we moved diagonally, also mark one side cell
        if (last >= 0) {
          const li = last % grid.w, lj = (last - li) / grid.w, ci = c % grid.w, cj = (c - ci) / grid.w;
          if (li !== ci && lj !== cj) fn(lj * grid.w + ci);
        }
        last = c;
      }
    }
  }

  function strokePath(grid, pts, half, fn) {
    for (let k = 0; k + 1 < pts.length; k++) strokeSeg(grid, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], half, fn);
  }

  function nearestOnSegs(px, pz, segsPts, closed) {
    let best = Infinity, bx = 0, bz = 0;
    const n = segsPts.length;
    const m = closed ? n : n - 1;
    for (let k = 0; k < m; k++) {
      const a = segsPts[k], b = segsPts[(k + 1) % n];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L = dx * dx + dz * dz;
      let t = L > 0 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / L : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = a[0] + t * dx, qz = a[1] + t * dz;
      const d = (qx - px) * (qx - px) + (qz - pz) * (qz - pz);
      if (d < best) { best = d; bx = qx; bz = qz; }
    }
    return { d: Math.sqrt(best), x: bx, z: bz };
  }

  function ignored(b, rules) {
    for (const r of rules) {
      if (r.kind !== b.kind) continue;
      if (r.x === undefined) return true;
      const bb = bbox(b.pts);
      const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2;
      if (Math.hypot(cx - r.x, cz - r.z) <= (r.tol || 3)) return true;
    }
    return false;
  }

  /** Build the nav grid from GEO (+ SQ.data.navOverrides). Pure; cached per GEO object by SQ.nav.get. */
  function build(GEO, overrides) {
    overrides = overrides || (SQ.data && SQ.data.navOverrides) || {};
    const grid = new Grid(BOUNDS);
    const ter = grid.terrain;
    const set = (t) => (c) => { ter[c] = t; };

    // 1. base: sidewalk / plaza
    ter.fill(T.PATH);
    // 2. roads
    for (const r of GEO.roads || []) {
      const half = Math.max(3, (r.lanes || 2) * 1.6 + 0.5);
      strokePath(grid, r.pts, half, set(T.ROAD));
    }
    // 3. park polygon + areas
    const park = (GEO.areas || []).find((a) => a.kind === 'park' && a.name === 'Washington Square Park');
    if (park) fillPoly(grid, park.pts, (c) => { grid.park[c] = 1; });
    const lawnKinds = { grass: 1, garden: 1, sand: 1, pitch: 1 };
    const bedKinds = { flowerbed: 1, shrubbery: 1 };
    const pathKinds = { dog_park: 1, playground: 1, theatre: 1 };
    for (const a of GEO.areas || []) {
      if (lawnKinds[a.kind]) fillPoly(grid, a.pts, set(T.LAWN));
    }
    for (const a of GEO.areas || []) {
      if (pathKinds[a.kind]) fillPoly(grid, a.pts, set(T.PATH));
    }
    for (const a of GEO.areas || []) {
      if (bedKinds[a.kind]) fillPoly(grid, a.pts, set(T.BED));
    }
    // 4. footpaths over lawns
    for (const p of GEO.paths || []) {
      if (p.area) { fillPoly(grid, p.pts, set(T.PATH)); continue; }
      const width = p.kind === 'pedestrian' ? 5 : p.kind === 'service' ? 4 : 3;
      strokePath(grid, p.pts, width / 2, set(T.PATH));
    }
    // fountain basin (wadeable water) painted after paths
    for (const a of GEO.areas || []) {
      if (a.kind === 'water') fillPoly(grid, a.pts, set(T.WATER));
    }
    // 5. buildings
    for (const b of GEO.buildings || []) {
      fillPoly(grid, b.pts, set(T.BLOCKED));
      for (let k = 0; k < b.pts.length; k++) {
        const a = b.pts[k], c = b.pts[(k + 1) % b.pts.length];
        coverSeg(grid, a[0], a[1], c[0], c[1], set(T.BLOCKED));
      }
    }
    // 6. barriers (fences, walls, hedges) with gap closing
    const rules = overrides.ignoreBarriers || [];
    const bars = (GEO.barriers || []).filter((b) => !ignored(b, rules));
    for (const b of bars) {
      for (let k = 0; k + 1 < b.pts.length; k++) {
        const a = b.pts[k], c = b.pts[k + 1];
        coverSeg(grid, a[0], a[1], c[0], c[1], (cell) => { if (ter[cell] !== T.BLOCKED) ter[cell] = T.FENCE; });
      }
    }
    const minGate = overrides.minGate || 1.2;
    const buildingsNear = (GEO.buildings || []);
    for (let bi = 0; bi < bars.length; bi++) {
      const b = bars[bi];
      const ends = [b.pts[0], b.pts[b.pts.length - 1]];
      for (let e = 0; e < 2; e++) {
        const p = ends[e];
        let best = { d: Infinity };
        for (let bj = 0; bj < bars.length; bj++) {
          const o = bars[bj];
          if (bj === bi) {
            // own other end only (closing loops)
            const q = ends[1 - e];
            const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
            if (d > 0.01 && d < best.d) best = { d, x: q[0], z: q[1], gate: true };
            continue;
          }
          const r = nearestOnSegs(p[0], p[1], o.pts, false);
          const isEnd = Math.hypot(r.x - o.pts[0][0], r.z - o.pts[0][1]) < 0.05 || Math.hypot(r.x - o.pts[o.pts.length - 1][0], r.z - o.pts[o.pts.length - 1][1]) < 0.05;
          if (r.d < best.d) best = { d: r.d, x: r.x, z: r.z, gate: isEnd };
        }
        for (const bd of buildingsNear) {
          const bb = bd._bb || (bd._bb = bbox(bd.pts));
          if (p[0] < bb.x0 - 3 || p[0] > bb.x1 + 3 || p[1] < bb.z0 - 3 || p[1] > bb.z1 + 3) continue;
          const r = nearestOnSegs(p[0], p[1], bd.pts, true);
          if (r.d < best.d) best = { d: r.d, x: r.x, z: r.z, gate: false };
        }
        if (best.d < minGate) {
          coverSeg(grid, p[0], p[1], best.x, best.z, (cell) => { if (ter[cell] !== T.BLOCKED) ter[cell] = T.FENCE; });
        } else if (best.d < 6 && best.gate) {
          const gx = (p[0] + best.x) / 2, gz = (p[1] + best.z) / 2;
          if (!grid.gates.some((g) => Math.hypot(g.x - gx, g.z - gz) < 1)) grid.gates.push({ x: gx, z: gz, w: best.d, name: 'gap' });
        }
      }
    }
    // carve detected gates: clear fence cells along the middle of the gap
    for (const g of grid.gates) {
      strokeSeg(grid, g.x, g.z, g.x, g.z, Math.max(0.6, Math.min(1.2, g.w / 2 - 0.2)), (cell) => { if (ter[cell] === T.FENCE) ter[cell] = T.PATH; });
    }
    // 7. overrides
    for (const g of overrides.gates || []) {
      strokeSeg(grid, g.x, g.z, g.x, g.z, g.r || 1.2, (cell) => { if (ter[cell] === T.FENCE) ter[cell] = T.PATH; });
      grid.gates.push({ x: g.x, z: g.z, w: (g.r || 1.2) * 2, name: g.name || 'gate' });
    }
    for (const r of overrides.clearRects || []) {
      const t = T[(r.terrain || 'path').toUpperCase()];
      fillPoly(grid, [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]], (c) => { ter[c] = t; });
    }
    for (const b of (overrides.blockCircles || []).concat(overrides.blockTrees || [])) {
      strokeSeg(grid, b.x, b.z, b.x, b.z, b.r, (c) => { ter[c] = T.BLOCKED; });
    }
    // 8. tree shelter (within 4 m of trunks) for Summer Shower
    for (const t of GEO.trees || []) {
      strokeSeg(grid, t[0], t[1], t[0], t[1], 4, (c) => { grid.shelter[c] = 1; });
    }
    // cost table
    for (let c = 0; c < grid.size; c++) grid.cost[c] = T_COST[ter[c]];
    // seal the outer frame so nothing walks off-grid
    for (let i = 0; i < grid.w; i++) { grid.cost[i] = 255; grid.cost[(grid.h - 1) * grid.w + i] = 255; }
    for (let j = 0; j < grid.h; j++) { grid.cost[j * grid.w] = 255; grid.cost[j * grid.w + grid.w - 1] = 255; }

    // Seal unreachable pockets (fenced flowerbeds, courtyards): anything not connected to the fountain plaza.
    const seed = grid.idx(0, -20);
    const reach = grid.dijkstra([seed]);
    for (let c = 0; c < grid.size; c++) {
      if (grid.cost[c] < 255 && !(reach[c] < Infinity)) { grid.cost[c] = 255; if (ter[c] !== T.FENCE) ter[c] = T.BLOCKED; }
    }

    // Exit field: any walkable cell outside the park at least 3 m from its polygon ("the street").
    const exits = [];
    for (let c = 0; c < grid.size; c++) {
      if (grid.park[c] || grid.cost[c] >= 255) continue;
      const i = c % grid.w, j = (c - i) / grid.w;
      let near = false;
      for (let dj = -3; dj <= 3 && !near; dj++) for (let di = -3; di <= 3; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= grid.w || jj >= grid.h) continue;
        if (grid.park[jj * grid.w + ii]) { near = true; break; }
      }
      if (!near) exits.push(c);
    }
    grid.exitField = grid.dijkstra(exits);
    grid.exitField.key = 'exit';
    grid.parkPoly = park ? park.pts : null;
    return grid;
  }

  const cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  /** Cached build per GEO object. */
  function get(GEO) {
    if (cache && cache.has(GEO)) return cache.get(GEO);
    const g = build(GEO);
    if (cache) cache.set(GEO, g);
    SQ.nav.grid = g;
    return g;
  }

  SQ.nav = {
    T, T_NAMES, T_COST, T_SPEED, BOUNDS,
    build, get,
    grid: null,
    // Convenience wrappers on the current grid (the last one built via get()).
    flowTo(key) { return SQ.nav.grid ? SQ.nav.grid.flowTo(key) : null; },
    astar(from, to) { return SQ.nav.grid ? SQ.nav.grid.astar(from[0], from[1], to[0], to[1]) : null; },
    sample(x, z) { return SQ.nav.grid ? SQ.nav.grid.sample(x, z) : 'path'; },
    Grid, Heap,
  };
})(window.SQ = window.SQ || {});
