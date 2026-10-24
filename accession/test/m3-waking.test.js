// M3's waking (BUILD.md §8.2, §8.6): pips from the ring, noise and decay; hearing by mode;
// the special triggers axis, tether and ally_hit; "Quiet, Please" and the Re-admission
// Ticket's effect on exhibits; the beat after every waking; the waking sentences; and the
// waking invariants against planted faults. The expected figures are worked out here from
// BUILD.md's text, never from the rule code.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { N } = C;
  const json = x => JSON.stringify(x);
  const H = require('./behaviour/_harness.js');
  const open = (w, h) => ['#'.repeat(w)].concat(Array(h - 2).fill('#' + '.'.repeat(w - 2) + '#'), ['#'.repeat(w)]);
  const OPEN = open(12, 8);
  const tough = { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'dormant', stats: tough }, extra);
  const room = (X, map, you, exhibits, options, extra) => {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map, you, exhibits: exhibits || [] }, extra || {}), options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  const checked = (X, ev) => { for (const e of ev) { const bad = X.Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object/.test(s);
  const said = (X, ev) => { for (const e of ev) assert.ok(clean(X.Text.event(e, null)), `${json(e)} → ${X.Text.event(e, null)}`); return ev; };
  const pipsOf = (ev, uid) => ev.filter(e => e.k === 'pip' && e.who === uid);
  const waits = (X, s, n) => { const out = []; for (let i = 0; i < n; i++) out.push(...X.Step.step(s, { a: 'wait' })); return out; };

  test('the ring gives a pip a turn, and the third wakes the sleeper hunting, with the distance in the cause, after a beat', () => {
    const X = loadCore();
    // You wait at (2, 2): radius 2. A sleeper 2 tiles east, in sight; another 3 east, outside.
    const s = room(X, OPEN, [2, 2], [ex([4, 2]), ex([5, 3])]), [, a, b] = s.actors;
    const ev = said(X, checked(X, waits(X, s, 3)));
    assert.equal(json(pipsOf(ev, a.uid).map(e => [e.turn, e.pips, e.delta, e.cause.k, e.cause.dist, e.cause.r])),
      json([[1, 1, 1, 'ring', 2, 2], [2, 2, 1, 'ring', 2, 2], [3, 3, 1, 'ring', 2, 2]]));
    assert.equal(pipsOf(ev, b.uid).length, 0, 'three tiles away, outside a still radius of 2');
    const woke = ev.filter(e => (e.k === 'woke' || e.k === 'hunting') && e.who === a.uid);
    assert.equal(json(woke.map(e => [e.k, e.turn, e.was, e.mode || null, e.cause.k, e.cause.dist])), json([['woke', 3, 'dormant', 'hunting', 'ring', 2], ['hunting', 3, 'dormant', null, 'ring', 2]]));
    assert.equal(json([a.mode, a.pips, a.woke, a.hunted && a.hunted.turn, a.lastKnown]), json(['hunting', 0, { turn: 3, cause: { k: 'ring', dist: 2, r: 2 } }, 3, [2, 2]]));
    // Woken at turn 3's boundary (tick 300), it first acts one action later (§8.1).
    assert.equal(a.next, 300 + N.COST_STEP);
    // Moving, the radius is 3: the other sleeper, 3 away, now gains its pip.
    const t = room(X, OPEN, [1, 3], [ex([5, 3])]);
    const ev2 = X.Step.step(t, { a: 'move', dir: 2 });
    assert.equal(json(pipsOf(ev2, t.actors[1].uid).map(e => [e.cause.dist, e.cause.r])), json([[3, 3]]));
  });

  test('noise: each class is heard at its range and not one tile further; a closed door, ordinary or staff, adds 3; a 2×2 body hears from its nearest tile; a sleeper gains at most one noise pip a turn', () => {
    const X = loadCore();
    const corridor = ['#'.repeat(16), '#' + '.'.repeat(14) + '#', '#'.repeat(16)];
    for (const [cls, range] of [['soft', N.NOISE_SOFT], ['loud', N.NOISE_LOUD], ['crash', N.NOISE_CRASH]]) {
      const s = room(X, corridor, [14, 1], [ex([1 + range, 1]), ex([2 + range, 1])]), ev = [];
      X.Noise.emit(s, 1, 1, cls, { k: 'attack', by: 'you' }, ev);
      checked(X, said(X, ev));
      assert.equal(json(ev.filter(e => e.k === 'noise').map(e => [e.x, e.y, e.cls, e.range])), json([[1, 1, cls, range]]));
      assert.equal(json(ev.filter(e => e.k === 'pip').map(e => [e.who, e.cause.k, e.cause.dist, e.cause.cls, e.cause.by])), json([[s.actors[1].uid, 'noise', range, cls, 'you']]), `${cls}: heard at ${range}, not at ${range + 1}`);
    }
    // A closed door between: the soft noise from (1, 1) reaches (4, 1) beyond the door at (3, 1)
    // only when the door is open; a loud one reaches it through the closed door, 3 + 3 = 6. A
    // staff door, closed or open, counts as a door (§8.2: "staff doors count as doors").
    const doors = ['########', '#..+...#', '########'];
    for (const [tile, cls, heard] of [['+', 'soft', false], ["'", 'soft', true], ['+', 'loud', true], ['S', 'soft', false], ['s', 'soft', true], ['S', 'loud', true]]) {
      const map = doors.map(r => r.replace('+', tile)), s = room(X, map, [6, 1], [ex([4, 1])]), ev = [];
      X.Noise.emit(s, 1, 1, cls, { k: 'attack', by: 'you' }, ev);
      const pip = ev.find(e => e.k === 'pip');
      assert.equal(!!pip, heard, `${cls} through ${tile}`);
      if (pip) assert.equal(json([pip.cause.dist, pip.cause.x, pip.cause.y]), json([tile === '+' || tile === 'S' ? 3 + N.NOISE_DOOR : 3, 1, 1]), `${cls} through ${tile}`);
    }
    // A 2×2 body hears from its nearest tile: a soft noise at (9, 3) is 3 tiles from (6, 3), the
    // nearest tile of a body at (5, 2), though 4 from its own tile (5, 2); a body at (4, 2) is
    // 4 from its nearest tile and hears nothing.
    for (const [at, dist] of [[[5, 2], 3], [[4, 2], -1]]) {
      const s = room(X, open(18, 6), [16, 1], [ex(at, { size: 2 })]), ev = [];
      X.Noise.emit(s, 9, 3, 'soft', { k: 'attack', by: 'you' }, ev);
      assert.equal(json(checked(X, ev).filter(e => e.k === 'pip').map(e => e.cause.dist)), json(dist < 0 ? [] : [dist]), `a 2×2 body at ${at}`);
    }
    // Two noises in one turn: one pip; the next turn: another; the third pip, from noise,
    // wakes it awake, to look at the noise's tile, not hunting.
    const s = room(X, OPEN, [9, 6], [ex([3, 2])]), a = s.actors[1], ev = [];
    X.Noise.emit(s, 2, 2, 'soft', { k: 'attack', by: 'you' }, ev);
    X.Noise.emit(s, 4, 2, 'loud', { k: 'destroyed', by: 'you' }, ev);
    assert.equal(a.pips, 1, 'at most one pip from noise a turn');
    s.turn = 1; X.Noise.emit(s, 2, 2, 'soft', { k: 'attack', by: 'you' }, ev);
    s.turn = 2; s.tick = 200; X.Noise.emit(s, 1, 3, 'soft', { k: 'attack', by: 'you' }, ev);
    checked(X, said(X, ev));
    assert.equal(json([a.mode, a.target, a.woke.cause.k, a.hunted]), json(['awake', [1, 3], 'noise', null]));
    // Each noise's cause names its source: who made it and its tile (§3.4).
    assert.equal(json(pipsOf(ev, a.uid).map(e => [e.cause.by, e.cause.x, e.cause.y])), json([['you', 2, 2], ['you', 2, 2], ['you', 1, 3]]));
    assert.equal(json([a.woke.cause.x, a.woke.cause.y, a.woke.cause.dist, a.woke.cause.cls]), json([1, 3, 2, 'soft']));
    assert.ok(!ev.some(e => e.k === 'hunting'), 'noise wakes it awake, not hunting');
    assert.equal(a.next, 200 + N.COST_STEP, 'after a beat');
  });

  test('hearing by mode: an awake exhibit goes to look; searching, returning and reinstalling ones are alerted; a hunter\'s last-known tile moves only for your noise', () => {
    const X = loadCore();
    const s = room(X, OPEN, [10, 6], [
      ex([3, 2], { mode: 'awake', target: [5, 5] }), ex([4, 3], { mode: 'searching', lastKnown: [6, 6] }), ex([2, 4], { mode: 'returning' }),
      ex([4, 5], { mode: 'reinstalling' }), ex([3, 4], { mode: 'hunting', lastKnown: [9, 1] })]);
    const [, aw, se, re, ri, hu] = s.actors;
    s.turn = 4;
    const stimBefore = hu.stim, ev = [];
    X.Noise.emit(s, 3, 3, 'soft', { k: 'attack', by: aw.uid }, ev);
    checked(X, said(X, ev));
    // The awake one made the noise itself and does not react to it.
    assert.equal(json([aw.mode, aw.target]), json(['awake', [5, 5]]));
    for (const a of [se, re, ri]) assert.equal(json([a.mode, a.target, a.stim]), json(['awake', [3, 3], 4]), a.uid);
    assert.equal(json(ev.filter(e => e.k === 'alerted').map(e => [e.who, e.from, e.to, e.x, e.y, e.cause.k, e.cause.by, e.cause.cls, e.cause.x, e.cause.y])),
      json([[se.uid, 'searching', 'awake', 3, 3, 'noise', aw.uid, 'soft', 3, 3], [re.uid, 'returning', 'awake', 3, 3, 'noise', aw.uid, 'soft', 3, 3], [ri.uid, 'reinstalling', 'awake', 3, 3, 'noise', aw.uid, 'soft', 3, 3]]));
    assert.equal(json(hu.lastKnown), json([9, 1]), 'another exhibit\'s noise says nothing about where you are');
    // Your noise: the hunter's last-known tile moves to it, and its turns out of sight go on.
    s.turn = 5;
    const ev2 = [];
    X.Noise.emit(s, 5, 2, 'soft', { k: 'attack', by: 'you' }, ev2);
    assert.equal(json([hu.lastKnown, hu.stim]), json([[5, 2], stimBefore]));
    // The awake exhibit goes to look at the new noise (alerted), and is stirred; a noise from
    // the tile it is already going to look at only stirs it.
    assert.equal(json([aw.target, aw.stim]), json([[5, 2], 5]));
    s.turn = 6;
    const ev3 = [];
    X.Noise.emit(s, 5, 2, 'soft', { k: 'attack', by: 'you' }, ev3);
    assert.equal(json([aw.target, aw.stim, ev3.filter(e => e.k === 'alerted' && e.who === aw.uid).length]), json([[5, 2], 6, 0]));
  });

  test('a returning exhibit that has seen you and is alerted by a noise is not surprised by your blow; one that has never seen you is', () => {
    const X = loadCore();
    const s = room(X, OPEN, [2, 2], [ex([3, 2], { mode: 'returning', sawYou: true }), ex([2, 3], { mode: 'awake', target: [6, 6] })]);
    const [you, re, aw] = s.actors, ev = [];
    X.Noise.emit(s, 6, 4, 'soft', { k: 'attack', by: 'you' }, ev);
    assert.equal(json([re.mode, re.sawYou]), json(['awake', true]));
    assert.equal(X.Combat.surprised(you, re), false, 'alerted, it has seen you since it last woke');
    assert.equal(X.Combat.surprised(you, aw), true, 'awake and never shown you');
    const blow = X.Step.step(s, { a: 'attack', uid: re.uid });
    const hit = blow.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
    assert.ok(hit && !hit.cause.surprise && Number.isInteger(hit.cause.roll), json(hit));
  });

  test('decay: a sleeper loses a pip after 10 turns without stimulus and another after 20; a new pip starts the count again; none after the bell', () => {
    const X = loadCore();
    // Far from you and from any noise: only decay acts.
    const map = open(30, 5);
    const s = room(X, map, [27, 2], [ex([2, 2], { pips: 2, stim: 0 }), ex([4, 3], { pips: 1, stim: 0 })]), [, a, b] = s.actors;
    const ev = said(X, checked(X, waits(X, s, 35)));
    assert.equal(json(pipsOf(ev, a.uid).map(e => [e.turn, e.pips, e.delta, e.cause.k])), json([[10, 1, -1, 'decay'], [20, 0, -1, 'decay']]));
    assert.equal(json(pipsOf(ev, b.uid).map(e => [e.turn, e.pips])), json([[10, 0]]));
    // A pip gained on turn 5 (a noise) puts the next decay 10 turns after it.
    const t = room(X, map, [27, 2], [ex([2, 2], { pips: 1, stim: 0 })]), c = t.actors[1], evt = [];
    for (let i = 0; i < 30; i++) {
      if (t.turn === 5) X.Noise.emit(t, 2, 1, 'soft', { k: 'attack', by: 'you' }, evt);
      evt.push(...X.Step.step(t, { a: 'wait' }));
    }
    assert.equal(json(pipsOf(evt, c.uid).map(e => [e.turn, e.pips, e.cause.k])), json([[5, 2, 'noise'], [15, 1, 'decay'], [25, 0, 'decay']]));
    // A pip gained after a decay counts from the pip: 2 pips on turn 0 decay to 1 on turn 10; a
    // noise on turn 12 gives the second back; the next decay is on turn 22, not 20.
    const v = room(X, map, [27, 2], [ex([2, 2], { pips: 2, stim: 0 })]), g = v.actors[1], evv = [];
    for (let i = 0; i < 40; i++) {
      if (v.turn === 12) X.Noise.emit(v, 2, 1, 'soft', { k: 'attack', by: 'you' }, evv);
      evv.push(...X.Step.step(v, { a: 'wait' }));
    }
    assert.equal(json(pipsOf(evv, g.uid).map(e => [e.turn, e.pips, e.cause.k])), json([[10, 1, 'decay'], [12, 2, 'noise'], [22, 1, 'decay'], [32, 0, 'decay']]));
    // After the bell (stage 1) pips stay.
    const u = room(X, map, [27, 2], [ex([2, 2], { pips: 2, stim: 0 })], null, { clock: { B: 5, G: 500, count: 5 } });
    assert.equal(X.Clock.stage(u), 1);
    assert.equal(pipsOf(waits(X, u, 25), u.actors[1].uid).length, 0);
    assert.equal(u.actors[1].pips, 2);
  });

  test('axis: a pip a turn while you stand in its row or column within AXIS_RANGE, in its sight; nothing off the line, one tile further, or out of sight', () => {
    const X = loadCore();
    const map = open(24, 14);
    const axis = (at, extra) => ex(at, Object.assign({ trigger: 'axis' }, extra));
    const R = N.AXIS_RANGE;
    const cases = [
      { you: [2 + R, 3], at: [2, 3], pip: true, dist: R },          // its row, at the range
      { you: [3 + R, 3], at: [2, 3], pip: false },                  // one tile further
      { you: [2 + R, 4], at: [2, 3], pip: false },                  // off its row by one
      { you: [5, 3 + R], at: [5, 3], pip: true, dist: R },          // its column
      { you: [5, 9], at: [5, 3], pip: true, dist: 6, wall: [5, 6], seen: false },   // a column blocks its sight
      { you: [5, 9], at: [5, 3], pip: true, dist: 6, glass: [5, 6] },              // glass does not
    ];
    for (const c of cases) {
      let m = map.slice();
      const put = ([x, y], ch) => { m[y] = m[y].slice(0, x) + ch + m[y].slice(x + 1); };
      if (c.wall) put(c.wall, 'o');
      if (c.glass) put(c.glass, 'v');
      const s = room(X, m, c.you, [axis(c.at)]), a = s.actors[1];
      assert.equal(X.Wake.onAxis(s, a), c.pip && c.seen !== false, json(c));
      const ev = checked(X, said(X, waits(X, s, 1)));
      const got = pipsOf(ev, a.uid).filter(e => e.cause.k === 'axis');
      assert.equal(json(got.map(e => e.cause.dist)), json(c.pip && c.seen !== false ? [c.dist] : []), json(c));
    }
    // One a turn: three turns wake it, hunting, by axis; the boundary run twice in a turn adds one.
    const s = room(X, map, [2 + R, 3], [axis([2, 3])]), a = s.actors[1], ev = [];
    X.Wake.boundary(s, ev); X.Wake.boundary(s, ev);
    assert.equal(a.pips, 1);
    ev.push(...waits(X, s, 2));
    assert.equal(json([a.mode, a.woke.turn, a.woke.cause]), json(['hunting', 2, { k: 'axis', dist: R }]));
    // Without the trigger, the same place gives nothing; a 2×2 body is on your line if any of its tiles is.
    const t = room(X, map, [2 + R, 3], [ex([2, 3])]);
    assert.equal(pipsOf(waits(X, t, 2), t.actors[1].uid).length, 0);
    const u = room(X, map, [2 + R, 4], [axis([2, 3], { size: 2 })]);
    assert.equal(json(pipsOf(waits(X, u, 1), u.actors[1].uid).map(e => [e.cause.k, e.cause.dist])), json([['axis', R - 1]]), 'its nearer tile, (3, 4), is 7 away');
  });

  test('tether: all three pips at once when you come within TETHER_RANGE of what it guards, with no sight needed; nothing outside it', () => {
    const X = loadCore();
    const map = open(20, 12), T = N.TETHER_RANGE;
    const warden = (at, guards) => ex(at, { trigger: 'tether', guards });
    // Within 2 (Grid.disc): dx² + dy² ≤ 6. (2, 1) is within; (2, 2) is not.
    const s = room(X, map, [12, 5], [warden([10, 4], [10, 4])]), a = s.actors[1];
    assert.equal(X.Wake.inTether(s, a), true);
    const ev = checked(X, said(X, waits(X, s, 1)));
    assert.equal(json(pipsOf(ev, a.uid).map(e => [e.cause.k, e.delta])), json([['ring', 1], ['tether', 2]]), 'the ring first, then the tether completes it');
    assert.equal(json([a.mode, a.woke.cause.k, a.woke.cause.x, a.woke.cause.y, a.woke.cause.dist]), json(['hunting', 'tether', 10, 4, 2]));
    const t = room(X, map, [12, 6], [warden([10, 4], [10, 4])]);
    assert.equal(X.Wake.inTether(t, t.actors[1]), false, '(2, 2) is outside the disc');
    assert.ok(!pipsOf(waits(X, t, 1), t.actors[1].uid).some(e => e.cause.k === 'tether'));
    // What it guards may be elsewhere, and a wall between you and it does not matter.
    const walled = map.slice(); walled[4] = walled[4].slice(0, 13) + '#' + walled[4].slice(14);
    const u = room(X, walled, [14, 4], [warden([2, 9], [12, 4])]), b = u.actors[1];
    const ev3 = checked(X, waits(X, u, 1));
    assert.equal(json([b.mode, b.woke.cause.k, b.woke.cause.dist]), json(['hunting', 'tether', T]));
    assert.equal(pipsOf(ev3, b.uid).length, 1);
    // A warden that guards nothing has no tether.
    const v = room(X, map, [11, 4], [warden([2, 9], null)]);
    assert.equal(X.Wake.inTether(v, v.actors[1]), false);
  });

  test('ally_hit: a blow on one of its group within ALLY_HIT_RANGE wakes a sleeper with the trigger, hunting, before the blow\'s noise; no other group, no waking exhibit, nothing further off', () => {
    const X = loadCore();
    const map = open(20, 12);
    const member = (at, extra) => ex(at, Object.assign({ trigger: 'ally_hit', group: 'g' }, extra));
    // You at (2, 5) strike V at (3, 5). Within 5 of V: dx² + dy² ≤ 30.
    const s = room(X, map, [2, 5], [
      member([3, 5]),                                  // V, the one struck
      member([8, 5]),                                  // 5 east: within
      member([8, 8]),                                  // (5, 3): 34, outside
      member([7, 8], { group: 'h' }),                  // another group
      member([7, 2], { mode: 'awake', target: [7, 2] }), // awake: it has no pips
      ex([6, 7], { group: 'g' }),                      // of the group, without the trigger
      member([4, 6], { pips: 2 }),                     // 2 pips, also within the blow's noise
    ]);
    const [, V, in5, out, other, awake, plain, two] = s.actors;
    const ev = checked(X, said(X, X.Step.step(s, { a: 'attack', uid: V.uid })));
    const woke = e => e.k === 'woke' && e.cause.k === 'ally_hit';
    assert.equal(json(ev.filter(woke).map(e => [e.who, e.mode, e.cause.by, e.cause.ally, e.cause.dist])),
      json([[in5.uid, 'hunting', 'you', V.uid, 5], [two.uid, 'hunting', 'you', V.uid, 1]]));
    for (const a of [out, other, plain]) assert.equal(a.mode, 'dormant', a.uid);
    assert.equal(json([awake.pips, pipsOf(ev, awake.uid).length]), json([0, 0]), 'an exhibit already awake has no pips to gain');
    // Both woke before the blow's noise, so the 2-pip sleeper woke hunting, not awake (§8.2).
    const noise = ev.findIndex(e => e.k === 'noise');
    assert.ok(ev.findIndex(e => woke(e) && e.who === two.uid) < noise && noise > 0);
    assert.equal(two.woke.cause.k, 'ally_hit');
    // A victim with no group wakes no one.
    const t = room(X, map, [2, 5], [ex([3, 5]), member([6, 5])]);
    X.Step.step(t, { a: 'attack', uid: t.actors[1].uid });
    assert.equal(t.actors[2].mode, 'dormant');
    // Within 5 counts between the nearest tiles: a 2×2 member at (5, 4) has its tile (6, 5) 5
    // tiles from the victim at (11, 5) (25 ≤ 30), though its own tile (5, 4) is not (37); a
    // 2×2 member at (4, 4) has none within 5 (its nearest, (5, 5), is 6 away: 36).
    for (const [at, wakes] of [[[5, 4], true], [[4, 4], false]]) {
      const u = room(X, map, [12, 5], [member([11, 5]), member(at, { size: 2 })]), b = u.actors[2];
      checked(X, X.Step.step(u, { a: 'attack', uid: u.actors[1].uid }));
      assert.equal(json([b.mode, b.woke && b.woke.cause.k, b.woke && b.woke.cause.dist]), json(wakes ? ['hunting', 'ally_hit', 5] : ['dormant', null, null]), `a 2×2 member at ${at}`);
    }
  });

  test('the beat: whatever wakes it, a sleeper first acts one action after its waking (twice that for one slow at everything)', () => {
    const X = loadCore();
    X.Registry.define('ARCHETYPES', 'planted_slow', { speed: 'slow' });
    X.Archetypes.add('planted_slow', { speedApplies: () => ['move', 'act'] });
    const map = open(24, 14);
    for (const arch of [undefined, 'planted_slow']) {
      const cost = arch ? 2 * N.COST_STEP : N.COST_STEP;
      const extra = arch ? { arch } : {};
      const wakes = {
        ring: () => { const s = room(X, map, [2, 2], [ex([3, 3], Object.assign({ pips: 2 }, extra))]); X.Step.step(s, { a: 'wait' }); return s; },
        noise: () => { const s = room(X, map, [20, 10], [ex([3, 3], Object.assign({ pips: 2 }, extra))]); s.tick = 40; X.Noise.emit(s, 3, 1, 'soft', { k: 'attack', by: 'you' }, []); return s; },
        axis: () => { const s = room(X, map, [10, 3], [ex([3, 3], Object.assign({ pips: 2, trigger: 'axis' }, extra))]); X.Step.step(s, { a: 'wait' }); return s; },
        tether: () => { const s = room(X, map, [10, 5], [ex([3, 9], Object.assign({ trigger: 'tether', guards: [10, 3] }, extra))]); X.Step.step(s, { a: 'wait' }); return s; },
        ally_hit: () => { const s = room(X, map, [2, 5], [ex([3, 5], { group: 'g' }), ex([7, 5], Object.assign({ trigger: 'ally_hit', group: 'g' }, extra))]); X.Step.step(s, { a: 'attack', uid: s.actors[1].uid }); return s; },
      };
      for (const k of Object.keys(wakes)) {
        const s = wakes[k](), a = s.actors[s.actors.length - 1];
        assert.equal(a.woke && a.woke.cause.k, k, `${k}${arch ? ' (slow)' : ''}`);
        const at = k === 'ring' || k === 'axis' || k === 'tether' ? 100 : k === 'noise' ? 40 : 0;
        assert.equal(a.next, at + cost, `${k}${arch ? ' (slow)' : ''}: woken at ${at}`);
      }
    }
  });

  test('"Quiet, Please": within 8 walking tiles sleepers lose every pip, the awake settle where they stand, hunters drop to awake and their marks are called off; the Watchman, a species that never sleeps and a disguised mimic are untouched', () => {
    const X = loadCore();
    X.Registry.define('MODIFIERS', 'planted_disguise', {});
    X.Archetypes.addModifier('planted_disguise', { pipless: () => true });
    // A wall with gaps above and below: (12, 2) is 8 tiles away as the crow flies, 9 walking.
    const map = ['##################', '#................#', '#..........#.....#', '#..........#.....#', '#..........#.....#', '#..........#.....#', '#................#', '##################'];
    const s = room(X, map, [4, 3], [
      ex([6, 3], { pips: 2 }), ex([12, 2], { pips: 2 }), ex([8, 5], { mode: 'awake', target: [1, 1], home: [2, 6] }),
      ex([7, 1], { mode: 'searching', lastKnown: [5, 5] }), ex([3, 6], { mode: 'returning' }), ex([5, 6], { mode: 'reinstalling' }),
      ex([9, 2], { mode: 'hunting' }), ex([2, 2], { mode: 'hunting', arch: 'night_watchman' }), ex([2, 4], { mode: 'awake', trigger: 'awake', target: [3, 3] }),
      ex([6, 1], { mods: ['planted_disguise'] })]);
    const [, near, far, aw, se, re, ri, hu, watch, never, mimic] = s.actors;
    hu.telegraph = { sp: 'ring', tiles: [[8, 2]], from: [[9, 2]], gross: 5, effect: 'damage', turn: 0, tick: 0 };
    const ev = [];
    X.Wake.quiet(s, 4, 3, N.QUIET_RANGE, { k: 'quiet', by: 'you', item: 'q1' }, ev);
    checked(X, said(X, ev));
    assert.equal(json([near.pips, far.pips]), json([0, 2]), 'the far sleeper is 9 walking tiles away');
    assert.equal(json(pipsOf(ev, near.uid).map(e => [e.delta, e.cause])), json([[-2, { k: 'quiet', by: 'you', item: 'q1' }]]));
    for (const a of [aw, se, re, ri]) assert.equal(a.mode, 'dormant', a.uid);
    assert.equal(json([aw.x, aw.y, aw.home]), json([8, 5, [2, 6]]), 'it settles where it stands, its home unchanged');
    assert.equal(json([hu.mode, hu.telegraph, hu.sawYou]), json(['awake', null, false]));
    assert.equal(json([watch.mode, never.mode, mimic.mode]), json(['hunting', 'awake', 'dormant']));
    const changes = ev.filter(e => ['lost', 'returned', 'special'].includes(e.k)).map(e => [e.k, e.who, e.from || null, e.to || null, e.phase || null, e.cause.k, e.cause.why || null]);
    assert.equal(json(changes), json([
      ['lost', aw.uid, 'awake', 'dormant', null, 'quiet', null], ['lost', se.uid, 'searching', 'dormant', null, 'quiet', null],
      ['lost', re.uid, 'returning', 'dormant', null, 'quiet', null], ['returned', ri.uid, null, null, 'reinstalled', 'quiet', null],
      ['special', hu.uid, null, null, null, 'cancel', 'quiet'], ['lost', hu.uid, 'hunting', 'awake', null, 'quiet', null]]));
    // A settled exhibit later woken goes back to its home: its home is unchanged; and one that
    // had seen you is not surprised once dropped to awake (§8.2: changing mode resets nothing).
    const t = room(X, OPEN, [2, 2], [ex([3, 2], { mode: 'hunting', sawYou: true })]);
    X.Wake.quiet(t, 2, 2, N.QUIET_RANGE, { k: 'quiet', by: 'you' }, []);
    assert.equal(json([t.actors[1].mode, X.Combat.surprised(t.actors[0], t.actors[1])]), json(['awake', false]));
  });

  test('"Quiet, Please" measures 8 walking tiles to an exhibit\'s nearest tile, one beyond a case\'s nearest open neighbour, with no extra for a closed door', () => {
    const X = loadCore();
    const R = N.QUIET_RANGE, read = (s, x, y) => { const ev = []; X.Wake.quiet(s, x, y, R, { k: 'quiet', by: 'you' }, ev); return checked(X, ev); };
    // A 2×2 body: read at (14, 3), a body at (5, 2) has its tile (6, 3) 8 tiles off (its own
    // tile is 9); a body at (4, 2) is 9 tiles off at its nearest, (5, 3).
    for (const [at, quieted] of [[[5, 2], true], [[4, 2], false]]) {
      const s = room(X, open(18, 6), [14, 3], [ex(at, { size: 2, pips: 2 })]);
      read(s, 14, 3);
      assert.equal(s.actors[1].pips, quieted ? 0 : 2, `a 2×2 body at ${at}`);
    }
    // In a case: read at (1, 1), the case at (9, 1) is one beyond (8, 1), 7 off: 8; the case at
    // (10, 3) is one beyond (9, 2) or (9, 3), 8 off: 9.
    const cased = open(13, 5).map((row, y) => y === 1 ? row.slice(0, 9) + 'v' + row.slice(10) : y === 3 ? row.slice(0, 10) + 'v' + row.slice(11) : row);
    const c = room(X, cased, [1, 1], [ex([9, 1], { pips: 2 }), ex([10, 3], { pips: 2 })]);
    read(c, 1, 1);
    assert.equal(json(c.actors.slice(1).map(a => a.pips)), json([0, 2]), 'in a case 8 walking tiles off, quieted; 9, not');
    // A closed door on the way adds nothing: (9, 1) is 8 walking tiles from (1, 1) through the
    // door at (4, 1); (10, 1) is 9.
    const door = ['############', '#...+......#', '############'];
    const d = room(X, door, [1, 1], [ex([9, 1], { pips: 2 }), ex([10, 1], { pips: 2 })]);
    read(d, 1, 1);
    assert.equal(json(d.actors.slice(1).map(a => a.pips)), json([0, 2]), 'through a closed door, 8 walking tiles is within reach');
  });

  test('Fumigant\'s pip loss: a pip a turn from a sleeper, never below 0, never from a pipless one', () => {
    const X = loadCore();
    X.Registry.define('MODIFIERS', 'planted_disguise', {});
    X.Archetypes.addModifier('planted_disguise', { pipless: () => true });
    const s = room(X, OPEN, [9, 6], [ex([2, 2], { pips: 2 }), ex([3, 2], { mods: ['planted_disguise'] })]), [, a, m] = s.actors, ev = [];
    const fume = { k: 'fumigant', by: 'you' };
    X.Wake.addPips(s, a, -1, fume, ev); X.Wake.addPips(s, a, -1, fume, ev);
    assert.equal(a.pips, 1, 'once a turn');
    s.turn = 1; X.Wake.addPips(s, a, -1, fume, ev);
    s.turn = 2; X.Wake.addPips(s, a, -1, fume, ev);
    assert.equal(a.pips, 0, 'never below 0');
    assert.equal(X.Wake.addPips(s, m, -1, fume, ev), false);
    checked(X, ev);
    assert.equal(json(ev.map(e => [e.turn, e.pips, e.delta])), json([[0, 1, -1], [1, 0, -1]]));
  });

  test('the Re-admission Ticket: every hunter but the Watchman searches where it last knew you were, and its mark is called off; no one else changes', () => {
    const X = loadCore();
    const s = room(X, OPEN, [2, 2], [ex([8, 5], { mode: 'hunting', lastKnown: [6, 5] }), ex([9, 1], { mode: 'hunting', arch: 'night_watchman' }), ex([5, 5], { mode: 'awake', target: [1, 1] }), ex([3, 5], { pips: 1 })]);
    const [, hu, watch, aw, sl] = s.actors;
    hu.telegraph = { sp: 'ring', tiles: [[7, 5]], from: [[8, 5]], gross: 5, effect: 'damage', turn: 0, tick: 0 };
    const ev = [];
    X.Wake.lose(s, { k: 'ticket', by: 'you', item: 't1' }, ev);
    checked(X, said(X, ev));
    assert.equal(json([hu.mode, hu.lastKnown, hu.telegraph]), json(['searching', [6, 5], null]));
    assert.equal(json([watch.mode, aw.mode, aw.target, sl.mode, sl.pips]), json(['hunting', 'awake', [1, 1], 'dormant', 1]));
    assert.equal(json(ev.map(e => [e.k, e.who, e.cause.k, e.cause.why || e.to || null])), json([['special', hu.uid, 'cancel', 'ticket'], ['lost', hu.uid, 'ticket', 'searching']]));
    // Its last-known tile may be where a noise of yours was, not where it saw you (§8.2), so
    // the sentence says where it last knew you were.
    const line = X.Text.event(ev.find(e => e.k === 'lost'), null);
    assert.match(line, /searching where it last knew you were: you went back to the entrance\.$/, line);
    assert.doesNotMatch(line, /saw you/, line);
  });

  test('a pipless exhibit hears nothing and gains nothing from the ring, noise, axis, tether, ally_hit, decay or "Quiet, Please"', () => {
    const X = loadCore();
    X.Registry.define('MODIFIERS', 'planted_disguise', {});
    X.Archetypes.addModifier('planted_disguise', { pipless: () => true });
    const hide = extra => Object.assign({ mods: ['planted_disguise'] }, extra);
    const s = room(X, OPEN, [2, 2], [ex([3, 3], hide({ trigger: 'axis' })), ex([2, 4], hide({ trigger: 'tether', guards: [2, 4] })), ex([3, 2], { group: 'g' }), ex([4, 2], hide({ trigger: 'ally_hit', group: 'g' }))]);
    const ev = [];
    for (let i = 0; i < 4; i++) ev.push(...X.Step.step(s, { a: 'attack', uid: s.actors[3].uid }));
    X.Noise.emit(s, 2, 3, 'crash', { k: 'attack', by: 'you' }, ev);
    X.Wake.quiet(s, 2, 2, N.QUIET_RANGE, { k: 'quiet', by: 'you' }, ev);
    for (const a of [s.actors[1], s.actors[2], s.actors[4]]) {
      assert.equal(json([a.mode, a.pips]), json(['dormant', 0]), a.uid);
      assert.ok(!ev.some(e => (e.k === 'pip' || e.k === 'woke' || e.k === 'alerted') && e.who === a.uid), a.uid);
    }
  });

  test('every waking sentence is plain, and every noise is told as its caption: "<Class>: <what>, heard <range> tiles away."', () => {
    const X = loadCore();
    let n = 0, noises = 0, heardAt = 0;
    for (const acc of ['S9', 'A4', 'M11']) {
      const s = X.Dept.create(3, acc, 3, { invulnerable: true }), pick = X.Rng.stream({ seed: 7, rng: {} }, 'pick');
      for (let i = 0; i < 600 && !s.over; i++) {
        const legal = X.Step.legal(s), ev = X.Step.step(s, legal[pick.int(0, legal.length - 1)]), names = X.Labels.nameOf(s);
        for (const e of ev) {
          const line = X.Text.event(e, names);
          assert.ok(clean(line), `${json(e)} → ${line}`);
          if (e.k === 'noise') { noises++; assert.match(line, /^(Soft|Loud|Crash): .+, heard \d+ tiles away\.$/, line); }
          // A noise's waking, pip or alert names the noise's tile (§3.4: the source).
          if (['pip', 'woke', 'hunting', 'alerted'].includes(e.k) && e.cause && e.cause.k === 'noise') { heardAt++; assert.ok(Number.isInteger(e.cause.x) && Number.isInteger(e.cause.y), json(e)); }
          if (['noise', 'pip', 'woke', 'hunting', 'alerted', 'lost', 'returned'].includes(e.k)) n++;
        }
      }
    }
    // Every (kind, cause) pair of waking's, on made-up events with every field.
    const ev = [
      { k: 'noise', x: 1, y: 1, cls: 'loud', range: 6, cause: { k: 'planted' } },
      { k: 'pip', who: 'x', pips: 1, delta: 1, cause: { k: 'ally_hit', by: 'you', dist: 2 } },
      { k: 'woke', who: 'x', was: null, mode: 'awake', cause: { k: 'awake' } },
      { k: 'woke', who: 'x', was: 'dormant', mode: 'awake', cause: { k: 'noise', dist: 3 } },
      { k: 'hunting', who: 'x', was: 'searching', cause: { k: 'axis', dist: 3 } },
      { k: 'lost', who: 'x', from: 'hunting', to: 'awake', cause: { k: 'quiet', by: 'you' } },
      { k: 'lost', who: 'x', from: 'hunting', to: 'searching', cause: { k: 'ticket', by: 'you' } },
      { k: 'returned', who: 'x', phase: 'reinstalled', cause: { k: 'quiet', by: 'you' } },
    ];
    for (const e of ev) assert.ok(clean(X.Text.event(e, null)), json(e));
    assert.equal(X.Text.event(ev[0], null), 'Loud: a noise, heard 6 tiles away.');
    assert.ok(n > 100 && noises > 50, `${n} waking events, ${noises} noises, ${heardAt} heard`);
  });

  test('a sleeper the Window Pole moves without waking it (§8.5) is checked where the pole leaves it: pushed out of your ring it owes no ring pip; moved within your ring or onto your row, its ring and axis pips are still due', () => {
    const pole = [{ uid: 'w', kind: 'instrument', form: 'pole', tier: 1, where: { at: 'kit', slot: 'instrument' } }];
    const pillar = (x, y) => OPEN.map((r, j) => j === y ? r.slice(0, x) + '#' + r.slice(x + 1) : r);
    const use = (at, how) => [{ a: 'use', uid: 'w', x: at[0], y: at[1], how }];
    // Pushed out of your sight round a pillar at (4, 4), and to 4 walking tiles round one at
    // (4, 3): the boundary gives it no ring pip, and every invariant holds.
    for (const [map, at, to] of [[pillar(4, 4), [5, 4], [6, 5]], [pillar(4, 3), [5, 2], [6, 1]]]) {
      const s = room(C, map, [3, 3], [ex(at)], {}, { items: pole });
      const r = H.play(C, s, use(at, 'push'), { inv: 'all', clone: true }), a = r.state.actors[1];
      assert.equal(json([a.x, a.y, a.mode]), json([to[0], to[1], 'dormant']), `pushed from ${at}`);
      assert.equal(pipsOf(r.events, a.uid).length, 0, `pushed to ${to}, outside your ring, it gains no pip`);
      assert.equal(json(r.violations.map(v => v.text)), '[]', `pushed from ${at}`);
    }
    // Pushed from (4, 3) to (5, 3), still inside your ring: with the ring planted out, the
    // invariant asks for the ring pip on the tile it was pushed to.
    const X = loadCore();
    X.Vision.ringDist = () => -1;
    let r = H.play(X, room(X, OPEN, [3, 3], [ex([4, 3])], {}, { items: pole }), use([4, 3], 'push'), { inv: ['waking'] });
    assert.ok(r.violations.some(v => v.inv === 'waking.ring_due' && /slept on 5,3,/.test(v.text)), json(r.violations.map(v => v.text)));
    // Pulled from (5, 4) onto your row at (4, 3): an axis sleeper gains its axis pip there, and
    // with the axis planted out the invariant asks for it.
    r = H.play(C, room(C, OPEN, [3, 3], [ex([5, 4], { trigger: 'axis' })], {}, { items: pole }), use([5, 4], 'pull'), { inv: 'all', clone: true });
    assert.equal(json([r.state.actors[1].x, r.state.actors[1].y]), json([4, 3]));
    assert.equal(json(pipsOf(r.events, r.state.actors[1].uid).map(e => e.cause.k)), json(['ring', 'axis']));
    assert.equal(json(r.violations.map(v => v.text)), '[]');
    const Y = loadCore();
    Y.Wake.onAxis = () => false;
    r = H.play(Y, room(Y, OPEN, [3, 3], [ex([5, 4], { trigger: 'axis' })], {}, { items: pole }), use([5, 4], 'pull'), { inv: ['waking'] });
    assert.ok(r.violations.some(v => v.inv === 'waking.axis' && /its tile 4,3,/.test(v.text)), json(r.violations.map(v => v.text)));
  });

  test('the waking invariants hold over department monkeys, and each fails on its planted fault, a broken trigger or wake rule among them', () => {
    // Monkeys in the three departments with the waking invariants after every step.
    for (const acc of ['S9', 'A4', 'M11']) {
      const s = C.Dept.create(5, acc, 4, { invulnerable: true }), pick = C.Rng.stream({ seed: 11, rng: {} }, 'pick');
      const r = H.play(C, s, (st) => { const l = C.Step.legal(st); return l[pick.int(0, l.length - 1)]; }, { inv: ['waking'], cap: 400 });
      assert.equal(json(r.violations.map(v => v.text)), '[]', acc);
    }
    // Each planted fault, in a core of its own, breaks its invariant in a short run. The rules
    // call these through their namespaces, so a fault planted there is one the rules make.
    const fresh = () => { const X = loadCore(); return X; };
    const faults = [
      // Hearing that forgets a noise pip was already given this turn; two hunters strike you
      // in the same turn, each blow a noise beside the sleeper.
      ['waking.once_a_turn', () => {
        const X = fresh(), hear = X.Wake.hear;
        X.Wake.hear = (st, a, noise, dist, ev) => { if (a.pipTurns) delete a.pipTurns.noise; return hear(st, a, noise, dist, ev); };
        return [X, room(X, open(12, 10), [2, 2], [ex([3, 2], { mode: 'hunting' }), ex([2, 3], { mode: 'hunting' }), ex([4, 4], {})]), [{ a: 'wait' }, { a: 'wait' }]];
      }],
      // A ring that forgets line of sight: a sleeper behind a closed door, 2 walking tiles away.
      ['waking.ring_pip', () => {
        const X = fresh();
        X.Vision.ringDist = (st, x, y, f) => { const d = X.Grid.reachDist(f.dist, st.dept, x, y); return d >= 0 && d <= f.r ? d : -1; };
        return [X, room(X, ['#######', '#..+..#', '#######'], [2, 1], [ex([4, 1])]), [{ a: 'wait' }]];
      }],
      // Waking that leaves the pips on.
      ['waking.pips_range', () => {
        const X = fresh(), onWake = X.Archetypes.onWake;
        X.Archetypes.onWake = (st, a) => { onWake(st, a); a.pips = 2; };
        return [X, room(X, OPEN, [2, 2], [ex([3, 2], { pips: 2 })]), [{ a: 'wait' }]];
      }],
      // A woke event that tells another turn than the story keeps.
      ['waking.story', () => {
        const X = fresh(), emit = X.Causes.emit;
        X.Causes.emit = (st, ev, k, f, c) => { const e = emit(st, ev, k, f, c); if (k === 'woke') e.turn += 1; return e; };
        return [X, room(X, OPEN, [2, 2], [ex([3, 2], { pips: 2 })]), [{ a: 'wait' }]];
      }],
      // A mimic in its disguise that the rules forget is pipless while they act.
      ['waking.pipless', () => {
        const X = fresh();
        X.Registry.define('MODIFIERS', 'planted_disguise', {});
        X.Archetypes.addModifier('planted_disguise', { pipless: () => true });
        const pipless = X.Archetypes.pipless, step = X.Step.step;
        let inStep = false;
        X.Archetypes.pipless = (st, a) => inStep ? false : pipless(st, a);
        X.Step.step = (st, action) => { inStep = true; try { return step(st, action); } finally { inStep = false; } };
        return [X, room(X, OPEN, [2, 2], [ex([3, 2], { mods: ['planted_disguise'] })]), [{ a: 'wait' }]];
      }],
      // A woke event that says the exhibit was awake.
      ['waking.woke_from', () => {
        const X = fresh(), emit = X.Causes.emit;
        X.Causes.emit = (st, ev, k, f, c) => { const e = emit(st, ev, k, f, c); if (k === 'woke') e.was = 'awake'; return e; };
        return [X, room(X, OPEN, [2, 2], [ex([3, 2], { pips: 2 })]), [{ a: 'wait' }]];
      }],
      // A ring 2 tiles too wide: after a wait (radius 2) a sleeper 4 tiles east gains pips whose
      // cause says radius 4, distance 4.
      ['waking.ring_pip', () => {
        const X = fresh(), field = X.Vision.field;
        X.Vision.field = st => { const f = field(st); f.r += 2; f.dist = X.Grid.distances(st.dept, [[f.x, f.y]], f.r); return f; };
        return [X, room(X, open(9, 7), [1, 4], [ex([5, 4])]), [{ a: 'wait' }, { a: 'wait' }]];
      }],
      // A ring measured as the crow flies: the sleeper behind the glass at (2, 4) is 2 tiles off
      // that way, 4 by walking round it.
      ['waking.ring_pip', () => {
        const X = fresh();
        X.Vision.ringDist = (st, x, y, f) => { f = f || X.Vision.field(st); if (!X.Grid.hold(st.dept, x, y)) return -1; const d = X.Grid.chebyshev(f.x, f.y, x, y); return d <= f.r && X.Grid.los(st.dept, f.x, f.y, x, y) ? d : -1; };
        return [X, room(X, ['#######', '#.....#', '#.....#', '#.....#', '#.v...#', '#.....#', '#######'], [1, 4], [ex([3, 4])]), [{ a: 'wait' }]];
      }],
      // No ring pip at all: a sleeper beside you sleeps on.
      ['waking.ring_due', () => {
        const X = fresh();
        X.Vision.ringDist = () => -1;
        return [X, room(X, OPEN, [2, 2], [ex([3, 2])]), [{ a: 'wait' }]];
      }],
      // Hearing that does nothing: you open a door at (2, 1), 3 walking tiles from a sleeper at
      // (5, 1), which is 4 from you and outside your ring.
      ['waking.noise_due', () => {
        const X = fresh();
        X.Wake.hear = () => false;
        return [X, room(X, ['#########', '#.+.....#', '#########'], [1, 1], [ex([5, 1])]), [{ a: 'move', dir: 2 }]];
      }],
      // An axis that never finds you: you wait 8 tiles along its row.
      ['waking.axis', () => {
        const X = fresh();
        X.Wake.onAxis = () => false;
        return [X, room(X, open(26, 8), [10, 3], [ex([2, 3], { trigger: 'axis' })]), [{ a: 'wait' }]];
      }],
      // A tether that never holds: you wait 2 tiles from what it guards, round a wall from it.
      ['waking.tether', () => {
        const X = fresh();
        X.Wake.inTether = () => false;
        return [X, room(X, open(20, 12), [14, 4], [ex([2, 9], { trigger: 'tether', guards: [12, 4] })]), [{ a: 'wait' }]];
      }],
      // ally_hit that does nothing: you strike one of its group 4 tiles from it.
      ['waking.ally_hit', () => {
        const X = fresh();
        X.Wake.allyHit = () => {};
        return [X, room(X, open(16, 10), [2, 5], [ex([3, 5], { group: 'g' }), ex([7, 5], { group: 'g', trigger: 'ally_hit' })]), s => s.turn === 0 ? { a: 'attack', uid: s.actors[1].uid } : null];
      }],
      // An exhibit that never sleeps sent to sleep, and one sent back home (the first step to sleep).
      ['waking.awake', () => {
        const X = fresh(), act = X.AI.act;
        X.AI.act = (st, a, ev) => { if (a.trigger === 'awake' && a.mode === 'awake') X.Wake.setMode(st, a, 'dormant', { k: 'quiet', by: 'you' }, ev); return act(st, a, ev); };
        return [X, room(X, open(26, 8), [2, 3], [ex([22, 3], { mode: 'awake', trigger: 'awake', target: [22, 3] })]), Array(3).fill({ a: 'wait' })];
      }],
      ['waking.awake', () => {
        const X = fresh(), act = X.AI.act;
        X.AI.act = (st, a, ev) => { if (a.trigger === 'awake' && a.mode === 'awake') X.Wake.setMode(st, a, 'returning', { k: 'idle', turns: N.AWAKE_IDLE_TURNS }, ev); return act(st, a, ev); };
        return [X, room(X, open(26, 8), [2, 3], [ex([22, 3], { mode: 'awake', trigger: 'awake', target: [22, 3] })]), Array(3).fill({ a: 'wait' })];
      }],
    ];
    for (const [id, make] of faults) {
      const [X, s, actions] = make(), base = X.State.clone(s);
      const r = H.play(X, s, actions, { inv: ['waking'] });
      assert.ok(r.violations.some(v => v.inv === id), `${id}: ${json(r.violations.map(v => v.text))}`);
      // The same run in a sound core breaks nothing.
      const ok = H.play(C, C.State.clone(base), actions, { inv: ['waking'] });
      assert.equal(json(ok.violations.map(v => v.text)), '[]', id);
    }
    // Every invariant of the file has a planted fault here.
    const ids = require('./behaviour/waking.inv.js')(C).map(i => i.id);
    assert.equal(json(ids.filter(i => !faults.some(([id]) => id === i))), '[]');
  });
};
