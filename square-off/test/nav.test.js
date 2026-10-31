'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQload, makeMatch, spawn, alive, run } = require('./helpers.js');
const SQ = SQload();

const grid = SQ.nav.get(globalThis.GEO);
const ALL = SQ.data.landmarks.concat(SQ.data.homes);

test('nav grid covers the park at 1 m and builds fast', () => {
  assert.equal(grid.w, 370);
  assert.equal(grid.h, 240);
  const t0 = Date.now();
  SQ.nav.build(globalThis.GEO);
  assert.ok(Date.now() - t0 < 3000, 'build under 3 s');
  // terrain samples from the real park
  assert.equal(grid.sample(0, 0), 'water', 'fountain basin is water');
  assert.equal(grid.sample(-57, 46), 'blocked', 'Park House is a building');
  assert.equal(grid.sample(-6, -54), 'blocked', 'Arch west pier blocks');
  assert.ok(grid.walkable(0, -54), 'the archway between the piers is open');
  assert.equal(grid.sample(-120, -20), 'lawn', 'west lawns are lawn');
  assert.ok(grid.walkable(-12, 0), 'fountain plaza walkable');
});

test('every landmark is reachable from every Home Spot', () => {
  for (const h of SQ.data.homes) {
    for (const L of ALL) {
      const f = grid.registerField('test:' + L.id, L.x, L.z);
      const p = grid.nearestWalkable(h.x, h.z, 10);
      assert.ok(p, 'home ' + h.id + ' has walkable ground');
      const d = grid.distance(f, p.x, p.z);
      assert.ok(d < Infinity, `${L.id} reachable from ${h.id}`);
      const euclid = Math.hypot(L.x - h.x, L.z - h.z);
      assert.ok(d < euclid * 1.9 + 40, `${h.id}->${L.id} path is sane (${d.toFixed(0)} vs ${euclid.toFixed(0)})`);
    }
  }
});

test('build pads are walkable, reachable and inside their rings', () => {
  for (const L of ALL) {
    const f = grid.registerField('test:' + L.id, L.x, L.z);
    for (const [x, z] of L.pads) {
      assert.ok(grid.walkable(x, z), `${L.id} pad ${x},${z} walkable`);
      assert.ok(grid.distance(f, x, z) < Infinity, `${L.id} pad reachable`);
      if (L.poly) assert.ok(SQ.util.pointInPoly(x, z, L.poly), `${L.id} pad inside fence`);
      else assert.ok(Math.hypot(x - L.x, z - L.z) <= L.r, `${L.id} pad inside ring`);
    }
  }
  assert.equal(SQ.data.landmarkById.chess.pads.length, 4);
  for (const h of SQ.data.homes) assert.equal(h.pads.length, 3);
});

test('fenced dog runs are entered through gates, not through the fence', () => {
  const big = SQ.data.landmarkById.bigrun, small = SQ.data.landmarkById.smallrun;
  const fBig = grid.registerField('test:bigrun', big.x, big.z);
  const fSmall = grid.registerField('test:smallrun', small.x, small.z);
  // just outside the south-east fence of the big run: must walk round to a gate
  const outside = grid.nearestWalkable(-60, 47.5, 3) || grid.nearestWalkable(-30, 60, 3);
  assert.ok(grid.distance(fBig, outside.x, outside.z) > 8, 'big run fence blocks a straight walk-in');
  assert.ok(grid.gates.filter((g) => /Big Dog Run/.test(g.name)).length === 2, 'big run has 2 gates');
  assert.ok(grid.gates.some((g) => Math.hypot(g.x - 30.2, g.z - 58.2) < 1.5), 'small run gate found in the barrier gap');
  const p = grid.nearestWalkable(28, 52, 3);
  assert.ok(grid.distance(fSmall, p.x, p.z) < 30, 'small run reachable from Kempner side');
});

test('A* finds smoothed paths that avoid buildings', () => {
  const path = grid.astar(-80, 46, -34, 46); // straight line runs through the Park House
  assert.ok(path && path.length >= 2, 'path found and bends around the building');
  let px = -80, pz = 46;
  for (const [x, z] of path) { assert.ok(grid.los(px, pz, x, z), 'each leg is in line of sight'); px = x; pz = z; }
  assert.equal(grid.astar(-57, 46, 0, 0) === null, false, 'start inside a building snaps out');
});

test('units actually walk from each Home Spot into far landmarks', () => {
  const pairs = [['home_nw', 'bobst'], ['home_se', 'grove'], ['home_sw', 'smallrun'], ['home_ne', 'bigrun'], ['home_ne', 'playground'], ['home_sw', 'judson']];
  for (const [h, id] of pairs) {
    const m = makeMatch(SQ, { startUnits: [], players: [{ faction: 'violets', ai: false, home: h }, { faction: 'pack', ai: false, home: h === 'home_nw' ? 'home_se' : 'home_nw' }] });
    const H = m.state.lmById[h];
    const ids = spawn(SQ, m, 0, 'violets.crowd', H.x, H.z, 3);
    assert.ok(SQ.cmd.order(m, 0, ids, { type: 'take', lm: id }).ok);
    const lm = m.state.lmById[id];
    const inside = () => alive(SQ, m, ids).every((uid) => { const i = SQ.World.unitIndex(m.state, uid); return SQ.World.inRing(lm, m.state.units.x[i], m.state.units.z[i]); });
    assert.ok(run(m, 150, inside), `${h} -> ${id}: units arrive inside the ring`);
  }
});
