"""What is each mutation operator actually worth?

Two different questions, and an operator can do well on the first while being
useless on the second.

**Does it compile?**  Measured by mutating a sample of the human corpus.  The
point of a structural operator is that it costs nothing to try, so the
interesting number is not a perfect hit rate but what a working edit costs.

    .venv/bin/python -m prof.opstats --games 40 --per-game 20

**Does it earn a cell?**  Measured from a finished run's log: of the children
carrying this operator, how many took an archive cell, and how many of those
were still playable when they did.  Compiling is cheap and common; taking a
cell away from an incumbent is the thing the search actually needs, and the
two rankings do not agree.

    .venv/bin/python -m prof.opstats --from-run data/evolve/novel
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


def from_run(run: Path, top: int = 30) -> None:
    """Per-operator yield, read out of a run's log."""
    tried: dict[str, int] = defaultdict(int)
    added: dict[str, int] = defaultdict(int)
    playable: dict[str, int] = defaultdict(int)
    fitness: dict[str, list[float]] = defaultdict(list)
    log = run / "log.jsonl"
    if not log.exists():
        print(f"no log at {log}")
        return
    with log.open() as fh:
        for line in fh:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            ops = rec.get("ops")
            if not ops:
                continue
            for o in ops:
                k = o.split(":")[0]
                tried[k] += 1
                if rec.get("cell"):
                    added[k] += 1
                if int(rec.get("tier", 0)) >= 3:
                    playable[k] += 1
                    fitness[k].append(float(rec.get("fitness", 0.0)))
    if not tried:
        print("no operator records in the log")
        return
    total_t = sum(tried.values())
    total_a = sum(added.values())
    print(f"{run.name}: {total_t} operator applications, "
          f"{total_a} took a cell ({100 * total_a / total_t:.0f}%)\n")
    print(f"{'operator':22s} {'tried':>7s} {'took a cell':>12s} {'playable':>10s} {'mean f':>8s}")
    for k in sorted(tried, key=lambda k: -(added[k] / max(tried[k], 1))):
        if tried[k] < 5:
            continue
        mf = sum(fitness[k]) / len(fitness[k]) if fitness[k] else float("nan")
        print(f"{k:22s} {tried[k]:7d} {100 * added[k] / tried[k]:11.0f}% "
              f"{100 * playable[k] / tried[k]:9.0f}% {mf:8.2f}")
    print("\nSorted by the rate at which the operator's children take a cell,"
          "\nwhich is what moves the archive; compiling is cheap and common.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-run", default=None,
                    help="read per-operator yield from a finished run's log")
    ap.add_argument("--games", type=int, default=40)
    ap.add_argument("--per-game", type=int, default=20)
    ap.add_argument("--workers", type=int, default=9)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    if a.from_run:
        run = Path(a.from_run) if Path(a.from_run).is_absolute() else ROOT / a.from_run
        from_run(run)
        return
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
