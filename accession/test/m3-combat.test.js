// M3 W1-COMBAT: blows (BUILD.md §8.1). Criterion 1 of §11 M3 (the shown hit chance is the
// number of d100 faces that hit, and the rolls fall inside the Wilson interval); surprise by
// mode for every kind of blow; Light ×1.5 for melee only; Reach's geometry; the order inside
// one blow; ally_hit before the blow's noise; adjustDamage seeing where a blow came from;
// invulnerable runs; damage always waking, swept over every pack species at depths 1–7; and
// the combat invariants over monkeys in the test room and the three departments.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { Step, State, Setup, N, Combat, Actors, Rng, Roles, Registry, Causes, Text, Packs, Grid, Dept, TestRoom, Archetypes, Specials } = C;
  const Stats = require(path.join(root, 'tools/stats.js'));
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const json = JSON.stringify;
  const OPEN = ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'];
  const DUMMY = { hp: 30, acc: 2, eva: 1, pad: 0, dmin: 1, dmax: 4 };
  const ex = (at, more) => Object.assign({ sp: 'dummy', at, mode: 'hunting', stats: Object.assign({}, DUMMY) }, more);
  const room = (X, map, you, exhibits, more, options) => X.Setup.room(1, Object.assign({ acc: 'T0', depth: 1, map, you, exhibits }, more || {}), options);
  const withForm = form => ({ kit: { weapon: { form, tier: 1, level: 0 }, garment: { form: 'standard', tier: 1, level: 0 } } });
  const kinds = ev => ev.map(e => e.k);
  // Every event's cause passes its schema (§3.4).
  const checked = ev => { for (const e of ev) { const bad = Causes.check(e); assert.equal(bad, null, json(e)); } return ev; };

  test('criterion 1: for every Acc − Eva from −30 to +30 and each modifier set, the chance shown is the number of d100 faces that hit, and 10,000 rolls at each chance lie inside the 99.9% Wilson interval', () => {
    const held = id => [{ id, until: 99, turns: null, from: 0 }];
    // The slice's modifier sets (§8.1): none, a fixed target, a dazed attacker, and both.
    const SETS = [
      { name: '0', fixed: false, dazed: false, mod: 0 },
      { name: '+20', fixed: true, dazed: false, mod: 20 },
      { name: '−20', fixed: false, dazed: true, mod: -20 },
      { name: '+20 − 20', fixed: true, dazed: true, mod: 0 },
    ];
    const chances = new Set();
    let cases = 0;
    for (let diff = -30; diff <= 30; diff++) for (const set of SETS) for (const eva of [0, 3]) {
      const att = { acc: diff + eva, eva: 0, statuses: set.dazed ? held('dazed') : [] };
      const def = { acc: 0, eva, statuses: set.fixed ? held('fixed') : [] };
      const chance = Combat.hitChance(att, def);
      // §8.1 written out again: clamp(75 + 5 × (Acc − Eva) + mods, 10, 95).
      assert.equal(chance, Math.min(95, Math.max(10, 75 + 5 * diff + set.mod)), `Acc − Eva ${diff}, mods ${set.name}`);
      let faces = 0;
      for (let r = 1; r <= 100; r++) if (Combat.hits(r, chance)) faces++;
      assert.equal(faces, chance, `${chance}%: ${faces} faces hit`);
      // An instrument's bolt is made with the Acc it gives (how.acc), not the attacker's.
      assert.equal(Combat.hitChance({ acc: -99, eva: 0, statuses: att.statuses }, def, { acc: att.acc }), chance);
      chances.add(chance);
      cases++;
    }
    // The rolls: 10,000 on one fixed stream for each distinct chance.
    const rng = Rng.stream({ seed: 20261024, rng: {} }, 'combat/test'), outside = [];
    let K = 0;
    for (const chance of [...chances].sort((a, b) => a - b)) {
      let k = 0;
      for (let i = 0; i < 10000; i++) { const r = Combat.rollHit(rng, chance); assert.equal(r.hit, Combat.hits(r.roll, chance)); if (r.hit) k++; }
      const w = Stats.wilson(k, 10000, Stats.Z999);
      K++;
      if (!(w.lo <= chance / 100 && chance / 100 <= w.hi)) outside.push(`${chance}%: ${k} of 10,000 hit, interval ${w.lo.toFixed(4)}–${w.hi.toFixed(4)}`);
    }
    console.log(`  criterion 1: ${cases} cases, ${K} distinct chances, ${K} Wilson intervals at z = ${Stats.Z999.toFixed(4)}, ${outside.length} outside`);
    assert.equal(K, 18, 'every chance from 10% to 95% in steps of 5');
    assert.deepEqual(outside, [], 'a chance whose rolls fall outside its 99.9% interval is a finding (§10.3)');
  });

  test('a roll is one d100 on the attacker\'s stream, and a real blow\'s cause shows the chance hitChance gives', () => {
    const a = { seed: 7, rng: {} }, b = { seed: 7, rng: {} };
    const ra = Rng.stream(a, 'combat/x'), rb = Rng.stream(b, 'combat/x');
    for (let i = 0; i < 50; i++) { const r = Combat.rollHit(ra, 60); assert.equal(r.roll, rb.d100()); }
    const s = room(C, OPEN, [2, 2], [ex([3, 2], { sawYou: true })]), you = s.actors[0], t = s.actors[1];
    const chance = Combat.hitChance(you, t), before = s.rng['combat/you'];
    const ev = checked(Step.step(s, { a: 'attack', uid: t.uid })), hit = ev.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
    assert.equal(hit.cause.chance, chance);
    assert.notEqual(s.rng['combat/you'], before, 'the roll came from your own stream');
  });

  test('surprise by mode, for a melee blow, a Reach blow and a shot: asleep, or awake and not having seen you since it woke; never hunting, searching, returning or reinstalling', () => {
    const MODES = [['dormant', false, true], ['awake', false, true], ['awake', true, false], ['hunting', true, false], ['searching', true, false], ['returning', true, false], ['reinstalling', true, false]];
    for (const [mode, sawYou, surprised] of MODES) for (const kind of ['melee', 'reach', 'shot']) {
      const at = kind === 'reach' ? [4, 2] : [3, 2];
      const s = room(C, OPEN, [2, 2], [ex(at, { mode, sawYou })], kind === 'reach' ? withForm('reach') : {}), you = s.actors[0], t = s.actors[1];
      assert.equal(Combat.surprised(you, t), surprised, `${mode}${sawYou ? ', seen you' : ''}`);
      let ev;
      if (kind === 'shot') { ev = []; Combat.attack(s, you, t, ev, { kind: 'shot', range: 1, via: [2, 2] }); }
      else ev = Step.step(s, { a: 'attack', uid: t.uid });
      checked(ev);
      const r = ev.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
      const where = `${kind} at a ${mode} exhibit${sawYou ? ' that has seen you' : ''}`;
      assert.equal(!!r.cause.surprise, surprised, where);
      if (surprised) assert.equal(json([r.k, r.cause.raw, r.cause.roll]), json(['damaged', you.dmax, undefined]), `${where}: a certain hit for the maximum`);
      else assert.ok(Number.isInteger(r.cause.roll), `${where}: rolled`);
      assert.equal(r.cause.how.kind, kind, where);
      // Struck, it hunts you, and the next blow is no surprise.
      if (r.k === 'damaged') { assert.equal(t.mode, 'hunting', where); assert.equal(Combat.surprised(you, t), false, where); }
    }
    // You are never surprised, and a Centrepiece's surprise blow rolls its damage.
    const s = room(C, OPEN, [2, 2], [ex([3, 2], { mode: 'dormant', role: 'centrepiece' })]);
    assert.equal(Combat.surprised(s.actors[1], s.actors[0]), false);
    const d = Step.step(s, { a: 'attack', uid: s.actors[1].uid }).find(e => e.k === 'damaged');
    assert.ok(d.cause.surprise === 1 && d.cause.raw >= s.actors[0].dmin && d.cause.raw <= s.actors[0].dmax && d.cause.roll === undefined);
  });

  test('a surprise blow with a Light weapon deals ×1.5 its maximum, rounded down, only in melee; its shot, or any other weapon, deals the maximum', () => {
    const s = room(C, OPEN, [2, 2], [ex([3, 2], { mode: 'dormant' }), ex([6, 2], { mode: 'dormant' })], withForm('light')), you = s.actors[0];
    assert.equal(you.weaponForm, 'light');
    assert.equal(Combat.surpriseRaw(you, { kind: 'melee' }), Math.floor(you.dmax * 3 / 2));
    const ev = Step.step(s, { a: 'attack', uid: s.actors[1].uid }), d = ev.find(e => e.k === 'damaged');
    assert.equal(d.cause.raw, Math.floor(you.dmax * N.SURPRISE_LIGHT_PCT / 100));
    // A bolt: how.dmax (an instrument's) or your weapon's maximum, never ×1.5.
    for (const how of [{ kind: 'shot', range: 4, via: [5, 2] }, { kind: 'shot', range: 4, via: [5, 2], dmax: 7, dmin: 2, item: 'x.pin' }]) {
      const t = room(C, OPEN, [2, 2], [ex([6, 2], { mode: 'dormant' })], withForm('light')), e = [];
      Combat.attack(t, t.actors[0], t.actors[1], e, how);
      const hit = checked(e).find(x => x.k === 'damaged');
      assert.equal(json([hit.cause.raw, hit.cause.k, hit.cause.from]), json([how.dmax || t.actors[0].dmax, how.item ? 'item' : 'shot', [5, 2]]));
    }
    for (const form of ['balanced', 'heavy', 'reach']) {
      const t = room(C, OPEN, [2, 2], [ex([3, 2], { mode: 'dormant' })], withForm(form));
      const hit = Step.step(t, { a: 'attack', uid: t.actors[1].uid }).find(e => e.k === 'damaged');
      assert.equal(hit.cause.raw, t.actors[0].dmax, form);
    }
  });

  // Reach (§8.1): a target exactly 2 tiles away in one of the 8 directions, over a tile
  // between that you could walk onto and see through (no cloud or dust on it) and that holds
  // no actor, with the corner rule on both halves of a diagonal.
  test('Reach strikes 2 tiles away in a straight line, over a clear tile, with the corner rule on both halves; never into a case, never past a body, a wall, a closed door, a cloud or dust, so never at what you cannot see', () => {
    const you0 = [4, 3];
    // lay(s), if given, changes the room before the blow (a cloud or dust laid on it).
    const attackAt = (map, exhibits, form, lay) => {
      const s = room(C, map, you0, exhibits, withForm(form || 'reach'));
      if (lay) lay(s);
      const t = s.actors[s.actors.length - 1], legal = Step.legal(s).some(a => a.a === 'attack' && a.uid === t.uid);
      const copy = State.clone(s), h = State.hash(copy), ev = Step.step(copy, { a: 'attack', uid: t.uid });
      const refused = ev[0].k === 'refused';
      assert.equal(legal, !refused, `legal ⇔ not refused: ${json(ev[0])}`);
      if (refused) assert.equal(State.hash(copy), h, 'a refused blow changes nothing');
      // Whatever Reach may strike stands where you can see it (D7.7: the buttons and the
      // policies' choices give away nothing the board hides).
      const targets = Combat.reachTargets(s, s.actors[0]), vis = C.Vision.visible(s);
      for (const uid of targets) { const b = Actors.byUid(s, uid); assert.equal(vis[b.y * s.dept.w + b.x], 1, `Reach lists ${uid} at ${b.x},${b.y}, which you cannot see`); }
      return { s, t, ev, code: refused ? ev[0].reason : null, targets };
    };
    // Every direction, over open floor: a Reach blow from your tile, for your weapon's cost.
    for (let d = 0; d < 8; d++) {
      const at = [you0[0] + 2 * Grid.DX[d], you0[1] + 2 * Grid.DY[d]];
      const r = attackAt(OPEN, [ex(at)]);
      assert.equal(r.code, null, `direction ${d}`);
      checked(r.ev);
      const a = r.ev.find(e => e.k === 'attacked');
      assert.equal(json([a.how.kind, a.cause.dist]), json(['reach', 2]), `direction ${d}`);
      const hit = r.ev.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
      if (hit.k === 'damaged') assert.equal(json(hit.cause.from), json(you0), 'a Reach blow comes from your tile');
      assert.equal(json(r.targets), json([r.t.uid]));
    }
    const put = (map, x, y, c) => map.map((row, j) => j === y ? row.slice(0, x) + c + row.slice(x + 1) : row);
    // East: the tile between is (5,3).
    assert.equal(attackAt(OPEN, [ex([5, 3], { mode: 'dormant' }), ex([6, 3])]).code, 'blocked', 'a body between');
    for (const c of ['o', '#', '+', 'v', 'H']) assert.equal(attackAt(put(OPEN, 5, 3, c), [ex([6, 3])]).code, 'blocked', `${c} between`);
    for (const c of ['x', "'", ',', 'k', 'u']) assert.equal(attackAt(put(OPEN, 5, 3, c), [ex([6, 3])]).code, null, `${c} between is clear`);
    // A Fumigant cloud or plaster dust on the tile between blocks sight, and so Reach: the one
    // beyond is hidden, and is neither offered nor struck. On the target's own tile, or on
    // yours, it hides nothing between you, and the blow is made.
    for (const kind of ['dust', 'fumigant']) {
      for (const [x, y, size, code] of [[5, 3, 1, 'blocked'], [6, 3, 3, 'blocked'], [6, 3, 1, null], [4, 3, 1, null], [7, 3, 1, null]]) {
        const r = attackAt(OPEN, [ex([6, 3])], 'reach', s => C.Surfaces.add(s, kind, x, y, size, 5, null, []));
        assert.equal(r.code, code, `${kind} of size ${size} at ${x},${y}`);
        assert.equal(json(r.targets), json(code ? [] : [r.t.uid]), `${kind} of size ${size} at ${x},${y}`);
      }
      // Diagonally, over (5,2) to (6,1).
      const d = attackAt(OPEN, [ex([6, 1])], 'reach', s => C.Surfaces.add(s, kind, 5, 2, 1, 5, null, []));
      assert.equal(json([d.code, d.targets]), json(['blocked', []]), `${kind} between, diagonally`);
    }
    // North-east, over (5,2) to (6,1): the corners of the first half are (5,3) and (4,2), of the second (6,2) and (5,1).
    for (const [x, y] of [[5, 3], [4, 2], [6, 2], [5, 1]]) assert.equal(attackAt(put(OPEN, x, y, 'o'), [ex([6, 1])]).code, 'corner', `a column at ${x},${y}`);
    assert.equal(attackAt(put(OPEN, 3, 3, 'o'), [ex([6, 1])]).code, null, 'a column elsewhere');
    // Not in a straight line, or not 2 away: out of reach.
    for (const at of [[6, 4], [5, 1], [7, 3], [4, 6]]) assert.equal(attackAt(OPEN, [ex(at)]).code, 'out_of_reach', `at ${at}`);
    // Into a case: glass, as for any blow.
    assert.equal(attackAt(put(OPEN, 6, 3, 'v'), [ex([6, 3])]).code, 'behind_glass');
    // Without a Reach weapon, a target 2 away is out of reach; with one, a target beside you
    // is struck as usual, in melee.
    for (const form of ['balanced', 'light', 'heavy']) assert.equal(attackAt(OPEN, [ex([6, 3])], form).code, 'out_of_reach', form);
    const near = attackAt(OPEN, [ex([5, 4])]);
    assert.equal(json([near.code, near.ev.find(e => e.k === 'attacked').how.kind, near.targets]), json([null, 'melee', []]));
    // The cost is your weapon's blow; Heavy and brutes strike at 150, and both rows agree (§8.10).
    assert.equal(N.FORM_REACH[3], N.COST_ATTACK);
    assert.equal(N.FORM_HEAVY[3], N.COST_ATTACK_HEAVY, 'a Heavy blow costs its form\'s cost');
    const s = room(C, OPEN, you0, [ex([6, 3])], withForm('reach'));
    Step.step(s, { a: 'attack', uid: s.actors[1].uid });
    assert.equal(s.actors[0].next, N.FORM_REACH[3]);
    // canStrike says the same for exhibits: they have no Reach.
    assert.equal(Combat.canStrike(s, s.actors[1], s.actors[0], { kind: 'reach' }), 'out_of_reach');
  });

  // Reach under every invariant, clone-checked: a hunter 2 tiles away in each of the 8
  // directions, each struck in turn twice, over several seeds so that blows both hit and
  // miss. The hunters are scheduled far ahead, so that they stay where they are.
  const reachAll = H.scenario({
    name: 'Reach blows at hunters 2 tiles away in each of the 8 directions hold every invariant and are clone-stable',
    id: null,
    seeds: [1, 2, 3, 4, 5, 6],
    build: (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: OPEN, you: [4, 3],
      kit: withForm('reach').kit,
      exhibits: Grid.DX.map((dx, d) => ex([4 + 2 * dx, 3 + 2 * Grid.DY[d]], { next: 1000000, sawYou: true, stats: Object.assign({}, DUMMY, { hp: 99 }) })) }, { rulesOff: opts.rulesOff }),
    actions: (state, i) => i < 16 ? { a: 'attack', uid: state.actors[1 + (i % 8)].uid } : null,
    expect(r) {
      if (r.steps.length !== 16) return `${r.steps.length} steps`;
      for (const st of r.steps) {
        const ev = st.events, a = ev.find(e => e.k === 'attacked' && e.by === 'you');
        if (!a || a.how.kind !== 'reach' || a.cause.dist !== 2 || a.at !== st.action.uid) return `not a Reach blow: ${kinds(ev).join()}`;
        const res = ev.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you');
        if (!res || res.cause.how.kind !== 'reach' || !Number.isInteger(res.cause.roll)) return `its result: ${json(res)}`;
        if (res.k === 'damaged' && json(res.cause.from) !== json([4, 3])) return `it came from ${json(res.cause.from)}`;
      }
      return null;
    },
    clone: true,
  });

  test('Reach blows in every direction, hit and miss, hold every invariant (the Reach branches included) and are clone-stable', () => {
    const results = H.sweep(C, reachAll, [{ sp: null, depth: 1 }, { sp: null, depth: 4 }]);
    assert.deepEqual(H.failures(results), []);
    const all = results.flatMap(r => r.events);
    const hits = all.filter(e => e.k === 'damaged' && e.cause.by === 'you').length, misses = all.filter(e => e.k === 'missed' && e.cause.by === 'you').length;
    assert.ok(hits > 0 && misses > 0, `${hits} hits and ${misses} misses`);
    // The invariants check these Reach blows: with the blow's noise planted away, the order
    // inside a Reach blow breaks, and the runs say so.
    const X = loadCore(), emit = X.Noise.emit;
    X.Noise.emit = (state, x, y, cls, cause, ev) => cause && cause.k === 'attack' ? undefined : emit(state, x, y, cls, cause, ev);
    const planted = H.failures(H.sweep(X, reachAll, [{ sp: null, depth: 1 }]));
    assert.equal(planted.length, reachAll.seeds.length, planted.join('\n'));
    for (const f of planted) assert.match(f, /blow at .* made no soft noise after it landed/);
    console.log(`  Reach: ${results.length} runs, ${hits} hits and ${misses} misses, every invariant checked and clone-checked`);
  });

  test('inside one blow: attacked, then the hit or miss, then last the soft noise from the attacker\'s tile; for your blows, Reach blows and exhibits\' blows', () => {
    const order = (ev, by) => {
      const i = ev.findIndex(e => e.k === 'attacked' && e.by === by), j = ev.findIndex((e, k) => k > i && (e.k === 'damaged' || e.k === 'missed') && e.cause.by === by);
      const n = ev.findIndex((e, k) => k > j && e.k === 'noise' && e.cause.k === 'attack' && e.cause.by === by);
      return { i, j, n, noise: ev[n] };
    };
    for (const [form, at] of [['balanced', [3, 2]], ['reach', [4, 2]]]) {
      const s = room(C, OPEN, [2, 2], [ex(at, { mode: 'dormant', stats: Object.assign({}, DUMMY, { hp: 3 }) })], withForm(form));
      const ev = checked(Step.step(s, { a: 'attack', uid: s.actors[1].uid }));
      const o = order(ev, 'you');
      assert.ok(o.i === 0 && o.j > o.i && o.n > o.j, `${form}: ${kinds(ev)}`);
      assert.equal(json([o.noise.cls, o.noise.x, o.noise.y]), json(['soft', 2, 2]));
      // It was destroyed: its loud noise and its waking come before the blow's own noise.
      const died = ev.findIndex(e => e.k === 'died'), loud = ev.findIndex(e => e.k === 'noise' && e.cause.k === 'destroyed'), woke = ev.findIndex(e => e.k === 'woke');
      assert.ok(died > o.j && loud > died && woke > o.j && o.n > loud && o.n > woke, `${form}: ${kinds(ev)}`);
      assert.equal(ev.filter(e => e.k === 'noise' && e.cause.k === 'attack').length, 1);
    }
    // An exhibit's blow at you, hit or miss.
    const s = room(C, OPEN, [2, 2], [ex([3, 3])]);
    s.actors[0].hp = s.actors[0].maxHp = 999;
    let seen = 0;
    for (let k = 0; k < 20; k++) {
      const ev = checked(Step.step(s, { a: 'wait' })), o = order(ev, s.actors[1].uid);
      if (o.i < 0) continue;
      assert.ok(o.j > o.i && o.n > o.j && o.noise.cls === 'soft' && o.noise.x === 3 && o.noise.y === 3, kinds(ev).join());
      seen++;
    }
    assert.ok(seen >= 19);
  });

  test('one action\'s wake order (R5): a blow applies ally_hit before its noise, so a group member with 2 pips wakes hunting; without the group, the noise wakes it awake', () => {
    const run = group => {
      const X = loadCore();
      // WAKE-A's hooks, stood in for here as §8.2 writes them: ally_hit gives +3 to sleeping
      // members of the struck one's group within ALLY_HIT_RANGE; a noise gives a sleeper 1.
      X.Wake.allyHit = (state, victim, cause, ev) => {
        for (const b of state.actors) if (b !== victim && !b.gone && b.group && b.group === victim.group && b.mode === 'dormant' && X.Grid.disc(b.x - victim.x, b.y - victim.y, N.ALLY_HIT_RANGE))
          X.Wake.addPips(state, b, 3, { k: 'ally_hit', by: victim.uid, dist: X.Actors.dist(b, victim.x, victim.y) }, ev);
      };
      X.Wake.hear = (state, a, noise, dist, ev) => {
        if (a.mode === 'dormant') X.Wake.addPips(state, a, 1, Object.assign({ k: 'noise', dist, cls: noise.cls }, noise.by ? { by: noise.by } : {}), ev, { target: [noise.x, noise.y] });
      };
      // The one struck sleeps, so the blow is a certain hit (a surprise).
      const s = room(X, OPEN, [2, 2], [ex([3, 2], { group: 'g', mode: 'dormant' }), ex([5, 2], { group: group, mode: 'dormant', pips: 2 })]);
      const ev = checked(X.Step.step(s, { a: 'attack', uid: s.actors[1].uid }));
      return { s, ev, member: s.actors[2] };
    };
    const g = run('g');
    assert.ok(g.ev.some(e => e.k === 'damaged' && e.who === g.s.actors[1].uid && e.cause.surprise));
    assert.equal(json([g.member.mode, g.member.woke.cause.k]), json(['hunting', 'ally_hit']));
    const woke = g.ev.findIndex(e => e.k === 'woke' && e.who === g.member.uid), noise = g.ev.findIndex(e => e.k === 'noise' && e.cause.k === 'attack');
    assert.ok(woke >= 0 && woke < noise, kinds(g.ev).join());
    const alone = run(null);
    assert.equal(json([alone.member.mode, alone.member.woke.cause.k]), json(['awake', 'noise']), 'the noise alone wakes it awake');
  });

  test('adjustDamage sees the tile a blow, a Reach blow, a shot and a special came from (cause.from)', () => {
    const X = loadCore(), seen = [];
    X.Registry.define('MODIFIERS', 'planted_from', {});
    X.Archetypes.addModifier('planted_from', { adjustDamage(state, def, amount, cause) { seen.push([cause.k, cause.from.slice()]); return amount * 2; } });
    X.Registry.define('ARCHETYPES', 'planted_ringer', { special: 'ring' });
    X.Archetypes.add('planted_ringer', {});
    const target = (at, more) => ex(at, Object.assign({ mods: ['planted_from'], mode: 'dormant', stats: Object.assign({}, DUMMY, { hp: 99 }) }, more));
    const a = room(X, OPEN, [2, 2], [target([3, 3])]);
    const hit = X.Step.step(a, { a: 'attack', uid: a.actors[1].uid }).find(e => e.k === 'damaged');
    assert.equal(hit.amount, 2 * Math.max(1, hit.cause.raw - hit.cause.pad), 'the hook\'s answer is the damage');
    const b = room(X, OPEN, [2, 2], [target([4, 4])], withForm('reach'));
    X.Step.step(b, { a: 'attack', uid: b.actors[1].uid });
    const c = room(X, OPEN, [2, 2], [target([6, 2])]);
    X.Combat.attack(c, c.actors[0], c.actors[1], [], { kind: 'shot', range: 4, via: [5, 2] });
    const d = room(X, OPEN, [2, 2], [target([5, 4]), ex([6, 5], { arch: 'planted_ringer' })]), w = d.actors[2], ev = [];
    X.Specials.mark(d, w, 'ring', X.Specials.tiles(d, w, 'ring'), ev);
    X.Specials.resolve(d, w, ev);
    assert.equal(json(seen), json([['attack', [2, 2]], ['attack', [2, 2]], ['shot', [5, 2]], ['special', [6, 5]]]));
  });

  test('an invulnerable run keeps your health at 1, saying so in the cause; without it you fall', () => {
    for (const invulnerable of [true, false]) {
      const s = room(C, OPEN, [2, 2], [ex([3, 2], { stats: Object.assign({}, DUMMY, { acc: 30, dmin: 9, dmax: 9 }) })], {}, { invulnerable });
      s.actors[0].hp = 3;
      let saved = 0;
      for (let k = 0; k < 10 && !s.over; k++) for (const e of checked(Step.step(s, { a: 'wait' }))) if (e.k === 'damaged' && e.who === 'you' && e.cause.saved) saved++;
      if (invulnerable) {
        assert.equal(json([s.over, s.actors[0].hp]), json([null, 1]));
        assert.ok(saved >= 5, `${saved} saves`);
        const e = { k: 'damaged', turn: 1, tick: 100, who: 'you', amount: 8, hp: 1, cause: { k: 'attack', by: 'x.1', at: 'you', chance: 95, roll: 3, raw: 9, pad: 1, how: { kind: 'melee' }, from: [3, 2], saved: 1 } };
        assert.equal(Text.event(e), 'The training dummy hit you for 8 (rolled 3 against 95%; 9 − 1 Padding). You were kept at 1 health.');
      } else assert.equal(json([s.over.k, s.over.by, s.actors[0].hp, saved]), json(['died', s.actors[1].uid, 0, 0]));
    }
  });

  test('a blow\'s sentence gives the arithmetic of the damage it dealt, through an old repair or at a body that falls to one blow too', () => {
    const names = uid => uid === 'x.1' ? 'the cast' : uid === 'x.2' ? 'the mote' : null;
    const say = (amount, hp, more, who) => {
      const e = { k: 'damaged', turn: 3, tick: 300, who: who || 'x.1', amount, hp, cause: Object.assign({ k: 'attack', by: 'you', at: who || 'x.1', chance: 80, roll: 30, raw: 6, pad: 2, how: { kind: 'melee' }, from: [2, 2] }, more) };
      assert.equal(Causes.check(e), null, json(e));
      const line = Text.event(e, names);
      assert.ok(!/undefined|NaN|\[object/.test(line), line);
      return line;
    };
    assert.equal(say(4, 10), 'You hit the cast for 4 (rolled 30 against 80%; 6 − 2 Padding).');
    assert.equal(say(8, 10, { side: 'W' }), 'You hit the cast for 8 (rolled 30 against 80%; 6 − 2 Padding, doubled through its repaired west side).');
    assert.equal(say(2, 10, { raw: 1, floor: 1, side: 'N', how: { kind: 'reach' } }), 'You hit the cast with Reach for 2 (rolled 30 against 80%; 1 − 2 Padding, at least 1, doubled through its repaired north side).');
    assert.equal(say(8, 0, { side: 'E', surprise: 1, roll: undefined }), 'You caught the cast unawares: 8 damage (6 − 2 Padding, doubled through its repaired east side).');
    assert.equal(say(5, 0, {}, 'x.2'), 'You hit the mote for 5 (rolled 30 against 80%; 6 − 2 Padding; it falls to any one blow: all 5 of its health).');
    assert.equal(say(3, 0, { raw: 9 }, 'x.2'), 'You hit the mote for 3 (rolled 30 against 80%; 9 − 2 Padding; it falls to any one blow: all 3 of its health).');
    assert.equal(say(6, 4), 'You hit the cast for 6 (rolled 30 against 80%; 6 − 2 Padding, which its Behaviour line makes 6).');
    // Through the real path: a stand-in for old_repair (W1-ARCH-B's), which marks the side and
    // doubles, and one for mote_swarm (W1-ARCH-A's), which takes all the body's health.
    const X = loadCore();
    X.Registry.define('MODIFIERS', 'planted_repair', {});
    X.Archetypes.addModifier('planted_repair', { adjustDamage(state, def, amount, cause) { cause.side = 'W'; return amount * 2; } });
    X.Registry.define('MODIFIERS', 'planted_mote', {});
    X.Archetypes.addModifier('planted_mote', { adjustDamage(state, def, amount) { return def.hp; } });
    for (const [mod, want] of [['planted_repair', /^You hit the training dummy for (\d+) \(rolled \d+ against \d+%; (\d+) − 0 Padding, doubled through its repaired west side\)\.$/],
      ['planted_mote', /^You hit the training dummy for 7 \(rolled \d+ against \d+%; \d+ − 0 Padding; it falls to any one blow: all 7 of its health\)\.$/]]) {
      const t = room(X, OPEN, [2, 2], [ex([3, 2], { mods: [mod], sawYou: true, stats: Object.assign({}, DUMMY, { hp: 7, acc: -30, eva: -30 }) })]);
      const d = X.Step.step(t, { a: 'attack', uid: t.actors[1].uid }).find(e => e.k === 'damaged' && e.cause.by === 'you');
      assert.ok(d, mod);
      assert.equal(X.Causes.check(d), null);
      const line = X.Text.event(d);
      assert.match(line, want, mod);
      if (mod === 'planted_repair') { const m = line.match(want); assert.equal(+m[1], 2 * +m[2]); }
    }
  });

  // Damage always wakes, straight to hunting (§8.2): every M3 pack species, at depths 1–7.
  const PACKS = Packs.list().flatMap(p => p.species.map(sp => ({ sp, acc: p.acc })))
    .filter(({ sp }) => Registry.ARCHETYPES[sp.archetype] && Registry.ARCHETYPES[sp.archetype].built === 'M3');
  const damageWakes = H.scenario({
    name: 'a sleeping exhibit struck wakes hunting you, by damage, and the next blow is no surprise',
    id: null,
    build: (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: OPEN, you: [2, 2],
      exhibits: [{ sp: sp.id, at: [3, 2], mode: 'dormant', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff }),
    actions: (state, i) => i === 0 ? { a: 'attack', uid: state.actors[1].uid } : i === 1 && !state.actors[1].gone ? { a: 'attack', uid: state.actors[1].uid } : null,
    expect(r) {
      const uid = r.start.actors[1].uid, first = r.steps[0].events, ex = r.state.actors[1];
      // A mimic in its disguise stands in a case: nothing strikes into one (§8.3).
      if (C.Cases.encased(r.start, r.start.actors[1])) return first[0].k === 'refused' && first[0].reason === 'behind_glass' && ex.mode === 'dormant' ? null : 'a blow reached into a case';
      const d = first.find(e => e.k === 'damaged' && e.who === uid), w = first.find(e => e.k === 'woke' && e.who === uid);
      if (!d || !d.cause.surprise) return 'the first blow at a sleeper was not a surprise';
      if (!w || w.mode !== 'hunting' || w.cause.k !== 'damage' || w.cause.by !== 'you' || w.cause.dist !== 1) return `it woke ${json(w)}`;
      if (first.findIndex(e => e.k === 'woke' && e.who === uid) > first.findIndex(e => e.k === 'noise' && e.cause.k === 'attack')) return 'it woke after the blow\'s noise';
      if (ex.woke.cause.k !== 'damage' || ex.hunted.cause.k !== 'damage') return `its story says ${json(ex.woke)} and ${json(ex.hunted)}`;
      if (r.steps.length > 1) {
        const second = r.steps[1].events.find(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you' && (e.who === uid || e.at === uid));
        if (second && second.cause.surprise) return 'the second blow, at a hunter, was a surprise';
      }
      return null;
    },
    clone: true,
  });

  test('damage wakes every pack species straight to hunting you, at depths 1–7, with the damage cause, before the blow\'s noise', () => {
    const list = PACKS.flatMap(({ sp, acc }) => H.DEPTHS.map(depth => ({ sp, depth, acc })));
    assert.ok(list.length >= 13 * 7, `${list.length} species and depths`);
    const results = H.sweep(C, damageWakes, list);
    assert.deepEqual(H.failures(results), []);
    assert.equal(results.length, list.length);
  });

  test('the combat invariants hold over monkeys in the test room (with each weapon form) and in the three departments, and they catch planted faults', () => {
    const pick = (seed) => { const r = Rng.stream({ seed, rng: {} }, 'pick'); return (state) => { const legal = Step.legal(state); return legal[r.int(0, legal.length - 1)]; }; };
    let steps = 0;
    for (const form of ['balanced', 'light', 'heavy', 'reach']) {
      const s = Setup.room(4, Object.assign({}, TestRoom.spec, withForm(form)));
      s.actors[0].hp = s.actors[0].maxHp = 999;
      const p = H.play(C, s, pick(4), { inv: ['combat'], cap: 250, clone: true });
      assert.deepEqual(p.violations.map(v => v.text), [], form);
      steps += p.steps.length;
    }
    for (const [acc, depth] of [['S9', 3], ['A4', 3], ['M11', 3]]) {
      const s = Dept.create(depth, acc, depth, { invulnerable: true });
      const p = H.play(C, s, pick(depth), { inv: ['combat'], cap: 250, clone: true });
      assert.deepEqual(p.violations.map(v => v.text), [], acc);
      steps += p.steps.length;
    }
    assert.ok(steps > 1500, `${steps} steps`);
    // Planted faults: a blow whose damage ignores Padding, and a roll that hits above its chance.
    const X = loadCore(), invs = require(path.join(root, 'test/behaviour/combat.inv.js'))(X);
    const one = id => invs.filter(i => i.id === id);
    const s = room(X, OPEN, [2, 2], [ex([3, 2], { stats: Object.assign({}, DUMMY, { pad: 2 }) })]);
    const pre = X.State.clone(s), e = { k: 'damaged', turn: 0, tick: 0, who: s.actors[1].uid, amount: 6, hp: 24, cause: { k: 'attack', by: 'you', at: s.actors[1].uid, chance: 80, roll: 12, raw: 6, pad: 2, how: { kind: 'melee' }, from: [2, 2] } };
    assert.match(one('combat_damage')[0].check(pre, [e], s), /took 6, not 4/);
    const m = { k: 'missed', turn: 0, tick: 0, by: 'you', at: s.actors[1].uid, cause: { k: 'attack', by: 'you', at: s.actors[1].uid, chance: 80, roll: 12, how: { kind: 'melee' } } };
    assert.match(one('combat_roll')[0].check(pre, [m], s), /rolled 12 against 80%/);
    const g = Object.assign({}, e, { amount: 4 }), twice = { k: 'damaged', turn: 0, tick: 0, who: 'you', amount: 2, hp: 18, cause: { k: 'special', by: 'w.1', sp: 'ring', gross: 3, pad: 1, net: 2, x: 2, y: 2, from: [3, 2] } };
    assert.equal(one('combat_damage')[0].check(pre, [g], s), null);
    assert.match(one('combat_special_once')[0].check(pre, [twice, twice], s), /struck you twice/);
    assert.match(one('combat_special_shown')[0].check(pre, [twice], s), /which no mark showed/);
  });
};
