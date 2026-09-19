"""Measuring whether a level is a puzzle, not just whether it has an exit.

ScriptDoctor's quality signal is "breadth-first search finds a solution".  Its
own paper says why that is not enough: a level with one long corridor scores
exactly as well as a level with an idea in it, and a generator rewarded on
solvability will happily produce corridors.  PuzzleScript's author has made the
sharper version of the same complaint -- that search-driven tools drift toward
games that are hard for a solver and dull for a person.

Four questions solvability cannot answer, all about the *shape* of the state
space around the solution rather than its length:

``random_win_frac``
    Does aimless play win?  Any level a random walker beats has no puzzle in it.

``insight``
    Breadth-first search solves it; does greedy best-first on the win-condition
    distance heuristic also solve it?  When it does not, some correct move
    looked locally wrong, which is the cheapest honest proxy for "needs an
    idea" that does not require a trained agent.  It is relative to a specific
    weak player on purpose; the same slot takes a learned policy later.

``fragility``
    At each state along the optimal solution, how many of the other four moves
    lose the game outright -- reach a state with no win left?  A level where
    nothing is fatal is a corridor; where everything is fatal it is a guessing
    game.  What good puzzles look like is *concentration*: a few states where
    the choice matters and many where it does not, which is what ``key_moves``
    and ``fatal_gini`` measure.

``deadlock_frac``
    The same question away from the solution, from the endpoints of random
    walks: how much of the space you can wander into is already lost.

**Which engine does what, and why.**  The first two questions are searches from
a level's start, and ``prof.bench`` measured the C++ engine at roughly twice
batched PuzzleJAX on this CPU for exactly that -- a batch runs every member to
the same depth, while the C++ solver drops each level the moment it wins -- so
they run in C++, which has its own greedy and random solvers besides.  The last
two need hundreds of short searches from *arbitrary* states, which the C++
engine cannot start from and batched PuzzleJAX does in one tagged frontier.
Neither engine is better; they answer different questions.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np

# The two engines number their actions differently.  The original JavaScript
# engine (and the C++ port that follows it) uses up, left, down, right, action;
# PuzzleJAX uses left, down, right, up, action.  A solution found by one and
# replayed in the other without this mapping silently does something else and
# never wins -- which reads, downstream, as "every alternative move is fatal".
CPP_TO_JAX = [3, 0, 1, 2, 4]


def to_jax_actions(actions: list[int]) -> list[int]:
    return [CPP_TO_JAX[a] if 0 <= a < len(CPP_TO_JAX) else a for a in actions]


@dataclass
class LevelDepth:
    level: int
    solved: bool = False
    length: int = 0
    iterations: int = 0
    # the weak players
    random_win_frac: float = 0.0
    greedy_solved: bool = False
    greedy_length: int = 0
    hill_won: bool | None = None   # committing policy; None if not measured
    hill_steps: int = 0
    # shape of the space around the solution
    fatal_frac: float = 0.0        # mean fraction of moves that lose, over the path
    key_moves: int = 0             # path states where >=3 of 4 alternatives lose
    free_moves: int = 0            # path states where nothing loses
    fatal_gini: float = 0.0        # concentration of danger along the path
    deadlock_frac: float = -1.0    # random-walk endpoints with no win left; -1 unmeasured
    probed: int = 0                # path states the horizon could actually judge
    endgame_only: bool = False     # the path is longer than the horizon
    path_alive: float = -1.0       # sanity check: path states the probe re-solves
    reliable: bool = False         # the fatal numbers passed that check
    seconds: float = 0.0
    note: str = ""

    @property
    def insight(self) -> float:
        """Search solves it; does a player that cannot backtrack?

        Measured against ``Level.hill_climb`` where PuzzleJAX could be built
        for the game, and against the C++ greedy solver otherwise. The
        distinction matters: the C++ "greedy" solver is greedy only in its
        ordering and is still a complete search, and across 350 solved levels
        it failed zero times, so the fallback carries almost no signal and is
        capped accordingly.
        """
        if not self.solved:
            return 0.0
        if self.hill_won is not None:
            return 0.0 if self.hill_won else 1.0
        if not self.greedy_solved:
            return 1.0
        if self.length and self.greedy_length > self.length:
            return min(0.5, (self.greedy_length - self.length) / max(self.length, 1))
        return 0.0

    @property
    def insight_measured(self) -> bool:
        """True only where the committing player actually ran."""
        return self.hill_won is not None


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


# --------------------------------------------------------------------------
# the C++ half: searches from a level's start
# --------------------------------------------------------------------------

def _play_from_start(eng, index: int, max_iters: int, timeout_ms: int,
                     n_roll: int, roll_steps: int, seed: int) -> dict[str, Any]:
    import random as _r

    from prof import engine as E

    out: dict[str, Any] = {}
    eng.load_level(index)
    if eng.check_win():
        return {"note": "won before any move"}
    r = E.solve_level(eng, index, "bfs", max_iters=max_iters, timeout_ms=timeout_ms)
    out["solved"] = bool(r.solved)
    out["actions"] = list(r.actions)
    out["iterations"] = int(r.iterations)
    if not r.solved:
        out["note"] = "unsolved within budget"
        return out
    g = E.solve_level(eng, index, "gbfs", max_iters=max_iters, timeout_ms=timeout_ms)
    out["greedy_solved"] = bool(g.solved)
    out["greedy_length"] = len(g.actions)
    rng = _r.Random(seed)
    wins = 0
    for _ in range(n_roll):
        eng.load_level(index)
        for _ in range(roll_steps):
            eng.process_input(rng.randrange(5))
            if eng.check_win():
                wins += 1
                break
    out["random_win_frac"] = wins / max(n_roll, 1)
    return out


# --------------------------------------------------------------------------
# the PuzzleJAX half: searches from arbitrary states
# --------------------------------------------------------------------------

def _fatal_structure(lv, actions: list[int], survive_depth: int, path_cap: int,
                     n_walks: int, walk_len: int, seed: int, d: LevelDepth,
                     cap: int = 6144, timeout_s: float = 20.0) -> None:
    """Fill in the fatal-move and deadlock fields using batched PuzzleJAX.

    A sibling state counts as fatal when no win is reachable from it inside
    ``survive_depth`` moves.  That judgement only means something where a win
    was within reach to begin with: at path position i the remaining optimal
    distance is ``len(actions) - i``, so a state further than the horizon from
    the end looks fatal in every direction and says nothing.  Only positions
    the horizon can reach are probed, and ``endgame_only`` records when that
    truncated the path.
    """
    import jax

    from prof import pjax

    reachable = [i for i in range(len(actions)) if len(actions) - i <= survive_depth - 1]
    d.endgame_only = len(reachable) < len(actions)
    if not reachable:
        d.note = "solution longer than the survival horizon"
        return
    if len(reachable) > path_cap:
        step = len(reachable) / path_cap
        keep = sorted({reachable[int(i * step)] for i in range(path_cap)})
    else:
        keep = reachable
    jax_actions = to_jax_actions(actions)
    states = lv.path_states(jax_actions)
    sel = np.asarray(keep, dtype=np.int64)
    probe = jax.tree.map(lambda x: x[sel], states)
    # The states on the optimal path are known to be winnable inside the
    # horizon -- that is how `keep` was chosen.  Probing them alongside their
    # siblings costs one extra root each and turns "every move is fatal" from
    # an unfalsifiable reading into a testable one: if the search cannot
    # re-find the win it was handed, the frontier cap pruned it, and the
    # sibling verdicts are pruning artefacts too.
    n = len(sel)
    path_alive = lv.survival(probe, max_depth=survive_depth, cap=cap,
                             timeout_s=timeout_s, seed=seed)
    d.path_alive = float(path_alive.mean())
    d.reliable = d.path_alive >= 0.95
    if not d.reliable:
        # Checking the path first costs a fifth of the full probe and saves the
        # rest, which matters because games with a big branching factor -- the
        # ones evolution produces most of -- fail here almost every time.
        d.note = (d.note + " | " if d.note else "") + \
            f"fatal unreliable: horizon re-solved only {100 * d.path_alive:.0f}% of the path"
        d.probed = 0
        return
    succ = lv.successors(probe)
    alive = lv.survival(succ, max_depth=survive_depth, cap=cap,
                        timeout_s=timeout_s, seed=seed).reshape(n, pjax.N_ACTIONS)
    taken = np.asarray([jax_actions[i] for i in keep])
    mask = np.ones_like(alive, dtype=bool)
    mask[np.arange(n), taken] = False
    per_state = ((~alive) & mask).sum(axis=1)
    d.fatal_frac = float(per_state.mean() / 4.0)
    d.key_moves = int((per_state >= 3).sum())
    d.free_moves = int((per_state == 0).sum())
    d.fatal_gini = _gini(per_state)
    d.probed = len(keep)
    # Away from the path the horizon caveat bites harder: a random walk moves
    # away from the goal, so on a level whose solution already exceeds the
    # horizon every endpoint scores as deadlocked whether or not anything was
    # lost.  Only ask where the start itself is inside the horizon.
    if not d.endgame_only:
        ends = _walk_endpoints(lv, n_walks, min(walk_len, max(2, survive_depth // 2)), seed)
        if ends is not None:
            surv = lv.survival(ends, max_depth=survive_depth, cap=cap,
                               timeout_s=timeout_s, seed=seed + 1)
            d.deadlock_frac = float(1.0 - surv.mean())


def _walk_endpoints(lv, n: int, steps: int, seed: int):
    """Endpoints of ``n`` uniform-random walks, as a batched state pytree."""
    import jax
    import jax.numpy as jnp

    from prof import pjax

    env, params = lv.game.env, lv.params
    key = jax.random.PRNGKey(seed + 7)

    def walk(k, actions):
        _, st = env.reset(k, params)

        def f(s, a):
            _, ns, _, _, _ = env.step_env(k, s, a, params)
            frozen = jax.tree.map(
                lambda x, y: jnp.where(s.win, x, y).astype(jnp.asarray(x).dtype), s, ns)
            return frozen, 0

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
    except Exception:  # noqa: BLE001 -- PuzzleJAX does not cover every game
        return None


# --------------------------------------------------------------------------
# putting the halves together
# --------------------------------------------------------------------------

@dataclass
class GameDepth:
    n_levels: int = 0
    analysed: int = 0
    solved: int = 0
    structured: int = 0            # levels the PuzzleJAX half could also judge
    rules: int = 0
    structure_skipped: bool = False   # too many rules to trace in PuzzleJAX
    levels: list[LevelDepth] = field(default_factory=list)
    seconds: float = 0.0
    error: str = ""

    STRUCTURAL = {"fatal_frac", "key_moves", "free_moves", "fatal_gini"}
    POLICY = {"insight"}

    def agg(self, attr: str, only_solved: bool = True) -> float:
        levels = [l for l in self.levels
                  if (l.solved or not only_solved) and not l.note.startswith("won before")]
        if attr in self.STRUCTURAL:
            levels = [l for l in levels if l.reliable]
        if attr in self.POLICY:
            measured = [l for l in levels if l.insight_measured]
            levels = measured or levels
        xs = [getattr(l, attr) for l in levels]
        if attr == "deadlock_frac":
            xs = [x for x in xs if x is not None and x >= 0]
        return float(np.mean(xs)) if xs else 0.0

    @property
    def reliable_levels(self) -> int:
        return sum(1 for l in self.levels if l.reliable)

    def summary(self) -> str:
        if self.error:
            return f"error: {self.error[:80]}"
        return (f"{self.solved}/{self.analysed} solved  insight={self.agg('insight'):.2f} "
                f"fatal={self.agg('fatal_frac'):.2f} gini={self.agg('fatal_gini'):.2f} "
                f"key={self.agg('key_moves'):.1f} rand={self.agg('random_win_frac', False):.3f} "
                f"rel={self.reliable_levels}/{self.analysed} "
                f"{self.seconds:.1f}s")

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        for m in ("insight", "fatal_frac", "deadlock_frac", "key_moves", "fatal_gini"):
            d[m] = self.agg(m)
        d["reliable_levels"] = self.reliable_levels
        d["insight_measured"] = sum(1 for l in self.levels if l.insight_measured)
        d["random_win_frac"] = self.agg("random_win_frac", only_solved=False)
        return d


def analyse(text: str, max_levels: int = 4, max_iters: int = 120_000,
            timeout_ms: int = 5000, survive_depth: int = 14, path_cap: int = 40,
            n_roll: int = 60, roll_steps: int = 60, n_walks: int = 64,
            walk_len: int = 12, seed: int = 0, structure: bool = True,
            cap: int = 6144, structure_timeout_s: float = 20.0,
            max_rules_for_structure: int = 16) -> GameDepth:
    """Depth profile of a game over its first few levels.

    Set ``structure=False`` to skip the PuzzleJAX half, which is most of the
    cost, and keep only solvability, insight and the random floor.
    """
    from prof import engine as E

    t0 = time.time()
    out = GameDepth()
    try:
        compiled = E.compile_text(text)
        eng = E.new_engine(compiled)
        idxs = E.level_indices(compiled)
    except Exception as e:  # noqa: BLE001
        out.error = f"{type(e).__name__}: {e}"[:160]
        out.seconds = time.time() - t0
        return out
    out.n_levels = len(idxs)
    idxs = idxs[:max_levels]
    if not idxs:
        out.error = "no playable levels"
        out.seconds = time.time() - t0
        return out

    plays: list[tuple[int, dict[str, Any]]] = []
    for i in idxs:
        try:
            plays.append((i, _play_from_start(eng, i, max_iters, timeout_ms,
                                              n_roll, roll_steps, seed)))
        except Exception as e:  # noqa: BLE001
            plays.append((i, {"note": f"{type(e).__name__}: {e}"[:110]}))

    # PuzzleJAX unrolls every rule into the traced graph, so its cost scales
    # with rule count in a way the C++ engine's does not.  Measured on this
    # CPU: sokoban_basic (5 rules) traces in 1.8s and then runs at 170k
    # states/s; a 30-rule evolved descendant of it traces for 166s and then
    # runs at 456.  Evolution adds rules, so the structural half has to be
    # gated on rule count or it swallows the whole budget on the games it can
    # say least about.
    pj = None
    n_rules = 0
    if structure and any(p.get("solved") for _, p in plays):
        try:
            from prof.grammar import Game

            n_rules = sum(1 for r in Game.parse(text).rules if r.parsed)
        except Exception:  # noqa: BLE001
            n_rules = 10 ** 6
        if n_rules <= max_rules_for_structure:
            try:
                from prof import pjax

                pj = pjax.PJGame.from_text(text)
            except Exception:  # noqa: BLE001
                pj = None
    out.rules = n_rules
    out.structure_skipped = bool(structure and pj is None
                                 and n_rules > max_rules_for_structure)

    for i, p in plays:
        d = LevelDepth(level=i)
        d.note = p.get("note", "")
        d.solved = bool(p.get("solved"))
        d.iterations = int(p.get("iterations", 0))
        actions = p.get("actions", [])
        d.length = len(actions)
        d.greedy_solved = bool(p.get("greedy_solved"))
        d.greedy_length = int(p.get("greedy_length", 0))
        d.random_win_frac = float(p.get("random_win_frac", 0.0))
        if d.solved and pj is not None:
            t1 = time.time()
            try:
                lv = pj.level(i)
                try:
                    hc = lv.hill_climb(seed=seed, timeout_s=structure_timeout_s)
                    d.hill_won = bool(hc["won"])
                    d.hill_steps = int(hc["steps"])
                except Exception:  # noqa: BLE001
                    d.hill_won = None
                _fatal_structure(lv, actions, survive_depth, path_cap,
                                 n_walks, walk_len, seed, d, cap=cap,
                                 timeout_s=structure_timeout_s)
                # only count a level the probe could actually judge: the
                # horizon and reliability bails both return without raising
                out.structured += int(d.reliable and d.probed > 0)
            except Exception as e:  # noqa: BLE001
                d.note = (d.note + " | " if d.note else "") + \
                    f"structure: {type(e).__name__}"[:60]
            d.seconds = time.time() - t1
        out.levels.append(d)
        out.analysed += 1
        out.solved += int(d.solved)
    out.seconds = time.time() - t0
    return out
