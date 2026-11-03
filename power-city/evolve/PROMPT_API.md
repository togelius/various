You are evolving a game-playing controller, written as JavaScript source, for POWER CITY, a side-scrolling arcade beat 'em up (think Final Fight). You play the hero. Enemies come from both sides; the camera locks until the street is clear; each stage ends in a boss. One life only. Your score is PROGRESS through the street from a random starting position (stage, fight, distance, health and weapon all vary between evaluations), so a good controller must generalise rather than memorise a start.

## The contract
Write `function think(o, mem)`. It is called once per frame (60/sec) and returns an object whose truthy keys are the buttons held this frame: `left right up down punch kick jump`. `mem` is a plain object that persists across frames (use it for timers/state). Only `Math` is available (no other globals, no randomness: use `o.t` for deterministic variation). You may define helper functions and constants. Never throw. A fresh press (button newly true) is what triggers an attack, so to attack repeatedly you must release between presses, e.g. `a.punch = o.t % 8 < 3`.

## Observation `o`
- `o.t` frame number. `o.clock` seconds left on the stage clock (at 0 your health drains).
- `o.me`: `x, y` (y is depth on the street: `screen.top` is the far edge, `screen.bottom` the near edge; x grows to the right), `z` height off the ground (>0 while jumping), `hp, maxHp, facing` (+1 right, -1 left), `state` ('idle','walk','attack','hurt','fall','down','getup','jump','held','dizzy',...), `free` (true when you can start an action), `weapon` (name or null), `carrying` (holding a crate/drum), `grabbing` (you hold an enemy), `grabbed` (an enemy holds you: mash punch to escape).
- `o.enemies`: up to 8, nearest first: `dx, dy` (relative to you), `dist`, `type`, `boss`, `hp`, `z`, `state` ('attack' means mid-swing), `attacking`, `facingMe`, `armed`.
- `o.enemyCount`; `o.items`: nearby `{dx, dy, kind: 'weapon'|'prop'|'pickup', key}` (hearts heal; walk over pickups; punch near a weapon to pick it up).
- `o.screen`: `left, right` distance to the screen edges, `top, bottom` street limits in y, `locked` (camera locked: a fight is on and you cannot advance).

## Moves (all with the buttons above)
Punch repeated: jab, cross, then a hook that knocks down. Kick: slower, harder. Up+punch: uppercut. Jump then punch/kick: jump kick (one per jump). Punch while facing away from the only nearby enemy: elbow. Punch+kick together: spin kick (hits both sides, leaves you open). Walk in close and punch: grab; then punch = knee, kick = throw, back = release. Enemies mid-swing ('attacking') can be countered. Standing still next to several enemies gets you killed; walking right when nothing is left advances the street.
