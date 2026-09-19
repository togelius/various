"""A single-file explorer for the generated archive: play, measure, trace.

The gallery shows games; it cannot play them. The standalone exports play; they
are one 474 kB file each, with no metrics and no way to get from one game to
the next. This is both, in one HTML file that works offline: the PuzzleScript
engine inlined **once**, every game's source beside it, and a browser for the
measurements and the ancestry.

Three things make it work on a tablet rather than merely load there.

**The engine's own gesture layer is removed.** ``mobile.js`` binds swipe
handlers to ``window`` and its bootstrap calls ``disableScrolling`` and
``disableSelection`` on the whole document, which is right for a page that is
nothing but a game and wrong for one with a scrolling list next to it. The
block is dropped from the bundle and swipes are handled on the game surface
only.

**Input goes through ``checkKey``.** The engine exposes
``checkKey({keyCode: n}, true)``, which is what its own keyboard handler calls,
so on-screen buttons and swipes take the same path as a key press and get title
screens, messages, undo and restart for free without synthesising events.

**The canvas sizes itself from its parent.** ``canvasResize`` reads
``canvas.parentNode.clientWidth``, so the player is given its own box and told
to resize after any layout change.

    .venv/bin/python -m prof.explorer --archive data/archive
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "vendor" / "script-doctor" / "PuzzleScript" / "src" / "standalone_inlined.txt"

_SCRIPT = re.compile(r"<script>(.*?)</script>", re.S)


def engine_bundle(template: Path = TEMPLATE) -> str:
    """The PuzzleScript engine's script blocks, minus the parts we replace.

    Located by content rather than by line number: everything after the
    template's script-insert marker, dropping the block that defines
    ``window.Mobile`` (its bootstrap disables scrolling document-wide) and the
    block that loads a single hard-coded game.
    """
    text = template.read_text(encoding="utf-8")
    marker = text.find("___SCRIPTINSERT___")
    if marker < 0:
        raise SystemExit(f"{template} is not the expected standalone template")
    blocks = []
    for m in _SCRIPT.finditer(text, marker):
        body = m.group(1)
        if "window.Mobile" in body or "__GAMEDAT__" in body:
            continue
        blocks.append(body)
    if len(blocks) < 5:
        raise SystemExit(f"only found {len(blocks)} engine blocks; template changed?")
    return "\n".join(f"<script>{b}</script>" for b in blocks)


# --------------------------------------------------------------------------
# gathering what to show
# --------------------------------------------------------------------------

def _prelude_field(source: str, key: str) -> str:
    m = re.search(rf"^\s*{key}\s+(.+)$", source, re.IGNORECASE | re.MULTILINE)
    return m.group(1).strip() if m else ""


def _ancestor(source: str) -> tuple[str, str]:
    """The human game a generated one descends from, out of its own header."""
    m = re.search(r'Descended from "(.+?)" by (.+?),', source)
    if m:
        return m.group(1), m.group(2)
    return _prelude_field(source, "title") or "unknown", _prelude_field(source, "author")


def collect(archive: Path, shots: int, cell_px: int, scale: int) -> list[dict[str, Any]]:
    from prof.grammar import Game
    from prof.lineage import Lineage, describe
    from prof.novelty import shared
    from prof.render import thumbnails

    index = json.loads((archive / "index.json").read_text())
    runs = {Path(r).name for r in index.get("runs", [])}
    run_dirs = [ROOT / "data" / "evolve" / r for r in sorted(runs)]
    tree = Lineage.from_runs([d for d in run_dirs if d.exists()])
    try:
        nov = shared()
    except Exception:  # noqa: BLE001
        nov = None

    games = []
    for g in index.get("games", []):
        key, run = g["key"], g["run"]
        path = archive / "games" / f"{run}_{key}.txt"
        if not path.exists():
            continue
        source = path.read_text(encoding="utf-8", errors="replace")
        after = g.get("after") or {}
        anc_title, anc_author = _ancestor(source)
        try:
            parsed = Game.parse(source)
            n_rules = sum(1 for r in parsed.rules if r.parsed)
            n_objs = len(parsed.objects)
            n_levels = len(parsed.playable_levels())
        except Exception:  # noqa: BLE001
            n_rules = n_objs = n_levels = 0
        lens = [l.get("length", 0) for l in after.get("levels", []) if l.get("solved")]
        nearest = []
        if nov is not None:
            try:
                nearest = [n for n, _ in nov.nearest(
                    {"n_rule_sources": n_rules, "n_objects": n_objs}, 3)]
            except Exception:  # noqa: BLE001
                nearest = []
        chain = describe(tree.chain(run, key))
        games.append({
            "id": f"{run}_{key}",
            "run": run, "cell": key,
            "title": _prelude_field(source, "title") or f"{run} {key}",
            "ancestor": anc_title, "ancestorAuthor": anc_author,
            "source": source,
            "shots": thumbnails(source, n=shots, cell=cell_px, scale=scale),
            "metrics": {
                "score": round(g.get("final_score", 0.0), 3),
                "novelty": round(g.get("novelty", 0.0), 2),
                "coverage": round(g.get("coverage", -1), 2),
                "insight": round(after.get("insight", 0.0), 2),
                "randomWin": round(after.get("random_win_frac", 0.0), 3),
                "solved": f"{after.get('solved', 0)}/{after.get('analysed', 0)}",
                "meanLen": round(sum(lens) / len(lens), 1) if lens else 0,
                "rules": n_rules, "objects": n_objs, "levels": n_levels,
                "regenerated": bool(g.get("regenerated")),
            },
            "lineage": chain,
            "nearest": nearest,
        })
    games.sort(key=lambda g: -g["metrics"]["score"])
    return games, tree.summary()


# --------------------------------------------------------------------------
# the page
# --------------------------------------------------------------------------

CSS = """
:root{--bg:#0f1016;--panel:#171922;--line:#272a38;--ink:#e8e9f0;--dim:#9096ad;
      --accent:#7fd18a;--accent2:#2f4a33;color-scheme:dark}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);color:var(--ink);
  font:15px/1.5 ui-sans-serif,-apple-system,"SF Pro Text",Segoe UI,Roboto,sans-serif}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;
  touch-action:manipulation}
#app{display:grid;grid-template-columns:340px 1fr;height:100%}
#list{border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
#listhead{padding:14px 16px 10px;border-bottom:1px solid var(--line)}
#listhead h1{margin:0 0 2px;font-size:16px;letter-spacing:.2px}
#listhead .sub{color:var(--dim);font-size:12.5px}
#tools{display:flex;gap:8px;margin-top:10px}
#tools select,#tools input{flex:1;min-width:0;background:#11131b;color:var(--ink);
  border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:14px}
#cards{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px;flex:1;min-height:0}
.card{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:9px;
  border-radius:10px;border:1px solid transparent}
.card:hover{background:#1b1e29}
.card[aria-current="true"]{background:#1d2430;border-color:#39506b}
.card img{width:58px;height:58px;object-fit:contain;image-rendering:pixelated;
  border-radius:6px;background:#0b0c11;flex:none}
.card .n{font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.card .m{color:var(--dim);font-size:11.5px;font-variant-numeric:tabular-nums}
#detail{display:flex;flex-direction:column;min-height:0;min-width:0}
#dhead{display:flex;align-items:center;gap:10px;padding:12px 16px;
  border-bottom:1px solid var(--line)}
#back{display:none;font-size:20px;padding:4px 10px;border-radius:8px;background:#1b1e29}
#dtitle{font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
#dsub{color:var(--dim);font-size:12px}
#stage{flex:none;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:12px}
#screen{width:min(100%,560px);aspect-ratio:1/1;background:#000;border-radius:10px;
  border:1px solid var(--line);overflow:hidden;position:relative;touch-action:none}
#gameCanvas{display:block;width:100%;height:100%;image-rendering:pixelated}
#hint{position:absolute;inset:auto 0 0 0;padding:6px;text-align:center;font-size:12px;
  color:var(--dim);background:rgba(0,0,0,.55);pointer-events:none}
/* A thumb-reachable pad: arrows clustered left, the keys you reach for less
   often on the right, nothing smaller than Apple's 44pt touch target. */
#pad{display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(2,1fr);
  gap:8px;width:min(100%,560px)}
#pad button{background:#1b1e29;border:1px solid var(--line);border-radius:12px;
  min-height:56px;font-size:20px;font-weight:600;display:flex;align-items:center;
  justify-content:center}
#pad button:active{background:var(--accent2);border-color:var(--accent)}
#pad [data-k=up]{grid-area:1/2}
#pad [data-k=left]{grid-area:2/1}
#pad [data-k=down]{grid-area:2/2}
#pad [data-k=right]{grid-area:2/3}
#pad [data-k=action]{grid-area:1/4/2/6;font-size:15px}
#pad [data-k=undo]{grid-area:2/4;font-size:15px}
#pad [data-k=restart]{grid-area:2/5;font-size:15px}
#tabs{display:flex;gap:4px;padding:0 16px;border-bottom:1px solid var(--line);flex:none}
#tabs button{padding:10px 12px;color:var(--dim);font-size:13.5px;
  border-bottom:2px solid transparent}
#tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--accent)}
#panes{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px 40px;flex:1;
  min-height:0}
.pane{display:none}.pane.on{display:block}
table.m{width:100%;border-collapse:collapse;font-size:13.5px}
table.m td{padding:4px 0;border-bottom:1px solid #1e2130}
table.m td:first-child{color:var(--dim)}
table.m td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.tag{display:inline-block;background:#232637;border-radius:5px;padding:2px 7px;
  margin:2px 4px 2px 0;font-size:11.5px;color:#b9bedd;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.tag.new{background:var(--accent2);color:#a8e6ab}
.tag.seed{background:#3a3226;color:#e8cf9a}
ol.chain{list-style:none;margin:0;padding:0}
ol.chain li{position:relative;padding:8px 0 8px 22px;border-left:2px solid #2b3040;
  margin-left:6px}
ol.chain li:last-child{border-left-color:transparent}
ol.chain li::before{content:"";position:absolute;left:-6px;top:14px;width:10px;
  height:10px;border-radius:50%;background:#3b4256}
ol.chain li::before{background:#3b4256}
ol.chain .gen{color:var(--dim);font-size:11.5px;font-variant-numeric:tabular-nums}
pre{background:#0b0c11;border:1px solid var(--line);border-radius:8px;padding:10px;
  overflow:auto;font-size:11.5px;line-height:1.45;max-height:60vh}
.note{color:var(--dim);font-size:12.5px;margin:2px 0 12px}
#err{color:#ff8c8c;font-size:12.5px;padding:0 16px;min-height:0}
@media (max-width:900px){
  #app{grid-template-columns:1fr}
  #detail{display:none}
  body.playing #list{display:none}
  body.playing #detail{display:flex}
  #back{display:block}
  #screen{width:min(100%,520px)}
}
"""


def build(archive: Path, out: Path, shots: int = 3, cell_px: int = 5,
          scale: int = 4) -> Path:
    games, lineage_note = collect(archive, shots, cell_px, scale)
    if not games:
        raise SystemExit(f"no games found in {archive}")
    payload = json.dumps(games, separators=(",", ":"))
    engine = engine_bundle()
    n_regen = sum(1 for g in games if g["metrics"]["regenerated"])

    app = r"""
const GAMES = __GAMES__;
const byId = Object.fromEntries(GAMES.map(g => [g.id, g]));
let current = null, sortKey = "score";

const $ = s => document.querySelector(s);
const cards = $("#cards"), err = $("#err");

function fmtOps(ops){
  if(!ops || !ops.length) return '<span class="tag seed">seed</span>';
  return ops.map(o => `<span class="tag${o.startsWith("template")?" new":""}">${esc(o)}</span>`).join("");
}
function esc(s){ return String(s).replace(/[&<>"']/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function renderList(){
  const q = $("#q").value.trim().toLowerCase();
  const list = GAMES
    .filter(g => !q || g.title.toLowerCase().includes(q) ||
                 g.ancestor.toLowerCase().includes(q) ||
                 g.lineage.some(s => (s.ops||[]).join(" ").toLowerCase().includes(q)))
    .sort((a,b) => sortKey === "lineage"
      ? b.lineage.length - a.lineage.length
      : b.metrics[sortKey] - a.metrics[sortKey]);
  cards.innerHTML = list.map(g => `
    <button class="card" data-id="${g.id}" aria-current="${g.id===current}">
      <img src="${g.shots[0]||""}" alt="">
      <span style="min-width:0">
        <span class="n">${esc(g.title)}</span><br>
        <span class="m">${esc(g.run)} &middot; score ${g.metrics.score}
          &middot; nov ${g.metrics.novelty} &middot; ${g.lineage.length} gen</span>
      </span>
    </button>`).join("") ||
    '<p class="note" style="padding:10px">Nothing matches that.</p>';
}

function show(id){
  const g = byId[id]; if(!g) return;
  current = id;
  document.body.classList.add("playing");
  $("#dtitle").textContent = g.title;
  $("#dsub").textContent =
    `after ${g.ancestor} by ${g.ancestorAuthor} \u00b7 ${g.run} run, cell ${g.cell}`;
  const m = g.metrics;
  $("#pane-metrics").innerHTML = `
    <p class="note">Measured by the pipeline that produced it. "Rules that fire" is
      the fraction of this game's rules that actually do something on a solution
      path; anything below 60% did not ship.</p>
    <table class="m">
      ${row("shipping score", m.score)}
      ${row("novelty vs human corpus", m.novelty + "&times;")}
      ${row("rules that fire", m.coverage >= 0 ? Math.round(m.coverage*100)+"%" : "-")}
      ${row("insight (weak player fails)", m.insight)}
      ${row("random play wins", m.randomWin)}
      ${row("levels solved by search", m.solved)}
      ${row("mean solution", m.meanLen + " moves")}
      ${row("rules / objects / levels", `${m.rules} / ${m.objects} / ${m.levels}`)}
      ${row("levels", m.regenerated ? "regenerated by search" : "inherited")}
    </table>
    ${g.nearest.length ? `<p class="note" style="margin-top:12px">Nearest human games
      in concept space: ${esc(g.nearest.join(", "))}</p>` : ""}`;
  $("#pane-lineage").innerHTML = `
    <p class="note">Every ancestor back to the seed, newest first, with the edit that
      produced it. Reconstructed by replaying the run log and tracking which game
      occupied which archive cell at each birth.</p>
    <ol class="chain">${g.lineage.map((s,i) => `
      <li><span class="gen">${i===0?"this game":"parent &times;"+i} &middot;
        cell ${esc(s.cell)} &middot; fitness ${s.fitness}</span><br>
        ${s.seed ? `<span class="tag seed">seeded from ${esc(s.seed)}</span>`
                 : fmtOps(s.ops)}</li>`).join("")}</ol>`;
  $("#pane-source").innerHTML = `<pre>${esc(g.source)}</pre>`;
  renderList();
  play(g);
}

function row(k,v){ return `<tr><td>${k}</td><td>${v}</td></tr>`; }

function play(g){
  err.textContent = "";
  try {
    compile(["loadFirstNonMessageLevel"], g.source);
  } catch(e){
    try { compile(["restart"], g.source); }
    catch(e2){ err.textContent = "This game would not start: " + e2; return; }
  }
  fit();
}
function fit(){ try { canvasResize(); } catch(e){} }

// --- input -------------------------------------------------------------
// checkKey is what the engine's own keyboard handler calls, so buttons and
// swipes take exactly the same path as a key press.
const KEY = {up:38,down:40,left:37,right:39,action:88,undo:90,restart:82};
function send(name){
  const k = KEY[name]; if(k===undefined) return;
  try { checkKey({keyCode:k}, true); } catch(e){ err.textContent = String(e); }
}
document.querySelectorAll("#pad button").forEach(b => {
  // Touch devices synthesise a click after touchstart, so the click handler has
  // to ignore that one. Filtering on `detail === 0` looks like the way to do it
  // and is wrong: keyboard activation also reports detail 0, which would leave
  // the buttons dead for anyone not using a pointer. Suppress by recency
  // instead.
  let touched = 0;
  const fire = e => { if (e.cancelable) e.preventDefault(); send(b.dataset.k); };
  b.addEventListener("touchstart", e => { touched = Date.now(); fire(e); },
                     {passive:false});
  b.addEventListener("click", e => { if (Date.now() - touched > 700) fire(e); });
});

// swipe on the game surface only, so the rest of the page still scrolls
const screen = $("#screen");
let sx=0, sy=0, moved=false;
screen.addEventListener("touchstart", e => {
  const t = e.changedTouches[0]; sx=t.clientX; sy=t.clientY; moved=false;
  e.preventDefault();
}, {passive:false});
screen.addEventListener("touchmove", e => { e.preventDefault(); }, {passive:false});
screen.addEventListener("touchend", e => {
  const t = e.changedTouches[0], dx = t.clientX-sx, dy = t.clientY-sy;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx,ady) < 24) send("action");           // a tap is the action key
  else send(adx > ady ? (dx>0?"right":"left") : (dy>0?"down":"up"));
  e.preventDefault();
}, {passive:false});

// keep the page's own controls usable from a keyboard
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") e.stopPropagation();
}, true);

cards.addEventListener("click", e => {
  const c = e.target.closest(".card"); if(c) show(c.dataset.id);
});
$("#back").addEventListener("click", () => {
  document.body.classList.remove("playing"); renderList();
});
$("#q").addEventListener("input", renderList);
$("#sort").addEventListener("change", e => { sortKey = e.target.value; renderList(); });
document.querySelectorAll("#tabs button").forEach(b =>
  b.addEventListener("click", () => {
    document.querySelectorAll("#tabs button").forEach(x =>
      x.setAttribute("aria-selected", x===b));
    document.querySelectorAll(".pane").forEach(p =>
      p.classList.toggle("on", p.id === "pane-"+b.dataset.pane));
  }));
window.addEventListener("resize", fit);
window.addEventListener("orientationchange", () => setTimeout(fit, 250));

renderList();
if (window.matchMedia("(min-width:901px)").matches && GAMES.length) show(GAMES[0].id);
try { muteAudio(); } catch(e){}
"""

    page = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>ScriptProf explorer</title>
<style>{CSS}</style>
</head><body>
<div id="app">
  <aside id="list">
    <div id="listhead">
      <h1>ScriptProf explorer</h1>
      <div class="sub">{len(games)} generated games &middot; {n_regen} with levels
        regenerated by search</div>
      <div id="tools">
        <input id="q" type="search" placeholder="search name, ancestor, mutation"
               autocomplete="off" autocorrect="off" spellcheck="false">
        <select id="sort" aria-label="sort by">
          <option value="score">score</option>
          <option value="novelty">novelty</option>
          <option value="insight">insight</option>
          <option value="meanLen">solution length</option>
          <option value="lineage">generations</option>
        </select>
      </div>
    </div>
    <div id="cards"></div>
  </aside>
  <main id="detail">
    <div id="dhead">
      <button id="back" aria-label="back to the list">&#8592;</button>
      <div style="min-width:0">
        <div id="dtitle"></div>
        <div id="dsub"></div>
      </div>
    </div>
    <div id="stage">
      <div id="screen"><canvas id="gameCanvas"></canvas>
        <div id="hint">swipe or use the buttons &middot; tap = action</div></div>
      <div id="pad">
        <button data-k="up" aria-label="up">&#9650;</button>
        <button data-k="left" aria-label="left">&#9664;</button>
        <button data-k="down" aria-label="down">&#9660;</button>
        <button data-k="right" aria-label="right">&#9654;</button>
        <button data-k="action">action</button>
        <button data-k="undo">undo</button>
        <button data-k="restart">restart</button>
      </div>
    </div>
    <div id="err"></div>
    <div id="tabs">
      <button data-pane="metrics" aria-selected="true">metrics</button>
      <button data-pane="lineage" aria-selected="false">lineage</button>
      <button data-pane="source" aria-selected="false">source</button>
    </div>
    <div id="panes">
      <div class="pane on" id="pane-metrics"></div>
      <div class="pane" id="pane-lineage"></div>
      <div class="pane" id="pane-source"></div>
    </div>
  </main>
</div>
<!-- elements the engine expects to exist -->
<div style="display:none">
  <span id="errormessage"></span><span id="separator"></span>
  <img id="muteButton" alt=""><img id="unMuteButton" alt="">
</div>
{engine}
<script>{app.replace("__GAMES__", payload)}</script>
</body></html>"""
    out.write_text(page, encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archive", default="data/archive")
    ap.add_argument("--out", default=None)
    ap.add_argument("--shots", type=int, default=3)
    ap.add_argument("--scale", type=int, default=4)
    a = ap.parse_args()
    archive = Path(a.archive) if Path(a.archive).is_absolute() else ROOT / a.archive
    out = Path(a.out) if a.out else archive / "explorer.html"
    p = build(archive, out, shots=a.shots, scale=a.scale)
    print(f"wrote {p} ({p.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
