'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQload, makeMatch, spawn, alive, run } = require('./helpers.js');
const SQ = SQload();
const U = SQ.data.units;

function fight(fa, ca, na, fb, cb, nb, seed) {
  const m = makeMatch(SQ, { seed: seed || 1, startUnits: [], players: [{ faction: fa, ai: false }, { faction: fb, ai: false }] });
  const A = spawn(SQ, m, 0, fa + '.' + ca, -30, -20, na);
  const B = spawn(SQ, m, 1, fb + '.' + cb, 30, -20, nb);
  SQ.cmd.order(m, 0, A, { type: 'attackMove', x: 30, z: -20 });
  SQ.cmd.order(m, 1, B, { type: 'attackMove', x: -30, z: -20 });
  run(m, 90, () => !alive(SQ, m, A).length || !alive(SQ, m, B).length);
  return { a: alive(SQ, m, A).length, b: alive(SQ, m, B).length, m };
}

test('counter cycle multipliers: ● > ▲ > ■ > ●, x1.5 / x0.7 / x1.0', () => {
  const C = SQ.data.counter;
  assert.equal(C.crowd.talker, 1.5); assert.equal(C.talker.heavy, 1.5); assert.equal(C.heavy.crowd, 1.5);
  assert.equal(C.talker.crowd, 0.7); assert.equal(C.heavy.talker, 0.7); assert.equal(C.crowd.heavy, 0.7);
  for (const c of SQ.C.CLASSES) assert.equal(C[c][c], 1);
  assert.equal(SQ.Combat.counterMult(U.pack.crowd, U.squirrels.crowd), 1, 'neutrals take x1.0');
  assert.equal(SQ.data.weakTo.heavy, 'talker');
});

test('faction stats stay within ±20% of the class template', () => {
  const T = SQ.data.unitTemplate;
  for (const f of SQ.C.FACTIONS) {
    for (const c of SQ.C.CLASSES) {
      const t = U[f][c];
      for (const k of ['cost', 'hp', 'sway', 'speed']) {
        const r = t[k] / T[c][k];
        assert.ok(r >= 0.79 && r <= 1.29, `${f}.${c}.${k} ratio ${r.toFixed(2)}`);
      }
    }
  }
  // headline numbers from DESIGN §2.2
  assert.equal(U.violets.crowd.cost, 32);
  assert.equal(U.violets.talker.range, 14);
  assert.equal(U.pack.crowd.speed, 5.8);
  assert.equal(U.hustle.heavy.hp, 240);
});

test('sway math: hit damage = Sway x interval x counter x modifiers', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const [a] = spawn(SQ, m, 0, 'hustle.talker', 0, -25);
  const [b] = spawn(SQ, m, 1, 'pack.heavy', 8, -25);
  const s = m.state;
  const ia = SQ.World.unitIndex(s, a), ib = SQ.World.unitIndex(s, b);
  SQ.Abilities.prepass(m, 0.05);
  assert.equal(SQ.Combat.swayAgainst(s, ia, ib), 10 * 1.5, 'Speed Hustler vs heavy: 10 x 1.5');
  assert.equal(SQ.Combat.swayAgainst(s, ib, ia), 9 * 0.7, 'Pro Dog Walker vs talker: 9 x 0.7');
  // Debate Team: +40% vs other talkers
  const [c] = spawn(SQ, m, 0, 'violets.talker', 0, -30);
  const [d] = spawn(SQ, m, 1, 'pack.talker', 6, -30);
  SQ.Abilities.prepass(m, 0.05);
  assert.ok(Math.abs(SQ.Combat.swayAgainst(s, SQ.World.unitIndex(s, c), SQ.World.unitIndex(s, d)) - 9 * 1.4) < 1e-9);
});

test('equal-cost fights follow the triangle for every crew pairing', () => {
  for (const a of SQ.C.FACTIONS) {
    for (const b of SQ.C.FACTIONS) {
      if (a === b) continue;
      const r1 = fight(a, 'heavy', 2, b, 'crowd', 10);   // ~190 vs ~200 Clout
      assert.ok(r1.a > 0 && r1.b === 0, `${a} ■ beats ${b} ●`);
      const r2 = fight(a, 'talker', 6, b, 'heavy', 3);   // ~340 vs ~290 Clout
      assert.ok(r2.a > 0 && r2.b === 0, `${a} ▲ beats ${b} ■`);
      const nCrowd = a === 'violets' ? 10 : 8;           // ~160 Clout of crowd vs 3 talkers (~170)
      const r3 = fight(a, 'crowd', nCrowd, b, 'talker', 3);
      assert.ok(r3.b === 0 || r3.a >= r3.b, `${a} ● beats ${b} ▲ (${r3.a} vs ${r3.b})`);
    }
  }
});

test('Over It: untargetable, walks out, Grudge refunds 25%, crew meter +5 for the attacker', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const [v] = spawn(SQ, m, 1, 'pack.talker', 0, 30);
  spawn(SQ, m, 0, 'hustle.crowd', 1, 30, 1);
  const before = s.factions[1].clout, crew0 = s.factions[0].crew;
  let overIt = null;
  m.bus.on('overIt', (p) => { overIt = p; });
  const iv = SQ.World.unitIndex(s, v);
  SQ.Combat.damage(m, iv, 1000, 0, 'test');
  assert.ok(overIt && overIt.unit === v && typeof overIt.line === 'string' && overIt.line.length > 3);
  assert.ok(s.units.flags[iv] & SQ.C.UF.OVERIT);
  assert.equal(s.factions[1].clout - before, 60 * 0.25, 'Grudge is 25% of cost');
  assert.equal(s.factions[0].crew - crew0, 5);
  let removed = false;
  m.bus.on('removed', (p) => { if (p.unit === v) removed = true; });
  run(m, 40, () => removed);
  assert.ok(removed, 'faded out at the street');
});

test('regen 2/s only after 5 s out of combat', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const [a] = spawn(SQ, m, 0, 'hustle.heavy', -100, -20);
  const i = SQ.World.unitIndex(s, a);
  s.units.hp[i] = 100; s.units.combatT[i] = 0;
  run(m, 4);
  assert.ok(s.units.hp[SQ.World.unitIndex(s, a)] < 100.5, 'no regen during the delay');
  run(m, 3);
  const hp = s.units.hp[SQ.World.unitIndex(s, a)];
  assert.ok(hp > 101 && hp < 106, 'about 2/s after the delay: ' + hp);
});

test('Hustle Side Bets pays +5 when an enemy goes Over It near a Hustle unit', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  spawn(SQ, m, 0, 'hustle.talker', 10, 30);
  const [v] = spawn(SQ, m, 1, 'pack.crowd', 15, 30);
  const c0 = s.factions[0].clout;
  SQ.Combat.damage(m, SQ.World.unitIndex(s, v), 999, 0, 'test');
  assert.equal(s.factions[0].clout - c0, 5);
});

test('perks: Old Head ignores slows and knockback; Kibitzers cut adjacent Sway', () => {
  const m = makeMatch(SQ, { startUnits: [] });
  const s = m.state;
  const [old] = spawn(SQ, m, 0, 'hustle.heavy', -100, -20);
  const io = SQ.World.unitIndex(s, old);
  const x0 = s.units.x[io];
  assert.equal(SQ.Movement.knock(s, io, 1, 0, 3), false);
  assert.equal(s.units.x[io], x0);
  const [dog] = spawn(SQ, m, 1, 'pack.heavy', -100, -15);
  spawn(SQ, m, 0, 'hustle.crowd', -100.5, -15.5, 3);
  SQ.Abilities.prepass(m, 0.05);
  const id = SQ.World.unitIndex(s, dog);
  assert.equal(s.units.advice[id], 3);
  const sw = SQ.Combat.swayAgainst(s, id, io);
  assert.ok(Math.abs(sw - 9 * 1.0 * 0.7) < 1e-9, 'three Kibitzers: -30% (max)');
});
