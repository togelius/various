"""Tests for the MAP-Elites archive and its behaviour descriptors.

    vendor/script-doctor/.venv/bin/python -m pytest -q tests
"""
import csv
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from prof.evolve import (  # noqa: E402
    DEFAULT_DESCRIPTORS,
    PCA_PATH,
    Archive,
    Descriptor,
    PCADescriptors,
)

CONCEPTS = ROOT / "data" / "census" / "concepts.csv"


def _corpus_rows():
    if not CONCEPTS.exists():
        pytest.skip("no corpus concept table; run prof.corpus_features")
    with open(CONCEPTS) as fh:
        return [{k: v for k, v in row.items()} for row in csv.DictReader(fh)]


def _floats(row):
    return {k: float(v) for k, v in row.items() if k != "game" and v not in ("", None)}


def test_archive_key_handles_any_cell_width():
    assert Archive.key((3, 7)) == "03_07"
    assert Archive.key((0, 12, 5)) == "00_12_05"


def test_grid_descriptor_bins_are_clamped():
    d = Descriptor("x", 0, 10, 5)
    assert d.bin(-100) == 0
    assert d.bin(1e9) == 4


def test_fitted_descriptors_separate_the_corpus_far_better_than_the_grid():
    """The reason the default changed.

    Two hand-picked axes put the corpus into a few dozen cells, about a dozen
    games each, so the archive cannot tell most human games apart. The fitted
    projection spreads the same games over hundreds of cells.
    """
    if not PCA_PATH.exists():
        pytest.skip("no fitted projection; run prof.corpus_features")
    rows = [_floats(r) for r in _corpus_rows()]
    pca = PCADescriptors()
    fitted = {pca.cell_of(f) for f in rows}
    grid = {tuple(d.bin(f.get(d.name, 0.0)) for d in DEFAULT_DESCRIPTORS) for f in rows}
    assert len(fitted) > 4 * len(grid), (len(fitted), len(grid))
    assert len(fitted) / len(rows) > 0.4, "fitted archive still collapses most games"


def test_projection_is_deterministic_and_in_range():
    if not PCA_PATH.exists():
        pytest.skip("no fitted projection; run prof.corpus_features")
    pca = PCADescriptors()
    feats = _floats(_corpus_rows()[0])
    assert pca.cell_of(feats) == pca.cell_of(feats)
    assert len(pca.cell_of(feats)) == len(pca.components)
    for c in pca.cell_of(feats):
        assert 0 <= c < pca.bins


def test_projection_tolerates_a_missing_feature():
    """A generated game is described by the same code path, but be defensive."""
    if not PCA_PATH.exists():
        pytest.skip("no fitted projection; run prof.corpus_features")
    pca = PCADescriptors()
    cell = pca.cell_of({})
    assert len(cell) == len(pca.components)


def test_describe_supplies_every_fitted_feature():
    """Anything the projection reads must be produced by describe().

    frac_solved is one of the fitted features and used to be missing, which
    would have silently pinned that coordinate for every generated game.
    """
    if not PCA_PATH.exists():
        pytest.skip("no fitted projection; run prof.corpus_features")
    from prof import engine as E
    from prof.evolve import describe
    from prof.fitness import evaluate

    game = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games" / "sokoban_basic.txt"
    if not game.exists():
        pytest.skip("corpus not vendored")
    text = game.read_text(encoding="utf-8", errors="replace")
    ev = evaluate(text, timeout_ms=2000)
    feats = describe(text, ev, E.compile_text(text).state)
    missing = [f for f in PCADescriptors().features if f not in feats]
    assert not missing, f"describe() does not produce {missing}"


def test_archive_keeps_the_fitter_game_in_a_cell(tmp_path):
    from prof.fitness import Evaluation

    archive = Archive(tmp_path, DEFAULT_DESCRIPTORS)
    feats = {"n_rule_sources": 1.0, "mean_solution_len": 10.0}
    low = Evaluation(fitness=0.2, tier=3, reason="ok", compiled=True)
    high = Evaluation(fitness=0.8, tier=3, reason="ok", compiled=True)
    assert archive.offer("a", low, feats, "a", None, None, 1)
    assert archive.offer("b", high, feats, "b", None, None, 1)
    assert not archive.offer("c", low, feats, "c", None, None, 1)
    assert len(archive.elites) == 1
    assert archive.game_text(Archive.key(archive.cell_of(feats))) == "b"


def test_archive_refuses_a_game_that_does_not_compile(tmp_path):
    from prof.fitness import Evaluation

    archive = Archive(tmp_path, DEFAULT_DESCRIPTORS)
    ev = Evaluation(fitness=-3.0, tier=0, reason="compile", compiled=False)
    assert not archive.offer("x", ev, {"n_rule_sources": 1.0}, "x", None, None, 1)
    assert not archive.elites
