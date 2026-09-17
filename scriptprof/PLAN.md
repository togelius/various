# ScriptProf: Open-Ended Co-Design of Puzzle Games and Puzzle-Solving Agents

*Research plan, draft 1. Builds on ScriptDoctor, PuzzleJAX, and GAVEL (see `readings/`).*

## 1. One-paragraph pitch

GAVEL showed that a fine-tuned code LLM used as a mutation operator inside a
quality-diversity search can invent genuinely new board games, but its
evaluator (Ludii + MCTS) is slow, cannot see which rules actually fire, and
its dataset is small. ScriptDoctor showed that frontier LLMs can write whole
PuzzleScript games from scratch when grounded by compiler and solver feedback,
but its only quality signal is "solvable by breadth-first search", which
rewards broken mechanics as readily as clever ones. PuzzleJAX showed that
PuzzleScript can run on the GPU at thousands of frames per second, that ~400
human games validate in it, and that puzzle games expose a striking gap:
brute-force search solves what RL and LLM agents cannot. ScriptProf fuses the
three into a single open-ended loop. A **designer** (a PuzzleScript-native
fine-tuned LLM with grammar-constrained fill-in-the-middle mutation, backed by
a frontier reasoning model for repair and brainstorming) proposes games. A
**population of players** (search, RL, and LLM agents running in PuzzleJAX)
evaluates them. The games that survive are the ones that are solvable by
search yet defeat the current learners, and the learners are then trained on
exactly those games. The system's outputs are (a) an archive of novel,
human-playable puzzle games, (b) increasingly general puzzle-solving agents,
and (c) a graded, procedurally extensible benchmark for reasoning in LLMs.

## 2. Research questions

1. **Designer.** Does a PuzzleScript-fine-tuned FITM model with grammar-
   constrained decoding produce valid, novel mutations at higher rates and
   lower cost than few-shot frontier models (ScriptDoctor: 30-90% compile
   rates; GAVEL: ~80% duplicate mutations on training games)?
2. **Evaluator.** Can PuzzleJAX-scale play-testing yield a fitness signal that
   distinguishes deep puzzles from broken or trivial ones? Concretely, does a
   "search-vs-learning gap" metric plus rule-firing coverage predict human
   ratings better than solvability and solution length?
3. **Co-evolution.** Does closing the loop (train players on the archive,
   re-score the archive with the improved players) produce both deeper games
   and more general players than either side alone?
4. **Transfer.** Do agents trained on generated games generalise to unseen
   human games, and does a curriculum of generated games improve LLM
   reasoning-model performance on the PuzzleJAX benchmark where it currently
   sits near 0%?

## 3. Why PuzzleScript is the right substrate

- **Rule-firing is observable.** GAVEL's main failure mode was unused game
  components, undetectable in Ludii. In PuzzleJAX, every rule application is
  an explicit tensor op, so "does this rule ever fire on a solution path" is
  a free byproduct of play-testing. This closes the gap ScriptDoctor
  identified between "solvable" and "works as intended".
- **Larger corpus than Ludii.** ~950 scraped games (414 fully validated), plus
  itch.io metadata (ratings, plays, comments) as weak supervision for quality.
- **Fast, faithful evaluation.** 2x-16x over the JS engine at batch, no
  CPU-GPU round-trip, fully jitted PPO already demonstrated.
- **Whole-game scope.** Rules, levels, objects, and narrative text live in one
  file, so orchestration across facets (Liapis et al.) is a single-string
  mutation problem.
- **Human-relevant.** An active designer community, a public gallery, and a
  known creator's stated worry that search-driven tools push designs toward
  "hard for BFS but boring for people". That worry is our central metric
  design problem, not an afterthought.

## 4. Work packages

### WP0. Infrastructure hardening (months 1-6, continuous)
- Close PuzzleJAX validation gaps: `rigid` keyword, >32-object games, seeded
  randomness aligned with the NodeJS engine, grammar permissiveness. Target:
  >600 fully valid games, >4000 valid levels.
- Instrument rule firing: per-rule, per-step activation logs in the jitted
  step; expose as an observation channel and as a post-hoc coverage report.
- Curate **PuzzleScript-950+**: dedupe, license check, attach itch.io/gallery
  metadata, split into train / held-out-for-seeding / held-out-for-test.
- Better solvers than BFS: A* with win-condition heuristics, IDA*, MCTS with
  learned value nets, and a beam search over a learned policy. BFS's
  all-or-nothing behaviour is the current bottleneck on fitness resolution.

### WP1. The designer model (months 3-14)
- Fine-tune an open code LLM (7B-14B class) on PuzzleScript with GAVEL's
  fill-in-the-middle objective, where spans are grammar nodes from the Lark
  CFG: a single rule, a rule group, a legend line, a level, a win condition,
  or a whole section.
- **Grammar-constrained decoding** (token masking against the CFG) so that
  high-temperature sampling stays syntactically valid. This directly attacks
  GAVEL's memorisation problem: sample hot, stay legal.
- **Crossover**, not just mutation: splice rule groups or objects from a
  second parent, with legend/collision-layer reconciliation done by the model
  in a repair pass.
- **Hierarchical repair loop** from ScriptDoctor: compiler errors and rule-
  coverage reports go to the cheap fine-tuned model first, then to a frontier
  reasoning model only when the cheap model fails N times. Log costs.
- **Level co-generation.** Levels are where ScriptDoctor's LLMs were weakest.
  Add a dedicated level operator: given rules and a target solution length,
  propose a level; verify with the solver; use solver-derived hints (dead-end
  counts, deadlock states) as feedback.
- Deliverable: designer model + ablation study (fine-tuned vs few-shot
  frontier vs frontier+CFG; mutation vs crossover; with/without repair).

### WP2. Fitness and behaviour descriptors (months 4-16)
Hierarchical fitness, GAVEL-style, cheapest checks first:
1. Compiles (CFG + engine).
2. Every level solvable within budget by the best available solver.
3. Non-trivial: solution length, branching factor, number of distinct
   solutions, deadlock density (fraction of reachable states that are
   unwinnable).
4. **Rule coverage**: every rule fires on at least one solution path; no rule
   fires on every step (degenerate).
5. **Level progression**: solver effort and solution length increase across
   levels (mirrors the PuzzleJAX finding that human games ramp).
6. **Insight gap**: the game is solved by search but not by the current best
   RL agent or LLM agent within the same environment-step budget. This is our
   proxy for "requires reframing" and is deliberately relative to the current
   player population, so it moves as players improve.

Behaviour descriptors for the QD archive (PuzzleScript analogue of Ludii
concepts):
- **Static concepts** (~100 booleans from the parsed AST): pushing, pulling,
  gravity, spawning, destruction, teleportation, multiple player objects,
  counters via object stacks, line detectors, randomness, `late` rules,
  win-condition family, level size class.
- **Dynamic descriptors** from PuzzleJAX rollouts: mean solution length,
  fraction of moves that trigger a rule, deadlock density, object-count
  trajectory shape.
- Reduce with PCA or a contrastive embedding trained on the human corpus;
  validate that the archive assigns human games to distinct cells (GAVEL's
  Appendix D protocol).
- Deliverable: metric suite + a study correlating each metric with itch.io
  ratings and with a small expert-designer panel.

### WP3. Quality-diversity search over games (months 10-22)
- MAP-Elites seeded with held-out human games; compare with CMA-MAE and
  novelty-search variants. Bandit selection over *which grammar node type to
  mutate* (GAVEL-UCB) re-examined now that mutation sites are typed.
- Evaluate 10^3-10^4 candidate games per day on one GPU node; report QD score,
  novel-cell occupancy, and fraction of archive that is human-playable.
- Deliverable: the **ScriptProf Archive v1**, a few hundred novel PuzzleScript
  games published to the gallery and itch.io under open licenses.

### WP4. Open-ended co-evolution of players and games (months 14-30)
- **Player population.** Fully jitted PPO agents (already in PuzzleJAX), a
  learned-value MCTS player, and an LLM player with search-derived hints
  ("the solver had to move away from the goal for 12 steps here").
- **Minimal-criterion co-evolution** (POET-style). A game enters the archive
  only if some player solves it and the median player does not. Players are
  trained on a curriculum drawn from the archive, with transfer attempts
  across cells. Games whose insight gap collapses to zero are re-mutated.
- **Anti-degeneracy pressure.** The designer must not win by making levels
  huge. Cap solution length, require solver effort to be concentrated in a
  small number of "key" moves (a measurable proxy for aha-moments: states
  where the optimal move has low prior probability under the learned policy).
- Deliverable: generality study on held-out human games (RQ4); analysis of
  which mechanics the loop invents or rediscovers.

### WP5. Human evaluation (months 18-34)
- Release archive games with a rating widget; collect playtraces, completion,
  and ratings.
- Expert panel of PuzzleScript designers: blind comparison of archive games vs
  human games matched on descriptors.
- Fit a preference model on human data and test it as a drop-in fitness term
  (GAVEL's Section 7 proposal). Measure whether it corrects the "hard for BFS,
  dull for humans" failure.

### WP6. Benchmark release (months 24-36)
- **PuzzleJAX-Gen**: a frozen, graded suite of generated games with verified
  solutions, split by static concept and by insight gap, with a public
  leaderboard for search, RL, and LLM agents.
- Include an "alien semantics" track (inverted Sokoban etc.) to test
  out-of-distribution reasoning, as motivated in PuzzleJAX's ethics appendix.

## 5. Milestones and publication targets

| Month | Milestone | Venue |
|---|---|---|
| 6 | PuzzleJAX v2 + PuzzleScript-950+ + rule-coverage instrumentation | CoG / TOG short |
| 12 | Designer model with CFG decoding; ablation vs frontier models | FDG / CoG |
| 16 | Fitness + descriptor validation against human ratings | AIIDE / TOG |
| 22 | ScriptProf Archive v1 released; QD study | NeurIPS / ICLR main track |
| 30 | Co-evolution results, generality on human games | NeurIPS / ICML |
| 34 | Human study, preference-model fitness | CHI / TOG |
| 36 | PuzzleJAX-Gen benchmark + leaderboard | NeurIPS Datasets & Benchmarks |

## 6. Resources

- **Compute.** Fine-tuning: one 80GB GPU-week per designer model iteration.
  QD + co-evolution: 4-8 GPUs continuously for WP3-WP4 (PuzzleJAX batched
  rollouts; RL sweeps via SLURM as in the PuzzleJAX paper). Frontier-model
  API spend for repair/brainstorm: budget-capped and logged as a metric.
- **People.** 2 PhD students (designer/QD; players/co-evolution), 1
  engineer-postdoc on PuzzleJAX and infrastructure, MS students on human
  evaluation, and collaborators from the three papers.
- **Data/licensing.** Human games are used with existing gallery permissions;
  generated games released under a permissive license with provenance
  (parent games and mutation history) attached to every file.

## 7. Risks and mitigations

- **Fitness gaming.** The designer finds degenerate ways to satisfy metrics
  (stretched levels, rules that fire but do nothing). Mitigate with rule
  coverage, solution-length caps, key-move concentration, and periodic human
  spot checks that update the preference model.
- **PuzzleJAX coverage.** Some mechanics remain unimplemented. Mitigate by
  restricting the designer's grammar to the validated subset early, widening
  as WP0 lands features.
- **Solver ceiling.** If no solver can crack deep games, the insight gap is
  undefined. Mitigate with learned-value MCTS and with accepting
  "unsolved but human-solved" games via WP5 playtraces.
- **Memorisation.** Mitigate as in WP1 (CFG-constrained hot sampling,
  held-out seeding, novelty masks on the mutated span).
- **Designer-community relations.** Engage the PuzzleScript creator and
  gallery maintainers early; publish tools as design assistants first,
  autonomous generation second.

## 8. First 90 days

1. Fork PuzzleJAX; land rule-firing instrumentation and a coverage report.
2. Assemble PuzzleScript-950+ with metadata; re-run validation; publish the
   table of valid games and levels.
3. Extract the FITM dataset from the CFG parse trees; fine-tune a 7B model;
   measure novel-and-valid mutation rate with and without CFG decoding.
4. Implement the first four fitness tiers and the static concept extractor;
   run MAP-Elites for 100 generations from 14 seed games; hand-play the top
   twenty results.
