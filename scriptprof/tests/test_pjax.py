"""Tests for the PuzzleJAX path and the metrics built on it.

These are slow -- a PuzzleJAX environment costs seconds to trace -- so they are
kept to the smallest game that exercises each behaviour, and the two engines
are pinned against each other where they have to agree.

    vendor/script-doctor/.venv/bin/python -m pytest -q tests/test_pjax.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402

from prof import engine as E  # noqa: E402

GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SOKOBAN = GAMES / "sokoban_basic.txt"


@pytest.fixture(scope="module")
def sokoban_text():
    return SOKOBAN.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def pj(sokoban_text):
    from prof import pjax

    return pjax.PJGame.from_text(sokoban_text)


def test_loads_from_a_string(pj):
    """Generated games never touch a disk, so parsing must not either."""
    assert pj.n_levels == 2
    assert pj.level(0).shape[0] > 0


def test_cpp_solution_replays_in_puzzlejax(pj, sokoban_text):
    """The two engines number actions differently; the mapping must hold.

    Without prof.depth.to_jax_actions a C++ solution replayed in PuzzleJAX
    quietly does something else and never wins, which downstream reads as
    'every alternative move is fatal' on every game measured.
    """
    from prof.depth import to_jax_actions

    eng = E.new_engine(E.compile_text(sokoban_text))
    s = E.solve_level(eng, 0, "bfs", max_iters=200_000, timeout_ms=20_000)
    assert s.solved
    lv = pj.level(0)
    assert lv.replay(to_jax_actions(list(s.actions)))["win"]
    assert not lv.replay(list(s.actions))["win"], "mapping is a no-op; test is blind"


def test_levels_of_one_game_may_differ_in_shape():
    """The compiled-expander cache must key on the level's own shape."""
    from prof import pjax

    g = pjax.PJGame.from_text((GAMES / "Castle_Monk.txt").read_text(errors="replace"))
    shapes = {g.level(i).shape for i in range(min(2, g.n_levels))}
    # whether or not they differ here, both levels must expand without error
    for i in range(min(2, g.n_levels)):
        lv = g.level(i)
        succ = lv.successors(lv.path_states([]))
        assert succ.multihot_level.shape[0] == pjax.N_ACTIONS
    assert shapes


def test_random_play_does_not_beat_sokoban(pj):
    r = pj.level(0).rollouts(n=128, steps=60)
    assert r["win_frac"] == 0.0


def test_survival_confirms_a_known_solution_path(pj, sokoban_text):
    """The reliability check the fatal-move metric depends on.

    Every state on the optimal path within the horizon is winnable inside it by
    construction. If the capped probe cannot re-find those wins, its verdicts
    about sibling states are pruning artefacts.
    """
    import jax
    import numpy as np

    from prof.depth import to_jax_actions

    eng = E.new_engine(E.compile_text(sokoban_text))
    s = E.solve_level(eng, 1, "bfs", max_iters=200_000, timeout_ms=20_000)
    actions = to_jax_actions(list(s.actions))
    lv = pj.level(1)
    horizon = 12
    keep = [i for i in range(len(actions)) if len(actions) - i <= horizon - 1]
    states = lv.path_states(actions)
    probe = jax.tree.map(lambda x: x[np.asarray(keep)], states)
    alive = lv.survival(probe, max_depth=horizon, cap=4096)
    assert alive.all(), f"probe re-solved only {alive.mean():.0%} of a known path"


def test_depth_gates_structure_on_rule_count():
    """PuzzleJAX tracing scales with rule count; a big game must be skipped."""
    from prof.depth import analyse

    d = analyse(SOKOBAN.read_text(encoding="utf-8"), max_levels=1,
                max_rules_for_structure=0)
    assert d.structure_skipped
    assert d.solved == 1           # the C++ half still ran


def test_depth_reports_structure_on_a_small_game(sokoban_text):
    from prof.depth import analyse

    d = analyse(sokoban_text, max_levels=1)
    assert d.solved == 1
    lv = d.levels[0]
    assert lv.reliable, lv.note
    # a hand-made Sokoban should have rare, concentrated danger
    assert lv.fatal_frac < 0.5
    assert lv.fatal_gini > 0.3


def test_level_generator_hits_a_target_length(sokoban_text):
    from prof.levelgen import LevelGen

    gen = LevelGen(sokoban_text, height=7, width=7)
    assert gen.bg == "."
    assert gen.player_chars == ["P"]
    best = gen.run(pop=48, generations=3, target_len=12, min_len=5,
                   seed=1, verbose=False, backend="cpp")
    top = best[0]
    assert top.win_depth >= 5
    assert top.random_win == 0.0
    installed = gen.install(best, n=2)
    assert E.compile_text(installed).n_levels >= 1
