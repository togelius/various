// ACCESSION — the monkey: random legal actions (Step.legal) chosen on its own seeded
// stream, for soak and cross-engine hash runs and the sim battery (BUILD.md §3.5, §10.1,
// §10.3). Loaded by tests, the battery (tools/battery.js) and the hash page; it obeys the
// core's lint (§3.3), since it runs beside the core in the hardened context and, unhardened,
// on the hash page.
//
// Every action kind a player has can be drawn: each step it draws a kind among those that
// are legal now, weighted (WEIGHTS: mostly moves, as a player's are, then blows, waits and
// the rest), then one legal action of that kind, every one equally likely. A kind with no
// legal action is never drawn, so a pending choice (only `choose` legal) is always chosen.
'use strict';
const Monkey = (() => {
  // The weight of each action kind (Actions.ORDER), out of the weights of the kinds legal
  // now. A kind missing here weighs 1.
  const WEIGHTS = Object.freeze({
    wait: 8, rest: 2, sit: 2, move: 50, attack: 12, close: 2, open: 4, bash: 4, push: 1, take: 4, drop: 1, equip: 2,
    unequip: 1, use: 3, throw: 2, read: 2, view: 1, choose: 1, leave: 1,
  });
  const weightOf = (weights, k) => {
    const w = weights && Object.prototype.hasOwnProperty.call(weights, k) ? weights[k] : Object.prototype.hasOwnProperty.call(WEIGHTS, k) ? WEIGHTS[k] : 1;
    return Number.isInteger(w) && w > 0 ? w : 0;
  };

  // choose(state, r, weights?, seen?) → one legal action, drawn on the stream r: a kind among
  // the legal ones by its weight (weights overrides WEIGHTS kind by kind; 0 never draws it),
  // then one action of that kind. Kinds are taken in Step.legal's order (Actions.ORDER), so
  // the draw is the same on every engine. With nothing to draw it waits. seen, if given, counts
  // each kind that was legal ({kind: steps}), for the battery's tally.
  function choose(state, r, weights, seen) {
    const legal = Step.legal(state), kinds = [], groups = [], w = [];
    for (const l of legal) {
      let i = kinds.indexOf(l.a);
      if (i < 0) { i = kinds.length; kinds.push(l.a); groups.push([]); w.push(weightOf(weights, l.a)); }
      groups[i].push(l);
    }
    if (seen) for (const k of kinds) seen[k] = (seen[k] || 0) + 1;
    let total = 0;
    for (const x of w) total += x;
    if (!total) return { a: 'wait' };
    return r.pick(groups[r.weighted(w)]);
  }

  // The monkey's own stream for a run seed, on a holder of its own (never in the state).
  const stream = seed => Rng.stream({ seed: seed, rng: {} }, 'monkey');
  // Is a visit done for the monkey: over (you died or left), or every exhibit gone?
  const ended = state => !!state.over || state.actors.every(a => a.gone || a.uid === 'you');

  // Plays `count` actions. When a visit ends (you die or leave, or the room is cleared), a
  // new one starts on the next seed. Returns a hash folded over every finished visit and every
  // checkpoint. opts.make(seed) makes a visit (the test room by default); opts.cloneEachStep
  // replaces the state with State.clone after every step; opts.check(state, i) is called after
  // every step; opts.weights changes the weights of action kinds (choose).
  function run(seed, count, opts) {
    opts = opts || {};
    const make = opts.make || (s => TestRoom.create(s));
    const r = stream(seed);
    let state = make(seed), visit = 0, fold = 0x811c9dc5;
    const checkpoints = [];
    const mix = h => { fold = State.fnv1a(fold + ':' + h); };
    for (let i = 1; i <= count; i++) {
      Step.step(state, choose(state, r, opts.weights));
      if (opts.cloneEachStep) state = State.clone(state);
      if (opts.check) opts.check(state, i);
      if (ended(state)) { mix(State.hash(state)); visit++; state = make(seed + visit); }
      if (i % 1000 === 0) { mix(State.hash(state)); checkpoints.push(fold); }
    }
    mix(State.hash(state));
    return { hash: fold, checkpoints, visits: visit };
  }
  return { WEIGHTS, choose, stream, ended, run };
})();
