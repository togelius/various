# Research briefs

Seven briefs written before any design. Each lists its sources with how deeply each was read (full text, method and results, abstract, or citation only), and marks anything it could not confirm as unverified.

| Brief | Topic |
|---|---|
| [`book-pcg.md`](book-pcg.md) | The PCG part of *Artificial Intelligence and Games*, 2nd ed. (chapters 7–9, §13.2.2, chapter 14), read for this game: the taxonomy applied to each generator, method fit, orchestration, an evaluation plan |
| [`papers-levels.md`](papers-levels.md) | Julian's and co-authors' work on level and dungeon generation, quality-diversity, experience-driven PCG, procedural personas and evaluating generators (53 sources) |
| [`papers-semantic.md`](papers-semantic.md) | Data games, orchestration and LLM-based generation; the option space for "infinite departments" |
| [`roguelike-systems.md`](roguelike-systems.md) | Shattered Pixel Dungeon (from its source code and its developer's writing), Brogue, DCSS, Slay the Spire, Hades, Vampire Survivors, Dead Cells and others; meta-progression models |
| [`literature-museology.md`](literature-museology.md) | Calvino, Borges and their kin; museum practice (label grammar, word budgets, attribution qualifiers, visitor studies); sensitivities; six sample labels |
| [`tech-art.md`](tech-art.md) | Platform, determinism, 16-bit art without an art team, label text, audio, and the cost and latency of LLM generation. The probe images are in [`../prototypes/art-probe/`](../prototypes/art-probe/) |
| [`museum-layouts.md`](museum-layouts.md) | Museum architecture, space syntax, roguelike level-generation code (SPD, Brogue, DCSS, Unexplored), and twelve architectural programmes with sketches |

## Errata

Found in review, and in a verification pass over `DESIGN.md` on 20 October 2026. `DESIGN.md` carries the corrected versions; the briefs are left as written.

- **`book-pcg.md` F12 and D3** say generated rules are "ruled out by p. 300". They are not. Page 300 says the video-game *rule* generators it surveys (Togelius and Schmidhuber's Pac-Man-like games, Mechanic Miner, VGDL, answer-set programming) have not yet produced games anyone but their makers would want to play. It reads this as evidence that rule sets are hard to evaluate, partly because of real-time play. The same page credits GAVEL's LLM-plus-search generation of playable board games, and p. 299 says rules are almost impossible to evaluate in isolation. See `DESIGN.md` pillar 1 and D2.
- **Book page numbers** in `book-pcg.md` follow the authors' PDF. Chapters 7–9 match the Springer print; chapter 14 runs two pages later in print, so p. 430 is about p. 432 there.
- **CrawLLM's extended version**, cited as an unverified preprint in `book-pcg.md`, `papers-semantic.md` and `tech-art.md`, is published: M. Zammit, A. Liapis and G. N. Yannakakis, "CrawLLM: An LLM-Based Pipeline for Game Asset Generation", *IEEE Transactions on Games* 18(1):185–196, 2026. Its epoch question had four options, so chance was 25%, and its "only when all such details were highly specific" is qualified by "typically" and offered as an argued reading of qualitative data.
- **`literature-museology.md`**:
  - The sample label "Ledger of Debts Forgiven" gives the ledger page tabs of dyed fish-skin. The museal reviewer flagged fish-skin as a material tied to specific Indigenous makers, so the generator's materials-to-avoid list should include it.
  - F18's "suggestive rather than didactic" is Elisabeth Ginsberg's phrase, in her *Beautiful Trouble* entry on *Mining the Museum*, not "reviewers'".
- **`tech-art.md`**:
  - F7's Sonnet 5.5 cache-read price of $0.10 per million tokens is **correct** (0.05× the $2 input price; Anthropic's pricing page, 20 October 2026). An earlier version of this list called it wrong on the strength of the feasibility review's $0.20, which came from a stale cached table.
  - F6 says closed enums alone guarantee that every generated id exists. Structured outputs guarantee the shape in most cases, but not the capitalisation of enum values, and a refusal or a `max_tokens` cut-off can break the shape. Check the stop reason first and compare ids without regard to case (`DESIGN.md` §12.3).
  - "Four cores give thousands of department playthroughs per minute" is overstated by about five times, at the assumed 1 ms per turn and 600 turns.
  - The diagram's "core/ runs in the Worker" is implausible for the full simulation gate, given serverless CPU limits.
- **`papers-semantic.md` §3.3 (S1)** asks for "high temperature". Current Claude models reject non-default sampling parameters, so diversity has to come from varied inputs (`tech-art.md` F5).
