"""MAP-Elites over PuzzleScript games (PLAN.md, WP3), GAVEL's archive with
ScriptDoctor's evaluator.

Archive cells are a 2-D grid over two behaviour descriptors taken from the
static concept vector (default: number of source rules x mean solution
length). Fitness is ``prof.fitness.evaluate``. The mutation operator is
pluggable; ``prof.mutate.OllamaMutator`` is the LLM one.

    .venv/bin/python -m prof.evolve --seeds sokoban_basic kettle --gens 20 --out data/evolve/run1

The archive is written to ``<out>/archive.json`` after every generation and
each elite's source to ``<out>/games/<cell>.txt``, so runs are resumable.
"""
from __future__ import annotations

import argparse
import json
import random
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable

from prof import engine as E
from prof.concepts import concepts
from prof.fitness import Evaluation, evaluate, evaluate_isolated

ROOT = Path(__file__).resolve().parent.parent
GAMES_DIR = ROOT / "vendor" / "script-doctor" / "data" / "scraped_games"


@dataclass
class Descriptor:
    name: str
    lo: float
    hi: float
    bins: int
    log: bool = False

    def bin(self, x: float) -> int:
        import math
        if self.log:
            x, lo, hi = math.log1p(max(0.0, x)), math.log1p(self.lo), math.log1p(self.hi)
        else:
            lo, hi = self.lo, self.hi
        t = 0.0 if hi <= lo else (x - lo) / (hi - lo)
        return max(0, min(self.bins - 1, int(t * self.bins)))


DEFAULT_DESCRIPTORS = [
    Descriptor("n_rule_sources", 0, 40, 10, log=True),
    Descriptor("mean_solution_len", 0, 80, 10, log=True),
]


@dataclass
class Elite:
    cell: tuple[int, int]
    fitness: float
    tier: int
    name: str
    parent: str | None
    instruction: str | None
    features: dict[str, float]
    summary: str
    generation: int


def describe(text: str, ev: Evaluation, state: dict[str, Any] | None) -> dict[str, float]:
    f = concepts(text, state)
    f["mean_solution_len"] = (sum(ev.lengths) / len(ev.lengths)) if ev.lengths else 0.0
    f["max_solution_len"] = max(ev.lengths, default=0)
    f["mean_search_iters"] = (sum(ev.iters) / len(ev.iters)) if ev.iters else 0.0
    return f


class Archive:
    def __init__(self, out: Path, descriptors: list[Descriptor]):
        self.out = out
        self.desc = descriptors
        self.elites: dict[str, Elite] = {}
        (out / "games").mkdir(parents=True, exist_ok=True)
        p = out / "archive.json"
        if p.exists():
            for k, v in json.loads(p.read_text()).items():
                v["cell"] = tuple(v["cell"])
                self.elites[k] = Elite(**v)

    @staticmethod
    def key(cell: tuple[int, int]) -> str:
        return f"{cell[0]:02d}_{cell[1]:02d}"

    def cell_of(self, feats: dict[str, float]) -> tuple[int, int]:
        return tuple(d.bin(feats.get(d.name, 0.0)) for d in self.desc)  # type: ignore[return-value]

    def offer(self, text: str, ev: Evaluation, feats: dict[str, float], name: str,
              parent: str | None, instruction: str | None, gen: int) -> bool:
        if not ev.compiled:
            return False
        cell = self.cell_of(feats)
        k = self.key(cell)
        cur = self.elites.get(k)
        if cur is not None and cur.fitness >= ev.fitness:
            return False
        self.elites[k] = Elite(cell=cell, fitness=ev.fitness, tier=ev.tier, name=name, parent=parent,
                               instruction=instruction, features=feats, summary=ev.summary(), generation=gen)
        (self.out / "games" / f"{k}.txt").write_text(text, encoding="utf-8")
        return True

    def game_text(self, k: str) -> str:
        return (self.out / "games" / f"{k}.txt").read_text(encoding="utf-8")

    def save(self) -> None:
        (self.out / "archive.json").write_text(json.dumps({k: asdict(v) for k, v in self.elites.items()}, indent=1))

    def qd_score(self) -> float:
        return sum(e.fitness + 3.0 for e in self.elites.values())

    def stats(self) -> str:
        n = len(self.elites)
        t3 = sum(1 for e in self.elites.values() if e.tier == 3)
        hi = sum(1 for e in self.elites.values() if e.fitness > 0.5)
        return f"cells {n} tier3 {t3} f>0.5 {hi} QD {self.qd_score():.1f}"


def seed_archive(archive: Archive, seeds: list[str], eval_kwargs: dict[str, Any],
                 evaluator: Callable[..., Evaluation] = evaluate_isolated) -> None:
    for s in seeds:
        p = Path(s) if s.endswith(".txt") else GAMES_DIR / f"{s}.txt"
        text = p.read_text(encoding="utf-8", errors="replace")
        ev = evaluator(text, **eval_kwargs)
        state = E.compile_text(text).state if ev.compiled else None
        feats = describe(text, ev, state)
        added = archive.offer(text, ev, feats, name=p.stem, parent=None, instruction="seed", gen=0)
        print(f"seed {p.stem}: {ev.summary()} cell={archive.cell_of(feats)} added={added}", flush=True)
    archive.save()


def run(archive: Archive, mutate: Callable[[str, str], tuple[str | None, Any]], gens: int,
        per_gen: int, instructions: list[str], eval_kwargs: dict[str, Any], rng: random.Random,
        log_path: Path, evaluator: Callable[..., Evaluation] = evaluate_isolated) -> None:
    gen0 = max((e.generation for e in archive.elites.values()), default=0) + 1
    with open(log_path, "a") as logf:
        for gen in range(gen0, gen0 + gens):
            t0 = time.time()
            keys = list(archive.elites)
            for j in range(per_gen):
                pk = rng.choice(keys)
                parent = archive.game_text(pk)
                instr = rng.choice(instructions)
                child, mlog = mutate(parent, instr)
                rec = {"gen": gen, "parent": pk, "instruction": instr,
                       "mutation": getattr(mlog, "__dict__", mlog)}
                if child is None:
                    rec["result"] = "no compiling child"
                else:
                    ev = evaluator(child, **eval_kwargs)
                    state = E.compile_text(child).state if ev.compiled else None
                    feats = describe(child, ev, state)
                    name = f"g{gen}_{j}_{pk}"
                    added = archive.offer(child, ev, feats, name=name, parent=pk, instruction=instr, gen=gen)
                    rec["result"] = ev.summary()
                    rec["cell"] = archive.cell_of(feats)
                    rec["added"] = added
                    print(f"[gen {gen} {j}] {pk} <- {instr[:40]!r}: {ev.summary()} -> cell {rec['cell']} added={added}", flush=True)
                logf.write(json.dumps(rec, default=str) + "\n")
                logf.flush()
            archive.save()
            print(f"== gen {gen} done in {time.time()-t0:.0f}s: {archive.stats()}", flush=True)


def make_grammar_operator(archive: "Archive", rng: random.Random, n_edits: int,
                          p_crossover: float) -> Callable[[str, str], tuple[str | None, Any]]:
    """Grammatical mutation, occasionally recombining with another elite.

    The donor is drawn from the archive, so recombination happens between
    games the search has already judged worth keeping.
    """
    from prof.grammar_mutate import GrammarLog, GrammarMutator, crossover

    gm = GrammarMutator(seed=rng.randrange(1 << 30), n_edits=n_edits)

    def operator(parent: str, instruction: str = "") -> tuple[str | None, Any]:
        if p_crossover > 0 and len(archive.elites) > 1 and rng.random() < p_crossover:
            donor_key = rng.choice(list(archive.elites))
            child, desc = crossover(parent, archive.game_text(donor_key), rng)
            if child is not None:
                return child, GrammarLog(operator=f"crossover from {donor_key}: {desc}",
                                         instruction=instruction, attempts=1, ok=True)
        return gm.mutate(parent, instruction)

    return operator


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", nargs="+", default=["sokoban_basic", "kettle", "slidings"])
    ap.add_argument("--out", default="data/evolve/run1")
    ap.add_argument("--gens", type=int, default=10)
    ap.add_argument("--per-gen", type=int, default=3)
    ap.add_argument("--operator", choices=["grammar", "llm"], default="grammar",
                    help="grammar: structural edits, no model, thousands/hour. "
                         "llm: prof.mutate through a local Ollama server.")
    ap.add_argument("--edits", type=int, default=1, help="grammatical edits per child")
    ap.add_argument("--p-crossover", type=float, default=0.25,
                    help="chance a grammatical child is a graft from another elite")
    ap.add_argument("--model", default="qwen3.8:27b-mlx")
    ap.add_argument("--max-levels", type=int, default=6)
    ap.add_argument("--timeout-ms", type=int, default=3000)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--insight", action="store_true",
                    help="fold the insight gap (prof.players) into tier-3 fitness")
    ap.add_argument("--eval-timeout", type=float, default=120.0,
                    help="wall-clock cap per candidate; a child that overruns is unfit")
    ap.add_argument("--in-process", action="store_true",
                    help="evaluate in this process (faster, but one bad game kills the run)")
    a = ap.parse_args()
    out = ROOT / a.out
    archive = Archive(out, DEFAULT_DESCRIPTORS)
    eval_kwargs: dict[str, Any] = {"max_levels": a.max_levels, "timeout_ms": a.timeout_ms}
    if a.insight:
        eval_kwargs["insight"] = True
    if a.in_process:
        evaluator: Callable[..., Evaluation] = evaluate
    else:
        def evaluator(text: str, **kw: Any) -> Evaluation:
            return evaluate_isolated(text, timeout_s=a.eval_timeout, **kw)
    if not archive.elites:
        seed_archive(archive, a.seeds, eval_kwargs, evaluator)
    rng = random.Random(a.seed)
    if a.operator == "llm":
        from prof.mutate import INSTRUCTIONS, OllamaMutator
        mutate_fn = OllamaMutator(model=a.model).mutate
        instructions = INSTRUCTIONS
    else:
        mutate_fn = make_grammar_operator(archive, rng, a.edits, a.p_crossover)
        instructions = [""]
    run(archive, mutate_fn, a.gens, a.per_gen, instructions, eval_kwargs, rng,
        out / "log.jsonl", evaluator)


if __name__ == "__main__":
    main()
