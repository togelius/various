"""Who is this game's parent?

A MAP-Elites archive records, for each cell, the *cell* its occupant was
mutated from. That is not an ancestor: cells get overwritten, so by the time
you read the archive the parent cell holds whoever won it most recently, which
may be a cousin, a descendant, or something unrelated.

The run log has what the archive throws away. Every accepted candidate is
written in order with the cell it came from and the cell it took, so replaying
the log while tracking which node occupies which cell recovers the actual
parent at the moment of each birth. From there a chain walks back to whatever
seeded the family.

Two honest gaps. Seeding is not logged, so a chain that reaches a cell nothing
in the log ever filled ends at "a seed" rather than at a named game. And
batches lost to worker crashes leave holes, so a parent lookup can miss and
that node becomes a root. Both are counted and reported rather than smoothed
over -- and neither matters much for the question a person actually asks,
because the human game a lineage descends from survives in the mutated game's
own title and author lines.

    tree = Lineage.from_runs([Path("data/evolve/novel")])
    tree.chain("novel", "04_05_03_03")     # newest first, back to the root
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Node:
    id: int
    run: str
    cell: str
    ops: list[str]
    fitness: float
    novelty: float
    tier: int
    step: int                       # position in the log, a birth order
    parent: int | None = None
    parent_cell: str | None = None
    seed_name: str | None = None    # set when this node is an original seed


@dataclass
class Lineage:
    nodes: dict[int, Node] = field(default_factory=dict)
    # (run, cell) -> the node that occupies it at the end of the replay
    final: dict[tuple[str, str], int] = field(default_factory=dict)
    orphans: int = 0                # accepted nodes whose parent was not in the log
    accepted: int = 0

    @classmethod
    def from_runs(cls, runs: Iterable[Path]) -> "Lineage":
        self = cls()
        next_id = 0
        for run in runs:
            log = run / "log.jsonl"
            if not log.exists():
                continue
            name = run.name
            occupant: dict[str, int] = {}
            # seeds are not written to the log, but the archive still names the
            # ones that were never displaced; use them to root those families
            seeds: dict[str, str] = {}
            arch = run / "archive.json"
            if arch.exists():
                try:
                    for cell, e in json.loads(arch.read_text())["elites"].items():
                        if e.get("parent") is None:
                            seeds[cell] = e.get("name", "seed")
                except Exception:  # noqa: BLE001
                    pass
            step = 0
            with log.open() as fh:
                for line in fh:
                    try:
                        rec = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    step += 1
                    cell = rec.get("cell")
                    if not cell:
                        continue            # rejected, or a crash record
                    self.accepted += 1
                    pcell = rec.get("parent")
                    pid = occupant.get(pcell) if pcell else None
                    if pid is None and pcell:
                        # the parent predates the log (a seed) or was lost to a
                        # crashed batch; mint a root so the chain still starts
                        # somewhere nameable
                        root = Node(id=next_id, run=name, cell=pcell, ops=["seed"],
                                    fitness=0.0, novelty=0.0, tier=3, step=0,
                                    seed_name=seeds.get(pcell))
                        self.nodes[next_id] = root
                        occupant[pcell] = next_id
                        pid = next_id
                        next_id += 1
                        self.orphans += 1
                    node = Node(id=next_id, run=name, cell=cell,
                                ops=list(rec.get("ops", [])),
                                fitness=float(rec.get("fitness", 0.0)),
                                novelty=float(rec.get("novelty", 0.0)),
                                tier=int(rec.get("tier", 0)), step=step,
                                parent=pid, parent_cell=pcell)
                    self.nodes[next_id] = node
                    occupant[cell] = next_id
                    next_id += 1
            for cell, nid in occupant.items():
                self.final[(name, cell)] = nid
            # a seed never displaced leaves no log record; represent it anyway
            for cell, gname in seeds.items():
                if (name, cell) not in self.final:
                    self.nodes[next_id] = Node(
                        id=next_id, run=name, cell=cell, ops=["seed"], fitness=0.0,
                        novelty=0.0, tier=3, step=0, seed_name=gname)
                    self.final[(name, cell)] = next_id
                    next_id += 1
        return self

    def chain(self, run: str, cell: str, limit: int = 40) -> list[Node]:
        """The occupant of a cell and its ancestors, newest first."""
        nid = self.final.get((run, cell))
        out: list[Node] = []
        seen: set[int] = set()
        while nid is not None and nid not in seen and len(out) < limit:
            seen.add(nid)
            node = self.nodes[nid]
            out.append(node)
            nid = node.parent
        return out

    def summary(self) -> str:
        roots = sum(1 for n in self.nodes.values() if n.parent is None)
        return (f"{len(self.nodes)} nodes from {self.accepted} accepted candidates, "
                f"{roots} roots ({self.orphans} of them minted for a parent the log "
                f"did not contain)")


def describe(chain: list[Node]) -> list[dict[str, Any]]:
    """A chain rendered for display: each step with the edit that made it."""
    out = []
    for n in chain:
        out.append({
            "run": n.run, "cell": n.cell, "step": n.step,
            "ops": n.ops, "fitness": round(n.fitness, 3),
            "novelty": round(n.novelty, 2), "tier": n.tier,
            "seed": n.seed_name, "is_root": n.parent is None,
        })
    return out


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", default=["data/evolve/novel", "data/evolve/control"])
    ap.add_argument("--cell", default=None, help="run:cell to trace, e.g. novel:04_05_03_03")
    a = ap.parse_args()
    runs = [Path(r) if Path(r).is_absolute() else ROOT / r for r in a.runs]
    tree = Lineage.from_runs(runs)
    print(tree.summary())
    if a.cell:
        run, cell = a.cell.split(":", 1)
        chain = tree.chain(run, cell)
        print(f"\n{run}/{cell}: {len(chain)} generations deep")
        for i, n in enumerate(chain):
            tag = f"seed {n.seed_name}" if n.seed_name else ("root" if n.parent is None else "")
            print(f"  {i:2d}  {n.cell}  f={n.fitness:6.3f} nov={n.novelty:4.2f}  "
                  f"{'+'.join(n.ops)[:52]}  {tag}")
    else:
        depths = sorted(((len(tree.chain(r, c)), r, c) for (r, c) in tree.final),
                        reverse=True)
        print("\ndeepest lineages:")
        for d, r, c in depths[:8]:
            print(f"  {d:3d} generations  {r}/{c}")


if __name__ == "__main__":
    main()
