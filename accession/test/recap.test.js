// The death recap (BUILD.md §3.4, §8.1; Text.recap, js/core/text/recap.js): what killed you,
// why it was awake, and when and how it woke, read from the killer's own story. Six deaths,
// each played through step(): an exhibit woken by your ring; one woken, settled back home and
// woken again by the axis trigger (the recap tells the second waking); one whose waking lies
// more than 64 cause records back; the Night Watchman, on its rounds; a splitter's half; and
// your own Pin-Driver bolt sent back by a reflector, which is the reflector's (D2.16). Each
// recap is compared with one rebuilt from the full event log, as W2b-BATTERY's
// Recap.fromLog will do after every death in the battery (criterion 6).
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, State, Text, Labels, Roles, N } = C;
  const J = v => JSON.parse(JSON.stringify(v));
  const BAD = /undefined|NaN|\[object|null/;

  // Play until the visit is over (or cap steps), keeping every event.
  function play(s, decide, cap) {
    const events = [];
    for (let i = 0; i < (cap || 400) && !s.over; i++) events.push(...Step.step(s, typeof decide === 'function' ? decide(s, i) : decide));
    return events;
  }
  // The recap rebuilt from the full log (§3.4; criterion 6): the killer is the cause's `by` of
  // your death; its waking is its last woke event (a creation's included), or the starting
  // state's story; its hunt began at its last hunting event, or a creation into a hunt.
  function fromLog(start, events) {
    const died = events.filter(e => e.k === 'died' && e.who === 'you').pop();
    if (!died) return null;
    const killer = died.cause && typeof died.cause.by === 'string' ? died.cause.by : null;
    const mine = events.filter(e => e.who === killer);
    const woke = mine.filter(e => e.k === 'woke').pop(), hunt = mine.filter(e => e.k === 'hunting' || (e.k === 'woke' && e.was === null && e.mode === 'hunting')).pop();
    const a0 = start.actors.find(a => a.uid === killer);
    return { killer, wakeTurn: woke ? woke.turn : a0 && a0.woke ? a0.woke.turn : null, wakeTrigger: woke ? woke.cause.k : a0 && a0.woke ? a0.woke.cause.k : null,
      huntTurn: hunt ? hunt.turn : a0 && a0.hunted ? a0.hunted.turn : null };
  }
  // The recap of a death, checked against the log and for clean words.
  function recapped(start, s, events, where) {
    assert.equal(s.over && s.over.k, 'died', `${where}: you did not die`);
    const r = Text.recap(s, Labels.nameOf(s));
    assert.ok(r, where);
    assert.deepEqual(J({ killer: r.killer, wakeTurn: r.wakeTurn, wakeTrigger: r.wakeTrigger, huntTurn: r.huntTurn }), fromLog(start, events), `${where}: the recap and the log disagree`);
    for (const l of r.lines) assert.ok(typeof l === 'string' && l && !BAD.test(l), `${where}: ${l}`);
    // Without a nameOf, Text.recap names exhibits as Labels.nameOf does.
    assert.deepEqual(J(Text.recap(s)), J(r));
    return r;
  }
  const name = (s, uid) => { const n = Labels.nameOf(s)(uid); return n.charAt(0).toUpperCase() + n.slice(1); };
  // The fatal blow, as the log told it.
  const blow = (events, s) => Text.event(events.filter(e => e.k === 'damaged' && e.who === 'you').pop(), Labels.nameOf(s));
  const OPEN = ['###########', '#.........#', '#.........#', '#.........#', '###########'];
  const ex = (sp, at, extra) => Object.assign({ sp: sp.id || sp, at, mode: 'dormant', stats: Roles.stats(sp.role || 'fodder', 3) }, extra);

  test('Text.recap is null unless you died: alive, or gone out by an exit', () => {
    const s = Setup.room(1, { acc: 'M11', depth: 3, map: OPEN, you: [2, 2], exits: [[2, 2]] });
    assert.equal(Text.recap(s), null);
    Step.step(s, { a: 'leave', i: 0 });
    assert.equal(s.over.k, 'left');
    assert.equal(Text.recap(s), null);
  });

  test('woken by your ring, then it killed you: the recap names it, its blow, and when and why it woke', () => {
    const sp = C.Packs.species('M11', 'M11.5');
    const s = Setup.room(1, { acc: 'M11', depth: 3, map: OPEN, you: [2, 2], exhibits: [ex(sp, [4, 2])] });
    s.actors[0].hp = 1;
    const start = State.clone(s), events = play(s, { a: 'wait' }), a = s.actors[1];
    const r = recapped(start, s, events, 'ring');
    assert.equal(r.killer, a.uid);
    assert.equal(r.wakeTrigger, 'ring');
    assert.equal(r.huntTurn, r.wakeTurn, 'it woke into a hunt');
    assert.deepEqual(J(r.lines), [`${name(s, a.uid)} defeated you on turn ${s.over.turn}.`, blow(events, s),
      `On turn ${r.wakeTurn}, ${Labels.nameOf(s)(a.uid)} woke and is hunting you: you stayed inside your ring.`]);
  });

  test('woken, settled back home, then woken again by the axis trigger: the recap tells the second waking', () => {
    // A Heliograph (axis_sniper, trigger axis) at the west end of the north room; a door at
    // the east end to the south room.
    const MAP = ['###########', '#.........#', '#.........#', '#########+#', '#.........#', '#.........#', '###########'];
    const sp = C.Packs.species('M11', 'M11.1');
    const s = Setup.room(3, { acc: 'M11', depth: 3, map: MAP, you: [3, 1], exhibits: [ex(sp, [1, 1], { stats: Roles.stats('artillery', 3) })] });
    const you = s.actors[0], a = s.actors[1];
    you.hp = you.maxHp = 999;
    const start = State.clone(s), events = [];
    const walk = (x, y) => { for (let i = 0; i < 40 && !(you.x === x && you.y === y); i++) { const p = C.Path.to(s, x, y); if (!p.length) break; events.push(...Step.step(s, { a: 'move', dir: C.Path.dirTo([you.x, you.y], p[0]) })); } };
    // 1. Wait beside it until it wakes.
    for (let i = 0; i < 20 && a.mode === 'dormant'; i++) events.push(...Step.step(s, { a: 'wait' }));
    assert.equal(a.mode, 'hunting', 'it woke');
    const first = J(a.woke);
    // 2. Go south through the door, out of its sight, and wait until it has gone back and settled.
    walk(9, 3); walk(1, 5);
    for (let i = 0; i < 300 && a.mode !== 'dormant'; i++) events.push(...Step.step(s, { a: 'wait' }));
    assert.equal(a.mode, 'dormant', 'it settled back');
    assert.ok(events.some(e => e.k === 'returned' && e.who === a.uid && e.phase === 'reinstalled'), 'reinstalled');
    // 3. Back north, into its row 8 tiles off, outside your ring: the axis wakes it.
    walk(9, 3); walk(9, 1);
    for (let i = 0; i < 20 && a.mode === 'dormant'; i++) events.push(...Step.step(s, { a: 'wait' }));
    assert.equal(a.woke.cause.k, 'axis', `woken again by the axis: ${JSON.stringify(a.woke)}`);
    assert.ok(a.woke.turn > first.turn);
    you.hp = 1;
    events.push(...play(s, { a: 'wait' }));
    const r = recapped(start, s, events, 'axis');
    assert.equal(r.killer, a.uid);
    assert.equal(r.wakeTrigger, 'axis');
    assert.equal(r.wakeTurn, a.woke.turn);
    assert.ok(r.lines.some(l => l === `On turn ${a.woke.turn}, ${Labels.nameOf(s)(a.uid)} woke and is hunting you: you stood in its row or column.`), r.lines.join('\n'));
    assert.ok(!r.lines.some(l => l.includes(`turn ${first.turn},`)), 'the first waking is not the story');
    assert.equal(s.over.cause.k, 'special', 'its beam killed you');
  });

  test('woken by noise, it came to look, saw you and hunted you: the recap tells the waking and, later, the hunt', () => {
    // The Trolley behind a pillar, out of your sight and 5 walking tiles off (so no ring
    // pip); your Tuning Fork rings beside it three times, a noise of yours it hears.
    const MAP = ['###########', '#.........#', '#.........#', '#....#....#', '#.........#', '###########'];
    const sp = C.Packs.species('M11', 'M11.5');
    const s = Setup.room(4, { acc: 'M11', depth: 3, map: MAP, you: [5, 1], exhibits: [ex(sp, [5, 4])],
      items: [{ uid: 'M11.3.room.i1', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } }] });
    const you = s.actors[0], a = s.actors[1];
    you.hp = 1;
    const start = State.clone(s), events = play(s, (t, i) => a.mode === 'dormant' && i < 3 ? { a: 'use', uid: 'M11.3.room.i1', x: 3, y: 4 } : { a: 'wait' }, 60);
    const r = recapped(start, s, events, 'noise');
    assert.equal(r.killer, a.uid);
    assert.equal(r.wakeTrigger, 'noise');
    assert.ok(r.huntTurn > r.wakeTurn, `it hunted after it woke: ${r.wakeTurn}, ${r.huntTurn}`);
    const names = Labels.nameOf(s);
    assert.deepEqual(J(r.lines.slice(2)), [`On turn ${r.wakeTurn}, ${names(a.uid)} woke: it heard a soft noise, and goes to look.`,
      `On turn ${r.huntTurn}, ${names(a.uid)} saw you and is hunting you.`]);
  });

  test('a waking more than 64 cause records back: the recap still reads it, from the killer\'s own story', () => {
    const sp = C.Packs.species('M11', 'M11.5');
    // A fixed dummy to strike (each hit a damaged record) while the Trolley, woken by your
    // ring, closes in; then it kills you.
    const s = Setup.room(2, { acc: 'M11', depth: 3, map: OPEN, you: [2, 2], exhibits: [ex(sp, [4, 2]),
      { sp: 'dummy', at: [1, 2], mode: 'hunting', stats: { hp: 9999, acc: -50, eva: -50, pad: 0, dmin: 1, dmax: 1 }, statuses: [{ id: 'fixed', turns: 999 }] }] });
    const you = s.actors[0], a = s.actors[1], dummy = s.actors[2];
    you.hp = you.maxHp = 9999; you.acc = 99;
    const start = State.clone(s), events = [];
    for (let i = 0; i < 40 && a.mode === 'dormant'; i++) events.push(...Step.step(s, { a: 'wait' }));
    assert.equal(a.mode, 'hunting');
    const woke = J(a.woke);
    for (let i = 0; i < 120; i++) events.push(...Step.step(s, { a: 'attack', uid: dummy.uid }));
    assert.ok(!s.causes.some(r => r.k === 'woke' && r.who === a.uid), 'its waking is no longer among the cause records');
    assert.equal(s.causes.length, N.CAUSE_RECORDS);
    you.hp = 1;
    events.push(...play(s, { a: 'wait' }));
    const r = recapped(start, s, events, '64 records');
    assert.equal(r.killer, a.uid);
    assert.deepEqual([r.wakeTurn, r.wakeTrigger], [woke.turn, 'ring']);
    assert.ok(r.lines.includes(`On turn ${woke.turn}, ${Labels.nameOf(s)(a.uid)} woke and is hunting you: you stayed inside your ring.`), r.lines.join('\n'));
  });

  test('the Night Watchman: on its rounds, hunting you from the start', () => {
    const s = Setup.room(1, { acc: 'M11', depth: 3, map: OPEN, you: [6, 2], clock: { B: 1, G: 1 }, entrance: [1, 2] });
    s.actors[0].hp = 1;
    const start = State.clone(s), events = play(s, { a: 'wait' });
    const w = s.actors.find(a => a.arch === 'night_watchman');
    const r = recapped(start, s, events, 'watchman');
    assert.equal(r.killer, w.uid);
    assert.equal(r.wakeTrigger, 'night_watch');
    assert.equal(r.huntTurn, r.wakeTurn);
    assert.deepEqual(J(r.lines), [`The Night Watchman defeated you on turn ${s.over.turn}.`, blow(events, s),
      `On turn ${r.wakeTurn}, the Night Watchman is on its rounds, hunting you from the start.`]);
  });

  test('a splitter\'s half: the recap tells how the body woke, then how it split', () => {
    const sp = C.Packs.species('A4', 'A4.4');
    let found = 0;
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const s = Setup.room(seed, { acc: 'A4', depth: 3, map: OPEN, you: [3, 2], exhibits: [ex(sp, [4, 2], { stats: Roles.stats('brute', 3) })] });
      const you = s.actors[0], body = s.actors[1];
      you.hp = 1; you.acc = 99;
      const start = State.clone(s), events = Step.step(s, { a: 'attack', uid: body.uid });
      if (s.actors.length < 3) continue;
      events.push(...play(s, { a: 'wait' }));
      if (!s.over || s.over.cause.by !== s.actors[2].uid) continue;
      const half = s.actors[2], r = recapped(start, s, events, `split, seed ${seed}`), names = Labels.nameOf(s);
      assert.equal(r.killer, half.uid);
      assert.equal(r.wakeTrigger, 'summoned');
      assert.deepEqual(J(r.lines), [`${name(s, half.uid)} defeated you on turn ${s.over.turn}.`, blow(events, s),
        `On turn ${body.woke.turn}, ${names(body.uid)} woke: it was struck.`,
        `On turn ${half.woke.turn}, ${names(body.uid)} splits in two, under your hit; the new half is hunting you.`]);
      assert.ok(r.lines[0].startsWith('A split of the '), r.lines[0]);
      found = seed;
    }
    assert.ok(found, 'a half killed you within 40 seeds');
  });

  test('your own Pin-Driver bolt sent back by a reflector: the recap is the reflector\'s, from its own story', () => {
    const sp = C.Packs.species('M11', 'M11.4');
    let found = 0;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const s = Setup.room(seed, { acc: 'M11', depth: 3, map: OPEN, you: [2, 2], exhibits: [ex(sp, [4, 2], { stats: Roles.stats('controller', 3) })],
        items: [{ uid: 'M11.3.room.i1', kind: 'instrument', form: 'pin_driver', tier: 2, where: { at: 'kit', slot: 'instrument' } }] });
      const you = s.actors[0], dish = s.actors[1];
      you.hp = you.maxHp = 999;
      const start = State.clone(s), events = [];
      for (let i = 0; i < 20 && dish.mode === 'dormant'; i++) events.push(...Step.step(s, { a: 'wait' }));
      if (dish.mode === 'dormant') continue;
      you.hp = 1;
      events.push(...Step.step(s, { a: 'use', uid: 'M11.3.room.i1', x: dish.x, y: dish.y }));
      if (!s.over || s.over.cause.k !== 'reflected') continue;
      const r = recapped(start, s, events, `reflected, seed ${seed}`), names = Labels.nameOf(s);
      assert.equal(r.killer, dish.uid, 'the killer is the reflector');
      assert.equal(s.over.cause.shooter, 'you');
      assert.equal(r.wakeTrigger, dish.woke.cause.k);
      assert.equal(r.lines[0], `${name(s, dish.uid)} defeated you on turn ${s.over.turn}.`);
      assert.equal(r.lines[1], blow(events, s));
      assert.ok(r.lines[1].includes(names(dish.uid).replace(/^the /, '')), r.lines[1]);
      assert.ok(r.lines.includes(`On turn ${dish.woke.turn}, ${names(dish.uid)} woke and is hunting you: you stayed inside your ring.`), r.lines.join('\n'));
      found = seed;
    }
    assert.ok(found, 'a bolt sent back killed you within 60 seeds');
  });

  test('a killer that never woke, and a death with no one to blame, are told plainly', () => {
    const s = Setup.room(1, { acc: 'M11', depth: 3, map: OPEN, you: [2, 2], exhibits: [ex(C.Packs.species('M11', 'M11.5'), [5, 2])] });
    const a = s.actors[1];
    s.over = { k: 'died', turn: 7, by: a.uid, door: null, cause: { k: 'attack', by: a.uid } };
    let r = Text.recap(s);
    assert.deepEqual(J(r), { killer: a.uid, wakeTurn: null, wakeTrigger: null, huntTurn: null,
      lines: [`${name(s, a.uid)} defeated you on turn 7.`, `${name(s, a.uid)} had not woken.`] });
    s.over = { k: 'died', turn: 7, by: null, door: null, cause: {} };
    r = Text.recap(s);
    assert.deepEqual(J(r), { killer: null, wakeTurn: null, wakeTrigger: null, huntTurn: null, lines: ['You fell on turn 7.'] });
  });
};
