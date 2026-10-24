// ACCESSION — the mimic_vitrine archetype's hooks (BUILD.md §5.1, §5.3, §8.2, §8.3;
// rules/archetypes.js), owned by W1-ARCH-C. Its Behaviour-line clause and registry entry are
// in js/core/reg/arch-c.js.
//
// The rule, as its line says it:
//   - Its disguise. Made asleep on a floor tile, it becomes a case there (Cases.disguise, at
//     init): a case fixture drawn as a real case's is, on its own ai stream, with no accession
//     number, its one tell; its tile becomes a vitrine. While its case is shut it is
//     disguised: it stands in an intact case, so nothing strikes it or is struck by it but a
//     beam (Combat.canStrike), and it shows itself as a case (present).
//   - It is pipless, always: it gains no pips and hears nothing, and only its case opened or
//     bashed, a blow (a beam, while it is a case) or Solvent wakes it (Wake.wake, §8.2). So its
//     line's "Wakes only when it is opened, bashed, dissolved or struck" holds after it has
//     shown itself too, should it ever sleep again.
//   - Touched (its case opened or bashed: Cases.touch calls onTouched, before the noise of the
//     open or bash, §8.2), it shows itself (Cases.reveal: its case `revealed`, the floor back),
//     wakes hunting (touch_case) and grips whoever touched it: rooted for MIMIC_GRIP_TURNS
//     turns (Status.apply, cause grip), which covers your next MIMIC_GRIP_TURNS turns (§8.1).
//     Its first action, after the beat, is a rolled blow (AI.byMode), from beside you.
//   - Woken any other way while disguised (struck by a beam), it shows itself without the
//     grip (onWake). Dissolved (Solvent), its case is already gone, and it hunts silently.
//   - It is slow at everything (its registry speed, with speedApplies covering every action):
//     each step, blow and wait takes twice as long, its beat on waking included.
// ax.gripped: it has gripped once, which it does at most once.
'use strict';
(() => {
  const caseOf = (state, a) => {
    for (const f of (state.dept && state.dept.fixtures) || []) if (f.k === 'case' && f.mimic === a.uid) return f;
    return null;
  };
  // Is it still a case: its case shut, and its tile a vitrine?
  function disguised(state, a) {
    const f = caseOf(state, a);
    return !!f && f.st === 'shut' && Grid.ch(state.dept, f.x, f.y) === 'v';
  }

  // Made asleep, one tile in size, on a floor tile with no fixture, it disguises itself. (A
  // mimic made awake, or anywhere else, is a slow ambusher in plain view.)
  function init(state, a) {
    if (a.mode !== 'dormant' || (a.size || 1) !== 1 || Grid.ch(state.dept, a.x, a.y) !== '.' || Cases.at(state, a.x, a.y)) return;
    Cases.disguise(state, a);
  }

  const pipless = (state, a) => true;
  const present = (state, a) => disguised(state, a) ? { as: 'case' } : null;
  const speedApplies = a => ['move', 'act'];

  // Woken while still a case (by a blow), it shows itself.
  function onWake(state, a) {
    if (disguised(state, a)) Cases.reveal(state, a);
  }

  // Its case is opened or bashed (how) by `by`: it shows itself, wakes hunting, and grips
  // whoever touched it. Once it has shown itself, or gripped, a touch does nothing more.
  function onTouched(state, a, how, by, ev) {
    const f = caseOf(state, a);
    if (a.gone || !f || f.st === 'revealed' || a.ax.gripped) return;
    if (f.st === 'shut') Cases.reveal(state, a);
    const who = (typeof by === 'string' && Actors.byUid(state, by)) || state.actors[0];
    if (a.mode === 'dormant') {
      const cause = { k: 'touch_case', by: who.uid, dist: Actors.between(a, who) };
      if (typeof how === 'string') cause.how = how;
      Wake.wake(state, a, 'hunting', cause, ev);
    }
    a.ax.gripped = 1;
    if (!who.gone) Status.apply(state, who, 'rooted', N.MIMIC_GRIP_TURNS, { k: 'grip', by: a.uid }, ev);
  }

  Archetypes.add('mimic_vitrine', { init, pipless, present, speedApplies, onWake, onTouched });
})();
