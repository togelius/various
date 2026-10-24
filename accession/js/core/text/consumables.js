// ACCESSION — sentences: consumables, seals and identification (BUILD.md §8.6), owned by
// W1-CONSUMABLES.
'use strict';
(() => {
  const kind = ck => Registry.CONSUMABLES[ck] ? Registry.CONSUMABLES[ck].name : 'a consumable';
  Text.define('identified', e => `The ${e.seal} seal is ${kind(e.ck)}.`);
  Text.defineCause('identified', 'use', e => `Used once, the ${e.seal} seal is known: ${kind(e.ck)}.`);
  Text.defineCause('identified', 'label', e => `From its label, the ${e.seal} seal is known: ${kind(e.ck)}.`);
  Text.defineCause('identified', 'card', e => `From a Catalogue Card, the ${e.seal} seal is known: ${kind(e.ck)}.`);
  Text.defineCause('used', 'consume', (e, w) => e.cause.known ? `${w.Name(e.who)} used ${kind(e.cause.ck)}.` : `${w.Name(e.who)} used a consumable with the ${e.cause.seal} seal.`);
  Text.defineCause('glass_broke', 'solvent', (e, w) => `${w.Name(e.by)} dissolved the glass, silently.`);
  Text.defineCause('healed', 'item', (e, w) => `${w.Name(e.who)} healed ${e.amount}: health ${e.hp}.`);
  Text.defineCause('status', 'item', (e, w) => e.on ? `${w.Name(e.who)} ${w.is(e.who)} now ${e.id}.` : `${w.Name(e.who)} ${w.is(e.who)} no longer ${e.id}.`);
  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.defineCause('noise', 'throw', e => `${CLS[e.cls] || 'A noise'}: a thrown item landing, heard ${e.range} tiles away.`);
})();
