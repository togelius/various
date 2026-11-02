# Drip Trip

*A small drop. A big way home.*

A short, one-button game about getting a drop of water across a room to a
thirsty plant. Eighteen hops, three little stretches, and just one resource:
**dampness**. Hold to line up the dotted arc, then release to jump onto the
next magnetic-tile tower. The arc tells you **MISS**, **SAFE**, or **PERFECT**
for the normal hop. Press again in the air to dash forward, once per hop,
for 5 dampness.

Open `index.html` in a modern browser. Everything is in that one file: the
game, the drawn artwork, and the synthesised sounds. No build, server,
downloads, or runtime dependencies. It works with a keyboard, mouse, or touch
screen.

## Controls

| Action | Control |
|---|---|
| Aim a hop | Hold **Space**, the left mouse button, or a finger on the game |
| Jump | Release |
| Air dash | Press the same button again while airborne |
| Pause / resume | **P**, **Esc**, or the pause button |
| Sound on / off | **M** or the music-note button |
| Pick a checkpoint gift | Click or tap its button; keyboard focus works too |

Power stops growing when the charge bar is full. The same button handles both
actions: hold and release on a tower, then a fresh press in the air if you
want to dash. There is no extra movement key or inventory.

## The trip

- Diamonds restore dampness. A safe landing gives 5%; consecutive perfect
  landings give 5%, 8%, 11%, then 13% each. A safe landing or a fall breaks
  the perfect streak.
- A forward air dash can rescue a short jump, but costs 5 dampness and can
  send an already-safe jump too far. Decide whether to spend the water or
  keep it for later. Each landing refreshes the dash. You need more than
  5 dampness, and must dash before descending below the next tower's top.
  Tower heights stay fixed; perfect landings reward your streak and dampness.
- Miss a tower and the rug catches you, costing 24% dampness. You restart on
  the same tower, without collecting its reward again. Dry out completely
  and you can start a fresh trip.
- At hops **6** and **12**, the game rests and restores dampness to at least
  65%. Pick wider towers or a coat that slows drying by 30%. Gifts last for
  the rest of the run; picking the same kind twice improves it again.
- Land hop **18** to reach the plant. Each new trip has a fresh route. Your
  best number of perfect hops is kept in this browser's local storage.

Dampness waits during the title, checkpoint choices, pauses, and ending
screens. Leaving the tab pauses an active run.

## Five familiar games

| Source | What Drip Trip takes from it |
|---|---|
| [Bollard Hop](../bollard-hop/) | Hold-and-release hopping, a predictive landing arc, and a smaller perfect zone inside the safe landing area. |
| [Weft](../weft/) | A woven rug, a stitched trail, diamonds, and increasing rewards for an unbroken streak. |
| [Absorb This](../absorb-this/) | DRIP, the little water-drop protagonist, and dampness as the resource that keeps you going. |
| [GASP!](../gasp/) | A generated route split into short sections, with a useful upgrade choice between them. |
| [Vanguard Zero](../vanguard-zero/) | A forward air dash that can be used once per hop and refreshes on landing. Drip Trip charges dampness for it, making midair correction a resource choice. |

These ideas share one button and one meter. The goal is a small, finished
trip rather than five separate games to learn.

## Optional checks

From this directory:

```sh
node test.cjs
```

The browser checks require Node.js, Playwright, and Chromium. They are
development tools; none is needed to open and play the game. The opt-in
`?test` URL exposes the real simulation to the test harness.
