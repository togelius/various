// ACCESSION — consumables (BUILD.md §8.6): the eight kinds, their seals, the deck and
// identification; drinking, reading and throwing; the identifying labels; the Catalogue
// Card's choice, the Floor Plan, "Quiet, Please" and the Re-admission Ticket.
//
// The run keeps run.seals ({sol: [4 kind indices], eph: [4]}: the kind, by its index in DECK's
// order, under each wax seal and each ink stamp), run.knownSeals (the seals identified, in
// the order they were) and run.deck (the cards left of each kind, in DECK's order).
// A consumable is an item {kind: 'consumable', ck (its kind), seal, n (how many in the
// stack; one given with no count, as a room for tests may, is one), from (the department it
// was first taken in), …}. You use one from your tote:
// a Solution is drunk (use) or thrown (throw), an Ephemera is read (use). An identifying
// label is a plaque fixture {k: 'plaque', x, y, ck} on a wall, read with read(x, y).
//
// Every rule here says what it does in a clause of reg/consumables.js, and every event it
// emits has its sentence in text/consumables.js.
'use strict';
const Consumables = (() => {
  const R = Registry;
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // The kinds in DECK's order, and the seals in theirs: the 4 wax seals, then the 4 ink stamps.
  const KINDS = R.order('CONSUMABLES'), SEALS = R.order('SEALS');
  const kindOk = ck => own(R.CONSUMABLES, ck);
  const isSolution = ck => kindOk(ck) && R.CONSUMABLES[ck].cls === 'solution';
  // The side of the largest square any Solution covers when thrown (§8.6: a 5×5, Fumigant's
  // cloud). A first throw of an unknown Solution is refused if that square, centred on its
  // target, would include you: that is, if you are within GENTLE tiles of it (Chebyshev).
  const AREA = Math.max(...KINDS.filter(isSolution).map(ck => N[R.CONSUMABLES[ck].area]));
  const GENTLE = Int.idiv(AREA, 2);
  // The rooms the stand-in placement uses, by role: consumables lie in the sections and
  // studies, as the kit's items do (Kit.standIn); labels hang by those and by the Intro.
  const ITEM_ROOMS = ['section', 'study'], LABEL_ROOMS = ['intro', 'section', 'study'];

  // ---- Seals ----

  // The seal under which kind ck lies this run, or null before the seals are shuffled.
  function sealFor(state, ck) {
    const s = state.run && state.run.seals, i = KINDS.indexOf(ck);
    if (!s || i < 0) return null;
    const cls = R.CONSUMABLES[ck].cls, n = (cls === 'solution' ? s.sol : s.eph).indexOf(i);
    if (n < 0) return null;
    for (const id of SEALS) if (R.SEALS[id].cls === cls && R.SEALS[id].n === n) return id;
    return null;
  }
  // The kind under a seal this run, or null.
  function kindOf(state, seal) {
    const s = state.run && state.run.seals;
    if (!s || !own(R.SEALS, seal)) return null;
    const S = R.SEALS[seal], i = (S.cls === 'solution' ? s.sol : s.eph)[S.n];
    return Number.isInteger(i) && i >= 0 && i < KINDS.length ? KINDS[i] : null;
  }
  // A consumable item's seal: its own, or, for one given without (a room for tests), its
  // kind's this run.
  const sealOf = (state, it) => it.seal || sealFor(state, it.ck);
  const knownSeal = (state, seal) => !!seal && state.run.knownSeals.includes(seal);
  // Consumables.known(state, ck): is kind ck identified this run?
  const known = (state, ck) => knownSeal(state, sealFor(state, ck));
  // The seals not yet identified, in SEALS order.
  const unknownSeals = state => SEALS.filter(s => !state.run.knownSeals.includes(s));

  // The run's seals (§8.6): 4 wax seals shuffled over the Solutions and 4 ink stamps over the
  // Ephemera, on the run's `seals` stream (§3.2), once a run; a bijection in each family.
  // The deck starts full (Setup.run).
  function startRun(state) {
    const run = state.run;
    if (!Array.isArray(run.deck) || run.deck.length !== KINDS.length) run.deck = N.DECK.slice();
    if (run.seals) return;
    const rng = Rng.stream(state, 'seals'), sol = [], eph = [];
    KINDS.forEach((ck, i) => (isSolution(ck) ? sol : eph).push(i));
    run.seals = { sol: rng.shuffle(sol), eph: rng.shuffle(eph) };
  }
  // The seals are shuffled the first time they are needed, in a room for tests that has none.
  function ensureSeals(state) { if (!state.run.seals) startRun(state); }

  // Identify the kind under a seal (by use, a label or a Catalogue Card): it is recorded in
  // run.knownSeals and stays known for the run. Emits identified {seal, ck}. Returns
  // whether it was new.
  function identify(state, seal, cause, ev) {
    if (!own(R.SEALS, seal)) throw new Error(`Consumables.identify: no seal ${seal}`);
    ensureSeals(state);
    if (state.run.knownSeals.includes(seal)) return false;
    state.run.knownSeals.push(seal);
    Causes.emit(state, ev, 'identified', { seal, ck: kindOf(state, seal) }, cause);
    return true;
  }

  // ---- The deck ----

  // One card from the run's deck (§8.6), drawn without replacement on the `deck` stream,
  // weighted by the cards left of each kind; an empty deck is refilled to DECK first.
  function draw(state) {
    const run = state.run;
    if (!Array.isArray(run.deck) || run.deck.length !== KINDS.length) run.deck = N.DECK.slice();
    if (run.deck.every(n => n <= 0)) run.deck = N.DECK.slice();
    const i = Rng.stream(state, 'deck').weighted(run.deck);
    run.deck[i]--;
    return KINDS[i];
  }

  // ---- Items ----

  const items = state => state.items || [];
  const byUid = (state, uid) => { for (const i of items(state)) if (i.uid === uid) return i; return null; };
  const inTote = (state, it) => !!it && it.where.at === 'tote' && state.you.tote.includes(it.uid);
  // How many a stack holds: its count, or one for a consumable given with no count.
  const count = it => it.n === null || it.n === undefined ? 1 : it.n;
  // The consumable you carry with that uid, or null.
  const carried = (state, uid) => { const it = byUid(state, uid); return it && it.kind === 'consumable' && kindOk(it.ck) && inTote(state, it) && count(it) >= 1 ? it : null; };
  const tote = state => state.you.tote.map(uid => byUid(state, uid)).filter(it => it && it.kind === 'consumable' && kindOk(it.ck) && count(it) >= 1);

  // A new consumable of kind ck (one of it), with its uid (§3.2): <acc>.<depth>.<roleKey>.i<n>,
  // n counting on from the highest of that room's items (room 'room' outside any room). where
  // is {at: 'floor', x, y}; {at: 'case', x, y}, into the empty case there, which then holds
  // it (as Kit.make does); or {at: 'tote'}: then it is made at your feet and put in your tote
  // as a taken item is (Kit.addToTote, which stacks it with any of its kind), taken in this
  // department (from), and stays at your feet if the tote refuses it. Returns the item.
  function make(state, ck, where) {
    if (!kindOk(ck)) throw new Error(`Consumables.make: no kind ${ck}`);
    if (!where || !['floor', 'case', 'tote'].includes(where.at)) throw new Error('Consumables.make: where must be at floor, case or tote');
    const m = state.dept, you = state.actors[0], tote = where.at === 'tote';
    const x = tote ? you.x : where.x, y = tote ? you.y : where.y;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Grid.inside(m, x, y)) throw new Error(`Consumables.make: ${x},${y} is not a tile of the map`);
    const f = where.at === 'case' ? Cases.at(state, x, y) : null;
    if (where.at === 'case' && (!f || f.k !== 'case' || f.holds !== null)) throw new Error(`Consumables.make: there is no empty case at ${x},${y}`);
    ensureSeals(state);
    const prefix = `${m.acc}.${m.depth}.${Cases.roomKey(state, x, y) || 'room'}.i`;
    let high = 0;
    for (const i of items(state)) if (i.uid.startsWith(prefix) && /^\d+$/.test(i.uid.slice(prefix.length))) high = Math.max(high, Number(i.uid.slice(prefix.length)));
    const it = Kit.item({ uid: prefix + (high + 1), kind: 'consumable', where: tote ? { at: 'floor', x, y } : { at: where.at, x, y }, ck, seal: sealFor(state, ck), n: 1,
      from: tote ? m.acc : null });
    state.items.push(it);
    if (f) f.holds = it.uid;
    if (tote) Kit.addToTote(state, it);
    return it;
  }

  // Use one of a stack: the last one leaves your tote and is gone.
  function consume(state, it) {
    it.n = count(it) - 1;
    if (it.n <= 0) { it.n = 0; it.where = { at: 'gone' }; state.you.tote = state.you.tote.filter(u => u !== it.uid); }
  }

  // What a consumable is called (D5.3): its local name, from the pack of the department where
  // it was first taken (else this one), by its seal's position (a pack's consumables.names:
  // the 4 Solutions' seals, then the 4 Ephemera's); its seal; and its kind once identified.
  const UNNAMED = { solution: 'An Unlabelled Phial', ephemera: 'An Unlabelled Leaflet' };
  function name(state, it) {
    const seal = sealOf(state, it), cls = own(R.SEALS, seal) ? R.SEALS[seal].cls : (kindOk(it.ck) ? R.CONSUMABLES[it.ck].cls : 'solution');
    const pack = Packs.get(it.from || (state.dept && state.dept.acc));
    const names = pack && pack.consumables && Array.isArray(pack.consumables.names) ? pack.consumables.names : null;
    const pos = SEALS.indexOf(seal);
    const local = names && pos >= 0 && typeof names[pos] === 'string' && names[pos] ? names[pos] : UNNAMED[cls];
    return { local, seal: seal || null, kind: knownSeal(state, seal) ? it.ck : null };
  }

  // A consumable's Behaviour line (§5.3, §8.8): its kind's clause once identified, else the
  // rule for a first use.
  function line(state, it) {
    const e = knownSeal(state, sealOf(state, it)) && kindOk(it.ck) ? R.CONSUMABLES[it.ck] : R.CLAUSES.consumable_unknown;
    return Clauses.fill(e.clause, Clauses.params(e.params, null, { depth: state.dept.depth }));
  }

  // ---- Throwing ----

  const square = (x, y, size) => ({ x, y, size });
  // Why you may not throw uid at (x, y), as a refusal code, or null (§8.6, D5.1): a Solution
  // you carry; onto a tile you can see through, within THROW_RANGE (the disc) and in line of
  // sight; and, while its kind is unknown, not so near that the largest thrown square centred
  // there would include you (a sentence that names no kind).
  function throwRefusal(state, uid, x, y) {
    const it = carried(state, uid);
    if (!it) return 'consumable_not_carried';
    if (!isSolution(it.ck)) return 'throw_not_solution';
    const m = state.dept, you = state.actors[0];
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Grid.inside(m, x, y) || !Grid.disc(x - you.x, y - you.y, N.THROW_RANGE)) return 'throw_far';
    if (!Grid.seeThrough(m, x, y) || !Grid.los(m, you.x, you.y, x, y)) return 'throw_unseen';
    if (!knownSeal(state, sealOf(state, it)) && Grid.chebyshev(x, y, you.x, you.y) <= GENTLE) return 'throw_unknown_near';
    return null;
  }
  // The tiles you can throw uid at, in row-major order.
  function targets(state, uid) {
    const it = carried(state, uid);
    if (!it || !isSolution(it.ck)) return [];
    const you = state.actors[0], out = [];
    for (let y = you.y - N.THROW_RANGE; y <= you.y + N.THROW_RANGE; y++)
      for (let x = you.x - N.THROW_RANGE; x <= you.x + N.THROW_RANGE; x++) if (throwRefusal(state, uid, x, y) === null) out.push([x, y]);
    return out;
  }

  // The creatures a thrown Solution reaches: every actor, you included, with a tile in the
  // square, in spawn order; one inside an intact case is behind glass and is not reached.
  const reached = (state, sq) => state.actors.filter(a => !a.gone && Actors.footprint(a).some(([x, y]) => Grid.covers(sq, x, y)) && !Cases.encased(state, a));

  // Throw one of uid at (x, y) (§8.6): it is used, identified if it was not known, and does
  // what its kind does there; every thrown Solution but Solvent lands with a soft noise, after
  // its other effects (§8.2: an action's noise comes last). Check throwRefusal first.
  function throwAt(state, uid, x, y, ev) {
    ensureSeals(state);
    const it = carried(state, uid), ck = it.ck, seal = sealOf(state, it), was = knownSeal(state, seal), cause = { k: 'item', by: 'you', item: uid };
    if (!it.seal) it.seal = seal;
    consume(state, it);
    Causes.emit(state, ev, 'used', { who: 'you', item: uid, how: 'throw' }, { k: 'consume', ck, seal, known: was, x, y });
    if (!was) identify(state, seal, { k: 'use', by: 'you' }, ev);
    const sq = square(x, y, N[R.CONSUMABLES[ck].area]);
    if (ck === 'consolidant') for (const a of reached(state, sq)) Health.heal(state, a, Int.pct(a.maxHp, N.CONSOLIDANT_THROW_PCT), cause, ev);
    else if (ck === 'fixative') for (const a of reached(state, sq)) Status.apply(state, a, 'fixed', N.FIXATIVE_TURNS, cause, ev);
    else if (ck === 'fumigant') Surfaces.add(state, 'fumigant', x, y, N.FUMIGANT_SIZE, N.FUMIGANT_TURNS, 'you', ev, cause);
    else if (ck === 'solvent') {
      // Silent (§8.3): no noise, no shards, no touch_case. Cases.dissolve emits glass_broke.
      for (const f of state.dept.fixtures.slice()) if (f.k === 'case' && f.st === 'shut' && Grid.covers(sq, f.x, f.y)) Cases.dissolve(state, f, { k: 'solvent', by: 'you', item: uid }, ev);
    }
    if (ck !== 'solvent') Noise.emit(state, x, y, 'soft', { k: 'throw', by: 'you', item: uid }, ev);
    return N.COST_USE;
  }

  // ---- Drinking and reading ----

  // Drink one of uid (§8.6): used, identified if it was not known. A first drink of a harmful
  // kind does nothing (gentle; the used event's sentence says what it would have done).
  function drink(state, uid, ev) {
    ensureSeals(state);
    const it = carried(state, uid), ck = it.ck, seal = sealOf(state, it), was = knownSeal(state, seal), you = state.actors[0];
    const gentle = !was && !!R.CONSUMABLES[ck].harmfulDrink, cause = { k: 'item', by: 'you', item: uid };
    if (!it.seal) it.seal = seal;
    consume(state, it);
    Causes.emit(state, ev, 'used', { who: 'you', item: uid, how: 'drink' }, gentle ? { k: 'consume', ck, seal, known: was, gentle: true } : { k: 'consume', ck, seal, known: was });
    if (!was) identify(state, seal, { k: 'use', by: 'you' }, ev);
    if (gentle) return N.COST_USE;
    if (ck === 'consolidant') {
      Health.heal(state, you, Int.pct(you.maxHp, N.CONSOLIDANT_NOW_PCT), cause, ev);
      Status.apply(state, you, 'restoring', N.CONSOLIDANT_HOT_TURNS, cause, ev);
    } else if (ck === 'fixative') Status.apply(state, you, 'fixed', N.FIXATIVE_TURNS, cause, ev);
    else if (ck === 'fumigant') Status.apply(state, you, 'coughing', N.COUGH_TURNS, cause, ev);
    else if (ck === 'solvent') {
      // Every harmful status you have ends now, in the order they were put on.
      const keep = [];
      for (const s of you.statuses) {
        if (!Status.harmful(s.id)) { keep.push(s); continue; }
        Causes.emit(state, ev, 'status', Number.isInteger(s.until) ? { who: 'you', id: s.id, on: false, until: s.until } : { who: 'you', id: s.id, on: false }, cause);
      }
      you.statuses = keep;
    }
    return N.COST_USE;
  }

  // Where a Re-admission Ticket puts you: the department's entrance, or, if someone stands
  // there, the free tile nearest to it by walking distance (then row-major). A free tile is
  // one you can walk onto that is not a door or an exit and has no one on it. null if there
  // is no entrance or no such tile.
  function arrival(state) {
    const m = state.dept, e = m.entrance, you = state.actors[0];
    if (!e) return null;
    const free = (x, y) => { const t = Grid.TILES[Grid.ch(m, x, y)]; return Grid.walkable(m, x, y, 'you') && !t.door && Grid.ch(m, x, y) !== 'X' && !Actors.at(state, x, y, you); };
    if (free(e[0], e[1])) return [e[0], e[1]];
    const d = Grid.distances(m, [e], m.w * m.h, null, 'you');
    let best = null, bd = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const v = d[y * m.w + x];
      if (v > 0 && free(x, y) && (best === null || v < bd)) { best = [x, y]; bd = v; }
    }
    return best;
  }

  // The rooms of the Highlights not yet taken (§8.6, R21), once a Floor Plan has been read
  // here; null before. A Highlight (dept.highlights {uid, room}, W1-KIT's Restoration kits)
  // is taken once it is in your tote or kit, or used up.
  function planRooms(state) {
    const m = state.dept;
    if (m.planRead === null || m.planRead === undefined) return null;
    const out = [];
    for (const h of m.highlights || []) {
      const it = byUid(state, h.uid);
      if (it && (it.where.at === 'floor' || it.where.at === 'case') && !out.includes(h.room)) out.push(h.room);
    }
    return out;
  }

  // Read one of uid, an Ephemera (§8.6): used, identified if it was not known, then:
  //   Catalogue Card: you choose one unknown seal to identify (ui.pendingChoice {k: 'seal',
  //     options}); with only one unknown it is identified at once; with none, nothing more;
  //   Floor Plan: every tile of the department counts as explored, and dept.planRead is now;
  //   "Quiet, Please": Wake.quiet from your tile out to QUIET_RANGE walking tiles;
  //   Re-admission Ticket: you are put at the entrance (arrival), even while rooted, then
  //     every hunter but the Night Watchman loses you (Wake.lose), which calls off its
  //     pending special; an unknown one with nowhere to put you is identified and does
  //     nothing more (used's cause says nowhere), so its refusal never gives it away.
  function readItem(state, uid, ev) {
    ensureSeals(state);
    const it = carried(state, uid), ck = it.ck, seal = sealOf(state, it), was = knownSeal(state, seal), you = state.actors[0], m = state.dept;
    if (!it.seal) it.seal = seal;
    const to = ck === 'ticket' ? arrival(state) : null, c = { k: 'consume', ck, seal, known: was };
    if (to) { c.x = to[0]; c.y = to[1]; } else if (ck === 'ticket') c.nowhere = true;
    consume(state, it);
    Causes.emit(state, ev, 'used', { who: 'you', item: uid, how: 'read' }, c);
    if (!was) identify(state, seal, { k: 'use', by: 'you' }, ev);
    if (ck === 'card') {
      const options = unknownSeals(state);
      if (options.length === 1) identify(state, options[0], { k: 'card', by: 'you' }, ev);
      else if (options.length > 1) state.ui.pendingChoice = { k: 'seal', options };
    } else if (ck === 'plan') {
      m.seen = '1'.repeat(m.w * m.h);
      m.planRead = state.turn;
    } else if (ck === 'quiet') Wake.quiet(state, you.x, you.y, N.QUIET_RANGE, { k: 'quiet', by: 'you' }, ev);
    else if (ck === 'ticket' && to) {
      // A teleport, not a step: being rooted does not stop it.
      you.x = to[0]; you.y = to[1];
      Wake.lose(state, { k: 'ticket', by: 'you' }, ev);
    }
    return N.COST_USE;
  }

  // ---- use(uid) ----

  // Why use(uid) of a consumable is refused, as a code, or null: one you carry, used bare
  // (a consumable is drunk or read, never aimed); a Catalogue Card needs something to
  // identify (itself, or another seal); a known Ticket needs an entrance to return to. Only
  // a known kind is refused for what it would do, so no refusal identifies an unknown one.
  function useRefusal(state, action) {
    const it = carried(state, action.uid);
    if (!it) return 'consumable_not_carried';
    if (action.x !== undefined || action.y !== undefined || action.on !== undefined) return 'use_no_target';
    if (it.ck === 'card' && knownSeal(state, sealOf(state, it)) && !unknownSeals(state).length) return 'card_all_known';
    if (it.ck === 'ticket' && knownSeal(state, sealOf(state, it)) && !arrival(state)) return 'ticket_no_entrance';
    return null;
  }
  const useLegal = state => tote(state).map(it => ({ a: 'use', uid: it.uid })).filter(a => useRefusal(state, a) === null);
  function useAction(state, action, ev) {
    const code = useRefusal(state, action);
    if (code) return code;
    return isSolution(carried(state, action.uid).ck) ? drink(state, action.uid, ev) : readItem(state, action.uid, ev);
  }
  // The use candidates of your consumables, a superset of useLegal (§4.2; the use dispatcher
  // in step.js offers exactly these, with the kit's): a bare use of every consumable, carried
  // or not, and an aimed one of each you carry, which is refused.
  function useCandidates(state) {
    const out = [], you = state.actors[0];
    for (const i of items(state)) if (i.kind === 'consumable') {
      out.push({ a: 'use', uid: i.uid });
      if (inTote(state, i)) out.push({ a: 'use', uid: i.uid, x: you.x, y: you.y });
    }
    return out;
  }

  // ---- Labels ----

  const plaques = state => ((state.dept && state.dept.fixtures) || []).filter(f => f.k === 'plaque');
  // Why read(x, y) is refused, or null (§8.6, §8.8): a plaque there, within READ_RANGE (the
  // disc) and in line of sight, whose kind you do not yet know.
  function readRefusal(state, x, y) {
    const f = Number.isInteger(x) && Number.isInteger(y) ? Cases.at(state, x, y) : null;
    if (!f || f.k !== 'plaque' || !kindOk(f.ck)) return 'label_none';
    const m = state.dept, you = state.actors[0];
    if (!Grid.disc(x - you.x, y - you.y, N.READ_RANGE) || !Grid.los(m, you.x, you.y, x, y)) return 'label_far';
    if (known(state, f.ck)) return 'label_known';
    return null;
  }

  // ---- What the view model shows ----

  // vis: what is shown, one entry a tile (nonzero shown); Vision.visible(state) if not given,
  // since the view model keeps to what you can see (as Kit.view does).
  //   known: the seals identified, with their kinds; plaques: the labels on shown tiles;
  //   items: the consumables lying on the floor or in a case on shown tiles, as the view
  //     model's items are ({uid, x, y, icon, kind, inCase}), with the seal and its shape that
  //     tell them apart (D5.11), their family, and their kind once known (ck, else null);
  //   tote: your consumables, named; plan: planRooms; pending: the seal choice waiting, if any.
  const shapeOf = seal => own(R.SEALS, seal) ? R.SEALS[seal].shape : null;
  function view(state, vis) {
    const m = state.dept, v = vis || Vision.visible(state), shown = (x, y) => Grid.inside(m, x, y) && !!v[y * m.w + x];
    const pc = state.ui && state.ui.pendingChoice;
    const lying = items(state).filter(i => i.kind === 'consumable' && kindOk(i.ck) && (i.where.at === 'floor' || i.where.at === 'case') && shown(i.where.x, i.where.y));
    return {
      known: state.run.knownSeals.map(seal => ({ seal, ck: kindOf(state, seal) })),
      plaques: plaques(state).filter(f => shown(f.x, f.y)).map(f => ({ x: f.x, y: f.y, seal: sealFor(state, f.ck), ck: known(state, f.ck) ? f.ck : null, readable: readRefusal(state, f.x, f.y) === null })),
      items: lying.map(i => { const seal = sealOf(state, i); return { uid: i.uid, x: i.where.x, y: i.where.y, icon: 'seal', kind: 'consumable', inCase: i.where.at === 'case',
        seal: seal || null, shape: shapeOf(seal), cls: R.CONSUMABLES[i.ck].cls, ck: knownSeal(state, seal) ? i.ck : null }; }),
      tote: tote(state).map(it => Object.assign({ uid: it.uid, n: count(it), cls: R.CONSUMABLES[it.ck].cls, shape: shapeOf(sealOf(state, it)) }, name(state, it))),
      plan: planRooms(state),
      pending: pc && pc.k === 'seal' ? { k: 'seal', options: pc.options.slice() } : null,
    };
  }

  // ---- The stand-in placement (§3.2, §5.5) ----

  // The department's consumables and its identifying labels, until M4's population:
  //   CONSUMABLES_PER_DEPT consumables, each a card from the deck (draw), in a section or
  //   study drawn on `${base}/items` (then the next one in order if it has no free tile), on
  //   a free floor tile drawn on that room's populate stream in pop (after the cases' and the
  //   kit's draws, §3.2). A tile is free with no actor (gone or not: a removed exhibit keeps
  //   its tile, R19), item or fixture on it, not the entrance, and you can walk to it from the
  //   entrance without passing a staff door;
  //   then ID_LABELS_PER_DEPT plaques, each for a kind you do not know, drawn on
  //   `${base}/items`, in the Intro, a section or a study (the first in the Intro or the first
  //   section): on a wall tile with no fixture yet, beside a tile of its room that you can walk
  //   to as above, so it can always be read; drawn on the room's populate stream. The plaques
  //   follow the fixtures already made (the cases and staff doors in row-major order, then
  //   any mimic's disguise), in the order placed (§4.1).
  // Walking is measured on the map as it was laid out, by the exhibits' step rule (staff
  // doors are walls), with a mimic's disguise counted as the floor it stands on, so removing a
  // mimic moves nothing (§3.2), as Kit.standIn measures it.
  function standIn(state, base, pop) {
    const m = state.dept;
    if (!m.rooms || !m.roomOf || !m.entrance) return;
    const itemRooms = m.rooms.filter(r => ITEM_ROOMS.includes(r.role)), labelRooms = m.rooms.filter(r => LABEL_ROOMS.includes(r.role));
    if (!itemRooms.length && !labelRooms.length) return;
    const where = Rng.stream(pop, `${base}/items`), populate = rm => Rng.stream(pop, `${base}/room/${rm.key}/populate`);
    const tiles = m.tiles.slice();
    for (const f of m.fixtures) if (f.k === 'case' && f.mimic !== null && f.mimic !== undefined) tiles[f.y] = tiles[f.y].slice(0, f.x) + '.' + tiles[f.y].slice(f.x + 1);
    const walk = Grid.distances({ w: m.w, h: m.h, tiles, surfaces: [] }, [m.entrance], m.w * m.h, null, 'exhibit');
    const walked = (x, y) => Grid.inside(m, x, y) && walk[y * m.w + x] >= 0;
    const inRoom = (rm, x, y) => Grid.inside(m, x, y) && m.roomOf[y] && m.roomOf[y][x] === rm.id;
    const itemAt = (x, y) => items(state).some(i => (i.where.at === 'floor' || i.where.at === 'case') && i.where.x === x && i.where.y === y);
    const entrance = (x, y) => m.entrance[0] === x && m.entrance[1] === y;
    const floor = rm => {
      const out = [];
      for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++)
        if (inRoom(rm, x, y) && Grid.ch(m, x, y) === '.' && walked(x, y) && !state.actors.some(a => Actors.covers(a, x, y)) && !itemAt(x, y) && !Cases.at(state, x, y) && !entrance(x, y)) out.push([x, y]);
      return out;
    };
    const ORTHO = [0, 2, 4, 6];
    const walls = rm => {
      const seen = new Set(), out = [];
      for (let y = rm.y0 - 1; y <= rm.y1 + 1; y++) for (let x = rm.x0 - 1; x <= rm.x1 + 1; x++) {
        if (!Grid.inside(m, x, y) || Grid.ch(m, x, y) !== '#' || Cases.at(state, x, y) || seen.has(y * m.w + x)) continue;
        if (ORTHO.some(d => { const nx = x + Grid.DX[d], ny = y + Grid.DY[d]; return inRoom(rm, nx, ny) && walked(nx, ny); })) { seen.add(y * m.w + x); out.push([x, y]); }
      }
      return out;
    };
    // A room drawn from a list, then the next in order that has a candidate tile; the tile is
    // drawn on that room's populate stream.
    function placeIn(list, candidates) {
      const start = where.int(0, list.length - 1);
      for (let j = 0; j < list.length; j++) {
        const rm = list[(start + j) % list.length], c = candidates(rm);
        if (c.length) return populate(rm).pick(c);
      }
      return null;
    }
    for (let k = 0; k < N.CONSUMABLES_PER_DEPT && itemRooms.length; k++) {
      const ck = draw(state), at = placeIn(itemRooms, floor);
      if (at) make(state, ck, { at: 'floor', x: at[0], y: at[1] });
    }
    const unknown = KINDS.filter(ck => !known(state, ck)), first = labelRooms.filter(r => r.role === 'intro' || r.key === 's1');
    for (let k = 0; k < N.ID_LABELS_PER_DEPT && unknown.length && labelRooms.length; k++) {
      const ck = unknown.splice(where.int(0, unknown.length - 1), 1)[0];
      const at = placeIn(k === 0 && first.length ? first : labelRooms, walls);
      if (at) m.fixtures.push({ k: 'plaque', x: at[0], y: at[1], ck });
    }
  }

  // ---- The actions: throw(uid, x, y), read(x, y), choose(index) (§4.2) ----

  // throw: candidates are every tile within THROW_RANGE + 1 of you for each Solution you
  // carry (so the edge of the range and the near tiles a first throw refuses are among them),
  // one for every other consumable, and two that name nothing.
  Actions.define('throw', {
    legal(state) {
      const out = [];
      for (const it of tote(state)) if (isSolution(it.ck)) for (const [x, y] of targets(state, it.uid)) out.push({ a: 'throw', uid: it.uid, x, y });
      return out;
    },
    candidates(state) {
      const you = state.actors[0], r = N.THROW_RANGE + 1, out = [];
      for (const i of items(state)) {
        if (i.kind !== 'consumable') continue;
        if (inTote(state, i) && isSolution(i.ck)) { for (let y = you.y - r; y <= you.y + r; y++) for (let x = you.x - r; x <= you.x + r; x++) out.push({ a: 'throw', uid: i.uid, x, y }); }
        else out.push({ a: 'throw', uid: i.uid, x: you.x + GENTLE + 1, y: you.y });
      }
      return out.concat([{ a: 'throw', uid: 'nothing', x: you.x, y: you.y }, { a: 'throw' }]);
    },
    apply(state, action, ev) {
      const code = throwRefusal(state, action.uid, action.x, action.y);
      return code || throwAt(state, action.uid, action.x, action.y, ev);
    },
  });

  // read(x, y): a label you can read, at no cost in time (§3.1: what it teaches is in the
  // state and the replay). Candidates: your tile and its 8 neighbours, every plaque, and a
  // bare read.
  Actions.define('read', {
    legal: state => plaques(state).filter(f => readRefusal(state, f.x, f.y) === null).map(f => ({ a: 'read', x: f.x, y: f.y })),
    candidates(state) {
      const you = state.actors[0], out = [{ a: 'read', x: you.x, y: you.y }];
      for (let d = 0; d < 8; d++) out.push({ a: 'read', x: you.x + Grid.DX[d], y: you.y + Grid.DY[d] });
      for (const f of plaques(state)) out.push({ a: 'read', x: f.x, y: f.y });
      return out.concat([{ a: 'read' }]);
    },
    apply(state, action, ev) {
      const code = readRefusal(state, action.x, action.y);
      if (code) return code;
      ensureSeals(state);
      identify(state, sealFor(state, Cases.at(state, action.x, action.y).ck), { k: 'label', by: 'you' }, ev);
      return 0;
    },
  });

  // choose(index): the answer to the choice waiting (state.ui.pendingChoice {k, options}),
  // handed to the function defined for its kind (Actions.defineChoice). It costs what that
  // function says (a seal: nothing, the Card's reading was the cost); the choice is cleared
  // unless the function asked a new one.
  Actions.define('choose', {
    legal(state) {
      const p = state.ui && state.ui.pendingChoice;
      if (!p || !Actions.choice(p.k) || !Array.isArray(p.options)) return [];
      return p.options.map((o, index) => ({ a: 'choose', index }));
    },
    candidates(state) {
      const p = state.ui && state.ui.pendingChoice, n = p && Array.isArray(p.options) ? p.options.length : 1, out = [];
      for (let index = -1; index <= Math.max(n, 1); index++) out.push({ a: 'choose', index });
      return out.concat([{ a: 'choose' }]);
    },
    apply(state, action, ev) {
      const p = state.ui && state.ui.pendingChoice, fn = p ? Actions.choice(p.k) : null;
      if (!p || !fn || !Array.isArray(p.options)) return 'choice_none';
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= p.options.length) return 'choice_bad';
      const r = fn(state, action.index, ev);
      if (typeof r !== 'string' && state.ui.pendingChoice === p) state.ui.pendingChoice = null;
      return r;
    },
  });

  // The Catalogue Card's choice: the seal at index is identified (cause card).
  Actions.defineChoice('seal', (state, index, ev) => {
    const seal = state.ui.pendingChoice.options[index];
    if (!own(R.SEALS, seal)) return 'choice_bad';
    identify(state, seal, { k: 'card', by: 'you' }, ev);
    return 0;
  });

  return { AREA, GENTLE, startRun, draw, make, known, sealFor, kindOf, unknownSeals, identify, drink, readItem, throwAt, throwRefusal, targets,
    name, line, arrival, planRooms, useRefusal, useLegal, useAction, useCandidates, readRefusal, view, standIn };
})();
