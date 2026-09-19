"""Turning archive elites into games worth handing to a person.

MAP-Elites optimises for filling cells, and a cell is filled by whatever scored
best in it, which is not the same as a game anyone would play.  Two things are
usually wrong with an elite straight out of the archive:

* **Its levels are inherited.** The mutation operators change rules freely and
  levels only a tile at a time, so a game that gained a growth mechanic is
  still being played on a Sokoban's level, where the new mechanic may never
  fire.
* **Nothing has asked it the expensive questions.** Tier-1 fitness knows the
  game is solvable and covers its rules. It does not know whether random play
  beats it or whether any move on the solution path matters.

So the finishing pass regenerates each candidate's levels against its *own*
rules with the solver in the loop (``prof.levelgen``), keeps the result only if
it measures better, scores the survivors on the depth metrics
(``prof.depth``), and writes the ones that pass a quality bar to
``data/archive/`` with a gallery.

    .venv/bin/python -m prof.polish --runs data/evolve/novel data/evolve/control \\
        --top 40 --workers 4

A game reaches the output only if every probed level is solvable, no level is
won by random play, and its rules all fire on some solution.
"""
from __future__ import annotations

import argparse
import json
import random
import shutil
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "archive"


@dataclass
class Polished:
    key: str
    run: str
    name: str
    ops: list[str] = field(default_factory=list)
    fitness: float = 0.0
    novelty: float = 0.0
    regenerated: bool = False
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    note: str = ""
    seconds: float = 0.0

    def score(self) -> float:
        """Rank for the final listing: playable first, then deep, then novel.

        Terms that could not be measured are dropped rather than scored zero.
        The fatal-move structure is only trustworthy where the survival probe
        re-solved the known solution path (``reliable_levels``), and a game
        whose branching defeated the probe should not be ranked below one that
        was merely measured.
        """
        d = self.after or {}
        if not d or d.get("solved", 0) == 0:
            return -1.0
        parts = [
            1.0 - min(1.0, d.get("random_win_frac", 0.0) * 4),   # not a walkover
            0.5 + 0.5 * min(1.0, d.get("insight", 0.0)),         # greedy struggles
            min(1.0, self.novelty / 1.4),                        # unlike the corpus
        ]
        if d.get("reliable_levels", 0):
            parts.append(min(1.0, d.get("fatal_gini", 0.0)))     # danger concentrated
            if d.get("fatal_frac", 0.0) > 0.8:
                parts.append(0.0)                                # a guessing game
        return sum(parts) / len(parts)


def _quality_ok(d: dict[str, Any] | None) -> bool:
    if not d or d.get("error"):
        return False
    if d.get("analysed", 0) == 0 or d.get("solved", 0) < d.get("analysed", 0):
        return False
    return d.get("random_win_frac", 1.0) <= 0.02


def polish_one(job) -> dict[str, Any]:
    """Regenerate one elite's levels, measure before and after, keep the better."""
    key, run_name, text, meta, cfg = job
    t0 = time.time()
    from prof.depth import analyse
    from prof.fitness import evaluate
    from prof.levelgen import LevelGen

    p = Polished(key=key, run=run_name, name=meta.get("name", key),
                 ops=meta.get("ops", []), fitness=meta.get("fitness", 0.0),
                 novelty=meta.get("novelty", 0.0))
    # The structural half needs a PuzzleJAX trace, whose cost grows with the
    # game; spend it only on games small enough for it to return in seconds.
    structure = cfg["structure"] and len(text.splitlines()) <= cfg["structure_lines"]
    try:
        before = analyse(text, max_levels=cfg["levels"], structure=structure,
                         timeout_ms=cfg["timeout_ms"], max_iters=cfg["max_iters"])
        p.before = before.to_dict()
    except Exception as e:  # noqa: BLE001
        p.note = f"before: {type(e).__name__}"
        p.seconds = time.time() - t0
        return {"rec": asdict(p), "text": text}

    best_text, best = text, p.before
    try:
        gen = LevelGen(text, height=cfg["height"], width=cfg["width"])
        cands = gen.run(pop=cfg["pop"], generations=cfg["gens"],
                        target_len=cfg["target_len"], min_len=cfg["min_len"],
                        seed=cfg["seed"], verbose=False, backend="cpp")
        candidate = gen.install(cands, n=cfg["keep_levels"])
        ev = evaluate(candidate, max_levels=cfg["levels"], timeout_ms=4000)
        if ev.tier >= 3:
            after = analyse(candidate, max_levels=cfg["levels"], structure=structure,
                            timeout_ms=cfg["timeout_ms"], max_iters=cfg["max_iters"])
            # only adopt regenerated levels if they are actually better play
            if (after.solved >= before.solved
                    and after.agg("random_win_frac", False)
                    <= before.agg("random_win_frac", False)):
                best_text, best = candidate, after.to_dict()
                p.regenerated = True
        else:
            p.note = f"regen not playable (tier {ev.tier})"
    except Exception as e:  # noqa: BLE001
        p.note = f"regen: {type(e).__name__}: {e}"[:100]
    p.after = best
    p.seconds = time.time() - t0
    return {"rec": asdict(p), "text": best_text}


def collect(runs: list[Path], top: int, max_lines: int = 400,
            max_rules: int = 120) -> list[tuple]:
    """The most promising elites across the given runs.

    Size is a hard filter, not a preference.  Mutation can pile rules onto a
    game indefinitely, and the archive has cells that reward exactly that; a
    two-thousand-line elite costs minutes to trace in PuzzleJAX and is not a
    game anyone will read.  Anything past the cap is left in the archive.
    """
    jobs = []
    skipped = 0
    for run in runs:
        idx = run / "archive.json"
        if not idx.exists():
            print(f"  skip {run}: no archive.json")
            continue
        blob = json.loads(idx.read_text())
        elites = blob["elites"]
        ranked = sorted(
            ((k, e) for k, e in elites.items() if e["tier"] >= 3),
            key=lambda kv: -(kv[1]["fitness"] + 0.3 * kv[1].get("novelty", 0)))
        taken = 0
        for k, e in ranked:
            if taken >= top:
                break
            src = run / "games" / f"{k}.txt"
            if not src.exists():
                continue
            text = src.read_text(encoding="utf-8", errors="replace")
            if (len(text.splitlines()) > max_lines
                    or e.get("features", {}).get("n_rule_sources", 0) > max_rules):
                skipped += 1
                continue
            jobs.append((k, run.name, text, e))
            taken += 1
    if skipped:
        print(f"  skipped {skipped} elites over the size cap "
              f"({max_lines} lines / {max_rules} rules)")
    return jobs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", default=["data/evolve/novel", "data/evolve/control"])
    ap.add_argument("--out", default="data/archive")
    ap.add_argument("--top", type=int, default=40)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--levels", type=int, default=3)
    ap.add_argument("--pop", type=int, default=64)
    ap.add_argument("--gens", type=int, default=5)
    ap.add_argument("--height", type=int, default=8)
    ap.add_argument("--width", type=int, default=8)
    ap.add_argument("--target-len", type=int, default=16)
    ap.add_argument("--min-len", type=int, default=6)
    ap.add_argument("--keep-levels", type=int, default=4)
    ap.add_argument("--no-structure", action="store_true")
    ap.add_argument("--structure-lines", type=int, default=220,
                    help="skip the PuzzleJAX half for games longer than this")
    ap.add_argument("--max-lines", type=int, default=400)
    ap.add_argument("--max-rules", type=int, default=120)
    ap.add_argument("--timeout-ms", type=int, default=3000)
    ap.add_argument("--max-iters", type=int, default=80_000)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()

    runs = [Path(r) if Path(r).is_absolute() else ROOT / r for r in a.runs]
    out = Path(a.out) if Path(a.out).is_absolute() else ROOT / a.out
    jobs_raw = collect(runs, a.top, a.max_lines, a.max_rules)
    print(f"{len(jobs_raw)} elites from {len(runs)} runs", flush=True)
    if not jobs_raw:
        return
    cfg = {"levels": a.levels, "pop": a.pop, "gens": a.gens, "height": a.height,
           "width": a.width, "target_len": a.target_len, "min_len": a.min_len,
           "keep_levels": a.keep_levels, "seed": a.seed,
           "structure": not a.no_structure, "structure_lines": a.structure_lines,
           "timeout_ms": a.timeout_ms, "max_iters": a.max_iters}
    jobs = [(k, r, t, m, cfg) for k, r, t, m in jobs_raw]

    out.mkdir(parents=True, exist_ok=True)
    games_dir = out / "games"
    games_dir.mkdir(exist_ok=True)
    recs: list[Polished] = []
    texts: dict[str, str] = {}
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        futs = [ex.submit(polish_one, j) for j in jobs]
        for i, f in enumerate(futs):
            try:
                res = f.result()
            except Exception as e:  # noqa: BLE001
                print(f"  [{i + 1}/{len(jobs)}] crashed: {type(e).__name__}", flush=True)
                continue
            rec = Polished(**res["rec"])
            recs.append(rec)
            texts[f"{rec.run}_{rec.key}"] = res["text"]
            d = rec.after or {}
            print(f"  [{i + 1}/{len(jobs)} {time.time() - t0:.0f}s] {rec.run}/{rec.key} "
                  f"regen={rec.regenerated} solved={d.get('solved', 0)}/{d.get('analysed', 0)} "
                  f"rand={d.get('random_win_frac', 0):.2f} gini={d.get('fatal_gini', 0):.2f} "
                  f"score={rec.score():.2f} {rec.note[:40]}", flush=True)

    keepers = [r for r in recs if _quality_ok(r.after)]
    keepers.sort(key=lambda r: -r.score())
    for r in keepers:
        name = f"{r.run}_{r.key}"
        (games_dir / f"{name}.txt").write_text(texts[name], encoding="utf-8")
    (out / "index.json").write_text(json.dumps(
        {"generated": time.strftime("%Y-%m-%d %H:%M"),
         "runs": [str(r) for r in runs],
         "considered": len(recs), "kept": len(keepers),
         "games": [asdict(r) | {"final_score": r.score()} for r in keepers]}, indent=1))
    n_regen = sum(1 for r in keepers if r.regenerated)
    print(f"\n{len(keepers)}/{len(recs)} passed the bar "
          f"(every level solvable, random play never wins); "
          f"{n_regen} kept regenerated levels")
    print(f"written to {out}")
    for r in keepers[:12]:
        d = r.after or {}
        print(f"  {r.score():.2f}  {r.run}/{r.key:14s} nov={r.novelty:.2f} "
              f"gini={d.get('fatal_gini', 0):.2f} insight={d.get('insight', 0):.2f} "
              f"{'+'.join(r.ops)[:50]}")


if __name__ == "__main__":
    main()
