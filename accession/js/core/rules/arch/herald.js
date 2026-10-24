// ACCESSION — the herald archetype's hooks (BUILD.md §5.1, §5.3, §8.1, §8.2; rules/archetypes.js),
// owned by W1-ARCH-C. Its Behaviour-line clause and registry entry are in js/core/reg/arch-c.js.
//
// The rule, as its line says it: each time it wakes, the first time it then sees you it calls.
//   - The call is its special, `call` (a hook: it deals no damage). Marking it shows every tile
//     an exhibit could stand on within HERALD_RANGE of it (Specials.tiles) for a turn; like
//     every mark, it resolves at the herald's next action, after your next decision (§8.1).
//   - When it goes off (onResolve), every sleeping exhibit standing on a marked tile wakes
//     awake, to look at the tile you stand on as the call goes off (cause herald, §8.2). A
//     pipless sleeper (a mimic) is not woken: Wake.wake refuses it. The call makes no noise.
//   - It calls once per waking: ax.called is set when it marks the call, and cleared only when
//     it wakes (onWake), never on other changes of mode (§8.2). A call called off (the herald
//     fixed, no longer hunting, or destroyed) is still its one call.
//   - Otherwise it fights as a plodder (AI.byMode): it strikes from beside you.
// A call neither blocks a damage mark nor is blocked by one (Specials.canMark), and an
// encased herald may still call (sound carries out of a case).
'use strict';
(() => {
  const called = a => !!(a.ax && a.ax.called);

  // It has not called since it was made.
  function init(state, a) {
    if (a.ax.called === undefined) a.ax.called = 0;
  }
  // Waking starts a new waking, with its one call still to make.
  function onWake(state, a) {
    a.ax.called = 0;
  }

  // Its turn, after it has looked for you (AI.look turns a herald that sees you into a hunt):
  // if it has not called since it woke and it sees you, it marks its call; otherwise null,
  // and it acts by its mode.
  function act(state, a, ev) {
    if (called(a) || a.mode !== 'hunting' || !AI.sees(state, a)) return null;
    const tiles = Specials.tiles(state, a, 'call');
    if (!Specials.canMark(state, a, 'call', tiles)) return null;
    a.ax.called = 1;
    return Specials.mark(state, a, 'call', tiles, ev);
  }

  // The call goes off: each sleeping exhibit, in spawn order, any of whose tiles is marked
  // wakes awake to look at your tile now, with the herald's uid and its distance in the cause.
  function onResolve(state, a, tel, ev) {
    if (!tel || tel.sp !== 'call') return;
    const you = state.actors[0], target = [you.x, you.y];
    const marked = (x, y) => tel.tiles.some(t => t[0] === x && t[1] === y);
    for (let i = 1; i < state.actors.length; i++) {
      const b = state.actors[i];
      if (b === a || b.gone || b.mode !== 'dormant') continue;
      if (!Actors.footprint(b).some(([x, y]) => marked(x, y))) continue;
      Wake.wake(state, b, 'awake', { k: 'herald', by: a.uid, dist: Actors.between(a, b), x: target[0], y: target[1] }, ev, { target });
    }
  }

  Archetypes.add('herald', { init, onWake, act, onResolve });
})();
