// ACCESSION — the Centrepiece hall and its seal (BUILD.md §8.4, §4.1; M4 plan A8, A13, D3.1),
// owned by ARCH-HALL, frozen once it lands. Decided without play (Q6); revisit once M4 is
// playable.
//
// dept.cp, the Centrepiece and its hall, is absent from a state until the Centrepiece is
// placed (§4.1), and every rule reads it through Hall.cp:
//   { uids, room, openings: [{x, y, ch}], form, sealed: null | {turn, by, why, at, last, seen},
//     touched, sheet, treasure, waiting?, lifted? }
// room is the hall's room key in dept.rooms; openings are its ways in, staff doors included,
// each with the tile a shutter stands over (ch, the tile as it was when the shutters closed).
// The hall's own parts: sealed (turn: when the shutters closed; by and why: what called for
// them; at: the turn of the last boundary that judged the seal; last: the turn of the last
// boundary at which the Centrepiece was found to have hurt you or to stand beside you; seen:
// what your memory held at each opening, in the openings' order, as the shutters closed);
// waiting {turn, by}, present while a seal waits on an opening someone (by) stands in; lifted
// {turn, why}, present from the shutters opening until you stand outside the hall at a turn's
// end, while the hall does not seal again.
//
// The seal (A13, R5). At a turn boundary (step 6, before the clock, Hall.boundary), while
// the Centrepiece stands and its form's seal rule calls for the seal (a fight's: one of its
// pieces hunts you from inside the hall, so a piece hunting you from outside it never seals
// you in alone; a treasure's: its own rule, Hall.defineSeal), you stand inside the hall and
// no one stands in any of its openings, shutters (Z) close over every opening, staff doors
// included: the clock's count stops (dept.clock.pausedSince) and so does your regeneration
// (Clock.regenRate), while every other boundary step goes on. While someone stands in an
// opening the seal waits, says so once (stage waiting; its cause names, as by, what calls
// for the seal, as a sealing names it, and, as `in`, who stands in the opening only if you
// see it then, so the log never names an exhibit out of your sight), and is tried again at
// each boundary. The shutters open (stage unsealed):
//   - quiet: at the boundary that ends the SEAL_LIFT_TURNS-th turn in a row in which none of
//     the Centrepiece's pieces hurt you (Hall.onHurt, from Combat.hurt) or stood beside you
//     at the turn's end;
//   - ticket: when you read a Re-admission Ticket (Hall.onTicket, after the hunters lose you):
//     each piece standing regains SEAL_HEAL_PCT of its maximum health and goes back to its
//     place;
//   - defeat: when the Centrepiece is defeated (Hall.onDefeat, at once), or, failing that, at
//     the next boundary once none of its pieces stands (treasure for a treasure's guardian,
//     sheet when it went under its dust sheet);
//   - alone: at the next boundary once none of its pieces still standing is in the hall (an
//     ensemble's last piece inside fell while others stand outside), so the seal never keeps
//     you in alone.
// Once they have opened the hall does not seal again until you have stood outside it at a
// turn's end, so a quiet lift lets you walk out. Your memory of the map (dept.seen) takes the
// shutters as they close on every opening you remember, since the stage event tells you of
// them, and as they open gives each back what you last saw there before they closed (sealed.
// seen), never what an opening out of your sight has become since; an opening you have never
// seen stays unseen.
//
// Hall.addCheck(id, fn) lets a Centrepiece's own rules add a check that Hall.boundary runs
// after the seal's own step (the treasure's carry-out, rules/treasure.js), so none of them
// edits this file; fn(state, ev), in the order added. Hall.defineSeal(form, fn) gives a form's
// seal rule, fn(state, cp) → null | {by?, why}, which only reads; 'fight' is defined here.
'use strict';
const Hall = (() => {
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  const ids = [], checks = {}, SEALS = {};

  // Hall.addCheck(id, fn): once per id.
  function addCheck(id, fn) {
    if (typeof id !== 'string' || !id) throw new Error('Hall.addCheck: a check needs a string id');
    if (own(checks, id)) throw new Error(`Hall.addCheck: ${id} is added twice`);
    if (typeof fn !== 'function') throw new Error(`Hall.addCheck: ${id} needs a function`);
    checks[id] = fn;
    ids.push(id);
  }
  // The checks added, as [id, fn], in the order added.
  const added = () => ids.map(id => [id, checks[id]]);

  // Hall.defineSeal(form, fn): what calls for a hall's seal, for a Centrepiece of that form;
  // fn(state, cp) → null, or {by?, why} (by: the actor it is about; why: a word for the stage
  // event's cause). It only reads. Once per form.
  function defineSeal(form, fn) {
    if (typeof form !== 'string' || !form) throw new Error('Hall.defineSeal: a seal rule needs its form');
    if (own(SEALS, form)) throw new Error(`Hall.defineSeal: the ${form} form's seal is defined twice`);
    if (typeof fn !== 'function') throw new Error(`Hall.defineSeal: ${form} needs a function`);
    SEALS[form] = fn;
  }

  // The Centrepiece and its hall, or null where none is placed.
  const cp = state => (state && state.dept && state.dept.cp) || null;
  // The Centrepiece's pieces that still stand (not gone), in the order cp.uids names them.
  function standing(state, c) {
    const out = [];
    for (const u of c.uids || []) { const a = Actors.byUid(state, u); if (a && !a.gone) out.push(a); }
    return out;
  }
  // The hall's room in dept.rooms (cp.room is its key), or null.
  function hallRoom(state, c) {
    const rooms = (state.dept && state.dept.rooms) || [];
    for (const r of rooms) if (r.key === c.room || r.id === c.room) return r;
    return null;
  }

  // Hall.inside(state, x, y): is (x, y) a tile of the Centrepiece's hall (its room in
  // dept.roomOf; an opening, between two rooms, is in neither)? False where none is placed.
  function inside(state, x, y) {
    const c = cp(state);
    if (!c || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    const m = state.dept, r = hallRoom(state, c);
    if (!r || x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    if (Array.isArray(m.roomOf) && Array.isArray(m.roomOf[y])) return m.roomOf[y][x] === r.id;
    return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  }
  const youInside = state => { const you = state.actors[0]; return !!you && !you.gone && inside(state, you.x, you.y); };

  // Hall.openings(state): the hall's openings, staff doors included, as [{x, y, ch}] copies (ch:
  // the tile there, or under its shutter while the hall is sealed); [] where none is placed.
  function openings(state) {
    const c = cp(state);
    return c && Array.isArray(c.openings) ? c.openings.map(o => ({ x: o.x, y: o.y, ch: o.ch })) : [];
  }
  // The first actor standing in an opening, in the openings' order, or null.
  function occupant(state, c, except) {
    for (const o of c.openings || []) { const a = Actors.at(state, o.x, o.y, except); if (a) return a; }
    return null;
  }
  // Every actor standing in an opening, each once, in the openings' order.
  function occupants(state, c) {
    const out = [];
    for (const o of c.openings || []) { const a = Actors.at(state, o.x, o.y); if (a && !out.includes(a)) out.push(a); }
    return out;
  }

  // Is actor a in the hall: does any tile of it stand inside it?
  const inHall = (state, a) => Actors.footprint(a).some(([x, y]) => inside(state, x, y));
  // Do you see actor a now, as the board shows it (ViewModel): any tile of it in your sight,
  // and shown as itself (not a mimic in its disguise)?
  function inView(state, a) {
    if (!a || a.gone || Archetypes.present(state, a) !== null) return false;
    const m = state.dept, v = Vision.visible(state);
    return Actors.footprint(a).some(([x, y]) => Grid.inside(m, x, y) && v[y * m.w + x] === 1);
  }

  // A fight's seal: one of its pieces hunts you from inside the hall (the first, in cp.uids's
  // order). One hunting you from outside it calls for nothing: the seal shuts you in with it,
  // never alone.
  defineSeal('fight', (state, c) => {
    for (const a of standing(state, c)) if (a.mode === 'hunting' && inHall(state, a)) return { by: a.uid, why: 'hunt' };
    return null;
  });

  // Hall.calls(state) → null | {by?, why}: whether the hall calls for its seal now: it is not
  // sealed, it has not opened since you last stood outside it at a turn's end, the Centrepiece
  // stands, and its form's seal rule says so. Where you stand and who stands in an opening are
  // not asked here (Hall.boundary asks them).
  function calls(state) {
    const c = cp(state);
    if (!c || c.sealed || c.lifted || !own(SEALS, c.form) || !standing(state, c).length) return null;
    const r = SEALS[c.form](state, c);
    if (r === null || r === undefined) return null;
    if (typeof r !== 'object' || typeof r.why !== 'string' || !r.why || (r.by !== undefined && r.by !== null && typeof r.by !== 'string')) {
      throw new Error(`Hall: the ${c.form} form's seal rule gave ${JSON.stringify(r)}, not null or {by?, why}`);
    }
    return { by: r.by === null ? undefined : r.by, why: r.why };
  }

  // Your memory of an opening's tile (dept.seen) follows its shutter, where you remember it.
  function remember(m, o, ch) {
    if (!m.seen || m.seen.length !== m.w * m.h) return;
    const i = o.y * m.w + o.x;
    if (m.seen.charAt(i) === ' ') return;
    m.seen = m.seen.slice(0, i) + ch + m.seen.slice(i + 1);
  }

  // What your memory holds at an opening: its character in dept.seen (' ' never seen), or ' '
  // with no memory kept.
  const memoryAt = (m, o) => m.seen && m.seen.length === m.w * m.h ? m.seen.charAt(o.y * m.w + o.x) : ' ';

  // The shutters close: each opening's tile is kept in ch and becomes Z, and what you
  // remembered there in sealed.seen; the clock stops.
  function seal(state, c, call, ev) {
    const m = state.dept;
    let seen = '';
    for (const o of c.openings || []) {
      const ch = Grid.ch(m, o.x, o.y);
      if (ch !== 'Z') o.ch = ch;
      seen += memoryAt(m, o);
      Grid.set(m, o.x, o.y, 'Z');
      remember(m, o, 'Z');
    }
    c.sealed = { turn: state.turn, by: call.by === undefined ? null : call.by, why: call.why, at: state.turn, last: state.turn, seen };
    delete c.waiting;
    if (m.clock) m.clock.pausedSince = state.turn;
    const cause = { k: 'hall', why: call.why };
    if (call.by !== undefined) cause.by = call.by;
    Causes.emit(state, ev, 'stage', { stage: 'sealed' }, cause);
  }
  // The shutters open: each opening's tile comes back, and your memory of a remembered one
  // goes back to what you last saw there before they closed (an opening in view takes what it
  // is now at the step's end, Vision.remember); the clock runs again.
  function lift(state, c, why, ev) {
    const m = state.dept, seen = c.sealed && typeof c.sealed.seen === 'string' ? c.sealed.seen : '';
    (c.openings || []).forEach((o, i) => {
      if (Grid.ch(m, o.x, o.y) !== 'Z') return;
      Grid.set(m, o.x, o.y, o.ch);
      remember(m, o, i < seen.length ? seen.charAt(i) : o.ch);
    });
    c.sealed = null;
    c.lifted = { turn: state.turn, why };
    if (m.clock) m.clock.pausedSince = null;
    Causes.emit(state, ev, 'stage', { stage: 'unsealed' }, { k: 'hall', why });
  }
  // Why a seal lifts when none of the Centrepiece's pieces stands.
  const gone = c => c.sheet ? 'sheet' : c.form === 'treasure' ? 'treasure' : 'defeat';

  // Turn boundary step 6's first part (§8.1, §8.4): the lift, or the seal and its wait; then
  // each check added, in order. Nothing happens once the visit is over.
  function boundary(state, ev) {
    const c = cp(state);
    if (!c || state.over) return;
    if (c.sealed) {
      const left = standing(state, c);
      if (!left.length) lift(state, c, gone(c), ev);
      else if (!left.some(a => inHall(state, a))) lift(state, c, 'alone', ev);
      else {
        const s = c.sealed, you = state.actors[0];
        s.at = state.turn;
        if (left.some(a => Actors.dist(a, you.x, you.y) <= 1)) s.last = state.turn;
        if (state.turn - s.last >= N.SEAL_LIFT_TURNS) lift(state, c, 'quiet', ev);
      }
    } else if (!youInside(state)) {
      delete c.waiting;
      delete c.lifted;
    } else {
      const call = calls(state);
      if (!call) delete c.waiting;
      else {
        const who = occupant(state, c);
        if (!who) seal(state, c, call, ev);
        else if (!c.waiting) {
          // The cause names what calls for the seal (by), never who merely stands in the way,
          // and one who stands there (in) only if you see it: the first you see, if any.
          c.waiting = { turn: state.turn, by: who.uid };
          const cause = { k: 'hall', why: call.why }, seen = occupants(state, c).find(a => inView(state, a));
          if (call.by !== undefined) cause.by = call.by;
          if (seen) cause.in = seen.uid;
          Causes.emit(state, ev, 'stage', { stage: 'waiting' }, cause);
        }
      }
    }
    for (const id of ids) {
      if (state.over) return;
      checks[id](state, ev);
    }
  }

  // Hall.onHurt(state, cause): Combat.hurt tells the hall of every blow, shot, beam or special
  // that hurts you; one by a piece of the Centrepiece (cause.by, or the shooter of a beam sent
  // back) while the hall is sealed makes the turn it falls in no quiet one: the next boundary
  // to judge the seal (at + 1) finds it.
  function onHurt(state, cause) {
    const c = cp(state);
    if (!c || !c.sealed || !cause || !Array.isArray(c.uids)) return;
    if (!c.uids.includes(cause.by) && !c.uids.includes(cause.shooter)) return;
    c.sealed.last = Math.max(c.sealed.last, c.sealed.at + 1);
  }

  // A Re-admission Ticket was read (consumables.js, after Wake.lose): a sealed hall unseals;
  // each of the Centrepiece's pieces still standing regains SEAL_HEAL_PCT of its maximum
  // health and, unless asleep, goes back to its place.
  function onTicket(state, ev) {
    const c = cp(state);
    if (!c || !c.sealed || state.over) return;
    lift(state, c, 'ticket', ev);
    const cause = { k: 'hall', why: 'ticket' };
    for (const a of standing(state, c)) {
      Health.heal(state, a, Int.pct(a.maxHp, N.SEAL_HEAL_PCT), cause, ev);
      if (a.mode !== 'dormant' && a.mode !== 'returning' && a.mode !== 'reinstalling') Wake.setMode(state, a, 'returning', cause, ev);
    }
  }
  // The Centrepiece is defeated (its last piece fell; a treasure's guardian fell): a sealed
  // hall unseals at once. Its rules call this; with none of its pieces standing, the hall
  // never calls for its seal again.
  function onDefeat(state, ev) {
    const c = cp(state);
    if (!c || !c.sealed) return;
    lift(state, c, gone(c), ev);
  }

  // Hall.entering(state, action) → null | {by, form, seals}: for the confirmation before
  // stepping into the hall (§7.1; js/main.js asks Text.confirm('hall')): non-null when the
  // action is a step from outside the hall onto a free tile inside it, while the Centrepiece
  // stands and the hall is not sealed. seals: the hall calls for its seal now and no one but
  // you stands in an opening, so it seals behind you at the next boundary unless someone
  // steps into one first; by: who calls for it (null if none does). Judged on what you can
  // know now; it only reads.
  function entering(state, action) {
    const c = cp(state);
    if (!c || c.sealed || state.over || !action || action.a !== 'move') return null;
    const d = action.dir, you = state.actors[0], m = state.dept;
    if (!Number.isInteger(d) || d < 0 || d > 7) return null;
    const x = you.x + Grid.DX[d], y = you.y + Grid.DY[d];
    if (inside(state, you.x, you.y) || !inside(state, x, y) || !standing(state, c).length) return null;
    if (Actors.at(state, x, y, you) || Grid.closedDoor(m, x, y) || !Grid.canStep(m, you.x, you.y, d, 'you')) return null;
    const call = calls(state);
    return { by: call && call.by !== undefined ? call.by : null, form: c.form, seals: !!call && !occupant(state, c, you) };
  }

  // The `sealed` refusal (§4.2; Actions.addRefuser): a step into a shutter, or a take of an
  // item lying under one.
  Actions.addRefuser((state, action) => {
    const m = state.dept;
    if (!action || !m || !m.tiles) return null;
    if (action.a === 'move' && Number.isInteger(action.dir) && action.dir >= 0 && action.dir < 8) {
      const you = state.actors[0];
      return Grid.ch(m, you.x + Grid.DX[action.dir], you.y + Grid.DY[action.dir]) === 'Z' ? 'sealed' : null;
    }
    if (action.a === 'take' && typeof action.uid === 'string') {
      for (const it of state.items || []) if (it.uid === action.uid) return it.where && it.where.at === 'floor' && Grid.ch(m, it.where.x, it.where.y) === 'Z' ? 'sealed' : null;
    }
    return null;
  });

  return { addCheck, added, defineSeal, cp, calls, boundary, onHurt, onTicket, onDefeat, inside, openings, entering };
})();
