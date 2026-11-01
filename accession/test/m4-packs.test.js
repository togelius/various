// The three department packs, filled (M4 plan D-PACKS, DE6, DE7, D2.9, A10; BUILD.md §5.2,
// §5.5; design/samples.md §§2–4):
//   - each pack's gallery list: sound, in its sample's order, every exhibit of the pack named
//     by a gallery or by its stamp (M.11.12 by its stamp alone), each Signature piece by its
//     Centrepiece;
//   - on real plans (layout version 3), each gallery takes the room its element, its role or
//     tour order gives it: S.9's court and A.4's maze by `central`, their band rooms by
//     `band`, M.11's sections in tour order, and the samples' study rooms joining the last
//     section;
//   - placed with every M4 archetype planted ready (as each module and archetype package will
//     make them), every listed exhibit stands where its gallery says, and the shared sweep's
//     checks (test/sweep/population.check.js) hold; in the real core, a species whose
//     archetype, modifier or trigger waits is logged, never placed;
//   - the Signature pieces (D2.9): what each is, worn or carried as a single visit's carry,
//     the Lamp lit and hooded; and no stand-in places one as loot;
//   - the paragraph lint of placement: a paragraph that says where its exhibit or item stands
//     ("in a case", "under glass", "at the end of this row") is held to it on the sweep, and
//     says only what population keeps (A.4.1/a's "see the case at the end of this row" is gone);
//   - the Orientation's species and item, M.11.5 and M.11.7, unchanged;
//   - what D-LV6 will read, planted: a Wader on the court's round (it sees the Intro's open
//     doorway, in the safe zone) and the Lamp Corridor without its south cabinets (the
//     Brooder's tether reaches the vestibule through the wall) are each caught by the sweep's
//     check, which the real packs pass.
// The expected rooms and counts are written out here from the samples and BUILD.md.
'use strict';
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { Packs, Populate, Layout, Dept, Kit, Step, State, N, Grid } = C;
  const json = x => JSON.stringify(x);
  const ACCS = ['S9', 'A4', 'M11'];
  const depthOf = seed => 1 + ((seed - 1) % 7);
  const CHECK = path.join(root, 'test/sweep/population.check.js');
  const check = X => require(CHECK)(X);
  // Every M4 species' archetype, modifier and trigger past ready false, in a core of its own,
  // as the packages that build them will leave them (m4-population's planting).
  const M4_READY = { ARCHETYPES: ['unobserved_mover', 'patrol_guard', 'demonstrator', 'conservator_healer'], MODIFIERS: ['clockwork'], TRIGGERS: ['period'] };
  function readyCore() {
    const X = loadCore();
    for (const t of Object.keys(M4_READY)) for (const id of M4_READY[t]) if (X.Registry[t][id].ready === false) X.Registry[t][id].ready = 'unit';
    return X;
  }

  // ---- The gallery lists ----

  // Each pack's galleries as [key, where, name], in its sample's order (design/samples.md §2.3,
  // §3.3, §4.3: the Intro, the sections, the study room as `last`, the hall, the coda).
  const LISTS = {
    S9: [['intro', null, 'The Lamp Corridor'], ['s1', 'central', 'The Mount Court'], ['s2', 'band', 'The Brooders’ Bay'], ['last', null, 'The Round-Book Room'], ['centre', null, 'The Day Curator’s Case'], ['coda', null, 'The Night Staff’s Tea Room']],
    A4: [['intro', null, 'The Office Counter'], ['s1', 'central', 'Originals Under Glass'], ['s2', 'band', 'The Copying Room'], ['last', null, 'The Registry'], ['centre', null, 'The Lectern Hall'], ['coda', null, 'The Forms Counter']],
    M11: [['intro', null, 'The First Landing'], ['s1', null, 'The Line'], ['s2', null, 'Weather Kept for Trials'], ['last', null, 'The Logbook Room'], ['centre', null, 'The Central Station'], ['coda', null, 'The Linesmen’s Canteen']],
  };
  // Each gallery's exhibits as {sp: count}, and the stamp's.
  const EXHIBITS = {
    S9: { s1: { 'S9.1': 1, 'S9.3': 1, 'S9.6': 2 }, s2: { 'S9.4': 1, 'S9.5': 1, 'S9.2': 2 }, centre: { 'S9.1': 2 }, stamp: { 'S9.1': 1, 'S9.6': 2 } },
    A4: { s1: { 'A4.1': 1, 'A4.1a': 3, 'A4.4': 1, 'A4.4a': 2, 'A4.5': 1 }, s2: { 'A4.2': 2, 'A4.3': 1 }, stamp: { 'A4.1': 1, 'A4.1a': 2 } },
    M11: { s1: { 'M11.1': 1, 'M11.3': 1 }, s2: { 'M11.2': 1, 'M11.4': 1, 'M11.1': 1, 'M11.3': 1 }, stamp: { 'M11.12': 1, 'M11.5': 1 } },
  };
  // And each section's entries as written, with what each asks of its place (an empty case,
  // a tile beside a case, a case to guard), and its items, in order: an exhibit's or item's
  // place is part of what the sample says of it (design/samples.md: the originals in their
  // bays' end cases, the Brooder with its nest and Round Book 9 inside, the Date Stamp in a
  // case, the Lamp in its case), so a lost `case` or `guards` is a change of the list.
  const ENTRIES = {
    S9: { s1: [{ sp: 'S9.1' }, { sp: 'S9.3' }, { sp: 'S9.6', count: 2 }, { item: 'S9.7', case: true }],
      s2: [{ sp: 'S9.4', guards: 'case' }, { item: 'S9.10', case: true }, { sp: 'S9.5', near: 'case' }, { sp: 'S9.2', count: 2 }, { item: 'S9.8', case: true }, { item: 'S9.9', case: true }],
      last: [], centre: [{ sp: 'S9.1', count: 2 }, { item: 'S9.11', case: true }] },
    A4: { s1: [{ sp: 'A4.1', case: true }, { sp: 'A4.1a', count: 3 }, { sp: 'A4.4', case: true }, { sp: 'A4.4a', count: 2 }, { sp: 'A4.5' }],
      s2: [{ sp: 'A4.2', count: 2 }, { sp: 'A4.3' }, { item: 'A4.6', case: true }], last: [{ item: 'A4.10' }], centre: [] },
    M11: { s1: [{ sp: 'M11.1' }, { sp: 'M11.3' }], s2: [{ sp: 'M11.2' }, { sp: 'M11.4' }, { sp: 'M11.1' }, { sp: 'M11.3' }], last: [{ item: 'M11.9' }], centre: [] },
  };
  const SIGNATURE = { S9: 'S9.11', A4: 'A4.11', M11: 'M11.10' };
  const countsOf = contents => { const o = {}; for (const e of contents) if (e.sp !== undefined) o[e.sp] = (o[e.sp] || 0) + (e.count === undefined ? 1 : e.count); return o; };
  const stampOf = pack => { const o = {}; for (const ch of Object.keys(pack.intro.legend).sort()) { const e = pack.intro.legend[ch]; if (e.sp) o[e.sp] = (o[e.sp] || 0) + pack.intro.map.reduce((k, r) => k + r.slice(1).split(ch).length - 1, 0); } return o; };
  const sortObj = o => Object.keys(o).sort().map(k => [k, o[k]]);

  test('each pack has its gallery list, sound and in its sample\'s order: every exhibit named by a gallery or its stamp, M.11.12 by its stamp alone', () => {
    for (const acc of ACCS) {
      const p = Packs.get(acc);
      assert.equal(json(Populate.check(p)), '[]', acc);
      assert.equal(json(p.galleries.map(g => [g.key, g.where || null, g.name])), json(LISTS[acc]), `${acc}: the galleries`);
      for (const g of p.galleries) {
        const want = EXHIBITS[acc][g.key] || {};
        assert.equal(json(sortObj(countsOf(g.contents))), json(sortObj(want)), `${acc} ${g.key}: its exhibits`);
        if (ENTRIES[acc][g.key]) assert.equal(json(g.contents), json(ENTRIES[acc][g.key]), `${acc} ${g.key}: its entries`);
      }
      // The Intro's exhibits are its stamp's (its gallery lists none, since a pack's own stamp
      // places them, BUILD.md §5.5).
      assert.equal(json(p.galleries.find(g => g.key === 'intro').contents), '[]', `${acc}: the Intro gallery`);
      assert.equal(json(sortObj(stampOf(p))), json(sortObj(EXHIBITS[acc].stamp)), `${acc}: its stamp's exhibits`);
      // Every species of the pack stands somewhere.
      const named = new Set(Object.keys(EXHIBITS[acc]).flatMap(k => Object.keys(EXHIBITS[acc][k])));
      for (const sp of p.species) assert.ok(named.has(sp.id), `${sp.id} is in no gallery and not in the stamp`);
      // Each item at most once; the Signature piece only as S.9's treasure, in its hall.
      const items = p.galleries.flatMap(g => g.contents.filter(e => e.item !== undefined).map(e => [g.key, e.item]));
      assert.equal(new Set(items.map(i => i[1])).size, items.length, `${acc}: an item listed twice`);
      const sig = items.filter(i => i[1] === SIGNATURE[acc]);
      assert.equal(json(sig), acc === 'S9' ? json([['centre', 'S9.11']]) : '[]', `${acc}: its Signature piece's place`);
    }
    // M.11.12, the First Landing's station, is the stamp's alone (D-STAMPS).
    assert.ok(!Packs.get('M11').galleries.some(g => g.contents.some(e => e.sp === 'M11.12')));
    // DE6: S.9's mimic stands beside a real case, in the band room, among its cases; DE7: M.11's
    // section station is in its second section.
    assert.equal(json(Packs.get('S9').galleries.find(g => g.key === 's2').contents.find(e => e.sp === 'S9.5')), json({ sp: 'S9.5', near: 'case' }));
    assert.ok(Packs.get('M11').galleries.find(g => g.key === 's2').contents.some(e => e.sp === 'M11.2'));
  });

  test('on real plans each gallery takes its room: S.9\'s and A.4\'s by their central and band elements, M.11\'s in tour order, the study rooms joining the last section', () => {
    const WANT = { S9: ['role', 'where', 'where', 'merged', 'role', 'role'], A4: ['role', 'where', 'where', 'merged', 'role', 'role'], M11: ['role', 'tour', 'tour', 'merged', 'role', 'role'] };
    for (const acc of ACCS) {
      const pack = Packs.get(acc);
      for (let seed = 1; seed <= 40; seed++) {
        const plan = Layout.generate(pack.programme, 0, seed, { acc, depth: depthOf(seed) }).plan, map = Populate.mapping(plan, pack), where = `${acc} seed ${seed}`;
        const room = i => plan.rooms.find(r => r.id === map[i].room);
        assert.equal(json(map.map(x => x.how)), json(WANT[acc]), where);
        const sections = plan.rooms.filter(r => r.role === 'section').sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
        assert.equal(json([room(0).role, room(4).role, room(5).role]), json(['intro', 'centre', 'coda']), where);
        assert.equal(room(3), sections[sections.length - 1], `${where}: the study room joins the last section`);
        if (acc === 'M11') assert.equal(json([room(1).key, room(2).key]), json(['s1', 's2']), where);
        else {
          assert.ok(room(1).tags.includes('central') && room(2).tags.includes('band'), `${where}: ${json([room(1).tags, room(2).tags])}`);
          // At layout version 3 tour order puts the band room first: only `where` holds them.
          assert.equal(json([room(1).key, room(2).key]), json(['s2', 's1']), where);
        }
      }
    }
  });

  test('with every M4 archetype ready, every listed exhibit stands where its gallery says, with no population rejection, and the sweep\'s checks hold', () => {
    const X = readyCore(), chk = check(X);
    for (const acc of ACCS) for (let seed = 1; seed <= 21; seed++) {
      const out = X.Dept.generate(seed, acc, depthOf(seed)), s = out.state, where = `${acc} seed ${seed}`;
      for (const t of out.tries) for (const f of t) assert.notEqual(f.id, 'population', `${where}: ${f.why}`);
      assert.equal(out.log.filter(l => l.check === 'population' && /not placed|keeps none/.test(l.op)).map(l => l.op).join('; '), '', where);
      assert.equal(chk.each({ state: s, seed, acc, depth: depthOf(seed) }), null, where);
      // Every exhibit of the lists stands (the Grazers, the Waders on rounds, the stations
      // with their lines, the Countersigning Clerk).
      for (const a of s.actors.filter(q => q.arch === 'patrol_guard')) assert.ok(a.route && a.route.posts.length >= 2, `${where}: ${a.uid}'s round`);
      for (const a of s.actors.filter(q => q.arch === 'demonstrator')) assert.ok(a.route && ['N', 'E', 'S', 'W'].includes(a.route.dir), `${where}: ${a.uid}'s line`);
      const n = sp => s.actors.filter(a => a.sp === sp).length;
      if (acc === 'S9') assert.equal(json([n('S9.1'), n('S9.2'), n('S9.6')]), json([4, 2, 4]), where);
      if (acc === 'A4') assert.equal(json([n('A4.5'), n('A4.1a'), n('A4.2')]), json([1, 5, 6]), where);
      if (acc === 'M11') assert.equal(json([n('M11.2'), n('M11.12'), n('M11.1')]), json([1, 1, 2]), where);
    }
    assert.equal(chk.done(), null);
  });

  test('a listed species whose archetype, modifier or trigger waits is logged and placed nowhere', () => {
    const waits = [];
    for (const acc of ACCS) {
      const pack = Packs.get(acc), out = Dept.generate(3, acc, 3), s = out.state;
      for (const sp of pack.species) {
        if (Populate.ready(sp)) continue;
        waits.push(sp.id);
        assert.ok(!s.actors.some(a => a.sp === sp.id), `${sp.id} is placed`);
        assert.ok(out.log.some(l => l.check === 'population' && l.op.startsWith(`${sp.id} (`) && /is not placed: its archetype, a modifier or its trigger is not ready$/.test(l.op)), `${sp.id} is not logged`);
      }
    }
    console.log(`  waiting for their packages: ${waits.join(', ') || 'none'}`);
  });

  // ---- The Signature pieces (D2.9) ----

  test('each Centrepiece names its Signature piece, and each is what D2.9 makes it: the Lamp observing, the Pen Light with Acc, the Pocket Heliograph a Pin-Driver with Acc', () => {
    const rec = (acc, id) => Packs.get(acc).items.find(it => it.id === id);
    for (const acc of ACCS) assert.equal(Packs.get(acc).centrepiece.signature, SIGNATURE[acc], acc);
    assert.equal(json(['curio', rec('S9', 'S9.11').prims]), json([rec('S9', 'S9.11').kind, [{ id: 'observing', cls: 'L' }]]));
    // The Pen is Light (its sample's strike_kind(edge, S)), so it takes its sample's fallback
    // without breaker, which could do nothing on a Light weapon (§8.3): Acc L for
    // surprise_bonus(L).
    assert.equal(json(['weapon', 'light', rec('A4', 'A4.11').prims.map(p => p.id + ':' + p.cls)]), json([rec('A4', 'A4.11').kind, rec('A4', 'A4.11').form, ['dmg:S', 'acc:L']]));
    assert.equal(json(['instrument', 'pin_driver', rec('M11', 'M11.10').prims]), json([rec('M11', 'M11.10').kind, rec('M11', 'M11.10').instrument, [{ id: 'acc', cls: 'M' }]]));
    // Worn as a single visit's carry, each reads cleanly and does what it says.
    for (const [acc, ref, slot] of [['S9', 'S9.11', 'curio0'], ['A4', 'A4.11', 'weapon'], ['M11', 'M11.10', 'instrument']]) for (const depth of [1, 4, 7]) {
      const s = Dept.create(2, acc, depth, { carry: { items: [{ ref, slot }] } }), d = Kit.describe(s, 'you.c1'), base = Dept.create(2, acc, depth), you = s.actors[0];
      assert.ok(d && d.title === rec(acc, ref).name && !/undefined|NaN|\[object/.test(json(d)), `${ref} d${depth}: ${json(d)}`);
      if (ref === 'A4.11') assert.equal(json([you.weaponForm, you.breaker, d.bonuses.map(b => `${b.id}:${b.n}`)]), json(['light', 0, [`dmg:${N.BONUS_DMG[0]}`, `acc:${N.BONUS_ACC[2]}`]]), ref);
      if (ref === 'M11.10') assert.equal(you.acc, base.actors[0].acc + N.BONUS_ACC[1], `${ref}: Acc M on top`);
    }
    // The Lamp, taken hooded: lit by use, hooded by use again.
    const s = Dept.create(1, 'S9', 3, { carry: { items: [{ ref: 'S9.11', slot: 'curio0' }] } });
    assert.equal(json([Kit.observing(s), 'lit' in s.items.find(i => i.uid === 'you.c1')]), json([0, false]), 'taken hooded');
    assert.ok(Step.legal(s).some(a => a.a === 'use' && a.uid === 'you.c1'));
    Step.step(s, { a: 'use', uid: 'you.c1' });
    assert.equal(Kit.observing(s), N.LAMP_OBSERVE_RANGE, 'lit');
    Step.step(s, { a: 'use', uid: 'you.c1' });
    assert.equal(Kit.observing(s), 0, 'hooded again');
  });

  test('no stand-in places a Signature piece as loot; with its Centrepiece naming none it would', () => {
    const placed = (X, acc) => { let n = 0; for (let seed = 1; seed <= 20; seed++) n += X.Dept.create(seed, acc, depthOf(seed)).items.filter(i => i.ref === SIGNATURE[acc]).length; return n; };
    for (const acc of ACCS) assert.equal(placed(C, acc), 0, acc);
    // Planted: the Centrepiece names no Signature piece, so the stand-in takes it as any item.
    const X = loadCore();
    for (const acc of ACCS) delete X.Packs.get(acc).centrepiece.signature;
    for (const acc of ACCS) assert.ok(placed(X, acc) > 0, `${acc}: the stand-in never drew it`);
  });

  // The stand-in's second rule (BUILD.md §8.5): no item goes into a case an exhibit stands
  // in, a removed one included, so removing an exhibit a gallery stands in a case (`without`,
  // as paired runs do) moves no item: its case is still no place for one, and every room's
  // places, and so every draw among them, stay as they were.
  test('removing an exhibit that stands in a case moves no item: the stand-in counts its case as taken all the same', () => {
    let removals = 0;
    for (const seed of [1, 2]) {
      const base = Dept.create(seed, 'A4', depthOf(seed));
      for (const a of base.actors.filter(q => q.uid !== 'you' && C.Cases.at(base, q.x, q.y) && C.Cases.at(base, q.x, q.y).mimic === null)) {
        const s = Dept.create(seed, 'A4', depthOf(seed), { without: [a.uid] });
        assert.equal(json(s.items), json(base.items), `A4 seed ${seed}: without ${a.uid} (${a.sp}, in its case)`);
        removals++;
      }
    }
    assert.equal(removals, 4, 'each seed\'s two originals in their cases');
  });

  // ---- The paragraph lint of placement (plan D5.5, R26: "a placement claim only where
  // population keeps it") ----

  // A placement claim: words that say where the exhibit or item stands now. Each one a pack
  // makes is listed in CLAIMS, with what keeps it, and test/sweep/population.check.js checks
  // it on every exhibit of its species on every department of the sweep (its own CLAIMS).
  const PLACEMENT = [/\bsee the case\b/i, /\bat the end of (this|the|each) row\b/i, /\b(in|inside) (a|the|its|this) (case|vitrine|cabinet)\b/i, /\b(behind|under) glass\b/i,
    /\b(beside|next to|by) the (north|south|east|west)\b/i, /\b(on|along) the (north|south|east|west) wall\b/i, /\btravels? (its|a) (short )?rail\b/i,
    /\bat the side of the gallery\b/i, /\bpausing at\b/i, /\bin front of it\b/i];
  const CLAIMS = {
    'A4.4': ['under glass'], // "kept under glass": its gallery stands it in a case, and the maze always has one empty (the sweep)
    'M11.12': ['in the cabinet', 'in front of it'], // "kept in the cabinet in front of it": the stamp's low cabinet on its line's first tile (the sweep)
  };
  // A gallery named as a place ("in the Copying Room"): its name as the pack spells it, after
  // in, at, into or inside. A.4.3's bell said "nobody in the Copying Room has ever slept
  // through it", and its call reaches HERALD_RANGE tiles, short of most of the band room it
  // stands in (199 of 210 A.4 departments, seeds 1–30, had an exhibit there out of its reach).
  const NAMED = new RegExp(`\\b(in|at|into|inside) the (${Packs.list().flatMap(p => p.galleries.map(g => g.name.replace(/^The /, ''))).join('|')})\\b`);
  function claims(text) {
    const out = [];
    for (const re of PLACEMENT) { const m = re.exec(text); if (m) out.push(m[0].toLowerCase()); }
    const g = NAMED.exec(text);
    if (g) out.push(g[0].toLowerCase());
    return out;
  }
  test('the paragraph lint: a paragraph says where its exhibit or item stands only where population keeps it, and the sweep checks each such claim', () => {
    for (const p of Packs.list()) for (const r of [...p.species, p.centrepiece, ...p.items]) {
      const said = claims(r.paragraph), kept = CLAIMS[r.id] || [];
      assert.equal(json(said.filter(c => !kept.includes(c))), '[]', `${r.id}: "${r.paragraph}"`);
      assert.equal(json(kept.filter(c => !said.includes(c))), '[]', `${r.id}: a claim listed that it no longer makes`);
    }
    // Planted: the sample's spare's label, the samples' panel claims, and the old paragraphs.
    for (const [text, want] of [['Spare (a) of three. For the original, see the case at the end of this row.', 'see the case'],
      ['The overshoes are in the case by the north lectern.', 'in the case'], ['The case on the east wall holds tools.', 'on the east wall'],
      ['Between chimes the station travels its short rail at the side of the gallery and waits.', 'travels its short rail'],
      ['It keeps the same round, pausing at the same lecterns.', 'pausing at'], ['The original sat behind glass.', 'behind glass'],
      ['It still rings, and nobody in the Copying Room has ever slept through it.', 'in the copying room']]) {
      assert.ok(claims(text).includes(want), `${text}: ${json(claims(text))}`);
    }
    // And the sweep's check holds the two claims: A.4.4 out of its case, and M.11.12 with no
    // cabinet before it, are each caught.
    const X = loadCore(), chk = check(X), d = seed => ({ state: X.Dept.create(seed, 'A4', 3), seed, acc: 'A4', depth: 3 });
    const one = d(4), trustee = one.state.actors.find(a => a.sp === 'A4.4');
    assert.equal(chk.each(one), null);
    const fx = one.state.dept.fixtures.find(f => f.x === trustee.x && f.y === trustee.y);
    one.state.dept.tiles[fx.y] = one.state.dept.tiles[fx.y].slice(0, fx.x) + '.' + one.state.dept.tiles[fx.y].slice(fx.x + 1);
    one.state.dept.fixtures = one.state.dept.fixtures.filter(f => f !== fx);
    assert.match(chk.each(one), /A4\.3\.s2\.\d+ \(A4\.4\) is not in a case; A4\.3\.s2\.\d+: it is not under glass/);
    assert.equal(json(chk.claims), json(Object.keys(CLAIMS).sort()), 'the sweep checks every claim listed here');
    // M.11.12 waits for MOD-CHIME and ARCH-CLOCKWORK, so its claim is met with them ready.
    const Y = readyCore(), ychk = check(Y), m = { state: Y.Dept.create(4, 'M11', 3), seed: 4, acc: 'M11', depth: 3 };
    const st = m.state.actors.find(a => a.sp === 'M11.12');
    assert.equal(json([ychk.each(m), st.route.dir, m.state.dept.tiles[st.y + 1][st.x]]), json([null, 'S', 'f']));
    m.state.dept.tiles[st.y + 1] = m.state.dept.tiles[st.y + 1].slice(0, st.x) + '.' + m.state.dept.tiles[st.y + 1].slice(st.x + 1);
    assert.match(ychk.each(m), /M11\.3\.intro\.\d+: no cabinet in front of it \(S\)/);
  });

  // ---- The Orientation's records ----

  test('the Orientation\'s species and item, M.11.5 and M.11.7, are as it reads them', () => {
    assert.equal(State.fnv1a(json(Packs.species('M11', 'M11.5'))), 1812474125, 'M11.5 changed: test/orientation.test.js reads its line and label');
    assert.equal(State.fnv1a(json(Packs.get('M11').items.find(i => i.id === 'M11.7'))), 236175600, 'M11.7 changed: test/orientation.test.js reads it');
  });

  // ---- What D-LV6 will read, planted ----

  test('the sweep\'s check catches a Wader on the court\'s round seeing the open Intro doorway, and the Brooder\'s tether through the vestibule\'s wall without the south cabinets', () => {
    // The real packs pass: no Wader region reaches the safe zone, no tether does.
    const real = readyCore(), ok = check(real);
    for (let seed = 1; seed <= 21; seed++) assert.equal(ok.each({ state: real.Dept.create(seed, 'S9', depthOf(seed)), seed, acc: 'S9', depth: depthOf(seed) }), null, `S9 seed ${seed}`);
    assert.equal(json([ok.done(), ok.tally.wader, ok.tally.waderDepts]), json([null, 0, 21]));
    // A Wader moved into the court: its round passes the court's door on the Intro's entrance
    // row, from which it sees the doorway of the partition, at walk 8, once that door is open.
    const W = readyCore(), w = check(W), g = W.Packs.get('S9').galleries;
    g.find(x => x.key === 's2').contents.find(e => e.sp === 'S9.2').count = 1;
    g.find(x => x.key === 's1').contents.push({ sp: 'S9.2' });
    for (let seed = 1; seed <= 30; seed++) w.each({ state: W.Dept.create(seed, 'S9', depthOf(seed)), seed, acc: 'S9', depth: depthOf(seed) });
    assert.match(w.done() || '', /a Wader's wake region reaches the safe zone in \d+ of 30 S\.9 departments, over 5%/);
    // The Lamp Corridor's stretch row 10 plain again: the Brooder's tether, guarding a case on
    // the band room's north wall, reaches the vestibule's last row through the wall.
    const T = loadCore(), t = check(T), I = T.Packs.get('S9').intro;
    I.map = I.map.map((row, i) => (i === 10 ? '#.......|......' : row));
    let caught = 0;
    for (let seed = 1; seed <= 28; seed++) if (/tether reaches the safe zone/.test(t.each({ state: T.Dept.create(seed, 'S9', depthOf(seed)), seed, acc: 'S9', depth: depthOf(seed) }) || '')) caught++;
    assert.ok(caught > 0, 'the tether through the wall is never caught');
    const R = loadCore(), r = check(R);
    for (let seed = 1; seed <= 28; seed++) assert.equal(r.each({ state: R.Dept.create(seed, 'S9', depthOf(seed)), seed, acc: 'S9', depth: depthOf(seed) }), null, `S9 seed ${seed}`);
  });
};
