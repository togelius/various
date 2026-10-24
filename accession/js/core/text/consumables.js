// ACCESSION — sentences: consumables, seals and identification (BUILD.md §8.6), owned by
// W1-CONSUMABLES. A seal is spoken of by its name ("the round seal"), a kind by its name
// once known; nothing here names a kind the event does not already reveal.
'use strict';
(() => {
  const R = Registry;
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // A kind's name in a sentence: the Solutions are stuff ("Fixative"), the Ephemera things.
  const NOUN = { card: 'a Catalogue Card', plan: 'a Floor Plan', ticket: 'a Re-admission Ticket' };
  const kind = ck => own(NOUN, ck) ? NOUN[ck] : own(R.CONSUMABLES, ck) ? R.CONSUMABLES[ck].name : 'a consumable';
  const seal = s => own(R.SEALS, s) ? `the ${R.SEALS[s].name}` : 'a seal';
  // What the thing is, before you know it: a phial (a Solution) or a leaflet (an Ephemera).
  const thing = (s, ck) => {
    const cls = own(R.SEALS, s) ? R.SEALS[s].cls : own(R.CONSUMABLES, ck) ? R.CONSUMABLES[ck].cls : null;
    return cls === 'ephemera' ? 'a leaflet' : cls === 'solution' ? 'a phial' : 'a consumable';
  };

  Text.define('identified', e => `${cap(seal(e.seal))} is known: it is ${kind(e.ck)}.`);
  Text.defineCause('identified', 'use', e => `Used once, ${seal(e.seal)} is known: it is ${kind(e.ck)}.`);
  Text.defineCause('identified', 'label', e => `From its label, ${seal(e.seal)} is known: it is ${kind(e.ck)}.`);
  Text.defineCause('identified', 'card', e => `From the Catalogue Card, ${seal(e.seal)} is known: it is ${kind(e.ck)}.`);

  // Drinking, reading and throwing (§8.6). A first drink of a harmful kind does nothing, and
  // its sentence says what it would have done.
  const WOULD = {
    fixative: () => `it would have fixed you for ${N.FIXATIVE_TURNS} turns`,
    fumigant: () => `it would have made you cough for ${N.COUGH_TURNS} turns`,
  };
  const VERB = { drink: 'drank', read: 'read', throw: 'threw' };
  Text.defineCause('used', 'consume', (e, w) => {
    const c = e.cause, verb = own(VERB, e.how) ? VERB[e.how] : 'used';
    const what = c.known && own(R.CONSUMABLES, c.ck) ? kind(c.ck) : `${thing(c.seal, c.ck)} with ${seal(c.seal)}`;
    const at = e.how === 'read' && Number.isInteger(c.x) && Number.isInteger(c.y) ? ` and ${w.is(e.who)} back at the entrance` : '';
    let s = `${w.Name(e.who)} ${verb} ${what}${at}.`;
    if (c.gentle) s += ` It is ${kind(c.ck)}: ${own(WOULD, c.ck) ? WOULD[c.ck]() : 'it would have harmed you'}, but a first taste does no harm, and nothing happened.`;
    return s;
  });

  Text.defineCause('glass_broke', 'solvent', (e, w) => `${w.Name(e.by)} dissolved the glass of the case, silently.`);
  Text.defineCause('healed', 'item', (e, w) => `${w.Name(e.who)} ${w.is(e.who)} healed by ${e.amount}: health ${e.hp}.`);
  const STATE = { fixed: 'fixed', rooted: 'rooted', coughing: 'coughing', restoring: 'recovering health', slowed: 'slowed', dazed: 'dazed' };
  const state = id => own(STATE, id) ? STATE[id] : 'affected';
  Text.defineCause('status', 'item', (e, w) => e.on ? `${w.Name(e.who)} ${w.is(e.who)} now ${state(e.id)}.` : `${w.Name(e.who)} ${w.is(e.who)} no longer ${state(e.id)}.`);
  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.defineCause('noise', 'throw', e => `${own(CLS, e.cls) ? CLS[e.cls] : 'A noise'}: a thrown phial landing, heard ${e.range} tiles away.`);

  // Refusals (§4.2). A first throw refused for being too near names no kind.
  const REFUSALS = {
    consumable_not_carried: () => 'You are not carrying that.',
    use_no_target: () => 'A consumable is drunk or read where you stand; to aim a Solution, throw it.',
    throw_not_solution: () => 'Only a Solution can be thrown; a leaflet is read.',
    throw_far: () => `That is too far: you can throw ${N.THROW_RANGE} tiles at most.`,
    throw_unseen: () => 'You can only throw onto a tile you can see.',
    throw_unknown_near: () => `You do not know what this is, and it could splash you: throw it at least ${Consumables.GENTLE + 1} tiles away.`,
    label_none: () => 'There is no label there to read.',
    label_far: () => `Come closer to read: within ${N.READ_RANGE} tiles, in sight.`,
    label_known: () => 'You already know the kind this label describes.',
    card_all_known: () => 'You already know every seal.',
    ticket_no_entrance: () => 'There is no entrance here to return to.',
    choice_none: () => 'There is no choice waiting.',
    choice_bad: () => 'There is no such option.',
  };
  for (const code of R.order('REFUSALS')) if (own(REFUSALS, code)) Text.defineRefusal(code, REFUSALS[code]);
})();
