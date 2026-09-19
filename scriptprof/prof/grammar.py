"""PuzzleScript as a mutable structure, not a string.

GAVEL's mutation operator is a language model editing source text, and its
reported failure mode is that most edits are either duplicates of the training
data or dead on arrival.  ScriptDoctor's is the same operator with a compiler
in the loop, which turns invalid edits into retries and makes a single mutation
cost tens of seconds.  Either way the search spends its budget re-deriving
syntax rather than exploring design space.

This module takes the other road.  A game is parsed into sections, objects,
legend entries, collision layers, rules, win conditions and levels; mutations
act on that structure; and :meth:`Game.emit` writes it back out.  Because the
operators only ever produce structurally consistent games -- every object named
in a rule is declared and assigned a layer, every character in a level is in
the legend, every level is rectangular -- the compiler is a check rather than
a filter, and a mutation costs microseconds instead of a model call.

The parser is deliberately forgiving.  Anything it does not understand in a
prelude line, a sprite or a sound is carried through verbatim, so round-tripping
a game it only half-understands still yields a compiling game.  ``tests`` checks
that round-tripping the human corpus preserves compilation.

    g = Game.parse(text)
    child = mutate(g, rng)          # a new Game, structurally valid
    child.emit()                    # back to PuzzleScript source
"""
from __future__ import annotations

import random
import re
from dataclasses import dataclass, field, replace
from typing import Any, Iterable

SECTIONS = ["OBJECTS", "LEGEND", "SOUNDS", "COLLISIONLAYERS", "RULES",
            "WINCONDITIONS", "LEVELS"]

# Cell modifiers that may precede an object name inside a rule pattern.
MODIFIERS = {
    ">", "<", "^", "v", "up", "down", "left", "right", "moving", "stationary",
    "no", "action", "randomdir", "random", "perpendicular", "parallel",
    "horizontal", "vertical", "orthogonal", "...",
}
# Words that may precede the first bracket of a rule.
RULE_PREFIXES = {"late", "rigid", "random", "up", "down", "left", "right",
                 "horizontal", "vertical", "moving", "+", "startloop", "endloop"}
# Words that may follow the last bracket of a rule.
RULE_COMMANDS = {"win", "again", "cancel", "restart", "checkpoint", "nosave",
                 "sfx0", "sfx1", "sfx2", "sfx3", "sfx4", "sfx5", "sfx6", "sfx7",
                 "sfx8", "sfx9"}

DIRECTIONS = [">", "<", "^", "v"]
ABS_DIRECTIONS = ["up", "down", "left", "right"]

COLORS = ["black", "white", "grey", "darkgrey", "lightgrey", "gray", "darkgray",
          "lightgray", "red", "darkred", "lightred", "brown", "darkbrown",
          "lightbrown", "orange", "yellow", "green", "darkgreen", "lightgreen",
          "blue", "lightblue", "darkblue", "purple", "pink", "transparent"]

_BRACKET = re.compile(r"\[(.*?)\]")


class ParseError(Exception):
    pass


# --------------------------------------------------------------------------
# structure
# --------------------------------------------------------------------------

@dataclass
class Obj:
    name: str
    synonym: str | None          # the single-char shorthand on the name line
    colors: list[str]
    sprite: list[str]            # rows of digits and '.', possibly empty

    def emit(self) -> str:
        head = self.name if not self.synonym else f"{self.name} {self.synonym}"
        out = [head, " ".join(self.colors)]
        out.extend(self.sprite)
        return "\n".join(out)

    def copy(self) -> "Obj":
        return Obj(self.name, self.synonym, list(self.colors), list(self.sprite))


@dataclass
class Legend:
    sym: str
    members: list[str]
    join: str                    # "", "and", "or"

    def emit(self) -> str:
        sep = f" {self.join} " if self.join else " "
        return f"{self.sym} = {sep.join(self.members)}"


@dataclass
class Cell:
    """One ``|``-separated cell of a rule pattern: modifiers plus objects."""
    tokens: list[str]

    def emit(self) -> str:
        return " ".join(self.tokens)

    def objects(self) -> list[str]:
        return [t for t in self.tokens if t.lower() not in MODIFIERS]

    def replace_object(self, old: str, new: str) -> bool:
        hit = False
        for i, t in enumerate(self.tokens):
            if t.lower() not in MODIFIERS and t.lower() == old.lower():
                self.tokens[i] = new
                hit = True
        return hit


@dataclass
class Pattern:
    """One ``[...]`` group: a row of cells."""
    cells: list[Cell]

    def emit(self) -> str:
        return "[ " + " | ".join(c.emit() for c in self.cells) + " ]"

    def copy(self) -> "Pattern":
        return Pattern([Cell(list(c.tokens)) for c in self.cells])


@dataclass
class Rule:
    prefixes: list[str]
    lhs: list[Pattern]
    rhs: list[Pattern]
    commands: list[str]
    raw: str | None = None       # set when the line could not be parsed

    def emit(self) -> str:
        if self.raw is not None:
            return self.raw
        parts = list(self.prefixes)
        parts += [p.emit() for p in self.lhs]
        parts.append("->")
        parts += [p.emit() for p in self.rhs]
        parts += self.commands
        return " ".join(parts)

    def copy(self) -> "Rule":
        if self.raw is not None:
            return Rule([], [], [], [], self.raw)
        return Rule(list(self.prefixes), [p.copy() for p in self.lhs],
                    [p.copy() for p in self.rhs], list(self.commands))

    def objects(self) -> set[str]:
        out: set[str] = set()
        for p in self.lhs + self.rhs:
            for c in p.cells:
                out.update(o.lower() for o in c.objects())
        return out

    @property
    def parsed(self) -> bool:
        return self.raw is None


@dataclass
class Win:
    quant: str                   # All / Some / No
    a: str
    b: str | None = None         # the "on X" target
    raw: str | None = None

    def emit(self) -> str:
        if self.raw is not None:
            return self.raw
        return f"{self.quant} {self.a}" + (f" on {self.b}" if self.b else "")


@dataclass
class Level:
    """A playable level (rows of legend characters) or a message screen."""
    rows: list[str]
    message: str | None = None
    keyword: str = "message"     # the source spelling, e.g. MESSAGE

    @property
    def is_message(self) -> bool:
        return self.message is not None

    @property
    def height(self) -> int:
        return len(self.rows)

    @property
    def width(self) -> int:
        return max((len(r) for r in self.rows), default=0)

    def emit(self) -> str:
        if self.is_message:
            return f"{self.keyword} {self.message}".rstrip()
        return "\n".join(self.rows)

    def copy(self) -> "Level":
        return Level(list(self.rows), self.message, self.keyword)

    def rectangular(self) -> "Level":
        if self.is_message:
            return self
        w = self.width
        return Level([r.ljust(w, r[-1] if r else ".") for r in self.rows])

    def counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for r in self.rows:
            for ch in r:
                out[ch] = out.get(ch, 0) + 1
        return out


@dataclass
class Game:
    prelude: list[str] = field(default_factory=list)
    objects: list[Obj] = field(default_factory=list)
    legend: list[Legend] = field(default_factory=list)
    sounds: list[str] = field(default_factory=list)
    layers: list[list[str]] = field(default_factory=list)
    rules: list[Rule] = field(default_factory=list)
    wins: list[Win] = field(default_factory=list)
    levels: list[Level] = field(default_factory=list)
    lineage: list[str] = field(default_factory=list)
    # verbatim source of each section, and which sections a mutation touched
    raw: dict[str, list[str]] = field(default_factory=dict)
    dirty: set[str] = field(default_factory=set)

    def touch(self, *sections: str) -> "Game":
        """Mark sections as modified so :meth:`emit` regenerates them."""
        self.dirty.update(sections)
        return self

    # -- parsing -----------------------------------------------------------

    @classmethod
    def parse(cls, text: str) -> "Game":
        blocks = _split_sections(text)
        g = cls()
        g.prelude = [l for l in blocks.get("__prelude__", []) if l.strip()]
        g.objects = _parse_objects(blocks.get("OBJECTS", []))
        g.legend = _parse_legend(blocks.get("LEGEND", []))
        g.sounds = [l for l in blocks.get("SOUNDS", []) if l.strip()]
        g.layers = _parse_layers(blocks.get("COLLISIONLAYERS", []))
        g.rules = _parse_rules(blocks.get("RULES", []))
        g.wins = _parse_wins(blocks.get("WINCONDITIONS", []))
        g.levels = _parse_levels(blocks.get("LEVELS", []))
        g.raw = {k: list(v) for k, v in blocks.items() if k != "__prelude__"}
        return g

    # -- emission ----------------------------------------------------------

    def emit(self) -> str:
        """Write the game back out.

        A section the mutation operators never touched is reproduced from the
        source verbatim.  The structural parser understands most of
        PuzzleScript but not all of it, and regenerating a section it only
        half-read is how a working game turns into a broken one; this way the
        only section at risk is the one that was deliberately changed.
        """
        def sec(name: str, body: str) -> str:
            bar = "=" * len(name)
            return f"{bar}\n{name}\n{bar}\n\n{body}\n"

        def body(name: str, regenerate) -> str:
            if name not in self.dirty and name in self.raw:
                return "\n".join(self.raw[name]).strip("\n")
            return regenerate()

        out = ["\n".join(self.prelude), ""]
        out.append(sec("OBJECTS", body("OBJECTS", lambda: "\n\n".join(o.emit() for o in self.objects))))
        out.append(sec("LEGEND", body("LEGEND", lambda: "\n".join(l.emit() for l in self.legend))))
        out.append(sec("SOUNDS", body("SOUNDS", lambda: "\n".join(self.sounds))))
        out.append(sec("COLLISIONLAYERS",
                       body("COLLISIONLAYERS", lambda: "\n".join(", ".join(l) for l in self.layers))))
        out.append(sec("RULES", body("RULES", lambda: "\n".join(r.emit() for r in self.rules))))
        out.append(sec("WINCONDITIONS", body("WINCONDITIONS", lambda: "\n".join(w.emit() for w in self.wins))))
        out.append(sec("LEVELS", body("LEVELS", lambda: "\n\n".join(l.emit() for l in self.levels))))
        return "\n".join(out)

    # -- symbol table ------------------------------------------------------

    def object_names(self) -> list[str]:
        return [o.name for o in self.objects]

    def all_symbols(self) -> dict[str, list[str]]:
        """Every name usable in a rule -> the concrete objects it stands for."""
        table: dict[str, list[str]] = {}
        for o in self.objects:
            table[o.name.lower()] = [o.name]
            if o.synonym:
                table[o.synonym.lower()] = [o.name]
        for l in self.legend:
            resolved: list[str] = []
            for m in l.members:
                resolved.extend(table.get(m.lower(), [m]))
            table[l.sym.lower()] = resolved
        return table

    def layer_of(self) -> dict[str, int]:
        """Object (lowercased) -> collision layer index."""
        out: dict[str, int] = {}
        for i, layer in enumerate(self.layers):
            for name in layer:
                out[name.lower()] = i
        return out

    def symbol_layer(self) -> dict[str, int]:
        """Rule-usable symbol -> the layer of its first concrete object."""
        lo = self.layer_of()
        out: dict[str, int] = {}
        for sym, members in self.all_symbols().items():
            for m in members:
                if m.lower() in lo:
                    out[sym] = lo[m.lower()]
                    break
        return out

    def level_chars(self) -> set[str]:
        out: set[str] = set()
        for l in self.levels:
            if not l.is_message:
                for r in l.rows:
                    out.update(r)
        return out

    def placeable_chars(self) -> list[str]:
        """Single-character legend symbols usable inside a level."""
        out = []
        for l in self.legend:
            if len(l.sym) == 1 and l.join != "or":
                out.append(l.sym)
        for o in self.objects:
            if o.synonym and len(o.synonym) == 1:
                out.append(o.synonym)
        return sorted(set(out))

    def level_alphabet(self) -> set[str]:
        """Every character that may legally appear in a level.

        Single-character *object* names count as well as legend symbols: a
        game like 2048 names its tiles ``1``..``9`` and writes them straight
        into the level art with no legend entry at all.
        """
        chars = {l.sym for l in self.legend if len(l.sym) == 1}
        for o in self.objects:
            if len(o.name) == 1:
                chars.add(o.name)
            if o.synonym and len(o.synonym) == 1:
                chars.add(o.synonym)
        return chars

    def background_char(self) -> str:
        """The legend character that stands for the most common floor tile."""
        counts: dict[str, int] = {}
        for l in self.levels:
            if l.is_message:
                continue
            for ch, n in l.counts().items():
                counts[ch] = counts.get(ch, 0) + n
        if counts:
            return max(counts, key=lambda c: counts[c])
        p = self.placeable_chars()
        return p[0] if p else "."

    def player_symbols(self) -> list[str]:
        """Symbols that resolve to something named like a player."""
        out = []
        for sym, members in self.all_symbols().items():
            if any("player" in m.lower() for m in members):
                out.append(sym)
        return out

    def playable_levels(self) -> list[Level]:
        return [l for l in self.levels if not l.is_message]

    # -- invariants --------------------------------------------------------

    def repair(self) -> "Game":
        """Restore the structural invariants a compiler would check.

        Mutations are written so they do not break these, but composition and
        level surgery can still leave an object out of a layer or a character
        out of the legend, so every operator ends here.
        """
        names = {o.name.lower() for o in self.objects}
        # 1. legend entries may only mention declared objects or earlier legends
        known = set(names)
        kept_legend = []
        for l in self.legend:
            members = [m for m in l.members if m.lower() in known]
            if not members:
                continue
            kept_legend.append(Legend(l.sym, members, l.join if len(members) > 1 else ""))
            known.add(l.sym.lower())
        self.legend = kept_legend
        # 2. every object sits in exactly one layer
        self.layers = [[n for n in layer if n.lower() in names] for layer in self.layers]
        placed = {n.lower() for layer in self.layers for n in layer}
        seen: set[str] = set()
        for layer in self.layers:
            dedup = []
            for n in layer:
                if n.lower() not in seen:
                    seen.add(n.lower())
                    dedup.append(n)
            layer[:] = dedup
        orphans = [o.name for o in self.objects if o.name.lower() not in placed]
        if orphans:
            self.layers.append(orphans)
        self.layers = [l for l in self.layers if l]
        # 3. rules may only mention resolvable symbols
        table = self.all_symbols()
        self.rules = [r for r in self.rules
                      if r.raw is not None or r.objects() <= set(table)]
        # 4. win conditions likewise
        self.wins = [w for w in self.wins if w.raw is not None or (
            w.a.lower() in table and (w.b is None or w.b.lower() in table))]
        # 5. levels are rectangular and use known characters
        chars = self.level_alphabet()
        bg = self.background_char()
        if bg not in chars and chars:
            bg = sorted(chars)[0]
        fixed = []
        for l in self.levels:
            if l.is_message:
                fixed.append(l)
                continue
            rows = ["".join(ch if ch in chars else bg for ch in r) for r in l.rows]
            w = max((len(r) for r in rows), default=0)
            rows = [r.ljust(w, bg) for r in rows]
            if rows and w:
                fixed.append(Level(rows))
        self.levels = fixed
        return self

    def copy(self) -> "Game":
        return Game(
            prelude=list(self.prelude),
            objects=[o.copy() for o in self.objects],
            legend=[Legend(l.sym, list(l.members), l.join) for l in self.legend],
            sounds=list(self.sounds),
            layers=[list(l) for l in self.layers],
            rules=[r.copy() for r in self.rules],
            wins=[Win(w.quant, w.a, w.b, w.raw) for w in self.wins],
            levels=[l.copy() for l in self.levels],
            lineage=list(self.lineage),
            raw={k: list(v) for k, v in self.raw.items()},
            dirty=set(self.dirty),
        )

    def title(self) -> str:
        for line in self.prelude:
            if line.lower().startswith("title "):
                return line[6:].strip()
        return "untitled"

    def set_title(self, t: str) -> None:
        for i, line in enumerate(self.prelude):
            if line.lower().startswith("title "):
                self.prelude[i] = f"title {t}"
                return
        self.prelude.insert(0, f"title {t}")


# --------------------------------------------------------------------------
# parsing helpers
# --------------------------------------------------------------------------

def strip_comments(text: str) -> str:
    """Delete ``(...)`` comments, which nest and may span lines.

    Newlines inside a comment are kept so that blank-line block structure and
    level geometry survive; only the commented characters go.  Doing this per
    line instead (the obvious version) leaves the tail of a two-line comment
    behind, and in a RULES section that tail parses as a bogus rule.
    """
    out: list[str] = []
    depth = 0
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            if depth:
                depth -= 1
                continue
            out.append(ch)
        elif depth == 0 or ch == "\n":
            out.append(ch)
    return "".join(out)


def _split_sections(text: str) -> dict[str, list[str]]:
    """Split a game into its sections, keyed by uppercase section name."""
    text = strip_comments(text)
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: dict[str, list[str]] = {"__prelude__": []}
    cur = "__prelude__"
    for line in lines:
        s = line.strip()
        if set(s) <= {"="} and s:
            continue  # a bar line
        if s.upper() in SECTIONS:
            cur = s.upper()
            out.setdefault(cur, [])
            continue
        # strip full-line comments but keep level art intact
        out.setdefault(cur, []).append(line.rstrip())
    return out


def _blocks(lines: list[str]) -> list[list[str]]:
    """Group lines into blank-line-separated blocks."""
    out: list[list[str]] = []
    cur: list[str] = []
    for line in lines:
        if line.strip():
            cur.append(line)
        elif cur:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def _strip_comment(line: str) -> str:
    """Remove ``(...)`` comments, respecting nesting."""
    out, depth = [], 0
    for ch in line:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return "".join(out)


_SPRITE_CHARS = set("0123456789.")


def _is_sprite_row(s: str, width: int | None) -> bool:
    """Is this line a row of sprite pixels rather than the next object's name?

    Blank lines between objects are conventional but not required -- plenty of
    games run the whole OBJECTS section together -- so boundaries have to be
    found structurally.  A sprite row is digits and dots only, and every row of
    one sprite has the same width.  The width test is what keeps an object
    *named* ``1`` (2048 names its tiles after their values) from being eaten as
    a one-pixel row of the sprite above it.
    """
    s = s.strip()
    if not s or not set(s) <= _SPRITE_CHARS:
        return False
    return len(s) == width if width is not None else len(s) >= 2


def _parse_objects(lines: list[str]) -> list[Obj]:
    rows = [l.rstrip() for l in lines if l.strip()]
    objs: list[Obj] = []
    i = 0
    while i < len(rows):
        head = rows[i].strip().split()
        i += 1
        if not head:
            continue
        name = head[0]
        syn = head[1] if len(head) > 1 else None
        colors: list[str] = []
        if i < len(rows) and not _is_sprite_row(rows[i], None):
            colors = rows[i].strip().split()
            i += 1
        sprite: list[str] = []
        width: int | None = None
        while i < len(rows) and _is_sprite_row(rows[i], width):
            sprite.append(rows[i].strip())
            width = len(sprite[0])
            i += 1
        objs.append(Obj(name, syn, colors, sprite))
    return objs


def _parse_legend(lines: list[str]) -> list[Legend]:
    out = []
    for raw in lines:
        line = _strip_comment(raw).strip()
        if "=" not in line:
            continue
        sym, rhs = line.split("=", 1)
        sym = sym.strip()
        toks = rhs.split()
        join = ""
        for j in ("and", "or"):
            if any(t.lower() == j for t in toks):
                join = j
        members = [t for t in toks if t.lower() not in ("and", "or")]
        if sym and members:
            out.append(Legend(sym, members, join))
    return out


def _parse_layers(lines: list[str]) -> list[list[str]]:
    out = []
    for raw in lines:
        line = _strip_comment(raw).strip()
        if not line:
            continue
        names = [t.strip() for t in line.replace(",", " ").split() if t.strip()]
        if names:
            out.append(names)
    return out


def _parse_rules(lines: list[str]) -> list[Rule]:
    out = []
    for raw in lines:
        line = _strip_comment(raw).strip()
        if not line:
            continue
        r = _parse_rule_line(line)
        out.append(r)
    return out


def _parse_rule_line(line: str) -> Rule:
    if "->" not in line:
        return Rule([], [], [], [], raw=line)
    lhs_text, rhs_text = line.split("->", 1)
    lhs_brackets = _BRACKET.findall(lhs_text)
    rhs_brackets = _BRACKET.findall(rhs_text)
    if not lhs_brackets:
        return Rule([], [], [], [], raw=line)
    prefix_text = lhs_text[: lhs_text.index("[")] if "[" in lhs_text else ""
    prefixes = [p for p in prefix_text.split() if p]
    if any(p.lower() not in RULE_PREFIXES for p in prefixes):
        return Rule([], [], [], [], raw=line)
    tail = rhs_text[rhs_text.rindex("]") + 1:] if "]" in rhs_text else rhs_text
    commands = [c for c in tail.split() if c]
    if any(c.lower() not in RULE_COMMANDS for c in commands):
        return Rule([], [], [], [], raw=line)
    try:
        lhs = [_parse_pattern(b) for b in lhs_brackets]
        rhs = [_parse_pattern(b) for b in rhs_brackets]
    except ParseError:
        return Rule([], [], [], [], raw=line)
    return Rule(prefixes, lhs, rhs, commands)


def _parse_pattern(body: str) -> Pattern:
    cells = [Cell(part.split()) for part in body.split("|")]
    return Pattern(cells)


def _parse_wins(lines: list[str]) -> list[Win]:
    out = []
    for raw in lines:
        line = _strip_comment(raw).strip()
        if not line:
            continue
        toks = line.split()
        if toks[0].lower() in ("all", "some", "any", "no") and len(toks) >= 2:
            quant = toks[0]
            if len(toks) >= 4 and toks[2].lower() == "on":
                out.append(Win(quant, toks[1], toks[3]))
            elif len(toks) == 2:
                out.append(Win(quant, toks[1], None))
            else:
                out.append(Win(quant, toks[1], None, raw=line))
        else:
            out.append(Win("", "", None, raw=line))
    return out


def _parse_levels(lines: list[str]) -> list[Level]:
    out: list[Level] = []
    cur: list[str] = []
    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if stripped.lower().startswith("message"):
            if cur:
                out.append(Level(cur))
                cur = []
            out.append(Level([], message=stripped[7:].strip(), keyword=stripped[:7]))
            continue
        if not stripped:
            if cur:
                out.append(Level(cur))
                cur = []
            continue
        cur.append(line)
    if cur:
        out.append(Level(cur))
    return out
