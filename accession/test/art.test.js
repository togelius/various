// The art check (BUILD.md §9.1, DESIGN.md §12.1): silhouettes are fixed by archetype, so a
// kiter looks like a kiter in any department. A sprite's outline is its alpha mask, every
// cell that is not '.'; every species and Centrepiece of one archetype, across all packs,
// uses a sprite with the same mask, and two archetypes never share one. Every species names
// a sprite that exists, 16×16 for each tile of its footprint.
module.exports = ({ test, assert, loadCore, root, fs, path }) => {
  const { Packs } = loadCore();
  const dir = path.join(root, 'art/sprites');
  // A sprite file: header lines start with '#'; "# species: ... (archetype)" or
  // "(archetype piece)" names the archetype it is drawn for, when it says.
  const read = name => {
    const file = path.join(dir, name + '.txt');
    if (!fs.existsSync(file)) return null;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const head = lines.find(l => /^#\s*species:/.test(l)), m = head && head.match(/\(([a-z_]+)(?: piece)?\)/);
    return { rows: lines.filter(l => l.trim() && !l.startsWith('#')).map(l => l.replace(/\s+$/, '')), archetype: m ? m[1] : null };
  };
  // Opaque exactly as js/view/sprites.js paints: 'g' (glass) or a key of the palette the
  // sprite is drawn with; '.' and ' ' are clear. Any other character is an error, so a
  // sprite cannot hide part of its outline behind a letter no palette has.
  const ART = JSON.parse(fs.readFileSync(path.join(root, 'art/palettes.json'), 'utf8'));
  const depts = Object.values(ART.dept), deptKeys = new Set(Object.keys(depts[0]).filter(k => k.length === 1 && depts.every(d => d[k])));
  const mask = (rows, name) => rows.map((r, y) => r.split('').map((c, x) => {
    if (c === '.' || c === ' ') return '.';
    if (c === 'g' || deptKeys.has(c)) return '#';
    throw new Error(`${name}: '${c}' at ${x},${y} is not in every department palette`);
  }).join('')).join('\n');
  const uses = [];
  for (const p of Packs.list()) for (const sp of [...p.species, ...(p.centrepiece ? [p.centrepiece] : [])])
    uses.push({ id: sp.id, sprite: sp.sprite, archetype: sp.archetype, size: sp.size || 1 });

  test('every species and Centrepiece has its sprite, 16×16 a tile', () => {
    assert.ok(uses.length > 0, 'no packs loaded');
    for (const u of uses) {
      const s = read(u.sprite);
      assert.ok(s, `${u.id}: no art/sprites/${u.sprite}.txt`);
      const n = 16 * u.size;
      assert.ok(s.rows.length === n && s.rows.every(r => r.length === n), `${u.id}: ${u.sprite} is not ${n}×${n}`);
    }
  });

  test('a sprite’s header names the archetype of every species that uses it', () => {
    for (const u of uses) {
      const s = read(u.sprite);
      if (s && s.archetype) assert.equal(s.archetype, u.archetype, `${u.id}: ${u.sprite}.txt is drawn for ${s.archetype}`);
    }
  });

  // Archetype -> sprite names: the packs' uses, plus sprites no pack names that say in their
  // header which archetype they belong to (the ensemble's certified copies).
  const byArchetype = new Map();
  const put = (a, name) => { if (!byArchetype.has(a)) byArchetype.set(a, new Set()); byArchetype.get(a).add(name); };
  for (const u of uses) put(u.archetype, u.sprite);
  const named = new Set(uses.map(u => u.sprite));
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) {
    const name = f.slice(0, -4), s = read(name);
    if (!named.has(name) && s.archetype) put(s.archetype, name);
  }

  test('species of one archetype share one outline, in any department', () => {
    const fails = [];
    for (const [a, names] of byArchetype) {
      const list = [...names].filter(n => read(n));
      for (const n of list.slice(1)) if (mask(read(n).rows, n) !== mask(read(list[0]).rows, list[0])) fails.push(`${a}: ${n} has not the outline of ${list[0]}`);
    }
    assert.deepEqual(fails, []);
  });

  test('no two archetypes share an outline', () => {
    const seen = new Map(), fails = [];
    for (const [a, names] of byArchetype) {
      const first = [...names].find(n => read(n));
      if (!first) continue;
      const k = mask(read(first).rows, first);
      if (seen.has(k)) fails.push(`${a} (${first}) has the outline of ${seen.get(k)}`); else seen.set(k, `${a} (${first})`);
    }
    assert.deepEqual(fails, []);
  });
};
