// ACCESSION — registry fragment: your kit (BUILD.md §8.1, §8.5), owned by W1-KIT. The closed
// set of item primitives, the three instruments, the Restoration kit, the clauses of the
// weapon and garment forms, the grade rule and the tote, the refusal codes of the item
// actions, and the item events. Each clause states the rule with its numbers of record; an
// item's Behaviour line is made of the clauses of the entries it uses (Kit.describe).
'use strict';
(() => {
  const R = Registry;
  const TESTS = ['m3-kit.test.js', 'behaviour/items.test.js'];
  const rule = (clause, params, covers) => ({ icon: null, clause, params: params || {}, covers: covers || [], ready: 'unit', tests: TESTS, inv: 'kit' });
  const sizes = row => ({ S: `N:${row}[0]`, M: `N:${row}[1]`, L: `N:${row}[2]` });

  // Item primitives the slice implements (§8.5, closed). A pack item names them with a size,
  // S, M or L; `row` is the §8.10 row a sized one's numbers come from. Every primitive on
  // what you wear counts (Kit.derive).
  R.define('ITEM_PRIMS', 'dmg', Object.assign({ row: 'BONUS_DMG' }, rule('A damage bonus adds {S}, {M} or {L} (small, medium or large) to the least and the most damage of your blows; on a curio, 1 more for each rank.', sizes('BONUS_DMG'), ['damaged'])));
  R.define('ITEM_PRIMS', 'acc', Object.assign({ row: 'BONUS_ACC' }, rule('An Acc bonus adds {S}, {M} or {L} (small, medium or large) to your Acc; on a curio, 1 more for each rank.', sizes('BONUS_ACC'), ['missed', 'damaged'])));
  R.define('ITEM_PRIMS', 'eva', Object.assign({ row: 'BONUS_EVA' }, rule('An Eva bonus adds {S}, {M} or {L} (small, medium or large) to your Eva; on a curio, 1 more for each rank.', sizes('BONUS_EVA'), ['missed', 'damaged'])));
  R.define('ITEM_PRIMS', 'pad', Object.assign({ row: 'BONUS_PAD' }, rule('A Padding bonus adds {S}, {M} or {L} (small, medium or large) to your Padding; on a curio, 1 more for each rank.', sizes('BONUS_PAD'), ['damaged'])));
  R.define('ITEM_PRIMS', 'reach', Object.assign({ row: 'REACH_RANGE' }, rule('Reach: your blows reach {REACH_RANGE} tiles away in a straight line, as a Reach weapon’s do.', { REACH_RANGE: 'N:REACH_RANGE' }, ['attacked', 'missed', 'damaged'])));
  R.define('ITEM_PRIMS', 'quiet', Object.assign({ row: 'QUIET_RING' }, rule('Quiet: your ring is {QUIET_RING} smaller while your last action was a move (two quiet items do no more than one).', { QUIET_RING: 'N:QUIET_RING' }, ['pip'])));
  R.define('ITEM_PRIMS', 'breaker', Object.assign({ row: 'BREAKER_BASHES' }, rule('Breaker: each swing at glass counts as {BREAKER_BASHES} more bash (two breaker items do no more than one).', { BREAKER_BASHES: 'N:BREAKER_BASHES' }, ['glass_cracked', 'glass_broke'])));
  R.define('ITEM_PRIMS', 'charges', Object.assign({ row: null }, rule('Charges: an instrument spends one charge each use, and gets them back over time, as its own clause says.', {}, ['used'])));
  R.define('ITEM_PRIMS', 'observing', { built: 'M4', row: 'LAMP_OBSERVE_RANGE' });

  // The instruments (§8.5); `row` holds charges, recharge turns and range. Each is used from
  // your instrument slot.
  const charges = r => ({ charges: `N:${r}[0]`, recharge: `N:${r}[1]`, range: `N:${r}[2]` });
  R.define('INSTRUMENTS', 'fork', Object.assign({ name: 'Tuning Fork', row: 'TUNING_FORK' }, rule(
    'Struck, it makes a soft noise at a tile you can see within {range} tiles, as if you made it there. It holds {charges} charges, one spent each use, and gets one back every {recharge} turns.',
    charges('TUNING_FORK'), ['used', 'noise'])));
  R.define('INSTRUMENTS', 'pin_driver', Object.assign({ name: 'Pin-Driver', row: 'PIN_DRIVER', dmg: 'PIN_DRIVER_DMG' }, rule(
    'It fires a bolt at an exhibit you can see within {range} tiles, rolled to hit with your Acc without your weapon’s, for its tier + {a} to {b} × its tier + {c} damage; bolts stop at glass. It holds {charges} charges, one spent each use, and gets one back every {recharge} turns.',
    Object.assign(charges('PIN_DRIVER'), { a: 'N:PIN_DRIVER_DMG[0]', b: 'N:PIN_DRIVER_DMG[1]', c: 'N:PIN_DRIVER_DMG[2]' }), ['used', 'attacked', 'missed', 'damaged', 'died'])));
  R.define('INSTRUMENTS', 'pole', Object.assign({ name: 'Window Pole', row: 'WINDOW_POLE' }, rule(
    'It pushes or pulls a one-tile exhibit within {range} tiles one tile straight away from you or toward you, where it could step itself, without waking it; or it takes the item from an opened or broken case within {range} tiles. It holds {charges} charges, one spent each use, and gets one back every {recharge} turns.',
    charges('WINDOW_POLE'), ['used', 'moved', 'took'])));

  // The Restoration kit (§8.5): one level to one item you carry.
  R.define('KITS', 'restoration', Object.assign({ name: 'Restoration kit' }, rule(
    'Used on a weapon, garment, curio or instrument you carry, it is used up and the item gains a level: a weapon {DMG} to its least and most damage, and 1 Acc at every {EVERY} levels; a garment {PAD} Padding; a curio {RANK} rank; an instrument {CHARGES} charge, filled at once. It costs {COST} ticks, and the item is better once they are done.',
    { DMG: 'N:RESTORE_DMG', EVERY: 'N:RESTORE_ACC_EVERY', PAD: 'N:RESTORE_PAD', RANK: 'N:RESTORE_RANK', CHARGES: 'N:RESTORE_CHARGES', COST: 'N:COST_USE' }, ['used'])));

  // The forms (§8.1): a weapon's damage at tier t, its Acc and the cost of a blow; a garment's
  // Padding and Eva. Then the grade rule and the tote.
  const weapon = (form, Form, extra, more) => {
    const F = `N:FORM_${form.toUpperCase()}`;
    return R.define('CLAUSES', `weapon_${form}`, rule(
      `A ${Form} weapon strikes for tier + {a} to {b} × tier + {c} damage, its form gives {acc} Acc, and a blow costs {cost} ticks${extra}.`,
      Object.assign({ a: `${F}[0]`, b: `${F}[1]`, c: `${F}[2]`, cost: `${F}[3]`, acc: `${F}[4]` }, more || {}), ['attacked', 'missed', 'damaged']));
  };
  weapon('light', 'Light', '; a surprise blow with it deals {surprise}% of its most damage, and it cannot break Laminated or Security glass', { surprise: 'N:SURPRISE_LIGHT_PCT' });
  weapon('balanced', 'Balanced', '');
  weapon('heavy', 'Heavy', '; one bash with it counts as two');
  weapon('reach', 'Reach', '; it also hits {reach} tiles away in a straight line, over a tile you could step onto that no one stands on', { reach: 'N:REACH_RANGE' });
  const garment = (form, Form) => R.define('CLAUSES', `garment_${form}`, rule(
    `A ${Form} garment gives tier + {a} Padding (never below 0) and {eva} Eva; putting it on or taking it off costs {cost} ticks, and it counts once they are done.`,
    { a: `N:GARMENT_${form.toUpperCase()}[0]`, eva: `N:GARMENT_${form.toUpperCase()}[1]`, cost: 'N:COST_EQUIP_GARMENT' }, ['equipped', 'damaged']));
  garment('light', 'Light'); garment('standard', 'Standard'); garment('heavy', 'Heavy');
  R.define('CLAUSES', 'item_grade', rule(
    'A weapon or garment of tier t needs grade 2t − 1, one less for a Light weapon and one more for a Heavy weapon or garment; each grade you are short costs a weapon {SHORT_ACC} Acc and a garment {SHORT_PAD} Padding. Every level adds {DMG} to a weapon’s least and most damage and {PAD} to a garment’s Padding, and a weapon gains 1 Acc at every {EVERY} levels.',
    { SHORT_ACC: 'N:SHORT_ACC', SHORT_PAD: 'N:SHORT_PAD', DMG: 'N:RESTORE_DMG', PAD: 'N:RESTORE_PAD', EVERY: 'N:RESTORE_ACC_EVERY' }, ['equipped']));
  R.define('CLAUSES', 'item_tote', rule(
    'You wear a weapon, a garment, {CURIOS} curios and an instrument, and carry the rest in a tote of {TOTE} slots: one for each item, and one for each kind of consumable however many you have. You take an item from your tile or one beside you, or from an opened or broken case there, for {TAKE} ticks; dropping costs {TAKE}; putting on a weapon, curio or instrument costs {EQUIP} and taking it off the same; the weapon slot is never empty.',
    { CURIOS: 'N:CURIO_SLOTS', TOTE: 'N:TOTE_SLOTS', TAKE: 'N:COST_TAKE', EQUIP: 'N:COST_EQUIP' }, ['took', 'dropped', 'equipped']));

  // Refusal codes of the item actions (§4.2); the sentences are in text/items.js.
  for (const code of ['no_item', 'carried', 'not_carried', 'worn', 'tote_full', 'not_equippable', 'curio_slots_full', 'weapon_slot', 'slot_empty', 'bad_slot',
    'not_equipped', 'no_charges', 'out_of_range', 'no_line', 'no_aim', 'bad_use', 'cannot_move', 'nothing_to_take', 'cannot_restore']) R.define('REFUSALS', code, { ready: 'unit', tests: TESTS, inv: 'kit' });

  // Events (§4.3). Unequipping is `equipped` with item null. Each cause carries what the item
  // was (its kind, and its form, tier, level and count when it has them), so its sentence
  // can say so.
  R.defineEvent('took', { fields: { who: 'uid', item: 'uid', x: 'int?', y: 'int?' } });
  R.defineEvent('dropped', { fields: { who: 'uid', item: 'uid', x: 'int?', y: 'int?' } });
  R.defineEvent('equipped', { fields: { who: 'uid', item: 'uid?', slot: 'str', was: 'uid?' } });
  R.defineEvent('used', { fields: { who: 'uid', item: 'uid', how: 'str' } });

  const what = { kind: 'str', form: 'str?', tier: 'int?', level: 'int?', n: 'int?' };
  // took: from (x, y); inCase, from a case; tool, the instrument it was taken with (the pole);
  // stack, the stack in your tote it joined.
  R.defineCause('took', 'take', { fields: Object.assign({ x: 'int', y: 'int' }, what, { inCase: 'bool?', tool: 'uid?', stack: 'uid?' }) });
  R.defineCause('dropped', 'drop', { fields: what });
  // equip: short, the grades you are short of it (§8.1).
  R.defineCause('equipped', 'equip', { fields: Object.assign({ short: 'int' }, what) });
  R.defineCause('equipped', 'unequip', { fields: what });
  // use: an instrument at (x, y), with at the exhibit it was aimed at, to where the pole
  // moved it, on the item it took, and charges those left; a Restoration kit on an item,
  // with its kind and new level.
  R.defineCause('used', 'use', { fields: { x: 'int?', y: 'int?', at: 'uid?', to: 'tile?', on: 'uid?', kind: 'str?', level: 'int?', charges: 'int?' } });
  R.defineCause('noise', 'fork', { fields: { by: 'uid?', item: 'uid?' } });
  // The Pin-Driver's bolt: a shot (Ranged.shoot, then Combat.attack) whose how names the
  // instrument, so its cause is a shot's, k 'item', with the item.
  const item = { by: 'uid', at: 'uid', chance: 'int', roll: 'int?', raw: 'int', pad: 'int', floor: 'int?', surprise: 'int?', side: 'str?', how: 'obj', from: 'tile',
    saved: 'int?', range: 'int', item: 'uid' };
  R.defineCause('missed', 'item', { fields: { by: 'uid', at: 'uid', chance: 'int', roll: 'int', how: 'obj', range: 'int', item: 'uid' } });
  R.defineCause('damaged', 'item', { fields: item });
  R.defineCause('died', 'item', { fields: item });
})();
