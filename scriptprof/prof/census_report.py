"""Turn data/census/raw/*.json into data/census/REPORT.md.

    .venv/bin/python -m prof.census_report
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "census" / "raw"
OUT = ROOT / "data" / "census" / "REPORT.md"


def main() -> None:
    recs = [json.loads(p.read_text()) for p in sorted(RAW.glob("*.json"))]
    n = len(recs)
    compiled = [r for r in recs if r["compiled"]]
    hangs = [r for r in recs if (r.get("error") or "").startswith("hang")]
    cerr = [r for r in recs if not r["compiled"] and r not in hangs]
    levels = [l for r in compiled for l in r["levels"] if "error" not in l]
    solved = [l for l in levels if l["solved"]]
    timeouts = [l for l in levels if l.get("timeout")]
    full = [r for r in compiled if r["levels"] and all(l.get("solved") for l in r["levels"] if "error" not in l)]
    partial = [r for r in compiled if r["levels"] and any(l.get("solved") for l in r["levels"]) and r not in full]
    none_ = [r for r in compiled if r["levels"] and not any(l.get("solved") for l in r["levels"])]
    rnd = [r for r in compiled if r.get("random")]
    lens = Counter()
    for l in solved:
        b = "1-4" if l["len"] < 5 else "5-9" if l["len"] < 10 else "10-19" if l["len"] < 20 else "20-39" if l["len"] < 40 else "40-79" if l["len"] < 80 else "80+"
        lens[b] += 1
    err_kinds = Counter((r.get("error") or "")[:50] for r in cerr)
    lines = [
        "# PuzzleScript corpus census",
        "",
        "Every scraped game compiled with the original PuzzleScript engine, every",
        "playable level searched with breadth-first search in the C++ engine",
        "(budget per level: 100k expansions or 5 s; per game: 600 s wall clock).",
        "",
        "| | count |",
        "|---|---|",
        f"| games | {n} |",
        f"| compiled | {len(compiled)} |",
        f"| compile errors | {len(cerr)} |",
        f"| engine hangs (wall-clock cap) | {len(hangs)} |",
        f"| games flagged as using randomness | {len(rnd)} |",
        f"| playable levels | {len(levels)} |",
        f"| levels solved | {len(solved)} |",
        f"| levels hitting the time budget | {len(timeouts)} |",
        f"| games with every level solved | {len(full)} |",
        f"| games with some levels solved | {len(partial)} |",
        f"| games with no level solved | {len(none_)} |",
        "",
        "## Solution lengths (solved levels)",
        "",
        "| moves | levels |",
        "|---|---|",
    ]
    for b in ["1-4", "5-9", "10-19", "20-39", "40-79", "80+"]:
        lines.append(f"| {b} | {lens[b]} |")
    lines += ["", "## Compile error kinds", "", "| error (prefix) | games |", "|---|---|"]
    for k, v in err_kinds.most_common(15):
        lines.append(f"| `{k.replace('|', '/')}` | {v} |")
    if hangs:
        lines += ["", "## Engine hangs", "", ", ".join(sorted(r["game"] for r in hangs))]
    top = sorted(((max((l["len"] for l in r["levels"] if l.get("solved")), default=0), r["game"]) for r in full), reverse=True)[:25]
    lines += ["", "## Fully solved games with the longest solutions", "", "| game | longest solution |", "|---|---|"]
    for ln, g in top:
        lines.append(f"| {g} | {ln} |")
    OUT.write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:22]))


if __name__ == "__main__":
    main()
