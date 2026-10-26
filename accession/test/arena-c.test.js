// The arenas of W2b-ARENA-C (BUILD.md §10.3): herald, tethered_warden, mimic_vitrine and
// night_watchman, with their naive and counterplay policies (tools/policies/<id>.js). Each
// stamp is the arena §10.3 names, built as the plan chose it, and a fair test of its rule:
// what naive meets comes from the archetype (the herald's call, not your ring, wakes the
// fodder; the warden strikes every tile the item can be taken from; the night-watch bell rings
// before the exit is reached), and what the counterplay wins comes from its counterplay (the
// warden's lure is the fork's: without it, or late, the same moves are struck); seeds 1–20
// run paired, every invariant checked after every step, as a smoke test (the counterplay is
// not worse, and reaches the goal at least as often); each counterplay does what its card
// says; and the policies are deterministic, whatever ran before them. The 200-seed gate is
// Wave 3's.
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

  test('herald: a herald and three sleeping fodder (M11.5) within its call but out of the ring of every tile of the straight way, beside which it sleeps, with a hidden way round', () => {
    const s = spec('herald');
    eq(s.goal, { k: 'reach', chars: ['D'] });
    const [door] = cell(s, 'D', 0);
    for (const seed of [1, 2, 3, 4]) {
      const L = layout(s, seed), st = C.Arena.build(s, seed), [h] = uidOf(L, 'C').map(u => byUid(st, u)), fodder = uidOf(L, 'F').map(u => byUid(st, u));
      assert.equal(C.Grid.ch(st.dept, door.x, door.y), "'", 'the far door is an open door');
      eq([h.sp, h.arch, h.mode], [L.sp, 'herald', 'dormant'], `seed ${seed}`);
      assert.equal(fodder.length, 3);
      const m = st.dept, you = st.actors[0], way = C.Path.to(st, door.x, door.y);
      // A sleeper gains a ring pip on a tile within RING_MOVING walking tiles of you with a line
      // to you (§8.2): the straight way passes the herald so, and none of the fodder.
      const inRing = (a, x, y) => C.Grid.distances(m, [[x, y]], N.RING_MOVING)[a.y * m.w + a.x] >= 0 && C.Grid.los(m, a.x, a.y, x, y);
      assert.ok(way.some(([x, y]) => inRing(h, x, y)), 'the straight way passes within the herald\'s ring');
      for (const f of fodder) {
        eq([f.sp, f.role, f.mode], ['M11.5', 'fodder', 'dormant']);
        assert.ok(C.Grid.disc(f.x - h.x, f.y - h.y, N.HERALD_RANGE), `${f.uid} is within the call's ${N.HERALD_RANGE} tiles`);
        assert.ok(!way.some(([x, y]) => inRing(f, x, y)) && !inRing(f, you.x, you.y), `${f.uid} is out of the ring of every tile of the straight way, so only the call wakes it`);
      }
      // The straight way passes within the herald's sight; another way, out of it, is a few
      // steps longer.
      const sees = (x, y) => C.Grid.disc(x - h.x, y - h.y, N.SIGHT_EXHIBIT) && C.Grid.los(m, h.x, h.y, x, y);
      assert.ok(way.some(([x, y]) => sees(x, y)), 'the shortest way is in its sight');
      const hidden = { dept: { w: m.w, h: m.h, tiles: m.tiles.map((r, y) => r.split('').map((c, x) => sees(x, y) ? '#' : c).join('')), fixtures: [] }, actors: st.actors, run: st.run };
      const round = C.Path.to(hidden, door.x, door.y);
      assert.ok(round.length > way.length && round.length <= way.length + 4, `the hidden way is a few steps longer: ${round.length} against ${way.length}`);
      assert.ok(round.some(([x, y]) => C.Grid.disc(x - h.x, y - h.y, N.SIGHT_EXHIBIT)), 'the hidden way passes within its sight range, behind a wall');
      assert.equal(sees(you.x, you.y), false, 'you start out of its sight');
      assert.ok(C.Grid.disc(h.x - you.x, h.y - you.y, N.SIGHT_PLAYER) && C.Grid.los(m, you.x, you.y, h.x, h.y), 'you can see it, and read it, from the start');
    }
  });

  test('herald: what naive wakes is the call — with a plain fodder in the herald\'s place, walking the straight way wakes only that one', () => {
    const text = fs.readFileSync(path.join(root, 'test/arena/herald.txt'), 'utf8');
    const plain = C.Arena.parse(text.replace(/^legend: C exhibit sp;/m, 'legend: C exhibit sp=M11.5;'));
    for (const seed of [1, 2, 3, 4]) {
      const withHerald = Sim.runArena('herald', 'naive', seed, { C }), without = Sim.runArena(plain, 'naive', seed, { C });
      eq([withHerald.outcome.woken, without.outcome.woken], [4, 1], `seed ${seed}: woken with the herald and with a plain fodder in its place`);
    }
  });

  test('tethered_warden: a warden asleep at its own place beside the item it guards, every tile you could take it from one the warden strikes from there and none a step from outside its tether, and a Tuning Fork of 3 charges', () => {
    const s = spec('tethered_warden');
    eq(s.goal, { k: 'take', chars: ['I'] });
    const [item] = cell(s, 'I', 0), [wc] = cell(s, 'W', 0);
    for (const seed of [1, 2]) {
      const L = layout(s, seed), st = C.Arena.build(s, seed), [w] = uidOf(L, 'W').map(u => byUid(st, u)), you = st.actors[0], m = st.dept;
      eq([w.sp, w.arch, w.mode, w.trigger], ['S9.4', 'tethered_warden', 'dormant', 'tether'], `seed ${seed}`);
      // Its place (home) is where it is made, as in a department (§8.2): going back is going there.
      eq([w.guards, w.home, [w.x, w.y]], [[item.x, item.y], [wc.x, wc.y], [wc.x, wc.y]]);
      const inTether = (x, y) => C.Grid.disc(x - item.x, y - item.y, N.TETHER_RANGE);
      assert.ok(inTether(w.x, w.y) && C.Grid.chebyshev(w.x, w.y, item.x, item.y) === 1, 'it sleeps beside the item');
      assert.ok(!inTether(you.x, you.y), 'you start outside its tether');
      const sees = (x0, y0, x1, y1) => C.Grid.disc(x1 - x0, y1 - y0, N.SIGHT_PLAYER) && C.Grid.los(m, x0, y0, x1, y1);
      assert.ok(sees(you.x, you.y, w.x, w.y) && sees(you.x, you.y, item.x, item.y), 'you can see the warden and the item from the start');
      // The tiles you could take the item from (its own and those beside it, past no corner).
      const takes = [[item.x, item.y]];
      for (let d = 0; d < 8; d++) {
        const x = item.x + C.Grid.DX[d], y = item.y + C.Grid.DY[d];
        if (C.Grid.walkable(m, x, y) && (!C.Grid.DX[d] || !C.Grid.DY[d] || (C.Grid.walkable(m, item.x, y) && C.Grid.walkable(m, x, item.y)))) takes.push([x, y]);
      }
      for (const [x, y] of takes) {
        if (x === w.x && y === w.y) continue;
        // A blow from its place, past no corner (§8.1): walking in costs one.
        const dx = x - w.x, dy = y - w.y;
        assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1 && (!dx || !dy || (C.Grid.walkable(m, w.x, y) && C.Grid.walkable(m, x, w.y))), `${x},${y}: the warden strikes it from its place`);
        // No step from outside the tether lands on it, so stepping in and taking at once, in
        // the beat after the tether wakes it, is not open.
        for (let d = 0; d < 8; d++) {
          const ox = x - C.Grid.DX[d], oy = y - C.Grid.DY[d];
          assert.ok(inTether(ox, oy) || !C.Grid.canStep(m, ox, oy, d), `${x},${y} is a step from ${ox},${oy}, outside the tether`);
        }
      }
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

  test('night_watchman: the clock one count short of the night watch, the Watchman coming in at the entrance behind you at the first boundary, the exit further than a night-watch bell, and sleepers out of the gallery\'s ring for the bells', () => {
    const s = spec('night_watchman');
    eq(s.goal, { k: 'leave', chars: [] });
    eq(s.clock, { B: 220, G: 60, count: 279 });
    for (const seed of [1, 2]) {
      const L = layout(s, seed), st = C.Arena.build(s, seed), m = st.dept, you = st.actors[0];
      eq([m.clock.B, m.clock.G, m.clock.count, m.clock.stage], [220, 60, 279, 1]);
      assert.ok(m.entrance && m.exits.length === 1, 'an entrance and an exit');
      // The way out takes longer than the first bell, which rings NIGHT_WAKE_EVERY counts after
      // the night watch begins (§8.4), so leaving meets it.
      const [ex, ey] = m.exits[0], out = C.Path.to(st, ex, ey);
      assert.ok(out.length > N.NIGHT_WAKE_EVERY + 1, `the exit is ${out.length} steps away`);
      const sleepers = uidOf(L, 'F').map(u => byUid(st, u));
      assert.equal(sleepers.length, 8);
      for (const f of sleepers) {
        eq([f.sp, f.mode], ['M11.5', 'dormant']);
        // Out of your ring from every tile of the way out (and where you start), so only the
        // bells wake them as you leave.
        assert.ok(![[you.x, you.y], ...out].some(([x, y]) => C.Grid.distances(m, [[x, y]], N.RING_MOVING)[f.y * m.w + f.x] >= 0 && C.Grid.los(m, f.x, f.y, x, y)), `${f.uid} is in the ring of the way out`);
      }
      const ev = C.Step.step(st, { a: 'wait' });
      assert.equal(m.clock.stage, 2, 'the night watch has begun');
      const entered = ev.filter(e => e.k === 'entered');
      assert.equal(entered.length, 1);
      const w = byUid(st, entered[0].who);
      eq([w.sp, w.arch, w.mode, w.x, w.y], ['night_watchman', 'night_watchman', 'hunting', m.entrance[0], m.entrance[1]]);
      assert.ok(Math.abs(w.x - ex) > Math.abs(you.x - ex), 'it comes in behind you');
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
    // naive walks into the herald's ring and sight: it wakes, calls, and the call wakes the
    // three fodder, which nothing else wakes.
    for (const x of R('herald').a.runs) {
      assert.ok(events(x, 'telegraphed').some(e => e.sp === 'call'), `naive seed ${x.seed}: the herald calls`);
      const woke = events(x, 'woke').filter(e => e.was === 'dormant').map(e => e.cause.k).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      eq(woke, ['herald', 'herald', 'herald', 'ring'], `naive seed ${x.seed}: what woke`);
    }
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
    // warden: the counterplay uses the fork three times from outside the tether, and its noise
    // wakes the warden, which goes to look and is not hunting when you step in; the warden
    // never strikes it; naive is struck on some seeds.
    const t = spec('tethered_warden'), [item] = cell(t, 'I', 0);
    for (const x of R('tethered_warden').b.runs) {
      const forks = events(x, 'used').filter(e => e.how === 'fork');
      assert.equal(forks.length, 3, `counter seed ${x.seed}: ${forks.length} uses of the fork`);
      eq(events(x, 'woke').map(e => [e.cause.k, e.mode]), [['noise', 'awake']], `counter seed ${x.seed}: the fork's noise wakes it, to look`);
      const st = Sim.rebuild(x.replay.start, x.replay.options, C), w = st.actors.find(a => a.arch === 'tethered_warden');
      let inside = false;
      for (const act of x.replay.actions) {
        if (act.a === 'use') assert.equal(C.Grid.disc(st.actors[0].x - item.x, st.actors[0].y - item.y, N.TETHER_RANGE), false, `counter seed ${x.seed}: it used the fork inside the tether`);
        const wasInside = inside;
        C.Step.step(st, act);
        inside = C.Grid.disc(st.actors[0].x - item.x, st.actors[0].y - item.y, N.TETHER_RANGE);
        if (inside && !wasInside) assert.equal(w.mode, 'awake', `counter seed ${x.seed}: the warden saw it coming in`);
      }
      assert.equal(events(x, 'damaged').filter(e => e.who === 'you').length, 0, `counter seed ${x.seed}: the warden struck it`);
      assert.equal(x.outcome.won, true);
    }
    assert.ok(R('tethered_warden').a.runs.filter(x => x.outcome.hpLost > 0).length >= 10, 'naive is struck on at least half the seeds');
    // night watch: the counterplay leaves on every seed; naive stays and dies.
    // On its way out the first night-watch bell rings, and wakes the three sleepers nearest it.
    for (const x of R('night_watchman').b.runs) {
      eq([x.stopped, x.outcome.left, x.outcome.died], ['won', true, false], `counter seed ${x.seed}`);
      assert.ok(events(x, 'stage').length >= 1, `counter seed ${x.seed}: no night-watch bell rang before it left`);
      eq(events(x, 'woke').filter(e => e.was === 'dormant').map(e => e.cause.k), Array(N.NIGHT_WAKE_COUNT).fill('night_bell'), `counter seed ${x.seed}: what the bell woke`);
    }
    for (const x of R('night_watchman').a.runs) assert.equal(events(x, 'left').length, 0, `naive seed ${x.seed} left`);
  });

  test('tethered_warden: the lure is what wins — the counterplay\'s own moves with each use of the fork made a wait, or with two waits before it steps into the tether, are struck', () => {
    const t = spec('tethered_warden'), [item] = cell(t, 'I', 0);
    const R = paired().find(p => p.a.id === 'tethered_warden').r;
    const play = (x, acts) => {
      const st = Sim.rebuild(x.replay.start, x.replay.options, C), hp = st.actors[0].hp;
      for (const a of acts) { if (st.over) break; C.Step.step(st, a); }
      return hp - st.actors[0].hp;
    };
    let noFork = 0, late = 0;
    for (const x of R.b.runs) {
      const acts = x.replay.actions;
      noFork += play(x, acts.map(a => a.a === 'use' ? { a: 'wait' } : a)) > 0 ? 1 : 0;
      // The first step into the tether, two waits before it.
      const st = Sim.rebuild(x.replay.start, x.replay.options, C);
      let k = 0;
      for (; k < acts.length; k++) {
        const you = st.actors[0], d = acts[k].a === 'move' ? acts[k].dir : -1;
        if (d >= 0 && C.Grid.disc(you.x + C.Grid.DX[d] - item.x, you.y + C.Grid.DY[d] - item.y, N.TETHER_RANGE)) break;
        C.Step.step(st, acts[k]);
      }
      late += play(x, acts.slice(0, k).concat([{ a: 'wait' }, { a: 'wait' }], acts.slice(k))) > 0 ? 1 : 0;
    }
    assert.ok(noFork >= 10, `without the fork its way is struck on ${noFork} of 20 seeds`);
    assert.ok(late >= 5, `two actions late it is struck on ${late} of 20 seeds`);
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
