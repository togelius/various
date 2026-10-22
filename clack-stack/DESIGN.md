# CLACK STACK: final design

> This is the design the game was built from. It came out of six competing concepts,
> judged for fun, for fidelity to the photos and for how buildable they were. The game
> follows it closely. Playtesting changed some details: the hand hovers just above the
> build, word pops stay off the tower, PERFECT streaks escalate, and a dead end gives a
> warning before it topples. `README.md` describes what shipped.

*A fast tower-building race with see-through magnetic tiles, set on the living-room rug from the photos.*

Deliverables: `clack-stack/index.html` (one file, no dependencies, no image assets, Canvas 2D, WebAudio), `clack-stack/README.md` in the house style, and one bullet in the top-level `README.md`. Work happens on `main`, per the repo policy.

---

## 1. Pitch

A small hand in a navy-and-yellow striped sleeve holds a translucent magnetic tile above your tower. You slide it and let go. In the last centimetre the magnet yanks the tile into place with a CLACK, plus one extra clack for every edge it meets. You stack squares and triangles on a toy car base and keep the wobbly tower from tipping over its wheels. The goal is to push it past a ribbon tied to something in the room: "TALLER THAN THE WATERMELON BAG!", then the armchair, then "TALLER THAN YOU!". Crown the peak with the orange triangle, watch the boy's cube SMASH the tower apart, and go again, taller and on a narrower base, before the clock runs out. You drop a tile every half second, a payoff arrives every 10 to 20 seconds, and getting greedy ends in a glorious crash.

## 2. The one loop

**AIM, LET GO, CLACK. Keep it standing, tear the ribbon, CROWN it, SMASH it, next level.** You race a clock that you refill by finishing levels.

Every other element feeds that loop:
- Rings tempt you into overhangs.
- The cube is heavy ballast.
- The marble-run square braces the tower.
- Hazards shove the base.
- HOLD lets an expert keep building past the ribbon before crowning.

### How the judges' flaws are fixed

| Flaw named by a judge | Fix in this design |
|---|---|
| Free-form snapping at multiples of 30° gives unpredictable, tilted slots (Concept 1). | Everything sits on an exact lattice. Squares are always upright and triangles point straight up or down. Coordinates are integers, so there is no float drift, and only a handful of slots ever sit near the finger. |
| The ghost lies, because the tower rocks during the fall and a second tile may be in the air. | The slot and the grade are locked on release, in the tower's own frame. A tile in flight reserves its slot, and the next ghost treats it as built. The ghost and the drop call the same function. |
| Too many systems bury the clack. | Cut: bridge detection and PLINK break-offs, QUICK, swap-with-next and the duel. The overhang limit is now a slot rule rather than a physics system. |
| The PERFECT window shrinks to 31 ms (Concept 5). | PERFECT is a spatial window (±0.10 L) on a target whose sway speed is capped, so crossing it never takes less than about 70 ms. Nothing shrinks it over time. |
| Skill on one axis only (Concept 5). | Skill comes from four independent layers: PERFECT timing on a moving target, centre-of-mass control, edge geometry (DOUBLE/TRIPLE), and the clock economy with the crown gamble. |

---

## 3. Core mechanic, in exact terms

### 3.1 Units and frame

- **L** is one tile edge, which is 7.5 cm on the real toy. Tower heights are reported in cm as height in L × 7.5.
- **h** = √3/2 ≈ 0.866 L is the height of a triangle.
- The tower lives in a **tower-local frame**: the origin is the centre of the car top, x points right and y points up.
- The whole build, car included, is one rigid body. It rocks about a wheel and also bends with a cosmetic flex spring (section 3.6).

### 3.2 The lattice

Every vertex is a lattice point **(i, a, b)** of integers with a, b ≥ 0:
- x = i/2 L
- y = (a + b·h) L

Because √3 is irrational, two points coincide only when all three integers match. Edge matching is therefore an exact integer-key comparison, with no tolerances.

| Piece | Mass | Vertices (counter-clockwise) or shape |
|---|---|---|
| Square at (i,a,b) | 1 | (i,a,b) (i+2,a,b) (i+2,a+1,b) (i,a+1,b) |
| Up-triangle, base at (i,a,b) | 0.45 | (i,a,b) (i+2,a,b) (i+1,a,b+1) |
| Down-triangle, bottom vertex (i+1,a,b) | 0.45 | top edge (i,a,b+1) to (i+2,a,b+1) |
| Cube (2×2) at (i,a,b) | 3 | 2 L square, split into 8 unit edges |
| Marble square | 1 | square with a porthole; braces the tower (3.7) |
| Crown | 0.45 | orange up- or down-triangle (3.7) |

The **car top** is a run of unit edges along y = 0:
- one car: x from −1 to 1, two edges;
- two cars coupled: x from −2 to 2, four edges.

Every edge is a unit segment between two lattice points. A square has 4, a triangle 3 and a cube 8. An **edge map** (key → owners) marks an edge *exposed* when exactly one tile, or the car, owns it.

### 3.3 Slots: where a tile can go

Slots are generated only when the build changes (a landing, a reservation, a crash or a new level), never per frame. There are three generators:

1. **On each exposed horizontal top edge** (the car top, square tops, cube tops, down-triangle tops):
   - a square above it;
   - an up-triangle above it;
   - a cube in two poses, extending right and extending left.
2. **On each exposed vertical edge** (the side of a square or cube): a square beside it.
3. **On each exposed slanted edge of an up-triangle:** a down-triangle that shares it.
   - Between two adjacent up-triangles this is the Δ∇Δ notch, which matches 2 edges.
   - Off a lone triangle it hangs by 1 edge.

Two notes on the generators:
- An up-triangle's apex has no edge, so nothing stands on it.
- Squares never go on slanted edges, so nothing is ever tilted.

A candidate is **valid** only if all of the following hold:
- No part of it is below y = 0.
- Its centre is within ±6 L of the base centre.
- It does not overlap any built or in-flight tile. Use a SAT test with polygons shrunk by 0.02 L.
- It is **not occluded from above**: within its x-span shrunk by 0.15 L, no built or in-flight tile lies above its top. A tile can only fall straight down into a slot.
- Its **support depth is at most 2**:
  - Car-top edges have depth 0.
  - Through a matched edge that is the candidate's bottom edge, the candidate inherits the neighbour's depth.
  - Through a side or slanted edge, it gets the neighbour's depth + 1.
  - The candidate's depth is the minimum over its matched edges.
  - So at most two squares can hang out sideways from anything that stands, and a third is simply not offered.

Merge duplicate poses by key. For each candidate, store:
- **edges** = the number of its unit edges that coincide with exposed edges. The cap for scoring is 3.
- **supported** = true if one of its bottom edges is matched, or if edges ≥ 2. Otherwise it is **hanging**.

Expect 6 to 30 candidates.

### 3.4 Choosing the slot: one function for the ghost and the drop

`chooseSlot(handX)` runs every frame, using each candidate's current **world** centre: the tower-local position, rotated by θ about the active wheel, plus the flex offset (3.6).

1. Keep the candidates whose |world centre x − handX| ≤ **R**:

   | Mode | R |
   |---|---|
   | Normal | 0.6 L |
   | BIG MAGNETS | 1.0 L |
   | Crown, normal | 1.2 L |
   | Crown, BIG MAGNETS | 1.6 L |

2. Rank them:
   1. supported before hanging;
   2. then smaller |dx|, where the slot currently shown as the ghost gets a 0.08 L **hysteresis** bonus;
   3. then the higher slot (the first one a falling tile would meet).
3. If nothing qualifies, the result is a **MISS**.

In plain words: the tile lands on the top nearest your finger, and if there is no top within reach it sticks to a side. Tapping into a gap drops it all the way in (TRIPLE), and tapping beside a column at car level widens the base.

**The ghost** is drawn at the chosen slot's live world pose:

| Ghost state | What it shows |
|---|---|
| **Gold** outline + sparkle | \|dx\| is within the PERFECT window (3.5) right now |
| **White** outline | it will clack (GREAT or CLACK) |
| "×2" / "×3" chip | DOUBLE or TRIPLE |
| Glowing ring icon | the slot will collect a ring |
| Rim blushing red + small "!" (TIPPY) | adding this tile would put the centre of mass outside the wheels |
| Red X where the drop line meets the build, or the rug | MISS |

A faint dotted drop line runs from the hand to the ghost.

### 3.5 Release, grade, fall, yank

**On release**, `chooseSlot` is called one more time:
- The slot and the grade are **locked**.
- The slot is **reserved**: it is added to the edge map as an in-flight tile, and slots are regenerated.
- The next tile reaches the hand **0.18 s** after release, so two tiles can be in the air at once.

**Grade**, from |dx| at release:

| Grade | Normal | BIG MAGNETS |
|---|---|---|
| PERFECT | ≤ 0.10 L | ≤ 0.18 L |
| GREAT | ≤ 0.25 L | ≤ 0.35 L |
| CLACK | anything else within R | anything else within R |

**Fall:**
1. The tile falls at hand x, easing in under gravity, for clamp(0.12 + 0.025·d, 0.18, 0.34) s, where d is the drop distance in L.
2. For the last 40 ms of the fall it **leans 4° toward the slot and shivers ±1 px** (the pre-snap tell).
3. Then the **magnet yank**: 70 ms on a t³ ease into the slot's live pose. The tile tracks the moving tower and rotates into place; a triangle bound for a notch flips from point-up to point-down mid-pull.
4. Landings keep their release order: each lands at max(its own time, the previous landing + 0.03 s).

**On landing:**
- The tile joins the build.
- Mass, centre of mass, inertia, edge map and slots are recomputed.
- The kick is applied (3.6).
- Score and effects fire.
- Rings, goal, brace and tip are checked.

**MISS:** the tile becomes a debris body falling at hand x.
- If it crosses the build's height profile, it bonks off sideways (vx ±3 L/s, spin).
- It clatters onto the rug and stays there as mess.
- The combo resets.

**Fuse:** a ring around the hand empties over the level's fuse time (section 5) and auto-releases at the current hand x, graded normally. BIG MAGNETS has no fuse.

### 3.6 Tower dynamics: a rocking block plus a flex spring (no stacking solver)

**Car geometry:**
- The plate top is at y = 0. The plate is 0.18 L thick.
- Wheels have radius 0.2 L and touch the rug at y = −0.5 L, 0.2 L in from each car end.
- Wheel contact points are at **x = ±0.8 L** for one car and **±1.8 L** for two.
- Each car has mass 1.5, with its centre of mass at y = −0.25.

**Rock state (θ, ω):** θ > 0 means rotating clockwise about the right wheel, θ < 0 means rotating about the left wheel.
- With P the active pivot and C the centre of mass (CoM), let r′ be (C − P) rotated by θ:
  θ″ = M·g·r′ₓ / I_P − 0.8·θ′,
  with g = 24 L/s² and I_P = Σ mᵢ(|rᵢ − P|² + kᵢ). Here kᵢ is 1/6 for a square, 0.04 for a triangle and 2.0 for the cube.
- When θ crosses 0, the tower **slaps** onto both wheels: switch pivot, ω ×= 0.6, and kick the flex by −0.3·Δω·H.
- If |ω| < 0.08 rad/s at the slap, it rests: θ = ω = 0.
- If C is outside the wheels while resting, it starts tipping on its own.
- **Tipping angle:** α = atan2(w − |cₓ|, c_y + 0.5), on the side of the lean.
- **CRASH** when θ > α + 0.22 rad (normal) or α + 0.45 rad (BIG MAGNETS). Past α, gravity takes over, so the player has about 0.6 to 0.9 s to save the tower with a counterweight.

**Snap kick** on landing:
Δω = K · m · [(x_slot − cₓ) + 0.6·dx_signed] / I_P · g_f
- g_f is 0.3 for PERFECT (the magnet "catches" it softly), 1.0 for GREAT and 1.5 for CLACK.
- With both wheels down, the sign of Δω picks the pivot.
- BIG MAGNETS multiplies all kicks by 0.5.

**Flex** (the moving target):
- One damped spring s on the lateral offset of the top, with ω_n = 9 / (1 + 0.06·H) and ζ = 0.15 (0.10 from level 7).
- Each tile is drawn, and its slots are placed, at x + s·(y/H)².
- |s| ≤ 0.35 L.
- The landing kick is Δṡ = K_f · m · dx_signed · g_f. A PERFECT instead damps the spring: ṡ ×= 0.6.
- The CoM includes the flex: cₓ += s · Σmᵢ(yᵢ/H)² / M.
- The top's lateral speed is capped at 2.8 L/s, so the 0.20 L PERFECT window always lasts at least about 70 ms.

**Calibration at boot** (under 5 ms, run headless on a reference tower: 2 wide, 8 L tall, centred, one car). Bisect K, K_f and the hazard impulses to hit these targets:

| Event on the reference tower | Peak θ, or flex |
|---|---|
| GREAT on the outer column | 0.25 α |
| CLACK yank (dx 0.5) on the outer column | 0.45 α, flex about 0.2 L |
| PERFECT | ≤ 0.10 α |
| Bump car | 0.35 α |
| Foot stomp | 0.50 α |

The results are exposed via `CS.calib()`.

**Tip tell:**
- The far wheel visibly lifts.
- At θ/α > 0.4 a CREAK fades in, with volume ((θ/α − 0.4)/0.6)².
- At θ/α > 0.6 a red vignette pulses on the side it is falling toward, and the event `tipwarn` is logged.
- At θ/α > 0.8 the tile outlines blush red.

**SAVE:** θ/α reached at least 0.6, a tile landed on the opposite side during that excursion, and the tower came back to rest without crashing.

**Crash:**
1. 120 ms freeze.
2. 0.35 s of slow motion at 0.4× while the tower rotates over its wheel.
3. Every tile becomes debris.
4. The combo resets, and a new car rolls in 0.7 s later.
5. The goal stays the same. Any torn ribbon is restored, and a held or waiting crown is lost.
6. The clock keeps running. Crashes cost time, never the run.

**Debris:**
- Independent rigid polygons that collide with the rug plane only: corners tested against the floor, restitution 0.35, friction 0.6, spin 4 to 12 rad/s.
- Debris never collides with other debris. Overlaps read as mixed colour.
- Rings roll as wheels.
- At most 60 pieces; the oldest fade out.
- Pieces sleep once still.

### 3.7 Rings, brace, cube, crown and overtime

**Rings:**
- Magenta rings bob in the air, anchored in the tower frame (1 per level in L1 to L3, then 2).
- Each sits between 0.35 G and 0.75 G high and 1 to 2 L outside the base edge, so you have to hang squares out to reach it. Two rings go on opposite sides.
- A landing tile whose polygon contains the ring centre (with 0.15 L slack) collects it: **+2 s**, and the ring clacks flat onto that tile's face, as in the photos.
- Collecting a ring pulls the CoM outward, which creates the "grab it, then counterweight" decision.

**Marble-run square:**
- From L2, every 7th square in the bag is a marble square, in any palette colour, with a porthole.
- On landing, the small hand pokes the green gear into the hole (click-click-whirr). The flex s and ṡ go to 0 over 0.3 s and |ω| ×= 0.3. **BRACED!**

**Cube:**
- Appears from L2, at most 1 per bag.
- It arrives in the hand as a small flat cross net and folds in mid-air during the fall: 5 hinge clacks, 36 ms apart, rising in pitch.
- It lands as a 2 × 2 cube with a red top, a yellow left side and an orange front, each face carrying a 2×2 grid.
- Its slots come from generator 1, so it can overhang by half its width.
- Landing is a BOOM-CLACK with a 90 ms hit-stop. It is heavy ballast.

**Goal ribbon:** a dashed ribbon at height G, with a small icon of the room object at its end.
- When the highest point of the build reaches G, the ribbon tears and the goal bonus is paid.
- The **orange CROWN triangle drops straight into the hand**, and the tile it replaces goes back to the front of the queue.
- While the crown is in hand, only triangle slots whose top is at least G are offered (if none exist, any triangle slot).
- Crowning gives the CROWN bonus and +3 s, then the SMASH.
- A crown MISS bounces off the build ("OOPS!"), the hand catches a fresh crown 0.4 s later, and the combo resets.

**HOLD and overtime** (the adult gamble):
- A HOLD box sits top-right. Swapping trades the tile in hand with the held tile. If the box is empty, the next tile comes to the hand. You get one swap per release.
- Putting the crown on hold starts **OVERTIME**:
  - every tile that lands with its bottom at or above G scores double;
  - the crown bonus grows by +50% for every whole L the crown's base ends up above the ribbon;
  - the HUD shows "CROWN ×1.5" and so on, live.
- The risk: the clock keeps running, the tower keeps getting tippier, and a crash loses the crown.
- A kid never needs HOLD, because the crown is simply in their hand.

---

## 4. Controls

The hand stays on a fixed screen line just under the HUD. Only its x matters. Grading always uses the **logical** hand x; the drawn hand eases to it in 40 ms.

### Touch (phone or tablet, either orientation)

- **Put a finger down anywhere:** the hand jumps to the finger's x and follows as you drag. **Lift to let go.** So a quick tap drops the tile right above where you tapped ("put it there").
- **A touch that starts in the HOLD box** swaps tiles and does not drop.
- **The pause button** is top-left, 44 px.
- Only the first finger is tracked.
- `touch-action: none`, `preventDefault`, no double-tap zoom, no context menu.
- A `pointercancel` never drops.

### Mouse

- The hand follows the pointer.
- **Mousedown drops instantly.**
- Right-click, or a click on the HOLD box, swaps.

### Keyboard

| Key | Action |
|---|---|
| ← → or A D | Slide the hand at 10 L/s (0.06 s ramp) |
| Space, ↓ or Enter | Drop |
| Shift, ↑ or C | Hold / swap |
| P or Esc | Pause |
| M | Mute |
| Space or Enter | Start; AGAIN on the results screen |
| R | Restart from the results screen |

**Keyboard detent:** when key-sliding brings the hand into the PERFECT window, the hand stops for 0.12 s, once per entry.

### Five-second lesson (first run only)

A finger icon slides and lifts, labelled for the input in use:
- touch: **"MOVE… LET GO!"**
- mouse: **"MOVE… CLICK!"**
- keys: **"← → … SPACE!"**

It disappears after the first clack, and the "seen" flag is saved.

The game auto-pauses on `visibilitychange` and on orientation change.

---

## 5. Game flow

### Title

- The scene is the boy's build from the photos, drawn with the same tile renderer from a hand-authored pose list (this one is not lattice-bound):
  - a wall of blue, light-blue and yellow squares, rotated −18° so it slopes, with two magenta rings stuck on it;
  - the orange triangle balanced on the very peak;
  - the faceted dome of orange, purple, blue, green and red triangles beside it;
  - marble squares at the front;
  - the red-topped cube at the left.
- **CLACK STACK** is spelled in chunky letters, one per translucent tile, and poking a letter makes it clack.
- **TAP!** pulses.
- A **BIG MAGNETS** toggle (horseshoe-magnet icon) sits bottom-left.
- Best scores are printed on the lid of the tile-set box sitting on the rug.

### Start

1. A tap anywhere outside the toggle:
2. The striped arm shoves the cube in from the left. BOOM: about 30 tiles cartwheel away as debris, with a cascade of clacks, a slide whistle and a 14 px shake.
3. At 0.9 s the car bases roll in and couple with a clack.
4. The ribbon and its label appear, the clock reads 30.0, and the hand drops in holding a tile.

### Level

Build, tear the ribbon, crown, then **SMASH** (1.4 s, with the clock paused):
1. The striped arm shoves the cube in at 30 L/s and the tower bursts into debris.
2. The tally ticks +5 × mult per tile with rapid clacks.
3. The level-complete time bonus flies into the clock.
4. "LEVEL 3: TALLER THAN THE ARMCHAIR SEAT" is announced.
5. New cars roll in for 0.5 s.
6. A tile is already in the hand.

### Crash

The tower is lost, a new car arrives 0.7 s later and you rebuild toward the same goal (3.6).

### Time up

When the clock reaches 0.0:
1. "TIME!" appears and input locks.
2. Tiles in flight land.
3. The cube smashes whatever is standing.
4. After 1.2 s, the **results card** appears.

### Results

- Shown on the card:
  - score, counted up with clacks;
  - the level reached and its name ("TALLER THAN THE ARMCHAIR!");
  - the tallest tower in cm;
  - the number of PERFECTs;
  - the longest PERFECT streak;
  - a NEW BEST burst: confetti of tiny triangles, and the orange triangle drops onto the score.
- The crash pile on the rug stays **pokeable**: tapping a piece flicks it with a clack, and now and then a slide whistle.
- A big **AGAIN** button sits on the card, with a small MENU button. Taps are locked out for 0.8 s.
- AGAIN, Space or Enter puts a car on the rug with a tile in hand in under 1 s.

### Pause

A dimmed overlay with RESUME and MENU.

---

## 6. Escalation

| Lvl | Base | Goal G | "TALLER THAN…" | Fuse | Rings | Hazard |
|---|---|---|---|---|---|---|
| 1 | 2 cars (4 L) | 4 L | the watermelon bag | 2.4 s | 1 | none |
| 2 | 2 cars | 5 L | the tile box | 2.2 s | 1 | none (cube enters the bag) |
| 3 | 1 car (2 L) | 6 L | the armchair seat | 2.0 s | 1 | none |
| 4 | 1 car | 7 L | the egg chair seat | 1.8 s | 2 | none |
| 5 | 1 car | 8 L | the side table | 1.7 s | 2 | bump car every 12 s |
| 6 | 1 car | 9 L | the armchair back | 1.6 s | 2 | bump every 11 s |
| 7 | 1 car | 10 L | the window sill | 1.5 s | 2 | bump every 10 s; flex ζ 0.10 |
| 8 | 1 car | 11 L | the top of the egg chair | 1.4 s | 2 | bump and foot alternate, every 10 s |
| 9 | 1 car | 13 L | the air conditioner | 1.3 s | 2 | every 9 s |
| 10 | 1 car | 15 L | **YOU!** (112 cm) | 1.2 s | 2 | every 9 s |
| 11 | 1 car | 17 L | the floor lamp | 1.1 s | 2 | every 8 s |
| 12 | 1 car | 19 L | the bookshelf | 1.1 s | 2 | every 8 s |
| 13 | 1 car | 22 L | A GROWN-UP! | 1.1 s | 2 | every 8 s |
| 14 | 1 car | 26 L | the door | 1.1 s | 2 | every 8 s |
| 15 | 1 car | 32 L | the ceiling | 1.1 s | 2 | every 8 s |
| 16+ | 1 car | +3 L each | the roof, the clouds, the moon, the moon ×2… | 1.1 s | 2 | every 8 s |

From L15 the room opens to sky, then night with stars and a moon.

### Piece bag

The bag holds 10 pieces, shuffled:

| When | Squares | Triangles | Cube |
|---|---|---|---|
| L1 | 7 | 3 | none |
| L2 and later | 6 | 3 | 1 |
| BIG MAGNETS | 7 | 2 | 1 |

- On the very first run, the first 4 pieces are squares.
- Colours are drawn at random from the 7 tile colours, never the same colour twice in a row.

### Clock

- Starts at 30.0 s, capped at 60 s, and runs on game time.
- Income:

  | Source | Time |
  |---|---|
  | Level complete, L1 to L6 | +10 s |
  | Level complete, L7 to L10 | +9 s |
  | Level complete, L11 and later | +8 s |
  | Ring | +2 s |
  | Crown | +3 s |

- Paused during a SMASH. BIG MAGNETS drains it at 0.6×.

### Hazards (not in BIG MAGNETS)

- **Bump car:** a green car base zooms along the rug. It is announced 1.2 s ahead with a beep-beep horn and a wiggling arrow at the screen edge. It hits the base with the calibrated 0.35 α kick, toward the far side.
- **Foot** (L8 onward, alternating with the bump car): a grown-up's bare foot. Its shadow grows on the rug beside the base for 1.0 s with a rising "whooo", then THUMP: the calibrated 0.5 α kick away from the foot, plus a flex kick.
- **Counterplay:** a wide, low tower shrugs both off. A skinny one needs a counterweight drop timed with the hit.

### Emergent difficulty

α shrinks with height: for a 2-wide tower on one car it is about 8° at 10 L and about 5° at 15 L. Meanwhile the fuse shortens, the flex slows and deepens, and hazards arrive more often.

### Target runs

| Player | Run length | Typical end level |
|---|---|---|
| A five-year-old, normal mode | 60 to 90 s | L2 to L4 (random taps clear L1 in about 10 s) |
| A five-year-old, BIG MAGNETS | 2 to 3 min | clacking nonstop |
| An average adult | about 3 min | L6 to L8 |
| An expert | 5+ min | L11 to L14 (L15 is the wall) |

---

## 7. Scoring and combos

**Per snap:** grade points × edges × multiplier, where grade points are PERFECT 25, GREAT 15 and CLACK 10.
- **edges** is 1, 2 or 3. Two edges show "DOUBLE CLACK!", three show "TRIPLE CLACK!". The cap is 3, even for a cube that meets more.
- In OVERTIME, the snap scores ×2.

**Combo:**
- +1 per snap, +1 more for a PERFECT, and +1 more per extra edge. A PERFECT DOUBLE adds 3.
- **Multiplier** = 1 + floor(combo/6), up to **×5**. It shows as a chip ("×3") with a bar filling toward the next step.
- **The combo resets on a MISS or a CRASH.**

**Bonuses:**

| Event | Points |
|---|---|
| Ring | 50 × mult |
| SAVE | 75 × mult |
| BRACED | 20 × mult |
| Goal crossed | 20 × G × mult |
| CROWN | 100 × level × (1 + 0.5·k), where k = whole L of the crown's base above the ribbon (no multiplier) |
| SMASH tally | 5 × tiles × mult |

**Saved in localStorage**, all reads and writes in try/catch:
- `clackstack.best` = {score, level, cm, streak}
- `clackstack.bestBig`, kept separately for BIG MAGNETS
- `clackstack.prefs` = {big, mute, seenHint}

**Rough score bands:** a kid scores 1 to 4k, an adult 8 to 20k, and an expert 50k and up.

---

## 8. Juice

**The snap, the heart of the game:**
1. The lean and shiver (40 ms).
2. The magnet zzip: 70 ms of band-passed noise sweeping 800 to 3000 Hz, while the tile accelerates on a t³ ease.
3. The CLACK, then:
   - the tile flashes white (60% to 0 over 120 ms);
   - a 3 px white line glows along each joined edge and fades over 200 ms;
   - 8 sparks in a lighter shade of the tile's colour fly along the edge;
   - the build squashes 4% for 70 ms;
   - a 1.5 px shake for 80 ms;
   - `navigator.vibrate(8)` where supported;
   - "+25" pops up in the tile's colour.
4. Word pops ("PERFECT!", "DOUBLE CLACK!", "SAVE!", "BRACED!", "OVERTIME!") scale from 1.4 to 1.0 with overshoot, drift up 30 px and fade over 500 ms.

**Other moments:**

| Moment | Effect |
|---|---|
| **PERFECT** | 40 ms hit-stop; a white ring expanding from the tile; the tower gets only 0.3× of the rock |
| **DOUBLE/TRIPLE** | one click per edge, 28 ms apart, each a fifth higher (a little marimba run) |
| **Cube** | 5-hinge fold in mid-air with rising clacks; BOOM-CLACK; 90 ms hit-stop; 6 px shake; the car's springs visibly squash |
| **Tipping** | wheel lift, creak, red edge vignette, red-blushing outlines |
| **SAVE** | the wheel slaps down with a thump and a rising whoosh |
| **Crash** | 120 ms freeze; 0.35 s at 0.4×; un-clack cascade; 14 px shake decaying over 0.5 s; slide whistle; tiles pile on the rug, mixing colours |
| **MISS** | the tile bonks, skids and settles; dull "tok" plus a soft two-note "aww" |
| **Goal** | the ribbon tears like finish tape; confetti of tiny triangles; a big label "TALLER THAN THE ARMCHAIR!" |
| **Crown** | a gold glint sweeps the triangle; 80 ms hit-stop |
| **Ring** | 60 ms hit-stop; the ring snaps flat onto the tile face |
| **BRACED** | the hand pokes the gear in; the gear spins twice; the sway stops dead |
| **SMASH** | 18 px shake; tiles fly; the +5 tally ticks with rapid clacks; "+10" flies into the clock |
| **Bump car** | edge arrow; 8 px shake on impact |
| **Foot** | growing shadow; 10 px shake; a ring of rug fluff |
| **Clock** | last 5 s: digits pulse red; 3, 2, 1 get bigger |
| **Coloured light** | each clack sends a 300 ms pulse of the tile's colour across the rug |

`prefers-reduced-motion` halves all shakes and skips the slow motion.

---

## 9. The look

### View

- A side view from a kid's eye level, as in photo 2. The tower is a face-on wall of tiles standing on the car base, which sits on the front band of the rug.
- The rug is a perspective trapezoid across the bottom 16 to 18% of the screen. The blurred room sits behind it with 0.4 parallax.
- **Zoom:** L_px = clamp(min(W/7.5, (groundY − handY) / max(G + 0.8, top + 2.5)), 30, 72), eased at 3/s. Below 30 px:
  - zoom stops and the camera scrolls up so the top stays 2.5 L under the hand;
  - a slim **tower gauge** on the right edge shows the whole silhouette, the CoM dot, both wheel markers, the ribbon tick and a tilt colour.
- **Layout:**
  - Portrait has a 64 px HUD strip at the top: pause and mute, score with the multiplier chip, a big clock in the centre, NEXT and HOLD at the top-right.
  - Landscape puts the HUD in the corners and shows more room on the sides.
  - There is a 16 px gutter and the HUD respects safe-area insets.

### Palette

| Use | Colour |
|---|---|
| Red | `#E8323C` |
| Orange | `#FF7A1A` |
| Yellow | `#FFD21F` |
| Green | `#2EBF4F` |
| Blue | `#2F5BEA` |
| Light blue | `#5EC8F2` |
| Purple | `#8A4FE0` |
| Ring magenta | `#D6247F` |
| Marble lavender tint | `#B9A3F0` |
| Gear green | `#7CC23A` |
| Sleeve | navy `#1E2541`, stripes yellow `#E8C547` and pale blue `#8FA6C9` |
| Rug | cream `#EDE3D3`, rust `#D9793F`, salmon `#E5A487`, pale blue `#A9BFD0`, slate `#7F99B3`, dusty pink `#E3A3A8` |
| Room | wall `#F2EEE8`, wood floor `#9C7B5E`, egg chair `#F7F5F0`, armchair raspberry `#B3244A` with legs `#C99A64` |
| UI | navy `#1E2541` text with a white outline, PERFECT gold `#FFC531` |

### Tiles

Sprites are cached by (shape, colour, variant, rounded L_px), with one body layer and one detail layer. They are rebuilt once zoom settles; in between, the old sprites are scaled.

- **Body:** filled at alpha 0.6 with a gradient from 12% lighter at the top-left to 8% darker, drawn with `globalCompositeOperation = 'multiply'`. The rug and room show through tinted, and wherever tiles overlap (falling tiles, the cube's 3/4 faces, the debris pile) the colours mix like real filters: blue over yellow reads green.
- **Detail**, drawn source-over:
  - a frame 0.09 L wide in a deeper shade at alpha 0.9;
  - an embossed pattern at alpha 0.3, taken from the real tiles: an inset square on most squares, X-and-diamond facets on orange squares, an inner triangle with a centre dot on triangles, a 2×2 grid on cube faces, a porthole with a ring of dots on marble squares;
  - rivet dots near the corners;
  - a white gloss streak, drawn with `'screen'` at 0.25 and clipped to the tile.
- **Rings:** a thick magenta stroke drawn with multiply, plus a highlight arc.
- **Ghost:** a 2 px dashed outline in white or gold with a 12% fill.
- **Against the night sky** (L15 and later), multiply would turn tiles black, so bodies switch to source-over at alpha 0.8 plus a `'screen'` glow, reading as lit glass.

### Coloured light on the rug

Each frame, redraw the build's tile bodies through a shear-and-squash transform (y squashed to 0.22, skewed back and to the right as if lit from the window at the upper left):
- with multiply at alpha 0.3;
- plus a `'lighter'` pass at 0.12 for a bright core.

The stained-glass shadow sways with the tower.

### Rug

- Generated once into a flat 1024×512 texture:
  - cream ground with value-noise "abrash" colour shifts;
  - a central medallion, nested border bands and stepped motifs in rust, salmon, pale blue and pink;
  - worn back toward cream by a noise mask;
  - about 6,000 one-to-two-pixel pile speckles;
  - a fringe at the back edge.
- On each resize, it is warped into an offscreen floor canvas as about 80 perspective strips.
- Each frame draws the floor with one `drawImage`, plus soft shadow-blob sprites under the debris.
- Two loose tiles, one pink and one yellow, lie at the back of the rug, as in photo 1.

### Room

Pre-rendered per resize at 1/4 resolution and scaled up with smoothing, which gives a cheap depth-of-field blur without `ctx.filter`. It contains:
- the white egg pod chair with its canopy and pedestal (left);
- the raspberry armchair with tapered wooden legs (right);
- a window with a white AC unit;
- a dark-legged stool or side table;
- the white tile-set box with a made-up colourful panel, lying on the floor;
- the green-striped watermelon bag with a purple handle (no logo or character);
- mint and pink game controllers with grey cables;
- a white console.

Above the room, a gradient carries on into the sky: day blue, then dusk, then night `#1B2140` with stars and a moon `#F6F1D9`.

### Pieces

- **Car base:** a translucent red (or green) plate with a 2×4 inner grid, drawn in slight 3/4 so the top shows, with tow hooks at both ends and black wheels with grey hubs. It rotates with θ, so the far wheel visibly lifts.
- **The hand:** a small hand at the end of the striped sleeve coming down from the top edge, with red marker scribbles on the back, as in the photos. Its fingers grip the tile's top edge and spring open on release. It waves at TIME!.

### Text

Fredoka 600/700 from Google Fonts (`display=swap`), falling back to `ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`. All HUD text is drawn on the canvas.

---

## 10. Audio (WebAudio, nothing pre-recorded)

**Plumbing:**
- Master chain: DynamicsCompressor, then a gain stage.
- Pre-built noise buffers.
- A cap of 24 simultaneous voices (the oldest is cut). The slide whistle and the fanfare get priority.
- The AudioContext is unlocked on the first `pointerdown` or `keydown` (iOS).
- **M** mutes, and the setting persists.
- The game ducks under crashes and smashes: music gain drops to 0.3 for 1 s.

**Sounds:**

| Sound | Recipe |
|---|---|
| **CLACK** | 4 ms high-passed noise click (above 3 kHz). A triangle "tock" whose pitch climbs the C-major pentatonic with the combo (C5 D5 E5 G5 A5 C6 D6 E6 G6 A6, index = combo mod 10), 45 ms, ±3% detune. A 160 Hz sine body, 60 ms, scaled by mass. |
| Zzip | band-passed noise sweeping 800 to 3000 Hz over 70 ms |
| PERFECT ting | sines at 2093 and 3136 Hz, 250 ms |
| Multi-edge | extra clicks 28 ms apart, each a fifth higher |
| Cube | 5 fold clacks, then BOOM-CLACK: a 70 Hz sine drop plus noise |
| MISS | low-passed "tok", then an "aww" (two descending triangle notes) |
| CREAK | sawtooth at 55 to 80 Hz through a resonant band-pass (Q 8, about 400 Hz), wobbled by a 5 Hz LFO; volume follows how close the tower is to tipping; a heartbeat thump above 0.9 |
| SAVE | thump, rising whoosh, major chord |
| CRASH | after the freeze, 20 to 40 clatter tocks over 0.8 s at random pitches, stereo-panned by x; a low thud; a slide whistle from 1200 to 300 Hz over 0.6 s |
| SMASH | noise boom, then rapid tally clacks |
| Ribbon | noise-burst tear, then a C-E-G-C′ fanfare |
| Crown | "ding-ding" plus a shimmer |
| Ring | two-note bell, E6 then B6 |
| Gear | 6 ratchet clicks speeding up into a whirr |
| Bump car | square-wave beep-beep at 660 Hz, then a bonk |
| Foot | rising filtered-noise "whooo", then a 60 Hz thump |
| Fuse | soft ticks at 50% and 75%, a double tick in the last 0.3 s |
| Clock | wood-block tick every second in the last 5 s; 3, 2, 1 louder |
| Haptics | `vibrate(20)` on PERFECT, `[30,40,30]` on a crash |

**Adaptive music:** a toy-box groove in C pentatonic, scheduled ahead (25 ms timer, 100 ms lookahead), so every clack is in key.
- Tempo = 120 + 3·(level − 1) BPM, capped at 150.
- Layers by multiplier:

  | Multiplier | Layers playing |
  |---|---|
  | ×1 | kick on 1 and 3, shaker on the eighths |
  | ×2 | + pentatonic bass plucks |
  | ×3 | + marimba ostinato |
  | ×4 | + claps |
  | ×5 | + sparkle arpeggio |

- You can hear your streak.

---

## 11. For the kid, and the expert hook

### Kid-friendly: BIG MAGNETS, a title toggle that persists

- Capture radius 1.0 L. PERFECT ±0.18 L, GREAT ±0.35 L.
- No fuse: the hand never drops on its own.
- No hazards.
- Kicks at 0.5×, crash margin α + 0.45.
- Two cars through L4.
- The clock drains at 0.6×.
- A separate best score.

**No-fail start in either mode:**
- L1 has a 4 L-wide base and a 4 L goal, and the first-ever run deals 4 squares first.
- A crash is never the end, only lost time, and it is funny: slide whistle, a cartwheeling pile you can poke afterwards.
- No reading is needed: the ghost colours, icons and room objects carry the meaning.
- The kid shouts goals they understand: "TALLER THAN THE ARMCHAIR!", "TALLER THAN YOU!".

### Expert hook

- Hold ×5 by chaining PERFECTs on a target that sways and rocks. The skill is releasing when the ghost flashes gold.
- **Manage the centre of mass:** build a 2-wide trunk, then taper. Counterweight right after grabbing a ring. Drop on the far side as a bump or foot hits.
- **Geometry:** Δ∇Δ notches for DOUBLEs, gaps for TRIPLEs. Triangle bands shift the next square row by half a tile and narrow the tower; experts use this to taper. A lone up-triangle caps a column; recover with a hanging ∇.
- **HOLD tactics:** keep the cube for low ballast, never put it on top. Hold the crown for OVERTIME when the clock allows.
- **Clock economy:** rings and crowns buy time, overtime spends it, crashes waste it.
- **Stats to chase:** best score, highest level, tallest tower in cm, longest PERFECT streak.

---

## 12. From the photos

- **The iconic build is the title screen:** the sloped wall of blue, light-blue and yellow squares, two magenta rings stuck on its face, the triangle dome beside it, and the single orange triangle balanced on the very peak.
- **The orange triangle on the peak** becomes the CROWN on every finished tower.
- **Magenta rings** are pickups that clack flat onto a tile's face, exactly as they sit on the photographed squares.
- **Squares and equilateral triangles share one edge length.** Triangle bands shift the next row of squares by half a tile, as in the real wall. The Δ∇Δ notch is the toy's real double-edge snap.
- **The cube from photo 3** (red top, yellow left, orange front, a 2×2 grid on each face) appears three ways:
  - as the heavy piece that folds itself up from a flat net, which is the toy's net trick;
  - as the SMASH, shoved in by the little striped arm;
  - as the title shove.
- **Car bases** (red and green, black wheels, tow hooks at both ends) are the foundation, two coupled for levels 1 to 2. The green one returns as the bump car.
- **The small hand** holds each piece the way it holds the purple square in photo 2. It has the navy-and-yellow (and pale-blue) striped cuff and red marker scribbles.
- **Marble-run squares** come in several colours, with porthole and screw dots. The green gear pushed into the hole (photo 1) is the BRACE.
- **Translucent plastic:** the room shows through tinted, overlaps mix colour, and coloured light falls on the rug.
- **The rug:** faded Persian style, cream with worn rust, salmon and pale blue, with the loose pink and yellow tiles at the back.
- **The room as the goals:** watermelon bag, tile box, raspberry armchair, egg pod chair, side table, window with the AC unit, controllers and cables, console. These are the level goals.
- **The grown-up's bare feet** from the background of photo 3 become the foot stomp, and "A GROWN-UP!" is the L13 goal.
- **The boy:** level 10 is "TALLER THAN YOU!" at 112 cm, marked by a striped T-shirt icon on a height mark.
- **The glorious crash** of a big wobbly build is in every crash and every level's SMASH.
- Everything is unbranded: no logos or characters on the bag, box or console.

---

## 13. Explicit non-goals

- No free rotation, no tilted squares, no placement at arbitrary angles. Everything is lattice only.
- No stacking or contact physics. The tower is one rigid rocking body plus a cosmetic flex spring. Debris collides with the rug only, never with other debris or with the tower.
- No bridge detection or PLINK break-offs. Overhang reach is a slot rule (depth ≤ 2).
- No QUICK bonus, no swap-with-next, no colour-mixing rules, no net-folding puzzles, no 3D dome building.
- No split-screen duel and no gamepad in v1. (Stretch goals, only after the solo game is tuned.)
- No drawn face or likeness of the child. He appears as the sleeve, the hand and the height mark.
- No image assets, no audio files, no libraries, no WebGL, no online leaderboard.
- No AC-wind gusts, rolling ball or pushable furniture.

---

## 14. Build plan: ordered milestones with acceptance checks

### Test hooks (ship them; they are tiny)

**URL parameters:**

| Parameter | Effect |
|---|---|
| `seed=N` | deterministic RNG |
| `ts=1..8` | game time scale, for bots; the fixed 120 Hz step stays deterministic |
| `big=1` | BIG MAGNETS |
| `level=N` | start at level N |
| `selftest` | run the self-tests and log the result |
| `debug` | the D overlay: candidates, CoM, pivot, α, depth |
| `mute=1` | start muted |
| `nohint=1` | skip the first-run hint |

**`window.CS`:**

| Hook | Returns or does |
|---|---|
| `state()` | {phase: title / play / smash / crash / over / paused, level, score, clock, combo, mult, streak, tiles, top, goal, theta, alpha, big, handReady} |
| `slots()` | [{key, type, x, y, sx, sy, edges, supported}], with screen positions in CSS px |
| `ghost()` | the current ghost |
| `lastRelease` | {ghostKey, grade, dx} |
| `events` | [{t, type, ...}], types: land, miss, goal, crown, smash, level, crash, save, brace, ring, tipwarn, bump, foot, honk, over |
| `calib()` | the calibrated kicks |
| `setClock(s)` | sets the clock |
| `spawnDebris(...)` | adds a debris piece |
| `perf()` | {jsMs, fps, lightPass} |
| `audio()` | {state, voices, peakVoices} |
| `selftest()` | {pass, failures} |

Bots drive the game through **real pointer events** at `slots()` screen positions.

### M1: lattice and capture, plain coloured boxes

**Builds:** points, unit edges, the edge map, the three generators, the filters (SAT, occlusion, depth, bounds), the supported/hanging flag, `chooseSlot` with hysteresis, and the debug overlay.

**Accept:** `?selftest` logs `SELFTEST PASS`. The assertions:

1. An empty one-car base offers exactly 2 square slots and 2 up-triangle slots.
2. Two adjacent up-triangles yield a down-triangle notch with edges = 2, whose top edge is horizontal at y = h.
3. A square slot on that notch's top is offset 0.5 L in x from the squares below.
4. A 1-wide gap between two 2-high columns on a 4 L base gives a square slot with edges = 3.
5. Hanging squares at depth 1 and 2 are offered off a column side; depth 3 is not.
6. A slot under an overhanging arm is not offered.
7. Across 1,000 seeded random builds of 40 tiles:
   - no candidate overlaps any tile;
   - no two candidates share a key;
   - integer edge matches equal float coincidences (|Δ| < 1e-6) both ways.
8. Sweeping hand x from −4 L to 4 L in 0.005 L steps never flips the ghost A→B→A within 0.1 L.

### M2: drop, magnet yank, CLACK (the feel prototype, with the basic clack sound)

**Builds:** reservation, the fall and yank tween, the lean and shiver, grading, MISS, the fuse, the next tile at 0.18 s, touch, mouse and keys, and the basic clack/zzip/ting.

**Accept:**
- Tapping exactly at a slot's `sx` logs `land` with PERFECT, 0.18 to 0.42 s after release.
- Tapping at `sx` + 0.18·L_px gives GREAT.
- Tapping far from any slot gives `miss`.
- `state().handReady` is true within 0.2 s of a release.
- **Ghost honesty:** over 500 seeded random releases, `lastRelease.ghostKey` equals the landed key 100% of the time, including two tiles in the air.

### M3: tower dynamics, crash and debris

**Builds:** mass, CoM and inertia; the rocking block; flex; kicks; boot calibration; the tip tell; SAVE; BRACE; crash; debris (cap 60, sleeping).

**Accept** (all with `ts=4`, seeds 1 to 10):
- `calib()` reports a bump peak of 0.35 α ± 0.03 on the reference tower.
- **PerfectBot** (from `level=3`; always taps the PERFECT centre of the supported slot that keeps |cₓ| smallest) reaches 10 L with zero crashes in 10/10 seeds.
- **EdgeBot** (always the rightmost slot) crashes within 30 tiles in 10/10 seeds, and every crash is preceded by `tipwarn` at least 0.5 s earlier in game time.
- **SaveBot** (drops on the far side after `tipwarn`) logs at least one `save` across the 10 seeds.
- Debris count is never above 60, and all debris is asleep within 3 s of a crash.

### M4: game flow and scoring

**Builds:** title, level table, ribbon and goal, crown, HOLD and OVERTIME, SMASH, clock, rings, combo and multiplier, results card, pokeable pile, AGAIN, pause, localStorage, BIG MAGNETS.

**Accept:**
- A title tap reaches `play` within 1.2 s.
- **RandomTapper** (uniform x within ±2.5 L, one tap per 0.7 s game time) clears L1 within 20 s game time in at least 9/10 seeds in normal mode, and within 15 s in 10/10 seeds with `big=1`.
- Each level logs goal, then crown, then smash, then level, in that order.
- The clock is frozen during `smash`.
- `setClock(0.5)` reaches `over` within 3 s.
- A tap during the 0.8 s lockout does nothing; AGAIN after it reaches `play` within 1 s, with score 0.
- `clackstack.best` holds the higher score, and a `big=1` run writes only `clackstack.bestBig`.
- P, and a hidden tab, both give `paused` with the clock frozen.

### M5: audio and juice

**Builds:** the full synth list, voice cap, compressor, adaptive music, hit-stop, slow motion, shake, sparks, popups, haptics, reduced motion.

**Accept:**
- After a gesture, `audio().state` is `running`.
- `peakVoices` stays at or below 24 through a crash plus a SMASH.
- M toggles mute and the setting persists across a reload.
- The music layer count follows the multiplier (exposed in `audio()`).
- No console errors with `mute=1`.

### M6: art

**Builds:** the rug texture and perspective warp, the room pre-render and sky, the tile sprite cache with multiply, light on the rug, car, hand and sleeve, cube fold, rings, gear, ribbon and goal icons, HUD, tower gauge, title build and lettering, and the night-mode tile switch.

**Accept:**
- At 390×844, 844×390, 1024×768 and 1366×1024:
  - no console errors;
  - `scrollWidth ≤ innerWidth` and `scrollHeight ≤ innerHeight`;
  - the clock and HOLD boxes lie fully inside the viewport;
  - the mean colour of the rug band is within ±30 per channel of `#EDE3D3`;
  - the title-build region contains both magenta-ish and orange-ish pixels.
- Two overlapping debris tiles (`spawnDebris`) render an overlap pixel darker than either tile alone, which proves multiply mixing.

### M7: hazards and late game

**Builds:** the bump car, the foot, their warnings, the L11+ goals and the sky/night transition.

**Accept:**
- With `level=5`: a `honk` 1.2 ± 0.1 s before each `bump`, and bumps every 12 ± 0.5 s.
- With `level=8`: bump and foot alternate.
- With `big=1`: no hazard events at all.
- With `level=15`: tiles stay visible against the sky (the body pixel differs from the background by at least 40 in luminance).

### M8: polish and performance

**Builds:** an FPS watchdog (if frames average over 22 ms for 2 s, drop the light pass, then the gloss), no allocations in the hot loop, orientation-change handling, and final tuning against the target run lengths.

**Accept:**
- With a 15 L tower and 60 debris, `perf().jsMs` averages 8 ms or less over 5 s in headless Chromium.
- Rotating the viewport mid-run pauses the game, re-lays out the screen and throws no errors.
- PerfectBot reaches L8 in 8/10 seeds.

### M9: docs and commit

- `clack-stack/README.md` in the house style:
  - what it is and the photos behind it;
  - the rules in one paragraph;
  - "Open `index.html` in a browser. It is one file with no dependencies…", with the Fredoka fallback and best scores in local storage;
  - **Controls**;
  - **How it's drawn**: the lattice, multiply translucency, the stained-glass light, the worn rug, the 1/4-resolution room blur, WebAudio clacks and the adaptive groove.
- One bullet in the top-level `README.md` list, matching the others: "**[clack-stack/](clack-stack/)** — Clack Stack, a fast tower race with see-through magnetic tiles on a living-room rug… One HTML file. Open `clack-stack/index.html`."
- Commit and push to `main`.

**Size budget:** about 2,700 to 3,000 lines of JS in one file:

| Module | Lines |
|---|---|
| config and tuning | 120 |
| lattice and capture | 300 |
| build and dynamics | 280 |
| pieces and hand | 200 |
| debris | 140 |
| flow and scoring | 320 |
| input | 150 |
| render | 760 |
| fx | 140 |
| audio | 300 |
| test hooks | 70 |
---

## 15. Revision 2: braces, firm triangles and the crown gamble

Playtesting the first version showed two problems. First, there was no strategy: with good aim, a PERFECT barely moves the tower, so stacking straight up was as safe as balancing and faster. Second, on a two-wide tower a triangle mostly capped a column. This revision gives triangles a job, which is bracing the tower, and makes the crown gamble a visible choice. Where it conflicts with §1–14, this section wins.

### 15.1 Triangles snap firm

- **Firm snap.** A triangle that shares an edge with another triangle is held firm, as two real tiles are. A triangle slot that matches a slant of another triangle counts as **supported** for slot choice. The depth rule is unchanged: a side-hang still adds 1, and the limit stays at 2.
- **New slot generator.** An up-triangle can share an exposed slant of a down-triangle: the up-triangle to its lower left or lower right. It is held firm through that slant.
- Squares still never go on slants, and nothing stands on a point.
- **Ghost hints.** While a triangle is in the hand, every notch slot (two edges) and every firm side slot shows as a faint outline, so the moves are visible. When a drop would complete a brace (15.2), the ghost shows a small "TRUSS" chip.

### 15.2 TRUSS: a filled notch braces the tower

- **A TRUSS** forms when a down-triangle lands in a notch, meeting the slants of two up-triangles on the same base row.
- **The brace line** moves up to the top edge of that TRUSS: `y_b = max(y_b, notch top)`. The tower below the brace line is **locked**.
- **On a TRUSS:**
  - 150 × mult points;
  - the wobble drops, `W ×= 0.3` (15.3);
  - a bright lock chord, and the joints below the line flash and then keep a faint steady glint.
- **The cost** is height (a triangle row is 0.87 L, not 1 L) and width: on a two-wide tower the notch leaves one flat edge, in the middle. The two outer side-hangs (firm now) widen it back to three flat edges, shifted half a tile. So a cheap brace (3 triangles) narrows the tower, and a full one (5) keeps it wide.

### 15.3 Wobble: tall, thin, unbraced towers sway and snap

This replaces "a PERFECT barely moves the tower".

- **Segment.** The **unbraced segment** is everything above the brace line (or above the car, before any TRUSS). `Hu` = build top − `y_b`.
- **Width.** `w` = the narrowest width of the segment. Sample at heights 0.25 L, 0.75 L, … above `y_b`, up to 0.25 L under the top; at each height take the length of the x-span covered by tiles; take the minimum, floored at 1 L.
- **Slenderness:** `λ = Hu / w`.
- **Wobble W** (from 0 up to 1) rises with every landing in the segment:

  `ΔW = a[grade] · max(0, λ − 1)² · (1.5 for a cube)`

  with a = 0.09 (PERFECT), 0.14 (GREAT) and 0.20 (CLACK). W decays as `W ← W·e^(−dt/τ)` with τ = 1.0 s.

  Rule of thumb: on a two-wide tower you can stack quickly to about 5 L. By about 6 L you must slow down or brace, and past about 8 L you must brace. A four-wide base needs no brace until about 12 L.
- **What you see:**
  - the segment sways, with amplitude about 0.25 L × W at its top, driving the existing flex visuals and keeping the lateral speed cap;
  - joint lines in the segment glow amber from W 0.4 and pulsing red from W 0.7, with the creak;
  - the braced part below stays still.
- **SNAP.** When W reaches 1, the magnets let go at the brace line. The unbraced segment cartwheels off as debris and the braced part stays standing ("SNAP!"). If there is no TRUSS yet, that is a full crash. The combo resets.
- **The fuse waits while W > 0.5.** Waiting for the tower to settle costs clock time, not a forced drop. That trade-off is the point.
- **BIG MAGNETS:** ΔW × 0.4.
- **Tuning.** The a values, τ and the thresholds are starting points. Tune them until §15.7 holds.

### 15.4 Tipping and the red ghost

- The rock over the wheels, the tip tell (wheel lift, creak, red edge) and SAVE stay as they are.
- The red TIPPY ghost is shown only in levels 1–3 and in BIG MAGNETS. From level 4 on, judging balance is the player's job.

### 15.5 Bases

| Levels | Base | Width |
|---|---|---|
| 1–3 | two cars | 4 L |
| 4–7 | one long car | 3 L |
| 8 and later | one car | 2 L |

- The long car is drawn like the others: a 3 L plate, with wheels 0.2 L in from each end.
- The goal heights stay as in §6.
- The piece bag becomes 6 squares and 4 triangles, plus the cube from level 2.

### 15.6 CROWN NOW or GO HIGHER

- **Choice.** When the ribbon tears, the crown drops into the hand, as before; a child just places it. At the same moment a big pulsing **GO HIGHER ↑** chip appears on the HOLD box, showing the crown's value.
- **OVERTIME.** Tapping the chip, or HOLD (Shift), banks the crown and starts OVERTIME:
  - tiles above the ribbon score double;
  - the HOLD box shows the live crown multiplier, ×1.5, ×2, … (+0.5 per whole L the build top is above the ribbon);
  - taking the crown back (HOLD again) and placing it pays out.
- **A SNAP or crash in OVERTIME:**
  - if the build top is still at or above the ribbon, the crown is kept and its multiplier falls to match the new top;
  - otherwise the crown is lost and the ribbon is restored.
- **First time.** The first time a player ever gets the crown, a one-line hint appears: "PLACE IT — or GO HIGHER for more!" (saved as seen).
- **BIG MAGNETS:** no chip; the crown is simply in the hand.

### 15.7 Acceptance: the strategy bots

`tools/strategy.cjs` drives the real game through real input, with the real clock and fuse. Every bot aims perfectly. They differ in policy:

| Bot | Policy |
|---|---|
| **StackBot** | always the highest slot, as fast as possible |
| **BalanceBot** | the slot that keeps the centre of mass most central, as fast as possible |
| **PatientBot** | like StackBot, but waits until W < 0.3 before each drop |
| **BraceBot** | a simple brace policy: when λ ≥ 2.5 and a triangle is in the hand (or held), build or complete a notch, using HOLD to keep triangles; waits while W > 0.6; otherwise balance-greedy |

Targets, over 10 seeds:

| Test | Requirement |
|---|---|
| **level=8** (two-wide, goal 11 L), share reaching the goal before the clock runs out | BraceBot ≥ 8/10; StackBot ≤ 3/10; BalanceBot ≤ 3/10; PatientBot ≥ 4/10, taking on average ≥ 35% longer than BraceBot |
| **level=5** (three-wide, goal 8 L) | BraceBot ≥ 9/10; StackBot ≤ 6/10 |
| **level=1** | all four bots reach the goal 10/10 (the opening stays easy) |
| **BIG MAGNETS** | RandomTapper still clears L1 within 15 s, 10/10 |

### 15.8 As built

Tuning against the bots, plus two rounds of review (one by a strategy critic that hunts for dominant lines), changed some of the details above. This is what shipped:

- **Wobble.**
  - Each landing's shake is `a[grade] · max(0, λ − 2.4)²` (a = 0.45 / 0.7 / 1.0), capped. The cap rises with slenderness, from 0.42 at λ 3 to 0.69, and a PERFECT only gets 72% of it, so aim always pays.
  - The wobble settles with a time constant τ = 1.5 s, longer for tall or slender segments, plus a steady drain, so a still tower stops dead.
- **TOO THIN.**
  - A one-wide stretch of 2 L or more in the unbraced segment shakes by a fixed amount on every landing, and settles only by a slow drain that is slower the longer the spire. The ghost shows a "TOO THIN" chip.
  - Without this rule, a centred one-wide spire that paused on red beat both balancing and bracing.
- **Red** means one more CLACK could SNAP the tower. Every SNAP in the bot runs came after at least 0.3 s of glow.
- **The fuse** waits from amber, W 0.4, not 0.5.
- **TRUSS.**
  - It counts in either order: the down-triangle into the notch, or the second up-triangle beside a hung one.
  - It pays 150 × mult × clamp(λ / 3, 0, 1.5), so a brace on a slender segment pays most.
- **The bag** is 7 squares and 3 triangles, plus the cube from level 2.
- **GO HIGHER.**
  - Placing the crown gives back 3 s plus 1 s per whole L above the ribbon, so a good gamble pays in clock as well as points.
  - The chip shows the trade, for example "CROWN ×1.5 · +4 s".
  - In OVERTIME the badge shows SAFE (a padlock) while the brace line is at or over the ribbon, because a SNAP then keeps the crown.
  - For 0.4 s after the crown arrives, a tap can't drop it, so the choice is deliberate.
- **The bots.** `tools/strategy.cjs` runs every test at bot speed and at a human pace (a 0.3 s reaction before every act), and adds:
  - RhythmBot: stacks at a steady 0.6 s;
  - SpireBot: a centred one-wide column that drops whenever the glow isn't red;
  - CarefulBot: patience on a two-wide tower;
  - NoBraceBot;
  - a level 7 test.

  BraceBot keeps the tower level and two wide and completes notches whenever it can. On level 8, at both speeds, BraceBot reaches the goal 10/10. StackBot gets 0/10 and BalanceBot at most 2/10. SpireBot gets 0/10, and CarefulBot gets there but takes about three times as long at bot speed.

---

## 16. Revision 3: rules you can see

Playtest verdict on revision 2: the feel is great, but the player could not tell why the tower fell or where a piece could go. Revision 2 had three ways to fall (tipping, wobble SNAP and dead-end TOPPLE) and several hidden placement rules (hang depth, supported before hanging, overlap and occlusion), all decided by numbers the player never sees. Revision 3 keeps strategy but makes every rule visible. Where it conflicts with §1–15, this section wins.

### 16.1 One way to fall: the plumb weight

- **The weight.** The build's centre of weight, including the sway, is drawn as a small brass plumb weight on a thread. It hangs just above the car plate, at the centre of weight's x position.
- **The wheel span.** It is marked on the car plate. The zone between the wheels is tinted green, and the last 25% at each end goes amber, then red.
- **The rule.** The tower falls when the weight swings past a wheel. That is the only way it falls. The existing rock physics already does this; now it is shown. The far wheel lifting, the creak and SAVE stay.
- **Ghost preview.** While aiming, a faint ghost weight shows where the weight will settle after this drop, on every level and in both modes. This replaces the red TIPPY ghost.
- **Removed:** the wobble SNAP, its amber and red joint glow, TOO THIN and its chip, and the fuse waiting on wobble.
- **TOPPLE** becomes a last resort, for when no square or triangle spot exists anywhere. That should almost never happen now (16.2).

### 16.2 Sway: what tall towers do, and what braces fix

- **What sways.** The part above the brace line (the top of the highest TRUSS, or the car) sways side to side. The sway grows with every drop on that part: more for a sloppy drop, and more the taller and thinner the part is. It settles over a second or two when you wait.
- **Sway moves the weight.** A tall, thin, unbraced tower therefore swings its weight toward the wheels. Stack too fast and the swing carries the weight past a wheel, and the tower falls by the one rule above.
- **TRUSS.** Filling a notch between two up-triangles, in either order, locks everything below it. Nothing below the brace line sways, the swing above is cut (×0.3), and the bonus is paid as in §15.8.
- **Tuning.** The sway constants are retuned so that, on level 8 (two wide), stacking a one-wide spire straight up falls before the goal unless you brace or wait a long time.

### 16.3 Placing: every legal spot is shown

- **All spots visible.** While a piece is in the hand, every place it can go is drawn as a faint dotted outline. The spot that will be used (the one nearest the finger) is the bright ghost. If no outline is under or near your finger, there is nothing there.
- **Squares** go on any free flat top, or beside any free upright side.
- **Triangles** go point-up on any free flat top, or flipped to fit against any free slanted side of another triangle.
- **Spot choice** is simply the outline nearest the finger, with the existing hysteresis. "Supported before hanging" is removed.
- **The hang depth limit is removed.** Balance, through the plumb weight, is what stops long overhangs.
- **Kept, because you can see them:** pieces can't overlap, and a piece can't go under something, because it falls from above.

### 16.4 Say each idea once

The first time each idea comes up, a one-line hint appears (saved as seen) and fades after a few seconds or a drop. Hints never cover the ghost or the weight.

| When | Hint |
|---|---|
| First play | "Keep the weight between the wheels!" |
| First real sway | "Tall towers sway. Fill a triangle notch to brace them." |
| First triangle in the hand next to another up-triangle | "Drop a triangle into the notch to lock the tower." |
| First crown | the existing GO HIGHER hint |

### 16.5 Unchanged

The drop feel, PERFECT and combos, levels, bases, hazards (which now show by pushing the weight), the crown gamble, BIG MAGNETS (gentler sway, weight shown), and the art and audio. Remove stale words and strings for the removed systems ("SNAP!", "TOO THIN", "NO ROOM" outside the last resort).

### 16.6 Acceptance

- **A crash happens only one way.** Every crash in every bot run happens with the weight past a wheel.
- **No hidden placement rules.** For the piece in the hand, the spots offered by `CS.slots()` are exactly the outlines drawn.
- **Strategy, with `tools/strategy.cjs` retuned to these rules** (seeds 1–10, bot speed and a human pace of a 0.3 s reaction):

  | Level | Requirement |
  |---|---|
  | 8 | the brace bot reaches the goal ≥ 8/10; stacking straight up and the one-wide spire ≤ 3/10 each; waiting without bracing gets there but is clearly slower |
  | 1 | all bots 10/10 |
  | BIG MAGNETS | RandomTapper clears level 1 within 15 s, 10/10 |
- **All other tools pass,** each updated only where these rules legitimately change what it measures.

### 16.7 As built

Tuning against the bots (a fast in-page simulation first, then `tools/strategy.cjs` itself) and a look at every new
thing on screen in both orientations changed some of the details above. This is what shipped:

- **The plumb weight.**
  - A brass bob on a thread hangs straight down from a small brass pin at the centre of weight (the flex and the sway in
    it, and turned with the tower when it rocks), its tip just over the car plate.
  - The wheel span is a strip on the plate's face: green over the middle half of the span, amber then red over the last
    quarter at each end, dark red past the wheels, a navy tick over each wheel. Past a wheel, the bob flashes red.
  - The ghost weight is a dotted bob where the weight settles after the aimed drop (the tiles in the air counted), and
    a capsule over the strip marks how far the weight will swing on the way (the look-ahead's lowest and highest weight
    position). Both turn red when the look-ahead says the drop tips the tower: it replaces the red TIPPY ghost on every
    level. Every spot tipping the tower still holds the fuse and pulses the HOLD box ("HOLD IT!"), now on every level
    too, since the warning shows on every level.
- **One way to fall.** A crash happens only when the tower turns over a wheel, with the weight past it (the crash event
  logs where the weight hung). The rock physics had one change: a tall tower's own pull with its weight just past a
  wheel was so weak that a swing past the wheel and back barely lifted it, and the player saw the weight past the wheel
  and nothing happen. So with the weight past the wheel it turns over at TIP_ACC = 10 rad/s² at least (still no faster
  than TIP_W past α): a weight that stays past a wheel for about 0.35 s takes the tower over; one that swings straight
  back lifts the far wheel and slaps down. The SNAP, its sound, the joint glow, TOO THIN and the fuse waiting on the
  wobble are gone. TOPPLE stays, the last resort.
- **The sway.**
  - The part over the brace line rocks on the end of its bottom row it leans toward, as the tower rocks on a wheel: it
    turns by q / Hs, so it is drawn (tiles turned with it), its spots placed and its weight moved exactly as one body.
    With no TRUSS, the part is the whole build and it rocks on the car plate.
  - Its top swings SWAY_ANG · W · Hs (SWAY_ANG = 0.34, Hs the part's height) at 13 / (1 + 0.04 · Hu) rad/s: a 6 L
    part swings back and forth once every 0.6 s, an 11 L one every 0.7 s. (A slower swing let a fast stacker outrun it:
    a two-wide tower stacked straight up at full speed reached the goal in about one swing.) W is §15.8's, with smaller steps (WOB_DW_MAX 0.27,
    WOB_CAP_K 0.09, WOB_CAP_TOP 0.45): a careful player who lets it settle keeps W near 0.5, a hurried one drives it to
    1. The sway is not under the 2.8 L/s top-speed cap (see the next point).
  - A swaying spot is chosen and graded where it is at rest, the middle of its swing (`CS.slots()` gives it as
    `rx`/`rsx`). At these amplitudes the top of a tall part moves a tile or more, and choosing by the live position made
    the ghost jump between neighbouring spots under a still finger. The ghost and the outlines are drawn where the spots
    are now.
  - A TRUSS cuts W and the swing × TRUSS_W on its landing, and the part above it starts at the new brace line.
- **Placing.**
  - No depth limit and no "supported before hanging": the nearest spot to the finger wins (the hysteresis kept), a tie
    the higher. A spot's centre stays within BOUND_X = 3.5 L of the base's centre (the view is at least 7.5 L wide):
    without the depth limit a long hung arm offered spots off the screen.
  - One spot per column: of the spots for one kind of piece at the same x only one can be reached by a piece falling
    straight down, so only that one is offered and drawn: the one standing on a top (a gap fills from the bottom, a tile
    beside a taller column lands on the step under it), else the highest (a tile sliding down a bare side sticks where
    it first meets it). This replaces the old "falls through into the gap" filter.
  - Every spot for the piece in the hand is a dotted outline (round dots, a navy halo under white); a TRUSS spot is the
    pulsing gold fill with its padlock, as before. `CS.spots()` reports what was drawn; `screens.cjs` checks it equals
    `CS.slots()`.
- **Hints.** One navy box with a gold rim, up for at least 1.6 s and gone after 4.5 s or the first drop after that,
  placed on the rug under the car, else beside the tower (on two lines if that fits), else under the HUD, never over
  the ghost, the weight, the hand, the ribbon or the HUD. "Keep the weight between the wheels!" comes after the first
  landing, "Tall towers sway. Fill a triangle notch to brace them." with the first swing of 0.3 L at the top, and "Drop
  a triangle into the notch to lock the tower." with the first triangle in the hand while a TRUSS spot is open. Each is
  saved as seen; `?nohint=1` skips them.
- **The crown.** With the SNAP gone, a crash in OVERTIME simply loses the crown (as any crash does) and the SAFE badge
  is gone.
- **BIG MAGNETS: every spot stands on something** (a top, a gap held on two sides, a triangle's slant); none hangs.
  Without revision 2's "supported first", a small child's taps just beside the tower hung tiles off it instead of
  landing on the column next to them (the RandomTapper's slowest seed went from 9 s to 17 s, over the 15 s it must
  clear level 1 in). The outlines show exactly these spots, so the rule stays one you can see; normal play keeps
  §16.3's spots.
- **The bots.**
  - The goal counts when the crown is placed (the level cleared): a tower that tears the ribbon and falls before its
    crown lands has not got there, since the crash ties the ribbon up again. Every bot places the crown at once.
  - They aim at a swaying spot's rest place.
  - SpireBot now stacks its centred column as fast as it can (it used to wait for the red glow); PatientBot is the spire
    that waits for the sway to settle.
  - Level 5 and level 7 run on request only; the targets are §16.6's.
  - CarefulBot and PatientBot wait for W < 0.2, not 0.3: at W 0.3 the top of a tall two-wide part still swings about a
    tile, so 0.2 is the tower that has settled.
  - BalanceBot and CarefulBot never take a gold TRUSS spot while another is open. Balance-greedy alone often dropped a
    triangle into a central notch: bracing by accident, which let "stacking straight up" through 4 times in 10.
- **Results** (`tools/strategy.cjs`, seeds 1–10, goal = the crown placed; typical = the median time over all ten runs, a
  run that ran out of time counting the whole clock):

  | Level 8 | bot speed | | human pace (0.3 s) | |
  |---|---|---|---|---|
  | BraceBot | 10/10 | 10.2 s | 10/10 | 18.9 s |
  | StackBot (straight up) | 0/10 | | 0/10 | |
  | BalanceBot (two wide, straight up) | 0/10 | | 0/10 | |
  | RhythmBot (straight up, steady 0.6 s) | 0/10 | | | |
  | SpireBot (one-wide spire) | 1/10 | | 0/10 | |
  | PatientBot (the spire, waiting) | 1/10 | | 0/10 | |
  | CarefulBot (waiting, no bracing) | 8/10 | 18.3 s (+79%) | 8/10 | 23.9 s (+26%) |
  | NoBraceBot (BraceBot's build, no bracing) | 6/10 | 23.9 s (+134%) | 5/10 | 30 s (+58%) |
  | BraceRhythmBot | 10/10 | 19.3 s | | |
  | BraceBot λ 1.5 / λ 4 | 10/10, 10/10 | | | |

  Level 1: every bot 10/10 at both paces. BIG MAGNETS: the RandomTapper clears level 1 10/10, slowest 12.1 s. All
  459 crashes happened with the weight past a wheel.
- **Where it falls short of §16.6.** At a human pace, waiting without bracing is slower than bracing, but not by the
  margin it is at bot speed (CarefulBot +26% typical, +16% on the goals' median, against +79% at bot speed). The 0.3 s
  reaction before every act dominates both, the bracer pays one for each extra triangle and HOLD swap, and the 30 s
  clock and the 1.4 s fuse cap how much slower anyone can be. So the tool reports the human-pace comparison and checks
  it at bot speed.
- **Test fixtures.** With no depth limit and spots beside every free side, a run no longer dead-ends by itself, so
  `feel.cjs`'s TOPPLE check builds its dead end (four drops, then no spot in bounds for the closing one) and
  `flow.cjs`'s crown-wait check offers only one triangle spot for a moment. Both lift the fixture afterwards.

---

## 17. Revision 4: one tower, three rules

**Why.** Playtesting revision 3 showed the player still couldn't tell why crashes happened or where tiles could go. The SMASH arm (a reward) looked like a random push. The clock was the only way to lose, so spamming the button beat careful play. The accumulated systems buried the part that works: dropping tiles, the clack, the look. Revision 4 rebuilds the rules small enough to explain in two sentences. It keeps the art, the sound and the feel. The old rules stay playable in `classic/` (commit d1b7018). This section replaces §1–16 wherever they conflict. In particular, the timer, levels, crown, SMASH, HOLD, OVERTIME, rings, hazards, the cube, the marble square and the depth and spot rules are all gone.

> **The whole game:** build one tower as high as you can. Every tile falls straight down from the hand and lands on whatever is under it. If the weight goes past a wheel, the tower falls and the run is over.

### 17.1 Placing: the tile falls straight down

- **The grid.** The hand's position snaps to half-tile steps, and that is the only grid.
- **The drop.** Let go and the tile drops straight down at that x and stops at its first contact with anything below: a top, a point, a slant, the car, or the rug. Tiles never overlap and never stick to the side of something in mid-air.
- **Squares** are always upright.
- **Triangles** fall point-up. The exception is a notch the triangle fits exactly point-down (a V between two slants), where it drops in point-down. That is the only special case.
- **Off the base.** If what's under the hand is the rug, the ghost shows the tile lying on the rug with a cross, and dropping it there just loses the tile.
- **What is shown.** The ghost is the exact landing result, computed with the same function as the real drop. A faint vertical guide column runs from the hand down to the ghost, so you can see what the tile will hit. A tile is always placeable, and the only question is where it lands.
- **Overhangs.** A tile that lands resting partly on something and partly over air hangs there, held by the magnet on the edge it touches. The weight shows what that does.
- **Clacks.** Every edge the landed tile shares with a neighbour clacks: DOUBLE and TRIPLE as before. Landing flush on a flat top with full support is a PERFECT.

### 17.2 Falling: the weight

- **The rule.** The build's centre of weight, sway included, is a large, always-visible plumb weight hanging over the car. The car shows its wheel span, green between the wheels and red at them.
- **Ghost weight.** While aiming, a ghost weight shows where the weight will settle after this drop, and it turns red if the drop would tip the tower.
- **Losing.** If the weight passes a wheel, the tower tips over, which is the existing rock physics with the wheel lift and creak as the warning. The run ends with a glorious crash. There is no other way to lose: no hazards, nothing pushes the car, and the arm only ever holds tiles.

### 17.3 Pace and strategy

- **The fuse.** A ring around the hand empties, and the hand drops the tile where it is when the ring runs out. The ring starts at about 3 s and shrinks with height to about 1.2 s. This keeps the game fast with no clock. Nothing else is timed.
- **Sway.** The part above the highest brace sways more with each landing, more the taller and thinner that part is, and the sway moves the weight. It settles over time, but the fuse limits how long you can wait.
- **Braces.** A triangle dropped point-down into a notch between two point-up triangles is a TRUSS. It locks the tower below it, which stops swaying, and calms the sway above.
- **Where the strategy is.** You choose between height now and balance later: where to put the triangles you're dealt (as caps, braces or counterweights), when to widen, and when to brace.
- **The deal.** About 7 squares to 3 triangles, never the same colour twice in a row, with the next piece shown. There is no HOLD.

### 17.4 Score and the room

- **Score** is the tower's height in cm (one tile is 7.5 cm), as best height. Clack points can stay as a secondary score if they help the feel, but height is what the results card leads with.
- **Height marks.** The room objects are height marks the tower passes on the way up: the watermelon bag, the tile box, the armchair seat, the egg chair, the side table, the window sill, YOU (112 cm), the floor lamp, the bookshelf, A GROWN-UP, the door, the ceiling, then the sky and night. Passing one is a celebration ("TALLER THAN THE ARMCHAIR!"). The camera zooms out and scrolls as it does now.
- **Base.** One base: two coupled cars, 4 L. Narrowing is no longer needed, because height itself brings the sway.

### 17.5 Flow and modes

- **Flow:** title, then the run, then the crash, then the results card (height, best, the marks passed), then AGAIN in one tap. The start shove can stay as the title flourish only.
- **First-time hints**, once each: "Let go: the tile falls straight down." "Keep the weight between the wheels!" "Fill a notch with a triangle to brace."
- **BIG MAGNETS:**
  - no fuse;
  - gentler sway;
  - a crash rolls in a new car and the run goes on (best height counts);
  - the ghost weight shows as usual.

### 17.6 Acceptance

`tools/` is a fresh, small suite. The old suite lives in `classic/tools/`.

- **selftest:** the drop function lands squares and triangles correctly on flat tops, points, slants, notches and over edges. The ghost equals the landing for thousands of random builds and hand positions. Tiles never overlap.
- **feel and flow:** title, run, crash, results and AGAIN through real input on touch, mouse and keys; no console errors; the fuse; hints shown once; BIG MAGNETS keeps going after a crash.
- **strategy (whole runs from the title, seeds 1–10, real input):**

  | Bot | What it does |
  |---|---|
  | SpamBot | clicks at a fixed x as fast as it can |
  | StackBot | always aims for the highest landing |
  | CarefulBot | balance-greedy, braces with triangles when it can, never lets the ghost weight go red |

  Each bot's median best height must rank CarefulBot > StackBot > SpamBot, with CarefulBot at least 1.5× SpamBot. Every crash happens with the weight past a wheel.
- **screens:** a contact sheet at 390x844 and 844x390 of the title, aiming a square, aiming a triangle over a notch, a hang over an edge, the off-base cross, the weight going amber, the crash and the results card.

### 17.7 As built

The game layer was rebuilt from scratch on top of the kept Art and Sfx modules (the rug, the room, the tiles, the cars, the hand and the arm, the title, the height-mark icons, the clack, the crash and the groove), the debris, the juice and the camera. Everything §17 removes is gone from the code, not hidden: the clock, the levels, the crown, SMASH, HOLD, OVERTIME, rings, hazards, the cube as a piece, the marble square and its gear, the slot generators with their depth and spot rules, the wobble glow, TOPPLE and SAVE. The Art and Sfx pieces only those systems used (the folding cube net, the gear, the foot; the tally, fold, clock, honk, foot, SAVE, SMASH, crown, ring, gear and streak sounds) were cut too. The cube survives only in the title shove.

**Placing.**
- The hand's column is k, in half tiles from the base's centre; the tile's left edge is at (k − 1)/2. The hand snaps to the column under the pointer or finger, and ← → step it one column. It keeps its column while the camera zooms, so a still finger never drifts to the next one.
- `dropFor(build, shape, k)` is the one drop function, for the ghost and the release alike, and a release locks its result (the tile is in the build at once, so the next ghost treats a tile in the air as built). Every outline's corners lie on the half-tile columns, so over one column the gap between the falling tile's underside and a tile's top is linear and smallest at a column end. The landing is the largest (top − underside) over the tile's two columns, both ends, and everything under them (the car top spans x −2 to 2). Each of those values is a corner of some outline, a lattice height a + b·√3/2, and the sum and difference of lattice heights is a lattice height, so the landing is computed exactly in integers. **Every contact is on the lattice**: no snapping, no tolerances, and the existing edge matching (DOUBLE, TRIPLE, TRUSS) works unchanged.
- Triangles: the point-down landing at the hand's column is computed first; if both its lower sides lie on exposed slants of point-up triangles (a V that fits exactly), it drops in point-down. Otherwise it falls point-up. A notch with anything over it is never reached.
- Grades, from how the tile rests: flush on flat tops across both its columns (including a square straddling two columns, or a triangle into its notch) is PERFECT; resting on one column with the other over air is a hang ("great"); resting only on a point (a triangle's apex) is a clack. The grade sets the landing kick and the sway step; only PERFECT is said on screen. The clacks are the edges the tile shares exactly.
- What is drawn: the ghost at its exact landing, drawn where that is now (it rocks and sways with the tower; the tile falls at the hand's x and the magnet yank carries it the last bit); a column the tile's width from the tile in the hand down to the ghost; the edges it will clack against shining; a ×2 / ×3 chip; a TRUSS chip with a padlock over a notch; the ghost gold for a PERFECT and red when the drop tips the tower. Over the rug: a reddened column to the rug, the tile lying there, a red cross.
- `?selftest` checks hand-made cases (flat tops, points, slants, notches, a notch under a tile, overhangs, the base's ends, the rug) and about 31,000 drops on 1,500 random builds against an independent float first contact (each outline's top and underside found by intersecting its edges with vertical lines), the lattice, no overlaps (exact convex clipping) and integer edge keys against float coincidence; then about 4,000 releases through the game's own `doRelease` on random builds with up to two tiles in the air, each landing on its ghost.

**The weight.**
- A big brass plumb bob (0.8 L, 30-48 px) hangs on a thread from a brass pin at the centre of weight (the sway in it) over a strip on the car plate: green over the middle 55% of the wheel span, amber to 85%, red to the wheels, dark red past them, a navy post over each wheel. Outside the green the bob gets an amber or red halo; past a wheel it flashes. When the car is below the screen (a tall tower in a short landscape view) the strip and the bobs are pinned to the bottom edge on a little plate.
- The ghost weight: a dotted bob where the weight settles after the aimed drop and a capsule over the strip for its swing on the way, from the game's own rock and sway run forward (the tiles in the air landing first, then this one, 3 s on). It is drawn over the live bob, and red (with the ghost tile) when the look-ahead tips the tower. The same drop can be safe at one moment of a swing and not the next, so the look-ahead lands the tile on time and 0.12 s and 0.24 s late: red means it may tip, never "just now" (without this, CarefulBot sometimes crashed on a drop that had been white 70 ms before).
- One way to lose: the rock physics is kept, made decisive. With the weight past a wheel the tower turns over at 30 rad/s² at least (was 10), with no teeter cap, and it is lost 0.12 rad past its tipping angle (was 0.22); on both wheels it pivots on the wheel the weight is past, whichever way it was rocking. A weight that crosses a wheel for about a tenth of a second takes the tower over. When it goes, a red "PAST THE WHEEL!" tag sits by the bob, and the results card says which wheel.
- The landing kick is an impulse about the wheel it rocks on against I_ref^0.6·I_P^0.4, fitted at boot so a square dropped half off the bare base rocks it to 0.3 of its tipping angle. (The old fit, made on an 8 L tower, let one tile at the end of a two-tile tower flip it.) Off-centre landings rock a low tower visibly, and a tall tower more and more for its size.

**Pace and strategy.**
- The fuse: 3 s on a bare base, 0.12 s less per L of height, 1.2 s from 15 L (112 cm, YOU) up. It starts with the run's first drop, waits while a new base rolls in, and ticks at a half, three quarters and the last 0.3 s. Nothing else is timed.
- The sway: ΔW = 0.12·G[grade]·clamp((λ − 1.5) / 3, 0, 1)·(1 + 4·W) per landing on the part over the brace line, G = 0.7 / 1.0 / 1.4; it settles as W·e^(−t/τ), τ = 0.5 s·max(1, Hu / 8); the part turns by up to 1.0·W rad. The (1 + 4·W) term is what makes pace matter: a tile landing on a part still swaying shakes it more. With the steps alone, a spire stacked as fast as the hand allows (a tile every 0.22 s) outruns its own sway and got as high as one stacked at a steady pace; with it, the fast spire's sway compounds and the steady one settles between drops.
- TRUSS: only the triangle dropped point-down into the notch (the old "second up-triangle beside a hung one" is gone with the side spots). It raises the brace line to its top edge, cuts W and the swing × 0.3, and the joints under the line flash from the base up and keep a faint glint.
- The deal: bags of 7 squares and 3 triangles, never the same colour twice in a row, NEXT shown.
- A tile dropped where nothing is under it is lost on the rug, the fuse restarting with the next tile. A careful player can use that to wait out a sway, which is visible and costs the tile; CarefulBot does it when every drop is red.

**Score and the room.**
- The height is the standing tower's top in cm (7.5 cm a tile, from the car top), shown big in the HUD with the run's best under it; the results card leads with the best. Clack points are gone; the combo is kept only for the clack's rising pitch and the groove's layers, and the groove quickens with each mark.
- The marks (L): the watermelon bag 4, the tile box 5, the armchair 6, the egg chair 7, the side table 8, the window sill 10, YOU 15, the floor lamp 17, the bookshelf 19, A GROWN-UP 22, the door 26, the ceiling 32, then the roof 36, the clouds 42 and the moon 50. The next one is a ribbon across the tower with its picture and "NAME · cm"; out of the view above, a stub under the HUD. The first time a run's tower passes one: the fanfare, confetti and a "TALLER THAN THE ARMCHAIR!" sign placed clear of the hand, the ghost, its column and the weight. Dusk from 26 L, night by about 30 L.
- One base, two coupled cars (4 L, wheels at ±1.8 L).

**Flow.** Title (the shove kept as its flourish), the run, the crash (freeze, slow motion, the burst), the results card 1 s after the burst (the height counted up with clacks, NEW BEST, why it fell, the marks passed as pictures, the next one), AGAIN (taps wait 0.5 s). Pause has RESUME and MENU. The hints are a navy box placed clear of the ghost, its column, the weight, the hand and the HUD: "Let go: the tile falls straight down." with the first tile, "Keep the weight between the wheels!" after the first landing, "Fill a notch with a triangle to brace." with a triangle in the hand and a notch open or the tower swaying; each once, saved. BIG MAGNETS: no fuse, ΔW × 0.4, kicks × 0.5, lost 0.3 rad past the tipping angle; a crash rolls in a new car and the run goes on, its best saved as it grows.

**Tests** (`tools/`, a fresh suite; the old one is in `classic/tools/`): `selftest.cjs` (§17.1's checks), `feel.cjs` (title, run, crash, results and AGAIN by mouse, touch and keys; 200 real drops whose ghost was the landing, 30 of them with two tiles in the air; the fuse; the hints once; pause; BIG MAGNETS going on after a crash), `strategy.cjs` and `screens.cjs` (both orientations on a phone: the title, the first drop with its hint, aiming a square, a triangle over a notch, a hang over an edge, the off-base cross, the weight going amber, a sway, a mark passed, a tall tower with the weight pinned, the crash and the results card). Tuning used a fast in-page simulation of the same bots, then the real tool.

Results (`strategy.cjs`, seeds 1-10, whole runs from the title by real mouse input; best height in cm; * the careful bot stopped because every drop was red with the tower at rest, + still standing after 240 s of play):

| Bot | Median | Runs | Notes |
|---|---|---|---|
| SpamBot (the middle, as fast as it can) | 78.5 | 78 72 86 79 78 72 79 78 79 79 | about 11 tiles, 3-4 s |
| StackBot (the highest landing, 0.3 s reaction) | 118.5 | 129 115 137 107 100 121 116 115 122 122 | about 16 tiles |
| CarefulBot | 301.5 | 396+ 307+ 366+ 273+ 340+ 322+ 284+ 296+ 281+ 205 | 120-234 landed, 0-107 lost on the rug, 0-6 TRUSS |

CarefulBot > StackBot > SpamBot, CarefulBot 3.8× SpamBot. All 21 crashes happened with the weight past a wheel (it is logged with every crash). `selftest.cjs`, `feel.cjs` and `screens.cjs` pass.

**Where it differs from §17.**
- **The sway compounds** (WOB_ON, the × (1 + 4·W) on each step). §17.3 says only that each landing sways the part more; without the compounding, stacking as fast as possible beat a steady pace, the thing §17 set out to stop.
- **Red means "may tip"**: the look-ahead lands the aimed tile at three moments (on time, 0.12 s and 0.24 s late).
- **The rock is more decisive** (30 rad/s² past a wheel, no teeter cap, lost 0.12 rad past the tipping angle, the pivot on the wheel the weight is past) and the landing kick was re-fitted on the bare base, so "past a wheel" means "falls" within about a tenth of a second.
- **A brace is only the point-down triangle in its notch.** The "second point-up triangle beside a hung one" brace of §15.8 went with the side spots it needed.
- **Three grades inside, one on screen.** PERFECT (flush), a hang and a point landing set the kick and the sway; only PERFECT, DOUBLE, TRIPLE and TRUSS! are words.
- **Clack points are gone**; the combo only drives the clack's pitch and the groove's layers.
- **The height is measured from the car top**, so one tile on the car is 7.5 cm.
- **Lost tiles as a wait.** A tile dropped over the rug is lost and the next one comes with a full fuse, so a patient player can wait out a sway by throwing tiles away. It is visible, legal and costs the tiles; CarefulBot does it, which is a large part of why it goes so high.
- **CarefulBot rarely braces.** With wide towers the sway stays small, so it takes a TRUSS when one is open but seldom has one (0-6 a run). Bracing matters for a tower kept two wide; it is not what the ranking rests on.
- **Careful runs are capped** at 240 s of play in the tool, and stop when every drop is red with the tower at rest (both scored at their best height, then ended from the pause menu): a patient, wide, careful tower hardly sways and would otherwise go on for many minutes.
- **Additions for legibility:** a red "PAST THE WHEEL!" tag by the weight as the tower goes over and the same reason on the results card; the weight's strip pinned to the bottom edge when the car is off the screen; the ghost tile red when the drop tips; the clack edges shining; the hand keeps its column while the camera zooms.
- **Marks past the ceiling**: the roof (36 L), the clouds (42) and the moon (50).
- **BIG MAGNETS** has no end but MENU, and keeps its best as it grows.

---

## 18. Revision 5: tiles connect the way real tiles do

**Why.** Revision 4's rule, "a tile lands on whatever is under it", was enforced perfectly and was still wrong. Triangles balanced on other triangles' points, and squares sat half a tile off the grid. The tests checked that the game obeyed the spec, never that the spec made sense. The user chose this direction: squares stay on whole tiles, triangles may sit half a tile over, and every tile connects edge to edge the way the real tiles do. This section replaces §17 wherever they conflict. The weight, the camera, the marks, the art and the sound stay.

> **The whole game:** build one tower as high as you can from one box of tiles. Every tile falls straight down from the hand and has to meet the tower edge to edge, the way real magnet tiles do; if it can't, it falls off. If the weight goes past a wheel, the tower falls and the run ends.

### 18.1 The geometry

- **Lattice.** Positions are lattice points (i, a, b) with x = i/2 and y = a + b·√3/2, the existing lattice. The car top is the flat edge from x = −2 to 2 at y = 0, two coupled cars. The rug is everything else at floor level.
- **Squares** are always upright and on **whole-tile columns only**: the left edge sits at a whole number x (−2, −1, 0, 1, …).
- **Triangles** can be point-up (▲) or point-down (▼), at **half-tile steps**: the left end of the base, or of the top edge for a ▼, sits at a multiple of ½. Being off the whole-tile grid is what triangles are for, as in the photo's wall, where triangle rows shift by half a tile and squares carry on above.

### 18.2 The drop and the fit

The hand holds the tile above the tower. Let go and the tile falls straight down at the hand's position until it first touches something: the car top, a tile, or the rug. Where it stops, it either **fits** or **falls off**.

| Piece | Fits when | Like a real tile |
|---|---|---|
| Square | its whole bottom edge lies on flat tops (the car top, a square's top, a ▼'s top), with no gap and nothing but flat top under it | it sits flat |
| ▲ | its whole base lies on flat tops, as for a square | it sits flat on its base |
| ▼ | at least one of its two lower sides lies exactly against a free slanted side of a triangle; both sides means it sits in a notch | it snaps onto a triangle's side; a real ▼ can't stand on its point |

- **Falls off.** Anything else falls off. That covers touching only at a point (one triangle's point on another's base, a ▼'s point on a flat top), resting half on a top and half on air, or a ▼ that doesn't meet a triangle's side. The tile tumbles to the rug and is lost from the box.
- **The rug.** If nothing is under it at all, it falls to the rug and is lost.
- **No hidden rules.** There are no depth limits, spot rankings or bounds beyond these. Tiles never overlap, and a tile can't get under something, because it falls from above.
- **No mid-air sticking.** Tiles never stick to the side of something while falling. Sides clack when they end up touching.

### 18.3 Choosing the piece's way up

- **Turning triangles.** Triangles arrive point-up. **FLIP** turns the triangle in the hand between ▲ and ▼, and nothing else turns.
- **Controls:**
  - touch: a large FLIP button, bottom right, shown only while a triangle is in the hand;
  - keys: ↑ or W;
  - mouse: right-click or the scroll wheel.
- **Snapping.** The hand moves in whole-tile steps while it holds a square and half-tile steps while it holds a triangle, so the column the tile will fall in is always the one shown.

### 18.4 Making it clear

- **The ghost.** The ghost is the exact result of letting go now, from the same function as the real drop.
  - **When it fits:** the tile is drawn where it will sit. The edges it will meet shine, with a ×2 / ×3 chip for several, and a column the tile's width runs from the hand down to it.
  - **When it doesn't:** the tile is drawn red and dashed where it would first touch. Red dots mark the contact, and a short reason sits beside it: "ONLY A POINT", "HALF ON AIR" or "NO SIDE TO HOLD". If the other way up would fit there, the FLIP button pulses with "FLIP?".
  - **Over the rug:** the tile lies on the rug with a red cross, as before.
- **Every fit.** While aiming, every column where the tile in the hand, the way up it is now, would fit has a faint outline of where it would sit. This is the same function evaluated at every column. It is not a separate rule.
- **First-time hints,** each shown once and saved:

  | When | Hint |
  |---|---|
  | the first tile | "Let go: it falls straight down." |
  | the first triangle | "Triangles sit flat, or snap onto a triangle's side. FLIP turns them." |
  | the first falls-off | "It has to meet the tower edge to edge." |
  | after the first landing | "Keep the weight between the wheels!" |

### 18.5 The box, the weight, the pace

- **The box.** A run has one box of tiles: 60 to start with, about 70% squares and 30% triangles, shuffled, with NEXT shown. The tile-set box from the photo sits on the rug with a counter, for example "■ 31 ▲ 12". When it is empty and the last tile has landed, the run ends with the tower standing, "THE BOX IS EMPTY!". A tile that falls off or lands on the rug is gone from the box: that is the cost of a bad drop, and there is no throwing tiles away to wait.
- **The weight** works as in §17.2: one way to lose, a large plumb weight over the marked wheel span, and a ghost weight that turns red if this drop would tip the tower (including its landing kick). A crash ends the run.
- **The fuse** works as in §17.3. The ring around the hand runs from 3 s down to 1.2 s as the tower grows; when it runs out, the hand lets go where it is.
- **Removed:** sway, wobble, TRUSS and braces (§15 and §17). The tower moves only by its rock on the wheels after a landing kick, and the weight shows where it will settle. Triangle rows are now about geometry (getting back to whole tiles after a shift) and balance, not hidden stiffness.
- **Score** is the best height reached in the run, in cm, as in §17.4, with the room's marks.

### 18.6 BIG MAGNETS (for small children)

- **Magnet pull.** The magnets pull a tile into the nearest place it fits, within one tile of the hand, and the ghost shows that place.
- **Self-turning triangles.** A triangle turns itself to fit, point-up if both ways fit, so the FLIP button is hidden.
- **No pressure.** There is no fuse and the box never empties. A crash rolls in a new car and the run goes on, as in §17.5.

### 18.7 Architecture: the rules as a pure, testable module

- **One module.** All of §18.1–18.2 lives in one section of `index.html` between `/* ==== RULES:BEGIN ==== */` and `/* ==== RULES:END ==== */`. It has no DOM, canvas, timing or randomness, and exposes:
  - `Rules.newBuild()`
  - `Rules.drop(build, piece, way, col)`, which returns `{fits, pose, reason, contact, edges}` or `{rug: true}`
  - `Rules.place(build, result)`
  - `Rules.fitsAll(build, piece, way)`, which gives every column's result
  - `Rules.tiles(build)`
- **Shared by everything.** The game, the ghost, the outlines, BIG MAGNETS' pull and the tests all go through it. Node tools load it by extracting that section and running it in a `vm` context, so most tests run in Node with no browser, thousands of times a second.

### 18.8 Testing (built before the game is called done)

1. **An independent oracle**, `tools/oracle.cjs`, written from this section alone and never from the game's code. It uses a different method: exact arithmetic in ℚ(√3) on numbers (p + q√3)/2, polygon intersection to find the first contact, and its own fit checks. A disagreement between the game and the oracle is a bug in one of them; the spec decides which.
2. **Exhaustive small-scope enumeration**, `tools/enumerate.cjs`. Every sequence of drops up to depth 4 on the real base, at every column and both ways up, deduplicated by state, plus depth 5 or more on a 2-wide strip. At every node:
   - the game agrees with the oracle;
   - no overlaps;
   - every placed tile satisfies its fit rule;
   - every square is on a whole-tile column;
   - nothing rests on a point alone.
3. **Random properties,** `tools/fuzz.cjs`: long random and bot-driven runs (hundreds of tiles) with the same invariants and the oracle agreement.
4. **Plausibility review.** `tools/gallery.cjs` renders many random and bot-built end states with the real renderer into contact sheets. A reviewer with no spec checks them for anything that looks physically wrong or confusing, and the review repeats until a round finds nothing.
5. **Browser tests**, `tools/feel.cjs`, through real input:
   - touch, mouse, keys and FLIP;
   - the ghost and the outlines matching the release and the landing;
   - falls-off reasons, the box counter, the box running empty, the crash, the results and AGAIN;
   - BIG MAGNETS' pull and self-turning;
   - the hints once;
   - layout at 390x844, 844x390 and 1366x1024;
   - no console errors.
6. **Strategy**, `tools/strategy.cjs`: whole runs, seeds 1–10, through real input.

   | Bot | Policy |
   |---|---|
   | SpamBot | fixed x, as fast as possible |
   | RandomBot | random column, random way up |
   | StackBot | the highest fit |
   | CarefulBot | balance-aware, keeps flat whole-tile tops for squares, plans triangle rows, flips sensibly |

   Ranked by median best height: CarefulBot > StackBot > RandomBot and SpamBot, with CarefulBot at least 1.5× each of the others. Every crash happens with the weight past a wheel, and every tile placed in every run passes the plausibility invariants.
7. **Legibility, `tools/learn/`.** A fresh agent with no access to the code or this design learns the game only by playing it through screenshots, using a small driver: start, move the hand, FLIP, let go, screenshot. Then it writes down the rules as it understands them and takes a quiz of held-out positions, shown with the ghost and outlines hidden (`?noghost=1`). For each one it predicts: does it fit or fall off, and if it fits, where it sits; and does the tower tip. The target is at least 85% correct, and every wrong answer is read as a legibility bug in the game, not a failing of the agent.
8. **Screens:** a contact sheet of every state at both phone orientations.

The old suites stay with their versions: `classic/tools/` for revision 3. Revision 4's tools are replaced.
