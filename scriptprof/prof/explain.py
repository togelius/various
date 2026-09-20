"""Saying in English what a generated game actually does.

An archive entry arrives as a wall of rewrite rules with names a mutation
operator invented. Even knowing PuzzleScript, working out what one of them
plays like means reading twenty rules and simulating them in your head.

So this reads the rules instead, and it reads them rather than guessing: every
sentence it produces is derived from the parsed structure in
``prof.grammar``. Where a rule does not match anything it recognises, it falls
back to a literal reading of the pattern, and where it cannot parse the rule at
all it says so. Nothing here is asserted that the source does not contain --
which matters more than usual, because these games have no author to ask and a
plausible-sounding wrong description is worse than none.

Two layers. A set of **idiom matchers** recognises the mechanics the mutation
templates plant (pushing, pulling, gravity, growth, a key and a lock) and names
them the way a designer would. Anything unmatched gets the **literal reader**,
which turns cells and modifiers into a sentence: "When a moving Crate is next
to a stationary Crate, the second one starts moving too."

    info = explain(source)
    info["goal"]        # what winning requires
    info["mechanics"]   # one line per rule
"""
from __future__ import annotations

import re
from typing import Any

from prof.grammar import Game, Pattern, Rule

# --------------------------------------------------------------------------
# naming things readably
# --------------------------------------------------------------------------

_CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")

# How each motion modifier reads as a phrase after the noun: "a crate moving
# sideways". `horizontal` and `vertical` belong here too -- leaving them out
# silently dropped the constraint and made two different rules describe
# identically.
MOTION = {
    ">": "moving forward", "<": "moving back", "^": "moving up", "v": "moving down",
    "up": "moving up", "down": "moving down",
    "left": "moving left", "right": "moving right",
    "moving": "moving", "horizontal": "moving sideways",
    "vertical": "moving up or down", "perpendicular": "moving crosswise",
    "parallel": "moving along", "orthogonal": "moving", "randomdir": "moving randomly",
    "stationary": "standing still",
}
DIRS = {"up": "up", "down": "down", "left": "left", "right": "right",
        "horizontal": "sideways", "vertical": "vertically"}
MOVING = set(MOTION) - {"stationary"}


def pretty(name: str) -> str:
    """``FullPlayer`` -> ``full player``; leave short or lowercase names alone."""
    if len(name) <= 2 or name.islower():
        return name
    return _CAMEL.sub(" ", name).lower()


def _objs(cell) -> list[str]:
    return [o for o in cell.objects()]


def _mods(cell) -> list[str]:
    return [t.lower() for t in cell.tokens if t.lower() not in
            {o.lower() for o in cell.objects()}]


def describe_cell(cell) -> str:
    """One rule cell as a noun phrase."""
    objs = _objs(cell)
    mods = _mods(cell)
    if not objs:
        return "an empty square"
    neg = []
    pos = []
    i = 0
    toks = cell.tokens
    while i < len(toks):
        t = toks[i]
        if t.lower() == "no" and i + 1 < len(toks):
            neg.append(pretty(toks[i + 1]))
            i += 2
            continue
        if t.lower() in {o.lower() for o in objs}:
            pos.append(pretty(t))
        i += 1
    motion = next((MOTION[m] for m in mods if m in MOTION), "")
    if not pos:
        base = "an empty square" if not neg else "a square"
    else:
        base = "a " + " and ".join(pos)
        if motion:
            base += " " + motion
    if neg:
        base += " with no " + " or ".join(neg)
    return base


def motion_of(cell) -> str:
    """The motion modifier on a cell, or "" if it says nothing about movement."""
    return next((m for m in _mods(cell) if m in MOTION), "")


def describe_pattern(p: Pattern) -> str:
    cells = [describe_cell(c) for c in p.cells]
    if len(cells) == 1:
        return cells[0]
    return cells[0] + "".join(f" next to {c}" for c in cells[1:])


# --------------------------------------------------------------------------
# idioms: the mechanics the templates plant, named the way a designer would
# --------------------------------------------------------------------------

def _cells(r: Rule, side: str, i: int = 0):
    pats = r.lhs if side == "l" else r.rhs
    return pats[i].cells if len(pats) > i else []


def _tok(cell, kinds: set[str]) -> bool:
    return any(t.lower() in kinds for t in cell.tokens)


def idiom(r: Rule) -> str | None:
    """Name the mechanic if it is one of the recognised shapes."""
    if not r.parsed or not r.lhs:
        return None
    lc, rc = _cells(r, "l"), _cells(r, "r")
    n = len(lc)
    one_pattern = len(r.lhs) == 1 and len(r.rhs) <= 1

    if "restart" in [c.lower() for c in r.commands]:
        if n == 1 and lc[0].objects():
            return f"Touching {_and(lc[0])} restarts the level."
        return "Some situations restart the level."
    if "cancel" in [c.lower() for c in r.commands]:
        if n == 2:
            return (f"{_cap(_and(lc[0]))} cannot move into {_and(lc[1])}; "
                    f"trying undoes the whole turn.")
        return "Some moves are refused outright."
    if "win" in [c.lower() for c in r.commands]:
        return f"Reaching {describe_pattern(r.lhs[0])} wins immediately."

    if one_pattern and n == 2 and len(rc) == 2:
        a, b = lc[0], lc[1]
        ra, rb = rc[0], rc[1]
        a_moves = _tok(a, MOVING)
        # push: the mover's force passes into the thing in front
        if a_moves and not _tok(b, MOVING) and _tok(rb, MOVING) and _same(a, ra):
            if _same(b, rb):
                return f"{_cap(_and(a))} moving into {_and(b)} pushes it along."
        # pull: the thing behind follows
        b_moves = _tok(b, MOVING)
        if b_moves and not a_moves and _tok(ra, MOVING) and _same(b, rb):
            return f"{_cap(_and(b))} moving drags {_and(a)} behind it."
        # destroy
        if a_moves and b.objects() and not rb.objects():
            return f"{_cap(_and(a))} moving into {_and(b)} destroys it."
        # swap places -- but only between different things; a rule whose two
        # cells hold the same object is changing its motion, not trading it
        if (a_moves and _same(a, rb) and _same(b, ra)
                and set(_low(a.objects())) != set(_low(b.objects()))):
            return f"{_cap(_and(a))} and {_and(b)} trade places."
        # convert
        if b.objects() and rb.objects() and not _same(b, rb) and _same(a, ra):
            return (f"Next to {_and(a)}, {_and(b)} turns into "
                    f"{_and(rb)}.")
        # gravity / sliding into free space
        if (a.objects() and not ra.objects() and _same(a, rb)
                and any(t.lower() == "no" for t in b.tokens)):
            d = next((p for p in r.prefixes if p.lower() in DIRS), None)
            where = f" {DIRS[d.lower()]}" if d else ""
            return f"{_cap(_and(a))} falls{where} into empty space."
        # growth
        if _same(a, ra) and _same(a, rb) and not b.objects():
            word = "spreads" if any(p.lower() == "random" for p in r.prefixes) else "grows"
            return f"{_cap(_and(a))} {word} into the space beside it."

    if one_pattern and n == 1 and len(rc) == 1:
        a, b = lc[0], rc[0]
        added = set(_low(b.objects())) - set(_low(a.objects()))
        gone = set(_low(a.objects())) - set(_low(b.objects()))
        if added and not gone:
            late = " at the end of each turn" if _late(r) else ""
            return (f"{_cap(_and(a))} leaves {' and '.join(pretty(x) for x in sorted(added))}"
                    f" behind{late}.")
        if gone and not added:
            return f"{' and '.join(pretty(x) for x in sorted(gone))} disappears."

    # action-key toggles, written as two patterns
    if len(r.lhs) >= 2 and any(_tok(c, {"action"}) for c in _cells(r, "l")):
        return "Pressing the action key changes things elsewhere on the board."
    return None


def _low(xs) -> list[str]:
    return [x.lower() for x in xs]


def _same(a, b) -> bool:
    return set(_low(a.objects())) == set(_low(b.objects()))


def _and(cell) -> str:
    objs = [pretty(o) for o in cell.objects()]
    return " and ".join(objs) if objs else "an empty square"


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:] if s else s


def _late(r: Rule) -> bool:
    return any(p.lower() == "late" for p in r.prefixes)


def motion_change(r: Rule) -> str | None:
    """A rule that leaves the objects alone and only changes their movement.

    Turn-management rules are mostly of this shape -- stopping a slide,
    redirecting a fall -- and reading them literally produces a sentence whose
    two halves look identical, because only the modifiers differ.
    """
    if len(r.lhs) != 1 or len(r.rhs) != 1:
        return None
    lc, rc = r.lhs[0].cells, r.rhs[0].cells
    if len(lc) != len(rc):
        return None
    parts = []
    for a, b in zip(lc, rc):
        if set(_low(a.objects())) != set(_low(b.objects())):
            return None
        ma, mb = motion_of(a), motion_of(b)
        if ma == mb or not a.objects():
            continue
        who = _and(a)
        if not mb:
            parts.append(f"{who} is let go of")     # the rule stops constraining it
        elif mb == "stationary":
            parts.append(f"{who} stops")
        elif ma == "stationary" or not ma:
            parts.append(f"{who} starts {MOTION[mb]}")
        else:
            parts.append(f"{who} is redirected, {MOTION[mb]}")
    if not parts:
        return None
    return _cap(_join(parts)) + "."


def describe_rule(r: Rule) -> str:
    """One sentence for one rule: an idiom if recognised, else a literal read."""
    if not r.parsed:
        return "(this rule uses syntax the reader does not parse)"
    named = idiom(r) or motion_change(r)
    if named:
        return _with_direction(r, named)
    if not r.lhs:
        return "(no pattern)"
    lhs = " and, elsewhere, ".join(describe_pattern(p) for p in r.lhs)
    if not r.rhs:
        cmds = ", ".join(r.commands) or "nothing"
        return f"When there is {lhs}: {cmds}."
    rhs = " and, elsewhere, ".join(describe_pattern(p) for p in r.rhs)
    when = "At the end of a turn, w" if _late(r) else "W"
    extra = " Then the turn runs again." if "again" in _low(r.commands) else ""
    return _with_direction(r, f"{when}here there is {lhs}, it becomes {rhs}.{extra}")


def _with_direction(r: Rule, sentence: str) -> str:
    """Prefix the rule's direction restriction, which changes what it means."""
    d = next((p.lower() for p in r.prefixes if p.lower() in DIRS), None)
    if not d:
        return sentence
    return f"Only when moving {DIRS[d]}: {sentence[:1].lower() + sentence[1:]}"


# --------------------------------------------------------------------------
# goals, quirks, and what a mutation changed
# --------------------------------------------------------------------------

QUANT = {"all": "every", "some": "at least one", "any": "at least one", "no": "no"}


def describe_win(w) -> str:
    if w.raw is not None:
        return w.raw
    q = QUANT.get(w.quant.lower(), w.quant.lower())
    a = pretty(w.a)
    if w.b:
        return f"{_cap(q)} {a} is on a {pretty(w.b)}"
    if q == "no":
        return f"no {a} is left"
    return f"{_cap(q)} {a} exists"


def quirks(g: Game) -> list[str]:
    """Things worth warning a player about before they start."""
    out = []
    rules = [r for r in g.rules if r.parsed]
    if any("again" in _low(r.commands) for r in rules):
        out.append("Some moves set off a chain that keeps running until it settles.")
    if any("restart" in _low(r.commands) for r in rules):
        out.append("Some mistakes restart the level rather than just blocking you.")
    if any(p.lower() == "random" for r in rules for p in r.prefixes):
        out.append("Part of this game is random, so the same move need not repeat.")
    if any(_tok(c, {"action"}) for r in rules for p in r.lhs for c in p.cells):
        out.append("The action key does something here; it is not only movement.")
    if len(g.playable_levels()) > 1:
        out.append(f"{len(g.playable_levels())} levels, easiest first.")
    return out


OP_ENGLISH = {
    "template": "a new mechanic was grafted on",
    "swap_object": "a rule was pointed at a different object",
    "add_object": "a new object was introduced",
    "remove_object": "an object was removed",
    "delete_rule": "a rule was deleted",
    "duplicate": "a rule was duplicated and varied",
    "widen": "a rule was made to look one square further",
    "negate": "a rule gained a condition about what must be absent",
    "late": "a rule was moved to the end of the turn",
    "unlate": "a rule was moved back into the main turn",
    "command": "a rule was given an extra effect",
    "flip_force": "a direction was reversed",
    "rule_direction": "a rule was restricted to one direction",
    "add_win": "a new win condition was added",
    "remove_win": "a win condition was dropped",
    "win_quant": "a win condition changed how much it demands",
    "win_swap": "a win condition swapped what sits on what",
    "win_retarget": "a win condition was pointed at different objects",
    "place": "more tiles were scattered into the levels",
    "retile": "a square was changed",
    "shift": "something was moved to a different square",
    "swap_tiles": "two squares traded contents",
    "grow_h": "a level was widened", "grow_v": "a level was made taller",
    "shrink_h": "a level was narrowed", "shrink_v": "a level was made shorter",
    "add_level": "a level was added", "remove_level": "a level was dropped",
    "keep_one_level": "all but one level was dropped",
    "xover_rule": "a rule was spliced in from a different game",
    "xover_level": "a level was taken from a different game",
    "seed": "the starting point, a human-written game",
}


def describe_op(op: str) -> str:
    head = op.split(":")[0]
    text = OP_ENGLISH.get(head)
    if text is None:
        return op
    arg = op.split(":", 1)[1] if ":" in op else ""
    if head == "template" and arg:
        return f"a {arg.replace('_', ' ')} mechanic was grafted on"
    if head in ("add_object", "swap_object", "remove_object") and arg:
        return f"{text} ({arg})"
    return text


def explain(source: str) -> dict[str, Any]:
    """Plain-English reading of a game, entirely from its own source."""
    try:
        g = Game.parse(source)
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"[:120]}
    rules = g.rules
    parsed = [r for r in rules if r.parsed]
    goals = [describe_win(w) for w in g.wins]
    if goals:
        goals = [x[:1].lower() + x[1:] for x in goals]
        goal = "You win when " + _join(goals) + "."
    else:
        goal = ("Nothing marks a win, so this one ends only by a rule that "
                "declares it.")
    mechanics = []
    seen: set[str] = set()
    for r in rules:
        line = describe_rule(r)
        if line in seen:
            continue
        seen.add(line)
        mechanics.append({"rule": r.emit(), "says": line,
                          "named": bool(r.parsed and idiom(r))})
    named = [m["says"] for m in mechanics if m["named"]]
    return {
        "goal": goal,
        "headline": _headline(goal, named),
        "mechanics": mechanics,
        "quirks": quirks(g),
        "counts": {"rules": len(rules), "understood": len(parsed),
                   "named": sum(1 for m in mechanics if m["named"]),
                   "objects": len(g.objects), "levels": len(g.playable_levels())},
    }


def _headline(goal: str, named: list[str]) -> str:
    """One or two sentences: the goal, then the mechanics worth knowing first.

    Only named mechanics go in. A literal reading is accurate but too long to
    lead with, and padding a summary with the rules the reader understood least
    would be exactly backwards.
    """
    if not named:
        return goal
    keep = named[:3]
    joined = " ".join(k if k.endswith(".") else k + "." for k in keep)
    return f"{goal} {joined}"


def _join(xs: list[str]) -> str:
    if len(xs) == 1:
        return xs[0]
    return ", ".join(xs[:-1]) + " and " + xs[-1]


def main() -> None:
    import argparse
    from pathlib import Path

    ap = argparse.ArgumentParser()
    ap.add_argument("game", help="path to a PuzzleScript file")
    a = ap.parse_args()
    info = explain(Path(a.game).read_text(encoding="utf-8", errors="replace"))
    if "error" in info:
        raise SystemExit(info["error"])
    print(info["goal"], "\n")
    for q in info["quirks"]:
        print(" -", q)
    print()
    for m in info["mechanics"]:
        mark = "*" if m["named"] else " "
        print(f" {mark} {m['says']}")
        print(f"     {m['rule'][:96]}")
    c = info["counts"]
    print(f"\n{c['named']} of {c['rules']} rules recognised as a named mechanic, "
          f"{c['understood']} parsed")


if __name__ == "__main__":
    main()
