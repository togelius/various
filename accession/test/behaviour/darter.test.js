// The darter's Behaviour line (BUILD.md §5.3, §5.5; W1-ARCH-A): "Moves two tiles a turn;
// strikes from beside you for {dmg}, then at once steps back {DARTER_STEP_BACK} tile if it has
// room." Each scenario is run for every pack species with the clause (S.9's Hoppers) at
// depths 1–7, with the invariants checked and a clone after every step, and is shown to fail
// on a core whose darter does not step back.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const Inv = require(path.join(root, 'tools/invariants.js'));
  const C = loadCore();
  const { N, Int } = C;
  const ROOM = ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'];
  const HALL = ['#################', '#...............#', '#################'];
  const DEAD_END = ['#####', '#...#', '#####'];
  const DOOR_BEHIND = ['######', '#+...#', '######'];
  const range = d => { const [lo, hi] = String(d).split('–').map(Number); return [lo, hi === undefined ? lo : hi]; };
  const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  // A room with you (made hard to kill, so every action is played) and one hunting darter.
  const make = X => (map, you, at, sp, depth, opts) => X.Setup.room(opts.seed, { acc: 'T0', depth, map, you,
    exhibits: [{ sp: sp.id, at, mode: 'hunting', stats: X.Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true });
  // The darter's own actions, each the group of its events at one tick: {tick, blow, moves}.
  function actions(r) {
    const uid = r.start.actors[1].uid, out = [];
    for (const e of r.events) {
      const blow = e.k === 'attacked' && e.by === uid, move = e.k === 'moved' && e.who === uid;
      if (!blow && !move) continue;
      let g = out[out.length - 1];
      if (!g || g.tick !== e.tick) { g = { tick: e.tick, blow: null, moves: [] }; out.push(g); }
      if (blow) g.blow = e; else g.moves.push(e);
    }
    return out;
  }

  const scenarios = X => {
    const build = (map, you, at) => (params, sp, depth, opts) => make(X)(map, you, at, sp, depth, opts);
    return {
      strikes: H.scenario({
        name: 'a darter beside you strikes for its damage, then at once steps back, the two costing one blow', id: 'darter',
        build: build(ROOM, [5, 3], [6, 3]), actions: waits(24), seeds: [1, 2, 3], clone: true,
        expect(r, params) {
          const [lo, hi] = range(params.dmg), uid = r.start.actors[1].uid, acts = actions(r), you = [5, 3];
          const blows = acts.filter(g => g.blow);
          if (blows.length < 4) return `it struck ${blows.length} times in 24 turns beside you`;
          for (const g of blows) {
            if (g.moves.length !== params.DARTER_STEP_BACK) return `after its blow at tick ${g.tick} it stepped ${g.moves.length} times, not ${params.DARTER_STEP_BACK}, with room to spare`;
            if (cheb(g.moves[0].from, you) !== 1) return `it struck at tick ${g.tick} from ${g.moves[0].from}, which is not beside you`;
            for (const m of g.moves) if (!(cheb(m.to, you) > cheb(m.from, you))) return `its step from ${m.from} to ${m.to} at tick ${g.tick} is not back from you`;
          }
          const hits = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === uid);
          if (!hits.length) return 'it never landed a blow';
          const bad = hits.find(e => e.cause.raw < lo || e.cause.raw > hi);
          if (bad) return `a blow rolled ${bad.cause.raw}, outside ${params.dmg}`;
          // The blow and the step back cost one blow; a step costs half a step.
          for (let i = 0; i + 1 < acts.length; i++) {
            const gap = acts[i + 1].tick - acts[i].tick, want = acts[i].blow ? N.COST_ATTACK : Int.pct(N.COST_STEP, N.SPEED_FAST_PCT);
            if (gap !== want) return `its ${acts[i].blow ? 'blow and step back' : 'step'} at tick ${acts[i].tick} took ${gap} ticks, not ${want}`;
          }
          return null;
        },
      }),
      runs: H.scenario({
        name: 'a hunting darter moves two tiles a turn', id: 'darter',
        build: build(HALL, [1, 1], [14, 1]), actions: waits(5), clone: true,
        expect(r) {
          const steps = actions(r).filter(g => !g.blow);
          if (steps.length < 8) return `it took ${steps.length} steps in 5 turns`;
          for (let i = 0; i + 1 < steps.length; i++) if (steps[i + 1].tick - steps[i].tick !== Int.pct(N.COST_STEP, N.SPEED_FAST_PCT)) return `its steps at ticks ${steps[i].tick} and ${steps[i + 1].tick} are not half a turn apart`;
          const perTurn = steps.filter(g => g.tick >= 100 && g.tick < 200).length;
          return perTurn === 2 ? null : `it took ${perTurn} steps in its second turn, not two`;
        },
      }),
      cornered: H.scenario({
        name: 'a darter with no room behind it strikes and stays', id: 'darter',
        build: build(DEAD_END, [2, 1], [1, 1]), actions: waits(10), seeds: [1, 2], clone: true,
        expect(r) {
          const acts = actions(r);
          if (acts.filter(g => g.blow).length < 5) return 'it did not keep striking';
          if (acts.some(g => g.moves.length)) return 'it moved, with nowhere to go';
          for (let i = 0; i + 1 < acts.length; i++) if (acts[i + 1].tick - acts[i].tick !== N.COST_ATTACK) return `its blows at ${acts[i].tick} and ${acts[i + 1].tick} are not one blow apart`;
          return null;
        },
      }),
      door: H.scenario({
        name: 'a darter with only a closed door behind it does not step back through it', id: 'darter',
        build: build(DOOR_BEHIND, [3, 1], [2, 1]), actions: waits(8), clone: true,
        expect(r) {
          const acts = actions(r);
          if (acts.filter(g => g.blow).length < 4) return 'it did not keep striking';
          if (acts.some(g => g.moves.length) || r.events.some(e => e.k === 'opened')) return 'it stepped back through the closed door';
          return r.state.dept.tiles[1][1] === '+' ? null : 'the door is no longer closed';
        },
      }),
    };
  };
  const S = scenarios(C);
  const list = H.species(C, 'darter');

  test('the darter\'s scenarios cover every species with its clause, at depths 1–7', () => {
    assert.ok(list.length >= 7 && list.every(x => x.sp.archetype === 'darter'), JSON.stringify(list.map(x => x.sp.id)));
    assert.deepEqual([...new Set(list.map(x => x.depth))], H.DEPTHS);
  });

  for (const key of ['strikes', 'runs', 'cornered', 'door']) {
    test(`darter: ${S[key].name}, for every species at depths 1–7, invariants and clone checked`, () => {
      const results = H.sweep(C, S[key], list);
      assert.equal(results.length, list.length * S[key].seeds.length);
      assert.deepEqual(H.failures(results), []);
    });
  }

  test('darter: with its archetype\'s act taken away, the step-back scenario fails, and so does its invariant', () => {
    const X = loadCore(), real = X.Archetypes.act;
    X.Archetypes.act = (state, a, ev) => a.arch === 'darter' ? null : real(state, a, ev);
    const T = scenarios(X), sp = list[0].sp;
    const fails = H.DEPTHS.map(d => H.run(X, T.strikes, sp, d, { inv: [] }).failure);
    assert.ok(fails.every(f => f && /stepped 0 times/.test(f)), fails.join(' | '));
    const r = H.run(X, T.strikes, sp, 3, { inv: Inv.select(X, ['darter_steps_back']) });
    assert.match(r.failure || '', /^darter_steps_back: struck you at tick \d+ and did not step back/);
  });

  test('darter: a step back made at a cost, or toward you, breaks the invariant', () => {
    const X = loadCore();
    const sp = list[0].sp, inv = Inv.select(X, ['darter_steps_back', 'arch_a_speed']);
    // A step back that is charged as a step: the blow and the step back cost more than one blow.
    const real = X.Archetypes.act;
    X.Archetypes.act = (state, a, ev) => { const c = real(state, a, ev); return a.arch === 'darter' && c !== null ? c + Int.pct(N.COST_STEP, N.SPEED_FAST_PCT) : c; };
    const r = H.run(X, scenarios(X).strikes, sp, 2, { inv });
    assert.match(r.failure || '', /^arch_a_speed: its blow and step back at tick \d+ took 150 ticks; it takes 100/);
    // A darter that steps toward you after its blow (planted by moving it beside you again).
    const Y = loadCore(), realY = Y.Archetypes.act;
    Y.Archetypes.act = (state, a, ev) => {
      const fromX = a.x, fromY = a.y, c = realY(state, a, ev);
      if (a.arch === 'darter' && c !== null && (a.x !== fromX || a.y !== fromY)) { Y.Causes.emit(state, ev, 'moved', { who: a.uid, from: [a.x, a.y], to: [fromX, fromY] }); a.x = fromX; a.y = fromY; }
      return c;
    };
    const q = H.run(Y, scenarios(Y).strikes, sp, 2, { inv: Inv.select(Y, ['darter_steps_back']) });
    assert.match(q.failure || '', /^darter_steps_back: stepped back 2 times|^darter_steps_back: stepped from/);
  });

  test('darter: with its speed made to cover its blows too, the strike scenarios fail, and so does the speed invariant', () => {
    const X = loadCore(), real = X.Archetypes.speedApplies, half = Int.pct(N.COST_ATTACK, N.SPEED_FAST_PCT);
    X.Archetypes.speedApplies = (state, a) => a.arch === 'darter' ? ['move', 'act'] : real(state, a);
    const T = scenarios(X), sp = list[0].sp;
    assert.match(H.run(X, T.cornered, sp, 4, { inv: [] }).failure || '', /are not one blow apart/);
    // The invariant does not ask the code what a blow costs, so it sees the fault too.
    for (const key of ['strikes', 'cornered']) {
      const r = H.run(X, T[key], sp, 4, { inv: Inv.select(X, ['arch_a_speed']) });
      assert.match(r.failure || '', new RegExp(`^arch_a_speed: its blow( and step back)? at tick \\d+ took ${half} ticks; it takes ${N.COST_ATTACK}`), key);
    }
  });

  // "ties broken on its own stream" (§8.1): beside you in an open room, a darter has three
  // tiles to step back to, all two steps from you; which it takes is its ai stream's draw.
  test('darter: with several tiles to step back to, it takes the one its own ai stream picks, so seeds differ in which', () => {
    const { Setup, Roles, State, Archetypes, Rng, Grid } = C;
    const sp = list[0].sp, you = [5, 3], from = [6, 3], seen = new Set();
    const options = [0, 1, 2, 3, 4, 5, 6, 7].filter(d => cheb([from[0] + Grid.DX[d], from[1] + Grid.DY[d]], you) === 2);
    assert.equal(options.length, 3);
    for (let seed = 1; seed <= 8; seed++) {
      const s = Setup.room(seed, { acc: 'T0', depth: 3, map: ROOM, you, exhibits: [{ sp: sp.id, at: from, mode: 'hunting', stats: Roles.stats(sp.role, 3) }] }, { invulnerable: true });
      const a = s.actors[1], d = Rng.stream(State.clone(s), 'ai/' + a.uid).pick(options), ev = [];
      assert.equal(Archetypes.act(s, a, ev), N.COST_ATTACK, `seed ${seed}: one blow's cost`);
      assert.ok(ev.some(e => e.k === 'attacked' && e.by === a.uid), `seed ${seed}: it struck`);
      assert.deepEqual([a.x, a.y], [from[0] + Grid.DX[d], from[1] + Grid.DY[d]], `seed ${seed}: the tile its stream picks`);
      seen.add(`${a.x},${a.y}`);
    }
    assert.ok(seen.size >= 2, `every seed stepped back to ${[...seen].join(' ')}`);
  });
};
