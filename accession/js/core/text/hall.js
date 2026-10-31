// ACCESSION — sentences: the Centrepiece hall: its seal, the shutters' refusal and the stage
// causes (BUILD.md §3.4, §8.4), owned by ARCH-HALL. M4's skeleton made it; M4's Wave 0 (W0a)
// gave the hall's stages their sentences. ARCH-HALL fills the rest.
'use strict';
(() => {
  // While a hall is sealed, the clock's count and regeneration stop (§8.4).
  const LIFT = {
    quiet: () => `the Centrepiece has neither reached you nor dealt damage for ${N.SEAL_LIFT_TURNS} turns`,
    ticket: () => 'a Re-admission Ticket was read',
    defeat: () => 'the Centrepiece fell',
    treasure: () => 'its guardian fell',
  };
  const lift = e => Object.prototype.hasOwnProperty.call(LIFT, e.cause.why) ? `: ${LIFT[e.cause.why](e)}` : '';
  const STAGES = {
    sealed: () => 'Shutters closed over the hall’s openings: it is sealed, and while it is, the clock is stopped and you do not recover health.',
    unsealed: e => `The shutters opened${lift(e)}.`,
    waiting: (e, w) => `The hall would seal, but ${e.cause.by === 'you' ? 'you stand' : e.cause.by !== undefined ? w.name(e.cause.by) + ' stands' : 'someone stands'} in an opening: its shutters close once every opening is clear while you are inside.`,
  };
  Text.defineCause('stage', 'hall', (e, w) => Object.prototype.hasOwnProperty.call(STAGES, e.stage) ? STAGES[e.stage](e, w) : 'The hall changed.');
})();
