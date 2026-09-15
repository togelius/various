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

  function carMesh(type, col) {
    const s = VEHICLES[type], b = new Builder(); const L = s.len, W = s.wid, H = s.hgt, wr = s.wheelR;
    const dark = [0.12, 0.13, 0.15], glass = [0.25, 0.32, 0.4], chrome = [0.8, 0.82, 0.85];
    const body = col, bodyDk = col.map(c => c * 0.75), roofCol = col.map(c => c * 0.9);
    const floorY = wr * 0.9, bodyH = H * 0.5, cabinY = floorY + bodyH, cabinH = H - bodyH - floorY * 0.6;
    const half = L / 2;
    if (s.bus) {
      b.cbox(0, floorY + (H - floorY) / 2, 0, W, H - floorY, L, body);
      b.cbox(0, floorY + (H - floorY) * 0.62, 0, W + 0.02, (H - floorY) * 0.4, L * 0.96, glass);
      b.cbox(0, floorY + (H - floorY) * 0.62, half - 0.3, W * 0.9, (H - floorY) * 0.4, 0.7, glass);
      b.cbox(0, H + 0.1, 0, W * 0.8, 0.2, L * 0.8, roofCol);
      b.cbox(0, floorY + 0.1, half - 0.02, W - 0.2, 0.25, 0.1, [0.9, 0.9, 0.9], 0, { faces: 16 });
      b.cbox(W * 0.35, floorY + 0.9, half + 0.01, 0.3, 0.2, 0.1, [1, 1, 0.9], 0, { faces: 16 }); b.cbox(-W * 0.35, floorY + 0.9, half + 0.01, 0.3, 0.2, 0.1, [1, 1, 0.9], 0, { faces: 16 });
      b.cbox(W * 0.35, floorY + 0.9, -half - 0.01, 0.3, 0.2, 0.1, [1, 0.1, 0.1], 0, { faces: 32 }); b.cbox(-W * 0.35, floorY + 0.9, -half - 0.01, 0.3, 0.2, 0.1, [1, 0.1, 0.1], 0, { faces: 32 });
    } else if (s.box) {
      // truck: cab at front, cargo box behind
      const cabL = L * 0.3;
      b.cbox(0, floorY + bodyH / 2, half - cabL / 2, W, bodyH, cabL, body);
      b.cbox(0, cabinY + cabinH * 0.6, half - cabL / 2 - 0.1, W * 0.94, cabinH * 1.2, cabL * 0.8, body);
      b.cbox(0, cabinY + cabinH * 0.7, half - cabL * 0.15, W * 0.86, cabinH * 0.6, cabL * 0.9, glass);
      b.cbox(0, floorY + (H - floorY) / 2, -half + (L - cabL - 0.3) / 2, W, H - floorY, L - cabL - 0.3, [0.85, 0.85, 0.82], 0);
      b.cbox(W * 0.35, floorY + 0.5, half + 0.01, 0.35, 0.25, 0.1, [1, 1, 0.9], 0, { faces: 16 }); b.cbox(-W * 0.35, floorY + 0.5, half + 0.01, 0.35, 0.25, 0.1, [1, 1, 0.9], 0, { faces: 16 });
      b.cbox(W * 0.4, floorY + 0.4, -half - 0.01, 0.3, 0.2, 0.1, [1, 0.1, 0.1], 0, { faces: 32 }); b.cbox(-W * 0.4, floorY + 0.4, -half - 0.01, 0.3, 0.2, 0.1, [1, 0.1, 0.1], 0, { faces: 32 });
    } else {
      // Lower body
      b.cbox(0, floorY + bodyH / 2, 0, W, bodyH, L, body);
      // Cabin: from cabin[0]*L behind the front to cabin[1]*L; slightly narrower; windscreen wedges
      const c0 = half - s.cabin[0] * L - s.hood * 0.5, c1 = half - s.cabin[1] * L - s.hood * 0.5; // z coordinates (front to back)
      const cw = W * 0.9;
      b.cbox(0, cabinY + cabinH / 2, (c0 + c1) / 2, cw, cabinH, c0 - c1, roofCol, 0, { faces: 4 });
      // glass belt: sides
      b.cbox(0, cabinY + cabinH * 0.45, (c0 + c1) / 2, cw + 0.02, cabinH * 0.75, (c0 - c1) * 0.98, glass, 0, { faces: 3 });
      // pillars/lower cabin band
      b.cbox(0, cabinY + cabinH * 0.05, (c0 + c1) / 2, cw, cabinH * 0.12, c0 - c1, bodyDk);
      // windscreen (sloped front) and rear glass
      const ws = 0.55 * (s.sports ? 1.3 : 1);
      b.poly([[cw / 2, cabinY, c0 + ws], [cw / 2, cabinY + cabinH, c0], [-cw / 2, cabinY + cabinH, c0], [-cw / 2, cabinY, c0 + ws]], glass);
      b.poly([[-cw / 2, cabinY, c1 - ws * 0.7], [-cw / 2, cabinY + cabinH, c1], [cw / 2, cabinY + cabinH, c1], [cw / 2, cabinY, c1 - ws * 0.7]], glass);
      // triangles filling the sides of the windscreen
      b.poly([[cw / 2, cabinY, c0 + ws], [cw / 2 + 0.001, cabinY, c0], [cw / 2, cabinY + cabinH, c0]], bodyDk);
      b.poly([[-cw / 2, cabinY + cabinH, c0], [-cw / 2 - 0.001, cabinY, c0], [-cw / 2, cabinY, c0 + ws]], bodyDk);
      b.poly([[cw / 2, cabinY + cabinH, c1], [cw / 2 + 0.001, cabinY, c1], [cw / 2, cabinY, c1 - ws * 0.7]], bodyDk);
      b.poly([[-cw / 2, cabinY, c1 - ws * 0.7], [-cw / 2 - 0.001, cabinY, c1], [-cw / 2, cabinY + cabinH, c1]], bodyDk);
      if (s.bed) { b.cbox(0, cabinY + 0.25, (c1 - half) / 2, W * 0.96, 0.5, c1 + half - 0.1, bodyDk); b.cbox(0, cabinY + 0.1, (c1 - half) / 2, W * 0.8, 0.1, c1 + half - 0.4, [0.2, 0.2, 0.2]); }
      // door seams and handles
      for (const sx of [1, -1]) { const doors = s.seats > 2 ? [c0 - 0.05, (c0 + c1) / 2, c1 + 0.05] : [c0 - 0.05, c1 + 0.05]; for (const dz of doors) b.cbox(sx * (W / 2 + 0.005), floorY + bodyH * 0.55, dz, 0.01, bodyH * 0.9, 0.05, dark, 0, { faces: sx > 0 ? 1 : 2 }); for (let k = 0; k + 1 < doors.length; k++) b.cbox(sx * (W / 2 + 0.02), floorY + bodyH * 0.8, (doors[k] + doors[k + 1]) / 2 - 0.3, 0.03, 0.05, 0.2, chrome); }
      // bumpers
      b.cbox(0, floorY + 0.15, half + 0.05, W * 0.98, 0.3, 0.12, dark); b.cbox(0, floorY + 0.15, -half - 0.05, W * 0.98, 0.3, 0.12, dark);
      // headlights & taillights (emissive by vertex colour in the "white" tile — handled via car light uniform)
      b.cbox(W * 0.34, floorY + bodyH * 0.65, half + 0.01, 0.42, 0.22, 0.08, [1, 1, 0.92], 0, { faces: 16, bone: 5 });
      b.cbox(-W * 0.34, floorY + bodyH * 0.65, half + 0.01, 0.42, 0.22, 0.08, [1, 1, 0.92], 0, { faces: 16, bone: 5 });
      b.cbox(W * 0.36, floorY + bodyH * 0.65, -half - 0.01, 0.4, 0.2, 0.08, [1, 0.08, 0.06], 0, { faces: 32, bone: 6 });
      b.cbox(-W * 0.36, floorY + bodyH * 0.65, -half - 0.01, 0.4, 0.2, 0.08, [1, 0.08, 0.06], 0, { faces: 32, bone: 6 });
      // grille & plates
      b.cbox(0, floorY + bodyH * 0.55, half + 0.005, W * 0.35, 0.22, 0.02, dark, 0, { faces: 16 });
      b.cbox(0, floorY + 0.35, -half - 0.005, 0.5, 0.15, 0.02, [0.9, 0.9, 0.85], 0, { faces: 32 });
      // mirrors
      b.cbox(cw / 2 + 0.1, cabinY + cabinH * 0.35, c0 - 0.1, 0.18, 0.12, 0.22, bodyDk); b.cbox(-cw / 2 - 0.1, cabinY + cabinH * 0.35, c0 - 0.1, 0.18, 0.12, 0.22, bodyDk);
      if (s.taxi) { b.cbox(0, cabinY + cabinH + 0.15, (c0 + c1) / 2, 0.9, 0.3, 0.4, [1, 0.85, 0.1], 0, { bone: 7 }); }
      if (s.police) {
        b.cbox(0, cabinY + cabinH + 0.12, (c0 + c1) / 2, 1.3, 0.22, 0.35, dark);
        b.cbox(0.4, cabinY + cabinH + 0.14, (c0 + c1) / 2, 0.5, 0.26, 0.38, [1, 0.1, 0.1], 0, { bone: 8 });
        b.cbox(-0.4, cabinY + cabinH + 0.14, (c0 + c1) / 2, 0.5, 0.26, 0.38, [0.1, 0.3, 1], 0, { bone: 9 });
        // doors in contrasting colour
        b.cbox(0, floorY + bodyH / 2, (c0 + c1) / 2, W + 0.02, bodyH * 0.9, (c0 - c1) * 0.9, [0.1, 0.1, 0.12], 0, { faces: 3 });
      }
      if (s.armor) { b.cbox(0, floorY + bodyH * 0.5, half + 0.2, W * 0.9, bodyH * 0.6, 0.3, dark); }
      if (s.sports || type === 'muscle') { b.cbox(0, cabinY + 0.1, -half + 0.2, W * 0.9, 0.12, 0.3, bodyDk); b.cbox(0, cabinY + 0.3, -half + 0.2, W * 0.9, 0.08, 0.3, bodyDk); }
    }
    // wheels
    const wz = half * (s.bus ? 0.7 : 0.62), wx = W / 2 - 0.05;
    b.wheel(wx, wr, wz, wr, 0.3, 1); b.wheel(-wx, wr, wz, wr, 0.3, 2); b.wheel(wx, wr, -wz, wr, 0.3, 3); b.wheel(-wx, wr, -wz, wr, 0.3, 4);
    return b;
  }

  // ---- Pedestrians. Bones: 0 pelvis/torso, 1 head, 2 left arm, 3 right arm, 4 left leg, 5 right leg, 6 weapon.
  function pedMesh(look) {
    const b = new Builder(); const { skin, shirt, pants, hair, hat, shoes = [0.1, 0.1, 0.1], jacket = null } = look;
    const legH = 0.85, torsoH = 0.65, headR = 0.14;
    // legs pivot at hip (y = legH); modelled hanging down from origin of bone (translate later)
    b.cbox(0.11, -legH / 2, 0, 0.18, legH, 0.2, pants, 0, { bone: 4 }); b.cbox(-0.11, -legH / 2, 0, 0.18, legH, 0.2, pants, 0, { bone: 4 + 1 });
    b.cbox(0.11, -legH + 0.05, 0.03, 0.2, 0.1, 0.3, shoes, 0, { bone: 4 }); b.cbox(-0.11, -legH + 0.05, 0.03, 0.2, 0.1, 0.3, shoes, 0, { bone: 5 });
    // torso: bone 0 origin at hips
    b.cbox(0, torsoH / 2, 0, 0.46, torsoH, 0.26, jacket || shirt, 0, { bone: 0 });
    if (jacket) b.cbox(0, torsoH / 2 - 0.05, 0.02, 0.2, torsoH * 0.9, 0.26, shirt, 0, { bone: 0 });
    b.cbox(0, torsoH + 0.03, 0, 0.14, 0.08, 0.14, skin, 0, { bone: 0 }); // neck
    // head bone 1 origin at neck top
    b.cbox(0, headR, 0, headR * 2, headR * 2.1, headR * 2, skin, 0, { bone: 1 });
    b.cbox(0, headR * 1.7, -0.02, headR * 2.05, headR * 0.9, headR * 2.05, hair, 0, { bone: 1 });
    if (hat) { b.cbox(0, headR * 2.15, 0, headR * 2.2, headR * 0.5, headR * 2.2, hat, 0, { bone: 1 }); b.cbox(0, headR * 2.0, headR * 1.2, headR * 2.0, headR * 0.15, headR * 1.2, hat, 0, { bone: 1 }); }
    // eyes
    b.cbox(0.05, headR * 1.1, headR + 0.005, 0.04, 0.04, 0.01, [0.1, 0.1, 0.1], 0, { bone: 1, faces: 16 }); b.cbox(-0.05, headR * 1.1, headR + 0.005, 0.04, 0.04, 0.01, [0.1, 0.1, 0.1], 0, { bone: 1, faces: 16 });
    // arms: bones 2/3 origin at shoulder, hanging down
    const armL = 0.62;
    b.cbox(0.3, -armL / 2 + 0.02, 0, 0.13, armL, 0.14, jacket || shirt, 0, { bone: 2 }); b.cbox(0.3, -armL + 0.02, 0, 0.12, 0.12, 0.12, skin, 0, { bone: 2 });
    b.cbox(-0.3, -armL / 2 + 0.02, 0, 0.13, armL, 0.14, jacket || shirt, 0, { bone: 3 }); b.cbox(-0.3, -armL + 0.02, 0, 0.12, 0.12, 0.12, skin, 0, { bone: 3 });
    // weapon in right hand (bone 6, follows arm 3): a generic gun shape, hidden by scaling to 0 when unarmed
    b.cbox(-0.3, -armL + 0.02, 0.2, 0.06, 0.08, 0.36, [0.15, 0.15, 0.17], 0, { bone: 6 }); b.cbox(-0.3, -armL - 0.06, 0.08, 0.05, 0.14, 0.08, [0.25, 0.2, 0.15], 0, { bone: 6 });
    return b;
  }

  // ---- Props (instanced). Origin on the ground.
  function lamppost() { const b = new Builder(); const c = [0.35, 0.36, 0.38]; b.cyl(0, 0, 0, 0.12, 6, c, 0, 6); b.cbox(0, 6, 0.8, 0.14, 0.14, 1.8, c); b.cbox(0, 5.9, 1.6, 0.35, 0.18, 0.7, [1, 0.95, 0.8], 0, { bone: 0 }); return b; }
  function trafficLight() { const b = new Builder(); const c = [0.2, 0.2, 0.22]; b.cyl(0, 0, 0, 0.1, 5, c, 0, 6); b.cbox(0, 5, 1.5, 0.12, 0.12, 3.2, c); b.cbox(0, 4.4, 2.8, 0.36, 1.05, 0.36, [0.15, 0.15, 0.15]); return b; }
  function lampHead() { const b = new Builder(); b.cbox(0, 0, 0, 0.22, 0.22, 0.1, [1, 1, 1], 0, { faces: 16 }); return b; }
  function tree() { const b = new Builder(); b.cyl(0, 0, 0, 0.18, 2.2, [0.35, 0.25, 0.15], 0, 6); b.cyl(0, 1.8, 0, 1.6, 3.6, [0.2, 0.45, 0.18], 0, 7, 0, true, true, 0.9); b.cyl(0, 3.4, 0, 1.2, 4.9, [0.25, 0.52, 0.2], 0, 7, 0, true, false, 0.3); return b; }
  function hydrant() { const b = new Builder(); b.cyl(0, 0, 0, 0.16, 0.7, [0.85, 0.15, 0.12], 0, 6); b.cbox(0, 0.45, 0, 0.5, 0.14, 0.2, [0.85, 0.15, 0.12]); b.cyl(0, 0.7, 0, 0.1, 0.85, [0.85, 0.15, 0.12], 0, 6); return b; }
  function bin() { const b = new Builder(); b.cyl(0, 0, 0, 0.32, 0.95, [0.2, 0.28, 0.2], 0, 8); b.cyl(0, 0.95, 0, 0.36, 1.05, [0.15, 0.2, 0.15], 0, 8); return b; }
  function bench() { const b = new Builder(); const w = [0.45, 0.32, 0.2]; b.cbox(0, 0.45, 0, 1.8, 0.06, 0.5, w); b.cbox(0, 0.75, -0.22, 1.8, 0.4, 0.06, w); b.cbox(0.7, 0.22, 0, 0.08, 0.45, 0.45, [0.2, 0.2, 0.2]); b.cbox(-0.7, 0.22, 0, 0.08, 0.45, 0.45, [0.2, 0.2, 0.2]); return b; }
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
  return { Builder, VEHICLES, carMesh, pedMesh, lamppost, trafficLight, lampHead, tree, hydrant, bin, bench, bollard, pickupBox, packageBox, marker, heli };
})();
