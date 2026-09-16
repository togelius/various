// GRIFT CITY — geometry builders. Everything is boxes, wedges and low-poly cylinders with vertex colours.
'use strict';
const MESH = (() => {
  const T = () => TEX.names;
  class Builder {
    constructor() { this.v = []; this.i = []; this.n = 0; }
    vert(x, y, z, nx, ny, nz, r, g, b, u, v, tile, bone) { this.v.push(x, y, z, nx, ny, nz, r, g, b, u, v, tile, bone); return this.n++; }
    quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
    tri(a, b, c) { this.i.push(a, b, c); }
    // Axis-aligned box from min corner + size. faces: bitmask of which faces to emit (default all). uv in world units / uvScale.
    box(x, y, z, w, h, d, col, tile = 0, opts = {}) {
      const { bone = 0, faces = 63, uvScale = 1, uOff = 0, vOff = 0, tint = null, topTile = -1, sideTile = -1 } = opts;
      const [r, g, b] = col; const x1 = x + w, y1 = y + h, z1 = z + d; const s = 1 / uvScale;
      const tt = topTile >= 0 ? topTile : tile, st = sideTile >= 0 ? sideTile : tile;
      const f = (nx, ny, nz, p, tl, uvs) => {
        const base = this.n;
        for (let k = 0; k < 4; k++) this.vert(p[k][0], p[k][1], p[k][2], nx, ny, nz, r, g, b, uvs[k][0] * s + uOff, uvs[k][1] * s + vOff, tl, bone);
        this.quad(base, base + 1, base + 2, base + 3);
      };
      // +x
      if (faces & 1) f(1, 0, 0, [[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], st, [[0, 0], [0, h], [d, h], [d, 0]]);
      // -x
      if (faces & 2) f(-1, 0, 0, [[x, y, z1], [x, y1, z1], [x, y1, z], [x, y, z]], st, [[0, 0], [0, h], [d, h], [d, 0]]);
      // +y (top)
      if (faces & 4) f(0, 1, 0, [[x, y1, z], [x, y1, z1], [x1, y1, z1], [x1, y1, z]], tt, [[0, 0], [0, d], [w, d], [w, 0]]);
      // -y
      if (faces & 8) f(0, -1, 0, [[x, y, z1], [x, y, z], [x1, y, z], [x1, y, z1]], tt, [[0, 0], [0, d], [w, d], [w, 0]]);
      // +z
      if (faces & 16) f(0, 0, 1, [[x1, y, z1], [x1, y1, z1], [x, y1, z1], [x, y, z1]], st, [[0, 0], [0, h], [w, h], [w, 0]]);
      // -z
      if (faces & 32) f(0, 0, -1, [[x, y, z], [x, y1, z], [x1, y1, z], [x1, y, z]], st, [[0, 0], [0, h], [w, h], [w, 0]]);
      return this;
    }
    // Box centred at (cx,cy,cz) — handy for vehicle parts.
    cbox(cx, cy, cz, w, h, d, col, tile = 0, opts = {}) { return this.box(cx - w / 2, cy - h / 2, cz - d / 2, w, h, d, col, tile, opts); }
    // Horizontal quad (floor) with explicit uv range.
    floor(x, z, w, d, y, col, tile, uvScale = 1, opts = {}) {
      const [r, g, b] = col; const base = this.n; const { u0 = 0, v0 = 0, u1 = w / uvScale, v1 = d / uvScale, bone = 0 } = opts;
      this.vert(x, y, z, 0, 1, 0, r, g, b, u0, v0, tile, bone); this.vert(x, y, z + d, 0, 1, 0, r, g, b, u0, v1, tile, bone);
      this.vert(x + w, y, z + d, 0, 1, 0, r, g, b, u1, v1, tile, bone); this.vert(x + w, y, z, 0, 1, 0, r, g, b, u1, v0, tile, bone);
      this.quad(base, base + 1, base + 2, base + 3); return this;
    }
    // Arbitrary quad from 4 points (counter-clockwise seen from the front), flat normal.
    poly(pts, col, tile = 0, uvs = null, bone = 0) {
      const [r, g, b] = col; const [ax, ay, az] = pts[0], [bx, by, bz] = pts[1], [cx, cy, cz] = pts[2];
      let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const base = this.n; pts.forEach((p, k) => this.vert(p[0], p[1], p[2], nx, ny, nz, r, g, b, uvs ? uvs[k][0] : 0, uvs ? uvs[k][1] : 0, tile, bone));
      if (pts.length === 4) this.quad(base, base + 1, base + 2, base + 3); else for (let k = 1; k + 1 < pts.length; k++) this.tri(base, base + k, base + k + 1);
      return this;
    }
    // Wedge/ramp: box whose top slopes from y+h at z (back) down to y at z+d (front) — axis-aligned.
    wedge(x, y, z, w, h, d, col, tile = 0, bone = 0) {
      const x1 = x + w, z1 = z + d, y1 = y + h;
      this.poly([[x, y1, z], [x, y, z1], [x1, y, z1], [x1, y1, z]], col, tile, [[0, 0], [0, d], [w, d], [w, 0]], bone); // slope
      this.poly([[x, y, z], [x, y1, z], [x1, y1, z], [x1, y, z]], col, tile, null, bone); // back wall (-z)
      this.poly([[x, y, z1], [x, y1, z], [x, y, z]], col, tile, null, bone); // -x side
      this.poly([[x1, y, z], [x1, y1, z], [x1, y, z1]], col, tile, null, bone); // +x side
      return this;
    }
    // Cylinder along y, centred at (cx, cz), from y0 to y1.
    cyl(cx, y0, cz, r, y1, col, tile = 0, segs = 8, bone = 0, capTop = true, capBot = false, r1 = r) {
      const [cr, cg, cb] = col; const base = this.n;
      for (let k = 0; k <= segs; k++) {
        const a = k / segs * M.TAU, nx = Math.cos(a), nz = Math.sin(a);
        this.vert(cx + nx * r, y0, cz + nz * r, nx, 0, nz, cr, cg, cb, k / segs * 3, 0, tile, bone);
        this.vert(cx + nx * r1, y1, cz + nz * r1, nx, 0, nz, cr, cg, cb, k / segs * 3, (y1 - y0), tile, bone);
      }
      for (let k = 0; k < segs; k++) { const b = base + k * 2; this.quad(b, b + 1, b + 3, b + 2); }
      if (capTop) { const c = this.vert(cx, y1, cz, 0, 1, 0, cr, cg, cb, 0, 0, tile, bone); for (let k = 0; k < segs; k++) { const a0 = k / segs * M.TAU, a1 = (k + 1) / segs * M.TAU; const p0 = this.vert(cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1, 0, 1, 0, cr, cg, cb, 0, 0, tile, bone), p1 = this.vert(cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1, 0, 1, 0, cr, cg, cb, 0, 0, tile, bone); this.tri(c, p1, p0); } }
      if (capBot) { const c = this.vert(cx, y0, cz, 0, -1, 0, cr, cg, cb, 0, 0, tile, bone); for (let k = 0; k < segs; k++) { const a0 = k / segs * M.TAU, a1 = (k + 1) / segs * M.TAU; const p0 = this.vert(cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r, 0, -1, 0, cr, cg, cb, 0, 0, tile, bone), p1 = this.vert(cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r, 0, -1, 0, cr, cg, cb, 0, 0, tile, bone); this.tri(c, p0, p1); } }
      return this;
    }
    // Wheel: cylinder along x axis centred at (cx,cy,cz), radius r, width w.
    wheel(cx, cy, cz, r, w, bone, segs = 10) {
      const tyre = [0.08, 0.08, 0.09], rim = [0.75, 0.75, 0.78]; const base = this.n; const x0 = cx - w / 2, x1 = cx + w / 2;
      for (let k = 0; k <= segs; k++) {
        const a = k / segs * M.TAU, ny = Math.cos(a), nz = Math.sin(a);
        this.vert(x0, cy + ny * r, cz + nz * r, 0, ny, nz, ...tyre, 0, 0, 0, bone); this.vert(x1, cy + ny * r, cz + nz * r, 0, ny, nz, ...tyre, 0, 0, 0, bone);
      }
      for (let k = 0; k < segs; k++) { const b = base + k * 2; this.quad(b, b + 2, b + 3, b + 1); }
      for (const [x, nx] of [[x0, -1], [x1, 1]]) {
        const c = this.vert(x, cy, cz, nx, 0, 0, ...rim, 0, 0, 0, bone);
        for (let k = 0; k < segs; k++) {
          const a0 = k / segs * M.TAU, a1 = (k + 1) / segs * M.TAU, rr = r * 0.65;
          const col = k % 2 ? rim : [0.3, 0.3, 0.32];
          const p0 = this.vert(x, cy + Math.cos(a0) * rr, cz + Math.sin(a0) * rr, nx, 0, 0, ...col, 0, 0, 0, bone), p1 = this.vert(x, cy + Math.cos(a1) * rr, cz + Math.sin(a1) * rr, nx, 0, 0, ...col, 0, 0, 0, bone);
          if (nx > 0) this.tri(c, p1, p0); else this.tri(c, p0, p1);
          const q0 = this.vert(x, cy + Math.cos(a0) * r, cz + Math.sin(a0) * r, nx, 0, 0, ...tyre, 0, 0, 0, bone), q1 = this.vert(x, cy + Math.cos(a1) * r, cz + Math.sin(a1) * r, nx, 0, 0, ...tyre, 0, 0, 0, bone);
          if (nx > 0) { this.tri(p0, p1, q1); this.tri(p0, q1, q0); } else { this.tri(p0, q1, p1); this.tri(p0, q0, q1); }
        }
      }
      return this;
    }
    append(other, dx = 0, dy = 0, dz = 0) {
      const base = this.n; const v = other.v;
      for (let k = 0; k < v.length; k += 13) { this.v.push(v[k] + dx, v[k + 1] + dy, v[k + 2] + dz); for (let j = 3; j < 13; j++) this.v.push(v[k + j]); this.n++; }
      for (const idx of other.i) this.i.push(idx + base);
      return this;
    }
    build(dynamic = false) { return GL.mesh(new Float32Array(this.v), new Uint32Array(this.i), dynamic); }
    buildInstanced(max) { return GL.instancedMesh(new Float32Array(this.v), new Uint32Array(this.i), max); }
  }

  // ---- Vehicles. Local frame: +z forward, +x left, y up, origin on the ground under the car's centre.
  // Bones: 0 body, 1 FL wheel, 2 FR wheel, 3 RL wheel, 4 RR wheel, 5 light bar / extra.
  const VEHICLES = {
    sedan:   { len: 4.6, wid: 2.0, hgt: 1.45, cabin: [0.35, 0.62], wheelR: 0.36, mass: 1.0, accel: 11, top: 26, grip: 0.92, turn: 2.4, brake: 24, seats: 4, hood: 0.9 },
    sports:  { len: 4.4, wid: 2.0, hgt: 1.2, cabin: [0.3, 0.55], wheelR: 0.36, mass: 0.95, accel: 16, top: 36, grip: 0.95, turn: 2.8, brake: 30, seats: 2, hood: 0.7 },
    hatch:   { len: 3.8, wid: 1.85, hgt: 1.5, cabin: [0.3, 0.75], wheelR: 0.33, mass: 0.85, accel: 10, top: 24, grip: 0.9, turn: 2.6, brake: 22, seats: 4, hood: 0.85 },
    pickup:  { len: 5.2, wid: 2.1, hgt: 1.8, cabin: [0.28, 0.55], wheelR: 0.42, mass: 1.3, accel: 10, top: 25, grip: 0.86, turn: 2.1, brake: 22, seats: 2, hood: 1.1, bed: true },
    van:     { len: 5.2, wid: 2.1, hgt: 2.2, cabin: [0.2, 0.95], wheelR: 0.38, mass: 1.4, accel: 8, top: 22, grip: 0.84, turn: 2.0, brake: 20, seats: 4, hood: 1.0 },
    taxi:    { len: 4.6, wid: 2.0, hgt: 1.45, cabin: [0.35, 0.62], wheelR: 0.36, mass: 1.0, accel: 11, top: 27, grip: 0.92, turn: 2.4, brake: 24, seats: 4, hood: 0.9, taxi: true },
    police:  { len: 4.8, wid: 2.05, hgt: 1.5, cabin: [0.35, 0.62], wheelR: 0.37, mass: 1.1, accel: 14, top: 32, grip: 0.94, turn: 2.6, brake: 28, seats: 4, hood: 0.9, police: true },
    truck:   { len: 7.5, wid: 2.4, hgt: 3.0, cabin: [0.0, 0.3], wheelR: 0.5, mass: 2.6, accel: 6, top: 20, grip: 0.8, turn: 1.6, brake: 16, seats: 2, hood: 0.4, box: true },
    bus:     { len: 9.5, wid: 2.5, hgt: 3.0, cabin: [0.0, 1.0], wheelR: 0.5, mass: 3.0, accel: 5, top: 19, grip: 0.8, turn: 1.4, brake: 15, seats: 4, hood: 0.0, bus: true },
    muscle:  { len: 4.9, wid: 2.05, hgt: 1.35, cabin: [0.38, 0.62], wheelR: 0.38, mass: 1.15, accel: 15, top: 33, grip: 0.86, turn: 2.5, brake: 26, seats: 2, hood: 1.0 },
    swat:    { len: 5.6, wid: 2.3, hgt: 2.4, cabin: [0.2, 0.9], wheelR: 0.42, mass: 1.8, accel: 10, top: 26, grip: 0.9, turn: 2.0, brake: 24, seats: 4, hood: 0.9, police: true, armor: true },
  };

  // Returns { body, glass } builders. opts.dent (0..1) crumples the body, opts.seed varies the dents.
  function carMesh(type, col, opts = {}) {
    const s = VEHICLES[type], b = new Builder(), gb = new Builder(); const L = s.len, W = s.wid, H = s.hgt, wr = s.wheelR;
    const dark = [0.12, 0.13, 0.15], glass = [0.55, 0.7, 0.85], chrome = [0.8, 0.82, 0.85];
    const body = col, bodyDk = col.map(c => c * 0.72), roofCol = col.map(c => c * 0.92);
    const floorY = wr * 0.9, bodyH = H * 0.5, cabinY = floorY + bodyH, cabinH = H - bodyH - floorY * 0.6;
    const half = L / 2;
    const lightBox = (x, y, z, w, h, colr, face, bone) => b.cbox(x, y, z, w, h, 0.08, colr, 0, { faces: face, bone });
    if (s.bus) {
      b.cbox(0, floorY + (H - floorY) / 2, 0, W, H - floorY, L, body);
      gb.cbox(0, floorY + (H - floorY) * 0.62, 0, W + 0.02, (H - floorY) * 0.4, L * 0.96, glass);
      gb.cbox(0, floorY + (H - floorY) * 0.62, half - 0.3, W * 0.9, (H - floorY) * 0.4, 0.7, glass);
      b.cbox(0, H + 0.1, 0, W * 0.8, 0.2, L * 0.8, roofCol);
      b.cbox(0, floorY + 0.1, half - 0.02, W - 0.2, 0.25, 0.1, [0.9, 0.9, 0.9], 0, { faces: 16 });
      lightBox(W * 0.35, floorY + 0.9, half + 0.01, 0.3, 0.2, [1, 1, 0.9], 16, 5); lightBox(-W * 0.35, floorY + 0.9, half + 0.01, 0.3, 0.2, [1, 1, 0.9], 16, 5);
      lightBox(W * 0.35, floorY + 0.9, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6); lightBox(-W * 0.35, floorY + 0.9, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6);
      // door outlines and a destination sign
      for (const sx of [1, -1]) for (const dz of [half - 1.6, -half + 2.6]) b.cbox(sx * (W / 2 + 0.005), floorY + (H - floorY) * 0.35, dz, 0.01, (H - floorY) * 0.62, 1.2, bodyDk, 0, { faces: sx > 0 ? 1 : 2 });
      b.cbox(0, H - 0.35, half + 0.02, W * 0.7, 0.35, 0.05, [0.95, 0.6, 0.1], 0, { faces: 16, bone: 7 });
    } else if (s.box) {
      const cabL = L * 0.3;
      b.cbox(0, floorY + bodyH / 2, half - cabL / 2, W, bodyH, cabL, body);
      b.cbox(0, cabinY + cabinH * 0.6, half - cabL / 2 - 0.1, W * 0.94, cabinH * 1.2, cabL * 0.8, body);
      gb.cbox(0, cabinY + cabinH * 0.7, half - cabL * 0.15, W * 0.86, cabinH * 0.6, cabL * 0.9, glass);
      b.cbox(0, floorY + (H - floorY) / 2, -half + (L - cabL - 0.3) / 2, W, H - floorY, L - cabL - 0.3, [0.85, 0.85, 0.82], 0);
      b.cbox(0, floorY + (H - floorY) / 2, -half + (L - cabL - 0.3) / 2, W + 0.02, 0.06, L - cabL - 0.3, [0.6, 0.6, 0.6]);
      lightBox(W * 0.35, floorY + 0.5, half + 0.01, 0.35, 0.25, [1, 1, 0.9], 16, 5); lightBox(-W * 0.35, floorY + 0.5, half + 0.01, 0.35, 0.25, [1, 1, 0.9], 16, 5);
      lightBox(W * 0.4, floorY + 0.4, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6); lightBox(-W * 0.4, floorY + 0.4, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6);
      b.cbox(0, floorY + bodyH * 0.5, half + 0.05, W * 0.98, 0.3, 0.12, dark);
      b.cyl(W * 0.3, floorY + bodyH * 0.6, half - cabL * 0.9, 0.08, floorY + bodyH * 0.6 + 1.2, chrome, 0, 6); // exhaust stack
    } else {
      const c0 = half - s.cabin[0] * L - s.hood * 0.5, c1 = half - s.cabin[1] * L - s.hood * 0.5; // cabin front / back (z)
      const cw = W * 0.9; const belt = floorY + bodyH * (s.sports ? 0.5 : 0.62); const topY = floorY + bodyH;
      const hoodFront = belt + (s.sports ? 0.06 : 0.14), trunkBack = belt + (s.sports ? 0.18 : 0.26);
      // lower body up to the belt line
      b.cbox(0, (floorY + belt) / 2, 0, W, belt - floorY, L, body);
      // the block under the cabin, full height
      b.cbox(0, (belt + topY) / 2, (c0 + c1) / 2 + 0.05, W, topY - belt, (c0 - c1) + 0.7, body);
      // hood: sloped from the cabin base down to the nose
      const hz0 = c0 + 0.35, hz1 = half; const hw = W / 2;
      b.poly([[hw, topY, hz0], [hw, hoodFront, hz1], [-hw, hoodFront, hz1], [-hw, topY, hz0]], body);
      b.poly([[hw, belt, hz0], [hw, topY, hz0], [hw, hoodFront, hz1], [hw, belt, hz1]], body); b.poly([[-hw, belt, hz1], [-hw, hoodFront, hz1], [-hw, topY, hz0], [-hw, belt, hz0]], body);
      b.poly([[hw, belt, hz1], [hw, hoodFront, hz1], [-hw, hoodFront, hz1], [-hw, belt, hz1]], body);
      // trunk: sloped from the cabin base down to the tail
      const tz0 = c1 - 0.35, tz1 = -half;
      b.poly([[-hw, topY, tz0], [-hw, trunkBack, tz1], [hw, trunkBack, tz1], [hw, topY, tz0]], body);
      b.poly([[hw, belt, tz1], [hw, trunkBack, tz1], [hw, topY, tz0], [hw, belt, tz0]], body); b.poly([[-hw, belt, tz0], [-hw, topY, tz0], [-hw, trunkBack, tz1], [-hw, belt, tz1]], body);
      b.poly([[-hw, belt, tz1], [-hw, trunkBack, tz1], [hw, trunkBack, tz1], [hw, belt, tz1]], body);
      // roof and pillars
      b.cbox(0, cabinY + cabinH - 0.04, (c0 + c1) / 2, cw, 0.08, c0 - c1, roofCol);
      for (const sx of [1, -1]) { b.cbox(sx * (cw / 2 - 0.05), cabinY + cabinH / 2, c0, 0.1, cabinH, 0.1, bodyDk); b.cbox(sx * (cw / 2 - 0.05), cabinY + cabinH / 2, c1, 0.1, cabinH, 0.1, bodyDk); if (s.seats > 2) b.cbox(sx * (cw / 2 - 0.05), cabinY + cabinH / 2, (c0 + c1) / 2, 0.1, cabinH, 0.08, bodyDk); }
      // glass: side belt, windscreen, rear window
      gb.cbox(0, cabinY + cabinH * 0.48, (c0 + c1) / 2, cw, cabinH * 0.9, (c0 - c1) - 0.05, glass, 0, { faces: 3 });
      const ws = 0.55 * (s.sports ? 1.3 : 1);
      gb.poly([[cw / 2, cabinY, c0 + ws], [cw / 2, cabinY + cabinH, c0], [-cw / 2, cabinY + cabinH, c0], [-cw / 2, cabinY, c0 + ws]], glass);
      gb.poly([[-cw / 2, cabinY, c1 - ws * 0.7], [-cw / 2, cabinY + cabinH, c1], [cw / 2, cabinY + cabinH, c1], [cw / 2, cabinY, c1 - ws * 0.7]], glass);
      // A-pillar triangles in body colour beside the windscreen
      b.poly([[cw / 2, cabinY, c0 + ws], [cw / 2 + 0.001, cabinY, c0], [cw / 2, cabinY + cabinH, c0]], bodyDk);
      b.poly([[-cw / 2, cabinY + cabinH, c0], [-cw / 2 - 0.001, cabinY, c0], [-cw / 2, cabinY, c0 + ws]], bodyDk);
      b.poly([[cw / 2, cabinY + cabinH, c1], [cw / 2 + 0.001, cabinY, c1], [cw / 2, cabinY, c1 - ws * 0.7]], bodyDk);
      b.poly([[-cw / 2, cabinY, c1 - ws * 0.7], [-cw / 2 - 0.001, cabinY, c1], [-cw / 2, cabinY + cabinH, c1]], bodyDk);
      // cabin floor and seats (visible through the glass)
      b.cbox(0, cabinY + 0.02, (c0 + c1) / 2, cw - 0.1, 0.04, c0 - c1, [0.18, 0.17, 0.16]);
      const seatZ = (c0 + c1) / 2 - 0.1; for (const sx of [0.42, -0.42]) { b.cbox(sx * W * 0.5, cabinY + 0.18, seatZ - 0.15, 0.5, 0.3, 0.5, [0.22, 0.2, 0.18]); b.cbox(sx * W * 0.5, cabinY + 0.5, seatZ - 0.38, 0.5, 0.6, 0.12, [0.22, 0.2, 0.18]); }
      b.cyl(W * 0.22, cabinY + 0.35, seatZ + 0.45, 0.18, cabinY + 0.38, dark, 0, 10, 0, true, true); // steering wheel
      if (s.bed) { b.cbox(0, cabinY + 0.25, (c1 - half) / 2, W * 0.96, 0.5, c1 + half - 0.1, bodyDk); b.cbox(0, cabinY + 0.1, (c1 - half) / 2, W * 0.8, 0.1, c1 + half - 0.4, [0.2, 0.2, 0.2]); }
      // wheel arches
      const wzA = half * 0.62, wxA = W / 2;
      for (const [ax, az] of [[wxA, wzA], [-wxA, wzA], [wxA, -wzA], [-wxA, -wzA]]) b.cbox(ax + Math.sign(ax) * 0.004, wr + 0.06, az, 0.008, wr * 2 + 0.2, wr * 2 + 0.34, [0.07, 0.07, 0.08], 0, { faces: ax > 0 ? 1 : 2 });
      // sills, door seams and handles
      for (const sx of [1, -1]) { b.cbox(sx * (W / 2 + 0.01), floorY + 0.12, 0, 0.04, 0.12, L * 0.6, bodyDk); const doors = s.seats > 2 ? [c0 - 0.05, (c0 + c1) / 2, c1 + 0.05] : [c0 - 0.05, c1 + 0.05]; for (const dz of doors) b.cbox(sx * (W / 2 + 0.005), (floorY + topY) / 2 + 0.05, dz, 0.01, (topY - floorY) * 0.8, 0.05, dark, 0, { faces: sx > 0 ? 1 : 2 }); for (let k = 0; k + 1 < doors.length; k++) b.cbox(sx * (W / 2 + 0.02), belt + 0.08, (doors[k] + doors[k + 1]) / 2 - 0.3, 0.03, 0.05, 0.2, chrome); }
      // bumpers, grille, plates, lights
      b.cbox(0, floorY + 0.15, half + 0.05, W * 0.98, 0.3, 0.14, dark); b.cbox(0, floorY + 0.15, -half - 0.05, W * 0.98, 0.3, 0.14, dark);
      lightBox(W * 0.34, belt - 0.02, half + 0.01, 0.42, 0.2, [1, 1, 0.92], 16, 5); lightBox(-W * 0.34, belt - 0.02, half + 0.01, 0.42, 0.2, [1, 1, 0.92], 16, 5);
      lightBox(W * 0.36, belt + 0.02, -half - 0.01, 0.4, 0.18, [1, 0.08, 0.06], 32, 6); lightBox(-W * 0.36, belt + 0.02, -half - 0.01, 0.4, 0.18, [1, 0.08, 0.06], 32, 6);
      b.cbox(0, belt - 0.05, half + 0.005, W * 0.35, 0.2, 0.02, dark, 0, { faces: 16 }); b.cbox(0, floorY + 0.38, -half - 0.005, 0.5, 0.15, 0.02, [0.9, 0.9, 0.85], 0, { faces: 32 });
      b.cbox(cw / 2 + 0.1, cabinY + cabinH * 0.3, c0 - 0.05, 0.18, 0.12, 0.22, bodyDk); b.cbox(-cw / 2 - 0.1, cabinY + cabinH * 0.3, c0 - 0.05, 0.18, 0.12, 0.22, bodyDk);
      if (s.taxi) { b.cbox(0, cabinY + cabinH + 0.15, (c0 + c1) / 2, 0.9, 0.3, 0.4, [1, 0.85, 0.1], 0, { bone: 7 }); b.cbox(0, belt + 0.3, half - 0.01, 0.01, 0.01, 0.01, dark); }
      if (s.police) {
        b.cbox(0, cabinY + cabinH + 0.12, (c0 + c1) / 2, 1.3, 0.22, 0.35, dark);
        b.cbox(0.4, cabinY + cabinH + 0.14, (c0 + c1) / 2, 0.5, 0.26, 0.38, [1, 0.1, 0.1], 0, { bone: 8 }); b.cbox(-0.4, cabinY + cabinH + 0.14, (c0 + c1) / 2, 0.5, 0.26, 0.38, [0.1, 0.3, 1], 0, { bone: 9 });
        b.cbox(0, (floorY + belt) / 2, (c0 + c1) / 2, W + 0.02, (belt - floorY) * 0.9, (c0 - c1) * 0.9, [0.1, 0.1, 0.12], 0, { faces: 3 });
        b.cbox(0, belt + 0.02, half + 0.2, W * 0.9, 0.35, 0.3, dark); // push bar
      }
      if (s.armor) { b.cbox(0, (floorY + belt) / 2, half + 0.2, W * 0.9, belt - floorY, 0.3, dark); b.cbox(0, cabinY + cabinH * 0.5, (c0 + c1) / 2, cw + 0.06, cabinH * 0.35, (c0 - c1) * 0.98, bodyDk); }
      if (s.sports || type === 'muscle') { b.cbox(0, trunkBack + 0.12, -half + 0.25, W * 0.9, 0.06, 0.3, bodyDk); b.cbox(0.35 * W, trunkBack + 0.06, -half + 0.25, 0.06, 0.14, 0.06, bodyDk); b.cbox(-0.35 * W, trunkBack + 0.06, -half + 0.25, 0.06, 0.14, 0.06, bodyDk); b.cyl(-W * 0.3, floorY + 0.08, -half - 0.05, 0.06, floorY + 0.08, chrome, 0, 6); }
      if (type === 'muscle') { b.cbox(0, topY + 0.04, half - 0.9, 0.5, 0.12, 1.1, bodyDk); } // hood scoop
    }
    // wheels
    const wz = half * (s.bus ? 0.7 : 0.62), wx = W / 2 - 0.05;
    b.wheel(wx, wr, wz, wr, 0.3, 1); b.wheel(-wx, wr, wz, wr, 0.3, 2); b.wheel(wx, wr, -wz, wr, 0.3, 3); b.wheel(-wx, wr, -wz, wr, 0.3, 4);
    if (opts.dent > 0) dentBody(b, opts.dent, opts.seed || 1);
    return { body: b, glass: gb };
  }
  // Crumple: nudge body vertices (bone 0 only) by a hash of their position; the more dented, the further.
  function dentBody(b, amount, seed) {
    const v = b.v; const r = M.rng(seed * 7919);
    const hash = (x, y, z) => { const t = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453; return t - Math.floor(t); };
    for (let k = 0; k < v.length; k += 13) {
      if (v[k + 12] !== 0) continue; const x = v[k], y = v[k + 1], z = v[k + 2];
      const q = Math.round(x * 4) + ',' + Math.round(y * 4) + ',' + Math.round(z * 4); // shared corners move together
      const h1 = hash(Math.round(x * 4), Math.round(y * 4), Math.round(z * 4)), h2 = hash(Math.round(z * 4), Math.round(x * 4), Math.round(y * 4)), h3 = hash(Math.round(y * 4), Math.round(z * 4), Math.round(x * 4));
      const k2 = amount * 0.16 * (0.4 + h3);
      v[k] += (h1 - 0.5) * k2; v[k + 1] += (h2 - 0.5) * k2 * 0.6; v[k + 2] += (h3 - 0.5) * k2;
      const dark = 1 - amount * 0.35 * h1; v[k + 6] *= dark; v[k + 7] *= dark; v[k + 8] *= dark;
    }
  }

  // ---- Pedestrians. Bones: 0 pelvis/torso, 1 head, 2 left arm, 3 right arm, 4 left leg, 5 right leg, 6 weapon.
  function pedMesh(look) {
    const b = new Builder(); const { skin, shirt, pants, hair, hat, shoes = [0.1, 0.1, 0.1], jacket = null, sleeves = !!jacket || Math.random() < 0.5, glasses = false, bag = null } = look;
    const legH = 0.85, torsoH = 0.65, headR = 0.14;
    const skinDk = skin.map(c => c * 0.85), shirtDk = (jacket || shirt).map(c => c * 0.8);
    // legs hang from the hips (bones 4, 5)
    for (const [sx, bone] of [[0.11, 4], [-0.11, 5]]) {
      b.cbox(sx, -legH * 0.27, 0, 0.19, legH * 0.55, 0.21, pants, 0, { bone }); b.cbox(sx, -legH * 0.76, 0.01, 0.17, legH * 0.46, 0.19, pants, 0, { bone });
      b.cbox(sx, -legH + 0.05, 0.04, 0.2, 0.1, 0.32, shoes, 0, { bone });
    }
    // torso (bone 0): hips, chest, shoulders
    b.cbox(0, 0.1, 0, 0.42, 0.22, 0.25, pants, 0, { bone: 0 }); b.cbox(0, 0.06, 0, 0.44, 0.06, 0.27, [0.15, 0.1, 0.08], 0, { bone: 0 }); // belt
    b.cbox(0, torsoH * 0.55, 0, 0.46, torsoH * 0.75, 0.26, jacket || shirt, 0, { bone: 0 });
    b.cbox(0, torsoH * 0.88, 0, 0.5, torsoH * 0.18, 0.27, jacket || shirt, 0, { bone: 0 }); // shoulders
    if (jacket) { b.cbox(0, torsoH * 0.5, 0.06, 0.18, torsoH * 0.8, 0.22, shirt, 0, { bone: 0 }); b.cbox(0.1, torsoH * 0.9, 0.12, 0.08, 0.1, 0.06, jacket.map(c => c * 0.7), 0, { bone: 0 }); b.cbox(-0.1, torsoH * 0.9, 0.12, 0.08, 0.1, 0.06, jacket.map(c => c * 0.7), 0, { bone: 0 }); }
    else b.cbox(0, torsoH * 0.9, 0.1, 0.16, 0.06, 0.1, shirtDk, 0, { bone: 0 }); // collar
    if (bag) b.cbox(-0.26, torsoH * 0.3, -0.05, 0.1, 0.3, 0.22, bag, 0, { bone: 0 });
    b.cbox(0, torsoH + 0.03, 0, 0.13, 0.08, 0.13, skin, 0, { bone: 0 }); // neck
    // head (bone 1): skull, hair, face
    b.cbox(0, headR, 0, headR * 2, headR * 2.1, headR * 2, skin, 0, { bone: 1 });
    b.cbox(0, headR * 1.75, -0.015, headR * 2.06, headR * 0.8, headR * 2.06, hair, 0, { bone: 1 });
    b.cbox(0, headR * 1.2, -headR * 0.75, headR * 2.06, headR * 1.4, headR * 0.55, hair, 0, { bone: 1 }); // back of the head
    b.cbox(0.055, headR * 1.15, headR + 0.004, 0.045, 0.035, 0.01, [0.12, 0.1, 0.1], 0, { bone: 1, faces: 16 }); b.cbox(-0.055, headR * 1.15, headR + 0.004, 0.045, 0.035, 0.01, [0.12, 0.1, 0.1], 0, { bone: 1, faces: 16 }); // eyes
    if (glasses) b.cbox(0, headR * 1.15, headR + 0.02, 0.2, 0.05, 0.03, [0.05, 0.05, 0.06], 0, { bone: 1 });
    b.cbox(0, headR * 0.95, headR + 0.02, 0.05, 0.06, 0.05, skinDk, 0, { bone: 1 }); // nose
    b.cbox(0, headR * 0.6, headR + 0.003, 0.08, 0.015, 0.01, [0.45, 0.2, 0.2], 0, { bone: 1, faces: 16 }); // mouth
    b.cbox(headR + 0.005, headR * 1.05, 0, 0.02, 0.06, 0.04, skinDk, 0, { bone: 1 }); b.cbox(-headR - 0.005, headR * 1.05, 0, 0.02, 0.06, 0.04, skinDk, 0, { bone: 1 }); // ears
    if (hat) { b.cbox(0, headR * 2.15, 0, headR * 2.2, headR * 0.5, headR * 2.2, hat, 0, { bone: 1 }); b.cbox(0, headR * 2.0, headR * 1.2, headR * 2.0, headR * 0.15, headR * 1.2, hat, 0, { bone: 1 }); }
    // arms (bones 2, 3): upper arm in sleeve, forearm skin or sleeve, hand
    const armL = 0.62;
    for (const [sx, bone] of [[0.3, 2], [-0.3, 3]]) {
      b.cbox(sx, -armL * 0.25, 0, 0.14, armL * 0.5, 0.15, jacket || shirt, 0, { bone });
      b.cbox(sx, -armL * 0.72, 0.01, 0.12, armL * 0.46, 0.13, sleeves ? (jacket || shirt) : skin, 0, { bone });
      b.cbox(sx, -armL + 0.02, 0.02, 0.11, 0.12, 0.11, skin, 0, { bone });
    }
    // weapon in the right hand (bone 6): hidden by scaling when unarmed
    b.cbox(-0.3, -armL + 0.02, 0.2, 0.06, 0.08, 0.36, [0.15, 0.15, 0.17], 0, { bone: 6 }); b.cbox(-0.3, -armL - 0.06, 0.08, 0.05, 0.14, 0.08, [0.25, 0.2, 0.15], 0, { bone: 6 });
    return b;
  }

  // ---- Props (instanced). Origin on the ground.
  function lamppost() { const b = new Builder(); const c = [0.35, 0.36, 0.38]; b.cyl(0, 0, 0, 0.12, 6, c, 0, 6); b.cbox(0, 6, 0.8, 0.14, 0.14, 1.8, c); b.cbox(0, 5.9, 1.6, 0.35, 0.18, 0.7, [1, 0.95, 0.8], 0, { bone: 0 }); return b; }
  function trafficLight() { const b = new Builder(); const c = [0.2, 0.2, 0.22]; b.cyl(0, 0, 0, 0.1, 5, c, 0, 6); b.cbox(0, 5, 2.0, 0.12, 0.12, 4.2, c); b.cbox(0, 4.4, 3.9, 0.36, 1.05, 0.36, [0.15, 0.15, 0.15]); return b; }
  function lampHead() { const b = new Builder(); b.cbox(0, 0, 0, 0.22, 0.22, 0.1, [1, 1, 1], 0, { faces: 16 }); return b; }
  function tree() { const b = new Builder(); b.cyl(0, 0, 0, 0.18, 2.2, [0.35, 0.25, 0.15], 0, 6); b.cyl(0, 1.8, 0, 1.6, 3.6, [0.2, 0.45, 0.18], 0, 7, 0, true, true, 0.9); b.cyl(0, 3.4, 0, 1.2, 4.9, [0.25, 0.52, 0.2], 0, 7, 0, true, false, 0.3); return b; }
  function hydrant() { const b = new Builder(); b.cyl(0, 0, 0, 0.16, 0.7, [0.85, 0.15, 0.12], 0, 6); b.cbox(0, 0.45, 0, 0.5, 0.14, 0.2, [0.85, 0.15, 0.12]); b.cyl(0, 0.7, 0, 0.1, 0.85, [0.85, 0.15, 0.12], 0, 6); return b; }
  function bin() { const b = new Builder(); b.cyl(0, 0, 0, 0.32, 0.95, [0.2, 0.28, 0.2], 0, 8); b.cyl(0, 0.95, 0, 0.36, 1.05, [0.15, 0.2, 0.15], 0, 8); return b; }
  function bench() { const b = new Builder(); const w = [0.45, 0.32, 0.2]; b.cbox(0, 0.45, 0, 1.8, 0.06, 0.5, w); b.cbox(0, 0.75, -0.22, 1.8, 0.4, 0.06, w); b.cbox(0.7, 0.22, 0, 0.08, 0.45, 0.45, [0.2, 0.2, 0.2]); b.cbox(-0.7, 0.22, 0, 0.08, 0.45, 0.45, [0.2, 0.2, 0.2]); return b; }
  function payphone() { const b = new Builder(); b.cbox(0, 0.9, 0, 0.5, 1.8, 0.4, [0.15, 0.3, 0.6]); b.cbox(0, 1.35, 0.21, 0.36, 0.5, 0.04, [0.05, 0.05, 0.06]); b.cbox(-0.12, 1.0, 0.22, 0.08, 0.3, 0.06, [0.1, 0.1, 0.12]); b.cbox(0, 1.9, 0, 0.55, 0.12, 0.45, [0.15, 0.3, 0.6]); return b; }
  function bollard() { const b = new Builder(); b.cyl(0, 0, 0, 0.14, 0.9, [0.3, 0.3, 0.32], 0, 6); return b; }
  function pickupBox() { const b = new Builder(); b.cbox(0, 0.6, 0, 0.7, 0.7, 0.7, [1, 1, 1], 0, { bone: 0 }); return b; }
  function packageBox() { const b = new Builder(); b.cbox(0, 0.25, 0, 0.5, 0.5, 0.5, [0.55, 0.4, 0.25]); b.cbox(0, 0.26, 0, 0.52, 0.1, 0.1, [0.9, 0.85, 0.7]); b.cbox(0, 0.26, 0, 0.1, 0.1, 0.52, [0.9, 0.85, 0.7]); return b; }
  function marker() { const b = new Builder(); b.cyl(0, 0, 0, 1.6, 1.4, [1, 1, 1], 0, 16, 0, false, false); return b; }
  function heli() {
    const b = new Builder(); const c = [0.12, 0.14, 0.2], g = [0.3, 0.4, 0.5];
    b.cbox(0, 1.4, 0.4, 1.6, 1.3, 3.2, c); b.cbox(0, 1.5, 1.6, 1.2, 0.9, 1.2, g); b.cbox(0, 1.6, -2.8, 0.4, 0.4, 3.6, c); b.cbox(0, 2.2, -4.4, 0.1, 1.0, 0.7, c);
    b.cbox(0.7, 0.3, 0.4, 0.1, 0.1, 2.6, [0.4, 0.4, 0.4]); b.cbox(-0.7, 0.3, 0.4, 0.1, 0.1, 2.6, [0.4, 0.4, 0.4]); b.cbox(0.7, 0.7, 0.4, 0.08, 0.7, 0.08, [0.4, 0.4, 0.4]); b.cbox(-0.7, 0.7, 0.4, 0.08, 0.7, 0.08, [0.4, 0.4, 0.4]);
    b.cbox(0, 2.15, 0.4, 0.3, 0.3, 0.3, [0.2, 0.2, 0.2]);
    b.cbox(0, 2.3, 0.4, 9, 0.06, 0.3, [0.15, 0.15, 0.15], 0, { bone: 1 }); b.cbox(0, 2.3, 0.4, 0.3, 0.06, 9, [0.15, 0.15, 0.15], 0, { bone: 1 });
    b.cbox(0.22, 2.2, -4.4, 0.05, 1.4, 0.16, [0.15, 0.15, 0.15], 0, { bone: 2 });
    b.cbox(0, 0.75, 1.5, 0.5, 0.3, 0.5, [1, 1, 0.9], 0, { bone: 3 });
    return b;
  }
  return { Builder, VEHICLES, carMesh, dentBody, pedMesh, payphone, lamppost, trafficLight, lampHead, tree, hydrant, bin, bench, bollard, pickupBox, packageBox, marker, heli };
})();
