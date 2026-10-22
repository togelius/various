# Clack Stack

A tower-building game with see-through magnetic tiles. It's based on photos of a
boy building with Magna-Tiles-style tiles on a faded Persian rug: a sloping wall
of blue and yellow squares with two magenta rings stuck on it, a dome of
triangles beside it, a single orange triangle balanced on the very top, a cube
with a red top, and two wheeled car bases on the rug in front.

The whole game: build one tower as high as you can. Every tile falls straight
down from the hand and lands on whatever is under it. If the weight goes past a
wheel, the tower falls and the run is over.

A small hand in a navy-and-yellow striped sleeve holds a tile over your tower.
It moves in half-tile steps. Let go and the tile drops straight down and stops
at the first thing it touches: a flat top, the point of a triangle, a slant, the
car, or nothing but the rug, which loses the tile. The magnet yanks it into place
with a CLACK, plus an extra click for every edge it meets (DOUBLE, TRIPLE), and
landing flush on a flat top is a PERFECT. Squares stay upright and triangles fall
point-up, except into a notch they fit exactly: two triangles side by side leave
a V, and a third one drops into it point-down. Nothing is hidden. The ghost of
the tile is drawn exactly where it will land, a faint column runs from the hand
down to it, and the edges it will clack against shine. Over the rug the ghost
lies there with a red cross.

The tower stands on two coupled toy cars, and one rule decides whether it
stands: **keep the weight between the wheels.** A big brass plumb weight hangs
from the build's centre of weight over a strip on the car: green between the
wheels, amber and then red toward them. While you aim, a dotted ghost weight
shows where the weight will settle after this drop and how far it will swing on
the way, and it turns red (with the ghost tile) if the drop would tip the
tower. When the weight goes past a wheel, the far wheel lifts, the tower creaks,
the screen's edge glows red and it goes over. The tiles crash and slide across
the rug, and the results card shows how tall it got.

Tall, thin towers sway. Every tile that lands on the part above your last brace
makes it sway more: more the taller and thinner that part is, more for a tile
balanced on a point, and more if it lands while the tower is still swaying. The
sway carries the weight with it, so a spire stacked in a hurry swings its
weight past a wheel. Waiting lets it settle, but a fuse ring round the hand
empties and drops the tile where the hand is: 3 seconds at first, down to 1.2
seconds as the tower passes 112 cm. Bracing is what the triangles are for. A
triangle dropped point-down into a notch between two point-up triangles makes a
TRUSS (a gold chip with a padlock says so before you drop). It locks everything
below it, so only what is above it sways, and it calms that part too. The deal
is about seven squares to three triangles, with the next piece shown.

The score is the tower's height in centimetres (a tile is 7.5 cm). The room's
things are the height marks: the next one is a ribbon across the tower, and
passing it is a celebration ("TALLER THAN THE ARMCHAIR!"). After the watermelon
bag, the tile box, the armchair, the egg chair, the side table and the window
sill comes YOU at 112 cm, then the floor lamp, the bookshelf, A GROWN-UP, the
door and the ceiling. Past the ceiling the room opens up to the sky, then to
night. The camera zooms out and then climbs with the tower; once the car is
below the screen, the weight's strip is pinned to the bottom edge.

**BIG MAGNETS** (the button on the title screen, or **B**) is the mode for small
children: no fuse, a gentler sway and smaller knocks, and a crash just rolls in
a new car while the run goes on. It keeps its own best height.

Open `index.html` in a browser. It is one file with no dependencies. It loads
Fredoka from Google Fonts when online and uses a rounded system font if not. It
plays on a phone or tablet held either way, or on a laptop with the mouse or the
keyboard. Best heights and settings are kept in the browser's local storage.

## Controls

- **Touch:** put a finger down anywhere and the hand follows it; lift to let go.
  A quick tap drops the tile straight down where you tapped.
- **Mouse:** the hand follows the pointer; click to drop.
- **Keys:** **← →** or **A D** move the hand one half tile; **Space**, **↓** or
  **Enter** drops.
- **P** or **Esc** pauses, **M** mutes, **Space / Enter** starts and plays again.

The first time each idea comes up, a one-line hint says it once.

## How it's made

Everything is drawn in code on a 2D canvas, with no image assets. The tower
lives on an exact lattice. Every corner is a point (i, a, b) at x = i/2 and
y = a + b·√3/2, so edges match by comparing integers. The drop is one function,
used for the ghost and the real drop alike. Every outline's corners sit on the
half-tile columns, so a falling tile first touches the build at a column edge,
and the height there is itself a lattice point: the landing is worked out
exactly in integers and never leaves the lattice. The tower rocks as one rigid
body about the wheel it leans on, and the part above the last brace sways on
top of it. The crash pieces are loose polygons that bounce on the rug.

The tiles are drawn with the canvas `multiply` mode, so they tint what is behind
them and mix where they overlap, like the real plastic: blue over yellow goes
green. Each tile has the emboss of the real ones: an inset square, the X and
diamond on the orange square, a triangle with a dot. The standing tower casts
coloured light back across the rug. The rug is woven once into a texture (a
cream field with drifting colour, a stepped medallion, borders, pile speckle and
a fringe) and laid into perspective. The room behind it has the egg pod chair,
the raspberry armchair, the window with the air conditioner, the tile box, the
watermelon bag and the controllers. It is painted at low resolution and scaled
up, which gives it a soft out-of-focus look.

The sound is all WebAudio synthesis. A clack is a click, a pitched plastic tock
that climbs a C major pentatonic scale as your run of clean drops grows, and a
small thump scaled by the tile's weight. The music is a toy-box groove in the
same key, so every clack is in tune with it, and it adds a layer as the run of
clacks grows.

## The classic rules

`classic/` keeps the version before these rules were rebuilt: the clock and the
levels, the crown and the cube SMASH, HOLD and OVERTIME, rings and hazards, with
its own design notes and test suite. Open `classic/index.html`.

## Tests

`tools/` holds the Playwright scripts the game is checked with. They drive the
real page through real mouse, touch and keyboard events.

- `selftest.cjs` runs the page's self-test: the drop on hand-made cases (flat
  tops, points, slants, notches, overhangs, the rug) and on thousands of random
  builds against an independent float calculation, the lattice, no overlaps,
  and the ghost equal to the landing through the game's own release.
- `feel.cjs` plays through the title, runs, crashes, the results card and AGAIN
  by mouse, touch and keys; checks that the ghost under the hand is where each
  of a few hundred real drops lands, with two tiles in the air or not; and checks
  the fuse, the hints (each once), pause, and BIG MAGNETS going on after a crash.
- `strategy.cjs` plays whole runs from the title for seeds 1 to 10 with three
  bots. SpamBot clicks in the middle as fast as it can. StackBot always aims for
  the highest landing. CarefulBot keeps the weight in the middle, braces with
  triangles when it can and never drops on a red ghost weight. The median best
  height must rank CarefulBot over StackBot over SpamBot, with CarefulBot at
  least 1.5 times SpamBot, and every crash must happen with the weight past a
  wheel.
- `screens.cjs` takes screenshots of every screen, held both ways on a phone,
  and puts them on a contact sheet.

From the repository root, for example:

```sh
node clack-stack/tools/selftest.cjs
node clack-stack/tools/feel.cjs
node clack-stack/tools/strategy.cjs --seeds=10
node clack-stack/tools/screens.cjs /tmp/clack-screens
```

They need Node and the `playwright` package with a Chromium. `?seed=N`, `?big=1`,
`?mute=1`, `?nohint=1` and `?ts=N` (game speed) work on the page itself.
`DESIGN.md` is the design the game was built from. Section 17 is the fourth
revision, these rules, and it replaces the earlier sections where they differ.
