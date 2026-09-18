"""Tests for the grammatical mutation operators.

    vendor/script-doctor/.venv/bin/python -m pytest -q tests
"""
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from prof import engine as E  # noqa: E402
from prof.grammar_mutate import (  # noqa: E402
    GrammarMutator,
    crossover,
    declared_names,
    level_blocks,
    rule_identifiers,
    rule_line_indices,
    split_sections,
)

GAMES = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"
SOKOBAN = GAMES / "sokoban_basic.txt"


def _lines():
    return SOKOBAN.read_text(encoding="utf-8", errors="replace").splitlines()


def test_split_sections_finds_all_sections():
    secs = split_sections(_lines())
    for name in ("OBJECTS", "LEGEND", "COLLISIONLAYERS", "RULES",
                 "WINCONDITIONS", "LEVELS"):
        assert name in secs, name
        lo, hi = secs[name]
        assert lo < hi


def test_rule_and_level_structure():
    lines = _lines()
    secs = split_sections(lines)
    idx = rule_line_indices(lines, secs)
    assert len(idx) == 1 and "->" in lines[idx[0]]
    lvs = level_blocks(lines, secs)
    assert len(lvs) == 2
    for lv in lvs:
        widths = {len(lines[r]) for r in range(lv.start, lv.end)}
        assert len(widths) == 1, "a level block must be rectangular"


def test_every_operator_keeps_the_game_compiling():
    """The point of a grammatical operator: children are legal by construction."""
    text = SOKOBAN.read_text(encoding="utf-8", errors="replace")
    m = GrammarMutator(seed=11)
    seen, compiled = set(), 0
    for _ in range(40):
        child, log = m.mutate(text)
        if child is None:
            continue
        seen.add(log.operator.split(":")[0])
        E.compile_text(child)  # raises CompileError on failure
        compiled += 1
    assert compiled >= 35
    assert len(seen) >= 5, f"expected several operators to fire, saw {seen}"


def test_level_swap_preserves_the_object_multiset():
    lines = _lines()
    from prof.grammar_mutate import op_level_swap
    before = sorted("".join(lines))
    assert op_level_swap(lines, random.Random(2)) is not None
    assert sorted("".join(lines)) == before


def test_flip_force_changes_a_mechanic():
    text = SOKOBAN.read_text(encoding="utf-8", errors="replace")
    from prof.grammar_mutate import op_rule_flip_force
    lines = text.splitlines()
    desc = op_rule_flip_force(lines, random.Random(1))
    assert desc is not None and "flipped force" in desc
    assert "\n".join(lines) != text
    E.compile_text("\n".join(lines) + "\n")


def test_mutator_reports_a_noop_rather_than_returning_the_parent():
    text = SOKOBAN.read_text(encoding="utf-8", errors="replace")
    m = GrammarMutator(seed=3)
    for _ in range(20):
        child, log = m.mutate(text)
        assert child is None or child.strip() != text.strip()
        assert child is not None or not log.ok


def test_declared_names_and_rule_identifiers():
    text = SOKOBAN.read_text(encoding="utf-8", errors="replace")
    names = declared_names(text)
    assert "player" in names and "crate" in names
    ids = rule_identifiers("[ > Player | Crate ] -> [ > Player | > Crate ]")
    assert ids == {"player", "crate"}, ids


def test_crossover_grafts_a_compatible_rule():
    a = SOKOBAN.read_text(encoding="utf-8", errors="replace")
    b = (GAMES / "kettle.txt").read_text(encoding="utf-8", errors="replace")
    child, desc = crossover(a, b, random.Random(5))
    assert child is not None, desc
    assert len(child.splitlines()) == len(a.splitlines()) + 1
    E.compile_text(child)


def test_crossover_refuses_rules_naming_unknown_objects():
    a = SOKOBAN.read_text(encoding="utf-8", errors="replace")
    donor = "=====\nRULES\n=====\n[ > Wizard | Portal ] -> [ Wizard | Portal ]\n"
    child, desc = crossover(a, donor, random.Random(5))
    assert child is None and "fits" in desc
