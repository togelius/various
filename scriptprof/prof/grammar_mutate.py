"""Grammatical mutation operators for PuzzleScript games (PLAN.md, WP1).

The LLM operator in ``prof.mutate`` proposes edits in natural language and
needs a repair loop to reach code that compiles. This module is the baseline
it has to beat: structural edits made directly to the source text, chosen so
that the result is nearly always still a legal game. Each operator is cheap
(no model call), so MAP-Elites can run at thousands of candidates per hour and
the LLM's contribution can be measured against a like-for-like search.

The operators are deliberately semantic rather than character-level. Rule
order matters in PuzzleScript, a direction prefix restricts when a rule fires,
and flipping a force token in a pattern inverts a mechanic (pushing becomes
pulling, the "alien semantics" case PuzzleJAX raises). Those are the edits a
designer makes; random character noise is not.

    from prof.grammar_mutate import GrammarMutator
    m = GrammarMutator(seed=1)
    child, log = m.mutate(parent_text, instruction="")   # instruction ignored
"""
from __future__ import annotations

import random
import re
import time
from dataclasses import dataclass, field
from typing import Callable

SECTIONS = ["OBJECTS", "LEGEND", "SOUNDS", "COLLISIONLAYERS", "RULES",
            "WINCONDITIONS", "LEVELS"]

# Words that may precede the first `[` of a rule.
RULE_PREFIXES = {"late", "random", "rigid", "up", "down", "left", "right",
                 "horizontal", "vertical"}
DIRECTIONS = ["up", "down", "left", "right", "horizontal", "vertical"]
FORCES = [">", "<", "^", "v"]


@dataclass
class GrammarLog:
    """Record of one grammatical mutation, mirroring ``mutate.MutationLog``."""
    model: str = "grammar"
    instruction: str = ""
    operator: str = ""
    attempts: int = 0
    seconds: float = 0.0
    gen_tokens: int = 0
    errors: list[str] = field(default_factory=list)
    ok: bool = False


# ---- section and line structure ------------------------------------------

def split_sections(lines: list[str]) -> dict[str, tuple[int, int]]:
    """Map section name -> (first body line, end line) as indices into ``lines``.

    Section headers are a line holding only the section name, conventionally
    wrapped in rows of ``=``. The body runs to the next header's decoration.
    """
    heads: list[tuple[int, str]] = []
    for i, ln in enumerate(lines):
        name = ln.strip().upper()
        if name in SECTIONS:
            heads.append((i, name))
    out: dict[str, tuple[int, int]] = {}
    for j, (i, name) in enumerate(heads):
        start = i + 1
        # Skip a row of '=' directly under the header.
        if start < len(lines) and set(lines[start].strip()) == {"="}:
            start += 1
        if j + 1 < len(heads):
            end = heads[j + 1][0]
            # Back off over a row of '=' decorating the next header.
            while end > start and (not lines[end - 1].strip()
                                   or set(lines[end - 1].strip()) == {"="}):
                end -= 1
        else:
            end = len(lines)
        out[name] = (start, end)
    return out


def _strip_comments(s: str) -> str:
    """Remove PuzzleScript's (possibly nested) parenthesised comments."""
    out, depth = [], 0
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return "".join(out)


def rule_line_indices(lines: list[str], secs: dict[str, tuple[int, int]]) -> list[int]:
    """Indices of lines in RULES that carry a rewrite arrow."""
    if "RULES" not in secs:
        return []
    lo, hi = secs["RULES"]
    return [i for i in range(lo, min(hi, len(lines)))
            if "->" in _strip_comments(lines[i])]


@dataclass
class Level:
    """One level block in the LEVELS section: a run of equal-width grid lines."""
    start: int
    end: int  # exclusive

    @property
    def n_rows(self) -> int:
        return self.end - self.start


def level_blocks(lines: list[str], secs: dict[str, tuple[int, int]]) -> list[Level]:
    """Contiguous runs of grid lines in LEVELS, skipping messages and blanks."""
    if "LEVELS" not in secs:
        return []
    lo, hi = secs["LEVELS"]
    out: list[Level] = []
    cur: list[int] = []
    for i in range(lo, min(hi, len(lines))):
        raw = lines[i]
        s = raw.strip()
        is_grid = bool(s) and not s.lower().startswith("message") and "(" not in raw
        if is_grid and (not cur or len(raw) == len(lines[cur[0]])):
            cur.append(i)
        else:
            if len(cur) >= 2:
                out.append(Level(cur[0], cur[-1] + 1))
            cur = [i] if is_grid else []
    if len(cur) >= 2:
        out.append(Level(cur[0], cur[-1] + 1))
    return out


def _set_char(lines: list[str], row: int, col: int, ch: str) -> None:
    lines[row] = lines[row][:col] + ch + lines[row][col + 1:]


def _interior_cells(lines: list[str], lv: Level) -> list[tuple[int, int]]:
    """Cells of a level excluding its outer ring, which is usually the wall."""
    width = len(lines[lv.start])
    if lv.n_rows < 3 or width < 3:
        return [(r, c) for r in range(lv.start, lv.end) for c in range(width)]
    return [(r, c) for r in range(lv.start + 1, lv.end - 1)
            for c in range(1, width - 1)]


def _rule_body_start(line: str) -> int:
    """Column of the first `[` in a rule line, or -1."""
    return line.find("[")


def _split_prefix(line: str) -> tuple[str, str, str]:
    """Split a rule line into (indent, prefix words, body from the first `[`)."""
    b = _rule_body_start(line)
    if b < 0:
        return line, "", ""
    head = line[:b]
    indent = head[: len(head) - len(head.lstrip())]
    return indent, head[len(indent):], line[b:]


# ---- operators -----------------------------------------------------------
# Each takes (lines, rng) and returns a description of what it did, or None
# when it does not apply to this game. They mutate ``lines`` in place.

Operator = Callable[[list[str], random.Random], "str | None"]


def op_rule_delete(lines: list[str], rng: random.Random) -> str | None:
    """Drop a rule. Removes a mechanic outright."""
    idx = rule_line_indices(lines, split_sections(lines))
    if len(idx) < 2:  # never leave a game with no rules at all
        return None
    i = rng.choice(idx)
    removed = lines[i].strip()
    del lines[i]
    return f"deleted rule: {removed[:60]}"


def op_rule_reorder(lines: list[str], rng: random.Random) -> str | None:
    """Swap two rules. Rules apply top to bottom, so order is semantic."""
    idx = rule_line_indices(lines, split_sections(lines))
    if len(idx) < 2:
        return None
    i, j = rng.sample(idx, 2)
    lines[i], lines[j] = lines[j], lines[i]
    return f"swapped rules at lines {i + 1} and {j + 1}"


def op_rule_direction(lines: list[str], rng: random.Random) -> str | None:
    """Add, change, or drop a rule's direction prefix, restricting when it fires."""
    idx = rule_line_indices(lines, split_sections(lines))
    if not idx:
        return None
    i = rng.choice(idx)
    indent, prefix, body = _split_prefix(lines[i])
    if not body:
        return None
    words = [w for w in prefix.split() if w.lower() not in DIRECTIONS]
    if rng.random() < 0.3:
        new_dir = ""  # drop the direction: the rule fires in all rotations
    else:
        new_dir = rng.choice(DIRECTIONS)
    parts = words + ([new_dir] if new_dir else [])
    lines[i] = indent + (" ".join(parts) + " " if parts else "") + body
    return f"rule direction -> {new_dir or 'any'}: {lines[i].strip()[:60]}"


def op_rule_late(lines: list[str], rng: random.Random) -> str | None:
    """Toggle `late`, moving a rule after the movement phase of a turn."""
    idx = rule_line_indices(lines, split_sections(lines))
    if not idx:
        return None
    i = rng.choice(idx)
    indent, prefix, body = _split_prefix(lines[i])
    if not body:
        return None
    words = prefix.split()
    had = any(w.lower() == "late" for w in words)
    words = [w for w in words if w.lower() != "late"]
    if not had:
        words = ["late"] + words
    lines[i] = indent + (" ".join(words) + " " if words else "") + body
    return f"{'removed' if had else 'added'} late: {lines[i].strip()[:60]}"


def op_rule_flip_force(lines: list[str], rng: random.Random) -> str | None:
    """Flip a force arrow inside a rule.

    Turning `>` into `<` on the right-hand side is how pushing becomes
    pulling: the inverted-Sokoban case PuzzleJAX names as a test of
    out-of-distribution reasoning.
    """
    idx = rule_line_indices(lines, split_sections(lines))
    rng.shuffle(idx)
    for i in idx:
        _, _, body = _split_prefix(lines[i])
        if not body:
            continue
        spots = [m.start() for m in re.finditer(r"[><^v](?=\s*\w)", body)]
        if not spots:
            continue
        col = rng.choice(spots)
        old = body[col]
        new = rng.choice([f for f in FORCES if f != old])
        body = body[:col] + new + body[col + 1:]
        indent, prefix, _ = _split_prefix(lines[i])
        lines[i] = indent + prefix + body
        return f"flipped force {old} -> {new}: {lines[i].strip()[:60]}"
    return None


def op_win_condition(lines: list[str], rng: random.Random) -> str | None:
    """Switch a win condition between `all` and `some`, or drop one of several."""
    secs = split_sections(lines)
    if "WINCONDITIONS" not in secs:
        return None
    lo, hi = secs["WINCONDITIONS"]
    idx = [i for i in range(lo, min(hi, len(lines))) if lines[i].strip()
           and "(" not in lines[i]]
    if not idx:
        return None
    i = rng.choice(idx)
    s = lines[i]
    if re.match(r"^\s*all\b", s, re.I):
        lines[i] = re.sub(r"^(\s*)all\b", r"\1some", s, flags=re.I)
    elif re.match(r"^\s*some\b", s, re.I):
        lines[i] = re.sub(r"^(\s*)some\b", r"\1all", s, flags=re.I)
    elif len(idx) > 1:
        del lines[i]
        return f"dropped win condition: {s.strip()[:60]}"
    else:
        return None
    return f"win condition -> {lines[i].strip()[:60]}"


def op_level_swap(lines: list[str], rng: random.Random) -> str | None:
    """Swap two interior tiles. Preserves the multiset of objects in the level."""
    lvs = level_blocks(lines, split_sections(lines))
    if not lvs:
        return None
    lv = rng.choice(lvs)
    cells = _interior_cells(lines, lv)
    if len(cells) < 2:
        return None
    for _ in range(20):
        (r1, c1), (r2, c2) = rng.sample(cells, 2)
        a, b = lines[r1][c1], lines[r2][c2]
        if a != b:
            _set_char(lines, r1, c1, b)
            _set_char(lines, r2, c2, a)
            return f"swapped level tiles {a!r} and {b!r}"
    return None


def op_level_retile(lines: list[str], rng: random.Random) -> str | None:
    """Overwrite one interior tile with another character used in that level.

    Drawing only from the level's own alphabet keeps every character legal
    under the legend, so the edit changes layout without breaking the parse.
    """
    lvs = level_blocks(lines, split_sections(lines))
    if not lvs:
        return None
    lv = rng.choice(lvs)
    cells = _interior_cells(lines, lv)
    if not cells:
        return None
    alphabet = sorted({lines[r][c] for r, c in cells})
    if len(alphabet) < 2:
        return None
    r, c = rng.choice(cells)
    old = lines[r][c]
    new = rng.choice([ch for ch in alphabet if ch != old])
    _set_char(lines, r, c, new)
    return f"retiled level cell {old!r} -> {new!r}"


def op_level_drop(lines: list[str], rng: random.Random) -> str | None:
    """Remove a level. Shortens a game whose later levels are unsolvable."""
    lvs = level_blocks(lines, split_sections(lines))
    if len(lvs) < 2:
        return None
    lv = rng.choice(lvs)
    del lines[lv.start:lv.end]
    return f"dropped a {lv.n_rows}-row level"


def op_level_duplicate(lines: list[str], rng: random.Random) -> str | None:
    """Duplicate a level, giving a later mutation a fresh copy to vary."""
    lvs = level_blocks(lines, split_sections(lines))
    if not lvs or len(lvs) > 40:
        return None
    lv = rng.choice(lvs)
    block = lines[lv.start:lv.end]
    lines[lv.end:lv.end] = [""] + block
    return f"duplicated a {lv.n_rows}-row level"


OPERATORS: list[tuple[str, Operator, float]] = [
    ("rule_delete", op_rule_delete, 0.8),
    ("rule_reorder", op_rule_reorder, 1.0),
    ("rule_direction", op_rule_direction, 1.2),
    ("rule_late", op_rule_late, 0.8),
    ("rule_flip_force", op_rule_flip_force, 1.5),
    ("win_condition", op_win_condition, 0.8),
    ("level_swap", op_level_swap, 1.5),
    ("level_retile", op_level_retile, 1.5),
    ("level_drop", op_level_drop, 0.4),
    ("level_duplicate", op_level_duplicate, 0.4),
]


# ---- crossover -----------------------------------------------------------

_IDENT = re.compile(r"[A-Za-z_][A-Za-z_0-9]*")
_NOT_OBJECTS = {w.lower() for w in RULE_PREFIXES} | {
    "no", "moving", "stationary", "parallel", "perpendicular", "orthogonal",
    "action", "randomdir", "win", "again", "cancel", "restart", "checkpoint",
    "message", "sfx0", "sfx1", "sfx2", "sfx3", "sfx4", "sfx5",
}


def declared_names(text: str) -> set[str]:
    """Object and legend names a game defines, lowercased."""
    lines = text.splitlines()
    secs = split_sections(lines)
    names: set[str] = set()
    for sec in ("OBJECTS", "LEGEND"):
        if sec not in secs:
            continue
        lo, hi = secs[sec]
        for i in range(lo, min(hi, len(lines))):
            s = _strip_comments(lines[i]).strip()
            if not s:
                continue
            if sec == "LEGEND":
                if "=" in s:
                    names.add(s.split("=")[0].strip().lower())
                    for part in re.split(r"\bor\b|\band\b", s.split("=", 1)[1], flags=re.I):
                        names.add(part.strip().lower())
            else:
                # An object name is a line that is not a colour or sprite row.
                m = _IDENT.fullmatch(s.split()[0]) if s.split() else None
                if m and not set(s) <= set("0123456789. "):
                    names.add(s.split()[0].lower())
    return {n for n in names if n}


def rule_identifiers(rule_line: str) -> set[str]:
    """Object-like identifiers referenced by a rule, lowercased."""
    body = _strip_comments(rule_line)
    return {w.lower() for w in _IDENT.findall(body)} - _NOT_OBJECTS


def crossover(recipient: str, donor: str, rng: random.Random) -> tuple[str | None, str]:
    """Graft one of the donor's rules into the recipient.

    Only rules whose identifiers the recipient already declares are eligible,
    so the child keeps a chance of compiling. This is the cheap analogue of
    GAVEL's recombination of mechanics across games.
    """
    d_lines = donor.splitlines()
    d_idx = rule_line_indices(d_lines, split_sections(d_lines))
    have = declared_names(recipient)
    usable = [i for i in d_idx if rule_identifiers(d_lines[i]) <= have]
    if not usable:
        return None, "no donor rule fits the recipient's objects"
    src = d_lines[rng.choice(usable)]
    r_lines = recipient.splitlines()
    secs = split_sections(r_lines)
    r_idx = rule_line_indices(r_lines, secs)
    if r_idx:
        at = rng.choice(r_idx + [r_idx[-1] + 1])
    elif "RULES" in secs:
        at = secs["RULES"][0]
    else:
        return None, "recipient has no RULES section"
    r_lines.insert(at, src)
    return "\n".join(r_lines) + "\n", f"grafted rule: {src.strip()[:60]}"


# ---- the operator as a mutation function ---------------------------------

class GrammarMutator:
    """Applies one or more grammatical edits, retrying operators that do not apply.

    The signature matches ``prof.mutate.OllamaMutator.mutate`` so the two are
    interchangeable in ``prof.evolve``. ``instruction`` is accepted and
    recorded but unused: these operators are not language-conditioned.
    """

    def __init__(self, seed: int | None = None, n_edits: int = 1,
                 max_attempts: int = 6, operators=None):
        self.rng = random.Random(seed)
        self.n_edits = n_edits
        self.max_attempts = max_attempts
        self.operators = operators or OPERATORS

    def _apply_one(self, lines: list[str]) -> str | None:
        names = [n for n, _, _ in self.operators]
        weights = [w for _, _, w in self.operators]
        fns = {n: f for n, f, _ in self.operators}
        for _ in range(self.max_attempts):
            name = self.rng.choices(names, weights=weights, k=1)[0]
            desc = fns[name](lines, self.rng)
            if desc is not None:
                return f"{name}: {desc}"
        return None

    def mutate(self, parent: str, instruction: str = "") -> tuple[str | None, GrammarLog]:
        log = GrammarLog(instruction=instruction)
        t0 = time.time()
        lines = parent.splitlines()
        descs = []
        for _ in range(self.n_edits):
            log.attempts += 1
            d = self._apply_one(lines)
            if d is None:
                log.errors.append("no operator applied")
                break
            descs.append(d)
        log.seconds = time.time() - t0
        log.operator = "; ".join(descs)
        if not descs:
            return None, log
        child = "\n".join(lines) + "\n"
        if child.strip() == parent.strip():
            log.errors.append("mutation was a no-op")
            return None, log
        log.ok = True
        return child, log
