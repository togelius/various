// SQUARE OFF — Render A: instanced props. 417 GEO trees (London planes, American elms, street trees),
// 399 World's-Fair benches oriented to the nearest path, 147 lamps with night globes / glow sprites /
// light pools (lit in a wave outward from the Arch), trash baskets, drinking fountains, Citi Bike docks,
// parked and moving cars, the NY Dosas cart and the Mutual Aid table.
(function (SQ) {
  'use strict';
  var env = SQ.env = SQ.env || {};
  var U = env.util = env.util || {};
  var P = env.props = env.props || {};
  env.layout = env.layout || {};

  var LAMP_UNI = null;
  function lampUni() { return LAMP_UNI || (LAMP_UNI = { uLampWave: env.U.uLampWave, uNight: env.U.uNight, uScale: { value: 800 }, uTime: env.U.uTime }); }

  // ------------------------------------------------------------ layout helpers
  var pathSegs = null;
  function segs() {
    if (pathSegs) return pathSegs;
    pathSegs = [];
    GEO.paths.forEach(function (p) { if (p.area) return; for (var i = 1; i < p.pts.length; i++) pathSegs.push([p.pts[i - 1][0], p.pts[i - 1][1], p.pts[i][0], p.pts[i][1]]); });
    return pathSegs;
  }
  function nearestOnPaths(x, z) {
    var best = null, S = segs();
    for (var i = 0; i < S.length; i++) {
      var s = S[i], r = U.segDist2(x, z, s[0], s[1], s[2], s[3]);
      if (!best || r.d2 < best.d2) best = r;
    }
    return best;
  }
  env.layout.benches = function () {
    if (P._benches) return P._benches;
    P._benches = (GEO.benches || []).map(function (b) {
      var n = nearestOnPaths(b[0], b[1]), fx = n ? n.x - b[0] : 0, fz = n ? n.z - b[1] : 1;
      if (Math.hypot(fx, fz) < 0.05) { fx = 0; fz = 1; }
      return { x: b[0], z: b[1], ry: Math.atan2(fx, fz) };
    });
    return P._benches;
  };

  // ------------------------------------------------------------ trees
  function displace(g, amt, seed) {
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (U.hash2(x * 2.1 + seed, z * 1.7 + y * 3.3) - 0.5) * amt;
      p.setXYZ(i, x * n, y * n, z * n);
    }
    return g;
  }
  // crown: lumpy icospheres with spherical normals and a height gradient in vertex colour
  function crownGeom(blobs, detail, col, top) {
    var parts = [], cTop = new THREE.Color(top), cBot = new THREE.Color(col);
    blobs.forEach(function (bl, i) {
      var g = displace(new THREE.IcosahedronGeometry(bl[3], detail), 0.32, i * 7.1);
      g.scale(1, bl[4] || 0.8, 1);
      g.translate(bl[0], bl[1], bl[2]);
      parts.push(g);
    });
    var g = U.merge(parts);
    // spherical normals from the crown centroid for soft foliage lighting; vertex colour gradient
    var p = g.attributes.position, n = g.attributes.normal, cy = 0, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < p.count; i++) { var y = p.getY(i); cy += y; minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    cy /= p.count;
    var col3 = new Float32Array(p.count * 3), v = new THREE.Vector3(), tmp = new THREE.Color();
    for (var j = 0; j < p.count; j++) {
      v.set(p.getX(j), (p.getY(j) - cy) * 1.2, p.getZ(j)).normalize();
      var nx = n.getX(j) * 0.35 + v.x * 0.65, ny = n.getY(j) * 0.35 + v.y * 0.65, nz = n.getZ(j) * 0.35 + v.z * 0.65, l = Math.hypot(nx, ny, nz) || 1;
      n.setXYZ(j, nx / l, ny / l, nz / l);
      var t = (p.getY(j) - minY) / Math.max(0.01, maxY - minY);
      tmp.copy(cBot).lerp(cTop, Math.pow(t, 0.8));
      var ao = 0.65 + 0.35 * Math.min(1, t * 1.6);
      col3[j * 3] = tmp.r * ao; col3[j * 3 + 1] = tmp.g * ao; col3[j * 3 + 2] = tmp.b * ao;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col3, 3));
    var uv = g.attributes.uv; for (var u = 0; u < uv.count; u++) uv.setXY(u, uv.getX(u) * 2.0, uv.getY(u) * 1.5);
    return g;
  }
  function trunkGeom(kind, q) {
    var seg = q === 'high' ? 7 : 5, lo = q !== 'high';
    var b = U.builder(), bark = 0xc8c2a8;
    if (kind === 'elm') {
      b.cyl(0.42, 0.3, 3.4, seg, 0x8d8478);
      [[2.4, 9.5, 0.6], [-2.2, 9.8, -0.9], [0.4, 10.6, 2.3], [-0.6, 10.2, -2.4]].slice(0, lo ? 3 : 4).forEach(function (t) { b.rod([0, 3.0, 0], t, 0.2, lo ? 4 : 5, 0x857c70); });
    } else {
      b.cyl(0.38, 0.26, 5.6, seg, bark);
      [[1.9, 8.6, 0.8], [-1.7, 8.9, -1.0], [0.3, 10.2, 0.2]].slice(0, lo ? 2 : 3).forEach(function (t) { b.rod([0, 4.6, 0], t, 0.15, lo ? 4 : 5, bark); });
    }
    if (!lo) b.cyl(0.6, 0.38, 0.35, seg, 0x6f6658); // root flare
    return b.build();
  }
  function buildTrees(q, group, out) {
    var detail = 1;
    var nCrowns = q === 'high' ? 5 : q === 'med' ? 2 : 1;
    var planeBlobs = [[0, 10.6, 0, 4.0, 0.8], [2.6, 9.4, 1.3, 3.2, 0.85], [-2.4, 9.8, -1.4, 3.3, 0.8], [-1.0, 11.4, 2.4, 2.8, 0.8], [1.8, 11.2, -2.2, 2.8, 0.8]].slice(0, nCrowns);
    var elmBlobs = [[0, 12.0, 0, 4.6, 0.55], [2.9, 11.0, 1.5, 3.4, 0.6], [-2.9, 11.2, -1.5, 3.4, 0.6], [-1.4, 12.3, 2.8, 3.0, 0.55], [1.6, 12.4, -2.8, 3.0, 0.55]].slice(0, nCrowns);
    if (nCrowns === 2) { planeBlobs[0][3] = 4.4; planeBlobs[1] = [-0.5, 9.2, 0.6, 3.6, 0.85]; elmBlobs[0][3] = 5.2; }
    if (nCrowns === 1) { planeBlobs[0][3] = 5.0; elmBlobs[0][3] = 5.8; }
    var hero = env.landmarks && env.landmarks.HERO_ELM, park = (GEO.areas.filter(function (a) { return a.name === 'Washington Square Park'; })[0] || {}).pts;
    var sets = { plane: [], elm: [], street: [] }, heroSkipped = false;
    GEO.trees.forEach(function (t) {
      var x = t[0], z = t[1];
      if (hero && !heroSkipped && Math.hypot(x - hero.x, z - hero.z) < 6) { heroSkipped = true; return; }
      var h = U.hash2(x * 0.71, z * 1.37), inPark = park && U.pointInPoly(x, z, park);
      if (!inPark) sets.street.push(t);
      else if (h < 0.3 || (x < -110 && z < -30 && h < 0.6)) sets.elm.push(t);
      else sets.plane.push(t);
    });
    var leafTex = U.tex(SQ.tex.leaves(), { repeat: true }), barkTex = U.tex(SQ.tex.bark(), { repeat: true });
    var alphaCrowns = q === 'high';
    var crownMat = U.mat(alphaCrowns ? { map: leafTex, vertexColors: true, roughness: 0.95, alphaTest: 0.42, side: THREE.DoubleSide } : { map: leafTex, vertexColors: true, roughness: 0.95 });
    U.patch(crownMat, { key: 'crown' + (alphaCrowns ? 'a' : ''), canopy: true, wind: 1.0 });
    var crownDepth = alphaCrowns ? new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: 0.42 }) : null;
    var trunkMat = U.mat({ map: barkTex, vertexColors: true, roughness: 1 });
    U.patch(trunkMat, { key: 'trunk', wind: 0.25 });
    var crowns = {
      plane: crownGeom(planeBlobs, detail, 0x34502a, 0x83a052),
      elm: crownGeom(elmBlobs, detail, 0x2e4a26, 0x6f9046),
      street: crownGeom(planeBlobs.slice(0, Math.max(1, nCrowns - 2)), detail, 0x3c5a2c, 0x8fae5c)
    };
    var trunks = { plane: trunkGeom('plane', q), elm: trunkGeom('elm', q), street: trunkGeom('plane', q) };
    var d = new THREE.Object3D(), col = new THREE.Color(), castTrees = q === 'high';
    Object.keys(sets).forEach(function (k) {
      var list = sets[k]; if (!list.length) return;
      var cm = new THREE.InstancedMesh(crowns[k], crownMat, list.length), tm = new THREE.InstancedMesh(trunks[k], trunkMat, list.length);
      list.forEach(function (t, i) {
        var h1 = U.hash2(t[0], t[1]), h2 = U.hash2(t[1] * 1.3, t[0] * 0.7);
        var s = k === 'street' ? 0.55 + h1 * 0.25 : k === 'elm' ? 0.95 + h1 * 0.5 : 0.75 + h1 * 0.55; // ≈ 9–17 m crowns
        d.position.set(t[0], 0, t[1]); d.rotation.set(0, h2 * Math.PI * 2, 0); d.scale.set(s * (0.9 + h2 * 0.2), s, s * (0.9 + h1 * 0.2)); d.updateMatrix();
        cm.setMatrixAt(i, d.matrix); tm.setMatrixAt(i, d.matrix);
        col.setHSL(0.2 + h2 * 0.07, 0.22 + h1 * 0.2, 0.5 + (h1 - 0.5) * 0.14);
        cm.setColorAt(i, col.multiplyScalar(alphaCrowns ? 2.35 : 2.6));
      });
      if (crownDepth) cm.customDepthMaterial = crownDepth;
      cm.castShadow = tm.castShadow = castTrees; cm.receiveShadow = tm.receiveShadow = q !== 'low';
      cm.name = 'treeCrowns_' + k; tm.name = 'treeTrunks_' + k;
      group.add(cm, tm); out.push(cm, tm);
    });
    out.textures = (out.textures || []).concat([leafTex, barkTex]);
    return sets;
  }

  // ------------------------------------------------------------ benches
  function benchGeom(q) {
    // NYC Parks "World's Fair" bench: green slats on black cast-iron standards (≈100 tris)
    var b = U.builder(), slat = 0x35603f, iron = 0x1a1c1a, L = 1.9;
    b.box(L, 0.05, 0.44, slat, { y: 0.42, z: 0.05 });
    b.box(L, 0.24, 0.035, slat, { y: 0.56, z: -0.2, rx: -0.2 });
    if (q === 'high') b.box(L, 0.1, 0.035, slat, { y: 0.84, z: -0.26, rx: -0.2 });
    (q !== 'high' ? [-0.85, 0.85] : [-0.85, 0, 0.85]).forEach(function (x) {
      b.box(0.05, 0.44, 0.05, iron, { x: x, z: 0.24 });
      b.box(0.05, 0.92, 0.05, iron, { x: x, z: -0.2, rx: -0.2 });
    });
    return b.build();
  }

  // ------------------------------------------------------------ lamps
  function lampGeom() {
    var b = U.builder(), iron = 0x1c221e;
    b.cyl(0.22, 0.14, 0.85, 8, iron);                    // fluted base
    b.cyl(0.075, 0.055, 3.05, 6, iron, { y: 0.85 });     // shaft
    b.cyl(0.12, 0.09, 0.2, 6, iron, { y: 3.9 });         // collar / globe holder
    return b.build();
  }
  var GLOBE_Y = 4.38;

  // ------------------------------------------------------------ cars
  function carGeom() {
    var b = U.builder(), glass = 0x222a30, tire = 0x161616;
    b.box(4.5, 0.62, 1.78, 0xffffff, { y: 0.3 });
    b.box(2.5, 0.12, 1.7, 0xffffff, { y: 0.92, x: -0.2 });
    b.box(2.3, 0.5, 1.56, glass, { y: 1.0, x: -0.25 });
    b.box(2.0, 0.08, 1.5, 0xffffff, { y: 1.5, x: -0.3 });
    [[1.45, 0.82], [1.45, -0.82], [-1.45, 0.82], [-1.45, -0.82]].forEach(function (w) {
      var g = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10); g.rotateX(Math.PI / 2); b.add(g, tire, { x: w[0], y: 0.33, z: w[1] });
    });
    // headlights (vertex colour > 1 → emissive at night) and taillights
    b.box(0.05, 0.12, 0.3, 0xffffff, { x: 2.26, y: 0.66, z: 0.6, sx: 1 }); b.box(0.05, 0.12, 0.3, 0xffffff, { x: 2.26, y: 0.66, z: -0.6 });
    b.box(0.05, 0.12, 0.3, 0xff2020, { x: -2.26, y: 0.68, z: 0.62 }); b.box(0.05, 0.12, 0.3, 0xff2020, { x: -2.26, y: 0.68, z: -0.62 });
    var g2 = b.build(), c = g2.attributes.color, p = g2.attributes.position;
    for (var i = 0; i < c.count; i++) {
      var x = p.getX(i);
      if (x > 2.2 && p.getY(i) > 0.55 && p.getY(i) < 0.8 && Math.abs(p.getZ(i)) > 0.4) c.setXYZ(i, 3.0, 2.8, 2.4);
      if (x < -2.2 && p.getY(i) > 0.58 && p.getY(i) < 0.82 && Math.abs(p.getZ(i)) > 0.42) c.setXYZ(i, 2.6, 0.25, 0.2);
    }
    return g2;
  }
  function polyAt(pts, cum, d) {
    var i = 1; while (i < pts.length - 1 && cum[i] < d) i++;
    var a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1], t = seg > 0 ? U.clamp((d - cum[i - 1]) / seg, 0, 1) : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function cumLen(pts) { var c = [0]; for (var i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }

  function buildCars(q, group, out, ctx) {
    var G = env.ground, ints = G.intersections(), rnd = U.rng(606), parked = [];
    var maxParked = q === 'high' ? 70 : q === 'med' ? 45 : 24;
    var cands = [];
    (GEO.roads || []).forEach(function (r) {
      if (r.name === 'Washington Mews' || r.name === '5th Avenue') return;
      var w = G.roadWidth(r), L = U.polyLen(r.pts), off = w / 2 - 1.15;
      for (var dd = 4; dd < L - 4; dd += 6.1) {
        var p = G.along(r.pts, dd);
        if (Math.abs(p.x) > 240 || Math.abs(p.z) > 165) continue;
        if (ints.some(function (n) { return Math.hypot(n.x - p.x, n.z - p.z) < 14; })) continue;
        [-1, 1].forEach(function (s) {
          if (rnd() < 0.28) return;
          cands.push({ x: p.x - p.dz * off * s, z: p.z + p.dx * off * s, ry: Math.atan2(-p.dz, p.dx) + (s > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 0.04, d: Math.hypot(p.x, p.z) });
        });
      }
    });
    cands.sort(function (a, b) { return a.d - b.d; });
    parked = cands.slice(0, maxParked);
    // moving traffic (High only): counter-clockwise park loop and Fifth Ave southbound
    var routes = [];
    if (q === 'high') {
      var loop = [[-165, 78], [-60, 78], [60, 78], [138, 77], [139, 0], [140, -76], [60, -76.5], [-2, -77], [-80, -77], [-165, -77], [-165, 0], [-165, 78]];
      var fifth = [[-19, -332], [-14, -260], [-8, -183], [-5, -133], [-3, -98], [-2, -77], [-80, -77], [-165, -77], [-165, 0], [-165, 78], [-165, 160]];
      routes.push({ pts: loop, loop: true, n: 9, v: 7.5 }, { pts: fifth, loop: false, n: 6, v: 8.5 });
      routes.forEach(function (r) { r.cum = cumLen(r.pts); r.L = r.cum[r.cum.length - 1]; });
    }
    var nMove = routes.reduce(function (s, r) { return s + r.n; }, 0);
    var mat = U.mat({ vertexColors: true, roughness: 0.35, metalness: 0.3 });
    U.patch(mat, { key: 'car', frag: function (f) { return f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance += max(vColor.rgb - 1.0, 0.0) * uNight * 1.5;\n#endif'); } });
    var mesh = new THREE.InstancedMesh(carGeom(), mat, parked.length + nMove), d = new THREE.Object3D(), col = new THREE.Color();
    var paints = [0x1a1a1a, 0xf2f2f2, 0x9aa0a6, 0x24364f, 0x7a1d1d, 0x2f4a3a, 0xc9b38a, 0x5a5f66];
    function paint(i, h) { col.set(h < 0.18 ? 0xf3c623 : paints[Math.floor(h * 97) % paints.length]); mesh.setColorAt(i, col); }
    parked.forEach(function (c, i) { d.position.set(c.x, 0, c.z); d.rotation.set(0, c.ry, 0); d.scale.set(0.92 + rnd() * 0.16, 1, 1); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); paint(i, rnd()); });
    var movers = [];
    routes.forEach(function (r) { for (var k = 0; k < r.n; k++) { var idx = parked.length + movers.length; movers.push({ r: r, d: r.L * k / r.n, i: idx }); paint(idx, rnd()); } });
    mesh.castShadow = q === 'high'; mesh.receiveShadow = q !== 'low'; mesh.name = 'cars';
    group.add(mesh); out.push(mesh);
    var yawCache = {};
    function updateMovers(dt) {
      if (!movers.length) return;
      movers.forEach(function (m) {
        m.d += m.r.v * dt;
        if (m.d > m.r.L) m.d = m.r.loop ? m.d - m.r.L : 0;
        var p = polyAt(m.r.pts, m.r.cum, m.d), ahead = polyAt(m.r.pts, m.r.cum, Math.min(m.r.L, m.d + 3.5));
        if (m.r.loop && m.d + 3.5 > m.r.L) ahead = polyAt(m.r.pts, m.r.cum, m.d + 3.5 - m.r.L);
        var yaw = Math.atan2(-(ahead[1] - p[1]), ahead[0] - p[0]), prev = yawCache[m.i];
        if (prev !== undefined) { var dy = Math.atan2(Math.sin(yaw - prev), Math.cos(yaw - prev)); yaw = prev + dy * Math.min(1, dt * 5); }
        yawCache[m.i] = yaw;
        d.position.set(p[0], 0, p[1]); d.rotation.set(0, yaw, 0); d.scale.set(1, 1, 1); d.updateMatrix();
        mesh.setMatrixAt(m.i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    updateMovers(0.01);
    return { update: updateMovers, mesh: mesh };
  }

  // ------------------------------------------------------------ build
  P.build = function (ctx) {
    var q = ctx.quality, group = new THREE.Group(); group.name = 'props';
    var out = [], d = new THREE.Object3D();
    var trees = buildTrees(q, group, out);
    var vcMat = U.patch(U.mat({ vertexColors: true, roughness: 0.8 }), { key: 'propvc' });

    // benches
    var benches = env.layout.benches();
    var bm = new THREE.InstancedMesh(benchGeom(q), vcMat, benches.length);
    benches.forEach(function (b, i) { d.position.set(b.x, 0, b.z); d.rotation.set(0, b.ry, 0); d.scale.set(1, 1, 1); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); });
    bm.castShadow = q === 'high'; bm.receiveShadow = q !== 'low'; bm.name = 'benches';
    group.add(bm); out.push(bm);

    // lamps: posts, globes, glow sprites, ground light pools
    var lamps = GEO.lamps || [], ax = 0.75, az = -54;
    var dists = new Float32Array(lamps.length);
    lamps.forEach(function (l, i) { dists[i] = Math.hypot(l[0] - ax, l[1] - az); });
    var lm = new THREE.InstancedMesh(lampGeom(), vcMat, lamps.length);
    lamps.forEach(function (l, i) { d.position.set(l[0], 0, l[1]); d.rotation.set(0, 0, 0); d.updateMatrix(); lm.setMatrixAt(i, d.matrix); });
    lm.castShadow = q === 'high'; lm.name = 'lampPosts';
    var globeG = new THREE.IcosahedronGeometry(0.27, 1); globeG.scale(1, 1.15, 1);
    globeG.setAttribute('aD', new THREE.InstancedBufferAttribute(dists, 1));
    var globeMat = U.mat({ color: 0xf4efe2, roughness: 0.3 });
    U.patch(globeMat, {
      key: 'globe', vertHead: 'attribute float aD; varying float vOn;', vertBegin: 'vOn = clamp((uLampWave - aD) / 10.0, 0.0, 1.0);',
      fragHead: 'varying float vOn;',
      frag: function (f) { return f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.8, 0.52) * vOn * 3.2;'); }
    });
    var gm = new THREE.InstancedMesh(globeG, globeMat, lamps.length);
    lamps.forEach(function (l, i) { d.position.set(l[0], GLOBE_Y, l[1]); d.updateMatrix(); gm.setMatrixAt(i, d.matrix); });
    gm.name = 'lampGlobes';
    group.add(lm, gm); out.push(lm, gm);
    // glow sprites
    var gp = new Float32Array(lamps.length * 3);
    lamps.forEach(function (l, i) { gp[i * 3] = l[0]; gp[i * 3 + 1] = GLOBE_Y; gp[i * 3 + 2] = l[1]; });
    var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('aD', new THREE.BufferAttribute(dists, 1));
    var LU = lampUni();
    var glowMat = new THREE.ShaderMaterial({
      uniforms: { uLampWave: LU.uLampWave, uNight: LU.uNight, uScale: LU.uScale, uTime: LU.uTime, uTex: { value: U.tex(SQ.tex.glow(64, true), {}) } },
      vertexShader: 'attribute float aD; uniform float uLampWave; uniform float uScale; uniform float uTime; varying float vOn; void main(){ vOn = clamp((uLampWave - aD) / 10.0, 0.0, 1.0) * (0.94 + 0.06 * sin(uTime * 11.0 + aD)); vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(3.2 * uScale / max(-mv.z, 1.0), 1.0, 220.0); }',
      fragmentShader: 'uniform sampler2D uTex; varying float vOn; void main(){ if (vOn <= 0.0) discard; vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * t.a * vOn * 0.9, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var glow = new THREE.Points(gg, glowMat); glow.name = 'lampGlow'; glow.renderOrder = 3;
    glow.onBeforeRender = function (renderer, scene, camera) {
      var v = P._v2 || (P._v2 = new THREE.Vector2()), h = renderer.getDrawingBufferSize(v).y;
      LU.uScale.value = camera.isPerspectiveCamera ? h / (2 * Math.tan(camera.fov * Math.PI / 360)) : h * 0.01;
    };
    // pools
    var poolG = new THREE.PlaneGeometry(15, 15); poolG.rotateX(-Math.PI / 2);
    poolG.setAttribute('aD', new THREE.InstancedBufferAttribute(dists, 1));
    var poolMat = new THREE.ShaderMaterial({
      uniforms: { uLampWave: LU.uLampWave, uNight: LU.uNight, uTex: { value: U.tex(SQ.tex.glow(128, false), {}) } },
      vertexShader: 'attribute float aD; uniform float uLampWave; varying float vOn; varying vec2 vUv; void main(){ vUv = uv; vOn = clamp((uLampWave - aD) / 10.0, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D uTex; uniform float uNight; varying float vOn; varying vec2 vUv; void main(){ float a = texture2D(uTex, vUv).a * vOn * uNight * 0.95; if (a < 0.003) discard; gl_FragColor = vec4(vec3(1.0, 0.66, 0.36) * a, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    var pools = new THREE.InstancedMesh(poolG, poolMat, lamps.length);
    lamps.forEach(function (l, i) { d.position.set(l[0], 0.05, l[1]); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); pools.setMatrixAt(i, d.matrix); });
    pools.name = 'lampPools'; pools.renderOrder = 1; pools.visible = false; glow.visible = false;
    group.add(glow, pools); out.push(glow, pools);

    // trash baskets, drinking fountains
    var baskets = GEO.points.filter(function (p) { return p.kind === 'waste_basket'; });
    var tb = U.builder();
    tb.cyl(0.25, 0.31, 0.85, 8, 0x2c3a30); tb.cyl(0.32, 0.32, 0.06, 8, 0x1a1f1b, { y: 0.84 });
    var bk = new THREE.InstancedMesh(tb.build(), vcMat, Math.max(1, baskets.length));
    baskets.forEach(function (p, i) { d.position.set(p.pos[0], 0, p.pos[1]); d.rotation.set(0, 0, 0); d.updateMatrix(); bk.setMatrixAt(i, d.matrix); });
    bk.count = baskets.length; bk.name = 'trashBaskets'; bk.castShadow = q === 'high';
    var fountains = GEO.points.filter(function (p) { return p.kind === 'drinking_water'; });
    var fb = U.builder();
    fb.box(0.42, 0.85, 0.42, 0x6d6e6c); fb.cyl(0.28, 0.2, 0.12, 12, 0x8c8e8c, { y: 0.85 }); fb.cyl(0.03, 0.03, 0.12, 4, 0xb0b0b0, { y: 0.95 });
    var df = new THREE.InstancedMesh(fb.build(), vcMat, Math.max(1, fountains.length));
    fountains.forEach(function (p, i) { d.position.set(p.pos[0], 0, p.pos[1]); d.updateMatrix(); df.setMatrixAt(i, d.matrix); });
    df.count = fountains.length; df.name = 'drinkingFountains';
    group.add(bk, df); out.push(bk, df);

    // static merged props: Citi Bike docks, NY Dosas cart, Mutual Aid table
    var sb = U.builder();
    GEO.points.filter(function (p) { return p.kind === 'bicycle_rental' && Math.abs(p.pos[0]) < 250 && Math.abs(p.pos[1]) < 170; }).forEach(function (p) {
      // orient along the nearest road
      var best = null;
      GEO.roads.forEach(function (r) { for (var i = 1; i < r.pts.length; i++) { var s = U.segDist2(p.pos[0], p.pos[1], r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]); if (!best || s.d2 < best.d2) { best = s; best.dx = r.pts[i][0] - r.pts[i - 1][0]; best.dz = r.pts[i][1] - r.pts[i - 1][1]; } } });
      var ang = best ? Math.atan2(-best.dz, best.dx) : 0, ca = Math.cos(ang), sa = -Math.sin(ang);
      var m = new THREE.Matrix4().compose(new THREE.Vector3(p.pos[0], 0, p.pos[1]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0)), new THREE.Vector3(1, 1, 1));
      sb.box(0.6, 2.1, 0.5, 0x2a6fb8, { x: -5.6, m: m }); sb.box(0.5, 0.3, 0.06, 0xe8eef4, { x: -5.6, y: 1.6, z: 0.26, m: m });
      sb.box(11, 0.08, 0.4, 0x6a7078, { m: m });
      for (var k = 0; k < 9; k++) {
        var bx = -4.6 + k * 1.15;
        sb.box(0.12, 0.85, 0.12, 0x8a9096, { x: bx, z: -0.6, m: m });
        [-0.55, 0.55].forEach(function (wz) { var w = new THREE.CylinderGeometry(0.34, 0.34, 0.05, 10); w.rotateZ(Math.PI / 2); w.rotateY(Math.PI / 2); sb.add(w, 0x1b1b1b, { x: bx, y: 0.34, z: wz - 0.1, m: m }); });
        sb.rod([bx, 0.34, -0.65], [bx, 0.75, 0.0], 0.04, 4, 0x1f6fd1, { m: m });
        sb.rod([bx, 0.75, 0.0], [bx, 0.34, 0.45], 0.04, 4, 0x1f6fd1, { m: m });
        sb.rod([bx, 0.75, 0.0], [bx, 0.95, -0.45], 0.035, 4, 0x1f6fd1, { m: m });
        sb.box(0.32, 0.18, 0.28, 0x1f6fd1, { x: bx, y: 0.9, z: -0.62, m: m });
        sb.box(0.1, 0.05, 0.22, 0x111111, { x: bx, y: 1.0, z: 0.25, m: m });
      }
    });
    // NY Dosas cart (real GEO position near the SW of the big lawn)
    var dc = new THREE.Matrix4().compose(new THREE.Vector3(-100, 0, 57), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    sb.box(2.6, 1.1, 1.4, 0xc9ccd0, { y: 0.35, m: dc }); sb.box(2.7, 0.08, 1.5, 0x9a9ea2, { y: 1.45, m: dc });
    sb.box(2.2, 0.5, 0.05, 0xe2a23a, { y: 0.7, z: 0.72, m: dc });
    [-1, 1].forEach(function (s) { var w = new THREE.CylinderGeometry(0.33, 0.33, 0.1, 10); w.rotateX(Math.PI / 2); sb.add(w, 0x222222, { x: s * 0.8, y: 0.33, z: 0.72, m: dc }); });
    sb.cyl(0.03, 0.03, 2.2, 4, 0x777777, { y: 1.45, m: dc });
    sb.cone(1.6, 0.6, 8, 0xd8402e, { y: 3.4, m: dc, rx: Math.PI });
    sb.cone(1.6, 0.55, 8, 0xf2c230, { y: 3.3, m: dc });
    // Mutual Aid table
    var ma = new THREE.Matrix4().compose(new THREE.Vector3(-73.76, 0, 7.44), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.3, 0)), new THREE.Vector3(1, 1, 1));
    sb.box(1.8, 0.05, 0.75, 0xe6e2da, { y: 0.74, m: ma });
    [-0.8, 0.8].forEach(function (x) { sb.box(0.05, 0.74, 0.6, 0x9a9a9a, { x: x, m: ma }); });
    [[-0.5, 0x8a6a42], [0.1, 0x5a7ab0], [0.55, 0xd2c2a0]].forEach(function (b) { sb.box(0.45, 0.32, 0.35, b[1], { x: b[0], y: 0.79, m: ma }); });
    sb.box(0.6, 0.9, 0.04, 0xf2efe6, { x: 1.1, y: 0, z: 0.4, m: ma });
    var sm = new THREE.Mesh(sb.build(), vcMat); sm.name = 'streetProps'; sm.castShadow = q === 'high'; sm.receiveShadow = q !== 'low';
    group.add(sm); out.push(sm);

    var cars = buildCars(q, group, out, ctx);

    return {
      group: group, meshes: out, trees: trees,
      update: function (dt) {
        cars.update(dt);
        var on = env.U.uNight.value > 0.05 || env.U.uLampWave.value > 1;
        glow.visible = pools.visible = on;
      },
      dispose: function () {
        group.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); if (o.material.uniforms && o.material.uniforms.uTex) o.material.uniforms.uTex.value.dispose(); o.material.dispose(); } });
        (out.textures || []).forEach(function (t) { t.dispose(); });
      }
    };
  };
})(window.SQ = window.SQ || {});
