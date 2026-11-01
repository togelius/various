// ACCESSION — the clockwork modifier (BUILD.md §5.1, §5.3, §8.2; M4 plan A11, D3.12; ARCH-CLOCKWORK):
// its line, "Shows its next move as an arrow and makes it if it still can, else waits; cannot be
// dazed.", for every pack species with it (M.11's stations, M11.2 and M11.12, and A.4's
// Countersigning Clerk, A4.5) at depths 1–7, joined up: the real core, real actions only, every
// invariant checked after every step (arch-d.inv.js's clockwork.plan among them), clone-checked,
// and rerun with clockwork switched off, which must fail (§5.3 check 3). Beside them, a planted
// clockwork plodder shows the step and the blow (no pack species has them), and unit tests plant
// a status (nothing in the game dazes), a refused archetype and each arrow's words. What is
// expected is worked out here from the line and §8.1, not from rules/mods/clockwork.js.
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Roles, N, Int, Archetypes, Packs, Labels, Status, Specials, HourlyDemonstration, Text } = C;
  const json = x => JSON.stringify(x);
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };
  const ROW = ['################', '#..............#', '#..............#', '#..............#', '#..............#', '#..............#', '################'];
  const SECTION = [{ key: 'sone', role: 'section', x0: 1, y0: 1, x1: 14, y1: 5 }];
  const key = t => `${t[0]},${t[1]}`;
  const own = (e, uid) => (e.k === 'moved' && e.who === uid && e.cause === undefined) || (e.k === 'attacked' && e.by === uid) || (e.k === 'telegraphed' && e.who === uid);

  // A room of species sp's department, its modules running (Modules.init, as a department does),
  // you hard to kill. exhibits: Setup.room's, each with its role's numbers at the depth.
  function room(X, sp, depth, opts, o) {
    const acc = sp.id.split('.')[0];
    const ex = o.exhibits.map(e => Object.assign({ stats: Roles.stats(Packs.species(acc, e.sp).role, depth) }, e));
    const s = H.room(X, opts.seed || 1, { acc, depth, map: o.map || ROW, you: o.you, exhibits: ex, rooms: SECTION }, { rulesOff: opts.rulesOff || [] });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    X.Modules.init(s, X.Packs.get(acc));
    return s;
  }
  // A hurt sleeper of species id at a tile, with hp of its role's health at the depth.
  const hurt = (id, at, depth, hp) => ({ sp: id, at, hp, maxHp: Roles.stats(Packs.species(id.split('.')[0], id).role, depth).hp });
  const list = () => { const l = H.species(C, 'clockwork'); assert.ok(l.length >= 21, `${l.length} species and depths`); return l; };

  // ---- Its line, for every pack species with it ----
  // A station (the demonstrator): its arrow is its line, the tiles it would mark if the chime
  // sounded now, shown at every decision, asleep or awake; its moves are waits. The healer: with
  // two hurt allies in its sight, it shows its restore on the one that has lost the most (a
  // sleeper beside you, at 1 health); you destroy that one with a blow it cannot see coming (a
  // surprise blow on a sleeper hits for certain), so it cannot make its move: it waits, and shows
  // its restore on the other, which it then makes, and which goes off. Switched off, it marks the
  // first at its first action, with no move shown before.
  let seen = [];
  const shows = H.scenario({
    name: 'it shows its next move and makes it if it still can, else waits: a station\'s arrow is its line; the healer\'s restore on an ally destroyed before it acts is not made, and it waits',
    id: 'clockwork', clone: true,
    build: (params, sp, depth, opts) => sp.archetype === 'demonstrator'
      ? room(C, sp, depth, opts, { you: [12, 3], exhibits: [{ sp: sp.id, at: [5, 3] }] })
      : room(C, sp, depth, opts, { you: [3, 3], exhibits: [{ sp: sp.id, at: [9, 3], mode: 'hunting' },
        hurt('A4.1', [4, 3], depth, 1), hurt('A4.1', [14, 5], depth, Roles.stats('fodder', depth).hp - 3)] }),
    actions(s, i, c) {
      if (i === 0) seen = [];
      const a = s.actors[1];
      seen.push({ plan: Archetypes.plan(s, a), x: a.x, y: a.y, marks: Specials.marks(s).filter(k => k.by === a.uid).map(k => key([k.x, k.y])), odds: (Labels.of(s, a.uid) || { odds: [] }).odds });
      if (c.sp.archetype === 'demonstrator') return i < 6 ? { a: 'wait' } : null;
      return i === 1 ? { a: 'attack', uid: s.actors[2].uid } : i < 5 ? { a: 'wait' } : null;
    },
    expect(r, params, sp) {
      const a = r.start.actors[1], uid = a.uid;
      if (sp.archetype === 'demonstrator') {
        for (const [i, d] of seen.entries()) {
          const line = HourlyDemonstration.line(r.start, a).map(key);
          if (!d.plan || d.plan.k !== 'line' || json(d.plan.tiles.map(key)) !== json(line) || !line.length) return `at decision ${i} its arrow showed ${json(d.plan)}, not its line ${json(line)}`;
          const dir = C.Clauses.COMPASS[r.start.actors[1].route.dir];
          if (!d.odds.some(l => l === `If the chime sounded now, it would mark its line: ${Text.tiles(line.length)} to the ${dir}.`)) return `its label said ${json(d.odds)}`;
          // It has no blow (its archetype's clause), so its label says nothing of its hitting you.
          if (d.odds.some(l => /chance to hit you/.test(l))) return `its label gives it a blow: ${json(d.odds)}`;
        }
        if (r.events.some(e => (e.k === 'moved' && e.who === uid) || (e.k === 'attacked' && e.by === uid))) return 'a station stepped or struck';
        return null;
      }
      const [x, y] = [r.start.actors[2], r.start.actors[3]];
      // Decision 1: its restore on the ally beside you, shown, and said on its label.
      const d1 = seen[1];
      if (!d1.plan || d1.plan.k !== 'mark' || d1.plan.sp !== 'restore' || json(d1.plan.tiles) !== json([[x.x, x.y]])) return `at decision 1 its arrow showed ${json(d1.plan)}, not its restore on ${key([x.x, x.y])}`;
      if (!d1.odds.includes(`Its next move: its restore, marked on the tile of ${Labels.nameOf(r.start)(x.uid)}.`)) return `its label said ${json(d1.odds)}`;
      // Your blow destroys it; the healer cannot make its move, and waits.
      const s1 = r.steps[1].events;
      if (!s1.some(e => e.k === 'died' && e.who === x.uid)) return 'your blow did not destroy the ally';
      if (s1.some(e => own(e, uid))) return `it acted otherwise than a wait: ${json(s1.filter(e => own(e, uid)))}`;
      if (d1.x !== seen[2].x || d1.y !== seen[2].y) return 'it moved';
      // Decision 2: its restore on the other, which it then marks, shows, and sets off.
      const d2 = seen[2];
      if (!d2.plan || d2.plan.k !== 'mark' || json(d2.plan.tiles) !== json([[y.x, y.y]])) return `at decision 2 its arrow showed ${json(d2.plan)}`;
      const mark = r.steps[2].events.find(e => e.k === 'telegraphed' && e.who === uid);
      if (!mark || json(mark.tiles) !== json([[y.x, y.y]])) return `its next action marked ${json(mark)}`;
      if (!seen[3].marks.includes(key([y.x, y.y])) || !seen[3].plan || seen[3].plan.k !== 'resolve') return `the mark was not shown at your next decision: ${json(seen[3])}`;
      const healed = r.events.find(e => e.k === 'healed' && e.who === y.uid);
      const want = Math.min(Int.pct(y.maxHp, N.CONSERVATOR_HEAL_PCT), y.maxHp - y.hp);
      if (!healed || healed.amount !== want || healed.cause.by !== uid) return `the restore healed ${json(healed)}, not ${want}`;
      return null;
    },
  });
  test('it shows its next move and makes it if it still can, else waits: a station\'s arrow is its line, and its moves are waits; the healer does not make a restore on an ally destroyed before it acts, at depths 1–7, clone-checked, and it fails with clockwork switched off', () => {
    ok(H.sweep(C, shows, list()), shows.name);
    assert.ok(H.reruns('clockwork') >= 21, `${H.reruns('clockwork')} reruns with clockwork off failed as they must`);
  });

  // ---- A planted clockwork plodder: the step and the blow ----
  // Hunting you from across the room, it shows a step toward you; you step aside, and it makes
  // the step it showed (whatever its walk toward you would now be). Beside you, it shows its
  // blow; you step away, so its blow cannot be made, and it waits; then it shows its step again.
  // Switched off, it steps after you at once, never waiting. Planted: no pack species is a
  // plodder with clockwork, which clockwork makes the moves of (it acts by mode alone).
  let trail = [];
  const plodder = H.scenario({
    name: 'a clockwork plodder makes the step it showed after you step aside, and waits when the blow it showed cannot be made',
    id: null, clone: true,
    build: (params, sp, depth, opts) => {
      const s = H.room(C, opts.seed || 1, { acc: 'A4', depth, map: ROW, you: [3, 3], rooms: SECTION,
        exhibits: [{ sp: 'A4.1', at: [7, 3], mode: 'hunting', mods: ['clockwork'], stats: Roles.stats('fodder', depth) }] }, { rulesOff: opts.rulesOff || [] });
      s.actors[0].hp = s.actors[0].maxHp = 999;
      return s;
    },
    actions(s, i) {
      if (i === 0) trail = [];
      const a = s.actors[1], p = Archetypes.plan(s, a);
      trail.push({ plan: p, at: [a.x, a.y], you: [s.actors[0].x, s.actors[0].y] });
      // Wait while it comes; once it shows its blow, step away west (and back east after).
      if (i > 30) return null;
      const prev = trail[i - 1];
      if (prev && prev.plan && prev.plan.k === 'strike' && trail.filter(t => t.left).length === 0) { trail[i].left = true; return { a: 'move', dir: 6 }; }
      if (i === 1) return { a: 'move', dir: 0 };
      return { a: 'wait' };
    },
    expect(r) {
      const uid = r.start.actors[1].uid;
      // Step 1: you stepped north; it stepped where its arrow showed at that decision.
      const p1 = trail[1].plan, m1 = r.steps[1].events.find(e => e.k === 'moved' && e.who === uid);
      if (!p1 || p1.k !== 'step') return `at decision 1 its arrow showed ${json(p1)}, not a step`;
      if (!m1 || key(m1.to) !== key(p1.to)) return `it stepped ${json(m1)}, not to ${key(p1.to)}`;
      // It came beside you and showed its blow; you stepped away; it waited, then showed a step.
      const k = trail.findIndex(t => t.left);
      if (k < 0) return 'it never showed its blow';
      if (r.steps[k].events.some(e => own(e, uid))) return `its blow could not be made, and it did not wait: ${json(r.steps[k].events.filter(e => own(e, uid)))}`;
      const after = trail[k + 1] && trail[k + 1].plan;
      if (!after || after.k !== 'step') return `after its wait its arrow showed ${json(after)}`;
      if (!r.events.some(e => e.k === 'attacked' && e.by === uid)) return 'it never struck you';
      return null;
    },
  });
  test('a planted clockwork plodder makes the step it showed after you step aside, and waits when the blow it showed cannot be made; with clockwork off it does neither, at depths 1–7, clone-checked', () => {
    for (let depth = 1; depth <= 7; depth++) {
      const on = H.run(C, plodder, null, depth, {});
      assert.equal(on.failure, null, `depth ${depth}: ${on.failure}`);
      const off = H.run(C, plodder, null, depth, { rulesOff: ['clockwork'], inv: [] });
      assert.ok(off.failure && !off.error, `depth ${depth}: with clockwork off it ${off.error ? 'threw ' + off.error : 'still passed'}`);
    }
  });

  // ---- A planted clockwork plodder that loses you: its moves bring their changes of mode ----
  // Hunting you from the far side of a wall, it walks to where it last knew you were, searches,
  // gives up, goes home and settles to sleep there, as any exhibit does: every move it makes is
  // the one its arrow showed, and the change of mode that comes with a move (giving up the hunt,
  // arriving home, settling) comes with it.
  test('a planted clockwork plodder that loses you walks to where it last knew you were, searches, goes home and sleeps there, each move the one its arrow showed, at depths 1–7, clone-checked', () => {
    const WALL = ROW.map((r, y) => y >= 1 && y <= 5 ? r.slice(0, 7) + '#' + r.slice(8) : r);
    for (let depth = 1; depth <= 7; depth++) {
      const s = H.room(C, 1, { acc: 'A4', depth, map: WALL, you: [12, 3], rooms: SECTION,
        exhibits: [{ sp: 'A4.1', at: [2, 3], mode: 'hunting', lastKnown: [5, 2], mods: ['clockwork'], stats: Roles.stats('fodder', depth) }] }, {});
      const a = s.actors[1], uid = a.uid, waits = [];
      for (let i = 0; i < 90; i++) waits.push({ a: 'wait' });
      const r = H.play(C, s, waits, { inv: 'all', clone: true });
      assert.deepEqual(r.violations.map(v => v.text), [], `depth ${depth}`);
      const kinds = r.events.filter(e => e.who === uid && ['lost', 'returned', 'moved'].includes(e.k)).map(e => e.k === 'returned' ? 'returned ' + e.phase : e.k === 'lost' ? `lost ${e.to}` : 'moved');
      const order = ['lost searching', 'lost returning', 'returned arrived', 'returned reinstalled'].map(k => kinds.indexOf(k));
      assert.ok(order.every((k, i) => k >= 0 && (i === 0 || k > order[i - 1])), `depth ${depth}: ${json(kinds)}`);
      assert.ok(kinds.indexOf('moved') < order[0] && kinds.lastIndexOf('moved') < order[2], json(kinds));
      assert.equal(json([a.mode, a.x, a.y, Archetypes.plan(s, a)]), json(['dormant', 2, 3, null]), `depth ${depth}`);
    }
  });

  // ---- The move it shows is the one it would make if it acted now ----
  // An exhibit's action begins by looking for you (§8.1), so the move worked out for it does
  // too: a clockwork plodder searching westward that sees you to its east shows its step toward
  // you, which it then makes. Working the move out changes nothing in the state.
  test('the move it shows is the one it would make if it acted now: it looks for you first, so a searching one that sees you shows its step toward you and makes it; working it out changes nothing', () => {
    for (const depth of [1, 4, 7]) {
      const s = H.room(C, 1, { acc: 'A4', depth, map: ROW, you: [12, 3], rooms: SECTION,
        exhibits: [{ sp: 'A4.1', at: [7, 3], mode: 'searching', lastKnown: [2, 3], mods: ['clockwork'], stats: Roles.stats('fodder', depth) }] }, {});
      s.actors[0].hp = s.actors[0].maxHp = 999;
      const a = s.actors[1], before = C.State.hash(s);
      const p = C.Clockwork.next(s, a);
      assert.equal(C.State.hash(s), before, 'working out its move changed the state');
      // A step east, toward you (searching, it would have stepped west, toward [2, 3]).
      assert.ok(p && p.k === 'step' && p.to[0] === 8, `depth ${depth}: ${json(p)}`);
      C.Clockwork.replan(s, a);
      const r = H.play(C, s, [{ a: 'wait' }], { inv: 'all', clone: true });
      assert.deepEqual(r.violations, []);
      assert.ok(r.events.some(e => e.k === 'moved' && e.who === a.uid && json(e.to) === json(p.to)), json(r.events.map(e => e.k)));
    }
  });

  // ---- Cannot be dazed ----
  test('cannot be dazed: dazed is never put on a clockwork exhibit (Status.apply gives false, with no event), for every pack species with it at depths 1–7; with clockwork switched off, or without it, it is', () => {
    const cause = { k: 'status', id: 'dazed' };
    for (const { sp, depth } of list()) {
      for (const off of [false, true]) {
        const s = room(C, sp, depth, { rulesOff: off ? ['clockwork'] : [] }, { you: [12, 3], exhibits: [{ sp: sp.id, at: [5, 3] }] }), a = s.actors[1], ev = [];
        assert.equal(Status.apply(s, a, 'dazed', 2, cause, ev), off, `${sp.id} at depth ${depth}, clockwork ${off ? 'off' : 'on'}`);
        assert.equal(json([Status.has(a, 'dazed'), ev.map(e => e.k)]), json(off ? [true, ['status']] : [false, []]));
        assert.equal(Archetypes.immune(s, a, 'dazed'), !off);
        assert.equal(Archetypes.immune(s, a, 'fixed'), false, 'only dazed');
      }
    }
    const s = room(C, Packs.species('A4', 'A4.1'), 3, {}, { you: [12, 3], exhibits: [{ sp: 'A4.1', at: [5, 3] }] });
    assert.equal(Status.apply(s, s.actors[1], 'dazed', 2, cause, []), true, 'an exhibit without clockwork is dazed');
    // The invariant fails a clockwork exhibit made dazed (planted on the state after a step).
    const inv = require('./arch-d.inv.js')(C).find(i => i.id === 'clockwork.dazed');
    const t = room(C, Packs.species('A4', 'A4.5'), 3, {}, { you: [12, 3], exhibits: [{ sp: 'A4.5', at: [5, 3] }] }), b = t.actors[1];
    assert.equal(inv.check(t, [], t, { actor: b, before: b, uid: b.uid }), null);
    b.statuses.push({ id: 'dazed', until: 9, turns: null, from: 1 });
    assert.match(inv.check(t, [], t, { actor: b, before: b, uid: b.uid }), /is dazed/);
  });

  // ---- What it shows, and what it refuses ----
  test('its arrow, in words on its label: a step by its compass side, a blow at you, its restore on whose tile, its mark going off, a wait; asleep it shows nothing, a station its line asleep too', () => {
    const sp = Packs.species('A4', 'A4.5'), s = room(C, sp, 4, {}, { you: [3, 3], exhibits: [{ sp: 'A4.5', at: [8, 3], mode: 'hunting' }, hurt('A4.1', [10, 3], 4, 2)] });
    const a = s.actors[1], said = () => Labels.of(s, a.uid).odds.slice(-1)[0];
    const name = Labels.nameOf(s)(s.actors[2].uid);
    const cases = [
      [{ k: 'step', to: [9, 2] }, 'Its next move: a step north-east.'],
      [{ k: 'step', to: [7, 3] }, 'Its next move: a step west.'],
      [{ k: 'step', to: [6, 3] }, 'Its next move: a step onto a tile no longer beside it, which it cannot make.'],
      [{ k: 'strike', at: 'you' }, 'Its next move: a blow at you.'],
      [{ k: 'mark', sp: 'restore', tiles: [[10, 3]] }, `Its next move: its restore, marked on the tile of ${name}.`],
      [{ k: 'mark', sp: 'restore', tiles: [[3, 3]] }, 'Its next move: its restore, marked on your tile.'],
      [{ k: 'mark', sp: 'restore', tiles: [[12, 5]] }, 'Its next move: its restore, marked on 1 tile.'],
      [{ k: 'resolve', sp: 'restore' }, 'Its next move: its restore goes off.'],
      [{ k: 'wait' }, 'Its next move: a wait.'],
    ];
    for (const [plan, words] of cases) {
      a.plan = plan;
      assert.equal(said(), words);
      assert.ok(Array.isArray(Archetypes.plan(s, a).tiles));
      assert.ok(!/undefined|NaN|\[object|\bnull\b/.test(said()));
    }
    assert.equal(json(Archetypes.plan(s, Object.assign(a, { plan: { k: 'step', to: [9, 2] } })).tiles), json([[9, 2]]));
    // Its words never name an exhibit you cannot see: behind a wall, or a mimic in its disguise
    // (a case to everything you see), its restore is marked on "1 tile".
    const walled = H.room(C, 1, { acc: 'A4', depth: 4, map: ROW.map((r, y) => y >= 1 && y <= 5 ? r.slice(0, 6) + '#' + r.slice(7) : r), you: [3, 3], rooms: SECTION,
      exhibits: [{ sp: 'A4.5', at: [5, 3], mode: 'hunting', stats: Roles.stats('support', 4) }, hurt('A4.1', [10, 3], 4, 2)] }, {});
    walled.actors[1].plan = { k: 'mark', sp: 'restore', tiles: [[10, 3]] };
    assert.equal(Labels.of(walled, walled.actors[1].uid).odds.slice(-1)[0], 'Its next move: its restore, marked on 1 tile.');
    walled.dept.tiles = walled.dept.tiles.map(r => r.slice(0, 6) + '.' + r.slice(7)).map((r, y) => y === 0 || y === 6 ? '#'.repeat(16) : r);
    assert.equal(Labels.of(walled, walled.actors[1].uid).odds.slice(-1)[0], `Its next move: its restore, marked on the tile of ${Labels.nameOf(walled)(walled.actors[2].uid)}.`, 'the wall gone, it is named');
    const present = C.Archetypes.present;
    try {
      C.Archetypes.present = (state, b) => b === walled.actors[2] ? 'case' : present(state, b);
      assert.equal(Labels.of(walled, walled.actors[1].uid).odds.slice(-1)[0], 'Its next move: its restore, marked on 1 tile.', 'one showing as something else');
    } finally { C.Archetypes.present = present; }
    assert.equal(json(Archetypes.plan(s, Object.assign(a, { plan: { k: 'strike', at: 'you' } })).tiles), json([[3, 3]]));
    // Asleep: nothing shown, and no line on its label.
    a.mode = 'dormant';
    assert.equal(Archetypes.plan(s, a), null);
    assert.ok(!Labels.of(s, a.uid).odds.some(l => /its arrow/.test(l)));
    // A sleeping station shows its line; with the chime off, nothing.
    const st = Packs.species('M11', 'M11.2');
    for (const off of [[], ['hourly_demonstration'], ['clockwork']]) {
      const t = room(C, st, 3, { rulesOff: off }, { you: [12, 3], exhibits: [{ sp: 'M11.2', at: [5, 3] }] }), b = t.actors[1];
      b.route = { dir: 'E' };
      const p = Archetypes.plan(t, b);
      if (off.length) assert.equal(p, null, json(off));
      else assert.equal(json([p.k, p.tiles.map(key)]), json(['line', ['6,3', '7,3', '8,3', '9,3', '10,3', '11,3', '12,3', '13,3', '14,3']]));
    }
  });

  test('clockwork makes the moves of an archetype that acts by mode alone or hands it its action, and a station\'s; any other archetype with clockwork is refused as the exhibit is made, so no line claims the rule for one that would not keep it', () => {
    const make = arch => H.room(C, 1, { acc: 'M11', depth: 2, map: ROW, you: [3, 3], exhibits: [{ sp: 'M11.1', at: [8, 3], arch, mods: ['clockwork'], trigger: null, stats: Roles.stats('artillery', 2) }] }, {});
    for (const arch of ['kiter', 'darter', 'herald', 'axis_sniper']) assert.throws(() => make(arch), /clockwork: .* whose moves clockwork does not make/, arch);
    for (const arch of ['plodder', 'conservator_healer', 'demonstrator']) assert.ok(make(arch).actors[1].mods.includes('clockwork'), arch);
    // Clockwork.add refuses what is not an archetype, an archetype twice, and a part it does not know.
    assert.throws(() => C.Clockwork.add('nothing', { behave: () => 100 }), /not an archetype/);
    assert.throws(() => C.Clockwork.add('plodder', { behave: () => 100 }), /added twice/);
    assert.throws(() => C.Clockwork.add('reflector', { behave: () => 100, extra: () => 1 }), /no part called extra/);
    assert.throws(() => C.Clockwork.add('reflector', {}), /needs behave/);
  });

  test('a fixed clockwork exhibit only waits, keeping the move it showed, and makes it once free if it still can; and a move shown never goes stale: after its mark goes off it shows its next move', () => {
    for (const depth of [1, 4, 7]) {
      const sp = Packs.species('A4', 'A4.5');
      const s = room(C, sp, depth, {}, { you: [3, 3], exhibits: [{ sp: 'A4.5', at: [9, 3], mode: 'hunting' }, hurt('A4.1', [11, 3], depth, 1)] });
      const a = s.actors[1], wait = { a: 'wait' };
      // Its first action: a wait (it was made awake, with no move shown), and its restore shown.
      let r = H.play(C, s, [wait], { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.equal(json(Archetypes.plan(s, a)), json({ k: 'mark', sp: 'restore', tiles: [[11, 3]] }));
      // Fixed for 2 turns: it waits, showing its restore still.
      assert.equal(Status.apply(s, a, 'fixed', 2, { k: 'status', id: 'fixed' }, []), true);
      Status.settle(s);
      r = H.play(C, s, [wait, wait], { inv: 'all' });
      assert.deepEqual(r.violations, []);
      assert.ok(!r.events.some(e => own(e, a.uid)), json(r.events.map(e => e.k)));
      assert.equal(Archetypes.plan(s, a).k, 'mark');
      // Free, it makes it; then its arrow shows its mark going off, and only while the mark is
      // pending: once it went off, its arrow shows its next move at once (no stale arrow).
      const all = [];
      for (let i = 0; i < 6; i++) {
        r = H.play(C, s, [wait], { inv: 'all' });
        assert.deepEqual(r.violations, []);
        all.push(...r.events);
        const p = Archetypes.plan(s, a);
        assert.ok(p && (p.k !== 'resolve' || (a.telegraph && a.telegraph.sp === p.sp)), json([p, a.telegraph]));
      }
      assert.ok(all.some(e => e.k === 'telegraphed' && e.who === a.uid) && all.some(e => e.k === 'healed' && e.cause.k === 'restore'), json(all.map(e => e.k)));
    }
  });

  // ---- "If it still can" ----
  test('if it still can: a step onto a tile still beside it, free and one it may step onto; a blow at you while you are beside it; its restore while that tile holds an ally it may restore, seen, hurt; a wait always', () => {
    const { Clockwork } = C;
    for (const depth of [1, 4, 7]) {
      const s = room(C, Packs.species('A4', 'A4.5'), depth, {}, { you: [3, 3], exhibits: [{ sp: 'A4.5', at: [8, 3], mode: 'hunting' }, hurt('A4.1', [10, 3], depth, 1), hurt('A4.1', [9, 2], depth, 1)] });
      const a = s.actors[1], ally = s.actors[2], other = s.actors[3];
      assert.equal(Clockwork.can(s, a, { k: 'wait' }), true);
      assert.equal(Clockwork.can(s, a, { k: 'step', to: [7, 3] }), true);
      assert.equal(Clockwork.can(s, a, { k: 'step', to: [9, 2] }), false, 'another stands there');
      assert.equal(Clockwork.can(s, a, { k: 'step', to: [6, 3] }), false, 'not beside it');
      assert.equal(Clockwork.can(s, a, { k: 'strike', at: 'you' }), false, 'you are not beside it');
      const restore = { k: 'mark', sp: 'restore', tiles: [[10, 3]] };
      assert.equal(Clockwork.can(s, a, restore), true);
      ally.hp = ally.maxHp;
      assert.equal(Clockwork.can(s, a, restore), false, 'nothing to restore');
      ally.hp = 1; ally.x = 11;
      assert.equal(Clockwork.can(s, a, restore), false, 'no one on the tile');
      other.x = 10; other.y = 3;
      assert.equal(Clockwork.can(s, a, restore), true, 'another hurt ally on it');
      a.mode = 'searching';
      assert.equal(Clockwork.can(s, a, restore), false, 'searching, it may not mark');
      a.mode = 'hunting'; s.actors[0].x = 7;
      assert.equal(Clockwork.can(s, a, { k: 'strike', at: 'you' }), true);
      assert.equal(Clockwork.can(s, a, { k: 'resolve', sp: 'restore' }), false, 'no mark pending');
    }
  });

  // ---- The invariant catches a move not shown ----
  test('clockwork.plan fails a clockwork exhibit whose first action after your decision is not the move its arrow showed (planted in the events), and holds a wait', () => {
    const inv = require('./arch-d.inv.js')(C).find(i => i.id === 'clockwork.plan');
    const sp = Packs.species('A4', 'A4.5'), s = room(C, sp, 3, {}, { you: [3, 3], exhibits: [{ sp: 'A4.5', at: [9, 3], mode: 'hunting' }] }), a = s.actors[1];
    a.plan = { k: 'step', to: [10, 3] }; a.next = 100;
    const ctx = { actor: a, before: a, uid: a.uid };
    const moved = to => ({ k: 'moved', who: a.uid, from: [9, 3], to, tick: 100, turn: 1 });
    assert.equal(inv.check(s, [moved([10, 3])], s, ctx), null);
    assert.equal(inv.check(s, [], s, ctx), null, 'a wait');
    assert.match(inv.check(s, [moved([10, 4])], s, ctx), /stepped to 10,4/);
    assert.match(inv.check(s, [{ k: 'attacked', by: a.uid, at: 'you', tick: 100, turn: 1 }], s, ctx), /struck at you/);
    // A move at a later action in the same step is not its first.
    assert.equal(inv.check(s, [Object.assign(moved([10, 4]), { tick: 200 })], s, ctx), null);
    a.plan = { k: 'wait' };
    assert.match(inv.check(s, [moved([10, 3])], s, ctx), /showed a wait/);
  });
};
