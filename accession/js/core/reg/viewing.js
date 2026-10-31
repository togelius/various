// ACCESSION — registry fragment: viewing the Centrepiece: the viewed event and the refusals of
// view (BUILD.md §5.1, §4.2, §8.7), owned by PG-VIEW. M4's skeleton made it, with the one refusal
// the skeleton's `view` gives (rules/viewing.js): no_centrepiece, every view refused while there
// is no Centrepiece to view, as in every visit until PG-VIEW fills viewing. M4's Wave 0 (W0a)
// moved here, from reg/system.js, the viewed event, with the schema and cause of M4 plan A5.
// PG-VIEW fills the rest.
'use strict';
(() => {
  const R = Registry;
  // A view with no Centrepiece to view (§4.2). m4-skeleton makes a real `view` refuse with it,
  // with nothing changed; its invariant is the system's (a refusal changes nothing).
  R.define('REFUSALS', 'no_centrepiece', { built: 'M4', ready: 'unit', tests: ['m4-skeleton.test.js'], inv: 'system' });

  // A turn of viewing (§8.7): who viewed, the Centrepiece viewed (of), and the views in a row so
  // far (n, of VIEW_TURNS).
  R.defineEvent('viewed', { fields: { who: 'uid', of: 'uid', n: 'int' }, built: 'M4' });
  R.defineCause('viewed', 'view', { fields: {}, built: 'M4' });
  // PG-VIEW fills: the other refusals of view.
})();
