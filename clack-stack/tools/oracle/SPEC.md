# Oracle specification: Clack Stack tile rules (revision 5b)

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

## 5. Fit and reason (revision 5b)

At its resting position the tile either **fits** (outcome `'fit'`) or **falls off** (outcome `'off'`). There is one reason: **ONLY A POINT**.

### 5a. Square and ▲

- **The test.** Let B be the bottom edge (for a ▲, the base) at height y0. The tile fits iff some segment of B of positive length lies on a horizontal top edge of a placed tile or of the car: a square's top edge, a ▼'s top edge, or the car top. Otherwise it is off with ONLY A POINT.
- **The rest of B** may be over a lower top, over a slant, or over nothing.
- **gap.** For every x in B, let `S(x)` be the y of the highest boundary point of the placed tiles or car directly below B or on it at that x; if nothing lies below B at x, S(x) is undefined there. When the tile fits, report `gap` = the maximum of (y0 − S(x)) over the x in B where S(x) is defined and S(x) < y0. If there is no such x, report `gap = null`.

### 5b. ▼

- **The test.** The ▼ fits iff at least one of its lower sides coincides exactly, along its whole length, with a slanted side of a placed ▲. Otherwise it is off with ONLY A POINT.
- **gap** is always null.

## 6. Choosing the way for triangles when `way` is omitted

- **One way fits.** If exactly one way fits, that way.
- **Both fit.** If both fit, the way whose resting position is lower. If they are equally low, ▼. Report in `ambiguities.md` whether this ever happens.
- **Neither fits.** If neither fits, ▲ (off, ONLY A POINT).

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
  "reason": null | "ONLY A POINT",
  "contacts": { "segments": [[[X,p,q],[X,p,q]], ...], "points": [[X,p,q], ...] },
  "shine": [[[X,p,q],[X,p,q]], ...],
  "gap": [p,q] | null
}
```

- `way` is null for squares.
- `verts` are the tile's corners at rest, sorted lexicographically.
- Each segment's two endpoints are sorted lexicographically, and the segment list is sorted.
- `points` are sorted and exclude points lying on any contact segment.
- `shine` equals `contacts.segments` when the outcome is fit, and `[]` when off.
- `gap` is as defined in §5.

## 9. Golden cases

Each case is a sequence of drops on a bare car with half = 2, given as piece@x where x = col/2. ■ is a square; ▲ and ▼ are triangles with the way forced. Every drop but the last fits; the last has the stated outcome.

| # | Drops | Last drop's outcome |
|---|---|---|
| 1 | ■1, then ▲1.5 | fit (half its base on the square; the other half past the car) |
| 2 | ▲−2, ▲−1, ▲0, ▼−1.5, ▼−0.5, then ■−1 | fit |
| 3 | ▲−1.5, ▲−0.5, then ■−1 | off, ONLY A POINT |
| 4 | ▲1, then ▼1.5 | fit |
| 5 | ▼0 alone on the bare car | off, ONLY A POINT |
| 6 | ■−1, ■−1, ▲−1, ▼−1.5, ▲−1.5, then ▼−2 | fit |
| 7 | ■−2, ▲−0.5, ▼−1, then ▲−1.5 | fit, gap = 1 − √3/2 |
| 8 | ■−1, ■0, then ▲−0.5 | fit |
| 9 | ▲−1, ▼−0.5, then ▲0 | fit, gap = √3/2 |
| 10 | ▲0, then ▲0 | off, ONLY A POINT |
| 11 | a square at col −1 | throws |
| 12 | ■−1, ■0; ▲−1, ▲0, ▼−0.5, ▼−1.5, ▼0.5; ▲−1.5, ▲−0.5, ▲0.5, ▼−1, ▼0; ■−1, ■0 | every drop fits |

If any golden case disagrees with your reading of §1–8, log it in `ambiguities.md`. Do not change the expectation.

## 10. What to deliver

- `oracle.cjs` exports `{ newBuild, drop, place }` as above.
- `test-golden.cjs` runs the golden cases. Exit code 0 means all pass.
- `ambiguities.md`.
- Use polygon geometry on exact vertex coordinates: an overlap test by exact separating axes, or exact clipping. Find the resting height by a method of your own, for example the first contact over each pair of edges. Do not use lattice keys, edge hashing or precomputed column profiles.
- Plain Node, no dependencies, no floating point in any decision.
