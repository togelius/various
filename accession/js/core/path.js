// ACCESSION — a path for a tap (BUILD.md §4.2): the UI turns it into single moves, so a
// replay never holds a path. Shortest by the step rule, round other actors' footprints and
// never through one; ties broken in direction order, so the same tap always gives the same
// path. If actors close every way, it goes as far as the way is clear.
'use strict';
const Path = (() => {
  function to(state, tx, ty) {
    const m = state.dept, you = state.actors[0];
    if (!Grid.inside(m, tx, ty) || (tx === you.x && ty === you.y)) return [];
    // A tap on any tile of an actor aims at its whole footprint: the path ends with the
    // step into its nearest tile, which is a blow (§7.1).
    const aim = Actors.at(state, tx, ty, you), target = [];
    if (aim) { for (let dy = 0; dy < (aim.size || 1); dy++) for (let dx = 0; dx < (aim.size || 1); dx++) if (Grid.walkable(m, aim.x + dx, aim.y + dy)) target.push([aim.x + dx, aim.y + dy]); }
    else if (Grid.walkable(m, tx, ty)) target.push([tx, ty]);
    if (!target.length) return [];
    // Every other actor's tiles cost more than the whole map, so the path goes round them.
    const n = m.w * m.h, busy = new Uint8Array(n);
    for (const a of state.actors) {
      if (a === you || a === aim || a.gone) continue;
      for (let dy = 0; dy < (a.size || 1); dy++) for (let dx = 0; dx < (a.size || 1); dx++) if (Grid.inside(m, a.x + dx, a.y + dy)) busy[(a.y + dy) * m.w + a.x + dx] = 1;
    }
    let d = Grid.distances(m, target, n, (x, y) => busy[y * m.w + x] ? n : 0);
    // No way round: follow the plain walking distance and stop where an actor stands.
    if (d[you.y * m.w + you.x] < 0) d = Grid.distances(m, target, n);
    const out = [];
    let x = you.x, y = you.y, here = d[y * m.w + x];
    if (here < 0) return [];
    while (here > 0) {
      let best = -1;
      for (let k = 0; k < 8; k++) {
        if (!Grid.canStep(m, x, y, k)) continue;
        const nx = x + Grid.DX[k], ny = y + Grid.DY[k], v = d[ny * m.w + nx];
        if (v < 0 || v >= here || busy[ny * m.w + nx]) continue;
        best = k; break;
      }
      if (best < 0) break;
      x += Grid.DX[best]; y += Grid.DY[best]; here = d[y * m.w + x];
      out.push([x, y]);
    }
    return out;
  }
  const dirTo = (a, b) => { for (let k = 0; k < 8; k++) if (a[0] + Grid.DX[k] === b[0] && a[1] + Grid.DY[k] === b[1]) return k; return -1; };
  return { to, dirTo };
})();
