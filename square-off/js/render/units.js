// SQUARE OFF — Render B: units and people (DESIGN §11.5).
// Diorama people built from boxes/cylinders/spheres per faction × class (chess hustlers with flat caps
// and lawn chairs, buskers with tambourines/sax/buckets, NYU violet hoodies, dog walkers WITH dogs on
// leashes), one InstancedMesh per type, walk/idle/argue/over-it/sit/cheer animated in the vertex shader
// (no skeletons), an x-ray silhouette pass so units read through trees and buildings, team ground rings
// with contact shadow, and always-readable class glyph billboards (●▲■) with a Composure arc and the
// counter chevron for the current selection. Also: neutrals (squirrels, pigeon flocks, PEP, tourists,
// graduates, piano, ice-cream truck) and ambient civilians walking real park paths / sitting on real benches.
//
// SQ.units API (called by scene.js):
//   init(ctx {scene, renderer, camera, quality, tier, env})  setMatch(m)  update(state, alpha, dt, camera)
//   dispose()  setOptions({colorblind})
//   selectedFocus(state, alpha, outArray, max)   pushes {x,z} of selected units (canopy fade)
//   renderPos(id) -> {x, y, z} | null            last rendered position of a unit id
//   squashAt(x, z, r)                            comic squash of every unit in a ring (capture flip)
//   pigeonsScatter(x, z, r)                      scare pigeons (fx / events)
//   SCALE                                        unit scale factor (people are 1.3× life size)
(function (SQ) {
  'use strict';
  const SCALE = 1.5;          // diorama exaggeration for units (civilians stay life size: contrast)
  const GLYPH_Y = 2.95;       // glyph height above ground (m), before scale tweaks
  const ANIM = { IDLE: 0, WALK: 1, ATTACK: 2, OVERIT: 3, SIT: 4, FLINCH: 5, CHEER: 6 };

  // ================================================================== geometry builder
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const _col = new THREE.Color();

  function Builder() { this.parts = []; }
  // o: {c: color, p: part id, pv: [pivotY, pivotZ, pivotX], m: tint mask, at: [x,y,z], rot: [x,y,z], sc: [x,y,z]}
  Builder.prototype.add = function (geo, o) {
    o = o || {};
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (geo.index) geo.dispose();
    g.deleteAttribute('uv');
    const at = o.at || [0, 0, 0], rot = o.rot || [0, 0, 0], sc = o.sc || [1, 1, 1];
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _m4.compose(_p.set(at[0], at[1], at[2]), _q, _s.set(sc[0], sc[1], sc[2]));
    g.applyMatrix4(_m4);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3), part = new Float32Array(n * 4), mask = new Float32Array(n);
    _col.set(o.c !== undefined ? o.c : 0xffffff);
    if (!o.raw) _col.convertSRGBToLinear();
    const pv = o.pv || [0, 0, 0];
    for (let i = 0; i < n; i++) {
      col[i * 3] = _col.r; col[i * 3 + 1] = _col.g; col[i * 3 + 2] = _col.b;
      part[i * 4] = o.p || 0; part[i * 4 + 1] = pv[0]; part[i * 4 + 2] = pv[1] || 0; part[i * 4 + 3] = pv[2] || 0;
      mask[i] = o.m || 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 4));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 1));
    this.parts.push(g);
    return this;
  };
  Builder.prototype.box = function (w, h, d, o) { return this.add(new THREE.BoxGeometry(w, h, d), o); };
  Builder.prototype.cyl = function (rt, rb, h, seg, o) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg || 6, 1), o); };
  Builder.prototype.ball = function (r, o, ws, hs) { return this.add(new THREE.SphereGeometry(r, ws || 8, hs || 6), o); };
  Builder.prototype.cap = function (r, o, ws) { return this.add(new THREE.SphereGeometry(r, ws || 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), o); };
  Builder.prototype.cone = function (r, h, seg, o) { return this.add(new THREE.ConeGeometry(r, h, seg || 6), o); };
  Builder.prototype.torus = function (r, t, o) { return this.add(new THREE.TorusGeometry(r, t, 4, 10), o); };
  // A thin box from a to b (leashes, sticks, chair tubes).
  Builder.prototype.rod = function (a, b, th, o) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz) || 0.001;
    const g = new THREE.BoxGeometry(th, L, th);
    const dir = new THREE.Vector3(dx / L, dy / L, dz / L);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    return this.add(g, Object.assign({}, o, { at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [e.x, e.y, e.z] }));
  };
  Builder.prototype.build = function () {
    let total = 0;
    for (const g of this.parts) total += g.attributes.position.count;
    const out = new THREE.BufferGeometry();
    const names = ['position', 'normal', 'color', 'aPart', 'aMask'];
    for (const nm of names) {
      const size = this.parts[0].attributes[nm].itemSize;
      const arr = new Float32Array(total * size);
      let off = 0;
      for (const g of this.parts) { arr.set(g.attributes[nm].array, off); off += g.attributes[nm].array.length; }
      out.setAttribute(nm, new THREE.BufferAttribute(arr, size));
    }
    for (const g of this.parts) g.dispose();
    this.parts = [];
    out.computeBoundingSphere();
    out.boundingSphere.radius += 3;
    return out;
  };

  // Parts: 0 static, 1/2 legs, 3/4 arms (L/R), 5 head, 6 dog body, 7/9 dog legs (diagonal pairs),
  // 8 tail (wag), 10/11 wings (flap), 12 sticks (drummer: follow right arm).
  const SKIN = [0xe8b896, 0xc68a62, 0x8d5a3b, 0xf1c9a5, 0xa86f4c, 0x6b4430];
  const HAIR = [0x2a1d14, 0x4a3020, 0x111111, 0x8a6a3a, 0xb9b2a6, 0x6b3b1e];

  // Generic diorama person (1.75 m, facing +z). o: {w, skin, shirt, pants, shoes, sleeves, hair, hat, hatC,
  // beard, hood, shorts, long}. Returns hand positions for props.
  function person(b, o) {
    const w = o.w || 1;
    const skin = o.skin, shirt = o.shirt, pants = o.pants, shoes = o.shoes || 0x2b2622;
    const sm = o.shirtMask || 0, pm = o.pantsMask || 0;
    const legX = 0.1 * w;
    // legs (pivot at the hip) + shoes
    for (const side of [-1, 1]) {
      const P = side < 0 ? 1 : 2;
      const lx = side * legX;
      if (o.shorts) {
        b.box(0.16 * w, 0.32, 0.17, { c: pants, p: P, pv: [0.9], at: [lx, 0.74, 0], m: pm });
        b.box(0.12 * w, 0.5, 0.13, { c: skin, p: P, pv: [0.9], at: [lx, 0.34, 0] });
        b.box(0.13 * w, 0.06, 0.15, { c: 0xf2f2f2, p: P, pv: [0.9], at: [lx, 0.12, 0] });
      } else {
        b.box(0.155 * w, 0.82, 0.16, { c: pants, p: P, pv: [0.9], at: [lx, 0.49, 0], m: pm });
      }
      b.box(0.14 * w, 0.09, 0.27, { c: shoes, p: P, pv: [0.9], at: [lx, 0.045, 0.04] });
    }
    // hips + torso (tapered hexagonal prism, flattened front-back)
    b.box(0.36 * w, 0.16, 0.22, { c: pants, at: [0, 0.94, 0], m: pm });
    b.cyl(0.23 * w, 0.2 * w, 0.56, 6, { c: shirt, at: [0, 1.25, 0], sc: [1, 1, 0.62], rot: [0, Math.PI / 6, 0], m: sm });
    if (o.belly) b.ball(0.2 * w, { c: shirt, at: [0, 1.12, 0.07], sc: [1.05, 0.9, 0.75], m: sm });
    // arms (pivot at the shoulder) + hands
    const sleeve = o.sleeves !== undefined ? o.sleeves : shirt;
    for (const side of [-1, 1]) {
      const P = side < 0 ? 3 : 4;
      const ax = side * (0.27 * w + 0.02);
      b.box(0.12, 0.5, 0.13, { c: sleeve, p: P, pv: [1.45], at: [ax, 1.2, 0], m: o.sleeves !== undefined ? 0 : sm });
      b.box(0.1, 0.11, 0.1, { c: skin, p: P, pv: [1.45], at: [ax, 0.9, 0.0] });
    }
    // neck + head
    b.cyl(0.06, 0.07, 0.08, 6, { c: skin, at: [0, 1.555, 0] });
    b.ball(0.135, { c: skin, p: 5, pv: [1.56], at: [0, 1.68, 0.0], sc: [0.95, 1.08, 1] });
    b.box(0.03, 0.04, 0.03, { c: skin, p: 5, pv: [1.56], at: [0, 1.66, 0.135] }); // nose
    if (o.glasses) b.box(0.2, 0.035, 0.02, { c: 0x111111, p: 5, pv: [1.56], at: [0, 1.7, 0.13] });
    if (o.beard) b.box(0.2, 0.12, 0.08, { c: o.beard, p: 5, pv: [1.56], at: [0, 1.59, 0.09] });
    // hair / hats
    const hc = o.hair;
    const hat = o.hat;
    if (hat !== 'hoodUp' && hat !== 'beanie') {
      b.cap(0.142, { c: hc, p: 5, pv: [1.56], at: [0, 1.7, -0.01], sc: [1, 0.8, 1.04] });
      if (o.long) b.box(0.26, 0.28, 0.08, { c: hc, p: 5, pv: [1.56], at: [0, 1.6, -0.1] });
    }
    const hatC = o.hatC !== undefined ? o.hatC : shirt;
    if (hat === 'flat') {
      b.cyl(0.15, 0.155, 0.07, 8, { c: hatC, p: 5, pv: [1.56], at: [0, 1.79, -0.005], sc: [1, 1, 1.05] });
      b.box(0.24, 0.025, 0.12, { c: hatC, p: 5, pv: [1.56], at: [0, 1.765, 0.15], rot: [0.15, 0, 0] });
    } else if (hat === 'cap' || hat === 'capBack') {
      const dir = hat === 'cap' ? 1 : -1;
      b.cap(0.148, { c: hatC, p: 5, pv: [1.56], at: [0, 1.74, 0], sc: [1, 0.75, 1] });
      b.box(0.17, 0.02, 0.13, { c: hatC, p: 5, pv: [1.56], at: [0, 1.75, dir * 0.17] });
    } else if (hat === 'beanie') {
      b.cap(0.152, { c: hatC, p: 5, pv: [1.56], at: [0, 1.71, 0], sc: [1, 1.15, 1] });
      b.ball(0.045, { c: 0xf4f0e6, p: 5, pv: [1.56], at: [0, 1.89, 0] }, 5, 4);
    } else if (hat === 'fedora') {
      b.cyl(0.24, 0.24, 0.02, 10, { c: hatC, p: 5, pv: [1.56], at: [0, 1.775, 0] });
      b.cyl(0.12, 0.145, 0.13, 8, { c: hatC, p: 5, pv: [1.56], at: [0, 1.85, 0] });
      b.cyl(0.147, 0.147, 0.03, 8, { c: 0x222222, p: 5, pv: [1.56], at: [0, 1.8, 0] });
    } else if (hat === 'hoodUp') {
      b.ball(0.165, { c: hatC, p: 5, pv: [1.56], at: [0, 1.7, -0.035], sc: [1, 1.05, 1] });
    } else if (hat === 'headband') {
      b.cyl(0.145, 0.145, 0.035, 8, { c: hatC, p: 5, pv: [1.56], at: [0, 1.72, 0] });
    }
    if (o.hood) b.box(0.3 * w, 0.12, 0.12, { c: o.hood, at: [0, 1.52, -0.12], rot: [0.4, 0, 0] });
    return { rh: [0.27 * w + 0.02, 0.88, 0], lh: [-(0.27 * w + 0.02), 0.88, 0], w };
  }

  // Small dog at (x, z) facing +z (or `yaw`). size 0.6..1.4, colors.
  function dog(b, x, z, size, coat, o) {
    o = o || {};
    const s = size;
    const y0 = 0.36 * s;
    const yaw = o.yaw || 0;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const P = (lx, ly, lz) => [x + lx * cy + lz * sy, ly, z - lx * sy + lz * cy];
    const ear = o.ear || coat;
    // body (bobs)
    b.box(0.2 * s, 0.19 * s, 0.48 * s, { c: coat, p: 6, at: P(0, y0, 0), rot: [0, yaw, 0] });
    b.box(0.17 * s, 0.17 * s, 0.17 * s, { c: coat, p: 6, at: P(0, y0 + 0.14 * s, 0.28 * s), rot: [0, yaw, 0] });
    b.box(0.09 * s, 0.08 * s, 0.11 * s, { c: o.snout || coat, p: 6, at: P(0, y0 + 0.1 * s, 0.4 * s), rot: [0, yaw, 0] });
    b.box(0.04 * s, 0.04 * s, 0.03 * s, { c: 0x111111, p: 6, at: P(0, y0 + 0.13 * s, 0.46 * s), rot: [0, yaw, 0] });
    for (const sd of [-1, 1]) b.box(0.05 * s, 0.1 * s, 0.05 * s, { c: ear, p: 6, at: P(sd * 0.07 * s, y0 + 0.25 * s, 0.25 * s), rot: [0, yaw, sd * 0.3] });
    if (o.collar !== undefined) b.box(0.18 * s, 0.04 * s, 0.05 * s, { c: o.collar, p: 6, at: P(0, y0 + 0.08 * s, 0.2 * s), rot: [0, yaw, 0] });
    // legs: diagonal pairs swing opposite
    const lh = y0 - 0.08 * s;
    const legs = [[-1, 1, 7], [1, -1, 7], [1, 1, 9], [-1, -1, 9]];
    for (const L of legs) {
      const p = P(L[0] * 0.07 * s, lh / 2, L[1] * 0.17 * s);
      b.box(0.06 * s, lh, 0.06 * s, { c: o.legs || coat, p: L[2], pv: [lh, p[2], p[0]], at: p, rot: [0, yaw, 0] });
    }
    // tail (wags)
    const tp = P(0, y0 + 0.12 * s, -0.27 * s);
    b.box(0.04 * s, 0.04 * s, 0.18 * s, { c: coat, p: 8, pv: [tp[1], tp[2], tp[0]], at: tp, rot: [0.7, yaw, 0] });
    return P(0, y0 + 0.1 * s, 0.2 * s); // collar point
  }

  // Diorama proportions: shorter legs, slightly broader body, a 1.3× head (reads far better from an RTS
  // camera than real proportions). Remaps vertex heights and the part pivots consistently.
  function remapY(y) {
    if (y <= 0.9) return y * 0.84;
    if (y <= 1.53) return 0.756 + (y - 0.9) * 1.02;
    return 1.3986 + (y - 1.53) * 1.32;
  }
  function stylize(geo) {
    const P = geo.attributes.position, A = geo.attributes.aPart;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i);
      let x = P.getX(i), z = P.getZ(i);
      if (y > 1.53) { x *= 1.3; z *= 1.3; }
      else if (y > 0.9) { x *= 1.08; }
      P.setXYZ(i, x, remapY(y), z);
      const part = A.getX(i);
      if (part >= 1 && part <= 5) A.setY(i, remapY(A.getY(i)));
      else if (part === 12) A.setY(i, remapY(A.getY(i)));
      else if (part >= 6 && part <= 9) A.setY(i, A.getY(i) * 0.84);
    }
    P.needsUpdate = true; A.needsUpdate = true;
    geo.computeBoundingSphere(); geo.boundingSphere.radius += 3;
    return geo;
  }

  function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); }
  function mixHex(a, b, t) { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return c.getHex(); }

  // Pose styles (per mesh uniform uPose: armR base, armL base, swing, style)
  // style 0 normal, 1 drummer, 2 sax/two-hand hold, 3 tambourine, 4 walker (leash hand forward), 5 squirrel/pigeon (no arms)
  function buildType(fkey, cls, color) {
    const b = new Builder();
    const fc = new THREE.Color(color).getHex();
    const fd = shade(fc, 0.62);
    const fl = mixHex(fc, 0xffffff, 0.35);
    let pose = [0, 0, 1, 0];
    let ring = 0.62, glyphY = GLYPH_Y;
    const sk = (i) => SKIN[i % SKIN.length], hr = (i) => HAIR[i % HAIR.length];
    if (fkey === 'hustle') {
      if (cls === 'crowd') { // Kibitzers: old guys in cardigans and flat caps, coffee in hand
        const h = person(b, { skin: sk(0), shirt: fc, pants: 0x6f6a62, hair: 0xc9c4b8, hat: 'flat', hatC: 0x5d5446, glasses: true, belly: true });
        b.cyl(0.045, 0.04, 0.12, 6, { c: 0xf4efe3, p: 4, pv: [1.45], at: [h.rh[0], 0.86, 0.07] });
        b.box(0.24, 0.3, 0.02, { c: 0xece6d6, at: [0, 1.28, 0.145] }); // shirt front under the cardigan
        pose = [-0.25, 0.0, 0.8, 0];
      } else if (cls === 'talker') { // Speed Hustler: track jacket, cap backwards, chess clock in hand
        const h = person(b, { skin: sk(2), shirt: fc, sleeves: fc, pants: 0x1e1e22, hair: hr(2), hat: 'capBack', hatC: 0x15233d });
        b.box(0.04, 0.5, 0.02, { c: 0xffffff, at: [0.1, 1.25, 0.142] });
        b.box(0.04, 0.5, 0.02, { c: 0xffffff, at: [-0.1, 1.25, 0.142] });
        b.box(0.2, 0.09, 0.08, { c: 0x6b4423, p: 3, pv: [1.45], at: [h.lh[0], 0.85, 0.08] });
        b.box(0.04, 0.03, 0.04, { c: 0xd6d0c0, p: 3, pv: [1.45], at: [h.lh[0] - 0.05, 0.91, 0.08] });
        b.box(0.04, 0.03, 0.04, { c: 0xd6d0c0, p: 3, pv: [1.45], at: [h.lh[0] + 0.05, 0.91, 0.08] });
        pose = [0, -0.35, 0.9, 0];
      } else { // Old Head with his lawn chair
        person(b, { w: 1.22, skin: sk(1), shirt: fc, pants: 0x4b4a46, hair: 0xd8d4cc, hat: 'flat', hatC: 0x3a3a3a, beard: 0xe6e2da, belly: true, glasses: true });
        // folding lawn chair slung on his back: aluminium frame + striped webbing
        const al = 0xc9cdd2;
        for (const sx of [-0.27, 0.27]) {
          b.rod([sx, 0.55, -0.3], [sx, 1.6, -0.24], 0.035, { c: al });
          b.rod([sx, 0.55, -0.36], [sx, 1.25, -0.42], 0.035, { c: al });
        }
        for (let k = 0; k < 5; k++) b.box(0.52, 0.12, 0.02, { c: k % 2 ? 0xffffff : fl, at: [0, 0.72 + k * 0.17, -0.28], rot: [-0.06, 0, 0] });
        // chessboard under the arm
        b.box(0.04, 0.32, 0.32, { c: 0x2c2c2c, p: 4, pv: [1.45], at: [0.42, 1.12, 0.02] });
        pose = [-0.1, 0, 0.6, 0];
        ring = 0.86; glyphY = GLYPH_Y + 0.3;
      }
    } else if (fkey === 'noise') {
      if (cls === 'crowd') { // Tambourine Kid (small), beanie, tambourine raised
        const h = person(b, { w: 0.92, skin: sk(4), shirt: fc, pants: 0x3a4e7a, hair: hr(0), hat: 'beanie', hatC: shade(fc, 0.8), shoes: 0xeeeeee });
        b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12, 1, true), { c: 0xd8b26a, p: 4, pv: [1.45], at: [h.rh[0] + 0.02, 0.8, 0.02], rot: [0, 0, Math.PI / 2] });
        b.add(new THREE.CircleGeometry(0.125, 10), { c: 0xf6efe0, p: 4, pv: [1.45], at: [h.rh[0] + 0.04, 0.8, 0.02], rot: [0, Math.PI / 2, 0] });
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; b.box(0.03, 0.04, 0.04, { c: 0xf2d27a, p: 4, pv: [1.45], at: [h.rh[0] + 0.02, 0.8 + Math.sin(a) * 0.13, 0.02 + Math.cos(a) * 0.13] }); }
        pose = [-2.4, 0, 0.9, 3];
      } else if (cls === 'talker') { // Sax player in a fedora and vest
        person(b, { skin: sk(5), shirt: fc, sleeves: 0xf4efe6, pants: 0x232323, hair: hr(2), hat: 'fedora', hatC: 0x2b2b2b });
        const gold = 0xe2b33c;
        b.cyl(0.05, 0.05, 0.62, 8, { c: gold, at: [0.05, 1.1, 0.26], rot: [0.15, 0, -0.2] });
        b.cone(0.12, 0.2, 8, { c: gold, at: [0.13, 0.78, 0.33], rot: [Math.PI - 0.5, 0, 0] });
        b.rod([0.0, 1.42, 0.24], [-0.02, 1.58, 0.16], 0.03, { c: gold });
        b.box(0.03, 0.04, 0.03, { c: 0x222222, at: [-0.02, 1.6, 0.15] });
        pose = [-0.85, -1.05, 0.15, 2];
      } else { // Bucket drummer: orange bucket, sticks
        person(b, { w: 1.18, skin: sk(2), shirt: fc, pants: 0x2d3340, hair: hr(2), hat: 'capBack', hatC: 0x1a1a1a, belly: true });
        b.add(new THREE.CylinderGeometry(0.21, 0.18, 0.4, 10, 1, true), { c: 0xff7a14, at: [0, 0.7, 0.36] });
        b.add(new THREE.CircleGeometry(0.205, 10), { c: 0xe8e2d2, at: [0, 0.9, 0.36], rot: [-Math.PI / 2, 0, 0] });
        b.cyl(0.215, 0.215, 0.03, 10, { c: 0xffffff, at: [0, 0.83, 0.36] });
        b.rod([0.33, 0.86, 0.05], [0.18, 0.95, 0.36], 0.025, { c: 0xd9c08f, p: 4, pv: [1.45] });
        b.rod([-0.33, 0.86, 0.05], [-0.18, 0.95, 0.36], 0.025, { c: 0xd9c08f, p: 3, pv: [1.45] });
        pose = [-0.7, -0.7, 0.2, 1];
        ring = 0.9; glyphY = GLYPH_Y + 0.3;
      }
    } else if (fkey === 'violets') {
      if (cls === 'crowd') { // Freshmen: violet hoodie, backpack, phone
        const h = person(b, { w: 0.96, skin: sk(3), shirt: fc, pants: 0x34507a, hair: hr(1), hood: fd, shoes: 0xf5f5f5, long: true });
        b.box(0.32, 0.4, 0.16, { c: 0x2b2f3a, at: [0, 1.2, -0.21] });
        b.box(0.1, 0.03, 0.15, { c: 0xffffff, at: [0, 1.23, 0.08] }); // NYU letters band
        b.box(0.06, 0.11, 0.015, { c: 0x111318, p: 3, pv: [1.45], at: [h.lh[0], 0.92, 0.07] });
        b.box(0.05, 0.09, 0.005, { c: 0x9fd4ff, p: 3, pv: [1.45], at: [h.lh[0], 0.92, 0.08], raw: true });
        pose = [0, -0.9, 0.9, 0];
      } else if (cls === 'talker') { // Debate team: blazer, papers, glasses
        const h = person(b, { skin: sk(0), shirt: fc, pants: 0x262836, hair: hr(3), glasses: true, long: true });
        b.box(0.12, 0.42, 0.02, { c: 0xffffff, at: [0, 1.27, 0.146] });
        b.box(0.035, 0.3, 0.02, { c: 0x5a2fa3, at: [0, 1.28, 0.152] });
        b.box(0.2, 0.26, 0.02, { c: 0xfafafa, p: 3, pv: [1.45], at: [h.lh[0], 0.95, 0.12], rot: [0.3, 0, 0] });
        pose = [0, -0.7, 0.8, 0];
      } else { // Club Rugby: striped jersey, shorts, headband, ball
        person(b, { w: 1.28, skin: sk(1), shirt: fc, pants: 0xf2f2f2, hair: hr(0), hat: 'headband', hatC: 0xffffff, shorts: true });
        for (let k = 0; k < 3; k++) b.cyl(0.24 * 1.28, 0.24 * 1.28, 0.05, 6, { c: 0xffffff, at: [0, 1.08 + k * 0.15, 0], sc: [1.01, 1, 0.64], rot: [0, Math.PI / 6, 0] });
        b.ball(0.15, { c: 0x8b4a24, p: 4, pv: [1.45], at: [0.45, 1.0, 0.1], sc: [0.75, 0.75, 1.15] });
        b.box(0.02, 0.18, 0.22, { c: 0xffffff, p: 4, pv: [1.45], at: [0.45, 1.0, 0.1] });
        pose = [-0.35, 0, 0.9, 0];
        ring = 0.92; glyphY = GLYPH_Y + 0.35;
      }
    } else if (fkey === 'pack') {
      if (cls === 'crowd') { // Small-dog walker with a terrier on a leash
        const h = person(b, { skin: sk(3), shirt: fc, sleeves: 0x2f3542, pants: 0x262a33, hair: hr(4), hat: 'beanie', hatC: 0x30343d, long: true });
        const cp = dog(b, 0.48, 0.75, 0.8, 0xe9e2d4, { ear: 0x8a6a4a, collar: fc, snout: 0xd6cdbd });
        b.rod([h.rh[0], 0.86, 0.12], cp, 0.018, { c: fc, p: 4, pv: [1.45] });
        pose = [-0.55, 0, 0.8, 4];
        ring = 0.78;
      } else if (cls === 'talker') { // Ball-Launcher Dad with a lab
        const h = person(b, { skin: sk(0), shirt: fc, pants: 0xc9b48a, hair: hr(1), hat: 'cap', hatC: 0x2e3a2e, shorts: true });
        b.rod([h.rh[0], 0.88, 0.05], [h.rh[0] + 0.02, 0.62, 0.72], 0.03, { c: 0x2f7fd8, p: 4, pv: [1.45] });
        b.ball(0.05, { c: 0xd9f23a, p: 4, pv: [1.45], at: [h.rh[0] + 0.02, 0.6, 0.76] }, 6, 4);
        dog(b, -0.55, 0.55, 1.15, 0xd9b26a, { collar: fc, snout: 0xcaa25c });
        pose = [-0.6, 0, 0.7, 0];
        ring = 0.82;
      } else { // Pro Dog Walker: six dogs fanned out ahead, leashes to one hand
        const h = person(b, { w: 1.12, skin: sk(5), shirt: fc, pants: 0x2b2e35, hair: hr(2), hat: 'cap', hatC: 0x1b1b1b });
        b.box(0.3, 0.1, 0.1, { c: 0x1e1e1e, at: [0, 0.98, 0.14] }); // waist pack
        const hand = [h.rh[0] + 0.12, 0.95, 0.35];
        const dogs = [[-0.95, 1.15, 0.9, 0x6b4a2a, -0.2], [-0.35, 1.55, 0.75, 0xf2efe8, 0], [0.3, 1.65, 1.2, 0x222222, 0.1],
          [0.95, 1.25, 1.0, 0xc9a46a, 0.25], [-1.25, 0.45, 0.7, 0x9a9a9a, -0.5], [1.3, 0.5, 0.85, 0xb5582a, 0.5]];
        for (const d of dogs) {
          const cp = dog(b, d[0], d[1], d[2], d[3], { yaw: d[4], collar: [0xff3b30, 0x2f7fd8, 0x34c759, 0xffcc00][Math.abs(Math.round(d[0] * 3)) % 4] });
          b.rod(hand, cp, 0.016, { c: 0xe9e2d0 });
        }
        b.box(0.1, 0.1, 0.1, { c: 0xe9e2d0, p: 4, pv: [1.45], at: [h.rh[0], 0.88, 0.05] });
        pose = [-0.9, 0, 0.5, 4];
        ring = 1.45; glyphY = GLYPH_Y + 0.3;
      }
    } else { // squirrels faction (Mission 1): oversized squirrels
      const s = cls === 'heavy' ? 2.4 : cls === 'talker' ? 1.7 : 1.9;
      squirrel(b, s, 0x8a7a6a, 0xd8cbb8);
      pose = [0, 0, 0, 5];
      ring = cls === 'heavy' ? 0.75 : 0.55; glyphY = 1.8;
    }
    const geo = fkey === 'squirrels' ? b.build() : stylize(b.build());
    return { geo, pose, ring, glyphY };
  }

  function squirrel(b, s, coat, belly) {
    b.ball(0.11 * s, { c: coat, p: 6, at: [0, 0.13 * s, 0], sc: [0.9, 0.9, 1.35] });
    b.ball(0.08 * s, { c: belly, p: 6, at: [0, 0.12 * s, 0.05 * s], sc: [0.8, 0.9, 1] });
    b.ball(0.07 * s, { c: coat, p: 6, at: [0, 0.25 * s, 0.12 * s] }, 6, 5);
    for (const sd of [-1, 1]) b.box(0.025 * s, 0.05 * s, 0.02 * s, { c: coat, p: 6, at: [sd * 0.04 * s, 0.32 * s, 0.1 * s] });
    b.box(0.02 * s, 0.02 * s, 0.02 * s, { c: 0x111111, p: 6, at: [0, 0.25 * s, 0.19 * s] });
    // bushy tail curling up behind
    b.ball(0.08 * s, { c: coat, p: 8, pv: [0.15 * s, -0.12 * s, 0], at: [0, 0.22 * s, -0.17 * s], sc: [0.8, 1.6, 0.8], rot: [-0.3, 0, 0] });
    b.ball(0.07 * s, { c: shade(coat, 1.1), p: 8, pv: [0.15 * s, -0.12 * s, 0], at: [0, 0.38 * s, -0.12 * s], sc: [0.8, 1.2, 0.8] });
  }

  function pigeonGeo() {
    const b = new Builder();
    b.ball(0.1, { c: 0x8e939c, at: [0, 0.13, 0], sc: [0.85, 0.8, 1.45] }, 7, 5);
    b.ball(0.055, { c: 0x6f7d86, p: 5, pv: [0.16, 0.08], at: [0, 0.23, 0.11] }, 6, 4);
    b.box(0.05, 0.05, 0.05, { c: 0x5f8a7a, at: [0, 0.18, 0.08] }); // iridescent neck
    b.box(0.02, 0.02, 0.04, { c: 0x2b2b2b, p: 5, pv: [0.16, 0.08], at: [0, 0.22, 0.17] });
    b.box(0.08, 0.02, 0.1, { c: 0x5e636c, at: [0, 0.12, -0.17] });
    b.box(0.17, 0.02, 0.1, { c: 0x7c818b, p: 10, pv: [0.15, 0, 0.05], at: [0.12, 0.15, -0.01] });
    b.box(0.17, 0.02, 0.1, { c: 0x7c818b, p: 11, pv: [0.15, 0, -0.05], at: [-0.12, 0.15, -0.01] });
    for (const sd of [-1, 1]) b.box(0.015, 0.06, 0.015, { c: 0xd06a5a, at: [sd * 0.035, 0.03, 0] });
    return b.build();
  }

  function squirrelGeo() { const b = new Builder(); squirrel(b, 1.15, 0x8a7a6a, 0xd8cbb8); return b.build(); }

  function civilianGeo() {
    const b = new Builder();
    person(b, { skin: 0xd9a983, shirt: 0xffffff, shirtMask: 1, pants: 0xffffff, pantsMask: 2, hair: 0x3a2a1e });
    return stylize(b.build());
  }

  function pianoGeo() {
    const b = new Builder();
    const blk = 0x111114;
    b.box(1.5, 0.32, 1.1, { c: blk, at: [0, 0.82, 0.2] });
    b.cyl(0.55, 0.55, 0.32, 10, { c: blk, at: [0.2, 0.82, 0.85], sc: [1.2, 1, 1] });
    b.box(1.4, 0.03, 1.5, { c: blk, at: [0.15, 1.4, 0.55], rot: [0, 0, 0.45] }); // propped lid
    b.rod([-0.45, 0.98, 0.5], [-0.15, 1.32, 0.5], 0.02, { c: 0x999999 });
    b.box(1.3, 0.05, 0.18, { c: 0xf5f5f0, at: [0, 0.98, -0.42] });
    for (let k = 0; k < 9; k++) b.box(0.05, 0.03, 0.1, { c: 0x111111, at: [-0.56 + k * 0.14, 1.01, -0.39] });
    for (const p of [[-0.65, -0.25], [0.65, -0.25], [0.2, 1.25]]) b.box(0.08, 0.68, 0.08, { c: blk, at: [p[0], 0.34, p[1]] });
    b.box(0.7, 0.06, 0.32, { c: blk, at: [0, 0.5, -0.95] });
    for (const sx of [-0.3, 0.3]) b.box(0.05, 0.5, 0.25, { c: blk, at: [sx, 0.25, -0.95] });
    // wheels on a dolly (he rolls it in)
    b.box(1.7, 0.08, 1.4, { c: 0x3b3b3b, at: [0.1, 0.1, 0.4] });
    return b.build();
  }

  function truckGeo() {
    const b = new Builder();
    const white = 0xf6f4ee, pink = 0xff6fa5, blue = 0x58b8ff;
    b.box(2.2, 2.3, 4.0, { c: white, at: [0, 1.65, -0.6] });
    b.box(2.15, 1.5, 1.5, { c: white, at: [0, 1.25, 2.1] });
    b.box(2.0, 0.7, 0.05, { c: 0x2a3540, at: [0, 1.65, 2.86] });
    b.box(2.22, 0.25, 4.02, { c: pink, at: [0, 1.0, -0.6] });
    b.box(2.22, 0.12, 4.02, { c: blue, at: [0, 2.6, -0.6] });
    b.box(0.05, 0.9, 1.8, { c: 0x2a3540, at: [1.11, 1.9, -0.6] }); // serving window
    b.box(0.3, 0.06, 1.9, { c: pink, at: [1.25, 1.45, -0.6] });
    b.cone(0.35, 0.8, 8, { c: 0xd9a35f, at: [0, 3.15, -0.6], rot: [Math.PI, 0, 0] });
    b.ball(0.4, { c: 0xffd1e0, at: [0, 3.65, -0.6] }, 8, 6);
    for (const w of [[-1.05, -1.9], [1.05, -1.9], [-1.05, 1.9], [1.05, 1.9]]) b.cyl(0.42, 0.42, 0.3, 10, { c: 0x1d1d1d, at: [w[0], 0.42, w[1]], rot: [0, 0, Math.PI / 2] });
    return b.build();
  }

  // ================================================================== materials
  const shared = {
    uTime: { value: 0 }, uLift: { value: 0.06 }, uPx: { value: 0.002 }, uAtlas: { value: null }, uCB: { value: 0 },
    uRingPulse: { value: 0 },
  };

  const VERT_HEAD = `
attribute vec4 aPart;
attribute float aMask;
attribute vec4 iAnim;
attribute vec4 iExtra;
#ifdef SQ_TINT
attribute vec4 iTint;
#endif
uniform float uTime;
uniform vec4 uPose;
varying float vFade;
float sqA; float sqZ; float sqWag; float sqBob;
vec3 sqRotX(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x, p.y*c - p.z*s, p.y*s + p.z*c); }
vec3 sqRotZ(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x*c - p.y*s, p.x*s + p.y*c, p.z); }
void sqAngles(){
  float P = aPart.x; float ph = iAnim.x; float walk = iAnim.y; float act = iAnim.z;
  float t = uTime + iExtra.x * 13.0;
  float s = sin(ph);
  sqA = 0.0; sqZ = 0.0; sqWag = 0.0; sqBob = 0.0;
  bool attack = abs(act - 2.0) < 0.5, over = abs(act - 3.0) < 0.5, sit = abs(act - 4.0) < 0.5, cheer = abs(act - 6.0) < 0.5;
  if (P > 0.5 && P < 2.5) {
    float side = P < 1.5 ? 1.0 : -1.0;
    sqA = side * s * 0.62 * walk;
    if (sit) sqA = -1.45;
  } else if (P > 2.5 && P < 4.5) {
    float side = P < 3.5 ? 1.0 : -1.0;
    float base = P < 3.5 ? uPose.y : uPose.x;
    float sw = uPose.z;
    float style = uPose.w;
    sqA = base - side * s * 0.55 * walk * sw;
    if (style > 2.5 && style < 3.5 && P > 3.5) sqA += 0.25 * sin(t * 9.0) * (0.3 + walk);
    if (attack) {
      if (style > 0.5 && style < 1.5) sqA = base - 0.55 + 0.55 * sin(t * 15.0 + side * 1.7);
      else if (style > 1.5 && style < 2.5) sqA = base + 0.08 * sin(t * 6.0 + side);
      else if (style > 2.5 && style < 3.5) sqA = (P > 3.5 ? -2.6 : -0.4) + 0.35 * sin(t * 14.0 + side);
      else if (P > 3.5) sqA = -1.5 + 0.45 * sin(t * 7.0);
      else sqA = -0.6 + 0.35 * sin(t * 5.3 + 1.3);
    }
    if (over) sqA = -2.75 + 0.18 * sin(t * 7.0 + side);
    if (cheer) sqA = -2.6 + 0.35 * sin(t * 11.0 + side * 1.2);
    if (sit) sqA = -0.55;
  } else if (P > 4.5 && P < 5.5) {
    sqA = attack ? 0.14 * sin(t * 7.0) : 0.04 * sin(t * 1.3);
    if (uPose.w > 4.5) sqA = 0.25 * max(0.0, sin(t * 2.3)) * (1.0 - walk); // pigeon peck
  } else if (P > 5.5 && P < 6.5) {
    sqBob = abs(sin(ph * 2.0)) * 0.05 * walk + 0.01 * sin(t * 3.0);
  } else if (P > 6.5 && P < 7.5) {
    sqA = sin(ph * 2.0) * 0.8 * walk;
  } else if (P > 8.5 && P < 9.5) {
    sqA = -sin(ph * 2.0) * 0.8 * walk;
  } else if (P > 7.5 && P < 8.5) {
    sqWag = sin(t * (attack ? 22.0 : 12.0)) * 0.06;
  } else if (P > 9.5 && P < 11.5) {
    float side = P < 10.5 ? 1.0 : -1.0;
    sqZ = side * (walk > 0.5 ? sin(t * 26.0) * 1.1 : -0.15);
  }
}
vec3 sqPose(vec3 p){
  vec3 piv = vec3(aPart.w, aPart.y, aPart.z);
  if (sqA != 0.0) p = sqRotX(p - piv, sqA) + piv;
  if (sqZ != 0.0) p = sqRotZ(p - piv, sqZ) + piv;
  p.x += sqWag * (p.y - aPart.y + 0.2) * 3.0;
  p.y += sqBob;
  return p;
}
`;

  function patchPeople(mat, opts) {
    opts = opts || {};
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uTime = shared.uTime;
      sh.uniforms.uLift = shared.uLift;
      sh.uniforms.uPose = mat.userData.uPose;
      if (opts.xray) sh.uniforms.uXColor = mat.userData.uXColor;
      sh.vertexShader = (opts.tint ? '#define SQ_TINT\n' : '') + VERT_HEAD + sh.vertexShader
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  sqAngles();\n  if (sqA != 0.0) objectNormal = sqRotX(objectNormal, sqA);\n  if (sqZ != 0.0) objectNormal = sqRotZ(objectNormal, sqZ);')
        .replace('#include <begin_vertex>', 'vec3 transformed = sqPose(vec3(position));')
        .replace('#include <color_vertex>', `#include <color_vertex>
  #ifdef SQ_TINT
  if (aMask > 0.5 && aMask < 1.5) vColor.rgb *= iTint.rgb;
  else if (aMask > 1.5) vColor.rgb *= vec3(iTint.a);
  #endif
  float sqOver = abs(iAnim.z - 3.0) < 0.5 ? 0.85 : 0.0;
  float sqG = dot(vColor.rgb, vec3(0.3, 0.59, 0.11));
  vColor.rgb = mix(vColor.rgb, vec3(sqG) * 0.9, sqOver);
  vColor.rgb += iExtra.w * vec3(1.0, 0.92, 0.8);
  vFade = iAnim.w;`);
      sh.fragmentShader = 'uniform float uLift;\nvarying float vFade;\n' + (opts.xray ? 'uniform vec3 uXColor;\n' : '') + sh.fragmentShader
        .replace('void main() {', `void main() {
  if (vFade > 0.001) { float sqN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (sqN < vFade) discard; }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uLift;')
        + '';
      if (opts.xray) sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor = vec4(uXColor, 0.55);\n}');
    };
    mat.customProgramCacheKey = function () { return 'sqPeople' + (opts.tint ? 'T' : '') + (opts.xray ? 'X' : ''); };
  }

  function peopleMaterial(pose, opts) {
    opts = opts || {};
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.userData.uPose = { value: new THREE.Vector4(pose[0], pose[1], pose[2], pose[3]) };
    if (opts.xray) {
      mat.userData.uXColor = { value: new THREE.Color(opts.xray).convertLinearToSRGB() };
      mat.transparent = true; mat.depthWrite = false; mat.depthFunc = THREE.GreaterDepth;
    }
    patchPeople(mat, opts);
    return mat;
  }

  // ================================================================== instanced pools
  function Pool(geo, mat, cap, opts) {
    opts = opts || {};
    this.cap = cap;
    this.geo = geo;
    this.iAnim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.iExtra = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.iAnim.setUsage(THREE.DynamicDrawUsage); this.iExtra.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iAnim', this.iAnim);
    geo.setAttribute('iExtra', this.iExtra);
    if (opts.tint) {
      this.iTint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4).fill(1), 4);
      this.iTint.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iTint', this.iTint);
    }
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (opts.xray) {
      // Draw the x-ray silhouette first (against the world depth only), then the bodies on top, so a
      // unit's own back-props never ghost through its front. Bodies stay depth-writing.
      mat.transparent = true; mat.depthWrite = true;
      this.mesh.renderOrder = 4;
    }
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.receiveShadow = false;
    if (opts.xray) {
      this.xray = new THREE.InstancedMesh(geo, opts.xray, cap);
      this.xray.instanceMatrix = this.mesh.instanceMatrix;
      this.xray.frustumCulled = false;
      this.xray.count = 0;
      this.xray.renderOrder = 3;
    }
    this.n = 0;
  }
  Pool.prototype.begin = function () { this.n = 0; };
  Pool.prototype.push = function (mat4, a0, a1, a2, a3, e0, e1, e2, e3) {
    if (this.n >= this.cap) return -1;
    const k = this.n++;
    this.mesh.setMatrixAt(k, mat4);
    const A = this.iAnim.array, E = this.iExtra.array;
    A[k * 4] = a0; A[k * 4 + 1] = a1; A[k * 4 + 2] = a2; A[k * 4 + 3] = a3;
    E[k * 4] = e0; E[k * 4 + 1] = e1; E[k * 4 + 2] = e2; E[k * 4 + 3] = e3;
    return k;
  };
  Pool.prototype.tint = function (k, r, g, b, a) { if (k < 0 || !this.iTint) return; const T = this.iTint.array; T[k * 4] = r; T[k * 4 + 1] = g; T[k * 4 + 2] = b; T[k * 4 + 3] = a; };
  Pool.prototype.end = function () {
    this.mesh.count = this.n;
    if (this.xray) this.xray.count = this.n;
    if (this.n) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.iAnim.needsUpdate = true; this.iExtra.needsUpdate = true;
      if (this.iTint) this.iTint.needsUpdate = true;
      this.mesh.instanceMatrix.clearUpdateRanges && this.mesh.instanceMatrix.clearUpdateRanges();
    }
  };
  Pool.prototype.addTo = function (root) { root.add(this.mesh); if (this.xray) root.add(this.xray); };
  Pool.prototype.dispose = function () {
    this.geo.dispose();
    this.mesh.material.dispose();
    if (this.xray) this.xray.material.dispose();
    this.mesh.dispose && this.mesh.dispose();
  };

  // ---------------------------------------------------------------- rings (team decals + contact shadow)
  function ringMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uCB: shared.uCB },
      vertexShader: `
attribute vec4 iCol; attribute vec4 iRing;
varying vec2 vUv; varying vec4 vCol; varying vec4 vRing;
void main(){ vUv = uv; vCol = iCol; vRing = iRing;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
uniform float uTime; uniform float uCB;
varying vec2 vUv; varying vec4 vCol; varying vec4 vRing;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  if (r > 1.0) discard;
  float sel = vCol.a; float fade = vRing.z; float pat = vRing.y; float enemy = vRing.w;
  // contact shadow
  float sh = (1.0 - smoothstep(0.15, 0.62, r)) * 0.42;
  // team ring band
  float inner = 0.62, outer = 0.80;
  float band = smoothstep(inner - 0.04, inner, r) * (1.0 - smoothstep(outer, outer + 0.04, r));
  if (uCB > 0.5) {
    float a = atan(p.y, p.x);
    if (pat > 0.5 && pat < 1.5) band *= step(0.0, sin(a * 10.0));
    else if (pat > 1.5 && pat < 2.5) band *= step(0.35, sin(a * 18.0));
    else if (pat > 2.5) band *= (step(r, 0.68) + step(0.74, r));
  }
  vec3 col = vCol.rgb;
  float alpha = band * (0.85 - enemy * 0.15);
  // selection: white pulsing outer ring
  float sb = 0.0;
  if (sel > 0.5) {
    float pr = 0.88 + 0.03 * sin(uTime * 6.0);
    sb = smoothstep(pr - 0.08, pr - 0.04, r) * (1.0 - smoothstep(pr + 0.02, pr + 0.06, r));
  }
  vec3 c = mix(vec3(0.0), col, band / max(0.001, band + sh * (1.0 - band)));
  c = mix(c, vec3(1.0), sb);
  float A = max(max(alpha, sh), sb);
  gl_FragColor = vec4(c, A * (1.0 - fade));
}`,
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  }

  // ---------------------------------------------------------------- glyph billboards
  function glyphAtlas() {
    const S = 128, c = document.createElement('canvas');
    c.width = S * 3; c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    function path(i) {
      const cx = i * S + S / 2, cy = S / 2, r = S * 0.3;
      ctx.beginPath();
      if (i === 0) ctx.arc(cx, cy, r, 0, Math.PI * 2);
      else if (i === 1) { ctx.moveTo(cx, cy - r * 1.12); ctx.lineTo(cx + r * 1.1, cy + r * 0.82); ctx.lineTo(cx - r * 1.1, cy + r * 0.82); ctx.closePath(); }
      else ctx.rect(cx - r * 0.88, cy - r * 0.88, r * 1.76, r * 1.76);
    }
    for (let i = 0; i < 3; i++) {
      path(i); ctx.strokeStyle = 'rgb(0,0,255)'; ctx.lineWidth = S * 0.26; ctx.stroke();
      path(i); ctx.strokeStyle = 'rgb(0,255,0)'; ctx.lineWidth = S * 0.15; ctx.stroke();
      path(i); ctx.fillStyle = 'rgb(255,0,0)'; ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 2;
    return tex;
  }

  function glyphMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uAtlas: shared.uAtlas, uPx: shared.uPx, uTime: shared.uTime },
      vertexShader: `
attribute vec4 iG; attribute vec4 iG2;
uniform float uPx;
varying vec2 vUv; varying vec4 vG; varying vec4 vG2;
void main(){
  vUv = uv; vG = iG; vG2 = iG2;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float px = 30.0 * (1.0 + 0.18 * iG2.y);
  float size = uPx * px * max(1.0, -c.z);
  c.xy += position.xy * size;
  gl_Position = projectionMatrix * c;
}`,
      fragmentShader: `
uniform sampler2D uAtlas; uniform float uTime;
varying vec2 vUv; varying vec4 vG; varying vec4 vG2;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float cls = vG.x; vec3 team = vG.yzw;
  float hp = vG2.x; float sel = vG2.y; float chev = vG2.z; float alpha = vG2.w;
  float k = 0.64;
  vec2 a = p / k * 0.5 + 0.5;
  vec4 t = vec4(0.0);
  if (a.x > 0.0 && a.x < 1.0 && a.y > 0.0 && a.y < 1.0) t = texture2D(uAtlas, vec2((cls + a.x) / 3.0, a.y));
  vec3 rim = sel > 0.5 ? mix(team, vec3(1.0), 0.15 + 0.15 * sin(uTime * 6.0)) : team;
  vec3 c = vec3(0.06);
  c = mix(c, rim, t.g);
  c = mix(c, vec3(1.0), t.r * (1.0 - t.g));
  float A = max(max(t.r, t.g), t.b * 0.85);
  // Composure arc (only when hurt or selected)
  float r = length(p);
  if (hp < 0.995 || sel > 0.5) {
    float ang = atan(p.x, p.y); // 0 at top, clockwise
    float f = (ang < 0.0 ? ang + 6.2831853 : ang) / 6.2831853;
    float band = smoothstep(0.78, 0.81, r) * (1.0 - smoothstep(0.92, 0.95, r));
    float on = step(f, hp);
    vec3 hc = hp > 0.5 ? mix(vec3(1.0, 0.85, 0.2), vec3(0.35, 0.95, 0.45), (hp - 0.5) * 2.0) : mix(vec3(1.0, 0.25, 0.2), vec3(1.0, 0.85, 0.2), hp * 2.0);
    vec3 bc = mix(vec3(0.05), hc, on);
    float ba = band * (on > 0.5 ? 1.0 : 0.45);
    c = mix(c, bc, ba * (1.0 - A));
    A = max(A, ba);
  }
  // counter chevron: up (good) / down (bad) at the upper right
  if (abs(chev) > 0.5) {
    vec2 q = (p - vec2(0.7, 0.62)) / 0.3;
    if (chev < 0.0) q.y = -q.y;
    float tri = step(-0.8, q.y) * step(q.y, 0.8) * step(abs(q.x), (0.8 - q.y) * 0.62);
    float edge = step(-1.0, q.y) * step(q.y, 1.0) * step(abs(q.x), (1.05 - q.y) * 0.7);
    vec3 cc = chev > 0.0 ? vec3(0.3, 1.0, 0.4) : vec3(1.0, 0.3, 0.25);
    c = mix(c, mix(vec3(0.05), cc, tri), edge);
    A = max(A, edge);
  }
  if (A < 0.02) discard;
  gl_FragColor = vec4(c, A * alpha);
}`,
      transparent: true, depthWrite: false, depthTest: false,
    });
  }

  // ================================================================== module state
  const U = {
    root: null, ctx: null, match: null, quality: 'med', tier: null,
    types: {},           // typeIdx -> {pool, ring, glyphY, fkey, cls}
    rings: null, glyphs: null,
    civ: null, squirrels: null, pigeons: null, piano: null, truck: null,
    rec: new Map(), frame: 0,
    flocks: [], civs: [], pathNet: null, benchSpots: null,
    nrec: new Map(),
    squash: [],
    tmpM: new THREE.Matrix4(), tmpQ: new THREE.Quaternion(), tmpE: new THREE.Euler(0, 0, 0, 'YXZ'), tmpP: new THREE.Vector3(), tmpS: new THREE.Vector3(),
    colorCache: {},
  };

  const units = SQ.units = SQ.units || {};
  units.SCALE = SCALE;

  units.init = function (ctx) {
    U.ctx = ctx;
    U.quality = ctx.quality || 'med';
    U.tier = ctx.tier || { civilians: 40 };
    U.root = new THREE.Group();
    U.root.name = 'units';
    ctx.scene.add(U.root);
    shared.uAtlas.value = glyphAtlas();
    // rings
    const rg = new THREE.PlaneGeometry(2, 2); rg.rotateX(-Math.PI / 2);
    const RC = 600;
    U.rings = { mesh: new THREE.InstancedMesh(rg, ringMaterial(), RC), iCol: new THREE.InstancedBufferAttribute(new Float32Array(RC * 4), 4), iRing: new THREE.InstancedBufferAttribute(new Float32Array(RC * 4), 4), n: 0, cap: RC };
    rg.setAttribute('iCol', U.rings.iCol); rg.setAttribute('iRing', U.rings.iRing);
    U.rings.mesh.frustumCulled = false; U.rings.mesh.renderOrder = 2; U.rings.mesh.count = 0;
    U.root.add(U.rings.mesh);
    // glyphs
    const gg = new THREE.PlaneGeometry(1, 1);
    const GC = 400;
    U.glyphs = { mesh: new THREE.InstancedMesh(gg, glyphMaterial(), GC), iG: new THREE.InstancedBufferAttribute(new Float32Array(GC * 4), 4), iG2: new THREE.InstancedBufferAttribute(new Float32Array(GC * 4), 4), n: 0, cap: GC };
    gg.setAttribute('iG', U.glyphs.iG); gg.setAttribute('iG2', U.glyphs.iG2);
    U.glyphs.mesh.frustumCulled = false; U.glyphs.mesh.renderOrder = 20; U.glyphs.mesh.count = 0;
    U.root.add(U.glyphs.mesh);
    for (const a of [U.rings.iCol, U.rings.iRing, U.glyphs.iG, U.glyphs.iG2]) a.setUsage(THREE.DynamicDrawUsage);
    // neutrals + civilians
    const civCap = (U.tier.civilians || 40) + 160;
    U.civ = new Pool(civilianGeo(), peopleMaterial([0, 0, 1, 0], { tint: true }), civCap, { tint: true });
    U.squirrels = new Pool(squirrelGeo(), peopleMaterial([0, 0, 0, 5]), 24);
    U.pigeons = new Pool(pigeonGeo(), peopleMaterial([0, 0, 0, 5]), 420);
    U.piano = new Pool(pianoGeo(), peopleMaterial([0, 0, 0, 0]), 3);
    U.truck = new Pool(truckGeo(), peopleMaterial([0, 0, 0, 0]), 2);
    for (const p of [U.civ, U.squirrels, U.pigeons, U.piano, U.truck]) p.addTo(U.root);
    buildPathNet();
    spawnAmbient();
    U.types = {};
  };

  units.dispose = function () {
    if (!U.root) return;
    for (const k in U.types) U.types[k].pool.dispose();
    for (const p of [U.civ, U.squirrels, U.pigeons, U.piano, U.truck]) if (p) p.dispose();
    U.rings.mesh.geometry.dispose(); U.rings.mesh.material.dispose();
    U.glyphs.mesh.geometry.dispose(); U.glyphs.mesh.material.dispose();
    if (shared.uAtlas.value) shared.uAtlas.value.dispose();
    U.ctx.scene.remove(U.root);
    U.root = null; U.types = {}; U.rec.clear(); U.nrec.clear();
  };

  units.setOptions = function (o) { shared.uCB.value = o && o.colorblind ? 1 : 0; };

  function factionColor(state, f) {
    const key = SQ.render && SQ.render.colorOf ? SQ.render.colorOf(state, f) : ((state.factions[f] && state.factions[f].color) || '#888888');
    let c = U.colorCache[key];
    if (!c) { c = new THREE.Color(key); c.convertSRGBToLinear(); U.colorCache[key] = c; }
    return c;
  }

  function ensureType(state, typeIdx) {
    let T = U.types[typeIdx];
    if (T) return T;
    const ut = SQ.data.unitTypes[typeIdx];
    if (!ut) return null;
    // faction color: from whichever faction in the match uses this key
    let color = (SQ.data.factions[ut.faction] && SQ.data.factions[ut.faction].color) || '#999999';
    for (const fac of state.factions) if (fac.key === ut.faction) { color = SQ.render && SQ.render.colorOf ? SQ.render.colorOf(state, fac.idx) : fac.color; break; }
    const built = buildType(ut.faction, ut.cls, color);
    const xray = peopleMaterial(built.pose, { xray: color });
    const pool = new Pool(built.geo, peopleMaterial(built.pose), 160, { xray });
    pool.addTo(U.root);
    T = U.types[typeIdx] = { pool, ring: built.ring, glyphY: built.glyphY, fkey: ut.faction, cls: ut.cls, clsIdx: SQ.C.CLASS_IDX[ut.cls] };
    return T;
  }

  units.setMatch = function (m) {
    U.match = m || null;
    // Faction colours can change per match: rebuild unit type meshes.
    for (const k in U.types) { const T = U.types[k]; U.root.remove(T.pool.mesh); if (T.pool.xray) U.root.remove(T.pool.xray); T.pool.dispose(); }
    U.types = {};
    U.rec.clear(); U.nrec.clear(); U.squash.length = 0;
    U.flocks = U.flocks.filter((f) => f.ambient);
    for (const f of U.flocks) resetFlock(f);
    if (m) {
      const s = m.state;
      for (let t = 0; t < SQ.data.unitTypes.length; t++) {
        const ut = SQ.data.unitTypes[t];
        if (s.factions.some((f) => f.key === ut.faction)) ensureType(s, t);
      }
    }
  };

  // ================================================================== ambient civilians
  function buildPathNet() {
    const G = window.GEO;
    const PB = SQ.C.PARK_BOUNDS;
    const inPark = (p) => p[0] > PB.x0 - 2 && p[0] < PB.x1 + 2 && p[1] > PB.z0 - 2 && p[1] < PB.z1 + 2;
    const lines = [];
    if (G && G.paths) {
      for (const p of G.paths) {
        if (p.area || !p.pts || p.pts.length < 2) continue;
        if (p.kind !== 'footway' && p.kind !== 'pedestrian') continue;
        if (!p.pts.every(inPark)) continue;
        let L = 0; const cum = [0];
        for (let i = 1; i < p.pts.length; i++) { L += Math.hypot(p.pts[i][0] - p.pts[i - 1][0], p.pts[i][1] - p.pts[i - 1][1]); cum.push(L); }
        if (L < 6) continue;
        lines.push({ pts: p.pts, cum, L, next0: [], next1: [] });
      }
    }
    // endpoint adjacency (within 5 m of any vertex of another line)
    for (const a of lines) {
      for (const end of [0, 1]) {
        const ep = end ? a.pts[a.pts.length - 1] : a.pts[0];
        for (const b of lines) {
          if (b === a) continue;
          let best = -1, bd = 25;
          for (let i = 0; i < b.pts.length; i++) { const d = (b.pts[i][0] - ep[0]) ** 2 + (b.pts[i][1] - ep[1]) ** 2; if (d < bd) { bd = d; best = i; } }
          if (best >= 0) (end ? a.next1 : a.next0).push({ line: b, s: b.cum[best] });
        }
      }
    }
    // sample points for "nearest path" (bench orientation)
    const samples = [];
    for (const l of lines) for (let s = 0; s < l.L; s += 2) { const p = atS(l, s); samples.push(p.x, p.z); }
    U.pathNet = { lines, samples };
    // benches inside the park (sitters face the nearest path)
    const spots = [];
    if (G && G.benches) {
      for (const b of G.benches) {
        if (!inPark(b)) continue;
        let bx = 0, bz = 0, bd = 1e9;
        for (let i = 0; i < samples.length; i += 2) { const d = (samples[i] - b[0]) ** 2 + (samples[i + 1] - b[1]) ** 2; if (d < bd) { bd = d; bx = samples[i]; bz = samples[i + 1]; } }
        if (bd > 64) continue;
        spots.push({ x: b[0], z: b[1], face: Math.atan2(bx - b[0], bz - b[1]) });
      }
    }
    U.benchSpots = spots;
  }

  function atS(l, s) {
    s = Math.max(0, Math.min(l.L, s));
    let i = 1;
    while (i < l.cum.length - 1 && l.cum[i] < s) i++;
    const a = l.pts[i - 1], b = l.pts[i];
    const seg = l.cum[i] - l.cum[i - 1] || 1;
    const t = (s - l.cum[i - 1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg };
  }

  const CIV_SHIRTS = [0x6d7f99, 0x9a8f7c, 0x7a5b5b, 0x5f7a66, 0xb8b0a0, 0x4f5663, 0x8c7a9a, 0xa38a6c, 0x6b6b6b, 0xd2cbbd, 0x7f8f9f, 0x96705a];
  function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function spawnAmbient() {
    const r = rnd(1234);
    U.civs = [];
    const N = U.tier.civilians || 40;
    const net = U.pathNet;
    const spots = U.benchSpots.slice();
    for (let i = 0; i < N; i++) {
      const shirt = new THREE.Color(CIV_SHIRTS[Math.floor(r() * CIV_SHIRTS.length)]).convertSRGBToLinear();
      const c = { shirt: [shirt.r, shirt.g, shirt.b], pants: 0.18 + r() * 0.3, seed: r(), phase: r() * 6, walk: 0, face: 0, x: 0, z: 0, flee: 0, night: r() < 0.5, h: 0.92 + r() * 0.14 };
      if (i % 3 === 0 && spots.length) {
        const k = Math.floor(r() * spots.length);
        const sp = spots.splice(k, 1)[0];
        c.sit = true; c.x = sp.x; c.z = sp.z; c.face = sp.face;
        // sit on the front edge of the bench
        c.x += Math.sin(c.face) * 0.15; c.z += Math.cos(c.face) * 0.15;
      } else if (net.lines.length) {
        c.line = net.lines[Math.floor(r() * net.lines.length)];
        c.s = r() * c.line.L; c.dir = r() < 0.5 ? 1 : -1; c.speed = 1.1 + r() * 0.5;
        c.off = (r() - 0.5) * 1.6;
      } else { c.sit = true; c.x = (r() - 0.5) * 200; c.z = (r() - 0.5) * 100; }
      U.civs.push(c);
    }
    // ambient pigeon flocks on the plazas
    U.flocks = [];
    const sites = [[6, 22, 30], [-4, -36, 22], [-120, 46, 18], [-70, 8, 16], [64, -2, 16], [-20, -18, 14]];
    const n = U.quality === 'low' ? 3 : U.quality === 'med' ? 5 : 6;
    for (let i = 0; i < n; i++) U.flocks.push(makeFlock(sites[i][0], sites[i][1], sites[i][2], 9, true, 'amb' + i));
  }

  function updateCivilians(state, dt, out) {
    const nightK = SQ.env && SQ.env.U ? SQ.env.U.uNight.value : 0;
    const u = state && state.units;
    const UF = SQ.C.UF;
    U.frame++;
    for (let ci = 0; ci < U.civs.length; ci++) {
      const c = U.civs[ci];
      if (c.night && nightK > 0.6) continue;
      // step away from fights (checked every few frames)
      if (u && (ci + U.frame) % 6 === 0) {
        let fx = 0, fz = 0, hit = false;
        for (let i = 0; i < u.n; i++) {
          if (!(u.flags[i] & UF.COMBAT)) continue;
          const dx = c.x - u.x[i], dz = c.z - u.z[i];
          const d2 = dx * dx + dz * dz;
          if (d2 < 196) { fx += dx; fz += dz; hit = true; }
        }
        if (hit) { c.flee = 2.5; c.fx = fx; c.fz = fz; }
      }
      let speed = 0;
      if (c.sit) {
        if (c.flee > 0) { c.flee -= dt; }
      } else if (c.line) {
        if (c.flee > 0) {
          c.flee -= dt;
          const L = Math.hypot(c.fx, c.fz) || 1;
          const p = atS(c.line, c.s);
          if ((p.dx * c.fx + p.dz * c.fz) * c.dir < 0) c.dir = -c.dir; // turn away along the path
          speed = c.speed * 1.9;
          void L;
        } else speed = c.speed;
        c.s += c.dir * speed * dt;
        if (c.s < 0 || c.s > c.line.L) {
          const nxt = c.s < 0 ? c.line.next0 : c.line.next1;
          if (nxt.length) {
            const pick = nxt[Math.floor((c.seed * 997 + U.frame) % nxt.length)];
            c.line = pick.line; c.s = pick.s;
            c.dir = c.s < 1 ? 1 : c.s > c.line.L - 1 ? -1 : (Math.sin(U.frame + c.seed * 50) > 0 ? 1 : -1);
          } else { c.dir = -c.dir; c.s = Math.max(0, Math.min(c.line.L, c.s)); }
        }
        const p = atS(c.line, c.s);
        // keep to the right of the path centre line
        const nx = -p.dz * c.dir, nz = p.dx * c.dir;
        c.x = p.x + nx * c.off; c.z = p.z + nz * c.off;
        const want = Math.atan2(p.dx * c.dir, p.dz * c.dir);
        c.face += angDiff(c.face, want) * Math.min(1, dt * 6);
        c.phase += speed * dt * 4.2;
      }
      c.walk = speed > 0 ? Math.min(1, c.walk + dt * 4) : Math.max(0, c.walk - dt * 4);
      out.push(c);
    }
  }

  function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  // ================================================================== pigeons
  function makeFlock(x, z, r, n, ambient, id) {
    const f = { id, x, z, r, n, ambient, birds: [], lady: false };
    resetFlock(f);
    return f;
  }
  function resetFlock(f) {
    const r = rnd(SQ.util ? SQ.util.hash(String(f.id)) : 7);
    f.birds = [];
    for (let i = 0; i < f.n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * Math.min(6, f.r * 0.4);
      f.birds.push({ x: f.x + Math.cos(a) * d, z: f.z + Math.sin(a) * d, y: 0, tx: 0, tz: 0, fly: 0, face: r() * 6.28, seed: r(), hop: 0, t: r() * 5 });
    }
  }
  function updateFlocks(state, dt) {
    const u = state && state.units;
    const UF = SQ.C.UF;
    // director pigeon flocks / pigeon lady
    if (state && state.neutrals) {
      const seen = {};
      for (const nt of state.neutrals) {
        if (nt.dead) continue;
        if (nt.kind === 'pigeonFlock' || nt.kind === 'pigeonLady' || nt.kind === 'pigeons') {
          const id = 'n' + nt.id; seen[id] = 1;
          let f = U.flocks.find((q) => q.id === id);
          if (!f) {
            const lady = nt.kind === 'pigeonLady';
            f = makeFlock(nt.x, nt.z, nt.r || (lady ? 20 : 12), Math.min(lady ? 120 : 40, nt.n || (lady ? 90 : 26)), false, id);
            f.lady = lady;
            U.flocks.push(f);
          }
          f.x = nt.x; f.z = nt.z;
        }
      }
      U.flocks = U.flocks.filter((f) => f.ambient || seen[f.id]);
    }
    for (const f of U.flocks) {
      for (const b of f.birds) {
        b.t += dt;
        if (b.fly > 0) {
          const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
          const sp = 7.5;
          if (d < 0.4) { b.fly = 0; b.y = 0; continue; }
          b.x += dx / d * Math.min(d, sp * dt); b.z += dz / d * Math.min(d, sp * dt);
          b.face = Math.atan2(dx, dz);
          b.y = Math.min(b.y + dt * 6, 1.5 + Math.min(5, d * 0.35) + Math.sin(b.t * 3) * 0.3);
          if (d < 3) b.y = Math.max(0, b.y - dt * 5);
        } else {
          // peck & shuffle
          if (b.t > 1.5 + b.seed * 3) {
            b.t = 0;
            const a = (b.seed * 13 + b.x) % 6.283;
            b.hop = 0.25;
            b.face = a;
            let nx = b.x + Math.sin(a) * 0.35, nz = b.z + Math.cos(a) * 0.35;
            if (Math.hypot(nx - f.x, nz - f.z) > f.r * 0.7) { nx = b.x + (f.x - b.x) * 0.1; nz = b.z + (f.z - b.z) * 0.1; }
            b.x = nx; b.z = nz;
          }
          if (b.hop > 0) { b.hop -= dt; b.y = Math.sin((0.25 - b.hop) / 0.25 * Math.PI) * 0.08; } else b.y = 0;
          if (f.lady && Math.sin(b.t * 2 + b.seed * 40) > 0.995) startFly(b, f, f.x, f.z, 3);
        }
      }
      // threats: units walk into the flock (Pack scares from further away)
      if (u && (U.frame % 3 === 0)) {
        for (let i = 0; i < u.n; i++) {
          const animal = u.flags[i] & UF.ANIMAL;
          const R = animal ? 9 : 4.5;
          const dx = u.x[i] - f.x, dz = u.z[i] - f.z;
          if (dx * dx + dz * dz > (f.r + R) * (f.r + R)) continue;
          for (const b of f.birds) {
            if (b.fly > 0) continue;
            const ex = b.x - u.x[i], ez = b.z - u.z[i];
            if (ex * ex + ez * ez < R * R) startFly(b, f, u.x[i], u.z[i], animal ? 22 : 14);
          }
        }
      }
    }
  }
  function startFly(b, f, fromX, fromZ, dist) {
    // fly away from the threat, land back inside the flock's home circle
    let ax = b.x - fromX, az = b.z - fromZ; const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
    const jitter = (b.seed - 0.5) * 1.6;
    const ca = Math.cos(jitter), sa = Math.sin(jitter);
    const dx = ax * ca - az * sa, dz = ax * sa + az * ca;
    let tx = b.x + dx * dist, tz = b.z + dz * dist;
    const hx = tx - f.x, hz = tz - f.z, hd = Math.hypot(hx, hz), lim = f.r * 1.3 + 6;
    if (hd > lim) { tx = f.x + hx / hd * lim; tz = f.z + hz / hd * lim; }
    b.tx = tx; b.tz = tz; b.fly = 1; b.t = 0;
  }
  units.pigeonsScatter = function (x, z, r) {
    for (const f of U.flocks) for (const b of f.birds) if (!b.fly && (b.x - x) ** 2 + (b.z - z) ** 2 < r * r) startFly(b, f, x, z, 18);
  };

  // ================================================================== per-frame
  const civOut = [];
  const selCount = [0, 0, 0];
  function compose(x, y, z, yaw, s, sy, pitch, roll) {
    U.tmpE.set(pitch || 0, yaw, roll || 0, 'YXZ');
    U.tmpQ.setFromEuler(U.tmpE);
    U.tmpP.set(x, y, z); U.tmpS.set(s, s * (sy || 1), s);
    return U.tmpM.compose(U.tmpP, U.tmpQ, U.tmpS);
  }
  function gy(x, z) { return SQ.render && SQ.render.groundY ? SQ.render.groundY(x, z) : 0; }

  units.squashAt = function (x, z, r) { U.squash.push({ x, z, r: r || 14, t: 0 }); };

  units.renderPos = function (id) { const r = U.rec.get(id); return r ? { x: r.x, y: r.y, z: r.z } : null; };

  units.selectedFocus = function (state, alpha, out, max) {
    const sel = SQ.input && SQ.input.selected;
    if (!sel || !sel.size) return;
    let n = 0;
    for (const id of sel) {
      const r = U.rec.get(id);
      if (!r) continue;
      out.push({ x: r.x, z: r.z, r: 12 });
      if (++n >= max) break;
    }
  };

  units.update = function (state, alpha, dt, camera) {
    if (!U.root) return;
    shared.uTime.value += dt;
    const night = SQ.env && SQ.env.U ? SQ.env.U.uNight.value : 0;
    shared.uLift.value = 0.07 + night * 0.42;
    if (camera && SQ.render && SQ.render.size) {
      const h = SQ.render.size().h;
      const camH = camera.position.y;
      const k = 1 + 0.5 * Math.max(0, Math.min(1, (camH - 150) / 80)); // grow past 150 m
      const touch = SQ.input && SQ.input.isTouch ? 1.12 : 1;
      shared.uPx.value = (2 * Math.tan((camera.fov * Math.PI) / 360) / Math.max(1, h)) * k * touch;
    }
    for (const k in U.types) U.types[k].pool.begin();
    for (const p of [U.civ, U.squirrels, U.pigeons, U.piano, U.truck]) p.begin();
    U.rings.n = 0; U.glyphs.n = 0;
    for (const sq of U.squash) sq.t += dt;
    U.squash = U.squash.filter((s) => s.t < 0.5);

    if (state) drawUnits(state, alpha, dt, camera);
    drawNeutrals(state, alpha, dt);
    civOut.length = 0;
    updateCivilians(state, dt, civOut);
    for (const c of civOut) {
      const y = gy(c.x, c.z) + (c.sit ? -0.31 * c.h : 0) + (c.walk > 0.1 ? Math.abs(Math.sin(c.phase)) * 0.03 : 0);
      const k = U.civ.push(compose(c.x, y, c.z, c.face, c.h), c.phase, c.walk, c.sit ? ANIM.SIT : (c.walk > 0.1 ? ANIM.WALK : ANIM.IDLE), 0, c.seed, 0, 0, 0);
      U.civ.tint(k, c.shirt[0], c.shirt[1], c.shirt[2], c.pants);
    }
    updateFlocks(state, dt);
    for (const f of U.flocks) for (const b of f.birds) {
      U.pigeons.push(compose(b.x, gy(b.x, b.z) + b.y, b.z, b.face, 1.0), 0, b.fly ? 1 : 0, 0, 0, b.seed, 0, 0, 0);
    }

    for (const k in U.types) U.types[k].pool.end();
    for (const p of [U.civ, U.squirrels, U.pigeons, U.piano, U.truck]) p.end();
    U.rings.mesh.count = U.rings.n; U.glyphs.mesh.count = U.glyphs.n;
    if (U.rings.n) { U.rings.mesh.instanceMatrix.needsUpdate = true; U.rings.iCol.needsUpdate = true; U.rings.iRing.needsUpdate = true; }
    if (U.glyphs.n) { U.glyphs.mesh.instanceMatrix.needsUpdate = true; U.glyphs.iG.needsUpdate = true; U.glyphs.iG2.needsUpdate = true; }
  };

  function pushRing(x, y, z, size, col, sel, pattern, fade, enemy) {
    const R = U.rings; if (R.n >= R.cap) return;
    const k = R.n++;
    U.tmpM.makeScale(size, 1, size); U.tmpM.setPosition(x, y + 0.04, z);
    R.mesh.setMatrixAt(k, U.tmpM);
    R.iCol.array[k * 4] = Math.pow(col.r, 0.4545); R.iCol.array[k * 4 + 1] = Math.pow(col.g, 0.4545); R.iCol.array[k * 4 + 2] = Math.pow(col.b, 0.4545); R.iCol.array[k * 4 + 3] = sel ? 1 : 0;
    R.iRing.array[k * 4] = size; R.iRing.array[k * 4 + 1] = pattern; R.iRing.array[k * 4 + 2] = fade; R.iRing.array[k * 4 + 3] = enemy ? 1 : 0;
  }
  function pushGlyph(x, y, z, cls, col, hp, sel, chev, alpha) {
    const G = U.glyphs; if (G.n >= G.cap) return;
    const k = G.n++;
    U.tmpM.makeTranslation(x, y, z);
    G.mesh.setMatrixAt(k, U.tmpM);
    // glyph colour: sRGB-ish (shader output is not tone-mapped by ShaderMaterial defaults) -> use the linear colour lifted
    G.iG.array[k * 4] = cls; G.iG.array[k * 4 + 1] = Math.pow(col.r, 0.4545); G.iG.array[k * 4 + 2] = Math.pow(col.g, 0.4545); G.iG.array[k * 4 + 3] = Math.pow(col.b, 0.4545);
    G.iG2.array[k * 4] = hp; G.iG2.array[k * 4 + 1] = sel ? 1 : 0; G.iG2.array[k * 4 + 2] = chev; G.iG2.array[k * 4 + 3] = alpha;
  }

  const BEATS = { 0: 1, 1: 2, 2: 0 }; // crowd beats talker, talker beats heavy, heavy beats crowd
  function drawUnits(state, alpha, dt, camera) {
    const u = state.units, UF = SQ.C.UF;
    const sel = SQ.input && SQ.input.selected;
    const player = state.player;
    const frame = ++U.frame;
    const hitStop = SQ.game && SQ.game.hitStopping;
    // selection composition for counter chevrons
    selCount[0] = selCount[1] = selCount[2] = 0;
    let selCls = -1;
    if (sel && sel.size) {
      for (const id of sel) { const i = SQ.World.unitIndex(state, id); if (i >= 0) selCount[u.cls[i]]++; }
      let best = 0; for (let c = 0; c < 3; c++) if (selCount[c] > best) { best = selCount[c]; selCls = c; }
    }
    const camY = camera ? camera.position.y : 120;
    const showFar = camY > 150;
    for (let i = 0; i < u.n; i++) {
      const id = u.id[i];
      const T = U.types[u.type[i]] || ensureType(state, u.type[i]);
      if (!T) continue;
      let r = U.rec.get(id);
      const a = hitStop ? 0 : alpha;
      const x = u.px[i] + (u.x[i] - u.px[i]) * a;
      const z = u.pz[i] + (u.z[i] - u.pz[i]) * a;
      if (!r) {
        r = { x, z, y: 0, face: u.facing[i], phase: (id * 1.7) % 6.28, walk: 0, hp: u.hp[i], flash: 0, seed: ((id * 2654435761) >>> 0) / 4294967296, born: 0, frame };
        U.rec.set(id, r);
      }
      const mdx = x - r.x, mdz = z - r.z;
      const moved = Math.hypot(mdx, mdz);
      const spd = dt > 0 ? moved / dt : 0;
      r.x = x; r.z = z; r.frame = frame;
      const anim = u.anim[i];
      const flags = u.flags[i];
      const wantWalk = (anim === ANIM.WALK || anim === ANIM.OVERIT || spd > 0.6) ? Math.min(1, spd / 3 + 0.25) : 0;
      r.walk += (wantWalk - r.walk) * Math.min(1, dt * 8);
      if (!hitStop) r.phase += Math.min(spd, 9) * dt * (T.fkey === 'squirrels' ? 6 : 3.4);
      // face
      r.face += angDiff(r.face, u.facing[i]) * Math.min(1, dt * 10);
      // hit flash
      if (u.hp[i] < r.hp - 0.01) r.flash = 0.16;
      r.hp = u.hp[i];
      r.flash = Math.max(0, r.flash - dt);
      r.born = Math.min(1, r.born + dt * 3);
      const g = gy(x, z);
      // squash & bob
      let s = SCALE, sy = 1, pitch = 0, roll = 0, y = g;
      if (T.fkey === 'squirrels') s = 1;
      if (r.born < 1) { sy *= 0.6 + 0.4 * r.born; s *= 0.8 + 0.2 * r.born; }
      for (const sq of U.squash) {
        if ((x - sq.x) ** 2 + (z - sq.z) ** 2 < sq.r * sq.r) { const k = Math.sin(sq.t / 0.5 * Math.PI) * (1 - sq.t / 0.5); sy *= 1 - 0.35 * k; s *= 1 + 0.18 * k; }
      }
      if (r.walk > 0.05) y += Math.abs(Math.sin(r.phase)) * 0.05 * r.walk * (T.fkey === 'squirrels' ? 4 : 1);
      if (anim === ANIM.SIT) y -= 0.3 * s;
      if (anim === ANIM.ATTACK && u.hitT[i] < 0.3) pitch = 0.12 * (1 - u.hitT[i] / 0.3);
      if (anim === ANIM.FLINCH) roll = Math.sin(shared.uTime.value * 40 + r.seed * 10) * 0.12;
      if (anim === ANIM.CHEER) y += Math.abs(Math.sin(shared.uTime.value * 9 + r.seed * 6)) * 0.1;
      if (flags & UF.FROZEN && anim !== ANIM.SIT) roll = 0;
      r.y = y;
      const fade = (flags & UF.OVERIT) ? Math.min(0.95, u.fade[i]) : 0;
      const k = T.pool.push(compose(x, y, z, r.face, s, sy, pitch, roll), r.phase, r.walk, anim, fade, r.seed, 0, 0, Math.min(0.7, r.flash * 5));
      void k;
      // ring + glyph
      const col = factionColor(state, u.faction[i]);
      const isSel = !!(sel && sel.has(id));
      const enemy = u.faction[i] !== player;
      const fk = state.factions[u.faction[i]] ? state.factions[u.faction[i]].key : '';
      const pat = { hustle: 0, noise: 1, violets: 2, pack: 3 }[fk] || 0;
      const ringSize = T.ring * (T.fkey === 'squirrels' ? 1 : SCALE * 0.95);
      pushRing(x, g, z, ringSize, col, isSel, pat, fade, enemy);
      if (!(flags & UF.OVERIT) || fade < 0.3) {
        let chev = 0;
        if (selCls >= 0 && enemy && !(flags & UF.NEUTRAL)) {
          if (BEATS[selCls] === u.cls[i]) chev = 1; else if (BEATS[u.cls[i]] === selCls) chev = -1;
        }
        const hpf = u.maxHp[i] > 0 ? u.hp[i] / u.maxHp[i] : 1;
        const gyH = (T.fkey === 'squirrels' ? T.glyphY : T.glyphY * SCALE / 1.3) + (showFar ? 1.5 : 0);
        pushGlyph(x, y + gyH, z, T.clsIdx, col, (flags & UF.OVERIT) ? 0 : hpf, isSel, chev, (flags & UF.OVERIT) ? 0.5 * (1 - fade * 3) : (flags & UF.REGULAR ? 0.82 : 1));
      }
    }
    // forget units we haven't seen this frame
    if (frame % 30 === 0) U.rec.forEach((r, id) => { if (frame - r.frame > 30) U.rec.delete(id); });
  }

  const _civTint = { pep: [0.12, 0.2, 0.14, 0.12], tourist: null, graduate: [0.28, 0.1, 0.55, 0.25], pigeonLady: [0.45, 0.35, 0.42, 0.3], pianist: [0.05, 0.05, 0.06, 0.08] };
  const TOURIST = [[0.9, 0.3, 0.2], [0.2, 0.55, 0.95], [0.98, 0.85, 0.2], [0.3, 0.8, 0.5], [1, 1, 1], [0.95, 0.5, 0.75]];
  function drawNeutrals(state, alpha, dt) {
    if (!state || !state.neutrals) return;
    const t = shared.uTime.value;
    for (const nt of state.neutrals) {
      if (nt.static || nt.kind === 'dosa' || nt.kind === 'parkHouse') continue;
      if (nt.dead && !nt.shooed) continue;
      const px = nt.px !== undefined ? nt.px : nt.x, pz = nt.pz !== undefined ? nt.pz : nt.z;
      let x = px + (nt.x - px) * alpha, z = pz + (nt.z - pz) * alpha;
      let r = U.nrec.get(nt.id);
      if (!r) { r = { x, z, face: 0, phase: 0, walk: 0, seed: (SQ.util.hash(String(nt.id)) % 1000) / 1000, flee: 0 }; U.nrec.set(nt.id, r); }
      const sp = dt > 0 ? Math.hypot(x - r.x, z - r.z) / dt : 0;
      if (Math.hypot(x - r.x, z - r.z) > 0.01) r.face += angDiff(r.face, Math.atan2(x - r.x, z - r.z)) * Math.min(1, dt * 10);
      r.x = x; r.z = z;
      r.walk += ((sp > 0.3 ? 1 : 0) - r.walk) * Math.min(1, dt * 6);
      r.phase += Math.min(sp, 8) * dt * 4;
      const g = gy(x, z);
      const k = nt.kind;
      if (k === 'squirrel') {
        const hop = r.walk > 0.2 ? Math.abs(Math.sin(r.phase * 1.5)) * 0.35 : 0;
        // drawn larger than life (like the crews) so a heist reads from the strategy camera
        U.squirrels.push(compose(x, g + hop, z, r.face, 2.3), r.phase, r.walk, 0, nt.dead ? 0.6 : 0, r.seed, 0, 0, 0);
        // tappable squirrels get a pulsing gold ring; fleeing/shooed ones a faint brown one
        const live = !nt.dead && !nt.shooed && nt.state !== 'flee';
        if (live) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 6 + r.seed * 6.28);
          pushRing(x, g, z, 1.5 + pulse * 0.7, SQUIRREL_HOT, false, 0, 0, true);
          pushRing(x, g, z, 0.9, SQUIRREL_COL, false, 0, 0, true);
        } else pushRing(x, g, z, 0.9, SQUIRREL_COL, false, 0, 0, true);
      } else if (k === 'pigeonFlock' || k === 'pigeons') {
        // drawn by the flock system
      } else if (k === 'piano') {
        U.piano.push(compose(x, g, z, nt.face !== undefined ? nt.face : r.face, 1.0), 0, 0, 0, 0, 0, 0, 0, 0);
        const yaw = nt.face !== undefined ? nt.face : r.face;
        const bx = x - Math.sin(yaw) * 0.95, bz = z - Math.cos(yaw) * 0.95;
        const kk = U.civ.push(compose(bx, g - 0.22, bz, yaw, 1.0), t * 3, 0, ANIM.ATTACK, 0, r.seed, 0, 0, 0);
        const c = _civTint.pianist; U.civ.tint(kk, c[0], c[1], c[2], c[3]);
      } else if (k === 'truck' || k === 'iceCream' || k === 'iceCreamTruck') {
        U.truck.push(compose(x, g, z, nt.face !== undefined ? nt.face : r.face, 1.0), 0, 0, 0, 0, 0, 0, 0, 0);
      } else {
        // people-like neutrals: PEP, tourists, graduates, pigeon lady, others
        let tint = _civTint[k];
        if (!tint) { const c = TOURIST[Math.floor(r.seed * TOURIST.length)]; tint = [c[0], c[1], c[2], 0.3]; }
        const sit = k === 'pigeonLady';
        const kk = U.civ.push(compose(x, g - (sit ? 0.31 : 0), z, r.face, k === 'pep' ? 1.15 : 1.05), r.phase, r.walk, sit ? ANIM.SIT : r.walk > 0.2 ? ANIM.WALK : ANIM.IDLE, nt.fade || 0, r.seed, 0, 0, 0);
        U.civ.tint(kk, tint[0], tint[1], tint[2], tint[3]);
        if (k === 'pep') pushRing(x, g, z, 1.4, PEP_COL, false, 0, 0, true);
      }
    }
    if (U.frame % 60 === 0) {
      const live = new Set(state.neutrals.map((n) => n.id));
      U.nrec.forEach((v, id) => { if (!live.has(id)) U.nrec.delete(id); });
    }
  }
  const SQUIRREL_COL = new THREE.Color(0xb98a52).convertSRGBToLinear();
  const SQUIRREL_HOT = new THREE.Color(0xffd34d).convertSRGBToLinear();
  const PEP_COL = new THREE.Color(0x3fa06a).convertSRGBToLinear();

  // exposed for fx.js (zoomies dogs, drum circle drummers, piano)
  units.lib = { Builder, person, dog, squirrel, peopleMaterial, Pool, shared, buildType, shade, mixHex };
})(window.SQ = window.SQ || {});
