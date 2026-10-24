// ACCESSION — a visit's options (BUILD.md §3.6, §10.2), frozen after M3's Wave 0: the hooks
// that paired bots, reports and tests use to ask "does this matter?". rulesOff switches off
// a modifier (M3) or a module (M4) by id; without removes actors by uid (they are marked
// gone, so nothing else is reshuffled, §3.2); invulnerable keeps your health at 1 or more.
'use strict';
const Options = (() => {
  // A fresh, plain options object; o may give any of the three.
  function make(o) {
    o = o || {};
    return { rulesOff: (o.rulesOff || []).slice(), without: (o.without || []).slice(), invulnerable: !!o.invulnerable };
  }
  // Is the rule `id` switched off for this visit?
  const off = (state, id) => !!(state.options && state.options.rulesOff.includes(id));
  return { make, off };
})();
