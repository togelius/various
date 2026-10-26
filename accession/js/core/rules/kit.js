// ACCESSION — your kit (BUILD.md §8.1, §8.5): what you wear and carry, the stats it gives
// you, the item actions (take, drop, equip, unequip), the instruments and the Restoration
// kit (use), and the stand-in placement of a department's equipment and kits. W0e built the
// item record, the starting kit and the derived stats; W1-KIT owns the file after.
//
// An item, in state.items:
//   { uid, kind, ref, where, form, tier, level, prims, charges, max, rechargeAt, ck, seal, n, from }
// kind 'weapon', 'garment', 'curio', 'instrument', 'kit' or 'consumable'; ref the pack item's
// id ('restoration' for a Restoration kit, null for the kit you start with); where
// {at: 'floor' | 'case', x, y}, {at: 'tote'}, {at: 'kit', slot} or {at: 'gone'}; form a
// weapon's or garment's form, or which instrument an instrument is (fork, pin_driver or
// pole); tier 1–4 (a weapon's, a garment's or an instrument's); level its Restoration levels
// (a curio's rank); prims [{id, cls}]; charges, max and rechargeAt an instrument's (the turn
// at whose boundary it next gets a charge back, or null when it is full); ck, seal and n a
// consumable's kind, seal and count; from the department it was first taken in.
// What you wear: state.you = { kit: { weapon, garment, curio: [a, b], instrument }, tote: [uid…] }.
'use strict';
const Kit = (() => {
  // The slots, as an item's where.slot names them.
  const SLOTS = ['weapon', 'garment', 'curio0', 'curio1', 'instrument'];
  const WEAPON_FORMS = ['light', 'balanced', 'heavy', 'reach'], GARMENT_FORMS = ['light', 'standard', 'heavy'];
  // A primitive's size (§5.2): S, M or L indexes its BONUS_* row.
  const CLS = ['S', 'M', 'L'];
  // The kinds the kit makes and places (a consumable is Consumables.make's), and those a
  // Restoration kit can improve (§8.5's table).
  const MADE = ['weapon', 'garment', 'curio', 'instrument', 'kit'], RESTORABLE = ['weapon', 'garment', 'curio', 'instrument'];
  // The ways a Window Pole is used: push or pull an exhibit one tile, or take from a case.
  const POLE = ['push', 'pull', 'take'];
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const isInt = Number.isInteger;

  // An instrument the slice builds, and its row of §8.10: [charges, recharge turns, range].
  const isInstrument = form => own(Registry.INSTRUMENTS, form) && Registry.INSTRUMENTS[form].built === 'M3';
  const row = form => N[Registry.INSTRUMENTS[form].row];

  // An item with every field, plain data; rec gives uid, kind and where, and any field to set.
  // An instrument the slice knows (its form) gets its charges from its row, plus
  // RESTORE_CHARGES a level, unless rec gives them; it starts full.
  function item(rec) {
    const or = (k, v) => rec[k] !== undefined ? rec[k] : v, copy = v => v === null ? null : JSON.parse(JSON.stringify(v));
    if (typeof rec.uid !== 'string' || !rec.kind || !rec.where) throw new Error('Kit.item: an item needs a uid, a kind and a where');
    const it = { uid: rec.uid, kind: rec.kind, ref: or('ref', null), where: copy(rec.where), form: or('form', null), tier: or('tier', null),
      level: or('level', 0), prims: copy(or('prims', [])), charges: or('charges', null), max: or('max', null), rechargeAt: or('rechargeAt', null),
      ck: or('ck', null), seal: or('seal', null), n: or('n', null), from: or('from', null) };
    if (it.kind === 'instrument' && isInstrument(it.form)) {
      if (it.max === null) it.max = row(it.form)[0] + (it.level || 0) * N.RESTORE_CHARGES;
      if (it.charges === null) it.charges = it.max;
    }
    return it;
  }
  const byUid = (state, uid) => { if (typeof uid !== 'string') return null; for (const i of state.items) if (i.uid === uid) return i; return null; };

  // What a slot holds (a uid or null), and putting a uid (or null) in it.
  function slotUid(state, slot) {
    const k = state.you.kit;
    return slot === 'curio0' ? k.curio[0] : slot === 'curio1' ? k.curio[1] : k[slot];
  }
  function setSlot(state, slot, uid) {
    const k = state.you.kit;
    if (slot === 'curio0') k.curio[0] = uid; else if (slot === 'curio1') k.curio[1] = uid; else k[slot] = uid;
  }

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
  function needs(it) {
    if (it.kind === 'weapon') return 2 * it.tier - 1 + N['FORM_' + it.form.toUpperCase()][5];
    if (it.kind === 'garment') return 2 * it.tier - 1 + N['GARMENT_' + it.form.toUpperCase()][2];
    return 0;
  }
  const short = (it, grade) => it.kind === 'weapon' || it.kind === 'garment' ? Math.max(0, needs(it) - grade) : 0;

  // A curio's rank is its Restoration levels (RESTORE_RANK each); each rank adds 1 to each of
  // its numeric bonuses (§8.5).
  const rank = it => it.kind === 'curio' ? (it.level || 0) * N.RESTORE_RANK : 0;
  // A primitive with a size gives its BONUS_* row's value for that size, plus a curio's rank.
  function bonus(it, p) {
    const r = own(Registry.ITEM_PRIMS, p.id) ? Registry.ITEM_PRIMS[p.id] : null, i = CLS.indexOf(p.cls);
    if (!r || !r.row || !Array.isArray(N[r.row])) throw new Error(`Kit: ${it.uid}'s primitive ${p.id} has no size`);
    if (i < 0) throw new Error(`Kit: ${it.uid}'s primitive ${p.id} has the size ${JSON.stringify(p.cls)}, not S, M or L`);
    return N[r.row][i] + rank(it);
  }

  // Your derived stats from what you wear (§8.1, §8.5): with t the tier, L the level and s
  // the grades short,
  //   weapon damage [t + a + L·RESTORE_DMG, b·t + c + L·RESTORE_DMG] from its form's a, b, c;
  //   Acc PLAYER_ACC + the form's Acc + ⌊L / RESTORE_ACC_EVERY⌋ − SHORT_ACC·s;
  //   the garment's own Padding max(0, t + its a + L·RESTORE_PAD − SHORT_PAD·s), never below
  //   0 however far short of it you are, and Eva PLAYER_EVA + the garment's Eva (with no
  //   garment, Padding 0 and Eva PLAYER_EVA);
  //   then every primitive on what you wear (weapon, garment, curios, instrument): a damage,
  //   Acc, Eva or Padding bonus adds its size's value (BONUS_*; a curio's rank more), the
  //   damage bonus to both ends of the range and the Padding bonus on top of the garment's
  //   own (every bonus is at least 1, so taking a garment off never raises your Padding);
  //   reach makes your blows Reach blows; quiet and breaker give QUIET_RING and
  //   BREAKER_BASHES, once however many items have them; charges and observing (M4) change
  //   no stat; weaponForm the weapon's form, reach for a Reach weapon or a reach primitive.
  function derive(state) {
    const grade = state.run ? state.run.grade : N.GRADE_START, kit = state.you && state.you.kit;
    if (!kit) return stats(null, null, grade, []);
    const others = [byUid(state, kit.curio[0]), byUid(state, kit.curio[1]), byUid(state, kit.instrument)].filter(Boolean);
    return stats(byUid(state, kit.weapon), byUid(state, kit.garment), grade, others);
  }
  // A garment's own Padding at a grade (§8.1): tier + its form's a + its levels' Padding,
  // less SHORT_PAD a grade short, never below 0.
  const garmentPad = (g, grade) => Math.max(0, g.tier + N['GARMENT_' + g.form.toUpperCase()][0] + (g.level || 0) * N.RESTORE_PAD - N.SHORT_PAD * short(g, grade));
  // The same, from a weapon and a garment (or null) and the other items worn, at a grade.
  function stats(w, g, grade, others) {
    if (!w) throw new Error('Kit.derive: no weapon is equipped, and the weapon slot is never empty');
    if (!WEAPON_FORMS.includes(w.form)) throw new Error('Kit.derive: no weapon form ' + w.form);
    const F = N['FORM_' + w.form.toUpperCase()], t = w.tier, L = w.level || 0;
    const out = {
      acc: N.PLAYER_ACC + F[4] + Int.idiv(L, N.RESTORE_ACC_EVERY) - N.SHORT_ACC * short(w, grade),
      eva: N.PLAYER_EVA, pad: 0,
      dmin: t + F[0] + L * N.RESTORE_DMG, dmax: F[1] * t + F[2] + L * N.RESTORE_DMG,
      weaponForm: w.form, reach: w.form === 'reach', quiet: 0, breaker: 0,
    };
    let pad = 0, quiet = false, breaker = false;
    if (g) {
      if (!GARMENT_FORMS.includes(g.form)) throw new Error('Kit.derive: no garment form ' + g.form);
      const G = N['GARMENT_' + g.form.toUpperCase()];
      pad = garmentPad(g, grade);
      out.eva = N.PLAYER_EVA + G[1];
    }
    for (const it of [w, g].concat(others || [])) {
      if (!it) continue;
      for (const p of it.prims || []) {
        if (p.id === 'dmg') { const n = bonus(it, p); out.dmin += n; out.dmax += n; }
        else if (p.id === 'acc') out.acc += bonus(it, p);
        else if (p.id === 'eva') out.eva += bonus(it, p);
        else if (p.id === 'pad') pad += bonus(it, p);
        else if (p.id === 'reach') out.reach = true;
        else if (p.id === 'quiet') quiet = true;
        else if (p.id === 'breaker') breaker = true;
        else if (!own(Registry.ITEM_PRIMS, p.id)) throw new Error(`Kit.derive: ${it.uid} has the unknown primitive ${p.id}`);
      }
    }
    out.pad = pad;
    out.quiet = quiet ? N.QUIET_RING : 0;
    out.breaker = breaker ? N.BREAKER_BASHES : 0;
    return out;
  }

  // Write Kit.derive onto you. It runs when the state is made and at the end of every step
  // (§8.1), so your stats change once your action's ticks are done.
  function settle(state) {
    if (!state.you) return;
    Object.assign(state.actors[0], derive(state));
  }

  // What your kit does to your ring (§8.2, §8.5): QUIET_RING smaller while your last action
  // that cost time was a move or an attack (QUIET_ACTS: any move, a bump into an exhibit or
  // a door included, and any blow, so a blow counts the same however you strike it) and you
  // wear a quiet item. It is read from your settled stats, which change once an action's
  // ticks are done; an equip or unequip is neither, so the ring the view model draws is the
  // one the last boundary used. No Lamp term in M3.
  const QUIET_ACTS = ['move', 'attack'];
  function ringDelta(state) {
    const you = state.actors[0];
    return QUIET_ACTS.includes(you.lastAct) && you.quiet ? -you.quiet : 0;
  }

  // ---- The tote (§8.5) ----

  // The tote's slots in use: one per item you carry and do not wear, a consumable stack
  // taking one however many it holds.
  const slots = state => state.you.tote.length;
  // The stack in your tote an item would join: a consumable of the same kind and seal.
  function stackFor(state, it) {
    if (it.kind !== 'consumable') return null;
    for (const u of state.you.tote) { const o = byUid(state, u); if (o && o !== it && o.kind === 'consumable' && o.ck === it.ck && o.seal === it.seal) return o; }
    return null;
  }
  const roomFor = (state, it) => stackFor(state, it) || slots(state) < N.TOTE_SLOTS ? null : 'tote_full';
  // How many a consumable stack holds: its count, or one for a consumable given with no count,
  // as a room for tests may give one (Consumables counts it the same way).
  const count = it => it.n === null || it.n === undefined ? 1 : it.n;
  // Kit.addToTote(state, item) → null once it is carried, or the refusal code: a consumable
  // joins its stack (the stack keeps its uid and the department it came from; the item goes
  // {at: 'gone'}), anything else takes a slot; a full tote refuses, changing nothing. The
  // first department an item is taken in is its `from`.
  function addToTote(state, it) {
    if (state.you.tote.includes(it.uid)) return 'carried';
    const code = roomFor(state, it);
    if (code) return code;
    if (it.from === null && state.dept) it.from = state.dept.acc || null;
    const stack = stackFor(state, it);
    if (stack) { stack.n = count(stack) + count(it); it.where = { at: 'gone' }; return null; }
    state.you.tote.push(it.uid);
    it.where = { at: 'tote' };
    return null;
  }

  // The data an item's events carry, so a sentence can say what it was.
  function desc(it) {
    const out = { kind: it.kind };
    if (it.form !== null) out.form = it.form;
    if (it.tier !== null) out.tier = it.tier;
    if (it.level) out.level = it.level;
    if (it.kind === 'consumable' && it.n !== null) out.n = it.n;
    return out;
  }

  // ---- take, drop, equip, unequip (§4.2, §8.5) ----

  // Can you reach (x, y) with your hand: your tile or one beside it, a diagonal one not past
  // a corner (as a blow, §8.1)?
  function handReach(state, x, y) {
    const you = state.actors[0], dx = x - you.x, dy = y - you.y, m = state.dept;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 1) return 'out_of_reach';
    if (dx !== 0 && dy !== 0 && !(Grid.walkable(m, x, you.y) && Grid.walkable(m, you.x, y))) return 'corner';
    return null;
  }
  // take(uid): an item on the floor, or in an opened or broken case (Cases.reach), on your
  // tile or one beside you, into your tote. There is no picking up by walking over.
  function takeCode(state, it) {
    if (!it) return 'no_item';
    const w = it.where;
    if (w.at === 'tote' || w.at === 'kit') return 'carried';
    if (w.at !== 'floor' && w.at !== 'case') return 'no_item';
    const r = handReach(state, w.x, w.y);
    if (r) return r;
    if (w.at === 'case' && !Cases.reach(state, it)) return 'behind_glass';
    return roomFor(state, it);
  }
  // Take it (the checks done): into the tote, out of its case's `holds`, and the took event.
  function takeIt(state, it, tool, ev) {
    const x = it.where.x, y = it.where.y, inCase = it.where.at === 'case', stack = stackFor(state, it), d = desc(it);
    addToTote(state, it);
    if (inCase) { const f = Cases.at(state, x, y); if (f && f.holds === it.uid) f.holds = null; }
    const cause = Object.assign({ k: 'take', x, y }, d);
    if (inCase) cause.inCase = true;
    if (tool) cause.tool = tool;
    if (stack) cause.stack = stack.uid;
    Causes.emit(state, ev, 'took', { who: 'you', item: it.uid, x, y }, cause);
  }
  // drop(uid): an item from your tote, onto your tile.
  function dropCode(state, it) {
    if (!it) return 'no_item';
    if (it.where.at === 'kit') return 'worn';
    return it.where.at === 'tote' ? null : 'not_carried';
  }
  // equip(uid): an item from your tote into its slot (§8.5). A weapon, garment or
  // instrument takes the place of the one worn, which goes to the tote where the new one
  // was; a curio takes the first empty curio slot. Only from the tote.
  function slotFor(state, it) {
    if (it.kind === 'weapon') return WEAPON_FORMS.includes(it.form) ? 'weapon' : null;
    if (it.kind === 'garment') return GARMENT_FORMS.includes(it.form) ? 'garment' : null;
    if (it.kind === 'instrument') return 'instrument';
    if (it.kind === 'curio') return state.you.kit.curio[0] === null ? 'curio0' : state.you.kit.curio[1] === null ? 'curio1' : 'full';
    return null;
  }
  function equipCode(state, it) {
    if (!it) return 'no_item';
    if (it.where.at === 'kit') return 'worn';
    if (it.where.at !== 'tote') return 'not_carried';
    const slot = slotFor(state, it);
    return slot === null ? 'not_equippable' : slot === 'full' ? 'curio_slots_full' : null;
  }
  // The cost of putting on, or taking off, what a slot holds (§8.1): a garment
  // COST_EQUIP_GARMENT, anything else COST_EQUIP; taking off costs what putting on does.
  const equipCost = kind => kind === 'garment' ? N.COST_EQUIP_GARMENT : N.COST_EQUIP;
  // unequip(slot): what a slot holds goes to your tote. The weapon slot is never empty, so
  // a weapon is changed by equipping another.
  function unequipCode(state, slot) {
    if (!SLOTS.includes(slot)) return 'bad_slot';
    if (slot === 'weapon') return 'weapon_slot';
    if (slotUid(state, slot) === null) return 'slot_empty';
    return slots(state) < N.TOTE_SLOTS ? null : 'tote_full';
  }
  const grade = state => state.run ? state.run.grade : N.GRADE_START;
  // What an item action costs you: its base cost, doubled while you are slowed (Actors.cost).
  const paid = (state, base) => Actors.cost(state, state.actors[0], base, 'act');

  const itemOf = (state, action) => typeof action.uid === 'string' ? byUid(state, action.uid) : null;
  const each = (state, a) => state.items.map(i => ({ a, uid: i.uid })).concat([{ a, uid: 'nothing' }, { a }]);
  Actions.define('take', {
    legal: state => state.items.filter(i => (i.where.at === 'floor' || i.where.at === 'case') && takeCode(state, i) === null).map(i => ({ a: 'take', uid: i.uid })),
    candidates: state => each(state, 'take'),
    apply(state, action, ev) {
      const it = itemOf(state, action), code = takeCode(state, it);
      if (code) return code;
      takeIt(state, it, null, ev);
      return paid(state, N.COST_TAKE);
    },
  });
  Actions.define('drop', {
    legal: state => state.you.tote.map(uid => ({ a: 'drop', uid })),
    candidates: state => each(state, 'drop'),
    apply(state, action, ev) {
      const it = itemOf(state, action), code = dropCode(state, it);
      if (code) return code;
      const you = state.actors[0], tote = state.you.tote;
      tote.splice(tote.indexOf(it.uid), 1);
      it.where = { at: 'floor', x: you.x, y: you.y };
      Causes.emit(state, ev, 'dropped', { who: 'you', item: it.uid, x: you.x, y: you.y }, Object.assign({ k: 'drop' }, desc(it)));
      return paid(state, N.COST_TAKE);
    },
  });
  Actions.define('equip', {
    legal: state => state.you.tote.filter(uid => equipCode(state, byUid(state, uid)) === null).map(uid => ({ a: 'equip', uid })),
    candidates: state => each(state, 'equip'),
    apply(state, action, ev) {
      const it = itemOf(state, action), code = equipCode(state, it);
      if (code) return code;
      const slot = slotFor(state, it), old = slotUid(state, slot), tote = state.you.tote, i = tote.indexOf(it.uid);
      if (old !== null) { tote[i] = old; byUid(state, old).where = { at: 'tote' }; } else tote.splice(i, 1);
      it.where = { at: 'kit', slot };
      setSlot(state, slot, it.uid);
      Causes.emit(state, ev, 'equipped', { who: 'you', item: it.uid, slot, was: old }, Object.assign({ k: 'equip', short: short(it, grade(state)) }, desc(it)));
      return paid(state, equipCost(it.kind));
    },
  });
  Actions.define('unequip', {
    legal: state => SLOTS.filter(slot => unequipCode(state, slot) === null).map(slot => ({ a: 'unequip', slot })),
    candidates: state => SLOTS.map(slot => ({ a: 'unequip', slot })).concat([{ a: 'unequip', slot: 'nothing' }, { a: 'unequip' }]),
    apply(state, action, ev) {
      const code = unequipCode(state, action.slot);
      if (code) return code;
      const uid = slotUid(state, action.slot), it = byUid(state, uid);
      setSlot(state, action.slot, null);
      it.where = { at: 'tote' };
      state.you.tote.push(uid);
      Causes.emit(state, ev, 'equipped', { who: 'you', item: null, slot: action.slot, was: uid }, Object.assign({ k: 'unequip' }, desc(it)));
      return paid(state, equipCost(it.kind));
    },
  });

  // ---- Instruments (§8.5) ----

  // Kit.shot(state, uid) → how: the Pin-Driver's bolt, for Ranged.shoot (§8.1): damage
  // [t + a, b·t + c] from PIN_DRIVER_DMG at its tier t (tier 1 if it has none), rolled with
  // your Acc without the weapon's: PLAYER_ACC plus the Acc bonuses of your garment, curios
  // and instrument.
  function shot(state, uid) {
    const it = byUid(state, uid), kit = state.you.kit, t = it && isInt(it.tier) ? it.tier : 1, D = N.PIN_DRIVER_DMG;
    let acc = N.PLAYER_ACC;
    for (const o of [kit.garment, kit.curio[0], kit.curio[1], kit.instrument].map(u => byUid(state, u))) if (o) for (const p of o.prims || []) if (p.id === 'acc') acc += bonus(o, p);
    return { kind: 'shot', item: uid, dmin: t + D[0], dmax: D[1] * t + D[2], acc };
  }

  // The direction index (Grid.DX/DY) of a step (dx, dy) with each part −1, 0 or 1.
  const dirOf = (dx, dy) => { for (let d = 0; d < 8; d++) if (Grid.DX[d] === dx && Grid.DY[d] === dy) return d; return -1; };
  // Where the pole would move the exhibit a on (x, y): one tile straight away from you
  // (push) or toward you (pull), where it could step itself (the exhibits' step rule,
  // Archetypes.mayStep), onto no actor and no closed door. [x, y], or null.
  function poleTo(state, a, how) {
    const you = state.actors[0], m = state.dept, sx = Math.sign(a.x - you.x), sy = Math.sign(a.y - you.y);
    const dx = how === 'push' ? sx : -sx, dy = how === 'push' ? sy : -sy, d = dirOf(dx, dy), nx = a.x + dx, ny = a.y + dy;
    if (d < 0 || !Grid.canStep(m, a.x, a.y, d, 'exhibit') || Grid.closedDoor(m, nx, ny)) return null;
    if (Actors.at(state, nx, ny, a) || !Archetypes.mayStep(state, a, nx, ny)) return null;
    return [nx, ny];
  }
  // An exhibit the Pin-Driver or the pole can be aimed at: one you can see as an exhibit (not
  // a mimic in its disguise, which shows as a case), on (x, y).
  function exhibitAt(state, x, y) {
    const a = Actors.at(state, x, y);
    return a && a.uid !== 'you' && Archetypes.present(state, a) === null ? a : null;
  }
  // The item in the case on (x, y), if any.
  const inCaseAt = (state, x, y) => state.items.find(i => i.where.at === 'case' && i.where.x === x && i.where.y === y) || null;

  // Why your instrument it cannot be used at (x, y) with `how` now, or null (§8.5). In order:
  // it must be in your instrument slot; a known instrument; aimed (x and y) and nothing else
  // (`on` is a kit's); with a charge left; at a tile of the board (no_aim), not your own
  // (own_tile); then:
  //   Pin-Driver: with no `how`; its bolt is a shot, refused as §8.1 refuses one
  //     (Ranged.canShoot at its range): out_of_reach outside its range, blocked out of your
  //     sight, behind_glass if the bolt would meet glass first (so a case, an exhibit in
  //     one, fixed glazing and a mimic's disguise look the same), no_target if it would reach
  //     no body; and then at an exhibit you can see (no_target);
  // the fork and the pole: within its range (Grid.disc; out_of_range) and in your line of
  // sight (no_line); then:
  //   fork: any tile an exhibit could stand on (Grid.hold; not_a_place), with no `how`;
  //   pole: how push or pull with an exhibit you can see (no_exhibit), one tile in size
  //     (too_big), not in a case (in_case), whose special is not marked (marked: it would
  //     move away from, or onto, tiles already shown), that can be moved there (poleTo); or
  //     how take with an item in an opened or broken case (Cases.reach) and room in your tote.
  function aimCode(state, it, x, y, how, on) {
    const you = state.actors[0], m = state.dept;
    if (!it || it.kind !== 'instrument') return 'no_item';
    if (!(it.where.at === 'kit' && it.where.slot === 'instrument')) return 'not_equipped';
    if (!isInstrument(it.form) || !isInt(it.charges)) return 'no_use';
    if (on !== undefined && on !== null) return 'bad_use';
    if (!isInt(x) || !isInt(y)) return 'no_aim';
    if (it.charges < 1) return 'no_charges';
    if (!Grid.inside(m, x, y)) return 'no_aim';
    if (x === you.x && y === you.y) return 'own_tile';
    const range = row(it.form)[2];
    if (it.form === 'pin_driver') {
      if (how !== undefined && how !== null) return 'bad_use';
      const shot = Ranged.canShoot(state, you, x, y, { kind: 'shot', max: range });
      if (shot) return shot;
      return exhibitAt(state, x, y) ? null : 'no_target';
    }
    if (!Grid.disc(x - you.x, y - you.y, range)) return 'out_of_range';
    if (!Grid.los(m, you.x, you.y, x, y)) return 'no_line';
    if (it.form === 'fork') {
      if (how !== undefined && how !== null) return 'bad_use';
      return Grid.hold(m, x, y) ? null : 'not_a_place';
    }
    if (!POLE.includes(how)) return 'bad_use';
    if (how === 'take') {
      const thing = inCaseAt(state, x, y);
      if (!thing || !Cases.reach(state, thing)) return 'nothing_to_take';
      return roomFor(state, thing);
    }
    const a = exhibitAt(state, x, y);
    if (!a) return 'no_exhibit';
    if ((a.size || 1) !== 1) return 'too_big';
    if (Cases.encased(state, a)) return 'in_case';
    if (a.telegraph) return 'marked';
    return poleTo(state, a, how) ? null : 'cannot_move';
  }

  // Kit.useInstrument(state, uid, x, y, how, ev) → ticks (COST_USE), or a refusal code with
  // nothing changed. Each use's used event comes first, then what it did. The fork makes a
  // soft noise at the tile, which is yours (by: you), so hunters that hear it look there;
  // the Pin-Driver fires a bolt (Ranged.shoot, with Kit.shot's damage and Acc), tried first
  // on a copy of the state, so that a bolt Ranged.shoot refuses is refused with nothing
  // changed and nothing said; the pole pushes or pulls the exhibit one tile without waking
  // it, or takes the item from the case into your tote. Each use spends one charge; an
  // instrument that was full starts recharging (rechargeAt).
  function useInstrument(state, uid, x, y, how, ev) {
    const it = byUid(state, uid), code = aimCode(state, it, x, y, how, null);
    if (code) return code;
    const R = row(it.form), cause = { k: 'use', x, y };
    const spend = () => { it.charges -= 1; if (it.rechargeAt === null) it.rechargeAt = state.turn + R[1]; cause.charges = it.charges; };
    if (it.form === 'pin_driver') {
      const probe = State.clone(state), tried = Ranged.shoot(probe, probe.actors[0], x, y, shot(probe, uid), []);
      if (typeof tried === 'string') return tried;
      const a = exhibitAt(state, x, y);
      spend(); cause.at = a.uid;
      Causes.emit(state, ev, 'used', { who: 'you', item: uid, how: 'pin_driver' }, cause);
      const r = Ranged.shoot(state, state.actors[0], x, y, shot(state, uid), ev);
      if (typeof r === 'string') throw new Error(`Kit: the Pin-Driver's bolt at ${x},${y} was refused (${r}) after the same bolt was not`);
      return paid(state, N.COST_USE);
    }
    if (it.form === 'fork') {
      spend();
      Causes.emit(state, ev, 'used', { who: 'you', item: uid, how: 'fork' }, cause);
      Noise.emit(state, x, y, 'soft', { k: 'fork', by: 'you', item: uid }, ev);
      return paid(state, N.COST_USE);
    }
    if (how === 'take') {
      const thing = inCaseAt(state, x, y);
      spend(); cause.on = thing.uid;
      Causes.emit(state, ev, 'used', { who: 'you', item: uid, how }, cause);
      takeIt(state, thing, uid, ev);
      return paid(state, N.COST_USE);
    }
    const a = exhibitAt(state, x, y), to = poleTo(state, a, how);
    spend(); cause.at = a.uid; cause.to = to;
    Causes.emit(state, ev, 'used', { who: 'you', item: uid, how }, cause);
    Causes.emit(state, ev, 'moved', { who: a.uid, from: [a.x, a.y], to: to.slice() }, { k: 'pole', by: 'you', item: uid });
    a.x = to[0]; a.y = to[1];
    return paid(state, N.COST_USE);
  }

  // Turn boundary step 2, after the status timers (§8.1): every instrument that is not full,
  // wherever it is, gets one charge back at the boundary of its rechargeAt turn, then waits
  // its row's recharge turns again until it is full. It emits nothing; the charges show in
  // the view model.
  function recharge(state, ev) {
    for (const it of state.items) {
      if (it.kind !== 'instrument' || it.where.at === 'gone' || !isInstrument(it.form) || !isInt(it.max) || !isInt(it.charges) || it.charges >= it.max) continue;
      const R = row(it.form)[1];
      if (it.rechargeAt === null) { it.rechargeAt = state.turn + R; continue; }
      if (state.turn < it.rechargeAt) continue;
      it.charges += 1;
      it.rechargeAt = it.charges < it.max ? state.turn + R : null;
    }
  }

  // ---- Restoration (§8.5) ----

  // Why the Restoration kit kitUid cannot be applied to targetUid now, or null: the kit must
  // be in your tote, and the target a weapon, garment, curio or instrument you wear or carry.
  function restoreCode(state, kitUid, targetUid) {
    const k = byUid(state, kitUid);
    if (!k || k.kind !== 'kit') return 'no_item';
    if (k.where.at !== 'tote') return 'not_carried';
    if (targetUid === undefined || targetUid === null) return 'no_aim';
    const t = byUid(state, targetUid);
    if (!t) return 'no_item';
    if (t.where.at !== 'tote' && t.where.at !== 'kit') return 'not_carried';
    return RESTORABLE.includes(t.kind) ? null : 'cannot_restore';
  }
  // Kit.restore(state, kitUid, targetUid, ev) → COST_USE, or a refusal code: the kit is used
  // up and the item gains a level. A weapon's level gives RESTORE_DMG damage at both ends and
  // 1 Acc at every RESTORE_ACC_EVERY levels; a garment's RESTORE_PAD Padding; a curio's
  // RESTORE_RANK rank; an instrument's RESTORE_CHARGES charges, added to its maximum and
  // filled at once (Kit.derive reads the levels, at the end of the step).
  function restore(state, kitUid, targetUid, ev) {
    const code = restoreCode(state, kitUid, targetUid);
    if (code) return code;
    const k = byUid(state, kitUid), t = byUid(state, targetUid), tote = state.you.tote;
    tote.splice(tote.indexOf(kitUid), 1);
    k.where = { at: 'gone' };
    t.level = (t.level || 0) + 1;
    if (t.kind === 'instrument' && isInt(t.max) && isInt(t.charges)) {
      t.max += N.RESTORE_CHARGES; t.charges = Math.min(t.max, t.charges + N.RESTORE_CHARGES);
      if (t.charges >= t.max) t.rechargeAt = null;
    }
    Causes.emit(state, ev, 'used', { who: 'you', item: kitUid, how: 'restore' }, { k: 'use', on: targetUid, kind: t.kind, level: t.level });
    return paid(state, N.COST_USE);
  }

  // ---- use(uid, …) of an instrument or a kit (§4.2) ----

  // Kit.useAction(state, action, ev): use(uid, x, y[, how]) of your instrument, or
  // use(uid, on) of a Restoration kit in your tote (a kit takes no tile and no how).
  function useAction(state, action, ev) {
    const it = itemOf(state, action);
    if (it && it.kind === 'kit') {
      if (action.x !== undefined || action.y !== undefined || action.how !== undefined) return 'bad_use';
      return restore(state, it.uid, action.on, ev);
    }
    const code = aimCode(state, it, action.x, action.y, action.how, action.on);
    return code || useInstrument(state, it.uid, action.x, action.y, action.how, ev);
  }
  // The tiles around you a tool of range r could reach, row-major, on the board.
  function around(state, r) {
    const you = state.actors[0], m = state.dept, out = [];
    for (let y = you.y - r; y <= you.y + r; y++) for (let x = you.x - r; x <= you.x + r; x++) if (Grid.inside(m, x, y)) out.push([x, y]);
    return out;
  }
  // The instrument you wear, if the slice knows it.
  function instrument(state) {
    const it = byUid(state, state.you.kit.instrument);
    return it && isInstrument(it.form) ? it : null;
  }
  // Kit.useLegal(state): every use of your instrument at a tile it may be used at (row-major;
  // for the pole push, pull and take in that order), then every Restoration kit in your
  // tote on every item it can improve (what you wear in slot order, then your tote in order).
  function useLegal(state) {
    const out = [], inst = instrument(state);
    if (inst) for (const [x, y] of around(state, row(inst.form)[2])) {
      if (inst.form === 'pole') { for (const how of POLE) if (aimCode(state, inst, x, y, how, null) === null) out.push({ a: 'use', uid: inst.uid, x, y, how }); }
      else if (aimCode(state, inst, x, y, undefined, null) === null) out.push({ a: 'use', uid: inst.uid, x, y });
    }
    const mine = SLOTS.map(s => slotUid(state, s)).filter(u => u !== null).concat(state.you.tote);
    for (const k of state.you.tote) {
      const kit = byUid(state, k);
      if (!kit || kit.kind !== 'kit') continue;
      for (const on of mine) if (restoreCode(state, k, on) === null) out.push({ a: 'use', uid: k, on });
    }
    return out;
  }
  // Kit.useCandidates(state): a superset of useLegal (§4.2), with refused shapes beside the
  // legal ones: for every instrument and kit, a bare use and the targeted shape aimed nowhere
  // (a tile off the board; an item that is not there); for your instrument, every tile it may
  // be used at, and the tiles straight out from you in the 8 directions to one beyond its
  // range and your own tile, each with every pole how and one it does not know (for the pole)
  // or plain (and once with a how, for the others); for every kit in your tote, every item.
  function useCandidates(state) {
    const out = [];
    for (const i of state.items || []) {
      if (i.kind === 'instrument') out.push({ a: 'use', uid: i.uid }, { a: 'use', uid: i.uid, x: -1, y: -1 });
      else if (i.kind === 'kit') out.push({ a: 'use', uid: i.uid }, { a: 'use', uid: i.uid, on: 'nothing' }, { a: 'use', uid: i.uid, on: 'you.w' });
    }
    const inst = instrument(state);
    if (inst) {
      const you = state.actors[0], r = row(inst.form)[2] + 1, seen = new Set(), tiles = [];
      const add = (x, y) => { if (Grid.inside(state.dept, x, y) && !seen.has(x + ',' + y)) { seen.add(x + ',' + y); tiles.push([x, y]); } };
      for (const a of useLegal(state)) if (a.uid === inst.uid) add(a.x, a.y);
      add(you.x, you.y);
      for (let d = 0; d < 8; d++) for (let k = 1; k <= r; k++) add(you.x + Grid.DX[d] * k, you.y + Grid.DY[d] * k);
      for (const [x, y] of tiles) {
        if (inst.form === 'pole') for (const how of POLE.concat(['nothing'])) out.push({ a: 'use', uid: inst.uid, x, y, how });
        else out.push({ a: 'use', uid: inst.uid, x, y });
      }
      if (inst.form !== 'pole' && tiles.length) out.push({ a: 'use', uid: inst.uid, x: tiles[0][0], y: tiles[0][1], how: 'push' });
    }
    for (const k of state.you.tote) {
      const kit = byUid(state, k);
      if (kit && kit.kind === 'kit') for (const i of state.items) out.push({ a: 'use', uid: k, on: i.uid });
    }
    return out;
  }
  // Kit.targets(state, uid) → [[x, y]…]: the tiles your instrument uid can be used at now,
  // row-major, each once (for aiming); [] for anything else.
  function targets(state, uid) {
    const seen = new Set(), out = [];
    for (const a of useLegal(state)) if (a.uid === uid && isInt(a.x) && !seen.has(a.x + ',' + a.y)) { seen.add(a.x + ',' + a.y); out.push([a.x, a.y]); }
    return out;
  }

  // ---- Making and placing items (§3.2, §8.5) ----

  // The next item uid in room `key`: <acc>.<depth>.<key>.i<n>, n one more than the highest
  // already used there (§3.2), so items placed in a room, whoever places them, never share one.
  function nextUid(state, key) {
    const m = state.dept, prefix = `${m.acc}.${m.depth}.${key}.i`;
    let n = 0;
    for (const i of state.items) if (i.uid.startsWith(prefix) && /^\d+$/.test(i.uid.slice(prefix.length))) n = Math.max(n, +i.uid.slice(prefix.length));
    return prefix + (n + 1);
  }
  // Kit.make(state, spec, where) → item: an item made from a pack item (§5.2; spec its record,
  // with the tier drawn for it), or a Restoration kit (spec {kind: 'kit'}), appended to
  // state.items at where ({at: 'floor' | 'case', x, y}, putting it in that case's `holds`, or
  // {at: 'tote'}). A weapon, garment or instrument needs spec.tier; an instrument's form is
  // its pack record's `instrument`. Its uid is <acc>.<depth>.<roleKey>.i<n> for the room it is
  // placed in ('room' outside any room; for the tote, the room you stand in), unless spec
  // gives one.
  function make(state, spec, where) {
    const kind = spec && spec.kind, at = where && where.at;
    if (!MADE.includes(kind)) throw new Error(`Kit.make: the kit makes weapons, garments, curios, instruments and kits, not ${kind}`);
    if (!['floor', 'case', 'tote'].includes(at)) throw new Error('Kit.make: an item is made on the floor, in a case or in the tote');
    const tiered = kind === 'weapon' || kind === 'garment' || kind === 'instrument';
    if (tiered && !isInt(spec.tier)) throw new Error(`Kit.make: a ${kind} needs its tier (drawn from depth, §8.1)`);
    const you = state.actors[0], x = at === 'tote' ? you.x : where.x, y = at === 'tote' ? you.y : where.y;
    const uid = spec.uid || nextUid(state, Cases.roomKey(state, x, y) || 'room');
    if (byUid(state, uid)) throw new Error(`Kit.make: the item ${uid} already exists`);
    const form = kind === 'instrument' ? spec.instrument || spec.form || null : kind === 'weapon' || kind === 'garment' ? spec.form : null;
    const it = item({ uid, kind, ref: kind === 'kit' ? 'restoration' : spec.id || null, where: at === 'tote' ? { at: 'tote' } : { at, x, y },
      form, tier: tiered ? spec.tier : null, level: spec.level || 0, prims: (spec.prims || []).map(p => ({ id: p.id, cls: p.cls })) });
    if (at === 'case') {
      const f = Cases.at(state, x, y);
      if (!f || f.k !== 'case' || f.holds !== null) throw new Error(`Kit.make: there is no empty case at ${x},${y}`);
      f.holds = uid;
    }
    if (at === 'tote') {
      if (slots(state) >= N.TOTE_SLOTS) throw new Error(`Kit.make: the tote holds ${N.TOTE_SLOTS} items`);
      state.you.tote.push(uid);
    }
    state.items.push(it);
    return it;
  }

  // The tier of a placed weapon, garment or instrument (§8.1): the lower tier on offer at the
  // depth (TIER_LOW_BY_DEPTH) with TIER_LOW_PCT in 100, otherwise the next one up, never above
  // the highest tier there is (TIER_LOW_BY_DEPTH's last).
  function drawTier(rng, depth) {
    const T = N.TIER_LOW_BY_DEPTH, low = T[Math.min(T.length, Math.max(1, depth)) - 1];
    return rng.int(1, 100) <= N.TIER_LOW_PCT ? low : Math.min(T[T.length - 1], low + 1);
  }

  // The walking distances from the entrance that pass no staff door (the exhibits' step
  // rule), on the map as it was laid out: a mimic's disguise counts as the floor it stood on,
  // so removing a mimic moves no Highlight (§3.2).
  function reachable(state) {
    const m = state.dept, tiles = m.tiles.slice();
    for (const f of m.fixtures) if (f.k === 'case' && f.mimic !== null) tiles[f.y] = tiles[f.y].slice(0, f.x) + '.' + tiles[f.y].slice(f.x + 1);
    const map = { w: m.w, h: m.h, tiles, surfaces: [] };
    return { map, dist: Grid.distances(map, [m.entrance], m.w * m.h, null, 'exhibit') };
  }
  // Where an item may be placed in room rm, row-major: its floor tiles that no actor stands
  // on (a removed one included, so removing an exhibit moves no item) and no item lies on,
  // and its empty cases (shut, not on loan, not a mimic's). A Restoration kit (a Highlight)
  // goes only where you can walk from the entrance without a staff door, and only into a
  // case whose lock is within the grade you came in with (Cases.highlightOk).
  function spotsIn(state, rm, highlight, reach) {
    const m = state.dept, out = [];
    for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) {
      if (m.roomOf[y][x] !== rm.id) continue;
      const f = Cases.at(state, x, y);
      if (f) {
        if (f.k !== 'case' || f.st !== 'shut' || f.loan || f.mimic !== null || f.holds !== null) continue;
        if (highlight && !(Cases.highlightOk(state, f) && Grid.reachDist(reach.dist, reach.map, x, y, 'exhibit') >= 0)) continue;
        out.push([x, y, true]);
      } else if (m.tiles[y][x] === '.') {
        if (state.actors.some(a => Actors.covers(a, x, y)) || state.items.some(i => (i.where.at === 'floor' || i.where.at === 'case') && i.where.x === x && i.where.y === y)) continue;
        if (highlight && reach.dist[y * m.w + x] < 0) continue;
        out.push([x, y, false]);
      }
    }
    return out;
  }
  // Kit.standIn(state, base, pop): the M3 stand-in placement (§8.5), until M4's population.
  // On the department's `${base}/items` stream (in pop): first the pieces, EQUIPMENT_PER_DEPT
  // of the pack's weapons and garments and CURIO_OR_INSTRUMENT_PER_DEPT of its curios and
  // instruments, each list shuffled and taken in turn (again from its start if it is short),
  // then KITS_PER_DEPT Restoration kits; then, for each piece in that order, its room, drawn
  // from the sections and studies (the next one in order if it has no place left). Then, on
  // that room's populate stream (in pop, after the cases' draws): its place (spotsIn), and a
  // weapon's, garment's or instrument's tier (drawTier). Each kit is a Highlight, recorded
  // in dept.highlights as {uid, room}.
  function standIn(state, base, pop) {
    const m = state.dept, pack = Packs.get(m.acc);
    if (!pack || !m.rooms || !m.roomOf) return;
    const rng = Rng.stream(pop, `${base}/items`), items = pack.items || [], pieces = [];
    const take = (list, n) => { const l = rng.shuffle(list); for (let i = 0; i < n && l.length; i++) pieces.push(l[i % l.length]); };
    take(items.filter(i => i.kind === 'weapon' || i.kind === 'garment'), N.EQUIPMENT_PER_DEPT);
    take(items.filter(i => i.kind === 'curio' || i.kind === 'instrument'), N.CURIO_OR_INSTRUMENT_PER_DEPT);
    for (let i = 0; i < N.KITS_PER_DEPT; i++) pieces.push({ kind: 'kit' });
    const rooms = m.rooms.filter(r => r.role === 'section' || r.role === 'study');
    if (!rooms.length) return;
    const reach = reachable(state);
    for (const spec of pieces) {
      const highlight = spec.kind === 'kit', first = rng.int(0, rooms.length - 1);
      for (let k = 0; k < rooms.length; k++) {
        const rm = rooms[(first + k) % rooms.length], spots = spotsIn(state, rm, highlight, reach);
        if (!spots.length) continue;
        const pr = Rng.stream(pop, `${base}/room/${rm.key}/populate`), [x, y, inCase] = pr.pick(spots);
        const tier = spec.kind === 'weapon' || spec.kind === 'garment' || spec.kind === 'instrument' ? drawTier(pr, m.depth) : null;
        const it = make(state, tier === null ? spec : Object.assign({}, spec, { tier }), { at: inCase ? 'case' : 'floor', x, y });
        if (highlight) m.highlights.push({ uid: it.uid, room: rm.key });
        break;
      }
    }
  }

  // ---- What the view model and the labels read ----

  // Kit.view(state, vis) → what the view model shows of your kit (§6.1): the uids you wear
  // and carry; your instrument's charges ({uid, charges, max, back}, back the turns until
  // its next charge, or null when it is full); the weapons, garments, curios, instruments
  // and kits lying on the floor or in a case on a tile vis marks (vis[y·w + x] truthy;
  // Vision.visible(state) if vis is not given), as {uid, x, y, icon, kind, inCase}, icon the
  // item's kind (consumables are Consumables.view's); and the Highlights not yet taken.
  function view(state, vis) {
    const m = state.dept, v = vis || Vision.visible(state), kit = state.you.kit, inst = instrument(state), items = [];
    for (const i of state.items) {
      if (i.kind === 'consumable' || (i.where.at !== 'floor' && i.where.at !== 'case')) continue;
      if (!Grid.inside(m, i.where.x, i.where.y) || !v[i.where.y * m.w + i.where.x]) continue;
      items.push({ uid: i.uid, x: i.where.x, y: i.where.y, icon: i.kind, kind: i.kind, inCase: i.where.at === 'case' });
    }
    return {
      kit: { weapon: kit.weapon, garment: kit.garment, curio: kit.curio.slice(), instrument: kit.instrument },
      tote: state.you.tote.slice(),
      charges: inst ? { uid: inst.uid, charges: inst.charges, max: inst.max, back: inst.rechargeAt === null ? null : Math.max(0, inst.rechargeAt - state.turn) } : null,
      items,
      highlights: (m.highlights || []).filter(h => { const i = byUid(state, h.uid); return !!i && (i.where.at === 'floor' || i.where.at === 'case'); }).map(h => ({ uid: h.uid, room: h.room })),
    };
  }

  // The registry entries an item's Behaviour line is made of (§5.3, §8.8): a weapon's or
  // garment's form clause and the grade clause, then each primitive's, then an instrument's
  // or the Restoration kit's; each part's text filled from its numbers of record.
  // A weapon or garment of a form §8.1 knows, with a tier.
  const formed = it => isInt(it.tier) && ((it.kind === 'weapon' && WEAPON_FORMS.includes(it.form)) || (it.kind === 'garment' && GARMENT_FORMS.includes(it.form)));
  function parts(it) {
    const R = Registry, ids = [];
    if (formed(it)) ids.push(['CLAUSES', `${it.kind}_${it.form}`], ['CLAUSES', 'item_grade']);
    for (const p of it.prims || []) if (own(R.ITEM_PRIMS, p.id) && !ids.some(([t, id]) => t === 'ITEM_PRIMS' && id === p.id)) ids.push(['ITEM_PRIMS', p.id]);
    if (it.kind === 'instrument' && isInstrument(it.form)) ids.push(['INSTRUMENTS', it.form]);
    if (it.kind === 'kit') ids.push(['KITS', 'restoration']);
    return ids.filter(([t, id]) => own(R[t], id) && typeof R[t][id].clause === 'string')
      .map(([t, id]) => ({ table: t, id, text: Clauses.fill(R[t][id].clause, Clauses.params(R[t][id].params, null, { depth: 1 })) }));
  }
  // Kit.describe(state, uid) → an item's label data (§8.8), or null: its pack record's name,
  // tombstone and paragraph (null for the kit you start with and for Restoration kits);
  // its kind, form, tier, level and (a curio's) rank; the grade it needs and how many you
  // are short; its own numbers (a weapon's damage, Acc and blow cost; a garment's Padding
  // and Eva, at your grade, before the bonuses of what else you wear); its bonuses
  // [{id, cls, n}]; an instrument's charges, maximum, recharge turns, range and turns until
  // its next charge (and the Pin-Driver's damage); and the parts and line of its Behaviour
  // line. Labels.ofItem (W2a-LABELS) makes the label from it.
  function describe(state, uid) {
    const it = byUid(state, uid);
    if (!it) return null;
    let rec = null;
    if (it.ref && it.kind !== 'kit') for (const p of Packs.list()) for (const r of p.items || []) if (r.id === it.ref) rec = r;
    const g = grade(state), worn = formed(it);
    const out = { uid, kind: it.kind, ref: it.ref, title: rec ? rec.name : null, tomb: rec ? rec.tomb : null, paragraph: rec ? rec.paragraph : null,
      where: JSON.parse(JSON.stringify(it.where)), form: it.form, tier: it.tier, level: it.level || 0, rank: rank(it),
      needs: worn ? Math.max(N.GRADE_START, needs(it)) : null, short: worn ? short(it, g) : 0, stats: null, bonuses: [], instrument: null, parts: [], line: '' };
    if (worn && it.kind === 'weapon') {
      const s = stats(Object.assign({}, it, { prims: [] }), null, g, []);
      out.stats = { dmin: s.dmin, dmax: s.dmax, acc: s.acc, cost: N['FORM_' + it.form.toUpperCase()][3] };
    } else if (worn) {
      out.stats = { pad: garmentPad(it, g), eva: N['GARMENT_' + it.form.toUpperCase()][1] };
    }
    for (const p of it.prims || []) {
      const r = own(Registry.ITEM_PRIMS, p.id) ? Registry.ITEM_PRIMS[p.id] : null;
      out.bonuses.push({ id: p.id, cls: p.cls, n: r && r.row && Array.isArray(N[r.row]) && CLS.includes(p.cls) ? bonus(it, p) : null });
    }
    if (it.kind === 'instrument' && isInstrument(it.form)) {
      const R = row(it.form);
      out.instrument = { id: it.form, charges: it.charges, max: it.max, recharge: R[1], range: R[2], back: it.rechargeAt === null ? null : Math.max(0, it.rechargeAt - state.turn) };
      if (it.form === 'pin_driver') { const h = shot(state, uid); out.instrument.dmin = h.dmin; out.instrument.dmax = h.dmax; out.instrument.acc = h.acc; }
    }
    out.parts = parts(it);
    out.line = out.parts.map(p => p.text).join(' ');
    return out;
  }

  return { SLOTS, item, start, needs, short, derive, stats, settle, ringDelta, slots, addToTote, shot, useInstrument, recharge, restore,
    useLegal, useAction, useCandidates, targets, nextUid, make, drawTier, standIn, view, describe };
})();
