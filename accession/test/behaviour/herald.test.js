// ACCESSION — the herald's Behaviour line (BUILD.md §5.3; W1-ARCH-C): "Each time it wakes, the
// first time it sees you it calls for a turn, shown, then wakes every sleeping exhibit within
// {HERALD_RANGE} tiles of it, which come to look where you stood as the call went off; it
// strikes from beside you for {dmg}." Each scenario runs for every pack herald (S9.3, A4.3)
// at depths 1–7, written as a function of the clause's parameters, with every invariant
// checked after every step and a clone after every step. What is expected is worked out here
// from the clause: "within r" is dx² + dy² ≤ r² + r (§8.2).
'use strict';
const H = require('./_harness.js');
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Setup, Step, Specials, Wake, Status, Roles, N, Clauses, Archetypes } = C;
  const json = x => JSON.stringify(x);
  const tough = { hp: 999, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const within = (dx, dy, r) => dx * dx + dy * dy <= r * r + r;
  const range = s => s.split('–').map(Number).concat(s.includes('–') ? [] : [Number(s)]).slice(0, 2);
  const waits = n => Array.from({ length: n }, () => ({ a: 'wait' }));
  const herald = s => s.actors.find(a => a.arch === 'herald');
  const strong = s => { s.actors[0].hp = s.actors[0].maxHp = 999; return s; };
  const list = id => { const l = H.species(C, id); assert.ok(l.length >= 14, `${id}: ${l.length} species and depths`); return l; };
  const ok = (results, name) => { const f = H.failures(results); assert.equal(f.length, 0, `${name}:\n${f.slice(0, 5).join('\n')}`); };

  // An open hall with a pillar; the herald at (11, 6) sees you at (15, 6), four tiles away.
  const HALL = [
    '#######################',
    '#.....................#',
    '#.....................#',
    '#.....................#',
    '#.....................#',
    '#........#............#',
    '#........#............#',
    '#........#............#',
    '#.....................#',
    '#.....................#',
    '#.....................#',
    '#.....................#',
    '#######################',
  ];
  const AT = [11, 6], YOU = [15, 6];
  // Sleepers round the herald, at offsets on both sides of the disc's edge for r = 6 (and
  // judged by the formula whatever r is): one behind the pillar, out of its sight, which a
  // call still reaches; all of them more than 3 walking tiles from you, outside your ring.
  const OFFSETS = [[-6, 0], [-7, 0], [-5, -4], [-6, -3], [0, 4], [5, -5], [4, 4], [-3, 0]];

  let afterCall = null;
  // The call: shown for a turn, then every sleeper within HERALD_RANGE wakes awake, sent to
  // your tile; not one outside it, not a mimic in its disguise, not an exhibit already awake.
  const calls = H.scenario({
    name: 'on seeing you it calls for a turn, shown, then wakes the sleepers within its range, sent to look where you stood',
    id: 'call', clone: true,
    build: (params, sp, depth, opts) => strong(Setup.room(opts.seed, { acc: 'T0', depth, map: HALL, you: YOU,
      exhibits: [{ sp: sp.id, at: AT, mode: 'awake', stats: Roles.stats(sp.role, depth) }]
        .concat(OFFSETS.map(([dx, dy]) => ({ sp: 'dummy', at: [AT[0] + dx, AT[1] + dy], mode: 'dormant', stats: tough })))
        .concat([{ sp: 'S9.5', at: [9, 9], stats: Roles.stats('ambusher', depth) }, { sp: 'dummy', at: [13, 3], mode: 'awake', stats: tough }]) },
      { rulesOff: opts.rulesOff })),
    // The woken exhibits' targets are read once the call has gone off, before they act.
    actions: (s, i) => { if (i === 0) afterCall = null; if (i === 2) afterCall = s.actors.map(a => [a.uid, a.target]); return i < 6 ? { a: 'wait' } : null; },
    expect(r, params) {
      const s = r.start, h = herald(s), R = params.HERALD_RANGE, steps = r.steps;
      const marks = steps.map(st => st.events.filter(e => e.k === 'telegraphed' && e.who === h.uid));
      if (json(marks.map(m => m.length)) !== json([1, 0, 0, 0, 0, 0])) return `its marks per step: ${json(marks.map(m => m.length))}; one call, at its first action, was expected`;
      const tel = marks[0][0];
      if (tel.sp !== 'call') return `it marked ${tel.sp}, not its call`;
      // The tiles shown: every tile an exhibit could stand on within R of it.
      const want = [];
      for (let y = 0; y < HALL.length; y++) for (let x = 0; x < HALL[0].length; x++) if (HALL[y][x] === '.' && within(x - AT[0], y - AT[1], R)) want.push([x, y]);
      if (json(tel.tiles) !== json(want)) return `it showed ${tel.tiles.length} tiles; ${want.length} within ${R} were expected`;
      if (steps[0].events.some(e => e.k === 'woke')) return 'something woke in the step it marked its call, before you saw it';
      // Woken in the next step, after your decision: exactly the sleepers within R.
      const woke = steps[1].events.filter(e => e.k === 'woke' && e.cause.k === 'herald');
      const expected = s.actors.filter(b => b.mode === 'dormant' && b.sp === 'dummy' && within(b.x - AT[0], b.y - AT[1], R)).map(b => b.uid);
      if (json(woke.map(e => e.who)) !== json(expected)) return `the call woke ${json(woke.map(e => e.who))}; ${json(expected)} were expected`;
      for (const e of woke) {
        if (e.mode !== 'awake' || e.cause.by !== h.uid || e.cause.x !== YOU[0] || e.cause.y !== YOU[1]) return `${e.who} woke ${e.mode}, by ${e.cause.by}, to look at ${e.cause.x},${e.cause.y}`;
        const t = afterCall.find(([uid]) => uid === e.who)[1];
        if (json(t) !== json(YOU)) return `${e.who} goes to look at ${json(t)}, not at your tile ${json(YOU)}`;
      }
      if (steps.slice(2).some(st => st.events.some(e => e.k === 'woke' && e.cause.k === 'herald'))) return 'the call woke something again later';
      // The mimic still sleeps in its case; the exhibit that was already awake was not woken.
      const mimic = r.state.actors.find(b => b.arch === 'mimic_vitrine');
      if (mimic.mode !== 'dormant' || !Archetypes.present(r.state, mimic)) return 'the mimic in its disguise woke';
      if (steps[1].events.some(e => e.k === 'woke' && e.who === r.state.actors[r.state.actors.length - 1].uid)) return 'the call woke an exhibit already awake';
      return null;
    },
  });

  test('the herald calls for a turn, shown, then wakes every sleeper within its range, awake and sent to your tile; never a mimic in its disguise', () => {
    ok(H.sweep(C, calls, list('call')), calls.name);
  });

  test('its call is shown on the floor before it goes off, as call marks with no damage, and the herald calls once per waking', () => {
    for (const { sp, depth } of list('herald')) {
      const s = calls.build({ HERALD_RANGE: N.HERALD_RANGE }, sp, depth, { seed: depth, rulesOff: [] }), h = herald(s);
      Step.step(s, { a: 'wait' });
      const m = Specials.marks(s).filter(k => k.by === h.uid);
      assert.ok(m.length > 30 && m.every(k => k.kind === 'call' && k.dmg === null), `${sp.id} d${depth}: the call's marks`);
      assert.equal(h.ax.called, 1);
      // It goes off, and the herald does not call again while it stays awake.
      const r = H.play(C, s, waits(10), { clone: true });
      assert.equal(json(r.violations), '[]');
      assert.equal(r.events.filter(e => e.k === 'telegraphed' && e.who === h.uid).length, 0, 'no second call in one waking');
      assert.equal(r.events.filter(e => e.k === 'special' && e.who === h.uid && !e.cancelled).length, 1, 'the call went off once');
      // Put to sleep and woken again, it calls again on seeing you.
      if (h.mode !== 'dormant') Wake.setMode(s, h, 'dormant', { k: 'searched' }, []);
      assert.equal(Wake.wake(s, h, 'hunting', { k: 'damage', by: 'you' }, []), true);
      assert.equal(h.ax.called, 0, 'waking clears its call');
      const again = H.play(C, s, waits(4));
      assert.equal(json(again.violations), '[]');
      assert.equal(again.events.filter(e => e.k === 'telegraphed' && e.who === h.uid && e.sp === 'call').length, 1, `${sp.id} d${depth}: it calls again after waking again`);
    }
  });

  test('a call called off (the herald fixed) wakes nothing, and is still its one call for this waking', () => {
    for (const { sp, depth } of list('herald')) {
      const s = calls.build({}, sp, depth, { seed: 1, rulesOff: [] }), h = herald(s);
      Step.step(s, { a: 'wait' });
      assert.ok(h.telegraph && h.telegraph.sp === 'call');
      const ev = [];
      Status.apply(s, h, 'fixed', 2, { k: 'status', id: 'fixed' }, ev);
      Status.settle(s);
      assert.equal(h.telegraph, null);
      assert.ok(ev.some(e => e.k === 'special' && e.cancelled && e.cause.why === 'fixed'));
      const r = H.play(C, s, waits(8));
      assert.equal(json(r.violations), '[]');
      assert.ok(!r.events.some(e => e.k === 'woke' && e.cause.k === 'herald'), `${sp.id} d${depth}: a called-off call woke something`);
      assert.ok(!r.events.some(e => e.k === 'telegraphed' && e.who === h.uid), 'it did not call again in the same waking');
    }
  });

  // Woken (here by a blow from you), it calls at its first sight of you.
  const woken = H.scenario({
    name: 'each time it wakes, it calls the first time it sees you',
    id: 'herald', clone: true,
    build: (params, sp, depth, opts) => strong(Setup.room(opts.seed, { acc: 'T0', depth, map: HALL, you: [12, 6],
      exhibits: [{ sp: sp.id, at: AT, mode: 'dormant', stats: Object.assign(Roles.stats(sp.role, depth), { hp: 999, maxHp: 999 }) },
        { sp: 'dummy', at: [5, 6], mode: 'dormant', stats: tough }] }, { rulesOff: opts.rulesOff })),
    actions: (s, i) => i === 0 ? { a: 'attack', uid: herald(s).uid } : i < 5 ? { a: 'wait' } : null,
    expect(r) {
      const h = herald(r.state), sleeper = r.state.actors[2].uid, first = r.steps.findIndex(st => st.events.some(e => e.k === 'telegraphed' && e.who === h.uid));
      if (!r.steps[0].events.some(e => e.k === 'woke' && e.who === h.uid && e.cause.k === 'damage')) return 'your blow did not wake it';
      if (first !== 1) return `it first called at step ${first}, not at its first action after the blow woke it`;
      if (!r.events.some(e => e.k === 'woke' && e.cause.k === 'herald' && e.who === sleeper)) return 'its call did not wake the sleeper within its range';
      return null;
    },
  });

  test('woken by your blow, it calls at its first action, which sees you', () => {
    ok(H.sweep(C, woken, list('herald')), woken.name);
  });

  // It strikes from beside you for {dmg}, once it has called.
  const strikes = H.scenario({
    name: 'it strikes from beside you for its damage range',
    id: 'herald', clone: true,
    build: (params, sp, depth, opts) => strong(Setup.room(opts.seed, { acc: 'T0', depth, map: HALL, you: YOU,
      exhibits: [{ sp: sp.id, at: [YOU[0] - 1, YOU[1]], mode: 'hunting', ax: { called: 1 }, stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff })),
    actions: waits(20),
    expect(r, params) {
      const [lo, hi] = range(params.dmg), h = herald(r.state);
      const blows = r.events.filter(e => e.k === 'damaged' && e.who === 'you' && e.cause.by === h.uid);
      if (blows.length < 5) return `only ${blows.length} blows landed in 20 turns`;
      const bad = blows.find(e => e.cause.k !== 'attack' || e.cause.raw < lo || e.cause.raw > hi);
      if (bad) return `a blow rolled ${bad.cause.raw} (${bad.cause.k}), outside ${params.dmg}`;
      if (r.events.some(e => e.k === 'telegraphed')) return 'it called again';
      return null;
    },
  });

  test('it strikes from beside you for {dmg}', () => {
    ok(H.sweep(C, strikes, list('herald')), strikes.name);
  });

  // A herald that has seen you calls even while a damage mark lies within its range (§8.1:
  // a call neither blocks nor is blocked).
  const overMark = H.scenario({
    name: 'it calls even over a pending damage mark, which still goes off for its number',
    id: 'call', clone: true,
    build: (params, sp, depth, opts) => {
      const s = strong(Setup.room(opts.seed, { acc: 'T0', depth, map: HALL, you: YOU,
        exhibits: [{ sp: 'S9.4', at: [YOU[0] + 1, YOU[1]], mode: 'hunting', stats: Roles.stats('warden', depth) },
          { sp: sp.id, at: AT, mode: 'awake', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff }));
      s.actors[1].acts = N.ROLE_WARDEN_SPECIAL_EVERY - 1;     // its ring is due at its next action
      return s;
    },
    actions: waits(2),
    expect(r) {
      const [w, h] = r.start.actors.slice(1), e0 = r.steps[0].events;
      const ring = e0.find(e => e.k === 'telegraphed' && e.who === w.uid), call = e0.find(e => e.k === 'telegraphed' && e.who === h.uid);
      if (!ring || ring.sp !== 'ring') return 'the warden did not mark its ring first';
      if (!call || call.sp !== 'call') return 'the herald did not call over the ring';
      if (!ring.tiles.some(t => call.tiles.some(u => u[0] === t[0] && u[1] === t[1]))) return 'the call and the ring do not share a tile, so this shows nothing';
      const hit = r.steps[1].events.find(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special');
      const net = Specials.net(Specials.info(r.start, 'ring').gross, r.start.actors[0].pad);
      if (!hit || hit.amount !== net) return `the ring dealt ${hit && hit.amount}, not its mark ${net}`;
      return null;
    },
  });

  test('a herald that has seen you calls even while a damage mark lies within its range', () => {
    ok(H.sweep(C, overMark, list('call')), overMark.name);
  });

  // Out of its sight, it never calls.
  const CLOSED = ['#######################', '#.....#...............#', '#.....#...............#', '#.....#...............#', '#######...............#', '#######################'];
  const unseen = H.scenario({
    name: 'awake but never seeing you, it never calls',
    id: 'herald', clone: true,
    build: (params, sp, depth, opts) => strong(Setup.room(opts.seed, { acc: 'T0', depth, map: CLOSED, you: [12, 2],
      exhibits: [{ sp: sp.id, at: [3, 2], mode: 'awake', stats: Roles.stats(sp.role, depth) }, { sp: 'dummy', at: [5, 1], mode: 'dormant', stats: tough }] }, { rulesOff: opts.rulesOff })),
    actions: waits(12),
    expect: r => r.events.some(e => e.k === 'telegraphed' || (e.k === 'woke' && e.cause.k === 'herald')) ? 'it called without seeing you' : null,
  });

  test('a herald that never sees you never calls', () => {
    ok(H.sweep(C, unseen, list('herald')), unseen.name);
  });

  test('made with the department, a herald has not called; its line names its range and its damage at each depth', () => {
    for (const acc of ['S9', 'A4']) for (let depth = 1; depth <= 7; depth++) {
      const s = C.Dept.create(depth, acc, depth), h = herald(s);
      assert.ok(h, `${acc} d${depth} places a herald`);
      assert.equal(h.ax.called, 0);
      const line = Clauses.line(C.Packs.speciesFor(s, h), { depth });
      const st = Roles.stats(h.role, depth), dmg = st.dmin === st.dmax ? `${st.dmin}` : `${st.dmin}–${st.dmax}`;
      assert.ok(line.includes(`within ${N.HERALD_RANGE} tiles`) && line.includes(`for ${dmg}.`) && !/undefined|NaN|\[object/.test(line), line);
    }
  });

  test('its invariants catch a planted call that wakes beyond its tiles, or a pipless sleeper, or a second call', () => {
    const [{ sp, depth }] = list('call');
    const X = loadCore();
    X.Archetypes.onResolve = (state, a, tel, ev) => {
      for (const b of state.actors.slice(1)) if (b !== a && b.mode === 'dormant') { b.mode = 'awake'; b.next = state.tick + N.COST_STEP; b.woke = { turn: state.turn, cause: { k: 'herald', by: a.uid } }; X.Causes.emit(state, ev, 'woke', { who: b.uid, was: 'dormant', mode: 'awake' }, { k: 'herald', by: a.uid }); }
    };
    const s = calls.build({}, sp, depth, { seed: 1, rulesOff: [] });
    const v = H.play(X, s, waits(3), { inv: ['arch-c'] }).violations.map(x => x.inv);
    assert.ok(v.includes('herald_call') && v.includes('call_never_wakes_pipless'), json(v));
    // A planted herald that calls whenever it sees you, keeping no record of its call.
    const Y = loadCore();
    Y.Archetypes.act = (state, a, ev) => {
      if (a.arch !== 'herald' || a.mode !== 'hunting' || !Y.AI.sees(state, a)) return null;
      const tiles = Y.Specials.tiles(state, a, 'call');
      return Y.Specials.canMark(state, a, 'call', tiles) ? Y.Specials.mark(state, a, 'call', tiles, ev) : null;
    };
    const w = H.play(Y, calls.build({}, sp, depth, { seed: 1, rulesOff: [] }), waits(4), { inv: ['arch-c'] }).violations.map(x => x.inv);
    assert.ok(w.includes('herald_call'), json(w));
  });
};
