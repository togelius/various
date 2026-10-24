// ACCESSION — consumables (BUILD.md §8.6). W0c names the two calls the use action makes, with
// neutral bodies; W0e and W1-CONSUMABLES build the rest.
'use strict';
const Consumables = (() => {
  const useLegal = state => [];                            // [stub → W1-CONSUMABLES] use(uid[, x, y]) of a consumable
  const useAction = (state, action, ev) => 'not_built';    // [stub → W1-CONSUMABLES]
  return { useLegal, useAction };
})();
