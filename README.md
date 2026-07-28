# VANGUARD ZERO

A 16-bit action platformer that runs in the browser. Three stages, three
multi-phase bosses, and a movement kit built around dashing and wall-jumping.

**Play it:** open `index.html`. That's the whole install — no build step, no
bundler, no assets to download. Every sprite, tile, background, sound effect
and piece of music in the game is generated in JavaScript at load time.

```
git clone <this repo> && cd various
# then just open index.html in a browser
# (or: python3 -m http.server 8000  ->  http://localhost:8000)
```

Prefer one file you can email or drop on any host? `dist/vanguard-zero.html`
is the entire game — code, art, music — inlined into a single ~285 KB page
with no external requests at all. Rebuild it with
`node tools/build-single.js`.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | Arrows / WASD | D-pad or left stick |
| Jump | `Z` / `Space` | A |
| Fire (hold to charge) | `X` | B |
| Dash | `C` / `Shift` | X / RB |
| Swap weapon | `V` | Y |
| Pause | `Esc` | Start |
| Fullscreen / mute | `F` / `M` | — |

Wall jump by holding *into* a wall while airborne and pressing jump. Hold jump
longer for a higher leap; tap it for a hop. Down + jump drops through
one-way platforms.

Touch controls appear automatically on phones and tablets.

## The moveset

The whole game is designed around these interacting:

- **Variable jump** with coyote time (7 frames) and input buffering (9 frames),
  plus reduced gravity near the apex so the top of the arc is controllable.
- **Dash** on the ground or in the air. The air dash refreshes on landing *or*
  on touching a wall, so a wall-dash chain crosses gaps a plain jump can't.
- **Wall slide and wall jump**, with a 7-frame coyote window after leaving the
  wall and a short un-cuttable window on the kick so releasing jump early
  can't strand you mid-shaft.
- **Buster** with two charge tiers. A full charge deals 4x a normal shot,
  pierces two targets, and breaks a shielder's guard.
- **Two sub-weapons** earned from bosses — a three-way **Spread** and a
  piercing **Lance** — sharing a weapon-energy meter.

Damage is tuned so any grunt dies to a single full charge, while a boss takes
ten to fourteen — or roughly half that if you land them in the punish window.

**Kill chains.** Kills inside a rolling window build a multiplier up to x5.
Clearing a room aggressively is worth far more than picking it apart, and your
best chain is reported on the results screen.

## Stages

| # | Stage | Gimmick | Boss |
| --- | --- | --- | --- |
| 1 | Skyfall Ridge | Crumbling ledges, wall-jump chimney | **Aegis Drone** — gunship with a sweeping beam |
| 2 | Magma Foundry | Conveyors, flame vents, lava | **Forge Golem** — charges, stuns, ground-pounds |
| 3 | Void Citadel | Spike runs, turret crossfire | **Vanguard Prime** — a rival with your own kit |

Every boss telegraphs, commits, then recovers. The Aegis Drone's beam sweep is
followed by a low-altitude cooling cycle where it takes double damage; the
Forge Golem's charge ends in a wall impact that stuns it. Learning where the
punish window is *is* the fight.

Stages are ranked S through D on clear time, damage taken and enemies
destroyed. Best times, high score and unlocked stages persist in
`localStorage`.

## How it's built

Plain ES5-era JavaScript in classic `<script>` tags — no modules, so it runs
straight off the filesystem with no server.

| File | Responsibility |
| --- | --- |
| `js/core.js` | RNG, math, input (keyboard/gamepad/touch), fixed-timestep loop, pixel canvas |
| `js/audio.js` | WebAudio synth, tracker, SFX, and the echo unit |
| `js/music.js` | Song data (nine tracks) |
| `js/art.js` | Sprite decoder, bitmap font, procedural tilesets and parallax backgrounds |
| `js/sprites.js` | Hand-authored pixel art |
| `js/fx.js` | Particles, screen shake, hitstop, popups |
| `js/level.js` | Tilemap, collision, camera, terrain renderer |
| `js/entities.js` | Entity base, player, projectiles, pickups |
| `js/enemies.js` | Enemy roster |
| `js/bosses.js` | Boss fights |
| `js/levels.js` | Stage layouts |
| `js/game.js` | State machine, HUD, menus, transitions |
| `js/touch.js` | On-screen controls for touch devices |

`dist/` holds generated single-file builds — don't edit them by hand; they are
produced from `js/` and `tools/shell-*.html` by `tools/build-single.js`.

A few things worth calling out:

**Rendering.** Everything draws to a 384x216 backing canvas that's blitted up
with nearest-neighbour, so the pixel grid is exact. Static terrain is baked
once into a full-level canvas at load, making a screen redraw one `drawImage`
instead of ~400 tile draws; only tiles that animate (crumbling blocks,
conveyors, liquid surfaces, boss doors) are drawn live.

**Terrain art.** Each theme synthesises a seamless 64x64 material texture,
sampled by world position so rock never visibly tiles, plus 16 bitmask edge
overlays drawn only on exposed faces. Tiles get progressively darker with
depth below the surface, which is what makes the walkable surface pop.

**Audio.** Voices are `PeriodicWave` pulse tables, triangle, saw and LFSR
noise, run through a delay with a lowpass in the feedback path — the same
trick the SNES S-DSP used, and the reason 16-bit soundtracks have that wet,
slightly muffled tail. Music is a small tracker: text patterns of note names
where `.` sustains and `_` cuts, scheduled with a 140ms lookahead.

**Embedding.** If the host page provides a sized `#stage` element the canvas
fits itself to that box and tracks it with a `ResizeObserver`, instead of
assuming it owns the viewport. Scale snaps to whole or half pixels, always
downwards, so the canvas never grows past the space it was given.

**Input.** Every keydown is latched for at least one poll. Without that, a tap
shorter than a frame is down and up again between two 60Hz polls and vanishes
entirely — which is exactly what a fast tap on jump is.

**Player sprite.** Assembled from a 17px torso and a swappable 7px leg block
plus an overlaid gun arm, so the six-frame run cycle only costs leg frames —
the same trick sprite artists used when VRAM was the constraint.

## Tools

`tools/` holds the harness used to build and check the game. None of it ships
with the game itself.

```bash
node tools/validate.js        # level reachability + spawn placement check
node tools/bot.js 0 90        # heuristic bot plays stage 1, reports progress
node tools/boss.js 1          # drive a boss fight, report pattern coverage
node tools/sweep.js out/      # screenshot every screen and mechanic
node tools/flow.js            # verify stage -> boss -> results -> ending
node tools/killboss.js 2      # fight a boss to the death, time it, log phases
node tools/build-single.js    # inline everything into dist/vanguard-zero.html
```

`validate.js` is the useful one: it BFSes the tilemap with a movement model
slightly more conservative than the real physics and reports anything the
player can't reach. It caught a bottomless shaft, two ledges a tile beyond
jump height, and ten enemies spawned standing in lava.

`killboss.js` drives a scripted pilot through a whole fight and reports how
long it took and which phases and attacks actually fired. Boss HP is tuned
against it: roughly 18s, 20s and 37s for an invulnerable pilot, which lands a
real fight in the 30-60s range.

## Licence

MIT.
