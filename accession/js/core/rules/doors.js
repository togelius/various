// ACCESSION — closing doors (BUILD.md §4.2, §8.2). W0d names the close(x, y) action with no
// legal actions, so step() refuses it; W1-WAKE-B owns the file after, and builds it: a door
// beside you, with no actor in its doorway, closes for COST_DOOR with a soft noise. Opening
// a door is a bump (Step.moveInto).
'use strict';
const Doors = (() => {
  // close(x, y) (§4.2). [stub → W1-WAKE-B] legal [], and every candidate is refused.
  Actions.define('close', {
    legal: state => [],
    candidates(state) {
      const you = state.actors[0], out = [];
      for (let d = 0; d < 8; d++) out.push({ a: 'close', x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] });
      return out.concat([{ a: 'close' }]);
    },
    apply: (state, action, ev) => 'not_built',
  });
  return {};
})();
