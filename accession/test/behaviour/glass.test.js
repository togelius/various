// The glass modifier's Behaviour-line clause (BUILD.md §5.3, §5.5, §8.3): "Leaves shards on or
// beside the tile where it is destroyed, and sends beams and shots back along their line."
// Each scenario runs for every species whose line has it (the Heliographs), at every depth
// 1–7, with every invariant checked after every step and a clone check; and each must fail
// with glass switched off (rulesOff), which shows that it tests the modifier (§5.3, check 3).
// Your Pin-Driver is W1-KIT's; here, in this test's own core, a stand-in fires it through
// Ranged.shoot as the plan says KIT's does.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const H = require(path.join(root, 'test/behaviour/_harness.js'));
  const C = loadCore();
  const { Setup, Roles, Ranged, Cases, Grid, N } = C;
  const json = x => JSON.stringify(x);
  const accOf = sp => C.Packs.list().find(p => p.species.includes(sp)).acc;
  const room = (sp, depth, opts, map, you, exhibits, items) => Setup.room(opts.seed, { acc: accOf(sp), depth, map, you, exhibits, items: items || [] }, { rulesOff: opts.rulesOff, invulnerable: true });
  // A glass body that falls to one blow (a surprise blow, since it sleeps).
  const frail = (sp, depth, at) => ({ sp: sp.id, at, mode: 'dormant', stats: Object.assign(Roles.stats(sp.role, depth), { hp: 1 }) });
  const sturdy = (sp, depth, at) => ({ sp: sp.id, at, mode: 'dormant', stats: Object.assign(Roles.stats(sp.role, depth), { hp: 999 }) });
  const PD = 'arch_b.pd';
  // The stand-in fires with its own damage (1–4) and Acc (1), as an instrument's bolt is made.
  C.Kit.useAction = (state, action, ev) => Ranged.shoot(state, state.actors[0], action.x, action.y, { kind: 'shot', item: action.uid, dmin: 1, dmax: 4, acc: 1 }, ev);
  const pinDriver = [{ uid: PD, kind: 'instrument', where: { at: 'kit', slot: 'instrument' }, tier: 1, charges: N.PIN_DRIVER[0], max: N.PIN_DRIVER[0] }];
  const ch = (r, x, y) => r.state.dept.tiles[y][x];
  const both = sc => {
    const res = H.sweep(C, sc);
    assert.ok(res.length >= 7, `${sc.name}: ${res.length} runs`);
    assert.deepEqual(H.failures(res), []);
    const sens = H.sensitivity(C, sc, 'glass');
    assert.ok(sens.sensitive, sens.problems.join('\n'));
    assert.ok(sens.runs.length >= 7);
  };

  test('the glass clause is on the Heliographs, at every depth', () => {
    const list = H.species(C, 'glass');
    assert.ok(list.length >= 7 && list.every(x => x.sp.modifiers.includes('glass')), json(list.map(x => x.sp.id)));
    assert.equal(C.Registry.MODIFIERS.glass.ready, 'unit');
  });

  test('destroyed on the floor, it leaves shards on its own tile', () => both(H.scenario({
    name: 'a glass body destroyed on a floor tile leaves shards there', id: 'glass', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['#######', '#.....#', '#.....#', '#######'], [2, 1], [frail(sp, depth, [3, 1])]),
    actions: state => state.actors[1].gone ? null : { a: 'attack', uid: state.actors[1].uid },
    expect(r) {
      if (!r.state.actors[1].gone) return 'it was not destroyed';
      return ch(r, 3, 1) === 'x' ? null : `its tile is '${ch(r, 3, 1)}', not shards`;
    },
  })));

  test('destroyed in a doorway, it leaves the door as it is and its shards beside it', () => both(H.scenario({
    name: 'a glass body destroyed in an open doorway leaves shards on the first floor tile beside it, and the door intact', id: 'glass', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['#######', '#..##.#', "#..'..#", '#..#..#', '#######'], [2, 2], [frail(sp, depth, [3, 2])]),
    actions: state => state.actors[1].gone ? null : { a: 'attack', uid: state.actors[1].uid },
    expect(r) {
      if (!r.state.actors[1].gone) return 'it was not destroyed';
      if (ch(r, 3, 2) !== "'") return `the doorway became '${ch(r, 3, 2)}'`;
      // The one shard rule: its first floor neighbour in direction order (N, NE, E, …): N and
      // NE are walls here, E is floor.
      return ch(r, 4, 2) === 'x' ? null : `no shards at 4,2 (the row reads ${r.state.dept.tiles[2]})`;
    },
  })));

  test('a beam that reaches it goes back along its line, into the sniper that fired it', () => both(H.scenario({
    name: 'a sniper\'s beam, with you between it and a glass body, comes back into the sniper', id: 'glass', clone: true,
    build: (params, sp, depth, opts) => room(sp, depth, opts, ['##########', '#........#', '##########'], [4, 1],
      [sturdy(sp, depth, [2, 1]), { sp: 'arch_b_sniper', arch: 'axis_sniper', at: [6, 1], mode: 'hunting', stats: Roles.stats('artillery', depth) }]),
    actions: [{ a: 'wait' }, { a: 'wait' }],
    expect(r) {
      const g = r.start.actors[1].uid, sn = r.start.actors[2].uid;
      // Its own beam, back from the glass body: its special's, or (once Specials.resolve gives a
      // beam sent back its reflector's cause, Ranged.beamVia) the glass body's, naming the sniper.
      const own = r.events.filter(e => e.k === 'damaged' && e.who === sn && e.cause.sp === 'line' && ((e.cause.k === 'special' && e.cause.by === sn) || (e.cause.k === 'reflected' && e.cause.by === g && e.cause.shooter === sn)));
      return own.length === 1 ? null : `the sniper took its own beam ${own.length} times`;
    },
  })));

  // Every event a Heliograph causes is one its Behaviour line covers (Clauses.UNIVERSAL, or a
  // part's covers, §5.3): a bolt it sends back that misses is its own `missed`, which glass
  // covers, since neither the axis_sniper's clause nor its line's does.
  let missedBack = 0;
  test('a shot that meets it comes back into whoever fired it, and what that causes is covered by its line', () => {
    both(H.scenario({
      name: 'your Pin-Driver bolts at a glass body come back into you, and never strike it', id: 'glass', clone: true, seeds: [1, 2],
      build: (params, sp, depth, opts) => room(sp, depth, opts, ['##########', '#........#', '##########'], [1, 1], [sturdy(sp, depth, [4, 1])], pinDriver),
      actions: (state, i) => i < 4 ? { a: 'use', uid: PD, x: state.actors[1].x, y: state.actors[1].y } : null,
      expect(r, params, sp, depth) {
        const g = r.start.actors[1].uid;
        const back = r.events.filter(e => (e.k === 'damaged' || e.k === 'missed') && e.cause.k === 'reflected' && e.cause.by === g);
        if (back.length !== 4) return `${back.length} of 4 bolts came back`;
        const covers = new Set(C.Clauses.UNIVERSAL);
        for (const p of C.Clauses.of(sp, { depth, rulesOff: r.rulesOff })) for (const k of p.covers || []) covers.add(k);
        const loose = r.events.filter(e => (e.by === g || e.who === g) && !covers.has(e.k)).map(e => e.k);
        if (loose.length) return `it caused ${json(loose)}, which its Behaviour line does not cover`;
        missedBack += back.filter(e => e.k === 'missed').length;
        return r.events.some(e => e.k === 'damaged' && e.who === g && e.cause.k === 'item') ? 'a bolt struck it' : null;
      },
    }));
    assert.ok(missedBack > 0, 'no bolt it sent back missed, so its missed was never seen');
  });

  test('shards follow the one shard rule on every tile of a map, and never cover a door, an exit, the entrance, a bench or a case', () => {
    const map = ['#########', "#.,E'X+b#", '#v.ks,..#', '#.......#', '#########'];
    for (let y = 1; y < 4; y++) for (let x = 1; x < 8; x++) {
      const s = Setup.room(1, { acc: 'T0', depth: 1, map, you: [7, 3], exhibits: [{ sp: 'g', mods: ['glass'], at: [x, y], mode: 'dormant', stats: { hp: 1, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }] });
      const a = s.actors[1], want = Cases.shardTile(s, x, y), before = s.dept.tiles.slice();
      C.Combat.hurt(s, a, 5, { k: 'attack', by: 'you', at: a.uid, chance: 75, roll: 1, raw: 5, pad: 0, how: { kind: 'melee' }, from: [x + 1, y] }, []);
      let changed = 0;
      for (let ty = 0; ty < map.length; ty++) for (let tx = 0; tx < map[0].length; tx++) {
        if (before[ty][tx] === s.dept.tiles[ty][tx]) continue;
        changed++;
        assert.ok(want && tx === want[0] && ty === want[1], `${x},${y}: the tile ${tx},${ty} changed`);
        assert.ok('.,'.includes(before[ty][tx]) && s.dept.tiles[ty][tx] === 'x', `${x},${y}: shards over '${before[ty][tx]}'`);
      }
      assert.equal(changed, want && before[want[1]][want[0]] !== 'x' ? 1 : 0, `${x},${y}`);
    }
  });
};
