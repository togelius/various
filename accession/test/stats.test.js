// The statistics of §10.3 (tools/stats.js): Wilson and Newcombe against published worked
// values, the bootstrap deterministic and equal to an independent resampling on the core's
// own streams, and the pass rule.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const Stats = require(path.join(root, 'tools/stats.js'));
  const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} is not within ${tol} of ${want}`);

  test('Wilson matches Newcombe (1998), Table I, method 3', () => {
    // Newcombe, "Two-sided confidence intervals for the single proportion", Statistics in
    // Medicine 17, 857–872, Table I, method 3 (the score interval without continuity correction).
    for (const [k, n, lo, hi] of [[81, 263, 0.2553, 0.3662], [15, 148, 0.0624, 0.1605], [0, 20, 0, 0.1611], [1, 29, 0.0061, 0.1718]]) {
      const w = Stats.wilson(k, n);
      near(w.lo, lo, 0.00006, `${k}/${n} lower`); near(w.hi, hi, 0.00006, `${k}/${n} upper`);
    }
  });

  // Newcombe (1998), "Improved confidence intervals for the difference between binomial
  // proportions based on paired data", Statistics in Medicine 17, 2635–2650, Table III,
  // method 10, as (e, f, g, h) = (a, b, c, d) and its 95% interval to four places. One
  // printed limit (1, 97, 1, 1: 0.8736) is 0.000072 below the exact value, which the paper's
  // own method 8 prints as 0.8737 for the same table (method 10 equals method 8 there, since
  // ad < bc); the tolerance of 0.0001 covers that rounding.
  const TABLE_III = [
    [36, 12, 2, 0, 0.0569, 0.3404], [20, 12, 2, 16, 0.0562, 0.3292], [18, 12, 2, 18, 0.0562, 0.3290],
    [36, 14, 0, 0, 0.1528, 0.4167], [35, 14, 0, 1, 0.1461, 0.4175], [18, 14, 0, 18, 0.1441, 0.3963],
    [2, 97, 1, 0, 0.8721, 0.9854], [1, 97, 1, 1, 0.8736, 0.9850], [0, 29, 1, 0, 0.6666, 0.9882],
    [2, 98, 0, 0, 0.9178, 0.9945], [1, 98, 0, 1, 0.9171, 0.9916], [0, 30, 0, 0, 0.8395, 1.0],
    [54, 0, 0, 0, -0.0664, 0.0664], [53, 0, 0, 1, -0.0729, 0.0729], [30, 0, 0, 24, -0.0358, 0.0358],
    [29, 0, 0, 25, -0.0354, 0.0354], [28, 0, 0, 26, -0.0352, 0.0352], [27, 0, 0, 27, -0.0351, 0.0351],
  ];

  test('Newcombe method 10 matches the paired paper, Table III, on all 18 tables', () => {
    for (const [a, b, c, d, lo, hi] of TABLE_III) {
      const r = Stats.newcombe({ a, b, c, d }), n = a + b + c + d;
      assert.equal(r.diff, (b - c) / n, `diff for ${[a, b, c, d]}`);
      near(r.lo, lo, 0.0001, `${[a, b, c, d]} lower`); near(r.hi, hi, 0.0001, `${[a, b, c, d]} upper`);
      assert.ok(r.lo <= r.diff && r.diff <= r.hi && r.lo >= -1 && r.hi <= 1);
      // A and B swapped: the interval is mirrored.
      const m = Stats.newcombe({ a, b: c, c: b, d });
      near(m.lo, -r.hi, 1e-12, 'mirrored lower'); near(m.hi, -r.lo, 1e-12, 'mirrored upper');
    }
    // Method 10's continuity correction to φ changes the interval only when ad > bc: in
    // Table III the e : h split moves the limits from method 8's (20, 12, 2, 16 → 0.0618).
    assert.ok(Math.abs(Stats.newcombe({ a: 20, b: 12, c: 2, d: 16 }).lo - 0.0618) > 0.005);
    assert.throws(() => Stats.newcombe({ a: 1, b: 2, c: 3 }), /whole number of pairs/);
    assert.throws(() => Stats.newcombe({ a: 0, b: 0, c: 0, d: 0 }), /at least one pair/);
    assert.throws(() => Stats.newcombe({ a: 1.5, b: 0, c: 0, d: 0 }), /whole number/);
  });

  test('pairs counts the 2×2 table, and lowerRate passes only a real, clear difference', () => {
    assert.deepEqual(Stats.pairs([1, 1, 0, 0, 1], [1, 0, 1, 0, 0]), { a: 1, b: 2, c: 1, d: 1 });
    assert.throws(() => Stats.pairs([1], [1, 0]), /same length/);
    const none = Stats.lowerRate({ a: 0, b: 0, c: 0, d: 200 });
    assert.equal(none.pass, false); assert.match(none.reason, /neither ever had the outcome/);
    const clear = Stats.lowerRate({ a: 10, b: 60, c: 5, d: 125 });
    assert.equal(clear.pass, true, clear.reason); assert.ok(clear.lo > 0);
    const unclear = Stats.lowerRate({ a: 0, b: 3, c: 1, d: 196 });
    assert.equal(unclear.pass, false); assert.match(unclear.reason, /includes zero/);
    const worse = Stats.lowerRate({ a: 0, b: 1, c: 30, d: 169 });
    assert.equal(worse.pass, false); assert.match(worse.reason, /not lower/);
  });

  test("the resampling generator is the core's stream, draw for draw", () => {
    const C = loadCore();
    for (const [seed, p] of [[1, 'bootstrap'], [20261023, 'bootstrap/plodder/hpLost'], [7, 'x']]) {
      const fast = Stats.draws(seed, p), core = C.Rng.stream({ seed, rng: {} }, p);
      for (let i = 0; i < 10000; i++) assert.equal(fast(), core.u32(), `${seed}/${p} draw ${i}`);
    }
  });

  test('the bootstrap is deterministic and equals an independent resampling on Rng', () => {
    const C = loadCore();
    const diffs = [3, -1, 4, 1, -5, 9, 2, -6, 5, 3, -5, 8, 9, -7, 9];
    const a = Stats.bootstrapMean(diffs, { n: 2000, seed: 4, path: 'bootstrap/test' });
    assert.deepEqual(Stats.bootstrapMean(diffs, { n: 2000, seed: 4, path: 'bootstrap/test' }), a, 'the same seed and path give the same interval');
    // The oracle: 2,000 resamples drawn with Rng.stream's int on the same holder and path,
    // their means sorted, the 50th from each end (⌊2000 × 5 / 200⌋ = 50).
    const r = C.Rng.stream({ seed: 4, rng: {} }, 'bootstrap/test'), means = [];
    for (let k = 0; k < 2000; k++) { let s = 0; for (let i = 0; i < diffs.length; i++) s += diffs[r.int(0, diffs.length - 1)]; means.push(s / diffs.length); }
    means.sort((x, y) => x - y);
    assert.equal(a.lo, means[50]); assert.equal(a.hi, means[2000 - 1 - 50]);
    assert.equal(a.mean, diffs.reduce((s, v) => s + v, 0) / diffs.length);
    assert.equal(a.resamples, 2000); assert.equal(a.level, 95);
    const other = Stats.bootstrapMean(diffs, { n: 2000, seed: 5, path: 'bootstrap/test' });
    assert.ok(other.lo !== a.lo || other.hi !== a.hi, 'another seed resamples differently');
    // A constant difference has a zero-width interval at that value; the default is 10,000.
    const flat = Stats.bootstrapMean([2, 2, 2, 2]);
    assert.deepEqual([flat.mean, flat.lo, flat.hi, flat.resamples, flat.seed, flat.path], [2, 2, 2, 10000, 1, 'bootstrap']);
    assert.throws(() => Stats.bootstrapMean([]), /at least one/);
    assert.throws(() => Stats.bootstrapMean([1, NaN]), /finite number/);
    assert.throws(() => Stats.bootstrapMean([1], { level: 0.95 }), /whole percentage/);
  });

  test('the ratio of sums and its bootstrap', () => {
    const xs = [10, 12, 8, 15, 9, 11, 14, 7], ys = [6, 9, 7, 8, 5, 8, 9, 6];
    const r = Stats.bootstrapRatio(xs, ys, { n: 3000 });
    assert.equal(r.ratio, 58 / 86); assert.equal(r.sumA, 86); assert.equal(r.sumB, 58);
    assert.ok(r.lo <= r.ratio && r.ratio <= r.hi && r.lo > 0.5 && r.hi < 0.85, JSON.stringify(r));
    assert.deepEqual(Stats.bootstrapRatio(xs, ys, { n: 3000 }), r);
    // A's total zero: no ratio. In resamples, B worse without bound is infinite, and both
    // zero counts as 1 (no difference).
    const z = Stats.bootstrapRatio([0, 0, 0], [0, 1, 0], { n: 500 });
    assert.equal(z.ratio, null); assert.equal(z.hi, Infinity); assert.equal(z.lo, 1);
    assert.throws(() => Stats.bootstrapRatio([1, 2], [1]), /same length/);
  });

  test('the pass rule: the point estimate meets the margin and the interval excludes zero', () => {
    assert.equal(Stats.margin({ ratio: 0.6, lo: -4, hi: -1, margin: 0.9 }), true);
    assert.equal(Stats.margin({ ratio: 0.9, lo: -4, hi: -1, margin: 0.9 }), true, 'equal to the margin meets it');
    assert.equal(Stats.margin({ ratio: 0.6, lo: -4, hi: 0, margin: 0.9 }), false, 'an interval touching zero');
    assert.equal(Stats.margin({ ratio: 0.6, lo: -4, hi: 2, margin: 0.9 }), false);
    assert.equal(Stats.margin({ ratio: 0.95, lo: -4, hi: -1, margin: 0.9 }), false);
    assert.equal(Stats.margin({ ratio: null, lo: -4, hi: -1, margin: 0.9 }), false);
    assert.equal(Stats.margin({ ratio: 2.5, lo: 1, hi: 3, margin: 2, at: 'least' }), true);
    assert.equal(Stats.margin({ ratio: 1.5, lo: 1, hi: 3, margin: 2, at: 'least' }), false);
    assert.throws(() => Stats.margin({ ratio: 1 }), /needs/);
    assert.throws(() => Stats.margin({ ratio: 1, lo: 0, hi: 1, margin: 1, at: 'below' }), /'most' or 'least'/);
  });

  test('compare reports the ratio and the paired difference from the same resamples, with the verdict in words', () => {
    const xs = [], ys = [];
    for (let i = 0; i < 200; i++) { xs.push(10 + (i * 7) % 13); ys.push(6 + (i * 5) % 11); }
    const opts = { n: 4000, seed: 3, path: 'bootstrap/compare', margin: 0.9 };
    const c = Stats.compare(xs, ys, opts), r = Stats.bootstrapRatio(xs, ys, opts), m = Stats.bootstrapMean(xs.map((x, i) => ys[i] - x), opts);
    assert.deepEqual([c.ratio, c.ratioLo, c.ratioHi, c.mean, c.lo, c.hi], [r.ratio, r.lo, r.hi, m.mean, m.lo, m.hi]);
    assert.equal(c.pass, true); assert.match(c.reason, /meets the margin, and the interval of the per-seed difference excludes zero/);
    assert.deepEqual(Stats.compare(xs, ys, opts), c);
    const tight = Stats.compare(xs, ys, Object.assign({}, opts, { margin: 0.5 }));
    assert.equal(tight.pass, false); assert.match(tight.reason, /not at most the margin/);
    const same = Stats.compare(xs, xs.slice(), Object.assign({}, opts, { margin: 1 }));
    assert.equal(same.pass, false); assert.match(same.reason, /includes zero/);
    assert.equal(Stats.compare(xs, ys, { n: 100 }).pass, null, 'no margin, no verdict');
    for (const v of [c, tight, same]) assert.doesNotMatch(v.reason, /undefined|NaN|\[object/);
  });
};
