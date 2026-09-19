"""MAP-Elites over PuzzleScript games, at structural-mutation speed.

The loop is GAVEL's: keep a grid of cells indexed by behaviour descriptors,
repeatedly pick an elite, mutate it, and let the child take a cell if it beats
whatever is there.  What changes here is the cost of one iteration.  With a
language model in the mutation slot a generation is minutes; with
``prof.mutations`` it is under a millisecond, and the whole budget goes into
evaluation instead.

That shifts where care is needed, so evaluation is tiered:

* **Tier 1**, every candidate.  Compile with the original engine, breadth-first
  search each level with the C++ solver, check rule coverage and level
  progression.  Around a tenth of a second, no JAX.
* **Tier 2**, elites only.  The depth metrics in ``prof.depth``: random-play
  floor, the greedy-versus-search insight gap, fatal-move structure, deadlock
  density.  These need batched PuzzleJAX and cost a few seconds of tracing per
  game, which is affordable precisely because it is spent only on keepers.

Novelty against the human corpus enters as a fitness bonus rather than a
descriptor, because the descriptor axes are ones human games already span.

    .venv/bin/python -m prof.qd --out data/evolve/run --iters 4000 --workers 9

The archive is written after every batch, so a run can be stopped and resumed.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
import signal
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SUMMARY = ROOT / "data" / "census" / "summary.csv"
ROUNDTRIP = ROOT / "data" / "roundtrip.json"


# --------------------------------------------------------------------------
# descriptor space
# --------------------------------------------------------------------------

@dataclass
class Axis:
    name: str
    lo: float
    hi: float
    bins: int
    log: bool = False

    def bin(self, x: float) -> int:
        if self.log:
            x, lo, hi = math.log1p(max(0.0, x)), math.log1p(self.lo), math.log1p(self.hi)
        else:
            lo, hi = self.lo, self.hi
        t = 0.0 if hi <= lo else (x - lo) / (hi - lo)
        return max(0, min(self.bins - 1, int(t * self.bins)))


# Ranges are set from the corpus' own spread (prof.corpus_features): the median
# game has 22 rule sources and 18 objects, the 90th percentile 90 and 49, so a
# log axis to a few times the p90 keeps the human games off the end bins.
#
# The fourth axis is the one that is not just size.  `churn` counts rule
# right-hand sides that create or destroy objects, which separates games that
# only move things around (Sokoban and its descendants) from games where the
# board's contents change (match-3, growth, decay).  Two games can agree on
# every size axis and be nothing alike across this one.
PRESETS: dict[str, list[Axis]] = {
    "size-depth": [
        Axis("n_rule_sources", 0, 200, 8, log=True),
        Axis("mean_solution_len", 0, 80, 8, log=True),
        Axis("n_objects", 0, 60, 5, log=True),
    ],
    "wide": [
        Axis("n_rule_sources", 0, 200, 8, log=True),
        Axis("mean_solution_len", 0, 80, 8, log=True),
        Axis("n_objects", 0, 60, 5, log=True),
        Axis("churn", 0, 60, 4, log=True),
    ],
}
AXES = PRESETS["wide"]


@dataclass
class Elite:
    cell: tuple[int, ...]
    fitness: float
    tier: int
    name: str
    parent: str | None
    ops: list[str]
    features: dict[str, float]
    summary: str
    iteration: int
    novelty: float = 0.0
    depth: dict[str, Any] | None = None


class Archive:
    def __init__(self, out: Path, axes: list[Axis]):
        self.out = out
        self.axes = axes
        self.elites: dict[str, Elite] = {}
        self.n_evaluated = 0
        self.n_compiled = 0
        (out / "games").mkdir(parents=True, exist_ok=True)
        p = out / "archive.json"
        if p.exists():
            blob = json.loads(p.read_text())
            self.n_evaluated = blob.get("n_evaluated", 0)
            self.n_compiled = blob.get("n_compiled", 0)
            for k, v in blob.get("elites", {}).items():
                v["cell"] = tuple(v["cell"])
                self.elites[k] = Elite(**v)

    def key(self, cell: tuple[int, ...]) -> str:
        return "_".join(f"{c:02d}" for c in cell)

    def cell_of(self, feats: dict[str, float]) -> tuple[int, ...]:
        return tuple(a.bin(feats.get(a.name, 0.0)) for a in self.axes)

    def offer(self, text: str, rec: dict[str, Any], iteration: int) -> str | None:
        """Insert a candidate if its cell is empty or it beats the incumbent."""
        feats = rec["features"]
        cell = self.cell_of(feats)
        k = self.key(cell)
        cur = self.elites.get(k)
        if cur is not None and cur.fitness >= rec["fitness"]:
            return None
        self.elites[k] = Elite(
            cell=cell, fitness=rec["fitness"], tier=rec["tier"], name=rec["name"],
            parent=rec.get("parent"), ops=rec.get("ops", []), features=feats,
            summary=rec["summary"], iteration=iteration, novelty=rec.get("novelty", 0.0))
        (self.out / "games" / f"{k}.txt").write_text(text, encoding="utf-8")
        return k

    def text(self, k: str) -> str:
        return (self.out / "games" / f"{k}.txt").read_text(encoding="utf-8")

    def save(self) -> None:
        tmp = self.out / "archive.json.tmp"
        tmp.write_text(json.dumps({
            "n_evaluated": self.n_evaluated,
            "n_compiled": self.n_compiled,
            "axes": [asdict(a) for a in self.axes],
            "elites": {k: asdict(v) for k, v in self.elites.items()},
        }, indent=1))
        tmp.replace(self.out / "archive.json")

    @property
    def qd_score(self) -> float:
        return sum(max(0.0, e.fitness) for e in self.elites.values())

    def stats(self) -> str:
        n = len(self.elites)
        total = math.prod(a.bins for a in self.axes)
        t3 = sum(1 for e in self.elites.values() if e.tier >= 3)
        good = sum(1 for e in self.elites.values() if e.fitness > 0.4)
        nov = sum(1 for e in self.elites.values() if e.novelty > 1.1)
        return (f"cells {n}/{total} playable {t3} f>0.4 {good} novel {nov} "
                f"QD {self.qd_score:.1f} evals {self.n_evaluated} "
                f"({100 * self.n_compiled / max(self.n_evaluated, 1):.0f}% compile)")


# --------------------------------------------------------------------------
# evaluation (runs in worker processes)
# --------------------------------------------------------------------------

_NOVELTY = None


def _novelty():
    global _NOVELTY
    if _NOVELTY is None:
        from prof.novelty import shared
        _NOVELTY = shared()
    return _NOVELTY


def evaluate_text(text: str, max_levels: int, timeout_ms: int,
                  max_iters: int, novelty_weight: float = 0.4) -> dict[str, Any]:
    """Tier-1 fitness: compile, solve, cover, progress.  No JAX."""
    from prof import engine as E
    from prof.concepts import concepts
    from prof.fitness import evaluate

    ev = evaluate(text, max_iters=max_iters, timeout_ms=timeout_ms, max_levels=max_levels)
    state = None
    if ev.compiled:
        try:
            state = E.compile_text(text).state
        except Exception:  # noqa: BLE001
            state = None
    feats = concepts(text, state)
    feats["mean_solution_len"] = (sum(ev.lengths) / len(ev.lengths)) if ev.lengths else 0.0
    feats["max_solution_len"] = max(ev.lengths, default=0)
    feats["mean_search_iters"] = (sum(ev.iters) / len(ev.iters)) if ev.iters else 0.0
    feats["frac_solved"] = ev.n_solved / max(ev.n_levels, 1)
    feats["churn"] = feats.get("rep_creates", 0.0) + feats.get("rep_clears", 0.0)
    nov = 0.0
    if ev.compiled:
        try:
            nov = _novelty().score(feats)
        except Exception:  # noqa: BLE001
            nov = 0.0
    fitness = ev.fitness
    if ev.tier >= 3 and novelty_weight:
        # Reward being unlike the corpus, but only once the game actually
        # works: novelty on a broken game is just noise, and rewarding it
        # would pull the whole archive off the playable manifold.
        fitness += novelty_weight * max(0.0, min(1.0, nov - 1.0))
    return {
        "fitness": float(fitness), "tier": ev.tier, "summary": ev.summary(),
        "features": feats, "novelty": float(nov), "compiled": ev.compiled,
        "n_levels": ev.n_levels, "n_solved": ev.n_solved,
    }


def _worker(job) -> dict[str, Any]:
    """Mutate a parent and evaluate the child.  Returns a record, never raises."""
    parent_text, parent_key, seed, cfg, cross_text = job
    import random as _r

    from prof.grammar import Game
    from prof.mutations import crossover, mutate

    rng = _r.Random(seed)
    try:
        parent = Game.parse(parent_text)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"parse parent: {type(e).__name__}"}
    try:
        if cross_text is not None and rng.random() < cfg["p_cross"]:
            other = Game.parse(cross_text)
            child, ops = crossover(parent, other, rng)
        else:
            n = 1 + int(rng.random() < cfg["p_two_ops"])
            child, ops = mutate(parent, rng, n_ops=n)
        if not ops:
            return {"ok": False, "why": "no operator applied"}
        text = child.emit()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"mutate: {type(e).__name__}: {e}"[:120]}
    try:
        rec = evaluate_text(text, cfg["max_levels"], cfg["timeout_ms"],
                            cfg["max_iters"], cfg["novelty_weight"])
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "why": f"evaluate: {type(e).__name__}: {e}"[:120]}
    rec.update({"ok": True, "text": text, "ops": ops, "parent": parent_key,
                "name": f"{parent_key}+{'+'.join(ops)[:60]}"})
    return rec


def _deep_worker(job) -> dict[str, Any]:
    """Tier-2 depth analysis of one elite.  Slow; elites only."""
    key, text, max_levels = job
    from prof.depth import analyse

    try:
        d = analyse(text, max_levels=max_levels)
        return {"key": key, "depth": d.to_dict(), "summary": d.summary()}
    except Exception as e:  # noqa: BLE001
        return {"key": key, "depth": None, "summary": f"{type(e).__name__}: {e}"[:120]}


# --------------------------------------------------------------------------
# seeding
# --------------------------------------------------------------------------

def seed_names(n: int, rng: random.Random, min_solved: int = 1) -> list[str]:
    """Human games that compile, have a solved level, and round-trip cleanly."""
    broken = set()
    if ROUNDTRIP.exists():
        broken = {r[0] for r in json.loads(ROUNDTRIP.read_text())}
    rows = [r for r in csv.DictReader(SUMMARY.open())
            if r["compiled"] == "1" and int(r["n_solved"]) >= min_solved
            and r["game"] not in broken and r["random"] == "0"]
    rows.sort(key=lambda r: -int(r["n_solved"]))
    pool = [r["game"] for r in rows]
    if len(pool) <= n:
        return pool
    # spread the seeds over the corpus rather than taking the top of the list
    step = len(pool) / n
    return [pool[int(i * step)] for i in range(n)]


def seed_archive(arch: Archive, names: list[str], cfg: dict[str, Any],
                 workers: int) -> None:
    jobs = []
    for nm in names:
        p = Path(nm) if nm.endswith(".txt") else GAMES_DIR / f"{nm}.txt"
        if p.exists():
            jobs.append((p.stem, p.read_text(encoding="utf-8", errors="replace")))
    print(f"seeding from {len(jobs)} human games", flush=True)
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futs = [(nm, txt, ex.submit(evaluate_text, txt, cfg["max_levels"],
                                    cfg["timeout_ms"], cfg["max_iters"],
                                    cfg["novelty_weight"]))
                for nm, txt in jobs]
        for nm, txt, f in futs:
            try:
                rec = f.result()
            except Exception as e:  # noqa: BLE001
                print(f"  {nm}: failed {type(e).__name__}", flush=True)
                continue
            arch.n_evaluated += 1
            arch.n_compiled += int(rec["compiled"])
            rec.update({"name": nm, "parent": None, "ops": ["seed"]})
            k = arch.offer(txt, rec, 0)
            if k:
                print(f"  {nm:38s} -> {k}  {rec['summary'][:60]}", flush=True)
    arch.save()
    print(f"seeded: {arch.stats()}", flush=True)


# --------------------------------------------------------------------------
# the loop
# --------------------------------------------------------------------------

def pick_parents(arch: Archive, n: int, rng: random.Random) -> list[str]:
    """Curiosity-ish selection: prefer cells that are working but not maxed."""
    keys = list(arch.elites)
    if not keys:
        return []
    weights = []
    for k in keys:
        e = arch.elites[k]
        w = 1.0
        if e.tier >= 3:
            w += 2.0
        if e.fitness > 0.4:
            w += 1.0
        if e.novelty > 1.1:
            w += 1.0
        weights.append(w)
    return rng.choices(keys, weights=weights, k=n)


def run(arch: Archive, cfg: dict[str, Any], iters: int, workers: int,
        batch: int, rng: random.Random, log_path: Path,
        deep_every: int = 0, deep_n: int = 6, wall_s: float = 0.0) -> None:
    """Drive the archive, surviving worker deaths.

    The C++ engine segfaults on some inputs -- one game in the human corpus
    does it, and mutants find their own ways -- and a hard worker death poisons
    a ProcessPoolExecutor permanently: every pending and future task raises
    BrokenProcessPool.  An overnight run therefore has to be able to lose a
    pool and build another, so the batch is submitted as individual futures,
    each failure is counted rather than propagated, and a broken pool is
    replaced before the next batch.
    """
    from concurrent.futures import BrokenExecutor

    start = time.time()
    done = 0
    crashes = 0
    stop = {"flag": False}

    def _sig(_s, _f):
        stop["flag"] = True
        print("\n[stopping after this batch]", flush=True)

    signal.signal(signal.SIGINT, _sig)
    signal.signal(signal.SIGTERM, _sig)

    logf = open(log_path, "a")
    ex = ProcessPoolExecutor(max_workers=workers)
    try:
        while done < iters and not stop["flag"]:
            if wall_s and time.time() - start > wall_s:
                print(f"[wall clock {wall_s:.0f}s reached]", flush=True)
                break
            n = min(batch, iters - done)
            parents = pick_parents(arch, n, rng)
            if not parents:
                print("archive empty, nothing to mutate", flush=True)
                break
            jobs = []
            for pk in parents:
                mate = None
                if rng.random() < cfg["p_cross"] and len(arch.elites) > 1:
                    mk = rng.choice([k for k in arch.elites if k != pk])
                    mate = arch.text(mk)
                jobs.append((arch.text(pk), pk, rng.randrange(1 << 30), cfg, mate))
            t0 = time.time()
            added = 0
            lost = 0
            try:
                futs = [ex.submit(_worker, j) for j in jobs]
            except BrokenExecutor:
                ex = _restart(ex, workers)
                crashes += 1
                continue
            for fut, job in zip(futs, jobs):
                done += 1
                try:
                    rec = fut.result()
                except Exception as e:  # noqa: BLE001 -- a dead worker is data
                    lost += 1
                    logf.write(json.dumps({
                        "i": done, "crash": type(e).__name__, "parent": job[1]}) + "\n")
                    continue
                if not rec.get("ok"):
                    logf.write(json.dumps({"i": done, "fail": rec.get("why")}) + "\n")
                    continue
                arch.n_evaluated += 1
                arch.n_compiled += int(rec["compiled"])
                text = rec.pop("text")
                k = arch.offer(text, rec, done)
                added += int(bool(k))
                logf.write(json.dumps({
                    "i": done, "parent": rec["parent"], "ops": rec["ops"],
                    "fitness": rec["fitness"], "tier": rec["tier"],
                    "novelty": rec["novelty"], "cell": k, "summary": rec["summary"],
                }) + "\n")
            logf.flush()
            arch.save()
            if lost:
                crashes += 1
                ex = _restart(ex, workers)
            rate = n / max(time.time() - t0, 1e-9)
            note = f" lost {lost}" if lost else ""
            print(f"[{done}/{iters} {time.time() - start:.0f}s {rate:.1f}/s +{added}{note}] "
                  f"{arch.stats()}", flush=True)
            if deep_every and done % deep_every < batch:
                try:
                    deepen(arch, ex, deep_n, rng, cfg)
                except Exception as e:  # noqa: BLE001
                    print(f"  deep failed: {type(e).__name__}", flush=True)
                    ex = _restart(ex, workers)
    finally:
        logf.close()
        arch.save()
        ex.shutdown(wait=False, cancel_futures=True)
    if crashes:
        print(f"[recovered from {crashes} worker-pool failures]", flush=True)


def _restart(ex: ProcessPoolExecutor, workers: int) -> ProcessPoolExecutor:
    """Replace a pool whose workers died, discarding whatever was queued."""
    try:
        ex.shutdown(wait=False, cancel_futures=True)
    except Exception:  # noqa: BLE001
        pass
    return ProcessPoolExecutor(max_workers=workers)


def deepen(arch: Archive, ex: ProcessPoolExecutor, n: int, rng: random.Random,
           cfg: dict[str, Any]) -> None:
    """Re-score a few elites with the expensive PuzzleJAX depth metrics."""
    cands = [k for k, e in arch.elites.items() if e.tier >= 3 and e.depth is None]
    if not cands:
        cands = [k for k, e in arch.elites.items() if e.tier >= 3]
    if not cands:
        return
    pick = rng.sample(cands, min(n, len(cands)))
    jobs = [(k, arch.text(k), cfg["deep_levels"]) for k in pick]
    t0 = time.time()
    lines = []
    for res in ex.map(_deep_worker, jobs):
        e = arch.elites.get(res["key"])
        if e is not None:
            e.depth = res["depth"]
        lines.append(f"{res['key']} {res['summary'][:50]}")
    print(f"  deep: {len(pick)} elites in {time.time() - t0:.0f}s\n    "
          + "\n    ".join(lines), flush=True)
    arch.save()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/evolve/qd1")
    ap.add_argument("--iters", type=int, default=2000)
    ap.add_argument("--workers", type=int, default=9)
    ap.add_argument("--batch", type=int, default=36)
    ap.add_argument("--seeds", type=int, default=60)
    ap.add_argument("--seed-names", nargs="*", default=None)
    ap.add_argument("--max-levels", type=int, default=3)
    ap.add_argument("--timeout-ms", type=int, default=2500)
    ap.add_argument("--max-iters", type=int, default=60000)
    ap.add_argument("--deep-levels", type=int, default=2)
    ap.add_argument("--deep-every", type=int, default=0)
    ap.add_argument("--deep-n", type=int, default=6)
    ap.add_argument("--p-cross", type=float, default=0.15)
    ap.add_argument("--novelty-weight", type=float, default=0.4)
    ap.add_argument("--axes", default="wide", choices=sorted(PRESETS))
    ap.add_argument("--p-two-ops", type=float, default=0.35)
    ap.add_argument("--wall-s", type=float, default=0.0)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()

    out = ROOT / a.out if not os.path.isabs(a.out) else Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cfg = {"max_levels": a.max_levels, "timeout_ms": a.timeout_ms,
           "max_iters": a.max_iters, "p_cross": a.p_cross,
           "p_two_ops": a.p_two_ops, "deep_levels": a.deep_levels,
           "novelty_weight": a.novelty_weight}
    (out / "config.json").write_text(json.dumps({**cfg, **vars(a)}, indent=1))
    rng = random.Random(a.seed)
    arch = Archive(out, PRESETS[a.axes])
    if not arch.elites:
        names = a.seed_names or seed_names(a.seeds, rng)
        seed_archive(arch, names, cfg, a.workers)
    else:
        print(f"resuming: {arch.stats()}", flush=True)
    run(arch, cfg, a.iters, a.workers, a.batch, rng, out / "log.jsonl",
        deep_every=a.deep_every, deep_n=a.deep_n, wall_s=a.wall_s)
    print(f"done: {arch.stats()}", flush=True)


if __name__ == "__main__":
    main()
