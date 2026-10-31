// ACCESSION — the module copies_weaken (A.4; BUILD.md §5.4): "When an original is broken, its
// spares lose heart." Its rules register here with Modules.define (rules/modules.js) in the
// form of §5.4. It has no archetype of its own: its groups are copy-group instances and
// `copyOf` (§4.1), and CopiesWeaken.addGroup lets a Centrepiece make its pieces a group, so
// this module needs no Centrepiece package. Its entries are in js/core/reg/mod-copies.js and
// its sentences in js/core/text/mod-copies.js. Owned by MOD-COPIES.
'use strict';
const CopiesWeaken = (() => {
  // MOD-COPIES fills: make `group` a copy group, its original's fall weakening its spares.
  function addGroup(state, group) {}
  // MOD-COPIES fills: Modules.define('copies_weaken', {…}).
  return { addGroup };
})();
