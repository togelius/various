// Behaviour line: the touch_case trigger, "wakes at once, hunting you, when its case is opened
// or bashed" (BUILD.md §8.2's trigger table, §8.3), for every pack species whose line has it,
// at every depth 1–7 (§5.3, check 2), with every invariant checked after every step and a
// clone after every step (§3.5). The trigger is the species'; the scenarios show it for an
// exhibit in a real case (its archetype set aside, so that only the trigger acts) and for the
// species as it is, a mimic in its disguise, whose case is itself. With the trigger taken
// away, the in-case scenarios fail (sensitivity, §5.3 check 3: a trigger is not a rule that
// rulesOff switches off, so the species is run without it).
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const { Setup, Cases, Roles } = C;
  const json = x => JSON.stringify(x);
  const CASE = ['#######', '#.....#', '#..v..#', '#.....#', '#######'];
  const FLOOR = ['#######', '#.....#', '#.....#', '#.....#', '#######'];
  // You at (3,1), cannot die; the exhibit at (3,2), asleep with no pips.
  const make = (opts, sp, depth, map, exhibit, extra) => {
    const s = Setup.room(opts.seed, Object.assign({ acc: 'T0', depth, map, you: [3, 1],
      exhibits: [Object.assign({ sp: sp.id, at: [3, 2], mode: 'dormant', pips: 0, stats: Roles.stats(sp.role, depth) }, exhibit)] }, extra), { rulesOff: opts.rulesOff, invulnerable: true });
    return s;
  };
  // An exhibit of the species, with its trigger, in a real case of the given glass; its
  // archetype is set aside (a plodder), so the trigger is all that acts on the touch.
  const inCase = (glass, trigger) => (params, sp, depth, opts) => make(opts, sp, depth, CASE, Object.assign({ arch: 'plodder' }, trigger === undefined ? {} : { trigger }),
    { fixtures: [Cases.make({ x: 3, y: 2, room: 'room', num: `T.0.${depth}01.1`, glass, lock: 1 })] });
  const woken = (how, extra) => (r) => {
    const a = r.state.actors[1], e = r.events.find(q => q.k === 'woke' && q.who === a.uid);
    if (!e) return `its case was ${how} and it never woke`;
    if (e.mode !== 'hunting' || e.cause.k !== 'touch_case') return `its case was ${how} and it woke ${e.mode} (${e.cause.k}), not hunting by the touch`;
    if (e.cause.how !== how) return `the touch says ${e.cause.how}, not ${how}`;
    const pip = r.events.findIndex(q => q.k === 'pip' && q.who === a.uid && q.cause.k === 'touch_case'), noise = r.events.findIndex(q => q.k === 'noise');
    if (pip < 0 || pip > noise) return 'it did not wake from the touch before the noise';
    return extra ? extra(r, a) : null;
  };
  const scenarios = [
    H.scenario({ name: 'its case opened, it wakes at once, hunting you', id: 'touch_case', build: inCase(1), actions: [{ a: 'open', x: 3, y: 2 }], expect: woken('opened'), clone: true }),
    H.scenario({ name: 'its case bashed, it wakes at once, hunting you, the glass only cracked', id: 'touch_case', build: inCase(2), actions: [{ a: 'bash', x: 3, y: 2 }],
      expect: woken('bashed', r => r.events.some(e => e.k === 'glass_cracked') ? null : 'the Laminated glass did not crack'), clone: true }),
    H.scenario({ name: 'its case broken by the bash, it wakes at once, hunting you, and has no home', id: 'touch_case', build: inCase(1), actions: [{ a: 'bash', x: 3, y: 2 }, { a: 'wait' }],
      expect: woken('bashed', (r, a) => a.home === null ? null : `it still has its home ${json(a.home)}`), clone: true }),
  ];
  // The species as it is: a mimic in its disguise (made by its archetype's init once W1-ARCH-C
  // builds it; until then here), opened or bashed: the case it is is touched, and it hunts.
  const asItIs = (params, sp, depth, opts) => {
    const s = make(opts, sp, depth, FLOOR, {}, { grade: 7 });
    if (!Cases.at(s, 3, 2)) Cases.disguise(s, s.actors[1]);
    return s;
  };
  const itself = id => H.scenario({ name: `the case it is ${id === 'open' ? 'opened' : 'bashed'}, it wakes, hunting you`, id: 'touch_case', build: asItIs,
    actions: [{ a: id, x: 3, y: 2 }],
    expect(r) {
      const a = r.state.actors[1];
      if (a.mode === 'dormant') return `the case it is was touched (${id}) and it sleeps on`;
      if (!a.woke || a.woke.cause.k !== 'touch_case') return `it woke by ${a.woke && a.woke.cause.k}, not by the touch`;
      if (!a.hunted) return 'it does not hunt you';
      return null;
    }, clone: true });
  scenarios.push(itself('open'), itself('bash'));

  test('touch_case: every species with the trigger, at every depth, wakes at once, hunting you, when its case is opened, bashed or broken', () => {
    const list = H.species(C, 'touch_case');
    assert.ok(list.length >= 7, `${list.length} species and depths`);
    for (const sc of scenarios) {
      const results = H.sweep(C, sc, list);
      assert.equal(json(H.failures(results)), '[]');
      assert.equal(results.length, list.length);
    }
  });

  test('touch_case is sensitive: the same exhibits without the trigger stay asleep, or wake by the noise, not hunting by the touch', () => {
    const list = H.species(C, 'touch_case');
    for (const [glass, action, how] of [[1, { a: 'open', x: 3, y: 2 }, 'opened'], [2, { a: 'bash', x: 3, y: 2 }, 'bashed']]) {
      const sc = H.scenario({ name: `its case ${how}, with no trigger`, id: 'touch_case', build: inCase(glass, null), actions: [action], expect: woken(how) });
      const results = H.sweep(C, sc, list);
      assert.equal(results.filter(r => !r.failure).length, 0, `${how}: ${json(results.filter(r => !r.failure).map(H.describe))}`);
      assert.ok(results.every(r => !r.error), 'they ran');
    }
  });
};
