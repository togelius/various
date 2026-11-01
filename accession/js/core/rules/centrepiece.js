// ACCESSION — what every Centrepiece shares (BUILD.md §5.5, §8.1, §8.7; plan A8, D3, R4): its
// placement, its pieces, its form ('fight' or 'treasure'), its phases, its specials in turn,
// and what a piece's fall does. Owned by ARCH-CP-CORE. Each Centrepiece's own rules are its
// archetype's file (rules/arch/completing_guardian.js, mp_ensemble.js, mp_tableau.js), which
// registers its hooks through Centrepiece.hooks, so the rules here run for every one of them.
//
// The record (a pack's `centrepiece` part, §5.2; its line, §5.3): {id, archetype, form, size,
// specials?, pieces?, phases?, signature?, modifiers?, modParams?, trigger?, group?}:
//   form       'fight' or 'treasure';
//   size       its footprint's side (a Centrepiece stands 2×2, §4.1; 1 for a test's);
//   specials   the specials its body has from the start (ax.specials, in order), when it has
//              no pieces;
//   pieces     an ensemble's bodies instead of one: [{id?, at: [dx, dy], specials?}], each one
//              tile, at (dx, dy) from its footprint's top-left tile (one of them on that tile,
//              where a fight's Signature piece drops), in order, its species id its own or the
//              Centrepiece's;
//   phases     one record a phase ({parts?, specials?}, §5.3): phase k's specials (k from 2, at
//              most one) are what it gains on entering it;
//   signature  its Signature piece: the id of an item of its pack (§8.5); a fight's drops when
//              it falls; a treasure's is its treasure, which its own rules place and judge.
//
// dept.cp (§4.1; read through Hall.cp) is absent until the Centrepiece is placed. Placed, it
// holds {uids, room, openings, form, sealed, touched, sheet, treasure} (rules/hall.js), and
// from here: at (its footprint's top-left tile, where a fight's Signature piece drops),
// signature (its Signature piece's item id, absent with none) and gains (the special each
// phase gives, [null | id] by phase, absent when no phase gives one). Each piece is an actor
// of role `centrepiece` whose ax holds specials (in the order gained, Specials) and phase.
'use strict';
const Centrepiece = (() => {
  const own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const isInt = Number.isInteger;
  const FORMS = ['fight', 'treasure'];
  // A Centrepiece's phases: the first, then one past each threshold of CP_PHASE_PCT.
  const LAST = () => 1 + N.CP_PHASE_PCT.length;

  // ---- The rules each Centrepiece's archetype is added with ----

  // Centrepiece.hooks(archetype, own) → hooks for Archetypes.add(archetype, …): its own hooks
  // (any of Archetypes.HOOKS), with the core's around them, so every Centrepiece keeps the
  // shared rules: act, its specials in turn (Centrepiece.act) before its own act; onDamaged
  // and onDied, its own and then the core's (onPieceDamaged, onPieceDied). own.onPhase(state,
  // phase, ev), not an archetype hook, runs once its Centrepiece has entered a phase (advance).
  // Once per archetype; a Centrepiece is placed only once its archetype has them (place).
  const WIRED = {}, ON_PHASE = {};
  function hooks(archetype, mine) {
    mine = mine || {};
    if (typeof archetype !== 'string' || !archetype) throw new Error('Centrepiece.hooks: name the archetype');
    if (own(WIRED, archetype)) throw new Error(`Centrepiece.hooks: ${archetype} is given its hooks twice`);
    if (mine.onPhase !== undefined && typeof mine.onPhase !== 'function') throw new Error(`Centrepiece.hooks: ${archetype}.onPhase is not a function`);
    const out = {};
    for (const k of Object.keys(mine)) if (k !== 'onPhase') out[k] = mine[k];
    out.act = (state, a, ev) => {
      const r = act(state, a, ev);
      return r !== null ? r : mine.act ? mine.act(state, a, ev) : null;
    };
    out.onDamaged = (state, a, amount, cause, ev) => {
      if (mine.onDamaged) mine.onDamaged(state, a, amount, cause, ev);
      onPieceDamaged(state, a, amount, cause, ev);
    };
    out.onDied = (state, a, cause, ev) => {
      if (mine.onDied) mine.onDied(state, a, cause, ev);
      onPieceDied(state, a, ev);
    };
    WIRED[archetype] = true;
    if (mine.onPhase) ON_PHASE[archetype] = mine.onPhase;
    return out;
  }
  // Centrepiece.wired(archetype) → bool: was it given the core's hooks (Centrepiece.hooks)?
  const wired = archetype => own(WIRED, archetype);

  // ---- The record and its placement ----

  // Its record, checked: an error says what is wrong, as a gallery list's would (§5.2).
  function check(rec, pack) {
    const where = `${pack && pack.acc ? pack.acc : 'a pack'}'s Centrepiece ${rec && rec.id ? rec.id : ''}`.trim();
    if (!rec || typeof rec.id !== 'string' || !rec.id) throw new Error(`Centrepiece: ${where} has no id`);
    if (!FORMS.includes(rec.form)) throw new Error(`Centrepiece: ${where}'s form is ${FORMS.join(' or ')}, not ${JSON.stringify(rec.form)}`);
    if (!own(Registry.ARCHETYPES, rec.archetype)) throw new Error(`Centrepiece: ${where}'s archetype ${JSON.stringify(rec.archetype)} is not in the registry`);
    if (rec.role !== undefined && rec.role !== 'centrepiece') throw new Error(`Centrepiece: ${where}'s role is centrepiece (its numbers, §8.10), not ${JSON.stringify(rec.role)}`);
    const size = rec.size === undefined ? 1 : rec.size;
    if (size !== 1 && size !== 2) throw new Error(`Centrepiece: ${where} is ${JSON.stringify(rec.size)} tiles across, not 1 or 2`);
    const specialsOk = (list, what) => {
      if (list === undefined) return;
      if (!Array.isArray(list)) throw new Error(`Centrepiece: ${where}: ${what} are not a list`);
      for (const id of list) if (!own(Registry.SPECIALS, id)) throw new Error(`Centrepiece: ${where}: ${what} name ${JSON.stringify(id)}, which is no special`);
    };
    specialsOk(rec.specials, 'its specials');
    if (rec.pieces !== undefined) {
      if (!Array.isArray(rec.pieces) || !rec.pieces.length) throw new Error(`Centrepiece: ${where}'s pieces are not a list of one or more`);
      if (rec.specials !== undefined) throw new Error(`Centrepiece: ${where} has pieces, so each piece names its own specials`);
      const seen = [];
      rec.pieces.forEach((p, i) => {
        const at = p && p.at;
        if (!Array.isArray(at) || at.length !== 2 || !at.every(v => isInt(v) && v >= 0 && v < size)) throw new Error(`Centrepiece: ${where}'s piece ${i + 1} stands at ${JSON.stringify(at)}, not a tile of its ${size}×${size} footprint`);
        if (seen.includes(at[0] + ',' + at[1])) throw new Error(`Centrepiece: ${where}'s piece ${i + 1} stands on another's tile`);
        seen.push(at[0] + ',' + at[1]);
        if (p.id !== undefined && (typeof p.id !== 'string' || !p.id)) throw new Error(`Centrepiece: ${where}'s piece ${i + 1} has the id ${JSON.stringify(p.id)}`);
        specialsOk(p.specials, `piece ${i + 1}'s specials`);
      });
      // Its Signature piece drops on the footprint's top-left tile, where it first stood
      // (§8.7): a piece starts there, so that tile is one it stood on.
      if (!seen.includes('0,0')) throw new Error(`Centrepiece: ${where}'s pieces leave its footprint's top-left tile empty, where its Signature piece drops`);
    }
    if (rec.phases !== undefined) {
      if (!Array.isArray(rec.phases) || rec.phases.length > LAST()) throw new Error(`Centrepiece: ${where} has ${JSON.stringify(rec.phases)} for its phases, not a list of at most ${LAST()}`);
      rec.phases.forEach((ph, i) => {
        if (!ph || typeof ph !== 'object' || ph.specials === undefined) return;
        if (i === 0) throw new Error(`Centrepiece: ${where}'s first phase gains nothing: what it has from the start are its specials`);
        specialsOk(ph.specials, `phase ${i + 1}'s specials`);
        if (ph.specials.length > 1) throw new Error(`Centrepiece: ${where}'s phase ${i + 1} gains ${ph.specials.length} specials, and a phase gains at most one`);
      });
    }
    if (rec.signature !== undefined && !signatureItem(rec.signature)) throw new Error(`Centrepiece: ${where}'s Signature piece ${JSON.stringify(rec.signature)} is no weapon, garment, curio or instrument of a pack`);
  }
  // A pack item that can be a Signature piece, by its id (item ids name their department, so
  // they are one across the packs), or null.
  const SIGNATURE_KINDS = ['weapon', 'garment', 'curio', 'instrument'];
  function signatureItem(id) {
    if (typeof id !== 'string') return null;
    for (const p of Packs.list()) for (const it of p.items || []) if (it.id === id && SIGNATURE_KINDS.includes(it.kind)) return it;
    return null;
  }

  // The ways into a room: each tile outside it, from which one steps into it orthogonally,
  // that one can walk on (an archway, a door, a staff door, floor), in row-major order, as
  // {x, y, ch}. A diagonal step past a corner needs both tiles beside it, so these are all.
  function openingsOf(m, room) {
    const out = [], inRoom = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && m.roomOf[y][x] === room.id;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (inRoom(x, y) || !Grid.walkable(m, x, y)) continue;
      if (inRoom(x, y - 1) || inRoom(x + 1, y) || inRoom(x, y + 1) || inRoom(x - 1, y)) out.push({ x, y, ch: Grid.ch(m, x, y) });
    }
    return out;
  }

  // Centrepiece.place(state, plan, pack): the pack's Centrepiece (its record, checked) stands
  // on the plan's footprint, whose top-left tile is plan.cpl, in the room that holds it, its
  // hall (Dept.create calls this once a gallery list may place it, A10 step 6). Its body, of
  // its size, at that tile, or each of its pieces at its own tile; each an exhibit of the role
  // `centrepiece` with that role's numbers at the depth (Roles.stats), the archetype, modifiers,
  // trigger and group of its record, asleep, its health a share of the role's (the total over
  // its pieces, §8.10: each a whole share, the first the rest too), its ax {specials, phase 1};
  // uids <acc>.<depth>.<roleKey>.<n> counting on from the hall's exhibits (§3.2). dept.cp then
  // records it (above); then, as for every exhibit, `without` and each archetype's init
  // (Setup.settleActors). It draws nothing. With no record, nothing happens.
  function place(state, plan, pack) {
    const rec = pack && pack.centrepiece, m = state.dept;
    if (!rec) return;
    check(rec, pack);
    if (!wired(rec.archetype)) throw new Error(`Centrepiece.place: ${rec.id}'s archetype ${rec.archetype} was not added with Centrepiece.hooks, so the shared rules would not run for it`);
    if (Hall.cp(state)) throw new Error('Centrepiece.place: this department already has its Centrepiece');
    const at = plan && plan.cpl;
    if (!Array.isArray(at) || !isInt(at[0]) || !isInt(at[1]) || !Grid.inside(m, at[0], at[1])) throw new Error(`Centrepiece.place: the plan's footprint ${JSON.stringify(at)} is not a tile of the map`);
    const rid = Array.isArray(m.roomOf) && m.roomOf[at[1]] ? m.roomOf[at[1]][at[0]] : 0, hall = (m.rooms || []).find(r => r.id === rid);
    if (!hall) throw new Error(`Centrepiece.place: its footprint ${at.join(',')} is in no room`);
    const size = rec.size === undefined ? 1 : rec.size;
    const bodies = rec.pieces ? rec.pieces.map(p => ({ sp: p.id || rec.id, x: at[0] + p.at[0], y: at[1] + p.at[1], size: 1, specials: (p.specials || []).slice() }))
      : [{ sp: rec.id, x: at[0], y: at[1], size, specials: (rec.specials || []).slice() }];
    for (const b of bodies) for (let dy = 0; dy < b.size; dy++) for (let dx = 0; dx < b.size; dx++) {
      const x = b.x + dx, y = b.y + dy;
      if (!Grid.inside(m, x, y) || m.roomOf[y][x] !== hall.id || !Grid.walkable(m, x, y) || Grid.closedDoor(m, x, y)) throw new Error(`Centrepiece.place: ${rec.id}'s footprint tile ${x},${y} is not floor of its hall`);
      if (Actors.at(state, x, y)) throw new Error(`Centrepiece.place: ${Actors.at(state, x, y).uid} stands on ${rec.id}'s footprint tile ${x},${y}`);
    }
    const stats = Roles.stats('centrepiece', m.depth), share = Int.idiv(stats.hp, bodies.length), first = stats.hp - share * (bodies.length - 1);
    const prefix = `${m.acc}.${m.depth}.${hall.key}.`, T = rec.trigger ? Registry.TRIGGERS[rec.trigger] : null;
    let n = 0;
    for (const a of state.actors) if (a.uid.startsWith(prefix) && /^\d+$/.test(a.uid.slice(prefix.length))) n = Math.max(n, Number(a.uid.slice(prefix.length)));
    const from = state.actors.length, uids = [];
    bodies.forEach((b, i) => {
      const hp = i === 0 ? first : share;
      const a = Actors.spawn(state, Object.assign({}, stats, {
        uid: prefix + (n + i + 1), sp: b.sp, size: b.size, x: b.x, y: b.y, hp, maxHp: hp, mode: T && T.replacesWake ? 'awake' : 'dormant',
        arch: rec.archetype, role: 'centrepiece', mods: rec.modifiers || [], modParams: rec.modParams || {}, trigger: rec.trigger || null, group: rec.group || null,
        ax: { specials: b.specials, phase: 1 },
      }));
      uids.push(a.uid);
    });
    const cp = { uids, room: hall.key, openings: openingsOf(m, hall), form: rec.form, sealed: null, touched: false, sheet: null, treasure: null, at: [at[0], at[1]] };
    if (rec.signature !== undefined) cp.signature = rec.signature;
    const gains = [];
    for (let k = 1; k <= LAST(); k++) { const ph = rec.phases && rec.phases[k - 1]; gains.push(ph && Array.isArray(ph.specials) && ph.specials.length ? ph.specials[0] : null); }
    if (gains.some(g => g !== null)) cp.gains = gains;
    m.cp = cp;
    Setup.settleActors(state, from);
  }

  // ---- What it is now ----

  // Its pieces, in the order dept.cp lists them, fallen ones included; [] with none placed.
  function pieces(state) {
    const cp = Hall.cp(state);
    if (!cp || !cp.uids) return [];
    const out = [];
    for (const uid of cp.uids) { const a = Actors.byUid(state, uid); if (a) out.push(a); }
    return out;
  }
  const standing = state => pieces(state).filter(a => !a.gone);

  // 'fight' or 'treasure', or null with no Centrepiece.
  function form(state) {
    const cp = Hall.cp(state);
    return cp && FORMS.includes(cp.form) ? cp.form : null;
  }

  // Centrepiece.phase(state) → its phase (1 to 1 + CP_PHASE_PCT's length; its pieces share it,
  // ax.phase, absent read as 1), or null with no Centrepiece.
  function phase(state) {
    const list = pieces(state);
    if (!list.length) return null;
    let k = 1;
    for (const a of list) if (a.ax && isInt(a.ax.phase) && a.ax.phase > k) k = a.ax.phase;
    return k;
  }
  // Centrepiece.health(state) → {hp, max}: its health, over all its pieces (a fallen one has
  // none), and its full health, the sum of their maximums; null with no Centrepiece.
  function health(state) {
    const list = pieces(state);
    if (!list.length) return null;
    let hp = 0, max = 0;
    for (const a of list) { max += a.maxHp; if (!a.gone) hp += a.hp; }
    return { hp, max };
  }
  // Centrepiece.phaseFor(hp, max) → the phase that health gives: 1, and one more for each
  // threshold of CP_PHASE_PCT (% of its full health) it has fallen to or below.
  function phaseFor(hp, max) {
    let k = 1;
    for (const p of N.CP_PHASE_PCT) if (hp <= Int.pct(max, p)) k++;
    return k;
  }

  // Centrepiece.advance(state, to, cause, ev) → bool: it enters each phase after its own up to
  // `to` (never past its last), in turn; a phase never goes back, so an earlier one changes
  // nothing. On entering phase k: each of its pieces is in phase k (ax.phase, which its
  // specials' cadence reads, Specials.cadence); the first piece still standing gains the
  // special phase k gives, if any (dept.cp.gains, at the end of its ax.specials, unless it
  // has it); the phase event {who: that piece, phase, gained?}, with the cause given (the
  // core's own is damaged {by?}; a Centrepiece's rules may give theirs, as the Composite's
  // limbs do); then its archetype's onPhase (Centrepiece.hooks). Nothing happens with none of
  // its pieces standing, or once the visit is over.
  function advance(state, to, cause, ev) {
    const cp = Hall.cp(state);
    if (!cp || state.over || !isInt(to)) return false;
    let now = phase(state), moved = false;
    const last = Math.min(to, LAST());
    while (now < last) {
      const up = standing(state);
      if (!up.length || state.over) break;
      now++;
      for (const a of pieces(state)) a.ax.phase = now;
      const who = up[0], gained = Array.isArray(cp.gains) && typeof cp.gains[now - 1] === 'string' ? cp.gains[now - 1] : null;
      const fields = { who: who.uid, phase: now };
      if (gained !== null) {
        fields.gained = gained;
        if (!Array.isArray(who.ax.specials)) who.ax.specials = [];
        if (!who.ax.specials.includes(gained)) who.ax.specials.push(gained);
      }
      Causes.emit(state, ev, 'phase', fields, cause);
      if (own(ON_PHASE, who.arch)) ON_PHASE[who.arch](state, now, ev);
      moved = true;
    }
    return moved;
  }

  // ---- Its turn, its hurts and its fall ----

  // Centrepiece.act(state, a, ev) → ticks | null: a piece's turn as every Centrepiece takes it
  // (§8.1): the special its turns give it now, if it may mark it (Specials.markNext); null
  // otherwise, and it acts as it otherwise would.
  function act(state, a, ev) {
    return Specials.markNext(state, a, ev);
  }

  const isPiece = (state, a) => { const cp = Hall.cp(state); return !!cp && Array.isArray(cp.uids) && cp.uids.includes(a.uid); };
  const byOf = cause => cause && typeof cause.by === 'string' && cause.by ? { by: cause.by } : {};

  // Centrepiece.onPieceDamaged(state, a, amount, cause, ev): a piece was hurt and still stands:
  // it enters the phase its health now gives, if that is a later one (cause damaged {by?}, by
  // whoever hurt it).
  function onPieceDamaged(state, a, amount, cause, ev) {
    if (!isPiece(state, a) || state.over) return;
    const h = health(state);
    advance(state, phaseFor(h.hp, h.max), Object.assign({ k: 'damaged' }, byOf(cause)), ev);
  }

  // Centrepiece.onPieceDied(state, a, ev): after piece a fell (Combat.die, its archetype's
  // onDied first). While another piece stands, it enters the phase its health now gives (as
  // onPieceDamaged). When none stands it is defeated, once (no piece rises again), as its
  // form says (§8.7, R4):
  //   - a fight: its Signature piece drops on the floor at its footprint's top-left tile
  //     (dept.cp.at), whatever your tote holds (dropped {who: a, item, x, y}, cause defeated
  //     {by?}, by whoever struck the last blow); then the Certificate (Progress.award,
  //     'defeat', by its first piece, which names it); then the seal lifts (Hall.onDefeat);
  //   - a treasure: the seal lifts, and nothing else: killing its guardian earns nothing.
  // Nothing happens once the visit is over (a blow that ends you and it together).
  function onPieceDied(state, a, ev) {
    if (!isPiece(state, a) || state.over) return;
    let died = null;
    for (let i = ev.length - 1; i >= 0; i--) if (ev[i].k === 'died' && ev[i].who === a.uid) { died = ev[i]; break; }
    const cause = died ? died.cause : null;
    if (standing(state).length) {
      const h = health(state);
      advance(state, phaseFor(h.hp, h.max), Object.assign({ k: 'damaged' }, byOf(cause)), ev);
      return;
    }
    const cp = Hall.cp(state);
    if (cp.form === 'fight') {
      drop(state, a, cause, ev);
      Progress.award(state, 'defeat', { k: 'defeat', by: cp.uids[0] }, ev);
    }
    Hall.onDefeat(state, ev);
  }

  // A fight's Signature piece (onPieceDied asks this only of a fight), made on the floor (Kit.make: its uid that of an item placed in
  // the hall) at dept.cp.at, or, in a room made for a test with no such tile, at its first
  // piece's home. A weapon, garment or instrument comes at the lower tier on offer at the
  // depth (TIER_LOW_BY_DEPTH), so it draws nothing. With no Signature piece named, none.
  function drop(state, a, cause, ev) {
    const cp = Hall.cp(state), m = state.dept, rec = signatureItem(cp.signature);
    if (!rec) return;
    const first = Actors.byUid(state, cp.uids[0]), at = Array.isArray(cp.at) ? cp.at : first.home || [first.x, first.y];
    const T = N.TIER_LOW_BY_DEPTH, tier = T[Math.min(T.length, Math.max(1, m.depth || 1)) - 1];
    const tiered = rec.kind === 'weapon' || rec.kind === 'garment' || rec.kind === 'instrument';
    const it = Kit.make(state, tiered ? Object.assign({}, rec, { tier }) : rec, { at: 'floor', x: at[0], y: at[1] });
    Causes.emit(state, ev, 'dropped', { who: a.uid, item: it.uid, x: at[0], y: at[1] }, Object.assign({ k: 'defeated' }, byOf(cause)));
  }

  return { hooks, wired, check, place, pieces, form, phase, health, phaseFor, advance, act, onPieceDamaged, onPieceDied, openingsOf };
})();
