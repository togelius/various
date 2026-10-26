// ACCESSION — the invariant of the backbone's refusals (BUILD.md §4.2, §5.3 check 1), named
// by the REFUSALS entries of js/core/reg/system.js: "An illegal action is refused before it
// costs anything." Checked after every step of every scenario, monkey, soak and bot run
// (tools/invariants.js), whatever refused the action:
//   refusal_changes_nothing   a step with a refused event has no other event, and leaves
//                             the state's hash and its streams exactly as they were.
'use strict';
module.exports = (C) => {
  const json = x => JSON.stringify(x);
  const refusal = {
    id: 'refusal_changes_nothing',
    check(pre, events, post) {
      const r = events.find(e => e.k === 'refused');
      if (!r) return null;
      if (events.length !== 1) return `the refusal ${r.reason} came with ${events.length - 1} other event(s): ${json(events.map(e => e.k))}`;
      // pre is a clone, whose keys are in canonical order, so the streams are compared canonically.
      if (C.State.canon(pre.rng) !== C.State.canon(post.rng)) return `the refusal ${r.reason} drew on a stream`;
      if (C.State.hash(pre) !== C.State.hash(post)) return `the refusal ${r.reason} changed the state`;
      return null;
    },
  };
  return [refusal];
};
