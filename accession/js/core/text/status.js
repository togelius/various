// ACCESSION — sentences: statuses and surfaces (BUILD.md §8.1, §8.6), owned by W1-STATUS.
'use strict';
(() => {
  const on = (e, w) => e.on ? `${w.Name(e.who)} ${w.is(e.who)} now ${e.id}.` : `${w.Name(e.who)} ${w.is(e.who)} no longer ${e.id}.`;
  Text.define('status', on);
  Text.defineCause('status', 'status', on);
  Text.defineCause('healed', 'status', (e, w) => `${w.Name(e.who)} healed ${e.amount} while ${e.cause.id}: health ${e.hp}.`);
  Text.defineCause('pip', 'fumigant', (e, w) => `${w.Name(e.who)} settles in the fumigant (${e.pips} of ${N.PIPS_TO_WAKE} pips).`);
  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.defineCause('noise', 'cough', e => `${CLS[e.cls] || 'A noise'}: coughing, heard ${e.range} tiles away.`);
})();
