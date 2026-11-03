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
```

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
second: alive, still standing, unhurt), and takes twelve evenly spaced starts
per stage. Alternate starts go to *train* and *test*, plus one boss fight per
stage in each, each run with its own seed: 21 training runs and 21 held-out
runs. Selection only ever sees train. Test scores are computed for elites at
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
  that throws or hangs, then the full 21 training runs.

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

See the bottom of this file after a run, or `node tools/evo/report.js --run=main`.

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
| `seeds/` | three hand-written starting controllers |
| `runs/NAME/` | `archive.json`, `log.jsonl` (every child), `config.json`, `elites/` |
