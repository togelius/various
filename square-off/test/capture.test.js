'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQload, makeMatch, spawn, run } = require('./helpers.js');
const SQ = SQload();

function timeToCapture(fac, typeKey, n, lmId, setup) {
  const m = makeMatch(SQ, { startUnits: [], players: [{ faction: fac, ai: false }, { faction: fac === 'pack' ? 'hustle' : 'pack', ai: false }] });
  const lm = m.state.lmById[lmId || 'fountain'];
  if (setup) setup(m, lm);
  const slot = SQ.Movement.landmarkSlot(m.state, lm, 3);
  spawn(SQ, m, 0, typeKey, slot.x, slot.z, n);
  let t = 0;
  while (lm.owner !== 0 && t < 60) { m.tick(); t += 0.05; }
  return { t, m, lm };
}

test('capture timing: 1 unit ≈ 8 s, 3 units ≈ 4.3 s, weight 4 caps at ≈ 3.5 s', () => {
  const near = (a, b, eps) => Math.abs(a - b) <= eps;
  assert.ok(near(timeToCapture('hustle', 'hustle.crowd', 1).t, 8, 0.15));
  assert.ok(near(timeToCapture('hustle', 'hustle.crowd', 3).t, 4.15, 0.2));
  assert.ok(near(timeToCapture('hustle', 'hustle.crowd', 4).t, 3.5, 0.15));
  assert.ok(near(timeToCapture('hustle', 'hustle.crowd', 8).t, 3.5, 0.15), 'capped at weight 4');
  assert.ok(near(timeToCapture('hustle', 'hustle.heavy', 1).t, 100 / (12.5 * Math.pow(2, 0.6)), 0.15), 'heavy weighs 2');
  assert.ok(near(timeToCapture('violets', 'violets.crowd', 1).t, 8 / 1.25, 0.15), 'Violets Group Project +25%');
});

test('capture rate formula matches DESIGN §3.2', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  for (const w of [1, 2, 3, 4, 6]) {
    assert.ok(Math.abs(SQ.Capture.captureRate(m.state, 0, w, null) - 12.5 * Math.pow(Math.min(4, w), 0.6)) < 1e-9);
  }
});

test('enemy landmark must be drained to neutral first; flip bonus +25; setups flip', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const lm = s.lmById.garibaldi;
  lm.owner = 1; lm.meter = 100; lm.heldSince = 0;
  s.factions[1].clout = 500;
  assert.ok(SQ.cmd.build(m, 1, 'garibaldi', 0, 'cart').ok);
  run(m, 7);
  assert.ok(s.setups[0].done && s.setups[0].owner === 1);
  const events = [];
  m.bus.on('neutral', (p) => events.push(['neutral', p]));
  m.bus.on('capture', (p) => events.push(['capture', p]));
  const slot = SQ.Movement.landmarkSlot(s, lm, 2);
  spawn(SQ, m, 0, 'hustle.crowd', slot.x, slot.z, 1);
  const c0 = s.factions[0].clout;
  run(m, 8.2);
  assert.equal(lm.owner, -1, 'drained to neutral after ~8 s');
  assert.equal(events[0][0], 'neutral');
  run(m, 8.2);
  assert.equal(lm.owner, 0, 'then filled');
  assert.equal(events[1][0], 'capture');
  assert.equal(events[1][1].from, 1);
  assert.equal(events[1][1].to, 0);
  assert.ok(/GARIBALDI/.test(events[1][1].title));
  assert.equal(s.setups[0].owner, 0, 'the Food Cart flipped to the capturer');
  assert.ok(s.factions[0].clout - c0 >= 25, 'flip bonus');
});

test('two factions inside: meter freezes and CONTESTED fires', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const lm = s.lmById.holley;
  let contested = 0;
  m.bus.on('contested', () => contested++);
  const a = SQ.Movement.landmarkSlot(s, lm, 1), b = SQ.Movement.landmarkSlot(s, lm, 9);
  spawn(SQ, m, 0, 'hustle.crowd', a.x, a.z, 1);
  run(m, 3);
  const meter = lm.meter;
  assert.ok(meter > 30 && lm.capBy === 0);
  spawn(SQ, m, 1, 'pack.heavy', b.x, b.z, 1);
  // keep them from fighting: PEP-style truce zone over the ring
  SQ.World.addZone(s, { kind: 'test', x: lm.x, z: lm.z, r: 30, noAttack: true });
  run(m, 2);
  assert.ok(lm.contested);
  assert.ok(contested >= 1);
  assert.ok(Math.abs(lm.meter - meter) < 1e-9, 'frozen');
});

test('fenced dog run: only units inside the fence capture', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const lm = s.lmById.bigrun;
  const out = s.nav.nearestWalkable(-38, 50, 3); // just outside the NE fence, inside the nominal radius
  assert.ok(Math.hypot(out.x - lm.x, out.z - lm.z) < 24 && !SQ.util.pointInPoly(out.x, out.z, lm.poly), 'next to the run...');
  spawn(SQ, m, 0, 'hustle.crowd', out.x, out.z, 1);
  run(m, 3);
  assert.equal(lm.meter, 0, '...but outside the fence polygon: no capture');
});

test('regulars: an owned landmark spawns a free ● every 40 s, max 2', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const lm = s.lmById.judson;
  lm.owner = 0; lm.meter = 100;
  let regs = 0;
  m.bus.on('regular', (p) => { if (p.lm === 'judson') regs++; });
  run(m, 39);
  assert.equal(regs, 0);
  run(m, 2);
  assert.equal(regs, 1);
  run(m, 100);
  assert.equal(regs, 2, 'capped at 2');
  const u = s.units;
  let guards = 0;
  for (let i = 0; i < u.n; i++) if (u.flags[i] & SQ.C.UF.REGULAR) { guards++; assert.ok(SQ.World.inRing(lm, u.x[i], u.z[i]), 'guards stay in the ring'); }
  assert.equal(guards, 2);
});

test('Chess Table: enemies capture its landmark at x0.6', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const lm = s.lmById.chess;
  lm.owner = 0; lm.meter = 100;
  s.factions[0].clout = 1000;
  assert.ok(SQ.cmd.build(m, 0, 'chess', -1, 'chessTable').ok);
  assert.equal(SQ.cmd.build(m, 0, 'chess', -1, 'chessTable').ok, false, 'one special per landmark');
  run(m, 6.5);
  const r = SQ.Capture.captureRate(s, 1, 1, lm);
  assert.ok(Math.abs(r - 12.5 * 0.6) < 1e-9);
});
