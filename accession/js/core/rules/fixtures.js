// ACCESSION — reading fixtures (BUILD.md §4.2, §8.8; plan A4): `read(x, y)` reads any fixture
// through Fixtures.read, and each kind's reader registers with Fixtures.addReader from its own
// file: the plaque (moved from consumables.js), the lectern (rules/viewing.js) and the panel
// (js/core/panels.js). M4's skeleton made each function with its signature and a neutral
// body; W0d1 fills them and routes `read` through them. Frozen after M4's Wave 0.
'use strict';
const Fixtures = (() => {
  // W0d1 fills: kind k's reader, fn(state, f) → {text, effects} or a refusal code; once a kind.
  function addReader(k, fn) {}
  // W0d1 fills: read fixture f with its kind's reader: {text, effects}, or a refusal code.
  function read(state, f) { return 'label_none'; }
  // W0d1 fills: the readable fixture at (x, y), or null.
  function at(state, x, y) { return null; }

  return { addReader, read, at };
})();
