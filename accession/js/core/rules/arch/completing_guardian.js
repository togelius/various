// ACCESSION — the completing_guardian archetype's hooks (S.9's Centrepiece, the Composite; BUILD.md
// §5.1, §5.3, §5.5, §8.1; rules/archetypes.js), added with the hooks every Centrepiece shares
// (Centrepiece.hooks: its specials in turn, its phases, its fall). Its registry entry is in
// js/core/reg/cp-guardian.js, its sentences in js/core/text/cp-guardian.js and its record in
// content/S9-cp.js. Owned by COMPOSITE-CORE; COMPOSITE-PHASES adds its phases and the treasure
// (the seal, the carry-out, the leave-heal, phase 2's limb).
//
// The rule, as its line says it (design/samples.md §3.8, trimmed; M4 plan D3.5, decided without
// play; revisit once M4 is playable):
//   - It guards the Lamp's case: at its init it takes the hall's case (LTreasure.caseOf) as what
//     it guards (`guards`), and its record's trigger, touch_case, wakes it at once, hunting, when
//     that case is opened or bashed (Cases.touch touches what guards a case as what stands in it).
//   - It never leaves its hall: mayStep refuses any step that would put a tile of its footprint
//     outside it (Hall.inside), so neither a rule nor the Window Pole moves it out.
//   - While you stand outside the hall it starts no fight with you: its limbs' shapes mark
//     nothing then, and while it hunts or searches it strikes no blow (act). Hunting, while it
//     sees you it walks back to its place (its home, anchor first) and waits there, still
//     hunting, so it does not turn back and forth while you watch from an opening; once it does
//     not see you, or searching, it goes back (Wake.setMode to returning, cause outside) and acts
//     by its mode, which walks it home. So the log never sends it to search where you are,
//     outside a hall it never leaves. Awake (a noise sent it to look), it looks as any exhibit
//     does, but only as far as its hall's edge.
//   - Its limbs (Guardian.LIMBS, its specials: a.ax.specials, in the order grown) come from the
//     galleries you have walked (Guardian.galleries): one for every GUARDIAN_PER_STAGE of them,
//     in LIMBS' order, at most GUARDIAN_STAGE_MAX and LIMBS' count. It has those it is due when
//     it is placed, with no event; then at every turn boundary (a hall check, Hall.addCheck),
//     each limb newly due grows, told by a phase event in the phase it is in (cause walked {n},
//     stage, gained). a.ax.stage is how many limbs it has; a.ax.grown how many your walking has
//     given it, so a limb it loses (COMPOSITE-PHASES' leave-heal) comes back only with more
//     galleries walked.
//   - Each limb is a special, marked in turn (Centrepiece.act, every CP_SPECIAL_EVERY of its
//     actions), only while you stand in its hall on one of the tiles it would mark, each for a
//     Centrepiece's gross (cp:): its neck (cp_sweep, shape sweep) the tiles round it on your side;
//     its legs (cp_charge, shape charge) a lane as wide as it toward you, up to CHARGE_RANGE rows,
//     of tiles of its hall it could step onto, so never through a case (the Lamp's least of all:
//     the lane stops short of it); its tail (cp_ring, shape tail) all the tiles round it. When
//     the legs' mark goes off it strikes everything on the lane, then (the shape's after) runs
//     along the lane, row by row, as far as the lane goes or until someone stands in its way.
//   - Otherwise it fights as every exhibit does (AI.byMode): it strikes from beside you.
// Nothing here draws on a stream.
'use strict';
const Guardian = (() => {
  const ID = 'completing_guardian';
  const isInt = Number.isInteger;
  // Its limbs, in the order it grows them: a neck, legs, a tail (the specials' ids).
  const LIMBS = ['cp_sweep', 'cp_charge', 'cp_ring'];
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
  // The most limbs it may have: GUARDIAN_STAGE_MAX, and no more than it has limbs to grow.
  const most = () => Math.min(N.GUARDIAN_STAGE_MAX, LIMBS.length);
  // Guardian.stage(a) → int: how many limbs it has (a.ax.stage, 0 when absent).
  const stage = a => a && a.ax && isInt(a.ax.stage) ? a.ax.stage : 0;

  // Guardian.grow(state, a, ev): every limb newly due from the galleries you have walked: for each
  // GUARDIAN_PER_STAGE more of them (a.ax.grown, those your walking has given it so far, counts
  // up to galleries ÷ GUARDIAN_PER_STAGE, at most `most`), the next limb it lacks (LIMBS[its
  // stage]) joins its specials, while it has fewer than `most`; each told by a phase event (who,
  // its phase, stage, gained; cause walked {n}) unless ev is null (when it is placed, which tells
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

  // Hunting you while you stand outside its hall and it sees you: it walks back to its place
  // (home, anchor first) and waits there, in the same mode.
  function holdBack(state, a, ev) {
    if (!a.home || AI.atHome(a)) return AI.wait(state, a, ev);
    const t = AI.towards(state, a, a.home, 'anchor', ev);
    return t !== null ? t : AI.wait(state, a, ev);
  }
  // Its own turn, after its limbs (Centrepiece.hooks): while you stand outside its hall and it
  // hunts or searches for you, it starts no fight with you (above); otherwise null, and it acts
  // by its mode.
  function act(state, a, ev) {
    if (!isMine(state, a) || youInHall(state) || (a.mode !== 'hunting' && a.mode !== 'searching')) return null;
    if (a.mode === 'hunting' && AI.sees(state, a)) return holdBack(state, a, ev);
    Wake.setMode(state, a, 'returning', { k: 'outside' }, ev);
    return null;
  }

  Archetypes.add(ID, Centrepiece.hooks(ID, { init, mayStep, act }));
  // At every turn boundary (step 6, after the hall's own seal), the limbs newly due grow.
  Hall.addCheck('guardian_limbs', (state, ev) => {
    for (const a of Centrepiece.pieces(state)) if (a.arch === ID) grow(state, a, ev);
  });

  return { LIMBS: LIMBS.slice(), galleries, stage, grow, lane };
})();
