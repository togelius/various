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
    { i: 1, j: 2, kind: 'bar', label: 'THE HALFWAY' },
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
  const props = { lamppost: [], trafficLight: [], tree: [], hydrant: [], bin: [], bench: [], bollard: [], payphone: [], dumpster: [], mailbox: [], meter: [], newsbox: [], busShelter: [], cone: [], barrier: [], hedge: [], roundTree: [], palm: [], umbrella: [], streetSign: [] };
  const solidProps = []; // {x,z,r,kind,idx}
  const parkedSpots = [];// {x,z,angle}
  const ramps = [];      // {x0,z0,x1,z1,h,dir}
  const lights = [];     // traffic lights: {x,z,phase}
  let stunts = [];

  function addPlace(kind, p) { (places[kind] = places[kind] || []).push(p); }

  // ---- Static geometry
  function buildStatic() {
    const T = TEX.names; const b = new MESH.Builder(); curBuilder = b;
    const C = [1, 1, 1];
    // Water (its own mesh so it can scroll and shine) and shore
    const W0 = -HALF_ROAD - SW - SHORE, W1 = SIZE + HALF_ROAD + SW + SHORE;
    const wb = waterBuilder = new MESH.Builder(); const wc = [0.85, 0.9, 1];
    wb.floor(W0 - 2000, W1 - 2000, 4000 + (W1 - W0), 2000, -1.6, wc, T.water, 24);
    wb.floor(W0 - 2000, W1, 4000 + (W1 - W0), 2000, -1.6, wc, T.water, 24);
    wb.floor(W0 - 2000, W0, 2000, W1 - W0, -1.6, wc, T.water, 24);
    wb.floor(W1, W0, 2000, W1 - W0, -1.6, wc, T.water, 24);
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
      roadEdgesForManholes.push({ x0, z0: zc, x1, z1: zc, ox: 0, oz: rng.pick([-3.5, 3.5]) });
      // sidewalk strips between the block corners, outside the grid, are part of block slabs; extend for edge roads
    }
    for (let i = 0; i <= GRID; i++) for (let j = 0; j < GRID; j++) {
      const z0 = j * PITCH + HALF_ROAD, z1 = (j + 1) * PITCH - HALF_ROAD, xc = i * PITCH;
      b.poly([[xc - HALF_ROAD, 0, z0], [xc - HALF_ROAD, 0, z1], [xc + HALF_ROAD, 0, z1], [xc + HALF_ROAD, 0, z0]], C, T.road, [[0, 0], [0, (z1 - z0) / 16], [1, (z1 - z0) / 16], [1, 0]]);
      roadEdgesForManholes.push({ x0: xc, z0, x1: xc, z1, ox: rng.pick([-3.5, 3.5]), oz: 0 });
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
      // street name signs on a pole at the north-east corner
      if (i < GRID && j > 0) { const T2 = TEX.names; const px = xc + HALF_ROAD + 1.4, pz = zc - HALF_ROAD - 1.4; b.cyl(px, CURB, pz, 0.05, 3.0, [0.3, 0.3, 0.32], 0, 5); const rowA = (j % 16), rowB = ((i + 8) % 16);
        const plate = (x0, z0, x1, z1, row, nx, nz) => { const base = b.n; const v0 = row / 16, v1 = (row + 1) / 16; [[x0, 2.55, z0, 0, v1], [x0, 2.8, z0, 0, v0], [x1, 2.8, z1, 1, v0], [x1, 2.55, z1, 1, v1]].forEach(([x, y, z, u, v]) => b.vert(x, y, z, nx, 0, nz, 1, 1, 1, u, v, T2.signs, 0)); b.quad(base, base + 1, base + 2, base + 3); const b2 = b.n; [[x1, 2.55, z1, 1, v1], [x1, 2.8, z1, 1, v0], [x0, 2.8, z0, 0, v0], [x0, 2.55, z0, 0, v1]].forEach(([x, y, z, u, v]) => b.vert(x, y, z, -nx, 0, -nz, 1, 1, 1, u, v, T2.signs, 0)); b.quad(b2, b2 + 1, b2 + 2, b2 + 3); };
        plate(px - 0.55, pz - 0.05, px + 0.55, pz - 0.05, rowA, 0, -1); plate(px + 0.05, pz + 0.55, px + 0.05, pz - 0.55, rowB, 1, 0); }
      if (inner) {
        lights.push({ x: xc, z: zc, i, j });
        // Four traffic light poles at the corners, arm pointing over the road.
        for (const [cx, cz, ang] of [[1, 1, Math.PI], [-1, -1, 0], [1, -1, -Math.PI / 2], [-1, 1, Math.PI / 2]]) {
          props.trafficLight.push({ x: xc + cx * (HALF_ROAD + 2.3), z: zc + cz * (HALF_ROAD + 2.3), a: ang, light: lights.length - 1, axis: (cx * cz > 0) ? 0 : 1 });
        }
      }
    }
    // manholes on the roads
    for (let k = 0; k < 90; k++) { const e = roadEdgesForManholes[k % roadEdgesForManholes.length]; const t = rng.range(0.15, 0.85); const x = e.x0 + (e.x1 - e.x0) * t, z = e.z0 + (e.z1 - e.z0) * t; b.cyl(x + e.ox, 0, z + e.oz, 0.5, 0.025, [0.22, 0.22, 0.24], T.metal, 10, 0, true, false); }
    // roadworks on one Eastside street: cones, barriers, a dug-up patch
    { const xc = 7 * PITCH + 5.25, z0 = 3 * PITCH + 30; b.floor(xc - 2, z0, 4, 22, 0.012, [0.5, 0.45, 0.4], T.asphalt, 4); b.floor(xc - 1.4, z0 + 3, 2.8, 8, 0.015, [0.15, 0.12, 0.1], T.asphalt, 4);
      for (let k = 0; k <= 22; k += 3.5) { props.cone.push({ x: xc - 2.3, z: z0 + k, a: 0 }); props.cone.push({ x: xc + 2.3, z: z0 + k, a: 0 }); }
      props.barrier.push({ x: xc, z: z0 - 1, a: Math.PI / 2 }, { x: xc, z: z0 + 23, a: Math.PI / 2 }); }
    // the south shore: palms, umbrellas, a wooden pier out over the water
    { const zs = SIZE + HALF_ROAD + SW + 4; for (let x = W0 + 30; x < W1 - 30; x += 26) { props.palm.push({ x: x + rng.range(-6, 6), z: zs + rng.range(2, 8), a: rng.range(0, 6.28), s: rng.range(0.8, 1.2) }); solidProps.push({ x, z: zs + 4, r: 0.3, kind: 'tree' }); if (rng.chance(0.6)) props.umbrella.push({ x: x + rng.range(-8, 8), z: zs + rng.range(10, 18), a: 0 }); if (rng.chance(0.5)) b.floor(x + rng.range(-10, 10), zs + rng.range(9, 19), 1.8, 0.9, 0.01, rng.pick([[0.9, 0.3, 0.3], [0.3, 0.5, 0.9], [0.95, 0.85, 0.3], [0.3, 0.8, 0.6]]), 0, 1); }
      const px0 = pierX0, px1 = pierX1; const pz0 = W1 - 1, pz1 = pierZ1;
      b.floor(px0, pz0, px1 - px0, pz1 - pz0, 0.05, [1, 1, 1], T.planks, 4);
      for (let z = pz0 + 3; z < pz1; z += 6) for (const x of [px0 + 0.5, px1 - 0.5]) { b.cyl(x, -2, z, 0.25, 0.9, [0.35, 0.25, 0.15], 0, 6); b.cyl(x, 0.9, z, 0.06, 1.0, [0.5, 0.5, 0.52], 0, 5); }
      for (const x of [px0 + 0.5, px1 - 0.5]) b.box(x - 0.04, 0.95, pz0, 0.08, 0.06, pz1 - pz0, [0.5, 0.5, 0.52]);
      b.box(px0, 0.05, pz1 - 4, px1 - px0, 0.02, 4, [0.4, 0.3, 0.2]); b.cbox((px0 + px1) / 2, 1.4, pz1 - 2, 3, 2.8, 2.5, [0.55, 0.6, 0.7], T.metal, { uvScale: 2 }); b.box((px0 + px1) / 2 - 1.6, 4.2, pz1 - 3.35, 3.2, 0.15, 3.2, [0.4, 0.3, 0.2]);
      for (let k = 0; k < 6; k++) props.bench.push({ x: px0 + 1.2 + (k % 2) * (px1 - px0 - 2.4), z: pz0 + 8 + Math.floor(k / 2) * 14, a: (k % 2) ? -Math.PI / 2 : Math.PI / 2 });
      addPlace('pier', { x: (px0 + px1) / 2, z: pz1 - 6, label: 'the pier' }); addPlace('marina', { x: (px0 + px1) / 2, z: pz1 - 14, label: 'the marina' });
      marina.push({ x: px1 + 1.7, z: pz1 - 14, angle: 0 }, { x: px1 + 1.7, z: pz1 - 34, angle: 0 }, { x: W0 + 150, z: W1 + 1.7, angle: 0 }); }
    // Blocks
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) buildBlock(b, i, j);
    buildInteriors(b);
    return b;
  }
  const pierX0 = 5 * PITCH + HALF_ROAD + SW + 26, pierX1 = pierX0 + 8, pierZ1 = SIZE + HALF_ROAD + SW + SHORE + 60;
  const marina = []; // moorings for boats: beside the pier and off the beach
  const roadEdgesForManholes = [];

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

    // street furniture by district
    const dist0 = district(i, j); const isTown = dist0 === 'downtown' || dist0 === 'midtown';
    if (isTown) { for (let k = 6; k < BLOCK - 4; k += 7) props.meter.push({ x: bx + k, z: bz + BLOCK + SW - 0.5, a: Math.PI }); }
    if (rng.chance(0.5)) props.mailbox.push({ x: bx - SW + 0.7, z: bz + rng.range(6, 20), a: Math.PI / 2 });
    if (rng.chance(0.6)) { const nx = bx + BLOCK + SW - 0.7; for (let k = 0; k < rng.int(1, 3); k++) props.newsbox.push({ x: nx, z: bz + 2 + k * 0.6, a: -Math.PI / 2 }); }
    if (rng.chance(0.3)) { const sx = bx + rng.range(14, 46); props.busShelter.push({ x: sx, z: bz - SW + 1.4, a: Math.PI }); solidProps.push({ x: sx - 1.9, z: bz - SW + 1.4, r: 0.4, kind: 'shelter' }, { x: sx + 1.9, z: bz - SW + 1.4, r: 0.4, kind: 'shelter' }); }
    const nearPlace = (x, z) => SPECIALS.some(sp => sp.i === i && sp.j === j) && Math.abs(z - (bz - SW)) < 6;
    if (dist0 === 'westfield' || dist0 === 'midtown') { for (let k = 6; k < BLOCK - 4; k += 12) { if (nearPlace(bx + k, bz - SW)) continue; const t = { x: bx + k, z: bz - SW + 0.45, a: rng.range(0, 6.28), s: rng.range(0.8, 1.1) }; (rng.chance(0.5) ? props.roundTree : props.tree).push(t); solidProps.push({ x: t.x, z: t.z, r: 0.4, kind: 'tree' }); } }
    if (dist0 === 'westfield') { for (let k = 4; k < BLOCK - 4; k += 3.2) if (rng.chance(0.8)) props.hedge.push({ x: bx + BLOCK + SW - 1.0, z: bz + k, a: Math.PI / 2 }); }
    if (dist0 === 'eastside' || dist0 === 'southport') { // power poles and wires along the west edge
      let prev = null; for (let k = 2; k < BLOCK; k += 16) { const px = bx - SW + 0.5, pz = bz + k; b.cyl(px, CURB, pz, 0.14, 8, [0.4, 0.3, 0.2], 0, 6); b.cbox(px, CURB + 7.6, pz, 1.6, 0.1, 0.1, [0.4, 0.3, 0.2]); if (prev) for (const ox of [-0.7, 0.7]) b.box(px + ox - 0.015, CURB + 7.55, prev, 0.03, 0.03, pz - prev, [0.1, 0.1, 0.1]); prev = pz; solidProps.push({ x: px, z: pz, r: 0.2, kind: 'pole' }); } }
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
    // dumpsters and rubbish in the alleys between lots
    for (let k = 0; k < rng.int(1, 3); k++) { for (let t = 0; t < 6; t++) { const px = bx + rng.range(2, BLOCK - 2), pz = bz + rng.range(2, BLOCK - 2); const lot = block.lots.find(l => px > l.x0 - 1.2 && px < l.x1 + 1.2 && pz > l.z0 - 1.2 && pz < l.z1 + 1.2); if (lot) continue; const nearWall = block.lots.some(l => px > l.x0 - 2.2 && px < l.x1 + 2.2 && pz > l.z0 - 2.2 && pz < l.z1 + 2.2); if (!nearWall) continue; props.dumpster.push({ x: px, z: pz, a: rng.pick([0, Math.PI / 2]) }); solidProps.push({ x: px, z: pz, r: 0.9, kind: 'dumpster' }); for (let g = 0; g < 3; g++) b.cbox(px + rng.range(-1.6, 1.6), CURB + 0.2, pz + rng.range(-1.4, 1.4), 0.5, 0.4, 0.45, [0.1, 0.1, 0.12]); break; } }
  }

  const FACADES = {
    downtown: ['glass', 'office', 'office', 'deco', 'concrete', 'glass'], midtown: ['office', 'concrete', 'brick', 'deco', 'tenement', 'stone'],
    northgate: ['brick', 'tenement', 'brick', 'concrete', 'stone'], westfield: ['painted', 'brick', 'painted', 'concrete'],
    eastside: ['concrete', 'tenement', 'tenement', 'brick', 'metal'], southport: ['tenement', 'brick', 'painted', 'stone'],
  };
  const FLOORS = { downtown: [14, 42], midtown: [6, 16], northgate: [3, 8], westfield: [2, 5], eastside: [2, 6], southport: [3, 7] };

  function addLot(block, x0, z0, x1, z1, h, kind = 'building') { const l = { x0, z0, x1, z1, h, kind }; lots.push(l); block.lots.push(l); if (kind !== 'wall' && curBuilder) groundAO(curBuilder, x0, z0, x1, z1); return l; }
  // A darkened ring of pavement hugging the building footprint reads as ambient occlusion.
  function groundAO(b, x0, z0, x1, z1) { const T = TEX.names; const w = 0.8, y = CURB + 0.006, c = [0.5, 0.5, 0.52];
    b.floor(x0 - w, z0 - w, (x1 - x0) + 2 * w, w, y, c, T.sidewalk, 8); b.floor(x0 - w, z1, (x1 - x0) + 2 * w, w, y, c, T.sidewalk, 8);
    b.floor(x0 - w, z0, w, z1 - z0, y, c, T.sidewalk, 8); b.floor(x1, z0, w, z1 - z0, y, c, T.sidewalk, 8); }
  let curBuilder = null;

  function buildLot(b, block, x, z, w, d, front) {
    const T = TEX.names; const dist = block.kind;
    const m = rng.range(1.5, 3.5); const x0 = x + m, z0 = z + m, x1 = x + w - m, z1 = z + d - m; const W = x1 - x0, D = z1 - z0;
    const [fmin, fmax] = FLOORS[dist] || [3, 8];
    const floors = rng.int(fmin, fmax); const fh = 3.2; const ground = 4.2;
    const facade = rng.pick(FACADES[dist] || FACADES.midtown);
    const tint = rng.chance(0.3) ? [rng.range(0.7, 1.05), rng.range(0.7, 1.05), rng.range(0.7, 1.05)] : [1, 1, 1].map(v => v * rng.range(0.75, 1.05));
    const trim = tint.map(v => v * 0.82); const y = CURB;
    const commercial = rng.chance(dist === 'downtown' ? 0.6 : 0.75);
    // which side faces the street: the doorway, awning and fire escape go there
    const fz = front === 'n' ? z0 : front === 's' ? z1 : null, fx = front === 'w' ? x0 : front === 'e' ? x1 : null;
    let top = y;
    if (commercial) {
      const shopTile = rng.pick([T.shops0, T.shops1, T.shops2]);
      b.box(x0, y, z0, W, ground, D, tint, shopTile, { faces: 1 | 2 | 16 | 32, uvScale: 8 });
      b.box(x0 - 0.3, y + ground - 0.35, z0 - 0.3, W + 0.6, 0.35, D + 0.6, trim, 0);
      // a real awning over the street side
      if (rng.chance(0.5)) { const ac = [rng.range(0.4, 0.9), rng.range(0.2, 0.6), rng.range(0.2, 0.6)]; const aw = Math.min(W * 0.6, 7);
        if (fz !== null) { const ax = x0 + (W - aw) / 2; const zz = front === 'n' ? z0 - 1.4 : z1; b.wedge(ax, y + 2.6, front === 'n' ? zz : zz + 0.0, aw, 0.5, 1.4, ac, 0); }
        else { const az = z0 + (D - aw) / 2; const xx = front === 'w' ? x0 - 1.4 : x1; b.box(xx, y + 2.6, az, 1.4, 0.35, aw, ac, 0); } }
      // planters by the door downtown
      if (dist === 'downtown' && fz !== null) { const zz = front === 'n' ? z0 - 0.9 : z1 + 0.3; for (const px of [x0 + 1, x1 - 1.6]) { b.box(px, y, zz, 0.6, 0.55, 0.6, [0.4, 0.38, 0.35], T.metal, { uvScale: 2 }); b.floor(px + 0.05, zz + 0.05, 0.5, 0.5, y + 0.56, [1, 1, 1], T.flowers, 0.5); } }
      top = y + ground;
    } else if (fz !== null || fx !== null) {
      // residential doorway: recessed dark door, step, lintel
      const dw = 1.6; if (fz !== null) { const dx = x0 + W / 2 - dw / 2, zz = front === 'n' ? z0 - 0.02 : z1 - 0.2; b.box(dx, y, zz, dw, 2.6, 0.22, [0.15, 0.1, 0.08]); b.box(dx - 0.25, y + 2.6, zz - 0.1, dw + 0.5, 0.25, 0.42, trim); b.box(dx - 0.3, y, front === 'n' ? z0 - 0.7 : z1, dw + 0.6, 0.18, 0.7, trim); }
      else { const dz = z0 + D / 2 - dw / 2, xx = front === 'w' ? x0 - 0.02 : x1 - 0.2; b.box(xx, y, dz, 0.22, 2.6, dw, [0.15, 0.1, 0.08]); b.box(xx - 0.1, y + 2.6, dz - 0.25, 0.42, 0.25, dw + 0.5, trim); }
    }
    const H = floors * fh;
    const facadeOpts = { faces: 1 | 2 | 16 | 32, uvScale: 1, uOff: rng.range(0, 1), vOff: 0 };
    facadeBox(b, x0, top, z0, W, H, D, tint, T[facade], facadeOpts);
    // ledges every floor for the masonry styles, a cornice on top
    if (facade !== 'glass' && facade !== 'metal') for (let k = (commercial ? 0 : 1); k < floors; k++) { const ly = top + k * fh; b.box(x0 - 0.12, ly, z0 - 0.12, W + 0.24, 0.14, D + 0.24, trim, 0, { faces: 1 | 2 | 4 | 16 | 32 }); }
    b.box(x0 - 0.35, top + H - 0.45, z0 - 0.35, W + 0.7, 0.45, D + 0.7, trim, 0);
    // fire escape on brick and tenement fronts
    if ((facade === 'brick' || facade === 'tenement') && floors >= 3 && rng.chance(0.6)) fireEscape(b, x0, z0, x1, z1, top + fh, floors - 1, fh, front);
    // graffiti low on a side wall in the rough districts
    if ((dist === 'eastside' || dist === 'southport') && rng.chance(0.45)) { const gw = Math.min(6, D - 2); const gx = rng.chance(0.5) ? x0 - 0.02 : x1 + 0.02; b.box(gx - 0.01, y + 0.4, z0 + rng.range(1, D - gw - 1), 0.02, 2.2, gw, [1, 1, 1], T.graffiti, { uvScale: gw, faces: gx < x0 + 0.5 ? 2 : 1 }); }
    // roof
    b.floor(x0, z0, W, D, top + H, tint.map(v => v * 0.9), T.roof, 8);
    roofDetails(b, x0, top + H, z0, W, D, tint, floors > 12);
    let totalH = top + H;
    if (floors > 10 && rng.chance(0.5)) {
      const s = rng.range(0.55, 0.8); const tw = W * s, td = D * s, tx = x0 + (W - tw) / 2, tz = z0 + (D - td) / 2, th = rng.int(4, floors) * fh;
      facadeBox(b, tx, top + H, tz, tw, th, td, tint, T[facade], facadeOpts);
      if (facade !== 'glass') for (let k = 1; k < th / fh; k++) b.box(tx - 0.12, top + H + k * fh, tz - 0.12, tw + 0.24, 0.14, td + 0.24, trim, 0, { faces: 1 | 2 | 4 | 16 | 32 });
      b.box(tx - 0.35, top + H + th - 0.45, tz - 0.35, tw + 0.7, 0.45, td + 0.7, trim, 0);
      b.floor(tx, tz, tw, td, top + H + th, tint.map(v => v * 0.9), T.roof, 8);
      roofDetails(b, tx, top + H + th, tz, tw, td, tint, true);
      totalH = top + H + th;
    }
    if (rng.chance(0.2) && floors < 12) {
      const tile = T['bill' + rng.int(0, 5)]; const bw = Math.min(W - 2, 10), bh = bw * 0.6;
      const bxp = x0 + (W - bw) / 2; const bzp = front === 's' ? z1 - 0.5 : z0 + 0.5;
      b.box(bxp, totalH + 1.5, bzp - 0.15, bw, bh, 0.3, [1, 1, 1], tile, { uvScale: bw, faces: 16 | 32 });
      b.box(bxp + 1, totalH, bzp - 0.05, 0.15, 1.5, 0.1, [0.3, 0.3, 0.3]); b.box(bxp + bw - 1, totalH, bzp - 0.05, 0.15, 1.5, 0.1, [0.3, 0.3, 0.3]);
      // floodlights on the billboard
      b.box(bxp + bw * 0.3, totalH + 1.5 + bh, bzp - 0.5, 0.3, 0.15, 0.5, [0.2, 0.2, 0.2]); b.box(bxp + bw * 0.7, totalH + 1.5 + bh, bzp - 0.5, 0.3, 0.15, 0.5, [0.2, 0.2, 0.2]);
    }
    // a neon sign on some shop corners
    if (commercial && rng.chance(0.3)) { const nt = rng.pick([T.neon, T.neonc, T.neony, T.neong]); if (fz !== null) b.box(x0 + rng.range(0.5, W - 3), y + ground + 0.5, front === 'n' ? z0 - 0.6 : z1 + 0.1, 2.4, 0.9, 0.5, [1, 1, 1], nt); else b.box(front === 'w' ? x0 - 0.6 : x1 + 0.1, y + ground + 0.5, z0 + rng.range(0.5, D - 3), 0.5, 0.9, 2.4, [1, 1, 1], nt); }
    addLot(block, x0, z0, x1, z1, totalH);
  }
  function fireEscape(b, x0, z0, x1, z1, y0, floors, fh, front) {
    const c = [0.16, 0.16, 0.18]; const W = x1 - x0; const pw = Math.min(4, W - 2); const px = x0 + (W - pw) / 2;
    const zz = front === 's' ? z1 : z0 - 0.9; const dir = front === 's' ? 1 : -1;
    for (let k = 0; k < floors; k++) {
      const y = y0 + k * fh - 0.1;
      b.box(px, y, zz, pw, 0.08, 0.9, c); // platform
      for (let r = 0; r < 2; r++) b.box(px, y + 0.5 + r * 0.45, zz + (dir > 0 ? 0.85 : 0), pw, 0.04, 0.04, c);
      b.box(px, y, zz + (dir > 0 ? 0.85 : 0), 0.04, 1.0, 0.04, c); b.box(px + pw - 0.04, y, zz + (dir > 0 ? 0.85 : 0), 0.04, 1.0, 0.04, c);
      // stair up to the next platform, as a slanted slab
      if (k < floors - 1) { const sx0 = k % 2 ? px + pw - 0.7 : px, sx1 = k % 2 ? px + pw : px + 0.7; b.poly([[sx0, y + 0.08, zz + 0.9 * (dir > 0 ? 0.2 : 0.8)], [sx0, y + fh, zz + 0.9 * (dir > 0 ? 0.8 : 0.2)], [sx1, y + fh, zz + 0.9 * (dir > 0 ? 0.8 : 0.2)], [sx1, y + 0.08, zz + 0.9 * (dir > 0 ? 0.2 : 0.8)]], c); b.poly([[sx1, y + 0.08, zz + 0.9 * (dir > 0 ? 0.2 : 0.8)], [sx1, y + fh, zz + 0.9 * (dir > 0 ? 0.8 : 0.2)], [sx0, y + fh, zz + 0.9 * (dir > 0 ? 0.8 : 0.2)], [sx0, y + 0.08, zz + 0.9 * (dir > 0 ? 0.2 : 0.8)]], c); }
    }
    b.box(px + pw / 2 - 0.02, y0 - fh + 0.5, zz + 0.4, 0.04, fh - 0.6, 0.04, c); // ladder to the street
  }
  // Box with windows scaled so a window column is ~3.5 units and a row 3.2 units; uv v=0 at the bottom.
  function facadeBox(b, x, y, z, w, h, d, tint, tile, opts) {
    const [r, g, bb] = tint;
    const faceUV = (len) => len / 14;
    const f = (nx, nz, pts, len, flip) => { const base = b.n; const vs = h / 12.8, us = faceUV(len); const uo = opts.uOff || 0;
      pts.forEach((p, k) => { const right = (k === 2 || k === 3) !== !!flip; const u = right ? us : 0, v = (k === 1 || k === 2) ? 0 : vs; /* canvas row 0 is the top of the wall */ b.vert(p[0], p[1], p[2], nx, 0, nz, r, g, bb, u + uo, v, tile, 0); });
      b.quad(base, base + 1, base + 2, base + 3); };
    const x1 = x + w, z1 = z + d, y1 = y + h;
    f(1, 0, [[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], d, true);
    f(-1, 0, [[x, y, z1], [x, y1, z1], [x, y1, z], [x, y, z]], d, true);
    f(0, 1, [[x1, y, z1], [x1, y1, z1], [x, y1, z1], [x, y, z1]], w, true);
    f(0, -1, [[x, y, z], [x, y1, z], [x1, y1, z], [x1, y, z]], w, true);
  }
  function roofDetails(b, x, y, z, w, d, tint, tall) {
    const T = TEX.names; const p = tint.map(v => v * 0.85);
    b.box(x, y, z, w, 0.7, 0.4, p); b.box(x, y, z + d - 0.4, w, 0.7, 0.4, p); b.box(x, y, z, 0.4, 0.7, d, p); b.box(x + w - 0.4, y, z, 0.4, 0.7, d, p);
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) { const aw = rng.range(1.5, 3), ad = rng.range(1.5, 3); const ax = x + rng.range(1, Math.max(1.1, w - aw - 1)), az = z + rng.range(1, Math.max(1.1, d - ad - 1)); b.box(ax, y, az, aw, rng.range(0.8, 1.6), ad, [0.6, 0.6, 0.62], T.metal, { uvScale: 2 }); b.box(ax + 0.2, y + 0.8, az + 0.2, aw - 0.4, 0.05, ad - 0.4, [0.25, 0.25, 0.27]); }
    for (let k = 0; k < rng.int(1, 4); k++) { const vx = x + rng.range(1, w - 1), vz = z + rng.range(1, d - 1); b.cyl(vx, y, vz, 0.25, rng.range(0.8, 1.6), [0.55, 0.55, 0.58], 0, 6); b.cyl(vx, y + 1.2, vz, 0.4, 1.35, [0.45, 0.45, 0.48], 0, 6); }
    if (rng.chance(0.3) && w > 8 && d > 8) { const cx = x + rng.range(3, w - 3), cz = z + rng.range(3, d - 3); for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.cyl(cx + ox, y, cz + oz, 0.08, 2.5, [0.3, 0.3, 0.3], 0, 4); b.cyl(cx, y + 2.5, cz, 1.3, 4.3, [0.45, 0.35, 0.25], 0, 10, 0, true, true); b.cyl(cx, y + 4.3, cz, 1.4, 4.6, [0.35, 0.28, 0.2], 0, 10, 0, true, false, 0.4); }
    if (rng.chance(0.4) && w > 6 && d > 6) { const sx = x + rng.range(1, w - 3.5), sz = z + rng.range(1, d - 3.5); b.box(sx, y, sz, 2.4, 2.6, 2.8, tint.map(v => v * 0.8)); b.box(sx + 0.7, y, sz - 0.05, 1, 2.1, 0.1, [0.2, 0.15, 0.1]); } // roof access shed
    if (rng.chance(0.35)) { const dx = x + rng.range(1, w - 1), dz = z + rng.range(1, d - 1); b.cyl(dx, y, dz, 0.06, 1.2, [0.5, 0.5, 0.5], 0, 4); b.cyl(dx, y + 1.0, dz, 0.7, 1.15, [0.85, 0.85, 0.88], 0, 10, 0, true, true, 0.1); } // dish
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
      (rng.chance(0.5) ? props.roundTree : props.tree).push({ x: tx, z: tz, a: rng.range(0, 6.28), s: rng.range(0.8, 1.3) }); solidProps.push({ x: tx, z: tz, r: 0.5, kind: 'tree' });
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
    // three solid rows of containers with wide lanes between them (a car must never be able to wedge between stacks)
    for (let k = 0; k < 9; k++) { const cx = x + 4 + (k % 3) * 6, cz = z + 4 + Math.floor(k / 3) * 9, n = rng.int(1, 3); for (let s = 0; s < n; s++) b.box(cx, CURB + s * 2.6, cz, 6, 2.6, 2.4, rng.pick(cols), T.metal, { uvScale: 2 }); addLot(block, cx, cz, cx + 6, cz + 2.4, 2.6 * n); }
    b.box(x + 34, CURB, z + 30, 28, 9, 30, [0.6, 0.6, 0.62], T.metal, { uvScale: 3 }); b.box(x + 34 - 0.2, CURB + 9, z + 30 - 0.2, 28.4, 0.6, 30.4, [0.4, 0.4, 0.42]);
    b.box(x + 38, CURB, z + 29.8, 8, 6, 0.3, [0.3, 0.32, 0.36], T.garage, { uvScale: 8 });
    addLot(block, x + 34, z + 30, x + 62, z + 60, 9, 'warehouse');
    // crane
    b.box(x + 8, CURB, z + 44, 2, 18, 2, [0.85, 0.6, 0.1]); b.box(x + 8, CURB + 17, z + 44, 26, 1.2, 1.4, [0.85, 0.6, 0.1]); addLot(block, x + 8, z + 44, x + 10, z + 46, 18);
    addPlace('docks', { x: x + 29, z: z + 20, label: 'PIER 9', angle: 0 }); /* in the open lane between the container stacks and the warehouse */ addPlace('mission2', { x: x + 30, z: z + 4, label: 'OKAFOR', angle: 0 });
    for (let k = 0; k < 4; k++) parkedSpots.push({ x: x + 6 + k * 7, z: z + 29, angle: 0 });
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
        addPlace('safehouse', { x: front.x, z: front.z, label: sp.label, spawnX: front.x, spawnZ: front.z + 0, angle: Math.PI }); specialLots.safehouse = { x0, z0, x1, z1, door: front };
        break;
      case 'bar':
        h = 6.5; b.box(x0, y, z0, W, h, D, [0.55, 0.35, 0.28], T.brick, { uvScale: 12, faces: 63 }); b.box(x0 - 0.3, y + h, z0 - 0.3, W + 0.6, 0.5, D + 0.6, [0.3, 0.22, 0.2]);
        b.box(x0 + W / 2 - 1.1, y, z0 - 0.12, 2.2, 2.8, 0.2, [0.12, 0.1, 0.1]); b.box(x0 + W / 2 - 1.3, y + 2.8, z0 - 0.5, 2.6, 0.3, 0.6, [0.2, 0.15, 0.12]); // door and its hood
        signBox(b, x0 + W / 2, y + h - 1.4, z0 + 0.3, Math.min(W - 2, 9), 1.4, [0.2, 0.5, 0.9]); for (const sx of [-1, 1]) b.cbox(x0 + W / 2 + sx * (W / 2 - 2.5), y + 1.6, z0 - 0.02, 2.2, 1.6, 0.04, [0.7, 0.85, 1], 0, { faces: 32 }); // sign and two windows
        addPlace('bar', { x: front.x, z: front.z, label: sp.label, angle: 0 }); specialLots.bar = { x0, z0, x1, z1, door: front };
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
        b.box(tx + tw / 2 - 1.6, y + h, tz + 0.6, 3.2, 3.2, 3.2, [0.35, 0.36, 0.4]); b.box(tx + tw / 2 - 0.7, y + h, tz + 3.79, 1.4, 2.4, 0.05, [0.12, 0.12, 0.14]); b.cbox(tx + tw / 2, y + h + 0.4, tz + td / 2, 8, 0.03, 8, [0.9, 0.85, 0.2]); b.cbox(tx + tw / 2, y + h + 0.42, tz + td / 2, 6, 0.03, 6, [0.3, 0.3, 0.32]); b.cbox(tx + tw / 2, y + h + 0.44, tz + td / 2, 5.4, 0.03, 5.4, [0.9, 0.85, 0.2]); // elevator shed and a helipad
        for (let k = 0; k < 4; k++) { const ex = k < 2 ? tx + 0.15 : tx + tw - 0.15, ez = tz + 0.15 + (k % 2) * (td - 0.3); b.cyl(ex, y + h, ez, 0.03, y + h + 1.0, [0.5, 0.5, 0.55], 0, 5); } b.box(tx, y + h + 0.95, tz, tw, 0.05, 0.05, [0.5, 0.5, 0.55]); b.box(tx, y + h + 0.95, tz + td - 0.05, tw, 0.05, 0.05, [0.5, 0.5, 0.55]); b.box(tx, y + h + 0.95, tz, 0.05, 0.05, td, [0.5, 0.5, 0.55]); b.box(tx + tw - 0.05, y + h + 0.95, tz, 0.05, 0.05, td, [0.5, 0.5, 0.55]); // a rail you can step over
        roofAccess = { x0: tx, z0: tz, x1: tx + tw, z1: tz + td, h: y + h, outside: { x: front.x + W * 0.32, z: front.z }, top: { x: tx + tw / 2, z: tz + 5.2 }, spots: { pad: { x: tx + tw / 2, z: tz + td / 2 } }, walls: [{ x0: tx + tw / 2 - 1.6, z0: tz + 0.6, x1: tx + tw / 2 + 1.6, z1: tz + 3.8, h: y + h + 3.2, kind: 'wall' }] };
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
        h = 5; b.box(x0, y, z0, W, h, D, [0.45, 0.45, 0.5], T.shops1, { uvScale: 8 }); b.box(x0 - 0.2, y + h, z0 - 0.2, W + 0.4, 0.5, D + 0.4, [0.2, 0.2, 0.22]);
        signBox(b, x0 + W / 2, y + h + 1.2, z0 + 0.3, Math.min(W - 2, 10), 1.6, [0.9, 0.1, 0.1]); b.box(x0 + W / 2 - 3, y + h + 1.2, z0 - 0.4, 6, 1.6, 0.1, [1, 1, 1], T.neon, { faces: 32 });
        addPlace('guns', { x: front.x, z: front.z, label: sp.label, angle: 0 }); break;
    }
    addLot(block, x0, z0, x1, z1, h, sp.kind);
  }
  // ---- Interiors: rooms sixty metres under their own lots, reached through the front door. Each room has the
  // walls the player and camera collide with, the door spot inside, lamps, and the spots the room's menus hang on.
  const specialLots = {}; const interiors = {}; let interiorRoom = null, roofAccess = null, roofLot = null;
  function setInterior(room) { interiorRoom = room; }
  function setRoof(r) { roofLot = r; }
  function buildInteriors(b) {
    const T = TEX.names; const Y = -60; const dark = [0.16, 0.14, 0.13];
    const room = (key, lot, w, d) => { const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2; const x0 = cx - w / 2, z0 = cz - d / 2, x1 = cx + w / 2, z1 = cz + d / 2;
      const r = { key, x0, z0, x1, z1, floorY: Y, cx, cz, walls: [], lights: [], spots: {}, door: { x: cx, z: z0 + 1.2 }, outside: { x: lot.door.x, z: lot.door.z } };
      b.box(x0 - 0.5, Y - 0.2, z0 - 0.5, w + 1, 0.2, d + 1, [0.75, 0.65, 0.5], T.planks, { uvScale: 3 }); b.box(x0 - 0.5, Y + 3.2, z0 - 0.5, w + 1, 0.3, d + 1, [0.35, 0.33, 0.3]);
      const wall = (wx0, wz0, wx1, wz1) => { b.box(wx0, Y, wz0, wx1 - wx0, 3.2, wz1 - wz0, key === 'bar' ? [0.42, 0.3, 0.24] : [0.72, 0.68, 0.58]); b.box(wx0 - 0.01, Y, wz0 - 0.01, wx1 - wx0 + 0.02, 0.9, wz1 - wz0 + 0.02, key === 'bar' ? [0.28, 0.2, 0.15] : [0.45, 0.4, 0.33]); /* plain plaster over a dark dado */ r.walls.push({ x0: wx0, z0: wz0, x1: wx1, z1: wz1, h: Y + 3.2, kind: 'wall' }); };
      wall(x0 - 0.5, z0 - 0.5, x1 + 0.5, z0); wall(x0 - 0.5, z1, x1 + 0.5, z1 + 0.5); wall(x0 - 0.5, z0, x0, z1); wall(x1, z0, x1 + 0.5, z1);
      b.box(cx - 0.9, Y, z0 - 0.45, 1.8, 2.4, 0.15, [0.12, 0.1, 0.1]); b.cbox(cx + 0.6, Y + 1.1, z0 - 0.3, 0.08, 0.08, 0.1, [0.85, 0.8, 0.4]); // the way out
      interiors[key] = r; return r; };
    if (specialLots.bar) { const r = room('bar', specialLots.bar, 15, 10); const { x0, z0, x1, z1, cx, cz } = r;
      b.box(x0 + 1, Y, z1 - 2.6, x1 - x0 - 2, 1.1, 1.0, [0.3, 0.2, 0.14]); b.box(x0 + 0.9, Y + 1.1, z1 - 2.7, x1 - x0 - 1.8, 0.08, 1.2, [0.5, 0.35, 0.22]); r.walls.push({ x0: x0 + 1, z0: z1 - 2.6, x1: x1 - 1, z1: z1 - 1.6, h: Y + 1.2, kind: 'wall' }); // the counter
      b.box(x0 + 1, Y + 1.3, z1 - 0.35, x1 - x0 - 2, 1.6, 0.3, [0.25, 0.18, 0.12]); for (let k = 0; k < 3; k++) b.box(x0 + 1, Y + 1.5 + k * 0.5, z1 - 0.4, x1 - x0 - 2, 0.04, 0.35, [0.6, 0.5, 0.4]); // shelves
      for (let k = 0; k < 18; k++) { const bx = x0 + 1.4 + k * (x1 - x0 - 2.8) / 17, by = Y + 1.54 + (k % 3) * 0.5; const cols = [[0.6, 0.35, 0.1], [0.2, 0.6, 0.3], [0.8, 0.75, 0.5], [0.5, 0.1, 0.1], [0.3, 0.5, 0.9]]; b.cbox(bx, by + 0.12, z1 - 0.22, 0.09, 0.24, 0.09, cols[k % 5]); b.cbox(bx, by + 0.3, z1 - 0.22, 0.04, 0.12, 0.04, cols[k % 5]); } // bottles
      for (let k = 0; k < 5; k++) { const sx = x0 + 2.5 + k * (x1 - x0 - 5) / 4; b.cyl(sx, Y, z1 - 3.4, 0.06, Y + 0.7, [0.3, 0.3, 0.32], 0, 6); b.cyl(sx, Y + 0.7, z1 - 3.4, 0.22, Y + 0.8, [0.5, 0.12, 0.1], 0, 10); } // stools
      for (const [tx, tz] of [[x0 + 3, z0 + 3.5], [cx + 1, z0 + 3.2], [x1 - 3, z0 + 3.8]]) { b.cyl(tx, Y, tz, 0.08, Y + 0.72, dark, 0, 6); b.cyl(tx, Y + 0.72, tz, 0.55, Y + 0.78, [0.4, 0.28, 0.18], 0, 12); for (const [ax, az] of [[0.9, 0], [-0.9, 0], [0, 0.9]]) { b.cbox(tx + ax, Y + 0.24, tz + az, 0.4, 0.06, 0.4, [0.35, 0.25, 0.16]); b.cbox(tx + ax * 1.2, Y + 0.5, tz + az * 1.2, ax ? 0.06 : 0.4, 0.6, az ? 0.06 : 0.4, [0.35, 0.25, 0.16]); } r.walls.push({ x0: tx - 0.6, z0: tz - 0.6, x1: tx + 0.6, z1: tz + 0.6, h: Y + 0.8, kind: 'wall' }); } // tables
      b.box(x1 - 1.6, Y, z0 + 0.2, 1.2, 1.7, 0.7, [0.6, 0.2, 0.15]); b.cbox(x1 - 1.0, Y + 1.2, z0 + 0.9, 0.9, 0.5, 0.05, [1, 0.85, 0.5], T.neon, { faces: 16 }); r.walls.push({ x0: x1 - 1.6, z0: z0, x1: x1 - 0.4, z1: z0 + 0.9, h: Y + 1.7, kind: 'wall' }); // jukebox
      b.cbox(cx, Y + 2.6, z1 - 0.2, 5, 0.9, 0.1, [1, 1, 0.9], T.neon, { faces: 16 }); // the sign over the bar
      for (const lx of [x0 + 4, cx, x1 - 4]) { b.cyl(lx, Y + 2.5, cz, 0.02, Y + 3.2, dark, 0, 4); b.cyl(lx, Y + 2.2, cz, 0.35, Y + 2.5, [0.9, 0.85, 0.6], 0, 8, 0, true, true, 0.12); r.lights.push({ x: lx, y: Y + 2.1, z: cz, r: 9, col: [1.0, 0.8, 0.5] }); }
      r.lights.push({ x: cx, y: Y + 2.4, z: z1 - 1, r: 8, col: [0.9, 0.5, 0.9] }, { x: x1 - 1, y: Y + 1.3, z: z0 + 1, r: 5, col: [1, 0.7, 0.3] });
      r.spots.counter = { x: cx, z: z1 - 3.6 }; r.spots.bartender = { x: cx, z: z1 - 1.0 }; r.spots.jukebox = { x: x1 - 1.0, z: z0 + 1.9 }; r.spots.patrons = [[x0 + 3, z0 + 4.6], [cx + 1.8, z0 + 3.2], [x0 + 3.2, z1 - 3.5]]; }
    if (specialLots.safehouse) { const r = room('safehouse', specialLots.safehouse, 11, 9); const { x0, z0, x1, z1, cx, cz } = r;
      b.box(x1 - 3.2, Y, z1 - 2.3, 2.2, 0.5, 2.1, [0.35, 0.28, 0.2]); b.box(x1 - 3.1, Y + 0.5, z1 - 2.2, 2.0, 0.25, 1.9, [0.75, 0.75, 0.8]); b.cbox(x1 - 2.1, Y + 0.85, z1 - 0.7, 1.4, 0.2, 0.5, [0.95, 0.95, 0.9]); b.box(x1 - 3.2, Y + 0.5, z1 - 2.3, 2.2, 0.35, 0.35, [0.5, 0.3, 0.3]); r.walls.push({ x0: x1 - 3.2, z0: z1 - 2.3, x1: x1 - 1.0, z1: z1 - 0.2, h: Y + 0.8, kind: 'wall' }); // bed
      b.box(x0 + 0.2, Y, z1 - 2.2, 1.0, 2.2, 2.0, [0.3, 0.2, 0.12]); b.cbox(x0 + 1.22, Y + 1.1, z1 - 1.2, 0.02, 2.0, 1.8, [0.4, 0.28, 0.16]); b.cbox(x0 + 1.25, Y + 1.1, z1 - 1.2, 0.03, 0.12, 0.03, [0.85, 0.8, 0.4]); r.walls.push({ x0: x0, z0: z1 - 2.2, x1: x0 + 1.2, z1: z1 - 0.2, h: Y + 2.2, kind: 'wall' }); // wardrobe
      b.box(cx - 1.4, Y, z1 - 0.9, 2.8, 0.7, 0.6, [0.2, 0.18, 0.16]); b.cbox(cx, Y + 1.25, z1 - 0.6, 2.2, 1.1, 0.08, [0.05, 0.05, 0.06]); b.cbox(cx, Y + 1.25, z1 - 0.65, 2.0, 0.95, 0.02, [0.9, 0.95, 1], T.neon, { faces: 32 }); r.walls.push({ x0: cx - 1.4, z0: z1 - 0.9, x1: cx + 1.4, z1: z1 - 0.3, h: Y + 0.7, kind: 'wall' }); // TV on its stand
      b.box(cx - 2.0, Y, z0 + 2.0, 2.4, 0.42, 1.0, [0.3, 0.32, 0.4]); b.box(cx - 2.0, Y + 0.42, z0 + 2.0, 2.4, 0.5, 0.35, [0.3, 0.32, 0.4]); r.walls.push({ x0: cx - 2.0, z0: z0 + 2.0, x1: cx + 0.4, z1: z0 + 3.0, h: Y + 0.9, kind: 'wall' }); // sofa
      b.box(cx - 2.5, Y + 0.001, cz - 1.5, 5, 0.02, 3, [0.55, 0.2, 0.18]); b.box(x0 + 0.2, Y, z0 + 0.3, 1.8, 0.9, 0.5, [0.3, 0.2, 0.12]); b.cbox(x0 + 1.1, Y + 1.5, z0 + 0.4, 1.2, 0.8, 0.05, [0.8, 0.75, 0.6]); // rug, sideboard, a map on the wall
      for (const sx of [1, -1]) b.cbox(cx + sx * 2.2, Y + 1.6, z0 + 0.03, 1.6, 1.2, 0.04, [0.65, 0.75, 0.9], 0, { faces: 32 }); // windows that show nothing but light
      b.cyl(cx, Y + 2.6, cz, 0.02, Y + 3.2, dark, 0, 4); b.cyl(cx, Y + 2.3, cz, 0.4, Y + 2.6, [0.95, 0.9, 0.7], 0, 8, 0, true, true, 0.15); b.cyl(x1 - 0.6, Y, z0 + 0.6, 0.05, Y + 1.5, dark, 0, 5); b.cyl(x1 - 0.6, Y + 1.5, z0 + 0.6, 0.25, Y + 1.8, [0.95, 0.9, 0.7], 0, 8, 0, true, false, 0.18);
      r.lights.push({ x: cx, y: Y + 2.2, z: cz, r: 10, col: [1, 0.9, 0.7] }, { x: x1 - 0.6, y: Y + 1.7, z: z0 + 0.6, r: 6, col: [1, 0.8, 0.5] }, { x: cx, y: Y + 1.3, z: z1 - 1.2, r: 4, col: [0.6, 0.8, 1] });
      r.spots.bed = { x: x1 - 2.1, z: z1 - 1.2 }; r.spots.wardrobe = { x: x0 + 2.0, z: z1 - 1.2 }; r.spots.tv = { x: cx, z: z1 - 2.0 }; }
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
    if (roofLot && x > roofLot.x0 && x < roofLot.x1 && z > roofLot.z0 && z < roofLot.z1) return roofLot.h;
    if (interiorRoom && x > interiorRoom.x0 - 8 && x < interiorRoom.x1 + 8 && z > interiorRoom.z0 - 8 && z < interiorRoom.z1 + 8) return interiorRoom.floorY;
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

  let staticBuilder = null, waterBuilder = null;
  function generate() {
    staticBuilder = buildStatic();
    buildRoads(); buildWalks();
    for (const p of props.lamppost) solidProps.push({ x: p.x, z: p.z, r: 0.2, kind: 'lamppost', ref: p });
    for (const p of props.trafficLight) solidProps.push({ x: p.x, z: p.z, r: 0.2, kind: 'trafficLight', ref: p });
    for (const p of props.hydrant) solidProps.push({ x: p.x, z: p.z, r: 0.25, kind: 'hydrant', ref: p });
    for (const p of props.bin) solidProps.push({ x: p.x, z: p.z, r: 0.35, kind: 'bin', ref: p });
    for (const [k, r] of [['cone', 0.25], ['barrier', 1.0], ['newsbox', 0.3], ['mailbox', 0.35], ['meter', 0.12]]) for (const p of props[k]) solidProps.push({ x: p.x, z: p.z, r, kind: k, ref: p });
    // payphones on four street corners, contracts come through them
    for (const [i, j] of [[1, 6], [6, 1], [8, 7], [4, 3]]) { const [bx, bz] = blockOrigin(i, j); const p = { x: bx - SW + 1.0, z: bz + 6, a: Math.PI / 2 }; props.payphone.push(p); solidProps.push({ x: p.x, z: p.z, r: 0.35, kind: 'payphone', ref: p }); addPlace('phone', { x: p.x + 1.2, z: p.z, label: 'payphone' }); }
    for (const l of lights) { l.phase = 0; l.t = 0; }
    return staticBuilder;
  }

  return { GRID, BLOCK, ROAD, SW, PITCH, HALF_ROAD, LANE, CURB, SIZE, SHORE, lots, blocks, places, props, solidProps, parkedSpots, ramps, lights, get stunts() { return stunts; },
    pier: { x0: pierX0, x1: pierX1, z1: pierZ1 }, marina, interiors, setInterior, get interiorRoom() { return interiorRoom; }, setRoof, get roofLot() { return roofLot; }, get roofAccess() { return roofAccess; }, roadNodes, roadEdges, walkNodes, generate, get water() { return waterBuilder; }, groundY, blockAt, lotsNear, insideLot, onRoad, nearestLane, nearestWalkNode, lanePoint, laneLen, place, nearestPlace, district, districtName, blockOrigin, outerBound, rng };
})();
