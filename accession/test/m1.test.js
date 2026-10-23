// M1: layouts. Every slice programme generates, validates and stays deterministic; the
// real fallback path is certified; curation is local to its room (design/layout.md §12.2);
// planted faults are caught and reported with their tiles.
module.exports = ({ test, assert, loadCore }) => {
  const { Layout, LCurate, LBuild, State, N } = loadCore();
  const PROGS = ['enfilade', 'case_labyrinth', 'sculpture_court'];
  const T = LBuild.T;

  test('60 seeds per programme pass every layout check, and each plan is plain data', () => {
    let reseeds = 0;
    for (const p of PROGS) for (let s = 1; s <= 60; s++) {
      const r = Layout.generate(p, 0, s);
      assert.equal(r.failed.length, 0, `${p} seed ${s}: ${r.failed.map(f => f.id + ' ' + f.why).join('; ')}\n${Layout.text(r.plan, r.failed.flatMap(f => f.tiles))}`);
      assert.equal(r.fallback, false, `${p} seed ${s} needed the fallback`);
      reseeds += r.attempt;
      assert.ok(r.plan.ltour > 0);
      assert.equal(State.plainData(r.plan), null, 'the plan is plain data');
      assert.ok(r.plan.viewTile && r.plan.lectern, 'a lectern and its viewing tile');
    }
    assert.ok(reseeds < 30, `${reseeds} reseeds in 180 plans`);
  });

  test('the certified fallback itself passes every check, and generate uses it when all attempts fail', () => {
    for (const p of PROGS) {
      const f = Layout.fallback(p, 0);
      assert.equal(f.failed.length, 0, `${p}: ${f.failed.map(x => x.id + ' ' + x.why).join('; ')}`);
      // Force every attempt to fail by blocking the exits; the fallback plan must be returned.
      const r = Layout.generate(p, 0, 7, { plant: { stage: 'afterCurate', fn: L => { for (const [x, y] of L.meta.exits) L.G.set(x, y, T.WALL); } } });
      assert.equal(r.fallback, true);
      assert.equal(State.hash(r.plan.tiles), State.hash(Layout.generate(p, 0, 7, { plant: { stage: 'afterCurate', fn: L => { for (const [x, y] of L.meta.exits) L.G.set(x, y, T.WALL); } } }).plan.tiles));
      assert.equal(r.failed.length, 0);
    }
  });

  test('the same seed gives the same plan; a different depth gives a different one', () => {
    for (const p of PROGS) {
      const a = Layout.generate(p, 0, 5, { acc: 'S9', depth: 2 }), b = Layout.generate(p, 0, 5, { acc: 'S9', depth: 2 });
      assert.equal(State.hash(a.plan), State.hash(b.plan));
      assert.notEqual(State.hash(a.plan), State.hash(Layout.generate(p, 0, 5, { acc: 'S9', depth: 3 }).plan));
    }
  });

  test('re-curating one room changes that room and no other', () => {
    for (const p of PROGS) {
      let compared = 0, changed = 0;
      for (let s = 1; s <= 12; s++) {
        const a = Layout.generate(p, 0, s);
        for (const target of a.plan.rooms.filter(r => r.role !== 'staff' && !r.tags.includes('filled'))) {
          const b = Layout.generate(p, 0, s, { perturbRoom: target.id });
          if (b.attempt !== a.attempt) continue;
          compared++;
          let mine = false;
          for (let y = 0; y < a.plan.h; y++) for (let x = 0; x < a.plan.w; x++) {
            const owner = a.plan.roomOf[y][x];
            if (a.plan.tiles[y][x] === b.plan.tiles[y][x]) continue;
            assert.equal(owner, target.id, `${p} seed ${s}: re-curating room ${target.id} changed (${x},${y}) in room ${owner}`);
            mine = true;
          }
          if (mine) changed++;
        }
      }
      assert.ok(compared >= 30, `${p}: only ${compared} rooms compared`);
      assert.ok(changed * 2 >= compared, `${p}: the perturbed room changed in only ${changed} of ${compared}, so the test has little power`);
    }
  });

  test('planted faults are caught, with the tiles at fault', () => {
    // A cut-off room: LV1 or its repair must handle it, and an unrepairable cut is reported.
    const blocked = Layout.attempt('enfilade', 0, 3, 'plant/a', { plant: { stage: 'afterCurate', fn: L => { for (const [x, y] of L.meta.exits) L.G.set(x, y, T.WALL); } } });
    const lv1 = blocked.failed.find(f => f.id === 'LV1');
    assert.ok(lv1 && lv1.tiles.length > 0, 'LV1 names the blocked exits');
    // A column two tiles in front of the Centrepiece makes a short arena loop.
    const col = Layout.attempt('sculpture_court', 0, 4, 'plant/b', { plant: { stage: 'afterCurate', fn: L => {
      const [x, y] = L.meta.cpl; L.G.set(x - 3, y, T.COL);
    } } });
    const lv8 = col.failed.find(f => f.id === 'LV8');
    assert.ok(lv8 && lv8.tiles.length > 0, 'LV8 names the block');
    const map = Layout.text({ tiles: col.L.G.rows() }, lv8.tiles);
    assert.ok(map.includes('!'));
    // A case on a gate cell. Museum plans almost never have gate cells (design/layout.md
    // §0.2), so the clause is tested directly: a planted fixture on a named gate is caught.
    const g = Layout.attempt('enfilade', 0, 6, 'plant/c');
    const LV10 = Layout.CHECKS.find(c => c[0] === 'LV10')[1];
    const W = g.L.G.W, floor = g.L.G.t.findIndex((c, i) => c === T.FLOOR && g.A.openMask[i]);
    g.L.G.t[floor] = T.VIT;
    const r = LV10(g.L, g.A, { gates: new Set([floor]) });
    assert.ok(r && /gate/.test(r.why) && r.tiles[0][0] === floor % W, 'LV10 names the gate tile');
  });

  test('the Intro repairs run and are logged', () => {
    let repaired = 0;
    for (let s = 1; s <= 20; s++) {
      const r = Layout.attempt('case_labyrinth', 0, s, 'plant/cut' + s, { plant: { stage: 'afterAspace', fn: L => {
        const room = L.rooms.find(q => q && q.role === 'section' && !q.tags.central);
        if (!room) return;
        for (const e of L.edges.filter(e => (e.a === room.id || e.b === room.id)).slice()) LBuild.closeEdge(L, e);
      } } });
      if (r.L.log.length) repaired++;
      assert.ok(!r.failed.some(f => f.id === 'LV1'), 'the cut room is reconnected');
    }
    assert.ok(repaired >= 15, `repairs ran in ${repaired} of 20`);
  });

  test('room numbers are unique and follow the tour', () => {
    const r = Layout.generate('enfilade', 0, 3);
    const nums = Layout.number(r.plan, 4), vals = Object.values(nums);
    assert.equal(new Set(vals).size, vals.length);
    assert.equal(nums[r.plan.tourOrder[0]], 401);
    assert.equal(nums[r.plan.rooms.find(x => x.role === 'centre').id], 400 + r.plan.tourOrder.length);
    assert.ok(r.plan.rooms.every(rm => rm.key && !rm.key.includes('.')), 'role keys have no dots');
  });

  test('the viewing tile is exactly VIEW_DISTANCE walking tiles from the Centrepiece', () => {
    for (const p of PROGS) for (let s = 1; s <= 10; s++) {
      const r = Layout.generate(p, 0, s);
      const L = { G: null, meta: { cpl: r.plan.cpl } };
      const G = LBuild.grid(r.plan.w, r.plan.h);
      r.plan.tiles.forEach((row, y) => { for (let x = 0; x < row.length; x++) G.set(x, y, row.charCodeAt(x)); });
      L.G = G;
      const [vx, vy] = r.plan.viewTile;
      assert.equal(LCurate.toFootprint(L)(vy * G.W + vx), N.VIEW_DISTANCE, `${p} seed ${s}`);
    }
  });
};
