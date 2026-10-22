# Ambiguities and choices (oracle for SPEC.md revision 5)

Coordinates are written as in the spec: a point is `[X, p, q]`, meaning x = X/2 and y = (p + q·√3)/2. `h = √3/2`. Tokens like `▼2` mean x = col/2 = 2, so col 4.

## A. A golden case that disagrees with §1–8

### A1. Golden 5: `▲1, ▼1.5, ▲1.5, then ▼2` expects "off, TOO FAR OUT". §2 says the drop throws.
- `▼2` is col 4, so the tile spans x 2..3. That is entirely outside the car (half = 2, car x ∈ [−2, 2]).
- §2 allows triangle cols −5 … 3 for half = 2 and says "throw outside them". It also says a triangle can stick out at most half a tile.
- **What I chose:** the oracle follows §2 and **throws** on col 4. The expectation in `test-golden.cjs` is left unchanged, so `node test-golden.cjs` reports golden 5 as FAIL and exits 1 (11/12 pass).
- **What the geometry gives if the col table is ignored:** `newBuild({half: 2, strictCols: false})` (an option that is not in the spec; it only skips the col table) gives:
  - ▼ at col 4 rests with its point at (2.5, h), on ▼1.5's top-right corner. Its left side coincides with ▲1.5's right slant `[[4,0,2],[5,0,1]]`.
  - Left strip = ▲1.5's right strip = false. The right strip is free, and there is no flat top under it at height h, so it is false.
  - Result: off, TOO FAR OUT, strips `[false, false]`. This matches the expectation. `node test-golden.cjs --loose-cols` passes 12/12.
- So the conflict is only between the §2 col table and the golden case, not in the placement rules. One of the two must change. Either golden 5's last drop is not meant to be legal (the mirror of golden 6, `▼−2`, is legal), or the col range is wider than §2 states.

## B. Points the spec leaves undecided

1. **How `drop` is called.** §2 gives `(piece, col, way?)` but does not say how the build is passed. I chose `drop(build, piece, col, way)`. `drop(build, {piece, col, way})` is also accepted.
2. **`newBuild()` with no argument** uses half = 2. half must be a positive integer, otherwise it throws.
3. **`way` given for a square:** throws ("way is only for triangles"). Other things that throw:
   - a `way` other than `'up'`, `'down'`, `undefined` or `null`;
   - a piece other than `'sq'` or `'tri'`;
   - a col that is not an integer;
   - an argument that is not a build.
   An omitted, `undefined` or `null` way on a triangle means the §6 auto choice.
4. **What `place` accepts.** §8 says the result has exactly the listed keys, so `place` rebuilds the tile from `way` (null means square), `verts` (col = min X) and `strips`. It then checks that `drop(build, piece, col, way)` on this build returns a deep-equal result, and throws if not. Placing a result from another build state therefore throws. Placing an off result throws, as §7 says. Builds are frozen, and `place` returns a new one.
5. **Strips of a ▼ that is NO SIDE.** §5c gives strip rules for a ▼ "with a side" and for the "free half of a ▼ held by one side". It does not cover a ▼ with no side. I apply the free-half (pocket) rule to both strips: a strip is on the tower iff a flat top at exactly the point's height covers it and that top's strip is on the tower. Example: `■0` then `▼0` → off, NO SIDE, strips `[true, true]`.
6. **Strips of an off square or ▲** are computed with the same rule as for a fit. A NOT LEVEL tile can therefore report one true strip (for example golden 7 reports `[true, false]`).
7. **The NOT LEVEL gap when the maximum is not reached.** S(x) can jump at a vertical side, and then max(y0 − S) is a supremum that is never reached. I report the supremum.
   - Example: `■0, ▲1, ▲0.5`. The ▲ rests at y = 1. On x ∈ (1, 1.5] S comes from ▲1's left slant, which tends to 0 as x → 1⁺. At x = 1 itself S = 1, because the square's corner is there.
   - I report gap = 1, which is `[2, 0]`.
8. **Value of S(x) at the ends of B.** A side neighbour can have boundary points at x0 or x0+1 above y0, for example a taller square beside the tile. S there is the highest boundary point ≤ y0, and boundary points above y0 are ignored. This never changes a decision, since the ends have zero length, and S is upper semicontinuous so the gap is unaffected.
9. **Whether to merge contact segments.**
   - Segments are kept per neighbour and never merged across neighbours. For example, golden 2's square has two bottom segments that meet over ▲−1's apex.
   - Within one neighbour no merging is ever needed, because convex tiles have no collinear edges.
   - Two neighbours never share a positive-length piece of the tile's boundary, so no segment appears twice.
10. **Contact points are global.**
    - A point is dropped if it lies on any contact segment, including a segment with a different neighbour (§8).
    - A point touching several neighbours is listed once.
    - The car counts only by its top segment `[-half, half] × {0}`. Its sides are only below y = 0, and no tile reaches them. A ▼ point resting on the car's end corner is a contact point, for example `▼` at col 3 on a bare car gives `points [[4,0,0]]`.
11. **Sorting.** "Lexicographically" is taken as numeric lexicographic order on the integer triple `[X, p, q]`: X first, then p, then q. That is not the real-y order. For example `[0,0,2]` (y = √3) sorts before `[0,2,0]` (y = 1). Segments are sorted by their first endpoint, then their second.
12. **"Nothing at all below" (§3).**
    - "Below" means any placed tile or the car whose x-range overlaps the tile's open x-range. The car counts as the region y ≤ 0 within [−half, half].
    - This cannot happen within the §2 cols. It can happen only with `strictCols: false`, and then `drop` throws.
    - The floor "far below" never counts as support, so it is not an obstacle and does not count for OVER THE EDGE.
13. **A flat top must be single and aligned.** A square or ▲ strip is on the tower only if one flat top at exactly y0 covers the whole strip and that top's own strip there is on the tower. All x-boundaries are multiples of ½, so a strip is never split between two tops and never covers part of a top's strip.
14. **"Coincides exactly" for a ▼ side** means the same segment, same endpoints. On the half grid a partial overlap of a ▼ side with a ▲ slant cannot happen. The oracle checks any ▲ edge, and only the right slant (for the ▼'s left side) or the left slant (for its right side) can ever match, as the spec says.
15. **A ▼ is never judged OVER THE EDGE or NOT LEVEL.** §5b only has NO SIDE and TOO FAR OUT. So a ▼ hung by one side with its free half over air beyond the car fits (golden 4), and `gap` is always null for a ▼.
16. **The car as a polygon.** The car is a rectangle x ∈ [−half, half], y ∈ [−10⁶, 0]. That is exact for every reachable state, because no tile goes below y = 0.
17. **`strictCols: false`** (my addition, default `true`) only removes the §2 col table. Squares still need an even col. It exists to show golden 5's geometry and to test the rules beyond the car ends.
18. **A square is never OVER THE EDGE within the §2 cols,** because the car lies under its whole x-range. The square OVER THE EDGE results in my tests come only from `strictCols: false`.

## C. ▲ and ▼ both fitting at one col

**Observation: they never both fit.** No col ever had both a fitting ▲ and a fitting ▼. `test-own.cjs` checked this in two ways:
- every triangle col at each of 4,000 states of builds grown from random fits, with half 1, 2 and 3;
- the cols of 4,121 more random states, including half 4 and 50 and runs with `strictCols: false`.

**Reasoning, for the same build and col c (x0 = c/2):**
- **If ▲ fits:**
  - Its whole base [x0, x0+1] lies on flat tops at height y0, and nothing in the open range (x0, x0+1) is above y0.
  - A ▼ falling there has its lowest point at x0+½, so it stops with its point on the flat top at y0.
  - For one of its sides to coincide with a ▲ slant, that ▲ would have to fill the space just above the flat top inside (x0, x0+1). That space is empty. So the ▼ is NO SIDE.
- **If ▼ fits:**
  - At least one side, say the left, lies on a ▲'s right slant. That ▲ spans [x0−½, x0+½] with its apex at (x0, y▼ + h).
  - Nothing is above that slant inside (x0, x0+½), because the ▼ fell through there.
  - A ▲ at col c rests at y0 ≥ y▼ + h, the apex height. On (x0, x0+½), S(x) is that slant, which lies strictly below y0.
  - So that ▲ is ONLY A POINT, OVER THE EDGE or NOT LEVEL, never a fit. The right side is the mirror case.

**Consequence for §6:** steps 1 and 2 never compete. When `way` is omitted and the result fits, it is the only way that fits at that col. Rule 3 still matters for off results: a ▼ that is TOO FAR OUT is chosen over ▲'s reason. For example, golden 6's last drop with the way omitted gives ▼, TOO FAR OUT.
