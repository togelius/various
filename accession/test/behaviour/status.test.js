// Behaviour scenarios for the statuses and surfaces (BUILD.md §5.3; §8.1, §8.6): each clause in
// js/core/reg/status.js, written as a function of its parameters, swept over every species
// and depth that uses it (rooted: every mimic species; fixed on an exhibit: every M3 species,
// Fixative being thrown at any of them) and, for a status or surface no species inflicts,
// over depths 1–7 in a room of its own. Every run is clone-checked and holds every package's
// invariants after every step (INV = 'all'). Two kinds of scenario:
//   - the timing table of §8.1 (A9b), with the status put on through Status.apply by a
//     planted action of each length (100, 150, 200 and 300 ticks), which no real source of
//     a status can give: these test the status rule itself;
//   - joined up (W2a-BEHAVIOUR), at the end: each status and surface put on as the game puts
//     it on, in a core with nothing planted (J): Fixative, Fumigant and Consolidant drunk or
//     thrown from your tote, the mimic's grip by a real open or bash of its case, the dust
//     of a plaster cast you destroy. slowed and dazed have no source in M3 (the clause stays
//     tested): they are given in the room as it is made.
'use strict';
const H = require('./_harness.js');

module.exports = ({ test, assert, loadCore }) => {
  const json = x => JSON.stringify(x);
  const OPEN = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const WIDE = ['###############', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '###############'];
  const DOOR = ['#########', '#.......#', '#..+....#', '#.......#', '#.......#', '#########'];
  const COSTS = [100, 150, 200, 300];
  const INV = 'all';
  const of = (ev, k, f) => ev.filter(e => e.k === k && (!f || f(e)));

  // The timing table's context, X, with one planted action:
  //   {a: 'wait', cost?, put?: [{who, id, turns, cause?}], lay?: [{kind, x, y, size, turns}]}
  //     a wait of `cost` ticks that puts statuses on, and lays surfaces, at its end.
  // Restoring heals through Health.heal, W1-COMBAT's real one.
  const X = loadCore(), { N, Registry: R, Clauses, Roles, Packs } = X;
  // The real core, with nothing planted: the joined-up scenarios (W2a-BEHAVIOUR).
  const J = loadCore();
  {
    const wait = X.Actions.get('wait'), orig = wait.apply;
    wait.apply = (state, action, ev) => {
      const c = orig(state, action, ev);
      for (const p of action.put || []) X.Status.apply(state, X.Actors.byUid(state, p.who), p.id, p.turns, p.cause || { k: 'status', id: p.id }, ev);
      for (const l of action.lay || []) X.Surfaces.add(state, l.kind, l.x, l.y, l.size, l.turns, 'you', ev);
      return action.cost === undefined ? c : action.cost;
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

  test('rooted (the mimic\'s grip, joined up): for every mimic species and depth, after a real open, bash or Heavy bash of its case, your next MIMIC_GRIP_TURNS turns\' steps are refused, and only those', () => {
    // The real open and bash (W1-CASES) touch the real mimic (W1-ARCH-C), which grips you as
    // it wakes; you are of grade VII, so that its lock never stops the open, and kept alive,
    // so that every step is played. The mimic sleeps in its disguise west of you; the closed
    // door is south of you, a free tile east.
    const ACTS = [['open', N.COST_OPEN_CASE, 'balanced'], ['bash', N.COST_BASH, 'balanced'], ['bash', N.COST_BASH_HEAVY, 'heavy']];
    const sc = H.scenario({
      name: 'the grip holds you for its turns', id: 'rooted', seeds: [1, 2, 3], clone: true,
      build: (p, sp, depth, opts) => J.Setup.room(opts.seed, { acc: 'T0', depth, map: DOOR, you: [3, 1], grade: 7, kit: { weapon: { form: ACTS[(opts.seed - 1) % 3][2], tier: 1 } },
        exhibits: [{ sp: sp.id, at: [2, 1], stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff, invulnerable: true }),
      actions: (s, i, c) => {
        const [act] = ACTS[(s.seed - 1) % 3], you = s.actors[0];
        if (i === 0) return { a: act, x: 2, y: 1 };
        const last = c.last[0];
        // Gripped: try the step east; once refused, bump the door (it opens, you stay) or wait.
        if (J.Status.has(you, 'rooted')) return last && last.k === 'refused' ? (J.Grid.ch(s.dept, 3, 2) === '+' ? { a: 'move', dir: 4 } : { a: 'wait' }) : { a: 'move', dir: 2 };
        return c.last.some(e => e.k === 'moved' && e.who === 'you') ? null : { a: 'move', dir: 2 };
      },
      expect(r, p) {
        const n = p.MIMIC_GRIP_TURNS, [act, cost] = ACTS[(r.seed - 1) % 3], m = r.start.actors[1];
        if (r.steps[0].events[0].k === 'refused') return `the ${act} was refused: ${json(r.steps[0].events[0])}`;
        if (r.steps[1].events[0].tick !== cost) return `the ${act} took until ${r.steps[1].events[0].tick}, not ${cost}`;
        const refused = r.steps.filter(st => st.events[0].k === 'refused').map(st => st.events[0].reason);
        if (refused.length !== n || refused.some(x => x !== 'rooted')) return `gripped for ${n} turns after a ${cost}-tick ${act}: refused ${json(refused)}`;
        if (of(r.events, 'opened').length !== 1 || r.events.some(e => e.k === 'moved' && e.who === 'you' && e.tick < r.steps[r.steps.length - 1].events[0].tick)) return 'the door bump did not open the door, or you moved while gripped';
        const grip = of(r.events, 'status', e => e.id === 'rooted' && e.on)[0];
        if (!grip || grip.turns !== n || grip.cause.k !== 'grip' || grip.cause.by !== m.uid || grip.who !== 'you') return `the grip's event ${json(grip)}`;
        const woke = of(r.steps[0].events, 'woke', e => e.who === m.uid)[0];
        return woke && woke.mode === 'hunting' && woke.cause.k === 'touch_case' ? null : `the touch did not wake it hunting: ${json(woke)}`;
      },
    });
    const list = H.species(J, 'rooted');
    assert.ok(list.length >= 7, json(list.map(x => x.sp.id)));
    const results = H.sweep(J, sc, list);
    assert.equal(json(H.failures(results)), '[]', sc.name);
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

  // ---- Joined up (W2a-BEHAVIOUR) ----
  // Each status and surface put on as the game puts it on, in the real core J with nothing
  // planted: Fixative, Fumigant and Consolidant drunk or thrown from your tote
  // (W1-CONSUMABLES), the dust of a plaster cast you destroy (W1-ARCH-A); every invariant
  // after every step, every run clone-checked. (The grip is the rooted scenario above.)
  // carry: your tote holds n of each kind given, known (identified) unless said otherwise.
  const carry = (s, tote, known) => {
    J.Consumables.startRun(s);
    for (const [ck, n] of tote) for (let k = 0; k < n; k++) J.Consumables.make(s, ck, { at: 'tote' });
    for (const ck of known === undefined ? tote.map(t => t[0]) : known) if (!s.run.knownSeals.includes(J.Consumables.sealFor(s, ck))) s.run.knownSeals.push(J.Consumables.sealFor(s, ck));
    return s;
  };
  const toteUid = (s, ck) => s.items.find(i => i.kind === 'consumable' && i.ck === ck && i.where.at === 'tote').uid;
  const jroom = (map, you, exhibits, extra, opts, more) => J.Setup.room(opts.seed, Object.assign({ acc: 'T0', depth: more.depth, map, you, exhibits: exhibits || [] }, extra),
    Object.assign({ rulesOff: opts.rulesOff }, more.options));
  const jsweep = (sc, list) => {
    const results = H.sweep(J, sc, list);
    assert.ok(results.length >= list.length, sc.name);
    assert.equal(json(H.failures(results)), '[]', sc.name);
    return results;
  };

  test('fixed, joined up: a known Fixative drunk fixes you for exactly FIXATIVE_TURNS forced waits from your next decision, after a drink of 100 ticks or, slowed, of 200', () => {
    const sc = H.scenario({
      name: 'Fixative drunk, for real', id: 'STATUSES.fixed', seeds: [1, 2], clone: true,
      build: (p, sp, depth, opts) => carry(jroom(OPEN, [3, 2], [], opts.seed === 2 ? { youStatuses: [{ id: 'slowed', turns: 1 }] } : {}, opts, { depth }), [['fixative', 1]]),
      actions: (s, i) => {
        if (i === 0) return { a: 'use', uid: toteUid(s, 'fixative') };
        if (J.Status.has(s.actors[0], 'fixed')) return i % 2 ? { a: 'move', dir: 2 } : { a: 'wait' };
        return s.actors[0].x === 3 ? { a: 'move', dir: 2 } : null;
      },
      expect(r, p) {
        const n = p.FIXATIVE_TURNS, drink = r.steps[1].events[0].tick;
        if (drink !== 100 * r.seed) return `the drink took until ${drink}`;
        const forced = r.steps.slice(1).filter(st => st.action.a === 'wait').length;
        const refused = r.steps.filter(st => st.events[0].k === 'refused').map(st => st.events[0].reason);
        if (forced !== n) return `fixed for ${n} turns after a ${drink}-tick drink, but ${forced} forced waits`;
        if (!refused.length || refused.some(x => x !== 'fixed')) return `refusals ${json(refused)}`;
        const on = of(r.events, 'status', e => e.id === 'fixed' && e.on)[0], off = of(r.events, 'status', e => e.id === 'fixed' && !e.on)[0];
        if (!on || on.cause.k !== 'item' || on.turns !== n) return `put on as ${json(on)}`;
        return off && off.turn === drink / 100 + n ? null : `it ended at ${off && off.turn}`;
      },
    });
    jsweep(sc, depths());
  });

  test('slowed, joined up: every consumable action takes SPEED_SLOW_PCT% of COST_USE while you are slowed, and COST_USE otherwise: a drink, a first drink of a harmful kind, a throw and a read', () => {
    // Seeds 1–4 slowed for this turn, 5–8 not; each seed's action, from your tote (known
    // unless it is the first drink): Consolidant drunk, Fixative drunk unknown (harmless, as
    // a first drink of a harmful kind is), Fixative thrown three tiles off, "Quiet, Please"
    // read. Your next decision comes when that action's ticks are done.
    const WAYS = [
      { ck: 'consolidant', known: true, act: s => ({ a: 'use', uid: toteUid(s, 'consolidant') }) },
      { ck: 'fixative', known: false, act: s => ({ a: 'use', uid: toteUid(s, 'fixative') }) },
      { ck: 'fixative', known: true, act: s => ({ a: 'throw', uid: toteUid(s, 'fixative'), x: 6, y: 2 }) },
      { ck: 'quiet', known: true, act: s => ({ a: 'use', uid: toteUid(s, 'quiet') }) },
    ];
    const way = seed => WAYS[(seed - 1) % WAYS.length], slow = seed => seed <= WAYS.length;
    let next = null;
    const sc = H.scenario({
      name: 'a consumable action, slowed or not', id: 'STATUSES.slowed', seeds: [1, 2, 3, 4, 5, 6, 7, 8], clone: true,
      build: (p, sp, depth, opts) => carry(jroom(OPEN, [3, 2], [], slow(opts.seed) ? { youStatuses: [{ id: 'slowed', turns: 1 }] } : {}, opts, { depth }), [[way(opts.seed).ck, 1]], way(opts.seed).known ? undefined : []),
      actions: (s, i) => {
        if (i === 0) { next = null; return way(s.seed).act(s); }
        if (i === 1) { next = s.actors[0].next; return { a: 'wait' }; }
        return null;
      },
      expect(r, p) {
        const w = way(r.seed), ev = r.steps[0].events, want = slow(r.seed) ? Math.floor(N.COST_USE * p.SPEED_SLOW_PCT / 100) : N.COST_USE;
        const used = ev.find(e => e.k === 'used');
        if (!used || used.cause.ck !== w.ck || used.cause.known !== w.known) return `the ${w.ck} was not used as planned: ${json(ev.map(e => e.k))}`;
        if (!w.known && !used.cause.gentle) return 'a first drink of Fixative was not the harmless one';
        return next === want ? null : `${slow(r.seed) ? 'slowed' : 'not slowed'}, the ${used.how} of ${w.ck} took until tick ${next}, not ${want}`;
      },
    });
    jsweep(sc, depths());
  });

  test('fixed, joined up: a known Fixative thrown at an exhibit of every M3 species, hunting you, fixes it for FIXATIVE_TURNS turns from its next decision; it only waits, and a mark it had pending is called off', () => {
    // As the planted scenario above, but thrown from your tote; what the exhibit was about to
    // do when it landed is noted as the throw is chosen.
    const noted = [];
    const sc = H.scenario({
      name: 'a fixed exhibit only waits, for real', id: 'STATUSES.fixed', seeds: [1, 2, 3], clone: true,
      build: (p, sp, depth, opts) => carry(jroom(WIDE, [3, 3], [{ sp: sp.id, at: [6, 3], mode: 'hunting', stats: Roles.stats(sp.role, depth), next: opts.seed === 2 ? 50 : 0 }], {}, opts,
        { depth, options: { invulnerable: true } }), [['fixative', 1]]),
      actions: (s, i, c) => {
        if (i === 0) noted.length = 0;
        const n = c.params.FIXATIVE_TURNS, a = s.actors[1], thrown = c.events.some(e => e.k === 'used');
        if (thrown) return (c.events.some(e => e.k === 'status' && !e.on && e.who === a.uid) && i > 3) || i > 2 * n + 4 ? null : { a: 'wait' };
        if (i < s.seed - 1 && !a.telegraph) return { a: 'wait' };
        noted.push({ step: i, next: a.next, held: !!a.telegraph });
        return { a: 'throw', uid: toteUid(s, 'fixative'), x: a.x, y: a.y };
      },
      expect(r, p) {
        const n = p.FIXATIVE_TURNS, uid = r.state.actors[1].uid, note = noted[0];
        if (!note) return 'no Fixative was thrown';
        const step = r.steps[note.step], from = Math.floor(note.next / N.TICKS_PER_TURN), end = (from + n) * N.TICKS_PER_TURN;
        if (step.events[0].k !== 'used') return `the throw was refused: ${json(step.events[0])}`;
        const ons = of(r.events, 'status', e => e.who === uid && e.id === 'fixed' && e.on);
        if (ons.length !== 1 || ons[0].turns !== n || ons[0].cause.k !== 'item' || !step.events.includes(ons[0])) return `Fixative put on ${json(ons)}`;
        const off = of(r.events, 'status', e => e.who === uid && e.id === 'fixed' && !e.on)[0];
        if (!off || off.turn !== from + n) return `fixed at its next decision, at ${note.next} in turn ${from}, for ${n} turns, it ended at ${off && off.turn}`;
        const after = r.events.slice(r.events.indexOf(ons[0]) + 1);
        const acted = after.find(e => e.tick < end && ((e.k === 'attacked' && e.by === uid) || (e.k === 'moved' && e.who === uid && !e.cause) ||
          (e.k === 'telegraphed' && e.who === uid) || (e.k === 'special' && e.who === uid && !e.cancelled)));
        if (acted) return `it was fixed and made a ${acted.k} event at tick ${acted.tick}`;
        const cancel = after.find(e => e.k === 'special' && e.who === uid);
        if (note.held && !(cancel && cancel.cancelled && cancel.cause.why === 'fixed' && after.indexOf(cancel) < after.findIndex(e => e.k === 'noise'))) return `its pending mark was not called off as the Fixative landed: ${json(cancel)}`;
        return null;
      },
    });
    const results = jsweep(sc, everySpecies().map(x => ({ sp: x.sp, depth: x.depth })));
    assert.ok(results.length >= 7 * 12 * 3, `${results.length} runs`);
  });

  test('coughing, joined up: a known Fumigant drunk makes you cough COUGH_TURNS soft noises at your tile, one at each boundary of your next COUGH_TURNS turns, and a sleeper in earshot hears them', () => {
    const sc = H.scenario({
      name: 'a cough a turn, for real', id: 'STATUSES.coughing', clone: true,
      build: (p, sp, depth, opts) => carry(jroom(WIDE, [5, 3], [{ sp: 'dummy', at: [8, 3], stats: stats({ hp: 999 }), mode: 'dormant' }], {}, opts, { depth }), [['fumigant', 1]]),
      actions: (s, i, c) => i === 0 ? { a: 'use', uid: toteUid(s, 'fumigant') } : i <= c.params.COUGH_TURNS + 2 ? { a: 'wait' } : null,
      expect(r, p) {
        const n = p.COUGH_TURNS, coughs = of(r.events, 'noise', e => e.cause.k === 'cough');
        if (json(coughs.map(e => e.turn)) !== json(Array.from({ length: n }, (_, k) => 1 + k))) return `coughs in turns ${json(coughs.map(e => e.turn))}`;
        if (!coughs.every(e => e.cls === 'soft' && e.range === p.NOISE_SOFT && e.cause.by === 'you' && e.x === 5 && e.y === 3)) return 'not your soft noise at your tile';
        const heard = of(r.events, 'pip', e => e.who === r.start.actors[1].uid && e.cause.k === 'noise');
        return heard.length ? null : 'the sleeper 3 tiles off heard none of it';
      },
    });
    jsweep(sc, depths());
  });

  test('restoring, joined up: a known Consolidant drunk heals CONSOLIDANT_NOW_PCT% at once and puts on restoring, which heals CONSOLIDANT_HOT_PCT% more over CONSOLIDANT_HOT_TURNS turns, a share each turn', () => {
    const sc = H.scenario({
      name: 'restoring sums to its total, for real', id: 'STATUSES.restoring', seeds: [1, 2], clone: true,
      build: (p, sp, depth, opts) => {
        const s = carry(jroom(OPEN, [3, 2], [], {}, opts, { depth }), [['consolidant', 1]]);
        s.actors[0].maxHp = N.PLAYER_HP + 7 * (depth - 1) + opts.seed; s.actors[0].hp = 1;
        return s;
      },
      actions: (s, i, c) => i === 0 ? { a: 'use', uid: toteUid(s, 'consolidant') } : i <= c.params.CONSOLIDANT_HOT_TURNS + 3 ? { a: 'wait' } : null,
      expect(r, p) {
        const max = r.start.actors[0].maxHp, total = Math.floor(max * p.CONSOLIDANT_HOT_PCT / 100), now = Math.floor(max * N.CONSOLIDANT_NOW_PCT / 100);
        const first = of(r.steps[0].events, 'healed', e => e.cause.k === 'item')[0];
        if (!first || first.amount !== now) return `the drink healed ${first && first.amount} at once, not ${now}`;
        const heals = of(r.events, 'healed', e => e.cause.k === 'status' && e.cause.id === 'restoring'), sum = heals.reduce((n, e) => n + e.amount, 0);
        if (sum !== total) return `${p.CONSOLIDANT_HOT_PCT}% of ${max} is ${total}, but restoring healed ${sum}`;
        const turns = heals.map(e => e.turn);
        return turns.every(t => t >= 1 && t < 1 + p.CONSOLIDANT_HOT_TURNS) && new Set(turns).size === turns.length ? null : `healed in turns ${json(turns)}`;
      },
    });
    jsweep(sc, depths());
  });

  test('the Fumigant cloud, joined up: a known Fumigant thrown leaves a FUMIGANT_SIZE square that blocks sight both ways for FUMIGANT_TURNS turns and takes a pip a turn from each sleeper inside with one', () => {
    let seen = [];
    const sc = H.scenario({
      name: 'a thrown Fumigant cloud, for real', id: 'SURFACES.fumigant', clone: true,
      // Three sleepers: with 1 pip and none inside the cloud, which hear the throw land (its
      // soft noise comes after the cloud, §8.6) and so have 2 and 1; with 2 outside it, out of
      // earshot.
      build: (p, sp, depth, opts) => carry(jroom(WIDE, [2, 3], [{ sp: 'dummy', at: [7, 3], pips: 1, stats: stats() }, { sp: 'dummy', at: [6, 1], pips: 0, stats: stats() },
        { sp: 'dummy', at: [12, 3], pips: 2, stats: stats() }], {}, opts, { depth }), [['fumigant', 1]]),
      actions: (s, i, c) => {
        if (i === 0) { seen = []; return { a: 'throw', uid: toteUid(s, 'fumigant'), x: 7, y: 3 }; }
        seen.push(J.Grid.los(s.dept, 2, 3, 13, 3) || J.Grid.los(s.dept, 13, 3, 2, 3));
        return i <= c.params.FUMIGANT_TURNS + 1 ? { a: 'wait' } : null;
      },
      expect(r, p) {
        const [, a, b, far] = r.state.actors, T = p.FUMIGANT_TURNS;
        const laid = of(r.steps[0].events, 'surface');
        if (laid.length !== 1 || laid[0].kind !== 'fumigant' || laid[0].size !== p.FUMIGANT_SIZE || laid[0].turns !== T) return `the cloud was told as ${json(laid)}`;
        const lost = who => of(r.events, 'pip', e => e.who === who.uid && e.cause.k === 'fumigant').map(e => e.turn);
        const heard = of(r.steps[0].events, 'pip', e => e.cause.k === 'noise').map(e => [e.who, e.pips]);
        if (json(heard) !== json([[a.uid, 2], [b.uid, 1]])) return `the throw's noise gave pips ${json(heard)}`;
        if (json(lost(a)) !== json([1, 2]) || json(lost(b)) !== json([1])) return `pips lost ${json([lost(a), lost(b)])}`;
        if (lost(far).length) return 'a sleeper outside the cloud lost a pip to it';
        if (a.mode !== 'dormant' || b.mode !== 'dormant' || a.pips || b.pips) return `the sleepers inside ended ${json([[a.mode, a.pips], [b.mode, b.pips]])}`;
        if (json(seen) !== json(seen.map((_, k) => k >= T))) return `sight across it at your decisions: ${json(seen)}`;
        return r.state.dept.surfaces.length ? 'the cloud still lies' : null;
      },
    });
    jsweep(sc, depths());
  });

  test('plaster dust, joined up: a plaster cast you destroy leaves dust PLASTER_DUST_SIZE tiles a side that blocks sight both ways for PLASTER_DUST_TURNS turns, and takes no pip', () => {
    let seen = [];
    const sc = H.scenario({
      name: 'the dust of a cast destroyed, for real', id: 'SURFACES.dust', clone: true,
      // A pack cast (plaster) of one health beside you, asleep, so that your surprise blow
      // destroys it at every depth; a sleeper with pips under where the dust will lie.
      build: (p, sp, depth, opts) => jroom(WIDE, [6, 3], [{ sp: 'A4.1a', at: [7, 3], mode: 'dormant', stats: Object.assign(Roles.stats('fodder', depth), { hp: 1 }) },
        { sp: 'dummy', at: [8, 4], pips: 1, stats: stats() }], {}, opts, { depth }),
      actions: (s, i, c) => {
        if (i === 0) { seen = []; return { a: 'attack', uid: s.actors[1].uid }; }
        seen.push(J.Grid.los(s.dept, 4, 3, 13, 3) || J.Grid.los(s.dept, 13, 3, 4, 3));
        return i <= c.params.PLASTER_DUST_TURNS + 1 ? { a: 'wait' } : null;
      },
      expect(r, p) {
        const cast = r.start.actors[1], T = p.PLASTER_DUST_TURNS;
        if (!r.state.actors[1].gone) return 'the blow did not destroy the cast';
        const laid = of(r.steps[0].events, 'surface');
        if (laid.length !== 1 || laid[0].kind !== 'dust' || laid[0].size !== p.PLASTER_DUST_SIZE || laid[0].turns !== T || laid[0].cause.by !== cast.uid) return `the dust was told as ${json(laid)}`;
        if (of(r.events, 'pip', e => e.cause.k === 'fumigant').length) return 'dust took a pip';
        if (seen.length <= T || json(seen) !== json(seen.map((_, k) => k >= T))) return `sight across it at your decisions: ${json(seen)}`;
        return r.state.dept.surfaces.length ? 'the dust still lies' : null;
      },
    });
    jsweep(sc, depths());
  });
};
