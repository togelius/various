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
  const props = { lamppost: [], trafficLight: [], tree: [], hydrant: [], bin: [], bench: [], bollard: [], payphone: [], dumpster: [], mailbox: [], meter: [], newsbox: [], busShelter: [], cone: [], barrier: [], hedge: [], roundTree: [], palm: [], umbrella: [], streetSign: [], cafeSet: [], crates: [], sandwichBoard: [], vending: [], barberPole: [], bikeRack: [], flowerBucket: [], tireStack: [], barrel: [], hotdogCart: [], pigeon: [], gull: [], treeFat: [], treeTall: [], pine: [], pineSmall: [], bush: [], rock: [], tuft: [] };
  const manholes = []; // road spots for the covers and their steam
  const solidProps = []; // {x,z,r,kind,idx}
  const parkedSpots = [];// {x,z,angle}
  const shopfronts = []; // lit shop windows at night: {x, z, nx, nz, w, shut, h, tile}
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
    grassField(b, W0, W0, W1 - W0, W1 - W0, -0.02, T.grass, 8, 22); // the island's ground, greener and drier in patches
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
    // manhole covers along the roads; a few of them steam
    for (let i = 0; i <= GRID; i++) for (let j = 0; j < GRID; j++) { if (!rng.chance(0.5)) continue; const x = i * PITCH + rng.pick([-2.2, 2.2]), z = j * PITCH + HALF_ROAD + SW + rng.range(8, BLOCK - 8); b.floor(x - 0.55, z - 0.55, 1.1, 1.1, 0.012, [1, 1, 1], T.manhole, 1.1); manholes.push({ x, z, steam: rng.chance(0.3) }); }
    for (let j = 0; j <= GRID; j++) for (let i = 0; i < GRID; i++) { if (!rng.chance(0.4)) continue; const z = j * PITCH + rng.pick([-2.2, 2.2]), x = i * PITCH + HALF_ROAD + SW + rng.range(8, BLOCK - 8); b.floor(x - 0.55, z - 0.55, 1.1, 1.1, 0.012, [1, 1, 1], T.manhole, 1.1); manholes.push({ x, z, steam: rng.chance(0.3) }); }
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
    if ((dist0 === 'downtown' || dist0 === 'midtown') && rng.chance(0.35)) { const cx = bx + rng.pick([4, BLOCK - 4]), cz = bz - SW + 1.6; props.hotdogCart.push({ x: cx, z: cz, a: Math.PI / 2 }); solidProps.push({ x: cx, z: cz, r: 0.9, kind: 'cart' }); }
    if (rng.chance(0.3)) { const sx = bx + rng.range(14, 46); props.busShelter.push({ x: sx, z: bz - SW + 1.4, a: Math.PI }); solidProps.push({ x: sx - 1.9, z: bz - SW + 1.4, r: 0.4, kind: 'shelter' }, { x: sx + 1.9, z: bz - SW + 1.4, r: 0.4, kind: 'shelter' }); }
    const nearPlace = (x, z) => SPECIALS.some(sp => sp.i === i && sp.j === j) && Math.abs(z - (bz - SW)) < 6;
    if (dist0 === 'westfield' || dist0 === 'midtown') { for (let k = 6; k < BLOCK - 4; k += 12) { if (nearPlace(bx + k, bz - SW)) continue; const t = { x: bx + k, z: bz - SW + 0.45, a: rng.range(0, 6.28), s: rng.range(0.8, 1.15), tint: rng.chance(0.25) ? rng.pick([[1.1, 0.85, 0.5, 0], [1.15, 0.7, 0.4, 0], [0.85, 1.05, 0.7, 0]]) : [rng.range(0.85, 1.05), rng.range(0.9, 1.1), rng.range(0.85, 1.05), 0] }; rng.pick([props.roundTree, props.tree, props.tree, props.treeTall, props.treeFat]).push(t); solidProps.push({ x: t.x, z: t.z, r: 0.4, kind: 'tree' }); } }
    if (dist0 === 'westfield') { for (let k = 4; k < BLOCK - 4; k += 3.2) if (rng.chance(0.8)) props.hedge.push({ x: bx + BLOCK + SW - 1.0, z: bz + k, a: Math.PI / 2 }); }
    if (dist0 === 'eastside' || dist0 === 'southport') { // power poles and wires along the west edge
      let prev = null; for (let k = 2; k < BLOCK; k += 16) { const px = bx - SW + 0.5, pz = bz + k; b.cyl(px, CURB, pz, 0.14, 8, [0.4, 0.3, 0.2], 0, 6); b.cbox(px, CURB + 7.6, pz, 1.6, 0.1, 0.1, [0.4, 0.3, 0.2]); if (prev) for (const ox of [-0.7, 0.7]) b.box(px + ox - 0.015, CURB + 7.55, prev, 0.03, 0.03, pz - prev, [0.1, 0.1, 0.1]); prev = pz; solidProps.push({ x: px, z: pz, r: 0.2, kind: 'pole' }); } }
    if (typeof STREETS !== 'undefined' && STREETS.build(b,block,{addLot,addPlace,props,parkedSpots,shopfronts,T})) return;
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
    downtown: ['glass', 'office', 'office2', 'deco', 'concrete', 'glass2', 'glass3', 'office2'], midtown: ['office', 'concrete', 'brick', 'deco', 'tenement', 'stone', 'brick2', 'loft', 'office2', 'brick3'],
    northgate: ['brick', 'tenement', 'brick2', 'concrete', 'stone', 'brick3', 'tenement', 'loft'], westfield: ['painted', 'brick3', 'stucco2', 'painted', 'brick2', 'stucco2'],
    eastside: ['concrete', 'tenement', 'warehouse', 'brick2', 'metal', 'loft', 'warehouse', 'tenement'], southport: ['tenement', 'brick2', 'painted', 'stone', 'warehouse', 'stucco2'],
  };
  // which shopfront tiles a district's ground floors are painted with (tools: see the SHOP_TILES list in textures.js; 9 is shuttered)
  const SHOP_POOL = { downtown: [1, 3, 6, 8, 10, 12, 16, 18, 3, 6], midtown: [1, 3, 4, 6, 7, 8, 0, 10, 12, 13, 14, 15, 16], northgate: [0, 2, 4, 5, 9, 11, 13, 17, 19, 20, 2, 5], westfield: [3, 7, 8, 14, 16, 17, 10, 1, 4], eastside: [2, 5, 4, 0, 9, 11, 13, 19, 20, 20, 18], southport: [5, 2, 0, 9, 11, 19, 20, 17, 3] };
  const MASONRY = ['brick', 'brick2', 'brick3', 'tenement', 'stone', 'painted', 'stucco2', 'loft'];
  // Wall tints per district: cool greys downtown, warm brick browns midtown, dark reds up north, creams in the suburbs,
  // ochres east, weathered greys and teals by the water. Saturation is low everywhere; accents come from signs and cars.
  const WALL_TINTS = {
    downtown: [[0.8, 0.82, 0.86], [0.7, 0.72, 0.76], [0.86, 0.85, 0.82], [0.64, 0.68, 0.74], [0.9, 0.9, 0.9]],
    midtown: [[0.82, 0.74, 0.66], [0.74, 0.64, 0.57], [0.86, 0.81, 0.73], [0.68, 0.62, 0.58], [0.8, 0.78, 0.74]],
    northgate: [[0.66, 0.54, 0.48], [0.74, 0.62, 0.54], [0.58, 0.51, 0.48], [0.8, 0.72, 0.64], [0.7, 0.66, 0.6]],
    westfield: [[0.9, 0.87, 0.8], [0.85, 0.83, 0.77], [0.82, 0.8, 0.72], [0.88, 0.85, 0.82], [0.78, 0.8, 0.74]],
    eastside: [[0.72, 0.62, 0.5], [0.64, 0.57, 0.5], [0.76, 0.7, 0.57], [0.6, 0.54, 0.5], [0.7, 0.66, 0.6]],
    southport: [[0.68, 0.7, 0.7], [0.62, 0.66, 0.68], [0.74, 0.72, 0.68], [0.57, 0.6, 0.62], [0.66, 0.7, 0.66]],
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
    // a skyline: heights climb toward the centre of downtown, and a few lots there carry landmark towers with stepped tops and spires
    const cd = Math.hypot(block.i - (GRID - 1) / 2, block.j - (GRID - 1) / 2);
    let floors = rng.int(fmin, fmax); if (dist === 'downtown') floors = Math.round(floors * (1 + 0.5 * Math.max(0, 1 - cd / 1.7)));
    const landmark = dist === 'downtown' && cd < 1.3 && W > 15 && D > 15 && rng.chance(0.25); if (landmark) floors = Math.max(floors, 50);
    const fh = 3.2; const ground = 4.2;
    const facade = rng.pick(FACADES[dist] || FACADES.midtown);
    const tint = rng.pick(WALL_TINTS[dist] || WALL_TINTS.midtown).map(v => v * rng.range(0.92, 1.08)); // each district keeps to a few muted wall colours
    const trim = tint.map(v => v * 0.82); const y = CURB;
    const commercial = rng.chance(dist === 'downtown' ? 0.6 : 0.75);

    // which side faces the street: the doorway, awning and fire escape go there
    const fz = front === 'n' ? z0 : front === 's' ? z1 : null, fx = front === 'w' ? x0 : front === 'e' ? x1 : null;
    let top = y;
    const frontLen = (front === 'n' || front === 's') ? W : D; const frontAngle = front === 'n' ? 0 : front === 's' ? Math.PI : front === 'w' ? Math.PI / 2 : -Math.PI / 2;
    const frontPt = (t, off) => front === 'n' ? [x0 + t, z0 - off] : front === 's' ? [x0 + t, z1 + off] : front === 'w' ? [x0 - off, z0 + t] : [x1 + off, z0 + t];
    const shopTiles = [];
    if (commercial) {
      const pool = SHOP_POOL[dist] || SHOP_POOL.midtown; const shopTile = T['shops' + rng.pick(pool)];
      b.box(x0, y, z0, W, ground, D, tint, shopTile, { faces: 1 | 2 | 16 | 32, uvScale: 8 });
      // the street side is painted in 8 m stretches, each a different pair of shops, so no two doors down a block match
      const outN = front === 'n' ? [0, -1] : front === 's' ? [0, 1] : front === 'w' ? [-1, 0] : [1, 0]; // the way this front faces the street
      // The tile that is drawn keeps consuming the same random numbers and still drives the sidewalk props, so the
      // seeded city is untouched; but painting it twice near itself puts the same pair of shop signs up twice, which
      // is the thing you notice walking a block. What gets painted is therefore allowed to differ from what was
      // drawn: anything already used within 26 m on a wall facing the same way is out, and the replacement comes
      // from a hash of the position, so it costs no random numbers either. The test is by distance rather than by
      // wall, because a frontage runs across several lots and a repeat shows up across a corner or a jog just as
      // plainly as along one straight wall.
      { const uniq = [...new Set(pool)]; let last = -1;
        // A lot in the middle column of a three-wide block is given an east front, but its east wall faces the next lot
        // a few metres away, not a street. The random picks still happen (so the seeded city does not move); only the
        // painting and the recorded shopfront are skipped there.
        const [obx0, obz0] = blockOrigin(block.i, block.j); const onStreet = front === 'n' ? z - obz0 < 0.5 : front === 's' ? obz0 + BLOCK - (z + d) < 0.5 : front === 'w' ? x - obx0 < 0.5 : obx0 + BLOCK - (x + w) < 0.5;
        for (let t = 0; t < frontLen - 0.5; t += 8) { let k = rng.pick(pool); if (k === last) k = rng.pick(pool); last = k; shopTiles.push(k); if (!onStreet) continue;
        const seg = Math.min(8, frontLen - t);
        const [fx2, fz2] = frontPt(t + seg / 2, 0.2);
        const near = new Set();
        for (let q = shopfronts.length - 1; q >= 0; q--) { const o = shopfronts[q];
          if (o.nx !== outN[0] || o.nz !== outN[1]) continue;
          const ddx = o.x - fx2, ddz = o.z - fz2; if (ddx * ddx + ddz * ddz < 26 * 26) near.add(o.tile); }
        let kd = k;
        if (near.has(kd)) { const hh = Math.abs(Math.sin(fx2 * 91.7 + fz2 * 47.3) * 43758.5453) % 1; const st = Math.floor(hh * uniq.length);
          for (let i = 0; i < uniq.length; i++) { const c = uniq[(st + i) % uniq.length]; if (!near.has(c)) { kd = c; break; } } }
        const tl = T['shops' + kd];
        { const h = Math.abs(Math.sin(fx2 * 12.9898 + fz2 * 78.233) * 43758.5453) % 1; /* a hash of the position, so recording shopfronts consumes no city random numbers and leaves every other placement where it was */
          shopfronts.push({ x: fx2, z: fz2, nx: outN[0], nz: outN[1], w: seg, shut: kd === 20, h, tile: kd }); }
        if (front === 'n') b.box(x0 + t, y, z0 - 0.03, seg, ground, 0.03, tint, tl, { faces: 32, uvScale: 8 }); else if (front === 's') b.box(x0 + t, y, z1, seg, ground, 0.03, tint, tl, { faces: 16, uvScale: 8 }); else if (front === 'w') b.box(x0 - 0.03, y, z0 + t, 0.03, ground, seg, tint, tl, { faces: 2, uvScale: 8 }); else b.box(x1, y, z0 + t, 0.03, ground, seg, tint, tl, { faces: 1, uvScale: 8 }); } }
      // A corner lot shows the street two faces, and the second one carried a single tile repeated its whole length:
      // the same two shops over and over down a block. Every side that stands on the edge of the block now gets its own
      // run of fronts, picked from a hash of the position so the seeded city does not move.
      { const [obx, obz] = blockOrigin(block.i, block.j); const uniq = [...new Set(pool)]; const sides = [];
        if (z - obz < 0.5 && front !== 'n') sides.push('n');
        if (obz + BLOCK - (z + d) < 0.5 && front !== 's') sides.push('s');
        if (x - obx < 0.5 && front !== 'w') sides.push('w');
        if (obx + BLOCK - (x + w) < 0.5 && front !== 'e') sides.push('e');
        for (const sd of sides) {
          const len = (sd === 'n' || sd === 's') ? W : D;
          const nrm = sd === 'n' ? [0, -1] : sd === 's' ? [0, 1] : sd === 'w' ? [-1, 0] : [1, 0];
          const at = (t, off) => sd === 'n' ? [x0 + t, z0 - off] : sd === 's' ? [x0 + t, z1 + off] : sd === 'w' ? [x0 - off, z0 + t] : [x1 + off, z0 + t];
          for (let t = 0; t < len - 0.5; t += 8) {
            const seg = Math.min(8, len - t); const [px2, pz2] = at(t + seg / 2, 0.2);
            const near = new Set();
            for (let q = shopfronts.length - 1; q >= 0; q--) { const o = shopfronts[q]; if (o.nx !== nrm[0] || o.nz !== nrm[1]) continue;
              const ddx = o.x - px2, ddz = o.z - pz2; if (ddx * ddx + ddz * ddz < 26 * 26) near.add(o.tile); }
            const st = Math.floor((Math.abs(Math.sin(px2 * 37.1 + pz2 * 17.9) * 43758.5453) % 1) * uniq.length);
            let kd = uniq[st]; for (let i = 0; i < uniq.length; i++) { const c = uniq[(st + i) % uniq.length]; if (!near.has(c)) { kd = c; break; } }
            const h = Math.abs(Math.sin(px2 * 12.9898 + pz2 * 78.233) * 43758.5453) % 1;
            shopfronts.push({ x: px2, z: pz2, nx: nrm[0], nz: nrm[1], w: seg, shut: kd === 20, h, tile: kd });
            const tl = T['shops' + kd];
            if (sd === 'n') b.box(x0 + t, y, z0 - 0.03, seg, ground, 0.03, tint, tl, { faces: 32, uvScale: 8 });
            else if (sd === 's') b.box(x0 + t, y, z1, seg, ground, 0.03, tint, tl, { faces: 16, uvScale: 8 });
            else if (sd === 'w') b.box(x0 - 0.03, y, z0 + t, 0.03, ground, seg, tint, tl, { faces: 2, uvScale: 8 });
            else b.box(x1, y, z0 + t, 0.03, ground, seg, tint, tl, { faces: 1, uvScale: 8 });
          }
        }
      }
      b.box(x0 - 0.3, y + ground - 0.35, z0 - 0.3, W + 0.6, 0.35, D + 0.6, trim, 0);
      // Give the painted shop bays a shallow stone surround so the street catches light and shadow.
      const surround = [0.62, 0.59, 0.52].map((v, i) => v * tint[i]);
      for (let t = 0.12; t < frontLen; t += 4) {
        const [px, pz] = frontPt(t, 0.10);
        b.cbox(px, y + 1.55, pz, fz !== null ? 0.18 : 0.24, 3.1, fz !== null ? 0.24 : 0.18, surround);
      }
      const [sx, sz] = frontPt(frontLen / 2, 0.09);
      b.cbox(sx, y + 0.22, sz, fz !== null ? frontLen : 0.22, 0.20, fz !== null ? 0.22 : frontLen, surround);
      // a real awning over the street side
      if (rng.chance(0.5)) { const ac = [rng.range(0.30, 0.56), rng.range(0.25, 0.42), rng.range(0.22, 0.34)]; const aw = Math.min(W * 0.6, 7);
        if (fz !== null) { const ax = x0 + (W - aw) / 2; const zz = front === 'n' ? z0 - 1.4 : z1; b.wedge(ax, y + 2.6, front === 'n' ? zz : zz + 0.0, aw, 0.5, 1.4, ac, 0); }
        else { const az = z0 + (D - aw) / 2; const xx = front === 'w' ? x0 - 1.4 : x1; b.box(xx, y + 2.6, az, 1.4, 0.35, aw, ac, 0); } }
      // planters by the door downtown
      if (dist === 'downtown' && fz !== null) { const zz = front === 'n' ? z0 - 0.9 : z1 + 0.3; for (const px of [x0 + 1, x1 - 1.6]) { b.box(px, y, zz, 0.6, 0.55, 0.6, [0.4, 0.38, 0.35], T.metal, { uvScale: 2 }); b.floor(px + 0.05, zz + 0.05, 0.5, 0.5, y + 0.56, [1, 1, 1], T.flowers, 0.5); } }
      top = y + ground;
      // sidewalk trade: tables outside the cafes, crates outside the grocers, a board, a rack, a machine, a pole
      const put = (kind, t, off, opts = {}) => { const [px, pz] = frontPt(t, off); props[kind].push({ x: px, z: pz, a: frontAngle + (opts.turn || 0), s: opts.s || 1 }); if (opts.r) solidProps.push({ x: px, z: pz, r: opts.r, kind }); };
      const kinds = TEX.shopKinds; const has = (kind) => shopTiles.some(k => (kinds[k] || []).includes(kind)); const hasAny = (...ks) => ks.some(has);
      if (hasAny('cafe', 'diner', 'bakery') && rng.chance(0.7)) put('cafeSet', frontLen * rng.range(0.2, 0.35), 1.9, { r: 0.7, turn: rng.range(0, 6.28) });
      if (hasAny('bodega', 'liquor', 'florist', 'noodle') && rng.chance(0.7)) put('crates', frontLen * rng.range(0.55, 0.8), 1.1, { r: 0.6 });
      if (has('florist') && rng.chance(0.8)) put('flowerBucket', frontLen * rng.range(0.1, 0.3), 1.0, {});
      if (has('barber') && rng.chance(0.8)) put('barberPole', frontLen * rng.range(0.3, 0.7), 0.15, {});
      if (rng.chance(0.35)) put('sandwichBoard', frontLen * rng.range(0.15, 0.85), 1.6, { r: 0.35, turn: rng.range(-0.4, 0.4) });
      if (hasAny('diner', 'liquor', 'electro', 'laundro') && rng.chance(0.4)) put('vending', frontLen * rng.range(0.1, 0.9), 0.5, { r: 0.5 });
      if ((dist === 'midtown' || dist === 'westfield' || dist === 'downtown') && rng.chance(0.3)) put('bikeRack', frontLen * rng.range(0.1, 0.9), 2.2, { r: 0.5, turn: Math.PI / 2 });
      if (dist === 'eastside' && rng.chance(0.4)) put('tireStack', frontLen * rng.range(0.1, 0.9), 1.0, { r: 0.4 });
      if ((dist === 'eastside' || dist === 'southport') && rng.chance(0.4)) put('barrel', frontLen * rng.range(0.1, 0.9), 0.6, { r: 0.35 });
    } else if (fz !== null || fx !== null) {
      // residential doorway: recessed dark door, step, lintel
      const dw = 1.6; if (fz !== null) { const dx = x0 + W / 2 - dw / 2, zz = front === 'n' ? z0 - 0.02 : z1 - 0.2; b.box(dx, y, zz, dw, 2.6, 0.22, [0.15, 0.1, 0.08]); b.box(dx - 0.25, y + 2.6, zz - 0.1, dw + 0.5, 0.25, 0.42, trim); b.box(dx - 0.3, y, front === 'n' ? z0 - 0.7 : z1, dw + 0.6, 0.18, 0.7, trim); }
      else { const dz = z0 + D / 2 - dw / 2, xx = front === 'w' ? x0 - 0.02 : x1 - 0.2; b.box(xx, y, dz, 0.22, 2.6, dw, [0.15, 0.1, 0.08]); b.box(xx - 0.1, y + 2.6, dz - 0.25, 0.42, 0.25, dw + 0.5, trim); }
      // a stoop with side walls in the tenement districts, a low fence and a strip of garden in the leafy one
      if ((dist === 'northgate' || dist === 'midtown') && fz !== null && rng.chance(0.6)) { const sx = x0 + W / 2 - 1.6, sz = front === 'n' ? z0 - 1.6 : z1; for (let k = 0; k < 3; k++) b.box(sx + 0.3, y + k * 0.22, front === 'n' ? sz + k * 0.5 : sz + (2 - k) * 0.5 + 0.1, 2.6, 0.22, 0.55, trim); b.box(sx, y, sz, 0.3, 0.9, 1.6, trim); b.box(sx + 2.9, y, sz, 0.3, 0.9, 1.6, trim); }
      if (dist === 'westfield' && fz !== null && rng.chance(0.7)) { const zz = front === 'n' ? z0 - 1.6 : z1 + 1.3; const fc = rng.pick([[0.9, 0.9, 0.88], [0.25, 0.2, 0.18], [0.35, 0.45, 0.3]]); for (let t = 0; t <= W; t += 1.2) if (Math.abs(t - W / 2) > 1.4) b.box(x0 + t - 0.04, y, zz, 0.08, 0.9, 0.08, fc); for (const yy of [0.35, 0.8]) { b.box(x0, y + yy, zz + 0.02, W / 2 - 1.4, 0.05, 0.04, fc); b.box(x0 + W / 2 + 1.4, y + yy, zz + 0.02, W / 2 - 1.4, 0.05, 0.04, fc); }
        const gz = front === 'n' ? z0 - 1.45 : z1 + 0.15; b.floor(x0 + 0.1, gz, W / 2 - 1.5, 1.3, y + 0.02, [1, 1, 1], T.grass, 3); b.floor(x0 + W / 2 + 1.4, gz, W / 2 - 1.5, 1.3, y + 0.02, [1, 1, 1], T.grass, 3); for (let k = 0; k < rng.int(1, 3); k++) { const bx = x0 + rng.range(0.6, W - 0.6); if (Math.abs(bx - (x0 + W / 2)) < 1.8) continue; b.floor(bx - 0.4, gz + 0.3, 0.8, 0.6, y + 0.04, [1, 1, 1], T.flowers, 0.8); } }
    }
    const H = floors * fh;
    const facadeOpts = { faces: 1 | 2 | 16 | 32, uvScale: 1, uOff: rng.range(0, 1), vOff: 0 };
    facadeBox(b, x0, top, z0, W, H, D, tint, T[facade], facadeOpts);
    // Stable architectural families: no new random draws, so saved city locations remain unchanged.
    const family = Math.abs(Math.floor(x0 * 17 + z0 * 31)) % 3;
    const masonry = MASONRY.includes(facade) || facade === 'deco';
    const stone = [0.66, 0.63, 0.55].map((v, i) => v * tint[i]);
    const frontBox = (t, yy, width, height, depth, off, color) => {
      const [px, pz] = frontPt(t, off);
      b.cbox(px, yy, pz, fz !== null ? width : depth, height, fz !== null ? depth : width, color);
    };
    // Masonry corners, rhythmic piers and layered cornices cast actual shadows on the facade.
    if (masonry) {
      const pierColor = family === 1 ? stone : trim.map(v => v * 0.75);
      for (const t of [0.20, frontLen - 0.20]) frontBox(t, top + H / 2, 0.48, H, 0.32, 0.06, pierColor);
      if (family === 0 && frontLen > 12) for (let t = 7; t < frontLen - 3; t += 7) frontBox(t, top + H / 2, 0.36, H, 0.28, 0.05, pierColor);
      if (family === 1) for (let k = 0; k < Math.min(floors, 8); k++) for (const t of [0.24, frontLen - 0.24]) {
        frontBox(t, top + k * fh + 0.50, 0.72, 0.38, 0.40, 0.08, stone);
        frontBox(t, top + k * fh + 1.12, 0.50, 0.30, 0.36, 0.08, stone);
      }
      frontBox(frontLen / 2, top + H - 0.78, frontLen + 0.5, 0.18, 0.55, 0.12, stone);
      if (family === 2) for (let t = 0.8; t < frontLen; t += 1.4) frontBox(t, top + H - 0.60, 0.30, 0.26, 0.48, 0.14, stone);
    } else if (facade !== 'metal' && facade !== 'warehouse') {
      // Office facades alternate strong vertical fins with broad horizontal spandrels.
      if (family !== 1) for (let t = 0.25; t < frontLen; t += family === 0 ? 3.5 : 7) frontBox(t, top + H / 2, 0.18, H, 0.52, 0.15, [0.45, 0.49, 0.48]);
      else for (let k = 2; k < floors; k += 3) frontBox(frontLen / 2, top + k * fh, frontLen, 0.50, 0.26, 0.08, [0.35, 0.39, 0.39]);
    }
    // Ledge spacing varies with the facade family instead of wrapping every building at every floor.
    if (masonry || facade === 'concrete') for (let k = (commercial ? 0 : 1); k < floors; k += family === 0 ? 3 : family === 1 ? 2 : 1) { const ly = top + k * fh; b.box(x0 - 0.12, ly, z0 - 0.12, W + 0.24, 0.14, D + 0.24, trim, 0, { faces: 1 | 2 | 4 | 16 | 32 }); }
    // a plinth at the foot of a residential facade (the roofline cornice is built below)
    if (!commercial) b.box(x0 - 0.12, y, z0 - 0.12, W + 0.24, 0.9, D + 0.24, trim.map(v => v * 0.8));
    b.box(x0 - 0.35, top + H - 0.45, z0 - 0.35, W + 0.7, 0.45, D + 0.7, trim, 0);
    // balconies on the masonry fronts, window boxes on the painted ones, air conditioners on the side walls
    const bays = Math.floor(frontLen / 3.5);
    if (MASONRY.includes(facade) && facade !== 'loft' && floors >= 2 && rng.chance(0.5)) { const every = rng.chance(0.5) ? 1 : 2; const rail = trim.map(v => v * 0.6); for (let k = 1; k < floors; k += every) { const ly = top + k * fh + 0.02; for (let i = 0; i < bays; i++) { if (rng.chance(0.3)) continue; const t = (i + 0.5) * frontLen / bays; const [px, pz] = frontPt(t, 0.45);
      if (fz !== null) { b.box(px - 0.8, ly, pz - 0.45, 1.6, 0.1, 0.9, trim); const rz = front === 'n' ? pz - 0.43 : pz + 0.41; b.box(px - 0.8, ly + 0.95, rz, 1.6, 0.04, 0.04, rail); for (let q = 0; q <= 6; q++) b.box(px - 0.8 + q * 0.26, ly + 0.1, rz, 0.03, 0.9, 0.03, rail); for (const sx of [-0.8, 0.77]) { b.box(px + sx, ly + 0.95, front === 'n' ? pz - 0.45 : pz - 0.45, 0.04, 0.04, 0.9, rail); } if (rng.chance(0.3)) b.box(px - 0.3, ly + 0.1, front === 'n' ? pz - 0.2 : pz - 0.1, 0.6, 0.6, 0.35, rng.pick([[0.6, 0.2, 0.2], [0.2, 0.4, 0.6], [0.85, 0.8, 0.7]])); }
      else { b.box(px - 0.45, ly, pz - 0.8, 0.9, 0.1, 1.6, trim); const rx = front === 'w' ? px - 0.43 : px + 0.41; b.box(rx, ly + 0.95, pz - 0.8, 0.04, 0.04, 1.6, rail); for (let q = 0; q <= 6; q++) b.box(rx, ly + 0.1, pz - 0.8 + q * 0.26, 0.03, 0.9, 0.03, rail); } } } }
    if ((facade === 'painted' || facade === 'stucco2' || facade === 'brick3') && floors >= 2 && rng.chance(0.6)) { for (let k = 1; k < Math.min(floors, 4); k++) for (let i = 0; i < bays; i++) { if (rng.chance(0.4)) continue; const t = (i + 0.5) * frontLen / bays; const [px, pz] = frontPt(t, 0.18); const ly = top + k * fh + 0.9; if (fz !== null) { b.box(px - 0.45, ly, pz - 0.15, 0.9, 0.25, 0.3, [0.35, 0.22, 0.12]); b.floor(px - 0.42, pz - 0.13, 0.84, 0.26, ly + 0.26, [1, 1, 1], T.flowers, 0.8); } else { b.box(px - 0.15, ly, pz - 0.45, 0.3, 0.25, 0.9, [0.35, 0.22, 0.12]); b.floor(px - 0.13, pz - 0.42, 0.26, 0.84, ly + 0.26, [1, 1, 1], T.flowers, 0.8); } } }
    if ((facade === 'concrete' || facade === 'tenement' || facade === 'brick2' || facade === 'loft') && rng.chance(0.6)) { for (let k = 0; k < rng.int(2, 6); k++) { const side = rng.pick(['w', 'e']); const fl = rng.int(1, floors - 1); const ay = top + fl * fh + 1.0; const az = z0 + rng.range(1, D - 1); const ax = side === 'w' ? x0 - 0.42 : x1; b.box(ax, ay, az, 0.42, 0.5, 0.6, [0.62, 0.62, 0.6], T.metal, { uvScale: 1 }); b.box(ax - 0.02, ay - 0.1, az - 0.05, 0.46, 0.06, 0.7, [0.3, 0.3, 0.32]); } }
    // a faded painted advertisement high on a blank side wall
    if ((facade === 'brick' || facade === 'brick2' || facade === 'tenement' || facade === 'loft') && floors >= 3 && rng.chance(0.3)) { const gw = Math.min(9, D - 2), gh = Math.min(gw * 0.8, floors * fh - 4); const gx = rng.chance(0.5) ? x0 - 0.02 : x1 + 0.02; b.box(gx - 0.01, top + fh * 1.5, z0 + rng.range(1, D - gw - 1), 0.02, gh, gw, tint, T.ghost, { uvScale: gw, uvScaleV: gh, faces: gx < x0 + 0.5 ? 2 : 1 }); }
    // banners on poles over the office doors downtown
    if (dist === 'downtown' && !commercial && fz !== null && rng.chance(0.5)) { const bk = rng.int(0, 3); for (const t of [frontLen * 0.3, frontLen * 0.7]) { const [px, pz] = frontPt(t, 0); const out = front === 'n' ? -1 : 1; b.tube([px, top + 7, pz], [px, top + 8.4, pz + out * 1.5], 0.04, 0.03, [0.35, 0.36, 0.4], 0, 0, 6); b.box(px - 0.4, top + 5.4, pz + out * 1.45 - 0.03, 0.8, 2.6, 0.06, [1, 1, 1], T.banner, { uvScale: 3.2, uvScaleV: 2.6, uOff: bk * 0.25, faces: 16 | 32 }); } }
    // fire escape on brick and tenement fronts
    if ((facade === 'brick' || facade === 'brick2' || facade === 'tenement' || facade === 'loft') && floors >= 3 && rng.chance(0.6)) fireEscape(b, x0, z0, x1, z1, top + fh, floors - 1, fh, front);
    // graffiti low on a side wall in the rough districts
    if ((dist === 'eastside' || dist === 'southport') && rng.chance(0.45)) { const gw = Math.min(6, D - 2); const gx = rng.chance(0.5) ? x0 - 0.02 : x1 + 0.02; b.box(gx - 0.01, y + 0.4, z0 + rng.range(1, D - gw - 1), 0.02, 2.2, gw, [1, 1, 1], T.graffiti, { uvScale: gw, faces: gx < x0 + 0.5 ? 2 : 1 }); }
    // roof
    b.floor(x0, z0, W, D, top + H, tint.map(v => v * 0.9), T.roof, 8);
    roofDetails(b, x0, top + H, z0, W, D, tint, floors > 12);
    let totalH = top + H;
    if (floors > 10 && (landmark || rng.chance(0.5))) {
      const s = landmark ? 0.72 : rng.range(0.55, 0.8); const tw = W * s, td = D * s, tx = x0 + (W - tw) / 2, tz = z0 + (D - td) / 2, th = rng.int(4, floors) * fh;
      facadeBox(b, tx, top + H, tz, tw, th, td, tint, T[facade], facadeOpts);
      if (facade !== 'glass') for (let k = 1; k < th / fh; k++) b.box(tx - 0.12, top + H + k * fh, tz - 0.12, tw + 0.24, 0.14, td + 0.24, trim, 0, { faces: 1 | 2 | 4 | 16 | 32 });
      b.box(tx - 0.35, top + H + th - 0.45, tz - 0.35, tw + 0.7, 0.45, td + 0.7, trim, 0);
      b.floor(tx, tz, tw, td, top + H + th, tint.map(v => v * 0.9), T.roof, 8);
      roofDetails(b, tx, top + H + th, tz, tw, td, tint, true);
      totalH = top + H + th;
      if (landmark) { // a second, narrower tier and a spire with a beacon
        const t2w = tw * 0.6, t2d = td * 0.6, t2x = tx + (tw - t2w) / 2, t2z = tz + (td - t2d) / 2, t2h = rng.int(5, 9) * fh;
        facadeBox(b, t2x, totalH, t2z, t2w, t2h, t2d, tint, T[facade], facadeOpts); b.box(t2x - 0.35, totalH + t2h - 0.45, t2z - 0.35, t2w + 0.7, 0.45, t2d + 0.7, trim, 0);
        b.floor(t2x, t2z, t2w, t2d, totalH + t2h, tint.map(v => v * 0.9), T.roof, 8); totalH += t2h;
        const cx = t2x + t2w / 2, cz = t2z + t2d / 2; b.box(cx - 0.9, totalH, cz - 0.9, 1.8, 3, 1.8, trim); b.box(cx - 0.35, totalH + 3, cz - 0.35, 0.7, 14, 0.7, trim.map(v => v * 0.85)); b.box(cx - 0.12, totalH + 17, cz - 0.12, 0.24, 6, 0.24, [0.7, 0.7, 0.72]);
        b.cbox(cx, totalH + 23.2, cz, 0.5, 0.5, 0.5, [1, 0.1, 0.1], 0, { bone: 21 }); addPlace('landmark', { x: cx, z: cz, h: totalH + 23, label: 'tower' });
      }
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
    if (rng.chance(tall ? 0.55 : 0.3) && w > 8 && d > 8) { const cx = x + rng.range(3, w - 3), cz = z + rng.range(3, d - 3); for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.cyl(cx + ox, y, cz + oz, 0.08, 2.5, [0.3, 0.3, 0.3], 0, 4); b.cyl(cx, y + 2.5, cz, 1.3, 4.3, [0.45, 0.35, 0.25], 0, 10, 0, true, true); b.cyl(cx, y + 4.3, cz, 1.4, 4.6, [0.35, 0.28, 0.2], 0, 10, 0, true, false, 0.4); }
    if (rng.chance(0.4) && w > 6 && d > 6) { const sx = x + rng.range(1, w - 3.5), sz = z + rng.range(1, d - 3.5); b.box(sx, y, sz, 2.4, 2.6, 2.8, tint.map(v => v * 0.8)); b.box(sx + 0.7, y, sz - 0.05, 1, 2.1, 0.1, [0.2, 0.15, 0.1]); } // roof access shed
    if (rng.chance(0.35)) { const dx = x + rng.range(1, w - 1), dz = z + rng.range(1, d - 1); b.cyl(dx, y, dz, 0.06, 1.2, [0.5, 0.5, 0.5], 0, 4); b.cyl(dx, y + 1.0, dz, 0.7, 1.15, [0.85, 0.85, 0.88], 0, 10, 0, true, true, 0.1); } // dish
    if (tall) { b.box(x + w / 2 - 0.1, y, z + d / 2 - 0.1, 0.2, 6, 0.2, [0.7, 0.7, 0.7]); b.cbox(x + w / 2, y + 6.1, z + d / 2, 0.3, 0.3, 0.3, [1, 0.1, 0.1], 0, { bone: 21 }); }
  }
  // Grass laid as a grid whose colour varies smoothly across it: some of it greener, some dried out. The tint is a
  // two-octave value noise of the world position sampled at each corner, so neighbouring cells agree along their shared
  // edge and the field reads as ground rather than as tiles. It consumes no city random numbers.
  const gHash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  function gNoise(px, pz, cell) {
    const fx = px / cell, fz = pz / cell; const i = Math.floor(fx), j = Math.floor(fz);
    let u = fx - i, v = fz - j; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return (gHash(i, j) * (1 - u) + gHash(i + 1, j) * u) * (1 - v) + (gHash(i, j + 1) * (1 - u) + gHash(i + 1, j + 1) * u) * v;
  }
  function grassField(b, x, z, w, d, y, tile, uvScale, cell) {
    const N = Math.max(2, Math.round(Math.max(w, d) / (cell || 6.4))), sw = w / N, sd = d / N;
    const colAt = (px, pz) => { const n1 = gNoise(px, pz, 26), n2 = gNoise(px + 91, pz - 37, 9);
      const k = 0.82 + n1 * 0.32 + n2 * 0.08; const dry = Math.max(0, n1 * 1.35 - 0.62);
      return [k * (1 + dry * 0.5), k * (1 - dry * 0.05), k * (1 - dry * 0.42)]; };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = x + i * sw, z0 = z + j * sd, x1 = x0 + sw, z1 = z0 + sd;
      const u0 = (i * sw) / uvScale, v0 = (j * sd) / uvScale, u1 = ((i + 1) * sw) / uvScale, v1 = ((j + 1) * sd) / uvScale;
      const c00 = colAt(x0, z0), c01 = colAt(x0, z1), c11 = colAt(x1, z1), c10 = colAt(x1, z0);
      const base = b.n;
      b.vert(x0, y, z0, 0, 1, 0, c00[0], c00[1], c00[2], u0, v0, tile, 0);
      b.vert(x0, y, z1, 0, 1, 0, c01[0], c01[1], c01[2], u0, v1, tile, 0);
      b.vert(x1, y, z1, 0, 1, 0, c11[0], c11[1], c11[2], u1, v1, tile, 0);
      b.vert(x1, y, z0, 0, 1, 0, c10[0], c10[1], c10[2], u1, v0, tile, 0);
      b.quad(base, base + 1, base + 2, base + 3);
    }
  }
  function buildPark(b, block) {
    const T = TEX.names; const { x, z } = block; const C = [1, 1, 1];
    grassField(b, x, z, BLOCK, BLOCK, CURB + 0.01, T.grass, 8);
    // paths in a cross
    b.floor(x + BLOCK / 2 - 2, z, 4, BLOCK, CURB + 0.02, [0.9, 0.9, 0.9], T.sidewalk, 8); b.floor(x, z + BLOCK / 2 - 2, BLOCK, 4, CURB + 0.02, [0.9, 0.9, 0.9], T.sidewalk, 8);
    // fountain on its plaza (an imported model), and a few imported tree clusters among the procedural trees
    MESH.assetInto(b, 'kfountain', { x: x + BLOCK / 2, y: CURB + 0.015, z: z + BLOCK / 2, scale: 11, desat: 0.15 });
    solidProps.push({ x: x + BLOCK / 2, z: z + BLOCK / 2, r: 3.4, kind: 'fountain' });
    for (let k = 0; k < 4; k++) { const cx = x + (k % 2 ? BLOCK * 0.75 : BLOCK * 0.25) + rng.range(-4, 4), cz = z + (k < 2 ? BLOCK * 0.25 : BLOCK * 0.75) + rng.range(-4, 4);
      rng.pick([props.treeTall, props.pine, props.tree]).push({ x: cx, z: cz, a: rng.range(0, 6.28), s: rng.range(0.9, 1.2), tint: [rng.range(0.9, 1.05), rng.range(0.9, 1.1), rng.range(0.9, 1.05), 0] }); solidProps.push({ x: cx, z: cz, r: 0.6, kind: 'tree' }); }
    for (let k = 0; k < 16; k++) {
      let tx, tz, tries = 0; do { tx = x + rng.range(3, BLOCK - 3); tz = z + rng.range(3, BLOCK - 3); tries++; } while (tries < 20 && (Math.abs(tx - x - BLOCK / 2) < 4 || Math.abs(tz - z - BLOCK / 2) < 4 || M.dist(tx, tz, x + BLOCK / 2, z + BLOCK / 2) < 8));
      const species = rng.pick([props.roundTree, props.tree, props.tree, props.treeTall, props.treeFat, props.pine, props.pine, props.pineSmall]);
      species.push({ x: tx, z: tz, a: rng.range(0, 6.28), s: rng.range(0.8, 1.25), tint: [rng.range(0.85, 1.05), rng.range(0.9, 1.12), rng.range(0.85, 1.05), 0] }); solidProps.push({ x: tx, z: tz, r: 0.5, kind: 'tree' });
    }
    for (let k = 0; k < 40; k++) { // tufts of longer grass across the lawn
      const gx = x + rng.range(2, BLOCK - 2), gz = z + rng.range(2, BLOCK - 2);
      if (Math.abs(gx - x - BLOCK / 2) < 3 || Math.abs(gz - z - BLOCK / 2) < 3) continue;
      props.tuft.push({ x: gx, z: gz, a: rng.range(0, 6.28), s: rng.range(0.7, 1.5), tint: [rng.range(0.8, 1.1), rng.range(0.85, 1.15), rng.range(0.8, 1.05), 0] });
    }
    for (let k = 0; k < 14; k++) { // undergrowth between the trees
      const bx2 = x + rng.range(4, BLOCK - 4), bz2 = z + rng.range(4, BLOCK - 4);
      if (Math.abs(bx2 - x - BLOCK / 2) < 4 || Math.abs(bz2 - z - BLOCK / 2) < 4) continue;
      (rng.chance(0.75) ? props.bush : props.rock).push({ x: bx2, z: bz2, a: rng.range(0, 6.28), s: rng.range(0.7, 1.4), tint: [rng.range(0.85, 1.1), rng.range(0.9, 1.1), rng.range(0.85, 1.1), 0] });
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
    const cols = [[.53,.23,.16],[.24,.36,.43],[.24,.39,.32],[.64,.49,.26],[.42,.45,.43]];
    // three solid rows of containers with wide lanes between them (a car must never be able to wedge between stacks)
    for (let k = 0; k < 9; k++) { const cx = x + 4 + (k % 3) * 6, cz = z + 4 + Math.floor(k / 3) * 9, n = rng.int(1, 3); for (let s = 0; s < n; s++) b.append(MESH.shippingContainer(rng.pick(cols)),cx,CURB+s*2.6,cz); addLot(block, cx, cz, cx + 6, cz + 2.4, 2.6 * n); }
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
        h = 6; b.box(x0, y, z0, W, h, D, [0.48, 0.65, 0.61], T.garage, { uvScale: 12 }); b.box(x0 - 0.2, y + h, z0 - 0.2, W + 0.4, 0.5, D + 0.4, [0.35, 0.35, 0.38]);
        b.cbox(x0+W/2,y+h+1.2,z0+.3,12.3,2.1,.4,[.08,.19,.2]);
        b.cbox(x0+W/2,y+h+1.2,z0+.04,12,1.8,.08,[1,1,1],T.vossSign,{faces:32,uvScale:12,uvScaleV:1.8});
        b.box(x0-.35,y+4.5,z0-.55,W+.7,1.1,.65,[.08,.25,.27]);
        b.box(x0-.5,y+4.25,z0-2.3,W+1,.22,2.5,[.94,.68,.29]);
        for (let k=0;k<3;k++) { const bx=x0+2+k*(W-5)/3, bw=(W-5)/3-1;
          b.box(bx,y,z0-.09,bw,3.9,.12,[.12,.17,.18]);
          b.box(bx-.16,y,z0-.2,.16,4.1,.2,[.94,.68,.29]); b.box(bx+bw,y,z0-.2,.16,4.1,.2,[.94,.68,.29]);
          for (let j=1;j<9;j++) b.box(bx,y+j*.43,z0-.23,bw,.035,.035,[.38,.46,.44]);
          b.box(bx+.25,y+3.7,z0-.28,bw-.5,.1,.12,[1,.89,.64]);
        }
        addPlace('garage', { x: front.x, z: front.z, label: sp.label, angle: 0 });
        addPlace('mission', { x: front.x - 6, z: front.z, label: 'MARLA', angle: 0 });
        break;
      case 'bank':
        h = 14; b.box(x0, y, z0, W, h, D, [0.85, 0.82, 0.72], T.concrete, { uvScale: 1, faces: 63 }); for (let k = 0; k < 5; k++) b.cyl(x0 + 3 + k * (W - 6) / 4, y, z0 - 1.2, 0.6, y + 10, [0.9, 0.88, 0.8], 0, 8); b.box(x0 - 0.5, y + 10, z0 - 2.2, W + 1, 1.6, 2.6, [0.9, 0.88, 0.8]); b.box(x0 - 0.8, y + h, z0 - 0.8, W + 1.6, 1.2, D + 1.6, [0.75, 0.72, 0.62]);
        b.box(x0 + W / 2 - 2, y, z0 - 0.1, 4, 4, 0.2, [0.25, 0.2, 0.15]);
        addPlace('bank', { x: front.x, z: front.z, label: sp.label, angle: 0 }); break;
      case 'tower': {
        h = 340; const tw = W * 0.7, td = D * 0.7, tx = x0 + (W - tw) / 2, tz = z0 + (D - td) / 2; // Crane's tower tops the skyline (the generic towers reach ~325 m), so it reads from anywhere as the thing to aim for
        for (let k = 0; k < 4; k++) { const fx = k < 2 ? tx - 0.4 : tx + tw - 0.8, fz = k % 2 ? tz + td - 0.8 : tz - 0.4; b.box(fx, y + h - 34, fz, 1.2, 41, 1.2, [0.42, 0.46, 0.52]); } // corner fins that rise a storey past the roof as a crown
        b.box(x0, y, z0, W, 6, D, [0.3, 0.32, 0.36], T.glass, { uvScale: 14 });
        facadeBox(b, tx, y + 6, tz, tw, h - 6, td, [0.8, 0.9, 1.0], T.glass, { uOff: 0 }); b.floor(tx, tz, tw, td, y + h, [0.3, 0.3, 0.32], T.roof, 8);
        b.box(tx + tw / 2 - 0.2, y + h, tz + td / 2 - 0.2, 0.4, 14, 0.4, [0.8, 0.8, 0.8]); b.cbox(tx + tw / 2, y + h + 14.2, tz + td / 2, 0.7, 0.7, 0.7, [1, 0.1, 0.1], 0, { bone: 21 });
        for (const [bx0, bz0, bw, bd] of [[tx - 0.5, tz - 0.5, tw + 1, 0.4], [tx - 0.5, tz + td + 0.1, tw + 1, 0.4], [tx - 0.5, tz - 0.5, 0.4, td + 1], [tx + tw + 0.1, tz - 0.5, 0.4, td + 1]]) b.box(bx0, y + h - 6, bz0, bw, 1.1, bd, [1, 0.72, 0.36], 0, { bone: 20 }); // Crane's crown: a lit band that marks the tower at night
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
  function groundY(x, z, yHint=0) {
    if (roofLot && x > roofLot.x0 && x < roofLot.x1 && z > roofLot.z0 && z < roofLot.z1) return roofLot.h;
    if (interiorRoom && x > interiorRoom.x0 - 8 && x < interiorRoom.x1 + 8 && z > interiorRoom.z0 - 8 && z < interiorRoom.z1 + 8) return interiorRoom.floorY;
    if (typeof STREETS !== 'undefined') { const h=STREETS.ground(x,z,yHint); if (h>CURB) return h; }
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
  // Lots bucketed on a 24 m grid (a lot sits in every cell it overlaps). The result array is reused: use it before the next call.
  const LG = 24; let lotGrid = null, lotGridN = -1, lotStamp = 0; const lotOut = [];
  function buildLotGrid() { lotGrid = new Map(); for (const l of lots) for (let i = Math.floor(l.x0 / LG); i <= Math.floor(l.x1 / LG); i++) for (let j = Math.floor(l.z0 / LG); j <= Math.floor(l.z1 / LG); j++) { const k = (i + 16) * 4096 + j + 16; let a = lotGrid.get(k); if (!a) lotGrid.set(k, a = []); a.push(l); } lotGridN = lots.length; }
  function lotsNear(x, z, r) {
    if (lotGridN !== lots.length) buildLotGrid(); lotStamp++; lotOut.length = 0;
    for (let i = Math.floor((x - r) / LG); i <= Math.floor((x + r) / LG); i++) for (let j = Math.floor((z - r) / LG); j <= Math.floor((z + r) / LG); j++) { const c = lotGrid.get((i + 16) * 4096 + j + 16); if (c) for (const l of c) if (l._s !== lotStamp) { l._s = lotStamp; lotOut.push(l); } }
    return lotOut;
  }
  function insideLot(x, z) { for (const l of lotsNear(x, z, 0.5)) if (!l.down && !l.passage && !(l.y0>1.8) && x > l.x0 && x < l.x1 && z > l.z0 && z < l.z1) return l; return null; }
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
  function districtName(x, z) { const bl = blockAt(x, z); if(bl && bl.quarter)return bl.quarter; if(blocks.some(b=>b.quarter&&x>=b.x-10&&x<=b.x+BLOCK+10&&z>=b.z-10&&z<=b.z+BLOCK+10))return 'Foundry Quarter'; const i = bl ? bl.i : Math.round(x / PITCH), j = bl ? bl.j : Math.round(z / PITCH); return { downtown: 'Downtown', midtown: 'Midtown', westfield: 'Westfield', northgate: 'Northgate', eastside: 'Eastside', southport: 'Southport' }[district(M.clamp(i, 0, GRID - 1), M.clamp(j, 0, GRID - 1))]; }

  let staticBuilder = null, waterBuilder = null;
  function generate() {
    staticBuilder = buildStatic();
    if(typeof STREETS!=='undefined')STREETS.clearFurniture(props,solidProps);
    buildRoads(); buildWalks(); if(typeof STREETS !== 'undefined') STREETS.connect(walkNodes);
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

  return { GRID, BLOCK, ROAD, SW, PITCH, HALF_ROAD, LANE, CURB, SIZE, SHORE, lots, blocks, places, props, solidProps, parkedSpots, shopfronts, ramps, lights, get stunts() { return stunts; },
    pier: { x0: pierX0, x1: pierX1, z1: pierZ1 }, marina, manholes, interiors, setInterior, get interiorRoom() { return interiorRoom; }, setRoof, get roofLot() { return roofLot; }, get roofAccess() { return roofAccess; }, roadNodes, roadEdges, walkNodes, generate, get water() { return waterBuilder; }, groundY, blockAt, lotsNear, insideLot, onRoad, nearestLane, nearestWalkNode, lanePoint, laneLen, place, nearestPlace, district, districtName, blockOrigin, outerBound, rng };
})();
