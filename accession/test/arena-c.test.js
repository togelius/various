// The arenas of W2b-ARENA-C (BUILD.md §10.3): herald, tethered_warden, mimic_vitrine and
// night_watchman, with their naive and counterplay policies (tools/policies/<id>.js). Each
// stamp is the arena §10.3 names, built as the plan chose it; seeds 1–20 run paired, every
// invariant checked after every step, as a smoke test (the counterplay is not worse, and
// reaches the goal at least as often); each counterplay does what its card says; and the
// policies are deterministic, whatever ran before them. The 200-seed gate is Wave 3's.
module.exports = ({ test, assert, root, path, fs }) => {
  const Sim = require(path.join(root, 'tools/sim.js'));
  const C = Sim.load();
  const J = v => JSON.parse(JSON.stringify(v)), eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
  const clean = s => assert.ok(typeof s === 'string' && s.trim() !== '' && !/undefined|NaN|\[object|\bnull\b/.test(s), `not a clean sentence: ${s}`);
  const N = C.N;
  const SEEDS = []; for (let s = 1; s <= 20; s++) SEEDS.push(s);
  // The four arenas: the species in turn (D6.2: the pack species of the archetype, or the
  // shared one), and §10.3's metric.
  const ARENAS = [
    { id: 'herald', species: ['S9.3', 'A4.3'], metric: { name: 'woken', test: 'ratio', at: 'most', pct: 50 } },
    { id: 'tethered_warden', species: ['S9.4'], metric: { name: 'hpLost', test: 'ratio', at: 'most', pct: 50 } },
    { id: 'mimic_vitrine', species: ['S9.5'], metric: { name: 'hpLost', test: 'ratio', at: 'most', pct: 30 } },
    { id: 'night_watchman', species: ['night_watchman'], metric: { name: 'died', test: 'lower', at: null, pct: null } },
  ];
  const spec = id => Sim.arenaSpec(C, id);
  const cell = (s, ch, v) => C.Arena.cells(s, v).filter(c => c.ch === ch);
  const byUid = (state, uid) => state.actors.find(a => a.uid === uid);
  const layout = (s, seed) => C.Arena.layout(s, seed);
  const uidOf = (L, ch) => L.exhibits.filter(e => e.ch === ch).map(e => e.uid);

  // Seeds 1–20 run paired once, with every event logged and every invariant checked after
  // every step; the tests below read these runs.
  let pairedRuns = null;
  const paired = () => pairedRuns || (pairedRuns = ARENAS.map(a => ({ a, r: Sim.paired(a.id, 'naive', 'counter', SEEDS, { C, check: true, log: true }) })));
  const events = (run, k) => run.events.filter(e => e.k === k);

  test('each stamp is the arena §10.3 names: its goal, metric, cap, depths and species in turn, built on seeds 1–20', () => {
    for (const a of ARENAS) {
      const s = spec(a.id);
      assert.equal(s.arena, a.id);
      eq([s.cap, s.depths, s.seen], [200, [2, 5], 'all'], a.id);
      eq(s.metric, a.metric, a.id);
      eq(C.Arena.speciesList(s).map(x => x.id), a.species, a.id);
      for (const seed of SEEDS) {
        const L = layout(s, seed), st = C.Arena.build(s, seed);
        assert.equal(L.depth, seed % 2 ? 2 : 5, `${a.id} seed ${seed}: odd seeds at depth 2, even at 5`);
        assert.equal(L.sp, a.species[Math.floor((seed - 1) / 2) % a.species.length], `${a.id} seed ${seed}: the species in turn`);
        assert.equal(st.dept.depth, L.depth);
        assert.equal(C.State.plainData(st), null);
      }
    }
  });

  test('herald: a herald and three sleeping fodder (M11.5) within its call, beside the straight way to the far door, with a hidden way round', () => {
    const s = spec('herald');
    eq(s.goal, { k: 'reach', chars: ['D'] });
    const [door] = cell(s, 'D', 0);
    for (const seed of [1, 2, 3, 4]) {
      const L = layout(s, seed), st = C.Arena.build(s, seed), [h] = uidOf(L, 'C').map(u => byUid(st, u)), fodder = uidOf(L, 'F').map(u => byUid(st, u));
      assert.equal(C.Grid.ch(st.dept, door.x, door.y), "'", 'the far door is an open door');
      eq([h.sp, h.arch, h.mode], [L.sp, 'herald', 'dormant'], `seed ${seed}`);
      assert.equal(fodder.length, 3);
      for (const f of fodder) {
        eq([f.sp, f.role, f.mode], ['M11.5', 'fodder', 'dormant']);
        assert.ok(C.Grid.disc(f.x - h.x, f.y - h.y, N.HERALD_RANGE), `${f.uid} is within the call's ${N.HERALD_RANGE} tiles`);
      }
      // The straight way to the door passes within the herald's sight; another way, out of it,
      // is a few steps longer.
      const m = st.dept, you = st.actors[0];
      const sees = (x, y) => C.Grid.disc(x - h.x, y - h.y, N.SIGHT_EXHIBIT) && C.Grid.los(m, h.x, h.y, x, y);
      const way = C.Path.to(st, door.x, door.y);
      assert.ok(way.some(([x, y]) => sees(x, y)), 'the shortest way is in its sight');
      const hidden = { dept: { w: m.w, h: m.h, tiles: m.tiles.map((r, y) => r.split('').map((c, x) => sees(x, y) ? '#' : c).join('')), fixtures: [] }, actors: st.actors, run: st.run };
      const round = C.Path.to(hidden, door.x, door.y);
      assert.ok(round.length > way.length && round.length <= way.length + 4, `the hidden way is a few steps longer: ${round.length} against ${way.length}`);
      assert.equal(sees(you.x, you.y), false, 'you start out of its sight');
    }
  });

  test('tethered_warden: a warden asleep beside the item it guards, its place on the far side, and a Tuning Fork of 3 charges', () => {
    const s = spec('tethered_warden');
    eq(s.goal, { k: 'take', chars: ['I'] });
    const [item] = cell(s, 'I', 0), [home] = cell(s, 'h', 0);
    for (const seed of [1, 2]) {
      const L = layout(s, seed), st = C.Arena.build(s, seed), [w] = uidOf(L, 'W').map(u => byUid(st, u)), you = st.actors[0];
      eq([w.sp, w.arch, w.mode, w.trigger], ['S9.4', 'tethered_warden', 'dormant', 'tether'], `seed ${seed}`);
      eq([w.guards, w.home], [[item.x, item.y], [home.x, home.y]]);
      const inTether = (x, y) => C.Grid.disc(x - item.x, y - item.y, N.TETHER_RANGE);
      assert.ok(inTether(w.x, w.y) && inTether(home.x, home.y), 'it starts, and its place is, within its tether');
      assert.ok(C.Grid.chebyshev(w.x, w.y, item.x, item.y) === 1 && C.Grid.chebyshev(home.x, home.y, item.x, item.y) === 2, 'it sleeps beside the item; its place is 2 tiles from it');
      assert.ok(C.Grid.chebyshev(you.x, you.y, w.x, w.y) < C.Grid.chebyshev(you.x, you.y, home.x, home.y), 'it sleeps on the side you come from');
      const fork = st.items.find(i => i.uid === st.you.kit.instrument);
      eq([fork.kind, fork.form, fork.tier, fork.charges, fork.max], ['instrument', 'fork', 1, 3, 3]);
      const it = st.items.find(i => i.where.at === 'floor');
      eq([it.kind, it.form, it.tier, it.where.x, it.where.y], ['weapon', 'balanced', 1, item.x, item.y]);
    }
  });

  test('mimic_vitrine: two cases, one a mimic drawn per seed, the real one like it but for its accession number, both openable at your grade', () => {
    const s = spec('mimic_vitrine');
    eq(s.goal, { k: 'open', chars: ['C'] });
    assert.equal(s.grade, 6);
    const near = [];
    for (const seed of SEEDS) {
      const v = C.Arena.variant(s, seed), L = layout(s, seed), st = C.Arena.build(s, seed), you = st.actors[0];
      const [mc] = cell(s, 'M', v), [rc] = cell(s, 'C', v), mimic = byUid(st, uidOf(L, 'M')[0]);
      eq([mimic.sp, mimic.mode, mimic.x, mimic.y], ['S9.5', 'dormant', mc.x, mc.y], `seed ${seed}`);
      const fm = C.Cases.at(st, mc.x, mc.y), fr = C.Cases.at(st, rc.x, rc.y);
      eq([fm.mimic, fm.num, fm.st, fr.mimic, fr.st], [mimic.uid, null, 'shut', null, 'shut'], `seed ${seed}`);
      eq([fr.glass, fr.lock, fr.loan, fr.holds], [fm.glass, fm.lock, fm.loan, fm.holds], `seed ${seed}: the real case is like the disguise`);
      assert.ok(typeof fr.num === 'string' && fr.num !== '', 'the real case has its accession number');
      assert.equal(fm.holds, null);
      assert.ok(st.run.grade >= fm.lock, `seed ${seed}: your grade opens its lock`);
      const vm = C.ViewModel.derive(st, {});
      eq(J(vm.cases.find(c => c.x === mc.x && c.y === mc.y)), Object.assign(J(vm.cases.find(c => c.x === rc.x && c.y === rc.y)), { x: mc.x, y: mc.y, num: null }), 'the board shows the two alike but for the number');
      near.push(C.Grid.chebyshev(you.x, you.y, mc.x, mc.y) < C.Grid.chebyshev(you.x, you.y, rc.x, rc.y));
    }
    assert.ok(near.includes(true) && near.includes(false), 'over seeds 1–20 the mimic is the nearer case on some and the farther on others');
  });

  test('night_watchman: the clock one count short of the night watch, the Watchman coming in at the entrance at the first boundary, and sleepers for the bells', () => {
    const s = spec('night_watchman');
    eq(s.goal, { k: 'leave', chars: [] });
    eq(s.clock, { B: 220, G: 60, count: 279 });
    for (const seed of [1, 2]) {
      const L = layout(s, seed), st = C.Arena.build(s, seed);
      eq([st.dept.clock.B, st.dept.clock.G, st.dept.clock.count, st.dept.clock.stage], [220, 60, 279, 1]);
      assert.ok(st.dept.entrance && st.dept.exits.length === 1, 'an entrance and an exit');
      const sleepers = uidOf(L, 'F').map(u => byUid(st, u));
      assert.equal(sleepers.length, 4);
      for (const f of sleepers) eq([f.sp, f.mode], ['M11.5', 'dormant']);
      const ev = C.Step.step(st, { a: 'wait' });
      assert.equal(st.dept.clock.stage, 2, 'the night watch has begun');
      const entered = ev.filter(e => e.k === 'entered');
      assert.equal(entered.length, 1);
      const w = byUid(st, entered[0].who);
      eq([w.sp, w.arch, w.mode, w.x, w.y], ['night_watchman', 'night_watchman', 'hunting', st.dept.entrance[0], st.dept.entrance[1]]);
    }
  });

  test('seeds 1–20 run paired, every invariant checked after every step: the counterplay is not worse than naive, and reaches the goal at least as often', () => {
    for (const { a, r } of paired()) {
      const runs = [...r.a.runs, ...r.b.runs];
      for (const x of runs) {
        assert.equal(x.error, null, `${x.policy} seed ${x.seed}: ${x.error}`);
        eq(x.violations, [], `${x.policy} seed ${x.seed}`);
        assert.ok(x.reasons.length === x.steps && x.steps > 0);
        x.reasons.forEach(clean);
      }
      eq(r.seeds, SEEDS);
      const sum = (runs, k) => runs.reduce((t, x) => t + (k === 'died' ? (x.outcome.deaths > 0 ? 1 : 0) : x.outcome[k]), 0);
      const naive = sum(r.a.runs, a.metric.name), counter = sum(r.b.runs, a.metric.name);
      assert.ok(counter <= naive, `${a.id}: the counterplay's ${a.metric.name} total ${counter} is above naive's ${naive}`);
      const won = runs => runs.filter(x => x.outcome.won).length;
      assert.ok(won(r.b.runs) >= won(r.a.runs), `${a.id}: the counterplay reached the goal on ${won(r.b.runs)} seeds, naive on ${won(r.a.runs)}`);
      // The verdict (§10.3's statistics on these 20 seeds), in words: printed, not gated here.
      clean(r.verdict.sentence);
      console.log(`  ${r.verdict.sentence} Won: naive ${won(r.a.runs)}/20, counterplay ${won(r.b.runs)}/20.`);
    }
  });

  test('each counterplay does what its card says, and naive meets what the counterplay avoids', () => {
    const R = id => paired().find(p => p.a.id === id).r;
    // herald: the counterplay is never called on and wakes no one; naive walks into the call.
    for (const x of R('herald').b.runs) {
      assert.equal(events(x, 'telegraphed').filter(e => e.sp === 'call').length, 0, `counter seed ${x.seed}: a call`);
      eq([x.outcome.won, x.outcome.woken], [true, 0], `counter seed ${x.seed}`);
      const L = layout(spec('herald'), x.seed), [h] = uidOf(L, 'C');
      assert.ok(x.reads.some(r => r.turn === 0 && r.target === h && /the first time it sees you it calls/.test(r.text)), `counter seed ${x.seed}: it reads the herald's label at its first decision`);
    }
    for (const x of R('herald').a.runs) assert.ok(events(x, 'telegraphed').some(e => e.sp === 'call'), `naive seed ${x.seed}: the herald calls`);
    // mimic: the counterplay reads both cases before it opens any, is never gripped, and opens
    // the real one; naive is gripped on every seed where the mimic is the nearer case.
    const s = spec('mimic_vitrine');
    for (const x of R('mimic_vitrine').b.runs) {
      eq(x.reads.slice(0, 2).map(r => r.turn), [0, 0]);
      assert.ok(x.reads.slice(0, 2).every(r => /^case:\d+,\d+$/.test(r.target)));
      assert.equal(events(x, 'status').filter(e => e.cause.k === 'grip').length, 0, `counter seed ${x.seed}: gripped`);
      const [rc] = cell(s, 'C', x.variant), opened = events(x, 'case_opened');
      eq(opened.map(e => [e.x, e.y]), [[rc.x, rc.y]], `counter seed ${x.seed}: it opens the real case, and only it`);
    }
    for (const x of R('mimic_vitrine').a.runs) {
      const st = C.Arena.build(s, x.seed), you = st.actors[0], [mc] = cell(s, 'M', x.variant), [rc] = cell(s, 'C', x.variant);
      const mimicNear = C.Grid.chebyshev(you.x, you.y, mc.x, mc.y) < C.Grid.chebyshev(you.x, you.y, rc.x, rc.y);
      assert.equal(events(x, 'status').some(e => e.cause.k === 'grip' && e.on), mimicNear, `naive seed ${x.seed}: gripped exactly when the mimic is nearer`);
      assert.equal(x.outcome.won, true);
    }
    // warden: the counterplay uses the fork from outside the tether before it steps in, and
    // the warden never strikes it; naive is struck on some seeds.
    const t = spec('tethered_warden'), [item] = cell(t, 'I', 0);
    for (const x of R('tethered_warden').b.runs) {
      const forks = events(x, 'used').filter(e => e.how === 'fork');
      assert.ok(forks.length >= 1 && forks.length <= 3, `counter seed ${x.seed}: ${forks.length} uses of the fork`);
      const st = Sim.rebuild(x.replay.start, x.replay.options, C);
      let inside = false, forkInside = false;
      for (const act of x.replay.actions) {
        const you = st.actors[0];
        if (act.a === 'use' && C.Grid.disc(you.x - item.x, you.y - item.y, C.N.TETHER_RANGE)) forkInside = true;
        C.Step.step(st, act);
        if (C.Grid.disc(st.actors[0].x - item.x, st.actors[0].y - item.y, C.N.TETHER_RANGE)) inside = true;
        if (act.a === 'use') assert.equal(inside, false, `counter seed ${x.seed}: it used the fork after stepping into the tether`);
      }
      assert.equal(forkInside, false);
      assert.equal(events(x, 'damaged').filter(e => e.who === 'you').length, 0, `counter seed ${x.seed}: the warden struck it`);
      assert.equal(x.outcome.won, true);
    }
    assert.ok(R('tethered_warden').a.runs.filter(x => x.outcome.hpLost > 0).length >= 10, 'naive is struck on at least half the seeds');
    // night watch: the counterplay leaves on every seed; naive stays and dies.
    for (const x of R('night_watchman').b.runs) eq([x.stopped, x.outcome.left, x.outcome.died], ['won', true, false], `counter seed ${x.seed}`);
    for (const x of R('night_watchman').a.runs) assert.equal(events(x, 'left').length, 0, `naive seed ${x.seed} left`);
  });

  test('two runs of each policy on a seed make identical decisions: the same reasons, actions and reads', () => {
    for (const a of ARENAS) for (const p of ['naive', 'counter']) for (const seed of [1, 2, 3]) {
      const one = Sim.runArena(a.id, p, seed, { C }), two = Sim.runArena(a.id, p, seed, { C });
      eq([one.reasons, one.replay.actions, one.reads, one.endHash], [two.reasons, two.replay.actions, two.reads, two.endHash], `${a.id}.${p} seed ${seed}`);
    }
  });

  test('a seed run alone in a fresh context decides exactly as it does after other seeds in a shared one (policies keep their memory in obs.memory)', () => {
    const shared = Sim.load(), alone = Sim.load();
    for (const a of ARENAS) for (const p of ['naive', 'counter']) {
      for (const seed of [1, 2, 3, 4]) Sim.runArena(a.id, p, seed, { C: shared });
      const after = Sim.runArena(a.id, p, 5, { C: shared }), fresh = Sim.runArena(a.id, p, 5, { C: alone });
      eq([after.reasons, after.replay.actions, after.reads], [fresh.reasons, fresh.replay.actions, fresh.reads], `${a.id}.${p} seed 5`);
    }
  });

  test('the cards print: each policy has a summary, its rules in order and its weights, in clean words, and the README holds them', () => {
    const readme = fs.readFileSync(path.join(root, 'tools/policies/README.md'), 'utf8');
    for (const a of ARENAS) {
      eq(C.Policies.list().filter(p => p.group === a.id).map(p => p.name), [`${a.id}.naive`, `${a.id}.counter`]);
      for (const p of ['naive', 'counter']) {
        const { name, policy } = C.Policies.get(`${a.id}.${p}`);
        assert.equal(C.Policies.checkCard(policy.card), null);
        const text = C.Cards.text(name, policy);
        clean(text);
        assert.ok(text.startsWith(`${name}: ${policy.card.summary}`) && text.includes('  1. '), text);
        assert.ok(readme.includes(`### ${name}\n\n${policy.card.summary}\n`), `the README has ${name}'s card`);
      }
    }
    const { spawnSync } = require('node:child_process');
    const lint = spawnSync(process.execPath, [path.join(root, 'tools/lint-core.js'), ...ARENAS.map(a => path.join(root, 'tools/policies', a.id + '.js'))], { encoding: 'utf8' });
    assert.equal(lint.status, 0, lint.stdout);
  });
};
