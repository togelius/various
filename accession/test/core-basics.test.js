// Random streams, canonical state, hashing and the grid.
module.exports = ({ test, assert, loadCore }) => {
  const { Rng, State, Grid, Roles } = loadCore();

  test('every role has its numbers, interpolated between the depth anchors', () => {
    for (const r of Roles.ROLES) for (let d = 1; d <= 7; d++) {
      const s = Roles.stats(r, d);
      for (const k of ['hp', 'acc', 'eva', 'pad', 'dmin', 'dmax']) assert.ok(Number.isSafeInteger(s[k]), `${r} at depth ${d}: ${k}`);
      assert.ok(s.dmin <= s.dmax && s.hp > 0);
    }
    assert.equal(Roles.stats('fodder', 1).hp, 7);
    assert.equal(Roles.stats('fodder', 4).hp, 16);
    assert.equal(Roles.stats('fodder', 2).hp, 10, 'one third of the way from 7 to 16');
    assert.throws(() => Roles.stats('nobody', 1));
  });

  test('a stream is reproducible from the seed and its path', () => {
    const a = { seed: 42, rng: {} }, b = { seed: 42, rng: {} };
    const sa = Rng.stream(a, 'combat/you'), sb = Rng.stream(b, 'combat/you');
    for (let i = 0; i < 100; i++) assert.equal(sa.u32(), sb.u32());
    assert.deepEqual(a.rng, b.rng);
  });

  test('streams are independent: drawing from one does not move another', () => {
    const a = { seed: 7, rng: {} }, b = { seed: 7, rng: {} };
    Rng.stream(a, 'combat/M11.3.s1g2.4').u32();
    Rng.stream(a, 'combat/M11.3.s1g2.4').u32();
    assert.equal(Rng.stream(a, 'ai/you').u32(), Rng.stream(b, 'ai/you').u32());
  });

  test('a stream resumes exactly from its stored state', () => {
    const a = { seed: 3, rng: {} };
    const s = Rng.stream(a, 'loot');
    s.u32(); s.u32();
    const copy = State.clone(a);
    assert.equal(Rng.stream(a, 'loot').u32(), Rng.stream(copy, 'loot').u32());
  });

  test('d100 covers 1..100 and int covers its bounds', () => {
    const st = { seed: 9, rng: {} }, s = Rng.stream(st, 'x');
    let lo = 999, hi = -1;
    for (let i = 0; i < 20000; i++) { const r = s.d100(); lo = Math.min(lo, r); hi = Math.max(hi, r); }
    assert.equal(lo, 1); assert.equal(hi, 100);
    for (let i = 0; i < 1000; i++) { const r = s.int(3, 5); assert.ok(r >= 3 && r <= 5); }
  });

  test('canonical JSON sorts keys, so equal states hash equally', () => {
    assert.equal(State.canon({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
    assert.equal(State.hash({ b: 1, a: 2 }), State.hash({ a: 2, b: 1 }));
    assert.notEqual(State.hash({ a: 1 }), State.hash({ a: 2 }));
  });

  test('the plain-data check finds floats and NaN', () => {
    assert.equal(State.plainData({ a: [1, 2, { b: 3 }] }), null);
    assert.equal(State.plainData({ a: [1, 2.5] }), 'state.a[1]');
    assert.equal(State.plainData({ a: { b: NaN } }), 'state.a.b');
  });

  const map = { w: 7, h: 5, tiles: [
    '#######',
    '#..o..#',
    '#.....#',
    '#.v.#.#',
    '#######'] };

  test('line of sight is symmetric and blocked by columns but not glass', () => {
    assert.equal(Grid.los(map, 1, 1, 5, 1), false, 'column at (3,1)');
    assert.equal(Grid.los(map, 5, 1, 1, 1), false);
    assert.equal(Grid.los(map, 1, 3, 3, 3), true, 'vitrine passes sight');
    for (let y0 = 1; y0 < 4; y0++) for (let x0 = 1; x0 < 6; x0++) for (let y1 = 1; y1 < 4; y1++) for (let x1 = 1; x1 < 6; x1++)
      assert.equal(Grid.los(map, x0, y0, x1, y1), Grid.los(map, x1, y1, x0, y0), `asymmetric ${x0},${y0}-${x1},${y1}`);
  });

  test('a diagonal step may not cut past a tile you could not step onto', () => {
    assert.equal(Grid.canStep(map, 2, 2, 1), false, 'NE from (2,2) is the column itself');
    assert.equal(Grid.canStep(map, 2, 1, 3), false, 'SE from (2,1) to (3,2) cuts past the column at (3,1)');
    assert.equal(Grid.canStep(map, 4, 2, 7), false, 'NW from (4,2) to (3,1) is the column');
    assert.equal(Grid.canStep(map, 1, 2, 3), false, 'SE from (1,2) to (2,3) is the vitrine');
    assert.equal(Grid.canStep(map, 3, 2, 3), false, 'SE from (3,2) to (4,3) is the wall stub');
    assert.equal(Grid.canStep(map, 1, 1, 3), true);
  });

  test('walking distance goes round obstacles', () => {
    const d = Grid.distances(map, [[1, 1]], 20);
    assert.equal(d[1 * 7 + 5], 4, 'round the column');
    assert.equal(d[3 * 7 + 2], -1, 'the vitrine is never entered');
  });
};
