// ACCESSION — statistics for tests, sims and reports (BUILD.md §10.3). Plain Node with
// floating point: it runs beside the deterministic core, never inside it, so it is
// required as a module, not loaded into tools/core-context.js.
'use strict';
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

  return { Z95, Z999, wilson };
})();
module.exports = Stats;
