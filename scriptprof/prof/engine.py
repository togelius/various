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
