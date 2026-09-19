# Working notes

A running log of the overnight session on generating novel PuzzleScript games.
Newest section last. Numbers here are measured on this machine (Apple silicon,
10 cores, 34 GB, no GPU) unless stated otherwise.

---

## 2026-09-18/19: PuzzleJAX, structural mutation, depth metrics, MAP-Elites

### Where things stood

The census had finished all 933 scraped games but the derived report and the
concept vectors still described the first 131, so both were regenerated first.
904 games compile, 7667 playable levels, 3942 solved by breadth-first search
within budget, 155 games solved end to end.

The Python pipeline could evaluate a game but could only *make* one through a
language model served by Ollama, at roughly a minute per mutation. That is the
binding constraint on everything else: if a mutation costs sixty seconds and an
evaluation costs five, making evaluation faster buys nothing.

### First PuzzleJAX measurements

Taken before building on it, because the answer decides the architecture.
(Superseded in part by the end-to-end benchmark further down, which is the
number to trust; these are per-state rates on a warm compilation.)

| | trace/compile | throughput |
|---|---|---|
| C++ engine (via `prof.engine`) | 0.07 s | 49k states/s |
| PuzzleJAX, small board (5x7x6) | 1.8 s | 167k states/s |
| PuzzleJAX, larger board (8x13x15) | 6.3 s | 9.6k states/s |

So PuzzleJAX is about 3.5x faster per state on small games and *slower* than
the C++ engine on large ones, and every game pays 2-10 s of tracing. Even
taken at face value, break-even against the C++ engine is around 120k states.

One thing dominates all tuning: **every jitted call must use the same batch
shape**. A ragged frontier chunk retraces the step function, and tracing costs
seconds, so the first version of the batched search ran at 15 expansions per
second — entirely inside the XLA compiler. Padding frontier chunks to a fixed
width and masking took it to 150k.

### Structural mutation instead of a language model

`prof/grammar.py` parses a game into objects, legend, collision layers, rules,
win conditions and levels, and writes it back. Two parser traps, both of which
silently corrupt games rather than failing loudly:

- PuzzleScript comments nest and span lines. Stripping them per line leaves the
  tail of a two-line comment behind, and in the RULES section that tail parses
  as a bogus rule. This alone accounted for most early round-trip failures.
- The OBJECTS section does not need blank lines between objects; plenty of
  games run them together. Boundaries have to be found structurally from
  sprite-row width, and the width test is what stops an object *named* `1`
  (2048 names tiles after their values) being eaten as a one-pixel sprite row.

Round-trip over the corpus: **887 of 904 games (98.1%)** parse, re-emit and
still compile with the same level count. As a safety net, a section no mutation
touched is reproduced from source verbatim, so the risk of any edit is confined
to the section it changed.

`prof/mutations.py` holds the operators. Nineteen mechanic **templates** (push,
pull, gravity, growth, key-and-lock, one-way gates, and running one of the
game's own rules backwards) bind named roles to real objects under
PuzzleScript's collision-layer rule that two objects in one cell must sit on
different layers. Around them sit perturbation operators over rules, objects,
win conditions and levels.

Measured over 40 corpus games and 800 edits:

| | |
|---|---|
| children that compile | 96.6% |
| cost of one mutation | 864 us |
| end-to-end with compile check, 9 workers | 55 edits/s |

That is roughly 3000x the LLM operator's rate, and the compile rate is above
the 30-90% ScriptDoctor reports for frontier models writing whole games. Worst
operator is `swap_tiles` at 80%; the mechanic templates sit at 96%.

### Metrics that are not "breadth-first search found an exit"

`prof/depth.py`. The complaint being answered is ScriptDoctor's own and
PuzzleScript's author's: solvability scores a corridor exactly as highly as an
idea, so a generator rewarded on solvability produces corridors.

- **random floor** — does uniform-random play win? Any level it beats has no
  puzzle in it.
- **insight** — breadth-first search solves it; does greedy best-first on the
  win-condition heuristic? When it does not, some correct move looked locally
  wrong. This is relative to a specific weak player on purpose; the same slot
  takes a learned policy later.
- **fatal structure** — at each state on the optimal path, how many of the
  other four moves reach a state with no win left? A level where nothing is
  fatal is a corridor; where everything is fatal it is a guessing game. The
  interesting quantity is *concentration*, reported as `key_moves` and a Gini
  coefficient over the path.
- **deadlock** — the same question from the endpoints of random walks.

**A trap worth recording, because the first version fell into it.** Fatality is
judged by a bounded search, so a state further from the goal than the horizon
looks fatal in every direction and means nothing. The first run reported
Sokoban level 1 as having 21 key moves and 100% deadlock; both were artefacts
of asking a 12-move question about a 33-move solution. Now only path positions
within the horizon are probed, and deadlock is left explicitly unmeasured
(`-1`) on levels whose solution already exceeds it. Corrected, the same level
reports 5% fatal moves with a Gini of 0.82: danger is rare and concentrated,
which is what a hand-made Sokoban should look like.

### Novelty

`prof/novelty.py` scores a game by mean distance to its 15 nearest human
neighbours in the 75-dimensional concept space of all 904 corpus games, divided
by the corpus' own median such distance. So 1.0 means "as far from its
neighbours as a typical human game is". This measures conceptual distance, not
quality: a game with eleven unused objects scores well, which is why it is a
bonus term next to the depth metrics and never a fitness on its own.

### The loop

`prof/qd.py` is MAP-Elites over a four-axis archive: rule count, mean solution
length, object count, and `churn` (rule right-hand sides that create or destroy
objects). The fourth axis is the only one that is not a size measure, and it is
what separates games that rearrange a board from games that change its
contents.

Evaluation is tiered, which is what makes the JIT tax affordable:

- **tier 1, every candidate** — compile, breadth-first solve, rule coverage,
  level progression. About 0.1 s, no JAX.
- **tier 2, elites only** — the PuzzleJAX depth metrics, a few seconds each.

Measured throughput: **3.6 candidates/s on 9 workers, 96% compiling**, so about
13k evaluations an hour.

### Running now

Two 200k-iteration runs, 4 workers each, seeded from 90 human games spread
across the corpus:

- `data/evolve/novel` — novelty weight 0.4
- `data/evolve/control` — novelty weight 0.0

Same seeds, same operators, same descriptors. The question is whether rewarding
distance from the human corpus produces archives that are further from it
without being worse, or just produces junk.

### What PuzzleJAX is good for, measured rather than assumed

The premise was that PuzzleJAX speeds things up. Benchmarked against the honest
alternative -- the C++ engine with all candidate levels compiled into *one*
game, so its compile cost is paid once -- the answer is narrower than that.

`prof.bench`, 64 candidate Sokoban levels, 7x7:

| method | seconds | levels/s | solved |
|---|---|---|---|
| PuzzleJAX batched, cold | 16.3 | 3.9 | 11 |
| PuzzleJAX batched, warm | 11.2 | 5.7 | 11 |
| C++, one game, serial | 5.4 | 12.0 | 22 |

A batch is only as fast as its slowest member. Every level in the frontier runs
to the same depth, while the C++ solver drops each level the moment it wins, so
a population where most levels solve in six moves still pays for twenty-six.
Batching would win that back on a GPU, where a layer is one kernel rather than
many; on this CPU it does not.

Worse, and this is the finding that actually constrains the design: **PuzzleJAX
unrolls every rule into the traced graph, so its cost scales with rule count
and the C++ engine's does not.**

| | trace | throughput |
|---|---|---|
| `sokoban_basic`, 1 rule | 1.8 s | 170k states/s |
| an evolved descendant, 25 rules | 166 s | 456 states/s |

Evolution adds rules. So the JAX path is least affordable exactly where the
search spends its time. Structural analysis is now gated on rule count, which
took one evolved game from 229 s to 3.7 s.

What remains PuzzleJAX-only, and is worth the tax where it applies:

- **Search from arbitrary states.** The C++ engine searches from a level's
  start. Taking a hundred arbitrary states and sweeping them breadth-first
  together, each tagged with the root it came from, is what the fatal-move and
  deadlock metrics need and nothing else here can do.
- **Many levels through one compilation.** `vmap` over `PJParams.level` runs
  256 different levels at 79k level-steps/s off a single trace.

So the split is: C++ for anything that starts at a level's start, PuzzleJAX for
anything that does not, and a rule-count gate in front of the second.

### Three silent bugs

All three produced plausible numbers rather than errors, which is why each cost
an hour.

**The engines number actions differently.** The C++ port follows the JavaScript
engine (up, left, down, right, action); PuzzleJAX uses (left, down, right, up,
action). A solution found by one and replayed in the other does something else
and never wins. Downstream this read as "every alternative move on the solution
path is fatal" -- on every game measured. The fix is five characters of lookup
table; finding it took a direct replay test.

**Levels of one game need not share a state shape.** PuzzleJAX pads a level to
the board only when it already fits, so a game can hold a 9x9 level and a 10x10
one. Keying the compiled-expander cache on board dimensions handed the second
level's states to the first level's compiled function, failing inside XLA with
an error naming neither.

**`background_char` returned the commonest tile.** In a Sokoban that is the
wall, because the border is solid, so every generated level came out a brick.
It resolves the bottom-collision-layer symbol now.

### The fatal-move metric was measuring its own budget

First real numbers out of the structural half said 98-100% of alternatives are
fatal on evolved games. That is an artefact, not a finding. Fatality is decided
by a capped breadth-first probe, and on a game with wide branching the cap
prunes away wins that exist.

The check is cheap and decisive. States on the optimal path are known to be
winnable inside the horizon -- that is how the probed positions were chosen --
so probe those too and see whether the search re-finds what it was handed.

| | path re-solved | verdict |
|---|---|---|
| `sokoban_basic` | 100% | trustworthy: 5% fatal, Gini 0.86 |
| 25-rule evolved child | 9-18% | pruning, reported as unmeasured |

Levels failing the check now report the fatal fields as unmeasured rather than
as findings, and aggregation skips them. Checking the path first also lets the
probe bail before doing five times the work on a game it cannot judge.

The lesson generalises: any metric defined by a bounded search needs a case
where the answer is known in advance, or it will confidently report the shape
of its own budget.

### Does novelty pressure help? (n=1, so: suggestive)

Two runs, identical but for the novelty bonus, compared at matched evaluation
counts with the bonus subtracted back out so both are scored on the same
objective. Final state, 4196 evaluations each:

| | cells | playable | QD | beyond corpus |
|---|---|---|---|---|
| novelty weight 0.4 | 139 | 94 | 29.7 | 56 |
| novelty weight 0.0 | 141 | 82 | 26.4 | 23 |

Equal coverage, 15% more playable elites, higher QD on the shared objective,
and 2.4x as many games outside the human cloud. Rewarding distance from the
corpus did not cost quality here. The ordering held at every checkpoint from
700 evaluations onward, which is more reassuring than the endpoint alone, but
it is still one run per arm with different seeds and a mid-flight bug fix in
both. A reason to run replicates, not a result.

### Does the depth metric see design? No. (the main negative result)

The honest headline of the night. 50 human games, 149 mutants matched on the
thing ScriptDoctor would have accepted -- every probed level solvable by
breadth-first search -- and then asked whether the metrics still tell them
apart. "Higher" is the fraction of pairs where the human game scores above its
own mutant, so 50% is a coin flip.

| metric | human | mutant | human higher | pairs |
|---|---|---|---|---|
| insight | 0.057 | 0.062 | 48% | 149 |
| random-play wins | 0.156 | 0.220 | 45% | 149 |
| solution length | 18.9 | 16.2 | 58% | 149 |
| search effort | 2038 | 1471 | 54% | 149 |
| fatal-move fraction | 0.023 | 0.025 | 53% | 46 |
| danger concentration | 0.268 | 0.250 | 53% | 46 |
| key moves | 0.118 | 0.185 | 48% | 46 |
| deadlock fraction | 0.044 | 0.051 | 48% | 46 |

Nothing clears 58%. **At matched solvability, these metrics cannot tell a
designed game from a random mutation of it.** The fitness function built on
them is, on this evidence, mostly decoration.

Three things are worth separating out of that.

**The insight metric had no variance to work with, and that turned out to be a
design error I could fix.** It sat at 0.057 for humans and 0.062 for mutants.
Looking at why: across all 350 solved levels in the sweep, the "greedy" player
failed **zero** times and found the optimal solution on 82% of them.

That is not a weak player. The C++ `solve_gbfs` is greedy in its *ordering* and
is still a complete search with an open list, so it always finds a solution
eventually. A metric defined as "search succeeds where the weak player fails"
cannot discriminate when the weak player never fails.

`Level.hill_climb` is the player it should have been: look at the five
successors, step to the best by heuristic, never revisit a state, give up when
every neighbour is worse or seen. No backtracking, no open list, so a level
needing a move away from the goal defeats it. On `sokoban_basic` it fails level
0 and solves level 1, giving insight 1.00 and 0.00 for two levels of the same
game where the old measure gave 0.00 for both.

It is wired in but **not re-validated at scale** -- the calibration sweep above
predates it, and rerunning it is the first thing to do next. The numbers in the
table are the old player's.

**The random-play floor leans the right way and is too weak to use.** Mutants
are beaten by random play more often than their parents (0.220 against 0.156),
which is the expected direction, but only 55% of pairs order correctly.

**The structural rows have a third of the sample.** Only 46 of 149 pairs had
measurements the survival probe could vouch for, because of the rule-count
gate and the reliability check. Their 53% is measured on less evidence than
the rest, not more.

What this does *not* show: that the metrics are meaningless in general. The
comparison is deliberately hard, since a mutant that survives the solvability
filter is by construction not obviously broken, and the sample is one mutation
or two from the parent rather than a different game. It does show that these
metrics cannot currently carry the weight the fitness function puts on them.

### Which operators earn their place

`prof.opstats --from-run` reads a finished run's log and asks, per operator,
how often its children took an archive cell. 10047 applications from the
novelty run; 14% took a cell overall.

| operator | tried | took a cell | playable | mean fitness |
|---|---|---|---|---|
| `command` (append win/again/cancel) | 296 | 25% | 47% | 0.31 |
| `negate` (add a `no X` guard) | 292 | 24% | 58% | 0.40 |
| `add_win` | 447 | 23% | 53% | 0.41 |
| `template` (inject a mechanic) | 1436 | 15% | 55% | 0.35 |
| `add_object` | 952 | 14% | 42% | 0.29 |
| `swap_object` | 837 | 8% | 44% | 0.35 |
| `remove_object` | 323 | 8% | 27% | 0.23 |

Two readings, and they matter differently.

"Took a cell" partly measures how far an operator moves the descriptor vector,
and three of four descriptor axes are size measures, so anything that changes
rule or object count fills cells cheaply. That is coverage, not quality. The
mean-fitness column is the quality reading, and on both together `negate` and
`add_win` are the clear wins while `remove_object` is the clear loss: it is
destructive, and a quarter of its children are still playable.

The templates sit in the middle at 15% and 55% playable. Middling is fine for
them -- they are the only operator that adds a mechanic the game did not have,
so their job is reach, not hit rate.

I have **not** reweighted the operators on this. Both arms of the novelty
comparison are mid-flight and changing the operator distribution underneath
them would confound the only controlled experiment running. The reweighting is
a next step with the evidence already gathered, not a change to make at 2am
with runs in progress.

### The novelty term got gamed, and it looked like success

The top-scoring elite in the novelty run had earned part of its score by adding
`Some Background` to its win conditions. Twice.

The background fills every cell, so the condition is always true and changes
nothing about play. It does change the concept vector, which is where novelty
is measured, so a search paid for novelty learns to emit it. Deleting both
copies leaves the game's fitness at 0.631, exactly where it was: proof they
were no-ops.

This is the failure mode `PLAN.md` section 7 predicts, and two things about how
it showed up are worth keeping:

- It took about nine thousand candidates to appear.
- It appeared at the *top* of the ranking. A metric being gamed looks exactly
  like the metric working, so the only way to catch it was to read the actual
  games rather than the leaderboard.

Fixed in the operator and in `repair`, so it cannot re-enter from any path.
Both runs were restarted to pick it up, which does change the search mid-
experiment -- but equally in both arms, and leaving a known pathology in place
to protect the tidiness of an n=1 comparison would be the wrong trade.

### Does the generated archive hold up in real PuzzleScript?

Yes, on the sample checked. Every solution the C++ solver found for a
*generated* game also wins when replayed in the original JavaScript engine
(6 of 6 levels), against 95.7% for human corpus games. Small sample, but it is
the check that matters most for the output: a generated game whose solution
only works in the port is not a game.

### Two operational hazards, both of which cost an hour

**Orphaned helper processes accumulate silently.** The vendored
Python-to-JavaScript bridge spawns a `node` process per Python process, and it
survives the death of the process that started it. Across a night of pool
restarts, 124 of them were holding 3.7 GB. Separately, `kill -9` on a
multiprocessing parent leaves its workers running: 36 orphans, 1.9 GB, two of
them at 60% CPU doing nothing. Neither shows up as a failure; both just make
everything slower, and `uptime` reports a load average of 120 that is mostly
idle processes.

The obvious cleanup -- "kill anything whose parent is pid 1" -- is wrong, and
I ran it: a `nohup`ed job *also* has pid 1 as its parent, so the sweep killed
the live polish run along with the orphans. Identify orphans by age or command
line, not by parentage.

### What came out: `data/archive/`

27 games, from 60 archive elites put through the finishing pass. Each one:

- compiles with the original PuzzleScript engine;
- has every probed level solvable by breadth-first search;
- is never won by random play;
- has at least 60% of its rules firing on a solution path;
- carries a provenance header naming the human game it descends from, its
  author, and the chain of mutations that made it.

20 of the 27 kept levels regenerated against their own rules rather than
inherited from a parent. Four sit more than 1.1 corpus-spacings from their
nearest human neighbours.

**Every one of them was validated in the engine the language is defined by.**
All 66 solved levels across the 27 games replay to a win in the original
JavaScript engine, not just in the C++ port the search runs on.

Alongside the sources: `play/` holds a self-contained HTML file per game that
runs offline in a browser, and `gallery.html` shows all 27 with their levels
rendered, their measurements, their lineage and their nearest human
neighbours.

What the bar does **not** certify is that these are good games. Nothing here
measures fun, the depth metrics do not distinguish design from mutation (see
above), and the shipped set was scored without the structural half because
PuzzleJAX tracing on evolved games is unaffordable. What it certifies is that
they work, that a person can play them, and that nothing in them is dead.

### Merged with a parallel line of work

A second session had been working on the same project and pushed 15 commits to
main while this branch ran. The two lines barely overlap in files -- different
module names for the same ideas -- so only five files conflicted, all data or
documentation. Kept both sides.

What came across that this branch did not have, and should have:

- **`again` ticks were not settled on replay.** A rule suffixed with `again`
  asks for another turn, which is how PuzzleScript expresses gravity, sliding
  and spreading. The C++ solvers settle those ticks; the raw `process_input`
  binding does not, so anything replaying an action list outside a solver was
  playing a different game. 304 of 952 corpus games use it. My random-play
  floor in `prof.depth` and `prof.levelgen` did exactly that and now goes
  through their `prof.engine.step`.
- **`restore_level` leaked per-turn state**, so a win detected on one search
  branch stayed visible on the next.
- **The C++ solvers ignored their time budget** on slow games: a 1s cap could
  run for 78s.

Re-validated after merging. The archive still replays at 100% in the original
JavaScript engine, and on a 30-game corpus sample the one solution that
previously did not win there now does: 0 disagreements, down from 1. The four
of their tests that failed before were a stale vendor build, not a merge
problem; rebuilding the C++ extension against their patch fixes all four.
85 tests pass.

Two implementations of the grammatical mutation operator now sit side by side
(`prof/mutations.py` and their `prof/grammar_mutate.py`), and two of the weak
player (`prof/depth.py` and their `prof/players.py`). Picking one of each, on
evidence, is a job for daylight.

### What I would do next, in order

1. **Replicate the novelty comparison.** Three seeds per arm, same wall clock.
   One run each is not a result, and the effect is the only steer we have on
   how hard to push away from the corpus.
2. **Get a GPU.** Every disappointing PuzzleJAX number here is a CPU number.
   The batched primitives are written and tested; on a GPU the layer expansion
   is one kernel and the level-vmap is free, which is where the design was
   supposed to pay off. Worth measuring before concluding anything about the
   approach rather than the machine.
3. **A better weak player than greedy-on-Manhattan.** The insight metric is
   only as good as the player it beats, and PuzzleJAX's built-in heuristic is
   a distance aggregate over win conditions, so it is close to uninformative
   exactly where puzzles are most abstract. A small learned policy in that
   slot is the co-evolution step in `PLAN.md` and would sharpen the metric
   most where it is weakest now.
4. **Let the level generator drive rule design.** It currently polishes a game
   after the fact. A mutation operator that proposes a rule *and* the level
   that shows it off would stop the search from filling the archive with
   mechanics that never fire.

### Open questions and known holes

- No itch.io or rating metadata is vendored, so there is no external signal to
  validate the depth metrics against. The substitute is the matched-mutant
  sweep above.
- 17 corpus games still fail the round trip. They are excluded from seeding.
- One game (`FROWN_INVERSION_SQUAD`) segfaults the C++ engine, and 16 exceed
  the wall-clock cap. Not chased; `prof.pool` makes them survivable rather
  than fixed.
- The structural metrics only apply to games under the rule-count gate, which
  is a minority of what evolution produces. Their coverage is reported
  (`reliable_levels`) rather than papered over, but it is a real limit on how
  much of the archive can be judged on depth.
- MAP-Elites descriptors are three size axes and one mechanic axis. Three of
  four being size measures means the archive spreads mostly by scale, which is
  not the diversity anyone wants. A learned descriptor over the corpus would
  be better and is `PLAN.md` WP2.
