# Experiments

Newest last. Every entry: what, numbers, cost, what it means. Quality = progress points / 10 (see README); a controller that
walks to the marker and starts the job scores about 0.5, one that then reaches the next objective about 0.6, one that also passes
the job would score 1.1 or more. Held-out = starts in city blocks no training start ever used.

## E0: harness checks (2026-11-03)
* Headless world: about a second to build, about 115 ms of wall time per game second at half density (190 ms at full), 4 cores.
  The same controller on the same start gives the same episode within a process and across processes (`test/evolve.js`).
* Hand-written seeds on 4 training starts: walker 0.33-0.43, driver 0.29-0.42 (the driver arrives at the marker in a car and runs out of time before getting out and walking in).
* A first small run with the offline mock operator exercised the loop; a second with real `claude -p` (3 children, 2 generations) already produced a haiku crossover of the two seeds at 0.50 against 0.29-0.33.

## E1: run1, 30 generations, haiku + sonnet (2026-11-03/04)
Settings: 4 children per generation, a fresh batch of 5 training starts every 3 generations (10 batches), same-batch contests, cascade after 2 starts, size limit 4000 chars / 120 lines, half density, `--models haiku:0.6,sonnet:0.4`. 110 minutes, 749 episodes (about 4 CPU-hours), about 120 `claude -p` calls (~3k-token prompts), no LLM or parse failures.

* **Candidates**: 120 children; 105 evaluated to the end, 2 stopped by the cascade, 13 infeasible (every one over the size limit, so the limit is binding: the elites are 2200-3970 characters). 8 were LLM repairs of infeasible ones (3 entered the map). 23 filled a new cell, 33 beat an incumbent, 49 lost.
* **Operators**: mutation (mostly diffs) 57% success, crossover 44%, repair 38%. **Models**: sonnet 64% (42 children), haiku 46% (63 children); mean child quality is the same (0.52 vs 0.51), sonnet wins more contests. The hint bandit found `memory`, `route`, `job` productive and `survive`, `car`, `stuck` less so, on 1-13 trials each: too few to trust.
* **Held-out re-score** (`report.md`: 10 held-out starts, 10 fixed training-distribution starts, half density):

  | | held-out | fixed train |
  |---|---|---|
  | best elite (g103, 3593 chars) | **0.59** | 0.73 |
  | mean of the 14 elites | 0.50 | 0.52 |
  | best hand-written seed (walker) | 0.33 | 0.45 |
  | driver seed | 0.27 | 0.27 (never started a job in 20 starts) |

  12 of 14 elites start the job in 7-9 of 10 held-out starts (the walker seed: 6, the driver seed: 0). The gap between fixed-train and held-out scores averages 0.02, so little of the gain is tied to the training neighbourhoods. The standard error of a 10-start mean is roughly 0.07-0.1, so the ranking among the top eight is **not** reliable; the gap to the seeds is.
* **Full density** (`report-d1-top4.md`, the 4 best elites, 10 held-out starts): 0.56, 0.53, 0.49, 0.43 against 0.30 and 0.26 for the seeds, so what was evolved at half density transfers to the shipped traffic and pedestrian density.
* **The map** (held-out quality per cell; 14 of 36 cells): `wheels` runs from 0.00 (a pure walker) to 0.86, `trouble` from 0 to 1.4 offences a minute; there is nothing at 'crime spree' or 'rampage', and only one cell in the 'on foot' column (a pure walker). **Reading the trouble axis**: in practice it separates careful drivers from ones that wreck cars (the offences are `killcar`); no evolved controller fires a weapon or attacks anyone, though 20% of starts carry a pistol. It is a measured axis, but not yet a "violent vs peaceful" one.
* **What was not achieved**: **no controller passed a job in any of the 280 held-out and fixed episodes.** What was learned is the part before it: get from any start to the marker (on foot, or by finding a free car, driving the route and getting out), start the job, and carry on to its first objective, in several styles. The best elite's limit is time, not logic: from a typical start it starts SPECIAL DELIVERY at 60 s and then drives at about 15 m/s, so the 800 m delivery does not fit in the 116 s budget. A longer budget, or a score that rewards the distance covered in the job, is the obvious next change.
* **Not general across jobs**: the evolved controllers read keywords from `o.mission.text` (for example `/deliver|crate|pier/`), because the brief describes the three jobs. They generalise across starts, not to jobs the prompt never mentioned.

Reading: the loop, the held-out protocol and the playstyle map work, and LLM-written code beats the hand-written baselines on unseen neighbourhoods by about 1.7x, with the size limit doing real work. The headroom is in finishing jobs, where the signal is sparse. Cost was dominated by simulation, not by the LLM.
