"""Does ``Game.parse`` -> ``Game.emit`` preserve a game?

The mutation operators in ``prof.grammar`` are only trustworthy if the
structure they edit is a faithful representation of the source.  The cheapest
strong check is a round trip over the human corpus: parse every game that
compiles, emit it again, and require that the result still compiles with the
same number of levels.  Anything that fails is a hole in the parser, and the
report says which games fall in it.

    .venv/bin/python -m prof.roundtrip              # whole corpus
    .venv/bin/python -m prof.roundtrip --limit 50
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SUMMARY = ROOT / "data" / "census" / "summary.csv"
OUT = ROOT / "data" / "roundtrip.json"


def check(name: str) -> tuple[str, str, str]:
    from prof import engine as E
    from prof.grammar import Game

    path = GAMES / f"{name}.txt"
    text = path.read_text(encoding="utf-8", errors="replace")
    try:
        emitted = Game.parse(text).emit()
    except Exception as e:  # noqa: BLE001
        return name, "parse_exception", f"{type(e).__name__}: {e}"[:200]
    try:
        before = E.compile_text(text, timeout=30)
    except Exception:  # noqa: BLE001
        return name, "skip_parent_broken", ""
    try:
        after = E.compile_text(emitted, timeout=30)
    except E.CompileError as e:
        return name, "compile_fail", str(e).strip().replace("\n", " ")[:200]
    except Exception as e:  # noqa: BLE001
        return name, "error", f"{type(e).__name__}: {e}"[:200]
    if before.n_levels != after.n_levels:
        return name, "level_mismatch", f"{before.n_levels} -> {after.n_levels}"
    return name, "ok", ""


def corpus(limit: int = 0) -> list[str]:
    names = [r["game"] for r in csv.DictReader(SUMMARY.open()) if r["compiled"] == "1"]
    return names[:limit] if limit else names


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=9)
    ap.add_argument("--show", type=int, default=25)
    a = ap.parse_args()
    names = corpus(a.limit)
    print(f"{len(names)} games", flush=True)
    results = []
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        for i, row in enumerate(ex.map(check, names, chunksize=4)):
            results.append(row)
            if (i + 1) % 100 == 0:
                print(f"  {i + 1}/{len(names)}", flush=True)
    tally = Counter(s for _, s, _ in results)
    total = len(results)
    ok = tally.get("ok", 0)
    print(f"\nround trip: {ok}/{total} = {100 * ok / max(total, 1):.1f}% still compile")
    for k, v in tally.most_common():
        print(f"  {k:22s} {v}")
    bad = [r for r in results if r[1] not in ("ok", "skip_parent_broken")]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bad, indent=1))
    for n, s, m in bad[: a.show]:
        print(f"  {s:18s} {n[:38]:40s} {m[:100]}")
    print(f"\nfull list -> {OUT}")


if __name__ == "__main__":
    main()
