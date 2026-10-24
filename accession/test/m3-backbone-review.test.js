// M3's backbone, as the Wave 0 review left it (BUILD.md §3.4, §4.1, §4.2, §8.1–§8.3): the
// rules and interfaces the review found missing or wrong, each pinned by the case that showed
// it. Each test names the finding it answers. The expected figures are worked out here from
// BUILD.md's text, never from the rule code.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const C = loadCore();
  const json = x => JSON.stringify(x);
  const key = a => JSON.stringify(a);
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'hunting', stats: tough }, extra);
  const room = (X, map, you, exhibits, options, extra) => {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map, you, exhibits: exhibits || [] }, extra || {}), options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  const checked = (X, ev) => { for (const e of ev) { const bad = X.Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  // A planted exhibit that marks its special whenever it can (as a warden's or a sniper's
  // archetype will), and otherwise does as a plodder.
  function marker(X, id, special) {
    X.Registry.define('ARCHETYPES', id, { special });
    X.Archetypes.add(id, { act(state, a, ev) { const t = X.Specials.tiles(state, a, X.Registry.SPECIALS[special].shape); return X.Specials.canMark(state, a, special, t) ? X.Specials.mark(state, a, special, t, ev) : null; } });
  }
  // Hearing and ally_hit as §8.2 states them and W1-WAKE-A will build them (stubs until then):
  // a sleeper that hears a noise gains a pip, and the third wakes it awake, to look; a
  // sleeper of the victim's group within ALLY_HIT_RANGE gains 3.
  function plantHearing(X) {
    X.Wake.hear = (state, a, noise, dist, ev) => { if (a.mode === 'dormant') X.Wake.addPips(state, a, 1, { k: 'noise', by: noise.by, dist, cls: noise.cls }, ev, { target: [noise.x, noise.y] }); };
    X.Wake.allyHit = (state, victim, cause, ev) => {
      if (!victim.group) return;
      for (const b of state.actors) {
        if (b === victim || b.gone || b.mode !== 'dormant' || b.group !== victim.group || !X.Grid.disc(b.x - victim.x, b.y - victim.y, X.N.ALLY_HIT_RANGE)) continue;
        X.Wake.addPips(state, b, 3, { k: 'ally_hit', by: cause.by, dist: X.Actors.dist(b, victim.x, victim.y) }, ev);
      }
    };
  }

  // ---- Interfaces (W0-IF) ----

  test('IF-02: use\'s candidates are the kit\'s and the consumables\' own, so every targeted use that is legal is a candidate', () => {
    const X = loadCore(), N = X.N;
    const s = room(X, OPEN, [2, 2], [], null, { items: [
      { uid: 'pd', kind: 'instrument', where: { at: 'floor', x: 5, y: 2 } }, { uid: 'rk', kind: 'kit', where: { at: 'floor', x: 6, y: 2 } },
      { uid: 'c1', kind: 'consumable', where: { at: 'floor', x: 6, y: 3 }, ck: 'fixative', n: 1 }] });
    const cands = () => X.Actions.get('use').candidates(s).map(key);
    // Wave 0's stubs: a bare use of each item; for an instrument a tile off the board, for a
    // kit an item that is not there, so the targeted shapes reach the refusal side today.
    for (const c of [{ a: 'use', uid: 'pd' }, { a: 'use', uid: 'pd', x: -1, y: -1 }, { a: 'use', uid: 'rk' }, { a: 'use', uid: 'rk', on: 'nothing' },
      { a: 'use', uid: 'c1' }, { a: 'use', uid: 'you.w' }, { a: 'use', uid: 'nothing' }, { a: 'use' }]) assert.ok(cands().includes(key(c)), `${key(c)} is a candidate`);
    for (const c of X.Actions.get('use').candidates(s)) assert.equal(X.Step.step(X.State.clone(s), c)[0].k, 'refused', key(c));
    assert.equal(typeof X.Kit.useCandidates, 'function'); assert.equal(typeof X.Consumables.useCandidates, 'function');
    // W1-KIT's targeted uses, planted: what its useCandidates lists, the dispatcher offers.
    X.Kit.useCandidates = st => [{ a: 'use', uid: 'pd', x: 3, y: 1 }, { a: 'use', uid: 'pd', x: 8, y: 4 }, { a: 'use', uid: 'rk', on: 'you.w' }, { a: 'use', uid: 'rk', on: 'pd' }];
    X.Kit.useLegal = st => [{ a: 'use', uid: 'pd', x: 3, y: 1 }, { a: 'use', uid: 'rk', on: 'you.w' }];
    X.Kit.useAction = (st, action) => X.Kit.useLegal(st).some(l => key(l) === key(action)) ? N.COST_USE : 'out_of_reach';
    const legal = X.Step.legal(s).filter(a => a.a === 'use').map(key), all = cands();
    assert.equal(legal.length, 2);
    for (const l of legal) assert.ok(all.includes(l), `legal ${l} is a candidate`);
    for (const c of X.Actions.get('use').candidates(s)) {
      const ev = X.Step.step(X.State.clone(s), c), refused = ev.length === 1 && ev[0].k === 'refused';
      assert.equal(!refused, legal.includes(key(c)), `${key(c)}: legal ⇔ not refused`);
    }
  });

  test('IF-03: a shot\'s cause is k shot, with its range and from the tile its bolt last crossed; an instrument\'s bolt is k item; a blow is unchanged', () => {
    const X = loadCore(), N = X.N;
    const map = ['##########', '#........#', '#........#', '##########'];
    let hits = 0, misses = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = X.Setup.room(seed, { acc: 'T0', depth: 1, map, you: [1, 2], exhibits: [ex([6, 2], { stats: { hp: 99, acc: -3, eva: 0, pad: 0, dmin: 2, dmax: 5 } })] });
      const [you, kiter] = s.actors, ev = [];
      X.Combat.attack(s, kiter, you, ev, { kind: 'shot', range: 5, via: [2, 2] });
      checked(X, ev);
      const out = ev.find(e => e.k === 'damaged' || e.k === 'missed');
      assert.equal(out.cause.k, 'shot', json(out));
      assert.equal(out.cause.range, 5);
      if (out.k === 'damaged') { hits++; assert.equal(json(out.cause.from), json([2, 2]), 'from: the last tile the bolt crossed'); assert.ok(out.cause.raw >= 2 && out.cause.raw <= 5); }
      else misses++;
      assert.equal(ev[0].k, 'attacked'); assert.equal(ev[ev.length - 1].k, 'noise');
    }
    assert.ok(hits > 5 && misses > 5, `${hits} hits, ${misses} misses`);
    // Your Pin-Driver's bolt (W1-KIT through W1-ARCH-B's Ranged.shoot): k item, naming the
    // instrument, with its own damage range and Acc in how; a surprise bolt is not ×1.5.
    let shots = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = X.Setup.room(seed, { acc: 'T0', depth: 1, map, you: [1, 2], kit: { weapon: { form: 'light' } }, items: [{ uid: 'pd', kind: 'instrument', where: { at: 'kit', slot: 'instrument' } }],
        exhibits: [ex([6, 2], { mode: 'hunting', stats: { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }), ex([6, 1], { mode: 'dormant', stats: { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } })] });
      const [you, target, sleeper] = s.actors, ev = [], how = { kind: 'shot', range: 5, via: [5, 2], item: 'pd', dmin: 1, dmax: 4, acc: 99 };
      X.Combat.attack(s, you, target, ev, how);
      checked(X, ev);
      const out = ev.find(e => e.k === 'damaged' || e.k === 'missed');
      assert.equal(json([out.cause.k, out.cause.item, out.cause.range, out.cause.chance]), json(['item', 'pd', 5, N.HIT_MAX]), 'Acc 99 from how');
      if (out.k === 'damaged') { shots++; assert.ok(out.cause.raw >= 1 && out.cause.raw <= 4, 'the instrument\'s damage, not the weapon\'s'); }
      const sv = [];
      X.Combat.attack(s, you, sleeper, sv, Object.assign({}, how, { via: [5, 1] }));
      checked(X, sv);
      const caught = sv.find(e => e.k === 'damaged');
      assert.equal(json([caught.cause.k, caught.cause.surprise, caught.cause.raw]), json(['item', 1, 4]), 'a surprise bolt deals its maximum, not ×1.5');
    }
    assert.ok(shots > 20, `${shots} of 30 bolts landed`);
    // A melee blow: k attack, from the attacker's tile, as before; a Light weapon's surprise blow is ×1.5.
    const m = X.Setup.room(1, { acc: 'T0', depth: 1, map, you: [2, 2], kit: { weapon: { form: 'light' } }, exhibits: [ex([3, 2], { mode: 'dormant', stats: { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } })] });
    const mv = X.Step.step(m, { a: 'attack', uid: m.actors[1].uid }), blow = mv.find(e => e.k === 'damaged');
    assert.equal(json([blow.cause.k, blow.cause.from, blow.cause.range, blow.cause.raw]), json(['attack', [2, 2], undefined, X.Int.pct(m.actors[0].dmax, N.SURPRISE_LIGHT_PCT)]));
    assert.throws(() => X.Combat.attack(m, m.actors[1], m.actors[0], [], { kind: 'shot' }), /range/);
  });

  test('IF-05: an exhibit that names a pack or shared species takes its archetype, role, modifiers, modParams, trigger and group unless it gives its own', () => {
    const X = loadCore(), R = X.Roles;
    for (const acc of ['M11', 'T0']) {
      const s = X.Setup.room(1, { acc, depth: 3, map: OPEN, you: [1, 1], exhibits: [{ sp: 'M11.3', at: [5, 3], mode: 'dormant', stats: R.stats('artillery', 3) }] });
      const a = s.actors[1];
      assert.equal(json([a.arch, a.role, a.mods, a.modParams, a.trigger, a.group]), json(['kiter', 'artillery', ['old_repair'], { old_repair: { side: 'W' } }, null, null]), `in ${acc}`);
      // Its label reads the species' line, which now says what it is.
      assert.equal(X.Labels.of(s, a.uid).behaviour, X.Clauses.line(X.Packs.species('M11', 'M11.3'), { depth: 3 }));
    }
    // The exhibit's own fields win; a species with no record is a plodder, as before.
    const own = X.Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [1, 1], exhibits: [{ sp: 'M11.3', arch: 'plodder', mods: [], at: [5, 3], stats: R.stats('artillery', 3) }, { sp: 'nobody', at: [6, 3], stats: R.stats('fodder', 3) }] });
    assert.equal(json(own.actors.slice(1).map(a => [a.arch, a.mods, a.modParams])), json([['plodder', [], { old_repair: { side: 'W' } }], ['plodder', [], {}]]));
    // A species with a modifier gets its speed; one that never sleeps is made awake.
    const A41 = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [1, 1], exhibits: [{ sp: 'A4.1', at: [5, 3], stats: R.stats('fodder', 1) }, { sp: 'night_watchman', at: [6, 3], stats: R.stats('warden', 1) }] });
    assert.equal(json(A41.actors.slice(1).map(a => [a.arch, a.mods, a.trigger, a.speed, a.mode])), json([['plodder', ['marble'], 'ally_hit', 'slow', 'dormant'], ['night_watchman', [], 'awake', null, 'awake']]));
    assert.equal(A41.actors[2].woke.cause.k, 'awake');
  });

  test('IF-06: an item given at the tote or in a slot is carried or worn; a slot given twice, or the wrong kind for a slot, is refused', () => {
    const X = loadCore();
    const items = [{ uid: 'c1', kind: 'consumable', where: { at: 'tote' }, ck: 'fixative', n: 2 }, { uid: 'pd', kind: 'instrument', where: { at: 'kit', slot: 'instrument' } },
      { uid: 'cu', kind: 'curio', where: { at: 'kit', slot: 'curio1' }, prims: [{ id: 'acc', cls: 'S' }] }, { uid: 'w2', kind: 'weapon', where: { at: 'kit', slot: 'weapon' }, form: 'heavy', tier: 1 },
      { uid: 'f1', kind: 'curio', where: { at: 'floor', x: 4, y: 4 } }];
    const s = room(X, OPEN, [2, 2], [], null, { items, grade: 3 });
    assert.equal(json(s.you), json({ kit: { weapon: 'w2', garment: 'you.g', curio: [null, 'cu'], instrument: 'pd' }, tote: ['c1'] }));
    const w = s.items.find(i => i.uid === 'you.w');
    assert.equal(json(w.where), json({ at: 'gone' }), 'the starting weapon makes way');
    assert.equal(json([s.actors[0].weaponForm, s.actors[0].dmin, s.actors[0].dmax]), json(['heavy', 3, 8]), 'you wield what you were given');
    // Every item is in exactly one place.
    const places = s.items.map(i => i.where.at === 'kit' ? 'kit:' + i.where.slot : i.where.at === 'tote' ? 'tote' : i.where.at + ':' + i.uid);
    assert.equal(new Set(places.filter(p => p.startsWith('kit:'))).size, places.filter(p => p.startsWith('kit:')).length);
    const bad = extra => () => room(X, OPEN, [2, 2], [], null, { items: extra });
    assert.throws(bad([{ uid: 'a', kind: 'curio', where: { at: 'kit', slot: 'curio0' } }, { uid: 'b', kind: 'curio', where: { at: 'kit', slot: 'curio0' } }]), /curio0 is given twice/);
    assert.throws(bad([{ uid: 'a', kind: 'weapon', where: { at: 'kit', slot: 'instrument' }, form: 'light', tier: 1 }]), /instrument slot holds an instrument/);
    assert.throws(bad([{ uid: 'a', kind: 'curio', where: { at: 'kit', slot: 'hat' } }]), /no slot hat/);
    assert.throws(bad([{ uid: 'you.w', kind: 'curio', where: { at: 'tote' } }]), /you\.w is given twice/);
    assert.throws(bad(Array.from({ length: X.N.TOTE_SLOTS + 1 }, (_, i) => ({ uid: 't' + i, kind: 'consumable', where: { at: 'tote' }, ck: 'card', n: 1 }))), /tote holds/);
    assert.equal(X.State.plainData(s), null);
  });

  test('IF-07: an exhibit\'s statuses, target, last-known tile and sawYou given in the spec reach it, your statuses too, and an unknown field is refused', () => {
    const X = loadCore();
    const s = room(X, OPEN, [2, 2], [ex([5, 2], { statuses: [{ id: 'fixed', until: 5 }], lastKnown: [1, 1], target: [2, 3], sawYou: true, pips: 2, mode: 'awake' })], null,
      { youStatuses: [{ id: 'rooted', turns: 2 }] });
    const [you, a] = s.actors;
    assert.equal(json([a.statuses, a.lastKnown, a.target, a.sawYou, a.pips]), json([[{ id: 'fixed', until: 5, turns: null, from: null }], [1, 1], [2, 3], true, 2]));
    // Your status of 2 turns is settled as the room is made: your decisions at turns 0 and 1.
    assert.equal(json(you.statuses), json([{ id: 'rooted', until: 2, turns: null, from: 0 }]));
    let rooted = 0;
    while (X.Step.step(X.State.clone(s), { a: 'move', dir: 6 })[0].reason === 'rooted') { X.Step.step(s, { a: 'wait' }); rooted++; assert.ok(rooted < 5); }
    assert.equal(rooted, 2);
    assert.ok(X.Status.has(a, 'fixed'));
    assert.throws(() => room(X, OPEN, [2, 2], [ex([5, 2], { statsus: [] })]), /unknown field statsus/);
    assert.throws(() => room(X, OPEN, [2, 2], [ex([5, 2], { statuses: [{ id: 'sleepy', turns: 2 }] })]), /no status sleepy/);
    assert.throws(() => room(X, OPEN, [2, 2], [], null, { youStatus: [] }), /unknown field youStatus/);
  });

  test('IF-08: a wake-at-once trigger\'s pip event (touch_case, ally_hit, tether) has its schema and its sentence', () => {
    const X = loadCore();
    for (const k of ['touch_case', 'ally_hit', 'tether']) {
      const s = room(X, OPEN, [2, 2], [ex([6, 4], { mode: 'dormant' })]), ev = [];
      assert.equal(X.Wake.addPips(s, s.actors[1], 3, { k, by: 'you' }, ev), true, k);
      checked(X, ev);
      assert.equal(json(ev.map(e => e.k)), json(['pip', 'woke', 'hunting']));
      const line = X.Text.event(ev[0]);
      assert.ok(X.Text.defined('pip', k) && /^The training dummy .*\.$/.test(line) && !/undefined|NaN|\[object/.test(line), line);
    }
  });

  test('IF-09: invulnerable damage from any cause passes its schema; every damage cause accepts saved and side', () => {
    const X = loadCore();
    marker(X, 'planted_warden', 'ring');
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [ex([3, 2], { arch: 'planted_warden' })] }, { invulnerable: true });
    s.actors[0].hp = 1;
    const ev = checked(X, [...X.Step.step(s, { a: 'wait' }), ...X.Step.step(s, { a: 'wait' })]);
    const hit = ev.find(e => e.k === 'damaged' && e.who === 'you');
    assert.equal(json([hit.cause.k, hit.cause.saved, s.actors[0].hp]), json(['special', 1, 1]));
    for (const [k, c] of Object.entries(X.Registry.CAUSES.damaged)) for (const f of ['saved', 'side']) assert.ok(c.list.some(x => x.name === f && x.optional), `damaged.${k} accepts ${f}`);
  });

  test('IF-10: a scenario whose build ignores rulesOff fails, saying so, rather than running with the rule half off', () => {
    const H = require(path.join(root, 'test/behaviour/_harness.js'));
    const sp = C.Packs.species('A4', 'A4.1');
    const sc = H.scenario({ name: 'marble walks slowly', id: 'marble', inv: [],
      build: (params, sp, depth, opts) => C.Setup.room(opts.seed, { acc: 'T0', depth, map: OPEN, you: [1, 1], exhibits: [{ sp: sp.id, at: [6, 3], mode: 'hunting', stats: C.Roles.stats(sp.role, depth) }] }),
      actions: [{ a: 'wait' }], expect: () => null });
    assert.equal(H.run(C, sc, sp, 1).failure, null);
    assert.match(H.run(C, sc, sp, 1, { rulesOff: ['marble'] }).failure, /build must pass rulesOff/);
  });

  test('IF-12: an exhibit that starts out hunting knows your tile, so its hunt has a last-known tile from the start', () => {
    const X = loadCore();
    const t = X.TestRoom.create(1), you = t.actors[0];
    for (const a of t.actors.slice(1)) assert.equal(json(a.lastKnown), a.mode === 'hunting' ? json([you.x, you.y]) : 'null', a.uid);
    for (let i = 1; i < t.actors.length; i++) if (t.actors[i].mode === 'hunting') { const c = X.State.clone(t), a = c.actors[i]; assert.notEqual(X.AI.towards(c, a, a.lastKnown, 'onto', []), undefined); }
    const w = room(X, OPEN, [2, 2]), cv = [];
    w.tick = 350; w.turn = 3;
    const watch = X.Actors.spawn(w, { uid: 'T0.1.watch.1', sp: 'watch', x: 6, y: 3, hp: 9, mode: 'hunting', next: 350 });
    X.Wake.created(w, watch, 'night_watch', {}, cv);
    const idler = X.Actors.spawn(w, { uid: 'T0.1.room.9', sp: 'x', x: 6, y: 4, hp: 9, mode: 'awake', next: 350 });
    X.Wake.created(w, idler, 'awake', {}, null);
    assert.equal(json([watch.lastKnown, idler.lastKnown]), json([[2, 2], null]));
  });

  test('IF-13: a split half\'s summoned cause is {how, from, parent} as W1-ARCH-A will write it', () => {
    const X = loadCore(), w = room(X, OPEN, [2, 2]), ev = [];
    const parent = X.Actors.spawn(w, { uid: 'T0.1.room.1', sp: 'x', x: 5, y: 3, hp: 9, mode: 'hunting' });
    X.Wake.created(w, parent, 'awake', {}, null);
    const half = X.Actors.spawn(w, { uid: 'T0.1.room.1/1', sp: 'x', x: 6, y: 3, hp: 4, mode: 'hunting' });
    X.Wake.created(w, half, 'summoned', { how: 'split', from: parent.uid, parent: JSON.parse(JSON.stringify(parent.woke)) }, ev);
    checked(X, ev);
    const line = X.Text.event(ev[0]);
    assert.ok(/^The training dummy .*\.$/.test(line) && !/undefined|NaN|\[object/.test(line), line);
  });

  // ---- Rules (W0-R) ----

  test('R1: rooted, a bump into a real case and into a mimic in its disguise are refused alike, as glass; a step is still refused as rooted', () => {
    const X = loadCore();
    const map = ['#######', '#.....#', '#.v...#', '#.....#', '#######'];
    const s = room(X, map, [3, 1], [ex([4, 2], { mode: 'dormant', arch: 'plodder' })], null, { fixtures: [X.Cases.make({ x: 2, y: 2, num: '9.1.1' })] });
    X.Cases.disguise(s, s.actors[1]);
    const ref = dir => { const ev = X.Step.step(X.State.clone(s), { a: 'move', dir }); return ev[0].k === 'refused' ? ev[0].reason : 'accepted'; };
    assert.equal(json([ref(5), ref(3)]), json(['behind_glass', 'behind_glass']), 'not rooted');
    s.actors[0].statuses.push({ id: 'rooted', until: 9, turns: null, from: 0 });
    assert.equal(json([ref(5), ref(3), ref(6), ref(0)]), json(['behind_glass', 'behind_glass', 'rooted', 'rooted']), 'rooted: the cases alike; a step or a bump into a wall is rooted');
  });

  test('R2: a ring never marks or strikes into an intact case, so an exhibit in a case and a mimic in its disguise are untouched; a beam still passes glass', () => {
    const X = loadCore();
    marker(X, 'planted_warden', 'ring'); marker(X, 'planted_sniper', 'line');
    const map = ['#########', '#.......#', '#...v...#', '#.......#', '#########'];
    const s = room(X, map, [7, 3], [ex([3, 2], { arch: 'planted_warden' }), ex([4, 2], { mode: 'dormant' }), ex([2, 3], { mode: 'dormant', arch: 'plodder' })]);
    const [, w, inCase, mimic] = s.actors;
    X.Cases.disguise(s, mimic);
    const tiles = X.Specials.tiles(s, w, 'ring');
    assert.equal(json(tiles), json([[2, 1], [3, 1], [4, 1], [2, 2], [3, 3], [4, 3]]), 'the hold tiles round it, but not the case nor the mimic\'s case');
    const ev = [...X.Step.step(s, { a: 'wait' }), ...X.Step.step(s, { a: 'wait' })];
    assert.ok(ev.some(e => e.k === 'special' && e.who === w.uid && !e.cancelled), 'the ring resolved');
    assert.ok(!ev.some(e => e.k === 'damaged' && (e.who === inCase.uid || e.who === mimic.uid)), 'nothing struck through glass');
    assert.ok(![inCase, mimic].some(a => a.woke && a.woke.cause.k === 'damage'), 'and nothing woke by damage');
    assert.ok(X.Cases.encased(s, mimic), 'the mimic is still in its disguise');
    // Whatever a mark lists, its resolve does not strike into an intact case.
    const t = room(X, map, [7, 3], [ex([3, 2], { arch: 'planted_warden' }), ex([4, 2], { mode: 'dormant' })]), tv = [];
    t.actors[1].telegraph = { sp: 'ring', tiles: [[4, 2]], from: [[3, 2]], gross: 6, effect: 'damage', turn: 0, tick: 0 };
    X.Specials.resolve(t, t.actors[1], tv);
    assert.ok(!tv.some(e => e.k === 'damaged'), json(tv));
    // A beam along the row passes the case and hits what stands in it.
    const b = room(X, map, [7, 2], [ex([1, 2], { arch: 'planted_sniper' }), ex([4, 2], { mode: 'dormant' })]);
    const bv = [...X.Step.step(b, { a: 'wait' }), ...X.Step.step(b, { a: 'wait' })];
    assert.ok(bv.some(e => e.k === 'damaged' && e.who === b.actors[2].uid && e.cause.k === 'special'), 'the beam hits the exhibit in the case');
  });

  test('R3: the ring drawn is from your tile on the map as it is now; after a Heavy blow, a door opened before your decision shows in it', () => {
    const X = loadCore();
    const map = ['#######', '#.....#', '###+###', '#.....#', '#.....#', '#######'];
    const s = room(X, map, [3, 1], [ex([2, 1], { mode: 'awake' }), ex([3, 3], { mode: 'hunting' }), ex([3, 4], { mode: 'dormant' })], null, { kit: { weapon: { form: 'heavy', tier: 1 } } });
    const [you, d, h, z] = s.actors;
    h.next = 120;
    const ev = X.Step.step(s, { a: 'attack', uid: d.uid });
    assert.equal(json([s.tick, X.Grid.ch(s.dept, 3, 2)]), json([150, "'"]), 'the hunter opened the door at 120, after the boundary at 100');
    assert.ok(ev.some(e => e.k === 'opened' && e.tick === 120));
    assert.ok(!ev.some(e => e.k === 'pip' && e.who === z.uid && e.cause.k === 'ring'), 'no ring pip at the boundary of 100, while the door was shut');
    assert.equal(X.Vision.inRing(s, 3, 4), true, 'but the ring drawn now reaches it, through the open door');
    // Another blow (not still, radius 3): the boundary at 200 applies the ring drawn.
    const ev2 = X.Step.step(s, { a: 'attack', uid: d.uid });
    assert.ok(ev2.some(e => e.k === 'pip' && e.who === z.uid && e.tick === 200 && e.cause.k === 'ring'), json(ev2.filter(e => e.k === 'pip')));
    assert.equal(you.next, 300);
  });

  test('R4: a special that hits several actors applies every hit and its wakes before any noise, the noise of one it destroys included', () => {
    for (const special of ['ring', 'line']) {
      const X = loadCore();
      marker(X, 'planted_' + special, special); plantHearing(X);
      const map = ['################', '#........#.....#', '#........#.....#', '#........#.....#', '################'];
      const one = Object.assign({}, tough, { hp: 1 });
      // ring: the owner at (3,2) strikes (2,2) and (4,2); line: from (1,2) along the row to you
      // at (8,2). V1 at (2,2) falls to it; V2 at (4,2) is of G's group; G, at (5,3) with 2
      // pips, is off the marked tiles, within ALLY_HIT_RANGE of V2 and within earshot of V1.
      const ex2 = special === 'ring'
        ? [ex([3, 2], { arch: 'planted_ring' }), ex([2, 2], { mode: 'dormant', stats: one }), ex([4, 2], { mode: 'dormant', group: 'g' }), ex([5, 3], { mode: 'dormant', group: 'g', pips: 2 })]
        : [ex([1, 2], { arch: 'planted_line' }), ex([2, 2], { mode: 'dormant', stats: one }), ex([4, 2], { mode: 'dormant', group: 'g' }), ex([5, 3], { mode: 'dormant', group: 'g', pips: 2 })];
      const s = room(X, map, special === 'ring' ? [14, 3] : [8, 2], ex2);
      const G = s.actors[4];
      X.Step.step(s, { a: 'wait' });
      const ev = X.Step.step(s, { a: 'wait' });
      const order = ev.filter(e => ['damaged', 'died', 'noise'].includes(e.k)).map(e => e.k);
      assert.ok(order.indexOf('noise') > order.lastIndexOf('damaged'), `${special}: every hit before any noise: ${order}`);
      assert.equal(json([G.mode, G.woke && G.woke.cause.k]), json(['hunting', 'ally_hit']), `${special}: the 2-pip ally wakes hunting, by ally_hit`);
      const noises = ev.filter(e => e.k === 'noise').map(e => e.cause.k);
      assert.equal(json(noises), json(['destroyed', 'special']), `${special}: the destroyed noise, then the special's`);
    }
    // Noise.hold, on its own: noises made inside come out after it, in order; nested holds
    // come out at the outer one's end; an error inside drops them.
    const X = loadCore(), s = room(X, OPEN, [2, 2]), ev = [];
    X.Noise.hold(() => { X.Noise.emit(s, 1, 1, 'soft', { k: 'attack', by: 'you' }, ev); X.Noise.hold(() => X.Noise.emit(s, 2, 1, 'loud', { k: 'attack', by: 'you' }, ev)); ev.push({ k: 'marker' }); });
    assert.equal(json(ev.map(e => e.k + (e.x || ''))), json(['marker', 'noise1', 'noise2']));
    assert.throws(() => X.Noise.hold(() => { X.Noise.emit(s, 3, 1, 'soft', { k: 'attack' }, ev); throw new Error('inside'); }), /inside/);
    X.Noise.emit(s, 4, 1, 'soft', { k: 'attack' }, ev);
    assert.equal(json(ev.map(e => e.k + (e.x || ''))), json(['marker', 'noise1', 'noise2', 'noise4']), 'nothing held after an error');
  });

  test('R5: at a turn boundary noise comes after the wake checks, so a 2-pip sleeper in your ring wakes hunting while you cough', () => {
    const X = loadCore(), N = X.N;
    X.Status.EFFECTS.coughing = (state, a, st, ev) => X.Noise.emit(state, a.x, a.y, 'soft', { k: 'cough', by: a.uid }, ev);
    plantHearing(X);
    const s = room(X, OPEN, [2, 2], [ex([4, 2], { mode: 'dormant', pips: 2 })]), z = s.actors[1];
    s.actors[0].statuses.push({ id: 'coughing', until: 5, turns: null, from: 0 });
    const ev = checked(X, X.Step.step(s, { a: 'wait' }));
    assert.equal(json([z.mode, z.woke.cause.k]), json(['hunting', 'ring']));
    const ks = ev.filter(e => ['noise', 'pip', 'woke'].includes(e.k)).map(e => e.k + ':' + e.cause.k);
    assert.equal(json(ks), json(['pip:ring', 'woke:ring', 'noise:cough']));
    // One pip short, the cough still counts: ring, then cough.
    const t = room(X, OPEN, [2, 2], [ex([4, 2], { mode: 'dormant', pips: 1 })]);
    t.actors[0].statuses.push({ id: 'coughing', until: 5, turns: null, from: 0 });
    X.Step.step(t, { a: 'wait' });
    assert.equal(json([t.actors[1].mode, t.actors[1].woke.cause.k]), json(['awake', 'noise']), 'the ring\'s pip, then the cough\'s third');
    assert.ok(N.COUGH_TURNS > 0);
  });

  test('R6: a beam stops before a tile a sight-blocking surface covers, as sight does', () => {
    const X = loadCore();
    const map = ['############', '#..........#', '############'];
    const s = room(X, map, [9, 1], [ex([2, 1], { arch: 'axis_sniper' })]), a = s.actors[1];
    assert.equal(json(X.Specials.tiles(s, a, 'line').map(t => t[0])), json([3, 4, 5, 6, 7, 8, 9, 10]));
    X.Surfaces.add(s, 'dust', 6, 1, 3, 3, a.uid, []);
    assert.equal(X.Grid.los(s.dept, 2, 1, 9, 1), false);
    assert.equal(json(X.Specials.tiles(s, a, 'line').map(t => t[0])), json([3, 4]), 'it stops before the dust at 5..7');
    assert.equal(X.Grid.clear(s.dept, 4, 1), true); assert.equal(X.Grid.clear(s.dept, 5, 1), false); assert.equal(X.Grid.clear(s.dept, 0, 1), false);
  });

  test('R7: an exhibit fixed while its mark is pending loses the mark at once, and another may mark those tiles', () => {
    const X = loadCore();
    marker(X, 'planted_warden', 'ring');
    const s = room(X, OPEN, [2, 2], [ex([3, 2], { arch: 'planted_warden' }), ex([5, 2], { arch: 'planted_warden' })]);
    const [, w, w2] = s.actors;
    w2.next = 1000;
    X.Step.step(s, { a: 'wait' });
    assert.equal(X.Specials.marks(s).length, 8);
    const ev = [];
    X.Status.apply(s, w, 'fixed', 4, { k: 'status', id: 'fixed' }, ev);
    checked(X, ev);
    assert.equal(json(ev.map(e => [e.k, e.cancelled || null])), json([['status', null], ['special', true]]));
    assert.equal(json([w.telegraph, X.Specials.marks(s).length]), json([null, 0]));
    assert.equal(X.Specials.canMark(s, w2, 'ring', X.Specials.tiles(s, w2, 'ring')), true);
  });

  test('R9, D5: an exhibit\'s action that costs nothing, or an actor scheduled behind the clock, stops step() with an error', () => {
    const X = loadCore();
    const s = room(X, OPEN, [2, 2], [ex([6, 2])]);
    let n = 0;
    X.AI.act = () => { if (++n > 10000) throw new Error('still looping'); return 0; };
    assert.throws(() => X.Step.step(s, { a: 'wait' }), /action cost 0/);
    const Y = loadCore(), t = room(Y, OPEN, [2, 2]);
    for (let i = 0; i < 5; i++) Y.Step.step(t, { a: 'wait' });
    Y.Actors.spawn(t, { uid: 'late', x: 6, y: 3, hp: 5, mode: 'awake' });
    assert.throws(() => Y.Step.step(t, { a: 'wait' }), /late is scheduled at 0, behind the clock at 500/);
  });

  // ---- Determinism (W0-D) ----

  test('D6: an event field or cause that is not plain data stops the emit, where a JSON copy would have made it null; undefined is absent', () => {
    const X = loadCore(), s = room(X, OPEN, [2, 2], [ex([5, 2], { mode: 'dormant' })]), a = s.actors[1];
    assert.throws(() => X.Causes.emit(s, [], 'hunting', { who: a.uid, was: 'dormant' }, { k: 'damage', by: 'you', dist: 0 / 0 }), /hunting\.cause\.dist is not plain data/);
    assert.throws(() => X.Causes.emit(s, [], 'noise', { x: 1, y: 1.5, cls: 'soft', range: 3 }, { k: 'attack' }), /noise\.y is not plain data/);
    assert.throws(() => X.Wake.wake(s, a, 'hunting', { k: 'damage', by: 'you', dist: 1 / 0 }, []), /not plain data/);
    assert.equal(a.mode, 'dormant', 'refused before anything changed');
    const e = X.Causes.emit(s, [], 'hunting', { who: a.uid, was: 'dormant' }, { k: 'damage', by: 'you', x: undefined });
    assert.equal(json(e.cause), json({ k: 'damage', by: 'you' }));
    assert.equal(X.Causes.check(e), null);
  });

  test('D7: a modifier switched off no longer decides which costs its actor\'s speed scales', () => {
    const X = loadCore(), N = X.N;
    X.Registry.define('ARCHETYPES', 'planted_runner', {}); X.Archetypes.add('planted_runner', {});
    X.Registry.define('MODIFIERS', 'planted_hasty', {});
    X.Archetypes.addModifier('planted_hasty', { speedApplies: () => ['move', 'act'] });
    const on = room(X, OPEN, [2, 2], [ex([5, 2], { arch: 'planted_runner', speed: 'fast', mods: ['planted_hasty'] })]);
    const off = room(X, OPEN, [2, 2], [ex([5, 2], { arch: 'planted_runner', speed: 'fast', mods: ['planted_hasty'] })], { rulesOff: ['planted_hasty'] });
    assert.equal(X.Actors.attackCost(on, on.actors[1]), X.Int.pct(N.COST_ATTACK, N.SPEED_FAST_PCT), 'on: its speed covers its blows');
    assert.equal(X.Actors.attackCost(off, off.actors[1]), N.COST_ATTACK, 'off: steps only, the default');
    assert.equal(json(X.Archetypes.speedApplies(off, off.actors[1])), json(['move']));
  });
};
