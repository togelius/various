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
      const { bone = 0, faces = 63, uvScale = 1, uvScaleV = 0, uOff = 0, vOff = 0, tint = null, topTile = -1, sideTile = -1 } = opts;
      const [r, g, b] = col; const x1 = x + w, y1 = y + h, z1 = z + d; const s = 1 / uvScale, sv = 1 / (uvScaleV || uvScale);
      const tt = topTile >= 0 ? topTile : tile, st = sideTile >= 0 ? sideTile : tile;
      const f = (nx, ny, nz, p, tl, uvs) => {
        const base = this.n;
        for (let k = 0; k < 4; k++) this.vert(p[k][0], p[k][1], p[k][2], nx, ny, nz, r, g, b, uvs[k][0] * s + uOff, uvs[k][1] * sv + vOff, tl, bone);
        this.quad(base, base + 1, base + 2, base + 3);
      };
      // side faces: canvas row 0 is the top of the face; u runs so that text reads left-to-right from outside
      if (faces & 1) f(1, 0, 0, [[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], st, [[d, h], [d, 0], [0, 0], [0, h]]);
      // -x
      if (faces & 2) f(-1, 0, 0, [[x, y, z1], [x, y1, z1], [x, y1, z], [x, y, z]], st, [[d, h], [d, 0], [0, 0], [0, h]]);
      // +y (top)
      if (faces & 4) f(0, 1, 0, [[x, y1, z], [x, y1, z1], [x1, y1, z1], [x1, y1, z]], tt, [[0, 0], [0, d], [w, d], [w, 0]]);
      // -y
      if (faces & 8) f(0, -1, 0, [[x, y, z1], [x, y, z], [x1, y, z], [x1, y, z1]], tt, [[0, 0], [0, d], [w, d], [w, 0]]);
      // +z
      if (faces & 16) f(0, 0, 1, [[x1, y, z1], [x1, y1, z1], [x, y1, z1], [x, y, z1]], st, [[w, h], [w, 0], [0, 0], [0, h]]);
      // -z
      if (faces & 32) f(0, 0, -1, [[x, y, z], [x, y1, z], [x1, y1, z], [x1, y, z]], st, [[w, h], [w, 0], [0, 0], [0, h]]);
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
    // Wheel: tyre with tread blocks, five-spoke rim and a hub, along the x axis, centred at (cx,cy,cz).
    wheel(cx, cy, cz, r, w, bone, segs = 16) {
      const tyre = [0.07, 0.07, 0.08], tyreDk = [0.045, 0.045, 0.05], rim = [0.78, 0.78, 0.8], rimDk = [0.22, 0.22, 0.25]; const x0 = cx - w / 2, x1 = cx + w / 2;
      // tread: alternate blocks slightly proud of the grooves
      for (let k = 0; k < segs; k++) {
        const a0 = k / segs * M.TAU, a1 = (k + 1) / segs * M.TAU; const rr = k % 2 ? r : r * 0.975, col = k % 2 ? tyre : tyreDk;
        const p = (x, a) => [x, cy + Math.cos(a) * rr, cz + Math.sin(a) * rr]; const am = (a0 + a1) / 2; const ny = Math.cos(am), nz = Math.sin(am);
        const base = this.n; for (const [x, a] of [[x0, a0], [x0, a1], [x1, a1], [x1, a0]]) { const q = p(x, a); this.vert(q[0], q[1], q[2], 0, Math.cos(a), Math.sin(a), ...col, 0, 0, 0, bone); }
        this.quad(base, base + 1, base + 2, base + 3);
        // sidewall shoulder ring (slightly rounded look)
        for (const [x, nx] of [[x0, -1], [x1, 1]]) { const b2 = this.n; const rs = r * 0.86; this.vert(x, cy + Math.cos(a0) * rr, cz + Math.sin(a0) * rr, nx * 0.7, Math.cos(a0) * 0.7, Math.sin(a0) * 0.7, ...tyre, 0, 0, 0, bone); this.vert(x, cy + Math.cos(a1) * rr, cz + Math.sin(a1) * rr, nx * 0.7, Math.cos(a1) * 0.7, Math.sin(a1) * 0.7, ...tyre, 0, 0, 0, bone);
          this.vert(x, cy + Math.cos(a1) * rs, cz + Math.sin(a1) * rs, nx, 0, 0, ...tyre, 0, 0, 0, bone); this.vert(x, cy + Math.cos(a0) * rs, cz + Math.sin(a0) * rs, nx, 0, 0, ...tyre, 0, 0, 0, bone);
          if (nx > 0) this.quad(b2, b2 + 1, b2 + 2, b2 + 3); else this.quad(b2, b2 + 3, b2 + 2, b2 + 1); }
      }
      // rim: dark dish, five spokes, hub cap; the outer face gets the detail, the inner face a plain disc
      for (const [x, nx] of [[x0, -1], [x1, 1]]) {
        const rr = r * 0.86; const c = this.vert(x, cy, cz, nx, 0, 0, ...rimDk, 0, 0, 0, bone);
        for (let k = 0; k < segs; k++) { const a0 = k / segs * M.TAU, a1 = (k + 1) / segs * M.TAU; const p0 = this.vert(x, cy + Math.cos(a0) * rr, cz + Math.sin(a0) * rr, nx, 0, 0, ...rimDk, 0, 0, 0, bone), p1 = this.vert(x, cy + Math.cos(a1) * rr, cz + Math.sin(a1) * rr, nx, 0, 0, ...rimDk, 0, 0, 0, bone); if (nx > 0) this.tri(c, p0, p1); else this.tri(c, p1, p0); }
        const xo = x + nx * 0.012;
        for (let sp = 0; sp < 5; sp++) { const a = sp / 5 * M.TAU, hw = 0.13; const ax = Math.cos(a), az = Math.sin(a), px = -az, pz = ax; const r0 = r * 0.2, r1 = r * 0.8;
          const pts = [[xo, cy + ax * r0 + px * hw * r0, cz + az * r0 + pz * hw * r0], [xo, cy + ax * r1 + px * hw * 0.5, cz + az * r1 + pz * hw * 0.5], [xo, cy + ax * r1 - px * hw * 0.5, cz + az * r1 - pz * hw * 0.5], [xo, cy + ax * r0 - px * hw * r0, cz + az * r0 - pz * hw * r0]];
          this.polyOut(pts, rim, x - nx, cy, cz, 0, bone); }
        const hub = this.vert(xo + nx * 0.01, cy, cz, nx, 0, 0, ...rim, 0, 0, 0, bone); const hr = r * 0.24;
        for (let k = 0; k < 10; k++) { const a0 = k / 10 * M.TAU, a1 = (k + 1) / 10 * M.TAU; const p0 = this.vert(xo + nx * 0.01, cy + Math.cos(a0) * hr, cz + Math.sin(a0) * hr, nx, 0, 0, ...rim, 0, 0, 0, bone), p1 = this.vert(xo + nx * 0.01, cy + Math.cos(a1) * hr, cz + Math.sin(a1) * hr, nx, 0, 0, ...rim, 0, 0, 0, bone); if (nx > 0) this.tri(hub, p0, p1); else this.tri(hub, p1, p0); }
      }
      return this;
    }
    // Quad from 4 points whose normal is forced to point away from (cx, cy, cz).
    // Tilted cylinder from p0 to p1 with end radii r0/r1 (frame tubes, forks, exhausts, rails).
    tube(p0, p1, r0, r1, col, tile = 0, bone = 0, n = 6) {
      const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2]; const l = Math.hypot(ax, ay, az) || 1; const ux = ax / l, uy = ay / l, uz = az / l;
      const ref = Math.abs(uy) < 0.9 ? [0, 1, 0] : [1, 0, 0]; let bx = uy * ref[2] - uz * ref[1], by = uz * ref[0] - ux * ref[2], bz = ux * ref[1] - uy * ref[0]; const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
      const cx = uy * bz - uz * by, cy = uz * bx - ux * bz, cz = ux * by - uy * bx;
      const ring = (p, r) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r; pts.push([p[0] + bx * ca + cx * sa, p[1] + by * ca + cy * sa, p[2] + bz * ca + cz * sa]); } return pts; };
      return this.loft([ring(p0, r0), ring(p1, r1)], col, tile, bone, { closed: true, capStart: true, capEnd: true, smooth: n > 5 });
    }
    polyOut(pts, col, cx, cy, cz, tile = 0, bone = 0) {
      const [ax, ay, az] = pts[0], [bx, by, bz] = pts[1], [qx, qy, qz] = pts[2];
      const nx = (by - ay) * (qz - az) - (bz - az) * (qy - ay), ny = (bz - az) * (qx - ax) - (bx - ax) * (qz - az), nz = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
      let mx = 0, my = 0, mz = 0; for (const p of pts) { mx += p[0]; my += p[1]; mz += p[2]; } mx /= pts.length; my /= pts.length; mz /= pts.length;
      const flip = nx * (mx - cx) + ny * (my - cy) + nz * (mz - cz) < 0;
      return this.poly(flip ? pts.slice().reverse() : pts, col, tile, null, bone);
    }
    // Loft: rings are arrays of [x,y,z] with the same length; consecutive rings are joined by quads with smooth
    // normals that always point away from the ring's own centre. opts.pick(normal, i, k) may return another
    // Builder to receive a quad (or null to drop it): that is how a car roof and its glass share one surface.
    loft(rings, col, tile = 0, bone = 0, opts = {}) {
      const { closed = true, capStart = false, capEnd = false, pick = null, smooth = true } = opts;
      const R = rings.length, N = rings[0].length, [cr, cg, cb] = col;
      const cen = rings.map(r => { let x = 0, y = 0, z = 0; for (const p of r) { x += p[0]; y += p[1]; z += p[2]; } return [x / N, y / N, z / N]; });
      const segs = closed ? N : N - 1;
      // face normals, oriented outward
      const fn = []; for (let i = 0; i + 1 < R; i++) { fn.push([]); for (let k = 0; k < segs; k++) {
        const a = rings[i][k], b = rings[i][(k + 1) % N], c = rings[i + 1][(k + 1) % N], d = rings[i + 1][k];
        let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) < 1e-9) { nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]); ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]); nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]); }
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - (cen[i][0] + cen[i + 1][0]) / 2, my = (a[1] + b[1] + c[1] + d[1]) / 4 - (cen[i][1] + cen[i + 1][1]) / 2, mz = (a[2] + b[2] + c[2] + d[2]) / 4 - (cen[i][2] + cen[i + 1][2]) / 2;
        const flip = nx * mx + ny * my + nz * mz < 0; fn[i].push(flip ? [-nx, -ny, -nz, true] : [nx, ny, nz, false]); } }
      // vertex normals: average of the touching faces
      const vn = (i, k) => { let x = 0, y = 0, z = 0; const add = (fi, fk) => { if (fi < 0 || fi >= fn.length) return; if (closed) fk = (fk + segs) % segs; else if (fk < 0 || fk >= segs) return; const f = fn[fi][fk]; x += f[0]; y += f[1]; z += f[2]; };
        if (smooth) { add(i, k); add(i, k - 1); add(i - 1, k); add(i - 1, k - 1); } const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
      for (let i = 0; i + 1 < R; i++) for (let k = 0; k < segs; k++) {
        const f = fn[i][k]; const target = pick ? pick(f, i, k) : this; if (!target) continue;
        const k1 = (k + 1) % N; const pts = [rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]]; const ns = smooth ? [vn(i, k), vn(i, k1), vn(i + 1, k1), vn(i + 1, k)] : [f, f, f, f];
        const base = target.n; for (let j = 0; j < 4; j++) { const p = pts[j], n = ns[j]; target.vert(p[0], p[1], p[2], n[0], n[1], n[2], cr, cg, cb, 0, 0, tile, bone); }
        if (f[3]) target.quad(base, base + 3, base + 2, base + 1); else target.quad(base, base + 1, base + 2, base + 3);
      }
      const cap = (ri, other) => { const r = rings[ri], c = cen[ri]; let nx = c[0] - cen[other][0], ny = c[1] - cen[other][1], nz = c[2] - cen[other][2]; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const cv = this.vert(c[0], c[1], c[2], nx, ny, nz, cr, cg, cb, 0, 0, tile, bone);
        for (let k = 0; k < segs; k++) { const a = r[k], b = r[(k + 1) % N]; const va = this.vert(a[0], a[1], a[2], nx, ny, nz, cr, cg, cb, 0, 0, tile, bone), vb = this.vert(b[0], b[1], b[2], nx, ny, nz, cr, cg, cb, 0, 0, tile, bone);
          const tx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ty = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), tz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          if (tx * nx + ty * ny + tz * nz > 0) this.tri(va, vb, cv); else this.tri(vb, va, cv); } };
      if (capStart) cap(0, 1); if (capEnd) cap(R - 1, R - 2);
      return this;
    }
    // Ellipsoid (or a slice of one) centred at (cx,cy,cz). lat0/lat1 in [-1,1] select a band; az0/az1 (radians) a wedge.
    sphere(cx, cy, cz, rx, ry, rz, col, opts = {}) {
      const { segs = 12, rings = 7, lat0 = -1, lat1 = 1, az0 = 0, az1 = M.TAU, bone = 0, tile = 0 } = opts;
      const closed = az1 - az0 >= M.TAU - 1e-6; const N = closed ? segs : segs + 1; const rs = [];
      for (let i = 0; i <= rings; i++) { const t = lat0 + (lat1 - lat0) * i / rings; const ph = t * Math.PI / 2; const cy0 = Math.sin(ph), cr0 = Math.max(Math.cos(ph), 0.02); const ring = [];
        for (let k = 0; k < N; k++) { const a = az0 + (az1 - az0) * k / segs; ring.push([cx + Math.cos(a) * cr0 * rx, cy + cy0 * ry, cz + Math.sin(a) * cr0 * rz]); } rs.push(ring); }
      return this.loft(rs, col, tile, bone, { closed, capStart: lat0 > -1 + 1e-6 || !closed, capEnd: lat1 < 1 - 1e-6 || !closed });
    }
    // Box with every edge rounded by radius r; sits from y to y+h.
    roundedBox(x, y, z, w, h, d, r, col, tile = 0, bone = 0, opts = {}) {
      const { n = 2, skipBottom = false } = opts; r = Math.min(r, w / 2 - 0.001, d / 2 - 0.001, h / 2 - 0.001); const cx = x + w / 2, cz = z + d / 2; const rings = [];
      const steps = 3; const ys = [];
      for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI / 2; ys.push([y + r - Math.cos(a) * r, r - Math.sin(a) * r]); }
      for (let i = steps; i >= 0; i--) { const a = i / steps * Math.PI / 2; ys.push([y + h - r + Math.cos(a) * r, r - Math.sin(a) * r]); }
      for (const [yy, inset] of ys) rings.push(Builder.rrect(cx, cz, w / 2 - inset, d / 2 - inset, Math.max(0.001, r - inset), n, yy, 'y'));
      return this.loft(rings, col, tile, bone, { capStart: !skipBottom, capEnd: true });
    }
    // Rounded rectangle ring: half sizes hw/hd, corner radius r, n points per corner; plane 'y' (xz at height c) or 'z' (xy at depth c).
    static rrect(cx, cz, hw, hd, r, n, c, plane = 'y', rTop = null) {
      const pts = []; r = Math.min(r, hw, hd); const rt = rTop === null ? r : Math.min(rTop, hw, hd);
      const corner = (sx, sz, rad, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + sx * (hw - rad) + Math.cos(a) * rad, cz + sz * (hd - rad) + Math.sin(a) * rad]); } };
      corner(1, 1, rt, 0); corner(-1, 1, rt, Math.PI / 2); corner(-1, -1, r, Math.PI); corner(1, -1, r, Math.PI * 1.5);
      return pts.map(([a, b]) => plane === 'y' ? [a, c, b] : [a, b, c]);
    }
    append(other, dx = 0, dy = 0, dz = 0) {
      const base = this.n; const v = other.v;
      for (let k = 0; k < v.length; k += 13) { this.v.push(v[k] + dx, v[k + 1] + dy, v[k + 2] + dz); for (let j = 3; j < 13; j++) this.v.push(v[k + j]); this.n++; }
      for (const idx of other.i) this.i.push(idx + base);
      return this;
    }
    build(dynamic = false) { return GL.mesh(new Float32Array(this.v), new Uint32Array(this.i), dynamic, this.skin || null); }
    // One mesh whose triangles are grouped by the ground cell their centre falls in, each group with its bounding box, so the
    // renderer can draw only the cells a camera or the shadow light can see.
    buildChunked(cell) {
      const v = this.v, idx = this.i, nt = idx.length / 3; const groups = new Map();
      for (let t = 0; t < nt; t++) { const a = idx[t * 3] * 13, b = idx[t * 3 + 1] * 13, c = idx[t * 3 + 2] * 13;
        const key = (Math.floor((v[a] + v[b] + v[c]) / (3 * cell)) + 64) * 4096 + Math.floor((v[a + 2] + v[b + 2] + v[c + 2]) / (3 * cell)) + 64;
        let g = groups.get(key); if (!g) groups.set(key, g = []); g.push(t); }
      const out = new Uint32Array(idx.length); const chunks = []; let off = 0;
      for (const g of groups.values()) { const first = off; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const t of g) for (let k = 0; k < 3; k++) { const vi = idx[t * 3 + k]; out[off++] = vi; const o = vi * 13; for (let d = 0; d < 3; d++) { const val = v[o + d]; if (val < mn[d]) mn[d] = val; if (val > mx[d]) mx[d] = val; } }
        chunks.push({ first, count: off - first, min: mn, max: mx }); }
      const m = GL.mesh(new Float32Array(v), out); m.chunks = chunks; return m;
    }
    buildInstanced(max) { return GL.instancedMesh(new Float32Array(this.v), new Uint32Array(this.i), max); }
  }

  // ---- Vehicles. Local frame: +z forward, +x left, y up, origin on the ground under the car's centre.
  // Bones: 0 body, 1 FL wheel, 2 FR wheel, 3 RL wheel, 4 RR wheel, 5 light bar / extra.
  const VEHICLES = {
    sedan:   { len: 4.6, wid: 2.0, hgt: 1.45, cabin: [0.32, 0.66], wheelR: 0.36, mass: 1.0, accel: 11, top: 26, grip: 0.92, turn: 2.4, brake: 24, seats: 4, hood: 0.9 },
    sports:  { len: 4.4, wid: 2.0, hgt: 1.24, cabin: [0.27, 0.63], wheelR: 0.36, mass: 0.95, accel: 16, top: 36, grip: 0.95, turn: 2.8, brake: 30, seats: 2, hood: 0.7 },
    hatch:   { len: 3.8, wid: 1.85, hgt: 1.5, cabin: [0.3, 0.75], wheelR: 0.33, mass: 0.85, accel: 10, top: 24, grip: 0.9, turn: 2.6, brake: 22, seats: 4, hood: 0.85 },
    pickup:  { len: 5.2, wid: 2.1, hgt: 1.8, cabin: [0.28, 0.55], wheelR: 0.42, mass: 1.3, accel: 10, top: 25, grip: 0.86, turn: 2.1, brake: 22, seats: 2, hood: 1.1, bed: true },
    van:     { len: 5.2, wid: 2.1, hgt: 2.2, cabin: [0.2, 0.95], wheelR: 0.38, mass: 1.4, accel: 8, top: 22, grip: 0.84, turn: 2.0, brake: 20, seats: 4, hood: 1.0 },
    taxi:    { len: 4.6, wid: 2.0, hgt: 1.45, cabin: [0.32, 0.66], wheelR: 0.36, mass: 1.0, accel: 11, top: 27, grip: 0.92, turn: 2.4, brake: 24, seats: 4, hood: 0.9, taxi: true },
    police:  { len: 4.8, wid: 2.05, hgt: 1.5, cabin: [0.32, 0.66], wheelR: 0.37, mass: 1.1, accel: 14, top: 32, grip: 0.94, turn: 2.6, brake: 28, seats: 4, hood: 0.9, police: true },
    truck:   { len: 7.5, wid: 2.4, hgt: 3.0, cabin: [0.0, 0.3], wheelR: 0.5, mass: 2.6, accel: 6, top: 20, grip: 0.8, turn: 1.6, brake: 16, seats: 2, hood: 0.4, box: true },
    bus:     { len: 9.5, wid: 2.5, hgt: 3.0, cabin: [0.0, 1.0], wheelR: 0.5, mass: 3.0, accel: 5, top: 19, grip: 0.8, turn: 1.4, brake: 15, seats: 4, hood: 0.0, bus: true },
    muscle:  { len: 4.9, wid: 2.05, hgt: 1.38, cabin: [0.34, 0.66], wheelR: 0.38, mass: 1.15, accel: 15, top: 33, grip: 0.86, turn: 2.5, brake: 26, seats: 2, hood: 1.0 },
    swat:    { len: 5.6, wid: 2.3, hgt: 2.4, cabin: [0.2, 0.9], wheelR: 0.42, mass: 1.8, accel: 10, top: 26, grip: 0.9, turn: 2.0, brake: 24, seats: 4, hood: 0.9, police: true, armor: true },
    bike:    { len: 2.2, wid: 0.8, hgt: 1.15, cabin: null, wheelR: 0.33, mass: 0.35, accel: 17, top: 38, grip: 0.9, turn: 3.0, brake: 26, seats: 1, hood: 0, bike: true },
    boat:    { len: 6.2, wid: 2.4, hgt: 1.5, cabin: null, wheelR: 0.3, mass: 1.2, accel: 11, top: 24, grip: 0.4, turn: 1.4, brake: 6, seats: 2, hood: 0, boat: true },
    ferry:   { len: 15, wid: 5, hgt: 4, cabin: null, wheelR: 0.3, mass: 5, accel: 4, top: 9, grip: 0.4, turn: 0.5, brake: 3, seats: 6, hood: 0, boat: true, ferry: true },
    // imported models (js/assets.js): the body is the model, wheels are its wheel parts on the usual bones, axle positions come from the model
    ktruck:  { len: 4.2, wid: 2.25, hgt: 1.8, cabin: [0.3, 0.6], wheelR: 0.45, mass: 1.35, accel: 10, top: 25, grip: 0.86, turn: 2.1, brake: 22, seats: 2, hood: 1.0, model: 'ktruck', modelScale: 1.5, axleF: 1.29, axleR: -0.99, track: 0.83, seatY: 0.66, seatScale: 0.8 },
    kmoto:   { len: 2.0, wid: 0.8, hgt: 1.15, cabin: null, wheelR: 0.345, mass: 0.4, accel: 16, top: 36, grip: 0.9, turn: 3.0, brake: 25, seats: 1, hood: 0, bike: true, model: 'kmoto', modelScale: 1.15, axleF: 0.99, axleR: -0.76, track: 0, seatY: 0.68, seatScale: 1, seatZ: -0.5 },
    kgarbage:  { len: 5.5, wid: 2.56, hgt: 2.85, cabin: [0.28, 0.5], wheelR: 0.48, mass: 2.4, accel: 6, top: 19, grip: 0.82, turn: 1.7, brake: 17, seats: 2, hood: 0.6, model: 'kgarbage', modelScale: 1.6, axleF: 1.78, axleR: -0.82, track: 0.72, seatY: 1.15, seatScale: 0.85 },
    kambulance: { len: 4.9, wid: 2.25, hgt: 2.85, cabin: [0.3, 0.55], wheelR: 0.45, mass: 1.7, accel: 11, top: 27, grip: 0.9, turn: 2.1, brake: 24, seats: 2, hood: 0.7, model: 'kambulance', modelScale: 1.5, axleF: 1.52, axleR: -1.37, track: 0.68, seatY: 1.15, seatScale: 0.85 },
    kfire:     { len: 5.4, wid: 2.48, hgt: 2.97, cabin: [0.3, 0.52], wheelR: 0.5, mass: 2.6, accel: 8, top: 24, grip: 0.86, turn: 1.8, brake: 20, seats: 2, hood: 0.7, model: 'kfire', modelScale: 1.65, axleF: 1.58, axleR: -1.09, track: 0.91, seatY: 1.2, seatScale: 0.85 },
  };

  // Height of the seat cushion in car-local space: a seated ped is 1.05 m from hip to crown, so it sits that far below the roof.
  function seatHeight(s) { return seatFit(s).y; }
  // Seat height plus a body scale for low cabins: a seated ped is 1.05 m from hip to crown, so in a sports car it shrinks a little rather than wearing the roof.
  function seatFit(s) { if (s.seatY !== undefined) return { y: s.seatY, scale: s.seatScale || 1 }; if (s.bike) return { y: 0.8, scale: 1 }; if (s.boat) return { y: 0.42, scale: 1 }; const wr = s.wheelR, floorY = wr * 0.9, bodyH = s.hgt * 0.46, cabinY = floorY + bodyH, cabinH = s.hgt - bodyH - floorY * 0.6;
    if (s.bus) return { y: floorY + 0.3, scale: 1 }; const roof = s.box ? cabinY - 0.05 + cabinH * 1.2 : (s.armor || !s.cabin || s.hgt > 2.0) ? s.hgt : cabinY + cabinH; const y = Math.max(floorY + 0.08, roof - 1.05); return { y, scale: M.clamp((roof - y - 0.03) / 1.05, 0.8, 1) }; }
  // Returns { body, glass } builders. opts.dent (0..1) crumples the body, opts.seed varies the dents.
  // Bodies are lofted from rounded cross-sections so the panels curve; the greenhouse is one surface whose
  // roof quads go to the body and whose side/front/back quads go to the translucent glass builder.
  function carMesh(type, col, opts = {}) {
    const s = VEHICLES[type], b = new Builder(), gb = new Builder(); const L = s.len, W = s.wid, H = s.hgt, wr = s.wheelR; const LOD = !!opts.lod; // distant version: coarser rings, no trim
    const dark = [0.12, 0.13, 0.15], glass = [0.28, 0.38, 0.48], chrome = [0.8, 0.82, 0.85], rubber = [0.08, 0.08, 0.09]; // tinted glass so the cabin reads as a shape
    const body = col, bodyDk = col.map(c => c * 0.72), roofCol = col.map(c => c * 0.86);
    const floorY = wr * 0.9, bodyH = H * 0.46, cabinY = floorY + bodyH, cabinH = H - bodyH - floorY * 0.6;
    const half = L / 2, hw = W / 2;
    const lightBox = (x, y, z, w, h, colr, face, bone) => b.cbox(x, y, z, w, h, 0.08, colr, 0, { faces: face, bone });
    const ring = (z, y0, y1, halfW, rTop, rBot) => Builder.rrect(0, (y0 + y1) / 2, halfW, (y1 - y0) / 2, rBot, LOD ? 1 : 3, z, 'z', rTop);
    const mirrors = (y, z, mountHalfW = hw) => { if (LOD) return; for (const sx of [1, -1]) { b.cbox(sx * (mountHalfW + 0.12), y, z, 0.16, 0.11, 0.2, bodyDk); b.cbox(sx * (mountHalfW + 0.05), y, z, 0.16, 0.04, 0.04, bodyDk); b.cbox(sx * (mountHalfW + 0.12), y, z - 0.101, 0.13, 0.08, 0.005, [0.75, 0.8, 0.85], 0, { faces: 32 }); } };
    const plate = (z, face) => { if (LOD) return; b.cbox(0, floorY + 0.36, z, 0.52, 0.16, 0.02, [0.92, 0.92, 0.88], 0, { faces: face }); b.cbox(0, floorY + 0.36, z + (face === 16 ? -0.005 : 0.005), 0.56, 0.2, 0.02, dark, 0, { faces: face }); };
    const wheelArch = (ax, az) => { if (LOD) return; const sx = Math.sign(ax); const x = ax + sx * 0.006; for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI, a1 = (k + 1) / 8 * Math.PI; const r0 = wr + 0.05, r1 = wr + 0.11;
      b.polyOut([[x, wr + Math.sin(a0) * r0, az + Math.cos(a0) * r0], [x, wr + Math.sin(a1) * r0, az + Math.cos(a1) * r0], [x, wr + Math.sin(a1) * r1, az + Math.cos(a1) * r1], [x, wr + Math.sin(a0) * r1, az + Math.cos(a0) * r1]], bodyDk.map(c => c * 0.55), 0, wr, az); } };
    const grille = (y, z, w, h) => { b.cbox(0, y, z, w, h, 0.06, dark, 0, { faces: 16 }); if (!LOD) for (let k = 0; k < 3; k++) b.cbox(0, y - h / 2 + (k + 0.5) * h / 3, z + 0.01, w, 0.02, 0.04, chrome, 0, { faces: 16 }); };
    const bumper = (z, colr) => { const d = 0.22; b.roundedBox(-hw * 0.98, floorY + 0.02, z > 0 ? z - d / 2 : z - d / 2, W * 0.96, 0.32, d, 0.09, colr); };
    if (s.model) { assetVehicle(b, s, col); if (opts.dent > 0) dentBody(b, opts.dent * 0.5, opts.seed || 1); return { body: b, glass: gb }; }
    if (s.bike) { bikeMesh(b, s, col, LOD); if (opts.dent > 0) dentBody(b, opts.dent * 0.5, opts.seed || 1); return { body: b, glass: gb }; }
    if (s.boat) { boatMesh(b, gb, s, col, LOD); if (opts.dent > 0) { dentBody(b, opts.dent * 0.6, opts.seed || 1); dentBody(gb, opts.dent * 0.6, opts.seed || 1); } return { body: b, glass: gb }; }
    if (s.bus) {
      b.roundedBox(-hw, floorY, -half, W, H - floorY, L, 0.16, body);
      // window band all round, front screen and a door
      gb.cbox(0, floorY + (H - floorY) * 0.64, 0, W + 0.02, (H - floorY) * 0.36, L * 0.94, glass, 0, { faces: 3 });
      gb.cbox(0, floorY + (H - floorY) * 0.6, half - 0.05, W * 0.86, (H - floorY) * 0.5, 0.14, glass, 0, { faces: 16 });
      for (let k = 0; k < 6; k++) for (const sx of [1, -1]) b.cbox(sx * (hw + 0.012), floorY + (H - floorY) * 0.64, -half + 0.6 + k * (L - 1.2) / 5, 0.01, (H - floorY) * 0.38, 0.06, bodyDk, 0, { faces: sx > 0 ? 1 : 2 });
      b.cbox(0, floorY + (H - floorY) * 0.43, 0, W + 0.015, 0.05, L * 0.94, bodyDk); // belt trim
      b.roundedBox(-W * 0.4, H, -half + 0.5, W * 0.8, 0.22, L - 1, 0.08, roofCol); b.cbox(0, H + 0.25, 0, 0.4, 0.08, 0.6, dark); // roof pod
      for (const sx of [1, -1]) for (const dz of [half - 1.6, -half + 2.6]) b.cbox(sx * (hw + 0.012), floorY + (H - floorY) * 0.35, dz, 0.01, (H - floorY) * 0.62, 1.2, bodyDk, 0, { faces: sx > 0 ? 1 : 2 });
      lightBox(W * 0.35, floorY + 0.9, half + 0.01, 0.34, 0.22, [1, 1, 0.9], 16, 5); lightBox(-W * 0.35, floorY + 0.9, half + 0.01, 0.34, 0.22, [1, 1, 0.9], 16, 5);
      lightBox(W * 0.38, floorY + 0.9, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6); lightBox(-W * 0.38, floorY + 0.9, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6);
      b.cbox(0, H - 0.35, half + 0.02, W * 0.7, 0.35, 0.05, [0.95, 0.6, 0.1], 0, { faces: 16, bone: 7 });
      bumper(half + 0.02, dark); bumper(-half - 0.02 + 0.22, dark); mirrors(H * 0.72, half - 0.2); plate(-half - 0.012, 32);
    } else if (s.box) {
      const cabL = L * 0.3;
      const cabBack = half - cabL * 0.9 - 0.1, cabFront = cabBack + cabL * 0.8;
      const cabHalfW = hw * 0.94, cabBottom = cabinY - 0.05, cabTop = cabBottom + cabinH * 1.2;
      b.roundedBox(-hw, floorY, half - cabL, W, bodyH, cabL, 0.12, body); // lower cab
      b.roundedBox(-cabHalfW, cabBottom, cabBack, cabHalfW * 2, cabTop - cabBottom, cabFront - cabBack, 0.14, body);
      // Panes sit on the flat part of the actual cab, clear of its rounded corners.
      // The old glass box was centred near the bumper and extended beyond the vehicle.
      const winBottom = cabinY + cabinH * 0.4, winTop = cabTop - 0.22, gap = 0.012;
      gb.box(-cabHalfW - gap, winBottom, cabBack + 0.2, (cabHalfW + gap) * 2, winTop - winBottom, cabFront - cabBack - 0.4, glass, 0, { faces: 3 });
      gb.box(-cabHalfW + 0.2, winBottom, cabFront + gap, cabHalfW * 2 - 0.4, winTop - winBottom, 0, glass, 0, { faces: 16 });
      b.cbox(0, cabTop - 0.12, cabFront + 0.06, W * 0.9, 0.12, 0.25, bodyDk); // sun visor
      b.roundedBox(-hw, floorY, -half, W, H - floorY, L - cabL - 0.3, 0.08, [0.85, 0.85, 0.82]); // cargo box
      for (let k = 1; k < 6; k++) b.cbox(0, floorY + (H - floorY) / 2, -half + k * (L - cabL - 0.3) / 6, W + 0.02, H - floorY - 0.2, 0.03, [0.72, 0.72, 0.7]); // box ribs
      b.cbox(0, floorY + (H - floorY) / 2, -half + (L - cabL - 0.3) / 2, W + 0.02, 0.06, L - cabL - 0.3, [0.6, 0.6, 0.6]);
      lightBox(W * 0.35, floorY + 0.5, half + 0.01, 0.35, 0.25, [1, 1, 0.9], 16, 5); lightBox(-W * 0.35, floorY + 0.5, half + 0.01, 0.35, 0.25, [1, 1, 0.9], 16, 5);
      lightBox(W * 0.4, floorY + 0.4, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6); lightBox(-W * 0.4, floorY + 0.4, -half - 0.01, 0.3, 0.2, [1, 0.1, 0.1], 32, 6);
      grille(floorY + bodyH * 0.55, half + 0.01, W * 0.5, 0.35); bumper(half + 0.02, dark); mirrors(cabinY + cabinH * 0.5, cabFront - 0.18, cabHalfW); plate(half + 0.012, 16);
      b.cyl(W * 0.3, floorY + bodyH * 0.6, half - cabL * 0.9, 0.07, floorY + bodyH * 0.6 + 1.3, chrome, 0, 8); // exhaust stack
      for (const sx of [1, -1]) b.cbox(sx * (hw - 0.3), floorY - 0.05, half - cabL * 0.5, 0.5, 0.06, 0.6, dark); // step
    } else if (s.armor || type === 'van') {
      // van and SWAT truck: tall rounded body with a sloped nose
      const noseZ = half - 0.9;
      const rs = [ring(-half, floorY + 0.06, H - 0.12, hw - 0.1, 0.18, 0.1), ring(-half + 0.12, floorY, H, hw, 0.2, 0.1), ring(noseZ - 0.4, floorY, H, hw, 0.2, 0.1), ring(noseZ, floorY, H - 0.05, hw, 0.22, 0.1),
        ring(noseZ + 0.45, floorY, cabinY + 0.35, hw - 0.02, 0.16, 0.1), ring(half - 0.12, floorY, cabinY + 0.02, hw - 0.04, 0.12, 0.1), ring(half, floorY + 0.08, cabinY - 0.12, hw - 0.14, 0.1, 0.08)];
      b.loft(rs, body, 0, 0, { capStart: true, capEnd: true });
      // windscreen lies along the nose slope, side windows in the cab, rear doors seams
      const screenBottom = cabinY + 0.4, screenTop = H - 0.15, screenHalfW = hw - 0.26;
      const screenZ = y => noseZ + 0.45 * (H - 0.05 - y) / (H - 0.05 - cabinY - 0.35) + 0.012;
      gb.polyOut([[screenHalfW, screenBottom, screenZ(screenBottom)], [screenHalfW, screenTop, screenZ(screenTop)], [-screenHalfW, screenTop, screenZ(screenTop)], [-screenHalfW, screenBottom, screenZ(screenBottom)]], glass, 0, cabinY, 0);
      gb.cbox(0, cabinY + (H - cabinY) * 0.5, noseZ - 0.7, W + 0.02, (H - cabinY) * 0.55, 1.1, glass, 0, { faces: 3 });
      if (!s.armor) gb.cbox(0, cabinY + (H - cabinY) * 0.5, -half - 0.012, W * 0.7, (H - cabinY) * 0.5, 0, glass, 0, { faces: 32 });
      for (const sx of [1, -1]) { b.cbox(sx * (hw + 0.006), (floorY + H) / 2, noseZ - 1.3, 0.01, (H - floorY) * 0.8, 0.05, dark, 0, { faces: sx > 0 ? 1 : 2 }); b.cbox(sx * (hw + 0.006), (floorY + H) / 2, -half + 0.05 + (L - 1.2) * 0.3, 0.01, (H - floorY) * 0.8, 0.05, dark, 0, { faces: sx > 0 ? 1 : 2 }); }
      b.cbox(0, (floorY + H) / 2, -half - 0.005, 0.03, (H - floorY) * 0.85, 0.02, dark, 0, { faces: 32 }); // rear door split
      lightBox(W * 0.36, cabinY - 0.05, half + 0.01, 0.4, 0.22, [1, 1, 0.92], 16, 5); lightBox(-W * 0.36, cabinY - 0.05, half + 0.01, 0.4, 0.22, [1, 1, 0.92], 16, 5);
      lightBox(W * 0.4, floorY + 0.9, -half - 0.01, 0.22, 0.5, [1, 0.08, 0.06], 32, 6); lightBox(-W * 0.4, floorY + 0.9, -half - 0.01, 0.22, 0.5, [1, 0.08, 0.06], 32, 6);
      grille(cabinY - 0.05, half + 0.005, W * 0.42, 0.24); bumper(half + 0.02, dark); bumper(-half + 0.2, dark); mirrors(cabinY + 0.5, noseZ + 0.1); plate(half + 0.012, 16); plate(-half - 0.012, 32);
      if (s.armor) { b.cbox(0, cabinY + (H - cabinY) * 0.5, noseZ - 0.7, W + 0.05, (H - cabinY) * 0.2, 1.2, bodyDk); b.cbox(0, cabinY - 0.02, half + 0.25, W * 0.9, 0.45, 0.3, dark); b.cbox(0, floorY + 0.25, 0, W + 0.06, 0.3, L * 0.7, bodyDk); }
      if (s.police) { b.cbox(0, H + 0.1, noseZ - 0.9, 1.3, 0.22, 0.35, dark); b.cbox(0.4, H + 0.12, noseZ - 0.9, 0.5, 0.26, 0.38, [1, 0.1, 0.1], 0, { bone: 8 }); b.cbox(-0.4, H + 0.12, noseZ - 0.9, 0.5, 0.26, 0.38, [0.1, 0.3, 1], 0, { bone: 9 }); }
      b.cbox(0, H + 0.02, -half + 1.2, 0.05, 0.05, 1.6, dark); // roof rib
    } else {
      const c0 = half - s.cabin[0] * L - s.hood * 0.5, c1 = half - s.cabin[1] * L - s.hood * 0.5; // cabin front / back (z)
      const cw = W * 0.9; const belt = floorY + bodyH * (s.sports ? 0.5 : 0.62); const topY = floorY + bodyH;
      const hoodFront = belt + (s.sports ? 0.06 : 0.14), trunkBack = belt + (s.sports ? 0.18 : 0.26);
      const hz0 = c0 + 0.35, tz0 = c1 - 0.35; const rTop = type === 'muscle' ? 0.1 : 0.16;
      // lower body: one loft from tail to nose
      const rs = [
        ring(-half, floorY + 0.1, trunkBack - 0.14, hw - 0.14, 0.12, 0.08), ring(-half + 0.14, floorY, trunkBack, hw - 0.02, rTop, 0.06), ring(tz0 - 0.1, floorY, topY - 0.02, hw, rTop, 0.06),
        ring(tz0 + 0.25, floorY, topY, hw, rTop, 0.06), ring(c1, floorY, topY, hw, rTop, 0.06), ring((c0 + c1) / 2, floorY, topY, hw, rTop, 0.06), ring(c0, floorY, topY, hw, rTop, 0.06), ring(hz0 - 0.2, floorY, topY, hw, rTop, 0.06),
        ring(hz0 + (half - hz0) * 0.5, floorY, (topY + hoodFront) / 2 + 0.02, hw, rTop, 0.06), ring(half - 0.14, floorY, hoodFront, hw - 0.02, rTop * 0.8, 0.06), ring(half, floorY + 0.1, hoodFront - 0.14, hw - 0.14, 0.1, 0.08)];
      if (s.bed) { rs.splice(1, 3, ring(-half + 0.14, floorY, belt + 0.3, hw - 0.02, 0.08, 0.06), ring(c1 - 0.05, floorY, belt + 0.3, hw, 0.08, 0.06), ring(c1, floorY, topY, hw, rTop, 0.06)); }
      b.loft(rs, body, 0, 0, { capStart: true, capEnd: true });
      // greenhouse: base ring at the body top, roof at cabin height; roof quads go to the body builder
      const ws = 0.55 * (s.sports ? 1.3 : 1), wsR = type === 'hatch' ? 0.25 : s.bed ? 0.1 : ws * 0.7; const roofY = cabinY + cabinH; const gw = cw / 2;
      const gr = [ring(c0 + ws, topY, topY + 0.015, gw - 0.03, 0.01, 0.01), ring(c0 + ws * 0.45, topY, topY + cabinH * 0.7, gw - 0.015, 0.1, 0.01), ring(c0, topY, roofY, gw, 0.14, 0.01), ring(c1, topY, roofY, gw, 0.14, 0.01),
        ring(c1 - wsR * 0.45, topY, topY + cabinH * (type === 'hatch' ? 0.85 : 0.72), gw - 0.015, 0.1, 0.01), ring(c1 - wsR, topY, topY + 0.015, gw - 0.03, 0.01, 0.01)];
      // Only the middle span is roof. Sloped windscreens can have upward normals too.
      b.loft(gr, roofCol, 0, 0, { pick: (n, span) => n[1] < -0.5 ? null : (span === 2 && n[1] > 0.55 ? b : gb) });
      for (let k = 0; k < gb.v.length; k += 13) { gb.v[k + 6] = glass[0]; gb.v[k + 7] = glass[1]; gb.v[k + 8] = glass[2]; }
      // pillars: outer strips in dark over the glass edges
      const pTop = roofY - 0.13; for (const sx of [1, -1]) { const x = sx * (gw + 0.008); b.polyOut([[x, topY, c0 + ws + 0.02], [x, pTop, c0 + ws * 0.22 + 0.02], [x, pTop, c0 + ws * 0.22 - 0.07], [x, topY, c0 + ws - 0.07]], bodyDk, 0, cabinY, c0); b.polyOut([[x, topY, c1 - wsR - 0.02], [x, pTop, c1 - wsR * 0.22 - 0.02], [x, pTop, c1 - wsR * 0.22 + 0.07], [x, topY, c1 - wsR + 0.07]], bodyDk, 0, cabinY, c1);
        if (s.seats > 2) b.cbox(x, (topY + pTop) / 2, (c0 + c1) / 2, 0.008, pTop - topY, 0.07, bodyDk); }
      // cabin floor and seats (visible through the glass); seats sit low enough that an occupant's head clears the roof
      const seatY = seatHeight(s); b.cbox(0, seatY - 0.3, (c0 + c1) / 2, cw - 0.1, 0.04, c0 - c1, [0.18, 0.17, 0.16]);
      const seatZ = (c0 + c1) / 2 - 0.1; for (const sx of [0.42, -0.42]) { b.roundedBox(sx * W * 0.5 - 0.25, seatY - 0.2, seatZ - 0.4, 0.5, 0.22, 0.5, 0.05, [0.22, 0.2, 0.18]); b.roundedBox(sx * W * 0.5 - 0.25, seatY - 0.05, seatZ - 0.44, 0.5, Math.min(0.62, roofY - 0.12 - seatY), 0.12, 0.05, [0.22, 0.2, 0.18]); }
      b.cyl(W * 0.22, seatY + 0.33, seatZ + 0.45, 0.18, seatY + 0.36, dark, 0, 12, 0, true, true); // steering wheel
      b.cbox(0, belt - 0.02, c0 + ws * 0.5, cw - 0.2, 0.08, ws * 0.8, [0.16, 0.15, 0.14]); // dashboard
      if (s.bed) { b.cbox(0, cabinY + 0.25, (c1 - half) / 2, W * 0.96, 0.5, c1 + half - 0.1, bodyDk); b.cbox(0, cabinY + 0.1, (c1 - half) / 2, W * 0.8, 0.1, c1 + half - 0.4, [0.2, 0.2, 0.2]); }
      // wheel arches, sills, door seams and handles
      const wzA = half * 0.62;
      for (const [ax, az] of [[hw, wzA], [-hw, wzA], [hw, -wzA], [-hw, -wzA]]) wheelArch(ax, az);
      if (!LOD) for (const sx of [1, -1]) { b.cbox(sx * (hw + 0.01), floorY + 0.1, 0, 0.04, 0.1, L * 0.55, bodyDk); const doors = s.seats > 2 ? [c0 - 0.05, (c0 + c1) / 2, c1 + 0.05] : [c0 - 0.05, c1 + 0.05];
        for (const dz of doors) b.cbox(sx * (hw + 0.005), (floorY + topY) / 2 + 0.05, dz, 0.01, (topY - floorY) * 0.8, 0.03, dark, 0, { faces: sx > 0 ? 1 : 2 });
        for (let k = 0; k + 1 < doors.length; k++) b.cbox(sx * (hw + 0.015), belt - 0.02, (doors[k] + doors[k + 1]) / 2 - 0.25, 0.02, 0.035, 0.16, chrome); }
      // bumpers, grille, plates, lights, mirrors
      bumper(half + 0.02, dark); bumper(-half - 0.02 + 0.22, dark);
      for (const sx of [1, -1]) { b.cbox(sx * W * 0.34, belt - 0.02, half + 0.005, 0.46, 0.24, 0.03, chrome, 0, { faces: 16 }); lightBox(sx * W * 0.34, belt - 0.02, half + 0.02, 0.42, 0.2, [1, 1, 0.92], 16, 5); lightBox(sx * W * 0.36, belt + 0.02, -half - 0.02, 0.4, 0.18, [1, 0.08, 0.06], 32, 6); b.cbox(sx * W * 0.36, belt + 0.02, -half - 0.005, 0.44, 0.22, 0.03, dark, 0, { faces: 32 }); }
      grille(belt - 0.05, half + 0.005, W * 0.36, 0.2); plate(half + 0.02, 16); plate(-half - 0.02, 32); mirrors(cabinY + cabinH * 0.3, c0 - 0.02);
      b.cbox(-W * 0.3, floorY + 0.06, -half - 0.02, 0.09, 0.07, 0.16, chrome); // exhaust
      if (s.taxi) { b.roundedBox(-0.45, roofY + 0.02, (c0 + c1) / 2 - 0.2, 0.9, 0.28, 0.4, 0.06, [1, 0.85, 0.1], 0, 7); b.cbox(0, (floorY + belt) / 2 + 0.02, (c0 + c1) / 2, W + 0.02, (belt - floorY) * 0.95, (c0 - c1) * 0.95, [1, 1, 1], TEX.names.taxi, { faces: 3, uvScale: (c0 - c1) * 0.95, uvScaleV: (belt - floorY) * 0.95 }); b.cyl(-hw * 0.6, roofY, c1 + 0.2, 0.012, roofY + 0.5, dark, 0, 5); }
      if (s.police) {
        b.cbox(0, roofY + 0.1, (c0 + c1) / 2, 1.3, 0.2, 0.35, dark);
        b.roundedBox(0.15, roofY + 0.02, (c0 + c1) / 2 - 0.19, 0.5, 0.26, 0.38, 0.05, [1, 0.1, 0.1], 0, 8); b.roundedBox(-0.65, roofY + 0.02, (c0 + c1) / 2 - 0.19, 0.5, 0.26, 0.38, 0.05, [0.1, 0.3, 1], 0, 9);
        b.cbox(0, (floorY + belt) / 2 + 0.02, (c0 + c1) / 2, W + 0.02, (belt - floorY) * 0.95, (c0 - c1) * 0.95, [1, 1, 1], TEX.names.police, { faces: 3, uvScale: (c0 - c1) * 0.95, uvScaleV: (belt - floorY) * 0.95 });
        b.cbox(0, belt + 0.02, half + 0.2, W * 0.9, 0.35, 0.3, dark); b.cyl(hw * 0.6, roofY, c1 + 0.2, 0.012, roofY + 0.6, dark, 0, 5); // push bar, antenna
      }
      if (s.sports || type === 'muscle') { b.roundedBox(-W * 0.45, trunkBack + 0.1, -half + 0.1, W * 0.9, 0.06, 0.32, 0.02, bodyDk); b.cbox(0.35 * W, trunkBack + 0.06, -half + 0.25, 0.06, 0.14, 0.06, bodyDk); b.cbox(-0.35 * W, trunkBack + 0.06, -half + 0.25, 0.06, 0.14, 0.06, bodyDk); b.cbox(W * 0.3, floorY + 0.06, -half - 0.02, 0.09, 0.07, 0.16, chrome); }
      if (type === 'muscle') { b.roundedBox(-0.25, topY + 0.02, half - 1.45, 0.5, 0.12, 1.1, 0.04, bodyDk); for (const sx of [1, -1]) b.cbox(sx * (hw * 0.6), belt + 0.15, -0.1, 0.02, 0.04, L * 0.5, [0.05, 0.05, 0.06]); } // hood scoop, side stripes
      if (s.sports) for (const sx of [1, -1]) b.cbox(sx * (hw - 0.02), floorY + 0.03, 0, 0.12, 0.06, L * 0.5, bodyDk); // side skirts
    }
    // wheels
    const wz = half * (s.bus ? 0.7 : 0.62), wx = hw - 0.05;
    const ws_ = LOD ? 8 : 16; b.wheel(wx, wr, wz, wr, 0.3, 1, ws_); b.wheel(-wx, wr, wz, wr, 0.3, 2, ws_); b.wheel(wx, wr, -wz, wr, 0.3, 3, ws_); b.wheel(-wx, wr, -wz, wr, 0.3, 4, ws_);
    if (opts.dent > 0) { dentBody(b, opts.dent, opts.seed || 1); dentBody(gb, opts.dent, opts.seed || 1); }
    return { body: b, glass: gb };
  }
  // Crumple: nudge body vertices (bone 0 only) by a hash of their position; the more dented, the further.
  // A motorcycle: two spoked wheels (bones 1 and 3), a tube frame, tank, seat and engine on the body, and the
  // fork, bars, front fender and mirrors on bone 10 so they turn with the steering.
  function bikeMesh(b, s, col, LOD) {
    const wr = s.wheelR, half = s.len / 2, wz = half * 0.62; const dark = [0.12, 0.13, 0.15], chrome = [0.8, 0.82, 0.85], leather = [0.15, 0.13, 0.12];
    const segs = LOD ? 8 : 16, n = LOD ? 5 : 8;
    b.wheel(0, wr, wz, wr, 0.11, 1, segs); b.wheel(0, wr, -wz, wr, 0.15, 3, segs);
    const head = [0, wr + 0.74, wz - 0.24], seatP = [0, wr + 0.6, -0.4], eng = [0, wr + 0.14, 0.05];
    b.tube(head, seatP, 0.035, 0.035, col, 0, 0, n); b.tube(head, eng, 0.03, 0.03, col, 0, 0, n); b.tube(seatP, [0, wr + 0.12, -0.25], 0.03, 0.03, col, 0, 0, n);
    for (const sx of [1, -1]) { b.tube([sx * 0.1, wr + 0.22, -0.2], [sx * 0.1, wr, -wz], 0.022, 0.022, dark, 0, 0, n); b.tube([sx * 0.16, wr + 0.42, -0.3], [sx * 0.1, wr + 0.02, -wz + 0.08], 0.018, 0.018, chrome, 0, 0, n); } // swingarm, shocks
    b.roundedBox(-0.17, wr, -0.16, 0.34, 0.36, 0.5, 0.05, dark); if (!LOD) for (let k = 0; k < 4; k++) b.cbox(0, wr + 0.08 + k * 0.08, 0.1, 0.4, 0.02, 0.34, chrome); // engine and fins
    b.roundedBox(-0.19, wr + 0.5, -0.12, 0.38, 0.3, 0.56, 0.1, col); // tank
    b.roundedBox(-0.16, wr + 0.62, -0.98, 0.32, 0.1, 0.62, 0.04, leather); b.roundedBox(-0.17, wr + 0.7, -1.0, 0.34, 0.12, 0.1, 0.03, leather); // seat and its lip
    b.tube([-0.14, wr + 0.06, 0.12], [-0.17, wr + 0.1, -half - 0.05], 0.035, 0.05, chrome, 0, 0, n); // exhaust on the right
    const fender = (cz, a0, a1, r0, r1, w, bone, colr) => { const k = LOD ? 3 : 7; for (let i = 0; i < k; i++) { const p = a0 + (a1 - a0) * i / k, q = a0 + (a1 - a0) * (i + 1) / k;
      b.polyOut([[-w / 2, wr + Math.sin(p) * r0, cz + Math.cos(p) * r0], [w / 2, wr + Math.sin(p) * r0, cz + Math.cos(p) * r0], [w / 2, wr + Math.sin(q) * r0, cz + Math.cos(q) * r0], [-w / 2, wr + Math.sin(q) * r0, cz + Math.cos(q) * r0]], colr, 0, wr, cz, 0, bone);
      b.polyOut([[-w / 2, wr + Math.sin(p) * r0, cz + Math.cos(p) * r0], [-w / 2, wr + Math.sin(p) * r1, cz + Math.cos(p) * r1], [-w / 2, wr + Math.sin(q) * r1, cz + Math.cos(q) * r1], [-w / 2, wr + Math.sin(q) * r0, cz + Math.cos(q) * r0]], colr, 0, wr, cz, 0, bone);
      b.polyOut([[w / 2, wr + Math.sin(p) * r0, cz + Math.cos(p) * r0], [w / 2, wr + Math.sin(p) * r1, cz + Math.cos(p) * r1], [w / 2, wr + Math.sin(q) * r1, cz + Math.cos(q) * r1], [w / 2, wr + Math.sin(q) * r0, cz + Math.cos(q) * r0]], colr, 0, wr, cz, 0, bone); } };
    fender(-wz, Math.PI * 0.15, Math.PI * 0.8, wr + 0.06, wr + 0.1, 0.2, 0, col);
    // steering assembly on bone 10
    for (const sx of [1, -1]) b.tube([sx * 0.085, wr + 0.92, wz - 0.27], [sx * 0.085, wr, wz], 0.022, 0.02, chrome, 0, 10, n);
    b.tube([-0.34, wr + 0.98, wz - 0.32], [0.34, wr + 0.98, wz - 0.32], 0.018, 0.018, dark, 0, 10, n); b.cbox(0, wr + 0.9, wz - 0.25, 0.14, 0.14, 0.14, dark, 0, { bone: 10 });
    if (!LOD) for (const sx of [1, -1]) { b.tube([sx * 0.3, wr + 0.98, wz - 0.32], [sx * 0.3, wr + 1.12, wz - 0.42], 0.01, 0.01, dark, 0, 10, n); b.cbox(sx * 0.3, wr + 1.14, wz - 0.42, 0.11, 0.07, 0.02, [0.75, 0.8, 0.85], 0, { bone: 10 }); } // mirrors
    fender(wz, Math.PI * 0.2, Math.PI * 0.85, wr + 0.06, wr + 0.1, 0.16, 10, col);
    b.cbox(0, wr + 0.8, wz - 0.1, 0.18, 0.16, 0.12, dark, 0, { bone: 10 }); b.cbox(0, wr + 0.8, wz - 0.03, 0.15, 0.13, 0.02, [1, 1, 0.92], 0, { faces: 16, bone: 5 }); // headlight
    b.cbox(0, wr + 0.62, -half - 0.02, 0.12, 0.06, 0.04, [1, 0.2, 0.2], 0, { faces: 32, bone: 6 }); if (!LOD) b.cbox(0, wr + 0.5, -half - 0.03, 0.2, 0.1, 0.02, [0.92, 0.92, 0.88], 0, { faces: 32 }); // tail light, plate
    b.cbox(0, wr + 0.05, -0.05, 0.6, 0.03, 0.3, dark); for (const sx of [1, -1]) b.cbox(sx * 0.32, wr + 0.05, -0.05, 0.08, 0.06, 0.08, chrome); // foot pegs
  }
  // A speedboat: a lofted V hull with a raised bow, a teak deck, a low windscreen, two seats, a console and an outboard.
  function boatMesh(b, gb, s, col, LOD) {
    const L = s.len, hw = s.wid / 2, half = L / 2; const keel = s.ferry ? -1.2 : -0.62, deck0 = s.ferry ? 0.6 : 0.28; const dark = [0.12, 0.13, 0.15], teak = [0.72, 0.6, 0.42], white = [0.92, 0.92, 0.9], glass = [0.28, 0.38, 0.48];
    const N = LOD ? 3 : 6; const stations = [[-half, 0.85, 0.88, 0], [-half + 0.9, 1, 1, 0.02], [0, 1, 1, 0.06], [half * 0.45, 0.94, 0.95, 0.12], [half * 0.78, 0.62, 0.8, 0.2], [half - 0.02, 0.03, 0.45, 0.3]];
    const rings = [], decks = [];
    for (const [z, wf, df, rise] of stations) { const w = hw * wf, d = keel * df, dy = deck0 + rise; const pts = [];
      for (let i = 0; i <= N; i++) { const u = i / N; pts.push([w * (1 - Math.pow(u, 1.7)), dy + (d - dy) * Math.pow(u, 0.85), z]); }
      for (let i = N - 1; i >= 0; i--) { const u = i / N; pts.push([-w * (1 - Math.pow(u, 1.7)), dy + (d - dy) * Math.pow(u, 0.85), z]); }
      pts.push([-w * 0.5, dy, z], [0, dy, z], [w * 0.5, dy, z]); rings.push(pts); decks.push([w, dy, z]); }
    b.loft(rings, col, 0, 0, { closed: true, capStart: true, capEnd: true, pick: (n) => n[1] > 0.6 ? null : b });
    for (let i = 0; i + 1 < decks.length; i++) { const [w0, y0, z0] = decks[i], [w1, y1, z1] = decks[i + 1]; b.polyOut([[w0, y0, z0], [-w0, y0, z0], [-w1, y1, z1], [w1, y1, z1]], s.ferry ? [0.35, 0.36, 0.4] : teak, 0, -1, 0); }
    if (s.ferry) { // a small harbour ferry: cabin with windows, funnel, rails, a bench along each side
      b.roundedBox(-hw * 0.7, deck0, -half * 0.55, hw * 1.4, 2.4, half * 1.1, 0.1, white); gb.cbox(0, deck0 + 1.5, half * 0.55 + 0.02, hw * 1.2, 0.8, 0.03, glass); for (const sx of [1, -1]) gb.cbox(sx * (hw * 0.7 + 0.02), deck0 + 1.5, 0, 0.03, 0.8, half * 0.9, glass);
      b.cyl(0, deck0 + 2.4, -half * 0.25, 0.45, deck0 + 4.0, [0.85, 0.2, 0.15], 0, 10, 0, true, false, 0.4); b.cyl(0, deck0 + 3.9, -half * 0.25, 0.42, deck0 + 4.1, dark, 0, 10, 0, true, false);
      b.roundedBox(-hw * 0.7, deck0 + 2.4, -half * 0.55, hw * 1.4, 0.15, half * 1.1, 0.05, [0.85, 0.85, 0.82]); b.cbox(0, deck0 + 2.7, half * 0.3, 0.8, 0.4, 0.6, dark); b.cyl(0, deck0 + 2.55, -half * 0.5, 0.03, deck0 + 4.6, dark, 0, 4); b.cbox(0, deck0 + 4.2, -half * 0.5 + 0.2, 0.05, 0.3, 0.4, [0.9, 0.2, 0.2]);
      for (const sx of [1, -1]) { for (let z = -half + 1; z < half - 1.5; z += 1.5) b.cyl(sx * (hw - 0.15), deck0, z, 0.025, deck0 + 1.0, [0.9, 0.9, 0.9], 0, 4); b.box(sx > 0 ? hw - 0.17 : -hw + 0.12, deck0 + 0.98, -half + 1, 0.05, 0.05, L - 2.5, [0.9, 0.9, 0.9]); b.cbox(sx * (hw - 0.55), deck0 + 0.45, 0, 0.5, 0.06, half * 0.9, teak); }
      for (let k = 0; k < 4; k++) b.cyl(k < 2 ? hw - 0.3 : -hw + 0.3, deck0 + 0.3 + (k % 2) * 0.7, -half + 2 + Math.floor(k / 2) * 0.5, 0.25, deck0 + 0.55 + (k % 2) * 0.7, [0.95, 0.55, 0.1], 0, 8, 0, true, true); // life rings
      b.cbox(0, deck0 + 0.8, half - 0.6, 0.08, 0.06, 0.08, [1, 1, 0.9], 0, { bone: 5 }); b.cbox(0, deck0 + 0.5, -half - 0.02, 0.14, 0.05, 0.03, [1, 0.2, 0.2], 0, { faces: 32, bone: 6 }); return; }
    if (!LOD) for (let i = 0; i + 1 < decks.length; i++) for (const sx of [1, -1]) b.tube([sx * decks[i][0], decks[i][1] + 0.02, decks[i][2]], [sx * decks[i + 1][0], decks[i + 1][1] + 0.02, decks[i + 1][2]], 0.04, 0.04, white, 0, 0, 5); // rub rail
    // cockpit: coamings, console, windscreen, seats
    for (const sx of [1, -1]) b.roundedBox(sx > 0 ? hw * 0.62 : -hw * 0.78, deck0, -1.9, hw * 0.16, 0.22, 2.6, 0.03, col.map(c => c * 0.8));
    b.roundedBox(-hw * 0.7, deck0, 0.45, hw * 1.4, 0.5, 0.4, 0.05, dark); b.cbox(0, deck0 + 0.52, 0.55, hw * 1.2, 0.03, 0.25, [0.2, 0.2, 0.22]);
    gb.polyOut([[hw * 0.78, deck0 + 0.02, 0.95], [-hw * 0.78, deck0 + 0.02, 0.95], [-hw * 0.72, deck0 + 0.72, 0.62], [hw * 0.72, deck0 + 0.72, 0.62]], glass, 0, deck0, -2);
    if (!LOD) { b.tube([hw * 0.78, deck0 + 0.02, 0.95], [hw * 0.72, deck0 + 0.72, 0.62], 0.025, 0.025, dark, 0, 0, 5); b.tube([-hw * 0.78, deck0 + 0.02, 0.95], [-hw * 0.72, deck0 + 0.72, 0.62], 0.025, 0.025, dark, 0, 0, 5); b.tube([-hw * 0.72, deck0 + 0.72, 0.62], [hw * 0.72, deck0 + 0.72, 0.62], 0.025, 0.025, dark, 0, 0, 5); }
    b.cyl(-0.5, deck0 + 0.5, 0.35, 0.16, deck0 + 0.53, dark, 0, LOD ? 8 : 12, 0, true, true); // wheel at the helm, right of centre
    for (const sx of [-0.5, 0.5]) { b.roundedBox(sx - 0.26, deck0, -1.15, 0.52, 0.16, 0.5, 0.04, white); b.roundedBox(sx - 0.26, deck0 + 0.1, -1.2, 0.52, 0.5, 0.12, 0.04, white); }
    b.roundedBox(-hw * 0.8, deck0, -half + 0.2, hw * 1.6, 0.34, 0.9, 0.05, col.map(c => c * 0.85)); // stern locker
    b.roundedBox(-0.24, deck0 - 0.05, -half - 0.5, 0.48, 0.6, 0.55, 0.08, dark); b.cyl(0, keel + 0.05, -half - 0.35, 0.06, deck0 - 0.05, dark, 0, 6); b.cyl(0, keel + 0.02, -half - 0.35, 0.14, keel + 0.08, chromeish(), 0, 6, 0, true, true); // outboard
    b.cbox(0, deck0 + 0.36, half - 0.35, 0.08, 0.06, 0.08, [1, 1, 0.9], 0, { bone: 5 }); b.cbox(0, deck0 + 0.2, -half - 0.02, 0.14, 0.05, 0.03, [1, 0.2, 0.2], 0, { faces: 32, bone: 6 }); // nav and stern lights
    if (!LOD) { for (let k = 0; k < 3; k++) b.cbox(0, deck0 + 0.02, half - 0.9 - k * 0.5, hw * 0.9, 0.02, 0.05, dark); b.cbox(0, deck0 + 0.2, half - 0.2, 0.25, 0.4, 0.05, chromeish()); } // deck slats and a bow cleat
    function chromeish() { return [0.75, 0.78, 0.8]; }
  }
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

  // ---- Pedestrians. Bones: 0 pelvis/torso, 1 head, 2/3 upper arms, 4/5 thighs, 6 weapon, 7/8 shins, 9/10 forearms.
  // Limbs are tapered cylinders with ball joints, the torso is a lofted body, the head an ellipsoid with a hair cap.
  const MOUTH_POS = [0, .094, .125]; // where the mouth sits in head-bone space
  function pedMesh(look, lod = false) {
    const b = new Builder(); const SEG = lod ? 6 : 14, RNG = lod ? 3 : 7, CS = lod ? 5 : 10, AS = lod ? 5 : 9; const { skin, shirt, pants, hair, hat, shoes = [0.1, 0.1, 0.1], jacket = null, sleeves = !!jacket, glasses = false, bag = null, skirt = false, longHair = false, beanie = false, hairStyle = 0, beard = false } = look;
    const legH = 0.85, torsoH = 0.65, headR = 0.15;
    const tailored = look.tailored || false, broad = look.build === 'stocky';
    const skinDk = skin.map(c => c * 0.82), top = jacket || shirt, topDk = top.map(c => c * 0.78);
    const ball = (x, y, z, r, col, bone, segs = 6, rings = 2) => b.sphere(x, y, z, r, r, r, col, { segs: lod ? 4 : segs, rings: lod ? 1 : rings, bone });
    // legs hang from the hips (bones 4, 5): thigh, knee, shin, a shaped shoe
    for (const [sx, bone, shin] of [[0.11, 4, 7], [-0.11, 5, 8]]) {
      const trouserRing = (y, rx, rz) => Builder.rrect(sx, 0, rx, rz, Math.min(rx, rz) * 0.7, lod ? 1 : 2, y, 'y');
      b.loft([trouserRing(-legH * 0.5, 0.082, 0.082), trouserRing(-0.25, 0.102, 0.108), trouserRing(0.03, 0.108, 0.116)], pants, 0, bone);
      ball(sx, -legH * 0.5, 0.005, 0.074, pants, bone, 7, 3);
      b.loft([trouserRing(-legH+.08,.061,.065),trouserRing(-.63,.071,.074),trouserRing(-legH*.5,.081,.082)],pants,0,shin,{capEnd:true});
      b.cyl(sx, -legH + 0.02, 0.012, 0.05, -legH + 0.1, skin, 0, 7, shin, false, false, 0.05); // ankle
      b.roundedBox(sx - 0.075, -legH + 0.02, -0.08, 0.15, 0.09, 0.27, 0.04, shoes, 0, shin === 7 ? 12 : 13, { n: lod ? 1 : 2 }); b.box(sx - 0.078, -legH - 0.01, -0.085, 0.156, 0.03, 0.28, shoes.map(c => c * 0.6), 0, { bone: shin === 7 ? 12 : 13 }); // upper and sole
    }
    // torso (bone 0): pants top, belt, a chest lofted from rounded sections that narrow at the waist and slope at the shoulders
    const rr = (y, hw, hd, r) => Builder.rrect(0, 0, hw, hd, r, lod ? 2 : 4, y, 'y');
    b.loft([rr(-0.04, 0.2, 0.125, 0.09), rr(0.1, 0.205, 0.13, 0.09), rr(0.13, 0.2, 0.125, 0.09)], pants, 0, 0, { capStart: true });
    b.loft([rr(0.09, 0.212, 0.137, 0.09), rr(0.13, 0.212, 0.137, 0.09)], [0.15, 0.1, 0.08], 0, 0, {}); b.cbox(0, 0.11, 0.135, 0.05, 0.035, 0.012, [0.75, 0.7, 0.4], 0, { bone: 0 }); // belt, buckle
    if (skirt) b.cyl(0, -0.34, 0, 0.27, 0.12, pants, 0, 12, 0, false, true, 0.2);
    // Jackets hang straight at the hip; shirts tuck into a narrower waist. Both meet the shoulder rig.
    const chest = jacket
      ? [rr(.07,.205,.135,.085),rr(.22,tailored?.178:.20,.126,.085),rr(.42,.217,.143,.1),rr(.54,.242,.14,.11),rr(.59,.236,.127,.105),rr(.64,.17,.09,.075),rr(.665,.076,.066,.05)]
      : [rr(.12,.185,.12,.08),rr(.25,.177,.116,.08),rr(.42,.208,.138,.1),rr(.54,.23,.132,.10),rr(.59,.228,.123,.105),rr(.64,.16,.085,.07),rr(.665,.075,.062,.05)];
    b.loft(chest, top, 0, 0, { capStart: !!jacket, capEnd: true });
    if (jacket) {
      const front = [[.12,.139,.044],[.22,.131,.050],[.42,.148,.059],[.54,.145,.065],[.59,.132,.062],[.64,.095,.046]];
      for(let i=0;i<front.length-1;i++) { const [y,z,w]=front[i], [y2,z2,w2]=front[i+1]; b.polyOut([[-w,y,z],[w,y,z],[w2,y2,z2],[-w2,y2,z2]],shirt,0,0,-.2); }
      for (const side of [-1,1]) {
        const lapel=[[.39,.151,.06,.067],[.54,.150,.065,.125],[.59,.137,.062,.10],[.64,.100,.046,.073]];
        for(let i=0;i<lapel.length-1;i++) { const [y,z,a,bw]=lapel[i], [y2,z2,a2,b2]=lapel[i+1]; b.polyOut([[side*a,y,z],[side*bw,y,z],[side*b2,y2,z2],[side*a2,y2,z2]],top.map(c=>c*.87),0,0,-.2); }
        if (!lod) {
          b.tube([side*.11,.26,.126],[side*.185,.29,.12],.007,.007,topDk,0,0,4);
          b.tube([side*.13,.50,-.139],[side*.19,.49,-.13],.003,.003,top.map(c=>c*1.13),0,0,4);
        }
      }
      b.loft([rr(.075,.207,.138,.09),rr(.1,.207,.138,.09)],topDk);
      if (!lod) {
        b.polyOut([[-.19,.47,-.145],[.19,.47,-.145],[.17,.49,-.144],[-.17,.49,-.144]],top.map(c=>c*.88),0,0,0);
        for (const side of [-1,1]) b.tube([side*.155,.12,-.102],[side*.175,.43,-.105],.003,.003,topDk,0,0,4);
      }
    } else {
      b.loft([rr(.645,.082,.069,.052),rr(.675,.075,.063,.048)],topDk);
      if (sleeves && !lod) for(let k=0;k<4;k++) b.cbox(0,.24+k*.082,.142,.009,.009,.006,topDk);
      if (look.pattern === 'stripe') for(let i=0;i<4;i++) {
        const y=.24+i*.066;
        const profile=h=>{const t=Math.max(0,(h-.25)/.17); return rr(h,.177+Math.min(1,t)*.031+.003,.116+Math.min(1,t)*.022+.003,.085);};
        b.loft([profile(y),profile(y+.014)],shirt.map(c=>Math.min(1,c*1.2+.06)));
      }
    }
    if (look.chain && !lod) { for(const side of [-1,1]) { b.tube([side*.045,.63,.115],[side*.033,.55,.155],.0025,.0025,[.8,.64,.3],0,0,5); b.tube([side*.033,.55,.155],[0,.505,.157],.0025,.0025,[.8,.64,.3],0,0,5); } b.cbox(0,.499,.159,.012,.018,.005,[.8,.64,.3]); }
    if (look.badge && !lod) b.sphere(.11,.49,.14,.018,.025,.008,[.82,.72,.4],{segs:6,rings:2,bone:0});
    if (bag) { b.roundedBox(-0.32, torsoH * 0.15, -0.16, 0.1, 0.3, 0.22, 0.03, bag, 0, 0, { n: 1 }); b.tube([-0.27, 0.62, -0.02], [-0.27, 0.25, -0.1], 0.012, 0.012, bag.map(c => c * 0.7), 0, 0, 5); }
    b.cyl(0, torsoH - 0.03, 0, 0.056, torsoH + 0.07, skin, 0, 8, 0, false, false, 0.06); // neck
    // One sculpted skull: chin, jaw, cheeks, brow and crown share a continuous surface.
    const faceRing = (y,rx,rz,zc) => Array.from({length:SEG},(_,i)=>{const a=i/SEG*Math.PI*2;return [Math.cos(a)*rx,y,zc+Math.sin(a)*rz];});
    const jaw = tailored ? .92 : broad ? 1.1 : 1; const faceStart = b.v.length, faceIndexStart = b.i.length;
    b.loft([faceRing(.024,.047,.056,.025),faceRing(.059,.085*jaw,.083,.016),faceRing(.11,.116*jaw,.104,.002),faceRing(.178,.131,.111,-.004),faceRing(.24,.125,.11,-.01),faceRing(.285,.102,.09,-.014),faceRing(.315,.045,.041,-.018)],skin,0,1,{capStart:true,capEnd:true});
    // Cylindrical face coordinates keep painted lids and brows on the skin, including the distant LOD.
    for (let i=faceStart;i<b.v.length;i+=13) {
      b.v[i+9] = Math.atan2(b.v[i], b.v[i+2]) / (Math.PI*2) + .5;
      b.v[i+10] = 1-b.v[i+1]/.33; b.v[i+11] = TEX.names.face || 0;
    }
    // Unwrap seam-crossing faces at the back, never interpolate the face paint across the skull.
    for(let i=faceIndexStart;i<b.i.length;i+=3) {
      const ids=b.i.slice(i,i+3).map(v=>v*13); const us=ids.map(v=>b.v[v+9]);
      if(Math.max(...us)-Math.min(...us)>.5) for(const id of ids) b.v[id+11]=0;
    }
    const hairR = headR * 1.03; const style = beanie || (hat && !beanie) ? (hairStyle === 5 ? 5 : 0) : hairStyle;
    if (style !== 5) { b.sphere(0, headR * 1.1, -0.012, hairR * 0.95, hairR * 1.1, hairR * 1.0, hair, { segs: SEG, rings: lod ? 2 : 4, lat0: style === 1 ? 0.2 : 0.3, lat1: 1, bone: 1 }); b.sphere(0, headR * 1.08, -0.012, hairR * 0.95, hairR * 1.1, hairR * 1.02, hair, { segs: 12, rings: 3, lat0: (longHair || style === 2) ? -0.55 : -0.05, lat1: 0.32, az0: Math.PI * 1.12, az1: Math.PI * 1.88, bone: 1 }); } // cap and the back of the head
    else b.sphere(0, headR * 1.1, -0.012, hairR * 0.92, hairR * 1.07, hairR * 0.97, skinDk.map(c => c * 0.9), { segs: 8, rings: 2, lat0: 0.75, lat1: 1, bone: 1 }); // bald: a little shine on top
    if (style === 1 && !lod) { b.sphere(-.038,.265,.072,.084,.046,.047,hair,{segs:12,rings:4,bone:1}); b.sphere(.065,.259,.063,.045,.039,.041,hair,{segs:10,rings:3,bone:1}); } // a fringe
    if (longHair || style === 2) b.sphere(0, headR * 0.7, -0.03, hairR * 1.05, hairR * 1.4, hairR * 1.05, hair, { segs: 12, rings: 3, lat0: -0.7, lat1: -0.1, az0: Math.PI * 1.05, az1: Math.PI * 1.95, bone: 1 });
    if (style === 3) { b.sphere(0, headR * 1.15, -headR * 0.95, 0.045, 0.04, 0.045, hair, { segs: 7, rings: 2, bone: 1 }); b.tube([0, headR * 1.1, -headR * 0.95], [0.02, headR * 0.3, -headR * 1.15], 0.03, 0.018, hair, 0, 1, 6); } // ponytail
    if (style === 4) b.sphere(0, headR * 1.7, -headR * 0.75, 0.055, 0.045, 0.055, hair, { segs: 8, rings: 3, bone: 1 }); // bun
    if (style === 6 && !lod) for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; b.sphere(Math.cos(a) * headR * 0.75, headR * 1.65 + Math.sin(a * 2) * 0.01, -0.01 + Math.sin(a) * headR * 0.75, 0.05, 0.045, 0.05, hair, { segs: 6, rings: 2, bone: 1 }); } // curls
    if (style === 7) b.sphere(0, headR * 1.25, -0.02, hairR * 1.35, hairR * 1.35, hairR * 1.35, hair, { segs: SEG, rings: RNG, lat0: -0.15, lat1: 1, bone: 1 }); // afro
    if (beard && !lod) b.sphere(0, headR * 0.66, 0.02, headR * 0.82, headR * 0.7, headR * 0.9, hair, { segs: 12, rings: 3, lat0: -1, lat1: 0.12, az0: Math.PI * 0.08, az1: Math.PI * 0.92, bone: 1 });
    if (!lod) {
      for (const sx of [-.049,.049]) {
        b.sphere(Math.sign(sx)*.129,.166,-.004,.019,.033,.022,skin,{segs:8,rings:3,bone:1});
        b.sphere(Math.sign(sx)*.14,.164,.004,.007,.018,.01,skinDk,{segs:6,rings:2,bone:1});
        if (look.earrings) b.sphere(Math.sign(sx)*.138,.129,.0,.009,.011,.009,[.88,.69,.32],{segs:7,rings:3,bone:1});
      }
      b.sphere(0,.146,.102,.017,.026,.033,skin,{segs:12,rings:6,bone:1});
      b.cbox(0,.094,.125,.045,.005,.008,skin.map((c,i)=>c*(i===0?.64:.46)),0,{bone:11});

      if (look.stubble) for(let i=faceStart;i<b.v.length;i+=13) { if(b.v[i+12]===1 && b.v[i+11]===(TEX.names.face||0) && b.v[i+1]<.11) for(let k=0;k<3;k++) b.v[i+6+k]*=.87; }
    }
    if (glasses) {
      for(const side of [-1,1]) { b.roundedBox(side*.051-.040,.157,.115,.080,.043,.012,.009,[.045,.055,.059],0,1,{n:2}); b.tube([side*.087,.18,.12],[side*.127,.18,-.015],.005,.005,[.065,.06,.055],0,1,5); }
      b.tube([-.015,.178,.125],[.015,.178,.125],.004,.004,[.12,.105,.085],0,1,5);
    }
    if (hat && !beanie) { b.cyl(0, headR * 1.65, -0.01, hairR * 1.02, headR * 2.25, hat, 0, 12, 1, true, false, hairR * 0.9); const base = b.n; const bz = headR * 0.6; for (let k = 0; k <= 8; k++) { const a = -Math.PI / 2 + k / 8 * Math.PI; b.vert(Math.cos(a) * headR * 1.05, headR * 1.7, bz + Math.sin(a) * headR * 1.25, 0, 1, 0, ...hat, 0, 0, 0, 1); } const c = b.vert(0, headR * 1.7, bz, 0, 1, 0, ...hat, 0, 0, 0, 1); for (let k = 0; k < 8; k++) b.tri(base + k, base + k + 1, c); }
    if (hat && beanie) b.sphere(0, headR * 1.0, -0.01, hairR * 1.05, hairR * 1.3, hairR * 1.08, hat, { segs: 12, rings: 4, lat0: 0.05, lat1: 1, bone: 1 });
    // arms (bones 2, 3): a rounded shoulder, upper arm, elbow, forearm, a hand with a thumb
    const armL = 0.62;
    for (const [sx, bone, fore] of [[0.26, 2, 9], [-0.26, 3, 10]]) {
      const sleeveEnd = sleeves ? -armL*.5 : -.18;
      const ar = (y,rx,rz,xc=sx) => Builder.rrect(xc,0,rx,rz,Math.min(rx,rz)*.8,lod?1:3,y,'y');
      b.loft([ar(sleeveEnd,.061,.066),ar(-.16,.074,.079),ar(-.045,.085,.087,sx*.94),ar(.015,.072,.071,sx*.90),ar(.042,.037,.043,sx*.87)],top,0,bone,{capStart:true,capEnd:true});
      if (!sleeves) b.cyl(sx, -armL * 0.5, 0, 0.057, -0.17, skin, 0, AS, bone, false, false, 0.063);
      ball(sx, -armL * 0.5, 0.005, 0.059, sleeves ? top : skin, bone, 7, 3);
      b.cyl(sx, -armL + 0.07, 0.01, sleeves ? 0.049 : 0.042, -armL * 0.5, sleeves ? top : skin, 0, AS, fore, false, false, sleeves ? 0.066 : 0.057);
      if (sleeves) b.cyl(sx, -armL + 0.1, 0.01, 0.052, -armL + 0.14, topDk, 0, 8, fore, false, false, 0.052); // cuff
      b.cyl(sx, -armL + 0.02, 0.01, 0.036, -armL + 0.11, skin, 0, 7, fore, false, false, 0.038); // wrist
      b.roundedBox(sx - 0.04, -armL - 0.03, -0.022, 0.08, 0.1, 0.05, 0.02, skin, 0, fore, { n: 1 }); if (!lod) b.roundedBox(sx + (sx > 0 ? -0.075 : 0.04), -armL + 0.0, -0.005, 0.035, 0.05, 0.04, 0.015, skin, 0, fore, { n: 1 }); // hand and thumb
    }
    if (broad) for (let i=0;i<b.v.length;i+=13) { if (b.v[i+12] === 0) { b.v[i]*=1.08; b.v[i+2]*=1.12; } }
    // Two-bone weights preserve the existing local bind spaces and deform the joint bands.
    // Offset converts a primary-bone vertex into the secondary bone's bind coordinates.
    b.skin=new Float32Array(b.n*5);
    for(let v=0;v<b.n;v++) {
      const i=v*13, x=b.v[i], y=b.v[i+1], bone=b.v[i+12]; let other=bone, weight=0, offsetY=0;
      if (bone===2 || bone===3) {
        if(y>-.15) {other=0;weight=M.clamp((y+.15)/.2,0,.65);offsetY=.6;}
        else if(y<-.23) {other=bone===2?9:10;weight=M.clamp((-.23-y)/.16,0,.5);}
      } else if(bone===9 || bone===10) {other=bone===9?2:3;weight=M.clamp((y+.40)/.18,0,.5);}
      else if(bone===4 || bone===5) {
        if(y>-.13) {other=0;weight=M.clamp((y+.13)/.25,0,.6);}
        else if(y<-.34) {other=bone===4?7:8;weight=M.clamp((-.34-y)/.17,0,.5);}
      } else if(bone===7 || bone===8) {other=bone===7?4:5;weight=M.clamp((y+.515)/.18,0,.5);}
      else if(bone===1 && y<.06) {other=0;weight=M.clamp((.06-y)/.15,0,.3);offsetY=.68;}
      b.skin.set([other,weight,0,offsetY,0],v*5);
    }
    return b;
  }

  // ISO-sized industrial kit: corrugated sides, corner castings, paired doors and lock bars.
  function shippingContainer(col, length=6) {
    const b=new Builder(), dark=col.map(c=>c*.67), edge=col.map(c=>Math.min(.8,c*1.1+.04));
    b.box(.04,.04,.04,length-.08,2.52,2.32,col,T().metal,{uvScale:3});
    for(const z of [0,2.36]) {
      b.box(0,0,z,length,.13,.08,dark); b.box(0,2.47,z,length,.13,.08,edge);
      for(let x=.25;x<length-.15;x+=.28) b.box(x,.15,z-.02,.08,2.28,.07,edge);
    }
    for(const x of [0,length-.13]) for(const z of [0,2.27]) {
      b.box(x,0,z,.13,2.6,.13,dark);
      for(const y of [0,2.43]) b.box(x-.015,y,z-.015,.16,.17,.16,[.25,.27,.26]);
    }
    for(const z of [.09,1.22]) { b.box(length-.015,.16,z,.04,2.23,1.08,col); b.box(length+.03,.21,z+.54,.035,2.13,.035,[.55,.57,.53]);
      for(const y of [.52,1.87])b.box(length+.02,y,z,.065,.10,1.08,dark); }
    b.box(length+.07,1.19,1.0,.035,.09,.5,[.66,.65,.56]);
    b.box(.24,1.76,-.04,.82,.26,.025,[.8,.79,.67]);
    for(let k=0;k<5;k++)b.box(.3+k*.12,1.80,-.058,.042,.15,.016,dark);
    return b;
  }

  // ---- Props (instanced). Origin on the ground.
  function lamppost() { const b = new Builder(); const c = [0.35, 0.36, 0.38]; b.cyl(0, 0, 0, 0.12, 6, c, 0, 6); b.cbox(0, 6, 0.8, 0.14, 0.14, 1.8, c); b.cbox(0, 5.9, 1.6, 0.35, 0.18, 0.7, [1, 0.95, 0.8], 0, { bone: 0 }); return b; }
  function trafficLight() { const b = new Builder(); const c = [0.2, 0.2, 0.22]; b.cyl(0, 0, 0, 0.1, 5, c, 0, 6); b.cbox(0, 5, 2.0, 0.12, 0.12, 4.2, c); b.cbox(0, 4.4, 3.9, 0.36, 1.05, 0.36, [0.15, 0.15, 0.15]); return b; }
  function lampHead() { const b = new Builder(); b.cbox(0, 0, 0, 0.22, 0.22, 0.1, [1, 1, 1], 0, { faces: 16 }); return b; }
  // ---- Imported models (Kenney kits via tools/assets/import-glb.py). Flat-shaded, vertex-coloured, so every triangle is emitted
  // with its own face normal on the white tile. Parts can go to bones (vehicle wheels) and paint colours can be swapped.
  const ASSET_BONES = { 'wheel-front-left': 1, 'wheel-front-right': 2, 'wheel-back-left': 3, 'wheel-back-right': 4, 'wheel-front': 1, 'wheel-back': 3, fork: 10 };
  function assetInto(b, name, o = {}) {
    const A = ASSETS.models[name]; if (!A) throw new Error('no model ' + name);
    const S = o.scale || 1, ca = Math.cos(o.angle || 0), sa = Math.sin(o.angle || 0), ox = o.x || 0, oy = o.y || 0, oz = o.z || 0, desat = o.desat || 0;
    let pal = A.pal.map(c => desat ? c.map(v => v + (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] - v) * desat) : c);
    if (o.paint && A.paint) { const base = A.pal[A.paint[0]]; const bl = 0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2]; for (const i of A.paint) { const c = A.pal[i]; const k = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / bl; pal[i] = o.paint.map(v => Math.min(1, v * k)); } }
    const v = A.v, I = A.i; const p = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const [pname, part] of Object.entries(A.parts)) {
      const bone = o.bones ? (ASSET_BONES[pname] || 0) : 0; const tx = o.local ? part.t[0] : 0, ty = o.local ? part.t[1] : 0, tz = o.local ? part.t[2] : 0;
      for (let t = part.first; t < part.first + part.count; t += 3) {
        let col = null;
        for (let k = 0; k < 3; k++) { const vi = I[t + k] * 4; const lx = (v[vi] + tx) * S, ly = (v[vi + 1] + ty) * S, lz = (v[vi + 2] + tz) * S; p[k][0] = lx * ca + lz * sa + ox; p[k][1] = ly + oy; p[k][2] = -lx * sa + lz * ca + oz; if (!col) col = pal[v[vi + 3]]; }
        const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2], bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const base = b.n; for (let k = 0; k < 3; k++) b.vert(p[k][0], p[k][1], p[k][2], nx, ny, nz, col[0], col[1], col[2], 0, 0, 0, bone); b.tri(base, base + 1, base + 2);
      }
    }
    return b;
  }
  function assetVehicle(b, s, col) { assetInto(b, s.model, { scale: s.modelScale, bones: true, local: true, paint: col, desat: 0.15 }); }
  function assetBounds(name, scale) { const A = ASSETS.models[name]; return { min: A.min.map(v => v * scale), max: A.max.map(v => v * scale) }; }
  // A plant from the nature kit, scaled to the height the city expects, with a fallback to the built one.
  const plant = (model, height, desat, fallback) => () => {
    const A = typeof ASSETS !== 'undefined' && ASSETS.models[model];
    if (!A) return fallback();
    return assetInto(new Builder(), model, { scale: height / (A.max[1] - A.min[1]), desat: desat === undefined ? 0.18 : desat });
  };
  function builtTree() { const b = new Builder(); b.cyl(0, 0, 0, 0.18, 2.4, [0.35, 0.25, 0.15], 0, 7, 0, false, false, 0.12); const tiers = [[1.5, 1.7, 1.2], [2.5, 1.45, 1.1], [3.5, 1.15, 1.0], [4.4, 0.8, 0.9], [5.2, 0.45, 0.7]]; tiers.forEach(([y, r, h], k) => { const g = 0.4 + k * 0.03; b.cyl(0, y, 0, r, y + h, [0.16 + k * 0.02, g, 0.15], 0, 9, 0, true, k === 0, 0.05); }); return b; }
  function hydrant() { const b = new Builder(); b.cyl(0, 0, 0, 0.16, 0.7, [0.85, 0.15, 0.12], 0, 6); b.cbox(0, 0.45, 0, 0.5, 0.14, 0.2, [0.85, 0.15, 0.12]); b.cyl(0, 0.7, 0, 0.1, 0.85, [0.85, 0.15, 0.12], 0, 6); return b; }
  function bin() { const b = new Builder(); b.cyl(0, 0, 0, 0.32, 0.95, [0.2, 0.28, 0.2], 0, 8); b.cyl(0, 0.95, 0, 0.36, 1.05, [0.15, 0.2, 0.15], 0, 8); return b; }
  function bench() { const b = new Builder(); const w = [0.45, 0.32, 0.2]; b.cbox(0, 0.45, 0, 1.8, 0.06, 0.5, w); b.cbox(0, 0.75, -0.22, 1.8, 0.4, 0.06, w); b.cbox(0.7, 0.22, 0, 0.08, 0.45, 0.45, [0.2, 0.2, 0.2]); b.cbox(-0.7, 0.22, 0, 0.08, 0.45, 0.45, [0.2, 0.2, 0.2]); return b; }
  function dumpster() { const b = new Builder(); const c = [0.15, 0.35, 0.2]; b.cbox(0, 0.7, 0, 1.8, 1.2, 1.0, c, 0); b.cbox(0, 1.35, 0, 1.85, 0.12, 1.05, c.map(v => v * 0.8)); b.cbox(0, 0.05, 0, 1.6, 0.1, 0.8, [0.1, 0.1, 0.1]); b.cbox(0.6, 1.5, 0.2, 0.5, 0.25, 0.4, [0.1, 0.1, 0.1]); return b; }
  function mailbox() { const b = new Builder(); const c = [0.15, 0.25, 0.6]; b.cbox(0, 0.65, 0, 0.6, 0.9, 0.5, c); b.cbox(0, 1.15, 0, 0.6, 0.15, 0.5, c.map(v => v * 0.8)); b.cbox(0, 0.1, 0, 0.5, 0.2, 0.4, [0.2, 0.2, 0.22]); b.cbox(0, 1.0, 0.26, 0.4, 0.12, 0.02, [0.05, 0.05, 0.08]); return b; }
  function meter() { const b = new Builder(); b.cyl(0, 0, 0, 0.04, 1.2, [0.3, 0.3, 0.32], 0, 6); b.cbox(0, 1.35, 0, 0.16, 0.3, 0.12, [0.45, 0.45, 0.48]); b.cbox(0, 1.4, 0.065, 0.1, 0.1, 0.01, [0.8, 0.2, 0.2], 0, { faces: 16 }); return b; }
  function newsbox() { const b = new Builder(); const c = [[0.8, 0.15, 0.1], [0.1, 0.3, 0.7], [0.9, 0.7, 0.1]][Math.floor(Math.random() * 3)]; b.cbox(0, 0.55, 0, 0.5, 1.1, 0.45, c); b.cbox(0, 0.85, 0.23, 0.4, 0.35, 0.01, [0.85, 0.85, 0.8], 0, { faces: 16 }); return b; }
  function busShelter() { const b = new Builder(); const c = [0.25, 0.27, 0.3]; b.cbox(-1.9, 1.3, 0, 0.1, 2.6, 0.1, c); b.cbox(1.9, 1.3, 0, 0.1, 2.6, 0.1, c); b.cbox(-1.9, 1.3, -1.1, 0.1, 2.6, 0.1, c); b.cbox(1.9, 1.3, -1.1, 0.1, 2.6, 0.1, c); b.cbox(0, 2.65, -0.55, 4.2, 0.1, 1.4, [0.2, 0.25, 0.35]); b.cbox(0, 1.3, -1.15, 3.9, 2.0, 0.04, [0.5, 0.65, 0.8]); b.cbox(0, 0.5, -0.8, 3.0, 0.06, 0.45, [0.45, 0.32, 0.2]); b.cbox(0, 2.35, -0.55, 1.6, 0.4, 0.06, [0.95, 0.75, 0.1]); return b; }
  function cone() { const b = new Builder(); b.cyl(0, 0, 0, 0.22, 0.75, [1, 0.42, 0], 0, 8, 0, true, false, 0.06); b.cbox(0, 0.02, 0, 0.5, 0.04, 0.5, [0.1, 0.1, 0.1]); b.cyl(0, 0.3, 0, 0.16, 0.4, [1, 1, 1], 0, 8, 0, false, false, 0.13); return b; }
  function barrier() { const b = new Builder(); b.cbox(0, 0.85, 0, 2.2, 0.3, 0.06, [1, 0.42, 0]); b.cbox(0, 0.85, 0, 2.2, 0.3, 0.065, [1, 1, 1], 0, { faces: 0 }); for (const sx of [-1, 1]) { b.cbox(sx * 1.0, 0.5, 0, 0.08, 1.0, 0.08, [0.3, 0.3, 0.32]); b.cbox(sx * 1.0, 0.03, 0, 0.5, 0.06, 0.4, [0.3, 0.3, 0.32]); } for (let k = 0; k < 5; k++) b.cbox(-0.9 + k * 0.45, 0.85, 0.035, 0.2, 0.3, 0.01, [1, 1, 1], 0, { faces: 16 }); return b; }
  // A clipped hedge: a dark mass with foliage clumps along the top, rather than one flat slab of green.
  function hedge() {
    const b = new Builder(); b.cbox(0, 0.42, 0, 3.0, 0.84, 0.78, [0.09, 0.16, 0.08]);
    const A = typeof ASSETS !== 'undefined' && ASSETS.models.bush1;
    if (!A) { b.cbox(0, 0.9, 0, 2.9, 0.16, 0.7, [0.16, 0.32, 0.14]); return b; }
    const sc = 0.42 / (A.max[1] - A.min[1]); // small clumps read as clipped foliage; big ones read as agave
    for (let i = 0; i < 9; i++) { const t = (i / 8 - 0.5) * 2.7;
      assetInto(b, 'bush1', { scale: sc * (0.8 + (i % 3) * 0.14), x: t, y: 0.74, z: ((i % 3) - 1) * 0.2, angle: i * 1.7, desat: 0.05 }); }
    return b;
  }
  const tree = plant('tree2', 7.2, 0.05, builtTree), roundTree = plant('tree1', 6.4, 0.05, builtRoundTree), palm = plant('palm1', 8.5, 0.05, builtPalm);
  const treeFat = plant('tree4', 5.6, 0.05, builtRoundTree), treeTall = plant('tree3', 8.6, 0.05, builtTree);
  const pine = plant('pine2', 8.0, 0.05, builtTree), pineSmall = plant('pine1', 5.0, 0.05, builtTree);
  const bush = plant('bush1', 1.0, 0.05, hedge), rock = plant('rock2', 0.85, 0.12, hedge), tuft = plant('tuft1', 0.5, 0.05, hedge);
  function builtRoundTree() { const b = new Builder(); b.cyl(0, 0, 0, 0.16, 2.2, [0.33, 0.24, 0.14], 0, 7, 0, false, false, 0.1); b.tube([0, 1.6, 0], [0.7, 2.6, 0.3], 0.07, 0.04, [0.33, 0.24, 0.14], 0, 0, 5); b.tube([0, 1.8, 0], [-0.6, 2.7, -0.4], 0.07, 0.04, [0.33, 0.24, 0.14], 0, 0, 5);
    const blobs = [[0, 3.2, 0, 1.7], [0.9, 2.8, 0.5, 1.2], [-0.8, 2.9, -0.5, 1.15], [0.3, 3.9, -0.7, 1.1], [-0.4, 3.7, 0.8, 1.0], [0.6, 2.4, -0.9, 0.9]]; blobs.forEach(([x, y, z, r], k) => b.sphere(x, y, z, r, r * 0.85, r, [0.18 + (k % 3) * 0.03, 0.44 + (k % 2) * 0.05, 0.16], { segs: 9, rings: 4 })); return b; }
  function builtPalm() { const b = new Builder(); b.cyl(0, 0, 0, 0.16, 5.5, [0.45, 0.35, 0.22], 0, 6, 0, true, false, 0.1); for (let k = 0; k < 7; k++) { const a = k / 7 * M.TAU; const lx = Math.cos(a), lz = Math.sin(a); b.poly([[0, 5.5, 0], [lx * 1.2 + lz * 0.35, 5.6, lz * 1.2 - lx * 0.35], [lx * 3.2, 4.6, lz * 3.2], [lx * 1.2 - lz * 0.35, 5.6, lz * 1.2 + lx * 0.35]], [0.2, 0.5, 0.2]); b.poly([[lx * 1.2 - lz * 0.35, 5.6, lz * 1.2 + lx * 0.35], [lx * 3.2, 4.6, lz * 3.2], [lx * 1.2 + lz * 0.35, 5.6, lz * 1.2 - lx * 0.35], [0, 5.5, 0]], [0.16, 0.42, 0.16]); } b.cyl(0, 5.2, 0, 0.3, 5.6, [0.5, 0.35, 0.1], 0, 6); return b; }
  function umbrella() { const b = new Builder(); b.cyl(0, 0, 0, 0.04, 2.2, [0.8, 0.8, 0.8], 0, 5); const c = [[0.9, 0.2, 0.2], [0.2, 0.5, 0.9], [0.95, 0.8, 0.1]][Math.floor(Math.random() * 3)]; b.cyl(0, 1.9, 0, 1.4, 2.3, c, 0, 10, 0, true, false, 0.05); return b; }
  function streetSign() { const b = new Builder(); b.cbox(0, 2.6, 0, 0.9, 0.22, 0.03, [1, 1, 1], TEX.names.signs, { uvScale: 1 }); return b; }
  // Sidewalk life in front of the shops
  function cafeSet() { const b = new Builder(); const m = [0.25, 0.25, 0.27], top = [0.9, 0.88, 0.82]; b.cyl(0, 0, 0, 0.04, 0.72, m, 0, 6); b.cyl(0, 0.72, 0, 0.45, 0.76, top, 0, 12, 0, true, true); b.cyl(0, 0, 0, 0.22, 0.03, m, 0, 8);
    for (const [cx, cz] of [[0.8, 0], [-0.8, 0], [0, 0.8]]) { b.cbox(cx, 0.45, cz, 0.42, 0.04, 0.42, m); b.cbox(cx + (cx ? Math.sign(cx) * 0.19 : 0), 0.7, cz + (cz ? 0.19 : 0), cx ? 0.04 : 0.42, 0.5, cz ? 0.04 : 0.42, m); for (const [lx, lz] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) b.cbox(cx + lx, 0.22, cz + lz, 0.03, 0.45, 0.03, m); }
    b.cyl(0.15, 0.76, 0.1, 0.05, 0.86, [0.95, 0.95, 0.9], 0, 6); b.cbox(-0.15, 0.78, -0.05, 0.14, 0.03, 0.14, [0.3, 0.2, 0.1]); return b; }
  function crates() { const b = new Builder(); const w = [0.62, 0.48, 0.3]; for (const [cx, cy, cz, rot] of [[0, 0.2, 0, 0], [0.55, 0.2, 0.1, 0.1], [0.2, 0.6, 0.05, -0.15], [-0.5, 0.2, 0.15, 0.05]]) { b.cbox(cx, cy, cz, 0.5, 0.4, 0.5, w); for (let k = 0; k < 3; k++) b.cbox(cx, cy - 0.15 + k * 0.15, cz + 0.251, 0.5, 0.06, 0.01, w.map(v => v * 0.7)); }
    const cols = [[0.85, 0.2, 0.15], [0.95, 0.65, 0.1], [0.4, 0.7, 0.25]]; for (let k = 0; k < 9; k++) b.sphere(0.2 + (k % 3 - 1) * 0.14, 0.86, 0.05 + (Math.floor(k / 3) - 1) * 0.14, 0.07, 0.07, 0.07, cols[k % 3], { segs: 6, rings: 2 }); return b; }
  function sandwichBoard() { const b = new Builder(); const c = [0.12, 0.12, 0.12]; b.wedge(-0.35, 0, -0.25, 0.7, 1.0, 0.25, c); b.wedge(-0.35, 0, 0, 0.7, 1.0, 0.25, c); b.cbox(0, 0.55, -0.27, 0.56, 0.7, 0.01, [0.95, 0.92, 0.85], 0, { faces: 32 }); b.cbox(0, 0.55, 0.27, 0.56, 0.7, 0.01, [0.95, 0.92, 0.85], 0, { faces: 16 }); for (let k = 0; k < 3; k++) { b.cbox(0, 0.75 - k * 0.16, -0.275, 0.4 - k * 0.08, 0.05, 0.005, [0.8, 0.2, 0.2], 0, { faces: 32 }); b.cbox(0, 0.75 - k * 0.16, 0.275, 0.4 - k * 0.08, 0.05, 0.005, [0.2, 0.3, 0.7], 0, { faces: 16 }); } return b; }
  function vending() { const b = new Builder(); const c = [0.85, 0.15, 0.12]; b.cbox(0, 0.9, 0, 0.9, 1.8, 0.7, c); b.cbox(0, 1.05, 0.36, 0.7, 1.2, 0.02, [0.2, 0.3, 0.4], TEX.names.neon, { faces: 16 }); b.cbox(-0.25, 0.3, 0.36, 0.3, 0.2, 0.02, [0.1, 0.1, 0.1], 0, { faces: 16 }); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) b.cbox(-0.2 + k * 0.14, 0.7 + j * 0.3, 0.37, 0.09, 0.2, 0.02, [[0.9, 0.5, 0.1], [0.2, 0.7, 0.9], [0.95, 0.95, 0.9]][(k + j) % 3]); return b; }
  function barberPole() { const b = new Builder(); b.cbox(0, 1.6, 0, 0.12, 0.6, 0.12, [0.3, 0.3, 0.32]); b.cyl(0, 1.3, 0.08, 0.05, 1.9, [0.4, 0.4, 0.42], 0, 6); for (let k = 0; k < 8; k++) b.cbox(0, 1.35 + k * 0.075, 0.2, 0.16, 0.075, 0.16, k % 2 ? [0.95, 0.95, 0.95] : (k % 4 === 1 ? [0.85, 0.1, 0.1] : [0.1, 0.2, 0.8])); b.sphere(0, 1.98, 0.2, 0.1, 0.06, 0.1, [0.4, 0.4, 0.42], { segs: 8, rings: 2 }); b.sphere(0, 1.3, 0.2, 0.1, 0.06, 0.1, [0.4, 0.4, 0.42], { segs: 8, rings: 2 }); return b; }
  function bikeRack() { const b = new Builder(); const c = [0.35, 0.36, 0.4]; for (let k = 0; k < 3; k++) { const z = (k - 1) * 0.7; b.tube([-0.4, 0, z], [-0.4, 0.75, z], 0.03, 0.03, c, 0, 0, 6); b.tube([0.4, 0, z], [0.4, 0.75, z], 0.03, 0.03, c, 0, 0, 6); b.tube([-0.4, 0.75, z], [0.4, 0.75, z], 0.03, 0.03, c, 0, 0, 6); }
    b.cbox(0.05, 0.35, 0.35, 0.02, 0.4, 1.0, [0.2, 0.2, 0.22]); b.wheel(0.05, 0.33, -0.1, 0.33, 0.04, 0, 12); b.wheel(0.05, 0.33, 0.85, 0.33, 0.04, 0, 12); b.tube([0.05, 0.4, 0.1], [0.05, 0.85, 0.7], 0.02, 0.02, [0.7, 0.2, 0.2], 0, 0, 6); b.tube([0.05, 0.45, 0.65], [0.05, 0.9, 0.55], 0.02, 0.02, [0.7, 0.2, 0.2], 0, 0, 6); b.cbox(0.05, 0.92, 0.1, 0.16, 0.05, 0.22, [0.15, 0.13, 0.12]); return b; }
  function flowerBucket() { const b = new Builder(); for (const [cx, cz] of [[0, 0], [0.45, 0.1], [-0.4, 0.15], [0.1, 0.45]]) { b.cyl(cx, 0, cz, 0.16, 0.42, [0.25, 0.27, 0.3], 0, 8, 0, false, false, 0.13); b.cyl(cx, 0.35, cz, 0.05, 0.75, [0.2, 0.5, 0.2], 0, 5); const c = [[1, 0.35, 0.5], [1, 0.85, 0.25], [0.95, 0.95, 0.95], [0.75, 0.4, 1], [1, 0.55, 0.2]][Math.floor((cx * 7 + cz * 13 + 5) % 5 + 5) % 5]; for (let k = 0; k < 6; k++) b.sphere(cx + Math.sin(k * 1.1) * 0.13, 0.78 + (k % 2) * 0.08, cz + Math.cos(k * 1.1) * 0.13, 0.06, 0.06, 0.06, c, { segs: 5, rings: 2 }); } return b; }
  function tireStack() { const b = new Builder(); for (let k = 0; k < 4; k++) b.wheel(0, 0.13 + k * 0.26, 0, 0.33, 0.24, 0, 10); return b; }
  function barrel() { const b = new Builder(); const c = [[0.25, 0.35, 0.55], [0.55, 0.2, 0.15], [0.3, 0.3, 0.3]][0]; b.cyl(0, 0, 0, 0.3, 0.9, c, 0, 10, 0, true, true); b.cyl(0, 0.2, 0, 0.31, 0.26, c.map(v => v * 0.7), 0, 10, 0, false, false); b.cyl(0, 0.6, 0, 0.31, 0.66, c.map(v => v * 0.7), 0, 10, 0, false, false); return b; }
  function hotdogCart() { const b = new Builder(); const c = [0.85, 0.85, 0.82], red = [0.85, 0.15, 0.12]; b.cbox(0, 0.75, 0, 1.6, 0.9, 0.9, c); b.cbox(0, 1.22, 0, 1.7, 0.06, 1.0, [0.5, 0.5, 0.52]); b.cbox(-0.4, 1.32, 0, 0.6, 0.14, 0.5, [0.35, 0.35, 0.37]); b.cbox(0.35, 1.32, 0.1, 0.5, 0.12, 0.4, [0.9, 0.75, 0.35]);
    b.wheel(0.55, 0.32, 0.52, 0.32, 0.06, 0, 12); b.wheel(0.55, 0.32, -0.52, 0.32, 0.06, 0, 12); b.cbox(-0.85, 0.5, 0, 0.06, 0.06, 1.0, [0.3, 0.3, 0.32]); b.cyl(-0.85, 0.05, -0.45, 0.06, 0.5, [0.3, 0.3, 0.32], 0, 6); b.cyl(-0.85, 0.05, 0.45, 0.06, 0.5, [0.3, 0.3, 0.32], 0, 6);
    b.cyl(0.3, 1.2, -0.3, 0.03, 2.5, [0.3, 0.3, 0.32], 0, 5); for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2; b.polyOut([[0.3, 2.5, -0.3], [0.3 + Math.cos(a0) * 1.1, 2.2, -0.3 + Math.sin(a0) * 1.1], [0.3 + Math.cos(a1) * 1.1, 2.2, -0.3 + Math.sin(a1) * 1.1]], k % 2 ? red : c, 0.3, 1.8, -0.3); }
    b.cbox(0, 0.8, 0.46, 1.2, 0.35, 0.02, [1, 1, 0.95], 0, { faces: 16 }); b.cbox(0, 0.8, 0.47, 0.9, 0.12, 0.01, red, 0, { faces: 16 }); return b; }
  function pigeon() { const b = new Builder(); const g = [0.5, 0.5, 0.55]; b.sphere(0, 0.12, 0, 0.09, 0.08, 0.14, g, { segs: 6, rings: 3 }); b.sphere(0, 0.22, 0.12, 0.05, 0.05, 0.05, [0.35, 0.4, 0.5], { segs: 5, rings: 2 }); b.cbox(0, 0.22, 0.18, 0.02, 0.02, 0.04, [0.9, 0.7, 0.3]); b.cbox(0, 0.13, -0.16, 0.08, 0.02, 0.1, g.map(v => v * 0.8)); for (const sx of [1, -1]) { b.cbox(sx * 0.11, 0.14, -0.01, 0.14, 0.015, 0.16, g.map(v => v * 0.9), 0, { bone: 0 }); b.cbox(sx * 0.03, 0.04, 0.02, 0.01, 0.08, 0.01, [0.8, 0.4, 0.3]); } return b; }
  function gull() { const b = new Builder(); const w = [0.95, 0.95, 0.97]; b.sphere(0, 0, 0, 0.12, 0.1, 0.24, w, { segs: 6, rings: 3 }); b.sphere(0, 0.06, 0.24, 0.07, 0.07, 0.08, w, { segs: 5, rings: 2 }); b.cbox(0, 0.05, 0.34, 0.03, 0.02, 0.08, [0.95, 0.75, 0.2]); for (const sx of [1, -1]) { b.cbox(sx * 0.42, 0.03, -0.02, 0.8, 0.02, 0.2, w, 0); b.cbox(sx * 0.78, 0.04, -0.06, 0.12, 0.015, 0.14, [0.2, 0.2, 0.22]); } b.cbox(0, 0.02, -0.28, 0.14, 0.015, 0.12, w); return b; }
  function plane() { const b = new Builder(); const w = [0.92, 0.93, 0.95], d = [0.2, 0.25, 0.4]; b.sphere(0, 0, 0, 1.4, 1.4, 12, w, { segs: 10, rings: 5 }); b.cbox(0, -0.2, 0.5, 26, 0.35, 3.2, w); b.cbox(0, 0.2, -9.5, 9, 0.3, 2.2, w); b.polyOut([[0, 0.5, -8], [0, 5, -11.5], [0, 5, -9.5], [0, 0.5, -6]], d, 0, 0, 0); b.polyOut([[0.02, 0.5, -8], [0.02, 5, -11.5], [0.02, 5, -9.5], [0.02, 0.5, -6]], d, 5, 0, -10);
    for (const sx of [1, -1]) b.cyl(sx * 5, -1.6, 1, 0.7, -0.4, [0.35, 0.35, 0.4], 0, 8, 0, true, true); b.cbox(0, 1.2, 2, 0.3, 0.3, 0.3, [1, 0.2, 0.2], 0, { bone: 1 }); b.cbox(-13, -0.1, 0.5, 0.3, 0.3, 0.3, [1, 0.2, 0.2], 0, { bone: 1 }); b.cbox(13, -0.1, 0.5, 0.3, 0.3, 0.3, [0.2, 1, 0.3], 0, { bone: 1 }); return b; }
  function payphone() { const b = new Builder(); b.cbox(0, 0.9, 0, 0.5, 1.8, 0.4, [0.15, 0.3, 0.6]); b.cbox(0, 1.35, 0.21, 0.36, 0.5, 0.04, [0.05, 0.05, 0.06]); b.cbox(-0.12, 1.0, 0.22, 0.08, 0.3, 0.06, [0.1, 0.1, 0.12]); b.cbox(0, 1.9, 0, 0.55, 0.12, 0.45, [0.15, 0.3, 0.6]); return b; }
  function bollard() { const b = new Builder(); b.cyl(0, 0, 0, 0.14, 0.9, [0.3, 0.3, 0.32], 0, 6); return b; }
  function pickupBox() { const b = new Builder(); b.cbox(0, 0.6, 0, 0.7, 0.7, 0.7, [1, 1, 1], 0, { bone: 0 }); return b; }
  // Pickup models, origin on the ground, about half a metre tall.
  // Held weapons: built around the hand with the barrel along +z, drawn as a second entity on the right forearm.
  const HAND = [-0.26, -0.6, 0.1]; // where the right hand sits in the rest pose (arm hanging), for the forearm bone to carry
  const heldCache = {};
  function heldMesh(key) {
    if (heldCache[key]) return heldCache[key];
    const b = new Builder(); const dark = [0.15, 0.15, 0.17], wood = [0.4, 0.28, 0.16], olive = [0.25, 0.3, 0.22], steel = [0.5, 0.5, 0.55];
    // Weapons are modelled in "aim space" (barrel +z, up +y) and turned into the rest pose of a hanging arm, where the
    // forearm points down -y and the palm faces +z: aim (x, y, z) -> rest (x, -z, y). Raising the arm then points the barrel forward.
    const A = (x, y, z) => [x, -z, y];
    const cb = (x, y, z, w, h, d, col, tile = 0, opts = {}) => { const [X, Y, Z] = A(x, y, z); b.cbox(X, Y, Z, w, d, h, col, tile, opts); };
    const tb = (p0, p1, r0, r1, col, n = 6) => b.tube(A(...p0), A(...p1), r0, r1, col, 0, 0, n);
    const sp = (x, y, z, rx, ry, rz, col, o) => b.sphere(...A(x, y, z), rx, rz, ry, col, o);
    if (key === 'pistol') { cb(0, 0.05, 0.13, 0.05, 0.06, 0.28, dark); cb(0, -0.04, 0.0, 0.045, 0.14, 0.06, wood); cb(0, 0.0, 0.07, 0.03, 0.03, 0.08, dark); }
    else if (key === 'uzi') { cb(0, 0.05, 0.15, 0.06, 0.08, 0.36, dark); cb(0, -0.09, 0.06, 0.04, 0.2, 0.05, dark); cb(0, -0.04, -0.02, 0.045, 0.12, 0.06, wood); cb(0, 0.05, -0.15, 0.03, 0.05, 0.14, steel); }
    else if (key === 'shotgun') { cb(0, 0.06, 0.4, 0.045, 0.045, 0.75, dark); cb(0, 0.01, 0.4, 0.045, 0.045, 0.75, dark); cb(0, 0.0, 0.32, 0.06, 0.06, 0.2, wood); cb(0, 0.03, -0.15, 0.05, 0.11, 0.32, wood); }
    else if (key === 'rifle') { cb(0, 0.06, 0.25, 0.06, 0.08, 0.6, dark); cb(0, 0.08, 0.68, 0.03, 0.03, 0.3, dark); cb(0, -0.07, 0.12, 0.04, 0.18, 0.06, dark); cb(0, 0.05, -0.2, 0.05, 0.1, 0.3, dark); cb(0, 0.13, 0.15, 0.03, 0.05, 0.12, dark); }
    else if (key === 'rocket') { cb(0, 0.16, 0.2, 0.16, 0.16, 1.1, olive); cb(0, 0.16, 0.7, 0.2, 0.2, 0.15, dark); cb(0, -0.02, 0.0, 0.05, 0.14, 0.06, dark); cb(0, 0.28, 0.1, 0.04, 0.08, 0.1, dark); }
    else if (key === 'grenade') { sp(0, 0.0, 0.05, 0.05, 0.06, 0.05, [0.2, 0.32, 0.2], { segs: 8, rings: 3 }); cb(0, 0.08, 0.05, 0.04, 0.04, 0.04, steel); }
    else if (key === 'bat') { tb([0, -0.05, -0.05], [0, 0.08, 0.78], 0.028, 0.048, [0.62, 0.46, 0.26], 8); tb([0, -0.06, -0.06], [0, -0.07, -0.1], 0.035, 0.035, dark, 6); }
    else if (key === 'camera') { cb(0, 0.05, 0.05, 0.14, 0.09, 0.07, dark); tb([0, 0.05, 0.08], [0, 0.05, 0.14], 0.03, 0.03, [0.05, 0.05, 0.06], 8); cb(-0.04, 0.11, 0.05, 0.03, 0.03, 0.03, steel); }
    // things carried in a hanging hand stay in rest space (up is +y, forward +z)
    else if (key === 'coffee') { b.cyl(0, -0.06, 0.06, 0.04, 0.08, [0.95, 0.93, 0.88], 0, 8, 0, true, true, 0.035); b.cyl(0, 0.08, 0.06, 0.045, 0.1, [0.3, 0.25, 0.2], 0, 8, 0, true, false); }
    else if (key === 'bag') { b.cbox(0, -0.28, 0.04, 0.26, 0.32, 0.12, [0.85, 0.75, 0.55]); b.tube([-0.08, -0.12, 0.04], [0.08, -0.12, 0.04], 0.01, 0.01, [0.4, 0.3, 0.2], 0, 0, 4); b.cbox(0, -0.2, 0.105, 0.14, 0.1, 0.005, [0.8, 0.2, 0.2], 0, { faces: 16 }); }
    else if (key === 'umbrella') { b.tube([0, 0, -0.05], [0, 0.05, 0.95], 0.012, 0.012, dark, 0, 0, 5); const uc = [[0.85, 0.15, 0.15], [0.15, 0.2, 0.5], [0.1, 0.1, 0.12], [0.9, 0.85, 0.2]][Math.floor(Math.random() * 4)]; for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2, a1 = (k + 1) / 8 * Math.PI * 2; b.polyOut([[0, 0.05, 1.0], [Math.cos(a0) * 0.55, Math.sin(a0) * 0.55, 0.8], [Math.cos(a1) * 0.55, Math.sin(a1) * 0.55, 0.8]], uc, 0, 0, 0.3); b.polyOut([[0, 0.04, 1.0], [Math.cos(a1) * 0.55, Math.sin(a1) * 0.55, 0.8], [Math.cos(a0) * 0.55, Math.sin(a0) * 0.55, 0.8]], uc.map(v => v * 0.8), 0, 0, 1.4); } }
    else if (key === 'phone') { b.cbox(0, 0.06, 0.02, 0.07, 0.14, 0.012, [0.05, 0.05, 0.06]); b.cbox(0, 0.06, 0.028, 0.06, 0.12, 0.002, [0.3, 0.6, 0.9], TEX.names.neon, { faces: 16 }); }
    else if (key === 'guitar') { const wd = [0.6, 0.4, 0.2]; b.sphere(0, -0.2, 0.05, 0.16, 0.05, 0.2, wd, { segs: 10, rings: 3 }); b.sphere(0, 0.05, 0.05, 0.13, 0.05, 0.16, wd, { segs: 10, rings: 3 }); b.tube([0, 0.15, 0.05], [0, 0.75, 0.02], 0.025, 0.025, [0.3, 0.2, 0.1], 0, 0, 5); b.cbox(0, 0.78, 0.02, 0.06, 0.12, 0.03, dark); b.cbox(0, -0.15, 0.1, 0.05, 0.04, 0.02, dark); }
    heldCache[key] = b.build(); return heldCache[key];
  }
  const PICKUP_MODELS = {
    weapon(key) { const b = new Builder(); const d = [0.15, 0.15, 0.17], w = [0.35, 0.25, 0.15];
      if (key === 'bat') { b.cyl(0, 0.05, 0, 0.05, 0.9, [0.6, 0.45, 0.25], 0, 6, 0, true, true, 0.035); }
      else if (key === 'grenade') { b.cyl(0, 0.05, 0, 0.14, 0.4, [0.2, 0.32, 0.2], 0, 8, 0, true, true); b.cbox(0, 0.46, 0, 0.1, 0.1, 0.1, [0.5, 0.5, 0.5]); }
      else if (key === 'rocket') { b.cbox(0, 0.3, 0, 0.16, 0.16, 1.2, [0.25, 0.3, 0.25]); b.cbox(0, 0.3, 0.55, 0.22, 0.22, 0.2, [0.15, 0.15, 0.15]); b.cbox(0, 0.16, -0.1, 0.06, 0.16, 0.3, w); }
      else { const L = key === 'pistol' ? 0.36 : key === 'uzi' ? 0.5 : 0.9; b.cbox(0, 0.32, 0, 0.07, 0.1, L, d); b.cbox(0, 0.2, -L * 0.25, 0.06, 0.18, 0.09, w); if (key !== 'pistol') b.cbox(0, 0.22, L * 0.1, 0.06, 0.14, 0.06, d); if (key === 'shotgun' || key === 'rifle') b.cbox(0, 0.3, -L * 0.45, 0.07, 0.12, 0.25, w); if (key === 'uzi' || key === 'rifle') b.cbox(0, 0.16, L * 0.05, 0.06, 0.22, 0.08, d); }
      return b; },
    health() { const b = new Builder(); const c = [0.95, 0.15, 0.15]; b.cbox(0, 0.35, 0, 0.5, 0.16, 0.16, c); b.cbox(0, 0.35, 0, 0.16, 0.5, 0.16, c); b.cbox(0, 0.35, 0, 0.16, 0.16, 0.5, c); return b; },
    armor() { const b = new Builder(); const c = [0.25, 0.5, 0.9]; b.cbox(0, 0.32, 0, 0.5, 0.55, 0.22, c); b.cbox(0, 0.58, 0, 0.32, 0.12, 0.24, c.map(v => v * 0.8)); b.cbox(0, 0.32, 0.12, 0.2, 0.3, 0.02, [0.9, 0.9, 0.95], 0, { faces: 16 }); return b; },
    cash() { const b = new Builder(); for (let k = 0; k < 3; k++) b.cbox((k - 1) * 0.05, 0.05 + k * 0.07, (k - 1) * 0.03, 0.42, 0.06, 0.22, [0.25, 0.75, 0.3]); b.cbox(0, 0.28, 0, 0.16, 0.02, 0.24, [0.9, 0.9, 0.6]); return b; },
    bribe() { const b = new Builder(); b.cyl(0, 0.15, 0, 0.32, 0.25, [0.2, 0.4, 0.95], 0, 5, 0, true, true); b.cyl(0, 0.26, 0, 0.16, 0.3, [0.95, 0.85, 0.3], 0, 5, 0, true, false); return b; },
    rampage() { const b = new Builder(); const c = [0.95, 0.95, 0.9]; b.cbox(0, 0.42, 0, 0.36, 0.34, 0.34, c); b.cbox(0, 0.16, 0, 0.3, 0.2, 0.28, c); b.cbox(0.09, 0.44, 0.17, 0.09, 0.09, 0.02, [0.1, 0.1, 0.1], 0, { faces: 16 }); b.cbox(-0.09, 0.44, 0.17, 0.09, 0.09, 0.02, [0.1, 0.1, 0.1], 0, { faces: 16 }); for (let k = 0; k < 3; k++) b.cbox(-0.1 + k * 0.1, 0.1, 0.15, 0.05, 0.1, 0.02, [0.1, 0.1, 0.1], 0, { faces: 16 }); return b; },
    package() { return packageBox(); },
  };
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
  return { Builder, shippingContainer, VEHICLES, MOUTH_POS, HAND, heldMesh, carMesh, seatHeight, seatFit, dentBody, pedMesh, PICKUP_MODELS, assetInto, assetBounds, treeFat, treeTall, pine, pineSmall, bush, rock, tuft, dumpster, mailbox, meter, newsbox, busShelter, cone, barrier, hedge, roundTree, palm, umbrella, streetSign, payphone, hotdogCart, pigeon, gull, plane, cafeSet, crates, sandwichBoard, vending, barberPole, bikeRack, flowerBucket, tireStack, barrel, lamppost, trafficLight, lampHead, tree, hydrant, bin, bench, bollard, pickupBox, packageBox, marker, heli };
})();
