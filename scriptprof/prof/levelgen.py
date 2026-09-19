"""Generating levels with the solver inside the loop, hundreds at a time.

ScriptDoctor's finding was that language models write passable PuzzleScript
rules and poor PuzzleScript levels, and the reason is structural: a level is
only good relative to what the rules make of it, and no amount of reading the
source tells you that.  You have to play it.

Playing a candidate level is cheap; playing ten thousand is not, unless they
can be played at once.  They can.  ``PJParams`` carries the level as a tensor,
so ``vmap`` over that field runs hundreds of *different* levels through one
compiled step function -- measured at 79k level-steps/s on this CPU against a
2-10 s trace paid once for the whole population.  That is the one place
PuzzleJAX is decisively better than the C++ engine rather than marginally so,
and this module is built on it.

The loop is a batched hill climb:

1. sample a population of level layouts over the game's own legend alphabet;
2. search all of them together for a win, recording the depth at which each
   first reaches one;
3. score each by how close that depth is to a target, rejecting anything a
   random walker also wins;
4. keep the best, mutate them, repeat.

    gen = LevelGen(game_text, height=8, width=8)
    best = gen.run(pop=128, generations=12, target_len=18)
    new_source = gen.install(best)     # the game, with its levels replaced
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any

import jax
import jax.numpy as jnp
import numpy as np

from prof import pjax
from prof.grammar import Game, Level

N_ACTIONS = pjax.N_ACTIONS


@dataclass
class Candidate:
    rows: list[str]
    win_depth: int = -1          # moves to the first win found, -1 if none
    random_win: float = 0.0      # fraction of random rollouts that win
    score: float = -9.9

    def copy(self) -> "Candidate":
        return Candidate(list(self.rows), self.win_depth, self.random_win, self.score)


class LevelGen:
    """Batched level search for one game, with its rules held fixed."""

    def __init__(self, text: str, height: int = 8, width: int = 8,
                 max_steps: int = 2000):
        self.struct = Game.parse(text)
        # Levels must all share one shape or they cannot share a compilation,
        # so the game is rebuilt with a single placeholder level of the target
        # size before the environment is created.
        self.height, self.width = height, width
        self.alphabet = self._alphabet()
        if len(self.alphabet) < 2:
            raise pjax.PJError("game has too small a level alphabet to generate into")
        self.bg = self.struct.background_char()
        if self.bg not in self.alphabet:
            self.bg = self.alphabet[0]
        probe = self.struct.copy()
        probe.levels = [Level([self.bg * width for _ in range(height)])]
        probe.touch("LEVELS")
        self.game = pjax.PJGame.from_text(probe.emit(), max_steps=max_steps)
        self.env = self.game.env
        self.key = jax.random.PRNGKey(0)
        self._expand = {}
        self._reset = None
        self._roll = {}
        # which characters the environment will actually accept
        self.alphabet = [c for c in self.alphabet
                         if c.lower() in getattr(self.env, "chars_to_idxs", {c.lower(): 0})]
        self.player_chars = self._player_chars()
        self._freq = self.census()

    def _alphabet(self) -> list[str]:
        return sorted(self.struct.level_alphabet())

    def _player_chars(self) -> list[str]:
        table = self.struct.all_symbols()
        out = []
        for ch in self.alphabet:
            members = table.get(ch.lower(), [])
            if any("player" in m.lower() for m in members):
                out.append(ch)
        return out

    # -- turning character grids into a batch ------------------------------

    def to_multihot(self, rows: list[str]) -> np.ndarray:
        grid = np.array([list(r) for r in rows])
        return np.asarray(self.env.char_level_to_multihot(grid))

    def params_batch(self, cands: list[Candidate]):
        from puzzlescript_jax.env import PJParams

        levels = np.stack([self.to_multihot(c.rows) for c in cands])
        return PJParams(level=jnp.asarray(levels),
                        level_i=jnp.zeros(len(cands), dtype=jnp.int32))

    # -- the two jitted kernels, both vmapped over levels ------------------

    def _reset_fn(self):
        if self._reset is None:
            env, key = self.env, self.key
            self._reset = jax.jit(jax.vmap(lambda p: env.reset(key, p)[1]))
        return self._reset

    def _expander(self, batch: int):
        """``(batch states, batch params) -> (batch, 5)`` successors.

        Both state and params are vmapped.  ``step_env`` reads params only to
        service a ``restart`` command, but a game that restarts must restart
        into *its own* level, so carrying params through keeps the batch exact
        instead of merely close.
        """
        f = self._expand.get(batch)
        if f is not None:
            return f
        env, key = self.env, self.key

        def one(state, params, action):
            _, ns, _, _, _ = env.step_env(key, state, action, params)
            return ns

        def expand(states, params):
            outs = [jax.vmap(one, in_axes=(0, 0, None))(states, params, a)
                    for a in range(N_ACTIONS)]
            return jax.tree.map(lambda *xs: jnp.stack(xs, axis=1), *outs)

        f = jax.jit(expand)
        self._expand[batch] = f
        return f

    # -- evaluation --------------------------------------------------------

    def solve_batch(self, cands: list[Candidate], max_depth: int = 26,
                    cap: int = 4096, timeout_s: float = 60.0) -> None:
        """Breadth-first search every candidate at once; fill in ``win_depth``.

        One frontier holds states from every level, each tagged with the level
        it came from, so a layer of the search is a single full-width jitted
        call no matter how the work is distributed across the population.
        Capping the frontier makes an unfound win mean "not within the budget"
        rather than "impossible", which for level *generation* is the right
        reading anyway: a level whose solution the search cannot find is not
        one to ship.
        """
        n = len(cands)
        if not n:
            return
        params = self.params_batch(cands)
        states = pjax._to_np(self._reset_fn()(params))
        params_np = pjax._to_np(params)
        for c in cands:
            c.win_depth = -1
        won = np.asarray(states.win).reshape(-1)
        for i in np.flatnonzero(won):
            cands[int(i)].win_depth = 0          # already won: degenerate
        live = ~won
        if not live.any():
            return
        idx = np.flatnonzero(live)
        frontier = jax.tree.map(lambda x: x[idx], states)
        fparams = jax.tree.map(lambda x: x[idx], params_np)
        tags = idx.copy()
        seen: set[tuple[int, int]] = set()
        rng = np.random.default_rng(0)
        t0 = time.time()
        batch = min(cap, max(64, 1 << int(np.ceil(np.log2(max(n, 64))))))
        for depth in range(1, max_depth + 1):
            if tags.size == 0 or time.time() - t0 > timeout_s:
                break
            flat_s, flat_p, flat_t = self._expand_chunks(frontier, fparams, tags, batch)
            wins = flat_s.win.reshape(-1)
            if wins.any():
                for t in np.unique(flat_t[wins]):
                    c = cands[int(t)]
                    if c.win_depth < 0:
                        c.win_depth = depth
            solved = np.asarray([cands[int(t)].win_depth >= 0 for t in flat_t])
            keep = ~solved
            if not keep.any():
                break
            h = pjax._hash_levels(flat_s.multihot_level)
            pairs = list(zip(h.tolist(), flat_t.tolist()))
            fresh = [i for i in np.flatnonzero(keep).tolist() if pairs[i] not in seen]
            if not fresh:
                break
            seen.update(pairs[i] for i in fresh)
            sel = np.asarray(fresh, dtype=np.int64)
            if sel.size > cap:
                sel = np.sort(rng.choice(sel, cap, replace=False))
            frontier = jax.tree.map(lambda x: x[sel], flat_s)
            fparams = jax.tree.map(lambda x: x[sel], flat_p)
            tags = flat_t[sel]

    def _expand_chunks(self, frontier, fparams, tags, batch: int):
        """Expand a tagged frontier in fixed-width chunks."""
        n = tags.size
        outs_s, outs_p, outs_t = [], [], []
        for lo in range(0, n, batch):
            hi = min(lo + batch, n)
            k = hi - lo
            s = pjax._pad_to(jax.tree.map(lambda x: x[lo:hi], frontier), batch)
            p = pjax._pad_to(jax.tree.map(lambda x: x[lo:hi], fparams), batch)
            succ = self._expander(batch)(jax.tree.map(jnp.asarray, s),
                                         jax.tree.map(jnp.asarray, p))
            succ = pjax._to_np(succ)
            keep = k * N_ACTIONS
            outs_s.append(jax.tree.map(
                lambda x: x.reshape(batch * N_ACTIONS, *x.shape[2:])[:keep], succ))
            rep = jax.tree.map(lambda x: np.repeat(x[lo:hi], N_ACTIONS, axis=0), fparams)
            outs_p.append(rep)
            outs_t.append(np.repeat(tags[lo:hi], N_ACTIONS))
        join = lambda parts: (parts[0] if len(parts) == 1 else
                              jax.tree.map(lambda *xs: np.concatenate(xs, 0), *parts))
        return join(outs_s), join(outs_p), np.concatenate(outs_t)

    def random_batch(self, cands: list[Candidate], n_roll: int = 24,
                     steps: int = 40) -> None:
        """Fraction of random rollouts that win, per candidate, all at once."""
        if not cands:
            return
        params = self.params_batch(cands)
        env, key = self.env, self.key
        B = len(cands)

        def roll(p, actions):
            _, st = env.reset(key, p)

            def f(s, a):
                _, ns, _, _, _ = env.step_env(key, s, a, p)
                return jax.tree.map(
                    lambda x, y: jnp.where(s.win, x, y).astype(jnp.asarray(x).dtype),
                    s, ns), s.win

            final, wins = jax.lax.scan(f, st, actions)
            return jnp.logical_or(wins.any(), final.win)

        fn = self._roll.get((n_roll, steps))
        if fn is None:
            fn = jax.jit(jax.vmap(jax.vmap(roll, in_axes=(None, 0)), in_axes=(0, 0)))
            self._roll[(n_roll, steps)] = fn
        acts = jax.random.randint(jax.random.fold_in(self.key, 5),
                                  (B, n_roll, steps), 0, N_ACTIONS)
        wins = np.asarray(fn(params, acts))
        for c, w in zip(cands, wins):
            c.random_win = float(np.mean(w))

    # -- the C++ backend, which on this machine is the faster one ----------

    def solve_batch_cpp(self, cands: list[Candidate], max_iters: int = 120_000,
                        timeout_ms: int = 3000) -> None:
        """Same job as :meth:`solve_batch`, through the original engine.

        Measured on this CPU (``prof.bench``, 64 candidate Sokoban levels):
        12 levels/s here against 5.7 for the batched PuzzleJAX version, and it
        finds twice as many solutions because it searches each level to
        exhaustion rather than to a shared depth cap.

        The reason is not that batching fails -- PuzzleJAX really does expand
        150k states/s -- but that a batch is only as fast as its slowest
        member.  Every level in the frontier is searched to the same depth,
        so a population where most levels solve in six moves still pays for
        twenty-six, while the C++ solver drops each level the moment it wins.
        Batching would win back the difference on a GPU, where the per-layer
        expansion is one kernel instead of many; on CPU it does not.

        What stays PuzzleJAX-only is search from *arbitrary* states, which is
        what ``prof.depth`` needs and what this engine cannot start from.
        """
        from prof import engine as E

        if not cands:
            return
        g = self.struct.copy()
        g.levels = [Level(list(c.rows)) for c in cands]
        g.touch("LEVELS")
        g.repair()
        for c in cands:
            c.win_depth = -1
        try:
            compiled = E.compile_text(g.emit())
            eng = E.new_engine(compiled)
        except Exception:  # noqa: BLE001
            return
        for i, c in enumerate(cands):
            try:
                eng.load_level(i)
            except Exception:  # noqa: BLE001
                continue
            if eng.check_win():
                c.win_depth = 0              # won before a move: degenerate
                continue
            try:
                r = E.solve_level(eng, i, "bfs", max_iters=max_iters,
                                  timeout_ms=timeout_ms)
            except Exception:  # noqa: BLE001
                continue
            if r.solved:
                c.win_depth = len(r.actions)

    def random_batch_cpp(self, cands: list[Candidate], n_roll: int = 20,
                         steps: int = 40, seed: int = 0) -> None:
        """Random-play floor through the original engine, level by level."""
        from prof import engine as E

        if not cands:
            return
        rng = random.Random(seed)
        g = self.struct.copy()
        g.levels = [Level(list(c.rows)) for c in cands]
        g.touch("LEVELS")
        g.repair()
        try:
            eng = E.new_engine(E.compile_text(g.emit()))
        except Exception:  # noqa: BLE001
            return
        for i, c in enumerate(cands):
            wins = 0
            for _ in range(n_roll):
                try:
                    eng.load_level(i)
                except Exception:  # noqa: BLE001
                    break
                for _ in range(steps):
                    eng.process_input(rng.randrange(N_ACTIONS))
                    if eng.check_win():
                        wins += 1
                        break
            c.random_win = wins / max(n_roll, 1)

    # -- scoring and search ------------------------------------------------

    @staticmethod
    def score(c: Candidate, target_len: int, min_len: int) -> float:
        """Close to the target length, and not solvable by flailing."""
        if c.win_depth < 0:
            return -1.0                       # no solution found: useless
        if c.win_depth < min_len:
            return -0.5 + 0.01 * c.win_depth  # trivially short
        near = 1.0 - min(1.0, abs(c.win_depth - target_len) / max(target_len, 1))
        return near - 0.8 * c.random_win

    def census(self) -> dict[str, float]:
        """How often each character appears per cell in the game's own levels.

        Sampling uniformly over the alphabet produces noise: a Sokoban needs
        mostly floor, a wall border, and as many crates as targets.  Copying
        the game's own tile frequencies is a cheap way to inherit that without
        knowing anything about what the objects mean.
        """
        counts: dict[str, int] = {}
        total = 0
        for l in self.struct.levels:
            if l.is_message or not l.rows:
                continue
            for ch, n in l.counts().items():
                if ch in self.alphabet:
                    counts[ch] = counts.get(ch, 0) + n
                    total += n
        if not total:
            return {c: 1.0 / max(len(self.alphabet), 1) for c in self.alphabet}
        return {c: counts.get(c, 0) / total for c in self.alphabet}

    def seeds(self, rng: random.Random, n: int) -> list[Candidate]:
        """The game's own levels, cropped or padded to the generator's shape."""
        out = []
        for l in self.struct.levels:
            if l.is_message or not l.rows:
                continue
            rows = [r[:self.width].ljust(self.width, self.bg)
                    for r in l.rows[:self.height]]
            while len(rows) < self.height:
                rows.append(self.bg * self.width)
            rows = ["".join(ch if ch in self.alphabet else self.bg for ch in r)
                    for r in rows]
            out.append(self._place_player(rows, rng) if self.player_chars
                       else Candidate(rows))
            if len(out) >= n:
                break
        return out

    def sample(self, rng: random.Random, density: float = 0.0) -> Candidate:
        """A fresh layout drawn from the game's own tile frequencies."""
        freq = self._freq
        chars = [c for c in self.alphabet if c not in self.player_chars]
        weights = [max(freq.get(c, 0.0), 1e-4) for c in chars]
        rows = []
        for _ in range(self.height):
            rows.append("".join(rng.choices(chars, weights=weights, k=self.width)))
        return self._place_player(rows, rng)

    def _place_player(self, rows: list[str], rng: random.Random) -> Candidate:
        if not self.player_chars:
            return Candidate(rows)
        p = rng.choice(self.player_chars)
        rows = [r.replace(p, self.bg) for r in rows]
        y, x = rng.randrange(self.height), rng.randrange(self.width)
        rows[y] = rows[y][:x] + p + rows[y][x + 1:]
        return Candidate(rows)

    def mutate(self, c: Candidate, rng: random.Random, n: int = 3) -> Candidate:
        """Mostly move things, sometimes change them.

        A move preserves the multiset of tiles, which for most puzzle games is
        the difference between a variation and a broken level: retiling a
        crate into a wall in a Sokoban leaves fewer crates than targets and no
        solution exists at all.  Retiling is kept as a minority operator so the
        search can still change a level's composition when it needs to.
        """
        rows = list(c.rows)
        for _ in range(n):
            if rng.random() < 0.75:
                movable = [(y, x) for y, r in enumerate(rows)
                           for x, ch in enumerate(r)
                           if ch != self.bg and ch not in self.player_chars]
                free = [(y, x) for y, r in enumerate(rows)
                        for x, ch in enumerate(r) if ch == self.bg]
                if movable and free:
                    (sy, sx) = rng.choice(movable)
                    (dy, dx) = rng.choice(free)
                    ch = rows[sy][sx]
                    rows[sy] = rows[sy][:sx] + self.bg + rows[sy][sx + 1:]
                    rows[dy] = rows[dy][:dx] + ch + rows[dy][dx + 1:]
                    continue
            y, x = rng.randrange(self.height), rng.randrange(self.width)
            ch = rng.choice([a for a in self.alphabet if a not in self.player_chars]
                            or [self.bg])
            rows[y] = rows[y][:x] + ch + rows[y][x + 1:]
        if self.player_chars and not any(p in r for r in rows for p in self.player_chars):
            return self._place_player(rows, rng)
        return Candidate(rows)

    def run(self, pop: int = 96, generations: int = 10, target_len: int = 16,
            min_len: int = 5, max_depth: int = 0, keep: int = 16,
            seed: int = 0, verbose: bool = True,
            use_seeds: bool = True, backend: str = "cpp") -> list[Candidate]:
        """Batched hill climb toward levels with a target solution length."""
        rng = random.Random(seed)
        max_depth = max_depth or target_len + 8
        elites: list[Candidate] = list(self.seeds(rng, keep)) if use_seeds else []
        t0 = time.time()
        for gen in range(generations):
            if elites:
                batch = [self.mutate(rng.choice(elites), rng,
                                     n=rng.choice([1, 2, 2, 3, 5]))
                         if rng.random() < 0.85 else self.sample(rng)
                         for _ in range(pop)]
            else:
                batch = [self.sample(rng) for _ in range(pop)]
            if backend == "cpp":
                self.solve_batch_cpp(batch)
                solvable = [c for c in batch if c.win_depth >= min_len]
                if solvable:
                    self.random_batch_cpp(solvable)
            else:
                self.solve_batch(batch, max_depth=max_depth)
                solvable = [c for c in batch if c.win_depth >= min_len]
                if solvable:
                    self.random_batch(solvable)
            for c in batch:
                c.score = self.score(c, target_len, min_len)
            elites = sorted(elites + batch, key=lambda c: -c.score)[:keep]
            if verbose:
                best = elites[0]
                n_sol = sum(1 for c in batch if c.win_depth >= 0)
                print(f"  gen {gen:2d}  solved {n_sol:3d}/{pop}  "
                      f"best score {best.score:.3f} len {best.win_depth} "
                      f"rand {best.random_win:.2f}  [{time.time() - t0:.0f}s]",
                      flush=True)
        return elites

    def install(self, cands: list[Candidate], n: int = 5) -> str:
        """Return the game's source with its levels replaced by these."""
        out = self.struct.copy()
        picked = [c for c in cands if c.win_depth >= 0][:n]
        if not picked:
            return out.emit()
        # easiest first, so the game ramps the way human games do
        picked.sort(key=lambda c: c.win_depth)
        out.levels = [Level(list(c.rows)) for c in picked]
        out.touch("LEVELS")
        out.repair()
        return out.emit()
