"""A process pool that survives its workers dying.

The C++ engine segfaults on some inputs.  One game in the human corpus does it
outright, and mutants keep finding their own ways, which is unsurprising for an
engine being fed programs no person wrote.  A hard worker death poisons a
``ProcessPoolExecutor`` permanently: the pool is marked broken and every
pending *and* future task raises ``BrokenProcessPool``, so a single bad game
three minutes into a run silently discards the remaining hours of work.

That is not hypothetical here.  The first overnight run died after four hundred
candidates, and a validation sweep over 36 games returned results for 4 because
31 inherited a poisoned pool from the one that crashed.

:func:`resilient_map` submits each job as its own future, treats a dead worker
as a result rather than an exception, and rebuilds the pool before continuing.
Jobs lost to a crash are reported, not silently dropped, because which input
killed the engine is usually worth knowing.
"""
from __future__ import annotations

import time
from concurrent.futures import BrokenExecutor, ProcessPoolExecutor
from typing import Any, Callable, Iterable, Iterator


def resilient_map(fn: Callable, jobs: list[Any], workers: int,
                  chunk: int = 0, on_crash: Callable[[int, Any, str], Any] | None = None,
                  progress: Callable[[int, int, float], None] | None = None,
                  ) -> Iterator[tuple[int, Any, str | None]]:
    """Map ``fn`` over ``jobs``, yielding ``(index, result, crash_reason)``.

    ``crash_reason`` is ``None`` for a normal result.  When a worker dies the
    job's result is ``None`` and the reason names the exception; the pool is
    replaced before the next chunk, so the remaining jobs still run.

    Jobs are submitted in chunks rather than all at once: a crash cancels
    everything already queued behind it, so a smaller queue loses less.
    """
    chunk = chunk or max(workers * 2, 8)
    t0 = time.time()
    ex = ProcessPoolExecutor(max_workers=workers)
    done = 0
    try:
        i = 0
        while i < len(jobs):
            batch = jobs[i: i + chunk]
            try:
                futs = [ex.submit(fn, j) for j in batch]
            except BrokenExecutor:
                ex = _restart(ex, workers)
                continue
            crashed = False
            for off, (fut, job) in enumerate(zip(futs, batch)):
                idx = i + off
                try:
                    res, reason = fut.result(), None
                except Exception as e:  # noqa: BLE001 -- a dead worker is data
                    res, reason = None, f"{type(e).__name__}"
                    crashed = True
                    if on_crash is not None:
                        res = on_crash(idx, job, reason)
                done += 1
                if progress is not None:
                    progress(done, len(jobs), time.time() - t0)
                yield idx, res, reason
            i += len(batch)
            if crashed:
                ex = _restart(ex, workers)
    finally:
        ex.shutdown(wait=False, cancel_futures=True)


def _restart(ex: ProcessPoolExecutor, workers: int) -> ProcessPoolExecutor:
    try:
        ex.shutdown(wait=False, cancel_futures=True)
    except Exception:  # noqa: BLE001
        pass
    return ProcessPoolExecutor(max_workers=workers)
