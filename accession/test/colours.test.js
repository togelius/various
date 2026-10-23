// The colour check (BUILD.md §7.2, §9.1, §11 M2): under normal vision and the Machado et
// al. (2009) simulations of protanopia, deuteranopia and tritanopia, the five reserved
// colours differ pairwise by CIEDE2000 ΔE ≥ 15, and each differs by ΔE ≥ 10 from every
// department's floor and wall colours. No reserved colour appears in a department palette:
// every department colour stands off every reserved colour by ΔE ≥ 10 (≥ 5 simulated).
module.exports = ({ test, assert, root, path }) => {
  const C = require(path.join(root, 'tools/colour.js'));
  const P = require(path.join(root, 'art/palettes.json'));
  const S = P.semantic, names = Object.keys(S);

  test('the colour-difference code matches the published CIEDE2000 test pairs', () => {
    const pairs = [[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441], [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082]];
    for (const [a, b, e] of pairs) assert.ok(Math.abs(C.deltaE2000(a, b) - e) < 1e-4, `${C.deltaE2000(a, b)} vs ${e}`);
  });

  test('the reserved colours stay apart under every simulation', () => {
    const fails = [];
    for (const k of C.KINDS) for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const d = C.deltaE2000(C.lab(S[names[i]], k), C.lab(S[names[j]], k));
      if (d < 15) fails.push(`${k}: ${names[i]}/${names[j]} ΔE ${d.toFixed(1)}`);
    }
    assert.deepEqual(fails, []);
  });

  test('the reserved colours stand off every floor and wall', () => {
    const fails = [];
    for (const k of C.KINDS) for (const n of names) for (const [dk, d] of Object.entries(P.dept)) for (const f of ['wall', 'wallTop', 'floor', 'floor2']) {
      const e = C.deltaE2000(C.lab(S[n], k), C.lab(d[f], k));
      if (e < 10) fails.push(`${k}: ${n} vs ${dk}.${f} ΔE ${e.toFixed(1)}`);
    }
    assert.deepEqual(fails, []);
  });

  // §9.1 "never appears", read perceptually: not merely a different hex, but a colour no one
  // would take for the reserved one. Every hex entry of every department palette counts,
  // sprite ramps and accents as well as walls and floors. The player palette is exempt: the
  // visitor is meant to be player-coloured.
  test('no department palette comes near a reserved colour', () => {
    const fails = [];
    for (const k of C.KINDS) for (const n of names) for (const [dk, d] of Object.entries(P.dept)) for (const [key, v] of Object.entries(d)) {
      if (typeof v !== 'string' || !v.startsWith('#')) continue;
      const e = C.deltaE2000(C.lab(S[n], k), C.lab(v, k)), min = k === 'normal' ? 10 : 5;
      if (e < min) fails.push(`${k}: ${n} vs ${dk}.${key} ${v} ΔE ${e.toFixed(1)}`);
    }
    assert.deepEqual(fails, []);
  });
};
