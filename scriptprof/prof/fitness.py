"""Hierarchical fitness for PuzzleScript games (PLAN.md, WP2).

Cheapest checks first, each tier only reached if the previous one passed:

    tier 0  does not compile                       -> fitness -3
    tier 1  compiles but no level is solvable      -> fitness -2
    tier 2  some levels unsolved within budget     -> fitness -1 + fraction solved
    tier 3  all levels solvable; scored in [0, 1] by the harmonic mean of
            non-triviality (solution length), rule coverage (every compiled
            rule fires on some solution), and level progression (search
            effort tends to grow across levels)

The insight-gap tier (search solves, learners do not) is deferred until player
agents exist; it slots in as one more factor of the harmonic mean.
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
    lengths: list[int] = field(default_factory=list)
    iters: list[int] = field(default_factory=list)
    coverage: dict[str, Any] | None = None
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
             min_len: int = 10, target_len: int = 40, max_levels: int | None = None) -> Evaluation:
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
        s = E.solve_level(eng, i, "bfs", max_iters=max_iters, timeout_ms=timeout_ms)
        ev.iters.append(s.iterations)
        if s.solved:
            ev.solutions[i] = s.actions
            ev.lengths.append(len(s.actions))
    ev.n_solved = len(ev.solutions)
    if ev.n_solved == 0:
        ev.reason = "no level solvable within budget"
        return ev
    if ev.n_solved < ev.n_levels:
        ev.tier = 2
        ev.fitness = -1.0 + ev.n_solved / ev.n_levels
        ev.reason = "some levels unsolved"
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
    ev.fitness = _hmean(list(ev.factors.values()))
    ev.reason = "ok"
    return ev
