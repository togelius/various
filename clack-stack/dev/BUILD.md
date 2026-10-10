# CLACK STACK: build contract

Read this together with `clack-stack/dev/DESIGN.md` (the game design). Where the two
disagree, THIS file wins. The photos the game is made from are at:

- /root/.claude/uploads/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/6d6409e1-image.jpg
- /root/.claude/uploads/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/19a82a45-image.jpg
- /root/.claude/uploads/eea7fc80-8598-5a7a-a3e6-cdbd34e6e76d/23e660f1-image.jpg

The brief from the user was one line: **"Make this game. It should be super fun and
fast paced."** Every decision serves that: the first clack within ~1.5 s of pressing
play, a drop every half second, constant feedback, and crashes that are funny, not
punishing.

## Files and ownership

| Path | What | Owner |
|---|---|---|
| `clack-stack/index.html` | THE game. One file, no dependencies, Canvas 2D, WebAudio. | core builder |
| `clack-stack/tools/*.cjs` | Node + Playwright test runners and bots (kept in the repo, like `absorb-this/tools/`) | core builder / verifiers |
| `clack-stack/dev/art.js`, `dev/art-preview.html`, `dev/art-*.cjs` | the real `Art` module and its preview/screenshot harness | art builder |
| `clack-stack/dev/audio.js`, `dev/audio-preview.html`, `dev/audio-*.cjs` | the real `Sfx` module and its test harness | audio builder |
| `clack-stack/dev/*.md` | design and build docs | lead (read-only for builders) |

`dev/` is scaffolding: at integration the real `Art` and `Sfx` are inlined into
`index.html` and `dev/` is deleted. Never make `index.html` load anything from `dev/`.

Do not touch any other directory of the repo. Do not commit or push; the lead does that.

## index.html layout

One `<script>` (plain script, `'use strict'`, no ES modules). Sections in this order,
each opened with a banner comment:

```
/* ==== CONFIG ==== */          tuning constants (all numbers from DESIGN.md live here)
/* ==== UTIL ==== */            seeded RNG (mulberry32), math, easing
/* ==== ART:BEGIN ==== */       const Art = { ... }   (stub now, real module at integration)
/* ==== ART:END ==== */
/* ==== SFX:BEGIN ==== */       const Sfx = { ... }   (stub now, real module at integration)
/* ==== SFX:END ==== */
/* ==== LATTICE ==== */ /* ==== BUILD & DYNAMICS ==== */ /* ==== DEBRIS ==== */
/* ==== FLOW & SCORING ==== */ /* ==== INPUT ==== */ /* ==== CAMERA & RENDER ==== */
/* ==== FX ==== */ /* ==== TEST HOOKS ==== */ /* ==== MAIN LOOP ==== */
```

The game must call drawing ONLY through `Art.*` (plus its own HUD text, popups,
particles and overlays) and sound ONLY through `Sfx.*`. The core builder writes
**stubs** with exactly the APIs below: the Art stub draws plain translucent polygons
(multiply, so colour mixing already works), simple car/hand/ring shapes and flat
backgrounds; the Sfx stub is a set of no-ops plus a trivial `clack` beep so the feel
prototype has sound. Integration then replaces the whole block between the markers.

## Shared conventions

- All coordinates are **CSS pixels**. Before any `Art` call the game has done
  `ctx.setTransform(dpr,0,0,dpr,0,0)` and possibly a further translate for screen
  shake. Every `Art` function must `save()`/`restore()` and leave the context exactly
  as it found it (transform, alpha, composite op, filters, line dash).
- `L` = tile edge length in CSS px (the camera's zoom, `L_px` in DESIGN.md).
- `rot` in radians, positive = clockwise on screen (canvas convention).
- Colours: `Art.TILE_COLORS = ['red','orange','yellow','green','blue','lightBlue','purple']`;
  a tile colour argument is one of those names. `Art.PAL` holds every hex from
  DESIGN.md §9 under readable names.
- Shapes: `'sq'` square, `'tri'` equilateral triangle **pointing up** (a down triangle is
  `'tri'` with `rot + Math.PI`), `'cube'` (2L×2L), `'marble'` (square with porthole),
  `'crown'` (orange triangle with gold glint).
- `cx, cy` = the **centroid** of the shape (squares/cube: centre; triangles: centroid,
  i.e. 1/3 of the height above the base).
- Determinism: `Art` and `Sfx` must not consume the game's RNG. Use their own internal
  seeded RNG for textures/variation.
- Performance: cache everything static (rug texture, room, tile sprites per
  `(shape,color,variant,round(L),opts-key)`); no per-frame allocation in hot paths;
  target ≤ 8 ms JS per frame for a 15 L tower + 60 debris in headless Chromium.
- Fonts: Fredoka (Google Fonts, `display=swap`) with fallback
  `ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`. Never wait for fonts;
  the game must run with no network.

## The Art API (exact)

```js
const Art = {
  TILE_COLORS, PAL,
  resize(W, H, dpr, groundY),            // rebuild size-dependent caches (room, floor warp). Cheap if unchanged.
  drawRoom(ctx, W, H, groundY, camY, skyT),
      // Sky + blurred living room behind the rug. camY ≥ 0 = how far the camera has
      // scrolled UP (px). Room moves down with 0.4 parallax; sky continues above the
      // room; skyT 0 = day, 0.5 = dusk, 1 = night with stars and moon.
  drawRug(ctx, W, H, groundY, camY),
      // The perspective rug band: back edge above groundY, front edge past the bottom
      // of the screen. Moves down 1:1 with camY. groundY = where car wheels touch.
  drawLight(ctx, tiles, L, groundY, camY, alpha),
      // Stained-glass coloured light of the standing build cast on the rug.
      // tiles = [{shape,color,cx,cy,rot}] in screen px. Projects each tile back-and-right
      // onto the rug (squash y to ~0.22 about groundY, skew right), multiply ~0.3 + 'lighter' ~0.12.
  drawTile(ctx, shape, color, cx, cy, rot, L, o),
      // o (all optional): {alpha=1, flash=0 (white flash 0..1), tint=0 (red blush 0..1),
      //   ghost: null|'white'|'gold'|'red' (dashed outline + 12% fill instead of a body),
      //   night=false (source-over + glow body for dark skies), variant=0 (int, picks
      //   emboss pattern), glint=0 (crown gold sweep 0..1), layer:'both'|'body'|'detail'}
      // Body: translucent, drawn with 'multiply' so overlaps mix like filters.
      // Detail: frame, emboss (inset square / X-and-diamond facets on orange /
      // inner triangle + centre dot on triangles / 2×2 grid on cube faces / porthole
      // with ring of dots on marble), rivets, gloss.
      // 'cube' is the photo-3 cube seen face-on: orange front with 2×2 grid, thin red
      // top and yellow left faces as a slight oblique extrusion. The `color` arg is ignored for cube.
  drawCubeNet(ctx, cx, cy, L, fold, rot),
      // fold 0 = flat cross net (6 squares, red/yellow/orange faces) → 1 = closed cube
      // that matches drawTile('cube') exactly at the same cx,cy,L. Hinge-by-hinge.
  drawCar(ctx, x, y, rot, L, color, o),
      // ONE car base: translucent plate (2L long, 0.18L thick, 2×4 inner grid, slight 3/4
      // so the top shows), tow hooks both ends, black wheels with grey hubs (radius 0.2L,
      // 0.2L in from each end, contact 0.5L below the plate top). (x,y) = centre of the
      // plate TOP surface; rotates about (x,y). color 'red'|'green'. o = {squash 0..1, t}.
  drawHand(ctx, x, y, L, open, t),
      // Small child's hand, navy sleeve with yellow + pale-blue stripes coming down from
      // the top of the screen, red marker scribbles on the back. Fingers grip a tile
      // whose TOP-EDGE midpoint is at (x,y). open 0 = gripping, 1 = sprung open.
  drawArm(ctx, x, y, L, t),
      // The striped arm reaching in from the LEFT screen edge, hand flat at (x,y)
      // pushing (used to shove the cube for the SMASH and the title shove).
  drawRing(ctx, x, y, L, flat, t),
      // Magenta ring, outer diameter ~0.62L. flat 0 = floating pickup (bobbing ellipse,
      // soft glow), 1 = stuck flat on a tile face.
  drawGear(ctx, x, y, L, rot),       // green gear piece (fits the marble porthole), diameter ~0.4L
  drawRibbon(ctx, x0, x1, y, L, tear, t),  // dashed goal ribbon; tear 0..1 splits it from the middle
  drawGoalIcon(ctx, key, x, y, size),
      // keys: 'melon','box','armchair','eggchair','table','armback','window','eggtop',
      // 'ac','you','lamp','shelf','grownup','door','ceiling','roof','clouds','moon'
      // ('you' = small striped T-shirt on a height mark). Fits in a size×size box centred at x,y.
  drawFoot(ctx, x, groundY, L, t, side),
      // Grown-up's bare foot stomping: t 0..1 descent (shadow grows), 1 = planted. side -1|1.
  drawShadowBlob(ctx, x, y, rx, ry, a),
  drawTitle(ctx, cx, cy, w, t, wobble),
      // "CLACK STACK", one chunky letter per translucent tile, two rows or one row
      // depending on w. wobble = array of per-letter 0..1 poke offsets the game animates.
  titleLetterBoxes(cx, cy, w),       // [{x,y,w,h}] hit boxes matching drawTitle
  titleBuild,
      // The photographed build for the title screen, as data:
      // {tiles:[{shape,color,x,y,rot,variant}], rings:[{x,y}], cube:{x,y}} in L units,
      // origin at the base centre on the rug, x right, y UP, centroids. Sloped wall of
      // blue/lightBlue/yellow squares (~-18°), two rings on it, orange triangle on the
      // peak, triangle dome (orange/purple/blue/green/red) beside it, marble squares at
      // the front, the cube at the left. ~30 tiles.
  drawTileBox(ctx, x, y, w, lines),  // the tile set's box lying on the rug, lid printed with text lines (best scores)
};
```

## The Sfx API (exact)

All calls are safe before `unlock()` (they no-op) and while muted.
`pan` is −1..1.

```js
const Sfx = {
  unlock(),                 // create/resume AudioContext on first pointerdown/keydown (iOS-safe)
  setMuted(b), muted,       // bool; game persists it
  clack(o),                 // o={combo, mass, pan, edges(1..3), grade:'perfect'|'great'|'clack'}
                            // click + pentatonic tock (index = combo mod 10) + body; extra
                            // clicks per edge 28 ms apart each a fifth higher; ting if perfect
  zzip(pan), miss(pan), aww(), poke(pan),
  creak(level),             // CONTINUOUS: call every frame with 0..1; volume ((level-0.4)/0.6)^2, heartbeat > 0.9
  save(), crash(n, x),      // crash: n tiles, x = -1..1 centre for panning; freeze-friendly (starts immediately)
  whistle(), smash(), tally(i), ribbon(), crown(), ring(), gear(),
  cubeFold(i),              // i = 0..4 hinge clacks, rising
  boom(), honk(), bonk(), whooo(dur), thump(),
  fuseTick(kind),           // 'half'|'threeq'|'last'
  clockTick(n),             // n = seconds left (5..1), louder for 3,2,1
  newBest(), uiClick(),
  haptic(pattern),          // navigator.vibrate wrapper, try/catch
  music: { start(), stop(), setLevel(level), setMult(mult), duck(sec) },
  stats(),                  // {state, voices, peakVoices, layers, muted}
};
```

Voice cap 24, compressor on master, music ducks under crash/smash, everything in
C major pentatonic so clacks are always in key with the groove.

## Test hooks (core builder; exact)

URL params: `seed=N`, `ts=1..8` (game time scale; fixed 120 Hz step stays
deterministic), `big=1`, `level=N`, `selftest`, `debug`, `mute=1`, `nohint=1`,
`autostart=1` (skip the title: straight into play, for bots).

`window.CS` = `{ state(), slots(), ghost(), lastRelease, events, calib(), setClock(s),
spawnDebris(o), perf(), audio(), selftest(), cam() }` as in DESIGN.md §14, plus
`cam()` → `{L, camY, groundY, handY, W, H}`. `slots()` returns slots **for the tile
currently in hand**, with `sx, sy` = live screen position (CSS px) of the slot centroid.

## Testing

- Playwright for Node is installed: use
  `let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }`
  and `pw.chromium.launch()` (it finds `/opt/pw-browsers` by itself; do not run
  `playwright install`). Load the game by `file://` URL.
- Abort requests to `fonts.googleapis.com` / `fonts.gstatic.com` in tests
  (`page.route`) so nothing hangs on the network.
- Fail on any `pageerror` or `console.error`.
- Bots must drive the game through REAL input events (`page.mouse`, `page.touchscreen`,
  `page.keyboard`), at positions read from `CS.slots()` / `CS.cam()` — never by calling
  internal game functions to place tiles.
- Look at screenshots yourself (Read the PNG) — passing numbers are not enough; it has to
  look and feel right.
- The machine has 4 CPUs and other agents may be running Chromium too: keep test runs
  short, one browser at a time, and close browsers in `finally`.
