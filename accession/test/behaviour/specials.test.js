// M3 W1-COMBAT: the specials readout and the threat (BUILD.md §8.1, §7.1), and criterion 3 of
// §11 M3 for each special: what resolves on you is what the readout said and the mark showed.
// The scenarios run for every pack species with a ring of blows, a beam or a call, at depths
// 1–7, with every invariant checked after each step. The exhibit's own behaviour is not used
// here (its archetype's package owns it): each scenario marks the special directly, as the
// exhibit would, and its next action resolves it.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require('./_harness.js');
  const C = loadCore();
  const { Setup, Specials, Roles, N, Registry, Step, State, Actors, Causes, Text } = C;
  const json = JSON.stringify;
  const OPEN = ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '############'];
  const YOU = [3, 2];
  // Where each shape's exhibit stands: beside you for a ring, in your row for a beam, within
  // HERALD_RANGE for a call; and a step of yours that leaves its damage tiles.
  const PLACE = { ring: [4, 2], line: [7, 2], call: [6, 4] };
  const OFF = { ring: 6, line: 0, call: 4 };       // west, off the ring; north, off the row; anywhere

  function build(id) {
    return (params, sp, depth, opts) => {
      const s = Setup.room(opts.seed, { acc: 'T0', depth, map: OPEN, you: YOU,
        exhibits: [{ sp: sp.id, at: PLACE[id], mode: 'hunting', stats: Roles.stats(sp.role, depth) }] }, { rulesOff: opts.rulesOff });
      const a = s.actors[1], tiles = Specials.tiles(s, a, Registry.SPECIALS[id].shape);
      if (!Specials.canMark(s, a, id, tiles)) throw new Error(`${sp.id} cannot mark its ${id} from ${PLACE[id]}`);
      Specials.mark(s, a, id, tiles, []);
      return s;
    };
  }

  const readoutAndMark = id => H.scenario({
    name: `the ${id}: the readout's net, the mark on your tile and the threat of staying all equal what resolves; a step off the marks has no threat`,
    id,
    build: build(id),
    actions: [{ a: 'wait' }],
    expect(r, params, sp) {
      const s = r.start, you = s.actors[0], a = s.actors[1], S = Registry.SPECIALS[id], damage = S.effect === 'damage';
      const gross = damage ? params.gross : 0, net = damage ? Math.max(N.DMG_MIN_ON_HIT, gross - you.pad) : null;
      // The readout's line, from the registry and §8.10, written out again.
      const want = [{ sp: id, net, gross, effect: S.effect, every: S.every ? N[S.every] : null, shape: S.shape, range: S.range ? N[S.range] : null }];
      const got = Specials.readout(s, a, you);
      if (json(got) !== json(want)) return `readout ${json(got)}, not ${json(want)}`;
      const mine = Specials.marks(s).find(m => m.x === you.x && m.y === you.y);
      if (!mine) return 'no mark on your tile';
      if (mine.dmg !== net || mine.kind !== (damage ? 'telegraph' : 'call')) return `the mark on your tile is ${json(mine)}`;
      const stay = Specials.threat(s, { a: 'wait' }), off = Specials.threat(s, { a: 'move', dir: OFF[id] });
      if (damage && json(stay) !== json({ x: you.x, y: you.y, dmg: net, by: a.uid })) return `staying: threat ${json(stay)}`;
      if (!damage && stay !== null) return `a call has no threat, but staying gave ${json(stay)}`;
      if (off !== null) return `stepping off: threat ${json(off)}`;
      // What resolved.
      const ev = r.steps[0].events, hit = ev.filter(e => e.k === 'damaged' && e.cause.k === 'special');
      const special = ev.find(e => e.k === 'special' && e.who === a.uid);
      if (!special || special.cancelled) return `the ${id} did not resolve: ${ev.map(e => e.k).join()}`;
      const noise = ev.findIndex(e => e.k === 'noise' && e.cause.k === 'special');
      if (!damage) return hit.length || noise >= 0 ? 'a call dealt damage or made a noise' : null;
      const onYou = hit.find(e => e.who === 'you');
      if (!onYou || onYou.amount !== net) return `it dealt you ${onYou && onYou.amount}, not ${net}`;
      // RQ14: a damage special is an attack, so it makes a soft noise at its owner's tile,
      // after its damage and before its special event.
      const n = ev[noise];
      if (!n || n.cls !== 'soft' || n.x !== a.x || n.y !== a.y || n.cause.by !== a.uid) return `its noise was ${json(n)}`;
      const last = Math.max(...hit.map(e => ev.indexOf(e)));
      if (!(noise > last && noise < ev.indexOf(special))) return `the noise came at ${noise}, the damage by ${last} and the special at ${ev.indexOf(special)}`;
      return null;
    },
    clone: true,
  });

  for (const id of ['ring', 'line', 'call']) {
    test(`readout, marks and threat agree with what resolves: the ${id}, for every species that has it, at depths 1–7`, () => {
      const list = H.species(C, id);
      assert.ok(list.length >= 7, `${list.length} species and depths`);
      const results = H.sweep(C, readoutAndMark(id), list);
      assert.deepEqual(H.failures(results), []);
      console.log(`  ${id}: ${[...new Set(list.map(x => x.sp.id))].join(', ')} at depths 1–7 (${results.length} runs)`);
    });
  }

  test('an exhibit with no special has no readout line', () => {
    for (const sp of [C.Packs.species('A4', 'A4.1'), C.Packs.species('M11', 'M11.5'), C.Packs.species('S9', 'S9.6')]) {
      const s = Setup.room(1, { acc: 'T0', depth: 3, map: OPEN, you: YOU, exhibits: [{ sp: sp.id, at: [4, 2], mode: 'hunting', stats: Roles.stats(sp.role, 3) }] });
      assert.equal(json(Specials.readout(s, s.actors[1], s.actors[0])), '[]', sp.id);
    }
  });

  // A planted exhibit with a ring of blows, so the threat can be timed by hand.
  function ringer(X) {
    X.Registry.define('ARCHETYPES', 'planted_ringer', { special: 'ring' });
    X.Archetypes.add('planted_ringer', {});
  }
  function marked(X, more, at) {
    const s = X.Setup.room(1, Object.assign({ acc: 'T0', depth: 2, map: OPEN, you: YOU, exhibits: [
      { sp: 'dummy', at: at || [5, 2], arch: 'planted_ringer', mode: 'hunting', stats: Roles.stats('warden', 2) },
      { sp: 'dummy', at: [2, 2], mode: 'dormant', stats: { hp: 30, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] }, more || {}));
    const w = s.actors[1];
    X.Specials.mark(s, w, 'ring', X.Specials.tiles(s, w, 'ring'), []);
    return { s, w, you: s.actors[0] };
  }

  test('the threat is the mark you would end on, if it resolves before your next decision: by where the action leaves you and how long it takes; ties go to you', () => {
    const X = loadCore();
    ringer(X);
    // The ring round (5,2) covers (4..6, 1..3); you stand at (3,2), just off it.
    const { s, w, you } = marked(X);
    const dmg = Math.max(N.DMG_MIN_ON_HIT, Roles.at(N.ROLE_WARDEN_SPECIAL, 2) - you.pad);
    w.next = 50;
    assert.equal(X.Specials.threat(s, { a: 'wait' }), null, 'you are not on it');
    assert.equal(json(X.Specials.threat(s, { a: 'move', dir: 2 })), json({ x: 4, y: 2, dmg, by: w.uid }), 'a step onto it');
    assert.equal(json(X.Specials.threat(s, { a: 'move', dir: 1 })), json({ x: 4, y: 1, dmg, by: w.uid }));
    assert.equal(X.Specials.threat(s, { a: 'move', dir: 6 }), null, 'a step away');
    assert.equal(X.Specials.threat(s, { a: 'attack', uid: s.actors[2].uid }), null, 'a blow leaves you where you are');
    // Resolving at 100, when your next decision after a wait would be: you decide first.
    you.x = 4;
    w.next = 100;
    assert.equal(X.Specials.threat(s, { a: 'wait' }), null, 'a tie goes to you');
    w.next = 99;
    assert.equal(json(X.Specials.threat(s, { a: 'wait' })), json({ x: 4, y: 2, dmg, by: w.uid }));
    // A refused action has no threat, nor a mark of a sleeping or destroyed owner.
    assert.equal(X.Specials.threat(s, { a: 'move', dir: 99 }), null);
    assert.equal(X.Specials.threat(s, { a: 'dance' }), null);
    w.gone = 1;
    assert.equal(X.Specials.threat(s, { a: 'wait' }), null);
    // Nothing in the state changed, not even a stream.
    const t = marked(X), h = State.hash(t.s);
    for (const a of [{ a: 'wait' }, { a: 'move', dir: 2 }, { a: 'attack', uid: t.s.actors[2].uid }]) X.Specials.threat(t.s, a);
    assert.equal(State.hash(t.s), h);
  });

  test('the threat counts the action\'s cost: a Heavy blow (150) and a garment equip (300) reach a resolve that a wait (100) does not', () => {
    const X = loadCore();
    ringer(X);
    // A Heavy blow at the sleeper beside you, with the ring round (4,3) covering your tile.
    const heavy = { kit: { weapon: { form: 'heavy', tier: 1, level: 0 }, garment: { form: 'standard', tier: 1, level: 0 } } };
    const { s, w, you } = marked(X, heavy, [4, 3]);
    const dmg = Math.max(N.DMG_MIN_ON_HIT, Roles.at(N.ROLE_WARDEN_SPECIAL, 2) - you.pad);
    w.next = 120;
    assert.equal(X.Specials.threat(s, { a: 'wait' }), null, 'your next decision at 100 comes first');
    assert.equal(json(X.Specials.threat(s, { a: 'attack', uid: s.actors[2].uid })), json({ x: 3, y: 2, dmg, by: w.uid }), 'after a Heavy blow, at 150, it has resolved');
    // An equip (W1-KIT's action, stood in for here with its costs): a weapon 100, a garment 300.
    const h = X.Actions.get('equip');
    h.apply = (state, action) => action.uid === 'garment' ? 300 : 100;
    w.next = 250;
    assert.equal(X.Specials.threat(s, { a: 'equip', uid: 'weapon' }), null);
    assert.equal(json(X.Specials.threat(s, { a: 'equip', uid: 'garment' })), json({ x: 3, y: 2, dmg, by: w.uid }));
    // What it shows is your Padding now: an equip's Padding counts only once its ticks are done.
    you.pad += 2;
    assert.equal(X.Specials.threat(s, { a: 'equip', uid: 'garment' }).dmg, Math.max(N.DMG_MIN_ON_HIT, dmg - 2));
  });

  test('the threat reads the marks the action leaves: one it calls off (fixed, quieted, lost to the Ticket) or a visit it ends is no threat; one whose owner it may destroy, or an unidentified consumable\'s, still is', () => {
    // You stand on the ring round (4,2); its owner resolves at 50, before your next decision.
    const setup = (X, more) => {
      const s = X.Setup.room((more && more.seed) || 1, { acc: 'T0', depth: 2, map: OPEN, you: YOU, exhibits: [
        { sp: 'dummy', at: [4, 2], arch: 'planted_ringer', mode: 'hunting', stats: (more && more.stats) || Roles.stats('warden', 2) }] });
      const w = s.actors[1];
      X.Specials.mark(s, w, 'ring', X.Specials.tiles(s, w, 'ring'), []);
      w.next = 50;
      return { s, w, you: s.actors[0], dmg: Math.max(N.DMG_MIN_ON_HIT, w.telegraph.gross - s.actors[0].pad) };
    };
    // Stand-ins for other packages' actions, as their rules say they act (W1-CONSUMABLES,
    // W1-WAKE-A, W1-CLOCK): a thrown Fixative fixes the owner (which calls its mark off at
    // once, Status.apply); "Quiet, Please" drops a hunter to awake; the Ticket's hunters lose
    // you; leaving ends the visit.
    const X = loadCore();
    ringer(X);
    const stand = {
      use: (state, action, ev) => { X.Status.apply(state, state.actors[1], 'fixed', N.FIXATIVE_TURNS, { k: 'item', by: 'you', item: action.uid }, ev); return N.COST_USE; },
      read: (state, action, ev) => { X.Wake.setMode(state, state.actors[1], 'awake', { k: 'quiet', by: 'you' }, ev); return N.COST_USE; },
      throw: (state, action, ev) => { X.Wake.setMode(state, state.actors[1], 'searching', { k: 'ticket', by: 'you' }, ev); return N.COST_USE; },
      leave: (state, action, ev) => { state.over = { k: 'left', turn: state.turn, by: null, door: 0, cause: { k: 'leave', door: 0, stage: 0 } }; return N.COST_STEP; },
    };
    for (const id of ['use', 'read', 'throw', 'leave']) X.Actions.get(id).apply = stand[id];
    for (const [action, why] of [[{ a: 'use', uid: 'x.fixative' }, 'fixed'], [{ a: 'read', x: 1, y: 1 }, 'quieted'], [{ a: 'throw', uid: 'x.ticket', x: 1, y: 1 }, 'lost you'], [{ a: 'leave', i: 0 }, 'you left']]) {
      const { s } = setup(X), h = State.hash(s);
      assert.equal(X.Specials.threat(s, { a: 'wait' }) !== null, true, 'waiting, it would strike you');
      assert.equal(X.Specials.threat(s, action), null, why);
      assert.equal(State.hash(s), h, 'the threat changes nothing');
      // And indeed the special does not go off on you (a quieted owner that sees you again
      // hunts, and may strike you from beside you, but its mark is gone).
      const ev = X.Step.step(s, action);
      assert.ok(!ev.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special'), `${why}: ${ev.map(e => e.k).join()}`);
      assert.ok(ev.some(e => e.k === 'special' && e.cancelled) || s.over, `${why}: ${ev.map(e => e.k).join()}`);
    }
    // A consumable whose kind you have not identified is judged as if it did nothing: the
    // threat stays, so it does not say what the consumable is. Once its kind is known, the
    // threat is what it does.
    const known = [];
    X.Consumables.known = (state, ck) => known.includes(ck);
    const u = setup(X);
    u.s.items.push({ uid: 'x.fixative', kind: 'consumable', ref: null, where: { at: 'tote' }, ck: 'fixative', seal: 'sol0', n: 1 });
    assert.equal(json(X.Specials.threat(u.s, { a: 'use', uid: 'x.fixative' })), json({ x: YOU[0], y: YOU[1], dmg: u.dmg, by: u.w.uid }), 'unidentified');
    known.push('fixative');
    assert.equal(X.Specials.threat(u.s, { a: 'use', uid: 'x.fixative' }), null, 'identified');
    // A blow that may destroy the owner: the threat is the same whether the roll destroys it
    // or misses, so it does not tell you the roll.
    const outcomes = new Set(), threats = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const b = setup(X, { seed, stats: { hp: 1, acc: 0, eva: 4, pad: 0, dmin: 1, dmax: 1 } });
      threats.add(json(X.Specials.threat(b.s, { a: 'attack', uid: b.w.uid })));
      const ev = X.Step.step(b.s, { a: 'attack', uid: b.w.uid });
      outcomes.add(ev.some(e => e.k === 'died' && e.who === b.w.uid) ? 'destroyed' : ev.some(e => e.k === 'damaged' && e.who === 'you' && e.cause.k === 'special') ? 'struck you' : 'other');
    }
    assert.equal(json([...outcomes].sort()), json(['destroyed', 'struck you']));
    assert.equal(threats.size, 1);
    assert.equal(json(JSON.parse([...threats][0])), json({ x: YOU[0], y: YOU[1], dmg: Math.max(N.DMG_MIN_ON_HIT, Roles.at(N.ROLE_WARDEN_SPECIAL, 2) - setup(X).you.pad), by: 'T0.2.room.1' }));
  });

  test('a special\'s sentences name it and its numbers; a mark called off says why', () => {
    const names = uid => uid === 'w.1' ? 'the Warden' : null;
    const say = e => Text.event(Object.assign({ turn: 3, tick: 300 }, e), names);
    assert.equal(say({ k: 'telegraphed', who: 'w.1', sp: 'ring', tiles: [[1, 1], [2, 1]], cause: { k: 'special', by: 'w.1', sp: 'ring', gross: 9, every: 3 } }),
      'The Warden marks 2 tiles for its ring of blows: 9 before your Padding, at its next action.');
    assert.equal(say({ k: 'damaged', who: 'you', amount: 7, hp: 13, cause: { k: 'special', by: 'w.1', sp: 'line', gross: 9, pad: 2, net: 7, x: 1, y: 1, from: [2, 1] } }),
      'The Warden’s beam struck you for 7 (9 − 2 Padding).');
    assert.equal(say({ k: 'damaged', who: 'you', amount: 1, hp: 13, cause: { k: 'special', by: 'w.1', sp: 'ring', gross: 2, pad: 4, net: 1, x: 1, y: 1, from: [2, 1] } }),
      'The Warden’s ring of blows struck you for 1 (2 − 4 Padding, at least 1).');
    // Through an old repair (old_repair marks the side), a beam is doubled, and says so.
    const repaired = { k: 'damaged', who: 'w.1', amount: 14, hp: 3, cause: { k: 'special', by: 'w.1', sp: 'line', gross: 9, pad: 2, net: 7, x: 1, y: 1, from: [0, 1], side: 'W' } };
    assert.equal(Causes.check(Object.assign({ turn: 3, tick: 300 }, repaired)), null);
    assert.equal(say(repaired), 'The Warden’s beam struck the Warden for 14 (9 − 2 Padding, doubled through its repaired west side).');
    assert.equal(say({ k: 'damaged', who: 'w.1', amount: 3, hp: 0, cause: { k: 'special', by: 'w.1', sp: 'ring', gross: 9, pad: 2, net: 7, x: 1, y: 1, from: [2, 1] } }),
      'The Warden’s ring of blows struck the Warden for 3 (9 − 2 Padding; it falls to any one blow: all 3 of its health).');
    assert.equal(say({ k: 'special', who: 'w.1', sp: 'ring', hits: ['you'], cause: { k: 'special', by: 'w.1', sp: 'ring' } }), 'The Warden used its ring of blows: it struck 1.');
    assert.equal(say({ k: 'special', who: 'w.1', sp: 'call', cancelled: true, cause: { k: 'cancel', by: 'w.1', why: 'fixed' } }), 'The Warden’s call was called off: it was fixed in place.');
    assert.equal(say({ k: 'special', who: 'w.1', sp: 'line', cancelled: true, cause: { k: 'cancel', by: 'w.1', why: 'out_of_sight' } }), 'The Warden’s beam was called off: it stopped hunting you.');
    assert.equal(say({ k: 'telegraphed', who: 'w.1', sp: 'call', tiles: [[1, 1]], cause: { k: 'special', by: 'w.1', sp: 'call', gross: 0 } }), 'The Warden marks 1 tile for its call, at its next action.');
  });
};
