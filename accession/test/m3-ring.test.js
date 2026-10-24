// The ring drawn and the ring pip are one rule (BUILD.md §8.2): after any step, the sleepers
// that gained a ring pip at the step's last turn boundary stand exactly on the tiles the view
// model's ring marks, and both equal an independent ring worked out here from BUILD.md's
// text (§8.2: walking distance by the step rule, one beyond the nearest tile you could step
// onto for a tile you cannot, Bresenham line of sight from the endpoint first in row-major
// order; the radius 3, or 2 after a wait, rest, view or sit, +2 on a loud floor). It runs
// over the three departments' programmes × 10 seeds, with you on every 7th tile you can
// stand on, after a wait, a move, a Heavy blow (150 ticks, so your next decision is
// mid-turn) and a move onto shards, and a sleeper on every tile an exhibit can stand on
// round you. Planted faults show that it bites.
module.exports = ({ test, assert, loadCore }) => {
  const C = loadCore();
  const json = x => JSON.stringify(x);

  // ---- The independent ring, from §8.2 ----
  const WALK = new Set(['.', ',', '+', "'", 'S', 's', 'E', 'X', 'u', 'k', 'x', 'w', 'b', '=']);
  const SEE = new Set(['.', ',', "'", 's', 'E', 'X', 'v', 'u', 'k', 'x', 'w', 'p', 'f', 'l', 'b', '~', '=']);
  const LOUD = new Set(['k', 'x', 'w']);
  const HOLD = new Set([...WALK, 'v', 'p']);
  const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  // still: your last action that cost time was a wait (or rest, view, sit); radius from §8.2,
  // with the still radius given so that a planted fault can change it.
  function oracle(map, yx, yy, still, stillR) {
    const h = map.length, w = map[0].length, at = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? '#' : map[y][x];
    const r = Math.max(1, (still ? (stillR === undefined ? 2 : stillR) : 3) + (LOUD.has(at(yx, yy)) ? 2 : 0));
    const dist = new Map([[`${yx},${yy}`, 0]]), queue = [[yx, yy]];
    for (let q = 0; q < queue.length; q++) {
      const [x, y] = queue[q], d = dist.get(`${x},${y}`);
      if (d >= r) continue;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!WALK.has(at(nx, ny)) || dist.has(`${nx},${ny}`)) continue;
        if (dx && dy && !(WALK.has(at(nx, y)) && WALK.has(at(x, ny)))) continue;
        dist.set(`${nx},${ny}`, d + 1); queue.push([nx, ny]);
      }
    }
    const reach = (x, y) => {
      if (WALK.has(at(x, y))) return dist.has(`${x},${y}`) ? dist.get(`${x},${y}`) : -1;
      let best = -1;
      for (const [dx, dy] of DIRS) { const k = `${x + dx},${y + dy}`; if (WALK.has(at(x + dx, y + dy)) && dist.has(k) && (best < 0 || dist.get(k) + 1 < best)) best = dist.get(k) + 1; }
      return best;
    };
    const los = (x0, y0, x1, y1) => {
      if (y1 < y0 || (y1 === y0 && x1 < x0)) [x0, y0, x1, y1] = [x1, y1, x0, y0];
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
      let err = dx - dy, x = x0, y = y0;
      while (!(x === x1 && y === y1)) {
        if (!(x === x0 && y === y0) && !SEE.has(at(x, y))) return false;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }
      return true;
    };
    const out = new Set();
    for (let y = Math.max(0, yy - r - 1); y <= Math.min(h - 1, yy + r + 1); y++) for (let x = Math.max(0, yx - r - 1); x <= Math.min(w - 1, yx + r + 1); x++) {
      if (!HOLD.has(at(x, y))) continue;
      const d = reach(x, y);
      if (d >= 0 && d <= r && los(yx, yy, x, y)) out.add(`${x},${y}`);
    }
    return out;
  }

  const ringCells = (X, s, vm) => { const out = new Set(), ring = vm.ring; for (let i = 0; i < ring.length; i++) if (ring[i]) out.add(`${i % s.dept.w},${Math.floor(i / s.dept.w)}`); return out; };
  const sorted = set => [...set].sort();

  // The maps: each department's programme, at depth 1, seeds 1–10.
  const MAPS = [];
  for (const p of C.Packs.list()) for (let seed = 1; seed <= 10; seed++) MAPS.push({ acc: p.acc, seed, tiles: C.Dept.create(seed, p.acc, 1).dept.tiles });
  // Sleepers stand on every hold tile within one tile beyond the step's radius (as §8.2
  // gives it, not as the code computes it) of where you end: every tile that could be inside
  // the ring, and a band outside it.
  const radius = (map, x, y, how) => (how === 'wait' ? 2 : 3) + (LOUD.has(map[y][x]) ? 2 : 0);
  const sleeper = at => ({ sp: 'dummy', at, mode: 'dormant', stats: { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } });
  const stand = (map, x, y) => WALK.has(map[y][x]) && map[y][x] !== '+' && map[y][x] !== 'S';

  // One case: you end at (px, py) after `how` ('wait', 'move', 'heavy', 'shards'); returns
  // what the step shows, or null if the case cannot be set up there.
  function trial(X, base, px, py, how) {
    let map = base.slice();
    if (how === 'shards') {
      if (map[py][px] !== '.' && map[py][px] !== ',') return null;
      map[py] = map[py].slice(0, px) + 'x' + map[py].slice(px + 1);
    }
    const m = { w: map[0].length, h: map.length, tiles: map };
    // For a move, you start on a neighbour you can step from onto (px, py).
    let start = [px, py], dir = null;
    if (how === 'move' || how === 'shards') {
      for (let d = 0; d < 8 && dir === null; d++) {
        const qx = px - X.Grid.DX[d], qy = py - X.Grid.DY[d];
        if (X.Grid.inside(m, qx, qy) && stand(map, qx, qy) && X.Grid.canStep(m, qx, qy, d)) { start = [qx, qy]; dir = d; }
      }
      if (dir === null) return null;
    }
    const exhibits = [], W = radius(map, px, py, how) + 1;
    for (let y = Math.max(0, py - W); y <= Math.min(m.h - 1, py + W); y++) for (let x = Math.max(0, px - W); x <= Math.min(m.w - 1, px + W); x++) {
      if (!HOLD.has(map[y][x]) || (x === start[0] && y === start[1]) || (x === px && y === py)) continue;
      exhibits.push(sleeper([x, y]));
    }
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map, you: start, exhibits, kit: how === 'heavy' ? { weapon: { form: 'heavy', tier: 1 } } : undefined });
    s.actors[0].hp = s.actors[0].maxHp = 999;
    let action = { a: 'wait' };
    if (dir !== null) action = { a: 'move', dir };
    if (how === 'heavy') {
      action = X.Step.legal(s).find(a => a.a === 'attack');
      if (!action) return null;
    }
    // What each boundary of the step saw: the tick, and the sleepers then (spawn order).
    const seen = [], orig = X.Wake.boundary;
    X.Wake.boundary = (st, ev) => { seen.push({ tick: st.tick, asleep: st.actors.filter(a => a.uid !== 'you' && !a.gone && a.mode === 'dormant').map(a => a.uid) }); return orig(st, ev); };
    let ev;
    try { ev = X.Step.step(s, action); } finally { X.Wake.boundary = orig; }
    if (ev.length && ev[0].k === 'refused') throw new Error(`${how} at ${px},${py} was refused: ${ev[0].reason}`);
    const last = seen[seen.length - 1];
    const asleep = new Set(last.asleep), byUid = new Map(s.actors.map(a => [a.uid, a]));
    const pipped = new Set(ev.filter(e => e.k === 'pip' && e.cause.k === 'ring' && e.tick === last.tick).map(e => { const a = byUid.get(e.who); return `${a.x},${a.y}`; }));
    const vm = X.ViewModel.derive(s, { events: ev });
    const drawn = ringCells(X, s, vm);
    const sleepers = new Set(s.actors.filter(a => asleep.has(a.uid)).map(a => `${a.x},${a.y}`));
    // Your ring's radius follows from the action you took, as §8.2 says, not from the state.
    return { s, ev, map, how, at: [px, py], still: how === 'wait', last, pipped, drawn, sleepers, boundaries: seen.length };
  }

  // The check itself: the pips equal the drawn ring on every tile a sleeper stood on, and the
  // drawn ring equals the independent one everywhere. Returns null or what differs.
  function verdict(t, stillR) {
    const want = oracle(t.map, t.s.actors[0].x, t.s.actors[0].y, t.still, stillR);
    const onSleepers = new Set([...t.drawn].filter(k => t.sleepers.has(k)));
    if (json(sorted(t.pipped)) !== json(sorted(onSleepers))) return `pips ${json(sorted(t.pipped))} against the drawn ring on sleepers ${json(sorted(onSleepers))}`;
    if (json(sorted(t.drawn)) !== json(sorted(want))) return `drawn ${json(sorted(t.drawn))} against the independent ring ${json(sorted(want))}`;
    const wantOnSleepers = new Set([...want].filter(k => t.sleepers.has(k)));
    if (json(sorted(t.pipped)) !== json(sorted(wantOnSleepers))) return `pips ${json(sorted(t.pipped))} against the independent ring on sleepers ${json(sorted(wantOnSleepers))}`;
    return null;
  }

  const HOWS = ['wait', 'move', 'heavy', 'shards'];
  test('the ring drawn after a step is exactly where sleepers gained a ring pip at its last boundary, and exactly an independent ring (3 programmes × 10 seeds, every 7th tile)', () => {
    const X = loadCore();
    const count = { cases: 0, pips: 0, tiles: 0, mid: 0, loud: 0 }, by = { wait: 0, move: 0, heavy: 0, shards: 0 };
    for (const { acc, seed, tiles } of MAPS) {
      const spots = [];
      for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[0].length; x++) if (stand(tiles, x, y)) spots.push([x, y]);
      for (let i = 0; i < spots.length; i += 7) {
        const [px, py] = spots[i];
        for (const how of HOWS) {
          // Where a step cannot be set up (no tile to step from, no one beside you to strike,
          // no floor for shards), that tile is still covered by the others.
          const t = trial(X, tiles, px, py, how);
          if (!t) continue;
          const bad = verdict(t);
          assert.equal(bad, null, `${acc} seed ${seed}, you at ${px},${py} after ${how}: ${bad}`);
          count.cases++; by[how]++; count.pips += t.pipped.size; count.tiles += t.sleepers.size;
          if (t.s.actors[0].next % 100) count.mid++;
          if (LOUD.has(t.map[py][px])) count.loud++;
        }
      }
    }
    // It covered every kind of step, many tiles, mid-turn decisions and loud floors.
    assert.ok(count.cases > 1000 && count.pips > 5000 && count.mid > 200 && count.loud > 200, json({ count, by }));
    for (const h of HOWS) assert.ok(by[h] > 200, json(by));
  });

  test('planted faults fail it: the drawn ring with the opposite still flag, and the oracle with RING_STILL 3', () => {
    const X = loadCore(), { acc, seed, tiles } = MAPS[0];
    // The view model's ring drawn with your still flag flipped; the pips are untouched.
    const ring = X.Vision.ring;
    X.Vision.ring = state => { const you = state.actors[0]; you.still = !you.still; try { return ring(state); } finally { you.still = !you.still; } };
    let caught = 0, tried = 0;
    try {
      const spots = [];
      for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[0].length; x++) if (stand(tiles, x, y)) spots.push([x, y]);
      for (let i = 0; i < spots.length && tried < 40; i += 7) for (const how of ['wait', 'move']) {
        const t = trial(X, tiles, spots[i][0], spots[i][1], how);
        if (!t || !t.pipped.size) continue;
        tried++;
        if (verdict(t)) caught++;
      }
    } finally { X.Vision.ring = ring; }
    assert.ok(tried >= 20 && caught === tried, `${acc} seed ${seed}: the flipped drawn ring was caught in ${caught} of ${tried} cases`);
    // The independent ring with the still radius 3 disagrees with the rules after a wait.
    let off = 0, waits = 0;
    const spots = [];
    for (let y = 0; y < tiles.length; y++) for (let x = 0; x < tiles[0].length; x++) if (stand(tiles, x, y)) spots.push([x, y]);
    for (let i = 0; i < spots.length && waits < 30; i += 7) {
      const t = trial(X, tiles, spots[i][0], spots[i][1], 'wait');
      if (!t.pipped.size) continue;
      waits++;
      assert.equal(verdict(t), null);
      if (verdict(t, 3)) off++;
    }
    assert.ok(waits >= 20 && off === waits, `RING_STILL 3 in the oracle was caught in ${off} of ${waits} waits`);
  });

  test('a 2×2 sleeper gains one ring pip when any one of its tiles is inside the ring, and none when none is', () => {
    const X = loadCore();
    const map = ['##############'].concat(Array(7).fill('#............#'), ['##############']);
    const big = (at, extra) => Object.assign({ sp: 'dummy', at, mode: 'dormant', size: 2, stats: { hp: 99, acc: 0, eva: 0, pad: 0, dmin: 1, dmax: 1 } }, extra);
    // You at (2, 3), still after a wait: radius 2. The body at (4, 5) covers (4..5, 5..6),
    // and only (4, 5) is within 2; the body at (5, 1) covers (5..6, 1..2), and none is.
    const s = X.Setup.room(1, { acc: 'T0', depth: 1, map, you: [2, 3], exhibits: [big([4, 5]), big([5, 1])] });
    const ev = X.Step.step(s, { a: 'wait' });
    const want = oracle(map, 2, 3, true);
    const inside = a => X.Actors.footprint(a).filter(([x, y]) => want.has(`${x},${y}`)).length;
    assert.equal(json(s.actors.slice(1).map(inside)), json([1, 0]));
    const pips = ev.filter(e => e.k === 'pip');
    assert.equal(json(pips.map(e => [e.who, e.delta, e.cause.k, e.cause.dist, e.cause.r])), json([[s.actors[1].uid, 1, 'ring', 2, 2]]));
    const drawn = ringCells(X, s, X.ViewModel.derive(s, { events: ev }));
    assert.equal(json(X.Actors.footprint(s.actors[1]).map(([x, y]) => drawn.has(`${x},${y}`))), json([true, false, false, false]), 'one of its four tiles is drawn inside');
    // Moving (radius 3): now the second body's nearest tile, (5, 2), is 3 away and in sight.
    const t = X.Setup.room(1, { acc: 'T0', depth: 1, map, you: [1, 3], exhibits: [big([4, 5]), big([5, 1])] });
    const ev2 = X.Step.step(t, { a: 'move', dir: 2 });
    assert.equal(json(ev2.filter(e => e.k === 'pip').map(e => [e.who, e.cause.dist, e.cause.r])), json([[t.actors[1].uid, 2, 3], [t.actors[2].uid, 3, 3]]));
  });
};
