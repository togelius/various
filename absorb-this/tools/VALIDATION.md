# Implementation fixes — validation, 2026-10-01

The browser integration suite passed **439 checks**, with no uncaught JavaScript
errors. The new regressions exercise real fizz shots at the Clog, nearer enemy
and scenery collisions, naturally moving rolls crossing hotplates, the final
wave's announcements and health bar, and the complete fizz-to-plug ending.
All four new regression scenarios fail against the previous `d5c6161` game.

PLEASE is tested through an actual death with a rocket in flight: the rocket
kills the Clog during the death tableau, then the retry restores the live boss,
its wounds, timers, hairball ownership and score together. Repeated deaths,
death after victory, technique history, stash rewards and stale victory
announcements are also covered.

A full automated campaign (seed 1, 1,200-second limit) escaped in 760.12 simulated
seconds with five deaths and no JavaScript, WebGL or state-invariant errors.
This verifies completion for one input policy; it does not establish human
difficulty. Staged finale checks at 1440 × 900 and touch-enabled 390 × 844 covered
the blocked-drain objective and health bar, including the compact phone
navigation marker. No jokes or content collections were removed.

# Kitchen incident build — earlier validation, 2026-10-01

The browser integration suite passed **350 checks**, with no uncaught JavaScript
errors. This includes the original campaign, exploration, rendering and ending
checks, plus real projectile friendly fire, expiring grudges, property disputes,
recoverable water, leaking rolls, shared hazards, bubble cascades, incident
history and progress-preserving continues.

The retry regressions include a naturally fatal self-fired rocket: its blast
damages enemies once, and PLEASE cannot replay the spent projectile. Other
checks cover shared absorption limits, split boss offspring, repeated deaths,
remaining spawn queues and reward duplication.

## Behavioral comparison

Both versions used the same input controller, seeds, virtual clock and 900-second
limit. The baseline is `ad8ffdc7a2733f5f3565397a66e733bfd5f39af7`.

| Seed | Original result | Original deaths | New result | New deaths |
| --- | --- | ---: | --- | ---: |
| 1 | Escaped, 676.75 seconds | 11 | Escaped, 517.98 seconds | 1 |
| 2 | Escaped, 835.78 seconds | 12 | Escaped, 482.03 seconds | 1 |
| 3 | Time limit, wave 7 | 10 | Escaped, 528.72 seconds | 0 |

Seconds are total simulated time, including deaths, continues and theatrical
interruptions. The new seed-1 campaign was repeated with identical complete
results, traces and incidents. Ordinary aiming and movement produced sauce
feuds, property disputes, redistribution, hotplate accidents and launches
without scripted incident triggers. Bubble behavior was exercised separately
in the regression suite; this controller does not choose the soap weapon.

The controller knows the route and sees exact coordinates of visible enemies.
Its bounded aim and reaction time do not make it a validated human persona.
These runs support easier completion for this policy. They do not establish
human difficulty, enjoyment, readable causality or whether the jokes land.
See [README.md](README.md) for the controller's assumptions and commands.

## Presentation and preservation

Staged Chromium checks at 1440 × 900 and a touch-enabled 390 × 844 viewport
covered the title, physical actors, expanded incident notebook and PLEASE
button. The button restored the same seven surviving actors and four incident
reports with full health. Narrow-screen text was corrected to fit without
horizontal scrolling. Pointer capture was emulated for the staged layout
checks; these are not real-device or speech-engine tests.

All 62 original authored array/object collections were compared against the
baseline and remained unchanged, including the existing dialogue banks. The
two new incident collections add 149 entries, including 50 philosopher
commentaries. The existing curios, enemies, endings and controls remain.

Manual play remains necessary to assess feel, comic timing, speech and touch
comfort. The game requires no new runtime dependencies.
