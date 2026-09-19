"""Do the depth metrics see anything a human designer put there?

There is no rating data vendored with the corpus, so the depth metrics in
``prof.depth`` cannot be validated against human judgement directly.  This is
the substitute, and it is a fair test: take a human game, mutate it until the
mutant is *also* fully solvable by breadth-first search, and ask whether the
metrics still tell them apart.

Matching on solvability is what makes it fair.  Both members of a pair compile,
both have every probed level solved, and often both have similar solution
lengths -- so anything that separates them is structure rather than
brokenness.  If the metrics cannot separate them, they are not measuring
design, and the fitness function built on them is decoration.

    .venv/bin/python -m prof.calibrate --games 24 --mutants 3 --workers 3

Reports each metric's human mean, mutant mean, and the fraction of pairs where
the human scores higher, which is the rank statistic that does not care about
the metrics' arbitrary scales.
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SUMMARY = ROOT / "data" / "census" / "summary.csv"
ROUNDTRIP = ROOT / "data" / "roundtrip.json"
OUT = ROOT / "data" / "calibration.json"

METRICS = ["insight", "fatal_frac", "fatal_gini", "key_moves",
           "deadlock_frac", "random_win_frac"]


def _depth_dict(text: str, max_levels: int) -> dict[str, Any] | None:
    from prof.depth import analyse

    d = analyse(text, max_levels=max_levels)
    if d.error or d.solved == 0:
        return None
    return d.to_dict()


def pair(job) -> dict[str, Any]:
    """One human game and up to ``n_mutants`` matched, still-solvable mutants."""
    name, n_mutants, max_levels, tries, seed = job
    from prof import engine as E
    from prof.fitness import evaluate
    from prof.grammar import Game
    from prof.mutations import mutate

    rng = random.Random(seed)
    text = (GAMES / f"{name}.txt").read_text(encoding="utf-8", errors="replace")
    base = _depth_dict(text, max_levels)
    if base is None:
        return {"game": name, "skip": "human game not measurable"}
    try:
        parent = Game.parse(text)
    except Exception as e:  # noqa: BLE001
        return {"game": name, "skip": f"parse: {type(e).__name__}"}

    muts: list[dict[str, Any]] = []
    for _ in range(tries):
        if len(muts) >= n_mutants:
            break
        child, ops = mutate(parent, rng, n_ops=rng.choice([1, 1, 2]))
        if not ops:
            continue
        src = child.emit()
        # match on the thing ScriptDoctor would have accepted: every level solved
        try:
            ev = evaluate(src, max_iters=40_000, timeout_ms=2500, max_levels=max_levels)
        except Exception:  # noqa: BLE001
            continue
        if ev.tier < 3:
            continue
        d = _depth_dict(src, max_levels)
        if d is None:
            continue
        d["ops"] = ops
        muts.append(d)
    if not muts:
        return {"game": name, "skip": "no matched mutant found"}
    return {"game": name, "human": base, "mutants": muts}


def corpus(n: int, rng: random.Random, max_rules: int = 60) -> list[str]:
    """Fully-solved human games small enough to analyse in reasonable time."""
    broken = set()
    if ROUNDTRIP.exists():
        broken = {r[0] for r in json.loads(ROUNDTRIP.read_text())}
    rows = [r for r in csv.DictReader(SUMMARY.open())
            if r["compiled"] == "1" and r["random"] == "0"
            and int(r["n_levels"]) > 0
            and int(r["n_solved"]) == int(r["n_levels"])
            and r["game"] not in broken]
    names = [r["game"] for r in rows]
    rng.shuffle(names)
    return names[:n]


def report(results: list[dict[str, Any]]) -> None:
    pairs = [r for r in results if "human" in r]
    skipped = [r for r in results if "skip" in r]
    n_mut = sum(len(r["mutants"]) for r in pairs)
    print(f"\n{len(pairs)} human games with {n_mut} matched mutants "
          f"({len(skipped)} games skipped)")
    if not pairs:
        for r in skipped[:8]:
            print(f"  {r['game'][:40]:42s} {r['skip']}")
        return
    print(f"\n{'metric':18s} {'human':>9s} {'mutant':>9s} {'human higher':>13s}")
    for m in METRICS:
        hs, ms, wins, total = [], [], 0, 0
        for r in pairs:
            h = r["human"].get(m, 0.0)
            hs.append(h)
            for mu in r["mutants"]:
                v = mu.get(m, 0.0)
                ms.append(v)
                total += 1
                wins += int(h > v) + 0.5 * int(h == v)
        frac = wins / max(total, 1)
        flag = "  <--" if abs(frac - 0.5) > 0.15 else ""
        print(f"{m:18s} {np.mean(hs):9.3f} {np.mean(ms):9.3f} {100 * frac:12.0f}%{flag}")
    print("\n50% means the metric cannot tell a designed game from a mutant of it.")

    # which operators most often survive the solvability filter?
    ops: dict[str, int] = {}
    for r in pairs:
        for mu in r["mutants"]:
            for o in mu.get("ops", []):
                k = o.split(":")[0]
                ops[k] = ops.get(k, 0) + 1
    if ops:
        top = sorted(ops.items(), key=lambda kv: -kv[1])[:10]
        print("\noperators surviving the match: "
              + ", ".join(f"{k} {v}" for k, v in top))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=24)
    ap.add_argument("--mutants", type=int, default=3)
    ap.add_argument("--tries", type=int, default=14)
    ap.add_argument("--max-levels", type=int, default=2)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    rng = random.Random(a.seed)
    names = corpus(a.games, rng)
    print(f"{len(names)} candidate games, {a.workers} workers", flush=True)
    jobs = [(n, a.mutants, a.max_levels, a.tries, a.seed + i) for i, n in enumerate(names)]
    results = []
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        futs = [ex.submit(pair, j) for j in jobs]
        for i, f in enumerate(futs):
            try:
                r = f.result()
            except Exception as e:  # noqa: BLE001
                r = {"game": jobs[i][0], "skip": f"crash: {type(e).__name__}"}
            results.append(r)
            tag = "ok" if "human" in r else r.get("skip", "?")
            print(f"  [{i + 1}/{len(jobs)} {time.time() - t0:.0f}s] "
                  f"{r['game'][:40]:42s} {tag}", flush=True)
    OUT.write_text(json.dumps(results, indent=1))
    report(results)
    print(f"\nraw -> {OUT}")


if __name__ == "__main__":
    main()
