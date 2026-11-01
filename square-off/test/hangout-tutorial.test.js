'use strict';
// "First morning in the park" (js/ui/hangout-tutorial.js): its scripted scenes must play out the way the lessons
// describe, and none of them can be lost or get stuck. Headless: only the scene configs are used here.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { SQload } = require('./helpers.js');
const SQ = SQload();
require(path.join(__dirname, '..', 'js', 'ui', 'hangout-tutorial.js'));
const T = SQ.hangoutTutorial;
const H = SQ.Hangout;

function scene(name, crew) {
  T.crew = crew || 'hustle';
  T.rival = T.crew === 'pack' ? 'violets' : 'pack';
  return H.create(Object.assign({}, T.SCENES[name](), { quiet: true }));
}
function run(m, seconds, each) {
  const n = Math.round(seconds / H.DT);
  for (let k = 0; k < n && !m.state.over; k++) { if (each) each(m); m.tick(); }
}
function on(m, name) { const out = []; m.bus.on(name, (p) => out.push(Object.assign({ t: m.state.t }, p))); return out; }
function at(m, t, fn) { return (mm) => { if (Math.abs(mm.state.t - t) < H.DT / 2) fn(mm); }; }
function mine(m, slot) { return m.state.groups.find((g) => g.side === m.state.player && g.slot === slot); }

test('tutorial: every scene builds for every crew', () => {
  for (const crew of ['hustle', 'noise', 'violets', 'pack']) {
    for (const name of Object.keys(T.SCENES)) {
      const m = scene(name, crew);
      assert.equal(m.state.player, 0, name);
      assert.equal(m.state.sides[0].crew, crew, name);
      assert.notEqual(m.state.sides[1].crew, crew, name);
      assert.equal(m.state.spots.length, 5, name + ': all five spots are on the map');
    }
  }
});

test('tutorial: the morning has three of your groups at your entrance, nobody else, no clock', () => {
  const m = scene('morning');
  const g = m.state.groups;
  assert.equal(g.filter((q) => q.side === 0).length, 3);
  assert.equal(g.filter((q) => q.side === 1).length, 0);
  assert.equal(m.rules.length, 0);
  run(m, 30);
  assert.equal(m.state.sides[0].points, 0, 'nothing happens until the player acts');
});

test('tutorial: company arrives and argues; it leaves for coffee with or without help (faster with help)', () => {
  const alone = scene('company');
  const argue = on(alone, 'argueStart'), coffee = on(alone, 'wentForCoffee');
  run(alone, 45);
  assert.ok(argue.length >= 1 && argue[0].t < 12, 'the rival reaches the Fountain and argues within 12 s');
  const out = coffee.filter((c) => c.side === 1);
  assert.equal(out.length, 1, 'the rival goes for coffee');
  assert.equal(coffee.filter((c) => c.side === 0).length, 0, 'your group that was there first stays (ties go to the holder)');
  const helped = scene('company');
  const coffee2 = on(helped, 'wentForCoffee');
  run(helped, 45, at(helped, 8, (mm) => assert.ok(mm.order(0, mine(mm, 2).id, 'fountain').ok)));
  const out2 = coffee2.filter((c) => c.side === 1);
  assert.equal(out2.length, 1);
  assert.ok(out2[0].t < out[0].t - 4, 'two against one makes them leave sooner (' + out2[0].t + ' vs ' + out[0].t + ')');
  assert.equal(coffee2.filter((c) => c.side === 0).length, 0);
});

test('tutorial: know when to leave: staying means coffee, walking away keeps patience', () => {
  const stay = scene('leave');
  const c1 = on(stay, 'wentForCoffee');
  run(stay, 30);
  const mineOut = c1.filter((c) => c.side === 0);
  assert.equal(mineOut.length, 1, 'two against one: your group runs out of patience');
  assert.ok(mineOut[0].t > 9, 'with time to react first (' + mineOut[0].t + ' s)');
  const walk = scene('leave');
  const c2 = on(walk, 'wentForCoffee');
  let low = 100;
  run(walk, 7, (mm) => { low = Math.min(low, mine(mm, 0).patience); });
  assert.ok(walk.state.sides[0].stats.withdrawals === 0);
  assert.ok(walk.order(0, mine(walk, 0).id, 'holley').ok);
  assert.equal(walk.state.sides[0].stats.withdrawals, 1, 'walking away from an argument counts as a withdrawal');
  run(walk, 8);
  assert.equal(c2.filter((c) => c.side === 0).length, 0, 'no coffee break');
  assert.ok(mine(walk, 0).patience >= low + 10, 'patience refills once nobody argues with you');
});

test('tutorial: the first match is two minutes against a gentle Easy crew', () => {
  const m = scene('match');
  assert.equal(m.rules.length, 120);
  assert.equal(m.cfg.players[1].ai.difficulty, 'easy');
  const g = m.state.groups;
  assert.equal(g.filter((q) => q.side === 0).length, 3);
  assert.equal(g.filter((q) => q.side === 1).length, 3);
  run(m, 121);
  assert.ok(m.state.over, 'the clock ends it');
});

test('tutorial: lessons 5-7 wait for the player (the arguments hold until help comes or the group walks away)', () => {
  const fi = (m) => m.state.spots.findIndex((s) => s.id === 'fountain');
  // 5-6: the bars hold at 60 while the player hesitates; help that arrives makes them leave
  const c = scene('company');
  c.rules.patienceFloor = T.FLOORS.help;
  const coffee = on(c, 'wentForCoffee');
  run(c, 90);
  assert.equal(coffee.length, 0, 'nobody leaves while the player does nothing');
  assert.ok(c.order(0, mine(c, 2).id, 'fountain').ok);
  run(c, 40, (mm) => { if (mm.rules.patienceFloor && mm.state.groups.filter((g) => g.side === 0 && g.at === fi(mm)).length >= 2) mm.rules.patienceFloor = 0; });
  const out = coffee.filter((e) => e.side === 1);
  assert.equal(out.length, 1, 'two against one: they go for coffee');
  assert.equal(out[0].rivals, 2);
  assert.equal(coffee.filter((e) => e.side === 0).length, 0);
  // 7: your bar stops at 40 (theirs at 30) until you walk away; walking away refills it
  const l = scene('leave');
  l.rules.patienceFloor = T.FLOORS.leave;
  const c2 = on(l, 'wentForCoffee');
  run(l, 90);
  assert.equal(c2.length, 0, 'no coffee break while the player hesitates');
  assert.ok(Math.abs(mine(l, 0).patience - T.FLOORS.leave[0]) < 0.01);
  assert.ok(l.order(0, mine(l, 0).id, 'holley').ok);
  assert.equal(l.state.sides[0].stats.withdrawals, 1);
  run(l, 6);
  assert.ok(mine(l, 0).patience >= T.FLOORS.leave[0] + 10, 'patience refills once nobody argues with you');
});
