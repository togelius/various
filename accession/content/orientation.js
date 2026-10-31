// ACCESSION — the Orientation (BUILD.md §8.9): one practice room, the same every time, built
// by Setup.room with the game's real rules and nothing else. You come in at the west
// entrance; one Logbook Trolley (M.11's fodder, a real species with a short, plain Behaviour
// line) sleeps in the room; one case your grade opens holds the Linesman's Smoked Apron
// (M.11's garment, which needs no identifying); the exit door is on the east wall. There is
// no clock, so no bell and no night watch can come, and pips always fade (§8.2). Fixed seed,
// depth 1, grade I, the starting kit. Not a department: js/ui/teacher.js reads `facts` to
// know where everything is, and never the state.
'use strict';
const Orientation = (() => {
  const SEED = 1;
  const MAP = [
    '#############',
    '#...........#',
    '#.......v...#',
    '#...........#',
    'E...........X',
    '#...........#',
    '#...........#',
    '#...........#',
    '#############',
  ];
  const SLEEPER = 'O.1.room.1', ITEM = 'O.1.room.i1', APRON = 'M11.7';
  // Where everything is: you, the sleeper's species and tile, the case, what it holds, and
  // the exit. A copy each time, so nobody can change the room by changing these.
  const facts = () => ({ seed: SEED, start: [1, 4], entrance: [0, 4], sleeper: SLEEPER, species: 'M11.5', at: [6, 6], case: [8, 2], item: ITEM, exit: [12, 4] });

  // The room's spec for Setup.room: the Apron as its pack gives it, tier 1, in the case.
  function spec() {
    const f = facts(), rec = Packs.get('M11').items.find(i => i.id === APRON);
    return {
      acc: 'O', depth: 1, map: MAP.slice(), you: f.start, entrance: f.entrance, exits: [f.exit],
      exhibits: [{ sp: f.species, at: f.at, mode: 'dormant', stats: Roles.stats('fodder', 1), uid: SLEEPER }],
      fixtures: [Cases.make({ x: f.case[0], y: f.case[1], room: 'room', num: 'O.101.1', glass: 1, lock: 1, holds: ITEM })],
      items: [{ uid: ITEM, kind: rec.kind, ref: rec.id, where: { at: 'case', x: f.case[0], y: f.case[1] }, form: rec.form, tier: 1, prims: rec.prims }],
    };
  }
  // The room: always on SEED; options as Setup.room's (tests pass rulesOff, without, …).
  const create = options => Setup.room(SEED, spec(), options);
  return { SEED, facts, spec, create };
})();
