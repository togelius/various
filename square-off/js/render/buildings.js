// SQUARE OFF — Render A: buildings. 346 GEO footprints extruded to real heights with per-class
// procedural facades (one shared atlas → one material), cornices, Row stoops, roofs with parapets,
// instanced water towers / rooftop clutter, night windows, and a filler city beyond the GEO radius.
(function (SQ) {
  'use strict';
  var env = SQ.env = SQ.env || {};
  var U = env.util = env.util || {};
  var B = env.buildings = env.buildings || {};

  var CLASSES = B.CLASSES = ['row', 'nyu', 'judson', 'brown', 'lime', 'glass', 'brick'];
  var NYU_SANDSTONE = /Bobst|Kimmel|Silver Center|Kaufman|Tisch Hall|Warren Weaver|Lipton|Furman/i;
  var SKIP_KINDS = { triumphal_arch: 1, toilets: 1 };

  B.classify = function (b) {
    var c = U.polyCentroid(b.pts), name = b.name || '';
    if (NYU_SANDSTONE.test(name)) return 'nyu';
    if (/Judson/i.test(name)) return 'judson';
    if (c[1] > -112 && c[1] < -78 && c[0] > -170 && c[0] < 150 && b.h < 25) return 'row';
    if (/Church/i.test(name)) return 'brown';
    var hsh = U.hash2(c[0] * 0.37, c[1] * 0.91);
    // The Village has almost no curtain walls: prewar brick/limestone towers (One Fifth, 2 Fifth…)
    if (b.h >= 60) return hsh < 0.5 ? 'brick' : 'lime';
    if (b.h < 22) return hsh < 0.42 ? 'brown' : 'brick';
    if (b.h >= 40 && hsh < 0.1 && b.kind === 'yes') return 'glass';
    return hsh < 0.6 ? 'lime' : 'brick';
  };

  // Atlas of all facade classes: 2 blocks across × 4 down, each block 4 variants × (upper, ground).
  B.atlas = function () {
    if (B._atlas) return B._atlas;
    var bw = 1024, bh = 672, c = U.canvas(bw * 2, bh * 4), ctx = c.getContext('2d');
    CLASSES.concat(['brick']).forEach(function (cls, i) { ctx.drawImage(SQ.tex.facade(cls), (i % 2) * bw, Math.floor(i / 2) * bh); });
    return (B._atlas = c);
  };

  // -------------------------------------------------------------- extrusion
  function outwardEdges(pts) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var A = pts[i], Bp = pts[(i + 1) % pts.length], dx = Bp[0] - A[0], dz = Bp[1] - A[1], L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      var nx = dz / L, nz = -dx / L, mx = (A[0] + Bp[0]) / 2, mz = (A[1] + Bp[1]) / 2;
      if (U.pointInPoly(mx + nx * 0.15, mz + nz * 0.15, pts)) { nx = -nx; nz = -nz; }
      out.push({ A: A, B: Bp, L: L, nx: nx, nz: nz, dx: dx / L, dz: dz / L });
    }
    return out;
  }
  B.outwardEdges = outwardEdges;

  // Accumulates wall + roof geometry for one mesh.
  function Acc() { this.p = []; this.n = []; this.uv = []; this.b = []; this.c = []; this.i = []; }
  Acc.prototype.quad = function (v, nrm, uvs, attrB, col) {
    var base = this.p.length / 3, self = this;
    v.forEach(function (q, k) { self.p.push(q[0], q[1], q[2]); self.n.push(nrm[0], nrm[1], nrm[2]); self.uv.push(uvs[k][0], uvs[k][1]); self.b.push(attrB[0], attrB[1], attrB[2], attrB[3]); self.c.push(col[0], col[1], col[2]); });
    // OSM rings mix CW/CCW: orient the winding to agree with the intended normal
    var ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2], wx = v[3][0] - v[0][0], wy = v[3][1] - v[0][1], wz = v[3][2] - v[0][2];
    var gx = uy * wz - uz * wy, gy = uz * wx - ux * wz, gz = ux * wy - uy * wx;
    if (gx * nrm[0] + gy * nrm[1] + gz * nrm[2] >= 0) this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  Acc.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.b.length) g.setAttribute('aB', new THREE.Float32BufferAttribute(this.b, 4));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };

  var PARAPET = 0.9;
  function addBuilding(walls, roofs, b, cls, flat, tint) {
    var pts = b.pts, h = b.h, info = SQ.tex.FACADE[cls] || SQ.tex.FACADE.brick;
    var floorH = info.floor, nF = Math.max(1, Math.round(h / floorH)), vS = nF * floorH / h;
    var c = U.polyCentroid(pts), seed = Math.floor(U.hash2(c[0], c[1]) * 997) + 1;
    var clsIdx = flat ? -1 : CLASSES.indexOf(cls);
    var col = tint || [1, 1, 1];
    var top = flat ? h : h + PARAPET;
    var attr = [seed, nF, clsIdx, floorH];
    outwardEdges(pts).forEach(function (e) {
      var bays = Math.max(1, Math.round(e.L / info.bay)), uS = e.L < 1.6 ? 0.04 : bays * info.bay / e.L, u0 = U.hash1(seed + e.L) < 0.5 ? 0 : 0;
      var A = e.A, Bp = e.B;
      walls.quad([[A[0], 0, A[1]], [Bp[0], 0, Bp[1]], [Bp[0], top, Bp[1]], [A[0], top, A[1]]], [e.nx, 0, e.nz],
        [[u0, 0], [u0 + e.L * uS, 0], [u0 + e.L * uS, top * vS], [u0, top * vS]], attr, col);
      if (flat) return;
      // parapet inner face (roof material)
      roofs.quad([[Bp[0], h, Bp[1]], [A[0], h, A[1]], [A[0], top, A[1]], [Bp[0], top, Bp[1]]], [-e.nx, 0, -e.nz],
        [[0, 0], [e.L, 0], [e.L, PARAPET], [0, PARAPET]], [0, 0, 0, 0], [0.62, 0.6, 0.57]);
      // coping
      var ix = -e.nx * 0.25, iz = -e.nz * 0.25;
      roofs.quad([[A[0], top, A[1]], [Bp[0], top, Bp[1]], [Bp[0] + ix, top, Bp[1] + iz], [A[0] + ix, top, A[1] + iz]], [0, 1, 0],
        [[0, 0], [e.L, 0], [e.L, 0.25], [0, 0.25]], [0, 0, 0, 0], [0.8, 0.78, 0.74]);
    });
    // roof: triangulated footprint at h (gravel, slightly tinted per building)
    var contour = pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var tris = THREE.ShapeUtils.triangulateShape(contour, []);
    var k = 0.85 + U.hash1(seed) * 0.25, rc = [0.5 * k, 0.49 * k, 0.47 * k];
    if (U.hash1(seed * 3) < 0.2) rc = [0.33 * k, 0.33 * k, 0.35 * k]; // tar roofs
    var base = roofs.p.length / 3;
    pts.forEach(function (p) { roofs.p.push(p[0], h, p[1]); roofs.n.push(0, 1, 0); roofs.uv.push(p[0] / 6, p[1] / 6); roofs.b.push(0, 0, 0, 0); roofs.c.push(rc[0], rc[1], rc[2]); });
    tris.forEach(function (t) {
      // ensure upward-facing winding
      var a = pts[t[0]], bq = pts[t[1]], cq = pts[t[2]];
      var cross = (bq[0] - a[0]) * (cq[1] - a[1]) - (bq[1] - a[1]) * (cq[0] - a[0]);
      if (cross < 0) roofs.i.push(base + t[0], base + t[1], base + t[2]); else roofs.i.push(base + t[0], base + t[2], base + t[1]);
    });
  }

  // Trim: cornices, belt courses, Row stoops and door surrounds (vertex coloured, merged)
  var TRIM = { row: 0xece6d8, brown: 0x5a3c2e, brick: 0x6f6a62, lime: 0xd6cfbf, nyu: 0x6e3328, judson: 0xd9c49a, glass: 0x39434b };
  function addTrim(bld, b, cls) {
    if (cls === 'glass') return;
    var h = b.h, color = TRIM[cls] || 0xcccccc, info = SQ.tex.FACADE[cls];
    outwardEdges(b.pts).forEach(function (e) {
      if (e.L < 2.5) return;
      var ang = Math.atan2(-e.dz, e.dx), mx = (e.A[0] + e.B[0]) / 2, mz = (e.A[1] + e.B[1]) / 2;
      if (cls !== 'nyu') {
        // crown cornice: projecting box + frieze band
        var proj = cls === 'row' ? 0.38 : cls === 'brick' ? 0.32 : 0.45;
        bld.box(e.L + proj * 1.6, 0.32, proj, color, { x: mx + e.nx * proj / 2, y: h + 0.35, z: mz + e.nz * proj / 2, ry: ang });
        if (cls === 'row' || cls === 'lime') bld.box(e.L + 0.1, 0.55, 0.14, color, { x: mx + e.nx * 0.07, y: h - 0.35, z: mz + e.nz * 0.07, ry: ang });
      } else {
        bld.box(e.L, 0.5, 0.25, 0x5c2a21, { x: mx + e.nx * 0.12, y: h, z: mz + e.nz * 0.12, ry: ang });
      }
      if ((cls === 'lime' || cls === 'brown' || cls === 'judson') && h > 10) // belt course above the ground floor
        bld.box(e.L, 0.35, 0.22, color, { x: mx + e.nx * 0.11, y: info.floor - 0.2, z: mz + e.nz * 0.11, ry: ang });
      // The Row: stoops and Greek Revival door surrounds on the park-facing side
      if (cls === 'row' && e.nz > 0.8 && e.L > 4) {
        var n = Math.max(1, Math.round(e.L / 7.6));
        for (var s = 0; s < n; s++) {
          var t = (s + 0.5) / n - 0.5, sx = mx + e.dx * t * e.L, sz = mz + e.dz * t * e.L;
          // offset toward one side of the house bay (door at side, like the real Row)
          sx += e.dx * 1.6; sz += e.dz * 1.6;
          for (var k = 0; k < 5; k++) { // steps descending to the sidewalk
            var d = 0.45 + k * 0.5;
            bld.box(1.9, 1.75 - k * 0.35, 0.5, 0xd8d2c4, { x: sx + e.nx * d, y: 0, z: sz + e.nz * d, ry: ang });
          }
          bld.box(2.6, 0.12, 1.6, 0xe4ded0, { x: sx + e.nx * 0.8, y: 1.75, z: sz + e.nz * 0.8, ry: ang }); // landing
          // iron railings both sides (black)
          [-1, 1].forEach(function (side) {
            var rx = sx + e.dx * side * 1.0, rz = sz + e.dz * side * 1.0;
            bld.rod([rx + e.nx * 0.2, 2.75, rz + e.nz * 0.2], [rx + e.nx * 2.9, 1.0, rz + e.nz * 2.9], 0.035, 3, 0x151515);
            bld.rod([rx + e.nx * 2.9, 0, rz + e.nz * 2.9], [rx + e.nx * 2.9, 1.0, rz + e.nz * 2.9], 0.04, 3, 0x151515);
            // door surround pilasters
            bld.box(0.35, 3.0, 0.22, 0xf2eee4, { x: sx + e.dx * side * 0.95 + e.nx * 0.1, y: 1.8, z: sz + e.dz * side * 0.95 + e.nz * 0.1, ry: ang });
          });
          bld.box(2.5, 0.5, 0.3, 0xf2eee4, { x: sx + e.nx * 0.14, y: 4.8, z: sz + e.nz * 0.14, ry: ang }); // entablature
          bld.box(1.3, 2.6, 0.06, 0x2a1a12, { x: sx + e.nx * 0.03, y: 1.85, z: sz + e.nz * 0.03, ry: ang }); // door
          // areaway railing along the sidewalk
          bld.box(e.L / n - 2.6, 0.05, 0.05, 0x141414, { x: sx - e.dx * 2.9 + e.nx * 2.2, y: 0.95, z: sz - e.dz * 2.9 + e.nz * 2.2, ry: ang });
        }
      }
    });
  }

  // -------------------------------------------------------------- rooftop clutter (instanced)
  function waterTowerGeom() {
    var bld = U.builder(), wood = 0x6b4a32;
    var legs = [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]];
    legs.forEach(function (l) { bld.box(0.18, 3.2, 0.18, 0x2c2a28, { x: l[0], z: l[1] }); });
    bld.rod([-1.4, 0.4, -1.4], [1.4, 2.8, 1.4], 0.05, 4, 0x2c2a28);
    bld.rod([1.4, 0.4, -1.4], [-1.4, 2.8, 1.4], 0.05, 4, 0x2c2a28);
    bld.box(3.6, 0.2, 3.6, 0x3a3632, { y: 3.2 });
    bld.cyl(2.0, 1.9, 4.2, 14, wood, { y: 3.4 });
    for (var i = 0; i < 4; i++) bld.cyl(2.03, 2.03, 0.08, 14, 0x2a2622, { y: 3.8 + i * 1.0 });
    bld.cone(2.15, 1.5, 14, 0x4a3a2c, { y: 7.6 });
    bld.cyl(0.08, 0.08, 0.4, 4, 0x2a2622, { y: 9.0 });
    return bld.build();
  }
  function hvacGeom() {
    var bld = U.builder();
    bld.box(1, 1, 1, 0xa8a8a4);
    return bld.build();
  }

  // -------------------------------------------------------------- filler city beyond the GEO radius
  function fillerBlocks(q) {
    var out = [], rnd = U.rng(911), grid = env.ground.cityGrid();
    var avs = grid.av.map(function (a) { return (a.x0 + a.x1) / 2; }).sort(function (a, b) { return a - b; });
    var sts = grid.st.slice().sort(function (a, b) { return a - b; });
    var R0 = 330, R1 = q === 'low' ? 520 : 760;
    for (var i = 0; i < avs.length - 1; i++) for (var j = 0; j < sts.length - 1; j++) {
      var x0 = avs[i] + 9, x1 = avs[i + 1] - 9, z0 = sts[j] + 7, z1 = sts[j + 1] - 7;
      if (x1 - x0 < 8 || z1 - z0 < 8) continue;
      // split block into lots of 8–25 m frontage along x
      for (var x = x0; x < x1 - 4;) {
        var w = Math.min(x1 - x, 8 + rnd() * 18);
        [[z0, Math.min(z1, z0 + (z1 - z0) / 2 - 1)], [Math.max(z0, z0 + (z1 - z0) / 2 + 1), z1]].forEach(function (zz) {
          var cx = x + w / 2, cz = (zz[0] + zz[1]) / 2, d = Math.hypot(cx, cz);
          if (d < R0 || d > R1 || zz[1] - zz[0] < 5) return;
          // keep the Fifth Ave view corridor clear of filler
          var north = cz < -150;
          var hh = 12 + Math.pow(rnd(), 1.5) * (north ? 52 : 34);
          if (north && rnd() < 0.06) hh += 35;
          out.push({ pts: [[x, zz[0]], [x + w, zz[0]], [x + w, zz[1]], [x, zz[1]]], h: Math.round(hh), kind: 'filler', name: null });
        });
        x += w + (rnd() < 0.1 ? 3 : 0);
      }
    }
    return out;
  }

  // -------------------------------------------------------------- material (single, all classes)
  B.material = function (quality) {
    var atlas = U.tex(B.atlas(), { aniso: quality === 'high' ? 8 : 4 });
    var m = U.mat({ map: atlas, color: 0xffffff, vertexColors: true, roughness: 0.85 });
    var std = !!m.isMeshStandardMaterial;
    U.patch(m, {
      key: 'facade' + (std ? 's' : 'l'), see: true,
      vertHead: 'attribute vec4 aB; varying vec4 vB;',
      vertBegin: 'vB = aB;',
      fragHead: 'varying vec4 vB; uniform float uLitFrac;',
      uniforms: { uLitFrac: B.uLitFrac },
      frag: function (f) {
        f = f.replace('#include <map_fragment>', [
          'vec3 sqWin = vec3(0.0); float sqGlass = 0.0; vec4 tx = vec4(1.0);',
          '{ vec4 sqB = vec4(floor(vB.xyz + 0.5), vB.w); // snap: interpolated varyings are not bit-exact',
          '  vec2 sqG = vMapUv / vec2(sqB.z > 1.5 && sqB.z < 2.5 ? 3.4 : 2.6, sqB.w); vec2 sqC = floor(sqG); vec2 sqF = fract(sqG);',
          '  float sqUp = step(0.5, sqC.y); bool sqAttic = sqC.y >= sqB.y - 0.001;',
          '  if (sqAttic) { sqF.y = 0.03 + sqF.y * 0.12; sqUp = 1.0; }',
          '  if (sqB.z < -0.5) {',
          '    float wx = step(0.24, sqF.x) * step(sqF.x, 0.76) * step(0.28, sqF.y) * step(sqF.y, 0.86) * (sqAttic ? 0.0 : 1.0);',
          '    float sqAA = clamp(1.6 - max(fwidth(sqG.x), fwidth(sqG.y)) * 2.2, 0.0, 1.0);',
          '    wx = mix(sqAttic ? 0.0 : 0.3, wx, sqAA);',
          '    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.42, 0.47, 0.54), wx); sqGlass = wx;',
          '  } else {',
          '    float base = floor(sqHash(vec2(sqB.x, 3.1)) * 4.0);',
          '    float sqV = sqUp > 0.5 ? (sqHash(sqC + sqB.x) < 0.22 ? floor(sqHash(sqC * 1.7 + sqB.x) * 4.0) : base) : floor(sqHash(vec2(sqC.x, sqB.x)) * 4.0);',
          '    float bx = mod(sqB.z, 2.0), by = floor(sqB.z / 2.0);',
          '    vec2 auv = vec2((bx * 4.0 + sqV + sqF.x) * 0.125, 1.0 - (by * 2.0 + sqUp * 0.0 + (1.0 - sqUp) + (1.0 - sqF.y)) * 0.125);',
          '    vec2 gx = dFdx(sqG) * vec2(0.125, -0.125), gy = dFdy(sqG) * vec2(0.125, -0.125);',
          '    tx = textureGrad(map, auv, gx, gy);',
          '    diffuseColor.rgb *= tx.rgb; sqGlass = sqAttic ? 0.0 : 1.0 - smoothstep(0.62, 0.86, tx.a);',
          '  }',
          '  if (sqGlass > 0.01) {',
          '    vec2 wc = sqC + vec2(sqB.x * 0.013, 0.0);',
          '    float h1 = sqHash(wc * 1.37 + 0.11);',
          '    float lit = step(h1, uLitFrac) * (sqC.y < 0.5 ? 1.6 : 1.0);',
          '    float tone = sqHash(wc * 2.91 + 5.3);',
          '    vec3 lc = tone < 0.65 ? vec3(1.0, 0.62, 0.30) : tone < 0.9 ? vec3(1.0, 0.78, 0.52) : vec3(0.62, 0.74, 0.95);',
          '    sqWin = sqGlass * lit * uNight * lc * (0.35 + sqHash(wc * 4.1) * 0.55) * (0.75 + 0.25 * tx.r);',
          '    diffuseColor.rgb *= 1.0 - 0.55 * uNight * sqGlass;',
          '  }',
          '}'
        ].join('\n'));
        f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += sqWin;');
        if (std) f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.18, sqGlass);');
        return f;
      }
    });
    return m;
  };
  B.uLitFrac = { value: 0.32 };

  // -------------------------------------------------------------- build
  B.build = function (ctx) {
    var q = ctx.quality, group = new THREE.Group(); group.name = 'buildings';
    var mat = B.material(q);
    var gravel = U.tex(SQ.tex.noise(128, 6, 33, 90, 200, 2), { repeat: true });
    var roofMat = U.mat({ map: gravel, vertexColors: true, roughness: 1 });
    U.patch(roofMat, { key: 'roof', see: true });
    var trimMat = U.mat({ vertexColors: true, roughness: 0.8 });
    U.patch(trimMat, { key: 'trim', see: true });

    var nearW = [new Acc(), new Acc(), new Acc(), new Acc()], nearR = new Acc(), farW = [new Acc(), new Acc()], farR = new Acc();
    var trim = U.builder(), towers = [], hvac = [], list = [], rnd = U.rng(77);
    var lowCull = q === 'low' ? 80 : Infinity;
    GEO.buildings.forEach(function (b) {
      if (SKIP_KINDS[b.kind]) return;
      var c = U.polyCentroid(b.pts), d = U.distToPark(c[0], c[1]);
      if (d > lowCull) return;
      var cls = B.classify(b), far = d > 140;
      var quad = (c[0] < 0 ? 0 : 1) + (c[1] < 0 ? 0 : 2);
      var tint = far ? new THREE.Color(SQ.tex.FACADE[cls].flat).toArray() : null;
      addBuilding(far ? farW[quad % 2] : nearW[quad], far ? farR : nearR, b, cls, far, tint);
      if (!far || q === 'high') addTrim(trim, b, cls);
      list.push({ b: b, cls: cls, c: c, far: far });
      // roof clutter
      var bb = U.polyBBox(b.pts), span = Math.min(bb[1] - bb[0], bb[3] - bb[2]);
      if (b.h > 25 && span > 8 && U.hash2(c[0] * 1.3, c[1]) < 0.17 && U.pointInPoly(c[0], c[1], b.pts)) towers.push([c[0] + (rnd() - 0.5) * span * 0.3, b.h, c[1] + (rnd() - 0.5) * span * 0.3, rnd() * 6]);
      if (b.h > 8 && span > 6) {
        var n = 1 + Math.floor(rnd() * Math.min(q === 'high' ? 4 : 2, span / 8));
        for (var i = 0; i < n; i++) {
          var hx = bb[0] + 2 + rnd() * (bb[1] - bb[0] - 4), hz = bb[2] + 2 + rnd() * (bb[3] - bb[2] - 4);
          if (U.pointInPoly(hx, hz, b.pts)) hvac.push([hx, b.h, hz, 1 + rnd() * 2.5, 0.8 + rnd() * 1.6, 1 + rnd() * 2.5, rnd() * 3]);
        }
      }
    });
    // filler city
    if (q !== 'low') fillerBlocks(q).forEach(function (b) {
      var c = U.polyCentroid(b.pts);
      var hh = U.hash2(c[0], c[1]);
      var cls = b.h > 60 && hh < 0.25 ? 'glass' : b.h > 30 ? (hh < 0.55 ? 'lime' : 'brick') : (U.hash2(c[1], c[0]) < 0.6 ? 'brick' : 'brown');
      var tint = new THREE.Color(SQ.tex.FACADE[cls].flat).offsetHSL((U.hash2(c[0], 7) - 0.5) * 0.03, 0, (U.hash2(c[0], 3) - 0.3) * 0.14).toArray();
      addBuilding(farW[c[0] < 0 ? 0 : 1], farR, b, cls, true, tint);
    });

    var meshes = [];
    function addMesh(acc, m, name, cast) {
      if (!acc.p.length) return;
      var mesh = new THREE.Mesh(acc.geometry(), m);
      mesh.name = name; mesh.castShadow = cast && q !== 'low'; mesh.receiveShadow = q !== 'low';
      group.add(mesh); meshes.push(mesh);
    }
    nearW.forEach(function (a, i) { addMesh(a, mat, 'bldNear' + i, true); });
    farW.forEach(function (a, i) { addMesh(a, mat, 'bldFar' + i, false); });
    addMesh(nearR, roofMat, 'roofsNear', true);
    addMesh(farR, roofMat, 'roofsFar', false);
    if (trim.count()) {
      var tm = new THREE.Mesh(trim.build(), trimMat); tm.name = 'buildingTrim'; tm.castShadow = q === 'high'; tm.receiveShadow = q !== 'low';
      group.add(tm); meshes.push(tm);
    }
    // instanced rooftop clutter
    var dummy = new THREE.Object3D(), clutterMat = U.mat({ vertexColors: true, roughness: 0.9 });
    U.patch(clutterMat, { key: 'clutter', see: true });
    if (towers.length) {
      var wt = new THREE.InstancedMesh(waterTowerGeom(), clutterMat, towers.length);
      towers.forEach(function (t, i) { dummy.position.set(t[0], t[1], t[2]); dummy.rotation.set(0, t[3], 0); dummy.scale.setScalar(0.85 + U.hash1(i) * 0.35); dummy.updateMatrix(); wt.setMatrixAt(i, dummy.matrix); });
      wt.name = 'waterTowers'; wt.castShadow = q !== 'low'; group.add(wt); meshes.push(wt);
    }
    if (hvac.length) {
      var hv = new THREE.InstancedMesh(hvacGeom(), clutterMat, hvac.length);
      hvac.forEach(function (t, i) { dummy.position.set(t[0], t[1], t[2]); dummy.rotation.set(0, t[6], 0); dummy.scale.set(t[3], t[4], t[5]); dummy.updateMatrix(); hv.setMatrixAt(i, dummy.matrix); });
      hv.name = 'rooftopHVAC'; hv.castShadow = q === 'high'; group.add(hv); meshes.push(hv);
    }
    B.list = list;
    return {
      group: group, meshes: meshes, list: list,
      setLitFraction: function (f) { B.uLitFrac.value = f; },
      dispose: function () {
        meshes.forEach(function (m) { m.geometry.dispose(); });
        [mat, roofMat, trimMat, clutterMat].forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      }
    };
  };
})(window.SQ = window.SQ || {});
