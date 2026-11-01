// ACCESSION — sentences: the Centrepiece hall: its seal, the shutters' refusal and the stage
// causes (BUILD.md §3.4, §8.4), owned by ARCH-HALL. M4's skeleton made it; M4's Wave 0 (W0a)
// gave the hall's stages their sentences.
'use strict';
(() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // How the shutters open (rules/hall.js), said once here for the sealed stage and the hall's
  // confirmation (text/confirm.js says the same in its own words).
  const quiet = () => `the Centrepiece has neither hurt you nor ended a turn beside you for ${Text.count(N.SEAL_LIFT_TURNS, 'turn')}`;
  const LIFT = {
    quiet: () => quiet(),
    ticket: () => 'a Re-admission Ticket was read',
    defeat: () => 'the Centrepiece fell',
    treasure: () => 'its guardian fell',
    sheet: () => 'the Centrepiece went under its dust sheet',
    alone: () => 'none of the Centrepiece is left in the hall with you',
  };
  // After a quiet lift, or one that left you alone in the hall, you may still be inside: the
  // hall does not seal again until you have stood outside it at a turn's end (rules/hall.js).
  const AGAIN = ['quiet', 'alone'];
  const lift = e => own(LIFT, e.cause.why) ? `: ${LIFT[e.cause.why](e)}` : '';
  // While a hall is sealed, the clock's count and regeneration stop (§8.4).
  const opens = `They open once the Centrepiece has gone ${Text.count(N.SEAL_LIFT_TURNS, 'turn')} without hurting you or ending a turn beside you, once it falls or goes under its dust sheet or none of it is left in the hall, or when you read a Re-admission Ticket.`;
  // A treasure's seal (rules/treasure.js, M4 COMPOSITE-PHASES) names no piece: its why says
  // what called for it, while the Centrepiece hunts you in its hall: its case first opened or
  // bashed TREASURE_SEAL_TURNS turns or more ago, or its health at TREASURE_SEAL_HP_PCT% or less.
  const TREASURE = {
    touched: () => `, since the Centrepiece is hunting you and its treasure’s case was first opened or bashed ${Text.count(N.TREASURE_SEAL_TURNS, 'turn')} or more ago`,
    hurt: () => `, since the Centrepiece is hunting you with ${N.TREASURE_SEAL_HP_PCT}% of its full health or less`,
  };
  const since = (e, w) => e.cause.why === 'hunt' && e.cause.by !== undefined && e.cause.by !== 'you' ? `, since ${w.name(e.cause.by)} is hunting you`
    : own(TREASURE, e.cause.why) ? TREASURE[e.cause.why]() : '';
  // What a waiting seal still needs once every opening is clear: a fight's, its Centrepiece
  // hunting you from inside the hall; a treasure's too (M4 COMPOSITE-PHASES' review), with its
  // health still that low when that is why (its case's touch, once that old, stays so); another
  // form's (planted in tests), you inside.
  const HUNTS = 'you and the Centrepiece are inside and it hunts you';
  const STILL = {
    hunt: () => HUNTS,
    touched: () => HUNTS,
    hurt: () => `${HUNTS} with ${N.TREASURE_SEAL_HP_PCT}% of its full health or less`,
  };
  const still = e => own(STILL, e.cause.why) ? STILL[e.cause.why]() : 'you are inside';
  const STAGES = {
    sealed: (e, w) => `Shutters closed over the hall’s openings${since(e, w)}: it is sealed, and while it is, the clock is stopped and you do not recover health. ${opens}`,
    unsealed: e => `The shutters opened${lift(e)}.${AGAIN.includes(e.cause.why) ? ' They do not close again until you have stepped out of the hall.' : ''}`,
    // The seal still needs its call when the openings clear (still, above). Who stands in the
    // opening is named (in) only if you saw it there; by is what calls for the seal, not said
    // here.
    waiting: (e, w) => `The hall would seal, but ${e.cause.in !== undefined ? w.name(e.cause.in) : 'someone out of your sight'} stands in an opening: its shutters close once every opening is clear while ${still(e)}.`,
  };
  Text.defineCause('stage', 'hall', (e, w) => own(STAGES, e.stage) ? STAGES[e.stage](e, w) : 'The hall changed.');

  // A Ticket read while the hall is sealed: the Centrepiece heals and goes back to its place.
  Text.defineCause('healed', 'hall', (e, w) => `${w.Name(e.who)} regained ${e.amount} health as the shutters opened: now ${e.hp}.`);
  // (One that never steps, how: 'stands', settles where it stands: M4 TABLEAU-CORE.)
  Text.defineCause('lost', 'hall', (e, w) => e.cause.how === 'stands' ? `${w.Name(e.who)} is settling where it stands, since the shutters opened.`
    : `${w.Name(e.who)} is going back to its place, since the shutters opened.`);

  // The shutters' refusal (§4.2).
  Text.defineRefusal('sealed', () => 'A shutter is closed over that opening: the hall is sealed.');
})();
