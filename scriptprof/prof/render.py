"""Draw a PuzzleScript level from its source, with no engine in the way.

A level is a grid of legend characters; a legend character resolves to a stack
of objects; an object is a colour list and a grid of digits indexing into it.
That is the whole of PuzzleScript's rendering model, so a picture can be made
straight from ``prof.grammar`` structures without compiling the game, loading
an environment or paying a JIT trace.  Which matters here only because the
gallery renders hundreds of games and the point of the last two days was to
stop paying seconds for things that cost milliseconds.

    png = level_png(game, 0, scale=6)     # bytes, ready to write or inline
"""
from __future__ import annotations

import base64
import io
from typing import Any

import numpy as np

from prof.grammar import Game, Level

# PuzzleScript's named palette (the engine's own values).
PALETTE: dict[str, tuple[int, int, int]] = {
    "black": (0, 0, 0), "white": (255, 255, 255),
    "lightgray": (211, 211, 211), "lightgrey": (211, 211, 211),
    "gray": (128, 128, 128), "grey": (128, 128, 128),
    "darkgray": (89, 89, 89), "darkgrey": (89, 89, 89),
    "red": (255, 0, 0), "darkred": (139, 0, 0), "lightred": (255, 102, 102),
    "brown": (165, 42, 42), "darkbrown": (92, 64, 51), "lightbrown": (196, 164, 132),
    "orange": (255, 165, 0), "yellow": (255, 255, 0),
    "green": (0, 128, 0), "darkgreen": (0, 100, 0), "lightgreen": (144, 238, 144),
    "blue": (0, 0, 255), "lightblue": (173, 216, 230), "darkblue": (0, 0, 139),
    "purple": (128, 0, 128), "pink": (255, 192, 203),
    "purpleblue": (138, 43, 226),
}
TRANSPARENT = (-1, -1, -1)


def _colour(name: str) -> tuple[int, int, int]:
    n = name.strip().lower()
    if n in ("transparent", "trans"):
        return TRANSPARENT
    if n.startswith("#"):
        h = n[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) >= 6:
            try:
                return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
            except ValueError:
                pass
    return PALETTE.get(n, (255, 0, 255))  # magenta marks an unknown colour


def _sprite_tile(obj, size: int = 5) -> np.ndarray:
    """An RGBA-ish tile: (size, size, 4) with the last channel as coverage."""
    tile = np.zeros((size, size, 4), dtype=np.int16)
    colours = [_colour(c) for c in obj.colors] or [(255, 0, 255)]
    if not obj.sprite:
        c = colours[0]
        if c == TRANSPARENT:
            return tile
        tile[..., :3] = c
        tile[..., 3] = 1
        return tile
    rows = obj.sprite[:size]
    for y, row in enumerate(rows):
        for x, ch in enumerate(row[:size]):
            if ch == ".":
                continue
            idx = int(ch) if ch.isdigit() else 0
            c = colours[idx] if idx < len(colours) else colours[0]
            if c == TRANSPARENT:
                continue
            tile[y, x, :3] = c
            tile[y, x, 3] = 1
    return tile


def level_array(g: Game, level: Level, cell: int = 5) -> np.ndarray:
    """Render one level to an (H*cell, W*cell, 3) uint8 array."""
    objs = {o.name.lower(): o for o in g.objects}
    table = g.all_symbols()
    tiles: dict[str, np.ndarray] = {}

    def tile_for(ch: str) -> np.ndarray:
        if ch in tiles:
            return tiles[ch]
        stack = np.zeros((cell, cell, 4), dtype=np.int16)
        for member in table.get(ch.lower(), []):
            obj = objs.get(member.lower())
            if obj is None:
                continue
            t = _sprite_tile(obj, cell)
            mask = t[..., 3] > 0
            stack[mask] = t[mask]           # later objects paint over earlier
        tiles[ch] = stack
        return stack

    h, w = level.height, level.width
    img = np.zeros((max(h, 1) * cell, max(w, 1) * cell, 3), dtype=np.uint8)
    for y, row in enumerate(level.rows):
        for x in range(w):
            ch = row[x] if x < len(row) else " "
            t = tile_for(ch)
            img[y * cell:(y + 1) * cell, x * cell:(x + 1) * cell] = t[..., :3].astype(np.uint8)
    return img


def level_png(g: Game, index: int = 0, scale: int = 6, cell: int = 5,
              max_px: int = 520) -> bytes | None:
    """First playable level as PNG bytes, nearest-neighbour upscaled."""
    from PIL import Image

    playable = [l for l in g.levels if not l.is_message and l.rows]
    if not playable or index >= len(playable):
        return None
    arr = level_array(g, playable[index], cell=cell)
    if arr.size == 0:
        return None
    s = max(1, min(scale, max_px // max(arr.shape[0], arr.shape[1], 1)))
    im = Image.fromarray(arr).resize((arr.shape[1] * s, arr.shape[0] * s), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def data_uri(png: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def thumbnails(text: str, n: int = 3, **kw) -> list[str]:
    """Data URIs for the first ``n`` playable levels of a game source."""
    try:
        g = Game.parse(text)
    except Exception:  # noqa: BLE001
        return []
    out = []
    for i in range(n):
        try:
            png = level_png(g, i, **kw)
        except Exception:  # noqa: BLE001
            png = None
        if png is None:
            break
        out.append(data_uri(png))
    return out
