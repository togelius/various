// LV7, LV13 for the chime and the hall's case (M4 plan D-VALIDATORS; js/core/layout/lv-m4.js),
// over the shared sweep (test/m4-sweep.test.js: seeds 1–100 of each department at each depth
// 1–7, as Dept.create makes them). For every department:
//   - each passes it, unless it is the certified fallback taken despite that one's rejection
//     (Dept.generate says so), which is counted: at most 1% of a department's;
//   - so LV7 is vacuous at Cabinet size: no dead end with no reward reaches DEAD_END_REWARD;
//   - on M.11, seeds 1–LINE_SEEDS of each depth, an oracle written apart from lv-m4.js: for
//     each station whose line (at its reach, HourlyDemonstration.reach) is longer than its
//     period less DEMO_WINDOW, the fewest turns running a way from where you stand to an exit
//     must stand on it, found by a search over (tile, turns running so far) states, each its
//     own (no state stands for another), for each bound from 0 up; it equals LVM4.windows'
//     run, and leaves at least DEMO_WINDOW; the First Landing's line, which every way
//     crosses, is among them in every department;
//   - on seed ORACLE_SEED of each depth, an LV7 oracle: a tile you could stand on is in a dead
//     end when taking away the tiles of one room, or one tile of an opening, leaves it
//     reachable neither from the entrance nor from any exit; those tiles are exactly the
//     tiles of LVM4.deadEnds' branches, the farthest of them from where it was cut off is as
//     far as their deepest, and every dead end holds the Centrepiece hall.
'use strict';
module.exports = C => {
  const { N, Grid, Actors, Cases, HourlyDemonstration, LVM4 } = C;
  const ORACLE_SEED = 1, LINE_SEEDS = 50;
  const tally = { made: { S9: 0, A4: 0, M11: 0 }, fallback: {}, deadEnds: 0, lines: 0, cuts: 0, oracle: 0 };

  // The tiles you could stand on, staff doors left out (Grid.walkable as you walk; 'S', 's'),
  // as a mask, and every step between two of them, by tile (k → [u…]).
  function stands(m) {
    const w = m.w, n = w * m.h, ok = new Uint8Array(n);
    for (let k = 0; k < n; k++) { const x = k % w, y = (k - x) / w, c = m.tiles[y][x]; ok[k] = Grid.walkable(m, x, y) && c !== 'S' && c !== 's' ? 1 : 0; }
    return ok;
  }
  function standing(m) {
    const w = m.w, n = w * m.h, ok = stands(m), steps = [];
    for (let k = 0; k < n; k++) {
      const x = k % w, y = (k - x) / w, out = [];
      if (ok[k]) for (let d = 0; d < 8; d++) { const u = (y + Grid.DY[d]) * w + x + Grid.DX[d]; if (Grid.canStep(m, x, y, d) && ok[u]) out.push(u); }
      steps.push(out);
    }
    return { ok, steps };
  }
  // A search from starts over the tiles not taken away (gone) by the steps: the tiles reached.
  function reach(n, steps, ok, starts, gone) {
    const seen = new Uint8Array(n), q = [];
    for (const k of starts) if (ok[k] && !gone[k] && !seen[k]) { seen[k] = 1; q.push(k); }
    for (let i = 0; i < q.length; i++) for (const u of steps[q[i]]) if (!seen[u] && !gone[u]) { seen[u] = 1; q.push(u); }
    return seen;
  }

  // ---- LV13's oracle ----
  // The fewest turns running on the line that a way to an exit needs, or null with no way at all.
  function fewest(s, open, line) {
    const m = s.dept, w = m.w, n = w * m.h, you = s.actors[0], exit = new Uint8Array(n), on = new Uint8Array(n);
    for (const [x, y] of m.exits) exit[y * w + x] = 1;
    for (const [x, y] of line) on[y * w + x] = 1;
    for (let bound = 0; bound <= line.length; bound++) {
      const B = bound + 1, seen = new Uint8Array(n * B), qk = new Int32Array(n * B), qr = new Int32Array(n * B);
      let len = 1;
      qk[0] = you.y * w + you.x; seen[qk[0] * B] = 1;
      for (let i = 0; i < len; i++) {
        const k = qk[i], r = qr[i], x = k % w, y = (k - x) / w;
        if (exit[k]) return bound;
        for (let d = 0; d < 8; d++) {
          const u = (y + Grid.DY[d]) * w + x + Grid.DX[d], nr = on[u] ? r + 1 : 0;
          if (nr > bound || !Grid.canStep(m, x, y, d) || !open[u] || seen[u * B + nr]) continue;
          seen[u * B + nr] = 1; qk[len] = u; qr[len] = nr; len++;
        }
      }
    }
    return null;
  }
  // Where a way may step: a tile you could stand on, no tile of the Centrepiece hall, none an
  // exhibit asleep or in a case stands on.
  function ways(s) {
    const m = s.dept, w = m.w, open = stands(m), halls = m.rooms.filter(r => r.role === 'centre').map(r => r.id);
    for (let k = 0; k < open.length; k++) if (halls.includes(m.roomOf[(k - k % w) / w][k % w])) open[k] = 0;
    for (const a of s.actors.slice(1)) if (!a.gone && (a.mode === 'dormant' || Cases.encased(s, a))) for (const [x, y] of Actors.footprint(a)) open[y * w + x] = 0;
    return open;
  }
  function lines(s) {
    const out = [], w = LVM4.windows(s, true);
    if (!HourlyDemonstration.of(s)) return out;
    let open = null;
    for (const a of HourlyDemonstration.stations(s)) {
      const P = HourlyDemonstration.period(s, a), L = HourlyDemonstration.reach(s, a);
      if (L.length <= P - N.DEMO_WINDOW) continue;
      tally.lines++;
      if (!open) open = ways(s);
      const run = fewest(s, open, L), mine = w.find(f => f.uid === a.uid);
      if (run) tally.cuts++;
      if (!mine || mine.run !== run) out.push(`${a.uid}'s line needs ${run} turns running on it, LVM4.windows says ${mine ? mine.run : 'nothing'}`);
      else if (run !== null && P - run < N.DEMO_WINDOW) out.push(`${a.uid}'s line leaves a window of ${P - run}`);
      else if (a.uid.includes('.intro.') && !run) out.push(`${a.uid}'s line, the First Landing's, cuts nothing off`);
    }
    if (!out.length && !w.some(f => f.uid.includes('.intro.'))) out.push('the First Landing\'s line is not judged');
    return out;
  }

  // ---- LV7's oracle ----
  function deadTiles(s) {
    const m = s.dept, w = m.w, n = w * m.h, { ok, steps } = standing(m), nodes = new Map();
    for (let k = 0; k < n; k++) {
      if (!ok[k]) continue;
      const r = m.roomOf[(k - k % w) / w][k % w], key = r ? `r${r}` : `t${k}`;
      if (!nodes.has(key)) nodes.set(key, []);
      nodes.get(key).push(k);
    }
    const start = m.entrance[1] * w + m.entrance[0], exits = m.exits.map(([x, y]) => y * w + x), none = new Uint8Array(n), all = reach(n, steps, ok, [start], none);
    const dead = new Map(), gone = new Uint8Array(n);
    for (const [, cut] of [...nodes.entries()].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
      for (const k of cut) gone[k] = 1;
      const a = reach(n, steps, ok, [start], gone), b = reach(n, steps, ok, exits, gone), inside = new Uint8Array(n);
      let any = false;
      for (let k = 0; k < n; k++) if (all[k] && !gone[k] && !a[k] && !b[k]) { inside[k] = 1; any = true; }
      if (any) {
        // How far each is from the tiles taken away.
        const dd = new Int32Array(n).fill(-1), q = cut.slice();
        let far = 0;
        for (const k of cut) dd[k] = 0;
        for (let i = 0; i < q.length; i++) for (const u of steps[q[i]]) if (inside[u] && dd[u] < 0) { dd[u] = dd[q[i]] + 1; far = Math.max(far, dd[u]); q.push(u); }
        for (let k = 0; k < n; k++) if (inside[k]) dead.set(k, Math.max(dead.get(k) || 0, far));
      }
      for (const k of cut) gone[k] = 0;
    }
    return dead;
  }

  function each(d) {
    const { state: s, acc, seed, made } = d, out = [];
    tally.made[acc]++;
    for (const [id, r] of [['lv7', LVM4.lv7(s, null)], ['lv13', LVM4.lv13(s, null)], ['hall_case', LVM4.hallCase(s, null)]]) {
      if (!r) continue;
      if (made.fallback && made.rejected && made.rejected.id === id) { tally.fallback[`${acc} ${id}`] = (tally.fallback[`${acc} ${id}`] || 0) + 1; continue; }
      out.push(`${id} rejects the department made: ${r.reason}`);
    }
    if (acc === 'M11' && seed <= LINE_SEEDS) out.push(...lines(s));
    if (seed === ORACLE_SEED) {
      tally.oracle++;
      const ends = LVM4.deadEnds(s, true), dead = deadTiles(s), mine = new Set();
      for (const b of ends) {
        tally.deadEnds++;
        for (const k of b.tiles) mine.add(k);
        if (b.reward !== 'centrepiece') out.push(`a dead end of rooms ${b.rooms.join(', ')} does not hold the Centrepiece hall (${b.reward || 'no reward'}, ${b.depth} deep)`);
      }
      const oracleDeep = Math.max(0, ...dead.values()), deep = Math.max(0, ...ends.map(b => b.depth));
      if (dead.size !== mine.size || [...dead.keys()].some(k => !mine.has(k))) out.push(`LV7's dead ends hold ${mine.size} tiles, the oracle's ${dead.size}`);
      else if (oracleDeep !== deep) out.push(`LV7's deepest dead end reaches ${deep}, the oracle's ${oracleDeep}`);
    }
    return out.length ? out.slice(0, 3).join('; ') : null;
  }

  function done() {
    const out = [];
    for (const k of Object.keys(tally.fallback).sort()) { const acc = k.split(' ')[0]; if (tally.fallback[k] * 100 > tally.made[acc]) out.push(`${k} sends ${tally.fallback[k]} of ${tally.made[acc]} departments to the fallback, over 1%`); }
    if (tally.made.M11 && !tally.cuts) out.push('no station\'s line cut a way');
    if (tally.oracle && !tally.deadEnds) out.push('no dead end was met');
    return out.length ? out.join('; ') : null;
  }
  return { each, done, tally };
};
