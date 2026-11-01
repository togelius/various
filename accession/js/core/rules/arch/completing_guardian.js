// ACCESSION — the completing_guardian archetype's hooks (S.9's Centrepiece, the Composite; BUILD.md
// §5.1, §5.3, §5.5, §8.1; rules/archetypes.js), added with the hooks every Centrepiece shares
// (Centrepiece.hooks: its specials in turn, its phases, its fall). Its registry entry is in
// js/core/reg/cp-guardian.js, its sentences in js/core/text/cp-guardian.js and its record in
// content/S9-cp.js. COMPOSITE-CORE built its core; COMPOSITE-PHASES its phases (phase 2's and
// phase 3's limbs, the alarm, the crest), the leave-heal and the touch it records for its
// treasure's seal (rules/treasure.js: the seal, the carry-out, the dust sheet over its case).
//
// The rule, as its line says it (design/samples.md §3.8, trimmed; M4 plan D3.5, decided without
// play; revisit once M4 is playable):
//   - It guards the Lamp's case: at its init it takes the hall's case (LTreasure.caseOf) as what
//     it guards (`guards`), and its record's trigger, touch_case, wakes it at once, hunting, when
//     that case is opened or bashed (Cases.touch touches what guards a case as what stands in it).
//     The first such touch is recorded (onTouched: dept.cp.touched {turn}), from which its
//     treasure's seal counts (rules/treasure.js).
//   - It never leaves its hall: mayStep refuses any step that would put a tile of its footprint
//     outside it (Hall.inside), so neither a rule nor the Window Pole moves it out.
//   - While you stand outside the hall it starts no fight with you: its limbs' shapes mark
//     nothing then, and while it hunts or searches it strikes no blow (act). Hunting, while it
//     sees you it walks back to its place (its home, anchor first) and waits there, still
//     hunting, so it does not turn back and forth while you watch from an opening; once it does
//     not see you, or searching, it goes back (Wake.setMode to returning, cause outside) and acts
//     by its mode, which walks it home. So the log never sends it to search where you are,
//     outside a hall it never leaves. Awake (a noise sent it to look), it looks as any exhibit
//     does, but only within its hall: a noise beyond it, which no step of it reaches, leaves it
//     wandering its hall until it goes back undisturbed (AI's awake), so its line says it goes
//     back only of it hunting or searching for you.
//   - The leave-heal (a hall check, guardian_left, at every turn boundary): a boundary that finds
//     you outside its hall (an opening is outside it) after one that found you inside it while
//     it hunted you (a.ax.chased, true while the last boundary did, absent otherwise) is your
//     leaving it while it hunts you: it regains GUARDIAN_LEAVE_HEAL_PCT% of its maximum health
//     (healed, cause left) and drops its last limb (phase, cause left {limb}). A Ticket read
//     while it hunts you is a leaving too. Its phase never goes back (§8.7), and walking gives a
//     dropped limb back only for galleries walked after (a.ax.grown keeps those it has given).
//   - Its limbs (Guardian.LIMBS, its specials: a.ax.specials, in the order grown: its neck, its
//     legs, its tail, its crest; always the first so many of LIMBS) come in part from the
//     galleries you have walked (Guardian.galleries): one for every GUARDIAN_PER_STAGE of them,
//     in LIMBS' order, but walking grows only its neck and its legs (Guardian.WALKED; and never
//     more than GUARDIAN_STAGE_MAX), never its tail: S.9's departments hold five gallery rooms,
//     so walking every one of them gives it two limbs, and its line promises no tail from walking
//     it could never give (M4 COMPOSITE-CORE's review, decided without play; revisit once M4 is
//     playable). It has those it is due when it is placed, with no event; then at every turn
//     boundary (a hall check, guardian_limbs), each limb newly due grows, told by a phase event
//     in the phase it is in (cause walked {n}, stage, gained). Each of its phases from the second
//     grows its next limb (onPhase: LIMBS[its stage], while it has fewer than GUARDIAN_STAGE_MAX;
//     phase, cause limb), so its tail and its crest come only from its phases (plan D3.5's limb
//     at phase 2, and the sample's stage at phase 3; COMPOSITE-PHASES, decided without play;
//     revisit once M4 is playable). a.ax.stage is how many limbs it has; a.ax.grown how many
//     your walking has given it.
//   - Each limb is a special, marked in turn (Centrepiece.act, every CP_SPECIAL_EVERY of its
//     actions), only while you stand in its hall on one of the tiles it would mark: its neck
//     (cp_sweep, shape sweep) the tiles round it on your side; its legs (cp_charge, shape charge)
//     a lane as wide as it toward you, up to CHARGE_RANGE rows, of tiles of its hall it could
//     step onto, so never through a case (the Lamp's least of all: the lane stops short of it);
//     its tail (cp_ring, shape tail) all the tiles round it; each strikes for a Centrepiece's
//     gross (cp:), and when the legs' mark goes off it strikes everything on the lane, then (the
//     shape's after) runs along the lane, row by row, as far as the lane goes or until someone
//     stands in its way. Its crest (cp_call, shape crest) is a call, as a herald's is: it marks
//     the tiles within HERALD_RANGE of it, and when it goes off (onResolve) every sleeping
//     exhibit on them that can hear, but a Centrepiece's piece, wakes awake, sent to look at
//     your tile (cause herald, by it; one in an intact case wakes in it and stays there).
//   - The alarm: from its second phase, with alarm_network on (its record is flagged with it),
//     while it hunts you in its hall and sees you, with no alarm shown or running
//     (AlarmNetwork.mayShow), it shows the alarm on its own tiles (the Wader's special, alarm),
//     at an action of its own at which none of its limbs is marked; its next action sets it off
//     (onResolve: AlarmNetwork.call, the crash and the wakes), and the module raises it.
//   - Otherwise it fights as every exhibit does (AI.byMode): it strikes from beside you.
// Nothing here draws on a stream.
'use strict';
const Guardian = (() => {
  const ID = 'completing_guardian';
  const isInt = Number.isInteger;
  // The limbs walking grows, in order: its neck, then its legs (the specials' ids). Walking
  // grows no more: S.9's departments hold five gallery rooms (completing_guardian.test.js
  // measures them), which give two limbs, so its line names these two and no other.
  const WALKED = ['cp_sweep', 'cp_charge'];
  // All its limbs, in the order it has them: those walking grows, then its tail and its crest,
  // which only its phases grow.
  const LIMBS = WALKED.concat(['cp_ring', 'cp_call']);
  // The four directions a lane runs in: N, E, S, W (Grid.DX, Grid.DY's indices).
  const SIDES = [0, 2, 4, 6];

  const isMine = (state, a) => { const cp = Hall.cp(state); return !!a && a.arch === ID && !!cp && Array.isArray(cp.uids) && cp.uids.includes(a.uid); };
  const youInHall = state => { const you = state.actors[0]; return Hall.inside(state, you.x, you.y); };
  const onTiles = (state, tiles) => { const you = state.actors[0]; return tiles.some(t => t[0] === you.x && t[1] === you.y); };

  // Guardian.galleries(state) → int: the galleries you have walked: in a department visit (one
  // that keeps dept.walked), the rooms you have stood in, the one you stand in now among them,
  // that hold a gallery (Populate.galleriesOf: a room its gallery list placed one in, or more,
  // which a player walks as one), each once; 0 anywhere else.
  function galleries(state) {
    const m = state && state.dept;
    if (!m || !Array.isArray(m.walked) || !Array.isArray(m.rooms) || !Array.isArray(m.roomOf)) return 0;
    const you = state.actors[0], row = m.roomOf[you.y], here = row ? row[you.x] : 0, ids = m.walked.slice();
    if (m.rooms.some(r => r.id === here) && !ids.includes(here)) ids.push(here);
    let n = 0;
    for (const id of ids) if (Populate.galleriesOf(state, id).length) n++;
    return n;
  }
  // The most limbs walking gives it: those it grows by walking (WALKED), and never more than
  // GUARDIAN_STAGE_MAX.
  const most = () => Math.min(N.GUARDIAN_STAGE_MAX, WALKED.length);
  // The most limbs it has in all: GUARDIAN_STAGE_MAX, and no more than LIMBS names.
  const all = () => Math.min(N.GUARDIAN_STAGE_MAX, LIMBS.length);
  // Guardian.stage(a) → int: how many limbs it has (a.ax.stage, 0 when absent).
  const stage = a => a && a.ax && isInt(a.ax.stage) ? a.ax.stage : 0;

  // Guardian.grow(state, a, ev): every limb newly due from the galleries you have walked: for each
  // GUARDIAN_PER_STAGE more of them (a.ax.grown, those your walking has given it so far, counts
  // up to galleries ÷ GUARDIAN_PER_STAGE, at most `most`), the next limb it lacks (LIMBS[its
  // stage]) joins its specials, while it has fewer than `most` (so walking never grows its tail,
  // nor a limb past its legs that another rule gave it); each told by a phase event (who, its
  // phase, stage, gained; cause walked {n}) unless ev is null (when it is placed, which tells
  // nothing). Nothing for one fallen, or once the visit is over.
  function grow(state, a, ev) {
    if (!isMine(state, a) || a.gone || state.over) return;
    const n = galleries(state), due = Math.min(most(), Int.idiv(n, N.GUARDIAN_PER_STAGE));
    let grown = isInt(a.ax.grown) ? a.ax.grown : 0;
    while (grown < due) {
      grown++;
      a.ax.grown = grown;
      const k = stage(a);
      if (k >= most()) continue;
      const sp = LIMBS[k];
      a.ax.stage = k + 1;
      if (!Array.isArray(a.ax.specials)) a.ax.specials = [];
      if (!a.ax.specials.includes(sp)) a.ax.specials.push(sp);
      if (ev) Causes.emit(state, ev, 'phase', { who: a.uid, phase: Centrepiece.phase(state), stage: k + 1, gained: sp }, { k: 'walked', n });
    }
  }

  // Guardian.gain(state, a, ev): a phase it entered (its second or third) grows its next limb:
  // the next it lacks (LIMBS[its stage]) joins its specials, while it has fewer than `all`,
  // told by a phase event in the phase it is in (who, phase, stage, gained; cause limb).
  // Nothing for one fallen, or once the visit is over.
  function gain(state, a, ev) {
    if (!isMine(state, a) || a.gone || state.over) return;
    const k = stage(a);
    if (k >= all()) return;
    const sp = LIMBS[k];
    a.ax.stage = k + 1;
    if (!Array.isArray(a.ax.specials)) a.ax.specials = [];
    if (!a.ax.specials.includes(sp)) a.ax.specials.push(sp);
    Causes.emit(state, ev, 'phase', { who: a.uid, phase: Centrepiece.phase(state), stage: k + 1, gained: sp }, { k: 'limb' });
  }
  // Guardian.leave(state, a, ev): you left its hall while it hunted you: it regains
  // GUARDIAN_LEAVE_HEAL_PCT% of its maximum health (healed, cause left; nothing when it is whole)
  // and drops its last limb, the one it grew last (LIMBS[its stage − 1]), told by a phase event
  // in the phase it is in (who, phase, stage; cause left {limb}); none with no limb. a.ax.grown
  // is kept, so walking gives a limb back only for galleries walked after.
  function leave(state, a, ev) {
    if (!isMine(state, a) || a.gone || state.over) return;
    Health.heal(state, a, Int.pct(a.maxHp, N.GUARDIAN_LEAVE_HEAL_PCT), { k: 'left' }, ev);
    const k = stage(a);
    if (k < 1) return;
    const sp = LIMBS[k - 1];
    a.ax.stage = k - 1;
    a.ax.specials = (Array.isArray(a.ax.specials) ? a.ax.specials : []).filter(id => id !== sp);
    Causes.emit(state, ev, 'phase', { who: a.uid, phase: Centrepiece.phase(state), stage: k - 1 }, { k: 'left', limb: sp });
  }

  // ---- Its limbs' shapes (Specials.addShape) ----

  // The tiles round its footprint (the ring's: Grid.hold, never an intact case's).
  const ring = (state, a) => Specials.tiles(state, a, 'ring');
  // Its neck's: the ring's tiles on your side of its footprint (west of it when you stand west of
  // it, and so on; both sides when you stand past a corner).
  function sideTiles(state, a) {
    const you = state.actors[0], s = a.size || 1, x1 = a.x + s - 1, y1 = a.y + s - 1;
    const sx = you.x < a.x ? -1 : you.x > x1 ? 1 : 0, sy = you.y < a.y ? -1 : you.y > y1 ? 1 : 0;
    return ring(state, a).filter(([x, y]) => (sx < 0 && x < a.x) || (sx > 0 && x > x1) || (sy < 0 && y < a.y) || (sy > 0 && y > y1));
  }
  // Can it stand on (x, y) in its charge: a tile of its hall it could step onto (Grid.walkable for
  // an exhibit: never a case, a wall, a plinth or a staff door) that is no closed door.
  const clear = (state, x, y) => Grid.inside(state.dept, x, y) && Hall.inside(state, x, y) && Grid.walkable(state.dept, x, y, 'exhibit') && !Grid.closedDoor(state.dept, x, y);
  // Guardian.lane(state, a, d) → [[x, y]…]: its legs' lane on side d (N, E, S or W): the rows of
  // tiles beside its footprint on that side, each as wide as it, one after another, up to
  // CHARGE_RANGE rows, stopping before the first row with a tile it could not stand on (clear),
  // in row-major order.
  function lane(state, a, d) {
    const s = a.size || 1, out = [];
    for (let k = 1; k <= N.CHARGE_RANGE; k++) {
      const row = [];
      for (let i = 0; i < s; i++) {
        const x = d === 2 ? a.x + s - 1 + k : d === 6 ? a.x - k : a.x + i, y = d === 0 ? a.y - k : d === 4 ? a.y + s - 1 + k : a.y + i;
        row.push([x, y]);
      }
      if (!row.every(([x, y]) => clear(state, x, y))) break;
      out.push(...row);
    }
    return out.sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  }
  // The side of its footprint a tile lies on (N, E, S or W), or -1 for one beside no side.
  function sideOf(a, x, y) {
    const s = a.size || 1;
    if (x >= a.x && x < a.x + s) return y < a.y ? 0 : y >= a.y + s ? 4 : -1;
    if (y >= a.y && y < a.y + s) return x < a.x ? 6 : x >= a.x + s ? 2 : -1;
    return -1;
  }

  // Its neck: the tiles round it on your side, while you stand in its hall on one of them.
  Specials.addShape('sweep', {
    tiles(state, a) {
      if (!youInHall(state)) return [];
      const t = sideTiles(state, a);
      return onTiles(state, t) ? t : [];
    },
  });
  // Its legs: the lane toward you, while you stand in its hall on it (the lane you stand on, of
  // its four; none if you stand on none). When it goes off, after the hits, it charges.
  Specials.addShape('charge', {
    tiles(state, a) {
      if (!youInHall(state)) return [];
      for (const d of SIDES) { const t = lane(state, a, d); if (onTiles(state, t)) return t; }
      return [];
    },
    after: (state, a, tel, ev) => charge(state, a, tel, ev),
  });
  // Its tail: all the tiles round it, while you stand in its hall on one of them.
  Specials.addShape('tail', {
    tiles(state, a) {
      if (!youInHall(state)) return [];
      const t = ring(state, a);
      return onTiles(state, t) ? t : [];
    },
  });
  // Its crest: a call's tiles (those an exhibit could stand on within HERALD_RANGE of it), while
  // you stand in its hall on one of them. When it goes off, its call (onResolve).
  Specials.addShape('crest', {
    tiles(state, a) {
      if (!youInHall(state)) return [];
      const t = Specials.tiles(state, a, 'call');
      return onTiles(state, t) ? t : [];
    },
  });

  // Its charge, once its legs' mark has gone off (Specials' after): it steps along the marked
  // lane, row by row (Step.moveInto: a moved event each, then AI.afterStep, as every exhibit's
  // step), while the next row is all marked tiles it could stand on and no one stands there,
  // and its archetype allows the step (never out of its hall); so it stops before anyone the
  // lane's blow left standing, you included, and never touches a case. Its mark's ticks pay for
  // the run.
  function charge(state, a, tel, ev) {
    const t = tel.tiles, d = t.length ? sideOf(a, t[0][0], t[0][1]) : -1, s = a.size || 1;
    if (d < 0) return;
    const marked = (x, y) => t.some(p => p[0] === x && p[1] === y);
    for (let k = 0; k < Int.idiv(t.length, s); k++) {
      const nx = a.x + Grid.DX[d], ny = a.y + Grid.DY[d];
      let ok = Archetypes.mayStep(state, a, nx, ny);
      for (let dy = 0; dy < s && ok; dy++) for (let dx = 0; dx < s && ok; dx++) {
        const x = nx + dx, y = ny + dy;
        if (Actors.covers(a, x, y)) continue;
        if (!marked(x, y) || !clear(state, x, y) || Actors.at(state, x, y, a)) ok = false;
      }
      if (!ok || typeof Step.moveInto(state, a, d, ev) !== 'number') return;
      AI.afterStep(state, a, ev);
    }
  }

  // ---- Its hooks ----

  // It guards the hall's case, the Lamp's (unless it was given one), and has the limbs the
  // galleries you have walked already give it, untold.
  function init(state, a) {
    if (!isMine(state, a)) return;
    if (!a.guards) { const f = LTreasure.caseOf(state); if (f) a.guards = [f.x, f.y]; }
    if (!isInt(a.ax.stage)) a.ax.stage = 0;
    if (!isInt(a.ax.grown)) a.ax.grown = 0;
    grow(state, a, null);
  }

  // A step to anchor (x, y) keeps every tile of its footprint in its hall.
  function mayStep(state, a, x, y) {
    if (!isMine(state, a)) return true;
    const s = a.size || 1;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (!Hall.inside(state, x + dx, y + dy)) return false;
    return true;
  }

  // Its case is touched (Cases.touch: opened or bashed; never Solvent): the first touch's turn
  // is its hall's (dept.cp.touched {turn}), from which its treasure's seal counts.
  function onTouched(state, a) {
    const c = Hall.cp(state);
    if (!isMine(state, a) || !c || c.touched) return;
    c.touched = { turn: state.turn };
  }

  // Each phase it enters from its second grows its next limb (Centrepiece.hooks' onPhase).
  function onPhase(state, k, ev) {
    if (k < 2) return;
    for (const a of Centrepiece.pieces(state)) if (a.arch === ID) gain(state, a, ev);
  }

  // From its second phase, hunting you in its hall and seeing you, with alarm_network on for it
  // and no alarm shown or running (AlarmNetwork.mayShow), it shows the alarm on its own tiles
  // (the special alarm, its shape the Wader's), if it may mark (Specials.canMark); otherwise
  // null.
  function showAlarm(state, a, ev) {
    if (a.mode !== 'hunting' || Centrepiece.phase(state) < 2 || !AI.sees(state, a) || !AlarmNetwork.mayShow(state, a)) return null;
    const t = Specials.tiles(state, a, 'alarm');
    return Specials.canMark(state, a, 'alarm', t) ? Specials.mark(state, a, 'alarm', t, ev) : null;
  }
  // A mark of its own goes off that deals no damage: the alarm's call (AlarmNetwork.call: the
  // crash, then the wakes; the module then raises the alarm on the special event), or its
  // crest's call: each sleeping exhibit, in spawn order, but itself and a Centrepiece's pieces,
  // any of whose tiles is marked, wakes awake, sent to look at your tile now (cause herald, with
  // its uid and their distance; how: 'case' for one in an intact case, which wakes in it and
  // stays there, §8.3); a pipless one (a mimic) hears nothing (Wake.wake refuses it).
  function onResolve(state, a, tel, ev) {
    if (!isMine(state, a) || !tel) return;
    if (tel.sp === 'alarm') { AlarmNetwork.call(state, a, ev); return; }
    if (tel.sp !== 'cp_call') return;
    const you = state.actors[0], target = [you.x, you.y];
    const marked = (x, y) => tel.tiles.some(t => t[0] === x && t[1] === y);
    for (let i = 1; i < state.actors.length; i++) {
      const b = state.actors[i];
      if (b === a || b.gone || b.mode !== 'dormant' || Actors.centrepiece(b)) continue;
      if (!Actors.footprint(b).some(([x, y]) => marked(x, y))) continue;
      const cause = { k: 'herald', by: a.uid, dist: Actors.between(a, b), x: target[0], y: target[1] };
      if (Cases.encased(state, b)) cause.how = 'case';
      Wake.wake(state, b, 'awake', cause, ev, { target });
    }
  }

  // Hunting you while you stand outside its hall and it sees you: it walks back to its place
  // (home, anchor first) and waits there, in the same mode.
  function holdBack(state, a, ev) {
    if (!a.home || AI.atHome(a)) return AI.wait(state, a, ev);
    const t = AI.towards(state, a, a.home, 'anchor', ev);
    return t !== null ? t : AI.wait(state, a, ev);
  }
  // Its own turn, after its limbs (Centrepiece.hooks): in its hall with you, the alarm, from its
  // second phase (showAlarm); while you stand outside its hall and it hunts or searches for you,
  // it starts no fight with you (above); otherwise null, and it acts by its mode.
  function act(state, a, ev) {
    if (!isMine(state, a)) return null;
    if (youInHall(state)) return showAlarm(state, a, ev);
    if (a.mode !== 'hunting' && a.mode !== 'searching') return null;
    if (a.mode === 'hunting' && AI.sees(state, a)) return holdBack(state, a, ev);
    Wake.setMode(state, a, 'returning', { k: 'outside' }, ev);
    return null;
  }

  Archetypes.add(ID, Centrepiece.hooks(ID, { init, mayStep, act, onTouched, onResolve, onPhase }));
  // At every turn boundary (step 6, after the hall's own seal): first the leave-heal, a
  // boundary finding you outside its hall after one that found you in it while it hunted you
  // (a.ax.chased); then the limbs newly due grow.
  Hall.addCheck('guardian_left', (state, ev) => {
    const you = state.actors[0], inside = !you.gone && Hall.inside(state, you.x, you.y);
    for (const a of Centrepiece.pieces(state)) {
      if (a.arch !== ID || a.gone) continue;
      if (a.ax.chased && !inside) leave(state, a, ev);
      if (inside && a.mode === 'hunting') a.ax.chased = true;
      else delete a.ax.chased;
    }
  });
  Hall.addCheck('guardian_limbs', (state, ev) => {
    for (const a of Centrepiece.pieces(state)) if (a.arch === ID) grow(state, a, ev);
  });

  return { LIMBS: LIMBS.slice(), WALKED: WALKED.slice(), galleries, stage, grow, gain, leave, lane };
})();
