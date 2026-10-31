// ACCESSION — registry fragment: the system (BUILD.md §5.1), frozen after M3's Wave 0: the
// backbone refusal codes, the `refused` event, and the `module` event every module's rules
// emit (§3.4). M4's Wave 0 (W0a) moved the M4 entries this file held as placeholders (seven
// archetypes, the clockwork modifier, the period trigger, the five modules, three wake causes
// and five event kinds) into the fragments of the packages that build them, and removed
// not_built, which no action gave.
'use strict';
(() => {
  const R = Registry;

  // Refusal codes (§4.2). step() refuses an illegal action with a code, and text/system.js
  // gives each its sentence. A rule that refuses with a code of its own defines it in its
  // own fragment. no_use is use(uid) of something that is not an instrument, a kit or a
  // consumable. m3-backbone makes each one refuse, with nothing changed and nothing drawn;
  // their invariant is test/behaviour/system.inv.js (a refused step has no other event and
  // changes nothing). The real game makes each refuse in test/behaviour/refusals.test.js
  // (ready true).
  for (const code of ['visit_over', 'choice_pending', 'unknown_action', 'bad_direction', 'corner', 'blocked', 'no_target', 'out_of_reach', 'no_use']) {
    R.define('REFUSALS', code, { ready: true, tests: ['m3-backbone.test.js', 'behaviour/refusals.test.js'], inv: 'system' });
  }
  R.defineEvent('refused', { fields: { reason: 'str', data: 'obj?' }, exempt: true });

  // A module's event (§3.4, §5.4): the module (id) and the rule within it that acted, with
  // the actor it is about (who), a tile (at), a count (n) and a length in turns (turns) where
  // the rule has them. Its causes are keyed by the module's id, each defined with the module
  // in its own fragment (reg/mod-*.js), and each module's sentences say what each rule did.
  R.defineEvent('module', { fields: { id: 'str', rule: 'str', who: 'uid?', at: 'tile?', n: 'int?', turns: 'int?' }, built: 'M4' });
})();
