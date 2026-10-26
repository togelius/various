// ACCESSION — the axis_sniper archetype's hooks (BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js),
// owned by W1-ARCH-B. Its Behaviour-line clause and registry entry are in js/core/reg/arch-b.js;
// its special is the `line` beam (Specials, Ranged.beam).
//
// An axis_sniper hunting you, while it sees you, at each of its actions:
//   1. if it has a line on you, it aims: you share its row or column, within AXIS_BEAM_RANGE,
//      and its beam's way out reaches your tile before any tile that blocks sight and before
//      any reflector (it does not fire into a dish or a glass body, which would send the
//      beam back at it). It marks the beam's tiles (Specials.tiles 'line', Specials.mark);
//      if another pending damage mark holds one of them (§8.1, no overlaps), it waits
//      instead, holding its aim;
//   2. otherwise it walks toward the nearest tile (by its own walking distance, ties in
//      row-major order) from which it would have that line;
//   3. otherwise it waits.
// It never strikes, from beside you or anywhere: it has no blow and shoots no bolts. Its mark
// resolves at its next action (AI.act, Specials.resolve). Out of sight or not hunting, it
// acts by its mode (AI.byMode), which never strikes an exhibit that does not see you. In an
// intact case it may still aim, since a beam passes glass, but it cannot step out.
'use strict';
(() => {
  // Does a beam from (x, y) along a row or column reach you before anything that blocks
  // sight and before a reflector, within AXIS_BEAM_RANGE? Your own tile must let sight in
  // (a cloud over you stops the beam short), as every tile on the way must. `body` is the
  // body that would stand there.
  function line(state, body, x, y) {
    const m = state.dept, you = state.actors[0];
    if ((x !== you.x && y !== you.y) || (x === you.x && y === you.y)) return false;
    const dx = Math.sign(you.x - x), dy = Math.sign(you.y - y), n = Math.max(Math.abs(you.x - x), Math.abs(you.y - y));
    if (n > N.AXIS_BEAM_RANGE) return false;
    for (let s = 1; s <= n; s++) {
      const tx = x + dx * s, ty = y + dy * s;
      if (!Grid.clear(m, tx, ty)) return false;
      const b = s < n ? Actors.at(state, tx, ty, body) : null;
      if (b && Ranged.isReflector(state, b)) return false;
    }
    return true;
  }

  // The tile nearest a (by a's walking distance; ties in row-major order) that a could stand
  // on, with a line on you; null if none.
  function post(state, a) {
    const m = state.dept, you = state.actors[0], R = N.AXIS_BEAM_RANGE;
    const fromMe = Grid.distances(m, [[a.x, a.y]], m.w * m.h, null, 'exhibit');
    let best = null, bd = -1;
    const consider = (x, y) => {
      if (!Grid.inside(m, x, y) || !Grid.walkable(m, x, y, 'exhibit')) return;
      const d = fromMe[y * m.w + x];
      if (d < 0 || (bd >= 0 && (d > bd || (d === bd && (y > best[1] || (y === best[1] && x > best[0])))))) return;
      if (Actors.at(state, x, y, a) || !line(state, a, x, y)) return;
      best = [x, y]; bd = d;
    };
    for (let k = -R; k <= R; k++) if (k !== 0) { consider(you.x + k, you.y); consider(you.x, you.y + k); }
    return best;
  }

  function act(state, a, ev) {
    if (a.mode !== 'hunting' || !AI.sees(state, a)) return null;
    if (line(state, a, a.x, a.y)) {
      const tiles = Specials.tiles(state, a, 'line');
      if (Specials.canMark(state, a, 'line', tiles)) return Specials.mark(state, a, 'line', tiles, ev);
      return AI.wait(state, a, ev);
    }
    const goal = Cases.encased(state, a) ? null : post(state, a);
    if (goal) {
      const r = AI.towards(state, a, goal, 'onto', ev);
      if (r !== null) return r;
    }
    return AI.wait(state, a, ev);
  }

  // The odds readout's lines (Archetypes.readout, read by Labels): it has no blow, so the
  // label gives no chance of its hitting you; its beam has its own line (Specials.readout).
  const readout = () => [{ k: 'noBlow' }];

  Archetypes.add('axis_sniper', { act, readout });
})();
