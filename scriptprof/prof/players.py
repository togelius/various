"""Player agents and the insight gap (PLAN.md, WP2 tier 6 and WP4).

PuzzleJAX's headline result is a gap between kinds of player: breadth-first
search solves games that reinforcement learning and language models cannot,
because the learners climb the reward signal into a deadlock while the search
simply enumerates. A game that is easy for search and hard for a greedy
learner is one whose solution needs a step that looks locally wrong. That is
as close as we can get, cheaply, to the reframing a good puzzle demands.

This module makes that gap measurable without a GPU. It runs a ladder of
players over a level:

    random   uniformly random actions
    greedy   hill-climbs the engine's own distance-to-win heuristic, which is
             the reward the PuzzleJAX paper hands its PPO agents, so it fails
             the way they fail: straight into deadlocks
    gbfs     greedy best-first search, the heuristic with backtracking
    astar    the heuristic with a cost term
    bfs      exhaustive, ignores the heuristic entirely

The insight gap is the fraction of the two myopic rungs that fail on a level
that search can solve. It is relative to the players available, so it moves as
better players arrive; that is deliberate, and is how the co-evolution loop in
WP4 keeps finding harder games.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

from prof import engine as E

SEARCH_PLAYERS = ("gbfs", "astar", "bfs")
MYOPIC_PLAYERS = ("random", "greedy")


@dataclass
class PlayResult:
    player: str
    won: bool
    steps: int = 0
    episodes: int = 0
    best_score: float = 0.0  # normalised, 1.0 at a win
    actions: list[int] = field(default_factory=list)


def _actions(compiled: E.Compiled) -> list[int]:
    """The engine's action set: four moves, plus ACTION unless disabled."""
    meta = compiled.state.get("metadata") or {}
    if isinstance(meta, dict) and "noaction" in {k.lower() for k in meta}:
        return [0, 1, 2, 3]
    return [0, 1, 2, 3, 4]


def random_play(eng, level: int, actions: list[int], rng: random.Random,
                max_steps: int = 200, episodes: int = 10) -> PlayResult:
    """Uniformly random actions. The floor: what a game gives away by accident."""
    best = 0.0
    for ep in range(episodes):
        eng.load_level(level)
        for i in range(max_steps):
            E.step(eng, rng.choice(actions))
            best = max(best, eng.get_score_normalized())
            if eng.winning:
                return PlayResult("random", True, i + 1, ep + 1, 1.0)
    return PlayResult("random", False, max_steps, episodes, best)


def greedy_play(eng, level: int, actions: list[int], rng: random.Random,
                max_steps: int = 200, episodes: int = 10,
                epsilon: float = 0.1) -> PlayResult:
    """Hill-climb the engine's distance-to-win heuristic.

    At each turn every action is tried from a backup of the current board and
    the one leaving the best normalised score is kept, ties broken at random.
    With probability ``epsilon`` a random action is taken instead, which is
    enough to cross a plateau but not to plan around a deadlock. This is the
    failure mode the PuzzleJAX paper reports for PPO: reward goes up, the crate
    ends up in a corner, and the episode is unwinnable long before it ends.
    """
    best_overall = 0.0
    for ep in range(episodes):
        eng.load_level(level)
        for i in range(max_steps):
            if rng.random() < epsilon:
                E.step(eng, rng.choice(actions))
            else:
                here = eng.backup_level()
                scored: list[tuple[float, int]] = []
                for a in actions:
                    eng.restore_level(here)
                    E.step(eng, a)
                    if eng.winning:
                        return PlayResult("greedy", True, i + 1, ep + 1, 1.0)
                    scored.append((eng.get_score_normalized(), a))
                top = max(s for s, _ in scored)
                eng.restore_level(here)
                E.step(eng, rng.choice([a for s, a in scored if s == top]))
            best_overall = max(best_overall, eng.get_score_normalized())
            if eng.winning:
                return PlayResult("greedy", True, i + 1, ep + 1, 1.0)
    return PlayResult("greedy", False, max_steps, episodes, best_overall)


def search_play(eng, level: int, algo: str, max_iters: int = 100_000,
                timeout_ms: int = 5_000) -> PlayResult:
    """One of the C++ searches, validated by replaying its own action list."""
    s = E.solve_level(eng, level, algo, max_iters=max_iters, timeout_ms=timeout_ms)
    won = bool(s.solved)
    if won and s.actions:
        won = bool(E.replay(eng, level, s.actions)["won"])
    return PlayResult(algo, won, len(s.actions), 1, 1.0 if won else 0.0,
                      list(s.actions) if won else [])


def play_ladder(compiled: E.Compiled, level: int, rng: random.Random | None = None,
                max_iters: int = 100_000, timeout_ms: int = 5_000,
                episodes: int = 10, max_steps: int = 200) -> dict[str, PlayResult]:
    """Run every player on one level, cheapest first."""
    rng = rng or random.Random(0)
    acts = _actions(compiled)
    eng = E.new_engine(compiled)
    out: dict[str, PlayResult] = {}
    out["random"] = random_play(eng, level, acts, rng, max_steps, episodes)
    out["greedy"] = greedy_play(eng, level, acts, rng, max_steps, episodes)
    for algo in SEARCH_PLAYERS:
        out[algo] = search_play(eng, level, algo, max_iters, timeout_ms)
    return out


def insight_gap(results: dict[str, PlayResult]) -> float | None:
    """How much of the myopic ladder fails on a level that search can solve.

    1.0 means search finds a solution that neither random play nor greedy
    hill-climbing ever stumbles into: the level needs a move that looks wrong
    at the time. 0.0 means a myopic player gets there too. ``None`` means no
    search solved the level, so there is nothing to compare against.
    """
    if not any(results[p].won for p in SEARCH_PLAYERS if p in results):
        return None
    myopic = [results[p] for p in MYOPIC_PLAYERS if p in results]
    if not myopic:
        return None
    return sum(1 for r in myopic if not r.won) / len(myopic)


def game_insight(compiled: E.Compiled, levels: list[int] | None = None,
                 **kw: Any) -> dict[str, Any]:
    """Average the insight gap over a game's levels, skipping unsolved ones."""
    levels = levels if levels is not None else E.level_indices(compiled)
    per_level: dict[int, float] = {}
    detail: dict[int, dict[str, bool]] = {}
    for lvl in levels:
        res = play_ladder(compiled, lvl, **kw)
        detail[lvl] = {k: v.won for k, v in res.items()}
        g = insight_gap(res)
        if g is not None:
            per_level[lvl] = g
    return {
        "per_level": per_level,
        "won_by": detail,
        "n_scored": len(per_level),
        "gap": (sum(per_level.values()) / len(per_level)) if per_level else None,
    }


def myopic_gap(compiled: E.Compiled, levels: list[int], rng: random.Random | None = None,
               episodes: int = 6, max_steps: int = 150) -> dict[str, Any]:
    """Insight gap over levels a search has already solved.

    ``play_ladder`` re-runs the searches, which the fitness function has done
    already. When the caller knows search succeeded, only the myopic rungs are
    left to run, and this is roughly an order of magnitude cheaper.
    """
    rng = rng or random.Random(0)
    acts = _actions(compiled)
    eng = E.new_engine(compiled)
    failed = 0
    per_level: dict[int, float] = {}
    for lvl in levels:
        beaten = 0
        for play in (random_play, greedy_play):
            if play(eng, lvl, acts, rng, max_steps, episodes).won:
                beaten += 1
        gap = 1.0 - beaten / 2.0
        per_level[lvl] = gap
        failed += gap
    return {
        "per_level": per_level,
        "n_scored": len(levels),
        "gap": (failed / len(levels)) if levels else None,
    }
