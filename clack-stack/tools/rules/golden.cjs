'use strict';
// The golden cases of DESIGN §18.9 / SPEC §9 (revision 5e: cases 1–19) through rules.js. Each case's last drop is
// checked in the full comparison format (SPEC §8, tips included). The expectations below were worked out by hand from
// SPEC §1–8 (not copied from rules.js), and every earlier drop must fit. `also` adds hand-derived checks: the drop with
// no way given (SPEC §6), how earlier tiles hold, and the game's own form of tips (DESIGN §18.7: the base's index,
// the members' indices, the centre of weight), and the groups props() names as propped in the build the drop leaves (in
// the build itself when it does not fit). After the cases, SPEC §6's way choice is checked on made-up pairs of
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
// The balance (SPEC §5c, revisions 5d and 5e), by hand. Weights ×4 (a square 4, a triangle √3) and x in half tiles X (a tile's
// middle at X = col + 1); a group leans right when 4·Σ■(X − Xmax) + √3·Σ▲▼(X − Xmax) > 0 and left when
// 4·Σ■(Xmin − X) + √3·Σ▲▼(Xmin − X) > 0, where Xmin, Xmax are the ends of its support; exactly over an end is balanced,
// and there is no grip. Locks: a contact of length 1 (a whole edge) locks, half an edge or a point does not, the car
// never does. A group is its piece, everything resting on it and everything locked to that, all the way up.
// Props (5e): a group that leans is still balanced if a tile U of it shares an upright contact of positive length with
// a tile V outside it (never the car), on U's side toward the lean, whose upper end is higher than the pivot. Only
// squares have upright sides, so only a square of the group beside a square outside it can prop it. Re-checked for
// every case below: in 1–18 no group that leans has such a contact (the TIPS OVER cases: 14 is all triangles; in 15
// and 16 the square of the group has nothing beside it toward the lean; in 18 the group's squares have nothing beside
// them at X 0 and the lower ■−2 meets them only at its top corner), so every expectation stands as in 5d.
//  6. ■−1, ■−1 (flat lock), ▲−1 (flat), ▼−1.5 (slant), ▲−1.5 (flat), ▼−2 (slant): one piece of six, nothing else, so
//     its group is the same six. It rests on the car X −2..0 only (▼−1.5's point on the square's corner and ▲−1.5's
//     corner on ▲−1's apex are inside it). Middles ■ −1, ■ −1, ▲ −1, ▼ −2, ▲ −2, ▼ −3. Right, past Xmax 0:
//     4·(−1 − 1) + √3·(−1 − 2 − 2 − 3) < 0; left, past Xmin −2: 4·(−1 − 1) + √3·(−1 + 0 + 0 + 1) = −8 < 0. Balanced:
//     fits.
//  9. ▲−1 and ▼−0.5 (slant lock) are one piece; ▲0, half on ▼−0.5's top, is a piece of its own. ▲0's group (itself) rests
//     on ▼−0.5's top X 0..1, its middle X 1 at the end: balanced. The group of ▲−1 + ▼−0.5 is all three: on the car X
//     −2..0 and ▼−0.5's point X 0; middles −1, 0, 1 past Xmax 0: √3·(−1 + 0 + 1) = 0, exactly over the end. Fits.
// 13. As before (no balance: it is off with ONLY A POINT). ■−2, ▲−2 on it (apex X −3 at 1 + h); ▲−1 on the car; ▼−0.5
//     on ▲−1's right side, point on the car (top h); ▲−0.5 on that top (apex X 0 at 2h); ▼−1 (X −2..0) on ▲−0.5's left
//     side, point on ▲−1's apex (−1, h), top at 2h. ▲−1.5 (X −3..−1) stops on ▲−2's apex at 1 + h with its left corner:
//     under it a slant and ▼−1's top 0.134 lower, no flat top at its height. Off, ONLY A POINT, the point [−3, 2, 1].
//     No way given: ▼−1.5 would stop with its point on ▼−1's top-left corner at 2h, no side held: neither tips, so ▲.
// 14. ▲−2.5 (X −5..−3) half on the car; ▼−2 on its right side (slant lock), point on the car at X −3 (top h, X −4..−2);
//     ▲−1.5 (X −3..−1) half on that top (no lock); ▼−1 (X −2..0) on ▲−1.5's right side (slant lock), its point (X −1,
//     h) over the bare car. It meets the tower edge to edge (contact [−2,0,2]–[−1,0,1]). Pieces: {▲−2.5, ▼−2} and
//     {▲−1.5, ▼−1}. The upper piece's group (itself) rests on ▼−2's top X −3..−2: middles −2, −1 past Xmax −2: √3 > 0,
//     tips right. The lower piece's group is all four: on the car X −4..−3 and ▼−2's point (X −3): middles −4, −3, −2,
//     −1 past −3: √3·(−1 + 0 + 1 + 2) = 2√3 > 0, tips right. Both tip; the lower piece's lowest point is lower (0 against
//     h). Its lowest tiles are ▲−2.5 and ▼−2 (both at 0); the smaller col is ▲−2.5's: base ▲−2.5, members 4, right,
//     pivot the lowest support point at X −3: (−3, 0). Before ▼−1 every group balanced (▲−1.5 alone on ▼−2's top, its
//     middle X −2 at the end; the lower group, middles −4, −3, −2 over X −4..−3, at its end). No way given: ▲−1
//     would stop on ▲−1.5's apex, so ▼ (it tips).
// 15. ■−2 (X −4..−2, top 1, on the car: no lock); ▲−1.5 (X −3..−1) half on it (no lock); ▼−1 (X −2..0) on ▲−1.5's right
//     side (slant lock), point (X −1, 1) in the air. Pieces {■−2}, {▲−1.5, ▼−1}. The upper group (the two) rests on the
//     square's top X −3..−2: middles −2, −1 past −2: √3 > 0, tips right. The square's group (all three): on the car X
//     −4..−2, middles −3, −2, −1: right 4·(−3 + 2) + √3·(0 + 1) = −4 + √3 < 0, left 4·(−4 + 3) + √3·(−4 + 2 − 4 + 1) < 0:
//     balanced. Base ▲−1.5, members 2, right, pivot (−1, 1) = [−2, 2, 0]. No way given: ▲−1 would stop on ▲−1.5's apex,
//     so ▼.
// 16. ▲−1 (X −2..0); ▼−0.5 on its right side (slant lock), point on the car at X 0, top at h; ■0 (X 0..2) half on that
//     top (no lock). ■0's group (itself) rests on X 0..1, its middle X 1 at the end: balanced. The group of ▲−1 + ▼−0.5
//     is all three: on the car X −2..0 and the ▼'s point (X 0); middles −1, 0, 1 past Xmax 0: 4·1 + √3·(−1 + 0) = 4 − √3
//     > 0, tips right. Base: the piece's lowest tiles are ▲−1 and ▼−0.5 (both at 0), the smaller col ▲−1's. Members 3,
//     right, pivot (0, 0). Case 9's lighter ▲ there: √3·0 = 0, exactly over the end, it stays. The game's centre of
//     weight: (√3/4·(−½) + √3/4·0 + 1·½)/(1 + √3/2) = 0.1519.
// 17. ▲0.5 (X 1..3) on the car; ▼0 (X 0..2) on its left side (slant lock), point on the car at X 1, top at h; ▲0 (X 0..2)
//     whole on that top (flat lock), apex (X 1, 2h); ▼0.5 (X 1..3) on ▲0's right side (slant lock), its point on ▲0.5's
//     apex (X 2, h), top at 2h: the four are one piece. ■1 (X 2..4) stops at 2h half on ▼0.5's top X 2..3 (no lock);
//     under its other half is the bare car, 2h = √3 below (gap [0, 2]). ■1's group (itself): its middle X 3 at the end
//     of X 2..3, balanced. The piece's group (all five) rests on the car X 1..3 (▲0.5's base) and ▼0's point (X 1);
//     ▼0.5's point on ▲0.5's apex is inside it. Middles ▲0.5 2, ▼0 1, ▲0 1, ▼0.5 2, ■1 3, over X 1..3: right
//     4·(3 − 3) + √3·(−1 − 2 − 2 − 1) < 0, left 4·(1 − 3) + √3·(1 + 0 + 0 − 1) < 0: balanced. Fit. (5c tipped it: ▼0.5's
//     part alone, it and the square, leaned past ▲0.5's apex.) Before ■1 every group balanced (the piece over X 1..3).
// 18. ■−2 (X −4..−2) on the car; ▲−1.5 (X −3..−1) half on its top at 1 (no lock), apex (X −2, 1 + h); ▼−2 (X −4..−2) on
//     ▲−1.5's left side (slant lock), its point (X −3, 1) on the square's top; ■−2 (X −4..−2) whole on ▼−2's top at 1 + h
//     (flat lock), its corner on ▲−1.5's apex; ▲−2.5 (X −5..−3) half on that square's top at 2 + h (no lock), half past
//     the car; ▼−1 (X −2..0) on ▲−1.5's right side (slant lock), point (X −1, 1) in the air; ■−1 (X −2..0) whole on
//     ▼−1's top at 1 + h (flat lock), and beside the upper ■−2 along a whole side (X −2, 1 + h … 2 + h: an upright
//     lock). Pieces: {■−2 (lower)}, {▲−1.5, ▼−2, ■−2, ▼−1, ■−1}, {▲−2.5}. The new ■−1 (X −2..0) lands whole on ■−1's top
//     at 2 + h (flat lock): the middle piece grows to six, and its group is those six and ▲−2.5, which rests on one of
//     them: 7 tiles. That group rests on the lower square's top only: ▲−1.5's half base X −3..−2 and ▼−2's point at X
//     −3, so X −3..−2. Middles ▲−1.5 −2, ▼−2 −3, ■ −3, ▲−2.5 −4, ▼−1 −1, ■ −1, ■ −1. Right, past −2: 4·(−1 + 1 + 1) +
//     √3·(0 − 1 − 2 + 1) = 4 − 2√3 > 0: in tiles, M − W·xmax = (4 − 2√3)/8 = 0.067 and W = 3 + √3, so its centre of
//     weight is 0.067/4.732 = 0.014 past the corner. Tips right. ▲−2.5's group (itself): its middle
//     X −4 at the end of X −4..−3, balanced. The lower square's group (all eight): on the car X −4..−2, balanced. Only
//     the middle piece's group tips. Its lowest tiles are ▲−1.5 (base at 1), ▼−2 and ▼−1 (points at 1); the smaller col
//     is ▼−2's (col −4). Base ▼−2, members 7, right, pivot: at X −2 the support has only (−2, 1) = (−1, 1), [−2, 2, 0].
//     The game's form: base 2, members [1 … 7], centre of weight (−2.5 − 1.25√3)/(3 + √3) = −0.9858. (5c's grip kept
//     it.)
// 19. (5e) ■0 (X 0..2) on the car, top at 1. ▲−2 (X −4..−2) on the car, apex (X −3, h); ▼−1.5 (X −3..−1) on its right
//     side (slant lock), point on the car at X −2, top at h. ■−2 (X −4..−2) stops at h on ▲−2's apex and half on ▼−1.5's
//     top (X −3..−2; no lock). ■−1 (X −2..0) stops at h half on ▼−1.5's top (X −2..−1; no lock); its left side meets
//     ■−2's right side whole (X −2, h … 1 + h: an upright lock), and its right side meets ■0's left side over X 0, h … 1
//     only (an upright contact of 1 − h, no lock). The new ■−1 lands whole on ■−1's top at 1 + h (flat lock): verts
//     (X −2..0, 1 + h … 2 + h); its contacts are that top (■−2's top corner and the lower ■−1's corner lie on it); no gap.
//     Pieces: {▲−2, ▼−1.5}, {■−2, ■−1, ■−1'}, {■0}. The group of {▲−2, ▼−1.5}: everything resting on it (■−2, ■−1, and
//     the new ■−1 on those): five tiles, standing on the car X −4..−2 (▲−2's base, ▼−1.5's point at X −2). Middles ▲ −3,
//     ▼ −2, ■ −3, ■ −1, ■ −1. Right, past −2: 4·(−1 + 1 + 1) + √3·(−1 + 0) = 4 − √3 > 0: it leans right; its pivot is the
//     lowest support point at X −2, (−1, 0). Prop: ■−1 (in the group) presses with its right side on ■0 (outside it)
//     from h to 1, and 1 > 0: propped, balanced. The squares' piece's group (itself) stands on ▲−2's apex and ▼−1.5's
//     top, X −3..−1: middles −3, −1, −1, right past −1: −8 < 0, left past −3: −16 < 0: balanced. ■0 alone on the car:
//     balanced. Fit. Before the new square: right 4·(−1 + 1) − √3 < 0, no lean (in this order the prop is not yet
//     needed). props() of the build it makes: the group [1 … 5], right, pivot (−2, 0, 0), held by tile 4 (the lower ■−1)
//     on tile 0 (■0) along X 0 from h to 1. (5d tipped it.)
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
    also: { oneSide: [1], game: { base: 0, members: [0, 1, 2], com: (Math.sqrt(3) / 4 * -0.5 + 0.5) / (1 + Math.sqrt(3) / 2) } } },
  { n: 17, drops: ['▲0.5', '▼0', '▲0', '▼0.5'], last: '■1', title: 'four triangles locked into one piece, a square half on its top',
    caption: 'Four triangles joined along whole edges move as one piece; the square half on its top keeps the weight over where the piece stands, so it stays.',
    expect: { outcome: 'fit', way: null, verts: [[2, 0, 2], [2, 2, 2], [4, 0, 2], [4, 2, 2]], reason: null,
      contacts: { segments: [S([2, 0, 2], [3, 0, 2])], points: [] }, shine: [S([2, 0, 2], [3, 0, 2])], gap: [0, 2], tips: null },
    also: { oneSide: [1, 3] } },
  { n: 18, drops: ['■-2', '▲-1.5', '▼-2', '■-2', '▲-2.5', '▼-1', '■-1'], last: '■-1', title: 'a locked block standing on half a square\'s top and a point',
    caption: 'The tiles joined along whole edges are one block, standing on half of the bottom square\'s top and a point. One more square puts its weight just past the corner (0.014 of a tile): it would tip, so the square falls off.',
    expect: { outcome: 'off', way: null, verts: [[-2, 4, 1], [-2, 6, 1], [0, 4, 1], [0, 6, 1]], reason: 'TIPS OVER',
      contacts: { segments: [S([-2, 4, 1], [0, 4, 1])], points: [] }, shine: [], gap: null,
      tips: { base: [[-4, 2, 1], [-3, 2, 0], [-2, 2, 1]], members: 7, side: 'right', pivot: [-2, 2, 0] } },
    also: { oneSide: [2, 5], game: { base: 2, members: [1, 2, 3, 4, 5, 6, 7], com: (-2.5 - 1.25 * Math.sqrt(3)) / (3 + Math.sqrt(3)) }, props: [] } },
  { n: 19, drops: ['■0', '▲-2', '▼-1.5', '■-2', '■-1'], last: '■-1', title: 'a stack leaning on the square beside it',
    caption: 'The tiles on the hung triangle lean right past where they stand, but the square beside them holds them up: its side presses on theirs above the corner they would tip over. The square stays.',
    expect: { outcome: 'fit', way: null, verts: [[-2, 2, 1], [-2, 4, 1], [0, 2, 1], [0, 4, 1]], reason: null,
      contacts: { segments: [S([-2, 2, 1], [0, 2, 1])], points: [] }, shine: [S([-2, 2, 1], [0, 2, 1])], gap: null, tips: null },
    also: { oneSide: [2], props: [{ members: [1, 2, 3, 4, 5], side: 'right', pivot: [-2, 0, 0], props: [{ tile: 4, by: 0, seg: [[0, 0, 1], [0, 2, 0]] }] }] } }
];
// The regression corpus (DESIGN §18.8): builds the tiers found that tell a wrong reading of SPEC §5c apart where the
// golden cases above do not, worked out by hand like them (re-derived for revision 5e). They are not SPEC §9's cases and
// are not on the golden sheet. Weights ×4, x in half tiles X, as in the note above case 6.
// Re-derived for 5e (props): R1 and R2 have one square each, so no upright contact at all. In R3 and R4 no two squares
// beside each other meet along part of a side (R3: ■0 meets the upper ■1 along a whole side, a lock, and nothing else;
// R4: the squares beside each other are locked, and every other pair is a whole tile or more apart in height). In R5
// the one upright contact that is not a lock (■0's right side on ■1's, 2h … 1 + h) joins two tiles of the same group of
// 24, which is the whole build, so nothing is outside it to prop it, and column R's group stands exactly over its end
// without leaning. So no group that leans has a prop, and R1–R5 stand as in 5d.
// R1 (found at depth 8 under 5c: the pivot is the LOWEST support point at the group's end; it still is under 5d).
//    ▲−2 (X −4..−2) and ▲−0.5 (X −1..1) on the car; ▼−1.5 (X −3..−1) on ▲−2's right side (slant lock), point on the car
//    at X −2; ▼0 (X 0..2) on ▲−0.5's right side (slant lock), point on the car at X 1 (tops h); ▲−0.5 again at h, half on
//    ▼0's top (no lock), its base on ▲−0.5's apex (X 0) and its left corner meeting ▼−1.5's top corner (X −1, h) side by
//    side (no rest); ▼−1 (X −2..0) on that ▲'s left side (slant lock), point (X −1, h) on ▼−1.5's top-right corner (it
//    rests there); ▲−1 whole on ▼−1's top at 2h (flat lock); ▼−1.5 on ▲−1's left side (slant lock), point on ▼−1's
//    top-left corner, top at 3h. Pieces: {▲−2, ▼−1.5}, {▲−0.5, ▼0}, {upper ▲−0.5, ▼−1, ▲−1, upper ▼−1.5}. ■−2 (X −4..−2)
//    lands at 3h half on the upper ▼−1.5's top (no lock): it meets the tower edge to edge, a piece of its own whose
//    middle X −3 is at the end of X −3..−2 (balanced). The upper piece's group (it and the square, 5 tiles) rests on
//    ▼0's top X 0..1, ▲−0.5's apex (X 0) and ▼−1.5's corner (X −1, h): Xmin −1; middles 0, −1, −1, −2, −3: left
//    4·(−1 + 3) + √3·(−1 + 0 + 0 + 1) = 8 > 0, tips. The group of {▲−0.5, ▼0} is that and the two (7 tiles): on the car
//    X −1..1, ▼0's point (X 1) and ▼−1's point on ▼−1.5's corner (X −1, h): Xmin −1; left 4·(−1 + 3) + √3·((−1 − 0) +
//    (−1 − 1) + (−1 − 0) + 0 + 0 + (−1 + 2)) = 8 − 3√3 > 0, tips. The group of {▲−2, ▼−1.5} (with ▼−1 resting on ▼−1.5's
//    corner, so the upper piece and the square: 7 tiles) stands on the car X −4..−2 and on ▼0's top and ▲−0.5's apex
//    (X 0..1), with every middle in between: balanced. Two groups tip; {▲−0.5, ▼0} is lower (0 against h). Its lowest
//    tiles are ▲−0.5 (col −1) and ▼0 (col 0): base ▲−0.5, 7 members, left, and at X −1 the support has two points,
//    (−1, 0) on the car and (−1, h) under ▼−1's point: the pivot is the lower, (−1, 0). The game's centre of weight
//    (x of the middles: ▲ 0, ▼ ½, ▲ 0, ▼ −½, ▲ −½, ▼ −1, ■ −1½): (−1½ + √3/4·(0 + ½ + 0 − ½ − ½ − 1)) / (1 + 6·√3/4) =
//    −0.5974.
// R2 (found at depth 6 under 5c, where it was the grip's exact limit; under 5d it is a locked piece standing on half an
//    edge exactly over its end, which stays). ▲−2 on the car; ▼−2.5 (X −5..−3) on its left side (slant lock), point on
//    the car's end corner (X −4); ▼−1.5 (X −3..−1) on its right side (slant lock), point on the car (X −2); ▲−2.5 whole
//    on ▼−2.5's top at h (flat lock); ▼−2 (X −4..−2) on ▲−2.5's right side (slant lock), its point (X −3, h) on ▲−2's
//    apex and the two ▼ tops' corners: those five are one piece. ■−1 (X −2..0) at h, half on ▼−1.5's top X −2..−1 (no
//    lock; its left side meets ▼−2's corner at a point). ▲−1 (X −2..0) lands whole on the square's top at 1 + h (flat
//    lock): the piece {■−1, ▲−1}, its group the two, rests on X −2..−1 only, both middles at X −1: exactly over the end,
//    balanced. The five's group (all seven) stands on the car X −4..−2 (▲−2's base, ▼−2.5's point at X −4, ▼−1.5's
//    point at X −2): right past −2, 4·1 + √3·(−1 − 2 + 0 − 2 − 1 + 1) = 4 − 5√3 < 0; left past −4, 4·(−3) + √3·(−1 + 0 −
//    2 + 0 − 1 − 3) < 0: balanced. Fit.
// R3 (found under 5d by a random search against the mutant that merges only the first piece a new tile locks to: a
//    tile locked to two pieces joins them into one). ■−1 (X −2..0) and ■1 (X 2..4) on the car. ▲−0.5 (X −1..1) at 1,
//    half on ■−1's top (no lock; under its right half the bare car). ▲1.5 (X 3..5) at 1, half on ■1's top, half past
//    the car (no lock). ▼−1 (X −2..0) on ▲−0.5's left side (slant lock), its point (X −1, 1) on ■−1's top; ▼0 (X 0..2)
//    on ▲−0.5's right side (slant lock), its point (X 1, 1) in the air; both tops at 1 + h. Piece A = {▲−0.5, ▼−1, ▼0}
//    stands on ■−1's top: the half base X −1..0 and ▼−1's point (X −1): middles 0, −1, 1, right past 0: √3·(0 − 1 + 1)
//    = 0, exactly over the end (balanced). ▼1 (X 2..4) on ▲1.5's left side (slant lock), point (X 3, 1) on ■1's top;
//    ■1 (X 2..4) whole on ▼1's top at 1 + h (flat lock), its corner on ▲1.5's apex: piece B = {▲1.5, ▼1, ■1} stands on
//    ■1's top X 3..4 and ▼1's point (X 3): middles 4, 3, 3: balanced. ■0 (X 0..2) lands at 1 + h whole on ▼0's top
//    (flat lock, to A) and beside the upper ■1 along a whole side (X 2, 1 + h … 2 + h: an upright lock, to B): A, B and
//    ■0 are one piece of seven, and nothing else rests on it, so that is its group. It stands on ■−1's top (X −1..0 and
//    the point X −1) and on ■1's top (X 3..4 and the point X 3): X −1..4. Middles ▲−0.5 0, ▼−1 −1, ▼0 1, ▲1.5 4, ▼1 3,
//    ■1 3, ■0 1, all between: balanced. The lower squares' groups (each of them and the seven) stand on the car under
//    it and on the other square's top: balanced. Fit, its contacts a whole edge on ▼0's top and a whole side on ■1 (the
//    corners on them, ▲−0.5's apex among them, are on those segments). Merged with A alone, ■0 would tip: A and ■0 on X
//    −1..0, 4·(1 − 0) + √3·(0 − 1 + 1) = 4 > 0.
// R4 (found by the 5d oracle's author by a search, shrunk to 19 drops; under 5d the rules' tiers had found no build
//    where SPEC §5c's second tie rule, the larger group, decides: it kills the mutants that take the smaller group or
//    look at the col first). Middles X = col + 1. ▲−2.5 (X −5..−3, middle −4) half on the car; ▲−1 (X −2..0, −1) on the
//    car; ▼−0.5 (X −1..1, 0) on ▲−1's right side (slant lock), point on the car at X 0, top at h; ■−1 (X −2..0, −1) at
//    h, half on that top (X −1..0, no lock) and on ▲−1's apex (X −1); ▼−2 (X −4..−2, −3) on ▲−2.5's right side (slant
//    lock), point on the car at X −3, top at h; ■−2 (X −4..−2, −3) whole on that top (flat lock) and beside ■−1 along a
//    whole side (X −2, h … 1 + h: an upright lock). ▲−1 (−1) whole on ■−1's top at 1 + h (flat lock); ▼−0.5 (0) on its
//    right side (slant lock), point on ■−1's top-right corner (X 0, 1 + h), top at 1 + 2h. So far two pieces:
//    A = {▲−2.5, ▼−2, ■−2, the lower ■−1, the upper ▲−1 and ▼−0.5} and B = {the lower ▲−1 and ▼−0.5}. ■0 (X 0..2, 1) at
//    1 + 2h half on the upper ▼−0.5's top (no lock); ▲0 (1) whole on ■0's top (flat lock); ■−1 (−1) at 1 + 2h half on
//    the upper ▼−0.5's top (X −1..0) and on the upper ▲−1's apex, beside ■0 along a whole side (upright lock); ▼0.5
//    (2) on ▲0's right side (slant lock); ▲−1.5 (X −3..−1, −2) half on the upper ■−1's top (no lock); ▲0.5 (2) whole on
//    ▼0.5's top (flat lock); ▼0 (1) on ▲0.5's left side (slant lock), point on ▲0's apex; ▲−0.5 (0) half on ▼0's top
//    (no lock); ▼1 (3) on ▲0.5's right side (slant lock); ■1 (3) whole on ▼1's top at 2 + 4h (flat lock). Pieces: A, B,
//    C = {■0, ▲0, ■−1, ▼0.5, ▲0.5, ▼0, ▼1, ■1} and the two half-held ▲s, each with its middle at the end of its half
//    edge (balanced). The new ■1 (X 2..4, 3) lands whole on ■1's top at 3 + 4h (flat lock), joining C. Squares (X):
//    −1, −3, 1, −1, 3, 3; triangles: −4, −1, 0, −3, −1, 0, 1, 2, −2, 2, 1, 0, 3.
//    - B's group is all 19 tiles (A rests on B through the lower ■−1, and everything else on A). Its support is the car:
//      X −4..−3 (▲−2.5), X −3 (▼−2's point), X −2..0 (▲−1), X 0 (▼−0.5's point), so X −4..0. Right, past 0:
//      4·(−1 − 3 + 1 − 1 + 3 + 3) + √3·(−4 − 1 + 0 − 3 − 1 + 0 + 1 + 2 − 2 + 2 + 1 + 0 + 3) = 8 − 2√3 > 0: tips.
//    - A's group is all but B (17 tiles): the car X −4..−3 and X −3, and the lower ■−1 on B (▲−1's apex X −1, ▼−0.5's
//      top X −1..0), so X −4..0. Right, past 0: 8 + √3·(−2 + 1 − 0) = 8 − √3 > 0: tips.
//    - C's group (C and the two half-held ▲s, 11 tiles) stands on the upper ▼−0.5's top (X −1..1) and the upper ▲−1's
//      apex (X −1): X −1..1; right, past 1: 4·(0 − 2 + 2 + 2) + √3·(0 + 1 − 3 + 1 + 0 − 1 + 2) = 8 > 0: tips, but its
//      lowest point is 1 + 2h.
//    A and B both have their lowest point at 0 (▲−2.5 and ▼−2; ▲−1 and ▼−0.5): a tie, decided by the larger group, B's
//    19 against A's 17 (col first would take A, ▲−2.5 at col −5). B's lowest tiles are ▲−1 (col −2) and ▼−0.5 (col −1):
//    base ▲−1. Members 19, right, pivot: at X 0 the support has only (0, 0). The game's form: base 1, members 0 … 18,
//    centre of weight (Σ■ x + √3/4·Σ▲▼ x)/(6 + 13·√3/4) = (1 − √3/4)/(6 + 13√3/4) = 0.0488.
// R5 (built by hand in 5d conformance round 3, on a car of half 4; until then nothing had reached SPEC §5c's last tie
//    rule, and the mutant that takes the larger col was marked equivalent). Two pieces that both stand on the car and
//    rest on each other: one group, so when it tips both fail from one lowest point with one group size, and only the
//    col decides. Middles X = col + 1.
//    P = {▲1, ▼0.5, ▼1.5, ▲1.5, ▼1, ■1, ■1, ▼0, ▲−0.5, ■0} and Q = {▲−1.5, ▼−1, ■−1, ■0}:
//    ▲1 (X 2..4, middle 3) on the car; ▼0.5 (X 1..3, 2) on its left side (slant lock), point on the car at X 2, top h.
//    ▲−1.5 (X −3..−1, −2) on the car; ▼−1 (X −2..0, −1) on its right side (slant lock), point on the car at X −1, top h;
//    ■−1 (X −2..0, −1) whole on that top (flat lock), its corner on ▲−1.5's apex; ■0 (X 0..2, 1) at h half on ▼0.5's
//    top X 1..2 (no lock: Q rests on P) and beside ■−1 along a whole side (X 0, h … 1 + h: upright lock). Q is those
//    four. ▼1.5 (X 3..5, 4) on ▲1's right side (slant lock), point on the car at X 4; ▲1.5 (X 3..5, 4) whole on its top
//    at h (flat lock); ▼1 (X 2..4, 3) on ▲1.5's left side (slant lock), point on ▲1's apex (X 3, h), top 2h; ■1 (X 2..4,
//    3) whole on that top (flat lock); its left side meets ■0's right side only over 2h … 1 + h (no lock). ▲−0.5 (X
//    −1..1, 0) at 1 + h on the tops of ■−1 and ■0, half on each (no lock: P will rest on Q); ▼0 (X 0..2, 1) on its
//    right side (slant lock), point on ■0's top (X 1); ■1 again (3) whole on the lower ■1 at 1 + 2h (flat lock); ■0 (1)
//    at 1 + 2h whole on ▼0's top (flat lock) and beside the upper ■1 (X 2, 1 + 2h … 2 + 2h: upright lock), which joins
//    ▲−0.5 and ▼0 to ▲1's piece: P. P rests on Q (▲−0.5, ▼0) and Q on P (■0 on ▼0.5), so each group holds the other
//    piece: one group of 14, standing on the car X −3..−1 (▲−1.5), X −1 (▼−1's point), X 2..4 (▲1), X 2 (▼0.5's point)
//    and X 4 (▼1.5's point). Then a stair to the right, all locked into P: ▼2 (X 4..6, 5) on ▲1.5's right side, point
//    on ▼1.5's top corner (X 5, h), top 2h; ▲2 (5) whole on that top; ▼2.5 (X 5..7, 6) on ▲2's right side, point on
//    ▼2's top corner (X 6, 2h), top 3h. Then ■3 (X 6..8, 7) at 3h, half on ▼2.5's top X 6..7 (no lock), and five more
//    ■3 on it (flat locks): a column R of six, its middle X 7 exactly over the end of X 6..7 (balanced). The big group
//    (all 23) stands on X −3..4: right, past 4, squares X −1, 1, 3, 3, 1 and six at 7, triangles 3, 2, −2, −1, 4, 4, 3,
//    0, 1, 5, 5, 6: 4·(−5 − 3 − 1 − 1 − 3 + 6·3) + √3·(−1 − 2 − 6 − 5 + 0 + 0 − 1 − 4 − 3 + 1 + 1 + 2) = 20 − 18√3 < 0:
//    balanced, and every earlier drop fits. The new ■3 lands whole on R's top at 6 + 3h (flat lock, into R): R's group
//    (seven) stays exactly over X 7; the big group (24) gets 4·3 more: 32 − 18√3 > 0 (1024 > 972), it tips right. It is
//    both P's group and Q's, both pieces' lowest point is 0 and both groups have 24 tiles: the col decides. Q's lowest
//    tiles ▲−1.5 (col −3) and ▼−1 (col −2), P's ▲1 (col 2), ▼0.5 (col 1) and ▼1.5 (col 3): Q, base ▲−1.5 (the larger
//    col would take P, base ▼0.5). Members 24, right; pivot: at X 4 the support has only (4, 0) (▲1's corner and
//    ▼1.5's point). The game's form: base 2, members 0 … 23, centre of weight (Σ■ x + √3/4·Σ▲▼ x)/(12 + 12·√3/4) =
//    (28 + 15√3/4)/(12 + 3√3) = 2.0060.
// The prop cases (5e), by hand, each telling one wrong reading of SPEC §5c's props apart (tools/rules/mutants.json):
// P1 (a prop on the other side does not count; props-either-side). ■−2 (X −4..−2) on the car, top at 1. ▲−1 (X −2..0)
//    on the car; ▼−0.5 (X −1..1) on its right side (slant lock), point on the car at X 0, top at h. ■−1 (X −2..0) stops
//    at h on ▲−1's apex (X −1) and half on ▼−0.5's top (X −1..0, no lock); its left side meets ■−2's right side over
//    X −2, h … 1 (upright, no lock). Its group (itself) stands on X −1..0 with its middle X −1 at the end: no lean. ■0
//    (X 0..2) stops at h half on ▼−0.5's top (X 0..1) and beside ■−1 along a whole side (upright lock): the piece
//    {■−1, ■0} stands on X −1..1, middles −1, 1: no lean. The group of {▲−1, ▼−0.5} (with the two squares, 4 tiles) on
//    the car X −2..0: right past 0, 4·(−1 + 1) + √3·(−1 + 0) < 0: no lean. The new ■0 lands whole on ■0's top at 1 + h
//    (flat lock); the corner of ■−1 it touches lies on that segment. The squares' group (three) on X −1..1: middles −1,
//    1, 1, right past 1: −8 < 0: no lean. The group of {▲−1, ▼−0.5} (five): middles ▲ −1, ▼ 0, ■ −1, 1, 1 over X −2..0:
//    right past 0, 4·(−1 + 1 + 1) + √3·(−1 + 0) = 4 − √3 > 0: it leans right, pivot (0, 0). Its squares' right sides
//    (X 0 inside the group, X 2) meet nothing outside it; ■−1's left side presses on ■−2 above the pivot, but that is
//    the side away from the lean: no prop. TIPS OVER: base ▲−1 (the piece's lowest tiles ▲−1 and ▼−0.5, the smaller col
//    ▲−1's), members 5, right, pivot (0, 0, 0). The game's form: base 1, members [1 … 5], centre of weight
//    (½ − √3/8)/(3 + √3/2). With ■−2 at the right instead (■1 on the car, golden 19 moved one tile right) it stands.
// P2 (a prop is judged by its upper end, not its lower; prop-height-lower-end). ■−2, ▲−1, ▼−0.5 and ■−1 as in P1.
//    ▲−1.5 (X −3..−1) stops at 1 + h half on ■−1's top (X −2..−1, no lock); under its other half ■−2's top is h lower
//    (gap √3/2). Its own group (itself) on X −2..−1, its middle X −2 at the end: no lean. ■−1's group, {■−1, ▲−1.5},
//    stands on ▲−1's apex and ▼−0.5's top, X −1..0: middles ■ −1, ▲ −2; left past −1: 4·0 + √3·(−1 + 2) = √3 > 0: it
//    leans left, pivot (X −1, h) (the apex, and the end of the ▼'s top). Prop: ■−1's left side presses on ■−2 (outside
//    it) over X −2, h … 1: its lower end is level with the pivot, its upper end 1 is above it: propped. The group of
//    {▲−1, ▼−0.5} (four) on the car X −2..0: middles −1, 0, −1, −2: left past −2, 4·(−1) + √3·(−1 − 2 + 0) < 0, right
//    past 0 < 0: no lean. ■−2 alone: no lean. Fit. props(): the group [3, 4], left, pivot (−1, 0, 1), tile 3 on tile 0
//    along X −2 from h to 1.
// P3 and P8 (a contact level with the pivot, or wholly below it, does not prop; prop-height-at-pivot and
//    prop-height-ignored). No build of up to 8 tiles has one (exhaustive), nor did 300,000 random games of up to 16
//    tiles on half 2 and 3: the group must stand on the square it presses on (or on something as high beside it) and
//    still lean toward it past its far end, against the weight of the square that presses. Both were built by hand.
//    The footing for both: ▲−2 (X −4..−2) and ▲−1 (X −2..0) on the car, ▼−1.5 (X −3..−1) in their notch (slant locks:
//    one piece Q, on the car X −4..0), top h. ■−1 (X −2..0), the presser U, stops at h half on ▼−1.5's top (X −2..−1)
//    and on ▲−1's apex (X −1): alone its middle X −1 is at the end of X −2..−1. ■0 (X 0..2), the square pressed on, V,
//    on the car: U's right side meets V's left side over X 0, h … 1 (upright, no lock), so its upper end is at 1.
// P3. ▲−1 (X −2..0) whole on U's top at 1 + h (flat lock): U and it stand on X −2..−1 with both middles at X −1, the
//    end (no lean). ▲0.5 (X 1..3) stops at 1 half on V's top (X 1..2; over X 2..3 the car, 1 lower), alone with its
//    middle X 2 at the end. ▼0 (X 0..2) hangs on ▲0.5's left side (slant lock), its point (X 1, 1) on V's top, top at
//    1 + h; its top-left corner meets U's top-right corner. ▼−0.5 (X −1..1) hangs on the upper ▲−1's right side (slant
//    lock), its point (X 0, 1 + h) on ▼0's top-left corner: it rests on ▼0 (beside that corner its inside is straight
//    over ▼0's). (In the other order ▼0 could not get under ▼−0.5's free half.) ▼1 (X 2..4) hangs on ▲0.5's right side
//    (slant lock), its point (X 3, 1) over the bare car, top at 1 + h; ■1 (X 2..4) whole on that top (flat lock), and
//    four more ■1 on it (flat locks). Pieces: Q; {V}; U's, {U, ▲−1, ▼−0.5}; A = {▲0.5, ▼0, ▼1, the ■1s}. A's group is A,
//    and ▼−0.5's piece (it rests on ▼0): it stands on V's top (▲0.5's half base X 1..2, ▼0's point X 1, both at 1) and,
//    through U, on Q (X −2..−1 at h): X −2..2, and at X 2 the only support point is (2, 1). Middles (X): U −1, ▲−1 −1,
//    ▼−0.5 0, ▼0 1, ▲0.5 2, ▼1 3, the squares 3. Right past 2 with m squares: 4·(−3 + m) + √3·(−3 − 2 − 1 + 0 + 1)
//    = 4m − 12 − 5√3: m = 5 gives 8 − 5√3 < 0 (64 < 75), so every drop before the last fits (and every earlier group:
//    ▼1 alone on half-held ▲0.5 would tip, but ▼−0.5's piece is already on A). The new ■1 lands whole on the fifth at
//    6 + h (flat lock), m = 6: 12 − 5√3 > 0 (144 > 75): A's group leans right over (2, 1). Its only upright contact
//    with a tile outside it is U's on V, on U's right side, toward the lean, but its upper end 1 is level with the
//    pivot, not above: no prop. The other groups: V's (V and A's group, on the car X 0..2 and on Q at X −2..−1): right
//    past 2, 12 − 5√3 − 4 < 0 (64 < 75); U's piece's (the three, on Q X −2..−1 and on ▼0's corner X 0): right past 0,
//    −4 − √3 < 0; Q's (Q and U's piece, on the car X −4..0 and ▼0's corner): balanced. TIPS OVER: A's lowest tiles are
//    ▲0.5 (col 1), ▼0 (col 0) and ▼1 (col 2), all at 1: base ▼0, members 12, right, pivot (2, 2, 0). Its contacts: the
//    fifth square's top. The game's form: base 7, members [3, 5 … 15], centre of weight (Σ■ x + √3/4·Σ▲▼ x)/(7 + 5√3/4)
//    = (8.5 + 2.5·√3/4)/(7 + 5√3/4) = 1.0455.
// P8. ■1 (X 2..4) on the car beside V (upright lock), ▲1 (X 2..4) whole on its top (flat lock), ▼0.5 (X 1..3) hung on
//    its left side (slant lock), point (X 2, 1) on the two squares' corner, top at 1 + h: V's piece W = {V, ■1, ▲1,
//    ▼0.5}, on the car X 0..4. ▲−1 whole on U's top at 1 + h (flat lock). ▲0 (X 0..2) stops at 1 + h half on ▼0.5's
//    top (X 1..2; over X 0..1, V's top h lower), alone with its middle X 1 at the end. ▼−0.5 (X −1..1) in the notch of
//    the upper ▲−1 and ▲0 (slant locks), point (X 0, 1 + h). ▼0.5 (X 1..3) hung on ▲0's right side (slant lock), its
//    point (X 2, 1 + h) on the lower ▼0.5's top, top at 1 + 2h. ■1 (X 2..4) stops at 1 + 2h half on that top (X 2..3),
//    and four more ■1 on it (flat locks): the column stands on X 2..3 with every middle at X 3, the end. U's piece is
//    now P = {U, ▲−1, ▼−0.5, ▲0, ▼0.5 (upper)}, and its group P and the column, on Q (X −2..−1 at h) and on the lower
//    ▼0.5's top (▲0's half base X 1..2 and the upper ▼0.5's point X 2, at 1 + h): X −2..2, and at X 2 the only support
//    point is (2, 1 + h). Middles: U −1, ▲−1 −1, ▼−0.5 0, ▲0 1, ▼0.5 2, the k squares 3. Right past 2:
//    4·(−3 + k) + √3·(−3 − 2 − 1 + 0) = 4k − 12 − 6√3: k = 5 gives 8 − 6√3 < 0 (64 < 108); the new ■1 (k = 6, at
//    6 + 2h) gives 12 − 6√3 > 0 (144 > 108): it leans right over (2, 1 + h). U's contact with V reaches only 1, below
//    the pivot: no prop. The other groups: W's (W, P and the column, on the car X 0..4 and on Q at X −2..−1): every
//    middle inside, balanced; Q's (Q, P and the column, on the car X −4..0 and the lower ▼0.5's top X 1..2): right past
//    2, 12 − 6√3 + √3·(−5 − 3 − 4) < 0; the column's own group stands exactly over X 3. TIPS OVER: P's lowest tile is U
//    (at h): base U, members 11, right, pivot (2, 2, 1). The game's form: base 3, members [3, 8 … 17], centre of weight
//    (8.5 + √3/4)/(7 + √3) = 1.0230.
// P4 (a contact at a single point does not prop; prop-at-a-point). ■−2 and ■−2 again (flat lock; X −4..−2, 0 … 2).
//    ■0 (X 0..2) on the car. ▲−0.5 (X −1..1) stops at 1 half on ■0's top (X 0..1, no lock; under its other half the car,
//    1 lower); alone it stands with its middle X 0 at the end. ▼−1 (X −2..0) hangs on ▲−0.5's left side (slant lock),
//    its point (X −1, 1) at ▲−0.5's corner, over air; its top-left corner (X −2, 1 + h) touches the upper ■−2's right
//    side at a point. The piece {▲−0.5, ▼−1} (nothing on it) stands on ■0's top X 0..1 only: middles ▲ 0, ▼ −1; left
//    past 0: √3·(0 + 1) > 0: it leans left, pivot (0, 1). Its tiles have no upright side, and the corner on ■−2's side
//    is a point: no prop. ■0's group (three, on the car X 0..2): left 4·(0 − 1) + √3·(0 + 1) < 0: no lean. TIPS OVER:
//    the piece's lowest tiles are ▲−0.5 (base at 1) and ▼−1 (point at 1), the smaller col ▼−1's: base ▼−1, members 2,
//    left, pivot (0, 2, 0); contacts: the slant [−1, 2, 0]–[0, 2, 1] and the point [−2, 2, 1]. The game's form: base 4,
//    members [3, 4], centre of weight −¼. No way given: ▲−1 would stop at 1 + h on ▲−0.5's apex and touch ■−2 at a
//    corner (only points), so ▼ (it tips over).
// P5 (the new tile itself presses; props-new-tile-ignored). ■−2 (X −4..−2) on the car. ▲0 (X 0..2) on the car; ▼−0.5
//    (X −1..1) on its left side (slant lock), point on the car at X 0, top at h. ■−1 (X −2..0) stops at h half on
//    ▼−0.5's top (X −1..0, no lock), its left side on ■−2's right side over X −2, h … 1 (upright, no lock); under its
//    left half the car, h lower (gap √3/2). Its own group (itself) on X −1..0, middle X −1 at the end: no lean. The group
//    of {▲0, ▼−0.5} (with it, three) stands on the car X 0..2 (▲0's base, ▼−0.5's point at X 0): middles ▲ 1, ▼ 0, ■ −1;
//    left past 0, 4·(0 + 1) + √3·(0 − 1 + 0) = 4 − √3 > 0: it leans left, pivot (0, 0). Prop: the new ■−1 presses with
//    its left side on ■−2 (outside) up to 1 > 0: propped. Fit. props(): the group [1, 2, 3], left, pivot (0, 0, 0),
//    tile 3 on tile 0 along X −2 from h to 1. (Golden 19 at its fourth tile, mirrored, with the pressing square new.)
// P6 (a square placed beside a group later still props it; prop-one-way-record). Golden 19's tiles, ■0 dropped fifth:
//    ▲−2, ▼−1.5, ■−2, ■−1 as there (■−2 and ■−1 locked side by side, the group of {▲−2, ▼−1.5} with them over X −4..−2:
//    right 4·(−1 + 1) − √3 < 0, no lean); ■0 on the car, its left side meeting ■−1's right side over X 0, h … 1; then
//    the new ■−1 on ■−1: as golden 19 (the five lean right over (−1, 0) and ■−1 presses on ■0 above it): fit. props():
//    the group [0, 1, 2, 3, 5], right, pivot (−2, 0, 0), tile 3 on tile 4.
// P7 (a contact inside the group does not prop it; prop-inside-group; found at depth 8, the smallest there is).
//    ▲−1.5 (X −3..−1) on the car; ▼−2 (X −4..−2) on its left side (slant lock), point on the car at X −3, top h; ■−2
//    (X −4..−2) whole on that top (flat lock); ▼−1 (X −2..0) on ▲−1.5's right side (slant lock), point on the car at
//    X −1, top h; ▲−1 (X −2..0) whole on that top (flat lock), apex (X −1, 2h); ▼−0.5 (X −1..1) on ▲−1's right side
//    (slant lock), point on ▼−1's top corner (X 0, h), top 2h. Those six are one piece, A, on the car X −3..−1 (▲−1.5's
//    base and the two ▼ points). ■−1 (X −2..0) stops at 2h on ▲−1's apex and half on ▼−0.5's top (no lock); its left
//    side meets ■−2's right side over X −2, 2h … 1 + h (upright, no lock). ■0 (X 0..2) at 2h half on ▼−0.5's top, beside
//    ■−1 along a whole side (upright lock): piece B = {■−1, ■0}, on X −1..1, middles −1, 1: no lean. A's group (A and B)
//    over X −3..−1: middles ▲ −2, ▼ −3, ■ −3, ▼ −1, ▲ −1, ▼ 0, ■ −1, ■ 1; right past −1, 4·(−2 + 0 + 2) + √3·(−1 − 2 +
//    0 + 0 + 1) = −2√3 < 0: no lean. The new ■0 lands whole on ■0's top at 1 + 2h (flat lock; ■−1's corner lies on that
//    segment): B's group (three) on X −1..1, middles −1, 1, 1, right past 1: −8: no lean. A's group (nine): right past
//    −1, 4·(−2 + 0 + 2 + 2) − 2√3 = 8 − 2√3 > 0: it leans right, pivot (−1, 0) (▲−1.5's corner and ▼−1's point). Its
//    squares' right sides meet nothing outside it (X 0 is ■0, locked; X 2 nothing); ■−2's right side presses on ■−1
//    above the pivot, but ■−1 is in the same group: no prop. TIPS OVER: A's lowest tiles ▲−1.5 (col −3), ▼−2 (col −4)
//    and ▼−1 (col −2): base ▼−2, members 9, right, pivot (−1, 0, 0). The game's form: base 1, members [0 … 8], centre of
//    weight (Σ■ x + √3/4·Σ▲▼ x)/(4 + 5√3/4) = (−1 − 3.5·√3/4)/(4 + 5√3/4).
const REGRESSION = [
  { n: 'R1', drops: ['▲-2', '▲-0.5', '▼-1.5', '▼0', '▲-0.5', '▼-1', '▲-1', '▼-1.5'], last: '■-2', title: 'the pivot is the lowest support point at the group\'s end',
    expect: { outcome: 'off', way: null, verts: [[-4, 0, 3], [-4, 2, 3], [-2, 0, 3], [-2, 2, 3]], reason: 'TIPS OVER',
      contacts: { segments: [S([-3, 0, 3], [-2, 0, 3])], points: [] }, shine: [], gap: null,
      tips: { base: [[-1, 0, 0], [0, 0, 1], [1, 0, 0]], members: 7, side: 'left', pivot: [-1, 0, 0] } },
    also: { game: { base: 1, members: [1, 3, 4, 5, 6, 7, 8], com: (1 * -1.5 + Math.sqrt(3) / 4 * (0 + 0.5 + 0 - 0.5 - 0.5 - 1)) / (1 + 6 * Math.sqrt(3) / 4) } } },
  { n: 'R2', drops: ['▲-2', '▼-2.5', '▼-1.5', '▲-2.5', '▼-2', '■-1'], last: '▲-1', title: 'a locked piece on half an edge, exactly over its end, stays',
    expect: { outcome: 'fit', way: 'up', verts: [[-2, 2, 1], [-1, 2, 2], [0, 2, 1]], reason: null,
      contacts: { segments: [S([-2, 2, 1], [0, 2, 1])], points: [] }, shine: [S([-2, 2, 1], [0, 2, 1])], gap: null, tips: null },
    also: { auto: { outcome: 'fit', way: 'up', reason: null } } },
  { n: 'R3', drops: ['■-1', '■1', '▲-0.5', '▲1.5', '▼-1', '▼0', '▼1', '■1'], last: '■0', title: 'a square locked to two pieces joins them into one, which stands on both sides',
    expect: { outcome: 'fit', way: null, verts: [[0, 2, 1], [0, 4, 1], [2, 2, 1], [2, 4, 1]], reason: null,
      contacts: { segments: [S([0, 2, 1], [2, 2, 1]), S([2, 2, 1], [2, 4, 1])], points: [] }, shine: [S([0, 2, 1], [2, 2, 1]), S([2, 2, 1], [2, 4, 1])], gap: null, tips: null },
    also: { oneSide: [4, 5, 6] } },
  { n: 'R4', drops: ['▲-2.5', '▲-1', '▼-0.5', '■-1', '▼-2', '■-2', '▲-1', '▼-0.5', '■0', '▲0', '■-1', '▼0.5', '▲-1.5', '▲0.5', '▼0', '▲-0.5', '▼1', '■1'], last: '■1',
    title: 'two groups tip from the same lowest point: the larger is reported',
    expect: { outcome: 'off', way: null, verts: [[2, 6, 4], [2, 8, 4], [4, 6, 4], [4, 8, 4]], reason: 'TIPS OVER',
      contacts: { segments: [S([2, 6, 4], [4, 6, 4])], points: [] }, shine: [], gap: null,
      tips: { base: [[-2, 0, 0], [-1, 0, 1], [0, 0, 0]], members: 19, side: 'right', pivot: [0, 0, 0] } },
    also: { oneSide: [2, 4, 7, 11, 14, 16], game: { base: 1, members: Array.from({ length: 19 }, (_, i) => i), com: (1 - Math.sqrt(3) / 4) / (6 + 13 * Math.sqrt(3) / 4) } } },
  { n: 'R5', half: 4, drops: ['▲1', '▼0.5', '▲-1.5', '▼-1', '■-1', '■0', '▼1.5', '▲1.5', '▼1', '■1', '▲-0.5', '▼0', '■1', '■0', '▼2', '▲2', '▼2.5', '■3', '■3', '■3', '■3', '■3', '■3'], last: '■3',
    title: 'two pieces resting on each other share one group: when it tips, the smaller col is reported (half 4)',
    expect: { outcome: 'off', way: null, verts: [[6, 12, 3], [6, 14, 3], [8, 12, 3], [8, 14, 3]], reason: 'TIPS OVER',
      contacts: { segments: [S([6, 12, 3], [8, 12, 3])], points: [] }, shine: [], gap: null,
      tips: { base: [[-3, 0, 0], [-2, 0, 1], [-1, 0, 0]], members: 24, side: 'right', pivot: [4, 0, 0] } },
    also: { oneSide: [1, 3, 6, 8, 11, 14, 16], game: { base: 2, members: Array.from({ length: 24 }, (_, i) => i), com: (28 + 15 * Math.sqrt(3) / 4) / (12 + 3 * Math.sqrt(3)) } } },
  { n: 'P1', drops: ['■-2', '▲-1', '▼-0.5', '■-1', '■0'], last: '■0', title: 'a square pressing on the side away from the lean does not prop it',
    expect: { outcome: 'off', way: null, verts: [[0, 2, 1], [0, 4, 1], [2, 2, 1], [2, 4, 1]], reason: 'TIPS OVER',
      contacts: { segments: [S([0, 2, 1], [2, 2, 1])], points: [] }, shine: [], gap: null,
      tips: { base: [[-2, 0, 0], [-1, 0, 1], [0, 0, 0]], members: 5, side: 'right', pivot: [0, 0, 0] } },
    also: { oneSide: [2], game: { base: 1, members: [1, 2, 3, 4, 5], com: (0.5 - Math.sqrt(3) / 8) / (3 + Math.sqrt(3) / 2) }, props: [] } },
  { n: 'P2', drops: ['■-2', '▲-1', '▼-0.5', '■-1'], last: '▲-1.5', title: 'a prop is judged by its upper end: a contact rising from the pivot\'s height props',
    expect: { outcome: 'fit', way: 'up', verts: [[-3, 2, 1], [-2, 2, 2], [-1, 2, 1]], reason: null,
      contacts: { segments: [S([-2, 2, 1], [-1, 2, 1])], points: [] }, shine: [S([-2, 2, 1], [-1, 2, 1])], gap: [0, 1], tips: null },
    also: { oneSide: [2], props: [{ members: [3, 4], side: 'left', pivot: [-1, 0, 1], props: [{ tile: 3, by: 0, seg: [[-2, 0, 1], [-2, 2, 0]] }] }] } },
  { n: 'P3', drops: ['▲-2', '▲-1', '▼-1.5', '■-1', '■0', '▲-1', '▲0.5', '▼0', '▼-0.5', '▼1', '■1', '■1', '■1', '■1', '■1'], last: '■1', title: 'a contact whose upper end is level with the pivot does not prop',
    expect: { outcome: 'off', way: null, verts: [[2, 12, 1], [2, 14, 1], [4, 12, 1], [4, 14, 1]], reason: 'TIPS OVER',
      contacts: { segments: [S([2, 12, 1], [4, 12, 1])], points: [] }, shine: [], gap: null,
      tips: { base: [[0, 2, 1], [1, 2, 0], [2, 2, 1]], members: 12, side: 'right', pivot: [2, 2, 0] } },
    also: { notch: [2], oneSide: [7, 8, 9], game: { base: 7, members: [3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], com: (8.5 + 2.5 * Math.sqrt(3) / 4) / (7 + 5 * Math.sqrt(3) / 4) }, props: [] } },
  { n: 'P8', drops: ['▲-2', '▲-1', '▼-1.5', '■-1', '■0', '■1', '▲1', '▼0.5', '▲-1', '▲0', '▼-0.5', '▼0.5', '■1', '■1', '■1', '■1', '■1'], last: '■1', title: 'a contact wholly below the pivot does not prop',
    expect: { outcome: 'off', way: null, verts: [[2, 12, 2], [2, 14, 2], [4, 12, 2], [4, 14, 2]], reason: 'TIPS OVER',
      contacts: { segments: [S([2, 12, 2], [4, 12, 2])], points: [] }, shine: [], gap: null,
      tips: { base: [[-2, 0, 1], [-2, 2, 1], [0, 0, 1], [0, 2, 1]], members: 11, side: 'right', pivot: [2, 2, 1] } },
    also: { notch: [2, 10], oneSide: [7, 11], game: { base: 3, members: [3, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], com: (8.5 + Math.sqrt(3) / 4) / (7 + Math.sqrt(3)) }, props: [] } },
  { n: 'P4', drops: ['■-2', '■-2', '■0', '▲-0.5'], last: '▼-1', title: 'a corner touching a square\'s side, a point, does not prop',
    expect: { outcome: 'off', way: 'down', verts: [[-2, 2, 1], [-1, 2, 0], [0, 2, 1]], reason: 'TIPS OVER',
      contacts: { segments: [S([-1, 2, 0], [0, 2, 1])], points: [[-2, 2, 1]] }, shine: [], gap: null,
      tips: { base: [[-2, 2, 1], [-1, 2, 0], [0, 2, 1]], members: 2, side: 'left', pivot: [0, 2, 0] } },
    also: { auto: { outcome: 'off', way: 'down', reason: 'TIPS OVER' }, game: { base: 4, members: [3, 4], com: -0.25 }, props: [] } },
  { n: 'P5', drops: ['■-2', '▲0', '▼-0.5'], last: '■-1', title: 'the new square itself presses on the square beside it',
    expect: { outcome: 'fit', way: null, verts: [[-2, 0, 1], [-2, 2, 1], [0, 0, 1], [0, 2, 1]], reason: null,
      contacts: { segments: [S([-2, 0, 1], [-2, 2, 0]), S([-1, 0, 1], [0, 0, 1])], points: [] }, shine: [S([-2, 0, 1], [-2, 2, 0]), S([-1, 0, 1], [0, 0, 1])], gap: [0, 1], tips: null },
    also: { oneSide: [2], props: [{ members: [1, 2, 3], side: 'left', pivot: [0, 0, 0], props: [{ tile: 3, by: 0, seg: [[-2, 0, 1], [-2, 2, 0]] }] }] } },
  { n: 'P6', drops: ['▲-2', '▼-1.5', '■-2', '■-1', '■0'], last: '■-1', title: 'a square placed beside a group after it still props it (golden 19 in another order)',
    expect: { outcome: 'fit', way: null, verts: [[-2, 2, 1], [-2, 4, 1], [0, 2, 1], [0, 4, 1]], reason: null,
      contacts: { segments: [S([-2, 2, 1], [0, 2, 1])], points: [] }, shine: [S([-2, 2, 1], [0, 2, 1])], gap: null, tips: null },
    also: { oneSide: [1], props: [{ members: [0, 1, 2, 3, 5], side: 'right', pivot: [-2, 0, 0], props: [{ tile: 3, by: 4, seg: [[0, 0, 1], [0, 2, 0]] }] }] } },
  { n: 'P7', drops: ['▲-1.5', '▼-2', '■-2', '▼-1', '▲-1', '▼-0.5', '■-1', '■0'], last: '■0', title: 'a contact between two tiles of the same group does not prop it',
    expect: { outcome: 'off', way: null, verts: [[0, 2, 2], [0, 4, 2], [2, 2, 2], [2, 4, 2]], reason: 'TIPS OVER',
      contacts: { segments: [S([0, 2, 2], [2, 2, 2])], points: [] }, shine: [], gap: null,
      tips: { base: [[-4, 0, 1], [-3, 0, 0], [-2, 0, 1]], members: 9, side: 'right', pivot: [-1, 0, 0] } },
    also: { oneSide: [1, 3, 5], game: { base: 1, members: [0, 1, 2, 3, 4, 5, 6, 7, 8], com: (-1 - 3.5 * Math.sqrt(3) / 4) / (4 + 5 * Math.sqrt(3) / 4) }, props: [] } }
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
      const B = canon.replay(R, c.half || 2, c.log);
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
        // the groups props() names as propped in the build the drop leaves (the build itself when it does not fit)
        if (c.also && c.also.props) {
          if (typeof R.props !== 'function') fails.push('rules.js has no props()');
          else {
            const after = res.outcome === 'fit' ? R.place(B, res) : B;
            const got = JSON.stringify(R.props(after)), want = JSON.stringify(c.also.props);
            if (got !== want) fails.push('props() ' + got + ' want ' + want);
          }
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
  const title = n => n === 'way' ? 'SPEC §6 way choice on made-up results (' + WAYS.length + ' pairs)' : typeof n === 'string' ? '(regression) ' + REGRESSION.find(c => c.n === n).title : CASES[n - 1].title;
  for (const x of res) if (!quiet || !x.ok) console.log((x.ok ? 'PASS' : 'FAIL') + ' golden ' + x.n + ' ' + title(x.n) + (x.ok ? '' : ': ' + x.msg));
  const bad = res.filter(x => !x.ok).length;
  console.log((bad ? 'FAIL' : 'PASS') + ' golden: ' + (res.length - bad) + '/' + res.length);
  process.exit(bad ? 1 : 0);
}
