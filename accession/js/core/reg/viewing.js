// ACCESSION — registry fragment: viewing the Centrepiece: the viewed event and the refusals of
// view (BUILD.md §5.1, §4.2, §8.7), owned by PG-VIEW. M4's skeleton made it, with the one refusal
// the skeleton's `view` gives (rules/viewing.js): no_centrepiece, every view refused while there
// is no Centrepiece to view, as in every visit until PG-VIEW fills viewing. PG-VIEW fills the
// rest, after W0a has moved here whatever of reg/system.js's M4 placeholders is its.
'use strict';
(() => {
  const R = Registry;
  // A view with no Centrepiece to view (§4.2). m4-skeleton makes a real `view` refuse with it,
  // with nothing changed; its invariant is the system's (a refusal changes nothing).
  R.define('REFUSALS', 'no_centrepiece', { built: 'M4', ready: 'unit', tests: ['m4-skeleton.test.js'], inv: 'system' });
  // PG-VIEW fills: the viewed event, its cause and the other refusals of view.
})();
