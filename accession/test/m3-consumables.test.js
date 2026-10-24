// M3's consumables (BUILD.md §8.6, §3.2, §8.3): the seals and the deck; drinking, reading
// and throwing every kind; a first use that never harms you; identification by use, by a
// label and by the Catalogue Card; the Floor Plan, "Quiet, Please" and the Re-admission
// Ticket; the actions' parity with step(); the stand-in placement of a department's
// consumables and labels; local names; the sentences. The expected figures are worked out
// here from BUILD.md's text, never from the rule code.
//
// Consumables call other Wave 1 packages' hooks (Health.heal, Wake.quiet, Wake.lose,
// Cases.dissolve, Kit.addToTote). As Wave 1's rule allows, these tests drive them as their
// contracts in the plan say, in a core of their own (contracts below); the joined-up runs
// are W2a-BEHAVIOUR's.
function contracts(X) {
  const calls = [];
  const copy = v => JSON.parse(JSON.stringify(v));
  // W1-COMBAT: healing up to your maximum, with a healed event.
  X.Health.heal = (state, who, n, cause, ev) => {
    calls.push({ fn: 'heal', who: who.uid, n, cause: copy(cause) });
    const got = Math.max(0, Math.min(n, who.maxHp - who.hp));
    if (got > 0) { who.hp += got; X.Causes.emit(state, ev, 'healed', { who: who.uid, amount: got, hp: who.hp }, cause); }
    return got;
  };
  // W1-WAKE-A: "Quiet, Please" (§8.6, D5.19), as WAKE-A builds it: within range walking
  // tiles, sleepers lose every pip, the awake but not hunting (awake, searching, returning,
  // reinstalling) settle where they stand, hunters drop to awake; the Night Watchman, a
  // species that never sleeps and a mimic in its disguise are left alone.
  X.Wake.quiet = (state, x, y, range, cause, ev) => {
    calls.push({ fn: 'quiet', x, y, range, cause: copy(cause) });
    const m = state.dept, d = X.Grid.distances(m, [[x, y]], range);
    for (const a of state.actors.slice(1)) {
      if (a.gone || a.trigger === 'awake' || a.arch === 'night_watchman' || X.Archetypes.pipless(state, a)) continue;
      if (!X.Actors.footprint(a).some(([fx, fy]) => { const v = X.Grid.reachDist(d, m, fx, fy); return v >= 0 && v <= range; })) continue;
      if (a.mode === 'dormant') { if (a.pips) X.Wake.addPips(state, a, -a.pips, cause, ev); }
      else if (a.mode === 'hunting') X.Wake.setMode(state, a, 'awake', cause, ev);
      else X.Wake.setMode(state, a, 'dormant', cause, ev);
    }
  };
  // W1-WAKE-A: the Ticket (D5.8), as WAKE-A builds it: every hunter but the Night Watchman
  // goes searching where it last knew you, which calls off its pending special
  // (Wake.setMode).
  X.Wake.lose = (state, cause, ev) => {
    calls.push({ fn: 'lose', cause: copy(cause) });
    for (const a of state.actors.slice(1)) if (!a.gone && a.mode === 'hunting' && a.arch !== 'night_watchman') X.Wake.setMode(state, a, 'searching', cause, ev);
  };
  // W1-CASES: Solvent's dissolve (§8.3): the case opens silently, a sleeper inside is
  // released hunting with no home, and glass_broke, with the cause given, comes last.
  X.Cases.dissolve = (state, f, cause, ev) => {
    calls.push({ fn: 'dissolve', x: f.x, y: f.y, cause: copy(cause) });
    f.st = 'dissolved'; X.Grid.set(state.dept, f.x, f.y, 'u');
    const a = X.Actors.at(state, f.x, f.y);
    let released = null;
    if (a && a.mode === 'dormant') { a.home = null; X.Wake.wake(state, a, 'hunting', { k: 'dissolved', by: cause.by }, ev); released = a.uid; }
    X.Causes.emit(state, ev, 'glass_broke', { by: cause.by, x: f.x, y: f.y, glass: f.glass, shards: [], released }, cause);
  };
  // W1-KIT: an item into the tote; a consumable joins the stack of its seal.
  X.Kit.addToTote = (state, it) => {
    calls.push({ fn: 'addToTote', item: it.uid });
    const stack = state.you.tote.map(u => state.items.find(i => i.uid === u)).find(i => i && i !== it && i.kind === 'consumable' && i.seal === it.seal);
    if (stack) { stack.n += it.n; it.n = 0; it.where = { at: 'gone' }; return null; }
    if (state.you.tote.length >= X.N.TOTE_SLOTS) return 'tote_full';
    it.where = { at: 'tote' }; state.you.tote.push(it.uid);
    return null;
  };
  return calls;
}

module.exports = ({ test, assert, loadCore }) => {
  const json = x => JSON.stringify(x);
  const key = a => JSON.stringify(a);
  const KINDS = ['consolidant', 'fixative', 'fumigant', 'solvent', 'card', 'plan', 'quiet', 'ticket'];
  const DECK = [20, 8, 10, 8, 14, 8, 8, 5];
  const SOLUTIONS = KINDS.slice(0, 4), EPHEMERA = KINDS.slice(4);
  const OPEN = ['###########', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'];
  const tough = { hp: 40, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 };
  const ex = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'dormant', stats: tough }, extra);
  const core = () => { const X = loadCore(); const calls = contracts(X); return { X, calls }; };
  // A room for tests with the run's seals shuffled, your health high, and consumables in your
  // tote: tote [[kind, n]…]; known [kind…] identified beforehand.
  function room(X, o) {
    o = o || {};
    const spec = { acc: 'T0', depth: o.depth || 1, map: o.map || OPEN, you: o.you || [2, 4], exhibits: o.exhibits || [] };
    for (const k of ['fixtures', 'entrance', 'exits', 'youStatuses']) if (o[k]) spec[k] = o[k];
    const s = X.Setup.room(o.seed || 1, spec);
    if (!o.keepHp) { s.actors[0].hp = 30; s.actors[0].maxHp = 40; }
    X.Consumables.startRun(s);
    for (const [ck, n] of o.tote || []) give(X, s, ck, n);
    for (const ck of o.known || []) s.run.knownSeals.push(X.Consumables.sealFor(s, ck));
    return s;
  }
  function give(X, s, ck, n) {
    const you = s.actors[0], it = X.Consumables.make(s, ck, { at: 'floor', x: you.x, y: you.y });
    it.where = { at: 'tote' }; it.n = n || 1; s.you.tote.push(it.uid);
    return it;
  }
  const uidOf = (s, ck) => s.items.find(i => i.kind === 'consumable' && i.ck === ck && i.where.at === 'tote').uid;
  const checked = (X, ev) => { for (const e of ev) { const bad = X.Causes.check(e); assert.equal(bad, null, `${bad}: ${json(e)}`); } return ev; };
  const clean = s => typeof s === 'string' && s.length > 0 && !/undefined|NaN|\[object|null/.test(s);
  const said = (X, ev) => { const out = ev.map(e => X.Text.event(e, null)); for (const s of out) assert.ok(clean(s), `sentence ${json(s)}`); return out; };
  const own = (X, ev, k) => ev.filter(e => e.k === k);

  // Every candidate of every handler against Step.legal, and a refused one leaves the state
  // and every stream as they were (§4.2): the backbone's parity, over consumables states.
  function parity(X, s, where) {
    const legal = X.Step.legal(s), keys = new Set(legal.map(key)), cands = new Set(), base = X.State.canon(s);
    let n = 0;
    for (const id of X.Actions.ORDER) {
      const h = X.Actions.get(id);
      if (!h) continue;
      for (const c of h.candidates(s)) {
        cands.add(key(c));
        const t = JSON.parse(base), ev = X.Step.step(t, c), refused = ev.length === 1 && ev[0].k === 'refused';
        assert.equal(!refused, keys.has(key(c)), `${where}: ${key(c)} ${refused ? 'refused (' + ev[0].reason + ')' : 'accepted'}`);
        if (refused) assert.ok(X.State.canon(t) === base, `${where}: ${key(c)} refused (${ev[0].reason}) but changed the state or a stream`);
        else checked(X, ev);
        n++;
      }
    }
    for (const k of keys) assert.ok(cands.has(k), `${where}: legal ${k} is no handler's candidate`);
    return n;
  }

  test('the seals: each run shuffles the 4 wax seals over the Solutions and the 4 ink stamps over the Ephemera, a bijection in each family, once', () => {
    const { X } = core();
    const seen = { sol: new Set(), eph: new Set() };
    for (let seed = 1; seed <= 200; seed++) {
      const s = X.Setup.room(seed, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [] });
      assert.equal(s.run.seals, null, 'a room for tests starts with no seals');
      X.Consumables.startRun(s);
      // §3.2: the shuffle of [0..3] and then of [4..7] on the run's `seals` stream, written out.
      const r = X.Rng.stream({ seed, rng: {} }, 'seals'), shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = r.u32() % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const sol = shuffle([0, 1, 2, 3]), eph = shuffle([4, 5, 6, 7]);
      assert.equal(json(s.run.seals), json({ sol, eph }), `seed ${seed}`);
      assert.equal(json(s.run.seals.sol.slice().sort()), json([0, 1, 2, 3])); assert.equal(json(s.run.seals.eph.slice().sort()), json([4, 5, 6, 7]));
      // Each seal holds one kind of its family, and sealFor and kindOf are inverses.
      const wax = ['wax1', 'wax2', 'wax3', 'wax4'], ink = ['ink1', 'ink2', 'ink3', 'ink4'];
      assert.equal(json(wax.map(w => X.Consumables.kindOf(s, w))), json(sol.map(i => KINDS[i])));
      assert.equal(json(ink.map(w => X.Consumables.kindOf(s, w))), json(eph.map(i => KINDS[i])));
      for (const ck of KINDS) assert.equal(X.Consumables.kindOf(s, X.Consumables.sealFor(s, ck)), ck);
      seen.sol.add(json(sol)); seen.eph.add(json(eph));
      // Once a run: a second start changes nothing.
      const h = X.State.hash(s); X.Consumables.startRun(s); assert.equal(X.State.hash(s), h);
    }
    assert.ok(seen.sol.size >= 20 && seen.eph.size >= 20, `${seen.sol.size} and ${seen.eph.size} of the 24 orders seen in 200 runs`);
    // A department's seals come from its run's seed, before its consumables are placed.
    const d = X.Dept.create(5, 'M11', 3);
    assert.equal(json(d.run.seals), json((() => { const s = X.Setup.room(5, { acc: 'T0', depth: 1, map: OPEN, you: [2, 2], exhibits: [] }); X.Consumables.startRun(s); return s.run.seals; })()));
    assert.equal(json(d.run.knownSeals), json([]));
  });

  test('the deck: 81 draws, without replacement on the run\'s deck stream, give exactly DECK\'s cards; then it is refilled', () => {
    const { X } = core();
    for (const seed of [1, 2, 3, 17]) {
      const s = room(X, { seed });
      assert.equal(json(s.run.deck), json(DECK));
      const got = KINDS.map(() => 0), mine = DECK.slice(), r = X.Rng.stream({ seed, rng: {} }, 'deck');
      for (let k = 0; k < 81; k++) {
        const ck = X.Consumables.draw(s);
        // Written out: a card chosen with weights the cards left, by u32 modulo their total.
        let t = mine.reduce((a, b) => a + b, 0), v = r.u32() % t, i = 0;
        while (v >= mine[i]) { v -= mine[i]; i++; }
        mine[i]--;
        assert.equal(ck, KINDS[i], `seed ${seed}, draw ${k + 1}`);
        got[KINDS.indexOf(ck)]++;
      }
      assert.equal(json(got), json(DECK), 'every card of the deck, once');
      assert.equal(json(s.run.deck), json([0, 0, 0, 0, 0, 0, 0, 0]));
      X.Consumables.draw(s);
      assert.equal(s.run.deck.reduce((a, b) => a + b, 0), 80, 'refilled when empty, then one drawn');
    }
  });

  test('drinking each Solution, known: Consolidant heals now and over time, Fixative fixes you, Fumigant makes you cough, Solvent ends your harmful statuses', () => {
    const { X, calls } = core(), N = X.N;
    // Consolidant: 50% of your maximum now (to 40 at most), and restoring for 5 turns from
    // your next decision.
    let s = room(X, { tote: [['consolidant', 2]], known: ['consolidant'] });
    let uid = uidOf(s, 'consolidant'), ev = checked(X, X.Step.step(s, { a: 'use', uid }));
    assert.equal(json(own(X, ev, 'used').map(e => [e.how, e.cause.known, e.cause.ck])), json([['drink', true, 'consolidant']]));
    assert.equal(json(own(X, ev, 'healed').map(e => [e.who, e.amount, e.hp, e.cause.k])), json([['you', 10, 40, 'item']]), 'min(20, 40 − 30)');
    assert.equal(json(calls.filter(c => c.fn === 'heal').map(c => [c.who, c.n])), json([['you', 20]]), 'half of 40');
    const rest = s.actors[0].statuses.find(t => t.id === 'restoring');
    assert.ok(rest && rest.until === X.Int.idiv(s.actors[0].next, N.TICKS_PER_TURN) + N.CONSOLIDANT_HOT_TURNS, json(s.actors[0].statuses));
    assert.equal(s.items.find(i => i.uid === uid).n, 1, 'one of the two drunk');
    assert.equal(s.actors[0].next, 100, 'drinking costs COST_USE');
    assert.ok(own(X, ev, 'identified').length === 0, 'already known');
    said(X, ev);
    // Fixative: exactly 4 forced waits.
    s = room(X, { tote: [['fixative', 1]], known: ['fixative'] });
    uid = uidOf(s, 'fixative');
    checked(X, X.Step.step(s, { a: 'use', uid }));
    assert.equal(s.items.find(i => i.uid === uid).where.at, 'gone'); assert.ok(!s.you.tote.includes(uid), 'the last one leaves the tote');
    let forced = 0;
    for (let k = 0; k < 8; k++) { const legal = X.Step.legal(s); if (!legal.some(a => a.a === 'move')) forced++; X.Step.step(s, { a: 'wait' }); }
    assert.equal(forced, N.FIXATIVE_TURNS);
    // Fumigant: coughing for 5 turns.
    s = room(X, { tote: [['fumigant', 1]], known: ['fumigant'] });
    ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'fumigant') }));
    assert.equal(json(own(X, ev, 'status').map(e => [e.who, e.id, e.on, e.cause.k])), json([['you', 'coughing', true, 'item']]));
    const c = s.actors[0].statuses.find(t => t.id === 'coughing');
    assert.equal(c.until - c.from, N.COUGH_TURNS);
    // Solvent: rooted and coughing end, restoring (not harmful) stays.
    s = room(X, { tote: [['solvent', 1]], known: ['solvent'], youStatuses: [{ id: 'rooted', turns: 3 }, { id: 'restoring', turns: 5 }, { id: 'coughing', turns: 4 }] });
    ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'solvent') }));
    assert.equal(json(own(X, ev, 'status').filter(e => e.cause.k === 'item').map(e => [e.id, e.on])), json([['rooted', false], ['coughing', false]]));
    assert.equal(json(s.actors[0].statuses.map(t => t.id)), json(['restoring']));
    said(X, ev);
  });

  test('a first drink never harms you: a harmful kind is identified and does nothing, and says what it would have done; a kind that does not harm does what it does', () => {
    const { X } = core(), N = X.N;
    for (const ck of ['fixative', 'fumigant']) {
      const s = room(X, { tote: [[ck, 2]] }), uid = uidOf(s, ck), seal = X.Consumables.sealFor(s, ck);
      const ev = checked(X, X.Step.step(s, { a: 'use', uid }));
      assert.equal(json(ev.slice(0, 2).map(e => [e.k, e.cause.k])), json([['used', 'consume'], ['identified', 'use']]));
      assert.equal(json([ev[0].cause.known, ev[0].cause.gentle, ev[1].seal, ev[1].ck]), json([false, true, seal, ck]));
      assert.equal(own(X, ev, 'status').length, 0, 'nothing happened');
      assert.ok(s.run.knownSeals.includes(seal) && X.Consumables.known(s, ck));
      const line = X.Text.event(ev[0], null);
      assert.match(line, ck === 'fixative' ? new RegExp(`would have fixed you for ${N.FIXATIVE_TURNS} turns`) : new RegExp(`would have made you cough for ${N.COUGH_TURNS} turns`));
      assert.ok(X.Step.legal(s).some(a => a.a === 'move'), 'you can still move');
      // The second, known, does what its kind does.
      const ev2 = checked(X, X.Step.step(s, { a: 'use', uid }));
      assert.equal(json(own(X, ev2, 'status').map(e => [e.id, e.on])), json([[ck === 'fixative' ? 'fixed' : 'coughing', true]]));
      assert.equal(ev2[0].cause.known, true); assert.equal(ev2[0].cause.gentle, undefined);
      said(X, ev.concat(ev2));
    }
    // Consolidant and Solvent harm no one: a first drink works, and identifies.
    const s = room(X, { tote: [['consolidant', 1], ['solvent', 1]], youStatuses: [{ id: 'dazed', turns: 3 }] });
    let ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'consolidant') }));
    assert.equal(json(ev.map(e => e.k).slice(0, 3)), json(['used', 'identified', 'healed']));
    ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'solvent') }));
    assert.ok(own(X, ev, 'status').some(e => e.id === 'dazed' && !e.on) && !s.actors[0].statuses.some(t => t.id === 'dazed'));
  });

  test('throwing each Solution, known: Consolidant heals and Fixative fixes every creature in the 3×3, glass shields, the gone are not there; Fumigant leaves a 5×5 cloud; each lands with a soft noise, last', () => {
    const { X, calls } = core(), N = X.N;
    const map = ['###########', '#.........#', '#.........#', '#.....v...#', '#.........#', '#.........#', '###########'];
    // The fifth exhibit, at 5,4 inside the square, has been removed for the visit (gone).
    const mk = (ck, you) => { const s = room(X, { map, you, tote: [[ck, 1]], known: [ck], exhibits: [[5, 2], [6, 3], [8, 3], [4, 4], [5, 4]].map(at => ex(at, { hp: 10, maxHp: 40 })) }); s.actors[5].gone = 1; return s; };
    // Consolidant at (5,3): the square x 4–6, y 2–4 holds 5,2, 6,3 (in a case), 4,4 and the
    // gone 5,4; 8,3 is outside.
    let s = mk('consolidant', [1, 3]), ev = checked(X, X.Step.step(s, { a: 'throw', uid: uidOf(s, 'consolidant'), x: 5, y: 3 }));
    const pct = Math.floor(40 * N.CONSOLIDANT_THROW_PCT / 100);
    assert.equal(json(own(X, ev, 'healed').map(e => [e.who, e.amount])), json([['T0.1.room.1', pct], ['T0.1.room.4', pct]]), 'the encased exhibit is behind glass, and the gone one is not there');
    assert.equal(s.actors[5].hp, 10, 'the gone exhibit is untouched');
    const noise = ev.findIndex(e => e.k === 'noise');
    assert.ok(noise > ev.findIndex(e => e.k === 'healed') && ev[noise].cause.k === 'throw' && ev[noise].cls === 'soft' && ev[noise].x === 5 && ev[noise].y === 3, json(ev[noise]));
    assert.equal(s.actors[0].next, 100);
    said(X, ev);
    // Fixative: the same three; you are inside the square too, and it is known, so you are fixed.
    s = mk('fixative', [4, 2]); ev = checked(X, X.Step.step(s, { a: 'throw', uid: uidOf(s, 'fixative'), x: 5, y: 3 }));
    assert.equal(json(own(X, ev, 'status').filter(e => e.on).map(e => [e.who, e.id])), json([['you', 'fixed'], ['T0.1.room.1', 'fixed'], ['T0.1.room.4', 'fixed']]));
    assert.ok(ev.findIndex(e => e.k === 'noise') > ev.findIndex(e => e.k === 'status'));
    assert.ok(!s.actors[5].statuses.some(t => t.id === 'fixed'), 'the gone exhibit is not fixed');
    // Fumigant: a cloud of side 5 for 10 turns, centred where it lands.
    s = mk('fumigant', [1, 3]); ev = checked(X, X.Step.step(s, { a: 'throw', uid: uidOf(s, 'fumigant'), x: 5, y: 3 }));
    assert.equal(json(s.dept.surfaces.map(f => [f.kind, f.x, f.y, f.size, f.by])), json([['fumigant', 5, 3, N.FUMIGANT_SIZE, 'you']]));
    assert.equal(own(X, ev, 'noise').length, 1);
    // A heal of a thrown Consolidant is CONSOLIDANT_THROW_PCT of each creature's own maximum.
    assert.ok(calls.filter(c => c.fn === 'heal').every(c => c.n === pct));
  });

  test('a thrown Solvent dissolves every intact case in its 3×3, silently: no noise, no touch_case; Cases.dissolve gets the Solvent\'s cause', () => {
    const { X, calls } = core();
    const map = ['###########', '#.........#', '#....v....#', '#...v.u...#', '#.........#', '#.......v.#', '###########'];
    const fixtures = [[5, 2], [4, 3], [6, 3], [8, 5]].map(([x, y]) => X.Cases.make({ x, y, glass: 2, lock: 3 }));
    fixtures[2].st = 'open';
    const s = room(X, { map, you: [1, 1], fixtures, tote: [['solvent', 1]], known: ['solvent'], exhibits: [ex([4, 3], { home: [4, 3], pips: 2 })] });
    const uid = uidOf(s, 'solvent'), ev = checked(X, X.Step.step(s, { a: 'throw', uid, x: 5, y: 3 }));
    assert.equal(json(calls.filter(c => c.fn === 'dissolve').map(c => [c.x, c.y, c.cause])), json([[5, 2, { k: 'solvent', by: 'you', item: uid }], [4, 3, { k: 'solvent', by: 'you', item: uid }]]),
      'the two intact cases in the square; not the open one, not the one outside');
    assert.equal(own(X, ev, 'noise').length, 0, 'silent');
    assert.ok(!ev.some(e => e.cause && e.cause.k === 'touch_case'), 'no touch_case');
    assert.equal(json(own(X, ev, 'glass_broke').map(e => [e.x, e.y, e.cause.k])), json([[5, 2, 'solvent'], [4, 3, 'solvent']]));
    assert.equal(json(own(X, ev, 'woke').map(e => [e.who, e.cause.k])), json([['T0.1.room.1', 'dissolved']]));
    said(X, ev);
  });

  test('a first throw of an unknown Solution is refused if the 5×5 at its target would include you: refused at distance 2, allowed at 3, and the refusal names no kind', () => {
    const { X } = core();
    for (const ck of SOLUTIONS) {
      const s = room(X, { you: [2, 4], tote: [[ck, 2]] }), uid = uidOf(s, ck), h = X.State.hash(s), rng = json(s.rng);
      for (const [x, y] of [[4, 4], [4, 6], [2, 2], [3, 3], [2, 4]]) {
        const ev = X.Step.step(s, { a: 'throw', uid, x, y });
        assert.equal(json(ev.map(e => [e.k, e.reason])), json([['refused', 'throw_unknown_near']]), `${ck} at ${x},${y}`);
        const line = X.Text.event(ev[0], null);
        assert.ok(clean(line) && !KINDS.some(k => line.includes(X.Registry.CONSUMABLES[k].name)), line);
        assert.equal(X.State.hash(s), h); assert.equal(json(s.rng), rng);
      }
      assert.ok(!X.Step.legal(s).some(a => a.a === 'throw' && Math.max(Math.abs(a.x - 2), Math.abs(a.y - 4)) <= 2), 'none within 2 is legal');
      const ev = checked(X, X.Step.step(s, { a: 'throw', uid, x: 5, y: 4 }));
      assert.equal(json(ev.slice(0, 2).map(e => [e.k, e.k === 'used' ? e.cause.known : e.cause.k])), json([['used', false], ['identified', 'use']]), `${ck} at distance 3`);
      assert.ok(!own(X, ev, 'status').some(e => e.who === 'you'), 'nothing reached you');
      // Known now: the near throw is allowed.
      const s2 = X.State.clone(s);
      if (ck !== 'fixative') assert.equal(X.Step.step(s2, { a: 'throw', uid, x: 3, y: 4 })[0].k, 'used', `${ck}, known, beside you`);
    }
  });

  test('a throw goes onto a tile you can see through, in line of sight, within THROW_RANGE; only a Solution you carry is thrown', () => {
    const { X } = core(), N = X.N;
    const map = ['###############', '#.............#', '#.............#', '#.....#.......#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '###############'];
    const s = room(X, { map, you: [4, 3], tote: [['fixative', 1], ['card', 1]], known: ['fixative'] }), uid = uidOf(s, 'fixative');
    const code = (x, y, u) => X.Consumables.throwRefusal(s, u || uid, x, y);
    // The disc of radius 5: dx² + dy² ≤ 30.
    assert.equal(code(9, 5), null); assert.equal(code(9, 6), 'throw_far'); assert.equal(code(4, 8), null); assert.equal(code(4, 9), 'throw_far');
    assert.equal(code(7, 3), 'throw_unseen', 'behind a pillar'); assert.equal(code(6, 3), 'throw_unseen', 'onto a wall');
    assert.equal(code(-1, 3), 'throw_far'); assert.equal(code(4.5, 3), 'throw_far');
    assert.equal(code(5, 4, uidOf(s, 'card')), 'throw_not_solution'); assert.equal(code(5, 4, 'nothing'), 'consumable_not_carried');
    // targets lists exactly the legal tiles, in row-major order, and legal throws are those.
    const t = X.Consumables.targets(s, uid), legal = X.Step.legal(s).filter(a => a.a === 'throw').map(a => [a.x, a.y]);
    assert.equal(json(t), json(legal));
    for (let y = 0; y < s.dept.h; y++) for (let x = 0; x < s.dept.w; x++) {
      const ok = (x - 4) * (x - 4) + (y - 3) * (y - 3) <= N.THROW_RANGE * N.THROW_RANGE + N.THROW_RANGE && X.Grid.seeThrough(s.dept, x, y) && X.Grid.los(s.dept, 4, 3, x, y);
      assert.equal(t.some(([a, b]) => a === x && b === y), ok, `${x},${y}`);
    }
    for (const c of ['throw_far', 'throw_unseen', 'throw_not_solution', 'consumable_not_carried']) assert.ok(clean(X.Text.refusal(c)), c);
  });

  test('reading the Catalogue Card: you choose one unknown seal and it is identified; with one left it is identified at once; with none, a known Card is refused', () => {
    const { X } = core();
    // Known Card, six seals unknown: a choice of those six, in seal order; nothing else is legal.
    let s = room(X, { tote: [['card', 2]], known: ['card', 'plan'] });
    const uid = uidOf(s, 'card'), unknown = X.Consumables.unknownSeals(s);
    assert.equal(unknown.length, 6);
    let ev = checked(X, X.Step.step(s, { a: 'use', uid }));
    assert.equal(json(s.ui.pendingChoice), json({ k: 'seal', options: unknown }));
    assert.equal(json(X.Step.legal(s)), json(unknown.map((o, index) => ({ a: 'choose', index }))));
    assert.equal(X.Step.step(X.State.clone(s), { a: 'wait' })[0].reason, 'choice_pending');
    parity(X, s, 'a seal choice waiting');
    const tick = s.tick, next = s.actors[0].next;
    ev = checked(X, X.Step.step(s, { a: 'choose', index: 2 }));
    assert.equal(json(ev.map(e => [e.k, e.seal, e.cause.k])), json([['identified', unknown[2], 'card']]));
    assert.equal(s.ui.pendingChoice, null); assert.equal(s.tick, tick); assert.equal(s.actors[0].next, next, 'choosing costs nothing: the reading was the cost');
    said(X, ev);
    // An unknown Card identifies itself first, then offers the seven others.
    s = room(X, { tote: [['card', 1]] });
    ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'card') }));
    assert.equal(json(ev.slice(0, 2).map(e => e.k)), json(['used', 'identified']));
    assert.equal(s.ui.pendingChoice.options.length, 7);
    // One seal left: identified at once, with no choice.
    s = room(X, { tote: [['card', 2]], known: KINDS.filter(k => k !== 'ticket') });
    ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'card') }));
    assert.equal(json(own(X, ev, 'identified').map(e => [e.ck, e.cause.k])), json([['ticket', 'card']])); assert.equal(s.ui.pendingChoice, null);
    // None left: refused, and not legal.
    assert.equal(json(X.Step.step(s, { a: 'use', uid: uidOf(s, 'card') }).map(e => e.reason)), json(['card_all_known']));
    assert.ok(!X.Step.legal(s).some(a => a.a === 'use'));
    // choose with nothing waiting, or out of range.
    assert.equal(X.Step.step(s, { a: 'choose', index: 0 })[0].reason, 'choice_none');
  });

  test('reading the Floor Plan marks every tile of the department explored and names the rooms whose Highlights have not been taken', () => {
    const { X } = core();
    const s = room(X, { tote: [['plan', 1]], known: ['plan'] });
    s.items.push(X.Kit.item({ uid: 'T0.1.room.k1', kind: 'kit', where: { at: 'floor', x: 5, y: 5 } }), X.Kit.item({ uid: 'T0.1.room.k2', kind: 'kit', where: { at: 'tote' } }));
    s.you.tote.push('T0.1.room.k2');
    s.dept.highlights.push({ uid: 'T0.1.room.k1', room: 's2' }, { uid: 'T0.1.room.k2', room: 's1' });
    assert.equal(X.Consumables.planRooms(s), null, 'not before a plan is read');
    X.Step.step(s, { a: 'wait' }); X.Step.step(s, { a: 'wait' });
    const turn = s.turn, ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'plan') }));
    assert.equal(s.dept.planRead, turn);
    assert.equal(s.dept.seen, '1'.repeat(s.dept.w * s.dept.h));
    assert.equal(json(X.Consumables.planRooms(s)), json(['s2']), 'the kit you carry is taken');
    assert.equal(json(X.Consumables.view(s).plan), json(['s2']));
    said(X, ev);
  });

  test('reading "Quiet, Please" quiets from your tile out to QUIET_RANGE walking tiles (Wake.quiet), and leaves settled exhibits\' homes as they were', () => {
    const { X, calls } = core(), N = X.N;
    // A wall down x = 8 with a gap at the bottom, so the exhibits beyond it are near by
    // walking but out of sight of you.
    const map = ['#####################', '#.......#...........#', '#.......#...........#', '#...................#', '#####################'];
    const s = room(X, { map, you: [4, 2], tote: [['quiet', 1]], known: ['quiet'], exhibits: [
      ex([12, 2], { pips: 2 }), ex([6, 1], { mode: 'awake', home: [3, 3] }), ex([10, 1], { mode: 'hunting', home: [10, 3] }), ex([19, 1], { mode: 'awake', home: [18, 3] })] });
    const d = X.Grid.distances(s.dept, [[4, 2]], 99), at = (x, y) => d[y * s.dept.w + x];
    assert.equal(json([at(12, 2), at(6, 1), at(10, 1)].every(v => v >= 0 && v <= N.QUIET_RANGE)), 'true');
    assert.ok(at(19, 1) > N.QUIET_RANGE);
    const ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'quiet') }));
    assert.equal(json(calls.filter(c => c.fn === 'quiet')), json([{ fn: 'quiet', x: 4, y: 2, range: N.QUIET_RANGE, cause: { k: 'quiet', by: 'you' } }]));
    const [, a, b, c, e] = s.actors;
    assert.equal(json([a.mode, a.pips, b.mode, b.x, b.y, b.home, c.mode, c.home, e.mode]), json(['dormant', 0, 'dormant', 6, 1, [3, 3], 'awake', [10, 3], 'awake']),
      'the sleeper loses its pips; the awake one settles where it stands, its home unchanged; the hunter drops to awake; the far one is untouched');
    said(X, ev);
  });

  test('reading the Re-admission Ticket puts you at the entrance, or the nearest free tile to it, and every hunter loses you (Wake.lose); with no entrance it is refused', () => {
    const { X, calls } = core();
    const map = ['###########', 'E.........#', '#.........#', '#.........#', '###########'];
    let s = room(X, { map, entrance: [0, 1], you: [8, 2], tote: [['ticket', 2]], known: ['ticket'], exhibits: [ex([6, 2], { mode: 'hunting' })] });
    let ev = checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'ticket') }));
    assert.equal(json([s.actors[0].x, s.actors[0].y]), json([0, 1]));
    assert.equal(json(calls.filter(c => c.fn === 'lose')), json([{ fn: 'lose', cause: { k: 'ticket', by: 'you' } }]));
    assert.equal(json([ev[0].cause.x, ev[0].cause.y]), json([0, 1]));
    assert.match(X.Text.event(ev[0], null), /back at the entrance/);
    // Someone at the entrance: the nearest free tile by walking distance, then row-major.
    s = room(X, { map, entrance: [0, 1], you: [8, 2], tote: [['ticket', 1]], known: ['ticket'], exhibits: [ex([0, 1]), ex([1, 1])] });
    // 1,1 is the only tile 1 step away; of those 2 away (2,1, 2,2 and 1,2: the corner rule
    // keeps 1,2 from the entrance's diagonal), 2,1 comes first in row-major order.
    assert.equal(json(X.Consumables.arrival(s)), json([2, 1]));
    X.Step.step(s, { a: 'use', uid: uidOf(s, 'ticket') });
    assert.equal(json([s.actors[0].x, s.actors[0].y]), json([2, 1]));
    // No entrance: refused, not legal.
    s = room(X, { tote: [['ticket', 1]], known: ['ticket'] });
    assert.equal(X.Step.step(s, { a: 'use', uid: uidOf(s, 'ticket') })[0].reason, 'ticket_no_entrance');
    assert.ok(!X.Step.legal(s).some(a => a.a === 'use'));
  });

  test('the Ticket: every hunter but the Night Watchman loses you; it takes you even while you are rooted; unknown with no entrance it is identified and does nothing, known it is refused; its clause says so', () => {
    const { X, calls } = core();
    const map = ['###########', 'E.........#', '#.........#', '#.........#', '###########'];
    let s = room(X, { map, entrance: [0, 1], you: [8, 2], tote: [['ticket', 1]], known: ['ticket'], youStatuses: [{ id: 'rooted', turns: 3 }],
      exhibits: [ex([6, 2], { sp: 'night_watchman', mode: 'hunting' }), ex([6, 3], { mode: 'hunting' })] });
    const [, w, d] = s.actors, it = s.items.find(i => i.ck === 'ticket');
    assert.equal(json([w.arch, w.mode, d.mode]), json(['night_watchman', 'hunting', 'hunting']));
    let ev = checked(X, X.Step.step(s, { a: 'use', uid: it.uid }));
    assert.equal(json([s.actors[0].x, s.actors[0].y]), json([0, 1]), 'rooted, you are still put at the entrance: a Ticket is not a step');
    assert.ok(s.actors[0].statuses.some(t => t.id === 'rooted'), 'and you are still rooted there');
    assert.equal(json(ev.filter(e => e.k === 'lost' && e.cause.k === 'ticket').map(e => [e.who, e.to])), json([[d.uid, 'searching']]), 'the dummy loses you, the Watchman does not');
    assert.equal(w.mode, 'hunting');
    const clause = X.Consumables.line(s, it);
    for (const part of ['even while you are rooted', 'every exhibit hunting you but the Night Watchman loses you', 'its pending special is called off', 'With no entrance to return to, a Ticket not yet identified is identified and does nothing, and a known one cannot be read'])
      assert.ok(clause.includes(part), `the Ticket's clause says "${part}": ${clause}`);
    // No entrance, unknown: it can be read, is identified, and nothing else happens; known, it
    // is refused. The refusal never names an unknown leaflet a Ticket.
    s = room(X, { tote: [['ticket', 2]] });
    const uid = uidOf(s, 'ticket'), at = json([s.actors[0].x, s.actors[0].y]), loses = calls.filter(c => c.fn === 'lose').length;
    assert.ok(X.Step.legal(s).some(a => a.a === 'use' && a.uid === uid), 'an unknown Ticket can be read with no entrance');
    ev = checked(X, X.Step.step(s, { a: 'use', uid }));
    assert.equal(json(ev.map(e => [e.k, e.cause.k])), json([['used', 'consume'], ['identified', 'use']]));
    assert.equal(json([ev[0].cause.known, ev[0].cause.nowhere, ev[0].cause.x]), json([false, true, undefined]));
    assert.equal(json([s.actors[0].x, s.actors[0].y]), at, 'you stay where you are');
    assert.equal(calls.filter(c => c.fn === 'lose').length, loses, 'no one loses you');
    assert.match(X.Text.event(ev[0], null), /It is a Re-admission Ticket, but there is no entrance here to go back to, so nothing happened\./);
    said(X, ev);
    assert.equal(json(X.Step.step(s, { a: 'use', uid }).map(e => e.reason)), json(['ticket_no_entrance']), 'known now, it is refused');
    assert.ok(!X.Step.legal(s).some(a => a.a === 'use' && a.uid === uid));
  });

  test('a consumable given with no count (as a room for tests may give one) is a stack of one: carried, usable, and gone once used', () => {
    const { X } = core();
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map: OPEN, you: [2, 4], exhibits: [], items: [{ uid: 'c1', kind: 'consumable', ck: 'consolidant', where: { at: 'tote' } }, { uid: 'c2', kind: 'consumable', ck: 'fixative', where: { at: 'tote' } }] });
    X.Consumables.startRun(s);
    assert.equal(json(s.items.filter(i => i.kind === 'consumable').map(i => i.n)), json([null, null]));
    const legal = X.Step.legal(s);
    assert.ok(legal.some(a => a.a === 'use' && a.uid === 'c1') && legal.some(a => a.a === 'throw' && a.uid === 'c2'));
    assert.equal(json(X.Consumables.view(s).tote.map(t => [t.uid, t.n])), json([['c1', 1], ['c2', 1]]));
    const inv = require('./behaviour/consumables.inv.js')(X), pre = X.State.clone(s);
    const ev = checked(X, X.Step.step(s, { a: 'use', uid: 'c1' }));
    assert.equal(ev[0].k, 'used');
    for (const i of inv) assert.equal(i.check(pre, ev, s), null, i.id);
    const c1 = s.items.find(i => i.uid === 'c1');
    assert.equal(json([c1.n, c1.where, s.you.tote]), json([0, { at: 'gone' }, ['c2']]));
  });

  test('a label identifies its kind when read within READ_RANGE tiles in sight, at no cost in time; farther, out of sight, known or absent, it is refused', () => {
    const { X } = core();
    const map = ['###########', '#.........#', '#.........#', '#....#....#', '#.........#', '###########'];
    const plaque = (x, y, ck) => ({ k: 'plaque', x, y, ck });
    const s = room(X, { map, you: [4, 3], fixtures: [plaque(4, 5, 'fumigant'), plaque(2, 5, 'card'), plaque(6, 3, 'quiet'), plaque(10, 3, 'fixative')] });
    const r = (x, y) => X.Consumables.readRefusal(s, x, y);
    // Within 2 (dx² + dy² ≤ 6) and in sight.
    assert.equal(r(4, 5), null, 'two tiles south');
    assert.equal(r(2, 5), 'label_far', 'dx² + dy² = 8');
    assert.equal(r(6, 3), 'label_far', 'two tiles east, behind the pillar');
    assert.equal(r(10, 3), 'label_far'); assert.equal(r(3, 3), 'label_none'); assert.equal(r(4.5, 3), 'label_none');
    assert.equal(json(X.Step.legal(s).filter(a => a.a === 'read')), json([{ a: 'read', x: 4, y: 5 }]));
    const tick = s.tick, turn = s.turn, next = s.actors[0].next;
    const ev = checked(X, X.Step.step(s, { a: 'read', x: 4, y: 5 }));
    assert.equal(json(ev.map(e => [e.k, e.ck, e.cause.k, e.cause.by])), json([['identified', 'fumigant', 'label', 'you']]));
    assert.equal(json([s.tick, s.turn, s.actors[0].next]), json([tick, turn, next]), 'no time passes');
    assert.equal(r(4, 5), 'label_known');
    assert.ok(!X.Step.legal(s).some(a => a.a === 'read'), 'nothing left to read');
    for (const c of ['label_none', 'label_far', 'label_known']) assert.equal(X.Step.step(X.State.clone(s), { a: 'read', x: c === 'label_known' ? 4 : 3, y: c === 'label_known' ? 5 : 3 })[0].k, 'refused');
    said(X, ev);
  });

  test('Step.legal lists exactly the consumable actions step() accepts, over every candidate, and a refused one changes nothing', () => {
    const { X } = core();
    const map = ['###########', 'E.........#', '#.........#', '#....#....#', '#.........#', '#.........#', '###########'];
    const fixtures = [{ k: 'plaque', x: 4, y: 6, ck: 'plan' }, { k: 'plaque', x: 10, y: 2, ck: 'solvent' }];
    const tote = KINDS.map(k => [k, 2]);
    let n = 0;
    const unknown = room(X, { map, entrance: [0, 1], you: [4, 4], fixtures, tote, exhibits: [ex([7, 2]), ex([2, 2], { mode: 'hunting' })] });
    n += parity(X, unknown, 'all unknown');
    const known = room(X, { map, entrance: [0, 1], you: [4, 4], fixtures, tote, known: KINDS });
    n += parity(X, known, 'all known');
    const fixed = room(X, { map, you: [4, 4], tote, youStatuses: [{ id: 'fixed', turns: 3 }] });
    n += parity(X, fixed, 'fixed');
    assert.ok(X.Step.legal(fixed).every(a => a.a === 'wait' || a.a === 'rest'));
    // A department, with consumables put in your tote.
    const d = X.Dept.create(4, 'A4', 3);
    for (const ck of ['fixative', 'card', 'quiet']) give(X, d, ck, 1);
    n += parity(X, d, 'A4');
    // After a few uses the tote changes: a monkey of uses, with parity on the way.
    const s = room(X, { map, entrance: [0, 1], you: [4, 4], fixtures, tote: KINDS.map(k => [k, 1]) });
    for (let k = 0; k < 12 && !s.over; k++) {
      const legal = X.Step.legal(s).filter(a => ['use', 'throw', 'read', 'choose'].includes(a.a));
      if (!legal.length) break;
      checked(X, X.Step.step(s, legal[(k * 7) % legal.length]));
      n += parity(X, s, `after ${k + 1} uses`);
    }
    assert.ok(n > 3000, `${n} candidates stepped`);
  });

  // The tiles you can walk to from the entrance without passing a staff door (an exhibit's
  // step rule: 8 directions, a diagonal only if both tiles beside it can be walked), on the
  // map with a mimic's disguise counted as the floor it stands on; written out here.
  function walkable(X, s) {
    const m = s.dept, tiles = m.tiles.map(r => r.split(''));
    for (const f of m.fixtures) if (f.k === 'case' && f.mimic) tiles[f.y][f.x] = '.';
    const map = { w: m.w, h: m.h, tiles: tiles.map(r => r.join('')), surfaces: [] };
    const ok = (x, y) => X.Grid.inside(map, x, y) && X.Grid.walkable(map, x, y, 'exhibit');
    const seen = new Set([m.entrance.join(',')]), q = [m.entrance];
    while (q.length) {
      const [x, y] = q.shift();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || seen.has(nx + ',' + ny) || !ok(nx, ny) || (dx && dy && !(ok(nx, y) && ok(x, ny)))) continue;
        seen.add(nx + ',' + ny); q.push([nx, ny]);
      }
    }
    return (x, y) => seen.has(x + ',' + y);
  }
  const beforeRM = (a, b) => a.y < b.y || (a.y === b.y && a.x < b.x);

  test('the stand-in placement: CONSUMABLES_PER_DEPT consumables from the deck on free floor of the sections and studies that you can walk to, and ID_LABELS_PER_DEPT labels for unknown kinds on walls beside such a tile, the first by the Intro or the first section, after the cases and staff doors', () => {
    const { X } = core(), N = X.N;
    const ROLES = ['intro', 'section', 'study'];
    let depts = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (let depth = 1; depth <= 7; depth++) for (const seed of [1, 2, 3, 4]) {
      const s = X.Dept.create(seed * 10 + depth, acc, depth), m = s.dept, walk = walkable(X, s);
      const roomAt = (x, y) => m.rooms.find(r => r.id === m.roomOf[y][x]);
      const cons = s.items.filter(i => i.kind === 'consumable');
      assert.equal(cons.length, N.CONSUMABLES_PER_DEPT, `${acc} d${depth}`);
      const tiles = new Set();
      for (const it of cons) {
        const { x, y } = it.where, rm = roomAt(x, y);
        assert.equal(it.where.at, 'floor'); assert.equal(m.tiles[y][x], '.', `${it.uid} on floor`);
        assert.ok(rm && (rm.role === 'section' || rm.role === 'study'), `${it.uid} in a section or study, not a ${rm && rm.role}`);
        assert.ok(walk(x, y), `${it.uid} at ${x},${y} can be walked to from the entrance`);
        assert.match(it.uid, new RegExp(`^${acc}\\.${depth}\\.${rm.key}\\.i\\d+$`));
        assert.ok(!s.actors.some(a => X.Actors.covers(a, x, y)) && !X.Cases.at(s, x, y) && !(m.entrance[0] === x && m.entrance[1] === y), `${it.uid}'s tile is free`);
        assert.ok(!s.items.some(i => i !== it && (i.where.at === 'floor' || i.where.at === 'case') && i.where.x === x && i.where.y === y), `${it.uid}: no other item on its tile`);
        assert.ok(!tiles.has(x + ',' + y), 'one to a tile'); tiles.add(x + ',' + y);
        assert.equal(json([it.n, it.seal, it.from]), json([1, X.Consumables.sealFor(s, it.ck), null]));
      }
      // The deck: those five cards are gone from it.
      const left = DECK.slice(); for (const it of cons) left[KINDS.indexOf(it.ck)]--;
      assert.equal(json(s.run.deck), json(left));
      // Labels: two, of different unknown kinds, each on a wall beside a floor tile of a
      // gallery that you can walk to; the first placed beside the Intro or the first section;
      // they follow every case and staff door (§4.1: those in row-major order, then what is
      // placed after them, in order).
      const plaques = m.fixtures.filter(f => f.k === 'plaque');
      assert.equal(plaques.length, N.ID_LABELS_PER_DEPT, `${acc} d${depth} labels`);
      assert.equal(new Set(plaques.map(p => p.ck)).size, plaques.length);
      const by = p => [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [p.x + dx, p.y + dy]).filter(([x, y]) => X.Grid.inside(m, x, y) && walk(x, y)).map(([x, y]) => roomAt(x, y)).filter(r => r && ROLES.includes(r.role));
      for (const p of plaques) {
        assert.equal(m.tiles[p.y][p.x], '#', `${json(p)} on a wall`);
        assert.ok(by(p).length, `${json(p)} beside a gallery tile you can walk to`);
        assert.equal(m.fixtures.filter(f => f.x === p.x && f.y === p.y).length, 1);
      }
      assert.equal(json(m.fixtures.slice(m.fixtures.length - plaques.length)), json(plaques), `${acc} d${depth}: the labels come after the cases and staff doors`);
      const made = m.fixtures.filter(f => f.k === 'staff' || (f.k === 'case' && !f.mimic));
      for (let i = 1; i < made.length; i++) assert.ok(beforeRM(made[i - 1], made[i]), `${acc} d${depth}: the cases and staff doors in row-major order`);
      assert.ok(by(plaques[0]).some(r => r.role === 'intro' || r.key === 's1'), `${acc} d${depth}: ${json(plaques[0])}, the first label, by the Intro or s1`);
      // Made the same way twice, the same.
      assert.equal(X.State.hash(X.Dept.create(seed * 10 + depth, acc, depth)), X.State.hash(s));
      depts++;
    }
    assert.equal(depts, 84);
    // Removing an exhibit moves no consumable or label (R19: a removed exhibit keeps its tile).
    for (const [acc, seed, depth] of [['S9', 1, 2], ['A4', 2, 3], ['M11', 3, 6]]) {
      const base = X.Dept.create(seed, acc, depth), mine = s => json([s.items.filter(i => i.kind === 'consumable'), s.dept.fixtures.filter(f => f.k === 'plaque'), s.run.deck]);
      for (const a of base.actors.slice(1)) assert.equal(mine(X.Dept.create(seed, acc, depth, { without: [a.uid] })), mine(base), `${acc}: without ${a.uid}`);
    }
    // A room for tests has no rooms to place in: nothing is placed, and the deck is untouched.
    const r = room(X, {});
    X.Consumables.standIn(r, 'layout/T0@1/d1/a0', { seed: 1, rng: {} });
    assert.equal(json([r.items.filter(i => i.kind === 'consumable'), r.dept.fixtures, r.run.deck]), json([[], [], DECK]));
  });

  // A department made by hand: a section s1 whose floor is all taken by items but for a pocket
  // at 2,1, shut in by columns and the wall; a study s2 beyond a gap that a mimic in its
  // disguise stands in; the entrance at 0,5.
  test('the stand-in placement, by hand: never in a pocket you cannot walk to, never on an item, through a mimic\'s disguise as through floor; labels only for kinds you do not know', () => {
    const { X } = core(), N = X.N;
    const map = ['#############', '#o.o..#.....#', '#ooo..#.....#', '#.....#.....#', '#.....#.....#', 'E.....v.....#', '#############'];
    const mk = (seed, knownKinds) => {
      const s = room(X, { seed, map, you: [1, 5], entrance: [0, 5], known: knownKinds });
      const m = s.dept;
      m.rooms = [{ id: 1, key: 's1', role: 'section', number: 1, x0: 1, y0: 1, x1: 5, y1: 5 }, { id: 2, key: 's2', role: 'study', number: 2, x0: 7, y0: 1, x1: 11, y1: 5 }];
      m.roomOf = map.map((row, y) => row.split('').map((c, x) => (x >= 1 && x <= 5 && y >= 1 && y <= 5 ? 1 : x >= 7 && x <= 11 && y >= 1 && y <= 5 ? 2 : 0)));
      m.fixtures.push(X.Cases.make({ x: 6, y: 5, mimic: 'T0.1.room.9' }));
      let k = 0;
      for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) if (map[y][x] === '.' && !(x === 2 && y === 1) && !(x === 1 && y === 5)) s.items.push(X.Kit.item({ uid: `T0.1.s1.i${++k}`, kind: 'curio', where: { at: 'floor', x, y } }));
      return s;
    };
    for (let seed = 1; seed <= 60; seed++) {
      const s = mk(seed, []);
      X.Consumables.standIn(s, 'layout/T0@1/d1/a0', { seed, rng: {} });
      const cons = s.items.filter(i => i.kind === 'consumable');
      assert.equal(cons.length, N.CONSUMABLES_PER_DEPT, `seed ${seed}`);
      for (const it of cons) {
        assert.ok(!(it.where.x === 2 && it.where.y === 1), `seed ${seed}: ${it.uid} in the walled-in pocket`);
        assert.ok(!s.items.some(i => i !== it && i.where.at === 'floor' && i.where.x === it.where.x && i.where.y === it.where.y), `seed ${seed}: ${it.uid} on another item`);
        assert.match(it.uid, /^T0\.1\.s2\.i\d+$/, `seed ${seed}: s2, past the mimic, is the only room with free floor you can walk to`);
      }
      const plaques = s.dept.fixtures.filter(f => f.k === 'plaque');
      assert.equal(plaques.length, N.ID_LABELS_PER_DEPT);
      const walk = walkable(X, s);
      for (const p of plaques) assert.ok([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => walk(p.x + dx, p.y + dy) && s.dept.roomOf[p.y + dy][p.x + dx] > 0), `seed ${seed}: ${json(p)} beside a gallery tile you can walk to (2,0 is beside only the pocket)`);
    }
    // Labels are only for kinds you do not know: with six known, the two others; with seven,
    // the one left; with all eight, none.
    for (const n of [6, 7, 8]) for (let seed = 1; seed <= 10; seed++) {
      const knownKinds = KINDS.slice(0, n), s = mk(seed, knownKinds);
      X.Consumables.standIn(s, 'layout/T0@1/d1/a0', { seed, rng: {} });
      const cks = s.dept.fixtures.filter(f => f.k === 'plaque').map(p => p.ck).sort();
      assert.equal(json(cks), json(KINDS.slice(n).sort()), `${n} known, seed ${seed}`);
    }
  });

  test('a consumable\'s name: its department\'s local name for its seal (from the department it was first taken in), its seal, and its kind once known', () => {
    const { X } = core();
    const s = room(X, { tote: [['fumigant', 1], ['ticket', 1]] }), pack = X.Packs.get('M11'), other = X.Packs.get('S9');
    const names = ['Rain', 'Brine', 'Lees', 'Smoke', 'Chart', 'Tide Table', 'Hush', 'Return'];
    pack.consumables = { names, labels: {} };
    const fum = s.items.find(i => i.ck === 'fumigant'), tic = s.items.find(i => i.ck === 'ticket');
    const SEALS = ['wax1', 'wax2', 'wax3', 'wax4', 'ink1', 'ink2', 'ink3', 'ink4'];
    // In a room with no pack, a plain name.
    assert.equal(json(X.Consumables.name(s, fum)), json({ local: 'An Unlabelled Phial', seal: fum.seal, kind: null }));
    assert.equal(X.Consumables.name(s, tic).local, 'An Unlabelled Leaflet');
    // Taken in M11: M11's name for that seal's position.
    fum.from = 'M11'; tic.from = 'M11';
    assert.equal(X.Consumables.name(s, fum).local, names[SEALS.indexOf(fum.seal)]);
    assert.equal(X.Consumables.name(s, tic).local, names[SEALS.indexOf(tic.seal)]);
    // Taken in a department whose pack names none: the plain name; and in M11, while you
    // stand in S9, still M11's.
    fum.from = 'S9'; if (!(other.consumables && other.consumables.names)) assert.equal(X.Consumables.name(s, fum).local, 'An Unlabelled Phial');
    // The kind shows once its seal is known.
    s.run.knownSeals.push(fum.seal);
    assert.equal(X.Consumables.name(s, fum).kind, 'fumigant'); assert.equal(X.Consumables.name(s, tic).kind, null);
    // The local name follows the seal, not the kind: two runs that put fumigant under
    // different seals give it different names.
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed++) { const t = room(X, { seed, tote: [['fumigant', 1]] }), it = t.items.find(i => i.ck === 'fumigant'); it.from = 'M11'; seen.add(X.Consumables.name(t, it).local); }
    assert.equal(seen.size, 4, 'one of the four Solutions\' names, by seal');
  });

  test('a consumable\'s Behaviour line: unknown, the first-use rule; known, its kind\'s clause with the numbers of record', () => {
    const { X } = core(), N = X.N;
    const s = room(X, { tote: KINDS.map(k => [k, 1]) });
    for (const ck of KINDS) {
      const it = s.items.find(i => i.ck === ck), unknown = X.Consumables.line(s, it);
      assert.ok(clean(unknown) && !/[{}]/.test(unknown) && unknown.includes(`${N.FUMIGANT_SIZE}×${N.FUMIGANT_SIZE}`), unknown);
      s.run.knownSeals.push(it.seal);
      const line = X.Consumables.line(s, it);
      assert.ok(clean(line) && !/[{}]/.test(line) && line !== unknown, `${ck}: ${line}`);
    }
    const line = ck => X.Consumables.line(s, s.items.find(i => i.ck === ck));
    assert.match(line('consolidant'), new RegExp(`${N.CONSOLIDANT_NOW_PCT}% .*${N.CONSOLIDANT_HOT_PCT}% more over ${N.CONSOLIDANT_HOT_TURNS} turns.*${N.THROW_AREA}×${N.THROW_AREA}.*${N.CONSOLIDANT_THROW_PCT}%`));
    assert.match(line('fixative'), new RegExp(`${N.FIXATIVE_TURNS} turns`));
    assert.match(line('fumigant'), new RegExp(`${N.COUGH_TURNS} turns.*${N.FUMIGANT_SIZE}×${N.FUMIGANT_SIZE} cloud for ${N.FUMIGANT_TURNS} turns`));
    assert.match(line('quiet'), new RegExp(`within ${N.QUIET_RANGE} walking tiles`));
    // A thrown Consolidant or Fixative does not reach through glass, and says so.
    for (const ck of ['consolidant', 'fixative']) assert.match(line(ck), /Thrown, .* except one inside an intact case, which is behind glass\./);
    // The rules every throw, every department and every label follow have their clauses.
    const fill = (t, id, depth) => X.Clauses.fill(X.Registry[t][id].clause, X.Clauses.params(X.Registry[t][id].params, null, { depth: depth || 1 }));
    const thrown = fill('CLAUSES', 'consumable_throw');
    for (const part of [`within ${N.THROW_RANGE} tiles`, 'that you can see and that does not block sight', 'you included, except one inside an intact case, which is behind glass', 'but Solvent lands with a soft noise'])
      assert.ok(thrown.includes(part), `the throw's clause says "${part}": ${thrown}`);
    assert.match(fill('CLAUSES', 'consumable_deck'), new RegExp(`lays ${N.CONSUMABLES_PER_DEPT} of them on free floor tiles of its sections and studies, each one you can walk to from the entrance without passing a staff door`));
    assert.match(fill('FIXTURES', 'plaque'), new RegExp(`hangs ${N.ID_LABELS_PER_DEPT} on its walls, each for a different kind you do not know, one by the Intro or the first section, and each beside a floor tile you can walk to`));
    // Every clause of the fragment fills, with no gap.
    for (const t of ['CONSUMABLES', 'SEALS', 'FIXTURES', 'CLAUSES', 'REFUSALS']) for (const id of X.Registry.order(t)) {
      const e = X.Registry[t][id];
      if (!e.tests.includes('m3-consumables.test.js')) continue;
      assert.equal(e.ready, 'unit', `${t}.${id}`); assert.equal(e.inv, 'consumables');
      if (e.clause !== undefined) assert.ok(clean(X.Clauses.fill(e.clause, X.Clauses.params(e.params, null, { depth: 4 }))), `${t}.${id}`);
    }
  });

  test('making a consumable: uids by room, counting on from the room\'s items; made into the tote it joins the stack of its seal (Kit.addToTote)', () => {
    const { X, calls } = core();
    const s = room(X, {});
    s.items.push(X.Kit.item({ uid: 'T0.1.room.i4', kind: 'curio', where: { at: 'floor', x: 1, y: 1 } }));
    const a = X.Consumables.make(s, 'solvent', { at: 'floor', x: 5, y: 5 });
    assert.equal(a.uid, 'T0.1.room.i5');
    const b = X.Consumables.make(s, 'solvent', { at: 'tote' }), c = X.Consumables.make(s, 'solvent', { at: 'tote' });
    assert.equal(json([b.uid, b.where, b.n, c.uid, c.where.at, c.n]), json(['T0.1.room.i6', { at: 'tote' }, 2, 'T0.1.room.i7', 'gone', 0]));
    assert.equal(json(calls.filter(k => k.fn === 'addToTote').map(k => k.item)), json(['T0.1.room.i6', 'T0.1.room.i7']));
    assert.equal(json(s.you.tote), json(['T0.1.room.i6']));
    // In a department, by its room's role key.
    const d = X.Dept.create(2, 'M11', 3), x = d.items.find(i => i.kind === 'consumable');
    assert.equal(X.Consumables.make(d, 'card', { at: 'floor', x: x.where.x, y: x.where.y }).uid.split('.').slice(0, 3).join('.'), x.uid.split('.').slice(0, 3).join('.'));
    assert.throws(() => X.Consumables.make(s, 'potion', { at: 'tote' }), /no kind/);
    // Into a case: only an empty one, which then holds it.
    const cs = room(X, { map: ['###########', '#.........#', '#....v....#', '#.........#', '###########'], you: [2, 3], fixtures: [X.Cases.make({ x: 5, y: 2 })] });
    const e = X.Consumables.make(cs, 'solvent', { at: 'case', x: 5, y: 2 });
    assert.equal(json([e.where, X.Cases.at(cs, 5, 2).holds]), json([{ at: 'case', x: 5, y: 2 }, e.uid]));
    const items = cs.items.length;
    assert.throws(() => X.Consumables.make(cs, 'card', { at: 'case', x: 5, y: 2 }), /no empty case at 5,2/, 'a case already holding something');
    assert.throws(() => X.Consumables.make(cs, 'card', { at: 'case', x: 2, y: 3 }), /no empty case at 2,3/, 'a floor tile');
    assert.throws(() => X.Consumables.make(cs, 'card', { at: 'floor', x: -1, y: 3 }), /not a tile/);
    assert.equal(cs.items.length, items, 'nothing made when refused');
  });

  test('what the view model is given: the known seals, the labels on shown tiles, your consumables by name, the plan and the seal choice', () => {
    const { X } = core();
    const s = room(X, { tote: [['card', 1], ['fixative', 3]], known: ['fixative'], fixtures: [{ k: 'plaque', x: 0, y: 4, ck: 'quiet' }, { k: 'plaque', x: 10, y: 4, ck: 'fixative' }] });
    const vis = new Uint8Array(s.dept.w * s.dept.h); vis[4 * s.dept.w] = 2;
    const v = X.Consumables.view(s, vis);
    assert.equal(json(v.known), json([{ seal: X.Consumables.sealFor(s, 'fixative'), ck: 'fixative' }]));
    assert.equal(json(v.plaques), json([{ x: 0, y: 4, seal: X.Consumables.sealFor(s, 'quiet'), ck: null, readable: true }]));
    assert.equal(json(v.tote.map(t => [t.n, t.cls, t.kind])), json([[1, 'ephemera', null], [3, 'solution', 'fixative']]));
    assert.equal(json([v.plan, v.pending]), json([null, null]));
    X.Step.step(s, { a: 'use', uid: uidOf(s, 'card') });
    assert.equal(X.Consumables.view(s).pending.options.length, 6, 'every unknown seal but the Card\'s own');
    // With no vis given, what you can see (Vision.visible), as the view model keeps to; and
    // the consumables lying on the floor or in a case there, with their seals.
    const map = ['###########', '#....#....#', '#....#....#', '#....#....#', '#...v.....#', '###########'];
    const t = room(X, { map, you: [2, 2], known: ['fixative'], fixtures: [{ k: 'plaque', x: 0, y: 2, ck: 'quiet' }, { k: 'plaque', x: 10, y: 1, ck: 'card' }, X.Cases.make({ x: 4, y: 4 })] });
    const lying = [X.Consumables.make(t, 'fixative', { at: 'floor', x: 3, y: 3 }), X.Consumables.make(t, 'ticket', { at: 'floor', x: 8, y: 1 }), X.Consumables.make(t, 'solvent', { at: 'case', x: 4, y: 4 })];
    const seen = X.Vision.visible(t), sees = (x, y) => !!seen[y * t.dept.w + x];
    assert.equal(json([sees(0, 2), sees(10, 1), sees(3, 3), sees(8, 1), sees(4, 4)]), json([true, false, true, false, true]), 'the wall at x = 5 hides the room\'s far corner');
    const w = X.Consumables.view(t);
    assert.equal(json(w), json(X.Consumables.view(t, seen)));
    assert.equal(json(w.plaques.map(p => [p.x, p.y])), json([[0, 2]]));
    const shape = seal => X.Registry.SEALS[seal].shape;
    assert.equal(json(w.items), json([
      { uid: lying[0].uid, x: 3, y: 3, icon: 'seal', kind: 'consumable', inCase: false, seal: lying[0].seal, shape: shape(lying[0].seal), cls: 'solution', ck: 'fixative' },
      { uid: lying[2].uid, x: 4, y: 4, icon: 'seal', kind: 'consumable', inCase: true, seal: lying[2].seal, shape: shape(lying[2].seal), cls: 'solution', ck: null }]));
  });

  test('every refusal and every sentence of consumables is a clean sentence, and the refusal of a first throw names no kind', () => {
    const { X } = core();
    const codes = X.Registry.order('REFUSALS').filter(c => X.Registry.REFUSALS[c].tests.includes('m3-consumables.test.js'));
    assert.equal(codes.length, 13);
    for (const c of codes) { const t = X.Text.refusal(c); assert.ok(clean(t) && /^[A-Z].*\.$/.test(t), `${c}: ${t}`); }
    const near = X.Text.refusal('throw_unknown_near');
    for (const ck of KINDS) assert.ok(!near.includes(X.Registry.CONSUMABLES[ck].name), near);
    assert.match(near, new RegExp(`at least ${X.Consumables.GENTLE + 1} tiles away`));
  });

  test('a status a consumable puts on or ends reads in the status\'s own words (Registry.STATUSES[id].words) with its turns, so it ends in the words it began with', () => {
    const { X } = core(), N = X.N, R = X.Registry;
    const lines = ev => ev.filter(e => e.k === 'status').map(e => X.Text.event(e, null));
    // Fixative drunk: put on by the item and ended by its timer, in the same words.
    const s = room(X, { tote: [['fixative', 1]], known: ['fixative'] });
    const put = lines(checked(X, X.Step.step(s, { a: 'use', uid: uidOf(s, 'fixative') })));
    let ended = [];
    for (let k = 0; k < N.FIXATIVE_TURNS + 2; k++) ended = ended.concat(lines(X.Step.step(s, { a: 'wait' })));
    assert.equal(json(put), json([`You are now ${R.STATUSES.fixed.words} for ${N.FIXATIVE_TURNS} turns.`]));
    assert.equal(json(ended), json([`You are no longer ${R.STATUSES.fixed.words}.`]));
    // Solvent drunk: each harmful status it ends reads in its own words.
    const t = room(X, { tote: [['solvent', 1]], known: ['solvent'], youStatuses: [{ id: 'rooted', turns: 3 }, { id: 'coughing', turns: 4 }] });
    assert.equal(json(lines(checked(X, X.Step.step(t, { a: 'use', uid: uidOf(t, 'solvent') })))), json(['rooted', 'coughing'].map(id => `You are no longer ${R.STATUSES[id].words}.`)));
    // Every status, put on by an item for 1 or 3 turns, and ended by one.
    for (const id of R.order('STATUSES')) {
      const say = (on, turns) => X.Text.event({ k: 'status', turn: 1, tick: 100, who: 'you', id, on, turns, cause: { k: 'item', by: 'you', item: 'T0.1.a.i1' } }, null);
      assert.equal(say(true, 1), `You are now ${R.STATUSES[id].words} for 1 turn.`);
      assert.equal(say(true, 3), `You are now ${R.STATUSES[id].words} for 3 turns.`);
      assert.equal(say(false), `You are no longer ${R.STATUSES[id].words}.`);
    }
  });

  test('a run using every kind is plain data and clone-stable after every step', () => {
    const { X } = core();
    const map = ['###########', 'E.........#', '#.........#', '#.........#', '#.........#', '#.........#', '###########'];
    const make = () => room(X, { map, entrance: [0, 1], you: [4, 3], fixtures: [{ k: 'plaque', x: 4, y: 6, ck: 'card' }], tote: KINDS.map(k => [k, 2]),
      exhibits: [ex([8, 2], { pips: 1 }), ex([8, 5], { mode: 'awake' })] });
    const s = make();
    let twin = X.State.clone(s), steps = 0;
    for (let k = 0; k < 40 && !s.over; k++) {
      const legal = X.Step.legal(s), uses = legal.filter(a => ['use', 'throw', 'read', 'choose'].includes(a.a)), act = uses.length ? uses[(k * 5) % uses.length] : legal[k % legal.length];
      checked(X, X.Step.step(s, act)); X.Step.step(twin, act); twin = X.State.clone(twin);
      assert.equal(X.State.plainData(s), null, `step ${k}`);
      assert.equal(X.State.hash(twin), X.State.hash(s), `step ${k}: ${json(act)}`);
      steps++;
    }
    assert.ok(steps >= 20 && s.items.filter(i => i.kind === 'consumable' && i.where.at === 'gone').length >= 4, `${steps} steps`);
  });
};
module.exports.contracts = contracts;
