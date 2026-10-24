// ACCESSION — sentences: the system (BUILD.md §3.4), frozen after M3's Wave 0. Refusals, and
// plain sentences for the event kinds and wake causes M4 builds.
'use strict';
(() => {
  // A refused action says why, in the sentence its code names (§4.2).
  Text.define('refused', e => Text.refusal(e.reason, e.data));
  const REFUSALS = {
    visit_over: 'The visit is over.',
    choice_pending: 'Answer the choice first.',
    unknown_action: 'Unknown action.',
    bad_direction: 'No such direction.',
    corner: 'You cannot reach it past the corner.',
    blocked: 'Something is in the way.',
    no_target: 'There is nothing there to attack.',
    out_of_reach: 'It is out of reach.',
    not_built: 'You cannot do that yet.',
    no_use: 'You have nothing like that to use.',
  };
  for (const code of Registry.order('REFUSALS')) if (REFUSALS[code]) Text.defineRefusal(code, () => REFUSALS[code]);

  // M4's kinds.
  Text.define('alarm', (e, w) => `${w.Name(e.by)} raised the alarm.`);
  Text.define('certificate', () => 'You earned this department’s Certificate.');
  Text.define('grade', e => `Your grade is now ${e.grade}.`);
  Text.define('perk', e => `You took the perk ${e.id}, rank ${e.rank}.`);
  Text.define('viewed', (e, w) => `${w.Name(e.who)} viewed the Centrepiece for ${e.turns} turns.`);
  Text.define('module', e => `The department’s rule ${e.id} acted.`);
  const why = { period: 'the chime sounded', alarm: 'the alarm was raised', patrol: 'it walks its round' };
  for (const k of ['period', 'alarm', 'patrol']) {
    Text.defineCause('woke', k, (e, w) => e.was == null ? `${w.Name(e.who)} is awake: ${why[k]}.` : `${w.Name(e.who)} woke: ${why[k]}.`);
    Text.defineCause('hunting', k, (e, w) => e.was === 'dormant' ? `${w.Name(e.who)} woke and is hunting you: ${why[k]}.` : `${w.Name(e.who)} is hunting you: ${why[k]}.`);
  }
})();
