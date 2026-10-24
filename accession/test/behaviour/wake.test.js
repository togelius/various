// The generic wake clause, "Wakes when you stay inside your ring or make noise near it."
// (BUILD.md §8.2, §5.3), for every species whose line ends with it, at every depth 1–7: the
// ring's pips wake it hunting, a noise's pips wake it awake and send it to look, and outside
// both it sleeps on. Each run is clone-checked, with every invariant after every step.
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const json = x => JSON.stringify(x);
  const open = (w, h) => ['#'.repeat(w)].concat(Array(h - 2).fill('#' + '.'.repeat(w - 2) + '#'), ['#'.repeat(w)]);
  // The species as a sleeper at `at`, with its role's numbers at the depth; a tethered warden
  // guards its own tile, as its archetype has it.
  const sleeper = (C, sp, depth, at) => ({ sp: sp.id, at, mode: 'dormant', stats: C.Roles.stats(sp.role, depth), guards: at.slice() });
  const build = (C, sp, depth, opts, spec) => {
    const s = C.Setup.room(opts.seed, Object.assign({ acc: (sp.id.split('.')[0]) || 'T0', depth }, spec), { rulesOff: opts.rulesOff, invulnerable: true });
    return s;
  };
  const LIST = H.species(C, 'wake');
  const pipsOf = (r, uid) => r.events.filter(e => e.k === 'pip' && e.who === uid);
  const PIPS = C.N.PIPS_TO_WAKE;

  // The ring: you walk to and fro 3 tiles from it, in its sight (radius 3 while you move),
  // never in its row or column and never within 2 of it (so no special trigger acts).
  const ring = H.scenario({
    name: 'it gains a pip each turn you stay inside your ring, and the third wakes it hunting',
    id: 'wake', clone: true,
    build: (params, sp, depth, opts) => build(C, sp, depth, opts, { map: open(14, 10), you: [8, 4], exhibits: [sleeper(C, sp, depth, [5, 5])] }),
    actions: [{ a: 'move', dir: 0 }, { a: 'move', dir: 4 }, { a: 'move', dir: 0 }],
    expect(r) {
      const a = r.state.actors[1], pips = pipsOf(r, a.uid);
      if (json(pips.map(e => [e.turn, e.pips, e.cause.k, e.cause.dist, e.cause.r])) !== json([[1, 1, 'ring', 3, 3], [2, 2, 'ring', 3, 3], [3, 3, 'ring', 3, 3]])) return `its pips were ${json(pips.map(e => [e.turn, e.pips, e.cause]))}`;
      if (a.mode !== 'hunting' || !a.woke || a.woke.turn !== 3 || a.woke.cause.k !== 'ring') return `after ${PIPS} turns in your ring it is ${a.mode}, story ${json(a.woke)}`;
      return null;
    },
  });

  // Noise: you strike a fixed training dummy beside you; the sleeper is 3 walking tiles off,
  // with plaster dust between you, so it hears every blow but is out of your ring's sight.
  const noise = H.scenario({
    name: 'it gains a pip each turn it hears a noise, and the third wakes it awake, to look where the noise was',
    id: 'wake', clone: true,
    build(params, sp, depth, opts) {
      const s = build(C, sp, depth, opts, { map: open(8, 9), you: [2, 2], exhibits: [
        { sp: 'training_dummy', at: [3, 2], mode: 'hunting', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 }, statuses: [{ id: 'fixed', until: 999 }] },
        sleeper(C, sp, depth, [2, 5])] });
      for (const y of [3, 4]) s.dept.surfaces.push({ kind: 'dust', x: 2, y, size: 1, until: 999, by: null });
      return s;
    },
    actions: [1, 2, 3].map(() => ({ a: 'move', dir: 2 })),
    expect(r) {
      const a = r.state.actors[2], pips = pipsOf(r, a.uid);
      if (json(pips.map(e => [e.turn, e.pips, e.cause.k, e.cause.by, e.cause.dist, e.cause.cls])) !== json([0, 1, 2].map(t => [t, t + 1, 'noise', 'you', 3, 'soft']))) return `its pips were ${json(pips.map(e => [e.turn, e.pips, e.cause]))}`;
      if (a.mode !== 'awake' || json(a.target) !== json([2, 2]) || !a.woke || a.woke.cause.k !== 'noise') return `after ${PIPS} noises it is ${a.mode}, looking at ${json(a.target)}, story ${json(a.woke)}`;
      if (r.events.some(e => e.k === 'hunting' && e.who === a.uid)) return 'noise woke it hunting';
      return null;
    },
  });

  // Outside: you wait 6 tiles off, in its sight but outside your ring, making no noise.
  const outside = H.scenario({
    name: 'outside your ring and away from noise it sleeps on',
    id: 'wake', clone: true,
    build: (params, sp, depth, opts) => build(C, sp, depth, opts, { map: open(14, 10), you: [11, 1], exhibits: [sleeper(C, sp, depth, [5, 7])] }),
    actions: Array(12).fill({ a: 'wait' }),
    expect(r) {
      const a = r.state.actors[1];
      return a.mode === 'dormant' && a.pips === 0 && !pipsOf(r, a.uid).length ? null : `it is ${a.mode} with ${a.pips} pips`;
    },
  });

  for (const sc of [ring, noise, outside]) {
    test(`wake: ${sc.name}, for every species and depth`, () => {
      assert.ok(LIST.length >= 7 * 10, `${LIST.length / 7} species`);
      const results = H.sweep(C, sc, LIST);
      assert.equal(json(H.failures(results)), '[]');
    });
  }

  test('wake: the scenarios fail in a core without the ring pip, or without hearing', () => {
    const one = LIST.filter(l => l.depth === 3);
    const X = loadCore(); X.Wake.boundary = () => {};
    assert.ok(H.sweep(X, ring, one).every(r => r.failure), 'no ring pip: the ring scenario fails for every species');
    const Y = loadCore(); Y.Wake.hear = () => false;
    assert.ok(H.sweep(Y, noise, one).every(r => r.failure), 'no hearing: the noise scenario fails for every species');
  });
};
