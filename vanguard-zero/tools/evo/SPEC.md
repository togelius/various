# VANGUARD ZERO controller specification

A controller is a small JavaScript program that plays VANGUARD ZERO, a 16-bit
side-scrolling action platformer. It is called once per frame, at 60 frames per
second, and returns which buttons to hold that frame.

## The program

```js
// intent: one sentence saying what this controller's strategy is
function control(obs, mem) {
  // ...
  return { right: true, jump: false, fire: true };
}
```

- The first line must be a `// intent:` comment: one plain sentence describing
  the strategy, not the code.
- `control(obs, mem)` is the entry point. You may define other top-level helper
  functions and constants in the same file.
- `mem` is an object that persists between frames of one run and starts empty
  at the beginning of each run. Store any state you need in it.
- Return an object with any of these booleans: `left`, `right`, `up`, `down`,
  `jump`, `fire`, `dash`, `weapon`. Anything missing is not pressed.
- **Size limit: 4000 characters for the whole file, comments included.** A
  longer program still runs, but it is marked infeasible and cannot hold a
  place in the archive until it is shortened.
- Plain JavaScript only. These names may not appear anywhere in the code:
  `require process import globalThis global window self eval Function
  constructor __proto__ prototype Reflect Proxy Date setTimeout setInterval
  WebAssembly Atomics SharedArrayBuffer VZ`.
- `Math.random()` is available and seeded, so a run is reproducible.
- Each call must return quickly. A frame that takes more than 25 ms ends the
  run. More than 2% of frames throwing an exception makes the program
  infeasible.

## Buttons and what they do

- `left` / `right`: run. Run speed is 1.95 px/frame; ground acceleration 0.6,
  air acceleration 0.42 px/frame². Holding both cancels out.
- `jump`: jumps happen on the frame the button goes from released to pressed -
  **holding it does not jump again; you must release it for at least one frame
  between jumps.** A jump launches at 7.0 px/frame upward and rises about 3.5
  tiles; releasing early cuts the jump short. There are 7 frames of coyote time
  after leaving a ledge, and a press up to 8 frames before landing is buffered.
- Wall jump: when airborne and touching a wall you cling to it (unless you hold
  away from it) and slide down slowly. Pressing jump while clinging kicks you
  up and away from the wall at 3.4 px/frame sideways and 7.3 up; for 9 frames
  afterwards horizontal input is ignored. You can kick off up to 7 frames after
  leaving the wall.
- `dash`: also edge-triggered. A burst at 4.0 px/frame in the facing direction
  for 20 frames. Available on the ground, and once in the air (restored by
  landing or touching a wall). Dashing in the air holds your height.
- `fire`: shoots in the facing direction, and it is edge-triggered too.
  Pressing fires one small shot (2 damage; at most one every 7 frames, and at
  most 3 of yours on screen). Keeping it held then charges - level 1 after 26
  frames, level 2 after 70 - and **releasing** fires the charged shot (4 or 8
  damage). So holding fire forever fires exactly one shot; rapid fire means
  pressing and releasing, and a charge means holding and then letting go.
  Special weapons (see `weapon`) fire on press and cost energy.
- `down` + `jump` while standing on a one-way platform (`=`) drops through it.
- `weapon`: edge-triggered, cycles to the next unlocked weapon (more unlock in
  later stages; special weapons spend energy).
- `up`: unused.

## The game

- Three stages, each a long left-to-right level ending at a boss gate. Passing
  the gate starts a boss fight in a closed arena.
- Health is 16. Spikes, enemy contact and enemy shots cost health (damage is
  halved in stage 1 and three-quarters in stage 2). After a hit you are
  invulnerable for 72 frames and knocked back for 22 frames, during which input
  is ignored.
- **Instant death**: falling below the bottom of the map (pits), and touching
  liquid (`~`, lava or void).
- Crumbling blocks (`c`) start to break when stood on and vanish shortly after
  (`C` means already breaking).
- Conveyors (`>` `<`) push you along while you stand on them.
- Enemies: troopers (patrol, then plant and fire a 3-round burst), drones
  (hover, then dive at you), hoppers (crouch, then leap at you in an arc),
  shielders (advance behind a plate that blocks small shots from the front -
  hit them from behind or above, or with a full charge), turrets (fixed, track
  you and fire along a telegraphed line), rollers (spiked drums that roll along
  the floor and bounce off walls), and flamers (vents that erupt on a fixed
  cycle and cannot be destroyed). Killed enemies stay dead and sometimes drop
  health or energy.

## The observation

`obs` is plain data, rebuilt every frame. Positions are in pixels; one tile is
16 px. `dx`, `dy` are relative to the centre of the player; `+x` is right,
`+y` is **down**.

```text
obs.t          frames since this run started
obs.stage      0, 1 or 2
obs.goalDx     pixels from you to the boss gate (always ahead, to the right);
               0 once the boss fight has started
obs.inArena    true once the boss fight has started
obs.me         { x, y, vx, vy, w: 10, h: 22, ground, wall, sliding, facing,
                 hp, maxHp, energy, dashReady, dashing, charge, hurt, invuln,
                 weapon }
                 ground: standing on something; wall: -1 touching a wall on the
                 left, 1 on the right, 0 none; facing: -1 or 1; charge: 0..2;
                 hurt: in knockback; invuln: in post-hit invulnerability
obs.tiles      { ox: 12, oy: 9, rows: [15 strings of 25 characters] }
obs.tile(dx, dy)
               the tile character dx tiles right and dy tiles down of the tile
               your feet are in. tile(0, 1) is what you are standing on;
               tile(1, 0) is the tile just ahead at foot level; tile(1, -1) is
               ahead at head level. Covers dx -12..12, dy -9..5. Above the
               window is '.', past the sides is '#', below is '.'.
obs.enemies    up to 12 nearest within 320 px:
               [{ dx, dy, w, h, vx, vy, hp, kind, facing }], nearest first.
               kind: 'trooper' 'drone' 'hopper' 'shielder' 'turret'
                     'turretCeil' 'roller' 'flamer'
obs.shots      up to 16 nearest hostile projectiles within 320 px:
               [{ dx, dy, w, h, vx, vy, warn }], nearest first. warn > 0 means
               it has not started moving yet (frames remaining).
obs.pickups    [{ dx, dy, kind }]  kind: 'health' 'bigHealth' 'energy' 'life'
obs.boss       null, or { dx, dy, w, h, hp, maxHp, state }
```

Tile characters:

```text
.  empty            #  solid            =  one-way platform (solid from above)
^  spikes (hurt)    ~  liquid (death)   c  crumbling block  C  crumbling now
>  conveyor right   <  conveyor left    |  boss door (solid)
```

A row of `.` running to the bottom of the window under a gap usually means a
pit. Below the map is death.

## How a controller is scored

Each run starts from a different place in one of the three stages, with its
own random seed, and lasts until the time budget runs out, the player dies, or
the run stalls (no new ground for 12 seconds). There is **one life**.

- In a level run, progress is the fraction of the remaining distance from the
  start position to the boss gate that the controller covered (its furthest
  point counts, even if it later died). Reaching the gate scores 1.
- In a boss run, progress is the fraction of the boss's health removed.

Quality is the mean progress over all runs. The runs a controller is selected
on are not the only ones it is tested on, so a controller that memorises
particular positions will not do well.
