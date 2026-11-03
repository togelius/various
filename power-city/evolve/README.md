# Evolving POWER CITY controllers

MAP-Elites over controller *source code*, with an LLM as the variation operator.
Everything is plain node; the game runs headless in a `vm` (about 0.2 s per
3000-frame episode), no browser.

- `headless.js`  loads the game with a stub canvas; one fresh world per episode
- `episode.js`   one run: controller source + start scenario -> progress, playstyle telemetry
- `evolve.js`    the archive, prompts, evaluation, `init / propose / ingest / auto / report`
- `PROMPT_API.md` what the LLM is told about the game and the controller contract
- `seeds/`       the starting controllers; `runs/<name>/` archive, queue, log
- `EXPERIMENTS.md` every experiment, with numbers

## Design
**Controller** `function think(o, mem)` -> `{left,right,up,down,punch,kick,jump}`; max 3000 chars / 110 lines,
`Math` only, 20 ms per call, runs in its own vm context. Oversize, non-parsing or crashing programs are *infeasible*.

**Quality** is progress only: pixels of street won (walking, plus kills inside a locked fight up to half the span to the
next gate, plus the whole stage on clear) from the start position, divided by what was left of the stage. One life,
3000-frame (50 s) budget, so speed counts.

**Start positions vary** (stage, which fight, distance before it, starting hp 100/75/50 %, a pipe on the floor 15 % of the time, RNG seed).
Every incumbent-vs-challenger comparison uses a fresh batch of 6 starts, the same for both. `report` re-scores every elite on 24 fixed held-out starts.

**Behaviour map** (6x6): attacks per second x share of attacks that are not plain jab/cross (hooks, kicks, jump kicks, weapons...).

**From AlphaEvolve**: a database of elites; prompts that carry parents, inspirations from other cells and the evaluator's
per-start feedback; whole-program rewrites; a cheap cascade (stop after the first start if hopeless).
**From Talakat**: constrained MAP-Elites with an infeasible population - too-long or crashing candidates are kept and
sampled as parents for REPAIR prompts rather than discarded.
**Not found**: I could not locate the Profit paper (Siper et al.) so nothing here is taken from it; point me at it.

## LLM backend
`node evolve.js auto <run> <gens> <n>` shells out to `claude -p`. That needs a working CLI login. Otherwise use the
file queue: `propose` writes `queue/genNNN/*.prompt.md`, anything can answer with `*.js`, `ingest` evaluates.
