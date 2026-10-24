// M3's department core (BUILD.md §3.2, §4.1, §5.2, §5.5, §8.1, §8.3, §8.5): the state's
// parts, your starting kit and derived stats, actor and item uids, which species a
// department places, removing an exhibit, the shared placement streams, the mimic's case,
// the shard rule, the tile changes the rules may make, surfaces, the clock's reads, shared
// species, and the stubs Wave 1 fills. The expected figures are worked out here from
// BUILD.md's text, never from the rule code.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore(['tools/monkey.js']);
  const { Step, State, Setup, Dept, Kit, Cases, Clock, Surfaces, Packs, Labels, Layout, Grid, Actors, Rng, Registry, Roles, Monkey, N } = C;
  const json = x => JSON.stringify(x);
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const ACCS = ['S9', 'A4', 'M11'];
  const exhibits = s => s.actors.filter(a => a.uid !== 'you');
  const roomAt = (s, x, y) => s.dept.rooms.find(r => r.id === s.dept.roomOf[y][x]);

  test('a state has every part of §4.1, as plain data that survives a clone, in a room and in a department', () => {
    const TOP = ['v', 'coreHash', 'runId', 'seed', 'rng', 'tick', 'turn', 'options', 'run', 'dept', 'actors', 'items', 'you', 'causes', 'over', 'ui'];
    const RUN = ['grade', 'seals', 'knownSeals', 'deck', 'items', 'floor', 'slot', 'depth', 'sequence', 'offered', 'certificates', 'perks', 'collectionPicks'];
    const PARTS = ['clock', 'fixtures', 'surfaces', 'highlights', 'planRead', 'entryGrade', 'modules'];
    const DEPT = ['acc', 'pin', 'depth', 'programme', 'w', 'h', 'tiles', 'rooms', 'roomOf', 'entrance', 'exits', 'lectern', 'viewTile', 'ltour', 'seen'].concat(PARTS);
    const ITEM = ['uid', 'kind', 'ref', 'where', 'form', 'tier', 'level', 'prims', 'charges', 'max', 'rechargeAt', 'ck', 'seal', 'n', 'from'];
    const sorted = a => json(a.slice().sort());
    const room = Setup.room(1, { acc: 'T0', depth: 2, map: OPEN, you: [2, 2], exhibits: [] });
    for (const [s, where] of [[room, 'room'], [Dept.create(3, 'M11', 2), 'M11'], [Dept.create(4, 'A4', 5), 'A4']]) {
      assert.equal(sorted(Object.keys(s)), sorted(TOP), where);
      assert.equal(sorted(Object.keys(s.run)), sorted(RUN), where);
      for (const k of where === 'room' ? PARTS : DEPT) assert.ok(k in s.dept, `${where}: dept.${k}`);
      // The run: grade I, nothing known; the seals not yet shuffled (null) or shuffled as
      // {sol: [4], eph: [4]} (W1-CONSUMABLES); the deck's 8 counts, at most DECK's.
      const seals = s.run.seals, four = v => Array.isArray(v) && v.length === 4 && v.every(Number.isInteger);
      assert.ok(seals === null || (four(seals.sol) && four(seals.eph) && Object.keys(seals).length === 2), `${where}: run.seals ${json(seals)}`);
      assert.equal(json([s.run.grade, s.run.knownSeals, s.run.items, s.run.depth]), json([1, [], 0, s.dept.depth]), where);
      assert.ok(s.run.deck.length === 8 && s.run.deck.every((n, i) => Number.isInteger(n) && n >= 0 && n <= [20, 8, 10, 8, 14, 8, 8, 5][i]), `${where}: run.deck ${json(s.run.deck)}`);
      // The department's parts: empty in a room for tests; in a department, lists (cases,
      // staff doors and plaques, and the Highlights, come with W1-CASES, W1-KIT and W1-CONSUMABLES).
      if (where === 'room') {
        assert.equal(json(s.run.deck), json([20, 8, 10, 8, 14, 8, 8, 5]), 'a room for tests draws nothing from the deck');
        assert.equal(json([s.dept.fixtures, s.dept.surfaces, s.dept.highlights, s.dept.planRead, s.dept.entryGrade, s.dept.modules]), json([[], [], [], null, 1, []]), where);
      } else {
        assert.ok(Array.isArray(s.dept.fixtures) && Array.isArray(s.dept.highlights), where);
        assert.equal(json([s.dept.surfaces, s.dept.planRead, s.dept.entryGrade, s.dept.modules]), json([[], null, 1, []]), where);
      }
      assert.equal(json(s.you), json({ kit: { weapon: 'you.w', garment: 'you.g', curio: [null, null], instrument: null }, tote: [] }), where);
      for (const it of s.items) assert.equal(sorted(Object.keys(it)), sorted(ITEM), `${where}: ${it.uid}`);
      assert.equal(State.plainData(s), null, where);
      assert.equal(State.hash(State.clone(s)), State.hash(s), where);
    }
    // A department's rooms keep their role key and number; its clock is set from its tour length.
    const d = Dept.create(3, 'M11', 2), plan = Layout.generate('enfilade', 0, 3, { acc: 'M11', depth: 2 }).plan, nums = Layout.number(plan, 2);
    assert.equal(json(d.dept.rooms.map(r => [r.id, r.key, r.number])), json(plan.rooms.map(r => [r.id, r.key, nums[r.id] || 0])));
    const B = Math.round((250 * plan.ltour / 100 + 100) / 10) * 10, G = Math.max(60, Math.round(0.15 * B / 10) * 10);
    assert.equal(json(d.dept.clock), json({ B, G, stage: 0, count: 0, pausedSince: null, nightBells: 0, watch: { k: 0, back: null } }));
    assert.equal(room.dept.clock, null, 'no clock in a room unless the spec gives one');
  });

  test('your starting kit gives today\'s numbers, and Kit.derive follows §8.1 for every form, tier, grade and level', () => {
    // At the start: a T1 Balanced weapon and a T1 Standard garment, Acc 3, Eva 2, Padding 1, damage 2–6.
    for (const s of [Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [] }), ...ACCS.map(acc => Dept.create(2, acc, 3))]) {
      const y = s.actors[0];
      assert.equal(json([y.acc, y.eva, y.pad, y.dmin, y.dmax, y.weaponForm, y.reach, y.quiet, y.breaker]), json([3, 2, 1, 2, 6, 'balanced', false, 0, 0]));
      assert.equal(json(s.items.filter(i => i.uid.startsWith('you.')).map(i => [i.uid, i.kind, i.form, i.tier, i.level, i.where])),
        json([['you.w', 'weapon', 'balanced', 1, 0, { at: 'kit', slot: 'weapon' }], ['you.g', 'garment', 'standard', 1, 0, { at: 'kit', slot: 'garment' }]]));
    }
    // Each T1 form at grade I, as a room's kit and as Setup.you makes you: a Heavy weapon
    // needs grade II, so it is one grade short (−2 Acc).
    const T1 = { light: [5, 1, 4], balanced: [3, 2, 6], heavy: [0, 3, 8], reach: [3, 1, 4] };
    for (const [form, [acc, lo, hi]] of Object.entries(T1)) {
      const s = Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [], kit: { weapon: { form } } });
      for (const y of [s.actors[0], Setup.you(2, 2, form)]) assert.equal(json([y.acc, y.eva, y.pad, y.dmin, y.dmax, y.weaponForm, y.reach]), json([acc, 2, 1, lo, hi, form, form === 'reach']), form);
    }
    // §8.1, written out again: weapon damage and Acc by form; garment Padding and Eva by form;
    // grade needed 2t − 1 (one less for Light weapons, one more for Heavy); each grade short
    // −2 Acc (weapons) or −1 Padding (garments, never below 0); each level +1 damage, +1 Acc at
    // every even level, +1 Padding.
    const WEAPON = { light: [t => t, t => 3 * t + 1, 2, -1], balanced: [t => t + 1, t => 3 * t + 3, 0, 0], heavy: [t => t + 2, t => 4 * t + 4, -1, 1], reach: [t => t, t => 3 * t + 1, 0, 0] };
    const GARMENT = { light: [t => t - 1, 1, 0], standard: [t => t, 0, 0], heavy: [t => t + 1, -1, 1] };
    const s = Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [] }), w = s.items[0], g = s.items[1];
    let n = 0;
    for (let grade = 1; grade <= 7; grade++) for (let t = 1; t <= 4; t++) for (let L = 0; L <= 3; L++) {
      s.run.grade = grade;
      for (const [form, [lo, hi, acc, off]] of Object.entries(WEAPON)) {
        Object.assign(w, { form, tier: t, level: L });
        const short = Math.max(0, 2 * t - 1 + off - grade), d = Kit.derive(s);
        assert.equal(json([d.dmin, d.dmax, d.acc, d.weaponForm, d.reach]), json([lo(t) + L, hi(t) + L, 3 + acc + Math.floor(L / 2) - 2 * short, form, form === 'reach']), `${form} T${t} L${L} grade ${grade}`);
        n++;
      }
      for (const [form, [pad, eva, off]] of Object.entries(GARMENT)) {
        Object.assign(g, { form, tier: t, level: L });
        const short = Math.max(0, 2 * t - 1 + off - grade), d = Kit.derive(s);
        assert.equal(json([d.pad, d.eva]), json([Math.max(0, pad(t) + L - short), 2 + eva]), `${form} garment T${t} L${L} grade ${grade}`);
        n++;
      }
    }
    assert.equal(n, 7 * 4 * 4 * 7);
    // No garment: Padding 0, Eva 2. No weapon is an error: the weapon slot is never empty.
    s.you.kit.garment = null; assert.equal(json([Kit.derive(s).pad, Kit.derive(s).eva]), json([0, 2]));
    s.you.kit.weapon = null; assert.throws(() => Kit.derive(s), /no weapon/);
    // Your stats change at the end of a step, not when the kit changes (§8.1, D2.6): an
    // exhibit that strikes you during your action meets the old Padding. (The blows are read
    // from the events: combat.js calls its own hurt, so a wrapper on Combat.hurt sees nothing.)
    let blows = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const r = Setup.room(seed, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [{ sp: 'x', at: [3, 2], mode: 'hunting', stats: { hp: 50, acc: 100, eva: 0, pad: 0, dmin: 5, dmax: 5 } }] });
      r.actors[0].hp = r.actors[0].maxHp = 999;
      r.items[1].tier = 2; r.run.grade = 3;
      assert.equal(r.actors[0].pad, 1, 'not yet');
      const pads = Step.step(r, { a: 'wait' }).filter(e => e.k === 'damaged' && e.who === 'you').map(e => e.cause.pad);
      blows += pads.length;
      assert.ok(pads.every(p => p === 1), `seed ${seed}: struck against the old Padding, not ${pads}`);
      assert.equal(r.actors[0].pad, 2, 'settled at the end of the step');
    }
    assert.ok(blows > 0, 'the exhibit struck you during your action');
  });

  test('actor uids are <acc>.<depth>.<roleKey>.<n>, n counted per room in placement order; your items are you.w and you.g', () => {
    let checked = 0;
    for (const acc of ACCS) for (const depth of [1, 4, 7]) for (const seed of [1, 2, 3]) {
      const s = Dept.create(seed, acc, depth), count = {};
      for (const a of exhibits(s)) {
        const key = roomAt(s, a.x, a.y).key;
        count[key] = (count[key] || 0) + 1;
        assert.equal(a.uid, `${acc}.${depth}.${key}.${count[key]}`, `${acc} d${depth} seed ${seed}`);
        assert.ok(/^[a-z]+\d*$/.test(key), `a role key has no dots: ${key}`);
        checked++;
      }
      assert.equal(new Set(s.actors.map(a => a.uid)).size, s.actors.length, 'uids are unique');
    }
    assert.ok(checked > 100, `${checked} uids`);
    // A room for tests counts per room key too, and a spec may name a uid.
    const r = Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: [1, 1], exhibits: [
      { sp: 'a', at: [3, 1], stats: Roles.stats('fodder', 3) }, { sp: 'b', at: [5, 1], room: 's2', stats: Roles.stats('fodder', 3) },
      { sp: 'c', at: [3, 3], stats: Roles.stats('fodder', 3) }, { sp: 'd', at: [5, 3], room: 's2', stats: Roles.stats('fodder', 3) },
      { sp: 'e', at: [6, 4], uid: 'named.one', stats: Roles.stats('fodder', 3) }] });
    assert.equal(json(r.actors.map(a => a.uid)), json(['you', 'T0.3.room.1', 'T0.3.s2.1', 'T0.3.room.2', 'T0.3.s2.2', 'named.one']));
  });

  test('a department places one of each species whose archetype M3 builds, a swarm as its first count of bodies, and no Centrepiece', () => {
    const placedEver = new Set();
    for (const acc of ACCS) for (const depth of [1, 3, 5, 7]) for (const seed of [1, 2, 3, 4]) {
      const s = Dept.create(seed, acc, depth), pack = Packs.get(acc);
      const m3 = pack.species.filter(sp => Registry.ARCHETYPES[sp.archetype].built === 'M3').map(sp => sp.id);
      for (const a of exhibits(s)) {
        assert.ok(m3.includes(a.sp), `${acc}: ${a.sp} is not an M3 species of the pack`);
        assert.equal(Registry.ARCHETYPES[a.arch].built, 'M3');
        assert.notEqual(a.sp, pack.centrepiece.id);
        assert.equal(a.mode, 'dormant');
        assert.equal(json(a.home), json([a.x, a.y]), 'its home is where it stands');
        const sp = pack.species.find(q => q.id === a.sp);
        assert.equal(json([a.arch, a.role, a.mods, a.trigger, a.group, a.modParams]), json([sp.archetype, sp.role, sp.modifiers || [], sp.trigger || null, sp.group || null, sp.modParams || {}]));
        placedEver.add(acc + ':' + a.sp);
      }
      for (const sp of pack.species.filter(q => m3.includes(q.id) && q.archetype !== 'mote_swarm')) assert.ok(exhibits(s).filter(a => a.sp === sp.id).length <= 1);
      // A swarm: SWARM_BODIES[0] bodies in one room, each further body on the nearest free
      // floor tiles to the first (no nearer free tile of the room left unused).
      const swarm = exhibits(s).filter(a => a.arch === 'mote_swarm');
      if (!swarm.length) continue;
      assert.equal(swarm.length, N.SWARM_BODIES[0]);
      const [first, ...rest] = swarm, rm = roomAt(s, first.x, first.y), d = Grid.distances(s.dept, [s.dept.entrance], 999);
      const cheb = (a, x, y) => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)), far = Math.max(...rest.map(b => cheb(first, b.x, b.y)));
      for (const b of rest) assert.equal(roomAt(s, b.x, b.y), rm);
      for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) {
        if (s.dept.tiles[y][x] !== '.' || roomAt(s, x, y) !== rm || d[y * s.dept.w + x] <= 8 || s.actors.some(a => a.x === x && a.y === y)) continue;
        assert.ok(cheb(first, x, y) >= far, `${acc} d${depth} seed ${seed}: a free tile at ${x},${y} is nearer the swarm than a body`);
      }
    }
    for (const acc of ACCS) for (const sp of Packs.get(acc).species) if (Registry.ARCHETYPES[sp.archetype].built === 'M3') assert.ok(placedEver.has(acc + ':' + sp.id), `${sp.id} is never placed`);
  });

  // A core with planted stand-ins for the Wave 1 placement functions: a mimic disguises itself
  // at init (as ARCH-C's will), and the stand-ins put one item in each section on its populate
  // stream, on a floor tile no actor stands on, gone or not (as KIT's will).
  function planted() {
    const X = loadCore(), calls = [];
    X.Archetypes.init = (state, a) => { calls.push('init ' + a.uid); if (a.arch === 'mimic_vitrine') X.Cases.disguise(state, a); };
    const items = tag => (state, base, pop) => {
      calls.push(tag);
      for (const rm of state.dept.rooms) {
        if (rm.role !== 'section') continue;
        const tiles = [];
        for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) if (state.dept.tiles[y][x] === '.' && !state.actors.some(a => X.Actors.covers(a, x, y))) tiles.push([x, y]);
        if (!tiles.length) continue;
        const [x, y] = X.Rng.stream(pop, `${base}/room/${rm.key}/populate`).pick(tiles);
        state.items.push(X.Kit.item({ uid: `${state.dept.acc}.${state.dept.depth}.${rm.key}.i${tag === 'kit' ? 1 : 2}`, kind: tag === 'kit' ? 'curio' : 'consumable', where: { at: 'floor', x, y } }));
      }
    };
    X.Kit.standIn = items('kit'); X.Consumables.standIn = items('consumables');
    return { X, calls };
  }

  test('removing an exhibit (without) leaves every other exhibit\'s uid, tile and first 50 draws, and every other fixture and item, as they were', () => {
    const { X, calls } = planted();
    let removals = 0;
    const draws = (s, uid) => { const c = X.State.clone(s); return ['combat/', 'ai/'].map(p => { const r = X.Rng.stream(c, p + uid); return Array.from({ length: 50 }, () => r.u32()); }); };
    for (const [acc, seed, depth] of [['S9', 1, 2], ['S9', 5, 4], ['A4', 2, 3], ['M11', 3, 6]]) {
      const base = X.Dept.create(seed, acc, depth);
      assert.ok(base.items.length > 2 && (acc !== 'S9' || base.dept.fixtures.some(f => f.mimic)), `${acc}: the planted stand-ins placed items and the mimic's case`);
      for (const gone of exhibits(base)) {
        calls.length = 0;
        const s = X.Dept.create(seed, acc, depth, { without: [gone.uid] });
        removals++;
        assert.ok(!calls.includes('init ' + gone.uid), 'a removed exhibit is never initialised');
        assert.equal(json(s.actors.map(a => [a.uid, a.x, a.y, a.gone])), json(base.actors.map(a => [a.uid, a.x, a.y, a.uid === gone.uid ? 1 : 0])), `${acc}: without ${gone.uid}`);
        assert.equal(Actors.byUid(s, gone.uid).gone, 1);
        for (const a of exhibits(base)) if (a.uid !== gone.uid) assert.equal(json(draws(s, a.uid)), json(draws(base, a.uid)), `${a.uid}'s streams, without ${gone.uid}`);
        assert.equal(json(s.dept.fixtures), json(base.dept.fixtures.filter(f => f.mimic !== gone.uid)), `fixtures without ${gone.uid}`);
        assert.equal(json(s.items), json(base.items), `items without ${gone.uid}`);
        const disguised = base.dept.fixtures.find(f => f.mimic === gone.uid);
        for (let y = 0; y < s.dept.h; y++) assert.equal(s.dept.tiles[y], disguised && disguised.y === y ? base.dept.tiles[y].slice(0, disguised.x) + '.' + base.dept.tiles[y].slice(disguised.x + 1) : base.dept.tiles[y]);
      }
    }
    assert.ok(removals >= 20, `${removals} removals`);
    // In a room for tests, likewise: the others keep their uids, and the removed one is gone
    // before any archetype's init.
    calls.length = 0;
    const spec = { acc: 'T0', depth: 1, map: OPEN, you: [1, 1], exhibits: [3, 5, 7].map(x => ({ sp: 'x', at: [x, 3], stats: Roles.stats('fodder', 1) })) };
    const r = X.Setup.room(1, spec, { without: ['T0.1.room.2'] });
    assert.equal(json(r.actors.map(a => [a.uid, a.gone])), json([['you', 0], ['T0.1.room.1', 0], ['T0.1.room.2', 1], ['T0.1.room.3', 0]]));
    assert.equal(json(calls), json(['init T0.1.room.1', 'init T0.1.room.3']));
  });

  test('the three placement calls share one local holder, so a room\'s populate stream runs on from cases to items to consumables', () => {
    const X = loadCore(), seen = [];
    const rec = name => (state, a, b, c) => {
      const [base, pop] = name === 'cases' ? [b, c] : [a, b], key = state.dept.rooms.find(r => r.role === 'section').key;
      seen.push({ name, base, pop, draw: X.Rng.stream(pop, `${base}/room/${key}/populate`).u32(), path: `${base}/room/${key}/populate` });
    };
    X.Cases.place = rec('cases'); X.Kit.standIn = rec('kit'); X.Consumables.standIn = rec('consumables');
    const s = X.Dept.create(3, 'M11', 2), base = Layout.generate('enfilade', 0, 3, { acc: 'M11', depth: 2 }).base;
    assert.equal(json(seen.map(x => x.name)), json(['cases', 'kit', 'consumables']), 'in this order');
    assert.ok(seen.every(x => x.pop === seen[0].pop && x.base === base), 'one holder and one base');
    assert.match(base, /^layout\/M11@\d+\/d2\/a\d$/);
    const fresh = Rng.stream({ seed: 3, rng: {} }, seen[0].path);
    assert.equal(json(seen.map(x => x.draw)), json([fresh.u32(), fresh.u32(), fresh.u32()]), 'the first draws of one stream, in turn');
    assert.equal(new Set(seen.map(x => x.draw)).size, 3, 'the first case draw and the first item draw differ');
    assert.ok(!Object.keys(s.rng).some(k => k.startsWith('layout/')), 'placement streams are local, never stored');
    // The layout itself is unchanged by naming its base: the plan holds no base.
    const g = Layout.generate('enfilade', 0, 3, { acc: 'M11', depth: 2 });
    assert.ok(!('base' in g.plan) && g.base === `layout/M11@${Layout.PIN}/d2/a${g.attempt}`);
  });

  test('a mimic\'s case has every field a real case has, drawn as a real case\'s are on the mimic\'s own stream, with no accession number', () => {
    // A core in which no archetype's init runs, so the test makes the disguise itself, as
    // W1-ARCH-C's mimic init will.
    const { Setup, Dept, Cases } = (() => { const X = loadCore(); X.Archetypes.init = () => {}; return X; })();
    const FIELDS = ['k', 'x', 'y', 'room', 'num', 'glass', 'lock', 'hits', 'st', 'loan', 'holds', 'mimic'];
    // A real case, as W1-CASES will place one, has the same fields.
    assert.equal(json(Object.keys(Cases.make({ x: 1, y: 1 })).sort()), json(FIELDS.slice().sort()));
    const tally = { security12: 0, loans: 0, n: 0 };
    for (let seed = 1; seed <= 300; seed++) {
      const depth = 1 + (seed % 7), s = Setup.room(seed, { acc: 'T0', depth, map: OPEN, you: [1, 1], exhibits: [{ sp: 'S9.5', arch: 'mimic_vitrine', at: [4, 3], stats: Roles.stats('ambusher', depth) }] });
      const a = s.actors[1], before = Object.keys(s.rng), f = Cases.disguise(s, a);
      assert.equal(json(Object.keys(f).sort()), json(FIELDS.slice().sort()));
      assert.equal(json([f.k, f.x, f.y, f.num, f.hits, f.st, f.holds, f.mimic, typeof f.loan]), json(['case', 4, 3, null, 0, 'shut', null, a.uid, 'boolean']));
      assert.equal(s.dept.fixtures[0], f); assert.equal(s.dept.tiles[3][4], 'v');
      assert.ok(Cases.encased(s, a), 'it stands in its case');
      // §8.3's glass grades and lock rule, written out again: glass by depth's mix (no
      // Security before depth 3); the lock within the glass's range and I to depth + 1, or
      // the range's minimum if they do not meet.
      const range = [[1, 2], [2, 4], [4, 7]][f.glass - 1], hi = Math.min(range[1], depth + 1);
      assert.ok(f.glass >= 1 && f.glass <= 3);
      if (depth <= 2 && f.glass === 3) tally.security12++;
      assert.ok(hi < range[0] ? f.lock === range[0] : f.lock >= range[0] && f.lock <= hi, `glass ${f.glass} lock ${f.lock} at depth ${depth}`);
      // Its draws are on its own ai/<uid> stream: glass, lock (if the ranges meet), loan.
      assert.equal(json(Object.keys(s.rng).filter(k => !before.includes(k))), json(['ai/' + a.uid]));
      const q = { seed, rng: {} }, t = Rng.stream(q, 'ai/' + a.uid), drawn = hi < range[0] ? 2 : 3;
      for (let i = 0; i < drawn; i++) t.u32();
      assert.equal(s.rng['ai/' + a.uid], q.rng['ai/' + a.uid], 'glass, the lock if the ranges meet, and loan: nothing more');
      tally.loans += f.loan ? 1 : 0; tally.n++;
      // Revealed: the case says so and the floor comes back.
      assert.equal(Cases.reveal(s, a), f);
      assert.equal(json([f.st, s.dept.tiles[3][4], Cases.at(s, 4, 3) === f]), json(['revealed', '.', true]));
    }
    assert.equal(tally.security12, 0, 'no Security glass at depths 1–2');
    assert.ok(tally.loans > 20 && tally.loans < 85, `${tally.loans} of ${tally.n} on loan, about one in six`);
    // Its room is its room's role key, in a department.
    const d = Dept.create(4, 'S9', 1), mimic = d.actors.find(a => a.arch === 'mimic_vitrine'), f = Cases.disguise(d, mimic);
    assert.equal(f.room, roomAt(d, mimic.x, mimic.y).key);
    // Only a floor tile becomes a case.
    const w = Setup.room(1, { acc: 'T0', depth: 1, map: ['#####', '#.,.#', '#####'], you: [1, 1], exhibits: [{ sp: 'm', arch: 'mimic_vitrine', at: [2, 1], stats: Roles.stats('ambusher', 1) }] });
    assert.throws(() => Cases.disguise(w, w.actors[1]), /not on a floor tile/);
    assert.equal(Cases.reveal(w, w.actors[1]), null, 'never disguised');
  });

  test('shards land on the tile itself if it is floor or archway, else its first such neighbour in direction order, else nowhere', () => {
    const OK = new Set(['.', ',']), NEVER = new Set(['+', "'", 'S', 's', 'E', 'X', 'b', 'v', 'u', 'k', 'x', '#', 'p', 'l', 'w']);
    const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
    const maps = [Setup.room(1, { acc: 'T0', depth: 1, map: ['#######', "#E+'.X#", '#b,v.S#', '#.x.s.#', '#######'], you: [4, 1], exhibits: [] })];
    for (const acc of ACCS) for (const seed of [1, 2]) maps.push(Dept.create(seed, acc, 2));
    let some = 0, none = 0, moved = 0;
    for (const s of maps) {
      const m = s.dept, ch = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? '#' : m.tiles[y][x];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        let want = OK.has(ch(x, y)) ? [x, y] : null;
        if (!want) for (const [dx, dy] of DIRS) if (OK.has(ch(x + dx, y + dy))) { want = [x + dx, y + dy]; break; }
        const got = Cases.shardTile(s, x, y);
        assert.equal(json(got), json(want), `${m.acc} ${x},${y} (${ch(x, y)})`);
        if (got) { some++; assert.ok(!NEVER.has(ch(got[0], got[1]))); if (got[0] !== x || got[1] !== y) moved++; } else none++;
      }
    }
    assert.ok(some > 1000 && none > 20 && moved > 500, `${some} placed, ${moved} moved to a neighbour, ${none} nowhere`);
  });

  test('over monkey runs, the only tile changes are §4.1\'s: doors opening and closing, cases opening, breaking or revealed, and shards', () => {
    const ALLOWED = new Set(["+>'", "'>+", 'S>s', 's>S', 'v>u', 'v>k', 'v>.', '.>x', ',>x']);
    let steps = 0, changes = 0;
    const watch = make => {
      let prev = null, prevState = null;
      Monkey.run(7, 1000, {
        make: seed => { const s = make(seed); s.actors[0].hp = s.actors[0].maxHp = 999; return s; },
        check(state) {
          steps++;
          if (prevState === state) for (let y = 0; y < state.dept.h; y++) for (let x = 0; x < state.dept.w; x++) {
            const a = prev[y][x], b = state.dept.tiles[y][x];
            if (a !== b) { changes++; assert.ok(ALLOWED.has(a + '>' + b), `${state.dept.acc} ${x},${y}: ${a} became ${b}`); }
          }
          prev = state.dept.tiles.slice(); prevState = state;
        },
      });
    };
    watch(seed => C.TestRoom.create(seed));
    for (const acc of ACCS) watch(seed => Dept.create(seed, acc, 3));
    assert.equal(steps, 4000);
    assert.ok(changes > 0, 'some tiles changed');
  });

  test('a surface acts at the next N turn boundaries and is cleared at the one after; a sight-blocking one blocks sight across its square while it lies', () => {
    const map = ['###########', '#.........#', '#.........#', '#.........#', '###########'];
    const s = Setup.room(1, { acc: 'T0', depth: 1, map, you: [1, 2], exhibits: [] });
    assert.ok(Grid.los(s.dept, 1, 2, 9, 2));
    const d = Surfaces.add(s, 'dust', 5, 2, 3, 3, 'T0.1.room.1', []);
    assert.equal(json(d), json({ kind: 'dust', x: 5, y: 2, size: 3, until: 4, by: 'T0.1.room.1' }), 'laid in turn 0 for 3 turns: until turn 4');
    assert.equal(json(Surfaces.at(s, 4, 1)), json([d])); assert.equal(json(Surfaces.at(s, 3, 1)), '[]');
    assert.ok(!Grid.los(s.dept, 1, 2, 9, 2) && !Grid.los(s.dept, 9, 2, 1, 2), 'blocked both ways');
    const there = [];
    for (let t = 1; t <= 5; t++) { Step.step(s, { a: 'wait' }); there.push(s.dept.surfaces.length); }
    assert.equal(json(there), json([1, 1, 1, 0, 0]), 'there at the boundaries of turns 1–3, cleared at turn 4');
    assert.ok(Grid.los(s.dept, 1, 2, 9, 2));
    assert.throws(() => Surfaces.add(s, 'fog', 1, 1, 3, 3, null, []), /no surface fog/);
    assert.throws(() => Surfaces.add(s, 'dust', 1, 1, 0, 3, null, []));
  });

  test('the clock\'s reads: its stage from the count, sealed, pip decay before the bell, and regeneration\'s units by stage', () => {
    const c = Clock.init(60);
    assert.equal(json([c.B, c.G]), json([250, 60]), 'B = round10(2.5 × 60 + 100), G = max(60, round10(0.15 × B))');
    assert.equal(json([Clock.init(0, { B: 10, G: 5 }).stage, Clock.init(0, { B: 10, G: 5, count: 10 }).stage, Clock.init(0, { B: 10, G: 5, count: 15 }).stage]), json([0, 1, 2]));
    const s = Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [], clock: { B: 10, G: 5 } });
    assert.equal(json([s.dept.clock.B, s.dept.clock.G, s.dept.clock.count]), json([10, 5, 0]));
    const read = () => [Clock.stage(s), Clock.sealed(s), Clock.pipsDecay(s), Clock.regenRate(s)];
    const rows = [];
    for (const stage of [0, 1, 2]) { s.dept.clock.stage = stage; rows.push(read()); }
    s.dept.clock.stage = 0; s.dept.clock.pausedSince = 3; rows.push(read());
    assert.equal(json(rows), json([[0, false, true, 2], [1, false, false, 1], [2, false, false, 0], [0, true, true, 0]]));
    const none = Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [] });
    assert.equal(json([Clock.stage(none), Clock.sealed(none), Clock.pipsDecay(none), Clock.regenRate(none)]), json([0, false, true, 2]));
  });

  test('a room for tests takes fixtures, items, your kit, a clock, an entrance and exits and your grade; awake exhibits get their story without an event', () => {
    const f = Cases.make({ x: 4, y: 1, room: 'room', num: '101.1', glass: 2, lock: 3 });
    const s = Setup.room(1, { acc: 'T0', depth: 2, map: ['#########', '#...v...#', '#.......#', '#########'], you: [1, 1], exhibits: [
      { sp: 'x', at: [6, 2], mode: 'hunting', stats: Roles.stats('fodder', 2) }, { sp: 'y', at: [2, 2], mode: 'dormant', stats: Roles.stats('fodder', 2) }],
      fixtures: [f], items: [{ uid: 'T0.2.room.i1', kind: 'curio', where: { at: 'floor', x: 3, y: 2 }, prims: [{ id: 'acc', cls: 'S' }] }],
      kit: { weapon: { form: 'heavy', tier: 2 }, garment: { form: 'light', level: 1 } }, clock: { ltour: 60 }, entrance: [1, 1], exits: [[7, 2]], grade: 3 });
    assert.equal(json(s.dept.fixtures), json([f])); assert.notEqual(s.dept.fixtures[0], f, 'copied');
    assert.equal(json(s.items.map(i => [i.uid, i.kind, i.form, i.tier, i.level])), json([['you.w', 'weapon', 'heavy', 2, 0], ['you.g', 'garment', 'light', 1, 1], ['T0.2.room.i1', 'curio', null, null, 0]]));
    assert.equal(json(s.items[2].prims), json([{ id: 'acc', cls: 'S' }]));
    // Heavy T2 at grade 3: needs 4, one short; Light garment T1 level 1 needs 1: Padding 0 + 1.
    const y = s.actors[0];
    assert.equal(json([y.dmin, y.dmax, y.acc, y.pad, y.eva, s.run.grade, s.dept.entryGrade]), json([4, 12, 3 - 1 - 2, 1, 3, 3, 3]));
    assert.equal(json([s.dept.clock.B, s.dept.entrance, s.dept.exits]), json([250, [1, 1], [[7, 2]]]));
    const [, hunter, sleeper] = s.actors;
    assert.equal(json([hunter.woke, hunter.hunted, hunter.next]), json([{ turn: 0, cause: { k: 'awake' } }, { turn: 0, cause: { k: 'awake' } }, 0]), 'made awake: its story, no beat');
    assert.equal(sleeper.woke, null);
  });

  test('shared species: the Night Watchman is found by its id wherever it appears, and its Behaviour line fills at every depth', () => {
    const w = Packs.shared('night_watchman');
    assert.ok(w && Packs.sharedList().includes(w));
    assert.equal(json([w.archetype, w.role, w.trigger, w.sprite]), json(['night_watchman', 'warden', 'awake', 'night_watchman']));
    assert.equal(Packs.shared('nobody'), null);
    const X = loadCore();
    assert.throws(() => X.Packs.addShared({ id: 'night_watchman' }), /added twice/);
    // speciesFor: the department's own species, then its Centrepiece, then a shared one.
    const s = Dept.create(2, 'M11', 3), stats = Roles.stats('warden', 3);
    const a = Actors.spawn(s, Object.assign({}, stats, { uid: 'M11.3.watch.1', sp: 'night_watchman', arch: 'night_watchman', x: s.actors[0].x + 1, y: s.actors[0].y, mode: 'hunting', maxHp: stats.hp }));
    assert.equal(Packs.speciesFor(s, a), w); assert.equal(Labels.speciesOf(s, a), w);
    assert.equal(Packs.speciesFor(s, s.actors[1]), Packs.species('M11', s.actors[1].sp));
    assert.equal(Packs.speciesFor(s, { sp: 'M11.11' }), Packs.get('M11').centrepiece);
    assert.equal(Packs.speciesFor(s, s.actors[0]), null);
    assert.equal(Labels.of(s, a.uid).title, 'The Night Watchman');
    for (let depth = 1; depth <= 7; depth++) {
      const line = C.Clauses.line(w, { depth }), r = Roles.stats('warden', depth), dmg = r.dmin === r.dmax ? String(r.dmin) : `${r.dmin}–${r.dmax}`;
      assert.ok(line.includes(`strikes from beside you for ${dmg}`) && line.includes('It never sleeps.') && !/undefined|\{/.test(line), line);
    }
  });

  test('the pack item schema: each pack has an item, its primitives in the registry with a class S, M or L', () => {
    for (const p of Packs.list()) {
      assert.ok(p.items && p.items.length >= 1, `${p.acc} has an item`);
      for (const it of p.items) {
        assert.ok(['weapon', 'garment', 'curio', 'instrument'].includes(it.kind), it.id);
        assert.ok(it.id.startsWith(p.acc + '.') && it.name && it.tomb && it.tomb.maker && typeof it.paragraph === 'string', it.id);
        if (it.kind === 'weapon') assert.ok(['light', 'balanced', 'heavy', 'reach'].includes(it.form), it.id);
        if (it.kind === 'garment') assert.ok(['light', 'standard', 'heavy'].includes(it.form), it.id);
        if (it.kind === 'instrument') assert.ok(Registry.INSTRUMENTS[it.instrument], it.id);
        for (const pr of it.prims) assert.ok(Registry.ITEM_PRIMS[pr.id] && ['S', 'M', 'L'].includes(pr.cls), `${it.id}: ${json(pr)}`);
        assert.ok(!('tier' in it), `${it.id}: tier comes from depth, never from the pack`);
      }
    }
  });

  // A stub's contract is its name and signature until its owner fills it (plan A17: only the
  // M4 hooks stay neutral through M3, and none of them is in this file).
  test('the stubs Wave 1 fills are present and named, and the actions they own have handlers', () => {
    const X = loadCore();
    const NAMED = [
      ['Cases', 'place', null], ['Cases', 'touch', null], ['Cases', 'dissolve', 4], ['Cases', 'release', null], ['Cases', 'enter', null], ['Cases', 'staffGrade', null],
      ['Cases', 'reach', null], ['Cases', 'view', null], ['Cases', 'describe', null], ['Cases', 'highlightOk', null], ['Cases', 'openCost', null],
      ['Kit', 'recharge', null], ['Kit', 'standIn', null], ['Kit', 'settle', null], ['Kit', 'ringDelta', null], ['Kit', 'useLegal', null], ['Kit', 'useAction', null],
      ['Kit', 'useCandidates', 1], ['Kit', 'addToTote', null], ['Kit', 'targets', null], ['Kit', 'describe', null], ['Kit', 'view', null],
      ['Consumables', 'startRun', null], ['Consumables', 'standIn', null], ['Consumables', 'useLegal', null], ['Consumables', 'useAction', null],
      ['Consumables', 'useCandidates', 1], ['Consumables', 'known', null], ['Consumables', 'name', null], ['Consumables', 'targets', null], ['Consumables', 'view', null],
      ['ClockRules', 'boundary', null], ['ClockRules', 'fell', null], ['ClockRules', 'nearestSleepers', null], ['ClockRules', 'spawnWatchman', null], ['Clock', 'view', null],
      ['Labels', 'ofCase', null], ['Labels', 'ofItem', null], ['Labels', 'ofPlaque', null], ['Labels', 'ofStaffDoor', null], ['Labels', 'you', null],
    ];
    for (const [ns, fn, n] of NAMED) {
      assert.equal(typeof X[ns][fn], 'function', `${ns}.${fn}`);
      if (n !== null) assert.equal(X[ns][fn].length, n, `${ns}.${fn} takes ${n} arguments`);
    }
    // Solvent's cause, as W1-CONSUMABLES builds it and Cases.dissolve passes on to glass_broke.
    assert.equal(X.Causes.check({ k: 'glass_broke', turn: 1, tick: 100, by: 'you', x: 1, y: 1, glass: 1, shards: [], released: null, cause: { k: 'solvent', by: 'you', item: 'T0.1.room.i1' } }), null);
    const s = X.Dept.create(2, 'S9', 2);
    for (const id of ['open', 'bash', 'take', 'drop', 'equip', 'unequip', 'throw', 'read', 'choose', 'leave']) {
      const hd = X.Actions.get(id);
      assert.ok(hd && typeof hd.legal === 'function' && typeof hd.apply === 'function', id);
      assert.ok(hd.candidates(s).length > 1, `${id} has candidates`);
    }
  });

  // Until the department golden runs of Wave 3 (§3.5), this is where a department's own
  // code (cases, kit, consumables, surfaces, the clock) is held to §3.1 and §3.5 step by step.
  test('a department is clone-stable and plain data after every step: a monkey with a clone each step gives the same hashes', () => {
    let runs = 0;
    for (const acc of ACCS) for (const depth of [2, 5]) {
      const make = seed => { const s = Dept.create(seed, acc, depth); s.actors[0].hp = s.actors[0].maxHp = 999; return s; };
      // The hash every 10 steps (a difference, once there, stays) and plain data every step.
      const hashes = clone => {
        const out = [];
        Monkey.run(depth, 300, { make, cloneEachStep: clone, check(state, i) {
          if (!clone) { const p = State.plainData(state); assert.equal(p, null, `${acc} d${depth} step ${i}: ${p}`); }
          if (i % 10 === 0) out.push(State.hash(state));
        } });
        return out;
      };
      const a = hashes(false), b = hashes(true);
      const at = a.findIndex((h, i) => h !== b[i]);
      assert.equal(at, -1, `${acc} at depth ${depth}: a clone after every step differs by step ${10 * (at + 1)}`);
      runs++;
    }
    assert.equal(runs, 6);
  });
};
