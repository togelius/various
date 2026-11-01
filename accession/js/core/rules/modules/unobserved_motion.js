// ACCESSION — the module unobserved_motion (S.9; BUILD.md §5.4): "The animals move only when you
// cannot see them." Its rule is registered here with Modules.define (rules/modules.js); its
// archetype, rules/arch/unobserved_mover.js (the Grazer), asks it through its hooks; its
// entries are in js/core/reg/mod-unobserved.js and its sentences in js/core/text/mod-unobserved.js.
// Owned by MOD-UNOBSERVED.
//
// The rule (§5.4: "Unobserved" is defined once), as the Grazer's line says it ("Moves
// {UNOBSERVED_STEP} tiles a turn, but only while you cannot see it (it takes no step in your
// sight, and stops for the turn once a step brings it into view), and strikes from beside you
// for {dmg}."), for an exhibit the module acts on: one flagged with it (its species' flags),
// while the module is on, and awake (any mode but asleep; asleep, nothing acts):
//   - Seen. It is seen (Vision.observed, W0d1's one definition) while a tile of it is in your
//     line of sight within SIGHT_PLAYER, which is what the board draws, or, while you wear a
//     lit Lamp, within Kit.observing's disc of you, even behind a wall. A sight-blocking
//     surface (a Fumigant cloud, plaster dust) breaks your line of sight as a wall does.
//   - The gate. It checks before each step: no step, and no door opened as a step, is begun
//     while you can see it (mayStep, which every walk of AI asks). In your sight it only
//     strikes you from beside you (hunting), or loses you (hunting, not seeing you for
//     LOSE_TRACK_TURNS), or settles back to sleep at home (reinstalling): what it does that is
//     not a walk. What would set it walking home (an idle spell, a search done, being moved off
//     its home) waits until you cannot see it, since going home is a walk; its turns are still
//     counted (each mode counts from its stim). Then it waits for the rest of the turn.
//   - The pace. Out of your sight it walks as a plodder does (AI.byMode: after you, to look,
//     to wander, home), but each step costs TICKS_PER_TURN ÷ UNOBSERVED_STEP ticks, rounded up
//     (costPct), so it takes at most UNOBSERVED_STEP steps in any one turn, each begun only
//     while you cannot see it.
//   - Into view. A step that ends with it in your sight stops it for the turn: its next action
//     comes no sooner than the next turn boundary (a.notBefore).
//   - The stride. Each step it takes is told by a module event, rule `stride` {who, n: 1},
//     made after the step. Its kind is logged only when its exhibit is in view (Text.log's
//     'seen'), so the log tells a stride only when the mover ends your step in view, and the
//     strides of one mover in one step are told in one line ("… moved 2 tiles while you could
//     not see it."). An event that named no mover would have no sentence (W0a).
// With the module off (rulesOff), or for an exhibit not flagged with it, none of this
// happens: the Grazer walks a tile a turn, as a plodder does (its archetype's clause).
//
// Bespoke (plan A7, MO18; the validation log, Modules.bespoke): all of it. The gate, the pace
// and the stop are a mover's walk, not an effect on an event: a `move` effect is a step the
// rule adds, costing nothing, at an event or a boundary, and cannot keep an exhibit from its
// own steps; so the module has no form rules, and its stride is told from its own code.
//
// UnobservedMotion, for the archetype, the view model and the tests:
//   UnobservedMotion.moves(state, a) → bool      does the module act on a now (on, flagged,
//                                                awake)
//   UnobservedMotion.seen(state, a) → bool       is a seen now (Vision.observed)
//   UnobservedMotion.stepPct() → int             a step's cost while it acts, % of COST_STEP
//   UnobservedMotion.act(state, a, ev) → ticks | null   its action while the module acts on
//                                                it (null otherwise: AI.byMode acts)
//   UnobservedMotion.mayStep(state, a) → bool    may a begin a step now
//   UnobservedMotion.costPct(state, a, kind) → int %   what its steps cost
'use strict';
const UnobservedMotion = (() => {
  const ID = 'unobserved_motion';

  // Does the module act on a now: an exhibit present and awake, flagged with it, the module on.
  const moves = (state, a) => !!a && a.uid !== 'you' && !a.gone && a.mode !== 'dormant' && Modules.flagged(state, a, ID);
  const seen = (state, a) => Vision.observed(state, a);
  // A step's cost while the module acts: TICKS_PER_TURN ÷ UNOBSERVED_STEP ticks, rounded up, as
  // a share of COST_STEP, rounded up, so that no more than UNOBSERVED_STEP steps begin in a turn.
  const stepPct = () => Int.ceilDiv(N.TICKS_PER_TURN * 100, N.UNOBSERVED_STEP * N.COST_STEP);
  // The tick of the next turn boundary: "for the turn" ends there.
  const turnEnd = state => (state.turn + 1) * N.TICKS_PER_TURN;

  // In your sight: no step. Hunting, it may strike you from beside you, or lose you; at home
  // and reinstalling, it may settle back to sleep (AI.byMode, every step refused by mayStep).
  // Anything else would set it walking (going home), which waits until you cannot see it. It
  // stops for the turn: a blow costs what a blow costs, else it waits until the turn is up.
  function stand(state, a, ev) {
    let c = null;
    if (a.mode === 'hunting' || (a.mode === 'reinstalling' && AI.atHome(a))) {
      const n0 = ev.length, r = AI.byMode(state, a, ev);
      if (ev.slice(n0).some(e => e.k === 'attacked' && e.by === a.uid)) c = r;
    }
    a.notBefore = turnEnd(state);
    return c !== null ? c : turnEnd(state) - state.tick;
  }

  // Its action while the module acts on it: in your sight it stands; out of it, it walks as a
  // plodder does, each step at its pace; a step it took is told (stride), and a step that ends
  // in your sight stops it for the turn. In an intact case it only waits, as any exhibit does
  // (AI.byMode), so the module leaves it to that.
  function act(state, a, ev) {
    if (!moves(state, a) || Cases.encased(state, a)) return null;
    if (seen(state, a)) return stand(state, a, ev);
    const x = a.x, y = a.y, c = AI.byMode(state, a, ev);
    if (a.x !== x || a.y !== y) {
      Causes.emit(state, ev, 'module', { id: ID, rule: 'stride', who: a.uid, n: 1 }, { k: ID });
      if (seen(state, a)) a.notBefore = turnEnd(state);
    }
    return c;
  }
  // The gate: no step begun while you can see it.
  const mayStep = (state, a) => !(moves(state, a) && seen(state, a));
  // The pace: its steps cost stepPct while the module acts on it.
  const costPct = (state, a, kind) => kind === 'move' && moves(state, a) ? stepPct() : 100;

  Modules.define(ID, {
    rules: [],
    bespoke: ['UnobservedMotion.act', 'UnobservedMotion.mayStep', 'UnobservedMotion.costPct'],
  });

  return { ID, moves, seen, stepPct, act, mayStep, costPct };
})();
