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

The tower stands on wheels. Drop off-centre and it rocks; hang too much off
one side and the far wheel lifts, it creaks and the edge of the screen glows
red. Drop a tile on the other side quickly and it slaps back down for a SAVE.
Otherwise it goes over, and the tiles crash and slide across the rug. A crash
costs time, never the run. The run ends when the clock does.

Tall, thin towers wobble. Every drop shakes the part above your last brace,
more for a sloppy drop and much more for a tall, skinny tower. The joints glow
amber, then pulse red when one more drop could make the magnets let go. If
that happens, the tower SNAPs: everything above the brace cartwheels off and
the braced part stays standing. A wobbling tower settles if you wait (the
fuse waits with you), but the clock doesn't. A spire one tile wide is TOO THIN
and hardly settles at all. Bracing is what the triangles are for. Two
triangles pointing up leave a notch, and a third one dropped in point-down
makes a TRUSS that locks everything below it. Triangles snap firmly to each
other, so you can also hang one off a triangle's side to widen the tower
again. The ghost marks the triangle spots, and a gold TRUSS chip shows when a
drop will brace. The base gets narrower as you go: two cars on levels 1–3,
a long car on levels 4–7, then a single car. From level 4 there is no red
warning on the ghost, so judging the balance is up to you.

Landing dead centre is a PERFECT. PERFECTs and multi-edge clacks build a combo
and a multiplier up to ×5, and the music adds a layer for each step. A streak of
PERFECTs heats up, and you get ON FIRE!, UNSTOPPABLE!, MAGNET MASTER! and
LEGENDARY! along the way. Magenta rings float near the tower; hang a tile out to
reach one for two extra seconds. A marble-run square steadies the tower when the
hand pokes the gear in. The cube arrives as a flat net and folds itself up in
mid-air. You can put a piece on HOLD.

When the crown arrives you can place it at once, or tap GO HIGHER and keep
building. In OVERTIME, everything above the ribbon scores double, and the
crown's multiplier and the time it gives back grow with every row you add.
A SNAP that leaves you below the ribbon loses the crown. A brace above the
ribbon makes it SAFE. From level 5 a toy car comes zooming in to bump
the base, and from level 8 a grown-up's bare foot stomps down beside it. Past
the ceiling the room opens up to the sky, then to night.

**BIG MAGNETS** (the button on the title screen, or **B**) is the mode for small
children. It has a bigger magnet reach, no fuse and no hazards. Crashes are
harder to cause and the wobble is much gentler. The red warning stays on the
ghost, and the crown just goes on top. The clock is slower, and it keeps its
own best score. A child
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
a PERFECT, white for a clack, and a cross if there is nothing to land on. On
levels 1–3 and in BIG MAGNETS it also turns red if the tile would tip the
tower. A gold TRUSS chip means the drop will brace, and TOO THIN means you are
building a spire.

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
play recklessly and try for SAVEs, the whole game flow, the hazards, the
wobble, the art and audio modules, performance, and screenshot sheets of every
screen.

`strategy.cjs` checks that the choices matter. Bots with perfect aim and
different policies race to the goal on levels 1, 5, 7 and 8, at bot speed and
at a human pace. One stacks as high as it can, one keeps the centre of mass
central, one waits for the wobble to settle, one builds a one-wide spire, and
one braces with triangles. Only the one that braces reliably gets there quickly.
From the repository root, for example:

```sh
node clack-stack/tools/selftest.cjs
node clack-stack/tools/feel.cjs --quick
node clack-stack/tools/bots.cjs --only=perfect,edge
node clack-stack/tools/strategy.cjs --only=level8 --seeds=1-3
node clack-stack/tools/screens.cjs /tmp/clack-screens
```

They need Node and the `playwright` package with a Chromium. `?seed=N`, `?level=N`,
`?big=1`, `?mute=1` and `?debug` work on the page itself. `DESIGN.md` is the
design the game was built from. Section 15 covers the second revision (braces,
wobble and the crown gamble), which came out of playtesting.
