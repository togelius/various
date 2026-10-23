// ACCESSION — the monkey: random legal actions (Step.legal) chosen on its own seeded
// stream, for soak and cross-engine hash runs (BUILD.md §3.5, §10.1). Loaded by tests and
// the hash page.
'use strict';
const Monkey = (() => {
  // Plays `count` actions. When a visit ends (you die, or the room is cleared), a new one
  // starts on the next seed. Returns a hash folded over every finished visit and every
  // checkpoint. opts.cloneEachStep replaces the state with State.clone after every step.
  function run(seed, count, opts) {
    opts = opts || {};
    const make = opts.make || (s => TestRoom.create(s));
    const pick = { seed: seed, rng: {} };
    const r = Rng.stream(pick, 'monkey');
    let state = make(seed), visit = 0, fold = 0x811c9dc5;
    const checkpoints = [];
    const mix = h => { fold = State.fnv1a(fold + ':' + h); };
    for (let i = 1; i <= count; i++) {
      const legal = Step.legal(state);
      // Mostly moves, as a player's are; waits and attacks often enough to matter.
      const roll = r.int(0, 99), moves = legal.filter(a => a.a === 'move'), attacks = legal.filter(a => a.a === 'attack');
      const action = roll < 15 || !moves.length ? { a: 'wait' } : roll < 25 && attacks.length ? r.pick(attacks) : r.pick(moves);
      Step.step(state, action);
      if (opts.cloneEachStep) state = State.clone(state);
      if (opts.check) opts.check(state, i);
      const cleared = state.actors.every(a => a.gone || a.uid === 'you');
      if (state.over || cleared) { mix(State.hash(state)); visit++; state = make(seed + visit); }
      if (i % 1000 === 0) { mix(State.hash(state)); checkpoints.push(fold); }
    }
    mix(State.hash(state));
    return { hash: fold, checkpoints, visits: visit };
  }
  return { run };
})();
