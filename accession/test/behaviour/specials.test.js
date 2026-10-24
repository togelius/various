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

  test('a special\'s sentences name it and its numbers; a mark called off says why', () => {
    const names = uid => uid === 'w.1' ? 'the Warden' : null;
    const say = e => Text.event(Object.assign({ turn: 3, tick: 300 }, e), names);
    assert.equal(say({ k: 'telegraphed', who: 'w.1', sp: 'ring', tiles: [[1, 1], [2, 1]], cause: { k: 'special', by: 'w.1', sp: 'ring', gross: 9, every: 3 } }),
      'The Warden marks 2 tiles for its ring of blows: 9 before your Padding, at its next action.');
    assert.equal(say({ k: 'damaged', who: 'you', amount: 7, hp: 13, cause: { k: 'special', by: 'w.1', sp: 'line', gross: 9, pad: 2, net: 7, x: 1, y: 1, from: [2, 1] } }),
      'The Warden’s beam struck you for 7 (9 − 2 Padding).');
    assert.equal(say({ k: 'damaged', who: 'you', amount: 1, hp: 13, cause: { k: 'special', by: 'w.1', sp: 'ring', gross: 2, pad: 4, net: 1, x: 1, y: 1, from: [2, 1] } }),
      'The Warden’s ring of blows struck you for 1 (2 − 4 Padding, at least 1).');
    assert.equal(say({ k: 'special', who: 'w.1', sp: 'ring', hits: ['you'], cause: { k: 'special', by: 'w.1', sp: 'ring' } }), 'The Warden used its ring of blows: it struck 1.');
    assert.equal(say({ k: 'special', who: 'w.1', sp: 'call', cancelled: true, cause: { k: 'cancel', by: 'w.1', why: 'fixed' } }), 'The Warden’s call was called off: it was fixed in place.');
    assert.equal(say({ k: 'special', who: 'w.1', sp: 'line', cancelled: true, cause: { k: 'cancel', by: 'w.1', why: 'out_of_sight' } }), 'The Warden’s beam was called off: it stopped hunting you.');
    assert.equal(say({ k: 'telegraphed', who: 'w.1', sp: 'call', tiles: [[1, 1]], cause: { k: 'special', by: 'w.1', sp: 'call', gross: 0 } }), 'The Warden marks 1 tile for its call, at its next action.');
  });
};
