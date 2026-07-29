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
| `plan.js` | A backward Dijkstra cost-to-go field over a movement graph that includes wall-cling states, plus the primitive library (parameterised input programs) and the rollout that runs one. |
| `pilot.js` | The policy. Picks a primitive each time the plan runs out by rolling out every candidate exactly and scoring the result. Also records the telemetry. |
| `report.js` | Runs the agent many times and turns the telemetry into a per-section difficulty table. |
| `bossbench.js` | Boss-only benchmark. Reports the two clocks - time to kill, time to die - and the margin between them. |
| `evolve.js` | GA over the judgement genome, with hand-written `--inject` genomes as a second mutation operator. |

## How it decides

Each decision rolls out all ~50 primitives from the exact current state and
scores the outcome: progress against the cost-to-go field, time, spike hits,
predicted overlap with enemies and live shots, crumbling footing, pit lips.
The best one is executed until it finishes or reality stops matching the
simulation it came from (knockback is the usual cause).

Three things in there are worth knowing about, because each one was the
difference between "cannot finish the game" and "can":

- **Look far, commit little.** In boss arenas the rollout depth (`bossLook`)
  and the number of frames actually executed before replanning (`bossCommit`)
  are separate numbers. Tying them together makes every setting a compromise.
- **Depth two where one move cannot be judged.** Over lava, and in front of a
  five-tile spike bed, the useful question is not "does this land" but "does it
  land somewhere I can leave". Backing up only pays as the first half of
  back-up-then-dash-jump.
- **Stall relief.** When every move is bad, the least bad one is to not move,
  and not moving keeps scoring well forever. So the threat terms are discounted
  the longer the agent goes without improving its cost-to-go.

## Running it

    node tools/agent/report.js --trials=12 --full=1 --lives=3
    node tools/agent/bossbench.js --trials=16
    node tools/agent/evolve.js --gens=8 --pop=10
