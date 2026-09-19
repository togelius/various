"""How often does each mutation operator produce a game that compiles?

The point of a structural operator is that it costs nothing to try, so the
interesting number is not "does it always work" but "what does a working edit
cost".  This measures both, per operator, over a sample of the human corpus,
and prints the throughput the evolutionary loop can expect.

    .venv/bin/python -m prof.opstats --games 40 --per-game 20
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SUMMARY = ROOT / "data" / "census" / "summary.csv"
OUT = ROOT / "data" / "opstats.json"


def trial(args) -> list[tuple[str, bool, float, str]]:
    name, n, seed = args
    from prof import engine as E
    from prof.grammar import Game
    from prof.mutations import mutate

    rng = random.Random(seed)
    text = (GAMES / f"{name}.txt").read_text(encoding="utf-8", errors="replace")
    try:
        parent = Game.parse(text)
    except Exception:  # noqa: BLE001
        return []
    out = []
    for _ in range(n):
        t0 = time.time()
        child, applied = mutate(parent, rng)
        if not applied:
            continue
        src = child.emit()
        mut_s = time.time() - t0
        try:
            E.compile_text(src, timeout=20)
            ok, err = True, ""
        except E.CompileError as e:
            ok, err = False, str(e).strip().replace("\n", " ")[:90]
        except Exception as e:  # noqa: BLE001
            ok, err = False, f"{type(e).__name__}"
        for a in applied:
            out.append((a.split(":")[0], ok, mut_s, err))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=40)
    ap.add_argument("--per-game", type=int, default=20)
    ap.add_argument("--workers", type=int, default=9)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    names = [r["game"] for r in csv.DictReader(SUMMARY.open())
             if r["compiled"] == "1" and int(r["n_solved"]) > 0]
    rng = random.Random(a.seed)
    names = rng.sample(names, min(a.games, len(names)))
    jobs = [(n, a.per_game, a.seed + i) for i, n in enumerate(names)]
    rows: list[tuple[str, bool, float, str]] = []
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        for res in ex.map(trial, jobs):
            rows.extend(res)
    dt = time.time() - t0

    tally: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    errs: dict[str, str] = {}
    for op, ok, _, err in rows:
        tally[op][0] += 1
        tally[op][1] += int(ok)
        if not ok and op not in errs:
            errs[op] = err
    mut_times = [t for _, _, t, _ in rows]
    n_ok = sum(1 for _, ok, _, _ in rows if ok)
    print(f"{len(rows)} edits over {len(names)} games in {dt:.0f}s "
          f"({len(rows) / max(dt, 1e-9):.0f} edits/s including compile)")
    print(f"mutation alone: {1e6 * sum(mut_times) / max(len(mut_times), 1):.0f} us median-ish per edit")
    print(f"overall compile rate {100 * n_ok / max(len(rows), 1):.1f}%\n")
    print(f"{'operator':22s} {'n':>5s} {'compiles':>9s}   first failure")
    for op in sorted(tally, key=lambda o: -tally[o][0]):
        n, ok = tally[op]
        print(f"{op:22s} {n:5d} {100 * ok / n:8.0f}%   {errs.get(op, '')[:70]}")
    OUT.write_text(json.dumps({op: {"n": v[0], "ok": v[1]} for op, v in tally.items()}, indent=1))


if __name__ == "__main__":
    main()
