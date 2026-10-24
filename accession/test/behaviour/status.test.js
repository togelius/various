// Behaviour scenarios for the statuses and surfaces (BUILD.md §5.3; §8.1, §8.6): each clause in
// js/core/reg/status.js, written as a function of its parameters, swept over every species
// and depth that uses it (rooted: every mimic species; fixed on an exhibit: every M3 species,
// Fixative being thrown at any of them) and, for a status or surface no species inflicts,
// over depths 1–7 in a room of its own. Every run is clone-checked and holds the invariants
// of status.inv.js after every step. The other packages' rules are driven directly here: the
// Fixative, Fumigant and Consolidant are planted actions that put the status on during your
// action, through Status.apply, as W1-CONSUMABLES' drinks and throws do; the mimic's grip is
// a planted open or bash that touches the mimic through its archetype's hook (W1-ARCH-C's
// grip), and grips you itself only while that hook does nothing. The joined-up runs, with
// every package's invariants (INV = 'all'), are W2a-BEHAVIOUR's.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const json = x => JSON.stringify(x);
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const WIDE = ['###############', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '###############'];
  const DOOR = ['#########', '#.......#', '#..+....#', '#.......#', '#.......#', '#########'];
  const COSTS = [100, 150, 200, 300];
  const INV = ['status'];
  const of = (ev, k, f) => ev.filter(e => e.k === k && (!f || f(e)));

  // One context for every scenario, with the planted actions:
  //   {a: 'wait', cost?, put?: [{who, id, turns, cause?}], lay?: [{kind, x, y, size, turns}]}
  //     a wait of `cost` ticks that puts statuses on, and lays surfaces, at its end;
  //   {a: 'open' | 'bash', cost, grip: uid, turns} an open or bash of `cost` ticks that
  //     touches the mimic `grip` (Archetypes.onTouched, W1-ARCH-C's grip, which wakes it and
  //     roots you); while that hook is Wave 0's, which does nothing, the plant grips you for
  //     `turns` turns itself, the grip named for the mimic.
  // Restoring heals through Health.heal, W1-COMBAT's; while that is Wave 0's stub, a stand-in
  // heals up to the maximum and says so.
  const X = loadCore(), { N, Registry: R, Clauses, Roles, Packs } = X;
  {
    const wait = X.Actions.get('wait'), orig = wait.apply;
    wait.apply = (state, action, ev) => {
      const c = orig(state, action, ev);
      for (const p of action.put || []) X.Status.apply(state, X.Actors.byUid(state, p.who), p.id, p.turns, p.cause || { k: 'status', id: p.id }, ev);
      for (const l of action.lay || []) X.Surfaces.add(state, l.kind, l.x, l.y, l.size, l.turns, 'you', ev);
      return action.cost === undefined ? c : action.cost;
    };
    for (const id of ['open', 'bash']) X.Actions.get(id).apply = (state, action, ev) => {
      const you = state.actors[0], mimic = X.Actors.byUid(state, action.grip);
      X.Archetypes.onTouched(state, mimic, id === 'open' ? 'opened' : 'bashed', 'you', ev);
      if (!X.Status.has(you, 'rooted')) X.Status.apply(state, you, 'rooted', action.turns, { k: 'grip', by: action.grip }, ev);
      return action.cost;
    };
    if (/^function heal\([^)]*\)\s*\{\s*return 0;\s*\}$/.test(String(X.Health.heal))) X.Health.heal = (state, who, n, cause, ev) => {
      const amount = Math.min(n, who.maxHp - who.hp);
      if (amount <= 0) return 0;
      who.hp += amount;
      X.Causes.emit(state, ev, 'healed', { who: who.uid, amount, hp: who.hp }, cause);
      return amount;
    };
  }
  const stats = o => Object.assign({ hp: 60, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 }, o);
  const room = (map, you, exhibits, extra, opts, more) => X.Setup.room(opts.seed, Object.assign({ acc: 'T0', depth: more.depth, map, you, exhibits: exhibits || [] }, extra),
    Object.assign({ rulesOff: opts.rulesOff }, more.options));
  // A status's or surface's parameters at a depth, as its clause names them.
  const params = (table, id, depth) => Clauses.params(R[table][id].params, null, { depth });
  const depths = () => H.DEPTHS.map(depth => ({ sp: null, depth }));
  // Every species an M3 department may hold, from the packs and the shared ones, at every depth.
  const everySpecies = () => {
    const out = [];
    for (const p of Packs.list()) for (const sp of p.species) if (R.ARCHETYPES[sp.archetype] && R.ARCHETYPES[sp.archetype].built === 'M3') for (const depth of H.DEPTHS) out.push({ sp, depth });
    for (const sp of Packs.sharedList()) for (const depth of H.DEPTHS) out.push({ sp, depth });
    return out;
  };
  const sweep = (sc, list) => {
    const results = H.sweep(X, sc, list, { inv: INV });
    assert.ok(results.length >= list.length, sc.name);
    assert.equal(json(H.failures(results)), '[]', sc.name);
    return results;
  };

  test('fixed (Fixative drunk): after an action of any length, exactly FIXATIVE_TURNS forced waits, then free', () => {
    const sc = H.scenario({
      name: 'Fixative drunk at the end of an action', seeds: [1, 2, 3, 4], clone: true, inv: INV,
      build: (p, sp, depth, opts) => room(OPEN, [3, 2], [], {}, opts, { depth }),
      actions: (s, i, c) => {
        const n = params('STATUSES', 'fixed', c.depth).FIXATIVE_TURNS;
        if (i === 0) return { a: 'wait', cost: COSTS[(s.seed - 1) % 4], put: [{ who: 'you', id: 'fixed', turns: n }] };
        if (X.Status.has(s.actors[0], 'fixed')) return i % 2 ? { a: 'move', dir: 2 } : { a: 'wait' };
        return c.last.some(e => e.k === 'moved') ? null : { a: 'move', dir: 2 };
      },
      expect(r, p, sp, depth) {
        const n = params('STATUSES', 'fixed', depth).FIXATIVE_TURNS, cost = COSTS[(r.seed - 1) % 4];
        const forced = r.steps.slice(1).filter(st => st.action.a === 'wait').length;
        const refused = r.steps.filter(st => st.events[0].k === 'refused').map(st => st.events[0].reason);
        if (forced !== n) return `fixed for ${n} turns after a ${cost}-tick action, but ${forced} forced waits`;
        if (refused.some(x => x !== 'fixed') || !refused.length) return `refusals ${json(refused)}`;
        const off = of(r.events, 'status', e => e.id === 'fixed' && !e.on)[0];
        if (!off || off.turn !== Math.floor(cost / 100) + n) return `it ended at ${off && off.turn}`;
        return of(r.events, 'moved', e => e.who === 'you').length === 1 ? null : 'not free to step after';
      },
    });
    sweep(sc, depths());
  });

  test('fixed (Fixative thrown): an exhibit of every M3 species, at every depth, hunting you and fixed during your action, only waits for its FIXATIVE_TURNS turns from its next decision, and a mark it had pending is called off', () => {
    // The exhibit hunts you from three tiles east. Fixative lands on it during your wait in
    // turn seed − 1, after it has had that many turns to come at you, or sooner, at your first
    // decision at which it holds a mark of its own (its archetype's special, once those are
    // built), so that the Fixative finds the mark pending. With seed 2 it first acts at tick
    // 50, so that its next decision as Fixative lands is mid-turn, or (a slow species) in a
    // later turn than yours. The wait that throws it notes, for expect, the exhibit's next
    // decision then (its `next` field) and whether it held a mark (`held`).
    const thrown = r => r.steps.findIndex(st => st.action.put);
    const sc = H.scenario({
      name: 'a fixed exhibit only waits', seeds: [1, 2, 3], clone: true, inv: INV,
      build: (p, sp, depth, opts) => room(WIDE, [3, 3], [{ sp: sp.id, at: [6, 3], mode: 'hunting', stats: Roles.stats(sp.role, depth), next: opts.seed === 2 ? 50 : 0 }], {}, opts,
        { depth, options: { invulnerable: true } }),
      actions: (s, i, c) => {
        const n = params('STATUSES', 'fixed', c.depth).FIXATIVE_TURNS, a = s.actors[1], prior = c.events.some(e => e.k === 'status' && e.on);
        if (prior) return (c.events.some(e => e.k === 'status' && !e.on) && i > 3) || i > 2 * n + 4 ? null : { a: 'wait' };
        if (i < s.seed - 1 && !a.telegraph) return { a: 'wait' };
        return { a: 'wait', next: a.next, held: !!a.telegraph, put: [{ who: a.uid, id: 'fixed', turns: n, cause: { k: 'status', id: 'fixed', by: 'you' } }] };
      },
      expect(r, p, sp, depth) {
        const n = params('STATUSES', 'fixed', depth).FIXATIVE_TURNS, uid = r.state.actors[1].uid, at = thrown(r);
        if (at < 0) return 'no Fixative was thrown';
        const step = r.steps[at], from = Math.floor(step.action.next / N.TICKS_PER_TURN), end = (from + n) * N.TICKS_PER_TURN;
        const ons = of(r.events, 'status', e => e.who === uid && e.id === 'fixed' && e.on);
        if (ons.length !== 1 || ons[0].turns !== n || !step.events.includes(ons[0])) return `Fixative put on ${json(ons)}`;
        const off = of(r.events, 'status', e => e.who === uid && e.id === 'fixed' && !e.on)[0];
        if (!off || off.turn !== from + n) return `fixed at its next decision, at ${step.action.next} in turn ${from}, for ${n} turns, it ended at ${off && off.turn}`;
        const after = r.events.slice(r.events.indexOf(ons[0]) + 1);
        const acted = after.find(e => e.tick < end && ((e.k === 'attacked' && e.by === uid) || (e.k === 'moved' && e.who === uid) ||
          (e.k === 'telegraphed' && e.who === uid) || (e.k === 'special' && e.who === uid && !e.cancelled)));
        if (acted) return `it was fixed and made a ${acted.k} event at tick ${acted.tick}`;
        // A mark pending as the Fixative lands is called off at once, in the same action.
        const cancel = after[0];
        if (step.action.held && !(cancel && cancel.k === 'special' && cancel.who === uid && cancel.cancelled && cancel.cause.why === 'fixed')) return `its pending mark was not called off as Fixative landed: ${json(cancel)}`;
        return null;
      },
    });
    const list = everySpecies();
    assert.ok(list.length >= 7 * 12, `${list.length / 7} species`);
    const results = sweep(sc, list);
    const nexts = results.map(x => [x.steps[thrown(x)].action.next, x.steps[thrown(x)].events[0].tick]);
    assert.ok(nexts.some(([n]) => n % N.TICKS_PER_TURN !== 0), 'a next decision mid-turn');
    assert.ok(nexts.some(([n, t]) => Math.floor(n / N.TICKS_PER_TURN) > Math.floor(t / N.TICKS_PER_TURN)), 'a next decision in a later turn than yours');
    assert.ok(nexts.some(([n, t]) => n === t), 'a next decision at the same tick as yours');
  });

  test('rooted (the mimic\'s grip): for every mimic species and depth, after an open, a bash or a Heavy bash, your next MIMIC_GRIP_TURNS turns\' steps are refused, and only those', () => {
    const ACTS = [['open', N.COST_OPEN_CASE], ['bash', N.COST_BASH], ['bash', N.COST_BASH_HEAVY]];
    const sc = H.scenario({
      name: 'the grip holds you for its turns', id: 'rooted', seeds: [1, 2, 3], clone: true, inv: INV,
      // The mimic sleeps out of your ring; the closed door is south of you, a free tile east.
      build: (p, sp, depth, opts) => room(DOOR, [3, 1], [{ sp: sp.id, at: [7, 4], stats: Roles.stats(sp.role, depth) }], {}, opts, { depth }),
      actions: (s, i, c) => {
        const [act, cost] = ACTS[(s.seed - 1) % 3], you = s.actors[0];
        if (i === 0) return { a: act, x: 2, y: 2, cost, grip: s.actors[1].uid, turns: c.params.MIMIC_GRIP_TURNS };
        const last = c.last[0];
        // Gripped: try the step east; once refused, bump the door (it opens, you stay) or wait.
        if (X.Status.has(you, 'rooted')) return last && last.k === 'refused' ? (X.Grid.ch(s.dept, 3, 2) === '+' ? { a: 'move', dir: 4 } : { a: 'wait' }) : { a: 'move', dir: 2 };
        return c.last.some(e => e.k === 'moved') ? null : { a: 'move', dir: 2 };
      },
      expect(r, p) {
        const n = p.MIMIC_GRIP_TURNS, [act, cost] = ACTS[(r.seed - 1) % 3];
        const refused = r.steps.filter(st => st.events[0].k === 'refused').map(st => st.events[0].reason);
        if (refused.length !== n || refused.some(x => x !== 'rooted')) return `gripped for ${n} turns after a ${cost}-tick ${act}: refused ${json(refused)}`;
        if (of(r.events, 'opened').length !== 1 || r.events.some(e => e.k === 'moved' && e.who === 'you' && e.tick < r.steps[r.steps.length - 1].events[0].tick)) return 'the door bump did not open the door, or you moved while gripped';
        const grip = of(r.events, 'status', e => e.id === 'rooted' && e.on)[0];
        return grip && grip.turns === n && grip.cause.k === 'grip' ? null : `the grip's event ${json(grip)}`;
      },
    });
    const list = H.species(X, 'rooted');
    assert.ok(list.length >= 7, json(list.map(x => x.sp.id)));
    sweep(sc, list);
  });

  test('coughing (Fumigant drunk): COUGH_TURNS soft noises at your tile, one at each boundary of your next COUGH_TURNS turns', () => {
    const sc = H.scenario({
      name: 'a cough a turn', seeds: [1, 2, 3, 4], clone: true, inv: INV,
      build: (p, sp, depth, opts) => room(WIDE, [5, 3], [], {}, opts, { depth }),
      actions: (s, i, c) => {
        const n = params('STATUSES', 'coughing', c.depth).COUGH_TURNS;
        if (i === 0) return { a: 'wait', cost: COSTS[(s.seed - 1) % 4], put: [{ who: 'you', id: 'coughing', turns: n }] };
        return i <= n + 2 ? (i % 2 ? { a: 'move', dir: i % 4 === 1 ? 2 : 6 } : { a: 'wait' }) : null;
      },
      expect(r, p, sp, depth) {
        const q = params('STATUSES', 'coughing', depth), n = q.COUGH_TURNS, first = Math.floor(COSTS[(r.seed - 1) % 4] / 100);
        const coughs = of(r.events, 'noise', e => e.cause.k === 'cough');
        if (json(coughs.map(e => e.turn)) !== json(Array.from({ length: n }, (_, k) => first + k))) return `coughs in turns ${json(coughs.map(e => e.turn))}`;
        return coughs.every(e => e.cls === 'soft' && e.range === q.NOISE_SOFT && e.cause.by === 'you') ? null : 'not your soft noise';
      },
    });
    sweep(sc, depths());
  });

  test('restoring (Consolidant drunk): CONSOLIDANT_HOT_PCT% of maximum health over CONSOLIDANT_HOT_TURNS turns, a share each turn, at every maximum', () => {
    const sc = H.scenario({
      name: 'restoring sums to its total', seeds: [1, 2, 3, 4], clone: true, inv: INV,
      build: (p, sp, depth, opts) => {
        const s = room(OPEN, [3, 2], [], {}, opts, { depth });
        s.actors[0].maxHp = N.PLAYER_HP + 7 * (depth - 1) + opts.seed; s.actors[0].hp = 1;
        return s;
      },
      actions: (s, i, c) => {
        const q = params('STATUSES', 'restoring', c.depth);
        if (i === 0) return { a: 'wait', cost: COSTS[(s.seed - 1) % 4], put: [{ who: 'you', id: 'restoring', turns: q.CONSOLIDANT_HOT_TURNS }] };
        return i <= q.CONSOLIDANT_HOT_TURNS + 3 ? { a: 'wait' } : null;
      },
      expect(r, p, sp, depth) {
        const q = params('STATUSES', 'restoring', depth), max = r.start.actors[0].maxHp, total = Math.floor(max * q.CONSOLIDANT_HOT_PCT / 100);
        const heals = of(r.events, 'healed', e => e.cause.k === 'status' && e.cause.id === 'restoring'), sum = heals.reduce((n, e) => n + e.amount, 0);
        if (sum !== total) return `${q.CONSOLIDANT_HOT_PCT}% of ${max} is ${total}, but restoring healed ${sum}`;
        const first = Math.floor(COSTS[(r.seed - 1) % 4] / 100), turns = heals.map(e => e.turn);
        return turns.every(t => t >= first && t < first + q.CONSOLIDANT_HOT_TURNS) && new Set(turns).size === turns.length ? null : `healed in turns ${json(turns)}`;
      },
    });
    sweep(sc, depths());
    // Put on again two turns into its course, it lasts longer at the same rate: a share each
    // turn of the longer course, and every CONSOLIDANT_HOT_TURNS turns in a row heal the total.
    const again = H.scenario({
      name: 'restoring put on again heals at the same rate for longer', seeds: [1, 2, 3, 4], clone: true, inv: INV,
      build: sc.build,
      actions: (s, i, c) => {
        const q = params('STATUSES', 'restoring', c.depth), dose = { who: 'you', id: 'restoring', turns: q.CONSOLIDANT_HOT_TURNS };
        if (i === 0) return { a: 'wait', cost: COSTS[(s.seed - 1) % 4], put: [dose] };
        if (i === 2) return { a: 'wait', put: [dose] };
        return i <= 2 * q.CONSOLIDANT_HOT_TURNS + 2 ? { a: 'wait' } : null;
      },
      expect(r, p, sp, depth) {
        const q = params('STATUSES', 'restoring', depth), T = q.CONSOLIDANT_HOT_TURNS, max = r.start.actors[0].maxHp, total = Math.floor(max * q.CONSOLIDANT_HOT_PCT / 100);
        const heals = of(r.events, 'healed', e => e.cause.k === 'status' && e.cause.id === 'restoring'), first = Math.floor(COSTS[(r.seed - 1) % 4] / 100);
        const turns = heals.map(e => e.turn), shares = heals.map(e => e.amount);
        if (heals.length <= T || turns.some((t, k) => t !== first + k)) return `healed in turns ${json(turns)}, not every turn from ${first} for longer than ${T}`;
        for (let k = 0; k + T <= shares.length; k++) {
          const sum = shares.slice(k, k + T).reduce((a, b) => a + b, 0);
          if (sum !== total) return `${q.CONSOLIDANT_HOT_PCT}% of ${max} is ${total}, but turns ${turns[k]}–${turns[k + T - 1]} healed ${sum} (${json(shares)})`;
        }
        const off = of(r.events, 'status', e => e.id === 'restoring' && !e.on);
        return off.length === 1 && off[0].turn === turns[turns.length - 1] + 1 ? null : `it ended ${json(off.map(e => e.turn))}, after healing in turns ${json(turns)}`;
      },
    });
    sweep(again, depths());
  });

  test('slowed and dazed: your actions take SPEED_SLOW_PCT% of their time; your blows have HIT_DAZED_ATTACKER to hit, and +HIT_FIXED_TARGET against a fixed target', () => {
    const slowed = H.scenario({
      name: 'slowed doubles your actions', clone: true, inv: INV,
      build: (p, sp, depth, opts) => room(OPEN, [3, 2], [], { youStatuses: [{ id: 'slowed', turns: 4 }] }, opts, { depth }),
      actions: [{ a: 'wait' }, { a: 'move', dir: 2 }, { a: 'move', dir: 6 }, { a: 'wait' }, { a: 'wait' }],
      expect(r, p, sp, depth) {
        const pct = params('STATUSES', 'slowed', depth).SPEED_SLOW_PCT, ticks = r.steps.map(st => st.events.find(e => e.k !== 'status').tick);
        // Slowed for turns 0–3: each decision in those turns costs pct% of its 100 ticks.
        const want = [];
        for (let t = 0, k = 0; k < 5; k++) { want.push(t); t += Math.floor(t / 100) < 4 ? Math.floor(100 * pct / 100) : 100; }
        return json(ticks) === json(want) ? null : `your decisions at ${json(ticks)}, not ${json(want)}`;
      },
    });
    sweep(slowed, depths());
    const dazed = H.scenario({
      name: 'dazed and fixed change the chance to hit', seeds: [1, 2, 3, 4], clone: true, inv: INV,
      build: (p, sp, depth, opts) => room(OPEN, [3, 2], [{ sp: 'dummy', at: [4, 2], mode: 'hunting', stats: Object.assign(stats({ hp: 999, acc: -99 }), { eva: depth - 2 }),
        statuses: opts.seed > 2 ? [{ id: 'fixed', turns: 4 }] : [] }], { youStatuses: opts.seed % 2 ? [{ id: 'dazed', turns: 4 }] : [] }, opts, { depth }),
      actions: (s, i) => i < 2 ? { a: 'attack', uid: s.actors[1].uid } : null,
      expect(r, p, sp, depth) {
        const you = r.start.actors[0], it = r.start.actors[1], mods = (r.seed % 2 ? N.HIT_DAZED_ATTACKER : 0) + (r.seed > 2 ? N.HIT_FIXED_TARGET : 0);
        const want = Math.max(N.HIT_MIN, Math.min(N.HIT_MAX, N.HIT_BASE + N.HIT_PER_POINT * (you.acc - it.eva) + mods));
        const got = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.by === 'you').map(e => e.cause.chance);
        return got.length === 2 && got.every(c => c === want) ? null : `chance ${json(got)}, not ${want}`;
      },
    });
    sweep(dazed, depths());
  });

  test('the Fumigant cloud and plaster dust: they block sight both ways for their turns, then clear; the cloud takes a pip a turn from each sleeper inside', () => {
    for (const kind of ['fumigant', 'dust']) {
      const sc = H.scenario({
        name: `${kind} for its turns`, clone: true, inv: INV,
        build: (p, sp, depth, opts) => room(WIDE, [1, 3], [{ sp: 'dummy', at: [8, 3], pips: 2, stats: stats() }, { sp: 'dummy', at: [7, 1], pips: 1, stats: stats() },
          { sp: 'dummy', at: [12, 3], pips: 2, stats: stats() }], {}, opts, { depth }),
        actions: (s, i, c) => {
          const q = params('SURFACES', kind, c.depth), size = q[kind === 'fumigant' ? 'FUMIGANT_SIZE' : 'PLASTER_DUST_SIZE'], turns = q[kind === 'fumigant' ? 'FUMIGANT_TURNS' : 'PLASTER_DUST_TURNS'];
          if (i === 0) return { a: 'wait', lay: [{ kind, x: 8, y: 3, size, turns }] };
          return i <= turns + 1 ? { a: 'wait' } : null;
        },
        expect(r, p, sp, depth) {
          const q = params('SURFACES', kind, depth), turns = q[kind === 'fumigant' ? 'FUMIGANT_TURNS' : 'PLASTER_DUST_TURNS'];
          const [, a, b, far] = r.state.actors;
          const lost = who => of(r.events, 'pip', e => e.who === who.uid && e.cause.k === 'fumigant').map(e => e.turn);
          if (r.state.dept.surfaces.length) return `the ${kind} still lies after ${turns} turns`;
          if (kind === 'fumigant') {
            if (json(lost(a)) !== json([1, 2]) || json(lost(b)) !== json([1])) return `pips lost ${json([lost(a), lost(b)])}`;
            if (lost(far).length) return 'a sleeper outside the cloud lost a pip';
          } else if (of(r.events, 'pip', e => e.cause.k === 'fumigant').length) return 'dust took a pip';
          return null;
        },
      });
      sweep(sc, depths());
      // Sight both ways while it lies, from a run of one depth step by step.
      const s = room(WIDE, [1, 3], [], {}, { seed: 1, rulesOff: [] }, { depth: 4 });
      const q = params('SURFACES', kind, 4), turns = q[kind === 'fumigant' ? 'FUMIGANT_TURNS' : 'PLASTER_DUST_TURNS'];
      X.Step.step(s, { a: 'wait', lay: [{ kind, x: 7, y: 3, size: 3, turns }] });
      const seen = [];
      for (let k = 1; k <= turns + 1; k++) { seen.push([X.Grid.los(s.dept, 1, 3, 13, 3), X.Grid.los(s.dept, 13, 3, 1, 3)]); X.Step.step(s, { a: 'wait' }); }
      assert.equal(json(seen), json(Array.from({ length: turns + 1 }, (_, k) => k < turns ? [false, false] : [true, true])), kind);
    }
  });
};
