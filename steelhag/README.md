# STÅLHAGEN

*the steel pasture*: a quiet platform game through fields of fallen machines.

Open `steelhag/index.html` in a browser. No build step, no server, no dependencies.
There's also a single-file build at `dist/stalhagen.html` (regenerate it with
`python3 tools/build-single.py`).

## What it is

A kid in an orange parka follows a small four-legged machine through five
chapters of one year on the islands, 1989, and comes back once more, years later:

| | | |
| --- | --- | --- |
| I | **Snöfältet**, the snow field | February: silage bales, a buried Volvo, a fallen walker, cooling towers across the bay |
| II | **Björkhagen**, the birch pasture | August: long gold light, moss on steel, a machine asleep in the birches |
| III | **Kärret**, the marsh | October: fog, boardwalks, floating drums, a stranded ship with its lamps still on |
| IV | **Anläggningen**, the facility | November, night: sodium lamps, humming halls, lifts, arcs of blue current |
| V | **Klotet**, the sphere | the first snow, at dawn: the ground comes apart and the snow falls upward |
| VI | **Tövädret**, the thaw | April, years later: the same field, the machines cleared away, the towers silent |

The machine waits for you and hops ahead when you catch up. It watches you,
and whatever else moves; it startles if you jump at it, and if you stand still
long enough it comes back to see why. Nobody fights anybody. You can fall into
water, off an edge, into a live arc, or be caught in the facility's
searchlight (stay in the crates' shadows), and you'll start again from the last
place the machine waited for you.

At vantage points in each chapter, some of them off the path, you can **take
a photograph** of what's on screen. Photographs are kept between visits: the
title screen has the album, and once you have reached a chapter you can go back
to it to find the views you missed. Retaking a view replaces the old picture.

It takes about twenty minutes.

There are also small, optional things to do along the way: tune a forgotten
radio, whistle to nesting birds (or stand quietly and let them approach), skip
stones in the marsh, ring a ship's bell, and try an old lighting circuit.
Near the last hill, even loose pebbles behave strangely. Some replies take a few
seconds. These encounters have no score, checklist, or effect on your progress;
you can stop, experiment, come back, or simply keep walking.

## Controls

| | |
| --- | --- |
| ← → / A D | walk |
| ↑ / Space (also W, Z) | jump (hold for higher) |
| ↓ / E (also X, C) | photograph at a vantage point, otherwise interact nearby |
| M | sound on / off |
| Esc / P | pause: continue, settings, or leave to the title |

A, D, Space and E can be rebound under **settings → controls**; the arrow keys
always work. Settings also has **larger text** and **reduced motion** (less
snow, no film grain or swaying grass, softer flashes). Both are on by default
on phones, and all settings are remembered.

Gamepads work too (face buttons other than jump photograph/interact), and on
touch screens the round button does both. Nearby prompts describe the action;
photographs take priority if two opportunities overlap.

## How it's made

Every image is painted in code at load time: skies from thousands of
soft brush dabs, spruce forests tier by tier, birches leaf by leaf, lattice
pylons and their sagging wires, hyperboloid cooling towers with steam,
rust running down from panel seams. Each chapter is painted into five
parallax layers. The distant ones are pulled toward the haze colour and
softened, with drifting fog between them. At run time the game adds weather,
lamp and sun glows, film grain and a vignette. The music is synthesized too:
a slow detuned analogue pad, sparse bells in a long reverb, wind, a low hum
near the machines.

Far scenery and the closest plants have a slight softness, with sparse, faint
out-of-focus highlights near the bottom of the summer and night scenes. The
characters and walking surfaces stay in focus. Passing birds, falling birch
leaves, water rings, and faint drifting vapour add motion between encounters.

- `js/art.js`: the paint box (brush strokes, trees, machines, towers, spheres)
- `js/levels.js`: the five chapters (palettes, ground, platforms, narration, scenery)
- `js/world.js`: ground, collision, and painting a chapter into layers
- `js/actors.js`: the kid and the little machine
- `js/audio.js`: all sound, synthesized with WebAudio
- `js/life.js`: optional encounters, seasonal motion, and close soft highlights
- `js/store.js`: settings, progress and the photo album, kept in browser storage
- `js/painter.js`: paints chapters in a Web Worker in the single-file builds
- `js/game.js`: loop, physics, camera, menus, photographs, story, ending

Painting a chapter's layers takes a second or two. In the single-file builds a
worker paints the next chapter while you play the current one, so arriving is
nearly instant; opened from `index.html` the painting happens between chapters.
Phones and low-memory devices paint at lower resolution to keep a chapter's
canvases well under 100 MB.

`tools/shot.js` takes screenshots (`node tools/shot.js out 0:3600 title`),
`tools/bot.js` runs a simple bot through each chapter to check it can be
finished, and `tools/hops.js` checks that every jump between moving
platforms has at least one timing that works. All three need Playwright.

`node tools/check-life.js` checks encounter reachability, delayed replies,
input priority, cooldowns, pause, and chapter resets without browser dependencies;
its canvas stub rejects drawing calls with missing arguments, as browsers do.
`node tools/smoke.js` loads both builds on a desktop and an emulated phone,
visits every chapter, and fails if the game loop stops or anything logs an error.

## A note

This is a fan letter to Simon Stålenhag's paintings and books
(*Ur varselklotet*, *Flodskörden*, *The Electric State*): the Mälaren
islands in the late eighties, the overcast light, children walking past enormous
abandoned machines as if they were weather. The story, the names and all of the
imagery here are original; nothing is copied from his work.
