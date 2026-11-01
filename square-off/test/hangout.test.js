'use strict';
// "Hang Out" rules, AI, scenarios and the lab (DESIGN-V2.md). Headless.
const test = require('node:test');
const assert = require('node:assert/strict');
const { SQload } = require('./helpers.js');
const SQ = SQload();
const H = SQ.Hangout;
const D = SQ.data.hangout;

const HUMANS = [{ crew: 'hustle', ai: false }, { crew: 'pack', ai: false }];
function make(opts) { return H.create(Object.assign({ seed: 1, quiet: true, players: HUMANS, ai: false }, opts || {})); }
function run(m, seconds, until) {
  const n = Math.round(seconds / H.DT);
  for (let k = 0; k < n && !m.state.over; k++) { m.tick(); if (until && until()) return true; }
  return until ? !!until() : true;
}
function spot(m, id) { return m.state.spots.find((s) => s.id === id); }
function events(m) { const log = []; m.bus.on('*', (p, name) => log.push({ name, p, t: m.state.t })); return log; }

test('the park layout: five spots, walkable standing places, both entrances reach everything', () => {
  const m = make();
  const st = m.state;
  assert.deepEqual(st.spots.map((s) => s.id), ['toddler', 'holley', 'fountain', 'garibaldi', 'smallrun']);
  assert.equal(st.groups.length, 6);
  for (const s of st.spots) {
    for (const row of s.slots) for (const p of row) {
      assert.ok(st.nav.walkable(p.x, p.z), `${s.id} standing place walkable`);
      assert.ok(H.inSpot(s, p.x, p.z), `${s.id} standing place inside the spot`);
    }
    for (const g of st.groups) assert.ok(H.eta(m, g, s.idx) < 60, `${g.name} reaches ${s.id}`);
  }
  for (const g of st.groups) {
    assert.ok(st.nav.walkable(g.x, g.z), 'groups start on walkable ground');
    assert.equal(g.patience, D.rules.patienceMax);
    assert.equal(g.offsets.length, g.members);
  }
});

test('mirror-ish walking times: the Fountain is a dead heat, each crew has one near spot', () => {
  const lab = require('../tools/hangout-lab.js');
  const t = lab.travel(SQ, { layout: 'park' });
  const N = t.entrances.north, S = t.entrances.south;
  assert.ok(Math.abs(N.fountain - S.fountain) <= 0.5, `fountain ${N.fountain} vs ${S.fountain}`);
  assert.ok(Math.abs(N.holley - S.holley) < 4 && Math.abs(N.garibaldi - S.garibaldi) < 4, 'Holley and Garibaldi are about equally far');
  assert.ok(N.toddler + 15 < S.toddler && S.smallrun + 15 < N.smallrun, 'the Toddler Playground is north\'s, the Small Dog Run south\'s');
  for (const a of Object.keys(t.spots)) for (const b of Object.keys(t.spots)) if (a !== b) assert.ok(t.spots[a][b] > 8 && t.spots[a][b] < 45, `${a}->${b} is a real walk`);
});

test('settling in: 3 quiet seconds at an empty spot, then +1 point a second', () => {
  const m = make({ groups: [[{ slot: 0, at: { x: 0, z: -30 } }], []], length: 0 });
  const log = events(m);
  const g = m.state.groups[0];
  assert.ok(m.order(0, g.id, 'fountain').ok);
  run(m, 30, () => spot(m, 'fountain').holder === 0);
  const ss = log.find((e) => e.name === 'settleStart'), sd = log.find((e) => e.name === 'settled');
  assert.ok(ss && sd, 'settleStart and settled fired');
  assert.ok(Math.abs(sd.t - ss.t - D.rules.settleTime) < 0.11, `settled ${sd.t - ss.t}s after it started`);
  const p0 = m.state.sides[0].score;
  run(m, 10);
  assert.ok(Math.abs(m.state.sides[0].score - p0 - 10) < 0.06, 'earns 1/s');
  assert.equal(g.status, 'hanging');
  assert.equal(m.state.sides[0].rate, 1);
  assert.ok(log.some((e) => e.name === 'earning' && e.p.spots.some((s) => s.spot === 'fountain' && s.side === 0)));
});

test('leaving stops the earning at once; two of your groups at one spot still earn just +1', () => {
  const m = make({ groups: [[{ slot: 0, at: 'fountain' }, { slot: 1, at: { x: 0, z: -25 } }], []], holders: { fountain: 0 }, length: 0 });
  const log = events(m);
  m.order(0, 1, 'fountain');
  run(m, 12);
  assert.equal(m.state.sides[0].rate, 1, 'still one point a second');
  m.order(0, 0, 'holley');
  run(m, 0.05);
  assert.equal(spot(m, 'fountain').holder, 0, 'the other group keeps it');
  m.order(0, 1, 'garibaldi');
  const before = m.state.sides[0].score;
  run(m, 0.05);
  assert.equal(spot(m, 'fountain').holder, -1, 'last group ordered away: spot free the same tick');
  assert.equal(m.state.sides[0].score, before, 'no more points');
  assert.ok(log.some((e) => e.name === 'spotFree' && e.p.reason === 'left'));
});

test('arguing: each rival drains you; two against one drains twice as fast; patience refills away from it', () => {
  const R = D.rules;
  const m = make({ groups: [[{ slot: 0, at: 'garibaldi' }], [{ slot: 0, at: 'garibaldi' }, { slot: 1, at: 'garibaldi' }]], holders: { garibaldi: 0 }, length: 0 });
  const [a, b1, b2] = m.state.groups;
  run(m, 2);
  assert.ok(a.arguing && b1.arguing && b2.arguing);
  assert.ok(Math.abs((R.patienceMax - a.patience) - 2 * R.drainPerRival * 2) < 0.7, `holder drained by two: ${a.patience}`);
  assert.ok(Math.abs((R.patienceMax - b1.patience) - R.drainPerRival * 2) < 0.7, `attacker drained by one: ${b1.patience}`);
  assert.equal(spot(m, 'garibaldi').holder, 0, 'the established occupant keeps the spot while argued with');
  const s0 = m.state.sides[0].score;
  run(m, 1);
  assert.ok(m.state.sides[0].score - s0 > 0.9, '...and keeps earning');
  m.order(1, b2.id, 'smallrun');
  const p = b2.patience;
  run(m, 1);
  assert.ok(b2.patience > p + R.recoverRate * 0.9 && !b2.arguing, 'walking away: recovers');
});

test('out of patience: goes for coffee, comes back through its entrance after the break, walks back', () => {
  const R = D.rules;
  const m = make({ groups: [[{ slot: 0, at: 'holley' }], [{ slot: 0, at: 'holley' }, { slot: 1, at: 'holley' }]], holders: { holley: 0 }, length: 0 });
  const log = events(m);
  const a = m.state.groups[0];
  run(m, 30, () => a.coffee);
  assert.ok(a.coffee && a.status === 'coffee');
  const ev = log.find((e) => e.name === 'wentForCoffee');
  assert.ok(ev && ev.p.line && ev.p.backIn === R.breakTime && ev.p.spot === 'holley');
  const tOut = m.state.t;
  run(m, 1);
  assert.equal(spot(m, 'holley').holder, -1, 'its spot is free');
  run(m, 5);
  assert.equal(spot(m, 'holley').holder, 1, 'the rivals settle in');
  const r = m.order(0, a.id, 'fountain');
  assert.ok(r.ok && r.queued, 'orders during the break are queued');
  run(m, 30, () => !a.coffee);
  assert.ok(Math.abs(m.state.t - tOut - R.breakTime) < 0.06, 'back after the break');
  assert.equal(a.patience, R.patienceMax);
  const e = m.state.sides[0].entrance;
  assert.ok(Math.hypot(a.x - e.x, a.z - e.z) < 8, 'at its own entrance');
  assert.equal(a.spot, spot(m, 'fountain').idx, 'heading where it was told during the break');
  assert.ok(log.some((x) => x.name === 'returned' && x.p.dest === 'fountain'));
});

test('with no new order a group comes back to the spot it left', () => {
  const m = make({ groups: [[{ slot: 0, at: 'fountain' }], [{ slot: 0, at: 'fountain' }, { slot: 1, at: 'fountain' }]], holders: { fountain: 0 }, length: 0 });
  const a = m.state.groups[0];
  run(m, 60, () => a.coffee);
  run(m, 30, () => !a.coffee);
  assert.equal(a.spot, spot(m, 'fountain').idx);
  assert.ok(a.moving);
});

test('a dead heat at a spot someone holds: the crew that was hanging out there stays', () => {
  const m = make({ groups: [[{ slot: 0, at: 'garibaldi' }], [{ slot: 0, at: 'garibaldi' }]], holders: { garibaldi: 0 }, length: 0 });
  const [a, b] = m.state.groups;
  run(m, 30, () => b.coffee || a.coffee);
  assert.ok(b.coffee && !a.coffee, 'the newcomer leaves, the holder stays');
  assert.equal(spot(m, 'garibaldi').holder, 0);
  assert.ok(a.patience < 5, 'on its last nerve');
  const both = make({ rules: { ties: 'both' }, groups: [[{ slot: 0, at: 'garibaldi' }], [{ slot: 0, at: 'garibaldi' }]], holders: { garibaldi: 0 }, length: 0 });
  run(both, 30, () => both.state.groups[0].coffee);
  assert.ok(both.state.groups[0].coffee && both.state.groups[1].coffee, "rule variant 'both': everybody leaves");
});

test('claiming an empty spot together: nobody earns until one side is left and settles', () => {
  const m = make({ groups: [[{ slot: 0, at: { x: 0, z: -30 } }], [{ slot: 0, at: { x: 0, z: 30 } }, { slot: 1, at: { x: 4, z: 30 } }]], length: 0 });
  m.order(0, 0, 'fountain'); m.order(1, 1, 'fountain'); m.order(1, 2, 'fountain');
  run(m, 10);
  assert.equal(spot(m, 'fountain').holder, -1);
  assert.equal(m.state.sides[0].score + m.state.sides[1].score, 0);
  run(m, 30, () => spot(m, 'fountain').holder >= 0);
  assert.equal(spot(m, 'fountain').holder, 1, 'two against one wins it');
  assert.ok(m.state.groups[0].coffee);
});

test('five minutes, most points wins; equal points is a draw; the Park Report describes what happened', () => {
  const m = H.create({ seed: 4, quiet: true, players: [{ crew: 'violets', ai: { difficulty: 'normal' } }, { crew: 'noise', ai: { difficulty: 'hard' } }] });
  const log = events(m);
  run(m, 400);
  assert.ok(m.state.over && Math.abs(m.state.t - 300) < 0.06);
  const end = log.find((e) => e.name === 'matchEnd');
  assert.ok(end);
  const [p0, p1] = m.state.sides.map((s) => s.points);
  assert.equal(end.p.winner, p0 === p1 ? -1 : p0 > p1 ? 0 : 1);
  assert.ok(Array.isArray(end.p.report.lines) && end.p.report.lines.length >= 1, 'observation lines');
  assert.equal(end.p.report.sides.length, 2);
  assert.ok(log.filter((e) => e.name === 'clockWarn').length === 3);
  const draw = make({ length: 5, groups: [[], []] });
  run(draw, 10);
  assert.equal(draw.state.winner, -1);
  assert.equal(draw.state.reason, 'draw');
});

test('deterministic: same seed, same match; replaying the player\'s orders reproduces it', () => {
  const cfg = { seed: 9, quiet: true, players: [{ crew: 'hustle', ai: false }, { crew: 'pack', ai: { difficulty: 'hard' } }] };
  const a = H.create(cfg), b = H.create(cfg);
  const script = (m) => { if (m.state.tick === 10) { m.order(0, 0, 'fountain'); m.order(0, 1, 'toddler'); m.order(0, 2, { x: 50, z: -10 }); } };
  for (let k = 0; k < 2400; k++) { script(a); a.tick(); script(b); b.tick(); }
  assert.equal(a.hash(), b.hash());
  const r = H.replay(cfg, a.log, 2400);
  assert.equal(r.hash(), a.hash());
  assert.ok(a.log.some((e) => e.src === 'ext') && a.log.some((e) => e.src === 'ai'));
});

test('commands: spots by id, index or a tap inside them; bad input is rejected', () => {
  const m = make({ length: 0 });
  const g = m.state.groups[0];
  assert.ok(m.order(0, g.id, 2).ok);
  assert.equal(g.spot, 2);
  assert.ok(m.order(0, g.id, { x: 61, z: -3 }).ok);
  assert.equal(g.spot, spot(m, 'garibaldi').idx, 'a tap inside a spot is that spot');
  assert.ok(m.order(0, g.id, { x: -100, z: -30 }).ok);
  assert.equal(g.spot, -1, 'a tap on the ground walks there');
  assert.equal(m.order(1, g.id, 'fountain').ok, false, 'not your group');
  assert.equal(m.order(0, 99, 'fountain').ok, false);
  assert.equal(m.order(0, g.id, 'nowhere').ok, false);
  assert.ok(m.order(0, g.id, 'stop').ok);
});

test('AI plays only through orders; Hard beats Easy, a reacting newcomer beats Easy', () => {
  const lab = require('../tools/hangout-lab.js');
  let hard = 0, newbie = 0;
  for (let k = 0; k < 6; k++) {
    if (lab.runMatch(SQ, { seed: 20 + k, a: 'easy', b: 'hard', swap: k % 2 === 1 }).winner === 'B') hard++;
    if (lab.runMatch(SQ, { seed: 40 + k, a: 'newbie', b: 'easy', swap: k % 2 === 1 }).winner === 'A') newbie++;
  }
  assert.ok(hard >= 5, `hard won ${hard}/6`);
  assert.ok(newbie >= 3, `newbie won ${newbie}/6`);
});

test('the incumbent test: two against one takes a spot from a leader who does nothing, and costs it the match', () => {
  const lab = require('../tools/hangout-lab.js');
  const setup = lab.incumbentSetups('park')[0];
  const stat = lab.runIncumbent(SQ, setup, 'static', {}, 'ignore', {});
  const pair = lab.runIncumbent(SQ, setup, 'pair', { target: 'fountain' }, 'ignore', {});
  assert.equal(stat.chalWins, false);
  assert.ok(pair.gap120 < stat.gap120 - 60, `pair closes the gap (${pair.gap120} vs ${stat.gap120})`);
  assert.ok(pair.chalWins, 'and wins from 20 points down');
});

test('tutorial scenarios build, and their goals can be checked', () => {
  for (const id of Object.keys(D.scenarios)) {
    const m = H.create({ scenario: id, quiet: true, seed: 2 });
    assert.ok(m.state.groups.length >= 1, id);
    run(m, 2);
    const g = H.checkGoal(m, D.scenarios[id].goal);
    assert.equal(typeof g.done, 'boolean');
  }
  const m = H.create({ scenario: 'firstSpot', quiet: true });
  assert.equal(m.state.spots.length, 1);
  m.order(0, 0, 'fountain');
  run(m, 60, () => H.checkGoal(m, D.scenarios.firstSpot.goal).done);
  assert.ok(H.checkGoal(m, D.scenarios.firstSpot.goal).done, 'firstSpot completes');
  const arg = H.create({ scenario: 'argue', quiet: true });
  arg.order(0, 0, 'fountain'); arg.order(0, 1, 'fountain');
  run(arg, 60, () => H.checkGoal(arg, D.scenarios.argue.goal).done);
  assert.ok(H.checkGoal(arg, D.scenarios.argue.goal).done, 'argue completes with two against one');
  const pass = H.create({ scenario: 'lookAround', quiet: true });
  run(pass, 20);
  assert.ok(pass.log.filter((e) => e.src === 'ai').length === 0, 'passive rivals never move');
});

test('every crew has three named groups and lines for every moment', () => {
  for (const crew of ['hustle', 'noise', 'violets', 'pack']) {
    const c = D.crews[crew];
    assert.equal(c.groups.length, 3);
    for (const k of ['settle', 'settled', 'argue', 'tired', 'coffee', 'back', 'still', 'evict', 'withdraw']) assert.ok(c.lines[k].length >= 2, `${crew}.${k}`);
  }
  assert.equal(H.fmtDur(11), 'eleven seconds');
  assert.equal(H.fmtDur(180), 'three minutes');
  assert.equal(H.fmtDur(90), 'a minute and a half');
});

test('standing places: every group at a spot has its own, at least 1.5 m from any other (2 and 4 crews)', () => {
  for (const n of [2, 4]) {
    const crews = ['hustle', 'pack', 'noise', 'violets'].slice(0, n);
    const m = H.create({ seed: 1, quiet: true, ai: false, players: crews.map((c) => ({ crew: c, ai: false })) });
    for (const s of m.state.spots) {
      const all = [].concat(...s.slots);
      assert.equal(all.length, n * 3);
      for (let a = 0; a < all.length; a++) {
        assert.ok(m.state.nav.walkable(all[a].x, all[a].z) && H.inSpot(s, all[a].x, all[a].z), `${s.id}: standing place walkable and inside`);
        for (let b = a + 1; b < all.length; b++) {
          const d = Math.hypot(all[a].x - all[b].x, all[a].z - all[b].z);
          assert.ok(d >= 1.5, `${s.id}: two standing places only ${d.toFixed(2)} m apart (${n} crews)`);
        }
      }
    }
  }
});

test('going for coffee says why: outnumbered, a dead heat the holder keeps, or nobody held it', () => {
  const two = make({ groups: [[{ slot: 0, at: 'holley' }], [{ slot: 0, at: 'holley' }, { slot: 1, at: 'holley' }]], holders: { holley: 0 }, length: 0 });
  const l1 = events(two);
  run(two, 30, () => l1.some((e) => e.name === 'wentForCoffee'));
  const e1 = l1.find((e) => e.name === 'wentForCoffee').p;
  assert.deepEqual([e1.side, e1.rivals, e1.mates, e1.tie, e1.mutual], [0, 2, 1, false, false], 'two against one');
  const tie = make({ groups: [[{ slot: 0, at: 'garibaldi' }], [{ slot: 0, at: 'garibaldi' }]], holders: { garibaldi: 0 }, length: 0 });
  const l2 = events(tie);
  run(tie, 30, () => l2.some((e) => e.name === 'wentForCoffee'));
  const e2 = l2.find((e) => e.name === 'wentForCoffee').p;
  assert.deepEqual([e2.side, e2.tie, e2.holder, e2.mutual], [1, true, 0, false], 'a dead heat: the newcomer leaves, the holder stays');
});

test('Park Report: a double walkout is named after the spot where it happened, however many there were', () => {
  // side 0 holds the Toddler Playground; one group from each side argues at the empty Fountain until both walk out
  const m = make({ groups: [[{ slot: 0, at: 'toddler' }, { slot: 1, at: { x: 0, z: -30 } }], [{ slot: 0, at: { x: 0, z: 30 } }]], holders: { toddler: 0 }, length: 0 });
  const log = events(m);
  m.order(0, 1, 'fountain'); m.order(1, 2, 'fountain');
  run(m, 40, () => log.some((e) => e.name === 'wentForCoffee'));
  const out = log.filter((e) => e.name === 'wentForCoffee');
  assert.equal(out.length, 2);
  assert.ok(out.every((e) => e.p.mutual && e.p.spot === 'fountain' && e.p.holder === -1), 'both walked out of the Fountain together');
  let rep = m.report();
  assert.equal(rep.sides[0].mutualAt.fountain, 1);
  let line = rep.lines.find((l) => /same moment/.test(l));
  assert.ok(line && /the Fountain/.test(line) && !/Toddler/.test(line), 'names the Fountain: ' + line);
  // after coffee both walk back to the Fountain and do it again
  run(m, 60, () => log.filter((e) => e.name === 'wentForCoffee').length >= 4);
  rep = m.report();
  assert.equal(rep.sides[0].mutual, 2);
  line = rep.lines.find((l) => /same moment/.test(l));
  assert.ok(line && /the Fountain/.test(line) && /twice/.test(line) && !/Twice as|the same spot/.test(line), 'two walkouts at one spot: ' + line);
});

test('tutorial patience floor: arguing never drains below it (one value, or one per crew); 0 turns it off', () => {
  const m = make({ groups: [[{ slot: 0, at: 'garibaldi' }], [{ slot: 0, at: 'garibaldi' }]], holders: { garibaldi: 0 }, length: 0, rules: { patienceFloor: 60 } });
  const [a, b] = m.state.groups;
  run(m, 40);
  assert.ok(!a.coffee && !b.coffee && a.arguing, 'the argument holds');
  assert.ok(Math.abs(a.patience - 60) < 0.01 && Math.abs(b.patience - 60) < 0.01, `both stop at 60 (${a.patience}, ${b.patience})`);
  m.rules.patienceFloor = [0, 30];
  run(m, 40, () => a.coffee || b.coffee);
  assert.ok(a.coffee && !b.coffee && Math.abs(b.patience - 30) < 0.01, 'per-crew floors: only the crew without one runs out');
  assert.equal(D.rules.patienceFloor, undefined, 'never part of the normal rules');
});
