# Evolving controllers

LLM-driven quality-diversity search over VANGUARD ZERO controllers written as
code. Each controller is a small JavaScript program; an LLM proposes changes
to it; every proposal is scored by playing the real game from many starting
positions; and a constrained MAP-Elites archive keeps the best controller for
each of a grid of playstyles.

```bash
node tools/evo/parity.js                 # headless game == browser game, frame for frame
node tools/evo/sandbox-test.js           # containment and robustness tests
node tools/evo/tasks.js                  # regenerate the train/test starts (tasks.json)
node tools/evo/eval.js tools/evo/seeds/*.js -v          # score controllers on train and test
node tools/evo/evolve.js --run=NAME --children=400 --budget=15 --conc=6
node tools/evo/report.js --run=NAME --export            # map, elites, operators, generalisation
node tools/evo/fullgame.js FILE.js --games=50           # play the real game, 3 lives, fresh seeds
```

`--from=RUN` starts a run from another run's elites, re-scored on the current
training set.

`evolve.js` needs the `claude` CLI on the path; it calls it in print mode with
every tool disabled. `--budget` is a hard stop in US dollars, read from the
CLI's own cost report.

## How it works

### The game, headless and identical

`headless.js` loads the game's own sources, unmodified and in `index.html`
order, into a Node `vm` context with a stubbed DOM. Physics, collision,
enemies, bosses and the random stream are the real code. `parity.js` drives
the browser build and the headless build with the same scripted inputs from
the same RNG state across all three stages and compares position, health,
enemy and projectile counts and RNG state every frame: identical over 9 × 900
frames. Headless runs at 10-13k frames a second with a controller attached,
about 200× realtime, so a full evaluation takes 2-3 seconds and the LLM, not
the game, is the bottleneck.

### A controller

A controller is a file defining `control(obs, mem)`, called once a frame, that
returns the buttons to hold. [SPEC.md](SPEC.md) is the full contract, and it is
also the system prompt every LLM call gets, so the rules the model is told and
the rules it is held to cannot drift apart.

- **Observation**: the player's state, a 25 × 15 tile window around the
  player's feet as strings with a `tile(dx, dy)` helper, the nearest enemies,
  hostile shots and pickups, the boss if any, and the distance to the boss
  gate. Plain data, rebuilt each frame. No path-finding, no forward model:
  whatever planning a controller does, it writes itself.
- **Size limit: 4000 characters**, comments included. Over it a controller
  still runs, but it is infeasible (below).
- **First line**: a `// intent:` sentence saying what the strategy is. After
  ELMER, the natural-language description travels with the program; it makes
  the archive readable and gives the next prompt a summary of the parent.

### Containment

LLM-written code has to run somewhere it cannot reach the game it is scored
on - a controller that writes `player.x = goal` would win. Each controller
gets its own `vm` context holding nothing but the JavaScript builtins and a
short prelude. The observation crosses in as a JSON string and is parsed
inside, so every object the program can touch was made in its own realm and
no prototype chain leads back to Node or to the game; the answer crosses back
as an integer bitmask. `Math.random` is seeded per run. A frame that takes
over 25 ms ends the run; one that never returns is caught by the worker
pool's deadline, which kills the worker. A static check rejects a short list
of names as a second line and as immediate feedback for the model.
`sandbox-test.js` attacks the vm layer directly with the classic escapes
(constructor chains from observation objects, from the helper function, from
`{}`, via `this`) and checks hangs, slow frames, exceptions, the size verdict
and reproducibility.

### Quality: progress, from many starts

Quality is progress and nothing else. A level run scores the fraction of the
distance from its start to the boss gate covered (furthest point, so dying
after getting far still counts); a boss run scores the fraction of the boss's
health removed. Quality is the mean over runs. One life per run.

**Starts are varied so nothing is learned about one position.** `tasks.js`
scans every tile column of all three stages for footing a player could stand
on, checks each candidate by simulation (drop the player there, idle for a
second: alive, still standing, unhurt), and takes sixteen evenly spaced starts
per stage. Alternate starts go to *train* and *test*, plus the boss fight of
each stage, and every start is run under three seeds: 81 training runs and 81
held-out runs. (The first run used twelve starts and one seed each; see
Results for why that was not enough.) Selection only ever sees train. Test scores are computed for elites at
checkpoints, logged, and never used - so the gap between the two is a clean
measure of overfitting. Because the two sets are not exactly equally hard,
the report measures overfitting against the seeds' own gap: the seeds were
never selected on anything, so their gap is what the difference in difficulty
alone produces.

### The archive: constrained MAP-Elites

Two behaviour dimensions, both about how a controller chooses to play rather
than how well:

- **Aggression**: shots actually fired per second, over the ~4/s the buster
  can sustain. Runner to gunner. Shots are counted at the gun, because fire is
  edge-triggered: frames with the button held say nothing, since holding fire
  shoots once and then charges.
- **Action entropy**, from Talakat: the information entropy of the first,
  second and third derivatives of the action sequence, here for the two
  movement channels (left/right, jump), pooled over every run and normalised by
  the support each derivative could have. Committed to restless. Fire is left
  out of it so the two axes don't measure the same thing. Talakat used the
  feature to characterise levels by how an agent had to play them; here it
  characterises agents by how they choose to.

A 10 × 10 grid; each cell keeps its best controller. After Talakat's
**Constrained** MAP-Elites, each cell also keeps a small pool of infeasible
controllers ranked by how far they are from feasible - here mostly by how far
over the size limit. An oversized controller that plays better than its cell's
elite is kept, not discarded, and the repair operator is asked to shorten it.

### Variation: the LLM as operator

The loop is AlphaEvolve's: a prompt sampler builds a prompt from the archive,
an LLM ensemble proposes a change, an evaluation cascade scores it, the
archive takes it or not, many steps in flight at once.

- **Prompt sampler.** The parent's code and score, its result on every run,
  ASCII maps of the places its runs most often ended (for a fall, centred on
  where it last stood, since that is where the mistake was), inspiration
  programs from the archive - the best so far, and one from a distant
  playstyle - with their scores, and the archive map itself so the model can
  see which styles are thin.
- **Output.** Diffs as SEARCH/REPLACE blocks for targeted changes, whole
  programs for rewrites, as in AlphaEvolve. A diff must match exactly once.
- **Operators**, at ELMER's three mutation strengths and then some:
  `tweak` (small diff aimed at the most frequent failure), `improve` (medium:
  reflect on the failure record, work out the cause, change the logic -
  ProFiT's self-modification step), `rewrite` (large: from scratch, same
  playstyle), `crossover` (two parents from different cells, with both sets of
  results), `steer` (move the parent into an empty neighbouring playstyle, to
  grow the map), `repair` (make an infeasible controller feasible), and `init`
  (from scratch, aimed at a random cell, used to seed the search).
- **Ensemble.** A fast model for most calls and a strong model for a share of
  them, more for rewrites and crossover - AlphaEvolve's Flash/Pro split.
- **Cascade.** Static checks, then two 300-frame smoke runs that catch code
  that throws or hangs, then the full set of training runs.

### Where the ideas came from

| from | what was taken | how directly |
|---|---|---|
| AlphaEvolve | evolutionary database + prompt sampler with inspirations and rich feedback; SEARCH/REPLACE diffs and full rewrites; fast/strong LLM ensemble; evaluation cascade; many proposals in flight | direct |
| Talakat (Khalifa, Lee, Nealen, Togelius 2018) | Constrained MAP-Elites, with a feasible elite and an infeasible pool per cell; the action-entropy feature as a behaviour dimension; a bounded program representation | direct; entropy measured as in `tools/agent/skills.js`, written when the paper was read earlier |
| ProFiT (Siper et al., GECCO 2026) | strategies as standalone programs mutated by an LLM; the program's own performance record fed back for a self-modification step (`improve`); judging on data selection never saw | from a search summary only - see below |
| ELMER (Siper, Khalifa, Togelius 2026) | mutation strength as an explicit low/medium/high dial; a natural-language description travelling with each program (`// intent:`) | from a search summary only |

arxiv.org is blocked from the environment this was built in, so ProFiT and
ELMER were read only through search-engine summaries, not the papers. What is
attributed to them above is what those summaries say, plus one inference: that
a trading-strategy search judges strategies out of sample, which is the
discipline the held-out starts here follow. If either paper does something
materially different, that row is wrong and the operator design is mine.

## Results

Two runs, `runs/main` and `runs/main2`. Full detail:
`node tools/evo/report.js --run=main2 --lineage=best`.

| | run 1 (`main`) | run 2 (`main2`) |
|---|---|---|
| training set | 12 starts/stage, 1 seed each: 21 runs | 16 starts/stage, 3 seeds each: 81 runs |
| started from | 3 hand-written seeds | run 1's elites, re-scored |
| children / cost / time | 400 / $7.24 / 31 min | 300 / $7.25 / 35 min |
| cells filled (of 100) | 36 | 41 |
| best train / held-out | 1.000 / 0.930 (three tied at 1.000) | 0.998 / 0.962 |
| overfitting, all elites | 0.037 | 0.018 |
| overfitting, top 5 | 0.070 | 0.027 |
| real game, top 4 by train | beat it 43% of the time | beat it **65%** |

Overfitting is the elites' train-minus-held-out gap less the seeds' own gap,
which is what the two sets' difference in difficulty alone produces.

### The real game

`fullgame.js` plays the actual game - stage 1 to the final boss through the
real flow, three lives, fresh seeds - with the controller on the pad during
play. 50 games each, the same seeds for every controller. (Train and held-out
are each on their own run's starts, so compare those columns within a run.)

| controller | train | held-out | beats the game | deaths/game |
|---|---|---|---|---|
| run 2 `c0165` | 0.982 | **0.973** | **39/50** | 2.24 |
| run 2 `c0216` | 0.994 | 0.961 | 32/50 | 2.76 |
| run 1 `c0168` | 0.998 | 0.956 | 31/50 | 3.14 |
| run 2 `c0125` | 0.981 | 0.954 | 31/50 | 2.76 |
| run 1 `c0210` | 1.000 | 0.956 | 29/50 | 3.40 |
| run 2 `c0287` | 0.998 | 0.962 | 27/50 | 2.86 |
| run 1 `c0204` | 1.000 | 0.952 | 19/50 | 3.76 |
| run 1 `c0139` | 1.000 | 0.930 | 6/50 | 4.16 |
| any seed | 0.49-0.61 | - | 0/20 | - (none clears stage 1 more than 3 times in 20) |

What this showed:

- **Run 1's training set saturated.** Three controllers scored a perfect
  1.000 and selection could not rank them; the one it put first is the worst
  of them in the real game.
- **Varying start positions was not enough; seeds matter too.** The
  commonest killer for every controller is one lava pit early in stage 2. Run
  1's training set crossed it once, from one start, under one seed, and that
  crossing succeeded. Three seeds per start in run 2 cut the deaths there by
  about a third and lifted real-game completion from 43% to 65%.
- **The held-out score predicts real play; the training score does not.**
  `c0165` was third in run 2 on training but first on held-out starts, and it
  is the best player in the real game. Rank correlation of real-game wins with
  held-out quality is +0.95 within run 1 and +0.40 within run 2; with training
  quality it is -0.77 and -0.40. Four controllers per run is a small sample,
  but the direction is the same in both: among controllers that all score
  near the top on training, the training score is mostly selection noise.
- The stage 3 boss is now the other main killer, after the stage 2 pit.

### Playstyles

Both maps put the best controllers at low entropy (0.10-0.20) and moderate
aggression (0.2-0.6, one to two and a half shots a second): run, take full
committed jumps, shoot a little, and in a boss arena hold mid range facing the
boss, rapid-fire and hop incoming shots. Pure runners (aggression 0) do worse
because bosses must be shot; heavy gunners (over 0.7) do worse because
stopping to shoot costs ground.

The high-entropy end of the map was reached mostly by **injecting
randomness**: elites there describe "randomised hop lengths" and "random
stutters". The cheapest way for a model to raise action entropy is noise, so
past about 0.25 the axis measures deliberate jitter as much as a way of
playing. Nothing reached entropy above 0.35 or aggression above 0.9.

### The operators

- **Steering rarely hits its target** - 2 of 85 and 2 of 55 children landed in
  the cell asked for, missing by about 3 cells on average - but it filled more
  new cells than any other operator in run 1. The model cannot dial in a
  statistic of its own input sequence; it can reliably move somewhere new.
- **Stepping stones**: run 2's champion descends through two steering steps
  that each made it worse (-0.23 and -0.09) on the way to new playstyles,
  followed by a crossover that reached 0.998. Run 1's best real-game player
  scored *below* its parent and survived only because it landed in an empty
  cell. A search that kept only improvements would have lost both.
- The strong model succeeds more often per call (improve: 55% vs 26-28%;
  crossover: 23-47%) and is the only one with positive mean quality change on
  most operators; the fast model is 4-10× cheaper per success. Crossover and
  strong rewrites produced the biggest single jumps.
- The LLM output is reliable: 98-99% of answers parsed and ran. Diffs failed
  to apply 2 and 7 times; 3 children crashed.
- **The size limit started to bind in run 2.** Median child size went from
  2850 to 3360 characters, the top elites sit at 3450-3950, and 8 of 293
  children went over - against 2 of 398 in run 1. The infeasible pool and
  repair operator were barely exercised in run 1 and are starting to matter.

## Files

| file | |
|---|---|
| `SPEC.md` | the controller contract; also the LLM's system prompt |
| `headless.js` | the real game in a Node vm context |
| `parity.js` | proves headless == browser |
| `sandbox.js` | controller containment, observation, episode runner, scoring, static checks |
| `sandbox-test.js` | containment and robustness tests |
| `tasks.js`, `tasks.json` | verified train and held-out test starts |
| `worker.js`, `pool.js` | evaluation workers with a hard deadline |
| `archive.js` | constrained MAP-Elites |
| `prompts.js` | the prompt sampler and operators |
| `llm.js` | the CLI call, diff application, program extraction |
| `evolve.js` | the loop |
| `report.js` | reading a run |
| `eval.js` | scoring controller files |
| `fullgame.js` | playing the real game through, three lives, fresh seeds |
| `seeds/` | three hand-written starting controllers |
| `runs/NAME/` | `archive.json`, `log.jsonl` (every child), `config.json`, `elites/` |
