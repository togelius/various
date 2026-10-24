// The special triggers M3 builds besides `touch_case` (BUILD.md §8.2), each for every species
// whose line has it, at every depth 1–7, as functions of the clause's own numbers:
//   axis      "also gains a pip each turn you stand in its row or column within {AXIS_RANGE} tiles, in its sight"
//   tether    "wakes at once when you come within {TETHER_RANGE} tiles of what it guards"
//   ally_hit  "wakes at once when one of its group within {ALLY_HIT_RANGE} tiles takes damage"
//   awake     "It never sleeps."
// Each run is clone-checked, with every invariant after every step; each scenario also fails
// in a core with its trigger planted out.
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const json = x => JSON.stringify(x);
  const open = (w, h) => ['#'.repeat(w)].concat(Array(h - 2).fill('#' + '.'.repeat(w - 2) + '#'), ['#'.repeat(w)]);
  const accOf = sp => sp.id.includes('.') ? sp.id.split('.')[0] : 'T0';
  const room = (C, sp, depth, opts, spec) => C.Setup.room(opts.seed, Object.assign({ acc: accOf(sp), depth }, spec), { rulesOff: opts.rulesOff, invulnerable: true });
  const exhibit = (C, sp, depth, at, extra) => Object.assign({ sp: sp.id, at, mode: 'dormant', stats: C.Roles.stats(sp.role, depth) }, extra);
  const pipsOf = (r, uid, k) => r.events.filter(e => e.k === 'pip' && e.who === uid && (!k || e.cause.k === k));
  const wokeBy = (a, k, turn) => a.mode === 'hunting' && a.woke && a.woke.cause.k === k && (turn === undefined || a.woke.turn === turn);

  // ---- axis ----
  // It sleeps at (2, 3); you stand d tiles along its row and wait. Far beyond your ring.
  const axisAt = (d, dy) => (params, sp, depth, opts) => room(C, sp, depth, opts, { map: open(26, 8), you: [2 + d(params), 3 + (dy || 0)], exhibits: [exhibit(C, sp, depth, [2, 3])] });
  const axisOn = H.scenario({
    name: 'standing in its row at AXIS_RANGE, in its sight, it gains a pip a turn, and wakes hunting on the third',
    id: 'axis', clone: true,
    build: axisAt(p => p.AXIS_RANGE),
    actions: Array(3).fill({ a: 'wait' }),
    expect(r, params) {
      const a = r.state.actors[1], pips = pipsOf(r, a.uid, 'axis');
      if (json(pips.map(e => [e.turn, e.cause.dist])) !== json([1, 2, 3].map(t => [t, params.AXIS_RANGE]))) return `axis pips ${json(pips.map(e => [e.turn, e.cause]))}`;
      return wokeBy(a, 'axis', 3) ? null : `it is ${a.mode}, story ${json(a.woke)}`;
    },
  });
  const axisOff = H.scenario({
    name: 'one tile further along its row, or one tile off it, it gains nothing',
    id: 'axis', clone: true,
    build: axisAt(p => p.AXIS_RANGE + 1),
    actions: Array(5).fill({ a: 'wait' }),
    expect(r, params, sp, depth) {
      const a = r.state.actors[1];
      if (pipsOf(r, a.uid).length || a.mode !== 'dormant') return `one tile beyond AXIS_RANGE it gained ${json(pipsOf(r, a.uid).map(e => e.cause))}`;
      // Another room: you at AXIS_RANGE, but one row below its row.
      const t = axisAt(p => p.AXIS_RANGE, 1)(params, sp, depth, { seed: r.seed, rulesOff: r.rulesOff });
      const off = H.play(C, t, Array(5).fill({ a: 'wait' }));
      if (off.violations.length) return off.violations[0].text;
      return off.events.some(e => e.k === 'pip') ? 'off its row by one it gained a pip' : null;
    },
  });

  // ---- tether ----
  // It sleeps at (5, 5), guarding its own tile. You walk west along its row from 4 tiles off:
  // 3 tiles off, still outside TETHER_RANGE; then 2, inside it.
  const tetherOn = H.scenario({
    name: 'it wakes hunting at once, on the step you come within TETHER_RANGE of what it guards',
    id: 'tether', clone: true,
    build: (params, sp, depth, opts) => room(C, sp, depth, opts, { map: open(14, 10), you: [5 + params.TETHER_RANGE + 2, 5], exhibits: [exhibit(C, sp, depth, [5, 5], { guards: [5, 5] })] }),
    actions: [{ a: 'move', dir: 6 }, { a: 'move', dir: 6 }],
    expect(r, params) {
      const a = r.state.actors[1];
      const first = r.steps[0].events.filter(e => e.k === 'woke'), second = r.steps[1].events.filter(e => e.k === 'woke' && e.who === a.uid);
      if (first.length) return `it woke ${params.TETHER_RANGE + 1} tiles from what it guards: ${json(first.map(e => e.cause))}`;
      if (second.length !== 1 || !wokeBy(a, 'tether', 2)) return `within ${params.TETHER_RANGE} it is ${a.mode}, story ${json(a.woke)}`;
      return a.woke.cause.dist === params.TETHER_RANGE ? null : `its cause says ${json(a.woke.cause)}`;
    },
  });
  const tetherOff = H.scenario({
    name: 'outside TETHER_RANGE of what it guards, and outside your ring, it sleeps on',
    id: 'tether', clone: true,
    build: (params, sp, depth, opts) => room(C, sp, depth, opts, { map: open(14, 10), you: [5 + params.TETHER_RANGE + 2, 5], exhibits: [exhibit(C, sp, depth, [5, 5], { guards: [5, 5] })] }),
    actions: Array(6).fill({ a: 'wait' }),
    expect(r) {
      const a = r.state.actors[1];
      return a.mode === 'dormant' && !pipsOf(r, a.uid).length ? null : `it is ${a.mode}, pips ${json(pipsOf(r, a.uid).map(e => e.cause))}`;
    },
  });

  // ---- ally_hit ----
  // You strike one of the species at (3, 5); another of its group sleeps ALLY_HIT_RANGE tiles
  // east of it, beyond your ring and the blow's noise.
  const group = sp => sp.group || 'planted_group';
  const allyAt = (dx, g) => (params, sp, depth, opts) => room(C, sp, depth, opts, { map: open(16, 10), you: [2, 5], exhibits: [
    exhibit(C, sp, depth, [3, 5], { group: group(sp) }), exhibit(C, sp, depth, [3 + dx(params), 5], { group: g ? g(sp) : group(sp) })] });
  const strike = (s, i) => i === 0 ? { a: 'attack', uid: s.actors[1].uid } : null;
  const allyOn = H.scenario({
    name: 'a blow on one of its group ALLY_HIT_RANGE tiles off wakes it hunting at once',
    id: 'ally_hit', clone: true,
    build: allyAt(p => p.ALLY_HIT_RANGE),
    actions: strike,
    expect(r) {
      const v = r.state.actors[1], a = r.state.actors[2];
      if (!wokeBy(a, 'ally_hit', 0) || a.woke.cause.ally !== v.uid || a.woke.cause.by !== 'you') return `it is ${a.mode}, story ${json(a.woke)}`;
      return null;
    },
  });
  const allyOff = H.scenario({
    name: 'one tile further off, or of another group, it sleeps on',
    id: 'ally_hit', clone: true,
    build: allyAt(p => p.ALLY_HIT_RANGE + 1),
    actions: strike,
    expect(r, params, sp, depth) {
      const a = r.state.actors[2];
      if (a.mode !== 'dormant') return `one tile beyond ALLY_HIT_RANGE it is ${a.mode}`;
      const t = allyAt(p => p.ALLY_HIT_RANGE, s => group(s) + '_other')(params, sp, depth, { seed: r.seed, rulesOff: r.rulesOff });
      const other = H.play(C, t, [{ a: 'attack', uid: t.actors[1].uid }]);
      if (other.violations.length) return other.violations[0].text;
      return t.actors[2].mode === 'dormant' ? null : `of another group it is ${t.actors[2].mode}`;
    },
  });

  // ---- awake ----
  // It is made awake and you wait out of its sight for longer than an awake exhibit idles
  // (AWAKE_IDLE_TURNS) before going back to sleep: it never sleeps, nor sets off back to
  // sleep (§8.2: it "never returns to sleep"), so it is never dormant, returning or reinstalling.
  const SLEEPWARD = ['dormant', 'returning', 'reinstalling'];
  const awake = H.scenario({
    name: 'it is awake from the start and is never dormant, nor going back to sleep',
    id: 'awake', clone: true,
    build(params, sp, depth, opts) {
      // A pack or shared species gives its own archetype and trigger, and is made awake; a
      // planted one is given them here.
      const extra = C.Packs.speciesFor({ dept: { acc: accOf(sp) } }, { sp: sp.id }) ? {} : { arch: sp.archetype, trigger: sp.trigger, mods: sp.modifiers || [], mode: 'awake' };
      const map = open(30, 8);
      map[3] = '#' + '.'.repeat(13) + '#' + '.'.repeat(14) + '#';
      for (let y = 1; y < 7; y++) map[y] = map[y].slice(0, 14) + '#' + map[y].slice(15);
      return room(C, sp, depth, opts, { map, you: [2, 3], exhibits: [Object.assign({ sp: sp.id, at: [25, 3], stats: C.Roles.stats(sp.role, depth) }, extra)] });
    },
    actions: Array(C.N.AWAKE_IDLE_TURNS + 6).fill({ a: 'wait' }),
    expect(r) {
      const a = r.state.actors[1];
      if (!r.start.actors[1].woke || r.start.actors[1].woke.cause.k !== 'awake' || r.start.actors[1].mode === 'dormant') return `made ${r.start.actors[1].mode}, story ${json(r.start.actors[1].woke)}`;
      // Every change of mode has its event (§8.2), so the steps' events tell each mode it had.
      const slept = r.steps.findIndex(st => st.events.some(e => e.who === a.uid && ((e.k === 'lost' && SLEEPWARD.includes(e.to)) || e.k === 'returned' || (e.k === 'woke' && e.was === 'dormant'))));
      if (slept >= 0) return `it went towards sleep at step ${slept}: ${json(r.steps[slept].events.filter(e => e.who === a.uid).map(e => [e.k, e.to || e.phase || e.mode || null]))}`;
      if (SLEEPWARD.includes(a.mode)) return `it is ${a.mode}`;
      return null;
    },
  });
  // The shared Night Watchman is the one M3 species that never sleeps; a planted plodder that
  // never sleeps checks the trigger on an ordinary archetype too.
  const PLANTED = { id: 'T.awake', sprite: 'seated_clerk', archetype: 'plodder', role: 'fodder', modifiers: [], trigger: 'awake', name: 'a planted waker', tomb: null, paragraph: '' };

  const LISTS = { axis: H.species(C, 'axis'), tether: H.species(C, 'tether'), ally_hit: H.species(C, 'ally_hit'), awake: H.species(C, 'awake') };
  const sweeps = [[axisOn, 'axis'], [axisOff, 'axis'], [tetherOn, 'tether'], [tetherOff, 'tether'], [allyOn, 'ally_hit'], [allyOff, 'ally_hit'], [awake, 'awake']];
  for (const [sc, id] of sweeps) {
    test(`${id}: ${sc.name}, for every species and depth`, () => {
      assert.ok(LISTS[id].length >= 7, `${id}: ${LISTS[id].length} species-depths`);
      assert.equal(json(H.failures(H.sweep(C, sc, LISTS[id]))), '[]');
    });
  }
  test('awake: a planted plodder that never sleeps, at every depth', () => {
    assert.equal(json(H.failures(H.sweep(C, awake, H.DEPTHS.map(depth => ({ sp: PLANTED, depth }))))), '[]');
  });

  test('each trigger\'s scenario fails in a core with that trigger planted out', () => {
    const at3 = id => LISTS[id].filter(l => l.depth === 3);
    const X = loadCore(); X.Wake.onAxis = () => false;
    assert.ok(H.sweep(X, axisOn, at3('axis')).every(r => r.failure), 'axis');
    const Y = loadCore(); Y.Wake.inTether = () => false;
    assert.ok(H.sweep(Y, tetherOn, at3('tether')).every(r => r.failure), 'tether');
    const Z = loadCore(); Z.Wake.allyHit = () => {};
    assert.ok(H.sweep(Z, allyOn, at3('ally_hit')).every(r => r.failure), 'ally_hit');
    // A rule that sends an awake exhibit to sleep after a while, or only home (the first step
    // back to sleep), breaks "It never sleeps". The scenario's own expectation catches each,
    // with the invariants off as well as on.
    for (const [to, cause] of [['dormant', { k: 'quiet', by: 'you' }], ['returning', { k: 'idle', turns: C.N.AWAKE_IDLE_TURNS }]]) {
      const W = loadCore(), act = W.AI.act;
      W.AI.act = (s, a, ev) => { if (a.mode === 'awake' && s.turn > 10) W.Wake.setMode(s, a, to, cause, ev); return act(s, a, ev); };
      const list = at3('awake').concat([{ sp: PLANTED, depth: 3 }]);
      assert.ok(H.sweep(W, awake, list).every(r => r.failure), `awake: sent ${to}`);
      assert.ok(H.sweep(W, awake, list, { inv: [] }).every(r => r.failure && !r.violations.length), `awake: sent ${to}, by the scenario itself`);
    }
  });
};
