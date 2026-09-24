// STÅLHAGEN II — geometry builder. Everything in the game is boxes, cylinders, tubes, lathes and heightfields
// pushed into one interleaved array, with a material tile and a bone id on every vertex.
'use strict';
class Builder {
  constructor() { this.v = []; this.i = []; this.mark = 0; this.bone = 0; this.tile = 0; this.col = [1, 1, 1]; }
  get count() { return this.v.length / 13; }
  vert(x, y, z, nx, ny, nz, u, vv, o) {
    const c = (o && o.col) || this.col;
    this.v.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], u, vv, o && o.tile !== undefined ? o.tile : this.tile, o && o.bone !== undefined ? o.bone : this.bone);
    return this.count - 1;
  }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  // Axis-aligned box from min corner. Faces get planar UVs in metres scaled by uv.
  box(x, y, z, w, h, d, o = {}) {
    const s = o.uv || 0.5, flip = o.inside ? -1 : 1;
    const faces = [
      [[x + w, y, z], [x + w, y + h, z], [x + w, y + h, z + d], [x + w, y, z + d], [1, 0, 0], d, h],
      [[x, y, z + d], [x, y + h, z + d], [x, y + h, z], [x, y, z], [-1, 0, 0], d, h],
      [[x, y + h, z], [x, y + h, z + d], [x + w, y + h, z + d], [x + w, y + h, z], [0, 1, 0], w, d],
      [[x, y, z + d], [x, y, z], [x + w, y, z], [x + w, y, z + d], [0, -1, 0], w, d],
      [[x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d], [0, 0, 1], w, h],
      [[x + w, y, z], [x, y, z], [x, y + h, z], [x + w, y + h, z], [0, 0, -1], w, h],
    ];
    for (const [p0, p1, p2, p3, n, lu, lv] of faces) {
      if (o.skipTop && n[1] > 0) continue; if (o.skipBottom && n[1] < 0) continue;
      const nn = [n[0] * flip, n[1] * flip, n[2] * flip];
      const a = this.vert(...p0, ...nn, 0, 0, o), b = this.vert(...p1, ...nn, 0, lv * s, o), c = this.vert(...p2, ...nn, lu * s, lv * s, o), dd = this.vert(...p3, ...nn, lu * s, 0, o);
      if (o.inside) this.quad(a, dd, c, b); else this.quad(a, b, c, dd);
    }
    return this;
  }
  // Cylinder (or frustum with r1) whose base centre is (x,y,z), rising along axis 'y' | 'x' | 'z' by h.
  cyl(x, y, z, r0, h, o = {}) {
    const segs = o.segs || 12, r1 = o.r1 !== undefined ? o.r1 : r0, axis = o.axis || 'y', s = o.uv || 0.5;
    const P = (a, t) => {
      const rr = r0 + (r1 - r0) * t, cx = Math.cos(a) * rr, sz = Math.sin(a) * rr, hh = h * t;
      if (axis === 'y') return [x + cx, y + hh, z + sz]; if (axis === 'x') return [x + hh, y + sz, z + cx]; return [x + cx, y + sz, z + hh];
    };
    const N = a => { const cx = Math.cos(a), sz = Math.sin(a); if (axis === 'y') return [cx, 0, sz]; if (axis === 'x') return [0, sz, cx]; return [cx, sz, 0]; };
    const base = this.count;
    for (let k = 0; k <= segs; k++) {
      const a = k / segs * Math.PI * 2, n = N(a), u = k / segs * Math.PI * 2 * Math.max(r0, r1) * s;
      this.vert(...P(a, 0), ...n, u, 0, o); this.vert(...P(a, 1), ...n, u, h * s, o);
    }
    for (let k = 0; k < segs; k++) { const a = base + k * 2; this.quad(a, a + 1, a + 3, a + 2); }
    if (!o.open) {
      for (const [t, dir] of [[0, -1], [1, 1]]) {
        const n = axis === 'y' ? [0, dir, 0] : axis === 'x' ? [dir, 0, 0] : [0, 0, dir];
        const c = this.vert(...P(0, t).map((v, i) => i === (axis === 'y' ? 1 : axis === 'x' ? 0 : 2) ? v : (P(0, t)[i] + P(Math.PI, t)[i]) / 2), ...n, 0, 0, o);
        const ring = [];
        for (let k = 0; k < segs; k++) ring.push(this.vert(...P(k / segs * Math.PI * 2, t), ...n, Math.cos(k / segs * Math.PI * 2) * s, Math.sin(k / segs * Math.PI * 2) * s, o));
        for (let k = 0; k < segs; k++) { const a = ring[k], b = ring[(k + 1) % segs]; if (dir > 0) this.i.push(c, a, b); else this.i.push(c, b, a); }
      }
    }
    return this;
  }
  // A tube along a polyline of [x,y,z] points; hoses, cables, rope.
  tube(pts, r, o = {}) {
    const segs = o.segs || 6, s = o.uv || 0.5, base = this.count;
    let len = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      let tx = next[0] - prev[0], ty = next[1] - prev[1], tz = next[2] - prev[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      if (i > 0) len += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
      // a stable perpendicular
      let ax = Math.abs(ty) < 0.9 ? 0 : 1, ay = Math.abs(ty) < 0.9 ? 1 : 0, az = 0;
      let ux = ay * tz - az * ty, uy = az * tx - ax * tz, uz = ax * ty - ay * tx; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const wx = ty * uz - tz * uy, wy = tz * ux - tx * uz, wz = tx * uy - ty * ux;
      for (let k = 0; k <= segs; k++) {
        const a = k / segs * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        const nx = ux * c + wx * sn, ny = uy * c + wy * sn, nz = uz * c + wz * sn;
        this.vert(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r, nx, ny, nz, k / segs * r * 6 * s, len * s, o);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < segs; k++) {
      const a = base + i * (segs + 1) + k, b = a + segs + 1; this.quad(a, a + 1, b + 1, b);
    }
    return this;
  }
  // Surface of revolution around the y axis: profile is [[r, y], ...] from bottom to top.
  lathe(x, y, z, profile, o = {}) {
    const segs = o.segs || 24, s = o.uv || 0.5, base = this.count;
    for (let i = 0; i < profile.length; i++) {
      const [r, h] = profile[i], p0 = profile[Math.max(0, i - 1)], p1 = profile[Math.min(profile.length - 1, i + 1)];
      const dr = p1[0] - p0[0], dh = p1[1] - p0[1], l = Math.hypot(dr, dh) || 1, nr = dh / l, ny = -dr / l;
      for (let k = 0; k <= segs; k++) {
        const a = k / segs * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        this.vert(x + c * r, y + h, z + sn * r, c * nr, ny, sn * nr, k / segs * Math.PI * 2 * r * s, h * s, o);
      }
    }
    for (let i = 0; i < profile.length - 1; i++) for (let k = 0; k < segs; k++) {
      const a = base + i * (segs + 1) + k, b = a + segs + 1; this.quad(a, b, b + 1, a + 1);
    }
    return this;
  }
  sphere(x, y, z, r, o = {}) {
    const segs = o.segs || 10, rings = o.rings || 8, base = this.count, s = o.uv || 0.5;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings * Math.PI, sy = Math.cos(t), rr = Math.sin(t);
      for (let k = 0; k <= segs; k++) { const a = k / segs * Math.PI * 2, nx = Math.cos(a) * rr, nz = Math.sin(a) * rr; this.vert(x + nx * r, y + sy * r, z + nz * r, nx, sy, nz, k / segs * r * 6 * s, j / rings * r * 3 * s, o); }
    }
    for (let j = 0; j < rings; j++) for (let k = 0; k < segs; k++) { const a = base + j * (segs + 1) + k, b = a + segs + 1; this.quad(a, a + 1, b + 1, b); }
    return this;
  }
  // Heightfield over x0..x0+w, z0..z0+d with nx by nz cells. fn(x,z) -> y; tileFn(x,z,y,slope) -> [tile, col].
  grid(x0, z0, w, d, nx, nz, fn, tileFn, o = {}) {
    const base = this.count, s = o.uv || 0.25;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i / nx * w, z = z0 + j / nz * d, y = fn(x, z), e = 0.5;
      const dx = (fn(x + e, z) - fn(x - e, z)) / (2 * e), dz = (fn(x, z + e) - fn(x, z - e)) / (2 * e);
      let nxv = -dx, nyv = 1, nzv = -dz; const l = Math.hypot(nxv, nyv, nzv); nxv /= l; nyv /= l; nzv /= l;
      const tc = tileFn ? tileFn(x, z, y, Math.hypot(dx, dz)) : null;
      this.vert(x, y, z, nxv, nyv, nzv, x * s, z * s, tc ? { tile: tc[0], col: tc[1] } : o);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i, b = a + nx + 1; this.quad(a, b, b + 1, a + 1); }
    return this;
  }
  // Transform every vertex added since mark by a 4x4 (positions and normals).
  begin() { this.mark = this.count; return this; }
  end(m) {
    for (let v = this.mark; v < this.count; v++) {
      const o = v * 13, x = this.v[o], y = this.v[o + 1], z = this.v[o + 2], nx = this.v[o + 3], ny = this.v[o + 4], nz = this.v[o + 5];
      this.v[o] = m[0] * x + m[4] * y + m[8] * z + m[12]; this.v[o + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; this.v[o + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const tx = m[0] * nx + m[4] * ny + m[8] * nz, ty = m[1] * nx + m[5] * ny + m[9] * nz, tz = m[2] * nx + m[6] * ny + m[10] * nz, l = Math.hypot(tx, ty, tz) || 1;
      this.v[o + 3] = tx / l; this.v[o + 4] = ty / l; this.v[o + 5] = tz / l;
    }
    return this;
  }
  // Elliptical cross-sections [height, x radius, z radius, z offset].
  // Profile values are authored in metres; smooth normals follow the profile.
  loft(x, y, z, profile, o = {}) {
    const segs = o.segs || 20, base = this.count;
    for (let j = 0; j < profile.length; j++) {
      const [h, rx, rz, dz = 0] = profile[j];
      const p = profile[Math.max(0, j - 1)], q = profile[Math.min(profile.length - 1, j + 1)];
      for (let k = 0; k <= segs; k++) {
        const a = k / segs * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        let nx = c / Math.max(rx, 0.001), nz = sn / Math.max(rz, 0.001);
        let ny = -(nx * c * (q[1] - p[1]) + nz * (sn * (q[2] - p[2]) + ((q[3] || 0) - (p[3] || 0)))) / Math.max(0.001, q[0] - p[0]);
        const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
        this.vert(x + c * rx, y + h, z + sn * rz + dz, nx, ny, nz, k / segs, h * 2, o);
      }
    }
    for (let j = 0; j < profile.length - 1; j++) for (let k = 0; k < segs; k++) {
      const a = base + j * (segs + 1) + k, b = a + segs + 1; this.quad(a, b, b + 1, a + 1);
    }
    return this;
  }
  // Bevelled box, subdivided only across the rounded edges. Correct normals
  // preserve large flat panels while catching light on the silhouette.
  roundedBox(x, y, z, w, h, d, radius = 0.04, o = {}) {
    const r = Math.min(radius, w / 2, h / 2, d / 2), center = [x + w/2, y + h/2, z + d/2], half = [w/2, h/2, d/2];
    for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
      const u = (axis + 1) % 3, v = (axis + 2) % 3;
      const steps = a => [-half[a], -half[a]+r*0.3, -half[a]+r, half[a]-r, half[a]-r*0.3, half[a]];
      const us = steps(u), vs = steps(v), base = this.count;
      for (const b of vs) for (const a of us) {
        const p = [0,0,0]; p[axis] = side * half[axis]; p[u] = a; p[v] = b;
        const q = p.map((n,i) => Math.max(-half[i]+r, Math.min(half[i]-r,n)));
        const n = p.map((n,i) => n-q[i]), len = Math.hypot(...n) || 1;
        this.vert(...q.map((val,i) => center[i]+val+n[i]/len*r), ...n.map(val=>val/len), (a+half[u])*(o.uv||0.5), (b+half[v])*(o.uv||0.5), o);
      }
      for (let j=0;j<5;j++) for(let k=0;k<5;k++) { const a=base+j*6+k; if(side>0) this.quad(a,a+1,a+7,a+6); else this.quad(a,a+6,a+7,a+1); }
    }
    return this;
  }
  // Bounding box of everything so far.
  bounds() {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let v = 0; v < this.count; v++) { const o = v * 13; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], this.v[o + k]); mx[k] = Math.max(mx[k], this.v[o + k]); } }
    return { mn, mx };
  }
  build(dynamic = false) { const m = GL.mesh(new Float32Array(this.v), new Uint32Array(this.i), dynamic); m.bounds = this.bounds(); return m; }
}
