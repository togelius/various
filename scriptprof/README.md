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

The loop is: mutate a game structurally, judge it cheaply, keep a diverse
archive of the survivors, then finish the best of them with a solver in the
loop and export them as things a person can play.

### Making games

| | |
|---|---|
| `prof/grammar.py` | PuzzleScript as a mutable structure; parse, edit, emit |
| `prof/mutations.py` | 19 mechanic templates, a staged variant that brings the level with the rule, perturbation operators and crossover |
| `prof/levelgen.py` | levels generated against a game's own rules, searched in batch |
| `prof/grammar_mutate.py` | a second structural operator, developed in parallel |
| `prof/mutate.py` | the older LLM operator, through a local Ollama model |

### Judging them

| | |
|---|---|
| `prof/engine.py` | compile via Node (`tools/compile_cli.js`), C++ BFS / A* / GBFS, coverage |
| `prof/pjax.py` | in-memory PuzzleJAX: batched search, including from arbitrary states |
| `prof/fitness.py` | tier 1: compiles, solvable, non-trivial, rule coverage, progression |
| `prof/depth.py` | tier 2: random floor, insight gap, fatal-move structure, deadlock |
| `prof/players.py` | player ladder (random, greedy, GBFS, A*, BFS) and the insight gap |
| `prof/concepts.py` | static concept vector, the descriptor space |
| `prof/novelty.py` | distance from the 904-game human corpus in concept space |

### Searching and shipping

| | |
|---|---|
| `prof/qd.py` | MAP-Elites over a four-axis archive, resumable, survives worker deaths |
| `prof/evolve.py` | the earlier MAP-Elites loop, with PCA archive axes |
| `prof/polish.py` | regenerate an elite's levels, deep-score it, keep it if it improved |
| `prof/standalone.py` | one self-contained HTML file per game, playable offline |
| `prof/explorer.py` | one offline HTML file: play any archived game, touch-first |
| `prof/explain.py` | what a game does, in English, read off its own rules |
| `prof/lineage.py` | reconstructs real ancestry by replaying a run's log |
| `prof/gallery.py` | the archive as a single page: levels, metrics, lineage, source |
| `prof/render.py` | draw a level from its source, no engine needed |

### Measuring the tools themselves

| | |
|---|---|
| `prof/census.py` | corpus census: every scraped game compiled, every level searched |
| `prof/roundtrip.py` | does parse-then-emit preserve compilation? (887 of 904) |
| `prof/opstats.py` | per-operator compile rate and cost (96.6% at 864 us) |
| `prof/bench.py` | PuzzleJAX against the C++ engine on the same work |
| `prof/calibrate.py` | can the depth metrics tell a human game from a matched mutant? |
| `prof/compare.py` | two QD runs at matched evaluation counts |
| `prof/pool.py` | a process pool that survives the engine segfaulting |
| `tests/` | `vendor/script-doctor/.venv/bin/python -m pytest -q tests` |

```sh
tools/setup_vendor.sh                                      # once
V=vendor/script-doctor/.venv/bin/python

$V -m prof.census                                          # ~1 h on 10 cores
$V -m prof.qd --out data/evolve/run --iters 50000 --workers 8
$V -m prof.polish --runs data/evolve/run --top 40          # -> data/archive/
$V -m prof.gallery --run data/archive --play data/archive/play
$V -m prof.explorer                                        # -> data/archive/explorer.html
```

`data/archive/explorer.html` is the one to open on a tablet: the engine inlined
once, all 27 games beside it, swipe or on-screen buttons, and each game's
metrics and full mutation chain back to the human game it descends from.

`NOTES.md` records what was measured and what it changed, including the places
where the obvious approach turned out to be the slower one.
