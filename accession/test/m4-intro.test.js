// M4's Intro stamps (M4 plan D-STAMPS, DE2; BUILD.md §5.2, §5.5; design/samples.md §§2.4, 3.4,
// 4.4; design/layout.md §7.1, §11): each pack's own stamp, content/<acc>-intro.js, is the Intro
// of every one of its departments' plans, and on 1,000 seeds of each department:
//   - the plan's Intro is the stamp's, row by row; every onward opening is at walk INTRO_DEPTH or
//     more, and none is reached without crossing the cut or passing within k of each near;
//   - every exhibit the stamp places stands at walk 9–14, and its waking ring (RING_MOVING
//     walking tiles in sight) reaches no tile of the safe zone; a station's line stays in the
//     Intro, beyond the safe zone, and crosses every way onward;
//   - each stamp teaches as it says: S.9's Grazer is hidden by the columns from some of the way
//     east and from where the Hoppers wait; A.4's original stands on the visitors' side of the
//     counter and its spares beyond it;
//   - each stamp is in keeping with its programme (identity, below), and so is the department
//     counted whole with its Intro;
// and, populated (the M4 archetypes planted ready, and an empty gallery list, so that the
// stamp's marks are placed), each exhibit stands on its mark as one instance with its line, and
// Archetypes.wakeRegion keeps out of the safe zone; Populate.check holds a stamp's marks to
// COPY_GROUP and refuses an exhibit on a stretch row. The walks, rings and shares here are
// worked out from the plan's rows by oracles written apart from the generator and population.
'use strict';
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const { Packs, Layout, LStamp, N, Grid } = C;
  const json = x => JSON.stringify(x);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const ACCS = ['S9', 'A4', 'M11'];
  const SEEDS = 1000;
  const depthOf = seed => 1 + ((seed - 1) % 7);
  // design/layout.md §7.1: the Intro's exhibits (the orientation pool, the teaching instance)
  // stand at walk 9–14, beyond the safe zone and among the Intro's onward openings.
  const NEAREST = N.SAFE_ZONE + 1, FARTHEST = 14;
  const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

  // ---- Oracles over a plan's rows ----

  // Tiles you can step onto (a closed door opens as you step; a staff door, for a visitor of
  // its grade); the public walk the identity shares count from (staff doors shut); and
  // design/layout.md §13.2's blockers, the glass (see-through) among them.
  const STEP = '.,+EXbwS', PUBLIC = '.,+EXbw', BLOCK = 'vfp~loH|cC', GLASS = 'vfp~l';
  const at = (plan, x, y) => (x >= 0 && y >= 0 && x < plan.w && y < plan.h ? plan.tiles[y][x] : '#');
  // Walking distances over `tiles` from starts: 8 ways, a diagonal only past two tiles that can
  // be stepped onto; the tiles in `walls` never stepped on (a diagonal may pass between two of
  // them). -1 where unreached.
  function walk(plan, starts, walls, tiles) {
    const W = plan.w, D = new Int32Array(W * plan.h).fill(-1), wall = new Set((walls || []).map(([x, y]) => y * W + x));
    const can = (x, y) => (tiles || STEP).includes(at(plan, x, y));
    const q = [];
    for (const [x, y] of starts) if (!wall.has(y * W + x)) { D[y * W + x] = 0; q.push([x, y]); }
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, i = ny * W + nx;
        if ((!dx && !dy) || !can(nx, ny) || wall.has(i) || D[i] >= 0 || (dx && dy && (!can(nx, y) || !can(x, ny)))) continue;
        D[i] = D[y * W + x] + 1; q.push([nx, ny]);
      }
    }
    return D;
  }
  // The walk to (x, y): its own, or for a tile no one steps onto (a plinth), 1 + its nearest
  // neighbour's that can be stepped onto.
  function reach(plan, D, x, y) {
    if (STEP.includes(at(plan, x, y))) return D[y * plan.w + x];
    let best = -1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const v = (dx || dy) && STEP.includes(at(plan, x + dx, y + dy)) ? D[(y + dy) * plan.w + x + dx] : -1;
      if (v >= 0 && (best < 0 || v + 1 < best)) best = v + 1;
    }
    return best;
  }
  const introOf = plan => plan.rooms.find(r => r.role === 'intro');
  const inside = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  // The Intro's onward openings: the tiles of its wall ring that can be stepped onto, the
  // entrance left out.
  function openings(plan) {
    const r = introOf(plan), out = [];
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      if (!inside(r, x, y) && STEP.includes(at(plan, x, y)) && at(plan, x, y) !== 'E') out.push([x, y]);
    }
    return out;
  }
  const reached = (plan, D) => openings(plan).filter(([x, y]) => D[y * plan.w + x] >= 0);
  // The stamp's exhibits in a plan: {ch, sp, x, y, e} for each mark whose legend entry names one.
  const exhibitsOf = (plan, stamp) => plan.intro.marks.filter(m => own(stamp.legend, m.ch) && stamp.legend[m.ch].sp !== undefined)
    .map(m => ({ ch: m.ch, sp: stamp.legend[m.ch].sp, x: m.x, y: m.y, e: stamp.legend[m.ch] }));
  // The tiles from which you would give an exhibit at (x, y) a ring pip with a moving ring: tiles
  // you can stand on (not a closed door) within RING_MOVING walking tiles of it (from a
  // neighbour, one further, for a tile no one steps onto) and in its line of sight (§8.2).
  function ring(plan, x, y) {
    const starts = STEP.includes(at(plan, x, y)) ? [[x, y]] : [];
    if (!starts.length) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && STEP.includes(at(plan, x + dx, y + dy))) starts.push([x + dx, y + dy]);
    const R = walk(plan, starts), extra = STEP.includes(at(plan, x, y)) ? 0 : 1, out = [];
    for (let i = 0; i < R.length; i++) {
      const tx = i % plan.w, ty = (i - tx) / plan.w;
      if (R[i] < 0 || R[i] + extra > N.RING_MOVING || '+S'.includes(at(plan, tx, ty)) || !Grid.los(plan, tx, ty, x, y)) continue;
      out.push([tx, ty]);
    }
    return out;
  }
  // A station's line from (x, y) toward dir: the tiles of the Intro sight passes, until one it
  // does not or the Intro's edge.
  function line(plan, x, y, dir) {
    const r = introOf(plan), [dx, dy] = DIRS[dir], out = [];
    for (let tx = x + dx, ty = y + dy; inside(r, tx, ty) && Grid.seeThrough(plan, tx, ty); tx += dx, ty += dy) out.push([tx, ty]);
    return out;
  }

  // ---- A stamp's identity ----

  // The Intro's own counts, as LV14 counts the rest of the department (design/layout.md §13.2):
  // its blockers next to public floor and the glass among them; its public floor and the narrow
  // among it (a run, across or down, of 2 or fewer); and its pillar loops, the holes (tiles off
  // the public walk, 8-connected, off the plan's edge) wholly inside it with a ring of 16 or
  // fewer public tiles round them.
  function counts(plan) {
    const r = introOf(plan), W = plan.w, P = walk(plan, [plan.entrance], [], PUBLIC), open = (x, y) => x >= 0 && y >= 0 && x < W && y < plan.h && P[y * W + x] >= 0;
    let blockers = 0, glass = 0, floor = 0, narrow = 0, pillars = 0;
    const seen = new Set();
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const c = at(plan, x, y);
      if (BLOCK.includes(c) && c !== 'C') {
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (open(x + dx, y + dy)) near = true;
        if (near) { blockers++; if (GLASS.includes(c)) glass++; }
      }
      if (open(x, y)) {
        floor++;
        let h = 1, v = 1;
        for (let k = 1; open(x + k, y); k++) h++;
        for (let k = 1; open(x - k, y); k++) h++;
        for (let k = 1; open(x, y + k); k++) v++;
        for (let k = 1; open(x, y - k); k++) v++;
        if (Math.min(h, v) <= 2) narrow++;
        continue;
      }
      if (seen.has(y * W + x)) continue;
      const comp = [[x, y]];
      seen.add(y * W + x);
      let whole = true;
      for (let k = 0; k < comp.length; k++) {
        const [cx, cy] = comp[k];
        if (!inside(r, cx, cy)) whole = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= plan.h) { whole = false; continue; }
          if (!open(nx, ny) && !seen.has(ny * W + nx)) { seen.add(ny * W + nx); comp.push([nx, ny]); }
        }
      }
      if (!whole) continue;
      const ringTiles = new Set();
      for (const [cx, cy] of comp) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (open(cx + dx, cy + dy)) ringTiles.add((cy + dy) * W + cx + dx);
      if (ringTiles.size <= 16) pillars++;
    }
    return { blockers, glass, floor, narrow, pillars };
  }
  // A stamp is in keeping with its programme when the Intro's own furniture meets the bar the
  // programme's identity check (LV14, layout/generate.js) holds the rest of the department to,
  // the Intro being exempt there (BUILD.md §5.5): the enfilade's glass 40–85% of its blockers,
  // the case labyrinth's glass at least 75% of them and its narrow floor at least 15%. The
  // sculpture court's check asks 8 pillar loops of a plan; the Intro, about a quarter of the
  // court's public floor (24% at p50), keeps its quarter, 2 (D-SPIKE: with none, 10.8% of the
  // court's first layout attempts fail). With both the Intro and the rest within a share's bar,
  // the department counted whole is too (a share of two parts lies between the parts' shares).
  // Returns null, or why the stamp is not in keeping, as a sentence.
  const BARS = { enfilade: { glass: [40, 85] }, case_labyrinth: { glass: [75, 100], narrow: 15 }, sculpture_court: { pillars: 2 } };
  function identity(plan, I) {
    const bar = BARS[plan.programme];
    I = I || counts(plan);
    if (bar.glass && (100 * I.glass < bar.glass[0] * I.blockers || 100 * I.glass > bar.glass[1] * I.blockers)) return `glass is ${I.glass} of the Intro's ${I.blockers} blockers (${bar.glass[0]}–${bar.glass[1]}%)`;
    if (bar.narrow && 100 * I.narrow < bar.narrow * I.floor) return `only ${I.narrow} of the Intro's ${I.floor} floor tiles are narrow (at least ${bar.narrow}%)`;
    if (bar.pillars && I.pillars < bar.pillars) return `the Intro holds ${I.pillars} pillar loops (at least ${bar.pillars})`;
    return null;
  }

  // ---- The stamps themselves ----

  test('each pack gives its own stamp, sound, and drawn as the M4 plan asks: the cut west of column 12, the entrance row clear east of it, floor against the walls from column 12, no exhibit on a stretch row', () => {
    // The tile the generator writes for a letter of the map (§5.2).
    const tile = (st, ch) => { const e = own(st.legend, ch) ? st.legend[ch] : null; return e ? e.tile || (LStamp.TILES.includes(ch) ? ch : '.') : ch; };
    const opaque = (st, ch) => !Grid.TILES[tile(st, ch)].see, walkable = (st, ch) => !!Grid.TILES[tile(st, ch)].walk;
    for (const acc of ACCS) {
      const pack = Packs.get(acc), st = pack.intro;
      assert.ok(st, `${acc} gives its own stamp`);
      assert.equal(LStamp.check(st), null, acc);
      assert.equal(LStamp.of({ acc }), st, `${acc}'s plans take it`);
      const e = st.map.findIndex(r => r[0] === 'E'), last = st.map.length - 1;
      let cutAt = -1;
      st.map.forEach((row, y) => {
        for (let x = 1; x < row.length; x++) if (st.cut.includes(row[x])) { assert.ok(x < N.INTRO_DEPTH, `${acc}: the cut at row ${y} column ${x}`); if (y === e) cutAt = x; }
        assert.ok(walkable(st, row[N.INTRO_WIDTH]), `${acc}: row ${y} can be walked against the east wall`);
      });
      assert.ok(cutAt > 0, `${acc}: the cut is on the entrance row`);
      for (let x = cutAt + 1; x <= N.INTRO_WIDTH; x++) assert.ok(!opaque(st, st.map[e][x]), `${acc}: the entrance row is clear east of the cut, at column ${x}`);
      for (const y of [0, last]) for (let x = N.INTRO_DEPTH; x <= N.INTRO_WIDTH; x++) assert.ok(walkable(st, st.map[y][x]), `${acc}: row ${y} column ${x}, against the wall, can be walked`);
      // Population reads the stamp's exhibits; each stands where the map draws it, once.
      for (const r of st.stretch) for (const ch of st.map[r].slice(1)) assert.ok(!(own(st.legend, ch) && st.legend[ch].sp !== undefined), `${acc}: stretch row ${r} holds an exhibit`);
      assert.equal(json(C.Populate.check(Object.assign({}, pack, { galleries: [] }))), '[]', acc);
    }
    // Their certified fallbacks take their stamps and hold (m1 certifies every pack; here the
    // stamps the packs now give).
    for (const acc of ACCS) {
      const f = Layout.fallback(Packs.get(acc).programme, 0, { acc });
      assert.equal(f.failed.length, 0, `${acc}'s fallback: ${f.failed.map(x => x.id + ' ' + x.why).join('; ')}`);
    }
  });

  // ---- 1,000 seeds of each department ----

  test('on 1,000 seeds of each department the Intro is its stamp; every way onward crosses the cut and passes each near, at walk 12 or more; every exhibit stands at walk 9–14 with its ring and line out of the safe zone; each teaches as it says; each is in keeping with its programme', () => {
    const report = [];
    for (const acc of ACCS) {
      const pack = Packs.get(acc), st = pack.intro;
      let first = 0, fallbacks = 0, lo = 99, hi = 0;
      const shares = { glass: [], narrow: [], pillars: [] };
      for (let seed = 1; seed <= SEEDS; seed++) {
        const r = Layout.generate(pack.programme, 0, seed, { acc, depth: depthOf(seed) }), plan = r.plan, where = `${acc} seed ${seed}`;
        if (r.attempt === 0) first++;
        if (r.fallback) fallbacks++;
        const rm = introOf(plan), [ex, ey] = plan.entrance, W = plan.w;
        assert.equal(LStamp.shape(plan.intro), null, where);
        // The Intro is the stamp's, row by row.
        const rows = LStamp.rowsFor(st, ey - rm.y0, rm.y1 - ey);
        assert.ok(Array.isArray(rows), `${where}: ${rows}`);
        for (let y = rm.y0; y <= rm.y1; y++) {
          const src = st.map[rows[y - rm.y0]];
          for (let x = rm.x0; x <= rm.x1; x++) {
            const ch = src[x - rm.x0 + 1], e = own(st.legend, ch) ? st.legend[ch] : null;
            if (plan.tiles[y][x] !== (e ? e.tile || (LStamp.TILES.includes(ch) ? ch : '.') : ch)) assert.fail(`${where}: the Intro's tile ${x},${y} is ${plan.tiles[y][x]}, not the stamp's ${ch}`);
          }
        }
        // Its onward openings: two or more, each at walk INTRO_DEPTH or more; none reached with
        // the cut walled, or with a near's ball walled.
        const D = walk(plan, [[ex, ey]]), ops = openings(plan);
        assert.ok(ops.length >= 2, `${where}: ${ops.length} onward opening tiles`);
        for (const [x, y] of ops) assert.ok(D[y * W + x] >= N.INTRO_DEPTH, `${where}: the opening ${x},${y} is at walk ${D[y * W + x]}`);
        const cutTiles = plan.intro.cut, Dz = walk(plan, [[ex, ey]], cutTiles);
        assert.equal(json(reached(plan, Dz)), '[]', `${where}: an opening is reached without crossing the cut`);
        for (const v of st.invariants) {
          const ball = [];
          for (const m of plan.intro.marks) if (m.ch === v.near) for (let dy = -v.k; dy <= v.k; dy++) for (let dx = -v.k; dx <= v.k; dx++) ball.push([m.x + dx, m.y + dy]);
          assert.equal(json(reached(plan, walk(plan, [[ex, ey]], ball))), '[]', `${where}: a way onward passes no nearer than ${v.k} to '${v.near}'`);
        }
        // The exhibits: at walk 9–14; their rings miss the safe zone; a station's line stays in
        // the Intro, beyond the safe zone, and crosses every way onward.
        const xs = exhibitsOf(plan, st);
        for (const a of xs) {
          const d = reach(plan, D, a.x, a.y);
          lo = Math.min(lo, d); hi = Math.max(hi, d);
          assert.ok(d >= NEAREST && d <= FARTHEST, `${where}: ${a.sp} ('${a.ch}') at ${a.x},${a.y} is at walk ${d}`);
          for (const [tx, ty] of ring(plan, a.x, a.y)) if (D[ty * W + tx] >= 0 && D[ty * W + tx] <= N.SAFE_ZONE) assert.fail(`${where}: ${a.sp}'s ring reaches ${tx},${ty}, at walk ${D[ty * W + tx]}`);
          if (!a.e.dir) continue;
          const ln = line(plan, a.x, a.y, a.e.dir), end = [ln[ln.length - 1][0] + DIRS[a.e.dir][0], ln[ln.length - 1][1] + DIRS[a.e.dir][1]];
          assert.ok(ln.length >= 3, `${where}: the line is ${ln.length} tiles`);
          assert.ok(!inside(rm, end[0], end[1]) || !Grid.seeThrough(plan, end[0], end[1]), `${where}: the line stops at the Intro's edge or at what sight cannot pass`);
          for (const [tx, ty] of ln) assert.ok(D[ty * W + tx] > N.SAFE_ZONE, `${where}: the line's tile ${tx},${ty} is at walk ${D[ty * W + tx]}`);
          assert.equal(json(reached(plan, walk(plan, [[ex, ey]], ln.concat([[a.x, a.y]])))), '[]', `${where}: a way onward misses the line`);
        }
        assert.equal(xs.length, st.map.reduce((k, row) => k + [...row.slice(1)].filter(ch => own(st.legend, ch) && st.legend[ch].sp !== undefined).length, 0), `${where}: each exhibit of the stamp is marked once`);
        // Each teaches as its file says.
        const cutX = cutTiles.find(t => t[1] === ey)[0];
        if (acc === 'S9') {
          const g = xs.find(a => a.sp === 'S9.1'), seen = [];
          for (let x = cutX + 1; x <= rm.x1; x++) seen.push(Grid.los(plan, x, ey, g.x, g.y));
          assert.ok(seen.includes(true) && seen.includes(false), `${where}: from the way east the Grazer is in sight from some tiles and hidden from others (${json(seen)})`);
          for (const h of xs.filter(a => a.sp === 'S9.6')) assert.ok(!Grid.los(plan, h.x, h.y, g.x, g.y), `${where}: the Hopper at ${h.x},${h.y} can see the Grazer`);
        }
        if (acc === 'A4') {
          for (const a of xs) assert.equal(reach(plan, Dz, a.x, a.y) >= 0, a.sp === 'A4.1', `${where}: ${a.sp} at ${a.x},${a.y} stands on the ${a.sp === 'A4.1' ? 'visitors\'' : 'staff'} side of the counter`);
        }
        // In keeping with its programme, and so the department counted whole.
        const I = counts(plan), why = identity(plan, I), A = r.analysis;
        assert.equal(why, null, `${where}: ${why}`);
        const bar = BARS[plan.programme];
        if (bar.glass) { const gl = A.glass + I.glass, bl = A.blockers + I.blockers; assert.ok(100 * gl >= bar.glass[0] * bl && 100 * gl <= bar.glass[1] * bl, `${where}: counted whole, glass is ${gl} of ${bl}`); }
        if (bar.narrow) assert.ok(100 * (A.narrow + I.narrow) >= bar.narrow * (A.narrowFloor + I.floor), `${where}: counted whole, the narrow share`);
        if (bar.glass) shares.glass.push(Math.floor(100 * I.glass / I.blockers));
        if (bar.narrow) shares.narrow.push(Math.floor(100 * I.narrow / I.floor));
        if (bar.pillars) shares.pillars.push(I.pillars);
      }
      // M1's bar and A1.4's: no more than 1% fall back, at least 90% pass layout at the first attempt.
      assert.ok(fallbacks * 100 <= SEEDS, `${acc}: ${fallbacks} fallbacks`);
      assert.ok(first * 10 >= SEEDS * 9, `${acc}: ${first} of ${SEEDS} plans at the first attempt`);
      const span = k => shares[k].length ? `; ${k === 'pillars' ? 'pillar loops' : k + ' %'} in the Intro ${Math.min(...shares[k])}–${Math.max(...shares[k])}` : '';
      report.push(`${acc}: ${first}/${SEEDS} at the first attempt, ${fallbacks} fallbacks; exhibits at walk ${lo}–${hi}${span('glass')}${span('narrow')}${span('pillars')}`);
    }
    console.log('  ' + report.join('\n  '));
  });

  // ---- The identity check, planted ----

  test('the identity check fails a stamp out of keeping with its programme: M.11 without its glass, or all glass; A.4 with opaque desks, or none; S.9 with no free-standing blockers', () => {
    const swap = (acc, rows, legend) => {
      const X = loadCore(), st = Packs.get(acc).intro;
      delete X.Packs.get(acc).intro;
      X.Packs.part(acc, 'intro', Object.assign({}, st, { map: st.map.map(rows), legend: legend || st.legend }));
      return X;
    };
    const plants = [
      ['M11', row => row.replace(/f/g, '.'), null, /glass is 0 of the Intro's \d+ blockers \(40–85%\)/],
      ['M11', row => row.replace('|', 'f'), null, /glass is (\d+) of the Intro's \1 blockers \(40–85%\)/],
      ['A4', (row, y) => (y === 6 ? row : row.slice(0, 9).replace(/f/g, 'H') + row.slice(9)), null, /glass is \d+ of the Intro's \d+ blockers \(75–100%\)/],
      ['A4', row => row.slice(0, 9).replace(/f/g, '.') + row.slice(9), null, /only \d+ of the Intro's \d+ floor tiles are narrow \(at least 15%\)/],
      ['S9', row => row.replace(/o/g, '.'), { g: { sp: 'S9.1' }, h: { sp: 'S9.6' } }, /the Intro holds 0 pillar loops \(at least 2\)/],
    ];
    for (const [acc, rows, legend, re] of plants) {
      const X = swap(acc, rows, legend), P = X.Packs.get(acc);
      for (let seed = 1; seed <= 3; seed++) {
        const plan = X.Layout.generate(P.programme, 0, seed, { acc, depth: depthOf(seed) }).plan;
        assert.match(String(identity(plan)), re, `${acc} seed ${seed}, planted`);
      }
    }
    // The real stamps pass on those seeds too (the sweep holds them on 1,000).
    for (const acc of ACCS) assert.equal(identity(Layout.generate(Packs.get(acc).programme, 0, 2, { acc, depth: 2 }).plan), null, acc);
  });

  // ---- Populated ----

  // A core whose packs carry an empty gallery list, so the stamp's marks are placed (§5.5);
  // with the M4 archetypes, modifier and trigger the stamps' species need planted past ready
  // false when ready is true. Populate.exhibits is watched, so a test sees each attempt's plan.
  const M4_READY = { ARCHETYPES: ['unobserved_mover', 'demonstrator'], MODIFIERS: ['clockwork'], TRIGGERS: ['period'] };
  function core(ready) {
    const X = loadCore(), plans = [];
    for (const acc of ACCS) X.Packs.get(acc).galleries = [];
    if (ready) for (const t of Object.keys(M4_READY)) for (const id of M4_READY[t]) X.Registry[t][id].ready = 'unit';
    const real = X.Populate.exhibits;
    X.Populate.exhibits = (state, plan, pack, base, log) => { plans.push(plan); return real(state, plan, pack, base, log); };
    return { X, plans };
  }

  test('populated on 100 seeds of each department (the M4 archetypes planted ready), each of the stamp\'s exhibits stands on its mark, in the marks\' order, as one instance, with its line, and its wake region misses the safe zone', () => {
    const { X, plans } = core(true);
    let placed = 0;
    for (const acc of ACCS) for (let seed = 1; seed <= 100; seed++) {
      plans.length = 0;
      const depth = depthOf(seed), out = X.Dept.generate(seed, acc, depth), s = out.state, plan = plans[plans.length - 1], where = `${acc} seed ${seed}`;
      assert.ok(!out.tries.some(t => t.some(f => f.id === 'population')) && out.rejected === null, `${where}: population rejected an attempt`);
      const st = X.Packs.get(acc).intro, xs = exhibitsOf(plan, st), m = s.dept;
      const intro = m.rooms.find(r => r.role === 'intro'), inIntro = s.actors.filter(a => a.uid !== 'you' && m.roomOf[a.y][a.x] === intro.id);
      assert.equal(json(inIntro.map(a => [a.uid, a.sp, a.x, a.y])), json(xs.map((a, i) => [`${acc}.${depth}.intro.${i + 1}`, a.sp, a.x, a.y])), where);
      for (const a of inIntro) {
        const sp = X.Packs.species(acc, a.sp);
        assert.equal(a.group, sp.group ? `${sp.group}@intro` : null, `${where}: ${a.uid}'s group`);
        assert.equal(json(a.route), json(sp.archetype === 'demonstrator' ? { dir: 'S' } : null), `${where}: ${a.uid}'s route`);
        assert.equal(a.mode, 'dormant', `${where}: ${a.uid} sleeps`);
      }
      if (acc === 'A4') assert.equal(json(inIntro.map(a => a.sp).sort()), json(['A4.1', 'A4.1a', 'A4.1a']), `${where}: one original and its two spares`);
      // Archetypes.wakeRegion over the visit's first SAFE_ZONE_TURNS turns (LV6's question).
      const safe = Grid.distances(m, [m.entrance], N.SAFE_ZONE);
      for (const a of inIntro) for (const [x, y] of X.Archetypes.wakeRegion(s, a, N.SAFE_ZONE_TURNS)) assert.ok(safe[y * m.w + x] < 0, `${where}: ${a.uid}'s wake region reaches ${x},${y} in the safe zone`);
      placed += inIntro.length;
    }
    assert.equal(placed, 100 * (3 + 3 + 2));
  });

  test('readiness: until its archetype is ready an exhibit of the stamp is not placed, and the log says so; the ready ones are', () => {
    const { X } = core(false);
    const want = { S9: ['S9.6', 'S9.6'], A4: ['A4.1', 'A4.1a', 'A4.1a'], M11: ['M11.5'] }, held = { S9: ['S9.1 (stamp g)'], A4: [], M11: ['M11.2 (stamp s)'] };
    for (const acc of ACCS) for (let seed = 1; seed <= 10; seed++) {
      const out = X.Dept.generate(seed, acc, depthOf(seed)), m = out.state.dept, intro = m.rooms.find(r => r.role === 'intro');
      assert.equal(json(out.state.actors.filter(a => a.uid !== 'you' && m.roomOf[a.y][a.x] === intro.id).map(a => a.sp).sort()), json(want[acc]), `${acc} seed ${seed}`);
      for (const h of held[acc]) assert.ok(out.log.some(l => l.op === `${h} is not placed: its archetype, a modifier or its trigger is not ready`), `${acc} seed ${seed}: ${h} logged`);
    }
  });

  // ---- COPY_GROUP and stretch rows for a stamp's marks ----

  test('Populate.check holds a stamp\'s marks to COPY_GROUP, one original to its spares, and refuses an exhibit on a stretch row; population refuses such a pack', () => {
    const X = loadCore(), A4 = X.Packs.get('A4'), S9 = X.Packs.get('S9');
    const planted = (pack, rows) => Object.assign({}, pack, { galleries: [], intro: Object.assign({}, pack.intro, { map: pack.intro.map.map((row, y) => (own(rows, y) ? rows[y] : row)) }) });
    const plants = [
      [A4, { 2: '#........fOf.O.' }, ["A4's stamp holds A4.1a, a spare of A4.1, with 2 of its original, not 1"]],
      [A4, { 2: '#........f.f...' }, ["A4's stamp holds A4.1a, a spare of A4.1, with 0 of its original, not 1", "A4's stamp holds a copy group of 2 (clerks), not 3–4"]],
      [A4, { 5: '#.fffff....f...' }, ["A4's stamp holds a copy group of 2 (clerks), not 3–4"]],
      [A4, { 4: '#........f.f.a.', 8: '#..........f.a.', 9: '#.fffff....f.a.' }, ["A4's stamp holds a copy group of 6 (clerks), not 3–4"]],
      [A4, { 0: '#........f.f.a.', 5: '#.fffff....f...' }, ['A4\'s stamp legend "a": A4.1a stands on the stamp\'s stretch row 0, which repeats it as often as the Intro is tall']],
      [S9, { 10: '#.......|....h.', 9: '#.......|......' }, ['S9\'s stamp legend "h": S9.6 stands on the stamp\'s stretch row 10, which repeats it as often as the Intro is tall']],
    ];
    for (const [pack, rows, want] of plants) assert.equal(json(X.Populate.check(planted(pack, rows))), json(want), json(rows));
    // A copy group of 4, its original once, is sound; so are the packs' own stamps.
    assert.equal(json(X.Populate.check(planted(A4, { 4: '#........f.f.a.' }))), '[]');
    for (const acc of ACCS) assert.equal(json(X.Populate.check(Object.assign({}, X.Packs.get(acc), { galleries: [] }))), '[]', acc);
    // Population refuses the pack: an error, as for a gallery list's fault.
    const Y = loadCore(), P = Y.Packs.get('A4');
    P.galleries = [];
    P.intro.map = P.intro.map.map((row, y) => (y === 4 ? '#........f.f.a.' : y === 8 ? '#..........f.a.' : row));
    assert.throws(() => Y.Dept.create(1, 'A4', 2), /A4's gallery list is not sound:\nA4's stamp holds a copy group of 5 \(clerks\), not 3–4/);
  });
};
