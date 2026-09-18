# SCRIPTPROF

A lab for generating puzzle games. Open `scriptprof/index.html`.

PuzzleScript is a language of local rewrite rules over a 2D grid. One line of
it is enough to define Sokoban:

```
[ > Player | Crate ] -> [ > Player | > Crate ]
```

Whenever a player tries to walk into a crate, the crate inherits that force.
The rest of a game is objects, a collision layering, win conditions, and a
handful of levels. The whole thing fits in a page of text, compiles in a
browser, and is small enough that a breadth-first student can mark it.

ScriptProf is a self-contained instrument for that loop, built from three
papers:

- **[ScriptDoctor](https://arxiv.org/abs/2506.06524)** — generate a
  PuzzleScript program, compile it, playtest every level with BFS, feed the
  errors and the search trace back in. A trial succeeds when the script
  compiles and every level admits a solution.
- **[GAVEL](https://proceedings.neurips.cc/paper_files/paper/2024/hash/c7b04e4e13bb77996d3ae2ff667231ac-Abstract-Conference.html)**
  — treat a language model as a mutation operator inside MAP-Elites, so the
  search keeps a grid of diverse, playable games rather than a single best
  script.
- **[PuzzleJAX](https://arxiv.org/abs/2508.16821)** — the same rewrite rules
  are a benchmark: a unified observation and action space over an open-ended
  family of human games, fast enough to sit an exam on every mutant.

ScriptDoctor's own conclusion asks for this wrapping: take the compile and
BFS metrics and put them in a novelty-seeking evolutionary loop. That is
the lab. The mutation operator here is grammatical rather than neural —
every child still compiles, which is the point of mutating a gene rather
than a string. The slot is the same one GAVEL used for a fine-tuned model.

## Playing

Arrows (or WASD, or HJKL, or swipe) move. **Z** undoes, **R** restarts,
**N** is the next level, **Enter** runs the solver and replays what it
found. **EVOLVE** fills a MAP-Elites grid of solution-length × mechanic
count; click an elite to play it.

The six human-authored seeds are the few-shot prior: a Sokoban of papers
and desks, the same game with pull, a match-3 of citations, a maze with no
rules at all, a rake that paints every tile you stand on, and a swap gene.

## Inside

No build, no server, no dependencies.

| | |
|---|---|
| `js/parser.js` | PuzzleScript subset → AST → emit |
| `js/engine.js` | compile, tick, collision, late rules, win conditions |
| `js/search.js` | BFS playtester (ScriptDoctor's student) |
| `js/evolve.js` | gene mutations + MAP-Elites (GAVEL's archive) |
| `js/games.js` | the human-authored seeds |
| `js/ui.js` | the lab |

The engine is a subset: relative arrows, `NO`, `late`, four-way rotation,
`All X on Y` / `Some` / `No` wins, and ASCII levels. No ellipses, no
`again`, no rigid bodies, no random. Enough to run the seeds, enough to
evolve new ones, not a replacement for PuzzleJAX.

## Testing

```sh
node scriptprof/test/check.js
```

Parser, push/pull/block, BFS on every seed, and a short evolutionary run
that has to leave at least one playable elite in the archive.

## Python layer (`prof/`)

The browser lab above is a subset engine. The research pipeline in `PLAN.md`
runs on the real thing: the original PuzzleScript compiler and the C++ engine
and solvers from the [PuzzleJAX / script-doctor](https://github.com/smearle/script-doctor)
repository, vendored under `vendor/` by `tools/setup_vendor.sh` (which also
applies `vendor-patches/` — rule-firing counters in the C++ engine).

| | |
|---|---|
| `prof/engine.py` | compile via Node (`tools/compile_cli.js`), C++ BFS / A* / GBFS, replay, rule coverage |
| `prof/concepts.py` | static concept vector (text + compiled state), the descriptor space |
| `prof/fitness.py` | hierarchical fitness: compiles, solvable, non-trivial, coverage, progression |
| `prof/mutate.py` | LLM mutation operator through a local Ollama model, with compile-error repair |
| `prof/evolve.py` | MAP-Elites over games, resumable archive under `data/evolve/` |
| `prof/players.py` | player ladder (random, greedy, GBFS, A*, BFS) and the insight gap |
| `prof/grammar_mutate.py` | structural mutation and crossover, no model needed |
| `prof/census.py` | corpus census: every scraped game compiled, every level searched |
| `tests/` | `vendor/script-doctor/.venv/bin/python -m pytest -q tests` |

```sh
tools/setup_vendor.sh                                    # once
vendor/script-doctor/.venv/bin/python -m prof.census     # ~1 h on 10 cores
vendor/script-doctor/.venv/bin/python -m prof.evolve --seeds sokoban_basic kettle --gens 10
```
