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
  // A signed number in a clause, its words chosen by its value now so that the line reads
  // well: a form's offset after "its tier" is " + {name}" above 0, " {name}" below it ("its
  // tier -1"), and nothing at 0; a change to a stat is ", and changes your <stat> by {name}",
  // and nothing at 0. A term left out has no parameter (a scenario reads it as 0). Returns
  // [text, params].
  const at = ref => { const m = /^N:([A-Z0-9_]+)\[(\d+)\]$/.exec(ref); return N[m[1]][+m[2]]; };
  const plus = (name, ref) => at(ref) === 0 ? ['', {}] : [at(ref) > 0 ? ` + {${name}}` : ` {${name}}`, { [name]: ref }];
  const changes = (stat, name, ref) => at(ref) === 0 ? ['', {}] : [`, and changes your ${stat} by {${name}}`, { [name]: ref }];

  // Item primitives the slice implements (§8.5, closed). A pack item names them with a size,
  // S, M or L; `row` is the §8.10 row a sized one's numbers come from. Every primitive on
  // what you wear counts (Kit.derive).
  R.define('ITEM_PRIMS', 'dmg', Object.assign({ row: 'BONUS_DMG' }, rule('A damage bonus adds {S}, {M} or {L} (small, medium or large) to the least and the most damage of your blows; on a curio, 1 more for each rank.', sizes('BONUS_DMG'), ['damaged'])));
  R.define('ITEM_PRIMS', 'acc', Object.assign({ row: 'BONUS_ACC' }, rule('An Acc bonus adds {S}, {M} or {L} (small, medium or large) to your Acc; on a curio, 1 more for each rank.', sizes('BONUS_ACC'), ['missed', 'damaged'])));
  R.define('ITEM_PRIMS', 'eva', Object.assign({ row: 'BONUS_EVA' }, rule('An Eva bonus adds {S}, {M} or {L} (small, medium or large) to your Eva; on a curio, 1 more for each rank.', sizes('BONUS_EVA'), ['missed', 'damaged'])));
  R.define('ITEM_PRIMS', 'pad', Object.assign({ row: 'BONUS_PAD' }, rule('A Padding bonus adds {S}, {M} or {L} (small, medium or large) to your Padding, on top of what your garment gives; on a curio, 1 more for each rank.', sizes('BONUS_PAD'), ['damaged'])));
  R.define('ITEM_PRIMS', 'reach', Object.assign({ row: 'REACH_RANGE' }, rule('Reach: your blows reach {REACH_RANGE} tiles away in a straight line, as a Reach weapon’s do.', { REACH_RANGE: 'N:REACH_RANGE' }, ['attacked', 'missed', 'damaged'])));
  R.define('ITEM_PRIMS', 'quiet', Object.assign({ row: 'QUIET_RING' }, rule('Quiet: your ring is {QUIET_RING} smaller while your last action was a move or an attack (a bump into an exhibit or a door is a move, so a blow counts however you strike it); two quiet items do no more than one.', { QUIET_RING: 'N:QUIET_RING' }, ['pip'])));
  R.define('ITEM_PRIMS', 'breaker', Object.assign({ row: 'BREAKER_BASHES' }, rule('Breaker: each swing at glass counts as {BREAKER_BASHES} more bash (two breaker items do no more than one).', { BREAKER_BASHES: 'N:BREAKER_BASHES' }, ['glass_cracked', 'glass_broke'])));
  R.define('ITEM_PRIMS', 'charges', Object.assign({ row: null }, rule('Charges: an instrument spends one charge each use, and gets them back over time, as its own clause says.', {}, ['used'])));
  R.define('ITEM_PRIMS', 'observing', { built: 'M4', row: 'LAMP_OBSERVE_RANGE' });

  // The instruments (§8.5); `row` holds charges, recharge turns and range. Each is used only
  // from your instrument slot, at a tile in your line of sight within its range.
  const charges = r => ({ charges: `N:${r}[0]`, recharge: `N:${r}[1]`, range: `N:${r}[2]`, cost: 'N:COST_USE' });
  const uses = 'Each use costs {cost} ticks and one of its {charges} charges, and it gets one back every {recharge} turns, wherever it is.';
  R.define('INSTRUMENTS', 'fork', Object.assign({ name: 'Tuning Fork', row: 'TUNING_FORK' }, rule(
    `From your instrument slot, it is struck at a tile you can see within {range} tiles that an exhibit could stand on, and makes a soft noise there, as if you made it there. ${uses}`,
    charges('TUNING_FORK'), ['used', 'noise'])));
  const [pa, pap] = plus('a', 'N:PIN_DRIVER_DMG[0]'), [pc, pcp] = plus('c', 'N:PIN_DRIVER_DMG[2]');
  R.define('INSTRUMENTS', 'pin_driver', Object.assign({ name: 'Pin-Driver', row: 'PIN_DRIVER', dmg: 'PIN_DRIVER_DMG' }, rule(
    `From your instrument slot, it fires a bolt at an exhibit you can see within {range} tiles with a clear line (bolts stop at glass), rolled to hit with your Acc without your weapon’s, for its tier${pa} to {b} × its tier${pc} damage; the bolt strikes as a blow does, with its noise. ${uses}`,
    Object.assign(charges('PIN_DRIVER'), pap, { b: 'N:PIN_DRIVER_DMG[1]' }, pcp), ['used', 'attacked', 'missed', 'damaged', 'died', 'noise'])));
  R.define('INSTRUMENTS', 'pole', Object.assign({ name: 'Window Pole', row: 'WINDOW_POLE' }, rule(
    `From your instrument slot, it pushes or pulls an exhibit you can see within {range} tiles one tile straight away from you or toward you, without waking it: only an exhibit one tile in size, not in a case and with no special marked, onto a tile it could step onto itself, with no one on it and no closed door. Or it takes the item from an opened or broken case within {range} tiles into your tote. ${uses}`,
    charges('WINDOW_POLE'), ['used', 'moved', 'took'])));

  // The Restoration kit (§8.5): one level to one item you wear or carry; a department's
  // Highlights, and where they may be placed.
  R.define('KITS', 'restoration', Object.assign({ name: 'Restoration kit' }, rule(
    'Used from your tote on a weapon, garment, curio or instrument you wear or carry, it is used up and the item gains a level: a weapon gains {DMG} to its least and its most damage, and 1 Acc at every {EVERY} levels; a garment gains {PAD} Padding; a curio gains {RANK} rank; an instrument gains {CHARGES} charge, added to its most and filled at once. It costs {COST} ticks, and the item is better once they are done. A department holds {KITS} of them, its Highlights: never where you cannot walk from the entrance without a staff door, and in a case only if its lock is within the grade you came in with.',
    { DMG: 'N:RESTORE_DMG', EVERY: 'N:RESTORE_ACC_EVERY', PAD: 'N:RESTORE_PAD', RANK: 'N:RESTORE_RANK', CHARGES: 'N:RESTORE_CHARGES', COST: 'N:COST_USE', KITS: 'N:KITS_PER_DEPT' }, ['used'])));

  // The forms (§8.1): a weapon's damage at tier t, its Acc and the cost of a blow; a garment's
  // Padding and Eva. Then the grade rule and the tote.
  const weapon = (form, Form, extra, more) => {
    const F = `N:FORM_${form.toUpperCase()}`, [a, ap] = plus('a', `${F}[0]`), [c, cp] = plus('c', `${F}[2]`), [acc, accp] = changes('Acc', 'acc', `${F}[4]`);
    return R.define('CLAUSES', `weapon_${form}`, rule(
      `A ${Form} weapon strikes for its tier${a} to {b} × its tier${c} damage${acc}; a blow with it costs {cost} ticks${extra}.`,
      Object.assign({ b: `${F}[1]`, cost: `${F}[3]` }, ap, cp, accp, more || {}), ['attacked', 'missed', 'damaged']));
  };
  weapon('light', 'Light', '; a surprise blow with it deals {surprise}% of its most damage, and it cannot break Laminated or Security glass', { surprise: 'N:SURPRISE_LIGHT_PCT' });
  weapon('balanced', 'Balanced', '');
  weapon('heavy', 'Heavy', '; one bash with it counts as two');
  weapon('reach', 'Reach', '; it also hits {reach} tiles away in a straight line, over a tile you could step onto that no one stands on', { reach: 'N:REACH_RANGE' });
  const garment = (form, Form) => {
    const G = `N:GARMENT_${form.toUpperCase()}`, [a, ap] = plus('a', `${G}[0]`), [eva, evap] = changes('Eva', 'eva', `${G}[1]`);
    return R.define('CLAUSES', `garment_${form}`, rule(
      `A ${Form} garment gives Padding equal to its tier${a}, never below 0 however many grades short of it you are${eva}; putting it on or taking it off costs {cost} ticks, and it counts once they are done.`,
      Object.assign({ cost: 'N:COST_EQUIP_GARMENT' }, ap, evap), ['equipped', 'damaged']));
  };
  garment('light', 'Light'); garment('standard', 'Standard'); garment('heavy', 'Heavy');
  R.define('CLAUSES', 'item_grade', rule(
    'A weapon or garment of tier t needs grade 2t − 1, one less for a Light weapon and one more for a Heavy weapon or garment; each grade you are short costs a weapon {SHORT_ACC} Acc and a garment {SHORT_PAD} Padding. Every level adds {DMG} to a weapon’s least and most damage and {PAD} to a garment’s Padding, and a weapon gains 1 Acc at every {EVERY} levels.',
    { SHORT_ACC: 'N:SHORT_ACC', SHORT_PAD: 'N:SHORT_PAD', DMG: 'N:RESTORE_DMG', PAD: 'N:RESTORE_PAD', EVERY: 'N:RESTORE_ACC_EVERY' }, ['equipped']));
  R.define('CLAUSES', 'item_tote', rule(
    'You wear a weapon, a garment, {CURIOS} curios and an instrument, and carry the rest in a tote of {TOTE} slots: one for each item, and one for each kind of consumable however many you have. You take an item from your tile or one beside you, or from an opened or broken case there, for {TAKE} ticks; dropping costs {TAKE}; putting on a weapon, curio or instrument costs {EQUIP} and taking it off the same; the weapon slot is never empty.',
    { CURIOS: 'N:CURIO_SLOTS', TOTE: 'N:TOTE_SLOTS', TAKE: 'N:COST_TAKE', EQUIP: 'N:COST_EQUIP' }, ['took', 'dropped', 'equipped']));

  // Refusal codes of the item actions (§4.2); the sentences are in text/items.js.
  for (const code of ['no_item', 'carried', 'not_carried', 'worn', 'tote_full', 'not_equippable', 'curio_slots_full', 'weapon_slot', 'slot_empty', 'bad_slot',
    'not_equipped', 'no_charges', 'out_of_range', 'no_line', 'no_aim', 'own_tile', 'not_a_place', 'bad_use', 'no_exhibit', 'too_big', 'in_case', 'marked', 'cannot_move',
    'nothing_to_take', 'cannot_restore']) R.define('REFUSALS', code, { ready: 'unit', tests: TESTS, inv: 'kit' });

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
