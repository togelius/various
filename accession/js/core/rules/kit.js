// ACCESSION — your kit (BUILD.md §8.1, §8.5). W0e builds the item record, the starting kit
// and your derived stats; W1-KIT builds the tote, the item actions, primitives and curios,
// instruments, Restoration and the stand-in placement, on these.
//
// An item, in state.items:
//   { uid, kind, ref, where, form, tier, level, prims, charges, max, rechargeAt, ck, seal, n, from }
// kind 'weapon', 'garment', 'curio', 'instrument', 'kit' or 'consumable'; ref the pack item's
// id (null for the starting kit); where {at: 'floor' | 'case', x, y}, {at: 'tote'},
// {at: 'kit', slot} or {at: 'gone'}; form a weapon's or garment's form; tier 1–4; level its
// Restoration levels; prims [{id, cls}]; charges, max and rechargeAt an instrument's; ck, seal
// and n a consumable's kind, seal and count; from the department it was first taken in.
// What you wear: state.you = { kit: { weapon, garment, curio: [a, b], instrument }, tote: [uid…] }.
'use strict';
const Kit = (() => {
  // The slots, as an item's where.slot names them.
  const SLOTS = ['weapon', 'garment', 'curio0', 'curio1', 'instrument'];
  const WEAPON_FORMS = ['light', 'balanced', 'heavy', 'reach'], GARMENT_FORMS = ['light', 'standard', 'heavy'];

  // An item with every field, plain data; rec gives uid, kind and where, and any field to set.
  function item(rec) {
    const or = (k, v) => rec[k] !== undefined ? rec[k] : v, copy = v => v === null ? null : JSON.parse(JSON.stringify(v));
    if (typeof rec.uid !== 'string' || !rec.kind || !rec.where) throw new Error('Kit.item: an item needs a uid, a kind and a where');
    return { uid: rec.uid, kind: rec.kind, ref: or('ref', null), where: copy(rec.where), form: or('form', null), tier: or('tier', null),
      level: or('level', 0), prims: copy(or('prims', [])), charges: or('charges', null), max: or('max', null), rechargeAt: or('rechargeAt', null),
      ck: or('ck', null), seal: or('seal', null), n: or('n', null), from: or('from', null) };
  }
  const byUid = (state, uid) => { if (uid === null || uid === undefined) return null; for (const i of state.items) if (i.uid === uid) return i; return null; };

  // The starting kit (§8.1): a T1 weapon of the given form (Balanced if none) and a T1
  // Standard garment, equipped, with the uids you.w and you.g (§3.2).
  function start(state, form) {
    form = form || 'balanced';
    if (!WEAPON_FORMS.includes(form)) throw new Error('Kit.start: no weapon form ' + form);
    if (byUid(state, 'you.w') || byUid(state, 'you.g')) throw new Error('Kit.start: you already have a starting kit');
    if (!state.you) state.you = { kit: { weapon: null, garment: null, curio: [null, null], instrument: null }, tote: [] };
    state.items.push(item({ uid: 'you.w', kind: 'weapon', where: { at: 'kit', slot: 'weapon' }, form, tier: 1 }));
    state.items.push(item({ uid: 'you.g', kind: 'garment', where: { at: 'kit', slot: 'garment' }, form: 'standard', tier: 1 }));
    state.you.kit.weapon = 'you.w';
    state.you.kit.garment = 'you.g';
  }

  // How many grades short of an item you are at `grade` (§8.1): a tier t weapon or garment
  // needs grade 2t − 1, one less for a Light weapon and one more for a Heavy weapon or garment
  // (the form's grade offset in §8.10). Other kinds need no grade.
  function short(it, grade) {
    let off;
    if (it.kind === 'weapon') off = N['FORM_' + it.form.toUpperCase()][5];
    else if (it.kind === 'garment') off = N['GARMENT_' + it.form.toUpperCase()][2];
    else return 0;
    return Math.max(0, 2 * it.tier - 1 + off - grade);
  }

  // Your derived stats from what you wear (§8.1, §8.5): with t the tier, L the level and s
  // the grades short,
  //   weapon damage [t + a + L·RESTORE_DMG, b·t + c + L·RESTORE_DMG] from its form's a, b, c;
  //   Acc PLAYER_ACC + the form's Acc + ⌊L / RESTORE_ACC_EVERY⌋ − SHORT_ACC·s;
  //   Padding max(0, t + the garment's a + L·RESTORE_PAD − SHORT_PAD·s), and Eva PLAYER_EVA +
  //   the garment's Eva (with no garment, Padding 0 and Eva PLAYER_EVA);
  //   weaponForm the weapon's form, reach for a Reach weapon.
  // W1-KIT adds the primitives' and curios' bonuses, quiet and breaker.
  function derive(state) {
    const grade = state.run ? state.run.grade : N.GRADE_START, kit = state.you && state.you.kit;
    return stats(kit && byUid(state, kit.weapon), kit && byUid(state, kit.garment), grade);
  }
  // The same, from a weapon and a garment (or null) worn at a grade.
  function stats(w, g, grade) {
    if (!w) throw new Error('Kit.derive: no weapon is equipped, and the weapon slot is never empty');
    if (!WEAPON_FORMS.includes(w.form)) throw new Error('Kit.derive: no weapon form ' + w.form);
    const F = N['FORM_' + w.form.toUpperCase()], t = w.tier, L = w.level || 0;
    const out = {
      acc: N.PLAYER_ACC + F[4] + Int.idiv(L, N.RESTORE_ACC_EVERY) - N.SHORT_ACC * short(w, grade),
      eva: N.PLAYER_EVA, pad: 0,
      dmin: t + F[0] + L * N.RESTORE_DMG, dmax: F[1] * t + F[2] + L * N.RESTORE_DMG,
      weaponForm: w.form, reach: w.form === 'reach', quiet: 0, breaker: 0,
    };
    if (g) {
      if (!GARMENT_FORMS.includes(g.form)) throw new Error('Kit.derive: no garment form ' + g.form);
      const G = N['GARMENT_' + g.form.toUpperCase()];
      out.pad = Math.max(0, g.tier + G[0] + (g.level || 0) * N.RESTORE_PAD - N.SHORT_PAD * short(g, grade));
      out.eva = N.PLAYER_EVA + G[1];
    }
    return out;
  }

  // Write Kit.derive onto you. It runs when the state is made and at the end of every step
  // (§8.1), so your stats change once your action's ticks are done.
  function settle(state) {
    if (!state.you) return;
    Object.assign(state.actors[0], derive(state));
  }

  const ringDelta = state => 0;                            // [stub → W1-KIT] what your kit adds to your ring (quiet: −1 after a move)
  function recharge(state, ev) {}                          // [stub → W1-KIT] turn boundary step 2: instruments' charges
  // [stub → W1-KIT] The stand-in placement of equipment, a curio or instrument, and the two
  // Restoration kits (the Highlights, in dept.highlights): rooms on `${base}/items`, tiles on
  // each room's populate stream in pop. A removed (without) actor keeps its tile for
  // placement, so no item moves when one is removed. Does nothing for now.
  function standIn(state, base, pop) {}
  const useLegal = state => [];                            // [stub → W1-KIT] use(uid, …) of an instrument or kit
  const useAction = (state, action, ev) => 'not_built';    // [stub → W1-KIT]
  const addToTote = (state, it) => 'not_built';            // [stub → W1-KIT] → a refusal code, or null once it is in the tote
  const targets = (state, uid) => [];                      // [stub → W1-KIT] the tiles an instrument can be used at
  const describe = (state, uid) => null;                   // [stub → W1-KIT] an item's label data
  const view = (state, vis) => null;                       // [stub → W1-KIT] your kit, tote and charges for the view model

  // take(uid), drop(uid), equip(uid), unequip(slot) (§4.2). [stub → W1-KIT]: nothing is legal
  // yet, and every candidate is refused as not built.
  const each = (state, a) => state.items.map(i => ({ a, uid: i.uid })).concat([{ a, uid: 'nothing' }, { a }]);
  for (const id of ['take', 'drop', 'equip']) Actions.define(id, { legal: state => [], candidates: state => each(state, id), apply: (state, action, ev) => 'not_built' });
  Actions.define('unequip', {
    legal: state => [],
    candidates: state => SLOTS.map(slot => ({ a: 'unequip', slot })).concat([{ a: 'unequip', slot: 'nothing' }, { a: 'unequip' }]),
    apply: (state, action, ev) => 'not_built',
  });

  return { SLOTS, item, start, short, derive, stats, settle, ringDelta, recharge, standIn, useLegal, useAction, addToTote, targets, describe, view };
})();
