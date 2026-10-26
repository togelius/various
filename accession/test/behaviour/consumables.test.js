// Scenarios for the consumables' clauses (BUILD.md §8.6; reg/consumables.js), run through
// the Behaviour-line harness with every invariant checked after every step and a clone
// after every step (§3.5): a thrown Fixative and a thrown Consolidant on every M3 pack
// species (and the Night Watchman) at depths 1–7, in the open and inside an intact case;
// a first use of every kind, every way, at every depth; the Re-admission Ticket against a
// pending special (R30c). Every scenario runs joined up (W2a-BEHAVIOUR): the other Wave 1
// packages' hooks that consumables call (Health.heal, Wake.quiet, Wake.lose, Cases.dissolve,
// Kit.addToTote) are their real rules, with nothing stood in for.
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const json = x => JSON.stringify(x);
  const KINDS = ['consolidant', 'fixative', 'fumigant', 'solvent', 'card', 'plan', 'quiet', 'ticket'];
  const OPEN = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];

  // Every species an M3 department can hold (its archetype built in M3), from the packs and
  // the shared species, at depths 1–7, as the harness's species() lists them.
  function everySpecies(C) {
    const out = [];
    const all = [];
    for (const p of C.Packs.list()) for (const sp of p.species) all.push(sp);
    for (const sp of C.Packs.sharedList()) all.push(sp);
    for (const sp of all) {
      const A = C.Registry.ARCHETYPES[sp.archetype || 'plodder'];
      if (A && A.built === 'M3') for (const depth of H.DEPTHS) out.push({ sp, depth });
    }
    return out;
  }
  // A room with you at (2, 3) holding consumables, the run's seals shuffled, and what you
  // know; the exhibit given is of species sp at the depth.
  function build(C, opts, o) {
    const s = C.Setup.room(opts.seed, Object.assign({ acc: 'T0', depth: o.depth, map: o.map || OPEN, you: o.you || [2, 3], exhibits: o.exhibits || [] },
      o.entrance ? { entrance: o.entrance } : {}), { rulesOff: opts.rulesOff });
    s.actors[0].hp = s.actors[0].maxHp = 60;
    C.Consumables.startRun(s);
    for (const [ck, n] of o.tote || []) {
      const it = C.Consumables.make(s, ck, { at: 'floor', x: s.actors[0].x, y: s.actors[0].y });
      it.where = { at: 'tote' }; it.n = n; s.you.tote.push(it.uid);
    }
    for (const ck of o.known || []) s.run.knownSeals.push(C.Consumables.sealFor(s, ck));
    return s;
  }
  // An exhibit of species sp, in the one mode it can be in when you meet it: asleep, but for
  // a species that never sleeps (trigger awake), which is awake, and the Night Watchman,
  // which always comes for you (hunting; rules/clock.js).
  const modeOf = sp => sp.archetype === 'night_watchman' ? 'hunting' : sp.trigger === 'awake' ? 'awake' : 'dormant';
  const exhibit = (C, sp, depth, at, extra) => Object.assign({ sp: sp.id, at, mode: modeOf(sp), stats: C.Roles.stats(sp.role, depth) }, extra || {});
  // A state a department could hold: no Night Watchman that is not hunting, and nothing that
  // never sleeps asleep.
  const possible = a => a.arch === 'night_watchman' && a.mode !== 'hunting' ? `${a.uid} is a Night Watchman ${a.mode}, which cannot be`
    : a.trigger === 'awake' && a.mode === 'dormant' ? `${a.uid} never sleeps, but is asleep` : null;
  // A room with a case at (7, 3), shut, for the species that can stand in one: not the Night
  // Watchman, and not the mimic, which is a case itself.
  const CASED = ['#############', '#...........#', '#...........#', '#......v....#', '#...........#', '#...........#', '#...........#', '#############'];
  const encasable = list => list.filter(({ sp }) => sp.archetype !== 'night_watchman' && sp.archetype !== 'mimic_vitrine');
  const toteUid = (s, ck) => s.items.find(i => i.kind === 'consumable' && i.ck === ck && i.where.at === 'tote').uid;
  const sweepAll = (C, sc, list) => { const rs = H.sweep(C, sc, list); assert.deepEqual(H.failures(rs), []); return rs; };

  test('a thrown Fixative fixes an exhibit of every species at every depth for FIXATIVE_TURNS turns from its next decision; in an intact case it is behind glass', () => {
    const C = loadCore();
    const N = C.N;
    const sc = H.scenario({
      name: 'thrown Fixative fixes', id: null, clone: true,
      build: (p, sp, depth, opts) => build(C, opts, { depth, tote: [['fixative', 1]], known: ['fixative'], exhibits: [exhibit(C, sp, depth, [7, 3])] }),
      actions: (s, i) => i === 0 ? { a: 'throw', uid: toteUid(s, 'fixative'), x: 7, y: 3 } : null,
      expect(r) {
        const a = r.start.actors[1], glass = C.Cases.encased(r.start, a), ev = r.steps[0].events;
        if (possible(a)) return possible(a);
        const on = ev.filter(e => e.k === 'status' && e.who === a.uid && e.id === 'fixed' && e.on && e.cause.k === 'item');
        if (glass) return on.length ? `${a.uid} is in an intact case but was fixed` : null;
        if (on.length !== 1) return `${a.uid} was not fixed: ${json(ev.map(e => e.k))}`;
        const s = r.state.actors[1].statuses.find(t => t.id === 'fixed');
        if (!s || s.until - s.from !== N.FIXATIVE_TURNS || s.from < r.start.turn) return `${a.uid}'s fixed status ${json(s)} does not cover ${N.FIXATIVE_TURNS} turns from its next decision`;
        const noise = ev.findIndex(e => e.k === 'noise' && e.cause.k === 'throw');
        if (noise < ev.indexOf(on[0])) return 'the throw\'s noise came before its effect';
        return null;
      },
    });
    const rs = sweepAll(C, sc, everySpecies(C));
    assert.ok(rs.length >= 7 * 12, `${rs.length} runs`);
    assert.ok(rs.some(r => r.sp === 'night_watchman' && r.start.actors[1].mode === 'hunting'), 'the Night Watchman, hunting, among them');
  });

  test('a thrown Consolidant heals an exhibit of every species at every depth by CONSOLIDANT_THROW_PCT% of its own maximum health, up to it', () => {
    const C = loadCore();
    const N = C.N;
    const sc = H.scenario({
      name: 'thrown Consolidant heals', id: null, clone: true,
      build: (p, sp, depth, opts) => {
        const st = C.Roles.stats(sp.role, depth);
        return build(C, opts, { depth, tote: [['consolidant', 1]], known: ['consolidant'], exhibits: [exhibit(C, sp, depth, [7, 3], { hp: 1, maxHp: st.hp })] });
      },
      actions: (s, i) => i === 0 ? { a: 'throw', uid: toteUid(s, 'consolidant'), x: 6, y: 4 } : null,
      expect(r) {
        const a = r.start.actors[1], glass = C.Cases.encased(r.start, a), ev = r.steps[0].events;
        if (possible(a)) return possible(a);
        const healed = ev.filter(e => e.k === 'healed' && e.who === a.uid && e.cause.k === 'item');
        const want = glass ? 0 : Math.min(Math.floor(a.maxHp * N.CONSOLIDANT_THROW_PCT / 100), a.maxHp - a.hp);
        const got = healed.reduce((n, e) => n + e.amount, 0);
        return got === want ? null : `${a.uid} (health ${a.hp} of ${a.maxHp}${glass ? ', in a case' : ''}) was healed by ${got}, not ${want}`;
      },
    });
    sweepAll(C, sc, everySpecies(C));
  });

  // Inside an intact case an exhibit is behind glass: a Fixative or Consolidant thrown so that
  // its square covers the case reaches you, if you are in it, but not the exhibit inside.
  test('a thrown Fixative or Consolidant does not reach an exhibit of any species inside an intact case, at any depth: it is behind glass', () => {
    const C = loadCore();
    let runs = 0;
    for (const ck of ['fixative', 'consolidant']) {
      const sc = H.scenario({
        name: `thrown ${ck} behind glass`, id: null, clone: true,
        build: (p, sp, depth, opts) => {
          const st = C.Roles.stats(sp.role, depth);
          return build(C, opts, { depth, map: CASED, tote: [[ck, 1]], known: [ck], exhibits: [exhibit(C, sp, depth, [7, 3], { hp: 1, maxHp: st.hp })] });
        },
        actions: (s, i) => i === 0 ? { a: 'throw', uid: toteUid(s, ck), x: 6, y: 3 } : null,
        expect(r) {
          const a = r.start.actors[1], ev = r.steps[0].events;
          if (!C.Cases.encased(r.start, a)) return `${a.uid} is not in the case at 7,3`;
          const reached = ev.filter(e => e.who === a.uid && e.cause && e.cause.k === 'item' && (e.k === 'healed' || e.k === 'status'));
          if (reached.length) return `${a.uid}, in an intact case, was reached through the glass: ${json(reached.map(e => e.k))}`;
          if (!ev.some(e => e.k === 'used')) return `the throw was refused: ${json(ev)}`;
          return null;
        },
      });
      // The case at (7, 3) is a fixture of the room, built as a real one is.
      const list = encasable(everySpecies(C));
      const withCase = H.scenario(Object.assign({}, sc, { build: (p, sp, depth, opts) => { const s = sc.build(p, sp, depth, opts); s.dept.fixtures.push(C.Cases.make({ x: 7, y: 3, room: null, glass: 1, lock: 1 })); return s; } }));
      runs += sweepAll(C, withCase, list).length;
    }
    assert.ok(runs >= 2 * 7 * 10, `${runs} runs`);
  });

  // Each kind, unknown, used each way it can be from where you stand: drunk or read, and, for
  // a Solution, thrown at the nearest tile a first throw allows (3 tiles east) and refused
  // at 2. A first use never harms you (the consumable_first_use invariant, checked after
  // every step), and identifies the kind at once.
  test('a first use of every kind, every way, at every depth, never harms you, and identifies its kind at once', () => {
    const C = loadCore();
    const depths = H.DEPTHS.map(depth => ({ sp: null, depth }));
    let runs = 0;
    for (const ck of KINDS) {
      const solution = C.Registry.CONSUMABLES[ck].cls === 'solution';
      for (const way of solution ? ['use', 'throw'] : ['use']) {
        const sc = H.scenario({
          name: `a first ${way} of ${ck}`, id: null, clone: true,
          build: (p, sp, depth, opts) => build(C, opts, { depth, entrance: [1, 1], tote: [[ck, 2]], exhibits: [{ sp: 'dummy', at: [9, 5], mode: 'hunting', stats: C.Roles.stats('fodder', depth) }] }),
          actions(s, i) {
            if (s.ui.pendingChoice) return { a: 'choose', index: 0 };
            if (i === 0) return way === 'use' ? { a: 'use', uid: toteUid(s, ck) } : { a: 'throw', uid: toteUid(s, ck), x: 4, y: 3 };
            if (i === 1) return way === 'use' ? null : { a: 'throw', uid: toteUid(s, ck), x: 5, y: 3 };
            return null;
          },
          expect(r) {
            const ev = r.events, seal = C.Consumables.sealFor(r.state, ck);
            if (way === 'throw' && !(r.steps[0].events.length === 1 && r.steps[0].events[0].reason === 'throw_unknown_near')) return `a first throw 2 tiles away was not refused: ${json(r.steps[0].events)}`;
            const used = ev.find(e => e.k === 'used'), id = ev.find(e => e.k === 'identified' && e.seal === seal);
            if (!used || used.cause.known !== false || !id || id.cause.k !== 'use' || ev.indexOf(id) < ev.indexOf(used)) return `not identified at once by its use: ${json(ev.map(e => e.k))}`;
            if (!C.Consumables.known(r.state, ck)) return `${ck} is not known after its use`;
            return null;
          },
        });
        runs += sweepAll(C, sc, depths).length;
      }
    }
    assert.equal(runs, 12 * 7);
  });

  test('the first-use invariant bites: a first drink that harms you is caught, whatever cause it gives and whether or not it says so', () => {
    const C = loadCore();
    C.Registry.CONSUMABLES.fixative.harmfulDrink = false;
    let s = build(C, { seed: 1 }, { depth: 1, tote: [['fixative', 1]] });
    let r = H.play(C, s, [{ a: 'use', uid: toteUid(s, 'fixative') }], { inv: ['consumable_first_use'] });
    assert.equal(r.violations.length, 1, json(r.violations));
    assert.match(r.violations[0].text, /consumable_first_use: a first use of .* made you fixed/);
    // Planted harms on a gentle first drink of Fumigant, each under another cause or none.
    const plants = {
      'a status with the status cause': (st, ev) => C.Status.apply(st, st.actors[0], 'fixed', 4, { k: 'status', id: 'fixed' }, ev),
      'a status put on with no event': st => st.actors[0].statuses.push({ id: 'coughing', until: st.turn + 5, turns: null, from: st.turn + 1 }),
      'a status made longer with no event': st => { const t = st.actors[0].statuses.find(q => q.id === 'dazed'); t.until += 3; },
      'health lost with no event': st => { st.actors[0].hp -= 3; },
    };
    const want = { 'a status with the status cause': /made you fixed/, 'a status put on with no event': /came to be coughing/, 'a status made longer with no event': /came to be dazed for longer/, 'health lost with no event': /your health fell from 60 to 57/ };
    for (const name of Object.keys(plants)) {
      const D = loadCore();
      const emit = D.Causes.emit;
      D.Causes.emit = (st, ev, k, fields, cause) => { const e = emit(st, ev, k, fields, cause); if (k === 'used' && cause && cause.gentle) plants[name](st, ev); return e; };
      s = build(D, { seed: 1 }, { depth: 1, tote: [['fumigant', 1]] });
      s.actors[0].statuses.push({ id: 'dazed', until: 9, turns: null, from: 1 });
      r = H.play(D, s, [{ a: 'use', uid: toteUid(s, 'fumigant') }], { inv: ['consumable_first_use'] });
      assert.equal(r.steps[0].events[0].cause.gentle, true, name);
      assert.equal(r.violations.length, 1, `${name}: ${json(r.violations)}`);
      assert.match(r.violations[0].text, want[name], name);
    }
    // And a harm an exhibit does in the same step is no violation: a hunter that strikes you
    // after your first drink.
    const E = loadCore();
    let struck = 0;
    for (let seed = 1; seed <= 10; seed++) {
      s = build(E, { seed }, { depth: 1, you: [2, 3], tote: [['fumigant', 1]], exhibits: [{ sp: 'dummy', at: [3, 3], mode: 'hunting', stats: { hp: 40, acc: 99, eva: 0, pad: 0, dmin: 2, dmax: 2 } }] });
      r = H.play(E, s, [{ a: 'use', uid: toteUid(s, 'fumigant') }], { inv: ['consumable_first_use'] });
      if (r.events.some(e => e.k === 'damaged' && e.who === 'you')) struck++;
      assert.deepEqual(r.violations, [], `seed ${seed}`);
    }
    assert.ok(struck >= 3, `the hunter struck you in ${struck} of 10 runs`);
  });

  // R30c. A hunter beside the entrance marks the 8 tiles round it, the entrance among them,
  // for a special that resolves after your next decision. You read a Ticket from across the
  // room: you land on a marked tile, and every hunter loses you, which calls its special off,
  // so it never resolves on you there unshown. Any special that hits you later was marked on
  // your tile before the step in which it hit.
  test('the Re-admission Ticket calls off every hunter\'s pending special, so nothing resolves on you at the entrance unshown (R30c)', () => {
    const map = ['###########', 'E.........#', '#.........#', '#.........#', '#.........#', '###########'];
    const run = (C, depth, seed) => {
      if (!C.Registry.ARCHETYPES.planted_marker) {
        C.Registry.define('ARCHETYPES', 'planted_marker', { special: 'ring' });
        C.Archetypes.add('planted_marker', { act(state, a, ev) { const t = C.Specials.tiles(state, a, 'ring'); return C.Specials.canMark(state, a, 'ring', t) ? C.Specials.mark(state, a, 'ring', t, ev) : null; } });
      }
      const s = build(C, { seed }, { depth, map, you: [8, 3], entrance: [0, 1], tote: [['ticket', 1]], known: ['ticket'],
        exhibits: [{ sp: 'dummy', arch: 'planted_marker', at: [1, 2], mode: 'hunting', stats: C.Roles.stats('warden', depth) }] });
      const marks = [], hits = [];
      const r = H.play(C, s, (st, i) => {
        marks.push(C.Specials.marks(st).filter(m => m.kind === 'telegraph').map(m => [m.x, m.y]));
        return i === 1 ? { a: 'use', uid: toteUid(st, 'ticket') } : i < 6 ? { a: 'wait' } : null;
      }, { clone: true });
      r.steps.forEach((step, i) => {
        for (const e of step.events) if (e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special') hits.push({ step: i, x: e.cause.x, y: e.cause.y, marked: marks[i].some(([x, y]) => x === e.cause.x && y === e.cause.y) });
      });
      return { r, hits, s };
    };
    for (let depth = 1; depth <= 7; depth++) {
      const C = loadCore();
      const { r, hits, s } = run(C, depth, depth);
      assert.deepEqual(r.violations, []);
      const ticket = r.steps[1].events;
      assert.ok(r.steps[0].events.some(e => e.k === 'telegraphed'), `depth ${depth}: the hunter marked the entrance`);
      assert.ok(ticket.some(e => e.k === 'special' && e.cancelled), `depth ${depth}: the Ticket called it off`);
      assert.ok(!hits.some(h => h.step === 1), `depth ${depth}: nothing hit you on arrival`);
      assert.ok(hits.every(h => h.marked), `depth ${depth}: a special hit you on an unmarked tile: ${json(hits)}`);
      const used = ticket.find(e => e.k === 'used');
      assert.equal(json([used.cause.x, used.cause.y]), json(s.dept.entrance), `depth ${depth}: you arrived at the entrance`);
    }
    // Sensitivity: with Wake.lose doing nothing, the special resolves on you at the entrance
    // in the Ticket's own step, from a mark made while you stood across the room.
    const C = loadCore(); C.Wake.lose = () => {};
    const { hits } = run(C, 3, 3);
    assert.ok(hits.some(h => h.step === 1 && h.x === 0 && h.y === 1), json(hits));
  });

  test('the Catalogue Card\'s choice, at every depth: one unknown seal chosen and identified, at no cost; then nothing else waits', () => {
    const C = loadCore();
    const sc = H.scenario({
      name: 'the Card', id: null, clone: true, seeds: [1, 2, 3],
      build: (p, sp, depth, opts) => build(C, opts, { depth, tote: [['card', 2]], known: ['card'] }),
      actions: (s, i) => i === 0 ? { a: 'use', uid: toteUid(s, 'card') } : i === 1 ? { a: 'choose', index: s.ui.pendingChoice.options.length - 1 } : i === 2 ? { a: 'use', uid: toteUid(s, 'card') } : i === 3 ? { a: 'choose', index: 0 } : null,
      expect(r) {
        const ids = r.events.filter(e => e.k === 'identified').map(e => [e.seal, e.cause.k]);
        if (!(ids.length === 2 && ids.every(([, k]) => k === 'card'))) return `identified ${json(ids)}`;
        if (r.state.ui.pendingChoice !== null) return 'a choice still waits';
        if (r.state.run.knownSeals.length !== 3) return `${r.state.run.knownSeals.length} seals known`;
        return r.steps[1].events.length === 1 && r.state.actors[0].next === 200 ? null : `choosing cost time or did more: ${json(r.steps[1].events)}`;
      },
    });
    sweepAll(C, sc, H.DEPTHS.map(depth => ({ sp: null, depth })));
  });

  // ---- Each kind's clause, joined up (W2a-BEHAVIOUR) ----
  // Drinking Consolidant, Fixative and Fumigant, and the Fumigant cloud, are status.test.js's
  // joined scenarios; the thrown Fixative and Consolidant and the Ticket are above. Here the
  // rest, each as its clause says it, at depths 1–7, every invariant, clone-checked.
  const sweepDepths = (C, sc) => sweepAll(C, sc, H.DEPTHS.map(depth => ({ sp: null, depth })));

  test('Solvent, joined up: drunk, it ends every harmful status you have and keeps the rest; thrown, it silently dissolves every intact case in its square, releasing the sleeper inside, hunting', () => {
    const C = loadCore();
    const drunk = H.scenario({
      name: 'Solvent drunk', id: 'CONSUMABLES.solvent', clone: true,
      build: (p, sp, depth, opts) => {
        const s = build(C, opts, { depth, tote: [['solvent', 1]], known: ['solvent'] });
        for (const id of ['rooted', 'restoring', 'coughing']) C.Status.apply(s, s.actors[0], id, 4, { k: 'status', id }, []);
        C.Status.settle(s);
        return s;
      },
      actions: (s, i) => i === 0 ? { a: 'use', uid: toteUid(s, 'solvent') } : null,
      expect(r) {
        const ended = r.steps[0].events.filter(e => e.k === 'status' && !e.on && e.cause.k === 'item').map(e => e.id);
        if (json(ended) !== json(['rooted', 'coughing'])) return `it ended ${json(ended)}`;
        return json(r.state.actors[0].statuses.map(t => t.id)) === json(['restoring']) ? null : `you are left with ${json(r.state.actors[0].statuses.map(t => t.id))}`;
      },
    });
    // The drink scenario's room is made with the statuses on (Status.apply, then settled), as
    // a room for tests may be: nothing in a test room puts them on otherwise.
    sweepDepths(C, drunk);
    const MAP = ['#############', '#...........#', '#....v......#', '#...v.u.....#', '#...........#', '#.......v...#', '#############'];
    const thrown = H.scenario({
      name: 'Solvent thrown', id: 'CONSUMABLES.solvent', clone: true,
      build: (p, sp, depth, opts) => {
        const s = build(C, opts, { depth, map: MAP, you: [1, 1], tote: [['solvent', 1]], known: ['solvent'], exhibits: [{ sp: 'dummy', at: [4, 3], mode: 'dormant', pips: 2, home: [4, 3], stats: C.Roles.stats('fodder', depth) }] });
        for (const [x, y] of [[5, 2], [4, 3], [6, 3], [8, 5]]) s.dept.fixtures.push(C.Cases.make({ x, y, room: null, glass: 2, lock: 3 }));
        s.dept.fixtures.find(f => f.x === 6 && f.y === 3).st = 'open';
        return s;
      },
      actions: (s, i) => i === 0 ? { a: 'throw', uid: toteUid(s, 'solvent'), x: 5, y: 3 } : null,
      expect(r) {
        const ev = r.steps[0].events, broke = ev.filter(e => e.k === 'glass_broke').map(e => [e.x, e.y, e.cause.k, e.shards.length]);
        if (json(broke) !== json([[5, 2, 'solvent', 0], [4, 3, 'solvent', 0]])) return `it dissolved ${json(broke)}: the two intact cases in its square, with no shards, were expected`;
        if (ev.some(e => e.k === 'noise')) return 'it made a noise';
        if (ev.some(e => e.cause && e.cause.k === 'touch_case')) return 'it touched a case';
        const woke = ev.filter(e => e.k === 'woke').map(e => [e.who, e.mode, e.cause.k]);
        if (json(woke) !== json([[r.start.actors[1].uid, 'hunting', 'dissolved']])) return `it woke ${json(woke)}`;
        const t = r.state.dept.tiles;
        return t[2][5] === 'u' && t[3][4] === 'u' && t[3][6] === 'u' && t[5][8] === 'v' ? null : `the tiles are ${t[2]} / ${t[3]} / ${t[5]}`;
      },
    });
    sweepDepths(C, thrown);
  });

  test('"Quiet, Please", joined up: read, it takes every pip from each sleeper within QUIET_RANGE walking tiles; the awake settle where they stand, hunters drop to awake; the Night Watchman and those beyond its range are untouched', () => {
    const C = loadCore(), N = C.N;
    const WIDE = ['#'.repeat(26), ...Array.from({ length: 5 }, () => '#' + '.'.repeat(24) + '#'), '#'.repeat(26)];
    const sc = H.scenario({
      name: 'Quiet read', id: 'CONSUMABLES.quiet', clone: true,
      build: (p, sp, depth, opts) => build(C, opts, { depth, map: WIDE, you: [2, 3], tote: [['quiet', 1]], known: ['quiet'], exhibits: [
        { sp: 'dummy', at: [7, 1], mode: 'dormant', pips: 2, stats: C.Roles.stats('fodder', depth) },
        { sp: 'dummy', at: [6, 5], mode: 'awake', target: [7, 5], stats: C.Roles.stats('fodder', depth) },
        { sp: 'dummy', at: [2 + N.QUIET_RANGE, 3], mode: 'hunting', stats: C.Roles.stats('fodder', depth) },
        { sp: 'night_watchman', at: [4, 3], mode: 'hunting', stats: C.Roles.stats('warden', depth) },
        { sp: 'dummy', at: [3 + N.QUIET_RANGE, 1], mode: 'dormant', pips: 2, stats: C.Roles.stats('fodder', depth) }] }),
      actions: (s, i) => i === 0 ? { a: 'use', uid: toteUid(s, 'quiet') } : null,
      expect(r) {
        const [, sleeper, awake, hunter, watch, far] = r.state.actors, b = r.start.actors;
        if (sleeper.pips !== 0 || sleeper.mode !== 'dormant') return `the sleeper within range has ${sleeper.pips} pips, ${sleeper.mode}`;
        if (awake.mode !== 'dormant' || awake.x !== b[2].x || awake.y !== b[2].y) return `the awake one is ${awake.mode} at ${awake.x},${awake.y}, not asleep where it stood`;
        // The hunter drops to awake as you read (a lost event, cause quiet); seeing you again
        // at its next action, it may hunt again, as any awake exhibit does (§8.2).
        const dropped = r.steps[0].events.find(e => e.k === 'lost' && e.who === hunter.uid);
        if (!dropped || dropped.from !== 'hunting' || dropped.to !== 'awake' || dropped.cause.k !== 'quiet') return `the hunter ${N.QUIET_RANGE} tiles off did not drop to awake: ${json(dropped)}`;
        if (watch.mode !== 'hunting' || r.steps[0].events.some(e => e.who === watch.uid && e.k !== 'moved' && e.k !== 'attacked')) return 'the Night Watchman was touched';
        if (far.pips !== 2) return `the sleeper ${N.QUIET_RANGE + 1} tiles off has ${far.pips} pips`;
        return null;
      },
    });
    sweepDepths(C, sc);
  });

  test('the Floor Plan, joined up, in every department at depths 1–7: read, the whole plan counts as explored, and the rooms whose Highlights are still there are named; one taken is no longer', () => {
    const C = loadCore();
    let n = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const depth of H.DEPTHS) {
      const s = C.Dept.create(depth, acc, depth);
      C.Consumables.make(s, 'plan', { at: 'tote' });
      const turn = s.turn, r = H.play(C, s, [{ a: 'use', uid: toteUid(s, 'plan') }], { clone: true });
      assert.deepEqual(r.violations, [], `${acc} d${depth}`);
      const m = r.state.dept;
      assert.equal(m.seen, '1'.repeat(m.w * m.h), `${acc} d${depth}: the plan shows every tile`);
      assert.equal(m.planRead, turn, `${acc} d${depth}`);
      const rooms = [...new Set(m.highlights.filter(h => { const it = r.state.items.find(i => i.uid === h.uid); return it.where.at === 'floor' || it.where.at === 'case'; }).map(h => h.room))];
      assert.equal(json(C.Consumables.planRooms(r.state)), json(rooms), `${acc} d${depth}`);
      assert.ok(rooms.length >= 1, `${acc} d${depth}: no Highlight to name`);
      // One Highlight taken (put in your tote): its room is no longer named, unless another is there.
      const h = m.highlights[0], it = r.state.items.find(i => i.uid === h.uid);
      it.where = { at: 'tote' }; r.state.you.tote.push(it.uid);
      const left = [...new Set(m.highlights.filter(x => { const i = r.state.items.find(y => y.uid === x.uid); return i.where.at === 'floor' || i.where.at === 'case'; }).map(x => x.room))];
      assert.equal(json(C.Consumables.planRooms(r.state)), json(left));
      n++;
    }
    assert.equal(n, 21);
  });

  test('seals, the deck and the labels, joined up, in every department at depths 1–7: seals shuffled once a run; a department\'s consumables drawn from the deck; each label read identifies its kind for the run, at no cost', () => {
    const C = loadCore(), N = C.N, total = N.DECK.reduce((a, b) => a + b, 0);
    let read = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (const depth of H.DEPTHS) {
      const s = C.Dept.create(depth, acc, depth), where = `${acc} d${depth}`;
      // The seals: four wax seals over the four Solutions, four ink stamps over the Ephemera.
      assert.equal(json([...s.run.seals.sol].sort((a, b) => a - b)), json([0, 1, 2, 3]), where);
      assert.equal(json([...s.run.seals.eph].sort((a, b) => a - b)), json([4, 5, 6, 7]), where);
      // The deck: the department's consumables came out of it, one card each.
      const placed = s.items.filter(i => i.kind === 'consumable');
      assert.equal(placed.length, N.CONSUMABLES_PER_DEPT, where);
      assert.equal(s.run.deck.reduce((a, b) => a + b, 0), total - placed.length, where);
      for (const ck of C.Registry.order('CONSUMABLES')) assert.equal(s.run.deck[C.Registry.CONSUMABLES[ck].deck], N.DECK[C.Registry.CONSUMABLES[ck].deck] - placed.filter(i => i.ck === ck).length, `${where}: ${ck}`);
      // Each label: stand where you can read it (within READ_RANGE, in sight, on a free floor
      // tile), read it, and its kind is known for the run.
      const plaques = s.dept.fixtures.filter(f => f.k === 'plaque');
      assert.equal(plaques.length, N.ID_LABELS_PER_DEPT, where);
      for (const f of plaques) {
        const t = C.State.clone(s), you = t.actors[0], R = N.READ_RANGE, spots = [];
        for (let y = f.y - R; y <= f.y + R; y++) for (let x = f.x - R; x <= f.x + R; x++)
          if (C.Grid.inside(t.dept, x, y) && C.Grid.disc(x - f.x, y - f.y, R) && C.Grid.ch(t.dept, x, y) === '.' && !C.Actors.at(t, x, y) && C.Grid.los(t.dept, x, y, f.x, f.y)) spots.push([x, y]);
        const spot = spots[0];
        assert.ok(spot, `${where}: the label at ${f.x},${f.y} cannot be read from any free floor tile`);
        you.x = spot[0]; you.y = spot[1];
        const before = you.next, r = H.play(C, t, [{ a: 'read', x: f.x, y: f.y }], { clone: true });
        assert.deepEqual(r.violations, [], where);
        const id = r.events.find(e => e.k === 'identified');
        assert.ok(id && id.ck === f.ck && id.cause.k === 'label', `${where}: ${json(r.events.map(e => e.k))}`);
        assert.ok(C.Consumables.known(r.state, f.ck) && r.state.actors[0].next === before, `${where}: known, and it cost nothing`);
        // Known for the rest of the run: a consumable of that kind now says so when used.
        read++;
      }
    }
    assert.ok(read >= 21 * N.ID_LABELS_PER_DEPT);
  });
};
