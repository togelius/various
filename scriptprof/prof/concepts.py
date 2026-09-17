"""Static concept vectors for PuzzleScript games (the analogue of Ludii concepts).

Two sources are combined:

* the game **source text** (keywords and section structure: rule prefixes,
  commands, `late`, `random`, ellipses, messages, ...), and
* the **compiled state** produced by the original engine (object, layer, rule
  and win-condition counts, level geometry), which is grounded in what the
  engine actually runs.

The result is a flat ``dict[str, float]`` with a stable key order (see
``KEYS``), suitable as MAP-Elites behaviour descriptors or for PCA.
"""
from __future__ import annotations

import math
import re
from typing import Any

# ---- text features -------------------------------------------------------

_SECTIONS = ["OBJECTS", "LEGEND", "SOUNDS", "COLLISIONLAYERS", "RULES",
             "WINCONDITIONS", "LEVELS"]

_RULE_PREFIX_WORDS = {
    "late": "rule_late",
    "random": "rule_random",
    "rigid": "rule_rigid",
    "horizontal": "rule_dir_horizontal",
    "vertical": "rule_dir_vertical",
    "up": "rule_dir_fixed", "down": "rule_dir_fixed",
    "left": "rule_dir_fixed", "right": "rule_dir_fixed",
    "+": "rule_grouped",
}
_CELL_WORDS = {
    "no": "cell_no",
    "stationary": "cell_stationary",
    "moving": "cell_moving",
    "perpendicular": "cell_perpendicular",
    "parallel": "cell_parallel",
    "orthogonal": "cell_orthogonal",
    "randomdir": "cell_randomdir",
    "random": "cell_random",
    "action": "cell_action",
    "...": "cell_ellipsis",
}
_COMMANDS = ["win", "cancel", "restart", "again", "checkpoint", "message", "sfx"]
_PRELUDE_FLAGS = ["run_rules_on_level_start", "noaction", "norepeat_action",
                  "throttle_movement", "noundo", "norestart", "realtime_interval",
                  "zoomscreen", "flickscreen", "require_player_movement"]


def _strip_comments(s: str) -> str:
    # PuzzleScript comments are (nested) parentheses.
    out, depth = [], 0
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return "".join(out)


def _sections(text: str) -> dict[str, str]:
    t = _strip_comments(text)
    # Section headers are lines of ===== followed by the name; be lenient.
    pos = {}
    for name in _SECTIONS:
        m = re.search(rf"^\s*{name}\s*$", t, flags=re.I | re.M)
        if m:
            pos[name] = m.start()
    order = sorted(pos.items(), key=lambda kv: kv[1])
    secs = {"PRELUDE": t[: order[0][1]] if order else t}
    for i, (name, start) in enumerate(order):
        end = order[i + 1][1] if i + 1 < len(order) else len(t)
        secs[name] = t[start:end]
    return secs


def text_features(text: str) -> dict[str, float]:
    f: dict[str, float] = {}
    secs = _sections(text)
    rules = secs.get("RULES", "")
    rule_lines = [ln for ln in rules.splitlines() if "->" in ln]
    f["n_rule_lines"] = len(rule_lines)
    low = rules.lower()
    for word, key in _RULE_PREFIX_WORDS.items():
        n = sum(1 for ln in rule_lines
                if re.match(rf"^\s*(\+\s*)?(\w+\s+)*{re.escape(word)}\b", ln.lower())) if word != "+" \
            else sum(1 for ln in rule_lines if ln.strip().startswith("+"))
        f[key] = f.get(key, 0) + n
    for word, key in _CELL_WORDS.items():
        f[key] = len(re.findall(rf"(?<![\w.]){re.escape(word)}(?![\w.])", low)) if word != "..." \
            else low.count("...")
    f["cell_arrows"] = len(re.findall(r"[<>^v](?=\s+\w)", rules))  # rough count of force tokens
    for cmd in _COMMANDS:
        f[f"cmd_{cmd}"] = sum(1 for ln in rule_lines if re.search(rf"->.*\b{cmd}\b", ln.lower()))
    f["rule_multicell_max"] = max((ln.count("|") + 1 for ln in rule_lines), default=0)
    f["rule_multipattern"] = sum(1 for ln in rule_lines if ln.count("]") >= 4)  # >=2 patterns per side
    f["startloop"] = int("startloop" in low)
    pre = secs.get("PRELUDE", "").lower()
    for flag in _PRELUDE_FLAGS:
        f[f"pre_{flag}"] = int(re.search(rf"^\s*{flag}\b", pre, flags=re.M) is not None)
    lv = secs.get("LEVELS", "")
    f["n_messages"] = len(re.findall(r"^\s*message\b", lv, flags=re.I | re.M))
    legend = secs.get("LEGEND", "")
    f["legend_or"] = len(re.findall(r"\bor\b", legend, flags=re.I))
    f["legend_and"] = len(re.findall(r"\band\b", legend, flags=re.I))
    f["n_sounds"] = len([ln for ln in secs.get("SOUNDS", "").splitlines() if ln.strip()][1:])
    return f


# ---- compiled-state features --------------------------------------------

def _popcount_masks(masks: list[list[int]]) -> int:
    return sum(bin(w & 0xFFFFFFFF).count("1") for m in masks for w in m)


def compiled_features(state: dict[str, Any]) -> dict[str, float]:
    f: dict[str, float] = {}
    f["n_objects"] = state.get("objectCount", 0)
    f["n_layers"] = state.get("layerCount", 0)
    pm = state.get("playerMask")
    f["n_player_objects"] = _popcount_masks([pm[1]]) if isinstance(pm, list) and len(pm) > 1 else 0
    groups = state.get("rules", [])
    late = state.get("lateRules", [])
    f["n_rule_groups"] = len(groups)
    f["n_rules_compiled"] = sum(len(g) for g in groups)
    f["n_late_groups"] = len(late)
    f["n_late_rules_compiled"] = sum(len(g) for g in late)
    src_lines = {r["lineNumber"] for g in groups + late for r in g}
    f["n_rule_sources"] = len(src_lines)
    f["n_random_rules"] = sum(1 for g in groups + late for r in g if r.get("isRandom"))
    f["n_rules_with_commands"] = sum(1 for g in groups + late for r in g if r.get("commands"))
    f["n_rules_ellipsis"] = sum(1 for g in groups + late for r in g if any(e > 0 for e in r.get("ellipsisCount", [])))
    f["rigid"] = int(bool(state.get("rigid")))
    f["has_loop"] = int(bool(state.get("loopPoint")) or bool(state.get("lateLoopPoint")))
    # pattern geometry
    widths = [len(row) for g in groups + late for r in g for row in r.get("patterns", [])]
    f["pattern_max_cells"] = max(widths, default=0)
    f["pattern_mean_cells"] = (sum(widths) / len(widths)) if widths else 0
    nrows = [len(r.get("patterns", [])) for g in groups + late for r in g]
    f["pattern_max_rows"] = max(nrows, default=0)
    # movement / creation / deletion in replacements
    mv_set = obj_set = obj_clear = 0
    for g in groups + late:
        for r in g:
            for row in r.get("patterns", []):
                for cell in row:
                    rep = cell.get("replacement") if isinstance(cell, dict) else None
                    if not rep:
                        continue
                    mv_set += int(any(rep.get("movementsSet", [])))
                    obj_set += int(any(rep.get("objectsSet", [])))
                    obj_clear += int(any(rep.get("objectsClear", [])))
    f["rep_moves"] = mv_set
    f["rep_creates"] = obj_set
    f["rep_clears"] = obj_clear
    wcs = state.get("winconditions", [])
    f["n_winconditions"] = len(wcs)
    f["win_no"] = sum(1 for w in wcs if w.get("num") == -1)
    f["win_some"] = sum(1 for w in wcs if w.get("num") == 0)
    f["win_all"] = sum(1 for w in wcs if w.get("num") == 1)
    f["win_on"] = sum(1 for w in wcs if w.get("mask2") and w.get("mask2") != [0] and not w.get("mask2_is_all"))
    levels = [lv for lv in state.get("levels", []) if isinstance(lv, dict) and lv.get("type") != "message"]
    f["n_levels"] = len(levels)
    ws = [lv.get("width", 0) for lv in levels if lv.get("width")]
    hs = [lv.get("height", 0) for lv in levels if lv.get("height")]
    f["level_mean_area"] = (sum(w * h for w, h in zip(ws, hs)) / len(ws)) if ws else 0
    f["level_max_area"] = max((w * h for w, h in zip(ws, hs)), default=0)
    f["n_collision_layers"] = len(state.get("collisionLayers", []))
    return f


def concepts(text: str, state: dict[str, Any] | None) -> dict[str, float]:
    f = text_features(text)
    if state is not None:
        f.update(compiled_features(state))
    return {k: (0.0 if (isinstance(v, float) and math.isnan(v)) else float(v)) for k, v in f.items()}


KEYS: list[str] = list(concepts("", {}).keys())
