"""Tests for the player ladder and the insight gap.

    vendor/script-doctor/.venv/bin/python -m pytest -q tests
"""
import random
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from prof import engine as E  # noqa: E402
from prof.players import (  # noqa: E402
    MYOPIC_PLAYERS,
    SEARCH_PLAYERS,
    PlayResult,
    greedy_play,
    insight_gap,
    myopic_gap,
    play_ladder,
    random_play,
    search_play,
)

GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"


def _compiled(name):
    p = GAMES / f"{name}.txt"
    if not p.exists():
        pytest.skip(f"{name} not in the corpus")
    return E.compile_file(p)


def test_greedy_beats_random_on_a_game_built_for_it():
    """Kettle wins in four moves, so hill-climbing should find it."""
    c = _compiled("kettle")
    eng = E.new_engine(c)
    rng = random.Random(0)
    g = greedy_play(eng, 0, [0, 1, 2, 3, 4], rng, max_steps=60, episodes=6)
    assert g.won, "greedy should solve a four-move level"


def test_search_beats_greedy_on_sokoban():
    """The gap the whole metric is built on: deadlocks defeat hill-climbing."""
    c = _compiled("sokoban_basic")
    res = play_ladder(c, 0, random.Random(1), max_iters=20_000, timeout_ms=3000,
                      episodes=4, max_steps=120)
    assert res["bfs"].won
    assert not res["greedy"].won
    assert insight_gap(res) == 1.0


def test_search_play_validates_its_own_solution():
    c = _compiled("sokoban_basic")
    eng = E.new_engine(c)
    r = search_play(eng, 0, "bfs", max_iters=20_000, timeout_ms=3000)
    assert r.won and r.actions
    assert E.replay(eng, 0, r.actions)["won"]


def test_insight_gap_is_none_when_no_search_solves():
    none_won = {p: PlayResult(p, False) for p in SEARCH_PLAYERS + MYOPIC_PLAYERS}
    assert insight_gap(none_won) is None


def test_insight_gap_is_zero_when_a_myopic_player_wins():
    res = {p: PlayResult(p, True) for p in SEARCH_PLAYERS}
    res.update({p: PlayResult(p, True) for p in MYOPIC_PLAYERS})
    assert insight_gap(res) == 0.0


def test_myopic_gap_matches_the_full_ladder_on_sokoban():
    c = _compiled("sokoban_basic")
    cheap = myopic_gap(c, [0], random.Random(1), episodes=4, max_steps=120)
    full = play_ladder(c, 0, random.Random(1), max_iters=20_000, timeout_ms=3000,
                       episodes=4, max_steps=120)
    assert cheap["per_level"][0] == insight_gap(full)


def test_random_play_reports_progress_even_when_it_loses():
    c = _compiled("sokoban_basic")
    eng = E.new_engine(c)
    r = random_play(eng, 0, [0, 1, 2, 3, 4], random.Random(2), max_steps=40, episodes=2)
    assert not r.won
    assert 0.0 <= r.best_score <= 1.0


def test_players_leave_the_engine_usable():
    """A player must not strand the engine mid-episode for the next caller."""
    c = _compiled("sokoban_basic")
    eng = E.new_engine(c)
    greedy_play(eng, 0, [0, 1, 2, 3, 4], random.Random(3), max_steps=30, episodes=1)
    s = E.solve_level(eng, 0, "bfs", max_iters=20_000, timeout_ms=3000)
    assert s.solved and E.replay(eng, 0, s.actions)["won"]
