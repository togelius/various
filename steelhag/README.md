# STÅLHAGEN

*the steel pasture*: a quiet platform game through fields of fallen machines.

Open `steelhag/index.html` in a browser. No build step, no server, no dependencies.
There's also a single-file build at `dist/stalhagen.html` (regenerate it with
`python3 tools/build-single.py`).

## What it is

A kid in an orange parka follows a small four-legged machine through five
chapters of one year on the islands, 1989:

| | | |
| --- | --- | --- |
| I | **Snöfältet**, the snow field | February: silage bales, a buried Volvo, a fallen walker, cooling towers across the bay |
| II | **Björkhagen**, the birch pasture | August: long gold light, moss on steel, a machine asleep in the birches |
| III | **Kärret**, the marsh | October: fog, boardwalks, floating drums, a stranded ship with its lamps still on |
| IV | **Anläggningen**, the facility | November, night: sodium lamps, humming halls, lifts, arcs of blue current |
| V | **Klotet**, the sphere | the first snow, at dawn: the ground comes apart and the snow falls upward |

The machine waits for you and hops ahead when you catch up. Nobody fights
anybody. You can fall into water, off an edge, or into a live arc, and you'll
start again from the last place the machine waited for you.

At three vantage points in each chapter you can **take a photograph** of what's
on screen. The ones you take become your album at the end.

It takes about fifteen minutes.

## Controls

| | |
| --- | --- |
| ← → / A D | walk |
| ↑ / W / Space / Z | jump (hold for higher) |
| E / X / ↓ | take a photograph (at a vantage point) |
| M | sound on / off |
| Esc / P | pause |

Gamepads work too, and on touch screens there are on-screen buttons.

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

- `js/art.js`: the paint box (brush strokes, trees, machines, towers, spheres)
- `js/levels.js`: the five chapters (palettes, ground, platforms, narration, scenery)
- `js/world.js`: ground, collision, and painting a chapter into layers
- `js/actors.js`: the kid and the little machine
- `js/audio.js`: all sound, synthesized with WebAudio
- `js/game.js`: loop, physics, camera, photographs, story, ending

`tools/shot.js` takes screenshots (`node tools/shot.js out 0:3600 title`),
`tools/bot.js` runs a simple bot through each chapter to check it can be
finished, and `tools/hops.js` checks that every jump between moving
platforms has at least one timing that works. All three need Playwright.

## A note

This is a fan letter to Simon Stålenhag's paintings and books
(*Ur varselklotet*, *Flodskörden*, *The Electric State*): the Mälaren
islands in the late eighties, the overcast light, children walking past enormous
abandoned machines as if they were weather. The story, the names and all of the
imagery here are original; nothing is copied from his work.
