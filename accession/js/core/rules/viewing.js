// ACCESSION — viewing the Centrepiece (BUILD.md §4.2, §8.7; plan A4): the `view` action, defined
// here once and handed to Viewing.legal, Viewing.candidates and Viewing.apply. M4's skeleton
// made them with their signatures and neutral bodies, so until PG-VIEW fills them `view` is
// never legal and every view is refused `no_centrepiece` (there is none to view yet), and no
// state changes. dept.view {n, turn} is absent until a view writes it, read through
// Viewing.of.
'use strict';
const Viewing = (() => {
  // PG-VIEW fills: the legal views now ([{a: 'view'}] on the reading tile, else []).
  function legal(state) { return []; }
  // PG-VIEW fills: a superset of the legal views, for the parity test (§4.2).
  function candidates(state) { return [{ a: 'view' }]; }
  // PG-VIEW fills: one viewing turn's cost in ticks, or a refusal code.
  function apply(state, action, ev) { return 'no_centrepiece'; }
  // PG-VIEW fills: this visit's views so far, {n, turn}, or null.
  function of(state) { return null; }

  Actions.define('view', {
    legal: state => Viewing.legal(state),
    candidates: state => Viewing.candidates(state),
    apply: (state, action, ev) => Viewing.apply(state, action, ev),
  });

  return { legal, candidates, apply, of };
})();
