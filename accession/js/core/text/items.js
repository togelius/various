// ACCESSION — sentences: your kit (BUILD.md §8.5), owned by W1-KIT. Taking, dropping,
// equipping and using items, and the Pin-Driver's bolt.
'use strict';
(() => {
  Text.define('took', (e, w) => `${w.Name(e.who)} took an item.`);
  Text.defineCause('took', 'take', (e, w) => `${w.Name(e.who)} took an item.`);
  Text.define('dropped', (e, w) => `${w.Name(e.who)} dropped an item.`);
  Text.defineCause('dropped', 'drop', (e, w) => `${w.Name(e.who)} dropped an item.`);
  const equipped = (e, w) => e.item == null ? `${w.Name(e.who)} took off the ${e.slot}.` : `${w.Name(e.who)} equipped the ${e.slot}.`;
  Text.define('equipped', equipped);
  Text.defineCause('equipped', 'equip', (e, w) => `${equipped(e, w)}${e.cause.short > 0 ? ` It needs ${e.cause.short} more grade${e.cause.short === 1 ? '' : 's'} than yours.` : ''}`);
  Text.defineCause('equipped', 'unequip', equipped);
  Text.define('used', (e, w) => `${w.Name(e.who)} used an item.`);
  Text.defineCause('used', 'use', (e, w) => `${w.Name(e.who)} used an item.`);

  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.defineCause('noise', 'fork', e => `${CLS[e.cls] || 'A noise'}: a tuning fork, heard ${e.range} tiles away.`);
  const bolt = (e, w) => `${w.Name(e.cause.by)} hit ${w.name(e.who)} with an instrument for ${e.amount} (${e.cause.raw} − ${e.cause.pad} Padding).`;
  Text.defineCause('damaged', 'item', bolt);
  Text.defineCause('died', 'item', (e, w) => e.who === 'you' ? 'You fell.' : `${w.Name(e.who)} broke apart.`);
})();
