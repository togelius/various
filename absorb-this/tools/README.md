# Behavioral playtesting

See [VALIDATION.md](VALIDATION.md) for the kitchen incident build's regression
results, comparison with the original game and remaining human-play questions.

`playtest.cjs` drives the shipping simulation through keyboard and mouse input.
It serves an instrumented copy of the game from a temporary loopback HTTP server;
it does not change the game, its saves, or its source file. Browser contexts are
fresh for every run. The local server closes when the command finishes.

Requirements: Node.js, the `playwright` Node package available to Node, and a
Chromium executable. The cloud environment already provides these. No package
manifest or lockfile is needed by the game itself. `--browser` or
`CHROMIUM_PATH` selects another installed browser.

The browser integration suite can also exercise touch handlers with
`node tools/check-browser.cjs --touch` (start the repository HTTP server first,
as for the ordinary `check-browser.cjs` command). This includes held joystick
and fire gestures across the automatic replay, pause and skip transitions.
It is browser touch emulation, not a real-device ergonomics test.

From the `absorb-this` directory:

```sh
node tools/playtest.cjs --seeds 1,2,3 --seconds 900 --output /tmp/current-playtest.json
node tools/playtest.cjs --baseline --seeds 1,2,3 --seconds 900 --output /tmp/baseline-playtest.json
node tools/playtest.cjs --personas stationary,runner,practiced --seeds 1 --seconds 300 --output /tmp/control-playtest.json
```

`--baseline` reads `HEAD:absorb-this/index.html` without checking out or editing
anything. To compare any saved source version, use `--source /path/to/index.html`
instead. Both sides use the same harness and profiles. Keep the source SHA-256
from the report: matching seed numbers alone do not mean matching encounters
across source versions, because changes may consume different random draws.

One browser and one scenario run at a time. On constrained machines run these
separately from the integration suite. These are synthetic seconds, so a slow
machine only changes how long the command takes, not the controller's reaction
time or simulation timestep.

## What the personas actually do

| Policy | Goal and behavior | Competence |
| --- | --- | --- |
| `casual` | Clear waves with the Squirter; use ice at close range when below half health; occasionally dash/jump; continue with PLEASE | Decisions every .3 seconds, bounded angular aiming speed, up to .045 radians of aim error per axis, no target lead |
| `stationary` | Shoot like casual without movement, dash or jump during combat; travel after clearing | Same perception and aim as casual |
| `runner` | Patrol and try to reach the exit; never fire | Same navigation assumptions; a negative control rather than a pacifist-solution claim |
| `practiced` | Clear waves with more close-range ice use | Decisions every .14 seconds, faster bounded aim, .018 radians of error |

Policies perceive only nearby enemies within a forward viewing angle and an
unblocked collision ray. They receive precise coordinates of those visible
silhouettes; they do **not** interpret rendered pixels. Aim is sampled only at
decision time, so a moving target can leave the remembered aim point. They do
not read enemy health to choose targets and do not predict projectile impacts.
Policy randomness is separate from seeded game randomness.
The runner waits for fonts and their setup callbacks to settle, then reseeds game
randomness at the start of each run. Traces include the consumed draw count.

All policies know the documented front lane and district destinations. The
patrol and exit controller navigates by player input; it never teleports.
This is explicit route knowledge, not evidence that a human would discover the
path or understand controls. The current policies do not seek curios, perform
soap combinations, deliberately recycle water, or understand jokes.

“Casual” is a policy name, not a validated model of a demographic. Its continuous
patrol and precise knowledge of visible silhouettes may outperform a novice;
its target switching and failure to exploit other weapons can underperform an
experienced player. Inspect traces and compare several policies before drawing
conclusions about a particular failure.

## Execution and evidence limits

The runner replaces the final animation-loop boot with its controller inside
the same closure used by the browser integration suite. It emulates successful
pointer capture, dispatches the real Enter/PLEASE/key/mouse handlers, and calls
shipping `tick`, `hud` and `zUpdate` at 60 Hz. Game timeouts and `performance.now`
advance on a virtual clock. The muted audio-only interval is disabled.

There are no health overrides, wave skips, enemy deletions, direct damage calls,
or direct victory calls. An observation wrapper counts accepted calls to
`fire` while delegating its behavior unchanged. It checks that a combat policy
which has observed targets actually fired, and that the runner did not shoot.
Death and continued-wave outcomes are recorded; a death limit or time limit is
a test result, not a harness error.

Rendering runs only at the end, with a WebGL-error and render-stack check. This
keeps software-rendering speed out of combat timing. Consequently the normal
renderer does not consume its per-frame random camera-shake values, audio is
absent, and seeds characterize **this harness**, not a corresponding manual
browser session. This is not an audio, frame-rate, real-device touch, visual
comprehension, discoverability, comedy, balance-approval or human enjoyment test.

JSON output includes source/harness fingerprints, assumptions, profiles, actual shot
counts by weapon, progression/state/death events, final outcome and periodic
traces. Builds with the incident archive also report its counts and recent entries.
`--trace-seconds` changes trace spacing, `--max-deaths` controls the
number of allowed PLEASE continues, and `--seconds` bounds each attempt series.
`--max-deaths 0` stops at the first death; the default allows twelve continues
and stops at the thirteenth death. Output is saved after each completed run.

The process fails on browser/script/invariant errors, not merely because a
persona dies. Replay the same source/profile/seed to check reproducibility.
Inspect where decisions failed: a game bottleneck, a policy limitation and a
broken input adapter call for different responses. Keep the ordinary browser
regression tests as a separate layer; these policies do not replace them.
