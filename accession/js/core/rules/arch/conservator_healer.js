// ACCESSION — the conservator_healer archetype's hooks (A.4's Countersigning Clerk, and the
// Ordinance's Senior Countersigning Clerk; BUILD.md §5.1, §5.3, §8.1; rules/archetypes.js), owned
// by ARCH-CLOCKWORK. Its registry entry is in js/core/reg/arch-d.js and its sentences in
// js/core/text/arch-d.js.
//
// The rule, as its line says it (M4 plan D3.13; the interrupt is cut, D3.7):
//   - It never strikes: it has no blow (readout: noBlow), so neither a hunt nor anything else
//     brings one.
//   - It keeps CONSERVATOR_KEEP tiles from you, counted as the steps it would walk to reach you
//     (as the kiter's KITER_HOLD is): hunting you and nearer than that, it steps away (AI.away:
//     a step that takes it further from you by walking), or, cornered, does what follows.
//   - Its restore (the special `restore`, a mark that deals no damage): it marks the tile of
//     the ally it sees (within SIGHT_EXHIBIT of a tile of it, in line of sight) that has lost
//     the most health (ties to the first in spawn order). An ally is any other exhibit, not
//     gone, in no intact case (only a beam passes glass) and not showing as something else (a
//     mimic in its disguise), missing health that the restore would give back: at least 1 of
//     its CONSERVATOR_HEAL_PCT% (so not a swarm body of 2 or 3). Like every mark, it is shown
//     until the healer's next action, which comes after your next decision (§8.1), and then it
//     goes off (onResolve): every exhibit standing on a marked tile then, other than the
//     healer, not gone and in no intact case, regains CONSERVATOR_HEAL_PCT% of its own maximum
//     health, rounded down, never past its maximum (Health.heal, cause restore). It marks while
//     hunting, or awake (marksAwake), as only a marking exhibit may (Specials.canMark); a mark
//     it may not make (none pending, its own already shown) is not made. Nothing interrupts it
//     but what calls off any mark (§8.1: it is fixed, it goes to look for you, it sleeps, it
//     is destroyed).
//   - Otherwise, hunting you: while it sees you, or for LOSE_TRACK_TURNS after it last did, it
//     waits where it is, so it never comes nearer of its own accord; then it searches as any
//     exhibit does (AI.byMode). In every other mode it acts by its mode (AI.byMode), which
//     never strikes.
//   - In an intact case it acts by its mode: it only waits (§8.3).
// With clockwork (A.4.5 has it) these are the moves it shows and makes (rules/mods/clockwork.js:
// its act gives null while clockwork is on, and clockwork makes the move it showed through
// ConservatorHealer.clockwork).
//
// ConservatorHealer, for clockwork and the tests:
//   ConservatorHealer.target(state, a) → null | actor   the ally it would restore now
//   ConservatorHealer.restorable(state, a, b) → bool     may it restore b now
//   ConservatorHealer.own(state, a, ev) → ticks | null   its action (null: by its mode)
//   ConservatorHealer.clockwork   {behave, can, make}: its moves, for clockwork
'use strict';
const ConservatorHealer = (() => {
  const SP = 'restore';
  const you = state => state.actors[0];

  // Does a see b: a tile of b within SIGHT_EXHIBIT (Grid.disc) of a tile of a, in line of sight
  // from it (AI.sees' measure, toward an exhibit).
  function sees(state, a, b) {
    const r = N.SIGHT_EXHIBIT;
    for (const [x, y] of Actors.footprint(a)) for (const [bx, by] of Actors.footprint(b))
      if (Grid.disc(bx - x, by - y, r) && Grid.los(state.dept, x, y, bx, by)) return true;
    return false;
  }
  // The health the restore gives b back, rounded down, before its maximum caps it.
  const share = b => Int.pct(b.maxHp, N.CONSERVATOR_HEAL_PCT);
  // May a restore b now: another exhibit, not gone, in no intact case, not showing as
  // something else, missing health the restore would give back (at least 1 of its share), and
  // seen by a.
  function restorable(state, a, b) {
    if (!b || b === a || b.uid === 'you' || b.gone || b.hp >= b.maxHp || share(b) < 1) return false;
    if (Cases.encased(state, b) || Archetypes.present(state, b) !== null) return false;
    return sees(state, a, b);
  }
  // The ally a restores now: the restorable one that has lost the most health (maxHp − hp),
  // ties to the first in spawn order; null if none.
  function target(state, a) {
    let best = null;
    for (let i = 1; i < state.actors.length; i++) {
      const b = state.actors[i];
      if (restorable(state, a, b) && (!best || b.maxHp - b.hp > best.maxHp - best.hp)) best = b;
    }
    return best;
  }
  // The restore's shape: the tiles of the ally a would restore now (none, if none).
  Specials.addShape(SP, { tiles: (state, a) => { const b = target(state, a); return b ? Actors.footprint(b) : []; } });

  // Its walking distance from you (AI.field's, as the kiter's): steps from your tile; -1 if none.
  function fromYou(state, a) {
    const m = state.dept;
    return AI.field(state, a, you(state), 'beside')[a.y * m.w + a.x];
  }
  const near = (state, a) => { const w = fromYou(state, a); return w >= 0 && w < N.CONSERVATOR_KEEP; };

  // Its action (above), or null to act by its mode.
  function own(state, a, ev) {
    if (Cases.encased(state, a)) return null;
    const hunting = a.mode === 'hunting', close = hunting && near(state, a);
    if (close) { const r = AI.away(state, a, you(state), ev); if (r !== null) return r; }
    const t = Specials.tiles(state, a, SP);
    if (Specials.canMark(state, a, SP, t)) return Specials.mark(state, a, SP, t, ev);
    if (!hunting) return null;
    if (close || AI.sees(state, a) || state.turn - a.stim < AI.loseTrackTurns(state, a)) return AI.wait(state, a, ev);
    return null;
  }
  const behave = (state, a, ev) => { const r = own(state, a, ev); return r !== null ? r : AI.byMode(state, a, ev); };

  // Its restore goes off: every exhibit on a marked tile (above) regains its share. Then, with
  // clockwork, it shows its next move (its mark resolved before any archetype acts).
  function onResolve(state, a, tel, ev) {
    if (!tel || tel.sp !== SP) return;
    const marked = (x, y) => tel.tiles.some(t => t[0] === x && t[1] === y);
    for (let i = 1; i < state.actors.length; i++) {
      const b = state.actors[i];
      if (b === a || b.gone || Cases.encased(state, b) || !Actors.footprint(b).some(([x, y]) => marked(x, y))) continue;
      Health.heal(state, b, share(b), { k: 'restore', by: a.uid }, ev);
    }
    Clockwork.replan(state, a);
  }

  // Its moves, for clockwork: its restore marked on the tiles shown, if that is still the tile
  // of an ally it may restore (anyone it may restore: not only the one it would choose now) and
  // it may mark.
  function can(state, a, plan) {
    if (plan.k !== 'mark' || plan.sp !== SP) return undefined;
    const b = Actors.at(state, plan.tiles[0][0], plan.tiles[0][1], a);
    if (!b || !restorable(state, a, b)) return false;
    const fp = Actors.footprint(b);
    return fp.length === plan.tiles.length && fp.every((t, i) => t[0] === plan.tiles[i][0] && t[1] === plan.tiles[i][1]) && Specials.canMark(state, a, SP, plan.tiles);
  }
  function make(state, a, plan, ev) {
    if (plan.k !== 'mark' || plan.sp !== SP) return undefined;
    return Specials.mark(state, a, SP, plan.tiles.map(t => [t[0], t[1]]), ev);
  }

  Archetypes.add('conservator_healer', {
    // With clockwork on, clockwork makes its moves (null here, and the modifier's act acts).
    act: (state, a, ev) => Clockwork.governs(state, a) ? null : own(state, a, ev),
    onResolve,
    marksAwake: () => true,
    readout: () => [{ k: 'noBlow' }],
  });

  return { target, restorable, own, clockwork: { behave, can, make } };
})();
