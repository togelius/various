// ACCESSION — your kit (BUILD.md §8.5). W0c names the calls the action core makes, each with
// a neutral body: Kit.settle at the end of every step (§8.1) and Kit.ringDelta for your ring
// do nothing until W0e builds the kit; recharge and the use of instruments and Restoration
// kits wait for W1-KIT.
'use strict';
const Kit = (() => {
  function settle(state) {}                                // [stub → W0e] writes Kit.derive onto you
  const ringDelta = state => 0;                            // [stub → W0e, W1-KIT] what your kit adds to your ring
  function recharge(state, ev) {}                          // [stub → W1-KIT] turn boundary step 2
  const useLegal = state => [];                            // [stub → W1-KIT] use(uid, …) of an instrument or kit
  const useAction = (state, action, ev) => 'not_built';    // [stub → W1-KIT]
  return { settle, ringDelta, recharge, useLegal, useAction };
})();
