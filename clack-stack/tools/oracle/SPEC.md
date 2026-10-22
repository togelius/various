# Oracle specification: Clack Stack tile rules (revision 5)

You are writing an **independent oracle** for the placement rules of a game about stacking translucent magnetic tiles (squares and equilateral triangles with equal edges) into a flat wall standing on a toy car. You get only this file. You must not read any other file in the repository or anything else about the game. Your oracle is compared, drop by drop, against the game's own implementation; when the two disagree, this text decides which one is wrong. **Where this text does not decide a case, do not guess silently.** Log it in `ambiguities.md` (case, coordinates, what you chose and why).

## 1. Coordinates and exact numbers

- **Numbers.** All coordinates are exact numbers. Write x as `X/2` and y as `(p + q·√3)/2`, with X, p and q integers. A point is the triple `[X, p, q]`.
  - Use exact arithmetic in ℚ(√3). The sign of `a + b√3` with integer or rational a and b can be decided exactly by comparing `a²` with `3b²` and checking the signs.
  - Never use floating point for any decision.
- **Edge length.** Every tile edge has length 1. A triangle's height is `h = √3/2`, which is `[_, 0, 1]` in this notation.
- **The car.** Its top is the horizontal segment from x = −half to x = +half at y = 0, where half = 2 normally. The tests also use half = 1 and half = 50. Nothing exists below y = 0 except the floor far below, and nothing at all outside the car's x-range.

## 2. Pieces and positions

A drop is `(piece, col, way?)`:
- `piece` is `'sq'` (square) or `'tri'` (equilateral triangle).
- `col` is the tile's **left x in half tiles**: the tile spans x from col/2 to col/2 + 1.
- `way` is only for triangles: `'up'` (point up, ▲) or `'down'` (point down, ▼). It is optional (see §6).

**Shapes**, where y0 is the resting height found in §3:
- A square is the axis-aligned unit square with lower-left corner (col/2, y0). **col must be even.** Throw on an odd col.
- A ▲ has base from (col/2, y0) to (col/2 + 1, y0) and apex (col/2 + ½, y0 + h).
- A ▼ has its top edge from (col/2, y0 + h) to (col/2 + 1, y0 + h) and its point at (col/2 + ½, y0), where y0 is the height of its point.

**Allowed cols** (throw outside them):

| Piece | half = 2 | General |
|---|---|---|
| Square | −4, −2, 0, 2 | even cols from −2·half to 2·half − 2 |
| Triangle | −5 … 3 | −2·half − 1 … 2·half − 1 |

So a triangle can stick out half a tile past either end of the car, and a square never can.

## 3. The drop: where the tile stops

The tile starts far above everything and moves straight down without turning. It stops at the **first** height where moving any further down would make its interior overlap the interior of some tile already placed, or of the car. Overlap means sharing positive area: touching along edges or at corners is not overlap. So the tile slides past vertical sides, and past corners at its own ends, without stopping. It never reaches a pocket under an overhang, because it is blocked first. Treat the car as the region x ∈ [−half, half], y ≤ 0.

If nothing at all is below the tile's x-range (impossible within the allowed cols, but say so if you find it), throw.

## 4. Contacts

At the resting position:
- **Contact segments** are the maximal segments of positive length shared between the tile's boundary and the boundary of a placed tile or of the car top. Report each segment once, per neighbour.
- **Contact points** are the points where the tile's boundary touches another boundary but that lie on no contact segment.

## 5. Fit, reason and strips

The tile at its resting position either **fits** (outcome `'fit'`) or **falls off** (outcome `'off'`, with a reason).

### 5a. Square and ▲

Let B be the bottom edge (for a ▲, the base), from x0 to x0 + 1 at height y0.

For each x in B, let `S(x)` be the y of the highest boundary point of the placed tiles or car top that lies directly below B or on it at that x. If nothing lies below B at that x, then x is **over nothing**.

Decide in this order. The first that applies is the reason:
1. **ONLY A POINT:** the set of x where S(x) = y0 has zero length (the tile touches only at isolated points).
2. **OVER THE EDGE:** some x in B is over nothing.
3. **NOT LEVEL:** S(x) < y0 somewhere in B. Report `gap = max over B of (y0 − S(x))` as `[p, q]` meaning (p + q√3)/2.
4. Otherwise the whole bottom edge lies on flat tops at height y0, which may be several tops meeting end to end, and an apex point under a seam is fine. Then check the strips (§5c):
   - a square needs **both** of its strips on the tower;
   - a ▲ needs **at least one**;
   - if not, the reason is **TOO FAR OUT**.
5. Otherwise it **fits**.

### 5b. ▼

The ▼'s lower left side runs from its top-left corner down to its point, and its lower right side from its point up to its top-right corner.

1. **NO SIDE:** neither lower side coincides exactly, along its whole length, with a slanted side of a placed ▲. Its left side can only coincide with a ▲'s right slant, and its right side with a ▲'s left slant. Both sides coinciding is a notch.
2. **TOO FAR OUT:** at least one side coincides, but neither of its strips is on the tower (§5c).
3. Otherwise it **fits**.

### 5c. Strips: "on the tower" (half off, never more)

- **Strips.** The x-axis is cut into half-tile strips `[n/2, n/2 + ½]`, and every tile covers exactly two of them, its left and right strip.
- **Recording.** Every placed tile records, for each of its two strips, whether that strip is **on the tower**.
- **The car.** Its strips, for x within [−half, half], are on the tower.
- **A square or ▲ being placed:** its strip is on the tower iff, across that strip's full width, its bottom edge lies on a flat top whose own strip there is on the tower. That flat top is the car top, the top edge of a square, or the top edge of a ▼.
- **A ▼ being placed:**
  - A strip where one of its lower sides coincides with a ▲'s slant is on the tower iff that ▲'s strip at the same x-range is on the tower.
  - A strip with no such side, the **free half** of a ▼ held by one side, is on the tower iff a flat top lies directly under that strip at exactly the height of the ▼'s point, covering the strip's full width, and that top's strip there is on the tower (a small pocket). Otherwise it is over air.
- **Reporting.** Report `strips: [leftOn, rightOn]` for every result, fit or off.

## 6. Choosing the way for triangles when `way` is omitted

1. If ▼ fits, the result is ▼.
2. Else if ▲ fits, the result is ▲.
3. Else if ▼'s reason is TOO FAR OUT, the result is ▼ (off, TOO FAR OUT).
4. Else the result is ▲, off, with ▲'s reason.

Note what you observe about whether ▲ and ▼ can both fit at the same col.

## 7. Placing

- `place(build, result)` adds the tile of a **fit** result to a **new** build and leaves the old build unchanged.
- Placing an off result throws.
- A build is `newBuild({half})` followed by any number of places.

## 8. Comparison format

`drop` returns exactly this object:

```json
{
  "outcome": "fit" | "off",
  "way": "up" | "down" | null,
  "verts": [[X,p,q], ...],
  "reason": null | "NO SIDE" | "ONLY A POINT" | "OVER THE EDGE" | "NOT LEVEL" | "TOO FAR OUT",
  "contacts": { "segments": [[[X,p,q],[X,p,q]], ...], "points": [[X,p,q], ...] },
  "shine": [[[X,p,q],[X,p,q]], ...],
  "strips": [true|false, true|false],
  "gap": [p,q] | null
}
```

- `way` is null for squares.
- `verts` are the tile's corners at rest, sorted lexicographically.
- Each segment's two endpoints are sorted lexicographically, and the segment list is sorted.
- `points` are sorted and exclude points lying on any contact segment.
- `shine` equals `contacts.segments` when the outcome is fit, and `[]` when off.
- `gap` is set only for NOT LEVEL.

## 9. Golden cases

Each case is a sequence of drops on a bare car with half = 2, given as piece@x where x = col/2. ■ is a square; ▲ and ▼ are triangles with the way forced. Every drop but the last fits; the last has the stated outcome.

| # | Drops | Last drop's outcome |
|---|---|---|
| 1 | ■1, then ▲1.5 | off, OVER THE EDGE |
| 2 | ▲−2, ▲−1, ▲0, ▼−1.5, ▼−0.5, then ■−1 | fit (it spans two ▼ tops meeting over ▲−1's apex) |
| 3 | ▲−1.5, ▲−0.5, then ■−1 | off, ONLY A POINT |
| 4 | ▲1, then ▼1.5 | fit (hung by one side; free half over air beyond the car) |
| 5 | ▲1, ▼1.5, ▲1.5, then ▼2 | off, TOO FAR OUT |
| 6 | ■−1, ■−1, ▲−1, ▼−1.5, ▲−1.5, then ▼−2 | off, TOO FAR OUT |
| 7 | ■−2, ▲−0.5, ▼−1, then ▲−1.5 | off, NOT LEVEL, gap = 1 − √3/2 |
| 8 | ■−1, ■0, then ▲−0.5 | fit |
| 9 | ▲−1, ▼−0.5, then ▲0 | off, NOT LEVEL |
| 10 | ▲0, then ▲0 | off, ONLY A POINT |
| 11 | a square at col −1 | throws |
| 12 | ■−1, ■0; ▲−1, ▲0, ▼−0.5, ▼−1.5, ▼0.5; ▲−1.5, ▲−0.5, ▲0.5, ▼−1, ▼0; ■−1, ■0 | every drop fits |

Notes on case 6: the second ■−1 lands on the first. ▲−1 sits on top of the column. ▼−1.5 hangs on ▲−1's left side, and its left strip is over air. ▲−1.5 sits on ▼−1.5's top. ▼−2 would hang on ▲−1.5's left side, which is over air, and it has no pocket.

If any golden case disagrees with your reading of §1–8, log it in `ambiguities.md`. Do not change the expectation.

## 10. What to deliver

- `oracle.cjs` exports `{ newBuild, drop, place }` as above.
- `test-golden.cjs` runs the golden cases. Exit code 0 means all pass.
- `ambiguities.md`.
- Use polygon geometry on exact vertex coordinates: an overlap test by exact separating axes, or exact clipping. Find the resting height by a method of your own, for example the first contact over each pair of edges. Do not use lattice keys, edge hashing or precomputed column profiles.
- Plain Node, no dependencies, no floating point in any decision.
