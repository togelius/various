// ACCESSION — the closing clock's budget (BUILD.md §8.4): the bell at B, the night watch at
// B + G, from the department's tour length.
'use strict';
const Clock = (() => {
  function budget(ltour) {
    const B = Int.round10(N.CLOCK_MULT_PCT * ltour + N.CLOCK_ADD * 100, 100);
    const G = Math.max(N.STAGE_GAP_MIN, Int.round10(N.STAGE_GAP_PCT * B, 100));
    return { B, G };
  }
  return { budget };
})();
