// The colour check (BUILD.md §7.2, §9.1, §11 M2): under normal vision and the Machado et
// al. (2009) simulations of protanopia, deuteranopia and tritanopia, the five reserved
// colours differ pairwise by CIEDE2000 ΔE ≥ 15, and each differs by ΔE ≥ 10 from every
// department's floor and wall colours. No reserved colour appears in a department palette:
// every department colour stands off every reserved colour by ΔE ≥ 10 (≥ 5 simulated).
// Every mark, glyph and pictogram (M3's noise rings, call marks, case glyphs, seal shapes and
// the rest, R30g) carries its meaning in one of those reserved colours and in its shape:
// marks.js names a reserved colour for each kind of mark and uses no other colour but black
// and white, every pictogram has a reserved colour and a shape of its own, and every icon the
// view model can name has a pictogram.
module.exports = ({ test, assert, root, path, fs, loadCore }) => {
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

  // The view's two shared files, run as the page runs them.
  const vmod = require('node:vm'), ctx = vmod.createContext({ ART: { palettes: { semantic: S } }, Math });
  for (const f of ['js/view/pictograms.js', 'js/view/marks.js']) vmod.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  const Marks = vmod.runInContext('Marks', ctx), Pictograms = vmod.runInContext('Pictograms', ctx);

  test('every kind of mark and glyph is drawn in a reserved colour, and marks.js uses no other colour but black and white', () => {
    const bad = Object.entries(Marks.COLOURS).filter(([, c]) => !names.includes(c));
    assert.deepEqual(bad, []);
    const src = fs.readFileSync(path.join(root, 'js/view/marks.js'), 'utf8');
    const literals = [...src.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map(m => m[0].toLowerCase());
    const neutral = l => l === '#ffffff' || l === '#000000' || /^rgba\(0,\s*0,\s*0,\s*0?\.\d+\)$/.test(l);
    assert.deepEqual(literals.filter(l => !neutral(l)), [], 'colours in marks.js that are not reserved, black or white');
    // Every reserved colour reached as S().<name> or through COLOURS is one of the five.
    for (const m of src.matchAll(/S\(\)\.(\w+)/g)) assert.ok(names.includes(m[1]), m[1]);
  });

  test('every pictogram has a reserved colour and a shape of its own', () => {
    const shapes = new Map();
    for (const id of Pictograms.ids) {
      assert.ok(names.includes(Pictograms.COLOUR[id]), `${id}: ${Pictograms.COLOUR[id]}`);
      const g = Pictograms.G[id];
      assert.ok(g.length === 8 && g.every(r => r.length === 8 && /^[x.]+$/.test(r)), `${id} is not 8×8`);
      const k = g.join('/');
      assert.ok(!shapes.has(k), `${id} has the shape of ${shapes.get(k)}`);
      shapes.set(k, id);
    }
  });

  test('every icon the view model can name has a pictogram: item kinds, seal shapes, statuses, surfaces, state glyphs and the case glyphs', () => {
    const C = loadCore(), R = C.Registry, need = new Set(['lock', 'glass', 'loan', 'reads', 'special', 'pip', 'pip_empty', 'seal', 'kit']);
    for (const k of ['weapon', 'garment', 'curio', 'instrument', 'kit']) need.add(k);
    for (const id of R.order('SEALS')) need.add('seal_' + R.SEALS[id].shape);
    for (const t of ['STATUSES', 'SURFACES']) for (const id of R.order(t)) need.add(R[t][id].icon);
    for (const g of Object.values(Marks.GLYPH)) need.add(g);
    const missing = [...need].filter(id => !Pictograms.G[id]);
    assert.deepEqual(missing, []);
    // The seals are told apart by shape: eight seals, eight shapes.
    assert.equal(new Set(R.order('SEALS').map(id => R.SEALS[id].shape)).size, R.order('SEALS').length);
  });

  test('every icon a label or the strip can show has a pictogram: exhibits, cases, staff doors, plaques for every kind, items and you, in the three departments', () => {
    const C = loadCore(), { Dept, Labels, Registry: R } = C, seen = new Set();
    const take = l => { if (!l) return; for (const i of l.stateIcons || []) seen.add(i); for (const p of l.pictos || []) seen.add(typeof p === 'string' ? p : p.icon); };
    for (const acc of ['S9', 'A4', 'M11']) for (const depth of [1, 4, 7]) {
      const s = Dept.create(depth * 7, acc, depth);
      for (const a of s.actors.slice(1)) take(Labels.of(s, a.uid));
      for (const it of s.items) take(Labels.ofItem(s, it.uid));
      for (const f of s.dept.fixtures) take(f.k === 'case' ? Labels.ofCase(s, f) : f.k === 'staff' ? Labels.ofStaffDoor(s, f) : Labels.ofPlaque(s, f));
      // A plaque for every kind, so every seal's pictogram is asked for.
      for (const ck of R.order('CONSUMABLES')) take(Labels.ofPlaque(s, { k: 'plaque', x: 0, y: 0, ck }));
      take(Labels.you(s)); take(Labels.strip(s));
    }
    for (const id of R.order('SEALS')) assert.ok(seen.has('seal_' + R.SEALS[id].shape), `no label shows seal_${R.SEALS[id].shape}`);
    assert.deepEqual([...seen].filter(id => !Pictograms.G[id]), [], 'icons a label shows with no pictogram');
  });
};
