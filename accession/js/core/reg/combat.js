// ACCESSION — registry fragment: combat, specials and health (BUILD.md §8.1), owned by
// W1-COMBAT. The events of blows and specials, of waiting, recovering and healing, and the
// wake cause `damage` (damage always wakes, straight to hunting).
'use strict';
(() => {
  const R = Registry;

  // Events (§4.3).
  R.defineEvent('attacked', { fields: { by: 'uid', at: 'uid', how: 'obj' } });
  R.defineEvent('missed', { fields: { by: 'uid', at: 'uid' } });
  R.defineEvent('damaged', { fields: { who: 'uid', amount: 'int', hp: 'int' }, record: true });
  R.defineEvent('died', { fields: { who: 'uid' }, record: true });
  R.defineEvent('telegraphed', { fields: { who: 'uid', sp: 'str', tiles: 'tiles' } });
  R.defineEvent('special', { fields: { who: 'uid', sp: 'str', hits: 'uids?', cancelled: 'bool?' }, record: true });
  R.defineEvent('waited', { fields: { who: 'uid', how: 'str' } });
  R.defineEvent('regenerated', { fields: { who: 'uid', hp: 'int' } });
  R.defineEvent('healed', { fields: { who: 'uid', amount: 'int', hp: 'int' } });

  // A blow (§8.1): who struck whom, how, with the chance, the roll and the damage roll.
  const blow = { by: 'uid', at: 'uid', chance: 'int', roll: 'int?', raw: 'int', pad: 'int', floor: 'int?', surprise: 'int?', side: 'str?', how: 'obj', from: 'tile', saved: 'int?' };
  // A special's resolve (§8.1): no roll, its gross number, your Padding and the net.
  const special = { by: 'uid', sp: 'str', gross: 'int', pad: 'int', net: 'int', x: 'int', y: 'int', from: 'tile' };
  R.defineCause('attacked', 'attack', { fields: { by: 'uid', at: 'uid', dist: 'int', how: 'obj' } });
  R.defineCause('missed', 'attack', { fields: { by: 'uid', at: 'uid', chance: 'int', roll: 'int', how: 'obj' } });
  R.defineCause('damaged', 'attack', { fields: blow });
  R.defineCause('damaged', 'special', { fields: special });
  // A death carries the killing cause, as the damage did.
  R.defineCause('died', 'attack', { fields: blow });
  R.defineCause('died', 'special', { fields: special });
  R.defineCause('telegraphed', 'special', { fields: { by: 'uid', sp: 'str', gross: 'int', every: 'int?' } });
  R.defineCause('special', 'special', { fields: { by: 'uid', sp: 'str' } });
  R.defineCause('special', 'cancel', { fields: { by: 'uid', why: 'str' } });
  R.defineCause('waited', 'action', { fields: { how: 'str' } });
  R.defineCause('regenerated', 'regen', { fields: { units: 'int', need: 'int', bench: 'bool' } });
  for (const k of ['attack', 'destroyed', 'special']) R.defineCause('noise', k, { fields: { by: 'uid?', item: 'uid?' } });

  R.define('WAKE_CAUSES', 'damage', { mode: 'hunting', creation: false });
  const wake = { by: 'uid?', dist: 'int?', x: 'int?', y: 'int?', from: 'tile?', how: 'str?' };
  R.defineCause('woke', 'damage', { fields: wake });
  R.defineCause('hunting', 'damage', { fields: wake });
})();
