// ACCESSION — the demonstrator archetype's hooks (M.11's stations; BUILD.md §5.1, §5.3, §5.4,
// §8.2; rules/archetypes.js), owned by MOD-CHIME. Its registry entry is in
// js/core/reg/mod-chime.js and its sentences in js/core/text/mod-chime.js; what it does on the
// chime is the module's, js/core/rules/modules/hourly_demonstration.js.
//
// The rule, as its line says it ("Stands fixed on its tile, never hunts you and has no blow."):
//   - It never steps (mayStep: false, so neither a rule nor the Window Pole moves it) and never
//     strikes: whatever it is doing, its own action is a wait (act). Its pending line, if it
//     has one, waits for its boundary as every due line does (AI.act, §8.1).
//   - It never hunts (huntsOnSight: false). Seeing you, it only knows where you are; and
//     wherever another exhibit would start to hunt (your ring, a blow, a bell), it goes awake
//     instead (Wake.wake and Wake.setMode, §8.2), stands on its tile and still acts only on the
//     chime. Awake, it may mark its line (marksAwake: true): the module marks it at its chime.
//   - Its line runs from its tile along route.dir (N, E, S or W): population's, the longest
//     straight run of its room that sight passes (§5.5); one placed with none (a room for
//     tests) takes the same rule here (init), with no draw.
//   - Its wake region (plan A8): besides the ring's (Archetypes.wakeRegion's default), every
//     tile a line of its could take (HourlyDemonstration.reach, and the tiles of a line it has
//     marked) when one goes off within the turns asked: standing there that long, its line
//     would strike you.
'use strict';
(() => {
  const DIRS = ['N', 'E', 'S', 'W'], STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const roomAt = (m, x, y) => Array.isArray(m.roomOf) && m.roomOf.length && m.roomOf[y] ? m.roomOf[y][x] : null;
  // The longest straight run, N, E, S or W, of a's room that sight passes (the first on a tie).
  function longest(state, a) {
    const m = state.dept, room = roomAt(m, a.x, a.y);
    let best = null, most = -1;
    for (const dir of DIRS) {
      const [dx, dy] = STEP[dir];
      let n = 0, x = a.x + dx, y = a.y + dy;
      while (Grid.inside(m, x, y) && (room === null || roomAt(m, x, y) === room) && Grid.seeThrough(m, x, y)) { n++; x += dx; y += dy; }
      if (n > most) { most = n; best = dir; }
    }
    return best;
  }

  function init(state, a) {
    if (!a.route || !DIRS.includes(a.route.dir)) a.route = { dir: longest(state, a) };
  }
  const act = (state, a, ev) => AI.wait(state, a, ev);
  const mayStep = () => false;
  const huntsOnSight = () => false;
  const marksAwake = () => true;

  function wakeRegion(state, a, turns) {
    if (!HourlyDemonstration.strikesWithin(state, a, turns)) return [];
    const out = HourlyDemonstration.reach(state, a);
    if (a.telegraph && a.telegraph.sp === 'demo_line') for (const t of a.telegraph.tiles) out.push([t[0], t[1]]);
    return out;
  }

  Archetypes.add('demonstrator', { init, act, mayStep, huntsOnSight, marksAwake, wakeRegion });
})();
