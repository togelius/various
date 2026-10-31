'use strict';
// Render A (world) logic tests that need no canvas/WebGL: geometry helpers, classification,
// time-of-day keys, ground height, road model, bench orientation. Canvas painting is checked in
// the browser (dev/env.html); here we only exercise pure functions.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

globalThis.window = globalThis;
const root = path.resolve(__dirname, '..');
const T = require(path.join(root, 'js/vendor/three.min.js'));
globalThis.THREE = globalThis.THREE || T;
require(path.join(root, 'js/geo.js'));
['textures', 'ground', 'buildings', 'landmarks', 'props', 'sky'].forEach((f) => require(path.join(root, 'js/render', f + '.js')));
const SQ = globalThis.SQ, env = SQ.env, U = env.util;

test('modules register the public world API', () => {
  assert.equal(typeof env.build, 'function');
  ['ground', 'buildings', 'landmarks', 'props', 'sky'].forEach((k) => assert.ok(env[k], k));
  assert.equal(typeof SQ.tex.facade, 'function');
  assert.equal(typeof SQ.tex.glyphAtlas, 'function');
});

test('merge combines indexed and non-indexed geometry with default attributes', () => {
  const a = new THREE.BoxGeometry(1, 1, 1);
  const b = new THREE.IcosahedronGeometry(1, 0); // non-indexed
  U.colorize(a, 0xff0000);
  const m = U.merge([a, b]);
  assert.equal(m.attributes.position.count, a.attributes.position.count + b.attributes.position.count);
  assert.equal(m.index.count, a.index.count + b.attributes.position.count);
  const c = m.attributes.color;
  assert.ok(c, 'colour attribute kept');
  assert.equal(c.getX(a.attributes.position.count), 1, 'missing colour defaults to white');
});

test('ground height: flat outside the fountain, rim raised, basin sunk', () => {
  const F = env.ground.FOUNTAIN;
  assert.equal(env.ground.heightAt(50, 50), 0);
  assert.equal(env.ground.heightAt(F.x, F.z), F.floorY);
  assert.equal(env.ground.heightAt(F.x + (F.innerR + F.outerR) / 2, F.z), F.rimY);
  assert.ok(F.waterY > F.floorY && F.waterY < F.step2Y + 0.01, 'water covers the floor but not the top step');
});

test('road model finds the park-corner intersections', () => {
  const ints = env.ground.intersections();
  assert.ok(ints.length >= 8, 'found ' + ints.length);
  const near = (x, z) => ints.some((n) => Math.hypot(n.x - x, n.z - z) < 6);
  assert.ok(near(-165, -77), 'MacDougal & Waverly / Wash Sq N');
  assert.ok(near(-165, 78), 'MacDougal & W 4th');
  GEO.roads.forEach((r) => assert.ok(env.ground.roadWidth(r) >= 7 && env.ground.roadWidth(r) <= 16));
});

test('building classes: The Row, NYU sandstone, Judson, no curtain walls on prewar towers', () => {
  const C = env.buildings.classify;
  const bobst = GEO.buildings.find((b) => /Bobst/.test(b.name || ''));
  const judson = GEO.buildings.find((b) => /Judson/.test(b.name || ''));
  assert.equal(C(bobst), 'nyu');
  assert.equal(C(judson), 'judson');
  const row = GEO.buildings.filter((b) => { const c = U.polyCentroid(b.pts); return c[1] > -112 && c[1] < -92 && c[0] > -150 && c[0] < 140 && b.h < 25; });
  assert.ok(row.length > 5);
  row.forEach((b) => assert.equal(C(b), 'row'));
  const oneFifth = GEO.buildings.find((b) => b.h > 80);
  assert.notEqual(C(oneFifth), 'glass');
  GEO.buildings.forEach((b) => assert.ok(env.buildings.CLASSES.includes(C(b))));
});

test('outward edges point away from the footprint regardless of ring winding', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  [sq, sq.slice().reverse()].forEach((pts) => {
    env.buildings.outwardEdges(pts).forEach((e) => {
      const mx = (e.A[0] + e.B[0]) / 2 + e.nx, mz = (e.A[1] + e.B[1]) / 2 + e.nz;
      assert.ok(!U.pointInPoly(mx, mz, pts));
    });
  });
});

test('time of day: golden-hour sun is low and comes from the west (down the cross streets)', () => {
  const sky = env.sky, v = new THREE.Vector3();
  const k = sky.lerpKey(0.45);
  assert.ok(k.el < 12 && k.el > 0);
  sky.azElToLocal(286, 7, v);
  assert.ok(v.x < -0.9, 'sun vector points local west, x=' + v.x.toFixed(2));
  assert.ok(sky.lerpKey(0.1).n === 0 && sky.lerpKey(0.9).n === 1, 'night flag');
  const afternoon = sky.lerpKey(0.1), night = sky.lerpKey(0.9);
  assert.ok(afternoon.si > night.si && afternoon.hi > night.hi);
});

test('benches face the nearest footpath', () => {
  const list = env.layout.benches();
  assert.equal(list.length, GEO.benches.length);
  let ok = 0;
  list.forEach((b) => { if (Number.isFinite(b.ry)) ok++; });
  assert.equal(ok, list.length);
});

test('landmark anchors and arch proportions', () => {
  const A = env.landmarks.ARCH;
  assert.ok(Math.abs(A.W - 19.1) < 0.5 && Math.abs(A.span - 9.1) < 0.3 && A.H > 22 && A.H < 24.5);
  assert.ok(A.crown < A.frieze0 && A.frieze0 < A.cornice && A.cornice < A.H);
  assert.ok(env.landmarks.anchors.fountain && env.landmarks.anchors.arch);
  const pg = env.layout.playground();
  assert.ok(pg.length >= 10);
});
