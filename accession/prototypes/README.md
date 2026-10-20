# Prototypes

These are throwaway scripts from the research and drafting phase. They back specific numbers in the design. None of them is game code; the real core will be written from scratch against `BUILD.md`.

| Folder | What it is | Run |
|---|---|---|
| `layout/` | The department-layout prototype: six programmes, the staff band, loops, repair, simplified curation, and the metrics. It backs the timings and sizes in `design/layout.md` and `DESIGN.md` §10.4. `stats_final.txt` is its measurement on 3,600 layouts; `samples/` holds example floor plans | `node proto.js 200` prints the tables; `node proto.js --show sculpture_court 6 1` prints one layout (sizes: 0 Cabinet, 1 Department, 2 Wing) |
| `difficulty/` | Role curves and duel costs (`roles.py`), death curves and run-clear rates (`pstar.py`), the per-floor door sequencer on a synthetic pool (`sequencer.py`, `seq_floor.py`), and simulation cost (`compute.py`) | `python3 pstar.py`; `python3 roles.py`; `python3 seq_floor.py 30 2 200` (pool size, Social-primary departments, runs) |
| `pipeline/` | The dud and recurrence arithmetic and the generation cost model behind `design/pipeline.md` §1 | `python3 arith.py`; `python3 cost.py` |
| `space-syntax/` | The twelve ASCII programme sketches from `research/museum-layouts.md` and the metrics measured on them | `python3 metrics.py .` |
| `art-probe/` | The art probe from `research/tech-art.md`: language-model-written 16×16 index grids under three palettes, Bollinger-style mask beings, three gallery mock-ups and a pixel-font legibility sheet | `python3 -I museum_probe.py FONTDIR OUTDIR` (needs Pillow and the fonts named in the script, from Google Fonts) |
| `bench/` | A micro-benchmark of rot.js map generation, field of view and pathfinding in Node | `node rotbench.cjs /path/to/rot.js` |

The sequencer's first headline run (`seq_floor.py 30 2 200`) used two Social-primary departments, which the design's lean forbids, because social is a secondary type only. The rerun without them (`python3 seq_floor.py 30 0 200`) gave these results over 200 runs, and they are the ones `DESIGN.md` §9.3 reports:

| Distinct primary types visited | Runs |
|---|---|
| 5 | 53 |
| 6 | 136 |
| 7 | 11 |

All 7 types were offered in every run, and a relaxed rule was used in 86 runs.
