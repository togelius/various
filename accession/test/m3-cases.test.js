// M3's cases, glass, locks and staff doors (BUILD.md §8.3; §4.2's open and bash; §8.2's one
// action's wake order and staff doors in movement): what each glass takes to break, swings,
// opening, the touch, breaking and releasing, shards, Solvent's dissolving, the mimic's case,
// staff doors, paths, the view model's and the labels' data, and legal ⇔ step. The expected
// figures are worked out here from BUILD.md's text, never from the rule code. Every scenario
// is replayed with a clone after every step (§3.5).
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const json = x => JSON.stringify(x);
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  // §8.3's table, written out again: bashes to break, and the lock range.
  const BASHES = { 1: 1, 2: 2, 3: 3 }, LOCKS = { 1: [1, 2], 2: [2, 4], 3: [4, 7] };
  // A room for tests: you at `you`, with exhibits, fixtures, a kit and a grade; you cannot die.
  function room(X, map, you, o) {
    o = o || {};
    const s = X.Setup.room(o.seed || 1, { acc: 'T0', depth: o.depth || 1, map, you, exhibits: o.exhibits || [], fixtures: o.fixtures || [],
      kit: o.kit, grade: o.grade, items: o.items }, o.options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  }
  const kase = (X, x, y, extra) => X.Cases.make(Object.assign({ x, y, room: 'room', num: `T.0.101.${x}${y}`, glass: 1, lock: 1 }, extra));
  const sleeper = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'dormant', stats: tough }, extra);
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|null/.test(s);
  // Every event passes its schema and has a clean sentence.
  function checked(X, ev) {
    for (const e of ev) {
      const bad = X.Causes.check(e);
      assert.equal(bad, null, `${bad}: ${json(e)}`);
      const line = X.Text.event(e);
      assert.ok(clean(line), `${e.k}${e.cause ? '.' + e.cause.k : ''}: ${line}`);
    }
    return ev;
  }
  // One step, checked.
  const step = (X, s, action) => checked(X, X.Step.step(s, action));
  // Play a list with every case invariant checked and a clone after every step (§3.5).
  function played(X, s, actions) {
    const p = H.play(X, s, actions, { inv: ['cases'], clone: true });
    assert.equal(json(p.violations.map(v => v.text)), '[]');
    checked(X, p.events);
    return p;
  }
  const kinds = ev => ev.filter(e => !['moved', 'attacked', 'waited', 'regenerated'].includes(e.k)).map(e => e.k + (e.cause && e.cause.k ? '.' + e.cause.k : ''));
  // Hearing as §8.2 states it and W1-WAKE-A builds it (a stub here): a sleeper that hears a
  // noise gains a pip, and the third wakes it awake, to look.
  function hearing(X) {
    X.Wake.hear = (state, a, noise, dist, ev) => { if (a.mode === 'dormant') X.Wake.addPips(state, a, 1, { k: 'noise', by: noise.by, dist, cls: noise.cls }, ev, { target: [noise.x, noise.y] }); };
    return X;
  }
  // A core in which only the case can add a pip: hearing (Wake.hear, W1-WAKE-A's) and the
  // boundary's wake checks (the ring, axis and tether) do nothing. A test that asserts who
  // the touch or a release leaves asleep runs here, so that what it asserts is the case's
  // rule alone, whatever hearing and the ring become; the same steps in the plain core are
  // asserted only on what belongs to the case.
  function still(X) {
    X.Wake.hear = () => {};
    X.Wake.boundary = () => {};
    return X;
  }
  // The events of ev about the exhibit a whose cause is one of the case's.
  const byCase = (ev, a) => ev.filter(e => (e.who === a.uid) && e.cause && ['touch_case', 'case_broken', 'dissolved'].includes(e.cause.k));
  // A map with a case south of you: you at (3,1), the case at (3,2).
  const SOUTH = ['#######', '#.....#', '#..v..#', '#.....#', '#######'];
  const count = (s, ch) => s.dept.tiles.join('').split(ch).length - 1;
  const FLOOR = ['#######', '#.....#', '#.....#', '#.....#', '#######'];

  test('Plate breaks at the 1st bash, Laminated at the 2nd and Security at the 3rd; each bash costs 100 and is loud, the breaking one a crash', () => {
    for (const g of [1, 2, 3]) {
      const s = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2, { glass: g })], grade: 7 });
      const f = C.Cases.at(s, 3, 2);
      const p = played(C, s, Array.from({ length: BASHES[g] }, () => ({ a: 'bash', x: 3, y: 2 })));
      p.steps.forEach((st, i) => {
        const ev = st.events, last = i === BASHES[g] - 1;
        const glassEv = ev.find(e => e.k === (last ? 'glass_broke' : 'glass_cracked')), noise = ev.find(e => e.k === 'noise');
        assert.ok(glassEv && noise && ev.indexOf(glassEv) < ev.indexOf(noise), `glass ${g}, bash ${i + 1}: ${json(kinds(ev))}`);
        assert.equal(json([noise.x, noise.y, noise.cls, noise.range, noise.cause.k]), json([3, 2, last ? 'crash' : 'loud', last ? 10 : 6, last ? 'glass_broke' : 'bash']));
        if (!last) assert.equal(json([glassEv.hits, glassEv.need, glassEv.glass, glassEv.cause.count, glassEv.cause.form]), json([i + 1, BASHES[g], g, 1, 'balanced']));
        else assert.equal(json([glassEv.cause.hits, glassEv.cause.need, glassEv.glass]), json([BASHES[g], BASHES[g], g]));
      });
      assert.equal(json([f.st, f.hits, s.dept.tiles[2][3], s.actors[0].next]), json(['broken', BASHES[g], 'k', 100 * BASHES[g]]), `glass ${g}`);
      assert.equal(step(C, s, { a: 'bash', x: 3, y: 2 })[0].reason, 'no_case', 'a broken case is no case to bash');
      assert.ok(C.Grid.walkable(s.dept, 3, 2) && C.Grid.TILES.k.loud, 'a broken case is passable and loud');
    }
  });

  // The three glasses of §8.3, in order: a case's glass n is the GLASS entry with that n,
  // which names it on its label and in its sentences, with its bashes from §8.10.
  test('the glasses are plate (1), laminated (2) and security (3), each named on its case\'s label and taking its GLASS_BASHES', () => {
    assert.equal(json(C.Registry.order('GLASS')), json(['plate', 'laminated', 'security']));
    ['plate', 'laminated', 'security'].forEach((id, i) => {
      const g = C.Registry.GLASS[id], s = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2, { glass: i + 1 })], grade: 7 });
      assert.equal(json([g.n, g.name]), json([i + 1, ['Plate', 'Laminated', 'Security'][i]]), id);
      assert.equal(C.Cases.describe(s, C.Cases.at(s, 3, 2)).glassName, g.name, `${id} names its case`);
      assert.equal(BASHES[i + 1], C.N.GLASS_BASHES[i], `${id} takes GLASS_BASHES[${i}]`);
    });
  });

  test('a Heavy swing counts two bashes and costs 150; breaker adds one more; a Light weapon cannot break Laminated or Security glass, breaker or not', () => {
    // swings(form, breaker, glass): §8.3 and §8.5 written out: 1 a swing, 2 with a Heavy
    // weapon, +1 with breaker; the glass breaks at its count of bashes.
    const perSwing = (form, br) => 1 + (form === 'heavy' ? 1 : 0) + (br ? 1 : 0);
    let checkedN = 0;
    for (const form of ['light', 'balanced', 'heavy', 'reach']) for (const br of [false, true]) for (const g of [1, 2, 3]) {
      const s = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2, { glass: g })], grade: 7, kit: { weapon: { form } } });
      const f = C.Cases.at(s, 3, 2), you = s.actors[0];
      const go = () => { you.breaker = br ? 1 : 0; return step(C, s, { a: 'bash', x: 3, y: 2 }); };
      if (form === 'light' && g > 1) {
        const h = C.State.canon(s);
        you.breaker = br ? 1 : 0;
        const legal = C.Step.legal(s).some(a => a.a === 'bash');
        const ev = go();
        assert.equal(json([ev.length, ev[0].reason, legal]), json([1, 'glass_too_strong', false]), `light, breaker ${br}, glass ${g}`);
        you.breaker = 0;
        assert.equal(C.State.canon(s), h, 'refused before anything is spent');
        continue;
      }
      const swings = Math.ceil(BASHES[g] / perSwing(form, br)), cost = form === 'heavy' ? 150 : 100;
      let n = 0, t0 = you.next;
      while (f.st === 'shut' && n < 9) {
        const ev = go(); n++;
        const e = ev.find(q => q.k === 'glass_cracked' || q.k === 'glass_broke');
        assert.equal(e.cause.count, perSwing(form, br), `${form} breaker ${br}`);
        assert.equal(you.next - t0, cost * n, `${form}: a swing costs ${cost}`);
      }
      assert.equal(n, swings, `${form}, breaker ${br}, glass ${g}: ${swings} swing(s)`);
      assert.equal(f.hits, BASHES[g], 'hits stop at what the glass takes');
      checkedN++;
    }
    assert.equal(checkedN, 4 * 2 * 3 - 4);
    assert.equal(json([C.Cases.swing({ weaponForm: 'heavy', breaker: 1 }), C.Cases.swing({ weaponForm: 'light', breaker: 0 })]), json([3, 1]));
  });

  test('opening at your grade costs 200 ticks, leaves the case open (u) with no shards, and makes a soft noise from the case tile: 3 walking tiles, 3 more through a closed door', () => {
    const X = loadCore(), heard = [];
    X.Wake.hear = (state, a, noise, dist) => heard.push(`${a.x},${a.y}:${dist}`);
    // Open floor: the sleeper 3 tiles from the case hears it, the one 4 tiles away does not.
    const s = room(X, ['#########', '#.v.....#', '#.......#', '#########'], [1, 1], { fixtures: [kase(X, 2, 1, { lock: 2, glass: 2 })], grade: 2,
      exhibits: [sleeper([5, 1]), sleeper([6, 1])] });
    const ev = step(X, s, { a: 'open', x: 2, y: 1 });
    assert.equal(json(heard), json(['5,1:3']));
    const opened = ev.find(e => e.k === 'case_opened'), noise = ev.find(e => e.k === 'noise');
    assert.equal(json([opened.by, opened.x, opened.y, opened.glass, opened.lock, opened.cause]), json(['you', 2, 1, 2, 2, { k: 'grade', grade: 2, lock: 2 }]));
    assert.equal(json([noise.x, noise.y, noise.cls, noise.range, noise.cause.k]), json([2, 1, 'soft', 3, 'case_opened']));
    assert.ok(ev.indexOf(opened) < ev.indexOf(noise), 'the noise comes last');
    assert.equal(json([s.dept.tiles[1][2], X.Cases.at(s, 2, 1).st, s.actors[0].next, count(s, 'x')]), json(['u', 'open', 200, 0]));
    assert.ok(X.Grid.walkable(s.dept, 2, 1) && X.Grid.walkable(s.dept, 2, 1, 'exhibit') && !X.Grid.TILES.u.loud, 'an opened case is passable, and not loud');
    // The same, replayed with a clone after every step, in the plain core, and then walked through.
    const r = room(C, ['#########', '#.v.....#', '#.......#', '#########'], [1, 1], { fixtures: [kase(C, 2, 1, { lock: 2, glass: 2 })], grade: 2, exhibits: [sleeper([5, 1]), sleeper([6, 1])] });
    played(C, r, [{ a: 'open', x: 2, y: 1 }, { a: 'move', dir: 2 }, { a: 'move', dir: 2 }]);
    assert.equal(json([r.actors[0].x, r.actors[0].y]), json([3, 1]), 'you walked over the opened case');
    // A closed door between: the sleeper 3 tiles along the corridor, beyond the door, does
    // not hear (the door counts 3 more); with the door open it does.
    for (const door of ['+', "'"]) {
      heard.length = 0;
      const t = room(X, ['#########', `#.v.${door}...#`, '#########'], [1, 1], { fixtures: [kase(X, 2, 1)], exhibits: [sleeper([5, 1])] });
      step(X, t, { a: 'open', x: 2, y: 1 });
      assert.equal(json(heard), door === '+' ? '[]' : json(['5,1:3']), `door ${door}`);
    }
  });

  test('a lock above your grade is refused before anything is spent, and every refusal of a case or a staff door leaves the state and its streams as they were', () => {
    const MAP = ['#########', '#.......#', '#.v.v.v.#', '#.......#', '#vv.....#', '#..S....#', '#########'];
    const make = (o) => room(C, MAP, o.you || [4, 1], { grade: o.grade || 1, kit: o.kit, fixtures: [
      kase(C, 2, 2, { lock: 3 }), kase(C, 4, 2, { glass: 2 }), kase(C, 6, 2, { st: 'open' }), kase(C, 1, 4), { k: 'staff', x: 3, y: 5, grade: 4 }] });
    // Lock III against grade II, then III.
    const lockAt = (grade) => { const s = make({ grade, you: [2, 1] }); return step(C, s, { a: 'open', x: 2, y: 2 }); };
    assert.equal(lockAt(2)[0].reason, 'case_locked');
    assert.ok(lockAt(3).some(e => e.k === 'case_opened'), 'at your grade it opens');
    const cases = [
      ['no_case', {}, { a: 'open', x: 5, y: 1 }],              // nothing there
      ['no_case', { you: [2, 3] }, { a: 'open', x: 2, y: 4 }], // fixed glazing: a vitrine with no case
      ['no_case', { you: [6, 1] }, { a: 'open', x: 6, y: 2 }], // a case already open (its fixture says so, its tile does not)
      ['no_case', {}, { a: 'bash' }],
      ['no_case', {}, { a: 'open', x: 4, y: 1 }],              // your own tile
      ['out_of_reach', { you: [4, 1] }, { a: 'open', x: 2, y: 2 }],
      ['corner', { you: [2, 3] }, { a: 'bash', x: 1, y: 4 }],  // past the vitrine at (2,4)
      ['case_locked', { you: [2, 1] }, { a: 'open', x: 2, y: 2 }],
      ['glass_too_strong', { kit: { weapon: { form: 'light' } } }, { a: 'bash', x: 4, y: 2 }],
      ['staff_grade', { you: [3, 4], grade: 3 }, { a: 'move', dir: 4 }],
      ['behind_glass', {}, { a: 'move', dir: 4 }],
    ];
    const seen = new Set();
    for (const [code, o, action] of cases) {
      const s = make(o);
      const before = C.State.canon(s), ev = C.Step.step(s, action);
      assert.equal(json([ev.length, ev[0].k, ev[0].reason]), json([1, 'refused', code]), `${code}: ${json(action)} → ${json(ev)}`);
      assert.equal(C.State.canon(s), before, `${code}: the state and its streams are as they were`);
      const line = C.Text.event(ev[0]);
      assert.ok(clean(line) && /\.$/.test(line) && line !== code, `${code}: ${line}`);
      seen.add(code);
    }
    assert.equal(seen.size, 7);
    // A refusal's sentence never offers what the rules would then refuse: for every weapon and
    // glass, the case refused to open for its lock is offered for breaking only where a bash
    // of it is allowed (a Light weapon cannot break Laminated or Security glass).
    for (const form of ['light', 'balanced', 'heavy']) for (const g of [1, 2, 3]) {
      const s = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2, { glass: g, lock: 4 })], grade: 1, kit: { weapon: { form } } });
      const ev = C.Step.step(s, { a: 'open', x: 3, y: 2 }), line = C.Text.event(ev[0]);
      const bash = C.Step.step(C.State.clone(s), { a: 'bash', x: 3, y: 2 }), allowed = bash[0].k !== 'refused';
      assert.equal(json([ev[0].reason, allowed]), json(['case_locked', !(form === 'light' && g > 1)]), `${form}, glass ${g}`);
      if (/break|bash|smash/i.test(line)) assert.ok(allowed, `${form}, glass ${g}: "${line}", but the bash is refused (${bash[0].reason}: ${C.Text.event(bash[0])})`);
    }
  });

  test('breaking leaves the case broken (k) and shards on one floor tile on your side: your tile if floor or archway, else its first such neighbour in direction order; the ring is 2 larger on both', () => {
    // Your tile is floor: the shards fall there.
    const s = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2)] });
    const ev = step(C, s, { a: 'bash', x: 3, y: 2 }), broke = ev.find(e => e.k === 'glass_broke');
    assert.equal(json([s.dept.tiles[2][3], s.dept.tiles[1][3], count(s, 'x'), broke.shards]), json(['k', 'x', 1, [[3, 1]]]));
    // Your ring (§8.2): 3 after an action that moved or acted, +2 on a loud floor (shards, a broken case).
    assert.equal(C.Vision.ringRadius(s), 3 + 2, 'on shards');
    step(C, s, { a: 'move', dir: 4 });
    assert.equal(json([s.actors[0].x, s.actors[0].y, C.Vision.ringRadius(s)]), json([3, 2, 3 + 2]), 'on the broken case');
    step(C, s, { a: 'move', dir: 4 });
    assert.equal(C.Vision.ringRadius(s), 3, 'off it again');
    // Your tile is an open door: the shards go to its first floor or archway neighbour in
    // direction order (N, NE, E, SE, S, SW, W, NW), here E, though SE is floor too.
    const t = room(C, ['#######', "###'..#", '#..v..#', '#.....#', '#######'], [3, 1], { fixtures: [kase(C, 3, 2)] });
    const shards = step(C, t, { a: 'bash', x: 3, y: 2 }).find(e => e.k === 'glass_broke').shards;
    assert.equal(json([shards, t.dept.tiles[1][3], t.dept.tiles[1][4]]), json([[[4, 1]], "'", 'x']));
    // An archway takes shards; a doorway with no floor round it leaves none.
    const u = room(C, ['#######', '##,####', '##v####', '#######'], [2, 1], { fixtures: [kase(C, 2, 2)] });
    assert.equal(json(step(C, u, { a: 'bash', x: 2, y: 2 }).find(e => e.k === 'glass_broke').shards), json([[2, 1]]));
    const w = room(C, ['#######', "##'####", '##v####', '#######'], [2, 1], { fixtures: [kase(C, 2, 2)] });
    assert.equal(json(step(C, w, { a: 'bash', x: 2, y: 2 }).find(e => e.k === 'glass_broke').shards), '[]');
    // spreadShards gives exactly what the shard rule gives for one tile.
    for (const [x, y] of [[1, 1], [3, 1], [4, 1], [2, 3]]) {
      const r = room(C, ['#######', "#.'.,.#", '#..v..#', '#.b...#', '#######'], [3, 1], { fixtures: [kase(C, 3, 2)] });
      const want = C.Cases.shardTile(r, x, y);
      assert.equal(json(C.Cases.spreadShards(r, C.Cases.at(r, 3, 2), [x, y])), json(want ? [want] : []), `${x},${y}`);
    }
  });

  test('the breaking bash releases what stood in the case, homeless and hunting, before its crash; an opened case keeps its exhibit\'s home', () => {
    const s = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2)], exhibits: [sleeper([3, 2])] });
    const a = s.actors[1];
    const ev = played(C, s, [{ a: 'bash', x: 3, y: 2 }]).events;
    assert.equal(json([a.mode, a.home, a.woke.cause.k, a.hunted.cause.k]), json(['hunting', null, 'case_broken', 'case_broken']));
    assert.equal(json(ev.find(e => e.k === 'woke' && e.who === a.uid).cause), json({ k: 'case_broken', by: 'you', x: 3, y: 2 }));
    assert.equal(ev.find(e => e.k === 'glass_broke').released, a.uid);
    const order = kinds(ev);
    assert.ok(order.indexOf('hunting.case_broken') < order.indexOf('glass_broke.bash') && order.indexOf('glass_broke.bash') < order.indexOf('noise.glass_broke'), json(order));
    // An exhibit already awake in the case turns to the hunt, and loses its home too.
    const t = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2)], exhibits: [sleeper([3, 2], { mode: 'awake' })] });
    played(C, t, [{ a: 'bash', x: 3, y: 2 }]);
    assert.equal(json([t.actors[1].mode, t.actors[1].home, t.actors[1].hunted.cause.k]), json(['hunting', null, 'case_broken']));
    // Opened: the exhibit in it keeps its home, and may now step out (the tile is u). With no
    // trigger the open does not wake it: where only the case can add a pip it sleeps on; in
    // the plain core hearing and the ring may wake it, but never the case, and its home stays.
    const Q = still(loadCore());
    const o = room(Q, SOUTH, [3, 1], { fixtures: [kase(Q, 3, 2)], exhibits: [sleeper([3, 2])] });
    played(Q, o, [{ a: 'open', x: 3, y: 2 }]);
    assert.equal(json([o.actors[1].mode, o.actors[1].home]), json(['dormant', [3, 2]]), 'no trigger: the open does not wake it, and its home stays');
    assert.ok([0, 1, 2, 3, 4, 5, 6, 7].some(d => C.Grid.canStep(o.dept, 3, 2, d, 'exhibit')), 'it can step out of an opened case');
    const po = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2)], exhibits: [sleeper([3, 2])] });
    const pv = played(C, po, [{ a: 'open', x: 3, y: 2 }]).events;
    assert.equal(json([po.actors[1].home, byCase(pv, po.actors[1]).map(e => e.k)]), json([[3, 2], []]), 'in the plain core too: its home stays, and nothing of the case\'s woke it');
    // An exhibit whose home the case was, standing elsewhere, loses that home when the case
    // breaks or dissolves; the release frees and wakes only what stood inside, so a sleeper
    // homed there sleeps on, and an awake one is not turned to the hunt by it. (It stands
    // beyond a wall, out of your sight, so that nothing else turns it either.)
    const APART = ['#########', '#...#...#', '#..v#...#', '#...#...#', '#########'];
    const cause = { k: 'solvent', by: 'you', item: 'T0.1.room.i1' };
    for (const how of ['bash', 'dissolve']) for (const Y of [still(loadCore()), C]) for (const mode of ['dormant', 'awake']) {
      const h = room(Y, APART, [3, 1], { fixtures: [kase(Y, 3, 2)], exhibits: [sleeper([6, 2], { home: [3, 2], mode })] });
      const e = h.actors[1], f = Y.Cases.at(h, 3, 2);
      let ev = [];
      if (how === 'bash') ev = played(Y, h, [{ a: 'bash', x: 3, y: 2 }]).events;
      else { assert.equal(Y.Cases.dissolve(h, f, cause, ev), true); checked(Y, ev); }
      const where = `${how}, ${mode}, ${Y === C ? 'plain' : 'still'} core`;
      assert.equal(json([f.st, e.home, ev.find(q => q.k === 'glass_broke').released]), json([how === 'bash' ? 'broken' : 'dissolved', null, null]), `${where}: its home is gone, and nothing stood inside`);
      assert.equal(json(byCase(ev, e).map(q => q.k)), '[]', `${where}: the release does not wake it or turn it`);
      if (Y !== C) assert.equal(e.mode, mode, `${where}: its mode is as it was`);
    }
  });

  test('one action\'s wake order: a 2-pip sleeper whose trigger is touch_case wakes hunting when its case is opened, bashed or broken; without the trigger the noise wakes it awake, but the breaking bash still frees it hunting', () => {
    const X = hearing(loadCore());
    const run = (trigger, glass, action) => {
      const s = room(X, SOUTH, [3, 1], { fixtures: [kase(X, 3, 2, { glass })], exhibits: [sleeper([3, 2], { trigger, pips: 2 })] });
      const ev = played(X, s, [action]).events;
      return { a: s.actors[1], ev };
    };
    for (const [glass, action, how] of [[2, { a: 'open', x: 3, y: 2 }, 'opened'], [2, { a: 'bash', x: 3, y: 2 }, 'bashed'], [1, { a: 'bash', x: 3, y: 2 }, 'bashed']]) {
      const { a, ev } = run('touch_case', glass, action);
      assert.equal(json([ev.find(e => e.k === 'woke' && e.who === a.uid).mode, a.mode, a.woke.cause.k, a.woke.cause.how]), json(['hunting', 'hunting', 'touch_case', how]), `${action.a} glass ${glass}`);
      const order = kinds(ev);
      assert.ok(order.indexOf('pip.touch_case') >= 0 && order.indexOf('hunting.touch_case') < order.findIndex(k => k.startsWith('noise.')), json(order));
      assert.ok(!ev.some(e => e.k === 'alerted' || (e.k === 'pip' && e.cause.k === 'noise')), 'the noise found it awake already');
      if (glass === 1) assert.equal(a.home, null, 'and the break leaves it homeless');
      // Without the trigger: the noise gives the third pip, and it wakes awake to look; the
      // breaking bash frees it first, hunting.
      const n = run(null, glass, action);
      const woke = n.ev.find(e => e.k === 'woke' && e.who === n.a.uid);
      if (glass === 1) assert.equal(json([woke.mode, n.a.woke.cause.k]), json(['hunting', 'case_broken']));
      else assert.equal(json([woke.mode, n.a.woke.cause.k]), json(['awake', 'noise']), `${action.a} without the trigger`);
    }
  });

  test('only exhibits in the case or at home in it are touched; only those with touch_case gain pips; each is told (onTouched) how and by whom', () => {
    const MAP = ['#########', '#.......#', '#..v.v..#', '#.......#', '#########'];
    const spec = X => ({ fixtures: [kase(X, 3, 2), kase(X, 5, 2)],
      exhibits: [sleeper([3, 2], { trigger: 'touch_case' }), sleeper([5, 2], { trigger: 'touch_case' }), sleeper([3, 3], { trigger: 'touch_case', home: [3, 2] }), sleeper([1, 3])] });
    // Where only the case can add a pip (still), the exhibits the open does not touch sleep
    // on. In the plain core hearing and the ring may wake them too; what is asserted there is
    // the touch's alone: it reaches the two it touches, which wake by it, hunting, and no other.
    for (const [X, quiet] of [[still(loadCore()), true], [loadCore(), false]]) {
      const told = [], where = quiet ? 'still core' : 'plain core';
      X.Archetypes.onTouched = (state, a, how, by) => told.push(`${a.uid}:${how}:${by}`);
      const s = room(X, MAP, [4, 1], spec(X));
      const [, inIt, other, homed, plain] = s.actors;
      const ev = step(X, s, { a: 'open', x: 3, y: 2 });
      if (quiet) assert.equal(json([inIt.mode, other.mode, homed.mode, plain.mode]), json(['hunting', 'dormant', 'hunting', 'dormant']));
      assert.equal(json([inIt, homed].map(a => [a.mode, a.woke.cause.k, a.woke.cause.how])), json([['hunting', 'touch_case', 'opened'], ['hunting', 'touch_case', 'opened']]), where);
      assert.equal(json([other, plain].map(a => byCase(ev, a).length)), '[0,0]', `${where}: the touch reaches no one else`);
      assert.equal(json(told), json([`${inIt.uid}:opened:you`, `${homed.uid}:opened:you`]), where);
      assert.equal(json(ev.filter(e => e.k === 'pip' && e.cause.k === 'touch_case').map(e => [e.who, e.pips, e.delta, e.cause.k])), json([[inIt.uid, 3, 3, 'touch_case'], [homed.uid, 3, 3, 'touch_case']]), `${where}: it wakes at once: 3 pips`);
    }
    // A sleeper in the case with no trigger is told, and gains nothing from the touch.
    const X = loadCore(), told = [];
    X.Archetypes.onTouched = (state, a, how, by) => told.push(`${a.uid}:${how}:${by}`);
    const t = room(X, SOUTH, [3, 1], { fixtures: [kase(X, 3, 2)], exhibits: [sleeper([3, 2])] });
    const tv = [...step(X, t, { a: 'bash', x: 3, y: 2 }), ...step(X, t, { a: 'wait' })];
    assert.equal(json(told), json([`${t.actors[1].uid}:bashed:you`]));
    assert.ok(!tv.some(e => e.k === 'pip' && e.cause.k === 'touch_case'));
    // Replayed with a clone after every step and the case invariants: the open wakes the two
    // it touches by the touch, and the bash of the other case its own exhibit, which is woken
    // by that touch where only the case can wake it, and in the plain core is hunting at the
    // end in any case (the bash breaks the Plate glass and frees it).
    for (const [Y, quiet] of [[still(loadCore()), true], [C, false]]) {
      const r = room(Y, MAP, [4, 1], spec(Y));
      played(Y, r, [{ a: 'open', x: 3, y: 2 }, { a: 'bash', x: 5, y: 2 }, { a: 'wait' }]);
      const [inIt, other, homed] = r.actors.slice(1, 4);
      assert.equal(json([inIt.woke.cause.k, homed.woke.cause.k, other.mode]), json(['touch_case', 'touch_case', 'hunting']));
      if (quiet) assert.equal(other.woke.cause.k, 'touch_case');
    }
  });

  test('a mimic\'s case: opening or bashing reveals the mimic and wakes it at once, hunting, with no pips; nothing opens or cracks; the noise still sounds; Solvent reveals it silently, untouched', () => {
    // A core with the mimic as W1-ARCH-C describes it, planted: pipless while disguised, and
    // told when touched; its init makes no disguise, so the test makes it.
    const plant = () => {
      const X = loadCore(), told = [];
      X.Archetypes.init = () => {};
      X.Archetypes.pipless = (state, a) => a.arch === 'mimic_vitrine' && (state.dept.fixtures || []).some(f => f.mimic === a.uid && f.st === 'shut');
      X.Archetypes.onTouched = (state, a, how, by) => told.push(`${a.uid}:${how}:${by}`);
      const s = room(X, FLOOR, [3, 1], { exhibits: [sleeper([3, 2], { arch: 'mimic_vitrine', trigger: 'touch_case' })], grade: 7 });
      const f = X.Cases.disguise(s, s.actors[1]);
      return { X, s, f, a: s.actors[1], told };
    };
    for (const [id, cls, how] of [['open', 'soft', 'opened'], ['bash', 'loud', 'bashed']]) {
      const { X, s, f, a, told } = plant();
      const ev = step(X, s, { a: id, x: 3, y: 2 });
      assert.equal(json(told), json([`${a.uid}:${how}:you`]), `${id}: told once`);
      assert.equal(json([f.st, f.hits, s.dept.tiles[2][3], a.mode]), json(['revealed', 0, '.', 'hunting']), id);
      assert.equal(json(a.woke.cause), json({ k: 'touch_case', by: 'you', x: 3, y: 2, how, itself: true }));
      assert.ok(!ev.some(e => ['pip', 'case_opened', 'glass_cracked', 'glass_broke'].includes(e.k)), json(kinds(ev)));
      const noise = ev.find(e => e.k === 'noise');
      assert.equal(json([noise.cls, noise.x, noise.y]), json([cls, 3, 2]));
      assert.ok(ev.indexOf(ev.find(e => e.k === 'hunting')) < ev.indexOf(noise), 'the wake comes before the noise');
      assert.equal(step(X, s, { a: id, x: 3, y: 2 })[0].reason, 'no_case', 'a revealed mimic is no case');
      // Replayed with a clone after every step and the case invariants.
      const q = plant();
      played(q.X, q.s, [{ a: id, x: 3, y: 2 }, { a: 'wait' }, { a: id, x: 3, y: 2 }]);
      assert.equal(q.a.mode, 'hunting');
    }
    const { X, s, f, a, told } = plant(), ev = [];
    assert.equal(X.Cases.dissolve(s, f, { k: 'solvent', by: 'you', item: 'T0.1.room.i1' }, ev), true);
    checked(X, ev);
    assert.equal(json([told, f.st, s.dept.tiles[2][3], a.mode, a.home, a.woke.cause]), json([[], 'revealed', '.', 'hunting', null, { k: 'dissolved', x: 3, y: 2, by: 'you', itself: true }]));
    assert.equal(json(ev.map(e => e.k)), json(['woke', 'hunting', 'glass_broke']), 'silent: no noise');
    assert.equal(json([ev[2].shards, ev[2].released, ev[2].cause]), json([[], a.uid, { k: 'solvent', by: 'you', item: 'T0.1.room.i1' }]));
    // A case whose mimic is gone (destroyed in its disguise) shows itself floor when touched,
    // and wakes no one.
    const g = plant();
    g.a.gone = 1;
    const gv = step(g.X, g.s, { a: 'open', x: 3, y: 2 });
    assert.equal(json([g.f.st, g.s.dept.tiles[2][3], gv.filter(e => e.k !== 'moved').map(e => e.k)]), json(['revealed', '.', ['noise']]));
  });

  test('Solvent dissolves a case silently: no noise, no shards, no touch; its tile becomes u; what stood in it loses its home and hunts; a case not intact is left alone', () => {
    const X = loadCore(), told = [];
    X.Archetypes.onTouched = (state, a) => told.push(a.uid);
    const s = room(X, SOUTH, [3, 1], { fixtures: [kase(X, 3, 2, { glass: 3, lock: 6 })], exhibits: [sleeper([3, 2], { trigger: 'touch_case' })] });
    const f = X.Cases.at(s, 3, 2), a = s.actors[1], ev = [], cause = { k: 'solvent', by: 'you', item: 'T0.1.room.i1' };
    assert.equal(X.Cases.dissolve(s, f, cause, ev), true);
    checked(X, ev);
    assert.equal(json(ev.map(e => e.k + '.' + e.cause.k)), json(['woke.dissolved', 'hunting.dissolved', 'glass_broke.solvent']));
    assert.equal(json([f.st, s.dept.tiles[2][3], a.mode, a.home, told, ev[2].shards, ev[2].released, ev[2].by]), json(['dissolved', 'u', 'hunting', null, [], [], a.uid, 'you']));
    assert.equal(count(s, 'x'), 0, 'no shards');
    // Again, or on an opened case: nothing.
    const again = [];
    assert.equal(X.Cases.dissolve(s, f, cause, again), false); assert.equal(again.length, 0);
    const o = room(X, SOUTH, [3, 1], { fixtures: [kase(X, 3, 2)] });
    step(X, o, { a: 'open', x: 3, y: 2 });
    assert.equal(X.Cases.dissolve(o, X.Cases.at(o, 3, 2), cause, again), false);
    assert.equal(X.Cases.dissolve(o, null, cause, again), false);
    assert.equal(again.length, 0);
  });

  test('a staff door below your grade is a wall to you and to paths; at your grade it opens for 100 ticks with a soft noise and you stay put; exhibits never pass one', () => {
    const MAP = ['#########', '#...S...#', '#########'];
    const make = grade => room(C, MAP, [3, 1], { grade, fixtures: [{ k: 'staff', x: 4, y: 1, grade: 3 }] });
    const low = make(2);
    assert.ok(!C.Step.legal(low).some(a => a.a === 'move' && a.dir === 2), 'not a legal move');
    assert.equal(step(C, low, { a: 'move', dir: 2 })[0].reason, 'staff_grade');
    assert.equal(json(C.Path.to(low, 6, 1)), '[]', 'no path through it');
    assert.equal(json(C.Path.to(low, 4, 1)), json([[4, 1]]), 'a tap on it walks you up to it, where the bump says why');
    const s = make(3), you = s.actors[0];
    assert.equal(json(C.Path.to(s, 6, 1)), json([[4, 1], [5, 1], [6, 1]]));
    // A board that records no staff door's grade (no fixture list and no run: the shape a
    // policy rebuilds from the view model) never paths through a closed staff door, at any
    // grade, so none of its paths is refused at one; a tap on the door still walks up to it.
    // Given the doors' grades (as the view model's staff list shows them) and your grade, it
    // paths exactly as the state does.
    const board = st => ({ dept: { w: st.dept.w, h: st.dept.h, tiles: st.dept.tiles }, actors: st.actors });
    const told = st => ({ dept: { w: st.dept.w, h: st.dept.h, tiles: st.dept.tiles, fixtures: C.Cases.staffView(st).map(f => ({ k: 'staff', x: f.x, y: f.y, grade: f.grade })) },
      actors: st.actors, run: { grade: st.run.grade } });
    for (const st of [low, s]) {
      assert.equal(json([C.Path.to(board(st), 6, 1), C.Path.to(board(st), 4, 1)]), json([[], [[4, 1]]]), `grade ${st.run.grade}: a board with no grades`);
      assert.equal(json(C.Path.to(told(st), 6, 1)), json(C.Path.to(st, 6, 1)), `grade ${st.run.grade}: a board with the grades`);
      // Every step of a board's path to a floor tile is a move the state allows.
      for (const [tx, ty] of [[6, 1], [5, 1], [1, 1], [7, 1]]) {
        const c = C.State.clone(st);
        for (const q of C.Path.to(board(st), tx, ty)) {
          const dir = C.Path.dirTo([c.actors[0].x, c.actors[0].y], q);
          assert.ok(C.Step.legal(c).some(a => a.a === 'move' && a.dir === dir), `grade ${st.run.grade}, to ${tx},${ty}: the step to ${q} is refused`);
          C.Step.step(c, { a: 'move', dir });
        }
      }
    }
    const ev = played(C, s, [{ a: 'move', dir: 2 }]).events;
    const op = ev.find(e => e.k === 'opened'), noise = ev.find(e => e.k === 'noise');
    assert.equal(json([op.who, op.x, op.y, op.staff, op.grade, op.cause]), json(['you', 4, 1, true, 3, { k: 'staff', by: 'you', grade: 3 }]));
    assert.equal(json([noise.x, noise.y, noise.cls, noise.cause.k]), json([4, 1, 'soft', 'staff_door']));
    assert.equal(json([s.dept.tiles[1][4], you.x, you.y, you.next]), json(['s', 3, 1, 100]));
    played(C, s, [{ a: 'move', dir: 2 }]);
    assert.equal(json([you.x, you.y]), json([4, 1]), 'then you walk through');
    // A staff door with no fixture (only a room built for a test or an arena that was given
    // none has one) opens at any grade when bumped, but no path goes through it while it is
    // shut, since its grade is not recorded; once open, paths go through it.
    const bare = room(C, MAP, [3, 1], {});
    assert.equal(json([C.Path.to(bare, 6, 1), C.Path.to(bare, 4, 1)]), json([[], [[4, 1]]]), 'no path through a bare staff door while it is shut');
    assert.ok(step(C, bare, { a: 'move', dir: 2 }).some(e => e.k === 'opened'));
    assert.equal(json(C.Path.to(bare, 6, 1)), json([[4, 1], [5, 1], [6, 1]]), 'open, it is walked through');
    // Past a corner it is blocked, as any step is.
    const corner = room(C, ['#######', '#.S#..#', '#.....#', '#######'], [3, 2], { fixtures: [{ k: 'staff', x: 2, y: 1, grade: 1 }] });
    assert.equal(step(C, corner, { a: 'move', dir: 7 })[0].reason, 'blocked');
    // An exhibit hunting you from beyond a staff door, open or shut, never crosses it.
    for (const door of ['S', 's']) {
      const t = room(C, [`#########`, `#...${door}...#`, '#########'], [2, 1], { grade: 7, fixtures: [{ k: 'staff', x: 4, y: 1, grade: 1 }],
        exhibits: [{ sp: 'dummy', at: [6, 1], mode: 'hunting', stats: tough }] });
      played(C, t, Array.from({ length: 12 }, () => ({ a: 'wait' })));
      assert.ok(t.actors[1].x > 4, `it stayed beyond the ${door}`);
    }
  });

  test('Step.legal and step() agree on open and bash at every neighbour, for every weapon and grade, and a refused one changes nothing', () => {
    // Round you at (3,3): N a Plate case, lock I; E Laminated; SW Security, lock V (a
    // diagonal past no corner, since W and S are walkable); NW a case past a corner (N is a
    // case); NE fixed glazing; S an opened case; SE a broken one; W floor.
    const MAP = ['#######', '#.....#', '#.vvv.#', '#...v.#', '#.vuk.#', '#.....#', '#######'];
    const fixtures = X => [kase(X, 2, 2), kase(X, 3, 2), kase(X, 4, 3, { glass: 2 }), kase(X, 2, 4, { glass: 3, lock: 5 }),
      kase(X, 3, 4, { st: 'open' }), kase(X, 4, 4, { st: 'broken', hits: 1 })];
    let states = 0, legalSeen = 0;
    const parity = (s, where) => {
      const legal = C.Step.legal(s).filter(a => a.a === 'open' || a.a === 'bash'), keys = new Set(legal.map(json)), base = C.State.canon(s);
      for (const id of ['open', 'bash']) for (const c of C.Actions.get(id).candidates(s)) {
        const t = JSON.parse(base), ev = C.Step.step(t, c), refused = ev.length === 1 && ev[0].k === 'refused';
        assert.equal(!refused, keys.has(json(c)), `${where}: ${json(c)} ${refused ? 'refused (' + ev[0].reason + ')' : 'accepted'}`);
        if (refused) assert.equal(C.State.canon(t), base, `${where}: ${json(c)} refused but changed the state`);
        else checked(C, ev);
      }
      for (const k of keys) assert.ok(C.Actions.get(JSON.parse(k).a).candidates(s).some(c => json(c) === k), `${where}: ${k} is no candidate`);
      states++; legalSeen += legal.length;
      return legal;
    };
    for (const form of ['light', 'balanced', 'heavy']) for (const grade of [1, 4, 5]) {
      const s = room(C, MAP, [3, 3], { fixtures: fixtures(C), grade, kit: { weapon: { form } } });
      const legal = parity(s, `${form} grade ${grade}`).map(json);
      // N always opens and breaks; NW (the corner), NE (glazing), S and SE (no longer
      // intact) and W (floor) never; E opens, and breaks but with a Light weapon; SW opens
      // from grade V, and breaks but with a Light weapon.
      assert.ok(legal.includes(json({ a: 'open', x: 3, y: 2 })) && legal.includes(json({ a: 'bash', x: 3, y: 2 })));
      for (const [x, y] of [[2, 2], [4, 2], [3, 4], [4, 4], [2, 3]]) assert.ok(!legal.some(a => JSON.parse(a).x === x && JSON.parse(a).y === y), `${x},${y}`);
      assert.equal(legal.includes(json({ a: 'open', x: 4, y: 3 })), true);
      assert.equal(legal.includes(json({ a: 'bash', x: 4, y: 3 })), form !== 'light');
      assert.equal(legal.includes(json({ a: 'open', x: 2, y: 4 })), grade >= 5);
      assert.equal(legal.includes(json({ a: 'bash', x: 2, y: 4 })), form !== 'light');
      assert.equal(legal.length, 2 + 1 + (form !== 'light' ? 2 : 0) + (grade >= 5 ? 1 : 0));
    }
    // In departments, beside their cases.
    for (const acc of ['S9', 'A4', 'M11']) {
      const s = C.Dept.create(3, acc, 4);
      const free = (q, k) => C.Grid.ch(s.dept, q.x + C.Grid.DX[k], q.y + C.Grid.DY[k]) === '.' && !C.Actors.at(s, q.x + C.Grid.DX[k], q.y + C.Grid.DY[k]);
      const f = s.dept.fixtures.find(q => q.k === 'case' && [0, 2, 4, 6].some(k => free(q, k)));
      const d = [0, 2, 4, 6].find(k => free(f, k));
      s.actors[0].x = f.x + C.Grid.DX[d]; s.actors[0].y = f.y + C.Grid.DY[d];
      assert.ok(parity(s, acc).length >= 1, `${acc}: something to open or bash`);
    }
    assert.ok(states >= 12 && legalSeen > 40, `${states} states, ${legalSeen} legal`);
  });

  test('the view model\'s cases and the labels\' data: a mimic in its disguise and a real empty case differ only in the accession number', () => {
    const X = loadCore();
    X.Archetypes.init = () => {};
    const MAP = ['#########', '#.......#', '#.......#', '#.......#', '#########'];
    for (let seed = 1; seed <= 30; seed++) {
      const depth = 1 + (seed % 7);
      const s = room(X, MAP, [4, 1], { seed, depth, exhibits: [sleeper([3, 2], { arch: 'mimic_vitrine' })] });
      const m = X.Cases.disguise(s, s.actors[1]);
      // A real empty case with the mimic's glass, lock and loan, beside it.
      s.dept.fixtures.push(kase(X, 5, 2, { room: null, glass: m.glass, lock: m.lock, loan: m.loan }));
      X.Grid.set(s.dept, 5, 2, 'v');
      const v = X.Cases.view(s), real = v.find(c => c.x === 5), mim = v.find(c => c.x === 3);
      const drop = o => { const c = Object.assign({}, o); delete c.x; delete c.y; delete c.num; return json(c); };
      assert.equal(drop(mim), drop(real), `seed ${seed}: view`);
      assert.equal(json([mim.num, typeof real.num]), json([null, 'string']));
      const a = X.Cases.describe(s, m), b = X.Cases.describe(s, X.Cases.at(s, 5, 2));
      assert.equal(drop(a), drop(b), `seed ${seed}: label`);
      assert.ok(a.rules.every(clean) && a.rules.length === 2, json(a.rules));
    }
  });

  // A mimic in its disguise is a case to everything you see (§8.3, D3.10: its case differs
  // from a real one only in having no number): the view model's actors, the strip and the
  // exhibit's label never show it, and no label offers an action that step() refuses, so
  // an exhibit in an intact case gets no Attack button either. Once it shows itself, it is
  // an exhibit like any other. Beside every mimic in the S.9 departments, depths 1–7.
  test('a mimic in its disguise is not an exhibit in the view model, the strip or a label, and no label offers what step() refuses', () => {
    let seen = 0;
    for (let depth = 1; depth <= 7; depth++) for (const seed of [1, 2]) {
      const base = C.Dept.create(seed, 'S9', depth);
      for (const m0 of base.actors.filter(a => a.arch === 'mimic_vitrine' && !a.gone)) {
        const s = C.State.clone(base), m = C.Actors.byUid(s, m0.uid), you = s.actors[0];
        if (C.Archetypes.present(s, m) === null) continue;
        let placed = false;
        for (let d = 0; d < 8 && !placed; d += 2) {
          const x = m.x + C.Grid.DX[d], y = m.y + C.Grid.DY[d];
          if (C.Grid.walkable(s.dept, x, y) && !C.Actors.at(s, x, y)) { you.x = x; you.y = y; placed = true; }
        }
        if (!placed) continue;
        seen++;
        const where = `S9 d${depth} seed ${seed} ${m.uid}`;
        assert.ok(!C.ViewModel.derive(s, {}).actors.some(a => a.uid === m.uid), `${where}: the view model lists it`);
        const strip = C.Labels.strip(s);
        assert.ok(!strip || strip.uid !== m.uid, `${where}: the strip names it: ${json(strip)}`);
        assert.equal(C.Labels.of(s, m.uid), null, `${where}: it has an exhibit's label`);
        // Every label shown offers only what step() allows.
        for (const a of s.actors.slice(1)) {
          const l = C.Labels.of(s, a.uid);
          for (const act of (l && l.actions) || []) if (act.id === 'attack') {
            const ev = C.Step.step(C.State.clone(s), { a: 'attack', uid: a.uid });
            assert.ok(!(ev.length === 1 && ev[0].k === 'refused'), `${where}: ${a.uid}'s label offers Attack, which step() refuses (${ev[0].reason})`);
          }
        }
        // Shown, it is an exhibit: bash its case, and it is in the view model and labelled.
        const t = C.State.clone(s);
        C.Step.step(t, { a: 'bash', x: m.x, y: m.y });
        const shown = C.Actors.byUid(t, m.uid);
        if (shown.mode !== 'dormant') {
          assert.equal(C.Archetypes.present(t, shown), null, where);
          assert.ok(C.ViewModel.derive(t, {}).actors.some(a => a.uid === m.uid), `${where}: shown, it is not in the view model`);
          assert.ok(C.Labels.of(t, m.uid), `${where}: shown, it has no label`);
        }
      }
    }
    assert.ok(seen >= 7, `${seen} mimics stood beside`);
    // An exhibit in an intact case, beside you: no Attack button, since a blow at it is
    // refused (behind_glass).
    const s = room(C, SOUTH, [3, 1], { fixtures: [kase(C, 3, 2)], exhibits: [sleeper([3, 2])] });
    assert.equal(json(C.Labels.of(s, s.actors[1].uid).actions), '[]');
    assert.equal(C.Step.step(C.State.clone(s), { a: 'attack', uid: s.actors[1].uid })[0].reason, 'behind_glass');
  });

  test('the view model\'s cases, staff doors and label data follow your grade and weapon, only on shown tiles', () => {
    const MAP = ['#########', '#.......#', '#.v.v.v.#', '#.......#', '#...S...#', '#########'];
    const items = [{ uid: 'T0.1.room.i1', kind: 'curio', where: { at: 'case', x: 2, y: 2 }, prims: [] }];
    const s = room(C, MAP, [4, 1], { grade: 2, kit: { weapon: { form: 'heavy' } }, items,
      fixtures: [kase(C, 2, 2, { holds: 'T0.1.room.i1', lock: 2 }), kase(C, 4, 2, { glass: 3, lock: 4, hits: 1 }), kase(C, 6, 2, { glass: 2, loan: true }), { k: 'staff', x: 4, y: 4, grade: 3 }] });
    const v = C.Cases.view(s);
    assert.equal(json(v.map(c => [c.x, c.glass, c.need, c.hits, c.lock, c.canOpen, c.canBreak, c.blows, c.loan, c.holds])), json([
      [2, 1, 1, 0, 2, true, true, 1, false, { uid: 'T0.1.room.i1', kind: 'curio', icon: 'curio' }],
      [4, 3, 3, 1, 4, false, true, 1, false, null],          // Security, 1 hit: 2 left, one Heavy swing
      [6, 2, 2, 0, 1, true, true, 1, true, null]]));
    assert.equal(json(C.Cases.view(s, (x, y) => x !== 4).map(c => c.x)), json([2, 6]), 'only shown tiles');
    const vis = new Uint8Array(s.dept.w * s.dept.h); vis[2 * s.dept.w + 6] = 2;
    assert.equal(json(C.Cases.view(s, vis).map(c => c.x)), json([6]));
    assert.equal(json(C.Cases.staffView(s)), json([{ x: 4, y: 4, grade: 3, open: false, canOpen: false }]));
    const d = C.Cases.describe(s, C.Cases.at(s, 2, 2));
    assert.equal(json([d.k, d.num, d.glassName, d.lock, d.canOpen, d.blows, d.rules.length]), json(['case', 'T.0.101.22', 'Plate', 2, true, 1, 2]));
    assert.ok(d.rules.every(clean), json(d.rules));
    assert.ok(/200 ticks/.test(d.rules[0]) && /150 for a Heavy weapon/.test(d.rules[0]) && /Plate glass breaks after 1 bash; in this department its lock is Grade I to Grade II\./.test(d.rules[1]), json(d.rules));
    const st = C.Cases.describe(s, C.Cases.at(s, 4, 4));
    assert.equal(json([st.k, st.grade, st.open, st.canOpen]), json(['staff', 3, false, false]));
    assert.ok(st.rules.every(clean) && /100 ticks/.test(st.rules[0]), json(st.rules));
    assert.equal(C.Cases.describe(s, null), null);
    // Light weapon: no break on Laminated or Security; the breakable one in its swings.
    const l = room(C, MAP, [4, 1], { kit: { weapon: { form: 'light' } }, fixtures: [kase(C, 2, 2, { glass: 2 }), kase(C, 4, 2)] });
    assert.equal(json(C.Cases.view(l).map(c => [c.canBreak, c.blows])), json([[false, null], [true, 1]]));
  });

  test('reach: an item on the floor, or in an opened, broken or dissolved case; a Highlight only in a shut, real, empty case within your entry grade', () => {
    const MAP = ['#########', '#.v.v.v.#', '#.......#', '#########'];
    const s = room(C, MAP, [1, 2], { grade: 3, fixtures: [kase(C, 2, 1, { lock: 3 }), kase(C, 4, 1, { st: 'open' }), kase(C, 6, 1, { st: 'broken', lock: 4 })] });
    const it = (where) => ({ where });
    assert.equal(json([
      C.Cases.reach(s, it({ at: 'floor', x: 1, y: 2 })), C.Cases.reach(s, it({ at: 'case', x: 2, y: 1 })), C.Cases.reach(s, it({ at: 'case', x: 4, y: 1 })),
      C.Cases.reach(s, it({ at: 'case', x: 6, y: 1 })), C.Cases.reach(s, it({ at: 'tote' })), C.Cases.reach(s, it({ at: 'case', x: 1, y: 2 }))]), json([true, false, true, true, false, false]));
    const f = C.Cases.at(s, 2, 1);
    assert.equal(json([C.Cases.highlightOk(s, f), C.Cases.highlightOk(s, null), C.Cases.highlightOk(s, C.Cases.at(s, 4, 1))]), json([true, true, false]));
    for (const [k, v] of [['lock', 4], ['loan', true], ['mimic', 'x.1'], ['holds', 'T0.1.room.i9']]) {
      const g = Object.assign({}, f, { [k]: v });
      assert.equal(C.Cases.highlightOk(s, g), false, k);
    }
    s.dept.entryGrade = 4;
    assert.equal(C.Cases.highlightOk(s, Object.assign({}, f, { lock: 4 })), true, 'within the grade you entered with');
    assert.equal(json([C.Cases.lockRange(1), C.Cases.lockRange(2), C.Cases.lockRange(3)]), json([LOCKS[1], LOCKS[2], LOCKS[3]]));
    assert.equal(C.Cases.openCost(s), 200);
  });

  // §8.3: a lock is drawn from the overlap of its glass's range and I to the depth + 1. The
  // glass's clause on a case's label names the locks a case of that glass can have in the
  // department, so at depth 1 a Laminated case says Grade II only, never "II to IV" (the
  // glass's whole range, which no case there can need). The locks are drawn here many times
  // on streams of their own and compared with the clause, and with the cases of real
  // departments at every depth.
  test('a glass\'s clause names exactly the locks its cases can be drawn with at the department\'s depth', () => {
    const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const said = locks => { const [lo, hi] = [Math.min(...locks), Math.max(...locks)]; return lo === hi ? `Grade ${ROMAN[lo]}` : `Grade ${ROMAN[lo]} to Grade ${ROMAN[hi]}`; };
    const MAP = ['#####', '#.v.#', '#...#', '#####'];
    for (let depth = 1; depth <= 7; depth++) for (const glass of [1, 2, 3]) {
      const drawn = new Set();
      for (let k = 0; k < 400; k++) drawn.add(C.Cases.drawLock(C.Rng.stream({ seed: k, rng: {} }, 'lock'), glass, depth));
      for (const l of drawn) assert.ok(l >= LOCKS[glass][0] && l <= Math.max(LOCKS[glass][0], Math.min(LOCKS[glass][1], depth + 1)), `depth ${depth}, glass ${glass}: lock ${l}`);
      const s = room(C, MAP, [1, 2], { depth, fixtures: [kase(C, 2, 1, { glass, lock: [...drawn][0] })] });
      const line = C.Labels.ofCase(s, C.Cases.at(s, 2, 1)).behaviour;
      assert.ok(line.includes(`in this department its lock is ${said([...drawn])}.`), `depth ${depth}, glass ${glass}, drawn ${json([...drawn].sort())}: ${line}`);
    }
    for (const dept of ['S9', 'A4', 'M11']) for (let depth = 1; depth <= 7; depth++) {
      const s = C.Dept.create(depth, dept, depth, { rulesOff: [], without: [] });
      for (const f of s.dept.fixtures) {
        if (f.k !== 'case' || f.mimic) continue;
        const line = C.Labels.ofCase(s, f).behaviour, m = /in this department its lock is Grade ([IV]+)(?: to Grade ([IV]+))?\./.exec(line);
        assert.ok(m, line);
        const lo = ROMAN.indexOf(m[1]), hi = m[2] ? ROMAN.indexOf(m[2]) : lo;
        assert.ok(f.lock >= lo && f.lock <= hi, `${dept} at depth ${depth}: a lock of ${f.lock} on a case whose label says ${m[0]}`);
      }
    }
  });

  test('each case invariant catches the fault it names, and a sound step breaks none', () => {
    const Inv = require(path.join(root, 'tools/invariants.js'));
    const check = Inv.checker(C, Inv.select(C, ['cases']));
    const MAP = ['#########', '#.......#', '#..v.v..#', '#...S...#', '#########'];
    const base = () => room(C, MAP, [3, 1], { fixtures: [kase(C, 3, 2), kase(C, 5, 2, { glass: 2 }), { k: 'staff', x: 4, y: 3, grade: 1 }],
      exhibits: [sleeper([1, 1], { mode: 'awake' }), sleeper([3, 2], { trigger: 'touch_case' })] });
    const faults = {
      cases_no_entry: post => { post.actors[1].x = 5; post.actors[1].y = 2; },
      cases_encased_stay: post => { post.actors[2].y = 3; },
      cases_hits: post => { C.Cases.at(post, 5, 2).hits = 0; C.Cases.at(post, 3, 2).lock = 7; },
      cases_v_count: post => { C.Grid.set(post.dept, 6, 1, 'v'); },
      cases_staff_wall: post => { post.actors[1].x = 4; post.actors[1].y = 3; },
    };
    for (const [id, plant] of Object.entries(faults)) {
      const pre = base();
      C.Cases.at(pre, 5, 2).hits = 1;
      const post = C.State.clone(pre);
      plant(post);
      const v = check(C.State.clone(pre), { a: 'wait' }, [], post).map(x => x.inv);
      assert.equal(json(v), json([id]), id);
    }
    // touch_wakes: an open that leaves the touch_case sleeper asleep.
    const pre = base(), post = C.State.clone(pre);
    C.Cases.at(post, 3, 2).st = 'open'; C.Grid.set(post.dept, 3, 2, 'u');
    const ev = [{ k: 'case_opened' }];
    assert.equal(json(check(C.State.clone(pre), { a: 'open', x: 3, y: 2 }, ev, post).map(x => x.inv)), json(['cases_touch_wakes']));
    // A sound open, and a sound break, break none.
    for (const action of [{ a: 'open', x: 3, y: 2 }, { a: 'bash', x: 3, y: 2 }]) {
      const s = base(), before = C.State.clone(s), events = C.Step.step(s, action);
      assert.equal(json(check(before, action, events, s)), '[]', json(action));
    }
  });

  test('a monkey that opens and bashes: random legal actions in each department, cases sought out, keep every case invariant, every event\'s schema and a clone after every step', () => {
    let opened = 0, broke = 0, cracked = 0, staff = 0, steps = 0;
    for (const acc of ['S9', 'A4', 'M11']) {
      const s = C.Dept.create(2, acc, 3, { invulnerable: true });
      s.run.grade = 3;
      const pick = C.Rng.stream({ seed: 9, rng: {} }, 'cases-monkey/' + acc);
      const policy = state => {
        const legal = C.Step.legal(state), mine = legal.filter(a => a.a === 'open' || a.a === 'bash');
        if (mine.length && pick.int(0, 9) < 8) return pick.pick(mine);
        // Walk towards the nearest intact case's neighbour, now and then at random.
        const m = state.dept, you = state.actors[0];
        if (pick.int(0, 9) < 7) {
          const d = C.Grid.distances(m, [[you.x, you.y]], 200);
          let best = null;
          for (const f of m.fixtures) {
            if (f.k !== 'case' || f.st !== 'shut') continue;
            for (let k = 0; k < 8; k++) {
              const x = f.x + C.Grid.DX[k], y = f.y + C.Grid.DY[k], v = C.Grid.inside(m, x, y) ? d[y * m.w + x] : -1;
              if (v > 0 && (!best || v < best.v)) best = { v, x, y };
            }
          }
          const p = best ? C.Path.to(state, best.x, best.y) : [];
          const dir = p.length ? C.Path.dirTo([you.x, you.y], p[0]) : -1;
          const mv = legal.find(a => a.a === 'move' && a.dir === dir);
          if (mv) return mv;
        }
        return pick.pick(legal);
      };
      const p = H.play(C, s, policy, { inv: ['cases'], clone: true, cap: 200 });
      assert.equal(json(p.violations.map(v => v.text)), '[]', acc);
      checked(C, p.events);
      steps += p.steps.length;
      opened += p.events.filter(e => e.k === 'case_opened').length;
      broke += p.events.filter(e => e.k === 'glass_broke').length;
      cracked += p.events.filter(e => e.k === 'glass_cracked').length;
      staff += p.events.filter(e => e.k === 'opened' && e.staff).length;
    }
    assert.ok(steps >= 600 && opened >= 3 && broke >= 3, `${steps} steps: ${opened} opened, ${cracked} cracked, ${broke} broken, ${staff} staff doors`);
  });
};
