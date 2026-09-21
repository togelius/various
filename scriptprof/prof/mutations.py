"""Mutation and crossover operators over ``prof.grammar.Game``.

Two kinds of operator live here, and the difference matters for what the
search can find.

**Perturbations** take something the game already does and vary it: swap an
object for a layer-compatible one, flip a direction, add a negation, widen a
pattern, resize a level.  These explore the neighbourhood of a design.  They
cannot invent, because every symbol they use is already in the game.

**Templates** inject a mechanic the game did not have.  Each one is a small
rule schema -- push, pull, gravity, growth, a key and a lock -- with named
roles, and applying it means binding those roles to real objects under
PuzzleScript's layer rules (two objects in the same rule cell must sit on
different collision layers).  This is where a new game comes from: a Sokoban
that grows vines, a maze whose walls fall.

Templates are allowed to fail.  A binding that the compiler rejects costs
about seventy milliseconds to discover, against tens of seconds for a model
call, so the operator set is tuned for reach rather than for a high hit rate.

    rng = random.Random(0)
    child, name = mutate(parent, rng)
"""
from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable

from prof.grammar import (ABS_DIRECTIONS, COLORS, MODIFIERS, Cell, Game, Legend,
                          Level, Obj, Pattern, Rule, Win)

# --------------------------------------------------------------------------
# reading roles out of a game
# --------------------------------------------------------------------------


@dataclass
class Roles:
    """Objects grouped by the part they play, for binding into templates."""
    player: list[str]
    background: list[str]
    solid: list[str]      # things that never appear with a force: walls
    movable: list[str]    # things some rule pushes
    floor: list[str]      # things sharing the background layer: targets, marks
    other: list[str]
    layer: dict[str, int]

    def any_of(self, rng: random.Random, *pools: list[str]) -> str | None:
        merged = [x for p in pools for x in p]
        return rng.choice(merged) if merged else None

    def distinct_layer(self, rng: random.Random, a: str, pool: list[str]) -> str | None:
        """Pick from ``pool`` something that can share a rule cell with ``a``."""
        la = self.layer.get(a.lower())
        cands = [x for x in pool if x.lower() != a.lower()
                 and self.layer.get(x.lower()) != la]
        return rng.choice(cands) if cands else None

    def same_layer(self, rng: random.Random, a: str, pool: list[str]) -> str | None:
        """Pick something interchangeable with ``a``: same layer, different object."""
        la = self.layer.get(a.lower())
        cands = [x for x in pool if x.lower() != a.lower()
                 and self.layer.get(x.lower()) == la]
        return rng.choice(cands) if cands else None


def roles_of(g: Game) -> Roles:
    layer = g.symbol_layer()
    names = [o.name for o in g.objects]
    lower_players = {p.lower() for p in g.player_symbols()}
    bg_layer = 0
    background = [n for n in names if layer.get(n.lower()) == bg_layer]
    forced: set[str] = set()
    for r in g.rules:
        if not r.parsed:
            continue
        for p in r.rhs:
            for c in p.cells:
                if any(t in (">", "<", "^", "v") or t.lower() in
                       ("moving", "up", "down", "left", "right") for t in c.tokens):
                    forced.update(o.lower() for o in c.objects())
    player = [n for n in names if n.lower() in lower_players]
    movable = [n for n in names if n.lower() in forced and n.lower() not in lower_players]
    floor = [n for n in background if n.lower() not in lower_players]
    solid = [n for n in names if n.lower() not in forced and n.lower() not in lower_players
             and layer.get(n.lower(), 0) != bg_layer]
    other = [n for n in names if n not in player + movable + floor + solid]
    if not player:
        # no object named like a player: fall back to whatever moves
        player = movable[:1] or names[:1]
    return Roles(player, background, solid, movable, floor, other, layer)


# --------------------------------------------------------------------------
# mechanic templates
# --------------------------------------------------------------------------

# Each template returns a list of rule source lines, or None if the game does
# not contain objects that can fill its roles.
Template = Callable[[Game, Roles, random.Random], list[str] | None]


def _t_push(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    p = r.any_of(rng, r.player)
    m = r.any_of(rng, r.solid, r.other, r.movable)
    if not p or not m or m.lower() == p.lower():
        return None
    return [f"[ > {p} | {m} ] -> [ > {p} | > {m} ]"]


def _t_pull(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    p = r.any_of(rng, r.player)
    m = r.any_of(rng, r.movable, r.solid, r.other)
    if not p or not m or m.lower() == p.lower():
        return None
    return [f"[ {m} | > {p} ] -> [ > {m} | > {p} ]"]


def _t_destroy(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    p = r.any_of(rng, r.player, r.movable)
    x = r.any_of(rng, r.solid, r.other, r.movable)
    if not p or not x or x.lower() == p.lower():
        return None
    return [f"[ > {p} | {x} ] -> [ > {p} | ]"]


def _t_swap(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    p = r.any_of(rng, r.player)
    x = r.any_of(rng, r.movable, r.solid, r.other)
    if not p or not x or x.lower() == p.lower():
        return None
    return [f"[ > {p} | {x} ] -> [ {x} | {p} ]"]


def _t_trail(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """Standing somewhere marks it: the mechanic behind Zen Puzzle Garden."""
    p = r.any_of(rng, r.player, r.movable)
    if not p:
        return None
    t = r.distinct_layer(rng, p, r.floor + r.other)
    if not t:
        return None
    return [f"late [ {p} no {t} ] -> [ {p} {t} ]"]


def _t_convert(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """Touching A turns B into C, where C can stand exactly where B did."""
    a = r.any_of(rng, r.player, r.movable)
    b = r.any_of(rng, r.solid, r.other, r.movable)
    if not a or not b or a.lower() == b.lower():
        return None
    c = r.same_layer(rng, b, r.solid + r.other + r.movable)
    if not c:
        return None
    return [f"[ {a} | {b} ] -> [ {a} | {c} ]"]


def _t_gravity(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    m = r.any_of(rng, r.movable, r.other)
    if not m:
        return None
    s = r.any_of(rng, r.solid) or m
    d = rng.choice(["down", "up", "left", "right"])
    return [f"{d} [ {m} | no {m} no {s} ] -> [ | {m} ]"]


def _t_spread(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """Something grows into free space: vines, fire, water."""
    a = r.any_of(rng, r.other, r.solid, r.movable)
    if not a:
        return None
    s = r.any_of(rng, r.solid, r.player) or a
    return [f"random [ {a} | no {a} no {s} ] -> [ {a} | {a} ]"]


def _t_chain(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """A pushed thing pushes its own kind: a train of crates."""
    m = r.any_of(rng, r.movable, r.solid, r.other)
    if not m:
        return None
    return [f"[ > {m} | {m} ] -> [ > {m} | > {m} ]"]


def _t_crush(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    m = r.any_of(rng, r.movable)
    x = r.any_of(rng, r.other, r.solid)
    if not m or not x or m.lower() == x.lower():
        return None
    return [f"[ > {m} | {x} ] -> [ > {m} | ]"]


def _t_action_toggle(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """The action key flips every X in the level into a Y and back."""
    p = r.any_of(rng, r.player)
    x = r.any_of(rng, r.solid, r.other, r.movable)
    if not p or not x:
        return None
    y = r.same_layer(rng, x, r.solid + r.other + r.movable)
    if not y:
        return None
    return [f"[ action {p} ] [ {x} ] -> [ {p} ] [ {y} ]",
            f"[ action {p} ] [ {y} ] -> [ {p} ] [ {x} ]"]


def _t_key_lock(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """Collect every key and the locks open: a two-rule mechanic."""
    p = r.any_of(rng, r.player)
    k = r.any_of(rng, r.other, r.floor)
    if not p or not k:
        return None
    lock = r.any_of(rng, r.solid)
    if not lock or lock.lower() == k.lower():
        return None
    return [f"[ > {p} | {k} ] -> [ > {p} | ]",
            f"late [ no {k} ] [ {lock} ] -> [ ] [ ]"]


def _t_magnet(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """Everything of one kind steps toward the player each turn."""
    p = r.any_of(rng, r.player)
    m = r.any_of(rng, r.movable, r.other, r.solid)
    if not p or not m or p.lower() == m.lower():
        return None
    return [f"late [ {m} | ... | {p} ] -> [ > {m} | ... | {p} ]"]


def _t_clone(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    a = r.any_of(rng, r.movable, r.other)
    if not a:
        return None
    s = r.any_of(rng, r.solid, r.player) or a
    return [f"[ > {a} | no {a} no {s} ] -> [ {a} | {a} ]"]


def _t_block_cancel(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """Walking into X undoes the whole turn: a hard constraint."""
    p = r.any_of(rng, r.player)
    x = r.any_of(rng, r.solid, r.other)
    if not p or not x or p.lower() == x.lower():
        return None
    return [f"[ > {p} | {x} ] -> cancel"]


def _t_restart_trap(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    p = r.any_of(rng, r.player)
    x = r.distinct_layer(rng, p, r.floor + r.other) if p else None
    if not p or not x:
        return None
    return [f"late [ {p} {x} ] -> restart"]


def _t_directional_wall(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """A one-way gate: you may cross it going one direction only."""
    p = r.any_of(rng, r.player)
    if not p:
        return None
    d = rng.choice(ABS_DIRECTIONS)
    x = r.distinct_layer(rng, p, r.floor + r.other)
    if not x:
        return None
    return [f"{d} [ > {p} | {x} ] -> cancel"]


def _t_pair_annihilate(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    a = r.any_of(rng, r.movable, r.other)
    if not a:
        return None
    b = r.same_layer(rng, a, r.movable + r.other + r.solid)
    if not b:
        return None
    return [f"late [ {a} | {b} ] -> [ | ]"]


def _t_reverse_existing(g: Game, r: Roles, rng: random.Random) -> list[str] | None:
    """Run one of the game's own rules backwards: alien semantics.

    PuzzleJAX's ethics appendix asks for an out-of-distribution track built by
    inverting familiar mechanics.  This is that, done to a rule the game
    already has, so the result stays inside the game's own vocabulary.
    """
    cands = [r_ for r_ in g.rules if r_.parsed and r_.rhs and r_.lhs
             and len(r_.lhs) == len(r_.rhs) and not r_.commands]
    if not cands:
        return None
    src = rng.choice(cands)
    flipped = Rule(list(src.prefixes), [p.copy() for p in src.rhs],
                   [p.copy() for p in src.lhs], [])
    return [flipped.emit()]


TEMPLATES: dict[str, Template] = {
    "push": _t_push,
    "pull": _t_pull,
    "destroy": _t_destroy,
    "swap": _t_swap,
    "trail": _t_trail,
    "convert": _t_convert,
    "gravity": _t_gravity,
    "spread": _t_spread,
    "chain": _t_chain,
    "crush": _t_crush,
    "action_toggle": _t_action_toggle,
    "key_lock": _t_key_lock,
    "magnet": _t_magnet,
    "clone": _t_clone,
    "block_cancel": _t_block_cancel,
    "restart_trap": _t_restart_trap,
    "directional_wall": _t_directional_wall,
    "pair_annihilate": _t_pair_annihilate,
    "reverse_existing": _t_reverse_existing,
}


# --------------------------------------------------------------------------
# operators
# --------------------------------------------------------------------------

def op_add_template_rule(g: Game, rng: random.Random) -> str | None:
    from prof.grammar import _parse_rule_line

    r = roles_of(g)
    name = rng.choice(list(TEMPLATES))
    lines = TEMPLATES[name](g, r, rng)
    if not lines:
        return None
    rules = [_parse_rule_line(l) for l in lines]
    at = rng.randrange(len(g.rules) + 1)
    g.rules[at:at] = rules
    g.touch("RULES")
    return f"template:{name}"


def _positive_objects(cell: Cell) -> list[str]:
    """Objects a cell actually contains. ``no X`` names something absent."""
    out: list[str] = []
    neg = False
    for tok in cell.tokens:
        low = tok.lower()
        if low == "no":
            neg = True
            continue
        if low in MODIFIERS:
            neg = False
            continue
        if not neg:
            out.append(tok)
        neg = False
    return out


def _is_gap(cell: Cell) -> bool:
    return "..." in cell.tokens and not _positive_objects(cell)


def _axis(prefixes: list[str]) -> tuple[int, int]:
    """How a rule's left-to-right pattern sits on the board.

    An unprefixed rule is tried in every direction, so laying it out facing
    right is enough for one of those tries to see it. A direction prefix is
    the rightward pattern rotated to face that way: ``down`` reads top to
    bottom, which is how gravity is written.
    """
    p = {x.lower() for x in prefixes}
    if "up" in p:
        return (-1, 0)
    if "down" in p or "vertical" in p:
        return (1, 0)
    if "left" in p:
        return (0, -1)
    return (0, 1)


def _char_for(g: Game, names: list[str]) -> str | None:
    """A single level character for exactly these objects, or the floor."""
    if not names:
        return g.background_char() or None
    want = sorted(n.lower() for n in names)
    if len(want) == 1:
        for obj in g.objects:
            if obj.name.lower() != want[0]:
                continue
            if len(obj.name) == 1:
                return obj.name
            if obj.synonym and len(obj.synonym) == 1:
                return obj.synonym
    for leg in g.legend:
        if len(leg.sym) != 1 or leg.join.lower() == "or":
            continue
        members = sorted(m.lower() for m in leg.members)
        if members != want:
            continue
        if len(want) == 1 or leg.join.lower() == "and":
            return leg.sym
    return None


def _occupied(placed: dict[tuple[int, int], list[str]], name: str) -> bool:
    low = name.lower()
    return any(low in {o.lower() for o in objs} for objs in placed.values())


def _add_cell(g: Game, placed: dict[tuple[int, int], list[str]],
              names: list[str]) -> bool:
    """Park ``names`` on a fresh cell. Fails when no character can spell them."""
    if _char_for(g, names) is None:
        return False
    spot = (max(r for r, _ in placed) + 2, 1)
    while spot in placed:
        spot = (spot[0] + 1, spot[1])
    placed[spot] = list(names)
    return True


def _not_already_won(g: Game, placed: dict[tuple[int, int], list[str]]) -> bool:
    """Make the level fail every win condition, or give up.

    PuzzleScript treats ``All`` and ``No`` as true when nothing matches, so a
    level that simply doesn't contain the target object is already won. A
    staged level that starts won is the degenerate case the fitness function
    throws out, and it teaches the search nothing about the new rule.
    """
    def sets() -> list[set[str]]:
        return [{o.lower() for o in objs} for objs in placed.values()]

    for w in g.wins:
        if w.raw is not None:
            continue
        a = w.a.lower()
        b = w.b.lower() if w.b else None
        quant = w.quant.lower()
        cells = sets()

        def has(pred) -> bool:
            return any(pred(s) for s in cells)

        if quant == "no":
            if b is None:
                if not has(lambda s: a in s) and not _add_cell(g, placed, [w.a]):
                    return False
            elif not has(lambda s: a in s and b in s):
                if not _add_cell(g, placed, [w.a, w.b]):
                    return False
        elif quant in ("some", "any"):
            met = has(lambda s: a in s and (b is None or b in s))
            if met:
                return False
        elif quant == "all":
            if b is None:
                return False
            if not has(lambda s: a in s and b not in s):
                if not _add_cell(g, placed, [w.a]):
                    return False
    return True


def stage_for(g: Game, rules: list[Rule]) -> Level | None:
    """A small level on which ``rules`` can match, and which is not already won.

    The pattern is laid out in the rule's own direction, one bracket-group per
    band so two groups don't land on the same cell. ``no X`` is an empty cell.
    An ellipsis is one cell of floor between its neighbours.
    """
    if not g.background_char():
        return None
    placed: dict[tuple[int, int], list[str]] = {}
    band = 0
    for rule in rules:
        if not rule.parsed or not rule.lhs:
            continue
        dr, dc = _axis(rule.prefixes)
        pr, pc = (dc, dr) if (dr, dc) != (0, 0) else (1, 0)
        for pattern in rule.lhs:
            r, c = pr * band * 3, pc * band * 3
            band += 1
            for cell in pattern.cells:
                if _is_gap(cell):
                    placed.setdefault((r, c), [])
                    r += dr
                    c += dc
                    continue
                objs = _positive_objects(cell)
                key = (r, c)
                if key in placed and objs and placed[key] != objs:
                    return None
                if objs:
                    placed[key] = objs
                else:
                    placed.setdefault(key, [])
                r += dr
                c += dc
    if not any(objs for objs in placed.values()):
        return None
    min_r = min(r for r, _ in placed)
    min_c = min(c for _, c in placed)
    placed = {(r - min_r + 1, c - min_c + 1): v for (r, c), v in placed.items()}
    players = roles_of(g).player
    if players and not any(_occupied(placed, p) for p in players):
        if not _add_cell(g, placed, [players[0]]):
            return None
    if not _not_already_won(g, placed):
        return None
    height = max(r for r, _ in placed) + 2
    width = max(c for _, c in placed) + 2
    rows = []
    for r in range(height):
        chars = []
        for c in range(width):
            ch = _char_for(g, placed.get((r, c), []))
            if ch is None:
                return None
            chars.append(ch)
        rows.append("".join(chars))
    return Level(rows)


def op_stage_template(g: Game, rng: random.Random) -> str | None:
    """Add a mechanic and a level that contains what the mechanic needs.

    A template dropped onto an inherited level often never fires: the new rule
    is real and the board has nothing for it to match. This operator only
    keeps the rule when it can also write a level where the pattern occurs
    and the level is not already won. The game is left untouched until both
    exist, so a failed attempt does not leak a rule into the next try.
    """
    from prof.grammar import _parse_rule_line

    roles = roles_of(g)
    names = list(TEMPLATES)
    rng.shuffle(names)
    for name in names:
        lines = TEMPLATES[name](g, roles, rng)
        if not lines:
            continue
        rules = [_parse_rule_line(ln) for ln in lines]
        if any(not ru.parsed for ru in rules):
            continue
        level = stage_for(g, rules)
        if level is None:
            continue
        g.rules.extend(rules)
        g.levels.append(level)
        g.touch("RULES", "LEVELS")
        return f"stage:{name}"
    return None


def op_swap_rule_object(g: Game, rng: random.Random) -> str | None:
    """Retarget a rule at a different object on the same collision layer."""
    cands = [r for r in g.rules if r.parsed and r.objects()]
    if not cands:
        return None
    rule = rng.choice(cands)
    old = rng.choice(sorted(rule.objects()))
    r = roles_of(g)
    pool = [o.name for o in g.objects]
    new = r.same_layer(rng, old, pool) or r.any_of(rng, pool)
    if not new or new.lower() == old.lower():
        return None
    for p in rule.lhs + rule.rhs:
        for c in p.cells:
            c.replace_object(old, new)
    g.touch("RULES")
    return f"swap_object:{old}->{new}"


def op_change_direction(g: Game, rng: random.Random) -> str | None:
    cands = [r for r in g.rules if r.parsed]
    if not cands:
        return None
    rule = rng.choice(cands)
    slots = [(p, c, i) for p in rule.lhs + rule.rhs for c in p.cells
             for i, t in enumerate(c.tokens) if t in (">", "<", "^", "v")]
    if slots:
        _, cell, i = rng.choice(slots)
        cell.tokens[i] = rng.choice([d for d in (">", "<", "^", "v") if d != cell.tokens[i]])
        g.touch("RULES")
        return "flip_force"
    # no relative force to flip: change the rule's own direction prefix instead
    dirs = [p for p in rule.prefixes if p.lower() in ABS_DIRECTIONS]
    if dirs:
        rule.prefixes[rule.prefixes.index(dirs[0])] = rng.choice(
            [d for d in ABS_DIRECTIONS if d != dirs[0].lower()])
    else:
        rule.prefixes.insert(0, rng.choice(ABS_DIRECTIONS))
    g.touch("RULES")
    return "rule_direction"


def op_toggle_late(g: Game, rng: random.Random) -> str | None:
    cands = [r for r in g.rules if r.parsed]
    if not cands:
        return None
    rule = rng.choice(cands)
    has = [p for p in rule.prefixes if p.lower() == "late"]
    if has:
        rule.prefixes.remove(has[0])
        out = "unlate"
    else:
        rule.prefixes.insert(0, "late")
        out = "late"
    g.touch("RULES")
    return out


def op_add_negation(g: Game, rng: random.Random) -> str | None:
    """Add a ``no X`` guard to a rule cell: the rule now needs a clear square."""
    cands = [r for r in g.rules if r.parsed and r.lhs]
    if not cands:
        return None
    rule = rng.choice(cands)
    pat = rng.choice(rule.lhs)
    cell = rng.choice(pat.cells)
    if "..." in cell.tokens:
        return None      # "You can't have anything in with an ellipsis."
    present = {o.lower() for o in cell.objects()}
    r = roles_of(g)
    pool = [o.name for o in g.objects if o.name.lower() not in present]
    if not pool:
        return None
    x = rng.choice(pool)
    if present:
        anchor = sorted(present)[0]
        if r.layer.get(x.lower()) == r.layer.get(anchor):
            return None  # same layer: `no X` next to X is a contradiction
    cell.tokens += ["no", x]
    g.touch("RULES")
    return f"negate:{x}"


def op_duplicate_rule(g: Game, rng: random.Random) -> str | None:
    cands = [r for r in g.rules if r.parsed]
    if not cands:
        return None
    rule = rng.choice(cands)
    dup = rule.copy()
    g.rules.insert(g.rules.index(rule) + 1, dup)
    g.touch("RULES")
    out = op_swap_rule_object(g, rng)
    return f"duplicate+{out}" if out else "duplicate"


def op_delete_rule(g: Game, rng: random.Random) -> str | None:
    if len(g.rules) <= 1:
        return None
    g.rules.pop(rng.randrange(len(g.rules)))
    g.touch("RULES")
    return "delete_rule"


def op_add_command(g: Game, rng: random.Random) -> str | None:
    cands = [r for r in g.rules if r.parsed and not r.commands and r.rhs]
    if not cands:
        return None
    rule = rng.choice(cands)
    rule.commands.append(rng.choice(["again", "win", "cancel", "restart"]))
    g.touch("RULES")
    return f"command:{rule.commands[-1]}"


def op_widen_rule(g: Game, rng: random.Random) -> str | None:
    """Make a rule look one cell further along its direction."""
    cands = [r for r in g.rules if r.parsed and r.lhs and r.rhs
             and len(r.lhs) == len(r.rhs) == 1]
    if not cands:
        return None
    rule = rng.choice(cands)
    r = roles_of(g)
    pool = [o.name for o in g.objects]
    x = r.any_of(rng, pool)
    if not x:
        return None
    if rng.random() < 0.5:
        rule.lhs[0].cells.append(Cell([x]))
        rule.rhs[0].cells.append(Cell([x]))
    else:
        rule.lhs[0].cells.insert(0, Cell([x]))
        rule.rhs[0].cells.insert(0, Cell([x]))
    g.touch("RULES")
    return f"widen:{x}"


# -- objects ---------------------------------------------------------------

SPRITES = [
    ["00000", "00000", "00000", "00000", "00000"],
    [".000.", "00000", "00000", "00000", ".000."],
    ["0...0", ".0.0.", "..0..", ".0.0.", "0...0"],
    ["..0..", ".000.", "00000", ".000.", "..0.."],
    ["0.0.0", ".0.0.", "0.0.0", ".0.0.", "0.0.0"],
    ["00000", "0...0", "0...0", "0...0", "00000"],
    [".....", ".000.", ".010.", ".000.", "....."],
    ["11111", "10001", "10201", "10001", "11111"],
]
FREE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@$%^&*+-/?<>~`'\";:,"


def _free_char(g: Game) -> str | None:
    used = g.level_alphabet() | {l.sym for l in g.legend}
    for ch in FREE_CHARS:
        if ch not in used:
            return ch
    return None


def _free_name(g: Game, stem: str) -> str:
    used = {o.name.lower() for o in g.objects}
    if stem.lower() not in used:
        return stem
    i = 2
    while f"{stem}{i}".lower() in used:
        i += 1
    return f"{stem}{i}"


NEW_NAMES = ["Vine", "Spark", "Glass", "Rust", "Echo", "Seed", "Mirror", "Anchor",
             "Bell", "Thorn", "Cinder", "Drift", "Knot", "Lens", "Moss", "Prism",
             "Quill", "Relay", "Shard", "Tide", "Vent", "Wisp", "Husk", "Gate"]


def op_add_object(g: Game, rng: random.Random) -> str | None:
    """Introduce a new object, give it a layer, a character and a rule."""
    ch = _free_char(g)
    if ch is None:
        return None
    name = _free_name(g, rng.choice(NEW_NAMES))
    n_colors = rng.randint(1, 3)
    colors = rng.sample(COLORS[:-1], n_colors)
    sprite = list(rng.choice(SPRITES))
    if n_colors == 1:
        sprite = [row.replace("1", "0").replace("2", "0") for row in sprite]
    elif n_colors == 2:
        sprite = [row.replace("2", "1") for row in sprite]
    g.objects.append(Obj(name, None, colors, sprite))
    g.legend.append(Legend(ch, [name], ""))
    # a fresh layer keeps the new object from colliding with anything
    if rng.random() < 0.6 and len(g.layers) > 1:
        g.layers[rng.randrange(1, len(g.layers))].append(name)
    else:
        g.layers.append([name])
    g.touch("OBJECTS", "LEGEND", "COLLISIONLAYERS")
    # sprinkle it into the levels, else it can never appear
    placed = op_place_char(g, rng, ch)
    made = op_add_template_rule(g, rng)
    return f"add_object:{name}" + (f"+{made}" if made else "") + ("" if placed else "+unplaced")


def op_remove_object(g: Game, rng: random.Random) -> str | None:
    if len(g.objects) <= 3:
        return None
    r = roles_of(g)
    protected = {p.lower() for p in r.player} | {b.lower() for b in r.background}
    cands = [o for o in g.objects if o.name.lower() not in protected]
    if not cands:
        return None
    victim = rng.choice(cands)
    g.objects = [o for o in g.objects if o is not victim]
    low = victim.name.lower()
    g.rules = [ru for ru in g.rules
               if ru.raw is not None or low not in ru.objects()]
    g.wins = [w for w in g.wins if w.raw is not None or
              (w.a.lower() != low and (w.b or "").lower() != low)]
    g.touch("OBJECTS", "LEGEND", "COLLISIONLAYERS", "RULES", "WINCONDITIONS", "LEVELS")
    return f"remove_object:{victim.name}"


# -- win conditions --------------------------------------------------------

def op_change_win(g: Game, rng: random.Random) -> str | None:
    cands = [w for w in g.wins if w.raw is None]
    if not cands:
        return None
    w = rng.choice(cands)
    what = rng.random()
    if what < 0.4:
        w.quant = rng.choice([q for q in ("All", "Some", "No") if q.lower() != w.quant.lower()])
        out = f"win_quant:{w.quant}"
    elif what < 0.7 and w.b:
        w.a, w.b = w.b, w.a
        out = "win_swap"
    else:
        pool = [o.name for o in g.objects]
        tgt = rng.choice(pool)
        w.b = tgt if w.b else None
        w.a = rng.choice(pool)
        out = "win_retarget"
    g.touch("WINCONDITIONS")
    return out


def op_add_win(g: Game, rng: random.Random) -> str | None:
    """Add a win condition that is not trivially already true.

    The background fills every cell, so a condition naming it is a no-op that
    still moves the concept vector -- free novelty for no design. Excluded
    here as well as in ``repair`` so the operator does not waste its turn.
    """
    r = roles_of(g)
    bg = g._background_objects()
    pool = [x for x in r.movable + r.other + r.solid if x.lower() not in bg]
    a = r.any_of(rng, pool)
    if not a:
        return None
    targets = [x for x in r.floor if x.lower() not in bg]
    if rng.random() < 0.6 and targets:
        b = r.distinct_layer(rng, a, targets)
        if not b:
            return None
        candidate = Win("All", a, b)
    else:
        candidate = Win(rng.choice(["No", "Some"]), a, None)
    existing = {w.emit().strip().lower() for w in g.wins}
    if candidate.emit().strip().lower() in existing:
        return None
    g.wins.append(candidate)
    g.touch("WINCONDITIONS")
    return f"add_win:{candidate.emit()}"


def op_remove_win(g: Game, rng: random.Random) -> str | None:
    if len(g.wins) <= 1:
        return None
    g.wins.pop(rng.randrange(len(g.wins)))
    g.touch("WINCONDITIONS")
    return "remove_win"


# -- levels ----------------------------------------------------------------

def _playable(g: Game) -> list[Level]:
    return [l for l in g.levels if not l.is_message and l.rows]


def op_place_char(g: Game, rng: random.Random, ch: str | None = None) -> str | None:
    """Drop a few copies of a character onto a background square in each level."""
    levels = _playable(g)
    if not levels:
        return None
    if ch is None:
        alphabet = sorted(g.level_alphabet())
        if not alphabet:
            return None
        ch = rng.choice(alphabet)
    bg = g.background_char()
    n = 0
    for lv in levels:
        spots = [(y, x) for y, row in enumerate(lv.rows)
                 for x, c in enumerate(row) if c == bg]
        if not spots:
            continue
        for y, x in rng.sample(spots, min(len(spots), rng.randint(1, 3))):
            lv.rows[y] = lv.rows[y][:x] + ch + lv.rows[y][x + 1:]
            n += 1
    if not n:
        return None
    g.touch("LEVELS")
    return f"place:{ch}x{n}"


def op_perturb_level(g: Game, rng: random.Random) -> str | None:
    levels = _playable(g)
    if not levels:
        return None
    lv = rng.choice(levels)
    alphabet = sorted(g.level_alphabet())
    if len(alphabet) < 2:
        return None
    what = rng.random()
    if what < 0.4:  # retint one square
        y = rng.randrange(len(lv.rows))
        x = rng.randrange(len(lv.rows[y]))
        lv.rows[y] = lv.rows[y][:x] + rng.choice(alphabet) + lv.rows[y][x + 1:]
        out = "retile"
    elif what < 0.7:  # move one square's contents somewhere else
        bg = g.background_char()
        occupied = [(y, x) for y, row in enumerate(lv.rows)
                    for x, c in enumerate(row) if c != bg]
        free = [(y, x) for y, row in enumerate(lv.rows)
                for x, c in enumerate(row) if c == bg]
        if not occupied or not free:
            return None
        (sy, sx), (dy, dx) = rng.choice(occupied), rng.choice(free)
        ch = lv.rows[sy][sx]
        lv.rows[sy] = lv.rows[sy][:sx] + bg + lv.rows[sy][sx + 1:]
        lv.rows[dy] = lv.rows[dy][:dx] + ch + lv.rows[dy][dx + 1:]
        out = "shift"
    else:  # swap two squares
        y1, y2 = rng.randrange(len(lv.rows)), rng.randrange(len(lv.rows))
        x1 = rng.randrange(len(lv.rows[y1]))
        x2 = rng.randrange(len(lv.rows[y2]))
        a, b = lv.rows[y1][x1], lv.rows[y2][x2]
        lv.rows[y1] = lv.rows[y1][:x1] + b + lv.rows[y1][x1 + 1:]
        lv.rows[y2] = lv.rows[y2][:x2] + a + lv.rows[y2][x2 + 1:]
        out = "swap_tiles"
    g.touch("LEVELS")
    return out


def op_resize_level(g: Game, rng: random.Random) -> str | None:
    levels = _playable(g)
    if not levels:
        return None
    lv = rng.choice(levels)
    bg = g.background_char()
    grow = rng.random() < 0.5
    axis = rng.random() < 0.5
    if grow:
        if axis:
            lv.rows.append(bg * lv.width)
        else:
            lv.rows = [r + bg for r in lv.rows]
    else:
        if axis and len(lv.rows) > 3:
            lv.rows.pop()
        elif not axis and lv.width > 3:
            lv.rows = [r[:-1] for r in lv.rows]
        else:
            return None
    g.touch("LEVELS")
    return ("grow" if grow else "shrink") + ("_v" if axis else "_h")


def op_add_level(g: Game, rng: random.Random) -> str | None:
    levels = _playable(g)
    if not levels or len(_playable(g)) > 12:
        return None
    src = rng.choice(levels)
    new = src.copy()
    g.levels.append(new)
    g.touch("LEVELS")
    for _ in range(rng.randint(2, 6)):
        levels_before = g.levels
        g.levels = [new]
        op_perturb_level(g, rng)
        g.levels = levels_before
    return "add_level"


def op_remove_level(g: Game, rng: random.Random) -> str | None:
    levels = _playable(g)
    if len(levels) <= 1:
        return None
    g.levels.remove(rng.choice(levels))
    g.touch("LEVELS")
    return "remove_level"


def op_keep_one_level(g: Game, rng: random.Random) -> str | None:
    """Throw away every level but one: cheap way to make evaluation fast."""
    levels = _playable(g)
    if len(levels) <= 1:
        return None
    g.levels = [rng.choice(levels)]
    g.touch("LEVELS")
    return "keep_one_level"


# --------------------------------------------------------------------------
# dispatch
# --------------------------------------------------------------------------

# Weights from the novelty run (NOTES.md, 10047 applications). The quality
# reading is mean fitness of children that took a cell, not the cell-take
# rate: three of four archive axes measure size, so an edit that changes a
# count fills cells cheaply. negate 0.40 and add_win 0.41 were the clear
# wins; remove_object 0.23 was the clear loss. Templates stay in the set for
# reach. stage is the path that brings a new mechanic in with a level it can
# actually meet.
OPERATORS: list[tuple[Callable[[Game, random.Random], str | None], float]] = [
    (op_stage_template, 4.0),
    (op_add_template_rule, 2.0),
    (op_swap_rule_object, 2.0),
    (op_change_direction, 2.0),
    (op_toggle_late, 1.0),
    (op_add_negation, 3.0),
    (op_duplicate_rule, 1.5),
    (op_delete_rule, 1.0),
    (op_add_command, 1.5),
    (op_widen_rule, 1.5),
    (op_add_object, 1.5),
    (op_remove_object, 0.4),
    (op_change_win, 2.0),
    (op_add_win, 3.0),
    (op_remove_win, 0.7),
    (op_place_char, 2.0),
    (op_perturb_level, 3.0),
    (op_resize_level, 1.5),
    (op_add_level, 1.0),
    (op_remove_level, 0.7),
]


def mutate(parent: Game, rng: random.Random, n_ops: int = 1,
           tries: int = 8) -> tuple[Game, list[str]]:
    """Apply ``n_ops`` operators to a copy of ``parent``.

    Operators return ``None`` when the game has nothing for them to act on, so
    each one gets a few attempts before the mutation gives up and returns the
    edits it did manage.
    """
    g = parent.copy()
    applied: list[str] = []
    fns, weights = zip(*OPERATORS)
    for _ in range(n_ops):
        for _ in range(tries):
            fn = rng.choices(fns, weights=weights)[0]
            try:
                out = fn(g, rng)
            except Exception:  # noqa: BLE001 -- a bad binding is not a crash
                out = None
            if out:
                applied.append(out)
                break
    g.repair()
    g.lineage = list(parent.lineage) + applied
    return g, applied


def crossover(a: Game, b: Game, rng: random.Random) -> tuple[Game, list[str]]:
    """Splice a rule group or a level from ``b`` into ``a``.

    GAVEL's crossover needs the model to reconcile the two parents' vocabularies.
    Here the reconciliation is mechanical: an object the donated rule mentions
    and the host does not have is carried across with its sprite, its layer and
    a legend character, and anything still unresolved is dropped by ``repair``.
    """
    child = a.copy()
    notes: list[str] = []
    donors = [r for r in b.rules if r.parsed]
    if donors and rng.random() < 0.8:
        rule = rng.choice(donors).copy()
        needed = rule.objects() - set(child.all_symbols())
        b_objs = {o.name.lower(): o for o in b.objects}
        b_layer = b.symbol_layer()
        carried = []
        for want in sorted(needed):
            src = b_objs.get(want)
            if src is None:
                continue
            obj = src.copy()
            obj.name = _free_name(child, obj.name)
            ch = _free_char(child)
            child.objects.append(obj)
            if ch:
                child.legend.append(Legend(ch, [obj.name], ""))
            depth = b_layer.get(want, len(child.layers))
            if 0 < depth < len(child.layers):
                child.layers[depth].append(obj.name)
            else:
                child.layers.append([obj.name])
            carried.append(obj.name)
        if rule.objects() <= set(child.all_symbols()) | {c.lower() for c in carried}:
            child.rules.insert(rng.randrange(len(child.rules) + 1), rule)
            child.touch("RULES", "OBJECTS", "LEGEND", "COLLISIONLAYERS")
            notes.append(f"xover_rule:{len(carried)}obj")
    donor_levels = [l for l in b.levels if not l.is_message and l.rows]
    if donor_levels and rng.random() < 0.3:
        # a donated level only makes sense if its characters mean something here
        lv = rng.choice(donor_levels)
        alphabet = child.level_alphabet()
        if set("".join(lv.rows)) <= alphabet:
            child.levels.append(lv.copy())
            child.touch("LEVELS")
            notes.append("xover_level")
    child.repair()
    child.lineage = list(a.lineage) + notes
    return child, notes
