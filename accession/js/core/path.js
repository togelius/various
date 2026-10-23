// ACCESSION — a path for a tap (BUILD.md §4.2): the UI turns it into single moves, so a
// replay never holds a path. Shortest by the step rule, round other actors; ties broken in
// direction order, so the same tap always gives the same path.
'use strict';
const Path = (() => {
  function to(state, tx, ty) {
    const m = state.dept, you = state.actors[0];
    if (!Grid.inside(m, tx, ty) || (tx === you.x && ty === you.y)) return [];
    const target = Grid.walkable(m, tx, ty) ? [[tx, ty]] : [];
    if (!target.length) return [];
    const d = Grid.distances(m, target, m.w * m.h);
    const out = [];
    let x = you.x, y = you.y, here = d[y * m.w + x];
    if (here < 0) return [];
    while (here > 0) {
      let best = -1;
      for (let k = 0; k < 8; k++) {
        if (!Grid.canStep(m, x, y, k)) continue;
        const nx = x + Grid.DX[k], ny = y + Grid.DY[k], v = d[ny * m.w + nx];
        if (v < 0 || v >= here) continue;
        const busy = Actors.at(state, nx, ny);
        if (busy && !(nx === tx && ny === ty)) continue;
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
