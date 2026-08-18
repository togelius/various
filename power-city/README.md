# POWER CITY

*a side-scrolling arcade beat 'em up* — one folder of plain JavaScript, no
build step, no dependencies, no assets.

Open `power-city/index.html` and press **5**, then **1**. There is also a
single-file build in `dist/power-city.html` if you would rather host or hand
around one file, and `dist/power-city-artifact.html` — the same game in a
cabinet, for embedding somewhere that supplies its own page. `python3
tools/build-single.py` regenerates all three from `tools/shell-artifact.html`
and the script order in `index.html`.

> Four stages. Four bosses. Two players on one keyboard. A clock that does not
> care whether you are ready.

## What it is

A late-eighties street brawler, rebuilt from scratch: you walk right, the
camera stops, the gang arrives from both sides, and nobody moves on until the
street is clear. Punch, kick, jump kick, grab, knee, throw, elbow whoever came
up behind you, pick up the bat somebody dropped, and put a crate through the
next three of them.

Every pixel is drawn at runtime and every sound is synthesised at runtime.
Nothing is loaded from disk — there is no sprite sheet and no audio file in
this repository, because there is no sprite sheet and no audio file.

## Playing

|                       | Player 1              | Player 2                |
| --------------------- | --------------------- | ----------------------- |
| Move                  | `WASD` or arrows      | arrows (once joined)    |
| Punch                 | `Z` / `J`             | `,` or numpad `1`       |
| Kick                  | `X` / `K`             | `.` or numpad `2`       |
| Jump                  | `C` / `L` / space     | `/` or numpad `3`       |
| Start / join          | `1` or `Enter`        | `2` or numpad `0`       |

`5` inserts a coin · `Esc` pauses · `M` mutes · `F` goes fullscreen ·
gamepads work, first pad to player one · phones get an on-screen pad.

The arrow keys belong to player one until a second player actually joins, at
which point they move over — so a solo player can use whichever hand they
like and a second player never has to be told which keys became theirs.

### The move list

| | |
| --- | --- |
| **Combo** | Punch, punch, punch. The third one is a hook and puts them down. |
| **Kick** | Slower than a jab, hits harder, pushes further. |
| **Uppercut** | Up + punch. Launches. Very slow — earn it. |
| **High kick** | Up + kick. Catches jumpers. |
| **Jump kick** | Jump, then punch or kick on the way through. |
| **Elbow** | Punch while someone is behind you and nobody is in front. |
| **Spin kick** | Punch and kick together. Hits both sides, leaves you wide open. |
| **Run** | Double-tap a direction. Punch out of a run for a flying knee. |
| **Grab** | Walk in close and punch. Then: punch to knee (three, then they go), kick to throw them over your shoulder, or pull back to let go. |
| **Weapons** | Punch over a bat, pipe, chain or knife to pick it up. Punch swings it, kick throws it. It breaks eventually. |
| **Crates & drums** | Punch to lift, punch or kick to hurl. Drums explode. |

Get hit four times in a hurry and enemies see stars — that is the moment to
grab. Caught in a bear hug yourself, mash anything to get out.

## The stages

1. **SLUM ALLEY** — brick, fire escapes and the first boss, **CRUSHER**.
2. **DOWNTOWN** — the block they run, the bar they run it from, and **VIPER**.
3. **THE DOCKS** — containers, cranes, black water, **JAWS**.
4. **POWER TOWER** — glass, neon, and **MR. POWER** on the top floor.

Run out of lives and the machine gives you ten seconds to think about it.

## How it is put together

```
js/core.js     screen, timing, two-player input, RNG, storage
js/art.js      the 5x7 arcade font, pixel primitives, the outline pass
js/rig.js      the articulated fighter: one figure, ~35 poses, baked at boot
js/cast.js     the cast as palettes; weapons, crates and pickups
js/city.js     facade modules, parallax skylines, streets, four themes
js/audio.js    two pulse voices, a triangle bass, a noise channel, a sequencer
js/music.js    the songs, as sixteenth-note pattern strings
js/fx.js       hit sparks, dust, score pops, screen shake
js/actors.js   2.5D physics, the hit system, hit-stop, knockdowns
js/items.js    holding, swinging, throwing and smashing things
js/player.js   the move list and what the buttons do
js/enemies.js  the gang, the bosses, and the attack-token system
js/stages.js   four stages, their encounters, the camera lock
js/hud.js      score, lives, clock, health, credits
js/game.js     attract, credits, stage flow, continues, ending
js/touch.js    the on-screen pad
```

### Three decisions the game is built on

**Nobody draws twenty animation frames per fighter.** There is one
articulated figure — head, torso, two arms, two legs — and a table of poses
in a coordinate space where *x* runs forward and *y* runs up from the floor.
A character is nine colours and a hairstyle. Every pose every character can
strike is baked into its own canvas at boot with a black keyline grown around
it, and blitted from then on. Add a pose and the whole city learns it.

**The freeze is the punch.** When a hit connects the entire world stops for
four to eleven frames, longer for heavier blows, while the spark and the
screen shake keep animating. Take that out and the game feels like it is made
of paper. Everything else about the fight — knockdowns, the dizzy state, the
bounce a body takes when it lands — hangs off that one pause.

**Only two of them may attack at once.** Enemies must claim one of two tokens
before they are allowed to swing; everyone else circles, drifts into a free
lane, or waits at the edge of their reach looking menacing. Eight thugs
punching on the same frame is not difficulty, it is arithmetic.

## Checking it

```
node power-city/test/check.js
```

2800-odd assertions over the data tables, in plain node with no browser: every
pose has all its joints and stays on the canvas, every move has active frames
and a pose that exists, every stage names enemies and items that exist and
ends with a boss, every song note is a note, every glyph is seven rows of five
bits. The things that can actually be wrong with this game are nearly all in
the tables.

For the parts that need a canvas there are headless harnesses in `tools/`:
`sim.js` puts a bot at the controls and fast-forwards whole stages in seconds,
`scene.js` poses a fight and photographs it, `shot.js` screenshots any page.
They need `playwright` on the path; the game itself needs nothing.
