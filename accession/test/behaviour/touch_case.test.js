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
  const { Setup, Cases, Roles, Step } = C;
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
  // The species as it is: a mimic in its disguise, made by its archetype's init (W1-ARCH-C),
  // opened or bashed: the case it is is touched, and it hunts.
  const asItIs = (params, sp, depth, opts) => {
    const s = make(opts, sp, depth, FLOOR, {}, { grade: 7 });
    if (!Cases.at(s, 3, 2)) throw new Error(`${sp.id} was made asleep on a floor tile and is not in its disguise`);
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

  // ---- The case, the glasses and the staff door, joined up (W2a-BEHAVIOUR) ----
  // Their clauses (reg/cases.js), as the real actions play them at depths 1–7, with every
  // invariant after every step and a clone check: a case is bashed until it breaks with every
  // weapon form that can break its glass, and opened at the grade of its lock; a staff door is
  // opened at its grade; and every case a department places has a lock its glass allows.
  const N = C.N, G = ['plate', 'laminated', 'security'];
  const glassCase = (n, form, lock, grade) => (params, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: CASE, you: [3, 1], grade: grade || 1,
    kit: { weapon: { form, tier: 1 } }, exhibits: [{ sp: 'dummy', at: [1, 3], mode: 'dormant', stats: { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }],
    fixtures: [Cases.make({ x: 3, y: 2, room: 'room', num: `T.0.${depth}01.1`, glass: n, lock: lock || 1 })] }, { rulesOff: opts.rulesOff, invulnerable: true });
  for (let n = 1; n <= 3; n++) for (const form of ['light', 'balanced', 'heavy']) {
    if (form === 'light' && n >= 2) continue;
    const bashes = H.scenario({
      name: `${G[n - 1]} glass bashed with a ${form} weapon breaks after GLASS_BASHES bashes, a loud noise each and a crash at the last, shards on your side`, id: 'GLASS.' + G[n - 1], clone: true,
      build: glassCase(n, form),
      actions: s => Cases.at(s, 3, 2).st === 'shut' ? { a: 'bash', x: 3, y: 2 } : null,
      expect(r, params) {
        const per = form === 'heavy' ? 2 : 1, swings = Math.ceil(params.bashes / per), cost = form === 'heavy' ? N.COST_BASH_HEAVY : N.COST_BASH;
        if (r.steps.length !== swings) return `it broke after ${r.steps.length} swings; ${params.bashes} bashes at ${per} a swing is ${swings}`;
        const noise = r.events.filter(e => e.k === 'noise' && e.cause.by === 'you').map(e => e.cls);
        if (json(noise) !== json(Array.from({ length: swings }, (_, k) => k === swings - 1 ? 'crash' : 'loud'))) return `its noises were ${json(noise)}`;
        const broke = r.events.find(e => e.k === 'glass_broke');
        if (!broke || broke.cause.k !== 'bash' || json(broke.shards[0]) !== json([3, 1])) return `it broke ${json(broke)}, its shards not on your side`;
        if (r.state.dept.tiles[2][3] !== 'k' || r.state.dept.tiles[1][3] !== 'x') return `the tiles are ${r.state.dept.tiles[1]} / ${r.state.dept.tiles[2]}`;
        return r.steps.every((st, i) => i === 0 || st.events[0].tick === i * cost) ? null : `a swing did not cost ${cost} ticks`;
      },
    });
    test(`GLASS.${G[n - 1]}, joined up: bashed with a ${form} weapon, it breaks after its bashes, at every depth`, () => {
      assert.equal(json(H.failures(H.sweep(C, bashes, H.DEPTHS.map(depth => ({ sp: null, depth }))))), '[]');
    });
  }
  test('the case, joined up: opened at the grade of its lock it costs COST_OPEN_CASE ticks and makes a soft noise, and stays open; one grade short it is refused; Light cannot break Laminated or Security', () => {
    for (let n = 1; n <= 3; n++) {
      const sc = H.scenario({
        name: `a ${G[n - 1]} case opened at its lock's grade`, id: 'FIXTURES.case', clone: true,
        build: (p, sp, depth, opts) => glassCase(n, 'balanced', N.GLASS_LOCK_MAX[n - 1], N.GLASS_LOCK_MAX[n - 1])(p, sp, depth, opts),
        actions: [{ a: 'open', x: 3, y: 2 }, { a: 'wait' }],
        expect(r, params) {
          const e0 = r.steps[0].events, opened = e0.find(e => e.k === 'case_opened');
          if (!opened || opened.lock !== N.GLASS_LOCK_MAX[n - 1] || opened.cause.k !== 'grade') return `it did not open: ${json(e0)}`;
          const noise = e0.filter(e => e.k === 'noise');
          if (noise.length !== 1 || noise[0].cls !== 'soft' || noise[0].x !== 3 || noise[0].y !== 2) return `its noise was ${json(noise)}`;
          if (r.steps[1].events[0].tick !== params.open) return `the open cost ${r.steps[1].events[0].tick} ticks, not ${params.open}`;
          return r.state.dept.tiles[2][3] === 'u' && Cases.at(r.state, 3, 2).st === 'open' ? null : 'it is not open';
        },
      });
      assert.equal(json(H.failures(H.sweep(C, sc, H.DEPTHS.map(depth => ({ sp: null, depth }))))), '[]');
      // One grade short of its lock, the open is refused (a lock never above VII).
      const lock = N.GLASS_LOCK_MIN[n - 1];
      if (lock > 1) {
        const s = glassCase(n, 'balanced', lock, lock - 1)({}, null, 3, { seed: 1, rulesOff: [] });
        assert.equal(json(Step.step(s, { a: 'open', x: 3, y: 2 }).map(e => e.reason)), json(['case_locked']));
      }
      if (n >= 2) {
        const s = glassCase(n, 'light')({}, null, 3, { seed: 1, rulesOff: [] });
        assert.equal(json(Step.step(s, { a: 'bash', x: 3, y: 2 }).map(e => e.reason)), json(['glass_too_strong']));
      }
    }
  });
  test('the staff door, joined up: at its grade, a step into it opens it for COST_DOOR ticks with a soft noise; below, it is a wall; no exhibit ever passes one', () => {
    const MAP = ['#########', '#...S...#', '#########'];
    const sc = H.scenario({
      name: 'a staff door opened at its grade', id: 'FIXTURES.staff', clone: true,
      build: (p, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: MAP, you: [3, 1], grade: Math.min(7, depth + 1), fixtures: [{ k: 'staff', x: 4, y: 1, grade: Math.min(7, depth + 1) }],
        exhibits: [{ sp: 'dummy', at: [7, 1], mode: 'hunting', stats: { hp: 999, acc: -99, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] }, { rulesOff: opts.rulesOff, invulnerable: true }),
      actions: (s, i) => i === 0 ? { a: 'move', dir: 2 } : i < 8 ? { a: 'wait' } : null,
      expect(r, params) {
        const e0 = r.steps[0].events, opened = e0.find(e => e.k === 'opened');
        if (!opened || opened.cause.k !== 'staff') return `the staff door did not open: ${json(e0)}`;
        if (r.steps[1].events[0].tick !== params.cost) return `opening it cost ${r.steps[1].events[0].tick} ticks`;
        if (!e0.some(e => e.k === 'noise' && e.cls === 'soft')) return 'no soft noise';
        if (r.state.actors[0].x !== 3) return 'you went through as it opened';
        const t = r.events.filter(e => e.k === 'moved' && e.who !== 'you').map(e => e.to);
        return t.some(([x, y]) => x === 4 && y === 1) ? 'the exhibit stepped onto the staff door' : null;
      },
    });
    assert.equal(json(H.failures(H.sweep(C, sc, H.DEPTHS.map(depth => ({ sp: null, depth }))))), '[]');
  });
  test('every case a department places, at depths 1–7, has a lock within its glass\'s range and an accession number; only a mimic\'s has none', () => {
    let n = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const depth of H.DEPTHS) for (const seed of [1, 2]) {
      const s = C.Dept.create(seed, acc, depth);
      for (const f of s.dept.fixtures.filter(x => x.k === 'case')) {
        const where = `${acc} d${depth} seed ${seed}: the case at ${f.x},${f.y}`;
        assert.ok(f.lock >= N.GLASS_LOCK_MIN[f.glass - 1] && f.lock <= N.GLASS_LOCK_MAX[f.glass - 1], `${where}: ${G[f.glass - 1]} with lock ${f.lock}`);
        assert.equal(f.num === null, !!f.mimic, `${where}: num ${f.num}`);
        n++;
      }
    }
    assert.ok(n > 100, `${n} cases`);
  });

  test('a sleeper in a case its bash breaks, joined up: released, it wakes hunting (case_broken) before the crash and has no home; with the touch_case trigger the touch wakes it first', () => {
    for (const trigger of [null, 'touch_case']) {
      const sc = H.scenario({
        name: `a sleeper with ${trigger ? 'the touch_case trigger' : 'no trigger'} in a Plate case broken by one bash`, id: 'WAKE_CAUSES.case_broken', clone: true,
        build: (p, sp, depth, opts) => Setup.room(opts.seed, { acc: 'T0', depth, map: CASE, you: [3, 1],
          exhibits: [{ sp: 'dummy', at: [3, 2], mode: 'dormant', trigger, stats: Roles.stats('fodder', depth) }],
          fixtures: [Cases.make({ x: 3, y: 2, room: 'room', num: `T.0.${depth}01.1`, glass: 1, lock: 1 })] }, { rulesOff: opts.rulesOff, invulnerable: true }),
        actions: [{ a: 'bash', x: 3, y: 2 }],
        expect(r) {
          const a = r.state.actors[1], ev = r.steps[0].events, woke = ev.find(e => e.k === 'woke' && e.who === a.uid);
          const want = trigger ? 'touch_case' : 'case_broken';
          if (!woke || woke.mode !== 'hunting' || woke.cause.k !== want) return `it woke ${json(woke)}, not hunting by ${want}`;
          const crash = ev.findIndex(e => e.k === 'noise' && e.cls === 'crash');
          if (crash < 0 || ev.indexOf(woke) > crash) return 'it was not woken before the crash';
          if (!ev.some(e => e.k === 'glass_broke' && e.released === a.uid)) return 'the glass_broke event does not name it released';
          return a.home === null ? null : `it keeps its home ${json(a.home)}`;
        },
      });
      assert.equal(json(H.failures(H.sweep(C, sc, H.DEPTHS.map(depth => ({ sp: null, depth }))))), '[]');
    }
  });
};
