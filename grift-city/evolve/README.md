# Evolving Grift City controllers

LLM-driven MAP-Elites over **controllers written as code**. A controller is a small JavaScript function that plays the real
game (the real simulation modules, headless, no rendering); an LLM mutates, crosses and repairs them; the archive keeps the
best controller for each *playstyle*; and the only thing that counts as quality is **progress in the game**.

```
cd grift-city/evolve
node evolve.js --name run1 --gens 40 --children 4 --batch 5 --models haiku:0.6,sonnet:0.4   # needs a working `claude` login
node report.js run1                       # re-score every elite on held-out neighbourhoods -> runs/run1/report.md
node trace.js runs/run1/best.js --split heldout --index 2    # watch one controller play one start, as text
node ../test/evolve.js                    # the harness tests (also part of tools/check-overhaul.sh)
```

Options: `--backend claude-cli|anthropic|queue|mock` (`claude-cli` runs `claude -p` with Claude Code's own login; `anthropic` needs
`ANTHROPIC_API_KEY`; `queue` writes `runs/<name>/queue/*.prompt.md` and waits for `*.response.md`, so any other agent can be the
LLM; `mock` perturbs constants and needs no LLM), `--models name:weight,...` (an ensemble, picked by weight), `--max-chars` and
`--max-lines` (the size limit, default 4000 / 120), `--batch` (starts per epoch, 5), `--epoch` (generations per batch, 3),
`--density` (traffic and people, 0.5 of the shipped game), `--seconds` (cap an episode, for cheap experiments), `--resume`, `--minutes`.

## A controller

```js
function think(o, m) {            // called 10 times a second; m is memory that lasts for the run
  const a = {};
  if (o.ui.dialogue || o.ui.retry) { a.skip = true; return a; }
  ...follow o.gps.b on foot, steer/gas/brake in a car, press use to get in or out...
  return a;
}
```

It sees a plain-data observation (`prompts.js`, `brief()` is the full spec the LLM reads): its own state, the objective marker
(`goal`), a GPS route to it along sidewalks or roads (`gps`: bearings to the next three waypoints), the six nearest cars and
people (bearing, distance, speed, kind), the car it could enter, the dialogue/retry/choice state and the job's own objective
text, and three kinds of sensor:

* **rangefinders** (`range`): 12 beams every 30 degrees all round, the clear distance up to 30 m, stopped by walls, props
  *and vehicles*; plus the original 7 forward wall rays (`rays`);
* **pie-slice sensors** (`pie`): 8 slices of 45 degrees round the player, and for each of cars, people, cops and foes the
  distance to the nearest one in each slice (the representation used in our FPS-bot work);
* a **lane sensor** (`road`): on the carriageway or not, offset from the centre of the nearest lane going your way, that
  lane's direction.

About 2.3 ms per observation, ten times a game second. It answers with `move/strafe/turn/sprint` on foot, `steer/gas/brake/hand` in a car, and `use/skip/choose/talk/
fire/aim/weapon...` either way: the same inputs as the touch controls. The observation is built inside the game's vm context
(`bridge.js`), crosses into the controller's own vm context as JSON, and the action comes back as JSON, so a controller never
holds a game object.

**Size limit.** 4000 characters and 120 lines, comments included. Enforced in `sandbox.js`, together with static bans
(`while`/`do`, `eval`, `Function`, `constructor`, `process`, `require`, `Date` ...) and a compile + smoke test. A candidate
that breaks a rule is not thrown away: it goes to an *infeasible pool*, and a fraction of children are LLM *repairs* of one
(the prompt states the violation), which are then evaluated like any other child.
This keeps honest LLM output from hanging a worker; **it is not a security sandbox**, so do not run controllers you do not trust.

## Quality: progress, made more inclusive

**Quality = story + 0.25 cash + 0.1 survival**, averaged over the starts of a batch (`episode.js`, `facets`):

* **story** (points / 10, the bulk of it): up to 3 points for closing the distance to the first marker, 2 for starting the job
  there, then for *every* further objective up to 1 point for the fraction of the distance to it closed (1 when reached; up
  to 8 objectives), 5 for passing the job and 5 more for each further job. Continuous credit inside a job means the long
  legs of a job (drive the van 800 m to Pier 9) are no longer a desert between two milestones.
* **cash**: money made by any means during the run (job pay, cons, style chains for drifts and near misses, stunts, hidden
  packages) / $2000, capped at 1.5. Other ways of getting on in the game count, a little.
* **survival**: 0 if dead or arrested at the end, else 0.5 + 0.5 x health. One life: death or arrest ends the start.

Nothing rewards violence for its own sake. Episodes last about **4 game minutes** (240 s plus up to 45 s for a long way to go),
ended early when the player has not moved for a minute.

## The helper library

Following Continual Abstraction Discovery (Siper, Khalifa, Togelius: "Procedural Content Metageneration via Program Search
and Continual Abstraction Discovery", arXiv 2608.17947; the idea, not their code), every 4 generations the LLM is shown the
best elites from different cells and asked for 1-4 small reusable helper functions. An addition is **append-only** and is kept
only if it is plain function declarations with new names, passes the same bans, keeps the library under 3500 characters and
still compiles and runs with *every* elite and seed, so no elite ever changes behaviour because the library grew. The library
runs in the controller's context before the controller and **does not count toward a controller's size limit**; prompts
show it, and a `library` hint asks the LLM to refactor a parent onto it. `runs/<name>/lib.js` is the library; `log.jsonl`
records which helpers each child calls.

## Starts vary, and some neighbourhoods are never trained on

A *start* (`scenarios.js`) is a random sidewalk node 120-450 m from the mission giver, on foot (half the time with a free car
parked 5-20 m away) or already driving a random car, with one of three jobs next (REPO MAN, SPECIAL DELIVERY, COLLECTIONS), a
random hour, rain or not, health 40-100, sometimes a weapon, sometimes already wanted, and a random world seed (traffic,
people, AI). The city is cut into blocks by a fixed hash; about a quarter of the blocks are **held out**: no training start
ever begins there. So the held-out check is a spatial generalisation test, not just a new roll of the dice.

* The training batch of 5 starts is **redrawn every 3 generations**. A child and the elite it fights are compared on the
  **same** batch; an incumbent whose score is from an older batch is re-run on the current one before they fight.
* Every 8 generations the best three elites are scored on 6 held-out starts and the gap is logged (never used for selection).
* `report.js` re-scores every elite and the hand-written seeds on held-out and fixed training starts.

## The map

6 x 6 grid, both axes **measured from play**, not read off the code:

| axis | meaning | bins |
|---|---|---|
| `wheels` | share of the distance covered in a vehicle | on foot, mostly foot, mixed, mostly car, car, only car |
| `trouble` | offences per minute (assault, vandalism, hitting people, carjacking, shooting, cons ...) | law-abiding, a slip, scuffles, troublemaker, crime spree, rampage |

A cell keeps its best controller. Mutations sometimes aim at an empty cell next to the parent's, and the prompt says which
playstyle to aim for.

## What was taken from where, and what was not

* **AlphaEvolve** (DeepMind, 2025; I read secondary descriptions, not the paper): the database is the MAP-Elites archive; prompts
  carry a parent, inspirations from other cells and the *evaluator's account of how the parent played* (per start: how far it
  got, what the game said, where it got stuck, what it died of); programs come back mostly as SEARCH/REPLACE diffs; a cascade
  stops hopeless candidates after two starts; an ensemble of models (fast for breadth, strong for depth). Its meta-prompt
  evolution is replaced here by a much simpler bandit over a list of hint instructions (`HINTS` in `prompts.js`) that gets
  credit when a child improves the archive. Not done: island populations, distributed evaluation.
* **Talakat** (Khalifa, Lee, Nealen, Togelius, 2018; abstract only): constrained MAP-Elites with feasible and infeasible
  populations. The infeasible pool and the repair operator are that idea; the playstyle axes are measured by simulation.
* **ProFiT** ("program search for financial trading", Siper, Khalifa, Soros, Nasir, Togelius; SSRN 5889762): **I could not read
  the paper** (SSRN refused the fetch); what I know of it is second-hand: it evolves executable trading programs from historical
  market feedback, and the group's related ELMER paper describes the protocol of fitting on training data, selecting on
  validation data and touching the test data once. What I took is that spirit: selection never sees the held-out set, the
  prompts carry measured feedback from play, and generalisation is reported separately. If ProFiT has specific mechanisms worth
  porting, tell me and I will add them. (Tall Order's README credits its helper library to *Profit*; that idea is from the Continual Abstraction Discovery
  paper, a different one, which is what the helper library here follows.)

## Results so far

`EXPERIMENTS.md` has the numbers. In short, run1 (30 generations, haiku + sonnet, about two hours): on held-out neighbourhoods the
best evolved controller scores 0.59 against 0.33 for the best hand-written seed (the 14 elites average 0.50 against 0.30 for the
two seeds), holds up at the shipped traffic density, and fills 14 of the 36 playstyle cells. No controller passes a job yet; they
reliably get from any start to the marker and into the first leg of the job. `runs/run1/` has the archive, every elite, the log
and the held-out report; `best.js` there is the best on training, `report.md` names the best on held-out starts.

## Files

| | |
|---|---|
| `world.js` | a fresh headless world per episode (about a second), the gameplay half of `game.js` `step()` replayed in order; `test/evolve.js` fails if `step()` grows a gameplay call that is not replayed |
| `bridge.js` | runs inside that world: observation, buttons, progress, playstyle, start set-up |
| `sandbox.js` | the size cap, static bans, controller vm, time limit |
| `scenarios.js` | start sampler, held-out blocks, time budgets (about 2 game minutes per start) |
| `episode.js` | one controller on one start -> points, playstyle, account of what happened |
| `archive.js` | the MAP-Elites grid |
| `prompts.js` | the game brief and contract, mutation / crossover / repair prompts, hints, diff parser |
| `llm.js`, `pool.js`, `worker.js` | LLM backends; a pool of evaluation processes (hung ones are killed) |
| `evolve.js`, `report.js`, `trace.js` | the loop; the held-out report; a text replay |
| `seeds/` | hand-written starting controllers: `walker.js` (on foot), `driver.js` (finds a car) |
| `runs/<name>/` | `state.json`, `log.jsonl`, `map.txt`, `best.js`, `elites/`, `report.md` |

## Caveats

* Evolution runs at **half traffic and pedestrian density** (cars and people are most of the cost of a step); `report.js --density 1` re-checks at full density.
* The sim steps at 30 Hz and a controller decides at 10 Hz; the shipped game steps at 60 Hz on a good device.
* The jobs that follow the first objective are only reachable in part: a start gives about two game minutes, enough to start a job and often to follow it for a while, rarely to pass it.
* Only the first three story jobs are used as starts. Later jobs need weapons, money and story state the sampler does not set up.
* Quality is a mean over 5 starts and the game is noisy; the per-epoch batch, the same-batch contests and the held-out report are the defences, not a guarantee.
