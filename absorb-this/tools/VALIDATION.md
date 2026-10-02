# Comedy broadcasts — validation, 2026-10-02

The final browser integration suite passes **478 desktop checks** and **481
touch-emulation checks**, with no uncaught JavaScript or WebGL errors. Testing
stayed muted. The game source SHA-256 is
`8d4b512a75f563d707608dc3ee6ac58049028e0346106139d24e4416905defbc`.

The new regressions exercise a real ice volley, a defeated sponge bowling into
another enemy, water pushing the frozen body, melting without duplicate rewards,
PLEASE restoring moving bodies and their collision history, and wave clears
that do not wait for props. Heat commentary distinguishes paper from bottles,
and bowling footage credits the sliding actor with its original identity.

Replay checks cover recorded lead-up and aftermath, bounded frame buffers,
independent snapshots, unchanged live physics/score/health during rendering,
automatic completion, pause/skip, held-key repeat, notebook-only mode, notebook
rewatching, the arriving Clog, lost mouse capture, held touch gestures, and waiting
for an active speaker. Original delayed wave commentary survives a broadcast;
interrupted full-text remarks survive PLEASE. Native speech timing was not
listened to.

Staged visual checks covered 1280 × 800 desktop, 390 × 844 portrait, and
844 × 390 landscape. The final two layouts used a touch-enabled Chromium
context; captions and controls fit without horizontal scrolling. These are
browser emulation checks, not a claim about real-device comfort. The recorded
bowling fixture contains 62 frames and about 0.94 MB of JSON. The runtime keeps
at most five clips, 64 frames per clip, and 42 rolling frames, with sampled
particles and no references to the live actor graph.

All **58 original uppercase array/object constants** were compared byte-for-byte
with `67d8511` and remain unchanged, including the philosopher, incident, callback,
taunt, death, kill-word, curio, weapon and modifier collections. The new broadcast
remarks are additional material.

Six full automated campaigns on that exact source reached the drain, each with
ten automatic broadcasts and no JavaScript, WebGL or state-invariant errors:

| Policy | Seed | Result | Deaths / PLEASE continues | Simulated seconds |
| --- | ---: | --- | ---: | ---: |
| casual | 1 | Escaped | 1 | 806.22 |
| casual | 2 | Escaped | 3 | 615.48 |
| casual | 3 | Escaped | 1 | 916.87 |
| practiced | 1 | Escaped | 0 | 441.38 |
| practiced | 2 | Escaped | 0 | 438.25 |
| practiced | 3 | Escaped | 0 | 476.75 |

Command: `node tools/playtest.cjs --seeds 1,2,3 --personas casual,practiced
--seconds 1200 --output /tmp/comedy-campaigns.json`. These policies drive the real
input and simulation paths and know the front-lane route. Their successful runs
verify progression; they do not establish human enjoyment or difficulty.

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
