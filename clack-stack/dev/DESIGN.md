# CLACK STACK: final design

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