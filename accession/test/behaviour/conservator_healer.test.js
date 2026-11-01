// ACCESSION — the conservator_healer archetype and its special, restore (BUILD.md §5.3, §8.1; M4
// plan D3.7, D3.13; ARCH-CLOCKWORK): its line, "Keeps {CONSERVATOR_KEEP} tiles from you, stepping
// away when you come nearer, and never strikes; it marks the tile of the ally it sees within
// {SIGHT_EXHIBIT} tiles that has lost the most health, and at its next action restores up to
// {CONSERVATOR_HEAL_PCT}% of the maximum health of the exhibit standing there.", for every pack
// species with it (A.4's Countersigning Clerk, A4.5, which has clockwork too) at depths 1–7,
// joined up: the real core, real actions only, every invariant checked after every step
// (arch-d.inv.js's healer invariants among them), clone-checked. Each runs with clockwork on (the
// pack's species) and again with it switched off, the healer's own moves then made at once, so
// the clause holds either way. Unit tests plant the cases no scenario reaches by real actions:
// which ally it picks, an ally moved off its marked tile, the label's lines. What is expected
// is worked out here from the line and §8.1, not from rules/arch/conservator_healer.js.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Roles, N, Int, Grid, Archetypes, Packs, Labels, Specials, Text, ConservatorHealer } = C;
  const json = x => JSON.stringify(x);
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const ROW = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
  const SECTION = [{ key: 'sone', role: 'section', x0: 1, y0: 1, x1: 14, y1: 5 }];
  const key = t => `${t[0]},${t[1]}`;
  const role = id => Packs.species(id.split('.')[0], id).role;
  const hurt = (id, at, depth, hp, more) => Object.assign({ sp: id, at, hp, maxHp: Roles.stats(role(id), depth).hp, stats: Roles.stats(role(id), depth) }, more || {});
  function room(X, depth, opts, o) {
    const ex = o.exhibits.map(e => Object.assign({ stats: Roles.stats(role(e.sp), depth) }, e));
    const s = H.room(X, opts.seed || 1, { acc: 'A4', depth, map: o.map || ROW, you: o.you, exhibits: ex, rooms: SECTION }, { rulesOff: opts.rulesOff || [] });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  }
  const list = () => { const l = H.species(C, 'conservator_healer'); assert.ok(l.length >= 7, `${l.length} species and depths`); return l; };
  // Each scenario with clockwork on and off: the healer's clause holds either way.
  const both = sc => list().flatMap(({ sp, depth }) => [[], ['clockwork']].map(off => H.run(C, sc, sp, depth, { rulesOff: off })));

  // ---- The restore is shown, and heals what it shows ----
  // Two hurt sleepers in its sight, one beside it (its walk short) that has lost less, one far
  // off that has lost the most: it marks the latter's tile, the mark is on the board at your
  // next decision, and at its next action that exhibit regains its share; the mark is gone.
  let boards = [];
  const restores = H.scenario({
    name: 'it marks the tile of the ally it sees that has lost the most health; the mark is shown at your next decision; at its next action that ally regains up to its share, never past its maximum',
    id: 'conservator_healer', clone: true,
    build: (params, sp, depth, opts) => room(C, depth, opts, { you: [2, 1], exhibits: [{ sp: sp.id, at: [8, 3], mode: 'hunting' },
      hurt('A4.1', [9, 3], depth, Roles.stats('fodder', depth).hp - 2), hurt('A4.4', [14, 5], depth, 3)] }),
    actions(s, i) {
      if (i === 0) boards = [];
      boards.push(Specials.marks(s).filter(k => k.by === s.actors[1].uid).map(k => [k.kind, key([k.x, k.y])]));
      return i < 6 ? { a: 'wait' } : null;
    },
    expect(r, params, sp, depth) {
      const h = r.start.actors[1], near = r.start.actors[2], far = r.start.actors[3];
      const marks = r.events.filter(e => e.k === 'telegraphed' && e.who === h.uid);
      if (!marks.length) return 'it marked nothing';
      if (json(marks[0].tiles) !== json([[far.x, far.y]])) return `it marked ${json(marks[0].tiles)}, not the tile of the one that has lost the most, ${key([far.x, far.y])}`;
      const at = r.steps.findIndex(st => st.events.includes(marks[0]));
      if (json(boards[at + 1]) !== json([['call', key([far.x, far.y])]])) return `at your next decision the board showed ${json(boards[at + 1])}`;
      const healed = r.events.filter(e => e.k === 'healed' && e.cause.k === 'restore');
      const want = Math.min(Int.pct(far.maxHp, N.CONSERVATOR_HEAL_PCT), far.maxHp - far.hp);
      if (!healed.length || healed[0].who !== far.uid || healed[0].amount !== want || healed[0].cause.by !== h.uid) return `the restore healed ${json(healed[0])}, not ${far.uid} by ${want}`;
      const after = r.steps.findIndex(st => st.events.includes(healed[0]));
      if (after !== at + 1) return `it went off at step ${after}, not at its next action (step ${at + 1})`;
      if (boards[after + 1] && boards[after + 1].some(([, t]) => t === key([far.x, far.y])) && !r.steps[after + 1].events.some(e => e.k === 'telegraphed')) return 'the mark stayed after it went off';
      const names = Labels.nameOf(r.state);
      if (Text.event(marks[0], names) !== `${names(h.uid).replace(/^t/, 'T')} marks an ally for its restore, at its next action.`) return `its mark read "${Text.event(marks[0], names)}"`;
      if (Text.event(healed[0], names) !== `${names(h.uid).replace(/^t/, 'T')} restored ${want} health to ${names(far.uid)}: now ${far.hp + want}.`) return `its healing read "${Text.event(healed[0], names)}"`;
      if (r.events.some(e => e.k === 'attacked' && e.by === h.uid)) return 'it struck';
      if (params.CONSERVATOR_KEEP !== N.CONSERVATOR_KEEP) return `its line's numbers are ${json(params)}`;
      return null;
    },
  });
  test('the restore is shown and heals what it shows: the tile of the ally that has lost the most, marked until its next action, then up to its share of its maximum health, at depths 1–7, with clockwork on and off, clone-checked', () => {
    ok(both(restores), restores.name);
  });

  // ---- It keeps its distance, and never strikes ----
  // You walk up beside it, then wait: once you are nearer than its distance it steps away (with
  // clockwork, at its next action, as its arrow then shows), until it is that far from you
  // again. Then, cornered in the room's north-east corner with you beside it, it has no step
  // that takes it further, and never strikes: it waits.
  const walk = (s, a) => { const m = s.dept, you = s.actors[0]; return Grid.distances(m, [[you.x, you.y]], m.w * m.h, null, 'exhibit')[a.y * m.w + a.x]; };
  let far = [];
  const keeps = H.scenario({
    name: 'it keeps its distance from you, stepping away when you come nearer, and never strikes, even cornered',
    id: 'conservator_healer', clone: true,
    build: (params, sp, depth, opts) => room(C, depth, opts, { you: [3, 3], exhibits: [{ sp: sp.id, at: [7, 3], mode: 'hunting' }] }),
    actions(s, i) {
      if (i === 0) far = [];
      far.push(walk(s, s.actors[1]));
      return i < 3 ? { a: 'move', dir: 2 } : i < 9 ? { a: 'wait' } : null;
    },
    expect(r) {
      const a = r.start.actors[1];
      if (r.events.some(e => e.k === 'attacked' && e.by === a.uid)) return 'it struck';
      if (!r.events.some(e => e.k === 'moved' && e.who === a.uid)) return 'it never stepped away';
      if (far[far.length - 1] < N.CONSERVATOR_KEEP) return `after you waited it was ${far[far.length - 1]} walking tiles from you, nearer than ${N.CONSERVATOR_KEEP}`;
      return null;
    },
  });
  const cornered = H.scenario({
    name: 'cornered with you beside it, it has no step that takes it further from you, and never strikes: it waits',
    id: 'conservator_healer', clone: true,
    build: (params, sp, depth, opts) => room(C, depth, opts, { you: [12, 2], exhibits: [{ sp: sp.id, at: [14, 1], mode: 'hunting' }] }),
    actions: (s, i) => i === 0 ? { a: 'move', dir: 2 } : i < 8 ? { a: 'wait' } : null,
    expect(r) {
      const a = r.start.actors[1], end = r.state.actors[1];
      if (r.events.some(e => e.k === 'attacked' && e.by === a.uid)) return 'it struck';
      if (end.x !== 14 || end.y !== 1 || r.events.some(e => e.k === 'moved' && e.who === a.uid)) return `it moved, to ${end.x},${end.y}`;
      return null;
    },
  });
  test('it keeps its distance from you, stepping away when you come nearer, and never strikes, even cornered, at depths 1–7, with clockwork on and off, clone-checked', () => {
    ok(both(keeps), keeps.name);
    ok(both(cornered), cornered.name);
  });

  // ---- Unit tests ----
  test('which ally: the one it sees that has lost the most health, the first in spawn order on a tie; never you, itself, an exhibit in an intact case, one out of its sight, nor one the restore would give nothing back (its share under 1)', () => {
    const depth = 4, at = (s, uid) => ConservatorHealer.target(s, s.actors[1]) && ConservatorHealer.target(s, s.actors[1]).uid;
    const fod = Roles.stats('fodder', depth).hp;
    const base = more => room(C, depth, {}, { you: [1, 1], exhibits: [{ sp: 'A4.5', at: [7, 3], mode: 'hunting' }].concat(more) });
    // The most lost; on a tie, the first.
    let s = base([hurt('A4.1', [9, 3], depth, fod - 2), hurt('A4.1', [5, 3], depth, fod - 5), hurt('A4.1', [7, 5], depth, fod - 5)]);
    assert.equal(at(s, 'x'), s.actors[3].uid);
    // Itself hurt: never.
    s = base([]); s.actors[1].hp -= 5; assert.equal(at(s), null);
    // Behind a wall: not seen.
    const walled = ROW.map((r, y) => y >= 1 && y <= 5 ? r.slice(0, 10) + '#' + r.slice(11) : r);
    s = room(C, depth, {}, { map: walled, you: [1, 1], exhibits: [{ sp: 'A4.5', at: [7, 3], mode: 'hunting' }, hurt('A4.1', [12, 3], depth, 1)] });
    assert.equal(at(s), null);
    // Beyond SIGHT_EXHIBIT: not seen.
    const wide = ['#'.repeat(24)].concat(ROW.slice(1, 6).map(r => '#' + '.'.repeat(22) + '#'), ['#'.repeat(24)]);
    s = H.room(C, 1, { acc: 'A4', depth, map: wide, you: [1, 1], exhibits: [{ sp: 'A4.5', at: [2, 3], mode: 'hunting', stats: Roles.stats('support', depth) }, hurt('A4.1', [2 + N.SIGHT_EXHIBIT + 1, 3], depth, 1)] }, {});
    assert.equal(at(s), null);
    s.actors[2].x = 2 + N.SIGHT_EXHIBIT; assert.equal(at(s), s.actors[2].uid);
    // A swarm body: its share of its few health is 0, so the restore would give it nothing.
    s = base([hurt('A4.2', [9, 3], depth, 1)]);
    assert.ok(Int.pct(s.actors[2].maxHp, N.CONSERVATOR_HEAL_PCT) < 1 || at(s) === s.actors[2].uid);
    if (Int.pct(s.actors[2].maxHp, N.CONSERVATOR_HEAL_PCT) < 1) assert.equal(at(s), null);
    // In an intact case: not reached (only a beam passes glass).
    const cased = ROW.map((r, y) => y === 3 ? r.slice(0, 9) + 'v' + r.slice(10) : r);
    s = room(C, depth, {}, { map: cased, you: [1, 1], exhibits: [{ sp: 'A4.5', at: [7, 3], mode: 'hunting' }, hurt('A4.1', [9, 3], depth, 1)] });
    assert.ok(C.Cases.encased(s, s.actors[2]));
    assert.equal(at(s), null);
  });

  test('its restore goes off on whoever stands on its marked tile then: an ally that stepped off it regains nothing, and another that stepped onto it is restored (planted moves between the mark and its action); a mark called off restores no one', () => {
    for (const depth of [1, 4, 7]) {
      const fod = Roles.stats('fodder', depth).hp;
      const make = () => room(C, depth, { rulesOff: ['clockwork'] }, { you: [1, 1], exhibits: [{ sp: 'A4.5', at: [7, 3], mode: 'hunting' }, hurt('A4.1', [9, 3], depth, 1), hurt('A4.1', [9, 5], depth, fod - 2)] });
      const play = (s, list) => { const r = H.play(C, s, list, { inv: 'all' }); assert.deepEqual(r.violations, []); return r; };
      // It marks (9,3); the ally there is moved away and the other moved onto it.
      let s = make();
      let r = play(s, [{ a: 'wait' }]);
      assert.equal(json(s.actors[1].telegraph.tiles), json([[9, 3]]));
      s.actors[2].x = 11; s.actors[3].y = 3; s.actors[3].x = 9;
      r = play(s, [{ a: 'wait' }]);
      const healed = r.events.filter(e => e.k === 'healed');
      assert.equal(json(healed.map(e => [e.who, e.amount])), json([[s.actors[3].uid, Math.min(Int.pct(fod, N.CONSERVATOR_HEAL_PCT), 2)]]));
      // Fixed before it goes off: called off, and no one is restored.
      s = make();
      play(s, [{ a: 'wait' }]);
      C.Status.apply(s, s.actors[1], 'fixed', 2, { k: 'status', id: 'fixed' }, []);
      C.Status.settle(s);
      r = play(s, [{ a: 'wait' }, { a: 'wait' }]);
      assert.ok(!r.events.some(e => e.k === 'healed'), json(r.events.map(e => e.k)));
    }
  });

  test('its label: no blow (no Acc or damage among its pictograms, no line on its hitting you), and a line for its restore that names its reach; a special that deals no damage with no reach never reads "null"', () => {
    for (const depth of [1, 4, 7]) {
      const s = room(C, depth, {}, { you: [5, 3], exhibits: [{ sp: 'A4.5', at: [8, 3], mode: 'hunting' }] }), L = Labels.of(s, s.actors[1].uid);
      assert.equal(json(L.pictos.map(p => p.icon).filter(i => i === 'acc' || i === 'damage')), '[]');
      assert.ok(!L.odds.some(l => /chance to hit you/.test(l)), json(L.odds));
      assert.ok(L.odds.includes(`Its restore deals no damage: it heals an exhibit within ${N.SIGHT_EXHIBIT} tiles of it, marking its tile first.`), json(L.odds));
      assert.ok(L.behaviour.startsWith(`Keeps ${N.CONSERVATOR_KEEP} tiles from you, stepping away when you come nearer, and never strikes; it marks the tile of the ally it sees within ${N.SIGHT_EXHIBIT} tiles that has lost the most health, and at its next action restores up to ${N.CONSERVATOR_HEAL_PCT}% of the maximum health of the exhibit standing there.`), L.behaviour);
      for (const l of L.odds.concat([L.behaviour])) assert.ok(!/undefined|NaN|\[object|\bnull\b/.test(l), l);
    }
    // Planted: a special that deals no damage, with no reach and an effect no line knows.
    const X = loadCore();
    X.Registry.SPECIALS.restore.range = null;
    X.Registry.SPECIALS.restore.effect = 'hook';
    const s = H.room(X, 1, { acc: 'A4', depth: 2, map: ROW, you: [5, 3], exhibits: [{ sp: 'A4.5', at: [8, 3], mode: 'hunting', stats: X.Roles.stats('support', 2) }] }, {});
    const odds = X.Labels.of(s, s.actors[1].uid).odds;
    assert.ok(odds.includes('Its restore deals no damage: its Behaviour line says what it does.'), json(odds));
    assert.ok(!odds.some(l => /null/.test(l)));
    // The herald's call reads as before.
    assert.ok(Labels.of(H.room(C, 1, { acc: 'A4', depth: 2, map: ROW, you: [5, 3], exhibits: [{ sp: 'A4.3', at: [8, 3], mode: 'hunting', stats: Roles.stats('support', 2) }] }, {}), 'A4.2.room.1').odds
      .includes(`Its call deals no damage: it wakes the sleeping exhibits within ${N.HERALD_RANGE} tiles of it that can hear.`));
  });

  test('the healer invariants fail a planted blow, a planted step nearer, and a planted restore off its mark or by the wrong amount', () => {
    const invs = require('./arch-d.inv.js')(C), by = id => invs.find(i => i.id === id);
    const s = room(C, 3, { rulesOff: ['clockwork'] }, { you: [3, 3], exhibits: [{ sp: 'A4.5', at: [6, 3], mode: 'hunting' }, hurt('A4.1', [9, 3], 3, 1)] });
    const h = s.actors[1], ally = s.actors[2], ctx = { actor: h, before: h, uid: h.uid };
    assert.match(by('healer.blow').check(s, [{ k: 'attacked', by: h.uid, at: 'you' }], s, ctx), /struck/);
    assert.equal(by('healer.keep').check(s, [{ k: 'moved', who: h.uid, from: [6, 3], to: [7, 3] }], s, ctx), null, 'a step away');
    assert.match(by('healer.keep').check(s, [{ k: 'moved', who: h.uid, from: [6, 3], to: [5, 3] }, { k: 'moved', who: h.uid, from: [5, 3], to: [4, 3] }], s, ctx), /nearer than/);
    const share = Int.pct(ally.maxHp, N.CONSERVATOR_HEAL_PCT), heal = (amount, more) => Object.assign({ k: 'healed', who: ally.uid, amount, hp: 1 + amount, cause: { k: 'restore', by: h.uid } }, more || {});
    const went = { k: 'special', who: h.uid, sp: 'restore' }, marked = { k: 'telegraphed', who: h.uid, sp: 'restore', tiles: [[9, 3]] };
    assert.equal(by('healer.restore').check(s, [marked, heal(share), went], s), null);
    assert.match(by('healer.restore').check(s, [marked, heal(share + 1), went], s), /not \d+/);
    assert.match(by('healer.restore').check(s, [Object.assign({}, marked, { tiles: [[10, 3]] }), heal(share), went], s), /on no tile its mark showed/);
    assert.match(by('healer.restore').check(s, [marked, heal(share)], s), /did not go off/);
    assert.match(by('healer.restore').check(s, [marked, heal(share, { who: 'you' }), went], s), /healed you/);
  });
};
