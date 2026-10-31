// ACCESSION — sentences: the system (BUILD.md §3.4), frozen after M3's Wave 0. Refusals, and
// the default sentence of a module's event. M4's Wave 0 (W0a) moved the sentences of the M4
// kinds and wake causes into the fragments of the packages that build them.
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
    no_use: 'You have nothing like that to use.',
  };
  for (const code of Registry.order('REFUSALS')) if (REFUSALS[code]) Text.defineRefusal(code, () => REFUSALS[code]);

  // A module's event is told by its module's own sentence (each module's text fragment, keyed
  // by its id as the cause); this is the sentence for one with no other, which names the
  // module by the sentence its panel teaches (while that is plain words, not a template over
  // its parameters), never by its id. It is logged only when the actor it is about is you or
  // in view (an event about no actor is always told), so a rule that acts unseen is never
  // given away by the log.
  const lower = s => s.charAt(0).toLowerCase() + s.slice(1);
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const taught = id => own(Registry.MODULES, id) && typeof Registry.MODULES[id].sentence === 'string' && !/[{}]/.test(Registry.MODULES[id].sentence) ? Registry.MODULES[id].sentence : null;
  Text.define('module', e => taught(e.id) ? `One of this department’s rules acted: ${lower(taught(e.id))}` : 'One of this department’s rules acted.', { log: 'seen' });
})();
