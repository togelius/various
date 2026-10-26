// M3's labels (BUILD.md §8.8, §8.3, §8.5, §8.6, §5.3): the labels of cases, staff doors,
// plaques, items and you; the strip's priority, case contents before plaques; reading
// distance (a king's moves for exhibits, cases and items, the disc of read(x, y) for a
// plaque); seals drawn by their shapes; the mimic's one tell, the missing accession number,
// through the labels and through what a policy reads (Obs.read); names for split bodies,
// kept however often they sleep and wake; and Behaviour lines that show their numbers at
// depth. Every button a label offers
// is one step() takes, and no label says "undefined", "NaN" or "[object". The expected
// words are written out here from BUILD.md's text.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { Setup, Dept, Labels, Step, State, Cases, Clauses, Packs, Registry, Roles, Grid, Actors, Archetypes, Consumables, Status, N, Kit } = C;
  const json = v => JSON.stringify(v), J = v => JSON.parse(JSON.stringify(v));
  const BAD = /undefined|NaN|\[object/;
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  // Does step() take act now (on a copy)?
  const takes = (s, act) => { const ev = Step.step(State.clone(s), act); return !(ev.length === 1 && ev[0].k === 'refused'); };
  // Every button of a label is one step() takes; its words are clean.
  function sound(s, l, where) {
    if (!l) return 0;
    assert.ok(!BAD.test(json(l)), `${where}: ${json(l)}`);
    let n = 0;
    for (const a of l.actions || []) {
      assert.ok(typeof a.text === 'string' && a.text && !BAD.test(a.text), `${where}: ${json(a)}`);
      if (a.act) { assert.ok(takes(s, a.act), `${where}: offers ${json(a.act)}, which step() refuses (${Step.step(State.clone(s), a.act)[0].reason})`); n++; }
      else assert.ok(a.aim === 'tile' || a.aim === 'item', `${where}: ${json(a)} has neither an action nor an aim`);
    }
    return n;
  }
  const room = (map, you, o) => {
    o = o || {};
    const s = Setup.room(o.seed || 1, { acc: o.acc || 'T0', depth: o.depth || 1, map, you, exhibits: o.exhibits || [], fixtures: o.fixtures || [],
      kit: o.kit, grade: o.grade, items: o.items, exits: o.exits, youStatuses: o.youStatuses }, o.options);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    return s;
  };
  const kase = (x, y, extra) => Cases.make(Object.assign({ x, y, room: 'room', num: `T.0.101.${x}${y}`, glass: 1, lock: 1 }, extra));
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  // A free floor tile orthogonally beside (x, y), or null.
  function besideTile(s, x, y) {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (Grid.inside(s.dept, nx, ny) && Grid.walkable(s.dept, nx, ny) && Grid.ch(s.dept, nx, ny) !== 'v' && !Actors.at(s, nx, ny)) return [nx, ny];
    }
    return null;
  }

  test('the labels keep the stubs\' signatures, which Obs.readLabel calls', () => {
    const want = [['of', 2], ['ofCase', 2], ['ofItem', 2], ['ofPlaque', 2], ['ofStaffDoor', 2], ['you', 1], ['strip', 1], ['nameOf', 1], ['odds', 2]];
    assert.deepEqual(want.map(([k]) => [k, Labels[k].length]), want);
  });

  test('a policy reading a real case and a mimic\'s case gets text from both, and only the real one\'s carries its accession number', () => {
    const Sim = require(path.join(root, 'tools/sim.js')), X = Sim.load();
    const spec = X.Arena.parse(['arena: tell', 'goal: open R', 'species: mimic_vitrine', 'grade: 7', 'legend: M exhibit sp; R case like=M', 'variants: swap M R', '',
      '#########', '#.......#', '#.M.@.R.#', '#.......#', '#########', ''].join('\n'));
    const kinds = new Set();
    for (let seed = 1; seed <= 20; seed++) {
      const s = X.Arena.build(spec, seed), obs = X.Obs.make(s, [], null, null);
      const cases = s.dept.fixtures.filter(f => f.k === 'case'), real = cases.find(f => f.num !== null), mim = cases.find(f => f.num === null);
      assert.ok(real && mim, `seed ${seed}`);
      const tr = obs.read(`case:${real.x},${real.y}`), tm = obs.read(`case:${mim.x},${mim.y}`);
      assert.ok(tr && tm && !BAD.test(tr) && !BAD.test(tm), `seed ${seed}: ${tr} / ${tm}`);
      assert.ok(tr.includes(real.num) && !/\b[A-Z]\.\d+\.\d+\.\d+\b/.test(tm), `seed ${seed}: the number shows on the real case only:\n${tr}\n--\n${tm}`);
      assert.equal(tr.split('\n').filter(l => l !== real.num).join('\n'), tm, `seed ${seed}: the two read alike but for the number`);
      kinds.add(json([real.glass, real.lock, real.loan]));
    }
    assert.ok(kinds.size > 2, `the cases vary with the seed (${kinds.size})`);
  });

  test('beside a mimic in its disguise, depths 1–7: its case reads as a real empty case but for the number, the strip never names it, and once shown both name it', () => {
    let seen = 0, offered = 0;
    for (let depth = 1; depth <= 7; depth++) for (const seed of [1, 2, 3]) {
      const base = Dept.create(seed, 'S9', depth);
      for (const m0 of base.actors.filter(a => a.arch === 'mimic_vitrine' && !a.gone)) {
        const s = State.clone(base), m = Actors.byUid(s, m0.uid), you = s.actors[0];
        if (Archetypes.present(s, m) === null) continue;
        const spot = besideTile(s, m.x, m.y);
        if (!spot) continue;
        [you.x, you.y] = spot;
        seen++;
        const where = `S9 d${depth} seed ${seed} ${m.uid}`, f = Cases.at(s, m.x, m.y);
        assert.equal(Labels.of(s, m.uid), null, `${where}: it has an exhibit's label`);
        const strip = Labels.strip(s);
        assert.ok(!strip || strip.uid !== m.uid, `${where}: the strip names it`);
        // Its twin: the same room with a real, empty case of its glass, lock and loan where it
        // stands, and no mimic. Every label and the strip read the same, but for the number.
        const twin = State.clone(s), tf = Cases.at(twin, m.x, m.y);
        Actors.byUid(twin, m.uid).gone = 1; tf.mimic = null; tf.num = 'S.9.999.1';
        const lm = J(Labels.ofCase(s, f)), lr = J(Labels.ofCase(twin, tf));
        assert.equal(lm.number, '', `${where}: a mimic's case has no number`);
        assert.equal(lr.number, 'S.9.999.1');
        delete lm.number; delete lr.number;
        assert.deepEqual(lm, lr, `${where}: its case reads unlike a real one`);
        assert.equal(json(Labels.strip(s)), json(Labels.strip(twin)), `${where}: the strip tells them apart`);
        assert.equal(json(Labels.of(s, `case:${m.x},${m.y}`)), json(Labels.ofCase(s, f)), 'its tile\'s selection id gives its case\'s label');
        // No button any label here offers is one step() refuses.
        for (const a of s.actors.slice(1)) offered += sound(s, Labels.of(s, a.uid), `${where} ${a.uid}`);
        offered += sound(s, Labels.ofCase(s, f), `${where} its case`) + sound(s, Labels.you(s), `${where} you`);
        // Shown, it is an exhibit: on the strip (it is beside you and hunts) and with a label.
        const t = State.clone(s);
        Step.step(t, { a: 'bash', x: m.x, y: m.y });
        const shown = Actors.byUid(t, m.uid);
        assert.ok(shown.mode !== 'dormant' && Archetypes.present(t, shown) === null, where);
        assert.ok(Labels.of(t, m.uid), `${where}: shown, it has no label`);
        const st = Labels.strip(t), first = t.actors.find(a => !a.gone && a.uid !== 'you' && a.mode !== 'dormant' && Actors.dist(a, t.actors[0].x, t.actors[0].y) <= 1 && Actors.inSight(t, a, t.actors[0].x, t.actors[0].y));
        assert.equal(st && st.uid, first.uid, `${where}: the strip, shown`);
        assert.equal(Labels.ofCase(t, Cases.at(t, m.x, m.y)), null, `${where}: a revealed mimic's case is no case`);
      }
    }
    assert.ok(seen >= 10 && offered > seen, `${seen} mimics stood beside, ${offered} buttons checked`);
  });

  test('every label in the three departments at depths 1–7 is clean, and every button it offers is one step() takes', () => {
    let labels = 0, buttons = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (let depth = 1; depth <= 7; depth++) {
      const s = Dept.create(depth * 7, acc, depth), where = `${acc} d${depth}`;
      for (const a of s.actors.slice(1)) { const l = Labels.of(s, a.uid); if (l) { buttons += sound(s, l, `${where} ${a.uid}`); labels++; } }
      for (const it of s.items) { buttons += sound(s, Labels.ofItem(s, it.uid), `${where} ${it.uid}`); labels++; }
      buttons += sound(s, Labels.you(s), `${where} you`);
      const st = Labels.strip(s);
      assert.ok(!st || !BAD.test(json(st)), `${where}: strip ${json(st)}`);
      // Beside each fixture (up to six of each kind), and on each item lying on the floor.
      const done = {};
      for (const f of s.dept.fixtures) {
        done[f.k] = (done[f.k] || 0) + 1;
        if (done[f.k] > 6) continue;
        const t = State.clone(s), spot = besideTile(t, f.x, f.y);
        if (spot) [t.actors[0].x, t.actors[0].y] = spot;
        const l = f.k === 'case' ? Labels.ofCase(t, f) : f.k === 'staff' ? Labels.ofStaffDoor(t, f) : Labels.ofPlaque(t, f);
        assert.ok(l, `${where}: ${f.k} at ${f.x},${f.y} has no label`);
        buttons += sound(t, l, `${where} ${f.k} ${f.x},${f.y}`); labels++;
        assert.ok(!BAD.test(json(Labels.strip(t))), `${where}: strip beside ${f.k}`);
      }
      for (const it of s.items.filter(i => i.where.at === 'floor').slice(0, 6)) {
        const t = State.clone(s); [t.actors[0].x, t.actors[0].y] = [it.where.x, it.where.y];
        const l = Labels.ofItem(t, it.uid);
        assert.ok(l.actions.some(a => a.id === 'take'), `${where}: on ${it.uid}'s tile, no Take: ${json(l.actions)}`);
        buttons += sound(t, l, `${where} on ${it.uid}`); labels++;
      }
    }
    assert.ok(labels > 600 && buttons > 300, `${labels} labels and ${buttons} buttons checked`);
  });

  test('a case\'s label: what it holds, on loan, or empty; its glass, lock and cracks; Open and Break the glass as your grade and weapon allow', () => {
    const MAP = ['#########', '#.......#', '#.v.v.v.#', '#.......#', '#########'];
    const items = [{ uid: 'T0.1.room.i1', kind: 'curio', where: { at: 'case', x: 2, y: 2 }, prims: [{ id: 'acc', cls: 'M' }] }];
    const fixtures = [kase(2, 2, { lock: 2, holds: 'T0.1.room.i1' }), kase(4, 2, { glass: 2, lock: 3 }), kase(6, 2, { loan: true })];
    const s = room(MAP, [2, 1], { grade: 2, fixtures, items });
    const at = (t, x, y) => Labels.ofCase(t, Cases.at(t, x, y));
    let l = at(s, 2, 2);
    assert.equal(l.title, 'A case: A curio');
    assert.equal(l.number, 'T.0.101.22');
    assert.deepEqual(J(l.pictos), [{ icon: 'glass', text: 'Plate glass' }, { icon: 'lock', text: 'Grade II' }, { icon: 'curio', text: 'curio' }]);
    assert.deepEqual(J(l.odds), ['Your grade (Grade II) opens its lock (Grade II).', 'Your weapon breaks its Plate glass in 1 blow, with a crash.']);
    assert.deepEqual(J(l.actions), [{ id: 'open', text: 'Open: Grade II', act: { a: 'open', x: 2, y: 2 } }, { id: 'bash', text: 'Break the glass: 1 blow, a crash', act: { a: 'bash', x: 2, y: 2 } }]);
    assert.equal(l.behaviour, Cases.rules(s, Cases.at(s, 2, 2)).join(' '), 'its rules: the case\'s and its glass\'s clauses');
    // Laminated, lock III: above your grade, and two bashes; beside it, only Break.
    s.actors[0].x = 4;
    l = at(s, 4, 2);
    assert.equal(l.title, 'An empty case');
    assert.deepEqual(J(l.odds), ['Its lock needs Grade III; you are Grade II.', 'Your weapon breaks its Laminated glass in 2 blows: each before the last is loud, and the last makes a crash.']);
    assert.equal(l.actions[0].text, 'Break the glass: 2 blows, loud, the last a crash');
    assert.deepEqual(J(l.actions.map(a => a.id)), ['bash']);
    Step.step(s, { a: 'bash', x: 4, y: 2 });
    l = at(s, 4, 2);
    assert.deepEqual(J(l.pictos[2]), { icon: 'shards', text: 'cracked, 1 of 2 bashes' });
    assert.equal(l.actions[0].text, 'Break the glass: 1 blow, a crash');
    // A Light weapon cannot break Laminated glass, so no Break.
    const light = room(MAP, [4, 1], { grade: 2, fixtures, items, kit: { weapon: { form: 'light' } } });
    l = at(light, 4, 2);
    assert.equal(l.odds[1], 'A Light weapon cannot break Laminated glass.');
    assert.deepEqual(J(l.actions), []);
    // On loan: a label with no object (§8.3). Far from it, no button.
    l = at(s, 6, 2);
    assert.equal(l.title, 'A case: its object is on loan elsewhere');
    assert.deepEqual(J(l.actions), [], 'not beside it');
    // Opened, what it holds is taken from beside it.
    s.actors[0].x = 2;
    Step.step(s, { a: 'open', x: 2, y: 2 });
    l = at(s, 2, 2);
    assert.equal(l.title, 'An open case: A curio');
    assert.deepEqual(J(l.odds), ['It is no longer shut: what it holds can be taken.']);
    assert.deepEqual(J(l.actions), [{ id: 'take', text: 'Take A curio', act: { a: 'take', uid: 'T0.1.room.i1' } }]);
    assert.equal(json(Labels.of(s, 'case:2,2')), json(l), 'the selection id gives the case\'s label');
    assert.equal(Labels.of(s, 'case:1,1'), null, 'no case there');
    // An exhibit standing in a case is seen through its glass, and named; its label keeps
    // its lines, but offers no Attack (nothing strikes into a case, §8.3).
    const hop = Packs.species('S9', 'S9.6');
    const e = room(MAP, [2, 1], { acc: 'S9', fixtures: [kase(2, 2)], exhibits: [{ sp: 'S9.6', at: [2, 2], mode: 'dormant', stats: Roles.stats(hop.role, 1) }] });
    assert.equal(at(e, 2, 2).title, `A case, with the ${hop.name.replace(/^The /, '')} inside`);
    assert.deepEqual(J(Labels.of(e, e.actors[1].uid).actions), []);
    assert.ok(Labels.of(e, e.actors[1].uid).odds.length >= 2);
    // It sleeps, but no blow of yours reaches it in its case, and getting it out wakes it
    // (§8.1, §8.3): its readout has no surprise line. Out of its case, still asleep, it has.
    const unaware = (st, b) => Labels.of(st, b.uid).odds.filter(l => /surprise/i.test(l));
    assert.deepEqual(J(unaware(e, e.actors[1])), [], json(Labels.of(e, e.actors[1].uid).odds));
    const out = State.clone(e);
    out.dept.tiles[2] = out.dept.tiles[2].slice(0, 2) + 'u' + out.dept.tiles[2].slice(3);
    assert.equal(unaware(out, out.actors[1]).length, 1, json(Labels.of(out, out.actors[1].uid).odds));
  });

  test('a plaque\'s label keeps its text until its kind is identified, offers Read within reach, and shows the text once read', () => {
    let checked = 0;
    for (const acc of ['S9', 'A4', 'M11']) {
      const s = Dept.create(3, acc, 2), f = s.dept.fixtures.find(q => q.k === 'plaque');
      assert.ok(f, `${acc}: a plaque`);
      const pack = Packs.get(acc), kind = Registry.CONSUMABLES[f.ck].name;
      const t = State.clone(s), spot = besideTile(t, f.x, f.y);
      [t.actors[0].x, t.actors[0].y] = spot;
      let l = Labels.ofPlaque(t, f);
      assert.equal(l.title, 'An identifying label');
      assert.equal(l.paragraph, '');
      assert.equal(l.far, 'Read it to learn which kind it describes.');
      assert.ok(!json(l).includes(kind) && !json(l).includes(pack.consumables.labels[f.ck]), `${acc}: the unread label names its kind: ${json(l)}`);
      assert.deepEqual(J(l.actions), [{ id: 'read', text: 'Read the label', act: { a: 'read', x: f.x, y: f.y } }]);
      const seal = Registry.SEALS[Consumables.sealFor(t, f.ck)];
      assert.deepEqual(J(l.pictos[1]), { icon: 'seal_' + seal.shape, text: seal.name }, 'the seal of the kind it describes, by its shape');
      Step.step(t, l.actions[0].act);
      assert.ok(Consumables.known(t, f.ck));
      l = Labels.ofPlaque(t, f);
      assert.equal(l.title, `An identifying label: ${kind}`);
      assert.equal(l.paragraph, pack.consumables.labels[f.ck]);
      assert.deepEqual(J(l.actions), [], 'a known label is not read again');
      // Far from it: "Come closer to read the label".
      const far = State.clone(s);
      far.actors[0].x = f.x + 4 < far.dept.w ? f.x + 4 : f.x - 4;
      if (!Grid.disc(far.actors[0].x - f.x, far.actors[0].y - f.y, N.READ_RANGE)) { l = Labels.ofPlaque(far, f); assert.equal(l.far, 'Come closer to read the label.'); assert.deepEqual(J(l.actions), []); }
      checked++;
    }
    assert.equal(checked, 3);
  });

  test('a staff door\'s label: its grade; opened by stepping into it at your grade, a wall below it; an open one closes', () => {
    const MAP = ['#######', '#..S..#', '#######'];
    const at = (s) => Labels.ofStaffDoor(s, Cases.at(s, 3, 1));
    const low = room(MAP, [2, 1], { grade: 1, fixtures: [{ k: 'staff', x: 3, y: 1, grade: 3 }] });
    let l = at(low);
    assert.equal(l.title, 'A staff door');
    assert.deepEqual(J(l.pictos), [{ icon: 'lock', text: 'Grade III' }]);
    assert.deepEqual(J(l.odds), ['It needs Grade III; you are Grade I, so to you it is a wall.']);
    assert.deepEqual(J(l.actions), []);
    const high = room(MAP, [2, 1], { grade: 3, fixtures: [{ k: 'staff', x: 3, y: 1, grade: 3 }] });
    l = at(high);
    assert.deepEqual(J(l.odds), ['Your grade (Grade III) opens it.']);
    assert.deepEqual(J(l.actions), [{ id: 'open', text: 'Open: Grade III', act: { a: 'move', dir: 2 } }]);
    Step.step(high, l.actions[0].act);
    l = at(high);
    assert.equal(l.title, 'An open staff door');
    assert.deepEqual(J(l.actions), [{ id: 'close', text: 'Close', act: { a: 'close', x: 3, y: 1 } }]);
    assert.equal(l.behaviour, Cases.rules(high, Cases.at(high, 3, 1)).join(' '));
  });

  test('an item\'s label: a consumable\'s local name, seal and line, before and after it is identified; a weapon\'s numbers at your grade; what you can do with it', () => {
    const s = Dept.create(2, 'A4', 3), you = s.actors[0];
    const c = s.items.find(i => i.kind === 'consumable' && i.where.at === 'floor');
    [you.x, you.y] = [c.where.x, c.where.y];
    let l = Labels.ofItem(s, c.uid);
    const nm = Consumables.name(s, c);
    assert.equal(l.title, nm.local);
    assert.deepEqual(J(l.pictos), [{ icon: 'seal_' + Registry.SEALS[nm.seal].shape, text: Registry.SEALS[nm.seal].name }]);
    assert.equal(l.behaviour, Consumables.line(s, c));
    assert.deepEqual(J(l.odds), ['Not identified: which kind it is is not known yet.']);
    assert.deepEqual(J(l.actions), [{ id: 'take', text: 'Take', act: { a: 'take', uid: c.uid } }]);
    Step.step(s, { a: 'take', uid: c.uid });
    l = Labels.ofItem(s, c.uid);
    const cls = Registry.CONSUMABLES[c.ck].cls;
    assert.ok(l.actions.some(a => a.id === 'use' && a.text === (cls === 'ephemera' ? 'Read' : 'Drink')), json(l.actions));
    assert.ok(l.actions.some(a => a.id === 'drop'), 'carried, it can be dropped');
    if (cls === 'solution') assert.ok(l.actions.some(a => a.id === 'throw' && a.aim === 'tile'), json(l.actions));
    // Identified: the line is its kind's clause, and the label says which kind.
    Consumables.identify(s, Consumables.sealFor(s, c.ck), { k: 'card', by: 'you' }, []);
    l = Labels.ofItem(s, c.uid);
    assert.deepEqual(J(l.odds), [`Identified: it is ${Registry.CONSUMABLES[c.ck].name}.`]);
    assert.equal(l.behaviour, Consumables.line(s, c));
    // A weapon: its own numbers at your grade, what it needs, its bonuses, its tombstone.
    const w = s.items.find(i => i.kind === 'weapon' && i.ref);
    const d = Kit.describe(s, w.uid);
    l = Labels.ofItem(s, w.uid);
    assert.equal(l.title, d.title);
    assert.equal(json(l.tomb), json(d.tomb));
    assert.equal(l.odds[0], `At your grade, before any bonus: ${d.stats.dmin}–${d.stats.dmax} damage and Acc ${d.stats.acc < 0 ? '−' + -d.stats.acc : d.stats.acc}; a blow takes ${d.stats.cost} ticks.`);
    assert.equal(l.odds[1], `It needs Grade ${ROMAN[d.needs]}; you are Grade I` + (d.short ? `, ${d.short} grade${d.short === 1 ? '' : 's'} short.` : '.'));
    assert.equal(l.behaviour, d.line);
    // What you wear: the starting weapon has no pack record, and is named by what it is.
    l = Labels.ofItem(s, 'you.w');
    assert.equal(l.title, 'A Balanced weapon, tier 1');
    assert.deepEqual(J(l.actions), [], 'the weapon slot is never empty, so it is not taken off');
    assert.equal(Labels.ofItem(s, 'nothing'), null);
    // An instrument: its charges and range (§8.5).
    const t = room(['#######', '#.....#', '#######'], [1, 1], { items: [{ uid: 'T0.1.room.i1', kind: 'instrument', form: 'fork', tier: 1, where: { at: 'kit', slot: 'instrument' } }] });
    l = Labels.ofItem(t, 'T0.1.room.i1');
    const F = N.TUNING_FORK;
    assert.ok(l.odds.includes(`${F[0]} charges of ${F[0]}; one comes back every ${F[1]} turns, and it is full. It reaches ${F[2]} tiles.`), json(l.odds));
    assert.ok(l.actions.some(a => a.id === 'aim' && a.aim === 'tile') && l.actions.some(a => a.id === 'unequip'), json(l.actions));
  });

  test('your own label: your grade, numbers, ring and statuses with the turns left, and Wait, Rest, Sit and Leave where step() takes them', () => {
    const MAP = ['#######', '#.b.X.#', '#######'];
    const s = room(MAP, [1, 1], { exits: [[4, 1]], grade: 2, youStatuses: [{ id: 'rooted', turns: 2 }] });
    let l = Labels.you(s);
    const you = s.actors[0];
    assert.equal(l.title, 'You');
    assert.equal(l.odds[0], 'Handling Clearance, Grade II.');
    assert.equal(l.odds[1], `Your blows deal ${you.dmin}–${you.dmax} damage with Acc ${you.acc}, ${N.COST_ATTACK} ticks each.`);
    assert.equal(l.odds[2], `You have Padding ${you.pad} and Eva ${you.eva}.`);
    assert.equal(l.odds[3], `Your ring reaches ${C.Vision.ringRadius(s)} tiles now.`);
    assert.equal(l.odds[4], 'You are rooted to the spot: 2 turns left.');
    assert.ok(l.pictos.some(p => p.icon === 'rooted' && p.text === 'rooted to the spot, 2 turns'), json(l.pictos));
    assert.deepEqual(J(l.actions.map(a => a.id)), ['wait', 'rest']);
    you.statuses = []; you.x = 2;
    assert.deepEqual(J(Labels.you(s).actions.map(a => a.id)), ['wait', 'rest', 'sit'], 'on the bench');
    Step.step(s, { a: 'sit' });
    assert.ok(Labels.you(s).pictos.some(p => p.icon === 'bench'));
    assert.deepEqual(J(Labels.you(s).actions.map(a => a.id)), ['wait', 'rest'], 'seated already');
    you.x = 4;
    assert.deepEqual(J(Labels.you(s).actions), [{ id: 'wait', text: 'Wait', act: { a: 'wait' } }, { id: 'rest', text: 'Rest', act: { a: 'rest' } }, { id: 'leave', text: 'Leave by this door', act: { a: 'leave', i: 0 } }]);
    // Fixed: only waiting and resting are left (§8.1).
    Status.apply(s, you, 'fixed', 3, { k: 'status', id: 'fixed' }, []); Status.settle(s);
    assert.deepEqual(J(Labels.you(s).actions.map(a => a.id)), ['wait', 'rest']);
    s.over = { k: 'left', turn: 1, by: null, door: 0, cause: null };
    assert.deepEqual(J(Labels.you(s).actions), [], 'nothing once the visit is over');
  });

  test('the strip: hunting or awake exhibits, then sleeping ones, then cases, then plaques, nearest first; a mimic in its disguise only as its case', () => {
    const MAP = ['##########', '#........#', '#..v.v...#', '#........#', '##########'];
    const ex = (at, mode) => ({ sp: 'x', at, mode, stats: tough });
    const pick = (o, you) => { const s = room(MAP, you || [2, 1], o), t = Labels.strip(s); return t && t.uid; };
    const fx = [kase(3, 2), kase(5, 2)];
    assert.equal(pick({ fixtures: fx, exhibits: [ex([1, 1], 'dormant')] }), 'T0.1.room.1', 'a sleeping exhibit before a case');
    assert.equal(pick({ fixtures: fx }), 'case:3,2', 'the nearer case');
    assert.equal(pick({ fixtures: fx }, [5, 3]), 'case:5,2');
    assert.equal(pick({ fixtures: fx }, [8, 3]), null, 'nothing within 2 tiles');
    const s = room(MAP, [4, 3], { fixtures: fx }), t = Labels.strip(s);
    assert.equal(t.uid, 'case:3,2', 'a tie goes to fixture order');
    assert.deepEqual(J(t), { uid: 'case:3,2', title: 'An empty case', stateIcons: [], pictos: ['glass', 'lock'], behaviour: Labels.ofCase(s, s.dept.fixtures[0]).odds.join(' ') });
    // A mimic in its disguise: only as its case.
    const m = Setup.room(1, { acc: 'S9', depth: 2, map: MAP, you: [6, 1], exhibits: [{ sp: 'S9.5', at: [7, 2], mode: 'dormant', stats: Roles.stats('ambusher', 2) }] });
    const ms = Labels.strip(m);
    assert.equal(ms.uid, 'case:7,2');
    assert.equal(ms.title, Labels.ofCase(m, Cases.at(m, 7, 2)).title, 'a case like any other');
    assert.ok(/^(An empty case|A case: its object is on loan elsewhere)$/.test(ms.title), ms.title);
  });

  test('the strip: case contents before a plaque, even a nearer one; a plaque once the case is out of reach, or opened with nothing left in it', () => {
    // A plaque on the north wall at (6, 0), for the Catalogue Card; a case at (4, 2), lock I.
    const MAP = ['##########', '#........#', '#...v....#', '#........#', '##########'];
    const make = (you, items) => {
      const s = room(MAP, you, { fixtures: [kase(4, 2, items ? { holds: items[0].uid } : {}), { k: 'plaque', x: 6, y: 0, ck: 'card' }], items });
      Consumables.startRun(s);
      return s;
    };
    const put = (s, x, y) => { s.actors[0].x = x; s.actors[0].y = y; const t = Labels.strip(s); return t && t.uid; };
    let s = make([6, 1]);
    assert.ok(Labels.ofPlaque(s, Cases.at(s, 6, 0)).actions.some(a => a.id === 'read'), 'the plaque beside you can be read');
    assert.equal(put(s, 6, 1), 'case:4,2', 'a shut case 2 tiles off before a plaque beside you');
    assert.equal(put(s, 7, 1), 'plaque:6,0', 'the case 3 tiles off: the plaque');
    // Opened, the empty case has nothing left to read: the plaque.
    put(s, 4, 1);
    Step.step(s, { a: 'open', x: 4, y: 2 });
    assert.equal(Cases.at(s, 4, 2).st, 'open');
    assert.equal(put(s, 6, 1), 'plaque:6,0', 'an opened empty case does not keep the plaque off the strip');
    assert.equal(put(s, 5, 3), null, 'with no plaque in reach, nothing: the opened empty case has nothing to read');
    assert.equal(Labels.ofCase(s, Cases.at(s, 4, 2)).title, 'An open case', 'though it keeps its label, for a tap on it');
    // Opened with its object still in it, it is case contents: before the plaque, until taken.
    s = make([4, 1], [{ uid: 'T0.1.room.i1', kind: 'curio', where: { at: 'case', x: 4, y: 2 }, prims: [{ id: 'acc', cls: 'M' }] }]);
    Step.step(s, { a: 'open', x: 4, y: 2 });
    assert.equal(put(s, 6, 1), 'case:4,2', 'an opened case that still holds its object');
    put(s, 4, 1);
    Step.step(s, { a: 'take', uid: 'T0.1.room.i1' });
    assert.equal(put(s, 6, 1), 'plaque:6,0', 'once it is taken, the plaque');
    // Broken and empty: the plaque too.
    s = make([4, 1]);
    for (let i = 0; i < 4 && Cases.at(s, 4, 2).st === 'shut'; i++) Step.step(s, { a: 'bash', x: 4, y: 2 });
    assert.equal(Cases.at(s, 4, 2).st, 'broken');
    assert.equal(put(s, 6, 1), 'plaque:6,0', 'a broken empty case does not keep the plaque off the strip');
  });

  test('reading distance: an exhibit, a case and an item 2 tiles off on both axes are read, counted as a king moves; a plaque there is not, since read(x, y) reaches only its disc', () => {
    const sp = Packs.species('A4', 'A4.1'), rec = Packs.get('A4').items.find(r => r.id === 'A4.6');
    const OPEN = ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#######'];
    const CASE = ['#######', '#.....#', '#.....#', '#...v.#', '#.....#', '#######'];
    const at = (s, x, y) => { s.actors[0].x = x; s.actors[0].y = y; return s; };
    const strip = s => { const t = Labels.strip(s); return t && t.uid; };
    // An exhibit at (4, 3): from (2, 1) its nearest tile is 2 off on both axes.
    const e = room(OPEN, [2, 1], { acc: 'A4', exhibits: [{ sp: sp.id, at: [4, 3], mode: 'dormant', stats: Roles.stats(sp.role, 1) }] });
    assert.equal(Labels.of(e, e.actors[1].uid).paragraph, sp.paragraph);
    assert.equal(strip(e), e.actors[1].uid);
    assert.equal(Labels.of(at(e, 1, 1), e.actors[1].uid).far, 'Come closer to read the label.', '3 off');
    // A case at (4, 3) holding the Long-Handled Date Stamp: its paragraph, and the strip.
    const c = room(CASE, [2, 1], { acc: 'A4', fixtures: [kase(4, 3, { holds: 'A4.1.room.i1' })],
      items: [{ uid: 'A4.1.room.i1', kind: 'weapon', ref: rec.id, form: rec.form, tier: 1, where: { at: 'case', x: 4, y: 3 }, prims: rec.prims.map(q => ({ id: q.id, cls: q.cls })) }] });
    assert.equal(Labels.ofCase(c, Cases.at(c, 4, 3)).paragraph, rec.paragraph);
    assert.equal(strip(c), 'case:4,3');
    at(c, 1, 1);
    assert.deepEqual([Labels.ofCase(c, Cases.at(c, 4, 3)).paragraph, Labels.ofCase(c, Cases.at(c, 4, 3)).far, strip(c)], ['', 'Come closer to read the label.', null], '3 off');
    // The same weapon lying at (4, 3).
    const i = room(OPEN, [2, 1], { acc: 'A4', items: [{ uid: 'A4.1.room.i1', kind: 'weapon', ref: rec.id, form: rec.form, tier: 1, where: { at: 'floor', x: 4, y: 3 }, prims: rec.prims.map(q => ({ id: q.id, cls: q.cls })) }] });
    assert.equal(Labels.ofItem(i, 'A4.1.room.i1').paragraph, rec.paragraph);
    assert.deepEqual([Labels.ofItem(at(i, 1, 1), 'A4.1.room.i1').paragraph, Labels.ofItem(i, 'A4.1.room.i1').far], ['', 'Come closer to read the label.'], '3 off');
    // A plaque at (4, 3): from (2, 1), 2² + 2² = 8 > 6, outside its disc (§8.6), so it is not
    // on the strip and offers no Read; from (2, 2), 2² + 1² = 5, it is and does.
    const p = room(OPEN, [2, 1], { acc: 'A4', fixtures: [{ k: 'plaque', x: 4, y: 3, ck: 'card' }] });
    Consumables.startRun(p);
    const f = Cases.at(p, 4, 3);
    assert.equal(strip(p), null);
    assert.deepEqual([Labels.ofPlaque(p, f).far, J(Labels.ofPlaque(p, f).actions)], ['Come closer to read the label.', []]);
    assert.equal(Step.step(State.clone(p), { a: 'read', x: 4, y: 3 })[0].reason, 'label_far', 'read(x, y) refuses it there too');
    at(p, 2, 2);
    assert.equal(strip(p), 'plaque:4,3');
    assert.deepEqual(J(Labels.ofPlaque(p, f).actions), [{ id: 'read', text: 'Read the label', act: { a: 'read', x: 4, y: 3 } }]);
  });

  test('a consumable\'s seal is drawn by its shape (D5.11): eight seals, eight pictograms, on its label, on its plaque and in its case', () => {
    const MAP = ['#########', '#.......#', '#.v.....#', '#.......#', '#########'];
    const s = room(MAP, [3, 1], { acc: 'A4', fixtures: [kase(2, 2)] });
    Consumables.startRun(s);
    const icons = new Set(), f = Cases.at(s, 2, 2);
    for (const ck of Registry.order('CONSUMABLES')) {
      const seal = Consumables.sealFor(s, ck), want = 'seal_' + Registry.SEALS[seal].shape;
      const it = Consumables.make(s, ck, { at: 'case', x: 2, y: 2 });
      assert.equal(Labels.ofItem(s, it.uid).pictos[0].icon, want, `${ck}: its label`);
      assert.ok(Labels.ofCase(s, f).pictos.some(q => q.icon === want), `${ck}: its case: ${json(Labels.ofCase(s, f).pictos)}`);
      assert.equal(Labels.ofPlaque(s, { k: 'plaque', x: 3, y: 0, ck }).pictos[1].icon, want, `${ck}: its plaque`);
      icons.add(want);
      it.where = { at: 'gone' }; f.holds = null;
    }
    assert.equal(icons.size, 8, json([...icons]));
  });

  test('names: a body split from another is "a split of" its species, in the log and on its label', () => {
    const sp = Packs.species('A4', 'A4.4');
    const s = Setup.room(5, { acc: 'A4', depth: 3, map: ['#######', '#.....#', '#.....#', '#######'], you: [2, 1], exhibits: [{ sp: 'A4.4', at: [3, 1], mode: 'hunting', stats: Roles.stats('brute', 3) }] });
    s.actors[0].hp = s.actors[0].maxHp = 999; s.actors[0].acc = 99;
    let ev = [];
    for (let k = 0; k < 30 && s.actors.length < 3; k++) ev = Step.step(s, { a: 'attack', uid: s.actors[1].uid });
    const half = s.actors[2];
    assert.ok(half && half.woke.cause.how === 'split', 'it split');
    const names = Labels.nameOf(s), the = 'the ' + sp.name.replace(/^The /, '');
    assert.equal(names(s.actors[1].uid), the);
    assert.equal(names(half.uid), 'a split of ' + the);
    assert.equal(Labels.of(s, half.uid).title, 'A split of ' + the);
    assert.equal(Labels.of(s, s.actors[1].uid).title, sp.name);
    const made = C.Text.log(ev, names).join(' ');
    assert.ok(made.includes(`${the.charAt(0).toUpperCase() + the.slice(1)} splits in two`), made);
  });

  test('a split half keeps its name after it settles back and is woken again, though that waking writes over the story that said how it split', () => {
    const sp = Packs.species('A4', 'A4.4'), the = 'the ' + sp.name.replace(/^The /, ''), The = the.charAt(0).toUpperCase() + the.slice(1);
    // The Trustee in the west room, struck until it splits; you then go far off, east past
    // a door, until the half has gone back and settled; then you stand 2 tiles from it.
    const MAP = ['###############', '#.....#.......#', '#.....+.......#', '#.....#.......#', '###############'];
    const s = Setup.room(5, { acc: 'A4', depth: 3, map: MAP, you: [2, 2], exhibits: [{ sp: 'A4.4', at: [3, 2], mode: 'hunting', stats: Roles.stats('brute', 3) }] });
    const you = s.actors[0];
    you.hp = you.maxHp = 9999; you.acc = 99;
    for (let k = 0; k < 30 && s.actors.length < 3; k++) Step.step(s, { a: 'attack', uid: s.actors[1].uid });
    const half = s.actors[2], names = () => Labels.nameOf(s);
    assert.equal(half.woke.cause.how, 'split');
    assert.equal(names()(half.uid), 'a split of ' + the);
    you.x = 12; you.y = 2;
    for (let i = 0; i < 600 && half.mode !== 'dormant'; i++) Step.step(s, { a: 'wait' });
    assert.equal(half.mode, 'dormant', 'it settled back');
    assert.equal(names()(half.uid), 'a split of ' + the, 'asleep');
    const spot = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [half.x + dx, half.y + dy])
      .find(([x, y]) => Grid.inside(s.dept, x, y) && Grid.walkable(s.dept, x, y) && !Actors.at(s, x, y) && Grid.los(s.dept, x, y, half.x, half.y));
    [you.x, you.y] = spot;
    const ev = [];
    for (let i = 0; i < 20 && half.mode === 'dormant'; i++) ev.push(...Step.step(s, { a: 'wait' }));
    assert.equal(half.woke.cause.k, 'ring', `woken again, by your ring: ${json(half.woke)}`);
    assert.equal(names()(half.uid), 'a split of ' + the);
    assert.equal(Labels.of(s, half.uid).title, 'A split of ' + the);
    assert.equal(names()(s.actors[1].uid), the, 'the body it split from keeps its own name');
    const log = C.Text.log(ev, names());
    assert.ok(log.includes(`A split of ${the} woke and is hunting you: you stayed inside your ring.`), log.join('\n'));
    assert.ok(!log.some(l => l.startsWith(The + ' woke')), log.join('\n'));
  });

  test('Behaviour lines show their numbers at depth, every part Clauses.of gives appears in the line, and a rule switched off leaves its part out', () => {
    const all = [];
    for (const p of Packs.list()) for (const sp of p.species) if (Registry.ARCHETYPES[sp.archetype] && Registry.ARCHETYPES[sp.archetype].built === 'M3') all.push(sp);
    all.push(Packs.shared('night_watchman'));
    let parts = 0;
    for (const sp of all) for (let depth = 1; depth <= 7; depth++) {
      const line = Clauses.line(sp, { depth }), where = `${sp.id} d${depth}`;
      assert.ok(!BAD.test(line) && !/[{}]/.test(line), `${where}: ${line}`);
      for (const p of Clauses.of(sp, { depth })) {
        assert.ok(line.includes(p.text.replace(/\.$/, '')), `${where}: the ${p.kind} part ${p.id} is not in the line: "${p.text}" in "${line}"`);
        for (const name of Object.keys(p.params)) assert.ok(p.text.includes(String(p.params[name])), `${where}: ${p.id}'s ${name} (${p.params[name]}) is not in its words: ${p.text}`);
        parts++;
      }
      // Its numbers at the depth: the role's damage, and every special's gross figure.
      const r = Roles.stats(sp.role, depth), dmg = r.dmin === r.dmax ? String(r.dmin) : `${r.dmin}–${r.dmax}`;
      if (/\{dmg\}/.test(Registry.ARCHETYPES[sp.archetype].clause)) assert.ok(line.includes(`for ${dmg}`) || line.includes(`for only ${dmg}`), `${where}: ${line}`);
      // A modifier switched off for the visit leaves its part out (§5.3).
      for (const m of sp.modifiers || []) {
        const off = Clauses.line(sp, { depth, rulesOff: [m] }), mine = Clauses.of(sp, { depth }).find(q => q.id === m);
        assert.ok(mine && !off.includes(mine.text), `${where}: ${m} switched off is still in the line`);
      }
    }
    assert.ok(parts > 300, `${parts} parts checked`);
    // The label shows the line at its department's depth, with rulesOff applied.
    const s = Dept.create(4, 'A4', 5, { rulesOff: ['marble'] }), a = s.actors.find(q => q.uid !== 'you' && (q.mods || []).includes('marble'));
    if (a) assert.equal(Labels.of(s, a.uid).behaviour, Clauses.line(Labels.speciesOf(s, a), { depth: 5, rulesOff: ['marble'] }));
  });
};
