// ACCESSION — registry fragment: the wall panels and their banners (BUILD.md §5.1, §5.2), owned
// by W-PANELS. M4's skeleton made it; reg/system.js held no placeholder of its to move here (M4's
// Wave 0). W-PANELS filled it with the panel fixture's entry. A panel's rule sentence is its
// module's (Registry.MODULES[id].sentence, each module's fragment), never a word of its own, so
// it adds no event, cause or refusal: reading one is `read`, refused as every fixture is
// (label_none, label_far: rules/fixtures.js), and changes nothing.
'use strict';
(() => {
  const R = Registry;
  // A wall panel (js/core/panels.js): read for nothing, within READ_RANGE and in sight, it
  // gives its prose and, while its module is on, that module's rule sentence. Unit-tested
  // (test/m4-panels.test.js: placed, read and refused by real actions, at depths 1–7); its
  // joined-up scenario is BEHAVIOUR-M4's.
  R.define('FIXTURES', 'panel', { built: 'M4', ready: 'unit', tests: ['m4-panels.test.js'], inv: 'system', icon: 'reads', covers: [],
    params: { range: 'N:READ_RANGE' },
    clause: 'A wall panel by the first entrance of the room it introduces: read within {range} tiles, in sight, at no cost in time; reading it changes nothing.' });
})();
