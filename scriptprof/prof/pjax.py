"""In-memory PuzzleJAX: load a game from a string, search it with batched JAX.

The vendored PuzzleJAX pipeline is file-oriented -- it reads a game out of
``data/scraped_games``, writes a simplified copy, a pickled tree and a pretty
tree, then builds an environment.  Evolution generates thousands of games that
never need to touch a disk, so :func:`parse` runs the same transforms in
memory:

    text -> preprocess_ps -> Lark -> StripPuzzleScript -> GenPSTree -> env

The reason to go through PuzzleJAX at all is the batched step function.  One
PuzzleScript step is a few hundred tensor ops; under ``vmap`` the same work
runs across a whole search frontier at once.  So the searches here expand a
*layer at a time*: every frontier state crossed with every action in one
jitted call, with dedup and bookkeeping done on the host in numpy.

Every jitted call uses the **same** batch shape.  That matters more than
anything else here: a ragged frontier chunk retraces the step function, and
tracing a PuzzleScript rule loop costs seconds, so a search that resizes its
batch spends all its time in the compiler and none in the environment.
Frontier chunks are therefore padded to a fixed width and masked.

    g = PJGame.from_text(open("sokoban_basic.txt").read())
    r = g.level(0).bfs(max_states=50_000)
    r.solved, r.actions, r.expanded

Searches: :meth:`Level.bfs` (optimal, the ground truth), :meth:`Level.gbfs`
(greedy on PuzzleJAX's win-condition heuristic) and :meth:`Level.rollouts`
(batched random play).  The gap between what BFS finds and what the greedy and
random players find is the raw material for the depth metrics in
``prof.depth``.
"""
from __future__ import annotations

import heapq
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor" / "script-doctor"
if str(VENDOR) not in sys.path:
    sys.path.insert(0, str(VENDOR))

os.environ.setdefault("JAX_PLATFORMS", "cpu")

import jax  # noqa: E402
import jax.numpy as jnp  # noqa: E402
import numpy as np  # noqa: E402

N_ACTIONS = 5  # left, down, right, up, action
ACTION_NAMES = ["left", "down", "right", "up", "action"]

_parser = None
_parser_lock = threading.Lock()


class PJError(Exception):
    """Game could not be turned into a PuzzleJAX environment."""


def _lark():
    global _parser
    with _parser_lock:
        if _parser is None:
            from lark import Lark

            from puzzlescript_jax.globals import LARK_SYNTAX_PATH

            with open(LARK_SYNTAX_PATH, encoding="utf-8") as fh:
                _parser = Lark(fh.read(), start="ps_game", maybe_placeholders=False)
    return _parser


def parse(text: str):
    """PuzzleScript source -> ``PSGameTree``, entirely in memory."""
    from puzzlescript_jax.gen_tree import GenPSTree
    from puzzlescript_jax.preprocessing import StripPuzzleScript, preprocess_ps

    try:
        content = preprocess_ps(text)
    except Exception as e:  # noqa: BLE001
        raise PJError(f"preprocess: {type(e).__name__}: {e}") from e
    try:
        tree = _lark().parse(content)
    except Exception as e:  # noqa: BLE001
        raise PJError(f"parse: {type(e).__name__}: {str(e)[:300]}") from e
    try:
        return GenPSTree().transform(StripPuzzleScript().transform(tree))
    except Exception as e:  # noqa: BLE001
        raise PJError(f"tree: {type(e).__name__}: {str(e)[:300]}") from e


@dataclass
class SearchResult:
    solved: bool = False
    actions: list[int] = field(default_factory=list)
    expanded: int = 0          # states popped and expanded
    generated: int = 0         # successors produced (with duplicates)
    distinct: int = 0          # distinct states seen
    depth: int = 0             # layers explored
    exhausted: bool = False    # the whole reachable space was searched
    timed_out: bool = False
    seconds: float = 0.0
    layer_sizes: list[int] = field(default_factory=list)

    @property
    def length(self) -> int:
        return len(self.actions)

    def brief(self) -> str:
        s = "win" if self.solved else ("exhausted" if self.exhausted else "budget")
        return f"{s} len={self.length} exp={self.expanded} d={self.depth} {self.seconds:.2f}s"


def _to_np(tree) -> Any:
    return jax.tree.map(lambda x: np.asarray(x), tree)


def _hash_levels(arr: np.ndarray) -> np.ndarray:
    """Stable 64-bit FNV-1a hash per state in a batch of multihot levels."""
    flat = arr.reshape(arr.shape[0], -1)
    packed = np.packbits(flat.astype(np.uint8), axis=1)
    # view the packed bytes as uint64 columns, padding to a multiple of 8
    pad = (-packed.shape[1]) % 8
    if pad:
        packed = np.pad(packed, ((0, 0), (0, pad)))
    cols = packed.view(np.uint64)
    h = np.full(cols.shape[0], np.uint64(0xCBF29CE484222325), dtype=np.uint64)
    prime = np.uint64(0x100000001B3)
    with np.errstate(over="ignore"):
        for j in range(cols.shape[1]):
            h = (h ^ cols[:, j]) * prime
    return h


def _pad_to(tree_np, n: int):
    """Repeat the last row until the leading dim is exactly ``n``."""
    cur = jax.tree.leaves(tree_np)[0].shape[0]
    if cur == n:
        return tree_np
    reps = np.concatenate([np.arange(cur), np.full(n - cur, cur - 1)])
    return jax.tree.map(lambda x: x[reps], tree_np)


class Level:
    """One level of one game, with batched searches over it."""

    def __init__(self, game: "PJGame", index: int):
        from puzzlescript_jax.env import PJParams

        self.game = game
        self.index = index
        env = game.env
        self.params = PJParams(level=env.get_level(index), level_i=index)
        self.key = jax.random.PRNGKey(0)
        _, st = env.reset(self.key, self.params)
        self.init_state = _to_np(st)
        self.init_win = bool(self.init_state.win)
        self.init_heuristic = int(self.init_state.heuristic)
        self.shape = tuple(int(x) for x in self.init_state.multihot_level.shape)
        self.cells = int(np.prod(self.shape))

    # -- the one jitted kernel --------------------------------------------

    def _expander(self, batch: int):
        """``(batch states) -> (batch, 5) successors``, jitted per batch size.

        Cached on the *game* so every level of a game with a common board
        shape reuses one compilation.
        """
        key = (self.game._shape_key(self.index), batch)
        f = self.game._expand_cache.get(key)
        if f is not None:
            return f
        env, params, rng = self.game.env, self.params, self.key

        def one(state, action):
            _, ns, _, _, _ = env.step_env(rng, state, action, params)
            return ns

        def expand(states):
            outs = [jax.vmap(one, in_axes=(0, None))(states, a) for a in range(N_ACTIONS)]
            return jax.tree.map(lambda *xs: jnp.stack(xs, axis=1), *outs)

        f = jax.jit(expand)
        self.game._expand_cache[key] = f
        return f

    def _step_batch(self, states_np, n_valid: int, batch: int):
        """Expand ``n_valid`` states (padded to ``batch``) into flat successors."""
        padded = _pad_to(states_np, batch)
        succ = self._expander(batch)(jax.tree.map(jnp.asarray, padded))
        succ = _to_np(succ)
        keep = n_valid * N_ACTIONS
        flat = jax.tree.map(lambda x: x.reshape(batch * N_ACTIONS, *x.shape[2:])[:keep], succ)
        return flat

    # -- searches ----------------------------------------------------------

    def bfs(self, max_states: int = 200_000, max_depth: int = 500,
            batch: int = 512, timeout_s: float = 20.0) -> SearchResult:
        """Breadth-first search, one layer per jitted call.

        Optimal, so the first win is at minimum depth.  ``exhausted`` means the
        reachable space ran out: the level is unsolvable, not merely hard.
        """
        t0 = time.time()
        r = SearchResult()
        if self.init_win:
            r.solved = True
            return r
        frontier = jax.tree.map(lambda x: x[None], self.init_state)
        n_front = 1
        seen = set(_hash_levels(self.init_state.multihot_level[None]).tolist())
        r.distinct = 1
        trail: list[tuple[np.ndarray, np.ndarray]] = []
        for _ in range(max_depth):
            r.layer_sizes.append(n_front)
            if n_front == 0:
                r.exhausted = True
                break
            if r.distinct > max_states:
                break
            if time.time() - t0 > timeout_s:
                r.timed_out = True
                break
            par_all, act_all, keep_parts = [], [], []
            for lo in range(0, n_front, batch):
                hi = min(lo + batch, n_front)
                n = hi - lo
                chunk = jax.tree.map(lambda x: x[lo:hi], frontier)
                flat = self._step_batch(chunk, n, batch)
                r.expanded += n
                r.generated += n * N_ACTIONS
                wins = flat.win.reshape(-1)
                par = np.repeat(np.arange(lo, hi), N_ACTIONS)
                act = np.tile(np.arange(N_ACTIONS), n)
                w = np.flatnonzero(wins)
                if w.size:
                    i = int(w[0])
                    trail.append((par[i: i + 1], act[i: i + 1]))
                    r.solved = True
                    r.depth = len(trail)
                    r.actions = self._backtrack(trail, 0)
                    r.seconds = time.time() - t0
                    return r
                h = _hash_levels(flat.multihot_level)
                fresh = self._fresh(h, seen)
                if fresh.size:
                    par_all.append(par[fresh])
                    act_all.append(act[fresh])
                    keep_parts.append(jax.tree.map(lambda x: x[fresh], flat))
                r.distinct = len(seen)
            if not keep_parts:
                n_front = 0
                r.exhausted = True
                r.layer_sizes.append(0)
                break
            frontier = (keep_parts[0] if len(keep_parts) == 1
                        else jax.tree.map(lambda *xs: np.concatenate(xs, axis=0), *keep_parts))
            par_c, act_c = np.concatenate(par_all), np.concatenate(act_all)
            trail.append((par_c, act_c))
            n_front = int(act_c.size)
        r.depth = len(trail)
        r.seconds = time.time() - t0
        return r

    @staticmethod
    def _fresh(h: np.ndarray, seen: set) -> np.ndarray:
        """Indices of hashes not already in ``seen``; updates ``seen``."""
        uniq, first = np.unique(h, return_index=True)
        keep = [i for u, i in zip(uniq.tolist(), first.tolist()) if u not in seen]
        if not keep:
            return np.empty(0, dtype=np.int64)
        idx = np.sort(np.asarray(keep, dtype=np.int64))
        seen.update(h[idx].tolist())
        return idx

    def _backtrack(self, trail: list[tuple[np.ndarray, np.ndarray]], idx: int) -> list[int]:
        actions: list[int] = []
        i = idx
        for depth in range(len(trail) - 1, -1, -1):
            par, act = trail[depth]
            actions.append(int(act[i]))
            i = int(par[i])
        actions.reverse()
        return actions

    def gbfs(self, max_states: int = 200_000, width: int = 4096, batch: int = 512,
             timeout_s: float = 20.0) -> SearchResult:
        """Greedy best-first on PuzzleJAX's built-in win-condition heuristic.

        This is the "obvious" player: always move toward the goal as a
        distance metric sees it.  A level that BFS solves and this does not
        needs a move that locally looks wrong, which ``prof.depth`` turns into
        the insight gap.  ``width`` caps the open list, so this is really a
        very wide beam and can fail on a solvable level -- which is the point.
        """
        t0 = time.time()
        r = SearchResult()
        if self.init_win:
            r.solved = True
            return r
        # open nodes: states held in a numpy buffer, ancestry in flat lists
        open_states = jax.tree.map(lambda x: x[None], self.init_state)
        open_ids = [0]
        parent_of: list[int] = [-1]
        action_of: list[int] = [-1]
        pq = [(-self.init_heuristic, 0, 0)]  # PuzzleJAX heuristic is higher-is-better
        seen = set(_hash_levels(self.init_state.multihot_level[None]).tolist())
        r.distinct = 1
        tie = 1
        slot_of = {0: 0}
        while pq and r.distinct < max_states and time.time() - t0 < timeout_s:
            take = min(len(pq), batch)
            popped = [heapq.heappop(pq) for _ in range(take)]
            ids = [p[2] for p in popped]
            rows = np.asarray([slot_of[i] for i in ids])
            chunk = jax.tree.map(lambda x: x[rows], open_states)
            flat = self._step_batch(chunk, take, batch)
            r.expanded += take
            r.generated += take * N_ACTIONS
            wins = flat.win.reshape(-1)
            w = np.flatnonzero(wins)
            if w.size:
                i = int(w[0])
                node, a = ids[i // N_ACTIONS], int(i % N_ACTIONS)
                acts = [a]
                while node > 0:
                    acts.append(action_of[node])
                    node = parent_of[node]
                acts.reverse()
                r.solved = True
                r.actions = acts
                r.depth = len(acts)
                r.seconds = time.time() - t0
                return r
            h = _hash_levels(flat.multihot_level)
            fresh = self._fresh(h, seen)
            r.distinct = len(seen)
            if fresh.size == 0:
                continue
            heur = flat.heuristic.reshape(-1)[fresh]
            new_states = jax.tree.map(lambda x: x[fresh], flat)
            base = len(parent_of)
            for k, i in enumerate(fresh.tolist()):
                parent_of.append(ids[i // N_ACTIONS])
                action_of.append(int(i % N_ACTIONS))
                heapq.heappush(pq, (-int(heur[k]), tie, base + k))
                tie += 1
            # rebuild the open-state buffer around whatever survives the cap
            if len(pq) > width:
                pq = heapq.nsmallest(width, pq)
                heapq.heapify(pq)
            survivors = [p[2] for p in pq]
            keep_old = [i for i in survivors if i in slot_of]
            keep_new = [i for i in survivors if i not in slot_of]
            parts = []
            if keep_old:
                parts.append(jax.tree.map(lambda x: x[np.asarray([slot_of[i] for i in keep_old])], open_states))
            if keep_new:
                parts.append(jax.tree.map(lambda x: x[np.asarray([i - base for i in keep_new])], new_states))
            open_states = parts[0] if len(parts) == 1 else jax.tree.map(
                lambda *xs: np.concatenate(xs, axis=0), *parts)
            slot_of = {i: s for s, i in enumerate(keep_old + keep_new)}
        r.exhausted = not pq
        r.timed_out = time.time() - t0 >= timeout_s
        r.seconds = time.time() - t0
        return r

    # -- multi-root reachability ------------------------------------------

    def path_states(self, actions: list[int]):
        """The states visited by following ``actions`` from the start."""
        env, params, rng = self.game.env, self.params, self.key
        st = jax.tree.map(jnp.asarray, self.init_state)
        out = [self.init_state]
        for a in actions:
            _, st, _, _, _ = env.step_env(rng, st, int(a), params)
            out.append(_to_np(st))
        return jax.tree.map(lambda *xs: np.stack(xs), *out)

    def successors(self, states_np, batch: int = 512):
        """All five successors of each of a batch of states, flattened."""
        n = jax.tree.leaves(states_np)[0].shape[0]
        parts = []
        for lo in range(0, n, batch):
            hi = min(lo + batch, n)
            parts.append(self._step_batch(
                jax.tree.map(lambda x: x[lo:hi], states_np), hi - lo, batch))
        return (parts[0] if len(parts) == 1
                else jax.tree.map(lambda *xs: np.concatenate(xs, axis=0), *parts))

    def survival(self, roots_np, max_depth: int = 14, batch: int = 512,
                 cap: int = 6144, timeout_s: float = 8.0, seed: int = 0) -> np.ndarray:
        """For each root state, is a win still reachable within ``max_depth``?

        One breadth-first sweep carrying every root at once, with each frontier
        state tagged by the root it descends from.  Running the roots together
        is the whole point: a hundred separate bounded searches would each pay
        their own dispatch and their own ragged batches, while this is a single
        stream of full-width jitted calls.

        The frontier is capped, so a ``False`` means "no win found within the
        budget" rather than a proof of deadlock.  It is a lower bound on
        survival, and the bound is what the deadlock and key-move metrics in
        ``prof.depth`` are built from.
        """
        rng = np.random.default_rng(seed)
        n_roots = int(jax.tree.leaves(roots_np)[0].shape[0])
        alive = np.zeros(n_roots, dtype=bool)
        alive |= np.asarray(roots_np.win).reshape(-1)
        live = ~alive
        if not live.any():
            return alive
        idx = np.flatnonzero(live)
        frontier = jax.tree.map(lambda x: x[idx], roots_np)
        tags = idx.copy()
        seen: set[tuple[int, int]] = set()
        t0 = time.time()
        for _ in range(max_depth):
            n = tags.size
            if n == 0 or time.time() - t0 > timeout_s:
                break
            flat = self.successors(frontier, batch=batch)
            wins = flat.win.reshape(-1)
            child_tags = np.repeat(tags, N_ACTIONS)
            if wins.any():
                alive[np.unique(child_tags[wins])] = True
            keep = ~np.isin(child_tags, np.flatnonzero(alive))
            if not keep.any():
                break
            h = _hash_levels(flat.multihot_level)
            pairs = list(zip(h.tolist(), child_tags.tolist()))
            fresh = [i for i in np.flatnonzero(keep).tolist() if pairs[i] not in seen]
            if not fresh:
                break
            seen.update(pairs[i] for i in fresh)
            sel = np.asarray(fresh, dtype=np.int64)
            if sel.size > cap:
                sel = np.sort(rng.choice(sel, cap, replace=False))
            frontier = jax.tree.map(lambda x: x[sel], flat)
            tags = child_tags[sel]
        return alive

    def replay(self, actions: list[int]) -> dict[str, Any]:
        """Run a fixed action sequence, reporting where it first wins."""
        if not actions:
            return {"win": self.init_win, "steps": 0}
        env, params, rng = self.game.env, self.params, self.key
        st = jax.tree.map(jnp.asarray, self.init_state)
        for i, a in enumerate(actions):
            _, st, _, _, _ = env.step_env(rng, st, int(a), params)
            if bool(np.asarray(st.win)):
                return {"win": True, "steps": i + 1}
        return {"win": False, "steps": len(actions)}

    def rollouts(self, n: int = 512, steps: int = 80, seed: int = 0) -> dict[str, Any]:
        """Batched uniform-random play: the floor any real puzzle must clear.

        A level a random walker wins is a level with no puzzle in it.
        """
        env, params = self.game.env, self.params
        key = jax.random.PRNGKey(seed)

        def roll(k, actions):
            _, st = env.reset(k, params)

            def f(s, a):
                _, ns, _, _, _ = env.step_env(k, s, a, params)
                # freeze on win so a later move cannot undo it; the cast keeps
                # every carry leaf at its own dtype, which scan requires
                s2 = jax.tree.map(
                    lambda x, y: jnp.where(s.win, x, y).astype(jnp.asarray(x).dtype), s, ns)
                return s2, (s2.win, s2.heuristic)

            _, out = jax.lax.scan(f, st, actions)
            return out

        keys = jax.random.split(key, n)
        acts = jax.random.randint(jax.random.fold_in(key, 1), (n, steps), 0, N_ACTIONS)
        fn = self.game._roll_cache.get((n, steps))
        if fn is None:
            fn = jax.jit(jax.vmap(roll))
            self.game._roll_cache[(n, steps)] = fn
        wins, heur = fn(keys, acts)
        wins, heur = np.asarray(wins), np.asarray(heur)
        won = wins.any(axis=1)
        return {
            "n": n, "steps": steps,
            "win_frac": float(won.mean()),
            "mean_win_step": float(np.argmax(wins[won], axis=1).mean()) if won.any() else -1.0,
            "best_heuristic": int(heur.max()),
            "init_heuristic": self.init_heuristic,
        }


class PJGame:
    """A parsed game plus its PuzzleJAX environment and per-level searches."""

    def __init__(self, tree, jit: bool = True, max_steps: int = 10_000):
        from puzzlescript_jax.env import PuzzleJaxEnv

        self.tree = tree
        try:
            self.env = PuzzleJaxEnv(tree, jit=jit, level_i=0, max_steps=max_steps,
                                    print_score=False, debug=False, vmap=True)
        except Exception as e:  # noqa: BLE001
            raise PJError(f"env: {type(e).__name__}: {str(e)[:300]}") from e
        self._expand_cache: dict[Any, Any] = {}
        self._roll_cache: dict[Any, Any] = {}
        self._levels: dict[int, Level] = {}

    @classmethod
    def from_text(cls, text: str, **kw) -> "PJGame":
        return cls(parse(text), **kw)

    def _shape_key(self, level_i: int):
        """Levels that pad to the same board share a compiled step function."""
        return (int(self.env._board_height), int(self.env._board_width))

    @property
    def n_levels(self) -> int:
        return len(self.env.levels)

    @property
    def n_objects(self) -> int:
        return int(self.env.n_objs)

    def has_randomness(self) -> bool:
        try:
            return bool(self.env.has_randomness())
        except Exception:  # noqa: BLE001
            return False

    def level(self, i: int) -> Level:
        if i not in self._levels:
            self._levels[i] = Level(self, i)
        return self._levels[i]
