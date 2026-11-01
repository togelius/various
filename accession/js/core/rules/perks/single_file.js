// ACCESSION — Single File, a Swarm perk (BUILD.md §8.7): "An enemy that steps into a doorway
// beside you loses its next action, once per enemy; at rank 2 it also takes 3 damage." Its rules
// register here with Perks.add (rules/perks.js); its entry and clause are in
// js/core/reg/perks-b.js and its sentences in js/core/text/perks-b.js. Losing an action is the
// status staggered (js/core/reg/perk-status.js). Owned by PG-PERKS-B.
//
// The rule (PR5, M4 plan D4.6), after an exhibit's step (Perks.afterStep, which AI.afterStep
// asks after every step that changed an exhibit's tile: its walk, a darter's step back, a
// patrol's, a clockwork move, the Composite's charge, a module's move):
//   - A doorway is an open door (') or an archway (,): the tiles one walks through between
//     rooms. A closed door is no doorway to step into (an exhibit that steps into one opens it
//     and stays where it is, §8.2), and an exhibit never steps onto a staff door or a shutter.
//   - The step counts when it brings a tile of the exhibit onto a doorway beside you (within a
//     king's move of your tile) that it did not cover before: for a body of one tile, the tile
//     it stepped onto. A body that never steps (the Great Board, the Ordinance's pieces) and
//     one that never leaves its hall (the Composite: a hall's openings are no tiles of it)
//     never count; nor does one that comes without a step (a split half, a summoned body,
//     which appear), until it steps.
//   - Once for each exhibit, by its uid, for the rest of the visit (dept.perk.filed, absent
//     until the first, M4 plan A3): a split half or a summoned body has a uid of its own, so
//     it counts once too.
//   - Then, in order: the perk event (cause single_file, who: it; the perk's doing, not its,
//     so the cause names it as who, never by); at the second rank
//     PERK_SINGLE_FILE_DMG damage (Combat.hurt, cause perk single_file, raw the perk's
//     damage), which no Padding reduces, taken as every damage is taken (its archetype's
//     rules apply: a swarm body falls to it, losing all its health, which its sentence says
//     with the 3 it was dealt; a splitter left with 2 or more health splits); and, if it still stands,
//     staggered for STAGGER_TURNS (cause perk single_file), so it loses its next action
//     (§8.1's timing rule), and only that one.
'use strict';
(() => {
  const ID = 'single_file';
  const DOORWAY = [',', "'"];
  // The uids this perk has counted this visit (dept.perk.filed), [] while absent.
  const filed = state => state.dept && state.dept.perk && Array.isArray(state.dept.perk.filed) ? state.dept.perk.filed : [];
  function file(state, uid) {
    if (!state.dept.perk) state.dept.perk = {};
    state.dept.perk.filed = filed(state).concat([uid]);
  }
  // Did a's step from `from` bring a tile of it onto a doorway beside you?
  function into(state, a, from) {
    const you = state.actors[0], s = a.size || 1;
    for (const [x, y] of Actors.footprint(a)) {
      if (x >= from[0] && y >= from[1] && x < from[0] + s && y < from[1] + s) continue;
      if (DOORWAY.includes(Grid.ch(state.dept, x, y)) && Grid.chebyshev(x, y, you.x, you.y) === 1) return true;
    }
    return false;
  }
  Perks.add(ID, {
    afterStep(state, a, from, ev, rank) {
      const you = state.actors[0];
      if (state.over || !you || you.gone || !a || a === you || a.gone) return;
      if (filed(state).includes(a.uid) || !into(state, a, from)) return;
      file(state, a.uid);
      Causes.emit(state, ev, 'perk', { id: ID, rank }, { k: ID, who: a.uid });
      if (rank >= 2) Combat.hurt(state, a, N.PERK_SINGLE_FILE_DMG, { k: 'perk', id: ID, raw: N.PERK_SINGLE_FILE_DMG }, ev);
      if (!a.gone) Status.apply(state, a, 'staggered', N.STAGGER_TURNS, { k: 'perk', id: ID }, ev);
    },
  });
})();
