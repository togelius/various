"""Corpus census: compile every scraped game and breadth-first-search every level.

Writes one JSON per game to data/census/raw/<game>.json and a summary table to
data/census/summary.csv. Safe to re-run; finished games are skipped.

    .venv/bin/python -m prof.census --workers 9 --max-iters 100000 --timeout-ms 5000
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from prof import engine as E

ROOT = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
OUT_DIR = ROOT / "data" / "census"
RAW_DIR = OUT_DIR / "raw"

RANDOM_RE = re.compile(r"^\s*(random|randomdir)\b|\brandom\b|\brandomdir\b", re.I | re.M)


def has_randomness(text: str) -> bool:
    """Crude static check: any rule or object line mentioning random/randomDir."""
    body = text.split("RULES", 1)[1] if "RULES" in text else text
    body = re.sub(r"\(.*?\)", "", body, flags=re.S)  # strip comments
    return bool(re.search(r"\brandom(dir)?\b", body, re.I))


def census_one(path: Path, max_iters: int, timeout_ms: int) -> dict:
    name = path.stem
    text = path.read_text(encoding="utf-8", errors="replace")
    rec: dict = {
        "game": name,
        "bytes": len(text),
        "random": has_randomness(text),
        "compiled": False,
        "error": None,
        "levels": [],
    }
    t0 = time.time()
    try:
        c = E.compile_text(text)
    except Exception as e:  # noqa: BLE001
        rec["error"] = str(e)[:500]
        rec["compile_time"] = time.time() - t0
        return rec
    rec["compiled"] = True
    rec["compile_time"] = time.time() - t0
    rec["n_entries"] = c.n_levels
    try:
        eng = E.new_engine(c)
        idxs = E.level_indices(c)
    except Exception as e:  # noqa: BLE001
        rec["error"] = "engine: " + str(e)[:500]
        return rec
    for i in idxs:
        try:
            s = E.solve_level(eng, i, "bfs", max_iters=max_iters, timeout_ms=timeout_ms)
            entry = {
                "level": i,
                "w": eng.width,
                "h": eng.height,
                "solved": s.solved,
                "len": len(s.actions),
                "iters": s.iterations,
                "time": round(s.time, 4),
                "timeout": s.timeout,
                "actions": s.actions if s.solved else None,
            }
            if s.solved and s.actions:
                # Validate the solver against the engine, as PuzzleJAX validates
                # its JAX engine against NodeJS: replay the action list from a
                # fresh level and check it really reaches a win. A mismatch means
                # the search and the engine disagree about the game's semantics.
                try:
                    entry["replay_won"] = bool(E.replay(eng, i, s.actions)["won"])
                except Exception as e:  # noqa: BLE001
                    entry["replay_error"] = str(e)[:200]
            rec["levels"].append(entry)
        except Exception as e:  # noqa: BLE001
            rec["levels"].append({"level": i, "error": str(e)[:300]})
    return rec


def _worker(args):
    """Run one game in a child process with a hard wall-clock limit.

    The C++ engine can hang on games whose rules loop forever, and a crash in
    a pool worker would take the whole pool down, so every game gets its own
    interpreter.
    """
    path, max_iters, timeout_ms, hard_s = args
    out = RAW_DIR / (Path(path).stem + ".json")
    import subprocess
    cmd = [sys.executable, "-m", "prof.census", "--one", str(path),
           "--max-iters", str(max_iters), "--timeout-ms", str(timeout_ms)]
    try:
        proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, timeout=hard_s)
        if proc.returncode != 0 or not out.exists():
            rec = {"game": Path(path).stem, "compiled": False, "levels": [],
                   "error": f"child rc={proc.returncode}: " + proc.stderr.decode(errors="replace")[-600:]}
            out.write_text(json.dumps(rec))
    except subprocess.TimeoutExpired:
        rec = {"game": Path(path).stem, "compiled": False, "levels": [],
               "error": f"hang: exceeded {hard_s}s wall clock"}
        out.write_text(json.dumps(rec))
    rec = json.loads(out.read_text())
    return rec["game"], rec["compiled"], len(rec["levels"]), sum(1 for l in rec["levels"] if l.get("solved"))


def summarize() -> None:
    rows = []
    for p in sorted(RAW_DIR.glob("*.json")):
        r = json.loads(p.read_text())
        lv = [l for l in r["levels"] if "error" not in l]
        solved = [l for l in lv if l["solved"]]
        rows.append({
            "game": r["game"],
            "compiled": int(r["compiled"]),
            "random": int(r.get("random", False)),
            "n_levels": len(lv),
            "n_solved": len(solved),
            "n_timeout": sum(1 for l in lv if l.get("timeout")),
            "n_replay_mismatch": sum(1 for l in solved if l.get("replay_won") is False),
            "max_len": max((l["len"] for l in solved), default=0),
            "mean_len": round(sum(l["len"] for l in solved) / len(solved), 1) if solved else 0,
            "max_iters": max((l["iters"] for l in lv), default=0),
            "error": (r.get("error") or "")[:80].replace("\n", " "),
        })
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "summary.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    n = len(rows)
    nc = sum(r["compiled"] for r in rows)
    nl = sum(r["n_levels"] for r in rows)
    ns = sum(r["n_solved"] for r in rows)
    full = sum(1 for r in rows if r["n_levels"] and r["n_solved"] == r["n_levels"])
    print(f"games {n}  compiled {nc}  levels {nl}  solved {ns}  fully-solved games {full}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=max(1, os.cpu_count() - 1))
    ap.add_argument("--max-iters", type=int, default=100_000)
    ap.add_argument("--timeout-ms", type=int, default=5_000)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--summary-only", action="store_true")
    ap.add_argument("--hard-s", type=float, default=600.0, help="wall-clock cap per game")
    ap.add_argument("--one", type=str, default=None, help="(internal) census a single game file")
    a = ap.parse_args()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if a.one:
        rec = census_one(Path(a.one), a.max_iters, a.timeout_ms)
        (RAW_DIR / (Path(a.one).stem + ".json")).write_text(json.dumps(rec))
        return
    if a.summary_only:
        summarize()
        return
    paths = sorted(GAMES_DIR.glob("*.txt"))
    todo = [p for p in paths if not (RAW_DIR / (p.stem + ".json")).exists()]
    if a.limit:
        todo = todo[: a.limit]
    print(f"{len(paths)} games, {len(todo)} to do, {a.workers} workers", flush=True)
    t0 = time.time()
    done = 0
    with ProcessPoolExecutor(max_workers=a.workers) as ex:
        futs = [ex.submit(_worker, (str(p), a.max_iters, a.timeout_ms, a.hard_s)) for p in todo]
        for f in as_completed(futs):
            done += 1
            name, ok, nl, ns = f.result()
            if done % 25 == 0 or not ok or nl != ns:
                print(f"[{done}/{len(todo)} {time.time()-t0:.0f}s] {name}: compiled={ok} levels={nl} solved={ns}", flush=True)
    summarize()


if __name__ == "__main__":
    main()
