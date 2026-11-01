// ACCESSION — M.11's Intro stamp, "The First Landing" (design/samples.md §2.4; BUILD.md §5.2,
// §5.5): the pack's `intro` part, {map, legend, stretch, cut, invariants}, which the generator
// writes into every M.11 plan's Intro (layout version 3) and population reads for its exhibits.
// It teaches the signature module only, hourly_demonstration: a short enfilade of two rooms
// whose one door opens onto a Semaphore Station's line.
//
//   col 0         1–7              8                  9            10–14
//   the entrance  the first room   partition, door    the line     the second room
//
// - The first room (columns 1–7) is the safe zone: every tile of it is within SAFE_ZONE walking
//   tiles of the entrance, and the partition, wall to wall with its one door on the entrance row
//   (the cut, column 8), hides it from everything east of it while the door is shut. Low cabinets
//   of timetables (f) line its north and south walls, and a bench stands in it.
// - The station (M11.2, 's') stands in column 9, two rows north of the entrance row, at walk 11,
//   and its line runs south (dir S) down column 9 to the Intro's south wall. It stays in the
//   Intro, and every tile of it is at walk 9 or more, east of the safe zone. The door's only step
//   east is onto the line (its neighbours north and south are partition, so no diagonal passes
//   them), so every way onward crosses the line: you wait in the doorway for the exchange, then
//   cross.
// - The Logbook Trolley (M11.5, 't'), at walk 12, follows you, and may step into the line at the
//   wrong moment and take it instead.
// - Every tile east of the partition is at walk 9 or more and hidden from the safe zone by it, so
//   no exhibit's waking ring reaches the safe zone.
// - The cabinets are glass to the eye and the partition is not, so the Intro's blockers are about
//   half glass, as the enfilade's own rooms are (40–85%; test/m4-intro.test.js holds the stamp to
//   that share).
// - The entrance row east of the cut holds nothing opaque (the vista along the axis), and the
//   tiles against the walls from column 12 on are floor, so the onward openings can be made there.
// - Rows 1 and 12, plain, stretch to the Intro's height (3 or 4 rows north of the entrance and 9
//   or 10 south in the enfilade); no exhibit stands on a stretch row (Populate.check refuses one).
// - near('s', 2): every walk from the entrance to an onward opening passes within 2 tiles of the
//   station (it passes the door), which LV4 checks on every plan.
// Owned by D-STAMPS (then D-PACKS).
'use strict';
Packs.part('M11', 'intro', {
  map: [
    '#fffffff|......',
    '#.......|......',
    '#.......|s.....',
    '#.......|......',
    'E.......+......',
    '#.......|......',
    '#..b....|...t..',
    '#.......|......',
    '#.......|......',
    '#.......|......',
    '#.......|......',
    '#.......|......',
    '#.......|......',
    '#fffffff|......',
  ],
  legend: {
    s: { sp: 'M11.2', dir: 'S' },
    t: { sp: 'M11.5' },
  },
  stretch: [1, 12],
  cut: '+',
  invariants: [{ near: 's', k: 2 }],
});
