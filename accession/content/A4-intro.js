// ACCESSION — A.4's Intro stamp, "The Office Counter" (design/samples.md §4.4; BUILD.md §5.2,
// §5.5): the pack's `intro` part, {map, legend, stretch, cut, invariants}, which the generator
// writes into every A.4 plan's Intro (layout version 3) and population reads for its exhibits.
// It teaches the signature module only, copies_weaken: one original Seated Clerk on the
// visitors' side of the counter, and its two Certified Spares behind it.
//
//   col 0         1–10                                   11         12–14
//   the entrance  the visitors' side: the forms hall,    the        the staff
//                 and the aisle at 10                    counter    side
//
// - The forms hall is rows of writing desks (low furniture, f, columns 2–6) with one-tile lanes
//   between them; the visitors' side holds the safe zone (walk 8 or less) and no exhibit. The
//   desks leave column 7 free, the Intro's middle, so the tour's way through it (L_tour) is
//   only about 3 tiles longer than the fixture stamp's.
// - The counter (low furniture, f, column 11) runs wall to wall; its one gap, on the entrance
//   row, is the cut (the legend's ':', floor). The counter is glass to the eye: you see the spares
//   across it before you reach the gap.
// - The original (A4.1, 'O'), free-standing, not in a case, sits at the far end of a one-tile
//   aisle between a row of desks (column 9) and the counter, on the visitors' side, at walk 13;
//   the aisle opens to the south only. Breaking it first is the lesson: its spares then lose
//   heart. Waking it calls them (ally_hit), and they come to you single file down the aisle.
// - The two spares (A4.1a, 'a'), dormant behind the counter, flank the gap's one step east, at
//   walk 13: a visitor who walks straight through the gap meets both at full strength.
// - Every exhibit is at walk 12 or more, so no waking ring of theirs reaches the safe zone; the
//   group, one original and two spares, is one copy-group instance (clerks@intro), within
//   COPY_GROUP (Populate.check counts a stamp's marks as it counts a gallery's).
// - The furniture is all glass to the eye and the lanes and the aisle are narrow, as the case
//   labyrinth's own rooms are (at least 75% of its blockers glass, at least 15% of its floor
//   narrow; test/m4-intro.test.js holds the stamp to those shares).
// - The entrance row east of the cut holds nothing opaque, and the tiles against the walls from
//   column 12 on are floor, so the onward openings can be made there.
// - Rows 0 and 10 stretch to the Intro's height (6 rows north of the entrance and 4 south in the
//   labyrinth); no exhibit stands on a stretch row (Populate.check refuses one).
// - near('a', 2): every walk from the entrance to an onward opening passes within 2 tiles of a
//   spare (it passes the gap, 2 tiles from each), which LV4 checks on every plan.
// The sample's counter was "climbed in 2 turns", a rule the slice lacks: here it is low
// furniture, which no one walks over, with a gap.
// Owned by D-STAMPS (then D-PACKS).
'use strict';
Packs.part('A4', 'intro', {
  map: [
    '#........f.f...',
    '#.fffff..f.f...',
    '#........fOf...',
    '#.fffff..f.f...',
    '#........f.f...',
    '#.fffff....f.a.',
    'E..........:...',
    '#.fffff....f.a.',
    '#..........f...',
    '#.fffff....f...',
    '#..........f...',
  ],
  legend: {
    O: { sp: 'A4.1' },
    a: { sp: 'A4.1a' },
    ':': { tile: '.' },
  },
  stretch: [0, 10],
  cut: ':',
  invariants: [{ near: 'a', k: 2 }],
});
