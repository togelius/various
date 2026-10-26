// The splitter's Behaviour line (BUILD.md §3.2, §5.3, §5.5; W1-ARCH-A): "Walks one tile at a
// time and strikes from beside you for {dmg}. Each hit it survives with 2 or more health splits it
// into two halves of that health, if there is room beside it; halves split again, up to
// {SPLIT_MAX} splits deep." Its halves are made with the wake cause `summoned`.
// The scenarios run for every pack species with the clause (A.4's Busts of the Proposing
// Trustee, marble and plaster) at depths 1–7, with the invariants checked and a clone after
// every step; the exact numbers are also checked by calling Combat.hurt directly.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const C = loadCore();
  const { N, Int, Setup, Roles, Combat, Causes, Text, Packs, State } = C;
  const json = x => JSON.stringify(x);
  const ROOM = ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'];
  const NOOK = ['####', '#..#', '####'];
  const isHalf = e => e.k === 'woke' && e.was === null && !!e.cause && e.cause.k === 'summoned' && e.cause.how === 'split';
  // You, hard to kill, with a T2 Balanced weapon at grade III, beside one hunting splitter.
  const make = (X, map, you, at) => (params, sp, depth, opts) => X.Setup.room(opts.seed, { acc: 'T0', depth, map, you, grade: 3,
    kit: { weapon: { form: 'balanced', tier: 2 } }, exhibits: [{ sp: sp.id, at, mode: 'hunting', stats: X.Roles.stats(sp.role, depth) }] },
    { rulesOff: opts.rulesOff, invulnerable: true });
  // Strike the first splitter body you can; wait when none is beside you; stop when none is left.
  const fight = X => state => {
    if (!state.actors.some(a => a.arch === 'splitter' && !a.gone)) return null;
    const att = X.Step.legal(state).filter(a => a.a === 'attack');
    return att.length ? att[0] : { a: 'wait' };
  };

  // Replays a run's events against the clause: every hit on a body, what it left, and whether
  // and how the body split. Returns {failure, splits, deepest, capped}.
  function ledger(r, params) {
    const hp = new Map(), gen = new Map(), kids = new Map(), born = new Map(), out = { failure: null, splits: 0, deepest: 0, capped: 0 };
    for (const a of r.start.actors.slice(1)) { hp.set(a.uid, a.hp); gen.set(a.uid, a.gen); kids.set(a.uid, a.kids); }
    const ev = r.events, fail = m => { out.failure = out.failure || m; };
    for (let i = 0; i < ev.length && !out.failure; i++) {
      const e = ev[i];
      if (isHalf(e)) { born.set(e.who, e.tick); continue; }
      if (e.k !== 'damaged' || !hp.has(e.who)) continue;
      const uid = e.who, before = hp.get(uid);
      if (e.hp !== Math.max(0, before - e.amount)) fail(`${uid} had ${before} health and lost ${e.amount}, but was left ${e.hp}`);
      let end = ev.length;
      for (let j = i + 1; j < ev.length; j++) if (ev[j].k === 'damaged') { end = j; break; }
      const hi = ev.findIndex((f, j) => j > i && j < end && isHalf(f) && f.cause.from === uid);
      const should = e.hp >= 2 && gen.get(uid) < params.SPLIT_MAX;
      if (should && hi < 0) { fail(`a hit left ${uid} ${e.hp} health at generation ${gen.get(uid)}, with room beside it, and it did not split`); break; }
      if (!should && hi >= 0) { fail(`${uid} split with ${e.hp} health at generation ${gen.get(uid)}`); break; }
      if (!should && e.hp >= 2) out.capped++;
      if (hi < 0) { hp.set(uid, e.hp); continue; }
      const f = ev[hi], share = Math.max(1, Int.pct(e.hp, N.SPLIT_HP_PCT)), k = kids.get(uid) + 1;
      if (f.who !== `${uid}/${k}`) fail(`${uid}'s half number ${k} is ${f.who}`);
      if (f.mode !== 'hunting') fail(`${f.who} was made ${f.mode}, not hunting`);
      const parent = r.state.actors.find(a => a.uid === uid);
      if (json(f.cause) !== json({ k: 'summoned', how: 'split', from: uid, by: 'you', parent: parent.woke })) fail(`${f.who}'s cause is ${json(f.cause)}`);
      hp.set(uid, e.hp - share); hp.set(f.who, share);
      gen.set(uid, gen.get(uid) + 1); gen.set(f.who, gen.get(uid)); kids.set(uid, k); kids.set(f.who, 0);
      out.splits++; out.deepest = Math.max(out.deepest, gen.get(uid));
    }
    if (out.failure) return out;
    for (const a of r.state.actors.slice(1)) {
      if (!hp.has(a.uid)) { out.failure = `${a.uid} appeared from nowhere`; break; }
      if (a.hp !== hp.get(a.uid)) { out.failure = `${a.uid} has ${a.hp} health; its hits and splits leave ${hp.get(a.uid)}`; break; }
      if (a.gen !== gen.get(a.uid) || a.gen > params.SPLIT_MAX) { out.failure = `${a.uid} is of generation ${a.gen}`; break; }
      if (a.maxHp !== r.start.actors[1].maxHp) { out.failure = `${a.uid} has ${a.maxHp} maximum health, not the body's ${r.start.actors[1].maxHp}`; break; }
      // A half first acts a beat after it appears.
      const t = born.get(a.uid), first = r.events.find(g => g.tick !== undefined && (g.k === 'attacked' ? g.by === a.uid : g.k === 'moved' && g.who === a.uid));
      if (t !== undefined && first && first.tick < t + N.COST_STEP) { out.failure = `${a.uid} acted at ${first.tick}, sooner than a beat after it appeared at ${t}`; break; }
    }
    return out;
  }

  const scenarios = X => ({
    splits: H.scenario({
      name: 'every hit a splitter survives with 2 or more health splits it into two halves, down to SPLIT_MAX splits deep', id: 'splitter',
      build: make(X, ROOM, [5, 3], [6, 3]), actions: fight(X), seeds: [1, 2, 3], cap: 150, clone: true,
      expect(r, params) {
        const l = ledger(r, params);
        if (l.failure) return l.failure;
        if (!l.splits) return 'it never split';
        if (r.state.actors.slice(1).some(a => !a.gone)) return 'some bodies were still standing after 150 turns';
        if (r.state.actors.length - 1 > 2 ** params.SPLIT_MAX) return `${r.state.actors.length - 1} bodies; ${params.SPLIT_MAX} splits deep make at most ${2 ** params.SPLIT_MAX}`;
        return null;
      },
    }),
    nook: H.scenario({
      name: 'a splitter with no room beside it does not split', id: 'splitter',
      build: make(X, NOOK, [2, 1], [1, 1]), actions: fight(X), cap: 60, clone: true,
      expect(r) {
        if (r.events.some(isHalf)) return 'it split with no room beside it';
        const uid = r.start.actors[1].uid;
        return r.events.some(e => e.k === 'damaged' && e.who === uid && e.hp >= 2) ? null : 'no hit left it more than 1 health, so this shows nothing';
      },
    }),
  });
  const S = scenarios(C), list = H.species(C, 'splitter');

  test('the splitter\'s scenarios cover every species with its clause, at depths 1–7', () => {
    assert.ok(list.length >= 14 && list.every(x => x.sp.archetype === 'splitter'), json(list.map(x => x.sp.id)));
    assert.deepEqual([...new Set(list.map(x => x.depth))], H.DEPTHS);
    assert.ok(list.some(x => x.sp.modifiers.includes('marble')) && list.some(x => x.sp.modifiers.includes('plaster')));
    assert.equal(json(H.species(C, 'summoned')), '[]', 'summoned is a wake cause, not a clause; the splitter\'s scenarios prove it');
  });

  test(`splitter: ${S.splits.name}, for every species at depths 1–7, invariants and clone checked`, () => {
    const results = H.sweep(C, S.splits, list);
    assert.equal(results.length, list.length * 3);
    assert.deepEqual(H.failures(results), []);
    // Across the sweep, halves split again, and bodies at SPLIT_MAX with health to spare do not.
    const ls = results.map(r => ledger(r, r.params));
    assert.ok(ls.some(l => l.deepest === N.SPLIT_MAX), 'some half split again');
    assert.ok(ls.some(l => l.capped > 0), 'some body at SPLIT_MAX was hit, kept 2 or more health, and did not split');
    // Every event the halves' making emits passes its schema.
    for (const r of results) for (const e of r.events) assert.equal(Causes.check(e), null, json(e));
  });

  test(`splitter: ${S.nook.name}, for every species at depths 1–7, invariants and clone checked`, () => {
    assert.deepEqual(H.failures(H.sweep(C, S.nook, list)), []);
  });

  // A room with one splitter of the given species, hunting, its health set, for direct hits.
  function one(spId, hp, map, at) {
    const sp = Packs.speciesFor(null, { sp: spId }), s = Setup.room(1, { acc: 'T0', depth: 2, map: map || ROOM, you: [1, 1],
      exhibits: [{ sp: spId, at: at || [5, 3], mode: 'hunting', stats: Roles.stats(sp.role, 2), hp, maxHp: 40 }] }, { rulesOff: ['plaster'] });
    return { s, a: s.actors[1] };
  }
  const blow = (s, a, n, ev) => Combat.hurt(s, a, n, { k: 'attack', by: 'you', at: a.uid, chance: 75, roll: 10, raw: n, pad: 0, how: { kind: 'melee' }, from: [a.x - 1, a.y] }, ev);

  test('splitter: the numbers of a split, hit by hit: halves of the health left, generations, uids, the tile, the beat and the story', () => {
    const { s, a } = one('A4.4', 20);
    s.tick = 340; s.turn = 3;
    const ev = [];
    blow(s, a, 4, ev);                          // 16 left: a half of 8, the body keeps 8
    const h1 = s.actors[2];
    assert.equal(json([a.hp, a.gen, a.kids, h1.uid, h1.hp, h1.maxHp, h1.gen, h1.x, h1.y]), json([8, 1, 1, a.uid + '/1', 8, 40, 1, 5, 2]), 'the half on the first free tile, north');
    assert.equal(json([h1.mode, h1.speed, h1.mods, h1.statuses, h1.pips, h1.home, h1.next, h1.acts, h1.kids]), json(['hunting', 'slow', ['marble'], [], 0, [5, 2], 340 + N.COST_STEP, 0, 0]));
    assert.equal(json(h1.woke), json({ turn: 3, cause: { k: 'summoned', how: 'split', from: a.uid, by: 'you', parent: a.woke } }));
    assert.equal(json(h1.hunted), json(h1.woke));
    const made = ev.find(isHalf);
    assert.equal(json([made.who, made.mode]), json([h1.uid, 'hunting']));
    assert.equal(Causes.check(made), null);
    assert.equal(Text.event(made, uid => uid === 'you' ? null : 'the Bust of the Proposing Trustee'), 'The Bust of the Proposing Trustee splits in two, under your hit; the new half is hunting you.');
    blow(s, a, 2, ev);                          // 6 left: a half of 3, the body keeps 3; generation 2
    const h2 = s.actors[3];
    assert.equal(json([a.hp, a.gen, a.kids, h2.uid, h2.hp, h2.gen, h2.x, h2.y]), json([3, 2, 2, a.uid + '/2', 3, 2, 6, 2]), 'north is taken, so north-east');
    blow(s, a, 1, ev);                          // 2 left, at generation SPLIT_MAX: no split
    assert.equal(json([a.hp, a.gen, s.actors.length]), json([2, N.SPLIT_MAX, 4]));
    blow(s, h1, 1, ev);                         // the first half, at generation 1, splits in turn: 7 left, 3 and 4
    const h11 = s.actors[4];
    assert.equal(json([h1.hp, h1.gen, h1.kids, h11.uid, h11.hp, h11.gen, h11.x, h11.y]), json([4, 2, 1, h1.uid + '/1', 3, 2, 5, 1]));
    assert.equal(json(h11.woke.cause.parent), json(h1.woke), 'a copy of its own parent\'s story, which names the first body');
    const { s: t, a: b } = one('A4.4', 3), tv = [];
    blow(t, b, 1, tv);                          // 2 left: 1 and 1
    assert.equal(json([b.hp, t.actors.length, t.actors[2].hp]), json([1, 3, 1]));
    blow(t, b, 1, tv);                          // destroyed: no split
    assert.equal(json([b.gone, t.actors.length]), json([1, 3]));
    const { s: u, a: c } = one('A4.4', 2), uv = [];
    blow(u, c, 1, uv);                          // 1 left: too little to split
    assert.equal(json([c.hp, u.actors.length]), json([1, 2]));
    for (const e of [...ev, ...tv, ...uv]) assert.equal(Causes.check(e), null, json(e));
  });

  // A half that options.without names (§3.6, "remove an actor by uid"; its uid is
  // <body uid>/<k>, §3.2) is made and at once marked gone, with no event, as a Night Watchman
  // that without names is: the body still pays the half's share of its health and still
  // counts it (kids, gen), so every later half keeps its uid, and nothing else changes. Later
  // halves may take the tile the removed one would have stood on, since it holds no one.
  test('splitter: a half that options.without names is made gone, with no event; the body pays its share, and every other uid, tile and draw is as it was', () => {
    const run = without => {
      const sp = Packs.speciesFor(null, { sp: 'A4.4' });
      const s = Setup.room(1, { acc: 'T0', depth: 2, map: ROOM, you: [1, 1],
        exhibits: [{ sp: 'A4.4', at: [5, 3], mode: 'hunting', stats: Roles.stats(sp.role, 2), hp: 20, maxHp: 40 }] }, { rulesOff: ['plaster'], without });
      const a = s.actors[1], ev = [], snaps = [];
      for (const n of [4, 2]) { blow(s, a, n, ev); snaps.push(State.clone(s)); }
      return { s, a, ev, snaps };
    };
    const base = run([]), gone = base.a.uid + '/1', cut = run([gone]);
    const half = cut.s.actors.find(b => b.uid === gone);
    assert.ok(half && half.gone === 1, `the half ${gone} is made and marked gone: ${json(half && [half.uid, half.gone])}`);
    const names = e => [e.who, e.by, e.at, e.cause && e.cause.by, e.cause && e.cause.from].includes(gone);
    assert.ok(!cut.ev.some(names), `an event names the removed half: ${json(cut.ev.filter(names))}`);
    assert.ok(base.ev.some(names), 'without the removal, its making is told');
    // The body pays its share and counts it, exactly as without the removal.
    for (let i = 0; i < 2; i++) {
      const b = base.snaps[i].actors[1], c = cut.snaps[i].actors[1];
      assert.equal(json([c.hp, c.gen, c.kids, c.x, c.y]), json([b.hp, b.gen, b.kids, b.x, b.y]), `the body after hit ${i + 1}`);
    }
    // You and the body are where they were, and the next half keeps its uid and health.
    const after = cut.snaps[1], was = base.snaps[1];
    assert.equal(json(after.actors.map(b => b.uid)), json(was.actors.map(b => b.uid)));
    assert.equal(json([after.actors[0].x, after.actors[0].y, after.actors[0].hp]), json([was.actors[0].x, was.actors[0].y, was.actors[0].hp]));
    const two = after.actors.find(b => b.uid === base.a.uid + '/2'), bTwo = was.actors.find(b => b.uid === base.a.uid + '/2');
    assert.equal(json([two.gone, two.hp, two.gen, two.mode]), json([bTwo.gone, bTwo.hp, bTwo.gen, bTwo.mode]));
    // No stream was drawn differently: the removal draws nothing and moves no one's stream.
    assert.equal(json(after.rng), json(was.rng));
    // A whole fight with halves removed keeps every invariant (the split invariant counts a
    // removed half as its hit's split).
    for (const without of [[], ['A4.4.room.1/1'], ['A4.4.room.1/2', 'A4.4.room.1/1/1']]) {
      const s = Setup.room(4, { acc: 'A4', depth: 4, map: ROOM, you: [3, 2], exhibits: [{ sp: 'A4.4', at: [4, 2], mode: 'dormant', stats: Roles.stats('brute', 4) }] }, { invulnerable: true, without });
      const r = H.play(C, s, fight(C), { cap: 80, clone: true });
      assert.equal(json(r.violations.map(v => v.text)), '[]', `without ${json(without)}`);
      for (const uid of without) assert.ok(s.actors.some(b => b.uid === uid && b.gone === 1), `${uid} was made and removed`);
    }
  });

  // "The half copies the body's species, numbers, maximum health and speed, hunts as the body
  // does" (§8.1): a body given numbers and knowledge unlike its role's and its species', so
  // that a half made from the role or the species, not the body, shows.
  test('splitter: the half is the same exhibit: the body\'s species, numbers, damage, speed, trigger, group, and what it knows of you', () => {
    const sp = Packs.speciesFor(null, { sp: 'A4.4' });
    const s = Setup.room(1, { acc: 'T0', depth: 2, map: ROOM, you: [1, 1], exhibits: [{ sp: 'A4.4', at: [5, 3], mode: 'hunting', stats: Roles.stats(sp.role, 2),
      hp: 20, maxHp: 40, acc: 7, eva: 5, pad: 3, dmin: 4, dmax: 9, speed: 'fast', group: 'spares', modParams: { marble: { vein: 'grey' } }, sawYou: true, lastKnown: [2, 2] }] });
    const a = s.actors[1];
    blow(s, a, 4, []);
    const h = s.actors[2], fields = ['sp', 'arch', 'role', 'mods', 'modParams', 'trigger', 'group', 'acc', 'eva', 'pad', 'dmin', 'dmax', 'speed', 'maxHp', 'mode', 'target', 'lastKnown', 'sawYou'];
    const pick = x => fields.map(k => [k, x[k]]);
    assert.equal(json(pick(h)), json(pick(a)));
    // The numbers are the body's, not its role's or its species': it strikes for 4–9, and it has
    // seen you (so once it stops hunting, a blow at it is no surprise, as at the body).
    assert.equal(json([h.acc, h.dmin, h.dmax, h.speed, h.trigger, h.group, h.sawYou, h.lastKnown]), json([7, 4, 9, 'fast', 'ally_hit', 'spares', true, [2, 2]]));
  });

  // "A splitter splits after any hit it survives" (§8.1): a special, a shot, a reflected line or
  // an item's bolt, from an exhibit or from you, splits it as your blow does, and the half's
  // story names whoever hit it.
  const HITS = ['special', 'shot', 'reflected', 'item'];
  const hit = (k, a, by) => ({
    special: { k, by: by.uid, sp: 'line', gross: 4, pad: 0, net: 4, x: a.x, y: a.y, from: [by.x, by.y] },
    shot: { k, by: by.uid, at: a.uid, chance: 75, roll: 10, raw: 4, pad: 0, how: { kind: 'shot' }, from: [a.x + 1, a.y], range: 3 },
    reflected: { k, by: by.uid, shooter: 'you', raw: 4, pad: 0, from: [a.x + 1, a.y] },
    item: { k, by: 'you', at: a.uid, chance: 75, roll: 10, raw: 4, pad: 0, how: { kind: 'shot' }, from: [a.x - 1, a.y], range: 2, item: 'you.i' },
  })[k];
  test('splitter: any hit it survives splits it, a special, a shot, a reflected line or an item, from an exhibit or from you; the half\'s story names who hit it', () => {
    const sp = Packs.speciesFor(null, { sp: 'A4.4' }), other = Packs.speciesFor(null, { sp: 'A4.1' });
    for (const k of HITS) {
      const s = Setup.room(1, { acc: 'T0', depth: 2, map: ROOM, you: [1, 1], exhibits: [
        { sp: 'A4.4', at: [5, 3], mode: 'hunting', stats: Roles.stats(sp.role, 2), hp: 20 },
        { sp: 'A4.1', at: [8, 5], mode: 'hunting', stats: Roles.stats(other.role, 2) }] });
      const [, a, by] = s.actors, cause = hit(k, a, by), ev = [];
      const names = { you: null, [a.uid]: 'the Bust of the Proposing Trustee', [by.uid]: 'the Seated Clerk of the Ordinance Office' };
      Combat.hurt(s, a, 4, cause, ev);
      const h = s.actors[3], made = ev.find(isHalf);
      assert.ok(h && made && made.who === h.uid, `${cause.k}: it did not split`);
      assert.equal(json([a.hp, h.hp, h.gen, made.cause.by]), json([8, 8, 1, cause.by]), cause.k);
      for (const e of ev) assert.equal(Causes.check(e), null, json(e));
      const said = Text.event(made, uid => names[uid]);
      assert.equal(said, cause.by === 'you' ? 'The Bust of the Proposing Trustee splits in two, under your hit; the new half is hunting you.'
        : 'The Bust of the Proposing Trustee splits in two, hit by the Seated Clerk of the Ordinance Office; the new half is hunting you.', cause.k);
    }
  });

  test('splitter: the half takes the first free tile beside it in direction order, past walls, you, corners and closed doors; with none, no split', () => {
    const map = ['#######', '#.....#', '#.#+..#', '#.....#', '#######'];
    // At (2,1): N and NE are walls, E is you, SE and SW cut a corner (the wall at (2,2)), S is a wall: W.
    const { s, a } = one('A4.4', 20, map, [2, 1]);
    s.actors[0].x = 3; s.actors[0].y = 1;
    blow(s, a, 1, []);
    assert.equal(json([s.actors[2].x, s.actors[2].y]), json([1, 1]));
    // At (3,3): N is a closed door, so NE.
    const { s: d, a: b } = one('A4.4', 20, map, [3, 3]);
    blow(d, b, 1, []);
    assert.equal(json([d.actors[2].x, d.actors[2].y]), json([4, 2]));
    // In the nook, with you beside it, there is no tile at all.
    const { s: n, a: c } = one('A4.4', 20, NOOK, [1, 1]);
    n.actors[0].x = 2; n.actors[0].y = 1;
    blow(n, c, 1, []);
    assert.equal(json([c.hp, c.gen, c.kids, n.actors.length]), json([19, 0, 0, 2]));
  });

  test('splitter: a half split from a plaster cast keeps the cast\'s health, and crumbles to dust of its own when destroyed', () => {
    const sp = Packs.speciesFor(null, { sp: 'A4.4a' });
    const s = Setup.room(1, { acc: 'T0', depth: 3, map: ROOM, you: [1, 1], exhibits: [{ sp: 'A4.4a', at: [5, 3], mode: 'hunting', stats: Roles.stats(sp.role, 3) }] });
    const a = s.actors[1], max = a.maxHp, ev = [];
    assert.equal(max, Math.max(1, Int.pct(Roles.stats(sp.role, 3).hp, N.PLASTER_HP_PCT)));
    blow(s, a, 2, ev);
    const h = s.actors[2];
    assert.equal(json([h.maxHp, h.mods]), json([max, ['plaster']]));
    blow(s, h, h.hp, ev);
    assert.equal(json(s.dept.surfaces.map(x => [x.kind, x.x, x.y, x.size, x.by])), json([['dust', h.x, h.y, N.PLASTER_DUST_SIZE, h.uid]]));
  });

  test('splitter: with its archetype\'s split taken away, the split scenario fails, and so does its invariant', () => {
    const X = loadCore();
    X.Archetypes.onDamaged = () => {};
    const T = scenarios(X), sp = list[0].sp;
    const fails = H.DEPTHS.map(d => H.run(X, T.splits, sp, d, { inv: [] }).failure);
    assert.ok(fails.every(f => f && /did not split/.test(f)), fails.join(' | '));
    const r = H.run(X, T.splits, sp, 4, { inv: Inv.select(X, ['splitter_splits']) });
    assert.match(r.failure || '', /^splitter_splits: a hit at tick \d+ left it \d+ health at generation 0, and it did not split, though \d+,\d+ beside it was free/);
  });

  test('splitter: a split that loses or makes health, or goes past SPLIT_MAX, breaks the invariant', () => {
    const run = plant => {
      const X = loadCore(), real = X.Archetypes.onDamaged;
      X.Archetypes.onDamaged = (state, a, amount, cause, ev) => { const n = state.actors.length; real(state, a, amount, cause, ev); if (state.actors.length > n) plant(state, a, state.actors[n]); };
      return H.run(X, scenarios(X).splits, list[0].sp, 5, { inv: Inv.select(X, ['splitter_splits']) }).failure || '';
    };
    assert.match(run((s, a, h) => { h.hp += 1; }), /^splitter_splits: its half \S+ has \d+ health; half of \d+ is \d+/);
    assert.match(run((s, a, h) => { a.hp += 1; }), /^splitter_splits: kept \d+ health after splitting/);
    assert.match(run((s, a, h) => { a.gen = 0; h.gen = 0; }), /generation/);
    // A half that is not the same exhibit: weaker blows, another group, or one that has not seen you.
    assert.match(run((s, a, h) => { h.dmin = 1; h.dmax = 1; }), /^splitter_splits: its half \S+ has dmin 1; the body it came from has \d+/);
    // The body keeps its species' group (A.4's busts are 'trustees'; a species with none has null).
    const group = json(list[0].sp.group || null).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.notEqual(list[0].sp.group, 'other');
    assert.match(run((s, a, h) => { h.group = 'other'; }), new RegExp(`^splitter_splits: its half \\S+ has group "other"; the body it came from has ${group} `));
    assert.match(run((s, a, h) => { h.sawYou = false; }), /^splitter_splits: its half \S+ has not seen you, though the body it came from had/);
  });
};
