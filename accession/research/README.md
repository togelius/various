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

## Errata found in review

- **`book-pcg.md` F12 and D3** say generated rules are "ruled out by p. 300". They are not. Page 300 says attempts to generate whole *video games* have not produced games people want to play. The same page credits GAVEL's LLM-plus-search generation of playable board games. The obstacle the book names (p. 299) is that rules are hard to evaluate in isolation. See `DESIGN.md` pillar 1 and D2.
- **`literature-museology.md`, sample label "Ledger of Debts Forgiven"**, gives the ledger page tabs of dyed fish-skin. The museal reviewer flagged fish-skin as a material tied to specific Indigenous makers, so the generator's materials-to-avoid list should include it.
- **`tech-art.md` F7** gives Sonnet 5.5's cache-read price as $0.10 per million tokens. The feasibility review found $0.20 in the API skill documentation; this affects no design decision. In the same brief:
  - "Four cores give thousands of department playthroughs per minute" is overstated by about five times, at the assumed 1 ms per turn and 600 turns.
  - The diagram's "core/ runs in the Worker" is implausible for the full simulation gate, given serverless CPU limits.
- **`papers-semantic.md` §3.3 (S1)** asks for "high temperature". Current Claude models reject sampling parameters, so diversity has to come from varied inputs (`tech-art.md` F5).
