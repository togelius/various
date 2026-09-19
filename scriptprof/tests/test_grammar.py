"""Tests for the structural PuzzleScript layer and the operators over it.

The regressions pinned here are the ones that were silent rather than loud:
each produced a plausible-looking game or number, and each cost real time to
track down.

    vendor/script-doctor/.venv/bin/python -m pytest -q tests
"""
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest  # noqa: E402

from prof import engine as E  # noqa: E402
from prof.grammar import Game, Level, strip_comments  # noqa: E402
from prof.mutations import TEMPLATES, crossover, mutate, roles_of  # noqa: E402

GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SOKOBAN = GAMES / "sokoban_basic.txt"


def _text(name):
    return (GAMES / f"{name}.txt").read_text(encoding="utf-8", errors="replace")


# -- parsing ---------------------------------------------------------------

def test_comments_nest_and_span_lines():
    """A two-line comment must not leave its tail behind as a rule."""
    src = "RULES\n(first line\n second line)\n[ A ] -> [ B ]\n"
    out = strip_comments(src)
    assert "second line" not in out
    assert "[ A ] -> [ B ]" in out
    # newlines survive, so block and level geometry are unchanged
    assert out.count("\n") == src.count("\n")


def test_objects_need_no_blank_lines():
    """Coin_Dropper runs its OBJECTS section together with no separators."""
    g = Game.parse(_text("Coin_Dropper"))
    names = [o.name for o in g.objects]
    assert "coin" in names and "balloon" in names
    # a sprite row must never be mistaken for the next object's name
    assert not any(set(n) <= set("0123456789.") and len(n) > 1 for n in names)


def test_single_char_object_names_are_level_characters():
    """2048 names its tiles 1..9 and writes them straight into the level."""
    g = Game.parse(_text("2048"))
    assert {"1", "2", "9"} <= g.level_alphabet()


def test_background_is_the_floor_not_the_commonest_tile():
    """In a Sokoban the commonest character is the wall, not the floor."""
    g = Game.parse(_text("sokoban_basic"))
    assert g.background_char() == "."


def test_round_trip_preserves_compilation():
    text = SOKOBAN.read_text(encoding="utf-8")
    before = E.compile_text(text)
    after = E.compile_text(Game.parse(text).emit())
    assert after.n_levels == before.n_levels


def test_untouched_sections_come_from_source():
    """A section no mutation touched is reproduced, not regenerated.

    Checked on a game the structural parser reads only partly: Coin_Dropper's
    OBJECTS section has no blank lines between objects, so a regenerated copy
    would be spaced differently even when every object was read correctly.
    """
    text = _text("Coin_Dropper")
    g = Game.parse(text)
    assert not g.dirty
    body = "\n".join(g.raw["OBJECTS"]).strip("\n")
    assert body in g.emit()
    g.touch("OBJECTS")
    assert body not in g.emit()


def test_a_touched_section_reflects_the_edit():
    g = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    rule = next(r for r in g.rules if r.parsed)
    rule.prefixes.insert(0, "late")
    g.touch("RULES")
    assert "late [" in g.emit()


# -- operators -------------------------------------------------------------

def test_mutations_compile_most_of_the_time():
    """The operators trade a perfect hit rate for reach, but not much of one."""
    parent = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    rng = random.Random(7)
    ok = 0
    trials = 40
    for _ in range(trials):
        child, ops = mutate(parent, rng)
        if not ops:
            continue
        try:
            E.compile_text(child.emit(), timeout=20)
            ok += 1
        except E.CompileError:
            pass
    assert ok >= int(0.8 * trials), f"only {ok}/{trials} children compiled"


def test_mutation_leaves_the_parent_alone():
    parent = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    before = parent.emit()
    for seed in range(8):
        mutate(parent, random.Random(seed), n_ops=2)
    assert parent.emit() == before


@pytest.mark.parametrize("name", sorted(TEMPLATES))
def test_every_template_is_reachable(name):
    """A template that never binds is dead weight in the operator set."""
    g = Game.parse(_text("Microban_I"))
    roles = roles_of(g)
    bound = any(TEMPLATES[name](g, roles, random.Random(s)) for s in range(40))
    assert bound, f"template {name} bound no roles in 40 tries"


def test_crossover_carries_the_objects_a_donated_rule_needs():
    a = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    b = Game.parse(_text("Microban_I"))
    child, notes = crossover(a, b, random.Random(3))
    known = set(child.all_symbols())
    for rule in child.rules:
        if rule.parsed:
            assert rule.objects() <= known


def test_repair_keeps_every_object_in_a_layer():
    g = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    g.layers = [g.layers[0]]          # strand everything else
    g.repair()
    placed = {n.lower() for layer in g.layers for n in layer}
    assert {o.name.lower() for o in g.objects} <= placed


def test_repair_makes_levels_rectangular():
    g = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    playable = [l for l in g.levels if not l.is_message]
    playable[0].rows[0] = playable[0].rows[0][:-2]
    g.repair()
    for lv in g.levels:
        if not lv.is_message:
            assert len({len(r) for r in lv.rows}) == 1


# -- run safety ------------------------------------------------------------

def test_run_lock_rejects_a_second_live_writer(tmp_path):
    """Two processes on one archive silently lose the loser's cells."""
    import os

    from prof.qd import RunLock

    a = RunLock(tmp_path)
    a.acquire()
    assert (tmp_path / "RUNNING").exists()

    b = RunLock(tmp_path)
    b.pid = a.pid + 1 if a.pid + 1 != os.getpid() else a.pid + 2
    with pytest.raises(SystemExit):
        b.acquire()

    a.release()
    assert not (tmp_path / "RUNNING").exists()
    b.acquire()          # the lock is free once the holder lets go
    b.release()


def test_run_lock_ignores_a_dead_holder(tmp_path):
    from prof.qd import RunLock

    (tmp_path / "RUNNING").write_text("999999 stale\n")
    lock = RunLock(tmp_path)
    lock.acquire()       # must not block on a pid that no longer exists
    assert (tmp_path / "RUNNING").read_text().startswith(str(lock.pid))
    lock.release()


def test_repair_drops_vacuous_and_duplicate_win_conditions():
    """Free novelty for no design: a win condition naming the background.

    PuzzleScript's background fills every cell, so "Some Background" is always
    true and "All X on Background" is true for any X. Both are no-ops, and both
    still move the concept vector, so a search with a novelty term learns to
    emit them. The novelty run did exactly that before this existed.
    """
    g = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    bg_obj = next(o.name for o in g.objects if "background" in o.name.lower())
    real = g.wins[0].emit()
    from prof.grammar import Win

    g.wins += [Win("Some", bg_obj), Win("All", "Crate", bg_obj), g.wins[0]]
    g.touch("WINCONDITIONS")
    g.repair()
    kept = [w.emit() for w in g.wins]
    assert kept == [real], kept


def test_add_win_never_names_the_background():
    g = Game.parse(SOKOBAN.read_text(encoding="utf-8"))
    from prof.mutations import op_add_win

    bg = g._background_objects()
    for seed in range(60):
        h = g.copy()
        if op_add_win(h, random.Random(seed)) is None:
            continue
        w = h.wins[-1]
        assert w.a.lower() not in bg
        assert w.b is None or w.b.lower() not in bg
