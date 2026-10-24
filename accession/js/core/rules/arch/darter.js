// ACCESSION — the darter archetype's hooks (BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js),
// owned by W1-ARCH-A. Its Behaviour-line clause and registry entry are in js/core/reg/arch-a.js.
//
// "Moves two tiles a turn; strikes from beside you for {dmg}, then at once steps back
// {DARTER_STEP_BACK} tile if it has room."
//   - It is fast (the registry's speed): its steps cost half (§8.1), its blows the usual.
//   - Hunting and beside you, with a blow the rules allow (Combat.canStrike), it strikes,
//     then steps back DARTER_STEP_BACK times in the same action: the blow and the step back
//     together cost one blow. Each step back is a real step (the exhibits' step rule, §8.2)
//     to an empty tile beside it that is farther from you by walking distance, and never
//     into a closed door (which would open the door, not step back); ties are broken on its
//     own ai stream, as every exhibit move is. With no such tile it is cornered, and stays.
//   - Otherwise it acts as its mode says (AI.byMode): it walks toward you, two tiles a turn.
'use strict';
(() => {
  // One step back from `you`, or false if a is cornered.
  function stepBack(state, a, you, ev) {
    const m = state.dept, dist = AI.field(state, a, you, 'onto'), here = dist[a.y * m.w + a.x];
    if (here < 0) return false;
    const options = [];
    for (let d = 0; d < 8; d++) {
      const nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d];
      if (!Grid.canStep(m, a.x, a.y, d, 'exhibit') || Grid.closedDoor(m, nx, ny)) continue;
      if (dist[ny * m.w + nx] <= here) continue;                  // not farther (or unreached: -1)
      if (Actors.at(state, nx, ny, a) || !Archetypes.mayStep(state, a, nx, ny)) continue;
      options.push(d);
    }
    if (!options.length) return false;
    const d = options.length === 1 ? options[0] : Rng.stream(state, 'ai/' + a.uid).pick(options);
    const x = a.x, y = a.y;
    Step.moveInto(state, a, d, ev);
    if (a.x === x && a.y === y) return false;
    AI.afterStep(state, a, ev);
    return true;
  }

  Archetypes.add('darter', {
    // Fast for its steps only (the default, stated): a blow costs the usual.
    speedApplies: a => ['move'],
    act(state, a, ev) {
      if (a.mode !== 'hunting' || (a.size || 1) !== 1) return null;
      const you = state.actors[0];
      if (you.gone) return null;
      const cost = AI.strike(state, a, you, ev);
      if (cost === null) return null;
      for (let i = 0; i < N.DARTER_STEP_BACK; i++) if (state.over || a.gone || !stepBack(state, a, you, ev)) break;
      return cost;
    },
  });
})();
