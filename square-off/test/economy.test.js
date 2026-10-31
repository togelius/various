'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQload, makeMatch, spawn, run } = require('./helpers.js');
const SQ = SQload();

function own(m, f, ids) { for (const id of ids) { const lm = m.state.lmById[id]; lm.owner = f; lm.meter = 100; } }

test('start: 150 Clout, Home Spot +1.5/s, pop cap 20, crew meter 30', () => {
  const m = makeMatch(SQ, {});
  run(m, 1);
  const f = m.state.factions[0];
  assert.ok(Math.abs(f.income - 1.5) < 1e-9);
  assert.ok(Math.abs(f.clout - 151.5) < 0.06);
  assert.equal(f.popCap, 20);
  assert.ok(f.crew > 30 && f.crew < 31);
  assert.equal(f.pop, 5, '2 crowd pairs + 1 talker to start');
});

test('income pacing: early game 3-5/s, strong mid-game 9-13/s', () => {
  const m = makeMatch(SQ, {});
  own(m, 0, ['grove', 'holley']);
  run(m, 0.1);
  const early = m.state.factions[0].income;
  assert.ok(early >= 3 && early <= 5, 'early ' + early);
  own(m, 0, ['fountain', 'arch']);
  m.state.factions[0].clout = 1000;
  for (const id of ['fountain', 'arch']) assert.ok(SQ.cmd.build(m, 0, id, -1, 'cart').ok);
  run(m, 7);
  const mid = m.state.factions[0].income;
  assert.ok(mid >= 9 && mid <= 13.5, 'mid ' + mid);
});

test('turf pacing: 7 Turf/s from 2:00 reaches 1500 around 5:30; Fountain is worth 2', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  run(m, 120);
  own(m, 0, ['fountain', 'arch', 'chess', 'grove', 'holley', 'judson']);
  own(m, 1, ['garibaldi', 'bobst', 'smallrun', 'playground', 'bigrun']);
  run(m, 0.05);
  assert.equal(m.state.factions[0].turfRate, 7);
  assert.equal(m.state.factions[1].turfRate, 5);
  let won = null;
  m.bus.on('victory', (p) => { won = p; });
  run(m, 400, () => !!won);
  assert.ok(won && won.winner === 0 && won.reason === 'turf');
  assert.ok(m.state.t > 320 && m.state.t < 345, 'about 5:30, got ' + m.state.t.toFixed(0));
});

test('phases re-value the map: dog runs x1.5 afternoon, fountain x1.5 golden, Arch 2 Turf at night', () => {
  const m = makeMatch(SQ, { startUnits: [], turfTarget: 99999 });
  own(m, 0, ['bigrun', 'fountain', 'arch', 'playground']);
  const warns = [], phases = [];
  m.bus.on('phaseWarn', (p) => warns.push(p));
  m.bus.on('phase', (p) => phases.push(p.phase));
  run(m, 1);
  const L = m.state.lmById;
  assert.equal(L.bigrun.cloutRate, 3);
  run(m, 200);
  assert.equal(m.state.phase, 'golden');
  assert.equal(L.fountain.cloutRate, 4.5);
  assert.equal(L.playground.cloutRate, 0.75);
  assert.equal(L.bigrun.cloutRate, 2);
  run(m, 200);
  assert.equal(m.state.phase, 'night');
  assert.equal(L.arch.turfRate, 2);
  assert.deepEqual(phases, ['golden', 'night']);
  assert.equal(warns.length, 2);
  assert.ok(Math.abs(warns[0].in - 20) < 0.06, 'warned 20 s ahead');
});

test('recruiting: costs, queue, pop, discounts and comeback', () => {
  const m = makeMatch(SQ, {});
  const s = m.state;
  const f = s.factions[0];
  f.clout = 1000;
  assert.equal(SQ.Economy.recruitCost(s, 0, 'talker'), 55);
  own(m, 0, ['chess', 'bigrun']);
  run(m, 0.05);
  assert.equal(SQ.Economy.recruitCost(s, 0, 'talker'), Math.round(55 * 0.85), 'Chess Plaza: ▲ -15%');
  assert.equal(SQ.Economy.recruitCost(s, 0, 'crowd'), Math.round(40 * 0.9), 'Big Run: ● -10%');
  f.turf = 0; s.factions[1].turf = 300;
  run(m, 0.05);
  assert.ok(f.behind, 'Word of Mouth');
  assert.equal(SQ.Economy.recruitCost(s, 0, 'heavy'), Math.round(95 * 0.8));
  const recruited = [];
  m.bus.on('recruited', (p) => recruited.push(p));
  for (let k = 0; k < 5; k++) assert.ok(SQ.cmd.recruit(m, 0, 'crowd').ok);
  assert.equal(SQ.cmd.recruit(m, 0, 'crowd').reason, 'queue', 'queue holds 5');
  run(m, 6.1);
  assert.equal(recruited.length, 1, 'a ● pair takes 6 s');
  assert.equal(recruited[0].ids.length, 2);
  // pop cap
  const m2 = makeMatch(SQ, {});
  m2.state.factions[0].clout = 5000;
  let ok = 0;
  for (let k = 0; k < 20; k++) if (SQ.cmd.recruit(m2, 0, 'heavy').ok) ok++;
  assert.ok(ok <= 5, 'queue/pop limited');
  run(m2, 60);
  const r = SQ.cmd.recruit(m2, 0, 'heavy');
  assert.ok(m2.state.factions[0].pop <= 20);
  if (!r.ok) assert.ok(['pop', 'queue'].includes(r.reason));
});

test('Bobst Gate: recruit time -25%; Small Run +6 pop; Bench Cluster +4 pop', () => {
  const m = makeMatch(SQ, {});
  const s = m.state;
  own(m, 0, ['bobst', 'smallrun']);
  s.factions[0].clout = 1000;
  run(m, 0.05);
  assert.equal(SQ.Economy.recruitTime(s, 0, 'heavy'), 11 * 0.75);
  assert.equal(s.factions[0].popCap, 20 + 4 + 6);
  assert.ok(SQ.cmd.build(m, 0, 'bobst', 0, 'bench').ok);
  run(m, 6.1);
  assert.equal(s.factions[0].popCap, 34);
});

test('Rally point: home, held landmark within 90 m of home (Violets: any held)', () => {
  const m = makeMatch(SQ, { players: [{ faction: 'hustle', ai: false }, { faction: 'violets', ai: false }] });
  own(m, 0, ['grove', 'bobst']);
  own(m, 1, ['grove'].length ? ['chess'] : []);
  assert.ok(SQ.cmd.setRally(m, 0, 'grove').ok);
  assert.equal(SQ.cmd.setRally(m, 0, 'bobst').ok, false, 'too far from NW home');
  assert.equal(SQ.cmd.setRally(m, 0, 'fountain').ok, false, 'not held');
  assert.ok(SQ.cmd.setRally(m, 1, 'chess').ok, 'Violets rally anywhere they hold');
  m.state.factions[0].clout = 500;
  SQ.cmd.recruit(m, 0, 'talker');
  let at = null;
  m.bus.on('recruited', (p) => { at = p.lm; });
  run(m, 7.1);
  assert.equal(at, 'grove');
});

test('Setups: build takes 6 s, specials only for their crew, carts pay +1/s', () => {
  const m = makeMatch(SQ, {});
  const s = m.state;
  own(m, 0, ['arch']);
  s.factions[0].clout = 1000;
  assert.equal(SQ.cmd.build(m, 0, 'arch', 0, 'waterBowl').ok, false, 'Pack special');
  assert.equal(SQ.cmd.build(m, 0, 'fountain', 0, 'cart').ok, false, 'not owned');
  run(m, 0.05);
  const inc0 = s.factions[0].income;
  assert.ok(SQ.cmd.build(m, 0, 'arch', 0, 'cart').ok);
  assert.equal(SQ.cmd.build(m, 0, 'arch', 0, 'boombox').ok, false, 'pad taken');
  const opts = SQ.Economy.buildOptions(s, 0, 'arch');
  assert.ok(opts.some((o) => o.id === 'chessTable'));
  run(m, 5.9);
  assert.equal(s.setups[0].done, false);
  run(m, 0.2);
  assert.equal(s.setups[0].done, true);
  assert.ok(Math.abs(s.factions[0].income - inc0 - 1) < 1e-9);
  assert.ok(SQ.cmd.build(m, 0, 'home_nw', -1, 'boombox').ok, 'Home Spots have pads');
});

test('Crew Call meter: +0.4/s base, +0.15/s per landmark, Judson +25%', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  own(m, 0, ['judson', 'grove']);
  run(m, 0.05);
  assert.ok(Math.abs(m.state.factions[0].crewRate - (0.4 + 0.3) * 1.25) < 1e-9);
  assert.ok(Math.abs(m.state.factions[1].crewRate - 0.4) < 1e-9);
});
