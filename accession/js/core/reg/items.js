// ACCESSION — registry fragment: your kit (BUILD.md §8.5), owned by W1-KIT. The closed set of
// item primitives, the three instruments, the Restoration kit, and the item events.
'use strict';
(() => {
  const R = Registry;

  // Item primitives the slice implements (§8.5, closed). A pack item names them with a
  // magnitude class S, M or L; `row` is the §8.10 row its numbers come from, if any.
  R.define('ITEM_PRIMS', 'dmg', { row: 'BONUS_DMG' });
  R.define('ITEM_PRIMS', 'acc', { row: 'BONUS_ACC' });
  R.define('ITEM_PRIMS', 'eva', { row: 'BONUS_EVA' });
  R.define('ITEM_PRIMS', 'pad', { row: 'BONUS_PAD' });
  R.define('ITEM_PRIMS', 'reach', { row: 'REACH_RANGE' });
  R.define('ITEM_PRIMS', 'quiet', { row: 'QUIET_RING' });
  R.define('ITEM_PRIMS', 'breaker', { row: 'BREAKER_BASHES' });
  R.define('ITEM_PRIMS', 'charges', { row: null });
  R.define('ITEM_PRIMS', 'observing', { built: 'M4', row: 'LAMP_OBSERVE_RANGE' });

  // The instruments (§8.5); `row` holds charges, recharge turns and range.
  R.define('INSTRUMENTS', 'fork', { name: 'Tuning Fork', row: 'TUNING_FORK' });
  R.define('INSTRUMENTS', 'pin_driver', { name: 'Pin-Driver', row: 'PIN_DRIVER', dmg: 'PIN_DRIVER_DMG' });
  R.define('INSTRUMENTS', 'pole', { name: 'Window Pole', row: 'WINDOW_POLE' });
  // The Restoration kit (§8.5): one level to one item.
  R.define('KITS', 'restoration', { name: 'Restoration kit' });

  // Events (§4.3). Unequipping is `equipped` with item null.
  R.defineEvent('took', { fields: { who: 'uid', item: 'uid', x: 'int?', y: 'int?' } });
  R.defineEvent('dropped', { fields: { who: 'uid', item: 'uid', x: 'int?', y: 'int?' } });
  R.defineEvent('equipped', { fields: { who: 'uid', item: 'uid?', slot: 'str', was: 'uid?' } });
  R.defineEvent('used', { fields: { who: 'uid', item: 'uid', how: 'str' } });

  R.defineCause('took', 'take', { fields: { x: 'int', y: 'int' } });
  R.defineCause('dropped', 'drop', { fields: {} });
  R.defineCause('equipped', 'equip', { fields: { short: 'int' } });
  R.defineCause('equipped', 'unequip', { fields: { short: 'int?' } });
  R.defineCause('used', 'use', { fields: { gentle: 'bool?', x: 'int?', y: 'int?' } });
  R.defineCause('noise', 'fork', { fields: { by: 'uid?', item: 'uid?' } });
  // The Pin-Driver's bolt.
  const item = { by: 'uid', item: 'uid', raw: 'int', pad: 'int', from: 'tile' };
  R.defineCause('damaged', 'item', { fields: item });
  R.defineCause('died', 'item', { fields: item });
})();
