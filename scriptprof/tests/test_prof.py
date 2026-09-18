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


def _game(name):
    import pytest
    p = SOKOBAN.parent / f"{name}.txt"
    if not p.exists():
        pytest.skip(f"{name} not in the corpus")
    return p


def test_restore_level_clears_per_turn_state():
    """A restored board must not inherit the previous branch's win.

    backup_level captures the object grid only. The engine also holds a command
    queue, an `again` flag and a cached win flag. Leaving those set let one
    search branch contaminate the next.
    """
    eng = E.new_engine(E.compile_file(_game("Angize")))
    eng.load_level(0)
    backup = eng.backup_level()
    E.step(eng, 4)                       # ACTION wins this level
    assert eng.winning
    eng.restore_level(backup)
    assert not eng.winning, "restored board inherited the win flag"


def test_solver_finds_a_win_that_changes_no_tiles():
    """A rule may issue `win` without moving anything.

    The search loops discarded any action that left the board unchanged, before
    testing for a win, so such a win was invisible; the stale flag then surfaced
    it against a later, unrelated action.
    """
    c = E.compile_file(_game("Angize"))
    eng = E.new_engine(c)
    s = E.solve_level(eng, E.level_indices(c)[0], "bfs", max_iters=5000, timeout_ms=3000)
    assert s.solved and s.actions == [4], s.actions
    assert E.replay(eng, E.level_indices(c)[0], s.actions)["won"]


def test_again_ticks_are_settled_on_replay():
    """Replaying a solution must settle `again` ticks as the solver does."""
    c = E.compile_file(_game("Animal_Cascade"))
    lvl = E.level_indices(c)[0]
    eng = E.new_engine(c)
    s = E.solve_level(eng, lvl, "bfs", max_iters=5000, timeout_ms=3000)
    assert s.solved
    assert E.replay(eng, lvl, s.actions)["won"]
    # Without settling, the same actions land somewhere else entirely.
    eng.load_level(lvl)
    for a in s.actions:
        eng.process_input(a)
    assert not eng.winning, "this game no longer exercises `again`; pick another"


def test_every_solver_returns_a_replayable_solution():
    for name in ("sokoban_basic", "kettle", "slidings"):
        c = E.compile_file(_game(name))
        lvl = E.level_indices(c)[0]
        eng = E.new_engine(c)
        for algo in ("bfs", "astar", "gbfs"):
            s = E.solve_level(eng, lvl, algo, max_iters=20_000, timeout_ms=4000)
            assert s.solved, f"{name}/{algo} did not solve level {lvl}"
            assert E.replay(eng, lvl, s.actions)["won"], f"{name}/{algo} solution does not replay"


def test_isolated_evaluation_matches_in_process():
    from prof.fitness import evaluate_isolated
    text = SOKOBAN.read_text(encoding="utf-8", errors="replace")
    a = evaluate(text, timeout_ms=2000)
    b = evaluate_isolated(text, timeout_ms=2000)
    assert (b.tier, b.n_solved, b.solutions) == (a.tier, a.n_solved, a.solutions)
    assert abs(a.fitness - b.fitness) < 1e-9


def test_isolated_evaluation_survives_a_game_that_kills_the_engine():
    """A mutant that crashes or hangs the engine must cost one candidate, not the run.

    1D_Rubik's_Cube segfaults the C++ engine inside load_level, and a rule that
    keeps issuing `again` spins inside a single expansion where no solver
    timeout can reach it. Either would take down a MAP-Elites run evaluating
    in its own process.
    """
    from prof.fitness import evaluate_isolated
    crasher = SOKOBAN.parent / "1D_Rubik's_Cube.txt"
    if not crasher.exists():
        import pytest
        pytest.skip("reference crashing game not in the corpus")
    ev = evaluate_isolated(crasher.read_text(encoding="utf-8", errors="replace"),
                           timeout_s=30, timeout_ms=1000)
    assert ev.tier == 0 and ev.fitness == -3.0
    assert "hung" in ev.reason or "crashed" in ev.reason


def test_isolated_evaluation_reports_a_compile_failure_normally():
    from prof.fitness import evaluate_isolated
    ev = evaluate_isolated("not a game at all\n")
    assert ev.tier == 0 and ev.reason.startswith("compile")
