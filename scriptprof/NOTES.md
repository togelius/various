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

### What PuzzleJAX is actually good for

Measured before building on it, because the answer decides the architecture.

| | trace/compile | throughput |
|---|---|---|
| C++ engine (via `prof.engine`) | 0.07 s | 49k states/s |
| PuzzleJAX, small board (5x7x6) | 1.8 s | 167k states/s |
| PuzzleJAX, larger board (8x13x15) | 6.3 s | 9.6k states/s |

So PuzzleJAX is about 3.5x faster per state on small games and *slower* than
the C++ engine on large ones, and every game pays 2-10 s of tracing. For plain
breadth-first search from a level's start, it is not a win on CPU. Break-even
against the C++ engine is around 120k states.

The decisive advantage is elsewhere, and it is large:

- **Batched rollouts.** 512 parallel 80-step random playouts in one scan call.
- **Many levels at once.** `vmap` over `PJParams.level` runs 256 *different*
  levels through one compiled step function at 79k level-steps/s. One trace,
  many levels. This is what makes solver-in-the-loop level generation possible.
- **Search from arbitrary states.** The C++ engine searches from a level's
  start. PuzzleJAX can take a hundred arbitrary states and sweep them all
  breadth-first together, which is what the deadlock and fatal-move metrics
  need and what nothing else here can do.

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

### Open questions

- No itch.io or rating metadata is vendored, so there is no external signal to
  validate the depth metrics against. The substitute experiment: at matched
  solvability and solution length, do human games score differently from random
  mutants? If the metrics cannot tell those apart they are measuring nothing.
- 17 corpus games still fail the round trip. They are excluded from seeding.
- One game (`FROWN_INVERSION_SQUAD`) segfaults the C++ engine, and 16 exceed
  the wall-clock cap. Not chased.
- PuzzleJAX's `gbfs` uses the engine's built-in heuristic, which is a
  Manhattan-distance aggregate over win conditions. For games whose win
  condition is not spatial it is close to uninformative, which weakens the
  insight metric exactly where puzzles are most abstract.
