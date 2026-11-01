// M1: layouts, re-accepted at layout version 3 (BUILD.md §5.5, §11). Every slice programme
// generates, validates and stays deterministic; the Intro takes its stamp, is INTRO_WIDTH wide
// and opens onward only at walk INTRO_DEPTH or more, across its cut; the real fallback path is
// certified, for each programme and each pack; curation is local to its room (design/layout.md
// §12.2); planted faults, a leaking cut among them, are caught and reported with their tiles.
module.exports = ({ test, assert, loadCore }) => {
  const { Layout, LCurate, LBuild, LStamp, LAnalyse, State, N, Packs } = loadCore();
  const PROGS = ['enfilade', 'case_labyrinth', 'sculpture_court'];
  const T = LBuild.T;
  const json = JSON.stringify;

  // An oracle written apart from the generator: 8-way walking distances over a plan's rows,
  // a diagonal only past two walkable tiles (Grid.canStep), staff doors walkable (a visitor of
  // their grade), and the tiles in `walls` never stepped on (design/layout.md §11.2: removed
  // from the walk; a diagonal may still pass between two of them that can be walked).
  const WALKS = '.,+EXbwS';
  function walkFrom(plan, x0, y0, walls) {
    const W = plan.w, H = plan.h, wall = new Set((walls || []).map(([x, y]) => y * W + x));
    const tile = (x, y) => x >= 0 && y >= 0 && x < W && y < H && WALKS.includes(plan.tiles[y][x]);
    const ok = (x, y) => tile(x, y) && !wall.has(y * W + x);
    const D = new Map([[y0 * W + x0, 0]]), q = [[x0, y0]];
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((!dx && !dy) || D.has(ny * W + nx) || !ok(nx, ny) || (dx && dy && (!tile(nx, y) || !tile(x, ny)))) continue;
        D.set(ny * W + nx, D.get(y * W + x) + 1); q.push([nx, ny]);
      }
    }
    return (x, y) => (D.has(y * W + x) ? D.get(y * W + x) : -1);
  }
  // The Intro's onward openings read from the plan's rows: walkable tiles of the wall ring
  // round its room, the entrance left out.
  function ringOpenings(plan) {
    const r = plan.rooms.find(q => q.role === 'intro'), out = [];
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) continue;
      if (WALKS.includes(plan.tiles[y][x]) && plan.tiles[y][x] !== 'E') out.push([x, y]);
    }
    return out;
  }
  // Everything version 3 promises of a plan's Intro, checked from its rows.
  function introHolds(plan, stamp, where) {
    const r = plan.rooms.find(q => q.role === 'intro'), I = plan.intro, [ex, ey] = plan.entrance;
    assert.equal(plan.pin, 3, where);
    assert.equal(LStamp.shape(I), null, `${where}: ${LStamp.shape(I)}`);
    assert.ok(I, `${where}: the Intro is stamped`);
    assert.equal(json([I.x0, I.y0, I.x1, I.y1]), json([r.x0, r.y0, r.x1, r.y1]), `${where}: plan.intro is the Intro's rectangle`);
    assert.equal(r.x1 - r.x0 + 1, N.INTRO_WIDTH, `${where}: the Intro is INTRO_WIDTH wide`);
    assert.ok(r.tags.includes('stamped') && r.tags.includes('filled'), `${where}: the Intro is tagged stamped and filled`);
    assert.equal(json([ex, ey >= r.y0 && ey <= r.y1]), json([r.x0 - 1, true]), `${where}: the entrance is in the Intro's west wall`);
    // Every floor tile of the Intro is its stamp's, row by row (curation leaves it alone).
    const rows = LStamp.rowsFor(stamp, ey - r.y0, r.y1 - ey);
    assert.ok(Array.isArray(rows), `${where}: ${rows}`);
    for (let y = r.y0; y <= r.y1; y++) {
      const line = stamp.map[rows[y - r.y0]];
      for (let x = r.x0; x <= r.x1; x++) {
        const ch = line[x - r.x0 + 1], e = Object.prototype.hasOwnProperty.call(stamp.legend, ch) ? stamp.legend[ch] : null;
        assert.equal(plan.tiles[y][x], e ? e.tile || (LStamp.TILES.includes(ch) ? ch : '.') : ch, `${where}: the Intro's tile ${x},${y}`);
      }
    }
    assert.equal(stamp.map[rows[ey - r.y0]][0], 'E', `${where}: the stamp's entrance row is on the entrance`);
    // Its onward openings, each at walk INTRO_DEPTH or more, and none reached with the cut walled.
    const ops = ringOpenings(plan), D = walkFrom(plan, ex, ey), Dz = walkFrom(plan, ex, ey, I.cut);
    assert.equal(json(I.openings), json(ops), `${where}: plan.intro.openings`);
    assert.ok(ops.length >= 2, `${where}: ${ops.length} onward opening tiles`);
    for (const [x, y] of ops) {
      assert.ok(D(x, y) >= N.INTRO_DEPTH, `${where}: the onward opening ${x},${y} is at walk ${D(x, y)}`);
      assert.equal(Dz(x, y), -1, `${where}: the onward opening ${x},${y} is reached without crossing the cut`);
      // It faces a tile of the Intro that can be walked: the stamp was written before it was made.
      const [ix, iy] = y < r.y0 ? [x, r.y0] : y > r.y1 ? [x, r.y1] : [x > r.x1 ? r.x1 : r.x0, y];
      assert.ok(WALKS.includes(plan.tiles[iy][ix]), `${where}: the onward opening ${x},${y} faces ${json(plan.tiles[iy][ix])} at ${ix},${iy}`);
    }
    return { ops, D };
  }

  test('60 seeds per programme pass every layout check at version 3, each plan plain data with its stamped Intro', () => {
    let reseeds = 0, beyond = 0;
    for (const p of PROGS) for (let s = 1; s <= 60; s++) {
      const r = Layout.generate(p, 0, s);
      assert.equal(r.failed.length, 0, `${p} seed ${s}: ${r.failed.map(f => f.id + ' ' + f.why).join('; ')}\n${Layout.text(r.plan, r.failed.flatMap(f => f.tiles))}`);
      assert.equal(r.fallback, false, `${p} seed ${s} needed the fallback`);
      reseeds += r.attempt;
      assert.ok(r.plan.ltour > 0);
      assert.equal(State.plainData(r.plan), null, 'the plan is plain data');
      assert.ok(r.plan.viewTile && r.plan.lectern, 'a lectern and its viewing tile');
      const { D } = introHolds(r.plan, LStamp.FIXTURE, `${p} seed ${s}`);
      // The Intro is not curated: its only lectern-free furniture is the stamp's, and the hall's
      // lectern is the plan's only one.
      const intro = r.plan.rooms.find(q => q.role === 'intro');
      assert.equal(r.plan.tiles.join('').split('l').length - 1, 1, `${p} seed ${s}: one lectern, the hall's`);
      for (let y = intro.y0; y <= intro.y1; y++) for (let x = intro.x0; x <= intro.x1; x++) if (D(x, y) > N.SAFE_ZONE) beyond++;
    }
    assert.ok(reseeds < 30, `${reseeds} reseeds in 180 plans`);
    assert.ok(beyond >= 180 * 40, `the Intros hold ${beyond} floor tiles beyond the safe zone in 180 plans`);
  });

  test('the certified fallback is certified for each programme and each pack, with its own stamp, and generate uses it when every attempt fails', () => {
    const block = { stage: 'afterCurate', fn: L => { for (const [x, y] of L.meta.exits) L.G.set(x, y, T.WALL); } };
    const names = [...PROGS.map(p => [p, p]), ...Packs.list().map(k => [k.acc, k.programme])];
    for (const k of Packs.list()) assert.ok(Object.prototype.hasOwnProperty.call(Layout.FALLBACK, k.acc), `${k.acc} has a certified fallback seed of its own`);
    for (const [name, p] of names) {
      const opts = name === p ? {} : { acc: name }, stamp = LStamp.of(opts);
      const f = Layout.fallback(p, 0, opts);
      assert.equal(f.failed.length, 0, `${name}: ${f.failed.map(x => x.id + ' ' + x.why).join('; ')}`);
      // Force every attempt to fail by blocking the exits; the fallback plan must be returned.
      const r = Layout.generate(p, 0, 7, Object.assign({ plant: block }, opts));
      assert.equal(r.fallback, true);
      assert.equal(r.failed.length, 0);
      assert.equal(json(r.plan.tiles), json(f.L.G.rows()), `${name}: generate's fallback is the certified one`);
      assert.equal(State.hash(r.plan.tiles), State.hash(Layout.generate(p, 0, 7, Object.assign({ plant: block }, opts)).plan.tiles));
      introHolds(r.plan, stamp, `${name}'s fallback`);
    }
    // A pack's fallback is its own plan, not its programme's.
    assert.notEqual(json(Layout.fallback('enfilade', 0, { acc: 'M11' }).L.G.rows()), json(Layout.fallback('enfilade', 0).L.G.rows()));
    // The fallback depends on its stamp: under a stamp whose cut leaks, every attempt fails and so
    // does the fallback, which is reported, not returned. So each pack is certified as itself.
    const leaky = Object.assign({}, LStamp.FIXTURE, { map: LStamp.FIXTURE.map.map((row, i) => i === 0 ? '#..............' : row) });
    assert.throws(() => Layout.generate('enfilade', 0, 3, { stamp: leaky }), /certified fallback for enfilade failed: LV4 the Intro's cut leaks/);
  });

  // A planted stamp is given to S.9 here, in a core of its own whose S.9 and A.4 have had their
  // own stamps (content/*-intro.js, D-STAMPS) taken away: S.9's departments' plans, and its
  // certified fallback, take the planted stamp; A.4's take the fixture. test/m4-intro.test.js
  // holds the packs' own stamps to the same. S.9's gallery list (D-PACKS) is taken away too,
  // since the planted stamp's exhibit is no species of S.9's, which population would refuse.
  test('a pack\'s own stamp is the Intro of its departments and of its certified fallback', () => {
    const X = loadCore();
    delete X.Packs.get('S9').intro; delete X.Packs.get('A4').intro; delete X.Packs.get('S9').galleries;
    const st = { map: ['#....|.........', '#....|...p.....', 'E....+....s....', '#....|...p.....', '#....|.........'],
      legend: { s: { sp: 'X.1' } }, stretch: [0, 4], cut: '+', invariants: [{ near: 's', k: 6 }] };
    assert.equal(X.LStamp.check(st), null);
    X.Packs.part('S9', 'intro', st);
    assert.equal(X.LStamp.of({ acc: 'S9' }), st);
    const prog = X.Packs.get('S9').programme, other = X.Packs.get('A4');
    for (let s = 1; s <= 4; s++) {
      const p = X.Layout.generate(prog, 0, s, { acc: 'S9', depth: 2 }).plan;
      introHolds(p, st, `S9 seed ${s}`);
      assert.equal(json(p.intro.marks.map(m => m.ch)), json(['s']), `S9 seed ${s}`);
      introHolds(X.Layout.generate(other.programme, 0, s, { acc: 'A4', depth: 2 }).plan, LStamp.FIXTURE, `A4 seed ${s}`);
    }
    // Through Dept.create: the department's Intro is the plan's, so the stamp's.
    const d = X.Dept.create(3, 'S9', 2), p = X.Layout.generate(prog, 0, 3, { acc: 'S9', depth: 2 }).plan, I = p.intro;
    for (let y = I.y0; y <= I.y1; y++) assert.equal(d.dept.tiles[y].slice(I.x0, I.x1 + 1), p.tiles[y].slice(I.x0, I.x1 + 1), `the department's Intro row ${y}`);
    // The pack's certified fallback takes its stamp too, and differs from the programme's.
    const block = { stage: 'afterCurate', fn: L => { for (const [x, y] of L.meta.exits) L.G.set(x, y, T.WALL); } };
    const f = X.Layout.generate(prog, 0, 7, { acc: 'S9', depth: 2, plant: block });
    assert.equal(f.fallback, true);
    introHolds(f.plan, st, 'S9\'s fallback');
    assert.notEqual(json(f.plan.tiles), json(X.Layout.fallback(prog, 0).L.G.rows()));
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

  // LV4's cut(Z), in every programme: a gap opened in the partition north of the door lets the
  // vestibule reach the onward openings without crossing it. LV4 names the leaking opening
  // nearest the vestibule first, and marks every one reached.
  test('a leaking cut is caught in every programme, naming the opening it leaks to, nearest first', () => {
    for (const p of PROGS) for (let s = 1; s <= 4; s++) {
      const gap = { stage: 'afterCurate', fn: L => { L.G.set(7, L.meta.entrance[1] - 1, T.FLOOR); } };
      const a = Layout.attempt(p, 0, s, 'plant/leak' + s, { plant: gap }), lv4 = a.failed.find(f => f.id === 'LV4');
      assert.ok(lv4, `${p} seed ${s}: LV4 fails`);
      assert.match(lv4.why, /^the Intro's cut leaks: its onward opening at \(\d+, \d+\) is reached from the entrance in \d+ steps without crossing it$/);
      // The oracle: every opening reached with the door walled, nearest first, then row-major.
      const plan = { w: a.L.G.W, h: a.L.G.H, tiles: a.L.G.rows() }, [ex, ey] = a.L.meta.entrance, Dz = walkFrom(plan, ex, ey, [[7, ey]]);
      const want = ringOpenings({ w: plan.w, h: plan.h, tiles: plan.tiles, rooms: [a.L.rooms.find(q => q && q.role === 'intro')] })
        .filter(([x, y]) => Dz(x, y) >= 0).sort((u, v) => Dz(u[0], u[1]) - Dz(v[0], v[1]) || u[1] - v[1] || u[0] - v[0]);
      assert.ok(want.length > 0);
      assert.equal(json(lv4.tiles), json(want), `${p} seed ${s}`);
      assert.ok(lv4.why.includes(`(${want[0][0]}, ${want[0][1]}) is reached from the entrance in ${Dz(want[0][0], want[0][1])} steps`), lv4.why);
      // Unplanted, the same attempt holds.
      assert.ok(!Layout.attempt(p, 0, s, 'plant/leak' + s).failed.some(f => f.id === 'LV4'), `${p} seed ${s} unplanted`);
    }
  });

  // A visitor may step diagonally between two tiles that can be walked (Grid.canStep), so a cut
  // or a near ball drawn on a diagonal of floor tiles is crossed without stepping on it: LV4
  // must remove those tiles from the walk, not make them walls a diagonal cannot pass.
  test('a cut or a near invariant drawn on a diagonal of floor does not hold: a walk passes between its tiles', () => {
    const diag = { map: ['#....z.........', '#.....z........', '#......z.......', 'E.......z......', '#........z.....', '#.........z....', '#..........z...'],
      legend: { z: {} }, stretch: [0, 6], cut: 'z', invariants: [] };
    const near = Object.assign({}, LStamp.FIXTURE, { legend: { n: {} }, invariants: [{ near: 'n', k: 0 }],
      map: ['#......|.n.....', '#......|..n....', '#......|...n...', 'E......+....n..', '#......|.....n.', '#......|......n', '#......|......n'] });
    assert.equal(LStamp.check(diag), null);
    assert.equal(LStamp.check(near), null);
    for (const p of PROGS) for (let s = 1; s <= 3; s++) {
      const a = Layout.attempt(p, 0, s, 'plant/diag' + s, { stamp: diag }), lv4 = a.failed.find(f => f.id === 'LV4');
      assert.ok(lv4 && /^the Intro's cut leaks: /.test(lv4.why), `${p} seed ${s}: ${json(a.failed)}`);
      // The oracle reaches the opening LV4 names without stepping on a tile of the cut.
      const plan = { w: a.L.G.W, h: a.L.G.H, tiles: a.L.G.rows() }, cut = a.L.meta.stamp.cut;
      assert.ok(cut.length >= 7);
      assert.ok(walkFrom(plan, ...a.L.meta.entrance, cut)(...lv4.tiles[0]) > 0, `${p} seed ${s}`);
    }
    const b = Layout.attempt('enfilade', 0, 1, 'plant/diag1', { stamp: near }), lv4 = b.failed.find(f => f.id === 'LV4');
    assert.ok(lv4 && /^a walk from the entrance reaches the Intro's onward opening at \(\d+, \d+\) without passing within 0 tiles of 'n'$/.test(lv4.why), json(b.failed));
  });

  test('an onward opening nearer than INTRO_DEPTH, a stamp that does not fit and a near invariant a walk can avoid each fail LV4', () => {
    // An archway opened in the Intro's south wall at x = 5, into the band room below it.
    const near = Layout.attempt('case_labyrinth', 0, 2, 'plant/near', { plant: { stage: 'afterCurate', fn: L => {
      const r = L.rooms.find(q => q && q.role === 'intro'); L.G.set(5, r.y1 + 1, T.ARCH);
    } } });
    const lv4 = near.failed.find(f => f.id === 'LV4'), intro = near.L.rooms.find(q => q && q.role === 'intro');
    assert.ok(lv4, 'LV4 fails');
    const d = walkFrom({ w: near.L.G.W, h: near.L.G.H, tiles: near.L.G.rows() }, ...near.L.meta.entrance)(5, intro.y1 + 1);
    assert.equal(lv4.why, `the Intro's onward opening at (5, ${intro.y1 + 1}) is ${d} walking tiles from the entrance (at least ${N.INTRO_DEPTH})`);
    assert.equal(json(lv4.tiles[0]), json([5, intro.y1 + 1]));
    // A stamp too tall for the Intro (the enfilade has 3 or 4 rows north of its entrance).
    const tall = Object.assign({}, LStamp.FIXTURE, { map: ['#......|.......'].concat(LStamp.FIXTURE.map.slice(1, 3), LStamp.FIXTURE.map.slice(1)), stretch: [8] });
    assert.equal(LStamp.check(tall), null);
    const misfit = Layout.attempt('enfilade', 0, 1, 'plant/tall', { stamp: tall }).failed.find(f => f.id === 'LV4');
    assert.match(misfit.why, /^the Intro's stamp does not fit: the Intro has [34] rows north of its entrance row, and the stamp draws 5 there that do not stretch$/);
    // near(s, k): an exhibit's letter by the door holds for k = 1 and fails for a walk that can
    // keep 2 tiles away from it.
    const by = Object.assign({}, LStamp.FIXTURE, {
      map: LStamp.FIXTURE.map.map((row, i) => i === 3 ? 'E......+.s.....' : row), legend: { s: { sp: 'X.1' } }, invariants: [{ near: 's', k: 1 }] });
    assert.equal(LStamp.check(by), null);
    const held = Layout.attempt('enfilade', 0, 2, 'plant/by', { stamp: by });
    assert.ok(!held.failed.some(f => f.id === 'LV4'), json(held.failed));
    const far = Object.assign({}, by, { invariants: [{ near: 's', k: 0 }] });
    const lv4far = Layout.attempt('enfilade', 0, 2, 'plant/by', { stamp: far }).failed.find(f => f.id === 'LV4');
    assert.match(lv4far.why, /^a walk from the entrance reaches the Intro's onward opening at \(\d+, \d+\) without passing within 0 tiles of 's'$/);
  });

  test('the stamp is written as drawn: stretch rows fill the height, the entrance row on the entrance, legend letters as marks', () => {
    const st = {
      map: [
        '#...v..|.......',
        '#......|.......',
        'E......+..s....',
        '#..q...|.......',
        '#......|.....p.',
      ],
      legend: { s: { sp: 'X.1' }, q: { tile: 'f' }, v: { case: true } },
      stretch: [1, 4],
      cut: '+',
      invariants: [],
    };
    assert.equal(LStamp.check(st), null);
    // A stamp of bare floor, its cut a column of a legend letter written as floor: had curation
    // furnished the Intro, its columns and cases would show.
    const bare = { map: ['#......z.......', 'E......z.......', '#......z.......'], legend: { z: {} }, stretch: [0, 2], cut: 'z', invariants: [] };
    for (const p of PROGS) for (let s = 1; s <= 3; s++) introHolds(Layout.generate(p, 0, s, { stamp: bare }).plan, bare, `${p} seed ${s}, bare`);
    for (const p of PROGS) for (let s = 1; s <= 3; s++) {
      const r = Layout.generate(p, 0, s, { stamp: st }), I = r.plan.intro, room = r.plan.rooms.find(q => q.role === 'intro'), ey = r.plan.entrance[1];
      assert.equal(r.failed.length, 0, `${p} seed ${s}`);
      introHolds(r.plan, st, `${p} seed ${s}`);
      // Row 0 once at the top, row 1 for the rest north of the entrance; row 3 once, row 4 to the end.
      const rows = LStamp.rowsFor(st, ey - room.y0, room.y1 - ey);
      assert.equal(json(rows), json([0].concat(Array(ey - room.y0 - 1).fill(1), [2, 3], Array(room.y1 - ey - 1).fill(4))), `${p} seed ${s}`);
      assert.equal(json(I.cut), json([[7, ey]]));
      assert.equal(json(I.marks), json([{ ch: 'v', x: 4, y: room.y0 }, { ch: 's', x: 10, y: ey }, { ch: 'q', x: 3, y: ey + 1 }]));
      assert.equal(r.plan.tiles[room.y0][4] + r.plan.tiles[ey][10] + r.plan.tiles[ey + 1][3], 'v.f', 'a legend letter is its tile, itself if a stamp tile, else floor');
    }
    // Several stretch rows on a side share its rows evenly, the northern ones first.
    const two = { map: ['#..............', '#.....|........', 'E.....+........', '#..............', '#..............'], legend: {}, stretch: [0, 1, 3, 4], cut: '+', invariants: [] };
    assert.equal(json(LStamp.rowsFor(two, 5, 2)), json([0, 0, 0, 1, 1, 2, 3, 4]));
    assert.equal(json(LStamp.rowsFor(two, 0, 0)), json([2]));
    assert.equal(LStamp.rowsFor(Object.assign({}, two, { stretch: [3, 4] }), 3, 2), 'the Intro has 3 rows north of its entrance row, and the stamp draws 2 there, none of which stretches');
  });

  test('a stamp that is not one is refused, naming the first thing wrong', () => {
    const F = LStamp.FIXTURE, ok = Object.assign({}, F, { legend: { s: { sp: 'X.1' } }, map: F.map.map((row, i) => i === 1 ? '#......|...s...' : row) });
    assert.equal(LStamp.check(F), null);
    assert.equal(LStamp.check(ok), null);
    for (const k of Packs.list()) if (k.intro) assert.equal(LStamp.check(k.intro), null, `${k.acc}'s stamp`);
    const bad = (change, re) => {
      const st = Object.assign({}, ok, change);
      assert.match(String(LStamp.check(st)), re, json(change));
      assert.throws(() => Layout.attempt('enfilade', 0, 1, 'plant/bad', { stamp: st }), re);
    };
    bad({ map: ['E......+......'] }, /row 0 is 14 characters, not 15/);
    bad({ map: F.map.map(r => '#' + r.slice(1)) }, /no row of the stamp's map holds the entrance/);
    bad({ map: F.map.map(r => 'E' + r.slice(1)) }, /rows 0 and 1 both hold the entrance/);
    bad({ map: F.map.map((r, i) => i === 0 ? '.' + r.slice(1) : r) }, /row 0 begins "\.", not the west wall/);
    bad({ map: F.map.map((r, i) => i === 0 ? '#......|.....l.' : r) }, /column 13 is "l", neither a stamp tile/);
    bad({ map: F.map.map((r, i) => i === 0 ? '#......|..#....' : r) }, /column 10 is "#"/);
    bad({ legend: { s: { sp: 'X.1' }, t: { sp: 'X.2' } } }, /names 't', which its map does not use/);
    bad({ legend: { s: { tile: 'l' } } }, /legend entry 's' has the tile "l"/);
    bad({ legend: { s: 'X.1' } }, /legend entry 's' is not a record/);
    bad({ stretch: [3] }, /stretch rows include its entrance row 3/);
    bad({ stretch: [6, 0] }, /not in ascending order/);
    bad({ stretch: [9] }, /stretch row 9 is not a row/);
    bad({ cut: 'z' }, /cut names 'z', which its map does not use/);
    bad({ cut: '' }, /cut is not a string/);
    bad({ invariants: [{ near: 's', k: 2, also: 1 }] }, /invariant 0 is not \{near: letter, k\}/);
    bad({ invariants: [{ seen: 's' }] }, /near is the only invariant built/);
    bad({ invariants: [{ near: 'q', k: 1 }] }, /near "q", a letter its map does not use/);
    bad({ invariants: [{ near: 's', k: -1 }] }, /k -1, not 0–14/);
    bad({ extra: 1 }, /fields cut, extra, invariants, legend, map, stretch/);
    assert.match(LStamp.check(null), /not a record/);
    // The stamp a plan takes: given, else its pack's, else the fixture.
    assert.equal(LStamp.of({ stamp: ok }), ok);
    assert.equal(LStamp.of({ acc: 'enfilade' }), F);
    assert.equal(LStamp.of({}), F);
    for (const k of Packs.list()) assert.equal(LStamp.of({ acc: k.acc }), k.intro || F, k.acc);
  });

  test('no wall west of INTRO_DEPTH is ever a candidate opening of the Intro, and the identity shares leave the stamped Intro out', () => {
    for (const p of PROGS) for (let s = 1; s <= 5; s++) {
      const a = Layout.attempt(p, 0, s, 'plant/w' + s), L = a.L, intro = L.rooms.find(q => q && q.role === 'intro');
      let cands = 0;
      for (const q of L.rooms) if (q && q !== intro) for (const c of LBuild.wallCandidates(L, intro.id, q.id).concat(LBuild.wallCandidates(L, q.id, intro.id))) {
        cands++;
        assert.ok(c.x >= intro.x0 - 1 + N.INTRO_DEPTH, `${p} seed ${s}: a candidate at ${c.x},${c.y}`);
      }
      assert.ok(cands > 0, `${p} seed ${s}: the Intro can still be opened`);
      // Glass and narrow shares: unchanged by glass planted in the Intro, changed by glass planted
      // outside it; pillar loops count the stamp's two free-standing plinths.
      const A0 = LAnalyse.analyse(L), G = L.G, ey = L.meta.entrance[1];
      const t = (ey - 1) * G.W + 3, was = G.t[t];
      G.t[t] = T.VIT;
      const A1 = LAnalyse.analyse(L);
      assert.equal(json([A1.glass, A1.blockers, A1.narrow, A1.narrowFloor]), json([A0.glass, A0.blockers, A0.narrow, A0.narrowFloor]), `${p} seed ${s}`);
      assert.equal(A1.floor, A0.floor - 1);
      G.t[t] = was;
      const plinths = [];
      for (let i = 0; i < G.W * G.H; i++) if (G.room[i] === intro.id && G.t[i] === T.PLINTH) plinths.push(i);
      assert.equal(plinths.length, 2, `${p} seed ${s}: the fixture's two plinths`);
      for (const i of plinths) G.t[i] = T.FLOOR;
      assert.equal(LAnalyse.analyse(L).pillar, A0.pillar - 2, `${p} seed ${s}: the plinths are pillar loops`);
      for (const i of plinths) G.t[i] = T.PLINTH;
      // Outside the Intro, a free floor tile turned to glass counts.
      const out = G.t.findIndex((c, i) => c === T.FLOOR && A0.openMask[i] && G.room[i] && G.room[i] !== intro.id && !a.A.gates.has(i));
      G.t[out] = T.VIT;
      assert.equal(LAnalyse.analyse(L).glass, A0.glass + 1, `${p} seed ${s}: glass outside the Intro counts`);
    }
  });

  // The enfilade's rows may run to 50 − INTRO_WIDTH − the hall's width, so at the larger sizes the
  // wider Intro does not shorten them (44 less the Intro's width at version 2). At Cabinet size
  // the rows are shorter than either bound.
  test('the enfilade\'s rows run to 50 less the Intro and the hall, and at Cabinet size are shorter than that', () => {
    let longer = 0;
    for (const size of [0, 1, 2]) for (let s = 1; s <= 6; s++) {
      const a = Layout.attempt('enfilade', size, s, 'plant/rows' + s), K = a.K, row = a.L.rooms.filter(r => r && r.tags.row === 'N');
      const len = Math.max(...row.map(r => r.x1)) - Math.min(...row.map(r => r.x0)) + 1;
      assert.equal(K.introW, N.INTRO_WIDTH);
      assert.ok(len <= 50 - N.INTRO_WIDTH - K.cW, `size ${size} seed ${s}: a row of ${len}`);
      if (size === 0) assert.ok(len <= 44 - 8 - K.cW, `size 0 seed ${s}: a row of ${len}`);
      if (len > 44 - N.INTRO_WIDTH - K.cW) longer++;
    }
    assert.ok(longer >= 3, `only ${longer} rows longer than 44 less the Intro and the hall would allow`);
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
