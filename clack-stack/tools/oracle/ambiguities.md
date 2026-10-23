# Ambiguities and choices (oracle for SPEC.md revision 5b)

Coordinates are written as in the spec: a point is `[X, p, q]`, meaning x = X/2 and y = (p + q·√3)/2. `h = √3/2`. Tokens like `▼2` mean x = col/2 = 2, so col 4. `■`, `▲`, `▼` are square, up and down triangle.

## A. Golden cases

All 12 golden cases of §9 agree with my reading of §1–8. `node test-golden.cjs` passes 12/12 and exits 0. Nothing to log.
- The rev 5 conflict (old golden 5, `▼2` at col 4, outside the §2 cols) is gone: 5b has no such case. The oracle still throws outside the §2 col table.
- The non-spec `strictCols: false` option of rev 5 is removed. `newBuild` ignores option keys other than `half`, so `newBuild({half: 2, strictCols: false})` is an ordinary half-2 build and col 4 still throws.

## B. Does a triangle ever fit both ways at one col? Is the §6 tie rule ever needed?

**No, and no.** At no build state and no col do ▲ and ▼ both fit. So §6's "both fit" step, and the "equally low → ▼" tie inside it, are never used. When `way` is omitted, at most one way fits. If one fits, that way is returned. Otherwise ▲ is returned, off with ONLY A POINT.

**Proof** (for the same build and col c; x0 = c/2; ▼'s point is at (x0 + ½, yv)).
- Suppose ▼ fits by its left side. Then that side is the right slant of a placed ▲ L. L spans [x0 − ½, x0 + ½], has its base at yv and its apex at (x0, yv + h). The right side is the mirror case.
- **The ▲ at col c rests at y0 ≥ yv + h.** Its base's left end is at x = x0, directly over L's apex, and L's right slant goes down to the right from there. With the base at any y < yv + h, the ▲'s thin wedge just right of x0 overlaps L's interior just below its apex.
- **There is no horizontal top edge at height y0 ≥ yv + h over a positive length of [x0, x0 + 1].**
  - The ▼ fell straight down to its rest. So no tile interior meets the region it swept: {x0 < x < x0 + 1, y > V(x)}, where V is the ▼'s lower boundary.
  - V(x) < yv + h on the open interval.
  - A top edge at height t ≥ yv + h over an interval I of positive length has its tile's interior just below it. Those points lie in the swept region, which is a contradiction.
- So the ▲'s base lies on no top edge over any positive length. It is ONLY A POINT. The argument does not even need the half-tile grid.

**Census** (in `test-own.cjs`, default run, `own-full.log`): a ▲ and a ▼ fit together 0 times.
- **States covered:**
  - every triangle col at each of 4,000 states of random builds grown only from fits (half 1, 2, 3);
  - 102,436 cols at 4,164 states of the random cross-check runs (half 1, 2, 3, 4, 50).
- **Auto-way check:** at each of these states, the auto-way result is compared with §6 applied to the two forced results.
- **Checker cross-check:** `checker.cjs` also counts how often its own §6 both-fit branch runs. The count is 0.

**Unused choice:** "the way whose resting position is lower" is read as the smaller y0. For a ▲, y0 is the base height. For a ▼, it is the height of its point (§2). Both are the tile's lowest point. The oracle implements the rule, with the tie going to ▼, but no state reaches it.

## C. Points the spec leaves undecided

1. **`gap` on an off result is null.** §5a defines `gap` only "when the tile fits", and §8 says "as defined in §5". So every off result has `gap: null`, `reason: 'ONLY A POINT'` and `shine: []`. A ▼ always has `gap: null` (§5b).
2. **The "maximum" in the gap is often a supremum that is never reached. I report the supremum.**
   - **Why there is no maximum:** S(x) jumps up at a vertical side, because the highest boundary point there is the top of that side. Then y0 − S(x) gets arbitrarily close to a value it never reaches.
   - **Example:** `■0, ▲1, then ▲0.5`.
     - The ▲ rests at y = 1, on ■0's top over [0.5, 1], so it fits.
     - On x ∈ (1, 1.5], S is ▲1's left slant, which tends to 0 as x → 1⁺.
     - At x = 1 itself, S = 1, because ■0's right side reaches up to 1 there.
     - So sup(y0 − S) = 1, but no x in B reaches it. I report `gap = [2, 0]`.
   - **How common:** a temporary scan of 300 random builds found 949 fits with a gap. In 245 of them (about 26 %), the gap is such a supremum.
   - **Who would disagree:** an implementation that ignores vertical sides, or that takes one-sided limits, gets the same values as mine. One that takes the largest y0 − S(x) over x values where it is actually reached, counting vertical sides, gets a smaller gap in those cases.
3. **Value of S(x) at single points.**
   - **Vertical sides:** at an x where some element's x-range ends, its vertical side counts as boundary along its whole length.
   - **Points above B are ignored:** S is the highest boundary point at or below y0. If a vertical side crosses y0, S is y0, a point "on B".
   - **What the gap uses:** the infimum of S over the covered linear pieces (one-sided limits) together with the exact S at every breakpoint. Within the allowed cols, the exact S at a breakpoint never lowered the result: the independent checker uses limits only, and the two agree on every result.
4. **"Lies on a horizontal top edge" (§5a).**
   - **Which edges count:** only these, at exactly the height y0 of B:
     - the car top [−half, half] × {0};
     - a square's top edge;
     - a ▼'s top edge.
   - The fit test is the total length of B ∩ those edges, and that length must be positive.
   - **Edges that never count:** a ▲'s base and a square's bottom edge are not top edges. They can never be under B at y0 anyway.
   - **A single point is not enough:** a B that meets a top edge only at a point, such as a corner, an apex or the end of an edge, is ONLY A POINT. Example: in `■−1, ▲0.5, then ■0`, ■0 slides down past ■−1's top-right corner, which is at its own end. It stops on ▲0.5's apex at y = h, with its left side along ■−1's side. It is off.
5. **"Coincides exactly, along its whole length" (§5b)** means the same segment with the same two endpoints. The oracle compares each lower side of the ▼ with every slanted side of every placed ▲.
   - On the half grid, a ▼ side and a parallel ▲ slant on the same line always share both endpoints, so a partial overlap cannot happen.
   - Only a ▲'s right slant (under the ▼'s left side) or its left slant (under its right side) can ever match.
   - **What does not count:** a ▼ that sits on a flat top or a ▲ apex by its point is off, even when it is wedged between two squares with its top corners touching their sides (`■−1, ■1, ▼0`). What lies under its free half, including air past the car, does not matter.
6. **How `drop` is called.**
   - **Arguments:** §2 gives `(piece, col, way?)` but not how the build is passed. I chose `drop(build, piece, col, way)`. `drop(build, {piece, col, way})` is also accepted.
   - **The result:** it has exactly the §8 keys, in the order outcome, way, verts, reason, contacts, shine, gap. Rev 5's `strips` key is gone.
7. **`newBuild` and input checks.**
   - **`newBuild`:** `newBuild()` with no argument uses half = 2. half must be a positive integer, otherwise it throws. A non-object argument also throws.
   - **`drop` throws on:**
     - a `way` given for a square;
     - a `way` other than `'up'`, `'down'`, `undefined` or `null`;
     - a piece other than `'sq'` or `'tri'`;
     - a col that is not an integer;
     - an odd col for a square;
     - a col outside the §2 table (also when `way` is omitted);
     - an argument that is not a build.
   - An omitted, `undefined` or `null` way on a triangle means the §6 auto choice.
8. **What `place` accepts.**
   - `place` rebuilds the tile from `way` (null means square) and `verts` (col = min X).
   - It then checks that `drop(build, piece, col, way)` on this build gives a deep-equal result, and throws if not. So a result from another build state cannot be placed.
   - An off result throws (§7).
   - Builds are frozen, and `place` returns a new one.
   - An auto-way fit can be placed, because it equals the forced-way result for the chosen way.
9. **Contact segments per neighbour.**
   - **Never merged across neighbours:** for example, golden 2's square keeps two bottom segments that meet over ▲−1's apex.
   - **Never need merging within a neighbour:** convex tiles have no collinear edges.
   - **The car:** it counts only by its top segment, because tiles never reach its sides below y = 0.
10. **Contact points are global.**
    - A point is dropped if it lies on any contact segment, including a segment with a different neighbour (§8).
    - A point that touches several neighbours is listed once.
    - **Example:** golden 4's ▼ point rests on the car's end corner (2, 0) and is an endpoint of its side segment, so it is not listed. A ▼ at col 3 on a bare car gives `points [[4,0,0]]`.
11. **Sorting.** "Lexicographically" means numeric lexicographic order on the integer triple `[X, p, q]`: X first, then p, then q. That is not real-y order: `[0,0,2]` (y = √3) sorts before `[0,2,0]` (y = 1). Segments are sorted by their first endpoint, then their second.
12. **"Nothing at all below" (§3)** means no placed tile, and not the car, overlaps the tile's open x-range. It cannot happen within the §2 cols, because every allowed tile has at least half its width over the car. The oracle throws if it ever happens. The floor "far below" is not an obstacle.
13. **The car as a polygon:** the rectangle x ∈ [−half, half], y ∈ [−10⁶, 0]. That is exact for every reachable state, because no tile goes below y = 0.
14. **Rest is double-checked.** After the resting height is found, an exact SAT test confirms that the tile does not overlap anything at rest and does overlap something 1/1000 lower. The check is valid at any step size, because the resting height is a maximum over obstacles.
