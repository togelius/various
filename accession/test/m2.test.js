// M2: what the labels and the view model say (BUILD.md §8.1, §8.8, §6.1).
module.exports = ({ test, assert, loadCore }) => {
  const { Dept, Labels, ViewModel, Packs } = loadCore();

  // An independent count of the readout's numbers, roll by roll, in plain arithmetic.
  function expected(you, a) {
    const hit = (att, def) => Math.min(95, Math.max(10, 75 + 5 * (att.acc - def.eva)));
    const rolls = (att, def) => { const out = []; for (let r = att.dmin; r <= att.dmax; r++) out.push(Math.max(1, r - def.pad)); return out; };
    const t = rolls(a, you), m = rolls(you, a), sum = xs => xs.reduce((p, q) => p + q, 0), hp = Math.max(1, you.hp);
    return { toYou: hit(a, you), typical: Math.floor((200 * sum(t) + t.length * hp) / (2 * t.length * hp)), worst: Math.ceil(hp / Math.max(...t)),
      toIt: hit(you, a), need: Math.ceil(a.hp * m.length / sum(m)), surprise: Math.max(1, you.dmax - a.pad) };
  }

  test('the odds readout equals an independent count for every exhibit, depths 1–7', () => {
    let checked = 0;
    for (const acc of ['S9', 'A4', 'M11']) for (let depth = 1; depth <= 7; depth++) {
      const s = Dept.create(depth * 11, acc, depth), you = s.actors[0];
      for (const a of s.actors.slice(1)) {
        if (a.gone) continue;
        const l = Labels.of(s, a.uid), e = expected(you, a), nums = l.odds.join(' ').match(/\d+/g).map(Number);
        const want = [e.toYou, e.typical, e.worst, e.toIt, e.need].concat(a.mode !== 'hunting' ? [e.surprise] : []);
        assert.deepEqual(nums, want, `${acc} depth ${depth} ${a.uid}: ${l.odds.join(' ')}`);
        checked++;
      }
    }
    assert.ok(checked > 100, `only ${checked} exhibits checked`);
  });

  test('every exhibit in the packs has a title, tombstone, Behaviour line and paragraph', () => {
    for (const p of Packs.list()) for (const sp of [...p.species, p.centrepiece]) {
      assert.ok(sp.name && sp.tomb && sp.tomb.maker && sp.paragraph, `${sp.id} is missing label text`);
    }
  });

  test('the label reads "Come closer" beyond 2 tiles and the paragraph within 2', () => {
    const s = Dept.create(5, 'S9', 1), you = s.actors[0];
    for (const a of s.actors.slice(1)) {
      const d = Math.max(Math.abs(a.x - you.x), Math.abs(a.y - you.y)), l = Labels.of(s, a.uid);
      if (d <= 2) assert.ok(l.paragraph && !l.far); else assert.ok(!l.paragraph && /Come closer/.test(l.far));
    }
  });

  test('the view model lists only actors on visible tiles, and you', () => {
    const s = Dept.create(3, 'M11', 2), vm = ViewModel.derive(s, {});
    assert.equal(vm.actors[0].uid, 'you');
    for (const a of vm.actors.slice(1)) {
      let seen = false;
      for (let dy = 0; dy < a.size; dy++) for (let dx = 0; dx < a.size; dx++) if (vm.vis[(a.y + dy) * vm.w + a.x + dx] === 2) seen = true;
      assert.ok(seen, `${a.uid} is listed but not on a visible tile`);
    }
  });
};
