"""Do the C++ engine's solutions actually win in real PuzzleScript?

Everything here runs on the C++ port: the solver, the depth metrics, the
archive, the claim that a generated game is playable.  The port is what makes
the search affordable, but a solvability claim is only worth as much as the
engine that checked it, and PuzzleScript is defined by its JavaScript
implementation rather than by any port of it.

So: solve a level with the C++ solver, replay the solution in the original
JavaScript engine, and require it to win there too.  Any disagreement is either
a bug in the port or a mechanic the port implements differently, and either way
it is a boundary on what the rest of this pipeline can be trusted to say.

    .venv/bin/python -m prof.crosscheck --games 60
    .venv/bin/python -m prof.crosscheck --dir data/archive/games
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SUMMARY = ROOT / "data" / "census" / "summary.csv"
REPLAY_CLI = ROOT / "tools" / "replay_cli.js"
OUT = ROOT / "data" / "crosscheck.json"


def replay_in_js(text: str, level: int, actions: list[int],
                 timeout: float = 90.0) -> dict[str, Any]:
    from prof import engine as E

    req = json.dumps({"text": text, "level": level, "actions": [int(a) for a in actions]})
    try:
        p = subprocess.run(["node", str(REPLAY_CLI), str(E.ENGINE_JS)],
                           input=req.encode("utf-8"), capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout"}
    out = p.stdout.decode("utf-8", errors="replace").strip()
    if not out:
        return {"ok": False, "error": p.stderr.decode("utf-8", errors="replace")[-200:]}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"ok": False, "error": out[:200]}


def check(job) -> dict[str, Any]:
    """Solve every probed level in C++, replay each solution in JavaScript."""
    name, text, max_levels, max_iters, timeout_ms = job
    from prof import engine as E

    out: dict[str, Any] = {"game": name, "levels": []}
    try:
        compiled = E.compile_text(text)
        eng = E.new_engine(compiled)
        idxs = E.level_indices(compiled)[:max_levels]
    except Exception as e:  # noqa: BLE001
        out["error"] = f"{type(e).__name__}: {e}"[:150]
        return out
    js_idx = E.js_level_indices(compiled)
    for i in idxs:
        eng.load_level(i)
        if eng.check_win():
            continue
        try:
            s = E.solve_level(eng, i, "bfs", max_iters=max_iters, timeout_ms=timeout_ms)
        except Exception as e:  # noqa: BLE001
            out["levels"].append({"level": i, "cpp": "error", "why": type(e).__name__})
            continue
        if not s.solved:
            out["levels"].append({"level": i, "cpp": "unsolved"})
            continue
        # the JavaScript engine numbers message screens as levels; the C++
        # engine does not, so the index has to be translated
        j = js_idx[i] if i < len(js_idx) else i
        js = replay_in_js(text, j, list(s.actions))
        out["levels"].append({
            "level": i, "js_level": j, "cpp": "solved", "len": len(s.actions),
            "js_ok": bool(js.get("ok")), "js_won": bool(js.get("won")),
            "js_steps": js.get("steps"), "js_error": js.get("error", "")[:120],
        })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=60)
    ap.add_argument("--dir", default=None, help="check a directory of .txt games instead")
    ap.add_argument("--max-levels", type=int, default=2)
    ap.add_argument("--max-iters", type=int, default=120_000)
    ap.add_argument("--timeout-ms", type=int, default=4000)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()

    if a.dir:
        d = Path(a.dir) if Path(a.dir).is_absolute() else ROOT / a.dir
        files = sorted(d.glob("*.txt"))
        jobs = [(f.stem, f.read_text(encoding="utf-8", errors="replace"),
                 a.max_levels, a.max_iters, a.timeout_ms) for f in files]
    else:
        import random

        rng = random.Random(a.seed)
        rows = [r["game"] for r in csv.DictReader(SUMMARY.open())
                if r["compiled"] == "1" and int(r["n_solved"]) > 0]
        rng.shuffle(rows)
        jobs = [(n, (GAMES / f"{n}.txt").read_text(encoding="utf-8", errors="replace"),
                 a.max_levels, a.max_iters, a.timeout_ms) for n in rows[: a.games]]

    print(f"{len(jobs)} games, {a.workers} workers", flush=True)
    from prof.pool import resilient_map

    results = []
    t0 = time.time()
    for i, r, reason in resilient_map(check, jobs, a.workers):
        results.append(r if r is not None else {"game": jobs[i][0], "error": f"crash: {reason}"})
        if len(results) % 10 == 0:
            print(f"  {len(results)}/{len(jobs)} {time.time() - t0:.0f}s", flush=True)

    solved = agree = disagree = broken = 0
    offenders = []
    for r in results:
        for lv in r.get("levels", []):
            if lv.get("cpp") != "solved":
                continue
            solved += 1
            if not lv.get("js_ok"):
                broken += 1
                offenders.append((r["game"], lv["level"], "js error: " + lv.get("js_error", "")))
            elif lv.get("js_won"):
                agree += 1
            else:
                disagree += 1
                offenders.append((r["game"], lv["level"],
                                  f"solution of {lv['len']} moves does not win in JS"))
    OUT.write_text(json.dumps(results, indent=1))
    print(f"\n{solved} levels solved by the C++ solver")
    if solved:
        print(f"  {agree} ({100 * agree / solved:.1f}%) also win when replayed in JavaScript")
        print(f"  {disagree} do not win there")
        print(f"  {broken} could not be replayed at all")
    for g, lv, why in offenders[:15]:
        print(f"    {g[:40]:42s} L{lv} {why}")
    print(f"\nraw -> {OUT}")


if __name__ == "__main__":
    main()
