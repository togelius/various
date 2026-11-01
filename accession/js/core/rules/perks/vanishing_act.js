// ACCESSION — Vanishing Act, a Guarded perk (BUILD.md §8.7): "A hunter that loses sight of you
// skips its 8 turns and searches at once; at rank 2 it also loses its next action." Its rules
// register here with Perks.add (rules/perks.js); its entry and clause are in
// js/core/reg/perks-a.js and its sentences in js/core/text/perks-a.js. Losing an action is the
// status staggered (js/core/reg/perk-status.js). Owned by PG-PERKS-A.
//
// The rule, at either rank: a hunter that would wait LOSE_TRACK_TURNS out of sight of you
// before it searches (§8.2's hunt, AI.loseTrackTurns: every exhibit that hunts by its mode,
// and the healer's wait, which counts the same turns) waits none: at its first action at which
// it does not see you it searches where it last knew you were, and its `lost` event has the
// cause `vanished` (rules/ai.js). The Night Watchman is never touched: it never searches
// (§8.4: it always knows where you are), so this hook says nothing of it, and its own action
// never asks (rules/arch/night_watchman.js). An exhibit in an intact case changes mode as any
// other does but only waits there (§8.3), so its `lost` says it stays in its case.
// At rank 2, once that hunter has begun to search (Perks.onLoseTrack), it is also staggered
// for STAGGER_TURNS turns (cause perk, vanishing_act), from its next decision (§8.1's timing
// rule), so it loses its next action: it only waits then (Status.skips, AI.act).
'use strict';
(() => {
  const ID = 'vanishing_act';
  // Every hunter but the Night Watchman, which never searches.
  const touches = a => !!a && a.uid !== 'you' && a.arch !== 'night_watchman';
  Perks.add(ID, {
    loseTrack: (state, a, rank) => touches(a) ? 0 : null,
    onLoseTrack(state, a, ev, rank) {
      if (rank < 2 || !touches(a) || a.gone || a.mode !== 'searching') return;
      Status.apply(state, a, 'staggered', N.STAGGER_TURNS, { k: 'perk', id: ID }, ev);
    },
  });
})();
