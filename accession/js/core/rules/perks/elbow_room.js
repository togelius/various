// ACCESSION — Elbow Room, a Swarm perk (BUILD.md §8.7): "+3 Padding while 3 or more enemies are
// adjacent; +5 at rank 2." Its rules register here with Perks.add (rules/perks.js); its entry and
// clause are in js/core/reg/perks-b.js and its sentences in js/core/text/perks-b.js. Owned by
// PG-PERKS-B.
//
// The rule (PR4, M4 plan D4.5: "counted when you act"): while PERK_ELBOW_ROOM_ADJACENT or more
// exhibits stand beside you (a tile of each within a king's move of yours), each present, not
// asleep (any mode but dormant) and in no intact case (Cases.encased: so a mimic in its
// disguise, asleep in its case, never counts and is never given away), you have
// PERK_ELBOW_ROOM[rank − 1] more Padding. A body of several tiles is one exhibit, however many
// of its tiles are beside you. The count is your perks' Padding (Perks.padding), which
// Kit.derive adds last to your Padding, and Kit.settle writes your stats only at the end of
// each step, once the world has run to your next decision: so the exhibits are counted where
// they and you stand as you choose each action, and the Padding they give holds through that
// action and the world's turn after it, until your next. Every blow, shot and special that
// reaches you between two of your decisions meets the same Padding, so a mark's number on the
// floor and the odds readout's figures (which read your settled Padding, §8.1) are what they
// deal.
'use strict';
(() => {
  const ID = 'elbow_room';
  // Does exhibit a count: present, not asleep, in no intact case, a tile of it beside you.
  const counts = (state, you, a) => a !== you && !a.gone && a.mode !== 'dormant' && Actors.dist(a, you.x, you.y) === 1 && !Cases.encased(state, a);
  function beside(state) {
    const you = state.actors[0];
    let n = 0;
    for (let i = 1; i < state.actors.length; i++) if (counts(state, you, state.actors[i])) n++;
    return n;
  }
  Perks.add(ID, {
    padding(state, rank) {
      const you = state.actors[0];
      if (!you || you.gone) return 0;
      return beside(state) >= N.PERK_ELBOW_ROOM_ADJACENT ? N.PERK_ELBOW_ROOM[rank - 1] : 0;
    },
  });
})();
