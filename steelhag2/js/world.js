// STÅLHAGEN II — the slice's world: the shore road and the substation, the frozen bay, the island shore with
// Sjögården, the snow field and the birches; the towers on the horizon and the hulls standing up out of the ice.
// x runs east, z runs north across the bay, y is up; the ice is y = 0.
'use strict';
const World = (() => {
  const n1 = makeNoise(11), n2 = makeNoise(23), n3 = makeNoise(37);
  const noise2 = (x, z, s) => (fbm(n1, x / s, 3) + fbm(n2, z / s + x / (s * 3.1), 3)) * 0.5;
  const FARM = { x: 0, z: 372 }, SHORE_Z = 318, MAINLAND_Z = 0;
  const S = { items: [], colliders: [], seats: [], vantages: [], triggers: [], birches: [], hulls: [], lamps: [], thinIce: [] };

  // --- terrain --------------------------------------------------------
  function landEdgeMain(x) { return MAINLAND_Z + (noise2(x, 0, 60) - 0.5) * 24; }
  function landEdgeIsle(x) { return SHORE_Z + (noise2(x, 900, 70) - 0.5) * 30 + Math.max(0, 22 - Math.abs(x - 40) * 0.35); }
  function inBay(x, z) { return z > landEdgeMain(x) && z < landEdgeIsle(x); }
  function terrain(x, z) {
    const em = landEdgeMain(x), ei = landEdgeIsle(x);
    let h;
    if (z <= em) { const d = em - z; h = Math.min(d * 0.14, 7) + noise2(x, z, 18) * 1.4 - 0.7; if (Math.abs(x) < 4 && z < -14 && z > -60) h = Math.min(h, 3.2); }
    else if (z >= ei) { const d = z - ei; h = Math.min(d * 0.09, 5) + noise2(x, z, 22) * 1.6 - 0.8; const fx = x - FARM.x, fz = z - FARM.z; const near = Math.hypot(fx, fz); if (near < 28) h = lerp(3.0, h, smooth(14, 28, near)); const hole = Math.hypot(x - 46, z - 402); if (hole < 9) h -= (1 - hole / 9) * 2.2; }
    else h = -0.4;
    return h;
  }
  function groundY(x, z) { const t = terrain(x, z); return inBay(x, z) ? 0 : t; }
  function onIce(x, z) { return inBay(x, z); }
  function thinAt(x, z) { for (const t of S.thinIce) { const d = Math.hypot(x - t.x, z - t.z); if (d < t.r) return 1 - d / t.r; } return 0; }

  // --- helpers --------------------------------------------------------
  const mat = () => M.create();
  function place(mesh, x, y, z, yaw = 0, extra = {}) { const it = { mesh, model: M.trs(mat(), x, y, z, yaw), x, y, z, ...extra }; S.items.push(it); return it; }
  function collide(x0, y0, z0, w, h, d) { S.colliders.push({ x0, y0, z0, x1: x0 + w, y1: y0 + h, z1: z0 + d }); }
  function seat(x, z, yaw, line, camOff, name) { S.seats.push({ x, z, y: groundY(x, z), yaw, line, camOff: camOff || [-6, 2.5, -6], name }); }

  // --- build ----------------------------------------------------------
  function buildTerrain() {
    const b = new Builder(), r = rng32(5);
    const x0 = -420, z0 = -120, w = 900, d = 780, nx = 300, nz = 260;
    b.grid(x0, z0, w, d, nx, nz, terrain, (x, z, y, slope) => {
      if (inBay(x, z)) return [MAT.ICE, [0.8, 0.82, 0.84]];
      const k = 0.9 + noise2(x + 500, z, 9) * 0.2;
      const road = Math.abs(x) < 3.2 && z < -12 && z > -70;
      if (road) return [MAT.ROAD, [0.9, 0.9, 0.9]];
      return [MAT.SNOW, [k, k, k * 1.02]];
    }, { uv: 0.2 });
    place(b.build(), 0, 0, 0, 0, { noShadow: false });
    // the ice sheet: a separate plane at y = 0 with the thin patches darker
    const ice = new Builder();
    ice.grid(-420, -60, 900, 460, 180, 92, (x, z) => inBay(x, z) ? 0 : -8, (x, z) => { const t = thinAt(x, z); const k = 1 - t * 0.55; return [MAT.ICE, [k * 0.9, k * 0.95, k * 1.0]]; }, { uv: 0.35 });
    place(ice.build(), 0, 0.0, 0, 0, { noShadow: true });
  }

  function buildVan() {
    const b = new Builder();
    // a boxy 80s panel van in company yellow
    b.col = [0.95, 0.8, 0.3]; b.tile = MAT.FLAT;
    b.box(-1.0, 0.45, -2.6, 2.0, 1.5, 5.2, { uv: 0.4 }); b.box(-1.0, 1.95, -0.6, 2.0, 0.5, 3.2);
    b.col = [0.2, 0.22, 0.25]; b.tile = MAT.GLASS; b.box(-0.9, 1.05, -2.66, 1.8, 0.7, 0.1); b.box(-1.06, 1.05, -2.2, 0.1, 0.6, 1.0); b.box(0.96, 1.05, -2.2, 0.1, 0.6, 1.0);
    b.col = [1, 1, 1]; b.tile = MAT.DARK; for (const [x, z] of [[-1.05, -1.6], [0.75, -1.6], [-1.05, 1.7], [0.75, 1.7]]) b.cyl(x, 0.45, z, 0.42, 0.3, { axis: 'x', segs: 10 });
    b.col = [0.9, 0.9, 0.9]; b.tile = MAT.STEEL; b.box(-1.05, 0.25, -2.75, 2.1, 0.25, 0.3); b.box(-1.05, 0.25, 2.45, 2.1, 0.25, 0.3);
    const mesh = b.build();
    // hazard lights as their own item so they can blink
    const hz = new Builder(); hz.tile = MAT.LED; hz.col = [1, 0.6, 0.2];
    for (const [x, z] of [[-0.95, -2.7], [0.8, -2.7], [-0.95, 2.62], [0.8, 2.62]]) hz.box(x, 0.85, z, 0.16, 0.1, 0.1);
    return { mesh, hazards: hz.build() };
  }

  function buildSubstation(b) {
    b.col = [1, 1, 1];
    b.tile = MAT.CONCRETE; b.box(-3, 0, -2, 6, 0.3, 4);
    b.tile = MAT.STEEL; b.cyl(-1.6, 0.3, 0, 0.7, 2.2, { segs: 10 }); b.cyl(1.4, 0.3, 0, 0.7, 2.2, { segs: 10 });
    b.tile = MAT.DARK; for (const x of [-1.6, 1.4]) for (const dx of [-0.35, 0, 0.35]) b.cyl(x + dx, 2.5, 0, 0.08, 0.7, { segs: 6 });
    b.tile = MAT.STEEL; b.box(-2.9, 0.3, 1.2, 1.2, 1.5, 0.6); // the meter box
    b.tile = MAT.DARK; b.cyl(2.7, 0, -1.6, 0.14, 8, { segs: 6 }); b.cyl(2.7, 7.4, -1.6, 0.06, 1.6, { axis: 'x', segs: 5 });
    // chain-link posts
    for (const [x, z] of [[-3.6, -2.6], [3.6, -2.6], [-3.6, 2.6], [3.6, 2.6]]) b.cyl(x, 0, z, 0.05, 2.2, { segs: 5 });
    for (const [a, c] of [[[-3.6, -2.6], [3.6, -2.6]], [[3.6, -2.6], [3.6, 2.6]], [[3.6, 2.6], [-3.6, 2.6]], [[-3.6, 2.6], [-3.6, -2.6]]]) for (const h of [0.7, 1.4, 2.1]) b.tube([[a[0], h, a[1]], [c[0], h, c[1]]], 0.015, { segs: 4 });
  }

  function buildHouse(b, w = 9, d = 7, h = 3.2) {
    // Falu-red house with white trim and a lit kitchen window; the door faces south (-z)
    b.col = [1, 1, 1]; b.tile = MAT.RED; b.box(-w / 2, 0, -d / 2, w, h, d, { uv: 0.6 });
    b.tile = MAT.FLAT; b.col = [0.93, 0.92, 0.88];
    for (const x of [-w / 2, w / 2 - 0.12]) for (const z of [-d / 2, d / 2 - 0.12]) b.box(x, 0, z, 0.12, h, 0.12);
    b.box(-w / 2 - 0.05, h - 0.2, -d / 2 - 0.05, w + 0.1, 0.2, d + 0.1);
    // roof
    b.tile = MAT.ROOF; b.col = [1, 1, 1];
    const rh = 2.4, ov = 0.5;
    b.begin();
    for (const side of [-1, 1]) {
      const z0 = side < 0 ? -d / 2 - ov : 0, z1 = side < 0 ? 0 : d / 2 + ov;
      const ya = side < 0 ? h - 0.1 : h + rh, yb = side < 0 ? h + rh : h - 0.1;
      const a = b.vert(-w / 2 - ov, ya, z0, 0, 0.7, side * 0.7, 0, 0), bb = b.vert(w / 2 + ov, ya, z0, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.5, 0);
      const c = b.vert(w / 2 + ov, yb, z1, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.5, 2), dd = b.vert(-w / 2 - ov, yb, z1, 0, 0.7, side * 0.7, 0, 2);
      if (side < 0) b.quad(a, dd, c, bb); else b.quad(a, bb, c, dd);
    }
    b.end(M.create());
    // snow on the roof: a soft white slab either side of the ridge, thicker at the eaves
    b.tile = MAT.SNOW; b.col = [1, 1, 1]; b.begin();
    for (const side of [-1, 1]) {
      const z0 = side < 0 ? -d / 2 - ov : 0.05, z1 = side < 0 ? -0.05 : d / 2 + ov;
      const ya = side < 0 ? h - 0.1 + 0.32 : h + rh + 0.14, yb = side < 0 ? h + rh + 0.14 : h - 0.1 + 0.32;
      const a = b.vert(-w / 2 - ov, ya, z0, 0, 0.7, side * 0.7, 0, 0), bb = b.vert(w / 2 + ov, ya, z0, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.3, 0);
      const c = b.vert(w / 2 + ov, yb, z1, 0, 0.7, side * 0.7, (w + 2 * ov) * 0.3, 1.2), dd = b.vert(-w / 2 - ov, yb, z1, 0, 0.7, side * 0.7, 0, 1.2);
      if (side < 0) b.quad(a, dd, c, bb); else b.quad(a, bb, c, dd);
    }
    b.end(M.create());
    // gable ends
    b.tile = MAT.RED;
    for (const x of [-w / 2, w / 2]) { const n = x < 0 ? -1 : 1; const a = b.vert(x, h, -d / 2, n, 0, 0, 0, 0), bb = b.vert(x, h, d / 2, n, 0, 0, d * 0.6, 0), c = b.vert(x, h + rh, 0, n, 0, 0, d * 0.3, rh * 0.6); if (n > 0) b.i.push(a, bb, c); else b.i.push(a, c, bb); }
    // chimney
    b.tile = MAT.CONCRETE; b.box(w * 0.2, h + rh - 0.8, -0.4, 0.7, 1.6, 0.8);
    // windows: south wall two, west wall one (the kitchen, lit)
    b.tile = MAT.FLAT; b.col = [0.93, 0.92, 0.88];
    for (const x of [-w * 0.3, w * 0.22]) b.box(x - 0.65, 1.0, -d / 2 - 0.06, 1.3, 1.4, 0.08);
    b.box(-w / 2 - 0.06, 1.0, -0.7, 0.08, 1.4, 1.4);
    b.tile = MAT.GLASS; b.col = [0.35, 0.4, 0.45]; for (const x of [-w * 0.3, w * 0.22]) b.box(x - 0.55, 1.1, -d / 2 - 0.09, 1.1, 1.2, 0.06);
    // door and steps
    b.tile = MAT.PLANK; b.col = [0.5, 0.42, 0.34]; b.box(-0.5, 0, -d / 2 - 0.06, 1.0, 2.05, 0.08);
    b.col = [0.7, 0.7, 0.7]; b.box(-1.0, -0.3, -d / 2 - 1.0, 2.0, 0.3, 1.0); b.box(-1.0, -0.6, -d / 2 - 1.5, 2.0, 0.3, 1.5);
    // the cellar hatch on the east side: a sloped plank lid on a concrete frame, and a red bulb over it (the darkroom)
    b.tile = MAT.CONCRETE; b.col = [0.8, 0.8, 0.8]; b.box(w / 2, -0.2, -0.9, 1.5, 0.5, 1.8);
    b.tile = MAT.PLANK; b.col = [0.42, 0.36, 0.3]; b.box(w / 2 + 0.1, 0.3, -0.8, 1.35, 0.12, 1.6); b.box(w / 2 + 0.1, 0.3, -0.05, 1.35, 0.5, 0.1);
    b.tile = MAT.DARK; b.col = [1, 1, 1]; b.box(w / 2 + 0.02, 0.45, -0.1, 0.06, 1.6, 0.06);
  }
  function buildSafelight() { const b = new Builder(); b.tile = MAT.LED; b.col = [1, 0.15, 0.1]; b.sphere(0, 0, 0, 0.09, { segs: 8, rings: 6 }); return b.build(); }
  function buildKitchenWindow() { const b = new Builder(); b.tile = MAT.GLASS; b.col = [1, 0.85, 0.55]; b.box(0, 0, 0, 0.06, 1.2, 1.2); return b.build(); }

  function buildBarn(b, w = 12, d = 8, h = 4.5) {
    b.col = [1, 1, 1]; b.tile = MAT.RED; b.box(-w / 2, 0, -d / 2, w, h, d, { uv: 0.6 });
    b.tile = MAT.ROOF; b.box(-w / 2 - 0.4, h, -d / 2 - 0.4, w + 0.8, 0.3, d + 0.8);
    b.begin(); for (let k = 0; k < 6; k++) b.box(-w / 2 - 0.4, h + 0.3 + k * 0.45, -d / 2 - 0.4 + k * (d + 0.8) / 12, w + 0.8, 0.45, d + 0.8 - k * (d + 0.8) / 6); b.end(M.create());
    b.tile = MAT.DARK; b.box(-1.6, 0, -d / 2 - 0.05, 3.2, 3.0, 0.08);
    b.tile = MAT.SNOW; b.col = [1, 1, 1]; b.box(-w / 2 - 0.45, h + 0.3 + 6 * 0.45, -d / 2 - 0.45 + 6 * (d + 0.8) / 12 - 0.3, w + 0.9, 0.3, d + 0.9 - 6 * (d + 0.8) / 6 + 0.6); for (let k = 0; k < 6; k++) b.box(-w / 2 - 0.45, h + 0.3 + k * 0.45 + 0.42, -d / 2 - 0.45 + k * (d + 0.8) / 12, w + 0.9, 0.12, d + 0.9 - k * (d + 0.8) / 6);
  }

  function buildBench() { const b = new Builder(); b.tile = MAT.PLANK; b.col = [0.8, 0.75, 0.68]; b.box(-0.8, 0.42, -0.2, 1.6, 0.06, 0.4); b.box(-0.8, 0.5, -0.22, 1.6, 0.5, 0.06); b.tile = MAT.DARK; b.col = [1, 1, 1]; for (const x of [-0.7, 0.7]) { b.box(x - 0.04, 0, -0.18, 0.08, 0.42, 0.36); b.box(x - 0.04, 0.42, -0.22, 0.08, 0.6, 0.06); } return b.build(); }

  function buildSled() { const b = new Builder(); b.tile = MAT.PLANK; b.col = [0.7, 0.62, 0.5]; for (const x of [-0.28, 0.24]) b.box(x, 0, -0.7, 0.04, 0.06, 1.4); b.box(-0.3, 0.14, -0.6, 0.6, 0.04, 1.2); for (const z of [-0.5, 0, 0.5]) for (const x of [-0.28, 0.24]) b.box(x, 0.06, z, 0.04, 0.08, 0.04); b.tile = MAT.FOIL; b.col = [1, 1, 1]; b.box(-0.22, 0.18, -0.4, 0.44, 0.22, 0.7); b.tile = MAT.DARK; b.box(-0.2, 0.18, 0.32, 0.4, 0.16, 0.24); return b.build(); }

  function buildHull(h) {
    // a walker hull standing in the bay: a chamfered slab on two legs, seventeen to thirty metres tall
    const b = new Builder(); b.tile = MAT.STEEL; b.col = [0.8, 0.82, 0.8];
    const bw = h * 0.42, bh = h * 0.2, by = h * 0.8;
    b.box(-bw / 2, by, -bw * 0.3, bw, bh, bw * 0.6, { uv: 0.12 });
    b.box(-bw * 0.15, by + bh, -bw * 0.1, bw * 0.3, bh * 0.4, bw * 0.25, { uv: 0.12 });
    for (const [x, s] of [[-bw * 0.2, 1], [bw * 0.18, -1]]) { b.cyl(x, by * 0.45, s * 0.6, h * 0.045, by * 0.55 + 1, { segs: 8 }); b.cyl(x + s * h * 0.06, 0, s * 0.6 + s * 0.4, h * 0.04, by * 0.45, { r1: h * 0.045, segs: 8 }); b.sphere(x + s * h * 0.03, by * 0.45, s * 0.6 + s * 0.2, h * 0.06, { segs: 8, rings: 6 }); b.box(x + s * h * 0.06 - h * 0.08, -0.5, s * 1.0 - h * 0.06, h * 0.16, 0.6, h * 0.12); }
    b.tile = MAT.DARK; b.cyl(-bw * 0.1, by + bh * 1.4, 0, h * 0.006, h * 0.18, { segs: 5 });
    b.tile = MAT.LED; b.col = [1, 1, 1]; b.box(bw * 0.5 - 0.3, by + bh * 0.4, 0.2, 0.3, 0.3, 0.3);
    return b.build();
  }

  function buildTowers(b) {
    b.tile = MAT.CONCRETE; b.col = [0.88, 0.9, 0.9];
    const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; const r = 46 * Math.sqrt(1 + ((t - 0.74) / 0.7) ** 2) / Math.sqrt(1 + (0.74 / 0.7) ** 2) * 0.72; prof.push([r, t * 120]); }
    for (const [x, z, h] of [[0, 0, 1], [95, 30, 1.12], [190, 10, 0.95]]) b.begin().lathe(0, 0, 0, prof.map(([r, y]) => [r * h, y * h]), { segs: 28, uv: 0.02 }).end(M.trs(M.create(), x, 0, z, 0));
  }

  function buildBirch() {
    const b = new Builder(), r = rng32(77); b.tile = MAT.BIRCH; b.col = [1, 1, 1];
    b.cyl(0, 0, 0, 0.16, 7, { r1: 0.05, segs: 7, uv: 0.5 });
    b.tile = MAT.DARK; b.col = [0.35, 0.33, 0.3];
    for (let i = 0; i < 9; i++) { const y = 2.5 + r() * 4, a = r() * TAU, len = 1.2 + r() * 2.2, up = 0.4 + r() * 0.9; b.tube([[0, y, 0], [Math.cos(a) * len * 0.5, y + up * 0.5, Math.sin(a) * len * 0.5], [Math.cos(a) * len, y + up, Math.sin(a) * len]], 0.03 + r() * 0.03, { segs: 4 }); }
    return b.build();
  }
  function buildSpruce() { const b = new Builder(); b.tile = MAT.SPRUCE; b.col = [1, 1, 1]; for (let t = 0; t < 5; t++) b.cyl(0, 1 + t * 1.6, 0, 2.2 - t * 0.4, 2.4, { r1: 0.05, segs: 8 }); b.tile = MAT.DARK; b.cyl(0, 0, 0, 0.15, 1.2, { segs: 5 }); return b.build(); }

  function buildFence(b, pts) {
    b.tile = MAT.PLANK; b.col = [0.55, 0.5, 0.42];
    let prev = null;
    for (const [x, z] of pts) { const y = groundY(x, z); b.cyl(x, y - 0.2, z, 0.05, 1.3, { segs: 5 }); if (prev) for (const h of [0.5, 0.95]) b.tube([[prev[0], prev[2] + h, prev[1]], [x, y + h, z]], 0.012, { segs: 3 }); prev = [x, z, y]; }
  }

  function buildCable(pts) { const b = new Builder(); b.tile = MAT.CABLE; b.col = [1, 1, 1]; b.tube(pts, 0.07, { segs: 6, uv: 0.4 }); return b.build(); }

  function buildMarker() { const b = new Builder(); b.tile = MAT.PLANK; b.col = [0.7, 0.6, 0.5]; b.cyl(0, 0, 0, 0.03, 1.4, { segs: 4 }); b.tile = MAT.FOIL; b.col = [1, 0.2, 0.2]; b.box(-0.06, 1.15, -0.02, 0.12, 0.12, 0.04); return b.build(); }

  function instancesAlong(mesh, list) { const mats = new Float32Array(list.length * 16); list.forEach((p, i) => M.trs(mats.subarray(i * 16, i * 16 + 16), p[0], p[1], p[2], p[3], p[4], p[4], p[4])); GL.instances(mesh, mats); }

  function build() {
    const r = rng32(3);
    S.thinIce.push({ x: -40, z: 150, r: 14 }, { x: 70, z: 210, r: 11 }, { x: 20, z: 90, r: 9 });
    buildTerrain();
    // the mainland: the van, the substation, the road
    const van = buildVan(); const vy = groundY(0, -30);
    place(van.mesh, 0, vy, -30, 0.05); S.van = place(van.hazards, 0, vy, -30, 0.05, { emis: 1 }); collide(-1.3, vy, -33, 2.6, 2.4, 6);
    const sub = new Builder(); buildSubstation(sub); place(sub.build(), -9, groundY(-9, -28), -28, 0.2); collide(-13, 0, -32, 8, 3, 8);
    seat(1.6, -27, Math.PI, 'The van. Roos said to be back before dark. I said I would.', [-4, 2, 5], 'the van');
    // the winter road: reflector sticks every twenty metres across the bay
    const markers = [], mk = buildMarker(); for (let z = 6; z < SHORE_Z - 4; z += 18) markers.push([Math.sin(z * 0.02) * 6 + 1.5, 0, z, 0, 1]); instancesAlong(mk, markers); S.items.push({ mesh: mk, model: M.create(), noShadow: true });
    // the island: Sjögården
    const fy = groundY(FARM.x, FARM.z);
    const house = new Builder(); buildHouse(house); place(house.build(), FARM.x, fy, FARM.z, 0); collide(FARM.x - 4.6, fy, FARM.z - 3.6, 9.2, 5.6, 7.2);
    S.window = place(buildKitchenWindow(), FARM.x - 4.58, fy + 1.0, FARM.z - 1.3, 0, { emis: 1 });
    S.safelight = place(buildSafelight(), FARM.x + 4.55, fy + 2.05, FARM.z - 0.07, 0, { emis: 1, noShadow: true });
    collide(FARM.x + 4.5, fy - 0.2, FARM.z - 0.9, 1.5, 0.6, 1.8);
    S.lamps.push({ x: FARM.x - 5.2, y: fy + 1.8, z: FARM.z - 0.7, r: 9, col: [1.0, 0.72, 0.4], k: 0.9, name: 'window' });
    const barn = new Builder(); buildBarn(barn); place(barn.build(), FARM.x + 22, groundY(FARM.x + 22, FARM.z + 6), FARM.z + 6, 0.3); collide(FARM.x + 15.5, 0, FARM.z + 1.5, 13, 6, 9);
    // the bench by the porch, facing the bay
    place(buildBench(), FARM.x + 5.5, fy, FARM.z - 4.2, Math.PI); seat(FARM.x + 5.5, FARM.z - 4.6, Math.PI, 'The bench by the porch. The window was lit. Nobody was home.', [-7, 3, -7], 'the porch bench');
    // the hole where the slab was, and the cable that runs into it
    const foot = new Builder(); foot.tile = MAT.CONCRETE; foot.col = [0.75, 0.75, 0.72]; foot.box(-1.2, 0, -1.2, 2.4, 0.5, 2.4); place(foot.build(), 46, groundY(46, 402) - 0.2, 402, 0.4);
    const cablePts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; const x = 46 + (i === 0 ? 0 : 0) + t * 90 + Math.sin(t * 9) * 2.5, z = 402 + t * 40 + Math.cos(t * 7) * 2; cablePts.push([x, groundY(x, z) + 0.06, z]); }
    S.cable = place(buildCable(cablePts), 0, 0, 0, 0, { noShadow: true, fx: new Float32Array(RENDER.MAX_BONES * 4) }); S.cable.fx[0] = 0.9;
    // fence along the field
    const fence = new Builder(); const fpts = []; for (let x = -30; x <= 60; x += 5) fpts.push([x, FARM.z + 24 + Math.sin(x * 0.1) * 2]); buildFence(fence, fpts); place(fence.build(), 0, 0, 0, 0);
    // birches and spruces along the shore and the field's edges
    const birch = buildBirch(), spruce = buildSpruce(), bl = [], sl = [];
    for (let i = 0; i < 160; i++) { const x = -160 + r() * 320, z = landEdgeIsle(x) + 4 + r() * 90; if (Math.hypot(x - FARM.x, z - FARM.z) < 26 || Math.hypot(x - 46, z - 402) < 10) continue; (r() < 0.75 ? bl : sl).push([x, groundY(x, z) - 0.3, z, r() * TAU, 0.7 + r() * 0.8]); }
    for (let i = 0; i < 80; i++) { const x = -200 + r() * 400, z = landEdgeMain(x) - 8 - r() * 70; if (Math.abs(x) < 16 && z > -60) continue; (r() < 0.4 ? bl : sl).push([x, groundY(x, z) - 0.3, z, r() * TAU, 0.7 + r() * 0.8]); }
    instancesAlong(birch, bl); instancesAlong(spruce, sl); S.items.push({ mesh: birch, model: M.create() }, { mesh: spruce, model: M.create() });
    S.birches = bl;
    // the towers across the bay, and the mast with its red light
    const tw = new Builder(); buildTowers(tw); place(tw.build(), 620, -2, 640, 0);
    const mast = new Builder(); mast.tile = MAT.DARK; mast.col = [1, 1, 1]; mast.cyl(0, 0, 0, 0.5, 70, { r1: 0.2, segs: 6 }); place(mast.build(), -260, groundY(-260, 420), 420, 0);
    const ml = new Builder(); ml.tile = MAT.LED; ml.col = [1, 0.3, 0.25]; ml.box(-0.4, 70, -0.4, 0.8, 0.8, 0.8); S.mastLight = place(ml.build(), -260, groundY(-260, 420), 420, 0, { emis: 1, noShadow: true });
    // the hulls in the bay: standing, or waiting under the ice until you are halfway across
    for (const [x, z, h, yaw] of [[190, 230, 30, 0.3], [250, 190, 24, -0.4], [320, 260, 34, 0.9], [-230, 250, 20, 1.2]]) { const it = place(buildHull(h), x, -h * 1.05, z, yaw, { noShadow: true, radius: h * 1.2, hull: true }); it.h = h; it.rise = 0; S.hulls.push(it); }
    // the sled
    S.sled = place(buildSled(), 0.8, vy, -26, 0, { noShadow: false });
    // vantage points: places the game asks you to look from
    S.vantages.push({ x: 2, z: -8, key: '1:van', caption: 'The van, with its hazards on, and the whole bay in front of it' });
    S.vantages.push({ x: 4, z: 150, key: '1:bay', caption: 'Halfway across. The towers had stopped breathing.' });
    S.vantages.push({ x: 40, z: 250, key: '1:hulls', caption: 'They had not been cleared away. They had been put in the bay.' });
    S.vantages.push({ x: FARM.x - 12, z: FARM.z - 14, key: '2:house', caption: 'The house, sold, with a window lit' });
    S.vantages.push({ x: 40, z: 396, key: '2:hole', caption: 'Where SV-14 used to lie. Something had been laid into the hole.' });
    // triggers along the way
    S.triggers.push({ x: 0, z: 150, r: 40, id: 'hulls' }, { x: FARM.x, z: SHORE_Z - 6, r: 60, id: 'island' });
    S.door = { x: FARM.x, z: FARM.z - 4.6 };
    S.cellar = { x: FARM.x + 6.4, z: FARM.z };
    return S;
  }

  // Colliders: push a circle out of the AABBs (in xz) if it overlaps them at height y.
  function pushOut(p, radius, y) {
    for (const c of S.colliders) {
      if (y + 1.5 < c.y0 || y > c.y1) continue;
      const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1);
      const dx = p.x - nx, dz = p.z - nz, d = Math.hypot(dx, dz);
      if (d < radius) {
        if (d < 1e-4) { const l = c.x1 - p.x, rr = p.x - c.x0, f = c.z1 - p.z, bk = p.z - c.z0, m = Math.min(l, rr, f, bk); if (m === l) p.x = c.x1 + radius; else if (m === rr) p.x = c.x0 - radius; else if (m === f) p.z = c.z1 + radius; else p.z = c.z0 - radius; }
        else { p.x = nx + dx / d * radius; p.z = nz + dz / d * radius; }
      }
    }
  }
  return { build, S, groundY, terrain, onIce, thinAt, inBay, pushOut, FARM, SHORE_Z, landEdgeIsle, landEdgeMain };
})();
