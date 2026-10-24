// M3's case placement over many departments (BUILD.md §8.3's placement, §3.2's streams, §4.1's
// fixtures): every vitrine in a room is a case with its accession number; the glass mix lies
// inside its 99.9% Wilson interval at every depth; no Security glass at depths 1–2; every
// lock lies in its range's overlap with I to depth + 1, or at the glass's minimum; about one
// case in six is on loan; staff doors' grades lie in I to depth + 1; and perturbing one room
// changes no other room's fixtures. The expected figures are worked out here from BUILD.md's
// text (and §8.10's numbers), never from the rule code.
// Seeds: each department and depth is laid out LAYOUTS times, and each layout's cases are
// placed with 100 seeds in check-all; set ACCESSION_CASES_SEEDS=1000 for the per-milestone run.
module.exports = ({ test, assert, loadCore, root, path }) => {
  const C = loadCore();
  const { Cases, Layout, Packs, Rng, Dept, N } = C;
  const Stats = require(path.join(root, 'tools/stats.js'));
  const json = x => JSON.stringify(x);
  const SEEDS = Number(process.env.ACCESSION_CASES_SEEDS) || 100, LAYOUTS = 5;
  const ACCS = ['S9', 'A4', 'M11'], DEPTHS = [1, 2, 3, 4, 5, 6, 7];
  // §8.3's table: the lock range of each glass; §8.10's mixes, by depth (the Exit's, 7, is 6's).
  const LOCKS = { 1: [1, 2], 2: [2, 4], 3: [4, 7] };
  const MIX = depth => N['GLASS_MIX_D' + Math.min(6, depth)];
  const lockOk = (glass, lock, depth) => { const lo = LOCKS[glass][0], hi = Math.min(LOCKS[glass][1], depth + 1); return hi < lo ? lock === lo : lock >= lo && lock <= hi; };

  // A department's map and rooms as Dept.create makes them, and the base of its streams.
  const plans = new Map();
  function plan(acc, depth, seed) {
    const key = `${acc}/${depth}/${seed}`;
    if (plans.has(key)) return plans.get(key);
    const r = Layout.generate(Packs.get(acc).programme, 0, seed, { acc, depth }), p = r.plan, nums = Layout.number(p, depth);
    const out = { plan: p, base: r.base, acc, depth, rooms: p.rooms.map(rm => ({ id: rm.id, key: rm.key, role: rm.role, number: nums[rm.id] || 0 })) };
    plans.set(key, out);
    return out;
  }
  // Cases.place on a plan, with the department's seed for its local holder.
  function placed(P, seed, tiles) {
    const dept = { acc: P.acc, depth: P.depth, w: P.plan.w, h: P.plan.h, tiles: (tiles || P.plan.tiles).map(r => r.replace(/C/g, '.')), rooms: P.rooms, roomOf: P.plan.roomOf, fixtures: [] };
    const state = { seed, dept };
    Cases.place(state, P.plan, P.base, { seed, rng: {} });
    return dept;
  }
  // Every department's worth of cases: LAYOUTS layouts per department and depth, each placed
  // with SEEDS seeds.
  function each(fn) {
    for (const acc of ACCS) for (const depth of DEPTHS) for (let l = 1; l <= LAYOUTS; l++) {
      const P = plan(acc, depth, l);
      for (let k = 0; k < SEEDS; k++) fn(P, placed(P, 10000 * l + k + 1), depth, acc);
    }
  }

  test('the glass mix at every depth lies inside its 99.9% Wilson interval, with no Security glass at depths 1–2; every lock lies in its range; about one case in six is on loan; staff grades lie in I to depth + 1', () => {
    const glass = {}, loans = { k: 0, n: 0 }, locks = {}, staff = {};
    for (const d of DEPTHS) { glass[d] = [0, 0, 0]; staff[d] = {}; }
    let badLock = null, badStaff = null;
    each((P, dept, depth) => {
      for (const f of dept.fixtures) {
        if (f.k === 'staff') {
          if (!(f.grade >= 1 && f.grade <= Math.min(7, depth + 1))) badStaff = badStaff || `${P.acc} d${depth}: grade ${f.grade}`;
          staff[depth][f.grade] = (staff[depth][f.grade] || 0) + 1;
          continue;
        }
        glass[depth][f.glass - 1]++;
        loans.n++; if (f.loan) loans.k++;
        if (!lockOk(f.glass, f.lock, depth)) badLock = badLock || `${P.acc} d${depth}: glass ${f.glass}, lock ${f.lock}`;
        const k = `${depth}/${f.glass}`; locks[k] = locks[k] || new Set(); locks[k].add(f.lock);
      }
    });
    assert.equal(badLock, null); assert.equal(badStaff, null);
    for (const d of DEPTHS) {
      const n = glass[d][0] + glass[d][1] + glass[d][2];
      assert.ok(n >= 500, `depth ${d}: ${n} cases`);
      for (let g = 0; g < 3; g++) {
        const p = MIX(d)[g] / 100;
        if (p === 0) { assert.equal(glass[d][g], 0, `depth ${d}: no glass ${g + 1}`); continue; }
        const w = Stats.wilson(glass[d][g], n, Stats.Z999);
        assert.ok(w.lo <= p && p <= w.hi, `depth ${d}, glass ${g + 1}: ${glass[d][g]} of ${n}, ${json(w)} against ${p}`);
      }
    }
    assert.equal(glass[1][2] + glass[2][2], 0, 'no Security glass at depths 1–2');
    // Every lock the rule allows appears, where the glass appears.
    for (const d of DEPTHS) for (const g of [1, 2, 3]) {
      if (!glass[d][g - 1]) continue;
      const lo = LOCKS[g][0], hi = Math.min(LOCKS[g][1], d + 1), want = hi < lo ? [lo] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      assert.equal(json([...locks[`${d}/${g}`]].sort((a, b) => a - b)), json(want), `depth ${d}, glass ${g}`);
    }
    const w = Stats.wilson(loans.k, loans.n, Stats.Z999);
    assert.ok(w.lo <= 1 / 6 && 1 / 6 <= w.hi, `${loans.k} of ${loans.n} on loan: ${json(w)}`);
    // Staff grades: every grade from I to depth + 1 turns up at depths 1–3.
    for (const d of [1, 2, 3]) for (let g = 1; g <= d + 1; g++) assert.ok(staff[d][g] > 0, `depth ${d}: a staff door of grade ${g}`);
  });

  test('in a department every vitrine in a room is a case, numbered by its department, room and place, drawn first on its room\'s populate stream; glazing in no room is no case; every staff door has its grade', () => {
    let cases = 0, glazing = 0, doors = 0;
    for (const acc of ACCS) for (const depth of DEPTHS) for (const seed of [1, 2, 3]) {
      const s = Dept.create(seed, acc, depth), m = s.dept, P = plan(acc, depth, seed), pack = Packs.get(acc);
      const mine = m.fixtures.filter(f => f.k === 'staff' || (f.k === 'case' && f.mimic === null));
      // They come first, in row-major order (§4.1); anything placed later is appended.
      assert.equal(json(m.fixtures.slice(0, mine.length)), json(mine), `${acc} d${depth} s${seed}: placed fixtures first`);
      for (let i = 1; i < mine.length; i++) assert.ok(mine[i - 1].y < mine[i].y || (mine[i - 1].y === mine[i].y && mine[i - 1].x < mine[i].x), 'row-major');
      // The draws, written out again from §8.3 and §3.2: per room, in row-major order, on
      // `${base}/room/<key>/populate`: glass by depth's mix, the lock uniform over the overlap
      // (else the glass's minimum), then on loan one in CASE_EMPTY_ONE_IN; staff grades on
      // `${base}/staff`, uniform over I to depth + 1 (never above VII).
      const holder = { seed, rng: {} }, k = {}, want = [];
      for (let y = 0; y < P.plan.h; y++) for (let x = 0; x < P.plan.w; x++) {
        const c = P.plan.tiles[y][x];
        if (c === 'S') { want.push({ k: 'staff', x, y, grade: Rng.stream(holder, `${P.base}/staff`).int(1, Math.min(7, depth + 1)) }); continue; }
        if (c !== 'v') continue;
        const rm = P.rooms.find(r => r.id === P.plan.roomOf[y][x]);
        if (!rm) { glazing++; continue; }
        const r = Rng.stream(holder, `${P.base}/room/${rm.key}/populate`);
        const g = 1 + r.weighted(MIX(depth)), lo = LOCKS[g][0], hi = Math.min(LOCKS[g][1], depth + 1), lock = hi < lo ? lo : r.int(lo, hi), loan = r.int(1, 6) === 1;
        k[rm.key] = (k[rm.key] || 0) + 1;
        assert.ok(rm.number > 0, `${acc}: a case in an unnumbered room ${rm.key}`);
        want.push({ k: 'case', x, y, room: rm.key, num: `${pack.number}.${rm.number}.${k[rm.key]}`, glass: g, lock, hits: 0, st: 'shut', loan, holds: null, mimic: null });
      }
      // What a case holds is the item rules' (W1-KIT); everything else is as drawn.
      assert.equal(json(mine.map(f => Object.assign({}, f, f.k === 'case' ? { holds: null } : {}))), json(want), `${acc} d${depth} s${seed}`);
      for (const f of mine) assert.equal(m.tiles[f.y][f.x], f.k === 'case' ? 'v' : 'S');
      cases += mine.filter(f => f.k === 'case').length; doors += mine.filter(f => f.k === 'staff').length;
      // Every number is unique.
      const nums = mine.filter(f => f.k === 'case').map(f => f.num);
      assert.equal(new Set(nums).size, nums.length);
    }
    assert.ok(cases > 1000 && glazing > 10 && doors > 20, `${cases} cases, ${glazing} glazed tiles, ${doors} staff doors`);
  });

  test('locality: taking a vitrine out of one room, or adding one, changes no other room\'s cases, no staff door, and none of that room\'s cases before it', () => {
    let rooms = 0;
    for (const acc of ACCS) for (const depth of [1, 4, 7]) for (const seed of [1, 2]) {
      const P = plan(acc, depth, seed), base = placed(P, seed);
      const byRoom = new Map();
      for (const f of base.fixtures) if (f.k === 'case') { if (!byRoom.has(f.room)) byRoom.set(f.room, []); byRoom.get(f.room).push(f); }
      for (const [key, list] of byRoom) {
        if (list.length < 2) continue;
        rooms++;
        const target = list[1], tiles = P.plan.tiles.slice(), set = (x, y, ch) => { tiles[y] = tiles[y].slice(0, x) + ch + tiles[y].slice(x + 1); };
        // Out: the room's second case becomes floor.
        set(target.x, target.y, '.');
        const out = placed(P, seed, tiles);
        // In: the room's last floor tile in row-major order, if it comes after its first case,
        // becomes a vitrine.
        const rm = P.rooms.find(r => r.key === key), tiles2 = P.plan.tiles.slice(), after = (x, y) => y > list[0].y || (y === list[0].y && x > list[0].x);
        let added = null;
        for (let y = P.plan.h - 1; y >= 0 && !added; y--) for (let x = P.plan.w - 1; x >= 0 && !added; x--) if (P.plan.roomOf[y][x] === rm.id && tiles2[y][x] === '.' && after(x, y)) { added = [x, y]; tiles2[y] = tiles2[y].slice(0, x) + 'v' + tiles2[y].slice(x + 1); }
        const into = placed(P, seed, tiles2);
        for (const [what, d] of [['out', out], ['in', into]]) {
          const others = fs => json(fs.filter(f => f.k === 'staff' || f.room !== key));
          assert.equal(others(d.fixtures), others(base.fixtures), `${acc} d${depth} s${seed}, ${what} of ${key}: other rooms and staff doors unchanged`);
          const mine = d.fixtures.filter(f => f.k === 'case' && f.room === key);
          assert.equal(json(mine[0]), json(list[0]), `${what}: the room's first case is as it was`);
        }
        if (added) assert.equal(into.fixtures.filter(f => f.room === key).length, list.length + 1);
      }
    }
    assert.ok(rooms >= 15, `${rooms} rooms perturbed`);
  });
};
