// ACCESSION — the Intro's stamp (BUILD.md §5.2, §5.5; design/layout.md §11): writing a pack's
// Intro stamp into the Intro at layout version 3, and the shape of plan.intro, which the
// generator gives and population reads. M4's skeleton fixed the shape, so the generator
// (D-INTRO-GEN, which fills this file) and population (D-POP, which tests on fixture plans)
// agree without waiting on each other.
//
// plan.intro is null where no stamp lies, or:
//   { x0, y0, x1, y1,      the Intro's floor rectangle, inclusive, in plan tiles;
//     cut: [[x, y]…],      zone Z of LV4's cut(Z): every walk from the entrance to an onward
//                          opening crosses one of these tiles (the stamp's cut), inside the
//                          rectangle; at least one;
//     marks: [{ch, x, y}…], each tile whose stamp letter the pack's legend names (an
//                          exhibit, a case, an item or a tile), ch that letter, inside the
//                          rectangle;
//     openings: [[x, y]…] } the Intro's onward openings (its doorways and archways into
//                          other rooms, the entrance left out), each on the wall ring one
//                          tile outside the rectangle, at walk INTRO_DEPTH or more from the
//                          entrance (LV4 checks the walk; the shape cannot);
// every list in row-major order (y, then x), with no tile twice. Plain data.
'use strict';
const LStamp = (() => {
  const isInt = Number.isInteger;
  const isTile = t => Array.isArray(t) && t.length === 2 && isInt(t[0]) && isInt(t[1]);
  const before = (p, q) => p[1] < q[1] || (p[1] === q[1] && p[0] < q[0]);

  // LStamp.shape(intro) → null if intro has plan.intro's shape (null included), else the
  // first thing wrong, as a sentence.
  function shape(intro) {
    if (intro === null) return null;
    if (!intro || typeof intro !== 'object' || Array.isArray(intro)) return 'plan.intro is not an object or null';
    const keys = Object.keys(intro).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (keys.join() !== 'cut,marks,openings,x0,x1,y0,y1') return `plan.intro has the fields ${keys.join(', ')}, not x0, y0, x1, y1, cut, marks and openings`;
    const { x0, y0, x1, y1 } = intro;
    if (![x0, y0, x1, y1].every(isInt) || x0 > x1 || y0 > y1) return `plan.intro's rectangle ${JSON.stringify([x0, y0, x1, y1])} is not x0 ≤ x1, y0 ≤ y1 in whole tiles`;
    const inside = ([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const ring = ([x, y]) => !inside([x, y]) && x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1;
    const list = (name, ts, where, what) => {
      if (!Array.isArray(ts)) return `plan.intro.${name} is not a list`;
      for (let i = 0; i < ts.length; i++) {
        if (!isTile(ts[i])) return `plan.intro.${name}[${i}] is not a tile [x, y]`;
        if (!where(ts[i])) return `plan.intro.${name}[${i}] ${JSON.stringify(ts[i])} is not ${what}`;
        if (i > 0 && !before(ts[i - 1], ts[i])) return `plan.intro.${name} is not in row-major order, with no tile twice, at ${i}`;
      }
      return null;
    };
    const cut = list('cut', intro.cut, inside, 'inside the Intro');
    if (cut) return cut;
    if (!intro.cut.length) return 'plan.intro.cut is empty';
    if (!Array.isArray(intro.marks)) return 'plan.intro.marks is not a list';
    for (let i = 0; i < intro.marks.length; i++) {
      const m = intro.marks[i];
      if (!m || typeof m !== 'object' || Object.keys(m).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join() !== 'ch,x,y') return `plan.intro.marks[${i}] is not {ch, x, y}`;
      if (typeof m.ch !== 'string' || m.ch.length !== 1) return `plan.intro.marks[${i}].ch is not one letter`;
    }
    const marks = list('marks', intro.marks.map(m => [m.x, m.y]), inside, 'inside the Intro');
    if (marks) return marks;
    return list('openings', intro.openings, ring, 'on the wall ring round the Intro');
  }

  // D-INTRO-GEN fills: writing a pack's stamp into the Intro (stretch rows, partitions wall to
  // wall, the Intro tagged stamped), and plan.intro from it.
  return { shape };
})();
