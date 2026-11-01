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
  };
  const lift = e => own(LIFT, e.cause.why) ? `: ${LIFT[e.cause.why](e)}` : '';
  // While a hall is sealed, the clock's count and regeneration stop (§8.4).
  const opens = `They open once the Centrepiece has gone ${Text.count(N.SEAL_LIFT_TURNS, 'turn')} without hurting you or ending a turn beside you, once it falls, or when you read a Re-admission Ticket.`;
  const since = (e, w) => e.cause.why === 'hunt' && e.cause.by !== undefined && e.cause.by !== 'you' ? `, since ${w.name(e.cause.by)} is hunting you` : '';
  const STAGES = {
    sealed: (e, w) => `Shutters closed over the hall’s openings${since(e, w)}: it is sealed, and while it is, the clock is stopped and you do not recover health. ${opens}`,
    unsealed: e => `The shutters opened${lift(e)}.`,
    waiting: (e, w) => `The hall would seal, but ${e.cause.by === 'you' ? 'you stand' : e.cause.by !== undefined ? w.name(e.cause.by) + ' stands' : 'someone stands'} in an opening: its shutters close once every opening is clear while you are inside.`,
  };
  Text.defineCause('stage', 'hall', (e, w) => own(STAGES, e.stage) ? STAGES[e.stage](e, w) : 'The hall changed.');

  // A Ticket read while the hall is sealed: the Centrepiece heals and goes back to its place.
  Text.defineCause('healed', 'hall', (e, w) => `${w.Name(e.who)} regained ${e.amount} health as the shutters opened: now ${e.hp}.`);
  Text.defineCause('lost', 'hall', (e, w) => `${w.Name(e.who)} is going back to its place, since the shutters opened.`);

  // The shutters' refusal (§4.2).
  Text.defineRefusal('sealed', () => 'A shutter is closed over that opening: the hall is sealed.');
})();
