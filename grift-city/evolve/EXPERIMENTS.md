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

## E2: run2, 63 generations, new sensors, broader quality, longer episodes, helper library (2026-11-04)
Changes since E1: pie-slice sensors (8 x 45 degrees for cars, people, cops, foes), 12 rangefinders, a lane sensor; quality =
story + 0.25 x cash + 0.1 x survival, where story also credits every objective of a job by distance closed (README); episodes of
240 s plus up to 45 s for distance (E1: about 2 minutes); a helper library distilled by the LLM every 4 generations. Quality
numbers are therefore **not comparable with E1's**; E1's elites are re-scored under the new rules below.

Settings: `--gens 300 --minutes 400 --children 4 --batch 5 --epoch 3 --models haiku:0.5,sonnet:0.5 --workers 4 --valEvery 8 --valN 6
--libEvery 4 --density 0.5`. The time limit ended it after 63 generations: 400 minutes, 1659 episodes, about 250 `claude -p`
calls for children plus 15 for the library. Then the held-out reports: 77 minutes (half density, all elites) and 33 minutes
(full density, top four).

* **Candidates**: 252 children; 228 evaluated to the end, 2 stopped by the cascade, 21 infeasible (20 over the size limit), 1
  unparseable reply. 38 filled a new cell, 65 beat an incumbent. Elites are 1679-3989 characters.
* **Operators**: repair 50% success (of 20), crossover 45% (60), mutation 43% (148, and 30 of the 38 new cells). **Models**:
  haiku 47% (108), sonnet 42% (120), 18 new cells each, so the cheaper model is as useful per call. Hints, on 3-39 trials each:
  `violence` (67%, mostly new cells up the trouble axis), `route`, `traffic` best; `survive`, `cops`, `tune` worst.
* **Held-out re-score** (`report.md`: 10 held-out starts, 10 fixed training-distribution starts, half density):

  | | held-out | fixed train | jobs passed (held-out) |
  |---|---|---|---|
  | best elite (g189, 3209 chars) | **1.05** | 0.78 | 3 of 10 |
  | mean of the 17 elites | 0.82 | 0.79 | 16 of 170 in all |
  | E1's best four, re-scored under these rules | RUN1BEST (best) / RUN1MEAN (mean) | | RUN1PASS |
  | walker seed | 0.45 | 0.60 | 0 |
  | driver seed | 0.35 | 0.36 | 0 |

  8 of the 17 elites pass a job on at least one held-out start; 15 of 17 start the job in at least
  9 of 10. The held-out mean is no lower than the fixed-train mean, so there is no sign of overfitting to the training
  neighbourhoods. The ranking is noisy: g189 scored 0.70 on its last training batch and is the best on held-out starts; g221,
  the best on training (1.10, 1.33 fixed), is 0.96 held-out.
* **Full density** (`report-d1-top4.md`): 0.91, 0.88, 0.79, 0.72 for the top four against 0.41 and 0.35 for the seeds; 7 jobs
  passed in 40 runs. A loss of about 0.1 against half density, still about twice the seeds.
* **Sensors in use**: all 17 elites read the pie slices, 16 the rangefinders, 9 the lane sensor. Typical uses: a speed cap from
  the nearest car or person ahead, a nudge away from cars in the front-left and front-right slices, a swerve to the more open
  front rangefinder at a wall, cop avoidance from the cop slices.
* **Library**: 13 helpers accepted at generations 4, 8, 16 and 24 (clamp, stuck, bendSpeed, walkAt, openSide, obstacleCap,
  carWorthIt, parkOut, sliceBearing, nearestPie, copAvoid, driveTo, inTalkRange), 3428 of 3500 characters; every later proposal
  (10) was rejected for size. All 17 final elites call it (openSide and obstacleCap 16 each, bendSpeed and parkOut 14).
* **The map**: 17 of 36 cells (E1: 14), QD-score 14.5 at the end (training batch). Every cell above 1.0 drives most of the way.
  The trouble axis now means what it says: in the elites' last batches the offences were assaults (100), shooting (96), hits
  (85), kills (27) and a few car-jackings and cop kills; 12 of 17 elites have code that fires. Nothing is in the 'rampage' row,
  and the pure walker (on foot, law-abiding) is the weakest cell.
* **Cash**: some elites earn on the way. Two (g217 and g150, the troublemaker cells on foot-ish and mixed) start a handbrake drift on open
  straights when no job timer is running and the police are far, which pays the game's drift bonus; g150 averaged $4000 a start on its last training batch.

Reading: with the new sensors and the longer, more inclusive measure, evolved controllers now pass jobs from unseen
neighbourhoods (none did in E1), at about 2.3x the best hand-written seed on held-out starts, with no train/held-out gap. The
helper library was adopted by every elite but stopped growing at its cap after 24 generations, so it needs pruning or a larger
cap. Finishing jobs reliably is still the headroom (about one held-out run in ten passes).
