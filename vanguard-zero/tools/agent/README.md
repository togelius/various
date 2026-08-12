# The play agent

An automated player for VANGUARD ZERO, built to answer two questions: is the
game actually completable by something that is not the person who made it, and
which parts of it are hard.

It is not a learned policy. Navigation is *solved*, not trained, and only the
judgement calls on top of it are tuned.

## Pieces

| file | what it does |
|---|---|
| `sim.js` | Frame-exact forward simulation of the player. Bodies are `Object.create(VZ.Entity.prototype)`, so collision is the game's own code rather than a re-implementation of it. `tools/sim-check.js` proves 0.0000 px divergence over 24 trials. |
| `world.js` | Forward model of everything that is *not* the player. Enemies, bosses and projectiles are cloned into a sandbox and advanced with their own real `update()` methods, so a turret's cadence and a boss's attack script are exact rather than extrapolated. Particles, sound and the random stream are all contained for the duration — a planner that draws from the live generator changes the future it is predicting. `tools/world-check.js` proves the projection matches and leaves no trace. |
| `plan.js` | A backward Dijkstra cost-to-go field over a movement graph that includes wall-cling states, plus the primitive library (parameterised input programs) and the rollout that runs one. |
| `pilot.js` | The policy. Picks a primitive each time the plan runs out by rolling out every candidate exactly and scoring the result. Also records the telemetry. |
| `report.js` | Runs the agent many times and turns the telemetry into a per-section difficulty table. |
| `bossbench.js` | Boss-only benchmark. Reports the two clocks - time to kill, time to die - and the margin between them. |
| `latency.js` | Sweeps observation delay and reports how fast each section degrades. This is the difficulty measurement that means something; see below. |
| `evolve.js` | GA over the judgement genome, with hand-written `--inject` genomes as a second mutation operator. |

## How it decides

Each decision rolls out all ~50 primitives from the exact current state and
scores the outcome: progress against the cost-to-go field, time, spike hits,
predicted overlap with enemies and live shots, crumbling footing, pit lips.
The best one is executed until it finishes or reality stops matching the
simulation it came from (knockback is the usual cause).

Four things in there are worth knowing about:

- **Look far, commit little.** In boss arenas the rollout depth (`bossLook`)
  and the number of frames actually executed before replanning (`bossCommit`)
  are separate numbers. Tying them together makes every setting a compromise.
- **Commit to the whole plan.** Outside boss arenas the search executes the
  entire sequence it found, not just its head. Re-deriving the decision every
  move is fine with a good heuristic and hopeless with a marginal one: the
  cost-to-go field prices a five-tile spike bed at about what it costs to walk
  the same distance on flat ground, so "back up, then dash-jump it" is worth
  roughly nothing per move and a fresh-every-frame planner takes the locally
  cheapest half-step forever.
- **Depth, not width.** Measured on the Void Citadel's spike corridor: 50
  expansions at beam 14 died 5 times a run, 120 at beam 50 died 4, and 200 at
  beam 20 died 0.3.
- **Diversity in the beam.** Sorting successors purely by cost drops every
  backward move, and backing up is the first half of the only plan that
  clears those spike beds. One slot is reserved per direction.

There used to be a fifth — *stall relief*, which discounted the threat terms
whenever the agent stopped making progress. It was a patch for the dithering
that a one-move-deep search cannot avoid, and it spent health in exactly the
sections the difficulty report was trying to rank, which made those numbers
partly circular. The search replaced it and it is gone.

## Measuring difficulty rather than the agent

A planner with frame-exact execution and full state access measures a *lower
bound*: how much a section costs when nothing is missed. Useful — it is how
much slack the design leaves — but it is not what a person meets, and improving
the agent only moves it further away.

`latency.js` sweeps the difference. Raising `latency` holds every observation
for N frames before the planner sees it while it still acts now, which is the
loop delay a hand-eye path has. How fast a section falls apart as N rises is
the interesting number:

- **steep** — a reflex wall. Fine when you know what is coming, ruinous when
  your hands are a few frames behind.
- **flat but costly** — a knowledge wall. Expensive however well you see it.
- **flat and cheap** — the section is not doing anything.

## Running it

    node tools/agent/report.js --trials=12 --full=1 --lives=3
    node tools/agent/bossbench.js --trials=16
    node tools/agent/evolve.js --gens=8 --pop=10

    # the sweep is slow; one setting per process, then merge
    for L in 0 3 6 9; do
      node tools/agent/latency.js --trials=4 --steps=$L --json=lat$L.json &
    done; wait
    node tools/agent/latency.js --merge=lat0.json,lat3.json,lat6.json,lat9.json

Two checks keep the models honest, and both should be run after touching
anything in `sim.js` or `world.js`:

    node tools/sim-check.js      # player physics vs the game, must be 0.0000 px
    node tools/world-check.js    # enemy projection vs reality, and no leakage
