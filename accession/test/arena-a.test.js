// The archetype arenas of W2b-ARENA-A (BUILD.md §10.3): the plodder, darter, splitter and
// mote_swarm stamps in test/arena/ and their naive and counterplay policies in
// tools/policies/. Each stamp is §10.3's arena; each policy does what its card says, from
// what it sees; seeds 1–20 run paired as a smoke test, with every invariant checked after
// every step, and the counterplay is not worse; and a policy decides the same on a seed
// however often, and whatever ran before it. The 200-seed gate is Wave 3's.
module.exports = ({ test, assert, root, path }) => {
  const Sim = require(path.join(root, 'tools/sim.js'));
  const Stats = require(path.join(root, 'tools/stats.js'));
  const C = Sim.load();
  const J = v => JSON.parse(JSON.stringify(v)), eq = (a, b, m) => assert.deepEqual(J(a), J(b), m);
  const clean = (s, what) => assert.doesNotMatch(String(s), /undefined|NaN|\[object|\bnull\b/, `${what}: not a clean sentence: ${s}`);
  const SEEDS = Sim.parseSeeds('1-20');
  const ARENAS = ['plodder', 'darter', 'splitter', 'mote_swarm'];
  // §10.3's table: each arena's goal, margin and number of exhibits.
  const TABLE = {
    plodder: { metric: 'hpLost <= 90%', bodies: 3 },
    darter: { metric: 'hpLost <= 70%', bodies: 1 },
    splitter: { metric: 'hpLost <= 70%', bodies: 1 },
    mote_swarm: { metric: 'hpLost <= 70%', bodies: C.N.SWARM_BODIES[0] },
  };
  const spec = id => Sim.arenaSpec(C, id);
  const metricOf = m => `${m.name} ${m.at === 'most' ? '<=' : '>='} ${m.pct}%`;

  // The one tile of a map a policy calls a doorway: walkable, with walls on two opposite
  // sides and open tiles on the other two. And a corner: walkable, with walls on two sides
  // that meet. Worked out here from the map, apart from the policies' own code.
  function gaps(state, kind) {
    const m = state.dept, open = (x, y) => C.Grid.walkable(m, x, y), out = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (!open(x, y)) continue;
      const door = (!open(x, y - 1) && !open(x, y + 1) && open(x - 1, y) && open(x + 1, y)) || (!open(x - 1, y) && !open(x + 1, y) && open(x, y - 1) && open(x, y + 1));
      const corner = (!open(x, y - 1) || !open(x, y + 1)) && (!open(x - 1, y) || !open(x + 1, y));
      if (kind === 'door' ? door : corner) out.push([x, y]);
    }
    return out;
  }
  const on = (a, list) => list.some(([x, y]) => a.x === x && a.y === y);

  // The paired smoke runs, made once and shared by the tests below: seeds 1–20, every
  // invariant after every step, with each run's events.
  const smoke = {};
  const pairedOf = id => smoke[id] || (smoke[id] = Sim.paired(id, 'naive', 'counter', SEEDS, { C, check: true, coreHash: 'test', log: true }));
  // The health a run took from the exhibits: every blow's damage to one, summed (a split
  // moves health between halves and takes none).
  const dealt = run => run.events.filter(e => e.k === 'damaged' && e.who !== 'you').reduce((t, e) => t + e.amount, 0);

  // A run replayed from its start alone: each(state before the step, action, step number),
  // then after(state after it, its events, step number).
  function replay(r, each, after) {
    const s = Sim.rebuild(r.replay.start, r.replay.options, C);
    r.replay.actions.forEach((a, i) => { if (each) each(s, a, i); const ev = C.Step.step(s, a); if (after) after(s, ev, i); });
    return s;
  }

  // The tiles the darter d could step back to after its blow if you stood on (x, y), by its
  // own rule (rules/arch/darter.js): an empty tile beside it, not a closed door, farther from
  // you by its walking distance (AI.field). Worked out from the state, apart from the
  // policy's own code, which reads only what the view model shows.
  function backRoom(s, d, x, y) {
    const m = s.dept, f = C.AI.field(s, d, [x, y], 'onto'), here = f[d.y * m.w + d.x];
    if (here < 0) return 0;
    let n = 0;
    for (let k = 0; k < 8; k++) {
      const nx = d.x + C.Grid.DX[k], ny = d.y + C.Grid.DY[k], o = C.Actors.at(s, nx, ny, d);
      if (C.Grid.canStep(m, d.x, d.y, k, 'exhibit') && !C.Grid.closedDoor(m, nx, ny) && f[ny * m.w + nx] > here && (!o || o.uid === 'you')) n++;
    }
    return n;
  }
  // The darter's blows in a run, and those after which it did not step back (it was
  // cornered), leaving out a blow that ended the visit.
  function darterBlows(run) {
    let blows = 0, stayed = 0;
    replay(run, null, (s, ev) => {
      if (ev.some(e => e.k === 'died' && e.who === 'you')) return;
      ev.forEach((e, i) => {
        if (e.k !== 'attacked' || e.by === 'you') return;
        blows++;
        const next = ev.slice(i + 1), end = next.findIndex(x => x.k === 'attacked');
        if (!(end < 0 ? next : next.slice(0, end)).some(x => x.k === 'moved' && x.who === e.by)) stayed++;
      });
    });
    return { blows, stayed };
  }

  test('each stamp is §10.3\'s arena: its goal, cap, depths, metric, species, exhibits hunting you, and the kit a run starts with', () => {
    for (const id of ARENAS) {
      const sp = spec(id), T = TABLE[id];
      eq([sp.arena, sp.goal, sp.cap, sp.depths, sp.seen, metricOf(sp.metric)], [id, { k: 'kill', chars: [] }, 200, [2, 5], 'all', T.metric], id);
      const list = C.Arena.speciesList(sp);
      assert.ok(list.length > 0 && list.every(s => s.archetype === id), `${id}: its species are the packs' ${id}s`);
      // Every species of the archetype meets both depths in the first 2 × S seeds.
      const met = [];
      for (let seed = 1; seed <= 2 * list.length; seed++) {
        const s = C.Arena.build(sp, seed), you = s.actors[0], ex = s.actors.slice(1);
        met.push(`${C.Arena.speciesFor(sp, seed).id}@${s.dept.depth}`);
        assert.equal(ex.length, T.bodies, `${id} seed ${seed}: ${T.bodies} exhibits`);
        for (const a of ex) {
          assert.equal(a.arch, id, `${id} seed ${seed}: ${a.uid} is a ${id}`);
          assert.equal(a.sp, C.Arena.speciesFor(sp, seed).id);
          assert.equal(a.mode, 'hunting', `${id} seed ${seed}: ${a.uid} starts hunting you`);
          assert.ok(C.AI.sees(s, a), `${id} seed ${seed}: ${a.uid} sees you from the start`);
          const label = C.Obs.text(C.Labels.of(s, a.uid));
          clean(label, `${id} ${a.uid}'s label`);
          assert.ok(label.includes(C.Clauses.line(C.Packs.speciesFor(s, a), { depth: s.dept.depth, rulesOff: [] })), `${id}: ${a.uid}'s label has its Behaviour line`);
        }
        // The kit a run starts with: a T1 weapon (Balanced unless a policy brings its own) and
        // a T1 Standard garment, at grade I, and nothing else.
        const w = s.items.find(i => i.uid === s.you.kit.weapon), g = s.items.find(i => i.uid === s.you.kit.garment);
        eq([w.form, w.tier, w.level, g.form, g.tier, g.level, s.run.grade, s.you.tote, s.you.kit.curio, s.you.kit.instrument, you.maxHp],
          ['balanced', 1, 0, 'standard', 1, 0, 1, [], [null, null], null, C.N.PLAYER_HP], `${id} seed ${seed}: the starting kit`);
      }
      for (const s of list) for (const d of [2, 5]) assert.ok(met.includes(`${s.id}@${d}`), `${id}: ${s.id} meets depth ${d}`);
      const s = C.Arena.build(sp, 1), doors = gaps(s, 'door');
      if (id === 'plodder' || id === 'mote_swarm') {
        // One doorway, one step from you, and every exhibit on your side of it.
        assert.equal(doors.length, 1, `${id}: one doorway`);
        const [dx, dy] = doors[0], you = s.actors[0];
        assert.equal(Math.max(Math.abs(you.x - dx), Math.abs(you.y - dy)), 1, `${id}: you start one step from the doorway`);
        const m = s.dept, cut = Object.assign({}, m, { tiles: m.tiles.map((r, y) => y === dy ? r.slice(0, dx) + '#' + r.slice(dx + 1) : r) });
        const near = C.Grid.distances(cut, [[you.x, you.y]], m.w * m.h, null, 'exhibit');
        for (const a of s.actors.slice(1)) assert.ok(near[a.y * m.w + a.x] >= 0, `${id}: ${a.uid} is in your room, on this side of the doorway`);
      } else assert.equal(doors.length, 0, `${id}: an open room, with no doorway`);
      if (id === 'splitter') {
        const b = s.actors[1];
        for (let d = 0; d < 8; d++) assert.ok(C.Grid.canStep(s.dept, b.x, b.y, d, 'exhibit'), 'the splitter has room beside it to split, all round');
      }
    }
  });

  test('the cards print: naive and counter for each arena, each with a summary and its rules in order, in the README', () => {
    const readme = C.Cards.readme();
    for (const id of ARENAS) for (const k of ['naive', 'counter']) {
      const p = C.Policies.get(`${id}.${k}`);
      assert.ok(p, `${id}.${k} is registered`);
      assert.equal(C.Policies.check(p.name, p.policy), null);
      const card = C.Cards.text(p.name, p.policy);
      clean(card, p.name);
      assert.match(card, new RegExp(`^${id}\\.${k}: \\S`));
      assert.match(card, /\n  1\. \S/);
      assert.ok(readme.includes(`### ${id}.${k}\n\n${p.policy.card.summary}\n`), `${id}.${k} is in the README`);
    }
    // §10.3's splitter row: Light against Heavy, and nothing else differs in the kit (the
    // tier is the arena's, so the stamp alone says it).
    eq([C.Policies.get('splitter.naive').policy.kit, C.Policies.get('splitter.counter').policy.kit],
      [{ weapon: { form: 'light' } }, { weapon: { form: 'heavy' } }]);
    for (const id of ['plodder', 'darter', 'mote_swarm']) for (const k of ['naive', 'counter']) assert.equal(C.Policies.get(`${id}.${k}`).policy.kit, undefined, `${id}.${k} wears the arena's kit`);
  });

  test('seeds 1–20 paired, with every invariant after every step: each run ends cleanly, and the counterplay is not worse', () => {
    for (const id of ARENAS) {
      const r = pairedOf(id);
      for (const run of r.a.runs.concat(r.b.runs)) {
        const at = `${id} ${run.policy} seed ${run.seed}`;
        eq(run.violations, [], `${at}: no violations`);
        assert.equal(run.error, null, `${at}: ${run.error}`);
        assert.ok(['won', 'died', 'cap'].includes(run.stopped), `${at} stopped ${run.stopped}`);
        assert.equal(run.reasons.length, run.steps);
        run.reasons.forEach(line => clean(line, at));
        for (const rd of run.reads) clean(rd.text, `${at} read ${rd.target}`);
      }
      // Not worse, by §10.3's own statistics turned round: worse would be a counterplay that
      // loses more HP in total than naive, with the 95% interval of the per-seed difference
      // (counterplay − naive) wholly above zero.
      const s = r.stats.hpLost;
      console.log(`  ${id}, seeds 1–20: HP lost ${s.sumB} with the counterplay against ${s.sumA} naive; ${r.verdict.sentence}`);
      assert.ok(!(s.sumB > s.sumA && s.lo > 0), `${id}: the counterplay is worse than naive on seeds 1–20: ${r.verdict.sentence}`);
      // HP lost stops counting at a death, so where naive dies on (nearly) every seed it cannot
      // show a worse counterplay. So the health each took from the exhibits (the kill goal's
      // progress, which goes on counting up to the death) is compared too, the same way: worse
      // would be a counterplay that takes less in total, with the interval wholly below zero.
      const d = Stats.compare(r.a.runs.map(dealt), r.b.runs.map(dealt), { path: `bootstrap/${id}/dealt` });
      console.log(`  ${id}, seeds 1–20: health taken from the exhibits ${d.sumB} with the counterplay against ${d.sumA} naive; the mean per-seed difference is ${d.mean.toFixed(2)} (95% interval ${d.lo.toFixed(2)} to ${d.hi.toFixed(2)})`);
      assert.ok(!(d.sumB < d.sumA && d.hi < 0), `${id}: the counterplay takes less health from the exhibits than naive on seeds 1–20: ${d.sumB} against ${d.sumA}, interval ${d.lo} to ${d.hi}`);
    }
  });

  test('the plodder and mote_swarm counterplay steps into the doorway and fights only from there; naive fights in the open', () => {
    for (const id of ['plodder', 'mote_swarm']) {
      const r = pairedOf(id);
      let crowded = 0;
      for (const run of r.b.runs) {
        let inDoor = false;
        replay(run, (s, a, i) => {
          const at = `${id} counter seed ${run.seed} step ${i + 1}`, doors = gaps(s, 'door'), you = s.actors[0];
          if (i === 0) assert.ok(a.a === 'move' && on({ x: you.x + C.Grid.DX[a.dir], y: you.y + C.Grid.DY[a.dir] }, doors), `${at}: its first action steps into the doorway`);
          if (on(you, doors)) inDoor = true;
          if (inDoor) assert.ok(a.a === 'attack' || a.a === 'wait', `${at}: once in the doorway it stays there (${C.Obs.say(a)})`);
        });
      }
      for (const run of r.a.runs) {
        let most = 0;
        replay(run, (s, a, i) => {
          const you = s.actors[0];
          assert.ok(!on(you, gaps(s, 'door')), `${id} naive seed ${run.seed} step ${i + 1}: it never stands in the doorway`);
          if (a.a === 'attack') most = Math.max(most, s.actors.filter(x => x !== you && !x.gone && C.Actors.between(you, x) === 1).length);
        });
        if (most >= 2) crowded++;
      }
      // In the open, more than one exhibit is beside it at some blow on most seeds.
      assert.ok(crowded > SEEDS.length / 2, `${id}: naive fought with two or more exhibits beside it on ${crowded} of ${SEEDS.length} seeds`);
    }
  });

  test('the darter counterplay corners it: it strikes whenever it can, and otherwise steps nearer by the step that leaves the darter the fewest tiles to step back to, so the darter is cornered on more of its blows; naive chases it and never waits while it can walk after it', () => {
    const r = pairedOf('darter');
    for (const run of r.b.runs) replay(run, (s, a, i) => {
      const you = s.actors[0], d = s.actors[1], at = `darter counter seed ${run.seed} step ${i + 1}`, legal = C.Step.legal(s);
      if (d.gone) return;
      if (legal.some(l => l.a === 'attack' && l.uid === d.uid)) { eq(a, { a: 'attack', uid: d.uid }, `${at}: it strikes the darter beside it`); return; }
      const now = C.Actors.between(you, d), nearer = legal.filter(l => l.a === 'move').map(l => [l, you.x + C.Grid.DX[l.dir], you.y + C.Grid.DY[l.dir]])
        .filter(([, x, y]) => !C.Actors.at(s, x, y, you) && Math.max(Math.abs(x - d.x), Math.abs(y - d.y)) < now);
      assert.ok(a.a === 'move' || !nearer.length, `${at}: it waits only when no step brings it nearer (${C.Obs.say(a)})`);
      if (a.a !== 'move' || !nearer.length) return;
      const x = you.x + C.Grid.DX[a.dir], y = you.y + C.Grid.DY[a.dir], least = Math.min(...nearer.map(([, nx, ny]) => backRoom(s, d, nx, ny)));
      assert.ok(nearer.some(([l]) => l.dir === a.dir), `${at}: its step brings it nearer the darter`);
      assert.equal(backRoom(s, d, x, y), least, `${at}: its step leaves the darter the fewest tiles to step back to`);
    });
    for (const run of r.a.runs) replay(run, (s, a, i) => {
      const obs = C.Obs.make(s, [], null, null), foes = C.Obs.hostiles(obs.vm);
      if (a.a === 'wait') assert.ok(!foes.some(f => C.Obs.step(obs, f.x, f.y)), `darter naive seed ${run.seed} step ${i + 1}: it waits only with no way after the darter`);
    });
    // The darter's own rule at the centre: against the counterplay it is cornered (no step
    // back after its blow) on a larger share of its blows than against naive.
    const share = side => side.runs.map(darterBlows).reduce((t, b) => ({ blows: t.blows + b.blows, stayed: t.stayed + b.stayed }), { blows: 0, stayed: 0 });
    const n = share(r.a), c = share(r.b);
    console.log(`  darter, seeds 1–20: cornered on ${c.stayed} of its ${c.blows} blows against the counterplay, ${n.stayed} of ${n.blows} against naive`);
    assert.ok(c.blows > 0 && n.blows > 0 && c.stayed * n.blows > n.stayed * c.blows, `the darter is cornered on more of its blows against the counterplay: ${c.stayed}/${c.blows} against ${n.stayed}/${n.blows}`);
  });

  test('the two splitter policies wear Light and Heavy weapons and otherwise decide alike', () => {
    const r = pairedOf('splitter');
    const naive = C.Policies.get('splitter.naive').policy, counter = C.Policies.get('splitter.counter').policy;
    for (const [side, form] of [[r.a, 'light'], [r.b, 'heavy']]) for (const run of side.runs) {
      const s = Sim.rebuild(run.replay.start, run.replay.options, C), w = s.items.find(i => i.uid === s.you.kit.weapon);
      eq([w.form, w.tier, w.level, s.run.grade], [form, 1, 0, 1], `${run.policy} seed ${run.seed} wears a T1 ${form} weapon at grade I`);
    }
    // At every step of naive's runs, the counterplay given the same view chooses the same.
    for (const run of r.a.runs) replay(run, (s, a, i) => {
      const d = counter.decide(C.Obs.make(s, [], null, null, { memory: {} })), n = naive.decide(C.Obs.make(s, [], null, null, { memory: {} }));
      eq([d.action, n.action], [a, a], `splitter seed ${run.seed} step ${i + 1}`);
      assert.equal(d.reason.replace('Heavy', 'Light'), n.reason);
    });
  });

  test('a policy decides alike on a seed run twice, and alone in a fresh context as after other seeds (its memory is its run\'s own)', () => {
    const fresh = Sim.load(), pick = run => [run.reasons, run.replay.actions, run.reads];
    for (const id of ARENAS) {
      const r = pairedOf(id);
      for (const [k, side] of [['naive', r.a], ['counter', r.b]]) {
        // Seed 7 (depth 2) and seed 12 (depth 5), each against its run in the paired smoke.
        for (const seed of [7, 12]) {
          const was = side.runs.find(x => x.seed === seed);
          const again = Sim.runArena(id, `${id}.${k}`, seed, { C, coreHash: 'test' });
          eq(pick(again), pick(was), `${id}.${k} seed ${seed}: the same decisions run again`);
        }
        const alone = Sim.runArena(id, `${id}.${k}`, 12, { C: fresh, coreHash: 'test' });
        eq(pick(alone), pick(side.runs.find(x => x.seed === 12)), `${id}.${k} seed 12: alone in a fresh context as after seeds 1–11`);
        assert.ok(k === 'naive' || id === 'splitter' || alone.reads.length > 0, `${id}.${k} reads the labels it says it reads`);
      }
    }
  });
};
