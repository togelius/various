// ACCESSION — closing doors (BUILD.md §4.2, §8.2), owned by W1-WAKE-B. Opening a door is a
// bump (Step.moveInto: an ordinary door for anyone, a staff door for you at its grade,
// Cases.enter). Closing is an action of yours, close(x, y):
//   - the door is beside you, an open door (') or an open staff door (s), and you could
//     step into it from where you stand (the corner rule, as for opening it by a bump);
//   - no actor stands in its doorway (§8.2);
//   - it closes (' becomes +, s becomes S) for COST_DOOR, with a closed event and then a
//     soft noise at the door, heard from there as an opening is.
'use strict';
const Doors = (() => {
  // Open doors, and what each becomes when it is closed (§4.1: the only door changes).
  const SHUT = { "'": '+', s: 'S' };
  const shut = ch => ch === "'" || ch === 's';

  // Doors.check(state, action) → null if you may close (action.x, action.y) now, else the
  // refusal code: no_door (not an open door beside you), doorway_occupied, corner.
  function check(state, action) {
    const you = state.actors[0], m = state.dept, x = action && action.x, y = action && action.y;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return 'no_door';
    const dx = x - you.x, dy = y - you.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1 || !shut(Grid.ch(m, x, y))) return 'no_door';
    if (Actors.at(state, x, y)) return 'doorway_occupied';
    let d = 0;
    while (Grid.DX[d] !== dx || Grid.DY[d] !== dy) d++;
    if (!Grid.canStep(m, you.x, you.y, d)) return 'corner';
    return null;
  }

  // close(x, y) (§4.2).
  Actions.define('close', {
    legal(state) {
      const you = state.actors[0], out = [];
      for (let d = 0; d < 8; d++) {
        const act = { a: 'close', x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] };
        if (check(state, act) === null) out.push(act);
      }
      return out;
    },
    candidates(state) {
      const you = state.actors[0], out = [];
      for (let d = 0; d < 8; d++) out.push({ a: 'close', x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] });
      return out.concat([{ a: 'close', x: you.x, y: you.y }, { a: 'close', x: you.x + 2, y: you.y }, { a: 'close' }]);
    },
    apply(state, action, ev) {
      const code = check(state, action);
      if (code) return code;
      const you = state.actors[0], m = state.dept, x = action.x, y = action.y;
      Grid.set(m, x, y, SHUT[Grid.ch(m, x, y)]);
      Causes.emit(state, ev, 'closed', { who: you.uid, x, y });
      Noise.emit(state, x, y, 'soft', { k: 'close', by: you.uid }, ev);
      return Actors.cost(state, you, N.COST_DOOR, 'act');
    },
  });

  return { check };
})();
