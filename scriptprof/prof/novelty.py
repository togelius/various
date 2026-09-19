"""How far is a game from anything a person has written?

"Novel" is the word in the brief and it needs an operational meaning, or the
search will happily rediscover Sokoban nine hundred times.  The census gives
one: ``data/census/concepts.csv`` holds a static concept vector for all 904
human games that compile, so novelty can be distance from that cloud.

The space is the one ``prof.corpus_features`` already validated -- counts are
log-compressed because they are heavy-tailed, then standardised -- and the
score is the mean distance to the ``k`` nearest human games in it.  Two
consequences worth stating plainly:

* This measures *conceptual* novelty, not fun.  A game with eleven unused
  objects and a random rule scores well.  It belongs in a fitness function
  next to the depth metrics, never on its own.
* It is distance from the corpus, not from the archive.  Archive diversity is
  MAP-Elites' job; this is the axis MAP-Elites cannot see, because its cells
  are defined by descriptors the human games also occupy.

    nov = Novelty()
    nov.score(concept_vector)      # 0 at the centre of the corpus, up from there
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CONCEPTS = ROOT / "data" / "census" / "concepts.csv"


class Novelty:
    """k-nearest-neighbour distance to the human corpus in concept space."""

    def __init__(self, path: Path = CONCEPTS, k: int = 15, max_dim: int = 80):
        rows = list(csv.DictReader(path.open()))
        if not rows:
            raise ValueError(f"no concept vectors in {path}")
        self.keys = [c for c in rows[0] if c != "game"][:max_dim]
        self.names = [r["game"] for r in rows]
        X = np.array([[float(r[k] or 0.0) for k in self.keys] for r in rows])
        X = np.log1p(np.clip(X, 0, None))
        self.mu = X.mean(0)
        self.sigma = X.std(0) + 1e-9
        self.X = (X - self.mu) / self.sigma
        self.k = min(k, len(rows))
        # the corpus' own distance distribution, so scores are interpretable
        sample = self.X[:: max(1, len(self.X) // 200)]
        d = np.sort(np.linalg.norm(sample[:, None] - self.X[None], axis=2), axis=1)
        self.baseline = float(np.median(d[:, 1: self.k + 1].mean(axis=1)))

    def embed(self, feats: dict[str, float]) -> np.ndarray:
        v = np.array([float(feats.get(k, 0.0)) for k in self.keys])
        return (np.log1p(np.clip(v, 0, None)) - self.mu) / self.sigma

    def distance(self, feats: dict[str, float]) -> float:
        """Mean distance to the ``k`` nearest human games."""
        v = self.embed(feats)
        d = np.linalg.norm(self.X - v, axis=1)
        return float(np.sort(d)[: self.k].mean())

    def score(self, feats: dict[str, float]) -> float:
        """Distance in units of the corpus' own typical spacing.

        1.0 means "as far from its neighbours as a human game typically is",
        so anything above that is outside the crowd rather than merely in a
        thin part of it.
        """
        return self.distance(feats) / max(self.baseline, 1e-9)

    def nearest(self, feats: dict[str, float], n: int = 5) -> list[tuple[str, float]]:
        """The closest human games, for sanity-checking a novelty claim."""
        v = self.embed(feats)
        d = np.linalg.norm(self.X - v, axis=1)
        idx = np.argsort(d)[:n]
        return [(self.names[i], float(d[i])) for i in idx]


@lru_cache(maxsize=1)
def shared() -> Novelty:
    """One instance per process; loading the corpus costs a few hundred ms."""
    return Novelty()
