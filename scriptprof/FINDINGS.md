# Findings

Notes from building out the Python layer against the vendored PuzzleJAX
engine. Written for whoever picks this up next; `PLAN.md` is the research
plan, this is what actually happened when the code met the corpus.

## Three bugs made solver solutions unreplayable

Rule coverage is the signal the plan leans on hardest: it is the check GAVEL
could not perform in Ludii, and it is what separates "the search found a way
through" from "the mechanics work as intended". It is computed by replaying a
solver's action list and recording which rules fire. That replay did not
reproduce what the solver did, for three independent reasons.

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

All three are fixed in `vendor-patches/script-doctor.patch` and
`prof/engine.py`, with regression tests. Across the sample games every solver
solution now replays to a win, on all three search algorithms. The census
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

The underlying `again` loop in the C++ is still uncapped. Capping it upstream
would be worth doing, and would let trusted callers stay in-process.

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

## What to do next

1. **Validate the metrics against human judgement.** Everything above is
   internally consistent but nothing is yet checked against whether people
   enjoy the games. That is WP2's real deliverable and it needs the itch.io
   metadata and a designer panel.
2. **Cap the `again` loop in the C++ engine** so trusted callers can evaluate
   in-process and get the throughput back.
3. **Run the operator comparison.** Grammatical versus Ollama versus a
   frontier model, same seeds, same budget, measured on archive coverage
   rather than compile rate.
4. **Upstream the engine fixes.** All three replay bugs and the timeout bug
   are in the vendored PuzzleJAX code, not in anything specific to this
   project. They affect anyone using its solvers to validate solutions.
