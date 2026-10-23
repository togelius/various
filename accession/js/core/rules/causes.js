// ACCESSION — the cause records kept in the state for death recaps (BUILD.md §3.4).
'use strict';
const Causes = (() => {
  // Records are copied in, so nothing outside the state can reach into it.
  function record(state, rec) {
    state.causes.push(JSON.parse(JSON.stringify(rec)));
    if (state.causes.length > N.CAUSE_RECORDS) state.causes.splice(0, state.causes.length - N.CAUSE_RECORDS);
  }
  return { record };
})();
