"""Hierarchical fitness for PuzzleScript games (PLAN.md, WP2).

Cheapest checks first, each tier only reached if the previous one passed:

    tier 0  does not compile                       -> fitness -3
    tier 1  compiles but no level is solvable      -> fitness -2
    tier 2  some levels unsolved within budget     -> fitness -1 + fraction solved
            (a level that is already won at the start counts as unsolved:
            it is a degenerate level, e.g. one with no targets)
    tier 3  all levels solvable; scored in [0, 1] by the harmonic mean of
            non-triviality (solution length), rule coverage (every compiled
            rule fires on some solution), and level progression (search
            effort tends to grow across levels)

Pass ``insight=True`` to add a fourth tier-3 factor: the insight gap from
``prof.players``, the fraction of search-solved levels that neither random play
nor greedy hill-climbing ever wins. It costs a few thousand extra engine steps
per level, so it is off by default and switched on for the runs that care.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from prof import engine as E


@dataclass
class Evaluation:
    fitness: float
    tier: int
    reason: str
    compiled: bool = False
    n_levels: int = 0
    n_solved: int = 0
    solutions: dict[int, list[int]] = field(default_factory=dict)
    trivial: list[int] = field(default_factory=list)  # levels won in zero moves
    lengths: list[int] = field(default_factory=list)
    iters: list[int] = field(default_factory=list)
    coverage: dict[str, Any] | None = None
    insight: dict[str, Any] | None = None
    factors: dict[str, float] = field(default_factory=dict)

    def summary(self) -> str:
        f = " ".join(f"{k}={v:.2f}" for k, v in self.factors.items())
        return f"tier{self.tier} f={self.fitness:.3f} solved {self.n_solved}/{self.n_levels} {f} [{self.reason}]"


def _hmean(xs: list[float], floor: float = 0.01) -> float:
    xs = [max(floor, min(1.0, x)) for x in xs]
    return len(xs) / sum(1.0 / x for x in xs)


def _progression(iters: list[int]) -> float:
    """Kendall-style concordance of search effort with level order, mapped to [0,1]."""
    if len(iters) < 2:
        return 0.5
    conc = disc = 0
    for i in range(len(iters)):
        for j in range(i + 1, len(iters)):
            if iters[j] > iters[i]:
                conc += 1
            elif iters[j] < iters[i]:
                disc += 1
    n = conc + disc
    return 0.5 if n == 0 else 0.5 + 0.5 * (conc - disc) / n


def evaluate(text: str, max_iters: int = 100_000, timeout_ms: int = 5_000,
             min_len: int = 10, target_len: int = 40, max_levels: int | None = None,
             insight: bool = False, insight_episodes: int = 6,
             insight_steps: int = 150) -> Evaluation:
    try:
        c = E.compile_text(text)
    except E.CompileError as e:
        return Evaluation(fitness=-3.0, tier=0, reason=f"compile: {str(e)[:120]}")
    try:
        eng = E.new_engine(c)
        idxs = E.level_indices(c)
    except Exception as e:  # noqa: BLE001
        return Evaluation(fitness=-3.0, tier=0, reason=f"engine: {str(e)[:120]}", compiled=True)
    if max_levels:
        idxs = idxs[:max_levels]
    if not idxs:
        return Evaluation(fitness=-3.0, tier=0, reason="no playable levels", compiled=True)
    ev = Evaluation(fitness=-2.0, tier=1, reason="", compiled=True, n_levels=len(idxs))
    for i in idxs:
        eng.load_level(i)
        if eng.check_win():  # won before any move: degenerate level (e.g. no targets)
            ev.trivial.append(i)
            ev.iters.append(0)
            continue
        s = E.solve_level(eng, i, "bfs", max_iters=max_iters, timeout_ms=timeout_ms)
        ev.iters.append(s.iterations)
        if s.solved and len(s.actions) == 0:
            ev.trivial.append(i)
        elif s.solved:
            ev.solutions[i] = s.actions
            ev.lengths.append(len(s.actions))
    ev.n_solved = len(ev.solutions)
    if ev.n_solved == 0:
        ev.reason = "no level solvable within budget"
        return ev
    if ev.n_solved < ev.n_levels:
        ev.tier = 2
        ev.fitness = -1.0 + ev.n_solved / ev.n_levels
        ev.reason = "some levels unsolved" + (f", {len(ev.trivial)} won at start" if ev.trivial else "")
        return ev
    # tier 3: all levels solvable
    ev.tier = 3
    mean_len = sum(ev.lengths) / len(ev.lengths)
    nontrivial = 0.0 if mean_len < 1 else min(1.0, max(0.0, (mean_len - 1) / (target_len - 1)))
    short = sum(1 for l in ev.lengths if l < min_len) / len(ev.lengths)
    nontrivial *= (1.0 - 0.5 * short)
    ev.coverage = E.coverage(c, ev.solutions)
    cov = ev.coverage["n_fired"] / ev.coverage["n_rules"] if ev.coverage["n_rules"] else 1.0
    prog = _progression(ev.iters)
    ev.factors = {"nontrivial": nontrivial, "coverage": cov, "progression": prog}
    if insight:
        from prof.players import myopic_gap

        ev.insight = myopic_gap(c, sorted(ev.solutions), episodes=insight_episodes,
                                max_steps=insight_steps)
        if ev.insight["gap"] is not None:
            ev.factors["insight"] = ev.insight["gap"]
    ev.fitness = _hmean(list(ev.factors.values()))
    ev.reason = "ok"
    return ev


# ---- crash- and hang-proof evaluation ------------------------------------
#
# The C++ engine is not safe to run in the evaluation loop's own process. Some
# corpus games segfault it outright (1D_Rubik's_Cube dies inside load_level),
# and a rule that keeps issuing `again` spins forever inside a single expansion
# where no solver timeout can reach it. Either one kills a MAP-Elites run that
# may have been going for hours, and a mutation operator is far more likely to
# produce such a game than a human designer is. So candidates are evaluated in
# a child process with a wall-clock cap, and a child that dies or overruns is
# reported as an unfit game rather than taken down the parent with it.

_JSON_FIELDS = ("fitness", "tier", "reason", "compiled", "n_levels", "n_solved",
                "trivial", "lengths", "iters", "factors")


def _to_json(ev: "Evaluation") -> str:
    import json
    d = {k: getattr(ev, k) for k in _JSON_FIELDS}
    d["solutions"] = {str(k): v for k, v in ev.solutions.items()}
    d["coverage"] = None if ev.coverage is None else {
        "n_rules": ev.coverage["n_rules"],
        "n_fired": ev.coverage["n_fired"],
        "never_fired": ev.coverage["never_fired"],
    }
    d["insight"] = ev.insight
    return json.dumps(d)


def _from_json(s: str) -> "Evaluation":
    import json
    d = json.loads(s)
    ev = Evaluation(fitness=d["fitness"], tier=d["tier"], reason=d["reason"])
    for k in _JSON_FIELDS[3:]:
        setattr(ev, k, d[k])
    ev.solutions = {int(k): v for k, v in d["solutions"].items()}
    ev.coverage = d["coverage"]
    ev.insight = d["insight"]
    return ev


def evaluate_isolated(text: str, timeout_s: float = 120.0, **kw: Any) -> Evaluation:
    """``evaluate`` in a child process, so a crash or a hang costs one candidate.

    Falls back to reporting the game unfit, with the reason recorded, when the
    child segfaults, overruns its wall clock, or writes nothing usable.
    """
    import json
    import subprocess
    import sys
    import tempfile
    from pathlib import Path as _Path

    root = _Path(__file__).resolve().parent.parent
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as fh:
        fh.write(text)
        src = fh.name
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "prof.fitness", src, json.dumps(kw)],
            cwd=str(root), capture_output=True, timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        return Evaluation(fitness=-3.0, tier=0,
                          reason=f"hung: no result within {timeout_s:g}s")
    finally:
        try:
            _Path(src).unlink()
        except OSError:
            pass
    out = proc.stdout.decode("utf-8", errors="replace").strip()
    if proc.returncode != 0 or not out:
        why = f"crashed: rc={proc.returncode}"
        if proc.returncode is not None and proc.returncode < 0:
            why = f"crashed: killed by signal {-proc.returncode}"
        return Evaluation(fitness=-3.0, tier=0, reason=why)
    try:
        return _from_json(out.splitlines()[-1])
    except Exception as e:  # noqa: BLE001
        return Evaluation(fitness=-3.0, tier=0, reason=f"unreadable child output: {e}")


def _main() -> None:
    """Evaluate one game file and print the result as JSON. Used by the above."""
    import json
    import sys
    from pathlib import Path as _Path

    text = _Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace")
    kw = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    print(_to_json(evaluate(text, **kw)))


if __name__ == "__main__":
    _main()
