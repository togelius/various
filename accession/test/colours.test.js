// The colour check (BUILD.md §7.2, §9.1, §11 M2): under normal vision and the Machado et
// al. (2009) simulations of protanopia, deuteranopia and tritanopia, the five reserved
// colours differ pairwise by CIEDE2000 ΔE ≥ 15, and each differs by ΔE ≥ 10 from every
// department's floor and wall colours. No reserved colour appears in a department palette:
// every department colour stands off every reserved colour by ΔE ≥ 10 (≥ 5 simulated).
// Every mark, glyph and pictogram (M3's noise rings, call marks, case glyphs, seal shapes and
// the rest, R30g) carries its meaning in one of those reserved colours and in its shape:
// marks.js names a reserved colour for each kind of mark and uses no other colour but black
// and white, every pictogram has a reserved colour and a shape of its own, and every icon the
// view model can name has a pictogram. The glyphs of what stands or lies on a tile sit on a
// dark backing, over which they stand 3:1 (WCAG) off every wall, floor and glass (§6.2).
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

  // §6.2: the glyphs of what stands or lies on a tile (a case's lock with its bars, its cracks,
  // what it holds or the empty frame of a loan; a staff door's lock; an identifying label; an
  // item) each sit on a dark backing, black or black at 45% at least, painted first under
  // every part of the glyph: a fill under every cell, a wider dark stroke under every line.
  // Over that backing laid on any department's wall, wall top, floor, second floor or glass,
  // each glyph's colour has WCAG contrast 3:1 or more, so a pale wall cannot hide it (M11's
  // wall top is #d6ccb2; the readable colour on it, unbacked, is 1.41:1).
  test('the glyphs of what stands or lies on a tile sit on a dark backing, and stand 3:1 off every wall, floor and glass over it', () => {
    const lum = hex => { const n = parseInt(hex.slice(1), 16); return [[n >> 16, 0.2126], [(n >> 8) & 255, 0.7152], [n & 255, 0.0722]].reduce((t, [v, k]) => { const c = v / 255; return t + k * (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); }, 0); };
    const darken = (hex, a) => '#' + [16, 8, 0].map(sh => Math.round(((parseInt(hex.slice(1), 16) >> sh) & 255) * (1 - a)).toString(16).padStart(2, '0')).join('');
    const ratio = (p, q) => { const x = lum(p), y = lum(q); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    // How dark a style is as a backing: its black's opacity, or 0 for any other colour.
    const dark = st => st === '#000000' ? 1 : (/^rgba\(0,\s*0,\s*0,\s*(0?\.\d+|1)\)$/.exec(st) || [0, 0]).map(Number)[1];
    function painter() {
      const ops = [];
      let segs = [], at = null;
      const c = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1,
        fillRect(x, y, w, h) { ops.push({ op: 'fill', style: this.fillStyle, x, y, w, h }); },
        strokeRect(x, y, w, h) { ops.push({ op: 'other', style: this.strokeStyle }); },
        beginPath() { segs = []; }, moveTo(x, y) { at = [x, y]; }, lineTo(x, y) { segs.push([at, [x, y]]); at = [x, y]; },
        stroke() { ops.push({ op: 'stroke', style: this.strokeStyle, width: this.lineWidth, segs: JSON.stringify(segs) }); },
        fill() { ops.push({ op: 'other', style: this.fillStyle }); }, fillText() { ops.push({ op: 'other', style: this.fillStyle }); },
        save() {}, restore() {}, rect() {}, clip() {}, setLineDash() {}, arc() {}, closePath() {}, measureText: () => ({ width: 0 }) };
      return { c, ops };
    }
    const reserved = new Set(Object.values(S));
    let glyphs = 0;
    const bad = [];
    for (const t of [32, 48, 40, 52]) {
      const v = { w: 20, h: 20, ring: new Uint8Array(400), marks: [], path: null, selection: null, selectedTile: null, actors: [], dept: 'M11',
        cases: [], staff: [], items: [], plaques: [{ x: 1, y: 9 }], surfaces: [], cues: { movedFrom: [], hit: [], broke: [], special: [] } };
      for (let grade = 1; grade <= 7; grade++) {
        v.cases.push({ x: grade, y: 1, glass: 2, hits: grade % 3, need: 3, lock: grade, st: 'shut', loan: grade === 2, holds: grade % 2 ? { uid: 'c' + grade, kind: 'curio', icon: 'curio' } : null, canOpen: false, num: '1.1.' + grade });
        v.staff.push({ x: grade, y: 4, grade, open: false });
      }
      v.items.push({ uid: 'p', x: 5, y: 7, icon: 'seal', kind: 'consumable', inCase: false, shape: 'star' }, { uid: 'q', x: 5, y: 7, icon: 'weapon', kind: 'weapon', inCase: false });
      const items = Marks.list(v, (x, y) => ({ x: x * t, y: y * t, w: t, h: t }), a => ({ x: a.x * t, y: a.y * t, w: t, h: t }), t, 900, 900, 900);
      const kinds = new Set();
      for (const d of items.filter(x => /^(lock|cracks|holds|loan|plaque|item):/.test(x.id))) {
        kinds.add(d.id.split(':')[0]);
        const { c, ops } = painter();
        d.paint(c);
        for (let i = 0; i < ops.length; i++) {
          const o = ops[i], under = ops.slice(0, i).filter(b => dark(b.style) >= 0.45);
          if (!reserved.has(o.style)) continue;
          glyphs++;
          let alpha = 1;
          if (o.op === 'fill') {
            const pts = [[o.x + o.w / 2, o.y + o.h / 2], [o.x + 1e-6, o.y + 1e-6], [o.x + o.w - 1e-6, o.y + 1e-6], [o.x + 1e-6, o.y + o.h - 1e-6], [o.x + o.w - 1e-6, o.y + o.h - 1e-6]];
            for (const [px, py] of pts) {
              const b = under.filter(q => q.op === 'fill' && px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
              if (!b.length) { bad.push(`${t}px ${d.id}: a ${o.style} cell at ${px.toFixed(1)},${py.toFixed(1)} has no dark backing`); break; }
              alpha = Math.min(alpha, Math.max(...b.map(q => dark(q.style))));
            }
          } else if (o.op === 'stroke') {
            const b = under.filter(q => q.op === 'stroke' && q.segs === o.segs && q.width >= o.width + 1);
            if (!b.length) bad.push(`${t}px ${d.id}: a ${o.style} line has no wider dark line under it`);
            else alpha = Math.max(...b.map(q => dark(q.style)));
          } else { bad.push(`${t}px ${d.id}: paints ${o.style} in a way this check cannot follow`); continue; }
          for (const [dk, dp] of Object.entries(P.dept)) for (const f of ['wall', 'wallTop', 'floor', 'floor2', 'glass']) {
            const r = ratio(o.style, darken(dp[f], alpha));
            if (r < 3) bad.push(`${t}px ${d.id}: ${o.style} over its backing on ${dk}.${f} is ${r.toFixed(2)}:1`);
          }
        }
      }
      assert.deepEqual([...kinds].sort(), ['cracks', 'holds', 'item', 'loan', 'lock', 'plaque'], `${t}px: every kind of tile glyph is drawn`);
    }
    const kindsBad = [...new Set(bad.map(m => m.replace(/:\d+,\d+.*?: /, ": ").replace(/ at [\d.,]+ /, " ").replace(/ on \w+\.\w+ is [\d.]+:1/, " too faint")))];
    assert.deepEqual(kindsBad, [], `${new Set(bad).size} problems, e.g. ${bad.slice(0, 3).join("; ")}`);
    assert.ok(glyphs > 1000, `${glyphs} glyph paints checked`);
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
