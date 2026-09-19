"""Comparing quality-diversity runs at matched evaluation counts.

Two runs started together do not stay together: one crashes and resumes, the
other keeps its workers, and after an hour they differ by thousands of
evaluations.  Comparing their final archives would then measure who got more
compute, not which configuration searches better.

So the trajectory is rebuilt from each run's ``log.jsonl``, which records every
candidate in order, and the runs are compared at the same number of
evaluations.  Reported per run:

``cells``       distinct archive cells filled
``playable``    cells whose elite solves every probed level
``QD``          sum of positive fitness over cells, the standard QD score, with
                the novelty bonus subtracted back out so both runs are scored
                on the same objective -- otherwise the run that was *paid* for
                novelty wins by definition rather than by searching better
``beyond``      cells whose elite sits more than 1.1 corpus-spacings from its
                nearest human neighbours

    .venv/bin/python -m prof.compare --runs data/evolve/novel data/evolve/control
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


def base_fitness(rec: dict[str, Any], weight: float) -> float:
    """Fitness with the novelty bonus removed.

    ``prof.qd`` adds ``weight * clamp(novelty - 1, 0, 1)`` to any candidate that
    reaches tier 3.  Comparing raw QD scores across runs with different weights
    therefore compares two different objectives; subtracting the bonus puts
    both runs back on the plain compile-solve-cover-progress fitness.
    """
    f = float(rec["fitness"])
    if weight and int(rec.get("tier", 0)) >= 3:
        f -= weight * max(0.0, min(1.0, float(rec.get("novelty", 0.0)) - 1.0))
    return f


def trajectory(run: Path) -> list[dict[str, Any]]:
    """Replay a run's log into a per-evaluation archive snapshot series."""
    log = run / "log.jsonl"
    if not log.exists():
        return []
    weight = 0.0
    cfg_path = run / "config.json"
    if cfg_path.exists():
        try:
            weight = float(json.loads(cfg_path.read_text()).get("novelty_weight", 0.0))
        except Exception:  # noqa: BLE001
            weight = 0.0
    best: dict[str, float] = {}
    tier: dict[str, int] = {}
    nov: dict[str, float] = {}
    out = []
    n = 0
    with log.open() as fh:
        for line in fh:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "fitness" not in rec:
                n += 1                      # a failure still consumed a candidate
                continue
            n += 1
            cell = rec.get("cell")
            if cell:
                # selection used the bonused fitness, so an entry that took a
                # cell took it; the score recorded here is the shared objective
                f = base_fitness(rec, weight)
                if cell not in best or f > best[cell]:
                    best[cell] = f
                    tier[cell] = int(rec.get("tier", 0))
                    nov[cell] = float(rec.get("novelty", 0.0))
            out.append({
                "n": n,
                "cells": len(best),
                "playable": sum(1 for c in best if tier.get(c, 0) >= 3),
                "qd": sum(v for v in best.values() if v > 0),
                "beyond": sum(1 for c in best if nov.get(c, 0) > 1.1),
                "mean_novelty": (sum(nov.values()) / len(nov)) if nov else 0.0,
            })
    return out


def at(traj: list[dict[str, Any]], n: int) -> dict[str, Any] | None:
    """The last snapshot at or before evaluation ``n``."""
    hit = None
    for row in traj:
        if row["n"] <= n:
            hit = row
        else:
            break
    return hit


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", default=["data/evolve/novel", "data/evolve/control"])
    ap.add_argument("--points", type=int, default=6)
    a = ap.parse_args()
    runs = [Path(r) if Path(r).is_absolute() else ROOT / r for r in a.runs]
    trajs = {}
    for r in runs:
        t = trajectory(r)
        if t:
            trajs[r.name] = t
        else:
            print(f"no log for {r}")
    if not trajs:
        return
    horizon = min(t[-1]["n"] for t in trajs.values())
    print(f"comparing at matched evaluation counts, up to {horizon}\n")
    marks = [int(horizon * (i + 1) / a.points) for i in range(a.points)]
    width = max(len(k) for k in trajs) + 2
    print(f"{'evals':>8s}  " + "".join(f"{k:>{width + 26}s}" for k in trajs))
    print(f"{'':8s}  " + "".join(
        f"{'cells':>8s}{'play':>7s}{'QD':>8s}{'beyond':>8s}" + " " * (width - 5)
        for _ in trajs))
    for m in marks:
        row = f"{m:8d}  "
        for k, t in trajs.items():
            s = at(t, m)
            if s is None:
                row += " " * (width + 26)
                continue
            row += (f"{s['cells']:8d}{s['playable']:7d}{s['qd']:8.1f}"
                    f"{s['beyond']:8d}" + " " * (width - 5))
        print(row)
    print()
    for k, t in trajs.items():
        s = at(t, horizon)
        cfg = {}
        p = ROOT / "data" / "evolve" / k / "config.json"
        if p.exists():
            cfg = json.loads(p.read_text())
        print(f"{k}: novelty weight {cfg.get('novelty_weight', '?')}, "
              f"final at {horizon} evals -> {s['cells']} cells, {s['playable']} playable, "
              f"QD {s['qd']:.1f}, {s['beyond']} beyond the corpus, "
              f"mean novelty {s['mean_novelty']:.3f}")


if __name__ == "__main__":
    main()
