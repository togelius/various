# Clack Stack

A fast tower-building race with see-through magnetic tiles. It's based on photos
of a boy building with Magna-Tiles-style tiles on a faded Persian rug: a sloping
wall of blue and yellow squares with two magenta rings stuck on it, a dome of
triangles beside it, a single orange triangle balanced on the very top, purple
marble-run squares with a green gear pushed into one hole, a cube with a red top,
and two wheeled car bases on the rug in front.

A small hand in a navy-and-yellow striped sleeve holds a tile over your tower.
Move it and let go. The tile drops, and in the last moment the magnet yanks it
into place with a CLACK, plus an extra click for every edge it meets. Squares and
triangles share one edge length, so they fit together the way the real ones do:
two triangles pointing up leave a notch that a third one fills point-down, and a
gap between two columns takes a square on three edges at once. Stack on the car
bases until the tower is taller than something in the room ("TALLER THAN THE
WATERMELON BAG!", then the tile box, the armchair, the egg chair, the window
sill… "TALLER THAN YOU!"). The orange triangle then drops into the hand. Put it
on the peak, and the boy's cube comes in from the side and SMASHes the tower
for a bonus. The next level is taller and on a narrower base, and the clock
keeps running.

The tower is one wobbly thing on wheels. Drop off-centre and it rocks; hang
too much off one side and the far wheel lifts, it creaks and the edge of the
screen glows red. Drop a tile on the other side quickly and it slaps back
down for a SAVE. Otherwise it goes over, and the tiles crash and slide across
the rug. A crash costs time, never the run. The run ends when the clock does.

Landing dead centre is a PERFECT. PERFECTs and multi-edge clacks build a combo
and a multiplier up to ×5, and the music adds a layer for each step. A streak of
PERFECTs heats up, and you get ON FIRE!, UNSTOPPABLE!, MAGNET MASTER! and
LEGENDARY! along the way. Magenta rings float near the tower; hang a tile out to
reach one for two extra seconds. A marble-run square braces the tower when the
hand pokes the gear in. The cube arrives as a flat net and folds itself up in
mid-air. You can put a piece on HOLD. If you hold the crown, you get OVERTIME:
everything above the ribbon scores double and the crown bonus grows, until you
crown it or it all comes down. From level 5 a toy car comes zooming in to bump
the base, and from level 8 a grown-up's bare foot stomps down beside it. Past
the ceiling the room opens up to the sky, then to night.

**BIG MAGNETS** (the button on the title screen, or **B**) is the mode for small
children. It has a bigger magnet reach, no fuse and no hazards, crashes are
harder to cause, the clock is slower, and it keeps its own best score. A child
who misses a lot in normal mode is offered it during the run and on the results card.

Open `index.html` in a browser. It is one file with no dependencies. It loads
Fredoka from Google Fonts when online and uses a rounded system font if not. It
plays on a phone or tablet held either way, or on a laptop with the mouse or the
keyboard. Best scores and settings are kept in the browser's local storage.

## Controls

- **Touch:** put a finger down anywhere and the hand follows it; lift to let go.
  A quick tap drops the tile right above where you tapped. Tap the **HOLD** box
  to swap the piece in your hand.
- **Mouse:** the hand follows the pointer; click to drop, right-click to hold.
- **Keys:** **← →** or **A D** move the hand (it pauses for a moment on a PERFECT
  spot); **Space**, **↓** or **Enter** drops; **Shift**, **↑** or **C** holds.
- **P** or **Esc** pauses, **M** mutes, **Space / Enter** starts and plays again.

The dashed ghost below the hand shows exactly where the tile will land: gold for
a PERFECT, white for a clack, red if the tile would tip the tower, and a cross
if there is nothing to land on.

## How it's made

Everything is drawn in code on a 2D canvas, with no image assets. The tower
lives on an exact lattice. Every corner is a point (i, a, b) at x = i/2 and
y = a + b·√3/2, so edges match by comparing integers, and the ghost and the drop
use the same function, so the ghost never lies. The tower rocks as one rigid body
about the wheel it leans on, with a springy sway on top. The crash pieces are
loose polygons that bounce on the rug.

The tiles are drawn with the canvas `multiply` mode, so they tint what is behind
them and mix where they overlap, like the real plastic: blue over yellow goes
green. Each tile has the emboss of the real ones: an inset square, the X and
diamond on the orange square, a triangle with a dot, a 2×2 grid on the cube, and
a porthole with screw holes on the marble squares. The standing tower casts
coloured light back across the rug. The rug is woven once into a texture (a
cream field with drifting colour, a stepped medallion, borders, pile speckle and
a fringe) and laid into perspective. The room behind it has the egg pod chair,
the raspberry armchair, the window with the air conditioner, the tile box, the
watermelon bag and the controllers. It is painted at low resolution and scaled
up, which gives it a soft out-of-focus look.

The sound is all WebAudio synthesis. A clack is a click, a pitched plastic tock
that climbs a C major pentatonic scale as your combo grows, and a small thump
scaled by the tile's weight. The music is a toy-box groove in the same key, so
every clack is in tune with it, and it gets faster with each level.

## Tests

`tools/` holds the Playwright scripts the game was built and checked with. They
drive the real page through real mouse, touch and keyboard events: the lattice
self-test, the feel of a drop and the ghost's honesty, bots that play perfectly,
play recklessly and try for SAVEs, the whole game flow, the hazards, the art and
audio modules, performance, and screenshot sheets of every screen. From the
repository root, for example:

```sh
node clack-stack/tools/selftest.cjs
node clack-stack/tools/feel.cjs --quick
node clack-stack/tools/bots.cjs --only=perfect,edge
node clack-stack/tools/screens.cjs /tmp/clack-screens
```

They need Node and the `playwright` package with a Chromium. `?seed=N`, `?level=N`,
`?big=1`, `?mute=1` and `?debug` work on the page itself. `DESIGN.md` is the
design the game was built from.
