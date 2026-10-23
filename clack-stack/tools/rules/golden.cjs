'use strict';
// The golden cases of DESIGN §18.9 / SPEC §9 (revision 5c: cases 1–16) through rules.js. Each case's last drop is
// checked in the full comparison format (SPEC §8, tips included). The expectations below were worked out by hand from
// SPEC §1–8 (not copied from rules.js), and every earlier drop must fit. `also` adds hand-derived checks: the drop with
// no way given (SPEC §6), how earlier tiles hold, and the game's own form of tips (DESIGN §18.7: the base's index,
// the members' indices, the centre of weight). After the cases, SPEC §6's way choice is checked on made-up pairs of
// results, because on real builds both ways never fit at once (so the "both fit" branch can't be reached through
// drop()), and because "neither fits" has its own rule for TIPS OVER.
// node tools/rules/golden.cjs [--quiet]; exit code 0 when all pass.
const canon = require('../lib/canon.cjs');

const S = (a, b) => [a, b];
// x = col/2; points [X, p, q] with y = (p + q√3)/2; h = √3/2 is [_, 0, 1]
//
// How each expectation was found (by hand):
//  1. ■1 sits on the car at y 0 (X 2..4), its top at 1. ▲1.5 (X 3..5) falls onto that top: its left half (X 3..4) lies
//     on the square's top, its right half is past the car with nothing below, so no gap is measured there. Fit.
//  2. Three ▲ on the car; ▼−1.5 and ▼−0.5 hang in the two notches, points on the car, tops at h over X −3..1. ■−1
//     (X −2..0) lands at h on the two ▼ tops, which meet over ▲−1's apex (−1, h). Fit, two segments, the apex a point
//     on them (left out, SPEC §8).
//  3. ▲−1.5 and ▲−0.5: ■−1 (X −2..0) stops at h on the two apexes (−1, h)·2 = X −2 and X 0, one under each corner;
//     under it are only slants. Off, ONLY A POINT, points at both corners.
//  4. ▲1 (X 2..4, apex X 3). ▼1.5 (X 3..5): its left side meets ▲1's right side whole when its point is at (X 4, 0),
//     the car's end corner (a point on the segment, so not listed). Fit. With no way given: ▲1.5 there would rest on
//     the apex alone, so ▼.
//  5. ▼0 on the bare car: its point on the car at (X 1, 0), no ▲ beside it. Off, ONLY A POINT. With no way given, ▲.
//  6. Two squares (top at 2), ▲−1 on them. ▼−1.5 (X −3..−1): its right side lies on ▲−1's left side, point at the
//     squares' top-left corner (−2, 2). ▲−1.5 sits whole on ▼−1.5's top at 2 + h. ▼−2 (X −4..−2): its right side
//     lies whole on ▲−1.5's left side, point at (X −3, 2 + h), in the air over the car. Fit (the point touches
//     ▼−1.5's top corner, on the segment). With no way given: ▲−2 would rest on ▲−1.5's apex at its corner, so ▼.
//  7. ■−2 (top 1, X −4..−2); ▲−0.5 on the car; ▼−1 (X −2..0) hangs on ▲−0.5's left side, its point on the car, its
//     top at h. ▲−1.5 (X −3..−1) rests at 1: left half on the square's top, right half 1 − h above ▼−1's top. Fit,
//     gap 1 − √3/2 = (2 − √3)/2 → [2, −1].
//  8. ■−1, ■0 (tops at 1); ▲−0.5 (X −1..1) on both. Fit, a segment on each.
//  9. ▲−1 (X −2..0); ▼−0.5 (X −1..1) hangs on its right side, point on the car at X 0, top at h. ▲0 (X 0..2) rests at
//     h: left half on ▼−0.5's top, right half over the bare car, h below. Fit, gap √3/2 → [0, 1].
// 10. ▲0 then ▲0: it rests on the apex (X 1, h), slants under both halves. Off, ONLY A POINT. No way given: ▼0 there
//     would rest its point on the same apex with no side held, so neither fits and ▲ is shown.
// 11. A square at col −1 throws (squares go at even cols only).
// 12. The photo's wall: two squares; ▲−1, ▲0 on them; ▼−0.5 in their notch; ▼−1.5 and ▼0.5 by one side each; a row of
//     ▲ on the ▼ tops at 1 + h; ▼−1, ▼0 in its notches (tops at 1 + 2h); ■−1, ■0 on those. ■0 (X 0..2, y 1 + 2h →
//     [2, 2]): on ▼0's top, beside ■−1 along its left side; the apexes and corners it touches lie on those segments.
//
// The balance (SPEC §5c), by hand. Weights ×4 (a square 4, a triangle √3) and x in half tiles X (a tile's middle at
// X = col + 1); then 8m = 4·Σ■(X − Xend) + √3·Σ▲▼(X − Xend) and the grip L/4 is L2/8 with L2 = 2 × the length rested
// on (a flat contact ΔX, a whole slanted side 2), so a part tips when 8m > L2.
//  6. The part of ▼−1.5 (X −3..−1): it, ▲−1.5 on its top and ▼−2 hung on that. It rests on ▲−1's left side (X −2..−1,
//     L2 2), on the top-left corner of the upper square (point X −2) and, with ▲−1.5's right corner, on ▲−1's apex
//     (point X −1): Xmin −2. Middles: ▼−1.5 −2, ▲−1.5 −2, ▼−2 −3: leans left, 8m = √3·1 ≤ 2. Fits (m = √3/8).
//  9. The part of ▼−0.5: it and ▲0 (its right half over the bare car rests on nothing). Support: ▲−1's right side
//     (X −1..0, L2 2) and its point on the car (X 0): Xmax 0. Middles 0 and 1: 8m = √3 ≤ 2. Fits.
// 13. As before (no balance: it is off with ONLY A POINT). ■−2, ▲−2 on it (apex X −3 at 1 + h); ▲−1 on the car; ▼−0.5
//     on ▲−1's right side, point on the car (top h); ▲−0.5 on that top (apex X 0 at 2h); ▼−1 (X −2..0) on ▲−0.5's left
//     side, point on ▲−1's apex (−1, h), top at 2h. ▲−1.5 (X −3..−1) stops on ▲−2's apex at 1 + h with its left corner:
//     under it a slant and ▼−1's top 0.134 lower, no flat top at its height. Off, ONLY A POINT, the point [−3, 2, 1].
//     No way given: ▼−1.5 would stop with its point on ▼−1's top-left corner at 2h, no side held: neither tips, so ▲.
// 14. ▲−2.5 (X −5..−3) half on the car; ▼−2 on its right side, point on the car at X −3 (top h, X −4..−2); ▲−1.5
//     (X −3..−1) half on that top; ▼−1 (X −2..0) on ▲−1.5's right side, its point (X −1, h) over the bare car. It meets
//     the tower edge to edge (contact [−2,0,2]–[−1,0,1]). Then: ▲−1.5's part (it and ▼−1) rests on ▼−2's top X −3..−2
//     (L2 1): middles −2, −1 past Xmax −2: 8m = √3 > 1, tips. ▼−2's part (▼−2, ▲−1.5, ▼−1): on ▲−2.5's side (L2 2) and
//     the car at X −3: 8m = √3·(0 + 1 + 2) = 3√3 > 2, tips. ▲−2.5's part (all four): on the car X −4..−3 (L2 1) and ▼−2's
//     point on the car (X −3): 8m = √3·(−1 + 0 + 1 + 2) = 2√3 > 1, tips. The lowest failing tiles are ▲−2.5 and ▼−2 (both
//     at 0); the smaller col is ▲−2.5's: base ▲−2.5, members 4, right, pivot the lowest support point at X −3: (−3, 0).
//     Before ▼−1 every part balanced (▼−2's: √3·1 ≤ 2). No way given: ▲−1 would stop on ▲−1.5's apex, so ▼ (it tips).
// 15. ■−2 (X −4..−2, top 1); ▲−1.5 (X −3..−1) half on it; ▼−1 (X −2..0) on ▲−1.5's right side, point (X −1, 1) in the
//     air. ▲−1.5's part (it and ▼−1) rests on the square's top X −3..−2 (L2 1): middles −2, −1 past −2: 8m = √3 > 1. The
//     square's part: on the car X −4..−2 (L2 2), middles −3, −2, −1: 4·(−3 + 2) + √3·(0 + 1) = −4 + √3 < 0 to the right,
//     and to the left 4·(−4 + 3) + √3·(−2 − 3) < 0: no lean. Base ▲−1.5, members 2, right, pivot (−1, 1) = [−2, 2, 0].
//     No way given: ▲−1 would stop on ▲−1.5's apex, so ▼.
// 16. ▲−1 (X −2..0); ▼−0.5 on its right side, point on the car at X 0, top at h; ■0 (X 0..2) half on that top. ▼−0.5's
//     part (it and ■0): ▲−1's side (L2 2) and the car at X 0: 8m = 4·(1 − 0) + √3·0 = 4 > 2, tips. ▲−1's part (all
//     three): the car X −2..0 (L2 2) and the ▼'s point (X 0): 8m = 4·1 + √3·(−1 + 0) = 4 − √3 > 2, tips. Both lowest at 0:
//     the smaller col is ▲−1's. Base ▲−1, members 3, right, pivot (0, 0). Case 9's lighter ▲ there: √3 ≤ 2, it stays.
//     The game's centre of weight: (√3/4·(−½) + √3/4·0 + 1·½)/(1 + √3/2) = 0.1519.
const CASES = [
  { n: 1, drops: ['■1'], last: '▲1.5', title: '▲ half on a square at the car\'s end, half past it',
    caption: 'A triangle with half of its bottom on the square stays: the magnets on half an edge hold it.',
    expect: { outcome: 'fit', way: 'up', verts: [[3, 2, 0], [4, 2, 1], [5, 2, 0]], reason: null,
      contacts: { segments: [S([3, 2, 0], [4, 2, 0])], points: [] }, shine: [S([3, 2, 0], [4, 2, 0])], gap: null },
    also: { auto: { outcome: 'fit', way: 'up', reason: null } } },
  { n: 2, drops: ['▲-2', '▲-1', '▲0', '▼-1.5', '▼-0.5'], last: '■-1', title: 'square across two ▼ tops that meet over a ▲ point',
    caption: 'A square across two upside-down triangles stays: their flat tops meet end to end under it.',
    expect: { outcome: 'fit', way: null, verts: [[-2, 0, 1], [-2, 2, 1], [0, 0, 1], [0, 2, 1]], reason: null,
      contacts: { segments: [S([-2, 0, 1], [-1, 0, 1]), S([-1, 0, 1], [0, 0, 1])], points: [] },
      shine: [S([-2, 0, 1], [-1, 0, 1]), S([-1, 0, 1], [0, 0, 1])], gap: null },
    also: { notch: [3, 4] } },
  { n: 3, drops: ['▲-1.5', '▲-0.5'], last: '■-1', title: 'square bridging two ▲ points at its corners',
    caption: 'A square resting only on the tips of two triangles falls off: it touches at two points, not along an edge.',
    expect: { outcome: 'off', way: null, verts: [[-2, 0, 1], [-2, 2, 1], [0, 0, 1], [0, 2, 1]], reason: 'ONLY A POINT',
      contacts: { segments: [], points: [[-2, 0, 1], [0, 0, 1]] }, shine: [], gap: null } },
  { n: 4, drops: ['▲1'], last: '▼1.5', title: '▼ hung by one side off the end ▲',
    caption: 'An upside-down triangle snaps onto the side of the end triangle and stays, its outer half over the rug.',
    expect: { outcome: 'fit', way: 'down', verts: [[3, 0, 1], [4, 0, 0], [5, 0, 1]], reason: null,
      contacts: { segments: [S([3, 0, 1], [4, 0, 0])], points: [] }, shine: [S([3, 0, 1], [4, 0, 0])], gap: null },
    also: { auto: { outcome: 'fit', way: 'down', reason: null } } },
  { n: 5, drops: [], last: '▼0', title: '▼ standing on its point on the bare car',
    caption: 'An upside-down triangle standing on its point falls off: nothing holds either of its sides.',
    expect: { outcome: 'off', way: 'down', verts: [[0, 0, 1], [1, 0, 0], [2, 0, 1]], reason: 'ONLY A POINT',
      contacts: { segments: [], points: [[1, 0, 0]] }, shine: [], gap: null },
    also: { auto: { outcome: 'fit', way: 'up', reason: null } } },
  { n: 6, drops: ['■-1', '■-1', '▲-1', '▼-1.5', '▲-1.5'], last: '▼-2', title: 'a leaning wall like the photo\'s',
    caption: 'Each upside-down triangle hangs whole on a triangle\'s side, so the wall leans out and stays.',
    expect: { outcome: 'fit', way: 'down', verts: [[-4, 4, 2], [-3, 4, 1], [-2, 4, 2]], reason: null,
      contacts: { segments: [S([-3, 4, 1], [-2, 4, 2])], points: [] }, shine: [S([-3, 4, 1], [-2, 4, 2])], gap: null },
    also: { oneSide: [3], auto: { outcome: 'fit', way: 'down', reason: null } } },
  { n: 7, drops: ['■-2', '▲-0.5', '▼-1'], last: '▲-1.5', title: 'half on a square, half 0.134 above a ▼ top',
    caption: 'A triangle half on a square stays; under its other half is a thin gap (0.134 of a tile), left open.',
    expect: { outcome: 'fit', way: 'up', verts: [[-3, 2, 0], [-2, 2, 1], [-1, 2, 0]], reason: null,
      contacts: { segments: [S([-3, 2, 0], [-2, 2, 0])], points: [] }, shine: [S([-3, 2, 0], [-2, 2, 0])], gap: [2, -1] },
    also: { oneSide: [2], auto: { outcome: 'fit', way: 'up', reason: null } } },
  { n: 8, drops: ['■-1', '■0'], last: '▲-0.5', title: '▲ at a half step across two level squares',
    caption: 'A triangle half a step over, across two squares of the same height, stays.',
    expect: { outcome: 'fit', way: 'up', verts: [[-1, 2, 0], [0, 2, 1], [1, 2, 0]], reason: null,
      contacts: { segments: [S([-1, 2, 0], [0, 2, 0]), S([0, 2, 0], [1, 2, 0])], points: [] },
      shine: [S([-1, 2, 0], [0, 2, 0]), S([0, 2, 0], [1, 2, 0])], gap: null },
    also: { auto: { outcome: 'fit', way: 'up', reason: null } } },
  { n: 9, drops: ['▲-1', '▼-0.5'], last: '▲0', title: '▲ half on a hung ▼\'s top',
    caption: 'A triangle half on the flat top of a hung triangle stays; its other half is over the bare car.',
    expect: { outcome: 'fit', way: 'up', verts: [[0, 0, 1], [1, 0, 2], [2, 0, 1]], reason: null,
      contacts: { segments: [S([0, 0, 1], [1, 0, 1])], points: [] }, shine: [S([0, 0, 1], [1, 0, 1])], gap: [0, 1] },
    also: { oneSide: [1], auto: { outcome: 'fit', way: 'up', reason: null } } },
  { n: 10, drops: ['▲0'], last: '▲0', title: "revision 4's triangle on a triangle's point",
    caption: 'A triangle on the point of another triangle falls off: it touches at one point only.',
    expect: { outcome: 'off', way: 'up', verts: [[0, 0, 1], [1, 0, 2], [2, 0, 1]], reason: 'ONLY A POINT',
      contacts: { segments: [], points: [[1, 0, 1]] }, shine: [], gap: null },
    also: { auto: { outcome: 'off', way: 'up', reason: 'ONLY A POINT' } } },
  { n: 11, drops: [], last: { piece: 'sq', col: -1, way: null }, title: "revision 4's square half a tile off", throws: true,
    caption: 'A square can never be half a tile off: the hand moves squares in whole tiles.' },
  { n: 12, drops: ['■-1', '■0', '▲-1', '▲0', '▼-0.5', '▼-1.5', '▼0.5', '▲-1.5', '▲-0.5', '▲0.5', '▼-1', '▼0', '■-1'], last: '■0',
    title: "the photo's wall",
    caption: "The photo's wall: squares, rows of triangles shifted by half, and squares again; every tile stays.",
    expect: { outcome: 'fit', way: null, verts: [[0, 2, 2], [0, 4, 2], [2, 2, 2], [2, 4, 2]], reason: null,
      contacts: { segments: [S([0, 2, 2], [0, 4, 2]), S([0, 2, 2], [2, 2, 2])], points: [] },
      shine: [S([0, 2, 2], [0, 4, 2]), S([0, 2, 2], [2, 2, 2])], gap: null },
    also: { notch: [4, 10, 11], oneSide: [5, 6] } },
  { n: 13, drops: ['■-2', '▲-2', '▲-1', '▼-0.5', '▲-0.5', '▼-1'], last: '▲-1.5', title: 'the near-catch: a corner on a point just above a flat top',
    caption: 'A triangle whose corner lands on the tip of another, just above a flat top, falls off: it touches at one point.',
    expect: { outcome: 'off', way: 'up', verts: [[-3, 2, 1], [-2, 2, 2], [-1, 2, 1]], reason: 'ONLY A POINT',
      contacts: { segments: [], points: [[-3, 2, 1]] }, shine: [], gap: null, tips: null },
    also: { oneSide: [3], auto: { outcome: 'off', way: 'up', reason: 'ONLY A POINT' } } },
  { n: 14, drops: ['▲-2.5', '▼-2', '▲-1.5'], last: '▼-1', title: 'a stair leaning out from the car\'s end',
    caption: 'One more step would hang the whole stair past where it stands on the car, so it would tip over: the new tile falls off.',
    expect: { outcome: 'off', way: 'down', verts: [[-2, 0, 2], [-1, 0, 1], [0, 0, 2]], reason: 'TIPS OVER',
      contacts: { segments: [S([-2, 0, 2], [-1, 0, 1])], points: [] }, shine: [], gap: null,
      tips: { base: [[-5, 0, 0], [-4, 0, 1], [-3, 0, 0]], members: 4, side: 'right', pivot: [-3, 0, 0] } },
    also: { oneSide: [1], auto: { outcome: 'off', way: 'down', reason: 'TIPS OVER' }, game: { base: 0, members: [0, 1, 2, 3], com: -1.25 } } },
  { n: 15, drops: ['■-2', '▲-1.5'], last: '▼-1', title: 'a diamond hung off a square\'s corner',
    caption: 'An upside-down triangle hung on a triangle that is half on a square would pull both over the square\'s corner: it falls off.',
    expect: { outcome: 'off', way: 'down', verts: [[-2, 2, 1], [-1, 2, 0], [0, 2, 1]], reason: 'TIPS OVER',
      contacts: { segments: [S([-2, 2, 1], [-1, 2, 0])], points: [] }, shine: [], gap: null,
      tips: { base: [[-3, 2, 0], [-2, 2, 1], [-1, 2, 0]], members: 2, side: 'right', pivot: [-2, 2, 0] } },
    also: { auto: { outcome: 'off', way: 'down', reason: 'TIPS OVER' }, game: { base: 1, members: [1, 2], com: -0.75 } } },
  { n: 16, drops: ['▲-1', '▼-0.5'], last: '■0', title: 'a square on a hung ▼\'s top',
    caption: 'A square on a hung triangle is too heavy for it: the triangle would tip over its point, so the square falls off. A triangle there stays (case 9).',
    expect: { outcome: 'off', way: null, verts: [[0, 0, 1], [0, 2, 1], [2, 0, 1], [2, 2, 1]], reason: 'TIPS OVER',
      contacts: { segments: [S([0, 0, 1], [1, 0, 1])], points: [] }, shine: [], gap: null,
      tips: { base: [[-2, 0, 0], [-1, 0, 1], [0, 0, 0]], members: 3, side: 'right', pivot: [0, 0, 0] } },
    also: { oneSide: [1], game: { base: 0, members: [0, 1, 2], com: (Math.sqrt(3) / 4 * -0.5 + 0.5) / (1 + Math.sqrt(3) / 2) } } }
];
// The regression corpus (DESIGN §18.8): builds the tiers found that tell a wrong reading of SPEC §5c apart where the
// golden cases above do not, worked out by hand like them. They are not SPEC §9's cases and are not on the golden
// sheet. Weights ×4, x in half tiles X, 8m and L2 as in the note above case 13.
// R1 (found at depth 8: the pivot is the LOWEST support point at the part's end). ▲−2 (X −4..−2) and ▲−0.5 (X −1..1) on
//    the car; ▼−1.5 (X −3..−1) on ▲−2's right side, point on the car at X −2; ▼0 (X 0..2) on ▲−0.5's right side, point
//    on the car at X 1 (tops h); ▲−0.5 again at h on ▼0's top, its left corner on ▲−0.5's apex; ▼−1 (X −2..0) on that
//    ▲'s left side, point (X −1, h) on ▼−1.5's top-right corner; ▲−1 on ▼−1's top (2h); ▼−1.5 on ▲−1's left side,
//    top at 3h. ■−2 (X −4..−2) lands at 3h half on that top: it meets the tower edge to edge. The part of the lower
//    ▲−0.5 (it, ▼0, the upper ▲−0.5, ▼−1, ▲−1, the upper ▼−1.5 and the square: 7 tiles) rests on the car X −1..1
//    (L2 2), ▼0's point on the car (X 1) and ▼−1's point on ▼−1.5's corner (X −1, h): Xmin −1. Left: 8m =
//    4·(−1 + 3) + √3·((−1 − 0) + (−1 − 1) + (−1 − 0) + 0 + 0 + (−1 + 2)) = 8 − 3√3 > 2: tips. ▼0's part (6 tiles, Xmin
//    −1 by ▼−1's point, L2 2 on ▲−0.5's side): 8 − 2√3 > 2, tips too, also lowest at 0; the smaller col is ▲−0.5's.
//    ▲−2's part (with ▼−1.5, ▼−1 on it through the corner, and all above; on the car X −4..−2, ▼−1.5's point, and ▼−1
//    on the upper ▲−0.5's side X −1..0) leans neither way; nor does the lower ▼−1.5's. Base ▲−0.5, 7 members, left,
//    and at X −1 the support has two points, (−1, 0) on the car and (−1, h) under ▼−1's point: the pivot is the
//    lower, (−1, 0). The game's centre of weight (x of the middles: ▲ 0, ▼ ½, ▲ 0, ▼ −½, ▲ −½, ▼ −1, ■ −1½):
//    (−1½ + √3/4·(0 + ½ + 0 − ½ − ½ − 1)) / (1 + 6·√3/4) = −0.5974.
// R2 (found at depth 6: exactly as far as the grip holds stays, m ≤ L/4). ▲−2 on the car; ▼−2.5 (X −5..−3) on its
//    left side, point on the car's end corner (X −4); ▼−1.5 (X −3..−1) on its right side, point on the car (X −2);
//    ▲−2.5 on ▼−2.5's top (h); ▼−2 (X −4..−2) on ▲−2.5's right side, its point (X −3, h) on ▲−2's apex and the two ▼
//    tops' corners; ■−1 (X −2..0) at h, half on ▼−1.5's top. ▲−1 (X −2..0) lands whole on the square's top at 1 + h.
//    ▼−1.5's part (it, ▼−2 resting on its corner, the square, the new ▲) rests on ▲−2's side (X −3..−2, L2 2), the
//    car (X −2), ▲−2.5's side (X −4..−3, L2 2) and points at X −3: Xmax −2, L2 4. Right: 8m = √3·(0 − 1 + 1) + 4·1 = 4
//    = L2, so m = 1/2 = L/4 exactly: it stays. Every other part leans less. Fit.
const REGRESSION = [
  { n: 'R1', drops: ['▲-2', '▲-0.5', '▼-1.5', '▼0', '▲-0.5', '▼-1', '▲-1', '▼-1.5'], last: '■-2', title: 'the pivot is the lowest support point at the part\'s end',
    expect: { outcome: 'off', way: null, verts: [[-4, 0, 3], [-4, 2, 3], [-2, 0, 3], [-2, 2, 3]], reason: 'TIPS OVER',
      contacts: { segments: [S([-3, 0, 3], [-2, 0, 3])], points: [] }, shine: [], gap: null,
      tips: { base: [[-1, 0, 0], [0, 0, 1], [1, 0, 0]], members: 7, side: 'left', pivot: [-1, 0, 0] } },
    also: { game: { base: 1, members: [1, 3, 4, 5, 6, 7, 8], com: (1 * -1.5 + Math.sqrt(3) / 4 * (0 + 0.5 + 0 - 0.5 - 0.5 - 1)) / (1 + 6 * Math.sqrt(3) / 4) } } },
  { n: 'R2', drops: ['▲-2', '▼-2.5', '▼-1.5', '▲-2.5', '▼-2', '■-1'], last: '▲-1', title: 'a part leaning exactly as far as its grip holds stays',
    expect: { outcome: 'fit', way: 'up', verts: [[-2, 2, 1], [-1, 2, 2], [0, 2, 1]], reason: null,
      contacts: { segments: [S([-2, 2, 1], [0, 2, 1])], points: [] }, shine: [S([-2, 2, 1], [0, 2, 1])], gap: null, tips: null },
    also: { auto: { outcome: 'fit', way: 'up', reason: null } } }
];
for (const c of CASES.concat(REGRESSION)) {
  c.log = c.drops.map(canon.parseDrop);
  c.lastDrop = typeof c.last === 'string' ? canon.parseDrop(c.last) : c.last;
}

// SPEC §6 on made-up results (R.chooseWay(up, down)): y is [p, q], (p + q√3)/2, of each way's lowest point; an off
// result is ONLY A POINT unless it says TIPS OVER
const r = (fit, y, reason) => ({ outcome: fit ? 'fit' : 'off', pose: { y }, reason: fit ? null : reason || 'ONLY A POINT' });
const TIPS = 'TIPS OVER';
const WAYS = [
  { what: 'only ▲ fits', up: r(true, [2, 0]), down: r(false, [0, 0]), want: 'up' },
  { what: 'only ▼ fits', up: r(false, [0, 0]), down: r(true, [2, 0]), want: 'down' },
  { what: 'neither fits: ▲', up: r(false, [0, 1]), down: r(false, [0, 0]), want: 'up' },
  { what: 'both fit, ▼ lower (h < 1)', up: r(true, [2, 0]), down: r(true, [0, 1]), want: 'down' },
  { what: 'both fit, ▲ lower (1 < 2h)', up: r(true, [2, 0]), down: r(true, [0, 2]), want: 'up' },
  { what: 'both fit, ▲ lower by 0.134 (1 + h < 2)', up: r(true, [2, 1]), down: r(true, [4, 0]), want: 'up' },
  { what: 'both fit, equally low: ▼', up: r(true, [2, 1]), down: r(true, [2, 1]), want: 'down' },
  { what: 'both fit, equally low on the car: ▼', up: r(true, [0, 0]), down: r(true, [0, 0]), want: 'down' },
  { what: 'neither fits, ▼ tips over, ▲ only a point: ▼', up: r(false, [0, 2]), down: r(false, [0, 1], TIPS), want: 'down' },
  { what: 'neither fits, ▲ tips over, ▼ only a point: ▲', up: r(false, [0, 1], TIPS), down: r(false, [0, 2]), want: 'up' },
  { what: 'neither fits, ▼ tips over and lands higher: ▼', up: r(false, [2, 0]), down: r(false, [2, 1], TIPS), want: 'down' },
  { what: 'neither fits, both tip over: ▲', up: r(false, [0, 1], TIPS), down: r(false, [0, 1], TIPS), want: 'up' },
  { what: 'neither fits, both only a point: ▲', up: r(false, [0, 1]), down: r(false, [0, 1]), want: 'up' },
  { what: '▲ fits, ▼ tips over: ▲', up: r(true, [2, 0]), down: r(false, [0, 1], TIPS), want: 'up' },
  { what: '▼ fits, ▲ tips over: ▼', up: r(false, [0, 1], TIPS), down: r(true, [2, 0]), want: 'down' }
];

// how the tile at index i of a build holds (from the build's tiles, by hand rules): ▼ sides held, 0..2
function downSides(T, i) {
  const t = T[i];
  return T.filter(u => u.way === 'up' && u.y[0] === t.y[0] && u.y[1] === t.y[1] && (u.col === t.col - 1 || u.col === t.col + 1)).length;
}

// run every case through rules R; returns [{n, ok, msg}]
function runGolden(R) {
  const out = [];
  for (const c of CASES.concat(REGRESSION)) {
    const fails = [];
    try {
      const B = canon.replay(R, 2, c.log);
      const d = c.lastDrop;
      if (c.throws) {
        let threw = false;
        try { R.drop(B, d.piece, d.col, d.way || undefined); } catch (e) { threw = true; }
        if (!threw) fails.push('expected a throw');
        // and the hand never offers it: no square col is odd
        if (R.cols && R.cols(B, 'sq').some(x => x % 2)) fails.push('an odd square col is offered');
      } else {
        const res = R.drop(B, d.piece, d.col, d.way || undefined);
        const T0 = R.tiles ? R.tiles(B) : [];
        const df = canon.diff(res, c.expect, T0);
        if (df) for (const f in df) fails.push(f + ': got ' + JSON.stringify(df[f][0]) + ' want ' + JSON.stringify(df[f][1]));
        if (c.n === 12 && res.outcome !== 'fit') fails.push('the last tile of the wall does not fit');
        const T = R.tiles ? R.tiles(B) : null;
        if (T && c.also) {
          for (const i of c.also.notch || []) if (downSides(T, i) !== 2) fails.push('tile ' + i + ' (' + c.drops[i] + ') is not in a notch');
          for (const i of c.also.oneSide || []) if (downSides(T, i) !== 1) fails.push('tile ' + i + ' (' + c.drops[i] + ') is not held by one side');
        }
        // the game's form of tips (DESIGN §18.7): indices, and the centre of weight in x
        if (c.also && c.also.game) {
          const t = res.tips, w = c.also.game;
          if (!t) fails.push('no tips');
          else {
            if (t.base !== w.base) fails.push('tips.base ' + t.base + ' want ' + w.base);
            if (JSON.stringify(t.members) !== JSON.stringify(w.members)) fails.push('tips.members ' + JSON.stringify(t.members) + ' want ' + JSON.stringify(w.members));
            if (typeof t.com !== 'number' || Math.abs(t.com - w.com) > 1e-9) fails.push('tips.com ' + t.com + ' want ' + w.com);
          }
        } else if (res.tips !== null) fails.push('tips should be null: ' + JSON.stringify(res.tips));
        if (c.also && c.also.auto) {
          const a = R.drop(B, 'tri', d.col);
          for (const f of ['outcome', 'way', 'reason']) if (a[f] !== c.also.auto[f]) fails.push('no way given: ' + f + ' ' + a[f] + ' want ' + c.also.auto[f]);
        }
      }
    } catch (e) {
      fails.push('threw: ' + e.message);
    }
    out.push({ n: c.n, ok: fails.length === 0, msg: fails.join('; ') });
  }
  // SPEC §6's choice on made-up results
  const wf = [];
  if (typeof R.chooseWay !== 'function') wf.push('rules.js has no chooseWay');
  else for (const w of WAYS) {
    let got;
    try { got = R.chooseWay(w.up, w.down); } catch (e) { got = 'threw: ' + e.message; }
    if (got !== w.want) wf.push(w.what + ': got ' + got + ' want ' + w.want);
  }
  out.push({ n: 'way', ok: wf.length === 0, msg: wf.join('; ') });
  return out;
}

module.exports = { CASES, REGRESSION, WAYS, runGolden };

if (require.main === module) {
  const R = require('../lib/rules-vm.cjs').load();
  const res = runGolden(R);
  const quiet = process.argv.includes('--quiet');
  const title = n => n === 'way' ? 'SPEC §6 way choice on made-up results (' + WAYS.length + ' pairs)' : String(n)[0] === 'R' ? '(regression) ' + REGRESSION.find(c => c.n === n).title : CASES[n - 1].title;
  for (const x of res) if (!quiet || !x.ok) console.log((x.ok ? 'PASS' : 'FAIL') + ' golden ' + x.n + ' ' + title(x.n) + (x.ok ? '' : ': ' + x.msg));
  const bad = res.filter(x => !x.ok).length;
  console.log((bad ? 'FAIL' : 'PASS') + ' golden: ' + (res.length - bad) + '/' + res.length);
  process.exit(bad ? 1 : 0);
}
