# Evolving Tall Order controllers

An LLM-driven MAP-Elites search for **controllers written as code** that climb the
tower in [Tall Order](../). The game is not modified: everything goes through the
`window.tallOrder` test hook, in headless Chromium, with the game stepped by hand
(no rendering, no audio), so one start plays out in roughly 0.3 s.

```
cd tall-order/evolve
npm i -g playwright            # or have `require('playwright')` resolve (Chromium is expected to be installed)
node evolve.js --name run1 --gens 30 --batch 4 --models haiku:0.6,sonnet:0.4
```

Options: `--backend claude-cli|anthropic|mock` (`claude-cli` runs `claude -p`;
`anthropic` needs `ANTHROPIC_API_KEY`; `mock` perturbs constants, for testing the
loop with no LLM), `--max-chars` (controller size limit, default 3500),
`--starts` (training starts per epoch, 12), `--heldout` (unseen starts, 36),
`--epoch-gens`, `--lib-every`, `--minutes`, `--resume`. Output goes to
`runs/<name>/`: `map.txt` (the archive), `elites/` (one file per cell),
`best.js`, `heldout.json`, `archive.json`, `log.jsonl`.

## A controller

A script defining `function step(o, m)`, called ten times a second. It sees a
compact observation `o` (own state, where the goal marker for this floor is,
foes with bearing/distance/height and whether each is inside the 12° aim band,
incoming shots, pickups, inventory, drop distances ahead/left/right) and returns
`{turn, move, fire, jump, use, sel}`: the same inputs as the touch stick and
buttons. `m` is persistent memory. The full spec is in `prompts.js` (`BRIEF`),
which is also what the LLM reads.

**Size limit:** 3500 characters and 110 lines per controller. Static checks also
ban `while`/`do`, globals, `eval`, and unbounded `for`; each candidate is smoke-run in a
`vm` with a timeout before it touches the browser. (This keeps honest LLM output
from hanging a page; it is not a security sandbox, and a worker that hangs anyway
is killed and replaced.)

## Not overfitting to a starting position

Controllers do not always start at the bottom. A *start* is a floor (stratified, two
per floor per epoch), a random clear position on that floor, a random heading, hp
40–100, a random 0–2 starting pickups, the checkpoints below it already reached, and
a seeded game RNG. The training set of 12 starts is **redrawn every epoch** (default 3 generations):
at each epoch boundary every elite is re-scored on the fresh set, and cells are
re-contested on those scores, so a controller that only worked from one spot loses
its cell. Children are scored on the current set, the same one as the incumbent they
compete with. A separate **held-out set** (36 starts, fixed seed) scores the whole archive every few
generations and at the end; it is never used for selection, so the train/held-out gap
is the overfitting measure.

## Quality and the map

- **Quality** = progress up the tower from where the start was: `(highest height stood on − start height) / (flag height − start height)`,
  1.0 for reaching the flag, averaged over starts. Each start has a time budget
  (40 s + 22 s per floor still to climb). Nothing rewards kills, style or speed directly.
- **Map (MAP-Elites, 6 × 6):**
  - rows: **pace**, mean walking speed ÷ full speed (standing … sprint);
  - columns: **trigger**, share of control ticks with the fire button held (hold fire … spray).
  Descriptors are averaged over every epoch a controller has seen, so they are as steady as the score.
  Walking back to bring a foe into the aim band, running past toys, and standing and shooting
  all land in different cells.

## What was taken from where

From **AlphaEvolve**: programs are the genome; a parent plus *inspirations* from other cells, plus the
evaluator's feedback (per-floor progress, deaths and what killed it, where it stalled, runtime
errors) go in the prompt; mutations are mostly SEARCH/REPLACE *diffs* with some full rewrites;
a cheap static/smoke stage runs before the expensive one; an ensemble of models (fast for
breadth, strong for depth); and a small *meta-prompt* bandit: each mutation carries an instruction ("fix where it is stuck",
"dodge telegraphed attacks", "simplify", …), and instructions that produce archive
improvements are sampled more often.

From **Profit** (Siper, Khalifa, Togelius: continual abstraction discovery): every few
generations the LLM looks at the best controllers and proposes small reusable helper
functions. They go in an **append-only helper library** that is prepended to every
controller and is offered to later mutations. Append-only, and checked against every elite
(it must still compile with each), so adding helpers can never change what an existing elite
does. It has its own size cap, so it is where shared structure accumulates, while the per-controller
cap keeps each controller small. `log.jsonl` records whether children call the helpers.

From **Talakat** (Khalifa et al.: constrained MAP-Elites with feasible/infeasible handling):
candidates that break a constraint (too big, bad syntax, forbidden construct, runtime error)
are not discarded; they go to an infeasible pool, and a fraction of generations *repair*
one (the prompt states the violation), and a repaired controller is then
evaluated and may enter the map. Mutations also aim at empty cells next to the parent's, giving the LLM a target playstyle.

## Files

| | |
|---|---|
| `driver.js` | runs inside the page: start sampler, observation, action application, episode loop, metrics |
| `worker.js`, `pool.js` | one headless Chromium per worker process; hung workers are killed |
| `validate.js` | size cap, forbidden constructs, `vm` smoke test |
| `archive.js` | MAP-Elites grid and descriptors |
| `prompts.js` | game brief, API spec, mutation / crossover / repair / library prompts, diff parser |
| `llm.js` | `claude -p`, Anthropic API, and mock backends |
| `evolve.js` | the loop |
| `seeds/` | hand-written starting controllers (`walker`, `runner`, `gunner`) |

## Caveats

- The checkpoint-arrival swarms are skipped for starts above the bottom (the checkpoints are marked reached).
- Starts are on floors 0–5; none begin partway up the crane.
- Evaluation noise: 12 starts is small, hence the per-epoch re-scoring rather than trusting one score.

## First run (`runs/run1`)

30 generations x 4 children (96 children evaluated, 25 min on 4 cores; `claude -p` with haiku 60% / sonnet 40%), starting from the three
hand-written seeds (training scores 0.06 to 0.28; none of the seeds survives in the final archive).

- The map filled 20 of 36 cells. Best controller on 36 unseen starts: 0.43 progress, reaching the flag in 7 of 36 (`runs/run1/best.js`
  is the best-on-training one at 3330 characters; every elite is under the 3500 cap).
- Archive-mean score on unseen starts is 0.277, against 0.251 on the training starts, so no sign of overfitting to start positions
  (a small run: 36 starts, one seed, noisy; the best-of-archive numbers move by about 0.05 between checks).
- The helper library grew to six functions (`steerTo`, `nearestHittable`, `shotDanger`, `stuckTicks`, ...); 60 of 96 children call one.
- Mutation instructions that worked most often: `boss` 9/10, `simplify` 7/9, `novel` 4/5; `survive` 0/2, `fight` 1/4.
- Repair of infeasible candidates produced a map entry 14 times out of 21.

## Longer run (`runs/run2`)

Continued from run1's archive: 6 children per generation, 1251 log entries, 1034 evaluated controllers in total, about 3.5 hours
of wall time on 4 cores. The container restarted at generation 129 and the run was resumed from `archive.json`
(`--resume`), so the log has a seam there. The second part ran 112 minutes.

- The map has 29 elites (of 36 cells). The best elite reaches the flag on 27 of 36 unseen starts (held-out progress 0.86;
  the best held-out value seen at any check was 0.92). Four more elites win on 24 or more of the 36. The mean over all elites is lower, because
  slow and standing cells hold weak controllers: 0.25 of unseen starts won on average.
- Archive-mean held-out progress rose from 0.277 (run1) to about 0.45 before the restart, then **plateaued around 0.45 to 0.51**
  for the last two hours (seven checks: 0.48, 0.47, 0.46, 0.51, 0.49, 0.45, 0.49, 0.51, 0.51, 0.50). Longer running improved the top of the map but not the
  mean; what the later hours bought was mostly filling and polishing cells.
- Train and held-out stay close (0.514 vs 0.496 at the end; the gap changes sign between checks), so no sign of overfitting to start positions.
  This is one seed and 36 held-out starts.
- Helper library: 10 functions, 1771 of 1800 characters, so it is full. Elites are at most 3449 characters.
- Operators (accepted / tried, where accepted means a map entry): diff mutation 208/549, full rewrite 55/196, crossover 59/315, repair 58/200.
  Diffs were the most productive per try. Crossover was the least.
- Mutation instructions (accepted / tried): `tune` 54/120, `simplify` 45/97, `special` 42/104, `survive` 35/76, `stuck` 30/86, `boss` 29/84,
  `memory` 26/71, `novel` 24/79, `items` 23/80, `fight` 14/61. The differences are mostly small, and the counts include repeat entries.

Still untested: a second seed, a run without per-epoch resampling (to measure what it buys), and whether the plateau is the
3500 character cap, the full helper library, or the LLM's mutations.
