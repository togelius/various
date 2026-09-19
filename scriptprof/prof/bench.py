"""Which engine should evaluate a batch of candidate levels?

The premise this project is built on is that PuzzleJAX makes evaluation fast
enough to run a real quality-diversity search.  That is a claim about this
machine, not a quotation from a paper, so it needs measuring -- and measuring
against the honest alternative, which is the C++ engine with all the candidate
levels compiled into *one* game so the compile cost is paid once rather than
per level.

    .venv/bin/python -m prof.bench --game sokoban_basic --levels 64

Reports wall-clock for the same work three ways: batched PuzzleJAX with one
frontier across all levels, the C++ solver level by level in one process, and
the C++ solver across a process pool.
"""
from __future__ import annotations

import argparse
import random
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"


def make_candidates(text: str, n: int, h: int, w: int, seed: int = 0):
    from prof.levelgen import LevelGen

    gen = LevelGen(text, height=h, width=w)
    rng = random.Random(seed)
    seeds = gen.seeds(rng, 4)
    cands = []
    while len(cands) < n:
        cands.append(gen.mutate(rng.choice(seeds), rng, n=rng.randint(1, 4))
                     if seeds else gen.sample(rng))
    return gen, cands[:n]


def cpp_one_game(gen, cands, max_iters: int, timeout_ms: int) -> tuple[float, int, float]:
    """All candidates as levels of a single game: one compile, N searches."""
    from prof import engine as E
    from prof.grammar import Level

    g = gen.struct.copy()
    g.levels = [Level(list(c.rows)) for c in cands]
    g.touch("LEVELS")
    g.repair()
    src = g.emit()
    t0 = time.time()
    c = E.compile_text(src)
    compile_s = time.time() - t0
    eng = E.new_engine(c)
    t0 = time.time()
    solved = 0
    for i in range(len(cands)):
        try:
            eng.load_level(i)
        except Exception:  # noqa: BLE001
            continue
        r = E.solve_level(eng, i, "bfs", max_iters=max_iters, timeout_ms=timeout_ms)
        solved += int(r.solved)
    return time.time() - t0, solved, compile_s


def _cpp_chunk(job):
    src, idxs, max_iters, timeout_ms = job
    from prof import engine as E

    c = E.compile_text(src)
    eng = E.new_engine(c)
    solved = 0
    for i in idxs:
        try:
            eng.load_level(i)
        except Exception:  # noqa: BLE001
            continue
        r = E.solve_level(eng, i, "bfs", max_iters=max_iters, timeout_ms=timeout_ms)
        solved += int(r.solved)
    return solved


def cpp_pool(gen, cands, workers: int, max_iters: int, timeout_ms: int) -> tuple[float, int]:
    from prof.grammar import Level

    g = gen.struct.copy()
    g.levels = [Level(list(c.rows)) for c in cands]
    g.touch("LEVELS")
    g.repair()
    src = g.emit()
    n = len(cands)
    per = max(1, (n + workers - 1) // workers)
    jobs = [(src, list(range(i, min(i + per, n))), max_iters, timeout_ms)
            for i in range(0, n, per)]
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=workers) as ex:
        solved = sum(ex.map(_cpp_chunk, jobs))
    return time.time() - t0, solved


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", default="sokoban_basic")
    ap.add_argument("--levels", type=int, default=64)
    ap.add_argument("--height", type=int, default=7)
    ap.add_argument("--width", type=int, default=7)
    ap.add_argument("--max-depth", type=int, default=22)
    ap.add_argument("--max-iters", type=int, default=200_000)
    ap.add_argument("--timeout-ms", type=int, default=5000)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()

    text = (GAMES / f"{a.game}.txt").read_text(encoding="utf-8", errors="replace")
    t0 = time.time()
    gen, cands = make_candidates(text, a.levels, a.height, a.width)
    setup = time.time() - t0
    print(f"{a.game}: {len(cands)} candidate levels {a.height}x{a.width} "
          f"(setup incl. PuzzleJAX env {setup:.1f}s)\n")

    # PuzzleJAX, batched: first call includes the trace, second does not
    t0 = time.time()
    gen.solve_batch(cands, max_depth=a.max_depth, timeout_s=600)
    jax_cold = time.time() - t0
    jax_solved = sum(1 for c in cands if c.win_depth >= 0)
    t0 = time.time()
    gen.solve_batch(cands, max_depth=a.max_depth, timeout_s=600)
    jax_warm = time.time() - t0

    cpp_s, cpp_solved, compile_s = cpp_one_game(gen, cands, a.max_iters, a.timeout_ms)
    pool_s, pool_solved = cpp_pool(gen, cands, a.workers, a.max_iters, a.timeout_ms)

    print(f"{'method':38s} {'seconds':>9s} {'levels/s':>9s} {'solved':>7s}")
    rows = [
        (f"PuzzleJAX batched (cold, incl. trace)", jax_cold, jax_solved),
        (f"PuzzleJAX batched (warm)", jax_warm, jax_solved),
        (f"C++ one game, {a.levels} levels, serial", cpp_s, cpp_solved),
        (f"C++ same, {a.workers} processes", pool_s, pool_solved),
    ]
    for name, secs, solved in rows:
        print(f"{name:38s} {secs:9.2f} {len(cands) / max(secs, 1e-9):9.1f} {solved:7d}")
    print(f"\nC++ compile of the {a.levels}-level game: {compile_s:.2f}s (paid once)")
    print("PuzzleJAX searches every level to the same fixed depth; the C++ solver"
          "\nstops each level as soon as it wins, which is why 'solved' can differ.")


if __name__ == "__main__":
    main()
