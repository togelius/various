// ACCESSION — placing a department's exhibits, and the checks a populated plan must pass
// (BUILD.md §5.5; plan A10). M4's skeleton made each function with its signature and a
// neutral body: W0c moves M3's stand-in placement here from dept.js and builds the
// validator registry, and D-POP fills the placement from gallery lists. Frozen once D-POP
// has landed.
//
// A validator registers with Populate.addValidator(id, fn) from its own file
// (js/core/layout/lv6.js, treasure.js, runner.js, lv-m4.js, in that load order), so none
// edits this file or dept.js: fn(state, plan) → null, or {reason, tiles} (a sentence, and
// the tiles to mark on the plan's text). Populate.validate runs them in the order added and
// gives the first rejection with its id, which makes the layout attempt fail and reseed.
//
// plan.intro, the stamped Intro, has the shape js/core/layout/stamp.js gives (LStamp.shape).
'use strict';
const Populate = (() => {
  // W0c fills (M3's stand-in, moved from dept.js); D-POP replaces it: place the pack's exhibits.
  function exhibits(state, plan, pack, base) {}
  // W0c fills: register validator `id`, once; fn(state, plan) → null or {reason, tiles}.
  function addValidator(id, fn) {}
  // W0c fills: run every validator in the order added; the first rejection as {id, reason, tiles}, or null.
  function validate(state, plan) { return null; }
  // D-POP fills: the gallery placed in room roomId, or null.
  function galleryOf(state, roomId) { return null; }

  return { exhibits, addValidator, validate, galleryOf };
})();
