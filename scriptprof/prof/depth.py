"""Measuring whether a level is a puzzle, not just whether it has an exit.

ScriptDoctor's quality signal is "breadth-first search finds a solution".  Its
own paper says why that is not enough: a level with one long corridor scores
exactly as well as a level with an idea in it, and a generator rewarded on
solvability will happily produce corridors.  PuzzleScript's author has made the
sharper version of the same complaint -- that search-driven tools drift toward
games that are hard for a solver and dull for a person.

So this module asks four questions that solvability cannot answer, all of them
about the *shape* of the state space around the solution rather than its
length:

``random_floor``
    Does uniform-random play win?  Hundreds of rollouts at once, and any level
    a random walker beats has no puzzle in it.

``insight``
    Breadth-first search solves it; does greedy best-first on the win-condition
    distance heuristic also solve it?  When it does not, some correct move
    looked locally wrong, which is the cheapest honest proxy for "needs an
    idea" that does not require a trained agent.  It is relative to a specific
    weak player, and deliberately so: the same slot takes a learned policy
    later.

``fragility``
    At each state along the optimal solution, how many of the five moves lose
    the game outright -- reach a state from which no win is reachable?  A level
    where nothing is fatal is a corridor.  A level where everything is fatal is
    a guessing game.  What good puzzles look like is *concentration*: a few
    states where the choice matters and many where it does not, which is what
    ``key_moves`` and ``fatal_gini`` measure.

``deadlock``
    The same question asked away from the solution path, from the endpoints of
    random walks: how much of the space you can wander into is already lost.

The first three need hundreds of short searches from arbitrary states.  That is
the operation the C++ engine cannot do at all -- it searches from a level's
start -- and the one batched PuzzleJAX is built for, so this module is the
reason the JAX path exists.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any

import jax
import numpy as np

from prof import pjax


@dataclass
class LevelDepth:
    level: int
    solved: bool = False
    length: int = 0
    expanded: int = 0
    exhausted: bool = False
    # the weak players
    random_win_frac: float = 0.0
    greedy_solved: bool = False
    greedy_length: int = 0
    # shape of the space around the solution
    fatal_frac: float = 0.0        # mean fraction of moves that lose, over the path
    key_moves: int = 0             # path states where >=3 of 4 alternatives lose
    free_moves: int = 0            # path states where nothing loses
    fatal_gini: float = 0.0        # concentration of danger along the path
    deadlock_frac: float = -1.0    # random-walk endpoints with no win left; -1 unmeasured
    probed: int = 0                # path states the horizon could actually judge
    endgame_only: bool = False     # the path is longer than the horizon
    seconds: float = 0.0
    note: str = ""

    @property
    def insight(self) -> float:
        """1.0 when search solves it and the greedy player does not."""
        if not self.solved:
            return 0.0
        if not self.greedy_solved:
            return 1.0
        # it solved it, but did it need more moves than optimal?
        if self.length and self.greedy_length > self.length:
            return min(0.5, (self.greedy_length - self.length) / max(self.length, 1))
        return 0.0


def _freeze_on_win(won):
    """Hold a state still once it has won, preserving each leaf's dtype.

    ``jnp.where`` promotes under mixed weak types, and a scan carry whose dtype
    shifts between iterations is rejected outright, so the cast is required
    rather than tidy.
    """
    import jax.numpy as jnp

    def pick(x, y):
        return jnp.where(won, x, y).astype(jnp.asarray(x).dtype)

    return pick


def _gini(x: np.ndarray) -> float:
    """Concentration in [0, 1]: 0 when danger is spread evenly along a path."""
    if x.size == 0:
        return 0.0
    s = np.sort(x.astype(float))
    total = s.sum()
    if total <= 0:
        return 0.0
    n = s.size
    return float((2.0 * np.arange(1, n + 1) - n - 1).dot(s) / (n * total))


def analyse_level(lv: pjax.Level, bfs_budget: int = 60_000, bfs_timeout: float = 8.0,
                  survive_depth: int = 12, n_rollouts: int = 384, walk_len: int = 25,
                  n_walks: int = 96, path_cap: int = 40, seed: int = 0) -> LevelDepth:
    """Full depth profile of one level.  Four searches, all batched."""
    t0 = time.time()
    d = LevelDepth(level=lv.index)
    if lv.init_win:
        d.note = "won before any move"
        d.seconds = time.time() - t0
        return d

    roll = lv.rollouts(n=n_rollouts, steps=max(walk_len, 40), seed=seed)
    d.random_win_frac = roll["win_frac"]

    r = lv.bfs(max_states=bfs_budget, timeout_s=bfs_timeout)
    d.solved, d.length, d.expanded, d.exhausted = r.solved, r.length, r.expanded, r.exhausted
    if not d.solved:
        d.note = "unsolved within budget" if not r.exhausted else "unsolvable"
        d.seconds = time.time() - t0
        return d

    g = lv.gbfs(max_states=bfs_budget, timeout_s=bfs_timeout)
    d.greedy_solved, d.greedy_length = g.solved, g.length

    # -- danger along the solution path
    #
    # A sibling state counts as fatal when no win is reachable from it inside
    # `survive_depth` moves.  That judgement is only meaningful where a win was
    # within reach to begin with: at path position i the remaining optimal
    # distance is len(actions) - i, so a state further than the horizon from
    # the end looks fatal in every direction and says nothing.  Probe only the
    # positions the horizon can actually reach, and record when that truncated
    # the path to its endgame.
    actions = r.actions
    reachable = [i for i in range(len(actions))
                 if len(actions) - i <= survive_depth - 1]
    d.endgame_only = len(reachable) < len(actions)
    if not reachable:
        d.note = "solution longer than the survival horizon"
        d.seconds = time.time() - t0
        return d
    if len(reachable) > path_cap:
        step = len(reachable) / path_cap
        keep = sorted({reachable[int(i * step)] for i in range(path_cap)})
    else:
        keep = reachable
    states = lv.path_states(actions)          # len(actions)+1 states
    sel = np.asarray(keep, dtype=np.int64)
    probe_states = jax.tree.map(lambda x: x[sel], states)
    succ = lv.successors(probe_states)        # (len(sel) * 5) successors
    alive = lv.survival(succ, max_depth=survive_depth, seed=seed)
    alive = alive.reshape(len(sel), pjax.N_ACTIONS)
    # the move actually taken is alive by construction; judge the alternatives
    taken = np.asarray([actions[i] for i in keep])
    mask = np.ones_like(alive, dtype=bool)
    mask[np.arange(len(sel)), taken] = False
    fatal = (~alive) & mask
    per_state = fatal.sum(axis=1)             # out of 4 alternatives
    d.fatal_frac = float(per_state.mean() / 4.0)
    d.key_moves = int((per_state >= 3).sum())
    d.free_moves = int((per_state == 0).sum())
    d.fatal_gini = _gini(per_state)
    d.probed = len(keep)

    # -- danger off the path: where does aimless play strand you?
    #
    # Same horizon caveat, and a harsher one: a random walk wanders away from
    # the goal, so on a level whose solution already exceeds the horizon every
    # endpoint would score as deadlocked whether or not anything was lost.
    # Only ask where the start itself is inside the horizon.
    if not d.endgame_only:
        walk = min(walk_len, max(2, survive_depth // 2))
        ends = _walk_endpoints(lv, n_walks, walk, seed)
        if ends is not None:
            surv = lv.survival(ends, max_depth=survive_depth, seed=seed + 1)
            d.deadlock_frac = float(1.0 - surv.mean())
    d.seconds = time.time() - t0
    return d


def _walk_endpoints(lv: pjax.Level, n: int, steps: int, seed: int):
    """Endpoints of ``n`` uniform-random walks, as a batched state pytree."""
    import jax.numpy as jnp

    env, params = lv.game.env, lv.params
    key = jax.random.PRNGKey(seed + 7)

    def walk(k, actions):
        _, st = env.reset(k, params)

        def f(s, a):
            _, ns, _, _, _ = env.step_env(k, s, a, params)
            # stop moving once won, so endpoints stay in the unsolved region
            return jax.tree.map(_freeze_on_win(s.win), s, ns), 0

        out, _ = jax.lax.scan(f, st, actions)
        return out

    keys = jax.random.split(key, n)
    acts = jax.random.randint(jax.random.fold_in(key, 3), (n, steps), 0, pjax.N_ACTIONS)
    fn = lv.game._roll_cache.get(("walk", n, steps))
    if fn is None:
        fn = jax.jit(jax.vmap(walk))
        lv.game._roll_cache[("walk", n, steps)] = fn
    try:
        return pjax._to_np(fn(keys, acts))
    except Exception:  # noqa: BLE001
        return None


@dataclass
class GameDepth:
    n_levels: int = 0
    analysed: int = 0
    solved: int = 0
    levels: list[LevelDepth] = field(default_factory=list)
    seconds: float = 0.0
    error: str = ""

    def agg(self, attr: str, only_solved: bool = True) -> float:
        xs = [getattr(l, attr) for l in self.levels
              if (l.solved or not only_solved) and not l.note.startswith("won before")]
        xs = [x for x in xs if x is not None and x >= 0] if attr == "deadlock_frac" else xs
        return float(np.mean(xs)) if xs else 0.0

    def summary(self) -> str:
        if self.error:
            return f"error: {self.error[:80]}"
        return (f"{self.solved}/{self.analysed} solved  insight={self.agg('insight'):.2f} "
                f"fatal={self.agg('fatal_frac'):.2f} dead={self.agg('deadlock_frac'):.2f} "
                f"key={self.agg('key_moves'):.1f} rand={self.agg('random_win_frac', False):.3f} "
                f"{self.seconds:.1f}s")

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["insight"] = self.agg("insight")
        d["fatal_frac"] = self.agg("fatal_frac")
        d["deadlock_frac"] = self.agg("deadlock_frac")
        d["key_moves"] = self.agg("key_moves")
        d["fatal_gini"] = self.agg("fatal_gini")
        d["random_win_frac"] = self.agg("random_win_frac", only_solved=False)
        return d


def analyse(text: str, max_levels: int = 4, **kw) -> GameDepth:
    """Depth profile of a whole game, over its first few levels."""
    t0 = time.time()
    out = GameDepth()
    try:
        g = pjax.PJGame.from_text(text)
    except pjax.PJError as e:
        out.error = str(e)
        out.seconds = time.time() - t0
        return out
    out.n_levels = g.n_levels
    for i in range(min(max_levels, g.n_levels)):
        try:
            d = analyse_level(g.level(i), **kw)
        except Exception as e:  # noqa: BLE001
            d = LevelDepth(level=i, note=f"{type(e).__name__}: {e}"[:120])
        out.levels.append(d)
        out.analysed += 1
        out.solved += int(d.solved)
    out.seconds = time.time() - t0
    return out
