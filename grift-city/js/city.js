// GRIFT CITY — the island. A grid of blocks separated by four-lane roads, districts by distance from
// downtown, special buildings placed by hand, and the graphs traffic and pedestrians walk.
'use strict';
const CITY = (() => {
  const GRID = 10, BLOCK = 64, ROAD = 14, SW = 3, PITCH = BLOCK + ROAD + 2 * SW; // 84
  const HALF_ROAD = ROAD / 2, LANE = 3.5, CURB = 0.15;
  const SIZE = GRID * PITCH; // road centre lines at 0, 84, ..., 840
  const SHORE = 26; // land beyond the outer roads before the water
  const rng = M.rng(20260915);

  const blockOrigin = (i, j) => [i * PITCH + HALF_ROAD + SW, j * PITCH + HALF_ROAD + SW];
  const district = (i, j) => {
    const dx = i - (GRID - 1) / 2, dz = j - (GRID - 1) / 2, d = Math.max(Math.abs(dx), Math.abs(dz));
    if (d <= 1.5) return 'downtown';
    if (d <= 2.5) return 'midtown';
    if (dx < -2 && dz > 1) return 'westfield';
    if (dz < -2) return 'northgate';
    if (dx > 2) return 'eastside';
    return 'southport';
  };

  // ---- Special lots: block [i, j], which cell of the block, and what.
  const SPECIALS = [
    { i: 2, j: 2, kind: 'safehouse', label: 'SAFEHOUSE' },
    { i: 3, j: 4, kind: 'garage', label: "VOSS MOTORS" },
    { i: 4, j: 5, kind: 'bank', label: 'FIRST GRIFT BANK' },
    { i: 5, j: 4, kind: 'tower', label: 'CRANE HOLDINGS' },
    { i: 6, j: 6, kind: 'hospital', label: 'ST. MARROW HOSPITAL' },
    { i: 3, j: 6, kind: 'police', label: 'GCPD 3RD PRECINCT' },
    { i: 7, j: 3, kind: 'police', label: 'GCPD 9TH PRECINCT' },
    { i: 2, j: 7, kind: 'hospital', label: 'WESTFIELD CLINIC' },
    { i: 6, j: 2, kind: 'spray', label: "PAY 'N' SPRAY" },
    { i: 2, j: 5, kind: 'spray', label: "PAY 'N' SPRAY" },
    { i: 7, j: 7, kind: 'spray', label: "PAY 'N' SPRAY" },
    { i: 5, j: 2, kind: 'guns', label: 'IRONMONGER' },
    { i: 3, j: 8, kind: 'guns', label: 'IRONMONGER' },
    { i: 8, j: 5, kind: 'guns', label: 'IRONMONGER' },
    { i: 8, j: 8, kind: 'docks', label: 'PIER 9' },
    { i: 1, j: 8, kind: 'park' }, { i: 8, j: 1, kind: 'park' }, { i: 4, j: 8, kind: 'park' }, { i: 1, j: 4, kind: 'park' }, { i: 6, j: 9, kind: 'park' },
    { i: 0, j: 0, kind: 'parking' }, { i: 5, j: 7, kind: 'parking' }, { i: 9, j: 4, kind: 'parking' }, { i: 1, j: 1, kind: 'parking' }, { i: 7, j: 0, kind: 'parking' },
    { i: 9, j: 9, kind: 'stunt' }, { i: 0, j: 9, kind: 'stunt' }, { i: 9, j: 0, kind: 'stunt' },
  ];

  const lots = [];       // collision boxes: {x0,z0,x1,z1,h, kind}
  const blocks = [];     // per block: {i,j,x,z,lots:[], kind}
  const places = {};     // named locations: kind -> [{x,z,angle,label,...}]
  const props = { lamppost: [], trafficLight: [], tree: [], hydrant: [], bin: [], bench: [], bollard: [] };
  const solidProps = []; // {x,z,r,kind,idx}
  const parkedSpots = [];// {x,z,angle}
  const ramps = [];      // {x0,z0,x1,z1,h,dir}
  const lights = [];     // traffic lights: {x,z,phase}
  let stunts = [];

  function addPlace(kind, p) { (places[kind] = places[kind] || []).push(p); }

  // ---- Static geometry
  function buildStatic() {
    const T = TEX.names; const b = new MESH.Builder();
    const C = [1, 1, 1];
    // Water and shore
    const W0 = -HALF_ROAD - SW - SHORE, W1 = SIZE + HALF_ROAD + SW + SHORE;
    b.floor(W0 - 2000, W1 - 2000, 4000 + (W1 - W0), 2000, -1.6, C, T.water, 24); // north strip... simpler: four big strips around
    b.floor(W0 - 2000, W1, 4000 + (W1 - W0), 2000, -1.6, C, T.water, 24);
    b.floor(W0 - 2000, W0, 2000, W1 - W0, -1.6, C, T.water, 24);
    b.floor(W1, W0, 2000, W1 - W0, -1.6, C, T.water, 24);
    // Island ground: grass ring with a sandy south beach
    b.floor(W0, W0, W1 - W0, W1 - W0, -0.02, C, T.grass, 8);
    b.box(W0, -1.6, W0, W1 - W0, 1.58, W1 - W0, [0.55, 0.55, 0.5], T.sidewalk, { faces: 1 | 2 | 16 | 32, uvScale: 4 }); // seawall
    b.floor(W0, SIZE + HALF_ROAD + SW + 2, W1 - W0, SHORE - 2, 0.0, C, T.sand, 8);
    // Railing along the seawall
    for (let k = 0; k < 4; k++) {
      const horiz = k < 2, pos = k % 2 ? W1 - 0.4 : W0 + 0.1;
      if (horiz) { b.box(W0, 0.9, pos, W1 - W0, 0.08, 0.08, [0.6, 0.6, 0.62]); for (let x = W0; x < W1; x += 6) b.box(x, 0, pos, 0.1, 0.95, 0.1, [0.5, 0.5, 0.52]); }
      else { b.box(pos, 0.9, W0, 0.08, 0.08, W1 - W0, [0.6, 0.6, 0.62]); for (let z = W0; z < W1; z += 6) b.box(pos, 0, z, 0.1, 0.95, 0.1, [0.5, 0.5, 0.52]); }
    }
    // Roads: horizontal (along x) and vertical (along z) segments between intersections
    for (let j = 0; j <= GRID; j++) for (let i = 0; i < GRID; i++) {
      const x0 = i * PITCH + HALF_ROAD, x1 = (i + 1) * PITCH - HALF_ROAD, zc = j * PITCH;
      b.poly([[x0, 0, zc - HALF_ROAD], [x0, 0, zc + HALF_ROAD], [x1, 0, zc + HALF_ROAD], [x1, 0, zc - HALF_ROAD]], C, T.road, [[0, 0], [1, 0], [1, (x1 - x0) / 16], [0, (x1 - x0) / 16]]);
      // sidewalk strips between the block corners, outside the grid, are part of block slabs; extend for edge roads
    }
    for (let i = 0; i <= GRID; i++) for (let j = 0; j < GRID; j++) {
      const z0 = j * PITCH + HALF_ROAD, z1 = (j + 1) * PITCH - HALF_ROAD, xc = i * PITCH;
      b.poly([[xc - HALF_ROAD, 0, z0], [xc - HALF_ROAD, 0, z1], [xc + HALF_ROAD, 0, z1], [xc + HALF_ROAD, 0, z0]], C, T.road, [[0, 0], [0, (z1 - z0) / 16], [1, (z1 - z0) / 16], [1, 0]]);
    }
    // Intersections + crosswalks + stop lines
    for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) {
      const xc = i * PITCH, zc = j * PITCH;
      b.floor(xc - HALF_ROAD, zc - HALF_ROAD, ROAD, ROAD, 0, C, T.asphalt, 8);
      const stripe = [0.85, 0.85, 0.8];
      const inner = i > 0 && i < GRID && j > 0 && j < GRID;
      for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const has = sx ? (sx < 0 ? i > 0 : i < GRID) : (sz < 0 ? j > 0 : j < GRID);
        if (!has) continue;
        // zebra across the arm at distance 7.5..9.5 from centre
        for (let k = -5; k <= 5; k++) {
          if (sx) b.box(xc + sx * 7.6 + (sx < 0 ? -2 : 0), 0.01, zc + k * 1.2 - 0.3, 2, 0.005, 0.6, stripe, 0, { faces: 4 });
          else b.box(xc + k * 1.2 - 0.3, 0.01, zc + sz * 7.6 + (sz < 0 ? -2 : 0), 0.6, 0.005, 2, stripe, 0, { faces: 4 });
        }
        // stop line (on the right-hand approach lanes)
        if (sx) b.box(xc + sx * 10, 0.01, sx > 0 ? zc - 7 : zc, 0.4, 0.005, 7, stripe, 0, { faces: 4 });
        else b.box(sz > 0 ? xc : xc - 7, 0.01, zc + sz * 10, 7, 0.005, 0.4, stripe, 0, { faces: 4 });
      }
      if (inner) {
        lights.push({ x: xc, z: zc, i, j });
        // Four traffic light poles at the corners, arm pointing over the road.
        for (const [cx, cz, ang] of [[1, 1, Math.PI], [-1, -1, 0], [1, -1, -Math.PI / 2], [-1, 1, Math.PI / 2]]) {
          props.trafficLight.push({ x: xc + cx * (HALF_ROAD + 1.2), z: zc + cz * (HALF_ROAD + 1.2), a: ang, light: lights.length - 1, axis: (cx * cz > 0) ? 0 : 1 });
        }
      }
    }
    // Blocks
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) buildBlock(b, i, j);
    return b;
  }

  function buildBlock(b, i, j) {
    const T = TEX.names; const [bx, bz] = blockOrigin(i, j); const C = [1, 1, 1];
    const special = SPECIALS.filter(s => s.i === i && s.j === j)[0];
    const dist = district(i, j);
    const block = { i, j, x: bx, z: bz, lots: [], kind: special ? special.kind : dist };
    blocks.push(block);
    // slab (sidewalk level) with curbs
    b.box(bx - SW, 0, bz - SW, BLOCK + 2 * SW, CURB, BLOCK + 2 * SW, [0.95, 0.95, 0.95], T.sidewalk, { faces: 1 | 2 | 4 | 16 | 32, uvScale: 8 });
    // lampposts along each edge, bins, hydrants
    for (let k = 8; k < BLOCK; k += 16) {
      props.lamppost.push({ x: bx + k, z: bz - SW + 0.6, a: 0 }); props.lamppost.push({ x: bx + k + 8, z: bz + BLOCK + SW - 0.6, a: Math.PI });
      props.lamppost.push({ x: bx - SW + 0.6, z: bz + k + 8, a: Math.PI / 2 }); props.lamppost.push({ x: bx + BLOCK + SW - 0.6, z: bz + k, a: -Math.PI / 2 });
    }
    if (rng.chance(0.7)) props.hydrant.push({ x: bx + rng.range(4, 60), z: bz - SW + 0.8, a: 0 });
    if (rng.chance(0.7)) props.hydrant.push({ x: bx + BLOCK + SW - 0.8, z: bz + rng.range(4, 60), a: 0 });
    for (let k = 0; k < 3; k++) if (rng.chance(0.6)) { const side = rng.int(0, 3); const t = rng.range(3, 61); props.bin.push(side === 0 ? { x: bx + t, z: bz - SW + 0.7, a: 0 } : side === 1 ? { x: bx + t, z: bz + BLOCK + SW - 0.7, a: 0 } : side === 2 ? { x: bx - SW + 0.7, z: bz + t, a: 0 } : { x: bx + BLOCK + SW - 0.7, z: bz + t, a: 0 }); }

    const kind = block.kind;
    if (kind === 'park') return buildPark(b, block);
    if (kind === 'parking') return buildParking(b, block, false);
    if (kind === 'stunt') return buildParking(b, block, true);
    if (kind === 'docks') return buildDocks(b, block);

    // Subdivide into lots
    const splits = n => n === 2 ? rng.pick([[32, 32], [24, 40], [40, 24]]) : rng.pick([[24, 16, 24], [20, 24, 20], [16, 24, 24], [24, 24, 16]]);
    let xs, zs;
    if (kind === 'downtown' && rng.chance(0.45)) { xs = [64]; zs = [64]; }
    else { xs = splits(rng.chance(0.5) ? 2 : 3); zs = splits(rng.chance(0.5) ? 2 : 3); }
    let specialDone = !special;
    let zc = 0;
    for (let zi = 0; zi < zs.length; zi++) {
      let xc = 0;
      for (let xi = 0; xi < xs.length; xi++) {
        const w = xs[xi], d = zs[zi];
        const front = zi === 0 ? 'n' : zi === zs.length - 1 ? 's' : xi === 0 ? 'w' : 'e';
        if (!specialDone && zi === 0 && xi === 0) { buildSpecial(b, block, special, bx + xc, bz + zc, w, d); specialDone = true; }
        else buildLot(b, block, bx + xc, bz + zc, w, d, front);
        xc += w;
      }
      zc += zs[zi];
    }
  }

  const FACADES = {
    downtown: ['glass', 'office', 'office', 'concrete'], midtown: ['office', 'concrete', 'brick', 'tenement'],
    northgate: ['brick', 'tenement', 'brick', 'concrete'], westfield: ['brick', 'concrete', 'tenement'],
    eastside: ['concrete', 'tenement', 'tenement', 'brick'], southport: ['tenement', 'brick', 'concrete'],
  };
  const FLOORS = { downtown: [14, 42], midtown: [6, 16], northgate: [3, 8], westfield: [2, 5], eastside: [2, 6], southport: [3, 7] };

  function addLot(block, x0, z0, x1, z1, h, kind = 'building') { const l = { x0, z0, x1, z1, h, kind }; lots.push(l); block.lots.push(l); return l; }

  function buildLot(b, block, x, z, w, d, front) {
    const T = TEX.names; const dist = block.kind;
    const m = rng.range(1.5, 3.5); const x0 = x + m, z0 = z + m, x1 = x + w - m, z1 = z + d - m; const W = x1 - x0, D = z1 - z0;
    const [fmin, fmax] = FLOORS[dist] || [3, 8];
    const floors = rng.int(fmin, fmax); const fh = 3.2; const ground = 4.2;
    const facade = rng.pick(FACADES[dist] || FACADES.midtown);
    const tint = rng.chance(0.3) ? [rng.range(0.7, 1.05), rng.range(0.7, 1.05), rng.range(0.7, 1.05)] : [1, 1, 1].map(v => v * rng.range(0.75, 1.05));
    const y = CURB;
    const commercial = rng.chance(dist === 'downtown' ? 0.6 : 0.75);
    let top = y;
    if (commercial) {
      b.box(x0, y, z0, W, ground, D, tint, T.shops, { faces: 1 | 2 | 16 | 32, uvScale: 8, vOff: 0 });
      top = y + ground;
      // awning band
      b.box(x0 - 0.3, top - 0.35, z0 - 0.3, W + 0.6, 0.35, D + 0.6, tint.map(v => v * 0.6), 0);
    }
    const H = floors * fh;
    // window texture: 4 window columns per 14 units, 4 rows per 12.8 units
    const facadeOpts = { faces: 1 | 2 | 16 | 32, uvScale: 1, uOff: rng.range(0, 1), vOff: 0 };
    facadeBox(b, x0, top, z0, W, H, D, tint, T[facade], facadeOpts);
    // roof
    b.floor(x0, z0, W, D, top + H, tint.map(v => v * 0.9), T.roof, 8);
    roofDetails(b, x0, top + H, z0, W, D, tint, floors > 12);
    // optional setback tower
    let totalH = top + H;
    if (floors > 10 && rng.chance(0.5)) {
      const s = rng.range(0.55, 0.8); const tw = W * s, td = D * s, tx = x0 + (W - tw) / 2, tz = z0 + (D - td) / 2, th = rng.int(4, floors) * fh;
      facadeBox(b, tx, top + H, tz, tw, th, td, tint, T[facade], facadeOpts);
      b.floor(tx, tz, tw, td, top + H + th, tint.map(v => v * 0.9), T.roof, 8);
      roofDetails(b, tx, top + H + th, tz, tw, td, tint, true);
      totalH = top + H + th;
    }
    // Billboard on some roofs facing the street
    if (rng.chance(0.18) && floors < 12) {
      const tile = rng.pick([T.billboard, T.billboard2]); const bw = Math.min(W - 2, 10), bh = bw * 0.6;
      const bxp = x0 + (W - bw) / 2; const bzp = front === 's' ? z1 - 0.5 : z0 + 0.5;
      b.box(bxp, totalH + 1.5, bzp - 0.15, bw, bh, 0.3, [1, 1, 1], tile, { uvScale: bw, faces: 16 | 32 });
      b.box(bxp + 1, totalH, bzp - 0.05, 0.15, 1.5, 0.1, [0.3, 0.3, 0.3]); b.box(bxp + bw - 1, totalH, bzp - 0.05, 0.15, 1.5, 0.1, [0.3, 0.3, 0.3]);
    }
    addLot(block, x0, z0, x1, z1, totalH);
  }
  // Box with windows scaled so a window column is ~3.5 units and a row 3.2 units; uv v=0 at the bottom.
  function facadeBox(b, x, y, z, w, h, d, tint, tile, opts) {
    const [r, g, bb] = tint;
    const faceUV = (len) => len / 14;
    const f = (nx, nz, pts, len) => { const base = b.n; const vs = h / 12.8, us = faceUV(len); const uo = opts.uOff || 0;
      pts.forEach((p, k) => { const u = (k === 2 || k === 3) ? us : 0, v = (k === 1 || k === 2) ? vs : 0; b.vert(p[0], p[1], p[2], nx, 0, nz, r, g, bb, u + uo, v, tile, 0); });
      b.quad(base, base + 1, base + 2, base + 3); };
    const x1 = x + w, z1 = z + d, y1 = y + h;
    f(1, 0, [[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], d);
    f(-1, 0, [[x, y, z1], [x, y1, z1], [x, y1, z], [x, y, z]], d);
    f(0, 1, [[x1, y, z1], [x1, y1, z1], [x, y1, z1], [x, y, z1]], w);
    f(0, -1, [[x, y, z], [x, y1, z], [x1, y1, z], [x1, y, z]], w);
  }
  function roofDetails(b, x, y, z, w, d, tint, tall) {
    const T = TEX.names; const p = tint.map(v => v * 0.85);
    b.box(x, y, z, w, 0.7, 0.4, p); b.box(x, y, z + d - 0.4, w, 0.7, 0.4, p); b.box(x, y, z, 0.4, 0.7, d, p); b.box(x + w - 0.4, y, z, 0.4, 0.7, d, p);
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) { const aw = rng.range(1.5, 3), ad = rng.range(1.5, 3); b.box(x + rng.range(1, Math.max(1.1, w - aw - 1)), y, z + rng.range(1, Math.max(1.1, d - ad - 1)), aw, rng.range(0.8, 1.6), ad, [0.6, 0.6, 0.62], T.metal, { uvScale: 2 }); }
    if (rng.chance(0.3) && w > 8 && d > 8) { const cx = x + rng.range(3, w - 3), cz = z + rng.range(3, d - 3); b.cyl(cx, y, cz, 0.15, 2.5, [0.3, 0.3, 0.3], 0, 4); b.cyl(cx, y + 2.5, cz, 1.3, 4.3, [0.45, 0.35, 0.25], 0, 8, 0, true, true); }
    if (tall) { b.box(x + w / 2 - 0.1, y, z + d / 2 - 0.1, 0.2, 6, 0.2, [0.7, 0.7, 0.7]); b.cbox(x + w / 2, y + 6.1, z + d / 2, 0.3, 0.3, 0.3, [1, 0.1, 0.1], 0, { bone: 0 }); }
  }
  function buildPark(b, block) {
    const T = TEX.names; const { x, z } = block; const C = [1, 1, 1];
    b.floor(x, z, BLOCK, BLOCK, CURB + 0.01, C, T.grass, 8);
    // paths in a cross
    b.floor(x + BLOCK / 2 - 2, z, 4, BLOCK, CURB + 0.02, [0.9, 0.9, 0.9], T.sidewalk, 8); b.floor(x, z + BLOCK / 2 - 2, BLOCK, 4, CURB + 0.02, [0.9, 0.9, 0.9], T.sidewalk, 8);
    // fountain
    b.cyl(x + BLOCK / 2, CURB, z + BLOCK / 2, 4, CURB + 0.8, [0.7, 0.7, 0.72], 0, 16); b.floor(x + BLOCK / 2 - 3.5, z + BLOCK / 2 - 3.5, 7, 7, CURB + 0.7, C, T.water, 4); b.cyl(x + BLOCK / 2, CURB + 0.7, z + BLOCK / 2, 0.6, CURB + 2.5, [0.7, 0.7, 0.72], 0, 8);
    solidProps.push({ x: x + BLOCK / 2, z: z + BLOCK / 2, r: 4.2, kind: 'fountain' });
    for (let k = 0; k < 22; k++) {
      let tx, tz, tries = 0; do { tx = x + rng.range(3, BLOCK - 3); tz = z + rng.range(3, BLOCK - 3); tries++; } while (tries < 20 && (Math.abs(tx - x - BLOCK / 2) < 4 || Math.abs(tz - z - BLOCK / 2) < 4 || M.dist(tx, tz, x + BLOCK / 2, z + BLOCK / 2) < 8));
      props.tree.push({ x: tx, z: tz, a: rng.range(0, 6.28), s: rng.range(0.8, 1.3) }); solidProps.push({ x: tx, z: tz, r: 0.5, kind: 'tree' });
    }
    for (let k = 0; k < 6; k++) { const along = rng.chance(0.5); const t = rng.range(6, BLOCK - 6); const p = along ? { x: x + t, z: z + BLOCK / 2 + (rng.chance(0.5) ? 3 : -3), a: 0 } : { x: x + BLOCK / 2 + (rng.chance(0.5) ? 3 : -3), z: z + t, a: Math.PI / 2 }; props.bench.push(p); }
    addPlace('park', { x: x + BLOCK / 2, z: z + BLOCK / 2, label: 'park' });
  }
  function buildParking(b, block, stunt) {
    const T = TEX.names; const { x, z } = block; const C = [1, 1, 1];
    b.floor(x, z, BLOCK, BLOCK, CURB + 0.01, C, T.parking, 16);
    // low wall around three sides, open on the north side
    const wall = [0.7, 0.68, 0.62];
    b.box(x, CURB, z + BLOCK - 0.6, BLOCK, 1.0, 0.6, wall); b.box(x, CURB, z, 0.6, 1.0, BLOCK, wall); b.box(x + BLOCK - 0.6, CURB, z, 0.6, 1.0, BLOCK, wall);
    addLot(block, x, z + BLOCK - 0.6, x + BLOCK, z + BLOCK, 1, 'wall'); addLot(block, x, z, x + 0.6, z + BLOCK, 1, 'wall'); addLot(block, x + BLOCK - 0.6, z, x + BLOCK, z + BLOCK, 1, 'wall');
    for (let row = 0; row < 3; row++) for (let k = 0; k < 8; k++) {
      if (rng.chance(stunt ? 0.25 : 0.55)) parkedSpots.push({ x: x + 6 + k * 7.5, z: z + 8 + row * 20 + (row === 1 ? 2 : 0), angle: rng.chance(0.5) ? 0 : Math.PI });
    }
    if (stunt) {
      // A pair of ramps facing each other across the lot, and a couple facing the open (north) exit.
      // Two ramps at the open (north) end of the lot, rising toward the street: turn around at the back
      // wall, floor it across the lot, and fly over the road.
      const RH = 4.2, RL = 13;
      for (const rx of [x + 14, x + 40]) {
        const r = { x0: rx, z0: z + 2, x1: rx + 10, z1: z + 2 + RL, h: RH, dir: 'n' }; ramps.push(r);
        b.wedge(r.x0, CURB, r.z0, 10, RH, RL, [0.85, 0.5, 0.2], T.metal);
        for (let k = 0; k < 5; k++) b.box(r.x0, CURB + 0.02, r.z1 + 2 + k * 4, 10, 0.005, 1.2, [0.9, 0.8, 0.1], 0, { faces: 4 });
        stunts.push({ x: rx + 5, z: z + 8 });
      }
    }
    addPlace('parking', { x: x + BLOCK / 2, z: z + BLOCK / 2, label: 'car park' });
  }
  function buildDocks(b, block) {
    const T = TEX.names; const { x, z } = block; const C = [1, 1, 1];
    b.floor(x, z, BLOCK, BLOCK, CURB + 0.01, C, T.asphalt, 12);
    // stacked containers and a warehouse
    const cols = [[0.75, 0.2, 0.15], [0.15, 0.35, 0.65], [0.2, 0.55, 0.3], [0.8, 0.6, 0.1], [0.5, 0.5, 0.55]];
    for (let k = 0; k < 9; k++) { const cx = x + 4 + (k % 3) * 8, cz = z + 4 + Math.floor(k / 3) * 7, n = rng.int(1, 3); for (let s = 0; s < n; s++) b.box(cx, CURB + s * 2.6, cz, 6, 2.6, 2.4, rng.pick(cols), T.metal, { uvScale: 2 }); addLot(block, cx, cz, cx + 6, cz + 2.4, 2.6 * n); }
    b.box(x + 34, CURB, z + 30, 28, 9, 30, [0.6, 0.6, 0.62], T.metal, { uvScale: 3 }); b.box(x + 34 - 0.2, CURB + 9, z + 30 - 0.2, 28.4, 0.6, 30.4, [0.4, 0.4, 0.42]);
    b.box(x + 38, CURB, z + 29.8, 8, 6, 0.3, [0.3, 0.32, 0.36], T.garage, { uvScale: 8 });
    addLot(block, x + 34, z + 30, x + 62, z + 60, 9, 'warehouse');
    // crane
    b.box(x + 8, CURB, z + 44, 2, 18, 2, [0.85, 0.6, 0.1]); b.box(x + 8, CURB + 17, z + 44, 26, 1.2, 1.4, [0.85, 0.6, 0.1]); addLot(block, x + 8, z + 44, x + 10, z + 46, 18);
    addPlace('docks', { x: x + 20, z: z + 22, label: 'PIER 9', angle: 0 });
    for (let k = 0; k < 4; k++) parkedSpots.push({ x: x + 6 + k * 7, z: z + 25, angle: 0 });
  }

  function buildSpecial(b, block, sp, x, z, w, d) {
    const T = TEX.names; const C = [1, 1, 1]; const y = CURB;
    const m = 2; const x0 = x + m, z0 = z + m, x1 = x + w - m, z1 = z + d - m; const W = x1 - x0, D = z1 - z0;
    const front = { x: (x0 + x1) / 2, z: z0 - SW - 1.2 }; // marker on the sidewalk north of the lot
    let h = 8;
    switch (sp.kind) {
      case 'safehouse':
        h = 7; b.box(x0, y, z0, W, h, D, [0.95, 0.85, 0.75], T.brick, { uvScale: 14, faces: 63 }); b.box(x0 - 0.3, y + h, z0 - 0.3, W + 0.6, 0.6, D + 0.6, [0.45, 0.3, 0.25]);
        b.box(x0 + W / 2 - 1.2, y, z0 - 0.1, 2.4, 3, 0.2, [0.3, 0.2, 0.15]); // door
        addPlace('safehouse', { x: front.x, z: front.z, label: sp.label, spawnX: front.x, spawnZ: front.z + 0, angle: Math.PI });
        break;
      case 'garage':
        h = 6; b.box(x0, y, z0, W, h, D, [0.85, 0.85, 0.85], T.garage, { uvScale: 12 }); b.box(x0 - 0.2, y + h, z0 - 0.2, W + 0.4, 0.5, D + 0.4, [0.35, 0.35, 0.38]);
        signBox(b, x0 + W / 2, y + h + 1.2, z0 + 0.3, Math.min(W - 2, 12), 1.8, [0.9, 0.2, 0.15]);
        addPlace('garage', { x: front.x, z: front.z, label: sp.label, angle: 0 });
        addPlace('mission', { x: front.x - 6, z: front.z, label: 'MARLA', angle: 0 });
        break;
      case 'bank':
        h = 14; b.box(x0, y, z0, W, h, D, [0.85, 0.82, 0.72], T.concrete, { uvScale: 1, faces: 63 }); for (let k = 0; k < 5; k++) b.cyl(x0 + 3 + k * (W - 6) / 4, y, z0 - 1.2, 0.6, y + 10, [0.9, 0.88, 0.8], 0, 8); b.box(x0 - 0.5, y + 10, z0 - 2.2, W + 1, 1.6, 2.6, [0.9, 0.88, 0.8]); b.box(x0 - 0.8, y + h, z0 - 0.8, W + 1.6, 1.2, D + 1.6, [0.75, 0.72, 0.62]);
        b.box(x0 + W / 2 - 2, y, z0 - 0.1, 4, 4, 0.2, [0.25, 0.2, 0.15]);
        addPlace('bank', { x: front.x, z: front.z, label: sp.label, angle: 0 }); break;
      case 'tower': {
        h = 160; const tw = W * 0.7, td = D * 0.7, tx = x0 + (W - tw) / 2, tz = z0 + (D - td) / 2;
        b.box(x0, y, z0, W, 6, D, [0.3, 0.32, 0.36], T.glass, { uvScale: 14 });
        facadeBox(b, tx, y + 6, tz, tw, h - 6, td, [0.8, 0.9, 1.0], T.glass, { uOff: 0 }); b.floor(tx, tz, tw, td, y + h, [0.3, 0.3, 0.32], T.roof, 8);
        b.box(tx + tw / 2 - 0.2, y + h, tz + td / 2 - 0.2, 0.4, 14, 0.4, [0.8, 0.8, 0.8]); b.cbox(tx + tw / 2, y + h + 14.2, tz + td / 2, 0.5, 0.5, 0.5, [1, 0.1, 0.1]);
        // helipad
        b.floor(tx + 2, tz + 2, tw - 4, td - 4, y + h + 0.05, [0.4, 0.4, 0.42], T.asphalt, 8); b.cyl(tx + tw / 2, y + h + 0.06, tz + td / 2, 5, y + h + 0.1, [0.9, 0.9, 0.2], 0, 20);
        b.box(x0 + W / 2 - 3, y, z0 - 0.1, 6, 4.5, 0.2, [0.1, 0.1, 0.12]);
        signBox(b, x0 + W / 2, y + 6.5, z0 + 0.2, Math.min(W - 2, 18), 2.4, [0.1, 0.5, 0.9]);
        addLot(block, tx, tz, tx + tw, tz + td, h); addPlace('tower', { x: front.x, z: front.z, label: sp.label, angle: 0, roofY: y + h, roofX: tx + tw / 2, roofZ: tz + td / 2 });
        lots.push({ x0, z0, x1, z1, h: 6, kind: 'building' }); block.lots.push(lots[lots.length - 1]);
        return;
      }
      case 'hospital':
        h = 16; b.box(x0, y, z0, W, h, D, [1, 1, 1], T.hospital, { uvScale: 12 }); b.box(x0 + W / 2 - 3, y + h, z0 + D / 2 - 3, 6, 1.5, 6, [0.9, 0.9, 0.9]);
        b.box(x0 + W / 2 - 1.5, y + h + 1.5, z0 + D / 2 - 0.4, 3, 0.8, 0.8, [0.9, 0.1, 0.1]); b.box(x0 + W / 2 - 0.4, y + h + 1.5, z0 + D / 2 - 1.5, 0.8, 0.8, 3, [0.9, 0.1, 0.1]);
        b.box(x0 + W / 2 - 4, y + 4.5, z0 - 2.5, 8, 0.4, 2.6, [0.8, 0.8, 0.85]); b.box(x0 + W / 2 - 3, y, z0 - 0.1, 6, 4, 0.2, [0.4, 0.6, 0.8]);
        addPlace('hospital', { x: front.x, z: front.z, label: sp.label, angle: 0 }); break;
      case 'police':
        h = 12; b.box(x0, y, z0, W, h, D, [0.72, 0.78, 0.88], T.concrete, { uvScale: 1 }); b.box(x0 - 0.3, y + h, z0 - 0.3, W + 0.6, 0.8, D + 0.6, [0.35, 0.4, 0.5]);
        b.box(x0 + W / 2 - 2, y, z0 - 0.1, 4, 3.5, 0.2, [0.2, 0.25, 0.4]); signBox(b, x0 + W / 2, y + 5, z0 + 0.3, Math.min(W - 2, 10), 1.4, [0.15, 0.3, 0.8]);
        addPlace('police', { x: front.x, z: front.z, label: sp.label, angle: 0 });
        for (let k = 0; k < 3; k++) parkedSpots.push({ x: x0 + 3 + k * 4, z: z1 - 4, angle: 0, type: 'police' });
        break;
      case 'spray': {
        h = 5; const bayW = 8, bayX = x0 + W / 2 - bayW / 2;
        b.box(x0, y, z0, W, h, D, [0.6, 0.62, 0.66], T.garage, { uvScale: 10 }); b.box(x0 - 0.2, y + h, z0 - 0.2, W + 0.4, 0.5, D + 0.4, [0.3, 0.3, 0.33]);
        signBox(b, x0 + W / 2, y + h + 1.2, z0 + 0.3, Math.min(W - 2, 12), 1.8, [0.95, 0.75, 0.1]);
        // driveway: a gap in the sidewalk (visual only) — marker is at the door on the sidewalk
        b.floor(bayX, z0 - SW - 3, bayW, SW + 3, CURB + 0.02, [1, 1, 1], T.asphalt, 8);
        addPlace('spray', { x: bayX + bayW / 2, z: z0 - 2.4, label: sp.label, angle: 0 }); break;
      }
      case 'guns':
        h = 5; b.box(x0, y, z0, W, h, D, [0.45, 0.45, 0.5], T.shops, { uvScale: 8 }); b.box(x0 - 0.2, y + h, z0 - 0.2, W + 0.4, 0.5, D + 0.4, [0.2, 0.2, 0.22]);
        signBox(b, x0 + W / 2, y + h + 1.2, z0 + 0.3, Math.min(W - 2, 10), 1.6, [0.9, 0.1, 0.1]); b.box(x0 + W / 2 - 3, y + h + 1.2, z0 - 0.4, 6, 1.6, 0.1, [1, 1, 1], T.neon, { faces: 32 });
        addPlace('guns', { x: front.x, z: front.z, label: sp.label, angle: 0 }); break;
    }
    addLot(block, x0, z0, x1, z1, h, sp.kind);
  }
  function signBox(b, cx, y, z, w, h, col) { b.cbox(cx, y, z, w, h, 0.4, col); b.cbox(cx, y, z - 0.25, w * 0.9, h * 0.6, 0.1, [1, 1, 0.9], TEX.names.neon, { faces: 32 }); }

  // ---- Navigation
  const roadNodes = [], roadEdges = [];
  function buildRoads() {
    for (let i = 0; i <= GRID; i++) for (let j = 0; j <= GRID; j++) roadNodes.push({ i, j, x: i * PITCH, z: j * PITCH, out: [] });
    const id = (i, j) => i * (GRID + 1) + j;
    for (const n of roadNodes) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = n.i + di, nj = n.j + dj; if (ni < 0 || ni > GRID || nj < 0 || nj > GRID) continue;
      const to = roadNodes[id(ni, nj)];
      const dx = Math.sign(to.x - n.x), dz = Math.sign(to.z - n.z); const rx = -dz, rz = dx; // right-hand side
      const e = { from: n, to, dx, dz, rx, rz, len: Math.abs(to.x - n.x + to.z - n.z), axis: dx ? 1 : 0 };
      roadEdges.push(e); n.out.push(e);
    }
  }
  // A point on lane k (0 inner, 1 outer) of edge e, at distance s from its start (start = intersection edge).
  function lanePoint(e, k, s) { const off = LANE * (0.5 + k); return [e.from.x + e.dx * (HALF_ROAD + s) + e.rx * off, e.from.z + e.dz * (HALF_ROAD + s) + e.rz * off]; }
  const laneLen = e => e.len - ROAD;

  const walkNodes = [];
  function buildWalks() {
    const key = {};
    const node = (x, z) => { const k = Math.round(x * 10) + ',' + Math.round(z * 10); if (key[k]) return key[k]; const n = { x, z, links: [] }; key[k] = n; walkNodes.push(n); return n; };
    const link = (a, b, cross) => { a.links.push({ to: b, cross }); b.links.push({ to: a, cross }); };
    const h = SW / 2;
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const [bx, bz] = blockOrigin(i, j); const x0 = bx - h, z0 = bz - h, x1 = bx + BLOCK + h, z1 = bz + BLOCK + h;
      const nw = node(x0, z0), ne = node(x1, z0), sw = node(x0, z1), se = node(x1, z1);
      // sidewalk edges with midpoints (so peds can also stand mid-block)
      const mid = (a, b) => { const m = node((a.x + b.x) / 2, (a.z + b.z) / 2); link(a, m, false); link(m, b, false); };
      mid(nw, ne); mid(sw, se); mid(nw, sw); mid(ne, se);
      // crosswalks to neighbouring blocks
      if (i < GRID - 1) { const [nx] = blockOrigin(i + 1, j); link(ne, node(nx - h, z0), true); link(se, node(nx - h, z1), true); }
      if (j < GRID - 1) { const [, nz] = blockOrigin(i, j + 1); link(sw, node(x0, nz - h), true); link(se, node(x1, nz - h), true); }
    }
  }

  // ---- Queries
  function groundY(x, z) {
    // ramps
    for (const r of ramps) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { const t = r.dir === 'n' ? (r.z1 - z) / (r.z1 - r.z0) : (z - r.z0) / (r.z1 - r.z0); return CURB + t * r.h; }
    const gx = (x - HALF_ROAD) / PITCH, gz = (z - HALF_ROAD) / PITCH; // block slab spans [i*PITCH+7, (i+1)*PITCH-7]
    const fx = gx - Math.floor(gx), fz = gz - Math.floor(gz);
    const inX = fx * PITCH < PITCH - ROAD, inZ = fz * PITCH < PITCH - ROAD;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    if (inX && inZ && ix >= 0 && ix < GRID && iz >= 0 && iz < GRID) return CURB;
    return 0;
  }
  const outerBound = () => { const W0 = -HALF_ROAD - SW - SHORE + 1, W1 = SIZE + HALF_ROAD + SW + SHORE - 1; return [W0, W1]; };
  function blockAt(x, z) { const i = Math.floor((x - HALF_ROAD) / PITCH), j = Math.floor((z - HALF_ROAD) / PITCH); return (i >= 0 && i < GRID && j >= 0 && j < GRID) ? blocks[i * GRID + j] : null; }
  // Lots whose AABB may overlap a circle (x, z, r): check the blocks the circle touches.
  function lotsNear(x, z, r) {
    const out = []; const seen = new Set();
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) { const bl = blockAt(x + dx, z + dz); if (bl && !seen.has(bl)) { seen.add(bl); for (const l of bl.lots) out.push(l); } }
    return out;
  }
  function insideLot(x, z) { for (const l of lotsNear(x, z, 0.5)) if (x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1) return l; return null; }
  function onRoad(x, z) { return groundY(x, z) === 0 && x > -HALF_ROAD && x < SIZE + HALF_ROAD && z > -HALF_ROAD && z < SIZE + HALF_ROAD; }
  // Nearest lane point to (x,z) heading roughly along (fx,fz). Returns {e, k, s}.
  function nearestLane(x, z, fx = 0, fz = 0) {
    let best = null, bd = 1e9;
    for (const e of roadEdges) {
      const ax = e.from.x + e.dx * HALF_ROAD, az = e.from.z + e.dz * HALF_ROAD; const L = laneLen(e);
      const s = M.clamp((x - ax) * e.dx + (z - az) * e.dz, 0, L);
      for (let k = 0; k < 2; k++) { const [px, pz] = lanePoint(e, k, s); let d = M.dist2(x, z, px, pz); if (fx || fz) d += (1 - (fx * e.dx + fz * e.dz)) * 40; if (d < bd) { bd = d; best = { e, k, s }; } }
    }
    return best;
  }
  function nearestWalkNode(x, z) { let best = null, bd = 1e9; for (const n of walkNodes) { const d = M.dist2(x, z, n.x, n.z); if (d < bd) { bd = d; best = n; } } return best; }
  function place(kind, idx = 0) { return places[kind] ? places[kind][idx] : null; }
  function nearestPlace(kind, x, z) { let best = null, bd = 1e9; for (const p of (places[kind] || [])) { const d = M.dist2(x, z, p.x, p.z); if (d < bd) { bd = d; best = p; } } return best; }
  function districtName(x, z) { const bl = blockAt(x, z); const i = bl ? bl.i : Math.round(x / PITCH), j = bl ? bl.j : Math.round(z / PITCH); return { downtown: 'Downtown', midtown: 'Midtown', westfield: 'Westfield', northgate: 'Northgate', eastside: 'Eastside', southport: 'Southport' }[district(M.clamp(i, 0, GRID - 1), M.clamp(j, 0, GRID - 1))]; }

  let staticBuilder = null;
  function generate() {
    staticBuilder = buildStatic();
    buildRoads(); buildWalks();
    for (const p of props.lamppost) solidProps.push({ x: p.x, z: p.z, r: 0.2, kind: 'lamppost', ref: p });
    for (const p of props.trafficLight) solidProps.push({ x: p.x, z: p.z, r: 0.2, kind: 'trafficLight', ref: p });
    for (const p of props.hydrant) solidProps.push({ x: p.x, z: p.z, r: 0.25, kind: 'hydrant', ref: p });
    for (const p of props.bin) solidProps.push({ x: p.x, z: p.z, r: 0.35, kind: 'bin', ref: p });
    for (const l of lights) { l.phase = 0; l.t = 0; }
    return staticBuilder;
  }

  return { GRID, BLOCK, ROAD, SW, PITCH, HALF_ROAD, LANE, CURB, SIZE, SHORE, lots, blocks, places, props, solidProps, parkedSpots, ramps, lights, get stunts() { return stunts; },
    roadNodes, roadEdges, walkNodes, generate, groundY, blockAt, lotsNear, insideLot, onRoad, nearestLane, nearestWalkNode, lanePoint, laneLen, place, nearestPlace, district, districtName, blockOrigin, outerBound, rng };
})();
