"""Concept vectors for the whole corpus, PCA, and archive-occupancy check.

Reads the census (data/census/raw) for solution statistics, recompiles each
compiled game for its static concepts, and writes data/census/concepts.csv.
Then reports (a) variance explained by the leading principal components and
(b) how many distinct MAP-Elites cells the human games occupy under the
default descriptors, GAVEL's Appendix D protocol.

    .venv/bin/python -m prof.corpus_features
"""
from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import numpy as np

from prof import engine as E
from prof.concepts import KEYS, concepts
from prof.evolve import DEFAULT_DESCRIPTORS

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "census" / "raw"
GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
OUT = ROOT / "data" / "census" / "concepts.csv"
EXTRA = ["mean_solution_len", "max_solution_len", "mean_search_iters", "frac_solved"]


def build() -> list[dict]:
    rows = []
    for p in sorted(RAW.glob("*.json")):
        r = json.loads(p.read_text())
        if not r["compiled"]:
            continue
        src = GAMES / f"{r['game']}.txt"
        if not src.exists():
            continue
        text = src.read_text(encoding="utf-8", errors="replace")
        try:
            state = E.compile_text(text).state
        except Exception:  # noqa: BLE001
            continue
        f = concepts(text, state)
        lv = [l for l in r["levels"] if "error" not in l]
        sol = [l for l in lv if l["solved"]]
        f["mean_solution_len"] = sum(l["len"] for l in sol) / len(sol) if sol else 0.0
        f["max_solution_len"] = max((l["len"] for l in sol), default=0)
        f["mean_search_iters"] = sum(l["iters"] for l in lv) / len(lv) if lv else 0.0
        f["frac_solved"] = len(sol) / len(lv) if lv else 0.0
        f["game"] = r["game"]
        rows.append(f)
    with open(OUT, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["game"] + KEYS + EXTRA)
        w.writeheader()
        w.writerows(rows)
    return rows


def analyse(rows: list[dict]) -> None:
    X = np.array([[row[k] for k in KEYS + EXTRA] for row in rows], dtype=float)
    X = np.log1p(np.clip(X, 0, None))  # counts are heavy-tailed
    X = (X - X.mean(0)) / (X.std(0) + 1e-9)
    U, S, Vt = np.linalg.svd(X, full_matrices=False)
    var = S**2 / (S**2).sum()
    print(f"{len(rows)} games x {X.shape[1]} features")
    print("PCA variance explained:", " ".join(f"{v:.2f}" for v in var[:8]), f"(first two: {var[:2].sum():.2f})")
    for i in range(2):
        top = np.argsort(-np.abs(Vt[i]))[:6]
        print(f"  PC{i+1}: " + ", ".join(f"{(KEYS+EXTRA)[j]}({Vt[i][j]:+.2f})" for j in top))
    cells = {tuple(d.bin(row.get(d.name, 0.0)) for d in DEFAULT_DESCRIPTORS) for row in rows}
    print(f"default descriptors {[d.name for d in DEFAULT_DESCRIPTORS]}: human games occupy {len(cells)} of "
          f"{math.prod(d.bins for d in DEFAULT_DESCRIPTORS)} cells")
    # PCA-based 2-D archive, GAVEL-style, 40x40 over +-5 (the projection is standardized)
    P = X @ Vt[:2].T
    grid = {(int(np.clip((p[0] + 5) / 10 * 40, 0, 39)), int(np.clip((p[1] + 5) / 10 * 40, 0, 39))) for p in P}
    print(f"PCA 2-D 40x40 archive: human games occupy {len(grid)} cells")


def main() -> None:
    rows = build()
    analyse(rows)


if __name__ == "__main__":
    main()
