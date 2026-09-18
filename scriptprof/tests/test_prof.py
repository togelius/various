"""Smoke tests for the ScriptProf Python layer.

    vendor/script-doctor/.venv/bin/python -m pytest -q tests
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from prof import engine as E  # noqa: E402
from prof.concepts import KEYS, concepts  # noqa: E402
from prof.fitness import evaluate  # noqa: E402
from prof.mutate import extract_game  # noqa: E402

SOKOBAN = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games" / "sokoban_basic.txt"


def test_compile_and_solve():
    c = E.compile_file(SOKOBAN)
    assert c.n_levels == 2
    eng = E.new_engine(c)
    s = E.solve_level(eng, 0, "bfs", max_iters=50_000, timeout_ms=5_000)
    assert s.solved and len(s.actions) > 5
    r = E.replay(eng, 0, s.actions)
    assert r["won"]


def test_compile_error():
    try:
        E.compile_text("this is not a game\n")
    except E.CompileError:
        return
    raise AssertionError("expected CompileError")


def test_coverage_counts_rules():
    c = E.compile_file(SOKOBAN)
    eng = E.new_engine(c)
    s = E.solve_level(eng, 0, "bfs")
    cov = E.coverage(c, {0: s.actions})
    assert cov["n_rules"] == 1 and cov["n_fired"] == 1 and not cov["never_fired"]


def test_concepts_stable_keys():
    txt = SOKOBAN.read_text()
    f = concepts(txt, E.compile_text(txt).state)
    assert list(f.keys()) == KEYS
    assert f["n_objects"] == 5 and f["n_rule_sources"] == 1 and f["win_all"] == 1


def test_fitness_tiers():
    ev = evaluate(SOKOBAN.read_text(), timeout_ms=3000)
    assert ev.tier == 3 and 0 < ev.fitness <= 1
    ev0 = evaluate("garbage")
    assert ev0.tier == 0 and ev0.fitness == -3


def test_extract_game():
    assert extract_game("blah\n```puzzlescript\ntitle x\n```\n") == "title x\n"
    assert extract_game("no block") is None


def test_solver_respects_its_time_budget():
    """A slow game must not overrun its timeout.

    The upstream solvers consult the clock every 1000 expansions. In games
    whose rules loop heavily a single expansion can take tens of milliseconds,
    so a 1s budget ran for 78s. The vendor patch replaces the fixed stride with
    a poller that retunes itself to the measured cost of an expansion.
    """
    import time

    slow = SOKOBAN.parent / "5_step_steve_DEMAKE.txt"
    if not slow.exists():
        import pytest
        pytest.skip("slow reference game not in the corpus")
    eng = E.new_engine(E.compile_file(slow))
    t0 = time.time()
    s = E.solve_level(eng, 0, "bfs", max_iters=100_000, timeout_ms=1000)
    wall = time.time() - t0
    assert s.timeout and not s.solved
    assert wall < 5.0, f"1s budget overran to {wall:.1f}s"
