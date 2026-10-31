// ACCESSION — the department's wall panels and their banners (plan D7.1): a panel by each
// room's first entrance, read like a plaque, and its banner on first entering the room. The
// panel's reader registers with Fixtures.addReader('panel', …) from here. M4's skeleton made
// each function with its signature and a neutral body; W-PANELS fills them. The panels' prose
// is each pack's part, content/<acc>-panels.js.
'use strict';
const Panels = (() => {
  // W-PANELS fills: place the pack's panels on the plan, as fixtures {k: 'panel', x, y, key}.
  function place(state, plan, pack) {}
  // W-PANELS fills: the banner of the panel `key` (at most 50 words), or null.
  function banner(state, key) { return null; }

  return { place, banner };
})();
