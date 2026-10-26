// The arenas of the kiter, the axis_sniper and the reflector (BUILD.md §10.3): their stamps
// (test/arena/{kiter,axis_sniper,reflector}.txt) and their naive and counterplay policies
// (tools/policies/{kiter,axis_sniper,reflector}.js). Each stamp builds what it says at both
// depths; the labels say what the counterplay bots read in them; each counterplay rule does
// what its card says in a staged room; the paired smoke run on seeds 1–20, with every
// invariant after every step, finds the counterplay bot no worse on the arena's metric, nor
// less far with its goal; and the bots decide alike twice over, and alike on a seed run alone
// in a fresh context and run after other seeds (§10.2). The 200-seed gate is Wave 3's:
//   node tools/sim.js --arena <id> --paired naive counter --seeds 1-200
module.exports = ({ test, assert, root, path, fs }) => {
  const Sim = require(path.join(root, 'tools/sim.js'));
  const Stats = require(path.join(root, 'tools/stats.js'));
  const C = Sim.load();
  const J = v => JSON.parse(JSON.stringify(v)), eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
  const clean = s => assert.doesNotMatch(String(s), /undefined|NaN|\[object|\bnull\b/, `not a clean sentence: ${s}`);
  const ARENAS = ['kiter', 'axis_sniper', 'reflector'];
  const SEEDS = Sim.parseSeeds('1-20');
  const spec = id => Sim.arenaSpec(C, id);
  const label = (s, uid) => C.Obs.text(C.Labels.of(s, uid));
  const policy = ref => C.Policies.get(ref).policy;
  // What a policy sees now, with a memory of its own.
  const obsOf = (s, ev) => C.Obs.make(s, ev || [], [], C.Rng.stream({ seed: s.seed, rng: {} }, 'policy/test/' + s.seed), { memory: {} });
  const after = (s, action) => [s.actors[0].x + C.Grid.DX[action.dir], s.actors[0].y + C.Grid.DY[action.dir]];
  const stamp = (head, map) => C.Arena.parse(head.join('\n') + '\n\n' + map.join('\n') + '\n');

  test('each stamp builds what it says, at depth 2 on odd seeds and 5 on even ones', () => {
    for (const seed of [1, 2]) {
      const depth = seed === 1 ? 2 : 5;
      // kiter: the Signal Lamp set out hunting where it sees you; tier-3 kit at grade V, with
      // grade V's health.
      const ks = C.Arena.build(spec('kiter'), seed), k = ks.actors[1], you = ks.actors[0];
      eq([ks.dept.depth, ks.actors.length, k.sp, k.arch, k.mode, C.AI.sees(ks, k)], [depth, 2, 'M11.3', 'kiter', 'hunting', true], `kiter seed ${seed}`);
      eq([ks.run.grade, you.maxHp, you.hp], [5, C.Health.maxHp(5), C.Health.maxHp(5)]);
      for (const slot of ['weapon', 'garment']) {
        const it = ks.items.find(i => i.uid === ks.you.kit[slot]);
        eq([it.tier, C.Kit.short(it, ks.run.grade)], [3, 0], `the ${slot} is tier 3, worn at the grade it needs`);
      }
      // axis_sniper: the Heliograph set out hunting in the row you start in, at the far end,
      // beside the exit door; the straight way there (a tap's) runs along its row to the last
      // step.
      const as = C.Arena.build(spec('axis_sniper'), seed), a = as.actors[1], me = as.actors[0];
      eq([as.dept.depth, as.actors.length, a.sp, a.arch, a.mode, a.trigger, a.y === me.y], [depth, 2, 'M11.1', 'axis_sniper', 'hunting', 'axis', true], `axis_sniper seed ${seed}`);
      eq(as.dept.exits.length, 1);
      const [ex, ey] = as.dept.exits[0], way = C.Path.to(as, ex, ey);
      assert.ok(way.length > 10 && way.slice(0, -1).every(([, y]) => y === a.y), 'the straight way runs along its row');
      // reflector: the Dish asleep in the one doorway, the Lamp asleep behind it; a tier-3
      // Hand Lamp (a Pin-Driver) in your instrument slot, full.
      const rs = C.Arena.build(spec('reflector'), seed), dish = rs.actors[1], gun = rs.actors[2];
      eq([rs.dept.depth, rs.actors.length, dish.sp, dish.arch, dish.mode, gun.sp, gun.mode], [depth, 3, 'M11.4', 'reflector', 'dormant', 'M11.3', 'dormant'], `reflector seed ${seed}`);
      const pd = rs.items.find(i => i.uid === rs.you.kit.instrument);
      eq([pd.form, pd.ref, pd.tier, pd.charges, rs.actors[0].maxHp], ['pin_driver', 'M11.6', 3, C.N.PIN_DRIVER[0], C.Health.maxHp(5)]);
      eq(J(C.Arena.goal(spec('reflector'), rs)).uids, [gun.uid], 'the goal is the Lamp alone');
      // Every bolt from a tile outside its room, within the Pin-Driver's reach of the Lamp,
      // meets the Dish first, which sends it back.
      let lines = 0;
      for (let y = 0; y < rs.dept.h; y++) for (let x = 0; x < dish.x; x++) {
        if (!C.Grid.walkable(rs.dept, x, y)) continue;
        const f = C.Ranged.flight(rs, Object.assign({}, rs.actors[0], { x, y }), gun.x, gun.y, C.N.PIN_DRIVER[2]);
        if (f.code) continue;
        lines++;
        eq([f.victim, f.reflector], ['you', dish.uid], `a bolt from ${x},${y}`);
      }
      assert.ok(lines >= 2, `bolts from ${lines} tiles`);
    }
  });

  test('the labels say what the counterplay bots read: the kiter\'s distance and range, the sniper\'s line, the dish\'s returned shots', () => {
    for (const seed of [1, 2]) {
      const ks = C.Arena.build(spec('kiter'), seed);
      const km = /Keeps (\d+) to (\d+) tiles from you and shoots within (\d+) tiles/.exec(label(ks, ks.actors[1].uid));
      assert.ok(km, 'the kiter\'s label gives its distance and its range');
      eq(km.slice(1).map(Number), [C.N.KITER_HOLD[0], C.N.KITER_HOLD[1], C.N.ROLE_ARTILLERY_RANGE]);
      const as = C.Arena.build(spec('axis_sniper'), seed), at = label(as, as.actors[1].uid);
      assert.match(at, /share your row or column/);
      eq([Number(/beam up to (\d+) tiles/.exec(at)[1]), Number(/row or column within (\d+) tiles/.exec(at)[1])], [C.N.AXIS_BEAM_RANGE, C.N.AXIS_RANGE]);
      const rs = C.Arena.build(spec('reflector'), seed);
      assert.match(label(rs, rs.actors[1].uid), /shots back into whoever fired them/);
      assert.doesNotMatch(label(rs, rs.actors[1].uid), /shoots within/, 'the dish is not taken for the artillery');
      assert.match(label(rs, rs.actors[2].uid), /shoots within \d+ tiles/);
    }
  });

  // How far a run got with its arena's goal, which HP lost cannot show, since a counterplay
  // that never takes the goal on loses none: for a kill goal, the health the goal's exhibits
  // lost, each from its starting health (all of it once destroyed); for leave, 1 if it left.
  function progress(id, run) {
    const S = spec(id);
    if (S.goal.k === 'leave') return run.outcome.won ? 1 : 0;
    const s0 = C.Arena.build(S, run.seed);
    let lost = 0;
    for (const uid of C.Arena.goal(S, s0).uids) {
      const start = s0.actors.find(a => a.uid === uid).hp;
      let hp = start;
      for (const e of run.events) if (e.who === uid && (e.k === 'damaged' || e.k === 'died')) hp = e.k === 'died' ? 0 : e.hp;
      lost += start - Math.max(0, hp);
    }
    return lost;
  }

  // The paired smoke runs, kept for the determinism tests below.
  const smoke = {};
  for (const id of ARENAS) test(`${id}: seeds 1–20 paired, every invariant after every step: the counterplay bot is not worse than naive, in HP lost or in the goal`, () => {
    const r = Sim.paired(id, 'naive', 'counter', SEEDS, { C, check: true, log: true });
    smoke[id] = r;
    for (const side of [r.a, r.b]) for (const run of side.runs) {
      assert.equal(run.error, null, `${run.policy} seed ${run.seed}: ${run.error}`);
      eq(run.violations, [], `${run.policy} seed ${run.seed}`);
      assert.ok(['won', 'died', 'left', 'cap'].includes(run.stopped), `${run.policy} seed ${run.seed} stopped ${run.stopped}`);
      assert.equal(run.reasons.length, run.steps);
      run.reasons.forEach(clean);
    }
    const sum = side => side.runs.reduce((t, x) => t + x.outcome.hpLost, 0);
    console.log(`  ${r.verdict.sentence} Won: naive ${r.stats.won.a}, counter ${r.stats.won.b} of ${SEEDS.length}.`);
    assert.ok(sum(r.b) <= sum(r.a), `${id}: counterplay lost ${sum(r.b)} HP over seeds 1–20, naive ${sum(r.a)}`);
    clean(r.verdict.sentence);
    // A counterplay that hides and never takes the goal on loses no HP, so the goal's progress
    // is compared too, with the same paired bootstrap: worse would be a counterplay that gets
    // less far in total, with the interval of the per-seed difference wholly below zero.
    const g = Stats.compare(r.a.runs.map(run => progress(id, run)), r.b.runs.map(run => progress(id, run)), { path: `bootstrap/${id}/goal` });
    console.log(`  ${id}: the goal's progress over seeds 1–20 (${spec(id).goal.k === 'leave' ? 'runs that left' : 'health the goal\'s exhibits lost'}): naive ${g.sumA}, counter ${g.sumB}; the mean per-seed difference is ${g.mean.toFixed(2)} (95% interval ${g.lo.toFixed(2)} to ${g.hi.toFixed(2)}).`);
    assert.ok(!(g.sumB < g.sumA && g.hi < 0), `${id}: the counterplay gets less far with the goal than naive on seeds 1–20: ${g.sumB} against ${g.sumA}, interval ${g.lo} to ${g.hi}`);
  });

  test('what each arena\'s counterplay avoids, from the smoke runs\' events: the beam, the kiter\'s shots, the bolts the dish sends back', () => {
    const hits = (run, f) => run.events.filter(e => e.k === 'damaged' && e.who === 'you' && f(e.cause)).length;
    // axis_sniper: naive walks on along the beam and is struck on every seed. The Heliograph
    // comes for counterplay too and aims at it on every seed (it aims only along a line on
    // you), and counterplay steps off the mark, is never struck, and leaves.
    const A = smoke.axis_sniper;
    assert.ok(A, 'the smoke run ran first');
    for (const run of A.a.runs) assert.ok(hits(run, c => c.k === 'special' && c.sp === 'line') >= 1, `naive seed ${run.seed} is struck by the beam`);
    for (const run of A.b.runs) {
      assert.ok(run.events.some(e => e.k === 'telegraphed'), `counter seed ${run.seed}: the Heliograph aims at it`);
      assert.ok(run.reasons.some(x => /off the mark/.test(x)), `counter seed ${run.seed} steps off the mark`);
      eq([hits(run, () => true), run.outcome.won], [0, true], `counter seed ${run.seed} is never struck, and leaves`);
    }
    // Keeping off its row and column, counterplay gives it a line less often.
    const aimed = side => side.runs.reduce((t, run) => t + run.events.filter(e => e.k === 'telegraphed').length, 0);
    assert.ok(aimed(A.b) < aimed(A.a), `the Heliograph aimed at counterplay ${aimed(A.b)} times, at naive ${aimed(A.a)}`);
    // kiter: counterplay is shot less often in all.
    const K = smoke.kiter, shots = side => side.runs.reduce((t, run) => t + hits(run, c => c.k === 'shot'), 0);
    assert.ok(shots(K.b) < shots(K.a), `the kiter shot counterplay ${shots(K.b)} times, naive ${shots(K.a)}`);
    // reflector: naive's first bolts come back on every seed; counterplay's never do, and it
    // strikes the dish before anything else, and lands bolts on the artillery.
    const R = smoke.reflector, back = run => run.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause && e.cause.k === 'reflected' && e.cause.shooter === 'you').length;
    for (const run of R.a.runs) assert.ok(back(run) >= 1, `naive seed ${run.seed} shoots through the dish`);
    let landed = 0;
    for (const run of R.b.runs) {
      eq(back(run), 0, `counter seed ${run.seed} never shoots into the dish`);
      const first = run.events.find(e => e.k === 'attacked' && e.by === 'you'), dish = C.Arena.layout(spec('reflector'), run.seed).exhibits.find(x => x.ch === 'R').uid;
      assert.equal(first.at, dish, `counter seed ${run.seed} strikes the dish first`);
      landed += run.events.filter(e => e.k === 'damaged' && e.cause && e.cause.k === 'item' && e.cause.by === 'you').length;
    }
    assert.ok(landed >= SEEDS.length, `counterplay's bolts hit the artillery ${landed} times`);
  });

  test('two runs of each policy on the same seeds make the same decisions, reads and replays', () => {
    for (const id of ARENAS) {
      const r = Sim.paired(id, 'naive', 'counter', SEEDS, { C });
      for (const side of ['a', 'b']) for (let i = 0; i < SEEDS.length; i++) {
        const x = r[side].runs[i], y = smoke[id][side].runs[i];
        eq([x.reasons, x.replay.actions, x.reads, x.endHash], [y.reasons, y.replay.actions, y.reads, y.endHash], `${x.policy} seed ${x.seed}`);
      }
    }
  });

  test('a seed run alone in a fresh context decides exactly as it does after other seeds in the shared one', () => {
    const fresh = Sim.load();
    for (const id of ARENAS) for (const p of ['naive', 'counter']) for (const seed of [7, 8]) {
      // In C every seed of the smoke runs (and of the run above) came before.
      const shared = Sim.runArena(id, p, seed, { C }), alone = Sim.runArena(id, p, seed, { C: fresh });
      eq([alone.reasons, alone.replay.actions, alone.reads], [shared.reasons, shared.replay.actions, shared.reads], `${id}.${p} seed ${seed}`);
      assert.ok(alone.reasons.length > 0);
    }
  });

  test('axis_sniper.counter steps off a marked tile; naive walks on along the beam', () => {
    // A hunting Heliograph at the end of your row sees you and aims along it; the exit door is
    // up that row, so the straight way stays in the beam.
    const S = stamp(['arena: axis_sniper', 'goal: leave', 'species: axis_sniper', 'depths: 2 5', 'seen: all', 'legend: A exhibit sp mode=hunting'],
      ['######X####', '#@.......A#', '#.........#', '#.........#', '###########']);
    for (const seed of [1, 2]) {
      const s = C.Arena.build(S, seed);
      let ev = [];
      for (let i = 0; i < 4 && !s.actors[1].telegraph; i++) ev = C.Step.step(s, { a: 'wait' });
      const tel = s.actors[1].telegraph, on = (x, y) => tel.tiles.some(([tx, ty]) => tx === x && ty === y);
      assert.ok(tel && on(s.actors[0].x, s.actors[0].y), 'the beam is marked over you');
      const c = policy('axis_sniper.counter').decide(obsOf(s, ev)), n = policy('axis_sniper.naive').decide(obsOf(s, ev));
      eq([c.action.a, n.action.a], ['move', 'move']);
      assert.ok(!on(...after(s, c.action)), `counter steps off the beam: ${c.reason}`);
      assert.match(c.reason, /off the mark/);
      assert.ok(on(...after(s, n.action)), `naive stays on it: ${n.reason}`);
      // The step taken, and a wait while the beam resolves: it misses counterplay, and
      // strikes naive.
      const struck = action => { const t = C.State.clone(s), e = C.Step.step(t, action).concat(C.Step.step(t, { a: 'wait' })); return e.some(x => x.k === 'damaged' && x.who === 'you' && x.cause.k === 'special'); };
      eq([struck(c.action), struck(n.action)], [false, true]);
    }
  });

  test('axis_sniper.counter steps off the row and column a sniper\'s label gives it, where a way round is shorter by the danger weight; naive walks along its row', () => {
    // A Heliograph asleep at the end of your row, in view, and the exit door up that row: the
    // straight way runs along its row, within its beam's reach and its axis trigger's.
    const S = stamp(['arena: axis_sniper', 'goal: leave', 'species: axis_sniper', 'depths: 2 5', 'seen: all', 'legend: A exhibit sp'],
      ['#######X###', '#@.......A#', '#.........#', '#.........#', '###########']);
    for (const seed of [1, 2]) {
      const s = C.Arena.build(S, seed), a = s.actors[1], o = obsOf(s);
      assert.ok(a.mode === 'dormant' && o.vm.actors.some(x => x.uid === a.uid), 'it sleeps, in view');
      const c = policy('axis_sniper.counter').decide(o), n = policy('axis_sniper.naive').decide(obsOf(s));
      const [cx, cy] = after(s, c.action), [, ny] = after(s, n.action);
      eq([c.action.a, n.action.a], ['move', 'move']);
      assert.ok(cx !== a.x && cy !== a.y, `counter steps off its row and column: ${c.reason}`);
      assert.match(c.reason, /outside the line of/);
      assert.equal(ny, a.y, `naive walks along its row: ${n.reason}`);
    }
  });

  test('kiter.counter steps out of the kiter\'s line of fire when it could shoot; naive walks into it', () => {
    // A hunting Lamp 5 tiles off with a clear shot at you, and a pillar beside you that
    // hides one tile from it.
    const S = stamp(['arena: kiter', 'goal: kill', 'species: kiter', 'depths: 2 5', 'seen: all', 'legend: K exhibit sp mode=hunting'],
      ['#########', '#.o.....#', '#@....K.#', '#.......#', '#########']);
    for (const seed of [1, 2]) {
      const s = C.Arena.build(S, seed), k = s.actors[1], you = s.actors[0];
      const fire = (x, y) => { const f = C.Ranged.flight(s, k, x, y, C.N.ROLE_ARTILLERY_RANGE); return !f.code && f.victim === 'you'; };
      assert.ok(C.AI.sees(s, k) && fire(you.x, you.y), 'it could shoot you where you stand');
      const c = policy('kiter.counter').decide(obsOf(s)), n = policy('kiter.naive').decide(obsOf(s));
      eq([c.action.a, n.action.a], ['move', 'move']);
      const [cx, cy] = after(s, c.action), [nx, ny] = after(s, n.action);
      assert.ok(!C.Grid.los(s.dept, k.x, k.y, cx, cy), `counter steps out of its sight: ${c.reason}`);
      assert.match(c.reason, /out of the line of fire/);
      assert.ok(C.Grid.los(s.dept, k.x, k.y, nx, ny) && C.Actors.dist(k, nx, ny) < C.Actors.dist(k, you.x, you.y), `naive walks at it in the open: ${n.reason}`);
    }
  });

  test('reflector.counter never fires a bolt the dish stands in the way of; naive does', () => {
    const S = spec('reflector');
    for (const seed of [1, 2]) {
      const s = C.Arena.build(S, seed), gun = s.actors[2];
      // You 5 tiles from the Lamp, 2 from the Dish, where the Pin-Driver can be aimed at the
      // Lamp through the doorway.
      s.actors[0].x = gun.x - 5; s.actors[0].y = gun.y;
      const o = obsOf(s), aim = o.legal.find(l => l.a === 'use' && l.x === gun.x && l.y === gun.y);
      assert.ok(aim, 'the Pin-Driver can be aimed at the Lamp');
      const n = policy('reflector.naive').decide(obsOf(s)), c = policy('reflector.counter').decide(obsOf(s));
      eq(J(n.action), J(aim), `naive fires: ${n.reason}`);
      assert.notEqual(c.action.a, 'use', `counter does not: ${c.reason}`);
      assert.match(c.reason, /dish/);
      // Fired, the bolt comes back into you.
      const t = C.State.clone(s), ev = C.Step.step(t, n.action);
      assert.ok(ev.some(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected' && e.cause.shooter === 'you'));
    }
    // A dish it cannot walk to (beyond a balustrade, which bolts pass) stands on the line to the
    // Lamp: counterplay still does not fire, and has nothing else to do, so it waits.
    const B = stamp(['arena: reflector', 'goal: kill A', 'species: reflector', 'depths: 2 5', 'seen: all', 'kit: instrument pin_driver tier=3', 'legend: R exhibit sp; A exhibit sp=M11.3'],
      ['#########', '#.@.~R.A#', '#...~...#', '#########']);
    for (const seed of [1, 2]) {
      const s = C.Arena.build(B, seed), gun = s.actors[2];
      const aim = obsOf(s).legal.find(l => l.a === 'use' && l.x === gun.x && l.y === gun.y);
      assert.ok(aim, 'the Pin-Driver can be aimed at the Lamp, through the dish');
      const n = policy('reflector.naive').decide(obsOf(s)), c = policy('reflector.counter').decide(obsOf(s));
      eq([J(n.action), c.action.a], [J(aim), 'wait'], `naive fires (${n.reason}); counterplay waits (${c.reason})`);
    }
  });

  test('the six cards print, each with its rules in order, in words', () => {
    for (const id of ARENAS) for (const p of ['naive', 'counter']) {
      const name = `${id}.${p}`, pol = policy(name), text = C.Cards.text(name, pol);
      eq(C.Policies.check(name, pol), null);
      assert.ok(text.startsWith(`${name}: `) && pol.card.rules.length >= 3, text);
      clean(text);
    }
    const readme = fs.readFileSync(path.join(root, 'tools/policies/README.md'), 'utf8');
    for (const id of ARENAS) assert.ok(readme.includes(`## ${id}\n`), `the README has the ${id} cards`);
  });

  test('a room made at a grade above I gives you that grade\'s health (§8.1: HP 20, +5 a grade above I), as the arenas\' grade V does', () => {
    for (const g of [1, 3, 5, 7]) {
      const s = C.Setup.room(1, { acc: 'T0', depth: 2, map: ['#####', '#...#', '#####'], you: [1, 1], grade: g });
      eq([s.run.grade, s.actors[0].hp, s.actors[0].maxHp], [g, C.N.PLAYER_HP + C.N.HP_PER_GRADE * (g - 1), C.N.PLAYER_HP + C.N.HP_PER_GRADE * (g - 1)], `grade ${g}`);
    }
    eq(C.Setup.room(1, { acc: 'T0', depth: 2, map: ['#####', '#...#', '#####'], you: [1, 1] }).actors[0].maxHp, C.N.PLAYER_HP, 'grade I if none is given');
  });
};
