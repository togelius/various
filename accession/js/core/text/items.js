// ACCESSION — sentences: your kit (BUILD.md §8.1, §8.5), owned by W1-KIT. Taking, dropping,
// equipping and using items, the instruments, Restoration, the Pin-Driver's bolt, and the
// refusals of the item actions. An item is described from what its event's cause carries
// (its kind, form, tier, level and count), never from a name the sentence cannot know.
'use strict';
(() => {
  const FORM = { light: 'Light', balanced: 'Balanced', heavy: 'Heavy', reach: 'Reach', standard: 'Standard' };
  const isInt = Number.isInteger;
  const instrument = form => Object.prototype.hasOwnProperty.call(Registry.INSTRUMENTS, form) ? Registry.INSTRUMENTS[form].name : null;
  // What an item was, from a cause: "a Heavy weapon (tier 2, level 1)", "the Tuning Fork",
  // "a Restoration kit", "3 consumables"; "an item" for anything else.
  function what(c) {
    const tiers = [isInt(c.tier) ? `tier ${c.tier}` : null, isInt(c.level) && c.level > 0 ? `level ${c.level}` : null].filter(Boolean);
    const more = tiers.length ? ` (${tiers.join(', ')})` : '';
    if (c.kind === 'weapon' || c.kind === 'garment') return (FORM[c.form] ? `a ${FORM[c.form]} ${c.kind}` : `a ${c.kind}`) + more;
    if (c.kind === 'curio') return 'a curio' + (isInt(c.level) && c.level > 0 ? ` (rank ${c.level})` : '');
    if (c.kind === 'instrument') return (instrument(c.form) ? `the ${instrument(c.form)}` : 'an instrument') + more;
    if (c.kind === 'kit') return 'a Restoration kit';
    if (c.kind === 'consumable') return isInt(c.n) && c.n > 1 ? `${c.n} consumables` : 'a consumable';
    return 'an item';
  }
  const SLOT = { weapon: 'weapon slot', garment: 'garment slot', curio0: 'first curio slot', curio1: 'second curio slot', instrument: 'instrument slot' };
  const slot = s => SLOT[s] || 'slot';
  const left = c => !isInt(c.charges) ? '' : c.charges === 0 ? ' (no charges left)' : ` (${c.charges} charge${c.charges === 1 ? '' : 's'} left)`;

  Text.define('took', (e, w) => `${w.Name(e.who)} took an item.`);
  Text.defineCause('took', 'take', (e, w) => {
    const c = e.cause;
    return `${w.Name(e.who)} took ${what(c)}${c.inCase ? ' from the case' : ''}${c.tool ? ' with the pole' : ''}${c.stack ? ', adding it to the stack in the tote' : ''}.`;
  });
  Text.define('dropped', (e, w) => `${w.Name(e.who)} dropped an item.`);
  Text.defineCause('dropped', 'drop', (e, w) => `${w.Name(e.who)} dropped ${what(e.cause)}.`);

  // Equipping says what each grade short costs (§8.1): Acc on a weapon, Padding on a garment.
  Text.define('equipped', (e, w) => e.item == null ? `${w.Name(e.who)} emptied the ${slot(e.slot)}.` : `${w.Name(e.who)} filled the ${slot(e.slot)}.`);
  Text.defineCause('equipped', 'equip', (e, w) => {
    const c = e.cause, n = isInt(c.short) ? c.short : 0;
    const cost = c.kind === 'weapon' ? `${N.SHORT_ACC * n} Acc` : c.kind === 'garment' ? `${N.SHORT_PAD * n} Padding` : null;
    const shortBy = n > 0 && cost ? ` You are ${n} grade${n === 1 ? '' : 's'} short of it, which costs ${cost}.` : '';
    return `${w.Name(e.who)} put ${what(c)} in the ${slot(e.slot)}${e.was ? ', and the one it replaced went into the tote' : ''}.${shortBy}`;
  });
  Text.defineCause('equipped', 'unequip', (e, w) => `${w.Name(e.who)} took ${what(e.cause)} out of the ${slot(e.slot)} and into the tote.`);

  // Using an instrument or a Restoration kit.
  Text.define('used', (e, w) => `${w.Name(e.who)} used an item.`);
  Text.defineCause('used', 'use', (e, w) => {
    const c = e.cause, who = w.Name(e.who);
    if (e.how === 'fork') return `${who} struck the Tuning Fork, and it rang out where it was aimed${left(c)}.`;
    if (e.how === 'pin_driver') return `${who} fired the Pin-Driver${c.at ? ` at ${w.name(c.at)}` : ''}${left(c)}.`;
    if (e.how === 'push' || e.how === 'pull') return `${who} ${e.how === 'push' ? 'pushed' : 'pulled'} ${c.at ? w.name(c.at) : 'an exhibit'} one tile with the Window Pole${left(c)}.`;
    if (e.how === 'take') return `${who} hooked an item out of the case with the Window Pole${left(c)}.`;
    if (e.how === 'restore') return `${who} used a Restoration kit: ${c.kind ? `the ${c.kind}` : 'the item'} is now at level ${isInt(c.level) ? c.level : 1}.`;
    return `${who} used an item${left(c)}.`;
  });

  const CLS = { soft: 'Soft', loud: 'Loud', crash: 'Crash' };
  Text.defineCause('noise', 'fork', e => `${CLS[e.cls] || 'A noise'}: a tuning fork, heard ${e.range} tiles away.`);

  // The Pin-Driver's bolt (§8.1): rolled as a blow is, with its own damage. Through an
  // old_repair exhibit's repaired side (cause.side, §5.5) the damage is doubled, and the sum
  // says so, as a blow's and a shot's do.
  const POINT = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' };
  const repaired = (e, c) => {
    if (c.side === undefined || c.side === null) return '';
    const net = c.floor ? c.floor : c.raw - c.pad, where = `through its repaired ${POINT[c.side] || c.side} side`;
    return e.amount === 2 * net ? `, doubled ${where}` : `, made ${e.amount} ${where}`;
  };
  const bolt = (e, w) => {
    const c = e.cause, sum = `${c.raw} − ${c.pad} Padding${c.floor ? `, at least ${c.floor}` : ''}${repaired(e, c)}`;
    const roll = c.surprise ? 'a surprise bolt, certain to hit for its most' : c.roll == null ? 'a certain hit' : `rolled ${c.roll} against ${c.chance}%`;
    return `${w.Name(c.by)} hit ${w.name(e.who)} with a Pin-Driver bolt for ${e.amount} (${roll}; ${sum}).`;
  };
  Text.defineCause('missed', 'item', (e, w) => `${w.Name(e.by)} fired a Pin-Driver bolt at ${w.name(e.at)} and missed (rolled ${e.cause.roll} against ${e.cause.chance}%).`);
  Text.defineCause('damaged', 'item', bolt);
  Text.defineCause('died', 'item', (e, w) => e.who === 'you' ? 'You fell to a Pin-Driver bolt.' : `${w.Name(e.who)} broke apart under a Pin-Driver bolt.`);

  // Why an item action is refused (§4.2).
  const REFUSALS = [
    ['no_item', () => 'There is no such item.'],
    ['carried', () => 'You already have it.'],
    ['not_carried', () => 'You are not carrying that.'],
    ['worn', () => 'You are wearing it.'],
    ['tote_full', () => `Your tote is full: it has ${N.TOTE_SLOTS} slots.`],
    ['not_equippable', () => 'You can wear only a weapon, a garment, a curio or an instrument.'],
    ['curio_slots_full', () => `Both curio slots are full: take one curio off first.`],
    ['weapon_slot', () => 'Your weapon slot is never empty: equip another weapon to change it.'],
    ['slot_empty', () => 'There is nothing in that slot.'],
    ['bad_slot', () => 'There is no such slot.'],
    ['not_equipped', () => 'Put the instrument in your instrument slot first.'],
    ['no_charges', () => 'It has no charges left; they come back over time.'],
    ['out_of_range', () => 'That is beyond its range.'],
    ['no_line', () => 'There is no clear line to it from where you stand.'],
    ['no_aim', () => 'Choose where, or on what, to use it.'],
    ['own_tile', () => 'Aim it at a tile other than your own.'],
    ['not_a_place', () => 'It can be struck only at a tile an exhibit could stand on.'],
    ['bad_use', () => 'It cannot be used that way.'],
    ['no_exhibit', () => 'There is no exhibit there for the pole to move.'],
    ['too_big', () => 'The pole moves only an exhibit one tile in size.'],
    ['in_case', () => 'The pole cannot move an exhibit inside its case.'],
    ['marked', () => 'The pole cannot move an exhibit while its special is marked on the floor.'],
    ['cannot_move', () => 'It cannot be moved that way.'],
    ['nothing_to_take', () => 'There is nothing there it can take.'],
    ['cannot_restore', () => 'A Restoration kit improves only a weapon, a garment, a curio or an instrument.'],
  ];
  for (const [code, fn] of REFUSALS) Text.defineRefusal(code, fn);
})();
