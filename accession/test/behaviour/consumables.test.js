// Scenarios for the consumables' clauses (BUILD.md §8.6; reg/consumables.js), run through
// the Behaviour-line harness with every invariant checked after every step and a clone
// after every step (§3.5): a thrown Fixative and a thrown Consolidant on every M3 pack
// species (and the Night Watchman) at depths 1–7; a first use of every kind, every way,
// at every depth; the Re-admission Ticket against a pending special (R30c). The other
// Wave 1 packages' hooks that consumables call are driven as their contracts say
// (m3-consumables.test.js, contracts); the joined-up runs are W2a-BEHAVIOUR's.
const H = require('./_harness.js');
const { contracts } = require('../m3-consumables.test.js');

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
  const exhibit = (C, sp, depth, at, extra) => Object.assign({ sp: sp.id, at, mode: 'dormant', stats: C.Roles.stats(sp.role, depth) }, extra || {});
  const toteUid = (s, ck) => s.items.find(i => i.kind === 'consumable' && i.ck === ck && i.where.at === 'tote').uid;
  const sweepAll = (C, sc, list) => { const rs = H.sweep(C, sc, list); assert.deepEqual(H.failures(rs), []); return rs; };

  test('a thrown Fixative fixes an exhibit of every species at every depth for FIXATIVE_TURNS turns from its next decision; in an intact case it is behind glass', () => {
    const C = loadCore(); contracts(C);
    const N = C.N;
    const sc = H.scenario({
      name: 'thrown Fixative fixes', id: null, clone: true,
      build: (p, sp, depth, opts) => build(C, opts, { depth, tote: [['fixative', 1]], known: ['fixative'], exhibits: [exhibit(C, sp, depth, [7, 3])] }),
      actions: (s, i) => i === 0 ? { a: 'throw', uid: toteUid(s, 'fixative'), x: 7, y: 3 } : null,
      expect(r) {
        const a = r.start.actors[1], glass = C.Cases.encased(r.start, a), ev = r.steps[0].events;
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
  });

  test('a thrown Consolidant heals an exhibit of every species at every depth by CONSOLIDANT_THROW_PCT% of its own maximum health, up to it', () => {
    const C = loadCore(); contracts(C);
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
        const healed = ev.filter(e => e.k === 'healed' && e.who === a.uid && e.cause.k === 'item');
        const want = glass ? 0 : Math.min(Math.floor(a.maxHp * N.CONSOLIDANT_THROW_PCT / 100), a.maxHp - a.hp);
        const got = healed.reduce((n, e) => n + e.amount, 0);
        return got === want ? null : `${a.uid} (health ${a.hp} of ${a.maxHp}${glass ? ', in a case' : ''}) was healed by ${got}, not ${want}`;
      },
    });
    sweepAll(C, sc, everySpecies(C));
  });

  // Each kind, unknown, used each way it can be from where you stand: drunk or read, and, for
  // a Solution, thrown at the nearest tile a first throw allows (3 tiles east) and refused
  // at 2. A first use never harms you (the consumable_first_use invariant, checked after
  // every step), and identifies the kind at once.
  test('a first use of every kind, every way, at every depth, never harms you, and identifies its kind at once', () => {
    const C = loadCore(); contracts(C);
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

  test('the first-use invariant bites: a Fixative that harmed on a first drink is caught', () => {
    const C = loadCore(); contracts(C);
    C.Registry.CONSUMABLES.fixative.harmfulDrink = false;
    const s = build(C, { seed: 1 }, { depth: 1, tote: [['fixative', 1]] });
    const r = H.play(C, s, [{ a: 'use', uid: toteUid(s, 'fixative') }], { inv: ['consumable_first_use'] });
    assert.equal(r.violations.length, 1, json(r.violations));
    assert.match(r.violations[0].text, /consumable_first_use: a first use of .* made you fixed/);
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
      const C = loadCore(); contracts(C);
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
    const C = loadCore(); contracts(C); C.Wake.lose = () => {};
    const { hits } = run(C, 3, 3);
    assert.ok(hits.some(h => h.step === 1 && h.x === 0 && h.y === 1), json(hits));
  });

  test('the Catalogue Card\'s choice, at every depth: one unknown seal chosen and identified, at no cost; then nothing else waits', () => {
    const C = loadCore(); contracts(C);
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
};
