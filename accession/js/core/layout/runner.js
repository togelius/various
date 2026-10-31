// ACCESSION — LV11, the worst-case runner (design/layout.md §9.2; BUILD.md §5.5, §10.3): a
// route from the Intro's onward openings to an exit, the exhibits it would wake, and what
// they would cost a runner of the median visitor less one Certificate; it passes at
// RUNNER_PASS_PCT of the runner's health, or makes at most RUNNER_MOVES logged moves, then
// reseeds. D-RUNNER-EST builds the charge in report mode, and D-RUNNER registers it as a
// validator with Populate.addValidator('lv11', …) from here; tools/runner-sweep.js re-runs it
// outside generation. M4's skeleton made it with its signature and a neutral body.
'use strict';
const LRunner = (() => {
  // D-RUNNER-EST, then D-RUNNER, fill: null, or {reason, tiles} with the route that fails.
  function check(state, plan) { return null; }
  return { check };
})();
