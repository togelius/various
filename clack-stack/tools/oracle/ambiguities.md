# Ambiguities and choices (oracle for SPEC.md revision 5d)

Coordinates are written as in the spec: a point is `[X, p, q]`, meaning x = X/2 and y = (p + q·√3)/2. `h = √3/2`. Tokens like `▼-2` mean x = col/2 = −2, so col −4. `■`, `▲`, `▼` are square, up and down triangle; `△x` is a triangle dropped with the way omitted. "u>v" means tile u rests on v, −1 is the car, and tiles are numbered in drop order from 0.

Where counts are given, they come from these runs. The scripts are in this folder and the logs in `runs/`:
- **census** (`census.cjs`, oracle only, one random drop per state, fits placed):
  - 1,000,000 drops of up to 9 tiles (also `test-own.cjs` section 5, other seed);
  - 1,000,000 drops of up to 25 tiles, 400,000 of up to 40;
  - three runs of 1,000,000 with other piece mixes (15 %, 45 %, 60 % squares; half 2 to 6; up to 30 or 40 tiles).
  - With a 5th argument, every edge-to-edge drop is judged again under the other readings of C2 and C9 (`_variant`).
- **cross-check**: `test-own.cjs` sections 3 and 3b compare 12,000 random drops and 149,936 drops (every drop at every state) field by field with `checker.cjs`, plus every hand case.
- **exhaustive** (`explore.cjs`): every drop at every distinct state of builds grown from fits:
  - half 2 to depth 6: 46,282 states, 1,018,204 drops;
  - half 1 to depth 7: 12,370 states, 148,440 drops;
  - half 3 to depth 5: 51,634 states, 1,652,288 drops.
- **targeted** searches, which try every drop at every state of random builds grown from fits:
  - `tiesearch.cjs`: 110,000 states of up to 50 tiles, 4,279,710 drops;
  - `tiepre.cjs` (also every drop at the 9 % to 17 % of states where two pieces share a lowest point and part of their groups): 1,860,000 states of up to 50 tiles, 9.9 million drops tried at those states;
  - `cyclescan.cjs` (piece cycles): 460,000 states.
- Over all runs with counters, **10.7 million drops reached §5c**: 78 million groups and 1,748,865 TIPS OVER results.

## A. Golden cases

All 18 golden cases agree with my reading of §1–8. `node test-golden.cjs` passes 18/18 and exits 0. It checks reason, gap and tips of every last drop, and checks the notes of cases 6, 9, 16, 17 and 18 through the oracle's pieces and groups.

- **6.** The six tiles are one piece through five whole-edge locks: ■ on ■ and ▲ on ■ (horizontal), ▼−1.5 on ▲−1's left side (slanted), ▲−1.5 on ▼−1.5's top (horizontal) and ▼−2 on ▲−1.5's left side (slanted).
  - Its group is the piece itself. Its support is the bottom ■ on the car over [−1, 0].
  - W = 2 + √3 and M = −1 − √3, which lies inside [−2 − √3, 0]. It fits.
- **9.** ▲0's base lies half on ▼−0.5's top, so it is not locked.
  - The pieces are {▲−1, ▼−0.5} and {▲0}.
  - The first piece's group is all three tiles. Its support is ▲−1's base on the car and ▼−0.5's point (0, 0), so xmax = 0. M = (√3/4)(−½ + 0 + ½) = 0 = W·0, which is exactly over the end.
  - ▲0's own group is exactly over the end x = ½ of its half edge. Both groups are knife edges, and both pass.
- **14.** There are two pieces, {▲−2.5, ▼−2} and {▲−1.5, ▼−1}. The second rests on ▼−2's top by half an edge.
  - Both groups lean right and fail. Their lowest points are 0 and h, so the first piece is reported.
  - Inside that piece, ▲−2.5's base and ▼−2's point both lie at y = 0. The smaller col gives ▲−2.5.
  - The members are its 4 group tiles. The pivot is (−1.5, 0).
- **15.** Only the piece {▲−1.5, ▼−1} fails (m = M − W·xmax = √3/16 > 0). ■−2's group of 3 holds.
  - ▲−1.5's base and ▼−1's point both lie at y = 1, and ▲−1.5 has the smaller col.
- **16.** Only the piece {▲−1, ▼−0.5} fails: M − W·0 = ½ − √3/8 > 0, with members 3 (it carries the ■). ▲−1 and ▼−0.5 tie at y = 0, and ▲−1 has the smaller col.
  - The ■ alone sits exactly over the end of its half edge, and passes.
  - Under 5c two groups failed here and tied. Under 5d the tie is inside one piece.
- **17.** The four triangles are one piece:
  - ▼0 hung on ▲0.5;
  - ▲0 squarely on ▼0's top;
  - ▼0.5 hung on ▲0's right side, with its point on ▲0.5's apex.

  The piece's support is the car over [½, 1½] (▲0.5's base, and ▼0's point at (½, 0)).
  - The ■ lies half on ▼0.5's top at y = √3 and is not locked.
  - The triangles' group (with the ■) has W = 1 + √3 and M = 3/2 + 3√3/4, inside [W·½, W·3/2]. It fits.
  - The gap is √3, above the car over [1½, 2].
- **18.** The piece is {▲−1.5, ▼−2, ■−2 (upper), ▼−1, ■−1, ■−1 (top)}. One of its locks is vertical: ■−1 beside the upper ■−2.
  - ▲−2.5 rests on the upper ■−2 by half an edge, so the group has 7 members.
  - The support is ▲−1.5's base on the bottom ■−2 over [−1.5, −1], and ▼−2's point at (−1.5, 1). ▼−1's point hangs in the air.
  - M − W·xmax = ½ − √3/4 > 0, so it leans right. The pivot is (−1, 1).
  - The bottom ■−2's group (all 8 tiles) passes.
  - ▲−1.5, ▼−2 and ▼−1 all sit at the piece's lowest point y = 1. The smaller col gives ▼−2.
- **1–5, 7, 8, 10–13** do not depend on the balance rule beyond passing. Golden 12's fourteen drops all fit.

## B. The questions §5c asks

1. **A failing group without the new tile N: never.**
   - **Proof:**
     - No placed tile rests on N (B2a). So a group that does not contain N was built only from old tiles, by old relations and old locks.
     - N is not locked to any of them, or N would be in the group.
     - So it is the same group, with the same support, W and M, as the group of the same piece in the previous build.
     - That piece already existed there, and it passed when the previous tile fitted.
   - **Census:** 0 such groups among 2,010,173 failing groups.
   - **What I implemented anyway:** the oracle still tests the group of every piece, as written.
2. **Cycles of "rests on".**
   1. **Between tiles: never.**
      - **Proof:** if an earlier tile U rested on the falling tile N, some interior point of U would lie directly above an interior point of N, inside N's open x-range. N came straight down past that point, so it would have hit U first.
      - So every "rests on" goes from a later tile to an earlier one (or the car).
      - **Census:** 0 relations against the placing order.
   2. **A piece resting on itself through another piece: yes, it happens.**
      - Locks join tiles placed at different times. So a piece can rest on a second piece that rests on the first.
      - **Shortest example found (half 1, 9 drops; no single drop can be removed):** `■0 ▲0 ▼0.5 ■-1 ▲-1.5 ▲0.5 ▼-1 ▲-0.5 ▼0`.
        - Before the last drop, the pieces are P = {■0, ▲0, ▼0.5, ■−1, ▲0.5}, Q = {▲−1.5, ▼−1} and R = {▲−0.5}.
        - Q rests on ■−1's top, and R rests on ▼−1's top.
        - ▼0 drops into the notch between ▲−0.5 and ▲0.5 and locks to both. That joins R to P.
        - Now P rests on Q (through ▲−0.5) and Q rests on P.
        - Both groups are the whole build, and it fits.
      - **How common:**
        - none within the exhaustive depths (they are all shorter than 9 drops);
        - 0 in 1,000,000 drops of up to 9 tiles;
        - 460 groups in 228 drops out of 1,000,000 of up to 25 tiles;
        - 22,329 groups in 10,576 drops over all runs.
      - **What follows:** two pieces in a cycle have the same group, so they pass or fail together.
        - This is the only case seen where the C9 reading matters.
        - A tie of their lowest points never occurred: 0 of 1,293 cycle states in `cyclescan.cjs`.
      - Nothing in §5c forbids it, and the closure is well defined. The oracle and the checker both handle it.
      - It is a hand case in `test-own.cjs` 1b.
3. **An empty support: never.**
   - **Proof:**
     - Take the earliest placed tile t of a group. When t was placed, it met an earlier tile or the car edge to edge (§5a/§5b), along a non-vertical segment with its interior above it.
     - So t rests on that earlier tile V or on the car.
     - V is earlier than t, so it is not in the group.
     - So that segment is in the group's support, which therefore always has positive length.
   - **Census:** 0 empty supports.
   - **If one occurred,** the oracle would throw `internal: a group with an empty support`, because §5c gives it no balance.
4. **How often each tie rule decides.** Counts are over the 1,748,865 TIPS OVER results.

   | Rule | When it decides | Count |
   |---|---|---|
   | Lowest point of the piece | Two or more pieces fail and their lowest points differ | 1,424 of 21,824 TIPS (≤ 9 tiles); 6,832 of 58,315 (≤ 25 tiles); 3,202 of 31,480 (exhaustive, half 2, depth 6) |
   | Then the larger group | Two failing pieces share the lowest point | 456, all in the targeted searches (builds of up to 40 tiles), 441 of them from one random build lineage (`runs/tiepre-s12.log`). None in builds of up to 9 tiles, in the exhaustive runs, or in any census |
   | Then the smaller col among the piece's lowest tiles | Equal lowest point and equal group size | **never** |
   | Base: the piece's lowest tile with the smaller col | The piece has several lowest tiles | 1,458,417 (83 %; 90 % within 9 tiles) |
   | Pivot: least y at the leaning end | Support points at that x have different y | 119; 0 within 9 tiles and in every exhaustive run |
   | §6 both fit, then the lower way, then ▼ | — | **never**. Both ways never fit (B6) |
   | §6 neither fits: the way that tips | Exactly one way meets the tower but tips | 5,772 of 139,961 omitted-way drops (≤ 9 tiles); 4,960 of them choose ▼ |

   - **Lowest point between pieces.** The groups were rarely equal: with no ties, the lowest-point rule alone chose the piece in every one of these results.
   - **Larger group.**
     - **Example (shrunk to 19 drops, a hand case):** `▲-2.5 ▲-1 ▼-0.5 ■-1 ▼-2 ■-2 ▲-1 ▼-0.5 ■0 ▲0 ■-1 ▼0.5 ▲-1.5 ▲0.5 ▼0 ▲-0.5 ▼1 ■1`, then `■1`.
       - The piece of ▲−2.5 (with ▼−2, the two squares at height h, and ▲−1 and ▼−0.5 one storey up) rests on the piece {▲−1, ▼−0.5} on the car. It does so through the ■−1 at height h.
       - Both pieces stand on y = 0, and both groups fail right.
       - The groups have 17 and 19 tiles. The larger group gives base ▲−1, members 19.
   - **Smaller col between pieces: never.**
     - It needs two failing pieces with the same lowest point and the same group size.
     - A failing piece inside another failing piece's group has the smaller group, so the size rule decides first.
     - Equal sizes therefore need either a piece cycle with both pieces at one height (never seen, B2b), or two pieces that each hold up a common piece above them and have groups of equal size.
     - None was found in the targeted searches (14.2 million drops).
     - The oracle and the checker both implement it, but no case exercises it.
   - **Base inside the piece.** This is the usual tie: a ▼ hung on a ▲'s side has its point at the ▲'s base height.
   - **Pivot.**
     - **Example (shrunk to 11 drops, a hand case):** `▲-2 ▲-0.5 ▼0 ▲-0.5 ▼-1.5 ▼-1 ▲-0.5 ▼-1 ▲-1 ▼-1.5`, then `■-2`.
     - The group of {▲−0.5, ▼0} leans left. At x = −0.5 it has the points (−0.5, 0) on the car and (−0.5, h), where ▼−1's point sits on ▼−1.5's top corner.
     - The pivot is (−0.5, 0).
5. **Two tiles resting on each other both ways: never.** Their interior cones at the shared boundary are disjoint. Census: 0.
6. **Smaller facts used above.**
   - **A lone tile, locked to nothing, never fails.**
     - Its contacts are half edges, points, or a whole base on the car, and they always reach its middle.
     - A ▼ only fits hung by a whole side, so a ▼ is never alone.
     - So `tips.members` ≥ 2. Census: 0 results with members 1.
   - **Both ways never fit.** A ▲ and a ▼ at one col never both meet the tower edge to edge, and §5c only removes fits. Census: 0.
   - **The base can be the new tile.** It was in 354,401 TIPS results (20 %).
     - **Example:** `■0 ▲-0.5`, then `▼-1`, at half 1 and half 2. ▼−1 is hung on ▲−0.5's left side, its point at ▲−0.5's base height, and it has the smaller col.
   - **A group can reach below its own piece.** A tile resting on the piece may be locked down to the car beside it.
     - **Example (half 1):** `■-1 ▲0.5 ▲-1.5 ▼0 ▼-1 ■0 ▲0 ▼-0.5`.
     - The group of {▲−1.5, ▼−1} (lowest y = 1) contains ▲0.5 at y = 0.
     - It happened in 93,292 groups. It matters only through C9.
7. **Vertical locks matter, but only by holding.**
   - Judged with vertical locks dropped, 566 of the 1,000,000 drops of up to 9 tiles change:
     - 533 fits would tip;
     - 33 TIPS results would name another group;
     - 0 TIPS results would fit.
   - At up to 25 tiles the figures are 8,533, 1,757 and 0.
   - **Smallest example (a hand case):** `▲-1 ▼-0.5 ■-1 ■0`, then `▲-1.5`.
     - It fits only because ■0 is locked beside ■−1. ■−1 alone would tip left under ▲−1.5.
     - Without ■0, `▲-1 ▼-0.5 ■-1 ▲-1.5` tips.
   - **Hand case** `▲-1 ▼-0.5 ▲1 ▼1.5 ■1 ■0`: golden 16's ■0 fits once ■1 is locked beside it.
8. **The "smaller col" rules are not mirror symmetric.**
   - Golden 16 gives base ▲−1. Its mirror `▲0 ▼-0.5 ■-1` gives base ▼−0.5, with members 3, left, pivot (0, 0).
   - The mirror test in `test-own.cjs` accepts a pair only when nothing but `tips.base` differs and both report a tie inside the piece: 379 of 12,000 drops.
   - It would also accept a difference in the piece when both report a col tie between pieces. That never happens.

## C. How I read §5c (revision 5d)

1. **"Rests on" is unchanged from 5c.** It is decided at the shared boundary of the two tiles, which is one point or one segment.
   - **A segment:**
     - If it is vertical, neither tile rests on the other.
     - Otherwise the tile whose interior lies above the segment's line rests on the other.
   - **A single point:** I compare the two interior cones on the vertical lines just left and just right of the point, as exact slope intervals.
   - **The car** is the open region −half < x < half, y < 0.
   - The checker decides "rests on" by its own method, by sampling the vertical lines 1/16 beside each touching point.
2. **Locks.** Two tiles are locked iff their contact (their whole shared boundary, §4) is a segment of length exactly 1.
   - **Exact test:** in the doubled frame, dX² + (dp + dq√3)² = 4. That means dp·dq = 0 and dX² + dp² + 3dq² = 4, all on integers.
   - Every edge has length 1, so such a segment is a whole edge of both tiles. The checker tests exactly that: an edge of one tile with the same two end points as an edge of the other. No length is computed.
   - **Directions:** horizontal (a tile squarely on a top), slanted (a ▼ hung on a ▲'s side) and vertical (two squares side by side at one height). "In any direction" includes the vertical case.
   - **What does not lock:**
     - half edges (½ on a top);
     - partial sides, such as the vertical contact of length 1 − h between a ■ at y = 0 and a ■ at y = h;
     - points;
     - anything with the car. Two tiles both seated squarely on the car are not joined through it.
   - A locked pair still rests (or not) by C1. Locking adds no support.
3. **Pieces** are the components of the lock graph.
   - The oracle uses union-find on every evaluation. The checker uses a depth-first search over the tiles.
   - A tile locked to nothing is a piece by itself.
4. **Groups.** The group is the smallest set that contains the piece and is closed under "rests on a tile of the set" (upward only) and "locked to a tile of the set".
   - Locks keep pieces whole. So the group is the piece plus every piece reachable through "rests on" going up.
   - The oracle searches a graph of pieces. The checker repeats passes over tile-level relations and locks until nothing is added.
   - The tiles a group rests on are not in it: they are its support.
5. **Support** is as in 5c: the whole shared boundary of each pair (U in the group, V outside it or the car) where U rests on V. Segments count by both end points and points by themselves. Contacts inside the group never count.
   - **Example (golden 16):** ▼−0.5's point (0, 0) on the car is a support point, though §8's `contacts.points` omits it, because it lies on the ▼'s slanted contact segment.
6. **Weight.** It is the exact area (square 1, triangle √3/4), acting at col/2 + ½ for every piece and way.
7. **Balanced** iff W·xmin ≤ M ≤ W·xmax. This is decided at 32 times scale on integers of ℚ(√3): 32M = Σ 8w·4x and 32W·x = 8W·2X. There is no tolerance. Exactly over an end passes (a knife edge).
8. **Every piece's group is tested.**
   - Two pieces in a cycle have the same group, which is then tested twice. That is harmless, and it is what makes them tie (B2b).
9. **"The one whose lowest point is lowest"** means the lowest point of the piece: the least vertex y over the piece's tiles. It does not mean the lowest point of its group.
   - This is the only reading that agrees with `base` ("that piece's lowest tile").
   - **Where the two readings differ:** 42 times in all runs. I reran three of those runs with a counter, and all 15 cases there were two pieces of one cycle: under the group reading they tie, and the col rule picks the other piece.
   - **Example (half 1, 14 drops):** `■-1 ▲-0.5 ▼-1 ▲-1.5 ▼-1 ■-1 ▼0 ▲-1.5 ■0 ▲0 ▼0.5 ▲0.5 ▲-0.5`, then `▼0`.
     - Mine reports base ▼−1 at y = 1.
     - The group reading would report base ▲−1.5 at y = 1 + h.
     - Both report 13 members, right, pivot (0, 1).
10. **"The smaller col among its lowest tiles"** means the piece's tiles at the piece's lowest point, and the least §2 col among them. A full tie (the same lowest point and the same col in two pieces) would need overlapping tiles, so it cannot happen.
11. **`base`** is the tile that C10 names: the piece's lowest tile with the smaller col.
    - `members` is the size of the piece's group. `side` and `pivot` are as in 5c.
12. **Output.** On TIPS OVER the result has:
    - `shine: []` and `gap: null`;
    - its usual contacts;
    - `tips` with keys in the order base, members, side, pivot.

    `tips` is null on every other result. No value is ever −0.

## D. Points from 5b that still stand

1. **`gap`** is defined only when the tile fits. It is null on both kinds of off result, and always null for a ▼.
2. **The gap's "maximum" is reported as a supremum.**
   - S(x) jumps up at a vertical side, so y0 − S(x) can get arbitrarily close to a value it never reaches.
   - **Example:** `■0, ▲1, then ▲0.5` gives gap `[2,0]`.
   - Under a "largest value attained" reading these gaps would be smaller.
3. **S at single points.**
   - A vertical side at the end of an x-range counts along its whole length.
   - Points above B are ignored. A side that crosses y0 counts as S = y0.
   - The checker uses one-sided limits only, and the two methods agree.
4. **"Top edge" (§5a)** means the car top, a square's top or a ▼'s top, at exactly y0. The length on it must be positive.
5. **"Coincides exactly" (§5b)** means the same two end points. A partial overlap cannot happen on the half grid.
6. **The API.**
   - `drop(build, piece, col, way)`, or `drop(build, {piece, col, way})`.
   - An omitted, `undefined` or `null` way on a triangle is the §6 choice.
   - Result keys come in the §8 order.
7. **Input checks.**
   - `newBuild()` uses half = 2. half must be a positive integer (≤ 100,000). Option keys other than `half` are ignored.
   - `drop` throws on:
     - an odd square col;
     - a col outside §2 (also with the way omitted);
     - an unknown piece or way;
     - a way given for a square;
     - a col that is not an integer;
     - anything that is not a build.
8. **`place`.**
   - It accepts the very result `drop` returned for this build, as long as its JSON is unchanged. Anything else, including a deep copy, must equal what `drop` gives, or it throws.
   - An off result throws.
   - Builds are frozen.
9. **Contacts per neighbour.**
   - Contact segments are never merged across neighbours.
   - Points are global: one on any contact segment is dropped, and one shared by several neighbours is listed once.
   - The car counts only by its top.
10. **Sorting** is numeric lexicographic order on `[X, p, q]`.
11. **"Nothing at all below"** cannot happen within the §2 cols. The oracle throws if it does.
12. **The car as a polygon** is the rectangle x ∈ [−half, half], y ∈ [−1, 0]. That is exact, because nothing goes below y = 0.

## E. Method and speed

- **Arithmetic.**
  - All decisions use integers: x' = X and y' = p + q√3 at twice the spec's scale.
  - Signs compare a² with 3b², falling back to BigInt above 2^25.
  - The only divisions are exact ones, and they are checked.
  - No floating-point value enters a decision.
- **Geometry** is done on polygons:
  - resting height: section maxima over obstacle pairs;
  - contacts: exact segment intersection per edge pair;
  - rests-on: cones at the shared boundary;
  - locks: the length of the shared segment;
  - pieces: union-find;
  - groups: a search over the graph of pieces;
  - no lattice keys, hashing or column profiles.

  With `_selfCheck(true)`, which the cross-check sections use, every rest is also confirmed by an exact separating-axis test.
- **Speed** (`bench.cjs`; `ORACLE=prev5c/oracle.cjs` runs the 5c copy kept in `prev5c/`), per drop including `place`:

  | Builds | 5d | 5c |
  |---|---|---|
  | Up to 9 tiles | 22.4–23.9 µs | 22.1–22.8 µs |
  | Up to 25 tiles | 37.0 µs | 41.0 µs |
- **Test hooks**, not part of the spec:
  - `_details(result)` gives locks, pieces, every piece's group with W8, M32 and the support ends, the failing pieces, the chosen piece and the tie rule that decided;
  - `_stats` holds the counters used above;
  - `_variant({verticalLocks: false} | {lowestOf: 'group'})` applies the other readings, for the census only.
- **Helper scripts:**
  - `explore.cjs`, `census.cjs`, `tiesearch.cjs`, `tiepre.cjs`, `cyclescan.cjs`, `chain3.cjs` (searches);
  - `reduce.cjs` (shrinks an example);
  - `quick.cjs` (prints drops; `SHOWG=1` adds groups, `SHORT=1` shows only the last drop);
  - `xquick.cjs` (a fast cross-check);
  - `bench.cjs`.
