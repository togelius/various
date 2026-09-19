"""Turn a MAP-Elites archive into a page you can look at.

An archive is a directory of a thousand text files and a JSON index, which is
unreadable as a result. This writes a single self-contained HTML file: every
elite with its first levels rendered, the metrics that got it there, the chain
of mutations that made it, its nearest human neighbours, and its source ready
to paste into the PuzzleScript editor.

Images are inlined as data URIs so the page is one file that can be mailed or
opened from anywhere.

    .venv/bin/python -m prof.gallery --run data/evolve/novel --top 60
"""
from __future__ import annotations

import argparse
import html
import json
import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent

CSS = """
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:#12131a; color:#e6e7ee;
       font:14px/1.55 ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif; }
header { padding:28px 32px 18px; border-bottom:1px solid #262838; }
h1 { margin:0 0 6px; font-size:20px; letter-spacing:.2px; }
.sub { color:#8f93a8; font-size:13px; }
.stats { display:flex; flex-wrap:wrap; gap:26px; margin-top:14px; }
.stat b { display:block; font-size:19px; font-weight:600; }
.stat span { color:#8f93a8; font-size:12px; text-transform:uppercase;
             letter-spacing:.06em; }
main { padding:22px 32px 60px; }
.grid { display:grid; gap:16px;
        grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); }
.card { background:#1a1c26; border:1px solid #262838; border-radius:10px;
        padding:14px; }
.card h2 { margin:0 0 2px; font-size:14px; font-weight:600; }
.cell { color:#6f7390; }
.key { color:#7b7fa0; font-size:12px; font-family:ui-monospace,monospace; }
.shots { display:flex; gap:8px; margin:10px 0; flex-wrap:wrap;
         align-items:flex-start; }
.shots img { image-rendering:pixelated; border-radius:4px;
             border:1px solid #2e3142; max-height:150px; }
table.m { width:100%; border-collapse:collapse; margin:8px 0 6px; font-size:12.5px; }
table.m td { padding:2px 0; }
table.m td:first-child { color:#8f93a8; }
table.m td:last-child { text-align:right; font-variant-numeric:tabular-nums; }
.ops { color:#9aa0c0; font-size:12px; font-family:ui-monospace,monospace;
       word-break:break-word; margin:6px 0; }
.tag { display:inline-block; background:#232637; border-radius:4px;
       padding:1px 6px; margin:2px 3px 2px 0; font-size:11.5px; color:#b9bedd; }
.tag.new { background:#2b3a2c; color:#a8e6ab; }
.tag.deep { background:#3a2f22; color:#f0cfa0; }
details { margin-top:8px; }
summary { cursor:pointer; color:#8f93a8; font-size:12.5px; }
pre { background:#0e0f15; border:1px solid #262838; border-radius:6px;
      padding:10px; overflow:auto; max-height:340px; font-size:11.5px;
      line-height:1.45; }
.near { color:#7b7fa0; font-size:11.5px; margin-top:4px; }
a.play { display:inline-block; margin-top:8px; padding:5px 12px; border-radius:6px;
         background:#2f4a33; color:#c8f0cc; text-decoration:none; font-size:12.5px;
         font-weight:600; }
a.play:hover { background:#3a5c3f; }
.map { margin:18px 0 6px; }
.map table { border-collapse:collapse; }
.map td { width:15px; height:15px; border:1px solid #12131a; }
.maplabel { color:#8f93a8; font-size:12px; margin:10px 0 4px; }
"""


def heat(v: float) -> str:
    """Empty cells dark, better elites brighter."""
    if v is None:
        return "#1a1c26"
    t = max(0.0, min(1.0, v))
    r = int(30 + 200 * t)
    g = int(40 + 120 * t)
    b = int(70 + 40 * (1 - t))
    return f"rgb({r},{g},{b})"


def coverage_map(elites: dict[str, Any], axes: list[dict], i: int, j: int) -> str:
    """A 2-D slice of the archive: best fitness projected onto two axes."""
    ai, aj = axes[i], axes[j]
    best: dict[tuple[int, int], float] = {}
    for e in elites.values():
        c = e["cell"]
        k = (c[i], c[j])
        best[k] = max(best.get(k, -9.9), e["fitness"])
    rows = []
    for y in range(aj["bins"] - 1, -1, -1):
        tds = []
        for x in range(ai["bins"]):
            v = best.get((x, y))
            colour = heat(None if v is None else max(0.0, min(1.0, v)))
            title = f"{ai['name']}={x} {aj['name']}={y}" + (f" f={v:.2f}" if v is not None else "")
            tds.append(f'<td style="background:{colour}" title="{html.escape(title)}"></td>')
        rows.append("<tr>" + "".join(tds) + "</tr>")
    return (f'<div class="maplabel">{html.escape(ai["name"])} (x) vs '
            f'{html.escape(aj["name"])} (y)</div>'
            f'<div class="map"><table>{"".join(rows)}</table></div>')


def metric_rows(e: dict[str, Any]) -> str:
    f = e.get("features", {})
    rows = [
        ("fitness", f"{e['fitness']:.3f}"),
        ("novelty", f"{e.get('novelty', 0):.2f}"),
        ("rules / objects", f"{int(f.get('n_rule_sources', 0))} / {int(f.get('n_objects', 0))}"),
        ("mean solution", f"{f.get('mean_solution_len', 0):.1f} moves"),
        ("levels solved", f"{f.get('frac_solved', 0) * 100:.0f}%"),
    ]
    d = e.get("depth")
    if d:
        if d.get("coverage", -1) >= 0:
            rows.append(("rules that fire", f"{100 * d['coverage']:.0f}%"))
        rows += [
            ("insight (weak player)", f"{d.get('insight', 0):.2f}"),
            ("random play wins", f"{d.get('random_win_frac', 0):.3f}"),
        ]
        if d.get("reliable_levels", 0):
            rows += [("fatal moves", f"{d.get('fatal_frac', 0):.2f}"),
                     ("danger concentration", f"{d.get('fatal_gini', 0):.2f}")]
    return "".join(f"<tr><td>{html.escape(k)}</td><td>{html.escape(v)}</td></tr>"
                   for k, v in rows)


def _from_polished(run: Path):
    """Read a finished ``prof.polish`` archive as if it were a MAP-Elites run.

    The two directories hold the same thing in different shapes: the polished
    archive is a flat ranked list with before/after measurements rather than a
    grid of cells, so the gallery gets an adapter instead of a second renderer.
    """
    from prof.grammar import Game

    idx = json.loads((run / "index.json").read_text())
    elites = {}
    for g in idx.get("games", []):
        key = f"{g['run']}_{g['key']}"
        after = g.get("after") or {}
        src = run / "games" / f"{key}.txt"
        n_rules = n_objs = 0
        if src.exists():
            try:
                parsed = Game.parse(src.read_text(encoding="utf-8", errors="replace"))
                n_rules = len(parsed.rules)
                n_objs = len(parsed.objects)
            except Exception:  # noqa: BLE001
                pass
        elites[key] = {
            "cell": [0], "fitness": g.get("final_score", 0.0),
            "tier": 3, "name": g.get("name", key), "ops": g.get("ops", []),
            "novelty": g.get("novelty", 0.0), "iteration": 0,
            "features": {
                "n_rule_sources": n_rules, "n_objects": n_objs,
                "mean_solution_len": _mean_len(after), "frac_solved": 1.0,
            },
            "depth": after | {"coverage": g.get("coverage", -1),
                              "regenerated": g.get("regenerated", False)},
            "summary": "", "parent": g.get("run"),
        }
    blob = {"elites": elites, "n_evaluated": idx.get("considered", 0),
            "curated": True, "kept": idx.get("kept", len(elites))}
    cfg = {"novelty_weight": "mixed", "seeds": idx.get("considered", 0)}
    return blob, elites, [], cfg


def _mean_len(after: dict[str, Any]) -> float:
    lv = [l.get("length", 0) for l in after.get("levels", []) if l.get("solved")]
    return sum(lv) / len(lv) if lv else 0.0


def build(run: Path, top: int, shots: int, sort: str, out: Path,
          show_source: bool = True, play_dir: Path | None = None) -> Path:
    from prof.novelty import shared
    from prof.render import thumbnails

    if (run / "index.json").exists() and not (run / "archive.json").exists():
        blob, elites, axes, cfg = _from_polished(run)
    else:
        blob = json.loads((run / "archive.json").read_text())
        elites = blob["elites"]
        axes = blob.get("axes", [])
        cfg = {}
        if (run / "config.json").exists():
            cfg = json.loads((run / "config.json").read_text())

    try:
        nov = shared()
    except Exception:  # noqa: BLE001
        nov = None

    def keyfn(item):
        k, e = item
        if sort == "novelty":
            return (-e.get("novelty", 0), -e["fitness"])
        if sort == "insight":
            d = e.get("depth") or {}
            return (-d.get("insight", 0), -e["fitness"])
        return (-e["fitness"], -e.get("novelty", 0))

    ranked = sorted(elites.items(), key=keyfn)
    playable = [x for x in ranked if x[1]["tier"] >= 3]
    chosen = (playable or ranked)[:top]

    cards = []
    for k, e in chosen:
        src_path = run / "games" / f"{k}.txt"
        source = src_path.read_text(encoding="utf-8", errors="replace") if src_path.exists() else ""
        imgs = thumbnails(source, n=shots) if source else []
        img_html = "".join(f'<img src="{u}" alt="level {i}">' for i, u in enumerate(imgs))
        ops = e.get("ops", [])
        tags = "".join(
            f'<span class="tag{" new" if o.startswith("template") else ""}">{html.escape(o)}</span>'
            for o in ops[-10:])
        near = ""
        if nov is not None and e.get("features"):
            try:
                near = ", ".join(n for n, _ in nov.nearest(e["features"], 3))
            except Exception:  # noqa: BLE001
                near = ""
        deep = '<span class="tag deep">deep-scored</span>' if e.get("depth") else ""
        src_block = (f"<details><summary>source ({len(source.splitlines())} lines)</summary>"
                     f"<pre>{html.escape(source)}</pre></details>") if show_source else ""
        play = ""
        if (run / "play" / f"{k}.html").exists():
            play = f'<a class="play" href="play/{k}.html">play</a>'
        elif play_dir is not None and (play_dir / f"{k}.html").exists():
            rel = os.path.relpath(play_dir / f"{k}.html", out.parent)
            play = f'<a class="play" href="{rel}">play</a>'
        
        cards.append(f"""<div class="card">
  <h2>{html.escape(e.get('name', k))[:70]}</h2>
  <div class="key">cell {html.escape(k)} &middot; iteration {e.get('iteration', 0)} {deep}</div>
  <div class="shots">{img_html or '<span class="key">no renderable level</span>'}</div>
  <table class="m">{metric_rows(e)}</table>
  {play}
  <div class="ops">{tags or '<span class="key">seed</span>'}</div>
  {f'<div class="near">nearest human games: {html.escape(near)}</div>' if near else ''}
  {src_block}
</div>""")

    maps = ""
    if len(axes) >= 2:
        maps = coverage_map(elites, axes, 0, 1)
        if len(axes) >= 4:
            maps += coverage_map(elites, axes, 2, 3)

    total_cells = 1
    for a in axes:
        total_cells *= a["bins"]
    n_play = sum(1 for e in elites.values() if e["tier"] >= 3)
    n_nov = sum(1 for e in elites.values() if e.get("novelty", 0) > 1.1)
    qd = sum(max(0.0, e["fitness"]) for e in elites.values())

    def stat(v, label):
        return f'<div class="stat"><b>{v}</b><span>{label}</span></div>'

    if blob.get("curated"):
        n_regen = sum(1 for e in elites.values()
                      if (e.get("depth") or {}).get("regenerated"))
        blurb = ("Games that passed the shipping bar: every probed level solvable, "
                 "random play never wins, at least 60% of rules fire. Each was "
                 "derived from a human-authored game; the source records which.")
        stats = "".join([
            stat(len(elites), "games shipped"),
            stat(blob.get("n_evaluated", 0), "elites considered"),
            stat(n_regen, "with regenerated levels"),
            stat(n_nov, "beyond the corpus"),
        ])
    else:
        blurb = (f"MAP-Elites over PuzzleScript. Novelty weight "
                 f"{cfg.get('novelty_weight', '?')}, seeded from "
                 f"{cfg.get('seeds', '?')} human games.")
        stats = "".join([
            stat(f"{len(elites)}/{total_cells}", "cells filled"),
            stat(n_play, "fully playable"),
            stat(n_nov, "beyond the corpus"),
            stat(f"{qd:.0f}", "QD score"),
            stat(f"{blob.get('n_evaluated', 0):,}", "candidates evaluated"),
        ])

    page = f"""<!doctype html><meta charset="utf-8">
<title>ScriptProf archive &middot; {html.escape(run.name)}</title>
<style>{CSS}</style>
<header>
  <h1>ScriptProf archive &middot; {html.escape(run.name)}</h1>
  <div class="sub">{blurb}</div>
  <div class="stats">{stats}</div>
  {maps}
</header>
<main>
  <div class="sub" style="margin-bottom:14px">Showing {len(chosen)} games sorted by
    {html.escape(sort)}. Green tags are mechanics injected by a template that the
    parent game did not have.</div>
  <div class="grid">{''.join(cards)}</div>
</main>"""
    out.write_text(page, encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="data/evolve/novel")
    ap.add_argument("--out", default=None)
    ap.add_argument("--top", type=int, default=60)
    ap.add_argument("--shots", type=int, default=3)
    ap.add_argument("--sort", default="fitness", choices=["fitness", "novelty", "insight"])
    ap.add_argument("--play", default=None,
                    help="directory of standalone HTML players to link to")
    a = ap.parse_args()
    run = Path(a.run) if Path(a.run).is_absolute() else ROOT / a.run
    out = Path(a.out) if a.out else run / "gallery.html"
    play = None
    if a.play:
        play = Path(a.play) if Path(a.play).is_absolute() else ROOT / a.play
    p = build(run, a.top, a.shots, a.sort, out, play_dir=play)
    print(f"wrote {p} ({p.stat().st_size / 1024:.0f} kB)")


if __name__ == "__main__":
    main()
