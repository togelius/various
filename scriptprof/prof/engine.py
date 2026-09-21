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


def compile_text(text: str, timeout: float = 20.0) -> Compiled:
    """Compile PuzzleScript source with the original JS engine.

    The default timeout is generous rather than tuned: a real game compiles in
    under a fifth of a second, so anything near the limit is a mutant that has
    found a pathological case, and an evolutionary loop cannot afford to wait a
    minute for each of those.
    """
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


def js_level_indices(compiled: Compiled) -> list[int]:
    """JavaScript-engine indices of the playable levels, in C++ order.

    **Three engines, two index spaces.**  The original JavaScript engine
    numbers message screens alongside levels, so COIN_COLLECTORS has 36
    "levels" of which 26 are instruction screens.  The C++ port and PuzzleJAX
    both drop messages and number the remainder contiguously, so for them the
    same game has 10 levels and C++ level 0 is JavaScript level 6.

    Verified rather than assumed: C++ solutions for levels 0, 1 and 2 of that
    game replay to a win in PuzzleJAX at the *same* index, so those two agree
    and only the JavaScript side needs translating.  Anything handing a level
    number to ``tools/replay_cli.js`` must come through here first, because the
    failure is silent -- a solution replayed on the wrong level simply does not
    win, which reads as the engines disagreeing.
    """
    levels = compiled.state.get("levels") or []
    return [i for i, lv in enumerate(levels)
            if not (isinstance(lv, dict)
                    and (lv.get("type") == "message" or "message" in lv))]


def level_indices(compiled: Compiled) -> list[int]:
    """Playable level indices in the C++ engine's numbering.

    Not the same as the JavaScript engine's numbering; see
    :func:`js_level_indices`.
    """
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
    for _ in range(1000):  # same cap as processInputSearch in the C++ solver
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
