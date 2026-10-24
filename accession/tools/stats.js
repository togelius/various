// ACCESSION — statistics for tests, sims and reports (BUILD.md §10.3). Plain Node with
// floating point: it runs beside the deterministic core, never inside it, so it is
// required as a module, not loaded into tools/core-context.js.
//
//   wilson(k, n, z?) → {p, lo, hi}                       a single rate
//   newcombe({a, b, c, d}, z?) → {diff, lo, hi, n, …}     a paired binary difference
//   pairs(as, bs) → {a, b, c, d}                          the paired 2×2 table of two outcome lists
//   lowerRate(counts, z?) → {diff, lo, hi, pass, reason}  "B's rate is lower than A's" (Newcombe)
//   bootstrapMean(diffs, {n, seed, path, level}) → {mean, lo, hi, …}
//   bootstrapRatio(xs, ys, {n, seed, path, level}) → {ratio, lo, hi, …}
//   margin({ratio, lo, hi, margin, at?}) → pass           the pass rule (§10.3)
//   compare(xs, ys, {margin, at, n, seed, path, level}) → everything a ratio margin reports
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

const Stats = (() => {
  // Two-sided normal quantiles: 95% and 99.9%.
  const Z95 = 1.9599639845400536, Z999 = 3.2905267314919255;

  // The Wilson score interval for k successes in n trials (§10.3, "a single rate"), at the
  // two-sided normal quantile z (Z95 if omitted):
  //   centre = (k + z²/2) / (n + z²),   half-width = z · √(k(n − k)/n + z²/4) / (n + z²)
  // Returns {p, lo, hi}, where p = k/n. lo is exactly 0 when k = 0 and hi exactly 1 when
  // k = n.
  function wilson(k, n, z) {
    if (z === undefined) z = Z95;
    if (!Number.isInteger(n) || n < 1) throw new Error(`Stats.wilson: n must be a positive integer, not ${n}`);
    if (!Number.isInteger(k) || k < 0 || k > n) throw new Error(`Stats.wilson: k must be an integer from 0 to n = ${n}, not ${k}`);
    if (!(typeof z === 'number' && z > 0 && Number.isFinite(z))) throw new Error(`Stats.wilson: z must be a positive number, not ${z}`);
    const z2 = z * z, den = n + z2, centre = (k + z2 / 2) / den, half = z * Math.sqrt(k * (n - k) / n + z2 / 4) / den;
    return { p: k / n, lo: k === 0 ? 0 : Math.max(0, centre - half), hi: k === n ? 1 : Math.min(1, centre + half) };
  }

  const count = (v, what) => { if (!Number.isInteger(v) || v < 0) throw new Error(`Stats.${what} must be a whole number of pairs, not ${v}`); return v; };

  // Newcombe's interval for the difference between two proportions measured on the same
  // pairs (§10.3, "a paired binary difference"): Newcombe (1998), "Improved confidence
  // intervals for the difference between binomial proportions based on paired data",
  // Statistics in Medicine 17, 2635–2650, method 10. The pairs are counted in a 2×2 table:
  //   a: yes for A and yes for B     b: yes for A, no for B
  //   c: no for A, yes for B         d: no for A and no for B
  // so A's rate is (a + b)/n, B's is (a + c)/n, and the difference is diff = (b − c)/n
  // (A's rate minus B's). With Wilson intervals (l1, u1) for A's rate p1 and (l2, u2) for
  // B's p2 at z, and φ the correlation of the table,
  //   lo = diff − √((p1 − l1)² − 2φ(p1 − l1)(u2 − p2) + (u2 − p2)²)
  //   hi = diff + √((u1 − p1)² − 2φ(u1 − p1)(p2 − l2) + (p2 − l2)²)
  // where φ = (ad − bc)/√((a+b)(c+d)(a+c)(b+d)), its numerator replaced by
  // max(ad − bc − n/2, 0) when ad > bc (method 10's continuity correction), and φ = 0 when
  // any of the four margins is empty.
  function newcombe(t, z) {
    if (!t || typeof t !== 'object') throw new Error('Stats.newcombe: needs the paired counts {a, b, c, d}');
    if (z === undefined) z = Z95;
    const a = count(t.a, 'newcombe: a'), b = count(t.b, 'newcombe: b'), c = count(t.c, 'newcombe: c'), d = count(t.d, 'newcombe: d');
    const n = a + b + c + d;
    if (n < 1) throw new Error('Stats.newcombe: needs at least one pair');
    const p1 = (a + b) / n, p2 = (a + c) / n, w1 = wilson(a + b, n, z), w2 = wilson(a + c, n, z);
    const den = (a + b) * (c + d) * (a + c) * (b + d);
    let num = a * d - b * c;
    if (num > 0) num = Math.max(num - n / 2, 0);
    const phi = den === 0 ? 0 : num / Math.sqrt(den);
    const dl1 = p1 - w1.lo, du1 = w1.hi - p1, dl2 = p2 - w2.lo, du2 = w2.hi - p2;
    const diff = (b - c) / n;
    const lo = diff - Math.sqrt(Math.max(0, dl1 * dl1 - 2 * phi * dl1 * du2 + du2 * du2));
    const hi = diff + Math.sqrt(Math.max(0, du1 * du1 - 2 * phi * du1 * dl2 + dl2 * dl2));
    return { diff, lo: Math.max(-1, lo), hi: Math.min(1, hi), n, a, b, c, d, pA: p1, pB: p2, phi };
  }

  // The paired 2×2 table of two outcome lists, A's and B's, one entry a pair (truthy: yes).
  function pairs(as, bs) {
    if (!Array.isArray(as) || !Array.isArray(bs) || as.length !== bs.length) throw new Error('Stats.pairs: needs two lists of the same length');
    const t = { a: 0, b: 0, c: 0, d: 0 };
    for (let i = 0; i < as.length; i++) {
      const x = !!as[i], y = !!bs[i];
      if (x && y) t.a++; else if (x) t.b++; else if (y) t.c++; else t.d++;
    }
    return t;
  }

  // Is B's rate lower than A's (§10.3: the Night Watchman's "death rate lower")? It passes
  // when A's rate minus B's is above zero and its Newcombe interval excludes zero (lo > 0).
  // When neither ever had the outcome (a + b + c = 0) there is nothing to compare: that is a
  // finding, not a pass (the plan's D6.2), and reason says so.
  function lowerRate(t, z) {
    const r = newcombe(t, z);
    let pass = false, reason;
    if (r.a + r.b + r.c === 0) reason = 'neither ever had the outcome, so the comparison shows nothing';
    else if (r.diff <= 0) reason = "B's rate is not lower than A's";
    else if (r.lo <= 0) reason = "B's rate is lower, but the interval of the difference includes zero";
    else { pass = true; reason = "B's rate is lower, and the interval of the difference excludes zero"; }
    return Object.assign(r, { pass, reason });
  }

  // The resampling stream: the core's Rng derivation (js/core/rng.js, loaded once into a
  // bare vm context), hash32(seed + '/' + path) then mulberry32, on a holder of its own, so a
  // bootstrap with the same seed and path draws the same resamples on every run and in every
  // engine. The draws are made by `draws`, mulberry32 written out once more here for speed
  // (a bootstrap makes millions); test/stats.test.js holds it to Rng.stream's u32, draw for
  // draw.
  let Rng = null;
  const core = () => Rng || (Rng = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js/core/rng.js'), 'utf8') + '\nRng;', {}, { filename: 'js/core/rng.js' }));
  function draws(seed, p) {
    let a = core().hash32(seed + '/' + p);
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  const stream = (seed, p) => core().stream({ seed, rng: {} }, p);
  const BOOT = { n: 10000, seed: 1, path: 'bootstrap', level: 95 };
  function bootOpts(o, what) {
    o = Object.assign({}, BOOT, o || {});
    if (!Number.isInteger(o.n) || o.n < 1) throw new Error(`Stats.${what}: n must be a positive whole number of resamples, not ${o.n}`);
    if (!Number.isInteger(o.level) || o.level < 1 || o.level > 99) throw new Error(`Stats.${what}: level is a whole percentage from 1 to 99, not ${o.level}`);
    if (typeof o.path !== 'string' || !o.path) throw new Error(`Stats.${what}: path names the resampling stream`);
    return o;
  }
  const finite = (xs, what) => { for (const v of xs) if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Stats.${what}: every value must be a finite number, not ${v}`); };
  // The percentile limits of n sorted resample statistics at a level (a whole percentage):
  // the k-th from each end, k = ⌊n(100 − level)/200⌋ (250 of 10,000 at 95%).
  function limits(sorted, level) {
    const k = Math.floor(sorted.length * (100 - level) / 200);
    return { lo: sorted[k], hi: sorted[sorted.length - 1 - k] };
  }
  // n resamples of `len` indices, drawn with replacement on the stream (u32 mod len, as
  // Rng's int draws); each(idx, k) gets them, in order.
  function resample(len, o, each) {
    const u32 = draws(o.seed, o.path), idx = new Int32Array(len);
    for (let k = 0; k < o.n; k++) {
      for (let i = 0; i < len; i++) idx[i] = u32() % len;
      each(idx, k);
    }
  }
  // The ratio of one resample: ΣB/ΣA, infinite when only A's total is zero, 1 when both are.
  const ratioOf = (a, b) => a !== 0 ? b / a : b !== 0 ? Infinity : 1;

  // The mean of per-seed paired differences with its percentile-bootstrap interval (§10.3,
  // "a continuous paired quantity"): opts.n resamples (10,000) of the seeds, with
  // replacement, on the stream opts.path (default 'bootstrap') of opts.seed (default 1).
  function bootstrapMean(diffs, opts) {
    if (!Array.isArray(diffs) || !diffs.length) throw new Error('Stats.bootstrapMean: needs at least one difference');
    finite(diffs, 'bootstrapMean');
    const o = bootOpts(opts, 'bootstrapMean'), L = diffs.length, means = new Float64Array(o.n);
    let total = 0;
    for (const v of diffs) total += v;
    resample(L, o, (idx, k) => { let s = 0; for (let i = 0; i < L; i++) s += diffs[idx[i]]; means[k] = s / L; });
    means.sort();
    return Object.assign({ mean: total / L }, limits(means, o.level), { n: L, resamples: o.n, level: o.level, seed: o.seed, path: o.path });
  }

  // A ratio of sums over seeds, ΣB / ΣA (B's total over A's: counterplay over naive), with
  // the same bootstrap (§10.3, "a ratio margin"), resampling the seeds as pairs. ratio is
  // null when A's total is zero. In a resample whose A total is zero, the ratio counts as
  // infinite if B's total is not (B is worse without bound), and as 1 if both are zero.
  function bootstrapRatio(xs, ys, opts) {
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || !xs.length) throw new Error('Stats.bootstrapRatio: needs two lists of the same length, one value a seed');
    finite(xs, 'bootstrapRatio'); finite(ys, 'bootstrapRatio');
    const o = bootOpts(opts, 'bootstrapRatio'), L = xs.length, ratios = new Float64Array(o.n);
    let sx = 0, sy = 0;
    for (let i = 0; i < L; i++) { sx += xs[i]; sy += ys[i]; }
    resample(L, o, (idx, k) => {
      let a = 0, b = 0;
      for (let i = 0; i < L; i++) { a += xs[idx[i]]; b += ys[idx[i]]; }
      ratios[k] = ratioOf(a, b);
    });
    ratios.sort();
    return Object.assign({ ratio: sx === 0 ? null : sy / sx, sumA: sx, sumB: sy }, limits(ratios, o.level), { n: L, resamples: o.n, level: o.level, seed: o.seed, path: o.path });
  }

  // The pass rule (§10.3): the point estimate meets the margin, and the interval [lo, hi]
  // of the per-seed paired difference excludes zero. at 'most' (the default) means ratio ≤
  // margin ("HP lost ≤ 90%"); 'least' means ratio ≥ margin (M4's "blind ÷ aware ≥ 2"). A
  // ratio that does not exist (null) never passes.
  function margin(r) {
    if (!r || typeof r.margin !== 'number') throw new Error('Stats.margin: needs {ratio, lo, hi, margin}');
    const at = r.at || 'most';
    if (at !== 'most' && at !== 'least') throw new Error(`Stats.margin: at is 'most' or 'least', not ${at}`);
    if (r.ratio === null || r.ratio === undefined || !Number.isFinite(r.ratio)) return false;
    const meets = at === 'most' ? r.ratio <= r.margin : r.ratio >= r.margin;
    return meets && (r.lo > 0 || r.hi < 0);
  }

  // Everything a ratio margin reports, for A's values xs and B's ys, one pair a seed: the
  // totals, the ratio ΣB/ΣA with its interval, the mean of the differences B − A with its
  // interval (both from the same resamples), and whether it passes (margin's rule), with
  // the reason in words.
  function compare(xs, ys, opts) {
    opts = opts || {};
    if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || !xs.length) throw new Error('Stats.compare: needs two lists of the same length, one value a seed');
    finite(xs, 'compare'); finite(ys, 'compare');
    const o = bootOpts(opts, 'compare'), L = xs.length, ratios = new Float64Array(o.n), means = new Float64Array(o.n);
    let sx = 0, sy = 0;
    for (let i = 0; i < L; i++) { sx += xs[i]; sy += ys[i]; }
    resample(L, o, (idx, k) => {
      let a = 0, b = 0;
      for (let i = 0; i < L; i++) { a += xs[idx[i]]; b += ys[idx[i]]; }
      ratios[k] = ratioOf(a, b); means[k] = (b - a) / L;
    });
    ratios.sort(); means.sort();
    const r = limits(ratios, o.level), m = limits(means, o.level);
    const out = { n: L, sumA: sx, sumB: sy, ratio: sx === 0 ? null : sy / sx, ratioLo: r.lo, ratioHi: r.hi, mean: (sy - sx) / L, lo: m.lo, hi: m.hi,
      resamples: o.n, level: o.level, seed: o.seed, path: o.path, margin: opts.margin === undefined ? null : opts.margin, at: opts.at || 'most', pass: null, reason: null };
    if (out.margin !== null) {
      out.pass = margin({ ratio: out.ratio, lo: out.lo, hi: out.hi, margin: out.margin, at: out.at });
      const meets = out.ratio !== null && (out.at === 'most' ? out.ratio <= out.margin : out.ratio >= out.margin);
      if (out.ratio === null) out.reason = "A's total is zero, so there is no ratio to compare";
      else if (!meets) out.reason = `the ratio is not ${out.at === 'most' ? 'at most' : 'at least'} the margin`;
      else if (!(out.lo > 0 || out.hi < 0)) out.reason = 'the ratio meets the margin, but the interval of the per-seed difference includes zero';
      else out.reason = 'the ratio meets the margin, and the interval of the per-seed difference excludes zero';
    }
    return out;
  }

  return { Z95, Z999, BOOT, wilson, newcombe, pairs, lowerRate, bootstrapMean, bootstrapRatio, margin, compare, draws, stream };
})();
module.exports = Stats;
