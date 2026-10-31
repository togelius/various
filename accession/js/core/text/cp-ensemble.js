// ACCESSION — sentences: A.4's Centrepiece, mp_ensemble (the Ordinance) (BUILD.md §3.4, §5.5),
// owned by ENSEMBLE-CORE. M4's skeleton made it; M4's Wave 0 (W0a) gave the phase event's cause
// for a special taken on its sentence. ENSEMBLE-CORE fills the rest.
'use strict';
(() => {
  Text.defineCause('phase', 'inherited', (e, w) => e.cause.from !== undefined
    ? `${w.Name(e.who)} took on the special of ${w.name(e.cause.from)}, which fell.`
    : `${w.Name(e.who)} took on the special of a piece that fell.`);
})();
