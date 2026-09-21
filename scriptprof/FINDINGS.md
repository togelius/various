# Findings

Notes from building out the Python layer against the vendored PuzzleJAX
engine. Written for whoever picks this up next; `PLAN.md` is the research
plan, this is what actually happened when the code met the corpus.

## Four bugs made solver solutions unreplayable

Rule coverage is the signal the plan leans on hardest: it is the check GAVEL
could not perform in Ludii, and it is what separates "the search found a way
through" from "the mechanics work as intended". It is computed by replaying a
solver's action list and recording which rules fire. That replay did not
reproduce what the solver did, for four independent reasons. The fourth only
became visible once the first three were fixed, and only against the full
corpus.

**`again` ticks were not settled on replay.** A rule suffixed with `again`
asks the engine for another turn, which is how PuzzleScript expresses gravity,
spreading fire and sliding blocks. The C++ solvers settle those ticks after
every action; the raw `process_input` binding does not. Any game using the
keyword replayed into a different state than the search reached. **304 of the
952 corpus games use `again` in a rule**, so this was the common case.

**`restore_level` left per-turn state behind.** A backup holds the object grid
and nothing else, but the engine also carries a command queue, an `again` flag
and a cached win flag. The searches restore a parent board before trying each
sibling action, so a win detected on one branch stayed visible to the next. It
surfaced whenever a winning successor was discarded by the "already seen this
board" guard, which skips the win check along with the state.

**The searches discarded winning actions before testing for a win.** An action
that changed no tiles was skipped by a `!changed` guard placed before the win
check. But a rule can win by issuing the `win` command without moving
anything. Angize is won by pressing ACTION, and nothing moves.

Together these produced confidently wrong answers rather than errors. Angize
was reported solved with the action list `[0, 0]`, which does nothing at all;
the real solution is a single ACTION. Any fitness computed for such a game was
built on a replay that never reached the win state.

**`load_level` and `restore_level` disagreed about an already-won board.**
Some levels satisfy their win conditions before any move. `load_level` set the
win flag hard-false without consulting the board, while the fix above made
`restore_level` recompute it. A search restores a board before each action, so
it saw the win; a replay only loads, so it did not. The search credited the
win to whichever action it tried first, and that one-move solution replayed to
nothing. This was every solved level of Flood and Hitori. Searches now report
a zero-move win when a level starts won, so callers can treat it as the
degenerate level it is.

All four are fixed in `vendor-patches/script-doctor.patch` and
`prof/engine.py`, with regression tests. The restore fix recomputes the win
state on every restore rather than trusting the cache, which costs about 4.5%
of search throughput (23.3k against 24.5k expansions per second on the
benchmark games). Recomputing only when the cached flag is already set would
recover most of that and still rule out phantom wins, at the price of a
subtler invariant; the flat version was kept while correctness is the thing
being established. Across the whole corpus every solver solution now replays
to a win: 4053 validated, zero deterministic mismatches. The census
replays every solution it finds and reports the mismatches, so a future
disagreement between search and engine shows up as a number instead of as
quietly wrong coverage.

## The solvers did not honour their time budget

The search loops consulted the clock every 1000 expansions, which assumes an
expansion is cheap. In games whose rules loop heavily one expansion takes tens
of milliseconds. Breadth-first search on `5_step_steve_DEMAKE` ran for **77.8
seconds under a 1 second budget**, stopping at exactly 1000 expansions.

Every "levels hitting the time budget" figure was therefore measured against a
budget the solver was not keeping, and one pathological game could occupy a
census worker for minutes. The patch replaces the fixed stride with a poller
that measures how long expansions actually take and retunes itself. Slow
searches converge on checking every iteration, fast ones settle on a stride
wider than 1000 and so poll less than before. The same 180k expansions take
the same time to within run-to-run noise.

## The engine is not safe to run in the evaluation loop

`1D_Rubik's_Cube` segfaults the C++ engine inside `load_level`. Separately,
the `again` settle loop in C++ has no cap, so a rule that keeps requesting
another turn spins forever inside a single expansion, where the solver's
timeout cannot reach it because the timeout is only consulted between
expansions.

Either one kills a MAP-Elites run outright, and a mutation operator is far
likelier to produce such a game than a human designer is. Candidates are now
evaluated in a child process under a wall-clock cap
(`prof.fitness.evaluate_isolated`), and a child that dies or overruns is
reported as an unfit game with the signal or timeout recorded. This costs a
few seconds per candidate against a fraction of one; `--in-process` restores
the faster behaviour where the caller knows the input is safe.

The `again` settle loop in the C++ solver is capped at 1000 ticks, the same
limit `prof.engine.step` uses, so a search and a replay of it stop together.
Trusted callers can evaluate in-process without a rule that never settles
taking the process with it. A game that segfaults the engine still cannot.

## A grammatical mutation operator is a strong baseline

The plan has the fine-tuned model as WP1 and treats structural edits as the
thing it must beat. On the evidence so far that is the right framing but the
baseline is stronger than expected.

Ten operators edit the source directly: delete, reorder, redirect or re-time a
rule, flip a force token, switch a win condition between `all` and `some`, and
swap, retile, drop or duplicate a level. Crossover grafts a donor rule into a
recipient, but only when the recipient already declares every object the rule
names.

On five human games, **99 of 100 mutations that applied compiled**; the
hundredth was a no-op, reported as such rather than returned as a child. All 8
eligible crossovers among those games compiled. A generation of four
candidates takes about a second, against one to eleven minutes per candidate
for the Ollama operator in the iMac's smoke run.

So the LLM's contribution has to be measured as *quality per unit time*, not
as compile rate, where it is behind by three orders of magnitude of throughput
and cannot win on validity. The interesting question is whether its children
land in archive cells the grammatical operator cannot reach. That comparison
is now a single flag: `--operator {grammar,llm}`.

Flipping a force token deserves a note. Turning `>` into `<` inside a rule is
how pushing becomes pulling, which is exactly the inverted-Sokoban case
PuzzleJAX raises as a test of out-of-distribution reasoning. The operator
produces those games for free.

## The insight gap separates the reference games correctly

`prof/players.py` implements the plan's tier-6 fitness term without a GPU. Five
players run over a level: random actions, a greedy agent hill-climbing the
engine's own distance-to-win heuristic (the same signal the PuzzleJAX paper
hands its PPO agents, so it fails the same way), then greedy best-first, A* and
breadth-first search. The gap is the fraction of the two myopic players that
fail on a level some search solves.

| game | search | greedy | gap |
|---|---|---|---|
| `sokoban_basic` level 0 | solves | fails | 1.00 |
| `slidings` level 0 | solves | fails | 1.00 |
| `kettle` level 0 | solves | solves in 4 moves | 0.33 |

That ordering matches the paper: Sokoban's deadlocks defeat greedy reward
maximisation, Kettle's four-move solutions do not. The gap is relative to the
players available, which is deliberate: as better players arrive it tightens,
which is the mechanism WP4 needs to keep finding harder games.

It is off by default in `prof.fitness.evaluate` because it costs a few
thousand engine steps per level. Pass `insight=True`, or `--insight` to
`prof.evolve`.

## The corpus census, and what the descriptors say

The full run, against the fixed engine: 952 games, 926 compiling, 7733
playable levels, 4140 solved by breadth-first search inside 100k expansions or
5 seconds. 168 games have every level solved. 14 games exhaust the 300 second
per-game wall clock and 12 fail to compile.

**Every solution replays.** Of 4053 solutions with an action list, zero
deterministic games disagree with the engine. The 61 remaining mismatches are
all in games with `random` rules, where search and replay draw from different
RNG states, which is the limitation PuzzleJAX names for its own validation.

**87 solved levels are won before any move.** A `no X` win condition where X
only appears once the player acts, and similar. They are degenerate as
puzzles whatever the engine scores them, and `prof.fitness` counts them as
unsolved for that reason. Worth knowing that the corpus contains them: a
generator rewarded for solvability will find this exploit if the fitness
function does not exclude it.

**The default MAP-Elites descriptors are too coarse.** 926 human games land in
76 of the 100 cells of the default grid (rule count against mean solution
length), about twelve games per occupied cell. GAVEL's criterion was the
smallest archive that still separates distinct games, and this does not meet
it: the archive cannot tell most human games apart, so a search over it cannot
be credited with finding a genuinely new region.

A two-dimensional PCA projection of the 75-feature concept vector, binned 40
by 40 as GAVEL bins Ludii concepts, puts the same games in 555 cells, about
1.7 games per cell. That is the resolution the plan's WP3 needs, so the projection is now what
`prof.evolve` uses by default, fitted by `prof.corpus_features` and read from
`data/census/pca.json`. `--descriptors grid` restores the old axes for
comparison.

The first two components explain 29% of variance, which is close to the ~28%
GAVEL reports for Ludii concepts on a different corpus in a different
description language. They read cleanly:

- **PC1 is mechanical complexity**: rule count, object count, how many rules
  create or clear objects.
- **PC2 is puzzle depth**: solution length, level count, number of win
  conditions, fraction of levels solved.

That second axis is close to what the fitness function is trying to measure,
which is mild evidence the concept vector captures the right things.

## What to do next

1. **Validate the metrics against human judgement.** Everything above is
   internally consistent but nothing is yet checked against whether people
   enjoy the games. That is WP2's real deliverable and it needs the itch.io
   metadata and a designer panel.
2. **Run the operator comparison.** Grammatical versus Ollama versus a
   frontier model, same seeds, same budget, measured on archive coverage
   rather than compile rate.
3. **Upstream the engine fixes.** The four replay bugs, the timeout bug, and
   the `again` cap are in the vendored PuzzleJAX code, not in anything
   specific to this project. They affect anyone using its solvers to validate
   solutions.
