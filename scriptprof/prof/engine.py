"""Compile PuzzleScript text with the original engine and run C++ solvers.

The upstream Python code drives the JavaScript compiler through JSPyBridge,
which does not work with current Node releases. We instead shell out to a tiny
Node CLI (``tools/compile_cli.js``) that returns the compiled state as JSON,
then hand that JSON to the C++ engine directly.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
VENDOR = ROOT / "vendor" / "script-doctor"
ENGINE_JS = VENDOR / "puzzlescript_nodejs" / "puzzlescript" / "engine.js"
COMPILE_CLI = ROOT / "tools" / "compile_cli.js"

if str(VENDOR) not in sys.path:
    sys.path.insert(0, str(VENDOR))


class CompileError(Exception):
    pass


@dataclass
class Compiled:
    text: str
    n_levels: int
    state: dict[str, Any]

    @property
    def json(self) -> str:
        return json.dumps(self.state)


def compile_text(text: str, timeout: float = 60.0) -> Compiled:
    """Compile PuzzleScript source with the original JS engine."""
    proc = subprocess.run(
        ["node", str(COMPILE_CLI), str(ENGINE_JS)],
        input=text.encode("utf-8"),
        capture_output=True,
        timeout=timeout,
    )
    out = proc.stdout.decode("utf-8", errors="replace")
    if proc.returncode != 0 or not out:
        raise CompileError(proc.stderr.decode("utf-8", errors="replace")[-2000:])
    res = json.loads(out)
    if not res.get("ok"):
        raise CompileError(res.get("error", "unknown compile error"))
    return Compiled(text=text, n_levels=int(res["levels"]), state=res["state"])


def compile_file(path: str | os.PathLike) -> Compiled:
    return compile_text(Path(path).read_text(encoding="utf-8"))


def new_engine(compiled: Compiled):
    """Return a C++ engine with the compiled game loaded."""
    from puzzlescript_cpp import CppPuzzleScriptEngine

    eng = CppPuzzleScriptEngine()
    eng.load_from_json(compiled.json)
    return eng


@dataclass
class Solve:
    algo: str
    level: int
    solved: bool
    actions: list[int]
    iterations: int
    time: float
    timeout: bool


def solve_level(eng, level: int, algo: str = "bfs", max_iters: int = 100_000,
                timeout_ms: int = -1) -> Solve:
    eng.load_level(level)
    fn = {"bfs": eng.solve_bfs, "astar": eng.solve_astar, "gbfs": eng.solve_gbfs}[algo]
    r = fn(max_iters=max_iters, timeout_ms=timeout_ms)
    return Solve(
        algo=algo,
        level=level,
        solved=bool(r.won),
        actions=list(r.actions),
        iterations=int(r.iterations),
        time=float(r.time),
        timeout=bool(getattr(r, "timeout", False)),
    )


def level_indices(compiled: Compiled) -> list[int]:
    """Indices of playable levels (the engine also counts message screens)."""
    eng = new_engine(compiled)
    out = []
    for i in range(compiled.n_levels):
        try:
            eng.load_level(i)
        except Exception:
            continue
        if eng.width > 0 and eng.height > 0:
            out.append(i)
    return out


# ---- rule-firing instrumentation (scriptprof patch to the C++ engine) -----

def rule_fire_counts(eng) -> dict[int, int]:
    """Counts of rule applications since the last reset, keyed by source line."""
    return {int(k): int(v) for k, v in eng._engine.get_rule_fire_counts().items()}


TICK = -1  # the engine's "no input, advance a turn" action


def step(eng, action: int) -> bool:
    """Apply one action and settle any `again` ticks it triggers.

    A rule suffixed with `again` asks the engine to run another turn once this
    one finishes: it is how PuzzleScript expresses gravity, spreading fire,
    sliding blocks and the like. The C++ solvers settle those ticks after every
    action (``processInputSearch``), but the raw ``process_input`` binding does
    not. Replaying a solver's action list without settling them therefore ends
    in a different state than the solver reached. 304 of the 952 corpus games
    use `again` in a rule, so this is the common case, not an edge case.
    """
    changed = bool(eng.process_input(action))
    for _ in range(1000):  # a rule looping forever would otherwise hang here
        if not eng.againing:
            break
        changed = bool(eng.process_input(TICK)) or changed
    return changed


def replay(eng, level: int, actions: list[int]) -> dict[str, Any]:
    """Replay actions on a level from scratch, returning win flag and rule counts."""
    eng.load_level(level)
    eng._engine.reset_rule_fire_counts()
    changed = 0
    for a in actions:
        changed += int(step(eng, a))
    return {"won": bool(eng.winning), "steps": len(actions), "changed": changed,
            "counts": rule_fire_counts(eng)}


def rule_source_lines(text: str) -> dict[int, str]:
    """1-based line number -> source line, for every line containing a rule arrow."""
    out = {}
    for i, ln in enumerate(text.splitlines(), start=1):
        if "->" in ln:
            out[i] = ln.strip()
    return out


def coverage(compiled: Compiled, solutions: dict[int, list[int]]) -> dict[str, Any]:
    """Rule coverage over a set of level solutions.

    ``solutions`` maps level index -> action list. Returns which rule source
    lines fired on at least one solution, which never fired, and per-level
    counts. This is the check GAVEL could not do in Ludii: a rule that never
    fires on any solution is an unused game component.
    """
    eng = new_engine(compiled)
    src = rule_source_lines(compiled.text)
    fired: dict[int, int] = {}
    per_level = {}
    for lvl, acts in solutions.items():
        r = replay(eng, lvl, acts)
        per_level[lvl] = r
        for k, v in r["counts"].items():
            fired[k] = fired.get(k, 0) + v
    compiled_lines = {r["lineNumber"] for g in compiled.state.get("rules", []) + compiled.state.get("lateRules", []) for r in g}
    never = sorted(compiled_lines - set(fired))
    return {
        "n_rules": len(compiled_lines),
        "n_fired": len(set(fired) & compiled_lines),
        "never_fired": [(ln, src.get(ln, "?")) for ln in never],
        "fired": {ln: (fired[ln], src.get(ln, "?")) for ln in sorted(fired)},
        "per_level": per_level,
    }
