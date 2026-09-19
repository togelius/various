"""Export a generated game as a self-contained, playable HTML file.

A game in the archive is a text file, which is not something you can hand
anyone.  PuzzleScript ships the fix already: its editor's "export" button
substitutes a game into ``standalone_inlined.txt``, a single HTML file with the
whole engine inlined, and the result runs offline in any browser.  This does
the same substitution from Python, following ``buildStandalone.js`` exactly --
including the two details that are easy to get wrong.

First, the placeholder in the template is ``"__GAMEDAT__"`` *with its quotes*,
and the replacement is expected to bring its own: the editor passes
``JSON.stringify(source)``, not the source.  Substituting raw text produces a
file that looks right and is a syntax error on the first apostrophe.

Second, JavaScript's ``String.replace`` treats ``$`` in the replacement
specially, so the editor doubles every ``$`` first.  Python's ``str.replace``
does not, so that step is deliberately *not* copied.

    .venv/bin/python -m prof.standalone --games data/archive/games --out data/archive/play
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "vendor" / "script-doctor" / "PuzzleScript" / "src" / "standalone_inlined.txt"

_PRELUDE = re.compile(r"^\s*(title|author|homepage|background_color|text_color)\s+(.*)$",
                      re.IGNORECASE | re.MULTILINE)


def metadata(source: str) -> dict[str, str]:
    """Prelude keys the template needs, read straight from the source."""
    out: dict[str, str] = {}
    for key, value in _PRELUDE.findall(source):
        out.setdefault(key.lower(), value.strip())
    return out


def _escape_html(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;").replace("'", "&#39;"))


def build(source: str, title: str | None = None,
          template: Path = TEMPLATE) -> str:
    """A single HTML file that plays ``source``, with no network or server."""
    html = template.read_text(encoding="utf-8")
    meta = metadata(source)
    title = title or meta.get("title") or "PuzzleScript Game"
    homepage = meta.get("homepage", "https://www.puzzlescript.net")
    if not re.match(r"^https?://", homepage):
        homepage = "https://" + homepage
    html = html.replace("___BGCOLOR___", meta.get("background_color", "black"))
    html = html.replace("___TEXTCOLOR___", meta.get("text_color", "lightblue"))
    html = html.replace("__GAMETITLE__", _escape_html(title))
    html = html.replace("__HOMEPAGE__", homepage)
    html = html.replace("__HOMEPAGE_STRIPPED_PROTOCOL__",
                        _escape_html(re.sub(r"^https?://", "", homepage)))
    # the placeholder includes its quotes; the replacement must too
    return html.replace('"__GAMEDAT__"', json.dumps(source))


def export(src: Path, out_dir: Path, title: str | None = None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    text = src.read_text(encoding="utf-8", errors="replace")
    dest = out_dir / f"{src.stem}.html"
    dest.write_text(build(text, title), encoding="utf-8")
    return dest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", default="data/archive/games")
    ap.add_argument("--out", default="data/archive/play")
    a = ap.parse_args()
    games = Path(a.games) if Path(a.games).is_absolute() else ROOT / a.games
    out = Path(a.out) if Path(a.out).is_absolute() else ROOT / a.out
    if not TEMPLATE.exists():
        raise SystemExit(f"missing PuzzleScript standalone template at {TEMPLATE}")
    files = sorted(games.glob("*.txt"))
    if not files:
        raise SystemExit(f"no games in {games}")
    total = 0
    for f in files:
        p = export(f, out)
        total += p.stat().st_size
    print(f"{len(files)} playable files -> {out} "
          f"({total / 1024 / 1024:.1f} MB, {total / len(files) / 1024:.0f} kB each)")


if __name__ == "__main__":
    main()
