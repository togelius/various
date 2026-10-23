// ACCESSION — the slice's layout programmes, ported from prototypes/layout/proto.js:
// the enfilade, and the quadrangle scaffold with its case-labyrinth and sculpture-court
// fillers (design/layout.md §§4.0, 4.1, 4.4, 4.6). Size 0 is Cabinet.
'use strict';
const LProgrammes = (() => {
  const B = LBuild, T = B.T;

  // The Centrepiece's 2×2 footprint, its top-left tile at L.meta.cpl.
  function footprint(L) {
    const [x, y] = L.meta.cpl;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) L.G.set(x + dx, y + dy, T.CPL);
  }

  function embedEnfilade(L, K, rng) {
    const oy = K.staff ? 3 : 0;
    const maxRow = 44 - K.introW - K.cW;
    const wN = [];
    for (let i = 0; i < K.nN; i++) wN.push(rng.int(6, 9));
    const len = a => a.reduce((s, w) => s + w, 0) + a.length - 1;
    while (len(wN) > maxRow) { let m = 0; for (let i = 1; i < wN.length; i++) if (wN[i] > wN[m]) m = i; if (wN[m] <= 5) wN.pop(); else wN[m]--; }
    const rowLen = len(wN);
    const wS = B.splitN(rng, rowLen, K.nS, 5);
    const xs = K.introW + 2, xe = xs + rowLen - 1;
    const cab = K.cabinets > 0 ? 5 : 0;
    const yN0 = 1 + oy + cab, yN1 = yN0 + K.hN - 1, yS0 = yN1 + 2, yS1 = yS0 + K.hS - 1;
    const W = xe + 1 + K.cW + 2, H = yS1 + 2;
    L.G = B.grid(W, H);
    const intro = B.addRect(L, 'intro', 1, yN0, K.introW, yS1);
    const N = [], S = [];
    let x = xs;
    for (const w of wN) { N.push(B.addRect(L, 'section', x, yN0, x + w - 1, yN1, { row: 'N' })); x += w + 1; }
    x = xs;
    for (const w of wS) { S.push(B.addRect(L, 'section', x, yS0, x + w - 1, yS1, { row: 'S', long: !K.rows2 })); x += w + 1; }
    if (cab) {
      for (const n of rng.shuffle(N.slice()).slice(0, K.cabinets)) {
        const w = Math.min(n.x1 - n.x0 + 1, rng.int(4, 6)), x0 = n.x0 + rng.int(0, n.x1 - n.x0 + 1 - w);
        const c = B.addRect(L, 'study', x0, yN0 - 5, x0 + w - 1, yN0 - 2, { noLoops: true, deadEnd: true, cabinet: true });
        B.connect(L, c.id, n.id, { width: 1, type: T.DOOR, rng });
      }
    }
    const C = B.addRect(L, 'centre', xe + 2, yN0, xe + 1 + K.cW, yN1, { onRing: true });
    const coda = B.addRect(L, 'coda', xe + 2, yS0, xe + 1 + K.cW, yS1);
    const axN = yN0 + (K.hN >> 1), axS = yS0 + (K.hS >> 1);
    L.G.set(0, axN, T.ENT); L.meta.entrance = [0, axN];
    B.connect(L, intro.id, N[0].id, { target: { x: null, y: axN } });
    for (let i = 0; i + 1 < N.length; i++) B.connect(L, N[i].id, N[i + 1].id, { target: { x: null, y: axN } });
    B.connect(L, N[N.length - 1].id, C.id, { target: { x: null, y: axN } });
    const sw = K.hS >= 5 ? 3 : 1;
    B.connect(L, intro.id, S[0].id, { width: sw, target: { x: null, y: axS } });
    for (let i = 0; i + 1 < S.length; i++) B.connect(L, S[i].id, S[i + 1].id, { width: sw, target: rng.pm(K.alignS) ? { x: null, y: axS } : null, rng });
    B.connect(L, S[S.length - 1].id, coda.id, { width: sw, target: { x: null, y: axS } });
    B.connect(L, C.id, coda.id, { width: 3, rng });
    const pairs = [];
    for (const n of N) for (const s of S) if (B.wallCandidates(L, n.id, s.id).length >= 3) pairs.push([n, s]);
    rng.shuffle(pairs);
    for (let i = 0; i < Math.min(K.cross, pairs.length); i++) B.connect(L, pairs[i][0].id, pairs[i][1].id, { width: rng.pm(500) ? 3 : 1, type: T.ARCH, rng, why: 'crosslink' });
    L.meta.cpl = [C.x1 - 1, axN]; footprint(L);
    L.meta.vistaRequired = true; L.meta.formal = true; L.meta.axisY = axN;
    L.meta.exits = B.placeExits(L, coda, rng, K.exits, 'E');
    if (K.staff) B.addStaffBand(L, rng, K.staffDoors);
  }

  // The quadrangle scaffold: Intro, a filled central space, the Centrepiece apse, and
  // bands of rooms north and south, the coda at the east end of the south band.
  function embedHallScaffold(L, K, rng, fill) {
    const oy = K.staff ? 3 : 0, yTop = 1 + oy;
    const introX1 = K.introW, cx0 = introX1 + 2, cx1 = cx0 + K.cW - 1, ax0 = cx1 + 2, ax1 = ax0 + K.apseW - 1;
    const W = ax1 + 2;
    const nY0 = yTop, nY1 = nY0 + K.bandH - 1;
    const cy0 = K.bandN ? nY1 + 2 : yTop, cy1 = cy0 + K.cH - 1;
    const sY0 = cy1 + 2, sY1 = sY0 + K.bandH - 1, H = sY1 + 2;
    L.G = B.grid(W, H);
    const axis = K.axis != null ? cy0 + K.axis : cy0 + (K.cH >> 1);
    const intro = B.addRect(L, 'intro', 1, cy0, introX1, cy1);
    const central = B.addRect(L, 'section', cx0, cy0, cx1, cy1, { central: true, filled: true });
    const win = K.access === 'window';
    const aH = win ? K.cH : Math.min(K.cH, K.apseH);
    const apse = win ? B.addRect(L, 'centre', ax0, cy0, ax1, cy1, { apse: true, noLoops: true })
      : B.addRect(L, 'centre', ax0, axis - (aH >> 1), ax1, axis - (aH >> 1) + aH - 1, { apse: true, noLoops: true });
    const northRooms = [];
    if (K.bandN) { let x = 1; for (const w of B.splitN(rng, (win ? ax1 : cx1), win ? Math.max(3, K.nBandN) : K.nBandN, 5)) { northRooms.push(B.addRect(L, 'section', x, nY0, x + w - 1, nY1, { band: 'N' })); x += w + 1; } }
    const southRooms = [];
    {
      const codaW = K.apseW + rng.int(3, 6);
      const runLen = ax1 - codaW - 1;
      let x = 1;
      for (const w of B.splitN(rng, runLen, K.nBandS, 5)) { southRooms.push(B.addRect(L, 'section', x, sY0, x + w - 1, sY1, { band: 'S' })); x += w + 1; }
      southRooms.push(B.addRect(L, 'coda', x, sY0, ax1, sY1, { band: 'S' }));
    }
    fill(L, central, K, rng, axis);
    L.G.set(0, axis, T.ENT); L.meta.entrance = [0, axis];
    B.connect(L, intro.id, central.id, { target: { x: null, y: axis } });
    if (win) {
      for (let y = axis - 1; y <= axis + 1; y++) L.G.set(cx1 + 1, y, T.VIT);
      const nLast = northRooms[northRooms.length - 1];
      const via = (nLast && B.wallCandidates(L, nLast.id, apse.id).length) ? nLast : null;
      if (via) B.connect(L, via.id, apse.id, { width: 3, rng, why: 'apseAccess' });
    } else B.connect(L, central.id, apse.id, { target: { x: null, y: axis } });
    for (const band of [northRooms, southRooms]) {
      for (let i = 0; i + 1 < band.length; i++) B.connect(L, band[i].id, band[i + 1].id, { width: rng.pm(500) ? 3 : 1, rng });
      for (let i = 0; i < band.length; i++) {
        const r = band[i], must = r.role === 'coda' || i <= 1 || i >= band.length - 2;
        if (B.wallCandidates(L, r.id, intro.id).length) B.connect(L, r.id, intro.id, { width: 3, rng });
        if (must || rng.pm(K.bandLinks)) B.connect(L, r.id, central.id, { width: rng.pm(600) ? 3 : 1, rng });
      }
    }
    const coda = southRooms[southRooms.length - 1];
    if (win && !L.edges.some(e => e.a === apse.id || e.b === apse.id)) B.connect(L, coda.id, apse.id, { width: 3, rng, why: 'apseAccess' });
    L.meta.cpl = [apse.x1 - 1, axis]; footprint(L);
    L.meta.axisY = axis;
    L.meta.exits = B.placeExits(L, coda, rng, K.exits, 'S');
    if (K.staff) B.addStaffBand(L, rng, K.staffDoors);
    return central;
  }

  // A glass maze of 2×2 cells: a random spanning tree, extra connectors, then walls
  // closed on the shortest path until crossing it is tortuous enough.
  function fillLabyrinth(L, c, K, rng, axis) {
    const G = L.G, nx = ((c.x1 - c.x0 + 2) / 3) | 0, ny = ((c.y1 - c.y0 + 2) / 3) | 0;
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if ((x - c.x0) % 3 === 2 || (y - c.y0) % 3 === 2) G.set(x, y, T.VIT);
    const E = new Uint8Array(nx * ny).fill(1), S = new Uint8Array(nx * ny).fill(1);
    const setWall = (i, j, dir, closed) => {
      if (dir === 'E') { E[j * nx + i] = closed; const x = c.x0 + 3 * i + 2; for (const y of [c.y0 + 3 * j, c.y0 + 3 * j + 1]) G.set(x, y, closed ? T.VIT : T.FLOOR); }
      else { S[j * nx + i] = closed; const y = c.y0 + 3 * j + 2; for (const x of [c.x0 + 3 * i, c.x0 + 3 * i + 1]) G.set(x, y, closed ? T.VIT : T.FLOOR); }
    };
    const nbrs = (i, j) => {
      const o = [];
      if (i + 1 < nx && !E[j * nx + i]) o.push([i + 1, j]);
      if (i > 0 && !E[j * nx + i - 1]) o.push([i - 1, j]);
      if (j + 1 < ny && !S[j * nx + i]) o.push([i, j + 1]);
      if (j > 0 && !S[(j - 1) * nx + i]) o.push([i, j - 1]);
      return o;
    };
    const mid = ((axis - c.y0) / 3) | 0;
    const seen = new Uint8Array(nx * ny), st = [[0, mid]];
    seen[mid * nx] = 1;
    while (st.length) {
      const [i, j] = st[st.length - 1];
      const nb = rng.shuffle([[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < ny && !seen[b * nx + a]));
      if (!nb.length) { st.pop(); continue; }
      const [a, b] = nb[0];
      seen[b * nx + a] = 1;
      if (a !== i) setWall(Math.min(a, i), j, 'E', 0); else setWall(i, Math.min(b, j), 'S', 0);
      st.push([a, b]);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (i + 1 < nx && E[j * nx + i] && rng.pm(K.loopP)) setWall(i, j, 'E', 0);
      if (j + 1 < ny && S[j * nx + i] && rng.pm(K.loopP)) setWall(i, j, 'S', 0);
    }
    const bfsCells = () => {
      const D = new Int32Array(nx * ny).fill(-1), P = new Int32Array(nx * ny).fill(-1), q = [mid * nx];
      D[mid * nx] = 0;
      for (let h = 0; h < q.length; h++) {
        const v = q[h], i = v % nx, j = (v - i) / nx;
        for (const [a, b] of nbrs(i, j)) { const w = b * nx + a; if (D[w] < 0) { D[w] = D[v] + 1; P[w] = v; q.push(w); } }
      }
      return { D, P };
    };
    for (let k = 0; k < 40; k++) {
      const { D, P } = bfsCells(), goal = mid * nx + nx - 1;
      if (D[goal] * 1000 >= K.tortMin * (nx - 1)) break;
      const path = [];
      for (let v = goal; P[v] >= 0; v = P[v]) path.push([P[v], v]);
      let closed = false;
      for (const [u, v] of rng.shuffle(path)) {
        const ui = u % nx, uj = (u - ui) / nx, vi = v % nx, vj = (v - vi) / nx;
        const dir = ui !== vi ? 'E' : 'S', i = Math.min(ui, vi), j = Math.min(uj, vj);
        setWall(i, j, dir, 1);
        if (bfsCells().D.every(d => d >= 0)) { closed = true; break; }
        setWall(i, j, dir, 0);
      }
      if (!closed) break;
    }
    for (let k = 0; k < K.clearings; k++) {
      const i = rng.int(1, nx - 3), j = rng.int(0, ny - 2);
      for (let y = c.y0 + 3 * j; y <= c.y0 + 3 * j + 4; y++) for (let x = c.x0 + 3 * i; x <= c.x0 + 3 * i + 4; x++) G.set(x, y, T.FLOOR);
      G.set(c.x0 + 3 * i + 2, c.y0 + 3 * j + 2, rng.pm(500) ? T.COL : T.PART);
    }
    for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
      const x = c.x0 + 3 * i + 2, y = c.y0 + 3 * j + 2;
      if (G.get(x, y) === T.VIT && rng.pm(K.opaquePosts)) G.set(x, y, T.COL);
    }
    { const { D } = bfsCells(); L.meta.crossing = Math.floor(D[mid * nx + nx - 1] * 1000 / (nx - 1)); L.meta.tortMin = K.tortMin; }
    L.meta.vistaRequired = true;
  }

  // Poisson-disc plinths and columns, an optional loggia of columns, an optional pool.
  function fillCourt(L, c, K, rng, axis) {
    const G = L.G;
    let ix0 = c.x0, iy0 = c.y0, ix1 = c.x1, iy1 = c.y1;
    if (K.loggia) {
      for (let x = c.x0 + 1; x <= c.x1 - 1; x += 2) { G.set(x, c.y0 + 1, T.COL); G.set(x, c.y1 - 1, T.COL); }
      for (let y = c.y0 + 3; y <= c.y1 - 3; y += 2) if (Math.abs(y - axis) > 1) { G.set(c.x0 + 1, y, T.COL); G.set(c.x1 - 1, y, T.COL); }
      ix0 += 3; iy0 += 3; ix1 -= 3; iy1 -= 3;
    }
    const mid = (c.x0 + c.x1) >> 1;
    const pool = [];
    if (K.pool) {
      const pw = K.poolW;
      for (let y = axis - 1; y <= axis + 1; y++) for (let x = mid - (pw >> 1); x <= mid + (pw >> 1); x++) { G.set(x, y, T.VOID); pool.push([x, y]); }
    }
    const pts = [];
    const okp = (x, y) => x >= ix0 + 1 && x <= ix1 - 1 && y >= iy0 + 1 && y <= iy1 - 1 && y !== axis && G.get(x, y) === T.FLOOR &&
      pts.every(([a, b]) => (a - x) * (a - x) + (b - y) * (b - y) >= K.spacing * K.spacing) &&
      pool.every(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) >= 2);
    for (let t = 0; t < K.tries; t++) {
      const x = rng.int(ix0 + 1, ix1 - 1), y = rng.int(iy0 + 1, iy1 - 1);
      if (!okp(x, y)) continue;
      const mirror = K.symmetry ? 2 * axis - y : null;
      if (mirror != null && (mirror === y || !okp(x, mirror))) continue;
      const kind = rng.pm(K.lowShare) ? T.PLINTH : T.COL;
      pts.push([x, y]); G.set(x, y, kind);
      if (mirror != null) { pts.push([x, mirror]); G.set(x, mirror, kind); }
    }
    L.meta.vistaRequired = true; L.meta.bright = true;
  }

  // Knobs per programme; s is the size class (0 Cabinet, 1 Department, 2 Wing).
  const PROGRAMMES = {
    enfilade: {
      d: 20,
      knobs(r, s) {
        const rows2 = s === 2 ? 1 : s === 1 ? (r.pm(400) ? 1 : 0) : 0;
        const nN = s === 0 ? 2 : s === 1 ? (rows2 ? 2 : 3) : r.int(3, 4);
        const K = { rows2, nN, nS: rows2 ? nN : (s === 0 ? 1 : r.int(1, 2)), hN: r.int(7, 9 + s), introW: r.int(6, 8), cW: r.int(9, 11),
          alignS: r.int(600, 1000), cross: r.int(0, 1 + s), cabinets: s === 0 ? 0 : r.int(0, s), exits: r.int(2, 3),
          staff: r.pm(700) ? 1 : 0, staffDoors: r.int(2, 3), hS: 0 };
        K.hS = K.rows2 ? K.hN - 1 + (K.hN & 1) : 5;
        return K;
      },
      embed: embedEnfilade,
    },
    case_labyrinth: {
      d: 20,
      knobs(r, s) {
        const nx = r.int(5 + s, 6 + s), ny = r.int(4, 4 + (s > 0 ? 1 : 0));
        return { introW: r.int(6, 7), cW: 3 * nx - 1, cH: 3 * ny - 1, axis: 3 * (ny >> 1), apseW: r.int(7, 9), apseH: r.pick([7, 9]),
          bandH: r.int(5, 6), bandN: s === 0 ? 0 : s === 2 ? 1 : (r.pm(500) ? 1 : 0), access: r.pm(500) ? 'window' : 'axis',
          nBandS: s === 0 ? 1 : s === 1 ? 2 : 3, nBandN: s === 2 ? 3 : r.int(1, 2), bandLinks: r.int(200, 600),
          studies: s === 0 ? 0 : s === 1 ? 1 : r.int(1, 2), tortMin: r.int(1300, 1700), loopP: r.int(80, 300), clearings: r.int(0, 1),
          opaquePosts: r.int(0, 300), exits: r.int(2, 3), staff: r.pm(500) ? 1 : 0, staffDoors: 2 };
      },
      embed: (L, K, r) => embedHallScaffold(L, K, r, fillLabyrinth),
    },
    sculpture_court: {
      d: 20,
      knobs(r, s) {
        return { introW: r.int(6, 7), cW: r.int(16 + 3 * s, 20 + 3 * s), cH: r.pick([11, 13, 15, 17].slice(s, s + 2)), apseW: r.int(7, 9),
          apseH: r.pick([7, 9]), bandH: r.int(5, 6), bandN: s === 0 ? 0 : s === 2 ? 1 : (r.pm(500) ? 1 : 0), access: r.pm(500) ? 'window' : 'axis',
          nBandS: s === 0 ? 1 : s === 1 ? 2 : 3, nBandN: s === 2 ? 3 : r.int(1, 2), bandLinks: r.int(300, 700),
          studies: s === 0 ? 0 : s === 1 ? 1 : r.int(1, 2), loggia: r.pm(500) ? 1 : 0, pool: r.pm(600) ? 1 : 0, poolW: r.pick([3, 5]),
          spacing: r.int(3, 5), tries: r.int(30, 80), symmetry: r.pm(500) ? 1 : 0, lowShare: r.int(100, 400), exits: r.int(2, 3),
          staff: r.pm(500) ? 1 : 0, staffDoors: 2 };
      },
      embed: (L, K, r) => embedHallScaffold(L, K, r, fillCourt),
    },
  };

  return { PROGRAMMES, embedEnfilade, embedHallScaffold, fillLabyrinth, fillCourt };
})();
