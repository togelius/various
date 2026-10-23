# Ambiguities and choices (oracle for SPEC.md revision 5c)

Coordinates are written as in the spec: a point is `[X, p, q]`, meaning x = X/2 and y = (p + q·√3)/2. `h = √3/2`. Tokens like `▼-2` mean x = col/2 = −2, so col −4. `■`, `▲`, `▼` are square, up and down triangle; `△x` is a triangle dropped with the way omitted. "u>v" means tile u rests on v, and −1 is the car.

Where counts are given, they come from these runs (all in this folder):
- **census**: `test-own.cjs` section 5, 1,000,000 drops on random builds of up to 9 tiles (half 1, 2, 3, 50; 30 % squares; triangles 40 % ▲, 40 % ▼, 20 % way omitted), oracle only. `census.cjs` repeats it with other seeds: 3,000,000 and 2,000,000 more drops of up to 9 tiles, and 1,300,000 drops on builds of up to 25 tiles.
- **cross-check**: `test-own.cjs` sections 3 and 3b, 158,202 drops compared field by field with `checker.cjs`, plus every hand case.
- **exhaustive**: `explore.cjs`, every drop at every state of builds grown from fits: half 2 to depth 6 (44,944 states, 988,768 drops) and half 1 to depth 7 (11,497 states, 137,964 drops).

## A. Golden cases

All 16 golden cases of §9 agree with my reading of §1–8. `node test-golden.cjs` passes 16/16 and exits 0. It checks reason, gap and tips of every last drop, and the notes of cases 6 and 9 exactly.

- **6 and 9.** The group of ▼−1.5 (case 6) leans left, and the group of ▼−0.5 (case 9) leans right, each by exactly √3/8, and each grip is exactly 1/4. Both fit.
- **13.** ▲−1.5 rests at y = 1 + h with its left corner on ▲−2's apex, 1 + h − √3 ≈ 0.134 above ▼−1's top. It is ONLY A POINT, and its only contact is the point `[-3,2,1]`.
- **14.** The 4 members only add up because ▲−1.5 does not reach the car. It stops on ▼−2's top at y = h (half its base on that top, gap h), so it rests on ▼−2.
  - The group of ▲−2.5 is all four tiles.
  - Its support is ▲−2.5's base on the car over [−2, −1.5] and ▼−2's point on the car at (−1.5, 0). So L = 1/2.
  - Its lean is m = √3/4 > 1/8.
  - ▼−2's group (3 tiles) and ▲−1.5's group (2 tiles) fail too. ▲−2.5 and ▼−2 tie on the lowest point y = 0, and ▲−2.5 has the smaller col.
- **15.** Only ▲−1.5's group fails, with m = √3/8 > 1/8. The pivot is the right end (−1, 1) of its support on ■−2's top.
- **16.** Two groups fail and tie at y = 0:
  - ▲−1's group (3 tiles, m = 1/2 − √3/8 > 1/4);
  - ▼−0.5's group (2 tiles, m = 1/2).
  - The smaller col gives ▲−1.

## B. The questions §5c asks

1. **A rests-on cycle: never.**
   - **Proof:** a tile placed later never has an earlier tile resting on it. If an earlier tile U rested on the falling tile N, then some point of U's interior would lie directly above some point of N's interior, inside N's open x-range. N came straight down from far above that point, so it would have hit U first. So every "rests on" goes from a later tile to an earlier tile or to the car, and the placing order is a topological order.
   - **Census:** 0 cycles over 7.3 million drops (14.2 million group evaluations in the 9-tile runs alone).
   - **What I implemented anyway:** the oracle computes the relation both ways for every touching pair. It never assumes the order.
2. **An empty support: never.** The support also always has positive length, so L > 0.
   - **Proof:**
     - A tile that fits, or tips, meets an earlier tile or the car edge to edge (§5a/§5b) along a non-vertical segment, with its interior above it. So it rests on that earlier tile or the car.
     - That earlier tile is not in the tile's group (see 1), so that segment is in the support of every group that contains the tile.
   - **Census:** 0 empty supports, and 0 supports of length 0.
   - **If one did occur:** the oracle throws `internal: a group with an empty support`, because §5c gives no lean for it.
3. **A lean exactly at the grip (m = L/4 with m > 0): reachable, and rare.**
   - **Census, 9-tile runs:**

     | Run | Groups at the grip | Leaning groups | Drops where it decides |
     |---|---|---|---|
     | 1M drops | 8 | 55,310 | 6 |
     | 3M drops | 12 | 172,549 | 12 |
     | 2M drops | 9 | 115,930 | 9 |

     A drop where it decides is a fit that would be TIPS OVER under a strict `m < L/4`.
   - **Census, 25-tile runs:** 103 groups in 1,000,000 drops and 38 in 300,000.
   - **Exhaustive runs:** 12 groups (half 2, depth 6) and 22 groups (half 1, depth 7).
   - **A smallest example** (7 drops; at half 2 the exhaustive run finds none with 6), the same at half 1 and half 2: `▲-1 ▼-1.5 ▲-1.5 ▼-0.5 ▼-1 ■0`, then `▲0`.
     - The group of ▼−0.5 is {▼−0.5, ▼−1, ■0, ▲0}.
     - Its support is two 60° slants of length 1, plus the points (0, 0) and (−0.5, h). So L = 2, xmax = 0.
     - M = 1/2 and W·xmax = 0, so m = 1/2 = L/4 exactly. It fits.
     - A square there instead of the ▲ tips the same group.
   - **Why it is rare:** m = L/4 needs the √3 part of m to vanish. That means the triangles of the group must balance exactly about the pivot x. Then the squares alone must lean by exactly L/4, and that needs L ≥ 2.
   - This is a hand case in `test-own.cjs`. The oracle decides `m ≤ L/4` exactly, with no tolerance.
4. **A failing group that excludes the new tile: never.**
   - **Proof:**
     - Take a group without the new tile N. It has the same members as in the old build.
     - No member rests on N (see 1), so its support is unchanged too.
     - It passed when its newest member was placed, so it passes now.
   - **Census:** 0 such groups among 31,768 failing groups (1M drops) and 66,461 (2M drops).
   - **Related facts, both from that argument:**
     - **The new tile's own group is always just {N}.** On the half grid, a lone tile's support always reaches its middle: an edge-to-edge contact covers at least one half of the base, and a slant ends below the ▼'s point. So a lone tile never leans.
     - Hence **the base is never the new tile**, and **`tips.members` ≥ 2**. Census: 0 bases that are the new tile. `tips.members` over 23,654 TIPS results: 2: 15,619; 3: 3,100; 4: 2,366; 5: 1,465; 6: 718; 7: 282; 8: 95; 9: 9.
   - **What I implemented anyway:** the oracle still tests the group of every tile of the new build, as written.
5. **The neither-fits TIPS way choice (§6): it applies often.**
   - **Census, 1M drops:** of 139,984 drops with the way omitted, 6,020 were decided by it.
     - 5,070 chose a ▼ that tips while the ▲ is ONLY A POINT. These are exactly the drops where 5c's rule differs from "otherwise ▲".
     - 950 chose a ▲ that tips while the ▼ is ONLY A POINT.
   - **Cross-check census:** 3,495 cols, 2,707 of them ▼.
   - **Never both:** both ways can never tip, because both can never meet the tower edge to edge (B6).
   - **Examples** (hand cases):
     - `▲-2.5 ▼-2 ▲-1.5 △-1` gives ▼ TIPS OVER (golden 14's last drop with the way omitted).
     - `▲-2 ▼-2.5 ■-2 △-1.5` gives ▲ TIPS OVER.
     - `▲0 △0` gives ▲ ONLY A POINT.
6. **Both ways fit, and the §6 "equally low → ▼" tie: still never.**
   - The 5b proof still holds: a ▲ and a ▼ at one col never both meet the tower edge to edge, and 5c only removes fits.
   - **Census:** 0, both in the oracle's §6 branch and in the checker's.
7. **Two tiles resting on each other both ways: never.**
   - Two convex tiles with disjoint interiors share one point or one segment.
   - At that place their interior cones are disjoint. Two disjoint cones can be "above" each other on at most one side of the touching point.
   - **Census:** 0.
8. **The pivot's "least y" choice: it only matters in big builds.**
   - Within 9 tiles the points at the leaning end of the support never had two different y: 0 times in 6 million drops and in both exhaustive runs. They were often several copies of one point.
   - On builds of up to 25 tiles it happened 4 times in 1,300,000 drops.
   - **Example**, shrunk to 13 drops: `■-1 ▲-1 ■0 ▼-0.5 ■-1 ■0 ■-1 ■0 ▲0 ▼-0.5 ▲-1.5 ▼0.5`, then `■1`.
     - It tips with base the bottom ■−1, 12 members, leaning right.
     - The leaning end x = 0 has support points (0, 0), its car contact, and (0, 1), ▼−0.5's point on ■0's corner.
     - The pivot is (0, 0).
     - This is a hand case.
9. **Base ties are common, and the tie rule is not mirror symmetric.**
   - Two failing tiles share the lowest point in 5,706 of 23,654 TIPS results (24 %).
   - "On a tie, the one with the smaller col" picks the left one whatever the lean. So a build and its mirror image can report different groups:
     - golden 16 gives base ▲−1, 3 members, right;
     - its mirror `▲0 ▼-0.5 ■-1` gives base ▼−0.5, 2 members, left, pivot (0, 0).
   - The mirror test in `test-own.cjs` accepts such pairs only when both results report a tie: 117 of 12,000 drops. Every other field must be the exact mirror image.

## C. How I read §5c

1. **"Rests on" is decided at the shared boundary U ∩ V.** For two convex tiles with disjoint interiors, that is one point or one segment. For the car, it is the tile's boundary on the car top within [−half, half].
   - **Segment of positive length:**
     - If it is vertical, neither rests on the other (side by side).
     - Otherwise the tile whose interior lies above the segment's line rests on the other. Exactly one does.
     - An endpoint of the segment never gives the opposite answer: the cones there are disjoint and share the segment's ray.
   - **Single point P:** take each tile's interior cone at P. That is two edge half-planes at a vertex, or one half-plane at a point inside an edge.
     - On the vertical line just right of P, the cone gives an open interval of slopes k, where y = P.y + δk. The same holds just left of P.
     - U rests on V iff, on one of the two sides, some slope of U is greater than some slope of V. Everything here is exact.
     - The vertical line through P itself adds nothing. A cone that contains straight up or down also reaches both sides.
   - **The car:** its interior is −half < x < half, y < 0. Its corner (±half, 0) has a quarter-plane cone.
     - So a ▼ whose point sits on the car's corner rests on the car (golden 4: ▼1.5 rests on ▲1 and on the car).
     - A tile that sticks out past the car rests on it by the part of its base over the car.
   - **Cases checked by hand** (see `test-own.cjs` 1b):
     - squares side by side, or corner to corner diagonally: no rest;
     - ▼ on a slant: rests on the ▲;
     - ▼ point on the car top or the car's corner: rests on the car;
     - ▼ point on a ▲ apex: rests on it, and on a ▼'s top corner at the same point;
     - ▼ point on a square's corner: rests on it;
     - square corner on a ▲ apex: rests on it;
     - ▼ in a notch: rests on both ▲ and on the car.
   - **The checker's independent method:** `checker.cjs` looks at the vertical lines 1/16 left and right of each touching point (a segment's two ends and its middle). It clips both open sections to ±1/8 around the point. It agrees on every drop.
2. **The support uses the whole shared boundary of each pair, not the `contacts` of §4/§8.**
   - **Example (golden 16):** ▼−0.5's point (0, 0) on the car is a support point of ▲−1's group. Yet `contacts.points` of that ▼'s drop omits it, because it lies on the ▼'s slant contact segment (§8).
   - **Same point twice:** a point that is both a segment end and a separate contact counts once for xmin/xmax, and adds nothing to L.
3. **Groups contain tiles only.** The car is never in a group, and every rest on the car is a support contact.
4. **Weight.** The weight is the area, by the exact shoelace formula: a square 1, a triangle √3/4. It acts at the middle of the tile's x-range, which is col/2 + ½ for every piece, as §5c says.
5. **Lowest point and col.**
   - The lowest point of a tile is the least y of its vertices. For a ▼ that is its point.
   - "The smaller col" is the tile's §2 col.
   - A tie in both the lowest point and the col would mean two overlapping tiles, so it cannot happen.
6. **Output.** The pivot is reported as `[X, p, q]`. On TIPS OVER the result has `shine: []` and `gap: null` (§5c), its usual contacts, and `tips` with keys in the order `base, members, side, pivot`. `tips` is `null` on every other result.
7. **Exactness of the balance test.** It is done at 32 times scale: 32m and 8L are elements of Z[√3]. So `m ≤ L/4` is an exact integer sign test. A lean exactly at the grip fits (B3), and a weight exactly over an end of the support has m = 0 and fits.
   - **Knife edges** (a group of ≥ 2 tiles exactly over an end) are common: 86,024 groups in the 1M census.
   - **Example:** golden 14's third drop is one. ▲−2.5's group of 3 sits exactly over x = −1.5. The fourth drop then tips it by √3/4.

## D. Points from 5b that still stand

1. **`gap`** is defined only when the tile fits. It is null on both kinds of off result and always null for a ▼.
2. **The gap's "maximum" is reported as a supremum.**
   - S(x) jumps up at a vertical side, so y0 − S(x) can get arbitrarily close to a value it never reaches.
   - **Example:** `■0, ▲1, then ▲0.5` gives gap `[2,0]`. On x ∈ (1, 1.5] the support is ▲1's slant, which tends to 0 as x → 1⁺. At x = 1 itself, ■0's side reaches up to 1.
   - **How common:** about 26 % of the gaps in a 5b scan were such suprema. 5c does not change the gap rule, only which drops fit.
   - **Who would disagree:** an implementation that takes the largest value actually reached, counting vertical sides, reports smaller gaps in those cases.
3. **S at single points.**
   - A vertical side at the end of an x-range counts along its whole length.
   - Points above B are ignored. A side that crosses y0 counts as S = y0.
   - The exact S at a breakpoint never lowered a gap here. The checker uses one-sided limits only, and the two agree.
4. **"Top edge" (§5a)** means the car top, a square's top or a ▼'s top, at exactly y0. The length of B on those edges must be positive; touching one only at a point is ONLY A POINT.
5. **"Coincides exactly" (§5b)** means the same two endpoints. On the half grid, a partial overlap of a ▼ side and a ▲ slant cannot happen.
6. **The API.**
   - `drop(build, piece, col, way)`, or `drop(build, {piece, col, way})`.
   - An omitted, `undefined` or `null` way on a triangle is the §6 choice.
   - Result keys come in the §8 order and now end with `tips`. No value is ever −0.
7. **Input checks.**
   - `newBuild()` uses half = 2. half must be a positive integer (≤ 100,000). Option keys other than `half` are ignored.
   - `drop` throws on: an odd square col, a col outside the §2 table (also with the way omitted), an unknown piece or way, a way given for a square, a col that is not an integer, and anything that is not a build.
8. **`place`.**
   - It accepts the very result object `drop` returned for this build, as long as its JSON is unchanged. Anything else, including a deep copy, must equal what `drop` gives on this build, or it throws.
   - An off result (either reason) throws.
   - Builds are frozen. `build.tiles` lists `{kind, col, y0, verts}`.
9. **Contacts per neighbour.**
   - Contact segments are never merged across neighbours, and never need merging within one.
   - Points are global. A point on any contact segment is dropped, and a point shared by several neighbours is listed once.
   - The car counts only by its top segment.
10. **Sorting** is numeric lexicographic order on `[X, p, q]`, not real-y order.
11. **"Nothing at all below"** cannot happen within the §2 cols. The oracle throws if it does.
12. **The car as a polygon** is the rectangle x ∈ [−half, half], y ∈ [−1, 0]. That is exact, because no tile goes below y = 0 and the depth enters no decision.

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
  - groups: fixpoints over the relation, cached per build;
  - no lattice keys, hashing or column profiles.
  - With `_selfCheck(true)`, which the cross-check sections use, every rest is also confirmed by an exact separating-axis test: no overlap at rest, overlap 1/128 lower.
- **Speed:** about 22–28 µs per drop including `place`, on builds of up to 9 tiles (`bench.cjs`; `test-own.cjs` section 6). 15 million drops take about 6 minutes.
- **Helper scripts in this folder** (not needed by the oracle):
  - `explore.cjs` (exhaustive search);
  - `census.cjs` (random census);
  - `reduce.cjs` (shrinks an example);
  - `quick.cjs` (prints drops; `SHOWG=1` adds groups);
  - `bench.cjs`.
