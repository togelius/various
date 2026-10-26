// ACCESSION — sentences: statuses and surfaces (BUILD.md §8.1, §8.6), owned by W1-STATUS.
// A status event about an exhibit is logged only while it is in view, as its pips are. A
// status reads in its registry words (Registry.STATUSES[id].words) after "is now" and "is no
// longer", so that it ends in the words it began with, whatever put it on; the sentence of
// another cause of the status kind (an item's, a grip's) should read them too.
'use strict';
(() => {
  Text.defineRefusal('fixed', () => 'You are fixed in place: you can only wait.');
  Text.defineRefusal('rooted', () => 'You are rooted to the spot: you cannot step off this tile.');

  // How each status reads after "is now" and "is no longer" (its registry words); an id with
  // none reads as itself. When it is put on, the sentence also says what it does.
  const word = id => Object.prototype.hasOwnProperty.call(Registry.STATUSES, id) && Registry.STATUSES[id].words ? Registry.STATUSES[id].words : String(id);
  const DOES = {
    restoring: e => `${N.CONSOLIDANT_HOT_PCT}% of ${e.who === 'you' ? 'your' : 'its'} maximum health in all, a share each turn`,
    slowed: () => `every action takes ${N.SPEED_SLOW_PCT}% of its usual time`,
    dazed: e => `${e.who === 'you' ? 'your' : 'its'} blows have ${N.HIT_DAZED_ATTACKER} to hit`,
  };
  const does = e => Object.prototype.hasOwnProperty.call(DOES, e.id) ? ` (${DOES[e.id](e)})` : '';
  const turns = n => n === 1 ? '1 turn' : `${n} turns`;
  const on = (e, w) => e.on
    ? `${w.Name(e.who)} ${w.is(e.who)} now ${word(e.id)}${Number.isInteger(e.turns) ? ' for ' + turns(e.turns) : ''}${does(e)}.`
    : `${w.Name(e.who)} ${w.is(e.who)} no longer ${word(e.id)}.`;
  Text.define('status', on, { log: 'seen' });
  Text.defineCause('status', 'status', on);
  Text.defineCause('healed', 'status', (e, w) => `${w.Name(e.who)} healed ${e.amount} while ${word(e.cause.id)}: health ${e.hp}.`);
  Text.defineCause('pip', 'fumigant', (e, w) => `${w.Name(e.who)} settles (${e.pips} of ${N.PIPS_TO_WAKE} pips): the Fumigant cloud calms it.`);
  const CLS = { soft: 'a soft', loud: 'a loud', crash: 'a crashing' };
  const who = (e, w) => !e.cause.by ? 'A cough' : e.cause.by === 'you' ? 'You cough' : `${w.Name(e.cause.by)} coughs`;
  Text.defineCause('noise', 'cough', (e, w) => `${who(e, w)}: ${CLS[e.cls] || 'a'} noise, heard ${e.range} tiles away.`);

  // A surface laid (§8.1): what it is, how big, and that it blocks sight, for how long; a
  // Fumigant cloud also calms sleepers. Told whether or not you see it, as a death is.
  const AFTER = { fumigant: ', and every sleeping exhibit inside it with a pip loses one each turn' };
  const after = e => Object.prototype.hasOwnProperty.call(AFTER, e.kind) ? AFTER[e.kind] : '';
  const NAMES = { fumigant: 'A Fumigant cloud', dust: 'Plaster dust' };
  const named = e => Object.prototype.hasOwnProperty.call(NAMES, e.kind) ? NAMES[e.kind] : `A ${e.kind}`;
  const blocks = e => Registry.SURFACES[e.kind] && Registry.SURFACES[e.kind].blocksSight ? 'it blocks sight' : 'it lies';
  Text.define('surface', (e, w) => `${named(e)} lies here, ${e.size} tiles a side: ${blocks(e)} for ${turns(e.turns)}${after(e)}.`);
  Text.defineCause('surface', 'died', (e, w) => `${w.Name(e.cause.by)} crumbles into dust: ${blocks(e)}, ${e.size} tiles a side, for ${turns(e.turns)}${after(e)}.`);
  Text.defineCause('surface', 'item', (e, w) => `${named(e)} rises, ${e.size} tiles a side: ${blocks(e)} for ${turns(e.turns)}${after(e)}.`);
})();
